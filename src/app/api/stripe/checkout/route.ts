
import { NextResponse, NextRequest } from 'next/server';
import { createStripeCheckout } from '@/lib/stripe';
import { initializeFirebase } from '@/firebase/server'; 

export async function POST(req: NextRequest) {
    try {
        const { priceId, mode, userId, userEmail } = await req.json();

        if (!priceId || !mode || !userId) {
            return new NextResponse('Les informations de paiement sont incomplètes (priceId, mode, userId).', { status: 400 });
        }
        
        // Initialisation de l'admin Firebase pour la communication serveur
        const { firestore } = initializeFirebase();

        // Construire un objet utilisateur simple avec les infos reçues du client
        const userInfo = { 
            uid: userId, 
            email: userEmail,
            // On pourrait aussi passer le displayName si nécessaire, mais l'email suffit pour Stripe
        };

        const session = await createStripeCheckout(priceId, firestore, userInfo, mode);

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
