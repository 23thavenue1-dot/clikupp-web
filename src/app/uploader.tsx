
'use client';

import { useState, useRef, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { fileToDataUrl, uploadFileAndGetMetadata } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl } from '@/lib/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, Copy, Check, Link as LinkIcon, Loader2, HardDriveUpload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from 'next/image';
import { cn } from '@/lib/utils';


type UploadStatus =
  | { state: 'idle' }
  | { state: 'processing' | 'uploading'; progress?: number }
  | { state: 'success'; url: string; }
  | { state: 'error'; message: string };

const looksLikeImage = (f: File) =>
  /^(image\/.*)$/i.test(f.type) || /\.(png|jpe?g|gif|webp|avif|heic|heif|svg)$/i.test(f.name);


export function Uploader() {
  const { user, firestore, storage } = useFirebase();
  const { toast } = useToast();
  
  // State for all tabs
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State specific to URL tab
  const [imageUrl, setImageUrl] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStatus({ state: 'idle' });
    setSelectedFile(null);
    setCustomName('');
    setImageUrl('');
    setCopied(false);
    setIsProcessing(false);
    setIsUrlLoading(false);
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
        setCopied(false);
    }
  };

  // METHOD 1: Data URL Workaround
  const handleDataUrlUpload = useCallback(async () => {
    if (!selectedFile || !user || !firestore) return;

    setIsProcessing(true);
    setStatus({ state: 'processing' });

    try {
        const dataUrl = await fileToDataUrl(selectedFile);
        const bbCode = `[img]${dataUrl}[/img]`;
        const htmlCode = `<img src="${dataUrl}" alt="${customName || selectedFile.name}" />`;
        
        await saveImageMetadata(firestore, user, {
            originalName: customName || selectedFile.name,
            directUrl: dataUrl,
            bbCode,
            htmlCode,
            mimeType: selectedFile.type,
            fileSize: selectedFile.size,
            storagePath: 'data_url',
        });

        setStatus({ state: 'success', url: dataUrl });
        toast({ title: 'Succès', description: 'Votre image a été enregistrée (via Data URL).' });
        resetState();

    } catch (error) {
        const errorMessage = (error as Error).message;
        setStatus({ state: 'error', message: `Erreur: ${errorMessage}` });
        toast({ variant: 'destructive', title: 'Erreur', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  }, [selectedFile, customName, user, firestore, toast]);

  // METHOD 2: From External URL
  const handleUrlUpload = async () => {
    if (!imageUrl.trim() || !user || !firestore) return;
    setIsUrlLoading(true);

    try {
        const bbCode = `[img]${imageUrl}[/img]`;
        const htmlCode = `<img src="${imageUrl}" alt="Image depuis URL" />`;

        await saveImageFromUrl(firestore, user, {
            directUrl: imageUrl,
            bbCode,
            htmlCode,
        });

        setStatus({ state: 'success', url: imageUrl });
        toast({ title: 'Succès', description: 'Image depuis URL ajoutée.' });
        resetState();
        
    } catch (error) {
        const errorMessage = (error as Error).message;
        setStatus({ state: 'error', message: errorMessage });
        toast({ variant: 'destructive', title: 'Erreur', description: errorMessage });
    } finally {
        setIsUrlLoading(false);
    }
  };

  // METHOD 3: Firebase Storage (The real deal)
  const handleStorageUpload = useCallback(async () => {
    if (!selectedFile || !user || !storage || !firestore) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Utilisateur ou configuration Firebase manquante.' });
        return;
    }

    setIsProcessing(true);
    setStatus({ state: 'uploading', progress: 0 });

    try {
      const metadata = await uploadFileAndGetMetadata({
        storage,
        file: selectedFile,
        user,
        customName: customName || undefined,
        onProgress: (progress) => setStatus({ state: 'uploading', progress }),
      });

      await saveImageMetadata(firestore, user, metadata);

      setStatus({ state: 'success', url: metadata.directUrl });
      toast({ title: 'Succès (Storage)', description: 'Votre image a été téléversée via Firebase Storage.' });
      resetState();

    } catch (error: any) {
        const errorMessage = error.message || 'Une erreur inconnue est survenue.';
        setStatus({ state: 'error', message: `Erreur Storage: ${errorMessage}` });
        toast({ variant: 'destructive', title: 'Erreur Storage', description: errorMessage, duration: 9000 });
        console.error("handleStorageUpload error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, customName, user, storage, firestore, toast]);
  

  const isUploading = status.state === 'processing' || status.state === 'uploading';

  const renderFilePicker = () => (
    <div 
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isProcessing && fileInputRef.current?.click()}
        aria-disabled={isProcessing}
        className={cn(
        "border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors",
        !isProcessing && 'cursor-pointer hover:bg-muted/50',
        isProcessing && 'pointer-events-none opacity-70'
        )}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
    >
        <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        disabled={isProcessing}
        />
        <UploadCloud className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium text-foreground">
        {selectedFile ? `Fichier sélectionné : ${selectedFile.name}` : 'Cliquez pour choisir un fichier'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
        Fichiers supportés : JPG, PNG, GIF, WEBP (Max 10 Mo)
        </p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter une image</CardTitle>
        <CardDescription>
          Choisissez votre méthode de téléversement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="data-url" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="data-url"><UploadCloud className="mr-2"/>Via Fichier (sécurisé)</TabsTrigger>
            <TabsTrigger value="url"><LinkIcon className="mr-2"/>Via URL</TabsTrigger>
            <TabsTrigger value="storage"><HardDriveUpload className="mr-2"/>Via Storage (Test)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="data-url" className="space-y-4 pt-4">
            {renderFilePicker()}
            {selectedFile && (
                <div className="space-y-4">
                    <Input
                    placeholder="Nom personnalisé (optionnel)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    disabled={isProcessing}
                    />
                    <Button 
                    onClick={handleDataUrlUpload} 
                    disabled={isProcessing || !selectedFile} 
                    className="w-full"
                    >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isProcessing ? 'Traitement...' : 'Téléverser'}
                    </Button>
                </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="space-y-4 pt-4">
            <Input
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={isUrlLoading}
            />
            <Button onClick={handleUrlUpload} disabled={isUrlLoading || !imageUrl.trim()} className="w-full">
                {isUrlLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ajouter depuis l'URL
            </Button>
          </TabsContent>
          
          <TabsContent value="storage" className="space-y-4 pt-4">
            {renderFilePicker()}
            {status.state === 'uploading' && status.progress !== undefined && (
                <Progress value={status.progress} className="w-full" />
            )}
            {selectedFile && (
              <div className="space-y-4">
                <Input
                  placeholder="Nom personnalisé (optionnel)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={isUploading}
                />
                <Button 
                  onClick={handleStorageUpload} 
                  disabled={isUploading || !selectedFile} 
                  className="w-full"
                >
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {status.state === 'uploading' ? `Téléversement... ${status.progress?.toFixed(0) ?? 0}%` : 'Téléverser sur Storage'}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {status.state === 'error' && (
          <p className="mt-4 text-sm text-center text-destructive">{status.message}</p>
        )}

        {status.state === 'success' && (
          <div className="space-y-3 rounded-md border bg-muted/50 p-4 mt-4">
            <h4 className="font-medium text-sm">Opération réussie !</h4>
            
            <div className="space-y-2">
                <label className="text-sm font-medium">Lien direct</label>
                <div className="flex items-center gap-2">
                    <Input readOnly value={status.url} className="bg-background text-xs truncate"/>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.url)}>
                        {copied ? <Check className="text-green-500"/> : <Copy />}
                    </Button>
                </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
