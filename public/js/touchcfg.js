// ===================================================================
// Touch control customisation (category B)
// -------------------------------------------------------------------
// Every on-screen control keeps following the responsive stylesheet until the
// player actually moves or resizes it -- only the controls they touched get an
// override. Overrides are stored as viewport FRACTIONS of the control's
// CENTRE, so a layout arranged on a phone still lands somewhere sensible after
// a rotation, on a tablet, or when the browser chrome changes height.
//
// Positions are written as plain left/top pixels rather than a transform,
// because .touch-btn.pressed already owns `transform` for the press feedback
// and the two would clobber each other.
// ===================================================================
G.TouchCfg = {
  // also the save keys of touchLayout.pos / .scale; names are "touchcfg.<id>"
  IDS: ["joystick", "fire", "ads", "interact", "reload", "jump", "sprint", "pause", "slots", "abilities"],
  MIN_SCALE: 0.6, MAX_SCALE: 1.8,
  editing: false,
  _sel: null,

  defaults() { return { pos: {}, scale: {}, opacity: 1, lookSens: 1, btnLookSens: 1 }; },

  // Tolerates a save file written before this feature existed, and repairs a
  // partially-written one rather than throwing halfway through a frame.
  cfg() {
    const s = G.save.settings;
    if (!s.touchLayout || typeof s.touchLayout !== "object") s.touchLayout = this.defaults();
    const c = s.touchLayout;
    if (!c.pos || typeof c.pos !== "object") c.pos = {};
    if (!c.scale || typeof c.scale !== "object") c.scale = {};
    if (!Number.isFinite(c.opacity)) c.opacity = 1;
    if (!Number.isFinite(c.lookSens)) c.lookSens = 1;
    if (!Number.isFinite(c.btnLookSens)) c.btnLookSens = 1;       // dragging from FIRE / AIM (new series, round 1, D)
    return c;
  },

  el(id) { return document.getElementById("touch-" + id); },
  root() { return document.getElementById("touch-controls"); },

  init() {
    // A rotation changes both the viewport and the CSS-derived defaults, so
    // stored fractions have to be re-resolved to pixels afterwards.
    let t = null;
    const reapply = () => { clearTimeout(t); t = setTimeout(() => this.apply(), 60); };
    window.addEventListener("resize", reapply);
    window.addEventListener("orientationchange", reapply);
    this.bindPanel();
    this.apply();
  },

  // ---------------- Applying the stored layout ----------------
  apply() {
    const root = this.root();
    if (!root) return;
    const c = this.cfg();
    root.style.setProperty("--touch-op", String(c.opacity));
    // Two passes: every size is written first, because a moved control is
    // anchored by its centre and that needs the width it ends up with.
    this.IDS.forEach((id) => {
      const el = this.el(id);
      if (el) el.style.setProperty("--s", String(c.scale[id] || 1));
    });
    const W = window.innerWidth, H = window.innerHeight;
    this.IDS.forEach((id) => {
      const el = this.el(id);
      if (!el) return;
      const p = c.pos[id];
      if (!p) {
        el.style.left = ""; el.style.top = ""; el.style.right = ""; el.style.bottom = "";
        if (id === "slots" || id === "abilities") el.style.transform = "";
        return;
      }
      const r = el.getBoundingClientRect();
      // Hidden controls measure 0x0; leave them alone and let the next apply()
      // (the one that runs when they are shown) place them.
      if (r.width < 1 || r.height < 1) return;
      this._place(el, id, p.x * W, p.y * H, r.width, r.height);
    });
  },

  _place(el, id, cx, cy, w, h) {
    const W = window.innerWidth, H = window.innerHeight;
    const left = Math.min(Math.max(cx - w / 2, 2), Math.max(2, W - w - 2));
    const top = Math.min(Math.max(cy - h / 2, 2), Math.max(2, H - h - 2));
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    // (the two rows are centred with a transform until they are moved)
    if (id === "slots" || id === "abilities") el.style.transform = "none";
  },

  setScale(id, v) {
    const c = this.cfg();
    v = Math.min(this.MAX_SCALE, Math.max(this.MIN_SCALE, v));
    if (Math.abs(v - 1) < 0.001) delete c.scale[id]; else c.scale[id] = v;
    this.apply();
  },
  setOpacity(v) { this.cfg().opacity = Math.min(1, Math.max(0.2, v)); this.apply(); },
  setLookSens(v) { this.cfg().lookSens = Math.min(3, Math.max(0.3, v)); },
  lookSens() { return this.cfg().lookSens; },
  setBtnLookSens(v) { this.cfg().btnLookSens = Math.min(3, Math.max(0.3, v)); },
  btnLookSens() { return this.cfg().btnLookSens; },

  resetOne(id) { const c = this.cfg(); delete c.pos[id]; delete c.scale[id]; this.apply(); G.persist(); },
  resetAll() {
    G.save.settings.touchLayout = this.defaults();
    this.apply(); G.persist();
  },

  // ---------------- Editor ----------------
  openEditor() {
    if (this.editing) return;
    const UI = G.UI;
    this._return = UI._currentScreen || "screen-mainmenu";
    this._prevTouchMode = document.body.classList.contains("touch-mode");
    this._prevHudHidden = document.getElementById("hud").classList.contains("hidden");
    this._prevControlsHidden = this.root().classList.contains("hidden");
    this.editing = true;

    UI.showScreen(null);
    document.body.classList.add("touch-mode");
    UI.setHudVisible(true);
    UI.setTouchControlsVisible(true);
    this.root().classList.add("tc-editing");

    // A layout is only meaningful against the view it sits on top of, so the
    // editor shows the real level behind it -- the live scene when a run is
    // loaded, and a throwaway render of the school when opened from the menu.
    this._previewOwned = G.Game.startLayoutPreview();
    const live = G.Game.state === "GAMEPLAY" || G.Game.state === "PAUSE";
    UI.updateHud(live ? G.Game.buildHudState() : this.sampleHud());
    // Show the full weapon row so it can be placed even before the player owns
    // four guns.
    UI._touchSlotSig = null;
    UI.refreshTouchSlots([{ active: false }, { active: true }, { active: false }, { active: false }, { active: false }], 1);
    // ...and all four ability buttons, whatever the run holds (round 3)
    if (UI.refreshTouchAbilities) UI.refreshTouchAbilities(true);

    this.apply();
    this.select(null);
    document.getElementById("touchcfg-panel").classList.remove("hidden");
    document.getElementById("touchcfg-capture").classList.remove("hidden");
    this.renderPanel();
    this._tick();
  },

  closeEditor() {
    if (!this.editing) return;
    this.editing = false;
    this._drag = null;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    document.getElementById("touchcfg-panel").classList.add("hidden");
    document.getElementById("touchcfg-capture").classList.add("hidden");
    this.root().classList.remove("tc-editing");
    this.select(null);
    if (this._previewOwned) { G.Game.endLayoutPreview(); this._previewOwned = false; }
    G.persist();

    const UI = G.UI;
    UI._touchSlotSig = null;
    if (UI.refreshTouchAbilities) UI.refreshTouchAbilities(false);
    document.body.classList.toggle("touch-mode", this._prevTouchMode);
    UI.setHudVisible(!this._prevHudHidden);
    UI.setTouchControlsVisible(!this._prevControlsHidden);
    UI.showScreen(this._return || "screen-mainmenu");
    if (this._return === "screen-settings") UI.renderSettings();
  },

  _tick() {
    if (!this.editing) return;
    G.Game.renderLayoutPreviewFrame();
    this._raf = requestAnimationFrame(() => this._tick());
  },

  sampleHud() {
    return {
      hp: 100, stamina: 100, staminaExhausted: false, money: 1500, score: 2400,
      levelLabel: G.T("hud.levelWave", { level: G.getLevel(1).name, wave: "1/" + G.getLevel(1).waves }), zombiesLeft: 3,
      weaponName: G.WEAPON_DEFS.pistol.name,
      // a real meaning from the level-1 word list, so the preview shows Thai text at its true width
      ammoInMag: 12, ammoReserve: 48, currentMeaning: G.WORDS_LEVEL_1[0][1],
      slots: [{ active: false }, { active: true }, { active: false }, { active: false }, { active: false }],
      combo: 1,
    };
  },

  select(id) {
    this._sel = id;
    this.IDS.forEach((k) => { const el = this.el(k); if (el) el.classList.toggle("tc-selected", k === id); });
    this.syncPanelSelection();
  },

  // The capture sheet sits above every control and swallows the event, so the
  // control's own touchstart never runs -- dragging FIRE around cannot also
  // fire the gun. The real target is recovered by hit testing instead.
  hitTest(x, y) {
    const cap = document.getElementById("touchcfg-capture");
    const prev = cap.style.pointerEvents;
    cap.style.pointerEvents = "none";
    const hit = document.elementFromPoint(x, y);
    cap.style.pointerEvents = prev;
    if (!hit) return null;
    for (const id of this.IDS) {
      const el = this.el(id);
      if (el && (el === hit || el.contains(hit))) return id;
    }
    return null;
  },

  bindPanel() {
    const cap = document.getElementById("touchcfg-capture");
    const p = (id) => document.getElementById(id);

    cap.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const id = this.hitTest(e.clientX, e.clientY);
      this.select(id);
      if (!id) return;
      const r = this.el(id).getBoundingClientRect();
      this._drag = { id, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
      try { cap.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic or already-released pointer */ }
    });
    cap.addEventListener("pointermove", (e) => {
      if (!this._drag) return;
      e.preventDefault();
      const d = this._drag, el = this.el(d.id);
      const r = el.getBoundingClientRect();
      const cx = e.clientX - d.dx, cy = e.clientY - d.dy;
      this._place(el, d.id, cx, cy, r.width, r.height);
      const nr = el.getBoundingClientRect();
      this.cfg().pos[d.id] = {
        x: (nr.left + nr.width / 2) / window.innerWidth,
        y: (nr.top + nr.height / 2) / window.innerHeight,
      };
    });
    const end = () => { if (this._drag) { this._drag = null; G.persist(); } };
    cap.addEventListener("pointerup", end);
    cap.addEventListener("pointercancel", end);

    p("touchcfg-collapse").onclick = () => {
      const panel = p("touchcfg-panel");
      panel.classList.toggle("collapsed");
      p("touchcfg-collapse").textContent = G.T(panel.classList.contains("collapsed") ? "touchcfg.show" : "touchcfg.hide");
    };
    p("touchcfg-size").oninput = (e) => {
      if (!this._sel) return;
      this.setScale(this._sel, parseFloat(e.target.value));
      p("touchcfg-sizeval").textContent = "(" + parseFloat(e.target.value).toFixed(2) + "x)";
    };
    p("touchcfg-size").onchange = () => G.persist();
    document.querySelectorAll(".touchcfg-preset").forEach((b) => {
      b.onclick = () => {
        if (!this._sel) return;
        this.setScale(this._sel, parseFloat(b.dataset.scale));
        G.persist(); this.syncPanelSelection();
      };
    });
    p("touchcfg-resetone").onclick = () => { if (this._sel) { this.resetOne(this._sel); this.syncPanelSelection(); } };
    p("touchcfg-op").oninput = (e) => {
      this.setOpacity(parseFloat(e.target.value));
      p("touchcfg-opval").textContent = "(" + Math.round(parseFloat(e.target.value) * 100) + "%)";
    };
    p("touchcfg-op").onchange = () => G.persist();
    p("touchcfg-sens").oninput = (e) => {
      this.setLookSens(parseFloat(e.target.value));
      p("touchcfg-sensval").textContent = "(" + parseFloat(e.target.value).toFixed(2) + "x)";
    };
    p("touchcfg-sens").onchange = () => G.persist();
    p("touchcfg-bsens").oninput = (e) => {
      this.setBtnLookSens(parseFloat(e.target.value));
      p("touchcfg-bsensval").textContent = "(" + parseFloat(e.target.value).toFixed(2) + "x)";
    };
    p("touchcfg-bsens").onchange = () => G.persist();
    p("touchcfg-reset").onclick = () => {
      if (!confirm(G.T("touchcfg.confirmReset"))) return;
      this.resetAll(); this.renderPanel();
    };
    p("touchcfg-done").onclick = () => this.closeEditor();
    // (new series, round 1, F) the HUD's sizes, from here too
    p("touchcfg-hud").onclick = () => { this.closeEditor(); G.HudCfg.openEditor({ back: "touchcfg" }); };
  },

  renderPanel() {
    const c = this.cfg(), p = (id) => document.getElementById(id);
    p("touchcfg-op").value = c.opacity;
    p("touchcfg-opval").textContent = "(" + Math.round(c.opacity * 100) + "%)";
    p("touchcfg-sens").value = c.lookSens;
    p("touchcfg-sensval").textContent = "(" + c.lookSens.toFixed(2) + "x)";
    p("touchcfg-bsens").value = c.btnLookSens;
    p("touchcfg-bsensval").textContent = "(" + c.btnLookSens.toFixed(2) + "x)";
    this.syncPanelSelection();
  },

  syncPanelSelection() {
    const p = (id) => document.getElementById(id);
    if (!p("touchcfg-selname")) return;
    const sel = this._sel;
    p("touchcfg-selname").textContent = G.T(sel ? "touchcfg." + sel : "touchcfg.none");
    const scale = sel ? (this.cfg().scale[sel] || 1) : 1;
    p("touchcfg-size").value = scale;
    p("touchcfg-size").disabled = !sel;
    p("touchcfg-sizeval").textContent = sel ? "(" + scale.toFixed(2) + "x)" : "";
    p("touchcfg-resetone").disabled = !sel;
    document.querySelectorAll(".touchcfg-preset").forEach((b) => { b.disabled = !sel; });
  },
};
