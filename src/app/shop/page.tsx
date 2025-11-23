
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown, Gem, Rocket, Sparkles, Upload, Loader2, Package, HardDrive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/firestore';


// Mettre les ID de prix ici pour la configuration.
// Ces ID doivent correspondre à ceux de votre tableau de bord Stripe.
const SUBSCRIPTION_IDS = {
    creator: 'price_1SU6fmFxufdYfSFcC7INtknf',
    pro: 'price_1SU6huFxufdYfSFcWxYURQxZ',
    master: 'price_1SUAVQFxufdYfSFc6DTV87BX',
    // NOUVEAUX IDs DE STOCKAGE (à créer dans Stripe)
    storage_250: 'price_1SWdkzFxufdYfSFcvegKMdHS',
    storage_500: 'price_1SWDbGFxufdYfSFcC6eUUn0U',
    storage_1000: 'price_1SWDbYFxufdYfSFc8V8Q5s9z',
};

const PACK_IDS = {
    upload_s: 'price_1SQImVFxufdYfSFc6oQcKZ3q',
    upload_m: 'price_1SSLJIFxufdYfSFc0QLNkcq7',
    upload_l: 'price_1STtvVFxufdYfSFc2QskMy8j',
    upload_xl: 'price_1SWDeAFxufdYfSFcFH0Vf8gH', // ID pour le nouveau pack
    ai_s: 'price_1STu0qFxufdYfSFc7SVth0M6',
    ai_m: 'price_1STu4zFxufdYfSFcqRx9iL9y',
    ai_l: 'price_1SU5LQFxufdYfSFc1Eo4tjSP',
    ai_xl: 'price_1SWDfZFxufdYfSFc0Ww3mD6v', // Nouveau pack 500 tickets
    ai_xxl: 'price_1SWDfrFxufdYfSFc4d0yJjU6', // Nouveau pack 1000 tickets
};


const subscriptions = [
     {
        id: 'free_plan',
        title: 'Gratuit',
        price: '0 €',
        period: '/ toujours',
        description: 'Parfait pour découvrir la plateforme et pour un usage occasionnel.',
        features: [
            '5 tickets d\'upload / jour',
            '3 tickets IA / jour (max 20 / mois)',
            '200 Mo de stockage',
            'Accès à toutes les fonctionnalités de base',
        ],
        icon: Package,
        mode: 'free',
    },
    {
        id: SUBSCRIPTION_IDS.creator,
        title: 'Créateur',
        price: '4,99 €',
        period: '/ mois',
        description: 'L\'idéal pour l\'amateur éclairé qui a besoin de plus de flexibilité.',
        features: [
            '500 tickets d\'upload par mois',
            '50 tickets IA par mois',
            '10 Go de stockage',
            'Badge "Créateur" sur le profil',
        ],
        icon: Rocket,
        mode: 'subscription',
        metadata: { 
            subscriptionTier: 'creator', 
            monthlyUploadTickets: '500', 
            monthlyAiTickets: '50',
            productName: 'Abonnement - Créateur'
        }
    },
    {
        id: SUBSCRIPTION_IDS.pro,
        title: 'Pro',
        price: '9,99 €',
        period: '/ mois',
        description: 'Pour le créateur de contenu sérieux, freelance ou community manager.',
        features: [
            'Tickets d\'upload illimités',
            '150 tickets IA par mois',
            '50 Go de stockage',
            'Accès en avant-première aux nouvelles fonctionnalités',
        ],
        icon: Gem,
        featured: true,
        mode: 'subscription',
        metadata: { 
            subscriptionTier: 'pro', 
            monthlyUploadTickets: 'unlimited', 
            monthlyAiTickets: '150',
            productName: 'Abonnement - Pro'
        }
    },
    {
        id: SUBSCRIPTION_IDS.master,
        title: 'Maître',
        price: '19,99 €',
        period: '/ mois',
        description: 'Pour les agences et les utilisateurs très intensifs ("power users").',
        features: [
            'Tickets d\'upload illimités',
            '300 tickets IA par mois',
            '250 Go de stockage',
            'Support client prioritaire',
        ],
        icon: Crown,
        mode: 'subscription',
        metadata: { 
            subscriptionTier: 'master', 
            monthlyUploadTickets: 'unlimited', 
            monthlyAiTickets: '300',
            productName: 'Abonnement - Maître'
        }
    }
];

const storagePlans = [
    {
        id: SUBSCRIPTION_IDS.storage_250,
        title: 'Stockage Plus 250',
        price: '7,99 €',
        period: '/ mois',
        description: 'Pour les collectionneurs d\'images qui ont besoin d\'un espace de départ confortable.',
        features: [
            '250 Go de stockage',
            'Tickets gratuits journaliers inclus',
            'Pas de tickets d\'abonnement',
        ],
        icon: HardDrive,
        mode: 'subscription',
        metadata: { 
            subscriptionTier: 'storage_250',
            productName: 'Abonnement - Stockage 250Go'
        }
    },
    {
        id: SUBSCRIPTION_IDS.storage_500,
        title: 'Stockage Plus 500',
        price: '14,99 €',
        period: '/ mois',
        description: 'Un espace de stockage conséquent pour les projets d\'envergure et les archives.',
        features: [
            '500 Go de stockage',
            'Tickets gratuits journaliers inclus',
            'Pas de tickets d\'abonnement',
        ],
        icon: HardDrive,
        featured: true,
        mode: 'subscription',
        metadata: { 
            subscriptionTier: 'storage_500',
            productName: 'Abonnement - Stockage 500Go'
        }
    },
    {
        id: SUBSCRIPTION_IDS.storage_1000,
        title: 'Stockage Plus 1To',
        price: '29,99 €',
        period: '/ mois',
        description: 'La solution ultime pour les professionnels et les archivistes du numérique.',
        features: [
            '1 To (1000 Go) de stockage',
            'Tickets gratuits journaliers inclus',
            'Pas de tickets d\'abonnement',
        ],
        icon: HardDrive,
        mode: 'subscription',
        metadata: { 
            subscriptionTier: 'storage_1000',
            productName: 'Abonnement - Stockage 1To'
        }
    }
];

const uploadPacks = [
    { id: PACK_IDS.upload_s, title: 'Boost S', price: '1,99 €', tickets: 50, description: 'Crédite votre compte de 50 tickets de téléversement supplémentaires.', icon: Upload, mode: 'payment', featured: false, metadata: { packUploadTickets: '50', packAiTickets: '0', productName: 'Pack Upload - Boost S' } },
    { id: PACK_IDS.upload_m, title: 'Boost M', price: '3,99 €', tickets: 120, description: 'Le meilleur rapport qualité-prix pour un usage plus conséquent.', icon: Upload, mode: 'payment', featured: true, metadata: { packUploadTickets: '120', packAiTickets: '0', productName: 'Pack Upload - Boost M' } },
    { id: PACK_IDS.upload_l, title: 'Boost L', price: '7,99 €', tickets: 300, description: 'Idéal pour les gros besoins en téléversement, comme un projet complet.', icon: Upload, mode: 'payment', featured: false, metadata: { packUploadTickets: '300', packAiTickets: '0', productName: 'Pack Upload - Boost L' } },
    { id: PACK_IDS.upload_xl, title: 'Boost XL', price: '19,99 €', tickets: 1000, description: 'La solution ultime pour les utilisateurs avec des besoins de téléversement massifs.', icon: Upload, mode: 'payment', featured: false, metadata: { packUploadTickets: '1000', packAiTickets: '0', productName: 'Pack Upload - Boost XL' } }
];

const aiPacks = [
    { id: PACK_IDS.ai_s, title: 'IA S', price: '2,99 €', tickets: 20, description: 'Parfait pour découvrir et expérimenter avec l\'édition par IA.', icon: Sparkles, mode: 'payment', featured: false, metadata: { packUploadTickets: '0', packAiTickets: '20', productName: 'Pack IA - S' } },
    { id: PACK_IDS.ai_m, title: 'IA M', price: '5,99 €', tickets: 50, description: 'Pour les créatifs qui veulent donner vie à leurs idées sans compter.', icon: Sparkles, mode: 'payment', featured: true, metadata: { packUploadTickets: '0', packAiTickets: '50', productName: 'Pack IA - M' } },
    { id: PACK_IDS.ai_l, title: 'IA L', price: '14,99 €', tickets: 150, description: 'Libérez tout le potentiel de votre créativité et réalisez vos projets les plus ambitieux.', icon: Sparkles, mode: 'payment', featured: false, metadata: { packUploadTickets: '0', packAiTickets: '150', productName: 'Pack IA - L' } },
    { id: PACK_IDS.ai_xl, title: 'IA XL', price: '45,00 €', tickets: 500, description: 'Le choix des passionnés pour une créativité sans compromis sur de multiples projets.', icon: Sparkles, mode: 'payment', featured: false, metadata: { packUploadTickets: '0', packAiTickets: '500', productName: 'Pack IA - XL' } },
    { id: PACK_IDS.ai_xxl, title: 'IA XXL', price: '80,00 €', tickets: 1000, description: 'La solution ultime pour les professionnels et les agences qui repoussent les limites de la création IA.', icon: Sparkles, mode: 'payment', featured: false, metadata: { packUploadTickets: '0', packAiTickets: '1000', productName: 'Pack IA - XXL' } }
];


function CheckoutButton({ item, disabled, isCurrentPlan }: { item: any, disabled: boolean, isCurrentPlan: boolean }) {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    if (item.mode === 'free' || isCurrentPlan) {
        return (
             <Button disabled className="w-full">
                {isCurrentPlan ? 'Votre plan actuel' : 'Déjà inclus'}
            </Button>
        )
    }

    const handleCheckout = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Vous devez être connecté pour effectuer un achat.' });
            return;
        }

        setIsLoading(true);

        try {
            const sessionPayload: any = {
                client_reference_id: user.uid,
                line_items: [{ price: item.id, quantity: 1 }],
                success_url: `${window.location.origin}/shop?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${window.location.origin}/shop?canceled=true`,
                mode: item.mode,
                metadata: { ...item.metadata, productName: item.metadata.productName || item.title }
            };

            // Pour les abonnements, on permet à Stripe de gérer le portail client
            if (item.mode === 'subscription') {
                sessionPayload.allow_promotion_codes = true;
            }

            const checkoutSessionRef = collection(firestore, 'customers', user.uid, 'checkout_sessions');
            const docRef = await addDoc(checkoutSessionRef, sessionPayload);

            onSnapshot(docRef, (snap) => {
                const { error, url } = snap.data() || {};
                if (error) {
                    console.error('Erreur de la session de paiement:', JSON.stringify(error, null, 2));
                    toast({
                        variant: 'destructive',
                        title: 'Erreur de paiement',
                        description: error.message || "Une erreur est survenue avec ce produit. Il n'est peut-être pas actif ou sa configuration est incorrecte. Veuillez vérifier dans Stripe."
                    });
                    setIsLoading(false);
                }
                if (url) {
                    window.location.assign(url);
                }
            });

        } catch (error: any) {
            console.error('Erreur lors de la création de la session de paiement:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur de paiement',
                description: error.message || "Impossible d'initier le paiement. Veuillez réessayer."
            });
            setIsLoading(false);
        }
    };

    return (
        <Button onClick={handleCheckout} disabled={disabled || isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {item.mode === 'subscription' ? 'S\'abonner' : 'Acheter'}
        </Button>
    );
}

function ShopContent() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const userDocRef = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        const success = searchParams.get('success');
        const canceled = searchParams.get('canceled');

        if (success) {
            toast({
                title: 'Paiement réussi ! 🎉',
                description: 'Merci pour votre achat. Vos avantages seront actifs dans quelques instants.',
            });
        }
        if (canceled) {
            toast({
                variant: 'destructive',
                title: 'Paiement annulé',
                description: 'La session de paiement a été annulée. Vous n\'avez pas été débité.',
            });
        }
    }, [searchParams, toast]);

    const isUserConnected = !!user;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-7xl mx-auto space-y-12">
                <header className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight">Boutique</h1>
                    <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                        Passez au niveau supérieur. Choisissez un abonnement ou rechargez vos tickets à la carte pour ne jamais être à court de créativité.
                    </p>
                </header>

                <Tabs defaultValue="subscriptions" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mx-auto max-w-2xl">
                        <TabsTrigger value="subscriptions">Abonnements Créatifs</TabsTrigger>
                        <TabsTrigger value="storage-plans">Stockage Seul</TabsTrigger>
                        <TabsTrigger value="upload-packs">Packs Upload</TabsTrigger>
                        <TabsTrigger value="ai-packs">Packs IA</TabsTrigger>
                    </TabsList>

                    {/* --- Abonnements Créatifs --- */}
                    <TabsContent value="subscriptions" className="pt-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {subscriptions.map((sub) => (
                                <Card key={sub.title} className={sub.featured ? 'border-primary ring-2 ring-primary flex flex-col' : 'flex flex-col'}>
                                    <CardHeader className="text-center">
                                        <div className="inline-block mx-auto p-3 bg-primary/10 text-primary rounded-lg mb-2">
                                            <sub.icon className="h-6 w-6"/>
                                        </div>
                                        <CardTitle>{sub.title}</CardTitle>
                                        <div>
                                            <span className="text-3xl font-bold">{sub.price}</span>
                                            <span className="text-muted-foreground">{sub.period}</span>
                                        </div>
                                        <CardDescription>{sub.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="space-y-2 text-sm">
                                            {sub.features.map(feature => (
                                                <li key={feature} className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500"/>
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter className="mt-auto">
                                        <CheckoutButton 
                                            item={sub} 
                                            disabled={!isUserConnected} 
                                            isCurrentPlan={
                                                (sub.mode === 'free' && (!userProfile || userProfile.subscriptionTier === 'none')) ||
                                                (sub.metadata?.subscriptionTier === userProfile?.subscriptionTier)
                                            }
                                        />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                    
                    {/* --- Abonnements Stockage Seul --- */}
                    <TabsContent value="storage-plans" className="pt-8">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {storagePlans.map((plan) => (
                                <Card key={plan.title} className={plan.featured ? 'border-primary ring-2 ring-primary flex flex-col' : 'flex flex-col'}>
                                    <CardHeader className="text-center">
                                        <div className="inline-block mx-auto p-3 bg-primary/10 text-primary rounded-lg mb-2">
                                            <plan.icon className="h-6 w-6"/>
                                        </div>
                                        <CardTitle>{plan.title}</CardTitle>
                                        <div>
                                            <span className="text-3xl font-bold">{plan.price}</span>
                                            <span className="text-muted-foreground">{plan.period}</span>
                                        </div>
                                        <CardDescription>{plan.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <ul className="space-y-2 text-sm">
                                            {plan.features.map(feature => (
                                                <li key={feature} className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500"/>
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter className="mt-auto">
                                        <CheckoutButton 
                                            item={plan} 
                                            disabled={!isUserConnected} 
                                            isCurrentPlan={plan.metadata?.subscriptionTier === userProfile?.subscriptionTier}
                                        />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>


                    {/* --- Packs Upload --- */}
                    <TabsContent value="upload-packs" className="pt-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {uploadPacks.map((pack) => (
                                <Card key={pack.title} className={pack.featured ? 'border-primary ring-2 ring-primary flex flex-col' : 'flex flex-col'}>
                                     <CardHeader className="text-center">
                                         <div className="inline-block mx-auto p-3 bg-primary/10 text-primary rounded-lg mb-2">
                                            <pack.icon className="h-6 w-6"/>
                                        </div>
                                        <CardTitle>{pack.title}</CardTitle>
                                        <p className="text-2xl font-bold">{pack.price}</p>
                                        <p className="text-muted-foreground font-semibold">{pack.tickets} tickets d'upload</p>
                                    </CardHeader>
                                    <CardContent className="flex-grow text-center">
                                        <p className="text-sm text-muted-foreground">{pack.description}</p>
                                    </CardContent>
                                    <CardFooter className="mt-auto">
                                        <CheckoutButton item={pack} disabled={!isUserConnected} isCurrentPlan={false} />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* --- Packs IA --- */}
                    <TabsContent value="ai-packs" className="pt-8">
                        <div className="text-center mb-8">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold">1 Ticket IA = 1 génération ou modification d'image.</span>
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
                            {aiPacks.map((pack) => (
                                <Card key={pack.title} className={pack.featured ? 'border-primary ring-2 ring-primary flex flex-col' : 'flex flex-col'}>
                                    <CardHeader className="text-center">
                                         <div className="inline-block mx-auto p-3 bg-primary/10 text-primary rounded-lg mb-2">
                                            <pack.icon className="h-6 w-6"/>
                                        </div>
                                        <CardTitle>{pack.title}</CardTitle>
                                        <p className="text-2xl font-bold">{pack.price}</p>
                                        <p className="text-muted-foreground font-semibold">{pack.tickets} tickets IA</p>
                                    </CardHeader>
                                    <CardContent className="flex-grow text-center">
                                        <p className="text-sm text-muted-foreground">{pack.description}</p>
                                    </CardContent>
                                    <CardFooter className="mt-auto">
                                        <CheckoutButton item={pack} disabled={!isUserConnected} isCurrentPlan={false} />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
                
                 {!isUserConnected && (
                    <div className="text-center mt-12 p-6 bg-muted/50 rounded-lg">
                        <p className="font-semibold">Vous devez être connecté pour effectuer des achats.</p>
                        <Button asChild className="mt-4">
                            <Link href="/login">Se connecter ou créer un compte</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ShopPage() {
    return (
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mt-20" />}>
            <ShopContent />
        </Suspense>
    )
}
