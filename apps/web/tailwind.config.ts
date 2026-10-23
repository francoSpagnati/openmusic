import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import { THEME, type ColorScheme } from '../../packages/shared/src/theme';

/**
 * OpenMusic Tailwind config (ADR-015, docs/05_DESIGN_SYSTEM.md).
 *
 * Colours are NOT copied here or in globals.css: the plugin below writes `THEME.light` and
 * `THEME.dark` as `--om-*` CSS variables (RGB channels), switched by `[data-theme]` on <html>
 * and, when the user has not chosen, by `prefers-color-scheme`. Tailwind colours read them as
 * rgb(var(--om-x) / <alpha-value>) so opacity modifiers (`bg-accent/10`) keep working.
 */

/** rgb(var(--om-x) / <alpha-value>) so opacity modifiers keep working. */
const token = (name: string): string => `rgb(var(--om-${name}) / <alpha-value>)`;

const px = (value: number): string => `${value}px`;
const rem = (value: number): string => `${value / 16}rem`;

const channels = (hex: string): string => {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).join(' ');
};

/** Canonical role → CSS variable name. */
const ROLE_VARS: Array<[keyof ColorScheme, string]> = [
  ['bg', 'bg'],
  ['surface', 'surface'],
  ['surfaceRaised', 'surface-raised'],
  ['sunken', 'sunken'],
  ['border', 'border'],
  ['borderStrong', 'border-strong'],
  ['text', 'text'],
  ['textMuted', 'text-muted'],
  ['textSubtle', 'text-subtle'],
  ['accent', 'accent'],
  ['accentHover', 'accent-hover'],
  ['accentContrast', 'accent-contrast'],
  ['focus', 'focus'],
  ['fresh', 'fresh'],
  ['rotten', 'rotten'],
  ['warning', 'warning'],
  ['overlay', 'overlay'],
];

const schemeVars = (scheme: ColorScheme): Record<string, string> =>
  Object.fromEntries(ROLE_VARS.map(([role, name]) => [`--om-${name}`, channels(scheme[role])]));

/**
 * Legacy CSS variables (pre ADR-015), aliased once to the canonical ones.
 * NOTE the shift: legacy `--om-muted` is the THIRD text level (= `--om-text-subtle`),
 * while the new `--om-text-muted` is the SECOND level (= legacy `--om-text-secondary`).
 */
const LEGACY_VARS: Record<string, string> = {
  '--om-elevated': 'var(--om-surface-raised)',
  '--om-text-secondary': 'var(--om-text-muted)',
  '--om-muted': 'var(--om-text-subtle)',
  '--om-accent-strong': 'var(--om-accent-hover)',
  '--om-on-accent': 'var(--om-accent-contrast)',
  '--om-mixed': 'var(--om-warning)',
  '--om-live': 'var(--om-fresh)',
  '--om-shadow-rgb': 'var(--om-overlay)',
};

const bezier = (points: readonly number[]): string => `cubic-bezier(${points.join(', ')})`;

const motionVars: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(THEME.motion.duration).map(([key, value]) => [
      `--om-duration-${key}`,
      `${value}ms`,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(THEME.motion.easing).map(([key, value]) => [`--om-ease-${key}`, bezier(value)])
  ),
  '--om-stagger': `${THEME.motion.stagger}ms`,
  '--om-distance-sm': px(THEME.motion.distance.sm),
  '--om-distance-md': px(THEME.motion.distance.md),
  '--om-distance-lg': px(THEME.motion.distance.lg),
};

const radiusVars: Record<string, string> = Object.fromEntries(
  Object.entries(THEME.radii)
    .filter(([key]) => key !== 'none' && key !== 'pill')
    .map(([key, value]) => [`--om-radius-${key}`, px(value)])
);

const themeTokens = plugin(({ addBase }) => {
  addBase({
    ':root': {
      colorScheme: 'light dark',
      ...schemeVars(THEME.light),
      ...LEGACY_VARS,
      ...motionVars,
      ...radiusVars,
    },
    '@media (prefers-color-scheme: dark)': {
      ':root:not([data-theme="light"])': { colorScheme: 'dark', ...schemeVars(THEME.dark) },
    },
    ':root[data-theme="light"]': { colorScheme: 'light' },
    ':root[data-theme="dark"]': { colorScheme: 'dark', ...schemeVars(THEME.dark) },
  });
});

const zIndex = Object.fromEntries(
  Object.entries(THEME.zIndex).map(([key, value]) => [key, String(value)])
);

const durations = Object.fromEntries(
  Object.entries(THEME.motion.duration).map(([key, value]) => [key, `${value}ms`])
);

const fontSize = Object.fromEntries(
  Object.entries(THEME.typography.scale).map(([key, [size, line]]) => [
    key,
    [rem(size), { lineHeight: rem(line) }],
  ])
) as Record<string, [string, { lineHeight: string }]>;

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // `dark:` follows the same rule as the tokens: explicit choice first, then the OS.
  darkMode: [
    'variant',
    [
      '@media (prefers-color-scheme: dark) { &:where(:root:not([data-theme="light"]) *) }',
      '&:where([data-theme="dark"] *)',
    ],
  ],
  theme: {
    extend: {
      colors: {
        /* Canonical semantic tokens (ADR-015): use these in new code */
        canvas: token('bg'),
        surface: token('surface'),
        'surface-raised': token('surface-raised'),
        sunken: token('sunken'),
        line: token('border'),
        'line-strong': token('border-strong'),
        fg: token('text'),
        'fg-muted': token('text-muted'),
        'fg-subtle': token('text-subtle'),
        accent: token('accent'),
        'accent-hover': token('accent-hover'),
        'accent-contrast': token('accent-contrast'),
        focus: token('focus'),
        fresh: token('fresh'),
        rotten: token('rotten'),
        warning: token('warning'),
        overlay: token('overlay'),

        /* Aliases kept so existing pages keep working (same variables) */
        elevated: token('surface-raised'),
        ink: token('text'),
        'ink-secondary': token('text-muted'),
        'ink-muted': token('text-subtle'),
        'accent-strong': token('accent-hover'),
        'on-accent': token('accent-contrast'),
        mixed: token('warning'),
        live: token('fresh'),

        /* Oldest aliases (pre ADR-008) */
        'om-bg': token('bg'),
        'om-card': token('surface'),
        'om-interactive': token('surface-raised'),
        'om-text': token('text'),
        'om-secondary': token('text-muted'),
        'om-muted': token('text-subtle'),
        'om-amber': token('accent'),
        'om-fresh': token('fresh'),
        'om-rotten': token('rotten'),
        'om-border': token('border'),
      },
      fontFamily: {
        editorial: ['var(--font-newsreader)', 'Newsreader', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['var(--font-instrument)', 'Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Spline Sans Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        ...fontSize,
        /* Fluid display sizes for editorial headlines (Newsreader) */
        'display-sm': ['clamp(1.75rem, 1.45rem + 1.2vw, 2.25rem)', { lineHeight: '1.15' }],
        'display-md': ['clamp(2.125rem, 1.6rem + 2vw, 2.875rem)', { lineHeight: '1.1' }],
        'display-lg': ['clamp(2.5rem, 1.75rem + 3vw, 3.625rem)', { lineHeight: '1.05' }],
        eyebrow: ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
      },
      maxWidth: {
        prose: `${THEME.typography.measure.prose}ch`,
        narrow: `${THEME.typography.measure.narrow}ch`,
      },
      borderRadius: {
        DEFAULT: px(THEME.radii.sm),
        xs: px(THEME.radii.xs),
        sm: px(THEME.radii.sm),
        md: px(THEME.radii.md),
        lg: px(THEME.radii.lg),
        xl: px(THEME.radii.xl),
        sleeve: px(THEME.radii.sleeve),
      },
      boxShadow: {
        'om-sm': 'var(--om-shadow-sm)',
        'om-md': 'var(--om-shadow-md)',
        'om-lg': 'var(--om-shadow-lg)',
        sleeve: 'var(--om-shadow-sleeve)',
        hairline: 'inset 0 0 0 1px rgb(var(--om-border))',
        /* Legacy names, re-pointed to the near-zero elevation */
        analog: 'var(--om-shadow-md)',
        glow: 'var(--om-shadow-md)',
      },
      zIndex,
      transitionDuration: { DEFAULT: `${THEME.motion.duration.base}ms`, ...durations },
      transitionTimingFunction: {
        DEFAULT: 'var(--om-ease-out)',
        out: 'var(--om-ease-out)',
        standard: 'var(--om-ease-standard)',
        enter: 'var(--om-ease-enter)',
        exit: 'var(--om-ease-exit)',
        tonearm: 'var(--om-ease-tonearm)',
      },
      transitionDelay: { stagger: `${THEME.motion.stagger}ms` },
      animation: {
        'fade-in': 'om-fade-in var(--om-duration-base) var(--om-ease-out) both',
        'fade-up': 'om-fade-up var(--om-duration-slow) var(--om-ease-out) both',
        'spin-record': 'om-spin var(--om-duration-groove) linear infinite',
        shimmer: 'om-shimmer 2.4s var(--om-ease-standard) infinite',
        'pulse-soft': 'om-pulse-soft 2s var(--om-ease-standard) infinite',
        'toast-in': 'om-fade-up var(--om-duration-slow) var(--om-ease-out) both',
        'dialog-in': 'om-dialog-in var(--om-duration-slow) var(--om-ease-out) both',
      },
    },
  },
  plugins: [themeTokens],
};

export default config;
