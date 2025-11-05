
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, ShieldCheck, Gamepad2, Link as LinkIcon, HardDriveUpload, Ticket, Wand2, Library, Users, Code, Bot, Briefcase, Camera, ArrowRight, Sparkles } from 'lucide-react';
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
    icon: Wand2,
    title: 'Assistant IA Créatif',
    description: 'Générez des descriptions, éditez vos photos en langage naturel et sublimez vos créations sans effort.',
  },
  {
    icon: Library,
    title: 'Organisation Puissante',
    description: 'Structurez vos images dans des galeries personnalisées et retrouvez-les facilement.',
  },
  {
    icon: LinkIcon,
    title: 'Partage Universel',
    description: 'Obtenez instantanément des liens URL, BBCode ou HTML pour tous vos besoins de partage.',
  },
  {
    icon: Ticket,
    title: 'Système Équitable',
    description: 'Profitez d\'un service gratuit et maîtrisé grâce à notre système de tickets quotidiens.',
  },
];

const targetUsers = [
    {
        icon: Camera,
        title: "Pour les Créateurs & Photographes",
        description: "Gagnez un temps précieux. Retouchez vos photos, générez des descriptions pertinentes et publiez plus rapidement sur les réseaux sociaux."
    },
    {
        icon: Bot,
        title: "Pour les Amateurs & Curieux de l'IA",
        description: "Expérimentez avec l'édition d'image par le langage. Transformez vos photos en œuvres d'art et découvrez votre potentiel créatif."
    },
    {
        icon: Code,
        title: "Pour les Développeurs & Intégrateurs",
        description: "Hébergez rapidement vos ressources graphiques et obtenez des liens stables pour vos projets web, sans configuration complexe."
    },
     {
        icon: Briefcase,
        title: "Pour les Professionnels & Agences",
        description: "Utilisez Clikup comme un outil de productivité pour enrichir votre contenu visuel et présenter des créations impeccables."
    }
]


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
                    <TabsList className="grid w-full grid-cols-2">
                         <AlertDialogTrigger asChild>
                            <TabsTrigger value="file" className="cursor-pointer"><UploadCloud className="mr-2 h-4 w-4"/>Via Fichier</TabsTrigger>
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
                  L'Hébergement d'Images. <span className="text-primary">Réinventé.</span>
              </h1>
              <p className="max-w-2xl mx-auto mt-4 text-lg md:text-xl text-muted-foreground">
                Ne vous contentez pas de stocker vos images. Donnez-leur une nouvelle vie avec notre assistant créatif intelligent.
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
              <h2 className="text-3xl md:text-4xl font-bold">Plus qu'un simple hébergeur.</h2>
              <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
                Des fonctionnalités conçues pour simplifier votre travail et décupler votre créativité.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="text-center shadow-sm hover:shadow-lg transition-shadow border-t-primary border-t-2 pt-4">
                  <CardContent className="p-6">
                    <div className="inline-block p-4 bg-primary/10 text-primary rounded-full mb-4">
                      <feature.icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        
        {/* AI Edit Showcase Section */}
        <section className="py-20 sm:py-24">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold">D'un simple selfie à une œuvre d'art.</h2>
                        <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
                            Décrivez la transformation que vous souhaitez en langage naturel. Notre IA s'occupe du reste.
                            <br/>Prompt utilisé ici : <span className="font-semibold text-primary">"Transforme ce portrait pour le rendre plus attractif et charismatique. Optimise la lumière, lisse la peau et donne une expression de confiance."</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="flex flex-col items-center">
                            <p className="font-semibold text-muted-foreground mb-2">AVANT</p>
                            <div className="aspect-square w-full relative rounded-xl shadow-lg overflow-hidden">
                                <Image 
                                    src="https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?q=80&w=2680&auto=format&fit=crop"
                                    alt="Portrait d'un homme avant la retouche par IA"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <p className="font-semibold text-primary mb-2">APRÈS (Généré par l'IA)</p>
                            <div className="aspect-square w-full relative rounded-xl shadow-2xl overflow-hidden border-2 border-primary/50">
                                <Image 
                                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2574&auto=format&fit=crop"
                                    alt="Portrait amélioré par l'intelligence artificielle, plus charismatique"
                                    fill
                                    className="object-cover"
                                />
                                <div className="absolute top-3 right-3 p-2 bg-background/80 backdrop-blur-sm rounded-full">
                                    <Sparkles className="h-6 w-6 text-primary"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Target Users Section */}
        <section className="py-20 sm:py-24 bg-muted/30">
             <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold">Conçu pour les ambitieux.</h2>
                    <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
                        Que vous soyez créateur, développeur ou professionnel, Clikup est votre allié productivité.
                    </p>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {targetUsers.map((user) => (
                        <div key={user.title} className="flex items-start gap-4 p-6 rounded-lg bg-background">
                           <div className="p-3 bg-primary/10 text-primary rounded-lg mt-1">
                                <user.icon className="h-6 w-6" />
                           </div>
                           <div>
                                <h3 className="text-lg font-semibold">{user.title}</h3>
                                <p className="text-muted-foreground mt-1">{user.description}</p>
                           </div>
                        </div>
                    ))}
                 </div>
             </div>
        </section>


         {/* Call to Action Section */}
        <section className="py-20 sm:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Prêt à passer au niveau supérieur ?</h2>
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
