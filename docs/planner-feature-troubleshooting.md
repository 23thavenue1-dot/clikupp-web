# Journal de Dépannage : Fonctionnalité Planificateur

Ce document est dédié au suivi de la résolution du problème empêchant la sauvegarde et la programmation de publications depuis l'interface de génération IA.

---

### Problème Initial

- **Symptôme :** L'application génère une erreur lors d'un clic sur "Enregistrer en brouillon" ou "Programmer..." sur la page `/audit/resultats/[auditId]`.
- **Date :** Constaté après l'implémentation initiale des boutons.

---

### Analyse et Tentatives

#### Hypothèse 1 : Erreur de Référence Firestore (Corrigé mais insuffisant)

- **Diagnostic :** La fonction `savePostForLater` dans `src/lib/firestore.ts` tentait d'écrire dans la base de données en utilisant un simple chemin (`string`) au lieu d'une `CollectionReference` valide.
- **Action :** Modification de `savePostForLater` pour qu'elle utilise `collection(firestore, ...)` afin de créer une référence correcte.
- **Résultat :** L'erreur a changé, indiquant que le problème était plus profond.

#### Hypothèse 2 : Instance de Storage manquante (Corrigé mais insuffisant)

- **Diagnostic :** L'instance `storage` était `undefined` lors de l'appel à `savePostForLater`. Le hook `useStorage()` était utilisé dans la page, mais il n'existait pas.
- **Action corrective :** Remplacement de `useStorage` par le hook principal `useFirebase` qui fournit l'ensemble des services, y compris `storage`.
- **Résultat :** Le problème a évolué vers une erreur de permission, ce qui est un excellent progrès car cela signifie que la logique de code est maintenant correcte.

#### Hypothèse 3 : Règle de Sécurité Manquante (LA CAUSE RACINE)

- **Diagnostic :** La console Firebase a remonté une erreur `storage/unauthorized`. Cela indique sans le moindre doute que les règles de sécurité de Firebase Storage (`storage.rules`) n'autorisent pas l'écriture à l'emplacement `scheduledPosts/{userId}/{fileName}`.
- **Action corrective :** Ajouter une nouvelle règle dans `storage.rules` pour permettre à un utilisateur authentifié d'écrire dans son propre dossier de brouillons.
- **Prochaine étape :** Vérifier si cette correction résout l'erreur et permet enfin la sauvegarde et la programmation des posts.

---
