'use client';

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage,
} from 'firebase/storage';
import type { User } from 'firebase/auth';

const sanitize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export function uploadImage(
  storage: FirebaseStorage,
  user: User,
  file: File,
  customName: string,
  onProgress: (progress: number) => void,
  onError: (error: Error) => void,
  onComplete: (downloadURL: string, storagePath: string) => void
) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const baseName = customName.trim()
    ? sanitize(customName.trim())
    : sanitize(file.name.replace(/\.[^/.]+$/, ''));
  
  // Chemin de stockage mis à jour pour correspondre aux nouvelles règles de sécurité
  const fileName = `${baseName}-${Date.now()}.${ext}`;
  const storagePath = `users/${user.uid}/images/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const progress = Math.round(
        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
      );
      onProgress(progress);
    },
    (error) => {
      console.error(error);
      onError(error);
    },
    async () => {
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      onComplete(downloadURL, storagePath);
    }
  );

  return uploadTask;
}
