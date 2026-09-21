// ============================================================
// CORE: utils, save system, word-stats, input manager
// ============================================================
window.G = window.G || {};

// ---------------- Seeded RNG (mulberry32) ----------------
G.makeRng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
G.rng = Math.random; // default; swapped for seeded daily-challenge runs
G.dateSeed = function (d) {
  d = d || new Date();
  const s = `${d.getFullYear()}${d.getMonth()}${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
};
G.pick = function (arr) { return arr[Math.floor(G.rng() * arr.length)]; };
G.randRange = function (min, max) { return min + G.rng() * (max - min); };
G.shuffle = function (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(G.rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------- Save system ----------------
const SAVE_KEY = "vocabZombie_save_v1";

G.defaultSave = function () {
  return {
    unlockedLevels: [1],
    levelHighScores: {},          // {levelId: score}
    dailyHighScores: {},          // {"YYYY-M-D": score}
    endlessHighScore: 0,
    endlessHighWave: 0,
    leaderboards: { level1: [], level2: [], level3: [], daily: [], endless: [] },
    wordStats: {},                // {word: {correct, wrong, lastCorrect}}
    achievements: {},             // {id: true}
    unlockedWeapons: ["pistol"],
    settings: {
      controlMode: "auto",        // auto | desktop | touch
      fpsCap: 60,
      showFpsCounter: false,
      graphicsQuality: "medium",  // vlow | low | medium | high | vhigh
      gameSpeed: 1,
      fontSize: "medium",         // small | medium | large
      colorblindMode: false,
      mouseSensitivity: 1,
      keybinds: G.defaultKeybinds ? G.defaultKeybinds() : {},
      musicVolume: 0.6,
      sfxVolume: 0.8,
    },
    importedSets: {},             // {id: {name, words:[[en,th],...]}}
  };
};

G.save = null;

G.loadSave = function () {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { G.save = G.defaultSave(); return G.save; }
    const parsed = JSON.parse(raw);
    // merge with defaults to survive schema additions
    const def = G.defaultSave();
    G.save = Object.assign({}, def, parsed);
    G.save.settings = Object.assign({}, def.settings, parsed.settings || {});
    G.save.settings.keybinds = Object.assign({}, def.settings.keybinds, (parsed.settings || {}).keybinds || {});
    G.save.leaderboards = Object.assign({}, def.leaderboards, parsed.leaderboards || {});
  } catch (e) {
    console.warn("Save load failed, using default", e);
    G.save = G.defaultSave();
  }
  return G.save;
};

G.persist = function () {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); }
  catch (e) { console.warn("Save failed", e); }
};

G.exportSave = function () {
  const blob = new Blob([JSON.stringify(G.save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "vocab-zombie-save.json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

G.importSaveFromFile = function (file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const def = G.defaultSave();
      G.save = Object.assign({}, def, data);
      G.save.settings = Object.assign({}, def.settings, data.settings || {});
      G.persist();
      cb && cb(true);
    } catch (e) { cb && cb(false, e); }
  };
  reader.readAsText(file);
};

// ---------------- Word stats (long-term memory tracking) ----------------
G.recordWordResult = function (word, correct) {
  const w = word.toLowerCase();
  const stats = G.save.wordStats[w] || { correct: 0, wrong: 0, lastCorrect: 0 };
  if (correct) { stats.correct++; stats.lastCorrect = Date.now(); }
  else { stats.wrong++; }
  G.save.wordStats[w] = stats;
};

// mastery score: higher = better known. Used to weight sampling (weak words appear more often)
G.wordWeight = function (word) {
  const s = G.save.wordStats[word.toLowerCase()];
  if (!s) return 3; // unseen words get medium-high priority
  const total = s.correct + s.wrong;
  if (total === 0) return 3;
  const accuracy = s.correct / total;
  // weight inversely with accuracy; floor so mastered words still occasionally appear
  return Math.max(0.5, 4 * (1 - accuracy) + 0.5);
};

G.isWordMastered = function (word) {
  const s = G.save.wordStats[word.toLowerCase()];
  if (!s) return false;
  const total = s.correct + s.wrong;
  return total >= 3 && s.correct / total >= 0.75;
};

G.weightedSample = function (wordPairs, n) {
  // wordPairs: [[en, th], ...]. Returns n unique pairs, weak words weighted higher.
  const pool = wordPairs.slice();
  const chosen = [];
  n = Math.min(n, pool.length);
  for (let k = 0; k < n; k++) {
    const weights = pool.map((p) => G.wordWeight(p[0]));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = G.rng() * total;
    let idx = 0;
    for (; idx < weights.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
    idx = Math.min(idx, pool.length - 1);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
};

// ---------------- Default keybinds ----------------
G.defaultKeybinds = function () {
  return {
    forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
    sprint: "ShiftLeft", jump: "Space", reload: "KeyR", interact: "KeyE",
    melee: "Digit1", slot2: "Digit2", slot3: "Digit3", slot4: "Digit4", slot5: "Digit5",
    pause: "Escape",
  };
};

// ---------------- Input Manager (keyboard/mouse/touch/gamepad) ----------------
// ---------------- Three.js resource cleanup ----------------
// Removing a mesh from the scene does NOT free its GPU-side geometry/material/
// texture buffers. Zombies and drops are created and destroyed constantly
// (especially in Endless mode, which can run for hundreds of kills), so
// without this every kill would leak a handful of buffers -- over a long
// session that degrades performance and can eventually crash the WebGL
// context. Call this on any mesh/group right after removing it from a scene.
G.disposeObject3D = function (obj) {
  if (!obj) return;
  obj.traverse((node) => {
    if (node.isLight) return;
    if (node.geometry) node.geometry.dispose();
    const mats = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
    mats.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  });
};

// Phone/tablet check used for the default graphics tier and the initial
// control scheme. A coarse pointer with no hover is the reliable signal --
// an iPad in landscape is wider than plenty of laptops.
G.isHandheld = function () {
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
  const touchPoints = (navigator.maxTouchPoints || 0) > 1;
  return !!((coarse && noHover) || (touchPoints && window.innerWidth < 1400));
};

G.Input = {
  keys: {},
  mouseDelta: { x: 0, y: 0 },
  mouseDown: false,
  aimDown: false, // right mouse button held -- ADS (category H)
  pointerLocked: false,
  mode: "desktop", // desktop | touch
  touchMove: { x: 0, y: 0, active: false },
  touchLook: { x: 0, y: 0, active: false },
  touchFire: false,
  touchInteract: false,
  touchReload: false,
  touchJump: false,
  touchSprint: false,
  gamepadIndex: null,
  rebindingAction: null,

  init() {
    window.addEventListener("keydown", (e) => {
      this._noteDesktopInput();
      this.keys[e.code] = true;
      if (this.rebindingAction) {
        const action = this.rebindingAction;
        const kb = G.save.settings.keybinds;
        // Swap with whatever action currently owns this key instead of letting
        // two actions silently share one key (which made both fire together).
        const conflictingAction = Object.keys(kb).find((a) => a !== action && kb[a] === e.code);
        if (conflictingAction) kb[conflictingAction] = kb[action];
        kb[action] = e.code;
        G.persist();
        this.rebindingAction = null;
        G.UI.refreshSettingsScreen && G.UI.refreshSettingsScreen();
        e.preventDefault();
        return;
      }
      G.onKeyDown && G.onKeyDown(e);
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; G.onKeyUp && G.onKeyUp(e); });

    document.addEventListener("mousemove", (e) => {
      if (this.pointerLocked) {
        const sens = (G.save && G.save.settings.mouseSensitivity) || 1;
        this.mouseDelta.x += e.movementX * sens;
        this.mouseDelta.y += e.movementY * sens;
      }
    });
    document.addEventListener("mousedown", (e) => {
      this._noteDesktopInput();
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.aimDown = true;
      G.onMouseDown && G.onMouseDown(e);
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.aimDown = false;
    });
    // Right-click drives ADS (category H) instead of the browser context menu.
    document.getElementById("gameCanvas").addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === document.getElementById("gameCanvas");
      // Losing the lock (Escape, alt-tab, a popup opening) never delivers a
      // mouseup, so without this a button held at that moment would stay
      // "stuck" down (firing or aiming forever) once control returns.
      if (!this.pointerLocked) { this.mouseDown = false; this.aimDown = false; }
    });

    window.addEventListener("touchstart", () => this._noteTouchInput(), { passive: true });

    window.addEventListener("gamepadconnected", (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener("gamepaddisconnected", () => { this.gamepadIndex = null; });

    this._setupTouchControls();
  },

  _noteDesktopInput() {
    if (G.save.settings.controlMode === "auto") this.mode = "desktop";
    else this.mode = G.save.settings.controlMode;
    G.UI && G.UI.applyControlMode && G.UI.applyControlMode();
  },
  _noteTouchInput() {
    if (G.save.settings.controlMode === "auto") this.mode = "touch";
    else this.mode = G.save.settings.controlMode;
    G.UI && G.UI.applyControlMode && G.UI.applyControlMode();
  },

  isDown(action) {
    const code = G.save.settings.keybinds[action];
    return !!this.keys[code];
  },
  consumeMouseDelta() {
    const d = { x: this.mouseDelta.x, y: this.mouseDelta.y };
    this.mouseDelta.x = 0; this.mouseDelta.y = 0;
    return d;
  },

  requestPointerLock() {
    const el = document.getElementById("gameCanvas");
    if (!el.requestPointerLock) return;
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(() => {}); // some sandboxed/embedded contexts refuse pointer lock; fail silently
    } catch (e) { /* ignore */ }
  },
  exitPointerLock() {
    if (document.exitPointerLock) document.exitPointerLock();
  },

  _setupTouchControls() {
    const joy = document.getElementById("touch-joystick");
    const knob = document.getElementById("touch-joystick-knob");
    let joyId = null, joyCenter = { x: 0, y: 0 };
    joy.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.touchMove.active = true;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - joyCenter.x, dy = t.clientY - joyCenter.y;
          const max = 40;
          const len = Math.hypot(dx, dy) || 1;
          if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.touchMove.x = dx / max; this.touchMove.y = dy / max;
        }
      }
    }, { passive: true });
    window.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null; this.touchMove = { x: 0, y: 0, active: false };
          knob.style.transform = `translate(0,0)`;
        }
      }
    });

    const lookzone = document.getElementById("touch-lookzone");
    let lookId = null, lastLook = { x: 0, y: 0 };
    lookzone.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier; lastLook = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    window.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
          const dx = t.clientX - lastLook.x, dy = t.clientY - lastLook.y;
          lastLook = { x: t.clientX, y: t.clientY };
          const sens = (G.save && G.save.settings.mouseSensitivity) || 1;
          this.mouseDelta.x += dx * 2.2 * sens;
          this.mouseDelta.y += dy * 2.2 * sens;
        }
      }
    }, { passive: true });
    window.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    });

    const bindHold = (id, prop) => {
      const el = document.getElementById(id);
      el.addEventListener("touchstart", (e) => { this[prop] = true; e.preventDefault(); }, { passive: false });
      el.addEventListener("touchend", (e) => { this[prop] = false; e.preventDefault(); }, { passive: false });
    };
    bindHold("touch-fire", "touchFire");
    bindHold("touch-jump", "touchJump");
    bindHold("touch-sprint", "touchSprint");
    // ADS is a hold on desktop (right mouse); on touch it toggles, since you
    // can't comfortably hold a corner button and still aim with the same thumb.
    const adsBtn = document.getElementById("touch-ads");
    adsBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.aimDown = !this.aimDown;
      adsBtn.classList.toggle("active", this.aimDown);
    }, { passive: false });
    // Weapon slots: filled in by G.UI.refreshTouchSlots to match what the
    // player is actually carrying.
    document.getElementById("touch-slots").addEventListener("touchstart", (e) => {
      const btn = e.target.closest("[data-slot]");
      if (!btn) return;
      e.preventDefault();
      G.onSlotPress && G.onSlotPress(parseInt(btn.dataset.slot, 10));
    }, { passive: false });
    document.getElementById("touch-interact").addEventListener("touchstart", (e) => {
      this.touchInteract = true; e.preventDefault();
      G.onInteractPress && G.onInteractPress();
      setTimeout(() => (this.touchInteract = false), 100);
    }, { passive: false });
    document.getElementById("touch-reload").addEventListener("touchstart", (e) => {
      e.preventDefault();
      G.onReloadPress && G.onReloadPress();
    }, { passive: false });
  },

  pollGamepad() {
    if (this.gamepadIndex === null) return null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads[this.gamepadIndex] || null;
  },
};
