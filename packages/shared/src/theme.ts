/**
 * OpenMusic design tokens — "Warm Editorial Vinyl".
 *
 * REGOLA TASSATIVA PER GLI AGENTI AI:
 * Non usare mai colori hardcoded o gradienti neon viola/ciano.
 * Importa sempre `THEME` da `@openmusic/shared` sia su Web che su Mobile.
 *
 * Source of truth for every platform. The web app mirrors these values as CSS
 * custom properties in `apps/web/src/app/globals.css` (RGB channels so Tailwind
 * opacity modifiers keep working). When you change a value here, change it there
 * too. See docs/05_DESIGN_SYSTEM.md.
 */

/** Semantic colour roles shared by the dark and light schemes. */
export interface ColorScheme {
  /** Page background: the "record shop at night" warm charcoal. Never #000. */
  bg: string;
  /** Recessed wells (inputs, player bar groove, code). */
  sunken: string;
  /** Cards, sheets, sidebars. */
  surface: string;
  /** Popovers, dialogs, hover state on surfaces. */
  elevated: string;
  /** Hairline dividers and decorative borders (not a UI boundary). */
  border: string;
  /** UI component boundaries (inputs, outline buttons): >= 3:1 on surfaces. */
  borderStrong: string;
  /** Body and headline text. */
  text: string;
  /** Metadata, captions. AA on every surface. */
  textSecondary: string;
  /** Least-emphasised text that must still be readable (AA >= 4.5:1). */
  muted: string;
  /** Analog amber: primary action, active state, stars. */
  accent: string;
  /** Hover/pressed variant of the accent. */
  accentStrong: string;
  /** Text/icon colour placed on top of an accent fill. */
  onAccent: string;
  /** Score >= 70%. */
  fresh: string;
  /** Score 45–69%. */
  mixed: string;
  /** Score < 45%. */
  rotten: string;
  /** "Listening now" indicator. */
  live: string;
  /** Keyboard focus ring. */
  focus: string;
}

const dark: ColorScheme = {
  bg: '#14120F',
  sunken: '#100E0C',
  surface: '#1D1A16',
  elevated: '#27231E',
  border: '#3A342C',
  borderStrong: '#7D7262',
  text: '#F2EBDD',
  textSecondary: '#B8AE9C',
  muted: '#968C7C',
  accent: '#E58A4A',
  accentStrong: '#F09C5F',
  onAccent: '#14120F',
  fresh: '#5DB585',
  mixed: '#D9A63E',
  rotten: '#E07360',
  live: '#5DB585',
  focus: '#F4C27A',
};

const light: ColorScheme = {
  bg: '#F5F0E6',
  sunken: '#EAE3D4',
  surface: '#EDE6D8',
  elevated: '#FBF8F2',
  border: '#D9CFBD',
  borderStrong: '#8A7F6E',
  text: '#1C1915',
  textSecondary: '#4F483E',
  muted: '#6A6255',
  accent: '#9A4716',
  accentStrong: '#7F3A10',
  onAccent: '#F5F0E6',
  fresh: '#2A6F48',
  mixed: '#7A580B',
  rotten: '#A63725',
  live: '#2A6F48',
  focus: '#9A4A16',
};

export const THEME = {
  /**
   * Legacy flat colour keys (dark scheme). Kept for backward compatibility with
   * existing web/mobile code; prefer `THEME.scheme.dark.*` in new code.
   */
  colors: {
    bgPrimary: dark.bg,
    bgElevated: dark.surface,
    bgInteractive: dark.elevated,
    textPrimary: dark.text,
    textSecondary: dark.textSecondary,
    textMuted: dark.muted,
    accentWarm: dark.accent,
    accentFresh: dark.fresh,
    accentMixed: dark.mixed,
    accentRotten: dark.rotten,
    borderSubtle: dark.border,
    borderStrong: dark.borderStrong,
    focus: dark.focus,
  },
  /** Full semantic schemes. Dark is the default; light is "carta editoriale". */
  scheme: { dark, light },
  typography: {
    /** Headlines, album titles, review pull-quotes. Variable: opsz, SOFT, WONK. */
    fontEditorial: 'Fraunces',
    /** UI, controls, body copy. */
    fontSans: 'PlusJakartaSans',
    /** Durations, scores, timestamps (always tabular-nums). */
    fontMono: 'JetBrainsMono',
    /** Type scale in px: [fontSize, lineHeight]. Ratio ~1.25 (major third). */
    scale: {
      xs: [12, 16],
      sm: [14, 20],
      base: [16, 24],
      lg: [18, 28],
      xl: [20, 28],
      '2xl': [25, 32],
      '3xl': [31, 36],
      '4xl': [39, 44],
      '5xl': [49, 52],
      '6xl': [61, 62],
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
    /** Letter-spacing in em. */
    tracking: { tight: -0.02, normal: 0, wide: 0.04, label: 0.12 },
  },
  /** 4px base grid, in px. */
  space: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
  },
  /** In px. "sleeve" is the slightly-rounded cardboard corner of a record sleeve. */
  radii: { none: 0, xs: 2, sm: 4, sleeve: 6, md: 8, lg: 12, xl: 16, pill: 9999 },
  /** CSS box-shadow strings (web). Warm-tinted, never coloured glows. */
  shadow: {
    sm: '0 1px 2px rgba(10, 8, 5, 0.35)',
    md: '0 2px 6px -1px rgba(10, 8, 5, 0.40), 0 8px 20px -6px rgba(10, 8, 5, 0.45)',
    lg: '0 4px 12px -2px rgba(10, 8, 5, 0.45), 0 24px 48px -12px rgba(10, 8, 5, 0.55)',
    sleeve: '0 1px 0 rgba(255, 244, 222, 0.04) inset, 0 10px 24px -12px rgba(10, 8, 5, 0.7)',
  },
  motion: {
    /** In ms. */
    duration: { instant: 80, fast: 140, base: 200, slow: 320, groove: 1800 },
    /** cubic-bezier control points. */
    easing: {
      standard: [0.2, 0, 0, 1],
      enter: [0, 0, 0.2, 1],
      exit: [0.4, 0, 1, 1],
      tonearm: [0.3, 1.3, 0.5, 1],
    },
  },
  zIndex: {
    base: 0,
    raised: 10,
    sticky: 100,
    playerBar: 200,
    overlay: 300,
    dialog: 400,
    toast: 500,
    tooltip: 600,
  },
  /** Spring physics for Reanimated v3 (60/120fps, no rubbery overshoot). */
  spring: {
    snappy: { damping: 18, stiffness: 220, mass: 0.8 },
    gentle: { damping: 22, stiffness: 140, mass: 1.0 },
  },
} as const;

export type Theme = typeof THEME;
export type ColorSchemeName = keyof Theme['scheme'];
