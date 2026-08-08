/* 会話 (Kaiwa) service worker — offline shell + always-fresh page.
   Only touches same-origin GET requests. Never intercepts the AI APIs or Firebase
   (those are cross-origin and/or POST), so online functionality is identical to the browser. */
const CACHE = "kaiwa-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // leave POSTs (Gemini / OpenRouter / Firebase) alone
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // ignore cross-origin (gstatic, googleapis, openrouter)

  if (req.mode === "navigate") {
    // Network-first for the page so new deploys appear immediately; fall back to cache offline.
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", cp)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Cache-first for same-origin assets (icons, manifest).
  e.respondWith(
    caches.match(req).then(c => c || fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(cc => cc.put(req, cp)); return r; }))
  );
});
