// Ce fichier est conservé pour de futures fonctions Cloud potentielles,
// mais la logique de webhook Stripe a été supprimée car elle est désormais
// entièrement gérée par l'extension `invertase/firestore-stripe-payments`.
// Aucune fonction n'est actuellement déployée depuis ce fichier.

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Exemple de fonction qui pourrait être ajoutée plus tard :
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
