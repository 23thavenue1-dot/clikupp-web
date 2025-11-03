'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Camera, Heart, Medal, Star, UserCheck, GalleryVertical, CalendarClock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const stats = [
    {
      title: 'Images téléversées',
      value: '0', // Placeholder
      icon: Camera,
      description: 'Le nombre total de vos images sur la plateforme.',
    },
    {
      title: 'Likes reçus',
      value: '0', // Placeholder
      icon: Heart,
      description: 'Le nombre total de "likes" que vos images ont reçus.',
    },
  ];

  const badges = [
    {
      title: 'Premier Upload',
      description: 'Décerné pour votre toute première image téléversée.',
      icon: Medal,
      unlocked: false, // Placeholder
    },
    {
      title: 'Fidèle de la semaine',
      description: 'Décerné pour vous être connecté 7 jours de suite.',
      icon: Award,
      unlocked: false, // Placeholder
    },
    // Add more badges here
  ];

  const achievements = [
      {
        title: 'Profil Complet',
        description: 'Remplir votre bio et votre site web.',
        icon: UserCheck,
        unlocked: false,
      },
      {
        title: 'Collection naissante',
        description: 'Téléverser au moins 10 images.',
        icon: GalleryVertical,
        unlocked: false,
      },
      {
        title: 'Habitué',
        description: 'Se connecter 3 jours de suite.',
        icon: CalendarClock,
        unlocked: false,
      }
  ]

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl mx-auto space-y-8">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord</h1>
            <p className="text-muted-foreground mt-1">Vos statistiques, succès et progression sur Clikup.</p>
          </header>

          {/* Section Progression */}
          <Card>
              <CardHeader>
                  <CardTitle>Progression & Niveau</CardTitle>
                  <CardDescription>Gagnez de l'expérience en utilisant l'application pour monter en niveau.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                      <p className="font-semibold">Niveau 1</p>
                      <p className="text-sm text-muted-foreground">Prochain niveau : 100 XP</p>
                  </div>
                  <Progress value={0} />
                  <p className="text-center text-sm text-muted-foreground">Votre progression : 0 / 100 XP</p>
              </CardContent>
          </Card>

          {/* Section Statistiques */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiques d'Utilisation</CardTitle>
              <CardDescription>Un aperçu de votre activité sur la plateforme.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <div key={stat.title} className="p-4 border rounded-lg flex items-start gap-4 bg-muted/20">
                    <div className="bg-primary/10 text-primary p-3 rounded-md">
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Collectionnez des badges uniques en montant de niveau.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {badges.map((badge) => (
                  <Tooltip key={badge.title}>
                    <TooltipTrigger asChild>
                      <div
                        className={`aspect-square p-2 border rounded-lg flex flex-col items-center justify-center text-center transition-opacity ${!badge.unlocked ? 'opacity-50' : ''}`}
                      >
                        <div className={`p-2 rounded-full mb-1 ${badge.unlocked ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                          <badge.icon className="h-6 w-6" />
                        </div>
                        <p className="text-[10px] font-semibold truncate max-w-full">{badge.title}</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{badge.title}</p>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                      {!badge.unlocked && <p className="text-xs font-bold text-center mt-1">(Verrouillé)</p>}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section Succès */}
          <Card>
            <CardHeader>
              <CardTitle>Succès</CardTitle>
              <CardDescription>Débloquez des succès pour gagner de l'expérience.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {achievements.map((achievement) => (
                    <Tooltip key={achievement.title}>
                        <TooltipTrigger asChild>
                           <div
                            className={`relative aspect-square p-2 border rounded-lg flex flex-col items-center justify-center text-center transition-all duration-300 ${!achievement.unlocked ? 'opacity-60' : 'bg-primary/5 border-primary/20'}`}
                           >
                            <div className={`p-2 rounded-full mb-1 transition-colors ${achievement.unlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                <achievement.icon className="h-6 w-6" />
                            </div>
                            <p className="text-[10px] font-semibold truncate max-w-full">{achievement.title}</p>
                            {achievement.unlocked && (
                                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                    <Check className="h-3 w-3 text-white" />
                                </div>
                            )}
                           </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="font-semibold">{achievement.title}</p>
                            <p className="text-sm text-muted-foreground">{achievement.description}</p>
                            {!achievement.unlocked && <p className="text-xs font-bold text-center mt-1">(Verrouillé)</p>}
                        </TooltipContent>
                    </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </TooltipProvider>
  );
}
