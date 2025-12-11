// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

// Schéma de sortie pour une seule image du carrousel
const CarouselSlideSchema = z.object({
  imageUrl: z.string().describe("L'URL de l'image générée pour cette étape, encodée en data URI."),
  description: z.string().describe("La description courte et engageante pour cette étape du carrousel."),
});

// Schéma d'entrée du flow
export const GenerateCarouselInputSchema = z.object({
  baseImageUrl: z.string().describe("L'URL de l'image de base pour la transformation."),
  subjectPrompt: z.string().optional().describe("Optionnel. Une description du sujet principal pour aider l'IA à le reconnaître."),
  userDirective: z.string().optional().describe("Optionnel. Une instruction directe de l'utilisateur pour guider la transformation."),
});
export type GenerateCarouselInput = z.infer<typeof GenerateCarouselInputSchema>;

// Schéma de sortie du flow
export const GenerateCarouselOutputSchema = z.object({
  slides: z.array(CarouselSlideSchema).length(2).describe("Un tableau contenant exactement 2 diapositives (slides) pour le carrousel : Avant et Après."),
});
export type GenerateCarouselOutput = z.infer<typeof GenerateCarouselOutputSchema>;
