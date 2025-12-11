
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { decrementAiTicketCount, updateImageDescription, type ImageMetadata, type UserProfile } from '@/lib/firestore';
import { Loader2, Sparkles, FileText, Wand2, Instagram, Facebook, MessageSquare, VenetianMask, ShoppingCart, Ticket } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic' | 'ecommerce';

const platformOptions = [
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'facebook', label: 'Facebook', icon: Facebook },
    { id: 'x', label: 'X (Twitter)', icon: MessageSquare },
    { id: 'tiktok', label: 'TikTok', icon: VenetianMask },
    { id: 'ecommerce', label: 'E-commerce', icon: ShoppingCart },
    { id: 'generic', label: 'Générique', icon: Wand2 },
];


interface CreationHubProps {
    lastImage: ImageMetadata;
}

export function CreationHub({ lastImage }: CreationHubProps) {
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false);
    const [generatingForPlatform, setGeneratingForPlatform] = useState<Platform | null>(null);
    const [isSavingDescription, setIsSavingDescription] = useState(false);
    const [currentTitle, setCurrentTitle] = useState('');
    const [currentDescription, setCurrentDescription] = useState('');
    const [hashtagsString, setHashtagsString] = useState('');
    const [wasGeneratedByAI, setWasGeneratedByAI] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, refetch: refetchUserProfile } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        if (lastImage && isDescriptionDialogOpen) {
            setCurrentTitle(lastImage.title || '');
            setCurrentDescription(lastImage.description || '');
            setHashtagsString(lastImage.hashtags || '');
            setWasGeneratedByAI(false);
        }
    }, [lastImage, isDescriptionDialogOpen]);

    const totalAiTickets = useMemo(() => {
        if (!userProfile) return 0;
        return (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0);
    }, [userProfile]);

    const handleGenerateDescription = async (platform: Platform) => {
        if (!lastImage || !user || !userProfile) return;

        if (totalAiTickets <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés', description: <Link href="/shop" className="font-bold underline text-white">Rechargez dans la boutique !</Link> });
            return;
        }

        setGeneratingForPlatform(platform);
        setWasGeneratedByAI(false);
        try {
            const result = await generateImageDescription({ imageUrl: lastImage.directUrl, platform: platform });
            setCurrentTitle(result.title);
            setCurrentDescription(result.description);
            setHashtagsString(result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '));
            setWasGeneratedByAI(true);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'description');
            refetchUserProfile();
            
            toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Un ticket IA a été utilisé.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération n'a pas pu répondre." });
        } finally {
            setGeneratingForPlatform(null);
        }
    };

    const handleSaveDescription = async () => {
        if (!lastImage || !user || !firestore) return;
        setIsSavingDescription(true);

        const dataToSave = {
            title: currentTitle,
            description: currentDescription,
            hashtags: hashtagsString
        };

        try {
            await updateImageDescription(firestore, user.uid, lastImage.id, dataToSave, wasGeneratedByAI);
            toast({ title: 'Description enregistrée', description: 'Les informations de l\'image ont été mises à jour.' });
            setIsDescriptionDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer les informations.' });
        } finally {
            setIsSavingDescription(false);
        }
    };

    return (
        <Card className="bg-gradient-to-br from-primary/5 to-secondary/10 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="text-primary" />
                    Votre dernière création
                </CardTitle>
                <CardDescription>
                    {lastImage.uploadTimestamp ? `Téléversée ${formatDistanceToNow(lastImage.uploadTimestamp.toDate(), { addSuffix: true, locale: fr })}.` : "Téléversement en cours..."}
                    {' '}Prête à être améliorée.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="relative aspect-square rounded-lg overflow-hidden border shadow-md">
                        <Image
                            src={lastImage.directUrl}
                            alt={lastImage.title || lastImage.originalName || 'Dernière image'}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Que voulez-vous faire avec cette image ?</p>
                        <div className="grid grid-cols-1 gap-4">
                            <Link href={`/edit/${lastImage.id}`} passHref>
                                <div className="p-4 border rounded-lg h-full flex flex-col items-start gap-2 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                        <Wand2 className="h-6 w-6" />
                                    </div>
                                    <span className="font-semibold">Éditer avec l'IA</span>
                                    <p className="text-xs text-muted-foreground">Modifiez votre image en décrivant les changements en langage naturel.</p>
                                </div>
                            </Link>

                            <Dialog open={isDescriptionDialogOpen} onOpenChange={setIsDescriptionDialogOpen}>
                                <DialogTrigger asChild>
                                    <div className="p-4 border rounded-lg h-full flex flex-col items-start gap-2 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer">
                                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <span className="font-semibold">Générer une description</span>
                                        <p className="text-xs text-muted-foreground">Créez un titre, une description et des hashtags pertinents pour les réseaux sociaux.</p>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Générer une description</DialogTitle>
                                        <DialogDescription>
                                            Laissez l'IA rédiger un contenu optimisé pour votre dernière image.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Titre</Label>
                                            <Input id="title" placeholder="Titre généré..." value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} disabled={!!generatingForPlatform || isSavingDescription} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="description">Description</Label>
                                            <Textarea id="description" placeholder="Description générée..." value={currentDescription} onChange={(e) => setCurrentDescription(e.target.value)} rows={4} disabled={!!generatingForPlatform || isSavingDescription} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="hashtags">Hashtags</Label>
                                            <Textarea id="hashtags" placeholder="#hashtags #générés..." value={hashtagsString} onChange={(e) => setHashtagsString(e.target.value)} rows={2} disabled={!!generatingForPlatform || isSavingDescription} />
                                        </div>
                                        <Separator />
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label>Optimisation IA pour... (1 Ticket)</Label>
                                                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                                    <Ticket className="h-4 w-4" />
                                                    <span>{totalAiTickets} restants</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {platformOptions.map(({ id, label, icon: Icon }) => (
                                                    <Button
                                                        key={id}
                                                        variant="outline"
                                                        onClick={() => handleGenerateDescription(id as Platform)}
                                                        disabled={generatingForPlatform === id || isSavingDescription || totalAiTickets <= 0}
                                                        className="justify-start"
                                                    >
                                                        {generatingForPlatform === id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
                                                        {label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="secondary" onClick={() => setIsDescriptionDialogOpen(false)} disabled={isSavingDescription}>Annuler</Button>
                                        <Button onClick={handleSaveDescription} disabled={isSavingDescription || !!generatingForPlatform}>
                                            {isSavingDescription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
