
'use client';

import { useFirebase, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { type UserProfile, deleteUserAccount } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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

const deleteAccountFormSchema = z.object({
  password: z.string().min(1, { message: 'Le mot de passe est requis pour la suppression.' }),
});


export default function SettingsPage() {
  const { user, isUserLoading, firebaseApp } = useFirebase();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [emailNotifications, setEmailNotifications] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const deleteAccountForm = useForm<z.infer<typeof deleteAccountFormSchema>>({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (userProfile) {
      setEmailNotifications(userProfile.emailNotifications ?? false);
    }
  }, [userProfile]);

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

  const handleNotificationChange = async (checked: boolean) => {
    if (!userDocRef) return;
    setEmailNotifications(checked); // Update UI instantly

    try {
      await updateDoc(userDocRef, { emailNotifications: checked });
      toast({
        title: 'Préférences mises à jour',
        description: `Notifications par e-mail ${checked ? 'activées' : 'désactivées'}.`
      });
    } catch (error: any) {
      setEmailNotifications(!checked); // Revert on error
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible de mettre à jour les préférences de notification."
      });
    }
  };

  const handleDeleteAccount = async (values: z.infer<typeof deleteAccountFormSchema>) => {
    if (!user || !user.email || !firestore || !firebaseApp) return;
    setIsDeleting(true);
    deleteAccountForm.clearErrors();

    const credential = EmailAuthProvider.credential(user.email, values.password);

    try {
        await reauthenticateWithCredential(user, credential);

        // Maintenant que la réauthentification a réussi, on procède à la suppression
        const userId = user.uid;
        const storage = getStorage(firebaseApp);
        
        // 1. Supprimer toutes les données (Firestore, Storage)
        await deleteUserAccount(firestore, storage, userId);

        // 2. Supprimer l'utilisateur d'Authentication
        await deleteUser(user);

        toast({ title: 'Compte supprimé', description: 'Votre compte et toutes vos données ont été effacés.' });
        router.push('/signup'); // Rediriger vers la page d'inscription

    } catch (error: any) {
        let description = "Une erreur est survenue lors de la suppression du compte.";
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = 'Le mot de passe que vous avez entré est incorrect.';
            deleteAccountForm.setError('password', { type: 'manual', message: description });
        } else {
            description = error.message;
        }
        toast({ variant: 'destructive', title: 'Erreur de suppression', description });
    } finally {
        setIsDeleting(false);
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

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres du Compte</h1>
          <p className="text-muted-foreground mt-1">Gérez les paramètres techniques et de sécurité de votre compte.</p>
        </header>

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
                    <Switch 
                        id="email-notifications" 
                        checked={emailNotifications}
                        onCheckedChange={handleNotificationChange}
                    />
                </div>
            </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Zone de danger</CardTitle>
            <CardDescription>Ces actions sont irréversibles. Soyez certain de votre choix.</CardDescription>
          </CardHeader>
          <CardContent>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Supprimer le compte</p>
                            <p className="text-sm text-muted-foreground">Toutes vos données seront définitivement effacées.</p>
                        </div>
                        <Button variant="destructive" disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Supprimer mon compte
                        </Button>
                    </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous absolument certain ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Toutes vos données, y compris vos images et votre profil, seront définitivement supprimées.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <Dialog>
                            <DialogTrigger asChild>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90">
                                    Oui, supprimer mon compte
                                </AlertDialogAction>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Confirmation Finale</DialogTitle>
                                    <DialogDescription>
                                        Pour des raisons de sécurité, veuillez entrer votre mot de passe pour confirmer la suppression de votre compte.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form {...deleteAccountForm}>
                                    <form onSubmit={deleteAccountForm.handleSubmit(handleDeleteAccount)} className="space-y-4 py-4">
                                        <FormField
                                            control={deleteAccountForm.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Votre mot de passe</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <DialogFooter>
                                            <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
                                            <Button type="submit" variant="destructive" disabled={isDeleting}>
                                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Supprimer définitivement
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
