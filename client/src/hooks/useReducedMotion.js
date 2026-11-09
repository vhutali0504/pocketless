import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function query() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

/** @returns {boolean} true when the user asked the system to reduce motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Boolean(query()?.matches));

  useEffect(() => {
    const mql = query();
    if (!mql) return undefined;
    const onChange = () => setReduced(Boolean(mql.matches));
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}
