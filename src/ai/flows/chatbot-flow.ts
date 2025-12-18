
'use server';

import { ai } from '@/ai/genkit';
import { type ChatbotOutput, type ChatbotInput } from '@/ai/schemas/chatbot-schemas';
import { initializeFirebase } from '@/firebase';
import { createGallery } from '@/lib/firestore';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';

const createGalleryTool = ai.defineTool(
  {
    name: 'createGallery',
    description: "Crée un nouvel album ou une nouvelle galerie d'images pour l'utilisateur.",
    inputSchema: z.object({
      name: z.string().describe("Le nom de la galerie à créer."),
    }),
    outputSchema: z.string(),
  },
  async ({ name }, context) => {
    // IMPORTANT: Accéder au userId passé dans le contexte du flow
    const userId = context?.auth?.userId;
    if (!userId) {
      return "Erreur : Je ne parviens pas à vous identifier pour créer la galerie.";
    }

    const { firestore } = initializeFirebase();
    try {
      await createGallery(firestore, userId, name);
      return `Galerie "${name}" créée avec succès.`;
    } catch (error) {
      console.error("Erreur de l'outil createGallery:", error);
      return `Désolé, je n'ai pas pu créer la galerie "${name}". Une erreur est survenue.`;
    }
  }
);


const listGalleriesTool = ai.defineTool(
  {
    name: 'listGalleries',
    description: "Récupère et liste toutes les galeries créées par l'utilisateur.",
    inputSchema: z.object({}), // Pas d'input nécessaire
    outputSchema: z.string(),
  },
  async (_, context) => {
    const userId = context?.auth?.userId;
    if (!userId) {
      return "Erreur : Je ne parviens pas à vous identifier pour lister les galeries.";
    }

    const { firestore } = initializeFirebase();
    try {
      const galleriesRef = collection(firestore, `users/${userId}/galleries`);
      const q = query(galleriesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return "Vous n'avez aucune galerie pour le moment.";
      }
      
      const galleryNames = querySnapshot.docs.map(doc => `- ${doc.data().name}`);
      return `Voici la liste de vos galeries :\n${galleryNames.join('\n')}`;
    } catch (error) {
      console.error("Erreur de l'outil listGalleries:", error);
      return "Désolé, je n'ai pas pu récupérer la liste de vos galeries.";
    }
  }
);


export async function askChatbot(input: ChatbotInput): Promise<ChatbotOutput> {
  const historyPrompt = input.history
    .map(message => `${message.role}: ${message.content}`)
    .join('\n');

  const fullPrompt = `
Conversation History:
${historyPrompt}
assistant:
  `;

  const llmResponse = await ai.generate({
    prompt: fullPrompt,
    system: `You are a helpful and friendly assistant for an application called Clikup. Your goal is to answer user questions, guide them, and perform actions on their behalf using the tools you have available.

- **Listen to the user's need, not just their words.** If a user asks "quels sont mes albums ?", use the listGalleries tool. If they say "je veux vendre plus", recommend the "E-commerce" description generation. If they say "je suis à court d'idées", recommend the "Coach Stratégique".
- **Use your tools when appropriate.** If a user asks to create something, use the createGallery tool. If they ask to see their albums, use listGalleries.
- **Confirm your actions.** After using a tool, present the result clearly to the user.
- **Be concise and helpful.**

---
## DOCUMENTATION CLIKUP & OUTILS DISPONIBLES

### Outils
- **createGallery(name: string):** Utilise cet outil pour créer un nouvel album ou une galerie.
- **listGalleries():** Utilise cet outil pour lister les noms de toutes les galeries de l'utilisateur.

### 1. Gestion des Médias
- **Organisation:** Créez des **Galeries** pour classer les images. L'accueil montre toutes les images. Possibilité d'épingler les favoris.
- **Mode Sélection:** Permet des actions groupées (supprimer, ajouter aux galeries).
- **Partage:** Liens de partage (URL, BBCode, HTML) sur la page de détail de chaque image.

### 2. Création par IA
- **Génération d'Image ('Image IA'):** Créez des images à partir d'un texte.
- **Éditeur d'Image IA:** Modifiez une image en décrivant les changements en langage naturel.
- **Post Magique:** Transformez une image en **Carrousel** "Avant/Après" ou en **Story Animée**.
- **Génération de Description:** L'IA rédige titre, description et hashtags optimisés pour **Instagram, E-commerce,** etc.

### 3. Stratégie de Contenu
- **Coach Stratégique:** Outil d'analyse de profil social qui génère un rapport complet (identité visuelle, plan d'action, 14 jours de suggestions de contenu). Nécessite de créer des "Profils de Marque". Accessible via le menu ou \`/audit\`.
- **Planificateur:** Calendrier pour programmer vos publications ou les sauvegarder en brouillons. Accessible via le menu ou \`/planner\`.

### 4. Profil & Boutique
- **Tableau de Bord:** Suivi de votre progression (niveau, XP, succès). Débloque des "Tips de Créateur".
- **Boutique:** Achetez des packs de tickets (Upload ou IA) ou des abonnements pour augmenter vos quotas.
---`,
    model: 'googleai/gemini-2.5-flash',
    tools: [createGalleryTool, listGalleriesTool],
    context: { auth: { userId: input.userId, authenticated: true } },
  });

  return { content: llmResponse.text };
}
