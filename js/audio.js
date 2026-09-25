// ===================================================================
// Audio (category J)
// -------------------------------------------------------------------
// Every sound in the game is synthesised with the Web Audio API -- there
// are no audio files. That keeps the game a plain static site with no
// build step and nothing extra to download, and it lets one gun sound
// family cover eighty-five weapons: a shot is shaped from the weapon's
// archetype and lightly randomised so an automatic doesn't machine-gun
// one identical sample.
//
// Four buses, each with its own saved volume (J4):
//   sfx      guns, zombies, footsteps, doors, pickups, warnings
//   music    per-level score, with a tense mode for bosses and late waves
//   ambient  per-theme background bed (wind, hum, machinery, drips)
//   speech   word pronunciation, via the browser's SpeechSynthesis
//
// Browsers (iOS Safari above all) refuse to start an AudioContext until the
// user has touched or clicked, so nothing is created until the first gesture.
// ===================================================================
G.Audio = {
  ctx: null,
  bus: {},
  _noise: null,
  _voices: 0,
  MAX_VOICES: 64,
  _level: null,

  init() {
    const unlock = () => this.unlock();
    ["pointerdown", "touchstart", "keydown", "mousedown"].forEach((ev) =>
      window.addEventListener(ev, unlock, { passive: true }));
    if ("speechSynthesis" in window) {
      const pickVoice = () => { this._voice = this.pickVoice(); };
      pickVoice();
      speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", pickVoice);
    }
  },

  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    // a gentle limiter on the master, so a boss fight plus a launcher plus
    // six growls cannot clip into distortion
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    ["sfx", "music", "ambient"].forEach((k) => {
      const g = ctx.createGain();
      g.connect(comp);
      this.bus[k] = g;
    });
    this.applyVolumes();
    // iOS: a silent one-sample buffer played inside the gesture is what
    // actually opens the output
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    if (this._pendingLevel) { const t = this._pendingLevel; this._pendingLevel = null; this.startLevel(t); }
  },

  vol(k) {
    const s = G.save && G.save.settings;
    if (!s) return 0.7;
    const map = { sfx: s.sfxVolume, music: s.musicVolume, ambient: s.ambientVolume, speech: s.speechVolume };
    const v = map[k];
    return Number.isFinite(v) ? v : 0.7;
  },
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bus.sfx.gain.setTargetAtTime(this.vol("sfx") * 0.9, t, 0.05);
    this.bus.music.gain.setTargetAtTime(this.vol("music") * 0.42, t, 0.05);
    this.bus.ambient.gain.setTargetAtTime(this.vol("ambient") * 0.55, t, 0.05);
  },

  // ---------------- primitives ----------------
  noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx, len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  },

  // Where a sound ends up: straight onto a bus, or through a panner placed
  // in the world so it is heard from the direction it came from.
  _out(bus, pos) {
    const ctx = this.ctx;
    const dest = this.bus[bus] || this.bus.sfx;
    if (!pos) return dest;
    const p = ctx.createPanner();
    p.panningModel = "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = 2.2; p.rolloffFactor = 1.3; p.maxDistance = 45;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(dest);
    return p;
  },

  // Caps simultaneous one-shots so a firefight cannot flood the graph. Music,
  // ambience and anything marked `prio` (the warnings, answer feedback, key
  // pickups) are exempt -- a dropped heartbeat is worse than a dropped shot.
  _voiceGuard(dur, o) {
    if (this._forcePrio || (o && (o.prio || o.bus === "music" || o.bus === "ambient"))) return true;
    if (this._voices >= this.MAX_VOICES) return false;
    this._voices++;
    setTimeout(() => { this._voices = Math.max(0, this._voices - 1); }, (dur + 0.1) * 1000);
    return true;
  },

  tone(o) {
    const ctx = this.ctx;
    if (!ctx || !this._voiceGuard(o.dur, o)) return;
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.3), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibrato.rate; lg.gain.value = o.vibrato.depth;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.05);
    }
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type; f.frequency.value = o.filter.freq; f.Q.value = o.filter.q || 1;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(this._out(o.bus || "sfx", o.pos));
    osc.start(t); osc.stop(t + o.dur + 0.05);
  },

  noise(o) {
    const ctx = this.ctx;
    if (!ctx || !this._voiceGuard(o.dur, o)) return;
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqEnd), t + o.dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.3), t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(this._out(o.bus || "sfx", o.pos));
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
  },

  // ---------------- listener ----------------
  updateListener(camera) {
    const ctx = this.ctx;
    if (!ctx || !camera) return;
    const p = new THREE.Vector3(), f = new THREE.Vector3(), u = new THREE.Vector3(0, 1, 0);
    camera.getWorldPosition(p);
    camera.getWorldDirection(f);
    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z;
      L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z;
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  },

  // ---------------- weapons (J1) ----------------
  gunshot(def) {
    if (!this.ctx || !def) return;
    const r = () => 0.95 + Math.random() * 0.1;
    const arch = def.archetype || G.inferArchetype(def);
    const heavy = G.weightClass ? G.weightClass(def).key : "medium";
    const body = heavy === "very_heavy" ? 1.35 : heavy === "heavy" ? 1.18 : heavy === "light" ? 0.85 : 1;
    switch (arch) {
      case "pistol":
        this.noise({ dur: 0.11, freq: 2200 * r(), q: 0.9, gain: 0.5 });
        this.tone({ type: "triangle", freq: 170 * r(), freqEnd: 55, dur: 0.12, gain: 0.35 });
        break;
      case "smg":
        this.noise({ dur: 0.07, freq: 2600 * r(), q: 1.1, gain: 0.4 });
        this.tone({ type: "triangle", freq: 150 * r(), freqEnd: 60, dur: 0.07, gain: 0.25 });
        break;
      case "rifle":
        this.noise({ dur: 0.1, freq: 1800 * r(), q: 0.9, gain: 0.5 * body });
        this.noise({ dur: 0.04, filter: "highpass", freq: 4200, gain: 0.25 });
        this.tone({ type: "triangle", freq: 130 * r(), freqEnd: 45, dur: 0.14, gain: 0.35 * body });
        break;
      case "lmg":
        this.noise({ dur: 0.12, filter: "lowpass", freq: 1600 * r(), gain: 0.55 });
        this.tone({ type: "sine", freq: 100 * r(), freqEnd: 40, dur: 0.16, gain: 0.45 });
        break;
      case "shotgun":
        this.noise({ dur: 0.34 * body, filter: "lowpass", freq: 1300 * r(), freqEnd: 300, gain: 0.7 });
        this.tone({ type: "sine", freq: 95 * r(), freqEnd: 35, dur: 0.3, gain: 0.6 });
        this.tone({ type: "square", freq: 900, dur: 0.02, gain: 0.08, at: 0.34 });   // pump
        break;
      case "sniper":
        this.noise({ dur: 0.05, filter: "highpass", freq: 3200, gain: 0.55 });
        this.tone({ type: "sine", freq: 90, freqEnd: 32, dur: 0.35, gain: 0.55 });
        this.noise({ dur: 0.9, filter: "lowpass", freq: 700, freqEnd: 150, gain: 0.22, attack: 0.02 });   // rolling echo
        break;
      case "launcher":
        this.tone({ type: "sine", freq: 130 * r(), freqEnd: 45, dur: 0.25, gain: 0.6 });
        this.noise({ dur: 0.4, filter: "bandpass", freq: 600, freqEnd: 2400, q: 0.6, gain: 0.28, attack: 0.03 });
        break;
      case "energy":
        this.tone({ type: "sawtooth", freq: 900 * r(), freqEnd: 180, dur: 0.18, gain: 0.22, filter: { type: "lowpass", freq: 3000 } });
        this.tone({ type: "sine", freq: 1800 * r(), freqEnd: 420, dur: 0.16, gain: 0.18 });
        break;
      case "beam":
        this.tone({ type: "sawtooth", freq: 1400 * r(), freqEnd: 380, dur: 0.24, gain: 0.2, filter: { type: "bandpass", freq: 1800, q: 2 } });
        this.tone({ type: "sine", freq: 2800, freqEnd: 900, dur: 0.2, gain: 0.12 });
        this.noise({ dur: 0.08, filter: "highpass", freq: 5000, gain: 0.15 });
        break;
      case "cannon":
        this.tone({ type: "sine", freq: 70, freqEnd: 26, dur: 0.6, gain: 0.8 });
        this.noise({ dur: 0.5, filter: "lowpass", freq: 480, freqEnd: 120, gain: 0.6 });
        break;
      default:
        this.noise({ dur: 0.1, freq: 2000, gain: 0.45 });
    }
  },
  explosion(pos, big) {
    this.tone({ type: "sine", freq: big ? 60 : 85, freqEnd: 24, dur: big ? 1.0 : 0.6, gain: 0.9, pos });
    this.noise({ dur: big ? 1.2 : 0.7, filter: "lowpass", freq: 900, freqEnd: 90, gain: 0.8, pos });
  },
  // Animation pass A3: reload sounds are triggered by the reload routine's
  // own steps (G.Game.onReloadEvent), so each click lands on the frame the
  // hand does the thing -- whatever the weapon type and however long it is.
  reloadEvent(kind, def) {
    if (!this.ctx) return;
    const click = (freq, gain, at) => this.tone({ type: "square", freq, dur: 0.025, gain, at: at || 0, filter: { type: "bandpass", freq: freq * 1.6, q: 3 } });
    switch (kind) {
      case "start": this.noise({ dur: 0.16, filter: "lowpass", freq: 700, gain: 0.05 }); break;          // cloth, the hand moving
      case "out": click(1300, 0.08); this.noise({ dur: 0.1, freq: 900, gain: 0.1, at: 0.03 }); break;     // release, slide out
      case "grab": this.noise({ dur: 0.12, filter: "lowpass", freq: 1100, gain: 0.07 }); break;          // out of the pouch
      case "in": this.noise({ dur: 0.07, freq: 1500, gain: 0.12 }); click(900, 0.12, 0.05); break;        // slides in, catch clicks
      case "slap": this.noise({ dur: 0.05, filter: "lowpass", freq: 600, gain: 0.14 }); break;           // palm on the base
      case "bolt": click(1100, 0.1); this.noise({ dur: 0.06, freq: 2000, gain: 0.07, at: 0.02 }); click(700, 0.14, 0.09); break;
      case "cover": click(800, 0.1); this.noise({ dur: 0.08, freq: 1200, gain: 0.07 }); break;
      case "coverClose": click(600, 0.15); break;
      case "shell": this.noise({ dur: 0.04, freq: 1800, gain: 0.08 }); click(1400, 0.06, 0.03); break;
      case "pump": this.noise({ dur: 0.07, freq: 1000, gain: 0.12 }); this.noise({ dur: 0.07, freq: 1300, gain: 0.13, at: 0.13 }); click(700, 0.1, 0.19); break;
      case "land": this.tone({ type: "triangle", freq: 520 + Math.random() * 120, dur: 0.06, gain: 0.05 }); break;   // spent magazine hits the floor
    }
  },
  // kept for any older caller: a whole reload's worth of clicks by duration
  reload(dur) {
    if (!this.ctx) return;
    ["out", "in", "bolt"].forEach((k, i) => setTimeout(() => this.reloadEvent(k), dur * [120, 620, 840][i]));
  },

  // ---------------- everything else in J1 ----------------
  PRIORITY_SFX: ["heartbeat", "breath", "behind", "correct", "wrong", "pickup_key", "unlock", "purchase"],
  sfx(name, o) {
    if (!this.ctx) return;
    o = o || {};
    // everything in the switch runs synchronously, so a flag is enough
    this._forcePrio = this.PRIORITY_SFX.includes(name);
    try { this._sfx(name, o); } finally { this._forcePrio = false; }
  },
  _sfx(name, o) {
    switch (name) {
      case "empty": this.tone({ type: "square", freq: 1800, dur: 0.025, gain: 0.08, filter: { type: "bandpass", freq: 2500, q: 4 } }); break;
      case "switch":
        this.noise({ dur: 0.14, freq: 700, q: 0.5, gain: 0.12 });
        this.tone({ type: "square", freq: 950, dur: 0.03, gain: 0.08, at: 0.16, filter: { type: "bandpass", freq: 1800, q: 3 } });
        break;
      case "pickup":
        [660, 990].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.12, gain: 0.18, at: i * 0.06 }));
        break;
      case "pickup_key":
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.3, gain: 0.2, at: i * 0.07 }));
        this.tone({ type: "sine", freq: 3136, dur: 0.6, gain: 0.06, at: 0.28 });
        break;
      case "purchase":
        this.tone({ type: "square", freq: 1200, dur: 0.05, gain: 0.08 });
        [1046, 1568].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.35, gain: 0.2, at: 0.05 + i * 0.09 }));
        this.noise({ dur: 0.18, filter: "highpass", freq: 6000, gain: 0.08, at: 0.06 });
        break;
      case "correct": [880, 1320].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 0.16, gain: 0.16, at: i * 0.07 })); break;
      case "wrong": this.tone({ type: "sawtooth", freq: 220, freqEnd: 110, dur: 0.3, gain: 0.18, filter: { type: "lowpass", freq: 900 } }); break;
      case "hurt":
        this.noise({ dur: 0.18, filter: "lowpass", freq: 700, gain: 0.3 });
        this.tone({ type: "sine", freq: 120, freqEnd: 60, dur: 0.18, gain: 0.3 });
        break;
      case "heartbeat":
        this.tone({ type: "sine", freq: 62, freqEnd: 40, dur: 0.14, gain: 0.55 });
        this.tone({ type: "sine", freq: 55, freqEnd: 36, dur: 0.12, gain: 0.4, at: 0.2 });
        break;
      case "breath":
        this.noise({ dur: 0.7, freq: 900, q: 0.7, gain: 0.16, attack: 0.25 });
        this.noise({ dur: 0.6, freq: 700, q: 0.7, gain: 0.12, attack: 0.2, at: 0.75 });
        break;
      case "behind":
        this.tone({ type: "sawtooth", freq: 110, dur: 0.5, gain: 0.25, detune: 30, filter: { type: "lowpass", freq: 700 }, pos: o.pos });
        this.tone({ type: "sine", freq: 1760, freqEnd: 1650, dur: 0.35, gain: 0.07 });
        break;
      case "unlock":
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.4, gain: 0.18, at: i * 0.09 }));
        break;
    }
  },

  mystery(rarity) {
    if (!this.ctx) return;
    const idx = Math.max(0, G.RARITY_ORDER.indexOf(rarity));
    // rarer pull = longer, higher, brighter fanfare
    const scale = [0, 3, 7, 10, 12, 15, 19, 22, 24];
    const notes = 3 + idx * 2;
    const base = 330 * Math.pow(1.06, idx * 2);
    for (let i = 0; i < notes; i++) {
      this.tone({ type: idx >= 3 ? "sawtooth" : "triangle", freq: base * Math.pow(2, scale[i % scale.length] / 12),
        dur: 0.35, gain: 0.14, at: i * 0.08, filter: { type: "lowpass", freq: 2500 + idx * 900 } });
    }
    if (idx >= 4) this.noise({ dur: 1.4, filter: "highpass", freq: 7000, gain: 0.08, at: notes * 0.08, attack: 0.2 });
  },

  door(open, pos) {
    if (!this.ctx) return;
    this.tone({ type: "sawtooth", freq: open ? 190 : 150, freqEnd: open ? 130 : 210, dur: 0.55, gain: 0.12,
      vibrato: { rate: 23, depth: 14 }, filter: { type: "bandpass", freq: 900, q: 5 }, pos });
    this.noise({ dur: 0.4, freq: 1200, q: 2, gain: 0.05, pos });
    if (!open) this.tone({ type: "sine", freq: 90, freqEnd: 50, dur: 0.14, gain: 0.35, at: 0.36, pos });   // it shuts
  },

  footstep(surface, running) {
    if (!this.ctx) return;
    const g = running ? 1.25 : 1;
    if (surface === "grass") {
      this.noise({ dur: 0.12, filter: "lowpass", freq: 900 + Math.random() * 300, gain: 0.12 * g });
    } else if (surface === "metal") {
      this.noise({ dur: 0.07, freq: 2600, q: 3, gain: 0.12 * g });
      this.tone({ type: "triangle", freq: 420 + Math.random() * 60, dur: 0.18, gain: 0.05 * g });
    } else {
      this.noise({ dur: 0.06, freq: 1700 + Math.random() * 400, q: 1.4, gain: 0.13 * g });
      this.tone({ type: "sine", freq: 120, freqEnd: 70, dur: 0.05, gain: 0.08 * g });
    }
  },

  // Zombie voices differ by type: pitch, roughness and length all change,
  // so a fast one is recognisable before it rounds the corner.
  ZOMBIE_VOICE: {
    normal: { f: 92, rough: 18, len: 0.9 },
    fast: { f: 150, rough: 30, len: 0.55 },
    crawler: { f: 70, rough: 12, len: 1.1 },
    boss: { f: 48, rough: 10, len: 1.6 },
  },
  zombie(kind, type, pos) {
    if (!this.ctx) return;
    const v = this.ZOMBIE_VOICE[type] || this.ZOMBIE_VOICE.normal;
    const f = v.f * (0.9 + Math.random() * 0.2);
    if (kind === "growl") {
      this.tone({ type: "sawtooth", freq: f, freqEnd: f * 0.8, dur: v.len, gain: type === "boss" ? 0.45 : 0.28,
        vibrato: { rate: 7 + Math.random() * 5, depth: v.rough }, filter: { type: "bandpass", freq: 520 + f, q: 1.4 }, pos, attack: 0.08 });
      this.noise({ dur: v.len * 0.8, freq: 500, q: 1, gain: 0.07, pos, attack: 0.1 });
    } else if (kind === "hurt") {
      this.tone({ type: "sawtooth", freq: f * 1.6, freqEnd: f * 0.9, dur: 0.22, gain: 0.26,
        filter: { type: "bandpass", freq: 900, q: 1.2 }, pos });
      this.noise({ dur: 0.1, filter: "lowpass", freq: 1200, gain: 0.18, pos });
    } else if (kind === "death") {
      this.tone({ type: "sawtooth", freq: f * 1.3, freqEnd: f * 0.35, dur: v.len * 1.1, gain: 0.3,
        vibrato: { rate: 5, depth: v.rough * 1.5 }, filter: { type: "lowpass", freq: 800 }, pos, attack: 0.02 });
      this.noise({ dur: 0.25, filter: "lowpass", freq: 400, gain: 0.3, pos, at: v.len * 0.9 });   // body hits the floor
    }
  },

  // ---------------- music + ambience (J2) ----------------
  // A drone and a sparse melody per theme, generated live. `tension` pushes
  // it into a faster, more dissonant mode with a pulse under it.
  THEMES: {
    school: { root: 110, scale: [0, 2, 3, 5, 7, 8, 10], lead: "triangle", pad: 0.9, gap: [1.4, 3.2] },
    hospital: { root: 82.4, scale: [0, 1, 3, 5, 7, 8, 10], lead: "sine", pad: 1.1, gap: [1.1, 2.8] },
    bunker: { root: 65.4, scale: [0, 1, 3, 5, 6, 8, 10], lead: "square", pad: 1.3, gap: [0.9, 2.4] },
  },
  startLevel(theme) {
    if (!this.ctx) { this._pendingLevel = theme; return; }
    this.stopLevel();
    const ctx = this.ctx, T = this.THEMES[theme] || this.THEMES.school;
    const L = { theme, T, nodes: [], nextNote: ctx.currentTime + 1.5, nextAmb: ctx.currentTime + 2, tension: 0, pulseAt: 0 };
    // drone: two detuned saws through a slowly breathing low-pass
    const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 380; filt.Q.value = 3;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
    const droneG = ctx.createGain(); droneG.gain.value = 0.0001;
    droneG.gain.setTargetAtTime(0.16 * T.pad, ctx.currentTime, 2.5);
    [0, 7, -12].forEach((semi, i) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = T.root * Math.pow(2, semi / 12); o.detune.value = (i - 1) * 9;
      o.connect(filt); o.start(); L.nodes.push(o);
    });
    filt.connect(droneG); droneG.connect(this.bus.music);
    L.drone = droneG; L.droneFilt = filt; L.nodes.push(lfo);

    // ambient bed per theme: a continuous layer plus random one-shots
    const amb = ctx.createBufferSource(); amb.buffer = this.noiseBuffer(); amb.loop = true;
    const af = ctx.createBiquadFilter(), ag = ctx.createGain();
    if (theme === "school") { af.type = "bandpass"; af.frequency.value = 500; af.Q.value = 0.6; ag.gain.value = 0.18; }        // wind
    else if (theme === "hospital") { af.type = "highpass"; af.frequency.value = 3500; ag.gain.value = 0.035; }                   // air handling hiss
    else { af.type = "lowpass"; af.frequency.value = 140; ag.gain.value = 0.55; }                                                // machinery rumble
    const wl = ctx.createOscillator(), wlg = ctx.createGain();
    wl.frequency.value = 0.09; wlg.gain.value = theme === "school" ? 260 : 40; wl.connect(wlg); wlg.connect(af.frequency); wl.start();
    amb.connect(af); af.connect(ag); ag.connect(this.bus.ambient); amb.start();
    L.nodes.push(amb, wl);
    if (theme !== "school") {
      // mains hum: the hospital's fluorescent tubes, the bunker's transformers
      [100, 200].forEach((f, i) => {
        const h = ctx.createOscillator(), hg = ctx.createGain();
        h.type = "sine"; h.frequency.value = theme === "hospital" ? f * 1.2 : f; hg.gain.value = i ? 0.012 : 0.03;
        h.connect(hg); hg.connect(this.bus.ambient); h.start(); L.nodes.push(h);
      });
    }
    this._level = L;
  },
  stopLevel() {
    const L = this._level;
    if (!L || !this.ctx) { this._level = null; return; }
    const t = this.ctx.currentTime;
    L.drone.gain.setTargetAtTime(0.0001, t, 0.3);
    L.nodes.forEach((n) => { try { n.stop(t + 1.2); } catch (e) { /* already stopped */ } });
    this._level = null;
  },

  _ambientOneShot(L) {
    const r = Math.random();
    if (L.theme === "school") {
      if (r < 0.6) this.tone({ type: "sawtooth", freq: 80 + Math.random() * 60, freqEnd: 60, dur: 0.9, gain: 0.05, bus: "ambient",
        vibrato: { rate: 18, depth: 8 }, filter: { type: "bandpass", freq: 500, q: 6 } });                        // building creak
      else this.noise({ dur: 1.8, filter: "bandpass", freq: 700, freqEnd: 350, gain: 0.08, bus: "ambient", attack: 0.6 });   // gust
    } else if (L.theme === "hospital") {
      if (r < 0.55) this.tone({ type: "sine", freq: 1500 + Math.random() * 900, freqEnd: 600, dur: 0.12, gain: 0.06, bus: "ambient" });   // drip
      else this.noise({ dur: 0.25, filter: "highpass", freq: 4000, gain: 0.06, bus: "ambient" });                                          // flicker buzz
    } else {
      if (r < 0.45) this.tone({ type: "sine", freq: 1100 + Math.random() * 700, freqEnd: 450, dur: 0.14, gain: 0.06, bus: "ambient" });   // drip
      else if (r < 0.8) {                                                                                                                  // arcing
        for (let i = 0; i < 4 + Math.floor(Math.random() * 5); i++) {
          this.noise({ dur: 0.04, filter: "highpass", freq: 3500, gain: 0.1, bus: "ambient", at: i * (0.03 + Math.random() * 0.06) });
        }
      } else this.tone({ type: "sine", freq: 45, freqEnd: 38, dur: 1.4, gain: 0.12, bus: "ambient", attack: 0.3 });                     // distant boom
    }
  },

  // Called once a frame from the game loop.
  update(dt, game) {
    const ctx = this.ctx, L = this._level;
    if (!ctx || !L) return;
    this.updateListener(game.camera);
    const now = ctx.currentTime;
    // tension: boss on the field, or the last wave or two
    const tense = (G.BossFight && G.BossFight.active) || (game.mode === "campaign" && game.wave >= game.level.waves - 1);
    const target = tense ? 1 : 0;
    if (target !== L.tension) {
      L.tension = target;
      L.droneFilt.frequency.setTargetAtTime(tense ? 900 : 380, now, 1.2);
      L.drone.gain.setTargetAtTime((tense ? 0.22 : 0.16) * L.T.pad, now, 1.5);
    }
    // sparse melody, scheduled a little ahead of time
    while (L.nextNote < now + 0.2) {
      const deg = L.T.scale[Math.floor(Math.random() * L.T.scale.length)];
      const oct = Math.random() < 0.3 ? 4 : 2;
      const f = L.T.root * oct * Math.pow(2, deg / 12);
      this.tone({ type: L.T.lead, freq: f, dur: tense ? 0.9 : 2.2, gain: tense ? 0.09 : 0.07, attack: 0.06, bus: "music",
        at: Math.max(0, L.nextNote - now), filter: { type: "lowpass", freq: 1800 } });
      if (tense && Math.random() < 0.35) {
        this.tone({ type: L.T.lead, freq: f * Math.pow(2, 6 / 12), dur: 0.7, gain: 0.05, bus: "music", at: Math.max(0, L.nextNote - now) });   // tritone
      }
      const [a, b] = L.T.gap;
      L.nextNote += (tense ? 0.35 : 1) * (a + Math.random() * (b - a));
    }
    // tense pulse: a low kick at ~110 bpm under the boss fight
    if (tense && now >= L.pulseAt) {
      L.pulseAt = now + 0.545;
      this.tone({ type: "sine", freq: 58, freqEnd: 34, dur: 0.22, gain: 0.22, bus: "music" });
    }
    if (now >= L.nextAmb) {
      L.nextAmb = now + 2.5 + Math.random() * 6;
      this._ambientOneShot(L);
    }
  },

  // ---------------- speech (J3) ----------------
  pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const vs = speechSynthesis.getVoices() || [];
    return vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /en-US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  },
  speak(word) {
    if (!word || !("speechSynthesis" in window)) return;
    const vol = this.vol("speech");
    if (vol <= 0.001) return;
    this._lastSpoken = word;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = (this._voice && this._voice.lang) || "en-GB";
      if (this._voice) u.voice = this._voice;
      u.rate = 0.85; u.pitch = 1; u.volume = Math.min(1, vol);
      speechSynthesis.speak(u);
    } catch (e) { /* speech is a nicety; never let it break the game */ }
  },
  replay() { if (this._lastSpoken) this.speak(this._lastSpoken); },
};
