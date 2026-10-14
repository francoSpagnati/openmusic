import type { Metadata } from 'next';
import { Syne, Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AudioPlayerProvider } from '../context/AudioPlayerContext';
import { AudioPlayerBar } from '../components/AudioPlayerBar';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OpenMusic — Social Network Musicale Analogico & Open Source',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="it"
      className={`${syne.variable} ${outfit.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-om-bg text-om-text flex flex-col selection:bg-om-amber selection:text-om-bg font-sans">
        <AudioPlayerProvider>
          <Navbar />
          <main className="flex-1 pb-16">{children}</main>
          <Footer />
          <AudioPlayerBar />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}
