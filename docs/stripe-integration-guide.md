# Guide d'Intégration Stripe pour Clikup

Ce document détaille la méthode professionnelle et les étapes à suivre pour intégrer Stripe à votre application Clikup, en tirant parti de l'écosystème Firebase.

---

### **Étape 1 : Configuration sur le Tableau de Bord Stripe**

C'est le point de départ. Vous devez préparer votre compte Stripe pour qu'il puisse communiquer avec votre application.

1.  **Créer un compte Stripe :** Rendez-vous sur le site de Stripe et créez votre compte si ce n'est pas déjà fait.

2.  **Créer les "Produits" :** Dans votre tableau de bord Stripe, vous devez modéliser chaque article de votre boutique en tant que "Produit".
    *   **Abonnements** ("Créateur", "Pro", "Maître") : Ce seront des produits avec un **prix récurrent** (mensuel).
    *   **Packs de Tickets** (Upload et IA) : Ce seront des produits avec un **paiement unique** ("one-time").
    *   **Important :** Pour chaque produit, Stripe vous donnera un **ID de Prix** (commençant par `price_...`). Gardez ces IDs précieusement, ils sont la référence pour dire à Stripe quel article l'utilisateur veut acheter.

3.  **Récupérer vos clés d'API :** Dans la section "Développeurs" de votre tableau de bord Stripe, vous trouverez deux types de clés :
    *   Une clé **Publiable** (commençant par `pk_...`) : Elle est destinée à être utilisée dans votre code côté client (votre application Next.js, dans la page boutique). Elle n'est pas considérée comme secrète.
    *   Une clé **Secrète** (commençant par `sk_...`) : Elle est **extrêmement confidentielle**. Elle ne doit **JAMAIS** apparaître dans votre code côté client. Elle sera utilisée uniquement côté serveur, et en l'occurrence, dans la configuration de l'extension Firebase.

---

### **Étape 2 : L'Extension Firebase Officielle "Run Payments with Stripe"**

C'est la pièce maîtresse qui va automatiser 90% du travail complexe et sécurisé. Cette extension s'installe directement depuis votre console Firebase.

*   **Comment ça marche ?**
    1.  Vous l'installez sur votre projet Firebase.
    2.  Pendant la configuration, elle vous demandera votre **clé secrète Stripe**.
    3.  Elle vous demandera la **collection Firestore** où sont stockés vos utilisateurs (dans notre cas, c'est `users`).
    4.  Une fois installée, l'extension va automatiquement créer une sous-collection `checkout_sessions` pour chaque utilisateur.
    5.  Quand un utilisateur veut payer, votre application va simplement devoir **créer un document** dans cette sous-collection. L'extension le détectera, communiquera avec Stripe de manière sécurisée pour créer une session de paiement, et mettra à jour ce même document avec une **URL de paiement**.
    6.  Votre application n'aura plus qu'à récupérer cette URL et y rediriger l'utilisateur. Stripe s'occupe de la page de paiement.

---

### **Étape 3 : Modification du Code Côté Client**

C'est la seule partie de code que vous (ou un développeur) devrez écrire. Elle consiste à orchestrer le processus depuis la page `/shop`.

1.  **Installer la librairie Stripe.js :**
    ```bash
    npm install @stripe/stripe-js @stripe/react-stripe-js
    ```

2.  **Initialiser Stripe :** Sur votre page boutique (`src/app/shop/page.tsx`), vous envelopperez votre page avec un composant `Elements` fourni par `@stripe/react-stripe-js`, en lui passant votre clé **publiable**.

3.  **Modifier les boutons "Acheter" / "S'abonner" :** Au clic, le bouton ne sera plus désactivé. Il déclenchera une fonction qui :
    *   Utilisera une fonction Firestore pour **créer un document** dans `users/{userId}/checkout_sessions`. Ce document contiendra l'**ID du Prix** (le fameux `price_...` de l'étape 1) que l'utilisateur souhaite acheter.
    *   Mettra en place un **écouteur en temps réel** sur ce document nouvellement créé.
    *   Dès que l'extension Firebase aura mis à jour le document avec le champ `url`, l'écouteur le détectera et **redirigera automatiquement l'utilisateur** vers cette page de paiement Stripe.

---

### **Étape 4 : Le Webhook (le retour d'information)**

Cette dernière étape est entièrement gérée par l'extension Firebase, mais il est crucial de comprendre comment elle fonctionne.

*   **Le principe :** Une fois le paiement réussi sur la page Stripe, Stripe envoie une notification sécurisée (un "webhook") à une URL spéciale qui aura été automatiquement configurée par l'extension.

*   **L'action :** L'extension reçoit cette notification. Si le paiement est bien confirmé, elle va **automatiquement mettre à jour le profil de l'utilisateur dans Firestore**. Elle peut, par exemple :
    *   Ajouter `50` au champ `packAiTickets` de l'utilisateur.
    *   Changer le champ `subscriptionTier` à `"pro"` et définir la date de renouvellement.
    *   L'extension peut même être configurée pour attribuer un rôle personnalisé (custom claim) à l'utilisateur, ce qui peut être utile pour les règles de sécurité.

---

En suivant ce plan, l'intégration de Stripe devient beaucoup plus simple et surtout, **sécurisée**. L'extension officielle gère toute la communication sensible, vous laissant vous concentrer sur l'expérience utilisateur dans votre application.