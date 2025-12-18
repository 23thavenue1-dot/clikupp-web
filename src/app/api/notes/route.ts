
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { saveNote } from '@/lib/firestore';

// Initialise l'app admin Firebase si ce n'est pas déjà fait
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Gère les requêtes POST pour créer une nouvelle note.
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

    // Extrait le texte de la note du corps de la requête
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return new NextResponse('Bad Request: Note text is required', { status: 400 });
    }

    // Utilise la fonction refactorisée pour sauvegarder la note
    const firestore = admin.firestore();
    // @ts-ignore - Le SDK Admin et le SDK Client ont des types légèrement différents mais compatibles pour Firestore
    await saveNote(firestore, userId, text);

    return NextResponse.json({ success: true, message: 'Note created successfully' }, { status: 201 });

  } catch (error: any) {
    console.error('API /api/notes Error:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
      return new NextResponse('Unauthorized: Invalid token', { status: 401 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
