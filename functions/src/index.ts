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

// Initialiser Firebase Admin SDK
admin.initializeApp();

// Initialiser le client Stripe avec la clé secrète.
// ASSUREZ-VOUS de configurer cette clé dans votre environnement de fonctions:
// firebase functions:config:set stripe.secret_key="votre_sk_test_..."
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: "2024-06-20",
});

/**
 * Cloud Function qui se déclenche à la création d'un document de paiement
 * dans Firestore, vérifie la session de paiement avec Stripe, et crédite
 * les tickets à l'utilisateur en fonction des métadonnées du produit.
 */
exports.fulfillOrder = functions.firestore
  .document("customers/{userId}/payments/{paymentId}")
  .onCreate(async (snapshot, context) => {
    const payment = snapshot.data();
    const userId = context.params.userId;

    if (!payment) {
      functions.logger.error("Le document de paiement est vide.");
      return;
    }

    // Un paiement peut provenir soit d'un achat unique (payment_intent)
    // soit d'un abonnement (subscription). On vérifie les deux.
    let checkoutSessionId;
    if (payment.checkout_session_id) {
        checkoutSessionId = payment.checkout_session_id;
    } else if (payment.invoice) {
        // Pour les paiements récurrents d'abonnements, on récupère la session depuis la facture
        try {
            const invoice = await stripe.invoices.retrieve(payment.invoice);
            if (typeof invoice.subscription !== "string") {
                functions.logger.error("L'ID de l'abonnement n'est pas une chaîne valide.", {invoice});
                return;
            }
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
             if (subscription.metadata.checkout_session_id) {
                checkoutSessionId = subscription.metadata.checkout_session_id;
            }
        } catch (error) {
             functions.logger.error("Erreur lors de la récupération de la facture ou de l'abonnement.", {error});
             return;
        }
    }


    if (!checkoutSessionId) {
      functions.logger.warn("Aucun checkout_session_id trouvé dans le document de paiement.", {paymentId: snapshot.id});
      // Essayer de récupérer la session depuis l'intention de paiement si disponible
      if (payment.payment_intent) {
          try {
              const pi = await stripe.paymentIntents.retrieve(payment.payment_intent, {expand: ["invoice"]});
              // @ts-ignore
              if (pi.invoice && pi.invoice.subscription && typeof pi.invoice.subscription === 'string') {
                  // @ts-ignore
                  const sub = await stripe.subscriptions.retrieve(pi.invoice.subscription);
                  if (sub.metadata.checkout_session_id) {
                      checkoutSessionId = sub.metadata.checkout_session_id;
                  }
              }
          } catch(e) {
              functions.logger.error("Erreur en essayant de trouver la session via PI", e);
          }
      }
      if (!checkoutSessionId) {
        functions.logger.error("ID de session de paiement introuvable, impossible de traiter la commande.");
        return;
      }
    }


    try {
      // Récupérer les détails de la session de paiement depuis Stripe
      const session = await stripe.checkout.sessions.listLineItems(checkoutSessionId);
      const lineItem = session.data[0]; // On suppose un seul article par achat

      if (!lineItem || !lineItem.price || !lineItem.price.product) {
        functions.logger.error("Données de la session de paiement incomplètes.", {session});
        return;
      }

      // Récupérer le produit Stripe pour lire ses métadonnées
      const product = await stripe.products.retrieve(
        lineItem.price.product as string
      );
      const metadata = product.metadata;

      functions.logger.log(`Traitement de la commande pour l'utilisateur ${userId}`, {metadata});

      const userRef = admin.firestore().doc(`users/${userId}`);
      const updates: {[key: string]: admin.firestore.FieldValue} = {};

      // Vérifier les métadonnées pour créditer les tickets
      if (metadata.packUploadTickets) {
        updates.packUploadTickets = admin.firestore.FieldValue.increment(
          parseInt(metadata.packUploadTickets, 10)
        );
      }

      if (metadata.packAiTickets) {
        updates.packAiTickets = admin.firestore.FieldValue.increment(
          parseInt(metadata.packAiTickets, 10)
        );
      }
      
      // Ici, on pourrait aussi gérer l'activation des abonnements, etc.
      // if (metadata.subscriptionTier) { ... }

      if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
        functions.logger.log(`Utilisateur ${userId} crédité avec succès.`, {updates});
      } else {
        functions.logger.log("Aucune action à effectuer pour ce produit (pas de métadonnées de tickets).", {metadata});
      }
    } catch (error) {
      functions.logger.error(
        "Erreur lors du traitement de la commande:",
        error
      );
    }
  });
