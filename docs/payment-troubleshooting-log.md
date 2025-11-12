
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

### **Étape 4 : La "Livraison" des Tickets - Le Problème du Crédit Post-Achat**

*   **Objectif :** S'assurer que les tickets achetés sont bien ajoutés au compte de l'utilisateur après un paiement réussi.
*   **Problème Rencontré :** Après un paiement validé sur Stripe, le solde de tickets de l'utilisateur (par ex. `packUploadTickets`) n'est pas mis à jour. Le paiement est accepté, mais le produit n'est pas "livré".
*   **Diagnostic et Hypothèses :**
    1.  **Hypothèse 1 (Webhook personnalisé) :** Créer un endpoint API (`/api/stripe/webhook`) qui écoute directement les événements de Stripe pour créditer les tickets.
        *   **Résultat :** Échec. Le webhook entre en conflit avec les webhooks internes déjà gérés par l'extension Stripe. Cette approche est abandonnée.
    2.  **Hypothèse 2 (Déclencheur Firestore) :** Créer une Cloud Function qui se déclenche sur l'écriture dans la collection `customers/{userId}/payments` et qui crédite les tickets.
        *   **Résultat :** Échec. La fonction se déploie mais ne se déclenche pas, car pour les paiements uniques, l'extension n'écrit pas systématiquement dans cette collection. L'approche est trop complexe et fragile.

---

### **Étape 5 : La Percée - La Clé Secrète du Webhook**

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
*   **Résultat :** La chaîne de communication est maintenant entièrement sécurisée et correctement configurée.

---

### **Étape 6 : La Stratégie Finale - Le Webhook Unique et Robuste**

*   **Objectif :** Résoudre le problème de non-crédit de tickets en simplifiant et en fiabilisant la logique.
*   **Problème Rencontré :** Malgré une clé de webhook correcte, les tickets ne sont pas crédités. Les logs de Stripe montrent des erreurs indiquant que les métadonnées sur le produit ne sont pas trouvées et que l'ID utilisateur est manquant.
*   **Diagnostic :**
    1.  Le `client_reference_id` (contenant l'ID utilisateur) n'était pas correctement passé lors de la création de la session de paiement.
    2.  Le webhook ne lisait pas les métadonnées (`packUploadTickets`, `packAiTickets`) attachées au **Produit** sur Stripe.
*   **Solution Apportée (Stratégie Finale) :**
    1.  **Modification Côté Client (`shop/page.tsx`) :** Le code est mis à jour pour s'assurer que `client_reference_id: user.uid` est toujours inclus lors de la création du document `checkout_sessions`.
    2.  **Modification Côté Serveur (`functions/src/index.ts`) :**
        *   Une seule et unique fonction `stripeWebhook` est conservée.
        *   Elle écoute l'événement `checkout.session.completed`.
        *   Elle récupère l'ID utilisateur via `session.client_reference_id`.
        *   Elle va chercher les `line_items` (articles du panier) pour trouver l'ID du produit.
        *   Elle fait un appel à l'API Stripe pour **récupérer l'objet Produit complet** et lire ses métadonnées.
        *   Elle crédite le bon champ (`packUploadTickets` ou `packAiTickets`) sur le bon utilisateur.
*   **Résultat Attendu :** Une architecture simple, directe et robuste. Le webhook sait maintenant **QUI** a payé (`client_reference_id`) et **QUOI** il a acheté (métadonnées du produit).

---

### **Checklist de Validation du Système de Paiement**

Cette liste répertorie tous les points de contrôle critiques à vérifier pour s'assurer que le système de paiement fonctionne de bout en bout.

#### **✅ 1. Configuration du Tableau de Bord Stripe**
-   [x] **Produits Créés :** Chaque pack de tickets existe en tant que "Produit".
-   [x] **Prix Créés :** Chaque produit a un "Prix" et son ID (`price_...`) est correct dans `src/app/shop/page.tsx`.
-   [ ] **Métadonnées des Produits :** **C'est crucial.** Chaque **Produit** (pas le prix) doit avoir une "Métadonnée" qui correspond au champ à incrémenter.
    *   Exemple : Clé = `packUploadTickets`, Valeur = `120`.
-   [x] **Webhook Endpoint :** L'extension a créé un endpoint qui écoute `checkout.session.completed`.
-   [x] **Webhook Secret :** La "clé secrète de signature" (`whsec_...`) est disponible et a été copiée.

#### **✅ 2. Configuration du Projet Firebase**
-   [x] **Extension Stripe Installée.**
-   [x] **Configuration de l'Extension :**
    *   La clé secrète de Stripe (`sk_test_...`) est renseignée.
    *   La **clé secrète du webhook** (`whsec_...`) est bien renseignée dans le champ "Stripe webhook secret".
-   [x] **Déploiement des Fonctions Réussi :** La commande `firebase deploy --only functions` s'est terminée avec `✔ Deploy complete!`.

#### **✅ 3. Logique Applicative (Code)**
-   [x] **Logique Côté Client (`shop/page.tsx`) :** Le code est à jour pour passer le `client_reference_id: user.uid`.
-   [x] **Logique Serveur (`functions/src/index.ts`) :** La fonction unique `stripeWebhook` est déployée et contient la logique pour lire les métadonnées du produit et créditer le bon champ.

#### **✅ 4. Environnement et Processus de Test**
-   [x] **URL Publique :** Le test est effectué sur l'URL publique de l'application.
-   [ ] **Test de Paiement Final :** Le processus de paiement doit être complété avec succès.
-   [ ] **Vérification Firestore :** Après un paiement test réussi, vérifier manuellement dans la console Firestore :
    1.  Naviguer vers `users` > `{votreUserId}`.
    2.  Le champ `stripeCustomerId` doit contenir un ID `cus_...`.
    3.  Le champ correspondant au pack acheté (ex: `packUploadTickets`) doit avoir été incrémenté.
-   [ ] **Vérification Interface :** Le compteur de tickets dans l'application reflète le nouveau solde.
