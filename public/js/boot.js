// ===================================================================
// The Loading screen (new series, round 2, D)
// -------------------------------------------------------------------
// What is on it: the school's horde looking out of the screen (a picture
// rendered from the game, public/assets/boot/, two sizes), a word of the bank
// over each head -- new ones every time the game opens -- and along the
// bottom the progress, what is being done (Checking for updates / Loading
// assets / Loading vocabulary) and, by turns, a tip and the Word of the Day.
//
// The progress is the real loading, nothing timed: the game's scripts are
// <script defer> (index.html) and each counts as it arrives, weighted by its
// size (from version.json, which this fetches straight away -- that fetch is
// also the update check's, js/updater.js); the two pictures count too. The
// screen stays at least G.CONFIG.update.minBootMs so it never just flashes.
// Then js/updater.js decides: Update Available over this picture, or on to
// the Start screen (js/start.js).
//
// This file and js/strings.js are the only scripts that are not deferred:
// they run while the page is still being read, before any game script.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => (G.T ? G.T(k, v) : k);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Where each zombie's word goes on the two pictures (tools/art-render.js,
  // G.ArtRender.boot()): [x, y] as shares of the picture, and how near the
  // zombie is (its word that much larger). Nearest first.
  const ART = {
    large: { w: 1920, h: 1080, heads: [[0.3304, 0.333, 1.077], [0.4792, 0.4248, 0.999], [0.6855, 0.4626, 0.997], [0.5126, 0.3581, 0.831], [0.1297, 0.3536, 0.769], [0.847, 0.3555, 0.765],
      [0.3492, 0.4529, 0.67], [0.6475, 0.3716, 0.664], [0.5085, 0.3836, 0.545], [0.7913, 0.3801, 0.542], [0.2377, 0.3809, 0.539]] },
    small: { w: 1600, h: 740, heads: [[0.3606, 0.333, 1.077], [0.4829, 0.4248, 0.999], [0.6525, 0.4626, 0.997], [0.5103, 0.3581, 0.831], [0.1955, 0.3536, 0.769], [0.7853, 0.3555, 0.765],
      [0.376, 0.4529, 0.67], [0.6213, 0.3716, 0.664], [0.0928, 0.3359, 0.582], [0.9012, 0.3685, 0.581], [0.507, 0.3836, 0.545], [0.7395, 0.3801, 0.542], [0.2843, 0.3809, 0.539],
      [0.0353, 0.377, 0.472], [0.9794, 0.3765, 0.47]] },
  };
  // the picture a phone gets (index.html's <source media> is the same test)
  const SMALL = "(max-width: 900px), (max-height: 540px)";
  const THREE_SIZE = 600000;           // three.min.js, from the CDN: not in version.json

  const B = G.Boot = {
    t0: Date.now(),
    active: true,
    scripts: [],          // { el, src, vocab, done }
    images: [],           // { src, done }
    check: { done: false, manifest: null, at: 0 },
    tipI: 0, showWord: false,
    log: [],              // [ms since the page opened, % shown, what it said]

    start() {
      const overlay = $("loading-overlay");
      if (!overlay) return;
      overlay.classList.add("loading");
      // the game's scripts, in the order they will run
      Array.from(document.querySelectorAll("script[defer][src]")).forEach((el) => {
        const src = el.getAttribute("src");
        const s = { el, src, vocab: /(^|\/)js\/(data\/|wordbank\.js)/.test(src), done: false };
        const done = () => { if (s.done) return; s.done = true; if (/wordbank\.js$/.test(src)) this.onVocab(); this.update(); };
        el.addEventListener("load", done);
        el.addEventListener("error", done);            // (index.html's own handler names it)
        this.scripts.push(s);
      });
      // the two pictures: this screen's, and the Start screen's
      const img = $("boot-art-img");
      if (img) this.watchImage(img, null);
      this.watchImage(new Image(), "assets/boot/start-horde.webp");
      // a file counts as soon as it has arrived (its download timing): the
      // scripts run in page order, so one slow early file would otherwise hold
      // back all the rest that are already here
      if (window.PerformanceObserver) {
        const seen = (list) => list.getEntries().forEach((e) => {
          const s = this.scripts.find((x) => x.el.src === e.name) || this.images.find((x) => x.img.src === e.name);
          if (s && !s.arrived) { s.arrived = true; this.update(); }
        });
        try { new PerformanceObserver(seen).observe({ type: "resource", buffered: true }); } catch (err) { /* an older browser: the load events alone */ }
      }
      // the update check's version.json, fetched now (never from a cache)
      if (/^https?:$/.test(location.protocol)) {
        const ctl = window.AbortController ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
        this.check.req = fetch("version.json?check=" + Date.now(), { cache: "no-store", signal: ctl ? ctl.signal : undefined })
          .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then((m) => { if (!m || !m.build || !m.files) throw new Error("not a version file"); return m; })
          .finally(() => { if (timer) clearTimeout(timer); });
        this.check.at = Date.now();
        this.check.req.then((m) => { this.check.manifest = m; }, () => {}).then(() => { this.check.done = true; this.update(); });
      } else this.check.done = true;
      this.tip();
      this._tipTimer = setInterval(() => this.tip(), 4200);
      window.addEventListener("resize", () => this.placeWords());
      this.update();
    },
    watchImage(img, src) {
      const s = { img, src: src || img.getAttribute("src"), done: false };
      const done = () => { if (s.done) return; s.done = true; this.update(); if (img.id === "boot-art-img") this.placeWords(); };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
      if (src) img.src = src;
      else if (img.complete && img.naturalWidth) s.done = true;
      this.images.push(s);
    },
    // the version.json fetched at the start, for js/updater.js's first check
    // (once, and only while it is fresh)
    takeVersion() {
      const r = this.check.req;
      if (!r || this._taken || Date.now() - this.check.at > 20000) return null;
      this._taken = true;
      return r;
    },

    // ---------------- the progress ----------------
    // what each piece weighs: its size in version.json when that has come
    weight(path) {
      const m = this.check.manifest, f = m && m.files && m.files[String(path).replace(/^\.\//, "").split("?")[0]];
      if (/^https?:\/\//.test(path)) return THREE_SIZE;
      return f ? Math.max(2000, f.size) : 30000;
    },
    // a piece is in when it has arrived or has run
    progress() {
      let all = 0, done = 0;
      const add = (w, d) => { all += w; if (d) done += w; };
      add(40000, this.check.done);
      this.scripts.forEach((s) => add(this.weight(s.src), s.done || s.arrived));
      this.images.forEach((s) => add(this.weight(s.src), s.done || s.arrived));
      return all ? done / all : 1;
    },
    // what the screen says it is doing: the update check first; then the
    // first file still to come -- the word bank's are the vocabulary -- then
    // the pictures; then the scripts that are here starting up, and the
    // update check again if it is still going
    status() {
      if (!this.check.done && Date.now() - this.t0 < 1500) return T("boot.checking");
      const next = this.scripts.find((s) => !s.done && !s.arrived);
      if (next) return T(next.vocab ? "boot.vocab" : "boot.assets");
      if (this.images.some((s) => !s.done && !s.arrived)) return T("boot.assets");
      if (!this.check.done || (G.Updater && G.Updater.stage === "checking")) return T("boot.checking");
      return T("boot.starting");
    },
    // (drawn on the next frame -- or a moment later in a tab the browser is
    // not drawing, which pauses frames: the work still has to move on)
    update() {
      if (!this.active || this._due) return;
      this._due = true;
      const go = () => { if (!this._due) return; this._due = false; cancelAnimationFrame(raf); clearTimeout(timer); this.draw(); };
      const raf = requestAnimationFrame(go), timer = setTimeout(go, 60);
    },
    draw() {
      // (never backwards: when version.json arrives the pieces are weighed by
      // their real sizes, which can move the share a little either way)
      const f = this._shown = Math.max(this._shown || 0, Math.max(0, Math.min(1, this.progress())));
      const fill = $("boot-bar-fill"), bar = $("boot-bar");
      if (bar) bar.classList.remove("indeterminate");
      if (fill) fill.style.transform = "scaleX(" + f.toFixed(3) + ")";
      const pc = $("boot-pct"); if (pc) pc.textContent = Math.round(f * 100) + "%";
      const st = $("boot-status"); if (st) st.textContent = this.status();
      // (what it showed, when: tools/round16-test.js reads it back)
      if (this.log.length < 400) this.log.push([Date.now() - this.t0, Math.round(f * 1000) / 10, st ? st.textContent : ""]);
      // the last piece in: the updater may be waiting for it
      if (this.loaded() && G.Updater) G.Updater.maybeEnter();
    },
    // everything is in (js/updater.js waits for this as well as its check)
    loaded() { return this.check.done && this.scripts.every((s) => s.done) && this.images.every((s) => s.done); },

    // ---------------- tips and the Word of the Day ----------------
    tips() { const out = []; for (let i = 1; G.STRINGS && G.STRINGS.en["boot.tip." + i]; i++) out.push(T("boot.tip." + i)); return out; },
    tip() {
      const box = $("boot-tip");
      if (!box) return;
      const word = this.showWord && this.wotd;
      this.showWord = !this.showWord;
      const fill = () => {
        if (word) {
          const w = this.wotd;
          $("boot-tip-h").textContent = T("boot.wotd");
          $("boot-tip-text").innerHTML = `<b class="bt-word" lang="en">${esc(w.word)}</b>${w.pos ? ` <span class="pos-tag">(${esc(w.pos)})</span>` : ""} <span class="bt-sep">—</span> <span lang="th">${esc(w.thai)}</span>`;
        } else {
          const list = this.tips();
          if (!list.length) return;
          $("boot-tip-h").textContent = T("boot.tipHead");
          $("boot-tip-text").textContent = list[this.tipI++ % list.length];
        }
      };
      if (!$("boot-tip-text").textContent) { fill(); return; }
      box.classList.add("fade");
      setTimeout(() => { fill(); box.classList.remove("fade"); }, 260);
    },
    // the same word all day: by the date
    wordOfTheDay() {
      const all = G.WordBank.entries().slice().sort((a, b) => (a.id < b.id ? -1 : 1));
      if (!all.length) return null;
      const d = new Date(), day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
      const e = all[(Math.imul(day, 2654435761) >>> 0) % all.length];
      return { word: e.headword, thai: e.thai, pos: G.POS ? G.POS.abbr(e.partOfSpeech) : "" };
    },

    // ---------------- the words over the heads ----------------
    // the bank has arrived: pick this time's words, and the day's
    onVocab() {
      if (!G.WordBank) return;
      const pool = G.WordBank.entries().filter((e) => e.headword.length <= 11 && !/\s/.test(e.headword));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      this.words = pool.slice(0, 16).map((e) => ({ word: e.headword, pos: G.POS ? G.POS.abbr(e.partOfSpeech) : "" }));
      this.wotd = this.wordOfTheDay();
      this.placeWords();
    },
    // over each head on the picture as it is shown (object-fit: cover), the
    // nearest first; one that would touch another, or leave the screen, is left out
    placeWords() {
      const box = $("boot-words"), img = $("boot-art-img");
      if (!box || !this.words || !img) return;
      const art = (img.currentSrc || img.src || "").indexOf("loading-small") >= 0 ? ART.small : matchMedia(SMALL).matches && !img.currentSrc ? ART.small : ART.large;
      const W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) return;
      const k = Math.max(W / art.w, H / art.h), ox = (W - art.w * k) / 2, oy = (H - art.h * k) / 2;
      const base = Math.max(12, Math.min(30, art.w * k * 0.0125));
      box.innerHTML = "";
      const placed = [];
      art.heads.forEach(([x, y, s], i) => {
        const w = this.words[i % this.words.length];
        const px = ox + x * art.w * k, py = oy + y * art.h * k;
        if (px < 8 || px > W - 8 || py < 30 || py > H * 0.7) return;
        const el = document.createElement("div");
        el.className = "bw";
        el.lang = "en";
        el.style.left = px.toFixed(1) + "px"; el.style.top = py.toFixed(1) + "px";
        el.style.fontSize = Math.max(11, base * s).toFixed(1) + "px";
        el.style.animationDelay = (0.06 * placed.length).toFixed(2) + "s";
        el.innerHTML = esc(w.word) + (w.pos ? ` <span class="pos-tag">(${esc(w.pos)})</span>` : "");
        box.appendChild(el);
        const r = { l: px - el.offsetWidth / 2 - 6, r: px + el.offsetWidth / 2 + 6, t: py - el.offsetHeight - 3, b: py + 3 };
        if (r.l < 4 || r.r > W - 4 || placed.some((q) => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t)) { el.remove(); return; }
        placed.push(r);
      });
    },

    // the screen is going (to the Start screen, or the game opened on Update)
    finish() {
      this.active = false;
      clearInterval(this._tipTimer);
    },
  };

  B.start();
})();
