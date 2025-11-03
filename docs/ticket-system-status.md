# Statut et Feuille de Route : Système de Tickets

Ce document dresse un bilan de l'état actuel du système de tickets, retrace les défis rencontrés, les solutions mises en place et définit les prochaines étapes claires pour finaliser la fonctionnalité.

## 1. État Actuel de la Fonctionnalité (Tickets d'Upload)

À ce jour, les fondations du système de tickets d'upload sont en place et fonctionnelles :

*   **Stockage des Données :** Chaque utilisateur possède bien dans Firestore un champ `ticketCount` et `lastTicketRefill`.
*   **Affichage du Compteur :** Le nombre de tickets restants est maintenant **affiché de manière fiable** dans l'interface de téléversement. Le compteur est également interactif.
*   **Décompte à l'Upload :** Le mécanisme de décompte est **actif**. Chaque fois qu'un utilisateur téléverse une image, son `ticketCount` est correctement décrémenté de 1.
*   **Blocage à Zéro :** Un utilisateur qui n'a plus de tickets **ne peut plus en téléverser**, et un message d'erreur clair lui est notifié.
*   **Recharge Quotidienne :** La logique de recharge est implémentée et réinitialise le compteur à 5, une fois par période de 24 heures.

## 2. Implémentation du Système de Tickets IA (En cours)

Nous étendons maintenant le système pour gérer la consommation des fonctionnalités d'IA.

### Étape 1 : Mise à jour du Modèle de Données (Terminé)
*   **Objectif :** Définir ce qu'est un "ticket IA" dans notre base de données.
*   **Action Réalisée :**
    1.  Ajout des champs `aiTicketCount` (nombre) et `lastAiTicketRefill` (date) à l'entité `User` dans `docs/backend.json`.
    2.  Mise à jour du processus d'inscription (`src/app/signup/page.tsx`) pour que chaque nouvel utilisateur commence avec un quota de **3 tickets IA**.
*   **Résultat :** Les fondations sont posées. L'application sait maintenant que les tickets IA existent et comment les initialiser.

### Étape 2 : Implémenter le décompte et l'affichage (Terminé)
*   **Objectif :** Contrôler l'utilisation de l'IA et informer l'utilisateur de son solde.
*   **Action Réalisée :**
    1.  Le composant `ImageList.tsx` récupère maintenant le profil utilisateur pour connaître le `aiTicketCount`.
    2.  Un compteur de tickets IA est affiché dans la fenêtre de dialogue de génération.
    3.  Le bouton de génération est désactivé et une infobulle apparaît si l'utilisateur n'a plus de tickets.
    4.  Une nouvelle fonction `decrementAiTicketCount` a été créée dans `lib/firestore.ts`.
    5.  Après chaque génération d'IA réussie, le compteur de l'utilisateur est décrémenté de 1.
*   **Résultat :** Le système de décompte est fonctionnel. L'utilisation de l'IA est maintenant limitée par le nombre de tickets disponibles.


### Prochaines Étapes :
*   **Étape 3 :** Mettre en place la recharge quotidienne des tickets IA.
