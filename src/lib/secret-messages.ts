
'use client';

export type SecretMessage = {
  level: number;
  title: string;
  content: string;
  icon: string; 
};

export const secretMessages: SecretMessage[] = [
  {
    level: 1,
    title: "Le Pouvoir d'une Image",
    content: "Félicitations pour ce premier pas ! Saviez-vous que la première photographie a nécessité plus de 8 heures de pose ? Aujourd'hui, vous pouvez capturer et partager un instant en une seconde. Chaque image que vous partagez est une histoire qui commence.",
    icon: "Camera",
  },
  {
    level: 2,
    title: "La Règle des Tiers : Le Secret des Pros",
    content: "Pour une photo plus dynamique, imaginez que votre écran est divisé en 9 cases égales (comme un jeu de morpion). Placez les points importants de votre photo sur les lignes ou à leurs intersections. C'est simple, mais ça change tout !",
    icon: "Grid",
  },
  {
    level: 3,
    title: "La Lumière est Votre Pinceau",
    content: "La 'golden hour', juste après le lever ou avant le coucher du soleil, offre une lumière douce et dorée qui sublime presque tous les sujets. Évitez la lumière dure de midi qui crée des ombres fortes et peu flatteuses.",
    icon: "Sunrise",
  },
  {
    level: 4,
    title: "L'Art de la Perspective",
    content: "Ne prenez pas toujours vos photos à hauteur d'œil. Essayez de vous accroupir (contre-plongée) pour donner de la puissance à votre sujet, ou de prendre de la hauteur (plongée) pour révéler des détails insoupçonnés. Changez d'angle, changez l'histoire.",
    icon: "Move3d",
  },
  {
    level: 5,
    title: "Racontez une Histoire",
    content: "Une bonne photo n'est pas juste jolie, elle raconte quelque chose. Avant de déclencher, demandez-vous : 'Quelle émotion est-ce que je veux transmettre ?'. Un détail, un regard, un mouvement... tout peut devenir un élément narratif puissant.",
    icon: "BookOpenText",
  },
  {
    level: 6,
    title: "L'Avantage du Format RAW",
    content: "Pour les pros : si votre appareil le permet, shootez en RAW. Ce format brut capture toutes les données du capteur, vous offrant une flexibilité maximale en post-traitement pour ajuster les couleurs et la lumière sans perte de qualité. C'est comme avoir un négatif numérique.",
    icon: "FileSliders",
  },
  {
    level: 7,
    title: "Moins, c'est Plus (Minimalisme)",
    content: "Parfois, le sujet le plus fort est celui qui est le plus isolé. N'ayez pas peur du vide. Un arrière-plan épuré (un mur uni, un ciel dégagé) peut faire ressortir votre sujet principal de manière spectaculaire.",
    icon: "CircleMinus",
  },
  {
    level: 8,
    title: "La Vitesse d'Obturation : Figer ou Flouter",
    content: "Maîtriser la vitesse d'obturation ouvre un monde de créativité. Une vitesse rapide (ex: 1/1000s) fige une action rapide (un sportif, un oiseau). Une vitesse lente (ex: 1/15s) sur un trépied peut créer de magnifiques filés de lumière.",
    icon: "Timer",
  },
  {
    level: 9,
    title: "L'Importance des Lignes Directrices",
    content: "Utilisez les lignes naturelles (routes, barrières, rivières) pour guider le regard du spectateur à travers votre image, directement vers votre sujet principal. C'est une technique subtile mais très efficace pour contrôler la composition.",
    icon: "Baseline",
  },
  {
    level: 10,
    title: "Votre Signature Visuelle",
    content: "Vous avez atteint un palier important ! Vos choix de couleurs, de sujets, de cadrages commencent à définir votre style. Ne copiez pas, inspirez-vous. Votre vision unique du monde est votre plus grande force.",
    icon: "PenTool",
  },
  {
    level: 11,
    title: "L'Ouverture et la Profondeur de Champ",
    content: "Pour les initiés : une grande ouverture (ex: f/1.8) crée un arrière-plan flou (bokeh) idéal pour les portraits. Une petite ouverture (ex: f/11) garantit que tout est net, parfait pour les paysages. C'est le contrôle créatif absolu.",
    icon: "Aperture",
  },
  {
    level: 12,
    title: "La Balance des Blancs Créative",
    content: "Ne laissez pas toujours la balance des blancs en automatique. Un réglage plus 'froid' (bleuté) peut accentuer une ambiance hivernale. Un réglage plus 'chaud' (orangé) peut rendre un coucher de soleil encore plus éclatant.",
    icon: "Thermometer",
  },
  {
    level: 13,
    title: "Le Post-Traitement Subtil",
    content: "L'édition n'est pas de la triche, c'est la touche finale. Le but n'est pas de transformer la réalité, mais de la sublimer. Un léger ajustement du contraste ou de la saturation peut faire passer une bonne photo à une photo exceptionnelle.",
    icon: "Wand2",
  },
  {
    level: 14,
    title: "Le Noir et Blanc : L'Âme de l'Image",
    content: "Le noir et blanc n'est pas une absence de couleur, c'est une concentration sur les formes, les textures et la lumière. Essayez-le sur des portraits ou des scènes à fort contraste pour révéler l'émotion brute de votre sujet.",
    icon: "Contrast",
  },
  {
    level: 15,
    title: "L'Impact d'une Série Photo",
    content: "Une seule image est une phrase. Une série d'images est un chapitre. Racontez une histoire plus profonde en créant une série cohérente de 3 à 5 photos sur un même thème. L'impact est bien plus fort.",
    icon: "GalleryHorizontal",
  },
  {
    level: 16,
    title: "Optimisation pour le Web : Le Poids des Images",
    content: "Pour les développeurs et blogueurs : une image magnifique est inutile si elle met 10 secondes à charger. Utilisez des outils pour compresser vos images (sans trop perdre en qualité) avant de les héberger. Le format WebP est souvent un excellent compromis.",
    icon: "Feather",
  },
  {
    level: 17,
    title: "Le Texte Alternatif (alt) : Pensez Accessibilité",
    content: "Chaque image sur le web devrait avoir un 'texte alternatif' descriptif. C'est crucial pour l'accessibilité (lecteurs d'écran pour les malvoyants) et pour le référencement (SEO). Une bonne description est une double victoire.",
    icon: "Accessibility",
  },
  {
    level: 18,
    title: "Briser les Règles",
    content: "Vous connaissez les règles (tiers, lignes, etc.). Il est maintenant temps d'apprendre à les briser intentionnellement. Un cadrage audacieux, une surexposition volontaire... L'expérimentation est la clé de l'innovation.",
    icon: "Bomb",
  },
  {
    level: 19,
    title: "Trouver l'Inspiration au Quotidien",
    content: "Les plus belles photos se cachent souvent dans les moments les plus simples. Un reflet dans une flaque d'eau, un jeu d'ombre sur un mur, un sourire fugace. Gardez l'œil ouvert, l'extraordinaire est partout.",
    icon: "Lightbulb",
  },
  {
    level: 20,
    title: "Devenir une Inspiration",
    content: "Félicitations, Maître. Vous ne vous contentez plus de prendre des photos, vous créez des œuvres. Votre parcours est une source d'inspiration pour tous les nouveaux membres. Continuez à partager votre vision, le monde en a besoin.",
    icon: "Crown",
  },
];

    