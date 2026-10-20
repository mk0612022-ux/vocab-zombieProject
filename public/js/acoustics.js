// ===================================================================
// The room the player is in (overhaul, round 3)
// -------------------------------------------------------------------
// What a shot, a door or a growl sounds like depends on where it is heard.
// Six kinds of space, from the map's own regions (no boxes to draw, no
// sound files for each):
//   corridor      the school's and the hospital's corridors: tight, clear
//   underground   the bunker's corridors: closed in, a longer tail
//   room          a classroom, a toilet, an office: short and clear
//   hall          the entry hall, the gallery, the library, the canteen
//   warehouse     the bunker's big spaces: wide, with distance in it
//   outdoor       the grounds, the forest: little reflection, a slap back
// Each is an impulse response made at load (its RT60, pre-delay, damping,
// early reflections, wet level -- G.CONFIG.audio.zones) for a ConvolverNode.
// Two convolvers take turns (A/B): walking into another space loads the
// idle one and crossfades in about 0.6 s -- never a new node each time.
// By graphics level: Very Low none, Low a simple delay, Medium short
// impulses, High full, Ultra full plus a far echo of shots out of doors
// and in big spaces.
//   G.Acoustics.zoneAt(game)   which space the player is in
//   G.Acoustics.distant()      the far echo's input (or null): js/gunaudio.js
// ===================================================================
window.G = window.G || {};

G.Acoustics = {
  zone: null, mode: null, force: null,
  _ir: {},           // `${zone}|${mode}` -> AudioBuffer
  slots: null,       // the A/B convolvers: [{ conv, gain }], `active`
  _t: 0,

  cfg() { return G.CONFIG.audio; },
  init() {
    const A = G.Audio;
    if (!A.ctx || !A.revIn) return;
    this.build(this.cfg().reverbMode[A.tier()] || "full");
  },

  // the reverb's graph for this graphics level
  build(mode) {
    const A = G.Audio, ctx = A.ctx, C = this.cfg();
    if (!ctx) return;
    this.teardown();
    this.mode = mode;
    if (mode === "off") return;
    if (mode === "delay") {
      // Low: a short slap and a decaying repeat, no convolution
      const d = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), out = ctx.createGain();
      d.delayTime.value = 0.075; fb.gain.value = 0.3; lp.type = "lowpass"; lp.frequency.value = 2400; out.gain.value = 0.25;
      A.revIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out); out.connect(A.bus.reverb);
      this.delay = { d, fb, lp, out };
      return;
    }
    const slot = () => { const conv = ctx.createConvolver(), gain = ctx.createGain(); conv.normalize = false; gain.gain.value = 0; A.revIn.connect(conv); conv.connect(gain); gain.connect(A.bus.reverb); return { conv, gain }; };
    this.slots = [slot(), slot()];
    this.active = 0;
    // Ultra: the far echo -- a shot's send, late and dark, out of doors and in the big spaces
    if (mode === "full+") {
      const D = C.distant, inG = ctx.createGain(), d = ctx.createDelay(1), lp = ctx.createBiquadFilter(), out = ctx.createGain();
      d.delayTime.value = D.delay; lp.type = "lowpass"; lp.frequency.value = D.lowpass; out.gain.value = 0;
      inG.connect(d); d.connect(lp); lp.connect(out); out.connect(A.bus.reverb);
      this.far = { in: inG, out };
    }
    const z = this.zone || "room";
    this.zone = null;
    this.setZone(z, true);
  },
  teardown() {
    const A = G.Audio;
    const off = (n) => { try { n.disconnect(); } catch (e) { /* not connected */ } };
    if (this.slots) this.slots.forEach((s) => { try { A.revIn.disconnect(s.conv); } catch (e) { /* gone */ } off(s.conv); off(s.gain); });
    if (this.delay) { try { A.revIn.disconnect(this.delay.d); } catch (e) { /* gone */ } Object.values(this.delay).forEach(off); }
    if (this.far) Object.values(this.far).forEach(off);
    this.slots = null; this.delay = null; this.far = null;
  },

  // an impulse response, made once per zone (and per Medium's shorter cut)
  ir(zone) {
    const A = G.Audio, ctx = A.ctx, C = this.cfg(), Z = C.zones[zone] || C.zones.room;
    const key = zone + "|" + (this.mode === "short" ? "short" : "full");
    if (this._ir[key]) return this._ir[key];
    const rate = ctx.sampleRate;
    const sec = Math.min(Z.rt60 * 1.1 + Z.predelay, this.mode === "short" ? C.shortMax : 3.6);
    const len = Math.max(64, Math.floor(rate * sec)), pre = Math.floor(Z.predelay * rate);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / rate;
        // the diffuse tail: -60 dB by RT60, darker as it goes (the damping)
        const env = Math.exp(-6.908 * t / Z.rt60) * (Z.sparse ? 0.25 : 1);
        lp += ((Math.random() * 2 - 1) - lp) * Z.bright * (1 - 0.5 * Math.min(1, t / Z.rt60));
        d[i] = lp * env * 0.5;
      }
      // the first reflections, a little apart in each ear
      for (let e = 0; e < Z.early; e++) {
        const i = pre + Math.floor(((e + 1) * Z.spacing * (1 + 0.13 * e) + (c ? 0.0021 : 0)) * rate);
        if (i < len) d[i] += 0.45 * Math.pow(0.72, e) * (c ? 0.85 : 1);
      }
      // unit energy: the wet level then means what it says
      let en = 0;
      for (let i = 0; i < len; i++) en += d[i] * d[i];
      const sc = 1 / Math.sqrt(en || 1);
      for (let i = 0; i < len; i++) d[i] *= sc;
    }
    this._ir[key] = buf;
    return buf;
  },

  // walk into another space: the idle convolver takes the new room and the two crossfade
  setZone(zone, now) {
    const A = G.Audio, ctx = A.ctx, C = this.cfg();
    if (!ctx || zone === this.zone) return;
    this.zone = zone;
    const Z = C.zones[zone] || C.zones.room;
    if (this.delay) { this.delay.out.gain.setTargetAtTime(Z.wet * 0.7, ctx.currentTime, 0.2); this.delay.fb.gain.value = Math.min(0.45, Z.rt60 * 0.18); }
    if (this.far) this.far.out.gain.setTargetAtTime(/outdoor|hall|warehouse/.test(zone) ? C.distant.gain : 0, ctx.currentTime, 0.3);
    if (!this.slots) return;
    const t = ctx.currentTime, fade = now ? 0.005 : C.crossfade;
    const from = this.slots[this.active], toI = 1 - this.active;
    let to = this.slots[toI];
    try { to.conv.buffer = this.ir(zone); }
    catch (e) {
      // (a browser that will not take a second buffer: a fresh convolver in that slot)
      try { A.revIn.disconnect(to.conv); } catch (e2) { /* gone */ }
      const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = this.ir(zone);
      A.revIn.connect(conv); conv.connect(to.gain); to.conv = conv;
    }
    [[from.gain, 0], [to.gain, Z.wet]].forEach(([g, v]) => {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + fade);
    });
    this.active = toI;
    this.switches = (this.switches || 0) + 1;
  },

  // which space the player is in, from the map's regions
  zoneAt(game) {
    const w = game && game.world, C = this.cfg();
    if (!w || !game.yawObject) return "room";
    const p = game.yawObject.position, theme = (game.level && game.level.theme) || "school";
    const name = G.getRegionAt(w, p.x, p.z, p.y - 1.7) || "";
    if (!name || /^YARD/.test(name)) return "outdoor";
    const r = (w.regions || []).find((x) => x.name === name);
    const area = r ? (r.maxX - r.minX) * (r.maxZ - r.minZ) : 60;
    if (/^C\d/.test(name)) return theme === "bunker" ? "underground" : "corridor";
    if (/^(ENTRY|BOSS|GAL|LANDING|STAIR)/.test(name)) return theme === "bunker" ? "warehouse" : "hall";
    const type = w.roomTypeOf && w.roomTypeOf[name];
    if (type === "library" || type === "canteen" || type === "sports") return "hall";
    if (theme === "bunker") return area > 150 ? "warehouse" : area < 45 ? "room" : "underground";
    return area <= C.smallRoom ? "room" : "hall";
  },

  // a few times a second: the graphics level's mode, the player's space
  update(dt, game) {
    const A = G.Audio;
    if (!A.ctx) return;
    const mode = this.cfg().reverbMode[A.tier()] || "full";
    if (mode !== this.mode) this.build(mode);
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.25;
    this.setZone(this.force || this.zoneAt(game));        // (force: the Sound Lab's choice)
  },
  // the far echo's input, when it is on (Ultra, a big space)
  distant() { return this.far && /outdoor|hall|warehouse/.test(this.zone) ? this.far.in : null; },
};
