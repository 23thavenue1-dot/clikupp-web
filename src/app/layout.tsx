import type {Metadata} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Navbar } from '@/components/Navbar';
import { ThemeProvider } from '@/components/theme-provider';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorNotificationProvider } from '@/components/ErrorNotificationProvider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Clikup : Assistant IA pour Création & Édition d\'Images',
  description: 'Hébergez, organisez et améliorez vos images avec une IA de pointe. Générez des descriptions, éditez vos photos en langage naturel, et planifiez votre contenu visuel. L\'outil tout-en-un pour les créateurs de contenu.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                background-color: hsl(var(--background));
                background-image: linear-gradient(to top left, hsl(var(--background)) 50%, hsl(var(--secondary)));
                background-attachment: fixed;
              }
            `,
          }}
        />
      </head>
      <body className="font-body antialiased h-full">
        <FirebaseClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            themes={['light', 'dark', 'mid', 'system']}
          >
            <ErrorBoundary>
              <ErrorNotificationProvider>
                <div className="relative flex flex-col h-full">
                  <Navbar />
                  <main className="flex-grow pt-16">{children}</main>
                   <footer className="py-4 border-t mt-auto bg-card">
                    <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground gap-2">
                        <p>&copy; {new Date().getFullYear()} Clikup. Tous droits réservés.</p>
                        <Link href="/about" className="hover:text-primary hover:underline underline-offset-4 transition-colors">
                            À propos & Guide d'utilisation
                        </Link>
                    </div>
                  </footer>
                </div>
                <Toaster position="top-right" richColors />
              </ErrorNotificationProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
