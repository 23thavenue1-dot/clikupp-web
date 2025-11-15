
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

// Initialiser l'admin Firebase et Stripe
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
    console.error("La clé secrète Stripe n'est pas configurée dans les variables d'environnement.");
}
const stripe = new Stripe(stripeSecret || '', {
  apiVersion: '2024-06-20',
});

/**
 * Fonction qui se déclenche à la création d'un document de paiement par l'extension Stripe.
 * Elle récupère les métadonnées du produit acheté directement depuis l'API Stripe et crédite les tickets à l'utilisateur.
 */
exports.onPaymentSuccess = functions.firestore
  .document('/customers/{userId}/payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const paymentData = snap.data();
    functions.logger.info(`Nouvel événement de paiement détecté pour l'utilisateur ${context.params.userId}.`, { paymentId: context.params.paymentId });

    if (!paymentData || !paymentData.checkout_session_id) {
        functions.logger.error("Document de paiement incomplet ou sans 'checkout_session_id'.", { data: paymentData });
        return null;
    }
    
    const checkoutSessionId = paymentData.checkout_session_id;

    try {
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
            expand: ['line_items.data.price.product'],
        });

        const userId = session.client_reference_id;
        if (!userId) {
            functions.logger.error("L'ID de l'utilisateur (client_reference_id) est manquant dans la session Stripe.", { session });
            return null;
        }

        if (!session.line_items || session.line_items.data.length === 0) {
            functions.logger.error("Aucun article trouvé dans la session de paiement Stripe.", { session });
            return null;
        }

        const updates = {};
        for (const item of session.line_items.data) {
            const product = item.price?.product;
            if (product && product.metadata) {
                functions.logger.info(`Traitement du produit : ${product.name}`, { metadata: product.metadata });
                
                if (product.metadata.packUploadTickets && Number(product.metadata.packUploadTickets) > 0) {
                    updates.packUploadTickets = admin.firestore.FieldValue.increment(Number(product.metadata.packUploadTickets));
                    functions.logger.info(`Ajout de ${product.metadata.packUploadTickets} tickets d'upload.`);
                }
                if (product.metadata.packAiTickets && Number(product.metadata.packAiTickets) > 0) {
                    updates.packAiTickets = admin.firestore.FieldValue.increment(Number(product.metadata.packAiTickets));
                    functions.logger.info(`Ajout de ${product.metadata.packAiTickets} tickets IA.`);
                }
            }
        }
        
        if (Object.keys(updates).length > 0) {
            const userRef = admin.firestore().collection('users').doc(userId);
            await userRef.update(updates);
            functions.logger.info(`Succès : Le profil de l'utilisateur ${userId} a été mis à jour.`, { updates });
            return { success: true, userId, updates };
        } else {
            functions.logger.warn("Aucune métadonnée de ticket trouvée sur les produits achetés.", { line_items: session.line_items.data });
            return null;
        }

    } catch (error) {
        functions.logger.error("Erreur lors de la récupération des détails depuis Stripe ou de la mise à jour Firestore :", error);
        return Promise.reject(error);
    }
});
