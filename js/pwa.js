// ===================================================================
// Installable, offline, and never stuck on an old version (A4)
// -------------------------------------------------------------------
// Registers the service worker (sw.js) on the real site. On the local dev
// server it does the opposite -- removes any worker -- so what is being
// worked on is never served out of a cache (?sw=1 turns it on there, to
// test it).
// When the worker finds that the site has changed (or a new worker is
// waiting), the window "New version available - Reload" opens: straight
// away in the lobby, or as soon as the player is back there -- it never
// interrupts a run.
// ===================================================================
G.PWA = {
  CHECK_EVERY: 30 * 60 * 1000,   // coming back to the app after this long: look again

  init() {
    this.bindDialog();
    if (!("serviceWorker" in navigator)) return;
    const local = location.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname);
    if (local && !/[?&]sw=1\b/.test(location.search)) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("sw.js").then((reg) => {
      this.reg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) this.offer();
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) this.offer(); });
      });
      navigator.serviceWorker.ready.then((r) => {
        // keep everything this visit loaded -- and the pictures and icons,
        // which may still be on their way -- then look for changes; the list
        // goes again a little later for whatever finished loading since
        const send = () => { if (r.active) r.active.postMessage({ type: "cacheUrls", urls: this.urls() }); };
        send();
        if (r.active) r.active.postMessage({ type: "checkUpdates" });
        setTimeout(send, 6000);
        this._checkedAt = Date.now();
      });
    }).catch(() => { /* no worker: the game still runs online */ });
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "updated") this.offer(); });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (this._reloading) location.reload(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !this.reg || Date.now() - (this._checkedAt || 0) < this.CHECK_EVERY) return;
      this._checkedAt = Date.now();
      this.reg.update().catch(() => {});
      const c = navigator.serviceWorker.controller;
      if (c) c.postMessage({ type: "checkUpdates" });
    });
  },

  // every file the game needs to start offline
  urls() {
    const abs = (p) => new URL(p, location.href).href;
    const list = performance.getEntriesByType("resource").map((e) => e.name).concat([location.href]);
    ["manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].forEach((p) => list.push(abs(p)));
    if (G.Lobby) G.Lobby.MODES.forEach((m) => { list.push(abs(G.Lobby.art(m, false))); list.push(abs(G.Lobby.art(m, true))); });
    return list;
  },

  // an update is ready: show it now if the player is in the lobby, else later
  offer() {
    this.pending = true;
    this.maybeShow();
  },
  maybeShow() {
    if (!this.pending || G.Modal.isOpen("update")) return;
    const g = G.Game;
    if (!g || g.state !== "MENU" || G.UI._currentScreen !== "screen-mainmenu") return;
    this.pending = false;
    const box = document.getElementById("update-dialog");
    box.classList.remove("hidden");
    G.Modal.open("update", { keys: (e) => {
      if (e.code === "Enter" || e.code === "Space") { this.reload(); return true; }
      if (e.code === "Escape") { this.later(); return true; }
      return false;
    } });
    G.Audio.sfx("update");
    const b = document.getElementById("btn-update-reload");
    if (b) b.focus({ preventScroll: true });
  },
  reload() {
    this._reloading = true;
    const w = this.reg && this.reg.waiting;
    if (w) { w.postMessage({ type: "skipWaiting" }); setTimeout(() => location.reload(), 3000); }
    else location.reload();
  },
  later() {
    document.getElementById("update-dialog").classList.add("hidden");
    G.Modal.close("update");
  },
  bindDialog() {
    const r = document.getElementById("btn-update-reload"), l = document.getElementById("btn-update-later");
    if (r) r.onclick = () => this.reload();
    if (l) l.onclick = () => this.later();
  },
};
