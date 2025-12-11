
'use client';

import { useEffect, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { Uploader } from './uploader';
import { ImageList } from './ImageList';
import { type UserProfile, checkAndRefillTickets } from '@/lib/firestore';
import { LandingPage } from './landing-page';
import { CreationHub } from '@/components/CreationHub';
import { NotesSection } from './notes';


export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const imagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/images`), orderBy('uploadTimestamp', 'desc'));
  }, [user, firestore]);
  const { data: images, isLoading: areImagesLoading } = useCollection(imagesQuery);

  useEffect(() => {
    if (userProfile && firestore && userDocRef) {
      checkAndRefillTickets(firestore, userDocRef, userProfile);
    }
  }, [userProfile, firestore, userDocRef]);


  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }
  
  const lastImage = images && images.length > 0 ? images[0] : null;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        
        <header className="text-center">
            <h1 className="text-4xl font-headline font-bold tracking-tight">
              Bienvenue, {userProfile?.displayName || user.email?.split('@')[0]}
            </h1>
            <p className="text-muted-foreground mt-2">
              Que souhaitez-vous créer aujourd'hui ?
            </p>
        </header>

        <div className="transition-transform transition-shadow duration-200 ease-out hover:shadow-xl hover:-translate-y-0.5 hover:border-primary border border-transparent rounded-lg">
          <Uploader />
        </div>
        
        {lastImage && !areImagesLoading && (
          <CreationHub lastImage={lastImage} />
        )}

        <ImageList />

        <NotesSection />
      </div>
    </div>
  );
}
