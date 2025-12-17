
'use server';
/**
 * @fileOverview Flow Genkit pour l'édition d'image par IA en utilisant une instruction textuelle.
 *
 * - editImage: La fonction principale qui prend une URL d'image et un prompt, puis retourne la nouvelle image.
 * - EditImageInput: Le type d'entrée pour la fonction.
 * - EditImageOutput: Le type de sortie pour la fonction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EditImageInputSchema = z.object({
  imageUrl: z
    .string()
    .describe(
      "L'URL de l'image source à modifier, doit être un data URI ou une URL accessible publiquement."
    ),
  prompt: z
    .string()
    .min(3)
    .describe(
      "L'instruction en langage naturel pour modifier l'image (ex: 'Rends le ciel plus dramatique')."
    ),
});
export type EditImageInput = z.infer<typeof EditImageInputSchema>;

const EditImageOutputSchema = z.object({
  newImageUrl: z
    .string()
    .describe(
      "L'URL de la nouvelle image générée, encodée en data URI (base64)."
    ),
});
export type EditImageOutput = z.infer<typeof EditImageOutputSchema>;

export async function editImage(input: EditImageInput): Promise<EditImageOutput> {
  return editImageFlow(input);
}

const editImageFlow = ai.defineFlow(
  {
    name: 'editImageFlow',
    inputSchema: EditImageInputSchema,
    outputSchema: EditImageOutputSchema,
  },
  async ({ imageUrl, prompt }) => {
    
    // Ajout d'une instruction de sécurité pour fiabiliser la génération de texte
    const enhancedPrompt = `
      **Règle importante :** Si la demande implique d'écrire du texte sur l'image, ce texte DOIT être en français correct, sans fautes d'orthographe et sans inventer de mots. Sois aussi littéral que possible.
      
      Voici la demande originale de l'utilisateur : "${prompt}"
    `;

    const { media } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: imageUrl } },
            { text: enhancedPrompt }, // Utilisation du prompt amélioré
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
             safetySettings: [
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
            ],
        },
    });

    if (!media || !media.url) {
        throw new Error("L'IA n'a pas pu générer une nouvelle image.");
    }
    
    return {
      newImageUrl: media.url,
    };
  }
);
