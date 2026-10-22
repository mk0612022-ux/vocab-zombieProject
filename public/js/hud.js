// ===================================================================
// The HUD (overhaul, round 6) -- bottom centre, the way a block game does it
// -------------------------------------------------------------------
//   Savings 120$        (perks)        ★ 527
//   [██████ 100% ██████]  [███ stamina ███]
//   [Knife][Pistol][Slot 2][Slot 3][Slot 4]   ┌ Pistol   LIGHT ┐
//                                             │ 12/48           │
//                                             │ Mission 1/7     │
//                                             │ Floor 3         │
//                                             └ Keys 0/3        ┘
// and over the word to find, a header: the level, the wave, the zombies left.
//
// Everything is read from the snapshot G.Game.buildHudState() makes each
// frame (js/game.js) and written to the page only when it changes; the bars
// move by transform, the bumps are transform and opacity. A new run, a
// restart or Game Over: reset() forgets every value shown, so nothing of the
// last run can stay on screen.
//
// Layout (fit(), on a resize, a new slot, another language or input):
//   wide     abilities, then the three rows, then the panel, in one line
//   narrow   (a narrow screen, or between the thumbs on a touch screen) the
//            panel sits over the right end of the slot row
//   lifted   (touch, no room between the thumbs: a phone held upright) the
//            whole HUD over the touch buttons, the width of the screen
// On touch the slots are the weapon buttons (a tap switches); the touch
// layout editor shows the HUD's box and keeps every button off it
// (G.TouchCfg.keepClear). --dock-h / --dock-b tell the rest of the page where
// the HUD's top is, so prompts, the spelling bar and the touch ability row
// stay above it.
// ===================================================================
window.G = window.G || {};

G.Hud = (function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));

  // what is on the page now: a value is written only when it differs
  let shown = {};
  function text(el, key, v) { if (shown[key] === v) return false; shown[key] = v; el.textContent = v; return true; }
  function flag(el, key, name, on) { on = !!on; const k = key + "." + name; if (shown[k] === on) return; shown[k] = on; el.classList.toggle(name, on); }
  function prop(el, key, name, v) { const k = key + "." + name; if (shown[k] === v) return; shown[k] = v; el.style.setProperty(name, v); }
  // a short bump when a number changes (transform and opacity only)
  function bump(el) { if (el.animate && !G.save.settings.reduceMotion) el.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 160, easing: "ease-out" }); }

  const Hud = {
    // ---------------- the slot row ----------------
    // cells: { kind: "knife" | "gun" | "empty", id, name, color, key, active }
    slotRowHTML(cells, opts) {
      opts = opts || {};
      return cells.map((c, i) => {
        const k = ["hud-slot", c.kind, c.active ? "active" : "", opts.replace === i ? "replace" : ""].filter(Boolean).join(" ");
        const name = c.kind === "empty" ? T("hud.slotEmpty", { n: i }) : c.name;
        return `<div class="${k}" data-slot="${i}"${c.color ? ` style="--rc:${c.color}"` : ""}>` +
          `<span class="hsl-key">${esc(c.key || "")}</span><span class="hsl-name">${esc(name)}</span><i class="hsl-rar" aria-hidden="true"></i></div>`;
      }).join("");
    },
    // the knife, every gun held, then the free slots (from the game's state)
    cellsOf(game) {
      const pl = game.player, kb = G.save.settings.keybinds;
      // (the knife and the starting pistol by short names in the language of the
      // menus -- "Knife", "Pistol"; every other gun by its own name)
      const cells = [{ kind: "knife", id: "melee", name: T("hud.slotKnife"), key: G.keyLabel(kb.melee), active: pl.currentSlot === 0 }];
      pl.gunSlots.forEach((id, i) => {
        const d = G.WEAPON_DEFS[id], r = d && G.RARITY[d.rarity];
        cells.push({ kind: "gun", id, name: id === "pistol" ? T("hud.slotPistol") : d ? d.name : id, color: r ? "#" + r.color.toString(16).padStart(6, "0") : null, key: G.keyLabel(kb["slot" + (i + 2)]), active: pl.currentSlot === i + 1 });
      });
      for (let i = pl.gunSlots.length; i < G.Loadout.maxSlots(game); i++) cells.push({ kind: "empty", key: G.keyLabel(kb["slot" + (i + 2)]), active: false });
      return cells;
    },

    // ---------------- every frame ----------------
    update(p) {
      if (!this.built) this.init();
      const touch = document.body.classList.contains("touch-mode");
      if (this.syncAb(touch)) this.refit();
      // the header over the word
      const H = p.head || {};
      text($("hud-level-name"), "lvl", H.level || "");
      text($("hud-level-wave"), "wave", H.wave || "");
      text($("hud-zombies-left"), "left", H.left || "");
      flag($("hud-head"), "head", "boss", H.boss);
      flag($("hud-head"), "head", "hidden", !(H.level || H.wave || H.left));
      // money and score
      if (text($("hud-money"), "money", p.money + "$") && shown._run) bump($("hud-money"));
      if (text($("hud-score"), "score", String(p.score)) && shown._run) bump($("hud-score"));
      // health: the number exact (0% only when dead), the bar eased, a pale
      // chip that follows a hit down a moment later
      const hpPct = p.dead ? 0 : Math.max(1, Math.ceil(p.hp - 1e-9));
      const hp = $("hud-hp");
      text($("hud-hp-text"), "hpt", hpPct + "%");
      if (shown.hpv !== hpPct) { hp.setAttribute("aria-valuenow", hpPct); }
      const f = Math.max(0, Math.min(1, p.hp / 100)).toFixed(3);
      if (shown.hpf !== f) {
        const up = shown.hpf != null && +f > +shown.hpf;
        flag(hp, "hp", "rise", up);
        shown.hpf = f;
        hp.style.setProperty("--f", f);
      }
      shown.hpv = hpPct;
      flag(hp, "hp", "low", p.hp > 0 && p.hp < 30);
      flag(hp, "hp", "regen", p.regenerating);
      // stamina; spent: grey until it is back
      const st = $("hud-stam");
      prop(st, "st", "--f", Math.max(0, Math.min(1, p.stamina / 100)).toFixed(3));
      flag(st, "st", "out", p.staminaExhausted);
      // the slots
      const sig = JSON.stringify(p.cells) + "|" + touch;
      if (sig !== shown.slots) {
        shown.slots = sig;
        $("hud-slots").innerHTML = this.slotRowHTML(p.cells || []);
        if (shown.ncells !== (p.cells || []).length) { shown.ncells = (p.cells || []).length; this.refit(); }
      }
      // what is in hand
      const W = p.hand || {};
      text($("hud-weapon-name"), "wn", W.name || "");
      text($("hud-weapon-status"), "ws", W.status || "");
      const am = $("hud-ammo");
      text(am, "am", W.melee ? "—" : W.mag + "/" + W.reserve);
      const empty = !W.melee && W.mag === 0, low = !W.melee && !empty && W.mag <= W.lowAt;
      flag(am, "am", "low", low);
      flag(am, "am", "empty", empty);
      const note = $("hud-ammo-note");
      const nt = empty && !W.reloading ? T(W.reserve > 0 ? "hud.reloadNow" : "hud.noAmmo") : "";
      text(note, "nt", nt);
      flag(note, "nt", "hidden", !nt);
      const rf = W.reloading ? (Math.round(W.reloadFrac * 50) / 50).toFixed(2) : "0";
      prop($("hud-reload"), "rl", "--f", rf);
      flag($("hud-reload"), "rl", "on", !!W.reloading);
      // the level's tasks
      const ms = $("hud-objectives");
      text(ms, "ms", p.mission ? T("hud.mission", { d: p.mission.d, n: p.mission.n }) : "");
      flag(ms, "ms", "hidden", !p.mission);
      flag(ms, "ms", "done", p.mission && p.mission.d === p.mission.n);
      const fl = $("hud-floor");
      text(fl, "fl", p.floor ? T("hud.floor", { n: p.floor }) : "");
      flag(fl, "fl", "hidden", !p.floor);
      const tk = $("hud-task");
      text(tk, "tk", p.task ? p.task.label + " " + p.task.value : "");
      flag(tk, "tk", "hidden", !p.task);
      shown._run = true;
    },

    // forget what is drawn (keys rebound, another language): the next frame writes it all again
    invalidate() { shown = {}; },
    // a new run, a restart, Game Over: nothing of the last one stays
    reset() {
      shown = {};
      if (!this.built) return;
      ["hud-weapon-name", "hud-weapon-status", "hud-ammo", "hud-ammo-note", "hud-objectives", "hud-floor", "hud-task", "hud-level-name", "hud-level-wave", "hud-zombies-left"].forEach((id) => { const e = $(id); if (e) e.textContent = ""; });
      $("hud-slots").innerHTML = "";
      ["hud-objectives", "hud-floor", "hud-task", "hud-ammo-note"].forEach((id) => $(id).classList.add("hidden"));
      $("hud-reload").classList.remove("on");
      this.refit();
    },

    // ---------------- where it goes ----------------
    init() {
      if (this.built) return;
      this.built = true;
      const dock = $("hud-dock");
      // the page's other parts keep above the HUD
      if (window.ResizeObserver) new ResizeObserver(() => this.publish()).observe(dock);
      window.addEventListener("resize", () => this.refit());
      // touch: a slot is a weapon button
      $("hud-slots").addEventListener("touchstart", (e) => {
        if (!document.body.classList.contains("touch-mode")) return;
        const c = e.target.closest(".hud-slot");
        if (!c || c.classList.contains("empty")) return;
        e.preventDefault();
        if (G.touchFeedback) G.touchFeedback(c);
        if (G.onSlotPress) G.onSlotPress(parseInt(c.dataset.slot, 10));
      }, { passive: false });
    },
    refit() { clearTimeout(this._fitT); this._fitT = setTimeout(() => this.fit(), 30); },
    // the abilities' column only while there are some (keyboard and
    // controller); fit() asks too, so a paused game's HUD is laid out right
    syncAb(touch) {
      const noAb = touch || $("hud-abilities").classList.contains("hidden");
      if (shown.noAb === noAb) return false;
      flag($("hud-dock"), "dock", "no-ab", noAb); shown.noAb = noAb;
      return true;
    },
    // the controls a thumb holds at the bottom of a touch screen, where the
    // stylesheet puts them (the pause chip and the ability row are not among
    // them; a button the player has moved is kept off the HUD instead --
    // G.TouchCfg.keepClear)
    thumbRects() {
      if (!document.body.classList.contains("touch-mode") || !G.TouchCfg) return [];
      const H = window.innerHeight, moved = G.TouchCfg.cfg().pos;
      return ["joystick", "fire", "ads", "interact", "reload", "jump", "sprint"].filter((id) => !moved[id]).map((id) => {
        const el = G.TouchCfg.el(id);
        const r = el && el.getClientRects().length ? el.getBoundingClientRect() : null;
        return r && r.width > 1 && r.top > H * 0.35 ? r : null;
      }).filter(Boolean);
    },
    fit() {
      const dock = $("hud-dock"), hud = $("hud");
      if (!dock || !hud || hud.classList.contains("hidden")) return;
      const W = window.innerWidth, Hh = window.innerHeight, I = G.HudCfg ? G.HudCfg.insets() : { l: 0, r: 0, b: 0 };
      const touch = document.body.classList.contains("touch-mode");
      let l = I.l + 16, r = I.r + 16, b = I.b + 14, lifted = false;
      if (touch && !this._frozen) {
        // between the thumbs: the room the buttons leave
        const rects = this.thumbRects();
        rects.forEach((q) => { if (q.left + q.width / 2 < W / 2) l = Math.max(l, q.right + 10); else r = Math.max(r, W - q.left + 10); });
        if (W - l - r < 290) {
          // no room: over the buttons, the width of the screen
          lifted = true;
          l = I.l + 10; r = I.r + 10;
          b = rects.length ? Math.max(b, Hh - Math.min(...rects.map((q) => q.top)) + 8) : b;
        }
      }
      if (this._frozen) return this.publish();
      dock.style.left = l + "px"; dock.style.right = r + "px"; dock.style.bottom = b + "px";
      dock.classList.toggle("lifted", lifted);
      this.syncAb(touch);
      // wide if all of it fits in a line, else the panel over the slots
      dock.classList.remove("narrow");
      const fits = dock.scrollWidth <= dock.clientWidth + 1 && dock.getBoundingClientRect().width <= W - l - r + 1;
      dock.classList.toggle("narrow", touch || !fits);
      this.publish();
      if (touch && G.TouchCfg && G.TouchCfg.keepClear) G.TouchCfg.keepClear(this.zone());
    },
    // the box the HUD takes (the touch editor shows it; nothing may sit on it)
    zone() {
      const d = $("hud-dock");
      if (!d || !d.getClientRects().length) return null;
      const r = d.getBoundingClientRect();
      return { left: r.left - 4, top: r.top - 4, right: r.right + 4, bottom: r.bottom + 4, width: r.width + 8, height: r.height + 8 };
    },
    // the HUD's height and its gap to the bottom, for the rest of the page
    publish() {
      const d = $("hud-dock");
      if (!d || !d.getClientRects().length) return;
      const r = d.getBoundingClientRect(), root = document.documentElement.style;
      const h = Math.round(r.height) + "px", b = Math.round(window.innerHeight - r.bottom) + "px";
      if (shown._dh !== h) { shown._dh = h; root.setProperty("--dock-h", h); }
      if (shown._db !== b) { shown._db = b; root.setProperty("--dock-b", b); }
    },
    // (the touch layout editor: the HUD stays put while a button is dragged)
    freeze(on) { this._frozen = !!on; if (!on) this.fit(); },
  };
  return Hud;
})();
