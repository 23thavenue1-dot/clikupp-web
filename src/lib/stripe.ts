
'use client';

import { Stripe } from 'stripe';

// IMPORTANT : Pour le débogage, nous utilisons la clé secrète directement ici.
// Remplacez "VOTRE_CLE_SECRETE_DE_TEST_ICI" par votre véritable clé secrète de test Stripe.
const stripeSecretKey = "VOTRE_CLE_SECRETE_DE_TEST_ICI";

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
  typescript: true,
});
