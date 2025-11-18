

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useFirebase, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl, type UserProfile, decrementTicketCount, decrementAiTicketCount } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, Link as LinkIcon, Loader2, HardDriveUpload, Ticket, ShoppingCart, AlertTriangle, Wand2, Save, Instagram, Facebook, MessageSquare, VenetianMask, RefreshCw } from 'lucide-react';
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
} from "@/components/ui/dialog"
import Link from 'next/link';
import { generateImage } from '@/ai/flows/generate-image-flow';
import { generateImageDescription } from '@/ai/flows/generate-description-flow';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';

type Platform = 'instagram' | 'facebook' | 'x' | 'tiktok' | 'generic';


// Limites de stockage en octets (NOUVELLES LIMITES)
const STORAGE_LIMITS = {
    none: 200 * 1024 * 1024,         // 200 Mo
    creator: 10 * 1024 * 1024 * 1024,   // 10 Go
    pro: 50 * 1024 * 1024 * 1024,       // 50 Go
    master: 250 * 1024 * 1024 * 1024    // 250 Go
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
  const [description, setDescription] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('storage');

  const [imageUrl, setImageUrl] = useState('');
  
  // State pour la génération IA
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  
  // State pour la description générée
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);


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


  const resetState = () => {
    setStatus({ state: 'idle' });
    setSelectedFile(null);
    setCustomName('');
    setDescription('');
    setImageUrl('');
    setPrompt('');
    setGeneratedImageUrl(null);
    setGeneratedTitle('');
    setGeneratedDescription('');
    setGeneratedHashtags('');
    setIsUploading(false);
    setIsGenerating(false);
    setIsGeneratingDescription(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    resetState();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        setSelectedFile(file);
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

    try {
      await uploadFn();
      
      if (ticketType === 'upload' && totalUploadTickets !== Infinity) {
          await decrementTicketCount(firestore, user.uid, userProfile);
      }

      toast({ title: 'Succès', description: 'Votre image a été enregistrée.' });
      resetState();
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
            description: 'Libérez de l\'espace ou augmentez votre quota pour ajouter de nouvelles images.'
        });
        return;
    }

    await handleUpload(async () => {
      await saveImageFromUrl(firestore, user, {
        directUrl: imageUrl,
        description: description,
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
      await saveImageMetadata(firestore, user, { ...metadata, description });
    }, 'upload');
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim() || !user || !firestore || !userProfile) return;

    if (totalAiTickets <= 0) {
        toast({
            variant: 'destructive',
            title: 'Tickets IA épuisés',
            description: (
                <Link href="/shop" className="font-bold underline text-white">
                    Rechargez dans la boutique !
                </Link>
            ),
        });
        return;
    }
    
    setIsGenerating(true);
    // Ne pas réinitialiser generatedImageUrl ici pour que l'ancienne image reste visible pendant la génération
    // setGeneratedImageUrl(null);

    try {
      const result = await generateImage({ prompt });
      setGeneratedImageUrl(result.imageUrl);
      
      await decrementAiTicketCount(firestore, user.uid, userProfile, 'edit');
      
      toast({ title: 'Image générée !', description: 'Un ticket IA a été utilisé. Vous pouvez maintenant ajouter une description et l\'enregistrer.' });
    } catch (error) {
      const errorMessage = (error as Error).message;
      toast({ variant: 'destructive', title: 'Erreur de génération', description: errorMessage });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleGenerateDescription = async (platform: Platform) => {
    if (!generatedImageUrl || !user || !userProfile || !firestore) return;
    if (totalAiTickets <= 0) {
         toast({
            variant: 'destructive',
            title: 'Tickets IA épuisés',
            description: ( <Link href="/shop" className="font-bold underline text-white"> Rechargez dans la boutique ! </Link> )
        });
        return;
    }

    setIsGeneratingDescription(true);
    try {
        const result = await generateImageDescription({ imageUrl: generatedImageUrl, platform: platform });
        
        setGeneratedTitle(result.title);
        setGeneratedDescription(result.description);
        setGeneratedHashtags(result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '));

        await decrementAiTicketCount(firestore, user.uid, userProfile, 'description');
        toast({ title: "Contenu généré !", description: `Publication pour ${platform} prête. Un ticket IA a été utilisé.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erreur IA', description: "Le service de génération de description n'a pas pu répondre." });
    } finally {
        setIsGeneratingDescription(false);
    }
};

 const handleSaveGeneratedImage = async () => {
    if (!generatedImageUrl || !user || !firebaseApp || !userProfile || !firestore) return;
    
    await handleUpload(async () => {
        setStatus({ state: 'processing' });
        const blob = await dataUriToBlob(generatedImageUrl);

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
            `Généré par IA: ${prompt}`,
            (progress) => setStatus({ state: 'uploading', progress })
        );
        
        await saveImageMetadata(firestore, user, { 
            ...metadata,
            title: generatedTitle || `Généré par IA: ${prompt}`,
            description: generatedDescription,
            hashtags: generatedHashtags,
            generatedByAI: true,
        });
    }, 'none'); // Spécifier 'none' pour ne pas décompter de ticket d'upload
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
            <UploadCloud className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium text-foreground">
            {selectedFile ? `Fichier : ${selectedFile.name}` : 'Cliquez pour choisir un fichier'}
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

  const isAiTab = activeTab === 'ai';
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
                          Vos fichiers les plus anciens seront supprimés après le <strong>{format(userProfile.gracePeriodEndDate!.toDate(), 'd MMMM yyyy', { locale: fr })}</strong>.
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
                  <CardTitle>Ajouter une image</CardTitle>
                  <CardDescription>
                    Choisissez une méthode pour ajouter une image à votre galerie.
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
              <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="storage"><UploadCloud className="mr-2 h-4 w-4"/>Via Fichier</TabsTrigger>
                  <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4"/>Via URL</TabsTrigger>
                  <TabsTrigger value="ai"><Wand2 className="mr-2 h-4 w-4"/>Générer par IA</TabsTrigger>
              </TabsList>

              <TabsContent value="storage" className="space-y-4 pt-6">
                   {renderFilePicker(isUploading || isInGracePeriod)}
                   <Textarea
                      placeholder="Ajoutez une description (optionnel)..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isUploading || isInGracePeriod}
                   />
                   {status.state === 'uploading' && <Progress value={status.progress} className="w-full" />}
                   <Button 
                      onClick={handleStorageUpload} 
                      disabled={isUploading || !selectedFile || isInGracePeriod} 
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
                   <Textarea
                      placeholder="Ajoutez une description (optionnel)..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isUploading || isInGracePeriod}
                  />
                  <Button onClick={handleUrlUpload} disabled={isUploading || !imageUrl.trim() || isInGracePeriod} className="w-full">
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Ajouter depuis l'URL
                  </Button>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 pt-6">
                  {generatedImageUrl ? (
                    <div className="space-y-4">
                        <div className="aspect-square relative w-full rounded-lg border bg-muted flex items-center justify-center">
                           {isGenerating && (
                              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                                 <Loader2 className="h-10 w-10 text-primary animate-spin" />
                              </div>
                           )}
                           <Image src={generatedImageUrl} alt="Image générée par IA" fill className="object-contain" unoptimized />
                        </div>

                        <Separator/>
                        
                        <div className="space-y-2">
                          <Label>Titre (optionnel)</Label>
                          <Input value={generatedTitle} onChange={(e) => setGeneratedTitle(e.target.value)} placeholder="Un titre pour votre image..."/>
                        </div>
                        <div className="space-y-2">
                          <Label>Description (optionnel)</Label>
                          <Textarea value={generatedDescription} onChange={(e) => setGeneratedDescription(e.target.value)} placeholder="Une description pour votre image..."/>
                        </div>
                         <div className="space-y-2">
                          <Label>Hashtags (optionnel)</Label>
                          <Input value={generatedHashtags} onChange={(e) => setGeneratedHashtags(e.target.value)} placeholder="#style #art #ia"/>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full" disabled={isGenerating || isGeneratingDescription || totalAiTickets <= 0}>
                                {isGeneratingDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                                {isGeneratingDescription ? "Génération..." : "Générer la description (1 Ticket IA)"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-56">
                              <DropdownMenuItem onClick={() => handleGenerateDescription('instagram')}><Instagram className="mr-2 h-4 w-4" /> Instagram</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateDescription('facebook')}><Facebook className="mr-2 h-4 w-4" /> Facebook</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateDescription('x')}><MessageSquare className="mr-2 h-4 w-4" /> X (Twitter)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateDescription('tiktok')}><VenetianMask className="mr-2 h-4 w-4" /> TikTok</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateDescription('generic')}><Wand2 className="mr-2 h-4 w-4" /> Générique</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Separator/>

                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={handleGenerateImage} disabled={isGenerating || isUploading || totalAiTickets <= 0}>
                               <RefreshCw className="mr-2 h-4 w-4" />
                               Regénérer
                            </Button>
                            <Button onClick={handleSaveGeneratedImage} disabled={isUploading || isGenerating || (totalUploadTickets <= 0 && totalUploadTickets !== Infinity)}>
                               {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                               Enregistrer
                            </Button>
                        </div>
                        <Button variant="outline" onClick={() => setGeneratedImageUrl(null)} disabled={isUploading || isGenerating}>
                            Créer une nouvelle image
                        </Button>
                    </div>
                  ) : (
                    <>
                        <div className="aspect-square w-full rounded-lg border-2 border-dashed bg-muted flex items-center justify-center">
                            {isGenerating ? (
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            ) : (
                                <Wand2 className="h-10 w-10 text-muted-foreground/30" />
                            )}
                        </div>
                        <Textarea
                            placeholder="Décrivez l'image que vous souhaitez créer (ex: un astronaute faisant du surf sur une vague de nébuleuses, style réaliste)..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={3}
                            disabled={isGenerating}
                        />
                        <Button onClick={handleGenerateImage} disabled={isGenerating || !prompt.trim() || totalAiTickets <= 0} className="w-full">
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Générer l'image (1 Ticket IA)
                        </Button>
                        {totalAiTickets <= 0 && !isGenerating && (
                             <Button variant="link" asChild className="text-sm font-semibold text-primary w-full">
                                <Link href="/shop">
                                    <ShoppingCart className="mr-2 h-4 w-4"/>
                                    Plus de tickets ? Rechargez dans la boutique !
                                </Link>
                            </Button>
                        )}
                    </>
                  )}
              </TabsContent>
          </Tabs>
          
          {status.state === 'error' && (
            <p className="mt-4 text-sm text-center text-destructive">{status.message}</p>
          )}

        </CardContent>
      </Card>
    </>
  );
}
