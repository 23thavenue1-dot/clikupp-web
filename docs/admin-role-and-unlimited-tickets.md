
# Stratégies pour accorder des tickets illimités

Ce document explore les différentes méthodes pour permettre à un utilisateur spécifique, comme un développeur du projet, de bénéficier d'un nombre de tickets illimité (uploads et IA), contournant ainsi le système de tickets quotidien.

## Contexte

Le système de tickets est conçu pour maîtriser les coûts et assurer une utilisation équitable. Cependant, pour les besoins de développement, de test ou d'administration, il est souvent nécessaire d'avoir un accès sans restriction.

## Approche 1 : Modification Manuelle (La plus simple)

Cette méthode ne nécessite aucune modification du code de l'application et peut être réalisée directement dans la console Firebase.

*   **Comment faire ?**
    1.  Ouvrez votre projet dans la **console Firebase**.
    2.  Allez dans la section **Firestore Database**.
    3.  Naviguez jusqu'à la collection `users` et trouvez votre document utilisateur (identifié par votre `userId`).
    4.  Modifiez les champs `ticketCount` et `aiTicketCount` et assignez-leur une valeur très élevée (par exemple, `99999`).

*   **Avantages :**
    *   **Immédiat :** La modification est instantanée.
    *   **Aucun code requis :** Pas besoin de toucher à l'application.

*   **Inconvénients :**
    *   **Temporaire :** La recharge quotidienne réinitialisera les compteurs à leurs valeurs par défaut (5 et 3) si vous vous connectez après plus de 24 heures. Il faudrait donc répéter l'opération.

## Approche 2 : Le Rôle "Admin" (La plus propre et durable)

Cette méthode est la solution professionnelle et recommandée pour une utilisation à long terme. Elle consiste à créer un "rôle" qui confère des privilèges spéciaux.

*   **Comment ça fonctionne ?**
    1.  **Définition du rôle :** On utilise une collection Firestore dédiée, `roles_admin`. La simple présence d'un document ayant pour ID votre `userId` dans cette collection vous confère le statut d'administrateur. (Note : cette collection et les règles de sécurité associées sont déjà pré-configurées dans le projet).
    2.  **Mise à jour du code :** On modifie la logique de l'application aux endroits où les tickets sont vérifiés. Avant de décrémenter un ticket, le code effectuerait une vérification supplémentaire :
        *   "L'utilisateur actuel a-t-il le rôle 'admin' ?"
        *   Si **oui**, l'action (upload, génération IA) est autorisée sans décompte de tickets.
        *   Si **non**, le système de tickets fonctionne normalement.

*   **Avantages :**
    *   **Permanent et propre :** Une fois en place, vous n'avez plus à vous soucier des tickets. La solution est intégrée logiquement à l'application.
    *   **Scalable :** Il est très facile d'ajouter ou de retirer des administrateurs en ajoutant/supprimant simplement un document dans la collection `roles_admin`.

*   **Difficulté de mise en place :** Faible à moyenne. Cela nécessiterait de modifier les composants suivants pour y ajouter la logique de vérification du rôle :
    *   `src/app/uploader.tsx` (pour les uploads)
    *   `src/app/ImageList.tsx` (pour la génération de description depuis la galerie)
    *   `src/app/edit/[imageId]/page.tsx` (pour l'édition d'image par IA)

## Conclusion

*   Pour un **besoin ponctuel et immédiat**, l'approche manuelle est parfaite.
*   Pour une **solution durable et professionnelle**, l'implémentation du rôle "Admin" est la voie à suivre. C'est une pratique standard et robuste pour la gestion des permissions.

Nous pourrons implémenter cette logique de rôle dès que le besoin se fera sentir.
