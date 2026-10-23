import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { tracking, typeScale, useTheme, type AppTheme, type TypeStep } from '../../theme';

export type TextVariant =
  | 'display'
  | 'headline'
  | 'title'
  | 'deck'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'eyebrow'
  | 'mono';

export type TextTone =
  'primary' | 'secondary' | 'muted' | 'accent' | 'fresh' | 'rotten' | 'onAccent';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides the variant's default type-scale step. */
  size?: TypeStep;
}

const variantStep: Record<TextVariant, TypeStep> = {
  display: '4xl',
  headline: '2xl',
  title: 'lg',
  deck: 'lg',
  body: 'base',
  bodyStrong: 'base',
  caption: 'sm',
  eyebrow: 'xs',
  mono: 'sm',
};

/** 13px, the web `.om-eyebrow` size (between the xs and sm steps). */
const EYEBROW_SCALE = { fontSize: 13, lineHeight: 18 };

function variantStyle(variant: TextVariant, theme: AppTheme, fontSize: number): TextStyle {
  switch (variant) {
    case 'display':
    case 'headline':
      return { fontFamily: theme.font.editorial, letterSpacing: tracking('tight', fontSize) };
    case 'title':
      return { fontFamily: theme.font.editorial };
    case 'deck':
      return { fontFamily: theme.font.editorialItalic };
    case 'bodyStrong':
      return { fontFamily: theme.font.sansSemiBold };
    case 'eyebrow':
      // Sentence-case sans label (web `.om-eyebrow`): never tracked-out caps, never mono.
      return { fontFamily: theme.font.sansMedium };
    case 'mono':
      return { fontFamily: theme.font.mono, fontVariant: ['tabular-nums'] };
    default:
      return { fontFamily: theme.font.sans };
  }
}

function toneColor(tone: TextTone, theme: AppTheme): string {
  const c = theme.colors;
  const map: Record<TextTone, string> = {
    primary: c.text,
    secondary: c.textMuted,
    muted: c.textSubtle,
    accent: c.accent,
    fresh: c.fresh,
    rotten: c.rotten,
    onAccent: c.accentContrast,
  };
  return map[tone];
}

/**
 * Typography primitive: Newsreader for editorial variants (display, headline, title, deck),
 * Instrument Sans for UI and labels, Spline Sans Mono (tabular) only for numbers.
 * Mirrors `.om-headline` / `.om-deck` / `.om-eyebrow`.
 */
export function Text({ variant = 'body', tone, size, style, ...rest }: TextProps) {
  const theme = useTheme();
  const scale =
    variant === 'eyebrow' && !size ? EYEBROW_SCALE : typeScale(size ?? variantStep[variant]);
  const defaultTone: TextTone =
    variant === 'eyebrow' ? 'muted' : variant === 'caption' ? 'secondary' : 'primary';
  return (
    <RNText
      {...rest}
      style={[
        scale,
        variantStyle(variant, theme, scale.fontSize),
        { color: toneColor(tone ?? defaultTone, theme) },
        style,
      ]}
    />
  );
}
