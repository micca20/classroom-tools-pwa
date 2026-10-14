// Offline-first service worker. Bump VERSION when files change.
const VERSION = 'ct-v1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'fonts/Fredoka.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/store.js', 'js/audio.js', 'js/icons.js', 'js/ui.js', 'js/music.js', 'js/routines.js', 'js/pages.js',
  'js/tools/bell.js', 'js/tools/timer.js', 'js/tools/sticks.js', 'js/tools/groups.js', 'js/tools/tallies.js',
  'js/tools/timeLost.js', 'js/tools/hearts.js', 'js/tools/noise.js', 'js/tools/hallPass.js', 'js/tools/dice.js',
  'js/tools/transitions.js', 'js/tools/music.js', 'js/tools/notes.js', 'js/tools/brain.js', 'js/tools/seating.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network-first for navigations (fresh updates), cache-first for everything else.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  // Stale-while-revalidate: instant from cache, refreshed in the background for next launch.
  e.respondWith(caches.open(VERSION).then((cache) => cache.match(request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(request).then((r) => { if (r.ok) cache.put(request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
