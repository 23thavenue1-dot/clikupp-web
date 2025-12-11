'use server';
/**
 * @fileOverview Flow Genkit pour la génération de carrousels d'images en 4 étapes.
 */

import { ai } from '@/ai/genkit';
import { GenerateCarouselInputSchema, GenerateCarouselOutputSchema, type GenerateCarouselInput, type GenerateCarouselOutput } from '@/ai/schemas/carousel-schemas';


export async function generateCarousel(input: GenerateCarouselInput): Promise<GenerateCarouselOutput> {
  return generateCarouselFlow(input);
}


const generateCarouselFlow = ai.defineFlow(
  {
    name: 'generateCarouselFlow',
    inputSchema: GenerateCarouselInputSchema,
    outputSchema: GenerateCarouselOutputSchema,
  },
  async ({ baseImageUrl, subjectPrompt, userDirective, platform }) => {
    
    // --- ÉTAPE 1: Générer l'image "Après" ET les 4 descriptions textuelles en un seul appel ---
    const mainGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash', // Modèle texte puissant
        prompt: `
            **Rôle :** Tu es un social media manager expert en storytelling pour ${platform}.
            **Objectif :** Rédige 4 descriptions très courtes et percutantes pour un carrousel "Avant/Après". Sépare chaque description par '---'.
            
            **Règle impérative :** Ne préfixe JAMAIS tes descriptions par "Texte 1", "Description 2", etc. Le ton doit être engageant et adapté à ${platform || 'un réseau social'}.
            
            **Contexte :**
            - Image Avant : Une photo de base.
            - Image Après : La même photo, mais améliorée et plus professionnelle.
            - Directive de l'utilisateur : "${userDirective || "Embellir le portrait pour un résultat professionnel et esthétique."}"
            
            **Descriptions à rédiger :**
            *   **Description 1 (Avant) :** Décris le point de départ, l'image originale. Sois factuel mais intriguant.
            *   **Description 2 (Pendant) :** Explique brièvement le défi créatif, la transformation qui va être opérée. Crée du suspense.
            *   **Description 3 (Après) :** Décris le résultat final, en mettant en valeur le bénéfice de la transformation. Utilise un ton enthousiaste.
            *   **Description 4 (Question) :** Rédige une question ouverte et engageante liée à l'image ou à la transformation, pour inciter les commentaires (style Instagram).
        `
    });

    const afterImageGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Rôle :** Tu es un directeur artistique expert, un retoucheur photo.
                
                **Objectif :** En te basant sur l'image fournie, tu vas générer une unique image "Après" qui représente une transformation.
                ${subjectPrompt ? `Le sujet principal est : ${subjectPrompt}.` : ''}

                **Instruction de transformation :** 
                ${userDirective 
                    ? `L'utilisateur a donné une directive claire : "${userDirective}". Ta transformation DOIT suivre cette instruction.`
                    : "Ta mission est d'embellir ce portrait. Apporte plus de lumière, rehausse les couleurs pour un éclat naturel et vibrant, améliore la netteté du regard et lisse subtilement la peau pour un résultat professionnel et esthétique."
                }
                
                Le résultat doit être visiblement optimisé.
            `},
        ],
        config: {
            responseModalities: ['IMAGE'],
        },
    });

    if (!afterImageGeneration.media || !afterImageGeneration.media.url || !mainGeneration.text) {
      throw new Error("L'IA n'a pas pu générer le contenu principal du carrousel.");
    }
    
    // Nettoyer les descriptions pour enlever les préfixes potentiels (ex: "Description 1 (Avant):", "**Texte 2:**")
    const descriptions = mainGeneration.text.split('---').map(d => d.replace(/^\*+ *(?:Description|Texte) \d+[^:]*:[ \n]*/i, '').trim());

    if (descriptions.length < 4) {
      throw new Error("L'IA n'a pas retourné les 4 descriptions attendues.");
    }

    const afterImageUrl = afterImageGeneration.media.url;

    // Pour les slides 2 et 4, on ne retourne pas d'URL d'image, seul le texte compte.
    // L'image sera construite côté client.
    return {
        slides: [
            { imageUrl: baseImageUrl, description: descriptions[0] },
            { imageUrl: null, description: descriptions[1] },
            { imageUrl: afterImageUrl, description: descriptions[2] }, 
            { imageUrl: null, description: descriptions[3] },
        ]
    };
  }
);
