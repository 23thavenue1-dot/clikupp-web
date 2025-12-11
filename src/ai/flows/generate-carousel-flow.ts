
'use server';
/**
 * @fileOverview Flow Genkit pour la génération de carrousels d'images.
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
  async ({ baseImageUrl, subjectPrompt, userDirective }) => {
    
    const { media, text } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Rôle :** Tu es un directeur artistique expert, un retoucheur photo, et un social media manager.
                
                **Objectif :** En te basant sur l'image fournie, tu vas créer une histoire de transformation "Avant/Après" en 4 étapes sous forme de carrousel.

                **Instructions détaillées :**
                1.  **Analyse l'image de base.** Identifie sa nature (portrait, paysage, objet...). ${subjectPrompt ? `Le sujet principal est : ${subjectPrompt}.` : ''}
                
                2.  **Imagine la transformation :** 
                    ${userDirective 
                        ? `L'utilisateur a donné une directive claire : "${userDirective}". Ta transformation DOIT suivre cette instruction.`
                        : "Quelle est LA modification clé qui sublimerait cette image ? (Ex: améliorer l'éclairage d'un portrait, rendre un ciel plus dramatique, etc.)."
                    }

                3.  **Génère une unique image "Après"** qui représente cette transformation de la manière la plus qualitative possible.
                
                4.  **Rédige 4 descriptions très courtes et percutantes** pour raconter cette histoire, une pour chaque étape du carrousel. Sépare chaque description par '---'.
                    *   **Description 1 (Avant) :** Décris le point de départ, l'image originale.
                    *   **Description 2 (Pendant) :** Explique brièvement l'intention créative, la transformation que tu vas opérer.
                    *   **Description 3 (Après) :** Décris le résultat final, en mettant en valeur le bénéfice de la transformation.
                    *   **Description 4 (Question) :** Rédige une question ouverte et engageante liée à l'image ou à la transformation, pour inciter les commentaires.
            `},
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    });

    if (!media || !media.url || !text) {
      throw new Error("L'IA n'a pas pu générer le carrousel.");
    }
    
    const descriptions = text.split('---').map(d => d.trim());
    if (descriptions.length < 4) {
      throw new Error("L'IA n'a pas retourné les 4 descriptions attendues.");
    }
    
    const finalImageUrl = media.url;

    return {
        slides: [
            { imageUrl: baseImageUrl, description: descriptions[0] },
            { imageUrl: '', description: descriptions[1] }, // Image vide pour l'étape "Pendant"
            { imageUrl: finalImageUrl, description: descriptions[2] }, 
            { imageUrl: finalImageUrl, description: descriptions[3] }, // 4ème slide avec la question
        ]
    };
  }
);
