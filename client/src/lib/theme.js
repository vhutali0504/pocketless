// The user's light/dark choice. With no choice stored, the app follows the phone.
// Stored in localStorage: it's a per-phone preference, and losing it just means
// following the phone again.

export const THEME_KEY = 'pocketless-theme';
const THEME_COLOUR = { light: '#43144F', dark: '#1A1320' };

/** @returns {'light'|'dark'|null} */
export function readStoredTheme() {
  try {
    const value = globalThis.localStorage?.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** @param {'light'|'dark'} theme */
export function storeTheme(theme) {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice still applies until the app is closed.
  }
}

/** @returns {'light'|'dark'} */
export function phoneTheme() {
  return typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Puts the theme on <html> and matches the browser bar colour. @param {'light'|'dark'|null} theme */
export function applyTheme(theme, doc = document) {
  const root = doc.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  const colour = THEME_COLOUR[theme ?? phoneTheme()];
  doc.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', colour));
}
