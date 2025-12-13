// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

export const AnimateStoryInputSchema = z.object({
  imageUrl: z.string().describe("L'URL de l'image de base à animer."),
  prompt: z.string().min(3).describe("L'instruction en langage naturel pour l'animation (ex: 'Fais tomber de la neige')."),
  aspectRatio: z.string().optional().describe("Le ratio d'aspect de la vidéo (ex: '9:16')."),
});
export type AnimateStoryInput = z.infer<typeof AnimateStoryInputSchema>;


export const AnimateStoryOutputSchema = z.object({
  videoUrl: z.string().describe("L'URL de la vidéo générée, encodée en data URI (base64)."),
});
export type AnimateStoryOutput = z.infer<typeof AnimateStoryOutputSchema>;
