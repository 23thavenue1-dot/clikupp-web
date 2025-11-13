
'use server';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

// Initialiser Firebase Admin SDK une seule fois
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Tenter de récupérer les clés et préparer un indicateur d'erreur
let stripeSecretKey;
let configError = false;

try {
  stripeSecretKey = functions.config().stripe.secret_key;
  if (!stripeSecretKey) {
    functions.logger.error("Erreur critique de configuration : La variable 'stripe.secret_key' est manquante.");
    configError = true;
  }
} catch (e) {
  functions.logger.error("Erreur critique : Le groupe de configuration 'stripe' est manquant. Exécutez 'firebase functions:config:set stripe.secret_key=...'.", e);
  configError = true;
}


const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: "2024-06-20",
});

/**
 * Déclencheur Firestore qui crédite les tickets à un utilisateur
 * après un paiement unique réussi via l'extension Stripe.
 */
export const creditTicketsOnSuccessfulPayment = functions.firestore
  .document("customers/{userId}/payments/{paymentId}")
  .onCreate(async (snap, context) => {
    
    // Si les clés ne sont pas configurées, on arrête tout.
    if (configError) {
        functions.logger.error("La fonction ne peut pas s'exécuter car les clés Stripe ne sont pas configurées.");
        return;
    }
    
    const paymentData = snap.data();
    const { userId } = context.params;

    functions.logger.log(`Nouveau paiement détecté pour l'utilisateur ${userId}. Document: ${snap.id}`, { paymentData });

    // Ne traiter que les paiements uniques réussis
    if (paymentData.status !== 'succeeded' || paymentData.mode !== 'payment') {
        functions.logger.log("Le paiement n'est pas un achat unique réussi. Fin du traitement.");
        return;
    }

    try {
        if (!paymentData.items || paymentData.items.length === 0) {
            functions.logger.error("Aucun 'item' trouvé dans les données du paiement.", { paymentId: snap.id });
            return;
        }

        // Récupérer le produit depuis Stripe pour lire ses métadonnées
        const price = paymentData.items[0].price;
        if (!price || !price.product) {
            functions.logger.error("ID de produit manquant dans les données du paiement.", { paymentId: snap.id });
            return;
        }
        
        const product = await stripe.products.retrieve(price.product);
        const metadata = product.metadata;
        functions.logger.log(`Produit récupéré sur Stripe: ${product.id}`, { metadata });

        const userDocRef = admin.firestore().doc(`users/${userId}`);
        const updates: { [key: string]: any } = {};

        // Déterminer quel type de pack a été acheté et préparer la mise à jour
        if (metadata.packUploadTickets) {
            const amount = parseInt(metadata.packUploadTickets, 10);
            if (!isNaN(amount)) {
                updates.packUploadTickets = admin.firestore.FieldValue.increment(amount);
                functions.logger.log(`Crédit de ${amount} tickets d'upload pour l'utilisateur ${userId}.`);
            }
        } else if (metadata.packAiTickets) {
            const amount = parseInt(metadata.packAiTickets, 10);
            if (!isNaN(amount)) {
                updates.packAiTickets = admin.firestore.FieldValue.increment(amount);
                functions.logger.log(`Crédit de ${amount} tickets IA pour l'utilisateur ${userId}.`);
            }
        } else {
            functions.logger.warn("Aucune métadonnée de crédit de ticket trouvée pour ce produit.", { productId: product.id });
            return;
        }

        // Appliquer la mise à jour sur le document utilisateur
        await userDocRef.update(updates);
        functions.logger.log(`SUCCÈS : Le compte de l'utilisateur ${userId} a été crédité.`, { updates });

    } catch (error: any) {
        functions.logger.error(`Erreur lors du traitement du paiement ${snap.id} pour l'utilisateur ${userId}:`, error);
        // Optionnel : enregistrer l'erreur dans un document Firestore pour un suivi
    }
});
