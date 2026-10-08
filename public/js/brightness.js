// ===================================================================
// Brightness calibration (visual series, round 1, E4)
// -------------------------------------------------------------------
// The way games set brightness: three symbols on the night's darkest colour,
// at three levels of light -- the slider is moved until the dimmest one is
// only just visible. Shown once, after the Start screen, the first time the
// game opens (or the first time since the new look); again any time from
// Settings > Graphics > Brightness ("Calibrate").
//
// The symbols are drawn through the same film as the game (G.Visuals.toDisplay):
// what they look like here is what that brightness does in play. A G.Modal
// window ("brightness"): keys, touch and a controller all work it.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);
  const B = () => G.VISUAL.brightness;

  G.BrightnessCal = {
    from: null,
    open(from) {
      if (G.Modal.isOpen("brightness")) return;
      this.from = from || "settings";
      const s = G.save.settings;
      this._was = s.brightness;
      const sl = $("bcal-slider");
      sl.min = B().min; sl.max = B().max; sl.step = B().step;
      sl.value = s.brightness;
      if (!this._bound) {
        this._bound = true;
        sl.addEventListener("input", () => this.set(parseFloat(sl.value)));
        $("btn-bcal-ok").onclick = () => this.ok();
        $("btn-bcal-reset").onclick = () => { this.set(B().default); sl.value = B().default; };
      }
      this.hint();
      $("brightness-cal").classList.remove("hidden");
      G.Modal.open("brightness", { keys: (e) => this.key(e) });
      this.set(s.brightness);
      setTimeout(() => { if (G.Input.mode !== "touch") sl.focus({ preventScroll: true }); }, 0);
    },
    hint() {
      const pad = G.Input && G.Input.padActive, touch = G.Input && G.Input.mode === "touch";
      $("bcal-hint").textContent = T(pad ? "bcal.hintPad" : touch ? "bcal.hintTouch" : "bcal.hintKeys");
    },
    key(e) {
      const sl = $("bcal-slider");
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Escape") {
        if (e.preventDefault) e.preventDefault();
        // (Enter on Default is Default)
        if (e.code !== "Escape" && document.activeElement && document.activeElement.id === "btn-bcal-reset") $("btn-bcal-reset").click();
        else this.ok();
        return true;
      }
      if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && document.activeElement !== sl) {
        if (e.preventDefault) e.preventDefault();
        const v = Math.min(B().max, Math.max(B().min, parseFloat(sl.value) + (e.code === "ArrowRight" ? B().step : -B().step)));
        sl.value = v; this.set(v);
        return true;
      }
      return false;
    },
    set(v) {
      const s = G.save.settings;
      s.brightness = Math.round(v * 100) / 100;
      if (G.Visuals && G.Visuals.ready) G.Visuals.applyGrade(G.Visuals.theme);
      const sl = $("bcal-slider");
      sl.style.setProperty("--p", Math.round((s.brightness - B().min) / (B().max - B().min) * 100) + "%");
      $("bcal-v").textContent = Math.round(s.brightness * 100) + "%";
      this.draw();
    },
    ok() {
      const s = G.save.settings;
      s.brightnessSet = true;
      G.persist();
      $("brightness-cal").classList.add("hidden");
      G.Modal.close("brightness");
      if (this.from === "settings" && G.SettingsUI && G.UI._currentScreen === "screen-settings") G.SettingsUI.render();
    },
    // The symbols' brightness in the scene: just above, a little above and well
    // above the night's darkest colour at the default Brightness. Worked out
    // through the film itself (the darkest tones fold into that navy, so fixed
    // levels went unseen at any setting) -- and so still right after the grade
    // in js/visual-config.js changes
    levels() {
      const VZ = G.Visuals, s = G.save.settings;
      const br = Number.isFinite(s.brightness) ? s.brightness : B().default;
      const e0 = VZ && VZ.ready ? VZ.gradeFor("school").exposure / br * B().default : 1;
      const key = e0.toFixed(4) + (s.visibilityBoost ? "b" : "");
      if (this._lv && this._lvKey === key) return this._lv;
      const L = (v) => {
        const d = VZ && VZ.ready ? VZ.toDisplay([v * 0.9, v, v * 1.15], "school", { exposure: e0 }) : [v * 0.9, v, v * 1.15];
        return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) * 255;
      };
      const L0 = L(0);
      this._lv = B().calibration.map((step) => {
        let a = 0, b = 1;
        for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (L(m) - L0 >= step) b = m; else a = m; }
        return b;
      });
      this._lvKey = key;
      return this._lv;
    },
    // the three symbols: a zombie's head, on the darkest colour the night has
    draw() {
      const cv = $("bcal-canvas");
      if (!cv) return;
      const c = cv.getContext("2d"), W = cv.width, H = cv.height;
      const show = (rgb) => "rgb(" + rgb.map((x) => Math.round(x * 255)).join(",") + ")";
      const disp = (v) => (G.Visuals && G.Visuals.ready ? G.Visuals.toDisplay(v, "school") : v);
      c.fillStyle = show(disp([0, 0, 0]));
      c.fillRect(0, 0, W, H);
      this.levels().forEach((v, i) => {
        const cx = W * (0.18 + i * 0.32), cy = H * 0.5, r = H * 0.3;
        c.fillStyle = show(disp([v * 0.9, v, v * 1.15]));
        c.beginPath();
        c.moveTo(cx - r, cy - r * 0.8); c.lineTo(cx + r, cy - r * 0.8); c.lineTo(cx + r * 0.9, cy + r); c.lineTo(cx - r * 0.9, cy + r); c.closePath();
        c.fill();
        // the eyes and the mouth: the background showing through
        c.fillStyle = show(disp([0, 0, 0]));
        c.fillRect(cx - r * 0.55, cy - r * 0.3, r * 0.35, r * 0.28);
        c.fillRect(cx + r * 0.2, cy - r * 0.3, r * 0.35, r * 0.28);
        c.fillRect(cx - r * 0.45, cy + r * 0.38, r * 0.9, r * 0.16);
      });
    },
  };
})();
