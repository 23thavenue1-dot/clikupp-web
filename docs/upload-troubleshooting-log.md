# Journal de Résolution : Problème de Téléversement d'Images

Ce document retrace l'historique des problèmes rencontrés avec la fonctionnalité de téléversement de fichiers, les tentatives de résolution, et la solution finale.

## 1. Problème Initial

**Symptôme** : L'utilisateur sélectionne un fichier à téléverser, la barre de progression s'affiche, mais l'opération échoue systématiquement. Aucune image n'apparaît dans la galerie, et aucune erreur claire n'est initialement visible dans l'interface.

**Fonctionnalité impactée** : Uniquement le téléversement de fichiers depuis l'ordinateur. L'ajout d'images par URL externe fonctionnait correctement.

## 2. Hypothèses et Tentatives de Résolution

Le processus de débogage a suivi plusieurs hypothèses.

### Hypothèse A : Problème de Configuration du Projet Firebase

- **Idée** : L'application n'est peut-être pas connectée au bon projet Firebase.
- **Action** : Vérification de la configuration.
- **Résultat** : **Hypothèse rejetée**. La connexion au projet était correcte. L'erreur ne venait pas d'un problème de configuration globale.

### Hypothèse B : Problème d'Interface Utilisateur (Frontend)

- **Idée** : Le code du composant `Uploader` est peut-être défectueux et n'envoie pas correctement la requête.
- **Action** : Plusieurs corrections ont été apportées au composant `uploader.tsx` pour améliorer l'interface, comme l'ajout d'un bouton de démarrage explicite.
- **Résultat** : **Hypothèse rejetée**. Bien que les améliorations de l'interface aient été utiles, elles n'ont pas résolu le problème de fond. L'erreur se situait plus bas dans la pile technique.

### Hypothèse C : Incohérence entre le Code Client et les Règles de Sécurité (Cause Réelle)

Cette hypothèse s'est avérée être la bonne, mais sa résolution a nécessité plusieurs tentatives. Le problème fondamental était que le chemin de destination du fichier, défini dans le code de l'application, ne correspondait pas au chemin autorisé par les règles de sécurité de Firebase Storage.

- **Tentative 1 : Synchronisation sur le chemin `users/{userId}/images/{fileName}`**
  - **Action** : Modification de `src/lib/storage.ts` et `storage.rules` pour utiliser ce chemin.
  - **Résultat** : **Échec**. L'erreur `storage/retry-limit-exceeded` a commencé à apparaître, confirmant un problème de permission. Le client essayait d'écrire, se voyait refuser l'accès, réessayait en boucle jusqu'à l'expiration du délai.

- **Tentative 2 : Simplification du chemin**
  - **Action** : Modification des deux fichiers pour utiliser un chemin plus simple : `users/{userId}/{fileName}`.
  - **Résultat** : **Échec**. L'erreur persistait, indiquant une erreur subtile ou une mauvaise synchronisation persistante.

- **Tentative 3 : Erreurs dans la gestion des données Firestore**
  - **Action** : Correction du code dans `src/lib/firestore.ts` qui enregistre les informations de l'image après le téléversement. J'ai suspecté que des erreurs à cette étape pouvaient causer un retour en arrière silencieux.
  - **Résultat** : **Échec**. Bien que le code ait été amélioré, cela n'a pas résolu le blocage initial du téléversement sur Storage.

## 3. Solution Finale (Point de Bascule)

Le tournant décisif a été l'analyse détaillée et les règles de sécurité fournies par l'utilisateur.

- **Diagnostic final** : L'incohérence entre le chemin d'upload dans le code (`src/lib/storage.ts`) et les règles de sécurité (`storage.rules`) était bien la cause. Le code tentait d'écrire à un emplacement que les règles interdisaient explicitement.

- **Action corrective finale** :
  1.  **Mise à jour de `storage.rules`** : Application d'une règle standard et robuste qui autorise un utilisateur (`request.auth.uid`) à écrire uniquement dans un dossier qui lui est propre : `match /uploads/{uid}/{fileId}`.
  2.  **Mise à jour de `src/lib/storage.ts`** : Modification du code client pour que le chemin de téléversement corresponde **exactement** à la nouvelle règle : `const storagePath = \`uploads/${user.uid}/${fileName}\`;`.

- **Résultat** : **SUCCÈS**. En alignant parfaitement la demande du client avec l'autorisation du serveur, le refus de permission a été levé, et le téléversement a pu se terminer avec succès.

## 4. Conclusion

Le problème était un cas classique de **désynchronisation entre la logique applicative et les règles de sécurité**. La résolution a été retardée par des corrections partielles et une mauvaise interprétation initiale des symptômes. La solution a consisté à appliquer une règle de sécurité standard et à s'assurer que le code client la respectait à la lettre.