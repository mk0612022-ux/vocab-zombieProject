// ============================================================
// GAMEPAD: play with a controller, and drive every window with it
// ------------------------------------------------------------
// Standard mapping (Xbox names; PlayStation in brackets):
//   in play    left stick move, right stick look (read in game.js)
//              RT fire, LT aim, A jump, L3 sprint, X reload, Y use,
//              B knife, LB / RB previous / next weapon, View hear the word,
//              Menu pause
//   in windows D-pad or left stick moves between buttons, A presses the one
//              highlighted, B backs out (keeps the loadout, resumes, "Back"),
//              Menu pauses / resumes
// The browser has no events for held gamepad buttons, so the pad is polled
// once a frame from the game loop (G.Pad.poll), and presses are the edges.
// ============================================================
window.G = window.G || {};

G.Pad = {
  B: { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 },
  prev: [],
  navHeld: null, navT: 0,
  focused: null,

  pressed(gp, i) { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.4); },

  poll(dt) {
    const gp = G.Input.pollGamepad();
    if (!gp) { this.release(); return; }
    const B = this.B, now = [];
    for (let i = 0; i < gp.buttons.length; i++) now[i] = this.pressed(gp, i);
    const edge = (i) => now[i] && !this.prev[i];
    const stickMoved = Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) > 0.5 || Math.hypot(gp.axes[2] || 0, gp.axes[3] || 0) > 0.5;
    if (now.some(Boolean) || stickMoved) G.Input.notePadInput();
    const g = G.Game;
    const playing = g && g.playing() && !(G.TouchCfg && G.TouchCfg.editing);
    const I = G.Input;

    if (edge(B.MENU)) G.onPausePress && G.onPausePress();
    if (playing) {
      this.clearFocus();
      I.padFire = now[B.RT];
      if (edge(B.RT)) G.onFirePress && G.onFirePress();
      I.padAim = now[B.LT];
      I.padJump = now[B.A];
      if (edge(B.L3)) I.padSprint = !I.padSprint;
      if (Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) < 0.2) I.padSprint = false;   // stick let go: sprint off
      if (edge(B.X)) g.reload();
      if (edge(B.Y)) g.doInteract();
      if (edge(B.B)) g.switchSlot(0);
      if (edge(B.LB)) G.Loadout.cycle(g, -1);
      if (edge(B.RB)) G.Loadout.cycle(g, 1);
      if (edge(B.VIEW)) g.speakCurrentWord();
    } else {
      this.releaseHeld();
      this.navigate(gp, now, edge, dt);
    }
    this.prev = now;
  },
  releaseHeld() { const I = G.Input; I.padFire = false; I.padAim = false; I.padJump = false; I.padSprint = false; },
  release() { this.releaseHeld(); this.prev = []; },

  // ---------------- window navigation ----------------
  // The part of the page the pad works in: the window on top, else the
  // visible screen.
  scope() {
    const top = G.Modal.top();
    const byModal = { challenge: "hud-challenge-box", boss: "hud-boss-bar", crate: "screen-crate", mystery: "screen-mystery", shop: "screen-shop", inventory: "screen-inventory", update: "update-dialog" };
    if (top && byModal[top.id]) return document.getElementById(byModal[top.id]);
    if (G.TouchCfg && G.TouchCfg.editing) return document.getElementById("touchcfg-panel");
    const cur = G.UI._currentScreen;
    return cur ? document.getElementById(cur) : null;
  },
  focusables(root) {
    if (!root) return [];
    const sel = "button, [role=button], .tab-btn, select, input, [data-pad]";
    return Array.from(root.querySelectorAll(sel)).filter((el) => !el.disabled && el.type !== "file" && el.type !== "hidden" && el.getClientRects().length
      && getComputedStyle(el).visibility !== "hidden" && !el.closest(".hidden"));
  },
  setFocus(el) {
    if (this.focused && this.focused !== el) this.focused.classList.remove("pad-focus");
    this.focused = el;
    if (!el) return;
    el.classList.add("pad-focus");
    if (!el.matches("button, select, input, [tabindex]")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
  clearFocus() { if (this.focused) this.focused.classList.remove("pad-focus"); this.focused = null; },

  navigate(gp, now, edge, dt) {
    const B = this.B;
    // round 4: the lobby carousel moves by cards and tabs, not by buttons
    if (!G.Modal.isOpen() && G.Lobby && G.Lobby.visible()) { this.clearFocus(); G.Lobby.pad(gp, now, edge, dt); return; }
    const root = this.scope();
    const items = this.focusables(root);
    if (!items.length) { this.clearFocus(); return; }
    if (!this.focused || !items.includes(this.focused)) {
      // start on the main action if there is one
      this.setFocus(items.find((el) => el.classList.contains("btn-primary")) || items[0]);
    }
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    let dir = null;
    if (now[B.UP] || ay < -0.6) dir = "up";
    else if (now[B.DOWN] || ay > 0.6) dir = "down";
    else if (now[B.LEFT] || ax < -0.6) dir = "left";
    else if (now[B.RIGHT] || ax > 0.6) dir = "right";
    if (dir !== this.navHeld) { this.navHeld = dir; this.navT = 0; if (dir) this.step(dir, items); }
    else if (dir) {
      this.navT += dt;
      if (this.navT > 0.38) { this.navT = 0.26; this.step(dir, items); }   // held: repeat
    }
    if (edge(B.A)) this.activate(this.focused);
    if (edge(B.B)) this.back(root);
  },
  // a slider or a list box takes left/right itself
  step(dir, items) {
    const el = this.focused;
    if (el && (dir === "left" || dir === "right")) {
      if (el.type === "range") {
        const st = parseFloat(el.step) || 0.05;
        el.value = Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), parseFloat(el.value) + (dir === "right" ? st : -st)));
        el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (el.tagName === "SELECT") {
        el.selectedIndex = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + (dir === "right" ? 1 : -1)));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
    }
    const from = el.getBoundingClientRect();
    const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
    let best = null, bestScore = Infinity;
    for (const o of items) {
      if (o === el) continue;
      const r = o.getBoundingClientRect();
      const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
      const dx = ox - cx, dy = oy - cy;
      const main = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
      if (main <= 2) continue;
      const side = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
      const score = main + side * 2.2;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (best) this.setFocus(best);
  },
  activate(el) {
    if (!el) return;
    if (el.type === "checkbox") { el.checked = !el.checked; el.dispatchEvent(new Event("change", { bubbles: true })); return; }
    if (el.tagName === "INPUT" || el.tagName === "SELECT") { el.focus(); return; }
    el.click();
  },
  back(root) {
    const top = G.Modal.top();
    if (top && top.id === "inventory") { G.Loadout.keep(); return; }
    if (top && top.id === "crate") { G.Game.closeCrateScreen(); return; }
    if (G.Game.state === "PAUSE" && G.UI._currentScreen === "screen-pause") { G.Game.resume(); return; }
    const backBtn = root && root.querySelector("[data-pad-back]:not([disabled]), button[id$='-back']:not([disabled])");
    if (backBtn && backBtn.getClientRects().length) backBtn.click();
  },
};
