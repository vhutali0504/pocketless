import { useCallback, useEffect, useState } from 'react';
import { applyTheme, phoneTheme, readStoredTheme, storeTheme } from '../lib/theme.js';

/**
 * The theme on screen right now, and a toggle that switches it and remembers the choice.
 * @returns {{ theme: 'light'|'dark', toggle: () => void }}
 */
export default function useTheme() {
  const [stored, setStored] = useState(readStoredTheme);
  const [phone, setPhone] = useState(phoneTheme);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== 'function') return undefined;
    const query = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setPhone(query.matches ? 'dark' : 'light');
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    applyTheme(stored);
  }, [stored, phone]);

  const theme = stored ?? phone;
  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    setStored(next);
  }, [theme]);

  return { theme, toggle };
}
