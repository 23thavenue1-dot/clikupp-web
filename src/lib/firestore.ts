

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
  pinnedImageIds?: string[];
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
  pinnedImageIds?: string[];
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
 * Supprime plusieurs images de Firestore et de Storage.
 * @param firestore Instance de Firestore.
 * @param storage Instance de Storage.
 * @param userId ID de l'utilisateur.
 * @param imageIds Tableau d'IDs des images à supprimer.
 */
export async function deleteMultipleImages(firestore: Firestore, storage: Storage, userId: string, imageIds: string[]): Promise<void> {
    const batch = writeBatch(firestore);
    const imageRefsToDelete: DocumentReference[] = [];

    // Étape 1 : Récupérer les chemins de stockage et préparer la suppression Firestore
    for (const imageId of imageIds) {
        const imageDocRef = doc(firestore, `users/${userId}/images`, imageId);
        imageRefsToDelete.push(imageDocRef);
        batch.delete(imageDocRef);
    }
    
    const imageDocs = await Promise.all(imageRefsToDelete.map(ref => getDoc(ref)));

    // Étape 2 : Supprimer les fichiers de Storage
    const storageDeletePromises = imageDocs
        .map(docSnap => docSnap.data() as ImageMetadata)
        .filter(data => data && data.storagePath)
        .map(data => {
            const storageRef = ref(storage, data.storagePath);
            return deleteObject(storageRef).catch(error => {
                // Log l'erreur mais ne bloque pas la suppression des autres fichiers
                console.warn(`Impossible de supprimer le fichier de Storage: ${data.storagePath}`, error);
            });
        });

    await Promise.all(storageDeletePromises);

    // Étape 3 : Exécuter la suppression en batch sur Firestore
    await batch.commit();

    // Étape 4 (Optionnel mais recommandé) : Retirer les IDs des images de toutes les galeries
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

    await galleryUpdateBatch.commit();
}


/**
 * Sauvegarde une nouvelle note pour l'utilisateur dans Firestore.
 * @param firestore L'instance Firestore.
 * @param user L'objet utilisateur authentifié.
 * @param text Le contenu de la note.
 */
export async function saveNote(firestore: Firestore, user: User, text: string): Promise<void> {
  const notesCollectionRef = collection(firestore, 'users', user.uid, 'notes');
  
  const dataToSave = {
    userId: user.uid,
    text: text,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(notesCollectionRef, dataToSave);
    await updateDoc(docRef, { id: docRef.id });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de la note :", error);
    const permissionError = new FirestorePermissionError({
      path: notesCollectionRef.path,
      operation: 'create',
      requestResourceData: dataToSave,
    });

    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
}

/**
 * Met à jour le contenu d'une note existante.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param noteId L'ID de la note à mettre à jour.
 * @param newText Le nouveau texte de la note.
 */
export async function updateNote(firestore: Firestore, userId: string, noteId: string, newText: string): Promise<void> {
    const noteDocRef = doc(firestore, 'users', userId, 'notes', noteId);
    const dataToUpdate = { text: newText };
    try {
        await updateDoc(noteDocRef, dataToUpdate);
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la note :", error);
        const permissionError = new FirestorePermissionError({
            path: noteDocRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

/**
 * Supprime une note.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param noteId L'ID de la note à supprimer.
 */
export async function deleteNote(firestore: Firestore, userId: string, noteId: string): Promise<void> {
    const noteDocRef = doc(firestore, 'users', userId, 'notes', noteId);
    try {
        await deleteDoc(noteDocRef);
    } catch (error) {
        console.error("Erreur lors de la suppression de la note :", error);
        const permissionError = new FirestorePermissionError({
            path: noteDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
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
 * @param userId L'ID de l'utilisateur.
 * @param name Le nom de la galerie.
 * @param description (Optionnel) La description de la galerie.
 */
export async function createGallery(firestore: Firestore, userId: string, name: string, description: string = ''): Promise<DocumentReference> {
    const galleriesCollectionRef = collection(firestore, 'users', userId, 'galleries');
    
    const dataToSave = {
        userId: userId,
        name,
        description,
        imageIds: [],
        pinnedImageIds: [],
        createdAt: serverTimestamp(),
    };

    try {
        const docRef = await addDoc(galleriesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
        return docRef;
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

/**
 * Ajoute une image à une galerie.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageId L'ID de l'image à ajouter.
 * @param galleryId L'ID de la galerie.
 */
export async function addImageToGallery(firestore: Firestore, userId: string, imageId: string, galleryId: string): Promise<void> {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    try {
        await updateDoc(galleryDocRef, { imageIds: arrayUnion(imageId) });
    } catch (error) {
        console.error("Erreur lors de l'ajout de l'image à la galerie:", error);
        throw error;
    }
}

/**
 * Épingle ou désépingle une image dans une galerie.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param galleryId L'ID de la galerie.
 * @param imageId L'ID de l'image.
 * @param pin `true` pour épingler, `false` pour désépingler.
 */
export async function toggleImagePinInGallery(firestore: Firestore, userId: string, galleryId: string, imageId: string, pin: boolean): Promise<void> {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    try {
        await updateDoc(galleryDocRef, {
            pinnedImageIds: pin ? arrayUnion(imageId) : arrayRemove(imageId)
        });
    } catch (error) {
        console.error(`Erreur lors de ${pin ? "l'épinglage" : "du désépinglage"} de l'image:`, error);
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'update',
            requestResourceData: { imageIdToToggle: imageId },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
}

/**
 * Épingle ou désépingle une image globalement pour un utilisateur.
 * @param firestore L'instance Firestore.
 * @param userId L'ID de l'utilisateur.
 * @param imageId L'ID de l'image.
 * @param pin `true` pour épingler, `false` pour désépingler.
 */
export async function toggleGlobalImagePin(firestore: Firestore, userId: string, imageId: string, pin: boolean): Promise<void> {
    const userDocRef = doc(firestore, 'users', userId);
    try {
        await updateDoc(userDocRef, {
            pinnedImageIds: pin ? arrayUnion(imageId) : arrayRemove(imageId)
        });
    } catch (error) {
        console.error(`Erreur lors de ${pin ? "l'épinglage" : "du désépinglage"} de l'image globale:`, error);
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { imageIdToToggle: imageId },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
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
export async function removeImagesFromGallery(firestore: Firestore, userId: string, galleryId: string, imageIds: string[]): Promise<void> {
    const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
    try {
        await updateDoc(galleryDocRef, {
            imageIds: arrayRemove(...imageIds),
            pinnedImageIds: arrayRemove(...imageIds) // Also remove from pinned
        });
    } catch (error) {
        console.error("Erreur lors du retrait des images de la galerie :", error);
        const permissionError = new FirestorePermissionError({
            path: galleryDocRef.path,
            operation: 'update',
            requestResourceData: { imageIdsToRemove: imageIds },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw error;
    }
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
    

    
