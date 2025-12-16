// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

// Schéma d'entrée du flow
export const GenerateCarouselInputSchema = z.object({
  baseImageUrl: z.string().describe("L'URL de l'image de base pour la transformation."),
  subjectPrompt: z.string().optional().describe("Optionnel. Une description du sujet principal pour aider l'IA à le reconnaître."),
  userDirective: z.string().optional().describe("Optionnel. Une instruction directe de l'utilisateur pour guider la transformation."),
  platform: z.string().optional().describe("Optionnel. La plateforme cible pour adapter le style (ex: 'instagram')."),
});
export type GenerateCarouselInput = z.infer<typeof GenerateCarouselInputSchema>;

// Schéma de sortie du flow
export const OptimizedImageOutputSchema = z.object({
  optimizedImageUrl: z.string().describe("L'URL de l'image optimisée générée."),
});
export type OptimizeImageOutput = z.infer<typeof OptimizedImageOutputSchema>;
