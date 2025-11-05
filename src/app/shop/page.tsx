
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Crown, Gem, Rocket, Sparkles, Upload, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

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
  { id: 'price_1SQ8wYCL0iCpjJiiuJUOTncv', title: "Boost S", tickets: 50, price: "1,99 €", icon: Upload, mode: 'payment' },
  { id: 'price_1SQ8xyCL0iCpjJiiqW038S9Z', title: "Boost M", tickets: 120, price: "3,99 €", icon: Upload, mode: 'payment' },
  { id: 'price_1SQ8zLCL0iCpjJiiLoxKSEej', title: "Boost L", tickets: 300, price: "7,99 €", icon: Upload, featured: true, mode: 'payment' },
];

const aiPacks = [
  { id: 'price_1SQ91HCL0iCpjJiiUV4xjJJE', title: "Boost S", tickets: 20, price: "2,99 €", icon: Sparkles, mode: 'payment' },
  { id: 'price_1SQ92mCL0iCpjJiiK0lISxQ5', title: "Boost M", tickets: 50, price: "5,99 €", icon: Sparkles, mode: 'payment' },
  { id: 'price_1SQ944CL0iCpjJii3B2LrQnQ', title: "Boost L", tickets: 150, price: "14,99 €", icon: Sparkles, featured: true, mode: 'payment' },
];


export default function ShopPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

    const handlePurchaseClick = async (priceId: string, productName: string, mode: 'payment' | 'subscription') => {
        if (!user) {
            toast({
                title: "Veuillez vous connecter",
                description: "Vous devez être connecté pour effectuer un achat.",
                variant: "destructive"
            });
            return;
        }

        setLoadingPriceId(priceId);

        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    priceId, 
                    mode, 
                    userId: user.uid, 
                    userEmail: user.email 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Une erreur est survenue.');
            }

            const { url } = await response.json();
            if (url) {
                window.location.assign(url);
            } else {
                throw new Error("Impossible d'obtenir l'URL de paiement.");
            }

        } catch (error) {
            console.error("Erreur lors de la création de la session Stripe:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur de paiement',
                description: (error as Error).message || "La communication avec le service de paiement a échoué. Veuillez réessayer.",
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
                                    <Button className="w-full" onClick={() => handlePurchaseClick(sub.id, sub.title, sub.mode as 'subscription')} disabled={loadingPriceId === sub.id}>
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
                                    <Button className="w-full" variant={pack.featured ? 'default' : 'outline'} onClick={() => handlePurchaseClick(pack.id, pack.title, pack.mode as 'payment')} disabled={loadingPriceId === pack.id}>
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
                                    <Button className="w-full" variant={pack.featured ? 'default' : 'outline'} onClick={() => handlePurchaseClick(pack.id, pack.title, pack.mode as 'payment')} disabled={loadingPriceId === pack.id}>
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
                <p className="text-sm text-muted-foreground">Les paiements sont sécurisés. Les abonnements peuvent être annulés à tout moment.</p>
                <p className="text-sm text-muted-foreground">Les packs de tickets n'ont pas de date d'expiration.</p>
            </div>
        </div>
    );
}
