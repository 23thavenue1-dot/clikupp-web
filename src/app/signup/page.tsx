
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useFirestore } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Veuillez entrer une adresse email valide." }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères." }),
});

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) return;
    setIsLoading(true);
    form.clearErrors();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // Créer un document utilisateur dans Firestore
      const userDocRef = doc(firestore, "users", user.uid);
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        creationTimestamp: serverTimestamp(),
        ticketCount: 5,
        lastTicketRefill: serverTimestamp(),
        level: 1,
        xp: 0,
        unlockedAchievements: [],
        emailNotifications: true,
        initialPhotoURL: user.photoURL,
        profilePictureUpdateCount: 0,
      });


      toast({ title: "Inscription réussie", description: "Votre compte a été créé. Vous pouvez maintenant vous connecter." });
      router.push("/login");
    } catch (error: any) {
      console.error(error);
      let description = "Une erreur inattendue est survenue.";
      
      if (error.code === 'auth/email-already-in-use') {
        description = "Cette adresse e-mail est déjà utilisée.";
        form.setError("email", { type: "manual", message: description });
        toast({
            variant: "destructive",
            title: "Erreur d'inscription",
            description: "Cet e-mail est déjà pris. Essayez de vous connecter.",
        });
      } else {
        description = error.message;
        toast({
            variant: "destructive",
            title: "Erreur d'inscription",
            description: description,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Inscription</CardTitle>
              <CardDescription>Créez un compte pour commencer à téléverser des images.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="votre@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                S'inscrire
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Connectez-vous
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </main>
  );
}
