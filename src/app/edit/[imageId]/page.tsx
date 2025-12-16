
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, addDoc, collection, getDoc, DocumentReference, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, CustomPrompt, Gallery } from '@/lib/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Image as ImageIcon, Undo2, Redo2, Star, Trash2, Pencil, Tag, X, GalleryHorizontal, Clapperboard, Film, HelpCircle, ChevronDown, Library, Text, Facebook, Instagram, MessageSquare, VenetianMask, Ticket, Lightbulb, FileText as FileTextIcon, LineChart, FilePlus, Settings, Linkedin } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { optimizeImage } from '@/ai/flows/generate-carousel-flow';
import type { OptimizeImageOutput } from '@/ai/schemas/carousel-schemas';
import { animateStory } from '@/ai/flows/animate-story-flow';
import { decrementAiTicketCount, saveImageMetadata, updateImageDescription, saveCustomPrompt, deleteCustomPrompt, updateCustomPrompt, createGallery, addMultipleImagesToGalleries } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, addMonths, startOfMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { withErrorHandling } from '@/lib/async-wrapper';
import { socialAuditFlow, type SocialAuditOutput } from '@/ai/flows/social-audit-flow';
import type { SocialAuditInput, CreativeSuggestion } from '@/ai/schemas/social-audit-schemas';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestionCategories } from '@/lib/ai-prompts';


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

// --- Composants de carte d'action stylisés ---
const ActionCard = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
    <div
        className={cn(
            "group relative p-4 border rounded-lg h-full flex flex-col items-start gap-2 transition-all duration-300 ease-out cursor-pointer overflow-hidden",
            "bg-slate-900/50 border-slate-700/80 hover:border-purple-400/50 hover:shadow-2xl hover:shadow-purple-900/50",
             props.disabled && "opacity-50 cursor-not-allowed",
            className
        )}
        onClick={props.disabled ? undefined : props.onClick}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950/40 to-blue-950 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative z-10 w-full h-full flex flex-col items-start gap-2">
            {children}
        </div>
    </div>
);

const ActionIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-2 bg-slate-800 border border-slate-700 text-purple-300 rounded-lg shadow-inner-lg transition-all duration-300 group-hover:bg-purple-950/50 group-hover:text-purple-200 group-hover:shadow-purple-500/20">
        <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
    </div>
);

const ActionTitle = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold text-sm text-slate-100 transition-colors group-hover:text-white">{children}</span>
);

const ActionDescription = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-slate-400 transition-colors group-hover:text-slate-300">{children}</p>
);
// --- Fin des composants de carte d'action ---


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

    // NOUVEAU: State pour l'optimisation
    const [isOptimizeDialogOpen, setIsOptimizeDialogOpen] = useState(false); // Fenêtre de résultat
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedImageResult, setOptimizedImageResult] = useState<OptimizeImageOutput | null>(null);
    const [optimizationDirective, setOptimizationDirective] = useState('');
    const [platformForOptimization, setPlatformForOptimization] = useState('');
    const [isSavingOptimized, setIsSavingOptimized] = useState(false);


    // NOUVEAU: State pour la Story Animée
    const [isStoryDialogOpen, setIsStoryDialogOpen] = useState(false);
    const [storyAnimationPrompt, setStoryAnimationPrompt] = useState("");
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [generatedStoryUrl, setGeneratedStoryUrl] = useState<string | null>(null);


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


    const handleOptimizeImageClick = async (platform: string) => {
        if (!originalImage || !userProfile || totalAiTickets < 1) {
            toast({ variant: 'destructive', title: 'Action impossible', description: 'Tickets IA insuffisants ou image non chargée.' });
            return;
        }

        setIsOptimizing(true);
        setPlatformForOptimization(platform);
        setOptimizedImageResult(null);

        toast.info("Optimisation en cours...", {
            description: `L'IA prépare votre image pour ${platform}.`,
            id: 'optimizing-toast',
        });

        try {
            const result = await optimizeImage({
                baseImageUrl: originalImage.directUrl,
                subjectPrompt: originalImage.description || originalImage.title,
                userDirective: optimizationDirective || undefined,
                platform: platform,
            });

            setOptimizedImageResult(result);
            setIsOptimizeDialogOpen(true); // Ouvre la fenêtre de résultat

            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();
            toast.success("Image optimisée !", { id: 'optimizing-toast' });
        } catch (error) {
            console.error("Optimization error:", error);
            toast.error("Erreur d'optimisation", { id: 'optimizing-toast', description: (error as Error).message });
        } finally {
            setIsOptimizing(false);
            setPlatformForOptimization('');
        }
    };
    
    const handleSaveOptimizedImage = async () => {
        if (!optimizedImageResult || !user || !firebaseApp || !firestore) return;
        setIsSavingOptimized(true);
        const { error } = await withErrorHandling(async () => {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(optimizedImageResult.optimizedImageUrl);
            const newFileName = `optimized-${platformForOptimization}-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `Optimisé pour ${platformForOptimization}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Optimisé pour ${platformForOptimization}`,
                description: `Image optimisée par l'IA. ${optimizationDirective ? `Directive: "${optimizationDirective}"` : ''}`,
                generatedByAI: true
            });
        });

        if (!error) {
            toast({ title: "Sauvegardé dans la bibliothèque !", description: "Votre image optimisée a été ajoutée à votre galerie." });
            setIsOptimizeDialogOpen(false);
        }
        setIsSavingOptimized(false);
    };


    const handleGenerateImage = async () => {
        const currentPrompt = prompt;
        // On utilise toujours l'image originale comme base pour la première génération
        const baseImageUrl = originalImage?.directUrl;

        if (!currentPrompt || !baseImageUrl || !user || !firestore || !userProfile) return;

        if (totalAiTickets <= 0) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: ( <Link href="/shop" className="font-bold underline text-white"> Rechargez (dès 0,08€ / ticket) </Link> )
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
    

    const handleGenerateStory = async () => {
        if (!originalImage || !storyAnimationPrompt.trim() || !user || !userProfile || totalAiTickets < 5) {
            toast({ variant: 'destructive', title: 'Action impossible', description: "Vérifiez que vous avez entré un prompt et que vous avez assez de tickets IA (5 requis)." });
            return;
        }
        setIsGeneratingStory(true);
        setGeneratedStoryUrl(null);
        try {
            const result = await animateStory({
                imageUrl: originalImage.directUrl,
                prompt: storyAnimationPrompt,
                aspectRatio: '9:16'
            });
            setGeneratedStoryUrl(result.videoUrl);

            for (let i = 0; i < 5; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            toast({ title: "Animation générée !", description: "5 tickets IA ont été utilisés." });
        } catch (error) {
             toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGeneratingStory(false);
        }
    };

    const handleSaveGeneratedStory = async () => {
        if (!generatedStoryUrl || !user || !firebaseApp || !firestore) return;
        setIsSaving(true);
        
        const { error } = await withErrorHandling(async () => {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(generatedStoryUrl);
            const newFileName = `animated-story-${Date.now()}.mp4`; // Sauvegarder en mp4
            const videoFile = new File([blob], newFileName, { type: 'video/mp4' });

            const metadata = await uploadFileAndGetMetadata(storage, user, videoFile, `Story Animée: ${storyAnimationPrompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Animation : ${storyAnimationPrompt}`,
                description: `Story animée générée à partir de l'image originale avec le prompt : "${storyAnimationPrompt}"`,
                generatedByAI: true,
                mimeType: 'video/mp4' // S'assurer que le type est correct
            });
        });

        if (!error) {
            toast({ title: "Animation sauvegardée !", description: "Votre nouvelle vidéo a été ajoutée à votre galerie." });
            setIsStoryDialogOpen(false); // Fermer le dialogue après la sauvegarde
        } else {
             toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: "Impossible d'enregistrer la vidéo." });
        }
        setIsSaving(false);
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
                description: ( <Link href="/shop" className="font-bold underline text-white"> Rechargez (dès 0,08€ / ticket) </Link> )
            });
            return;
        }

        setIsGeneratingDescription(true);
        try {
            const imageUrlToProcess = currentHistoryItem?.imageUrl || originalImage?.directUrl;
            if (!imageUrlToProcess) {
                throw new Error("Aucune URL d'image disponible pour la description.");
            }

            const result = await generateImageDescription({ imageUrl: imageUrlToProcess, platform: platform });
            
            const newTitle = result.title;
            const newDesc = result.description;
            const newHashtags = result.hashtags.map(h => `#${'h.replace(/^#/, \'\')'}`).join(' ');

            setGeneratedTitle(newTitle);
            setGeneratedDescription(newDesc);
            setGeneratedHashtags(newHashtags);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
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
        const imageToSave = currentHistoryItem;
        if (!imageToSave || !user || !firebaseApp || !firestore) {
            if (originalImage) {
                 await updateImageDescription(firestore, user.uid, originalImage.id, {
                    title: generatedTitle,
                    description: generatedDescription,
                    hashtags: generatedHashtags,
                }, false);
                refetchImage();
                toast({ title: "Description mise à jour !", description: "La description de l'image originale a été modifiée." });
            }
            return;
        };
        
        setIsSaving(true);

        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(imageToSave.imageUrl);
            const newFileName = `ai-edited-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${imageToSave.prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: generatedTitle,
                description: generatedDescription,
                hashtags: generatedHashtags,
                generatedByAI: true
            });
            toast({ title: "Nouvelle création enregistrée !", description: "Votre nouvelle image et sa description ont été ajoutées à votre galerie." });

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
        setNewPromptName("");
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
            await updateDoc(doc(firestore, `users/${user.uid}`), {
                customPrompts: arrayUnion(newCustomPrompt)
            });
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
            await updateDoc(doc(firestore, `users/${user.uid}`), {
                customPrompts: arrayRemove(promptToDelete)
            });
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
        if (!promptToEdit || !editedPromptName.trim() || !user || !firestore || !userProfile) return;
        setIsEditingPrompt(true);

        const updatedPrompt = { ...promptToEdit, name: editedPromptName };

        try {
            const currentPrompts = userProfile.customPrompts || [];
            const promptIndex = currentPrompts.findIndex(p => p.id === promptToEdit.id);

            if (promptIndex === -1) {
                throw new Error("Prompt non trouvé.");
            }

            const newPrompts = [...currentPrompts];
            newPrompts[promptIndex] = updatedPrompt;

            await updateDoc(doc(firestore, `users/${user.uid}`), {
                customPrompts: newPrompts
            });

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
            
            <main className="flex-1 flex flex-col p-4 lg:p-6 space-y-6 overflow-y-auto">
                {/* --- Header --- */}
                <header className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                       <Link href="/">
                           <ArrowLeft className="mr-2 h-4 w-4"/>
                           Retour
                       </Link>
                   </Button>
                    <div className="text-center">
                       <h1 className="text-lg font-semibold tracking-tight">Éditeur d'Image par IA</h1>
                       <p className="text-xs text-muted-foreground">Transformez vos images en décrivant simplement les changements souhaités.</p>
                   </div>
                    <Dialog>
                        <DialogTrigger asChild>
                             <Button variant="outline" className="h-8 text-sm">
                               <Ticket className="mr-2 h-4 w-4 text-primary" />
                               {totalAiTickets} Tickets IA
                           </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Détail de vos Tickets IA</DialogTitle>
                                <DialogDescription>
                                    Vos tickets sont utilisés pour toutes les actions IA (génération d'image, de description, audit, etc.). L'ordre de consommation est : gratuits, abonnements, puis packs.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-2">
                                <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                                    <span>Gratuits (quotidiens)</span>
                                    <span className="font-bold">{userProfile?.aiTicketCount ?? 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                                    <span>Abonnement (mensuels)</span>
                                    <span className="font-bold">{userProfile?.subscriptionAiTickets ?? 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                                    <span>Packs (achetés)</span>
                                    <span className="font-bold">{userProfile?.packAiTickets ?? 0}</span>
                                </div>
                                <Separator className="my-3"/>
                                 <div className="flex justify-between items-center text-sm p-2">
                                    <span className="font-semibold">Total</span>
                                    <span className="font-bold text-primary text-lg">{totalAiTickets}</span>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button asChild>
                                    <Link href="/shop">
                                        <ShoppingCart className="mr-2 h-4 w-4" />
                                        Visiter la boutique
                                    </Link>
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </header>

                <Card>
                    <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="flex flex-col gap-2">
                            <Badge variant="secondary" className="w-fit mx-auto">AVANT</Badge>
                            <div className="aspect-square w-full relative rounded-lg border bg-muted overflow-hidden shadow-sm">
                                <Image src={originalImage.directUrl} alt="Image originale" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-center gap-4 relative h-6">
                            <Badge className="w-fit mx-auto">APRÈS</Badge>
                            {!isGenerating && generatedImageHistory.length > 0 && (
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                                        <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="h-7 w-7 bg-background/80" aria-label="Annuler" disabled={historyIndex < 0}>
                                            <Undo2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="h-7 w-7 bg-background/80" aria-label="Rétablir" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                            <Redo2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="aspect-square w-full relative rounded-lg border bg-muted flex items-center justify-center shadow-sm">
                                {isGenerating && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                                {!isGenerating && currentHistoryItem?.imageUrl && <Image src={currentHistoryItem.imageUrl} alt="Image générée par l'IA" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>}
                                {!isGenerating && !currentHistoryItem?.imageUrl && <Wand2 className="h-12 w-12 text-muted-foreground/30"/>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                            <span>Optimisation Pro 1-Clic</span>
                        </CardTitle>
                         <CardDescription>L'IA analyse votre image et la transforme en une version professionnelle et percutante, optimisée pour la plateforme de votre choix.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ActionCard onClick={() => handleOptimizeImageClick('instagram')} disabled={isOptimizing}>
                                {isOptimizing && platformForOptimization === 'instagram' ? (
                                    <div className="m-auto flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-purple-300" /><span className="text-xs text-purple-300">Génération...</span></div>
                                ) : (
                                    <><div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><ActionIcon icon={Instagram} /><ActionTitle>Carrousel</ActionTitle></div><Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-green-500" onClick={(e) => e.stopPropagation()}><HelpCircle className="h-4 w-4"/></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Format Carrousel "Avant/Après"</DialogTitle><DialogDescription>Cet outil génère un carrousel complet prêt à l'emploi. Il crée une image "Après" spectaculaire, puis rédige une histoire en 4 étapes pour présenter la transformation et engager votre audience. Idéal pour maximiser l'impact.</DialogDescription></DialogHeader></DialogContent></Dialog></div><ActionDescription>Crée un carrousel "Avant/Après" engageant avec une histoire captivante.</ActionDescription></>
                                )}
                            </ActionCard>
                            
                            <ActionCard onClick={() => handleOptimizeImageClick('facebook')} disabled={isOptimizing}>
                                 {isOptimizing && platformForOptimization === 'facebook' ? (
                                    <div className="m-auto flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-purple-300" /><span className="text-xs text-purple-300">Génération...</span></div>
                                ) : (
                                    <><div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><ActionIcon icon={Facebook} /><ActionTitle>Optimisation pour Facebook</ActionTitle></div><Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-green-500" onClick={(e) => e.stopPropagation()}><HelpCircle className="h-4 w-4"/></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Format Publication Simple</DialogTitle><DialogDescription>Cet outil se concentre sur la création d'une seule image finale, visuellement percutante. Il est parfait pour une publication rapide et efficace sur les fils d'actualité comme Facebook, où la clarté et l'impact immédiat sont essentiels.</DialogDescription></DialogHeader></DialogContent></Dialog></div><ActionDescription>Génère un format visuellement impactant, idéal pour le fil d'actualité.</ActionDescription></>
                                )}
                            </ActionCard>

                             <ActionCard onClick={() => handleOptimizeImageClick('x')} disabled={isOptimizing}>
                                {isOptimizing && platformForOptimization === 'x' ? (
                                    <div className="m-auto flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-purple-300" /><span className="text-xs text-purple-300">Génération...</span></div>
                                ) : (
                                    <><div className="flex items-center gap-3"><ActionIcon icon={MessageSquare} /><ActionTitle>Optimisation pour X (Twitter)</ActionTitle></div><ActionDescription>Produit une image à fort contraste, parfaite pour arrêter le défilement rapide.</ActionDescription></>
                                )}
                            </ActionCard>
                             <ActionCard onClick={() => handleOptimizeImageClick('linkedin')} disabled={isOptimizing}>
                                {isOptimizing && platformForOptimization === 'linkedin' ? (
                                    <div className="m-auto flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-purple-300" /><span className="text-xs text-purple-300">Génération...</span></div>
                                ) : (
                                    <><div className="flex items-center gap-3"><ActionIcon icon={Linkedin} /><ActionTitle>Optimisation pour LinkedIn</ActionTitle></div><ActionDescription>Génère une image au rendu sobre et professionnel pour une image de marque sérieuse.</ActionDescription></>
                                )}
                            </ActionCard>
                        </div>
                        <div className="mt-6 space-y-2">
                            <Label htmlFor="directive-input">Directive personnalisée (optionnel)</Label>
                            <Input 
                                id="directive-input"
                                placeholder="Ex: ajoute une ambiance de coucher de soleil..."
                                value={optimizationDirective}
                                onChange={(e) => setOptimizationDirective(e.target.value)}
                                disabled={isOptimizing}
                            />
                            <p className="text-xs text-muted-foreground">Donnez une instruction à l'IA pour guider la transformation.</p>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* --- RIGHT SIDEBAR (Controls) --- */}
            <aside className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-muted/40 border-l flex flex-col h-full">
                 <div className="flex-1 overflow-y-auto p-1">
                  <div className="p-3 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                          <span>Édition Manuelle</span>
                        </CardTitle>
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
                         {monthlyLimitReached ? ( <p className="text-center text-sm text-primary font-semibold"> Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}. </p>) : (
                             <div className="space-y-2">
                                <Button size="lg" onClick={() => handleGenerateImage()} disabled={!prompt || !prompt.trim() || isGenerating || isSaving || !hasAiTickets} className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity">
                                    {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5 text-amber-300" />}
                                    {isGenerating ? 'Génération en cours...' : 'Générer (1 Ticket IA)'}
                                </Button>
                                 <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full" disabled={isGenerating || isSaving}>
                                            <Text className="mr-2 h-4 w-4"/> Modifier ou générer une descrption IA
                                        </Button>
                                    </DialogTrigger>
                                </Dialog>
                                <Button onClick={handleSaveAiCreation} disabled={isSaving || isGenerating} className="w-full" variant="secondary">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Enregistrer la création
                                </Button>
                             </div>
                        )}
                        {!hasAiTickets && !isGenerating && !monthlyLimitReached && (
                            <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                                <Link href="/shop"> <ShoppingCart className="mr-2 h-4 w-4"/> Plus de tickets ? Rechargez (dès 0,08€ / ticket) ! </Link>
                            </Button>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                         <CardTitle className="flex items-center gap-2 text-lg">
                           <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                           <span>Inspiration</span>
                         </CardTitle>
                      </CardHeader>
                      <CardContent>
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

            <Dialog open={isOptimizeDialogOpen} onOpenChange={setIsOptimizeDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Résultat de l'Optimisation Pro</DialogTitle>
                        <DialogDescription>
                            Voici la version optimisée par l'IA. Vous pouvez la sauvegarder ou fermer pour essayer une autre instruction.
                        </DialogDescription>
                    </DialogHeader>
                    {optimizedImageResult ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-semibold text-center text-muted-foreground">AVANT</p>
                                <div className="relative aspect-square w-full rounded-md overflow-hidden border">
                                    <Image src={originalImage.directUrl} alt="Image originale" fill className="object-contain" unoptimized />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-semibold text-center text-primary">APRÈS (IA)</p>
                                <div className="relative aspect-square w-full rounded-md overflow-hidden border-2 border-primary">
                                    <Image src={optimizedImageResult.optimizedImageUrl} alt="Image optimisée par l'IA" fill className="object-contain" unoptimized />
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsOptimizeDialogOpen(false)}>Fermer</Button>
                        <Button onClick={handleSaveOptimizedImage} disabled={isSavingOptimized || !optimizedImageResult}>
                            {isSavingOptimized && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sauvegarder cette version
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
               <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Modifier ou générer une descrption IA</DialogTitle>
                        <DialogDescription>
                            Laissez l'IA rédiger un contenu optimisé, ou modifiez-le manuellement.
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
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Optimisation IA pour... (1 Ticket)</Label>
                                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                    <span className="text-primary">{totalAiTickets}</span> tickets restants
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" onClick={() => handleGenerateDescription('instagram')} disabled={isGeneratingDescription || !hasAiTickets} className="justify-start"><Instagram className="mr-2 h-4 w-4"/>Instagram</Button>
                                <Button variant="outline" onClick={() => handleGenerateDescription('facebook')} disabled={isGeneratingDescription || !hasAiTickets} className="justify-start"><Facebook className="mr-2 h-4 w-4"/>Facebook</Button>
                                <Button variant="outline" onClick={() => handleGenerateDescription('x')} disabled={isGeneratingDescription || !hasAiTickets} className="justify-start"><MessageSquare className="mr-2 h-4 w-4"/>X (Twitter)</Button>
                                <Button variant="outline" onClick={() => handleGenerateDescription('tiktok')} disabled={isGeneratingDescription || !hasAiTickets} className="justify-start"><VenetianMask className="mr-2 h-4 w-4"/>TikTok</Button>
                                <Button variant="outline" onClick={() => handleGenerateDescription('ecommerce')} disabled={isGeneratingDescription || !hasAiTickets} className="justify-start"><ShoppingCart className="mr-2 h-4 w-4"/>E-commerce</Button>
                                <Button variant="outline" onClick={() => handleGenerateDescription('generic')} disabled={isGeneratingDescription || !hasAiTickets} className="justify-start"><Wand2 className="mr-2 h-4 w-4"/>Générique</Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                         <DialogClose asChild><Button variant="secondary">Fermer</Button></DialogClose>
                        <Button onClick={handleConfirmDescription}>Valider le Contenu</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

    