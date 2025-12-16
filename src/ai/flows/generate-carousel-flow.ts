'use server';
/**
 * @fileOverview Flow Genkit pour l'optimisation d'image en 1-clic pour les plateformes sociales.
 */

import { ai } from '@/ai/genkit';
import { GenerateCarouselInputSchema, OptimizedImageOutputSchema, type GenerateCarouselInput, type OptimizeImageOutput } from '@/ai/schemas/carousel-schemas';


export async function optimizeImage(input: GenerateCarouselInput): Promise<OptimizeImageOutput> {
  return optimizeImageFlow(input);
}


const optimizeImageFlow = ai.defineFlow(
  {
    name: 'optimizeImageFlow',
    inputSchema: GenerateCarouselInputSchema,
    outputSchema: OptimizedImageOutputSchema,
  },
  async ({ baseImageUrl, subjectPrompt, userDirective, platform }) => {
    
    const afterImageGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Contexte :** L'image fournie est une photo "Avant", souvent de type amateur. Pour l'image "Après" que tu vas créer, tu incarnes un photographe et directeur artistique de renom avec son équipe de professionnels (styliste, éclairagiste, retoucheur, décorateur d'intérieur) qui prend le relais.
                
                **Objectif :** Transformer cette photo amateur en une photo spectaculaire et de haute qualité, comme si elle sortait d'un studio professionnel. La différence doit être flagrante.
                ${subjectPrompt ? `Le sujet principal est : ${subjectPrompt}.` : ''}

                **Instruction de transformation :** 
                ${userDirective 
                    ? `L'utilisateur a donné une directive claire : "${userDirective}". Ton équipe et toi DEVEZ suivre cette instruction à la lettre.`
                    : `Tu dois analyser l'image "Avant" et appliquer la transformation la plus pertinente et optimisée pour la plateforme "${platform}".
                      - **Pour Instagram et Facebook :** Privilégie des couleurs vibrantes, un contraste élevé et une image qui attire l'œil immédiatement.
                      - **Pour LinkedIn :** Vise un rendu plus sobre, professionnel, avec un éclairage de type studio et des couleurs neutres.
                      - **Si l'image est un portrait :** Ta mission est de réaliser une transformation radicale. 1. Augmente la qualité globale de l'image : contraste, luminosité, définition. 2. Ton équipe installe un éclairage de studio professionnel avec des effets de lumière subtils pour sculpter le visage. 3. Ton retoucheur corrige les imperfections de la peau (acné, rougeurs) pour un teint unifié, tout en conservant une texture naturelle. 4. Assure-toi que les couleurs sont riches et vibrantes. 5. Le sujet doit rester parfaitement reconnaissable, mais le résultat doit être visiblement optimisé.
                      - **Si l'image est une pièce d'intérieur :** Ta mission est double. 1. D'abord, range la pièce pour qu'elle paraisse propre et ordonnée. 2. Ensuite, ajoute subtilement 2 ou 3 éléments de décoration tendance (ex: une plante verte, une bougie, un livre d'art) pour créer une ambiance zen et minimaliste. Améliore l'éclairage pour que la pièce soit plus accueillante.
                      - **Si l'image met en valeur un objet :** Ta mission est de créer une mise en scène "lifestyle" inspirante et réaliste pour vendre le produit. Intègre l'objet dans un décor quotidien qui correspond à son usage le plus courant (par exemple, un sac à main sur l'épaule d'une personne dans une rue chic, un carnet sur un bureau design, une montre au poignet). L'éclairage doit être naturel et flatteur, créant une ambiance authentique et désirable. Assure-toi que l'objet reste le point focal de l'image tout en s'intégrant naturellement dans son environnement. Le résultat doit donner envie de posséder l'objet.
                      - **Si l'image est un paysage de jour :** Ta mission est de la transformer en une scène de **coucher de soleil spectaculaire**. Modifie le ciel avec des couleurs chaudes et magnifiques (oranges, roses, violets), ajuste l'éclairage global pour refléter la lumière dorée du soir et crée des reflets saisissants sur les surfaces comme l'eau ou les bâtiments. Le résultat doit être époustouflant et radicalement différent de l'original.
                      - **Si c'est déjà une photo de nuit ou de coucher de soleil :** Ta mission est de sublimer la scène en adoptant un cadrage très professionnel. Élargis légèrement le plan pour donner un sentiment plus panoramique et spacieux. Applique des règles de composition photographique (comme la règle des tiers ou les lignes directrices) pour guider le regard. Tout en gardant la scène reconnaissable, améliore la lumière, le contraste et la richesse des couleurs pour un rendu spectaculaire.`
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

    return {
        optimizedImageUrl: afterImageUrl,
    };
  }
);