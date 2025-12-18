
'use server';

import { ai } from '@/ai/genkit';
import { type ChatbotOutput, ChatbotInputSchema } from '@/ai/schemas/chatbot-schemas';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// --- Définition des Outils ---

const createGalleryTool = ai.defineTool(
  {
    name: 'createGallery',
    description: "Crée un nouvel album ou une nouvelle galerie d'images pour l'utilisateur.",
    inputSchema: z.object({
      name: z.string().describe("Le nom de la galerie à créer."),
    }),
    outputSchema: z.string(),
  },
  async ({ name }, { auth }) => {
    const userId = auth?.uid;
    if (!userId) {
      return "Erreur d'identification. Impossible de créer la galerie.";
    }
    
    const db = admin.firestore();
    try {
      const galleriesCollectionRef = db.collection('users').doc(userId).collection('galleries');
      const docRef = await galleriesCollectionRef.add({ 
        userId, 
        name, 
        description: '', 
        imageIds: [], 
        pinnedImageIds: [], 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      await docRef.update({ id: docRef.id });
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
    inputSchema: z.object({}), // Pas besoin d'input, l'userId vient du contexte
    outputSchema: z.string(),
  },
  async (_, { auth }) => {
     const userId = auth?.uid;
    if (!userId) {
      return "Erreur d'identification. Impossible de lister les galeries.";
    }
    
    const db = admin.firestore();
    try {
      const galleriesRef = db.collection(`users/${userId}/galleries`);
      const q = galleriesRef.orderBy('createdAt', 'desc');
      const querySnapshot = await q.get();
      
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

const addImageToGalleryTool = ai.defineTool(
  {
    name: 'addImageToGallery',
    description: "Ajoute une image existante à une galerie existante.",
    inputSchema: z.object({
      imageName: z.string().describe("Le nom (titre ou nom de fichier) de l'image à ajouter."),
      galleryName: z.string().describe("Le nom de la galerie de destination."),
    }),
    outputSchema: z.string(),
  },
  async ({ imageName, galleryName }, { auth }) => {
    const userId = auth?.uid;
    if (!userId) {
        return "Erreur critique : L'ID utilisateur est manquant pour l'outil.";
    }
    
    const db = admin.firestore();
    try {
      const galleriesRef = db.collection(`users/${userId}/galleries`);
      const galleryQuery = galleriesRef.where('name', '==', galleryName).limit(1);
      const gallerySnapshot = await galleryQuery.get();
      if (gallerySnapshot.empty) {
        return `Désolé, je n'ai pas trouvé de galerie nommée "${galleryName}". Voulez-vous que je la crée ? Vous pouvez aussi me demander de lister vos galeries.`;
      }
      const galleryDoc = gallerySnapshot.docs[0];

      const imagesRef = db.collection(`users/${userId}/images`);
      let imageQuery = imagesRef.where('title', '==', imageName).limit(1);
      let imageSnapshot = await imageQuery.get();
      if (imageSnapshot.empty) {
          imageQuery = imagesRef.where('originalName', '==', imageName).limit(1);
          imageSnapshot = await imageQuery.get();
      }
      if (imageSnapshot.empty) {
        return `Désolé, je n'ai pas trouvé d'image nommée "${imageName}". Assurez-vous que le nom est correct.`;
      }
      const imageDoc = imageSnapshot.docs[0];

      await galleryDoc.ref.update({
          imageIds: admin.firestore.FieldValue.arrayUnion(imageDoc.id)
      });

      return `C'est fait ! L'image "${imageName}" a été ajoutée à la galerie "${galleryName}".`;

    } catch (error) {
      console.error("Erreur de l'outil addImageToGallery:", error);
      return `Désolé, une erreur est survenue lors de l'ajout de l'image.`;
    }
  }
);


export const askChatbot = ai.defineFlow(
  {
    name: 'askChatbotFlow',
    inputSchema: ChatbotInputSchema,
    outputSchema: z.object({ content: z.string() }),
    auth: {
      // Cette politique attend un ID Token et le vérifie.
      // Le `uid` sera disponible dans le `auth` du contexte de l'outil.
      // @ts-ignore
      policy: async (token) => {
        if (admin.apps.length === 0) {
          admin.initializeApp();
        }
        const decodedToken = await admin.auth().verifyIdToken(token);
        return { uid: decodedToken.uid, email: decodedToken.email };
      }
    }
  },
  async (input) => {
    const { history } = input;
    
    const historyPrompt = history
      .map(message => `${message.role}: ${message.content}`)
      .join('\n');
      
    const fullPrompt = `${historyPrompt}\nassistant:`;

    const llmResponse = await ai.generate({
      prompt: fullPrompt,
      system: `You are a helpful and friendly assistant for an application called Clikup. Your goal is to answer user questions, guide them, and perform actions on their behalf using the tools you have available.

- **Listen to the user's need, not just their words.** If a user asks "quels sont mes albums ?", use the listGalleries tool. If they say "je veux vendre plus", recommend the "E-commerce" description generation. If they say "je suis à court d'idées", recommend the "Coach Stratégique".
- **Use your tools when appropriate.** When you decide to use a tool, you will be given an authenticated user context.
- **Clarify if needed.** If a tool requires information the user hasn't provided, ask for the missing details.
- **Confirm your actions.** After using a tool, present the result clearly to the user.
- **Be concise and helpful.**

---
## DOCUMENTATION CLIKUP & OUTILS DISPONIBLES

### Outils disponibles
- **createGallery(name: string):** Utilise cet outil pour créer un nouvel album ou une galerie.
- **listGalleries():** Utilise cet outil pour lister les galeries de l'utilisateur.
- **addImageToGallery(imageName: string, galleryName: string):** Ajoute une image à une galerie.

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
- **Boutique:** Achetez des packs de tickets (Upload ou IA) ou des abonnements pour augmenter vos quotas.`,
      model: 'googleai/gemini-2.5-flash',
      tools: [createGalleryTool, listGalleriesTool, addImageToGalleryTool],
    });

    const toolRequest = llmResponse.toolRequest;
    if (toolRequest) {
      // Genkit gère automatiquement l'appel de l'outil ici,
      // et le `auth` contexte sera fourni à l'outil.
      const toolResponse = await llmResponse.performToolRequest(toolRequest);
      return { content: toolResponse as string };
    }

    return { content: llmResponse.text };
  }
);
