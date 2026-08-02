/* 爆战丨无限弹幕 · Service Worker（仅满足 PWA 安装性要求，不做离线缓存） */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
