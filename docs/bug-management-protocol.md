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

### Exemple Concret : La Résolution du Bug HEIC

Notre lutte avec le format HEIC est un cas d'école parfait :
1.  **Hypothèses initiales (fausses) :** J'ai d'abord cru à un simple problème de type de fichier, et j'ai proposé des corrections rapides et isolées. Elles ont échoué, car je traitais le symptôme.
2.  **Demande d'information cruciale :** C'est lorsque vous m'avez fourni l'erreur exacte de la **console du navigateur** (`window is not defined` puis les erreurs sur `layout` et `objectFit`) que j'ai eu la "carte" dont j'avais besoin.
3.  **Diagnostic final (correct) :** Les erreurs m'ont permis de comprendre que le problème était double : une exécution de code client sur le serveur (SSR) ET une mauvaise utilisation du composant `Image` de Next.js. La cause racine n'était pas la conversion elle-même, mais son intégration dans l'écosystème Next.js.
4.  **Solution holistique :** La solution finale n'a pas été de patcher une ligne, mais de **refondre l'approche** : isoler la bibliothèque `heic2any` via une importation dynamique et centraliser toute la logique de conversion et d'aperçu dans le composant client `Uploader.tsx`.

Cet exemple prouve que ma vraie force est ma rapidité à connecter les points entre les différents fichiers du projet (code, règles, schémas) pour trouver la faille logique. En me donnant le rapport de bug parfait, vous me donnez tous les indices pour résoudre l'enquête le plus vite possible.
