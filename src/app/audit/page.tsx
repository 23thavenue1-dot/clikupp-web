'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, doc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, BrandProfile } from '@/lib/firestore';
import { socialAuditFlow, type SocialAuditOutput } from '@/ai/flows/social-audit-flow';
import { decrementAiTicketCount, createBrandProfile } from '@/lib/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Check, ShoppingCart, ClipboardList, PlusCircle, Building } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

const MAX_IMAGES = 9;
const AUDIT_COST = 5;

export default function AuditPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    
    // --- Step 1 States ---
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileAvatarUrl, setNewProfileAvatarUrl] = useState('');
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);

    // --- Step 2 States ---
    const [platform, setPlatform] = useState('');
    const [goal, setGoal] = useState('');

    // --- Step 3 States ---
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

    // --- Step 4 States ---
    const [postTexts, setPostTexts] = useState(['', '', '']);
    const [additionalContext, setAdditionalContext] = useState('');

    // --- Step 5 States ---
    const [isSubmitting, setIsSubmitting] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const imagesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
    }, [user, firestore]);
    const { data: images, isLoading: areImagesLoading } = useCollection<ImageMetadata>(imagesQuery);
    
    const brandProfilesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/brandProfiles`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: brandProfiles, isLoading: areProfilesLoading } = useCollection<BrandProfile>(brandProfilesQuery);
    
    const auditsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/audits`));
    }, [user, firestore]);
    const { data: savedAudits, isLoading: areAuditsLoading } = useCollection(auditsQuery);


    const totalAiTickets = useMemo(() => {
        if (!userProfile) return 0;
        return (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0);
    }, [userProfile]);
    
    const handleCreateProfile = async () => {
        if (!user || !firestore || !newProfileName.trim()) {
            toast({ variant: 'destructive', title: 'Erreur', description: "Le nom du profil est obligatoire." });
            return;
        }
        setIsCreatingProfile(true);
        try {
            const newProfileRef = await createBrandProfile(firestore, user.uid, newProfileName, newProfileAvatarUrl);
            setSelectedProfileId(newProfileRef.id);
            setNewProfileName('');
            setNewProfileAvatarUrl('');
            setIsCreateProfileOpen(false);
            toast({ title: 'Profil créé', description: `Le profil "${newProfileName}" a été créé et sélectionné.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de créer le profil." });
        } finally {
            setIsCreatingProfile(false);
        }
    };


    if (isUserLoading || isProfileLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        router.push('/login?redirect=/audit');
        return null;
    }
    
    const totalSteps = 5;
    const progress = (step / totalSteps) * 100;

    const toggleImageSelection = (imageId: string) => {
        setSelectedImages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                if (newSet.size < MAX_IMAGES) {
                    newSet.add(imageId);
                }
            }
            return newSet;
        });
    };

    const handleTextChange = (index: number, value: string) => {
        const newTexts = [...postTexts];
        newTexts[index] = value;
        setPostTexts(newTexts);
    };
    
    const handleSubmit = async () => {
        if (!user || !userProfile || !firestore || selectedImages.size === 0 || !selectedProfileId) return;

        if (totalAiTickets < AUDIT_COST) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA insuffisants',
                description: (
                    <Link href="/shop" className="font-bold underline text-white">
                        Rechargez dans la boutique pour continuer !
                    </Link>
                ),
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const selectedImageObjects = images?.filter(img => selectedImages.has(img.id)) || [];
            const imageUrls = selectedImageObjects.map(img => img.directUrl);

            const result = await socialAuditFlow({
                platform,
                goal,
                image_urls: imageUrls,
                post_texts: postTexts.filter(t => t.trim() !== ''),
                additionalContext: additionalContext.trim() || undefined,
            });

            for (let i = 0; i < AUDIT_COST; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            
            // SAUVEGARDE DU RAPPORT
            const auditsCollectionRef = collection(firestore, `users/${user.uid}/audits`);
            const auditDataToSave = {
                ...result,
                userId: user.uid,
                brandProfileId: selectedProfileId, // Lien vers le profil
                createdAt: new Date(),
                platform,
                goal,
            };
            const docRef = await addDoc(auditsCollectionRef, auditDataToSave);
            
            toast({
                title: 'Analyse terminée !',
                description: `Votre rapport est prêt. ${AUDIT_COST} tickets IA ont été utilisés.`,
            });
            
            // REDIRECTION VERS LA PAGE DE RÉSULTATS
            router.push(`/audit/resultats/${docRef.id}`);

        } catch (error) {
            console.error("Erreur lors de l'audit IA:", error);
            toast({
                variant: 'destructive',
                title: 'Erreur d\'analyse',
                description: "Une erreur est survenue pendant la génération du rapport. Veuillez réessayer."
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));
    
    const canGoToStep2 = selectedProfileId;
    const canGoToStep3 = platform && goal;
    const canGoToStep4 = selectedImages.size >= 1;
    const canGoToStep5 = true; 


    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <CardContent>
                        <div className="flex items-center justify-between mb-4">
                            <Label>Profil de Marque</Label>
                             <Dialog open={isCreateProfileOpen} onOpenChange={setIsCreateProfileOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Nouveau Profil
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Créer un Profil de Marque</DialogTitle>
                                        <DialogDescription>
                                            Ajoutez un client ou un projet pour organiser vos analyses.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="profile-name">Nom du profil</Label>
                                            <Input id="profile-name" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Ex: Boulangerie 'Au bon pain'" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="profile-avatar">URL de l'avatar (logo)</Label>
                                            <Input id="profile-avatar" value={newProfileAvatarUrl} onChange={(e) => setNewProfileAvatarUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="secondary" disabled={isCreatingProfile}>Annuler</Button></DialogClose>
                                        <Button onClick={handleCreateProfile} disabled={isCreatingProfile || !newProfileName.trim()}>
                                            {isCreatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Créer
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {areProfilesLoading ? (
                             <div className="space-y-2">
                                <div className="h-12 w-full bg-muted rounded-md animate-pulse"></div>
                                <div className="h-12 w-full bg-muted rounded-md animate-pulse"></div>
                            </div>
                        ) : brandProfiles && brandProfiles.length > 0 ? (
                            <ScrollArea className="h-60">
                                <div className="space-y-2 pr-4">
                                {brandProfiles.map(profile => (
                                    <div 
                                        key={profile.id}
                                        onClick={() => setSelectedProfileId(profile.id)}
                                        className={cn(
                                            "flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all",
                                            selectedProfileId === profile.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                                        )}
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                                            <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{profile.name}</span>
                                        {selectedProfileId === profile.id && <Check className="ml-auto h-5 w-5 text-primary"/>}
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="text-center text-muted-foreground border-2 border-dashed rounded-lg p-8">
                                <Building className="mx-auto h-10 w-10 mb-2"/>
                                <p className="font-medium">Aucun profil de marque.</p>
                                <p className="text-sm">Cliquez sur "Nouveau Profil" pour commencer.</p>
                            </div>
                        )}
                    </CardContent>
                );
            case 2:
                return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="platform">Plateforme du réseau social</Label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger id="platform" className="w-full">
                                    <SelectValue placeholder="Choisissez une plateforme..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="instagram">Instagram</SelectItem>
                                    <SelectItem value="tiktok">TikTok</SelectItem>
                                    <SelectItem value="facebook">Facebook</SelectItem>
                                    <SelectItem value="x">X (Twitter)</SelectItem>
                                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                                    <SelectItem value="other">Autre</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="goal">Quel est votre objectif principal ?</Label>
                            <Select value={goal} onValueChange={setGoal}>
                                <SelectTrigger id="goal" className="w-full">
                                    <SelectValue placeholder="Choisissez un objectif..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Augmenter mon engagement et créer une communauté.">Augmenter mon engagement et créer une communauté.</SelectItem>
                                    <SelectItem value="Professionnaliser mon image de marque.">Professionnaliser mon image de marque.</SelectItem>
                                    <SelectItem value="Trouver plus de clients ou d'opportunités.">Trouver plus de clients ou d'opportunités.</SelectItem>
                                    <SelectItem value="Définir une identité visuelle plus cohérente.">Définir une identité visuelle plus cohérente.</SelectItem>
                                    <SelectItem value="Diversifier mon contenu et trouver de nouvelles idées.">Diversifier mon contenu et trouver de nouvelles idées.</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                );
            case 3:
                return (
                     <CardContent>
                        <div className="bg-muted/50 border-l-4 border-primary p-4 rounded-r-lg mb-6">
                            <h4 className="font-semibold">Conseil d'expert</h4>
                            <p className="text-sm text-muted-foreground">
                                Pour une analyse optimale, sélectionnez entre 6 et {MAX_IMAGES} publications qui représentent le mieux votre style actuel. <br/>
                                <strong>Astuces :</strong> Incluez une capture de votre <strong>grille de profil ('feed')</strong>, ainsi qu'une autre de la <strong>description de votre profil</strong>.
                            </p>
                        </div>
                        {areImagesLoading ? (
                             <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-muted rounded-md animate-pulse"></div>)}
                            </div>
                        ) : (
                            <ScrollArea className="h-72">
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 pr-4">
                                    {images?.map(image => (
                                        <div 
                                            key={image.id}
                                            onClick={() => toggleImageSelection(image.id)}
                                            className={cn("relative aspect-square rounded-lg overflow-hidden cursor-pointer group transition-all", selectedImages.has(image.id) && "ring-2 ring-primary ring-offset-2")}
                                        >
                                            <Image
                                                src={image.directUrl}
                                                alt={image.originalName || 'Image'}
                                                fill
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                className="object-cover"
                                                unoptimized
                                            />
                                             <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors" />
                                             {selectedImages.has(image.id) && (
                                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                             )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                );
            case 4:
                return (
                     <CardContent className="space-y-4">
                         <div className="bg-muted/50 border-l-4 border-primary p-4 rounded-r-lg">
                            <h4 className="font-semibold">Informations additionnelles (Optionnel)</h4>
                            <p className="text-sm text-muted-foreground">
                                Si vous le souhaitez, copiez-collez le texte de 2 ou 3 publications récentes et/ou ajoutez un contexte pour guider l'IA.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text-1">Texte de publication 1</Label>
                            <Textarea id="post-text-1" value={postTexts[0]} onChange={(e) => handleTextChange(0, e.target.value)} rows={3} placeholder="Collez votre texte ici..."/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text-2">Texte de publication 2</Label>
                            <Textarea id="post-text-2" value={postTexts[1]} onChange={(e) => handleTextChange(1, e.target.value)} rows={3} placeholder="Collez votre texte ici..."/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="post-text-3">Texte de publication 3</Label>
                            <Textarea id="post-text-3" value={postTexts[2]} onChange={(e) => handleTextChange(2, e.target.value)} rows={3} placeholder="Collez votre texte ici..."/>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label htmlFor="additional-context">Contexte supplémentaire pour l'IA</Label>
                            <Textarea 
                                id="additional-context" 
                                value={additionalContext} 
                                onChange={(e) => setAdditionalContext(e.target.value)} 
                                rows={4} 
                                placeholder="Ex: Je suis photographe et je cherche à attirer plus de clients pour des mariages. Je trouve mes photos trop sombres..."
                            />
                        </div>
                    </CardContent>
                );
            case 5:
                 const selectedProfile = brandProfiles?.find(p => p.id === selectedProfileId);
                 return (
                    <CardContent className="text-center">
                        <h3 className="text-xl font-semibold">Prêt à lancer l'analyse ?</h3>
                        <p className="text-muted-foreground mt-2">L'IA va maintenant analyser votre identité visuelle et rédactionnelle pour vous fournir un rapport complet.</p>
                        <div className="mt-6 p-4 bg-muted rounded-lg text-left text-sm space-y-2">
                            <p><strong>Profil de Marque :</strong> {selectedProfile?.name || 'N/A'}</p>
                            <p><strong>Plateforme :</strong> {platform}</p>
                            <p><strong>Objectif :</strong> {goal}</p>
                            <p><strong>Images sélectionnées :</strong> {selectedImages.size}</p>
                            <p><strong>Textes fournis :</strong> {postTexts.filter(t => t.trim() !== '').length}</p>
                            {additionalContext.trim() && <p><strong>Contexte ajouté :</strong> Oui</p>}
                        </div>
                         <Button onClick={handleSubmit} disabled={isSubmitting || totalAiTickets < AUDIT_COST} className="w-full mt-6" size="lg">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSubmitting ? 'Analyse en cours...' : `Lancer l'analyse (${AUDIT_COST} Tickets IA)`}
                        </Button>
                         {totalAiTickets < AUDIT_COST && (
                            <p className="text-sm text-destructive mt-2">
                                Tickets IA insuffisants. 
                                <Link href="/shop" className="underline font-semibold ml-1">Rechargez ici.</Link>
                            </p>
                        )}
                    </CardContent>
                );
            default:
                return null;
        }
    };
    
    const getStepTitle = () => {
        switch (step) {
            case 1: return "Sélection du Profil";
            case 2: return "Le Contexte";
            case 3: return `Identité Visuelle (${selectedImages.size}/${MAX_IMAGES})`;
            case 4: return "Identité Rédactionnelle (Optionnel)";
            case 5: return "Récapitulatif & Lancement";
            default: return "";
        }
    };
    
    const getStepDescription = () => {
         switch (step) {
            case 1: return "Pour qui est cette analyse ? Choisissez un profil ou créez-en un nouveau.";
            case 2: return "Dites-nous quel profil analyser et quel est votre objectif principal.";
            case 3: return "Sélectionnez les images qui définissent votre style actuel.";
            case 4: return "Fournissez des exemples de textes pour affiner l'analyse.";
            case 5: return "Vérifiez vos sélections avant de démarrer l'analyse IA.";
            default: return "";
        }
    };
    
    const hasSavedAudits = !areAuditsLoading && savedAudits && savedAudits.length > 0;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-2xl mx-auto space-y-6">
                <header className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight">Coach Stratégique</h1>
                    <p className="text-muted-foreground mt-2">
                        Recevez une analyse complète et un plan d'action personnalisé pour votre profil de réseau social.
                    </p>
                </header>

                <div className="text-center">
                    <Button 
                        variant="outline" 
                        asChild
                        className={cn(
                            hasSavedAudits && "bg-green-600 text-white hover:bg-green-700 hover:text-white"
                        )}
                    >
                        <Link href="/audit/history">
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Voir mes analyses précédentes
                        </Link>
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <Progress value={progress} className="mb-4" />
                        <CardTitle>{getStepTitle()}</CardTitle>
                        <CardDescription>{getStepDescription()}</CardDescription>
                    </CardHeader>
                    
                    {renderStepContent()}
                    
                    <CardFooter className="flex justify-between border-t pt-6">
                        <Button variant="ghost" onClick={prevStep} disabled={step === 1 || isSubmitting}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Précédent
                        </Button>
                        {step < totalSteps ? (
                            <Button 
                                onClick={nextStep} 
                                disabled={
                                    (step === 1 && !canGoToStep2) ||
                                    (step === 2 && !canGoToStep3) ||
                                    (step === 3 && !canGoToStep4) ||
                                    (step === 4 && !canGoToStep5)
                                }
                            >
                                Suivant
                            </Button>
                        ) : (
                           <div></div> // Placeholder to keep spacing
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
