
// Ce fichier est maintenant obsolète.
// La logique de webhook est entièrement gérée par l'extension Firebase/Stripe.
// L'extension met à jour la base de données Firestore directement
// après un événement de paiement réussi.
// La configuration du webhook se fait dans la console Firebase lors de l'installation de l'extension.
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return new NextResponse('Ce endpoint est obsolète. La logique de webhook est gérée par l\'extension Firebase/Stripe.', { status: 410 });
}
