

'use client';

import { Stripe } from 'stripe';

// IMPORTANT : Remplacez "VOTRE_CLE_SECRETE_DE_TEST_ICI" par votre véritable clé secrète de test Stripe.
// Vous pouvez la trouver ici : https://dashboard.stripe.com/test/apikeys
const stripeSecretKey = 'VOTRE_CLE_SECRETE_DE_TEST_ICI';

if (!stripeSecretKey.startsWith('sk_test_')) {
    console.warn('Attention : La clé Stripe utilisée n\'est pas une clé de test.');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
  typescript: true,
});
