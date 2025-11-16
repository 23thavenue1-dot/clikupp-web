
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type ImageMetadata, type UserProfile, type Gallery, deleteImageMetadata, updateImageDescription, decrementAiTicketCount, createGallery, addMultipleImagesToGalleries, toggleGlobalImagePin, deleteMultipleImages } from '@/lib/firestore';
import { format, formatDistanceToNow, addMonths, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ImageIcon, Trash2, Loader2, Share2, Copy, Check, Pencil, Wand2, Instagram, Facebook, MessageSquare, VenetianMask, CopyPlus, Ticket, PlusCircle, X, BoxSelect, Sparkles, Save, Download, MoreHorizontal, PinOff, Pin, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getStorage } from 'firebase/storage';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';


type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic';


export function ImageList() {
    const { user, firebaseApp } = useFirebase();
    const firestore = useFirestore();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<ImageMetadata | null>(null);

    const [showMultiDeleteAlert, setShowMultiDeleteAlert] = useState(false);

    const [showEditDialog, setShowEditDialog] = useState(false);
    const [imageToEdit, setImageToEdit] = useState<ImageMetadata | null>(null);

    const [showAddToGalleryDialog, setShowAddToGalleryDialog] = useState(false);
    const [imageToAddToGallery, setImageToAddToGallery] = useState<ImageMetadata | null>(null);
    const [selectedGalleries, setSelectedGalleries] = useState<Set<string>>(new Set());
    const [isSavingToGallery, setIsSavingToGallery] = useState(false);
    const [newGalleryName, setNewGalleryName] = useState('');
    const [isCreatingGallery, setIsCreatingGallery] = useState(false);
    
    const [currentTitle, setCurrentTitle] = useState('');
    const [currentDescription, setCurrentDescription] = useState('');
    const [hashtagsString, setHashtagsString] = useState('');
    
    const [isSavingDescription, setIsSavingDescription] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [wasGeneratedByAI, setWasGeneratedByAI] = useState(false);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());


    const imagesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
    }, [user, firestore]);

    const { data: images, isLoading } = useCollection<ImageMetadata>(imagesQuery);

    const galleriesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/galleries`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: galleries } = useCollection<Gallery>(galleriesQuery);

     const totalAiTickets = useMemo(() => {
        if (!userProfile) return 0;
        return (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0);
    }, [userProfile]);
    
    const sortedImages = useMemo(() => {
        if (!images) return [];
        const pinnedIds = new Set(userProfile?.pinnedImageIds || []);
        return [...images].sort((a, b) => {
            const aIsPinned = pinnedIds.has(a.id);
            const bIsPinned = pinnedIds.has(b.id);
            if (aIsPinned && !bIsPinned) return -1;
            if (!aIsPinned && bIsPinned) return 1;
            // Si le statut d'épingle est le même, trier par date de téléversement
            const dateA = a.uploadTimestamp?.toDate()?.getTime() || 0;
            const dateB = b.uploadTimestamp?.toDate()?.getTime() || 0;
            return dateB - dateA;
        });
    }, [images, userProfile]);

    useEffect(() => {
        if (imageToEdit) {
            setCurrentTitle(imageToEdit.title || '');
            setCurrentDescription(imageToEdit.description || '');
            setHashtagsString(imageToEdit.hashtags || '');
            setWasGeneratedByAI(false);
        }
    }, [imageToEdit]);
    
    const openDeleteDialog = (image: ImageMetadata) => {
        setImageToDelete(image);
        setShowDeleteAlert(true);
    };
    
    const openEditDialog = (image: ImageMetadata) => {
        setImageToEdit(image);
        setShowEditDialog(true);
    };

    const openAddToGalleryDialog = (image: ImageMetadata | null) => {
        if (image) {
            setImageToAddToGallery(image);
            const containingGalleries = galleries?.filter(g => g.imageIds.includes(image.id)).map(g => g.id) || [];
            setSelectedGalleries(new Set(containingGalleries));
        } else {
            // Mode sélection multiple, pas d'image unique
            setImageToAddToGallery(null);
            setSelectedGalleries(new Set()); // On part de zéro
        }
        setNewGalleryName('');
        setShowAddToGalleryDialog(true);
    };

    const handleDeleteImage = async () => {
        if (!imageToDelete || !user || !firestore) return;
        
        setIsDeleting(imageToDelete.id);

        try {
            await deleteImageMetadata(firestore, user.uid, imageToDelete.id);
            toast({ title: "Image supprimée", description: "L'image a été supprimée avec succès." });

        } catch (error) {
            console.error("Erreur lors de la suppression de l'image:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: "Une erreur est survenue lors de la suppression de l'image."
            });
        } finally {
            setIsDeleting(null);
            setShowDeleteAlert(false);
            setImageToDelete(null);
        }
    };

    const handleMultiDelete = async () => {
        if (selectedImages.size === 0 || !user || !firestore || !firebaseApp) return;
    
        setIsDeleting('multi'); // Indicate that a multi-delete operation is in progress
    
        try {
            const imageIdsToDelete = Array.from(selectedImages);
            await deleteMultipleImages(firestore, getStorage(firebaseApp), user.uid, imageIdsToDelete);
    
            toast({
                title: `${imageIdsToDelete.length} image(s) supprimée(s)`,
                description: "Les images sélectionnées ont été définitivement supprimées.",
            });
    
            // Reset selection mode
            setIsSelectionMode(false);
            setSelectedImages(new Set());
    
        } catch (error) {
            console.error("Erreur lors de la suppression multiple :", error);
            toast({
                variant: 'destructive',
                title: 'Erreur de suppression',
                description: "Une erreur est survenue. Certaines images n'ont peut-être pas été supprimées."
            });
        } finally {
            setIsDeleting(null);
            setShowMultiDeleteAlert(false);
        }
    };

    const handleDownload = async (image: ImageMetadata) => {
        setIsDownloading(image.id);
    
        if (isMobile) {
            window.open(image.directUrl, '_blank');
            toast({
                title: 'Ouvrir l\'image',
                description: 'Appuyez longuement sur l\'image pour l\'enregistrer.',
            });
            setIsDownloading(null);
            return;
        }
    
        try {
            const response = await fetch(image.directUrl);
            if (!response.ok) throw new Error('Network response was not ok.');
            const blob = await response.blob();
    
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const fileExtension = image.mimeType?.split('/')[1] || 'jpg';
            const fileName = image.title || image.originalName || `clikup-image-${image.id}`;
            link.setAttribute('download', `${fileName}.${fileExtension}`);
    
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
    
            window.URL.revokeObjectURL(url);
            toast({ title: 'Téléchargement lancé', description: `Votre image "${fileName}" est en cours de téléchargement.` });
        } catch (error) {
            console.error("Download error:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur de téléchargement',
                description: 'Impossible de télécharger l\'image. Veuillez réessayer.'
            });
        } finally {
            setIsDownloading(null);
        }
    };

    const handleGenerateDescription = async (platform: Platform) => {
        if (!imageToEdit || !user || !userProfile) return;

        if (totalAiTickets <= 0) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: (
                    <Link href="/shop" className="font-bold underline text-white">
                        Rechargez dans la boutique !
                    </Link>
                ),
            });
            return;
        }

        setIsGeneratingDescription(true);
        setWasGeneratedByAI(false);
        try {
            const result = await generateImageDescription({ imageUrl: imageToEdit.directUrl, platform: platform });
            setCurrentTitle(result.title);
            setCurrentDescription(result.description);
            // On ajoute le # directement ici
            setHashtagsString(result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '));
            setWasGeneratedByAI(true);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile);
            
            toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Un ticket IA a été utilisé.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setIsGeneratingDescription(false);
        }
    };

    const handleSaveDescription = async () => {
        if (!imageToEdit || !user || !firestore) return;
        setIsSavingDescription(true);

        const dataToSave = {
            title: currentTitle,
            description: currentDescription,
            hashtags: hashtagsString
        };

        try {
            await updateImageDescription(firestore, user.uid, imageToEdit.id, dataToSave, wasGeneratedByAI);
            toast({ title: 'Description enregistrée', description: 'Les informations de l\'image ont été mises à jour.' });
            setShowEditDialog(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer les informations.' });
        } finally {
            setIsSavingDescription(false);
        }
    };

    const handleSaveToGalleries = async () => {
        if (!user || !firestore || !galleries || (!imageToAddToGallery && selectedImages.size === 0)) return;
        setIsSavingToGallery(true);
    
        try {
            if (imageToAddToGallery) { // Cas image unique
                // This logic is now complex, better to just call addMultipleImagesToGalleries
                await addMultipleImagesToGalleries(firestore, user.uid, [imageToAddToGallery.id], Array.from(selectedGalleries));

                // Also need to handle removing from galleries it was deselected from
                const originalGalleries = galleries.filter(g => g.imageIds.includes(imageToAddToGallery.id)).map(g => g.id);
                const galleriesToRemoveFrom = originalGalleries.filter(gId => !selectedGalleries.has(gId));
                if (galleriesToRemoveFrom.length > 0) {
                     const removePromises = galleriesToRemoveFrom.map(gId => addMultipleImagesToGalleries(firestore, user.uid, [imageToAddToGallery.id], [], true, [gId]));
                     await Promise.all(removePromises);
                }

            } else if (selectedImages.size > 0) { // Cas sélection multiple
                if (selectedGalleries.size > 0) {
                    await addMultipleImagesToGalleries(firestore, user.uid, Array.from(selectedImages), Array.from(selectedGalleries));
                }
            }
            
            toast({ title: 'Galeries mises à jour', description: 'Les images ont bien été ajoutées aux galeries sélectionnées.' });
            setShowAddToGalleryDialog(false);
            setIsSelectionMode(false);
            setSelectedImages(new Set());
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour les galeries.' });
        } finally {
            setIsSavingToGallery(false);
        }
    };

    const handleGallerySelectionChange = (galleryId: string) => {
        setSelectedGalleries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(galleryId)) {
                newSet.delete(galleryId);
            } else {
                newSet.add(galleryId);
            }
            return newSet;
        });
    };

    const handleCreateGalleryOnTheFly = async () => {
        if (!newGalleryName.trim() || !user || !firestore) return;
        setIsCreatingGallery(true);
        try {
            const newGalleryRef = await createGallery(firestore, user.uid, newGalleryName);
            setSelectedGalleries(prev => new Set(prev).add(newGalleryRef.id));
            setNewGalleryName('');
            toast({ title: "Galerie créée", description: `"${newGalleryName}" a été créée et sélectionnée.`});
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer la galerie.' });
        } finally {
            setIsCreatingGallery(false);
        }
    }

    const handleToggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedImages(new Set());
    };

    const toggleImageSelection = (imageId: string) => {
        setSelectedImages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                newSet.add(imageId);
            }
            return newSet;
        });
    };

    const handleToggleGlobalPin = async (image: ImageMetadata) => {
        if (!user || !firestore || !userProfile) return;

        const isCurrentlyPinned = userProfile.pinnedImageIds?.includes(image.id) ?? false;
        
        try {
            await toggleGlobalImagePin(firestore, user.uid, image.id, !isCurrentlyPinned);
            toast({
                title: isCurrentlyPinned ? 'Image désépinglée' : 'Image épinglée globalement',
            });
            // No need to call refetch, useDoc handles it.
        } catch (error) {
             toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de modifier l'épingle." });
        }
    };

    const monthlyLimitReached = !!(userProfile && userProfile.aiTicketMonthlyCount >= 40 && totalAiTickets <= 0);
    const nextRefillDate = userProfile?.aiTicketMonthlyReset ? format(addMonths(startOfMonth(userProfile.aiTicketMonthlyReset.toDate()), 1), "d MMMM", { locale: fr }) : 'prochain mois';


    const renderSkeleton = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    );

    const hasAiTickets = totalAiTickets > 0;


    return (
        <TooltipProvider>
            {isSelectionMode && (
                <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-sm -mx-6 mb-4 px-6 py-3 border-b flex items-center justify-between">
                    <span className="font-semibold text-sm">{selectedImages.size} image(s) sélectionnée(s)</span>
                    <div className="flex items-center gap-2">
                         <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => openAddToGalleryDialog(null)}
                            disabled={selectedImages.size === 0}
                        >
                            <CopyPlus className="mr-2 h-4 w-4"/>
                            Ajouter à
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowMultiDeleteAlert(true)}
                            disabled={selectedImages.size === 0}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleToggleSelectionMode}
                        >
                           <X className="mr-2 h-4 w-4"/> Annuler
                        </Button>
                    </div>
                </div>
            )}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Mes images</CardTitle>
                        <CardDescription>
                            Voici la liste de vos images téléversées ou ajoutées par URL.
                        </CardDescription>
                    </div>
                    {images && images.length > 0 && (
                        <Button variant="outline" onClick={handleToggleSelectionMode} disabled={isSelectionMode}>
                            <BoxSelect className="mr-2 h-4 w-4"/> Sélectionner
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading && renderSkeleton()}

                    {!isLoading && (!sortedImages || sortedImages.length === 0) && (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                            <ImageIcon className="h-12 w-12 mb-4" />
                            <p className="font-medium">Aucune image pour le moment.</p>
                            <p className="text-sm">Utilisez le module ci-dessus pour en ajouter une.</p>
                        </div>
                    )}
                    
                    {!isLoading && sortedImages && sortedImages.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {sortedImages.map(image => {
                                const isPinned = userProfile?.pinnedImageIds?.includes(image.id) ?? false;
                                return (
                                <div 
                                    key={image.id}
                                    onClick={() => isSelectionMode && toggleImageSelection(image.id)}
                                    className={cn(
                                        "group relative aspect-[4/5] w-full overflow-hidden rounded-lg border flex flex-col transition-all",
                                        isSelectionMode && "cursor-pointer",
                                        selectedImages.has(image.id) && "ring-2 ring-primary ring-offset-2"
                                    )}
                                >
                                    {isSelectionMode ? (
                                        <div className="absolute top-2 left-2 z-10 bg-background rounded-full p-1 border">
                                            <div className={cn(
                                                "w-4 h-4 rounded-sm border-2 border-primary transition-colors",
                                                selectedImages.has(image.id) && "bg-primary"
                                            )}>
                                                {selectedImages.has(image.id) && <Check className="w-3.5 h-3.5 text-primary-foreground"/>}
                                            </div>
                                        </div>
                                    ) : (
                                        isPinned && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1.5 border-2 border-primary">
                                                        <Pin className="w-3 h-3 text-primary"/>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Épinglée globalement</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )
                                    )}
                                    <div className="relative aspect-square w-full">
                                        <Image
                                            src={image.directUrl}
                                            alt={image.originalName || 'Image téléversée'}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                                            className={cn(
                                                "object-cover bg-muted transition-transform",
                                                !isSelectionMode && "group-hover:scale-105"
                                            )}
                                            unoptimized // Important pour les Data URLs et celles de Storage
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                        {!isSelectionMode && (
                                            <div className="absolute top-2 right-2 z-10 flex gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="secondary"
                                                            size="icon"
                                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <MoreHorizontal size={16} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleToggleGlobalPin(image)}>
                                                            {isPinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                                                            <span>{isPinned ? 'Désépingler' : 'Épingler'}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/edit/${image.id}`}>
                                                                <Sparkles className="mr-2 h-4 w-4" />
                                                                <span>Éditer avec l'IA</span>
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openEditDialog(image)}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            <span>Modifier la description</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openAddToGalleryDialog(image)}>
                                                            <CopyPlus className="mr-2 h-4 w-4" />
                                                            <span>Ajouter à la galerie</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/image/${image.id}`}>
                                                                <Share2 className="mr-2 h-4 w-4" />
                                                                <span>Détails et Partage</span>
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDownload(image)} disabled={isDownloading === image.id}>
                                                            {isDownloading === image.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                            <span>Télécharger</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openDeleteDialog(image)} disabled={isDeleting === image.id} className="text-red-500 focus:text-red-500">
                                                            {isDeleting === image.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                                            <span>Supprimer</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                            <p 
                                            className="text-sm font-semibold truncate"
                                            title={image.originalName}
                                            >
                                                {image.originalName || 'Image depuis URL'}
                                            </p>
                                            {image.uploadTimestamp && (
                                                <p className="text-xs opacity-80">
                                                    {formatDistanceToNow(image.uploadTimestamp.toDate(), { addSuffix: true, locale: fr })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-card flex-grow flex flex-col gap-1">
                                        {image.title && (
                                            <p className="font-semibold text-sm line-clamp-2">{image.title}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                                            {image.description || (image.title ? '' : 'Aucune description.')}
                                        </p>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. L'image sera définitivement supprimée de votre galerie.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteImage} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={showMultiDeleteAlert} onOpenChange={setShowMultiDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer {selectedImages.size} image(s) ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Les images sélectionnées seront définitivement supprimées de votre compte.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting === 'multi'}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMultiDelete} disabled={isDeleting === 'multi'} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting === 'multi' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                    <DialogTitle>Modifier et Générer</DialogTitle>
                    <DialogDescription>
                        Laissez l'IA générer un contenu optimisé pour vos réseaux sociaux.
                    </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        
                        <div className="space-y-2">
                            <Label htmlFor="title">Titre (généré par IA)</Label>
                            <Input 
                                id="title"
                                placeholder="Titre accrocheur généré par l'IA..."
                                value={currentTitle}
                                onChange={(e) => setCurrentTitle(e.target.value)}
                                disabled={isGeneratingDescription || isSavingDescription}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea 
                                id="description"
                                placeholder="La description de votre image apparaîtra ici..."
                                value={currentDescription}
                                onChange={(e) => setCurrentDescription(e.target.value)}
                                rows={4}
                                disabled={isGeneratingDescription || isSavingDescription}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="hashtags">Hashtags (générés par IA)</Label>
                            <Textarea 
                                id="hashtags"
                                placeholder="#hashtags #générés #apparaîtront #ici"
                                value={hashtagsString}
                                onChange={(e) => setHashtagsString(e.target.value)}
                                rows={2}
                                disabled={isGeneratingDescription || isSavingDescription}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                             <div className="flex items-center justify-between">
                                <Label>Génération par IA</Label>
                                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                    <Ticket className="h-4 w-4" />
                                    <span>{totalAiTickets} restants</span>
                                </div>
                            </div>
                            {monthlyLimitReached ? (
                                <p className="text-center text-sm text-primary font-semibold">
                                    Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}.
                                </p>
                            ) : (
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild disabled={isGeneratingDescription || isSavingDescription || !hasAiTickets}>
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full"
                                                    aria-label="Générer avec l'IA"
                                                >
                                                    {isGeneratingDescription ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                    ) : (
                                                        <Wand2 className="mr-2 h-4 w-4"/>
                                                    )}
                                                    {isGeneratingDescription ? 'Génération...' : 'Générer avec l\'IA pour...'}
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        {!hasAiTickets && (
                                             <TooltipContent>
                                                <Link href="/shop">
                                                    <p className="cursor-pointer font-semibold text-primary flex items-center gap-2">
                                                        <ShoppingCart className="mr-2 h-4 w-4" />
                                                        Rechargez dans la boutique !
                                                    </p>
                                                </Link>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                    <DropdownMenuContent className="w-56">
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('instagram')}>
                                            <Instagram className="mr-2 h-4 w-4" />
                                            <span>Instagram</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('facebook')}>
                                            <Facebook className="mr-2 h-4 w-4" />
                                            <span>Facebook</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('x')}>
                                            <MessageSquare className="mr-2 h-4 w-4" />
                                            <span>X (Twitter)</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('tiktok')}>
                                            <VenetianMask className="mr-2 h-4 w-4" />
                                            <span>TikTok</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('generic')}>
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            <span>Générique</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowEditDialog(false)} disabled={isSavingDescription}>Annuler</Button>
                        <Button onClick={handleSaveDescription} disabled={isSavingDescription || isGeneratingDescription}>
                            {isSavingDescription && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showAddToGalleryDialog} onOpenChange={setShowAddToGalleryDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajouter à des galeries</DialogTitle>
                        <DialogDescription>
                            Sélectionnez les galeries dans lesquelles vous souhaitez inclure cette image (ou ces images).
                        </DialogDescription>
                    </DialogHeader>

                     <div className="flex items-center space-x-2 pt-4">
                        <Input 
                            id="new-gallery" 
                            placeholder="Nom de la nouvelle galerie..."
                            value={newGalleryName}
                            onChange={(e) => setNewGalleryName(e.target.value)}
                            disabled={isCreatingGallery}
                        />
                        <Button onClick={handleCreateGalleryOnTheFly} disabled={!newGalleryName.trim() || isCreatingGallery}>
                            {isCreatingGallery ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                            <span className="ml-2 hidden sm:inline">Créer</span>
                        </Button>
                    </div>
                    <Separator/>

                    <div className="py-2 space-y-4">
                        {galleries && galleries.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {galleries.map(gallery => (
                                    <div key={gallery.id} className="flex items-center space-x-3 rounded-md p-2 hover:bg-muted/50">
                                        <Checkbox
                                            id={`gallery-${gallery.id}`}
                                            checked={selectedGalleries.has(gallery.id)}
                                            onCheckedChange={() => handleGallerySelectionChange(gallery.id)}
                                        />
                                        <label
                                            htmlFor={`gallery-${gallery.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                        >
                                            {gallery.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-center text-muted-foreground py-4">
                                Aucune galerie créée pour le moment. Utilisez le champ ci-dessus pour en créer une.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowAddToGalleryDialog(false)}>Annuler</Button>
                        <Button onClick={handleSaveToGalleries} disabled={isSavingToGallery || selectedGalleries.size === 0}>
                             {isSavingToGallery && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </TooltipProvider>
    );
}

    

    




