
'use client';

import { secretMessages, SecretMessage } from '@/lib/secret-messages';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Lock, Trophy } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// A little type trick to allow dynamic icon names
type IconName = keyof typeof LucideIcons;

const getIcon = (name: string): React.FC<LucideIcons.LucideProps> => {
  const Icon = LucideIcons[name as IconName];
  return Icon || LucideIcons.HelpCircle;
};

export default function SecretMessagesPage() {
    // Pour le futur : vous pourrez filtrer ici les messages débloqués
    const unlockedLevel = 20; // Pour l'instant, on affiche tout

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-4xl mx-auto space-y-8">
                <header className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Messages Secrets</h1>
                    <p className="text-muted-foreground mt-2">
                        Chaque niveau atteint révèle un nouveau secret sur l'art de la photographie et de la création.
                    </p>
                </header>

                <div className="space-y-6">
                    {secretMessages.map((message) => {
                        const isUnlocked = message.level <= unlockedLevel;
                        const Icon = getIcon(message.icon);

                        return (
                            <Card key={message.level} className={`transition-opacity ${isUnlocked ? 'opacity-100' : 'opacity-50'}`}>
                                <CardHeader className="flex flex-row items-start gap-4">
                                     <div className={`p-3 rounded-lg ${isUnlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center justify-between">
                                            <span>Niveau {message.level}: {message.title}</span>
                                            {isUnlocked ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <Lock className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </CardTitle>
                                        <CardDescription>
                                            Débloqué au niveau {message.level}.
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className={`pl-16 ${!isUnlocked && 'blur-sm select-none'}`}>
                                        {isUnlocked ? message.content : "Atteignez le niveau requis pour débloquer ce message."}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

    