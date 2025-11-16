
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown, Gem, Rocket, Sparkles, Upload, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useUser } from '@/firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';


// Mettre les ID de prix ici pour la configuration.
// Ces ID doivent correspondre à ceux de votre tableau de bord Stripe.
const SUBSCRIPTION_IDS = {
    creator: 'price_1SU6fmFxufdYfSFcC7INtknf',
    pro: 'price_1SU6huFxufdYfSFcWxYURQxZ',
    master: 'price_1SU6jSFxufdYfSFcixp0Y3VZ'
};

const PACK_IDS = {
    upload_s: 'price_1SQImVFxufdYfSFc6oQcKZ3q',
    upload_m: 'price_1SSLJIFxufdYfSFc0QLNkcq7',
    upload_l: 'price_1STtvVFxufdYfSFc2QskMy8j',
    ai_s: 'price_1STu0qFxufdYfSFc7SVth0M6',
    ai_m: 'price_1STu4zFxufdYfSFcqRx9iL9y',
    ai_l: 'price_1SU5LQFxufdYfSFc1Eo4tjSP',
};


const subscriptions = [
    {
        id: SUBSCRIPTION_IDS.pro,
        title: 'Pro',
        price: '9,99 €',
        period: '/ mois',
        description: 'Pour le créateur de contenu sérieux, freelance ou community manager.',
        features: [
            'Tickets d\'upload illimités',
            '150 tickets IA par mois',
            '100 Go de stockage',
            'Accès en avant-première aux nouvelles fonctionnalités',
        ],
        icon: Gem,
        featured: true,
        mode: 'subscription',
        metadata: { productName: 'Abonnement Pro', subscriptionTier: 'pro' }
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
            '20 Go de stockage',
            'Badge "Créateur" sur le profil',
        ],
        icon: Rocket,
        mode: 'subscription',
        metadata: { productName: 'Abonnement Créateur', subscriptionTier: 'creator' }
    },
    {
        id: SUBSCRIPTION_IDS.master,
        title: 'Maître',
        price: '19,99 €',
        period: '/ mois',
        description: 'Pour les agences et les utilisateurs très intensifs ("power users").',
        features: [
            'Tickets d\'upload illimités',
            '400 tickets IA par mois',
            '500 Go de stockage',
            'Support client prioritaire',
        ],
        icon: Crown,
        mode: 'subscription',
        metadata: { productName: 'Abonnement Maître', subscriptionTier: 'master' }
    }
];

const uploadPacks = [
    { id: PACK_IDS.upload_s, title: 'Boost S', price: '1,99 €', tickets: 50, description: 'Crédite votre compte de 50 tickets de téléversement supplémentaires.', icon: Upload, mode: 'payment', featured: false, metadata: { packUploadTickets: '50', packAiTickets: '0', productName: 'Pack Upload - Boost S' } },
    { id: PACK_IDS.upload_m, title: 'Boost M', price: '3,99 €', tickets: 120, description: 'Le meilleur rapport qualité-prix pour un usage plus conséquent.', icon: Upload, mode: 'payment', featured: true, metadata: { packUploadTickets: '120', packAiTickets: '0', productName: 'Pack Upload - Boost M' } },
    { id: PACK_IDS.upload_l, title: 'Boost L', price: '7,99 €', tickets: 300, description: 'Idéal pour les gros besoins en téléversement, comme un projet complet.', icon: Upload, mode: 'payment', featured: false, metadata: { packUploadTickets: '300', packAiTickets: '0', productName: 'Pack Upload - Boost L' } }
];

const aiPacks = [
    { id: PACK_IDS.ai_s, title: 'IA S', price: '2,99 €', tickets: 20, description: 'Parfait pour découvrir et expérimenter avec l\'édition par IA.', icon: Sparkles, mode: 'payment', featured: false, metadata: { packUploadTickets: '0', packAiTickets: '20', productName: 'Pack IA - S' } },
    { id: PACK_IDS.ai_m, title: 'IA M', price: '5,99 €', tickets: 50, description: 'Pour les créatifs qui veulent donner vie à leurs idées sans compter.', icon: Sparkles, mode: 'payment', featured: true, metadata: { packUploadTickets: '0', packAiTickets: '50', productName: 'Pack IA - M' } },
    { id: PACK_IDS.ai_l, title: 'IA L', price: '14,99 €', tickets: 150, description: 'Libérez tout le potentiel de votre créativité et réalisez vos projets les plus ambitieux.', icon: Sparkles, mode: 'payment', featured: false, metadata: { packUploadTickets: '0', packAiTickets: '150', productName: 'Pack IA - L' } }
];


function CheckoutButton({ item, disabled }: { item: any, disabled: boolean }) {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

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
                success_url: `${window.location.origin}/shop?success=true`,
                cancel_url: `${window.location.origin}/shop?canceled=true`,
                mode: item.mode,
                // Ajout des métadonnées ici
                metadata: { ...item.metadata, productName: item.metadata.productName || item.title }
            };

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
    const { user } = useUser();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    useEffect(() => {
        const success = searchParams.get('success');
        const canceled = searchParams.get('canceled');

        if (success) {
            toast({
                title: 'Paiement réussi ! 🎉',
                description: 'Merci pour votre achat. Vos tickets seront crédités dans quelques instants.',
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
            <div className="w-full max-w-5xl mx-auto space-y-12">
                <header className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight">Boutique</h1>
                    <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                        Passez au niveau supérieur. Choisissez un abonnement ou rechargez vos tickets à la carte pour ne jamais être à court de créativité.
                    </p>
                </header>

                <Tabs defaultValue="subscriptions" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mx-auto max-w-md">
                        <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
                        <TabsTrigger value="upload-packs">Packs Upload</TabsTrigger>
                        <TabsTrigger value="ai-packs">Packs IA</TabsTrigger>
                    </TabsList>

                    {/* --- Abonnements --- */}
                    <TabsContent value="subscriptions" className="pt-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                        <CheckoutButton item={sub} disabled={!isUserConnected} />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* --- Packs Upload --- */}
                    <TabsContent value="upload-packs" className="pt-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                        <CheckoutButton item={pack} disabled={!isUserConnected} />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* --- Packs IA --- */}
                    <TabsContent value="ai-packs" className="pt-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                        <CheckoutButton item={pack} disabled={!isUserConnected} />
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

    