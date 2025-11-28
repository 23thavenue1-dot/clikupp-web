
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ClipboardList, Target, Building, Instagram, MessageSquare } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { SocialAuditOutput } from '@/ai/schemas/social-audit-schemas';
import type { BrandProfile } from '@/lib/firestore';
import { useState, useMemo, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

type AuditReport = SocialAuditOutput & {
    id: string;
    createdAt: any; // Timestamp
    platform: string;
    goal: string;
    brandProfileId: string;
}

const platformIcons: { [key: string]: React.ElementType } = {
    instagram: Instagram,
    tiktok: LucideIcons.Music,
    facebook: LucideIcons.Facebook,
    x: MessageSquare,
    linkedin: LucideIcons.Linkedin,
    other: LucideIcons.Globe,
};


export default function AuditHistoryPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    const brandProfilesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/brandProfiles`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: brandProfiles, isLoading: areProfilesLoading } = useCollection<BrandProfile>(brandProfilesQuery);

    const auditsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/audits`), orderBy('createdAt', 'desc'));
    }, [user, firestore]);
    const { data: audits, isLoading: areAuditsLoading } = useCollection<AuditReport>(auditsQuery);

    // Sélectionner le premier profil par défaut une fois les données chargées
    useEffect(() => {
        if (!areProfilesLoading && brandProfiles && brandProfiles.length > 0 && !selectedProfileId) {
            setSelectedProfileId(brandProfiles[0].id);
        }
    }, [brandProfiles, areProfilesLoading, selectedProfileId]);
    
    const auditsForSelectedProfile = useMemo(() => {
        if (!audits || !selectedProfileId) return [];
        return audits.filter(audit => audit.brandProfileId === selectedProfileId);
    }, [audits, selectedProfileId]);

    const groupedAudits = useMemo(() => {
        return auditsForSelectedProfile.reduce((acc, audit) => {
            const platform = audit.platform || 'other';
            if (!acc[platform]) {
                acc[platform] = [];
            }
            acc[platform].push(audit);
            return acc;
        }, {} as Record<string, AuditReport[]>);
    }, [auditsForSelectedProfile]);


    if (isUserLoading || areProfilesLoading || areAuditsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user) {
        router.push('/login?redirect=/audit');
        return null;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-6xl mx-auto space-y-8">
                <header className="space-y-2">
                    <Button variant="ghost" asChild className="mb-4 -ml-4">
                        <Link href="/audit">
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Retour au Coach Stratégique
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Historique des Analyses</h1>
                    <p className="text-muted-foreground">Retrouvez ici tous les rapports d'audit générés par l'IA, organisés par profil.</p>
                </header>
                
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Colonne de gauche: Profils de marque */}
                    <aside className="w-full md:w-1/3 lg:w-1/4">
                        <h2 className="text-lg font-semibold mb-4 px-2">Profils de Marque</h2>
                        {brandProfiles && brandProfiles.length > 0 ? (
                             <div className="space-y-1">
                                {brandProfiles.map(profile => (
                                    <button 
                                        key={profile.id}
                                        onClick={() => setSelectedProfileId(profile.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                                            selectedProfileId === profile.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                                        )}
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                                            <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{profile.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                             <div className="text-center text-muted-foreground border-2 border-dashed rounded-lg p-6">
                                <Building className="mx-auto h-8 w-8 mb-2"/>
                                <p className="text-sm font-medium">Aucun profil de marque.</p>
                                <Button size="sm" variant="link" asChild className="mt-2">
                                    <Link href="/audit">En créer un</Link>
                                </Button>
                            </div>
                        )}
                    </aside>

                    {/* Colonne de droite: Audits */}
                    <main className="flex-1">
                        {!selectedProfileId && brandProfiles && brandProfiles.length > 0 && (
                            <div className="flex items-center justify-center h-full text-center text-muted-foreground border-2 border-dashed rounded-lg p-8">
                                <p>Sélectionnez un profil pour voir les analyses associées.</p>
                            </div>
                        )}

                        {selectedProfileId && Object.keys(groupedAudits).length > 0 ? (
                            <div className="space-y-8">
                                {Object.entries(groupedAudits).map(([platform, platformAudits]) => {
                                    const Icon = platformIcons[platform] || LucideIcons.Globe;
                                    return (
                                    <section key={platform}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <Icon className="h-6 w-6 text-muted-foreground" />
                                            <h3 className="text-xl font-bold capitalize">{platform}</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {platformAudits.map(audit => (
                                                 <Card key={audit.id} className="transition-all hover:shadow-md hover:border-primary/50">
                                                    <Link href={`/audit/resultats/${audit.id}`} className="block">
                                                        <CardHeader>
                                                            <CardTitle className="flex items-center gap-2 text-base">
                                                                <Target className="h-4 w-4 text-primary"/>
                                                                Analyse du {format(audit.createdAt.toDate(), "d MMMM yyyy", { locale: fr })}
                                                            </CardTitle>
                                                            <CardDescription>
                                                                Objectif : "{audit.goal}"
                                                            </CardDescription>
                                                        </CardHeader>
                                                    </Link>
                                                </Card>
                                            ))}
                                        </div>
                                    </section>
                                )})}
                            </div>
                        ) : selectedProfileId ? (
                            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-semibold">Aucune analyse pour ce profil</h3>
                                <p className="mt-2 text-sm text-muted-foreground">Utilisez le Coach Stratégique pour générer un rapport pour ce profil de marque.</p>
                                <Button asChild className="mt-4">
                                    <Link href="/audit">Lancer une nouvelle analyse</Link>
                                </Button>
                            </div>
                        ) : null}
                    </main>
                </div>
            </div>
        </div>
    );
}
