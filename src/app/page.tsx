
'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { NotesSection } from './notes';
import { Uploader } from './uploader';
import { ImageList } from './ImageList';
import { type UserProfile } from '@/lib/firestore';
import { isBefore, subDays } from 'date-fns';
import { LandingPage } from './landing-page';


export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    const checkAndRefillTickets = async () => {
      // S'assurer que les données sont chargées et que la dernière recharge a eu lieu il y a plus d'un jour
      if (userProfile && userProfile.lastTicketRefill && userDocRef) {
        const lastRefillDate = userProfile.lastTicketRefill.toDate();
        const oneDayAgo = subDays(new Date(), 1);

        // Si la dernière recharge date de plus de 24h ET que le compteur est en dessous du maximum
        if (isBefore(lastRefillDate, oneDayAgo) && userProfile.ticketCount < 5) {
          try {
            await updateDoc(userDocRef, {
              ticketCount: 5, // Recharger à 5
              lastTicketRefill: serverTimestamp(),
            });
            console.log('Tickets rechargés pour l\'utilisateur:', userProfile.id);
          } catch (error) {
            console.error('Erreur lors de la recharge des tickets:', error);
          }
        }
      }
    };

    if (user) {
        checkAndRefillTickets();
    }
  }, [userProfile, userDocRef, user]);


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

        <Uploader />

        <ImageList />

        <NotesSection />

      </div>
    </div>
  );
}
