

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
import { getStorage, ref, listAll, deleteObject, Storage, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User } from 'firebase/auth';
import { isBefore, startOfDay, startOfMonth, format } from 'date-fns';
import { withErrorHandling } from '@/lib/async-wrapper';


export interface CustomPrompt {
  id: string;
  name: string;
  value: string;
}

// NOUVEAU: Type pour les liens sociaux
export interface SocialLink {
  id: string;
  name: string;
  url: string;
  icon?: string; // Optionnel, pour les icônes prédéfinies
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
  socialLinks?: SocialLink[]; // MODIFIÉ
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
  subscriptionTier: 'none' | 'creator' | 'pro' | 'master' | 'storage_250' | 'storage_500' | 'storage_1000';
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

// NOUVEAU: Entité pour les profils de marque
export interface BrandProfile {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  createdAt: Timestamp;
  socialLinks?: SocialLink[]; // MODIFIÉ
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

// Nouveau type pour les posts programmés/brouillons
export type ScheduledPost = {
    id: string;
    userId: string;
    brandProfileId: string;
    auditId?: string | null;
    status: 'draft' | 'scheduled';
    createdAt: Timestamp;
    scheduledAt: Timestamp | null;
    title: string;
    description: string;
    imageStoragePath: string;
    imageId: string; // Ajout de l'ID de l'image source
};


const DAILY_UPLOAD_TICKETS = 5;
const DAILY_AI_TICKETS = 3;
const MONTHLY_AI_TICKET_LIMIT = 20;

export async function checkAndRefillTickets(firestore: Firestore, userDocRef: DocumentReference, userProfile: UserProfile): Promise<void> {
  const updates: { [key: string]: any } = {};
  const now = new Date();
  let currentMonthlyAiCount = userProfile.aiTicketMonthlyCount ?? 0;

  const lastMonthlyReset = userProfile.aiTicketMonthlyReset ? userProfile.aiTicketMonthlyReset.toDate() : new Date(0);
  if (isBefore(startOfMonth(lastMonthlyReset), startOfMonth(now))) {
    updates.aiTicketMonthlyCount = 0;
    updates.aiTicketMonthlyReset = serverTimestamp();
    currentMonthlyAiCount = 0;
  }

  const lastUploadRefill = userProfile.lastTicketRefill ? userProfile.lastTicketRefill.toDate() : new Date(0);
  if (isBefore(startOfDay(lastUploadRefill), startOfDay(now))) {
    updates.ticketCount = DAILY_UPLOAD_TICKETS;
    updates.lastTicketRefill = serverTimestamp();
  }

  const lastAiRefill = userProfile.lastAiTicketRefill ? userProfile.lastAiTicketRefill.toDate() : new Date(0);
  if (isBefore(startOfDay(lastAiRefill), startOfDay(now))) {
    if (currentMonthlyAiCount < MONTHLY_AI_TICKET_LIMIT) {
      const ticketsToGrant = Math.min(DAILY_AI_TICKETS, MONTHLY_AI_TICKET_LIMIT - currentMonthlyAiCount);
      updates.aiTicketCount = ticketsToGrant;
      if (ticketsToGrant > 0) {
        updates.aiTicketMonthlyCount = increment(ticketsToGrant);
      }
    } else {
      updates.aiTicketCount = 0;
    }
    updates.lastAiTicketRefill = serverTimestamp();
  }

  if (Object.keys(updates).length > 0) {
    await withErrorHandling(() => updateDoc(userDocRef, updates), {
      operation: 'checkAndRefillTickets',
      userId: userProfile.id,
      path: userDocRef.path
    });
  }
}

export async function saveImageMetadata(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount'>): Promise<DocumentReference> {
  const { data: docRef, error } = await withErrorHandling(async () => {
    const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');
    const userDocRef = doc(firestore, 'users', user.uid);
    const dataToSave = { ...metadata, userId: user.uid, uploadTimestamp: serverTimestamp(), likeCount: 0 };
    const newDocRef = await addDoc(imagesCollectionRef, dataToSave);
    await Promise.all([
      updateDoc(newDocRef, { id: newDocRef.id }),
      updateDoc(userDocRef, { storageUsed: increment(metadata.fileSize || 0) })
    ]);
    return newDocRef;
  }, { operation: 'saveImageMetadata', userId: user.uid });
  if (error || !docRef) throw error || new Error("Failed to save image metadata");
  return docRef;
}

export async function decrementTicketCount(firestore: Firestore, userId: string, profile: UserProfile): Promise<void> {
  const userDocRef = doc(firestore, 'users', userId);
  const updates: { [key: string]: any } = {};

  if (profile.subscriptionTier === 'pro' || profile.subscriptionTier === 'master') return;

  if (profile.ticketCount > 0) updates.ticketCount = increment(-1);
  else if (profile.subscriptionUploadTickets > 0) updates.subscriptionUploadTickets = increment(-1);
  else if (profile.packUploadTickets > 0) updates.packUploadTickets = increment(-1);
  else { console.error("No upload tickets to decrement."); return; }
  
  const { error } = await withErrorHandling(() => updateDoc(userDocRef, updates), {
      operation: 'decrementTicketCount', userId, path: userDocRef.path
  });
  if (error) throw error;
}

export async function decrementAiTicketCount(firestore: Firestore, userId: string, profile: UserProfile, type: 'edit' | 'description'): Promise<void> {
  const userDocRef = doc(firestore, 'users', userId);
  const updates: { [key: string]: any } = {};

  if (profile.aiTicketCount > 0) updates.aiTicketCount = increment(-1);
  else if (profile.subscriptionAiTickets > 0) updates.subscriptionAiTickets = increment(-1);
  else if (profile.packAiTickets > 0) updates.packAiTickets = increment(-1);
  else { console.error("No AI tickets to decrement."); return; }

  if (type === 'edit') updates.totalImageEdits = increment(1);
  else if (type === 'description') updates.totalDescriptionGenerations = increment(1);

  const { error } = await withErrorHandling(() => updateDoc(userDocRef, updates), {
      operation: 'decrementAiTicketCount', userId, path: userDocRef.path
  });
  if (error) throw error;
}

export async function saveImageFromUrl(firestore: Firestore, user: User, metadata: Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount' | 'originalName' | 'storagePath' | 'mimeType' | 'fileSize'>): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const imagesCollectionRef = collection(firestore, 'users', user.uid, 'images');
        const dataToSave = { ...metadata, userId: user.uid, uploadTimestamp: serverTimestamp(), likeCount: 0, originalName: new URL(metadata.directUrl).pathname.split('/').pop() || 'image-from-url', fileSize: 0 };
        const docRef = await addDoc(imagesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
    }, { operation: 'saveImageFromUrl', userId: user.uid });
    if (error) throw error;
}

export async function deleteImageMetadata(firestore: Firestore, userId: string, imageId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const batch = writeBatch(firestore);
        const imageDocRef = doc(firestore, 'users', userId, 'images', imageId);
        const userDocRef = doc(firestore, 'users', userId);

        const imageDoc = await getDoc(imageDocRef);
        if (!imageDoc.exists()) return;

        const imageData = imageDoc.data() as ImageMetadata;
        const fileSize = imageData.fileSize || 0;
        
        // Delete image document
        batch.delete(imageDocRef);

        // Decrement storage used
        if (fileSize > 0) {
            batch.update(userDocRef, { storageUsed: increment(-fileSize) });
        }

        // Find and delete associated scheduled posts
        const postsQuery = query(collection(firestore, 'users', userId, 'scheduledPosts'), where('imageId', '==', imageId));
        const postsSnapshot = await getDocs(postsQuery);
        postsSnapshot.forEach(postDoc => {
            batch.delete(postDoc.ref);
        });

        await batch.commit();
    }, { operation: 'deleteImageMetadata', userId, path: `users/${userId}/images/${imageId}` });
    if (error) throw error;
}

export async function deleteMultipleImages(firestore: Firestore, storage: Storage, userId: string, imageIds: string[]): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const batch = writeBatch(firestore);
        let totalSizeFreed = 0;

        // Prepare to delete image documents and files from Storage
        const imageRefsToDelete = imageIds.map(id => doc(firestore, `users/${userId}/images`, id));
        const imageDocs = await Promise.all(imageRefsToDelete.map(ref => getDoc(ref)));
        const storageDeletePromises = imageDocs.map(docSnap => {
            const data = docSnap.data() as ImageMetadata;
            if (data) {
                totalSizeFreed += (data.fileSize || 0);
                batch.delete(docSnap.ref);
                if (data.storagePath) {
                    return deleteObject(ref(storage, data.storagePath)).catch(err => console.warn(`Failed to delete from Storage: ${data.storagePath}`, err));
                }
            }
            return Promise.resolve();
        });

        // Decrement storage used
        if (totalSizeFreed > 0) {
            batch.update(doc(firestore, 'users', userId), { storageUsed: increment(-totalSizeFreed) });
        }

        // Find and delete associated scheduled posts
        if (imageIds.length > 0) {
            const postsQuery = query(collection(firestore, 'users', userId, 'scheduledPosts'), where('imageId', 'in', imageIds));
            const postsSnapshot = await getDocs(postsQuery);
            postsSnapshot.forEach(postDoc => {
                batch.delete(postDoc.ref);
            });
        }
        
        // Find and remove images from galleries
        const galleriesQuery = query(collection(firestore, 'users', userId, 'galleries'));
        const galleriesSnapshot = await getDocs(galleriesQuery);
        galleriesSnapshot.forEach(galleryDoc => {
            const galleryData = galleryDoc.data() as Gallery;
            if (galleryData.imageIds.some(id => imageIds.includes(id))) {
                batch.update(galleryDoc.ref, { 
                    imageIds: arrayRemove(...imageIds),
                    pinnedImageIds: arrayRemove(...imageIds)
                });
            }
        });

        // Execute all operations
        await Promise.all(storageDeletePromises);
        await batch.commit();

    }, { operation: 'deleteMultipleImages', userId });
    if (error) throw error;
}

export async function saveNote(firestore: Firestore, user: User, text: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const notesCollectionRef = collection(firestore, 'users', user.uid, 'notes');
        const dataToSave = { userId: user.uid, text: text, completed: false, createdAt: serverTimestamp() };
        const docRef = await addDoc(notesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
    }, { operation: 'saveNote', userId: user.uid });
    if (error) throw error;
}

export async function updateNote(firestore: Firestore, userId: string, noteId: string, newText: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await updateDoc(doc(firestore, 'users', userId, 'notes', noteId), { text: newText });
    }, { operation: 'updateNote', userId, path: `users/${userId}/notes/${noteId}` });
    if (error) throw error;
}

export async function deleteNote(firestore: Firestore, userId: string, noteId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await deleteDoc(doc(firestore, 'users', userId, 'notes', noteId));
    }, { operation: 'deleteNote', userId, path: `users/${userId}/notes/${noteId}` });
    if (error) throw error;
}

export async function toggleNoteCompletion(firestore: Firestore, userId: string, noteId: string, completed: boolean): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await updateDoc(doc(firestore, 'users', userId, 'notes', noteId), { completed });
    }, { operation: 'toggleNoteCompletion', userId, path: `users/${userId}/notes/${noteId}` });
    if (error) throw error;
}

export async function deleteUserAccount(firestore: Firestore, storage: Storage, userId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const subcollections = ['images', 'notes', 'galleries', 'audits', 'brandProfiles', 'scheduledPosts'];
        for (const sub of subcollections) {
            const snapshot = await getDocs(collection(firestore, 'users', userId, sub));
            const batch = writeBatch(firestore);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        await deleteDoc(doc(firestore, 'users', userId));
        const deleteFolderContents = async (folderPath: string) => {
            try {
                const listResult = await listAll(ref(storage, folderPath));
                await Promise.all(listResult.items.map(itemRef => deleteObject(itemRef)));
            } catch (err) { console.warn(`Could not list/delete folder ${folderPath}`, err); }
        };
        await Promise.all([
            deleteFolderContents(`users/${userId}`), 
            deleteFolderContents(`avatars/${userId}`),
            deleteFolderContents(`scheduledPosts/${userId}`)
        ]);
    }, { operation: 'deleteUserAccount', userId });
    if (error) throw error;
}

export async function updateImageDescription(firestore: Firestore, userId: string, imageId: string, data: { title: string; description: string; hashtags: string; }, generatedByAI: boolean): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const dataToUpdate: any = { ...data };
        if (generatedByAI) dataToUpdate.generatedByAI = true;
        await updateDoc(doc(firestore, 'users', userId, 'images', imageId), dataToUpdate);
    }, { operation: 'updateImageDescription', userId, path: `users/${userId}/images/${imageId}` });
    if (error) throw error;
}

export async function createGallery(firestore: Firestore, userId: string, name: string, description: string = ''): Promise<DocumentReference> {
    const { data, error } = await withErrorHandling(async () => {
        const galleriesCollectionRef = collection(firestore, 'users', userId, 'galleries');
        const dataToSave = { userId, name, description, imageIds: [], pinnedImageIds: [], createdAt: serverTimestamp() };
        const docRef = await addDoc(galleriesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
        return docRef;
    }, { operation: 'createGallery', userId });
    if (error || !data) throw error || new Error('Gallery creation failed');
    return data;
}

export async function deleteGallery(firestore: Firestore, userId: string, galleryId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await deleteDoc(doc(firestore, 'users', userId, 'galleries', galleryId));
    }, { operation: 'deleteGallery', userId, path: `users/${userId}/galleries/${galleryId}` });
    if (error) throw error;
}

export async function addImageToGallery(firestore: Firestore, userId: string, imageId: string, galleryId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await updateDoc(doc(firestore, 'users', userId, 'galleries', galleryId), { imageIds: arrayUnion(imageId) });
    }, { operation: 'addImageToGallery', userId, path: `users/${userId}/galleries/${galleryId}` });
    if (error) throw error;
}

export async function toggleImagePinInGallery(firestore: Firestore, userId: string, galleryId: string, imageId: string, pin: boolean): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const updateData = { pinnedImageIds: pin ? arrayUnion(imageId) : arrayRemove(imageId) };
        await updateDoc(doc(firestore, 'users', userId, 'galleries', galleryId), updateData);
    }, { operation: 'toggleImagePinInGallery', userId, path: `users/${userId}/galleries/${galleryId}` });
    if (error) throw error;
}

export async function toggleGlobalImagePin(firestore: Firestore, userId: string, imageId: string, pin: boolean): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const updateData = { pinnedImageIds: pin ? arrayUnion(imageId) : arrayRemove(imageId) };
        await updateDoc(doc(firestore, 'users', userId), updateData);
    }, { operation: 'toggleGlobalImagePin', userId, path: `users/${userId}` });
    if (error) throw error;
}

export async function getImagesForGallery(firestore: Firestore, userId: string, imageIds: string[]): Promise<ImageMetadata[]> {
    const { data, error } = await withErrorHandling(async () => {
        if (imageIds.length === 0) return [];
        const q = query(collection(firestore, `users/${userId}/images`), where('id', 'in', imageIds));
        const querySnapshot = await getDocs(q);
        const images = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id } as ImageMetadata));
        const imageMap = new Map(images.map(img => [img.id, img]));
        return imageIds.map(id => imageMap.get(id)).filter(Boolean) as ImageMetadata[];
    }, { operation: 'getImagesForGallery', userId });
    if (error || !data) throw error || new Error('Failed to get images');
    return data;
}

export async function removeImagesFromGallery(firestore: Firestore, userId: string, galleryId: string, imageIds: string[]): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const updateData = { imageIds: arrayRemove(...imageIds), pinnedImageIds: arrayRemove(...imageIds) };
        await updateDoc(doc(firestore, 'users', userId, 'galleries', galleryId), updateData);
    }, { operation: 'removeImagesFromGallery', userId, path: `users/${userId}/galleries/${galleryId}` });
    if (error) throw error;
}

export async function addMultipleImagesToGalleries(firestore: Firestore, userId: string, imageIds: string[], galleryIds: string[], remove: boolean = false, fromGalleryIds: string[] = []): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        if (imageIds.length === 0) return;
        const batch = writeBatch(firestore);
        const targetGalleryIds = remove ? fromGalleryIds : galleryIds;
        targetGalleryIds.forEach(galleryId => {
            const galleryDocRef = doc(firestore, 'users', userId, 'galleries', galleryId);
            batch.update(galleryDocRef, { imageIds: remove ? arrayRemove(...imageIds) : arrayUnion(...imageIds) });
        });
        await batch.commit();
    }, { operation: 'addMultipleImagesToGalleries', userId });
    if (error) throw error;
}

export async function saveCustomPrompt(firestore: Firestore, userId: string, prompt: CustomPrompt): Promise<void> {
    if (!prompt.name.trim() || !prompt.value.trim()) throw new Error("Prompt name and value cannot be empty.");
    const { error } = await withErrorHandling(async () => {
        await updateDoc(doc(firestore, 'users', userId), { customPrompts: arrayUnion(prompt) });
    }, { operation: 'saveCustomPrompt', userId, path: `users/${userId}` });
    if (error) throw error;
}

export async function deleteCustomPrompt(firestore: Firestore, userId: string, promptToDelete: CustomPrompt): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await updateDoc(doc(firestore, 'users', userId), { customPrompts: arrayRemove(promptToDelete) });
    }, { operation: 'deleteCustomPrompt', userId, path: `users/${userId}` });
    if (error) throw error;
}

export async function updateCustomPrompt(firestore: Firestore, userId: string, updatedPrompt: CustomPrompt): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const userDocRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) throw new Error("User not found.");
        const prompts = (userDoc.data() as UserProfile).customPrompts || [];
        const promptIndex = prompts.findIndex(p => p.id === updatedPrompt.id);
        if (promptIndex === -1) throw new Error("Prompt not found.");
        const newPrompts = [...prompts];
        newPrompts[promptIndex] = updatedPrompt;
        await updateDoc(userDocRef, { customPrompts: newPrompts });
    }, { operation: 'updateCustomPrompt', userId, path: `users/${userId}` });
    if (error) throw error;
}

export async function createBrandProfile(firestore: Firestore, userId: string, name: string, avatarUrl: string = ''): Promise<DocumentReference> {
    const { data, error } = await withErrorHandling(async () => {
        const brandProfilesCollectionRef = collection(firestore, 'users', userId, 'brandProfiles');
        const dataToSave = { userId, name, avatarUrl, createdAt: serverTimestamp(), socialLinks: [] };
        const docRef = await addDoc(brandProfilesCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });
        return docRef;
    }, { operation: 'createBrandProfile', userId });
    if (error || !data) throw error || new Error('Brand profile creation failed');
    return data;
}

export async function updateBrandProfile(firestore: Firestore, userId: string, profileId: string, updates: Partial<Pick<BrandProfile, 'name' | 'avatarUrl' | 'socialLinks'>>): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await updateDoc(doc(firestore, `users/${userId}/brandProfiles/${profileId}`), updates);
    }, { operation: 'updateBrandProfile', userId, path: `users/${userId}/brandProfiles/${profileId}` });
    if (error) throw error;
}

export async function deleteBrandProfile(firestore: Firestore, userId: string, profileId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const batch = writeBatch(firestore);
        const auditsQuery = query(collection(firestore, 'users', userId, 'audits'), where('brandProfileId', '==', profileId));
        const auditsSnapshot = await getDocs(auditsQuery);
        auditsSnapshot.forEach(auditDoc => batch.delete(auditDoc.ref));
        batch.delete(doc(firestore, `users/${userId}/brandProfiles/${profileId}`));
        await batch.commit();
    }, { operation: 'deleteBrandProfile', userId });
    if (error) throw error;
}

export async function deleteAudit(firestore: Firestore, userId: string, auditId: string): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        await deleteDoc(doc(firestore, `users/${userId}/audits/${auditId}`));
    }, { operation: 'deleteAudit', userId, path: `users/${userId}/audits/${auditId}` });
    if (error) throw error;
}

type SavePostOptions = {
    title?: string;
    description: string;
    scheduledAt?: Date;
    imageSource: Blob | ImageMetadata;
    brandProfileId: string;
    auditId?: string;
};

export async function savePostForLater(
    firestore: Firestore,
    storage: Storage,
    userId: string,
    options: SavePostOptions
): Promise<void> {
    const { imageSource, title, description, scheduledAt, brandProfileId, auditId } = options;

    const { error } = await withErrorHandling(async () => {
        let imageStoragePath: string;
        let imageId: string; // Ajout pour stocker l'ID de l'image

        if (imageSource instanceof Blob) {
            imageStoragePath = `scheduledPosts/${userId}/${Date.now()}.png`;
            const storageRef = ref(storage, imageStoragePath);
            await uploadBytes(storageRef, imageSource);
            // Si c'est un nouveau blob, on doit créer une nouvelle entrée ImageMetadata
            // pour obtenir un ID, mais cela complexifie. Pour l'instant, on met un ID temporaire.
            // IDÉALEMENT: on créerait d'abord l'ImageMetadata, puis le ScheduledPost.
            // Pour simplifier, on va considérer que les Blob sont pour des images non encore dans la bibliothèque.
            imageId = `blob_${Date.now()}`; // Non idéal, mais fonctionne pour le moment.
        } 
        else if (imageSource.storagePath && imageSource.id) {
            imageStoragePath = imageSource.storagePath;
            imageId = imageSource.id; // On utilise l'ID existant
        } 
        else {
            throw new Error("La source de l'image est invalide (ni Blob, ni métadonnée avec un chemin de stockage et un ID).");
        }

        const postsCollectionRef = collection(firestore, 'users', userId, 'scheduledPosts');
        const dataToSave: Omit<ScheduledPost, 'id'> = {
            userId,
            brandProfileId,
            status: scheduledAt ? 'scheduled' : 'draft',
            createdAt: serverTimestamp() as Timestamp,
            scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
            title: title || (scheduledAt ? `Post du ${format(scheduledAt, 'd MMM')}`: 'Brouillon'),
            description: description,
            imageStoragePath,
            imageId: imageId, // On sauvegarde l'ID
            auditId: auditId || null,
        };
        
        const docRef = await addDoc(postsCollectionRef, dataToSave);
        await updateDoc(docRef, { id: docRef.id });

    }, { 
        operation: 'savePostForLater', 
        userId, 
        requestResourceData: { title, description, scheduledAt, auditId, brandProfileId, imageSourceType: imageSource instanceof Blob ? 'Blob' : 'Metadata' }
    });

    if (error) {
        throw error;
    }
}


export async function deleteScheduledPost(firestore: Firestore, storage: Storage, userId: string, post: ScheduledPost): Promise<void> {
    const { error } = await withErrorHandling(async () => {
        const postDocRef = doc(firestore, 'users', userId, 'scheduledPosts', post.id);
        
        // On ne supprime plus l'image de Storage ici pour éviter les suppressions accidentelles
        // d'images partagées. La suppression de fichier doit être gérée uniquement
        // lors de la suppression de l'ImageMetadata principale.
        await deleteDoc(postDocRef);

    }, {
        operation: 'deleteScheduledPost',
        userId,
        path: `users/${userId}/scheduledPosts/${post.id}`
    });
    if (error) throw error;
}

