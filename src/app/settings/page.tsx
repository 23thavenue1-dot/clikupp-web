

'use client';

import { useFirebase, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, increment, collection, query, orderBy, getDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser, updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { type UserProfile, deleteUserAccount } from '@/lib/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Receipt, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';


// Type for a payment document from Stripe extension
type Payment = {
    id: string;
    created: number;
    amount: number;
    currency: string;
    status: string;
    items: {
        price: {
            product: {
                name: string;
            }
        }
    }[];
    metadata: {
        productName?: string;
        packUploadTickets?: string;
        packAiTickets?: string;
    };
    _generated_for_history?: boolean;
};

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

// --- Profile Tab Component ---
function ProfileTab() {
  const { user, firebaseApp, auth } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => user && firestore ? doc(firestore, `users/${user.uid}`) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [selectedPredefinedAvatar, setSelectedPredefinedAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!user || !firestore || !userDocRef || !auth) return;
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

        if (Object.keys(authUpdates).length > 0 && auth.currentUser) {
            await updateProfile(auth.currentUser, authUpdates);
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

  if (!userProfile || !user) return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />;
  
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
    <Card>
      <CardHeader>
        <CardTitle>Profil Public</CardTitle>
        <CardDescription>Ces informations sont visibles par les autres utilisateurs.</CardDescription>
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
          <Textarea id="bio" placeholder="Parlez un peu de vous..." value={bio} onChange={(e) => setBio(e.target.value)} disabled={isSaving} />
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
  );
}

// --- Account Tab Component ---
function AccountTab() {
  const { user, firebaseApp, auth } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [emailNotifications, setEmailNotifications] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isResettingStripe, setIsResettingStripe] = useState(false);

  const userDocRef = useMemoFirebase(() => user && firestore ? doc(firestore, `users/${user.uid}`) : null, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  
  const paymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'customers', user.uid, 'payments'), orderBy('created', 'desc'));
  }, [user, firestore]);
  const { data: payments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const deleteAccountForm = useForm<z.infer<typeof deleteAccountFormSchema>>({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '' },
  });

  useEffect(() => {
    if (userProfile) {
      setEmailNotifications(userProfile.emailNotifications ?? false);
    }
  }, [userProfile]);

  const handleManageSubscription = async () => {
    if (!user || !firestore) return;
    setIsPortalLoading(true);
    
    const functions = getFunctions(getApp(), 'us-central1');
    const createPortalLink = httpsCallable(
      functions,
      'ext-firestore-stripe-payments-createPortalLink'
    );

    try {
        const { data } = await createPortalLink({ returnUrl: window.location.href });
        window.location.assign((data as { url: string }).url);
    } catch (error) {
        console.error("Erreur d'accès au portail:", error);
        toast({
            variant: 'destructive',
            title: 'Erreur d\'accès au portail',
            description: "Impossible d'accéder au portail de gestion. Si vous venez de vous abonner, veuillez réessayer dans quelques instants."
        });
    } finally {
        setIsPortalLoading(false);
    }
};

  const handleResetStripeCustomer = async () => {
      if (!userDocRef) return;
      setIsResettingStripe(true);
      try {
          await updateDoc(userDocRef, { stripeCustomerId: null });
          toast({
              title: "Client Stripe réinitialisé",
              description: "Votre ancien ID client de test a été effacé. Vous pouvez maintenant effectuer un nouvel achat.",
          });
      } catch (error) {
          console.error("Erreur de réinitialisation Stripe:", error);
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de réinitialiser l'ID client." });
      } finally {
          setIsResettingStripe(false);
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

  const handleNotificationChange = async (checked: boolean) => {
    if (!userDocRef) return;
    setEmailNotifications(checked);

    try {
      await updateDoc(userDocRef, { emailNotifications: checked });
      toast({
        title: 'Préférences mises à jour',
        description: `Notifications par e-mail ${checked ? 'activées' : 'désactivées'}.`
      });
    } catch (error: any) {
      setEmailNotifications(!checked);
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
        const userId = user.uid;
        const storage = getStorage(firebaseApp);
        await deleteUserAccount(firestore, storage, userId);
        await deleteUser(user);
        toast({ title: 'Compte supprimé', description: 'Votre compte et toutes vos données ont été effacés.' });
        router.push('/signup');
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

  if (!userProfile) return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />;

  return (
    <>
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
                <DialogDescription>Pour des raisons de sécurité, veuillez d'abord entrer votre mot de passe actuel.</DialogDescription>
              </DialogHeader>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4 py-4">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => ( <FormItem><FormLabel>Mot de passe actuel</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={passwordForm.control} name="newPassword" render={({ field }) => ( <FormItem><FormLabel>Nouveau mot de passe</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirmer le nouveau mot de passe</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={passwordForm.formState.isSubmitting}>{passwordForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
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
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="email-notifications" className="font-medium">Notifications par e-mail</Label>
              <p className="text-sm text-muted-foreground">Recevoir des notifications sur les actualités et les mises à jour.</p>
            </div>
            <Switch id="email-notifications" checked={emailNotifications} onCheckedChange={handleNotificationChange} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Abonnement</CardTitle>
            <CardDescription>Consultez votre statut d'abonnement et gérez vos informations de facturation.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label className="font-medium">Plan Actuel</Label>
                        <p className="text-lg font-bold capitalize">
                            {userProfile.subscriptionTier === 'none' ? 'Aucun' : userProfile.subscriptionTier}
                        </p>
                    </div>
                    {userProfile.subscriptionTier !== 'none' && (
                        <Button onClick={handleManageSubscription} disabled={isPortalLoading}>
                            {isPortalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Gérer mon abonnement
                        </Button>
                    )}
                </div>
                <div className="border-t pt-4">
                     <Button variant="outline" asChild>
                        <Link href="https://github.com/23thavenue1-dot/clikup-web/issues" target="_blank" rel="noopener noreferrer">
                           <AlertTriangle className="mr-2 h-4 w-4" />
                           Signaler un problème
                           <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1" className="border-none">
          <Card>
            <AccordionTrigger className="p-0 hover:no-underline">
              <CardHeader className="flex-1 text-left">
                <CardTitle>Historique des Achats</CardTitle>
                <CardDescription>Retrouvez ici la liste de vos achats de packs de tickets et abonnements.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                {arePaymentsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : payments && payments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead className="text-right">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments
                          .filter((payment) => {
                            const meta = payment.metadata || {};
                            const hasPackTickets = meta.packUploadTickets || meta.packAiTickets;
                            const isSyntheticSubscription = payment._generated_for_history === true;
                            return hasPackTickets || isSyntheticSubscription;
                          })
                          .map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{format(new Date(payment.created * 1000), 'd MMMM yyyy', { locale: fr })}</TableCell>
                              <TableCell className="font-medium">{payment.metadata?.productName || payment.items?.[0]?.price?.product?.name || 'Produit inconnu'}</TableCell>
                              <TableCell>{(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={payment.status === 'succeeded' ? 'default' : 'destructive'} className={payment.status === 'succeeded' ? 'bg-green-100 text-green-800' : ''}>
                                    {payment.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                      <Receipt className="mx-auto h-10 w-10" />
                      <p className="mt-4 font-medium">Aucun achat pour le moment.</p>
                      <p className="text-sm">Votre historique d'achats apparaîtra ici.</p>
                  </div>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Zone de danger</CardTitle>
          <CardDescription>Ces actions sont irréversibles. Soyez certain de votre choix.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <AlertDialog>
              <AlertDialogTrigger asChild>
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="font-medium">Réinitialiser le client Stripe</p>
                          <p className="text-sm text-muted-foreground">À n'utiliser qu'en cas d'erreur persistante `No such customer`.</p>
                      </div>
                      <Button variant="destructive" disabled={isResettingStripe} onClick={handleResetStripeCustomer}>
                          {isResettingStripe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          Réinitialiser Stripe
                      </Button>
                  </div>
              </AlertDialogTrigger>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Supprimer le compte</p>
                  <p className="text-sm text-muted-foreground">Toutes vos données seront définitivement effacées.</p>
                </div>
                <Button variant="destructive" disabled={isDeleting}>{isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Supprimer mon compte</Button>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument certain ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible. Toutes vos données, y compris vos images et votre profil, seront définitivement supprimées.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <Dialog>
                  <DialogTrigger asChild><AlertDialogAction className="bg-destructive hover:bg-destructive/90">Oui, supprimer mon compte</AlertDialogAction></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmation Finale</DialogTitle>
                      <DialogDescription>Pour des raisons de sécurité, veuillez entrer votre mot de passe pour confirmer la suppression de votre compte.</DialogDescription>
                    </DialogHeader>
                    <Form {...deleteAccountForm}>
                      <form onSubmit={deleteAccountForm.handleSubmit(handleDeleteAccount)} className="space-y-4 py-4">
                        <FormField control={deleteAccountForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Votre mot de passe</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
                          <Button type="submit" variant="destructive" disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Supprimer définitivement</Button>
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
    </>
  );
}

// --- Main Settings Page Component ---
export default function SettingsPage() {
  const { user, isUserLoading } = useFirebase();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Gérez votre profil public et les paramètres de votre compte.</p>
        </header>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="account">Compte</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="pt-6">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="account" className="space-y-8 pt-6">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
