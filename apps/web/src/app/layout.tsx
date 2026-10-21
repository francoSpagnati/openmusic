import type { Metadata, Viewport } from 'next';
import { THEME } from '@openmusic/shared';
import { Suspense } from 'react';
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AudioPlayerProvider } from '../context/AudioPlayerContext';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { ToastProvider } from '../components/ui';
import { AuthProvider } from '../lib/auth';
import { OAuthReturnNotice } from '../components/web-core/shell/OAuthReturnNotice';
import { SessionRevocationNotice } from '../components/web-core/shell/SessionRevocationNotice';

// Typography decision (docs/05_DESIGN_SYSTEM.md §2):
// Fraunces = editorial voice (headlines, reviews), variable with opsz/SOFT/WONK axes.
// Plus Jakarta Sans = UI voice. JetBrains Mono = numbers, durations, scores.
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
  variable: '--font-fraunces',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'OpenMusic — Social Network Musicale Analogico & Open Source',
    template: '%s · OpenMusic',
  },
  description:
    'Ascolto in tempo reale con gli amici, Voto del Pubblico e della Critica accreditata (Rotten Tomatoes musicale), e catalogazione vinilica.',
  keywords: [
    'musica',
    'social network',
    'open-source',
    'recensioni musica',
    'critic score',
    'now playing',
    'vinile',
    'letterboxd per la musica',
  ],
  authors: [{ name: 'OpenMusic Community' }],
  openGraph: {
    title: 'OpenMusic — Il Social Network Musicale Analogico',
    description:
      'Voto della Critica e del Pubblico stile Rotten Tomatoes, ascolto in tempo reale e anteprime 30s senza barriere.',
    url: 'https://openmusic.social',
    siteName: 'OpenMusic',
    locale: 'it_IT',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenMusic — Social Network Musicale Analogico',
    description:
      'Il Rotten Tomatoes della musica con ascolto sincronizzato e catalogazione Lato A / Lato B.',
  },
};

export const viewport: Viewport = {
  // The app ships dark-first; the light "carta editoriale" scheme is opt-in.
  themeColor: THEME.scheme.dark.bg,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="it"
      className={`${fraunces.variable} ${jakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-om-bg text-om-text flex flex-col selection:bg-om-amber selection:text-om-bg font-sans">
        <AuthProvider>
          <ToastProvider>
            {/* useSearchParams() needs a Suspense boundary for static rendering. */}
            <Suspense fallback={null}>
              <OAuthReturnNotice />
            </Suspense>
            <SessionRevocationNotice />
            <AudioPlayerProvider>
              <Navbar />
              <main className="flex-1 pb-16">{children}</main>
              <Footer />
              <AudioPlayerBar />
            </AudioPlayerProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
