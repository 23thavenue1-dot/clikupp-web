'use server';
/**
 * @fileOverview Flow Genkit pour l'animation d'une image statique en vidéo (Story Animée).
 */

import { ai } from '@/ai/genkit';
import { AnimateStoryInputSchema, AnimateStoryOutputSchema, type AnimateStoryInput, type AnimateStoryOutput } from '@/ai/schemas/story-animation-schemas';
import { MediaPart } from 'genkit';


// Helper function to download the video and convert to data URI
async function downloadAndEncodeVideo(videoPart: MediaPart): Promise<string> {
    if (!videoPart?.media?.url || !videoPart?.media?.contentType) {
        throw new Error('Media part invalide pour la vidéo.');
    }

    const fetch = (await import('node-fetch')).default;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("La clé d'API GEMINI_API_KEY est manquante dans les variables d'environnement.");
    }
    
    const videoDownloadUrl = `${videoPart.media.url}&key=${apiKey}`;
    
    const response = await fetch(videoDownloadUrl);

    if (!response.ok || !response.body) {
        throw new Error(`Échec du téléchargement de la vidéo: ${response.statusText}`);
    }

    const videoBuffer = await response.buffer();
    const base64Video = videoBuffer.toString('base64');
    return `data:${videoPart.media.contentType};base64,${base64Video}`;
}


export async function animateStory(input: AnimateStoryInput): Promise<AnimateStoryOutput> {
  return animateStoryFlow(input);
}


const animateStoryFlow = ai.defineFlow(
  {
    name: 'animateStoryFlow',
    inputSchema: AnimateStoryInputSchema,
    outputSchema: AnimateStoryOutputSchema,
  },
  async ({ imageUrl, prompt, aspectRatio }) => {
    
    let { operation } = await ai.generate({
        model: 'googleai/veo-2.0-generate-001',
        prompt: [
            { media: { url: imageUrl } },
            { text: prompt },
        ],
        config: {
            durationSeconds: 5,
            aspectRatio: aspectRatio || '9:16',
        },
    });

    if (!operation) {
        throw new Error("Le modèle n'a pas retourné d'opération pour la génération vidéo.");
    }

    // Polling loop to wait for the operation to complete
    while (!operation.done) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        operation = await ai.checkOperation(operation);
    }

    if (operation.error) {
        console.error("Erreur de l'opération Veo:", operation.error);
        throw new Error(`La génération de la vidéo a échoué: ${operation.error.message}`);
    }

    const video = operation.output?.message?.content.find((p) => !!p.media && p.media.contentType?.startsWith('video/'));
    
    if (!video) {
        const errorDetails = JSON.stringify(operation.output, null, 2);
        console.error("Résultat de l'opération inattendu:", errorDetails);
        throw new Error("Aucune vidéo n'a été trouvée dans le résultat de l'opération. L'IA a peut-être refusé de générer le contenu.");
    }

    const videoDataUri = await downloadAndEncodeVideo(video);

    return {
      videoUrl: videoDataUri,
    };
  }
);
