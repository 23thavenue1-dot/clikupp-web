
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, BrandProfile } from '@/lib/firestore';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Copy, Check, CopyPlus, Sparkles, FileText, LineChart, Wand2, ShoppingCart, Instagram, Facebook, MessageSquare, VenetianMask, Pencil, Calendar as CalendarIcon, FilePlus as FilePlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { decrementAiTicketCount, updateImageDescription, savePostForLater } from '@/lib/firestore';
import { withErrorHandling } from '@/lib/async-wrapper';
import { getStorage } from 'firebase/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';


type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic' | 'ecommerce';


export default function ImageDetailPage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading, firebaseApp } = useFirebase();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [copiedField, setCopiedField] = useState<string | null>(null);

    // --- State pour la génération de description ---
    const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [isSavingDescription, setIsSavingDescription] = useState(false);
    const [currentTitle, setCurrentTitle] = useState('');
    const [currentDescription, setCurrentDescription] = useState('');
    const [hashtagsString, setHashtagsString] = useState('');
    const [wasGeneratedByAI, setWasGeneratedByAI] = useState(false);

    // --- State pour la planification ---
    const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');
    const [isSavingPost, setIsSavingPost] = useState(false);


    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: image, isLoading: isImageLoading, refetch: refetchImage } = useDoc<ImageMetadata>(imageDocRef);
    
    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const brandProfilesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/brandProfiles`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: brandProfiles } = useDoc<BrandProfile[]>(brandProfilesQuery as any);


    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);
    
    // Initialiser les champs de texte lorsque le dialogue s'ouvre
    useEffect(() => {
        if (image && isDescriptionDialogOpen) {
            setCurrentTitle(image.title || '');
            setCurrentDescription(image.description || '');
            setHashtagsString(image.hashtags || '');
            setWasGeneratedByAI(false); // Réinitialiser à chaque ouverture
        }
    }, [image, isDescriptionDialogOpen]);


    const copyToClipboard = async (text: string, field: string, toastTitle = "Copié !") => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiedField(field);
          toast({ title: toastTitle });
          setTimeout(() => setCopiedField(null), 2000);
        } catch {
          toast({ variant:'destructive', title:'Copie impossible', description:'Autorisez l’accès au presse-papier ou copiez manuellement.' });
        }
    };

    const handleCoachClick = () => {
        if (typeof window !== 'undefined' && image) {
            localStorage.setItem('imageForAudit', image.id);
            router.push('/audit');
        }
    };
    
    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0) : 0;
    const hasAiTickets = totalAiTickets > 0;

    const handleGenerateDescription = async (platform: Platform) => {
        if (!image || !user || !userProfile) return;

        if (!hasAiTickets) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: (<Link href="/shop" className="font-bold underline text-white">Rechargez dans la boutique !</Link>),
            });
            return;
        }

        setIsGeneratingDescription(true);
        setWasGeneratedByAI(false);
        try {
            const result = await generateImageDescription({ imageUrl: image.directUrl, platform: platform });
            setCurrentTitle(result.title);
            setCurrentDescription(result.description);
            setHashtagsString(result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '));
            setWasGeneratedByAI(true);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'description');
            
            toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Un ticket IA a été utilisé.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setIsGeneratingDescription(false);
        }
    };

    const handleSaveDescription = async () => {
        if (!image || !user || !firestore) return;
        setIsSavingDescription(true);

        const dataToSave = {
            title: currentTitle,
            description: currentDescription,
            hashtags: hashtagsString
        };

        try {
            await updateImageDescription(firestore, user.uid, image.id, dataToSave, wasGeneratedByAI);
            toast({ title: 'Description enregistrée', description: 'Les informations de l\'image ont été mises à jour.' });
            setIsDescriptionDialogOpen(false);
            refetchImage(); // Forcer le rafraîchissement des données de l'image sur la page
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer les informations.' });
        } finally {
            setIsSavingDescription(false);
        }
    };

    const handleSavePost = async () => {
        if (!user || !firebaseApp || !image || !selectedProfileId) return;

        setIsSavingPost(true);
        const storage = getStorage(firebaseApp);
        
        const { error } = await withErrorHandling(() => 
            savePostForLater(firestore, storage, user.uid, {
                brandProfileId: selectedProfileId,
                title: image.title,
                description: image.description || '',
                scheduledAt: scheduleDate, // Peut être undefined pour un brouillon
                imageSource: image,
            })
        );
        
        if (!error) {
            if (scheduleDate) {
                toast({ title: "Publication programmée !", description: `Retrouvez-la dans votre Planificateur pour le ${format(scheduleDate, 'PPP', { locale: fr })}.` });
            } else {
                toast({ title: "Brouillon sauvegardé !", description: "Retrouvez-le dans votre Planificateur de contenu." });
            }
            setScheduleDialogOpen(false);
        }
        setIsSavingPost(false);
    };


    if (isUserLoading || isImageLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!image) {
        return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Image introuvable</h1>
                 <p className="text-muted-foreground">L'image que vous essayez de voir n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }

    const fullTextToCopy = `${image.title || ''}\n\n${image.description || ''}\n\n${image.hashtags || ''}`.trim();
    
    // --- Logique pour les liens de partage ---
    const twitterText = encodeURIComponent(`${image.title || ''}\n${image.description || ''}\n${image.hashtags || ''}`.trim());
    const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(image.directUrl)}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(image.directUrl)}`;


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                     <Button variant="ghost" asChild className="-ml-4">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Retour à la galerie
                        </Link>
                    </Button>
                </div>
               
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl">Détails de l'image</CardTitle>
                        <CardDescription>
                            Téléversée {formatDistanceToNow(image.uploadTimestamp.toDate(), { addSuffix: true, locale: fr })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted mb-4">
                            <Image
                                src={image.directUrl}
                                alt={image.title || image.originalName || 'Image'}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                        <h2 className="text-2xl font-semibold break-words">{image.title || 'Sans titre'}</h2>
                    </CardContent>
                </Card>

                {/* --- Section Outils IA --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>Hub de Création IA</CardTitle>
                        <CardDescription>Donnez une nouvelle dimension à votre image.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link href={`/edit/${imageId}`} passHref>
                            <div className="p-4 border rounded-lg h-full flex flex-col items-start gap-2 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <span className="font-semibold">Éditer avec l'IA</span>
                                <p className="text-xs text-muted-foreground">Modifiez votre image en décrivant les changements en langage naturel.</p>
                            </div>
                        </Link>

                        <div className="p-4 border rounded-lg h-full flex flex-col items-start gap-2 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setIsDescriptionDialogOpen(true)} role="button">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <FileText className="h-6 w-6" />
                            </div>
                            <span className="font-semibold">Générer une description</span>
                            <p className="text-xs text-muted-foreground">Créez un titre, une description et des hashtags pertinents pour les réseaux sociaux.</p>
                        </div>
                        
                         <div 
                            className="p-4 border rounded-lg h-full flex flex-col items-start gap-2 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={handleCoachClick}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <LineChart className="h-6 w-6" />
                            </div>
                            <span className="font-semibold">Utiliser dans le Coach Stratégique</span>
                            <p className="text-xs text-muted-foreground">Analysez cette image dans le cadre d'un audit de profil pour une stratégie de contenu sur-mesure.</p>
                        </div>
                        
                         <div 
                            className="p-4 border rounded-lg h-full flex flex-col items-start gap-2 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() => setScheduleDialogOpen(true)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <FilePlusIcon className="h-6 w-6" />
                            </div>
                            <span className="font-semibold">Planifier / Brouillon</span>
                            <p className="text-xs text-muted-foreground">Programmez cette image pour une publication future ou sauvegardez-la comme brouillon.</p>
                        </div>
                    </CardContent>
                </Card>
                
                {/* --- Section Partage & Export --- */}
                 <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
                    <Card>
                         <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Partage & Export</CardTitle>
                                    <CardDescription>Copiez le contenu de votre publication et les liens de partage.</CardDescription>
                                </div>
                                <DialogTrigger asChild>
                                     <Button variant="outline" size="sm">
                                        <Pencil className="mr-2 h-4 w-4"/>
                                        Modifier
                                    </Button>
                                </DialogTrigger>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-base font-semibold">Contenu de la publication</Label>
                                     <Button
                                        onClick={() => copyToClipboard(fullTextToCopy, 'details-all', 'Contenu complet copié !')}
                                        disabled={!fullTextToCopy}
                                        size="sm"
                                    >
                                        {copiedField === 'details-all' ? <Check className="mr-2" /> : <CopyPlus className="mr-2" />}
                                        Tout Copier
                                    </Button>
                                </div>
                                <Separator />
                                <div className="relative">
                                    <Label className="text-muted-foreground text-xs">Titre</Label>
                                    <p className="text-sm font-medium pr-8">{image.title || 'N/A'}</p>
                                    {image.title && (
                                        <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => copyToClipboard(image.title || '', 'title-detail')}>
                                            {copiedField === 'title-detail' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </Button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Label className="text-muted-foreground text-xs">Description</Label>
                                    <p className="text-sm whitespace-pre-wrap pr-8">{image.description || 'N/A'}</p>
                                     {image.description && (
                                        <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => copyToClipboard(image.description || '', 'desc-detail')}>
                                            {copiedField === 'desc-detail' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </Button>
                                    )}
                                </div>
                                 <div className="relative">
                                    <Label className="text-muted-foreground text-xs">Hashtags</Label>
                                    <p className="text-sm text-primary pr-8 break-words">{image.hashtags || 'N/A'}</p>
                                    {image.hashtags && (
                                        <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => copyToClipboard(image.hashtags || '', 'tags-detail')}>
                                            {copiedField === 'tags-detail' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                 <div className="relative">
                                    <Label className="text-muted-foreground">Lien direct (URL)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input value={image.directUrl} readOnly className="text-xs"/>
                                        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(image.directUrl, 'direct', 'Lien copié !')}>
                                            {copiedField === 'direct' ? <Check className="text-green-500"/> : <Copy size={16} />}
                                        </Button>
                                    </div>
                                </div>

                                 <div className="relative">
                                    <Label className="text-muted-foreground">Pour forum (BBCode)</Label>
                                     <div className="flex items-center gap-2">
                                        <Input value={image.bbCode} readOnly className="text-xs"/>
                                        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(image.bbCode, 'bbcode', 'BBCode copié !')}>
                                            {copiedField === 'bbcode' ? <Check className="text-green-500"/> : <Copy size={16} />}
                                        </Button>
                                    </div>
                                </div>

                                 <div className="relative">
                                    <Label className="text-muted-foreground">Pour site web (HTML)</Label>
                                     <div className="flex items-center gap-2">
                                        <Input value={image.htmlCode} readOnly className="text-xs"/>
                                        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(image.htmlCode, 'html', 'Code HTML copié !')}>
                                            {copiedField === 'html' ? <Check className="text-green-500"/> : <Copy size={16} />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Générer ou Modifier le Contenu</DialogTitle>
                            <DialogDescription>
                                Laissez l'IA rédiger un contenu optimisé, ou modifiez-le manuellement.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Titre</Label>
                                <Input 
                                    id="title"
                                    placeholder="Titre de votre publication..."
                                    value={currentTitle}
                                    onChange={(e) => setCurrentTitle(e.target.value)}
                                    disabled={isGeneratingDescription || isSavingDescription}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea 
                                    id="description"
                                    placeholder="La description de votre publication..."
                                    value={currentDescription}
                                    onChange={(e) => setCurrentDescription(e.target.value)}
                                    rows={4}
                                    disabled={isGeneratingDescription || isSavingDescription}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="hashtags">Hashtags</Label>
                                <Textarea 
                                    id="hashtags"
                                    placeholder="#vos #hashtags #ici"
                                    value={hashtagsString}
                                    onChange={(e) => setHashtagsString(e.target.value)}
                                    rows={2}
                                    disabled={isGeneratingDescription || isSavingDescription}
                                />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Génération par IA</Label>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                        <span className="text-primary">{totalAiTickets}</span> tickets restants
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity" 
                                            disabled={isGeneratingDescription || isSavingDescription || !hasAiTickets}
                                        >
                                            {isGeneratingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4 text-amber-400"/>}
                                            {isGeneratingDescription ? "Génération..." : "Générer pour..."}
                                        </Button>
                                    </DropdownMenuTrigger>
                                     <DropdownMenuContent className="w-56">
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('ecommerce')}><ShoppingCart className="mr-2 h-4 w-4" /> Annonce E-commerce</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('instagram')}><Instagram className="mr-2 h-4 w-4" /> Instagram</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('facebook')}><Facebook className="mr-2 h-4 w-4" /> Facebook</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('x')}><MessageSquare className="mr-2 h-4 w-4" /> X (Twitter)</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('tiktok')}><VenetianMask className="mr-2 h-4 w-4" /> TikTok</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleGenerateDescription('generic')}><Wand2 className="mr-2 h-4 w-4" /> Générique</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsDescriptionDialogOpen(false)} disabled={isSavingDescription}>Annuler</Button>
                            <Button onClick={handleSaveDescription} disabled={isSavingDescription || isGeneratingDescription}>
                                {isSavingDescription && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Enregistrer les modifications
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* --- NOUVELLE SECTION: PARTAGE RAPIDE --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>Partage Rapide</CardTitle>
                        <CardDescription>Partagez votre création en un clic sur vos réseaux sociaux.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                         <Button asChild variant="outline" className="h-12 border-pink-500 text-pink-600 hover:bg-pink-500/10 hover:text-pink-600">
                            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
                                <Instagram className="mr-2 h-5 w-5" />
                                Ouvrir Instagram
                            </a>
                        </Button>
                        <Button asChild variant="outline" className="h-12 border-[#1877F2] text-[#1877F2] hover:bg-[#1877F2]/10 hover:text-[#1877F2]">
                            <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                                <Facebook className="mr-2 h-5 w-5 fill-current" />
                                Partager sur Facebook
                            </a>
                        </Button>
                        <Button asChild variant="outline" className="h-12 border-[#1DA1F2] text-[#1DA1F2] hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2]">
                            <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                                <MessageSquare className="mr-2 h-5 w-5" />
                                Partager sur X (Twitter)
                            </a>
                        </Button>
                         <Button asChild variant="outline" className="h-12 border-black text-black dark:border-white dark:text-white hover:bg-black/10 dark:hover:bg-white/10">
                            <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer">
                                <VenetianMask className="mr-2 h-5 w-5" />
                                Ouvrir TikTok
                            </a>
                        </Button>
                    </CardContent>
                     <CardFooter>
                        <p className="text-xs text-muted-foreground">
                            Note : Pour des raisons techniques, le partage rapide pré-remplit le texte si possible. Vous devrez peut-être ajouter l'image manuellement.
                        </p>
                    </CardFooter>
                </Card>

            </div>

             <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Planifier une publication</DialogTitle>
                        <DialogDescription>
                            Associez ce post à un profil et choisissez une date de publication, ou sauvegardez-le en tant que brouillon.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="brand-profile">Profil de Marque</Label>
                            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                <SelectTrigger id="brand-profile">
                                    <SelectValue placeholder="Sélectionnez un profil..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(brandProfiles ?? []).map(profile => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                                                    <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span>{profile.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                             {(brandProfiles ?? []).length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Vous devez d'abord créer un profil de marque dans le <Link href="/audit" className="underline text-primary">Coach Stratégique</Link>.
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Date de publication (optionnel)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !scheduleDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {scheduleDate ? format(scheduleDate, "PPP", { locale: fr }) : <span>Choisissez une date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={scheduleDate}
                                        onSelect={setScheduleDate}
                                        disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                             <p className="text-xs text-muted-foreground">Si aucune date n'est choisie, le post sera sauvegardé comme brouillon.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary" disabled={isSavingPost}>Annuler</Button>
                        </DialogClose>
                        <Button onClick={handleSavePost} disabled={isSavingPost || !selectedProfileId}>
                            {isSavingPost && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {scheduleDate ? 'Programmer' : 'Enregistrer en brouillon'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
