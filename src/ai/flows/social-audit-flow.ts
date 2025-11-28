
'use server';
/**
 * @fileOverview Flow Genkit pour l'audit de profil de réseau social par l'IA.
 *
 * - socialAuditFlow: La fonction principale qui prend les informations du profil et retourne un rapport d'audit.
 */

import { ai } from '@/ai/genkit';
import { SocialAuditInputSchema, SocialAuditOutputSchema, type SocialAuditInput, type SocialAuditOutput } from '@/ai/schemas/social-audit-schemas';

export async function socialAuditFlow(input: SocialAuditInput): Promise<SocialAuditOutput> {
    const { output } = await socialAuditPrompt(input);
    if (!output) {
        throw new Error("L'IA n'a pas pu générer de rapport d'audit.");
    }
    return output;
}

const socialAuditPrompt = ai.definePrompt({
    name: 'socialAuditPrompt',
    input: { schema: SocialAuditInputSchema },
    output: { schema: SocialAuditOutputSchema },
    prompt: `
        Tu es un coach expert en stratégie de contenu et en personal branding pour les réseaux sociaux. Ton ton est encourageant, professionnel et très actionnable.

        Un créateur de contenu te soumet son profil pour un audit. Voici ses informations :
        - Plateforme : {{platform}}
        - Son objectif principal : "{{goal}}"
        - Une sélection de ses publications visuelles :
        {{#each image_urls}}
        - {{media url=this}}
        {{/each}}
        - Exemples de ses textes de publication :
        {{#each post_texts}}
        - "{{this}}"
        {{/each}}
        {{#if additionalContext}}
        - Contexte supplémentaire fourni par l'utilisateur : "{{additionalContext}}"
        {{/if}}

        En te basant UNIQUEMENT sur ces informations, fournis un rapport complet structuré précisément comme suit :

        1.  **visual_identity**: Analyse l'harmonie des couleurs, le style de composition, et l'ambiance générale. Résume cela en 3 à 5 mots-clés pertinents (ex: "minimaliste", "naturel", "contraste élevé") et un court paragraphe de synthèse.
        
        2.  **strategic_analysis**: Identifie 2 ou 3 points forts clairs (ce qui fonctionne déjà bien) et 2 ou 3 axes d'amélioration concrets et bienveillants. Sois constructif.
        
        3.  **content_strategy**: Propose 3 idées de contenu variées et spécifiques (ex: "Essayer un carrousel avant/après", "Faire une vidéo des coulisses de votre travail", "Créer un post tutoriel") qui sont directement liées à son objectif.
        
        4.  **action_plan**: Crée un plan d'action simple et motivant sur 7 jours. Chaque jour doit avoir une seule action concrète à réaliser pour commencer à appliquer tes conseils. Par exemple : "Jour 1: Mettre à jour votre biographie.", "Jour 2: Poster une photo en utilisant la règle des tiers."

        5. **creative_suggestion**: C'est l'étape la plus importante. Synthétise TOUTE ton analyse (identité visuelle, stratégie, objectif) en UNE SEULE suggestion de prompt pour générer une image. Le prompt doit être créatif, précis et directement utilisable pour créer une publication qui incarne tes recommandations.
    `,
});
