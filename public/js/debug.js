// ===================================================================
// The debug overlay (overhaul, round 1)
// -------------------------------------------------------------------
// Only with ?debug=1 in the address (or a lab, ?lab=...): js/game.js fetches
// this file then, and never in ordinary play.
//
//   the weapon      G.WeaponSM's state and how long it has been in it, the
//                   gun in the hands and the one chosen, the reload in
//                   progress (its kind, its clock, whether it has committed)
//   the events      the last ten on G.Bus
//   the checks      every frame: the machine's own (ammo in range, one commit
//                   a reload, nothing stuck past its watchdog, the gun in the
//                   hands the one chosen) and the HUD's ammo against the game's
//   warnings        from the watchdog and the checks (also in the console)
//   the frame       time, FPS, draw calls; (round 2) the effects against their
//                   budget; (round 3) the sound: voices of each kind against
//                   their limits, all of them against the level's, the peak,
//                   the room -- and the Stress button (bottom left)
//
// ?lab=weapons also loads the Weapon Lab (js/lab/weapons.js), ?lab=sound the
// Sound Lab (js/lab/sound.js), ?lab=zombies the Zombie Gallery (js/lab/zombies.js).
// ===================================================================
window.G = window.G || {};

G.Debug = {
  warnings: [],
  frameMs: 16.7,

  warn(text) {
    const last = this.warnings[this.warnings.length - 1];
    if (last && last.text === text) { last.n++; return; }
    this.warnings.push({ text, n: 1 });
    if (this.warnings.length > 30) this.warnings.shift();
    if (window.console) console.warn("[debug] " + text);
  },

  init() {
    if (this.el) return;
    const st = document.createElement("style");
    st.textContent = `#debug-overlay{position:fixed;left:8px;top:8px;z-index:9000;max-width:min(420px,calc(100vw - 16px));
      background:rgba(8,10,12,.78);color:#d8f3dc;font:11px/1.45 ui-monospace,Consolas,monospace;padding:8px 10px;border:1px solid rgba(255,255,255,.18);
      border-radius:4px;pointer-events:none;white-space:pre-wrap}
      #debug-overlay b{color:#fff}#debug-overlay .bad{color:#ff8a80}#debug-overlay .dim{color:#9aa5ad}`;
    document.head.appendChild(st);
    const el = document.createElement("div");
    el.id = "debug-overlay";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    this.el = el;
    this.stressBtn();
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (this._t) this.frameMs = this.frameMs * 0.9 + (now - this._t) * 0.1;
      this._t = now;
      this.check();
      this.stressTick();
      if (now - (this._drawn || 0) > 120) { this._drawn = now; this.draw(); }
    };
    requestAnimationFrame(tick);
  },

  // every frame, while a run is being played
  check() {
    const g = G.Game, W = g && g.wsm;
    if (!W || g.state !== "GAMEPLAY" || g.paused) return;
    const out = W.validate();
    // the HUD's ammo is the game's (once the HUD has been drawn for this frame)
    const id = g.currentWeaponId();
    const hud = document.getElementById("hud-ammo");
    if (hud && id !== "melee" && g.player.ammo[id] && !G.Modal.isOpen()) {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(hud.textContent || "");
      const a = g.player.ammo[id];
      if (m && (+m[1] !== a.mag || +m[2] !== a.reserve)) {
        // (one frame behind is the HUD's normal order; two in a row is a fault)
        if (this._hudOff) out.push("HUD ammo " + m[1] + "/" + m[2] + " but the game has " + a.mag + "/" + a.reserve);
        this._hudOff = true;
      } else this._hudOff = false;
    }
    out.forEach((p) => this.warn(p));
    this.lastCheck = out;
  },


  // ---- (overhaul, round 3) the sound's stress test -------------------------
  // 30 zombies in a ring round the player, the trigger held (the gun in hand,
  // its reserve endless), an explosion every 1.2 s close by; the player
  // cannot die. Every frame: the loudest sample, the voices of each kind
  // against their limits and all of them against the graphics level's.
  // Stress again (or G.Debug.stress(false)) ends it: G.Debug.stressReport.
  stress(on) {
    const g = G.Game;
    if (on === undefined) on = !this._stress;
    if (!on) {
      const S = this._stress;
      if (!S) return this.stressReport || null;
      clearInterval(S.timer);
      G.Input.mouseDown = false;
      this._stress = null;
      S.secs = (performance.now() - S.t0) / 1000;
      this.stressReport = S;
      this.stressBtn();
      return S;
    }
    if (this._stress || !g || g.state !== "GAMEPLAY" || !g.world) return null;
    G.Audio.unlock();
    const S = this._stress = { t0: performance.now(), secs: 0, peak: -Infinity, clipped: 0, maxTotal: 0, max: {}, over: [], zombies: 0, blasts: 0 };
    const p = g.yawObject.position;
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2, d = 4 + (i % 5) * 2.4;
      const z = g.spawnZombieAt(i % 4 ? "normal" : "fast", new THREE.Vector3(p.x + Math.cos(a) * d, p.y - 1.7, p.z + Math.sin(a) * d), null);
      if (z) S.zombies++;
    }
    S.timer = setInterval(() => {
      if (!this._stress || G.Game.state !== "GAMEPLAY") return;
      const q = G.Game.yawObject.position, a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 7;
      G.Game.splashDamage(new THREE.Vector3(q.x + Math.cos(a) * d, q.y - 1.2, q.z + Math.sin(a) * d), { splashRadius: Math.random() < 0.3 ? 6 : 3.5 }, 0, true);
      S.blasts++;
    }, 1200);
    this.stressBtn();
    return S;
  },
  stressTick() {
    const S = this._stress, g = G.Game;
    if (!S) return;
    if (!g || g.state !== "GAMEPLAY") { this.stress(false); return; }
    S.secs = (performance.now() - S.t0) / 1000;
    g.player.hp = g.player.maxHp;
    const id = g.currentWeaponId(), a = g.player.ammo[id];
    if (a && a.reserve < 200) a.reserve = 999;
    G.Input.mouseDown = true;
    const def = g.currentWeaponDef();
    if (def && !def.auto && G.onFirePress) G.onFirePress();
    const A = G.Audio, C = G.CONFIG.audio;
    if (!A.ctx) return;
    const pk = A.peakDb();
    if (pk > S.peak) S.peak = pk;
    if (pk > -0.05) S.clipped++;
    const c = A.counts();
    S.maxTotal = Math.max(S.maxTotal, c.total);
    Object.keys(C.limits).forEach((k) => {
      S.max[k] = Math.max(S.max[k] || 0, c[k] || 0);
      if ((c[k] || 0) > C.limits[k]) S.over.push(k + " " + c[k] + "/" + C.limits[k]);
    });
    if (c.total > C.total[A.tier()]) S.over.push("total " + c.total + "/" + C.total[A.tier()]);
    if (S.over.length > 50) S.over.length = 50;
  },
  // the Stress button (pointer events of its own: the overlay lets clicks through)
  stressBtn() {
    if (!this.btn) {
      const b = document.createElement("button");
      b.id = "debug-stress"; b.type = "button";
      b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9001;padding:6px 12px;font:12px ui-monospace,Consolas,monospace;background:#3a1e1e;color:#ffd6d6;border:1px solid #c0605a;border-radius:4px;cursor:pointer";
      b.onclick = (e) => { e.stopPropagation(); this.stress(); b.blur(); };
      document.body.appendChild(b);
      this.btn = b;
    }
    this.btn.textContent = G.T(this._stress ? "debug.stressStop" : "debug.stress");
  },
  draw() {
    const g = G.Game, W = g && g.wsm, T = (k, v) => G.T(k, v), esc = (s) => G.escapeHtml(String(s));
    const L = [];
    L.push("<b>" + esc(T("debug.title")) + "</b>");
    if (W) {
      L.push(esc(T("debug.state", { s: W.state, t: W.stateT.toFixed(2) })));
      L.push(esc(T("debug.held", { h: W.held, c: g.player ? g.currentWeaponId() : "-" })));
      const R = W.rl;
      L.push(esc(R ? T("debug.reload", { k: R.kind, t: R.t.toFixed(2), d: R.plan ? R.plan.dur.toFixed(2) : "-", c: R.committed ? T("debug.committed") : "" }) : T("debug.noReload")));
      L.push(esc(T("debug.aim", { a: W.aimActive ? "✓" : "–", s: W.sprintOut.toFixed(2) })));
      const ok = !this.lastCheck || !this.lastCheck.length;
      L.push(`<span class="${ok ? "" : "bad"}">${esc(T("debug.check", { r: ok ? T("debug.ok") : this.lastCheck.join("; ") }))}</span>`);
    }
    L.push(esc(T("debug.events")) + ":");
    (G.Bus ? G.Bus.recent : []).slice().reverse().forEach((e) => {
      const p = e.p || {};
      const what = [p.phase, p.marker && p.marker !== p.phase ? p.marker : null, p.to, p.weaponId || p.toId].filter(Boolean).join(" ");
      L.push(`<span class="dim">  ${esc(e.type)} ${esc(what)}</span>`);
    });
    const r = g && g.renderer;
    L.push(esc(T("debug.frame", { ms: this.frameMs.toFixed(1), fps: Math.round(1000 / Math.max(1, this.frameMs)), calls: r ? r.info.render.calls : 0 })));
    // (round 2) the weapon's effects against their budget for this graphics level
    if (G.FX) { const f = G.FX.stats(); L.push(esc(T("debug.fx", { p: f.particles, pb: f.particleBudget, d: f.decals, db: f.decalBudget, s: f.shells }))); }
    // (round 3) the sound: voices by kind against their limits, all of them against the level's, the peak, the room
    if (G.Audio && G.Audio.ctx) {
      const A = G.Audio, c = A.counts(), Lm = G.CONFIG.audio.limits, tot = G.CONFIG.audio.total[A.tier()];
      const pk = A.peakDb();
      L.push(esc(T("debug.audio", { n: c.total, t: tot, p: Number.isFinite(pk) ? pk.toFixed(1) : "-∞", z: (G.Acoustics && G.Acoustics.zone) || "-" })));
      L.push(`<span class="dim">  ${esc(["weapons", "impact", "zombie", "steps", "sfx", "ui", "ambient"].map((k) => k + " " + (c[k] || 0) + "/" + Lm[k]).join(" · "))}</span>`);
      if (this._stress || this.stressReport) { const S = this._stress || this.stressReport; L.push(esc(T("debug.stressLine", { s: S.secs.toFixed(0), p: Number.isFinite(S.peak) ? S.peak.toFixed(1) : "-∞", v: S.maxTotal, o: S.over.length }))); }
    }
    if (this.warnings.length) {
      L.push(`<span class="bad">${esc(T("debug.warnings", { n: this.warnings.reduce((a, w) => a + w.n, 0) }))}</span>`);
      this.warnings.slice(-3).forEach((w) => L.push(`<span class="bad">  ${esc(w.text)}${w.n > 1 ? " ×" + w.n : ""}</span>`));
    }
    this.el.innerHTML = L.join("\n");
  },
};

(function () {
  const start = () => {
    G.Debug.init();
    // a lab of its own (round 1: the weapons; round 3: the sound; round 4: the zombies)
    const lab = (/[?&]lab=([a-z]+)/.exec(location.search) || [])[1];
    if (lab === "weapons" || lab === "sound" || lab === "zombies") {
      const s = document.createElement("script");
      s.src = "js/lab/" + lab + ".js";
      document.head.appendChild(s);
    }
  };
  if (document.body) start(); else window.addEventListener("DOMContentLoaded", start);
})();
