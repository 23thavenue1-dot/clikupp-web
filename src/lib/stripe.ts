
import { Stripe } from 'stripe';

// On s'assure que la variable d'environnement est bien lue.
// process.env.STRIPE_SECRET_KEY sera remplacé par la valeur de votre fichier .env
// Note: La directive 'use server' a été retirée pour éviter les erreurs de build Next.js.
// Ce fichier est destiné à être importé uniquement dans des environnements serveur.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
  typescript: true,
});
