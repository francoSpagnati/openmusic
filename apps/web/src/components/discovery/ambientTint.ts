/**
 * Design-system rule (docs/05 §3 "Ambient album tint"): a surface tinted with a cover's dominant
 * colour is clamped to HSL lightness 18–25% and saturation ≤ 45%, so text on it keeps contrast.
 * Returns an `hsl()` string, or null for an invalid hex. `alpha` (0–1) makes the tint
 * translucent: the restyle (ADR-015) keeps it faint and dark-theme only, so the cover itself
 * stays the main colour on the page.
 */
export function ambientTint(hex: string | null | undefined, alpha = 1): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match?.[1]) return null;
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const sat = clamp(s * 100, 0, 45);
  const light = clamp(l * 100, 18, 25);
  const a = clamp(alpha, 0, 1);
  const suffix = a < 1 ? ` / ${Math.round(a * 100) / 100}` : '';
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${Math.round(light)}%${suffix})`;
}
