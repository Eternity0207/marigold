// Offline shell for Marigold. Model weights are stored separately by
// transformers.js (OPFS), so this worker only keeps the app and its runtime
// available. The build fills these in (see vite.config.js): the hashed JS,
// CSS and fonts, which the very first page load fetches before this worker is
// in control, so they have to be precached here or the second visit can't
// start offline.
const VERSION = 'dev';
const ASSETS = [];
const CACHE = `marigold-shell-${VERSION}`;
const SCOPE = self.registration.scope;
const SHELL = ['', 'index.html', 'icon.svg', 'manifest.webmanifest', 'ort/ort-wasm-simd-threaded.asyncify.mjs', 'ort/ort-wasm-simd-threaded.asyncify.wasm', ...ASSETS];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((p) => new URL(p, SCOPE).href))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('marigold-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: network first so updates show up, cached copy when offline.
  if (req.mode === 'navigate') {
    const page = new URL('index.html', SCOPE).href;
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(page, copy)); } return res; })
        .catch(() => caches.match(page, { ignoreVary: true })),
    );
    return;
  }

  // Hashed assets and runtimes: cache first, fill the cache as we go.
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
