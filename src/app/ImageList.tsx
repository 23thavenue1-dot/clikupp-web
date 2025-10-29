
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type ImageMetadata } from '@/lib/firestore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ImageIcon } from 'lucide-react';

export function ImageList() {
    const { user } = useUser();
    const firestore = useFirestore();

    const imagesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Query the 'images' subcollection for the current user, order by upload time
        return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
    }, [user, firestore]);

    const { data: images, isLoading } = useCollection<ImageMetadata>(imagesQuery);

    const renderSkeleton = () => (
        <div className="space-y-4">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-24 w-24 rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <Skeleton className="h-24 w-24 rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mes images</CardTitle>
                <CardDescription>
                    Voici la liste de vos images téléversées ou ajoutées par URL.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && renderSkeleton()}

                {!isLoading && (!images || images.length === 0) && (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                        <ImageIcon className="h-12 w-12 mb-4" />
                        <p className="font-medium">Aucune image pour le moment.</p>
                        <p className="text-sm">Utilisez le module ci-dessus pour en ajouter une.</p>
                    </div>
                )}
                
                {!isLoading && images && images.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {images.map(image => (
                            <div key={image.id} className="group relative aspect-square w-full overflow-hidden rounded-lg border">
                               <Image
                                    src={image.directUrl}
                                    alt={image.originalName || 'Image téléversée'}
                                    layout="fill"
                                    objectFit="cover"
                                    className="bg-muted transition-transform group-hover:scale-105"
                                    unoptimized // Important pour les URL externes et celles de Storage
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                    <p 
                                      className="text-sm font-semibold truncate"
                                      title={image.originalName}
                                    >
                                        {image.originalName}
                                    </p>
                                    {image.uploadTimestamp && (
                                        <p className="text-xs opacity-80">
                                            {formatDistanceToNow(image.uploadTimestamp.toDate(), { addSuffix: true, locale: fr })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
