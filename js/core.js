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
      ambientVolume: 0.6,         // category J4
      speechVolume: 0.9,
      speechMode: "after",        // off | after (read the word once answered) | before (read the new target aloud)
    },
    importedSets: {},             // {id: {name, words:[[en,th],...]}}
  };
};

G.save = null;

// One place that turns ANY stored or imported object into a valid save:
// fills in fields added since it was written, and repairs fields of the wrong
// type instead of letting them crash the level select three screens later.
// Load and import both go through here, so they can never disagree.
G.normalizeSave = function (data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not a save object");
  const def = G.defaultSave();
  const s = Object.assign({}, def, data);
  s.settings = Object.assign({}, def.settings, data.settings || {});
  s.settings.keybinds = Object.assign({}, def.settings.keybinds, (data.settings || {}).keybinds || {});
  s.leaderboards = Object.assign({}, def.leaderboards, data.leaderboards || {});
  if (!Array.isArray(s.unlockedLevels)) s.unlockedLevels = [1];
  s.unlockedLevels = s.unlockedLevels.filter((n) => Number.isInteger(n) && n >= 1 && n <= 3);
  if (!s.unlockedLevels.includes(1)) s.unlockedLevels.unshift(1);
  if (!Array.isArray(s.unlockedWeapons)) s.unlockedWeapons = ["pistol"];
  s.unlockedWeapons = s.unlockedWeapons.filter((id) => typeof id === "string");
  ["wordStats", "achievements", "levelHighScores", "dailyHighScores", "importedSets"].forEach((k) => {
    if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = def[k] || {};
  });
  return s;
};

G.loadSave = function () {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    G.save = raw ? G.normalizeSave(JSON.parse(raw)) : G.defaultSave();
  } catch (e) {
    console.warn("Save load failed, using default", e);
    G.save = G.defaultSave();
  }
  return G.save;
};

// Category L: a save that fails to write (Safari private mode, a full quota)
// used to fail silently -- the player found out only when their progress was
// gone. Now the first failure is shown once.
G.persist = function () {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(G.save));
    G._persistFailed = false;
  } catch (e) {
    console.warn("Save failed", e);
    if (!G._persistFailedShown && G.UI && G.UI.flashPurchaseBanner) {
      G._persistFailedShown = true;
      G.UI.flashPurchaseBanner("บันทึกความคืบหน้าไม่ได้", "เบราว์เซอร์ไม่ให้เก็บข้อมูล (โหมดส่วนตัว?) — ใช้ Export Save เก็บไว้เองได้");
    }
    G._persistFailed = true;
  }
};
// Frequent small changes (every answered word) are batched into one write a
// moment later instead of a full JSON write per zombie.
G.persistSoon = function () {
  if (G._persistTimer) return;
  G._persistTimer = setTimeout(() => { G._persistTimer = null; G.persist(); }, 1200);
};
// A phone kills a backgrounded tab without warning; these are the last
// reliable moments to write, so a run's word history survives an app switch.
["pagehide", "beforeunload"].forEach((ev) => window.addEventListener(ev, () => { if (G.save) G.persist(); }));
document.addEventListener("visibilitychange", () => { if (document.hidden && G.save) G.persist(); });

// ---------------- Export / import (category L) ----------------
G.SAVE_FORMAT = "vocab-zombie-save";
G.SAVE_FORMAT_VERSION = 2;

G.saveSummary = function (s) {
  return {
    levels: (s.unlockedLevels || []).length,
    words: Object.keys(s.wordStats || {}).length,
    achievements: Object.keys(s.achievements || {}).filter((k) => s.achievements[k]).length,
    weapons: (s.unlockedWeapons || []).length,
    bestScores: Object.values(s.levelHighScores || {}).filter((v) => v != null).length,
  };
};

G.exportSave = function () {
  G.persist();
  const payload = {
    format: G.SAVE_FORMAT, version: G.SAVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    summary: G.saveSummary(G.save),
    save: G.save,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "vocab-zombie-save-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Reads and VALIDATES a file without touching the current save, so the
// overwrite confirmation can say what is actually in it. Accepts the wrapped
// export format and a bare save from before it existed; rejects anything else
// -- an arbitrary JSON file used to "import successfully" and wipe the save.
G.readSaveFile = function (file, cb) {
  const reader = new FileReader();
  reader.onerror = () => cb(new Error("อ่านไฟล์ไม่ได้"));
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { cb(new Error("ไฟล์นี้ไม่ใช่ JSON")); return; }
    let raw = null, exportedAt = null;
    if (data && data.format === G.SAVE_FORMAT && data.save) { raw = data.save; exportedAt = data.exportedAt || null; }
    else if (data && (Array.isArray(data.unlockedLevels) || (data.wordStats && typeof data.wordStats === "object"))) raw = data;
    if (!raw) { cb(new Error("ไฟล์นี้ไม่ใช่ไฟล์เซฟของ Vocab Zombie")); return; }
    try {
      const save = G.normalizeSave(raw);
      cb(null, { save, exportedAt, summary: G.saveSummary(save) });
    } catch (e) { cb(new Error("ข้อมูลในไฟล์เสียหาย")); }
  };
  reader.readAsText(file);
};

G.applyImportedSave = function (save) {
  G.save = save;
  G.persist();
  // everything that reads settings once at start-up has to be told
  if (G.UI && G.UI.applyFontSizeClass) G.UI.applyFontSizeClass();
  if (G.TouchCfg) G.TouchCfg.apply();
  if (G.Audio) G.Audio.applyVolumes();
  if (G.Input && G.save.settings.controlMode !== "auto") G.Input.mode = G.save.settings.controlMode;
  if (G.UI && G.UI.applyControlMode) G.UI.applyControlMode();
};

// kept for any caller of the old one-step API
G.importSaveFromFile = function (file, cb) {
  G.readSaveFile(file, (err, res) => {
    if (err) { cb && cb(false, err); return; }
    G.applyImportedSave(res.save);
    cb && cb(true);
  });
};

// ---------------- Word stats (long-term memory tracking) ----------------
G.recordWordResult = function (word, correct) {
  const w = word.toLowerCase();
  const stats = G.save.wordStats[w] || { correct: 0, wrong: 0, lastCorrect: 0 };
  if (correct) { stats.correct++; stats.lastCorrect = Date.now(); }
  else { stats.wrong++; }
  G.save.wordStats[w] = stats;
  // Category L: this never saved on its own -- a run.s word history only
  // reached storage at victory or game over, so closing the tab mid-run
  // (routine on a phone) threw all of it away.
  G.persistSoon();
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
  // Drop every held input (used when a menu/overlay takes over mid-press, where
  // the matching touchend/mouseup never reaches us).
  clearHeldInputs() {
    this.mouseDown = false; this.aimDown = false;
    this.touchFire = false; this.touchJump = false; this.touchSprint = false;
    this.touchInteract = false; this.touchReload = false;
    this.touchMove = { x: 0, y: 0, active: false };
    const knob = document.getElementById("touch-joystick-knob");
    if (knob) knob.style.transform = "translate(0,0)";
    document.querySelectorAll("#touch-controls .touch-btn").forEach((b) => b.classList.remove("pressed", "active"));
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
          // Touch look has its own sensitivity (category B): a figure tuned for
          // a mouse on a desk says nothing about how far a thumb travels on glass.
          const sens = (G.TouchCfg && G.TouchCfg.lookSens()) || 1;
          this.mouseDelta.x += dx * 2.2 * sens;
          this.mouseDelta.y += dy * 2.2 * sens;
        }
      }
    }, { passive: true });
    window.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    });

    // Hold-style buttons. touchcancel matters as much as touchend: iOS fires it
    // instead of touchend when the system steals the gesture (notification,
    // call, palm rejection), and without handling it the button latched "held"
    // forever -- firing or sprinting with nothing on the screen.
    const bindHold = (id, prop, onPress) => {
      const el = document.getElementById(id);
      const press = (e) => {
        e.preventDefault();
        this[prop] = true;
        el.classList.add("pressed");
        if (onPress) onPress();
      };
      const release = (e) => {
        e.preventDefault();
        this[prop] = false;
        el.classList.remove("pressed");
      };
      el.addEventListener("touchstart", press, { passive: false });
      el.addEventListener("touchend", release, { passive: false });
      el.addEventListener("touchcancel", release, { passive: false });
    };
    // The press hook is what makes semi-automatic weapons work on touch. Firing
    // one needs a fresh trigger-pull edge, which used to be produced ONLY by the
    // DOM mousedown handler -- and calling preventDefault() on touchstart (which
    // we must, to stop scrolling/zooming) suppresses the synthesized mouse
    // events entirely on iOS. So the pistol every player starts with silently
    // did nothing when the FIRE button was tapped, while auto weapons worked.
    bindHold("touch-fire", "touchFire", () => G.onFirePress && G.onFirePress());
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
    // Touch had no way to pause at all -- ESC was the only route, which a
    // tablet doesn't have.
    document.getElementById("touch-pause").addEventListener("touchstart", (e) => {
      e.preventDefault();
      G.onPausePress && G.onPausePress();
    }, { passive: false });
  },

  pollGamepad() {
    if (this.gamepadIndex === null) return null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return pads[this.gamepadIndex] || null;
  },
};
