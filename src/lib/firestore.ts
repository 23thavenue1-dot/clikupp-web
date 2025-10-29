
'use client';

import {
  doc,
  setDoc,
  Firestore,
  serverTimestamp,
  collection,
  updateDoc,
  increment,
  addDoc,
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

// Nouveau type pour les notes
export type Note = {
  id: string;
  userId: string;
  text: string;
  createdAt: any; // Firestore server timestamp
}

/**
 * Sauvegarde les métadonnées d'une image dans Firestore après son téléversement.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Les métadonnées de l'image à sauvegarder.
 */
export async function saveImageMetadata(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount'>) {
    const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');

    // On utilise addDoc, comme pour les notes.
    const dataToSave: Omit<ImageMetadata, 'id'> = {
        ...metadata,
        userId: user.uid,
        uploadTimestamp: serverTimestamp(),
        likeCount: 0,
        // On laisse l'ID vide pour le moment
        id: '' 
    };

    return addDoc(imagesCollectionRef, dataToSave)
        .then(docRef => {
            // Une fois le document créé, on le met à jour avec son propre ID.
            // C'est une étape cruciale pour que les règles de sécurité fonctionnent.
            return updateDoc(docRef, { id: docRef.id });
        })
        .catch(error => {
            console.error("Erreur lors de la sauvegarde des métadonnées de l'image :", error);
            const permissionError = new FirestorePermissionError({
                path: imagesCollectionRef.path,
                operation: 'create',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw error;
        });
}


/**
 * Sauvegarde une nouvelle note pour l'utilisateur dans Firestore.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param text Le contenu de la note.
 */
export function saveNote(firestore: Firestore, user: User, text: string) {
  const notesCollectionRef = collection(firestore, 'users', user.uid, 'notes');
  
  const dataToSave: Omit<Note, 'id'> = {
    userId: user.uid,
    text: text,
    createdAt: serverTimestamp(),
  };

  // addDoc crée un document avec un ID généré automatiquement.
  return addDoc(notesCollectionRef, dataToSave).catch((error) => {
    console.error("Erreur lors de la sauvegarde de la note :", error);
    const permissionError = new FirestorePermissionError({
      path: notesCollectionRef.path, // Le chemin de la collection où l'ajout a échoué
      operation: 'create',
      requestResourceData: dataToSave,
    });

    errorEmitter.emit('permission-error', permissionError);
    // Renvoyer l'erreur pour que le composant puisse la gérer
    throw error;
  });
}
