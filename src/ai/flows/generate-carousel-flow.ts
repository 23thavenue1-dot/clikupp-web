
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

    // --- APPEL 2: Génération des 4 descriptions textuelles en se basant sur les deux images ---
    const textGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: `
            **Rôle :** Tu es un social media manager expert en storytelling et copywriting pour ${platform || 'un réseau social'}. Ton ton est engageant, inspirant et naturel.
            
            **Mission :** En analysant la transformation entre l'image "Avant" et l'image "Après" fournies ci-dessous, rédige 4 textes courts et pertinents pour un carrousel. Tu DOIS adapter ton discours au sujet de l'image (paysage, portrait, objet...). Sépare chaque texte par "---".
            
            **Règle impérative :** Ne préfixe JAMAIS tes textes par "Texte 1:", "Description 2:" etc.

            **Images de Contexte :**
            - Image Avant : {{media url=baseImageUrl}}
            - Image Après : {{media url=afterImageUrl}}

            ---
            **Exemple pour un PAYSAGE :**
            Un paysage brut, plein de potentiel.
            ---
            Et si on lui donnait une lumière plus magique ?
            ---
            La magie opère. Chaque couleur explose, chaque détail prend vie.
            ---
            Cette nouvelle ambiance vous transporte où ?
            
            ---
            **Exemple pour un PORTRAIT :**
            Un simple regard, une histoire à raconter.
            ---
            L'idée : révéler le charisme qui est déjà là, sans le transformer.
            ---
            Lumière, contraste, confiance. Parfois, tout est une question de détails.
            ---
            Quel est le changement qui vous marque le plus ?

            ---
            **Exemple pour un OBJET :**
            Un objet du quotidien, une histoire à écrire.
            ---
            Et si on lui donnait vie dans une scène qui vous ressemble ?
            ---
            Le voilà, intégré à votre univers, prêt à vous accompagner.
            ---
            Qu'est-ce qu'il vous inspire de créer ou de vivre maintenant ?
        `,
        media: [
          { url: baseImageUrl },
          { url: afterImageUrl },
        ]
    });

    if (!textGeneration.text) {
        throw new Error("L'IA n'a pas pu générer les textes du carrousel.");
    }

    const descriptions = textGeneration.text.split('---').map(d => d.replace(/^\*+ *(?:Description|Texte) \d+[^:]*:[ \n]*/i, '').trim());

    if (descriptions.length < 4) {
      throw new Error("L'IA n'a pas retourné les 4 descriptions attendues.");
    }
    
    // Pas de génération d'image pour les textes, on retourne null.
    // L'image sera construite côté client.
    return {
        slides: [
            { imageUrl: baseImageUrl, description: descriptions[0] },
            { imageUrl: null, description: descriptions[1] },
            { imageUrl: afterImageUrl, description: descriptions[2] }, 
            { imageUrl: null, description: descriptions[3] },
        ]
    };
  }
);

    