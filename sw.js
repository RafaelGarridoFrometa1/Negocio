// Mi Negocio - Service Worker v8
//
// CAMBIO IMPORTANTE respecto a la version anterior:
// La v7 era "cache-first" para TODO. Una vez guardado el index.html, el navegador
// no volvia a pedirlo nunca, asi que las actualizaciones subidas a GitHub no
// llegaban aunque el archivo estuviera bien publicado.
//
// Ahora:
//   - El HTML va SIEMPRE a la red primero. Si hay internet, se ve la ultima version.
//     El cache solo se usa como respaldo cuando no hay conexion.
//   - El resto (manifest, iconos) sigue en cache, que es lo correcto.
// Con esto ya no hace falta subir el numero de version a mano cada vez.

const CACHE = 'negocio-v9';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Una peticion es de HTML si es navegacion o si acepta text/html
function esHtml(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // Nunca tocar lo que va a Apps Script: eso siempre directo a la red
  if (url.hostname.indexOf('google.com') !== -1 ||
      url.hostname.indexOf('googleusercontent.com') !== -1) return;

  if (esHtml(e.request)) {
    // RED PRIMERO: asi las actualizaciones se ven en cuanto se publican
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // El resto: cache primero, y si no esta, a la red
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});

// Permite que la app fuerce la actualizacion desde el boton de Configuracion
self.addEventListener('message', e => {
  if (e.data === 'actualizar') self.skipWaiting();
});
