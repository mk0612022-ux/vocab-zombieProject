// ===================================================================
// Captions of what is heard (overhaul, round 3)
// -------------------------------------------------------------------
// For a player who plays with the sound low or off, or cannot hear it: the
// sounds that matter in a fight said in words at the bottom of the screen,
// with an arrow for the way each came from (from where the camera looks).
// Off by default (Settings > Sound > Captions). At most three lines; a sound
// heard again refreshes its own line rather than adding one; a growl only
// from close by and not more than every few seconds (G.CONFIG.audio.captions).
//   G.Captions.heard(key, pos)   js/audio.js calls it for every sound it
//                                plays that could have one (pos: or null)
// The words are G.T("cap.<name>") -- js/strings*.js.
// ===================================================================
window.G = window.G || {};

G.Captions = {
  // a sound -> its caption's name
  KEYS: {
    "sfx:behind": "behind", "sfx:heartbeat": "heartbeat", "sfx:glass_break": "glass", "sfx:shatter": "glass",
    "sfx:emerge_ground": "dig", "sfx:locker_bang": "locker", "sfx:vent_clang": "vent", "sfx:gate_open": "gate",
    "door": "door", "zombie:growl": "growl", "explosion": "explosion", "boss:roar": "roar", "boss:shriek": "shriek",
  },
  ARROWS: ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"],
  lines: [],              // { name, el, timer }
  _last: {},              // name -> when it was last shown (ms)

  force: false,           // (the Sound Lab: on for the session, nothing saved)
  on() { return this.force || !!(G.save && G.save.settings && G.save.settings.captions); },
  cfg() { return G.CONFIG.audio.captions; },

  heard(key, pos) {
    const name = this.KEYS[key];
    if (!name || !this.on()) return;
    const C = this.cfg(), now = performance.now();
    const dist = pos ? this.distance(pos) : 0;
    if (name === "growl") {
      if (dist > C.growlRange || now - (this._last.growl || 0) < C.growlEvery * 1000) return;
    }
    this._last[name] = now;
    this.show(name, pos ? this.arrow(pos) : "");
  },

  // where the listener is and looks (js/audio.js keeps them a frame at a time)
  distance(pos) {
    const L = G.Audio && G.Audio._lp;
    return L ? Math.hypot(pos.x - L.x, pos.z - L.z) : 0;
  },
  // the way a sound came from, as one of eight arrows ("" when it is right here)
  arrow(pos) {
    const A = G.Audio, L = A && A._lp, F = A && A._lf;
    if (!L || !F) return "";
    const dx = pos.x - L.x, dz = pos.z - L.z;
    if (Math.hypot(dx, dz) < 1.5) return "";
    const fl = Math.hypot(F.x, F.z) || 1, fx = F.x / fl, fz = F.z / fl;
    const ahead = dx * fx + dz * fz, side = dx * -fz + dz * fx;
    const deg = Math.atan2(side, ahead) * 180 / Math.PI;
    return this.ARROWS[((Math.round(deg / 45) % 8) + 8) % 8];
  },

  show(name, arrow) {
    const box = document.getElementById("hud-captions");
    if (!box) return;
    const C = this.cfg();
    let line = this.lines.find((l) => l.name === name);
    if (!line) {
      const el = document.createElement("div");
      el.className = "hud-cap";
      line = { name, el };
      this.lines.push(line);
      box.appendChild(el);
      while (this.lines.length > C.max) this.drop(this.lines[0]);
    }
    const text = G.T("cap." + name);
    line.el.textContent = "";
    line.el.append("[" + text + "]");
    if (arrow) { const b = document.createElement("b"); b.textContent = arrow; line.el.append(" ", b); }
    line.el.classList.remove("fade");
    clearTimeout(line.timer); clearTimeout(line.gone);
    line.timer = setTimeout(() => { line.el.classList.add("fade"); line.gone = setTimeout(() => this.drop(line), 420); }, C.life * 1000);
  },
  drop(line) {
    clearTimeout(line.timer); clearTimeout(line.gone);
    if (line.el.parentNode) line.el.parentNode.removeChild(line.el);
    this.lines = this.lines.filter((l) => l !== line);
  },
  clear() { this.lines.slice().forEach((l) => this.drop(l)); this._last = {}; },
};
