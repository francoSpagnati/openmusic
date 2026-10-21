import { useColorScheme } from 'react-native';
import { THEME, type ColorScheme, type ColorSchemeName } from '@openmusic/shared';
import { FONT } from './fonts';

export { FONT, FONT_ASSETS, type FontFamily } from './fonts';

export type TypeStep = keyof typeof THEME.typography.scale;

/** `{ fontSize, lineHeight }` for a step of the shared type scale. */
export function typeScale(step: TypeStep): { fontSize: number; lineHeight: number } {
  const [fontSize, lineHeight] = THEME.typography.scale[step];
  return { fontSize, lineHeight };
}

/** Letter-spacing in px from the shared em-based tracking tokens. */
export function tracking(kind: keyof typeof THEME.typography.tracking, fontSize: number): number {
  return THEME.typography.tracking[kind] * fontSize;
}

/** `#RRGGBB` + alpha (0..1) -> `rgba(...)`, for tinted fills like the web `bg-fresh/[0.1]`. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface AppTheme {
  name: ColorSchemeName;
  colors: ColorScheme;
  space: typeof THEME.space;
  radii: typeof THEME.radii;
  font: typeof FONT;
}

export function themeFor(name: ColorSchemeName): AppTheme {
  return {
    name,
    colors: THEME.scheme[name],
    space: THEME.space,
    radii: THEME.radii,
    font: FONT,
  };
}

/** Current theme from the OS appearance; dark ("record shop at night") is the default. */
export function useTheme(): AppTheme {
  const scheme = useColorScheme();
  return themeFor(scheme === 'light' ? 'light' : 'dark');
}
