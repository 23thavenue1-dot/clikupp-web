
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

### **Étape 3 : La Révélation - Problème d'Environnement**

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
*   **Problème Rencontré :** Après un paiement validé sur Stripe, le solde de tickets de l'utilisateur (par ex. `packUploadTickets`) n'est pas mis à jour dans l'application. Le paiement est accepté, mais le produit n'est pas "livré".
*   **Diagnostic :** L'extension Stripe, par défaut, ne sait pas quel champ de la base de données mettre à jour pour un produit donné. Elle reçoit bien la confirmation de paiement de Stripe, mais elle ne sait pas que le produit avec l'ID `price_...` correspond à l'ajout de 120 tickets dans le champ `packUploadTickets`.
*   **Solution Explorée (et Échouée) :**
    1.  **Hypothèse :** Gérer la livraison via un webhook personnalisé (`/api/stripe/webhook`).
    2.  **Mise en place :** Création du webhook qui écoute les événements de Stripe, lit les métadonnées du produit et tente de mettre à jour Firestore.
    3.  **Résultat :** **Échec.** Le webhook n'est jamais déclenché ou entre en conflit avec le fonctionnement interne de l'extension. L'ajout des tickets ne se fait pas.
    4.  **Conclusion :** Cette approche est abandonnée au profit de la méthode native de l'extension.

*   **Solution à Apporter (Méthode Native) :**
    1.  **Utiliser les Métadonnées Stripe :** La solution professionnelle consiste à ajouter des "métadonnées" directement sur le produit dans le tableau de bord Stripe. On va y ajouter des paires clé-valeur que l'extension pourra lire, par exemple : `firebaseRole: 'boost_upload_120'`.
    2.  **Configurer l'Extension Firebase :** Dans la configuration de l'extension Stripe, il y a un champ pour "synchroniser les rôles". On y indiquera que lorsqu'un utilisateur achète un produit avec le rôle `boost_upload_120`, l'extension doit lui ajouter ce rôle.
    3.  **Créer une Cloud Function (ou utiliser un webhook personnalisé) :** Créer une petite fonction serveur qui se déclenche quand un utilisateur reçoit un nouveau rôle. Cette fonction lira le rôle (`boost_upload_120`) et effectuera la mise à jour correspondante dans la base de données (ex: `updateDoc(userRef, { packUploadTickets: increment(120) })`).

---

### **Conclusion du Débogage**

Ce processus de débogage a mis en lumière des points cruciaux souvent sous-estimés :
1.  **L'importance de l'environnement d'exécution** et de l'utilisation des bonnes URL.
2.  La nécessité d'une **configuration de permissions** explicite dans les règles de sécurité.
3.  Le besoin de **configurer la logique métier post-paiement** (la "livraison") via les métadonnées Stripe et les fonctions serveur, car l'extension ne peut pas le deviner seule.

La résolution de ces problèmes est une victoire majeure et valide toute l'architecture de paiement mise en place.
