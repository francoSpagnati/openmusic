import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'om-bg': '#121214',
        'om-card': '#1C1C1F',
        'om-interactive': '#26262B',
        'om-text': '#F3F0E6',
        'om-secondary': '#9E9B93',
        'om-muted': '#686660',
        'om-amber': '#D97736',
        'om-fresh': '#4E9F6E',
        'om-rotten': '#C85A4B',
        'om-border': '#2A2A2E',
      },
      fontFamily: {
        editorial: ['var(--font-fraunces)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-plus-jakarta)', 'Plus Jakarta Sans', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        analog: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
        glow: '0 0 25px -5px rgba(217, 119, 54, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
