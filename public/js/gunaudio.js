// ===================================================================
// Gun audio (animation/audio pass C)
// -------------------------------------------------------------------
// Every one of the 85 guns has its own shot, reload and draw sound, all
// synthesised with the Web Audio API (no files). A shot is three layers:
//   1. transient  the crack of the charge going off (band-passed noise,
//                 plus a high snap for the supersonic ones)
//   2. body       the weight of the gun (a falling tone, a sub thump,
//                 low-passed noise)
//   3. tail       the room answering: a send into a reverb that changes with
//                 where the player stands (small room short, corridor
//                 fluttery, big hall long, outdoors almost dry with a slap
//                 back off the building), plus a rolling echo for the big guns
// A gun's voice (profile) starts from its family -- pistol short, light and
// sharp; shotgun deep with a long ring; sniper very sharp with a long tail;
// machine guns short and tight per round; energy and beam guns zaps, lasers,
// charge hums and electric crackle -- then its size (weight class), its
// punch (damage) and its rate of fire shape it, a seed from its id nudges
// every number (so no two share a sound), and its name can add a signature
// layer: the golden SMG sparkles, the Final Bell rings, Flatline beeps, the
// Bone Saw buzzes. Each shot is pitched +-4% at random so a burst never
// repeats one sample.
// Reloads and draws use the same profile: a heavier gun clicks lower, an
// energy weapon powers down and up instead of clacking.
// (overhaul, round 3) A shot is drawn ahead into 2-6 buffers (by graphics
// level) with an OfflineAudioContext and only picked from as it fires: never
// the same twice running, +-3% pitch, +-1 dB. Each family's guns are brought
// within 1.5 dB of its median loudness (measureAll: the Sound Lab). The room
// is the reverb of js/acoustics.js. Everything here is heard from G.Bus:
// weapon:fire (the shot), the reload's markers (each one a voice tagged with
// the reload -- a cancel stops them), the switch, the inspect.
// ===================================================================
(function () {
  function seedRng(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- family voices ------------------------------------------------------
  // crack: band-passed noise burst; snap: high-passed tick; body: a falling
  // tone; thump: sub; nbody: low-passed noise; rev: reverb send; tail: extra
  // rolling echo (big guns); mech: what the action does after the shot
  const BASE = {
    pistol: {
      crack: { f: 2600, q: 1.0, dur: 0.05, g: 0.42 }, snap: { f: 5200, dur: 0.018, g: 0.14 },
      body: { type: "triangle", f0: 200, f1: 62, dur: 0.1, g: 0.32 }, thump: { f0: 110, f1: 50, dur: 0.07, g: 0.2 },
      nbody: { lp: 1900, lpEnd: 500, dur: 0.1, g: 0.2 }, rev: 0.32, mech: "slide", humF: 0,
    },
    smg: {
      crack: { f: 3100, q: 1.2, dur: 0.032, g: 0.36 }, snap: { f: 5600, dur: 0.012, g: 0.1 },
      body: { type: "triangle", f0: 170, f1: 70, dur: 0.06, g: 0.24 }, thump: { f0: 120, f1: 60, dur: 0.045, g: 0.16 },
      nbody: { lp: 2300, lpEnd: 700, dur: 0.065, g: 0.17 }, rev: 0.22, mech: "tick",
    },
    rifle: {
      crack: { f: 2200, q: 0.9, dur: 0.05, g: 0.46 }, snap: { f: 4600, dur: 0.028, g: 0.26 },
      body: { type: "triangle", f0: 145, f1: 48, dur: 0.12, g: 0.33 }, thump: { f0: 92, f1: 40, dur: 0.11, g: 0.28 },
      nbody: { lp: 1700, lpEnd: 420, dur: 0.15, g: 0.24 }, rev: 0.42, mech: "clack",
    },
    lmg: {
      crack: { f: 1750, q: 0.9, dur: 0.045, g: 0.42 }, snap: { f: 4200, dur: 0.02, g: 0.16 },
      body: { type: "sine", f0: 112, f1: 40, dur: 0.12, g: 0.4 }, thump: { f0: 72, f1: 34, dur: 0.12, g: 0.36 },
      nbody: { lp: 1450, lpEnd: 360, dur: 0.14, g: 0.3 }, rev: 0.45, mech: "belt",
    },
    shotgun: {
      crack: { f: 1450, q: 0.7, dur: 0.07, g: 0.52 }, snap: { f: 3600, dur: 0.03, g: 0.18 },
      body: { type: "sine", f0: 98, f1: 34, dur: 0.3, g: 0.58 }, thump: { f0: 62, f1: 30, dur: 0.24, g: 0.5 },
      nbody: { lp: 1350, lpEnd: 260, dur: 0.36, g: 0.58 }, rev: 0.85, mech: "pump",
      tail: { dur: 0.7, lp: 600, lpEnd: 140, g: 0.14 },
    },
    sniper: {
      crack: { f: 3400, q: 0.8, dur: 0.045, g: 0.5 }, snap: { f: 6200, dur: 0.035, g: 0.5 },
      body: { type: "sine", f0: 92, f1: 30, dur: 0.38, g: 0.55 }, thump: { f0: 56, f1: 28, dur: 0.3, g: 0.45 },
      nbody: { lp: 950, lpEnd: 180, dur: 0.5, g: 0.28 }, rev: 1.2, mech: "bolt",
      tail: { dur: 1.1, lp: 700, lpEnd: 130, g: 0.22 },
    },
    launcher: {
      crack: { f: 900, q: 0.8, dur: 0.06, g: 0.3 },
      body: { type: "sine", f0: 135, f1: 44, dur: 0.24, g: 0.6 }, thump: { f0: 70, f1: 36, dur: 0.2, g: 0.4 },
      nbody: { lp: 800, lpEnd: 200, dur: 0.2, g: 0.2 }, rev: 0.6, mech: "breech",
      whoosh: { f0: 600, f1: 2400, dur: 0.42, g: 0.26 },
    },
    cannon: {
      crack: { f: 950, q: 0.7, dur: 0.08, g: 0.4 }, snap: { f: 3000, dur: 0.03, g: 0.2 },
      body: { type: "sine", f0: 72, f1: 26, dur: 0.6, g: 0.78 }, thump: { f0: 48, f1: 22, dur: 0.5, g: 0.55 },
      nbody: { lp: 500, lpEnd: 110, dur: 0.55, g: 0.58 }, rev: 1.05, mech: "breech",
      tail: { dur: 1.3, lp: 380, lpEnd: 90, g: 0.24 },
    },
    energy: {
      crack: { f: 3800, q: 2.5, dur: 0.05, g: 0.16 },
      body: { type: "sawtooth", f0: 920, f1: 180, dur: 0.18, g: 0.2, lp: 3200 }, thump: { f0: 140, f1: 60, dur: 0.12, g: 0.18 },
      zap: { f0: 1850, f1: 420, dur: 0.16, g: 0.16 }, rev: 0.4, mech: "hum", humF: 110, tech: true,
    },
    beam: {
      crack: { f: 5200, q: 1.5, dur: 0.06, g: 0.14 },
      body: { type: "sawtooth", f0: 1400, f1: 380, dur: 0.24, g: 0.18, bp: 1800 }, thump: { f0: 120, f1: 50, dur: 0.1, g: 0.2 },
      zap: { f0: 2800, f1: 900, dur: 0.2, g: 0.11 }, rev: 0.45, mech: "hum", humF: 140, tech: true,
    },
  };

  // ---- signature layers, by name ------------------------------------------
  // (A = G.Audio, k = this shot's pitch, s = charge/size gain, r = reverb send)
  const bell = (A, fs, g, dur, at, r, vib) => fs.forEach((f, i) => A.tone({ type: "sine", freq: f, dur: dur * (1 - i * 0.18), gain: g / (1 + i * 0.6), at, rev: r, vibrato: vib }));
  const metal = (A, f, g, dur, at, r) => A.tone({ type: "square", freq: f, dur, gain: g, at, filter: { type: "bandpass", freq: f * 2.1, q: 9 }, rev: r });
  const hiss = (A, f, g, dur, at, r) => A.noise({ dur, filter: "highpass", freq: f, gain: g, at, attack: 0.01, rev: r });
  const crackle = (A, k, g, n, r) => { for (let i = 0; i < n; i++) A.noise({ dur: 0.018, freq: (2600 + Math.random() * 2600) * k, q: 6, gain: g * (1 - i / n), at: i * 0.017 + Math.random() * 0.006, rev: r }); };
  const FLAVORS = [
    [/golden/, (A, k, s, r) => bell(A, [1318 * k, 1760 * k, 2637 * k], 0.06, 0.28, 0.02, r)],                  // sparkle
    [/final_bell/, (A, k, s, r) => bell(A, [880 * k, 1320 * k, 1760 * k], 0.09, 0.7, 0.03, r, { rate: 18, depth: 6 })],
    [/flatline/, (A, k, s, r) => A.tone({ type: "sine", freq: 1000, dur: 0.9, gain: 0.05, at: 0.25, attack: 0.02, rev: r })],
    [/vital_sign/, (A, k, s, r) => { A.tone({ type: "sine", freq: 1050, dur: 0.07, gain: 0.07, at: 0.12 }); A.tone({ type: "sine", freq: 1050, dur: 0.07, gain: 0.07, at: 0.26 }); }],
    [/code_blue/, (A, k, s, r) => { A.tone({ type: "square", freq: 988, dur: 0.06, gain: 0.04, at: 0.05, filter: { type: "lowpass", freq: 2500 } }); A.tone({ type: "square", freq: 740, dur: 0.06, gain: 0.04, at: 0.12, filter: { type: "lowpass", freq: 2500 } }); }],
    [/bone_saw/, (A, k, s, r) => A.tone({ type: "sawtooth", freq: 110 * k, dur: 0.2, gain: 0.12, vibrato: { rate: 34, depth: 40 }, filter: { type: "lowpass", freq: 1800 }, rev: r })],
    [/nail|syringe|scalpel|gauze|iv_|dialysis|morphine|oxygen|sterile|plaster/, (A, k, s, r) => hiss(A, 2800 * k, 0.09, 0.14, 0.01, r * 0.5)],   // pneumatic / medical
    [/nail/, (A, k, s, r) => A.tone({ type: "triangle", freq: 240 * k, freqEnd: 120, dur: 0.05, gain: 0.14 })],
    [/scrap|rust|rebar|nut_|chain|sledge|breach|blast_door|vent|pipe|locker/, (A, k, s, r) => metal(A, (380 + 520 * Math.random()) * k, 0.05, 0.09, 0.015, r)],  // clank
    [/chain/, (A, k, s, r) => { for (let i = 0; i < 3; i++) A.noise({ dur: 0.015, freq: 3200 * k, q: 4, gain: 0.05, at: 0.03 + i * 0.022 }); }],
    [/chalk/, (A, k, s, r) => A.noise({ dur: 0.18, filter: "lowpass", freq: 900 * k, gain: 0.08, at: 0.01, attack: 0.02, rev: r })],   // a puff of dust
    [/coil|capacitor|arc|defib|thunder|anesthetic|cardiac|reactor/, (A, k, s, r) => { crackle(A, k, 0.09 * s, 6, r); A.tone({ type: "square", freq: 60, dur: 0.16, gain: 0.05, filter: { type: "lowpass", freq: 900 } }); }],
    [/railgun|rail_spike|mag_driver/, (A, k, s, r) => { A.tone({ type: "sine", freq: 700 * k, freqEnd: 3400 * k, dur: 0.06, gain: 0.07 }); metal(A, 1250 * k, 0.05, 0.2, 0.03, r); }],   // coil whine, a twang
    [/prism/, (A, k, s, r) => [1760, 2217, 2637].forEach((f, i) => A.tone({ type: "sine", freq: f * k, freqEnd: f * 0.5 * k, dur: 0.3, gain: 0.05, at: i * 0.015, rev: r }))],
    [/x_ray/, (A, k, s, r) => A.tone({ type: "square", freq: 3900 * k, dur: 0.14, gain: 0.03, vibrato: { rate: 50, depth: 120 }, filter: { type: "highpass", freq: 2500 } })],
    [/gene_splicer/, (A, k, s, r) => A.tone({ type: "sine", freq: 620 * k, freqEnd: 240, dur: 0.3, gain: 0.1, vibrato: { rate: 12, depth: 90 }, rev: r })],
    [/quarantine/, (A, k, s, r) => A.tone({ type: "triangle", freq: 1320 * k, freqEnd: 1100, dur: 0.24, gain: 0.06, vibrato: { rate: 7, depth: 30 }, rev: r })],
    [/principals_verdict|reflex_hammer|sledge|drum_hammer/, (A, k, s, r) => { A.tone({ type: "sine", freq: 190 * k, freqEnd: 120, dur: 0.07, gain: 0.2 }); A.noise({ dur: 0.03, freq: 1100 * k, q: 2, gain: 0.12 }); }],   // a knock
    [/bolt_thrower/, (A, k, s, r) => A.tone({ type: "triangle", freq: 180 * k, dur: 0.22, gain: 0.14, vibrato: { rate: 26, depth: 25 }, rev: r })],   // the string
    [/plague|thermite/, (A, k, s, r) => A.noise({ dur: 0.6, filter: "lowpass", freq: 1300 * k, freqEnd: 400, gain: 0.14, attack: 0.05, at: 0.04, rev: r })],   // fire
    [/autoclave/, (A, k, s, r) => hiss(A, 3500 * k, 0.11, 0.35, 0.05, r)],   // steam
    [/crash_cart/, (A, k, s, r) => { for (let i = 0; i < 4; i++) metal(A, (500 + i * 170) * k, 0.03, 0.05, 0.03 + i * 0.03, r); }],
    [/art_attack/, (A, k, s, r) => A.noise({ dur: 0.12, freq: 480 * k, q: 1.2, gain: 0.14, at: 0.05, rev: r })],   // splat
    [/mortar/, (A, k, s, r) => A.tone({ type: "sine", freq: 58 * k, freqEnd: 30, dur: 0.3, gain: 0.3 })],
    [/meteor|doomsday|warhead/, (A, k, s, r) => A.noise({ dur: 1.6, filter: "lowpass", freq: 260, freqEnd: 50, gain: 0.3, attack: 0.08, at: 0.05, rev: r })],   // rumble
    [/cafeteria/, (A, k, s, r) => metal(A, 900 * k, 0.07, 0.35, 0.02, r)],   // a pan
    [/bus_bulldog/, (A, k, s, r) => A.tone({ type: "sawtooth", freq: 92 * k, freqEnd: 70, dur: 0.16, gain: 0.1, vibrato: { rate: 24, depth: 14 }, filter: { type: "lowpass", freq: 700 } })],   // a growl
    [/bunker_wall/, (A, k, s, r) => metal(A, 330 * k, 0.07, 0.5, 0.05, r)],   // a vault door
    [/hospital_wall/, (A, k, s, r) => A.tone({ type: "sine", freq: 700 * k, freqEnd: 1300 * k, dur: 0.3, gain: 0.05, at: 0.08 })],   // a siren sweep
    [/school_wall|faculty/, (A, k, s, r) => A.noise({ dur: 0.012, freq: 4200, q: 3, gain: 0.06, at: 0.03 })],   // typewriter tick
    [/pop_quiz/, (A, k, s, r) => A.tone({ type: "sine", freq: 620 * k, freqEnd: 160, dur: 0.05, gain: 0.14 })],
    [/hall_monitor/, (A, k, s, r) => A.tone({ type: "sine", freq: 2100 * k, freqEnd: 2500 * k, dur: 0.05, gain: 0.04, at: 0.02 })],   // a whistle chirp
    [/detention/, (A, k, s, r) => A.tone({ type: "square", freq: 220 * k, dur: 0.07, gain: 0.03, at: 0.03, filter: { type: "lowpass", freq: 1500 } })],   // the buzzer
    [/science_fair/, (A, k, s, r) => A.tone({ type: "sine", freq: 420 * k, dur: 0.1, gain: 0.07, vibrato: { rate: 22, depth: 60 } })],   // bubbling
    [/gym_grinder/, (A, k, s, r) => A.tone({ type: "sine", freq: 1800 * k, freqEnd: 2600 * k, dur: 0.035, gain: 0.03 })],   // a sneaker squeak
    [/void/, (A, k, s, r) => A.tone({ type: "sine", freq: 55, freqEnd: 130, dur: 0.22, gain: 0.18, attack: 0.1, rev: r })],   // sucked in
    [/honor_roll/, (A, k, s, r) => metal(A, 1568 * k, 0.04, 0.22, 0.02, r)],
    [/rebound/, (A, k, s, r) => A.tone({ type: "sine", freq: 3100 * k, freqEnd: 1700 * k, dur: 0.16, gain: 0.04, at: 0.05 })],   // ricochet
    [/overwatch|vault|siege/, (A, k, s, r) => A.tone({ type: "sine", freq: 40, freqEnd: 24, dur: 0.5, gain: 0.3 })],
    [/last_stand|tri_burst|service|triage/, (A, k, s, r) => A.noise({ dur: 0.02, filter: "highpass", freq: 6500, gain: 0.08 })],
  ];

  // what the action does right after the shot
  const MECH = {
    slide: (A, p, k) => A.tone({ type: "square", freq: 2300 * p.mechPitch * k, dur: 0.018, gain: 0.04, at: 0.05, filter: { type: "bandpass", freq: 3000, q: 3 } }),
    tick: (A, p, k) => A.noise({ dur: 0.012, freq: 3600 * p.mechPitch * k, q: 3, gain: 0.05, at: 0.028 }),
    clack: (A, p, k) => A.noise({ dur: 0.02, freq: 2600 * p.mechPitch * k, q: 3, gain: 0.07, at: 0.04 }),
    belt: (A, p, k) => { A.noise({ dur: 0.015, freq: 3000 * p.mechPitch * k, q: 4, gain: 0.05, at: 0.035 }); A.noise({ dur: 0.012, freq: 2200 * p.mechPitch, q: 4, gain: 0.04, at: 0.055 }); },
    pump: (A, p, k) => { A.noise({ dur: 0.06, freq: 1000 * p.mechPitch, gain: 0.1, at: 0.34 }); A.noise({ dur: 0.06, freq: 1300 * p.mechPitch, gain: 0.11, at: 0.46 }); },
    bolt: (A, p, k) => { A.noise({ dur: 0.05, freq: 1500 * p.mechPitch, gain: 0.08, at: 0.55 }); A.tone({ type: "square", freq: 800 * p.mechPitch, dur: 0.025, gain: 0.08, at: 0.68, filter: { type: "bandpass", freq: 1300, q: 3 } }); },
    breech: (A, p, k) => A.tone({ type: "square", freq: 600 * p.mechPitch, dur: 0.03, gain: 0.06, at: 0.3, filter: { type: "bandpass", freq: 1000, q: 3 } }),
    hum: (A, p, k) => A.tone({ type: "sine", freq: (p.humF || 120) * 2, freqEnd: (p.humF || 120), dur: 0.25, gain: 0.05, at: 0.05 }),
    none: () => {},
  };

  // (overhaul, round 3) the big guns' own rolling echo, by the space they are
  // fired in (the reverb itself is js/acoustics.js)
  const TAIL = { room: 0.25, corridor: 0.45, underground: 0.55, hall: 0.7, warehouse: 0.85, outdoor: 1.0 };

  // ---- the layers on any context: the game's, or an offline one ------------
  // A synthesiser with G.Audio's tone()/noise() on a context of its own (an
  // OfflineAudioContext), so a shot can be drawn once into a buffer.
  function offlineSynth(ctx, dest, noiseBuf) {
    return {
      tone(o) {
        const t = o.at || 0, osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = o.type || "sine";
        osc.frequency.setValueAtTime(o.freq, t);
        if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + o.dur);
        if (o.detune) osc.detune.value = o.detune;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.3), t + (o.attack || 0.005));
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
        let node = osc;
        if (o.vibrato) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = o.vibrato.rate; lg.gain.value = o.vibrato.depth; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.05); }
        if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filter.type; f.frequency.value = o.filter.freq; f.Q.value = o.filter.q || 1; node.connect(f); node = f; }
        node.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + o.dur + 0.05);
      },
      noise(o) {
        const t = o.at || 0, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
        f.type = o.filter || "bandpass";
        f.frequency.setValueAtTime(o.freq || 1500, t);
        if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqEnd), t + o.dur);
        f.Q.value = o.q || 0.8;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.3), t + (o.attack || 0.004));
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
        src.connect(f); f.connect(g); g.connect(dest);
        src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
      },
    };
  }
  // the root-mean-square and the peak of a buffer, in dBFS
  function levels(buf) {
    const d = buf.getChannelData(0);
    let s = 0, pk = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); s += d[i] * d[i]; if (a > pk) pk = a; }
    // (the RMS of the loud part: the first 150 ms, where a shot is)
    const n = Math.min(d.length, Math.floor(buf.sampleRate * 0.15));
    let s2 = 0; for (let i = 0; i < n; i++) s2 += d[i] * d[i];
    return { rms: 10 * Math.log10(s2 / Math.max(1, n) || 1e-12), peak: 20 * Math.log10(pk || 1e-9), all: 10 * Math.log10(s / d.length || 1e-12) };
  }
  const db = (d) => Math.pow(10, d / 20);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  G.GunAudio = {
    _prof: {},

    profile(def) {
      if (!def) def = G.WEAPON_DEFS.pistol;
      if (this._prof[def.id]) return this._prof[def.id];
      const R = seedRng(def.id + ":voice");
      const j = (a, b) => a + (b - a) * R();
      if (def.id === "melee") {
        const p = { arch: "melee", size: 1, mechPitch: 1, mat: "blade", flavors: [], humF: 0 };
        this._prof[def.id] = p;
        return p;
      }
      const arch = def.archetype || G.inferArchetype(def);
      const B = BASE[arch] || BASE.rifle;
      const wk = G.weightClass(def).key;
      const size = { light: 1.12, medium: 1, heavy: 0.86, very_heavy: 0.74 }[wk] || 1;
      const punch = clamp(0.7 + Math.log10(Math.max(5, def.damage * (def.pellets || 1))) * 0.25, 0.85, 1.4);
      const tight = def.fireRate < 100 ? 0.75 : def.fireRate < 200 ? 0.88 : 1;   // fast guns: short rounds
      const layer = (b, fk, dk) => b && Object.assign({}, b, {
        f: b.f && b.f * fk, f0: b.f0 && b.f0 * fk, f1: b.f1 && b.f1 * fk, lp: b.lp && b.lp * fk, lpEnd: b.lpEnd && b.lpEnd * fk,
        dur: b.dur * dk,
      });
      const p = {
        arch, size, punch, tech: !!B.tech, mat: B.tech ? "tech" : "metal",
        crack: layer(B.crack, j(0.8, 1.25), tight),
        snap: layer(B.snap, j(0.85, 1.2), tight),
        body: layer(B.body, size * j(0.85, 1.18), tight * j(0.85, 1.2) * Math.sqrt(punch)),
        thump: layer(B.thump, size * j(0.88, 1.12), tight * j(0.9, 1.15)),
        nbody: layer(B.nbody, j(0.8, 1.25), tight * j(0.85, 1.2) * Math.sqrt(punch)),
        zap: layer(B.zap, j(0.8, 1.25), j(0.85, 1.2)),
        whoosh: layer(B.whoosh, j(0.8, 1.2), j(0.85, 1.15)),
        tail: B.tail && Object.assign({}, B.tail, { dur: B.tail.dur * j(0.8, 1.25) * punch }),
        rev: B.rev * j(0.85, 1.2) * punch,
        gain: 0.9 + 0.2 * (punch - 0.85) / 0.55,
        // a metallic ring on about half of them, each at its own pitch
        ring: R() < 0.55 ? { f: j(1800, 4200), dur: j(0.05, 0.14), g: j(0.025, 0.06) } : null,
        mech: B.mech, mechPitch: size * j(0.88, 1.14), humF: (B.humF || 120) * j(0.8, 1.3),
        flavors: FLAVORS.filter(([re]) => re.test(def.id)).map(([, fn]) => fn).slice(0, 2),
      };
      if (def.charge) { p.mech = "hum"; p.tech = true; p.mat = "tech"; }
      if (def.pierce && arch !== "beam") p.flavors.push(FLAVORS.find(([re]) => re.test("railgun"))[1]);
      this._prof[def.id] = p;
      return p;
    },

    // a numeric fingerprint of a profile (for checking no two guns match)
    signature(def) {
      const p = this.profile(def);
      const v = (o, k) => (o && o[k]) || 0;
      return [p.arch, v(p.crack, "f"), v(p.body, "f0"), v(p.body, "dur"), v(p.nbody, "lp"), p.rev, p.ring ? p.ring.f : 0, p.flavors.length, p.mech].map((x) => typeof x === "number" ? x.toFixed(3) : x).join("/");
    },

    // (overhaul, round 3) A shot: a buffer drawn ahead (render(), below) --
    // one of its variants, never the same twice running, +-3% in pitch and
    // +-1 dB, brought level with its family -- sent to the room's reverb (and
    // the far echo on Ultra), with the big guns' rolling tail live on top.
    // Before its buffers are ready a gun is synthesised live, as before.
    // o: { charge (0-1), shotId (the event's: one sound a shot) }
    shot(def, o) {
      const A = G.Audio;
      if (!A.ctx || !def) return;
      o = o || {};
      if (o.shotId != null) { if (this._lastShot === o.shotId) return; this._lastShot = o.shotId; }
      const p = this.profile(def), C = G.CONFIG.audio;
      const s = (o.charge != null ? 0.55 + 0.65 * o.charge : 1) * p.gain * 0.85;
      const R = this.cache.get(def.id);
      if (R && R.buffers.length) {
        R.last = performance.now();
        let v = Math.floor(Math.random() * R.buffers.length);
        if (R.buffers.length > 1 && v === R.prev) v = (v + 1 + Math.floor(Math.random() * (R.buffers.length - 1))) % R.buffers.length;
        R.prev = v;
        const rate = 1 + (Math.random() * 2 - 1) * C.gunPitch, gain = s * R.norm * db((Math.random() * 2 - 1) * C.gunGainDb);
        const V = A.buffer(R.buffers[v], { cat: "weapons", prio: 1, rate, gain, rev: p.rev * 0.8, tag: "shot" });
        if (V) {
          const far = G.Acoustics && G.Acoustics.distant();
          if (far) { const sg = A.ctx.createGain(); sg.gain.value = 0.6 * s; V.gains[V.gains.length - 1].connect(sg); sg.connect(far); }
          if (p.tail) A.group({ cat: "weapons", prio: 1 }, () => this.tailLayer(A, p, s));
        }
        this.stats.played++;
        return;
      }
      this.stats.live++;
      // (still drawing its buffers: live, one voice for all its layers)
      A.group({ cat: "weapons", prio: 1, dur: 1.2, tag: "shot" }, () => this.layers(A, def, p, 0.96 + Math.random() * 0.08, s, this.liteShot(def), p.rev));
      this.prepare([def.id]);
    },
    // a fast automatic lays every other round down lighter when it is synthesised live
    liteShot(def) {
      const rapid = def.auto && def.fireRate < 130;
      this._n = (this._n || 0) + 1;
      return rapid && this._n % 2 === 1;
    },
    tailLayer(A, p, s) {
      const zone = (G.Acoustics && G.Acoustics.zone) || "room";
      A.noise({ dur: p.tail.dur, filter: "lowpass", freq: p.tail.lp, freqEnd: p.tail.lpEnd, gain: p.tail.g * s * (TAIL[zone] || 0.3), attack: 0.03, at: 0.03 });
    },
    // the layers of a shot, on any synthesiser (A: G.Audio live, or an offline one);
    // k: its pitch, s: its level, r: its reverb send (0 offline: the room is added live)
    layers(A, def, p, k, s, lite, r) {
      if (p.crack) A.noise({ dur: p.crack.dur, freq: p.crack.f * k, q: p.crack.q, gain: p.crack.g * s, rev: r * 0.5 });
      if (p.snap && !lite) A.noise({ dur: p.snap.dur, filter: "highpass", freq: p.snap.f * k, gain: p.snap.g * s, rev: r * 0.4 });
      if (p.body) A.tone({ type: p.body.type, freq: p.body.f0 * k, freqEnd: p.body.f1 * k, dur: p.body.dur, gain: p.body.g * s, rev: r,
        filter: p.body.lp ? { type: "lowpass", freq: p.body.lp } : p.body.bp ? { type: "bandpass", freq: p.body.bp * k, q: 2 } : undefined });
      if (p.thump && !lite) A.tone({ type: "sine", freq: p.thump.f0 * k, freqEnd: p.thump.f1 * k, dur: p.thump.dur, gain: p.thump.g * s, rev: r * 0.6 });
      if (p.nbody) A.noise({ dur: p.nbody.dur, filter: "lowpass", freq: p.nbody.lp * k, freqEnd: p.nbody.lpEnd * k, gain: p.nbody.g * s, rev: r });
      if (p.zap) A.tone({ type: "sine", freq: p.zap.f0 * k, freqEnd: p.zap.f1 * k, dur: p.zap.dur, gain: p.zap.g * s, rev: r });
      if (p.whoosh) A.noise({ dur: p.whoosh.dur, freq: p.whoosh.f0 * k, freqEnd: p.whoosh.f1 * k, q: 0.6, gain: p.whoosh.g * s, attack: 0.03, rev: r });
      if (p.ring && !lite) A.tone({ type: "triangle", freq: p.ring.f * k, dur: p.ring.dur, gain: p.ring.g, filter: { type: "bandpass", freq: p.ring.f * k, q: 8 }, rev: r });
      // (the big guns' rolling echo: live, by the room -- tailLayer)
      if (p.tail && A === G.Audio) this.tailLayer(A, p, s);
      (MECH[p.mech] || MECH.none)(A, p, k);
      if (!lite) p.flavors.forEach((fn) => fn(A, k, s, r));
    },

    // ---- (overhaul, round 3) shots drawn ahead ---------------------------------
    // A gun's shot is drawn into buffers once (OfflineAudioContext), 2-6
    // variants by graphics level, in the background: the guns in hand when a
    // level starts and any gun the moment it comes to hand. A shot then only
    // picks a buffer -- far cheaper for automatic fire and on an iPad. The
    // last G.CONFIG.audio.gunCache guns are kept.
    cache: new Map(),
    family: {},                      // family -> median loudness (dB), measured over all its guns
    queue: [], busy: false,
    stats: { played: 0, live: 0, rendered: 0, renderMs: 0 },
    prepare(ids) {
      if (!G.Audio.ctx || !(window.OfflineAudioContext || window.webkitOfflineAudioContext)) return;
      ids.forEach((id) => { if (id && id !== "melee" && G.WEAPON_DEFS[id] && !this.cache.has(id) && !this.queue.includes(id)) this.queue.push(id); });
      this.pump();
    },
    pump() {
      if (this.busy || !this.queue.length) return;
      const id = this.queue.shift();
      this.busy = true;
      this.render(G.WEAPON_DEFS[id]).catch(() => null).then(() => { this.busy = false; setTimeout(() => this.pump(), 0); });
    },
    // draw one variant of a shot: k its pitch
    async renderOne(def, k) {
      const A = G.Audio, ctx = A.ctx, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const rate = ctx.sampleRate, len = Math.floor(rate * 1.9);
      const off = new OAC(1, len, rate);
      const S = offlineSynth(off, off.destination, A.noiseBuffer());
      this.layers(S, def, this.profile(def), k, 1, false, 0);
      const raw = await off.startRendering();
      // trimmed after the last sound worth hearing (-70 dB)
      const d = raw.getChannelData(0);
      let end = d.length - 1;
      while (end > 0 && Math.abs(d[end]) < 3e-4) end--;
      const out = ctx.createBuffer(1, Math.min(d.length, end + Math.floor(rate * 0.02)), rate);
      out.getChannelData(0).set(d.subarray(0, out.length));
      return out;
    },
    async render(def) {
      if (!def || this.cache.has(def.id)) return;
      const t0 = performance.now(), C = G.CONFIG.audio;
      const n = C.gunVariants[G.Audio.tier()] || 4;
      if (this._variants == null) this._variants = n;
      const ks = [1, 0.985, 1.015, 0.97, 1.03, 0.993].slice(0, n);
      const buffers = [];
      for (const k of ks) buffers.push(await this.renderOne(def, k));
      const lv = levels(buffers[0]), heard = this.heardDb(def, lv);
      const fam = await this.familyLevel(def);
      // brought within familySpreadDb of its family's loudness
      const diff = heard - fam, spread = C.familySpreadDb;
      const corr = Math.abs(diff) > spread ? -(diff - Math.sign(diff) * spread) : 0;
      this.cache.set(def.id, { buffers, norm: db(corr), rms: heard, peak: lv.peak, corr, last: performance.now(), prev: -1 });
      this.stats.rendered++;
      this.stats.renderMs += performance.now() - t0;
      this.evict();
    },
    // how loud a shot is as it is played: the drawn buffer's RMS (its first
    // 150 ms) plus the gun's own level (profile gain, as shot() plays it)
    heardDb(def, lv) { return lv.rms + 20 * Math.log10(Math.max(1e-6, this.profile(def).gain * 0.85)); },
    // a family's loudness: every gun of it drawn once and measured (once)
    async familyLevel(def) {
      const fam = G.ViewModel.family(def);
      if (this.family[fam] != null) return this.family[fam];
      const all = Object.values(G.WEAPON_DEFS).filter((d) => G.ViewModel.family(d) === fam);
      const rms = [];
      for (const d of all) rms.push(this.heardDb(d, levels(await this.renderOne(d, 1))));
      this.family[fam] = median(rms);
      return this.family[fam];
    },
    evict() {
      const max = G.CONFIG.audio.gunCache, held = new Set((G.Game.player && G.Game.player.gunSlots) || []);
      if (this.cache.size <= max) return;
      const old = [...this.cache.entries()].filter(([id]) => !held.has(id)).sort((a, b) => a[1].last - b[1].last);
      while (this.cache.size > max && old.length) this.cache.delete(old.shift()[0]);
    },
    // (the graphics level changed: the variants are drawn again, if their count did)
    retune() {
      const n = G.CONFIG.audio.gunVariants[G.Audio.tier()] || 4;
      if (n === this._variants) return;
      this._variants = n;
      this.cache.clear();
      this.prepare((G.Game.player && G.Game.player.gunSlots) || []);
    },
    // measure every gun (the Sound Lab, the report): peak and RMS, the family's spread
    async measureAll(onStep) {
      const out = [];
      const all = Object.values(G.WEAPON_DEFS);
      for (const d of all) {
        if (onStep) onStep(out.length, all.length);
        const b = await this.renderOne(d, 1), lv = levels(b), fam = G.ViewModel.family(d);
        const famDb = await this.familyLevel(d);
        const heard = this.heardDb(d, lv), diff = heard - famDb, spread = G.CONFIG.audio.familySpreadDb;
        const corr = Math.abs(diff) > spread ? -(diff - Math.sign(diff) * spread) : 0;
        out.push({ id: d.id, family: fam, peak: +lv.peak.toFixed(1), rms: +heard.toFixed(1), after: +(heard + corr).toFixed(1), famDb: +famDb.toFixed(1) });
      }
      return out;
    },
    warm() { /* (the context is up: the guns in hand are queued by the game) */ },

    // (overhaul, round 3) each mechanical sound is one voice on the weapons
    // bus, tagged with what it belongs to -- a cancelled reload stops its own
    reload(kind, def, tag) { if (G.Audio.ctx) G.Audio.group({ cat: "weapons", prio: 2, dur: 0.5, tag: tag || null }, () => this._reload(kind, def)); },
    holster(from, tag) { if (G.Audio.ctx) G.Audio.group({ cat: "weapons", prio: 2, dur: 0.3, tag: tag || null }, () => this._holster(from)); },
    draw(to, tag) { if (G.Audio.ctx) G.Audio.group({ cat: "weapons", prio: 2, dur: 0.6, tag: tag || null }, () => this._draw(to)); },
    inspect(def, tag) { if (G.Audio.ctx) G.Audio.group({ cat: "weapons", prio: 3, dur: 0.3, tag: tag || null }, () => this._inspect(def)); },

    // ---- reload steps (triggered by the reload animation's own events) ----
    _reload(kind, def) {
      const A = G.Audio;
      if (!A.ctx) return;
      const p = this.profile(def);
      const m = p.mechPitch || 1, tech = p.tech;
      const click = (f, g, at) => A.tone({ type: "square", freq: f * m, dur: 0.025, gain: g, at: at || 0, filter: { type: "bandpass", freq: f * m * 1.6, q: 3 }, rev: 0.12 });
      const heavy = (p.size || 1) < 0.9;
      switch (kind) {
        case "start": A.noise({ dur: 0.16, filter: "lowpass", freq: 700, gain: 0.05 }); break;          // cloth, the hand moving
        case "out":
          if (tech) { A.tone({ type: "sine", freq: 900 * m, freqEnd: 180, dur: 0.22, gain: 0.07 }); click(1500, 0.06, 0.02); }   // cell powers down
          else { click(1300, 0.08); A.noise({ dur: 0.1, freq: 900 * m, gain: 0.1, at: 0.03 }); }
          break;
        case "grab": A.noise({ dur: 0.12, filter: "lowpass", freq: 1100 * m, gain: 0.07 }); break;
        case "in":
          if (tech) { A.noise({ dur: 0.05, freq: 1800, gain: 0.08 }); A.tone({ type: "sine", freq: 300 * m, freqEnd: 1400 * m, dur: 0.2, gain: 0.07, at: 0.04 }); A.tone({ type: "sine", freq: 1760, dur: 0.05, gain: 0.05, at: 0.25 }); }
          else { A.noise({ dur: 0.07, freq: 1500 * m, gain: 0.12 }); click(900, 0.12, 0.05); }
          break;
        case "slap": A.noise({ dur: 0.05, filter: "lowpass", freq: (heavy ? 450 : 600) * m, gain: 0.14 }); break;
        case "bolt":
          if (tech) A.tone({ type: "sawtooth", freq: 180 * m, freqEnd: 420 * m, dur: 0.18, gain: 0.05, filter: { type: "lowpass", freq: 1200 } });   // servo
          else { click(1100, 0.1); A.noise({ dur: 0.06, freq: 2000 * m, gain: 0.07, at: 0.02 }); click(700, 0.14, 0.09); }
          break;
        case "cover": click(800, 0.1); A.noise({ dur: 0.08, freq: 1200 * m, gain: 0.07 }); break;
        case "coverClose": click(600, 0.15); A.tone({ type: "sine", freq: 160 * m, dur: 0.05, gain: 0.08 }); break;
        case "shell":
          if (p.arch === "launcher" || p.arch === "cannon") { A.tone({ type: "sine", freq: 150 * m, freqEnd: 90, dur: 0.08, gain: 0.14 }); click(700, 0.06, 0.02); }
          else { A.noise({ dur: 0.04, freq: 1800 * m, gain: 0.08 }); click(1400, 0.06, 0.03); }
          break;
        case "pump": A.noise({ dur: 0.07, freq: 1000 * m, gain: 0.12 }); A.noise({ dur: 0.07, freq: 1300 * m, gain: 0.13, at: 0.13 }); click(700, 0.1, 0.19); break;
        // (overhaul, round 3) the reload done: a short settle of the hands on the gun
        case "done": A.noise({ dur: 0.08, filter: "lowpass", freq: 900 * m, gain: 0.045 }); if (!tech) click(1700, 0.035, 0.03); break;
        case "land": A.tone({ type: "triangle", freq: (tech ? 700 : 520) * m + Math.random() * 120, dur: 0.06, gain: 0.05 }); break;   // spent magazine hits the floor
      }
    },

    // ---- weapon switch: the old one goes away, the new one comes up --------
    // (overhaul, round 1) a switch is two sounds, each on its own step of the
    // switch (G.WeaponSM): the old gun put away as it starts down...
    _holster(from) {
      const A = G.Audio;
      if (!A.ctx) return;
      const pf = from ? this.profile(from) : null;
      A.noise({ dur: 0.14, filter: "lowpass", freq: 800, gain: 0.05 });                                  // cloth
      if (pf && pf.tech) A.tone({ type: "sine", freq: 900, freqEnd: 200, dur: 0.2, gain: 0.04 });            // powers down
      else if (pf && pf.arch !== "melee") A.noise({ dur: 0.03, freq: 1500 * pf.mechPitch, q: 2, gain: 0.05, at: 0.05 });
    },
    // ...and the new one drawn, at the bottom of the dip as it starts up
    _draw(to) {
      const A = G.Audio;
      if (!A.ctx || !to) return;
      const pt = this.profile(to);
      if (pt.arch === "melee") {
        A.noise({ dur: 0.24, filter: "highpass", freq: 4000, freqEnd: 7500, gain: 0.08, at: 0.05, attack: 0.03 });   // shing
        A.tone({ type: "sine", freq: 2600, dur: 0.18, gain: 0.03, at: 0.2 });
        return;
      }
      A.noise({ dur: 0.1, filter: "lowpass", freq: 1000, gain: 0.05 });
      if (pt.tech) {
        A.tone({ type: "sine", freq: 250, freqEnd: 1400, dur: 0.22, gain: 0.06, at: 0.05 });
        A.tone({ type: "sine", freq: 1760 * pt.mechPitch, dur: 0.05, gain: 0.05, at: 0.29 });
      } else {
        const m = pt.mechPitch;
        A.tone({ type: "square", freq: 1200 * m, dur: 0.02, gain: 0.07, at: 0.15, filter: { type: "bandpass", freq: 1900 * m, q: 3 } });
        if (pt.size < 0.9) A.tone({ type: "sine", freq: 130 * m, dur: 0.07, gain: 0.12, at: 0.1 });   // a heavy one lands in the hands
        if (pt.arch === "shotgun") this._reload("pump", to);
      }
    },
    // a gun shown off (inspect): the hands on it, quietly
    _inspect(def) {
      const A = G.Audio;
      if (!A.ctx || !def) return;
      const p = this.profile(def);
      A.noise({ dur: 0.18, filter: "lowpass", freq: 700, gain: 0.04 });
      if (p.arch !== "melee") A.noise({ dur: 0.03, freq: 1300 * p.mechPitch, q: 2, gain: 0.035, at: 0.12 });
    },

    // ---- charge weapons: a hum that climbs while the trigger is held ------
    // Kept alive by chargeUpdate every frame; if the updates stop (the game
    // pauses, a window opens) it fades out on its own.
    chargeUpdate(def, frac) {
      const A = G.Audio, ctx = A.ctx;
      if (!ctx) return;
      const p = this.profile(def), now = ctx.currentTime;
      let h = this._hum;
      if (!h) {
        h = this._hum = { o1: ctx.createOscillator(), o2: ctx.createOscillator(), lp: ctx.createBiquadFilter(), g: ctx.createGain() };
        h.o1.type = "sawtooth"; h.o2.type = "sine"; h.lp.type = "lowpass";
        h.g.gain.value = 0.0001;
        h.o1.connect(h.lp); h.o2.connect(h.lp); h.lp.connect(h.g); h.g.connect(A.bus.weapons);
        h.o1.start(); h.o2.start();
        const reap = () => {
          if (this._hum !== h) return;
          if (performance.now() - h.last > 900) { try { h.o1.stop(); h.o2.stop(); h.g.disconnect(); } catch (e) { /* already gone */ } this._hum = null; }
          else setTimeout(reap, 400);
        };
        setTimeout(reap, 400);
      }
      h.last = performance.now();
      const f = (p.humF || 120) * (1 + frac * 2.4);
      h.o1.frequency.setTargetAtTime(f, now, 0.04);
      h.o2.frequency.setTargetAtTime(f * 2.01, now, 0.04);
      h.lp.frequency.setTargetAtTime(500 + 3200 * frac, now, 0.05);
      h.g.gain.cancelScheduledValues(now);
      h.g.gain.setTargetAtTime(0.03 + 0.08 * frac, now, 0.03);
      h.g.gain.setTargetAtTime(0.0001, now + 0.12, 0.05);
    },
    chargeStop() {
      const h = this._hum, ctx = G.Audio.ctx;
      if (!h || !ctx) return;
      h.g.gain.cancelScheduledValues(ctx.currentTime);
      h.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
    },

    // ---- the reverb: js/acoustics.js (overhaul, round 3) ---------------------
    // (kept for older callers: a space by name)
    setEnv(kind) { if (G.Acoustics) G.Acoustics.setZone(kind); },
    get env() { return G.Acoustics ? G.Acoustics.zone : null; },

    // ---- "Listen" (sound test) in the weapon log -------------------------------
    // A few rounds the way the gun fires them, then its reload.
    preview(def) {
      const A = G.Audio;
      A.unlock();
      if (!A.ctx || !def) return 0;
      this.setEnv("room");
      this.prepare([def.id]);
      (this._previewTimers || []).forEach(clearTimeout);
      const T = this._previewTimers = [];
      const at = (sec, fn) => T.push(setTimeout(fn, sec * 1000));
      let t = 0;
      if (def.charge) {
        const steps = 16;
        for (let i = 0; i <= steps; i++) at(i * 0.05, () => this.chargeUpdate(def, i / steps));
        t = steps * 0.05 + 0.02;
        at(t, () => { this.chargeStop(); this.shot(def, { charge: 1 }); });
        t += 0.9;
        at(t, () => this.chargeUpdate(def, 0.3));
        at(t + 0.3, () => { this.chargeStop(); this.shot(def, { charge: 0.3 }); });
        t += 1.0;
      } else {
        const burst = def.burst > 1 ? def.burst : 1;
        const volleys = def.auto ? 1 : burst > 1 ? 2 : 3;
        const perVolley = def.auto ? 7 : burst;
        for (let v = 0; v < volleys; v++) {
          for (let i = 0; i < perVolley; i++) {
            at(t, () => this.shot(def));
            t += def.auto ? def.fireRate / 1000 : burst > 1 ? (def.burstDelay || 60) / 1000 : 0;
          }
          t += Math.max(0.35, def.fireRate / 1000);
        }
      }
      // then the reload, on the same beat the animation uses
      const arch = def.archetype || G.inferArchetype(def);
      const style = arch === "pistol" ? "pistol" : arch === "shotgun" ? "shotgun" : arch === "sniper" ? "bolt"
        : arch === "lmg" ? "belt" : (arch === "launcher" || arch === "cannon") ? "launcher" : "rifle";
      const base = (def.reloadTime || 1500) / 1000;
      const events = [{ t: 0, kind: "start" }];
      if (style === "shotgun") {
        const shellT = Math.max(0.2, (base - 0.55) / Math.max(1, def.magSize));
        for (let i = 0; i < 3; i++) events.push({ t: 0.28 + (i + 0.5) * shellT, kind: "shell" });
        events.push({ t: 0.28 + 3 * shellT + 0.2, kind: "pump" });
      } else {
        const K = G.ViewModel.STYLES[style] || G.ViewModel.STYLES.rifle;
        Object.keys(K).forEach((kind) => events.push({ t: K[kind] * base, kind: kind === "drop" ? "land" : kind }));
      }
      t += 0.3;
      events.forEach((e) => at(t + e.t, () => this.reload(e.kind, def)));
      return t + Math.max(...events.map((e) => e.t)) + 0.4;
    },
  };

  // (overhaul, round 1) the weapon's mechanical sounds come from the weapon
  // state machine's events (G.Bus): a reload's steps as its markers arrive
  // (never ahead of the hands, never twice; a cancelled reload sends no
  // more), a switch's put-away and draw, an inspection
  // (overhaul, round 3) and the shot itself: one sound a shot (its shot id),
  // the low-ammo tick once as the magazine crosses a quarter, the refusal when
  // there is nothing left to load; a cancelled reload's sounds stop at once
  const defOf = (id) => (id === "melee" ? G.MELEE_DEF : G.WEAPON_DEFS[id]);
  if (G.Bus) {
    G.Bus.on("weapon:fire", (e) => {
      const def = defOf(e.weaponId);
      G.GunAudio.shot(def, { charge: def && def.charge ? (e.charge || 0) : null, shotId: e.shotId });
      const g = G.Game, a = g && g.player && g.player.ammo[e.weaponId], l = g && g.player && g.player.weaponLevels[e.weaponId];
      if (a && def && l) {
        const thr = Math.floor(Math.round(def.magSize * (l.mag || 1)) * G.CONFIG.audio.lowAmmoShare);
        if (a.mag === thr && thr > 0) G.Audio.sfx("lowammo");
      }
    }, "gunaudio");
    G.Bus.on("weapon:noreserve", () => {
      G.Audio.sfx("deny");
      if (G.UI && G.UI.hudNote) G.UI.hudNote(G.T("hud.noReserve"));
    }, "gunaudio");
    G.Bus.on("weapon:reload", (e) => {
      if (e.phase === "marker" && !e.silent) G.GunAudio.reload(e.kind === "end" ? "done" : e.kind, defOf(e.weaponId), "reload:" + e.reloadId);
      else if (e.phase === "cancel") G.Audio.stopTag("reload:" + e.reloadId);
    }, "gunaudio");
    G.Bus.on("weapon:switch", (e) => {
      if (e.phase === "lower") { G.GunAudio.holster(defOf(e.fromId), "switch:" + e.switchId); G.GunAudio.chargeStop(); G.GunAudio.prepare([e.toId]); }
      else if (e.phase === "swap" || (e.phase === "raise" && e.back)) G.GunAudio.draw(defOf(e.toId), "switch:" + e.switchId);
    }, "gunaudio");
    G.Bus.on("weapon:inspect", (e) => {
      if (e.phase === "start") G.GunAudio.inspect(defOf(e.weaponId), "inspect:" + e.inspectId);
      else G.Audio.stopTag("inspect:" + e.inspectId);
    }, "gunaudio");
  }
})();
