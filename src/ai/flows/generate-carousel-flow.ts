
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
                      - **Si l'image met en valeur un objet :** Ta mission est de créer un "packshot" de qualité e-commerce. 1. Détoure parfaitement l'objet pour le séparer de son arrière-plan. 2. Place-le sur un fond uni, moderne et neutre (par exemple, un gris clair #f0f0f0). 3. Ajoute une ombre portée réaliste et douce sous l'objet pour lui donner du volume et un aspect professionnel. 4. Applique un éclairage de studio qui met en valeur la texture du produit sans créer de reflets parasites.
                      - **Si l'image est un paysage ou autre chose :** Ta mission est d'améliorer la qualité technique et esthétique de l'image. Augmente la clarté, le contraste, et la vibrance des couleurs. Optimise l'éclairage global pour rendre la scène plus impactante et professionnelle. Le sujet doit rester le même, mais le résultat doit être visiblement optimisé.`
                }
            `},
        ],
        config: {
            responseModalities: ['IMAGE'],
        },
    });

    if (!afterImageGeneration.media || !afterImageGeneration.media.url) {
      throw new Error("L'IA n'a pas pu générer l'image 'Après'.");
    }
    const afterImageUrl = afterImageGeneration.media.url;

    // --- APPEL 2: Génération des 4 descriptions textuelles ---
    const textGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: `
            **Rôle :** Tu es un social media manager expert en storytelling pour ${platform || 'un réseau social'}.
            **Objectif :** Rédige 4 descriptions très courtes et percutantes pour un carrousel "Avant/Après". Sépare chaque description par '---'.
            
            **Règle impérative :** Ne préfixe JAMAIS tes descriptions par "Description 1", "Texte 2:", "**Texte 3:**" etc. Le ton doit être engageant et adapté à ${platform || 'un réseau social'}.
            
            **Contexte :**
            - Image Avant : Une photo de base.
            - Image Après : La même photo, mais améliorée et plus professionnelle.
            - Directive de l'utilisateur : "${userDirective || "Améliorer l'image pour un résultat professionnel et esthétique."}"
            
            **Descriptions à rédiger :**
            *   **Description 1 (Avant) :** Décris le point de départ, l'image originale. Sois factuel mais intriguant.
            *   **Description 2 (Pendant) :** Explique brièvement le défi créatif, la transformation qui va être opérée. Crée du suspense.
            *   **Description 3 (Après) :** Décris le résultat final, en mettant en valeur le bénéfice de la transformation. Utilise un ton enthousiaste.
            *   **Description 4 (Question) :** Rédige une question ouverte et engageante liée à l'image ou à la transformation, pour inciter les commentaires (style Instagram).
        `
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
