
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, getDoc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, BrandProfile } from '@/lib/firestore';
import { Loader2, ArrowLeft, Instagram, Facebook, Clapperboard, Layers, Image as ImageIcon, Sparkles, RefreshCw, Save, FilePlus, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateCarousel } from '@/ai/flows/generate-carousel-flow';
import { regenerateCarouselText } from '@/ai/flows/regenerate-carousel-text-flow';
import type { CarouselSlide } from '@/ai/schemas/carousel-schemas';
import { decrementAiTicketCount, saveImageMetadata, savePostForLater } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { withErrorHandling } from '@/lib/async-wrapper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DialogClose } from '@radix-ui/react-dialog';


async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

const ActionCard = ({ children, className, onGenerate, disabled }: { children: React.ReactNode; className?: string; onGenerate: () => void; disabled: boolean; }) => (
    <AlertDialog>
        <AlertDialogTrigger asChild>
            <button
                className={cn(
                    "group relative p-4 border rounded-xl h-full flex flex-col items-start gap-2",
                    "transition-all duration-300 ease-out cursor-pointer overflow-hidden transform hover:scale-[1.03]",
                    "hover:shadow-2xl hover:shadow-purple-500/40",
                    "bg-gradient-to-r from-blue-600 to-purple-600 border-blue-500 text-white",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
                disabled={disabled}
            >
                <div className="relative z-10 w-full h-full flex flex-col items-start gap-2">
                    {children}
                </div>
            </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la génération ?</AlertDialogTitle>
                <AlertDialogDescription>
                    Cette action utilisera 3 tickets IA pour générer un carrousel complet. Êtes-vous sûr de vouloir continuer ?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={onGenerate}>Valider & Générer</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);

const ActionIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-2 bg-white/10 border border-white/20 text-white rounded-xl shadow-lg transition-all duration-300 group-hover:bg-white/20">
        <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
    </div>
);

const ActionTitle = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold text-sm text-white">{children}</span>
);

const ActionDescription = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-white/80 transition-colors group-hover:text-white">{children}</p>
);

const SocialIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-1 bg-black/20 border border-white/30 text-white rounded-full shadow-md absolute top-3 right-3">
        <Icon className="h-4 w-4" />
    </div>
);


export default function PostMagiquePage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading, firebaseApp } = useFirebase();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSlides, setGeneratedSlides] = useState<CarouselSlide[] | null>(null);
    const [regeneratingSlide, setRegeneratingSlide] = useState<number | null>(null);
    const [selectedNetwork, setSelectedNetwork] = useState<string>('Instagram');
    const [isSaving, setIsSaving] = useState(false);
    
    // Nouveaux états pour la planification
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');


    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: image, isLoading: isImageLoading } = useDoc<ImageMetadata>(imageDocRef);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, refetch: refetchUserProfile } = useDoc<UserProfile>(userDocRef);
    
    const brandProfilesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/brandProfiles`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: brandProfiles } = useCollection<BrandProfile>(brandProfilesQuery);


    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.packAiTickets || 0) + (userProfile.subscriptionAiTickets || 0) : 0;


    const handleGenerate = async (format: string, network: string) => {
        if (!image || !user || !userProfile || !firestore) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de lancer la génération.' });
            return;
        }

        const CAROUSEL_COST = 3;
        
        if (totalAiTickets < CAROUSEL_COST) {
             toast({ variant: 'destructive', title: 'Tickets IA insuffisants', description: `La génération d'un carrousel requiert ${CAROUSEL_COST} tickets.` });
            return;
        }

        setIsGenerating(true);
        setGeneratedSlides(null);
        setSelectedNetwork(network);

        try {
            const result = await generateCarousel({
                baseImageUrl: image.directUrl,
                platform: network.toLowerCase(),
            });
            setGeneratedSlides(result.slides);

            for (let i = 0; i < CAROUSEL_COST; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            refetchUserProfile();

            toast({ title: 'Carrousel généré !', description: 'Votre contenu est prêt.' });

        } catch (error) {
            console.error("Erreur de génération de carrousel:", error);
            toast({ variant: 'destructive', title: 'Erreur de l\'IA', description: 'Impossible de générer le carrousel.' });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleRegenerateText = async (slideIndex: number) => {
        if (!generatedSlides || !userProfile || !user || !firestore || totalAiTickets < 1) {
            toast({ variant: 'destructive', title: "Action impossible", description: "Pas assez de tickets IA." });
            return;
        }

        setRegeneratingSlide(slideIndex);

        try {
            const beforeImageUrl = generatedSlides.find(s => s.title === 'AVANT' && s.type === 'image')?.content;
            const afterImageUrl = generatedSlides.find(s => s.title === 'APRÈS' && s.type === 'image')?.content;
            const currentText = generatedSlides[slideIndex].content;

            if (!beforeImageUrl || !afterImageUrl) throw new Error("Images de référence introuvables.");

            const result = await regenerateCarouselText({
                baseImageUrl: beforeImageUrl,
                afterImageUrl: afterImageUrl,
                currentText: currentText,
                slideIndex: slideIndex,
                platform: selectedNetwork
            });
            
            const newSlides = [...generatedSlides];
            newSlides[slideIndex].content = result.newText;
            setGeneratedSlides(newSlides);

            await decrementAiTicketCount(firestore, user.uid, userProfile, 'description');
            refetchUserProfile();

            toast({ title: "Texte regénéré !" });

        } catch (error) {
            console.error("Erreur de regénération de texte:", error);
            toast({ variant: 'destructive', title: "Erreur de l'IA", description: "Impossible de regénérer le texte." });
        } finally {
            setRegeneratingSlide(null);
        }
    };
    
    const handleSaveCarousel = async () => {
        if (!generatedSlides || !user || !firebaseApp || !firestore) return;

        const afterImageSlide = generatedSlides.find(s => s.type === 'image' && s.title === 'APRÈS');
        if (!afterImageSlide) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Image "Après" introuvable pour la sauvegarde.' });
            return;
        }

        setIsSaving(true);
        const { error } = await withErrorHandling(async () => {
            const blob = await dataUriToBlob(afterImageSlide.content);
            const storage = getStorage(firebaseApp);
            const newFileName = `carousel-after-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });

            const hookText = generatedSlides.find(s => s.type === 'text' && s.title === 'LE POINT DE DÉPART')?.content || '';
            const conclusionText = generatedSlides.find(s => s.type === 'text' && s.title === 'LA TRANSFORMATION')?.content || '';
            const fullDescription = `${hookText}\n\n[Image "Après"]\n\n${conclusionText}`;

            const metadata = await uploadFileAndGetMetadata(
                storage,
                user,
                imageFile,
                `Généré par Post Magique`,
                () => {} 
            );
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Carrousel du ${format(new Date(), 'd MMMM yyyy')}`,
                description: fullDescription,
                hashtags: `#PostMagique #${selectedNetwork}`,
                generatedByAI: true
            });
        });

        setIsSaving(false);
        if (!error) {
            toast({ title: "Carrousel sauvegardé !", description: "La nouvelle image et ses textes ont été ajoutés à votre galerie." });
        }
    };
    
    const saveGeneratedImageAndPlan = async (isDraft: boolean) => {
        if (!generatedSlides || !user || !firebaseApp || !firestore) return;
    
        if (!isDraft && !scheduleDate) {
            toast({ variant: 'destructive', title: 'Date requise', description: 'Veuillez choisir une date pour programmer.' });
            return;
        }
    
        if (!selectedProfileId) {
            toast({ variant: 'destructive', title: 'Profil requis', description: 'Veuillez sélectionner un profil de marque.' });
            return;
        }
    
        const afterImageSlide = generatedSlides.find(s => s.type === 'image' && s.title === 'APRÈS');
        if (!afterImageSlide) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Image "Après" introuvable.' });
            return;
        }
    
        const setLoading = isDraft ? setIsSavingDraft : setIsScheduling;
        setLoading(true);
    
        const { error } = await withErrorHandling(async () => {
            // 1. Uploader la nouvelle image pour obtenir une référence permanente
            const blob = await dataUriToBlob(afterImageSlide!.content);
            const storage = getStorage(firebaseApp);
            const newFileName = `post-magique-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });
    
            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `Post Magique : ${selectedNetwork}`, () => {});
    
            // 2. Créer une entrée dans la galerie principale pour cette nouvelle image
            const hookText = generatedSlides.find(s => s.type === 'text' && s.title === 'LE POINT DE DÉPART')?.content || '';
            const conclusionText = generatedSlides.find(s => s.type === 'text' && s.title === 'LA TRANSFORMATION')?.content || '';
            const fullDescription = `${hookText}\n\n[Image "Après"]\n\n${conclusionText}`;
            
            const newImageDocRef = await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Carrousel du ${format(new Date(), 'd MMMM yyyy')}`,
                description: fullDescription,
                hashtags: `#PostMagique #${selectedNetwork}`,
                generatedByAI: true
            });
            const newImageSnap = await getDoc(newImageDocRef);
            const newImageMetadata = newImageSnap.data() as ImageMetadata;
    
            // 3. Utiliser cette nouvelle image pour créer le post programmé/brouillon
            await savePostForLater(firestore, storage, user.uid, {
                brandProfileId: selectedProfileId,
                title: newImageMetadata.title,
                description: newImageMetadata.description || '',
                scheduledAt: isDraft ? undefined : scheduleDate,
                imageSource: newImageMetadata,
            });
        });
    
        setLoading(false);
        if (!error) {
            if (isDraft) {
                toast({ title: "Brouillon sauvegardé !", description: "Retrouvez-le dans votre Planificateur." });
            } else {
                toast({ title: "Publication programmée !", description: `Retrouvez-la dans votre Planificateur pour le ${format(scheduleDate!, 'PPP', { locale: fr })}.` });
            }
        }
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
                 <p className="text-muted-foreground">L'image source pour le Post Magique n'a pas été trouvée.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }
    
    const formats = [
        { network: 'Instagram', format: 'Carrousel', icon: Instagram, typeIcon: Layers, disabled: false },
        { network: 'Instagram', format: 'Publication', icon: Instagram, typeIcon: ImageIcon, disabled: true },
        { network: 'Instagram', format: 'Story', icon: Instagram, typeIcon: Clapperboard, disabled: true },
        { network: 'Facebook', format: 'Publication', icon: Facebook, typeIcon: ImageIcon, disabled: true },
    ];


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-6xl mx-auto space-y-6">
                <header className="space-y-2">
                     <Button variant="ghost" asChild className="mb-4 -ml-4">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Retour à l'accueil
                        </Link>
                    </Button>
                    <h1 className="text-4xl font-bold tracking-tight">Post Magique 🪄</h1>
                    <p className="text-muted-foreground">
                        Choisissez un format. L'IA s'occupe de transformer votre image en un contenu optimisé prêt à publier.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Image d'Origine</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-md border bg-muted mb-4">
                            <Image
                                src={image.directUrl}
                                alt={image.title || image.originalName || 'Image d\'origine'}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    </CardContent>
                </Card>
                
                {isGenerating && (
                    <Card className="text-center">
                        <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary"/>
                            <p className="font-semibold">L'IA prépare votre contenu...</p>
                            <p className="text-sm text-muted-foreground">Cette opération peut prendre jusqu'à une minute.</p>
                        </CardContent>
                    </Card>
                )}

                {generatedSlides && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Votre Carrousel est Prêt !</CardTitle>
                            <CardDescription>Voici un aperçu des 4 diapositives générées. Vous pouvez regénérer les textes si besoin.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {generatedSlides.map((slide, index) => (
                                    <div key={index} className="flex flex-col h-full">
                                        <Card className="overflow-hidden flex-grow flex flex-col">
                                            <CardHeader className="bg-muted p-2">
                                                <CardTitle className="text-center text-sm font-semibold uppercase tracking-widest">{slide.title}</CardTitle>
                                            </CardHeader>
                                            {slide.type === 'image' ? (
                                                <div className="aspect-square relative bg-black flex-grow">
                                                    <Image src={slide.content} alt={slide.title} fill className="object-contain" unoptimized/>
                                                </div>
                                            ) : (
                                                <div className="aspect-square flex flex-col items-center justify-center p-4 bg-background flex-grow">
                                                    <p className="text-sm text-center font-medium whitespace-pre-wrap flex-grow flex items-center">{slide.content}</p>
                                                     <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleRegenerateText(index)} 
                                                        disabled={isGenerating || regeneratingSlide != null || totalAiTickets < 1}
                                                        className="mt-2"
                                                    >
                                                        {regeneratingSlide === index ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                        ) : (
                                                            <RefreshCw className="mr-2 h-4 w-4"/>
                                                        )}
                                                        Regénérer
                                                    </Button>
                                                </div>
                                            )}
                                        </Card>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-center gap-4 pt-6 border-t">
                            <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-lg">
                                <Button onClick={handleSaveCarousel} disabled={isSaving || isSavingDraft || isScheduling} className="w-full" variant="secondary">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Sauvegarder la création
                                </Button>
                                <Button onClick={() => saveGeneratedImageAndPlan(true)} disabled={isSaving || isSavingDraft || isScheduling || !selectedProfileId} className="w-full">
                                    {isSavingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FilePlus className="mr-2 h-4 w-4" />}
                                    Enregistrer en brouillon
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"default"}
                                            className={cn("w-full justify-center text-left font-normal", !scheduleDate && "text-white/80")}
                                            disabled={isSaving || isSavingDraft || isScheduling || !selectedProfileId}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {scheduleDate ? format(scheduleDate, "PPP", { locale: fr }) : <span>Programmer...</span>}
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
                                        <div className="p-2 border-t">
                                            <Button 
                                                onClick={() => saveGeneratedImageAndPlan(false)} 
                                                disabled={!scheduleDate || isScheduling}
                                                className="w-full"
                                            >
                                                {isScheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CalendarIcon className="mr-2 h-4 w-4"/>}
                                                Confirmer la date
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                             <div className="w-full max-w-lg">
                                <Label htmlFor="brand-profile-save" className="sr-only">Profil de Marque</Label>
                                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                    <SelectTrigger id="brand-profile-save" className="w-full mt-2">
                                        <SelectValue placeholder="Sélectionnez un profil pour sauvegarder/planifier..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(brandProfiles || []).map(profile => (
                                            <SelectItem key={profile.id} value={profile.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5"><AvatarImage src={profile.avatarUrl} alt={profile.name} /><AvatarFallback>{profile.name.charAt(0)}</AvatarFallback></Avatar>
                                                    <span>{profile.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="link" onClick={() => setGeneratedSlides(null)} className="mt-4">
                                <Sparkles className="mr-2 h-4 w-4"/>
                                Créer une autre transformation
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {!isGenerating && !generatedSlides && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Choisissez une transformation</CardTitle>
                            <CardDescription>Cliquez sur un format pour lancer la magie.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {formats.map((fmt, index) => (
                                <ActionCard 
                                    key={index}
                                    onGenerate={() => handleGenerate(fmt.format, fmt.network)}
                                    disabled={fmt.disabled || isGenerating}
                                >
                                    <SocialIcon icon={fmt.icon} />
                                    <ActionIcon icon={fmt.typeIcon} />
                                    <ActionTitle>{fmt.format}</ActionTitle>
                                    <ActionDescription>pour {fmt.network}</ActionDescription>
                                </ActionCard>
                            ))}
                        </CardContent>
                    </Card>
                )}

            </div>
        </div>
    );
}
