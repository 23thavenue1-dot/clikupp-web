# Statut du Système de Tickets (Archivé)

**Ce document est archivé car la fonctionnalité est terminée et stable.** Les informations pertinentes ont été intégrées dans les documents de synthèse comme le `README.md` et le `feature-dev-log.md`.

---

## 1. État Final de la Fonctionnalité (Tickets d'Upload et IA)

Le système de tickets est **100% fonctionnel et intégré**.

*   **Stockage des Données :** Chaque utilisateur possède dans Firestore les champs nécessaires pour les tickets d'upload (`ticketCount`), les tickets IA (`aiTicketCount`), ainsi que les timestamps pour leur recharge (`lastTicketRefill`, `lastAiTicketRefill`). Des champs pour gérer les quotas mensuels (`aiTicketMonthlyCount`) et les tickets payants sont également en place.
*   **Affichage des Compteurs :** Le nombre de tickets restants est affiché de manière fiable et interactive à plusieurs endroits clés de l'interface (Uploader, Modales de génération, etc.).
*   **Décompte Fiable :** Le mécanisme de décompte est actif pour chaque téléversement et chaque utilisation d'une fonctionnalité IA.
*   **Blocage à Zéro :** Un utilisateur qui n'a plus de tickets est bloqué et reçoit une notification claire avec un lien vers la boutique.
*   **Recharge Quotidienne et Mensuelle :** La logique de recharge est entièrement gérée par une Cloud Function (`checkAndRefillTickets` appelée depuis le client, et la logique de l'abonnement dans `onSubscriptionChange`). Le système réinitialise les compteurs journaliers tout en respectant la limite mensuelle pour les tickets IA gratuits.
*   **Hiérarchie de Consommation :** Le système est intelligent et consomme les tickets dans l'ordre le plus avantageux pour l'utilisateur : d'abord les gratuits, puis ceux de l'abonnement, et enfin ceux des packs achetés.

Le système de tickets est une fonctionnalité centrale et robuste de l'application, formant la base du modèle économique "Freemium".
