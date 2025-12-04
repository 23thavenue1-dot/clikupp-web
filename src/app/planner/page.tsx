'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Edit, FileText, Clock, Trash2, MoreHorizontal, Share2, Facebook, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ScheduledPost } from '@/lib/firestore';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useStorage } from '@/firebase'; 
import { getDownloadURL, ref } from 'firebase/storage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FirebaseStorage } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { deleteScheduledPost } from '@/lib/firestore';
import { withErrorHandling } from '@/lib/async-wrapper';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';


function ShareDialog({ post, imageUrl }: { post: ScheduledPost, imageUrl: string | null }) {
    if (!imageUrl) return null;

    const fullText = `${post.title}\n\n${post.description}`.trim();
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(imageUrl)}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Partager maintenant</DialogTitle>
                <DialogDescription>
                    Choisissez une plateforme pour partager votre post. Le texte et le lien de l'image seront préparés pour vous.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button asChild variant="outline" className="h-12 border-[#1877F2] text-[#1877F2] hover:bg-[#1877F2]/10 hover:text-[#1877F2]">
                    <a href={facebookShareUrl} target="_blank" rel="noopener noreferrer">
                        <Facebook className="mr-2 h-5 w-5 fill-current" />
                        Partager sur Facebook
                    </a>
                </Button>
                <Button asChild variant="outline" className="h-12 border-[#1DA1F2] text-[#1DA1F2] hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2]">
                    <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Partager sur X (Twitter)
                    </a>
                </Button>
            </div>
             <p className="text-xs text-muted-foreground text-center">
                Note : Vous devrez peut-être ajouter l'image manuellement sur le réseau social.
            </p>
        </DialogContent>
    );
}


function PostCard({ post, storage, onDelete }: { post: ScheduledPost, storage: FirebaseStorage | null, onDelete: (post: ScheduledPost) => void }) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const router = useRouter();

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

    const handleEdit = () => {
        if (post.auditId) {
            router.push(`/audit/resultats/${post.auditId}`);
        }
    };

    return (
        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
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
                                <DropdownMenuItem onClick={() => setIsShareOpen(true)}>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Partager maintenant
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleEdit} disabled={!post.auditId}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(post)} className="text-destructive focus:text-destructive">
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
            <ShareDialog post={post} imageUrl={imageUrl} />
        </Dialog>
    );
}


export default function PlannerPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const router = useRouter();
    const { toast } = useToast();

    const [postToDelete, setPostToDelete] = useState<ScheduledPost | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const postsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/scheduledPosts`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);

    const { data: posts, isLoading, refetch } = useCollection<ScheduledPost>(postsQuery);

    const scheduledPosts = posts?.filter(p => p.status === 'scheduled') || [];
    const draftPosts = posts?.filter(p => p.status === 'draft') || [];

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login?redirect=/planner');
        }
    }, [user, isUserLoading, router]);

    const handleDelete = async () => {
        if (!user || !storage || !firestore || !postToDelete) return;
        setIsDeleting(true);
        const { error } = await withErrorHandling(() => 
            deleteScheduledPost(firestore, storage, user.uid, postToDelete)
        );
        
        if (!error) {
            toast({ title: "Post supprimé", description: "Le post a bien été supprimé de votre planificateur." });
            refetch(); // Rafraîchir les données
        }
        setIsDeleting(false);
        setPostToDelete(null);
    };

    if (isUserLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <>
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
                                        {scheduledPosts.map(post => <PostCard key={post.id} post={post} storage={storage} onDelete={setPostToDelete} />)}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">Aucune publication programmée pour le moment.</p>
                                )}
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold mb-4">Brouillons ({draftPosts.length})</h2>
                                {draftPosts.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {draftPosts.map(post => <PostCard key={post.id} post={post} storage={storage} onDelete={setPostToDelete} />)}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">Aucun brouillon sauvegardé.</p>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce post ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Le post et son image associée seront définitivement supprimés si l'image n'est pas utilisée ailleurs.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
