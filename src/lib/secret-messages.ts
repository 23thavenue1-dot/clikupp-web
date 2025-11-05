
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
    title: "Le Point de Vue de Nicéphore Niépce",
    content: "Fait historique : En 1826, Nicéphore Niépce créait la première photographie, 'Point de vue du Gras', avec un temps de pose de plus de 8 heures. Aujourd'hui, votre smartphone capture une image en 1/4000e de seconde.\n\nChaque cliché est un luxe technologique, un pouvoir de figer le temps que Niépce n'aurait jamais pu imaginer. Chaque fois que vous déclenchez, pensez à ce chemin parcouru. Utilisez ce pouvoir non seulement pour capturer, mais pour raconter.",
    icon: "Camera",
  },
  {
    level: 2,
    title: "La Règle des Tiers, votre meilleur allié",
    content: "Tips photo : La règle des tiers est le fondement d'une composition réussie. Imaginez une grille de morpion (deux lignes horizontales, deux verticales) sur votre image.\n\nPlacez vos sujets principaux ou les points d'intérêt (comme un regard, un sommet de montagne, l'horizon) le long de ces lignes ou, encore mieux, à leurs points d'intersection. Cela crée une tension visuelle et un dynamisme qui rendent l'image instantanément plus captivante et professionnelle qu'un sujet simplement centré.",
    icon: "Grid",
  },
  {
    level: 3,
    title: "L'Âge d'Or de la 'Golden Hour'",
    content: "Tips créateur : La 'Golden Hour' (l'heure dorée) est le Saint Graal des photographes. Il s'agit de la première heure de lumière après le lever du soleil et de la dernière heure avant son coucher.\n\nDurant ce laps de temps, la lumière est douce, diffuse et chaude. Elle sculpte les paysages, sublime les portraits en éliminant les ombres dures sous les yeux et enveloppe vos sujets d'un halo quasi magique. Anticipez ces moments, ils transformeront vos photos ordinaires en clichés extraordinaires.",
    icon: "Sunrise",
  },
  {
    level: 4,
    title: "Votre Niche : Mieux vaut être un Grand Poisson dans une Petite Mare",
    content: "Tips influenceur : Vouloir plaire à tout le monde, c'est ne plaire à personne. Définir votre 'niche', c'est choisir votre terrain de jeu.\n\nQue ce soit la photographie culinaire végane, l'exploration de châteaux abandonnés ou les portraits de chiens en studio, une niche vous permet de devenir une référence. Vous attirerez une audience plus petite mais ultra-engagée, qui partage votre passion. C'est le secret pour construire une communauté solide et fidèle.",
    icon: "Target",
  },
  {
    level: 5,
    title: "Le Storytelling en 3 Actes",
    content: "Tips créateur : Une simple photo avec une légende plate est vite oubliée. Transformez vos publications en mini-histoires.\n\nActe 1 (l'accroche) : une image forte qui pose une question ou crée une émotion.\nActe 2 (le développement) : une description qui raconte l'histoire derrière l'image, le défi rencontré, la joie ressentie.\nActe 3 (la résolution) : un appel à l'action qui implique votre audience ('Et vous, quel est votre meilleur souvenir de voyage ?'). C'est ainsi que l'on crée de la connexion, pas seulement du contenu.",
    icon: "BookOpenText",
  },
  {
    level: 6,
    title: "L'Héritage du Kodachrome : La Couleur comme Signature",
    content: "Fait historique : Le film argentique Kodachrome était légendaire pour son rendu des couleurs unique et vibrant. C'était une signature visuelle.\n\nÀ l'ère numérique, vos 'presets' (filtres et préréglages) sont votre Kodachrome. Ne les appliquez pas au hasard. Développez une palette de couleurs cohérente (tons chauds, froids, désaturés, etc.) qui définit votre style. Quand quelqu'un verra une de vos photos dans son flux, il doit pouvoir se dire : 'Ça, c'est du travail de [votre nom]'.",
    icon: "Palette",
  },
  {
    level: 7,
    title: "Le 'Hook' des 3 Premières Secondes",
    content: "Tips créateur : Dans le défilement infini des réseaux sociaux, votre contenu n'a que 3 secondes pour survivre. C'est la durée du 'scroll'. Votre image doit agir comme un hameçon ('hook') : elle doit surprendre, intriguer, choquer ou émouvoir instantanément.\n\nUtilisez des couleurs vives, des compositions audacieuses, des expressions fortes. La description vient ensuite, pour ceux qui ont mordu à l'hameçon. La première impression n'est pas importante, elle est la seule qui compte.",
    icon: "Timer",
  },
  {
    level: 8,
    title: "L'Engagement > Le Nombre d'Abonnés",
    content: "Tips influenceur : Les marques et les algorithmes ne regardent plus seulement le nombre d'abonnés. Ils scrutent le taux d'engagement.\n\n100 abonnés qui commentent, partagent et enregistrent vos publications ont infiniment plus de valeur que 10 000 'followers fantômes'. Posez des questions, répondez à chaque commentaire pertinent, créez des sondages, lancez des débats. Bâtissez une communauté active, pas juste une audience passive.",
    icon: "MessageSquare",
  },
  {
    level: 9,
    title: "Les Lignes Directrices : Le GPS du Regard",
    content: "Tips photo : Les lignes sont partout autour de nous : routes, rampes, ombres, branches... En photographie, ce sont des 'lignes directrices'.\n\nVotre travail est de les utiliser comme des flèches invisibles pour guider l'œil du spectateur à travers votre image, directement vers votre sujet principal. Une route qui serpente vers une montagne, un pont qui mène à une personne. C'est une technique de composition qui donne de la profondeur et une intention claire à votre cliché.",
    icon: "Baseline",
  },
  {
    level: 10,
    title: "De la Lanterne Magique au Carrousel Instagram",
    content: "Fait historique : Bien avant le cinéma, la 'lanterne magique' (ancêtre du projecteur de diapositives) était utilisée dès le 17ème siècle pour projeter des séquences d'images sur verre et raconter une histoire.\n\nLe carrousel Instagram est son descendant direct. Ne le voyez pas comme une simple galerie. Utilisez-le pour raconter : montrez un avant/après, détaillez un processus en étapes (votre retouche photo !), ou partagez les coulisses de votre meilleure prise.",
    icon: "GalleryHorizontal",
  },
  {
    level: 11,
    title: "Le Format RAW : Votre Négatif Numérique",
    content: "Tips photo : Si votre appareil (y compris de nombreux smartphones) le permet, photographiez en format RAW. Un JPEG est une image déjà 'développée' et compressée par l'appareil. Un fichier RAW, c'est le négatif numérique brut.\n\nIl contient toutes les informations capturées par le capteur. En post-production, cela vous donne une latitude incroyable pour ajuster l'exposition, récupérer des détails dans les ombres ou les hautes lumières et affiner les couleurs sans perte de qualité. C'est LA pratique qui sépare l'amateur de l'expert.",
    icon: "FileSliders",
  },
  {
    level: 12,
    title: "Le 'Personal Branding' : Vous êtes la Marque",
    content: "Tips influenceur : Votre marque personnelle ('personal branding') est l'alchimie entre votre style visuel, le ton de votre écriture, les sujets que vous abordez et les valeurs que vous défendez. C'est la promesse que vous faites à votre audience.\n\nDéfinissez-la clairement et soyez cohérent. Les gens ne s'abonnent pas juste à des photos, ils adhèrent à une vision, une personnalité, une expertise. Ils s'abonnent à vous.",
    icon: "Award",
  },
  {
    level: 13,
    title: "L'Ouverture et le 'Bokeh'",
    content: "Tips photo : Pour obtenir ce magnifique flou d'arrière-plan professionnel (le 'bokeh'), le secret est l'ouverture de votre objectif. Plus le chiffre 'f' est petit (f/1.8, f/2.8), plus l'ouverture est grande et plus le flou sera prononcé.\n\nC'est idéal pour les portraits, car cela isole votre sujet de son environnement et attire tout le regard sur lui. C'est l'une des techniques les plus efficaces pour donner une apparence cinématographique à vos photos.",
    icon: "Aperture",
  },
  {
    level: 14,
    title: "La Monétisation n'est pas un Tabou",
    content: "Tips influenceur : Vivre de sa passion est un objectif noble. Les options sont nombreuses : liens d'affiliation pour le matériel que vous utilisez, vente de vos propres presets, collaborations rémunérées avec des marques, tirages photo, workshops...\n\nLa règle d'or est l'authenticité. Ne recommandez que des produits ou services que vous utilisez et aimez sincèrement. Votre confiance est votre capital le plus précieux, ne le bradez jamais.",
    icon: "DollarSign",
  },
  {
    level: 15,
    title: "Du Dagoberrotype au 'Feed' Instagram",
    content: "Fait historique : Au 19ème siècle, les premiers photographes comme Daguerre produisaient des pièces uniques, des objets d'art précieux.\n\nVotre galerie ou votre 'feed' sur les réseaux est votre exposition permanente. Ne pensez pas seulement à la photo individuelle. Pensez à l'harmonie globale. Comment les couleurs, les sujets et les compositions de vos images interagissent-ils les uns avec les autres ? Un feed cohérent est une signature aussi forte qu'une seule bonne photo.",
    icon: "LayoutGrid",
  },
  {
    level: 16,
    title: "Analyse tes 'Stats' : Le Pouvoir des Données",
    content: "Tips créateur : L'inspiration c'est bien, les données c'est mieux. Chaque plateforme vous offre des outils d'analyse ('analytics'). Plongez dedans.\n\nQuel type de contenu génère le plus d'enregistrements (le vrai signe de valeur) ? À quelle heure votre audience est-elle la plus connectée ? Un post a-t-il sous-performé ? Essayez de comprendre pourquoi. Les données sont une conversation silencieuse avec votre audience. Écoutez-la.",
    icon: "BarChart2",
  },
  {
    level: 17,
    title: "Le Contenu 'Behind The Scenes'",
    content: "Tips créateur : Votre audience ne veut pas seulement voir le résultat final, elle veut connaître l'artiste derrière. Partagez les coulisses ('Behind The Scenes').\n\nMontrez une vidéo accélérée de votre processus de retouche, un 'fail' amusant lors d'un shooting, parlez de vos doutes. Cette transparence et cette vulnérabilité créent un lien humain et une confiance bien plus forts qu'une galerie d'images parfaites.",
    icon: "Film",
  },
  {
    level: 18,
    title: "L'Équipement ne Fait pas le Photographe",
    content: "Tips photo : C'est le cliché le plus vrai de la photographie. Un nouvel appareil ne vous donnera pas un meilleur œil. La composition, la maîtrise de la lumière, l'art de capturer l'instant décisif et le storytelling sont 1000 fois plus importants.\n\nLe meilleur appareil est celui que vous avez sur vous, car il est toujours prêt. Apprenez à en maîtriser les limites et les forces à 100% avant de penser à investir.",
    icon: "Smartphone",
  },
  {
    level: 19,
    title: "La 'Longue Traîne' des Hashtags",
    content: "Tips créateur : Utiliser uniquement des hashtags populaires comme #voyage (500M+ publications) revient à crier dans un stade plein. Votre voix est noyée.\n\nAdoptez une stratégie de 'longue traîne' : 3-4 hashtags larges (#photographie), 5-6 de taille moyenne (#photoderueparis), et 2-3 hashtags de niche très spécifiques (#parisiennenoirblanc). C'est dans cette dernière catégorie que vous toucherez votre cœur de cible, les vrais connaisseurs qui recherchent activement ce que vous faites.",
    icon: "Tags",
  },
  {
    level: 20,
    title: "Brisez les Règles (mais en connaissance de cause)",
    content: "Tips photo & créateur : Vous avez appris la règle des tiers, la gestion de la lumière, le storytelling. Maintenant, vous avez la permission de tout oublier.\n\nSurexposez une photo pour un effet 'high-key' dramatique. Coupez un visage de manière non conventionnelle. Créez un flou de bougé intentionnel. La technique est un outil, pas une prison. Ce n'est qu'en maîtrisant les règles que l'on sait comment et pourquoi les briser pour créer un style qui n'appartient qu'à vous. Vous êtes un artiste, maintenant créez.",
    icon: "Bomb",
  },
];
