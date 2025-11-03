
'use client';

import Link from 'next/link';
import { useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function Navbar() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

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
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ImageIcon className="h-6 w-6 text-primary" />
          <span>Clikup</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          {isUserLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-4">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'Avatar'} />
                    <AvatarFallback>{getInitials(user.email, user.displayName)}</AvatarFallback>
                </Avatar>
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Déconnexion">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
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
    </header>
  );
}
