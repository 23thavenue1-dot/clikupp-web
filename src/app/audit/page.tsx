'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile } from '@/lib/firestore';
import { socialAuditFlow } from '@/ai/flows/social-audit-flow';
import { decrementAiTicketCount } from '@/lib/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Check, ShoppingCart } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const MAX_IMAGES = 9;
const AUDIT_COST = 5;

// Helper pour lire un fichier en tant que Data URL
const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


export default function AuditPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [platform, setPlatform] = useState('');
    const [goal, setGoal] = useState('');

    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [postTexts, setPostTexts] = useState(['', '', '']);
    const [additionalContext, setAdditionalContext] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);


    const imagesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
    }, [user, firestore]);
    const { data: images, isLoading: areImagesLoading } = useCollection<ImageMetadata>(imagesQuery);

    const totalAiTickets = useMemo(() => {
        if (!userProfile) return 0;
        return (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0);
    }, [userProfile]);

    if (isUserLoading || isProfileLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        router.push('/login?redirect=/audit');
        return null;
    }
    
    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    const toggleImageSelection = (imageId: string) => {
        setSelectedImages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                if (newSet.size < MAX_IMAGES) {
                    newSet.add(imageId);
                }
            }
            return newSet;
        });
    };

    const handleTextChange = (index: number, value: string) => {
        const newTexts = [...postTexts];
        newTexts[index] = value;
        setPostTexts(newTexts);
    };
    
    const handleSubmit = async () => {
        if (!user || !userProfile || !firestore || selectedImages.size === 0) return;

        if (totalAiTickets < AUDIT_COST) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA insuffisants',
                description: (
                    <Link href="/shop" className="font-bold underline text-white">
                        Rechargez dans la boutique pour continuer !
                    </Link>
                ),
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Récupérer les URLs complètes des images sélectionnées
            const selectedImageObjects = images?.filter(img => selectedImages.has(img.id)) || [];
            
            // 2. Convertir les images en data URIs (si nécessaire, ici on utilise directUrl)
            // Note: Pour une analyse fiable, il faudrait s'assurer que les URLs sont accessibles.
            // L'idéal serait de les convertir en data URI côté client si elles ne le sont pas déjà.
            // Pour l'instant, on suppose que les directUrl de Firebase Storage sont publiquement accessibles.
            const imageUrls = selectedImageObjects.map(img => img.directUrl);

            // 3. Appeler le flow Genkit
            const result = await socialAuditFlow({
                platform,
                goal,
                image_urls: imageUrls,
                post_texts: postTexts.filter(t => t.trim() !== ''),
                additionalContext: additionalContext.trim() || undefined,
            });

            // 4. Décrémenter les tickets
            for (let i = 0; i < AUDIT_COST; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            
            toast({
                title: 'Analyse terminée !',
                description: `Votre rapport est prêt. ${AUDIT_COST} tickets IA ont été utilisés.`,
            });
            
            // TODO: Rediriger vers la page des résultats et y passer les données `result`.
            // Pour l'instant, on affiche en console et on redirige.
            console.log("Rapport d'audit IA:", result);
            router.push('/'); // Redirection temporaire

        } catch (error) {
            console.error("Erreur lors de l'audit IA:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur d\'analyse',
                description: "Une erreur est survenue pendant la génération du rapport. Veuillez réessayer."
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));
    
    const canGoToStep2 = platform && goal;
    const canGoToStep3 = selectedImages.size >= 1;
    const canGoToStep4 = postTexts.some(text => text.trim() !== '');


    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="platform">Plateforme du réseau social</Label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger id="platform" className="w-full">
                                    <SelectValue placeholder="Choisissez une plateforme..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="instagram">Instagram</SelectItem>
                                    <SelectItem value="tiktok">TikTok</SelectItem>
                                    <SelectItem value="facebook">Facebook</SelectItem>
                                    <SelectItem value="x">X (Twitter)</SelectItem>
                                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                                    <SelectItem value="other">Autre</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="goal">Quel est votre objectif principal ?</Label>
                            <Select value={goal} onValueChange={setGoal}>
                                <SelectTrigger id="goal" className="w-full">
                                    <SelectValue placeholder="Choisissez un objectif..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Augmenter mon engagement et créer une communauté.">Augmenter mon engagement et créer une communauté.</SelectItem>
                                    <SelectItem value="Professionnaliser mon image de marque.">Professionnaliser mon image de marque.</SelectItem>
                                    <SelectItem value="Trouver plus de clients ou d'opportunités.">Trouver plus de clients ou d'opportunités.</SelectItem>
                                    <SelectItem value="Définir une identité visuelle plus cohérente.">Définir une identité visuelle plus cohérente.</SelectItem>
                                    <SelectItem value="Diversifier mon contenu et trouver de nouvelles idées.">Diversifier mon contenu et trouver de nouvelles idées.</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                );
            case 2:
                return (
                     <CardContent>
                        <div className="bg-muted/50 border-l-4 border-primary p-4 rounded-r-lg mb-6">
                            <h4 className="font-semibold">Conseil d'expert</h4>
                            <p className="text-sm text-muted-foreground">
                                Pour une analyse optimale, sélectionnez entre 6 et {MAX_IMAGES} publications qui représentent le mieux votre style actuel. <br/>
                                <strong>Astuces :</strong> Incluez une capture d'écran de votre **grille de profil ('feed')** pour l'harmonie globale, et une autre de votre **description de profil** pour l'analyse textuelle.
                            </p>
                        </div>
                        {areImagesLoading ? (
                             <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-muted rounded-md animate-pulse"></div>)}
                            </div>
                        ) : (
                            <ScrollArea className="h-72">
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 pr-4">
                                    {images?.map(image => (
                                        <div 
                                            key={image.id}
                                            onClick={() => toggleImageSelection(image.id)}
                                            className={cn("relative aspect-square rounded-lg overflow-hidden cursor-pointer group transition-all", selectedImages.has(image.id) && "ring-2 ring-primary ring-offset-2")}
                                        >
                                            <Image
                                                src={image.directUrl}
                                                alt={image.originalName || 'Image'}
                                                fill
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                className="object-cover"
                                                unoptimized
                                            />
                                             <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors" />
                                             {selectedImages.has(image.id) && (
                                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                             )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                );
            case 3:
                return (
                     <CardContent className="space-y-4">
                         <div className="bg-muted/50 border-l-4 border-primary p-4 rounded-r-lg">
                            <h4 className="font-semibold">Conseil d'expert</h4>
                            <p className="text-sm text-muted-foreground">
                                Copiez-collez le texte de 2 ou 3 publications récentes et variées (une description courte, une longue, un appel à l'action...).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text-1">Texte de publication 1</Label>
                            <Textarea id="post-text-1" value={postTexts[0]} onChange={(e) => handleTextChange(0, e.target.value)} rows={3} placeholder="Collez votre texte ici..."/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text-2">Texte de publication 2</Label>
                            <Textarea id="post-text-2" value={postTexts[1]} onChange={(e) => handleTextChange(1, e.target.value)} rows={3} placeholder="Collez votre texte ici..."/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text-3">Texte de publication 3</Label>
                            <Textarea id="post-text-3" value={postTexts[2]} onChange={(e) => handleTextChange(2, e.target.value)} rows={3} placeholder="Collez votre texte ici..."/>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label htmlFor="additional-context">Informations supplémentaires (optionnel)</Label>
                            <Textarea 
                                id="additional-context" 
                                value={additionalContext} 
                                onChange={(e) => setAdditionalContext(e.target.value)} 
                                rows={4} 
                                placeholder="Donnez plus de contexte à l'IA : votre public cible, vos concurrents, une question spécifique..."
                            />
                        </div>
                    </CardContent>
                );
            case 4:
                 return (
                    <CardContent className="text-center">
                        <h3 className="text-xl font-semibold">Prêt à lancer l'analyse ?</h3>
                        <p className="text-muted-foreground mt-2">L'IA va maintenant analyser votre identité visuelle et rédactionnelle pour vous fournir un rapport complet.</p>
                        <div className="mt-6 p-4 bg-muted rounded-lg text-left text-sm space-y-2">
                            <p><strong>Plateforme :</strong> {platform}</p>
                            <p><strong>Objectif :</strong> {goal}</p>
                            <p><strong>Images sélectionnées :</strong> {selectedImages.size}</p>
                            <p><strong>Textes fournis :</strong> {postTexts.filter(t => t.trim() !== '').length}</p>
                            {additionalContext.trim() && <p><strong>Contexte ajouté :</strong> Oui</p>}
                        </div>
                         <Button onClick={handleSubmit} disabled={isSubmitting || totalAiTickets < AUDIT_COST} className="w-full mt-6" size="lg">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSubmitting ? 'Analyse en cours...' : `Lancer l'analyse (${AUDIT_COST} Tickets IA)`}
                        </Button>
                         {totalAiTickets < AUDIT_COST && (
                            <p className="text-sm text-destructive mt-2">
                                Tickets IA insuffisants. 
                                <Link href="/shop" className="underline font-semibold ml-1">Rechargez ici.</Link>
                            </p>
                        )}
                    </CardContent>
                );
            default:
                return null;
        }
    };
    
    const getStepTitle = () => {
        switch (step) {
            case 1: return "Le Contexte";
            case 2: return `Identité Visuelle (${selectedImages.size}/${MAX_IMAGES})`;
            case 3: return "Identité Rédactionnelle";
            case 4: return "Récapitulatif & Lancement";
            default: return "";
        }
    };
    
    const getStepDescription = () => {
         switch (step) {
            case 1: return "Dites-nous quel profil analyser et quel est votre objectif principal.";
            case 2: return "Sélectionnez les images qui définissent votre style actuel.";
            case 3: return "Fournissez des exemples de textes de vos publications.";
            case 4: return "Vérifiez vos sélections avant de démarrer l'analyse IA.";
            default: return "";
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-2xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight">Coach Stratégique</h1>
                    <p className="text-muted-foreground mt-2">
                        Recevez une analyse complète et un plan d'action personnalisé pour votre profil de réseau social.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <Progress value={progress} className="mb-4" />
                        <CardTitle>{getStepTitle()}</CardTitle>
                        <CardDescription>{getStepDescription()}</CardDescription>
                    </CardHeader>
                    
                    {renderStepContent()}
                    
                    <CardFooter className="flex justify-between border-t pt-6">
                        <Button variant="ghost" onClick={prevStep} disabled={step === 1 || isSubmitting}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Précédent
                        </Button>
                        {step < totalSteps ? (
                            <Button 
                                onClick={nextStep} 
                                disabled={
                                    (step === 1 && !canGoToStep2) ||
                                    (step === 2 && !canGoToStep3) ||
                                    (step === 3 && !canGoToStep4)
                                }
                            >
                                Suivant
                            </Button>
                        ) : (
                           <div></div> // Placeholder to keep spacing
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
