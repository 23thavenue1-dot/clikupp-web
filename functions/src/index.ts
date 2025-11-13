
'use server';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

// Initialiser Firebase Admin SDK une seule fois
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// NOTE: La logique de webhook est maintenant gérée par la nouvelle extension
// Firebase 'invertase/firestore-stripe-payments'. Ce fichier est conservé
// au cas où nous aurions besoin d'ajouter d'autres fonctions Cloud à l'avenir,
// mais il ne contient plus de logique de paiement active.

// Exemple de fonction qui pourrait être ajoutée plus tard :
/*
 export const helloWorld = functions.https.onRequest((request, response) => {
   functions.logger.info("Hello logs!", {structuredData: true});
   response.send("Hello from Firebase!");
 });
*/
