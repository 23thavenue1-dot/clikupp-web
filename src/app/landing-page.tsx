
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, ShieldCheck, Gamepad2, Link as LinkIcon, HardDriveUpload, Ticket } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "@/components/ui/alert-dialog"

const features = [
  {
    icon: UploadCloud,
    title: 'Hébergement Facile',
    description: 'Téléversez vos images en un clin d\'œil depuis votre appareil, une URL ou directement sur notre cloud sécurisé.',
  },
  {
    icon: Gamepad2,
    title: 'Progression & Succès',
    description: 'Montez en niveau, débloquez des badges et accomplissez des succès. Votre activité est récompensée !',
  },
  {
    icon: ShieldCheck,
    title: 'Contrôle & Sécurité',
    description: 'Grâce à notre système de tickets quotidiens, profitez d\'un service gratuit et équitable, tout en gardant le contrôle.',
  },
];

function UploaderDemo() {
    return (
    <AlertDialog>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Ajouter une image</CardTitle>
                        <CardDescription>
                          Choisissez une méthode pour ajouter une image à votre galerie.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 font-semibold px-3 py-1.5 rounded-full text-sm h-auto bg-muted text-muted-foreground" title="5 tickets offerts chaque jour">
                        <Ticket className="h-5 w-5" />
                        <span>5</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="file" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                         <AlertDialogTrigger asChild>
                            <TabsTrigger value="file" className="cursor-pointer"><UploadCloud className="mr-2 h-4 w-4"/>Via Fichier</TabsTrigger>
                         </AlertDialogTrigger>
                         <AlertDialogTrigger asChild>
                            <TabsTrigger value="storage" className="cursor-pointer"><HardDriveUpload className="mr-2 h-4 w-4"/>Via Storage</TabsTrigger>
                         </AlertDialogTrigger>
                         <AlertDialogTrigger asChild>
                            <TabsTrigger value="url" className="cursor-pointer"><LinkIcon className="mr-2 h-4 w-4"/>Via URL</TabsTrigger>
                         </AlertDialogTrigger>
                    </TabsList>
                    <TabsContent value="file" className="space-y-4 pt-6">
                        <AlertDialogTrigger asChild>
                            <div 
                                role="button"
                                tabIndex={0}
                                className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer hover:bg-muted/50"
                            >
                                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                                <p className="mt-4 text-sm font-medium text-foreground">
                                    Cliquez pour choisir un fichier
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Taille max : 10 Mo.
                                </p>
                            </div>
                        </AlertDialogTrigger>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
        <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fonctionnalité réservée aux membres</AlertDialogTitle>
              <AlertDialogDescription>
                Pour téléverser des images, vous devez d'abord créer un compte. C'est rapide et gratuit !
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction asChild>
                 <Link href="/signup">Créer un compte</Link>
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    );
}

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 sm:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tighter">
                  Clikup
              </h1>
              <p className="max-w-2xl mx-auto mt-4 text-lg md:text-xl text-muted-foreground">
                La plateforme intelligente pour héberger, gérer et sublimer vos images. Plus qu'un simple stockage, un véritable partenaire créatif.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">Commencer Gratuitement</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/login">Se connecter</Link>
                </Button>
              </div>
            </div>
            <div className="max-w-xl mx-auto w-full mt-12">
              <UploaderDemo />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 sm:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">Tout ce dont vous avez besoin.</h2>
              <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
                Des fonctionnalités pensées pour les créateurs, les développeurs et les utilisateurs de tous les jours.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="text-center shadow-sm hover:shadow-lg transition-shadow">
                  <CardContent className="p-8">
                    <div className="inline-block p-4 bg-primary/10 text-primary rounded-full mb-4">
                      <feature.icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

         {/* Call to Action Section */}
        <section className="py-20 sm:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Prêt à donner vie à vos images ?</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Créez votre compte gratuit en quelques secondes et découvrez un nouvel univers pour vos créations.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/signup">Rejoindre Clikup maintenant</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Clikup. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
