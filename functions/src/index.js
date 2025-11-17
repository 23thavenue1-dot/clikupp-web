
"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Only initialize the app if it hasn't been initialized before
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Cloud Function that triggers when a one-time payment (ticket pack) is created.
 * It credits the purchased tickets to the user's profile.
 */
exports.onPaymentSuccess = functions
  .region("us-central1")
  .firestore.document("customers/{userId}/payments/{paymentId}")
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    const { userId } = context.params;

    functions.logger.info(
      `PAIEMENT déclenché pour l'utilisateur ${userId}.`,
      { paymentData: payment }
    );

    // Metadata is now directly on the 'payment' object
    const meta = payment.metadata || {}; 
    const uploadTickets = Number(meta.packUploadTickets || 0);
    const aiTickets = Number(meta.packAiTickets || 0);

    if (!uploadTickets && !aiTickets) {
      functions.logger.warn(
        "Paiement sans métadonnées de tickets de pack, on ignore.",
        { metadata: meta }
      );
      return;
    }

    const userRef = db.doc(`users/${userId}`);
    const updates = {};

    if (uploadTickets > 0) {
      updates.packUploadTickets = admin.firestore.FieldValue.increment(uploadTickets);
    }
    if (aiTickets > 0) {
      updates.packAiTickets = admin.firestore.FieldValue.increment(aiTickets);
    }

    try {
      await userRef.set(updates, { merge: true });
      functions.logger.info(
        `Succès PAIEMENT ! Profil mis à jour pour ${userId}.`,
        { updates }
      );
    } catch (error) {
      functions.logger.error(
        `Erreur PAIEMENT lors de la mise à jour du profil pour ${userId}:`,
        error
      );
    }
  });


/**
 * Cloud Function that triggers on a subscription change.
 * It updates the subscription status and ticket quotas on the user profile.
 * It also creates a representative document in the 'payments' collection for history.
 */
exports.onSubscriptionChange = functions
  .region("us-central1")
  .firestore.document("customers/{userId}/subscriptions/{subId}")
  .onWrite(async (change, context) => {
    const { userId, subId } = context.params;
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;

    functions.logger.info(`Déclenchement ABONNEMENT pour l'utilisateur ${userId}.`, { afterData });

    const userRef = db.doc(`users/${userId}`);

    // --- CASE 1: Subscription becomes ACTIVE (new or reactivated) ---
    if (afterData && afterData.status === "active" && (!beforeData || beforeData.status !== "active")) {
      
      const meta = afterData.metadata || {};
      const tier = meta.subscriptionTier || 'none';
      
      if (tier === 'none') {
        functions.logger.error(`Erreur ABONNEMENT: 'subscriptionTier' non trouvé dans les métadonnées pour ${userId}.`, { metadata: meta });
        return;
      }
      
      const uploadTickets = meta.monthlyUploadTickets === 'unlimited' 
          ? 999999 
          : Number(meta.monthlyUploadTickets || 0);

      const aiTickets = Number(meta.monthlyAiTickets || 0);

      const updates = {
          subscriptionTier: tier,
          subscriptionUploadTickets: uploadTickets,
          subscriptionAiTickets: aiTickets,
          subscriptionRenewalDate: afterData.current_period_end, // timestamp
      };

      try {
          // A. Update user profile with subscription rights
          await userRef.set(updates, { merge: true });
          functions.logger.info(`Succès ABONNEMENT ! Plan '${tier}' activé pour ${userId}.`, { updates });

          // B. Create a representative payment document for purchase history
          const priceInfo = afterData.items?.[0]?.price;
          if (priceInfo) {
              const productName =
                  priceInfo.product?.name ||       // 1. Nom officiel du produit Stripe
                  meta.productName ||              // 2. Ce que nous avons mis dans metadata
                  `Abonnement - ${tier}`;          // 3. Fallback générique

              const paymentForHistory = {
                  created: afterData.created.seconds, // Use subscription creation time
                  amount: priceInfo.unit_amount,
                  currency: priceInfo.currency,
                  status: 'succeeded',
                  metadata: {
                      productName: productName
                  },
                  _generated_for_history: true, 
              };
              
              // Use the subscription ID as the payment document ID to prevent duplicates
              const paymentDocRef = db.doc(`customers/${userId}/payments/sub_${subId}`);
              await paymentDocRef.set(paymentForHistory);
              functions.logger.info(`Entrée d'historique créée pour l'abonnement ${subId} : ${productName}`);
          }

      } catch (error) {
          functions.logger.error(`Erreur ABONNEMENT lors de l'activation pour ${userId}:`, error);
      }
      return;
    }

    // --- CASE 2: Subscription is CANCELED, EXPIRED, or UNPAID (but not yet deleted) ---
    if (afterData && ["canceled", "past_due", "unpaid"].includes(afterData.status) && beforeData?.status === "active") {
       const updates = {
          subscriptionTier: 'none',
          subscriptionUploadTickets: 0,
          subscriptionAiTickets: 0,
          subscriptionRenewalDate: null
       };
        try {
          await userRef.set(updates, { merge: true });
          functions.logger.info(`Abonnement désactivé pour ${userId}.`, { status: afterData.status });
        } catch (error) {
           functions.logger.error(`Erreur lors de la désactivation de l'abonnement pour ${userId}:`, error);
        }
        return;
    }
    
    // --- CASE 3: Subscription document is DELETED ---
    if (!afterData && beforeData) {
       const updates = {
          subscriptionTier: 'none',
          subscriptionUploadTickets: 0,
          subscriptionAiTickets: 0,
          subscriptionRenewalDate: null
       };
        try {
          await userRef.set(updates, { merge: true });
          functions.logger.info(`Abonnement supprimé pour ${userId}.`);
        } catch (error) {
           functions.logger.error(`Erreur lors de la suppression de l'abonnement pour ${userId}:`, error);
        }
        return;
    }
  });
