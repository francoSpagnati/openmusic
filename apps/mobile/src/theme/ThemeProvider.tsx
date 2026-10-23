import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { THEME, type ColorScheme, type ColorSchemeName } from '@openmusic/shared';
import { FONT } from './fonts';

/** What the user picked in Settings: a fixed scheme, or follow the OS ("Sistema", default). */
export type ThemePreference = ColorSchemeName | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

const PREFERENCE_KEY = 'om_theme_preference';

export interface AppTheme {
  name: ColorSchemeName;
  colors: ColorScheme;
  space: typeof THEME.space;
  radii: typeof THEME.radii;
  font: typeof FONT;
  motion: typeof THEME.motion;
}

export function themeFor(name: ColorSchemeName): AppTheme {
  return {
    name,
    colors: THEME.scheme[name],
    space: THEME.space,
    radii: THEME.radii,
    font: FONT,
    motion: THEME.motion,
  };
}

const THEMES: Record<ColorSchemeName, AppTheme> = {
  light: themeFor('light'),
  dark: themeFor('dark'),
};

/** OS appearance -> scheme. Light ("carta") is the default when the OS does not say. */
export function resolveScheme(
  preference: ThemePreference,
  os: string | null | undefined
): ColorSchemeName {
  if (preference !== 'system') return preference;
  return os === 'dark' ? 'dark' : 'light';
}

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

interface ThemeContextValue {
  theme: AppTheme;
  preference: ThemePreference;
  /** The scheme the OS asks for right now (shown next to "Sistema"). */
  systemScheme: ColorSchemeName;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Light/dark theme for the whole app. Follows the OS appearance unless the user picked
 * "Chiaro" or "Scuro" in Settings; the choice is stored on the device (expo-secure-store,
 * the store the app already ships) and restored on the next launch.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const os = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(PREFERENCE_KEY)
      .then((stored) => {
        if (!cancelled && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {
        // Unreadable store: keep following the system.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(PREFERENCE_KEY, next).catch(() => {
      // Not persisted: the choice still applies for this session.
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[resolveScheme(preference, os)],
      preference,
      systemScheme: resolveScheme('system', os),
      setPreference,
    }),
    [preference, os, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Current theme. Inside `AppThemeProvider` it honours the user's choice; outside (isolated
 * component tests) it follows the OS appearance.
 */
export function useTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  const os = useColorScheme();
  return ctx ? ctx.theme : THEMES[resolveScheme('system', os)];
}

/** Read and change the theme preference (Settings → Aspetto). */
export function useThemePreference(): Omit<ThemeContextValue, 'theme'> {
  const ctx = useContext(ThemeContext);
  const os = useColorScheme();
  if (ctx) {
    const { preference, systemScheme, setPreference } = ctx;
    return { preference, systemScheme, setPreference };
  }
  return {
    preference: 'system',
    systemScheme: resolveScheme('system', os),
    setPreference: () => undefined,
  };
}
