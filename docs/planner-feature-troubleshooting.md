# Journal de Dépannage : Fonctionnalité Planificateur (Archivé)

**Ce document est archivé car le problème a été résolu et la fonctionnalité est stable.** Les informations ont été synthétisées dans le journal de développement principal (`docs/feature-dev-log.md`).

---

### Problème Initial

*   **Symptôme :** L'application générait une erreur lors d'un clic sur "Enregistrer en brouillon" ou "Programmer..." sur la page des résultats de l'audit (`/audit/resultats/[auditId]`).
*   **Date :** Constaté après l'implémentation initiale des boutons.

---

### Analyse et Résolution

Le dépannage s'est déroulé en plusieurs étapes, éliminant les erreurs les unes après les autres.

#### Hypothèse 1 : Erreur de Référence Firestore (Corrigé mais insuffisant)

*   **Diagnostic :** La fonction `savePostForLater` dans `src/lib/firestore.ts` tentait d'écrire dans la base de données en utilisant un simple chemin (`string`) au lieu d'une `CollectionReference` valide.
*   **Action :** Modification de la fonction pour qu'elle utilise `collection(firestore, ...)` afin de créer une référence correcte.

#### Hypothèse 2 : Instance de Storage manquante (Corrigé mais insuffisant)

*   **Diagnostic :** L'instance `storage` était `undefined` lors de l'appel à `savePostForLater`. Le hook `useStorage()` était utilisé dans la page, mais il n'existait pas.
*   **Action corrective :** Remplacement de `useStorage` par le hook principal `useFirebase` qui fournit l'ensemble des services, y compris `storage`.

#### Hypothèse 3 : Absence de règles Firestore (LA VRAIE CAUSE RACINE)

*   **Diagnostic final :** Après les premières corrections, un nouveau message d'erreur `Missing or insufficient permissions` pointait sans ambiguïté vers le fichier `firestore.rules`. En analysant la requête (`create` sur `/users/{userId}/scheduledPosts`), il est devenu évident qu'il n'y avait **aucune règle `match`** pour la sous-collection `scheduledPosts`.
*   **Action corrective :** Ajouter un bloc `match /scheduledPosts/{postId}` dans `firestore.rules` pour autoriser explicitement les opérations de lecture et d'écriture (`create`, `update`, `delete`) pour les utilisateurs authentifiés sur leurs propres documents.
*   **Résultat :** La correction a été appliquée avec succès, résolvant le problème de permission. La fonctionnalité est devenue pleinement opérationnelle.
