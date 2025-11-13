
'use server';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

// Initialiser Firebase Admin SDK une seule fois
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Récupérer la clé secrète Stripe depuis les secrets de la fonction
const stripeSecret = functions.config().stripe.secret;
const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

/**
 * Webhook qui écoute les événements de session de paiement Stripe.
 * Il est déclenché lorsqu'un paiement est réussi.
 */
export const stripeWebhook = functions.https.onRequest(async (request, response) => {
    // La signature est gérée par l'extension, nous pouvons nous fier à l'appel.
    const event = request.body;

    // Nous nous intéressons uniquement à la fin d'une session de paiement réussie.
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.client_reference_id;
        if (!userId) {
            functions.logger.error("Erreur critique : Pas de client_reference_id (userId) dans la session Stripe.");
            response.status(400).send("User ID manquant.");
            return;
        }

        functions.logger.info(`Session de paiement réussie pour l'utilisateur: ${userId}`);

        // Récupérer les articles achetés
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const userDocRef = admin.firestore().collection('users').doc(userId);
        
        const updates: { [key: string]: admin.firestore.FieldValue } = {};

        // Parcourir chaque article acheté
        for (const item of lineItems.data) {
            if (item.price?.product) {
                const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id;
                const product = await stripe.products.retrieve(productId);
                
                // Vérifier les métadonnées pour créditer les bons tickets
                if (product.metadata.packUploadTickets) {
                    const amount = parseInt(product.metadata.packUploadTickets, 10);
                    updates.packUploadTickets = admin.firestore.FieldValue.increment(amount);
                    functions.logger.info(`Crédit de ${amount} tickets d'upload pour l'utilisateur ${userId}.`);
                } else if (product.metadata.packAiTickets) {
                    const amount = parseInt(product.metadata.packAiTickets, 10);
                    updates.packAiTickets = admin.firestore.FieldValue.increment(amount);
                    functions.logger.info(`Crédit de ${amount} tickets IA pour l'utilisateur ${userId}.`);
                }
            }
        }

        // Mettre à jour le document de l'utilisateur si des tickets doivent être crédités
        if (Object.keys(updates).length > 0) {
            try {
                await userDocRef.update(updates);
                functions.logger.info(`SUCCÈS : Le compte de l'utilisateur ${userId} a été crédité.`);
            } catch (error) {
                functions.logger.error(`Échec de la mise à jour Firestore pour l'utilisateur ${userId}:`, error);
                response.status(500).send("Erreur lors de la mise à jour du profil utilisateur.");
                return;
            }
        }
    }

    // Répondre à Stripe que l'événement a bien été reçu.
    response.status(200).send('Événement reçu.');
});
