/* Service Worker – TGS Abschlussrechner PWA
 * Strategie: App-Shell + Bibliotheken beim Install vorab cachen (precache),
 * danach Cache-first mit Netz-Fallback. Schülerdaten werden NIE gecached
 * (sie entstehen nur lokal im Speicher und gehen nie über das Netz).
 *
 * VORLAGE: Der Platzhalter unten wird beim Bauen durch einen Namen mit Inhalts-Hash ersetzt
 * (build-all.py). Der Name ändert sich damit GENAU DANN, wenn sich die ausgelieferten
 * Dateien ändern – ein Leerbau erzeugt keine Fehlmeldung „Neue Version verfügbar".
 * Diese Datei selbst wird beim Bauen nie überschrieben.
 */
const CACHE = 'tgs-abschlussrechner-150e44919c13';

// Alles relativ ZUM PWA-ORDNER: er enthält seine Bibliotheken selbst (der Build kopiert
// vendor/ und favicon.png hinein) und lässt sich deshalb allein auf einen Server legen.
// ApexCharts fehlt bewusst – die Diagramme sind ein reines Test-Feature von TEST.html.
const PRECACHE = [
  './',
  './index.html',
  './app.tw.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './vendor/xlsx.full.min.js',
  './vendor/inter/inter-latin-wght-normal.woff2',
  './vendor/archivo/archivo-latin-wght-normal.woff2',
  './favicon.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // einzeln hinzufügen, damit ein fehlendes optionales Asset den Install nicht abbricht.
      // cache: 'reload' = am HTTP-Cache des Browsers VORBEI frisch vom Server holen. Sonst
      // übernimmt ein neuer Service Worker veraltete Dateien (GitHub Pages: max-age=600) –
      // so blieben in v2.4.3 leere Symbole hängen und die App war nicht installierbar.
      // Leere Antworten werden nicht gespeichert.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) =>
        fetch(new Request(url, { cache: 'reload' })).then((res) => {
          if (!res.ok) throw new Error(url + ' ' + res.status);
          return res.clone().arrayBuffer().then((buf) => {
            if (buf.byteLength === 0) throw new Error(url + ' ist leer');
            return cache.put(url, res);
          });
        }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // nur GETs cachen

  // Navigationen: erst Cache (App-Shell), sonst Netz, sonst index.html als Offline-Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Übrige same-origin GETs: Cache-first, bei Netz-Erfolg in den Cache nachlegen
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
