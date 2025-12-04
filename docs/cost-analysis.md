# Analyse des Coûts et Stratégie de Monétisation pour Clikup

Ce document détaille les coûts opérationnels associés aux fonctionnalités de Clikup et établit une stratégie de monétisation claire pour un modèle économique viable et compétitif.

---

## 1. Analyse des Coûts par Fonctionnalité

Notre projet repose principalement sur Firebase et les services Google AI. La plupart de ces services fonctionnent avec un **niveau gratuit généreux ("free tier")**, mais il est essentiel de comprendre ce qui se passe lorsque l'on dépasse ces quotas.

### a) Services de Base (Firebase)

| Service                 | Usage dans Clikup                                       | Facturation (après le niveau gratuit)                                     | Impact sur les Coûts |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| **Firebase Auth**       | Inscription, connexion, gestion des utilisateurs.     | Gratuit jusqu'à des milliers d'utilisateurs actifs mensuels.              | **Très Faible**      |
| **Cloud Firestore**     | Stockage des profils, métadonnées des images, notes.    | Lectures, écritures, suppressions de documents et stockage des données (Go). | **Modéré**           |
| **Cloud Storage**       | **Stockage des fichiers images téléversés.**            | Stockage (Go/mois), bande passante (téléchargements), opérations (uploads). | **Élevé (principal)** |
| **App Hosting**         | Hébergement de l'application Next.js elle-même.         | Heures d'instance, vCPU, mémoire.                                         | **Faible à Modéré**  |
| **Cloud Functions**     | Logique serveur pour les paiements, la recharge de tickets, etc. | Invocations, temps de calcul (vCPU-sec), mémoire (Go-sec).               | **Modéré**           |

### b) Services d'Intelligence Artificielle (Google AI / Genkit)

| Service                             | Usage dans Clikup                                    | Facturation                                                               | Impact sur les Coûts |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| **Génération de Texte (Gemini)**    | Génération des titres, descriptions, audits.         | Basée sur le nombre de "tokens" (mots/caractères) en entrée et en sortie.   | **Modéré**   |
| **Édition d'Image (Gemini)** | Retouche d'image via des prompts textuels.           | **Par image générée.** Le coût réel constaté est d'environ **0,0275 € par génération**.      | **Très Élevé**       |
| **Génération de Vidéo (Veo)** | Création de clips vidéo à partir de texte. | **Par seconde de vidéo générée.** Coût estimé à environ **0,04 € / seconde**. | **Extrêmement Élevé** |


**Analyse consolidée :**
*   La **génération de vidéo par IA** est, de loin, le centre de coût le plus élevé, suivie de l'**édition d'image** et du **stockage** (Storage).
*   Votre système actuel de **tickets quotidiens gratuits** est une excellente stratégie pour maîtriser ces coûts pour l'offre gratuite et prévenir les abus. Il constitue la base de notre modèle Freemium.

---

## 2. Stratégies de Monétisation (Implémentées)

Notre modèle économique, aujourd'hui fonctionnel, est une approche hybride qui combine un modèle "Freemium" avec des achats uniques.

### Piste 1 : Le Modèle "Freemium" - Abonnements

#### a) Offre Gratuite
*   **Contenu :** 5 tickets Upload/jour, 3 tickets IA/jour (limités à 20/mois), 200 Mo de stockage.

#### b) Offre "Créateur"
*   **Prix :** 4,99 € / mois.
*   **Contenu :** 500 tickets upload/mois, 50 tickets IA/mois, 10 Go de stockage.

#### c) Offre "Pro"
*   **Prix :** 9,99 € / mois.
*   **Contenu :** Uploads illimités, 150 tickets IA/mois, 50 Go de stockage.

#### d) Offre "Maître"
*   **Prix :** 19,99 € / mois.
*   **Contenu :** Uploads illimités, 300 tickets IA/mois, 250 Go de stockage.
    
#### e) Offres "Stockage Seul"
*   **Prix :** 7,99 €/mois (250Go), 14,99 €/mois (500Go), 29,99 €/mois (1To).
*   **Contenu :** Augmentation du quota de stockage tout en conservant les tickets gratuits.

### Piste 2 : Les Packs "À la Carte" (Achats Uniques)

#### a) Packs "Boost Upload"
*   **Formules :** De 50 tickets (1,99 €) à 1000 tickets (19,99 €).

#### b) Packs "Boost IA"
*   **Formules :** De 20 tickets (2,99 €) à 1000 tickets (80,00 €).
*(Note : Les tickets IA sont plus chers car ils reflètent le coût plus élevé des appels aux modèles d'IA générative d'images.)*

---

## 3. Analyse de Rentabilité et Positionnement

*   **Rentabilité :** Les prix sont structurés pour couvrir largement les coûts opérationnels estimés (stockage, bande passante, appels API IA), même pour un usage intensif, tout en assurant une marge brute saine pour financer les utilisateurs gratuits et le développement futur.
*   **Positionnement :** Cette structure tarifaire positionne Clikup comme une solution "premium" mais accessible. Contrairement aux hébergeurs gratuits financés par la publicité, Clikup vend de la **valeur ajoutée** (puissance de l'IA, gain de temps, organisation) et de la **commodité** (limites élevées, stockage étendu). Notre cible n'est pas l'utilisateur qui cherche le "tout gratuit", mais celui qui cherche le **meilleur outil**.

---

## 4. Logique Technique du Système de Tickets (Implémentée)

Pour intégrer la monétisation, le système distingue les tickets gratuits (rechargés quotidiennement/mensuellement) des tickets achetés (persistants).

### a) Modèle de Données Enrichi
Le document utilisateur dans Firestore sépare ces différents soldes :
*   `ticketCount`, `aiTicketCount` (quotidiens gratuits).
*   `subscriptionUploadTickets`, `subscriptionAiTickets` (abonnements mensuels).
*   `packUploadTickets`, `packAiTickets` (packs achetés).

### b) Logique de Consommation
Le système décompte les tickets dans un ordre précis et avantageux pour l'utilisateur :
1.  Tickets Gratuits Quotidiens.
2.  Tickets d'Abonnement Mensuels.
3.  Tickets Achetés (Packs).

Cette architecture garantit que l'utilisateur ne perd jamais ce qu'il a payé tout en profitant des avantages gratuits de la plateforme.

---

## 5. Gestion du Stockage et Période de Grâce

Pour éviter de "prendre en otage" les fichiers d'un utilisateur qui arrête son abonnement, une politique juste est en place :
*   Si un utilisateur annule son abonnement et que son stockage utilisé dépasse la limite gratuite (200 Mo), il ne peut plus rien téléverser, mais **conserve l'accès à tous ses fichiers**.
*   Une **période de grâce de 90 jours** est activée. Passé ce délai, et si l'utilisateur n'a pas libéré d'espace ou ne s'est pas réabonné, une fonction automatisée (`scheduledStorageCleanup`) supprime les fichiers les plus anciens jusqu'à ce que le quota soit respecté.
