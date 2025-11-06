
import { Stripe } from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
// Cette fonction garantit que l'app admin n'est initialisée qu'une seule fois.
let adminApp: App;
if (!getApps().length) {
    // Note: Les variables d'environnement sont gérées par la plateforme d'hébergement.
    // Pour un développement local, vous devriez avoir un fichier .env.local avec ces variables.
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        adminApp = initializeApp({
            credential: cert(serviceAccount),
        });
    } else {
        console.warn("FIREBASE_SERVICE_ACCOUNT_KEY non trouvée. L'initialisation de Firebase Admin pourrait échouer.");
        // Tentative d'initialisation sans credentials pour les émulateurs ou environnements gérés.
        adminApp = initializeApp();
    }
} else {
    adminApp = getApp();
}
const firestoreAdmin = getFirestore(adminApp);


/**
 * Gère les événements de webhook Stripe, notamment la finalisation des paiements.
 */
export async function POST(req: Request) {
    if (!firestoreAdmin) {
        return new NextResponse('Erreur de configuration du serveur Firebase.', { status: 500 });
    }

    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;
    
    // **CORRECTION**: Lire la clé directement depuis les variables d'environnement
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("Erreur: La clé secrète du webhook Stripe (STRIPE_WEBHOOK_SECRET) n'est pas définie dans les variables d'environnement.");
        return new NextResponse('Webhook secret non configuré côté serveur.', { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Erreur de vérification du webhook : ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }
    
    // Gérer l'événement 'checkout.session.completed'
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // --- Récupérer les informations de la session ---
        const userId = session.client_reference_id; // L'UID de l'utilisateur Firebase
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        
        if (!userId || !priceId) {
             console.error("Données manquantes (client_reference_id ou priceId) dans la session Stripe.");
             return new NextResponse('Données de session Stripe manquantes.', { status: 400 });
        }

        const userDocRef = firestoreAdmin.collection('users').doc(userId);
        
        try {
            // --- Logique pour les achats uniques (packs de tickets) ---
            if (priceIdToTickets[priceId]) {
                const { upload, ai } = priceIdToTickets[priceId];
                const updates: { [key: string]: any } = {};
                if (upload) updates.packUploadTickets = FieldValue.increment(upload);
                if (ai) updates.packAiTickets = FieldValue.increment(ai);
                
                await userDocRef.update(updates);
                console.log(`Tickets ajoutés pour l'utilisateur ${userId}:`, updates);

            // --- Logique pour les abonnements ---
            } else if (subscriptionPriceIdToTier[priceId]) {
                 const { tier, upload, ai } = subscriptionPriceIdToTier[priceId];
                 const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                
                 const updates = {
                    subscriptionTier: tier,
                    subscriptionUploadTickets: upload === Infinity ? 999999 : upload,
                    subscriptionAiTickets: ai,
                    // Utiliser la date de Stripe pour la prochaine facturation
                    subscriptionRenewalDate: Timestamp.fromMillis(subscription.current_period_end * 1000),
                 };
                 await userDocRef.update(updates);
                 console.log(`Abonnement '${tier}' activé pour l'utilisateur ${userId}.`);

            } else {
                 console.warn(`Price ID ${priceId} non géré.`);
            }

        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil utilisateur via webhook:", error);
            return new NextResponse('Erreur interne lors de la mise à jour du compte.', { status: 500 });
        }
    }

    // Gérer l'événement de fin d'abonnement
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Retrouver l'utilisateur Firebase via le customerId Stripe
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
        }
    }


    return new NextResponse(null, { status: 200 });
}
