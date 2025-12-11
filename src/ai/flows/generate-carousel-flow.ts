
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
  async ({ baseImageUrl, concept, subjectPrompt }) => {
    
    // Le modèle ne supporte pas le mode JSON, nous retirons donc la demande de formatage JSON.
    // Nous allons demander une seule image améliorée et du texte, puis construire le carrousel.
    const { output } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Objectif :** Transformer l'image fournie en une version finale améliorée et percutante, sur le concept de "${concept}".
                
                **Instructions :**
                1.  **Analyse l'image de base.** ${subjectPrompt ? `Le sujet principal est : ${subjectPrompt}.` : ''}
                2.  **Crée une unique image "Après"**, qui est la version finale, visiblement améliorée et la plus qualitative possible.
            `},
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        }
    });

    if (!output || !output.media) {
      throw new Error("L'IA n'a pas pu générer le carrousel.");
    }
    
    // SIMULATION: Comme le modèle ne retourne qu'une seule image (la version "Après"),
    // nous allons construire le carrousel en 3 étapes nous-mêmes.
    return {
        slides: [
            { imageUrl: baseImageUrl, description: "Étape 1 : Le point de départ." },
            { imageUrl: output.media.url, description: "Étape 2 : Le processus de transformation." },
            { imageUrl: output.media.url, description: "Étape 3 : Le résultat final, sublimé !" },
        ]
    };
  }
);
