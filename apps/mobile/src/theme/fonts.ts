import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader/400Regular_Italic';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { SplineSansMono_400Regular } from '@expo-google-fonts/spline-sans-mono/400Regular';
import { SplineSansMono_600SemiBold } from '@expo-google-fonts/spline-sans-mono/600SemiBold';

/**
 * Font families for `THEME.typography` ("Carta e argilla", ADR-015):
 * - Newsreader: headlines, album titles, pull-quotes (editorial serif);
 * - Instrument Sans: UI, controls, body copy;
 * - Spline Sans Mono: numbers only (durations, scores, counters), always tabular.
 *
 * On native every weight is its own family, so pick the family instead of setting `fontWeight`.
 * Only the weights the UI uses are bundled (the .ttf files ship with the app, no network).
 * The key names are kept stable so callers do not change when the faces do.
 */
export const FONT = {
  editorial: 'Newsreader_500Medium',
  editorialBold: 'Newsreader_600SemiBold',
  editorialItalic: 'Newsreader_400Regular_Italic',
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemiBold: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  mono: 'SplineSansMono_400Regular',
  monoBold: 'SplineSansMono_600SemiBold',
} as const;

export type FontFamily = (typeof FONT)[keyof typeof FONT];

/** Map passed to `useFonts` in the root layout. */
export const FONT_ASSETS: Record<FontFamily, number> = {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_400Regular_Italic,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  SplineSansMono_400Regular,
  SplineSansMono_600SemiBold,
};
