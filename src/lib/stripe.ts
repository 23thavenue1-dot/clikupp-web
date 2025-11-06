

'use client';

import { Stripe } from 'stripe';

// La clé secrète est maintenant gérée côté serveur par l'extension Firebase/Stripe.
// Ce fichier n'a plus besoin de contenir la clé secrète directement.
// Nous le gardons pour l'initialisation de l'objet Stripe si nécessaire côté client
// avec la clé PUBLIABLE, mais pour le moment il n'est plus activement utilisé pour les paiements.

export const stripe = new Stripe('', {
  apiVersion: '2024-06-20',
  typescript: true,
});
