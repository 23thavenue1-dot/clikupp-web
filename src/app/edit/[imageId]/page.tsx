
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirebaseApp, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { ImageMetadata, UserProfile, CustomPrompt } from '@/lib/firestore';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Save, Wand2, ShoppingCart, Image as ImageIcon, Undo2, Redo2, Star, Trash2, Pencil, X, HelpCircle, FileText as FileTextIcon, Ticket } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { decrementAiTicketCount, saveImageMetadata, saveCustomPrompt, deleteCustomPrompt, updateCustomPrompt, updateImageDescription } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, addMonths, startOfMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestionCategories } from '@/lib/ai-prompts';
import { editImage } from '@/ai/flows/generate-image-flow';
import { Separator } from '@/components/ui/separator';

type ImageHistoryItem = {
    imageUrl: string;
    prompt: string;
    title: string;
    description: string;
    hashtags: string;
};

type IconName = keyof typeof LucideIcons;

const getIcon = (name: string): React.FC<LucideIcons.LucideProps> => {
  const Icon = LucideIcons[name as IconName];
  return Icon || LucideIcons.HelpCircle;
};

async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

export default function EditImagePage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading } = useUser();
    const firebaseApp = useFirebaseApp();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [prompt, setPrompt] = useState('');
    const [refinePrompt, setRefinePrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [generatedImageHistory, setGeneratedImageHistory] = useState<ImageHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const [isSaving, setIsSaving] = useState(false);
    
    const [isSavePromptDialogOpen, setIsSavePromptDialogOpen] = useState(false);
    const [newPromptName, setNewPromptName] = useState("");
    const [promptToSave, setPromptToSave] = useState("");
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);

    const [isDeletePromptDialogOpen, setIsDeletePromptDialogOpen] = useState(false);
    const [promptToDelete, setPromptToDelete] = useState<CustomPrompt | null>(null);
    const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

    const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false);
    const [promptToEdit, setPromptToEdit] = useState<CustomPrompt | null>(null);
    const [editedPromptName, setEditedPromptName] = useState("");
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);

    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: originalImage, isLoading: isImageLoading } = useDoc<ImageMetadata>(imageDocRef);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading, refetch: refetchUserProfile } = useDoc<UserProfile>(userDocRef);

    const totalAiTickets = userProfile ? (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0) : 0;
    
    const currentHistoryItem = useMemo(() => {
        if (historyIndex >= 0 && historyIndex < generatedImageHistory.length) {
            return generatedImageHistory[historyIndex];
        }
        return null;
    }, [generatedImageHistory, historyIndex]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleGenerateImage = async (promptToUse: string) => {
        if (!promptToUse.trim() || !user || !userProfile || !firestore || !originalImage) return;

        if (totalAiTickets <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés', description: (<Link href="/shop" className="font-bold underline text-white">Rechargez</Link>), });
            return;
        }

        setIsGenerating(true);
        try {
            const baseImageUrl = originalImage.directUrl;
            const result = await editImage({ imageUrl: baseImageUrl, prompt: promptToUse });
            
            const newHistoryItem: ImageHistoryItem = {
                imageUrl: result.imageUrl,
                prompt: promptToUse,
                title: originalImage.title || '',
                description: originalImage.description || '',
                hashtags: originalImage.hashtags || ''
            };

            setGeneratedImageHistory([newHistoryItem]);
            setHistoryIndex(0);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();

            toast({ title: 'Nouvelle version générée !', description: 'Un ticket IA a été utilisé.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleRefineImage = async () => {
        if (!refinePrompt.trim() || !currentHistoryItem || !user || !userProfile || !firestore || !originalImage) return;

        if (totalAiTickets <= 0) {
            toast({ variant: 'destructive', title: 'Tickets IA épuisés' });
            return;
        }

        setIsGenerating(true);
        try {
            const baseImageUrl = currentHistoryItem.imageUrl;
            const result = await editImage({ imageUrl: baseImageUrl, prompt: refinePrompt });
            
            const newHistoryItem: ImageHistoryItem = {
                imageUrl: result.imageUrl,
                prompt: refinePrompt,
                title: currentHistoryItem.title,
                description: currentHistoryItem.description,
                hashtags: currentHistoryItem.hashtags
            };

            const newHistory = generatedImageHistory.slice(0, historyIndex + 1);
            newHistory.push(newHistoryItem);
            setGeneratedImageHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
            refetchUserProfile();
            
            setRefinePrompt('');
            toast({ title: 'Image affinée !', description: 'Un ticket IA a été utilisé.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de génération', description: (error as Error).message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUndoGeneration = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        } else if (historyIndex === 0) { // Si on est sur la première génération, on revient à l'état initial
             setHistoryIndex(-1);
             setGeneratedImageHistory([]);
        }
    };

    const handleRedoGeneration = () => {
        if (historyIndex < generatedImageHistory.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };

    const handleSaveAiCreation = async () => {
        const imageToSave = currentHistoryItem;
        if (!imageToSave || !user || !firebaseApp || !firestore || !originalImage) return;
        
        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const blob = await dataUriToBlob(imageToSave.imageUrl);
            const newFileName = `ai-edited-${Date.now()}.png`;
            const imageFile = new File([blob], newFileName, { type: 'image/png' });

            const metadata = await uploadFileAndGetMetadata(storage, user, imageFile, `IA: ${imageToSave.prompt}`, () => {});
            
            await saveImageMetadata(firestore, user, { 
                ...metadata,
                title: imageToSave.title,
                description: imageToSave.description,
                hashtags: imageToSave.hashtags,
                generatedByAI: true
            });
            toast({ title: "Nouvelle création enregistrée !", description: "Votre nouvelle image et sa description ont été ajoutées à votre galerie." });

        } catch (error) {
            console.error("Erreur lors de la sauvegarde :", error);
            toast({ variant: 'destructive', title: 'Erreur de sauvegarde', description: "Impossible d'enregistrer les modifications." });
        } finally {
            setIsSaving(false);
        }
    };

    const openSavePromptDialog = () => {
        const activePrompt = prompt.trim();
        if (!activePrompt) return;
        setPromptToSave(activePrompt);
        setNewPromptName("");
        setIsSavePromptDialogOpen(true);
    };

    const handleSavePrompt = async () => {
        if (!promptToSave || !newPromptName.trim() || !user || !firestore) return;
        setIsSavingPrompt(true);

        const newCustomPrompt: CustomPrompt = { id: `prompt_${Date.now()}`, name: newPromptName, value: promptToSave };
        try {
            await saveCustomPrompt(firestore, user.uid, newCustomPrompt);
            toast({ title: "Prompt sauvegardé", description: `"${newPromptName}" a été ajouté à 'Mes Prompts'.` });
            setIsSavePromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder le prompt.' });
        } finally {
            setIsSavingPrompt(false);
        }
    };

    const openDeletePromptDialog = (p: CustomPrompt) => { setPromptToDelete(p); setIsDeletePromptDialogOpen(true); };
    const handleDeletePrompt = async () => {
        if (!promptToDelete || !user || !firestore) return;
        setIsDeletingPrompt(true);
        try {
            await deleteCustomPrompt(firestore, user.uid, promptToDelete);
            toast({ title: "Prompt supprimé" });
            setIsDeletePromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer le prompt.' });
        } finally {
            setIsDeletingPrompt(false);
        }
    };
    
    const openEditPromptDialog = (p: CustomPrompt) => { setPromptToEdit(p); setEditedPromptName(p.name); setIsEditPromptDialogOpen(true); };
    const handleEditPrompt = async () => {
        if (!promptToEdit || !editedPromptName.trim() || !user || !firestore) return;
        setIsEditingPrompt(true);
        const updatedPrompt = { ...promptToEdit, name: editedPromptName };
        try {
            await updateCustomPrompt(firestore, user.uid, updatedPrompt);
            toast({ title: "Prompt renommé" });
            setIsEditPromptDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de renommer le prompt.' });
        } finally {
            setIsEditingPrompt(false);
        }
    };

    if (isUserLoading || isImageLoading || isProfileLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!originalImage) {
         return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Image introuvable</h1>
                 <p className="text-muted-foreground">Le rapport que vous cherchez n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }

    const hasAiTickets = totalAiTickets > 0;
    const monthlyLimitReached = !!(userProfile && userProfile.aiTicketMonthlyCount >= 20 && totalAiTickets <= 0);
    const nextRefillDate = userProfile?.aiTicketMonthlyReset ? format(addMonths(startOfMonth(userProfile.aiTicketMonthlyReset.toDate()), 1), "d MMMM", { locale: fr }) : 'prochain mois';

    return (
        <div className="flex flex-col md:flex-row h-screen bg-background">
            
            <main className="flex-1 flex flex-col p-4 lg:p-6 space-y-6 overflow-y-auto">
                <header className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                       <Link href={`/image/${imageId}`}>
                           <ArrowLeft className="mr-2 h-4 w-4"/>
                           Retour à l'image
                       </Link>
                   </Button>
                    <div className="text-center">
                       <h1 className="text-lg font-semibold tracking-tight">Éditeur d'Image par IA</h1>
                       <p className="text-xs text-muted-foreground">Transformez vos images en décrivant simplement les changements souhaités.</p>
                   </div>
                    <Button variant="outline" className="h-8 text-sm" asChild>
                        <Link href="/shop">
                            <Ticket className="mr-2 h-4 w-4 text-primary" />
                            {totalAiTickets} Tickets IA
                        </Link>
                   </Button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 flex-1">
                    <div className="flex flex-col gap-2">
                        <Badge variant="secondary" className="w-fit mx-auto">AVANT</Badge>
                        <div className="aspect-square w-full relative rounded-lg border bg-muted overflow-hidden shadow-sm">
                            <Image src={originalImage.directUrl} alt="Image originale" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" unoptimized/>
                        </div>
                    </div>
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-4 relative h-6">
                            <Badge className="w-fit mx-auto">APRÈS</Badge>
                             {!isGenerating && generatedImageHistory.length > 0 && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                                    <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="h-7 w-7 bg-background/80" aria-label="Annuler la dernière génération" disabled={historyIndex < 0}>
                                        <Undo2 className="h-5 w-5" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="h-7 w-7 bg-background/80" aria-label="Rétablir la génération" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                        <Redo2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="aspect-square w-full relative rounded-lg border bg-muted flex items-center justify-center shadow-inner mt-4">
                            {isGenerating && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
                            {!isGenerating && currentHistoryItem?.imageUrl && (
                                <Image src={currentHistoryItem.imageUrl} alt="Image générée par l'IA" fill className="object-contain" unoptimized />
                            )}
                            {!isGenerating && !currentHistoryItem?.imageUrl && (
                                <div className="text-center text-muted-foreground p-4">
                                    <ImageIcon className="h-10 w-10 mx-auto mb-2"/>
                                    <p className="text-sm">Votre création apparaîtra ici.</p>
                                </div>
                            )}
                        </div>
                         {currentHistoryItem && (
                            <div className="pt-4 space-y-3 border-t mt-4">
                                <Label htmlFor="refine-prompt" className="text-sm font-semibold flex items-center gap-2">
                                    <Wand2 className="h-4 w-4 text-primary" />
                                    Peaufiner ce résultat
                                </Label>
                                <Textarea 
                                    id="refine-prompt"
                                    value={refinePrompt}
                                    onChange={e => setRefinePrompt(e.target.value)}
                                    placeholder="Ex: rends le fond plus flou, change le texte en bleu..."
                                    rows={2}
                                    disabled={isGenerating}
                                />
                                <Button
                                    onClick={handleRefineImage}
                                    disabled={!refinePrompt.trim() || isGenerating || !hasAiTickets}
                                    className="w-full"
                                >
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Affiner (1 Ticket IA)
                                </Button>
                                <Separator className="my-4 !mt-6" />
                                <div className="space-y-2">
                                    <Button disabled={true} className="w-full">
                                        <FileTextIcon className="mr-2 h-4 w-4" />
                                        Modifier/Générer la description
                                    </Button>
                                    <Button disabled={true} className="w-full bg-green-600 hover:bg-green-700">
                                        <Save className="mr-2 h-4 w-4" />
                                        Enregistrer la création
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <aside className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-muted/40 border-l flex flex-col h-full">
                 <div className="flex-1 overflow-y-auto p-1">
                  <div className="p-3 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                          <span>Démarrez une nouvelle idée</span>
                        </CardTitle>
                        <CardDescription>Décrivez le résultat que vous souhaitez obtenir à partir de l'image originale.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="relative">
                            <Textarea
                                placeholder="Ex: Rends le ciel plus dramatique et ajoute des éclairs..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                disabled={isGenerating || isSaving}
                                className="pr-10"
                            />
                            <Dialog open={isSavePromptDialogOpen} onOpenChange={setIsSavePromptDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary" disabled={!prompt || !prompt.trim() || isGenerating || isSaving} onClick={openSavePromptDialog} aria-label="Sauvegarder le prompt">
                                        <Star className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Sauvegarder le prompt</DialogTitle>
                                        <DialogDescription>Donnez un nom à cette instruction pour la retrouver facilement plus tard.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="prompt-name">Nom du prompt</Label>
                                            <Input id="prompt-name" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} placeholder="Ex: Style super-héros" disabled={isSavingPrompt}/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Instruction</Label>
                                            <Textarea value={promptToSave} readOnly disabled rows={4} className="bg-muted"/>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="secondary" disabled={isSavingPrompt}>Annuler</Button></DialogClose>
                                        <Button onClick={handleSavePrompt} disabled={isSavingPrompt || !newPromptName.trim()}>
                                            {isSavingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Sauvegarder
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Trouver l'inspiration
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Inspiration de Prompts</DialogTitle>
                                    <DialogDescription>
                                        Utilisez vos prompts sauvegardés ou explorez nos suggestions pour démarrer votre création. Cliquez sur un prompt pour l'utiliser.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4 max-h-[60vh] overflow-y-auto">
                                    <Accordion type="single" collapsible className="w-full">
                                        {userProfile && userProfile.customPrompts && userProfile.customPrompts.length > 0 && (
                                            <AccordionItem value="custom-prompts">
                                                <AccordionTrigger className="text-sm py-2 hover:no-underline flex items-center gap-2">
                                                    <Star className="h-4 w-4 text-yellow-500" />
                                                    <span className="font-semibold">Mes Prompts</span>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="flex flex-col gap-2 pt-2">
                                                        {userProfile.customPrompts.filter(p => typeof p === 'object' && p !== null && p.id && p.name && p.value).map((p) => (
                                                            <div key={p.id} className="group relative flex items-center">
                                                                <DialogClose asChild>
                                                                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2 flex-grow text-left justify-start" onClick={() => setPrompt(p.value)} disabled={isGenerating || isSaving}>
                                                                        {p.name}
                                                                    </Button>
                                                                </DialogClose>
                                                                <div className="flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEditPromptDialog(p); }} aria-label="Modifier le prompt">
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openDeletePromptDialog(p); }} aria-label="Supprimer le prompt">
                                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )}
                                        {suggestionCategories.map(category => {
                                            const Icon = getIcon(category.icon);
                                            return (
                                                <AccordionItem value={category.name} key={category.name}>
                                                    <AccordionTrigger className="text-sm py-2 hover:no-underline flex items-center gap-2">
                                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-semibold">{category.name}</span>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="flex flex-wrap gap-2 pt-2">
                                                            {category.prompts.map((p) => (
                                                                <DialogClose asChild key={p.title}>
                                                                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2" onClick={() => setPrompt(p.prompt)} disabled={isGenerating || isSaving}>
                                                                        {p.title}
                                                                    </Button>
                                                                </DialogClose>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button size="lg" onClick={() => handleGenerateImage(prompt)} disabled={!prompt.trim() || isGenerating || isSaving || !hasAiTickets} className="w-full">
                            {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5 text-amber-300" />}
                            {isGenerating ? 'Génération...' : 'Générer (1 Ticket IA)'}
                        </Button>
                        {monthlyLimitReached && ( <p className="text-center text-xs text-primary font-semibold pt-2"> Limite mensuelle de tickets gratuits atteinte. Prochaine recharge le {nextRefillDate}. </p>)}
                        {!hasAiTickets && !isGenerating && !isSaving && !monthlyLimitReached && (
                            <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                                <Link href="/shop"> <ShoppingCart className="mr-2 h-4 w-4"/> Plus de tickets ? Rechargez ici ! </Link>
                            </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
            </aside>
            
            <AlertDialog open={isDeletePromptDialogOpen} onOpenChange={setIsDeletePromptDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le prompt "{promptToDelete?.name}" ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible et supprimera définitivement ce prompt de votre liste.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingPrompt}>Annuler</AlertDialogCancel>
                         <AlertDialogAction onClick={handleDeletePrompt} disabled={isDeletingPrompt} className="bg-destructive hover:bg-destructive/90">
                            {isDeletingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={isEditPromptDialogOpen} onOpenChange={setIsEditPromptDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Renommer le prompt</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="edit-prompt-name">Nouveau nom</Label>
                        <Input
                            id="edit-prompt-name"
                            value={editedPromptName}
                            onChange={(e) => setEditedPromptName(e.target.value)}
                            disabled={isEditingPrompt}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary" disabled={isEditingPrompt}>Annuler</Button></DialogClose>
                        <Button onClick={handleEditPrompt} disabled={isEditingPrompt || !editedPromptName.trim()}>
                            {isEditingPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
