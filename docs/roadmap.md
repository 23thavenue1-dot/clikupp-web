# Feuille de Route de "Clikup"

Ce document trace les grandes lignes des fonctionnalités que nous avons construites et celles que nous prévoyons de développer.

---

## ✅ Étape 1 : Fondations Robustes (Terminé)

*   **Sécurité et Contrôle des Coûts :** Implémentation d'un système de tickets quotidiens pour les uploads et l'utilisation de l'IA, avec une recharge automatique et des limites mensuelles.
*   **Organisation par Galeries :** Mise en place d'un système complet de gestion de galeries (albums) pour organiser les images.
*   **Documentation et Vision :** Création et maintenance de la documentation du projet pour aligner la vision technique et stratégique.
*   **Base Technique Stable :** Résolution des bugs critiques, optimisation des performances et nettoyage du code pour assurer une expérience utilisateur fluide.

## ✅ Étape 2 : L'Ère de l'IA (Terminé)

L'objectif était de mettre en œuvre la vision définie dans `docs/idées.md`, en transformant Clikup en un **assistant de contenu intelligent**.

*   **Génération de Contenu Textuel :** L'IA peut générer des titres, des descriptions et des hashtags pertinents pour les images.
*   **Édition d'Images par Langage Naturel :** L'IA peut modifier une image en suivant des instructions textuelles, avec une interface de prévisualisation et des suggestions.
*   **Génération d'Images de Zéro :** L'IA peut créer des images originales à partir d'une simple description.
*   **Génération de Vidéos :** L'IA peut générer de courtes vidéos à partir d'un prompt textuel.

## ✅ Étape 3 : Monétisation et Modèle Économique (Terminé)

Mise en place d'une boutique fonctionnelle pour concrétiser le modèle économique "Freemium".

*   **Intégration Stripe :** La boutique est fonctionnelle, avec une intégration robuste de Stripe pour gérer les abonnements et les achats uniques (packs de tickets).
*   **Abonnements & Packs :** Création de plusieurs niveaux d'abonnements (Créateur, Pro, Maître) et de packs de tickets à la carte pour les uploads et l'IA.
*   **Gestion des Quotas :** La logique de consommation des tickets (gratuits, abonnements, packs) et de gestion des quotas de stockage est entièrement implémentée.

## ✅ Étape 4 : L'Assistant Proactif (Terminé)

Aller au-delà de l'outil et devenir un véritable partenaire stratégique pour le créateur.

*   **Coach Stratégique IA :** Implémentation d'un assistant guidé ("wizard") qui permet à l'utilisateur de faire analyser son profil (via une sélection de contenus) pour obtenir un rapport d'audit complet.
*   **Planificateur de Contenu :** Les idées de contenu générées par l'audit peuvent être sauvegardées en tant que brouillons ou programmées directement dans un calendrier.
*   **Partage Simplifié :** Intégration de boutons de partage rapide vers les réseaux sociaux pour fluidifier le processus de publication manuelle.

---

## 🚀 Étape 5 : Prochaines Étapes : Automatisation et Amélioration

Avec toutes les fonctionnalités majeures en place, les prochaines étapes se concentreront sur l'automatisation et l'amélioration de l'expérience utilisateur.

*   **Automatisation de la Publication (Vision à Long Terme) :**
    *   **Objectif :** Mettre en œuvre la "Stratégie 3" définie dans `docs/social-media-publishing-strategies.md`.
    *   **Description :** Permettre au Planificateur de publier **automatiquement** le contenu programmé sur les réseaux sociaux de l'utilisateur (Instagram, Facebook, etc.).
    *   **Statut :** C'est le prochain grand jalon technique, complexe mais qui apportera une valeur ajoutée considérable.

*   **Amélioration Continue de l'UX :**
    *   Optimiser les performances (ex: chargement des galeries).
    *   Fluidifier les parcours utilisateurs les plus fréquents.
    *   Enrichir l'interface sur la base des retours.
