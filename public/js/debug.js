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
//   the frame       time, FPS, draw calls (later rounds add sounds, particles)
//
// ?lab=weapons also loads the Weapon Lab (js/lab/weapons.js).
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
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (this._t) this.frameMs = this.frameMs * 0.9 + (now - this._t) * 0.1;
      this._t = now;
      this.check();
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
    // a lab of its own (round 1: the weapons)
    const lab = (/[?&]lab=([a-z]+)/.exec(location.search) || [])[1];
    if (lab === "weapons") {
      const s = document.createElement("script");
      s.src = "js/lab/weapons.js";
      document.head.appendChild(s);
    }
  };
  if (document.body) start(); else window.addEventListener("DOMContentLoaded", start);
})();
