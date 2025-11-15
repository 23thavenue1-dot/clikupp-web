
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

// Initialiser l'admin Firebase et Stripe
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Assurez-vous que la clé secrète est configurée dans les variables d'environnement de la fonction
// firebase functions:config:set stripe.secret="sk_test_..."
const stripe = new Stripe(functions.config().stripe.secret, {
  apiVersion: '2024-06-20',
});

/**
 * Fonction qui se déclenche à la création d'un document de paiement par l'extension Stripe.
 * Elle récupère les métadonnées du produit acheté directement depuis l'API Stripe et crédite les tickets à l'utilisateur.
 */
exports.onPaymentSuccess = functions.firestore
  .document('/customers/{userId}/payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    const userId = context.params.userId;
    functions.logger.info(`Nouvel événement de paiement détecté pour l'utilisateur ${userId}.`, { paymentId: context.params.paymentId });

    if (!payment || !payment.items || payment.items.length === 0) {
        functions.logger.error("Document de paiement incomplet ou sans 'items'.", { data: payment });
        return null;
    }

    try {
        const line_items = payment.items;
        const updates = {};

        for (const item of line_items) {
            if (item.price && item.price.product) {
                 const product = await stripe.products.retrieve(item.price.product);
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
        }
        
        if (Object.keys(updates).length > 0) {
            const userRef = admin.firestore().collection('users').doc(userId);
            await userRef.update(updates);
            functions.logger.info(`Succès : Le profil de l'utilisateur ${userId} a été mis à jour.`, { updates });
            return { success: true, userId, updates };
        } else {
            functions.logger.warn("Aucune métadonnée de ticket trouvée sur les produits achetés.", { line_items });
            return null;
        }

    } catch (error) {
        functions.logger.error("Erreur lors de la récupération des détails depuis Stripe ou de la mise à jour Firestore :", error);
        return Promise.reject(error);
    }
});
