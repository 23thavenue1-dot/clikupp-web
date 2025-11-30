
'use client';

import Link from 'next/link';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/firestore';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Loader2, Image as ImageIcon, LogOut, Settings, User as UserIcon, LayoutDashboard, Sun, Moon, Monitor, Mail, Home, Sparkles, Library, NotebookText, ShoppingCart, Info, LineChart, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useTheme } from "next-themes";
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useAchievementNotification } from '@/hooks/useAchievementNotification';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


// Wrapper pour les liens de navigation qui vérifie les changements non sauvegardés
const UnsavedChangesLink = ({ href, children, ...props }: { href: string, children: React.ReactNode } & React.ComponentProps<typeof Link>) => {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const hasUnsavedChanges = (window as any).hasUnsavedChanges;
        if (hasUnsavedChanges) {
            e.preventDefault();
            const confirmLeave = window.confirm("Vous avez une image générée non sauvegardée. Êtes-vous sûr de vouloir quitter cette page ? Vos modifications seront perdues.");
            if (confirmLeave) {
                (window as any).hasUnsavedChanges = false; // Reset flag before navigating
                router.push(href);
            }
        }
    };

    return (
        <Link href={href} onClick={handleClick} {...props}>
            {children}
        </Link>
    );
};


export function Navbar() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { setTheme } = useTheme();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);
  
  const userLevel = userProfile?.level ?? 1;
  const { hasUnread: hasUnreadMsgs } = useUnreadMessages(userLevel);
  const { hasNew: hasNewAchievements } = useAchievementNotification();

  const handleSignOut = async () => {
    if (!user) return;
    try {
      await signOut(user.auth);
      toast({ title: 'Déconnexion réussie' });
      router.push('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur de déconnexion',
        description: (error as Error).message,
      });
    }
  };
  
  const getInitials = (email?: string | null, displayName?: string | null) => {
    if (displayName) {
      return displayName.charAt(0).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return '?';
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b shadow-sm">
      <TooltipProvider>
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          {/* Left Section */}
          <div className="flex items-center justify-start flex-1">
            <UnsavedChangesLink href="/" className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <ImageIcon className="h-7 w-7 text-purple-500" />
              <span className="text-gradient-ia">Clikup</span>
            </UnsavedChangesLink>
          </div>
          
          {/* Center Section */}
          <div className="flex items-center justify-center flex-1 gap-2">
            {user ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <UnsavedChangesLink href="/" passHref>
                      <Button variant="ghost" size="icon" aria-label="Accueil">
                        <Home className="h-5 w-5" />
                      </Button>
                    </UnsavedChangesLink>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Accueil</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <UnsavedChangesLink href="/galleries" passHref>
                      <Button variant="ghost" size="icon" aria-label="Mes Galeries">
                        <Library className="h-5 w-5" />
                      </Button>
                    </UnsavedChangesLink>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mes Galeries</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <UnsavedChangesLink href="/audit" passHref>
                      <Button variant="ghost" size="icon" aria-label="Coach Stratégique">
                        <LineChart className="h-5 w-5" />
                      </Button>
                    </UnsavedChangesLink>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coach Stratégique</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <UnsavedChangesLink href="/planner" passHref>
                      <Button variant="ghost" size="icon" aria-label="Planificateur">
                        <Calendar className="h-5 w-5" />
                      </Button>
                    </UnsavedChangesLink>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Planificateur</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <UnsavedChangesLink href="/shop" passHref>
                      <Button variant="ghost" size="icon" aria-label="Boutique">
                        <ShoppingCart className="h-5 w-5" />
                      </Button>
                    </UnsavedChangesLink>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Boutique</p>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Découvrir un secret" className="relative">
                            <Mail className="h-5 w-5" />
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Découvrir un secret</p>
                      </TooltipContent>
                    </Tooltip>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                              <Sparkles className="text-primary"/>
                              Un tips vous attend !
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                              Le premier niveau de notre système de progression est déjà débloqué. Il contient une astuce pour améliorer vos photos. <br/><br/>
                              Créez un compte gratuit pour la découvrir et commencer votre aventure créative sur Clikup !
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Plus tard</AlertDialogCancel>
                          <AlertDialogAction asChild>
                              <Link href="/signup">Créer un compte</Link>
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center justify-end flex-1 gap-2 sm:gap-4">
            {isUserLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full">
                        <Avatar className="h-9 w-9 border">
                            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'Avatar'} />
                            <AvatarFallback>{getInitials(user.email, user.displayName)}</AvatarFallback>
                        </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel>
                        <p className="font-semibold truncate">{user.displayName || user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                          <UnsavedChangesLink href="/dashboard" className="relative">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Tableau de bord</span>
                            {hasNewAchievements && (
                              <span className="absolute top-1/2 -translate-y-1/2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                            )}
                          </UnsavedChangesLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                           <UnsavedChangesLink href="/secret-messages" className="relative">
                               <Mail className="mr-2 h-4 w-4" />
                               <span>Tips de créateur</span>
                               {hasUnreadMsgs && (
                                   <span className="absolute top-1/2 -translate-y-1/2 right-2 flex h-2 w-2">
                                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                       <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                   </span>
                               )}
                           </UnsavedChangesLink>
                       </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <UnsavedChangesLink href="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Paramètres</span>
                          </UnsavedChangesLink>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                     <DropdownMenuGroup>
                        <DropdownMenuLabel>Clikup</DropdownMenuLabel>
                         <DropdownMenuItem asChild>
                            <UnsavedChangesLink href="/about">
                                <Info className="mr-2 h-4 w-4" />
                                <span>À propos & Guide</span>
                            </UnsavedChangesLink>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                          <Moon className="absolute h-4 w-4 mr-2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                          <span>Changer de thème</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => setTheme("light")}>
                              <Sun className="mr-2 h-4 w-4" />
                              <span>Clair</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("dark")}>
                              <Moon className="mr-2 h-4 w-4" />
                              <span>Nuit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("mid")}>
                              <Monitor className="mr-2 h-4 w-4" />
                              <span>Mid</span>
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Déconnexion</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href="/login">Connexion</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Inscription</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>
    </header>
  );
}
