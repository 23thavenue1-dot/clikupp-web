
'use server';
/**
 * @fileOverview Flow Genkit pour la génération de description d'image par IA, optimisé pour les réseaux sociaux et l'e-commerce.
 *
 * - generateImageDescription: La fonction principale qui prend une URL d'image et une plateforme, puis retourne un contenu adapté.
 * - GenerateDescriptionInput: Le type d'entrée pour la fonction.
 * - GenerateDescriptionOutput: Le type de sortie pour la fonction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateDescriptionInputSchema = z.object({
  imageUrl: z.string().url().describe("L'URL de l'image à analyser."),
  platform: z.enum(['instagram', 'facebook', 'x', 'tiktok', 'generic', 'ecommerce']).describe("La plateforme cible pour le contenu (réseau social ou e-commerce)."),
  goal: z.string().optional().describe("L'objectif stratégique de l'utilisateur (ex: 'Augmenter l'engagement')."),
  context: z.string().optional().describe("Le contexte de l'audit ou de la stratégie (ex: 'Identité visuelle : Naturel, Contraste élevé. Axe d'amélioration : Diversifier le contenu.')."),
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
    prompt: `Tu es un expert polyvalent, agissant soit comme un community manager, soit comme un copywriter e-commerce.

Analyse l'image suivante et prépare une publication optimisée pour la plateforme cible : **{{platform}}**.

**Règles absolues :**
1.  **Orthographe et Langue :** Le texte généré doit être en français impeccable, sans fautes d'orthographe. N'invente JAMAIS de mots. Sois littéral et précis.
2.  **Format :** N'utilise JAMAIS de balises HTML ou de format Markdown. La sortie doit être du texte brut uniquement. Pour les listes, utilise un tiret simple (-).

{{#if goal}}
**IMPORTANT : Tu dois impérativement rédiger le contenu en gardant à l'esprit l'objectif principal de l'utilisateur : "{{goal}}".**
{{/if}}

{{#if context}}
**Pour t'aider, voici le résumé de l'analyse stratégique qui a été faite pour l'utilisateur : "{{context}}". Utilise ces informations pour que ta proposition soit la plus pertinente possible.**
{{/if}}

Voici tes instructions spécifiques :

1.  **Si la plateforme est 'ecommerce' :**
    *   **Personnalité :** Deviens un expert en marketing direct. Ton objectif est de VENDRE.
    *   **Titre :** Crée un titre de produit clair, concis et désirable.
    *   **Description :** Rédige une description commerciale et persuasive. Mets en avant 2 ou 3 bénéfices clés du produit en utilisant des listes à tirets pour la clarté (par exemple : "- Bénéfice 1"). Le ton doit être professionnel mais engageant.
    *   **Hashtags :** Génère des mots-clés pertinents pour le référencement (SEO) et les places de marché, pas des hashtags de réseaux sociaux.

2.  **Si la plateforme est un réseau social ('instagram', 'facebook', 'x', etc.) :**
    *   **Personnalité :** Deviens un community manager créatif. Ton objectif est l'ENGAGEMENT et l'alignement avec l'objectif de l'utilisateur ({{goal}}).
    *   **Titre :** Crée un titre court et percutant.
    *   **Description :** Rédige une description engageante qui inclut un ou deux émojis pertinents. Adapte le ton et la longueur à la plateforme et à l'objectif.
    *   **Hashtags :** Génère une liste de 5 à 10 hashtags pertinents, mélangeant des tags populaires et plus spécifiques, en lien avec le contexte et l'objectif.

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
