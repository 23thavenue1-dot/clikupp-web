

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
  DocumentReference,
} from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject, Storage } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';
import { isBefore, startOfDay } from 'date-fns';

// Correspond à la structure dans backend.json
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  creationTimestamp: Timestamp; 
  ticketCount: number;
  lastTicketRefill: Timestamp;
  aiTicketCount: number;
  lastAiTicketRefill: Timestamp;
  emailNotifications?: boolean;
  bio?: string;
  websiteUrl?: string;
  level: number;
  xp: number;
  unlockedAchievements: string[];
  initialPhotoURL: string | null;
  profilePictureUpdateCount: number;
}


// Ce type représente la structure de données attendue pour un document d'image dans Firestore.
// Il est crucial qu'il corresponde au schéma dans backend.json et aux règles de sécurité.
export type ImageMetadata = {
  id: string;
  userId: string;
  originalName?: string;
  title?: string;
  description?: string;
  hashtags?: string;
  storagePath?: string;
  directUrl: string;
  bbCode: string;
  htmlCode: string;
  mimeType?: string;
  fileSize?: number;
  uploadTimestamp: Timestamp; // Changed to Timestamp for type safety
  likeCount: number;
  generatedByAI?: boolean;
};

// Nouveau type pour les notes
export type Note = {
  id: string;
  userId: string;
  text: string;
  createdAt: Timestamp; // Changed to Timestamp
}

// Nouveau type pour les galeries
export type Gallery = {
  id: string;
  userId: string;
  name: string;
  description: string;
  imageIds: string[];
  createdAt: Timestamp;
};


/**
 * Vérifie et recharge les tickets (upload et IA) de l'utilisateur si nécessaire.
 * La recharge a lieu si la dernière recharge date d'un jour précédent.
 * @param firestore L'instance Firestore.
 * @param userDocRef La référence au document de l'utilisateur.
 * @param userProfile Le profil de l'utilisateur.
 */
export async function checkAndRefillTickets(firestore: Firestore, userDocRef: DocumentReference, userProfile: UserProfile): Promise<void> {
    const today = new Date();
    const updates: { [key: string]: any } = {};

    // 1. Vérification des tickets d'upload
    if (userProfile.lastTicketRefill) {
        const lastRefillDate = userProfile.lastTicketRefill.toDate();
        if (isBefore(startOfDay(lastRefillDate), startOfDay(today))) {
            updates.ticketCount = 5;
            updates.lastTicketRefill = serverTimestamp();
        }
    }

    // 2. Vérification des tickets IA
    if (userProfile.lastAiTicketRefill) {
        const lastAiRefillDate = userProfile.lastAiTicketRefill.toDate();
        if (isBefore(startOfDay(lastAiRefillDate), startOfDay(today))) {
            updates.aiTicketCount = 3;
            updates.lastAiTicketRefill = serverTimestamp();
        }
    }

    // Appliquer les mises à jour si nécessaire
    if (Object.keys(updates).length > 0) {
        try {
            await updateDoc(userDocRef, updates);
            console.log('Mise à jour des tickets effectuée pour l\'utilisateur:', userProfile.id, updates);
        } catch (error) {
            console.error('Erreur lors de la recharge des tickets:', error);
        }
    }
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
 * Décrémente le compteur de tickets IA de l'utilisateur de 1.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 */
export async function decrementAiTicketCount(firestore: Firestore, userId: string): Promise<void> {
  const userDocRef = doc(firestore, 'users', userId);
  try {
    await updateDoc(userDocRef, {
      aiTicketCount: increment(-1),
    });
  } catch (error) {
    console.error("Erreur lors du décompte du ticket IA:", error);
    throw error;
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


/**
 * Met à jour les données structurées (titre, description, hashtags) d'une image dans Firestore.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageId L'ID de l'image.
 * @param data Un objet contenant le titre, la description et les hashtags.
 * @param generatedByAI Indique si la description a été générée par l'IA pour débloquer un succès.
 */
export async function updateImageDescription(
    firestore: Firestore, 
    userId: string, 
    imageId: string, 
    data: { title: string; description: string; hashtags: string; },
    generatedByAI: boolean
): Promise<void> {
    const imageDocRef = doc(firestore, 'users', userId, 'images', imageId);
    
    const dataToUpdate: { title: string, description: string, hashtags: string, generatedByAI?: boolean } = {
        title: data.title,
        description: data.description,
        hashtags: data.hashtags
    };

    if (generatedByAI) {
        dataToUpdate.generatedByAI = true;
    }

    try {
        await updateDoc(imageDocRef, dataToUpdate);
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la description :", error);
        const permissionError = new FirestorePermissionError({
            path: imageDocRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

/**
 * Crée une nouvelle galerie pour l'utilisateur.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param name Le nom de la galerie.
 * @param description La description de la galerie.
 */
export async function createGallery(firestore: Firestore, user: User, name: string, description: string): Promise<void> {
    const galleriesCollectionRef = collection(firestore, 'users', user.uid, 'galleries');
    
    const dataToSave = {
        userId: user.uid,
        name,
        description,
        imageIds: [],
        createdAt: serverTimestamp(),
    };

    try {
        const docRef = await addDoc(galleriesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
    } catch (error) {
        console.error("Erreur lors de la création de la galerie :", error);
        const permissionError = new FirestorePermissionError({
            path: galleriesCollectionRef.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

/**
 * Supprime une galerie et ses références.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param galleryId L'ID de la galerie à supprimer.
 */
export async function deleteGallery(firestore: Firestore, userId: string, galleryId: string): Promise<void> {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    try {
        await deleteDoc(galleryDocRef);
    } catch (error) {
        console.error("Erreur lors de la suppression de la galerie :", error);
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

    
