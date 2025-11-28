'use server';
/**
 * @fileOverview Flow Genkit pour la génération de vidéo à partir d'un prompt textuel.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { MediaPart } from 'genkit';
import { Readable } from 'stream';

const GenerateVideoInputSchema = z.object({
  prompt: z.string().min(3).describe("L'instruction en langage naturel pour créer la vidéo."),
  aspectRatio: z.string().optional().describe("Le ratio d'aspect de la vidéo (ex: '16:9', '9:16', '1:1')."),
  durationSeconds: z.number().min(1).max(8).optional().describe("La durée de la vidéo en secondes."),
});
export type GenerateVideoInput = z.infer<typeof GenerateVideoInputSchema>;

const GenerateVideoOutputSchema = z.object({
  videoUrl: z.string().describe("L'URL de la vidéo générée, encodée en data URI (base64)."),
});
export type GenerateVideoOutput = z.infer<typeof GenerateVideoOutputSchema>;

// Helper function to download the video and convert to data URI
async function downloadAndEncodeVideo(videoPart: MediaPart): Promise<string> {
    if (!videoPart?.media?.url || !videoPart?.media?.contentType) {
        throw new Error('Media part invalide pour la vidéo.');
    }

    const fetch = (await import('node-fetch')).default;
    // La clé API doit être ajoutée pour télécharger la vidéo depuis l'URL temporaire de Google
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("La clé d'API GEMINI_API_KEY est manquante dans les variables d'environnement.");
    }
    
    const videoDownloadUrl = `${videoPart.media.url}&key=${apiKey}`;
    
    const response = await fetch(videoDownloadUrl);

    if (!response.ok || !response.body) {
        throw new Error(`Échec du téléchargement de la vidéo: ${response.statusText}`);
    }

    // Lire le corps de la réponse en tant que buffer
    const videoBuffer = await response.buffer();

    // Encoder en base64 et créer le data URI
    const base64Video = videoBuffer.toString('base64');
    return `data:${videoPart.media.contentType};base64,${base64Video}`;
}


export async function generateVideo(input: GenerateVideoInput): Promise<GenerateVideoOutput> {
  return generateVideoFlow(input);
}

const generateVideoFlow = ai.defineFlow(
  {
    name: 'generateVideoFlow',
    inputSchema: GenerateVideoInputSchema,
    outputSchema: GenerateVideoOutputSchema,
  },
  async ({ prompt, aspectRatio, durationSeconds }) => {
    
    let { operation } = await ai.generate({
        model: 'googleai/veo-2.0-generate-001',
        prompt: prompt,
        config: {
            durationSeconds: durationSeconds || 5,
            aspectRatio: aspectRatio || '9:16',
        },
    });

    if (!operation) {
        throw new Error("Le modèle n'a pas retourné d'opération pour la génération vidéo.");
    }

    // Boucle de polling pour attendre la fin de l'opération
    while (!operation.done) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Attendre 5 secondes
        operation = await ai.checkOperation(operation);
    }

    if (operation.error) {
        console.error("Erreur de l'opération Veo:", operation.error);
        throw new Error(`La génération de la vidéo a échoué: ${operation.error.message}`);
    }

    const video = operation.output?.message?.content.find((p) => !!p.media && p.media.contentType?.startsWith('video/'));
    if (!video) {
        throw new Error("Aucune vidéo n'a été trouvée dans le résultat de l'opération.");
    }

    const videoDataUri = await downloadAndEncodeVideo(video);

    return {
      videoUrl: videoDataUri,
    };
  }
);

// Augmenter le timeout pour les actions de serveur Next.js qui utilisent ce flow.
// La génération vidéo peut être longue.
export const maxDuration = 120; // 2 minutes
