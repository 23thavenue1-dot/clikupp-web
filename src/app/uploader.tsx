

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useFirebase, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadFileAndGetMetadata } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl, type UserProfile, decrementTicketCount } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { doc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, Link as LinkIcon, Loader2, HardDriveUpload, Ticket, ShoppingCart } from 'lucide-react';
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


  const resetState = () => {
    setStatus({ state: 'idle' });
    setSelectedFile(null);
    setCustomName('');
    setDescription('');
    setImageUrl('');
    setIsUploading(false);
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
        setSelectedFile(file);
        setStatus({ state: 'idle' });
    }
  };

  // Generic upload handler
  const handleUpload = async (uploadFn: () => Promise<void>) => {
    if (!user || !firestore || !userProfile) return;

    if (totalUploadTickets <= 0 && totalUploadTickets !== Infinity) {
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
      // La décrémentation est maintenant plus intelligente
      await decrementTicketCount(firestore, user.uid, userProfile);
      toast({ title: 'Succès', description: 'Votre image a été enregistrée et 1 ticket a été utilisé.' });
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
    if (!imageUrl.trim() || !user) return;
    await handleUpload(async () => {
      await saveImageFromUrl(firestore, user, {
        directUrl: imageUrl,
        description: description,
        bbCode: `[img]${imageUrl}[/img]`,
        htmlCode: `<img src="${imageUrl}" alt="Image depuis URL" />`,
      });
    });
  };
  
  const handleStorageUpload = async () => {
    if (!selectedFile || !firebaseApp || !user) return;
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
    });
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

  return (
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
                    <Button variant="secondary" className="flex items-center gap-2 font-semibold px-3 py-1.5 rounded-full text-sm h-auto" title={`${totalUploadTickets} tickets restants`}>
                        <Ticket className="h-5 w-5" />
                        <span>{totalUploadTickets === Infinity ? '∞' : totalUploadTickets}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Détail de vos Tickets d'Upload</DialogTitle>
                      <DialogDescription>
                        Vos tickets sont utilisés dans cet ordre : gratuits, abonnements, puis packs achetés.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
                            <span>Tickets gratuits (rechargés chaque jour)</span>
                            <span className="font-bold">{userProfile?.ticketCount ?? 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
                            <span>Tickets d'abonnement (rechargés chaque mois)</span>
                            <span className="font-bold">{userProfile?.subscriptionTier === 'pro' || userProfile?.subscriptionTier === 'master' ? 'Illimités' : (userProfile?.subscriptionUploadTickets ?? 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
                            <span>Tickets de packs (achetés, n'expirent pas)</span>
                            <span className="font-bold">{userProfile?.packUploadTickets ?? 0}</span>
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
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="storage"><UploadCloud className="mr-2 h-4 w-4"/>Via Fichier</TabsTrigger>
                <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4"/>Via URL</TabsTrigger>
            </TabsList>

            <TabsContent value="storage" className="space-y-4 pt-6">
                 {renderFilePicker(isUploading)}
                 <Textarea
                    placeholder="Ajoutez une description (optionnel)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isUploading}
                 />
                 {status.state === 'uploading' && <Progress value={status.progress} className="w-full" />}
                 <Button 
                    onClick={handleStorageUpload} 
                    disabled={isUploading || !selectedFile} 
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
                    disabled={isUploading}
                />
                 <Textarea
                    placeholder="Ajoutez une description (optionnel)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isUploading}
                />
                <Button onClick={handleUrlUpload} disabled={isUploading || !imageUrl.trim()} className="w-full">
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Ajouter depuis l'URL
                </Button>
            </TabsContent>
        </Tabs>
        
        {status.state === 'error' && (
          <p className="mt-4 text-sm text-center text-destructive">{status.message}</p>
        )}

      </CardContent>
    </Card>
  );
}
