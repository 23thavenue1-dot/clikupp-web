
'use client';

import {
  doc,
  setDoc,
  Firestore,
  serverTimestamp,
  collection,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';

// Ce type représente la structure de données attendue pour un document d'image dans Firestore.
// Il est crucial qu'il corresponde au schéma dans backend.json et aux règles de sécurité.
export type ImageMetadata = {
  id: string;
  userId: string;
  originalName: string;
  storagePath: string;
  directUrl: string;
  bbCode: string;
  htmlCode: string;
  mimeType: string;
  fileSize: number;
  uploadTimestamp: any; // Firestore server timestamp.
  likeCount: number;
};

/**
 * Sauvegarde les métadonnées de l'image dans Firestore dans la sous-collection de l'utilisateur.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Un objet contenant les métadonnées complètes de l'image à sauvegarder.
 */
export function saveImageMetadata(
  firestore: Firestore,
  user: User,
  metadata: Omit<ImageMetadata, 'uploadTimestamp' | 'userId'>
) {
  const imageDocRef = doc(firestore, 'users', user.uid, 'images', metadata.id);

  const dataToSave = {
    ...metadata,
    userId: user.uid,
    uploadTimestamp: serverTimestamp(),
  };

  setDoc(imageDocRef, dataToSave).catch((error) => {
    console.error("Erreur lors de la sauvegarde des métadonnées de l'image :", error);
    
    const permissionError = new FirestorePermissionError({
      path: imageDocRef.path,
      operation: 'create',
      requestResourceData: dataToSave,
    });

    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * Incrémente le compteur de "J'aime" pour une image spécifique.
 * @param firestore L'instance Firestore.
 * @param imageUserId L'ID de l'utilisateur qui a posté l'image.
 * @param imageId L'ID de l'image à aimer.
 */
export function incrementImageLike(firestore: Firestore, imageUserId: string, imageId: string) {
  if (!imageUserId || !imageId) {
    console.warn("Impossible d'aimer une image de démonstration ou sans ID.");
    return;
  }
  const imageRef = doc(firestore, `users/${imageUserId}/images/${imageId}`);
  
  updateDoc(imageRef, {
    likeCount: increment(1)
  }).catch((error) => {
    console.error("Erreur lors de l'incrémentation du 'J'aime' :", error);
    
    const permissionError = new FirestorePermissionError({
      path: imageRef.path,
      operation: 'update',
      requestResourceData: { likeCount: 'increment(1)' },
    });

    errorEmitter.emit('permission-error', permissionError);
  });
}
