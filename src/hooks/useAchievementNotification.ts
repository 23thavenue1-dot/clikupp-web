
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { type UserProfile } from '@/lib/firestore';
import { doc } from 'firebase/firestore';

const SEEN_ACHIEVEMENTS_KEY = 'seenAchievementsCount';

// Fonction pour récupérer le nombre de succès vus depuis localStorage
const getSeenCount = (): number => {
    if (typeof window === 'undefined') return 0;
    const seen = localStorage.getItem(SEEN_ACHIEVEMENTS_KEY);
    return seen ? parseInt(seen, 10) : 0;
};

// Hook pour gérer l'état des notifications de succès
export const useAchievementNotification = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [hasNew, setHasNew] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [user, firestore]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const checkNewAchievements = useCallback(() => {
        if (!userProfile) return;

        const seenCount = getSeenCount();
        const totalUnlocked = userProfile.unlockedAchievements?.length ?? 0;
        const newStatus = totalUnlocked > seenCount;

        // Condition pour casser la boucle de rendu
        setHasNew(prevHasNew => {
            if (prevHasNew !== newStatus) {
                return newStatus;
            }
            return prevHasNew;
        });
    }, [userProfile]);

    // Ce useEffect réagit maintenant directement aux changements du userProfile
    useEffect(() => {
        checkNewAchievements();
    }, [userProfile, checkNewAchievements]);

    // Ce useEffect gère la synchronisation entre les onglets
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === SEEN_ACHIEVEMENTS_KEY) {
                checkNewAchievements();
            }
        };

        const handleCustomUpdate = () => checkNewAchievements();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('storage-updated', handleCustomUpdate);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('storage-updated', handleCustomUpdate);
        };
    }, [checkNewAchievements]);

    // Fonction pour marquer tous les succès actuels comme vus
    const markAchievementsAsSeen = useCallback(() => {
        if (!userProfile) return;
        const totalUnlocked = userProfile.unlockedAchievements?.length ?? 0;
        // Only update if the seen count is different
        if (getSeenCount() !== totalUnlocked) {
            localStorage.setItem(SEEN_ACHIEVEMENTS_KEY, totalUnlocked.toString());
            setHasNew(false);
            // Notify other tabs/components that the storage has been updated
            window.dispatchEvent(new CustomEvent('storage-updated'));
        }
    }, [userProfile]);

    return { hasNew, markAchievementsAsSeen };
};
