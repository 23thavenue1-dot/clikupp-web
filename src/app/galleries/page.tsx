

'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, PlusCircle, Image as ImageIcon } from 'lucide-react';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { type Gallery, createGallery } from '@/lib/firestore';
import { GalleryCard } from './GalleryCard';
import { withErrorHandling } from '@/lib/async-wrapper';

export default function GalleriesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [newGalleryDescription, setNewGalleryDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    const { error } = await withErrorHandling(() => 
        createGallery(firestore, user.uid, newGalleryName, newGalleryDescription)
    );

    if (!error) {
        toast({ title: 'Galerie créée', description: `La galerie "${newGalleryName}" a été créée.` });
        setNewGalleryName('');
        setNewGalleryDescription('');
        setIsCreateDialogOpen(false);
    }
    setIsSaving(false);
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
                    <GalleryCard key={gallery.id} gallery={gallery} />
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
    </div>
  );
}


