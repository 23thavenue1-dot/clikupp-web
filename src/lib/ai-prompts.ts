
'use client';

export type PromptSuggestion = {
  title: string;
  prompt: string;
};

export type PromptCategory = {
  name: string;
  description: string;
  prompts: PromptSuggestion[];
};

export const suggestionCategories: PromptCategory[] = [
    {
        name: "Selfie",
        description: "Transformez vos autoportraits en œuvres spectaculaires.",
        prompts: [
            { title: "Héros de film d'action", prompt: "Détoure le sujet de la photo et transforme-le en héros d'affiche de film d'action, avec des explosions en arrière-plan et un éclairage dramatique." },
            { title: "Portrait d'art", prompt: "Détoure le sujet et transforme ce selfie en une peinture à l'huile de style classique." },
            { title: "Astronaute", prompt: "Détoure mon visage, ajoute un casque d'astronaute réaliste et place-moi dans l'espace avec un fond de nébuleuses." },
            { title: "Cyberpunk", prompt: "Détoure le sujet et donne-lui une ambiance cyberpunk avec des néons et une atmosphère de nuit pluvieuse en arrière-plan." },
            { title: "Aventurier dans la jungle", prompt: "Détoure le sujet et transforme-moi en aventurier dans une jungle dense et mystérieuse." },
            { title: "Style bande dessinée", prompt: "Applique un style de bande dessinée (comic book) à ce selfie, en détourant bien le sujet." },
            { title: "Personnage de jeu vidéo", prompt: "Fais de ce selfie le portrait d'un personnage de jeu vidéo fantaisie, en détourant parfaitement le sujet de son fond d'origine." },
            { title: "Double exposition", prompt: "Crée un effet de double exposition en superposant mon visage détouré avec un paysage de forêt." },
            { title: "Nature sauvage", prompt: "Détoure le sujet de la photo et remplace l'arrière-plan par un paysage de nature sauvage." },
            { title: "Jouet Collector", prompt: "Détoure le sujet et transforme-le en jouet collector (type figurine) dans son emballage d'origine." },
        ],
    },
    {
        name: "Retouches de Portrait",
        description: "Idéal pour des améliorations subtiles et professionnelles du visage.",
        prompts: [
            { title: "Lumière douce", prompt: "Adoucis la lumière sur le visage pour un rendu plus flatteur." },
            { title: "Peau lissée", prompt: "Lisse subtilement la peau tout en conservant sa texture naturelle." },
            { title: "Moins de cernes", prompt: "Réduis légèrement l'apparence des cernes sous les yeux." },
            { title: "Sourire naturel", prompt: "Donne un sourrir naturel" },
            { title: "Ajouter un sourire", prompt: "Modifie subtilement l'expression du visage pour ajouter un léger sourire naturel." },
            { title: "Regard net", prompt: "Accentue la netteté sur les yeux, les cils et les sourcils." },
            { title: "Couleurs ravivées", prompt: "Ravive subtilement la couleur naturelle des lèvres et des joues." },
            { title: "Effet 'Glow'", prompt: "Donne à la peau un effet 'glow' sain et lumineux." },
            { title: "Anti-brillance", prompt: "Atténue les reflets de brillance sur la peau." },
            { title: "Mâchoire définie", prompt: "Accentue légèrement la définition de la mâchoire." },
        ],
    },
    {
        name: "Changements de Fond",
        description: "Transportez votre sujet dans un tout nouvel environnement.",
        prompts: [
            { title: "Plage", prompt: "Détoure le sujet et remplace l'arrière-plan par une plage de sable blanc et mer turquoise." },
            { title: "Montagnes", prompt: "Détoure le sujet et change le fond pour un paysage de montagnes enneigées." },
            { title: "Tokyo (nuit)", prompt: "Détoure le sujet et place-le dans une rue de Tokyo la nuit, avec des néons." },
            { title: "Studio", prompt: "Détoure le sujet et remplace le fond par un fond de studio professionnel gris." },
            { title: "Forêt enchantée", prompt: "Détoure le sujet et change le fond pour une forêt mystérieuse et enchantée." },
            { title: "Champ de lavande", prompt: "Détoure le sujet et remplace le fond par un champ de lavande au coucher du soleil." },
            { title: "Aquarelle", prompt: "Détoure le sujet et change l'arrière-plan pour un fond abstrait peint à l'aquarelle." },
            { title: "Espace", prompt: "Détoure le sujet et place-le dans l'espace, avec des étoiles et des nébuleuses." },
            { title: "Post-apocalyptique", prompt: "Détoure le sujet et remplace le fond par un paysage urbain post-apocalyptique." },
        ]
    },
    {
        name: "Ambiance & Style",
        description: "Appliquez une atmosphère ou un style visuel unique à votre image.",
        prompts: [
            { title: "Cinématographique", prompt: "Donne à l'image un look cinématographique avec des couleurs intenses." },
            { title: "Noir & Blanc", prompt: "Rends l'image en noir et blanc avec un fort contraste." },
            { title: "Look Magazine", prompt: "Augmente le contraste et la saturation pour un look 'couverture de magazine'." },
            { title: "Style Cyberpunk", prompt: "Ajoute des lumières néon roses et bleues pour un style 'cyberpunk'." },
        ]
    },
    {
        name: "Effets Spéciaux & Créatifs",
        description: "Parfait pour des résultats originaux et qui sortent de l'ordinaire.",
        prompts: [
            { title: "Rayons de soleil", prompt: "Ajoute des rayons de soleil qui traversent l'image." },
            { title: "Effet de pluie", prompt: "Ajoute un effet de pluie et des reflets sur le sol." },
            { title: "Effet maquette", prompt: "Donne à l'image un effet maquette / miniature (tilt-shift)." },
            { title: "Désintégration", prompt: "Fais en sorte que le bord du sujet se désintègre en particules." },
            { title: "Zoom en mouvement", prompt: "Ajoute un effet de 'zoom en mouvement' (motion blur) vers le centre." },
        ]
    },
    {
        name: "Événements & Saisons",
        description: "Adaptez vos images pour des occasions spéciales comme Noël ou l'hiver.",
        prompts: [
            { title: "Ambiance Noël", prompt: "Transforme l'éclairage en une ambiance de Noël chaleureuse avec des tons dorés et rouges." },
            { title: "Neige", prompt: "Ajoute de la neige qui tombe doucement sur toute l'image." },
            { title: "Bonnet de Noël", prompt: "Ajoute un bonnet de Père Noël sur la tête du sujet principal." },
            { title: "Guirlandes", prompt: "Incruste des guirlandes lumineuses (bokeh) en arrière-plan." },
            { title: "Fond Hivernal", prompt: "Change l'arrière-plan pour un paysage d'hiver enneigé." },
        ],
    },
];
