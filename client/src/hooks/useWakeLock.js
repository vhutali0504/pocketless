import { useEffect } from 'react';

/**
 * Keeps the screen awake while `active` (the till view). The browser drops the lock whenever the
 * page is hidden, so it is requested again when the page becomes visible. Unsupported browsers and
 * refused requests (low battery, no user gesture) are ignored: the card still shows.
 * @param {boolean} active
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const wakeLock = typeof navigator === 'undefined' ? undefined : navigator.wakeLock;
    if (!wakeLock || typeof wakeLock.request !== 'function') return undefined;

    let sentinel = null;
    let pending = false;
    let cancelled = false;

    const release = (s) => {
      Promise.resolve()
        .then(() => s.release())
        .catch(() => {});
    };

    const acquire = async () => {
      if (pending || (sentinel && !sentinel.released)) return;
      pending = true;
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) release(next);
        else sentinel = next;
      } catch {
        // Not allowed right now; nothing to do.
      } finally {
        pending = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel && !sentinel.released) release(sentinel);
      sentinel = null;
    };
  }, [active]);
}
