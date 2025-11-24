
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useUser } from '@/firebase';
import { type Gallery, type ImageMetadata, deleteGallery } from '@/lib/firestore';
import { getDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ImageIcon, MoreHorizontal, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GalleryCardProps {
    gallery: Gallery;
}

export function GalleryCard({ gallery }: GalleryCardProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(true);
    const [galleryToDelete, setGalleryToDelete] = useState<Gallery | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchCoverImage = async () => {
            if (!user || !firestore || gallery.imageIds.length === 0) {
                setIsLoadingImage(false);
                return;
            }
            
            setIsLoadingImage(true);
            const firstImageId = gallery.imageIds[0];
            const imageDocRef = doc(firestore, `users/${user.uid}/images`, firstImageId);
            
            try {
                const imageDocSnap = await getDoc(imageDocRef);
                if (imageDocSnap.exists()) {
                    setCoverImageUrl((imageDocSnap.data() as ImageMetadata).directUrl);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération de l'image de couverture:", error);
            } finally {
                setIsLoadingImage(false);
            }
        };

        fetchCoverImage();
    }, [gallery, user, firestore]);

    const handleDeleteGallery = async () => {
        if (!user || !firestore || !galleryToDelete) return;
        setIsDeleting(true);
        try {
            await deleteGallery(firestore, user.uid, galleryToDelete.id);
            toast({ title: 'Galerie supprimée', description: `La galerie "${galleryToDelete.name}" a été supprimée.` });
            setGalleryToDelete(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer la galerie.' });
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <>
            <Card 
                key={gallery.id} 
                className={cn(
                    "flex flex-col transition-all duration-200 ease-out",
                    "hover:shadow-xl hover:border-primary hover:-translate-y-0.5"
                )}
            >
                <Link href={`/galleries/${gallery.id}`} className="block hover:bg-muted/30 transition-colors rounded-t-lg flex-grow">
                    <CardHeader>
                        <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                            {isLoadingImage ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50"/>
                            ) : coverImageUrl ? (
                                <Image
                                    src={coverImageUrl}
                                    alt={`Aperçu pour ${gallery.name}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    className="object-cover"
                                    unoptimized
                                />
                            ) : (
                                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <CardTitle className="text-lg">{gallery.name}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">{gallery.description || 'Aucune description'}</CardDescription>
                    </CardContent>
                </Link>
                <CardFooter className="flex justify-between items-center text-xs text-muted-foreground mt-auto pt-4 border-t">
                    <span>{gallery.imageIds.length} image{gallery.imageIds.length === 1 ? '' : 's'}</span>
                    {gallery.createdAt && <span>{formatDistanceToNow(gallery.createdAt.toDate(), { addSuffix: true, locale: fr })}</span>}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setGalleryToDelete(gallery)} className="text-red-500 focus:text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardFooter>
            </Card>

            <AlertDialog open={!!galleryToDelete} onOpenChange={(open) => !open && setGalleryToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer la galerie "{galleryToDelete?.name}" ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Les images de la galerie ne seront pas supprimées de votre bibliothèque, mais la galerie elle-même le sera.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteGallery} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
