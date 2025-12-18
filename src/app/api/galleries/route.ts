
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { createGallery } from '@/lib/firestore'; // Nous utiliserons notre fonction existante

// Initialise l'app admin Firebase si ce n'est pas déjà fait
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Gère les requêtes POST pour créer une nouvelle galerie.
 * C'est le seul endroit où l'authentification est vérifiée pour cette action.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized: Missing or invalid token', { status: 401 });
    }
    const token = authHeader.substring(7);

    // Vérifie le token pour obtenir l'utilisateur authentifié
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return new NextResponse('Unauthorized: Invalid user ID in token', { status: 401 });
    }

    // Extrait le nom de la galerie du corps de la requête
    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return new NextResponse('Bad Request: Gallery name is required', { status: 400 });
    }

    // Utilise la fonction existante pour créer la galerie
    const firestore = admin.firestore();
    // @ts-ignore - Le SDK Admin et le SDK Client ont des types légèrement différents mais compatibles ici
    const newGalleryRef = await createGallery(firestore, userId, name);

    return NextResponse.json({ success: true, galleryId: newGalleryRef.id }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/galleries Error:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
      return new NextResponse('Unauthorized: Invalid token', { status: 401 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
