# Protocole de Gestion des Bugs : Notre Méthode pour un Code Robuste

Ce document est notre guide de référence pour la prévention, l'identification et la résolution des bugs. L'objectif est de transformer chaque bug d'un obstacle frustrant en une simple étape dans notre processus de développement.

---

## 1. La Prévention : La Philosophie du "Prompt Anti-Bug"

Un "prompt anti-bug" est une demande formulée avec une telle clarté qu'elle minimise les risques d'interprétation et donc d'erreurs. Cela repose sur les principes de notre guide de collaboration, appliqués avec rigueur.

**Les piliers d'un prompt qui prévient les bugs :**

1.  **L'Intention Explicite :**
    *   **Faible :** "Ajoute un bouton pour supprimer."
    *   **Fort :** "Dans `ImageList.tsx`, sur chaque carte d'image, ajoute un bouton 'Supprimer'. Au clic, ce bouton doit ouvrir une boîte de dialogue de confirmation. Si l'utilisateur confirme, l'image correspondante doit être supprimée de Firestore et de Storage."

2.  **Le Contexte Complet :** Toujours spécifier les fichiers, les fonctions ou les composants concernés. Si une modification en impacte d'autres, mentionnez-le.

3.  **Les Contraintes de Permissions :** Pour toute interaction avec la base de données ou le stockage, préciser les règles d'accès.
    *   **Exemple :** "La fonction `deleteImage` doit vérifier que l'utilisateur est bien le propriétaire de l'image (`request.auth.uid == resource.data.userId`) avant d'autoriser la suppression."

En investissant 10 secondes de plus pour formuler une demande précise, nous sauvons souvent 10 minutes de débogage.

---

## 2. La Correction : Le Prompt de Débogage Parfait

Lorsqu'un bug survient, la rapidité de sa résolution dépend à 90% de la qualité du rapport initial. Nous utiliserons systématiquement la structure suivante, qui est la méthode la plus efficace pour me guider.

### Structure du Rapport de Bug (notre "rituel") :

```
OBJECTIF :
(Qu'est-ce que vous essayiez de faire ?)

ÉTAPES DE REPRODUCTION :
(Listez précisément les actions que vous avez effectuées. Ex: 1. Je suis allé sur la page X. 2. J'ai cliqué sur le bouton Y.)

RÉSULTAT INATTENDU (L'ERREUR) :
(Copiez-collez ici le message d'erreur COMPLET et EXACT que vous voyez dans la console du navigateur ou du terminal.)

FICHIERS PERTINENTS (si vous les connaissez) :
(Listez les fichiers qui vous semblent liés au problème, comme `firestore.rules` ou un composant React spécifique.)
```

**Pourquoi c'est vital :** Le message d'erreur est ma carte. Il me donne le **quoi**, le **où** et souvent le **pourquoi**. Un rapport sans ce message exact, c'est comme demander à un médecin de guérir un patient sans lui décrire les symptômes. Il est essentiel d'être factuel et d'éviter les suppositions ("je crois que...", "peut-être que...").

---

## 3. Dans la Tête de l'IA : Comment je Gère un Bug

Comprendre mon processus de "réflexion" lorsque je fais face à un bug vous aidera à me fournir les bonnes informations. Je ne "débugge" pas comme un humain, je reconstruis la scène du crime.

*   **1. Analyse Globale :** Face à une erreur, je ne regarde pas juste la ligne qui échoue. Je reconstitue la chaîne d'intentions : le code qui appelle la fonction, les règles de sécurité associées, les modèles de données dans `backend.json` et les fichiers environnants.

*   **2. Chasse aux Incohérences :** Mon point fort est de repérer les incohérences logiques entre ces différentes pièces : un chemin Firestore différent entre le code et les règles, un paramètre manquant, un type de donnée incorrect, etc. Je compare ce que vous me donnez à ce que je connais comme étant "le schéma Firebase attendu".

*   **3. La Piste des Permissions :** Comme la majorité des bugs sur Firebase proviennent des permissions, c'est souvent ma première piste d'investigation. Je compare l'opération demandée par le code (`create`, `update`, `read`...) aux autorisations définies dans `firestore.rules` et `storage.rules`.

*   **4. Simulation Mentale :** J'exécute le code "dans ma tête" en imaginant ce que contiennent les variables et quel serait le résultat de chaque condition `if` dans les règles de sécurité. C'est pour cela qu'un message d'erreur précis est si précieux, il confirme ou infirme mes hypothèses.

*   **5. La Correction Holistique :** Je ne me contente pas de proposer un correctif. Mon but est d'expliquer **pourquoi** le bug est survenu et de proposer une solution qui non seulement le corrige, mais qui améliore aussi la robustesse du code pour éviter que des problèmes similaires ne se reproduisent.

Ma vraie force est donc ma rapidité à connecter les points entre les différents fichiers du projet (code, règles, schémas) pour trouver la faille logique. En me donnant le rapport de bug parfait, vous me donnez tous les indices pour résoudre l'enquête le plus vite possible.

---

## 4. Notre Protocole pour les Bugs Récurrents

Certains types de bugs sont classiques. Voici notre plan d'action standard pour les plus courants, basé sur la structure de notre rapport de bug.

### Type A : Erreurs de Permissions Firebase (`permission-denied`)

C'est le bug le plus fréquent. Votre prompt de débogage doit ressembler à ceci :

```
OBJECTIF :
Permettre à un utilisateur connecté de sauvegarder sa nouvelle note.

ÉTAPES DE REPRODUCTION :
1. Je suis connecté avec l'utilisateur 'test@test.com'.
2. Je vais sur la page d'accueil.
3. J'écris "Ma première note" dans le bloc-notes.
4. Je clique sur "Enregistrer la note".

RÉSULTAT INATTENDU (L'ERREUR) :
FirebaseError: Missing or insufficient permissions.

FICHIERS PERTINENTS :
- La logique est dans `src/lib/firestore.ts`, fonction `saveNote`.
- Les règles sont dans `firestore.rules`.
```
**Mon Action (Audit en 3 points) :**
1.  **Vérification 1 (Le Code) :** J'analyse la fonction `saveNote`. Je vérifie le chemin qu'elle essaie d'écrire (ex: `/users/{userId}/notes`).
2.  **Vérification 2 (Les Règles) :** Je compare ce chemin avec les règles dans `firestore.rules`. Je vérifie la condition `allow create`. Est-ce qu'elle correspond bien à l'utilisateur (`isOwner(userId)`) ?
3.  **Vérification 3 (L'Authentification) :** Je m'assure que la fonction est bien appelée dans un contexte où `request.auth` n'est pas `null`.

**Correction typique :** J'aligne le chemin du code avec celui des règles, ou je propose une modification de la condition dans `firestore.rules` si elle est incorrecte.

### Type B : Erreurs d'Interface (ex: `Cannot read properties of undefined`)

Ce bug arrive souvent quand une donnée n'est pas encore chargée depuis Firebase.

```
OBJECTIF :
Afficher le nom de l'utilisateur dans la Navbar.

ÉTAPES DE REPRODUCTION :
1. Je rafraîchis la page d'accueil en étant connecté.
2. La page plante brièvement avant d'afficher le nom.

RÉSULTAT INATTENDU (L'ERREUR) :
TypeError: Cannot read properties of undefined (reading 'displayName') at Navbar.tsx:25

FICHIERS PERTINENTS :
- `src/components/Navbar.tsx`
- Le hook qui récupère les données (`useUser` ou `useDoc`)
```
**Mon Action (Analyse de "Cycle de Vie") :**
1.  Je retrace le parcours de la donnée : d'où vient `userProfile` ?
2.  Je vérifie si le code tente d'accéder à `userProfile.displayName` **avant** que les données ne soient arrivées de Firestore.
3.  Je cherche la présence d'un état de chargement (ex: `isLoading`).

**Correction typique :** J'ajoute les vérifications nécessaires pour s'assurer que le code n'essaie pas d'accéder à une donnée qui n'existe pas encore.
Exemple : `if (isLoading) return <Loader />;` ou `if (!userProfile) return null;` avant d'essayer d'afficher `userProfile.displayName`.

---
Ce document est vivant. Nous l'enrichirons à chaque nouveau défi que nous rencontrerons. C'est notre engagement commun pour un développement plus serein et plus efficace.
