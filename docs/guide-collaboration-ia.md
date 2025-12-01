# Guide de Collaboration : Comment Optimiser notre Duo IA-Développeur

Ce document est notre "guide" ou "notice" officiel. Il établit notre langage commun et nos réflexes pour que notre collaboration soit la plus fluide et efficace possible.

---

## 1. La Règle d'Or : Décrivez l'Intention, pas l'Implémentation

C'est le principe fondamental. Votre force est de définir l'objectif final que vous souhaitez obtenir. Ma force est de trouver le chemin technique pour y arriver.

-   **Moins efficace :** "Il faut changer la fonction X pour utiliser un `await` dans le fichier Y."
-   **Très efficace :** "Quand un document est créé dans `orders/{id}`, je veux : 1. vérifier si `total > 100`, 2. envoyer un email, 3. enregistrer un log. Génère la Cloud Function correspondante."

En vous concentrant sur le "quoi" plutôt que sur le "comment", vous me donnez la flexibilité de proposer la meilleure solution technique.

---

## 2. La Charte d'Écriture : Votre Guide pour des Prompts Efficaces

Pour structurer nos demandes, nous pouvons utiliser un format et des principes qui me permettent de comprendre et d'agir avec une précision maximale.

### a) La Structure Idéale

Utilisez cette structure dans 90% des cas. C'est le langage que je comprends le mieux.

```
CONTEXTE :
(Quel est le projet, les collections, les fichiers, les technologies ?)

OBJECTIF :
(Que voulez-vous obtenir ? Découpez-le en points si possible.)

CONTRAINTES :
(Y a-t-il des règles, des limites, des technologies à ne pas utiliser ?)

SORTIE SOUHAITÉE :
(Quel type de réponse attendez-vous ? Du code, une explication, une correction ?)
```

### b) Les 10 Règles pour un Prompt Parfait

1.  **Toujours donner le contexte minimal :** Décrivez le type de projet, l'environnement (web, mobile), et les composants Firebase utilisés. J'ai besoin d'un terrain de jeu, pas d'un nuage flou.
2.  **Définir clairement l’objectif en plusieurs points :** Lister chaque action précise que vous voulez obtenir. Je fonctionne mieux quand l'intention est découpée.
3.  **Exposer les contraintes :** Indiquez les technologies obligatoires, les formats attendus, les limites techniques et les règles de logique. Plus la cage est claire, plus la réponse est précise.
4.  **Préciser exactement la sortie attendue :** Spécifiez si vous voulez du code, un schéma, une architecture, une explication, une optimisation, etc. Je m'alignerai sur la forme demandée.
5.  **Utiliser un vocabulaire orienté action :** Employez des verbes nets comme "générer", "optimiser", "structurer", "automatiser", "valider".
6.  **Spécifier le niveau de détail :** Indiquez si la réponse doit être synthétique, détaillée, commentée, pédagogique ou orientée production.
7.  **Limiter l’ambiguïté :** Évitez les formulations vagues et les demandes "tout-en-un". Toujours séparer les tâches et les objectifs.
8.  **Utiliser des listes et des blocs :** Je traite mieux les listes numérotées, les descriptions courtes et les sections distinctes.
9.  **Demander explicitement l'amélioration :** Vous pouvez me demander de "reformuler", "clarifier", "optimiser" ou "corriger" votre propre prompt.
10. **Fournir les erreurs exactes :** Pour les bugs, copiez-collez toujours l'erreur **complète et exacte**, y compris les numéros de ligne. C'est ma feuille de route pour le débogage.

---

## 3. La Technique de l'Auto-Correction de Prompt

C'est une technique très puissante pour améliorer nos instructions, surtout si une fonctionnalité ne se comporte pas comme prévu.

-   **Votre requête :** *"Ce que tu as fait ne fonctionne pas. Peux-tu consulter notre guide `docs/guide-collaboration-ia.md` et me proposer un prompt optimisé pour que je te redemande la fonctionnalité correctement ?"*

-   **Ce que je ferai :**
    1.  J'analyserai la demande qui a mené au bug.
    2.  J'utiliserai notre charte (Contexte, Objectif, Contraintes...) pour construire une nouvelle requête, plus claire et sans ambiguïté.
    3.  Je vous soumettrai ce prompt amélioré.
    4.  Vous pourrez alors le valider, le modifier, puis me le donner pour que je génère le code corrigé.

C'est la méthode la plus efficace pour déboguer : nous ne corrigeons pas seulement le code, nous corrigeons l'instruction qui a produit le code.

---

## 4. Le Prompt de Débogage Parfait : La Méthode Infaillible

C'est le réflexe le plus important pour résoudre un bug. Pour me signaler un problème, la structure idéale est la suivante.

### Structure du Prompt de Débogage :

```
OBJECTIF :
(Qu'est-ce que vous essayiez de faire ?)

ÉTAPES DE REPRODUCTION :
(Listez précisément les actions que vous avez effectuées. Ex: 1. Je suis allé sur la page X. 2. J'ai cliqué sur le bouton Y. 3. J'ai rempli le champ Z.)

RÉSULTAT INATTENDU (L'ERREUR) :
(Copiez-collez ici le message d'erreur COMPLET et EXACT que vous voyez dans la console du navigateur ou du terminal.)

FICHIERS PERTINENTS (si vous les connaissez) :
(Listez les fichiers qui vous semblent liés au problème.)
```

### Pourquoi c'est crucial :

Un message d'erreur est ma carte au trésor. Il me dit précisément :
*   **Quel** est le problème (ex: `TypeError`, `FirebaseError`).
*   **Où** il se trouve (le nom du fichier et le numéro de la ligne).
*   **Pourquoi** il se produit (la description de l'erreur).

-   **Moins efficace :** "Ça ne marche pas quand je clique." ou "J'ai une erreur de permission."
-   **Très efficace :**
    **OBJECTIF :** Sauvegarder mon image en brouillon.
    **ÉTAPES :** 1. J'ai cliqué sur "Générer". 2. J'ai cliqué sur "Enregistrer en brouillon".
    **ERREUR :** `FirebaseError: Missing or insufficient permissions. Detected at function 'savePostForLater' in file 'src/lib/firestore.ts:123'`

En me donnant ce plan précis, vous ne me demandez pas de deviner dans le noir ; vous me donnez un itinéraire direct pour trouver et corriger la faille.

---

## 5. Construisons Ensemble : La Puissance des Petites Étapes

Pour les fonctionnalités complexes, la meilleure approche est souvent itérative. Plutôt que de demander une cathédrale en une seule fois, demandez d'abord les fondations.

-   **Approche moins efficace :** "Crée un système complet de gestion de galeries avec ajout, suppression, épinglage et partage."
-   **Approche très efficace (en plusieurs étapes) :**
    1.  "D'abord, affiche simplement les galeries existantes sous forme de cartes."
    2.  *(Une fois que cela fonctionne)* "Maintenant, rendons ces cartes cliquables et créons la page de détail pour une galerie."
    3.  *(Une fois que cela fonctionne)* "Ok, sur la page de détail, ajoutons le bouton pour retirer une image de la galerie."

Cette méthode nous permet de valider chaque étape, de corriger les problèmes au plus tôt et de construire des fonctionnalités robustes brique par brique.

---

## Conclusion

Notre efficacité repose sur cette synergie :
-   **Vous apportez :** La vision du produit, la mémoire contextuelle de notre projet et la validation finale.
-   **J'apporte :** La connaissance technique, la vitesse d'écriture du code et l'analyse des erreurs brutes.

En suivant ce guide, nous formons une équipe de développement redoutable.
