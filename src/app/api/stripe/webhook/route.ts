import { Stripe } from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';

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

// Configuration de l'admin Firebase directement dans la route
// C'est une solution plus robuste pour les environnements serverless.
const initializeAdminApp = () => {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error("La variable d'environnement FIREBASE_SERVICE_ACCOUNT_KEY est manquante.");
    }
    const serviceAccount = JSON.parse(serviceAccountKey);
    const appName = 'firebase-admin-app-webhook';
    if (!getApps().some(app => app.name === appName)) {
        return initializeApp({ credential: cert(serviceAccount) }, appName);
    }
    return getApp(appName);
};

let firestoreAdmin: Firestore;
try {
    const adminApp = initializeAdminApp();
    firestoreAdmin = getFirestore(adminApp);
} catch (e) {
    console.error("Échec de l'initialisation de Firebase Admin dans le webhook:", e);
}


/**
 * Gère les événements de webhook Stripe, notamment la finalisation des paiements.
 */
export async function POST(req: Request) {
    if (!firestoreAdmin) {
        return new NextResponse('Erreur de configuration du serveur Firebase.', { status: 500 });
    }

    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("Erreur: La clé secrète du webhook Stripe n'est pas définie dans les variables d'environnement.");
        return new NextResponse('Webhook secret non configuré côté serveur.', { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Erreur de vérification du webhook : ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }
    
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // La collection est 'customers'
        const customerId = session.customer;
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        
        if (!customerId || !priceId) {
             console.error("Données manquantes (customerId ou priceId) dans la session Stripe.");
             return new NextResponse('Données de session Stripe manquantes.', { status: 400 });
        }

        // Retrouver l'utilisateur Firebase via le customerId Stripe
        const customersCollection = firestoreAdmin.collection('customers');
        const userQuery = await customersCollection.where('stripeId', '==', customerId).limit(1).get();

        if (userQuery.empty) {
            console.error(`Aucun utilisateur trouvé pour le customerId Stripe: ${customerId}`);
            return new NextResponse('Utilisateur non trouvé.', { status: 404 });
        }

        const userDoc = userQuery.docs[0];
        const userDocRef = firestoreAdmin.collection('users').doc(userDoc.id);
        
        try {
            if (priceIdToTickets[priceId]) {
                const { upload, ai } = priceIdToTickets[priceId];
                const updates: { [key: string]: any } = {};
                if (upload) updates.packUploadTickets = FieldValue.increment(upload);
                if (ai) updates.packAiTickets = FieldValue.increment(ai);
                
                await userDocRef.update(updates);
                console.log(`Tickets ajoutés pour l'utilisateur ${userDoc.id}:`, updates);

            } else if (subscriptionPriceIdToTier[priceId]) {
                const { tier, upload, ai } = subscriptionPriceIdToTier[priceId];
                const updates = {
                    subscriptionTier: tier,
                    subscriptionUploadTickets: upload === Infinity ? 999999 : upload,
                    subscriptionAiTickets: ai,
                    subscriptionRenewalDate: new Date(session.expires_at * 1000),
                };
                await userDocRef.update(updates);
                console.log(`Abonnement '${tier}' activé pour l'utilisateur ${userDoc.id}.`);
            } else {
                 console.warn(`Price ID ${priceId} non géré.`);
            }

        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil utilisateur via webhook:", error);
            return new NextResponse('Erreur interne lors de la mise à jour du compte.', { status: 500 });
        }
    }

    return new NextResponse(null, { status: 200 });
}
