// Service worker kikapcsolva (GitHub Pages útvonal-konfliktusok miatt)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
