// This file does not contain 'use server' and can be imported by both client and server components.

import { z } from 'genkit';

export const SocialAuditInputSchema = z.object({
  platform: z.string().describe('La plateforme du réseau social (ex: Instagram, TikTok).'),
  goal: z.string().describe("L'objectif principal de l'utilisateur."),
  image_urls: z.array(z.string()).describe("Un tableau de data URIs des images sélectionnées pour l'analyse."),
  post_texts: z.array(z.string()).describe("Un tableau des textes de publications fournis par l'utilisateur."),
  additionalContext: z.string().optional().describe("Un contexte textuel supplémentaire fourni par l'utilisateur pour guider l'analyse."),
});
export type SocialAuditInput = z.infer<typeof SocialAuditInputSchema>;

export const SocialAuditOutputSchema = z.object({
  visual_identity: z.object({
    keywords: z.array(z.string()).describe("Une liste de 3-5 mots-clés qui décrivent le style visuel perçu."),
    summary: z.string().describe("Un court paragraphe résumant l'identité visuelle globale."),
  }),
  strategic_analysis: z.object({
    strengths: z.array(z.string()).describe("Une liste de 2-3 points forts du profil."),
    improvements: z.array(z.string()).describe("Une liste de 2-3 axes d'amélioration clairs et constructifs."),
  }),
  content_strategy: z.array(z.object({
    idea: z.string().describe("Une idée concrète de type de contenu à créer."),
    description: z.string().describe("Une brève explication de pourquoi cette idée est pertinente."),
  })).describe("Une liste de 3 suggestions de contenu."),
  action_plan: z.array(z.object({
    day: z.string().describe("Le jour du plan (ex: 'Jour 1', 'Jour 2')."),
    action: z.string().describe("L'action spécifique à réaliser ce jour-là."),
  })).describe("Un plan d'action simple sur 7 jours."),
});
export type SocialAuditOutput = z.infer<typeof SocialAuditOutputSchema>;
