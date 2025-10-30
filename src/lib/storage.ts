
'use client';

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import type { User } from 'firebase/auth';

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
  `uploads/${uid}/${sanitize(fileName)}`;


/**
 * Converts a File object to a Base64-encoded Data URL.
 * This is a workaround for development environments where the Storage SDK might be blocked.
 * @param file The file to convert.
 * @returns A promise that resolves with the Data URL string.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Perform checks before reading the file
    if (file.size > MAX_BYTES) {
      return reject(new Error('Fichier trop volumineux (> 10 Mo).'));
    }
    if (!ALLOWED_MIME.test(file.type) && !NAME_EXT_FALLBACK.test(file.name)) {
      return reject(new Error('Type de fichier non autorisé (images uniquement).'));
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

// -----------------------------
// NOUVELLE FONCTION POUR L'UPLOAD VIA STORAGE (TEST)
// -----------------------------

type UploadParams = {
  storage: FirebaseStorage;
  file: File;
  user: User;
  customName?: string;
  onProgress: (progress: number) => void;
};

type UploadResult = {
  originalName: string;
  storagePath: string;
  directUrl: string;
  bbCode: string;
  htmlCode: string;
  mimeType: string;
  fileSize: number;
};

export function uploadFileAndGetMetadata({ storage, file, user, customName, onProgress }: UploadParams): Promise<UploadResult> {
    
    // 1. Contrôles de sécurité côté client
    if (file.size > MAX_BYTES) {
        return Promise.reject(new Error(`Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo).`));
    }
    if (!ALLOWED_MIME.test(file.type) && !NAME_EXT_FALLBACK.test(file.name)) {
        return Promise.reject(new Error('Type de fichier non autorisé (images uniquement).'));
    }

    // 2. Construire le chemin
    const finalFileName = customName ? sanitize(customName) : sanitize(file.name);
    const path = buildStoragePath(user.uid, finalFileName);
    const fileRef = storageRef(storage, path);
    console.log(`Tentative d'upload vers: ${path}`);
    console.log(`Bucket de destination: ${fileRef.bucket}`);


    return new Promise((resolve, reject) => {
        // 3. Démarrer le téléversement
        const uploadTask = uploadBytesResumable(fileRef, file, { contentType: file.type });

        // 4. Écouter les événements
        uploadTask.on(
            'state_changed',
            (snapshot: UploadTaskSnapshot) => {
                // Progression
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress(progress);
            },
            (error) => {
                // Erreur
                console.error("Erreur détaillée de l'upload:", error);
                console.error(`Code: ${error.code}, Message: ${error.message}, Nom: ${error.name}`);
                reject(new Error(`Permission refusée: vérifiez les règles de sécurité de Storage et l'authentification de l'utilisateur.`));
            },
            async () => {
                // Succès
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    const result: UploadResult = {
                        originalName: finalFileName,
                        storagePath: path,
                        directUrl: downloadURL,
                        bbCode: `[img]${downloadURL}[/img]`,
                        htmlCode: `<img src="${downloadURL}" alt="${finalFileName}" />`,
                        mimeType: file.type,
                        fileSize: file.size,
                    };
                    
                    resolve(result);
                } catch (e) {
                    reject(new Error("Impossible d'obtenir l'URL de téléchargement après l'upload."));
                }
            }
        );
    });
}


// -----------------------------
// Delete
// -----------------------------
export async function deleteImageFile(
  storage: FirebaseStorage,
  storagePath?: string | null
): Promise<void> {
  // Ne pas tenter de supprimer si c'est un chemin de contournement
  if (!storagePath || storagePath === 'data_url') {
      console.log("Suppression de fichier annulée : l'image est stockée en Data URL dans Firestore.");
      return;
  }
  const ref = storageRef(storage, storagePath);
  try {
    await deleteObject(ref);
  } catch (e: any) {
    if (e?.code === 'storage/object-not-found') {
      console.warn(`Fichier absent (${storagePath}), déjà supprimé ?`);
      return;
    }
    console.error(`Erreur suppression ${storagePath}:`, e);
    // Dans ce contexte, on ne relance pas l'erreur pour ne pas bloquer l'UX si seule la suppression du fichier échoue
  }
}
