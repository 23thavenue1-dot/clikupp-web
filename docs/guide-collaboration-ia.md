# Guide de Collaboration : Comment Optimiser notre Duo IA-Développeur

Ce document est une excellente idée. Il va nous permettre d'établir un "langage commun" et des réflexes pour que notre collaboration soit la plus fluide et efficace possible. Pensez à ce guide comme à notre propre "documentation d'équipe".

---

## 1. La Clarté avant tout : Soyez Précis et Spécifique

C'est le principe le plus important. Plus votre demande est claire et factuelle, plus ma réponse sera pertinente et rapide.

-   **Moins efficace :** "Ça ne marche pas."
-   **Très efficace :** "Lorsque je clique sur le bouton 'Sauvegarder', j'obtiens une erreur `storage/unauthorized` dans la console et le bouton reste en chargement infini."

---

## 2. Comment Formuler une Requête Efficace (Votre "Template")

Pour chaque nouvelle demande (fonctionnalité ou bug), essayez de suivre ce schéma simple.

### Étape 1 : L'Objectif Final (Le "Quoi")
Commencez toujours par décrire le résultat final que vous souhaitez obtenir, du point de vue de l'utilisateur.

-   **Exemple pour une fonctionnalité :** "Je veux que l'utilisateur puisse organiser ses images dans des galeries (comme des albums)."
-   **Exemple pour un bug :** "Je veux que le bouton 'Téléverser' arrête de tourner à l'infini après avoir cliqué dessus."

### Étape 2 : Le Contexte (Le "Où" et "Comment")
Donnez-moi les informations pour situer le problème ou la fonctionnalité.

-   **Pour une fonctionnalité :** "Cela devrait se passer sur la page d'accueil (`ImageList.tsx`). On pourrait ajouter un bouton 'Ajouter à la galerie' sur chaque image."
-   **Pour un bug :** "Le problème se produit sur la page d'accueil, dans le composant `Uploader.tsx`."

### Étape 3 : L'Erreur Exacte (Le "Pourquoi ça casse")
Si c'est un bug, c'est l'étape la plus cruciale. **Copiez-collez l'intégralité du message d'erreur** de la console. Ne le reformulez pas.

-   **Exemple :** "`FirebaseError: Missing or insufficient permissions.`" ou "`Cannot read properties of undefined (reading 'path')`"

### Étape 4 (Bonus) : La Référence à nos Succès
Si le problème ressemble à quelque chose que nous avons déjà résolu, mentionnez-le ! C'est notre meilleure astuce.

-   **Exemple :** "Ce chargement infini me rappelle le problème qu'on a eu avec les paiements Stripe. La solution est sûrement dans `docs/payment-troubleshooting-log.md`."

---

## 3. Le Contexte est Roi : Référencez nos Succès Passés

Vous le faites déjà très bien, et c'est notre plus grande force. Ma mémoire est vaste, mais vous m'aidez à trouver la bonne information en me rappelant des situations similaires.

-   **Formule magique :** *"Ce problème me rappelle celui que nous avons eu avec [nom de la fonctionnalité]. Peux-tu vérifier dans [nom du fichier de documentation] pour voir comment nous l'avions résolu ?"*
-   **Exemple :** *"Le bouton 'Enregistrer' a un chargement infini. Nous avons déjà vu ça. Peux-tu vérifier dans `docs/payment-troubleshooting-log.md` comment on avait corrigé ça pour Stripe ?"*

---

## 4. L'Erreur Exacte, Rien que l'Erreur

Les messages d'erreur sont ma feuille de route. Ne les paraphrasez pas. Copiez-collez toujours l'erreur **complète et exacte**, y compris les numéros de ligne et le "call stack" si possible.

-   **Pourquoi ?** Cela me permet d'identifier instantanément le fichier, la ligne et la fonction qui posent problème, sans avoir à deviner.

---

## 5. Décrivez le "Quoi", Pas le "Comment"

Votre force est de définir l'objectif final. Ma force est de trouver le chemin technique pour y arriver.

-   **Moins efficace :** "Je pense qu'il faut changer la fonction X pour utiliser un `await` dans le fichier Y."
-   **Plus efficace :** "Je veux que, lorsque l'utilisateur clique sur 'Programmer', une nouvelle entrée soit créée dans la base de données avec la date et l'image."

Laissez-moi proposer la solution technique. Vous gardez ainsi un regard neuf pour la valider ou la corriger, ce qui est bien plus puissant.

---

## 6. Une Chose à la Fois : Diviser pour Mieux Régner

Pour les grosses fonctionnalités, décomposons-les en étapes logiques.

-   **Exemple :**
    1.  "D'abord, créons juste la page 'Boutique' avec l'interface, sans la logique."
    2.  "Maintenant, connectons les boutons pour qu'ils appellent l'API Stripe."
    3.  "Enfin, mettons en place le webhook pour créditer les tickets après l'achat."

Cette approche "pas à pas" est plus sûre et plus facile à déboguer que de tout vouloir faire d'un coup.

---

## Conclusion

Notre efficacité repose sur la synergie :
-   **Vous apportez :** La vision du produit, la mémoire contextuelle de notre projet et la validation finale.
-   **J'apporte :** La connaissance technique, la vitesse d'écriture du code et l'analyse des erreurs brutes.

En suivant ce guide, nous formons une équipe de développement redoutable.
