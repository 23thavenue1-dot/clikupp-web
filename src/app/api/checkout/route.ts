
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';
import type { UserProfile } from '@/lib/firestore';

// --- Initialisation de Firebase Admin (une seule fois) ---
let adminApp: App;
if (!getApps().length) {
    try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY n'est pas définie.");
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        adminApp = initializeApp({
            credential: cert(serviceAccount),
        });
    } catch (e) {
        console.error("Erreur d'initialisation de Firebase Admin:", e);
    }
} else {
    adminApp = getApp();
}

const firestoreAdmin = getFirestore(adminApp);


/**
 * Crée ou récupère le customer ID Stripe pour un utilisateur Firebase.
 */
const getOrCreateStripeCustomer = async (userId: string, email: string | null): Promise<string> => {
    const userDocRef = firestoreAdmin.collection('users').doc(userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        throw new Error("Utilisateur non trouvé dans Firestore.");
    }

    const userProfile = userDocSnap.data() as UserProfile;

    if (userProfile.stripeCustomerId) {
        return userProfile.stripeCustomerId;
    }

    // Créer un nouveau client dans Stripe
    const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: {
            firebaseUID: userId,
        },
    });

    // Sauvegarder le nouvel ID dans le profil utilisateur Firestore
    await setDoc(userDocRef, { stripeCustomerId: customer.id }, { merge: true });

    return customer.id;
};


/**
 * Gère la création d'une session de paiement Stripe.
 */
export async function POST(req: Request) {
    if (!stripe || !firestoreAdmin) {
        return new NextResponse('Configuration du serveur Stripe ou Firebase incomplète.', { status: 500 });
    }

    try {
        const { priceId, mode, userId, userEmail } = await req.json();

        if (!priceId || !mode || !userId) {
            return new NextResponse('Données manquantes pour la création de la session.', { status: 400 });
        }

        const stripeCustomerId = await getOrCreateStripeCustomer(userId, userEmail);

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: mode,
            success_url: `${req.headers.get('origin')}/?payment=success`,
            cancel_url: `${req.headers.get('origin')}/shop`,
            client_reference_id: userId,
        });

        if (session.url) {
            return NextResponse.json({ url: session.url });
        } else {
            throw new Error("La session de paiement n'a pas pu être créée par Stripe.");
        }

    } catch (error: any) {
        console.error('Erreur API Checkout:', error);
        return new NextResponse(error.message || 'Erreur interne du serveur.', { status: 500 });
    }
}
