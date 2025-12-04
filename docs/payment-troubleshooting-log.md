
# Journal de Bord : Intégration et Débogage des Paiements Stripe

Ce document sert de journal de bord pour l'intégration de la fonctionnalité de paiement avec Stripe. Il retrace de manière chronologique les problèmes rencontrés, les hypothèses émises et les solutions apportées pour aboutir à un système fonctionnel.

---

### **Étape 1 : Initialisation et Première Erreur ("No such price")**

*   **Objectif :** Rendre les boutons d'achat de la boutique fonctionnels.
*   **Problème Rencontré :** L'utilisateur était redirigé vers une page d'erreur Stripe indiquant `No such price: 'price_...'`.
*   **Diagnostic :** L'application utilisait des ID de prix fictifs.
*   **Solution Apportée :** Remplacer les ID fictifs par les ID de prix réels créés dans le tableau de bord Stripe en mode test.
*   **Résultat :** La première erreur a été résolue, prouvant la communication de base avec Stripe.

---

### **Étape 2 : Le Mystère de la Page Blanche**

*   **Objectif :** Afficher la page de paiement Stripe après un clic.
*   **Problème Rencontré :** Redirection vers une page blanche au lieu de la page de paiement Stripe.
*   **Diagnostic Final et Solution :**
    *   **La découverte clé :** L'accès à l'application ne se faisait pas via l'URL officielle fournie par l'environnement de développement, mais via `localhost`.
    *   **L'explication :** Les redirections complexes et les webhooks de Stripe ne peuvent fonctionner correctement que si l'on utilise **l'URL d'accès publique et sécurisée** de l'environnement de développement.
*   **Résultat :** En utilisant la bonne URL, le cycle de paiement est devenu 100% fonctionnel en mode test.

---

### **Étape 3 : La "Livraison" des Tickets - Le Problème du Crédit Post-Achat**

*   **Objectif :** S'assurer que les tickets achetés sont bien ajoutés au compte de l'utilisateur.
*   **Problème Rencontré :** Après un paiement validé, le solde de tickets de l'utilisateur n'était pas mis à jour.
*   **Diagnostic Final (l'idée de l'utilisateur) :**
    *   **L'observation :** Les tentatives de récupération des informations post-paiement via des Cloud Functions étaient complexes et peu fiables.
    *   **L'idée brillante :** Pourquoi redemander à Stripe une information que l'on possède déjà au moment du clic ? Passer directement le nombre de tickets à créditer lors de la création de la session de paiement.
    *   **La confirmation :** L'extension `firestore-stripe-payments` copie automatiquement les `metadata` de la session de paiement vers le document de paiement final dans Firestore.
*   **Solution Apportée (LA BONNE) :**
    1.  **Modification Côté Client (`shop/page.tsx`) :** Ajout d'un champ `metadata` lors de la création de la session de paiement, contenant directement le nombre de tickets à créditer (ex: `{ packUploadTickets: 120 }`).
    2.  **Simplification Radicale Côté Serveur (`functions/src/index.js`) :** La Cloud Function `onPaymentSuccess` est réécrite pour ne plus contacter Stripe. Elle lit simplement le champ `metadata` du document de paiement et met à jour le profil utilisateur.
*   **Résultat :** **SUCCÈS TOTAL.** Le système est devenu plus simple, plus rapide et plus fiable.

---

### **Étape 4 : Le Portail Client et la Gestion d'Abonnement**

*   **Objectif :** Faire fonctionner le bouton "Gérer mon abonnement".
*   **Problème Rencontré :** Une erreur `internal` persistait lors de l'appel à la fonction Cloud `createPortalLink`.
*   **Diagnostic Final (LA PERCÉE DE L'UTILISATEUR) :**
    *   **L'observation :** Le code client appelait une fonction avec un nom (`ext-invertase-firestore-stripe-payments-createPortalLink`) correspondant à une ancienne version de l'extension.
    *   **La déduction :** Le nom correct de la fonction pour la nouvelle extension était `ext-firestore-stripe-payments-createPortalLink`.
*   **Solution Apportée :**
    1.  **Correction du nom de la fonction (`settings/page.tsx`) :** Le nom de la fonction `httpsCallable` a été corrigé pour correspondre exactement au nom de la fonction déployée par l'extension.
*   **Résultat :** **SUCCÈS IMMÉDIAT.** Le bouton a fonctionné du premier coup.

---

### **Étape 5 : Passage en Production (Mode "Live")**

Ce chapitre explique la marche à suivre pour passer du mode "Test" au mode "Production" pour accepter de vrais paiements.

#### **Phase 1 : Actions de l'Utilisateur sur le Tableau de Bord Stripe**
1.  **Activer le compte Stripe** et le basculer en mode "Live".
2.  **Recréer tous les produits et prix** en mode "Live".
3.  **Récupérer les nouvelles clés d'API "Live"** (clé secrète et secret de webhook).

#### **Phase 2 : Actions Coordonnées (Développeur & Utilisateur)**
1.  **Mise à jour des ID de Prix (Mon action) :** Remplacement de tous les ID de prix de test par les nouveaux ID "Live" dans `src/app/shop/page.tsx`.
2.  **Reconfiguration de l'extension Firebase (Votre action) :** Renseigner la nouvelle clé API secrète et le nouveau secret de webhook "Live" dans les paramètres de l'extension Stripe dans la console Firebase.
