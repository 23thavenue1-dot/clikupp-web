# Plan de Conception : Audit de Profil par l'IA ("Coach Stratégique")

Ce document détaille la conception et l'implémentation de la fonctionnalité "Coach Stratégique", un outil d'audit de profil par l'IA pour les créateurs de contenu.

---

## 1. Objectif de la Fonctionnalité

Permettre à un utilisateur de soumettre son profil de réseau social (via une sélection de contenus) à une analyse par IA afin d'obtenir un rapport complet et actionnable pour améliorer son identité de marque, sa stratégie de contenu et son engagement.

---

## 2. Parcours Utilisateur (UX) - Implémenté

L'expérience a été conçue comme un **assistant guidé** (wizard), simple et intuitif, qui se déroule en plusieurs étapes claires.

### Étape A : Le Point d'Entrée

1.  **Nouvel Élément de Navigation :** Un lien "Coach Stratégique" a été ajouté dans la barre de navigation principale.
2.  **Redirection :** Ce lien redirige l'utilisateur vers la page `/audit`.

### Étape B : L'Assistant d'Analyse (`/audit/page.tsx`)

Cette page est le cœur de l'assistant, structurée comme un formulaire en plusieurs étapes :

*   **Étape 1 : Sélection du Profil de Marque**
    *   L'utilisateur choisit un "Profil de Marque" existant (client, projet) ou en crée un nouveau. Cela permet d'organiser les audits.

*   **Étape 2 : Définition du Contexte**
    *   Un `Select` pour choisir la plateforme (Instagram, TikTok, etc.).
    *   Un `Select` où l'utilisateur choisit son objectif principal (Augmenter l'engagement, Professionnaliser l'image, etc.).

*   **Étape 3 : Identité Visuelle (Analyse de Style)**
    *   L'utilisateur sélectionne entre 6 et 9 images dans sa galerie Clikup qui représentent son style actuel.

*   **Étape 4 : Identité Visuelle (Analyse du Sujet)**
    *   (Optionnel) L'utilisateur sélectionne jusqu'à 5 portraits clairs de lui-même ou du sujet principal pour que l'IA puisse "apprendre" son apparence.

*   **Étape 5 : Identité Rédactionnelle**
    *   (Optionnel) L'utilisateur peut coller le texte de quelques publications et ajouter un contexte libre pour affiner l'analyse.
    
*   **Étape 6 : Lancement**
    *   Un récapitulatif est présenté, et un bouton "Lancer l'analyse" (coût : 5 tickets IA) démarre le processus, avec une animation de chargement.

### Étape C : La Page de Rapport (`/audit/resultats/[auditId]/page.tsx`)

Une fois l'analyse terminée, l'utilisateur est redirigé vers une page de rapport dédiée, conçue pour être claire, lisible et inspirante.

*   **Structure :** Utilisation de composants `Card` pour chaque section du rapport (Identité Visuelle, Analyse Stratégique, Stratégie de Contenu, Plan d'Action).
*   **Passez à l'action :** La page inclut une section interactive "Passez à l'action" qui permet à l'utilisateur de :
    1.  Générer de nouvelles idées de contenu basées sur l'audit.
    2.  Utiliser ces idées comme "prompts" pour générer de nouvelles images avec l'IA.
    3.  Sauvegarder ces nouvelles créations en tant que brouillon ou les programmer directement dans le Planificateur de Contenu.

---

## 3. Implémentation Technique (Réalisée)

### a) Nouveau Flow Genkit (`src/ai/flows/social-audit-flow.ts`)

*   **Input Schema (Zod) :** Le flow accepte la plateforme, l'objectif, les URLs des images de style, les URLs (optionnelles) des images du sujet, et le contexte textuel.
*   **Output Schema (Zod) :** Le flow retourne un objet structuré contenant toutes les sections du rapport, y compris les suggestions de prompts créatifs.
*   **Prompt :** Un prompt maître très détaillé instruit l'IA d'agir comme un coach en stratégie de contenu, de prendre en compte l'apparence du sujet si fournie, et de structurer sa réponse selon le schéma de sortie défini.

### b) Nouvelles Pages React

*   `src/app/audit/page.tsx` : La page principale de l'assistant.
*   `src/app/audit/resultats/[auditId]/page.tsx` : La page qui affiche le rapport et permet de générer/planifier du nouveau contenu.
*   `src/app/audit/history/page.tsx` : Une page pour consulter l'historique de tous les rapports générés.

### c) Modèle de Données

*   Les résultats de chaque audit sont sauvegardés dans une sous-collection `/users/{userId}/audits/{auditId}`.
*   Les "Profils de Marque" sont sauvegardés dans `/users/{userId}/brandProfiles/{brandProfileId}`.
*   Les publications planifiées sont sauvegardées dans `/users/{userId}/scheduledPosts/{postId}`.
