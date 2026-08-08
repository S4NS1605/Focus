/**
 * Registers the service worker that makes the app installable and able to open
 * without a connection.
 *
 * Deliberately silent about failure. A worker that will not register is a
 * degraded install, not a broken app — every screen still works over the
 * network — so it must never surface an error to someone who only wanted to
 * check a balance.
 */
export const registrarServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;
  // Dev is served from source with no build output to cache, and a worker there
  // would serve stale modules straight through HMR.
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
};
