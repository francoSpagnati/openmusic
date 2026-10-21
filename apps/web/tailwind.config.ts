import type { Config } from 'tailwindcss';
import { THEME } from '../../packages/shared/src/theme';

/** rgb(var(--om-x) / <alpha-value>) so opacity modifiers keep working. */
const token = (name: string): string => `rgb(var(--om-${name}) / <alpha-value>)`;

const px = (value: number): string => `${value}px`;

const zIndex = Object.fromEntries(
  Object.entries(THEME.zIndex).map(([key, value]) => [key, String(value)])
);

const durations = Object.fromEntries(
  Object.entries(THEME.motion.duration).map(([key, value]) => [key, `${value}ms`])
);

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Semantic tokens (use these in new code) */
        canvas: token('bg'),
        sunken: token('sunken'),
        surface: token('surface'),
        elevated: token('elevated'),
        line: token('border'),
        'line-strong': token('border-strong'),
        ink: token('text'),
        'ink-secondary': token('text-secondary'),
        'ink-muted': token('muted'),
        accent: token('accent'),
        'accent-strong': token('accent-strong'),
        'on-accent': token('on-accent'),
        fresh: token('fresh'),
        mixed: token('mixed'),
        rotten: token('rotten'),
        live: token('live'),
        focus: token('focus'),

        /* Legacy aliases — same variables, kept so existing pages keep working */
        'om-bg': token('bg'),
        'om-card': token('surface'),
        'om-interactive': token('elevated'),
        'om-text': token('text'),
        'om-secondary': token('text-secondary'),
        'om-muted': token('muted'),
        'om-amber': token('accent'),
        'om-fresh': token('fresh'),
        'om-rotten': token('rotten'),
        'om-border': token('border'),
      },
      fontFamily: {
        editorial: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* Fluid display sizes for editorial headlines (Fraunces) */
        'display-sm': ['clamp(1.75rem, 1.4rem + 1.5vw, 2.4375rem)', { lineHeight: '1.1' }],
        'display-md': ['clamp(2.25rem, 1.7rem + 2.4vw, 3.0625rem)', { lineHeight: '1.05' }],
        'display-lg': ['clamp(2.75rem, 1.9rem + 3.6vw, 3.8125rem)', { lineHeight: '1' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.12em' }],
      },
      borderRadius: {
        xs: px(THEME.radii.xs),
        sleeve: px(THEME.radii.sleeve),
      },
      boxShadow: {
        'om-sm': 'var(--om-shadow-sm)',
        'om-md': 'var(--om-shadow-md)',
        'om-lg': 'var(--om-shadow-lg)',
        sleeve: 'var(--om-shadow-sleeve)',
        /* Legacy names, re-pointed to the warm lift shadows */
        analog: 'var(--om-shadow-md)',
        glow: 'var(--om-shadow-md)',
      },
      zIndex,
      transitionDuration: durations,
      transitionTimingFunction: {
        standard: 'var(--om-ease-standard)',
        enter: 'var(--om-ease-enter)',
        exit: 'var(--om-ease-exit)',
        tonearm: 'var(--om-ease-tonearm)',
      },
      animation: {
        'spin-record': 'om-spin var(--om-duration-groove) linear infinite',
        shimmer: 'om-shimmer 1.6s var(--om-ease-standard) infinite',
        'toast-in': 'om-toast-in var(--om-duration-slow) var(--om-ease-enter) both',
        'dialog-in': 'om-dialog-in var(--om-duration-base) var(--om-ease-enter) both',
      },
    },
  },
  plugins: [],
};

export default config;
