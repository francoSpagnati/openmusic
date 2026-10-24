/**
 * Measures WCAG 2.x contrast ratios for the THEME colour tokens, in both schemes.
 *
 *   npx tsx scripts/check-contrast.ts            # table + exit 1 on any failure
 *   npx tsx scripts/check-contrast.ts --markdown # markdown tables for docs/05_DESIGN_SYSTEM.md
 *
 * Thresholds: text 4.5:1 (AA normal text), UI boundaries and focus 3:1 (WCAG 1.4.11).
 * Tinted pairs (e.g. a "soft" badge: accent text on accent at 12% over the page) are
 * alpha-composited before measuring, exactly as the browser paints them.
 */
import { THEME, type ColorScheme, type ColorRole } from '../packages/shared/src/theme';

type Rgb = [number, number, number];

const hex = (value: string): Rgb => {
  const n = value.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as Rgb;
};

const mix = (top: Rgb, bottom: Rgb, alpha: number): Rgb =>
  top.map((c, i) => Math.round(c * alpha + bottom[i]! * (1 - alpha))) as Rgb;

const luminance = ([r, g, b]: Rgb): number => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const ratio = (a: Rgb, b: Rgb): number => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

interface Pair {
  fg: ColorRole;
  bg: ColorRole;
  /** Paint `bg` at this alpha over `over` first (tinted chips). */
  tint?: { alpha: number; over: ColorRole };
  min: number;
  note: string;
}

const surfaces: ColorRole[] = ['bg', 'surface', 'surfaceRaised', 'sunken'];
const pairs: Pair[] = [
  ...(
    ['text', 'textMuted', 'textSubtle', 'accent', 'fresh', 'rotten', 'warning'] as ColorRole[]
  ).flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: 4.5, note: 'testo' }))),
  ...(['borderStrong', 'focus'] as ColorRole[]).flatMap((fg) =>
    surfaces.map((bg) => ({ fg, bg, min: 3, note: 'bordo UI / focus' }))
  ),
  { fg: 'accentContrast', bg: 'accent', min: 4.5, note: 'testo su pulsante primario' },
  { fg: 'accentContrast', bg: 'accentHover', min: 4.5, note: 'testo su primario (hover)' },
  ...(['accent', 'fresh', 'rotten', 'warning'] as ColorRole[]).map((fg) => ({
    fg,
    bg: fg,
    tint: { alpha: 0.08, over: 'bg' as ColorRole },
    min: 4.5,
    note: 'badge "soft" (tinta 8% su bg)',
  })),
  ...(['accent', 'fresh', 'rotten', 'warning'] as ColorRole[]).map((fg) => ({
    fg,
    bg: fg,
    tint: { alpha: 0.08, over: 'surface' as ColorRole },
    min: 4.5,
    note: 'badge "soft" (tinta 8% su surface)',
  })),
  ...(['fresh', 'rotten', 'warning'] as ColorRole[]).map((bg) => ({
    fg: 'bg' as ColorRole,
    bg,
    min: 4.5,
    note: 'badge "solid" (testo bg su colore)',
  })),
];

const markdown = process.argv.includes('--markdown');
let failures = 0;

for (const name of ['light', 'dark'] as const) {
  const scheme: ColorScheme = THEME[name];
  const rows = pairs.map((pair) => {
    const background = pair.tint
      ? mix(hex(scheme[pair.bg]), hex(scheme[pair.tint.over]), pair.tint.alpha)
      : hex(scheme[pair.bg]);
    const value = ratio(hex(scheme[pair.fg]), background);
    const ok = value >= pair.min;
    if (!ok) failures += 1;
    const bgLabel = pair.tint
      ? `${pair.bg} ${pair.tint.alpha * 100}% / ${pair.tint.over}`
      : pair.bg;
    return { ...pair, bgLabel, value, ok };
  });

  if (markdown) {
    console.log(`\n#### Tema ${name === 'light' ? 'chiaro' : 'scuro'}\n`);
    console.log('| Primo piano | Sfondo | Rapporto | Minimo | Esito | Uso |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    for (const r of rows) {
      console.log(
        `| \`${r.fg}\` | \`${r.bgLabel}\` | ${r.value.toFixed(2)}:1 | ${r.min}:1 | ${r.ok ? 'AA' : '**NO**'} | ${r.note} |`
      );
    }
  } else {
    console.log(`\n== ${name}`);
    for (const r of rows) {
      console.log(
        `${r.ok ? 'ok  ' : 'FAIL'} ${r.fg.padEnd(15)} on ${r.bgLabel.padEnd(28)} ${r.value.toFixed(2).padStart(6)}:1 (min ${r.min})`
      );
    }
  }
}

if (!markdown) console.log(failures ? `\n${failures} pair(s) below threshold` : '\nall pairs pass');
process.exitCode = failures ? 1 : 0;
