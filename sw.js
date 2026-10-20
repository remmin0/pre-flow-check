/*
 * Pre-Flow Check — service worker.
 * App files: network-first (always fresh when online), with the cache as the offline fallback.
 * The install step bypasses the browser's HTTP cache so a new version never stores stale files.
 * Google Fonts: stale-while-revalidate, so fonts work offline after the first online visit.
 * Bump VERSION on every release.
 */
const VERSION = 'pfc-v3';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/config.js',
  './js/strings.js',
  './js/scoring.js',
  './js/storage.js',
  './js/sketch.js',
  './js/art.js',
  './js/pvt.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const FONT_CACHE = 'pfc-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) => cache.match(req).then((hit) => {
        const fresh = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || fresh;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Network first; fall back to the cache when offline. Navigations fall back to the shell.
  event.respondWith(
    // Revalidate with the server (cheap 304s) instead of trusting the browser's HTTP cache.
    // A navigation request can't be re-created with options, so it is fetched by URL.
    (req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' })).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
