// Dev-only (not shipped). The gun reference pass: the shots measured the way
// docs/reference/guns/GUN_REFERENCE.md section 5 measured the clips, and held
// to its numbers.
//
//   onset      the first sample within 20 dB of the loudest
//   windows    transient 0-15 ms, body 15-120 ms, tail 120-600 ms from it
//   centroid   energy-weighted mean frequency of a Hann-windowed FFT (20 Hz-20 kHz)
//   bands      % of the energy in 20-80, 80-250, 250-800, 800-2.5k, 2.5k-6k,
//              6k-12k, 12k-20k Hz
//   sub        the strongest frequency under 250 Hz in the body
//   decay      the RMS over 20 ms (2 ms steps), through a 60 ms minimum filter
//              (centred) so a click riding on it does not count; the time from
//              the onset (or, after a burst, from the last shot) to 10 and 20 dB
//              under its peak
//   tolerance  centroid +-25%, a band +-10 points, decay +-30%, rate of fire
//              +-5% (section 5); the sub +-10 Hz (section 6's own spread)
//
// What is rendered: the gun's dry shot and its tail as the game plays them
// outdoors (G.GunVoice.render; the clips are outdoors), no room reverb -- the
// game's own six variants of it (G.GunAudio.render: pitch k, noise seed
// k * 1000), each measured and the median taken, as section 3 gives each
// clip's numbers as the median of its shots.
//
//   const r = await G.GunSoundCheck.run();          r.rows: every reference gun
//   const all = await G.GunSoundCheck.runAll();     every game gun of a prototype
//   await G.GunSoundCheck.tune("A", 300)            search a recipe toward its targets
window.G = window.G || {};
G.GunSoundCheck = (function () {
  const SR = 48000;
  const BANDS = [[20, 80], [80, 250], [250, 800], [800, 2500], [2500, 6000], [6000, 12000], [12000, 20000]];
  const BANDN = ["20-80", "80-250", "250-800", "800-2.5k", "2.5k-6k", "6k-12k", "12k-20k"];

  // ---------------- section 5, as numbers ----------------
  // a range [lo, hi] or one value [v]; band: { win (T B L), lo, hi (Hz), pct }
  const TARGETS = {
    A: { name: "LMG (belt-fed)", interval: [80, 83], cT: [700], cB: [500], cL: [540], sub: [62, 66], bands: [{ win: "B", lo: 20, hi: 250, pct: [52, 64] }], d10: [0.23], burst: { d10: [1.1], d20: [1.65], secs: 2.8 } },
    B: { name: "RPK", interval: [100], cT: [2200], cB: [500], cL: [540], sub: [57], bands: [{ win: "B", lo: 20, hi: 80, pct: [59] }], d10: [0.33], burst: { secs: 1.0 } },
    C: { name: "Vector", interval: [50, 55], cT: [1200, 1300], cB: [1600, 1900], cL: [1500, 1700], sub: [150, 220], bands: [{ win: "B", lo: 800, hi: 2500, pct: [30, 36] }], burst: { d10: [0.4, 0.55], d20: [1.0], secs: 1.0 } },
    D: { name: "Glock", interval: [">=", 200], cT: [750], cB: [620], cL: [660], sub: [76], bands: [{ win: "T", lo: 250, hi: 800, pct: [43] }], d10: [0.4, 0.6] },
    E: { name: "M1911", interval: [">=", 270], cT: [1200, 2600], cB: [2100], cL: [1300], sub: [57, 66], bands: [{ win: "B", lo: 800, hi: 2500, pct: [37] }], d10: [0.25, 0.32], d20: [0.6] },
    F: { name: "M95", interval: [1850], cT: [1300, 1900], cB: [700, 1400], cL: [670, 810], sub: [47, 66], bands: [{ win: "B", lo: 250, hi: 800, pct: [29, 36] }, { win: "B", lo: 80, hi: 250, pct: [23] }], d10: [0.53], d20: [0.8] },
    G: { name: "AWM", interval: [1500], cT: [1700, 2000], cB: [1200, 1400], cL: [640, 710], sub: [47, 133], bands: [{ win: "L", lo: 250, hi: 800, pct: [51] }], d10: [0.23, 0.3], d20: [0.34, 0.43] },
  };
  // the two scoped snipers are held to the AWM's sound (section 3.8); no rate of their own
  TARGETS.H = Object.assign({}, TARGETS.G, { name: "white sniper (AWM sound)", interval: null });
  TARGETS.I = Object.assign({}, TARGETS.G, { name: "blue-lens sniper (AWM sound)", interval: null });
  const TOL = { centroid: 0.25, band: 10, decay: 0.3, rate: 0.05, sub: 10 };
  // the acceptable range for a target and its kind
  function range(t, kind) {
    if (!t) return null;
    const lo = t[0], hi = t.length > 1 ? t[1] : t[0];
    if (kind === "centroid") return [lo * (1 - TOL.centroid), hi * (1 + TOL.centroid)];
    if (kind === "decay") return [lo * (1 - TOL.decay), hi * (1 + TOL.decay)];
    if (kind === "band") return [Math.max(0, lo - TOL.band), hi + TOL.band];
    if (kind === "sub") return [lo - TOL.sub, hi + TOL.sub];
    if (kind === "rate") return [lo * (1 - TOL.rate), hi * (1 + TOL.rate)];
    return [lo, hi];
  }

  // ---------------- the arithmetic ----------------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  // the power spectrum of x[a..b) (Hann), zero-padded to a power of two
  function spectrum(x, a, b) {
    const len = Math.max(8, b - a);
    let n = 4096; while (n < len * 2) n <<= 1;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < len; i++) re[i] = (x[a + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (len - 1)));
    fft(re, im);
    const P = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) P[i] = re[i] * re[i] + im[i] * im[i];
    return { P, df: SR / n };
  }
  function centroidAndBands(S) {
    let sp = 0, sfp = 0;
    const bands = BANDS.map(() => 0);
    for (let i = 1; i < S.P.length; i++) {
      const f = i * S.df;
      if (f < 20 || f > 20000) continue;
      sp += S.P[i]; sfp += f * S.P[i];
      for (let b = 0; b < BANDS.length; b++) if (f >= BANDS[b][0] && f < BANDS[b][1]) { bands[b] += S.P[i]; break; }
    }
    return { centroid: sfp / (sp || 1), bands: bands.map((v) => 100 * v / (sp || 1)), total: sp };
  }
  function bandPct(S, lo, hi) {
    let sp = 0, s = 0;
    for (let i = 1; i < S.P.length; i++) {
      const f = i * S.df;
      if (f < 20 || f > 20000) continue;
      sp += S.P[i]; if (f >= lo && f < hi) s += S.P[i];
    }
    return 100 * s / (sp || 1);
  }
  function subPeak(S) {
    let best = -1, bi = 0;
    for (let i = 1; i < S.P.length; i++) { const f = i * S.df; if (f < 20) continue; if (f > 250) break; if (S.P[i] > best) { best = S.P[i]; bi = i; } }
    // (parabolic interpolation between the bins)
    const a = S.P[bi - 1] || 0, b = S.P[bi], c = S.P[bi + 1] || 0, den = a - 2 * b + c;
    const off = den ? 0.5 * (a - c) / den : 0;
    return (bi + off) * S.df;
  }
  // the RMS envelope (dB): 20 ms windows every 2 ms, then a 60 ms minimum filter
  function envelope(x) {
    const win = Math.round(0.02 * SR), hop = Math.round(0.002 * SR);
    const n = Math.floor((x.length - win) / hop);
    const db = new Float64Array(Math.max(1, n));
    for (let i = 0; i < n; i++) {
      let s = 0; const a = i * hop;
      for (let j = 0; j < win; j++) s += x[a + j] * x[a + j];
      db[i] = 10 * Math.log10(s / win + 1e-20);
    }
    const half = Math.round(0.03 / 0.002), out = new Float64Array(db.length);
    for (let i = 0; i < db.length; i++) {
      let m = Infinity;
      for (let j = Math.max(0, i - half); j <= Math.min(db.length - 1, i + half); j++) if (db[j] < m) m = db[j];
      out[i] = m;
    }
    // the time of window i is its centre
    return { db: out, t: (i) => (i * hop + win / 2) / SR };
  }
  // from time `from` (s): the peak of the filtered envelope near it, then the drops
  function decayFrom(E, from, search) {
    let pi = -1, pk = -Infinity;
    for (let i = 0; i < E.db.length; i++) { const t = E.t(i); if (t < from - (search ? search[0] : 0) || t > from + (search ? search[1] : 0.25)) continue; if (E.db[i] > pk) { pk = E.db[i]; pi = i; } }
    const at = (d) => { for (let i = pi; i < E.db.length; i++) if (E.db[i] <= pk - d) return E.t(i) - from; return null; };
    return { peakDb: pk, d10: at(10), d20: at(20) };
  }

  // ---------------- measuring a buffer ----------------
  function onsetOf(x, after) {
    let mx = 0; const a0 = Math.floor((after || 0) * SR);
    for (let i = a0; i < x.length; i++) mx = Math.max(mx, Math.abs(x[i]));
    const th = mx * 0.1;
    for (let i = a0; i < x.length; i++) if (Math.abs(x[i]) >= th) return i;
    return a0;
  }
  function measureShot(buf) {
    const x = buf.getChannelData(0);
    const on = onsetOf(x), ms = (v) => Math.round(v * SR / 1000);
    const ST = spectrum(x, on, on + ms(15)), SB = spectrum(x, on + ms(15), on + ms(120)), SL = spectrum(x, on + ms(120), on + ms(600));
    const T = centroidAndBands(ST), B = centroidAndBands(SB), L = centroidAndBands(SL);
    const E = envelope(x), dk = decayFrom(E, on / SR);
    return {
      onset: on / SR, cT: T.centroid, cB: B.centroid, cL: L.centroid, sub: subPeak(SB),
      bandsT: T.bands, bandsB: B.bands, bandsL: L.bands, spec: { T: ST, B: SB, L: SL },
      d10: dk.d10, d20: dk.d20, peakDb: 20 * Math.log10(x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1e-9),
    };
  }
  function measureBurst(buf, lastShot) {
    const E = envelope(buf.getChannelData(0));
    return decayFrom(E, lastShot, [0.3, 0.15]);
  }

  // ---------------- one gun, rendered and measured ----------------
  // the game's variants of a shot (G.GunAudio.render): pitch, and the noise's seed
  const KS = [1, 0.985, 1.015, 0.97, 1.03, 0.993];
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  // (a level that never falls 10 or 20 dB counts as endless)
  const endless = (v) => (v == null ? Infinity : v);
  async function measureVoice(v, o) {
    o = o || {};
    const shots = [];
    for (const k of (o.ks || KS)) shots.push(measureShot(await G.GunVoice.render(v, { shots: [0.02], k, seed: Math.round(k * 1000) })));
    const m = { shots };
    ["cT", "cB", "cL", "sub"].forEach((p) => { m[p] = median(shots.map((s) => s[p])); });
    ["d10", "d20"].forEach((p) => { m[p] = median(shots.map((s) => endless(s[p]))); });
    if (o.burst) {
      const iv = o.interval, n = Math.max(2, Math.round(o.burst / iv) + 1), at = [];
      for (let i = 0; i < n; i++) at.push(0.02 + i * iv);
      // (the drawn buffers' own little pitch spread, as the game plays them)
      const b = await G.GunVoice.render(v, { shots: at, seed: 1000, pitches: KS });
      m.burst = measureBurst(b, at[at.length - 1]);
      m.burstSecs = at[at.length - 1] - at[0];
    }
    return m;
  }
  // the verdict: every metric (the median over the shots) against its range
  function judge(key, m, def) {
    const T = TARGETS[key], rows = [], shots = m.shots || [m];
    const add = (name, val, tgt, kind, unit) => {
      if (!tgt) return;
      const r = range(tgt, kind), ok = val != null && val >= r[0] && val <= r[1];
      rows.push({ name, val, tgt, range: r, ok, unit, kind });
    };
    const med = (fn) => median(shots.map(fn));
    if (T.interval && def) {
      const iv = def.fireRate;
      if (T.interval[0] === ">=") rows.push({ name: "interval", val: iv, tgt: T.interval, range: [T.interval[1], Infinity], ok: iv >= T.interval[1], unit: "ms", kind: "rate" });
      else add("interval", iv, T.interval, "rate", "ms");
    }
    add("centroid transient", med((s) => s.cT), T.cT, "centroid", "Hz");
    add("centroid body", med((s) => s.cB), T.cB, "centroid", "Hz");
    add("centroid tail", med((s) => s.cL), T.cL, "centroid", "Hz");
    add("sub", med((s) => s.sub), T.sub, "sub", "Hz");
    (T.bands || []).forEach((b) => {
      add("band " + b.lo + "-" + b.hi + " (" + { T: "transient", B: "body", L: "tail" }[b.win] + ")", med((s) => bandPct(s.spec[b.win], b.lo, b.hi)), b.pct, "band", "%");
    });
    add("-10 dB", med((s) => endless(s.d10)), T.d10, "decay", "s");
    add("-20 dB", med((s) => endless(s.d20)), T.d20, "decay", "s");
    if (T.burst && m.burst) {
      add("-10 dB after burst", endless(m.burst.d10), T.burst.d10, "decay", "s");
      add("-20 dB after burst", endless(m.burst.d20), T.burst.d20, "decay", "s");
    }
    return rows;
  }
  // a score to search on: 0 inside every range near its middle, growing outside
  function loss(rows) {
    let s = 0;
    rows.forEach((r) => {
      if (r.kind === "rate" || r.val == null) { if (r.val == null) s += 20; return; }
      const lo = r.range[0], hi = r.range[1], mid = r.kind === "band" || r.kind === "sub" ? (r.tgt[0] + (r.tgt[1] != null ? r.tgt[1] : r.tgt[0])) / 2 : Math.sqrt(r.range[0] * r.range[1]);
      const half = (hi - lo) / 2 || 1;
      const d = Math.abs(r.val - mid) / half;
      s += r.ok ? d * d * 0.5 : 4 + 6 * (r.val < lo ? (lo - r.val) / half : (r.val - hi) / half);
    });
    return s;
  }

  async function checkGun(def) {
    const I = G.GunRef.info(def);
    if (!I) return null;
    const v = G.GunVoice.voiceFor(def), T = TARGETS[I.proto];
    const m = await measureVoice(v, { burst: T.burst && def.auto ? T.burst.secs : 0, interval: def.fireRate / 1000 });
    const rows = judge(I.proto, m, I.flagship ? def : null);
    return { id: def.id, proto: I.proto, flagship: I.flagship, rows, ok: rows.every((r) => r.ok), m, loss: loss(rows) };
  }
  // the reference guns' stand-ins
  async function run() {
    const out = [];
    for (const key of Object.keys(G.GunRef.FLAGSHIP)) {
      const def = G.WEAPON_DEFS[G.GunRef.FLAGSHIP[key]];
      out.push(await checkGun(def));
    }
    return { rows: out, ok: out.every((r) => r.ok) };
  }
  // every game gun of a prototype (each held to its prototype's numbers; the rate is its own)
  async function runAll() {
    const out = [];
    for (const def of Object.values(G.WEAPON_DEFS)) {
      if (!G.GunRef.info(def)) continue;
      const r = await checkGun(def);
      out.push({ id: r.id, proto: r.proto, flagship: r.flagship, ok: r.ok, fails: r.rows.filter((x) => !x.ok).map((x) => x.name + " " + fmt(x.val) + " (" + fmt(x.range[0]) + "-" + fmt(x.range[1]) + ")"),
        cT: Math.round(r.m.cT), cB: Math.round(r.m.cB), cL: Math.round(r.m.cL), sub: Math.round(r.m.sub), d10: r.m.d10 && +r.m.d10.toFixed(3), d20: r.m.d20 && +r.m.d20.toFixed(3) });
    }
    return { rows: out, ok: out.every((r) => r.ok), n: out.length };
  }
  const fmt = (v) => v == null ? "-" : typeof v === "string" ? v : v === Infinity ? "inf" : Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(3);
  // a target as written: "80-83", "700" or ">= 200"
  const tgtText = (t) => t[0] === ">=" ? ">= " + fmt(t[1]) : t.map(fmt).join("-");

  // ---------------- searching a recipe toward its targets (for tuning by hand) ----------------
  // knobs: [path, min, max, log?] on the voice
  const KNOBS = ["trans.g", "trans.lo", "trans.hi", "trans.tau", "click.g", "click.f", "hiss.g", "mid.g", "mid.lo", "mid.hi", "mid.tau",
    "body.g", "body.f1", "body.f0", "body.tau", "body.sweep", "nbody.g", "nbody.lp", "nbody.tau", "ring.g", "tail.g", "tail.lp", "tail.hold", "tail.rt60", "tail.hp", "tail.cap", "echo.g", "boom.g", "boom.tau", "boom.lo", "boom.hi", "tones.0.g", "tones.1.g", "mech.0.g"];
  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split("."), last = ks.pop(); const t = ks.reduce((a, k) => (a == null ? a : a[k]), o); if (t && t[last] != null) t[last] = v; };
  // A recipe is scored on every game gun that plays it -- the reference gun's
  // stand-in as it is, the others with their own nudge (G.GunVoice.jitter) --
  // by the worst of them, so the search cannot leave one of them outside.
  // (G's recipe is also H's.) o.flagshipOnly: the stand-in alone.
  async function tune(key, iters, o) {
    o = o || {};
    const def = G.WEAPON_DEFS[G.GunRef.FLAGSHIP[key]], T = TARGETS[key];
    // (the game's own frames stop meanwhile: the search wants the whole machine)
    if (G.Game && !G.Game._loopKept) { G.Game._loopKept = G.Game.loop; G.Game.loop = function () {}; }
    let best = JSON.parse(JSON.stringify(o.from || G.GunVoice.VOICES[key]));
    const protos = key === "G" ? ["G", "H"] : [key];
    const guns = Object.values(G.WEAPON_DEFS).filter((d) => { const I = G.GunRef.info(d); return I && protos.includes(I.proto) && (!o.flagshipOnly || I.flagship); });
    const score = async (v) => {
      let worst = null, sum = 0;
      for (const d of guns) {
        const I = G.GunRef.info(d), dv = I.flagship ? v : G.GunVoice.jitter(JSON.parse(JSON.stringify(v)), d.id);
        const m = await measureVoice(dv, { burst: T.burst && d.auto ? T.burst.secs : 0, interval: d.fireRate / 1000 });
        const rows = judge(key, m, d === def ? def : null), l = loss(rows);
        sum += l;
        if (!worst || l > worst.l) worst = { l, rows, id: d.id };
      }
      return { l: worst.l + 0.1 * sum / guns.length, rows: worst.rows, id: worst.id, ok: null };
    };
    let bs = await score(best);
    const knobs = KNOBS.filter((p) => get(best, p) != null && (!o.only || o.only.includes(p)));
    for (let it = 0; it < (iters || 200); it++) {
      const cand = JSON.parse(JSON.stringify(best));
      const nk = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < nk; i++) {
        const p = knobs[Math.floor(Math.random() * knobs.length)], v = get(cand, p);
        const step = (o.step || 0.25) * (Math.random() * 2 - 1);
        let nv = /f1|f0|lo$|hi$|\.f$|lp|hp/.test(p) ? v * Math.exp(step * 0.6) : /hold/.test(p) ? Math.max(0, v + step * 0.15) : v * Math.exp(step);
        if (/body\.f1/.test(p)) nv = Math.max(30, nv);
        set(cand, p, nv);
      }
      const s = await score(cand);
      if (s.l < bs.l) { best = cand; bs = s; }
      if (bs.rows.every((r) => r.ok) && bs.l < (o.goal || 0.6)) break;
    }
    return { voice: best, loss: bs.l, ok: bs.rows.every((r) => r.ok), worst: bs.id, guns: guns.map((d) => d.id), rows: bs.rows.map((r) => r.name + ": " + fmt(r.val) + " [" + fmt(r.range[0]) + "-" + fmt(r.range[1]) + "]" + (r.ok ? "" : " !")) };
  }
  // a table of rows as text (the report)
  function table(rows) {
    return rows.map((g) => g.id + " (" + g.proto + ")" + (g.ok ? " OK" : " FAIL") + "\n" + g.rows.map((r) => "  " + r.name + ": " + fmt(r.val) + " " + r.unit + "  target " + tgtText(r.tgt) + "  allowed " + fmt(r.range[0]) + "-" + fmt(r.range[1]) + (r.ok ? "" : "  <-- out")).join("\n")).join("\n");
  }
  return { TARGETS, TOL, BANDN, measureShot, measureBurst, measureVoice, judge, loss, checkGun, run, runAll, tune, table, range, bandPct, tgtText, fmt };
})();
