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

## 2. La Correction : Le Rapport de Bug Parfait

Lorsqu'un bug survient, la rapidité de sa résolution dépend à 90% de la qualité du rapport initial. Nous utiliserons systématiquement la structure suivante, que nous avons définie dans notre guide général.

**Structure du Rapport de Bug :**

```
OBJECTIF :
(Qu'est-ce que vous essayiez de faire ?)

ÉTAPES DE REPRODUCTION :
(Listez précisément les actions que vous avez effectuées. Ex: 1. Je suis allé sur la page X. 2. J'ai cliqué sur le bouton Y.)

RÉSULTAT INATTENDU (L'ERREUR) :
(Copiez-collez ici le message d'erreur COMPLET et EXACT que vous voyez dans la console du navigateur ou du terminal.)

FICHIERS PERTINENTS (si vous les connaissez) :
(Listez les fichiers qui vous semblent liés au problème.)
```

**Pourquoi c'est vital :** Le message d'erreur est ma carte. Il me donne le **quoi**, le **où** et souvent le **pourquoi**. Un rapport sans ce message exact, c'est comme demander à un médecin de guérir un patient sans lui décrire les symptômes.

---

## 3. Notre Protocole pour les Bugs Récurrents

Certains types de bugs sont classiques. Voici notre plan d'action standard pour les plus courants.

### Type A : Erreurs de Permissions Firebase (`permission-denied`, `unauthorized`)

1.  **Votre Action :** Fournir le rapport de bug complet, en s'assurant que le message d'erreur est exact.
2.  **Mon Action (Audit en 3 points) :**
    *   **Vérification 1 (Le Code) :** J'analyse la fonction qui effectue l'opération (ex: `setDoc`, `uploadBytes`). Je vérifie le chemin utilisé.
    *   **Vérification 2 (Les Règles) :** Je compare ce chemin avec les règles dans `firestore.rules` ou `storage.rules`.
    *   **Vérification 3 (L'Authentification) :** Je m'assure que la fonction est bien appelée dans un contexte où l'utilisateur est authentifié.
3.  **Correction :** J'aligne le code avec les règles, ou je propose une modification des règles si elles sont incorrectes.

### Type B : Erreurs d'Interface (ex: `Cannot read properties of undefined`)

1.  **Votre Action :** Fournir le rapport de bug avec les étapes pour le reproduire et l'erreur de la console du navigateur.
2.  **Mon Action (Analyse de "Cycle de Vie") :**
    *   Je retrace le parcours de la donnée : d'où vient-elle ? (ex: un hook `useDoc`).
    *   Est-elle chargée au moment où le composant essaie de l'afficher ? Je vérifie la présence des états de chargement (`isLoading`).
    *   Est-elle correctement transmise entre les composants ? Je vérifie les `props`.
3.  **Correction :** J'ajoute les vérifications nécessaires (ex: `if (isLoading) return <Loader />`, `if (!data) return null;`) pour m'assurer que le code n'essaie pas d'accéder à une donnée qui n'existe pas encore.

---

Ce document est vivant. Nous l'enrichirons à chaque nouveau défi que nous rencontrerons. C'est notre engagement commun pour un développement plus serein et plus efficace.