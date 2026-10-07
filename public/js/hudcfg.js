// ===================================================================
// HUD sizes (new series, round 1, F)
// -------------------------------------------------------------------
// Every part of the HUD has its own size, 50%-150%, and one slider sizes the
// whole HUD at once: the health and stamina bars, money, score, the wave and
// zombies left, the weapon and its ammunition, the minimap, the perk and the
// ability icons, and the word to find. Set in Settings > Adjust HUD Size (or
// from the touch layout editor), with the real HUD on screen changing as the
// sliders move; kept in the save (G.save.settings.hudScale), Reset to Default
// puts them back.
//
// The parts are sized with CSS zoom, which moves what is round them too, and
// then checked: none may overlap another or leave the screen -- the safe area
// of a phone or an iPad with rounded corners included. If a size would do
// either on this screen, the whole HUD shrinks a little until it fits (the
// editor says so). Limits: G.CONFIG.hud (js/config.js).
// ===================================================================
(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  // each part: what it sizes
  const PARTS = {
    hp: ".hud-health", stamina: ".hud-stamina", money: ".hud-money-stat", score: ".hud-score-stat",
    wave: ".hud-wave-stat", weapon: ".hud-right", minimap: "#hud-minimap", perks: "#hud-perks",
    abilities: "#hud-abilities", word: ".hud-meaning-box",
  };
  // the boxes that must not overlap each other or leave the screen
  const BOXES = [".hud-left", ".hud-right", "#hud-minimap", "#hud-abilities", ".hud-meaning-box"];

  G.HudCfg = {
    PARTS: Object.keys(PARTS),
    fitK: 1,
    editing: false,

    scales() {
      const s = G.save.settings;
      if (!s.hudScale || typeof s.hudScale !== "object") s.hudScale = {};
      return s.hudScale;
    },
    get(part) {
      const v = this.scales()[part], H = G.CONFIG.hud;
      return Number.isFinite(v) ? Math.min(H.maxScale, Math.max(H.minScale, v)) : 1;
    },
    set(part, v) {
      const H = G.CONFIG.hud;
      v = Math.min(H.maxScale, Math.max(H.minScale, v));
      if (Math.abs(v - 1) < 0.001) delete this.scales()[part]; else this.scales()[part] = Math.round(v * 100) / 100;
      this.refresh();
    },
    reset() { G.save.settings.hudScale = {}; this.refresh(); },
    // the zoom each part gets, before the fit
    want(part) { return this.get("all") * this.get(part); },

    apply() {
      const k = this.fitK;
      for (const part of this.PARTS) {
        const z = (this.want(part) * k).toFixed(3);
        document.querySelectorAll(PARTS[part]).forEach((el) => { el.style.zoom = z === "1.000" ? "" : z; });
      }
      // (touch mode: the weapon panel sits under the minimap, however big
      // either is -- css, "shares the top-right corner")
      const hud = document.getElementById("hud");
      if (hud) { hud.style.setProperty("--mmz", (this.want("minimap") * k).toFixed(3)); hud.style.setProperty("--rz", (this.want("weapon") * k).toFixed(3)); }
      if (G.Minimap && G.Minimap.resize) G.Minimap.resize();
    },
    // sizes, then the fit (only measurable while the HUD is on screen)
    refresh() {
      if (!G.save) return;
      this.fitK = 1;
      this.apply();
      this.fit();
      if (this._mmSample) this.drawSampleMap();
      if (this.editing) this.renderFit();
    },

    // ---- no overlaps, nothing off the screen ----
    insets() {
      if (!this._probe) {
        const p = this._probe = document.createElement("div");
        p.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l)";
        document.body.appendChild(p);
      }
      const cs = getComputedStyle(this._probe);
      return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    },
    visibleBox(sel) {
      const el = document.querySelector(sel);
      if (!el || el.classList.contains("hidden") || !el.getClientRects().length) return null;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 ? { sel, r } : null;
    },
    // what is wrong at the sizes now on screen: pairs that overlap, boxes off
    // the screen, and (touch mode) a touch button covered
    problems() {
      const W = window.innerWidth, H = window.innerHeight, I = this.insets();
      const boxes = BOXES.map((s) => this.visibleBox(s)).filter(Boolean);
      const btns = document.body.classList.contains("touch-mode") ? G.TouchCfg.IDS.map((id) => this.visibleBox("#touch-" + id)).filter(Boolean) : [];
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      const out = [];
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i].r;
        if (a.left < I.l - 1 || a.top < I.t - 1 || a.right > W - I.r + 1 || a.bottom > H - I.b + 1) out.push("off:" + boxes[i].sel);
        for (let j = i + 1; j < boxes.length; j++) if (hit(a, boxes[j].r)) out.push(boxes[i].sel + "|" + boxes[j].sel);
        for (const b of btns) if (hit(a, b.r)) out.push(boxes[i].sel + "|" + b.sel);
      }
      return out;
    },
    fit() {
      const hud = document.getElementById("hud");
      if (!hud || hud.classList.contains("hidden") || !hud.getClientRects().length) return;
      // what is already so at the default sizes (a layout's own choice) is
      // not held against the player's sizes
      const touch = document.body.classList.contains("touch-mode"), tl = touch ? G.TouchCfg.cfg() : null;
      const key = window.innerWidth + "x" + window.innerHeight + (touch ? "t" + JSON.stringify([tl.pos, tl.scale]) : "d");
      if (this._baseKey !== key) {
        const saved = this.fitK;
        this._baseline = null;
        this._defaults = true; this.fitK = 1;
        this.PARTS.forEach((p) => document.querySelectorAll(PARTS[p]).forEach((el) => { el.style.zoom = ""; }));
        this._baseline = new Set(this.problems());
        this._defaults = false; this._baseKey = key; this.fitK = saved;
        this.apply();
      }
      const bad = () => this.problems().filter((p) => !this._baseline.has(p));
      let n = 0;
      while (bad().length && n++ < 14 && this.fitK > 0.3) { this.fitK *= 0.93; this.apply(); }
    },

    // ---------------- the editor ----------------
    openEditor(opts) {
      if (this.editing) return;
      opts = opts || {};
      const UI = G.UI, game = G.Game;
      this._back = opts.back || null;
      this._return = UI._currentScreen || "screen-mainmenu";
      this._prevHudHidden = document.getElementById("hud").classList.contains("hidden");
      this.editing = true;
      UI.showScreen(null);
      UI.setHudVisible(true);
      document.body.classList.add("hudcfg-open");
      this._previewOwned = game.startLayoutPreview();
      const live = game.state === "GAMEPLAY" || game.state === "PAUSE";
      UI.updateHud(live && game.player ? game.buildHudState() : G.TouchCfg.sampleHud());
      // (from the menu: sample perks, abilities and a minimap to size)
      this._sample = !live;
      if (this._sample) {
        const perks = document.getElementById("hud-perks");
        perks.innerHTML = ["perk_speed", "perk_armor", "extra_slot", "focus_time"].map((id) => `<span class="hud-perk">${G.PERK_BY_ID[id].icon}</span>`).join("");
        perks.classList.remove("hidden");
        this._abSlots = G.Abilities.slots;
        G.Abilities.slots = ["dash", "freeze", "radar", "barrier"].map((id) => ({ id, cd: 0 }));
        UI.updateAbilityBar(null, true);
      }
      const mm = document.getElementById("hud-minimap");
      this._mmHidden = mm.classList.contains("hidden");
      if (this._mmHidden) { mm.classList.remove("hidden"); this._mmSample = true; this.drawSampleMap(); }
      this.renderPanel();
      document.getElementById("hudcfg-panel").classList.remove("hidden");
      G.Modal.open("hudcfg", { keys: (e) => { if (e.code === "Escape") { this.closeEditor(); return true; } return false; } });
      this.refresh();
      this._tick();
    },
    drawSampleMap() {
      const cv = document.getElementById("hud-minimap");
      if (G.Minimap && G.Minimap.resize) { G.Minimap.cv = cv; G.Minimap.resize(); }
      const c = cv.getContext("2d"), W = cv.width, R = W / 2;
      c.clearRect(0, 0, W, W);
      c.fillStyle = "#1a2418"; c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(220,230,220,0.55)"; c.lineWidth = Math.max(1.5, R / 40); c.stroke();
      c.fillStyle = "#6bff7a"; c.beginPath(); c.moveTo(R, R - R / 6); c.lineTo(R + R / 10, R + R / 10); c.lineTo(R - R / 10, R + R / 10); c.closePath(); c.fill();
    },
    closeEditor() {
      if (!this.editing) return;
      this.editing = false;
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      document.getElementById("hudcfg-panel").classList.add("hidden");
      document.body.classList.remove("hudcfg-open");
      document.querySelectorAll(".hudcfg-sel").forEach((el) => el.classList.remove("hudcfg-sel"));
      G.Modal.close("hudcfg");
      G.persist();
      if (this._sample) {
        G.Abilities.slots = this._abSlots || [];
        G.UI.updateAbilityBar(null, true);
        document.getElementById("hud-perks").classList.add("hidden");
        G.UI._hudPerkSig = null;
      }
      if (this._mmSample) { document.getElementById("hud-minimap").classList.add("hidden"); this._mmSample = false; }
      if (this._previewOwned) { G.Game.endLayoutPreview(); this._previewOwned = false; }
      G.UI.setHudVisible(!this._prevHudHidden);
      G.UI.showScreen(this._return || "screen-mainmenu");
      if (this._return === "screen-settings") G.UI.renderSettings();
      if (this._back === "touchcfg") G.TouchCfg.openEditor();
    },
    _tick() {
      if (!this.editing) return;
      G.Game.renderLayoutPreviewFrame();
      this._raf = requestAnimationFrame(() => this._tick());
    },
    renderPanel() {
      const rows = document.getElementById("hudcfg-rows");
      const H = G.CONFIG.hud;
      rows.innerHTML = ["all"].concat(this.PARTS).map((p) => {
        const v = this.get(p);
        return `<div class="touchcfg-row hudcfg-row${p === "all" ? " all" : ""}" data-part="${p}"><label><span>${esc(T("hudcfg." + p))}</span> <span class="hv">(${Math.round(v * 100)}%)</span></label>` +
          `<input type="range" min="${H.minScale}" max="${H.maxScale}" step="0.05" value="${v}" aria-label="${esc(T("hudcfg." + p))}"></div>`;
      }).join("");
      rows.querySelectorAll(".hudcfg-row").forEach((row) => {
        const p = row.dataset.part, inp = row.querySelector("input");
        inp.oninput = () => { this.set(p, parseFloat(inp.value)); row.querySelector(".hv").textContent = "(" + Math.round(this.get(p) * 100) + "%)"; };
        inp.onchange = () => G.persist();
        const mark = (on) => this.mark(p, on);
        inp.onfocus = () => mark(true); inp.onblur = () => mark(false);
        row.onmouseenter = () => mark(true); row.onmouseleave = () => mark(false);
      });
      document.getElementById("hudcfg-reset").onclick = () => { this.reset(); G.persist(); this.renderPanel(); };
      document.getElementById("hudcfg-done").onclick = () => this.closeEditor();
      this.renderFit();
    },
    // the part a slider sizes, outlined on the HUD
    mark(part, on) {
      document.querySelectorAll(".hudcfg-sel").forEach((el) => el.classList.remove("hudcfg-sel"));
      if (!on) return;
      const sel = part === "all" ? "#hud .hud-left, #hud .hud-right, #hud-minimap, #hud-abilities, #hud .hud-meaning-box" : PARTS[part];
      document.querySelectorAll(sel).forEach((el) => el.classList.add("hudcfg-sel"));
    },
    renderFit() {
      const el = document.getElementById("hudcfg-fit");
      if (!el) return;
      const shrunk = this.fitK < 0.995;
      el.classList.toggle("hidden", !shrunk);
      if (shrunk) el.textContent = T("hudcfg.fitted", { p: Math.round(this.fitK * 100) });
    },
  };

  window.addEventListener("resize", () => { if (G.save && G.HudCfg) { clearTimeout(G.HudCfg._rt); G.HudCfg._rt = setTimeout(() => G.HudCfg.refresh(), 80); } });
})();
