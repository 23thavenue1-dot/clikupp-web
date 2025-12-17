
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, BrandProfile } from '@/lib/firestore';
import { Loader2, ArrowLeft, Instagram, Facebook, Clapperboard, Layers, Image as ImageIcon, Sparkles, RefreshCw, Save, FilePlus, Calendar as CalendarIcon, Edit, FileText, Clock, Trash2, MoreHorizontal, Share2, Building, List, CalendarDays, ChevronLeft, ChevronRight, GripVertical, Settings, PlusCircle, Library, Bot, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateCarousel, regenerateCarouselText } from '@/ai/flows/generate-carousel-flow';
import { generateImage } from '@/ai/flows/generate-image-flow';
import type { CarouselSlide } from '@/ai/schemas/carousel-schemas';
import { decrementAiTicketCount, saveImageMetadata, savePostForLater, createGallery } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { withErrorHandling } from '@/lib/async-wrapper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DialogClose } from '@radix-ui/react-dialog';


async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

const ActionCard = ({ children, className, onGenerate, disabled, cost }: { children: React.ReactNode; className?: string; onGenerate?: () => void; disabled?: boolean; cost: number; }) => {
    const { user } = useFirebase();
    const userDocRef = useMemoFirebase(() => user && doc(useFirestore(), `users/${user.uid}`), [user]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);
    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.packAiTickets || 0) + (userProfile.subscriptionAiTickets || 0) : 0;
    
    const hasEnoughTickets = totalAiTickets >= cost;

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <button
                                className={cn(
                                    "group relative p-4 border rounded-xl h-full flex flex-col items-start gap-2",
                                    "transition-all duration-300 ease-out cursor-pointer overflow-hidden transform hover:scale-[1.03]",
                                    "hover:shadow-2xl hover:shadow-purple-500/40",
                                    "bg-gradient-to-r from-blue-600 to-purple-600 border-blue-500 text-white",
                                    (disabled || !hasEnoughTickets) && "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none",
                                    className
                                )}
                                disabled={disabled || !hasEnoughTickets}
                            >
                                <div className="relative z-10 w-full h-full flex flex-col items-start gap-2">
                                    {children}
                                </div>
                            </button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    {!hasEnoughTickets && !disabled && (
                        <TooltipContent>
                            <p>Tickets IA insuffisants ({cost} requis)</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la génération ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action utilisera {cost} ticket(s) IA pour générer un nouveau contenu optimisé. Êtes-vous sûr de vouloir continuer ?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onGenerate}>Valider & Générer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const ActionIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-2 bg-white/10 border border-white/20 text-white rounded-xl shadow-lg transition-all duration-300 group-hover:bg-white/20">
        <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
    </div>
);

const ActionTitle = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold text-sm text-white">{children}</span>
);

const ActionDescription = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-white/80 transition-colors group-hover:text-white">{children}</p>
);

const SocialIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-1 bg-black/20 border border-white/30 text-white rounded-full shadow-md absolute top-3 right-3">
        <Icon className="h-4 w-4" />
    </div>
);


export default function PostMagiquePage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading, firebaseApp } = useFirebase();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSlides, setGeneratedSlides] = useState<CarouselSlide[] | null>(null);
    const [regeneratingSlide, setRegeneratingSlide] = useState<number | null>(null);
    const [selectedNetwork, setSelectedNetwork] = useState<string>('Instagram');
    
    // États pour la sauvegarde
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingToGallery, setIsSavingToGallery] = useState(false);
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');
    const [isSavingPost, setIsSavingPost] = useState(false);


    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: image, isLoading: isImageLoading } = useDoc<ImageMetadata>(imageDocRef);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, refetch: refetchUserProfile } = useDoc<UserProfile>(userDocRef);
    
    const brandProfilesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/brandProfiles`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: brandProfiles } = useCollection<BrandProfile>(brandProfilesQuery);


    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.packAiTickets || 0) + (userProfile.subscriptionAiTickets || 0) : 0;
    
    const handleGenerateSinglePost = (network: string) => {
        // Logique de génération de post unique à implémenter
        toast({ title: 'Fonctionnalité à venir', description: 'La génération de posts uniques sera bientôt disponible.' });
    };

    const handleGenerateStory = () => {
        // Logique de génération de story à implémenter
        toast({ title: 'Fonctionnalité à venir', description: 'La génération de stories sera bientôt disponible.' });
    };


    const handleGenerateCarousel = async (network: string) => {
        if (!image || !user || !userProfile || !firestore) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de lancer la génération.' });
            return;
        }

        const CAROUSEL_COST = 3;
        
        if (totalAiTickets < CAROUSEL_COST) {
             toast({ variant: 'destructive', title: 'Tickets IA insuffisants', description: `La génération d'un carrousel requiert ${CAROUSEL_COST} tickets.` });
            return;
        }

        setIsGenerating(true);
        setGeneratedSlides(null);
        setSelectedNetwork(network);

        try {
            const result = await generateCarousel({
                baseImageUrl: image.directUrl,
                platform: network.toLowerCase(),
            });
            setGeneratedSlides(result.slides);

            for (let i = 0; i < CAROUSEL_COST; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            refetchUserProfile();

            toast({ title: 'Carrousel généré !', description: 'Votre contenu est prêt.' });

        } catch (error) {
            console.error("Erreur de génération de carrousel:", error);
            toast({ variant: 'destructive', title: 'Erreur de l\'IA', description: 'Impossible de générer le carrousel.' });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleRegenerateText = async (slideIndex: number) => {
        if (!generatedSlides || !userProfile || !user || !firestore || totalAiTickets < 1) {
            toast({ variant: 'destructive', title: "Action impossible", description: "Pas assez de tickets IA." });
            return;
        }

        setRegeneratingSlide(slideIndex);

        try {
            const afterImageUrl = generatedSlides.find(s => s.title === 'APRÈS' && s.type === 'image')?.content;
            const currentText = generatedSlides[slideIndex].content;

            if (!image.directUrl || !afterImageUrl) throw new Error("Images de référence introuvables.");

            const result = await regenerateCarouselText({
                baseImageUrl: image.directUrl,
                afterImageUrl: afterImageUrl,
                currentText: currentText,
                slideIndex: slideIndex,
                platform: selectedNetwork,
            });
            
            const newSlides = [...generatedSlides];
            newSlides[slideIndex].content = result.newText;
            setGeneratedSlides(newSlides);

            await decrementAiTicketCount(firestore, user.uid, userProfile, 'description');
            refetchUserProfile();

            toast({ title: "Texte regénéré !" });

        } catch (error) {
            console.error("Erreur de regénération de texte:", error);
            toast({ variant: 'destructive', title: "Erreur de l'IA", description: "Impossible de regénérer le texte." });
        } finally {
            setRegeneratingSlide(null);
        }
    };
    
    const handleSaveCarousel = async () => {
        if (!generatedSlides || !user || !firebaseApp || !firestore) return;

        const afterImageSlide = generatedSlides.find(s => s.type === 'image' && s.title === 'APRÈS');
        if (!afterImageSlide) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Image "Après" introuvable pour la sauvegarde.' });
            return;
        }

        setIsSaving(true);
        const { error } = await withErrorHandling(async () => {
            const blob = await dataUriToBlob(afterImageSlide.content);
            const storage = getStorage(firebaseApp);
            const newFileName = `carousel-after-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });

            const hookText = generatedSlides.find(s => s.type === 'text' && s.title === 'LE POINT DE DÉPART')?.content || '';
            const conclusionText = generatedSlides.find(s => s.type === 'text' && s.title === 'LA TRANSFORMATION')?.content || '';
            const fullDescription = `${hookText}\n\n[Image "Après"]\n\n${conclusionText}`;

            const metadata = await uploadFileAndGetMetadata(
                storage,
                user,
                imageFile,
                `Généré par Post Magique`,
                () => {} 
            );
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Carrousel du ${format(new Date(), 'd MMMM yyyy')}`,
                description: fullDescription,
                hashtags: `#PostMagique #${selectedNetwork}`,
                generatedByAI: true
            });
        });

        setIsSaving(false);
        if (!error) {
            toast({ title: "Carrousel sauvegardé !", description: "La nouvelle image et ses textes ont été ajoutés à votre galerie." });
        }
    };
    
     const handleCreateGalleryForCarousel = useCallback(async () => {
        if (!generatedSlides || !user || !firebaseApp || !firestore || !image || !userProfile) return;

        const CAROUSEL_GALLERY_COST = 2; // 2 images de texte à générer
        if (totalAiTickets < CAROUSEL_GALLERY_COST) {
            toast({ variant: 'destructive', title: 'Tickets IA insuffisants', description: `Cette action requiert ${CAROUSEL_GALLERY_COST} tickets.` });
            return;
        }

        setIsSavingToGallery(true);

        const { error } = await withErrorHandling(async () => {
            const afterImageSlide = generatedSlides.find(s => s.type === 'image' && s.title === 'APRÈS');
            const hookTextSlide = generatedSlides.find(s => s.type === 'text' && s.title === 'LE POINT DE DÉPART');
            const conclusionTextSlide = generatedSlides.find(s => s.type === 'text' && s.title === 'LA TRANSFORMATION');

            if (!afterImageSlide || !hookTextSlide || !conclusionTextSlide) throw new Error("Slides du carrousel manquantes.");

            // Helper pour générer et sauvegarder une image
            const saveGeneratedImage = async (
                source: string, 
                type: 'data_uri' | 'text_prompt',
                title: string
            ): Promise<string> => {
                let imageDataUri: string;
                if (type === 'text_prompt') {
                    const textImagePrompt = `Règle Absolue : Crée une image avec un fond uni et noir (#000000). Ne dévie PAS de cette instruction de couleur. Au centre de cette image noire, affiche le texte suivant en blanc, en utilisant une police de caractères simple, moderne et facile à lire. Le texte est : "${source}"`;
                    const result = await generateImage({ prompt: textImagePrompt, aspectRatio: '1:1' });
                    imageDataUri = result.imageUrl;
                } else {
                    imageDataUri = source;
                }

                const blob = await dataUriToBlob(imageDataUri);
                const storage = getStorage(firebaseApp);
                const fileName = `carousel-slide-${Date.now()}.png`;
                const file = new File([blob], fileName, { type: 'image/png' });
                const metadata = await uploadFileAndGetMetadata(storage, user, file, title, () => {});
                const docRef = await saveImageMetadata(firestore, user, { ...metadata, title, generatedByAI: true });
                return docRef.id;
            };

            // Générer et sauvegarder les 3 nouvelles images en parallèle
            const [hookImageId, afterImageId, conclusionImageId] = await Promise.all([
                saveGeneratedImage(hookTextSlide.content, 'text_prompt', 'Carrousel Étape 2'),
                saveGeneratedImage(afterImageSlide.content, 'data_uri', 'Carrousel Étape 3 (Après)'),
                saveGeneratedImage(conclusionTextSlide.content, 'text_prompt', 'Carrousel Étape 4')
            ]);
            
            // Décompter les tickets pour les 2 images de texte générées
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();

            // Créer la galerie
            const galleryName = `Carrousel du ${format(new Date(), 'd MMMM yyyy HH:mm')}`;
            const galleryDescription = `Galerie générée pour le carrousel. Textes d'accroche: "${hookTextSlide.content}", Conclusion: "${conclusionTextSlide.content}"`;
            const newGalleryRef = await createGallery(firestore, user.uid, galleryName, galleryDescription);
            
            // Ajouter les 4 images dans le bon ordre
            const imageIdsInOrder = [image.id, hookImageId, afterImageId, conclusionImageId];
            await updateDoc(newGalleryRef, { imageIds: imageIdsInOrder });
        });

        setIsSavingToGallery(false);
        if (!error) {
            toast({
                title: "Galerie créée avec succès !",
                description: "Une nouvelle galerie contenant les 4 diapositives a été créée.",
                action: <Button asChild variant="secondary" size="sm"><Link href="/galleries">Voir mes galeries</Link></Button>
            });
        }
    }, [generatedSlides, user, firebaseApp, firestore, image, userProfile, totalAiTickets, toast, refetchUserProfile]);
    
    const handleSaveToPlanner = async () => {
        if (!generatedSlides || !user || !firebaseApp || !firestore || !selectedProfileId) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez sélectionner un profil de marque.' });
            return;
        }

        const afterImageSlide = generatedSlides.find(s => s.type === 'image' && s.title === 'APRÈS');
        if (!afterImageSlide) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Image "Après" introuvable.' });
            return;
        }
        
        setIsSavingPost(true);
        
        const { data: newImageMetadata, error } = await withErrorHandling(async () => {
            const blob = await dataUriToBlob(afterImageSlide.content);
            const storage = getStorage(firebaseApp);
            const newFileName = `post-magique-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });
    
            const hookText = generatedSlides.find(s => s.type === 'text' && s.title === 'LE POINT DE DÉPART')?.content || '';
            const conclusionText = generatedSlides.find(s => s.type === 'text' && s.title === 'LA TRANSFORMATION')?.content || '';
            const fullDescription = `${hookText}\n\n[Image "Après"]\n\n${conclusionText}`;
            
            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `Post Magique : ${selectedNetwork}`, () => {});
            
            const imageDocRef = await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Carrousel du ${format(new Date(), 'd MMMM yyyy')}`,
                description: fullDescription,
                hashtags: `#PostMagique #${selectedNetwork}`,
                generatedByAI: true
            });
            const newImageSnap = await getDoc(imageDocRef);
            if (!newImageSnap.exists()) throw new Error("Failed to retrieve saved image.");
            return newImageSnap.data() as ImageMetadata;
        });
    
        if (error || !newImageMetadata) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder l\'image dans la bibliothèque avant de planifier.' });
            setIsSavingPost(false);
            return;
        }
    
        const { error: plannerError } = await withErrorHandling(() => 
            savePostForLater(firestore, getStorage(firebaseApp), user.uid, {
                brandProfileId: selectedProfileId,
                title: newImageMetadata.title,
                description: newImageMetadata.description || '',
                scheduledAt: scheduleDate,
                imageSource: newImageMetadata,
            })
        );
        
        if (!plannerError) {
            if (scheduleDate) {
                toast({ title: "Publication programmée !", description: `Retrouvez-la dans votre Planificateur.` });
            } else {
                toast({ title: "Brouillon sauvegardé !", description: "Retrouvez-le dans votre Planificateur." });
            }
            setScheduleDialogOpen(false);
        }
        
        setIsSavingPost(false);
    };



    if (isUserLoading || isImageLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!image) {
        return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Image introuvable</h1>
                 <p className="text-muted-foreground">L'image source pour le Post Magique n'a pas été trouvée.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }
    
     const formats = [
        { id: 'ig-post', network: 'Instagram', format: 'Publication', icon: Instagram, typeIcon: ImageIcon, onGenerate: () => handleGenerateSinglePost('Instagram'), disabled: true, cost: 1 },
        { id: 'ig-story', network: 'Instagram', format: 'Story', icon: Instagram, typeIcon: Clapperboard, onGenerate: () => handleGenerateStory(), disabled: false, cost: 5 },
        { id: 'ig-carousel', network: 'Instagram', format: 'Carrousel', icon: Instagram, typeIcon: Layers, onGenerate: () => handleGenerateCarousel('Instagram'), disabled: false, cost: 3 },
        { id: 'fb-post', network: 'Facebook', format: 'Publication', icon: Facebook, typeIcon: ImageIcon, onGenerate: () => handleGenerateSinglePost('Facebook'), disabled: true, cost: 1 },
    ];


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-6xl mx-auto space-y-6">
                <header className="space-y-2">
                     <Button variant="ghost" asChild className="mb-4 -ml-4">
                        <Link href={`/image/${imageId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Retour à l'image
                        </Link>
                    </Button>
                    <h1 className="text-4xl font-bold tracking-tight">Post Magique 🪄</h1>
                    <p className="text-muted-foreground">
                        Choisissez un format. L'IA s'occupe de transformer votre image en un contenu optimisé prêt à publier.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Image d'Origine</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-md border bg-muted mb-4">
                            <Image
                                src={image.directUrl}
                                alt={image.title || image.originalName || 'Image d\'origine'}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    </CardContent>
                </Card>
                
                {isGenerating && (
                    <Card className="text-center">
                        <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary"/>
                            <p className="font-semibold">L'IA prépare votre contenu...</p>
                            <p className="text-sm text-muted-foreground">Cette opération peut prendre jusqu'à une minute.</p>
                        </CardContent>
                    </Card>
                )}

                {generatedSlides && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Votre Carrousel est Prêt !</CardTitle>
                            <CardDescription>Voici un aperçu des 4 diapositives générées.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {generatedSlides.map((slide, index) => (
                                    <div key={index} className="flex flex-col h-full">
                                        <Card className="overflow-hidden flex-grow flex flex-col">
                                            <CardHeader className="bg-muted p-2">
                                                <CardTitle className="text-center text-sm font-semibold uppercase tracking-widest">{slide.title}</CardTitle>
                                            </CardHeader>
                                            {slide.type === 'image' ? (
                                                <div className="aspect-square relative bg-black flex-grow">
                                                    <Image src={slide.content} alt={slide.title} fill className="object-contain" unoptimized/>
                                                </div>
                                            ) : (
                                                <div className="aspect-square flex flex-col items-center justify-center p-4 bg-background flex-grow">
                                                    <p className="text-sm text-center font-medium whitespace-pre-wrap flex-grow flex items-center">{slide.content}</p>
                                                     <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleRegenerateText(index)} 
                                                        disabled={isGenerating || regeneratingSlide != null || totalAiTickets < 1}
                                                        className="mt-2"
                                                    >
                                                        {regeneratingSlide === index ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                        ) : (
                                                            <RefreshCw className="mr-2 h-4 w-4"/>
                                                        )}
                                                        Regénérer
                                                    </Button>
                                                </div>
                                            )}
                                        </Card>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                         <CardFooter className="flex-col items-center gap-4 pt-6 border-t">
                            <h3 className="font-semibold text-lg">Finaliser et Sauvegarder</h3>
                            <div className="flex flex-wrap justify-center gap-2 w-full max-w-2xl">
                                <Button onClick={handleSaveCarousel} disabled={isSaving || isSavingPost || isSavingToGallery} className="bg-green-600 hover:bg-green-700">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Sauvegarder la création
                                </Button>
                                <Button onClick={handleCreateGalleryForCarousel} disabled={isSaving || isSavingPost || isSavingToGallery} variant="outline">
                                    {isSavingToGallery ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Library className="mr-2 h-4 w-4" />}
                                    Créer une galerie dédiée
                                </Button>
                                <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="secondary" disabled={isSaving || isSavingPost || isSavingToGallery}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            Planifier / Brouillon...
                                        </Button>
                                    </DialogTrigger>
                                     <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Planifier ou Sauvegarder en Brouillon</DialogTitle>
                                            <DialogDescription>Choisissez un profil et une date pour programmer, ou enregistrez simplement comme brouillon.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="brand-profile">Profil de Marque</Label>
                                                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                                    <SelectTrigger id="brand-profile"><SelectValue placeholder="Sélectionnez un profil..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {(brandProfiles || []).map(profile => (
                                                            <SelectItem key={profile.id} value={profile.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-5 w-5"><AvatarImage src={profile.avatarUrl} alt={profile.name} /><AvatarFallback>{profile.name.charAt(0)}</AvatarFallback></Avatar>
                                                                    <span>{profile.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {(brandProfiles || []).length === 0 && (
                                                  <p className="text-xs text-muted-foreground">Vous devez d'abord créer un profil de marque dans le <Link href="/audit" className="underline text-primary">Coach Stratégique</Link>.</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Date de publication (optionnel)</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal",!scheduleDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{scheduleDate ? format(scheduleDate, "PPP", { locale: fr }) : <span>Choisissez une date</span>}</Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} disabled={(date) => date < new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent>
                                                </Popover>
                                                <p className="text-xs text-muted-foreground">Si aucune date n'est choisie, le post sera sauvegardé comme brouillon.</p>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild><Button variant="secondary" disabled={isSavingPost}>Annuler</Button></DialogClose>
                                            <Button onClick={handleSaveToPlanner} disabled={!selectedProfileId || isSavingPost}>
                                                {isSavingPost ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FilePlus className="mr-2 h-4 w-4" />}
                                                {scheduleDate ? 'Programmer' : 'Enregistrer en brouillon'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Button variant="link" onClick={() => setGeneratedSlides(null)} className="mt-4">
                                <Sparkles className="mr-2 h-4 w-4"/>
                                Créer une autre transformation
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {!isGenerating && !generatedSlides && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Choisissez une transformation</CardTitle>
                            <CardDescription>Cliquez sur un format pour lancer la magie. Le coût en tickets IA est indiqué.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {formats.map((fmt) => (
                                <ActionCard 
                                    key={fmt.id} 
                                    onGenerate={fmt.onGenerate}
                                    disabled={fmt.disabled}
                                    cost={fmt.cost}
                                >
                                    <SocialIcon icon={fmt.icon} />
                                    <ActionIcon icon={fmt.typeIcon} />
                                    <ActionTitle>{fmt.format} ({fmt.cost} {fmt.cost > 1 ? 'tickets' : 'ticket'})</ActionTitle>
                                    <ActionDescription>pour {fmt.network}</ActionDescription>
                                </ActionCard>
                            ))}
                        </CardContent>
                    </Card>
                )}

            </div>
        </div>
    );
}

    