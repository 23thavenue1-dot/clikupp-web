
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Edit, FileText, Clock, Trash2, MoreHorizontal } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ScheduledPost } from '@/lib/firestore';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useFirebase } from '@/firebase'; // Import useFirebase pour le storage
import { getDownloadURL, ref } from 'firebase/storage';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function PostCard({ post }: { post: ScheduledPost }) {
    const { storage } = useFirebase();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);

    useEffect(() => {
        if (storage && post.imageStoragePath) {
            const imageRef = ref(storage, post.imageStoragePath);
            getDownloadURL(imageRef)
                .then(url => {
                    setImageUrl(url);
                })
                .catch(error => {
                    console.error("Erreur de chargement de l'image du post:", error);
                    setImageUrl(null);
                })
                .finally(() => {
                    setIsImageLoading(false);
                });
        } else {
            setIsImageLoading(false);
        }
    }, [storage, post.imageStoragePath]);

    const isScheduled = post.status === 'scheduled' && post.scheduledAt;

    return (
        <Card className="flex flex-col overflow-hidden transition-all hover:shadow-md">
            <div className="relative aspect-video bg-muted">
                {isImageLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : imageUrl ? (
                    <Image src={imageUrl} alt={post.title} fill className="object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <FileText className="h-8 w-8" />
                    </div>
                )}
            </div>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <Badge variant={isScheduled ? "default" : "secondary"} className={cn(isScheduled && "bg-blue-600 text-white")}>
                        {isScheduled ? 'Programmé' : 'Brouillon'}
                    </Badge>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardTitle className="mt-2 text-lg">{post.title}</CardTitle>
                {isScheduled && (
                    <CardDescription className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4" />
                        Pour le {format(post.scheduledAt.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.description}
                </p>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
                Créé {formatDistanceToNow(post.createdAt.toDate(), { locale: fr, addSuffix: true })}
            </CardFooter>
        </Card>
    );
}


export default function PlannerPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const postsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/scheduledPosts`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);

    const { data: posts, isLoading } = useCollection<ScheduledPost>(postsQuery);

    const scheduledPosts = posts?.filter(p => p.status === 'scheduled') || [];
    const draftPosts = posts?.filter(p => p.status === 'draft') || [];

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login?redirect=/planner');
        }
    }, [user, isUserLoading, router]);

    if (isUserLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-6xl mx-auto space-y-8">
                <header>
                    <h1 className="text-3xl font-bold tracking-tight">Planificateur de Contenu</h1>
                    <p className="text-muted-foreground mt-1">Gérez vos brouillons et vos publications programmées.</p>
                </header>

                {!posts || posts.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-semibold">Votre planificateur est vide</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Générez des images avec le Coach Stratégique et sauvegardez-les en tant que brouillons ou programmez-les.
                        </p>
                        <Button asChild className="mt-4">
                            <Link href="/audit">Aller au Coach Stratégique</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-12">
                        <section>
                            <h2 className="text-2xl font-semibold mb-4">Publications Programmées ({scheduledPosts.length})</h2>
                            {scheduledPosts.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {scheduledPosts.map(post => <PostCard key={post.id} post={post} />)}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Aucune publication programmée pour le moment.</p>
                            )}
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">Brouillons ({draftPosts.length})</h2>
                            {draftPosts.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {draftPosts.map(post => <PostCard key={post.id} post={post} />)}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Aucun brouillon sauvegardé.</p>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
