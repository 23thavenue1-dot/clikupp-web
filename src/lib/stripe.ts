
'use server';

import { Stripe } from 'stripe';

// On s'assure que la variable d'environnement est bien lue.
// process.env.STRIPE_SECRET_KEY sera remplacé par la valeur de votre fichier .env
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
  typescript: true,
});
