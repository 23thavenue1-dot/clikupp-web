
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, Bot, Target, BookOpen, ListChecks, Wand2, Save, ShoppingCart, Image as ImageIcon, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { type SocialAuditOutput } from '@/ai/schemas/social-audit-schemas';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { generateImage, editImage } from '@/ai/flows/generate-image-flow';
import type { UserProfile } from '@/lib/firestore';
import { decrementAiTicketCount, saveImageMetadata } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';

type AuditReport = SocialAuditOutput & {
    createdAt: any; // Timestamp
    platform: string;
    goal: string;
    subjectImageUrls?: string[]; // Add subjectImageUrls here
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
    const [isSaving, setIsSaving] = useState(false);
    
    // Nouveaux états pour l'historique
    const [generatedImageHistory, setGeneratedImageHistory] = useState<ImageHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const auditDocRef = useMemoFirebase(() => {
        if (!user || !firestore || !auditId) return null;
        return doc(firestore, `users/${user.uid}/audits`, auditId);
    }, [user, firestore, auditId]);
    
    const { data: auditReport, isLoading: isAuditLoading } = useDoc<AuditReport>(auditDocRef);
    
    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        if (auditReport?.creative_suggestion?.suggested_post_prompt) {
            setPrompt(auditReport.creative_suggestion.suggested_post_prompt);
        }
    }, [auditReport]);
    
    const currentHistoryItem = useMemo(() => {
        if (historyIndex >= 0 && historyIndex < generatedImageHistory.length) {
            return generatedImageHistory[historyIndex];
        }
        return null;
    }, [generatedImageHistory, historyIndex]);

    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0) : 0;

    const handleGenerateImage = async () => {
        if (!prompt || !user || !userProfile || !firestore || !auditReport) return;
    
        if (totalAiTickets <= 0) {
            toast({
                variant: 'destructive',
                title: 'Tickets IA épuisés',
                description: (<Link href="/shop" className="font-bold underline text-white">Rechargez dans la boutique !</Link>),
            });
            return;
        }
    
        setIsGenerating(true);
    
        try {
            let result;
            // Si des images de référence du sujet existent, on les utilise avec editImage.
            if (auditReport.subjectImageUrls && auditReport.subjectImageUrls.length > 0) {
                // Pour l'instant, on prend la première image de référence comme base, mais on pourrait
                // utiliser une logique plus complexe pour combiner les infos.
                const baseImageUrl = auditReport.subjectImageUrls[0];
                result = await editImage({ imageUrl: baseImageUrl, prompt });
            } else {
                // Sinon, on génère de zéro.
                result = await generateImage({ prompt, aspectRatio: '1:1' });
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
            toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleUndoGeneration = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        } else if (historyIndex === 0) {
             setHistoryIndex(-1); // Revenir à l'état initial
        }
    };

    const handleRedoGeneration = () => {
        if (historyIndex < generatedImageHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };


    const handleSaveImage = async () => {
        if (!currentHistoryItem || !prompt || !user || !firebaseApp || !firestore) return;
        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(currentHistoryItem.imageUrl);
            const newFileName = `ai-audit-generated-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: blob.type });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `Généré (Audit): ${prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: `Généré par l'IA : ${auditReport?.platform}`,
                description: prompt,
                hashtags: auditReport?.visual_identity.keywords.map(k => `#${k.replace(/\s+/g, '')}`).join(' ') || '',
                generatedByAI: true
            });

            toast({ title: "Image sauvegardée !", description: "Votre nouvelle création a été ajoutée à votre galerie principale." });
            
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isUserLoading || isAuditLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user) {
        router.push('/login');
        return null;
    }
    
    if (!auditReport) {
        return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Rapport introuvable</h1>
                 <p className="text-muted-foreground">Le rapport d'analyse que vous cherchez n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/audit">Retourner au Coach Stratégique</Link>
                 </Button>
            </div>
        );
    }
    
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
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><Bot className="h-6 w-6"/></div>
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
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><Target className="h-6 w-6"/></div>
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
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><BookOpen className="h-6 w-6"/></div>
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
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><ListChecks className="h-6 w-6"/></div>
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

                {/* --- NOUVEAU MODULE DE GÉNÉRATION --- */}
                <Card className="bg-primary/5 border-primary/20">
                     <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><Wand2 className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Passez à l'action</CardTitle>
                            <CardDescription>Utilisez la suggestion de l'IA pour générer votre prochaine publication.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label htmlFor="suggested-prompt" className="text-sm font-medium">Suggestion de l'IA pour votre prochaine image :</label>
                            <Textarea 
                                id="suggested-prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                className="mt-2 bg-background"
                                placeholder="Décrivez l'image à générer..."
                            />
                        </div>
                        <Button 
                            onClick={handleGenerateImage}
                            disabled={isGenerating || !prompt.trim() || totalAiTickets <= 0}
                            className="w-full"
                        >
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Générer l'image (1 Ticket IA)
                        </Button>
                         {totalAiTickets <= 0 && !isGenerating && (
                            <p className="text-center text-sm text-destructive">
                                Tickets IA insuffisants. <Link href="/shop" className="underline font-semibold">Rechargez ici.</Link>
                            </p>
                        )}

                        <div className="aspect-square w-full relative rounded-lg border bg-muted flex items-center justify-center shadow-inner mt-4">
                            {isGenerating && <Loader2 className="h-10 w-10 text-primary animate-spin" />}
                            {!isGenerating && currentHistoryItem?.imageUrl && <Image src={currentHistoryItem.imageUrl} alt="Image générée par l'IA" fill className="object-contain" unoptimized />}
                             {!isGenerating && !currentHistoryItem?.imageUrl && (
                                <div className="text-center text-muted-foreground p-4">
                                    <ImageIcon className="h-10 w-10 mx-auto mb-2"/>
                                    <p className="text-sm">Votre image apparaîtra ici.</p>
                                </div>
                            )}

                             {!isGenerating && generatedImageHistory.length > 0 && (
                                <div className="absolute top-2 left-2 z-10 flex gap-2">
                                    <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="bg-background/80" aria-label="Annuler la dernière génération" disabled={historyIndex < 0}>
                                        <Undo2 className="h-5 w-5" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="bg-background/80" aria-label="Rétablir la génération" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                        <Redo2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            )}
                        </div>

                    </CardContent>
                    {currentHistoryItem && (
                        <CardFooter>
                            <Button 
                                onClick={handleSaveImage} 
                                disabled={isSaving}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Sauvegarder dans ma galerie
                            </Button>
                        </CardFooter>
                    )}
                </Card>

            </div>
        </div>
    );
}
