
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
type ImageMetadata = {
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

// Ce type représente les données de base que nous recevons de la page principale.
type InputMetadata = {
  originalName: string;
  storagePath: string;
  directUrl: string;
  mimeType: string;
  fileSize: number;
};

/**
 * Sauvegarde les métadonnées de l'image dans Firestore dans la sous-collection de l'utilisateur.
 * Cette fonction construit l'objet de données complet, y compris les champs requis par les règles de sécurité.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Un objet contenant les métadonnées de base du téléversement.
 */
export function saveImageMetadata(
  firestore: Firestore,
  user: User,
  metadata: InputMetadata
) {
  // 1. Génère un nouvel ID unique pour le document d'image.
  const imageCollectionRef = collection(firestore, 'users', user.uid, 'images');
  const imageDocRef = doc(imageCollectionRef);
  const imageId = imageDocRef.id;

  // 2. Construit l'objet de données complet à sauvegarder.
  const dataToSave: ImageMetadata = {
    id: imageId, // L'ID propre du document.
    userId: user.uid, // L'ID du propriétaire, requis par les règles.
    originalName: metadata.originalName,
    storagePath: metadata.storagePath,
    directUrl: metadata.directUrl,
    bbCode: `[img]${metadata.directUrl}[/img]`, // Généré ici pour la cohérence
    htmlCode: `<img src="${metadata.directUrl}" alt="${metadata.originalName}" />`, // Généré ici
    mimeType: metadata.mimeType,
    fileSize: metadata.fileSize,
    uploadTimestamp: serverTimestamp(),
    likeCount: 0, // Initialise le compteur de "J'aime" à 0
  };

  // 3. Tente d'écrire le document dans Firestore.
  setDoc(imageDocRef, dataToSave).catch((error) => {
    console.error('Erreur lors de la sauvegarde des métadonnées de l\'image :', error);
    
    // Crée une erreur contextuelle détaillée pour un meilleur débogage.
    const permissionError = new FirestorePermissionError({
      path: imageDocRef.path,
      operation: 'create',
      requestResourceData: dataToSave,
    });

    // Émet l'erreur globalement pour qu'elle puisse être interceptée et affichée.
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
