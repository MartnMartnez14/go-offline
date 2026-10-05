/**
 * Service worker de Go Offline: app shell en cache, funcionamiento offline.
 * Sin dependencias; rutas siempre relativas para funcionar bajo subcarpetas.
 */

const CACHE_PREFIX = 'go-offline-';
const CACHE_VERSION = 'go-offline-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/core/board.js',
  './src/core/groups.js',
  './src/core/rules.js',
  './src/core/game.js',
  './src/core/scoring.js',
  './src/core/coords.js',
  './src/ui/boardView.js',
  './src/ui/historyPanel.js',
  './src/ui/dialogs.js',
  './src/ui/screens/game.js',
  './src/storage/store.js',
  './src/audio/sound.js',
  './src/styles/tokens.css',
  './src/styles/main.css',
  './src/styles/board.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/icon.svg',
  './assets/sounds/stone.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Solo se borran las cachés propias: el origen puede estar compartido
        // (p. ej. usuario.github.io) y otros proyectos usan sus propias claves.
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}
