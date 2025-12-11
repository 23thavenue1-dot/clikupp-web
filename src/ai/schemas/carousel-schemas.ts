// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

// Schéma de sortie pour une seule image du carrousel
const CarouselSlideSchema = z.object({
  imageUrl: z.string().nullable().describe("L'URL de l'image générée pour cette étape (peut être null pour les diapositives textuelles)."),
  description: z.string().describe("La description courte et engageante pour cette étape du carrousel."),
});

// Schéma d'entrée du flow
export const GenerateCarouselInputSchema = z.object({
  baseImageUrl: z.string().describe("L'URL de l'image de base pour la transformation."),
  subjectPrompt: z.string().optional().describe("Optionnel. Une description du sujet principal pour aider l'IA à le reconnaître."),
  userDirective: z.string().optional().describe("Optionnel. Une instruction directe de l'utilisateur pour guider la transformation."),
  platform: z.string().optional().describe("Optionnel. La plateforme cible pour adapter le style (ex: 'instagram')."),
});
export type GenerateCarouselInput = z.infer<typeof GenerateCarouselInputSchema>;

// Schéma de sortie du flow
export const GenerateCarouselOutputSchema = z.object({
  slides: z.array(CarouselSlideSchema).length(4).describe("Un tableau contenant exactement 4 diapositives (slides) pour le carrousel : Avant, Pendant, Après, Question."),
});
export type GenerateCarouselOutput = z.infer<typeof GenerateCarouselOutputSchema>;


// --- Schémas pour la regénération ---

export const RegenerateTextInputSchema = z.object({
    baseImageUrl: z.string().describe("URL de l'image 'Avant'."),
    afterImageUrl: z.string().describe("URL de l'image 'Après'."),
    slideIndex: z.number().min(0).max(3).describe("L'index de la diapositive à regénérer (0 à 3)."),
    currentText: z.string().describe("Le texte actuel de la diapositive que l'utilisateur souhaite améliorer."),
    platform: z.string().optional().describe("La plateforme cible pour adapter le ton."),
});
export type RegenerateTextInput = z.infer<typeof RegenerateTextInputSchema>;


export const RegenerateTextOutputSchema = z.object({
    newText: z.string().describe("La nouvelle version du texte pour la diapositive."),
});
export type RegenerateTextOutput = z.infer<typeof RegenerateTextOutputSchema>;
