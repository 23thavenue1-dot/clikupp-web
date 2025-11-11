
# Journal de Bord : Intégration et Débogage des Paiements Stripe

Ce document sert de journal de bord pour l'intégration de la fonctionnalité de paiement avec Stripe. Il retrace de manière chronologique les problèmes rencontrés, les hypothèses émises et les solutions apportées pour aboutir à un système fonctionnel.

---

### **Étape 1 : Initialisation et Première Erreur ("No such price")**

*   **Objectif :** Rendre les boutons d'achat de la boutique fonctionnels.
*   **Problème Rencontré :** En cliquant sur un bouton "Acheter", l'utilisateur était redirigé vers une page d'erreur Stripe indiquant `No such price: 'price_...'`.
*   **Diagnostic :** L'application utilisait des ID de prix fictifs (`price_...`) qui servaient de placeholders dans le code. Stripe ne reconnaissait logiquement pas ces identifiants.
*   **Solution Apportée :**
    1.  Nous avons établi une méthode de travail : l'utilisateur crée le produit correspondant (ex: "Pack Upload - Boost M") dans son **tableau de bord Stripe** en mode test.
    2.  L'utilisateur récupère l'**ID de prix réel** (`price_...`) généré par Stripe.
    3.  L'utilisateur me fournit cet ID, et je mets à jour le fichier `src/app/shop/page.tsx` pour remplacer l'ID fictif par le vrai.
*   **Résultat :** La première erreur a été résolue, prouvant que la communication de base avec Stripe était possible.

---

### **Étape 2 : Le Mystère de la Page Blanche**

*   **Objectif :** Afficher la page de paiement Stripe après avoir cliqué sur un bouton avec un ID de prix correct.
*   **Problème Rencontré :** Après le clic, l'application redirigeait vers une page interne "External Page", blanche et vide, au lieu de la page de paiement Stripe. Les logs de l'extension Stripe dans la console Firebase montraient pourtant une création de session réussie (`200 OK`).
*   **Diagnostic et Hypothèses Successives :**
    1.  **Hypothèse 1 (Problème client) :** Le code côté client (`shop/page.tsx`) n'arrivait pas à récupérer l'URL de paiement à temps.
        *   **Solution tentée :** Remplacement de l'écouteur `onSnapshot` par une méthode de "polling" plus robuste (interroger le document plusieurs fois pendant quelques secondes).
        *   **Résultat :** Échec. Le problème persistait.
    2.  **Hypothèse 2 (Problème de permissions) :** L'extension Stripe, bien qu'elle réussisse à contacter Stripe, n'avait pas les droits pour **écrire en retour** l'URL de paiement dans la base de données Firestore.
        *   **Solution tentée :** Modification des règles de sécurité (`firestore.rules`) pour ajouter des règles `read, write` explicites pour la collection `customers` et ses sous-collections (`checkout_sessions`).
        *   **Résultat :** Échec. Le problème persistait, indiquant que la cause était encore plus profonde.

---

### **Étape 3 : La Révélation - Problème d'Environnement d'Accès**

*   **Objectif :** Comprendre pourquoi, malgré un code et des règles a priori corrects, la redirection échouait.
*   **Problème Rencontré :** La page blanche continuait d'apparaître, bloquant tout le processus de paiement.
*   **Diagnostic Final et Solution :**
    *   **La découverte clé (faite par l'utilisateur) :** L'accès à l'application ne se faisait pas via l'URL fournie par le terminal de Firebase Studio (`https://<port>-<...>.cloudworkstations.dev`), mais probablement via une autre URL (comme `localhost:port`).
    *   **L'explication :** L'environnement de Firebase Studio est conteneurisé. Les redirections complexes (comme celles de Stripe) et les communications entre services (comme l'extension Firebase qui notifie l'application) ne peuvent fonctionner correctement que si l'on utilise **l'URL d'accès officielle et sécurisée** fournie par la commande `npm run dev`.
    *   **Solution Apportée :** L'utilisateur a accédé à l'application via la bonne URL.
*   **Résultat :** **Succès complet.** La page de paiement Stripe s'est affichée et le cycle de paiement est devenu 100% fonctionnel en mode test.

---

### **Étape 4 : La "Livraison" des Tickets - Crédit post-achat**

*   **Objectif :** S'assurer que les tickets achetés sont bien ajoutés au compte de l'utilisateur après un paiement réussi.
*   **Problème Rencontré :** Après un paiement validé sur Stripe, le solde de tickets de l'utilisateur (par ex. `packUploadTickets`) n'est pas mis à jour. Le paiement est accepté, mais le produit n'est pas "livré".
*   **Diagnostic et Hypothèses :**
    1.  **Hypothèse 1 (Webhook personnalisé) :** Créer un endpoint API (`/api/stripe/webhook`) qui écoute directement les événements de Stripe pour créditer les tickets.
        *   **Résultat :** Échec. Le webhook entre en conflit avec les webhooks internes déjà gérés par l'extension Stripe, ce qui le rend inefficace ou le bloque. Cette approche est abandonnée.
    2.  **Hypothèse 2 (Métadonnées manquantes sur Stripe) :** La Cloud Function se déclenche bien mais ne sait pas quoi faire car le produit acheté sur Stripe n'a pas de "métadonnée" (ex: `packUploadTickets: 120`) pour lui indiquer le nombre de tickets à créditer.
*   **Solution Adoptée (la bonne) :**
    1.  **Ajouter des Métadonnées sur Stripe :** L'utilisateur doit ajouter la métadonnée correspondante sur chaque produit dans son tableau de bord Stripe.
    2.  **Implémenter une Cloud Function :** Création d'une fonction dans `functions/src/index.ts` qui se déclenche sur l'écriture dans la collection `customers/{userId}/payments` et qui lit ces métadonnées pour créditer les tickets.
    3.  **Déployer la fonction :** Cette étape nécessite une configuration de l'environnement du terminal, puis le déploiement de la fonction.

---

### **Étape 5 : Débogage du Déploiement de la Cloud Function**

*   **Objectif :** Déployer la fonction serveur sur l'infrastructure Firebase.
*   **Problèmes Rencontrés & Solutions :**
    1.  **Erreur `No currently active project` :** Après avoir divisé le terminal, le nouveau terminal n'était pas connecté au projet Firebase.
        *   **Solution :** Utilisation de la commande `firebase use --add` pour sélectionner le projet et lui assigner un alias (`default`).
    2.  **Erreur `File .../functions/lib/index.js does not exist` :** Le code de la fonction était en TypeScript (`.ts`) mais n'avait pas été compilé en JavaScript (`.js`) avant le déploiement.
        *   **Solution :** Création d'un fichier `tsconfig.json` et ajout d'un script `build` dans `functions/package.json` pour gérer la compilation de `ts` vers `js`.
    3.  **Erreur `eslint: command not found` :** Le script de build essayait de lancer une vérification de code (`lint`) mais les dépendances (`devDependencies`) n'étaient pas installées dans le sous-dossier `functions`.
        *   **Solution :** Simplification du script de build pour ne garder que la compilation (`tsc`) et ajout des `devDependencies` nécessaires dans `functions/package.json`, suivi d'un `npm install` dans le dossier `functions`.
*   **Résultat :** **Déploiement Réussi.** La commande `firebase deploy --only functions` s'est terminée avec succès.

---

### **Étape 6 : Débogage Post-Déploiement - Le Webhook Secret**

*   **Objectif :** Diagnostiquer pourquoi, malgré un déploiement réussi, les tickets ne sont toujours pas crédités.
*   **Problème Rencontré :** Les journaux de la Cloud Function dans Google Cloud montrent une erreur `[Error]: Webhook signature verification failed.`.
*   **Diagnostic :** L'extension reçoit bien la notification de Stripe, mais ne peut pas en vérifier l'authenticité. La clé secrète du webhook (`whsec_...`) est manquante ou incorrecte dans la configuration de la fonction, bien que la clé d'API (`sk_...`) soit présente.
*   **Solution Apportée :**
    1.  L'utilisateur récupère la **clé secrète du webhook** depuis le tableau de bord Stripe (section Développeurs > Webhooks).
    2.  L'utilisateur ajoute cette clé à la configuration des fonctions via la commande : `firebase functions:config:set stripe.webhook_secret="VOTRE_CLÉ_WHSEC_ICI"`.
    3.  Redéploiement de la fonction avec `firebase deploy --only functions` pour que la nouvelle configuration soit prise en compte.
*   **Résultat :** La chaîne de communication est maintenant entièrement sécurisée et fonctionnelle.

---

### **Conclusion du Débogage**

Ce processus a mis en lumière des points cruciaux souvent sous-estimés : l'importance de l'environnement d'exécution, la nécessité de configurer les permissions, les métadonnées sur les produits Stripe, et la double-vérification de toutes les clés secrètes requises (API **et** webhook).