// Service worker de Trueque — patrón estándar del ecosistema.
// Subir N en CACHE cada vez que cambian los assets cacheados.
const CACHE = 'trueque-v1'
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Sólo gestionamos same-origin; APIs (geo/proxy/goat) van directo a la red.
  if (url.origin !== location.origin) return

  // Navegación (HTML): network-first con fallback a caché.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    )
    return
  }

  // Resto: cache-first con refresco en segundo plano.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
        return res
      }).catch(() => cached)
      return cached || net
    })
  )
})
