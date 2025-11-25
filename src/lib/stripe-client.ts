
import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

const getStripe = () => {
  if (!stripePromise) {
    const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publicKey) {
      throw new Error('Stripe publishable key is not set in environment variables.');
    }
    stripePromise = loadStripe(publicKey);
  }
  return stripePromise;
};

export { getStripe };
