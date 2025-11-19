

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
  arrayUnion,
  query,
  where,
  getDoc,
  arrayRemove,
} from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject, Storage } from 'firebase/storage';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';
import { isBefore, startOfDay, startOfMonth } from 'date-fns';


export interface CustomPrompt {
  id: string;
  name: string;
  value: string;
}

// Correspond à la structure dans backend.json
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  creationTimestamp: Timestamp; 
  // Tickets gratuits
  ticketCount: number;
  lastTicketRefill: Timestamp;
  aiTicketCount: number;
  lastAiTicketRefill: Timestamp;
  // Limites mensuelles
  aiTicketMonthlyCount: number;
  aiTicketMonthlyReset: Timestamp;
  // Notifications et profil
  emailNotifications?: boolean;
  bio?: string;
  websiteUrl?: string;
  level: number;
  xp: number;
  unlockedAchievements: string[];
  customPrompts: CustomPrompt[];
  pinnedImageIds?: string[];
  initialPhotoURL: string | null;
  profilePictureUpdateCount: number;
  // Nouveaux champs pour la boutique
  packUploadTickets: number;
  packAiTickets: number;
  subscriptionUploadTickets: number;
  subscriptionAiTickets: number;
  subscriptionTier: 'none' | 'creator' | 'pro' | 'master';
  subscriptionRenewalDate: Timestamp | null;
  // Stripe
  stripeCustomerId?: string;
  // Nouveaux compteurs pour le suivi de l'IA
  totalImageEdits: number;
  totalDescriptionGenerations: number;
  // Suivi du stockage
  storageUsed: number;
  gracePeriodEndDate: Timestamp | null;
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
  completed: boolean;
  createdAt: Timestamp; // Changed to Timestamp
}

// Nouveau type pour les galeries
export type Gallery = {
  id: string;
  userId: string;
  name: string;
  description: string;
  imageIds: string[];
  pinnedImageIds?: string[];
  createdAt: Timestamp;
};

const DAILY_UPLOAD_TICKETS = 5;
const DAILY_AI_TICKETS = 3;
const MONTHLY_AI_TICKET_LIMIT = 20;

/**
 * Vérifie et recharge les tickets de l'utilisateur (journaliers et mensuels).
 * @param firestore L'instance Firestore.
 * @param userDocRef La référence au document de l'utilisateur.
 * @param userProfile Le profil de l'utilisateur.
 */
export async function checkAndRefillTickets(firestore: Firestore, userDocRef: DocumentReference, userProfile: UserProfile): Promise<void> {
    const now = new Date();
    const updates: { [key: string]: any } = {};

    let currentMonthlyAiCount = userProfile.aiTicketMonthlyCount ?? 0;

    // --- Gestion des Tickets Mensuels (doit être fait avant les tickets journaliers) ---
    const lastMonthlyReset = userProfile.aiTicketMonthlyReset ? userProfile.aiTicketMonthlyReset.toDate() : new Date(0);
    if (isBefore(startOfMonth(lastMonthlyReset), startOfMonth(now))) {
        updates.aiTicketMonthlyCount = 0;
        updates.aiTicketMonthlyReset = serverTimestamp();
        currentMonthlyAiCount = 0; // Réinitialiser pour le calcul ci-dessous
    }

    // --- Gestion des Tickets Journaliers d'Upload ---
    const lastUploadRefill = userProfile.lastTicketRefill ? userProfile.lastTicketRefill.toDate() : new Date(0);
    if (isBefore(startOfDay(lastUploadRefill), startOfDay(now))) {
        updates.ticketCount = DAILY_UPLOAD_TICKETS;
        updates.lastTicketRefill = serverTimestamp();
    }

    // --- Gestion des Tickets Journaliers IA (avec la limite mensuelle) ---
    const lastAiRefill = userProfile.lastAiTicketRefill ? userProfile.lastAiTicketRefill.toDate() : new Date(0);
    if (isBefore(startOfDay(lastAiRefill), startOfDay(now))) {
        if (currentMonthlyAiCount < MONTHLY_AI_TICKET_LIMIT) {
            const ticketsToGrant = Math.min(DAILY_AI_TICKETS, MONTHLY_AI_TICKET_LIMIT - currentMonthlyAiCount);
            if (ticketsToGrant > 0) {
                updates.aiTicketCount = ticketsToGrant;
                // Important: on incrémente la valeur qu'on a déjà, ou la nouvelle valeur si elle est dans updates
                updates.aiTicketMonthlyCount = increment(ticketsToGrant);
            } else {
                 updates.aiTicketCount = 0;
            }
        } else {
            updates.aiTicketCount = 0; // Limite mensuelle atteinte
        }
        updates.lastAiTicketRefill = serverTimestamp();
    }

    // Appliquer les mises à jour si nécessaire
    if (Object.keys(updates).length > 0) {
        updateDoc(userDocRef, updates).catch(error => {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: updates,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
}


/**
 * Sauvegarde les métadonnées d'une image dans Firestore après son téléversement.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Les métadonnées de l'image à sauvegarder.
 */
export function saveImageMetadata(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount'>): void {
    const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');
    const userDocRef = doc(firestore, 'users', user.uid);

    const dataToSave = {
        ...metadata,
        userId: user.uid,
        uploadTimestamp: serverTimestamp(),
        likeCount: 0,
    };

    addDoc(imagesCollectionRef, dataToSave)
      .then(docRef => {
        // Mettre à jour l'ID de l'image ET incrémenter le stockage utilisé
        const updatePromises = [
            updateDoc(docRef, { id: docRef.id }),
            updateDoc(userDocRef, { storageUsed: increment(metadata.fileSize || 0) })
        ];
        
        Promise.all(updatePromises).catch(error => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path, // or userDocRef.path
            operation: 'update',
            requestResourceData: { id: docRef.id, storageUsed: 'increment' },
          });
          errorEmitter.emit('permission-error', permissionError);
        });
      })
      .catch(error => {
        const permissionError = new FirestorePermissionError({
            path: imagesCollectionRef.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
}


/**
 * Décrémente le compteur de tickets d'upload de l'utilisateur en respectant la hiérarchie.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param profile Le profil complet de l'utilisateur.
 */
export function decrementTicketCount(firestore: Firestore, userId: string, profile: UserProfile): void {
  const userDocRef = doc(firestore, 'users', userId);
  const updates: { [key: string]: any } = {};

  if (profile.subscriptionTier === 'pro' || profile.subscriptionTier === 'master') {
      return; // Les abonnements Pro et Maître ont des uploads illimités
  }

  if (profile.ticketCount > 0) {
      updates.ticketCount = increment(-1);
  } else if (profile.subscriptionUploadTickets > 0) {
      updates.subscriptionUploadTickets = increment(-1);
  } else if (profile.packUploadTickets > 0) {
      updates.packUploadTickets = increment(-1);
  } else {
      console.error("Aucun ticket d'upload disponible pour décrémenter.");
      return;
  }

  updateDoc(userDocRef, updates).catch(error => {
    const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: updates,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
}


/**
 * Décrémente le compteur de tickets IA de l'utilisateur en respectant la hiérarchie.
 * Met également à jour les compteurs de suivi d'utilisation.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param profile Le profil complet de l'utilisateur.
 * @param type Le type d'opération IA ('edit' ou 'description').
 */
export function decrementAiTicketCount(
    firestore: Firestore,
    userId: string,
    profile: UserProfile,
    type: 'edit' | 'description'
): void {
  const userDocRef = doc(firestore, 'users', userId);
  const updates: { [key: string]: any } = {};
  
  if (profile.aiTicketCount > 0) {
      updates.aiTicketCount = increment(-1);
  } else if (profile.subscriptionAiTickets > 0) {
      updates.subscriptionAiTickets = increment(-1);
  } else if (profile.packAiTickets > 0) {
      updates.packAiTickets = increment(-1);
  } else {
      console.error("Aucun ticket IA disponible pour décrémenter.");
      return;
  }

  // Incrémenter le compteur de suivi approprié
  if (type === 'edit') {
      updates.totalImageEdits = increment(1);
  } else if (type === 'description') {
      updates.totalDescriptionGenerations = increment(1);
  }

  updateDoc(userDocRef, updates).catch(error => {
    const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: updates,
    });
    errorEmitter.emit('permission-error', permissionError);
  });
}



/**
 * Sauvegarde les métadonnées d'une image depuis une URL dans Firestore.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param metadata Les métadonnées de l'image à sauvegarder.
 */
export function saveImageFromUrl(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount' | 'originalName' | 'storagePath' | 'mimeType' | 'fileSize'>): void {
    const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');

    const dataToSave = {
        ...metadata,
        userId: user.uid,
        uploadTimestamp: serverTimestamp(),
        likeCount: 0,
        originalName: new URL(metadata.directUrl).pathname.split('/').pop() || 'image-from-url',
        fileSize: 0, // Taille de fichier inconnue pour les URL externes
    };

    addDoc(imagesCollectionRef, dataToSave)
      .then(docRef => {
        updateDoc(docRef, { id: docRef.id }).catch(error => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { id: docRef.id },
          });
          errorEmitter.emit('permission-error', permissionError);
        });
      })
      .catch(error => {
        const permissionError = new FirestorePermissionError({
            path: imagesCollectionRef.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}


/**
 * Supprime les métadonnées d'une image de Firestore.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur propriétaire.
 * @param imageId L'ID du document de l'image à supprimer.
 */
export async function deleteImageMetadata(firestore: Firestore, userId: string, imageId: string): Promise<void> {
  const imageDocRef = doc(firestore, 'users', userId, 'images', imageId);
  const userDocRef = doc(firestore, 'users', userId);

  try {
    const imageDoc = await getDoc(imageDocRef);
    if (!imageDoc.exists()) return;

    const imageData = imageDoc.data() as ImageMetadata;
    const fileSize = imageData.fileSize || 0;

    await deleteDoc(imageDocRef);

    // Décrémenter l'espace de stockage utilisé
    if (fileSize > 0) {
      await updateDoc(userDocRef, { storageUsed: increment(-fileSize) });
    }
  } catch (error) {
    const permissionError = new FirestorePermissionError({
        path: imageDocRef.path,
        operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

/**
 * Supprime plusieurs images de Firestore et de Storage.
 * @param firestore Instance de Firestore.
 * @param storage Instance de Storage.
 * @param userId ID de l'utilisateur.
 * @param imageIds Tableau d'IDs des images à supprimer.
 */
export async function deleteMultipleImages(firestore: Firestore, storage: Storage, userId: string, imageIds: string[]): Promise<void> {
    const batch = writeBatch(firestore);
    const imageRefsToDelete: DocumentReference[] = [];
    let totalSizeFreed = 0;

    // Étape 1 : Récupérer les chemins de stockage et la taille, et préparer la suppression Firestore
    for (const imageId of imageIds) {
        const imageDocRef = doc(firestore, `users/${userId}/images`, imageId);
        imageRefsToDelete.push(imageDocRef);
    }
    
    const imageDocs = await Promise.all(imageRefsToDelete.map(ref => getDoc(ref)));

    // Étape 2 : Préparer la suppression de Storage et calculer la taille totale
    const storageDeletePromises = imageDocs
        .map(docSnap => docSnap.data() as ImageMetadata)
        .filter(data => data && data.storagePath)
        .map(data => {
            totalSizeFreed += (data.fileSize || 0);
            batch.delete(doc(firestore, `users/${userId}/images`, data.id)); // Ajouter la suppression au batch
            const storageRef = ref(storage, data.storagePath);
            return deleteObject(storageRef).catch(error => {
                console.warn(`Impossible de supprimer le fichier de Storage: ${data.storagePath}`, error);
            });
        });

    await Promise.all(storageDeletePromises);

    // Étape 3 : Décrémenter le stockage utilisé sur le profil utilisateur
    if (totalSizeFreed > 0) {
        const userDocRef = doc(firestore, 'users', userId);
        batch.update(userDocRef, { storageUsed: increment(-totalSizeFreed) });
    }

    // Étape 4 : Exécuter toutes les suppressions et mises à jour Firestore
    await batch.commit().catch(error => {
        const permissionError = new FirestorePermissionError({
            path: `users/${userId}/images`,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    // Étape 5 (Optionnel mais recommandé) : Retirer les IDs des images de toutes les galeries
    const galleriesQuery = query(collection(firestore, 'users', userId, 'galleries'));
    const galleriesSnapshot = await getDocs(galleriesQuery);
    const galleryUpdateBatch = writeBatch(firestore);

    galleriesSnapshot.forEach(galleryDoc => {
        const galleryData = galleryDoc.data() as Gallery;
        const newImageIds = galleryData.imageIds.filter(id => !imageIds.includes(id));
        if (newImageIds.length !== galleryData.imageIds.length) {
            galleryUpdateBatch.update(galleryDoc.ref, { imageIds: newImageIds });
        }
    });

    await galleryUpdateBatch.commit().catch(error => {
        const permissionError = new FirestorePermissionError({
            path: `users/${userId}/galleries`,
            operation: 'update',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}


/**
 * Sauvegarde une nouvelle note pour l'utilisateur dans Firestore.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param text Le contenu de la note.
 */
export function saveNote(firestore: Firestore, user: User, text: string): void {
  const notesCollectionRef = collection(firestore, 'users', user.uid, 'notes');
  
  const dataToSave = {
    userId: user.uid,
    text: text,
    completed: false,
    createdAt: serverTimestamp(),
  };

  addDoc(notesCollectionRef, dataToSave)
    .then(docRef => {
      updateDoc(docRef, { id: docRef.id }).catch(error => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { id: docRef.id },
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    })
    .catch(error => {
      const permissionError = new FirestorePermissionError({
        path: notesCollectionRef.path,
        operation: 'create',
        requestResourceData: dataToSave,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Met à jour le contenu d'une note existante.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param noteId L'ID de la note à mettre à jour.
 * @param newText Le nouveau texte de la note.
 */
export function updateNote(firestore: Firestore, userId: string, noteId: string, newText: string): void {
    const noteDocRef = doc(firestore, 'users', userId, 'notes', noteId);
    const dataToUpdate = { text: newText };
    updateDoc(noteDocRef, dataToUpdate).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: noteDocRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Supprime une note.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param noteId L'ID de la note à supprimer.
 */
export function deleteNote(firestore: Firestore, userId: string, noteId: string): void {
    const noteDocRef = doc(firestore, 'users', userId, 'notes', noteId);
    deleteDoc(noteDocRef).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: noteDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Met à jour le statut "complété" d'une note.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param noteId L'ID de la note.
 * @param completed Le nouveau statut.
 */
export function toggleNoteCompletion(firestore: Firestore, userId: string, noteId: string, completed: boolean): void {
    const noteDocRef = doc(firestore, 'users', userId, 'notes', noteId);
    const dataToUpdate = { completed };
    updateDoc(noteDocRef, dataToUpdate).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: noteDocRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate,
        });
        errorEmitter.emit('permission-error', permissionError);
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
    const subcollections = ['images', 'notes', 'galleries'];
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
        try {
            const listResults = await listAll(folderRef);
            const deletePromises = listResults.items.map(itemRef => deleteObject(itemRef));
            await Promise.all(deletePromises);
        } catch (error) {
             console.warn(`Impossible de lister ou supprimer le contenu du dossier ${folderRef.fullPath}:`, error);
        }
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
export function updateImageDescription(
    firestore: Firestore, 
    userId: string, 
    imageId: string, 
    data: { title: string; description: string; hashtags: string; },
    generatedByAI: boolean
): void {
    const imageDocRef = doc(firestore, 'users', userId, 'images', imageId);
    
    const dataToUpdate: { title: string, description: string, hashtags: string, generatedByAI?: boolean } = {
        title: data.title,
        description: data.description,
        hashtags: data.hashtags
    };

    if (generatedByAI) {
        dataToUpdate.generatedByAI = true;
    }

    updateDoc(imageDocRef, dataToUpdate).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: imageDocRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Crée une nouvelle galerie pour l'utilisateur.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param name Le nom de la galerie.
 * @param description (Optionnel) La description de la galerie.
 */
export function createGallery(firestore: Firestore, userId: string, name: string, description: string = ''): Promise<DocumentReference> {
    const galleriesCollectionRef = collection(firestore, 'users', userId, 'galleries');
    
    const dataToSave = {
        userId: userId,
        name,
        description,
        imageIds: [],
        pinnedImageIds: [],
        createdAt: serverTimestamp(),
    };

    return new Promise((resolve, reject) => {
        addDoc(galleriesCollectionRef, dataToSave)
            .then(docRef => {
                updateDoc(docRef, { id: docRef.id })
                    .then(() => resolve(docRef))
                    .catch(reject);
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({
                    path: galleriesCollectionRef.path,
                    operation: 'create',
                    requestResourceData: dataToSave,
                });
                errorEmitter.emit('permission-error', permissionError);
                reject(error);
            });
    });
}

/**
 * Supprime une galerie et ses références.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param galleryId L'ID de la galerie à supprimer.
 */
export function deleteGallery(firestore: Firestore, userId: string, galleryId: string): void {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    deleteDoc(galleryDocRef).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Ajoute une image à une galerie.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageId L'ID de l'image à ajouter.
 * @param galleryId L'ID de la galerie.
 */
export function addImageToGallery(firestore: Firestore, userId: string, imageId: string, galleryId: string): void {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    updateDoc(galleryDocRef, { imageIds: arrayUnion(imageId) }).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'update',
            requestResourceData: { imageIds: arrayUnion(imageId) },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Épingle ou désépingle une image dans une galerie.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param galleryId L'ID de la galerie.
 * @param imageId L'ID de l'image.
 * @param pin `true` pour épingler, `false` pour désépingler.
 */
export function toggleImagePinInGallery(firestore: Firestore, userId: string, galleryId: string, imageId: string, pin: boolean): void {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    const updateData = {
        pinnedImageIds: pin ? arrayUnion(imageId) : arrayRemove(imageId)
    };
    updateDoc(galleryDocRef, updateData).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'update',
            requestResourceData: { imageIdToToggle: imageId },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Épingle ou désépingle une image globalement pour un utilisateur.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageId L'ID de l'image.
 * @param pin `true` pour épingler, `false` pour désépingler.
 */
export function toggleGlobalImagePin(firestore: Firestore, userId: string, imageId: string, pin: boolean): void {
    const userDocRef = doc(firestore, 'users', userId);
    const updateData = {
        pinnedImageIds: pin ? arrayUnion(imageId) : arrayRemove(imageId)
    };
    updateDoc(userDocRef, updateData).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { imageIdToToggle: imageId },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}


/**
 * Récupère toutes les images d'une galerie spécifique.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageIds Les IDs des images à récupérer.
 * @returns Une promesse qui résout en un tableau de métadonnées d'images.
 */
export async function getImagesForGallery(firestore: Firestore, userId: string, imageIds: string[]): Promise<ImageMetadata[]> {
    if (imageIds.length === 0) {
        return [];
    }
    const imagesCollectionRef = collection(firestore, `users/${userId}/images`);
    const q = query(imagesCollectionRef, where('id', 'in', imageIds));

    try {
        const querySnapshot = await getDocs(q);
        const images = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ImageMetadata));
        
        // Réordonner les images pour correspondre à l'ordre dans la galerie
        const imageMap = new Map(images.map(img => [img.id, img]));
        return imageIds.map(id => imageMap.get(id)).filter(Boolean) as ImageMetadata[];
    } catch (error) {
        console.error("Erreur lors de la récupération des images pour la galerie :", error);
        throw error;
    }
}

/**
 * Retire plusieurs images d'une galerie.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param galleryId L'ID de la galerie.
 * @param imageIds Un tableau d'IDs d'images à retirer.
 */
export function removeImagesFromGallery(firestore: Firestore, userId: string, galleryId: string, imageIds: string[]): void {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    const updateData = {
        imageIds: arrayRemove(...imageIds),
        pinnedImageIds: arrayRemove(...imageIds) // Also remove from pinned
    };
    updateDoc(galleryDocRef, updateData).catch(error => {
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'update',
            requestResourceData: { imageIdsToRemove: imageIds },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
}

/**
 * Ajoute ou supprime plusieurs images dans plusieurs galeries.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageIds Les IDs des images à traiter.
 * @param galleryIds Les IDs des galeries à mettre à jour.
 * @param remove Si true, retire les images au lieu de les ajouter.
 * @param fromGalleryIds Si remove est true, spécifie de quelles galeries retirer les images.
 */
export async function addMultipleImagesToGalleries(
    firestore: Firestore, 
    userId: string, 
    imageIds: string[], 
    galleryIds: string[],
    remove: boolean = false,
    fromGalleryIds: string[] = []
): Promise<void> {
    if (imageIds.length === 0 || (galleryIds.length === 0 && !remove)) return;

    const batch = writeBatch(firestore);
    
    if (remove) {
        fromGalleryIds.forEach(galleryId => {
            const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
            batch.update(galleryDocRef, {
                imageIds: arrayRemove(...imageIds)
            });
        });
    } else {
        galleryIds.forEach(galleryId => {
            const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
            batch.update(galleryDocRef, {
                imageIds: arrayUnion(...imageIds)
            });
        });
    }

    try {
        await batch.commit();
    } catch (error) {
        console.error("Erreur lors de l'opération en batch sur les galeries :", error);
        throw new Error("Impossible de mettre à jour les galeries.");
    }
}

/**
 * Sauvegarde un prompt personnalisé pour l'utilisateur.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param prompt L'objet prompt à sauvegarder.
 */
export async function saveCustomPrompt(firestore: Firestore, userId: string, prompt: CustomPrompt): Promise<void> {
    if (!prompt.name.trim() || !prompt.value.trim()) {
        throw new Error("Le nom et la valeur du prompt ne peuvent pas être vides.");
    }
    const userDocRef = doc(firestore, 'users', userId);
    
    try {
        await updateDoc(userDocRef, {
            customPrompts: arrayUnion(prompt)
        });
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { customPromptToAdd: prompt },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

/**
 * Supprime un prompt personnalisé de la liste de l'utilisateur.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param promptToDelete L'objet prompt complet à supprimer.
 */
export async function deleteCustomPrompt(firestore: Firestore, userId: string, promptToDelete: CustomPrompt): Promise<void> {
    const userDocRef = doc(firestore, 'users', userId);

    try {
        await updateDoc(userDocRef, {
            customPrompts: arrayRemove(promptToDelete)
        });
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { customPromptToRemove: promptToDelete },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

/**
 * Met à jour le nom d'un prompt personnalisé existant.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param updatedPrompt Le prompt avec son nouveau nom.
 */
export async function updateCustomPrompt(firestore: Firestore, userId: string, updatedPrompt: CustomPrompt): Promise<void> {
    const userDocRef = doc(firestore, 'users', userId);
    
    try {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            throw new Error("Utilisateur non trouvé.");
        }
        
        const userData = userDoc.data() as UserProfile;
        const prompts = userData.customPrompts || [];
        
        const promptIndex = prompts.findIndex(p => p.id === updatedPrompt.id);
        
        if (promptIndex === -1) {
            throw new Error("Prompt non trouvé.");
        }
        
        // Créer une nouvelle liste avec le prompt mis à jour
        const newPrompts = [...prompts];
        newPrompts[promptIndex] = updatedPrompt;

        // Remplacer l'ancienne liste par la nouvelle
        await updateDoc(userDocRef, {
            customPrompts: newPrompts
        });

    } catch (error) {
         const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { customPromptToUpdate: updatedPrompt },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}
    

    
