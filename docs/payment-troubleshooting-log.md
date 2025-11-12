
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
    *   **Solution Apportée :** L'utilisateur a accédé à l'application via la bonne URL publique.
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
    3.  **Erreur `eslint: command not found` & `No matching version found` :** Le script de build et l'installation des dépendances (`npm install`) échouaient à cause de dépendances de développement manquantes ou de versions de paquets incorrectes (`@types/micro`).
        *   **Solution :** Simplification du script de build pour ne garder que la compilation (`tsc`), correction et nettoyage du fichier `functions/package.json` pour y inclure les bonnes dépendances et retirer celles qui sont superflues.
*   **Résultat :** **Déploiement Réussi.** La commande `firebase deploy --only functions` s'est terminée avec succès après plusieurs itérations.

---

### **Étape 6 : La Percée - La Clé Secrète du Webhook**

*   **Objectif :** Diagnostiquer pourquoi, malgré un déploiement réussi, les tickets ne sont toujours pas crédités.
*   **Problème Rencontré :** Après un test de paiement, les tickets ne sont toujours pas ajoutés. Le problème persiste.
*   **Diagnostic (la découverte cruciale de l'utilisateur) :**
    *   L'utilisateur a partagé une capture d'écran de la configuration de l'**extension Stripe** dans la console Firebase.
    *   Cette capture a révélé que le champ **"Stripe webhook secret" était vide**.
    *   **Conclusion :** L'extension Stripe est un module isolé qui ne lit pas la configuration générale des fonctions que nous avions mise en place (`functions:config:set`). Elle ne lit que **sa propre configuration**. Le webhook recevait les appels, mais les rejetait car il n'avait pas la clé `whsec_...` pour les valider.
*   **Solution Apportée (LA BONNE) :**
    1.  L'utilisateur a récupéré la clé secrète du webhook (`whsec_...`) depuis le tableau de bord Stripe (section Développeurs > Webhooks).
    2.  L'utilisateur a **collé cette clé directement dans le champ de configuration de l'extension Stripe** dans la console Firebase.
    3.  L'utilisateur a cliqué sur "Terminer la mise à jour" pour que l'extension soit redéployée avec la bonne clé.
*   **Résultat :** La chaîne de communication est maintenant entièrement sécurisée et correctement configurée. C'est l'avancée majeure qui devrait tout débloquer.

---

### **Étape 7 : Changement de Stratégie - Le Webhook Unique**

*   **Objectif :** Résoudre le conflit entre le webhook de l'extension et notre fonction personnalisée.
*   **Problème Rencontré :** Malgré toutes les configurations, les tickets ne sont pas crédités. Le webhook de l'extension et notre fonction déclenchée sur Firestore semblent entrer en conflit ou ne pas communiquer.
*   **Diagnostic :** L'approche de déclencher une fonction sur une écriture Firestore (`onPaymentCreated`) est trop complexe et fragile. Le webhook de l'extension n'est pas conçu pour déclencher ce genre de logique personnalisée directement. La méthode la plus propre est de centraliser toute la logique dans un seul webhook qui gère tout de A à Z.
*   **Solution Apportée (Stratégie Finale) :**
    1.  **Abandon des fonctions multiples :** Le code dans `functions/src/index.ts` est entièrement remplacé. Les fonctions `syncStripeCustomerId` et `creditTicketsOnPayment` sont supprimées.
    2.  **Création d'un Webhook Unique et Robuste :** Une seule fonction `stripeWebhook` est créée.
    3.  **Logique Centralisée :** Cette unique fonction écoute l'événement `checkout.session.completed` de Stripe. Quand elle le reçoit, elle valide la signature, récupère l'ID utilisateur, lit les métadonnées du produit acheté sur Stripe, et crédite directement le bon nombre de tickets au bon utilisateur.
    4.  **Déploiement :** La nouvelle fonction est déployée pour remplacer l'ancienne logique.
*   **Résultat Attendu :** Une architecture beaucoup plus simple, plus directe et plus facile à déboguer, qui devrait enfin résoudre le problème de crédit de tickets.

---

### **Checklist de Validation du Système de Paiement**

Cette liste répertorie tous les points de contrôle critiques à vérifier pour s'assurer que le système de paiement fonctionne de bout en bout.

#### **✅ 1. Configuration du Tableau de Bord Stripe**
-   [ ] **Produits Créés :** Chaque pack de tickets (Upload S, M, L et IA S, M, L) existe en tant que "Produit" dans Stripe.
-   [ ] **Prix Créés :** Chaque produit a un "Prix" associé (paiement unique) et l'ID du prix (`price_...`) a été correctement copié dans le code (`src/app/shop/page.tsx`).
-   [ ] **Métadonnées des Produits :** **C'est crucial.** Chaque **Produit** (pas le prix) doit avoir une "Métadonnée" qui correspond exactement au champ à incrémenter dans Firestore.
    *   Exemple pour le pack "Boost Upload M" : Clé = `packUploadTickets`, Valeur = `120`.
    *   Exemple pour le pack "Boost IA L" : Clé = `packAiTickets`, Valeur = `150`.
-   [ ] **Clés d'API :** La clé secrète (`sk_test_...`) est disponible.
-   [ ] **Webhook Endpoint :** L'extension Firebase a automatiquement créé un endpoint dans la section "Développeurs > Webhooks". Il doit être activé et écouter l'événement `checkout.session.completed`.
-   [ ] **Webhook Secret :** La "clé secrète de signature" (`whsec_...`) de cet endpoint est disponible et a été copiée.

#### **✅ 2. Configuration du Projet Firebase**
-   [ ] **Extension Stripe Installée :** L'extension "Run payments with Stripe" est bien installée sur le projet Firebase.
-   [ ] **Configuration de l'Extension :**
    *   La clé secrète de Stripe (`sk_test_...`) est bien renseignée dans les paramètres de l'extension.
    *   La **clé secrète du webhook** (`whsec_...`) est maintenant bien renseignée dans le champ "Stripe webhook secret" de l'extension.
-   [ ] **Déploiement des Fonctions Réussi :** La commande `firebase deploy --only functions` s'est terminée avec `✔ Deploy complete!`.

#### **✅ 3. Logique Applicative (Code)**
-   [ ] **Logique Côté Client (`shop/page.tsx`) :** Le clic sur un bouton d'achat crée bien un document dans `customers/{userId}/checkout_sessions` dans Firestore, en passant bien le `client_reference_id: user.uid`.
-   [ ] **Logique Serveur (`functions/src/index.ts`) :**
    *   La fonction unique `stripeWebhook` est bien présente, sécurisée, et contient la logique pour lire les métadonnées du produit et créditer le bon champ (`packUploadTickets` ou `packAiTickets`).

#### **✅ 4. Environnement et Processus de Test**
-   [ ] **URL Publique :** Le test est effectué sur l'URL publique de l'application (`...hosted.app` ou `...firebase.studio`), **JAMAIS** sur `localhost`.
-   [ ] **Test de Paiement :** Le processus de paiement est complété avec succès en utilisant une carte de test Stripe.
-   [ ] **Vérification Firestore :** Après un paiement test réussi, vérifier manuellement dans la console Firestore :
    1.  Naviguer vers `users` > `{votreUserId}`.
    2.  Le champ `stripeCustomerId` doit contenir un ID commençant par `cus_...`.
    3.  Le champ correspondant au pack acheté (ex: `packUploadTickets`) doit avoir été incrémenté.
-   [ ] **Vérification Interface :** Le compteur de tickets dans l'application reflète le nouveau solde.

