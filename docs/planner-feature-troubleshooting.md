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
- **Résultat :** Le problème a évolué vers une erreur de permission `storage/unauthorized`. C'est un progrès, car cela pointe vers les règles de sécurité.

#### Hypothèse 3 : Règle de Sécurité Storage manquante (Analyse incorrecte)

- **Diagnostic erroné :** J'ai cru que l'erreur `storage/unauthorized` était la cause finale et j'ai tenté de modifier `storage.rules`.
- **Résultat :** L'erreur a persisté, mais a changé pour une erreur de permission Firestore, indiquant que le problème de Storage était soit résolu, soit masqué par un autre.

#### Hypothèse 4 : Règle de Sécurité Firestore (LA VRAIE CAUSE RACINE)

- **Diagnostic final :** La nouvelle erreur est `Missing or insufficient permissions: Firestore Security Rules`. Le log montre clairement que l'opération `create` sur le chemin `/users/{userId}/scheduledPosts` est refusée.
- **Action corrective :** Modifier `firestore.rules` pour séparer explicitement la règle `create` des règles `update` et `delete` pour la sous-collection `scheduledPosts`, en la rendant moins restrictive tout en restant sécurisée.
- **Prochaine étape :** Vérifier si cette correction finale résout le problème.
