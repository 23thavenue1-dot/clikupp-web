
// Ce fichier est maintenant obsolète car nous utilisons l'extension Firebase/Stripe.
// La logique de création de session de paiement est désormais gérée côté client
// en créant un document dans `customers/{userId}/checkout_sessions`.
// Voir `src/app/shop/page.tsx` pour la nouvelle implémentation.
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return new NextResponse('Ce endpoint est obsolète. Utilisez l\'extension Firebase/Stripe.', { status: 410 });
}
