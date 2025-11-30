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

#### Hypothèse 3 : Règle de Sécurité Storage incorrecte (LA VRAIE CAUSE RACINE)

- **Diagnostic final :** L'erreur `storage/unauthorized` persiste malgré les tentatives de correction. L'analyse des règles `storage.rules` a révélé une structure de règles incorrecte avec plusieurs blocs `match` au même niveau, créant une ambiguïté.
- **Action corrective :** Refonte complète de `storage.rules` pour utiliser une seule règle unifiée avec un wildcard `{folder}` qui couvre explicitement les cas `users`, `avatars` et `scheduledPosts`. Cela garantit que toute écriture dans un dossier utilisateur est correctement validée par une seule règle claire et sans conflit.
- **Prochaine étape :** Vérifier si cette nouvelle structure de règles résout définitivement l'erreur de permission.
