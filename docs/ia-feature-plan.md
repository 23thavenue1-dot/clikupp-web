# Plan de Développement Technique : Intégration de l'IA

Ce document détaille les étapes techniques qui ont permis de transformer "Clikup" en un assistant de contenu intelligent.

## Phase 1 : Génération de Description par IA (Terminé)

**Objectif :** Permettre à l'IA de générer une description, un titre et des hashtags pour une image, afin d'enrichir le contenu.

**Technologies Clés :**
*   **Genkit** : Pour créer le flow d'IA.
*   **Modèle Gemini** : Pour l'analyse d'image et la génération de texte.

**État :** Terminé. Le flow `generateImageDescriptionFlow` est fonctionnel et intégré à plusieurs endroits de l'interface (depuis la galerie, depuis le hub de création, depuis la page de détail). Le système de tickets IA est également en place pour réguler son utilisation.

## Phase 2 : Retouche d'Image par IA (Terminé)

**Objectif :** Permettre à l'utilisateur de modifier une image en décrivant les changements en langage naturel.

**Technologies Clés :**
*   **Genkit**
*   **Modèles d'édition d'image de Gemini** (`gemini-2.5-flash-image-preview`).

**État :** Terminé. L'ensemble de la fonctionnalité, incluant le flow Genkit, la page d'édition, la comparaison avant/après et les suggestions de prompts, est pleinement opérationnel.

## Phase 3 : Génération d'Images et de Vidéos (Terminé)

**Objectif :** Permettre la création de médias originaux à partir d'un simple texte.

**Technologies Clés :**
*   **Genkit**
*   **Modèles de génération d'image** (`imagen-4.0-fast-generate-001`) et de **vidéo** (`veo-2.0-generate-001`).

**État :** Terminé. Les flows `generateImageFlow` et `generateVideoFlow` sont intégrés dans le composant "Uploader", permettant une création de contenu multimédia directement depuis la page d'accueil.

## Phase 4 : Le Coach Stratégique IA (Terminé)

**Objectif :** Fournir une analyse stratégique complète d'un profil de créateur.

**Technologies Clés :**
*   **Genkit** et **Gemini** (capacités multimodales).
*   Architecture "wizard" en plusieurs étapes pour la collecte d'informations.

**État :** Terminé. Le "Coach Stratégique" est une fonctionnalité majeure et aboutie, qui guide l'utilisateur de la sélection de son contenu (images, textes) jusqu'à la génération d'un rapport complet et la création de suggestions de posts.

## Phase 5 : Intégration avec le Planificateur (Terminé)

**Objectif :** Créer une synergie entre l'analyse IA et la planification de contenu.

**État :** Terminé. Les idées de contenu générées par le Coach Stratégique peuvent être sauvegardées en tant que brouillons ou programmées directement dans le Planificateur, créant ainsi un flux de travail cohérent, de l'idéation à la publication planifiée.
