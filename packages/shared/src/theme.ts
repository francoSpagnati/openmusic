/**
 * REGOLA TASSATIVA PER GLI AGENTI AI:
 * Non usare mai colori hardcoded o gradienti neon viola/ciano.
 * Importa sempre `THEME` da `@openmusic/shared` sia su Web che su Mobile.
 */
export const THEME = {
  colors: {
    // Dark Mode Editoriale / Calda (Default)
    bgPrimary: '#121214',      // Grigio Vinile Caldo (MAI #000000 puro)
    bgElevated: '#1C1C1F',     // Superfici Card / Bar
    bgInteractive: '#26262B',  // Hover / Active state
    textPrimary: '#F3F0E6',    // Crema / Avorio caldo
    textSecondary: '#9E9B93',  // Grigio sabbia per metadati
    textMuted: '#686660',
    accentWarm: '#D97736',     // Ambra / Terracotta analogico
    accentFresh: '#4E9F6E',    // Verde "Fresh" (Audience Score >= 70%)
    accentRotten: '#C85A4B',   // Rosso desaturato
    borderSubtle: '#2A2A2E',
  },
  typography: {
    fontEditorial: 'Fraunces',       // Titoli album e recensioni
    fontSans: 'PlusJakartaSans',     // UI e controlli
    fontMono: 'JetBrainsMono',       // Durate brani, punteggi, timestamp
  },
  // Configurazione fisica a molla per Reanimated v3 (60/120fps naturali)
  spring: {
    snappy: { damping: 18, stiffness: 220, mass: 0.8 },
    gentle: { damping: 22, stiffness: 140, mass: 1.0 },
  },
} as const;