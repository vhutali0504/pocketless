// Keeps an installed Pocketless up to date without interrupting anyone.
// - Registers the service worker ourselves (instead of the plugin's injected script).
// - Checks for a new version every time the app is opened or brought back to the front.
// - When a new version has taken over, reloads into it only at a calm moment:
//   on the wallet screen with no card pulled out (never at the till, never mid-add).

/** True when reloading would not interrupt the user. */
export function isCalmMoment(loc = window.location, root = document.documentElement) {
  const path = loc.pathname.replace(/\/+$/, '');
  return path === '/app' && !root.classList.contains('is-card-out');
}

/**
 * @param {{ sw?: ServiceWorkerContainer, doc?: Document, reload?: () => void, calm?: () => boolean }} [deps]
 */
export function setupUpdates({
  sw = globalThis.navigator?.serviceWorker,
  doc = document,
  reload = () => window.location.reload(),
  calm = () => isCalmMoment(),
} = {}) {
  if (!sw) return null;

  // On the very first install there is no old version on screen, so no reload is needed.
  const hadController = Boolean(sw.controller);
  let pending = false;

  const tryReload = () => {
    if (pending && calm()) {
      pending = false;
      reload();
    }
  };

  sw.addEventListener('controllerchange', () => {
    if (!hadController) return;
    pending = true;
    tryReload();
  });

  let registration = null;
  sw.register('/sw.js', { scope: '/' })
    .then((reg) => {
      registration = reg;
    })
    .catch(() => {
      // Offline or blocked: the app still works from the current version.
    });

  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return;
    registration?.update().catch(() => {});
    tryReload();
  });

  return { tryReload };
}
