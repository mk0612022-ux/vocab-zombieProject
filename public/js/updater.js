// ===================================================================
// Updates: every device runs the version on the site (new series, round 1, C)
// -------------------------------------------------------------------
// The site has a version.json (tools/make-version.*, written at each deploy):
// the version, its build time, the commit, what changed, and every file with
// its size and hash. The device keeps one whole version in the service
// worker's cache (sw.js) and plays from it, online or not.
//
//   opening     the Loading screen (js/boot.js) checks the site's version.json
//               (never from a cache). The same build as installed: on to the
//               Start screen (js/start.js), then the lobby. A
//               different one: "Update Available" -- this version -> that
//               one, what changed, about how much to download -- and Update.
//               It has to be done before playing, so every device matches.
//   updating    the new version's files go into a cache of their own (files
//               whose hash did not change are copied from the old one), with
//               a progress bar; then the worker switches to it, drops the old
//               cache, and the game restarts ("Update complete - restarting").
//               The save is in localStorage, untouched; the new version's
//               save migration runs as it loads (G.normalizeSave).
//   failing     a download that breaks off: Retry, or Play this version (a
//               small "old version" badge stays up; it tries again next time).
//   offline     no check; the installed version plays, with an "Offline"
//               badge. Back online (or a minute later): checked again.
//   in the lobby  checked again every few minutes (G.CONFIG.update); a new
//               version is offered there -- never in the middle of a level.
// The first visit installs quietly in the background: the page is already the
// site's version. On this computer's dev server there is no worker (what is
// being worked on is never served from a cache) unless the page has ?sw=1.
// The boot screen is a G.Modal window: mouse, touch, keys, a controller.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => (G.T ? G.T(k, v) : k);
  const $ = (id) => document.getElementById(id);
  const C = () => (G.CONFIG && G.CONFIG.update) || { checkMinutes: 5, timeout: 8000, minBootMs: 1000, bootWaitMs: 8000, restartDelay: 1200, offlineRetrySeconds: 60, parallel: 4 };
  const PREFIX = "vz-files-";
  const abs = (p) => new URL(p, location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "")).href;
  const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

  G.Updater = {
    mode: "web",            // web | dev (no worker: this computer) | nosw (a browser without one) | file (opened from disk)
    installed: null,        // the manifest this device runs
    server: null,           // the site's manifest, last seen
    pending: null,          // a newer manifest, not installed yet
    offline: false,
    mismatch: false,        // the player chose to play an old version
    busy: false,
    stage: "checking",      // checking | ready | update | downloading | failed | done
    // (new series, round 2: from when the Loading screen went up, js/boot.js)
    _t0: (G.Boot && G.Boot.t0) || Date.now(),

    // ---------------- the version, for the corner of the screen and Settings ----------------
    label() {
      const m = this.installed || this.server;
      if (!m) return T("version.unknown");
      return "v" + m.version + (this.mode === "dev" ? " (dev)" : "");
    },
    showLabel() {
      const text = this.label();
      document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = text; });
    },

    // ---------------- start-up ----------------
    start() {
      G.Modal && G.Modal.open("boot", { keys: (e) => this.key(e) });
      // (the Loading screen shows the real progress itself)
      if (!G.Boot) this.setStatus(T("boot.checking"), null);
      this.check(true).catch(() => {}).then(() => {
        if (this.stage === "checking") this.stage = "ready";
        if (G.Boot) G.Boot.update();
        this.maybeEnter();
      });
      window.addEventListener("online", () => this.check(false).catch(() => {}));
      window.addEventListener("offline", () => { this.offline = true; this.badge(); });
      setInterval(() => this.tick(), 1000);
    },
    // the game has finished setting up (js/game.js)
    gameReady() { this._gameReady = true; this.maybeEnter(); },
    // on to the Start screen (new series, round 2, E; then the lobby) once
    // the check and the game are both done, everything the Loading screen
    // counts has come (js/boot.js -- or it has waited long enough for a
    // picture that does not), and the screen has been up long enough not to
    // flash
    maybeEnter() {
      if (!this._gameReady || this.stage !== "ready" || this._entered) return;
      const since = Date.now() - this._t0;
      if (G.Boot && !G.Boot.loaded() && since < C().bootWaitMs) {
        clearTimeout(this._enterT);
        this._enterT = setTimeout(() => this.maybeEnter(), Math.min(500, C().bootWaitMs - since));
        return;
      }
      const wait = Math.max(0, C().minBootMs - since);
      setTimeout(() => {
        if (this._entered || this.stage !== "ready") return;
        this._entered = true;
        this._enteredAt = Date.now();
        $("loading-overlay").classList.add("hidden");
        G.Modal && G.Modal.close("boot");
        if (G.Boot) G.Boot.finish();
        this.showLabel();
        this.badge();
        if (G.Start) G.Start.show();
      }, wait);
    },

    swAllowed() {
      if (!("serviceWorker" in navigator) || !window.caches) return false;
      const local = location.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname);
      return !local || /[?&]sw=1\b/.test(location.search);
    },

    // What is installed, what the site has, and whether they differ.
    // boot: at start-up (a new version blocks the way in); else from the
    // lobby (a new version is offered)
    async check(boot) {
      if (this.busy) return;
      if (location.protocol === "file:") { this.mode = "file"; this.showLabel(); return; }
      if (!this.swAllowed()) {
        // (this computer's dev server -- or a browser with no service worker,
        // which simply loads the site's files each time)
        this.mode = "serviceWorker" in navigator && window.caches ? "dev" : "nosw";
        if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
        this.installed = this.installed || await this.fetchManifest(false).catch(() => null);
        this.showLabel();
        return;
      }
      this.mode = "web";
      await this.register();
      const st = await this.ask({ type: "state" }).catch(() => null);
      this.installed = st && st.manifest ? st.manifest : null;
      this.installedName = st && st.current;
      let server = null;
      try { server = await this.fetchManifest(true); } catch (err) { server = null; }
      if (!server) {
        this.offline = true;
        this.badge();
        this.showLabel();
        return;
      }
      this.offline = false;
      this.server = server;
      if (!this.installed) {
        // the first visit (or the cache was cleared): this page IS the site's
        // version -- keep it, quietly, for next time and for offline
        this.installed = server;
        this.showLabel();
        this.install(server, null).catch(() => {});
        return;
      }
      this.showLabel();
      if (server.build === this.installed.build) { this.pending = null; this.badge(); return; }
      this.pending = server;
      if (boot) this.showUpdate();
      else this.offer();
    },
    async fetchManifest(fresh) {
      // (the Loading screen asked for it the moment the page opened)
      const early = fresh && G.Boot && G.Boot.takeVersion();
      if (early) return early;
      const ctl = window.AbortController ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), C().timeout) : null;
      try {
        const url = "version.json" + (fresh ? "?check=" + Date.now() : "");
        const res = await fetch(url, { cache: fresh ? "no-store" : "no-cache", signal: ctl ? ctl.signal : undefined });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const m = await res.json();
        if (!m || !m.build || !m.files) throw new Error("not a version file");
        return m;
      } finally { if (timer) clearTimeout(timer); }
    },
    async register() {
      if (this._reg) return this._reg;
      this._reg = await navigator.serviceWorker.register("sw.js");
      return this._reg;
    },
    // a question to the service worker, answered on a channel of its own
    async ask(msg) {
      const reg = await this.register();
      const w = navigator.serviceWorker.controller || reg.active || (await navigator.serviceWorker.ready).active;
      if (!w) throw new Error("no worker");
      return new Promise((resolve, reject) => {
        const ch = new MessageChannel();
        const t = setTimeout(() => reject(new Error("no answer")), 8000);
        ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
        w.postMessage(msg, [ch.port2]);
      });
    },

    // ---------------- the download ----------------
    // What changed since the version this device has: the newest entries of
    // m.changes, down to the commit installed (or its own headline)
    changesSince(m) {
      const inst = this.installed, out = [];
      const head = inst && inst.changes && inst.changes[0] ? (inst.changes[0].s || inst.changes[0]) : null;
      for (const ch of m.changes || []) {
        const c = typeof ch === "string" ? { c: "", s: ch } : ch;
        if (inst && ((c.c && c.c === inst.commit) || (head && c.s === head))) break;
        out.push(c.s);
        if (out.length >= 5) break;
      }
      return out;
    },
    // what an update to `m` would download (bytes), given what is installed
    estimate(m) {
      const old = (this.installed && this.installed.files) || {};
      let bytes = 0;
      Object.keys(m.files).forEach((p) => { if (!old[p] || old[p].hash !== m.files[p].hash) bytes += m.files[p].size; });
      return bytes;
    },
    // Fill the cache of version `m` (copying what has not changed from the
    // installed one), then switch the worker to it. onProgress(0..1)
    async install(m, onProgress) {
      this.busy = true;
      const name = PREFIX + m.build;
      try {
        await caches.delete(name);
        const cache = await caches.open(name);
        const oldFiles = (this.installed && this.installed !== m && this.installed.files) || {};
        const oldCache = this.installedName && this.installedName !== name ? await caches.open(this.installedName) : null;
        const jobs = [];
        let total = 0, done = 0;
        for (const p of Object.keys(m.files)) {
          const f = m.files[p], key = abs(p);
          if (oldCache && oldFiles[p] && oldFiles[p].hash === f.hash) {
            const hit = await oldCache.match(key);
            if (hit) { await cache.put(key, hit); continue; }
          }
          jobs.push({ url: abs(p) + "?v=" + f.hash, key, size: f.size, local: true });
          total += f.size;
        }
        for (const url of m.external || []) {
          const hit = oldCache && await oldCache.match(url);
          if (hit) { await cache.put(url, hit); continue; }
          jobs.push({ url, key: url, size: 600000, local: false });
          total += 600000;
        }
        if (onProgress) onProgress(0);
        let i = 0;
        const run = async () => {
          while (i < jobs.length) {
            const j = jobs[i++];
            const res = await fetch(j.url, { cache: "no-store", mode: j.local ? "same-origin" : "cors" });
            if (!res.ok) throw new Error((res.status || "?") + " " + j.key.split("/").pop());
            const body = await res.blob();
            await cache.put(j.key, new Response(body, { status: 200, headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream" } }));
            done += j.size;
            if (onProgress) onProgress(total ? done / total : 1);
          }
        };
        await Promise.all(Array.from({ length: Math.max(1, Math.min(C().parallel, jobs.length)) }, run));
        // version.json last: a cache without it is not a whole version
        await cache.put(abs("version.json"), new Response(JSON.stringify(m), { headers: { "Content-Type": "application/json" } }));
        const r = await this.ask({ type: "use", name });
        if (!r || !r.ok) throw new Error((r && r.error) || "switch failed");
        this.installed = m; this.installedName = name;
        return true;
      } catch (err) {
        caches.delete(name).catch(() => {});
        throw err;
      } finally { this.busy = false; }
    },

    // ---------------- the screens ----------------
    setStatus(text, frac) {
      const s = $("boot-status"); if (s) s.textContent = text;
      const bar = $("boot-bar"), fill = $("boot-bar-fill");
      if (bar) bar.classList.toggle("indeterminate", frac == null);
      if (fill) fill.style.transform = "scaleX(" + (frac == null ? 1 : Math.max(0, Math.min(1, frac))).toFixed(3) + ")";
      const pc = $("boot-pct"); if (pc) pc.textContent = frac == null ? "" : Math.round(frac * 100) + "%";
    },
    panel(which) {
      ["boot-main", "boot-update", "boot-failed"].forEach((id) => { const el = $(id); if (el) el.classList.toggle("hidden", id !== which); });
    },
    // "Update Available" -- on the boot screen (from the lobby too: it covers
    // the lobby the same way)
    showUpdate() {
      const m = this.pending;
      if (!m) return;
      this.stage = "update";
      $("loading-overlay").classList.remove("hidden");
      G.Modal && G.Modal.open("boot", { keys: (e) => this.key(e) });
      this.panel("boot-update");
      $("upd-from").textContent = this.installed ? "v" + this.installed.version : "–";
      $("upd-to").textContent = "v" + m.version;
      const changes = this.changesSince(m);
      $("upd-changes").innerHTML = changes.length ? changes.map((c) => "<li>" + G.escapeHtml(c) + "</li>").join("") : "<li>" + G.escapeHtml(T("update.noNotes")) + "</li>";
      $("upd-size").textContent = T("update.size", { size: fmtSize(this.estimate(m)) });
      $("upd-progress").classList.add("hidden");
      $("btn-update-go").classList.remove("hidden");
      $("btn-update-go").onclick = () => this.update();
      if (G.Audio && G.Audio.sfx) try { G.Audio.sfx("update"); } catch (e) {}
      setTimeout(() => { const b = $("btn-update-go"); if (b && G.Input && G.Input.mode !== "touch") b.focus({ preventScroll: true }); }, 0);
    },
    async update() {
      const m = this.pending;
      if (!m || this.stage === "downloading") return;
      this.stage = "downloading";
      this.panel("boot-update");
      $("btn-update-go").classList.add("hidden");
      $("upd-progress").classList.remove("hidden");
      const show = (f) => {
        $("upd-fill").style.transform = "scaleX(" + f.toFixed(3) + ")";
        $("upd-pct").textContent = T("update.downloading", { p: Math.round(f * 100) });
      };
      show(0);
      try {
        await this.install(m, show);
        show(1);
        this.stage = "done";
        $("upd-pct").textContent = T("update.done");
        // (anything still waiting to be written goes first)
        if (G.save && G.persist) G.persist();
        setTimeout(() => location.reload(), C().restartDelay);
      } catch (err) {
        this.stage = "failed";
        this.lastError = String(err && err.message || err);
        this.panel("boot-failed");
        $("upd-error").textContent = T("update.failedText");
        $("btn-update-retry").onclick = () => { this.panel("boot-update"); this.update(); };
        $("btn-update-old").onclick = () => this.playOld();
        setTimeout(() => { const b = $("btn-update-retry"); if (b && G.Input && G.Input.mode !== "touch") b.focus({ preventScroll: true }); }, 0);
      }
    },
    // keep playing what is installed: marked as old until the next launch
    playOld() {
      this.mismatch = true;
      this.stage = "ready";
      this.panel("boot-main");
      if (this._entered) {
        $("loading-overlay").classList.add("hidden");
        G.Modal && G.Modal.close("boot");
      }
      this.maybeEnter();
      this.badge();
    },
    // from the lobby: a new version is out (a window, never during a level)
    // (m: what to offer -- the pending version)
    offer(m) {
      m = m || this.pending;
      if (!m || !this._entered) return;
      const g = G.Game;
      if (!g || g.state !== "MENU" || !G.UI || G.UI._currentScreen !== "screen-mainmenu" || (G.Modal && G.Modal.isOpen())) { this._offerLater = true; this._offerM = m; return; }
      this._offerLater = false; this._offerM = null;
      G.Dialog.open({
        icon: "⬆️", title: T("update.title"),
        text: T("update.lobbyText", { from: this.installed ? "v" + this.installed.version : "", to: "v" + m.version }),
        buttons: [
          { label: T("update.btn"), primary: true, action: () => this.showUpdate() },
          { label: T("update.later"), cancel: true },
        ],
      });
    },
    // the small badge in the corner: Offline, or an old version
    badge() {
      const el = $("net-badge");
      if (!el) return;
      const g = G.Game, inRun = g && (g.state === "GAMEPLAY" || g.state === "PAUSE");
      const text = this.offline ? T("net.offline") : this.mismatch || (this.pending && this._entered) ? T("net.old", { v: this.label() }) : "";
      el.textContent = text;
      el.classList.toggle("hidden", !text || inRun);
      el.classList.toggle("warn", !this.offline && !!text);
    },
    tick() {
      this.badge();
      if (this.mode !== "web" || this.busy || !this._entered || this.stage === "downloading") return;
      const g = G.Game, lobby = g && g.state === "MENU" && G.UI && G.UI._currentScreen === "screen-mainmenu";
      if (this._offerLater && lobby && !G.Modal.isOpen()) this.offer(this._offerM);
      const every = this.offline ? C().offlineRetrySeconds * 1000 : C().checkMinutes * 60000;
      if (lobby && Date.now() - (this._lastCheck || this._t0) > every) {
        this._lastCheck = Date.now();
        this.check(false).catch(() => {});
      }
    },
    key(e) {
      if (e.code !== "Enter" && e.code !== "Space" && e.code !== "NumpadEnter") return true;
      if (e.preventDefault) e.preventDefault();
      if (this.stage === "update") this.update();
      else if (this.stage === "failed") { const f = document.activeElement; if (f && f.id === "btn-update-old") this.playOld(); else { this.panel("boot-update"); this.update(); } }
      return true;
    },
    // Settings: look now
    async checkNow() {
      if (this.mode !== "web") { this.showLabel(); return "dev"; }
      await this.check(false).catch(() => {});
      return this.offline ? "offline" : this.pending ? "found" : "current";
    },
  };

  window.addEventListener("DOMContentLoaded", () => G.Updater.start());
  // (round 3) the version in the corner, in the menus' new language
  window.addEventListener("vz-uilang", () => G.Updater.showLabel());
})();
