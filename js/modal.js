// ===================================================================
// Modal windows: one place for pointer lock, pausing and hotkeys
// -------------------------------------------------------------------
// Every window the player has to click or answer goes through open() and
// close() here, so none of them can forget a step again. The boss question
// panel did: it never released pointer lock (no cursor to click with), its
// answers had no click handler, and it sat in a layer that ignores the mouse
// -- keys 1-4 were the only way to answer it, and on a touch screen there was
// none at all.
//
// open(id, opts)
//   frees the mouse (exits pointer lock) and drops held inputs (fire, move),
//   marks the page as modal-open (CSS: cursor shown, answer buttons clickable,
//   touch controls out of the way, COMBO and tutorial cards hidden), and
//   either
//     freeze: the world stops (zombies, spawns, traps, the player) while the
//             window's own timer keeps running -- word questions
//     pause:  everything stops -- crate reveal, mystery box, shop
//   keys: a handler for the window's own keys (1-4 to answer, Enter to
//   confirm). While any window is open, gameplay hotkeys (weapon slots,
//   reload, interact, fire) are ignored, so 1-4 can never switch weapons.
//
// close(id)
//   when the last window closes and the game is being played, pointer lock is
//   requested straight away. Browsers only grant that during a click or key
//   press, which is where close() is called from; if it is refused (a timer
//   ran out, no gesture), G.UI shows "click to continue" until the player
//   clicks the view.
// ===================================================================
G.Modal = {
  stack: [],

  open(id, opts) {
    opts = opts || {};
    if (this.stack.some((m) => m.id === id)) return;
    this.stack.push({ id, freeze: !!opts.freeze, pause: !!opts.pause, keys: opts.keys || null });
    G.Input.clearHeldInputs();
    G.Input.exitPointerLock();
    this._sync();
  },

  close(id) {
    const i = this.stack.findIndex((m) => m.id === id);
    if (i < 0) return;
    this.stack.splice(i, 1);
    this._sync();
    if (!this.stack.length) this.relock();
  },

  // back to mouse-look, if the game is running and nothing else is in the way
  relock() {
    const g = G.Game;
    if (this.stack.length || !g || g.state !== "GAMEPLAY" || g.paused) return;
    if (G.Input.mode === "desktop") G.Input.requestPointerLock();
  },

  isOpen(id) { return id ? this.stack.some((m) => m.id === id) : this.stack.length > 0; },
  freezesWorld() { return this.stack.some((m) => m.freeze); },
  pausesAll() { return this.stack.some((m) => m.pause); },
  top() { return this.stack[this.stack.length - 1] || null; },

  // A key press while a window is open: the window's own keys first; anything
  // else is swallowed (returns true) so it can't reach gameplay.
  handleKey(e) {
    if (e.repeat) return this.stack.length > 0;   // a held key answers once
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const m = this.stack[i];
      if (m.keys && m.keys(e)) return true;
    }
    return this.stack.length > 0;
  },

  reset() { this.stack = []; this._sync(); },

  _sync() {
    const open = this.stack.length > 0;
    document.body.classList.toggle("modal-open", open);
    document.body.classList.toggle("modal-question", this.stack.some((m) => m.freeze));
    const g = G.Game;
    if (g) {
      // the pausing windows reuse the game's overlay pause
      if (typeof g.pauseForOverlay === "function" && g.state !== "PAUSE") g.pauseForOverlay(this.pausesAll());
    }
  },
};

// Digits 1..n pick answer n; used by every multiple-choice window.
G.Modal.digitKeys = function (count, pick) {
  return (e) => {
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (!m) return false;
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= count) { pick(n - 1); return true; }
    return false;
  };
};
