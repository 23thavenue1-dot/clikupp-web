# Statut et Feuille de Route : Système de Tickets

Ce document dresse un bilan de l'état actuel du système de tickets, retrace les défis rencontrés, les solutions mises en place et définit les prochaines étapes claires pour finaliser la fonctionnalité.

## 1. État Actuel de la Fonctionnalité (Ce qui fonctionne)

À ce jour, les fondations du système de tickets sont en place et fonctionnelles :

*   **Stockage des Données :** Chaque utilisateur possède bien dans Firestore un champ `ticketCount` et `lastTicketRefill`.
*   **Affichage du Compteur :** Le nombre de tickets restants est maintenant **affiché de manière fiable** dans l'interface de téléversement. Le compteur est également interactif et ouvre une fenêtre de dialogue expliquant le système.
*   **Décompte à l'Upload :** Le mécanisme de décompte est **actif**. Chaque fois qu'un utilisateur téléverse une image (quelle que soit la méthode), son `ticketCount` est correctement décrémenté de 1.
*   **Blocage à Zéro :** Un utilisateur qui n'a plus de tickets **ne peut plus en téléverser**, et un message d'erreur clair lui est notifié.

## 2. Problèmes Rencontrés et Solutions Apportées

Le développement de cette fonctionnalité a été marqué par un défi majeur : l'affichage fiable du nombre de tickets.

1.  **Problème Initial :** Le compteur de tickets restait désespérément vide.
2.  **Première Piste (erronée) :** J'ai d'abord cru à un problème de transmission de données (props) entre les composants. Mes tentatives pour corriger cela n'ont pas fonctionné.
3.  **Seconde Piste (la bonne) :** Le problème était plus profond. Une erreur critique s'était glissée dans le fichier `src/lib/storage.ts` : une fonction utilitaire classique (`deleteImageFile`) essayait d'utiliser un hook React (`useFirebase`), ce qui est interdit et créait une instabilité générale dans l'environnement Firebase.
4.  **Solution Appliquée :**
    *   Correction de la fonction `deleteImageFile` pour qu'elle ne dépende plus d'un hook.
    *   Solidification de la logique du composant `Uploader` pour qu'il récupère lui-même les informations de l'utilisateur, le rendant plus robuste et autonome.
    *   Mise en place du mécanisme de décompte et de blocage.

## 3. Prochaines Étapes et Plan de Développement

Le système est presque complet, mais il manque l'élément final pour qu'il soit viable.

### Étape 1 : Implémenter la Recharge Quotidienne (Priorité Immédiate)
*   **Objectif :** Faire en sorte que le compteur de tickets de chaque utilisateur soit réinitialisé à 5, une fois par période de 24 heures.
*   **Action :** Ajouter une logique dans l'application (probablement à la connexion ou au chargement de la page d'accueil) qui vérifie la date de la dernière recharge (`lastTicketRefill`) et met à jour le `ticketCount` si nécessaire.

### Étape 2 : Améliorer l'Expérience Utilisateur (Après la recharge)
*   **Objectif :** Mieux communiquer le système à l'utilisateur.
*   **Actions Possibles :**
    *   Afficher un message de bienvenue lors de la première connexion pour expliquer le système de tickets.
    *   Dans la fenêtre modale des tickets, afficher l'heure de la prochaine recharge.

### Étape 3 : Suivre la Feuille de Route (`docs/roadmap.md`)
Une fois ces deux étapes terminées, le système de tickets sera pleinement fonctionnel et nous pourrons nous concentrer sur les autres points de la feuille de route, notamment l'intégration de l'IA.
