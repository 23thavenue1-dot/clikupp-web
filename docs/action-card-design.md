# Anatomie du Style des Cartes d'Action

Ce document détaille les classes Tailwind CSS et les techniques utilisées pour créer le style moderne et interactif des cartes d'action dans le `CreationHub`.

---

## 1. Structure de Base

La carte est un `div` qui utilise les propriétés suivantes :
-   `group relative overflow-hidden` : Nécessaire pour que les effets de survol (`group-hover`) et les éléments en position absolue (comme le dégradé) fonctionnent correctement sans dépasser des bordures.
-   `p-4 rounded-lg border` : Définit l'espacement interne, les coins arrondis et une bordure de base.
-   `transition-all duration-300 ease-out` : Assure que tous les changements (couleur, ombre, etc.) se font de manière fluide et non instantanée.

## 2. Le Dégradé de Fond

Le cœur de l'esthétique "IA" repose sur un dégradé subtil mais riche.
-   **Classe :** `bg-gradient-to-br from-slate-900 via-purple-950/40 to-blue-950`
-   **Effet :** Crée un dégradé diagonal (en bas à droite) qui part d'un gris ardoise, passe par un violet profond semi-transparent, et se termine sur un bleu nuit. Cela donne de la profondeur et un aspect technologique.

## 3. Les Effets d'Interaction (au survol)

L'interactivité est cruciale pour donner envie de cliquer.

-   **Bordure illuminée :**
    -   **Classe :** `hover:border-purple-400/50`
    -   **Effet :** Au survol, la couleur de la bordure change pour un violet lumineux, attirant l'attention sur la carte.

-   **Ombre portée dynamique :**
    -   **Classe :** `hover:shadow-2xl hover:shadow-purple-900/50`
    -   **Effet :** Une ombre très prononcée (`shadow-2xl`) apparaît au survol, colorée par une lueur violette (`shadow-purple-900/50`). Cela donne un effet de "soulèvement" et de relief à la carte.

-   **Intensification du dégradé :**
    -   **Classe :** `opacity-90 group-hover:opacity-100`
    -   **Effet :** Le dégradé de fond est légèrement transparent par défaut (`opacity-90`) et devient totalement opaque au survol, le rendant plus vibrant.

## 4. Les Icônes

Les icônes ne sont pas statiques.

-   **Fond et couleur :**
    -   **Classe :** `bg-slate-800 border border-slate-700 text-purple-300`
    -   **Effet :** Un fond sombre avec une bordure et une couleur d'icône dans les tons violets pour rester dans le thème.

-   **Effet au survol du groupe :**
    -   **Classe :** `group-hover:bg-purple-950/50 group-hover:text-purple-200`
    -   **Effet :** Lorsque l'on survole la carte (`group`), le fond de l'icône s'assombrit et sa couleur devient plus vive.

## 5. La Typographie

-   **Titre :** `font-semibold text-slate-100 group-hover:text-white`
    -   Le texte est clair, et devient blanc pur au survol pour un meilleur contraste.
-   **Description :** `text-xs text-slate-400 group-hover:text-slate-300`
    -   Le texte est plus discret, mais s'éclaircit également au survol pour une meilleure lisibilité.

En combinant ces différents effets, on obtient une carte qui est non seulement esthétique au repos, mais qui répond de manière riche et satisfaisante à l'interaction de l'utilisateur.