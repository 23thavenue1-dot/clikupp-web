
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useFirebase, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadFileAndGetMetadata, convertHeicToJpeg } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl, type UserProfile, type CustomPrompt, decrementTicketCount, decrementAiTicketCount, saveCustomPrompt, deleteCustomPrompt, updateCustomPrompt } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, Link as LinkIcon, Loader2, HardDriveUpload, Ticket, ShoppingCart, AlertTriangle, Wand2, Save, Instagram, Facebook, MessageSquare, VenetianMask, RefreshCw, Undo2, Redo2, Star, Trash2, Pencil, Video } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from 'next/link';
import { generateImage, editImage } from '@/ai/flows/generate-image-flow';
import { generateVideo } from '@/ai/flows/generate-video-flow';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestionCategories } from '@/lib/ai-prompts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic' | 'ecommerce';

// Structure pour l'historique de génération
interface ImageHistoryItem {
    imageUrl: string;
    prompt: string;
    title: string;
    description: string;
    hashtags: string;
}


// Limites de stockage en octets (NOUVELLES LIMITES)
const STORAGE_LIMITS = {
    none: 200 * 1024 * 1024,         // 200 Mo
    creator: 10 * 1024 * 1024 * 1024,   // 10 Go
    pro: 50 * 1024 * 1024 * 1024,       // 50 Go
    master: 250 * 1024 * 1024 * 1024,    // 250 Go
    storage_250: 250 * 1024 * 1024 * 1024, // 250 Go
    storage_500: 500 * 1024 * 1024 * 1024, // 500 Go
    storage_1000: 1000 * 1024 * 1024 * 1024 // 1 To
};

// Helper pour formater les octets
function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Octets';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper pour convertir un data URI en objet File
async function dataUriToBlob(dataUri: string): Promise<Blob> {
    const response = await fetch(dataUri);
    const blob = await response.blob();
    return blob;
}

type IconName = keyof typeof LucideIcons;

const getIcon = (name: string): React.FC<LucideIcons.LucideProps> => {
  const Icon = LucideIcons[name as IconName];
  return Icon || LucideIcons.HelpCircle;
};


type UploadStatus =
  | { state: 'idle' }
  | { state: 'processing' }
  | { state: 'uploading'; progress: number }
  | { state: 'success'; url: string; }
  | { state: 'error'; message: string };

const looksLikeImage = (f: File) =>
  /^(image\/.*)$/i.test(f.type) || /\.(png|jpe?g|gif|webp|avif|heic|heif|svg)$/i.test(f.name);


export function Uploader() {
  const { user, firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('storage');

  const [imageUrl, setImageUrl] = useState('');
  
  // State pour la génération IA (image)
  const [prompt, setPrompt] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');

  // State pour la génération IA (vidéo)
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState('9:16');
  const [videoDuration, setVideoDuration] = useState(5);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Historique des images générées
  const [generatedImageHistory, setGeneratedImageHistory] = useState<ImageHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
  const [showResetAlert, setShowResetAlert] = useState(false);

  // NOUVEAU: Pour la conversion HEIC
  const [isConverting, setIsConverting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // --- States pour la gestion des prompts favoris ---
  const [isSavePromptDialogOpen, setIsSavePromptDialogOpen] = useState(false);
  const [promptToSave, setPromptToSave] = useState("");
  const [newPromptName, setNewPromptName] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  const [isDeletePromptDialogOpen, setIsDeletePromptDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<CustomPrompt | null>(null);
  const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

  const [isEditPromptDialogOpen, setIsEditPromptDialogOpen] = useState(false);
  const [promptToEdit, setPromptToEdit] = useState<CustomPrompt | null>(null);
  const [editedPromptName, setEditedPromptName] = useState("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-gestion du userProfile
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const totalUploadTickets = useMemo(() => {
    if (!userProfile) return 0;
    // Les abonnements "pro" et "master" ont des uploads illimités.
    if (userProfile.subscriptionTier === 'pro' || userProfile.subscriptionTier === 'master') {
      return Infinity;
    }
    return (userProfile.ticketCount || 0) + (userProfile.subscriptionUploadTickets || 0) + (userProfile.packUploadTickets || 0);
  }, [userProfile]);

  const totalAiTickets = useMemo(() => {
    if (!userProfile) return 0;
    return (userProfile.aiTicketCount || 0) + (userProfile.subscriptionAiTickets || 0) + (userProfile.packAiTickets || 0);
  }, [userProfile]);

  const storageLimit = useMemo(() => {
      if (!userProfile) return 0;
      // @ts-ignore
      return STORAGE_LIMITS[userProfile.subscriptionTier] ?? STORAGE_LIMITS.none;
  }, [userProfile]);

  const storageUsed = userProfile?.storageUsed ?? 0;
  const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;
  
  const isInGracePeriod = !!(userProfile?.gracePeriodEndDate && userProfile.gracePeriodEndDate.toDate() > new Date());
  const showStorageWarning = storagePercentage >= 80 && !isInGracePeriod;

  const currentHistoryItem = useMemo(() => {
      if (historyIndex >= 0 && historyIndex < generatedImageHistory.length) {
          return generatedImageHistory[historyIndex];
      }
      return null;
  }, [generatedImageHistory, historyIndex]);

  // Logique pour la protection des changements non sauvegardés
  const hasUnsavedChanges = useMemo(() => !!currentHistoryItem || !!generatedVideoUrl, [currentHistoryItem, generatedVideoUrl]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = ''; // Requis pour certains navigateurs
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);


  useEffect(() => {
      if (!currentHistoryItem) {
          setRefinePrompt('');
      }
  }, [currentHistoryItem]);


  const performReset = (force = false) => {
    if (hasUnsavedChanges && !force) {
        setShowResetAlert(true);
        return;
    }
    setStatus({ state: 'idle' });
    setSelectedFile(null);
    setCustomName('');
    setImageUrl('');
    setPrompt('');
    setRefinePrompt('');
    setGeneratedImageHistory([]);
    setHistoryIndex(-1);
    setIsUploading(false);
    setIsGenerating(false);
    setVideoPrompt('');
    setGeneratedVideoUrl(null);
    setIsGeneratingVideo(false);
    setShowResetAlert(false); // Fermer l'alerte si elle était ouverte
    setPreviewUrl(null); // Reset de l'aperçu
    setIsConverting(false); // Reset du statut de conversion
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  

  const handleTabChange = (value: string) => {
    if (hasUnsavedChanges) {
        setShowResetAlert(true);
        return; // Empêcher le changement d'onglet
    }
    performReset(true); // Forcer le reset si pas de changements
    setActiveTab(value);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (!looksLikeImage(file)) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Type de fichier non autorisé (images uniquement).' });
            return;
        }
        if (userProfile && (storageUsed + file.size) > storageLimit) {
            toast({
                variant: 'destructive',
                title: 'Espace de stockage insuffisant',
                description: `Ce fichier est trop volumineux. Libérez de l'espace ou augmentez votre quota.`
            });
            return;
        }

        setIsConverting(true);
        setPreviewUrl(null);
        setSelectedFile(file);

        try {
            const convertedFile = await convertHeicToJpeg(file);
            setPreviewUrl(URL.createObjectURL(convertedFile));
            setSelectedFile(convertedFile); // Mettre à jour le fichier sélectionné avec la version convertie
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erreur de conversion', description: "Impossible de générer l'aperçu pour cette image." });
            setPreviewUrl(null);
        } finally {
            setIsConverting(false);
        }
        setStatus({ state: 'idle' });
    }
  };


  // Generic upload handler
  const handleUpload = async (uploadFn: () => Promise<void>, ticketType: 'upload' | 'none' = 'upload') => {
    if (!user || !firestore || !userProfile) return;

    if (ticketType === 'upload' && totalUploadTickets <= 0 && totalUploadTickets !== Infinity) {
        toast({
            variant: 'destructive',
            title: 'Tickets d\'upload épuisés',
            description: (
                <Link href="/shop" className="font-bold underline text-white">
                    Rechargez dans la boutique !
                </Link>
            ),
        });
        return;
    }
    
    setIsUploading(true);
    setStatus({ state: 'processing' });

    try {
      await uploadFn();
      
      if (ticketType === 'upload' && totalUploadTickets !== Infinity) {
          await decrementTicketCount(firestore, user.uid, userProfile);
      }

      toast({ title: 'Succès', description: 'Votre média a été enregistré.' });
      performReset(true); // Forcer le reset après une sauvegarde réussie
    } catch (error) {
      const errorMessage = (error as Error).message;
      setStatus({ state: 'error', message: `Erreur: ${errorMessage}` });
      toast({ variant: 'destructive', title: 'Erreur de téléversement', description: errorMessage });
    } finally {
        setIsUploading(false);
    }
  };


  const handleUrlUpload = async () => {
    if (!imageUrl.trim() || !user || !userProfile) return;
    
    if (storageUsed >= storageLimit) {
        toast({
            variant: 'destructive',
            title: 'Espace de stockage plein',
            description: `Libérez de l'espace ou augmentez votre quota pour ajouter de nouvelles images.`,
        });
        return;
    }

    await handleUpload(async () => {
      await saveImageFromUrl(firestore, user, {
        directUrl: imageUrl,
        description: '', // Description is now handled from the main gallery
        bbCode: `[img]${imageUrl}[/img]`,
        htmlCode: `<img src="${imageUrl}" alt="Image depuis URL" />`,
      });
    }, 'upload');
  };
  
  const handleStorageUpload = async () => {
    if (!selectedFile || !firebaseApp || !user || !userProfile) return;

    if ((storageUsed + selectedFile.size) > storageLimit) {
        toast({
            variant: 'destructive',
            title: 'Espace de stockage insuffisant',
            description: 'Le téléversement a été bloqué car il dépasserait votre quota. Libérez de l\'espace.'
        });
        return;
    }

    const storage = getStorage(firebaseApp);
    await handleUpload(async () => {
      const metadata = await uploadFileAndGetMetadata(
          storage,
          user,
          selectedFile,
          customName,
          (progress) => setStatus({ state: 'uploading', progress })
      );
      await saveImageMetadata(firestore, user, { ...metadata, description: '' });
      setStatus({ state: 'success', url: metadata.directUrl });
    }, 'upload');
  };

  const handleGenerateImage = async (isRefinement = false, isRegeneration = false) => {
    let currentPrompt;
    if (isRegeneration) {
        currentPrompt = currentHistoryItem?.prompt;
    } else {
        currentPrompt = isRefinement ? (refinePrompt || currentHistoryItem?.prompt) : prompt;
    }
    
    const baseImageUrl = isRefinement || isRegeneration ? currentHistoryItem?.imageUrl : undefined;
    
    if (!currentPrompt || !currentPrompt.trim() || !user || !firestore || !userProfile) return;

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
        const result = baseImageUrl
            ? await editImage({ imageUrl: baseImageUrl, prompt: currentPrompt })
            : await generateImage({ prompt: currentPrompt, aspectRatio: aspectRatio });
      
        const newHistoryItem: ImageHistoryItem = {
            imageUrl: result.imageUrl,
            prompt: currentPrompt,
            title: '',
            description: '',
            hashtags: ''
        };

        const newHistory = generatedImageHistory.slice(0, historyIndex + 1);
        newHistory.push(newHistoryItem);

        setGeneratedImageHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      
        await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
      
        toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé.' });
        if (isRefinement) setRefinePrompt('');

    } catch (error) {
        const errorMessage = (error as Error).message;
        toast({ variant: 'destructive', title: 'Erreur de génération', description: errorMessage });
    } finally {
        setIsGenerating(false);
    }
  };


 const handleSaveGeneratedImage = async () => {
    if (!currentHistoryItem || !user || !firebaseApp || !userProfile || !firestore) return;
    
    const uploadFn = async () => {
        setStatus({ state: 'processing' });
        const blob = await dataUriToBlob(currentHistoryItem.imageUrl);

        if ((storageUsed + blob.size) > storageLimit) {
            throw new Error('Espace de stockage insuffisant pour enregistrer cette image.');
        }

        const storage = getStorage(firebaseApp);
        const newFileName = `ai-generated-${Date.now()}.png`;
        const imageFile = new File([blob], newFileName, { type: blob.type });

        const metadata = await uploadFileAndGetMetadata(
            storage,
            user,
            imageFile,
            `Généré par IA: ${currentHistoryItem.prompt}`,
            (progress) => setStatus({ state: 'uploading', progress })
        );
        
        await saveImageMetadata(firestore, user, { 
            ...metadata,
            title: `Création IA du ${format(new Date(), 'd MMM yyyy à HH:mm', { locale: fr })}`,
            description: `Prompt : ${currentHistoryItem.prompt}`,
            hashtags: "",
            generatedByAI: true,
        });
         setStatus({ state: 'success', url: metadata.directUrl });
    };

    await handleUpload(uploadFn, 'none'); // N'utilise pas de ticket d'upload
};

const handleGenerateVideo = async () => {
    if (!videoPrompt.trim() || !user || !firestore || !userProfile) return;

    // TODO: Définir un coût en tickets pour la vidéo
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
    setGeneratedVideoUrl(null);

    try {
        const result = await generateVideo({ 
            prompt: videoPrompt, 
            aspectRatio: videoAspectRatio, 
            durationSeconds: videoDuration 
        });
        
        setGeneratedVideoUrl(result.videoUrl);

        for (let i = 0; i < VIDEO_COST; i++) {
            await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
        }
      
        toast({ title: 'Vidéo générée !', description: `${VIDEO_COST} tickets IA ont été utilisés.` });
    } catch (error) {
        const errorMessage = (error as Error).message;
        toast({ variant: 'destructive', title: 'Erreur de génération vidéo', description: errorMessage });
    } finally {
        setIsGeneratingVideo(false);
    }
};

  const handleUndoGeneration = () => {
      if (historyIndex >= 0) {
          setHistoryIndex(prev => prev - 1);
      }
  };

  const handleRedoGeneration = () => {
      if (historyIndex < generatedImageHistory.length - 1) {
          setHistoryIndex(prev => prev + 1);
      }
  };

  const openSavePromptDialog = () => {
    const promptToSaveValue = prompt.trim();
    if (!promptToSaveValue) return;
    setPromptToSave(promptToSaveValue);
    setNewPromptName("");
    setIsSavePromptDialogOpen(true);
  };
  
  const handleSavePrompt = async () => {
      if (!promptToSave || !newPromptName.trim() || !user || !firestore) return;
      setIsSavingPrompt(true);
      const newCustomPrompt: CustomPrompt = { id: `prompt_${Date.now()}`, name: newPromptName, value: promptToSave };
      try {
          await saveCustomPrompt(firestore, user.uid, newCustomPrompt);
          toast({ title: "Prompt sauvegardé" });
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


  const renderFilePicker = (disabled: boolean) => (
    <div className="space-y-4">
        <div 
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && fileInputRef.current?.click()}
            aria-disabled={disabled}
            className={cn(
            "border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors",
            !disabled && 'cursor-pointer hover:bg-muted/50',
            disabled && 'pointer-events-none opacity-70'
            )}
            onClick={() => !disabled && fileInputRef.current?.click()}
        >
            <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.heic,.heif"
            disabled={disabled}
            />

            {isConverting ? (
                <>
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="mt-4 text-sm font-medium text-foreground">Conversion en cours...</p>
                </>
            ) : previewUrl ? (
                <div className="relative w-24 h-24 rounded-md overflow-hidden">
                    <Image src={previewUrl} alt="Aperçu" layout="fill" objectFit="cover" />
                </div>
            ) : (
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
            )}
            
            <p className="mt-4 text-sm font-medium text-foreground">
                {selectedFile && !isConverting ? `Fichier : ${selectedFile.name}` : 'Cliquez pour choisir un fichier'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Taille max : 10 Mo. Formats HEIC/HEIF acceptés.
            </p>
        </div>

        {selectedFile && (
             <Input
                placeholder="Nom personnalisé (optionnel)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                disabled={disabled}
            />
        )}
    </div>
  );

  const isAiTab = activeTab === 'ai' || activeTab === 'video';
  const ticketsToShow = isAiTab ? totalAiTickets : totalUploadTickets;
  const ticketTypeLabel = isAiTab ? 'IA' : 'd\'upload';


  return (
    <>
      {isInGracePeriod && (
          <Card className="border-destructive bg-destructive/10 dark:bg-destructive/20 mb-6">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className="text-destructive mt-1">
                      <AlertTriangle />
                  </div>
                  <div>
                      <CardTitle className="text-destructive">Action Requise : Stockage Dépassé</CardTitle>
                      <CardDescription className="text-destructive/80">
                          Votre abonnement a pris fin et votre stockage utilisé dépasse la limite gratuite.
                          Vos fichiers les plus anciens seront supprimés après le <strong>{userProfile.gracePeriodEndDate ? format(userProfile.gracePeriodEndDate.toDate(), 'd MMMM yyyy', { locale: fr }) : ''}</strong>.
                      </CardDescription>
                  </div>
              </CardHeader>
              <CardFooter>
                 <Button asChild variant="destructive" size="sm">
                      <Link href="/shop">
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Se Réabonner
                      </Link>
                  </Button>
              </CardFooter>
          </Card>
      )}

      {showStorageWarning && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/50 mb-6">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className="text-amber-500 mt-1">
                      <AlertTriangle />
                  </div>
                  <div>
                      <CardTitle className="text-amber-700 dark:text-amber-400">Espace de stockage presque plein</CardTitle>
                      <CardDescription className="text-amber-600 dark:text-amber-500">
                          Vous avez utilisé {storagePercentage.toFixed(0)}% de votre quota de {formatBytes(storageLimit)}.
                      </CardDescription>
                  </div>
              </CardHeader>
              <CardFooter>
                 <Button asChild variant="outline" size="sm" className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900">
                      <Link href="/shop">
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Augmenter mon stockage
                      </Link>
                  </Button>
              </CardFooter>
          </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
              <div>
                  <CardTitle>Ajouter un média</CardTitle>
                  <CardDescription>
                    Choisissez une méthode pour ajouter une image ou une vidéo à votre galerie.
                  </CardDescription>
              </div>
              {userProfile !== undefined ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="flex items-center gap-2 font-semibold px-3 py-1.5 rounded-full text-sm h-auto" title={`${ticketsToShow} ${ticketTypeLabel} restants`}>
                          <Ticket className="h-5 w-5" />
                          <span>{ticketsToShow === Infinity ? '∞' : ticketsToShow}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Détail de vos Tickets</DialogTitle>
                        <DialogDescription>
                          Vos tickets sont utilisés dans cet ordre : gratuits, abonnements, puis packs achetés.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-3">
                          <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
                              <span className='font-semibold'>Tickets d'upload</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md ml-4">
                              <span>Gratuits (quotidiens)</span>
                              <span className="font-bold">{userProfile?.ticketCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md ml-4">
                              <span>Abonnement (mensuels)</span>
                              <span className="font-bold">{userProfile?.subscriptionTier === 'pro' || userProfile?.subscriptionTier === 'master' ? 'Illimités' : (userProfile?.subscriptionUploadTickets ?? 0)}</span>
                          </div>
                           <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md ml-4">
                              <span>Packs (achetés)</span>
                              <span className="font-bold">{userProfile?.packUploadTickets ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md mt-4">
                              <span className='font-semibold'>Tickets IA</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md ml-4">
                              <span>Gratuits (quotidiens)</span>
                              <span className="font-bold">{userProfile?.aiTicketCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md ml-4">
                              <span>Abonnement (mensuels)</span>
                              <span className="font-bold">{userProfile?.subscriptionAiTickets ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md ml-4">
                              <span>Packs (achetés)</span>
                              <span className="font-bold">{userProfile?.packAiTickets ?? 0}</span>
                          </div>
                      </div>
                       <DialogFooter>
                          <Button asChild>
                              <Link href="/shop">
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  Visiter la boutique
                              </Link>
                          </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
              ) : <Skeleton className="h-8 w-20 rounded-full" /> }
          </div>
        </CardHeader>
        <CardContent>
        <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="storage"><UploadCloud className="mr-2 h-4 w-4"/>Fichier</TabsTrigger>
                  <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4"/>URL</TabsTrigger>
                  <TabsTrigger value="ai"><Wand2 className="mr-2 h-4 w-4"/>Image IA</TabsTrigger>
                  <TabsTrigger value="video"><Video className="mr-2 h-4 w-4"/>Vidéo IA</TabsTrigger>
              </TabsList>

              <TabsContent value="storage" className="space-y-4 pt-6">
                   {renderFilePicker(isUploading || isInGracePeriod)}
                   {status.state === 'uploading' && <Progress value={status.progress} />}
                   <Button 
                      onClick={handleStorageUpload} 
                      disabled={isUploading || !selectedFile || isInGracePeriod || status.state === 'uploading'} 
                      className="w-full"
                   >
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isUploading ? 'Téléversement...' : 'Téléverser le Fichier'}
                  </Button>
              </TabsContent>

              <TabsContent value="url" className="space-y-4 pt-6">
                  <p className="text-sm text-muted-foreground text-center">Collez l'URL d'une image accessible publiquement.</p>
                  <Input
                      placeholder="https://example.com/image.png"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      disabled={isUploading || isInGracePeriod}
                  />
                  <Button onClick={handleUrlUpload} disabled={isUploading || !imageUrl.trim() || isInGracePeriod} className="w-full">
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Ajouter depuis l'URL
                  </Button>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 pt-6">
                <div className="flex flex-col md:flex-row gap-4 h-full">
                    {/* Main Content (Image Preview) */}
                    <main className="flex-1 flex flex-col gap-2">
                        <div className={cn(
                            "aspect-square w-full relative rounded-lg border bg-muted flex items-center justify-center shadow-sm",
                             aspectRatio === '4:5' && 'aspect-[4/5]',
                             aspectRatio === '16:9' && 'aspect-video',
                             aspectRatio === '9:16' && 'aspect-[9/16]'
                        )}>
                            {isGenerating && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                                   <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                </div>
                            )}
                            {currentHistoryItem?.imageUrl ? (
                                <Image src={currentHistoryItem.imageUrl} alt="Image générée par IA" fill className="object-contain" unoptimized />
                            ) : (
                                <Wand2 className="h-12 w-12 text-muted-foreground/30"/>
                            )}
                             {!isGenerating && generatedImageHistory.length > 0 && (
                                <div className="absolute top-2 left-2 z-10 flex gap-2">
                                    <Button variant="outline" size="icon" onClick={handleUndoGeneration} className="bg-background/80" aria-label="Annuler" disabled={historyIndex < 0}>
                                        <Undo2 className="h-5 w-5" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleRedoGeneration} className="bg-background/80" aria-label="Rétablir" disabled={historyIndex >= generatedImageHistory.length - 1}>
                                        <Redo2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                         {currentHistoryItem?.prompt && (
                           <div className="text-xs text-muted-foreground pt-1 italic text-center">
                               Instruction pour cette image : "{currentHistoryItem.prompt}"
                           </div>
                       )}
                    </main>

                    {/* Right Sidebar (Controls) */}
                    <aside className="w-full md:w-[320px] flex-shrink-0 bg-card rounded-lg border flex flex-col h-full">
                         <div className="p-4 border-b">
                             <h2 className="text-base font-semibold tracking-tight">Générer par IA</h2>
                             <p className="text-xs text-muted-foreground">Créez une image de zéro ou affinez une création.</p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {currentHistoryItem ? (
                                <>
                                  <div className="space-y-2">
                                      <Label>Affiner l'image</Label>
                                      <div className="flex items-center gap-2">
                                        <Input 
                                            value={refinePrompt} 
                                            onChange={(e) => setRefinePrompt(e.target.value)} 
                                            placeholder="Ex: change la couleur en rouge..."
                                            disabled={isGenerating || isUploading}
                                        />
                                      </div>
                                  </div>
                                </>
                            ): (
                                <>
                                    <div className='relative'>
                                        <Textarea
                                            placeholder="Décrivez l'image que vous souhaitez créer..."
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            rows={3}
                                            disabled={isGenerating}
                                            className="pr-10"
                                        />
                                         <div className="absolute top-2 right-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                disabled={!prompt.trim() || isGenerating}
                                                onClick={openSavePromptDialog}
                                                aria-label="Sauvegarder le prompt"
                                            >
                                                <Star className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isGenerating}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Format de l'image" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1:1">Carré (1:1)</SelectItem>
                                                <SelectItem value="4:5">Portrait (4:5)</SelectItem>
                                                <SelectItem value="16:9">Paysage (16:9)</SelectItem>
                                                <SelectItem value="9:16">Story (9:16)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-full rounded-md border p-2 bg-muted/40 overflow-y-auto max-h-[200px]">
                                        <Accordion type="single" collapsible className="w-full">
                                            {userProfile && userProfile.customPrompts && userProfile.customPrompts.length > 0 && (
                                                <AccordionItem value="custom-prompts">
                                                    <AccordionTrigger className="text-sm py-2 hover:no-underline flex items-center gap-2">
                                                        <Star className="h-4 w-4 text-yellow-500" />
                                                        <span className="font-semibold">Mes Prompts</span>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="flex flex-col gap-2 pt-2">
                                                            {userProfile.customPrompts.filter(p => typeof p === 'object' && p !== null).map((p) => (
                                                                <div key={p.id} className="group relative flex items-center">
                                                                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2 flex-grow text-left justify-start" onClick={() => setPrompt(p.value)} disabled={isGenerating}>
                                                                        {p.name}
                                                                    </Button>
                                                                    <div className="flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditPromptDialog(p)} aria-label="Modifier"><Pencil className="h-3 w-3" /></Button>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDeletePromptDialog(p)} aria-label="Supprimer"><Trash2 className="h-3 w-3 text-destructive" /></Button>
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
                                                                    <Button key={p.title} variant="outline" size="sm" className="text-xs h-auto py-1 px-2" onClick={() => setPrompt(p.prompt)} disabled={isGenerating}>{p.title}</Button>
                                                                ))}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}
                                        </Accordion>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="p-4 mt-auto border-t space-y-2">
                            {currentHistoryItem ? (
                                <>
                                    {refinePrompt.trim() && (
                                        <Button
                                            onClick={() => handleGenerateImage(true)}
                                            disabled={isGenerating || isUploading || totalAiTickets <= 0}
                                            className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity"
                                        >
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            Affiner (1 Ticket IA)
                                        </Button>
                                    )}
                                    <Button onClick={() => performReset(false)} className="w-full" variant="secondary" disabled={isGenerating || isUploading}>
                                      Nouvelle Génération
                                    </Button>
                                    <AlertDialog open={showRegenerateAlert} onOpenChange={setShowRegenerateAlert}>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                disabled={isGenerating || isUploading || totalAiTickets <= 0}
                                                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                                                variant="default"
                                            >
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                Regénérer (1 Ticket IA)
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Confirmer la regénération ?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Les variations entre deux générations peuvent parfois être très subtiles. Pour un changement plus marqué, pensez à utiliser l'option 'Affiner'. Voulez-vous continuer ?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleGenerateImage(false, true)}>
                                                    Oui, regénérer
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    <Button 
                                        onClick={handleSaveGeneratedImage} 
                                        disabled={isUploading || isGenerating || status.state === 'success'}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                        {status.state === 'success' ? 'Sauvegardé !' : (isUploading ? 'Sauvegarde...' : 'Sauvegarder')}
                                    </Button>
                                </>
                            ) : (
                                <Button 
                                    onClick={() => handleGenerateImage(false)} 
                                    disabled={isGenerating || !prompt.trim() || totalAiTickets <= 0}
                                    className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:opacity-90 transition-opacity"
                                >
                                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isGenerating ? 'Génération...' : 'Générer l\'image (1 Ticket IA)'}
                                </Button>
                            )}
                            
                            {totalAiTickets <= 0 && !isGenerating && !isUploading && (
                                 <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                                    <Link href="/shop">
                                        <ShoppingCart className="mr-2 h-4 w-4"/>
                                        Plus de tickets ? Rechargez !
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </aside>
                </div>
              </TabsContent>

              <TabsContent value="video" className="space-y-4 pt-6">
                <div className="space-y-2">
                    <Label htmlFor="video-prompt">Instruction pour la vidéo</Label>
                    <Textarea 
                        id="video-prompt" 
                        placeholder="Ex: Un majestueux dragon volant au-dessus d'une forêt mystique à l'aube." 
                        value={videoPrompt}
                        onChange={(e) => setVideoPrompt(e.target.value)}
                        rows={3}
                        disabled={isGeneratingVideo}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="video-aspect">Format</Label>
                        <Select value={videoAspectRatio} onValueChange={setVideoAspectRatio} disabled={isGeneratingVideo}>
                            <SelectTrigger id="video-aspect">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="9:16">Story / Réel (9:16)</SelectItem>
                                <SelectItem value="1:1">Carré (1:1)</SelectItem>
                                <SelectItem value="16:9">Paysage (16:9)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="video-duration">Durée (secondes)</Label>
                        <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(Number(v))} disabled={isGeneratingVideo}>
                            <SelectTrigger id="video-duration">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[...Array(4)].map((_, i) => (
                                    <SelectItem key={i+5} value={String(i+5)}>{i+5}s</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Button 
                    onClick={handleGenerateVideo} 
                    disabled={!videoPrompt.trim() || isGeneratingVideo || totalAiTickets < 5}
                    className="w-full"
                    size="lg"
                >
                    {isGeneratingVideo && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {isGeneratingVideo ? 'Génération en cours (peut prendre 2 min)...' : 'Générer la vidéo (5 Tickets IA)'}
                </Button>
                {totalAiTickets < 5 && !isGeneratingVideo && (
                    <p className="text-center text-sm text-destructive">
                        Tickets IA insuffisants. <Link href="/shop" className="underline font-semibold">Rechargez ici.</Link>
                    </p>
                )}

                <div className="aspect-video w-full relative rounded-lg border bg-muted flex items-center justify-center shadow-inner mt-4">
                    {isGeneratingVideo && (
                        <div className="flex flex-col items-center gap-4 text-primary">
                            <Loader2 className="h-10 w-10 animate-spin" />
                            <p className="text-sm font-medium">Création de votre vidéo...</p>
                            <p className="text-xs text-muted-foreground">Cela peut prendre jusqu'à 2 minutes.</p>
                        </div>
                    )}
                    {!isGeneratingVideo && generatedVideoUrl && (
                        <video src={generatedVideoUrl} controls autoPlay loop className="w-full h-full object-contain rounded-lg" />
                    )}
                    {!isGeneratingVideo && !generatedVideoUrl && (
                        <div className="text-center text-muted-foreground p-4">
                            <Video className="h-12 w-12 mx-auto mb-2"/>
                            <p className="text-sm">Votre vidéo apparaîtra ici.</p>
                        </div>
                    )}
                </div>
                 {generatedVideoUrl && !isGeneratingVideo && (
                    <Button 
                        // onClick={handleSaveGeneratedVideo} // TODO: Implement this function
                        disabled={true}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Sauvegarder (Bientôt disponible)
                    </Button>
                )}

              </TabsContent>
          </Tabs>
          
          {status.state === 'error' && (
            <p className="mt-4 text-sm text-center text-destructive">{status.message}</p>
          )}
          {status.state === 'success' && (
            <p className="mt-4 text-sm text-center text-green-600">Image téléversée avec succès !</p>
          )}

        </CardContent>
        <AlertDialog open={showResetAlert} onOpenChange={setShowResetAlert}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Abandonner les modifications ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Vous avez une image ou une vidéo générée qui n'a pas été sauvegardée. Si vous continuez, elle sera perdue.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => performReset(true)} className="bg-destructive hover:bg-destructive/90">
                        Abandonner
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <Dialog open={isSavePromptDialogOpen} onOpenChange={setIsSavePromptDialogOpen}>
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
        
        <AlertDialog open={isDeletePromptDialogOpen} onOpenChange={setIsDeletePromptDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer le prompt "{promptToDelete?.name}" ?</AlertDialogTitle>
                    <AlertDialogDescription>Cette action est irréversible et supprimera définitivement ce prompt de votre liste.</AlertDialogDescription>
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
                    <Input id="edit-prompt-name" value={editedPromptName} onChange={(e) => setEditedPromptName(e.target.value)} disabled={isEditingPrompt} />
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
      </Card>
    </>
  );
}
