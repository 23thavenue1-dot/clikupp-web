
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Bot, Target, BookOpen, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { type SocialAuditOutput } from '@/ai/schemas/social-audit-schemas';

type AuditReport = SocialAuditOutput & {
    createdAt: any; // Timestamp
    platform: string;
    goal: string;
}

export default function AuditResultPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const auditId = params.auditId as string;

    const auditDocRef = useMemoFirebase(() => {
        if (!user || !firestore || !auditId) return null;
        return doc(firestore, `users/${user.uid}/audits`, auditId);
    }, [user, firestore, auditId]);
    
    const { data: auditReport, isLoading: isAuditLoading } = useDoc<AuditReport>(auditDocRef);
    
    if (isUserLoading || isAuditLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user) {
        router.push('/login');
        return null;
    }
    
    if (!auditReport) {
        return (
            <div className="container mx-auto p-8 text-center">
                 <h1 className="text-2xl font-bold">Rapport introuvable</h1>
                 <p className="text-muted-foreground">Le rapport d'analyse que vous cherchez n'existe pas ou vous n'y avez pas accès.</p>
                 <Button asChild className="mt-4">
                    <Link href="/audit">Retourner au Coach Stratégique</Link>
                 </Button>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                 <header className="space-y-2">
                        <Button variant="ghost" asChild className="mb-4 -ml-4">
                            <Link href="/audit">
                                <ArrowLeft className="mr-2 h-4 w-4"/>
                                Retour au Coach Stratégique
                            </Link>
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">Rapport d'Analyse IA</h1>
                        <p className="text-muted-foreground">
                            Analyse pour un profil <span className="font-semibold text-primary">{auditReport.platform}</span> avec pour objectif : <span className="font-semibold text-primary">"{auditReport.goal}"</span>.
                        </p>
                </header>

                <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><Bot className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Identité Visuelle</CardTitle>
                            <CardDescription>La perception de votre style par l'IA.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-sm mb-2">Mots-clés de votre style :</h4>
                            <div className="flex flex-wrap gap-2">
                                {auditReport.visual_identity.keywords.map((keyword, index) => (
                                    <span key={index} className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">{keyword}</span>
                                ))}
                            </div>
                        </div>
                         <Separator />
                        <div>
                             <h4 className="font-semibold text-sm mb-2">Synthèse de l'IA :</h4>
                            <p className="text-sm whitespace-pre-wrap">{auditReport.visual_identity.summary}</p>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                     <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><Target className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Analyse Stratégique</CardTitle>
                            <CardDescription>Vos points forts et axes d'amélioration.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-semibold text-base mb-2 text-green-600">Points Forts</h4>
                             <ul className="space-y-2 text-sm list-disc pl-5">
                                {auditReport.strategic_analysis.strengths.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-base mb-2 text-amber-600">Axes d'Amélioration</h4>
                            <ul className="space-y-2 text-sm list-disc pl-5">
                                {auditReport.strategic_analysis.improvements.map((item, index) => (
                                    <li key={index}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><BookOpen className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Stratégie de Contenu</CardTitle>
                            <CardDescription>3 idées de publications pour atteindre votre objectif.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                       {auditReport.content_strategy.map((item, index) => (
                            <div key={index}>
                                <h4 className="font-semibold">{index + 1}. {item.idea}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary"><ListChecks className="h-6 w-6"/></div>
                        <div>
                            <CardTitle>Plan d'Action sur 7 Jours</CardTitle>
                            <CardDescription>Un programme simple pour commencer dès aujourd'hui.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-4">
                            {auditReport.action_plan.map((item, index) => (
                                <li key={index} className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                                    <div className="flex flex-col items-center">
                                        <span className="font-bold text-lg text-primary">{item.day.split(' ')[1]}</span>
                                        <span className="text-xs text-muted-foreground">{item.day.split(' ')[0]}</span>
                                    </div>
                                    <p className="flex-1 mt-1 text-sm">{item.action}</p>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
