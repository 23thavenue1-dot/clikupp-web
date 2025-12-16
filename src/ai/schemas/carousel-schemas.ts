// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

// Schéma d'entrée du flow principal
export const GenerateCarouselInputSchema = z.object({
  baseImageUrl: z.string().describe("L'URL de l'image de base pour la transformation."),
  subjectPrompt: z.string().optional().describe("Optionnel. Une description du sujet principal pour aider l'IA à le reconnaître."),
  userDirective: z.string().optional().describe("Optionnel. Une instruction directe de l'utilisateur pour guider la transformation."),
  platform: z.string().optional().describe("Optionnel. La plateforme cible pour adapter le style (ex: 'instagram')."),
});
export type GenerateCarouselInput = z.infer<typeof GenerateCarouselInputSchema>;


// --- NOUVEAUX SCHÉMAS POUR LE CARROUSEL COMPLEXE ---

// Schéma pour une seule diapositive de carrousel
export const CarouselSlideSchema = z.object({
  type: z.enum(['image', 'text']),
  title: z.string().describe("Titre de la diapositive (ex: AVANT, APRÈS)."),
  content: z.string().describe("Pour 'image', c'est l'URL. Pour 'text', c'est le contenu brut."),
});
export type CarouselSlide = z.infer<typeof CarouselSlideSchema>;


// Schéma de sortie du flow de génération de carrousel
export const GenerateCarouselOutputSchema = z.object({
  slides: z.array(CarouselSlideSchema).length(4).describe("Un tableau de 4 diapositives composant le carrousel narratif."),
});
export type GenerateCarouselOutput = z.infer<typeof GenerateCarouselOutputSchema>;


// --- SCHÉMAS POUR LA REGÉNÉRATION DE TEXTE ---

// Schéma d'entrée pour la régénération de texte
export const RegenerateTextInputSchema = z.object({
  baseImageUrl: z.string().describe("URL de l'image 'Avant' pour le contexte."),
  afterImageUrl: z.string().describe("URL de l'image 'Après' pour le contexte."),
  currentText: z.string().describe("Le texte actuel de la diapositive à améliorer."),
  slideIndex: z.number().describe("L'index de la diapositive (1 ou 3) pour adapter le ton."),
  platform: z.string().optional().describe("La plateforme cible pour le ton."),
});
export type RegenerateTextInput = z.infer<typeof RegenerateTextInputSchema>;


// Schéma de sortie pour la régénération de texte
export const RegenerateTextOutputSchema = z.object({
  newText: z.string().describe("Le nouveau texte suggéré par l'IA."),
});
export type RegenerateTextOutput = z.infer<typeof RegenerateTextOutputSchema>;
