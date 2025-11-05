# Plan d'Action : Implémentation de la Boutique

Ce document détaille les étapes méthodiques pour l'intégration d'une boutique et d'un système de monétisation dans Clikup. Chaque chapitre représente une étape clé du développement.

---

### Chapitre 1 : L'Interface - Création de la Page "Boutique"

**Objectif :** Construire la "vitrine" où les offres seront présentées aux utilisateurs.

**Actions :**
1.  Créer une nouvelle route et un nouveau fichier de page : `src/app/shop/page.tsx`.
2.  Concevoir l'interface utilisateur pour présenter de manière claire et attractive :
    *   Les 3 offres d'abonnement ("Créateur", "Pro", "Maître").
    *   Les 3 packs de "Boost Upload".
    *   Les 3 packs de "Boost IA".
3.  Utiliser les composants ShadCN (Card, Button, etc.) pour une intégration visuelle cohérente avec le reste de l'application.
4.  À ce stade, les boutons d'achat ("S'abonner", "Acheter") seront présents mais non fonctionnels (désactivés ou affichant une notification "Bientôt disponible").

**Résultat attendu :** Une page `/shop` statique mais visuellement complète, accessible depuis l'interface (par exemple, en cliquant sur le compteur de tickets).

---

### Chapitre 2 : La Fondation - Mise à Jour du Modèle de Données

**Objectif :** Préparer la base de données Firestore à gérer les soldes de tickets payants.

**Actions :**
1.  Mettre à jour le schéma de l'entité `User` dans `docs/backend.json` pour y inclure les nouveaux champs :
    *   `packUploadTickets` (number) : Solde de tickets d'upload achetés.
    *   `packAiTickets` (number) : Solde de tickets IA achetés.
    *   `subscriptionUploadTickets` (number) : Quota mensuel d'upload lié à l'abonnement.
    *   `subscriptionAiTickets` (number) : Quota mensuel d'IA lié à l'abonnement.
    *   `subscriptionTier` (string) : Niveau d'abonnement (ex: "creator", "pro").
    *   `subscriptionRenewalDate` (date) : Date du prochain renouvellement.
2.  Mettre à jour le fichier d'inscription `src/app/signup/page.tsx` pour que les nouveaux utilisateurs soient créés avec des valeurs par défaut pour ces champs (ex: 0, `null` ou `none`).

**Résultat attendu :** La structure de données est prête. L'application ne plantera pas à cause de champs manquants pour les nouveaux utilisateurs.

---

### Chapitre 3 : La Logique - Hiérarchie de Consommation des Tickets

**Objectif :** Implémenter un système de décompte juste et transparent pour l'utilisateur.

**Actions :**
1.  Modifier les fonctions qui décrémentent les tickets (`decrementTicketCount`, `decrementAiTicketCount` dans `src/lib/firestore.ts`).
2.  Intégrer la logique de priorité pour le décompte :
    1.  Utiliser en premier les **tickets gratuits quotidiens**.
    2.  Si le solde gratuit est à zéro, utiliser les **tickets mensuels de l'abonnement**.
    3.  En dernier recours, si les deux autres soldes sont épuisés, utiliser les **tickets achetés via des packs**.
3.  Mettre à jour l'affichage des compteurs dans l'interface (`Uploader.tsx`, `ImageList.tsx`, `edit/[imageId]/page.tsx`) pour refléter le solde total disponible.

**Résultat attendu :** Le système de tickets est intelligent, complet et respecte la valeur des achats de l'utilisateur.

---

### Chapitre 4 : La Transaction - Intégration d'une Solution de Paiement (Stripe)

**Objectif :** Permettre des transactions réelles et sécurisées.

**Actions :**
1.  **Mise en place côté serveur :**
    *   Créer des endpoints (API routes ou Server Actions) pour communiquer avec l'API de Stripe.
    *   Créer une logique pour générer des sessions de paiement pour chaque produit (abonnement ou pack).
2.  **Mise en place côté client :**
    *   Installer et configurer la librairie Stripe.js sur la page de la boutique.
    *   Modifier les boutons d'achat pour qu'ils appellent les endpoints du serveur et redirigent l'utilisateur vers la page de paiement de Stripe.
3.  **Gestion des retours (Webhooks) :**
    *   Configurer un "webhook" : une URL que Stripe appellera pour notifier notre application d'un paiement réussi.
    *   Créer la logique qui, à la réception de cette notification, mettra à jour le profil de l'utilisateur dans Firestore (ajout des tickets, activation de l'abonnement).

**Résultat attendu :** Un cycle de vente complet et fonctionnel. Un utilisateur peut cliquer, payer et recevoir ses tickets ou son abonnement automatiquement.

---

Ce plan d'action structuré nous garantit de construire une fonctionnalité solide, étape par étape, en minimisant les risques d'erreurs.
