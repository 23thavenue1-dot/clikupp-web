
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type ImageMetadata, deleteImageMetadata, updateImageDescription } from '@/lib/firestore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ImageIcon, Trash2, Loader2, Share2, Copy, Check, Pencil, Wand2, Instagram, Facebook, MessageSquare, VenetianMask } from 'lucide-react';
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
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { Separator } from '@/components/ui/separator';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic';

export function ImageList() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<ImageMetadata | null>(null);

    const [showShareDialog, setShowShareDialog] = useState(false);
    const [imageToShare, setImageToShare] = useState<ImageMetadata | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const [showEditDialog, setShowEditDialog] = useState(false);
    const [imageToEdit, setImageToEdit] = useState<ImageMetadata | null>(null);
    
    const [currentTitle, setCurrentTitle] = useState('');
    const [currentDescription, setCurrentDescription] = useState('');
    const [currentHashtags, setCurrentHashtags] = useState<string[]>([]);
    
    const [isSavingDescription, setIsSavingDescription] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [wasGeneratedByAI, setWasGeneratedByAI] = useState(false);


    const imagesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
    }, [user, firestore]);

    const { data: images, isLoading } = useCollection<ImageMetadata>(imagesQuery);
    
    useEffect(() => {
        if (imageToEdit) {
            setCurrentTitle(''); // Reset title on new image
            setCurrentDescription(imageToEdit.description || '');
            setCurrentHashtags([]); // Reset hashtags on new image
            setWasGeneratedByAI(false); // Reset on new image
        }
    }, [imageToEdit]);
    
    const openDeleteDialog = (image: ImageMetadata) => {
        setImageToDelete(image);
        setShowDeleteAlert(true);
    };

    const openShareDialog = (image: ImageMetadata) => {
        setImageToShare(image);
        setShowShareDialog(true);
        setCopiedField(null);
    };
    
    const openEditDialog = (image: ImageMetadata) => {
        setImageToEdit(image);
        setShowEditDialog(true);
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

    const handleGenerateDescription = async (platform: Platform) => {
        if (!imageToEdit) return;
        setIsGeneratingDescription(true);
        setWasGeneratedByAI(false);
        try {
            const result = await generateImageDescription({ imageUrl: imageToEdit.directUrl, platform: platform });
            setCurrentTitle(result.title);
            setCurrentDescription(result.description);
            setCurrentHashtags(result.hashtags);
            setWasGeneratedByAI(true);
             toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Vous pouvez la modifier.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setIsGeneratingDescription(false);
        }
    };

    const handleSaveDescription = async () => {
        if (!imageToEdit || !user || !firestore) return;

        setIsSavingDescription(true);
        const finalDescription = [
            currentTitle,
            currentDescription,
            currentHashtags.join(' ')
        ].filter(Boolean).join('\n\n');

        try {
            await updateImageDescription(firestore, user.uid, imageToEdit.id, finalDescription, wasGeneratedByAI);
            toast({ title: 'Description enregistrée', description: 'La description de l\'image a été mise à jour.' });
            setShowEditDialog(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer la description.' });
        } finally {
            setIsSavingDescription(false);
        }
    };

    const copyToClipboard = async (text: string, field: string) => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiedField(field);
          toast({ title: "Copié !", description: "Le lien a été copié dans le presse-papiers." });
          setTimeout(() => setCopiedField(null), 2000);
        } catch {
          toast({ variant:'destructive', title:'Copie impossible', description:'Autorisez l’accès au presse-papier ou copiez manuellement.' });
        }
    };


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

    return (
        <>
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
                                <div key={image.id} className="group relative aspect-[4/5] w-full overflow-hidden rounded-lg border flex flex-col">
                                    <div className="relative aspect-square w-full">
                                        <Image
                                            src={image.directUrl}
                                            alt={image.originalName || 'Image téléversée'}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                                            className="object-cover bg-muted transition-transform group-hover:scale-105"
                                            unoptimized // Important pour les Data URLs et celles de Storage
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => openEditDialog(image)}
                                                aria-label="Modifier la description"
                                            >
                                                <Pencil size={16}/>
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => openShareDialog(image)}
                                                aria-label="Partager l'image"
                                            >
                                                <Share2 size={16}/>
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => openDeleteDialog(image)}
                                                disabled={isDeleting === image.id}
                                                aria-label="Supprimer l'image"
                                            >
                                                {isDeleting === image.id ? <Loader2 className="animate-spin" /> : <Trash2 size={16}/>}
                                            </Button>
                                        </div>
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
                                    <div className="p-3 bg-card flex-grow">
                                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                                            {image.description || 'Aucune description.'}
                                        </p>
                                    </div>
                                </div>
                            ))}
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

            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogContent>
                    <DialogHeader>
                    <DialogTitle>Partager l'image</DialogTitle>
                    <DialogDescription>
                        Copiez l'un des liens ci-dessous pour partager votre image.
                    </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="directLink">Lien direct (URL)</Label>
                            <div className="flex items-center gap-2">
                                <Input id="directLink" readOnly value={imageToShare?.directUrl || ''} className="bg-muted text-xs truncate"/>
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(imageToShare?.directUrl || '', 'direct')}>
                                    {copiedField === 'direct' ? <Check className="text-green-500"/> : <Copy />}
                                </Button>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="bbCodeLink">Pour forum (BBCode)</Label>
                            <div className="flex items-center gap-2">
                                <Input id="bbCodeLink" readOnly value={imageToShare?.bbCode || ''} className="bg-muted text-xs truncate"/>
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(imageToShare?.bbCode || '', 'bbcode')}>
                                    {copiedField === 'bbcode' ? <Check className="text-green-500"/> : <Copy />}
                                </Button>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="htmlLink">Pour site web (HTML)</Label>
                            <div className="flex items-center gap-2">
                                <Input id="htmlLink" readOnly value={imageToShare?.htmlCode || ''} className="bg-muted text-xs truncate"/>
                                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(imageToShare?.htmlCode || '', 'html')}>
                                    {copiedField === 'html' ? <Check className="text-green-500"/> : <Copy />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
                                value={currentHashtags.join(' ')}
                                onChange={(e) => setCurrentHashtags(e.target.value.split(' '))}
                                rows={2}
                                disabled={isGeneratingDescription || isSavingDescription}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className="w-full"
                                        disabled={isGeneratingDescription || isSavingDescription}
                                    >
                                        {isGeneratingDescription ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                        ) : (
                                            <Wand2 className="mr-2 h-4 w-4"/>
                                        )}
                                        {isGeneratingDescription ? 'Génération...' : 'Générer avec l\'IA pour...'}
                                    </Button>
                                </DropdownMenuTrigger>
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
        </>
    );
}
