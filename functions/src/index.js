"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.onPaymentSuccess = functions
  .region("us-central1")
  .firestore.document("customers/{userId}/payments/{paymentId}")
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    const { userId } = context.params;

    functions.logger.info(
      `Déclenchement pour l'utilisateur ${userId}.`,
      { paymentData: payment }
    );

    const meta = payment.metadata || {};
    const uploadTickets = Number(meta.packUploadTickets || 0);
    const aiTickets = Number(meta.packAiTickets || 0);

    if (!uploadTickets && !aiTickets) {
      functions.logger.warn(
        "Aucun ticket à créditer trouvé dans les métadonnées.",
        { metadata: meta }
      );
      return;
    }

    const userRef = db.doc(`users/${userId}`);
    const updates = {};

    if (uploadTickets > 0) {
      updates.packUploadTickets = admin.firestore.FieldValue.increment(
        uploadTickets
      );
    }
    if (aiTickets > 0) {
      updates.packAiTickets = admin.firestore.FieldValue.increment(aiTickets);
    }

    try {
      await userRef.set(updates, { merge: true });
      functions.logger.info(
        `Succès ! Tickets crédités pour l'utilisateur ${userId}.`,
        { updates }
      );
    } catch (error) {
      functions.logger.error(
        `Erreur lors du crédit des tickets pour l'utilisateur ${userId}:`,
        error
      );
    }
  });
