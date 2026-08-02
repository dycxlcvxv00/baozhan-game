/* 爆战丨无限弹幕 · Service Worker（network-first，避免 PWA/浏览器长期卡旧版本） */
var CACHE_VERSION = 'baozhan-runtime-v2.0.3';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).catch(function () {
      return caches.match(e.request);
    })
  );
});
