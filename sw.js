/* Service worker: приложение работает офлайн, база подтягивается из сети, когда она есть */
var VERSION = 'v1';
var SHELL = 'shell-' + VERSION;
var RUNTIME = 'runtime-' + VERSION;
var ASSETS = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'assets/label-bg.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/maskable-512.png', 'assets/templates/presets.js',
  'assets/templates/minimal.png', 'assets/templates/kraft.png', 'assets/templates/espresso.png',
  'assets/templates/round.png', 'assets/templates/tag.png', 'assets/templates/pop.png', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon-64.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== RUNTIME; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname === 'api.github.com') return;                // синхронизация — всегда напрямую
  var sameOrigin = url.origin === self.location.origin;
  // база и код: сначала сеть (свежая версия), без сети — кэш
  if (sameOrigin) {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); var key = url.pathname.indexOf('/data/') >= 0 ? new Request(url.origin + url.pathname) : req;
        caches.open(url.pathname.indexOf('/data/') >= 0 ? RUNTIME : SHELL).then(function (c) { c.put(key, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    }));
    return;
  }
  // шрифты и CDN: кэш, потом сеть
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(req, copy); }); return res; });
      return hit || net;
    }));
  }
});
