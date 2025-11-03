'use server';
/**
 * @fileOverview Flow Genkit pour la génération de description d'image par IA, optimisé pour les réseaux sociaux.
 *
 * - generateImageDescription: La fonction principale qui prend une URL d'image et une plateforme, puis retourne un contenu adapté.
 * - GenerateDescriptionInput: Le type d'entrée pour la fonction.
 * - GenerateDescriptionOutput: Le type de sortie pour la fonction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateDescriptionInputSchema = z.object({
  imageUrl: z.string().url().describe("L'URL de l'image à analyser."),
  platform: z.enum(['instagram', 'facebook', 'x', 'tiktok', 'generic']).describe("La plateforme de réseau social cible pour le contenu."),
});
export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

const GenerateDescriptionOutputSchema = z.object({
  title: z.string().describe("Un titre accrocheur pour la publication, adapté à la plateforme."),
  description: z.string().describe("Une description de l'image, optimisée pour la plateforme (longueur, ton, etc.)."),
  hashtags: z.array(z.string()).describe("Une liste de 5 à 10 hashtags pertinents et populaires."),
});
export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;


export async function generateImageDescription(input: GenerateDescriptionInput): Promise<GenerateDescriptionOutput> {
  return generateImageDescriptionFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateSocialMediaPostPrompt',
    input: { schema: GenerateDescriptionInputSchema },
    output: { schema: GenerateDescriptionOutputSchema },
    prompt: `Tu es un community manager expert, spécialisé dans la création de contenu viral pour les réseaux sociaux.

Analyse l'image suivante et prépare une publication optimisée pour la plateforme : **{{platform}}**.

Voici tes instructions :
1.  **Titre :** Crée un titre court et percutant.
2.  **Description :** Rédige une description engageante. Adapte le ton et la longueur à la plateforme : plus descriptif pour Instagram/Facebook, très court et direct pour X (anciennement Twitter).
3.  **Hashtags :** Génère une liste de 5 à 10 hashtags pertinents, mélangeant des tags populaires et plus spécifiques.

Image à analyser : {{media url=imageUrl}}`,
});

const generateImageDescriptionFlow = ai.defineFlow(
  {
    name: 'generateImageDescriptionFlow',
    inputSchema: GenerateDescriptionInputSchema,
    outputSchema: GenerateDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
