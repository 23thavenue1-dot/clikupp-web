
'use client';

import { useState, useRef } from 'react';
import { useFirebase, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { fileToDataUrl, uploadFileAndGetMetadata } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl, type UserProfile, decrementTicketCount } from '@/lib/firestore';
import { getStorage } from 'firebase/storage';
import { doc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, Link as LinkIcon, Loader2, HardDriveUpload, Ticket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"


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
  
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isUrlUploading, setIsUrlUploading] = useState(false);
  const [isStorageUploading, setIsStorageUploading] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-gestion du userProfile
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);


  const resetState = () => {
    setStatus({ state: 'idle' });
    setSelectedFile(null);
    setCustomName('');
    setImageUrl('');
    setIsFileUploading(false);
    setIsUrlUploading(false);
    setIsStorageUploading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }

  const handleTabChange = (value: string) => {
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

    if (userProfile.ticketCount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Tickets épuisés',
        description: 'Vous n\'avez plus de tickets pour téléverser des images. Revenez demain !',
      });
      return;
    }

    try {
      await uploadFn();
      await decrementTicketCount(firestore, user.uid);
      toast({ title: 'Succès', description: 'Votre image a été enregistrée et 1 ticket a été utilisé.' });
      resetState();
    } catch (error) {
      const errorMessage = (error as Error).message;
      setStatus({ state: 'error', message: `Erreur: ${errorMessage}` });
      toast({ variant: 'destructive', title: 'Erreur de téléversement', description: errorMessage });
    }
  };


  const handleDataUrlUpload = async () => {
    if (!selectedFile || !user) return;
    setIsFileUploading(true);
    await handleUpload(async () => {
      setStatus({ state: 'processing' });
      const dataUrl = await fileToDataUrl(selectedFile);
      await saveImageMetadata(firestore, user, {
        originalName: customName || selectedFile.name,
        directUrl: dataUrl,
        bbCode: `[img]${dataUrl}[/img]`,
        htmlCode: `<img src="${dataUrl}" alt="${customName || selectedFile.name}" />`,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
        storagePath: 'data_url',
      });
    });
    setIsFileUploading(false);
  };

  const handleUrlUpload = async () => {
    if (!imageUrl.trim() || !user) return;
    setIsUrlUploading(true);
    await handleUpload(async () => {
      await saveImageFromUrl(firestore, user, {
        directUrl: imageUrl,
        bbCode: `[img]${imageUrl}[/img]`,
        htmlCode: `<img src="${imageUrl}" alt="Image depuis URL" />`,
      });
    });
    setIsUrlUploading(false);
  };
  
  const handleStorageUpload = async () => {
    if (!selectedFile || !firebaseApp || !user) return;
    setIsStorageUploading(true);
    const storage = getStorage(firebaseApp);
    await handleUpload(async () => {
      const metadata = await uploadFileAndGetMetadata(
          storage,
          user,
          selectedFile,
          customName,
          (progress) => setStatus({ state: 'uploading', progress })
      );
      await saveImageMetadata(firestore, user, metadata);
    });
    setIsStorageUploading(false);
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
            accept="image/*"
            disabled={disabled}
            />
            <UploadCloud className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium text-foreground">
            {selectedFile ? `Fichier : ${selectedFile.name}` : 'Cliquez pour choisir un fichier'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Taille max : 10 Mo.
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
                    <Button variant="secondary" className="flex items-center gap-2 font-semibold px-3 py-1.5 rounded-full text-sm h-auto" title={`${userProfile?.ticketCount ?? '?'} tickets restants`}>
                        <Ticket className="h-5 w-5" />
                        <span>{userProfile?.ticketCount ?? '?'}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Système de Tickets</DialogTitle>
                      <DialogDescription>
                        Pour assurer un service équitable et maîtriser les coûts, chaque utilisateur dispose de 5 tickets de téléversement par jour.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 text-center">
                        <div className="text-4xl font-bold">{userProfile?.ticketCount ?? 0}</div>
                        <div className="text-muted-foreground">tickets restants</div>
                    </div>
                    <p className="text-sm text-center text-muted-foreground">
                        Votre quota est réinitialisé à 5 tickets chaque jour. Revenez demain pour en avoir plus !
                    </p>
                  </DialogContent>
                </Dialog>
            ) : <Skeleton className="h-8 w-20 rounded-full" /> }
        </div>
      </CardHeader>
      <CardContent>
      <Tabs defaultValue="file" className="w-full" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file"><UploadCloud className="mr-2 h-4 w-4"/>Via Fichier (sécurisé)</TabsTrigger>
                <TabsTrigger value="storage"><HardDriveUpload className="mr-2 h-4 w-4"/>Via Storage</TabsTrigger>
                <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4"/>Via URL</TabsTrigger>
            </TabsList>
            
            <TabsContent value="file" className="space-y-4 pt-6">
                {renderFilePicker(isFileUploading)}
                <Button 
                    onClick={handleDataUrlUpload} 
                    disabled={isFileUploading || !selectedFile} 
                    className="w-full"
                >
                    {isFileUploading && status.state === 'processing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isFileUploading && status.state === 'processing' ? 'Conversion...' : 'Téléverser via Fichier'}
                </Button>
            </TabsContent>

            <TabsContent value="storage" className="space-y-4 pt-6">
                 {renderFilePicker(isStorageUploading)}
                 {status.state === 'uploading' && <Progress value={status.progress} className="w-full" />}
                 <Button 
                    onClick={handleStorageUpload} 
                    disabled={isStorageUploading || !selectedFile} 
                    className="w-full"
                 >
                    {isStorageUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isStorageUploading ? 'Téléversement...' : 'Téléverser via Storage'}
                </Button>
            </TabsContent>

            <TabsContent value="url" className="space-y-4 pt-6">
                <p className="text-sm text-muted-foreground text-center">Collez l'URL d'une image accessible publiquement.</p>
                <Input
                    placeholder="https://example.com/image.png"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isUrlUploading}
                />
                <Button onClick={handleUrlUpload} disabled={isUrlUploading || !imageUrl.trim()} className="w-full">
                    {isUrlUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
