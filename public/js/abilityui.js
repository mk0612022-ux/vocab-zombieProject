// ===================================================================
// Abilities on screen (round 3, H3-H4)
// -------------------------------------------------------------------
//   the honeycomb   five large hexagons, all face down; the player picks
//                   one (click, tap, keys 1-5 or the arrows and Enter, a
//                   controller's D-pad and A), it turns over with its
//                   effect, then the other four turn over so the player
//                   sees what else there was. With four abilities held
//                   already (Endless), the new one replaces one of them,
//                   or the player keeps what they have. A G.Modal window
//                   with pause: the game stands still until Continue.
//   the HUD bar     bottom centre: each ability's icon inside its cooldown
//                   ring, the seconds left, and its key (Q F C X, or the
//                   D-pad arrows while a controller is in use); it glows
//                   while its effect lasts
//   touch buttons   the same, as buttons (a group the touch layout editor
//                   can move and resize, "abilities")
//   pause           what each ability held does
// ===================================================================
(function () {
  const esc = (s) => G.escapeHtml(String(s));
  const T = (k, v) => G.T(k, v);
  const AB = () => G.Abilities;
  const DPAD = ["↑", "→", "↓", "←"];
  // the effect that shows an ability is running (for the HUD glow)
  const LIVE = { overdrive: 1, barrier: 1, smoke: 1, decoy: 1, patch: 1, timewarp: 1, glue: 1, flashbang: 0, well: 1, radar: 1, whisper: 1, fifty: 1, lens: 1 };

  // the key (or button) for ability slot i, as the player knows it
  G.abilityKeyLabel = function (i) {
    if (G.Input.padActive) return DPAD[i];
    return G.keyLabel(G.save.settings.keybinds["ability" + (i + 1)]);
  };

  if (!G.UI.ALL_SCREENS.includes("screen-abilities")) G.UI.ALL_SCREENS.push("screen-abilities");

  Object.assign(G.UI, {
    // ---------------- the honeycomb ----------------
    openHive(ids, done) {
      const H = this._hive = { ids: ids.slice(), done, stage: "pick", focus: 0, picked: -1, timers: [] };
      const wrap = this.el("hive");
      this.el("hive-title").textContent = T("hive.title");
      this.el("hive-sub").textContent = T("hive.sub");
      this.el("hive-detail").innerHTML = "";
      this.el("hive-detail").classList.add("hidden");
      this.el("hive-replace").classList.add("hidden");
      this.el("hive-replace").innerHTML = "";
      this.el("btn-hive-continue").classList.add("hidden");
      this.el("hive-hint").classList.remove("hidden");
      wrap.innerHTML = ids.map((id, i) => {
        const d = G.ABILITY_BY_ID[id];
        return `<button class="hex cat-${d.cat}" data-i="${i}" aria-label="${esc(T("hive.hidden", { n: i + 1 }))}" style="animation-delay:${i * 70}ms">
          <span class="hex-back"><span class="hex-q">?</span><span class="hex-num kbd-only">${i + 1}</span></span>
          <span class="hex-face"><span class="hex-ico">${d.icon}</span><span class="hex-name">${esc(AB().name(id))}</span><span class="hex-cd">${esc(T("ability.cdShort", { s: d.cd }))}</span></span>
        </button>`;
      }).join("");
      wrap.querySelectorAll(".hex").forEach((b) => {
        const i = parseInt(b.dataset.i, 10);
        b.onclick = () => { if (H.stage === "pick") this.hivePick(i); else if (H.stage !== "revealing") this.hiveShow(i); };
        b.onmouseenter = () => { if (H.stage === "pick") this.hiveFocus(i); else if (H.stage !== "revealing") this.hiveShow(i); };
        b.onfocus = () => { if (H.stage !== "pick" && H.stage !== "revealing") this.hiveShow(i); };
      });
      this.el("btn-hive-continue").onclick = () => this.hiveClose();
      G.Modal.open("abilities", { pause: true, keys: (e) => this.hiveKey(e) });
      this.showScreen("screen-abilities");
      if (G.Audio.hive) G.Audio.hive("open");
      this.hiveFocus(0, true);
    },
    hiveKey(e) {
      const H = this._hive;
      if (!H) return false;
      const k = e.code, n = /^(?:Digit|Numpad)([0-9])$/.exec(k);
      if (H.stage === "pick") {
        if (n && +n[1] >= 1 && +n[1] <= H.ids.length) { this.hivePick(+n[1] - 1); return true; }
        if (k === "ArrowLeft" || k === "KeyA" || k === "ArrowUp" || k === "KeyW") { this.hiveFocus((H.focus + H.ids.length - 1) % H.ids.length); return true; }
        if (k === "ArrowRight" || k === "KeyD" || k === "ArrowDown" || k === "KeyS") { this.hiveFocus((H.focus + 1) % H.ids.length); return true; }
        if (k === "Enter" || k === "Space") { e.preventDefault && e.preventDefault(); this.hivePick(H.focus); return true; }
        return true;
      }
      if (H.stage === "revealing") { if (k === "Enter" || k === "Space") this.hiveFinishReveal(); return true; }
      if (H.stage === "replace") {
        if (n && +n[1] >= 1 && +n[1] <= AB().slots.length) { this.hiveClose(+n[1] - 1); return true; }
        if (k === "Escape" || (n && n[1] === "0")) { this.hiveClose(null, true); return true; }
        return true;
      }
      // done: Continue
      if (k === "Enter" || k === "Space" || k === "KeyE" || k === "Escape") { this.hiveClose(); return true; }
      if (k === "ArrowLeft" || k === "ArrowRight") { const i = ((H.shown == null ? H.picked : H.shown) + (k === "ArrowLeft" ? H.ids.length - 1 : 1)) % H.ids.length; this.hiveShow(i); return true; }
      return true;
    },
    hiveFocus(i, quiet) {
      const H = this._hive;
      H.focus = i;
      this.el("hive").querySelectorAll(".hex").forEach((b, k) => b.classList.toggle("kfocus", k === i));
      if (!quiet && G.Audio.ctx) G.Audio.tone({ type: "triangle", freq: 620 + i * 40, dur: 0.05, gain: 0.05 });
    },
    // the pick: it turns over with its flash, then the rest one by one
    hivePick(i) {
      const H = this._hive;
      if (!H || H.stage !== "pick") return;
      H.stage = "revealing"; H.picked = i;
      const hexes = Array.from(this.el("hive").querySelectorAll(".hex"));
      hexes.forEach((b) => b.classList.remove("kfocus"));
      hexes[i].classList.add("revealed", "picked");
      hexes[i].setAttribute("aria-label", AB().name(H.ids[i]));
      if (G.Audio.hive) G.Audio.hive("pick");
      this.el("hive-hint").classList.add("hidden");
      this.el("hive-title").textContent = T("hive.revealTitle");
      this.el("hive-sub").textContent = T("hive.revealSub");
      this.hiveShow(i);
      const order = hexes.map((_, k) => k).filter((k) => k !== i);
      order.forEach((k, j) => H.timers.push(setTimeout(() => this.hiveTurn(k), 850 + j * 170)));
      H.timers.push(setTimeout(() => this.hiveFinishReveal(), 850 + order.length * 170 + 250));
    },
    hiveTurn(k) {
      const H = this._hive;
      const b = this.el("hive").querySelector(`.hex[data-i="${k}"]`);
      if (!H || !b || b.classList.contains("revealed")) return;
      b.classList.add("revealed", "other");
      b.setAttribute("aria-label", AB().name(H.ids[k]) + " — " + T("hive.notChosen"));
      if (G.Audio.hive) G.Audio.hive("flip");
    },
    hiveFinishReveal() {
      const H = this._hive;
      if (!H || H.stage !== "revealing") return;
      H.timers.forEach(clearTimeout); H.timers = [];
      H.ids.forEach((_, k) => { if (k !== H.picked) this.hiveTurn(k); });
      const full = AB().slots.length >= AB().MAX;
      if (full) {
        H.stage = "replace";
        const rep = this.el("hive-replace");
        rep.innerHTML = `<div class="hive-full">${esc(T("hive.full"))}</div><div class="hive-slots">${AB().slots.map((s, j) => {
          const d = G.ABILITY_BY_ID[s.id];
          return `<button class="btn hive-slot" data-j="${j}"><span class="kbd-only">${j + 1} · </span>${d.icon} ${esc(T("hive.replace", { name: AB().name(s.id) }))}</button>`;
        }).join("")}<button class="btn" id="btn-hive-keep" data-pad-back>${esc(T("hive.keep"))} <span class="kbd-only">(Esc)</span></button></div>`;
        rep.classList.remove("hidden");
        rep.querySelectorAll(".hive-slot").forEach((b) => { b.onclick = () => this.hiveClose(parseInt(b.dataset.j, 10)); });
        rep.querySelector("#btn-hive-keep").onclick = () => this.hiveClose(null, true);
      } else {
        H.stage = "done";
        this.el("btn-hive-continue").classList.remove("hidden");
        if (G.Input.mode !== "touch") setTimeout(() => { const b = this.el("btn-hive-continue"); if (b && this._hive === H) b.focus({ preventScroll: true }); }, 0);
      }
    },
    // the detail under the honeycomb: the one chosen, or another one looked at
    hiveShow(i) {
      const H = this._hive;
      if (!H) return;
      H.shown = i;
      const id = H.ids[i], d = G.ABILITY_BY_ID[id], mine = i === H.picked;
      const slot = mine ? Math.min(AB().slots.length, AB().MAX - 1) : -1;
      const how = !mine ? T("hive.notChosen")
        : G.Input.mode === "touch" ? T("hive.useTouch")
          : G.Input.padActive ? T("hive.usePad", { k: DPAD[slot] })
            : T("hive.useKey", { k: G.keyLabel(G.save.settings.keybinds["ability" + (slot + 1)]) });
      const box = this.el("hive-detail");
      box.className = "hive-detail cat-" + d.cat + (mine ? " mine" : " other");
      box.innerHTML = `<div class="hd-ico">${d.icon}</div><div class="hd-text">
        <div class="hd-name">${esc(AB().name(id))} <span class="hd-cat">${esc(T("ability.cat." + d.cat))}</span></div>
        <div class="hd-desc">${esc(AB().desc(id))}</div>
        <div class="hd-meta"><span>${esc(T("ability.cd", { s: d.cd }))}</span>${d.dur ? `<span>${esc(T("ability.dur", { s: d.dur }))}</span>` : ""}<span class="hd-how">${esc(how)}</span></div></div>`;
      box.classList.remove("hidden");
      this.el("hive").querySelectorAll(".hex").forEach((b, k) => b.classList.toggle("shown", k === i && H.stage !== "revealing"));
    },
    // Continue (or a slot to replace, or keep what is held)
    hiveClose(replaceIdx, keep) {
      const H = this._hive;
      if (!H || !G.Modal.isOpen("abilities")) return;
      if (H.stage === "revealing") { this.hiveFinishReveal(); return; }
      if (H.stage === "pick") return;
      H.timers.forEach(clearTimeout);
      this._hive = null;
      const id = keep ? null : H.ids[H.picked];
      this.showScreen(null);
      // (the callback opens the shop first, so the mouse is not re-locked
      // for a moment in between)
      try { H.done(id, replaceIdx == null ? null : replaceIdx); } finally { G.Modal.close("abilities"); }
    },

    // ---------------- the HUD bar and the touch buttons ----------------
    updateAbilityBar(game, force) {
      const A = AB(), slots = A.slots, kb = G.save.settings.keybinds;
      const pad = !!G.Input.padActive;
      const sig = slots.map((s) => s.id).join(",") + "|" + pad + "|" + [1, 2, 3, 4].map((i) => kb["ability" + i]).join(",");
      const bar = this.el("hud-abilities");
      if (!bar) return;
      if (force || sig !== this._abSig) {
        this._abSig = sig;
        bar.classList.toggle("hidden", !slots.length);
        bar.innerHTML = slots.map((s, i) => {
          const d = G.ABILITY_BY_ID[s.id];
          return `<div class="hab cat-${d.cat}" data-i="${i}" title="${esc(A.name(s.id))}"><span class="hab-ring"></span><span class="hab-ico">${d.icon}</span><span class="hab-cd"></span><span class="hab-key">${esc(G.abilityKeyLabel(i))}</span></div>`;
        }).join("");
        this._abEls = Array.from(bar.querySelectorAll(".hab"));
        this._abLast = [];
        if (!(G.TouchCfg && G.TouchCfg.editing)) this.refreshTouchAbilities(false);
      }
      const touch = this._touchAbEls || [];
      slots.forEach((s, i) => {
        const d = G.ABILITY_BY_ID[s.id];
        const p = s.cd > 0 ? Math.round(s.cd / d.cd * 100) / 100 : 0;
        const sec = s.cd > 0 ? Math.ceil(s.cd) : 0;
        const live = !!LIVE[s.id] && A.fx[s.id] > 0;
        const key = p + ":" + sec + ":" + live;
        if (this._abLast[i] === key) return;
        this._abLast[i] = key;
        [this._abEls[i], touch[i]].forEach((el) => {
          if (!el) return;
          el.style.setProperty("--p", p);
          el.classList.toggle("cooling", sec > 0);
          el.classList.toggle("live", live);
          const c = el.querySelector(".hab-cd, .tab-cd");
          if (c) c.textContent = sec ? sec : "";
        });
      });
    },
    // the touch buttons: one per ability held (all four, as a sample, while
    // the layout editor is open)
    refreshTouchAbilities(sample) {
      const wrap = this.el("touch-abilities");
      if (!wrap) return;
      const ids = sample ? G.ABILITIES.slice(0, 4).map((a) => a.id) : AB().slots.map((s) => s.id);
      wrap.innerHTML = ids.map((id, i) => {
        const d = G.ABILITY_BY_ID[id];
        return `<button class="touch-ab cat-${d.cat}" data-ab="${i}" aria-label="${esc(AB().name(id))}"><span class="hab-ring"></span><span class="tab-ico">${d.icon}</span><span class="tab-cd"></span></button>`;
      }).join("");
      wrap.classList.toggle("empty", !ids.length);
      this._touchAbEls = sample ? [] : Array.from(wrap.querySelectorAll(".touch-ab"));
      this._abLast = [];
      if (G.TouchCfg && wrap.getClientRects().length) G.TouchCfg.apply();
    },
    // used (a flash) or refused (a shake: still cooling down)
    pulseAbility(i, denied) {
      [this._abEls && this._abEls[i], this._touchAbEls && this._touchAbEls[i]].forEach((el) => {
        if (!el) return;
        el.classList.remove("used", "denied"); void el.offsetWidth;
        el.classList.add(denied ? "denied" : "used");
      });
    },
    // "No target in sight", above the bar
    flashAbilityNote(text) {
      const el = this.el("hud-ability-note");
      if (!el) return;
      el.textContent = text;
      el.classList.remove("hidden", "showing"); void el.offsetWidth;
      el.classList.add("showing");
      clearTimeout(this._abNoteT);
      this._abNoteT = setTimeout(() => el.classList.add("hidden"), 1400);
    },

    // ---------------- the pause screen ----------------
    renderPauseAbilities() {
      const box = this.el("pause-abilities");
      if (!box) return;
      const slots = AB().slots;
      if (!slots.length) { box.innerHTML = `<h4>${esc(T("pause.abilities"))}</h4><div class="pause-perk-detail">${esc(T("pause.noAbilities"))}</div>`; return; }
      box.innerHTML = `<h4>${esc(T("pause.abilities"))}</h4><div class="pause-perk-icons">${slots.map((s, i) => {
        const d = G.ABILITY_BY_ID[s.id];
        return `<button class="pause-perk pause-ab cat-${d.cat}" data-id="${s.id}" data-i="${i}" data-tip="${esc(AB().name(s.id))}" aria-label="${esc(AB().name(s.id))}"><span class="pp-ico">${d.icon}</span><span class="icon-label">${esc(G.abilityKeyLabel(i))}</span></button>`;
      }).join("")}</div><div class="pause-perk-detail" id="pause-ab-detail">${esc(T("pause.abilityHint"))}</div>`;
      const detail = box.querySelector("#pause-ab-detail");
      const show = (b) => {
        const id = b.dataset.id, d = G.ABILITY_BY_ID[id];
        box.querySelectorAll(".pause-ab").forEach((x) => x.classList.toggle("sel", x === b));
        detail.innerHTML = `<b>${d.icon} ${esc(AB().name(id))}</b> <span class="pp-lvl">${esc(T("ability.cd", { s: d.cd }))}</span><br>${esc(AB().desc(id))}`;
      };
      box.querySelectorAll(".pause-ab").forEach((b) => { b.onmouseenter = () => show(b); b.onfocus = () => show(b); b.onclick = () => show(b); });
    },
  });

  // a touch on an ability button (the element is in the page from the start)
  window.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("touch-abilities");
    if (!wrap) return;
    wrap.addEventListener("touchstart", (e) => {
      const b = e.target.closest("[data-ab]");
      if (!b) return;
      e.preventDefault();
      b.classList.add("pressed");
      if (G.touchFeedback) G.touchFeedback(b);
      G.onAbilityPress(parseInt(b.dataset.ab, 10));
    }, { passive: false });
    const up = (e) => { const b = e.target.closest && e.target.closest("[data-ab]"); if (b) b.classList.remove("pressed"); };
    wrap.addEventListener("touchend", up);
    wrap.addEventListener("touchcancel", up);
  });
})();
