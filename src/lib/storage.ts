'use client';

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';
import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { getIdToken } from 'firebase/auth';

// -----------------------------
// Config côté client (guards)
// -----------------------------
export const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
export const ALLOWED_MIME = /^(image\/.*)$/i;
const NAME_EXT_FALLBACK = /\.(png|jpe?g|gif|webp|avif|heic|heif|svg)$/i;


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
  const fe = e as FirebaseError & { serverResponse?: string };
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
        console.group('[Storage Error Details]');
        console.error('Full Firebase Error:', fe);
        console.error('Error Code:', fe?.code);
        console.error('Error Message:', fe?.message);
        console.error('Server Response:', fe?.serverResponse);
        console.groupEnd();
        return fe?.message || 'Une erreur inconnue est survenue lors de l’opération de stockage.';
  }
};

const inferImageMimeFromName = (name: string): string | null => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return null;
  }
};


// -----------------------------
// Upload (avec uploadBytesResumable)
// -----------------------------
export function uploadImage(
  storage: FirebaseStorage,
  user: User,
  file: File,
  customName: string,
  onProgress: (progress: number) => void,
  onComplete: (downloadURL: string, storagePath: string) => void,
  onError: (error: Error) => void
): void {
  
  if (!user?.uid) {
    const error = new Error('Utilisateur non authentifié.');
    onError(error);
    return;
  }
   if (!file) {
    const error = new Error('Aucun fichier fourni.');
    onError(error);
    return;
  }

  if (file.size > MAX_BYTES) {
    const error = new Error('Fichier trop volumineux (> 10 Mo).');
    onError(error);
    return;
  }
  if (!(ALLOWED_MIME.test(file.type) || NAME_EXT_FALLBACK.test(file.name))) {
    const error = new Error('Type de fichier non autorisé (images uniquement).');
    onError(error);
    return;
  }

  const safeCustom = (customName || '').trim();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const baseName = safeCustom
    ? sanitize(safeCustom)
    : sanitize(file.name.replace(/\.[^/.]+$/, '') || 'image');
  const fileName = `${baseName || 'image'}-${Date.now()}.${ext}`;

  const finalStoragePath = buildStoragePath(user.uid, fileName);
  const ref = storageRef(storage, finalStoragePath);

  const guessedMime = inferImageMimeFromName(file.name);
  const finalContentType =
    (file.type && /^image\/.+/i.test(file.type) ? file.type : null) ||
    guessedMime ||
    'image/jpeg'; // Fallback

  // Forcer le rafraîchissement du token avant de démarrer l'upload
  getIdToken(user, true).then(() => {
    const task = uploadBytesResumable(ref, file, {
        contentType: finalContentType,
        customMetadata: { uid: user.uid },
    });

    task.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
        },
        (error) => {
            // Gérer toutes les erreurs ici
            console.group('[Storage Upload Error]');
            console.log('code:', error.code);
            console.log('message:', error.message);
            console.log('name:', error.name);
            console.log('serverResponse:', (error as any).serverResponse);
            console.log('>> debug contentType used:', finalContentType);
            console.log('>> file.type seen by browser:', file.type);
            console.log('>> path:', ref.fullPath, 'bucket:', ref.storage.bucket);
            console.groupEnd();
            onError(new Error(friendlyStorageError(error)));
        },
        () => {
            getDownloadURL(task.snapshot.ref).then((url) => {
                onComplete(url, finalStoragePath);
            });
        }
    );

  }).catch((tokenError) => {
    console.error('Failed to refresh auth token:', tokenError);
    onError(new Error('Impossible de rafraîchir le token d\'authentification.'));
  });
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
