
'use server';
/**
 * @fileOverview Flow Genkit pour la génération de carrousels d'images en 4 étapes.
 */

import { ai } from '@/ai/genkit';
import { GenerateCarouselInputSchema, GenerateCarouselOutputSchema, type GenerateCarouselInput, type GenerateCarouselOutput } from '@/ai/schemas/carousel-schemas';


export async function generateCarousel(input: GenerateCarouselInput): Promise<GenerateCarouselOutput> {
  return generateCarouselFlow(input);
}


const generateCarouselFlow = ai.defineFlow(
  {
    name: 'generateCarouselFlow',
    inputSchema: GenerateCarouselInputSchema,
    outputSchema: GenerateCarouselOutputSchema,
  },
  async ({ baseImageUrl, subjectPrompt, userDirective, platform }) => {
    
    // --- APPEL 1: Génération de l'image "Après" ---
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
                    : `Tu dois analyser l'image "Avant" et appliquer la transformation la plus pertinente.
                      - **Si l'image est un portrait :** Ta mission est de réaliser une transformation radicale. 1. Augmente la qualité globale de l'image : contraste, luminosité, définition. 2. Ton équipe installe un éclairage de studio professionnel avec des effets de lumière subtils pour sculpter le visage. 3. Ton retoucheur corrige les imperfections de la peau (acné, rougeurs) pour un teint unifié, tout en conservant une texture naturelle. 4. Assure-toi que les couleurs sont riches et vibrantes. 5. Le sujet doit rester parfaitement reconnaissable, mais le résultat doit être visiblement optimisé.
                      - **Si l'image est une pièce d'intérieur :** Ta mission est double. 1. D'abord, range la pièce pour qu'elle paraisse propre et ordonnée. 2. Ensuite, ajoute subtilement 2 ou 3 éléments de décoration tendance (ex: une plante verte, une bougie, un livre d'art) pour créer une ambiance zen et minimaliste. Améliore l'éclairage pour que la pièce soit plus accueillante.
                      - **Si l'image met en valeur un objet :** Ta mission est de créer une mise en scène "lifestyle" inspirante et réaliste pour vendre le produit. Intègre l'objet dans un décor quotidien qui correspond à son usage le plus courant (par exemple, un sac à main sur l'épaule d'une personne dans une rue chic, un carnet sur un bureau design, une montre au poignet). L'éclairage doit être naturel et flatteur, créant une ambiance authentique et désirable. Assure-toi que l'objet reste le point focal de l'image tout en s'intégrant naturellement dans son environnement. Le résultat doit donner envie de posséder l'objet.
                      - **Si l'image est un paysage :**
                        - **Si c'est une photo de jour :** Ta mission est de la transformer en une scène de **coucher de soleil spectaculaire**. Modifie le ciel avec des couleurs chaudes et magnifiques (oranges, roses, violets), ajuste l'éclairage global pour refléter la lumière dorée du soir et crée des reflets saisissants sur les surfaces comme l'eau ou les bâtiments. Le résultat doit être époustouflant et radicalement différent de l'original.
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

    // --- APPEL 2: Génération des descriptions pour les diapos 1 et 3 ---
    const textGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: `
            **Rôle :** Tu es un social media manager expert en storytelling et copywriting pour ${platform || 'un réseau social'}.
            
            **Mission :** En analysant la transformation entre l'image "Avant" et l'image "Après" fournies, rédige 2 textes courts et pertinents.
            
            **Règle impérative :** Sépare chaque texte par "---". Ne préfixe JAMAIS tes textes par des numéros.
            - **Texte 1 :** Décris l'image "Avant" de manière factuelle et courte.
            - **Texte 2 :** Décris l'émotion ou le bénéfice de l'image "Après".

            **Images de Contexte :**
            - Image Avant : {{media url=baseImageUrl}}
            - Image Après : {{media url=afterImageUrl}}

            ---
            **Exemple :**
            Un paysage brut, plein de potentiel.
            ---
            La magie opère. Chaque couleur explose, chaque détail prend vie.
        `,
        media: [
          { url: baseImageUrl },
          { url: afterImageUrl },
        ]
    });

    if (!textGeneration.text) {
        throw new Error("L'IA n'a pas pu générer les textes du carrousel.");
    }

    const descriptions = textGeneration.text.split('---').map(d => d.trim());
    if (descriptions.length < 2) {
      throw new Error("L'IA n'a pas retourné les 2 descriptions attendues.");
    }
    
    return {
        slides: [
            { imageUrl: baseImageUrl, description: descriptions[0] },
            { imageUrl: null, description: "" }, // Diapo 2 vide
            { imageUrl: afterImageUrl, description: descriptions[1] }, 
            { imageUrl: null, description: "" }, // Diapo 4 vide
        ]
    };
  }
);
