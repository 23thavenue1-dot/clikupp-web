

'use server';

import { Stripe } from 'stripe';
import { headers } from 'next/headers';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
  typescript: true,
});

// Type simplifié pour les informations utilisateur nécessaires
type UserInfo = {
    uid: string;
    email: string | null;
    displayName?: string | null;
}

/**
 * Récupère l'ID client Stripe d'un utilisateur depuis Firestore ou en crée un nouveau.
 * @param firestore - Instance de Firestore.
 * @param user - L'objet contenant les informations de l'utilisateur.
 * @returns L'ID du client Stripe (cus_...).
 */
async function getOrCreateCustomer(firestore: Firestore, user: UserInfo): Promise<string> {
    const customerDocRef = doc(firestore, 'customers', user.uid);
    const customerSnap = await getDoc(customerDocRef);

    if (customerSnap.exists() && customerSnap.data().stripeId) {
        return customerSnap.data().stripeId;
    }

    // Crée un nouveau client dans Stripe
    const customer = await stripe.customers.create({
        email: user.email!,
        name: user.displayName || undefined,
        metadata: {
            firebaseUID: user.uid,
        },
    });

    // Sauvegarde le nouvel ID client dans Firestore
    await setDoc(customerDocRef, { 
        stripeId: customer.id,
        firebaseUID: user.uid,
    });

    return customer.id;
}


/**
 * Crée une session de paiement Stripe Checkout.
 * @param priceId - L'ID du prix de l'article dans Stripe.
 * @param firestore - Instance de Firestore.
 * @param user - L'objet contenant les informations de l'utilisateur.
 * @param mode - 'payment' pour un achat unique, 'subscription' pour un abonnement.
 * @returns La session de paiement Stripe.
 */
export async function createStripeCheckout(priceId: string, firestore: Firestore, user: UserInfo, mode: 'payment' | 'subscription' = 'payment') {
    const customerId = await getOrCreateCustomer(firestore, user);
    
    const origin = headers().get('origin') || 'http://localhost:9002';

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: mode,
        customer: customerId,
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        success_url: `${origin}/`, // Rediriger vers la page d'accueil en cas de succès
        cancel_url: `${origin}/shop`, // Rediriger vers la boutique en cas d'annulation
        metadata: {
            firebaseUID: user.uid,
            priceId: priceId,
        }
    });

    return session;
}
