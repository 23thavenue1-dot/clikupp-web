
import { NextResponse, NextRequest } from 'next/server';
import { createStripeCheckout } from '@/lib/stripe';
import { initializeFirebase } from '@/firebase/server'; 
import { getAuth } from 'firebase-admin/auth';

export async function POST(req: NextRequest) {
    try {
        const { priceId, mode, userId } = await req.json();

        if (!priceId || !mode || !userId) {
            return new NextResponse('Les informations de paiement sont incomplètes (priceId, mode, userId).', { status: 400 });
        }
        
        // Initialisation de l'admin Firebase pour la communication serveur
        const { firestore, auth } = initializeFirebase();

        // Récupérer les informations complètes de l'utilisateur depuis Firebase Auth
        const userRecord = await auth.getUser(userId);

        const user = { 
            uid: userRecord.uid, 
            email: userRecord.email,
            displayName: userRecord.displayName
        };

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
