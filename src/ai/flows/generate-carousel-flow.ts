
'use server';
/**
 * @fileOverview Flow Genkit pour la génération d'un carrousel "Avant/Après" en 4 étapes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { GenerateCarouselInputSchema, GenerateCarouselOutputSchema, type GenerateCarouselInput, type GenerateCarouselOutput } from '@/ai/schemas/carousel-schemas';

export async function generateCarousel(input: GenerateCarouselInput): Promise<GenerateCarouselOutput> {
  return generateCarouselFlow(input);
}

const textGenerationOutputSchema = z.object({
    hookText: z.string().describe("Texte d'accroche pour la diapo 2 (après l'image 'Avant'). Doit être court, engageant et poser une question ou créer du suspense."),
    conclusionText: z.string().describe("Texte de conclusion pour la diapo 4 (après l'image 'Après'). Doit célébrer la transformation et inclure un appel à l'action."),
});

const textGenerationPrompt = ai.definePrompt({
    name: "carouselTextGenerator",
    input: { schema: z.object({ baseImageUrl: z.string(), afterImageUrl: z.string(), userDirective: z.string().optional(), platform: z.string().optional() }) },
    output: { schema: textGenerationOutputSchema },
    prompt: `
        Tu es un expert en storytelling pour les réseaux sociaux.
        **Règle Fondamentale :** Le texte doit être en français impeccable, sans fautes d'orthographe et sans invention de mots.

        On te donne une image "Avant" et une image "Après".
        L'objectif de l'utilisateur est : "{{userDirective}}". La plateforme cible est : "{{platform}}".

        Ta mission est de rédiger deux textes courts et percutants pour un carrousel :
        1.  **hookText**: Un texte pour la diapositive qui suit l'image "Avant". Il doit susciter la curiosité. Pose une question ouverte ou décris le potentiel caché.
        2.  **conclusionText**: Un texte pour la dernière diapositive, qui suit l'image "Après". Il doit exprimer le bénéfice de la transformation et se terminer par une question pour engager l'audience.

        Image "Avant" : {{media url=baseImageUrl}}
        Image "Après" : {{media url=afterImageUrl}}
    `,
});


const generateCarouselFlow = ai.defineFlow(
  {
    name: 'generateCarouselFlow',
    inputSchema: GenerateCarouselInputSchema,
    outputSchema: GenerateCarouselOutputSchema,
  },
  async ({ baseImageUrl, subjectPrompt, userDirective, platform }) => {
    
    // Étape 1 : Générer l'image "Après"
    const afterImageGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Contexte :** L'image fournie est une photo "Avant", souvent de type amateur. Pour l'image "Après" que tu vas créer, tu incarnes un directeur artistique de renom qui transforme une scène.
                
                **Objectif :** Transformer cette photo amateur en une photo spectaculaire et de haute qualité. La différence doit être flagrante et raconter une histoire.
                
                **Règle Narrative Cruciale :** L'image "Après" ne doit pas être une simple amélioration de l'image "Avant". Le sujet principal doit être reconnaissable, mais **sa pose, son action ou l'environnement doivent radicalement changer** pour créer une progression dynamique.
                - Si l'image "Avant" est statique, l'image "Après" doit suggérer le mouvement, la joie ou une action.
                - Si le sujet est un **animal** (comme un chien), montre-le en train de **courir dans un champ, de sauter pour attraper une balle, ou de manger joyeusement une friandise**, plutôt que de simplement changer le fond.
                - Si c'est un **portrait**, change l'expression, l'angle de vue ou le décor pour refléter une évolution (ex: de la timidité à la confiance).

                **Instruction de transformation :** 
                ${userDirective 
                    ? `L'utilisateur a donné une directive claire : "${userDirective}". Applique cette directive tout en respectant la Règle Narrative Cruciale.`
                    : `Tu dois analyser l'image "Avant" et appliquer la transformation la plus pertinente et optimisée pour la plateforme "${platform}", en respectant la Règle Narrative Cruciale.
                      - **Pour Instagram et Facebook :** Privilégie des couleurs vibrantes, un contraste élevé et une scène dynamique qui attire l'œil.
                      - **Pour LinkedIn :** Vise un rendu plus professionnel, montrant le sujet en action ou dans un contexte valorisant.
                      - **Si l'image est un portrait :** Transforme-le en un portrait professionnel ou artistique avec une nouvelle pose et une nouvelle lumière.
                      - **Si l'image est une pièce d'intérieur :** Réaménage-la complètement avec un nouveau style, de nouveaux meubles.
                      - **Si l'image met en valeur un objet :** Crée une nouvelle mise en scène "lifestyle" inspirante pour vendre le produit.
                      - **Si l'image est un paysage :** Transforme complètement l'ambiance (ex: de jour à coucher de soleil, d'été à hiver).`
                }
            `},
        ],
        config: {
            responseModalities: ['IMAGE'],
            safetySettings: [
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
            ],
        },
    });

    if (!afterImageGeneration.media || !afterImageGeneration.media.url) {
      throw new Error("L'IA n'a pas pu générer l'image 'Après'.");
    }
    const afterImageUrl = afterImageGeneration.media.url;

    // Étape 2: Générer le texte
    const textResult = await textGenerationPrompt({
        baseImageUrl,
        afterImageUrl,
        userDirective,
        platform
    });

    if (!textResult.output) {
        throw new Error("L'IA n'a pas pu générer le texte du carrousel.");
    }
    const { hookText, conclusionText } = textResult.output;

    // Étape 3: Assembler les diapositives
    const slides = [
        { type: 'image', content: baseImageUrl, title: 'AVANT' },
        { type: 'text', content: hookText, title: 'LE POINT DE DÉPART' },
        { type: 'image', content: afterImageUrl, title: 'APRÈS' },
        { type: 'text', content: conclusionText, title: 'LA TRANSFORMATION' }
    ];

    return { slides };
  }
);
