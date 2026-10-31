/* UpDate — service worker : rend l'application installable et utilisable hors ligne.
   Augmentez VERSION à chaque mise à jour de index.html pour forcer le rafraîchissement. */
const VERSION = "update-v6";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "fiches.json",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les nouvelles fiches), cache en secours hors ligne.
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") return cache.match("index.html");
    throw err;
  }
}

// Cache d'abord, mise à jour en arrière-plan (images, icônes, polices, bibliothèque).
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Comptes et synchronisation : toujours en direct, jamais en cache.
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) return;

  if (url.origin === self.location.origin) {
    // L'audio passe directement par le réseau (lecture progressive, fichiers lourds).
    if (url.pathname.endsWith(".mp3")) return;
    if (req.mode === "navigate" || url.pathname.endsWith("/fiches.json") ||
        url.pathname.endsWith("/index.html") || url.pathname.endsWith("/config.js")) {
      e.respondWith(networkFirst(req));
      return;
    }
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Polices Google et bibliothèque Supabase : mises en cache pour le hors ligne.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(staleWhileRevalidate(req));
  }
});
