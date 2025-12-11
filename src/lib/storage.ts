'use client';

import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, type StorageReference, type UploadTask, listAll } from 'firebase/storage';
import type { User } from 'firebase/auth';
import type { ImageMetadata } from './firestore';
import { initializeFirebase } from '@/firebase';
import heic2any from './heic-converter'; // MODIFIÉ

// -----------------------------
// Config côté client (guards)
// -----------------------------
export const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
export const ALLOWED_MIME = /^(image\/.*)$/i;
const NAME_EXT_FALLBACK = /\.(png|jpe?g|gif|webp|avif|heic|heif|svg)$/i;
const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];


/**
 * Converts a HEIC/HEIF file to a JPEG File object if necessary.
 * If the file is not a HEIC/HEIF, it returns the original file.
 * @param file The file to potentially convert.
 * @returns A promise that resolves with a File object (either the original or the converted one).
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  const isHeic = HEIC_MIME_TYPES.includes(file.type.toLowerCase()) || 
                 /\.(heic|heif)$/i.test(file.name);

  if (!isHeic) {
    return file; // Pas de conversion nécessaire
  }

  try {
    // Utilisation du module chargé dynamiquement
    const conversionResult = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.8, // Qualité de conversion (0.8 = 80%)
    });

    const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpeg');
    
    return new File([blob], newFileName, {
      type: blob.type,
      lastModified: file.lastModified,
    });

  } catch (error) {
    console.error("Erreur de conversion HEIC:", error);
    // Si la conversion échoue, on retourne le fichier original
    // et on laisse le navigateur tenter de l'afficher.
    return file;
  }
}


/**
 * DEPRECATED / TEST-ONLY: Deletes a file from Firebase Storage.
 * @param storage The Firebase Storage instance.
 * @param filePath The full path to the file in the bucket (e.g., 'uploads/userId/image.jpg').
 */
export async function deleteImageFile(storagePath: string): Promise<void> {
  // Correction: Initialiser Firebase correctement pour obtenir l'instance de storage
  const { storage } = initializeFirebase();
  if (!storage) {
    throw new Error("Firebase Storage not initialized.");
  }
  const fileRef = ref(storage, storagePath);
  try {
    await deleteObject(fileRef);
  } catch (error) {
    console.error("Erreur lors de la suppression du fichier sur Storage:", error);
    // Ne pas bloquer si la suppression échoue, mais logger l'erreur.
  }
}

/**
 * Supprime un dossier et tout son contenu dans Firebase Storage.
 * @param folderPath Le chemin vers le dossier à supprimer (ex: 'users/userId').
 */
export async function deleteFolder(folderPath: string): Promise<void> {
  const { storage } = initializeFirebase();
  const folderRef = ref(storage, folderPath);
  try {
    const listResult = await listAll(folderRef);
    const deletePromises = listResult.items.map(itemRef => deleteObject(itemRef));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error(`Erreur lors de la suppression du dossier ${folderPath}:`, error);
  }
}

/**
 * TEST-ONLY: Uploads a file to Firebase Storage and returns its metadata.
 * Handles HEIC/HEIF conversion before upload.
 * @param storage The Firebase Storage instance.
 * @param user The authenticated user object.
 * @param file The file to upload.
 * @param onProgress A callback to report upload progress.
 * @returns A promise that resolves to the metadata of the uploaded image.
 */
export async function uploadFileAndGetMetadata(
    storage: ReturnType<typeof getStorage>,
    user: User,
    file: File,
    customName: string,
    onProgress: (progress: number) => void
): Promise<Omit<ImageMetadata, 'id' | 'userId' | 'uploadTimestamp' | 'likeCount'>> {
    
    const processedFile = await convertHeicToJpeg(file);

    return new Promise((resolve, reject) => {
        if (processedFile.size > MAX_BYTES) {
            return reject(new Error('Fichier trop volumineux (> 10 Mo).'));
        }
        if (!ALLOWED_MIME.test(processedFile.type) && !NAME_EXT_FALLBACK.test(processedFile.name)) {
            return reject(new Error('Type de fichier non autorisé (images uniquement).'));
        }

        const fileName = `${Date.now()}_${processedFile.name}`;
        // **CORRECTION CRUCIALE**: Utilisation du chemin `users/` au lieu de `uploads/`
        const storagePath = `users/${user.uid}/${fileName}`;
        const storageRef: StorageReference = ref(storage, storagePath);
        const uploadTask: UploadTask = uploadBytesResumable(storageRef, processedFile);

        uploadTask.on('state_changed',
            (snapshot) => {
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
                    const metadata = {
                        originalName: customName || processedFile.name,
                        storagePath: storagePath,
                        directUrl: downloadURL,
                        bbCode: `[img]${downloadURL}[/img]`,
                        htmlCode: `<img src="${downloadURL}" alt="${customName || processedFile.name}" />`,
                        mimeType: processedFile.type,
                        fileSize: processedFile.size,
                    };
                    resolve(metadata);
                } catch (error) {
                    reject(new Error("Impossible d'obtenir l'URL de téléchargement."));
                }
            }
        );
    });
}
