

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, addDoc, collection, getDoc, DocumentReference, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, CustomPrompt, Gallery } from '@/lib/firestore';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Image as ImageIcon, Undo2, Redo2, Star, Trash2, Pencil, Tag, X, GalleryHorizontal, Clapperboard, Film, HelpCircle, ChevronDown, Library, Text, Facebook, Instagram, MessageSquare, VenetianMask, Ticket } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { editImage, generateImage } from '@/ai/flows/generate-image-flow';
import { generateCarousel } from '@/ai/flows/generate-carousel-flow';
import type { GenerateCarouselOutput } from '@/ai/schemas/carousel-schemas';
import { decrementAiTicketCount, saveImageMetadata, updateImageDescription, saveCustomPrompt, deleteCustomPrompt, updateCustomPrompt, createGallery, addMultipleImagesToGalleries } from '@/lib/firestore';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"


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

// --- Helper pour créer une image à partir de texte (AMÉLIORÉ) ---
async function createTextToImage(text: string, width: number, height: number): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Fond noir avec dégradé subtil
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Style du texte
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Logique pour ajuster la taille de la police
    let fontSize = Math.min(width / 18, 60); // Taille de base réduite avec un maximum
    ctx.font = `bold ${fontSize}px "Inter", sans-serif`;

    // Fonction pour découper le texte en lignes
    const getLines = (currentText: string, maxWidth: number) => {
        const words = currentText.split(' ');
        const lines = [];
        let currentLine = words[0] || '';

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const widthTest = ctx.measureText(currentLine + " " + word).width;
            if (widthTest > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine += " " + word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    let lines = getLines(text, width * 0.8);
    let textHeight = lines.length * (fontSize * 1.2);

    // Réduire la taille de la police si le texte est trop haut pour le canvas
    while (textHeight > height * 0.8 && fontSize > 10) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
        lines = getLines(text, width * 0.8);
        textHeight = lines.length * (fontSize * 1.2);
    }
    
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (height - totalTextHeight) / 2 + (lineHeight / 2);

    lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + (index * lineHeight));
    });

    return canvas.toDataURL('image/png');
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

    // NOUVEAU: State pour le carrousel
    const [isCarouselDialogOpen, setIsCarouselDialogOpen] = useState(false);
    const [isGeneratingCarousel, setIsGeneratingCarousel] = useState(false);
    const [carouselResult, setCarouselResult] = useState<GenerateCarouselOutput | null>(null);
    const [editableDescriptions, setEditableDescriptions] = useState<string[]>([]);
    const [carouselUserDirective, setCarouselUserDirective] = useState('');
    const [carouselApi, setCarouselApi] = useState<CarouselApi>()
    const [currentSlide, setCurrentSlide] = useState(0)


    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: originalImage, isLoading: isImageLoading, refetch: refetchImage } = useDoc<ImageMetadata>(imageDocRef);

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
    
    // Pour les miniatures du carrousel
    useEffect(() => {
        if (!carouselApi) return
        
        setCurrentSlide(carouselApi.selectedScrollSnap())
        const onSelect = () => {
          setCurrentSlide(carouselApi.selectedScrollSnap())
        }
        carouselApi.on("select", onSelect)
        return () => {
          carouselApi.off("select", onSelect)
        }
    }, [carouselApi]);


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
    
    const handleGenerateCarousel = async (platform: string) => {
        const CAROUSEL_COST = 1; // Coût ajusté
        if (!originalImage || !userProfile || totalAiTickets < CAROUSEL_COST) {
            toast({ 
                variant: 'destructive', 
                title: 'Action impossible', 
                description: `Image originale manquante, profil non chargé ou tickets IA insuffisants (${CAROUSEL_COST} requis).`
            });
            return;
        }
        setIsGeneratingCarousel(true);
        setIsCarouselDialogOpen(true);
        setCarouselResult(null);
        
        try {
            const result = await generateCarousel({
                baseImageUrl: originalImage.directUrl,
                subjectPrompt: originalImage.description || originalImage.title,
                userDirective: carouselUserDirective || undefined,
                platform: platform,
            });

            // On ne génère plus les images textuelles ici, on les laisse en null
            const resultForPreview: GenerateCarouselOutput = {
                slides: [
                    result.slides[0],
                    { imageUrl: null, description: result.slides[1].description },
                    result.slides[2],
                    { imageUrl: null, description: result.slides[3].description },
                ]
            };

            setCarouselResult(resultForPreview);
            setEditableDescriptions(result.slides.map(s => s.description));


            for (let i = 0; i < CAROUSEL_COST; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            toast({ title: 'Carrousel généré !', description: `${CAROUSEL_COST} ticket(s) IA utilisé(s).` });
        } catch (error) {
            console.error("Carousel generation error:", error);
            toast({ variant: 'destructive', title: 'Erreur de génération', description: "Le carrousel n'a pas pu être créé." });
            setIsCarouselDialogOpen(false);
        } finally {
            setIsGeneratingCarousel(false);
        }
    };

    const handleCreateGalleryFromCarousel = async () => {
        if (!carouselResult || !originalImage || !user || !firebaseApp || !firestore) return;
    
        setIsSaving(true);
        try {
            // Générer les images de texte à partir de l'état éditable
            const textImage2 = await createTextToImage(editableDescriptions[1], 800, 1000);
            const textImage4 = await createTextToImage(editableDescriptions[3], 800, 1000);

            const finalImagesToUpload = [textImage2, carouselResult.slides[2].imageUrl, textImage4];

            const savedImageIds = await Promise.all(
                finalImagesToUpload.map(async (imageUrl, index) => {
                    if (!imageUrl) return null;
                    const blob = await dataUriToBlob(imageUrl);
                    const newFileName = `carousel-${index + 2}-${Date.now()}.png`;
                    const imageFile = new File([blob], newFileName, { type: blob.type });
                    const metadata = await uploadFileAndGetMetadata(getStorage(firebaseApp), user, imageFile, `Carrousel Étape ${index + 2}`, () => {});
                    const docRef = await saveImageMetadata(firestore, user, { ...metadata, generatedByAI: true });
                    return docRef.id;
                })
            );
            const validImageIds = savedImageIds.filter((id): id is string => !!id);

            const galleryName = `Carrousel: ${originalImage.title || `Transformation du ${format(new Date(), 'd MMM')}`}`;
            const galleryDescription = editableDescriptions.map((desc, i) => `ÉTAPE ${i+1}: ${desc}`).join('\\n---\\n');
            const newGalleryDocRef = await createGallery(firestore, user.uid, galleryName, galleryDescription);
    
            // Ajoute l'image originale + les 3 nouvelles
            await addMultipleImagesToGalleries(firestore, user.uid, [originalImage.id, ...validImageIds], [newGalleryDocRef.id]);
    
            toast({
                title: "Galerie créée avec succès !",
                description: (
                    <p>La galerie "{galleryName}" a été créée avec les 4 images.
                        <Link href={`/galleries/${newGalleryDocRef.id}`} className="font-bold text-primary underline ml-1">
                            Y aller
                        </Link>
                    </p>
                ),
            });
            setIsCarouselDialogOpen(false);
    
        } catch (error) {
            console.error("Erreur lors de la création de la galerie depuis le carrousel :", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: 'Impossible de créer la galerie.' });
        } finally {
            setIsSaving(false);
        }
    };


    const handleSaveCarouselToLibrary = async () => {
        if (!carouselResult || !user || !firebaseApp || !firestore) return;
        
        const finalImageSlide = carouselResult.slides[2];
        if (!finalImageSlide || !finalImageSlide.imageUrl) {
            toast({ variant: 'destructive', title: 'Erreur', description: "L'image finale du carrousel est manquante." });
            return;
        }

        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(finalImageSlide.imageUrl);
            const newFileName = `carousel-creation-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const fullDescription = editableDescriptions.map((desc, index) => `Étape ${index + 1}: ${desc}`).join('\\n\\n');

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `Carrousel: ${editableDescriptions[0]}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Carrousel : ${editableDescriptions[2]}`,
                description: fullDescription,
                generatedByAI: true
            });

            toast({ title: "Création sauvegardée !", description: "L'image finale et les textes du carrousel ont été ajoutés à votre galerie." });
            setIsCarouselDialogOpen(false);
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du carrousel :", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: 'Impossible d\'enregistrer la création.' });
        } finally {
            setIsSaving(false);
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
        const imageToSave = currentHistoryItem; // On ne sauvegarde que les nouvelles images
        if (!imageToSave || !user || !firebaseApp || !firestore) {
            // Si on clique sur enregistrer sans avoir généré d'image, on met à jour la description de l'originale
            if (originalImage) {
                 await updateImageDescription(firestore, user.uid, originalImage.id, {
                    title: generatedTitle,
                    description: generatedDescription,
                    hashtags: generatedHashtags,
                }, false); // false car la description n'est pas forcément générée par IA
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

            // Ne pas rediriger, rester sur la page
            // router.push('/'); 

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
                 <h1 className="text-2xl font-bold">Rapport introuvable</h1>
                 <p className="text-muted-foreground">Le rapport que vous cherchez n'existe pas ou vous n'y avez pas accès.</p>
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
                            <span>Création de Contenus optimisés</span>
                        </CardTitle>
                        <CardDescription>Passez au niveau supérieur en générant des formats de contenu avancés à partir de votre image.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="instagram">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="instagram" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"><Instagram className="mr-2" />Instagram</TabsTrigger>
                                <TabsTrigger value="facebook" className="data-[state=active]:bg-[#1877F2] data-[state=active]:text-white"><Facebook className="mr-2" />Facebook</TabsTrigger>
                                <TabsTrigger value="x" className="data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"><MessageSquare className="mr-2" />X</TabsTrigger>
                                <TabsTrigger value="tiktok" className="data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"><VenetianMask className="mr-2" />TikTok</TabsTrigger>
                            </TabsList>
                            <TabsContent value="instagram" className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 text-primary rounded-lg"><GalleryHorizontal className="h-5 w-5" /></div>
                                                <h4 className="font-semibold">Carrousel Narratif</h4>
                                            </div>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500"><HelpCircle className="h-4 w-4"/></Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Comment fonctionne le Carrousel Narratif ?</DialogTitle>
                                                        <DialogDescription>
                                                            Cette IA analyse votre image et génère une histoire en 4 diapositives pour captiver votre audience.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4 space-y-4 text-sm">
                                                        <p>Le carrousel est conçu pour maximiser l'engagement en créant un "avant/après" percutant. Voici le comportement de l'IA selon votre image :</p>
                                                        <ul className="space-y-2 list-disc pl-5">
                                                            <li><strong>Pour un Portrait :</strong> L'IA sublime le modèle en ajustant la lumière, le contraste et la netteté pour un rendu professionnel, sans dénaturer la personne.</li>
                                                            <li><strong>Pour un Paysage de Jour :</strong> L'IA transforme la scène en un <span className="font-semibold text-primary">coucher de soleil spectaculaire</span> avec des couleurs chaudes et un éclairage dramatique.</li>
                                                            <li><strong>Pour un Objet :</strong> L'IA crée une <span className="font-semibold text-primary">mise en scène "lifestyle" réaliste</span> et inspirante pour mettre le produit en valeur dans son contexte d'utilisation.</li>
                                                            <li><strong>Pour une Pièce d'Intérieur :</strong> L'IA range et redécore subtilement l'espace pour créer une ambiance zen et minimaliste.</li>
                                                        </ul>
                                                         <Separator/>
                                                        <p className="text-xs text-muted-foreground">
                                                            <strong>Avis de non-responsabilité :</strong> Clikup utilise des modèles d'IA expérimentaux. Les résultats sont fournis "en l'état" et peuvent parfois être imprévisibles ou ne pas correspondre exactement à vos attentes.
                                                        </p>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                        <p className="text-xs text-muted-foreground flex-grow">Générez un carrousel "Avant/Après" avec une histoire pour captiver votre audience.</p>
                                        <div className="space-y-2 pt-2">
                                            <Label htmlFor="carousel-directive" className="text-xs font-semibold">Directive (optionnel)</Label>
                                            <Input 
                                                id="carousel-directive"
                                                placeholder="Ex: Rends le tout plus dramatique..." 
                                                value={carouselUserDirective}
                                                onChange={(e) => setCarouselUserDirective(e.target.value)}
                                                className="h-8 text-xs"
                                                disabled={isGeneratingCarousel}
                                            />
                                        </div>
                                        <Button size="sm" onClick={() => handleGenerateCarousel('instagram')} disabled={isGeneratingCarousel}>
                                            {isGeneratingCarousel ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                            Générer (1 Ticket)
                                        </Button>
                                    </Card>
                                    <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Clapperboard className="h-5 w-5" /></div><h4 className="font-semibold">Story Animée</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Transforme l'image en une vidéo de 5s avec des animations de texte et d'effets.</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                    <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Film className="h-5 w-5" /></div><h4 className="font-semibold">Réel "Zoom & Révèle"</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Crée une courte vidéo qui zoome sur un détail avant de révéler l'image complète.</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                </div>
                            </TabsContent>
                             <TabsContent value="facebook" className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><GalleryHorizontal className="h-5 w-5" /></div><h4 className="font-semibold">Diaporama Événementiel</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Crée une séquence de 3 images avec des variations sur un thème (ex: 3 angles différents).</p>
                                        <Button size="sm" disabled>Générer (3 Tickets)</Button>
                                    </Card>
                                     <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Clapperboard className="h-5 w-5" /></div><h4 className="font-semibold">Vidéo de Couverture</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Génère une vidéo de 8s optimisée pour les couvertures de page Facebook.</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                     <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Film className="h-5 w-5" /></div><h4 className="font-semibold">Post Publicitaire</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Crée une courte vidéo avec du texte marketing et un appel à l'action clair.</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                </div>
                            </TabsContent>
                             <TabsContent value="x" className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><GalleryHorizontal className="h-5 w-5" /></div><h4 className="font-semibold">Image "Citation"</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Superpose une citation inspirante et bien formatée sur votre image.</p>
                                        <Button size="sm" disabled>Générer (1 Ticket)</Button>
                                    </Card>
                                     <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Clapperboard className="h-5 w-5" /></div><h4 className="font-semibold">Mème / Réaction</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Transforme l'image en mème avec une légende humoristique adaptée à l'actualité.</p>
                                        <Button size="sm" disabled>Générer (1 Ticket)</Button>
                                    </Card>
                                     <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Film className="h-5 w-5" /></div><h4 className="font-semibold">GIF Animé</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Crée un court GIF de 2s en boucle à partir de l'image pour plus d'impact.</p>
                                        <Button size="sm" disabled>Générer (3 Tickets)</Button>
                                    </Card>
                                </div>
                            </TabsContent>
                             <TabsContent value="tiktok" className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><GalleryHorizontal className="h-5 w-5" /></div><h4 className="font-semibold">Vidéo "Fond Vert"</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Crée un clip où votre image devient un fond animé pour une vidéo face caméra.</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                     <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Clapperboard className="h-5 w-5" /></div><h4 className="font-semibold">Vidéo Tendance</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Anime l'image en suivant une tendance visuelle TikTok actuelle (ex: "CapCut zoom").</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                     <Card className="p-4 flex flex-col gap-2 bg-muted/30">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 text-primary rounded-lg"><Film className="h-5 w-5" /></div><h4 className="font-semibold">"Beat Sync" Musical</h4></div>
                                        <p className="text-xs text-muted-foreground flex-grow">Génère une vidéo avec des effets de coupe et de zoom synchronisés sur un rythme populaire.</p>
                                        <Button size="sm" disabled>Générer (5 Tickets)</Button>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>
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
                          <span>Instruction</span>
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
                                <Link href="/shop"> <ShoppingCart className="mr-2 h-4 w-4"/> Plus de tickets ? Rechargez ! </Link>
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

            <Dialog open={isCarouselDialogOpen} onOpenChange={setIsCarouselDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Résultat du Carrousel</DialogTitle>
                        <DialogDescription>
                            Voici les images et les textes générés. Vous pouvez <span className="text-green-600 font-semibold">modifier les textes</span> des diapositives textuelles.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {isGeneratingCarousel ? (
                            <div className="flex flex-col items-center justify-center h-96">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="mt-4 text-muted-foreground">Génération du carrousel en cours...</p>
                            </div>
                        ) : carouselResult ? (
                             <div className="grid grid-cols-4 gap-4">
                                {carouselResult.slides.map((slide, index) => {
                                   const isEditable = index === 1 || index === 3;
                                   return (
                                        <div key={index} className="flex flex-col gap-2 group">
                                             <div className="aspect-[4/5] rounded-lg flex items-center justify-center overflow-hidden relative text-white bg-black">
                                                {slide.imageUrl ? (
                                                     <Image src={slide.imageUrl} alt={`Étape ${index + 1}`} fill className="object-cover" unoptimized/>
                                                ) : (
                                                    <div className="p-4 text-center flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-gray-900 to-black">
                                                        <Textarea
                                                            value={editableDescriptions[index] || ''}
                                                            onChange={(e) => {
                                                                const newDescriptions = [...editableDescriptions];
                                                                newDescriptions[index] = e.target.value;
                                                                setEditableDescriptions(newDescriptions);
                                                            }}
                                                            className="text-xl font-bold tracking-tight bg-transparent border-none text-white text-center focus-visible:ring-0 resize-none h-full w-full flex items-center justify-center"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                   )
                               })}
                            </div>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                                <p>Aucun résultat à afficher.</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsCarouselDialogOpen(false)}>Fermer</Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button disabled={isGeneratingCarousel || !carouselResult || isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Exporter le Carrousel
                                    <ChevronDown className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleSaveCarouselToLibrary} disabled={isSaving}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Sauvegarder la création
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCreateGalleryFromCarousel} disabled={isSaving}>
                                    <Library className="mr-2 h-4 w-4" />
                                    Créer une galerie dédiée
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                    <Film className="mr-2 h-4 w-4" />
                                    Télécharger les diapositives
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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

