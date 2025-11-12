
'use server';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { buffer } from "micro";

// Initialiser Firebase Admin SDK une seule fois
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Récupérer les clés depuis la configuration des fonctions
// C'est ici que les clés que nous avons définies via la CLI sont utilisées
const stripeSecretKey = functions.config().stripe.secret_key;
const webhookSecret = functions.config().stripe.webhook_secret;

if (!stripeSecretKey || !webhookSecret) {
  console.error("Erreur critique : Les clés secrètes Stripe (secret_key et webhook_secret) ne sont pas configurées.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

/**
 * Webhook unique et robuste qui écoute les événements de Stripe.
 * C'est le point d'entrée pour toutes les confirmations de paiement.
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    functions.logger.error("Aucune signature Stripe trouvée dans l'en-tête.");
    return res.status(400).send('Webhook Error: No signature provided.');
  }

  const reqBuffer = await buffer(req);
  let event: Stripe.Event;

  try {
    // Vérifier la signature du webhook est l'étape de sécurité la plus importante.
    event = stripe.webhooks.constructEvent(reqBuffer, sig, webhookSecret);
    functions.logger.log(`Événement Stripe reçu et validé : ${event.type}`);
  } catch (err: any) {
    functions.logger.error("Erreur de vérification de la signature du webhook:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer l'événement 'checkout.session.completed'
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Vérifier si la session est bien un paiement réussi
    if (session.payment_status === 'paid') {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const product = await stripe.products.retrieve(lineItems.data[0].price!.product as string);
        const metadata = product.metadata;
        const userId = session.client_reference_id; // L'ID utilisateur doit être passé lors de la création de la session

        if (!userId) {
          functions.logger.error("Aucun client_reference_id (userId) trouvé dans la session Stripe.", { session_id: session.id });
          return res.status(400).send("User ID manquant dans la session.");
        }

        const userDocRef = admin.firestore().doc(`users/${userId}`);
        const updates: { [key: string]: any } = { stripeCustomerId: session.customer };

        if (metadata.packUploadTickets) {
          updates.packUploadTickets = admin.firestore.FieldValue.increment(parseInt(metadata.packUploadTickets, 10));
        }
        if (metadata.packAiTickets) {
          updates.packAiTickets = admin.firestore.FieldValue.increment(parseInt(metadata.packAiTickets, 10));
        }

        if (Object.keys(updates).length > 1) {
          await userDocRef.update(updates);
          functions.logger.log(`SUCCÈS : Utilisateur ${userId} crédité avec succès.`, { updates });
        } else {
          functions.logger.log("Aucune métadonnée de crédit de ticket trouvée pour ce produit.", { productId: product.id });
        }

      } catch (error) {
        functions.logger.error(`Erreur lors du traitement de la session ${session.id}:`, error);
        return res.status(500).send("Erreur interne lors du traitement du paiement.");
      }
    }
  }

  // Confirmer la bonne réception de l'événement à Stripe
  return res.status(200).send({ received: true });
});

// Les anciennes fonctions sont maintenant obsolètes et supprimées.
// La logique est centralisée dans le webhook ci-dessus.
    
