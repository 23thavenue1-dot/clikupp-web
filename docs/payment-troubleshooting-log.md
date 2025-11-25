
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

### **Étape 6 : Passage en Production (Mode "Live")**

Ce chapitre explique la marche à suivre pour faire passer votre intégration Stripe du mode "Test" au mode "Production" ("Live") afin d'accepter de vrais paiements. Le processus se déroule en deux phases : les actions que vous devez effectuer dans Stripe, et celles que nous devons coordonner pour mettre à jour l'application.

#### **Phase 1 : Actions de l'Utilisateur (VOUS) sur le Tableau de Bord Stripe**

Stripe sépare complètement l'environnement de Test de l'environnement de Production. **Rien de ce que vous avez créé en mode test n'existe en mode production.** Vous devez donc tout recréer.

1.  **Activer votre compte Stripe :** Si ce n'est pas déjà fait, suivez les étapes de Stripe pour activer votre compte en mode "Live" (informations sur l'entreprise, coordonnées bancaires, etc.).
2.  **Basculer en mode "Live" :** Sur votre tableau de bord Stripe, utilisez l'interrupteur pour passer du mode "Test" au mode "Live". L'interface change généralement de couleur (d'orange à vert).
3.  **Recréer tous les produits et prix :** C'est l'étape la plus importante et la plus méticuleuse. Vous devez recréer **à l'identique** chaque produit (packs de tickets et abonnements) en mode "Live".
    *   Pour chaque produit, Stripe générera de **nouveaux ID de prix "Live"** (commençant aussi par `price_...`).
    *   **Action requise :** Vous devrez me fournir cette **nouvelle liste complète d'ID de prix "Live"**.
4.  **Récupérer les nouvelles clés d'API "Live" :** Dans la section `Développeurs > Clés API` de votre tableau de bord (en mode "Live"), vous trouverez de nouvelles clés :
    *   Une nouvelle clé **secrète** (commençant par `sk_live_...`).
    *   Le **secret de signature du webhook** pour le mode "Live".
    *   **Action requise :** Gardez ces deux clés prêtes pour la phase suivante, sans les partager directement ici.

#### **Phase 2 : Actions du Développeur (MOI) et Configuration Finale (VOUS)**

Une fois que vous avez terminé la phase 1 et que vous m'avez fourni la liste des nouveaux ID de prix, le processus final est le suivant :

1.  **Mise à jour des ID de Prix (Mon action) :** Je remplacerai tous les anciens ID de prix de test par les nouveaux ID "Live" dans le fichier `src/app/shop/page.tsx`.
2.  **Reconfiguration de l'extension Firebase (Votre action) :** Une fois le code mis à jour par mes soins, vous devrez :
    *   Aller dans votre **console Firebase**.
    *   Trouver l'extension `Run Payments with Stripe` et cliquer sur **"Reconfigurer l'extension"**.
    *   C'est ici que vous devrez coller votre nouvelle **clé API secrète "Live"** (`sk_live_...`) et votre nouveau **secret de signature du webhook "Live"**.
    *   Valider la reconfiguration.

Après ces deux phases, votre application sera prête à accepter des paiements réels.

---

### **Étape 7 : Résolution du Portail Client (L'épilogue)**

*   **Objectif :** Faire fonctionner le bouton "Gérer mon abonnement" pour permettre aux utilisateurs d'accéder au portail client de Stripe.
*   **Problème Rencontré :** Malgré une série de tentatives (correction CORS, gestion du cas où l'ID client n'existe pas), une erreur `internal` persistait lors de l'appel à la fonction Cloud `createPortalLink`.
*   **Diagnostic Final (LA PERCÉE DE L'UTILISATEUR) :**
    *   **L'observation :** En analysant les fichiers du projet, l'utilisateur a remarqué que j'appelais la fonction `ext-invertase-firestore-stripe-payments-createPortalLink`.
    *   **La déduction :** Il a correctement déduit que `invertase` correspondait à une ancienne version de l'extension et que le nom correct, pour la version installée, était probablement `ext-firestore-stripe-payments-createPortalLink`.
*   **Solution Apportée (LA BONNE) :**
    1.  **Correction du nom de la fonction (`settings/page.tsx`) :** Le nom de la fonction `httpsCallable` a été corrigé pour correspondre exactement au nom de la fonction déployée par l'extension.
*   **Résultat :** **SUCCÈS IMMÉDIAT.** Le bouton a fonctionné du premier coup après cette correction.
*   **Conclusion :** L'extension Stripe était bien installée et fonctionnait. Le problème n'était pas une erreur de configuration complexe, mais une simple mais cruciale erreur de nommage dans le code client, résolue grâce à la vigilance et à l'excellente analyse de l'utilisateur.

---

### **Étape 8 : Correction de l'Affichage de l'Historique des Abonnements**

*   **Objectif :** Afficher un historique des achats propre, sans doublons ni noms de produits incorrects pour les abonnements.
*   **Problème Rencontré :** Pour chaque abonnement souscrit, l'historique affichait deux lignes : une avec le bon nom (ex: "Abonnement - Pro") et une autre avec "Produit inconnu".
*   **Diagnostic Final (validé par l'utilisateur) :**
    *   **L'observation :** La collection `payments` contient plusieurs types de documents. Pour les abonnements, l'extension Stripe crée un document de facturation (`invoice.payment_succeeded`) qui ne contient pas le nom du produit, en plus du document "synthétique" que notre fonction Cloud `onSubscriptionChange` crée.
    *   **La déduction :** Le code React affichait tous les documents de la collection sans distinction, créant ainsi des doublons. Le problème ne venait pas de la récupération des données, mais de leur **filtrage** avant l'affichage.
*   **Solution Apportée (LA BONNE) :**
    1.  **Filtrage Côté Client (`settings/page.tsx`) :** Nous avons ajouté une méthode `.filter()` sur le tableau des paiements, juste avant de l'afficher.
    2.  **Logique du Filtre :** Ce filtre ne laisse passer que deux types de documents :
        *   Les achats de packs, identifiés par la présence de `packUploadTickets` ou `packAiTickets` dans leurs métadonnées.
        *   Nos documents d'abonnement "synthétiques", que nous avons intelligemment marqués avec le drapeau `_generated_for_history: true` dans la fonction Cloud.
*   **Résultat :** **SUCCÈS TOTAL.** L'historique est désormais parfaitement propre. Les doublons ont disparu et seuls les achats pertinents (packs et abonnements avec le bon nom) sont affichés à l'utilisateur.

---

### **Checklist de Validation du Système de Paiement**

Cette liste répertorie tous les points de contrôle critiques à vérifier pour s'assurer que le système de paiement fonctionne de bout en bout.

#### **✅ 1. Configuration du Tableau de Bord Stripe**
-   [x] **Produits Créés :** Chaque pack de tickets existe en tant que "Produit".
-   [x] **Prix Créés :** Chaque produit a un "Prix" et son ID (`price_...`) est correct dans `src/app/shop/page.tsx`.
-   [x] **Métadonnées Ajoutées :** Chaque produit contient les métadonnées nécessaires (ex: `packUploadTickets` avec la valeur correspondante).

#### **✅ 2. Configuration du Projet Firebase**
-   [x] **Extension Stripe Installée (`invertase/firestore-stripe-payments`).**
-   [x] **Configuration de l'Extension Correcte :** Les clés secrètes API et webhook sont renseignées dans les paramètres de l'extension.
-   [x] **Déploiement de la Fonction Réussi :** La commande `firebase deploy --only functions` s'est terminée avec `✔ Deploy complete!`.

#### **✅ 3. Logique Applicative (Code)**
-   [x] **Logique Côté Client (`shop/page.tsx`) :** Le code passe le champ `metadata` avec le nombre de tickets lors de la création de la session.
-   [x] **Logique Serveur (`functions/src/index.js`) :** La fonction simplifiée est déployée et lit directement les métadonnées du document de paiement.

#### **✅ 4. Environnement et Processus de Test**
-   [x] **URL Publique :** Le test est effectué sur l'URL publique de l'application.
-   [x] **Commande de Déploiement :** La commande `firebase deploy --only functions` a été exécutée pour mettre à jour les fonctions Cloud.
-   [x] **Test de Paiement Final :** Le processus de paiement est complété avec succès.
-   [x] **Vérification Firestore :** Après un paiement test réussi, le champ correspondant au pack acheté (ex: `packUploadTickets`) a bien été incrémenté.
-   [x] **Vérification Interface :** Le compteur de tickets dans l'application reflète le nouveau solde.



