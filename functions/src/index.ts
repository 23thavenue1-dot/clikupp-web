/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { buffer } from "micro";

// Initialiser Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Récupérer les clés depuis la configuration des fonctions
const stripeSecretKey = functions.config().stripe.secret_key;
const webhookSecret = functions.config().stripe.webhook_secret;

if (!stripeSecretKey || !webhookSecret) {
  console.error("Erreur critique : Les clés Stripe (secret_key ou webhook_secret) ne sont pas configurées.");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});


/**
 * Webhook qui écoute les événements de Stripe, principalement 'checkout.session.completed'.
 * Il vérifie la signature de la requête, puis appelle la logique pour créditer les tickets.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).send('Method Not Allowed');
        return;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
        functions.logger.error("Aucune signature Stripe dans les en-têtes.");
        res.status(400).send("Webhook Error: No signature");
        return;
    }

    let event: Stripe.Event;
    try {
        const rawBody = await buffer(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
        functions.logger.error("Erreur de vérification de la signature du webhook:", err);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Gérer l'événement
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        try {
            await fulfillOrderLogic(session);
        } catch (error) {
            functions.logger.error("Erreur lors du traitement de fulfillOrderLogic:", error);
            // On ne renvoie pas d'erreur 500 à Stripe pour éviter qu'il ne réessaie sans fin si l'erreur est logique.
        }
    }

    res.status(200).json({ received: true });
});


/**
 * Logique métier pour créditer un utilisateur après un paiement réussi.
 * Cette fonction est maintenant appelée par le webhook.
 * @param session La session de paiement Stripe.
 */
async function fulfillOrderLogic(session: Stripe.Checkout.Session) {
    if (!session.customer || typeof session.customer !== 'string') {
        functions.logger.error("ID client manquant ou invalide dans la session de paiement.", { sessionId: session.id });
        return;
    }

    // Retrouver l'utilisateur Firebase via son ID client Stripe
    const usersRef = admin.firestore().collection('users');
    const userQuery = await usersRef.where('stripeCustomerId', '==', session.customer).limit(1).get();

    if (userQuery.empty) {
        functions.logger.error(`Aucun utilisateur trouvé avec le Stripe Customer ID: ${session.customer}`);
        return;
    }

    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;

    try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const lineItem = lineItems.data[0];

        if (!lineItem || !lineItem.price || !lineItem.price.product) {
            functions.logger.error("Données de la session de paiement incomplètes.", { session });
            return;
        }

        const product = await stripe.products.retrieve(lineItem.price.product as string);
        const metadata = product.metadata;

        functions.logger.log(`Traitement de la commande pour l'utilisateur ${userId}`, { metadata });

        const updates: { [key: string]: admin.firestore.FieldValue } = {};

        if (metadata.packUploadTickets) {
            updates.packUploadTickets = admin.firestore.FieldValue.increment(parseInt(metadata.packUploadTickets, 10));
        }
        if (metadata.packAiTickets) {
            updates.packAiTickets = admin.firestore.FieldValue.increment(parseInt(metadata.packAiTickets, 10));
        }

        if (Object.keys(updates).length > 0) {
            await userDoc.ref.update(updates);
            functions.logger.log(`Utilisateur ${userId} crédité avec succès.`, { updates });
        } else {
            functions.logger.log("Aucune action de crédit de ticket pour ce produit.", { metadata });
        }

    } catch (error) {
        functions.logger.error(`Erreur lors du traitement de la commande pour l'utilisateur ${userId}:`, error);
        // Rethrow pour que le webhook sache qu'il y a eu un problème
        throw error;
    }
}


/**
 * Cloud Function (déclenchée par Firestore) qui synchronise le stripeCustomerId.
 * Se déclenche quand un checkout_session est créé.
 */
exports.syncStripeCustomerId = functions.firestore
  .document("customers/{userId}/checkout_sessions/{sessionId}")
  .onCreate(async (snapshot, context) => {
    const session = snapshot.data();
    const userId = context.params.userId;
    
    // Attendre que la session Stripe soit créée et ait un customer ID
    // C'est une approche simplifiée. Une version plus robuste pourrait utiliser un polling.
    await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5s

    try {
      const sessionDoc = await snapshot.ref.get();
      const updatedSession = sessionDoc.data();

      if (updatedSession?.customer) {
        const userDocRef = admin.firestore().doc(`users/${userId}`);
        await userDocRef.update({ stripeCustomerId: updatedSession.customer });
        functions.logger.log(`Stripe Customer ID ${updatedSession.customer} synchronisé pour l'utilisateur ${userId}.`);
      } else if (updatedSession?.error) {
         functions.logger.warn(`La création de la session a échoué pour l'utilisateur ${userId}. Pas de synchronisation.`, updatedSession.error);
      }
      else {
          functions.logger.warn(`Customer ID non trouvé dans la session après 5s pour l'utilisateur ${userId}.`);
      }

    } catch (error) {
      functions.logger.error(`Erreur lors de la synchronisation du Stripe Customer ID pour l'utilisateur ${userId}:`, error);
    }
  });