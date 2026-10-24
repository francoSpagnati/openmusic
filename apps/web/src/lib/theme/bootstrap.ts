/**
 * Theme preference storage and the pre-paint bootstrap (ADR-015).
 *
 * Data model (three states):
 *   - "system": nothing stored, no `data-theme` on <html>; CSS follows prefers-color-scheme.
 *   - "light" / "dark": stored literally in localStorage and mirrored on <html data-theme>.
 *
 * The CSS never depends on JS: with JS off, the site simply follows the OS.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'om-theme';

export const isExplicitTheme = (value: unknown): value is ResolvedTheme =>
  value === 'light' || value === 'dark';

/**
 * Inline, render-blocking script placed in <head>: applies a stored choice before the first
 * paint so there is no flash of the wrong theme. Kept tiny and dependency-free on purpose;
 * storage access can throw (blocked site data), in which case the OS preference wins.
 *
 * It deliberately leaves `<meta name="color-scheme">` alone: React owns that tag, and changing it
 * before hydration makes React insert a second copy. The CSS `color-scheme` set on
 * `:root[data-theme]` (tailwind.config.ts) already wins over the meta for form controls and
 * scrollbars, and the stylesheet is render-blocking, so the first paint is already right.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
