
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile } from '@/lib/firestore';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Text, Instagram, Facebook, MessageSquare, VenetianMask } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic';


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

    // State pour l'édition d'image
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    // State pour la génération de description
    const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [generatedDescription, setGeneratedDescription] = useState('');
    const [generatedHashtags, setGeneratedHashtags] = useState('');
    
    // State pour la sauvegarde finale
    const [isSaving, setIsSaving] = useState(false);

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

    const totalAiTickets = useMemo(() => {
        if (!userProfile) return 0;
        return (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0);
    }, [userProfile]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleGenerateImage = async () => {
        if (!prompt || !originalImage || !user || !firestore || !userProfile) return;
        if (totalAiTickets <= 0) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: ( <Link href="/shop" className="font-bold underline text-white"> Rechargez dans la boutique ! </Link> )
            });
            return;
        }
        setIsGenerating(true);
        setGeneratedImageUrl(null);
        try {
            const result = await editImage({ imageUrl: originalImage.directUrl, prompt });
            setGeneratedImageUrl(result.newImageUrl);
            await decrementAiTicketCount(firestore, user.uid, userProfile);
            toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé. Vous pouvez maintenant générer une description ou enregistrer votre création.' });
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
    
    const handleGenerateDescription = async (platform: Platform) => {
        if (!generatedImageUrl || !user || !userProfile) return;
        if (totalAiTickets <= 0) {
             toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: ( <Link href="/shop" className="font-bold underline text-white"> Rechargez dans la boutique ! </Link> )
            });
            return;
        }

        setIsGeneratingDescription(true);
        try {
            const result = await generateImageDescription({ imageUrl: generatedImageUrl, platform: platform });
            setGeneratedTitle(result.title);
            setGeneratedDescription(result.description);
            setGeneratedHashtags(result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '));
            
            await decrementAiTicketCount(firestore, user.uid, userProfile);
            toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Un ticket IA a été utilisé.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setIsGeneratingDescription(false);
        }
    };

    const handleSaveAiCreation = async () => {
        if (!generatedImageUrl || !user || !firebaseApp || !firestore) return;
        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(generatedImageUrl);
            const newFileName = `ai-edited-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: generatedTitle,
                description: generatedDescription,
                hashtags: generatedHashtags,
                generatedByAI: true // Marquer que la description vient aussi de l'IA
            });

            toast({ title: "Création enregistrée !", description: "Votre nouvelle image et sa description ont été ajoutées à votre galerie." });
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

    const hasAiTickets = totalAiTickets > 0;
    const monthlyLimitReached = !!(userProfile && userProfile.aiTicketMonthlyCount >= 40 && totalAiTickets <= 0);
    const nextRefillDate = userProfile?.aiTicketMonthlyReset ? format(addMonths(startOfMonth(userProfile.aiTicketMonthlyReset.toDate()), 1), "d MMMM", { locale: fr }) : 'prochain mois';


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
                           {totalAiTickets} Tickets IA
                       </Badge>
                    </div>
                </div>
            </header>
            
            <div className="container mx-auto">
                <main className="py-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    
                    {/* --- COLONNE DE GAUCHE : INPUT --- */}
                    <div className="flex flex-col gap-4 sticky top-20">
                        <p className="text-sm font-semibold text-muted-foreground text-center">AVANT</p>
                        <div className="aspect-square w-full relative rounded-lg border bg-background overflow-hidden shadow-sm">
                            <Image src={originalImage.directUrl} alt="Image originale" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>
                        </div>
                        
                        <div className="rounded-lg border bg-card p-4 flex flex-col space-y-4">
                            <div className="flex-grow">
                                <h2 className="text-base font-semibold mb-2">1. Donnez votre instruction</h2>
                                <Textarea
                                    placeholder="Ex: Rends le ciel plus dramatique et ajoute des éclairs..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    rows={3}
                                    disabled={isGenerating || isSaving}
                                />
                            </div>
                            <div className="flex-grow w-full rounded-md border p-2 bg-muted/40 overflow-y-auto max-h-48">
                                <Accordion type="single" collapsible className="w-full">
                                    {suggestionCategories.map(category => (
                                        <AccordionItem value={category.name} key={category.name}>
                                            <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                                <div className="flex flex-col text-left">
                                                    <span className="font-semibold">{category.name}</span>
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
                            <div className="mt-auto">
                                 {monthlyLimitReached ? (
                                    <p className="text-center text-sm text-primary font-semibold">
                                        Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}.
                                    </p>
                                ) : (
                                    <Button 
                                        size="lg"
                                        onClick={handleGenerateImage}
                                        disabled={!prompt || isGenerating || isSaving || !hasAiTickets}
                                        className="w-full"
                                    >
                                        {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5" />}
                                        {isGenerating ? 'Génération en cours...' : 'Générer l\'image'}
                                    </Button>
                                )}
                                {!hasAiTickets && !isGenerating && !monthlyLimitReached && (
                                    <Button variant="link" asChild className="text-sm font-semibold text-primary w-full mt-2">
                                        <Link href="/shop">
                                            <ShoppingCart className="mr-2 h-4 w-4"/>
                                            Plus de tickets ? Rechargez dans la boutique !
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                     {/* --- COLONNE DE DROITE : OUTPUT --- */}
                    <div className="flex flex-col gap-4">
                        <p className="text-sm font-semibold text-muted-foreground text-center">APRÈS</p>
                        <div className="aspect-square w-full relative rounded-lg border bg-background flex items-center justify-center shadow-sm">
                            {isGenerating && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                            {!isGenerating && generatedImageUrl && <Image src={generatedImageUrl} alt="Image générée par l'IA" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>}
                            {!isGenerating && !generatedImageUrl && <Wand2 className="h-12 w-12 text-muted-foreground/30"/>}
                        </div>
                         <div className="rounded-lg border bg-card p-4 flex flex-col flex-grow space-y-4">
                            <div className="flex-grow flex flex-col justify-center">
                                <h2 className="text-base font-semibold mb-4 text-center">2. Créez la publication</h2>
                                
                                <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full" disabled={!generatedImageUrl || isGenerating || isSaving}>
                                            <Text className="mr-2 h-4 w-4"/> Générer une description
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Générer une description optimisée</DialogTitle>
                                            <DialogDescription>
                                                L'IA va créer un titre, une description et des hashtags pour votre nouvelle image. Un ticket IA sera utilisé.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="gen-title">Titre</Label>
                                                <Input id="gen-title" value={generatedTitle} onChange={(e) => setGeneratedTitle(e.target.value)} disabled={isGeneratingDescription}/>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="gen-desc">Description</Label>
                                                <Textarea id="gen-desc" value={generatedDescription} onChange={(e) => setGeneratedDescription(e.target.value)} disabled={isGeneratingDescription} rows={4}/>
                                            </div>
                                             <div className="space-y-2">
                                                <Label htmlFor="gen-tags">Hashtags</Label>
                                                <Input id="gen-tags" value={generatedHashtags} onChange={(e) => setGeneratedHashtags(e.target.value)} disabled={isGeneratingDescription}/>
                                            </div>
                                            <Separator/>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="w-full" disabled={isGeneratingDescription || !hasAiTickets}>
                                                        {isGeneratingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                                                        {isGeneratingDescription ? "Génération..." : "Générer pour..."}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleGenerateDescription('instagram')}><Instagram className="mr-2 h-4 w-4" /> Instagram</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleGenerateDescription('facebook')}><Facebook className="mr-2 h-4 w-4" /> Facebook</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleGenerateDescription('x')}><MessageSquare className="mr-2 h-4 w-4" /> X (Twitter)</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleGenerateDescription('tiktok')}><VenetianMask className="mr-2 h-4 w-4" /> TikTok</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleGenerateDescription('generic')}><Wand2 className="mr-2 h-4 w-4" /> Générique</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                             {!hasAiTickets && !isGeneratingDescription && (
                                                <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                                                    <Link href="/shop">
                                                        <ShoppingCart className="mr-2 h-4 w-4"/>
                                                        Plus de tickets ? Rechargez dans la boutique !
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button variant="default">Valider la description</Button>
                                            </DialogClose>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="mt-auto">
                                 <Button onClick={handleSaveAiCreation} disabled={!generatedImageUrl || isSaving || isGenerating} size="lg" className="w-full">
                                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5" />}
                                    Enregistrer la création
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
