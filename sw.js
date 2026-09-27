// ===================================================================
// Service worker (A4): the game plays offline once it has been opened
// -------------------------------------------------------------------
// Every file the game uses is kept in a cache and served from it first,
// so a phone or an iPad without a connection still starts the game.
// Staying up to date without a build step: each time the game starts, the
// page asks this worker to check every cached file against the site (a
// cheap conditional request each). Anything that changed is stored, and the
// page is told -- it offers "New version available - Reload", so an iPad
// is never left on an old version. CACHE_VERSION is for changes to this
// worker itself; bumping it makes the old cache be thrown away whole.
// ===================================================================
const CACHE_VERSION = "1";
const CACHE = "vocab-zombie-v" + CACHE_VERSION;
const CORE = ["./", "./index.html", "./manifest.json", "./css/style.css",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
// the one file from elsewhere: three.js, a fixed version, never changes
const CDN = "https://cdnjs.cloudflare.com/";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  // no skipWaiting here: a new worker waits until the player says Reload
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vocab-zombie-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const sameOrigin = (url) => url.startsWith(self.registration.scope) || new URL(url).origin === self.location.origin;
const cacheable = (url) => sameOrigin(url) || url.startsWith(CDN);
// the game's own page, whatever ?query it was opened with (the app starts at
// ./?source=app) -- and only that page is kept as "./"
const isHome = (url) => {
  const p = new URL(url).pathname, s = new URL(self.registration.scope).pathname;
  return p === s || p === s + "index.html";
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !cacheable(req.url)) return;
  const home = req.mode === "navigate" && isHome(req.url);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = home ? await cache.match("./") : await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(home ? "./" : req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      // offline and never seen: the game's page is better than an error
      if (req.mode === "navigate") { const g = await cache.match("./"); if (g) return g; }
      throw err;
    }
  })());
});

self.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.type === "skipWaiting") self.skipWaiting();
  else if (m.type === "cacheUrls") e.waitUntil(cacheUrls(m.urls || []));
  else if (m.type === "checkUpdates") e.waitUntil(checkUpdates());
});

// the first visit: the page was loaded before this worker was in charge, so
// it sends the list of everything it loaded, to be kept
async function cacheUrls(urls) {
  const cache = await caches.open(CACHE);
  const list = [...new Set(urls.filter((u) => typeof u === "string" && cacheable(u)).map((u) => u.split("#")[0]))];
  await pool(list, 6, async (u) => {
    const key = isHome(u) ? "./" : u;
    if (await cache.match(key)) return;
    try {
      const res = await fetch(u, { mode: u.startsWith(CDN) ? "cors" : "same-origin" });
      if (res.ok) await cache.put(key, res);
    } catch (err) { /* offline: next time */ }
  });
}

// every cached file of the site, asked again; the changed ones stored and
// the page told
async function checkUpdates() {
  const cache = await caches.open(CACHE);
  const reqs = (await cache.keys()).filter((r) => sameOrigin(r.url));
  let changed = 0;
  await pool(reqs, 6, async (req) => {
    try {
      const old = await cache.match(req);
      const res = await fetch(req.url, { cache: "no-cache" });
      if (!res.ok) return;
      if (await differs(old, res.clone())) { await cache.put(req, res); changed++; }
    } catch (err) { /* offline */ }
  });
  if (changed) {
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) => c.postMessage({ type: "updated", files: changed }));
  }
}
async function differs(a, b) {
  if (!a) return true;
  const ea = a.headers.get("etag"), eb = b.headers.get("etag");
  if (ea && eb) return ea.replace(/^W\//, "") !== eb.replace(/^W\//, "");
  const la = a.headers.get("last-modified"), lb = b.headers.get("last-modified");
  if (la && lb) return la !== lb;
  const [x, y] = await Promise.all([a.clone().arrayBuffer(), b.arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return true;
  const p = new Uint8Array(x), q = new Uint8Array(y);
  for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return true;
  return false;
}
// at most n requests at a time, gentle on a phone's connection
async function pool(items, n, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) { const k = i++; await fn(items[k]); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}
