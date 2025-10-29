'use client';

import { useState, useRef, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, MAX_BYTES, ALLOWED_MIME } from '@/lib/storage';
import { saveImageMetadata, saveImageFromUrl } from '@/lib/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, Copy, Check, Link, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { UploadTask } from 'firebase/storage';


// État pour gérer le processus de téléversement
type UploadStatus = 
  | { state: 'idle' } // Attente
  | { state: 'uploading'; progress: number } // En cours
  | { state: 'success'; url: string; bbCode: string; htmlCode: string } // Terminé
  | { state: 'error'; message: string }; // Erreur

const isLikelyImageUrl = (u: string) =>
  /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|heic|heif|svg)(\?.*)?$/i.test(u);

export function Uploader() {
  const { user, storage, firestore } = useFirebase();
  const { toast } = useToast();
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<UploadTask | null>(null);
  const [copied, setCopied] = useState<'url' | 'bb' | 'html' | null>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setSelectedFile(null);
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_BYTES) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Fichier trop volumineux (> 10 Mo).' });
        resetFileInput();
        return;
      }
      if (!ALLOWED_MIME.test(file.type)) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Type de fichier non autorisé (images uniquement).' });
        resetFileInput();
        return;
      }
      setSelectedFile(file);
      setStatus({ state: 'idle' });
      setCustomName('');
      setCopied(null);
    }
  };
  
  const handleTabChange = () => {
    setStatus({ state: 'idle' });
    resetFileInput();
    setCustomName('');
    setImageUrl('');
    setCopied(null);
  };

  const handleUrlUpload = async () => {
    if (!imageUrl.trim() || !user || !firestore) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'URL invalide ou utilisateur non connecté.' });
      return;
    }
     if (!isLikelyImageUrl(imageUrl)) {
        toast({ variant:'destructive', title:'URL invalide', description:"Fournissez l'URL directe d'une image (png, jpg, webp…)" });
        return;
    }
    
    setStatus({ state: 'uploading', progress: 50 }); // On peut choisir de montrer un spinner simple

    try {
      const bbCode = `[img]${imageUrl}[/img]`;
      const htmlCode = `<img src="${imageUrl}" alt="Image depuis URL" />`;
      
      await saveImageFromUrl(firestore, user, {
        directUrl: imageUrl,
        bbCode,
        htmlCode,
      });

      setStatus({ state: 'success', url: imageUrl, bbCode, htmlCode });
      toast({ title: 'Succès', description: 'Votre image a été référencée.' });
      setImageUrl(''); // Clear input on success
    } catch (error) {
       setStatus({ state: 'error', message: "L'enregistrement dans Firestore a échoué. Vérifiez les règles de sécurité de Firestore." });
       toast({ variant: 'destructive', title: "Erreur d'enregistrement", description: (error as Error).message });
    }
  };

  const handleUpload = useCallback(() => {
    if (!selectedFile || !user || !storage || !firestore) {
      let description = 'Le fichier, l\'utilisateur, ou la configuration Firebase est manquant.';
      if (!selectedFile) description = 'Veuillez sélectionner un fichier à téléverser.';
      if (!user) description = 'Vous devez être connecté pour téléverser un fichier.';
      toast({ variant: 'destructive', title: 'Erreur de pré-téléversement', description });
      return;
    }
    
    setStatus({ state: 'uploading', progress: 0 });

    taskRef.current = uploadImage(
      storage,
      user,
      selectedFile,
      customName,
      (progress) => setStatus({ state: 'uploading', progress }),
      (error) => {
        setStatus({ state: 'error', message: error.message });
        toast({ variant: 'destructive', title: 'Erreur de téléversement', description: error.message });
        resetFileInput();
      },
      async (directUrl, storagePath) => {
        try {
          const bbCode = `[img]${directUrl}[/img]`;
          const htmlCode = `<img src="${directUrl}" alt="Image téléversée" />`;

          await saveImageMetadata(firestore, user, {
            originalName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            storagePath,
            directUrl,
            bbCode,
            htmlCode,
          });

          setStatus({ state: 'success', url: directUrl, bbCode, htmlCode });
          toast({ title: 'Succès', description: 'Votre image a été téléversée et enregistrée.' });
          resetFileInput();
          setCustomName('');
        } catch (error) {
          const errorMessage = (error as Error).message;
          setStatus({ state: 'error', message: `L'enregistrement dans Firestore a échoué: ${errorMessage}` });
          toast({ variant: 'destructive', title: "Erreur d'enregistrement", description: errorMessage });
        }
      }
    );
  }, [selectedFile, customName, user, storage, firestore, toast]);

  const copyToClipboard = async (text: string, type: 'url' | 'bb' | 'html') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ variant:'destructive', title:'Copie impossible', description:'Autorisez l’accès au presse-papier ou copiez manuellement.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajouter une image</CardTitle>
        <CardDescription>
          Téléversez un fichier (max 10 Mo) ou ajoutez une image depuis une URL externe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        <Tabs defaultValue="upload" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload"><UploadCloud className="mr-2"/>Téléverser</TabsTrigger>
            <TabsTrigger value="url"><Link className="mr-2"/>Depuis une URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-4 space-y-4">
            <div 
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && status.state !== 'uploading' && fileInputRef.current?.click()}
              aria-disabled={status.state === 'uploading'}
              className={cn(
                "border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors",
                status.state !== 'uploading' && 'cursor-pointer hover:bg-muted/50',
                status.state === 'uploading' && 'pointer-events-none opacity-70'
                )}
              onClick={() => status.state !== 'uploading' && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
                disabled={status.state === 'uploading'}
              />
              <UploadCloud className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                {selectedFile ? `Fichier sélectionné : ${selectedFile.name}` : 'Glissez-déposez ou cliquez pour choisir un fichier'}
              </p>
            </div>

            {selectedFile && (
              <div className="space-y-4">
                <Input
                    type="text"
                    placeholder="Nom personnalisé (optionnel)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    disabled={status.state === 'uploading'}
                  />
                <Button 
                  onClick={handleUpload} 
                  disabled={status.state === 'uploading'} 
                  className="w-full"
                >
                  {status.state === 'uploading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {status.state === 'uploading' ? 'Téléversement en cours...' : 'Démarrer le téléversement'}
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="url" className="mt-4 space-y-4">
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Collez l'URL d'une image accessible publiquement.</p>
                <Input
                    type="url"
                    placeholder="https://exemple.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={status.state === 'uploading'}
                />
            </div>
            <Button 
                onClick={handleUrlUpload} 
                disabled={status.state === 'uploading' || !imageUrl.trim()} 
                className="w-full"
            >
                {status.state === 'uploading' && !selectedFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {status.state === 'uploading' && !selectedFile ? 'Enregistrement...' : 'Ajouter le lien'}
            </Button>
          </TabsContent>
        </Tabs>
        
        {status.state === 'uploading' && <Progress value={status.progress} />}
        
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
                style={{objectFit: 'contain'}}
                className="bg-background"
                unoptimized
              />
            </div>

            <div className="flex items-center gap-2">
                <Input readOnly value={status.url} className="bg-background"/>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.url, 'url')}>
                    {copied === 'url' ? <Check className="text-green-500"/> : <Copy />}
                </Button>
            </div>
             <div className="flex items-center gap-2">
                <Input readOnly value={status.bbCode} className="bg-background"/>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.bbCode, 'bb')}>
                    {copied === 'bb' ? <Check className="text-green-500"/> : <Copy />}
                </Button>
            </div>
             <div className="flex items-center gap-2">
                <Input readOnly value={status.htmlCode} className="bg-background"/>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(status.htmlCode, 'html')}>
                    {copied === 'html' ? <Check className="text-green-500"/> : <Copy />}
                </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

    