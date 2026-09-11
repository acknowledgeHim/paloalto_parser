// Minimal service worker: exists mainly so the browser considers this an installable PWA
// ("Add to Home Screen" on a phone gets the intercom/music controls onto a family member's
// phone without an app store). We deliberately do NOT cache API responses or the app shell —
// this dashboard's whole point is showing live state (chores, calendar, now-playing), and a
// stale cached response would be actively misleading. Network-only passthrough.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Intentionally not calling event.respondWith() — let the browser handle every request normally.
});
