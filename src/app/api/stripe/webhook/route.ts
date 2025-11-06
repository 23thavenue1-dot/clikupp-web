
import { Stripe } from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert, getApp, App } from 'firebase-admin/app';

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

// --- Initialisation de Firebase Admin ---
let adminApp: App;
if (!getApps().length) {
    try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccountKey) {
            const serviceAccount = JSON.parse(serviceAccountKey);
            adminApp = initializeApp({
                credential: cert(serviceAccount),
            });
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT_KEY non trouvée. Tentative d'initialisation sans credentials.");
            adminApp = initializeApp();
        }
    } catch (e) {
        console.error("Erreur critique d'initialisation de Firebase Admin:", e);
    }
} else {
    adminApp = getApp();
}
const firestoreAdmin = getFirestore(adminApp);


/**
 * Gère les événements de webhook Stripe.
 */
export async function POST(req: Request) {
    if (!firestoreAdmin) {
        return new NextResponse('Erreur de configuration du serveur Firebase.', { status: 500 });
    }

    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;
    
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("Erreur: STRIPE_WEBHOOK_SECRET n'est pas définie.");
        return new NextResponse('Webhook secret non configuré côté serveur.', { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Erreur de vérification du webhook : ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }
    
    const session = event.data.object as Stripe.Checkout.Session;

    // --- Événement de session de paiement terminée ---
    if (event.type === 'checkout.session.completed') {
        const userId = session.client_reference_id;
        
        if (!userId) {
             console.error("Données manquantes (client_reference_id) dans la session Stripe.");
             return new NextResponse('Données de session Stripe manquantes.', { status: 400 });
        }

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;

        if (!priceId) {
            console.error("Price ID non trouvé dans les line items de la session.");
            return new NextResponse('Price ID manquant.', { status: 400 });
        }

        const userDocRef = firestoreAdmin.collection('users').doc(userId);
        
        try {
            // Logique pour les achats uniques (packs)
            if (priceIdToTickets[priceId]) {
                const { upload, ai } = priceIdToTickets[priceId];
                const updates: { [key: string]: any } = {};
                if (upload) updates.packUploadTickets = FieldValue.increment(upload);
                if (ai) updates.packAiTickets = FieldValue.increment(ai);
                
                await userDocRef.update(updates);
                console.log(`Tickets ajoutés pour l'utilisateur ${userId}:`, updates);

            // Logique pour les abonnements
            } else if (subscriptionPriceIdToTier[priceId] && session.subscription) {
                 const { tier, upload, ai } = subscriptionPriceIdToTier[priceId];
                 const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                
                 const updates = {
                    subscriptionTier: tier,
                    subscriptionUploadTickets: upload === Infinity ? 999999 : upload,
                    subscriptionAiTickets: ai,
                    subscriptionRenewalDate: Timestamp.fromMillis(subscription.current_period_end * 1000),
                 };
                 await userDocRef.update(updates);
                 console.log(`Abonnement '${tier}' activé pour l'utilisateur ${userId}.`);

            } else {
                 console.warn(`Price ID ${priceId} non géré.`);
            }

        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil via webhook:", error);
            return new NextResponse('Erreur interne lors de la mise à jour du compte.', { status: 500 });
        }
    }

    // --- Événement de fin d'abonnement ---
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        try {
            const userQuery = await firestoreAdmin.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
            if (!userQuery.empty) {
                const userDocRef = userQuery.docs[0].ref;
                await userDocRef.update({
                    subscriptionTier: 'none',
                    subscriptionUploadTickets: 0,
                    subscriptionAiTickets: 0,
                    subscriptionRenewalDate: null,
                });
                 console.log(`Abonnement résilié pour l'utilisateur ${userDocRef.id}.`);
            } else {
                console.warn(`Aucun utilisateur trouvé avec le Stripe Customer ID: ${customerId}`);
            }
        } catch (error) {
             console.error("Erreur lors de la résiliation de l'abonnement via webhook:", error);
             return new NextResponse('Erreur interne lors de la résiliation.', { status: 500 });
        }
    }


    return new NextResponse(null, { status: 200 });
}
