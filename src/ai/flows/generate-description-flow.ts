'use server';
/**
 * @fileOverview Flow Genkit pour la génération de description d'image par IA.
 *
 * - generateImageDescription: La fonction principale qui prend une URL d'image et retourne une description.
 * - GenerateDescriptionInput: Le type d'entrée pour la fonction.
 * - GenerateDescriptionOutput: Le type de sortie pour la fonction.
 */

import { ai } from '@/ai/genkit';
import { z }s from 'genkit/zod';

const GenerateDescriptionInputSchema = z.object({
  imageUrl: z.string().url().describe("L'URL de l'image à analyser."),
});
export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

const GenerateDescriptionOutputSchema = z.object({
  description: z.string().describe("Une description de l'image, de 2 à 3 phrases."),
});
export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;


export async function generateImageDescription(input: GenerateDescriptionInput): Promise<GenerateDescriptionOutput> {
  return generateImageDescriptionFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateImageDescriptionPrompt',
    input: { schema: GenerateDescriptionInputSchema },
    output: { schema: GenerateDescriptionOutputSchema },
    prompt: `Tu es un expert en description d'images pour les réseaux sociaux. Analyse l'image suivante et écris une description engageante et concise (2-3 phrases maximum).

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
