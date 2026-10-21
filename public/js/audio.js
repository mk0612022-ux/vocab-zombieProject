// ===================================================================
// Audio (category J)
// -------------------------------------------------------------------
// Every sound in the game is synthesised with the Web Audio API -- there
// are no audio files. That keeps the game a plain static site with no
// build step and nothing extra to download. Each of the 85 guns has its own
// shot, reload and draw sound, built in js/gunaudio.js.
//
// (overhaul, round 3) The mixer:
//   Master -> compressor -> limiter -> a soft ceiling (no sample past -1 dBFS) -> out
//     music     per-level score, a tense mode for bosses and late waves
//     weapons   the player's guns, reloads, switches (its own EQ)
//     sfx       zombies, impacts, footsteps, doors, pickups, warnings
//     ambient   per-theme background bed (wind, hum, machinery, drips)
//     ui        menus, answers, the shop's clock -- still heard when paused
//     reverb    the room (js/acoustics.js), silenced with the game
//   speech      word pronunciation, via the browser's SpeechSynthesis
// Each bus: its volume (Settings), then a gain the game moves -- paused, the
// game's sounds stop and the music steps back; a boss's warning, a cutscene
// or a question ducks the music and the ambience.
//
// A "voice" is one sound as the player hears it (a shot, a footstep, a
// growl), however many oscillators it takes. Each kind has a limit
// (G.CONFIG.audio.limits) and all of them together one per graphics level;
// past it the least important gives way (then the farthest, then the
// oldest). A voice can be tagged -- a reload's sounds carry its id, so a
// cancelled reload stops them -- and everything the game was playing stops
// on death and on leaving a level.
//
// Browsers (iOS Safari above all) refuse to start an AudioContext until the
// user has touched or clicked, so nothing is created until the first gesture.
// ===================================================================
G.Audio = {
  ctx: null,
  bus: {},
  mod: {},
  _noise: null,
  _level: null,
  live: [],                         // the voices playing (see _voiceFor)
  _cur: null,                       // the voice the next tone/noise belongs to (group())
  _duck: {},                        // reasons the music is ducked: reason -> until (ctx time) or Infinity
  paused: false,
  // the kinds of voice, and where they go
  GAME_CATS: ["weapons", "impact", "zombie", "steps", "sfx"],
  UI_SFX: ["correct", "wrong", "tick", "shop_warn", "purchase", "pickup", "pickup_key", "unlock", "update", "switch", "regen", "deny", "lowammo",
    "ui_hover", "ui_select", "ui_open", "ui_back"],

  init() {
    // (A5) every kind of gesture, for as long as the page lives: iOS Safari
    // only lets sound start inside some of them (touchend and click, not
    // always touchstart), and after a call or a trip to the home screen it
    // leaves the context "interrupted" until the next touch
    const unlock = () => this.unlock();
    ["pointerdown", "pointerup", "touchstart", "touchend", "click", "keydown", "mousedown"].forEach((ev) =>
      window.addEventListener(ev, unlock, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", () => { if (!document.hidden && this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {}); });
    if ("speechSynthesis" in window) {
      // (round 3: once the device has listed its voices, whether the Word
      // Language has one is known -- the lobby and Settings say when not)
      const pickVoice = () => {
        this._voice = this.pickVoice();
        if ((speechSynthesis.getVoices() || []).length && !this._voicesKnown) { this._voicesKnown = true; window.dispatchEvent(new Event("vz-voices")); }
      };
      pickVoice();
      speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", pickVoice);
      // (some browsers never send voiceschanged when the list was ready at once)
      setTimeout(() => { if (!this._voicesKnown) { this._voicesKnown = true; window.dispatchEvent(new Event("vz-voices")); } }, 2500);
    }
  },

  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== "running") {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
        // iOS: a silent sample played inside the gesture re-opens the output
        try { const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0); } catch (e) { /* not in a gesture */ }
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.buildMixer();
    this.applyVolumes();
    if (G.Acoustics) G.Acoustics.init();
    if (G.GunAudio && G.GunAudio.warm) G.GunAudio.warm();
    // iOS: a silent one-sample buffer played inside the gesture is what
    // actually opens the output
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    // ...and the word pronunciations: iOS lets speech start later, from a
    // timer, only once it has been started inside a touch -- a silent, empty
    // line now opens it
    try {
      if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
    } catch (e) { /* no speech on this browser */ }
    if (this._pendingLevel) { const t = this._pendingLevel; this._pendingLevel = null; this.startLevel(t); }
  },

  // ---------------- the mixer (overhaul, round 3) ----------------
  BUSES: ["music", "weapons", "sfx", "ambient", "ui", "reverb"],
  buildMixer() {
    const ctx = this.ctx, A = G.CONFIG.audio;
    const dyn = (o) => { const c = ctx.createDynamicsCompressor(); ["threshold", "knee", "ratio", "attack", "release"].forEach((k) => { c[k].value = o[k]; }); return c; };
    this.master = ctx.createGain();
    const comp = dyn(A.compressor), lim = dyn(A.limiter);
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 1024;
    // the ceiling: linear up to the knee, then a tanh bend that never passes ceilingDb
    const clip = ctx.createWaveShaper(), n = 2049, top = Math.pow(10, A.ceilingDb / 20), kn = A.ceilingKnee, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
      curve[i] = ax <= kn ? x : Math.sign(x) * (kn + (top - kn) * Math.tanh((ax - kn) / (top - kn)));
    }
    clip.curve = curve; clip.oversample = "none";
    this.master.connect(comp); comp.connect(lim); lim.connect(clip); clip.connect(this.meter); this.meter.connect(ctx.destination);
    this.BUSES.forEach((k) => {
      const v = ctx.createGain(), m = ctx.createGain();
      v.connect(m); m.connect(this.master);
      this.bus[k] = v; this.mod[k] = m;
    });
    // the weapons' own EQ: no rumble, less mud, the top end tamed
    const E = A.weaponsEQ, hp = ctx.createBiquadFilter(), mud = ctx.createBiquadFilter(), sh = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = E.highpass; hp.Q.value = 0.7;
    mud.type = "peaking"; mud.frequency.value = E.mudFreq; mud.Q.value = 1; mud.gain.value = E.mudGain;
    sh.type = "highshelf"; sh.frequency.value = E.shelfFreq; sh.gain.value = E.shelfGain;
    const w = this.bus.weapons;
    w.disconnect(); w.connect(hp); hp.connect(mud); mud.connect(sh); sh.connect(this.mod.weapons);
    this.bus.reverb.gain.value = 1;
    // what the room hears (js/acoustics.js takes it from here)
    this.revIn = ctx.createGain();
  },
  vol(k) {
    const s = G.save && G.save.settings;
    if (!s) return 0.7;
    const map = { sfx: s.sfxVolume, music: s.musicVolume, ambient: s.ambientVolume, speech: s.speechVolume,
      master: s.masterVolume, weapons: s.weaponsVolume, ui: s.uiVolume };
    const v = map[k];
    return Number.isFinite(v) ? v : (k === "master" ? 1 : 0.7);
  },
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, B = G.CONFIG.audio.busGain;
    ["music", "weapons", "sfx", "ambient", "ui"].forEach((k) => this.bus[k].gain.setTargetAtTime(this.vol(k) * B[k], t, 0.05));
    this.master.gain.setTargetAtTime(this.vol("master"), t, 0.05);
  },
  // the gains the game moves: paused (its sounds stop, the music steps back),
  // ducked (music and ambience under a boss's warning, a cutscene, a question)
  db: (d) => Math.pow(10, d / 20),
  applyMods() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, A = G.CONFIG.audio;
    const now = t;
    Object.keys(this._duck).forEach((r) => { if (this._duck[r] !== Infinity && this._duck[r] < now) delete this._duck[r]; });
    const ducked = Object.keys(this._duck).length > 0;
    const was = this._wasDucked;
    this._wasDucked = ducked;
    const tc = (sec) => sec / 3;                    // (setTargetAtTime reaches ~95% in 3 time constants)
    const duckT = tc(ducked ? A.duck.attack : A.duck.release);
    const game = this.paused ? 0 : 1;
    ["weapons", "sfx", "reverb"].forEach((k) => this.mod[k].gain.setTargetAtTime(game, t, 0.03));
    this.mod.ambient.gain.setTargetAtTime(this.paused ? 0 : (ducked ? this.db(A.duck.ambient) : 1), t, ducked !== was ? duckT : 0.03);
    this.mod.music.gain.setTargetAtTime((this.paused ? this.db(A.pauseMusic) : 1) * (ducked ? this.db(A.duck.music) : 1), t, ducked !== was ? duckT : 0.05);
    this.mod.ui.gain.setTargetAtTime(1, t, 0.03);
  },
  setPaused(on) {
    on = !!on;
    if (on === this.paused) return;
    this.paused = on;
    this.applyMods();
  },
  // reason on (for `secs`, or until taken off) / off
  duck(reason, on, secs) {
    if (!this.ctx) return;
    if (on) this._duck[reason] = secs ? this.ctx.currentTime + secs : Infinity;
    else delete this._duck[reason];
    this.applyMods();
  },
  // (Settings) a short sound on one fader's bus -- heard from the pause menu
  // too: a paused bus is let up for the moment it plays
  testBus(k) {
    this.unlock();
    if (!this.ctx) return;
    const m = this.mod[k], t = this.ctx.currentTime;
    if (this.paused && m) {
      m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(1, t);
      clearTimeout(this._testT); this._testT = setTimeout(() => this.applyMods(), 1600);
    }
    switch (k) {
      case "master": this.sfx("pickup"); break;
      case "music": [523.3, 659.3, 784].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.55, gain: 0.12, at: i * 0.13, bus: "music", filter: { type: "lowpass", freq: 2200 } })); break;
      case "weapons": if (G.GunAudio) G.GunAudio.shot(G.WEAPON_DEFS.pistol, {}); break;
      case "sfx": this.zombie("growl", "normal", null); break;
      case "ambient": this.noise({ dur: 1.4, filter: "bandpass", freq: 700, freqEnd: 350, gain: 0.12, bus: "ambient", attack: 0.4 }); break;
      case "ui": this.sfx("correct"); break;
      case "speech": if (G.Lang) this.speak(G.Lang.sample()); break;
    }
  },
  // the master's loudest sample just now, in dBFS (the Sound Lab, the stress test)
  peakDb() {
    if (!this.meter) return -Infinity;
    const b = this._mb || (this._mb = new Float32Array(this.meter.fftSize));
    this.meter.getFloatTimeDomainData(b);
    let m = 0; for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > m) m = a; }
    return m > 0 ? 20 * Math.log10(m) : -Infinity;
  },

  // ---------------- voices ----------------
  tier() { return (G.save && G.save.settings.graphicsQuality) || "medium"; },
  // A voice for a sound about to start (o: { cat, prio 1-4 | true, pos, tag }),
  // or null: no room for it. prio true (0, the old "always heard": a warning,
  // an answer) never waits -- it takes the place of the least important one,
  // so even these stay inside the limits.
  _voiceFor(o, dur) {
    const ctx = this.ctx, A = G.CONFIG.audio;
    const cat = o.cat || (o.bus === "music" ? "music" : o.bus === "ambient" ? "ambient" : o.bus === "ui" ? "ui" : "sfx");
    const prio = o.prio === true ? 0 : (o.prio || (cat === "ui" ? 1 : cat === "ambient" ? 3 : 2));
    const now = ctx.currentTime;
    this.purge(now);
    const V = { cat, prio, pos: o.pos || null, tag: o.tag || null, t0: now, end: now + (o.at || 0) + (dur || 0.3), nodes: [], gains: [], occ: null };
    if (cat === "music") { this.live.push(V); return V; }
    const dist = (v) => (v.pos && this._lp ? Math.hypot(v.pos.x - this._lp.x, v.pos.y - this._lp.y, v.pos.z - this._lp.z) : 0);
    // the one that gives way: least important, then farthest, then oldest
    const victim = (list) => list.reduce((a, b) => (!a || b.prio > a.prio || (b.prio === a.prio && (dist(b) > dist(a) || (dist(b) === dist(a) && b.t0 < a.t0))) ? b : a), null);
    const same = this.live.filter((v) => v.cat === cat);
    const lim = A.limits[cat] || 8, tot = A.total[this.tier()] || 24;
    const make = (list) => {
      const w = victim(list);
      if (!w || w.prio < prio || (prio > 0 && w.prio === prio && dist(w) < dist(V))) return false;    // nothing less important to stop
      this.stopVoice(w);
      return true;
    };
    if (same.length >= lim && !make(same)) return null;
    const all = this.live.filter((v) => v.cat !== "music");
    if (all.length >= tot && !make(all)) return null;
    this.live.push(V);
    return V;
  },
  purge(now) {
    if (this.live.length) this.live = this.live.filter((v) => v.end > now - 0.05 && !v.dead);
  },
  stopVoice(v) {
    if (!v || v.dead) return;
    v.dead = true;
    const t = this.ctx.currentTime;
    v.gains.forEach((g) => { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.012); } catch (e) { /* gone */ } });
    v.nodes.forEach((n) => { try { n.stop(t + 0.08); } catch (e) { /* not started or stopped */ } });
    this.live = this.live.filter((x) => x !== v);
  },
  // everything with this tag (a reload that was cancelled)
  stopTag(tag) { if (this.ctx) this.live.filter((v) => v.tag === tag).forEach((v) => this.stopVoice(v)); },
  // everything the game was playing (death, leaving a level) -- not the music, the ambience or the menus
  stopAll(cats) {
    if (!this.ctx) return;
    const set = cats || this.GAME_CATS;
    this.live.filter((v) => set.includes(v.cat)).forEach((v) => this.stopVoice(v));
    if (G.GunAudio && G.GunAudio.chargeStop) G.GunAudio.chargeStop();
    // (the crowd's bed is the level's own loop: down to nothing until the next hordeTick)
    const H = this._level && this._level.horde;
    if (H) { H.out.gain.cancelScheduledValues(this.ctx.currentTime); H.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08); }
  },
  // one sound made of several tones and noises: they share one voice
  group(o, fn) {
    if (!this.ctx) return null;
    if (this._cur) { fn(); return this._cur; }
    const V = this._voiceFor(o, o.dur || 0.5);
    if (!V) return null;
    this._cur = V;
    try { fn(); } finally { this._cur = null; }
    return V;
  },
  counts() {
    if (!this.ctx) return {};
    this.purge(this.ctx.currentTime);
    const c = { total: 0 };
    this.live.forEach((v) => { c[v.cat] = (c[v.cat] || 0) + 1; if (v.cat !== "music") c.total++; });
    return c;
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
  // (overhaul, round 3) A sound in the world goes through its voice's own
  // chain -- a low-pass and a gain that muffle it when a wall is in the way
  // (occlusion, G.Audio.update), then the panner: HRTF for the nearest few
  // on High and Ultra, equal-power for the rest. Every tone and noise of one
  // voice shares the chain.
  _out(bus, pos, V) {
    const ctx = this.ctx;
    const dest = this.bus[bus] || this.bus.sfx;
    if (!pos) return dest;
    if (V && V.occ && V.occ.dest === dest) return V.occ.in;
    const p = ctx.createPanner();
    p.panningModel = V && this.useHrtf(pos) ? "HRTF" : "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = 2.2; p.rolloffFactor = 1.3; p.maxDistance = 45;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    // (no voice: a long loop of its own -- the forest's bed, a boss's move --
    // that moves this panner itself; it is only placed)
    if (!V) { p.connect(dest); return p; }
    const lp = ctx.createBiquadFilter(), og = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 0.5;
    lp.connect(og); og.connect(p); p.connect(dest);
    const chain = { in: lp, lp, gain: og, panner: p, dest, hrtf: p.panningModel === "HRTF", occluded: false };
    V.occ = chain;
    // (a sound starting behind a wall starts muffled)
    if (this.occludedAt(pos)) this.setOccluded(chain, true, true);
    return lp;
  },
  // HRTF for a sound close by while there is room for one more (High: 4, Ultra: 8)
  useHrtf(pos) {
    const A = G.CONFIG.audio, n = A.hrtf[this.tier()] || 0;
    if (!n || !this._lp) return false;
    if (Math.hypot(pos.x - this._lp.x, pos.y - this._lp.y, pos.z - this._lp.z) > A.hrtfRange) return false;
    return this.live.filter((v) => v.occ && v.occ.hrtf).length < n;
  },
  setOccluded(chain, on, now) {
    if (!chain || chain.occluded === on) return;
    chain.occluded = on;
    const t = this.ctx.currentTime, O = G.CONFIG.audio.occluded, tc = now ? 0.001 : O.time / 3;
    chain.lp.frequency.setTargetAtTime(on ? O.lowpass : 20000, t, tc);
    chain.gain.gain.setTargetAtTime(on ? this.db(O.gainDb) : 1, t, tc);
  },

  tone(o) {
    const ctx = this.ctx;
    if (!ctx) return;
    const V = this._cur || this._voiceFor(o, (o.at || 0) + o.dur);
    if (!V) return;
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
      V.nodes.push(lfo);
    }
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type; f.frequency.value = o.filter.freq; f.Q.value = o.filter.q || 1;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(this._out(o.bus || this.busOf(V), o.pos || V.pos, V));
    if (o.rev && this.revIn) { const sg = ctx.createGain(); sg.gain.value = o.rev; g.connect(sg); sg.connect(this.revIn); }
    osc.start(t); osc.stop(t + o.dur + 0.05);
    V.nodes.push(osc); V.gains.push(g);
    V.end = Math.max(V.end, t + o.dur + 0.05);
  },
  // a voice's own bus by its kind
  busOf(V) { return V.cat === "weapons" ? "weapons" : V.cat === "ui" ? "ui" : V.cat === "ambient" ? "ambient" : V.cat === "music" ? "music" : "sfx"; },

  noise(o) {
    const ctx = this.ctx;
    if (!ctx) return;
    const V = this._cur || this._voiceFor(o, (o.at || 0) + o.dur);
    if (!V) return;
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
    src.connect(f); f.connect(g); g.connect(this._out(o.bus || this.busOf(V), o.pos || V.pos, V));
    if (o.rev && this.revIn) { const sg = ctx.createGain(); sg.gain.value = o.rev; g.connect(sg); sg.connect(this.revIn); }
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
    V.nodes.push(src); V.gains.push(g);
    V.end = Math.max(V.end, t + o.dur + 0.05);
  },
  // a rendered sound (js/gunaudio.js, the sound bank's files): one buffer, one voice
  // o: { cat, prio, pos, tag, bus, gain, rate, rev, at }
  buffer(buf, o) {
    const ctx = this.ctx;
    if (!ctx || !buf) return null;
    const dur = buf.duration / (o.rate || 1);
    const V = this._cur || this._voiceFor(o, (o.at || 0) + dur);
    if (!V) return null;
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = o.rate || 1;
    g.gain.value = o.gain == null ? 1 : o.gain;
    src.connect(g); g.connect(this._out(o.bus || this.busOf(V), o.pos || V.pos, V));
    if (o.rev && this.revIn) { const sg = ctx.createGain(); sg.gain.value = o.rev; g.connect(sg); sg.connect(this.revIn); }
    src.start(t);
    V.nodes.push(src); V.gains.push(g);
    V.end = Math.max(V.end, t + dur + 0.02);
    return V;
  },

  // ---------------- listener ----------------
  updateListener(camera) {
    const ctx = this.ctx;
    if (!ctx || !camera) return;
    const p = this._lp || (this._lp = new THREE.Vector3()), f = new THREE.Vector3(), u = new THREE.Vector3(0, 1, 0);
    camera.getWorldPosition(p);
    camera.getWorldDirection(f);
    this._lf = f;
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
  // Every gun has its own voice now (animation/audio pass C): see js/gunaudio.js.
  // chargeFrac: how far a charge weapon was wound up (0..1), if it is one.
  gunshot(def, chargeFrac) {
    if (!this.ctx || !def) return;
    G.GunAudio.shot(def, { charge: def.charge ? (chargeFrac || 0) : null });
  },
  explosion(pos, big) {
    if (!this.ctx) return;
    this.group({ cat: "sfx", prio: 1, pos, dur: 1.3 }, () => {
      this.tone({ type: "sine", freq: big ? 60 : 85, freqEnd: 24, dur: big ? 1.0 : 0.6, gain: 0.9, pos, rev: 0.6 });
      this.noise({ dur: big ? 1.2 : 0.7, filter: "lowpass", freq: 900, freqEnd: 90, gain: 0.8, pos, rev: 0.8 });
    });
    if (G.Captions) G.Captions.heard("explosion", pos);
  },
  // Animation pass A3: reload sounds are triggered by the reload routine's
  // own steps (the overhaul: G.WeaponSM's markers on G.Bus, heard in
  // js/gunaudio.js), so each click lands on the frame the
  // hand does the thing -- whatever the weapon type and however long it is.
  // ...and each gun's reload clicks at its own pitch and material (pass C).
  reloadEvent(kind, def) {
    if (!this.ctx) return;
    G.GunAudio.reload(kind, def);
  },
  // kept for any older caller: a whole reload's worth of clicks by duration
  reload(dur) {
    if (!this.ctx) return;
    ["out", "in", "bolt"].forEach((k, i) => setTimeout(() => this.reloadEvent(k), dur * [120, 620, 840][i]));
  },

  // ---------------- everything else in J1 ----------------
  PRIORITY_SFX: ["heartbeat", "breath", "behind", "correct", "wrong", "pickup_key", "unlock", "purchase", "shop_warn", "tick"],
  // (overhaul, round 3) one voice a sound: the menus' and answers' on the UI
  // bus (still heard when paused), the warnings never dropped, the dry click
  // and the rest the game's
  sfx(name, o) {
    if (!this.ctx) return;
    o = o || {};
    const ui = this.UI_SFX.includes(name);
    const cat = name === "empty" ? "weapons" : ui ? "ui" : "sfx";
    const prio = this.PRIORITY_SFX.includes(name) ? true : ui ? 1 : 2;
    this.group({ cat, prio, pos: o.pos || null, dur: 0.8 }, () => this._sfx(name, o));
    if (G.Captions) G.Captions.heard("sfx:" + name, o.pos || null);
  },
  _sfx(name, o) {
    switch (name) {
      case "empty": this.tone({ type: "square", freq: 1800, dur: 0.025, gain: 0.08, filter: { type: "bandpass", freq: 2500, q: 4 } }); break;
      // (round 3) no spare rounds to load: a short, low refusal
      case "deny":
        this.tone({ type: "square", freq: 220, freqEnd: 170, dur: 0.09, gain: 0.07, filter: { type: "lowpass", freq: 1200 } });
        this.tone({ type: "square", freq: 170, dur: 0.08, gain: 0.06, at: 0.11, filter: { type: "lowpass", freq: 1000 } });
        break;
      // (overhaul, round 5) the menus: hover a light electronic tick; select a
      // firmer one with a switch in it; open a short confirm, never shrill;
      // back short and falling -- heard at once as going back
      case "ui_hover":
        this.tone({ type: "square", freq: 2400, dur: 0.018, gain: 0.025, filter: { type: "bandpass", freq: 2600, q: 5 } });
        break;
      case "ui_select":
        this.tone({ type: "square", freq: 1500, dur: 0.03, gain: 0.05, filter: { type: "bandpass", freq: 1800, q: 4 } });
        this.noise({ dur: 0.03, filter: "highpass", freq: 3000, gain: 0.04, at: 0.012 });
        this.tone({ type: "sine", freq: 420, freqEnd: 300, dur: 0.06, gain: 0.07, at: 0.01 });
        break;
      case "ui_open":
        this.tone({ type: "triangle", freq: 660, dur: 0.07, gain: 0.06 });
        this.tone({ type: "triangle", freq: 990, dur: 0.09, gain: 0.05, at: 0.05 });
        break;
      case "ui_back":
        this.tone({ type: "triangle", freq: 880, freqEnd: 520, dur: 0.08, gain: 0.055 });
        this.noise({ dur: 0.03, filter: "lowpass", freq: 1200, gain: 0.03 });
        break;
      // (round 3) the magazine running low: one soft tick, once
      case "lowammo":
        this.tone({ type: "triangle", freq: 1320, dur: 0.05, gain: 0.05 });
        this.tone({ type: "triangle", freq: 990, dur: 0.06, gain: 0.04, at: 0.07 });
        break;
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
      // ---- the shop's clock (C): ten seconds left, then a tick a second ----
      case "shop_warn":
        [880, 660, 880].forEach((f, i) => this.tone({ type: "square", freq: f, dur: 0.09, gain: 0.09, at: i * 0.12, filter: { type: "lowpass", freq: 2400 } }));
        break;
      case "tick": this.tone({ type: "square", freq: 1500, dur: 0.02, gain: 0.06, filter: { type: "bandpass", freq: 2200, q: 3 } }); break;
      // health coming back (D): a soft rising chime when it starts
      case "regen": [392, 523, 659].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 0.35, gain: 0.07, at: i * 0.08 })); break;
      // a new version of the game is ready (A4)
      case "update": [659, 988].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.25, gain: 0.1, at: i * 0.1 })); break;
      // ---- round 2: zombies coming in, and going ----
      case "emerge_ground":   // the ground splitting, earth falling back
        this.tone({ type: "sine", freq: o.big ? 48 : 70, freqEnd: 30, dur: o.big ? 1.1 : 0.7, gain: o.big ? 0.5 : 0.3, pos: o.pos, rev: 0.3 });
        this.noise({ dur: 0.35, filter: "lowpass", freq: 700, freqEnd: 200, gain: 0.3, pos: o.pos });
        this.noise({ dur: 0.9, filter: "bandpass", freq: 1400, q: 0.6, gain: 0.08, at: 0.2, attack: 0.1, pos: o.pos });
        break;
      case "locker_bang":     // a steel door flung open
        this.tone({ type: "square", freq: 190, freqEnd: 120, dur: 0.18, gain: 0.14, filter: { type: "bandpass", freq: 900, q: 3 }, pos: o.pos, rev: 0.4 });
        this.noise({ dur: 0.25, freq: 2400, q: 5, gain: 0.12, pos: o.pos });
        break;
      case "vent_clang":      // a grate knocked out of its frame
        [310, 470].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.5, gain: 0.12, at: i * 0.03, vibrato: { rate: 23, depth: 9 }, pos: o.pos, rev: 0.4 }));
        this.noise({ dur: 0.12, freq: 3200, q: 4, gain: 0.1, pos: o.pos });
        break;
      case "glass_break":
        for (let i = 0; i < 5; i++) this.noise({ dur: 0.18, filter: "highpass", freq: 3500 + i * 700, gain: 0.12, at: i * 0.035, pos: o.pos });
        this.tone({ type: "sine", freq: 2600, freqEnd: 1900, dur: 0.3, gain: 0.05, pos: o.pos });
        break;
      case "desk_scrape":
        this.noise({ dur: 0.45, freq: 520, q: 2.2, gain: 0.16, attack: 0.04, pos: o.pos });
        break;
      case "body_thud":
        this.tone({ type: "sine", freq: o.soft ? 150 : 90, freqEnd: 50, dur: 0.14, gain: o.soft ? 0.1 : 0.3, pos: o.pos });
        this.noise({ dur: 0.08, filter: "lowpass", freq: 500, gain: o.soft ? 0.04 : 0.12, pos: o.pos });
        break;
      case "shatter":         // a body giving way into pieces
        this.noise({ dur: 0.3, filter: "lowpass", freq: 1200, freqEnd: 250, gain: 0.22, pos: o.pos });
        for (let i = 0; i < 3; i++) this.noise({ dur: 0.06, freq: 900 + i * 500, q: 3, gain: 0.07, at: 0.04 + i * 0.05, pos: o.pos });
        break;
      case "headshot":
        this.tone({ type: "square", freq: 1150, freqEnd: 700, dur: 0.06, gain: 0.08, filter: { type: "bandpass", freq: 1500, q: 2 } });
        this.noise({ dur: 0.12, filter: "lowpass", freq: 900, gain: 0.18, pos: o.pos });
        break;
      // ---- round 3: the campus and the story notes ----
      case "crow": {         // two or three harsh caws as it takes off
        const n = 2 + Math.floor(Math.random() * 2), f0 = 820 + Math.random() * 220;
        for (let i = 0; i < n; i++) {
          this.tone({ type: "sawtooth", freq: f0, freqEnd: f0 * 0.62, dur: 0.22, gain: 0.07, at: i * 0.3, vibrato: { rate: 38, depth: 40 }, filter: { type: "bandpass", freq: 1300, q: 1.6 }, pos: o.pos });
          this.noise({ dur: 0.16, freq: 1700, q: 2, gain: 0.04, at: i * 0.3, pos: o.pos });
        }
        break;
      }
      case "wings":           // a flurry of wingbeats
        for (let i = 0; i < 6; i++) this.noise({ dur: 0.07, filter: "lowpass", freq: 900, gain: 0.07, at: i * 0.075, pos: o.pos });
        break;
      case "paper":           // a sheet of paper picked up / unfolded
        this.noise({ dur: 0.22, filter: "highpass", freq: 2600, gain: 0.07, attack: 0.02 });
        this.noise({ dur: 0.16, filter: "bandpass", freq: 4200, q: 1.2, gain: 0.05, at: 0.12 });
        break;
      case "gate_open":       // a steel grille lifting on its runners
        this.noise({ dur: 1.2, freq: 380, q: 3, gain: 0.14, attack: 0.1, pos: o.pos, rev: 0.4 });
        this.tone({ type: "square", freq: 95, freqEnd: 140, dur: 1.1, gain: 0.06, filter: { type: "lowpass", freq: 600 }, pos: o.pos });
        this.tone({ type: "triangle", freq: 1320, dur: 0.12, gain: 0.08, at: 1.15, pos: o.pos });
        break;
      case "rattle":          // trying a locked grille
        for (let i = 0; i < 4; i++) this.noise({ dur: 0.06, freq: 1400 + i * 300, q: 4, gain: 0.08, at: i * 0.07, pos: o.pos });
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

  // Sliding doors (category B): rollers rumbling along the top rail for as
  // long as the panel moves, a click from the latch as it lets go. A wide
  // pair is heavier and lower. Every door is pitched a little differently.
  slideDoor(open, pos, dur, heavy) {
    if (!this.ctx) return;
    const v = 0.96 + Math.random() * 0.08, len = dur + 0.06;
    this.noise({ dur: len, filter: "lowpass", freq: (heavy ? 520 : 760) * v, freqEnd: (heavy ? 420 : 600) * v, gain: heavy ? 0.1 : 0.075, attack: 0.07, pos });
    this.tone({ type: "triangle", freq: (heavy ? 46 : 62) * v, dur: len, gain: heavy ? 0.07 : 0.05, attack: 0.06,
      vibrato: { rate: 17 * v, depth: 5 }, filter: { type: "lowpass", freq: 320 }, pos });
    if (open) this.noise({ dur: 0.04, freq: 2300 * v, q: 3, gain: 0.05, pos });   // the latch
    if (G.Captions && pos) G.Captions.heard("door", pos);
  },
  // The end of the travel: shut is a soft thump against the jamb (or the other
  // panel), open a light knock on the stop, and a door that ran into somebody
  // a dull rubber bump before it slides back.
  doorStop(shut, pos, heavy, blocked) {
    if (!this.ctx) return;
    const v = 0.96 + Math.random() * 0.08;
    if (blocked) {
      this.tone({ type: "sine", freq: 95 * v, freqEnd: 60, dur: 0.11, gain: 0.2, pos });
      this.noise({ dur: 0.08, filter: "lowpass", freq: 320, gain: 0.06, pos });
    } else if (shut) {
      this.tone({ type: "sine", freq: (heavy ? 96 : 122) * v, freqEnd: heavy ? 44 : 55, dur: 0.16, gain: heavy ? 0.4 : 0.3, pos });
      this.noise({ dur: 0.08, filter: "lowpass", freq: 520 * v, gain: 0.08, pos });
      this.noise({ dur: 0.06, freq: 1800 * v, q: 4, gain: 0.025, at: 0.02, pos });   // the glass rattles
    } else {
      this.tone({ type: "sine", freq: 170 * v, freqEnd: 100, dur: 0.08, gain: 0.12, pos });
      this.noise({ dur: 0.04, freq: 1400 * v, q: 2, gain: 0.04, pos });
    }
  },

  // (overhaul, round 3) A footstep on what is underfoot (js/surface.js):
  // concrete, tile, wood, grass, dirt (and carpet), water, metal. Running is
  // heavier and a touch brighter than walking; `land` is the drop after a
  // jump. o: { pos (a zombie's), heavy (a big one), gain }
  footstep(surface, running, o) {
    if (!this.ctx) return;
    o = o || {};
    const g = (running ? 1.25 : 1) * (o.gain || 1) * (o.land ? 1.6 : 1), r = () => 0.92 + Math.random() * 0.16, low = o.heavy ? 0.7 : 1;
    const pos = o.pos || null;
    this.group({ cat: "steps", prio: pos ? 3 : 2, pos, dur: 0.3 }, () => {
      switch (surface) {
        case "grass":
          this.noise({ dur: 0.13, filter: "lowpass", freq: (900 + Math.random() * 300) * low, gain: 0.12 * g });
          this.noise({ dur: 0.06, filter: "highpass", freq: 3200, gain: 0.025 * g, at: 0.02 });     // the blades
          break;
        case "dirt":
          this.noise({ dur: 0.1, filter: "lowpass", freq: 650 * r() * low, gain: 0.13 * g });
          this.noise({ dur: 0.05, freq: 1800 * r(), q: 1, gain: 0.03 * g, at: 0.015 });               // grit
          break;
        case "water":
          this.noise({ dur: 0.16, freq: 1100 * r(), q: 0.8, gain: 0.1 * g });
          this.tone({ type: "sine", freq: 520 * r(), freqEnd: 260, dur: 0.07, gain: 0.04 * g, at: 0.03 });   // the splash
          this.noise({ dur: 0.2, filter: "highpass", freq: 3500, gain: 0.03 * g, at: 0.04 });
          break;
        case "metal":
          this.noise({ dur: 0.07, freq: 2600 * r(), q: 3, gain: 0.12 * g });
          this.tone({ type: "triangle", freq: (420 + Math.random() * 60) * low, dur: 0.18, gain: 0.05 * g });
          break;
        case "wood":
          this.tone({ type: "sine", freq: 170 * r() * low, freqEnd: 95, dur: 0.07, gain: 0.11 * g });
          this.noise({ dur: 0.05, freq: 900 * r(), q: 1.6, gain: 0.08 * g });
          break;
        case "concrete":
          this.noise({ dur: 0.055, freq: 1300 * r(), q: 1.1, gain: 0.12 * g });
          this.tone({ type: "sine", freq: 105 * low, freqEnd: 60, dur: 0.05, gain: 0.08 * g });
          this.noise({ dur: 0.03, filter: "highpass", freq: 4200, gain: 0.02 * g, at: 0.01 });      // grit
          break;
        default:      // tile: a crisper click
          this.noise({ dur: 0.06, freq: (1700 + Math.random() * 400) * low, q: 1.4, gain: 0.13 * g });
          this.tone({ type: "sine", freq: 120 * low, freqEnd: 70, dur: 0.05, gain: 0.08 * g });
      }
      if (o.land) this.tone({ type: "sine", freq: 80, freqEnd: 45, dur: 0.12, gain: 0.12 * (o.gain || 1) });   // the body coming down
    });
  },
  // (overhaul, round 3) A round landing (js/fx.js): by what it hit, from where
  // it hit -- a crack and grit off stone, a knock off wood, a ping off metal,
  // a tinkle off glass, a thud in earth, a splash. Pellets share one voice.
  impact(surface, pos, o) {
    if (!this.ctx || !pos) return;
    o = o || {};
    const g = o.pellet ? 0.55 : 1, r = () => 0.9 + Math.random() * 0.2;
    this.group({ cat: "impact", prio: 2, pos, dur: 0.4 }, () => {
      switch (surface) {
        case "metal":
          this.tone({ type: "triangle", freq: 2400 * r(), freqEnd: 1700, dur: 0.14, gain: 0.07 * g, filter: { type: "bandpass", freq: 2600, q: 6 } });
          this.noise({ dur: 0.03, filter: "highpass", freq: 4000, gain: 0.08 * g });
          break;
        case "wood":
          this.tone({ type: "sine", freq: 260 * r(), freqEnd: 140, dur: 0.06, gain: 0.12 * g });
          this.noise({ dur: 0.05, freq: 1200 * r(), q: 1.4, gain: 0.08 * g });
          break;
        case "glass":
          for (let i = 0; i < 3; i++) this.noise({ dur: 0.07, filter: "highpass", freq: (4200 + i * 900) * r(), gain: 0.05 * g, at: i * 0.025 });
          break;
        case "grass": case "dirt":
          this.noise({ dur: 0.09, filter: "lowpass", freq: 700 * r(), gain: 0.1 * g });
          break;
        case "water":
          this.noise({ dur: 0.18, freq: 1400 * r(), q: 0.8, gain: 0.08 * g });
          this.tone({ type: "sine", freq: 700 * r(), freqEnd: 300, dur: 0.06, gain: 0.04 * g });
          break;
        case "flesh":
          this.noise({ dur: 0.07, filter: "lowpass", freq: 600 * r(), gain: 0.12 * g });
          break;
        default:      // concrete, tile: a sharp crack and grit falling
          this.noise({ dur: 0.04, freq: 2600 * r(), q: 1.2, gain: 0.1 * g });
          this.noise({ dur: 0.16, filter: "highpass", freq: 3800, gain: 0.025 * g, at: 0.03 });
      }
    });
  },

  // Zombie voices differ by type: pitch, roughness and length all change,
  // so a fast one is recognisable before it rounds the corner.
  // (overhaul, round 4) the ten kinds, each its own voice: a pitch (f), how
  // rough (rough), how long (len), two formants (a throat's vowel), a
  // breath, and what sets it apart -- the Sprinter pants, the Bloater
  // gurgles wet, the Ironclad and the Headless are muffled (a helmet, a head
  // held under an arm), the Runt squeals short and high, the Abomination's
  // roar is three throats at once. A far one is darker and wetter with the
  // room (more reverb).
  ZOMBIE_VOICE: {
    normal:      { f: 92, rough: 18, len: 0.9, fm: [520, 1000], breath: 0.07 },
    fast:        { f: 150, rough: 30, len: 0.55, fm: [700, 1500], breath: 0.1, pant: true },
    crawler:     { f: 70, rough: 12, len: 1.1, fm: [400, 900], breath: 0.06, scrape: true },
    bloater:     { f: 62, rough: 14, len: 1.3, fm: [350, 800], breath: 0.05, wet: true },
    ironclad:    { f: 84, rough: 10, len: 1.0, fm: [480, 950], breath: 0.05, muffle: 900 },
    runt:        { f: 280, rough: 40, len: 0.35, fm: [1000, 2400], breath: 0.06 },
    abomination: { f: 55, rough: 25, len: 1.6, fm: [380, 820], breath: 0.09, layers: [0.5, 1, 1.5] },
    screamer:    { f: 170, rough: 20, len: 0.8, fm: [900, 2600], breath: 0.12 },
    headless:    { f: 90, rough: 16, len: 1.0, fm: [450, 900], breath: 0.05, muffle: 700 },
    reacher:     { f: 68, rough: 12, len: 1.2, fm: [380, 850], breath: 0.09 },
    boss:        { f: 48, rough: 10, len: 1.6, fm: [380, 800], breath: 0.06 },
  },
  // o: { tag } -- a sound that can be stopped (a shriek cut short)
  zombie(kind, type, pos, o) {
    if (!this.ctx) return;
    o = o || {};
    // (overhaul, round 3) one voice each; a death or a hurt is more important than a growl
    // (round 4: a shriek, a swell and a burst are never dropped)
    const urgent = kind === "scream" || kind === "scream_wind" || kind === "swell" || kind === "pop";
    const prio = urgent ? true : kind === "growl" || kind === "drag" || kind === "helmet_land" ? 3 : 2;
    this.group({ cat: "zombie", prio, pos, dur: kind === "scream" ? 1.6 : kind === "swell" ? 1.4 : 1.4, tag: o.tag || null }, () => this._zombie(kind, type, pos));
    if (G.Captions && kind === "growl") G.Captions.heard("zombie:growl", pos);
    if (G.Captions && kind === "scream") G.Captions.heard("zombie:scream", pos);
  },
  _zombie(kind, type, pos) {
    const v = this.ZOMBIE_VOICE[type] || this.ZOMBIE_VOICE.normal;
    const f = v.f * (0.9 + Math.random() * 0.2);
    // how far: a far voice darker, more of the room
    const d = pos && this._lp ? Math.hypot(pos.x - this._lp.x, pos.z - this._lp.z) : 0;
    const far = Math.max(0, Math.min(1, (d - 8) / 20)), dark = (1 - 0.45 * far) * (v.muffle ? Math.min(1, v.muffle / v.fm[1]) : 1), rev = 0.15 + 0.55 * far;
    // a throat: a rough saw through two formants (+ more throats, the Abomination)
    const throat = (f0, f1, dur, gain, o) => {
      (v.layers || [1]).forEach((m, i) => {
        const g = gain / (i ? 2 : 1);
        this.tone(Object.assign({ type: "sawtooth", freq: f0 * m, freqEnd: f1 * m, dur, gain: g * 0.6, vibrato: { rate: v.wet ? 22 : 7 + Math.random() * 5, depth: v.rough * m },
          filter: { type: "bandpass", freq: v.fm[0] * dark, q: 1.4 }, pos, rev }, o));
        this.tone(Object.assign({ type: "sawtooth", freq: f0 * m * 1.01, freqEnd: f1 * m, dur, gain: g * 0.4, vibrato: { rate: 9, depth: v.rough * m * 0.7 },
          filter: { type: "bandpass", freq: v.fm[1] * dark, q: 2 }, pos, rev }, o));
      });
    };
    if (kind === "growl") {
      throat(f, f * 0.8, v.len, type === "boss" ? 0.45 : 0.3, { attack: 0.08 });
      this.noise({ dur: v.len * 0.8, freq: v.fm[1] * dark, q: 1, gain: v.breath, pos, attack: 0.1, rev });
      // the Sprinter pants; the Bloater bubbles; the Crawler's nails on the floor
      if (v.pant) for (let i = 0; i < 4; i++) this.noise({ dur: 0.09, filter: "highpass", freq: 1800, gain: 0.05, at: v.len + i * 0.16, pos });
      if (v.wet) for (let i = 0; i < 5; i++) this.tone({ type: "sine", freq: 180 + Math.random() * 220, freqEnd: 90, dur: 0.06, gain: 0.05, at: Math.random() * v.len, pos });
      if (v.scrape) this.noise({ dur: 0.25, freq: 2600, q: 3, gain: 0.04, at: v.len * 0.5, pos });
    } else if (kind === "hurt") {
      throat(f * 1.6, f * 0.9, 0.22, 0.28, {});
      this.noise({ dur: 0.1, filter: "lowpass", freq: 1200 * dark, gain: 0.18, pos });
    } else if (kind === "death") {
      this.tone({ type: "sawtooth", freq: f * 1.3, freqEnd: f * 0.35, dur: v.len * 1.1, gain: 0.3,
        vibrato: { rate: 5, depth: v.rough * 1.5 }, filter: { type: "lowpass", freq: 800 * dark }, pos, attack: 0.02, rev });
      this.noise({ dur: 0.25, filter: "lowpass", freq: 400, gain: 0.3, pos, at: v.len * 0.9 });   // body hits the floor
    } else if (kind === "attack") {
      // the wind-up: a snarl rising into the blow
      throat(f * 1.3, f * 2.1, 0.32, 0.3, { attack: 0.03 });
      this.noise({ dur: 0.25, filter: "highpass", freq: 2200, gain: 0.06, pos });
    } else if (kind === "scream_wind") {
      // the Screamer draws breath: a long rising rasp
      this.noise({ dur: 1.0, filter: "highpass", freq: 900, freqEnd: 3200, gain: 0.09, attack: 0.6, pos, rev });
      this.tone({ type: "sawtooth", freq: f * 0.8, freqEnd: f * 1.3, dur: 1.0, gain: 0.08, attack: 0.5, filter: { type: "bandpass", freq: 1200, q: 3 }, pos });
    } else if (kind === "scream") {
      // the shriek: high and long, with its own echo -- loud, never piercing
      // (its peak is the limiter's and the ceiling's, js/audio.js)
      this.tone({ type: "sawtooth", freq: 880, freqEnd: 1250, dur: 1.2, gain: 0.2, attack: 0.04, vibrato: { rate: 16, depth: 45 }, filter: { type: "bandpass", freq: 2000, q: 1.6 }, pos, rev: 0.9 });
      this.tone({ type: "sawtooth", freq: 1320, freqEnd: 1700, dur: 1.0, gain: 0.08, attack: 0.06, vibrato: { rate: 21, depth: 60 }, filter: { type: "bandpass", freq: 2900, q: 2 }, pos, rev: 0.9 });
      this.noise({ dur: 1.1, filter: "highpass", freq: 2500, gain: 0.07, attack: 0.05, pos, rev: 0.7 });
    } else if (kind === "swell") {
      // the Bloater swelling: a gurgle that rises and stretches
      this.tone({ type: "sine", freq: 70, freqEnd: 140, dur: 1.2, gain: 0.25, vibrato: { rate: 24, depth: 14 }, attack: 0.1, pos });
      for (let i = 0; i < 8; i++) this.tone({ type: "sine", freq: 160 + Math.random() * 300, freqEnd: 80, dur: 0.07, gain: 0.06, at: i * 0.14, pos });
      this.noise({ dur: 1.1, filter: "lowpass", freq: 500, freqEnd: 1400, gain: 0.08, attack: 0.4, pos });
    } else if (kind === "pop") {
      // the burst: wet, heavy, short
      this.noise({ dur: 0.55, filter: "lowpass", freq: 1200, freqEnd: 140, gain: 0.55, pos, rev: 0.6 });
      this.tone({ type: "sine", freq: 95, freqEnd: 30, dur: 0.45, gain: 0.6, pos, rev: 0.4 });
      for (let i = 0; i < 6; i++) this.noise({ dur: 0.05, filter: "lowpass", freq: 700, gain: 0.12, at: 0.15 + Math.random() * 0.5, pos });   // what comes down after
    } else if (kind === "helmet") {
      // a round off the Ironclad's helmet
      this.tone({ type: "triangle", freq: 1900 + Math.random() * 300, dur: 0.25, gain: 0.12, filter: { type: "bandpass", freq: 2100, q: 8 }, pos, rev: 0.3 });
      this.noise({ dur: 0.03, filter: "highpass", freq: 4000, gain: 0.1, pos });
    } else if (kind === "helmet_off") {
      [1150, 1720, 2310].forEach((fq, i) => this.tone({ type: "triangle", freq: fq, dur: 0.6 - i * 0.12, gain: 0.12 / (i + 1), filter: { type: "bandpass", freq: fq, q: 9 }, pos, rev: 0.4 }));
      this.noise({ dur: 0.05, filter: "highpass", freq: 3000, gain: 0.12, pos });
    } else if (kind === "helmet_land") {
      this.tone({ type: "triangle", freq: 900 + Math.random() * 200, dur: 0.18, gain: 0.08, filter: { type: "bandpass", freq: 1000, q: 6 }, pos });
      this.noise({ dur: 0.06, filter: "lowpass", freq: 900, gain: 0.08, pos });
    } else if (kind === "drag") {
      // a Crawler pulling itself along: a wet scrape and a slap of the hand
      this.noise({ dur: 0.32, freq: 900 * dark, freqEnd: 500, q: 0.9, gain: 0.07, attack: 0.05, pos });
      this.noise({ dur: 0.05, filter: "lowpass", freq: 600, gain: 0.08, at: 0.28, pos });
    } else if (kind === "clank") {
      // the Ironclad's armour with each step
      this.tone({ type: "triangle", freq: 640 + Math.random() * 120, dur: 0.12, gain: 0.05, filter: { type: "bandpass", freq: 700, q: 5 }, pos });
    }
  },

  // ---------------- bosses (round 2, G4) ----------------
  // A boss's voice is its own pitch, roughness and length (G.BOSS_DEFS
  // voice): the roar, the grunt when hit, the laugh, the death. Every move
  // has a warning sound as well as its strike, so it can be heard coming.
  bossVoice(kind, v, o) {
    if (!this.ctx) return;
    v = v || { f: 60, rough: 12, len: 1.6 };
    o = o || {};
    const pos = o.pos, f = v.f;
    // (overhaul, round 3) a boss's warning: the music and the ambience step back under it, and it is captioned
    if (kind === "roar" || kind === "shriek") {
      this.duck("boss", true, (kind === "roar" ? v.len * 1.3 : 1.3) + 0.3);
      if (G.Captions) G.Captions.heard("boss:" + kind, pos);
    }
    if (kind === "roar") {
      [1, 1.5, 0.5].forEach((m, i) => this.tone({ type: "sawtooth", freq: f * m, freqEnd: f * m * 0.7, dur: v.len * 1.3, gain: i ? 0.2 : 0.4,
        vibrato: { rate: 6 + i * 3, depth: v.rough * m }, filter: { type: "lowpass", freq: 900 + f * 3 }, attack: 0.12, pos, rev: 0.6, prio: true }));
      this.noise({ dur: v.len * 1.2, filter: "bandpass", freq: 400 + f * 2, freqEnd: 200, q: 0.6, gain: 0.35, attack: 0.1, pos, rev: 0.5, prio: true });
    } else if (kind === "shriek") {
      this.tone({ type: "sawtooth", freq: f * 3, freqEnd: f * 5, dur: 1.3, gain: 0.26, vibrato: { rate: 14, depth: f * 0.4 }, filter: { type: "bandpass", freq: 1800, q: 1.5 }, attack: 0.05, pos, rev: 0.7, prio: true });
      this.noise({ dur: 1.1, filter: "highpass", freq: 2500, gain: 0.14, attack: 0.05, pos, rev: 0.6, prio: true });
    } else if (kind === "laugh" || kind === "cackle") {
      for (let i = 0; i < 6; i++) {
        this.tone({ type: kind === "laugh" ? "square" : "sawtooth", freq: f * (2.2 - i * 0.12), freqEnd: f * (1.6 - i * 0.1), dur: 0.12, gain: 0.2, at: i * 0.15,
          filter: { type: "bandpass", freq: 900 + f * 2, q: 2 }, pos, rev: 0.4, prio: true });
        if (kind === "cackle") this.noise({ dur: 0.1, filter: "bandpass", freq: 1400, gain: 0.12, at: i * 0.15, pos });
      }
    } else if (kind === "hurt") {
      this.tone({ type: "sawtooth", freq: f * 1.8, freqEnd: f * 1.1, dur: 0.28, gain: 0.3, filter: { type: "bandpass", freq: 700 + f * 2, q: 1.2 }, pos });
    } else if (kind === "growl") {
      this.tone({ type: "sawtooth", freq: f, freqEnd: f * 0.85, dur: v.len * 0.6, gain: 0.32, vibrato: { rate: 9, depth: v.rough }, filter: { type: "lowpass", freq: 700 }, attack: 0.08, pos });
    } else if (kind === "death") {
      this.tone({ type: "sawtooth", freq: f * 1.3, freqEnd: f * 0.3, dur: 3.2, gain: 0.45, vibrato: { rate: 5, depth: v.rough * 2 }, filter: { type: "lowpass", freq: 1100 }, attack: 0.05, rev: 0.8, prio: true });
      this.tone({ type: "sawtooth", freq: f * 2, freqEnd: f * 0.5, dur: 2.6, gain: 0.2, vibrato: { rate: 9, depth: v.rough * 3 }, filter: { type: "bandpass", freq: 900 }, attack: 0.1, rev: 0.8, prio: true });
    }
  },
  boss(name, o) {
    if (!this.ctx) return;
    o = o || {};
    const pos = o.pos, P = true;
    switch (name) {
      case "swipe_wind": this.bossVoice("growl", o.voice, { pos }); this.noise({ dur: 0.6, filter: "bandpass", freq: 300, freqEnd: 900, gain: 0.12, attack: 0.4, pos }); break;
      case "swipe": this.noise({ dur: 0.3, filter: "bandpass", freq: 1400, freqEnd: 300, q: 0.7, gain: 0.45, pos, prio: P }); this.tone({ type: "sine", freq: 90, freqEnd: 40, dur: 0.3, gain: 0.4, pos }); break;
      case "slam_wind": this.bossVoice("growl", o.voice, { pos }); this.tone({ type: "sine", freq: 90, freqEnd: 420, dur: 1.7, gain: 0.25, attack: 0.2, prio: P }); this.tone({ type: "square", freq: 180, freqEnd: 840, dur: 1.7, gain: 0.05, attack: 0.3, filter: { type: "lowpass", freq: 1200 }, prio: P }); break;
      case "slam":
        this.tone({ type: "sine", freq: 58, freqEnd: 22, dur: 1.2, gain: 1.0, rev: 0.7, prio: P });
        this.noise({ dur: 1.3, filter: "lowpass", freq: 900, freqEnd: 70, gain: 0.9, rev: 0.7, prio: P });
        for (let i = 0; i < 6; i++) this.noise({ dur: 0.08, filter: "bandpass", freq: 900 + Math.random() * 800, gain: 0.25, at: 0.15 + i * 0.09 + Math.random() * 0.05, pos });
        break;
      case "laser_charge":
        this.tone({ type: "sawtooth", freq: 160, freqEnd: 1300, dur: 1.35, gain: 0.16, filter: { type: "bandpass", freq: 1500, q: 1.5 }, attack: 0.1, pos, prio: P });
        this.tone({ type: "sine", freq: 500, freqEnd: 2600, dur: 1.35, gain: 0.1, attack: 0.3, prio: P });
        break;
      case "roar_wind": this.noise({ dur: 1.4, filter: "bandpass", freq: 300, freqEnd: 1300, q: 0.8, gain: 0.35, attack: 1.1, pos, prio: P }); this.tone({ type: "sine", freq: 60, freqEnd: 110, dur: 1.4, gain: 0.3, attack: 0.9, prio: P }); break;
      case "summon": this.bossVoice("shriek", o.voice, { pos }); this.tone({ type: "sine", freq: 110, freqEnd: 55, dur: 1.6, gain: 0.25, attack: 0.3, rev: 0.6, prio: P }); break;
      case "rise": this.noise({ dur: 0.9, filter: "lowpass", freq: 260, gain: 0.5, attack: 0.1, pos }); break;
      case "snort": for (let i = 0; i < 2; i++) this.noise({ dur: 0.22, filter: "bandpass", freq: 480, q: 1.5, gain: 0.5, at: i * 0.3, pos, prio: P }); break;
      case "whistle":
        this.tone({ type: "square", freq: 2900, dur: 0.55, gain: 0.12, vibrato: { rate: 32, depth: 160 }, filter: { type: "bandpass", freq: 3000, q: 3 }, pos, prio: P });
        this.tone({ type: "sine", freq: 2950, dur: 0.55, gain: 0.1, vibrato: { rate: 32, depth: 170 }, pos, prio: P });
        break;
      case "charge": this.bossVoice("roar", o.voice, { pos }); this.noise({ dur: 1.6, filter: "lowpass", freq: 220, gain: 0.7, attack: 0.05, pos, prio: P }); break;
      case "crash":
        this.explosion(pos, true);
        this.tone({ type: "square", freq: 1800, freqEnd: 180, dur: 0.5, gain: 0.12, filter: { type: "bandpass", freq: 1500, q: 2 }, pos });
        break;
      case "stomp_wind": this.bossVoice("growl", o.voice, { pos }); break;
      case "stomp":
        this.tone({ type: "sine", freq: 72, freqEnd: 30, dur: 0.7, gain: 0.8, prio: P });
        this.tone({ type: "sawtooth", freq: 110, freqEnd: 70, dur: 0.9, gain: 0.08, vibrato: { rate: 24, depth: 12 }, filter: { type: "bandpass", freq: 600, q: 5 }, pos });
        for (let i = 0; i < 5; i++) this.noise({ dur: 0.06, filter: "bandpass", freq: 1200 + Math.random() * 900, gain: 0.18, at: 0.05 + i * 0.07, pos });
        break;
      case "crackle": for (let i = 0; i < 14; i++) this.noise({ dur: 0.04, filter: "highpass", freq: 3500, gain: 0.16, at: i * 0.1 + Math.random() * 0.06, pos, prio: P }); this.tone({ type: "sawtooth", freq: 120, freqEnd: 480, dur: 1.4, gain: 0.07, attack: 0.3, prio: P }); break;
      case "thunder":
        this.noise({ dur: 0.12, filter: "highpass", freq: 2500, gain: 0.8, prio: P });
        this.noise({ dur: 2.2, filter: "lowpass", freq: 2600, freqEnd: 60, gain: 0.9, attack: 0.02, rev: 0.8, prio: P });
        this.tone({ type: "sine", freq: 50, freqEnd: 28, dur: 1.6, gain: 0.6, prio: P });
        break;
      case "cackle": this.bossVoice("cackle", o.voice, { pos }); break;
      case "splash":
        this.noise({ dur: 0.4, filter: "bandpass", freq: 2400, q: 0.8, gain: 0.4, pos });
        for (let i = 0; i < 4; i++) this.tone({ type: "sine", freq: 500 + Math.random() * 600, freqEnd: 180, dur: 0.12, gain: 0.1, at: 0.1 + i * 0.07, pos });
        this.noise({ dur: 1.2, filter: "highpass", freq: 3000, gain: 0.08, at: 0.2, attack: 0.1, pos });
        break;
      case "vortex_wind": this.tone({ type: "sine", freq: 40, freqEnd: 95, dur: 1.25, gain: 0.45, attack: 0.3, prio: P }); this.noise({ dur: 1.25, filter: "lowpass", freq: 200, freqEnd: 900, gain: 0.3, attack: 0.8, prio: P }); break;
      case "pop": this.tone({ type: "sine", freq: 220, freqEnd: 40, dur: 0.45, gain: 0.6, pos, prio: P }); this.noise({ dur: 0.3, filter: "lowpass", freq: 900, gain: 0.4, pos }); break;
      case "papers": this.noise({ dur: 0.9, filter: "highpass", freq: 2800, gain: 0.3, attack: 0.1, pos, prio: P }); break;
      case "poof": this.noise({ dur: 0.28, filter: "bandpass", freq: 1500, q: 0.7, gain: 0.4, pos, prio: P }); break;
      case "throw": this.noise({ dur: 0.18, filter: "highpass", freq: 2000, freqEnd: 5000, gain: 0.25, pos }); break;
      case "hurt": this.bossVoice("hurt", o.voice, { pos }); break;
      case "seal": this.tone({ type: "sine", freq: 180, freqEnd: 620, dur: 0.9, gain: 0.3, prio: P }); this.tone({ type: "square", freq: 90, freqEnd: 310, dur: 0.9, gain: 0.06, filter: { type: "lowpass", freq: 1400 }, prio: P }); break;
      // ---- (new series, round 2) the phases and the twenty new moves: every
      // warning has its own sound ----
      case "phase":
        this.bossVoice("roar", o.voice, { pos });
        this.tone({ type: "sawtooth", freq: 55, freqEnd: 165, dur: 1.6, gain: 0.28, filter: { type: "lowpass", freq: 900 }, prio: P });
        [220, 262, 311].forEach((f, i) => this.tone({ type: "square", freq: f, dur: 0.5, gain: 0.06, at: 0.2 + i * 0.12, filter: { type: "lowpass", freq: 1500 }, prio: P }));
        break;
      case "clink": this.tone({ type: "triangle", freq: 1900, freqEnd: 1500, dur: 0.12, gain: 0.14, pos }); this.noise({ dur: 0.05, filter: "highpass", freq: 3000, gain: 0.12, pos }); break;
      case "grave_bell": [196, 392, 588].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 2.6 - i * 0.5, gain: 0.22 / (i + 1), attack: 0.005, rev: 0.9, prio: P })); this.bossVoice("growl", o.voice, { pos }); break;
      case "stone_break": this.noise({ dur: 0.35, filter: "bandpass", freq: 900, q: 0.8, gain: 0.5, pos, prio: P }); this.tone({ type: "sine", freq: 120, freqEnd: 50, dur: 0.3, gain: 0.4, pos }); break;
      case "graves": this.bossVoice("growl", o.voice, { pos }); this.noise({ dur: 1.3, filter: "lowpass", freq: 180, freqEnd: 500, gain: 0.45, attack: 0.9, prio: P }); break;
      case "graves_next": this.noise({ dur: 0.9, filter: "lowpass", freq: 220, freqEnd: 520, gain: 0.4, attack: 0.6, prio: P }); break;
      case "erupt": this.noise({ dur: 0.7, filter: "lowpass", freq: 600, freqEnd: 90, gain: 0.8, prio: P }); this.tone({ type: "sine", freq: 70, freqEnd: 32, dur: 0.6, gain: 0.6, prio: P }); break;
      case "orbs": this.tone({ type: "sine", freq: 440, freqEnd: 1320, dur: 1.1, gain: 0.14, vibrato: { rate: 9, depth: 30 }, attack: 0.2, pos, prio: P }); this.tone({ type: "triangle", freq: 660, freqEnd: 1760, dur: 1.1, gain: 0.08, attack: 0.3, pos, prio: P }); break;
      case "orb_pop": this.tone({ type: "sine", freq: 900, freqEnd: 200, dur: 0.18, gain: 0.3, pos }); this.noise({ dur: 0.12, filter: "bandpass", freq: 1800, gain: 0.25, pos }); break;
      case "mirror_wind": [880, 1175, 1480].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 1.1, gain: 0.1, at: i * 0.15, rev: 0.7, prio: P })); this.tone({ type: "sine", freq: 300, freqEnd: 900, dur: 1.0, gain: 0.1, attack: 0.4, prio: P }); break;
      case "mirror_on": this.tone({ type: "triangle", freq: 1760, dur: 0.5, gain: 0.14, vibrato: { rate: 18, depth: 40 }, rev: 0.8, prio: P }); break;
      case "reflect": this.tone({ type: "triangle", freq: 2400, freqEnd: 3200, dur: 0.1, gain: 0.16, pos }); this.tone({ type: "sine", freq: 1200, freqEnd: 600, dur: 0.15, gain: 0.1 }); break;
      case "eye_open": this.tone({ type: "sawtooth", freq: 140, freqEnd: 70, dur: 0.8, gain: 0.2, filter: { type: "lowpass", freq: 800 }, pos, prio: P }); this.noise({ dur: 0.5, filter: "bandpass", freq: 400, gain: 0.25, pos }); break;
      case "school_bell": for (let i = 0; i < 10; i++) this.tone({ type: "square", freq: 1250, dur: 0.07, gain: 0.08, at: i * 0.09, filter: { type: "bandpass", freq: 1500, q: 3 }, prio: P }); this.tone({ type: "sine", freq: 1250, dur: 1.2, gain: 0.1, rev: 0.7, prio: P }); break;
      case "chalk": this.noise({ dur: 0.22, filter: "bandpass", freq: 3200, freqEnd: 4200, q: 2, gain: 0.25, pos }); break;
      case "detention_shut": this.tone({ type: "sine", freq: 90, freqEnd: 40, dur: 0.5, gain: 0.6, prio: P }); this.noise({ dur: 0.3, filter: "lowpass", freq: 700, gain: 0.5, prio: P }); break;
      case "pa": case "pa_again":
        [659, 523, 392].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 0.45, gain: 0.14, at: i * 0.28, rev: 0.6, prio: P }));
        if (name === "pa") this.bossVoice("growl", o.voice, { pos });
        break;
      case "assembly_burn": this.noise({ dur: 1.8, filter: "bandpass", freq: 500, freqEnd: 1800, q: 0.6, gain: 0.4, attack: 0.1, prio: P }); this.tone({ type: "sawtooth", freq: 60, dur: 1.8, gain: 0.1, filter: { type: "lowpass", freq: 300 }, prio: P }); break;
      case "needle_wind": this.noise({ dur: 1.0, filter: "highpass", freq: 4000, freqEnd: 7000, gain: 0.18, attack: 0.6, pos, prio: P }); this.bossVoice("shriek", o.voice, { pos }); break;
      case "needles": for (let i = 0; i < 5; i++) this.noise({ dur: 0.1, filter: "highpass", freq: 4500, gain: 0.25, at: i * 0.03, pos, prio: P }); break;
      case "gurgle": for (let i = 0; i < 8; i++) this.tone({ type: "sine", freq: 120 + Math.random() * 200, freqEnd: 260 + Math.random() * 200, dur: 0.12, gain: 0.18, at: i * 0.1, pos }); this.bossVoice("shriek", o.voice, { pos }); break;
      case "egg_land": this.noise({ dur: 0.25, filter: "lowpass", freq: 700, gain: 0.35, pos }); this.tone({ type: "sine", freq: 200, freqEnd: 90, dur: 0.2, gain: 0.25, pos }); break;
      case "hatch": this.noise({ dur: 0.45, filter: "bandpass", freq: 1200, freqEnd: 400, gain: 0.45, pos, prio: P }); this.bossVoice("shriek", { f: 300, rough: 50, len: 0.6 }, { pos }); break;
      case "ball_wind": this.bossVoice("growl", o.voice, { pos }); this.tone({ type: "sine", freq: 80, freqEnd: 200, dur: 1.0, gain: 0.2, attack: 0.5, prio: P }); break;
      case "throw_heavy": this.noise({ dur: 0.4, filter: "bandpass", freq: 300, freqEnd: 900, gain: 0.5, pos, prio: P }); break;
      case "bounce": this.tone({ type: "sine", freq: 95, freqEnd: 45, dur: 0.4, gain: 0.8, pos, prio: P }); this.noise({ dur: 0.2, filter: "lowpass", freq: 500, gain: 0.4, pos }); break;
      case "line_wind": for (let i = 0; i < 6; i++) this.tone({ type: "sine", freq: 70, freqEnd: 45, dur: 0.25, gain: 0.5, at: i * 0.32, prio: P }); this.bossVoice("roar", o.voice, { pos }); break;
      case "stampede": for (let i = 0; i < 14; i++) this.noise({ dur: 0.12, filter: "lowpass", freq: 260, gain: 0.45, at: i * 0.11 + Math.random() * 0.04, prio: P }); break;
      case "bark": this.tone({ type: "sawtooth", freq: 90, freqEnd: 60, dur: 1.2, gain: 0.14, vibrato: { rate: 20, depth: 10 }, filter: { type: "bandpass", freq: 500, q: 5 }, rev: 0.4, pos, prio: P }); this.bossVoice("growl", o.voice, { pos }); break;
      case "bark_off": this.noise({ dur: 0.6, filter: "bandpass", freq: 700, gain: 0.3, pos }); break;
      case "heart": [0, 0.22].forEach((at) => this.tone({ type: "sine", freq: 62, freqEnd: 40, dur: 0.2, gain: 0.7, at, pos, prio: P })); this.tone({ type: "sine", freq: 520, dur: 0.4, gain: 0.08, rev: 0.7, prio: P }); break;
      case "overgrowth_wind": this.noise({ dur: 1.4, filter: "lowpass", freq: 150, freqEnd: 420, gain: 0.55, attack: 1.0, prio: P }); this.tone({ type: "sawtooth", freq: 70, freqEnd: 90, dur: 1.4, gain: 0.1, vibrato: { rate: 16, depth: 8 }, filter: { type: "lowpass", freq: 400 }, prio: P }); break;
      case "overgrowth": for (let i = 0; i < 8; i++) this.noise({ dur: 0.1, filter: "bandpass", freq: 900 + Math.random() * 900, gain: 0.3, at: i * 0.04, prio: P }); this.tone({ type: "sine", freq: 80, freqEnd: 40, dur: 0.6, gain: 0.6, prio: P }); break;
      case "pylon_wind": this.tone({ type: "sawtooth", freq: 110, freqEnd: 440, dur: 1.2, gain: 0.1, filter: { type: "bandpass", freq: 1200, q: 2 }, attack: 0.3, prio: P }); this.boss("crackle", { pos }); break;
      case "pylon_break": this.noise({ dur: 0.5, filter: "highpass", freq: 2500, gain: 0.4, pos, prio: P }); this.tone({ type: "square", freq: 600, freqEnd: 90, dur: 0.4, gain: 0.08, pos }); break;
      case "arc_charge": for (let i = 0; i < 8; i++) this.noise({ dur: 0.04, filter: "highpass", freq: 3800, gain: 0.14, at: i * 0.08, pos }); break;
      case "zap": this.noise({ dur: 0.35, filter: "highpass", freq: 2200, gain: 0.5, pos, prio: P }); this.tone({ type: "sawtooth", freq: 180, freqEnd: 90, dur: 0.3, gain: 0.12, pos }); break;
      case "arcs_wind": this.tone({ type: "sawtooth", freq: 60, freqEnd: 240, dur: 1.0, gain: 0.12, filter: { type: "lowpass", freq: 900 }, prio: P }); this.boss("crackle", { pos }); break;
      case "lock": [0, 0.07].forEach((at) => this.tone({ type: "square", freq: 2200, dur: 0.04, gain: 0.12, at, prio: P })); break;
      case "spray_wind": this.bossVoice("cackle", o.voice, { pos }); for (let i = 0; i < 3; i++) this.noise({ dur: 0.18, filter: "bandpass", freq: 800, gain: 0.3, at: i * 0.3, pos, prio: P }); break;
      case "gas": this.noise({ dur: 1.4, filter: "highpass", freq: 2500, gain: 0.3, attack: 0.05, pos, prio: P }); this.tone({ type: "sine", freq: 180, freqEnd: 90, dur: 0.4, gain: 0.3, pos }); break;
      case "lights_out": this.tone({ type: "sawtooth", freq: 120, freqEnd: 30, dur: 1.3, gain: 0.2, filter: { type: "lowpass", freq: 800 }, prio: P }); this.tone({ type: "sine", freq: 60, freqEnd: 30, dur: 1.4, gain: 0.35, prio: P }); this.noise({ dur: 0.08, filter: "highpass", freq: 3000, gain: 0.3, at: 1.2, prio: P }); break;
      case "lights_on": this.tone({ type: "sine", freq: 60, freqEnd: 120, dur: 0.8, gain: 0.3, prio: P }); this.tone({ type: "square", freq: 118, dur: 0.6, gain: 0.05, vibrato: { rate: 42, depth: 30 }, filter: { type: "lowpass", freq: 1500 }, prio: P }); break;
      case "whisper": this.noise({ dur: 0.9, filter: "bandpass", freq: 1800, freqEnd: 900, q: 1.5, gain: 0.5, attack: 0.25, pos, rev: 0.5, prio: P }); this.bossVoice("growl", o.voice, { pos }); break;
      case "chain_wind": for (let i = 0; i < 9; i++) this.tone({ type: "triangle", freq: 1400 + Math.random() * 600, dur: 0.06, gain: 0.1, at: i * 0.1, pos, prio: P }); break;
      case "chain_throw": this.noise({ dur: 0.35, filter: "bandpass", freq: 1500, freqEnd: 3000, gain: 0.4, pos, prio: P }); break;
      case "chain_hit": this.tone({ type: "triangle", freq: 700, dur: 0.3, gain: 0.3, prio: P }); this.noise({ dur: 0.25, filter: "bandpass", freq: 2200, gain: 0.35, prio: P }); break;
      case "chain_snap": this.tone({ type: "triangle", freq: 2600, freqEnd: 1200, dur: 0.25, gain: 0.25, pos, prio: P }); this.noise({ dur: 0.2, filter: "highpass", freq: 3000, gain: 0.3, pos }); break;
      case "stamp_wind": this.tone({ type: "sine", freq: 300, freqEnd: 80, dur: 1.0, gain: 0.18, pos, prio: P }); break;
      case "stamp": this.tone({ type: "sine", freq: 65, freqEnd: 30, dur: 0.6, gain: 0.9, pos, prio: P }); this.noise({ dur: 0.4, filter: "lowpass", freq: 900, gain: 0.6, pos, prio: P }); break;
      case "unseal": this.tone({ type: "sine", freq: 620, freqEnd: 110, dur: 1.0, gain: 0.3, prio: P }); this.tone({ type: "square", freq: 310, freqEnd: 55, dur: 1.0, gain: 0.05, filter: { type: "lowpass", freq: 1200 }, prio: P }); break;
    }
  },
  // A sound that lasts as long as a move does (the gaze, a roar, the
  // vortex); stop() fades it out.
  bossLoop(name, o) {
    const ctx = this.ctx, none = { stop() {} };
    if (!ctx) return none;
    o = o || {};
    const t = ctx.currentTime, out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.connect(this._out("sfx", o.pos));
    const nodes = [];
    const osc = (type, f, gain, dest) => { const x = ctx.createOscillator(), g = ctx.createGain(); x.type = type; x.frequency.value = f; g.gain.value = gain; x.connect(g); g.connect(dest || out); x.start(); nodes.push(x); return x; };
    const hiss = (type, f, gain) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuffer(); s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = gain;
      s.connect(fl); fl.connect(g); g.connect(out); s.start(); nodes.push(s); return fl;
    };
    let target = 0.3;
    if (name === "beam") {
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 2; bp.connect(out);
      osc("sawtooth", 110, 0.5, bp); osc("sawtooth", 221, 0.35, bp);
      const lfo = osc("sine", 13, 0, null); const lg = ctx.createGain(); lg.gain.value = 400; lfo.disconnect(); lfo.connect(lg); lg.connect(bp.frequency);
      hiss("highpass", 4000, 0.25);
      target = 0.22;
    } else if (name === "roar") {
      const v = o.voice || { f: 70, rough: 12 };
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.connect(out);
      const a = osc("sawtooth", v.f, 0.6, lp), b = osc("sawtooth", v.f * 1.5, 0.3, lp);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 7; lg.gain.value = v.rough; lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); lfo.start(); nodes.push(lfo);
      hiss("bandpass", 500, 0.5);
      target = 0.42;
    } else if (name === "spray") {
      // (new series, round 2: Acid Sprayer) a hiss with a pump under it
      hiss("bandpass", 1600, 0.5); hiss("highpass", 4200, 0.25);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240; lp.connect(out);
      osc("sawtooth", 55, 0.4, lp);
      target = 0.34;
    } else if (name === "vortex") {
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300; lp.connect(out);
      osc("sine", 46, 0.8, lp); osc("sawtooth", 92, 0.35, lp);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.9; lg.gain.value = 220; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.push(lfo);
      hiss("lowpass", 500, 0.4);
      target = 0.4;
    }
    out.gain.setTargetAtTime(target, t, 0.08);
    return {
      stop() {
        const n = ctx.currentTime;
        out.gain.cancelScheduledValues(n);
        out.gain.setTargetAtTime(0.0001, n, 0.1);
        nodes.forEach((x) => { try { x.stop(n + 0.6); } catch (e) { /* stopped */ } });
      },
    };
  },
  // the cutscenes' sounds
  cine(name, o) {
    if (!this.ctx) return;
    o = o || {};
    const P = true, d = o.dur || 2;
    switch (name) {
      case "sting":
        this.tone({ type: "sine", freq: 44, freqEnd: 30, dur: 2.8, gain: 0.8, rev: 0.8, prio: P });
        [55, 58.3, 82.4, 87.3].forEach((f, i) => this.tone({ type: "sawtooth", freq: f * 2, dur: 3, gain: 0.07, attack: 0.02 + i * 0.05, filter: { type: "lowpass", freq: 700 }, rev: 0.7, bus: "music", prio: P }));
        this.noise({ dur: 2.2, filter: "lowpass", freq: 300, gain: 0.4, attack: 0.02, rev: 0.6, prio: P });
        break;
      case "slow": this.tone({ type: "sine", freq: 320, freqEnd: 50, dur: 0.9, gain: 0.3, prio: P }); this.noise({ dur: 0.9, filter: "lowpass", freq: 2400, freqEnd: 150, gain: 0.35, prio: P }); break;
      case "rumble": this.noise({ dur: d, filter: "lowpass", freq: 130, gain: 0.6, attack: 0.7, prio: P }); this.tone({ type: "sine", freq: 34, freqEnd: 28, dur: d, gain: 0.5, attack: 0.8, prio: P }); break;
      case "crack":
        for (let i = 0; i < 8; i++) this.noise({ dur: 0.05, filter: "bandpass", freq: 1500 + Math.random() * 1500, gain: 0.3, at: i * 0.05, prio: P });
        this.tone({ type: "sine", freq: 95, freqEnd: 40, dur: 0.6, gain: 0.5, prio: P });
        break;
      case "burst": this.explosion(null, true); for (let i = 0; i < 8; i++) this.noise({ dur: 0.07, filter: "bandpass", freq: 800 + Math.random() * 900, gain: 0.25, at: 0.2 + i * 0.1, prio: P }); break;
      case "choir":
        [220, 261.6, 329.6, 493.9].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: d, gain: 0.07, attack: 1.2 + i * 0.2, vibrato: { rate: 4.5 + i * 0.3, depth: f * 0.006 }, bus: "music", rev: 0.9, prio: P }));
        this.tone({ type: "triangle", freq: 110, dur: d, gain: 0.08, attack: 1.5, bus: "music", prio: P });
        break;
      case "gaze":
        this.tone({ type: "sine", freq: 1760, freqEnd: 1700, dur: 1.4, gain: 0.2, rev: 0.8, prio: P });
        this.tone({ type: "triangle", freq: 2637, dur: 1.0, gain: 0.1, rev: 0.8, prio: P });
        this.noise({ dur: 0.3, filter: "highpass", freq: 3000, gain: 0.3, prio: P });
        break;
      case "bell": [392, 787, 1178, 1572, 2360].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 3.8 - i * 0.5, gain: 0.18 / (i + 1), attack: 0.005, rev: 0.9, prio: P })); break;
      case "bang":
        this.noise({ dur: 0.3, filter: "lowpass", freq: 500, gain: 0.8, prio: P });
        this.tone({ type: "square", freq: 64, freqEnd: 40, dur: 0.25, gain: 0.25, filter: { type: "lowpass", freq: 400 }, prio: P });
        this.tone({ type: "sine", freq: 100, dur: 2.5, gain: 0.05, attack: 0.1, prio: P });
        break;
      case "thud": this.tone({ type: "sine", freq: 72, freqEnd: 34, dur: 0.7, gain: 0.95, rev: 0.5, prio: P }); this.noise({ dur: 0.45, filter: "lowpass", freq: 320, gain: 0.6, prio: P }); break;
      case "bubble": for (let i = 0; i < Math.round(d * 5); i++) this.tone({ type: "sine", freq: 180 + Math.random() * 450, freqEnd: 600 + Math.random() * 300, dur: 0.09, gain: 0.12, at: Math.random() * d, prio: P }); this.noise({ dur: d, filter: "lowpass", freq: 250, gain: 0.25, attack: 1, prio: P }); break;
      case "crash":
        this.explosion(null, true);
        for (let i = 0; i < 16; i++) this.noise({ dur: 0.06 + Math.random() * 0.08, filter: "bandpass", freq: 600 + Math.random() * 2400, gain: 0.3, at: 0.08 + Math.random() * 1.2, prio: P });
        break;
      case "skid": this.noise({ dur: 0.7, filter: "bandpass", freq: 900, freqEnd: 250, q: 0.6, gain: 0.5, prio: P }); break;
      case "thump": this.tone({ type: "sine", freq: 85, freqEnd: 50, dur: 0.28, gain: 0.7, prio: P }); break;
      case "creak": this.tone({ type: "sawtooth", freq: 95, freqEnd: 70, dur: 1.4, gain: 0.12, vibrato: { rate: 22, depth: 12 }, filter: { type: "bandpass", freq: 520, q: 6 }, rev: 0.5, prio: P }); break;
      case "ignite": this.tone({ type: "sine", freq: 300, freqEnd: 950, dur: 0.7, gain: 0.25, prio: P }); this.noise({ dur: 0.7, filter: "bandpass", freq: 600, freqEnd: 2400, gain: 0.3, prio: P }); break;
      case "thunder_far": this.noise({ dur: 2.6, filter: "lowpass", freq: 420, freqEnd: 70, gain: 0.35, attack: 0.1, prio: P }); break;
      case "thunder": this.boss("thunder", {}); break;
      case "buzz": this.tone({ type: "square", freq: 118, dur: d, gain: 0.08, vibrato: { rate: 42, depth: 35 }, filter: { type: "lowpass", freq: 1800 }, prio: P }); break;
      case "hiss": this.noise({ dur: d, filter: "highpass", freq: 3200, gain: 0.22, attack: 1.2, prio: P }); this.noise({ dur: d, filter: "bandpass", freq: 700, gain: 0.12, attack: 1.5, prio: P }); break;
      case "wheeze":
        this.noise({ dur: 0.9, filter: "bandpass", freq: 700, freqEnd: 1700, q: 2, gain: 0.35, attack: 0.6, prio: P });
        this.noise({ dur: 0.8, filter: "bandpass", freq: 1500, freqEnd: 500, q: 2, gain: 0.3, at: 0.95, prio: P });
        break;
      case "portal": this.tone({ type: "sine", freq: 48, freqEnd: 115, dur: d, gain: 0.35, attack: 0.8, prio: P }); this.tone({ type: "sawtooth", freq: 96, freqEnd: 230, dur: d, gain: 0.06, attack: 1, filter: { type: "lowpass", freq: 700 }, prio: P }); break;
      case "pop": this.boss("pop", {}); break;
      case "flip": this.noise({ dur: 0.08, filter: "highpass", freq: 2600, gain: 0.14, prio: P }); break;
      case "wind": this.noise({ dur: d, filter: "bandpass", freq: 500, freqEnd: 1300, q: 0.7, gain: 0.35, attack: 0.8, prio: P }); break;
      case "whoosh": this.noise({ dur: 0.6, filter: "bandpass", freq: 350, freqEnd: 2200, gain: 0.45, prio: P }); break;
      case "slash": this.noise({ dur: 0.28, filter: "highpass", freq: 2800, freqEnd: 6500, gain: 0.5, prio: P }); this.tone({ type: "sawtooth", freq: 900, freqEnd: 180, dur: 0.22, gain: 0.15, prio: P }); break;
      case "click": [0, 0.08].forEach((at) => this.tone({ type: "square", freq: 3200, dur: 0.02, gain: 0.12, at, prio: P })); break;
      case "crackle": for (let i = 0; i < Math.round(d * 9); i++) this.noise({ dur: 0.035, filter: "highpass", freq: 3000, gain: 0.08 + 0.2 * (i / (d * 9)), at: i / 9 + Math.random() * 0.05, prio: P }); break;
      case "crack_light": this.tone({ type: "sine", freq: 1300, freqEnd: 2500, dur: 0.35, gain: 0.12, rev: 0.6, prio: P }); this.noise({ dur: 0.06, filter: "highpass", freq: 3000, gain: 0.3, prio: P }); break;
      case "explode":
        this.explosion(null, true);
        this.tone({ type: "sine", freq: 38, freqEnd: 20, dur: 2.2, gain: 0.9, rev: 0.9, prio: P });
        this.noise({ dur: 2.5, filter: "lowpass", freq: 1500, freqEnd: 50, gain: 0.7, rev: 0.9, prio: P });
        break;
      case "card":
        [55, 82.4, 110].forEach((f) => this.tone({ type: "sawtooth", freq: f, dur: 2.2, gain: 0.22, attack: 0.02, filter: { type: "lowpass", freq: 650 }, rev: 0.8, bus: "music", prio: P }));
        this.noise({ dur: 1.4, filter: "lowpass", freq: 500, gain: 0.35, prio: P });
        break;
      case "card_death": [220, 277.2, 329.6, 440].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 2.4, gain: 0.08, attack: 0.05 + i * 0.08, rev: 0.9, bus: "music", prio: P })); break;
    }
  },
  // the bed under an intro: the level's music drops away and a low, beating
  // drone takes over for the ten seconds
  cineBed(on) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime, L = this._level;
    if (on) {
      if (this._bed) return;
      const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(0.5, t, 0.8);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320; lp.connect(out);
      out.connect(this.bus.music);
      const nodes = [41.2, 43.65, 82.4].map((f, i) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = i === 2 ? 0.15 : 0.4; o.connect(g); g.connect(lp); o.start(); return o; });
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.push(lfo);
      this._bed = { out, nodes };
      if (L) L.drone.gain.setTargetAtTime(0.03 * L.T.pad, t, 0.4);
    } else {
      const B = this._bed;
      if (!B) return;
      B.out.gain.setTargetAtTime(0.0001, t, 0.4);
      B.nodes.forEach((n) => { try { n.stop(t + 2); } catch (e) { /* stopped */ } });
      this._bed = null;
      if (L) L.drone.gain.setTargetAtTime(0.16 * L.T.pad, t, 1.5);
    }
  },
  // Each boss fights to a pattern of its own key: a kick, a driving bass, a
  // stab every other bar. Scheduled a little ahead from update().
  BOSS_ROOTS: { gravedigger: 82.4, eye: 87.3, headmaster: 73.4, matron: 92.5, coach: 77.8, thorn: 69.3, storm: 98, chemist: 82.4, void: 65.4, examiner: 87.3 },
  bossMusic(on, def) {
    if (!on) { this._bossMusic = null; return; }
    const ctx = this.ctx;
    this._bossMusic = { root: this.BOSS_ROOTS[def && def.id] || 82.4, step: 0, next: ctx ? ctx.currentTime + 0.1 : 0 };
  },
  _bossMusicTick(now) {
    const M = this._bossMusic;
    if (M.next < now - 0.3) M.next = now + 0.05;             // back from a pause: no pile-up
    const step = 60 / 140 / 4, r = M.root;
    const bassLine = [0, 0, 1, 0, 7, 0, 1, 0, 0, 0, 1, 0, 6, 0, 1, 3];
    while (M.next < now + 0.25) {
      const at = Math.max(0, M.next - now), s = M.step % 16, bar = Math.floor(M.step / 16);
      const semi = (n) => r * Math.pow(2, n / 12);
      if (s % 4 === 0 || s === 10) this.tone({ type: "sine", freq: 62, freqEnd: 30, dur: 0.24, gain: 0.5, at, bus: "music" });
      if (s === 4 || s === 12) this.noise({ dur: 0.16, filter: "bandpass", freq: 1900, gain: 0.2, at, bus: "music" });
      if (s % 2 === 1) this.noise({ dur: 0.035, filter: "highpass", freq: 7000, gain: 0.05, at, bus: "music" });
      if ([0, 3, 6, 8, 11, 14].includes(s)) this.tone({ type: "sawtooth", freq: semi(bassLine[s]), dur: 0.2, gain: 0.16, at, filter: { type: "lowpass", freq: 480 }, bus: "music" });
      if (s === 0 && bar % 2 === 0) [0, 3, 7].forEach((n) => this.tone({ type: "square", freq: semi(n) * 4, dur: 0.35, gain: 0.045, at, filter: { type: "lowpass", freq: 1400 }, bus: "music" }));
      if (s === 8 && bar % 4 === 3) this.tone({ type: "sawtooth", freq: semi(6) * 4, freqEnd: semi(5) * 4, dur: 0.8, gain: 0.05, at, filter: { type: "lowpass", freq: 1600 }, bus: "music" });
      M.step++;
      M.next += step;
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
  // ---------------- the lobby's music (new series, round 2, E) ----------------
  // From the Start screen's tap (the gesture that lets iOS play anything)
  // until a level starts, and again back in the lobby: a slow, dark bed -- a
  // low drone breathing through a filter, a far-off bell now and then, wind
  // on the ambient bus. Generated live, like the rest (G.CONFIG.menuMusic).
  menuMusic(on) {
    const ctx = this.ctx, M = this._menu;
    if (!on) {
      if (!M || !ctx) { this._menu = null; return; }
      const t = ctx.currentTime;
      M.out.gain.setTargetAtTime(0.0001, t, 0.4);
      M.wind.gain.setTargetAtTime(0.0001, t, 0.4);
      M.nodes.forEach((n) => { try { n.stop(t + 1.6); } catch (e) { /* stopped */ } });
      clearInterval(M.timer);
      this._menu = null;
      return;
    }
    if (!ctx || M || this._level) return;
    const C = G.CONFIG.menuMusic, t = ctx.currentTime;
    const S = { nodes: [], next: t + 2.5 };
    S.out = ctx.createGain(); S.out.gain.setValueAtTime(0.0001, t); S.out.gain.setTargetAtTime(C.gain, t, 2.2);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300; lp.Q.value = 2.5;
    lp.connect(S.out); S.out.connect(this.bus.music);
    [[C.root, "sawtooth", 0.32, -6], [C.root * 1.5, "triangle", 0.2, 0], [C.root * 2, "sawtooth", 0.1, 7]].forEach(([f, type, g, det]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = det; og.gain.value = g;
      o.connect(og); og.connect(lp); o.start(); S.nodes.push(o);
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.045; lg.gain.value = 170; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); S.nodes.push(lfo);
    const amb = ctx.createBufferSource(); amb.buffer = this.noiseBuffer(); amb.loop = true;
    const af = ctx.createBiquadFilter(); af.type = "bandpass"; af.frequency.value = 480; af.Q.value = 0.7;
    S.wind = ctx.createGain(); S.wind.gain.setValueAtTime(0.0001, t); S.wind.gain.setTargetAtTime(C.wind, t, 2.5);
    amb.connect(af); af.connect(S.wind); S.wind.connect(this.bus.ambient); amb.start(); S.nodes.push(amb);
    this._menu = S;
    S.timer = setInterval(() => this._menuTick(), 250);
  },
  _menuTick() {
    const ctx = this.ctx, M = this._menu, C = G.CONFIG.menuMusic;
    if (!ctx || !M) return;
    const now = ctx.currentTime;
    const span = (a) => a[0] + Math.random() * (a[1] - a[0]);
    // the bells: a minor pentatonic, far away, now and then -- and now and
    // then nothing at all for a while, for the facility's own sounds
    while (M.next < now + 0.4) {
      const deg = C.bells[Math.floor(Math.random() * C.bells.length)];
      const f = C.root * 8 * Math.pow(2, deg / 12) * (Math.random() < 0.3 ? 2 : 1);
      this.tone({ type: "sine", freq: f, dur: 4.2, gain: C.bellGain, attack: 0.02, bus: "music", at: Math.max(0, M.next - now), filter: { type: "lowpass", freq: 2400 }, rev: 0.9 });
      // (overhaul, round 5) a quieter echo of it, a fifth below, sometimes
      if (Math.random() < 0.35) this.tone({ type: "triangle", freq: f / 1.5, dur: 3, gain: C.bellGain * 0.4, attack: 0.05, bus: "music", at: Math.max(0, M.next - now) + 0.9, filter: { type: "lowpass", freq: 1400 }, rev: 0.9 });
      M.next += span(C.bellGap) + (C.rest && Math.random() < C.rest[0] ? span([C.rest[1], C.rest[2]]) : 0);
    }
    // (round 5) a deep swell from under the floor
    if (C.sub && (M.subAt == null || M.subAt < now)) {
      if (M.subAt != null) this.tone({ type: "sine", freq: C.root / 2, freqEnd: C.root / 2 * 0.94, dur: 6, gain: C.sub.gain, attack: 2.2, bus: "music" });
      M.subAt = now + span(C.sub.every);
    }
    // (round 5) a cold pad, two voices a little out of tune
    if (C.pad && (M.padAt == null || M.padAt < now)) {
      if (M.padAt != null) {
        const deg = C.bells[Math.floor(Math.random() * C.bells.length)], f = C.root * 4 * Math.pow(2, deg / 12);
        [0, 9].forEach((cents) => this.tone({ type: "sine", freq: f, detune: cents, dur: 7, gain: C.pad.gain, attack: 2.8, bus: "music", vibrato: { rate: 0.3, depth: 1.5 }, rev: 0.8 }));
      }
      M.padAt = now + span(C.pad.every);
    }
  },

  startLevel(theme) {
    this.menuMusic(false);
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
    // (visual series, round 3, L1) the forest round the school: the wind in
    // its leaves, heard from the side of it nearest the player -- louder by the
    // fence, faint indoors -- and, now and then, a cricket, an owl or a gust in
    // the trees from somewhere along its edge (this.forestTick)
    if (theme === "school" && G.VISUAL && G.VISUAL.forest) {
      const S = G.VISUAL.forest.sound;
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(); src.loop = true; src.playbackRate.value = 0.8;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.5;
      const hs = ctx.createBiquadFilter(); hs.type = "lowpass"; hs.frequency.value = 5200;
      const gg = ctx.createGain(); gg.gain.value = 0.0001;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 900; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      const pan = this._out("ambient", { x: 0, y: 1.5, z: 0 });
      pan.refDistance = 6; pan.rolloffFactor = 0.9; pan.maxDistance = 90;
      src.connect(bp); bp.connect(hs); hs.connect(gg); gg.connect(pan); src.start();
      L.nodes.push(src, lfo);
      L.forest = { pan, gain: gg, S, next: ctx.currentTime + 3 };
    }
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
    this._bossMusic = null;
    this.cineBed(false);
    // (overhaul, round 3) nothing of the level's goes on ringing: its sounds stop, the ducks and the pause lift
    this.stopAll();
    this._duck = {};
    if (G.Captions) G.Captions.clear();
    this.paused = false;
    this.applyMods();
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
    // (overhaul, round 3) the room (reverb), walls in the way, the crowd, the ducking's end
    if (G.Acoustics) G.Acoustics.update(dt, game);
    this.occlusionTick(dt, game);
    this.hordeTick(dt, game);
    this.duckTick();
    const now = ctx.currentTime;
    // tension: the last wave or two (a boss has music of its own)
    const bossOn = !!this._bossMusic;
    const tense = !bossOn && game.mode === "campaign" && game.wave >= game.level.waves - 1;
    if (bossOn) this._bossMusicTick(now);
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
      if (!bossOn && !this._bed) this.tone({ type: L.T.lead, freq: f, dur: tense ? 0.9 : 2.2, gain: tense ? 0.09 : 0.07, attack: 0.06, bus: "music",
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
    if (L.forest) this.forestTick(L, now, game);
  },

  // (overhaul, round 3) a timed duck that has run out lets the music back up
  // (only on the change: the release keeps its own pace)
  duckTick() {
    const now = this.ctx.currentTime;
    let gone = false;
    Object.keys(this._duck).forEach((r) => { if (this._duck[r] !== Infinity && this._duck[r] < now) { delete this._duck[r]; gone = true; } });
    if (gone && !Object.keys(this._duck).length) this.applyMods();
  },
  // A wall between the player and a sound muffles it: a ray from the ear to
  // the nearest few sounds, a few times a second (G.CONFIG.audio.occlusion
  // by graphics level), against the walls and the shut doors; the change is
  // eased in over ~0.2 s so passing a doorway never cuts a sound off.
  occludedAt(pos) {
    const g = G.Game, O = G.CONFIG.audio.occlusion[this.tier()];
    if (!O || !O[0] || !g || !g.world || !this._lp) return false;
    const d = this._od || (this._od = new THREE.Vector3());
    d.set(pos.x - this._lp.x, pos.y - this._lp.y, pos.z - this._lp.z);
    const len = d.length();
    if (len < 1.2) return false;
    d.multiplyScalar(1 / len);
    return g.wallDistance(this._lp, d, len) < len - 0.35;
  },
  occlusionTick(dt) {
    const O = G.CONFIG.audio.occlusion[this.tier()];
    if (!O || !O[0] || !this._lp) return;
    this._occT = (this._occT || 0) - dt;
    if (this._occT > 0) return;
    this._occT = 1 / O[0];
    this.purge(this.ctx.currentTime);
    const lp = this._lp;
    const near = this.live.filter((v) => v.occ && v.pos)
      .map((v) => ({ v, d: Math.hypot(v.pos.x - lp.x, v.pos.y - lp.y, v.pos.z - lp.z) }))
      .sort((a, b) => a.d - b.d).slice(0, O[1]);
    near.forEach(({ v }) => this.setOccluded(v.occ, this.occludedAt(v.pos)));
  },
  // The crowd: past the few zombies whose own steps and voices are heard, a
  // bed of moaning and shuffling that thickens with how many are close --
  // from where they mostly are
  hordeTick(dt, game) {
    const ctx = this.ctx, H = G.CONFIG.audio.horde, L = this._level;
    if (!L || !game || !game.zombies || !this._lp) return;
    if (!L.horde) {
      const out = ctx.createGain(); out.gain.value = 0.0001;
      const pan = ctx.createPanner(); pan.panningModel = "equalpower"; pan.distanceModel = "inverse"; pan.refDistance = 4; pan.rolloffFactor = 0.6; pan.maxDistance = 60;
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(); src.loop = true; src.playbackRate.value = 0.7;
      const lp = ctx.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = 380; lp.Q.value = 0.7;
      const o1 = ctx.createOscillator(), o1g = ctx.createGain(), o1f = ctx.createBiquadFilter();
      o1.type = "sawtooth"; o1.frequency.value = 84; o1g.gain.value = 0.18; o1f.type = "bandpass"; o1f.frequency.value = 520; o1f.Q.value = 1.2;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.31; lg.gain.value = 16; lfo.connect(lg); lg.connect(o1.frequency);
      src.connect(lp); lp.connect(out); o1.connect(o1f); o1f.connect(o1g); o1g.connect(out);
      out.connect(pan); pan.connect(this.bus.sfx);
      src.start(); o1.start(); lfo.start();
      L.nodes.push(src, o1, lfo);
      L.horde = { out, pan };
    }
    const lp = this._lp;
    let n = 0, cx = 0, cz = 0;
    for (const z of game.zombies) {
      if (!z.alive || z.type === "boss" || !z.mesh) continue;
      const p = z.mesh.position, d = Math.hypot(p.x - lp.x, p.z - lp.z);
      if (d > H.range) continue;
      n++; cx += p.x; cz += p.z;
    }
    const k = Math.min(1, n / H.full);
    L.horde.out.gain.setTargetAtTime(Math.max(0.0001, k * H.gain), ctx.currentTime, 0.4);
    if (n) {
      const P = L.horde.pan, x = cx / n, z = cz / n;
      if (P.positionX) { P.positionX.setTargetAtTime(x, ctx.currentTime, 0.3); P.positionY.value = 1.4; P.positionZ.setTargetAtTime(z, ctx.currentTime, 0.3); } else P.setPosition(x, 1.4, z);
    }
  },

  // (visual series, round 3) the forest's sounds: the bed follows the nearest
  // edge of the wood; a one-shot comes from a point on the edge near the player
  forestTick(L, now, game) {
    const Fo = L.forest, S = Fo.S, Fr = G.Forest;
    if (!Fr || !Fr.built || !game.yawObject) return;
    const p = game.yawObject.position, e = Fr.edgePoint(p.x, p.z, this._fv || (this._fv = new THREE.Vector3()));
    const pn = Fo.pan;
    if (pn.positionX) { pn.positionX.value = e.x; pn.positionY.value = e.y; pn.positionZ.value = e.z; } else pn.setPosition(e.x, e.y, e.z);
    const inside = G.Zones && G.Zones.state && G.Zones.state.inside;
    Fo.gain.gain.setTargetAtTime(S.bed * (inside ? S.indoor : 1), now, 0.6);
    if (now < Fo.next) return;
    Fo.next = now + S.gap[0] + Math.random() * (S.gap[1] - S.gap[0]);
    // somewhere along the edge, within reach (and out in the wood a little)
    const a = Math.random() * 6.283, r = Math.random() * S.reach;
    const q = Fr.edgePoint(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, new THREE.Vector3());
    q.x += Math.cos(a) * 4; q.z += Math.sin(a) * 4;
    const k = inside ? S.indoor : 1, pos = { x: q.x, y: 2 + Math.random() * 4, z: q.z }, x = Math.random();
    if (x < 0.5) {
      // a cricket: a short train of high chirps
      const f = 4200 + Math.random() * 900, n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tone({ type: "sine", freq: f, freqEnd: f * 0.96, dur: 0.045, gain: S.cricket * k, bus: "ambient", at: i * 0.09, pos });
    } else if (x < 0.75) {
      // an owl: two soft hoots, the second lower and longer
      this.tone({ type: "sine", freq: 410, freqEnd: 380, dur: 0.38, gain: S.owl * k, attack: 0.08, bus: "ambient", pos, vibrato: { rate: 6, depth: 4 }, rev: 0.5 });
      this.tone({ type: "sine", freq: 372, freqEnd: 330, dur: 0.7, gain: S.owl * k, attack: 0.1, bus: "ambient", at: 0.5, pos, vibrato: { rate: 5, depth: 5 }, rev: 0.5 });
    } else {
      // a gust through the leaves
      this.noise({ dur: 2.2, filter: "bandpass", freq: 1800, freqEnd: 900, q: 0.6, gain: S.gust * k, attack: 0.7, bus: "ambient", pos });
    }
  },

  // ---------------- speech (J3; vocabulary series round 3, G3) ----------------
  // The device's own voices. The accent setting (Mixed, British, American,
  // Australian) picks among the English ones it really has; an accent it
  // does not have falls back to any English voice (British first). Speed:
  // Normal, or Slow (0.8 of it) -- G.CONFIG.speech.
  // (Round 3, H4) A word is said in its language -- the Word Language:
  // English (the accent above), French (fr-FR first), Chinese (zh-CN first,
  // Mandarin), Thai. A device with no voice for it says nothing, and the
  // modes and questions that are heard are not offered (G.Audio.canSpeak).
  ACCENTS: { british: /^en[-_]GB/i, american: /^en[-_]US/i, australian: /^en[-_]AU/i },
  LANG_RE: { en: /^en/i, fr: /^fr/i, zh: /^(zh|cmn)/i, th: /^th/i },
  PREFER: { fr: /^fr[-_]FR/i, zh: /^(zh[-_](CN|Hans)|cmn)/i, th: /^th/i },
  voices(lang) {
    if (!("speechSynthesis" in window)) return [];
    const re = this.LANG_RE[lang || "en"] || this.LANG_RE.en;
    // (Chinese: Mandarin voices -- not Cantonese, zh-HK)
    return (speechSynthesis.getVoices() || []).filter((v) => re.test(v.lang) && !(lang === "zh" && /HK|yue/i.test(v.lang)));
  },
  accent() { return (G.save && G.save.settings && G.save.settings.accent) || "british"; },
  // does the device have a voice for this accent? (Settings says when not)
  hasAccent(a) { const re = this.ACCENTS[a]; return !re || this.voices().some((v) => re.test(v.lang)); },
  // (round 3) can a word in this language be said here? Before the device has
  // listed its voices (they come a moment after the page opens) it may.
  canSpeak(lang) {
    if (!("speechSynthesis" in window)) return false;
    if (!this._voicesKnown && !(speechSynthesis.getVoices() || []).length) return true;
    return this.voices(lang || "en").length > 0;
  },
  pickVoice(lang) {
    lang = lang || "en";
    const vs = this.voices(lang);
    if (!vs.length) return null;
    if (lang !== "en") { const p = this.PREFER[lang]; return (p && vs.find((v) => p.test(v.lang))) || vs[0]; }
    const a = this.accent(), re = this.ACCENTS[a];
    if (a === "mixed") return vs[Math.floor(Math.random() * vs.length)];
    const own = re ? vs.filter((v) => re.test(v.lang)) : [];
    return own[0] || vs.find((v) => this.ACCENTS.british.test(v.lang)) || vs.find((v) => this.ACCENTS.american.test(v.lang)) || vs[0];
  },
  speechRate() { const C = G.CONFIG.speech; return G.save && G.save.settings.speechSpeed === "slow" ? C.rate * C.slowRate : C.rate; },
  // a word (kept for "hear it again"), or with { text: true } a sentence;
  // opts.lang its language (the Word Language when not given)
  speak(word, opts) {
    if (!word || !("speechSynthesis" in window)) return;
    const vol = this.vol("speech");
    if (vol <= 0.001) return;
    const lang = (opts && opts.lang) || (G.Lang ? G.Lang.word() : "en");
    if (!(opts && opts.text)) { this._lastSpoken = word; this._lastLang = lang; }
    if (!this.canSpeak(lang)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      const v = this.pickVoice(lang);
      u.lang = (v && v.lang) || (G.Lang ? G.Lang.SPEECH[lang] : "en-GB") || "en-GB";
      if (v) { try { u.voice = v; } catch (e) { /* (not a voice the browser listed) */ } }
      u.rate = this.speechRate() * (opts && opts.text ? 0.95 : 0.9); u.pitch = 1; u.volume = Math.min(1, vol);
      speechSynthesis.speak(u);
      this._spokenAt = performance.now();
    } catch (e) { /* speech is a nicety; never let it break the game */ }
  },
  replay() { if (this._lastSpoken) this.speak(this._lastSpoken, { lang: this._lastLang }); },
};
