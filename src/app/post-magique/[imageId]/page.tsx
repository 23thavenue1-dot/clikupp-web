
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { ImageMetadata } from '@/lib/firestore';
import { Loader2, ArrowLeft, Instagram, Facebook, Clapperboard, Layers, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import Image from 'next/image';
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
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';


// Card components from CreationHub for consistent styling
const ActionCard = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
    <AlertDialog>
        <AlertDialogTrigger asChild>
            <div
                className={cn(
                    "group relative p-4 border rounded-xl h-full flex flex-col items-start gap-2 transition-all duration-300 ease-out cursor-pointer overflow-hidden transform hover:scale-[1.03]",
                    "bg-slate-900/50 border-slate-700/80 hover:border-purple-400/50 hover:shadow-2xl hover:shadow-purple-900/50",
                    className
                )}
                {...props}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950/40 to-blue-950 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10 w-full h-full flex flex-col items-start gap-2">
                    {children}
                </div>
            </div>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la génération ?</AlertDialogTitle>
                <AlertDialogDescription>
                    Cette action utilisera des tickets IA pour générer un nouveau contenu optimisé pour ce format. Êtes-vous sûr de vouloir continuer ?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction>Valider & Générer</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);

const ActionIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-2 bg-slate-800 border border-slate-700 text-purple-300 rounded-xl shadow-inner-lg transition-all duration-300 group-hover:bg-purple-950/50 group-hover:text-purple-200 group-hover:shadow-purple-500/20">
        <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
    </div>
);

const ActionTitle = ({ children }: { children: React.ReactNode }) => (
    <span className="font-semibold text-sm text-slate-100 transition-colors group-hover:text-white">{children}</span>
);

const SocialIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <div className="p-1 bg-slate-700/80 border border-slate-600 text-slate-300 rounded-full shadow-md absolute top-3 right-3 transition-all duration-300 group-hover:bg-purple-950/50 group-hover:text-purple-200">
        <Icon className="h-4 w-4" />
    </div>
);


export default function PostMagiquePage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params.imageId as string;

    const { user, isUserLoading } = useFirebase();
    const firestore = useFirestore();

    const imageDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}/images`, imageId);
    }, [user, firestore, imageId]);
    const { data: image, isLoading: isImageLoading } = useDoc<ImageMetadata>(imageDocRef);

    if (isUserLoading || isImageLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!image) {
        return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Image introuvable</h1>
                 <p className="text-muted-foreground">L'image source pour le Post Magique n'a pas été trouvée.</p>
                 <Button asChild className="mt-4">
                    <Link href="/">Retour à l'accueil</Link>
                 </Button>
            </div>
        );
    }
    
    const formats = [
        { network: 'Instagram', format: 'Publication', icon: Instagram, typeIcon: ImageIcon },
        { network: 'Instagram', format: 'Story', icon: Instagram, typeIcon: Clapperboard },
        { network: 'Instagram', format: 'Carrousel', icon: Instagram, typeIcon: Layers },
        { network: 'Facebook', format: 'Publication', icon: Facebook, typeIcon: ImageIcon },
    ];


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl mx-auto space-y-6">
                <header className="space-y-2">
                     <Button variant="ghost" asChild className="mb-4 -ml-4">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Retour à l'accueil
                        </Link>
                    </Button>
                    <h1 className="text-4xl font-bold tracking-tight">Post Magique 🪄</h1>
                    <p className="text-muted-foreground">
                        Choisissez un format. L'IA s'occupe de transformer votre image en un contenu optimisé prêt à publier.
                    </p>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Image d'Origine</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-md border bg-muted mb-4">
                            <Image
                                src={image.directUrl}
                                alt={image.title || image.originalName || 'Image d\'origine'}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Choisissez une transformation</CardTitle>
                        <CardDescription>Cliquez sur un format pour lancer la magie.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {formats.map((fmt, index) => (
                            <ActionCard key={index}>
                                <SocialIcon icon={fmt.icon} />
                                <ActionIcon icon={fmt.typeIcon} />
                                <ActionTitle>{fmt.format}</ActionTitle>
                                <span className="text-xs text-slate-400 transition-colors group-hover:text-slate-300">pour {fmt.network}</span>
                            </ActionCard>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
