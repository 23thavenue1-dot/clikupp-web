
'use client';

import { Stripe } from 'stripe';

// IMPORTANT : Pour le débogage, nous utilisons la clé secrète directement ici.
// Remplacez "VOTRE_CLE_SECRETE_DE_TEST_ICI" par votre véritable clé secrète de test Stripe.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
  typescript: true,
});
