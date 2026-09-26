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

  // ---- where the player is: the reverb --------------------------------------
  // wet: send level into the room; sec: length; bright: 0 dark .. 1 bright;
  // early: first reflections [delay s, level]
  const ENV = {
    room: { sec: 0.55, bright: 0.55, wet: 0.3, early: [[0.011, 0.5], [0.019, 0.35], [0.028, 0.25]], tail: 0.25 },
    corridor: { sec: 1.0, bright: 0.45, wet: 0.36, early: [0.018, 0.036, 0.054, 0.072, 0.09].map((t, i) => [t, 0.42 * Math.pow(0.72, i)]), tail: 0.45 },
    hall: { sec: 2.2, bright: 0.28, wet: 0.44, early: [[0.03, 0.3], [0.047, 0.24], [0.071, 0.2], [0.11, 0.14]], tail: 0.7 },
    outdoor: { sec: 0.7, bright: 0.3, wet: 0.13, early: [[0.17, 0.35], [0.31, 0.16]], sparse: true, tail: 1.0 },
  };
  function makeIR(ctx, e) {
    const rate = ctx.sampleRate, len = Math.floor(rate * e.sec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // a diffuse tail that dies away; outdoors it is only a whisper
        const env = Math.pow(1 - t, 2.2) * (e.sparse ? 0.25 : 1);
        lp += ((Math.random() * 2 - 1) - lp) * e.bright;
        d[i] = lp * env * 0.5;
      }
      (e.early || []).forEach(([dt, g]) => {
        const i = Math.floor((dt + (c ? 0.0021 : 0)) * rate);
        if (i < len) d[i] += g * (c ? 0.85 : 1);
      });
      // unit energy: the send and wet levels then mean what they say (the
      // node's own normalising made every room nearly dry)
      let en = 0;
      for (let i = 0; i < len; i++) en += d[i] * d[i];
      const sc = 1 / Math.sqrt(en || 1);
      for (let i = 0; i < len; i++) d[i] *= sc;
    }
    return buf;
  }
  function envForRegion(name) {
    if (!name || name === "YARD") return "outdoor";
    if (/^C\d/.test(name)) return "corridor";
    if (/^(ENTRY|BOSS|GAL|LANDING|STAIR)/.test(name)) return "hall";
    return "room";
  }

  G.GunAudio = {
    _prof: {},
    env: null,
    _rev: {},

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

    shot(def, o) {
      const A = G.Audio;
      if (!A.ctx || !def) return;
      o = o || {};
      const p = this.profile(def);
      const k = 0.96 + Math.random() * 0.08;                  // +-4% per shot
      const s = (o.charge != null ? 0.55 + 0.65 * o.charge : 1) * p.gain * 0.85;
      // a fast automatic lays every other round down lighter (no snap, ring,
      // sub or signature): at 14 rounds a second the full stack of layers
      // would crowd everything else out of the voice budget
      const rapid = def.auto && def.fireRate < 130;
      this._n = (this._n || 0) + 1;
      const lite = rapid && this._n % 2 === 1;
      const r = p.rev;
      if (p.crack) A.noise({ dur: p.crack.dur, freq: p.crack.f * k, q: p.crack.q, gain: p.crack.g * s, rev: r * 0.5 });
      if (p.snap && !lite) A.noise({ dur: p.snap.dur, filter: "highpass", freq: p.snap.f * k, gain: p.snap.g * s, rev: r * 0.4 });
      if (p.body) A.tone({ type: p.body.type, freq: p.body.f0 * k, freqEnd: p.body.f1 * k, dur: p.body.dur, gain: p.body.g * s, rev: r,
        filter: p.body.lp ? { type: "lowpass", freq: p.body.lp } : p.body.bp ? { type: "bandpass", freq: p.body.bp * k, q: 2 } : undefined });
      if (p.thump && !lite) A.tone({ type: "sine", freq: p.thump.f0 * k, freqEnd: p.thump.f1 * k, dur: p.thump.dur, gain: p.thump.g * s, rev: r * 0.6 });
      if (p.nbody) A.noise({ dur: p.nbody.dur, filter: "lowpass", freq: p.nbody.lp * k, freqEnd: p.nbody.lpEnd * k, gain: p.nbody.g * s, rev: r });
      if (p.zap) A.tone({ type: "sine", freq: p.zap.f0 * k, freqEnd: p.zap.f1 * k, dur: p.zap.dur, gain: p.zap.g * s, rev: r });
      if (p.whoosh) A.noise({ dur: p.whoosh.dur, freq: p.whoosh.f0 * k, freqEnd: p.whoosh.f1 * k, q: 0.6, gain: p.whoosh.g * s, attack: 0.03, rev: r });
      if (p.ring && !lite) A.tone({ type: "triangle", freq: p.ring.f * k, dur: p.ring.dur, gain: p.ring.g, filter: { type: "bandpass", freq: p.ring.f * k, q: 8 }, rev: r });
      // the big guns' own rolling echo, strongest outdoors where nothing
      // else answers
      if (p.tail) A.noise({ dur: p.tail.dur, filter: "lowpass", freq: p.tail.lp, freqEnd: p.tail.lpEnd, gain: p.tail.g * s * ENV[this.env || "room"].tail, attack: 0.03, at: 0.03 });
      (MECH[p.mech] || MECH.none)(A, p, k);
      if (!lite) p.flavors.forEach((fn) => fn(A, k, s, r));
    },

    // ---- reload steps (triggered by the reload animation's own events) ----
    reload(kind, def) {
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
        case "land": A.tone({ type: "triangle", freq: (tech ? 700 : 520) * m + Math.random() * 120, dur: 0.06, gain: 0.05 }); break;   // spent magazine hits the floor
      }
    },

    // ---- weapon switch: the old one goes away, the new one comes up --------
    swap(from, to, dur) {
      const A = G.Audio;
      if (!A.ctx) return;
      const pf = from ? this.profile(from) : null, pt = this.profile(to);
      const half = Math.max(0.12, (dur || 0.45) * 0.5);
      A.noise({ dur: 0.14, filter: "lowpass", freq: 800, gain: 0.05 });                                  // cloth
      if (pf && pf.tech) A.tone({ type: "sine", freq: 900, freqEnd: 200, dur: 0.2, gain: 0.04 });            // powers down
      else if (pf && pf.arch !== "melee") A.noise({ dur: 0.03, freq: 1500 * pf.mechPitch, q: 2, gain: 0.05, at: 0.05 });
      // and up
      if (pt.arch === "melee") {
        A.noise({ dur: 0.24, filter: "highpass", freq: 4000, freqEnd: 7500, gain: 0.08, at: half, attack: 0.03 });   // shing
        A.tone({ type: "sine", freq: 2600, dur: 0.18, gain: 0.03, at: half + 0.15 });
        return;
      }
      A.noise({ dur: 0.1, filter: "lowpass", freq: 1000, gain: 0.05, at: half - 0.05 });
      if (pt.tech) {
        A.tone({ type: "sine", freq: 250, freqEnd: 1400, dur: 0.22, gain: 0.06, at: half });
        A.tone({ type: "sine", freq: 1760 * pt.mechPitch, dur: 0.05, gain: 0.05, at: half + 0.24 });
      } else {
        const m = pt.mechPitch;
        A.tone({ type: "square", freq: 1200 * m, dur: 0.02, gain: 0.07, at: half + 0.1, filter: { type: "bandpass", freq: 1900 * m, q: 3 } });
        if (pt.size < 0.9) A.tone({ type: "sine", freq: 130 * m, dur: 0.07, gain: 0.12, at: half + 0.05 });   // a heavy one lands in the hands
        if (pt.arch === "shotgun") this.reload("pump", to);
      }
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
        h.o1.connect(h.lp); h.o2.connect(h.lp); h.lp.connect(h.g); h.g.connect(A.bus.sfx);
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

    // ---- the reverb that makes the tail -----------------------------------
    ensureReverb() {
      const A = G.Audio, ctx = A.ctx;
      if (!ctx || A.revIn) return;
      A.revIn = ctx.createGain();
      this.setEnv("room");
    },
    setEnv(kind) {
      const A = G.Audio, ctx = A.ctx;
      if (!ctx || !ENV[kind]) return;
      if (!A.revIn) { this.ensureReverb(); if (this.env === kind) return; }
      if (kind === this.env) return;
      const first = !this.env;
      this.env = kind;
      const now = ctx.currentTime;
      let r = this._rev[kind];
      if (!r) {
        r = this._rev[kind] = { conv: ctx.createConvolver(), g: ctx.createGain(), linked: false };
        r.conv.normalize = false;
        r.conv.buffer = makeIR(ctx, ENV[kind]);
        r.g.gain.value = 0;
        r.conv.connect(r.g); r.g.connect(A.bus.sfx);
      }
      if (!r.linked) { A.revIn.connect(r.conv); r.linked = true; }
      // walking from one space into another crossfades; the first one is simply there
      if (first) r.g.gain.value = ENV[kind].wet;
      else r.g.gain.setTargetAtTime(ENV[kind].wet, now, 0.25);
      // the others fade, then come off the graph so they cost nothing
      Object.keys(this._rev).forEach((k2) => {
        if (k2 === kind) return;
        const o = this._rev[k2];
        o.g.gain.setTargetAtTime(0, now, 0.25);
        setTimeout(() => {
          if (this.env !== k2 && o.linked) { try { A.revIn.disconnect(o.conv); } catch (e) { /* not linked */ } o.linked = false; }
        }, 2500);
      });
    },
    // called from G.Audio.update: where is the player standing?
    _envT: 0,
    updateEnv(dt, game) {
      this._envT -= dt;
      if (this._envT > 0 || !game.world) return;
      this._envT = 0.25;
      const p = game.yawObject.position;
      this.setEnv(envForRegion(G.getRegionAt(game.world, p.x, p.z, p.y - 1.7)));
    },

    // ---- "ทดลองฟังเสียง" in the weapon log -------------------------------
    // A few rounds the way the gun fires them, then its reload.
    preview(def) {
      const A = G.Audio;
      A.unlock();
      if (!A.ctx || !def) return 0;
      this.ensureReverb();
      this.setEnv("room");
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
})();
