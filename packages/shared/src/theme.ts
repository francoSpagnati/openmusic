/**
 * OpenMusic design tokens — "Carta e argilla" (warm, calm, editorial).
 *
 * REGOLA TASSATIVA PER GLI AGENTI AI:
 * Non usare mai colori hardcoded o gradienti neon viola/ciano.
 * Importa sempre `THEME` da `@openmusic/shared` sia su Web che su Mobile.
 *
 * Single source of truth for every platform. The web app does NOT copy these values by hand:
 * `apps/web/tailwind.config.ts` turns `THEME.light` / `THEME.dark` into the `--om-*` CSS
 * variables (RGB channels, so Tailwind opacity modifiers keep working). Contrast ratios are
 * measured by `scripts/check-contrast.ts`. See docs/05_DESIGN_SYSTEM.md and ADR-015.
 */

/** Semantic colour roles shared by the light and dark schemes. */
export interface ColorScheme {
  /* ---- Canonical roles (ADR-015) ---- */
  /** Page background. Light: ivory paper. Dark: warm graphite. Never #000 / #FFF. */
  bg: string;
  /** Cards, sidebars, grouped content. Light: soft stone. */
  surface: string;
  /** Dialogs, popovers, toasts, menus, inputs: the layer closest to the reader. */
  surfaceRaised: string;
  /** Hairline dividers and card edges (decorative, not a component boundary). */
  border: string;
  /** Component boundaries (inputs, outline buttons): >= 3:1 on bg, surface and surfaceRaised. */
  borderStrong: string;
  /** Body and headline text. */
  text: string;
  /** Secondary text, metadata. AA (>= 4.5:1) on every surface. */
  textMuted: string;
  /** Least-emphasised text that must still be readable. AA on every surface. */
  textSubtle: string;
  /** Terracotta/clay: primary action, focus, active nav, links. Use sparingly. */
  accent: string;
  /** Hover/pressed variant of the accent. */
  accentHover: string;
  /** Text/icon colour placed on an accent fill. */
  accentContrast: string;
  /** Keyboard focus ring (>= 3:1 on every surface). */
  focus: string;
  /** Positive: score >= 70%, success, "listening now". */
  fresh: string;
  /** Negative: score < 70%, errors, destructive actions. */
  rotten: string;
  /** Caution, mixed scores. */
  warning: string;
  /** Modal backdrop base colour (used with alpha). */
  overlay: string;

  /* ---- Backward-compatible keys (mobile + older web code). Same values as the roles above. ---- */
  /** Recessed wells (search field, player groove). Between bg and surface. */
  sunken: string;
  /** @deprecated use `surfaceRaised`. */
  elevated: string;
  /** @deprecated use `textMuted`. */
  textSecondary: string;
  /** @deprecated use `textSubtle`. */
  muted: string;
  /** @deprecated use `accentHover`. */
  accentStrong: string;
  /** @deprecated use `accentContrast`. */
  onAccent: string;
  /** @deprecated use `warning`. */
  mixed: string;
  /** "Listening now" indicator (= fresh). */
  live: string;
}

type CanonicalRoles = Omit<
  ColorScheme,
  'sunken' | 'elevated' | 'textSecondary' | 'muted' | 'accentStrong' | 'onAccent' | 'mixed' | 'live'
>;

const withAliases = (roles: CanonicalRoles, sunken: string): ColorScheme => ({
  ...roles,
  sunken,
  elevated: roles.surfaceRaised,
  textSecondary: roles.textMuted,
  muted: roles.textSubtle,
  accentStrong: roles.accentHover,
  onAccent: roles.accentContrast,
  mixed: roles.warning,
  live: roles.fresh,
});

/** Light: ivory paper, warm ink, soft stone. */
const light: ColorScheme = withAliases(
  {
    bg: '#F6F2EA',
    surface: '#EEE8DC',
    surfaceRaised: '#FBF9F4',
    border: '#E0D8C9',
    borderStrong: '#867D6D',
    text: '#24211C',
    textMuted: '#5A534A',
    textSubtle: '#6F675B',
    accent: '#9C4423',
    accentHover: '#82381C',
    accentContrast: '#FCF8F2',
    focus: '#9C4423',
    fresh: '#2E6A45',
    rotten: '#A33340',
    warning: '#7F5409',
    overlay: '#24211C',
  },
  '#EFEAE0'
);

/** Dark: warm graphite (not black, not blue-grey), clay lifted for contrast. */
const dark: ColorScheme = withAliases(
  {
    bg: '#1E1C19',
    surface: '#272521',
    surfaceRaised: '#302D29',
    border: '#3A3732',
    borderStrong: '#847C71',
    text: '#ECE7DE',
    textMuted: '#BBB3A6',
    textSubtle: '#9C9487',
    accent: '#DE8C66',
    accentHover: '#E9A281',
    accentContrast: '#1E1C19',
    focus: '#E59B78',
    fresh: '#72BC8E',
    rotten: '#E9767F',
    warning: '#D7A64C',
    overlay: '#0F0E0C',
  },
  '#191815'
);

const easeOut = [0.22, 1, 0.36, 1] as const;

export const THEME = {
  /** Light scheme ("carta"). Default when the user has not chosen and the OS is light. */
  light,
  /** Dark scheme ("grafite"). */
  dark,
  /** Both schemes by name (`THEME.scheme[name]`), kept for mobile's `themeFor()`. */
  scheme: { light, dark },
  /**
   * Legacy flat colour keys (dark scheme). Kept for backward compatibility with mobile code;
   * prefer `THEME.light.*` / `THEME.dark.*` (or `THEME.scheme[name]`) in new code.
   */
  colors: {
    bgPrimary: dark.bg,
    bgElevated: dark.surface,
    bgInteractive: dark.surfaceRaised,
    textPrimary: dark.text,
    textSecondary: dark.textMuted,
    textMuted: dark.textSubtle,
    accentWarm: dark.accent,
    accentFresh: dark.fresh,
    accentMixed: dark.warning,
    accentRotten: dark.rotten,
    borderSubtle: dark.border,
    borderStrong: dark.borderStrong,
    focus: dark.focus,
  },
  typography: {
    /** Headlines, album titles, review pull-quotes. Variable: opsz 6–72, wght 200–800, italic. */
    fontEditorial: 'Newsreader',
    /** UI, controls, body copy. Variable: wght 400–700, wdth 75–100. */
    fontSans: 'InstrumentSans',
    /** Durations, scores, timestamps, counters (always tabular-nums). */
    fontMono: 'SplineSansMono',
    /** Type scale in px: [fontSize, lineHeight]. Restrained, generous leading. */
    scale: {
      xs: [12, 18],
      sm: [14, 21],
      base: [16, 26],
      lg: [18, 28],
      xl: [20, 30],
      '2xl': [24, 32],
      '3xl': [30, 38],
      '4xl': [36, 42],
      '5xl': [46, 52],
      '6xl': [58, 62],
    },
    weight: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
    /** Letter-spacing in em. Display serif is slightly tightened, never tracked-out caps. */
    tracking: { tight: -0.015, normal: 0, wide: 0.02, label: 0.02 },
    /** Reading measure in `ch`. */
    measure: { prose: 68, narrow: 52 },
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
  /** In px. Soft, never pill-shaped except avatars/badges/dots. `sleeve` = card corner. */
  radii: { none: 0, xs: 4, sm: 6, sleeve: 10, md: 8, lg: 12, xl: 16, pill: 9999 },
  /**
   * CSS box-shadow strings (web). Near zero: structure comes from hairline borders. Only
   * floating layers (dialog, toast, popover) get a soft, warm, low-opacity lift.
   */
  shadow: {
    none: 'none',
    sm: '0 1px 0 rgba(36, 33, 28, 0.04)',
    md: '0 1px 2px rgba(36, 33, 28, 0.05), 0 4px 12px -6px rgba(36, 33, 28, 0.08)',
    lg: '0 2px 4px rgba(36, 33, 28, 0.04), 0 16px 32px -16px rgba(36, 33, 28, 0.18)',
    sleeve: '0 1px 0 rgba(36, 33, 28, 0.04)',
  },
  motion: {
    /** In ms. UI feedback 150–250; `groove` is the loop period of loaders. */
    duration: { instant: 100, fast: 150, base: 200, slow: 250, groove: 1800 },
    /** Delay between items of a staggered list, in ms (cap the list at ~8 items). */
    stagger: 40,
    /** Distance of enter/exit translations, in px (4–8). */
    distance: { sm: 4, md: 6, lg: 8 },
    /** cubic-bezier control points. `out` is the house curve. */
    easing: {
      out: easeOut,
      standard: [0.2, 0, 0, 1],
      enter: easeOut,
      exit: [0.4, 0, 1, 1],
      /** @deprecated kept for mobile; no overshoot in the calm direction. */
      tonearm: easeOut,
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
  /** Spring physics for Reanimated v3: critically damped, no rubbery overshoot. */
  spring: {
    snappy: { damping: 24, stiffness: 240, mass: 0.8 },
    gentle: { damping: 26, stiffness: 150, mass: 1.0 },
  },
} as const;

export type Theme = typeof THEME;
export type ColorSchemeName = keyof Theme['scheme'];
export type ColorRole = keyof ColorScheme;
