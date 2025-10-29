'use client';

import { useState, useRef, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, deleteImageFile } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl } from '@/lib/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, Copy, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from 'next/image';
import { cn } from '@/lib/utils';


// État pour gérer le processus de téléversement
type UploadStatus =
  | { state: 'idle' }
  | { state: 'uploading'; progress: number }
  | { state: 'processing' } // Firestore metadata saving
  | { state: 'success'; url: string; bbCode: string; htmlCode: string }
  | { state: 'error'; message: string };

const looksLikeImage = (f: File) =>
  /^(image\/.*)$/i.test(f.type) || /\.(png|jpe?g|gif|webp|avif|heic|heif|svg)$/i.test(f.name);

export function Uploader() {
  const { user, firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<'url' | 'bb' | 'html' | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);


  const resetState = () => {
    setStatus({ state: 'idle' });
    setSelectedFile(null);
    setCustomName('');
    setImageUrl('');
    setCopied(null);
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
        setCopied(null);
    }
  };

  const handleUpload = useCallback(() => {
    if (!selectedFile || !user || !storage || !firestore) return;

    uploadImage(
      storage,
      user,
      selectedFile,
      customName,
      (progress) => {
        setStatus({ state: 'uploading', progress });
      },
      async (downloadURL, storagePath) => {
        setStatus({ state: 'processing' });
        try {
          const bbCode = `[img]${downloadURL}[/img]`;
          const htmlCode = `<img src="${downloadURL}" alt="${customName || selectedFile.name}" />`;
          
          await saveImageMetadata(firestore, user, {
              originalName: selectedFile.name,
              storagePath,
              directUrl: downloadURL,
              bbCode,
              htmlCode,
              mimeType: selectedFile.type,
              fileSize: selectedFile.size,
          });

          setStatus({ state: 'success', url: downloadURL, bbCode, htmlCode });
          toast({ title: 'Succès', description: 'Votre image a été téléversée et enregistrée.' });
          resetState();

        } catch (error) {
           const errorMessage = (error as Error).message;
           setStatus({ state: 'error', message: `Erreur Firestore: ${errorMessage}` });
           // Attempt to delete the orphaned file from storage
           await deleteImageFile(storage, storagePath);
        }
      },
      (error) => {
        setStatus({ state: 'error', message: error.message });
      }
    );
  }, [selectedFile, customName, user, storage, firestore, toast]);

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

            setStatus({ state: 'success', url: imageUrl, bbCode, htmlCode });
            toast({ title: 'Succès', description: 'Image depuis URL ajoutée.' });
            
        } catch (error) {
            const errorMessage = (error as Error).message;
            setStatus({ state: 'error', message: errorMessage });
        } finally {
            setIsUrlLoading(false);
        }
    };


  const copyToClipboard = async (text: string, type: 'url' | 'bb' | 'html') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ variant:'destructive', title:'Copie impossible', description:'Autorisez l’accès au presse-papier ou copiez manuellement.' });
    }
  };
  
  const isUploading = status.state === 'uploading' || status.state === 'processing';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter une image</CardTitle>
        <CardDescription>
          Téléversez un fichier (max 10 Mo) ou ajoutez une image depuis une URL externe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload"><UploadCloud className="mr-2"/>Téléverser</TabsTrigger>
            <TabsTrigger value="url"><LinkIcon className="mr-2"/>Depuis une URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4 pt-4">
            <div 
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isUploading && fileInputRef.current?.click()}
              aria-disabled={isUploading}
              className={cn(
                "border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors",
                !isUploading && 'cursor-pointer hover:bg-muted/50',
                isUploading && 'pointer-events-none opacity-70'
                )}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
                disabled={isUploading}
              />
              <UploadCloud className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium text-foreground">
                {selectedFile ? `Fichier sélectionné : ${selectedFile.name}` : 'Cliquez pour choisir un fichier'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Fichiers supportés : JPG, PNG, GIF, WEBP (Max 10 Mo)
              </p>
            </div>

            {selectedFile && (
              <div className="space-y-4">
                <Input
                  placeholder="Nom personnalisé (optionnel)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={isUploading}
                />
                <Button 
                  onClick={handleUpload} 
                  disabled={isUploading || !selectedFile} 
                  className="w-full"
                >
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {status.state === 'uploading'
                    ? `Téléversement (${Math.round(status.progress)}%)...`
                    : status.state === 'processing'
                    ? 'Traitement...'
                    : 'Téléverser'}
                </Button>
              </div>
            )}
            
            {status.state === 'uploading' && (
              <Progress value={status.progress} className="w-full" />
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
        </Tabs>
        
        {status.state === 'error' && (
          <p className="text-sm text-destructive">{status.message}</p>
        )}

        {status.state === 'success' && (
          <div className="space-y-3 rounded-md border bg-muted/50 p-4">
            <h4 className="font-medium text-sm">Opération réussie !</h4>

            <div className="relative aspect-video w-full overflow-hidden rounded-md">
              <Image 
                src={status.url} 
                alt="Aperçu de l'image" 
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain bg-background"
                unoptimized
              />
            </div>
            
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Input readOnly value={status.url} className="bg-background text-xs truncate"/>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.url, 'url')}>
                        {copied === 'url' ? <Check className="text-green-500"/> : <Copy />}
                    </Button>
                </div>
                 <div className="flex items-center gap-2">
                    <Input readOnly value={status.bbCode} className="bg-background text-xs truncate"/>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.bbCode, 'bb')}>
                        {copied === 'bb' ? <Check className="text-green-500"/> : <Copy />}
                    </Button>
                </div>
                 <div className="flex items-center gap-2">
                    <Input readOnly value={status.htmlCode} className="bg-background text-xs truncate"/>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.htmlCode, 'html')}>
                        {copied === 'html' ? <Check className="text-green-500"/> : <Copy />}
                    </Button>
                </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
