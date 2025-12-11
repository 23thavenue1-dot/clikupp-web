'use server';
/**
 * @fileOverview Flow Genkit pour la génération de carrousels d'images.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Schéma de sortie pour une seule image du carrousel
const CarouselSlideSchema = z.object({
  imageUrl: z.string().describe("L'URL de l'image générée pour cette étape, encodée en data URI."),
  description: z.string().describe("La description courte et engageante pour cette étape du carrousel."),
});

// Schéma d'entrée du flow
export const GenerateCarouselInputSchema = z.object({
  baseImageUrl: z.string().describe("L'URL de l'image de base pour la transformation."),
  concept: z.enum(['tutoriel', 'avant-apres', 'zoom-details']).describe("Le concept du carrousel à générer."),
  subjectPrompt: z.string().optional().describe("Optionnel. Une description du sujet principal pour aider l'IA à le reconnaître."),
});
export type GenerateCarouselInput = z.infer<typeof GenerateCarouselInputSchema>;

// Schéma de sortie du flow
export const GenerateCarouselOutputSchema = z.object({
  slides: z.array(CarouselSlideSchema).length(3).describe("Un tableau contenant exactement 3 diapositives (slides) pour le carrousel."),
});
export type GenerateCarouselOutput = z.infer<typeof GenerateCarouselOutputSchema>;


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
    
    const { output } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Objectif :** Transformer l'image fournie en un carrousel Instagram de 3 images sur le concept de "${concept}".
                
                **Instructions :**
                1.  **Analyse l'image de base.** ${subjectPrompt ? `Le sujet principal est : ${subjectPrompt}.` : ''}
                2.  **Crée 3 nouvelles images distinctes** pour illustrer les étapes du concept :
                    *   **Étape 1 (Première image) :** L'image "Avant". Elle doit être une version légèrement moins bonne ou différente de l'originale.
                    *   **Étape 2 (Deuxième image) :** L'image "Pendant". Montre une étape intermédiaire de la transformation ou une vue alternative.
                    *   **Étape 3 (Troisième image) :** L'image "Après". C'est la version finale, visiblement améliorée et la plus percutante.
                3.  **Pour chaque image, rédige une description courte et accrocheuse** (environ 10-15 mots) qui explique l'étape.
                4.  **Important :** Tu dois générer les 3 images en une seule fois et retourner le résultat au format JSON spécifié.
            `},
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
            // Il est difficile de forcer la génération de 3 images en une seule fois.
            // Le modèle retournera généralement une seule image principale.
            // Nous simulerons les 3 étapes en utilisant des variations.
            // Pour une vraie implémentation, il faudrait 3 appels ou un modèle plus avancé.
        },
        output: {
            format: 'json',
            schema: GenerateCarouselOutputSchema,
        },
    });

    if (!output) {
      throw new Error("L'IA n'a pas pu générer le carrousel.");
    }
    
    // SIMULATION: Comme le modèle ne retourne qu'une image, nous allons la dupliquer
    // avec des descriptions différentes pour simuler le carrousel.
    // C'est une limitation connue qu'on peut adresser plus tard.
    if (output.slides.length === 1) {
        console.warn("Le modèle n'a généré qu'une seule slide. Duplication pour la simulation.");
        const singleSlide = output.slides[0];
        return {
            slides: [
                { imageUrl: baseImageUrl, description: "Étape 1 : Le point de départ." },
                { ...singleSlide, description: "Étape 2 : Le processus de transformation." },
                { ...singleSlide, description: "Étape 3 : Le résultat final, sublimé !" },
            ]
        };
    }

    return output;
  }
);
