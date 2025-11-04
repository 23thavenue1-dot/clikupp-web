# Feuille de Route de "Clikup"

Ce document trace les grandes lignes des fonctionnalités que nous prévoyons de construire, en commençant par les plus fondamentales.

## 1. ✅ Sécurité et Contrôle des Coûts via un Système de Tickets (Terminé)

### Le Principe
L'objectif était de prévenir les abus et de maîtriser les coûts via un système de tickets quotidiens.

### État Actuel
- **Fonctionnalité Complète :** Le système de décompte, de blocage et de recharge quotidienne est 100% fonctionnel et intégré, à la fois pour les uploads et pour l'utilisation de l'IA.
- **Documentation :** Le parcours de développement est documenté dans `docs/ticket-system-status.md` et `docs/feature-dev-log.md`.

Ce système de "tickets" est devenu une fonctionnalité centrale de l'expérience utilisateur, offrant une base solide pour de futures évolutions (monétisation, récompenses, etc.).

## 2. ✅ Organisation par Galeries d'Images (Terminé)

### Le Principe
Permettre aux utilisateurs de regrouper leurs images dans des "Galeries" (ou albums) pour une meilleure organisation.

### État Actuel
- **Fonctionnalité Complète :** Le système est stable et complet. Les utilisateurs peuvent créer, voir, supprimer des galeries et gérer leur contenu (ajouter/retirer des images individuellement ou en groupe).
- **Développement :** L'implémentation a inclus la gestion des erreurs (404) et l'optimisation des performances pour éviter les boucles de rendu.
- **Documentation :** Le développement de cette fonctionnalité est consigné dans le `docs/feature-dev-log.md`.

## 3. ✅ Intégration de l'IA : Génération & Édition (Terminé)

Maintenant que la base de l'application est stable et sécurisée, nous nous concentrons sur l'IA pour enrichir l'expérience.

### La Vision
L'objectif est de mettre en œuvre la vision définie dans notre document d'idées (`docs/idées.md`), à savoir transformer Clikup en un **assistant complet pour la création de contenu pour les réseaux sociaux**.

### État Actuel
- **Génération de Descriptions (Terminée) :** L'IA peut générer des titres, descriptions et hashtags pour les images.
- **Édition d'Images par IA (Terminée) :** La fonctionnalité est pleinement opérationnelle. Le flow Genkit `editImageFlow` est intégré à une page dédiée (`/edit/[imageId]`) qui permet l'édition en langage naturel, la prévisualisation et la sauvegarde des créations. Des suggestions de prompts sont également incluses pour guider l'utilisateur.

## 4. 🚀 Prochaines Étapes : Amélioration Continue et Monétisation

Avec le cœur des fonctionnalités IA en place, les prochaines étapes se concentreront sur :

*   **Phase 3 (Long Terme) :** Simplification du partage vers les réseaux sociaux.
*   **Implémentation de la Boutique :** Connecter le bouton "Rechargez ici !" à une solution de paiement (Stripe, par exemple) pour permettre l'achat de packs de tickets.
*   **Amélioration des Performances :** Optimiser le chargement des images et la réactivité de l'application.
