
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { type UserProfile } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

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

  const getInitials = (email?: string | null, displayName?: string | null) => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
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

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Gérez les informations de votre compte et vos préférences.</p>
        </header>

        {/* Section Profil */}
        <Card>
          <CardHeader>
            <CardTitle>Profil public</CardTitle>
            <CardDescription>Ces informations peuvent être visibles par les autres utilisateurs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border">
                <AvatarImage src={user.photoURL || undefined} alt="Avatar" />
                <AvatarFallback>{getInitials(user.email, userProfile.displayName)}</AvatarFallback>
              </Avatar>
              <Button variant="outline" disabled>Changer la photo</Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nom d'affichage</Label>
              <Input id="displayName" defaultValue={userProfile.displayName} disabled />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" value={userProfile.email} disabled />
              <p className="text-xs text-muted-foreground">L'adresse e-mail ne peut pas être modifiée.</p>
            </div>
          </CardContent>
        </Card>

        {/* Section Sécurité */}
        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
            <CardDescription>Gérez les paramètres de sécurité de votre compte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Mot de passe</Label>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-muted-foreground">**********</p>
                <Button variant="outline" disabled>Changer</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Notifications */}
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


        {/* Section Suppression */}
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
