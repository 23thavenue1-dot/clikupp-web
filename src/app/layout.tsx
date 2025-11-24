
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Navbar } from '@/components/Navbar';
import { ThemeProvider } from '@/components/theme-provider';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Clikup',
  description: 'Votre plateforme de partage d\'images.',
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
            <Toaster />
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
