
import { Stripe } from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initializeFirebase } from '@/firebase/server';
import { doc, updateDoc, increment } from 'firebase/firestore';

// --- Définition des correspondances entre Price ID et tickets ---
const priceIdToTickets: { [key: string]: { upload?: number; ai?: number } } = {
    // Packs Upload
    'price_1SQ8wYCL0iCpjJiiuJUOTncv': { upload: 50 },
    'price_1SQ8xyCL0iCpjJiiqW038S9Z': { upload: 120 },
    'price_1SQ8zLCL0iCpjJiiLoxKSEej': { upload: 300 },
    // Packs IA
    'price_1SQ91HCL0iCpjJiiUV4xjJJE': { ai: 20 },
    'price_1SQ92mCL0iCpjJiiK0lISxQ5': { ai: 50 },
    'price_1SQ944CL0iCpjJii3B2LrQnQ': { ai: 150 },
};

const subscriptionPriceIdToTier: { [key: string]: { tier: 'creator' | 'pro' | 'master', upload: number, ai: number } } = {
    'price_1SQ8qMCL0iCpjJiiuReYJAG8': { tier: 'creator', upload: 500, ai: 50 },
    'price_1SQ8sXCL0iCpjJiibM2zG3iO': { tier: 'pro', upload: Infinity, ai: 150 },
    'price_1SQ8uUCL0iCpjJii5P1ZiYMa': { tier: 'master', upload: Infinity, ai: 400 },
};


/**
 * Gère les événements de webhook Stripe, notamment la finalisation des paiements.
 */
export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("Erreur: La clé secrète du webhook Stripe n'est pas définie.");
        return new NextResponse('Webhook secret non configuré.', { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Erreur de vérification du webhook : ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }
    
    // On ne traite que l'événement de session de paiement terminée
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const { firestore } = initializeFirebase();

        // Récupérer les métadonnées de la session
        const firebaseUID = session.metadata?.firebaseUID;
        const priceId = session.metadata?.priceId;

        if (!firebaseUID || !priceId) {
            console.error("Métadonnées manquantes dans la session Stripe.");
            return new NextResponse('Métadonnées manquantes.', { status: 400 });
        }

        const userDocRef = doc(firestore, 'users', firebaseUID);
        
        try {
            // Cas d'un achat de pack de tickets
            if (priceIdToTickets[priceId]) {
                const { upload, ai } = priceIdToTickets[priceId];
                const updates: { [key: string]: any } = {};
                if (upload) updates.packUploadTickets = increment(upload);
                if (ai) updates.packAiTickets = increment(ai);
                
                await updateDoc(userDocRef, updates);
                console.log(`Tickets ajoutés pour l'utilisateur ${firebaseUID}:`, updates);
            }
            // Cas d'un abonnement
            else if (subscriptionPriceIdToTier[priceId]) {
                const { tier, upload, ai } = subscriptionPriceIdToTier[priceId];
                // Note : Pour un vrai abonnement, il faudrait gérer la date de renouvellement etc.
                // Ici, on active le tier et on crédite les tickets mensuels.
                const updates = {
                    subscriptionTier: tier,
                    subscriptionUploadTickets: upload === Infinity ? 999999 : upload, // Utiliser une grande valeur pour "illimité"
                    subscriptionAiTickets: ai,
                    // subscriptionRenewalDate: ... // À gérer avec les dates de Stripe
                };
                await updateDoc(userDocRef, updates);
                 console.log(`Abonnement '${tier}' activé pour l'utilisateur ${firebaseUID}.`);
            } else {
                 console.warn(`Price ID ${priceId} non géré.`);
            }

        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil utilisateur:", error);
            return new NextResponse('Erreur interne lors de la mise à jour du compte.', { status: 500 });
        }
    }

    return new NextResponse(null, { status: 200 });
}
