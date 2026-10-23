'use client';

import React from 'react';
import {
  THEME_STORAGE_KEY,
  isExplicitTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './bootstrap';

export interface ThemeContextValue {
  /** What the user chose: an explicit theme, or "system". */
  preference: ThemePreference;
  /** What is painted right now. */
  resolved: ResolvedTheme;
  /** The OS preference, for labels such as "Sistema (ora scuro)". */
  system: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const CHANGE_EVENT = 'om-theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Fallback when localStorage throws: the choice still applies for this page view. */
let memoryPreference: ThemePreference = 'system';

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isExplicitTheme(stored) ? stored : 'system';
  } catch {
    return memoryPreference;
  }
}

function writePreference(next: ThemePreference) {
  memoryPreference = next;
  try {
    if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}

function applyToDocument(next: ThemePreference) {
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute('content', next === 'system' ? 'light dark' : next);
}

function subscribePreference(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    // Another tab changed the choice: follow it.
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyToDocument(readPreference());
    onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  // Reconcile once after hydration: the choice may have changed (in another tab) between the
  // pre-paint script and this subscription, when no storage event could reach us.
  applyToDocument(readPreference());
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const readSystem = (): ResolvedTheme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');

/**
 * Exposes the theme preference. The pre-paint script in the root layout has already applied
 * any stored choice; this provider only keeps React in sync and handles changes (including
 * other tabs and OS switches). Mount once, near the root.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = React.useSyncExternalStore<ThemePreference>(
    subscribePreference,
    readPreference,
    () => 'system'
  );
  const system = React.useSyncExternalStore<ResolvedTheme>(
    subscribeSystem,
    readSystem,
    () => 'light'
  );

  const setPreference = React.useCallback((next: ThemePreference) => {
    const commit = () => {
      writePreference(next);
      applyToDocument(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    };
    // A calm cross-fade between themes where supported, never under reduced motion.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && typeof document.startViewTransition === 'function') {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      preference,
      system,
      resolved: preference === 'system' ? system : preference,
      setPreference,
    }),
    [preference, system, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Read and change the theme. Must be used inside <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
