
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, PlusCircle, Image as ImageIcon, Trash2, MoreHorizontal } from 'lucide-react';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type Gallery, createGallery, deleteGallery } from '@/lib/firestore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';

export default function GalleriesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [newGalleryDescription, setNewGalleryDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [galleryToDelete, setGalleryToDelete] = useState<Gallery | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const galleriesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/galleries`), orderBy('createdAt', 'desc'));
  }, [user, firestore]);

  const { data: galleries, isLoading: areGalleriesLoading } = useCollection<Gallery>(galleriesQuery);

  const handleCreateGallery = async () => {
    if (!user || !firestore || !newGalleryName.trim()) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Le nom de la galerie est obligatoire.' });
        return;
    }
    setIsSaving(true);
    try {
        await createGallery(firestore, user.uid, newGalleryName, newGalleryDescription);
        toast({ title: 'Galerie créée', description: `La galerie "${newGalleryName}" a été créée.` });
        setNewGalleryName('');
        setNewGalleryDescription('');
        setIsCreateDialogOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de créer la galerie.' });
    } finally {
        setIsSaving(false);
    }
  };

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

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes Galeries</h1>
            <p className="text-muted-foreground mt-1">Organisez vos images dans des galeries personnalisées.</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Créer une galerie
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Créer une nouvelle galerie</DialogTitle>
                    <DialogDescription>Donnez un nom et une description à votre nouvelle galerie.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="gallery-name">Nom</Label>
                        <Input id="gallery-name" value={newGalleryName} onChange={(e) => setNewGalleryName(e.target.value)} placeholder="Ex: Voyage au Japon" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="gallery-description">Description</Label>
                        <Textarea id="gallery-description" value={newGalleryDescription} onChange={(e) => setNewGalleryDescription(e.target.value)} placeholder="Une brève description de votre galerie (optionnel)" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary" disabled={isSaving}>Annuler</Button>
                    </DialogClose>
                    <Button onClick={handleCreateGallery} disabled={isSaving || !newGalleryName.trim()}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Créer
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        {areGalleriesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Card key={i}><CardHeader><div className="w-full h-40 bg-muted rounded-md animate-pulse"></div></CardHeader><CardContent><div className="h-5 w-3/4 bg-muted rounded animate-pulse"></div><div className="h-4 w-1/2 bg-muted rounded mt-2 animate-pulse"></div></CardContent></Card>)}
            </div>
        ) : galleries && galleries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {galleries.map(gallery => (
                    <Card key={gallery.id} className="flex flex-col">
                      <Link href={`/galleries/${gallery.id}`} className="block hover:bg-muted/30 transition-colors rounded-t-lg">
                        <CardHeader>
                            <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <CardTitle className="text-lg">{gallery.name}</CardTitle>
                            <CardDescription className="line-clamp-2 mt-1">{gallery.description || 'Aucune description'}</CardDescription>
                        </CardContent>
                      </Link>
                      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground mt-auto pt-4 border-t">
                            <span>{gallery.imageIds.length} image(s)</span>
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
                ))}
            </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Aucune galerie pour le moment</h3>
                <p className="mt-2 text-sm text-muted-foreground">Commencez par créer votre première galerie pour organiser vos images.</p>
            </div>
        )}
      </div>

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
    </div>
  );
}
