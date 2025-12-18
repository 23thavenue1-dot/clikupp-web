
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirebaseApp, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, CustomPrompt } from '@/lib/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Image as ImageIcon, Undo2, Redo2, Star, Trash2, Pencil, X, HelpCircle, FileText as FileTextIcon, Ticket, Instagram, Facebook, MessageSquare, VenetianMask } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { decrementAiTicketCount, saveImageMetadata, saveCustomPrompt, deleteCustomPrompt, updateCustomPrompt, updateImageDescription } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, addMonths, startOfMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestionCategories } from '@/lib/ai-prompts';
import { editImage, generateImage } from '@/ai/flows/generate-image-flow';
import { Separator } from '@/components/ui/separator';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic' | 'ecommerce';

const platformOptions = [
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'facebook', label: 'Facebook', icon: Facebook },
    { id: 'x', label: 'X (Twitter)', icon: MessageSquare },
    { id: 'tiktok', label: 'TikTok', icon: VenetianMask },
    { id: 'ecommerce', label: 'E-commerce', icon: ShoppingCart },
    { id: 'generic', label: 'Générique', icon: Wand2 },
];


type ImageHistoryItem = {
    imageUrl: string;
    prompt: string;
};

type IconName = keyof typeof LucideIcons;

const getIcon = (name: string): React.FC<LucideIcons.LucideProps> => {
  const Icon = LucideIcons[name as IconName];
  return Icon || LucideIcons.HelpCircle;
};

async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

export default function EditImagePage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading } = useUser();
    const firebaseApp = useFirebaseApp();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [prompt, setPrompt] = useState('');
    const [refinePrompt, setRefinePrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [generatedImageHistory, setGeneratedImageHistory] = useState<ImageHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const [isSaving, setIsSaving] = useState(false);
    
    const [isSavePromptDialogOpen, setIsSavePromptDialogOpen] = useState(false);
    const [newPromptName, setNewPromptName] = useState("");
    const [promptToSave, setPromptToSave] = useState("");
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);

    const [isDeletePromptDialogOpen, setIsDeletePromptDialogOpen] = useState(false);
    const [promptToDelete, setPromptToDelete] = useState<CustomPrompt | null>(null);
    const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

    const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false);
    const [promptToEdit, setPromptToEdit] = useState<CustomPrompt | null>(null);
    const [editedPromptName, setEditedPromptName] = useState("");
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    
    const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
    const [currentTitle, setCurrentTitle] = useState('');
    const [currentDescription, setCurrentDescription] = useState('');
    const [hashtagsString, setHashtagsString] = useState('');
    const [wasGeneratedByAI, setWasGeneratedByAI] = useState(false);
    const [isSavingDescription, setIsSavingDescription] = useState(false);
    const [generatingForPlatform, setGeneratingForPlatform] = useState<Platform | null>(null);


    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: originalImage, isLoading: isImageLoading, refetch: refetchImage } = useDoc<ImageMetadata>(imageDocRef);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading, refetch: refetchUserProfile } = useDoc<UserProfile>(userDocRef);

    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0) : 0;
    
    const currentHistoryItem = useMemo(() => {
        if (historyIndex >= 0 && historyIndex < generatedImageHistory.length) {
            return generatedImageHistory[historyIndex];
        }
        return null;
    }, [generatedImageHistory, historyIndex]);
    
    useEffect(() => {
        // Au chargement de l'image originale, on peuple les états pour la description
        if (originalImage) {
            setCurrentTitle(originalImage.title || '');
            setCurrentDescription(originalImage.description || '');
            setHashtagsString(originalImage.hashtags || '');
        }
    }, [originalImage]);


    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleGenerateImage = async (promptToUse: string) => {
        if (!promptToUse.trim() || !user || !userProfile || !firestore || !originalImage) return;

        if (totalAiTickets <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés', description: (<Link href="/shop" className="font-bold underline text-white">Rechargez</Link>), });
            return;
        }

        setIsGenerating(true);
        try {
            const baseImageUrl = originalImage.directUrl;
            const result = await editImage({ imageUrl: baseImageUrl, prompt: promptToUse });
            
            const newHistoryItem: ImageHistoryItem = {
                imageUrl: result.imageUrl,
                prompt: promptToUse,
            };

            setGeneratedImageHistory([newHistoryItem]);
            setHistoryIndex(0);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();

            toast({ title: 'Nouvelle version générée !', description: 'Un ticket IA a été utilisé.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleRefineImage = async () => {
        if (!refinePrompt.trim() || !currentHistoryItem || !user || !userProfile || !firestore || !originalImage) return;

        if (totalAiTickets <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés' });
            return;
        }

        setIsGenerating(true);
        try {
            const baseImageUrl = currentHistoryItem.imageUrl;
            const result = await editImage({ imageUrl: baseImageUrl, prompt: refinePrompt });
            
            const newHistoryItem: ImageHistoryItem = {
                imageUrl: result.imageUrl,
                prompt: refinePrompt,
            };

            const newHistory = generatedImageHistory.slice(0, historyIndex + 1);
            newHistory.push(newHistoryItem);
            setGeneratedImageHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();
            
            setRefinePrompt('');
            toast({ title: 'Image affinée !', description: 'Un ticket IA a été utilisé.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveDescription = async () => {
        if (!originalImage || !user || !firestore) return;
        setIsSavingDescription(true);
        const dataToUpdate: any = { 
            title: currentTitle, 
            description: currentDescription, 
            hashtags: hashtagsString 
        };
        if(wasGeneratedByAI) dataToUpdate.generatedByAI = true;

        try {
            await updateImageDescription(firestore, user.uid, originalImage.id, dataToUpdate, wasGeneratedByAI);
            toast({ title: 'Description enregistrée' });
            setIsDescriptionDialogOpen(false);
            refetchImage();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur' });
        } finally {
            setIsSavingDescription(false);
        }
    };


    const handleUndoGeneration = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        } else if (historyIndex === 0) {
             setHistoryIndex(-1);
             setGeneratedImageHistory([]);
        }
    };

    const handleRedoGeneration = () => {
        if (historyIndex < generatedImageHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };
    
     const handleSaveAiCreation = async () => {
        const imageToSave = currentHistoryItem;
        if (!imageToSave || !user || !firebaseApp || !firestore || !originalImage) return;
        
        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(imageToSave.imageUrl);
            const newFileName = `ai-edited-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${imageToSave.prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: originalImage.title,
                description: originalImage.description,
                hashtags: originalImage.hashtags,
                generatedByAI: true
            });
            toast({ title: "Nouvelle création enregistrée !", description: "Votre nouvelle image a été ajoutée à votre galerie principale." });
            setGeneratedImageHistory([]);
            setHistoryIndex(-1);
            setRefinePrompt('');

        } catch (error) {
            console.error("Erreur lors de la sauvegarde :", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: "Impossible d'enregistrer la nouvelle image." });
        } finally {
            setIsSaving(false);
        }
    };


    const openSavePromptDialog = () => {
        const activePrompt = prompt.trim();
        if (!activePrompt) return;
        setPromptToSave(activePrompt);
        setNewPromptName("");
        setIsSavePromptDialogOpen(true);
    };

    const handleSavePrompt = async () => {
        if (!promptToSave || !newPromptName.trim() || !user || !firestore) return;
        setIsSavingPrompt(true);
        try {
            await saveCustomPrompt(firestore, user.uid, { id: `prompt_${Date.now()}`, name: newPromptName, value: promptToSave });
            toast({ title: "Prompt sauvegardé" });
            setIsSavePromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur' });
        } finally {
            setIsSavingPrompt(false);
        }
    };
    
    const handleGenerateDescription = async (platform: Platform) => {
        if (!originalImage || !user || !userProfile) return;

        if (totalAiTickets <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés', description: (<Link href="/shop" className="font-bold underline text-white">Rechargez</Link>), });
            return;
        }

        setGeneratingForPlatform(platform);
        setWasGeneratedByAI(false);
        try {
            const result = await generateImageDescription({ imageUrl: originalImage.directUrl, platform: platform });
            setCurrentTitle(result.title);
            setCurrentDescription(result.description);
            setHashtagsString(result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '));
            setWasGeneratedByAI(true);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();
            
            toast({ title: "Contenu généré !", description: `Un ticket IA a été utilisé.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setGeneratingForPlatform(null);
        }
    };


    const openDeletePromptDialog = (p: CustomPrompt) => { setPromptToDelete(p); setIsDeletePromptDialogOpen(true); };
    const handleDeletePrompt = async () => {
        if (!promptToDelete || !user || !firestore) return;
        setIsDeletingPrompt(true);
        try {
            await deleteCustomPrompt(firestore, user.uid, promptToDelete);
            toast({ title: "Prompt supprimé" });
            setIsDeletePromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur' });
        } finally {
            setIsDeletingPrompt(false);
        }
    };
    
    const openEditPromptDialog = (p: CustomPrompt) => { setPromptToEdit(p); setEditedPromptName(p.name); setIsEditPromptDialogOpen(true); };
    const handleEditPrompt = async () => {
        if (!promptToEdit || !editedPromptName.trim() || !user || !firestore) return;
        setIsEditingPrompt(true);
        try {
            await updateCustomPrompt(firestore, user.uid, { ...promptToEdit, name: editedPromptName });
            toast({ title: "Prompt renommé" });
            setIsEditPromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur' });
        } finally {
            setIsEditingPrompt(false);
        }
    };

    if (isUserLoading || isImageLoading || isProfileLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!originalImage) {
         return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Image introuvable</h1>
                 <p className="text-muted-foreground">L'image que vous cherchez n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }

    const hasAiTickets = totalAiTickets > 0;
    const monthlyLimitReached = !!(userProfile && userProfile.aiTicketMonthlyCount >= 20 && totalAiTickets <= 0);
    const nextRefillDate = userProfile?.aiTicketMonthlyReset ? format(addMonths(startOfMonth(userProfile.aiTicketMonthlyReset.toDate()), 1), "d MMMM", { locale: fr }) : 'prochain mois';

    return (
        <div className="flex flex-col md:flex-row h-screen bg-background">
            <main className="flex-1 flex flex-col p-4 lg:p-6 space-y-4 overflow-y-auto">
                <header className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                       <Link href={`/image/${imageId}`}>
                           <ArrowLeft className="mr-2 h-4 w-4"/>
                           Retour à l'image
                       </Link>
                   </Button>
                    <div className="text-center">
                       <h1 className="text-xl font-semibold tracking-tight">Éditeur d'Image par IA</h1>
                       <p className="text-xs text-muted-foreground">Transformez vos images en décrivant simplement les changements souhaités.</p>
                   </div>
                    <Button variant="outline" className="h-8 text-sm" asChild>
                        <Link href="/shop">
                            <Ticket className="mr-2 h-4 w-4 text-primary" />
                            {totalAiTickets} Tickets IA
                        </Link>
                   </Button>
                </header>
                
                 <div className="flex flex-col gap-6 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="flex flex-col">
                            <div className="text-center py-1"><Badge variant="secondary">AVANT</Badge></div>
                            <Card className="flex-1 flex flex-col">
                                <CardContent className="flex-1 flex items-center justify-center p-2">
                                    <div className="aspect-square w-full relative">
                                        <Image src={originalImage.directUrl} alt="Image originale" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="flex flex-col">
                            <div className="text-center py-1"><Badge>APRÈS</Badge></div>
                             <Card className="flex-1 flex flex-col">
                                <CardContent className="flex-1 flex items-center justify-center p-2">
                                    <div className="aspect-square w-full relative bg-muted/40 rounded-md">
                                        {isGenerating ? (
                                            <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                                        ) : currentHistoryItem?.imageUrl ? (
                                            <Image src={currentHistoryItem.imageUrl} alt="Image générée" fill className="object-contain" unoptimized />
                                        ) : (
                                            <div className="text-center text-muted-foreground p-4 flex flex-col items-center justify-center h-full">
                                                <ImageIcon className="h-10 w-10 mx-auto mb-2"/>
                                                <p className="text-sm">Votre création apparaîtra ici.</p>
                                            </div>
                                        )}
                                        {generatedImageHistory.length > 0 && !isGenerating && (
                                            <div className="absolute top-2 left-2 z-10 flex gap-1">
                                                <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="h-7 w-7 bg-background/80" aria-label="Annuler" disabled={historyIndex < 0}>
                                                    <Undo2 className="h-5 w-5" />
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="h-7 w-7 bg-background/80" aria-label="Rétablir" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                                    <Redo2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    {currentHistoryItem && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Peaufiner & Sauvegarder</CardTitle>
                                <CardDescription>Ajustez le résultat ou enregistrez votre création.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <Label htmlFor="refine-prompt" className="flex items-center gap-2 font-semibold">
                                        <Wand2 className="h-4 w-4 text-primary" />
                                        <span>Peaufiner ce Résultat</span>
                                    </Label>
                                    <Textarea
                                        id="refine-prompt"
                                        value={refinePrompt}
                                        onChange={e => setRefinePrompt(e.target.value)}
                                        placeholder="Ex: rends le fond plus flou, change le texte en bleu..."
                                        rows={3}
                                        disabled={isGenerating || isSaving}
                                    />
                                    <Button
                                        onClick={handleRefineImage}
                                        disabled={!refinePrompt.trim() || isGenerating || isSaving || !hasAiTickets}
                                        className="w-full"
                                    >
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        Affiner (1 Ticket IA)
                                    </Button>
                                </div>
                                <div className="space-y-3 flex flex-col justify-end">
                                    <DialogTrigger asChild>
                                        <Button onClick={() => setIsDescriptionDialogOpen(true)} variant="outline" className="w-full">
                                            <FileTextIcon className="mr-2 h-4 w-4" />
                                            Modifier/Générer la description
                                        </Button>
                                    </DialogTrigger>
                                    <Button onClick={handleSaveAiCreation} className="w-full bg-green-600 hover:bg-green-700" disabled={isGenerating || isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                        Enregistrer la création
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>

            <aside className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-muted/40 border-l flex flex-col h-full">
                 <div className="flex-1 overflow-y-auto p-1">
                  <div className="p-3 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                          <span>Démarrez une nouvelle idée</span>
                        </CardTitle>
                        <CardDescription>Décrivez le résultat que vous souhaitez obtenir à partir de l'image originale.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="relative">
                            <Textarea
                                placeholder="Ex: Rends le ciel plus dramatique et ajoute des éclairs..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                disabled={isGenerating || isSaving}
                                className="pr-10"
                            />
                            <Dialog open={isSavePromptDialogOpen} onOpenChange={setIsSavePromptDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary" disabled={!prompt || !prompt.trim() || isGenerating || isSaving} onClick={openSavePromptDialog} aria-label="Sauvegarder le prompt">
                                        <Star className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Sauvegarder le prompt</DialogTitle>
                                        <DialogDescription>Donnez un nom à cette instruction pour la retrouver facilement plus tard.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="prompt-name">Nom du prompt</Label>
                                            <Input id="prompt-name" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} placeholder="Ex: Style super-héros" disabled={isSavingPrompt}/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Instruction</Label>
                                            <Textarea value={promptToSave} readOnly disabled rows={4} className="bg-muted"/>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="secondary" disabled={isSavingPrompt}>Annuler</Button></DialogClose>
                                        <Button onClick={handleSavePrompt} disabled={isSavingPrompt || !newPromptName.trim()}>
                                            {isSavingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Sauvegarder
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Trouver l'inspiration
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Inspiration de Prompts</DialogTitle>
                                    <DialogDescription>
                                        Utilisez vos prompts sauvegardés ou explorez nos suggestions pour démarrer votre création. Cliquez sur un prompt pour l'utiliser.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4 max-h-[60vh] overflow-y-auto">
                                    <Accordion type="single" collapsible className="w-full">
                                        {userProfile && userProfile.customPrompts && userProfile.customPrompts.length > 0 && (
                                            <AccordionItem value="custom-prompts">
                                                <AccordionTrigger className="text-sm py-2 hover:no-underline flex items-center gap-2">
                                                    <Star className="h-4 w-4 text-yellow-500" />
                                                    <span className="font-semibold">Mes Prompts</span>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="flex flex-col gap-2 pt-2">
                                                        {userProfile.customPrompts.filter(p => typeof p === 'object' && p !== null && p.id && p.name && p.value).map((p) => (
                                                            <div key={p.id} className="group relative flex items-center">
                                                                <DialogClose asChild>
                                                                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2 flex-grow text-left justify-start" onClick={() => setPrompt(p.value)} disabled={isGenerating || isSaving}>
                                                                        {p.name}
                                                                    </Button>
                                                                </DialogClose>
                                                                <div className="flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEditPromptDialog(p); }} aria-label="Modifier le prompt">
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openDeletePromptDialog(p); }} aria-label="Supprimer le prompt">
                                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}
                                        {suggestionCategories.map(category => {
                                            const Icon = getIcon(category.icon);
                                            return (
                                                <AccordionItem value={category.name} key={category.name}>
                                                    <AccordionTrigger className="text-sm py-2 hover:no-underline flex items-center gap-2">
                                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-semibold">{category.name}</span>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="flex flex-wrap gap-2 pt-2">
                                                            {category.prompts.map((p) => (
                                                                <DialogClose asChild key={p.title}>
                                                                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2" onClick={() => setPrompt(p.prompt)} disabled={isGenerating || isSaving}>
                                                                        {p.title}
                                                                    </Button>
                                                                </DialogClose>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button size="lg" onClick={() => handleGenerateImage(prompt)} disabled={!prompt.trim() || isGenerating || isSaving || !hasAiTickets} className="w-full">
                            {isGenerating && !refinePrompt ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5 text-amber-300" />}
                            Générer (1 Ticket IA)
                        </Button>
                        {monthlyLimitReached && ( <p className="text-center text-xs text-primary font-semibold pt-2"> Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}. </p>)}
                        {!hasAiTickets && !isGenerating && !isSaving && !monthlyLimitReached && (
                            <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                                <Link href="/shop"> <ShoppingCart className="mr-2 h-4 w-4"/> Plus de tickets ? Rechargez ici ! </Link>
                            </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
            </aside>
            
            <AlertDialog open={isDeletePromptDialogOpen} onOpenChange={setIsDeletePromptDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le prompt "{promptToDelete?.name}" ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible et supprimera définitivement ce prompt de votre liste.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingPrompt}>Annuler</AlertDialogCancel>
                         <AlertDialogAction onClick={handleDeletePrompt} disabled={isDeletingPrompt} className="bg-destructive hover:bg-destructive/90">
                            {isDeletingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={isEditPromptDialogOpen} onOpenChange={setIsEditPromptDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Renommer le prompt</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="edit-prompt-name">Nouveau nom</Label>
                        <Input
                            id="edit-prompt-name"
                            value={editedPromptName}
                            onChange={(e) => setEditedPromptName(e.target.value)}
                            disabled={isEditingPrompt}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary" disabled={isEditingPrompt}>Annuler</Button></DialogClose>
                        <Button onClick={handleEditPrompt} disabled={isEditingPrompt || !editedPromptName.trim()}>
                            {isEditingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Générer ou Modifier le Contenu</DialogTitle>
                        <DialogDescription>Laissez l'IA rédiger un contenu optimisé, ou modifiez-le manuellement.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="dialog-title">Titre</Label>
                            <Input 
                                id="dialog-title"
                                value={currentTitle}
                                onChange={(e) => setCurrentTitle(e.target.value)}
                                disabled={!!generatingForPlatform || isSavingDescription}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dialog-description">Description</Label>
                            <Textarea 
                                id="dialog-description"
                                value={currentDescription}
                                onChange={(e) => setCurrentDescription(e.target.value)}
                                rows={4}
                                disabled={!!generatingForPlatform || isSavingDescription}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="dialog-hashtags">Hashtags</Label>
                            <Textarea 
                                id="dialog-hashtags"
                                value={hashtagsString}
                                onChange={(e) => setHashtagsString(e.target.value)}
                                rows={2}
                                disabled={!!generatingForPlatform || isSavingDescription}
                            />
                        </div>
                        <Separator/>
                        <div className="space-y-2">
                            <Label>Générer avec l'IA (1 Ticket)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {platformOptions.map(({ id, label, icon: Icon }) => (
                                    <Button
                                        key={id}
                                        variant="outline"
                                        onClick={() => handleGenerateDescription(id as Platform)}
                                        disabled={generatingForPlatform === id || isSavingDescription || !hasAiTickets}
                                        className="justify-start"
                                    >
                                        {generatingForPlatform === id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary" disabled={isSavingDescription}>Annuler</Button></DialogClose>
                        <Button onClick={handleSaveDescription} disabled={isSavingDescription || !!generatingForPlatform}>
                            {isSavingDescription && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
