// ===================================================================
// The voices of the reference guns (gun reference pass)
// -------------------------------------------------------------------
// docs/reference/guns/GUN_REFERENCE.md measured the shots of seven guns
// (section 5): where the energy of the first 15 ms sits, of 15-120 ms, of
// 120-600 ms, the sub's own frequency, and how fast it dies away. Each
// prototype of js/gunref.js has a recipe here, built the way the document's
// "starting formula" lays it out:
//
//   trans   the crack: noise between two edges (24 dB/octave), a few ms
//   click   a bright tick on top; hiss: an air hiss (the .45's)
//   ring    a short ring (the polymer pistol's 334 Hz)
//   mid     the crack's own decay, in the band that colours the body
//   body    the thump: a sine falling f0 -> f1, then held, dying away
//   nbody   low-passed noise under it
//   boom    noise in the band above the sub (the .50's 80-250 Hz, spread
//           over the band so the sub stays the lowest peak)
//   tones   steady little whines (the SMG's 219 Hz and 4.6 kHz)
//   mech    the action's own ticks (the belt, the slide, the SMG's bolt)
//   echo    the .50's far echo off the landscape (a delayed, darkened copy)
//   tail    the outdoor roll: low-passed noise, its level held a moment and
//           let go over rt60 -- one generator a gun, so a burst's tails add
//           up into one continuous roar instead of stacking voices
//
// The numbers were tuned against section 5 with tools/gun-sound-check.js
// (render offline the six variants the game plays, measure each exactly as
// the document does, take the median). Every other gun of a prototype is the
// same recipe nudged by its id (jitter) -- band edges +-6%, the sub +-4 Hz,
// the tail +-8% -- so no two are alike and every one still meets section 5
// (the tuning scored a recipe on the worst of its guns). The game plays the
// dry shot as a drawn buffer (js/gunaudio.js) and
// runs the tail live, scaled by the space (outdoors in full, a room a
// quarter: js/acoustics.js adds the room's own reverb).
//
// And the mechanics (section 4): a small kit -- clicks, rings, the hands on
// the gun, scrapes, thumps, a casing landing -- composed into the draw (8-15
// little sounds over 1-1.8 s), each reload's steps, the bolt worked between
// shots, the SMG's magazine check, all 10-20 dB under the shot.
// ===================================================================
window.G = window.G || {};

G.GunVoice = (function () {
  // ---------------- the shot recipes (tuned: tools/gun-sound-check.js) ----------------
  const VOICES = {
    // A belt-fed LMG: dark and heavy, the sub at ~64 Hz, a long rolling roar
    A: {
      trans: { lo: 590, hi: 1610, tau: 0.0054, g: 1 }, click: { f: 2000, q: 2, tau: 0.0012, g: 0.16 },
      mid: { lo: 250, hi: 1220, tau: 0.034, g: 0.55 },
      body: { f0: 115, f1: 61, sweep: 0.043, tau: 0.11, g: 0.5 }, nbody: { lp: 320, tau: 0.04, g: 0.3 },
      mech: [{ f: 4000, q: 5, at: 0.025, tau: 0.004, g: 0.07 }],
      tail: { lp: 850, hp: 45, g: 0.12, attack: 0.03, hold: 0.5, rt60: 3.0, cap: 5 },
      level: 1,
    },
    // B long rifle: a 2.2 kHz crack over a very heavy sub (~57 Hz), a darker tail
    B: {
      trans: { lo: 1300, hi: 3600, tau: 0.0025, g: 1 }, click: { f: 6000, q: 1.5, tau: 0.0008, g: 0.25 }, hiss: { hp: 6000, tau: 0.002, g: 0.15 },
      mid: { lo: 500, hi: 1500, tau: 0.02, g: 0.35 },
      body: { f0: 110, f1: 57, sweep: 0.035, tau: 0.06, g: 0.9 }, nbody: { lp: 500, tau: 0.03, g: 0.25 },
      tail: { lp: 1500, hp: 80, g: 0.2, attack: 0.025, hold: 0.1, rt60: 1.4, cap: 3.2 },
      level: 0,
    },
    // C two-tone SMG: the brightest -- little sub, a 1.6-1.9 kHz body, the bolt's tick
    C: {
      trans: { lo: 700, hi: 2000, tau: 0.002, g: 1 },
      mid: { lo: 1200, hi: 2600, tau: 0.025, g: 0.5 },
      body: { f0: 220, f1: 150, sweep: 0.02, tau: 0.025, g: 0.25 },
      tones: [{ f: 219, tau: 0.03, g: 0.08 }, { f: 4600, tau: 0.02, g: 0.04 }],
      mech: [{ f: 4600, q: 6, at: 0.02, tau: 0.003, g: 0.1 }],
      tail: { lp: 3000, hp: 300, g: 0.25, attack: 0.02, hold: 0.1, rt60: 1.2, cap: 3.2 },
      level: -3,
    },
    // D polymer pistol: a mid "pock" (~750 Hz), sub ~76 Hz, a ring at 334 Hz, the slide
    D: {
      trans: { lo: 300, hi: 1200, tau: 0.0025, g: 1 }, click: { f: 3000, q: 2, tau: 0.0008, g: 0.15 },
      ring: { f: 334, tau: 0.04, g: 0.1 },
      mid: { lo: 300, hi: 1100, tau: 0.03, g: 0.4 },
      body: { f0: 160, f1: 76, sweep: 0.04, tau: 0.045, g: 0.45 }, nbody: { lp: 700, tau: 0.03, g: 0.25 },
      mech: [{ f: 2500, q: 3, at: 0.02, tau: 0.005, g: 0.1 }],
      tail: { lp: 1200, hp: 120, g: 0.3, attack: 0.025, hold: 0.3, rt60: 1.6, cap: 3.2 },
      level: -2,
    },
    // E steel .45: sharp and bright (body ~2.1 kHz), a hiss of air, a short tail
    E: {
      trans: { lo: 1500, hi: 5000, tau: 0.003, g: 1 }, hiss: { hp: 6000, tau: 0.004, g: 0.4 },
      mid: { lo: 1200, hi: 4000, tau: 0.022, g: 0.6 },
      body: { f0: 130, f1: 60, sweep: 0.04, tau: 0.04, g: 0.35 },
      tail: { lp: 2600, hp: 200, g: 0.25, attack: 0.02, hold: 0.05, rt60: 0.9, cap: 3.2 },
      level: -1,
    },
    // F .50 anti-materiel: the biggest -- a long boom, a far echo, ~2 s of rumble
    F: {
      trans: { lo: 1000, hi: 3000, tau: 0.005, g: 1 }, click: { f: 4000, q: 2, tau: 0.0015, g: 0.25 },
      mid: { lo: 500, hi: 1800, tau: 0.045, g: 0.5 },
      body: { f0: 90, f1: 50, sweep: 0.08, tau: 0.1, g: 0.6 }, nbody: { lp: 800, tau: 0.08, g: 0.5 },
      echo: { delay: 0.21, g: 0.25, lp: 800 },
      tail: { lp: 1100, hp: 60, g: 0.2, attack: 0.03, hold: 0.15, rt60: 3.0, cap: 3.2 },
      level: 2,
    },
    // G chassis sniper: sharp and tight -- a 1.7-2 kHz crack, a short dark tail
    G: {
      trans: { lo: 1500, hi: 4000, tau: 0.003, g: 1 }, click: { f: 5000, q: 2, tau: 0.001, g: 0.2 },
      mid: { lo: 800, hi: 2000, tau: 0.03, g: 0.5 },
      body: { f0: 120, f1: 60, sweep: 0.05, tau: 0.05, g: 0.4 }, nbody: { lp: 900, tau: 0.03, g: 0.25 },
      tail: { lp: 1000, hp: 150, g: 0.25, attack: 0.025, hold: 0.08, rt60: 0.9, cap: 3.2 },
      level: 1,
    },
  };
  // the two scoped snipers take the chassis sniper's voice (section 3.8: the
  // clip's own sound was a battlefield) -- the dark one a little darker
  VOICES.H = JSON.parse(JSON.stringify(VOICES.G));
  VOICES.I = JSON.parse(JSON.stringify(VOICES.G));
  VOICES.I.trans.lo = 1300; VOICES.I.trans.hi = 3400; VOICES.I.body.g *= 1.1;

  // (tuned against section 5 by tools/gun-sound-check.js tune(): two passes on
  // the reference gun's stand-in, then the ones that left a gun of theirs
  // outside -- D, F, G (and so H), C -- on all their guns at once. `level`
  // (dB, the gain it is played at) puts each shot where its prototype is
  // heard -- G.CONFIG.gunRef.baseDb + loud -- so js/gunaudio.js's correction
  // is only the odd decibel, and a shot played live before its buffers are
  // drawn is about as loud as the drawn one)
  const TUNED = {
    A: {"trans":{"lo":563.4479368497925,"hi":777.7460696237742,"tau":0.00814773968882751,"g":0.8609686685103746},"click":{"f":1768.4767683712782,"q":2,"tau":0.0012,"g":0.175445264397268},"mid":{"lo":315.56646908470225,"hi":1694.833804822726,"tau":0.033577637627209965,"g":0.8072740132957669},"body":{"f0":124.58714705192695,"f1":61,"sweep":0.05394486484174324,"tau":0.12345547702743705,"g":0.5},"nbody":{"lp":236.86077934907792,"tau":0.04216934703532762,"g":0.3021685473798586},"mech":[{"f":4000,"q":5,"at":0.025,"tau":0.004,"g":0.0771142567766745}],"tail":{"lp":846.709772282916,"hp":37.475356091861336,"g":0.10950987890039995,"attack":0.03,"hold":0.5129110244342995,"rt60":4.1605778186079005,"cap":4.116916436113392},"level":-12.6},
    B: {"trans":{"lo":1710.4824815536247,"hi":4789.883890394975,"tau":0.004249376073288156,"g":2.264676718990155},"click":{"f":6467.722285233433,"q":1.5,"tau":0.0008,"g":0.10652902475222571},"hiss":{"hp":6000,"tau":0.002,"g":0.5773283415909177},"mid":{"lo":772.9307000668786,"hi":2495.1505025765937,"tau":0.038389997558428667,"g":0.5676020879159446},"body":{"f0":136.42032942102674,"f1":57.51755262136034,"sweep":0.03206350586448696,"tau":0.10598056942633534,"g":0.7524484800360192},"nbody":{"lp":324.0797995025899,"tau":0.01768038846147893,"g":0.2628513093810405},"tail":{"lp":842.3615711881512,"hp":106.85333504579663,"g":0.20632411643178658,"attack":0.025,"hold":0.19198949792202974,"rt60":1.2467602032287939,"cap":5.166801978876254},"level":-17.6},
    C: {"trans":{"lo":491.6819755015931,"hi":1461.5694482315967,"tau":0.0010006930606440592,"g":1.3617371799545475},"mid":{"lo":988.2058057941347,"hi":2245.154801013214,"tau":0.012877248313668755,"g":0.513980107700808},"body":{"f0":288.7301032204011,"f1":181.85053076439135,"sweep":0.02126208619086401,"tau":0.06147019985462056,"g":0.5600937136155831},"tones":[{"f":219,"tau":0.03,"g":0.09221252960376085},{"f":4600,"tau":0.02,"g":0.037013479151303354}],"mech":[{"f":4600,"q":6,"at":0.02,"tau":0.003,"g":0.1487751533370263}],"tail":{"lp":3062.0328791893853,"hp":166.0463854081522,"g":0.2204739027294296,"attack":0.02,"hold":0.25816360124954246,"rt60":1.7449491109973285,"cap":8.323883259168307},"level":-17},
    D: {"trans":{"lo":274.3862872505543,"hi":1486.8393359225574,"tau":0.0019593932586847904,"g":2.3583838043359564},"click":{"f":2800.200490556482,"q":2,"tau":0.0008,"g":0.11689843147105336},"ring":{"f":334,"tau":0.04,"g":0.1164266253977726},"mid":{"lo":320.8281750035994,"hi":1147.2534249109617,"tau":0.03911313764211809,"g":0.7090043541273601},"body":{"f0":180.01867131304212,"f1":76,"sweep":0.02936172295198354,"tau":0.08479689040745322,"g":0.4848036329586864},"nbody":{"lp":669.5641029020913,"tau":0.02631622739400901,"g":0.2052081645893551},"mech":[{"f":2500,"q":3,"at":0.02,"tau":0.005,"g":0.089127575791738}],"tail":{"lp":1053.0156087256114,"hp":112.36864619756649,"g":0.2657638957628603,"attack":0.025,"hold":0.297525510125298,"rt60":1.7511603039401369,"cap":2.7823847377510242},"level":-20.2},
    E: {"trans":{"lo":1016.5607784781589,"hi":3651.657336318997,"tau":0.0024850799659745615,"g":1.1599762484295655},"hiss":{"hp":6000,"tau":0.004,"g":0.18145143281444154},"mid":{"lo":1640.529556578448,"hi":4333.213543758784,"tau":0.03966446648769883,"g":0.739588598897659},"body":{"f0":140.7604163480263,"f1":59.52230075206913,"sweep":0.050492725460141406,"tau":0.04843487419157864,"g":0.7550438661478427},"tail":{"lp":1916.9036312766798,"hp":88.73836337841149,"g":0.19634248106138022,"attack":0.02,"hold":0.17039843874036464,"rt60":1.9414557275424509,"cap":4.7792799244520054},"level":-17.8},
    F: {"trans":{"lo":1384.8593627701734,"hi":2443.3094565595093,"tau":0.01171887159207826,"g":0.983482944009538},"click":{"f":3377.755126668569,"q":2,"tau":0.0015,"g":0.4167765589005534},"mid":{"lo":566.5867200227772,"hi":3557.237408154426,"tau":0.016737265057683876,"g":0.24853309508832327},"body":{"f0":62.81868604030997,"f1":52.69982091475675,"sweep":0.05209449098024702,"tau":0.09949222926120774,"g":0.20550417947056998},"nbody":{"lp":1155.353628321398,"tau":0.05259310620420635,"g":0.5727745736181336},"boom":{"lo":80.92454076510272,"hi":250,"tau":0.09883998144525907,"g":0.12},"echo":{"delay":0.21,"g":0.24012845496583834,"lp":800},"tail":{"lp":1123.4842285887598,"hp":90.32074646526578,"g":0.23404490906610798,"attack":0.03,"hold":0.2356670627912197,"rt60":1.9028758209050913,"cap":4.979321296723577},"level":-7},
    G: {"trans":{"lo":1965.2048638198555,"hi":2784.461525237858,"tau":0.0039736052976792465,"g":0.6198517416768046},"click":{"f":4102.405221705261,"q":2,"tau":0.001,"g":0.16382587069200089},"mid":{"lo":786.5457159974134,"hi":4077.101894701577,"tau":0.0301974118865631,"g":0.9331929536289687},"body":{"f0":120.00743639175982,"f1":84.3339757524202,"sweep":0.0457266068798084,"tau":0.029190917489608108,"g":0.5757781041833753},"nbody":{"lp":821.878677400747,"tau":0.0380218961380667,"g":0.23371466093862636},"tail":{"lp":1074.66543971709,"hp":132.47381947279516,"g":0.24292077356930972,"attack":0.025,"hold":0.10313593566119832,"rt60":1.0636142269390902,"cap":3.0223871427805173},"level":-11.6},
    I: {"trans":{"lo":1397.1639010155131,"hi":3452.6191893662367,"tau":0.003845441607830819,"g":1.0659309151517427},"click":{"f":4411.819544100185,"q":2,"tau":0.001,"g":0.14735579087045372},"mid":{"lo":1453.2342927895886,"hi":2249.5606268367487,"tau":0.041014836309403196,"g":0.6517684824005965},"body":{"f0":140.63420341343001,"f1":66.16043195687995,"sweep":0.07996905464324489,"tau":0.0510436677402519,"g":0.451798018446074},"nbody":{"lp":1452.1293157403618,"tau":0.02377127768094795,"g":0.1668811146418881},"tail":{"lp":1063.34393706584,"hp":163.84106666421408,"g":0.23969745508882415,"attack":0.025,"hold":0.1320388759385896,"rt60":1.2512522707951839,"cap":5.506511410489309},"level":-12.8}
  };
  Object.assign(VOICES, TUNED);
  VOICES.H = JSON.parse(JSON.stringify(VOICES.G));

  // ---------------- one gun's voice: its prototype's, nudged by its id ----------------
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
  // A gun's own nudge of its prototype's recipe (in place), seeded by its id:
  // each gun of a prototype a little different -- small enough that every one
  // still meets section 5 (tools/gun-sound-check.js runAll; its tune() scores
  // a recipe on these nudged copies too)
  function jitter(v, id) {
    const R = seedRng(id + ":voice"), j = (a, b) => a + (b - a) * R();
    const band = j(0.94, 1.06);
    ["trans", "mid"].forEach((k) => { if (v[k]) { if (v[k].lo) v[k].lo *= band; if (v[k].hi) v[k].hi *= band; } });
    if (v.click) v.click.f *= j(0.94, 1.06);
    if (v.body) { const d = j(-4, 4); v.body.f1 += d; v.body.f0 *= (v.body.f1 / (v.body.f1 - d)); v.body.tau *= j(0.93, 1.07); }
    if (v.tail) { v.tail.rt60 *= j(0.92, 1.08); v.tail.g *= j(0.93, 1.07); v.tail.lp *= j(0.94, 1.06); }
    (v.mech || []).forEach((m) => { m.f *= j(0.9, 1.1); m.at *= j(0.85, 1.15); });
    ["trans", "click", "mid", "body", "nbody"].forEach((k) => { if (v[k]) v[k].g *= j(0.93, 1.07); });
    return v;
  }
  const cache = {};
  function voiceFor(def) {
    const I = G.GunRef && G.GunRef.info(def);
    if (!I || !VOICES[I.proto]) return null;
    if (cache[def.id]) return cache[def.id];
    const v = JSON.parse(JSON.stringify(VOICES[I.proto]));
    v.proto = I.proto;
    // the stand-in for the clip's gun is the recipe itself
    if (!I.flagship) jitter(v, def.id);
    cache[def.id] = v;
    return v;
  }

  // ---------------- drawing a voice (any context: an offline one, or the game's) ----------------
  // a white noise buffer for a context (seeded, so a render can be repeated)
  const noiseData = {};
  function noiseFor(ctx, seed) {
    const key = ctx.sampleRate + ":" + (seed || 1);
    let d = noiseData[key];
    if (!d) {
      const R = seedRng("noise:" + (seed || 1));
      d = noiseData[key] = new Float32Array(ctx.sampleRate * 2);
      for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    }
    const b = ctx.createBuffer(1, d.length, ctx.sampleRate);
    b.getChannelData(0).set(d);
    return b;
  }
  // an envelope: up in `atk`, then away with time constant `tau`
  function env(param, t, peak, atk, tau) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + atk);
    param.setTargetAtTime(0, t + atk, tau);
  }
  function filt(ctx, node, type, f, q) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = Math.min(ctx.sampleRate * 0.45, Math.max(10, f)); b.Q.value = q == null ? 0.707 : q;
    node.connect(b);
    return b;
  }
  // A noise layer's gain is by its loudness, not its raw amplitude: white
  // noise kept to a narrow band keeps only that share of its power, so it is
  // lifted by sqrt(3 / (2 x share)) -- then g 1 is as loud (RMS) as a sine of
  // amplitude 1, whatever the band, and the recipes compare like with like.
  function bandShare(L, k, sr) {
    const ny = sr / 2;
    let lo = 0, hi = ny;
    if (L.lo) lo = Math.max(lo, L.lo * k);
    if (L.hp) lo = Math.max(lo, L.hp * k);
    if (L.hi) hi = Math.min(hi, L.hi * k);
    if (L.lp) hi = Math.min(hi, L.lp * k);
    if (L.f) { const bw = (L.f * k / (L.q || 3)) * Math.PI / 2; lo = Math.max(lo, L.f * k - bw / 2); hi = Math.min(hi, L.f * k + bw / 2); }
    return Math.max(0.002, (hi - lo) / ny);
  }
  const loud = (L, k, sr) => Math.min(40, Math.sqrt(3 / (2 * bandShare(L, k, sr))));
  // a noise layer: { lo, hi (edges, 24 dB/octave), lp, hp, f + q (a band), at, atk, tau, g }
  function noiseLayer(ctx, dest, L, t, k, noise, R) {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    let n = src;
    if (L.lo) { n = filt(ctx, n, "highpass", L.lo * k); n = filt(ctx, n, "highpass", L.lo * k); }
    if (L.hi) { n = filt(ctx, n, "lowpass", L.hi * k); n = filt(ctx, n, "lowpass", L.hi * k); }
    if (L.lp) { n = filt(ctx, n, "lowpass", L.lp * k); n = filt(ctx, n, "lowpass", L.lp * k); }
    if (L.hp) n = filt(ctx, n, "highpass", L.hp * k);
    if (L.f) n = filt(ctx, n, "bandpass", L.f * k, L.q || 3);
    const g = ctx.createGain();
    n.connect(g); g.connect(dest);
    const ts = t + (L.at || 0), atk = L.atk || 0.0004;
    env(g.gain, ts, L.g * loud(L, k, ctx.sampleRate), atk, L.tau);
    src.start(ts, (R ? R() : Math.random()) * 1.5);
    src.stop(ts + atk + L.tau * 9 + 0.01);
  }
  // a sine (or any oscillator): { f0, f1, sweep } or { f }, at, atk, tau, g
  function toneLayer(ctx, dest, L, t, k) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = L.type || "sine";
    const ts = t + (L.at || 0);
    osc.frequency.setValueAtTime((L.f0 || L.f) * k, ts);
    if (L.f1 && L.sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, L.f1 * k), ts + L.sweep);
    osc.connect(g); g.connect(dest);
    const atk = L.atk || 0.0015;
    env(g.gain, ts, L.g, atk, L.tau);
    osc.start(ts); osc.stop(ts + atk + L.tau * 9 + 0.01);
  }
  // the dry shot at time t: everything but the tail
  function renderDry(ctx, dest, v, t, k, noise, R) {
    const mix = ctx.createGain();
    mix.connect(dest);
    if (v.trans) noiseLayer(ctx, mix, v.trans, t, k, noise, R);
    if (v.click) noiseLayer(ctx, mix, v.click, t, k, noise, R);
    if (v.hiss) noiseLayer(ctx, mix, v.hiss, t, k, noise, R);
    if (v.mid) noiseLayer(ctx, mix, v.mid, t, k, noise, R);
    if (v.nbody) noiseLayer(ctx, mix, v.nbody, t, k, noise, R);
    if (v.boom) noiseLayer(ctx, mix, v.boom, t, k, noise, R);
    if (v.ring) toneLayer(ctx, mix, v.ring, t, k);
    if (v.body) toneLayer(ctx, mix, v.body, t, k);
    (v.tones || []).forEach((L) => toneLayer(ctx, mix, L, t, k));
    (v.mech || []).forEach((L) => noiseLayer(ctx, mix, L, t, k, noise, R));
    if (v.echo) {
      const dl = ctx.createDelay(1);
      dl.delayTime.value = v.echo.delay;
      mix.connect(dl);
      const lp1 = filt(ctx, dl, "lowpass", v.echo.lp), lp2 = filt(ctx, lp1, "lowpass", v.echo.lp);
      const eg = ctx.createGain(); eg.gain.value = v.echo.g;
      lp2.connect(eg); eg.connect(dest);
    }
  }

  // ---------------- the tail: one generator a gun ----------------
  // Its level is energy: a new shot adds its own to what is still ringing,
  // so a burst builds up and holds, and only the last shot's release is heard
  // going away. st: { peak, t1 (the hold's end), tau }.
  function tailLevel(st, t) {
    if (!st || !(st.peak > 0)) return 0;
    if (t <= st.t1) return st.peak;
    return st.peak * Math.exp(-(t - st.t1) / st.tau);
  }
  // (cap: how far a burst can build it over one shot's -- the LMG's roar most)
  function scheduleTail(param, st, t, L, T) {
    const cur = tailLevel(st, t);
    const peak = Math.min(Math.sqrt(cur * cur + L * L), L * (T.cap || 3.2));
    const tau = T.rt60 / 6.908;
    const t1 = t + T.attack + (T.hold || 0);
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(1e-5, cur), t);
    param.linearRampToValueAtTime(peak, t + T.attack);
    if (T.hold) param.setValueAtTime(peak, t1);
    param.setTargetAtTime(0, t1, tau);
    return { peak, t1, tau };
  }
  // the generator's nodes: noise -> a gentle high-pass -> two low-passes -> its gain
  function tailNodes(ctx, dest, T, k, noise) {
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    let n = filt(ctx, src, "highpass", T.hp ? T.hp * k : 35);
    n = filt(ctx, n, "lowpass", T.lp * k); n = filt(ctx, n, "lowpass", T.lp * k);
    // (by loudness, as the layers are)
    const norm = ctx.createGain();
    norm.gain.value = loud({ lp: T.lp, hp: T.hp || 35 }, k, ctx.sampleRate);
    const g = ctx.createGain();
    g.gain.value = 0;
    n.connect(norm); norm.connect(g); g.connect(dest);
    return { src, gain: g };
  }

  // ---------------- a whole render, offline ----------------
  // o: { shots: [t, ...] (s), k (pitch), tail (with the tail), dur (s),
  //      sampleRate, seed (the noise), tailScale (the space: 1 outdoors) }
  // -> an AudioBuffer (mono)
  async function render(v, o) {
    o = o || {};
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = o.sampleRate || 48000, shots = o.shots || [0.01];
    const last = shots[shots.length - 1];
    const len = Math.ceil(sr * (o.dur || last + (o.tail === false || !v.tail ? 0.9 : Math.min(4.5, v.tail.rt60 * 1.1 + 0.5))));
    const ctx = new OAC(1, len, sr);
    const noise = noiseFor(ctx, o.seed || 1), R = seedRng("layers:" + (o.seed || 1));
    shots.forEach((t, i) => renderDry(ctx, ctx.destination, v, t, (o.k || 1) * (o.pitches ? o.pitches[i % o.pitches.length] : 1), noise, R));
    if (o.tail !== false && v.tail) {
      const tn = tailNodes(ctx, ctx.destination, v.tail, o.k || 1, noise);
      let st = null;
      shots.forEach((t) => { st = scheduleTail(tn.gain.gain, st, t, v.tail.g * (o.tailScale == null ? 1 : o.tailScale), v.tail); });
      tn.src.start(0, 0.37);
    }
    return ctx.startRendering();
  }

  // ---------------- the mechanics (section 4) ----------------
  // On a synthesiser with G.Audio's tone()/noise() (the game's, inside one
  // voice -- or an offline one). gains are linear; a shot peaks near 0.7.
  const MK = {
    // a bright little tick of metal
    click(A, f, g, at, o) { A.noise({ dur: (o && o.dur) || 0.014, freq: f, q: (o && o.q) || 4, gain: g, at: at || 0, attack: 0.0006 }); },
    // a sharper one: a square burst in a band plus a tick (latches, the bolt's lugs)
    snap(A, f, g, at) {
      A.tone({ type: "square", freq: f * 0.5, dur: 0.012, gain: g * 0.5, at: at || 0, attack: 0.0006, filter: { type: "bandpass", freq: f, q: 5 } });
      A.noise({ dur: 0.01, freq: f * 1.3, q: 3, gain: g * 0.7, at: at || 0, attack: 0.0006 });
    },
    // a piece of steel ringing (a partial a little under three times up)
    ring(A, f, g, at, dur) {
      const d = dur || 0.2;
      A.tone({ type: "sine", freq: f, dur: d, gain: g, at: at || 0, attack: 0.002 });
      A.tone({ type: "sine", freq: f * 2.76, dur: d * 0.55, gain: g * 0.35, at: at || 0, attack: 0.002 });
    },
    // the hands on the gun, the sling, the sleeve: low, soft
    handle(A, g, at, dur, lp) { A.noise({ dur: dur || 0.09, filter: "lowpass", freq: lp || 500, gain: g, at: at || 0, attack: 0.014 }); },
    // metal sliding on metal, the band sweeping
    scrape(A, f0, f1, g, at, dur) { A.noise({ dur: dur || 0.08, freq: f0, freqEnd: f1, q: 1.6, gain: g, at: at || 0, attack: 0.008 }); },
    // a low knock (a part coming home, the gun settling in the hands)
    thump(A, f, g, at, dur) { A.tone({ type: "sine", freq: f * 1.6, freqEnd: f, dur: dur || 0.09, gain: g, at: at || 0, attack: 0.003 }); },
  };
  // the sound sets (each reload marker by the timeline of section 4.2; the
  // clip's own frequencies where it measured them)
  const REL = {
    // a polymer pistol: release, the new one scraped in and locked, the slide let go (empty only)
    pistol: {
      start: (A, m) => MK.handle(A, 0.05, 0, 0.1, 600),
      out: (A, m) => MK.click(A, 4000 * m, 0.13),
      grab: (A, m) => MK.handle(A, 0.05, 0, 0.09, 700),
      in: (A, m) => { MK.scrape(A, 1200 * m, 2600 * m, 0.08, 0, 0.08); MK.snap(A, 2000 * m, 0.16, 0.07); },
      slap: (A, m) => MK.thump(A, 260 * m, 0.08),
      bolt: (A, m) => { MK.snap(A, 5000 * m, 0.18); MK.ring(A, 1000 * m, 0.05, 0.004, 0.16); },
    },
    // the steel .45: the same, the slide heavier and its ring ~10% lower
    pistol45: {
      start: (A, m) => MK.handle(A, 0.05, 0, 0.1, 600),
      out: (A, m) => MK.click(A, 3600 * m, 0.14),
      grab: (A, m) => MK.handle(A, 0.05, 0, 0.09, 700),
      in: (A, m) => { MK.scrape(A, 1100 * m, 2400 * m, 0.08, 0, 0.09); MK.snap(A, 1800 * m, 0.17, 0.08); },
      slap: (A, m) => MK.thump(A, 230 * m, 0.09),
      bolt: (A, m) => { MK.snap(A, 4500 * m, 0.2); MK.ring(A, 900 * m, 0.06, 0.004, 0.2); },
    },
    // the SMG (its magazine check: release 5.3 kHz, out 3.6, in 3.6 then locked 1.6, the handle slapped 5.9)
    smg: {
      start: (A, m) => MK.handle(A, 0.05, 0, 0.12, 550),
      out: (A, m) => MK.click(A, 5300 * m, 0.15),
      grab: (A, m) => { MK.click(A, 3600 * m, 0.08); MK.handle(A, 0.04, 0.05, 0.08, 700); },
      in: (A, m) => { MK.click(A, 3600 * m, 0.11); MK.snap(A, 1600 * m, 0.16, 0.09); },
      slap: (A, m) => MK.thump(A, 240 * m, 0.07),
      bolt: (A, m) => { MK.snap(A, 5900 * m, 0.17); MK.thump(A, 180 * m, 0.06, 0.01); },
    },
    // the long rifle: the magazine rocked out (a scrape, rings at 466 and 616), hooked
    // in and rocked home (~2.2 kHz), the handle hauled back and let go ("chak", ~730 Hz)
    ak: {
      start: (A, m) => MK.handle(A, 0.06, 0, 0.12, 500),
      out: (A, m) => { MK.scrape(A, 1500 * m, 3000 * m, 0.1, 0, 0.1); MK.ring(A, 466 * m, 0.035, 0.03, 0.22); MK.ring(A, 616 * m, 0.03, 0.04, 0.2); },
      grab: (A, m) => MK.handle(A, 0.05, 0, 0.1, 650),
      in: (A, m) => { MK.scrape(A, 900 * m, 1800 * m, 0.06, 0, 0.06); MK.snap(A, 2200 * m, 0.2, 0.07); },
      slap: (A, m) => MK.thump(A, 200 * m, 0.08),
      bolt: (A, m) => { MK.scrape(A, 600 * m, 900 * m, 0.17, 0, 0.07); MK.thump(A, 150 * m, 0.12, 0.01); MK.click(A, 2500 * m, 0.12, 0.09); },
    },
    // the belt-fed: the cover opened (a latch and its spring), the old belt out
    // (links 3-6 kHz), the box swapped, the new belt laid in, the cover slammed
    // (1-2 kHz, ringing 300-600 Hz), charged
    belt: {
      start: (A, m) => MK.handle(A, 0.06, 0, 0.12, 500),
      cover: (A, m) => { MK.snap(A, 1800 * m, 0.14); MK.ring(A, 1300 * m, 0.03, 0.02, 0.25); },
      out: (A, m) => { for (let i = 0; i < 5; i++) MK.click(A, (3000 + 600 * i) * m, 0.06, i * 0.045 + Math.random() * 0.01); },
      drop: (A, m) => MK.thump(A, 110 * m, 0.12, 0.08),
      grab: (A, m) => MK.handle(A, 0.05, 0, 0.12, 600),
      in: (A, m) => { for (let i = 0; i < 6; i++) MK.click(A, (3200 + 500 * (i % 3)) * m, 0.05, i * 0.04 + Math.random() * 0.01); },
      coverClose: (A, m) => { MK.snap(A, 1400 * m, 0.24); MK.ring(A, 420 * m, 0.06, 0.004, 0.32); MK.ring(A, 560 * m, 0.04, 0.006, 0.28); },
      slap: (A, m) => MK.thump(A, 160 * m, 0.08),
      bolt: (A, m) => { MK.scrape(A, 550 * m, 800 * m, 0.17, 0, 0.07); MK.thump(A, 130 * m, 0.13, 0.01); MK.click(A, 2300 * m, 0.12, 0.09); },
    },
    // a bolt-action with a magazine: the bolt opened, the magazine changed, the bolt closed
    bolt: {
      start: (A, m) => MK.handle(A, 0.05, 0, 0.12, 500),
      out: (A, m) => MK.click(A, 4200 * m, 0.13),
      grab: (A, m) => MK.handle(A, 0.05, 0, 0.1, 650),
      in: (A, m) => { MK.scrape(A, 1000 * m, 2200 * m, 0.06, 0, 0.06); MK.snap(A, 2400 * m, 0.16, 0.07); },
      slap: (A, m) => MK.thump(A, 220 * m, 0.08),
      bolt: (A, m) => { MK.snap(A, 4300 * m, 0.13); MK.scrape(A, 3000 * m, 5500 * m, 0.08, 0.06, 0.08); MK.snap(A, 3800 * m, 0.14, 0.2); MK.ring(A, 1070 * m, 0.03, 0.2, 0.18); MK.click(A, 2500 * m, 0.12, 0.3); },
    },
    // stripper clip (video 2): bolt open 3.2 / 3.9 kHz, 2.6, 3.4, the clip's high ring, closed with a ring at 3.9
    boltClip: {
      start: (A, m) => MK.handle(A, 0.05, 0, 0.1, 500),
      out: (A, m) => { MK.snap(A, 3200 * m, 0.14); MK.click(A, 3900 * m, 0.1, 0.19); },
      grab: (A, m) => MK.click(A, 2600 * m, 0.1),
      in: (A, m) => { MK.click(A, 3400 * m, 0.11); MK.ring(A, 10500 * m, 0.03, 0.12, 0.12); MK.ring(A, 12000 * m, 0.02, 0.13, 0.1); },
      slap: (A, m) => MK.thump(A, 200 * m, 0.06),
      bolt: (A, m) => { MK.thump(A, 170 * m, 0.12); MK.ring(A, 3900 * m, 0.04, 0.005, 0.16); MK.snap(A, 3900 * m, 0.12); },
    },
    // the .50's: the same steps, everything heavier and lower
    bolt50: {
      start: (A, m) => MK.handle(A, 0.07, 0, 0.14, 450),
      out: (A, m) => MK.click(A, 3600 * m, 0.15),
      grab: (A, m) => MK.handle(A, 0.06, 0, 0.12, 600),
      in: (A, m) => { MK.scrape(A, 800 * m, 1800 * m, 0.08, 0, 0.08); MK.snap(A, 2000 * m, 0.2, 0.08); },
      slap: (A, m) => MK.thump(A, 160 * m, 0.11),
      bolt: (A, m) => { MK.snap(A, 5800 * m, 0.14); MK.scrape(A, 6000 * m, 9000 * m, 0.08, 0.1, 0.1); MK.thump(A, 120 * m, 0.13, 0.3); MK.ring(A, 6200 * m, 0.03, 0.3, 0.14); MK.snap(A, 2100 * m, 0.14, 0.4); },
    },
  };
  // "done" and the magazine landing are the same for all
  Object.values(REL).forEach((r) => {
    r.done = r.done || ((A, m) => { MK.handle(A, 0.04, 0, 0.08, 800); MK.click(A, 1700 * m, 0.035, 0.03); });
    r.land = r.land || ((A, m) => { MK.thump(A, 140 * m, 0.07); MK.click(A, 2600 * m + Math.random() * 400, 0.05, 0.004, { dur: 0.03, q: 2 }); });
    r.drop = r.drop || (() => {});
  });

  // the bolt worked after a shot (sections 3.6, 3.7): steps -> sounds
  const BOLT = {
    G: {
      grab: (A, m, at) => { MK.thump(A, 220 * m, 0.04, at); MK.click(A, 2000 * m, 0.04, at + 0.01); },
      lift: (A, m, at) => MK.snap(A, 4400 * m, 0.12, at),
      pull: (A, m, at) => MK.scrape(A, 3000 * m, 6000 * m, 0.09, at, 0.06),
      push: (A, m, at) => { MK.scrape(A, 4300 * m, 3400 * m, 0.08, at, 0.05); MK.ring(A, 1070 * m, 0.035, at + 0.03, 0.18); MK.ring(A, 5000 * m, 0.02, at + 0.03, 0.1); },
      down: (A, m, at) => MK.snap(A, 2500 * m, 0.13, at),
      settle: (A, m, at) => MK.thump(A, 95 * m, 0.08, at, 0.1),
    },
    F: {
      grab: (A, m, at) => MK.thump(A, 200 * m, 0.04, at),
      lift: (A, m, at) => MK.snap(A, 5800 * m, 0.13, at),
      pull: (A, m, at) => MK.scrape(A, 6000 * m, 10000 * m, 0.1, at, 0.09),
      push: (A, m, at) => { MK.thump(A, 140 * m, 0.11, at); MK.ring(A, 6200 * m, 0.03, at + 0.01, 0.14); },
      down: (A, m, at) => MK.snap(A, 2100 * m, 0.13, at),
      lock: (A, m, at) => MK.click(A, 1850 * m, 0.1, at, { dur: 0.007, q: 5 }),
      settle: (A, m, at) => MK.thump(A, 80 * m, 0.09, at, 0.12),
    },
  };
  BOLT.H = BOLT.G; BOLT.I = BOLT.G;

  // the draw: 8-15 little sounds over 1-1.8 s (section 4.1) -- the hands
  // (60-700 Hz), clicks (1.3-2.5 kHz), steel ringing (266 / 300 / 466 / 616
  // / 816 / 1016 Hz) -- ending in the gun's own: the rifle's handle hauled
  // ("chak", 0.23 s before it could fire), a pistol's slide checked, a bolt
  // touched, the LMG's cover tapped
  // (g: the set's level, so each gun's draw is heard 10-20 dB under its own
  // shot -- section 4 -- whatever the prototype's loudness)
  const EQUIP = {
    A: { dur: 1.5, n: 12, end: "cover", g: 1.4 }, B: { dur: 1.3, n: 14, end: "chak", g: 1 }, C: { dur: 1.1, n: 10, end: "charge", g: 1 },
    D: { dur: 1.2, n: 10, end: "slide", g: 1.8 }, E: { dur: 1.2, n: 9, end: "slide", g: 2.2 }, F: { dur: 1.65, n: 13, end: "bolt", g: 1.2 },
    G: { dur: 1.8, n: 14, end: "bolt", g: 1.2 }, H: { dur: 1.6, n: 12, end: "bolt", g: 1.2 }, I: { dur: 1.6, n: 12, end: "bolt", g: 1.2 },
  };
  const RINGS = [266, 300, 466, 616, 816, 1016];
  function equipSeq(def) {
    const I = G.GunRef.info(def), E = EQUIP[I.proto], R = seedRng(def.id + ":equip");
    const out = [];
    let t = 0.04;
    for (let i = 0; i < E.n - 1 && t < E.dur - 0.2; i++) {
      const r = R();
      out.push({ t, kind: i < 2 || r < 0.38 ? "handle" : r < 0.72 ? "click" : "ring", f: r < 0.72 ? 1300 + R() * 1200 : RINGS[Math.floor(R() * RINGS.length)], g: 0.6 + R() * 0.4 });
      t += 0.05 + R() * 0.115;
    }
    out.push({ t: E.dur - 0.2, kind: E.end, g: 1 });
    return out;
  }
  function playEquip(A, def, m) {
    const k = EQUIP[G.GunRef.info(def).proto].g || 1;
    equipSeq(def).forEach((e) => {
      const at = e.t, g = e.g;
      if (e.kind === "handle") MK.handle(A, (0.03 + 0.04 * g) * k, at, 0.07 + 0.05 * g, 200 + 500 * g);
      else if (e.kind === "click") MK.click(A, e.f * m, 0.05 * g * k, at);
      else if (e.kind === "ring") MK.ring(A, e.f * m, 0.025 * g * k, at, 0.16);
      else if (e.kind === "chak") { MK.scrape(A, 600 * m, 900 * m, 0.19 * k, at, 0.07); MK.thump(A, 150 * m, 0.13 * k, at + 0.01); MK.click(A, 2500 * m, 0.12 * k, at + 0.09); }
      else if (e.kind === "slide") { MK.scrape(A, 1800 * m, 3200 * m, 0.08 * k, at, 0.06); MK.snap(A, 3000 * m, 0.12 * k, at + 0.07); }
      else if (e.kind === "charge") { MK.snap(A, 5900 * m, 0.12 * k, at); MK.thump(A, 200 * m, 0.06 * k, at + 0.01); }
      else if (e.kind === "cover") { MK.snap(A, 1500 * m, 0.13 * k, at); MK.ring(A, 420 * m, 0.04 * k, at + 0.004, 0.25); }
      else if (e.kind === "bolt") { MK.snap(A, 4200 * m, 0.1 * k, at); MK.thump(A, 160 * m, 0.08 * k, at + 0.06); }
    });
  }
  // the SMG's magazine check while it is shown off (section 3.3: 14.36 / 14.85 /
  // 14.94 / 15.04 s of a 2.2 s inspection that began at 13.0 s), squeezed into `dur`
  function playMagCheck(A, m, dur) {
    // (g: under the SMG's shot by 10-20 dB, section 4)
    const k = (dur || 2.2) / 2.2, g = 1.35;
    MK.handle(A, 0.04 * g, 0.05 * k, 0.12, 500);
    MK.click(A, 5300 * m, 0.17 * g, 1.36 * k);
    MK.click(A, 3600 * m, 0.1 * g, 1.85 * k);
    MK.snap(A, 1600 * m, 0.14 * g, 1.94 * k);
    MK.snap(A, 5900 * m, 0.13 * g, 2.04 * k);
  }
  // a casing landing (section 4.1): small brass rings 6-10 kHz, a .50 3.5-5;
  // two or three bounces ~0.1 s apart; concrete bright, grass dull, metal ringing
  function casing(A, kind, surface, at) {
    const big = kind === "fifty", steel = kind === "steel";
    const soft = surface === "grass" || surface === "dirt" || surface === "water" || surface === "flesh";
    const ringy = surface === "metal" ? 1.8 : surface === "wood" ? 0.6 : 1;
    const n = soft ? 1 : 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = (at || 0) + i * (0.09 + Math.random() * 0.03), g = (big ? 0.09 : 0.06) * Math.pow(0.55, i) * (soft ? 0.5 : 1);
      const f = big ? 3500 + Math.random() * 1500 : (steel ? 5000 : 6000) + Math.random() * 4000;
      if (soft) MK.click(A, f * 0.35, g, t, { dur: 0.02, q: 1.2 });
      else { MK.click(A, f, g, t, { dur: 0.012, q: 3 }); MK.ring(A, f * 0.97, g * 0.35 * ringy, t + 0.001, 0.06 * ringy * (big ? 1.6 : 1)); }
    }
  }

  return { VOICES, MK, REL, BOLT, EQUIP, voiceFor, jitter, render, renderDry, tailNodes, scheduleTail, tailLevel, noiseFor, equipSeq, playEquip, playMagCheck, casing, seedRng, _cache: cache };
})();
