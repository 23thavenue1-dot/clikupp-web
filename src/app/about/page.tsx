
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight">À Propos de Clikup</h1>
                    <p className="text-muted-foreground mt-2">
                        Votre guide complet sur le fonctionnement, les règles et la vision de Clikup.
                    </p>
                </header>
                
                <Card>
                    <CardHeader>
                        <CardTitle>1. Notre Mission</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                        <p>
                            <strong>Clikup</strong> est une application web moderne conçue pour l'hébergement et la gestion d'images. Notre mission est de fournir un outil qui va au-delà du simple stockage, en intégrant une intelligence artificielle créative pour assister les créateurs de contenu, les développeurs et les utilisateurs quotidiens dans leur processus de création.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Guide d'Utilisation des Fonctionnalités</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm md:prose-base dark:prose-invert max-w-none space-y-4">
                        <details>
                            <summary className="font-semibold cursor-pointer">a) Gestion du Compte</summary>
                            <ul className="mt-2 pl-6 list-disc">
                                <li><strong>Profil Public :</strong> Dans vos <code>Paramètres &gt; Profil</code>, vous pouvez personnaliser votre nom d'affichage, votre biographie, ajouter un site web et choisir votre avatar.</li>
                                <li><strong>Sécurité :</strong> Dans <code>Paramètres &gt; Compte</code>, vous pouvez changer votre mot de passe et gérer vos préférences de notification. C'est aussi ici que vous pouvez supprimer votre compte.</li>
                            </ul>
                        </details>

                        <details>
                            <summary className="font-semibold cursor-pointer">b) Organisation des Images</summary>
                             <ul className="mt-2 pl-6 list-disc">
                                <li><strong>Téléversement :</strong> Vous pouvez ajouter des images depuis un fichier local ou via une URL externe.</li>
                                <li><strong>Galerie Principale :</strong> Toutes vos images apparaissent sur la page d'accueil, triées par défaut de la plus récente à la plus ancienne.</li>
                                <li><strong>Organisation par Galeries :</strong> La page <code>Mes Galeries</code> vous permet de créer des albums thématiques. Vous pouvez y ajouter ou retirer des images pour une organisation parfaite.</li>
                            </ul>
                        </details>

                         <details>
                            <summary className="font-semibold cursor-pointer">c) Fonctionnalités IA</summary>
                             <ul className="mt-2 pl-6 list-disc">
                                <li><strong>Génération de Description :</strong> Sur chaque image, vous pouvez utiliser l'IA pour générer un titre, une description et des hashtags pertinents pour les réseaux sociaux.</li>
                                <li><strong>Édition d'Image par IA :</strong> La page d'édition (<code>Éditer avec l'IA</code>) est la fonctionnalité la plus puissante. Décrivez les changements que vous souhaitez en langage naturel ("Rends le ciel plus bleu", "Transforme en peinture") et laissez l'IA créer une nouvelle version de votre image.</li>
                            </ul>
                        </details>
                        
                        <details open>
                           <summary className="font-semibold cursor-pointer">d) Système de Tickets</summary>
                           <p className="mt-2">
                                Pour garantir un service gratuit et équitable, l'utilisation de Clikup est régulée par un système de tickets quotidiens :
                           </p>
                           <ul className="mt-2 pl-6 list-disc">
                               <li><strong>5 tickets de téléversement</strong> par jour.</li>
                               <li><strong>3 tickets IA</strong> par jour (pour la génération de description ou l'édition d'image).</li>
                           </ul>
                           <p className="mt-2">Ce quota est réinitialisé automatiquement toutes les 24 heures.</p>
                       </details>

                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>3. Conditions d'Utilisation et Droits</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm md:prose-base dark:prose-invert max-w-none space-y-4">
                        <p>L'utilisation de Clikup implique l'acceptation des règles suivantes.</p>
                        <h4 className="font-semibold">a) Contenu Utilisateur</h4>
                        <ul className="pl-6 list-disc">
                            <li>Vous êtes entièrement responsable du contenu (images, textes) que vous téléversez.</li>
                            <li>Il est interdit de téléverser du contenu illégal, haineux, violent, diffamatoire ou protégé par des droits d'auteur dont vous n'êtes pas le détenteur.</li>
                            <li>Nous nous réservons le droit de supprimer tout contenu enfreignant ces règles, et le cas échéant, de suspendre ou supprimer le compte utilisateur associé, sans préavis.</li>
                        </ul>

                        <h4 className="font-semibold">b) Limitation de Responsabilité (Concernant l'IA)</h4>
                         <ul className="pl-6 list-disc">
                            <li>Nos fonctionnalités basées sur l'intelligence artificielle (Gemini) sont des outils créatifs expérimentaux. Les résultats générés (images, textes) peuvent être imprévisibles et ne pas correspondre à vos attentes.</li>
                            <li><strong>Clikup ne peut être tenu responsable</strong> de la nature, de la qualité, ou de la pertinence des résultats produits par l'IA. Nous ne garantissons pas que les résultats seront satisfaisants, précis ou exempts d'artefacts.</li>
                            <li>En utilisant ces fonctionnalités, vous acceptez que les résultats sont fournis "en l'état", sans garantie d'aucune sorte.</li>
                        </ul>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>4. Recours et Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm md:prose-base dark:prose-invert max-w-none space-y-4">
                         <p>Nous croyons en une communication transparente. Si vous êtes déçu par un résultat ou rencontrez un problème, vous n'êtes pas seul.</p>
                         <h4 className="font-semibold">a) Que faire en cas de résultat IA décevant ?</h4>
                         <ol className="pl-6 list-decimal">
                            <li><strong>Reformulez votre instruction :</strong> C'est souvent la solution la plus efficace. Essayez d'être plus précis ou d'utiliser des mots différents. Par exemple, au lieu de "Améliore la photo", essayez "Rends les couleurs plus vives et augmente le contraste".</li>
                            <li><strong>Utilisez les suggestions :</strong> La page d'édition propose des prompts qui ont été testés et qui donnent généralement de bons résultats. N'hésitez pas à vous en inspirer.</li>
                            <li><strong>Consommez un autre ticket :</strong> Chaque génération est unique. Une nouvelle tentative peut produire un résultat complètement différent et plus satisfaisant.</li>
                        </ol>

                         <h4 className="font-semibold">b) Comment nous contacter ?</h4>
                         <p>Pour tout problème technique, question, suggestion, ou pour discuter de besoins spécifiques comme des forfaits pour entreprise, la méthode la plus efficace est de créer un "ticket" sur la page "Issues" de notre projet GitHub.</p>
                         <p>Cela garantit que votre demande est bien enregistrée, suivie et ne se perdra pas. C'est la méthode la plus directe pour obtenir de l'aide de notre part.</p>
                         
                         <p>
                            <Link href="https://github.com/23thavenue1-dot/clikup-web/issues" target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
                                Lien vers le support GitHub
                            </Link>
                        </p>

                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
