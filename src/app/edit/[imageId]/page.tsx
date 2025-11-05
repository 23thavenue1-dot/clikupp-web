
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile } from '@/lib/firestore';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { editImage } from '@/ai/flows/edit-image-flow';
import { decrementAiTicketCount, saveImageMetadata } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestionCategories } from '@/lib/ai-prompts';
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Helper pour convertir Data URI en Blob ---
async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

export default function EditImagePage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading, firebaseApp } = useFirebase();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: originalImage, isLoading: isImageLoading } = useDoc<ImageMetadata>(imageDocRef);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleGenerate = async () => {
        if (!prompt || !originalImage || !user || !firestore || !userProfile) return;
        if (userProfile.aiTicketCount <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés', description: 'Plus de tickets ? Rechargez ici !' });
            return;
        }
        setIsGenerating(true);
        setGeneratedImageUrl(null);
        try {
            const result = await editImage({ imageUrl: originalImage.directUrl, prompt });
            setGeneratedImageUrl(result.newImageUrl);
            await decrementAiTicketCount(firestore, user.uid);
            toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé. Vous pouvez maintenant enregistrer votre création.' });
        } catch (error) {
            console.error(error);
            toast({ 
                variant: 'destructive', 
                title: 'Génération bloquée par l\'IA', 
                description: "L'IA a refusé de générer cette image, souvent à cause de ses filtres de sécurité. Conseil : Essayez de reformuler votre instruction pour être moins direct, ou utilisez un prompt suggéré." 
            });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveAiImage = async () => {
        if (!generatedImageUrl || !user || !firebaseApp || !firestore) return;
        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(generatedImageUrl);
            const newFileName = `ai-edited-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${prompt}`, () => {});
            await saveImageMetadata(firestore, user, { ...metadata, description: `Image originale modifiée avec l'instruction : "${prompt}"` });

            toast({ title: "Création enregistrée !", description: "Votre nouvelle image a été ajoutée à votre galerie." });
            router.push('/');
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de l'image IA :", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: "Impossible d'enregistrer la nouvelle image." });
        } finally {
            setIsSaving(false);
        }
    };

    if (isUserLoading || isImageLoading || isProfileLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!originalImage) {
         return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Image introuvable</h1>
                 <p className="text-muted-foreground">L'image que vous essayez de modifier n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }

    const hasAiTickets = (userProfile?.aiTicketCount ?? 0) > 0;
    const monthlyLimitReached = (userProfile?.aiTicketMonthlyCount ?? 0) >= 40 && !hasAiTickets;
    const nextRefillDate = format(addMonths(startOfMonth(new Date()), 1), "d MMMM", { locale: fr });

    return (
        <div className="bg-muted/20 min-h-screen">
            {/* -- HEADER -- */}
            <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b z-20">
                <div className="container mx-auto p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4"/>
                                Retour
                            </Link>
                        </Button>
                        <h1 className="text-lg font-semibold tracking-tight hidden sm:block">Édition par IA</h1>
                    </div>
                    <div className="flex items-center gap-4">
                       <Badge variant="outline" className="h-8 text-sm">
                          <Sparkles className="mr-2 h-4 w-4 text-primary" />
                           {userProfile?.aiTicketCount ?? 0} Tickets IA
                       </Badge>
                       <Button onClick={handleSaveAiImage} disabled={!generatedImageUrl || isSaving || isGenerating}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Enregistrer la création
                        </Button>
                    </div>
                </div>
            </header>
            
            <div className="container mx-auto">
                <main className="py-6 space-y-6">
                    
                    <div className="flex flex-col items-center gap-2">
                         {monthlyLimitReached ? (
                            <p className="text-center text-sm text-primary font-semibold">
                                Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}.
                            </p>
                        ) : (
                            <Button 
                                size="lg"
                                onClick={handleGenerate}
                                disabled={!prompt || isGenerating || isSaving || !hasAiTickets}
                                className="w-full max-w-sm"
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5" />}
                                {isGenerating ? 'Génération en cours...' : 'Générer avec l\'IA'}
                            </Button>
                        )}
                        {!hasAiTickets && !isGenerating && !monthlyLimitReached && (
                            <p className="text-center text-sm text-primary font-semibold cursor-pointer hover:underline">
                                Plus de tickets ? Rechargez ici !
                            </p>
                        )}
                    </div>
                    
                    {/* -- IMAGE PREVIEW PANEL -- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-items-center">
                        <div className="w-full max-w-md flex flex-col items-center gap-2">
                            <p className="text-sm font-semibold text-muted-foreground">AVANT</p>
                            <div className="aspect-square w-full relative rounded-lg border bg-background overflow-hidden shadow-sm">
                                <Image src={originalImage.directUrl} alt="Image originale" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>
                            </div>
                        </div>
                        <div className="w-full max-w-md flex flex-col items-center gap-2">
                            <p className="text-sm font-semibold text-muted-foreground">APRÈS</p>
                            <div className="aspect-square w-full relative rounded-lg border bg-background flex items-center justify-center shadow-sm">
                                {isGenerating && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                                {!isGenerating && generatedImageUrl && <Image src={generatedImageUrl} alt="Image générée par l'IA" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>}
                                {!isGenerating && !generatedImageUrl && <Wand2 className="h-12 w-12 text-muted-foreground/30"/>}
                            </div>
                        </div>
                    </div>


                    {/* -- CONTROLS PANEL -- */}
                    <div className="rounded-lg border bg-background/95 backdrop-blur-sm shadow-sm">
                        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                            {/* Prompt Input Area */}
                            <div className="flex flex-col space-y-3">
                                <h2 className="text-base font-semibold">1. Donnez votre instruction</h2>
                                 <Textarea
                                    placeholder="Ex: Rends le ciel plus dramatique et ajoute des éclairs..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    rows={4}
                                    disabled={isGenerating || isSaving}
                                    className="flex-grow min-h-[160px]"
                                />
                            </div>

                            {/* Suggestions Area */}
                            <div className="flex flex-col space-y-3 lg:mt-0">
                                <h2 className="text-base font-semibold">2. Ou inspirez-vous</h2>
                                <div className="flex-grow w-full rounded-md border p-2 bg-muted/40 overflow-y-auto">
                                    <Accordion type="single" collapsible className="w-full">
                                        {suggestionCategories.map(category => (
                                            <AccordionItem value={category.name} key={category.name}>
                                                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-semibold">{category.name}</span>
                                                        <span className="text-xs text-muted-foreground font-normal">{category.description}</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {category.prompts.map(p => (
                                                            <Button key={p.title} variant="outline" size="sm" className="text-xs h-auto py-1 px-2" onClick={() => setPrompt(p.prompt)} disabled={isGenerating || isSaving}>
                                                                {p.title}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
