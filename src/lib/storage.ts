'use client';

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
  type FirebaseStorage,
} from 'firebase/storage';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

// -----------------------------
// Config côté client (guards)
// -----------------------------
export const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
export const ALLOWED_MIME = /^(image\/.*)$/i; // On ne garde que les images pour l'instant

// Nettoie un nom de fichier
const sanitize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

// Construit un chemin qui MATCHE les règles Storage
export const buildStoragePath = (uid: string, fileName: string) =>
  `uploads/${uid}/${fileName}`;

// Mapping d’erreurs pour messages UX
const friendlyStorageError = (e: unknown) => {
  const fe = e as FirebaseError;
  switch (fe?.code) {
    case 'storage/unauthorized':
      return 'Permission refusée : vérifiez les règles de sécurité de Storage et l’authentification de l\'utilisateur.';
    case 'storage/canceled':
      return 'Le téléversement a été annulé.';
    case 'storage/retry-limit-exceeded':
      return 'Impossible d’écrire dans le stockage. Cela est souvent dû à des règles de sécurité non conformes ou à un problème de réseau.';
    case 'storage/invalid-checksum':
      return 'Le fichier semble corrompu. Le téléversement a été interrompu pour garantir l\'intégrité des données.';
    case 'storage/object-not-found':
      return 'Le fichier est introuvable dans l\'espace de stockage.';
    default:
      return fe?.message || 'Une erreur inconnue est survenue lors de l\'opération de stockage.';
  }
};

// -----------------------------
// Upload
// -----------------------------
export function uploadImage(
  storage: FirebaseStorage,
  user: User,
  file: File,
  customName: string,
  onProgress: (progress: number) => void,
  onError: (error: Error) => void,
  onComplete: (downloadURL: string, storagePath: string) => void
): UploadTask | null {
  // Guards locaux (même logique que les rules)
  if (!user?.uid) {
    onError(new Error('Utilisateur non authentifié.'));
    return null;
  }
  if (!file) {
    onError(new Error('Aucun fichier fourni.'));
    return null;
  }
  if (file.size > MAX_BYTES) {
    onError(new Error('Fichier trop volumineux (> 10 Mo).'));
    return null;
  }
  if (!ALLOWED_MIME.test(file.type)) {
    onError(new Error('Type de fichier non autorisé (images uniquement).'));
    return null;
  }

  const safeCustom = (customName || '').trim();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const baseName = safeCustom
    ? sanitize(safeCustom)
    : sanitize(file.name.replace(/\.[^/.]+$/, '') || 'image');
  const fileName = `${baseName || 'image'}-${Date.now()}.${ext}`;

  const finalStoragePath = buildStoragePath(user.uid, fileName);
  const ref = storageRef(storage, finalStoragePath);

  const task = uploadBytesResumable(ref, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: { uid: user.uid },
  });

  task.on(
    'state_changed',
    (snap) => {
      const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      onProgress(pct);
    },
    (err) => {
      console.error('Erreur upload Storage:', err);
      onError(new Error(friendlyStorageError(err)));
    },
    async () => {
      // DEBUG: Temporarily remove try/catch to see the raw error from getDownloadURL
      const url = await getDownloadURL(task.snapshot.ref);
      onComplete(url, finalStoragePath);
    }
  );

  return task;
}

// -----------------------------
// Delete
// -----------------------------
export async function deleteImageFile(
  storage: FirebaseStorage,
  storagePath?: string | null
): Promise<void> {
  if (!storagePath) return;
  const ref = storageRef(storage, storagePath);
  try {
    await deleteObject(ref);
  } catch (e: any) {
    if (e?.code === 'storage/object-not-found') {
      console.warn(`Fichier absent (${storagePath}), déjà supprimé ?`);
      return;
    }
    console.error(`Erreur suppression ${storagePath}:`, e);
    throw new Error(friendlyStorageError(e));
  }
}
