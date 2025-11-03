
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Camera, Heart, Medal, Star, UserCheck, GalleryVertical, CalendarClock, Trophy, Crown, Gem, Shield, Rocket, Sparkles, Sun, Upload, Share2, ThumbsUp, Pencil, ClipboardList, Library, Image as ImageIcon, Sparkle, Mail, FileText, Wand2 } from 'lucide-react';
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
    { title: 'Niv. 1 : Novice', description: 'Atteindre le niveau 1.', icon: Medal, unlocked: true, motivation: 'Félicitations ! C\'est le début d\'une grande aventure créative.' },
    { title: 'Niv. 2 : Initié', description: 'Atteindre le niveau 2.', icon: Award, unlocked: false, motivation: 'Excellent ! Vous maîtrisez les bases, continuez comme ça.' },
    { title: 'Niv. 3 : Habitué', description: 'Atteindre le niveau 3.', icon: Trophy, unlocked: false, motivation: 'Vous êtes maintenant un membre régulier. Votre galerie s\'étoffe !' },
    { title: 'Niv. 4 : Expert', description: 'Atteindre le niveau 4.', icon: Star, unlocked: false, motivation: 'Votre persévérance est impressionnante. Vous êtes un expert !' },
    { title: 'Niv. 5 : Maître', description: 'Atteindre le niveau 5.', icon: Crown, unlocked: false, motivation: 'Le statut de Maître vous va à ravir. Votre collection est une inspiration.' },
    { title: 'Niv. 6 : Vétéran', description: 'Atteindre le niveau 6.', icon: Gem, unlocked: false, motivation: 'Vous faites partie des piliers de la communauté. Respect !' },
    { title: 'Niv. 7 : Gardien', description: 'Atteindre le niveau 7.', icon: Shield, unlocked: false, motivation: 'Tel un gardien, vous veillez sur une collection d\'exception.' },
    { title: 'Niv. 8 : Pionnier', description: 'Atteindre le niveau 8.', icon: Rocket, unlocked: false, motivation: 'Vous explorez les limites de la plateforme. Un vrai pionnier !' },
    { title: 'Niv. 9 : Virtuose', description: 'Atteindre le niveau 9.', icon: Sparkles, unlocked: false, motivation: 'Votre créativité et votre dévouement sont sans égal. Un virtuose !' },
    { title: 'Niv. 10 : Icône', description: 'Atteindre le niveau 10.', icon: Sun, unlocked: false, motivation: 'Vous avez atteint le sommet. Vous êtes une Icône de Clikup !' },
  ];

  const achievements = [
      {
        title: 'Profil Complet',
        description: 'Remplir votre bio et votre site web.',
        icon: UserCheck,
        unlocked: false,
      },
       {
        title: 'Nouveau Look',
        description: 'Changer votre photo de profil pour la première fois.',
        icon: ImageIcon,
        unlocked: false,
      },
      {
        title: 'Caméléon',
        description: 'Changer 5 fois votre photo de profil.',
        icon: Sparkle,
        unlocked: false,
      },
       {
        title: 'Connecté',
        description: 'Garder les notifications par e-mail activées.',
        icon: Mail,
        unlocked: false,
      },
      {
        title: 'Premier Upload',
        description: 'Téléverser votre première image.',
        icon: Upload,
        unlocked: false,
      },
      {
        title: 'Collection Naissante',
        description: 'Téléverser au moins 10 images.',
        icon: GalleryVertical,
        unlocked: false,
      },
      {
        title: 'Habitué',
        description: 'Se connecter 3 jours de suite.',
        icon: CalendarClock,
        unlocked: false,
      },
      {
        title: 'Premier Partage',
        description: 'Partager une image pour la première fois.',
        icon: Share2,
        unlocked: false,
      },
      {
        title: 'Curateur',
        description: 'Liker une image (fonctionnalité à venir).',
        icon: ThumbsUp,
        unlocked: false,
      },
       {
        title: 'Auteur',
        description: 'Ajouter manuellement une description à une image.',
        icon: FileText,
        unlocked: false,
      },
      {
        title: 'Futuriste',
        description: 'Générer une description avec l\'IA.',
        icon: Wand2,
        unlocked: false,
      },
      {
        title: 'Première Note',
        description: 'Écrire votre première note dans le bloc-notes.',
        icon: Pencil,
        unlocked: false,
      },
      {
        title: 'Pense-bête',
        description: 'Écrire 5 notes dans le bloc-notes.',
        icon: ClipboardList,
        unlocked: false,
      },
      {
        title: 'Archiviste',
        description: 'Écrire 20 notes dans le bloc-notes.',
        icon: Library,
        unlocked: false,
      },
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
              <CardTitle>Badges de Niveau</CardTitle>
              <CardDescription>Collectionnez des badges uniques en montant de niveau.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {badges.map((badge) => (
                  <Tooltip key={badge.title}>
                    <TooltipTrigger asChild>
                      <div
                        className={`relative aspect-square p-2 border rounded-lg flex flex-col items-center justify-center text-center transition-opacity ${!badge.unlocked ? 'opacity-50' : 'bg-primary/5 border-primary/20'}`}
                      >
                         {badge.unlocked && (
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                <Check className="h-3 w-3 text-white" />
                            </div>
                        )}
                        <div className={`p-2 rounded-full mb-1 ${badge.unlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <badge.icon className="h-6 w-6" />
                        </div>
                        <p className="text-[10px] font-semibold truncate max-w-full">{badge.title}</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{badge.title}</p>
                      {badge.unlocked ? (
                        <p className="text-sm text-green-600 dark:text-green-400 italic">{badge.motivation}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{badge.description}</p>
                      )}
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
               <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
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

    