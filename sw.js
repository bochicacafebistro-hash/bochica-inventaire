/**
 * Bochica Inventaire — Service Worker (PWA)
 *
 * Stratégie de cache :
 * - App shell : cache-first (HTML, CSS, JS, fonts) → app fonctionne hors ligne
 * - Firebase / API : network-only → données toujours fraîches, pas de cache stale
 *
 * Pour invalider le cache après un déploiement : incrémenter CACHE_VERSION.
 */

const CACHE_VERSION = 'v2.1.0';
const CACHE_NAME = `bochica-inventaire-${CACHE_VERSION}`;

// Ressources de l'app shell (cachées dès l'installation)
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/state.js',
  '/js/icons.js',
  '/js/i18n.js',
  '/js/utils.js',
  '/js/inventaire.js',
  '/js/modals-produits.js',
  '/js/pages-secondaires.js',
  '/js/pages-admin.js',
  '/js/sidebar.js',
  '/js/auth.js',
  '/js/firebase-listeners.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Domaines à NE JAMAIS cacher (toujours réseau)
const NEVER_CACHE = [
  'firestore.googleapis.com',
  'firebase',
  'googleapis.com',
  'gstatic.com'
];

// ── INSTALL : précache de l'app shell ──────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('SW: certains fichiers n\'ont pas pu être précachés', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE : nettoyer les vieux caches ───────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('bochica-inventaire-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH : stratégie cache-first pour app shell, network-only pour Firebase
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ne JAMAIS cacher Firebase / Google APIs (données toujours fraîches)
  if (NEVER_CACHE.some((domain) => url.hostname.includes(domain))) {
    return; // Laisse passer au réseau, pas de cache
  }

  // Stratégie : Cache-first, fallback réseau, mise à jour en arrière-plan
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Mettre à jour le cache pour les futures requêtes (stale-while-revalidate)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse); // Si réseau KO, sert le cache

      return cachedResponse || fetchPromise;
    })
  );
});

// ── MESSAGE : permettre à l'app de forcer la mise à jour du SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
