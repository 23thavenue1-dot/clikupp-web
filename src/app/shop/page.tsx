
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown, Gem, Rocket, Sparkles, Upload, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';


const subscriptions = [
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
        id: 'price_1SQ8sXCL0iCpjJiibM2zG3iO',
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
    },
];

const uploadPacks = [
  { id: 'price_1SQImVFxufdYfSFc6oQcKZ3q', title: "Boost S", tickets: 50, price: "1,99 €", icon: Upload, mode: 'payment' },
  { id: 'price_1SSLJIFxufdYfSFc0QLNkcq7', title: "Boost M", tickets: 120, price: "3,99 €", icon: Upload, featured: true, mode: 'payment' },
  { id: 'price_1SQ8zLCL0iCpjJiiLoxKSEej', title: "Boost L", tickets: 300, price: "7,99 €", icon: Upload, mode: 'payment' },
];

const aiPacks = [
  { id: 'price_1SQ91HCL0iCpjJiiUV4xjJJE', title: "Boost S", tickets: 20, price: "2,99 €", icon: Sparkles, mode: 'payment' },
  { id: 'price_1SQ92mCL0iCpjJiiK0lISxQ5', title: "Boost M", tickets: 50, price: "5,99 €", icon: Sparkles, mode: 'payment' },
  { id: 'price_1SQ944CL0iCpjJii3B2LrQnQ', title: "Boost L", tickets: 150, price: "14,99 €", icon: Sparkles, featured: true, mode: 'payment' },
];

function ShopContent() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
    const searchParams = useSearchParams();

     useEffect(() => {
        const sessionId = searchParams.get('session_id');
        if (sessionId && user && firestore) {
            const sessionDocRef = doc(firestore, 'customers', user.uid, 'checkout_sessions', sessionId);
            
            const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const sessionData = docSnap.data();
                    if (sessionData.error) {
                        toast({
                            title: "Erreur de paiement",
                            description: sessionData.error.message || "Une erreur est survenue lors de la finalisation du paiement.",
                            variant: "destructive"
                        });
                        unsubscribe();
                    } else if (sessionData.payment_intent_id || sessionData.subscription_id) {
                         toast({
                            title: "Paiement réussi !",
                            description: "Votre compte a été crédité. Merci pour votre achat.",
                        });
                        unsubscribe();
                    }
                }
            }, (error) => {
                console.error("Erreur d'écoute de la session de paiement:", error);
                unsubscribe();
            });

            return () => unsubscribe();
        }
    }, [searchParams, user, firestore, toast]);

    const handlePurchaseClick = async (priceId: string, mode: 'payment' | 'subscription') => {
        if (!user || !firestore) {
            toast({ title: "Veuillez vous connecter", description: "Vous devez être connecté pour effectuer un achat.", variant: "destructive" });
            return;
        }

        setLoadingPriceId(priceId);

        const successUrl = `${window.location.origin}${window.location.pathname}?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${window.location.origin}${window.location.pathname}`;

        const checkoutSessionData = {
            price: priceId,
            mode: mode,
            success_url: successUrl,
            cancel_url: cancelUrl,
            // Forcer la création d'un client Stripe si aucun n'est trouvé
            customer_creation: 'always', 
        };

        const checkoutSessionsCollectionRef = collection(firestore, 'customers', user.uid, 'checkout_sessions');

        try {
            const docRef = await addDoc(checkoutSessionsCollectionRef, checkoutSessionData);

            const unsubscribe = onSnapshot(docRef, (snap) => {
                const data = snap.data();
                const { error, url } = data || {};

                if (error) {
                    console.error('Stripe Error:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Erreur de paiement',
                        description: error.message || "L'extension Stripe a rencontré une erreur. Vérifiez la console Firebase pour plus de détails.",
                    });
                    setLoadingPriceId(null);
                    unsubscribe();
                }

                if (url) {
                    // La redirection se déclenchera dès que l'URL sera disponible.
                    window.location.assign(url);
                }
            });

        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: checkoutSessionsCollectionRef.path,
                operation: 'create',
                requestResourceData: checkoutSessionData
            });
            errorEmitter.emit('permission-error', permissionError);

            // Ce toast est une sécurité si onSnapshot n'est pas déclenché à cause d'une erreur de permission initiale
            toast({
                variant: 'destructive',
                title: 'Erreur de permission',
                description: "Impossible d'initier le paiement. Vos règles de sécurité Firestore bloquent peut-être l'action.",
            });
            setLoadingPriceId(null);
        }
    };
    
    return (
        <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Développez votre potentiel</h1>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                    Choisissez la formule qui correspond à vos ambitions. Passez au niveau supérieur ou rechargez simplement vos tickets pour ne jamais être à court de créativité.
                </p>
            </div>
            
            <Tabs defaultValue="subscriptions" className="w-full max-w-4xl mx-auto">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
                    <TabsTrigger value="upload-packs">Packs Upload</TabsTrigger>
                    <TabsTrigger value="ai-packs">Packs IA</TabsTrigger>
                </TabsList>
                
                <TabsContent value="subscriptions" className="mt-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {subscriptions.map((sub) => (
                            <Card key={sub.title} className={`flex flex-col ${sub.featured ? 'border-primary ring-2 ring-primary' : ''}`}>
                                <CardHeader className="text-center">
                                    <div className="inline-block p-3 bg-primary/10 text-primary rounded-full mb-4 mx-auto w-fit">
                                        <sub.icon className="h-7 w-7" />
                                    </div>
                                    <CardTitle className="text-2xl">{sub.title}</CardTitle>
                                    <div className="flex justify-center items-baseline my-2">
                                        <span className="text-4xl font-bold">{sub.price}</span>
                                        <span className="text-muted-foreground">{sub.period}</span>
                                    </div>
                                    <CardDescription>{sub.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <ul className="space-y-3 text-sm">
                                        {sub.features.map((feature, i) => (
                                            <li key={i} className="flex items-start">
                                                <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" onClick={() => handlePurchaseClick(sub.id, sub.mode as 'subscription')} disabled={loadingPriceId === sub.id}>
                                        {loadingPriceId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        {sub.featured ? 'Choisir le plan Pro' : 'S\'abonner'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="upload-packs" className="mt-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         {uploadPacks.map((pack) => (
                             <Card key={pack.title} className={`flex flex-col text-center ${pack.featured ? 'border-primary ring-2 ring-primary' : ''}`}>
                                 <CardHeader>
                                    <div className="inline-block p-3 bg-muted rounded-full mb-4 mx-auto w-fit text-muted-foreground">
                                         <pack.icon className="h-7 w-7" />
                                     </div>
                                     <CardTitle className="text-2xl">{pack.title}</CardTitle>
                                     <div className="my-2">
                                         <span className="text-5xl font-bold">{pack.tickets}</span>
                                         <p className="text-muted-foreground">tickets d'upload</p>
                                     </div>
                                 </CardHeader>
                                 <CardContent className="flex-grow"/>
                                 <CardFooter>
                                    <Button className="w-full" variant={pack.featured ? 'default' : 'outline'} onClick={() => handlePurchaseClick(pack.id, pack.mode as 'payment')} disabled={loadingPriceId === pack.id}>
                                         {loadingPriceId === pack.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                         Acheter pour {pack.price}
                                     </Button>
                                 </CardFooter>
                             </Card>
                         ))}
                    </div>
                </TabsContent>
                
                <TabsContent value="ai-packs" className="mt-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         {aiPacks.map((pack) => (
                             <Card key={pack.title} className={`flex flex-col text-center ${pack.featured ? 'border-primary ring-2 ring-primary' : ''}`}>
                                 <CardHeader>
                                     <div className="inline-block p-3 bg-muted rounded-full mb-4 mx-auto w-fit text-muted-foreground">
                                         <pack.icon className="h-7 w-7" />
                                     </div>
                                     <CardTitle className="text-2xl">{pack.title}</CardTitle>

                                     <div className="my-2">
                                         <span className="text-5xl font-bold">{pack.tickets}</span>
                                         <p className="text-muted-foreground">tickets IA</p>
                                     </div>
                                 </CardHeader>
                                 <CardContent className="flex-grow"/>
                                 <CardFooter>
                                    <Button className="w-full" variant={pack.featured ? 'default' : 'outline'} onClick={() => handlePurchaseClick(pack.id, pack.mode as 'payment')} disabled={loadingPriceId === pack.id}>
                                         {loadingPriceId === pack.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Acheter pour {pack.price}
                                     </Button>
                                 </CardFooter>
                             </Card>
                         ))}
                    </div>
                </TabsContent>

            </Tabs>
             <div className="text-center mt-12">
                <p className="text-sm text-muted-foreground">Les paiements sont sécurisés via Stripe. Les abonnements peuvent être annulés à tout moment.</p>
                <p className="text-sm text-muted-foreground">Les packs de tickets n'ont pas de date d'expiration.</p>
            </div>
        </div>
    );
}

export default function ShopPage() {
    return (
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />}>
            <ShopContent />
        </Suspense>
    );
}
