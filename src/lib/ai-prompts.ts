
'use client';

export type PromptSuggestion = {
  title: string;
  prompt: string;
};

export type PromptCategory = {
  name: string;
  description: string;
  icon: string;
  prompts: PromptSuggestion[];
};

export const suggestionCategories: PromptCategory[] = [
    {
        name: "Portraits de Qualité Studio",
        description: "Obtenez des portraits dignes d'un photographe professionnel.",
        icon: "UserRound",
        prompts: [
            { title: "Portrait Idéalisé", prompt: "Transforme ce portrait pour le rendre plus attractif et charismatique. Optimise la lumière pour sculpter le visage, lisse la peau tout en gardant un aspect naturel, accentue la netteté du regard et donne une expression de confiance subtile." },
            { title: "Portrait 'Corporate' Pro", prompt: "Optimise ce portrait pour un profil professionnel type LinkedIn. Utilise une lumière de studio douce et flatteuse, améliore la netteté des détails et donne au sujet une expression qui inspire la compétence et la confiance." },
            { title: "Lumière Dramatique 'Clair-Obscur'", prompt: "Recrée l'éclairage de ce portrait en style clair-obscur, inspiré des peintures de Rembrandt. Crée un fort contraste entre une lumière douce qui illumine une partie du visage et des ombres profondes pour un effet artistique et intense." },
            { title: "Effet 'Glow' Lumineux", prompt: "Donne à la peau du sujet un effet 'glow' sain et lumineux. Adoucis les ombres et ajoute une légère lueur diffuse pour un rendu flatteur et radieux." },
        ],
    },
    {
        name: "Transformeur de Style Artistique",
        description: "Appliquez des styles artistiques complets pour réinventer totalement une image.",
        icon: "Palette",
        prompts: [
            { title: "Style BD Américaine (Comic Book)", prompt: "Transforme cette photo en une illustration de bande dessinée américaine. Détoure parfaitement le sujet, applique des contours noirs épais, des couleurs primaires vives et un effet de trame (halftone) pour le rendu classique." },
            { title: "Personnage de Jeu Vidéo AAA", prompt: "Redessine le sujet comme un personnage principal de jeu vidéo photoréaliste. Détoure-le, intègre une armure légère au design futuriste et place-le dans un décor de science-fiction avec un éclairage épique." },
            { title: "Figurine Collector", prompt: "Détoure le sujet et transforme-le en une figurine d'action en plastique articulée, présentée dans son emballage cartonné de jouet collector, comme si elle était neuve." },
            { title: "Peinture à l'Huile Classique", prompt: "Transforme cette image en une peinture à l'huile de style classique. Imite la texture des coups de pinceau, la richesse des couleurs et la lumière douce typiques des portraits de la Renaissance." },
        ],
    },
    {
        name: "Voyage dans le Temps",
        description: "Simulez le vieillissement, le rajeunissement ou donnez un aspect historique à une photo.",
        icon: "Hourglass",
        prompts: [
            { title: "Vision du Futur (Vieillissement)", prompt: "En te basant sur ce portrait, simule de manière réaliste à quoi pourrait ressembler cette personne dans 30 ans. Ajoute des rides d'expression crédibles, des cheveux grisonnants naturels et ajuste subtilement la texture de la peau pour un effet digne et respectueux." },
            { title: "Retour en Jeunesse", prompt: "Rajeunis subtilement le sujet de cette photo d'environ 15 ans. Atténue visiblement les rides et ridules, redonne de l'éclat et de l'uniformité à la peau et un peu plus de densité à la chevelure." },
            { title: "Photo d'Époque (Sépia 1900)", prompt: "Donne à cette photo l'aspect d'un portrait de studio authentique des années 1900. Applique un filtre sépia riche, un vignettage prononcé, un léger flou sur les bords et une texture de papier ancien." },
        ],
    },
    {
        name: "Architecte d'Intérieur IA",
        description: "Utilisez l'IA pour la décoration et la visualisation d'espaces intérieurs.",
        icon: "Sofa",
        prompts: [
            { title: "Changer de Style (Scandinave)", prompt: "En gardant la disposition de cette pièce (fenêtres, portes), redécore-la entièrement dans un style scandinave. Utilise du bois clair, une palette de couleurs neutres (blanc, gris, beige), des lignes épurées et ajoute des plantes vertes pour une ambiance lumineuse et minimaliste." },
            { title: "Test de Couleur (Bleu Canard)", prompt: "Repeins le mur principal de cette pièce en bleu canard. Adapte l'éclairage et les ombres pour que la couleur paraisse naturelle et assure-toi que le mobilier existant s'harmonise avec ce changement." },
            { title: "Aménagement d'Espace Vide", prompt: "Aménage cette pièce vide pour en faire un salon moderne et chaleureux. Intègre un canapé confortable, une table basse design, un tapis, des luminaires et des éléments de décoration comme des cadres et des plantes." },
        ]
    },
    {
        name: "Tendances et Styles Cinématographiques",
        description: "Appliquez les looks viraux et les ambiances inspirées du cinéma.",
        icon: "Film",
        prompts: [
            { title: "Look 'Film de Cinéma'", prompt: "Applique un étalonnage cinématographique à cette image. Ajoute des bandes noires en haut et en bas (format 2.35:1), désature légèrement les couleurs, augmente le contraste et ajoute un grain de film subtil pour un rendu dramatique." },
            { title: "Effet 'Pellicule Vintage' (Années 90)", prompt: "Donne à cette photo l'aspect d'un cliché pris avec une pellicule Kodak Gold des années 90. Applique un grain de film visible, des couleurs chaudes avec des tons jaunes et verts légèrement accentués, et une date orange en bas à droite." },
            { title: "Double Exposition Artistique", prompt: "Crée un effet de double exposition artistique. Fusionne la silhouette du sujet principal (détouré) avec un paysage de forêt dense, en laissant transparaître les arbres et la lumière à travers le portrait." },
        ]
    },
    {
        name: "Évasion : Changer l'Arrière-plan",
        description: "Placez le sujet de la photo dans un paysage nouveau et spectaculaire.",
        icon: "Mountain",
        prompts: [
            { title: "Nuit à Tokyo", prompt: "Détoure précisément le sujet de l'image et place-le au milieu d'une rue animée de Tokyo la nuit. L'arrière-plan doit être rempli de néons lumineux, de reflets sur le sol mouillé et d'une foule en mouvement." },
            { title: "Sommets des Alpes", prompt: "Détoure le sujet et intègre-le dans un paysage panoramique des Alpes suisses. L'arrière-plan doit montrer des montagnes majestueuses et enneigées sous un ciel bleu vif." },
            { title: "Plage Paradisiaque", prompt: "Détoure le sujet et place-le sur une plage de sable blanc des Maldives, avec une mer turquoise et transparente et quelques palmiers en arrière-plan." },
            { title: "Forêt Enchantée", prompt: "Détoure le sujet et place-le dans une forêt enchantée et mystérieuse, avec des arbres moussus, des rayons de lumière perçant à travers le feuillage et une légère brume au sol." },
        ]
    },
    {
        name: "Humour & Créativité Décalée",
        description: "Créez des images amusantes et surprenantes.",
        icon: "PartyPopper",
        prompts: [
            { title: "La Conquête de la Lune", prompt: "Détoure le sujet, mets-lui une combinaison d'astronaute, et fais-le planter un drapeau sur la surface de la Lune, avec la Terre visible dans le ciel en arrière-plan." },
            { title: "Mini-Moi", prompt: "Transforme le sujet en une version miniature (environ 10 cm de haut) et place-le dans l'environnement d'origine pour créer un effet amusant." },
            { title: "Visage sur un Fruit", prompt: "Prends le visage du sujet et applique-le de manière amusante et caricaturale sur une banane." },
            { title: "Explosion de Popcorn", prompt: "Remplace l'arrière-plan par une explosion géante de popcorn, avec des grains volant partout autour du sujet." },
        ]
    },
    {
        name: "Ambiance de Noël",
        description: "Transformez vos photos pour les fêtes de fin d'année.",
        icon: "Snowflake",
        prompts: [
            { title: "Fond Hivernal Féérique", prompt: "Détoure le sujet et remplace l'arrière-plan par un paysage de village enneigé la nuit, avec des lumières de Noël aux fenêtres et un ciel étoilé." },
            { title: "Pull de Noël (et décor)", prompt: "Habille le sujet avec un pull de Noël un peu kitsch (avec des rennes ou des flocons) et ajoute des décorations de Noël comme des guirlandes lumineuses en arrière-plan." },
            { title: "Studio Photo de Noël", prompt: "Détoure le sujet et place-le dans un décor de studio photo sur le thème de Noël, avec un sapin décoré, des cadeaux et une fausse neige au sol." },
            { title: "Portrait de Famille version 'Noël'", prompt: "Ajoute un bonnet de Père Noël sur la tête de chaque personne présente sur la photo et transforme l'éclairage pour une ambiance plus chaude et festive." },
        ],
    },
];
