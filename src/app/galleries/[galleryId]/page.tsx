
'use client';

import { useUser, useFirestore } from '@/firebase';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { type Gallery, type ImageMetadata, getImagesForGallery, removeImagesFromGallery } from '@/lib/firestore';
import { Loader2, ArrowLeft, Image as ImageIcon, Select, Trash2, X, Check } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

export default function GalleryDetailPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const galleryId = params.galleryId as string;
    const { toast } = useToast();

    const [gallery, setGallery] = useState<Gallery | null>(null);
    const [images, setImages] = useState<ImageMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    const fetchGalleryData = async () => {
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
    };

    useEffect(() => {
        fetchGalleryData();
    }, [user, firestore, galleryId]);

    const toggleSelection = (imageId: string) => {
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

    const handleRemoveImages = async () => {
        if (!user || !firestore || selectedImages.size === 0) return;
        setIsDeleting(true);
        try {
            await removeImagesFromGallery(firestore, user.uid, galleryId, Array.from(selectedImages));
            toast({
                title: 'Images retirées',
                description: `${selectedImages.size} image(s) ont été retirée(s) de la galerie.`
            });
            // Re-fetch data to update the view
            await fetchGalleryData();
            setIsSelectionMode(false);
            setSelectedImages(new Set());
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de retirer les images.' });
        } finally {
            setIsDeleting(false);
            setShowDeleteAlert(false);
        }
    };

    const handleToggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedImages(new Set());
    }

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
                            <Button variant="outline" onClick={handleToggleSelectionMode}>
                                {isSelectionMode ? <X className="mr-2 h-4 w-4"/> : <Select className="mr-2 h-4 w-4"/>}
                                {isSelectionMode ? 'Annuler' : 'Sélectionner'}
                           </Button>
                       )}
                    </CardHeader>
                    <CardContent>
                        {isSelectionMode && (
                             <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-sm -mx-6 mb-4 px-6 py-3 border-b flex items-center justify-between">
                                <span className="font-semibold text-sm">{selectedImages.size} image(s) sélectionnée(s)</span>
                                <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => setShowDeleteAlert(true)}
                                    disabled={selectedImages.size === 0}
                                >
                                    <Trash2 className="mr-2 h-4 w-4"/>
                                    Retirer
                                </Button>
                            </div>
                        )}
                        {images.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map(image => (
                                     <div 
                                        key={image.id}
                                        onClick={() => isSelectionMode && toggleSelection(image.id)}
                                        className={cn(
                                            "group relative aspect-[4/5] w-full overflow-hidden rounded-lg border flex flex-col transition-all",
                                            isSelectionMode && "cursor-pointer",
                                            selectedImages.has(image.id) && "ring-2 ring-primary ring-offset-2"
                                        )}
                                    >
                                        {isSelectionMode && (
                                            <div className="absolute top-2 left-2 z-10 bg-background rounded-full p-1 border">
                                                <div className={cn(
                                                    "w-4 h-4 rounded-sm border-2 border-primary transition-colors",
                                                    selectedImages.has(image.id) && "bg-primary"
                                                )}>
                                                    {selectedImages.has(image.id) && <Check className="w-3.5 h-3.5 text-primary-foreground"/>}
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
                                                    !isSelectionMode && "group-hover:scale-105"
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
                                <p className="mt-2 text-sm text-muted-foreground">Ajoutez des images depuis votre bibliothèque principale pour les voir ici.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Retirer {selectedImages.size} image(s) ?</AlertDialogTitle>
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

        </div>
    );
}
