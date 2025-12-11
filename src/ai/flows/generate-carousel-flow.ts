
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
  async ({ baseImageUrl, subjectPrompt, userDirective }) => {
    
    // --- APPEL 1: Génération du texte et de l'image "Après" ---
    const mainGeneration = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
            { media: { url: baseImageUrl } },
            { text: `
                **Rôle :** Tu es un directeur artistique expert, un retoucheur photo, et un social media manager. Ton but est de produire un résultat professionnel et flatteur.
                
                **Objectif :** En te basant sur l'image fournie, tu vas créer une histoire de transformation "Avant/Après" en 4 étapes sous forme de carrousel.

                **Instructions détaillées :**
                1.  **Analyse l'image de base.** Identifie sa nature (portrait, paysage, objet...). ${subjectPrompt ? `Le sujet principal est : ${subjectPrompt}.` : ''}
                
                2.  **Imagine la transformation :** 
                    ${userDirective 
                        ? `L'utilisateur a donné une directive claire : "${userDirective}". Ta transformation DOIT suivre cette instruction.`
                        : "Ta mission est d'embellir ce portrait. Apporte plus de lumière, rehausse les couleurs pour un éclat naturel et vibrant, améliore la netteté du regard et lisse subtilement la peau pour un résultat professionnel et esthétique."
                    }

                3.  **Génère une unique image "Après"** qui représente cette transformation de la manière la plus qualitative et flagrante possible. Le résultat doit être visiblement supérieur à l'original.
                
                4.  **Rédige 4 descriptions très courtes et percutantes** pour raconter cette histoire, une pour chaque étape du carrousel. Sépare chaque description par '---'.
                    *   **Description 1 (Avant) :** Décris le point de départ, l'image originale.
                    *   **Description 2 (Pendant) :** Explique brièvement ton défi créatif, la transformation que tu vas opérer.
                    *   **Description 3 (Après) :** Décris le résultat final, en mettant en valeur le bénéfice de la transformation.
                    *   **Description 4 (Question) :** Rédige une question ouverte et engageante liée à l'image ou à la transformation, pour inciter les commentaires.
            `},
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    });

    if (!mainGeneration.media || !mainGeneration.media.url || !mainGeneration.text) {
      throw new Error("L'IA n'a pas pu générer le contenu principal du carrousel.");
    }
    
    const descriptions = mainGeneration.text.split('---').map(d => d.trim());
    if (descriptions.length < 4) {
      throw new Error("L'IA n'a pas retourné les 4 descriptions attendues.");
    }
    
    const afterImageUrl = mainGeneration.media.url;

    // --- APPEL 2: Génération de l'image "Pendant" ---
    const duringGeneration = await ai.generate({
        model: 'googleai/imagen-4.0-fast-generate-001',
        prompt: `Crée une image conceptuelle et stylisée qui représente l'idée de "transformation créative" ou de "processus d'amélioration". Le style doit être graphique et moderne, avec des éléments comme des lignes d'énergie, des particules de lumière, ou des formes abstraites qui évoquent le changement. L'image doit être visuellement intéressante mais pas trop chargée, pour accompagner le texte : "${descriptions[1]}"`,
        config: { aspectRatio: '3:4' }
    });

    if (!duringGeneration.media || !duringGeneration.media.url) {
        throw new Error("L'IA n'a pas pu générer l'image 'Pendant'.");
    }
    const duringImageUrl = duringGeneration.media.url;

    // --- APPEL 3: Génération de l'image "Question" ---
    const questionGeneration = await ai.generate({
        model: 'googleai/imagen-4.0-fast-generate-001',
        prompt: `Crée une image graphique simple et élégante pour un post de réseau social. Au centre, sur un fond texturé subtil (comme du papier ou un mur de couleur neutre), écris en grosses lettres lisibles et stylées la question : "${descriptions[3]}". L'ambiance doit être engageante et inciter à la réponse.`,
        config: { aspectRatio: '3:4' }
    });

    if (!questionGeneration.media || !questionGeneration.media.url) {
        throw new Error("L'IA n'a pas pu générer l'image 'Question'.");
    }
    const questionImageUrl = questionGeneration.media.url;

    return {
        slides: [
            { imageUrl: baseImageUrl, description: descriptions[0] },
            { imageUrl: duringImageUrl, description: descriptions[1] },
            { imageUrl: afterImageUrl, description: descriptions[2] }, 
            { imageUrl: questionImageUrl, description: descriptions[3] },
        ]
    };
  }
);
