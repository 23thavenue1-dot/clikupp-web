
'use server';
/**
 * @fileOverview Flow Genkit pour regénérer le texte d'une diapositive de carrousel.
 */

import { ai } from '@/ai/genkit';
import { RegenerateTextInputSchema, RegenerateTextOutputSchema, type RegenerateTextInput, type RegenerateTextOutput } from '@/ai/schemas/carousel-schemas';

export async function regenerateCarouselText(input: RegenerateTextInput): Promise<RegenerateTextOutput> {
    const { output } = await regenerateTextPrompt(input);
    if (!output) {
        throw new Error("L'IA n'a pas pu regénérer de texte.");
    }
    return output;
}

const regenerateTextPrompt = ai.definePrompt({
    name: 'regenerateCarouselTextPrompt',
    input: { schema: RegenerateTextInputSchema },
    output: { schema: RegenerateTextOutputSchema },
    prompt: `
        **Rôle :** Tu es un social media manager et copywriter d'élite, spécialiste du storytelling percutant pour {{platform}} ou d'autres réseaux sociaux. Ton super-pouvoir est d'améliorer un texte existant pour le rendre plus engageant, plus inspirant ou plus drôle.

        **Règles absolues :**
        1.  **Qualité du texte :** Le texte doit être en français impeccable, sans fautes d'orthographe et sans invention de mots.
        2.  **Format de sortie :** Ne retourne QUE le nouveau texte. Pas de préfixe, pas de fioritures.
        
        **Mission :** On te fournit deux images, "Avant" et "Après", ainsi que le texte d'une diapositive de carrousel (diapositive numéro {{slideIndex}}) que l'utilisateur trouve un peu faible. Ta mission est de proposer une **nouvelle version améliorée** de ce texte, en te basant sur le contexte visuel et l'intention de la diapositive.

        **Contexte Visuel :**
        - Image Avant : {{media url=baseImageUrl}}
        - Image Après : {{media url=afterImageUrl}}

        **Texte à améliorer :** "{{currentText}}"

        **Analyse de la diapositive (pour ton information) :**
        - **Si diapositive 1 (index 0) :** C'est l'accroche. Le texte doit décrire l'image "Avant" de manière factuelle mais intrigante.
        - **Si diapositive 2 (index 1) :** C'est la transition. Le texte doit poser une question ouverte et engageante sur le potentiel de l'image "Avant". Rends-la plus poétique ou plus directe.
        - **Si diapositive 3 (index 2) :** C'est la révélation. Le texte doit décrire le bénéfice ou l'émotion de l'image "Après". Sois plus évocateur.
        - **Si diapositive 4 (index 3) :** C'est la conclusion. Le texte doit poser une question finale engageante, directement liée à l'image "Après", pour lancer la conversation.

        **Instruction :** Propose une alternative au texte "{{currentText}}" qui soit plus forte et plus alignée avec le storytelling du carrousel.
    `,
});
