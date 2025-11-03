
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UploadCloud, ShieldCheck, Gamepad2, Share2, Image as ImageIcon } from 'lucide-react';

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

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <div className="flex justify-center items-center gap-4 mb-6">
                <ImageIcon className="h-12 w-12 text-primary" />
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter">
                Clikup
                </h1>
            </div>
            <p className="max-w-2xl mx-auto mt-4 text-lg md:text-xl text-muted-foreground">
              La plateforme intelligente pour héberger, gérer et sublimer vos images. Plus qu'un simple stockage, un véritable partenaire créatif.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/signup">Commencer Gratuitement</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Se connecter</Link>
              </Button>
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
