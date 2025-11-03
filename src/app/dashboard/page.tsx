'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Camera, Heart, Medal, Star, UserCheck, GalleryVertical, CalendarClock, Trophy, Crown, Gem, Shield, Rocket, Sparkles, Sun, Upload, Share2, ThumbsUp, Pencil, ClipboardList, Library, Image as ImageIcon, Sparkle, Mail, FileText, Wand2, MailOpen, KeyRound, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type UserProfile, type ImageMetadata } from '@/lib/firestore';
import { collection, query, updateDoc, doc, arrayUnion, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAchievementNotification } from '@/hooks/useAchievementNotification';

const XP_PER_ACHIEVEMENT = 20;
const XP_PER_LEVEL = 100;

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { markAchievementsAsSeen } = useAchievementNotification();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const userImagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/images`));
  }, [user, firestore]);
  const { data: userImages, isLoading: isImagesLoading } = useCollection<ImageMetadata>(userImagesQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Marquer les succès comme vus uniquement lorsque la page et le profil sont chargés
  useEffect(() => {
    if (userProfile) {
        markAchievementsAsSeen();
    }
  }, [userProfile, markAchievementsAsSeen]);

  const allAchievements = useMemo(() => [
    { id: 'profile-complete', title: 'Profil Complet', description: 'Remplir votre bio et votre site web.', icon: UserCheck, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => !!(profile.bio && profile.websiteUrl) },
    { id: 'first-upload', title: 'Premier Upload', description: 'Téléverser votre première image.', icon: Upload, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => (images?.length ?? 0) > 0 },
    { id: 'collection-nascente', title: 'Collection Naissante', description: 'Téléverser au moins 10 images.', icon: GalleryVertical, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => (images?.length ?? 0) >= 10 },
    { id: 'new-look', title: 'Nouveau Look', description: 'Changer votre photo de profil pour la première fois.', icon: ImageIcon, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => {
        return authUser?.photoURL !== profile.initialPhotoURL;
      } 
    },
    { id: 'cameleon', title: 'Caméléon', description: 'Changer 5 fois votre photo de profil.', icon: Sparkle, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => (profile.profilePictureUpdateCount ?? 0) >= 5 },
    { id: 'connected', title: 'Connecté', description: 'Garder les notifications par e-mail activées.', icon: Mail, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => profile.emailNotifications === true },
    { id: 'habitué', title: 'Habitué', description: 'Se connecter 3 jours de suite.', icon: CalendarClock, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique complexe
    { id: 'first-share', title: 'Premier Partage', description: 'Partager une image pour la première fois.', icon: Share2, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
    { id: 'curator', title: 'Curateur', description: 'Liker une image (fonctionnalité à venir).', icon: ThumbsUp, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false },
    { id: 'author', title: 'Auteur', description: 'Ajouter manuellement une description à une image.', icon: FileText, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => images?.some(image => !!image.description) },
    { id: 'futurist', title: 'Futuriste', description: 'Générer une description avec l\'IA.', icon: Wand2, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
    { id: 'curious', title: 'Curieux', description: 'Lire votre premier message secret.', icon: MailOpen, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
    { id: 'secret-seeker', title: 'Chercheur de Secrets', description: 'Lire 5 messages secrets.', icon: KeyRound, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
    { id: 'first-note', title: 'Première Note', description: 'Écrire votre première note dans le bloc-notes.', icon: Pencil, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
    { id: 'pense-bete', title: 'Pense-bête', description: 'Écrire 5 notes dans le bloc-notes.', icon: ClipboardList, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
    { id: 'archivist', title: 'Archiviste', description: 'Écrire 20 notes dans le bloc-notes.', icon: Library, xp: XP_PER_ACHIEVEMENT, isEligible: (profile: UserProfile, images: ImageMetadata[], authUser: User | null) => false }, // Logique à implémenter
  ], []);

  const unlockedAchievements = useMemo(() => {
    return allAchievements.map(ach => ({
        ...ach,
        unlocked: userProfile?.unlockedAchievements?.includes(ach.id) ?? false
    }))
  }, [userProfile, allAchievements]);

  // Logic to check and award achievements
  useEffect(() => {
    if (!userProfile || !userDocRef || !firestore || isImagesLoading || !userImages || !user) return;

    const checkAndAwardAchievements = async () => {
        const newlyUnlocked: typeof allAchievements = [];
        for (const achievement of allAchievements) {
            const alreadyUnlocked = userProfile.unlockedAchievements?.includes(achievement.id);
            if (!alreadyUnlocked && achievement.isEligible(userProfile, userImages, user)) {
                newlyUnlocked.push(achievement);
            }
        }

        if (newlyUnlocked.length > 0) {
            const totalXpGained = newlyUnlocked.reduce((sum, ach) => sum + ach.xp, 0);
            const currentXp = userProfile.xp ?? 0;
            const currentLevel = userProfile.level ?? 1;

            let newXp = currentXp + totalXpGained;
            let newLevel = currentLevel;

            while (newXp >= XP_PER_LEVEL) {
                newLevel += 1;
                newXp -= XP_PER_LEVEL;
                toast({ title: "Niveau Supérieur !", description: `Félicitations, vous avez atteint le niveau ${newLevel} !` });
            }
            
            const updates: Partial<UserProfile> = {
                xp: newXp,
                level: newLevel,
                unlockedAchievements: arrayUnion(...newlyUnlocked.map(a => a.id)) as any,
            };

            await updateDoc(userDocRef, updates);

            newlyUnlocked.forEach(achievement => {
                toast({ title: "Succès débloqué !", description: `Vous avez obtenu : "${achievement.title}" (+${achievement.xp} XP)` });
            });
            
            // Dispatch a custom event to notify other parts of the app (like the navbar)
            window.dispatchEvent(new CustomEvent('storage-updated'));
        }
    };

    checkAndAwardAchievements();

  }, [userProfile, userImages, user, userDocRef, firestore, toast, isImagesLoading, allAchievements]);


  const currentLevel = userProfile?.level ?? 1;
  const currentXp = userProfile?.xp ?? 0;
  const progressPercentage = (currentXp / XP_PER_LEVEL) * 100;


  const stats = [
    {
      title: 'Images téléversées',
      value: isImagesLoading ? <Skeleton className="h-6 w-10"/> : (userImages?.length ?? 0).toString(),
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
    { level: 1, title: 'Niv. 1 : Novice', icon: Medal, motivation: 'Félicitations ! C\'est le début d\'une grande aventure créative.' },
    { level: 2, title: 'Niv. 2 : Initié', icon: Award, motivation: 'Excellent ! Vous maîtrisez les bases, continuez comme ça.' },
    { level: 3, title: 'Niv. 3 : Habitué', icon: Trophy, motivation: 'Vous êtes maintenant un membre régulier. Votre galerie s\'étoffe !' },
    { level: 4, title: 'Niv. 4 : Expert', icon: Star, motivation: 'Votre persévérance est impressionnante. Vous êtes un expert !' },
    { level: 5, title: 'Niv. 5 : Maître', icon: Crown, motivation: 'Le statut de Maître vous va à ravir. Votre collection est une inspiration.' },
    { level: 6, title: 'Niv. 6 : Vétéran', icon: Gem, motivation: 'Vous faites partie des piliers de la communauté. Respect !' },
    { level: 7, title: 'Niv. 7 : Gardien', icon: Shield, motivation: 'Tel un gardien, vous veillez sur une collection d\'exception.' },
    { level: 8, title: 'Niv. 8 : Pionnier', icon: Rocket, motivation: 'Vous explorez les limites de la plateforme. Un vrai pionnier !' },
    { level: 9, title: 'Niv. 9 : Virtuose', icon: Sparkles, motivation: 'Votre créativité et votre dévouement sont sans égal. Un virtuose !' },
    { level: 10, title: 'Niv. 10 : Icône', icon: Sun, motivation: 'Vous avez atteint le sommet. Vous êtes une Icône de Clikup !' },
  ];

  if (isUserLoading || isProfileLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl mx-auto space-y-8">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord</h1>
            <p className="text-muted-foreground mt-1">Vos statistiques, succès et progression sur Clikup.</p>
          </header>

          <Card>
              <CardHeader>
                  <CardTitle>Progression & Niveau</CardTitle>
                  <CardDescription>Gagnez de l'expérience en débloquant des succès pour monter en niveau.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                      <p className="font-semibold">Niveau {currentLevel}</p>
                      <p className="text-sm text-muted-foreground">Prochain niveau : {XP_PER_LEVEL} XP</p>
                  </div>
                  <Progress value={progressPercentage} />
                  <p className="text-center text-sm text-muted-foreground">Votre progression : {currentXp} / {XP_PER_LEVEL} XP</p>
              </CardContent>
          </Card>

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
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badges de Niveau</CardTitle>
              <CardDescription>Collectionnez des badges uniques en montant de niveau.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {badges.map((badge) => {
                  const unlocked = currentLevel >= badge.level;
                  return (
                    <Tooltip key={badge.title}>
                      <TooltipTrigger asChild>
                        <div
                          className={`relative aspect-square p-2 border rounded-lg flex flex-col items-center justify-center text-center transition-opacity ${!unlocked ? 'opacity-50' : 'bg-primary/5 border-primary/20'}`}
                        >
                          {unlocked && (
                              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                  <Check className="h-3 w-3 text-white" />
                              </div>
                          )}
                          <div className={`p-2 rounded-full mb-1 ${unlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <badge.icon className="h-6 w-6" />
                          </div>
                          <p className="text-[10px] font-semibold truncate max-w-full">{badge.title}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold">{badge.title}</p>
                        {unlocked ? (
                          <p className="text-sm text-green-600 dark:text-green-400 italic">{badge.motivation}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Atteindre le niveau {badge.level}.</p>
                        )}
                        {!unlocked && <p className="text-xs font-bold text-center mt-1">(Verrouillé)</p>}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Succès</CardTitle>
              <CardDescription>Débloquez des succès pour gagner {XP_PER_ACHIEVEMENT} XP chacun.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {unlockedAchievements.map((achievement) => (
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
