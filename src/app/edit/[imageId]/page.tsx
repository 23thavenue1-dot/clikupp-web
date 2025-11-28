'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, CustomPrompt } from '@/lib/firestore';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Text, Instagram, Facebook, MessageSquare, VenetianMask, RefreshCw, Undo2, Redo2, Star, Trash2, Pencil, Tag, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { editImage } from '@/ai/flows/generate-image-flow';
import { decrementAiTicketCount, saveImageMetadata, saveCustomPrompt, deleteCustomPrompt, updateCustomPrompt, updateImageDescription } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestionCategories } from '@/lib/ai-prompts';
import { format, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic' | 'ecommerce';

interface ImageHistoryItem {
    imageUrl: string;
    prompt: string;
    title: string;
    description: string;
    hashtags: string;
}

type IconName = keyof typeof LucideIcons;

const getIcon = (name: string): React.FC<LucideIcons.LucideProps> => {
  const Icon = LucideIcons[name as IconName];
  return Icon || LucideIcons.HelpCircle;
};


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
    
    // Historique des images et descriptions générées
    const [generatedImageHistory, setGeneratedImageHistory] = useState<ImageHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);


    // State pour la génération de description
    const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [generatedDescription, setGeneratedDescription] = useState('');
    const [generatedHashtags, setGeneratedHashtags] = useState('');
    
    // State pour la sauvegarde finale
    const [isSaving, setIsSaving] = useState(false);
    
    // State pour la sauvegarde de prompt
    const [isSavePromptDialogOpen, setIsSavePromptDialogOpen] = useState(false);
    const [newPromptName, setNewPromptName] = useState("");
    const [promptToSave, setPromptToSave] = useState("");
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);

    // State pour la suppression de prompt
    const [isDeletePromptDialogOpen, setIsDeletePromptDialogOpen] = useState(false);
    const [promptToDelete, setPromptToDelete] = useState<CustomPrompt | null>(null);
    const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

    // State pour la modification de prompt
    const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false);
    const [promptToEdit, setPromptToEdit] = useState<CustomPrompt | null>(null);
    const [editedPromptName, setEditedPromptName] = useState("");
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);


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

    const currentHistoryItem = useMemo(() => {
        if (historyIndex >= 0 && historyIndex < generatedImageHistory.length) {
            return generatedImageHistory[historyIndex];
        }
        return null;
    }, [generatedImageHistory, historyIndex]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);
    
    // Synchroniser la description avec l'historique
    useEffect(() => {
        if (currentHistoryItem) {
            setGeneratedTitle(currentHistoryItem.title);
            setGeneratedDescription(currentHistoryItem.description);
            setGeneratedHashtags(currentHistoryItem.hashtags);
        } else if (originalImage) {
            // Si on revient à l'état initial, on utilise les infos de l'image originale
            setGeneratedTitle(originalImage.title || '');
            setGeneratedDescription(originalImage.description || '');
            setGeneratedHashtags(originalImage.hashtags || '');
        }
    }, [currentHistoryItem, originalImage]);


    const handleGenerateImage = async () => {
        const currentPrompt = prompt;
        // On utilise toujours l'image originale comme base pour la première génération
        const baseImageUrl = originalImage?.directUrl;

        if (!currentPrompt || !baseImageUrl || !user || !firestore || !userProfile) return;

        if (totalAiTickets <= 0) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: ( <Link href="/shop" className="font-bold underline text-white"> Rechargez dans la boutique ! </Link> )
            });
            return;
        }

        setIsGenerating(true);
        
        try {
            const result = await editImage({ imageUrl: baseImageUrl, prompt: currentPrompt });
            
            const newHistoryItem: ImageHistoryItem = {
                imageUrl: result.imageUrl,
                prompt: currentPrompt,
                title: generatedTitle, // On conserve les titres/descriptions précédents
                description: generatedDescription,
                hashtags: generatedHashtags
            };
            
            const newHistory = generatedImageHistory.slice(0, historyIndex + 1);
            newHistory.push(newHistoryItem);
            
            setGeneratedImageHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);


            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé.' });

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
    
    const handleUndoGeneration = () => {
        if (historyIndex > -1) {
            setHistoryIndex(prev => prev - 1);
        }
    };

    const handleRedoGeneration = () => {
        if (historyIndex < generatedImageHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };


    const handleGenerateDescription = async (platform: Platform) => {
        const imageToDescribe = currentHistoryItem || originalImage;
        if (!imageToDescribe || !user || !userProfile) return;

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
            // L'URL de l'image à décrire
            const imageUrlToProcess = currentHistoryItem?.imageUrl || originalImage?.directUrl;
            if (!imageUrlToProcess) {
                throw new Error("Aucune URL d'image disponible pour la description.");
            }

            const result = await generateImageDescription({ imageUrl: imageUrlToProcess, platform: platform });
            
            const newTitle = result.title;
            const newDesc = result.description;
            const newHashtags = result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ');

            setGeneratedTitle(newTitle);
            setGeneratedDescription(newDesc);
            setGeneratedHashtags(newHashtags);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'description');
            toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Un ticket IA a été utilisé.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setIsGeneratingDescription(false);
        }
    };
    
    const handleConfirmDescription = () => {
        setIsDescriptionDialogOpen(false);
        toast({ title: 'Contenu validé', description: "N'oubliez pas d'enregistrer la création finale." });
    };

    const handleSaveAiCreation = async () => {
        const imageToSave = currentHistoryItem; // On ne sauvegarde que les nouvelles images
        if (!imageToSave || !user || !firebaseApp || !firestore) {
            // Si on clique sur enregistrer sans avoir généré d'image, on met à jour la description de l'originale
            if (originalImage) {
                 await updateImageDescription(firestore, user.uid, originalImage.id, {
                    title: generatedTitle,
                    description: generatedDescription,
                    hashtags: generatedHashtags,
                }, false); // false car la description n'est pas forcément générée par IA
                toast({ title: "Description mise à jour !", description: "La description de l'image originale a été modifiée." });
                router.push('/');
            }
            return;
        };
        
        setIsSaving(true);

        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(imageToSave.imageUrl);
            const newFileName = `ai-edited-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${imageToSave.prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: generatedTitle,
                description: generatedDescription,
                hashtags: generatedHashtags,
                generatedByAI: true
            });
            toast({ title: "Nouvelle création enregistrée !", description: "Votre nouvelle image et sa description ont été ajoutées à votre galerie." });

            router.push('/'); // Rediriger vers l'accueil après la sauvegarde

        } catch (error) {
            console.error("Erreur lors de la sauvegarde :", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: "Impossible d'enregistrer les modifications." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const openSavePromptDialog = () => {
        if (!prompt || !prompt.trim()) return;
        setPromptToSave(prompt);
        setNewPromptName(""); // Reset name field
        setIsSavePromptDialogOpen(true);
    };

    const handleSavePrompt = async () => {
        if (!promptToSave || !newPromptName.trim() || !user || !firestore) return;
        setIsSavingPrompt(true);

        const newCustomPrompt: CustomPrompt = {
            id: `prompt_${Date.now()}`,
            name: newPromptName,
            value: promptToSave,
        };

        try {
            await saveCustomPrompt(firestore, user.uid, newCustomPrompt);
            toast({ title: "Prompt sauvegardé", description: `"${newPromptName}" a été ajouté à 'Mes Prompts'.` });
            setIsSavePromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder le prompt.' });
        } finally {
            setIsSavingPrompt(false);
        }
    };

    const openDeletePromptDialog = (prompt: CustomPrompt) => {
        setPromptToDelete(prompt);
        setIsDeletePromptDialogOpen(true);
    };

    const handleDeletePrompt = async () => {
        if (!promptToDelete || !user || !firestore) return;
        setIsDeletingPrompt(true);

        try {
            await deleteCustomPrompt(firestore, user.uid, promptToDelete);
            toast({ title: "Prompt supprimé", description: `"${promptToDelete.name}" a été supprimé.` });
            setIsDeletePromptDialogOpen(false);
            setPromptToDelete(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer le prompt.' });
        } finally {
            setIsDeletingPrompt(false);
        }
    };
    
    const openEditPromptDialog = (prompt: CustomPrompt) => {
        setPromptToEdit(prompt);
        setEditedPromptName(prompt.name);
        setIsEditPromptDialogOpen(true);
    };

    const handleEditPrompt = async () => {
        if (!promptToEdit || !editedPromptName.trim() || !user || !firestore) return;
        setIsEditingPrompt(true);

        const updatedPrompt = { ...promptToEdit, name: editedPromptName };

        try {
            await updateCustomPrompt(firestore, user.uid, updatedPrompt);
            toast({ title: "Prompt renommé", description: `Le prompt a été renommé en "${editedPromptName}".` });
            setIsEditPromptDialogOpen(false);
            setPromptToEdit(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de renommer le prompt.' });
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
                 <p className="text-muted-foreground">L'image que vous essayez de modifier n'existe pas ou vous n'y avez pas accès.</p>
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
        <div className="flex h-screen bg-muted/20">
            {/* -- MAIN CONTENT (Images) -- */}
            <main className="flex-1 flex flex-col overflow-auto">
                <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b z-20">
                    <div className="container mx-auto p-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/">
                                    <ArrowLeft className="mr-2 h-4 w-4"/>
                                    Retour
                                </Link>
                            </Button>
                        </div>
                        <div className="flex items-center gap-4">
                            <Badge variant="outline" className="h-8 text-sm">
                                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                                {totalAiTickets} Tickets IA
                            </Badge>
                        </div>
                    </div>
                </header>

                <div className="flex-1 container p-4 lg:p-6 flex items-center justify-center">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-7xl">
                        <div className="flex flex-col gap-2">
                             <p className="text-sm font-semibold text-muted-foreground text-center">AVANT</p>
                             <div className="aspect-square w-full relative rounded-lg border bg-background overflow-hidden shadow-sm">
                                <Image src={originalImage.directUrl} alt="Image originale" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                             <p className="text-sm font-semibold text-muted-foreground text-center">APRÈS</p>
                             <div className="aspect-square w-full relative rounded-lg border bg-background flex items-center justify-center shadow-sm">
                                {isGenerating && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                                {!isGenerating && currentHistoryItem?.imageUrl && <Image src={currentHistoryItem.imageUrl} alt="Image générée par l'IA" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>}
                                {!isGenerating && !currentHistoryItem?.imageUrl && <Wand2 className="h-12 w-12 text-muted-foreground/30"/>}

                                {!isGenerating && generatedImageHistory.length > 0 && (
                                    <div className="absolute top-2 left-2 z-10 flex gap-2">
                                        <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="bg-background/80" aria-label="Annuler la dernière génération" disabled={historyIndex < 0}>
                                            <Undo2 className="h-5 w-5" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="bg-background/80" aria-label="Rétablir la génération" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                            <Redo2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* --- RIGHT SIDEBAR (Controls) --- */}
            <aside className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-card border-l flex flex-col h-full">
                <div className="p-4 border-b">
                     <h2 className="text-lg font-semibold tracking-tight">Panneau de Contrôle</h2>
                     <p className="text-sm text-muted-foreground">Pilotez la création de votre image.</p>
                </div>

                {/* --- Step 1: Generate Image --- */}
                <div className="p-4 space-y-3">
                    <Label className="font-semibold">1. Donnez votre instruction</Label>
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
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary"
                                    disabled={!prompt || !prompt.trim() || isGenerating || isSaving}
                                    onClick={openSavePromptDialog}
                                    aria-label="Sauvegarder le prompt"
                                >
                                    <Star className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Sauvegarder le prompt</DialogTitle>
                                    <DialogDescription>
                                        Donnez un nom à cette instruction pour la retrouver facilement plus tard.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="prompt-name">Nom du prompt</Label>
                                        <Input 
                                            id="prompt-name"
                                            value={newPromptName}
                                            onChange={(e) => setNewPromptName(e.target.value)}
                                            placeholder="Ex: Style super-héros"
                                            disabled={isSavingPrompt}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Instruction</Label>
                                        <Textarea value={promptToSave} readOnly disabled rows={4} className="bg-muted"/>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary" disabled={isSavingPrompt}>Annuler</Button>
                                    </DialogClose>
                                    <Button onClick={handleSavePrompt} disabled={isSavingPrompt || !newPromptName.trim()}>
                                        {isSavingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                        Sauvegarder
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {monthlyLimitReached ? (
                        <p className="text-center text-sm text-primary font-semibold">
                            Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}.
                        </p>
                    ) : (
                        <Button 
                            size="lg"
                            onClick={() => handleGenerateImage()}
                            disabled={!prompt || !prompt.trim() || isGenerating || isSaving || !hasAiTickets}
                            className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity"
                        >
                            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5 text-amber-300" />}
                            {isGenerating ? 'Génération en cours...' : 'Générer l\'image'}
                        </Button>
                    )}
                    {!hasAiTickets && !isGenerating && !monthlyLimitReached && (
                        <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                            <Link href="/shop">
                                <ShoppingCart className="mr-2 h-4 w-4"/>
                                Plus de tickets ? Rechargez dans la boutique !
                            </Link>
                        </Button>
                    )}
                </div>
                
                 {/* --- Suggestions --- */}
                <div className="flex-1 overflow-y-auto px-4">
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
                                                <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2 flex-grow text-left justify-start" onClick={() => setPrompt(p.value)} disabled={isGenerating || isSaving}>
                                                    {p.name}
                                                </Button>
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
                                                <div key={p.title}>
                                                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2" onClick={() => setPrompt(p.prompt)} disabled={isGenerating || isSaving}>
                                                        {p.title}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>


                {/* --- Step 2: Generate Description & Save --- */}
                <div className="p-4 mt-auto border-t space-y-3 bg-card">
                     <Label className="font-semibold">2. Ajoutez une description et sauvegardez</Label>
                    <div className="flex gap-2">
                         <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full" disabled={isGenerating || isSaving}>
                                    <Text className="mr-2 h-4 w-4"/> Rédiger
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Générer une description</DialogTitle>
                                    <DialogDescription>
                                        Laissez l'IA générer un contenu optimisé pour vos réseaux sociaux, ou rédigez le vôtre.
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
                                        <Textarea id="gen-tags" value={generatedHashtags} onChange={(e) => setGeneratedHashtags(e.target.value)} disabled={isGeneratingDescription} rows={2}/>
                                    </div>
                                    <Separator/>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity" 
                                                disabled={isGeneratingDescription || !hasAiTickets}
                                            >
                                                {isGeneratingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4 text-amber-400"/>}
                                                {isGeneratingDescription ? "Génération..." : "Générer pour..."}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56">
                                            <DropdownMenuItem onClick={() => handleGenerateDescription('ecommerce')}><ShoppingCart className="mr-2 h-4 w-4" /> Annonce E-commerce</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleGenerateDescription('instagram')}><Instagram className="mr-2 h-4 w-4" /> Instagram</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleGenerateDescription('facebook')}><Facebook className="mr-2 h-4 w-4" /> Facebook</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleGenerateDescription('x')}><MessageSquare className="mr-2 h-4 w-4" /> X (Twitter)</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleGenerateDescription('tiktok')}><VenetianMask className="mr-2 h-4 w-4" /> TikTok</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleGenerateDescription('generic')}><Wand2 className="mr-2 h-4 w-4" /> Générique</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleConfirmDescription}>Valider et Fermer</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Button onClick={handleSaveAiCreation} disabled={isSaving || isGenerating} className="w-full">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Enregistrer
                        </Button>
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
                        <AlertDialogAction
                            onClick={handleDeletePrompt}
                            disabled={isDeletingPrompt}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeletingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={isEditPromptDialogOpen} onOpenChange={setIsEditPromptDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Renommer le prompt</DialogTitle>
                    </DialogHeader>
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
                        <DialogClose asChild>
                            <Button variant="secondary" disabled={isEditingPrompt}>Annuler</Button>
                        </DialogClose>
                        <Button onClick={handleEditPrompt} disabled={isEditingPrompt || !editedPromptName.trim()}>
                            {isEditingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
