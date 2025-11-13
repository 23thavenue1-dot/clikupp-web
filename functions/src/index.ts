
'use server';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { buffer } from "micro";

// Initialiser Firebase Admin SDK une seule fois
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ---- CONFIGURATION STRIPE ----
// On garde cette vérification pour être certain que les clés sont bien là.
let stripeSecretKey: string;
let stripeWebhookSecret: string;
let configError = false;

try {
  const stripeConfig = functions.config().stripe;
  if (!stripeConfig || !stripeConfig.secret_key || !stripeConfig.webhook_secret) {
    functions.logger.error("Erreur critique : Les variables 'stripe.secret_key' et/ou 'stripe.webhook_secret' sont manquantes.");
    configError = true;
  } else {
    stripeSecretKey = stripeConfig.secret_key;
    stripeWebhookSecret = stripeConfig.webhook_secret;
  }
} catch (e) {
  functions.logger.error("Erreur critique : Le groupe de configuration 'stripe' est manquant.", e);
  configError = true;
}

const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: "2024-06-20",
});


// ---- WEBHOOK UNIQUE ET MAÎTRISÉ ----
// C'est notre nouvelle et unique fonction. Elle est déclenchée par une requête HTTP de Stripe.
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (configError) {
    functions.logger.error("Le webhook ne peut pas s'exécuter car la configuration Stripe est incomplète.");
    res.status(500).send("Erreur de configuration serveur.");
    return;
  }

  // 1. Valider que la requête vient bien de Stripe
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, signature!, stripeWebhookSecret);
  } catch (err: any) {
    functions.logger.error("Signature du webhook invalide.", err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  functions.logger.log("Événement Stripe reçu et validé !", { type: event.type });

  // 2. Gérer l'événement 'checkout.session.completed'
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    functions.logger.log("Session de paiement terminée reçue", { sessionId: session.id });

    // 3. Récupérer l'ID de l'utilisateur (C'EST LA CLÉ !)
    const userId = session.client_reference_id;
    if (!userId) {
      functions.logger.error("CRITICAL : ID utilisateur (client_reference_id) manquant dans la session Stripe.", { session });
      res.status(400).send("Client reference ID is missing.");
      return;
    }
    functions.logger.log(`ID utilisateur trouvé : ${userId}`);

    try {
      // 4. Récupérer les détails de la commande (line_items) pour trouver le produit
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const firstItem = lineItems.data[0];
      
      if (!firstItem || !firstItem.price || !firstItem.price.product) {
          functions.logger.error("Impossible de trouver le produit dans la session.", { session });
          res.status(500).send("Product information missing.");
          return;
      }
      
      const productId = typeof firstItem.price.product === 'string' ? firstItem.price.product : firstItem.price.product.id;
      functions.logger.log(`Produit Stripe ID : ${productId}`);

      // 5. Récupérer l'objet Produit complet pour lire ses MÉTADONNÉES
      const product = await stripe.products.retrieve(productId);
      const metadata = product.metadata;
      functions.logger.log(`Métadonnées du produit récupérées :`, { metadata });

      const userDocRef = admin.firestore().doc(`users/${userId}`);
      const updates: { [key: string]: any } = {};

      // 6. Déterminer quel pack a été acheté et préparer la mise à jour
      if (metadata.packUploadTickets) {
          const amount = parseInt(metadata.packUploadTickets, 10);
          if (!isNaN(amount)) {
              updates.packUploadTickets = admin.firestore.FieldValue.increment(amount);
          }
      } else if (metadata.packAiTickets) {
          const amount = parseInt(metadata.packAiTickets, 10);
          if (!isNaN(amount)) {
              updates.packAiTickets = admin.firestore.FieldValue.increment(amount);
          }
      } else {
          functions.logger.warn("Aucune métadonnée de crédit de ticket trouvée pour ce produit.", { productId });
          res.status(200).send("Success (no action taken).");
          return;
      }
      
      // 7. Appliquer la mise à jour sur l'utilisateur
      if (Object.keys(updates).length > 0) {
        await userDocRef.update(updates);
        functions.logger.log(`SUCCÈS : Le compte de l'utilisateur ${userId} a été crédité.`, { updates });
      }

    } catch (error) {
      functions.logger.error(`Erreur lors du traitement de la session ${session.id} :`, error);
      res.status(500).send("Internal server error while processing payment.");
      return;
    }
  }

  // 8. Confirmer à Stripe que tout s'est bien passé
  res.status(200).send("Event received successfully.");
});
