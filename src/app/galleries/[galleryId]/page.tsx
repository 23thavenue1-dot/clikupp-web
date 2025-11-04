
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { type Gallery, type ImageMetadata, getImagesForGallery } from '@/lib/firestore';
import { Loader2, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function GalleryDetailPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const galleryId = params.galleryId as string;

    const [gallery, setGallery] = useState<Gallery | null>(null);
    const [images, setImages] = useState<ImageMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    useEffect(() => {
        if (!user || !firestore || !galleryId) return;

        const fetchGalleryData = async () => {
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
                    // Gérer le cas où la galerie n'existe pas, peut-être rediriger
                    router.push('/galleries');
                }
            } catch (error) {
                console.error("Erreur lors de la récupération de la galerie:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchGalleryData();
    }, [user, firestore, galleryId, router]);


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
                    <CardHeader>
                        <CardTitle>Images de la galerie</CardTitle>
                        <CardDescription>
                            {images.length} image{images.length > 1 ? 's' : ''} dans cette galerie.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {images.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map(image => (
                                     <div key={image.id} className="group relative aspect-[4/5] w-full overflow-hidden rounded-lg border flex flex-col">
                                         <div className="relative aspect-square w-full">
                                            <Image
                                                src={image.directUrl}
                                                alt={image.originalName || 'Image téléversée'}
                                                fill
                                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                                                className="object-cover bg-muted transition-transform group-hover:scale-105"
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
                                <p className="mt-2 text-sm text-muted-foreground">Ajoutez des images depuis votre galerie principale pour les voir ici.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

