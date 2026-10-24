import type { Metadata, Viewport } from 'next';
import { THEME } from '@openmusic/shared';
import { Suspense } from 'react';
import { Newsreader, Instrument_Sans, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AudioPlayerProvider } from '../context/AudioPlayerContext';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { ToastProvider } from '../components/ui';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from '../lib/theme';
import { OAuthReturnNotice } from '../components/web-core/shell/OAuthReturnNotice';
import { SessionRevocationNotice } from '../components/web-core/shell/SessionRevocationNotice';

// Typography decision (ADR-015, docs/05_DESIGN_SYSTEM.md §3), all open (SIL OFL) Google Fonts:
// Newsreader = editorial voice (headlines, album titles, pull-quotes); variable opsz 6–72.
// Instrument Sans = UI voice, a calm grotesque with humanist details.
// Spline Sans Mono = numbers (plain zero, real weights 300–700).
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-instrument',
  display: 'swap',
});

const splineMono = Spline_Sans_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-mono',
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
  // Light and dark follow the OS until the user picks one (ThemeToggle, ADR-015).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME.light.bg },
    { media: '(prefers-color-scheme: dark)', color: THEME.dark.bg },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the bootstrap script sets data-theme before React hydrates.
    <html
      lang="it"
      suppressHydrationWarning
      className={`${newsreader.variable} ${instrumentSans.variable} ${splineMono.variable}`}
    >
      <head>
        {/* Applies a stored theme choice before the first paint (no flash of the wrong theme). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-canvas font-sans text-fg">
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
