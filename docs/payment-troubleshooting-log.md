
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
    3.  **Hypothèse 3 (Erreur de clé secrète) :** La fonction Cloud n'arrivait pas à s'authentifier auprès de Stripe car sa clé secrète n'était pas configurée correctement (elle n'a pas accès au `.env` de l'application Next.js).
        * **Solution Tentée :** Configuration de la clé secrète via `firebase functions:config:set` et redéploiement de la fonction.
        * **Résultat :** La fonction se déclenchait mais continuait d'échouer, car la structure des données renvoyées par Stripe n'était pas celle attendue.

---

### **Étape 5 : La Percée - Simplification Radicale (LA SOLUTION FINALE)**

*   **Objectif :** Résoudre le problème de non-crédit de tickets de manière fiable.
*   **Problème Rencontré :** La fonction Cloud, même bien configurée, n'arrivait pas à interpréter la réponse de l'extension Stripe pour trouver le produit acheté et ses métadonnées. Les logs montraient une erreur constante : `Aucune métadonnée de ticket trouvée`.
*   **Diagnostic Final (l'idée de l'utilisateur) :**
    *   **L'observation :** Le problème central est la communication entre notre fonction Cloud et l'API Stripe, qui est complexe et peu fiable.
    *   **L'idée brillante :** Pourquoi redemander à Stripe une information que nous possédons déjà au moment du clic sur "Acheter" ? Et si le frontend passait directement le nombre de tickets à créditer lors de la création de la session de paiement ?
    *   **La confirmation :** L'extension `invertase/firestore-stripe-payments` copie automatiquement les `metadata` de la session de paiement vers le document de paiement final dans Firestore (`customers/{userId}/payments/{paymentId}`).
*   **Solution Apportée (LA BONNE) :**
    1.  **Modification Côté Client (`shop/page.tsx`) :** Le code est mis à jour pour ajouter un champ `metadata` lors de la création de la session de paiement. Ce champ contient directement le nombre de tickets à créditer (ex: `{ packUploadTickets: 120, packAiTickets: 0 }`).
    2.  **Simplification Radicale Côté Serveur (`functions/src/index.js`) :**
        *   La fonction `onPaymentSuccess` est entièrement réécrite pour être beaucoup plus simple.
        *   Elle n'a **plus besoin de clé secrète Stripe** et ne contacte plus jamais l'API Stripe.
        *   Elle se déclenche, lit le document `payment`, trouve le champ `metadata`, et utilise directement les valeurs (`packUploadTickets`, `packAiTickets`) pour incrémenter le bon champ sur le profil de l'utilisateur.
*   **Résultat :** **SUCCÈS TOTAL.** Le système est devenu plus simple, plus rapide, plus fiable et plus économique (pas d'appels API supplémentaires). Les tickets sont maintenant crédités instantanément après le paiement.

---

### **Checklist de Validation du Système de Paiement**

Cette liste répertorie tous les points de contrôle critiques à vérifier pour s'assurer que le système de paiement fonctionne de bout en bout.

#### **✅ 1. Configuration du Tableau de Bord Stripe**
-   [x] **Produits Créés :** Chaque pack de tickets existe en tant que "Produit".
-   [x] **Prix Créés :** Chaque produit a un "Prix" et son ID (`price_...`) est correct dans `src/app/shop/page.tsx`.

#### **✅ 2. Configuration du Projet Firebase**
-   [x] **Extension Stripe Installée (`invertase/firestore-stripe-payments`).**
-   [x] **Configuration de l'Extension Correcte :** Les clés secrètes API et webhook sont renseignées dans les paramètres de l'extension.
-   [x] **Déploiement de la Fonction Réussi :** La commande `firebase deploy --only functions` s'est terminée avec `✔ Deploy complete!`.

#### **✅ 3. Logique Applicative (Code)**
-   [x] **Logique Côté Client (`shop/page.tsx`) :** Le code passe le champ `metadata` avec le nombre de tickets lors de la création de la session.
-   [x] **Logique Serveur (`functions/src/index.js`) :** La fonction simplifiée est déployée et lit directement les métadonnées du document de paiement.

#### **✅ 4. Environnement et Processus de Test**
-   [x] **URL Publique :** Le test est effectué sur l'URL publique de l'application.
-   [x] **Test de Paiement Final :** Le processus de paiement est complété avec succès.
-   [x] **Vérification Firestore :** Après un paiement test réussi, le champ correspondant au pack acheté (ex: `packUploadTickets`) a bien été incrémenté.
-   [x] **Vérification Interface :** Le compteur de tickets dans l'application reflète le nouveau solde.
