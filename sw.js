// Offline-first service worker. Bump VERSION when files change.
const VERSION = 'ct-v2';
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

// Network-first everywhere (so fixes land on the next launch), cache fallback when offline.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(fetch(request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(request.mode === 'navigate' ? 'index.html' : request, copy)); }
    return r;
  }).catch(() => caches.match(request.mode === 'navigate' ? 'index.html' : request, { ignoreSearch: true })));
});
