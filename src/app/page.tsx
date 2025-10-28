
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  UploadCloud,
  Copy,
  FileText,
  Code,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { uploadImage } from '@/lib/storage';
import { saveImageMetadata } from '@/lib/firestore';
import { useAuth, useStorage, useFirestore } from '@/firebase';
import { ImageGallery } from './gallery';


type Stage = 'idle' | 'preview' | 'uploading' | 'success';

const humanSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
};

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('En attente…');
  const [result, setResult] = useState<{
    directUrl: string;
    bbCode: string;
    htmlCode: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const storage = useStorage();
  const firestore = useFirestore();
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleFile = useCallback(
    (selectedFile: File | undefined) => {
      if (!selectedFile) return;
      if (!selectedFile.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "Le fichier n'est pas une image.",
        });
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "L'image est trop lourde (>50 Mo).",
        });
        return;
      }

      setFile(selectedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStage('preview');
    },
    [previewUrl, toast]
  );

  const handleDragEvents = (
    e: React.DragEvent<HTMLDivElement>,
    isOver: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(isOver);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e, false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleFile(droppedFile);
  };

  const handleUpload = async () => {
    if (!file || !user || !storage || !firestore) return;
  
    setStage('uploading');
    setUploadProgress(0);
    setUploadStatus('Upload en cours…');
  
    uploadImage(
      storage,
      user,
      file,
      customName,
      (progress) => {
        setUploadProgress(progress);
        setUploadStatus(`Upload ${progress}%`);
      },
      (error) => {
        toast({
          variant: 'destructive',
          title: "Erreur d'upload",
          description: error.message,
        });
        setStage('preview');
      },
      (downloadURL, storagePath) => {
        // Crée les URLs BBCode et HTML ici
        const bbCode = `[img]${downloadURL}[/img]`;
        const htmlCode = `<img src="${downloadURL}" alt="${customName || file.name}" />`;
        
        // Appelle saveImageMetadata avec les données formatées correctement
        saveImageMetadata(firestore, user, {
          originalName: file.name,
          storagePath: storagePath,
          directUrl: downloadURL,
          mimeType: file.type,
          fileSize: file.size,
        });
  
        // Met à jour l'état du résultat pour l'affichage
        setResult({
          directUrl: downloadURL,
          bbCode: bbCode,
          htmlCode: htmlCode,
        });
        
        setUploadStatus('Terminé ✔');
        setStage('success');
      }
    );
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copié!',
        description: `${type} a été copié dans le presse-papiers.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'La copie a échoué.',
      });
    }
  };

  const resetUploader = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCustomName('');
    setUploadProgress(0);
    setUploadStatus('En attente…');
    setResult(null);
    setStage('idle');
  };

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="text-center flex-grow">
            <h1 className="text-4xl font-headline font-bold">
              Uploader d’images
            </h1>
            <p className="text-muted-foreground mt-2">
              Glisse-dépose une image ou choisis un fichier. À l’upload, tu
              obtiendras une URL directe.
            </p>
          </div>
        </header>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            {stage === 'idle' && (
              <div
                className={`flex justify-center items-center flex-col w-full p-8 sm:p-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${
                  isDragging
                    ? 'border-primary bg-accent'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
                onDragEnter={(e) => handleDragEvents(e, true)}
                onDragLeave={(e) => handleDragEvents(e, false)}
                onDragOver={(e) => handleDragEvents(e, true)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="w-12 h-12 text-muted-foreground" />
                <p className="mt-4 text-center text-muted-foreground">
                  <span className="font-semibold text-primary">
                    Cliquez pour parcourir
                  </span>{' '}
                  ou glissez-déposez
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF jusqu'à 50Mo
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            )}

            {stage === 'preview' && file && previewUrl && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center">
                  <ImageIcon className="mr-2 h-5 w-5" />
                  Aperçu et options
                </h3>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Image
                    src={previewUrl}
                    alt="Aperçu"
                    width={160}
                    height={160}
                    className="rounded-lg object-cover aspect-square border"
                  />
                  <div className="text-sm">
                    <p>
                      <strong>Nom :</strong> {file.name}
                    </p>
                    <p>
                      <strong>Taille :</strong> {humanSize(file.size)}
                    </p>
                    <p>
                      <strong>Type :</strong> {file.type}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="customName" className="font-medium text-sm">
                    Nom de fichier (optionnel)
                  </label>
                  <Input
                    id="customName"
                    type="text"
                    placeholder="mon-image-personnalisee"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sera nettoyé et un identifiant unique sera ajouté.
                  </p>
                </div>
              </div>
            )}

            {stage === 'uploading' && (
              <div className="text-center py-8">
                <h3 className="font-semibold text-lg">
                  Progression de l'upload
                </h3>
                <Progress value={uploadProgress} className="w-full my-4" />
                <p className="text-sm text-muted-foreground">{uploadStatus}</p>
              </div>
            )}

            {stage === 'success' && result && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">🎉 Upload terminé!</h3>
                <p className="text-sm text-muted-foreground">
                  Vos liens sont prêts à être partagés.
                </p>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="font-medium text-sm flex items-center">
                      <FileText className="w-4 h-4 mr-2" /> URL directe
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        readOnly
                        value={result.directUrl}
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(result.directUrl, "L'URL directe")
                        }
                        aria-label="Copy direct URL"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-medium text-sm flex items-center">
                      <Code className="w-4 h-4 mr-2" /> BBCode
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        readOnly
                        value={result.bbCode}
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(result.bbCode, 'Le BBCode')
                        }
                        aria-label="Copy BBCode"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-medium text-sm flex items-center">
                      <Code className="w-4 h-4 mr-2" /> HTML
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        readOnly
                        value={result.htmlCode}
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(result.htmlCode, 'Le code HTML')
                        }
                        aria-label="Copy HTML code"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {(stage === 'preview' || stage === 'success') && (
            <CardFooter className="bg-muted/50 p-4 border-t flex justify-end">
              {stage === 'preview' && (
                <Button onClick={handleUpload}>Uploader l'image</Button>
              )}
              {stage === 'success' && (
                <Button variant="secondary" onClick={resetUploader}>
                  Uploader une autre image
                </Button>
              )}
            </CardFooter>
          )}
        </Card>

        <ImageGallery />

      </div>
    </div>
  );
}

    

    