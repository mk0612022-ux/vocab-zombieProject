// ===================================================================
// Service worker: the game plays offline, one whole version at a time
// (new series, round 1, C)
// -------------------------------------------------------------------
// Every version of the game is kept in a cache of its own, "vz-files-<build>",
// with exactly the files its version.json lists. One of them is the current
// one (named in the "vz-meta" cache) and everything the page asks for is
// served from it -- so a device runs one version, never a mix of two.
//
// The page does the updating (js/updater.js): it fills the next version's
// cache with a progress bar, then asks this worker to switch to it ("use"),
// which deletes the older caches; then the page reloads. A file not in the
// current version (or nothing installed yet) comes from the network. A
// request made with cache: "no-store" (the update check, the downloads)
// always goes to the network.
// ===================================================================
const META = "vz-meta";
const PREFIX = "vz-files-";
// the one file from elsewhere: three.js, a fixed version, kept with each version
const CDN = "https://cdnjs.cloudflare.com/";
let current = null;

async function currentName() {
  if (current) return current;
  try {
    const r = await (await caches.open(META)).match("current");
    current = r ? await r.text() : null;
  } catch (err) { current = null; }
  return current;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // the worker before round 1 kept "vocab-zombie-v1": not a whole version
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("vocab-zombie-")).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const sameOrigin = (url) => new URL(url).origin === self.location.origin;
// the game's own page, whatever ?query it was opened with (the app starts at ./?source=app)
const isHome = (url) => {
  const p = new URL(url).pathname, s = new URL(self.registration.scope).pathname;
  return p === s || p === s + "index.html";
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.cache === "no-store") return;
  if (!sameOrigin(req.url) && !req.url.startsWith(CDN)) return;
  const home = req.mode === "navigate" && isHome(req.url);
  e.respondWith((async () => {
    const name = await currentName();
    if (name) {
      const c = await caches.open(name);
      const hit = home ? await c.match("index.html", { ignoreSearch: true }) : await c.match(req, { ignoreSearch: sameOrigin(req.url) });
      if (hit) return hit;
    }
    try {
      return await fetch(req);
    } catch (err) {
      // offline: the game's page is better than an error
      if (req.mode === "navigate" && name) { const g = await (await caches.open(name)).match("index.html"); if (g) return g; }
      throw err;
    }
  })());
});

self.addEventListener("message", (e) => {
  const m = e.data || {};
  const reply = (v) => { if (e.ports && e.ports[0]) e.ports[0].postMessage(v); };
  if (m.type === "state") e.waitUntil(state().then(reply, () => reply({ current: null, manifest: null })));
  else if (m.type === "use") e.waitUntil(use(m.name).then(() => reply({ ok: true }), (err) => reply({ ok: false, error: String(err) })));
});

// what is installed: the current cache and its version.json
async function state() {
  const name = await currentName();
  let manifest = null;
  if (name) {
    const r = await (await caches.open(name)).match("version.json");
    if (r) manifest = await r.json();
  }
  return { current: name, manifest };
}

// switch to a version the page has finished downloading; drop the others
async function use(name) {
  if (!name || !name.startsWith(PREFIX)) throw new Error("bad cache name");
  const c = await caches.open(name);
  if (!(await c.match("version.json"))) throw new Error("incomplete version");
  await (await caches.open(META)).put("current", new Response(name));
  current = name;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== name).map((k) => caches.delete(k)));
}
