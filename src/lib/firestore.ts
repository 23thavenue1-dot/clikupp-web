
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
  deleteDoc,
  Timestamp,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject, Storage } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';

// Correspond à la structure dans backend.json
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  creationTimestamp: Timestamp; 
  ticketCount: number;
  lastTicketRefill: Timestamp;
  emailNotifications?: boolean;
  bio?: string;
  websiteUrl?: string;
}


// Ce type représente la structure de données attendue pour un document d'image dans Firestore.
// Il est crucial qu'il corresponde au schéma dans backend.json et aux règles de sécurité.
export type ImageMetadata = {
  id: string;
  userId: string;
  originalName?: string;
  storagePath?: string;
  directUrl: string;
  bbCode: string;
  htmlCode: string;
  mimeType?: string;
  fileSize?: number;
  uploadTimestamp: Timestamp; // Changed to Timestamp for type safety
  likeCount: number;
};

// Nouveau type pour les notes
export type Note = {
  id: string;
  userId: string;
  text: string;
  createdAt: Timestamp; // Changed to Timestamp
}

/**
 * Sauvegarde les métadonnées d'une image dans Firestore après son téléversement.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Les métadonnées de l'image à sauvegarder.
 */
export async function saveImageMetadata(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount'>): Promise<void> {
    const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');

    const dataToSave = {
        ...metadata,
        userId: user.uid,
        uploadTimestamp: serverTimestamp(),
        likeCount: 0,
    };

    try {
        // addDoc crée le document et on récupère la référence
        const docRef = await addDoc(imagesCollectionRef, dataToSave);
        // On met ensuite à jour ce même document pour y ajouter son propre ID
        await updateDoc(docRef, { id: docRef.id });

    } catch (error) {
        console.error("Erreur lors de la sauvegarde des métadonnées de l'image :", error);
        const permissionError = new FirestorePermissionError({
            path: imagesCollectionRef.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}


/**
 * Décrémente le compteur de tickets de l'utilisateur de 1.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 */
export async function decrementTicketCount(firestore: Firestore, userId: string): Promise<void> {
  const userDocRef = doc(firestore, 'users', userId);
  try {
    await updateDoc(userDocRef, {
      ticketCount: increment(-1),
    });
  } catch (error) {
    console.error("Erreur lors du décompte du ticket:", error);
    // On ne propage pas l'erreur de permission ici pour ne pas interrompre le flux principal
    // si seul le décompte échoue. Une surveillance côté backend pourrait être envisagée.
    throw error; // Ou gérer silencieusement
  }
}


/**
 * Sauvegarde les métadonnées d'une image depuis une URL dans Firestore.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Les métadonnées de l'image à sauvegarder.
 */
export async function saveImageFromUrl(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount' | 'originalName' | 'storagePath' | 'mimeType' | 'fileSize'>): Promise<void> {
    const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');

    const dataToSave = {
        ...metadata,
        userId: user.uid,
        uploadTimestamp: serverTimestamp(),
        likeCount: 0,
        originalName: new URL(metadata.directUrl).pathname.split('/').pop() || 'image-from-url',
    };

    try {
        const docRef = await addDoc(imagesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde depuis URL :", error);
        const permissionError = new FirestorePermissionError({
            path: imagesCollectionRef.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}


/**
 * Supprime les métadonnées d'une image de Firestore.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur propriétaire.
 * @param imageId L'ID du document de l'image à supprimer.
 */
export async function deleteImageMetadata(firestore: Firestore, userId: string, imageId: string): Promise<void> {
  const imageDocRef = doc(firestore, 'users', userId, 'images', imageId);
  try {
    await deleteDoc(imageDocRef);
  } catch (error) {
    console.error("Erreur lors de la suppression des métadonnées Firestore:", error);
    const permissionError = new FirestorePermissionError({
        path: imageDocRef.path,
        operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}


/**
 * Sauvegarde une nouvelle note pour l'utilisateur dans Firestore.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param text Le contenu de la note.
 */
export function saveNote(firestore: Firestore, user: User, text: string) {
  const notesCollectionRef = collection(firestore, 'users', user.uid, 'notes');
  
  const dataToSave: Omit<Note, 'id' | 'createdAt'> = {
    userId: user.uid,
    text: text,
  };

  const dataWithTimestamp = {
      ...dataToSave,
      createdAt: serverTimestamp(),
  };

  // addDoc crée un document avec un ID généré automatiquement.
  return addDoc(notesCollectionRef, dataWithTimestamp).catch((error) => {
    console.error("Erreur lors de la sauvegarde de la note :", error);
    const permissionError = new FirestorePermissionError({
      path: notesCollectionRef.path, // Le chemin de la collection où l'ajout a échoué
      operation: 'create',
      requestResourceData: dataWithTimestamp,
    });

    errorEmitter.emit('permission-error', permissionError);
    // Renvoyer l'erreur pour que le composant puisse la gérer
    throw error;
  });
}


/**
 * Supprime un compte utilisateur et toutes ses données associées (Firestore et Storage).
 * @param firestore Instance de Firestore.
 * @param storage Instance de Storage.
 * @param userId L'ID de l'utilisateur à supprimer.
 */
export async function deleteUserAccount(firestore: Firestore, storage: Storage, userId: string): Promise<void> {
    
    // 1. Supprimer tous les documents des sous-collections (images, notes)
    const subcollections = ['images', 'notes'];
    for (const sub of subcollections) {
        const subCollectionRef = collection(firestore, 'users', userId, sub);
        const snapshot = await getDocs(subCollectionRef);
        const batch = writeBatch(firestore);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    
    // 2. Supprimer le document utilisateur principal
    const userDocRef = doc(firestore, 'users', userId);
    await deleteDoc(userDocRef);

    // 3. Supprimer tous les fichiers de l'utilisateur dans Storage (avatars, etc.)
    const userStorageRef = ref(storage, `users/${userId}`);
    const avatarsStorageRef = ref(storage, `avatars/${userId}`);

    const deleteFolderContents = async (folderRef:any) => {
        const listResults = await listAll(folderRef);
        const deletePromises = listResults.items.map(itemRef => deleteObject(itemRef));
        await Promise.all(deletePromises);
    };

    await Promise.all([
      deleteFolderContents(userStorageRef),
      deleteFolderContents(avatarsStorageRef)
    ]);
}
