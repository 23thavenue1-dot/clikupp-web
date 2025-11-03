
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { type UserProfile } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';


const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, { message: 'Le mot de passe actuel est requis.' }),
    newPassword: z.string().min(6, { message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' }),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Les nouveaux mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
});


export default function SettingsPage() {
  const { user, isUserLoading, firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [selectedPredefinedAvatar, setSelectedPredefinedAvatar] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);


  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || userProfile.email || '');
    }
  }, [userProfile]);

  const getInitials = (email?: string | null, name?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Seules les images sont autorisées.' });
        return;
      }
      setSelectedPredefinedAvatar(null);
      setProfilePictureFile(file);
    }
  };

  const handleSelectPredefinedAvatar = (imageUrl: string) => {
    setProfilePictureFile(null);
    setSelectedPredefinedAvatar(imageUrl);
  };


  const handleSaveChanges = async () => {
    if (!user || !firestore) return;
    setIsSaving(true);

    try {
        const authUpdates: { displayName?: string, photoURL?: string } = {};
        const firestoreUpdates: { displayName?: string } = {};
        
        let finalPhotoURL = user.photoURL;

        if (selectedPredefinedAvatar) {
            finalPhotoURL = selectedPredefinedAvatar;
        } else if (profilePictureFile && firebaseApp) {
            try {
                const storage = getStorage(firebaseApp);
                const filePath = `avatars/${user.uid}/${profilePictureFile.name}`;
                const storageRef = ref(storage, filePath);
                await uploadBytes(storageRef, profilePictureFile);
                finalPhotoURL = await getDownloadURL(storageRef);
            } catch (storageError) {
                 console.error("Erreur de téléversement de l'avatar:", storageError);
                 toast({
                    variant: 'destructive',
                    title: 'Erreur de téléversement',
                    description: "Impossible de téléverser le nouvel avatar. Veuillez réessayer plus tard."
                 });
                 setIsSaving(false);
                 return;
            }
        }

        if (finalPhotoURL !== user.photoURL) {
            authUpdates.photoURL = finalPhotoURL;
        }

        if (displayName !== (userProfile?.displayName || '')) {
            authUpdates.displayName = displayName;
            firestoreUpdates.displayName = displayName;
        }

        if (Object.keys(authUpdates).length > 0) {
            await updateProfile(user, authUpdates);
        }
        if (Object.keys(firestoreUpdates).length > 0 && userDocRef) {
            await updateDoc(userDocRef, firestoreUpdates);
        }

        toast({ title: 'Succès', description: 'Votre profil a été mis à jour.' });
        setProfilePictureFile(null);
        setSelectedPredefinedAvatar(null);

    } catch (error: any) {
        console.error("Erreur lors de la mise à jour du profil:", error);
        toast({
            variant: 'destructive',
            title: 'Erreur',
            description: error.message || 'Une erreur est survenue lors de la sauvegarde.'
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleChangePassword = async (values: z.infer<typeof passwordFormSchema>) => {
    if (!user || !user.email) return;

    passwordForm.clearErrors();
    const { currentPassword, newPassword } = values;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    try {
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        
        toast({ title: 'Succès', description: 'Votre mot de passe a été modifié.' });
        passwordForm.reset();
        setIsPasswordDialogOpen(false);

    } catch (error: any) {
        let description = 'Une erreur est survenue.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = 'Le mot de passe actuel est incorrect.';
            passwordForm.setError('currentPassword', { type: 'manual', message: description });
        } else {
            description = error.message;
        }
        toast({ variant: 'destructive', title: 'Erreur', description });
    }
  };
  
  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return null;
  }
  
  const isChanged = displayName !== (userProfile?.displayName || userProfile.email) || profilePictureFile !== null || selectedPredefinedAvatar !== null;
  
  let avatarPreviewSrc: string | undefined = user.photoURL || undefined;
    if (profilePictureFile) {
    avatarPreviewSrc = URL.createObjectURL(profilePictureFile);
    } else if (selectedPredefinedAvatar) {
    avatarPreviewSrc = selectedPredefinedAvatar;
    }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Gérez les informations de votre compte et vos préférences.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Profil public</CardTitle>
            <CardDescription>Ces informations peuvent être visibles par les autres utilisateurs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border">
                        <AvatarImage src={avatarPreviewSrc} alt="Avatar" />
                        <AvatarFallback>{getInitials(user.email, displayName)}</AvatarFallback>
                    </Avatar>
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>Changer la photo</Button>
                </div>

                <div>
                    <p className="text-sm text-muted-foreground mb-2">Ou choisissez un avatar prédéfini :</p>
                    <TooltipProvider>
                        <div className="flex flex-wrap gap-2">
                            {PlaceHolderImages.map((image) => (
                            <Tooltip key={image.id}>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => handleSelectPredefinedAvatar(image.imageUrl)}
                                        className={cn(
                                        "relative h-16 w-16 rounded-full overflow-hidden border-2 transition-all",
                                        selectedPredefinedAvatar === image.imageUrl ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent hover:border-primary/50"
                                        )}
                                        disabled={isSaving}
                                    >
                                        <Image src={image.imageUrl} alt={image.description} fill sizes="64px" className="object-cover" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{image.description}</p>
                                </TooltipContent>
                            </Tooltip>
                            ))}
                        </div>
                    </TooltipProvider>
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nom d'affichage</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={isSaving} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" value={userProfile.email} disabled />
              <p className="text-xs text-muted-foreground">L'adresse e-mail ne peut pas être modifiée.</p>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <div className="flex w-full justify-end">
                <Button onClick={handleSaveChanges} disabled={!isChanged || isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer les modifications
                </Button>
            </div>
          </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Sécurité</CardTitle>
                <CardDescription>Gérez les paramètres de sécurité de votre compte.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                    <DialogTrigger asChild>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Mot de passe : **********</p>
                            <Button variant="outline">Changer</Button>
                        </div>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Changer le mot de passe</DialogTitle>
                            <DialogDescription>
                                Pour des raisons de sécurité, veuillez d'abord entrer votre mot de passe actuel.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4 py-4">
                                <FormField
                                    control={passwordForm.control}
                                    name="currentPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mot de passe actuel</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={passwordForm.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nouveau mot de passe</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={passwordForm.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Annuler</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                        {passwordForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enregistrer
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choisissez comment vous souhaitez être notifié.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <Label htmlFor="email-notifications" className="font-medium">Notifications par e-mail</Label>
                        <p className="text-sm text-muted-foreground">Recevoir des notifications sur les actualités et les mises à jour.</p>
                    </div>
                    <Switch id="email-notifications" disabled />
                </div>
            </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Zone de danger</CardTitle>
            <CardDescription>Ces actions sont irréversibles. Soyez certain de votre choix.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium">Supprimer le compte</p>
                    <p className="text-sm text-muted-foreground">Toutes vos données seront définitivement effacées.</p>
                </div>
                <Button variant="destructive" disabled>Supprimer mon compte</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    