
import { NextResponse, NextRequest } from 'next/server';
import { createStripeCheckout } from '@/lib/stripe';
import { initializeFirebase } from '@/firebase/server'; 

export async function POST(req: NextRequest) {
    try {
        const { priceId, mode, userId, userEmail } = await req.json();

        if (!priceId || !mode || !userId || !userEmail) {
            return new NextResponse('Les informations de paiement sont incomplètes (priceId, mode, userId, userEmail).', { status: 400 });
        }
        
        // Initialisation de l'admin Firebase pour la communication serveur
        const { firestore } = initializeFirebase();

        // Créer un semblant d'objet utilisateur pour la fonction getOrCreateCustomer
        const user = { 
            uid: userId, 
            email: userEmail,
        };

        // @ts-ignore
        const session = await createStripeCheckout(priceId, firestore, user, mode);

        if (session.url) {
            return NextResponse.json({ url: session.url });
        } else {
             return new NextResponse('La création de la session Stripe a échoué.', { status: 500 });
        }

    } catch (error) {
        console.error('API Checkout Error:', error);
        return new NextResponse((error as Error).message, { status: 500 });
    }
}

    