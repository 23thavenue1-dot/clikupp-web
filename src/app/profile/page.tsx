'use client';

import { useFirebase, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { type UserProfile } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ProfilePage() {
  const { user, isUserLoading, firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [selectedPredefinedAvatar, setSelectedPredefinedAvatar] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || userProfile.email || '');
      setBio(userProfile.bio || '');
      setWebsiteUrl(userProfile.websiteUrl || '');
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
    if (!user || !firestore || !userDocRef) return;
    setIsSaving(true);

    try {
        const authUpdates: { displayName?: string, photoURL?: string } = {};
        const firestoreUpdates: Partial<UserProfile> & { profilePictureUpdateCount?: any } = {};
        
        let finalPhotoURL = user.photoURL;

        if (selectedPredefinedAvatar) {
            finalPhotoURL = selectedPredefinedAvatar;
        } else if (profilePictureFile && firebaseApp) {
            try {
                const storage = getStorage(firebaseApp);
                const filePath = `avatars/${user.uid}/${profilePictureFile.name}`;
                const storageRef = ref(storage, filePath);
                const metadata = { contentType: profilePictureFile.type };
                await uploadBytes(storageRef, profilePictureFile, metadata);
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
            firestoreUpdates.profilePictureUpdateCount = increment(1);
        }

        if (displayName !== (userProfile?.displayName || '')) {
            authUpdates.displayName = displayName;
            firestoreUpdates.displayName = displayName;
        }

        if (bio !== (userProfile?.bio || '')) {
            firestoreUpdates.bio = bio;
        }

        if (websiteUrl !== (userProfile?.websiteUrl || '')) {
            firestoreUpdates.websiteUrl = websiteUrl;
        }

        if (Object.keys(authUpdates).length > 0) {
            await updateProfile(user, authUpdates);
        }
        if (Object.keys(firestoreUpdates).length > 0) {
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
  
  const isChanged = displayName !== (userProfile?.displayName || userProfile.email) ||
                    bio !== (userProfile?.bio || '') ||
                    websiteUrl !== (userProfile?.websiteUrl || '') ||
                    profilePictureFile !== null ||
                    selectedPredefinedAvatar !== null;
  
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
          <h1 className="text-3xl font-bold tracking-tight">Profil Public</h1>
          <p className="text-muted-foreground mt-1">Gérez vos informations publiques.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Informations Personnelles</CardTitle>
            <CardDescription>Ces informations peuvent être visibles par les autres utilisateurs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
                <Label>Avatar</Label>
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
              <Label htmlFor="bio">Bio</Label>
              <Textarea 
                  id="bio"
                  placeholder="Parlez un peu de vous..." 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Site web</Label>
              <Input id="websiteUrl" placeholder="https://votre-site.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} disabled={isSaving} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" value={userProfile.email} disabled />
              <p className="text-xs text-muted-foreground">L'adresse e-mail est utilisée pour la connexion et ne peut pas être modifiée.</p>
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
      </div>
    </div>
  );
}
