
'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { NotesSection } from './notes';
import { Uploader } from './uploader';
import { ImageList } from './ImageList';
import { type UserProfile } from '@/lib/firestore';

export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        
        <header className="flex justify-between items-center">
          <div className="text-center flex-grow">
            <h1 className="text-4xl font-headline font-bold">
              Page d'accueil
            </h1>
            <p className="text-muted-foreground mt-2">
              Bienvenue sur votre application.
            </p>
          </div>
        </header>

        <Uploader userProfile={userProfile} />

        <ImageList />

        <NotesSection />

      </div>
    </div>
  );
}
