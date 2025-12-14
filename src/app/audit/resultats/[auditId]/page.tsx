
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from '@/firebase';
import { doc, addDoc, collection, getDoc, DocumentReference, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, CustomPrompt } from '@/lib/firestore';
import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Image as ImageIcon, Undo2, Redo2, Video, Ticket, Copy, FilePlus, Calendar as CalendarIcon, Trash2, HelpCircle, ChevronDown, Library, Text, Facebook, Instagram, MessageSquare, VenetianMask, Lightbulb, Pencil, FileText } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { editImage, generateImage } from '@/ai/flows/generate-image-flow';
import { generateVideo } from '@/ai/flows/generate-video-flow';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { decrementAiTicketCount, saveImageMetadata, savePostForLater } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { withErrorHandling } from '@/lib/async-wrapper';
import { socialAuditFlow, type SocialAuditOutput } from '@/ai/flows/social-audit-flow';
import type { SocialAuditInput, CreativeSuggestion } from '@/ai/schemas/social-audit-schemas';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';


type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic' | 'ecommerce';

// On utilise le type importé
// type CreativeSuggestion = { ... };

type AuditReport = Omit<SocialAuditOutput, 'creative_suggestions'> & {
    createdAt: any; // Timestamp
    platform: string;
    goal: string;
    subjectImageUrls?: string[];
    image_urls?: string[];
    post_texts?: string[];
    additionalContext?: string;
    brandProfileId: string;
    creative_suggestions: CreativeSuggestion[];
}

// Helper pour convertir Data URI en Blob
async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

interface ImageHistoryItem {
    imageUrl: string;
    prompt: string;
}


export default function AuditResultPage() {
    const { user, isUserLoading, firebaseApp } = useFirebase();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const auditId = params.auditId as string;

    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [videoAspectRatio, setVideoAspectRatio] = useState('9:16');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    
    // Historique des images et descriptions générées
    const [generatedImageHistory, setGeneratedImageHistory] = useState<ImageHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    
    const [activeSuggestion, setActiveSuggestion] = useState<CreativeSuggestion | null>(null);

    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [creativeSuggestions, setCreativeSuggestions] = useState<CreativeSuggestion[]>([]);
    
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
    const [isScheduling, setIsScheduling] = useState(false);

    const auditDocRef = useMemoFirebase(() => {
        if (!user || !firestore || !auditId) return null;
        return doc(firestore, `users/${user.uid}/audits`, auditId);
    }, [user, firestore, auditId]);
    
    const { data: auditReport, isLoading: isAuditLoading, refetch: refetchAuditReport } = useDoc<AuditReport>(auditDocRef);
    
    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, refetch: refetchUserProfile } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login?redirect=/audit');
        }
    }, [isUserLoading, user, router]);

    useEffect(() => {
        if (auditReport?.creative_suggestions) {
            setCreativeSuggestions(auditReport.creative_suggestions);
            if (auditReport.creative_suggestions.length > 0 && prompt === '') {
                 setPrompt(auditReport.creative_suggestions[0].image_prompt || '');
                 setActiveSuggestion(auditReport.creative_suggestions[0]);
            }
        }
    }, [auditReport, prompt]);
    
    const currentHistoryItem = useMemo(() => {
        if (historyIndex >= 0 && historyIndex < generatedImageHistory.length) {
            return generatedImageHistory[historyIndex];
        }
        return null;
    }, [generatedImageHistory, historyIndex]);

    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0) : 0;
    
    const handleGeneratePlan = async () => {
        if (!auditReport || !user || !firestore || !userProfile || !auditDocRef) return;
    
        const cost = 14;
        if (totalAiTickets < cost) {
            toast({ variant: 'destructive', title: 'Tickets IA insuffisants', description: `Cette action requiert ${cost} tickets.` });
            return;
        }
    
        setIsGeneratingPlan(true);
        try {
            const input: SocialAuditInput = {
                platform: auditReport.platform,
                goal: auditReport.goal,
                image_urls: auditReport.image_urls || [],
                subject_image_urls: auditReport.subjectImageUrls,
                post_texts: auditReport.post_texts || [],
                additionalContext: auditReport.additionalContext,
                suggestion_count: 14,
            };
            
            const result = await socialAuditFlow(input);
            
            if (result.creative_suggestions && auditDocRef) {
                await updateDoc(auditDocRef, {
                    creative_suggestions: result.creative_suggestions
                });
                refetchAuditReport();
            } else {
                setCreativeSuggestions([]);
            }
    
            for (let i = 0; i < cost; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            refetchUserProfile();
            toast({ title: 'Plan de contenu généré !', description: `${cost} idées ont été créées. ${cost} ticket(s) IA utilisé(s).` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGeneratingPlan(false);
        }
    };


    const handleGenerateImage = async () => {
        if (!prompt?.trim() || !user || !userProfile || !firestore || !auditReport) return;
    
        if (totalAiTickets <= 0) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: (<Link href="/shop" className="font-bold underline text-white">Rechargez dans la boutique !</Link>),
            });
            return;
        }
    
        setIsGenerating(true);
        setGeneratedVideoUrl(null); 
    
        try {
            let result;
            if (auditReport.subjectImageUrls && auditReport.subjectImageUrls.length > 0) {
                const baseImageUrl = auditReport.subjectImageUrls[0];
                result = await editImage({ imageUrl: baseImageUrl, prompt });
            } else {
                result = await generateImage({ prompt, aspectRatio: aspectRatio });
            }
            
            const newHistoryItem: ImageHistoryItem = {
                imageUrl: result.imageUrl,
                prompt: prompt,
            };
    
            const newHistory = generatedImageHistory.slice(0, historyIndex + 1);
            newHistory.push(newHistoryItem);
            setGeneratedImageHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();
            toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!prompt || !user || !userProfile || !firestore) return;

        const VIDEO_COST = 5;
        if (totalAiTickets < VIDEO_COST) {
            toast({
                variant: 'destructive',
                title: `Tickets IA insuffisants (${VIDEO_COST} requis)`,
                description: (<Link href="/shop" className="font-bold underline text-white">Rechargez dans la boutique !</Link>),
            });
            return;
        }

        setIsGeneratingVideo(true);
        setGeneratedImageHistory([]); 
        setHistoryIndex(-1);

        try {
            const result = await generateVideo({
                prompt: prompt,
                aspectRatio: videoAspectRatio,
                durationSeconds: 5,
            });
            setGeneratedVideoUrl(result.videoUrl);

            for (let i = 0; i < VIDEO_COST; i++) {
                await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            }
            refetchUserProfile();
            toast({ title: 'Vidéo générée !', description: `${VIDEO_COST} tickets IA ont été utilisés.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération vidéo', description: (error as Error).message });
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    
    const handleUndoGeneration = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        }
    };

    const handleRedoGeneration = () => {
        if (historyIndex < generatedImageHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };

    const saveGeneratedImageAndPlan = async (isDraft: boolean, date?: Date) => {
        if (!currentHistoryItem || !user || !firebaseApp || !firestore || !auditReport || !activeSuggestion) return;
        
        const setLoading = isDraft ? setIsSavingDraft : setIsScheduling;
        setLoading(true);

        try {
            
            const newTitle = activeSuggestion.title;
            const newDescription = activeSuggestion.post_description;
            
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(currentHistoryItem.imageUrl);
            const newFileName = `ai-creation-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${currentHistoryItem.prompt}`, () => {});
            
            const newImageDocRef = await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: newTitle,
                description: newDescription,
                hashtags: activeSuggestion.hashtags,
                generatedByAI: true
            });

            const newImageSnap = await getDoc(newImageDocRef);
            if (!newImageSnap.exists()) {
                throw new Error("L'image nouvellement créée est introuvable.");
            }
            const newImageMetadata = newImageSnap.data() as ImageMetadata;
            
            await savePostForLater(firestore, storage, user.uid, {
                title: isDraft ? 'Brouillon généré par IA' : `Post du ${format(date!, 'd MMMM')}`,
                description: newDescription,
                scheduledAt: isDraft ? undefined : date,
                imageSource: newImageMetadata,
                auditId: auditId,
                brandProfileId: auditReport.brandProfileId,
            });

            if (isDraft) {
                toast({ title: "Brouillon sauvegardé !", description: "Retrouvez-le dans votre Planificateur." });
            } else {
                toast({ title: "Publication programmée !", description: `Retrouvez-la dans votre Planificateur pour le ${format(date!, 'PPP', { locale: fr })}.` });
                setScheduleDate(undefined);
            }

        } catch (error) {
            withErrorHandling(() => { throw error; }); // Wrapper pour le logging
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = () => saveGeneratedImageAndPlan(true);
    const handleSchedule = () => {
        if (scheduleDate) {
            saveGeneratedImageAndPlan(false, scheduleDate);
        }
    };


    const handleSaveToLibrary = async () => {
        if (!currentHistoryItem || !user || !firebaseApp || !firestore || !activeSuggestion) return;
        setIsSaving(true);
        
        const { error } = await withErrorHandling(async () => {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(currentHistoryItem.imageUrl);
            const newFileName = `ai-creation-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${currentHistoryItem.prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: activeSuggestion.title,
                description: activeSuggestion.post_description,
                hashtags: activeSuggestion.hashtags,
                generatedByAI: true
            });
        });

        if (!error) {
            toast({ title: "Sauvegardé dans la bibliothèque !", description: "Votre création a été ajoutée à votre galerie principale." });
        }
        setIsSaving(false);
    };

    if (isUserLoading || isAuditLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!auditReport) {
        return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Rapport introuvable</h1>
                 <p className="text-muted-foreground">Le rapport que vous cherchez n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/audit">Retourner au Coach Stratégique</Link>
                 </Button>
            </div>
        );
    }
    
    const StepIndicator = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
        <div className="flex items-start gap-4">
            <div className="flex flex-col items-center self-start pt-1">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-base">{step}</div>
                <div className="w-px h-full bg-border mt-2"></div>
            </div>
            <div className="flex-1 pb-8">
                <h4 className="font-semibold text-lg mb-2">{title}</h4>
                {children}
            </div>
        </div>
    );

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                 <header className="space-y-2">
                        <Button variant="ghost" asChild className="mb-4 -ml-4">
                            <Link href="/audit/history">
                                <ArrowLeft className="mr-2 h-4 w-4"/>
                                Retour à l'historique
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">Rapport d'Analyse IA</h1>
                        <p className="text-muted-foreground">
                            Analyse pour un profil <span className="font-semibold text-primary">{auditReport.platform}</span> avec pour objectif : <span className="font-semibold text-primary">"{auditReport.goal}"</span>.
                        </p>
                </header>

                <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><LucideIcons.Bot className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Identité Visuelle</CardTitle>
                            <CardDescription>La perception de votre style par l'IA.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-sm mb-2">Mots-clés de votre style :</h4>
                            <div className="flex flex-wrap gap-2">
                                {auditReport.visual_identity.keywords.map((keyword, index) => (
                                    <span key={index} className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">{keyword}</span>
                                ))}
                            </div>
                        </div>
                         <Separator />
                        <div>
                             <h4 className="font-semibold text-sm mb-2">Synthèse de l'IA :</h4>
                            <p className="text-sm whitespace-pre-wrap">{auditReport.visual_identity.summary}</p>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                     <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><LucideIcons.Target className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Analyse Stratégique</CardTitle>
                            <CardDescription>Vos points forts et axes d'amélioration.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-semibold text-base mb-2 text-green-600">Points Forts</h4>
                             <ul className="space-y-2 text-sm list-disc pl-5">
                                {auditReport.strategic_analysis.strengths.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-2 text-amber-600">Axes d'Amélioration</h4>
                            <ul className="space-y-2 text-sm list-disc pl-5">
                                {auditReport.strategic_analysis.improvements.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><LucideIcons.BookOpen className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Stratégie de Contenu</CardTitle>
                            <CardDescription>3 idées de publications pour atteindre votre objectif.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                       {auditReport.content_strategy.map((item, index) => (
                            <div key={index}>
                                <h4 className="font-semibold">{index + 1}. {item.idea}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><LucideIcons.ListChecks className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Plan d'Action sur 7 Jours</CardTitle>
                            <CardDescription>Un programme simple pour commencer dès aujourd'hui.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-4">
                            {auditReport.action_plan.map((item, index) => (
                                <li key={index} className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                                    <div className="flex flex-col items-center">
                                        <span className="font-bold text-lg text-primary">{item.day.split(' ')[1]}</span>
                                        <span className="text-xs text-muted-foreground">{item.day.split(' ')[0]}</span>
                                    </div>
                                    <p className="flex-1 mt-1 text-sm">{item.action}</p>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                     <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg text-primary"><Wand2 className="h-6 w-6"/></div>
                            <div>
                                <CardTitle>Passez à l'action</CardTitle>
                                <CardDescription>Générez vos futures publications à partir du plan de l'IA.</CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="flex items-center gap-2 text-sm font-semibold h-fit py-1.5 px-3">
                            <Ticket className="h-4 w-4 text-primary" />
                            <span>{totalAiTickets} restants</span>
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        <StepIndicator step={1} title="Générer des idées de contenu">
                            <div className="p-4 bg-background border rounded-lg space-y-4">
                                <Button onClick={handleGeneratePlan} disabled={isGeneratingPlan || totalAiTickets < 14} className="w-full">
                                    {isGeneratingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                    Générer un plan de contenu sur 14 jours
                                </Button>
                                <ScrollArea className="h-40 border bg-muted/50 rounded-md p-2">
                                    {creativeSuggestions.length > 0 ? (
                                        <div className="space-y-2 p-2">
                                            {creativeSuggestions.map((suggestion, index) => (
                                                <Card key={index} className="bg-background">
                                                    <CardHeader className="p-3 pb-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <CardTitle className="text-base flex items-center gap-2">
                                                                <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded-full">Jour {suggestion.day}</span>
                                                                <span className="flex-1 truncate">{suggestion.title}</span>
                                                            </CardTitle>
                                                             <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-auto px-2 py-1 text-xs">
                                                                        <FileText className="mr-1 h-3 w-3 text-green-500" />
                                                                        Prompt
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Instruction pour l'image (Prompt)</DialogTitle>
                                                                        <DialogDescription>
                                                                            Voici l'instruction complète qui sera utilisée par l'IA pour générer l'image de ce post.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="py-4">
                                                                        <p className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap">{suggestion.image_prompt}</p>
                                                                    </div>
                                                                    <DialogFooter>
                                                                        <DialogClose asChild>
                                                                            <Button>Fermer</Button>
                                                                        </DialogClose>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-3 pt-0">
                                                        <p className="text-sm text-muted-foreground line-clamp-2">{suggestion.post_description}</p>
                                                        <p className="text-xs text-primary/80 mt-2 truncate">{suggestion.hashtags}</p>
                                                    </CardContent>
                                                    <CardFooter className="p-3 pt-0">
                                                        <Button size="sm" variant="secondary" className="w-full" onClick={() => { setPrompt(suggestion.image_prompt || ''); setActiveSuggestion(suggestion); toast({ title: "Suggestion chargée !", description: "L'instruction et le texte sont prêts." }); }}>
                                                            <Copy className="mr-2 h-4 w-4"/> Charger la suggestion
                                                        </Button>
                                                    </CardFooter>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                            Cliquez sur "Générer le Plan" pour voir les suggestions ici.
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </StepIndicator>

                        <StepIndicator step={2} title="Personnaliser le prompt de l'image">
                             <div className="space-y-2">
                                <Label htmlFor="prompt-input">Votre instruction pour l'IA</Label>
                                <Textarea id="prompt-input" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Chargez une idée ou écrivez directement votre prompt..."/>
                            </div>
                        </StepIndicator>

                        <StepIndicator step={3} title="Créer l'image">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isGenerating || isGeneratingVideo}>
                                        <SelectTrigger><SelectValue placeholder="Format de l'image" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1:1">Publication (1:1)</SelectItem>
                                            <SelectItem value="9:16">Story / Réel (9:16)</SelectItem>
                                            <SelectItem value="4:5">Portrait (4:5)</SelectItem>
                                            <SelectItem value="16:9">Paysage (16:9)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        onClick={() => handleGenerateImage()}
                                        disabled={isGenerating || isGeneratingVideo || !prompt?.trim() || totalAiTickets <= 0}
                                        className={cn("w-full","bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity")}
                                    >
                                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ImageIcon className="mr-2 h-4 w-4" />}
                                        Générer Image (1 Ticket)
                                    </Button>
                                </div>
                                {(totalAiTickets <= 0 && !isGenerating && !isGeneratingVideo) && (
                                    <p className="text-center text-sm text-destructive">
                                        Tickets IA insuffisants. <Link href="/shop" className="underline font-semibold">Rechargez ici.</Link>
                                    </p>
                                )}
                                <div className="aspect-video w-full relative rounded-lg border bg-muted flex items-center justify-center shadow-inner mt-4">
                                    {(isGenerating || isGeneratingVideo) && <Loader2 className="h-10 w-10 text-primary animate-spin" />}
                                    
                                    {!isGenerating && !isGeneratingVideo && currentHistoryItem?.imageUrl && (
                                        <Image src={currentHistoryItem.imageUrl} alt="Image générée par l'IA" fill className="object-contain" unoptimized />
                                    )}
                                    {!isGenerating && !isGeneratingVideo && generatedVideoUrl && (
                                        <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-full object-contain rounded-lg" />
                                    )}

                                    {!isGenerating && !isGeneratingVideo && !currentHistoryItem?.imageUrl && !generatedVideoUrl && (
                                        <div className="text-center text-muted-foreground p-4">
                                            <ImageIcon className="h-10 w-10 mx-auto mb-2"/>
                                            <p className="text-sm">Votre création apparaîtra ici.</p>
                                        </div>
                                    )}

                                    {!isGenerating && !isGeneratingVideo && generatedImageHistory.length > 0 && (
                                        <div className="absolute top-2 left-2 z-10 flex gap-2">
                                            <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="bg-background/80" aria-label="Annuler la dernière génération" disabled={historyIndex <= 0}>
                                                <Undo2 className="h-5 w-5" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="bg-background/80" aria-label="Rétablir la génération" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                                <Redo2 className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {currentHistoryItem && activeSuggestion && (
                                    <div className="mt-4 p-4 border rounded-lg bg-background space-y-3">
                                        <div>
                                            <Label className="text-xs font-semibold text-muted-foreground">Titre</Label>
                                            <p className="text-sm font-medium">{activeSuggestion.title}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs font-semibold text-muted-foreground">Description Suggérée</Label>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activeSuggestion.post_description}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs font-semibold text-muted-foreground">Hashtags Suggérés</Label>
                                            <p className="text-sm text-primary">{activeSuggestion.hashtags}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </StepIndicator>

                    </CardContent>
                    <CardFooter className="border-t pt-6">
                        <div className="w-full space-y-4">
                             <div className="flex items-start gap-4">
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-base flex-shrink-0">4</div>
                                <h4 className="font-semibold text-lg pt-0.5">Finaliser et Sauvegarder</h4>
                            </div>
                            <div className="pl-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                <Button 
                                    onClick={handleSaveToLibrary}
                                    disabled={isSaving || isScheduling || isSavingDraft || !currentHistoryItem}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    variant="secondary"
                                >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Sauvegarder
                                </Button>
                                <Button 
                                    onClick={handleSaveDraft}
                                    disabled={isSavingDraft || isScheduling || isSaving || !currentHistoryItem}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    {isSavingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FilePlus className="mr-2 h-4 w-4" />}
                                    Enregistrer en brouillon
                                </Button>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}
                                            disabled={isSavingDraft || isScheduling || isSaving || !currentHistoryItem}
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
                                                onClick={handleSchedule} 
                                                disabled={!scheduleDate || isScheduling}
                                                className="w-full"
                                            >
                                                {isScheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CalendarIcon className="mr-2 h-4 w-4"/>}
                                                Confirmer
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardFooter>
                </Card>

            </div>
        </div>
    );
}


    