
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, getDoc, query, collection, orderBy } from 'firebase/firestore';
import { type Gallery, type ImageMetadata, getImagesForGallery, removeImagesFromGallery, addImageToGallery, deleteImageMetadata, updateImageDescription, decrementAiTicketCount, toggleImageInGallery, createGallery, addMultipleImagesToGalleries, saveImageMetadata, type UserProfile } from '@/lib/firestore';
import { Loader2, ArrowLeft, Image as ImageIcon, BoxSelect, Trash2, X, Check, PlusCircle, Settings, MoreHorizontal, Sparkles, Pencil, Eye, Download, CopyPlus, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';


export default function GalleryDetailPage() {
    const { user, isUserLoading, firebaseApp } = useFirebase();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const galleryId = params.galleryId as string;
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [gallery, setGallery] = useState<Gallery | null>(null);
    const [images, setImages] = useState<ImageMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isManageMode, setIsManageMode] = useState(false);
    const [isRemoveSelectionMode, setIsRemoveSelectionMode] = useState(false);
    const [selectedImagesForRemoval, setSelectedImagesForRemoval] = useState<Set<string>>(new Set());
    
    const [isAddImagesDialogOpen, setIsAddImagesDialogOpen] = useState(false);
    const [selectedImagesForAddition, setSelectedImagesForAddition] = useState<Set<string>>(new Set());
    const [isAdding, setIsAdding] = useState(false);

    // États copiés depuis ImageList.tsx
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<ImageMetadata | null>(null);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);
    
    // Hook pour récupérer toutes les images de l'utilisateur
    const allUserImagesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
    }, [user, firestore]);
    const { data: allUserImages, isLoading: areAllImagesLoading } = useCollection<ImageMetadata>(allUserImagesQuery);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    const fetchGalleryData = useCallback(async () => {
        if (!user || !firestore || !galleryId) return;
        setIsLoading(true);
        try {
            const galleryDocRef = doc(firestore, `users/${user.uid}/galleries/${galleryId}`);
            const gallerySnap = await getDoc(galleryDocRef);

            if (gallerySnap.exists()) {
                const galleryData = gallerySnap.data() as Gallery;
                setGallery(galleryData);
                
                if (galleryData.imageIds.length > 0) {
                    const galleryImages = await getImagesForGallery(firestore, user.uid, galleryData.imageIds);
                    setImages(galleryImages);
                } else {
                    setImages([]);
                }
            } else {
                toast({ variant: 'destructive', title: 'Erreur', description: 'Galerie introuvable.' });
                router.push('/galleries');
            }
        } catch (error) {
            console.error("Erreur lors de la récupération de la galerie:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les données de la galerie.' });
        } finally {
            setIsLoading(false);
        }
    }, [user, firestore, galleryId, toast, router]);

    useEffect(() => {
        fetchGalleryData();
    }, [fetchGalleryData]);

    const toggleRemovalSelection = (imageId: string) => {
        setSelectedImagesForRemoval(prev => {
            const newSet = new Set(prev);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                newSet.add(imageId);
            }
            return newSet;
        });
    };
    
    const toggleAdditionSelection = (imageId: string) => {
        setSelectedImagesForAddition(prev => {
            const newSet = new Set(prev);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                newSet.add(imageId);
            }
            return newSet;
        });
    };

    const handleRemoveImages = async () => {
        if (!user || !firestore || selectedImagesForRemoval.size === 0) return;
        setIsDeleting(true);
        try {
            await removeImagesFromGallery(firestore, user.uid, galleryId, Array.from(selectedImagesForRemoval));
            toast({
                title: 'Images retirées',
                description: `${selectedImagesForRemoval.size} image(s) ont été retirée(s) de la galerie.`
            });
            await fetchGalleryData(); // Recharger les données
            cancelManagement(); // Quitter le mode gestion
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de retirer les images.' });
        } finally {
            setIsDeleting(false);
            setShowDeleteAlert(false);
        }
    };
    
    const handleAddImages = async () => {
        if (!user || !firestore || selectedImagesForAddition.size === 0) return;
        setIsAdding(true);
        try {
            const addPromises = Array.from(selectedImagesForAddition).map(imageId => 
                addImageToGallery(firestore, user.uid, imageId, galleryId)
            );
            await Promise.all(addPromises);
            toast({
                title: 'Images ajoutées',
                description: `${selectedImagesForAddition.size} image(s) ont été ajoutée(s) à la galerie.`
            });
            await fetchGalleryData(); // Recharger
            cancelManagement();
            setIsAddImagesDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'ajouter les images.' });
        } finally {
            setIsAdding(false);
        }
    };
    
    const cancelManagement = () => {
        setIsManageMode(false);
        setIsRemoveSelectionMode(false);
        setSelectedImagesForRemoval(new Set());
        setSelectedImagesForAddition(new Set());
    };
    
    const imagesNotInGallery = useMemo(() => {
        if (!allUserImages || !gallery) return [];
        const galleryImageIds = new Set(gallery.imageIds);
        return allUserImages.filter(img => !galleryImageIds.has(img.id));
    }, [allUserImages, gallery]);

    // --- Fonctions copiées depuis ImageList.tsx ---
    const openDeleteDialog = (image: ImageMetadata) => {
        setImageToDelete(image);
        setShowDeleteAlert(true);
    };

    const handleDeleteImage = async () => {
        if (!imageToDelete || !user || !firestore) return;
        
        setIsDeleting(imageToDelete.id);

        try {
            await deleteImageMetadata(firestore, user.uid, imageToDelete.id);
            toast({ title: "Image supprimée", description: "L'image a été supprimée avec succès de votre bibliothèque." });
            await fetchGalleryData(); // Recharger les données pour que l'image disparaisse
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
    
    // Pour l'instant, on ne met que les fonctions de suppression et de téléchargement.
    // Celles pour l'édition et l'ajout aux galeries seront dans les étapes suivantes.

    if (isUserLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-5xl mx-auto space-y-8">
                <header className="space-y-2">
                    <Button variant="ghost" asChild className="mb-4 -ml-4">
                        <Link href="/galleries">
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Retour aux galeries
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">{gallery?.name}</h1>
                    <p className="text-muted-foreground">{gallery?.description || 'Aucune description'}</p>
                </header>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                       <div>
                            <CardTitle>Images de la galerie</CardTitle>
                            <CardDescription>
                                {images.length} image{images.length !== 1 ? 's' : ''} dans cette galerie.
                            </CardDescription>
                       </div>
                       {images.length > 0 && (
                            <Button variant="outline" onClick={() => setIsManageMode(!isManageMode)}>
                                {isManageMode ? <X className="mr-2 h-4 w-4"/> : <Settings className="mr-2 h-4 w-4"/>}
                                {isManageMode ? 'Annuler' : 'Gérer la galerie'}
                           </Button>
                       )}
                    </CardHeader>
                    <CardContent>
                        {isManageMode && (
                             <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-sm -mx-6 mb-4 px-6 py-3 border-b flex items-center justify-between gap-2">
                                {isRemoveSelectionMode ? (
                                    <>
                                        <span className="font-semibold text-sm">{selectedImagesForRemoval.size} image(s) sélectionnée(s)</span>
                                        <div className="flex gap-2">
                                             <Button 
                                                variant="destructive" 
                                                size="sm"
                                                onClick={() => setShowDeleteAlert(true)}
                                                disabled={selectedImagesForRemoval.size === 0}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4"/>
                                                Retirer
                                            </Button>
                                            <Button variant="secondary" size="sm" onClick={() => setIsRemoveSelectionMode(false)}>
                                                Terminer
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="font-semibold text-sm">Mode Gestion</span>
                                        <div className="flex gap-2">
                                             <Button 
                                                variant="default" 
                                                size="sm"
                                                onClick={() => setIsAddImagesDialogOpen(true)}
                                            >
                                                <PlusCircle className="mr-2 h-4 w-4"/>
                                                Ajouter des images
                                            </Button>
                                            <Button 
                                                variant="destructive" 
                                                size="sm"
                                                onClick={() => setIsRemoveSelectionMode(true)}
                                                disabled={images.length === 0}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4"/>
                                                Retirer des images
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {images.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map(image => (
                                     <div 
                                        key={image.id}
                                        onClick={() => isRemoveSelectionMode && toggleRemovalSelection(image.id)}
                                        className={cn(
                                            "group relative aspect-[4/5] w-full overflow-hidden rounded-lg border flex flex-col transition-all",
                                            isRemoveSelectionMode && "cursor-pointer",
                                            selectedImagesForRemoval.has(image.id) && "ring-2 ring-primary ring-offset-2"
                                        )}
                                    >
                                        {isRemoveSelectionMode && (
                                            <div className="absolute top-2 left-2 z-10 bg-background rounded-full p-1 border">
                                                <div className={cn(
                                                    "w-4 h-4 rounded-sm border-2 border-primary transition-colors",
                                                    selectedImagesForRemoval.has(image.id) && "bg-primary"
                                                )}>
                                                    {selectedImagesForRemoval.has(image.id) && <Check className="w-3.5 h-3.5 text-primary-foreground"/>}
                                                </div>
                                            </div>
                                        )}
                                         <div className="relative aspect-square w-full">
                                            <Image
                                                src={image.directUrl}
                                                alt={image.originalName || 'Image téléversée'}
                                                fill
                                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                                                className={cn(
                                                    "object-cover bg-muted transition-transform",
                                                    !isRemoveSelectionMode && "group-hover:scale-105"
                                                )}
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
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
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">Galerie Vide</h3>
                                <p className="mt-2 text-sm text-muted-foreground">Utilisez le bouton "Gérer la galerie" pour y ajouter des images depuis votre bibliothèque.</p>
                                <Button onClick={() => setIsManageMode(true)} className="mt-4">
                                    Commencer à gérer
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Retirer {selectedImagesForRemoval.size} image(s) ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Les images sélectionnées seront retirées de cette galerie, mais elles resteront dans votre bibliothèque principale.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveImages} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Retirer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={isAddImagesDialogOpen} onOpenChange={setIsAddImagesDialogOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Ajouter des images à "{gallery?.name}"</DialogTitle>
                        <DialogDescription>
                            Sélectionnez les images de votre bibliothèque à ajouter à cette galerie.
                        </DialogDescription>
                    </DialogHeader>
                    <Separator/>
                    <div className="flex-grow overflow-y-auto -mx-6 px-6">
                        {areAllImagesLoading ? (
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                                {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-muted rounded-md animate-pulse"></div>)}
                            </div>
                        ) : imagesNotInGallery.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                                {imagesNotInGallery.map(image => (
                                    <div 
                                        key={image.id}
                                        onClick={() => toggleAdditionSelection(image.id)}
                                        className={cn("relative aspect-square rounded-lg overflow-hidden cursor-pointer group", selectedImagesForAddition.has(image.id) && "ring-2 ring-primary ring-offset-2")}
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
                                        <div className="absolute top-2 left-2 z-10 bg-background rounded-full p-1 border">
                                            <div className={cn(
                                                "w-4 h-4 rounded-sm border-2 border-primary transition-colors",
                                                selectedImagesForAddition.has(image.id) && "bg-primary"
                                            )}>
                                                {selectedImagesForAddition.has(image.id) && <Check className="w-3.5 h-3.5 text-primary-foreground"/>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                                <ImageIcon className="h-12 w-12 mb-4" />
                                <p className="font-medium">Toutes vos images sont déjà ici.</p>
                                <p className="text-sm">Aucune nouvelle image à ajouter.</p>
                            </div>
                        )}
                    </div>
                     <Separator/>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Annuler</Button>
                        </DialogClose>
                        <Button
                            onClick={handleAddImages}
                            disabled={isAdding || selectedImagesForAddition.size === 0}
                        >
                             {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Ajouter {selectedImagesForAddition.size > 0 ? `${selectedImagesForAddition.size} image(s)` : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );

    
