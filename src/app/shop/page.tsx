'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown, Gem, Rocket, Sparkles, Upload, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirebase, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';


const subscriptions = [
    {
        id: 'price_1SQ8qMCL0iCpjJiiuReYJAG8',
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
    },
     {
        id: 'price_1SQ8qMCL0iCpjJiiuReYJAG8',
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
    },
    {
        id: 'price_1SQ8uUCL0iCpjJii5P1ZiYMa',
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
    }
];

const uploadPacks = [
    { id: 'price_1SQ8wUCL0iCpjJiiQh9rA9gY', title: 'Boost S', price: '1,99 €', tickets: 50, icon: Upload, mode: 'payment' },
    { id: 'price_1SSLJIFxufdYfSFc0QLNkcq7', title: 'Boost M', price: '3,99 €', tickets: 120, icon: Upload, mode: 'payment', featured: true },
    { id: 'price_1SQ8yUCL0iCpjJiiGz00J0f4', title: 'Boost L', price: '7,99 €', tickets: 300, icon: Upload, mode: 'payment' }
];

const aiPacks = [
    { id: 'price_1SQ8zUCL0iCpjJiiR9a1j2T5', title: 'IA S', price: '2,99 €', tickets: 20, icon: Sparkles, mode: 'payment' },
    { id: 'price_1SQ90UCL0iCpjJiiS9b2k3U6', title: 'IA M', price: '5,99 €', tickets: 50, icon: Sparkles, mode: 'payment', featured: true },
    { id: 'price_1SQ91UCL0iCpjJiiT0c3l4V7', title: 'IA L', price: '14,99 €', tickets: 150, icon: Sparkles, mode: 'payment' }
];

function CheckoutButton({ item, disabled }: { item: any, disabled: boolean }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const createCheckoutSession = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Vous devez être connecté.' });
            return;
        }

        setIsLoading(true);

        const checkoutSessionRef = collection(firestore, `customers/${user.uid}/checkout_sessions`);
        
        try {
            const docRef = await addDoc(checkoutSessionRef, {
                client_reference_id: user.uid,
                price: item.id,
                success_url: `${window.location.origin}${window.location.pathname}?success=true`,
                cancel_url: `${window.location.origin}${window.location.pathname}?canceled=true`,
                mode: item.mode,
                allow_promotion_codes: true,
            });

            onSnapshot(docRef, (snap) => {
                const { error, url } = snap.data() || {};
                if (error) {
                    console.error('Erreur retournée par l\'extension Stripe:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Erreur de paiement',
                        description: `Une erreur est survenue: ${error.message}. Veuillez réessayer.`
                    });
                    setIsLoading(false);
                }
                if (url) {
                    window.location.assign(url);
                }
            });

        } catch (error) {
            console.error('Erreur lors de la création de la session de paiement:', error);
            toast({
                variant: 'destructive',
                title: 'Erreur inattendue',
                description: "Impossible d'initier le paiement. Veuillez contacter le support."
            });
            setIsLoading(false);
        }
    };

    return (
        <Button onClick={createCheckoutSession} disabled={disabled || isLoading} className="w-full">
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
                description: 'Merci pour votre achat. Vos tickets ont été ajoutés à votre compte.',
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
                                <Card key={sub.title} className={sub.featured ? 'border-primary ring-2 ring-primary' : ''}>
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
                                    <CardContent>
                                        <ul className="space-y-2 text-sm">
                                            {sub.features.map(feature => (
                                                <li key={feature} className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500"/>
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
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
                                <Card key={pack.title} className={pack.featured ? 'border-primary ring-2 ring-primary' : ''}>
                                     <CardHeader className="text-center">
                                         <div className="inline-block mx-auto p-3 bg-primary/10 text-primary rounded-lg mb-2">
                                            <pack.icon className="h-6 w-6"/>
                                        </div>
                                        <CardTitle>{pack.title}</CardTitle>
                                        <CardDescription>{pack.tickets} tickets d'upload</CardDescription>
                                        <p className="text-2xl font-bold">{pack.price}</p>
                                    </CardHeader>
                                    <CardFooter>
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
                                <Card key={pack.title} className={pack.featured ? 'border-primary ring-2 ring-primary' : ''}>
                                    <CardHeader className="text-center">
                                         <div className="inline-block mx-auto p-3 bg-primary/10 text-primary rounded-lg mb-2">
                                            <pack.icon className="h-6 w-6"/>
                                        </div>
                                        <CardTitle>{pack.title}</CardTitle>
                                        <CardDescription>{pack.tickets} tickets IA</CardDescription>
                                        <p className="text-2xl font-bold">{pack.price}</p>
                                    </CardHeader>
                                    <CardFooter>
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
