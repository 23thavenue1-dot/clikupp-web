
'use client';

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage,
} from 'firebase/storage';
import type { User } from 'firebase/auth';

// Fonction pour nettoyer et sécuriser un nom de fichier
const sanitize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-') // remplace les espaces par des tirets
    .replace(/[^a-z0-9._-]/g, '') // supprime les caractères non autorisés
    .replace(/-+/g, '-') // remplace les tirets multiples
    .replace(/^-+|-+$/g, ''); // supprime les tirets au début/à la fin

/**
 * Gère le téléversement d'un fichier vers Firebase Storage.
 * @param storage L'instance de Firebase Storage.
 * @param user L'utilisateur authentifié.
 * @param file Le fichier à téléverser.
 * @param customName Le nom personnalisé (optionnel) pour le fichier.
 * @param onProgress Callback pour suivre la progression (en pourcentage).
 * @param onError Callback en cas d'erreur.
 * @param onComplete Callback appelé à la fin, avec l'URL de téléchargement et le chemin de stockage.
 */
export function uploadImage(
  storage: FirebaseStorage,
  user: User,
  file: File,
  customName: string,
  onProgress: (progress: number) => void,
  onError: (error: Error) => void,
  onComplete: (downloadURL: string, storagePath: string) => void
) {
  // Extrait l'extension du fichier
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  
  // Utilise le nom personnalisé s'il est fourni, sinon le nom original du fichier
  const baseName = customName.trim()
    ? sanitize(customName.trim())
    : sanitize(file.name.replace(/\.[^/.]+$/, ''));
  
  // Construit un nom de fichier unique pour éviter les conflits
  const fileName = `${baseName}-${Date.now()}.${ext}`;

  // **IMPORTANT** : Le chemin de stockage qui correspond exactement aux règles de sécurité
  const storagePath = `users/${user.uid}/images/${fileName}`;
  const storageRef = ref(storage, storagePath);

  // Crée la tâche de téléversement
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  // Écoute les événements de la tâche
  uploadTask.on(
    'state_changed',
    (snapshot) => {
      // Calcule et envoie la progression
      const progress = Math.round(
        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
      );
      onProgress(progress);
    },
    (error) => {
      // Gère les erreurs (y compris les erreurs de permission)
      console.error("Erreur de téléversement Storage:", error);
      onError(error);
    },
    async () => {
      // Une fois le téléversement terminé, récupère l'URL
      try {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        // Appelle le callback de complétion avec l'URL et le chemin
        onComplete(downloadURL, storagePath);
      } catch (error) {
        console.error("Erreur de récupération de l'URL:", error);
        onError(error as Error);
      }
    }
  );

  return uploadTask;
}
