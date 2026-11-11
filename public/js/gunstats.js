// ===================================================================
// The guns' stat sheet (expansion, round 3)
// -------------------------------------------------------------------
// G.WEAPON_DEFS (js/config.js) stays what every system reads. On top of it:
//   G.CONFIG.balance.classes   what a class of gun starts from
//   G.GUN_SHEET                each gun's niche and whatever is its own
//                              (js/data/gunstats.js)
// apply() runs once at load, before anything reads a gun: it writes a gun's
// new numbers over the old ones, which stay on def.orig (the changelog in
// docs/expansion/gun-changelog.md is made from the two). What a gun IS -- its
// model, its sound, its weight -- was worked out from the old numbers, so
// those are frozen first and a change of damage changes nothing about how it
// looks, sounds or sits in the hands.
//
//   G.GunStats.of(idOrDef)       the whole sheet, every field, cached
//   G.GunStats.classOf(def)      its class
//   G.GunStats.falloff(def, m)   x damage at that distance
//   G.GunStats.headMult(def)     x damage of a head hit
//   G.GunStats.spread(def, aimT, bloom)   the spread of a shot now
//   G.GunStats.reserve(def, magSize)      rounds carried for a full reserve
//   G.GunStats.stats(idOrDef)    the card's six: raw value and percentile
//   G.GunStats.sustained(s, lvl) DPS, reloads counted
//
// G.CONFIG.expansion.gunStats = false: the old numbers and the old way of
// shooting; the sheet still answers, for the card.
// ===================================================================
window.G = window.G || {};

G.GunStats = (function () {
  const active = () => !!(G.CONFIG.expansion && G.CONFIG.expansion.gunStats);
  const B = () => G.CONFIG.balance;
  // the numbers of a gun a sheet may change
  const TUNED = ["damage", "fireRate", "magSize", "reloadTime", "pierce", "spread", "pellets", "recoil"];
  let done = false, sheets = {}, ranks = null;

  // ---------------- at load ----------------
  function apply() {
    if (done) return;
    done = true;
    Object.values(G.WEAPON_DEFS).forEach((d) => {
      // (frozen: G.inferArchetype, G.GunRef.proto and G.weaponWeight all read the numbers)
      d.archetype = d.archetype || G.inferArchetype(d);
      d.proto = G.GunRef.proto(d);
      d.weight = G.weaponWeight(d);
      d.orig = {};
      TUNED.forEach((k) => { d.orig[k] = d[k]; });
      const own = G.GUN_SHEET[d.id];
      if (!active() || !own) return;
      TUNED.forEach((k) => { if (own[k] !== undefined) d[k] = own[k]; });
    });
    sheets = {}; ranks = null;
  }

  // ---------------- what kind of gun ----------------
  function classOf(def) {
    const own = G.GUN_SHEET[def.id];
    if (own && own.cls) return own.cls;
    const a = def.archetype || G.inferArchetype(def);
    // a cannon is whichever it fires: a charge, a blast, or a heavy round
    if (a === "cannon") return def.charge ? "energy" : def.splash ? "launcher" : "sniper";
    return a;
  }
  function source(def) {
    if (def.id === "pistol") return "start";
    if (def.wallExclusive) return "wall";
    if (def.boxOnly) return "box";
    return (G.SHOP_ITEMS || []).some((i) => i.weapon === def.id) ? "shop" : "drop";
  }
  function fireMode(def) {
    if (def.burst > 1) return "burst";
    if (def.auto) return "auto";
    if (G.GunRef.boltSteps(def)) return "bolt";
    if (def.pellets) return "pump";
    return "semi";
  }
  const seedOf = (id) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) % 65536;
  };

  // ---------------- the sheet ----------------
  function build(def) {
    const own = G.GUN_SHEET[def.id] || {}, cls = classOf(def), K = B().classes[cls];
    const pick = (k, fallback) => (own[k] !== undefined ? own[k] : fallback);
    // its niche leans on its class (G.CONFIG.balance.niches)
    const N = (active() && B().niches[own.niche]) || {}, lean = (v, k) => v * (N[k] === undefined ? 1 : N[k]);
    const fall = own.fall || (K.fall[2] >= 1 ? K.fall : [Math.round(lean(K.fall[0], "range")), Math.round(lean(K.fall[1], "range")), K.fall[2]]);
    const bl = pick("bloom", K.bloom), bloom = [lean(bl[0], "bloom"), bl[1], bl[2]];
    const pellet = !!def.pellets;
    const hip = pellet ? (def.spread || 0.06) : lean(pick("hip", K.hip), "spread");
    // the view's kick: a gun of the clips by its prototype, the rest by `recoil`
    const ref = G.GunRef.info(def), RC = ref && G.CONFIG.gunRef.recoil[ref.proto];
    const strength = def.recoil || 1;
    const wc = G.weightClass(def), wk = wc.key, SM = G.CONFIG.weaponSM;
    const vm = G.ViewModel;
    const reloadEmpty = def.reloadTime / 1000;
    const mags = pick("reserveMags", K.reserveMags);
    // (expansion, round 5) what is fitted (js/attachments.js): the magazine and
    // the reload are on the def already; the aim, the spread, the range, the kick here
    const AM = G.Attach ? G.Attach.mods(def) : { ads: 1, hip: 1, range: 1, recoilV: 1, recoilH: 1 };
    const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
    const baseMag = def.attachBase ? def.attachBase.magSize : def.magSize;
    return {
      // who it is
      id: def.id, archetype: def.archetype, cls, level: def.level, rarity: def.rarity,
      source: source(def), slot: cls === "pistol" ? "sidearm" : "primary", niche: own.niche || "",
      // the shot
      fireMode: fireMode(def), rpm: Math.round(60000 / def.fireRate * (def.burst || 1)), interval: def.fireRate / 1000,
      damage: def.damage, headMult: Math.round(lean(pick("headMult", K.headMult), "head") * 100) / 100,
      falloffStart: Math.round(fall[0] * AM.range), falloffEnd: Math.round(fall[1] * AM.range), falloffMin: fall[2],
      pierce: def.pierce || 0, pellets: def.pellets || 1, pelletSpread: pellet ? (def.spread || 0.06) : 0,
      burst: def.burst || 1, charge: def.charge || null, splash: def.splash ? def.splashRadius : 0,
      // the magazine
      mag: def.magSize, reserve: baseMag * mags, reserveMags: mags,
      reloadEmpty, reloadTactical: pick("reloadTactical", Math.round(reloadEmpty * SM.tacticalScale * 100) / 100),
      // in the hands
      weight: G.weaponWeight(def), weightClass: wk, moveMult: wc.speedMult,
      swapTime: Math.round((vm.switchDuration(def) / 2 + vm.drawDuration(def)) * 100) / 100,
      adsTime: r2(pick("adsTime", Math.round(lean(SM.aimIn[wk], "ads") * 100) / 100) * AM.ads), sprintOut: pick("sprintOut", Math.round(lean(SM.sprintOut[wk], "sprint") * 100) / 100),
      // where the rounds go
      hipSpread: r4(hip * AM.hip), adsSpread: pellet ? hip * 0.8 : lean(pick("ads", K.ads), "spread"),
      bloom: bloom[0], bloomMax: bloom[1], bloomDecay: bloom[2],
      recoilV: r4((RC ? RC.kick : Math.round(strength * 0.0099 * 10000) / 10000) * AM.recoilV),
      recoilH: r4((RC ? Math.round(RC.kick * RC.side * 10000) / 10000 : 0) * AM.recoilH),
      recoilBack: RC ? RC.back : 0.33,
      recoilSeed: seedOf(def.id),
      // how it looks and sounds (the sheet only reads them)
      sound: ref ? "voice:" + ref.proto : "family:" + vm.family(def),
      color: def.color, accent: def.accent,
      flash: ref ? ref.flash : flashSize(cls), casing: ref ? ref.casing : casing(cls),
      // what it costs
      priceWall: def.wallExclusive ? def.price : 0, priceShop: def.wallExclusive ? 0 : (def.price || 0),
      tiers: B().tiers.map((t) => ({ dmg: t.dmg })),
    };
  }
  function flashSize(cls) { return { shotgun: "L", launcher: "L", beam: "S", energy: "S", antimateriel: "XL" }[cls] || "M"; }
  function casing(cls) { return { shotgun: "shell", launcher: "none", beam: "none", energy: "none" }[cls] || "brass"; }

  function of(x) {
    const def = typeof x === "string" ? G.WEAPON_DEFS[x] : x;
    if (!def) return null;
    return sheets[def.id] || (sheets[def.id] = build(def));
  }

  // ---------------- in play ----------------
  // (what lands without a sheet takes the old rules: the knife, a stand-in with no id, the flag off)
  const inPlay = (def) => (active() && def && def.id && def.id !== "melee" ? of(def) : null);
  function falloff(def, dist) {
    const s = inPlay(def);
    if (!s || dist <= s.falloffStart) return 1;
    if (dist >= s.falloffEnd) return s.falloffMin;
    return 1 - (1 - s.falloffMin) * (dist - s.falloffStart) / (s.falloffEnd - s.falloffStart);
  }
  function headMult(def) {
    const s = inPlay(def);
    return s ? s.headMult : G.HEADSHOT_MULT;
  }
  function spread(def, aimT, bloom) {
    if (!active()) return def.pellets ? (def.spread || 0.06) : 0.004;
    const s = of(def), a = Math.max(0, Math.min(1, aimT || 0));
    return s.hipSpread + (s.adsSpread - s.hipSpread) * a + (bloom || 0) * (1 - 0.4 * a);
  }
  function reserve(def, magSize) {
    // (expansion, round 5: a bigger or smaller magazine fitted carries as many rounds in all)
    const k = def && def.attachBase && def.magSize ? def.attachBase.magSize / def.magSize : 1;
    return Math.round(magSize * k * (active() ? of(def).reserveMags : 4));
  }
  // the n-th shot of a string, sideways: -1..1, the same every time for this gun
  function pattern(def, n) {
    if (!active()) return Math.random() * 2 - 1;
    let h = Math.imul(of(def).recoilSeed + 1, 2654435761) + Math.imul(n % 24, 40503);
    h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
    return ((h >>> 0) % 2001) / 1000 - 1;
  }

  // ---------------- what it does in a second ----------------
  // lvl: the shop's upgrades. A charge gun is taken fully charged.
  function perShot(s, lvl) {
    return s.damage * ((lvl && lvl.dmg) || 1) * s.pellets * (s.charge ? s.charge.mult : 1);
  }
  function cycleOf(s, lvl) {
    const iv = s.interval / ((lvl && lvl.rate) || 1);
    return s.charge ? Math.max(iv, s.charge.time) : iv;
  }
  function dps(s, lvl) { return perShot(s, lvl) * s.burst / cycleOf(s, lvl); }
  function sustained(s, lvl) {
    const mag = Math.round(s.mag * ((lvl && lvl.mag) || 1)), pulls = Math.floor(mag / s.burst);
    return (pulls * s.burst * perShot(s, lvl)) / (pulls * cycleOf(s, lvl) + s.reloadEmpty);
  }

  // ---------------- the card's six ----------------
  // Raw values; a bar is the gun's rank among all of them, 0-100.
  function raw(s) {
    // how far it keeps three quarters of its damage
    const r75 = s.falloffMin >= 0.75 ? s.falloffEnd : s.falloffStart + (s.falloffEnd - s.falloffStart) * 0.25 / (1 - s.falloffMin);
    return {
      damage: s.damage * s.pellets * (s.charge ? s.charge.mult : 1),
      rate: s.rpm,
      range: r75,
      accuracy: 1 / (s.adsSpread * 0.75 + s.hipSpread * 0.05 + s.bloomMax * 0.05 + s.recoilV * Math.min(1, s.rpm / 600) * 0.1 + 0.0005),
      handling: 1 / (s.adsTime + s.swapTime * 0.5 + s.reloadEmpty * 0.25),
      mobility: s.moveMult - s.sprintOut * 0.2,
    };
  }
  const KEYS = ["damage", "rate", "range", "accuracy", "handling", "mobility"];
  function rankAll() {
    const all = Object.values(G.WEAPON_DEFS).map((d) => raw(of(d)));
    ranks = {};
    KEYS.forEach((k) => { ranks[k] = all.map((r) => r[k]).sort((a, b) => a - b); });
  }
  function percentile(k, v) {
    if (!ranks) rankAll();
    const A = ranks[k];
    let lo = 0, hi = 0;
    for (let i = 0; i < A.length; i++) { if (A[i] < v - 1e-9) lo++; if (A[i] <= v + 1e-9) hi++; }
    return Math.round(((lo + hi - 1) / 2) / Math.max(1, A.length - 1) * 100);
  }
  function stats(x) {
    const s = of(x), r = raw(s), out = {};
    KEYS.forEach((k) => { out[k] = { raw: r[k], pct: percentile(k, r[k]) }; });
    return out;
  }

  // ---------------- the melee slot (expansion, round 4) ----------------
  // Its own section of the sheet (G.MELEE_WEAPONS, G.CONFIG.melee) and its own
  // six bars, ranked among the melee weapons: a blade and a rifle have little to compare.
  const M_KEYS = ["damage", "speed", "reach", "sweep", "blow", "thrift"];
  const BLOW = { light: 1, medium: 2, heavy: 3, very_heavy: 4 };
  function melee(x) {
    const m = typeof x === "string" ? G.MELEE_WEAPONS[x] : x, K = G.CONFIG.melee;
    if (!m) return null;
    const p = K.moves[m.move].path, arc = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) + Math.hypot(p[1][0] - p[2][0], p[1][1] - p[2][1]);
    const swing = m.windup + m.active + m.recover;
    return { id: m.id, key: m.key, slot: "melee", level: m.level, price: m.price, move: m.move, niche: m.key, weight: m.weight,
      damage: m.damage, head: m.head, charged: m.power ? m.damage * K.power.mult : 0, powerTime: m.power ? m.power.time : 0, powerStamina: m.power ? m.stamina * K.power.stamina : 0,
      windup: m.windup, active: m.active, recover: m.recover, swing, range: m.range, targets: m.targets, arc: Math.round(arc),
      stagger: m.stagger, stamina: m.stamina, dps: m.damage / (swing / 1000), combo: !!m.combo, knock: m.knock || 0, helmet: m.helmet || 1, armor: m.armor || 0,
      unarmored: m.unarmored || 1, lowDamage: m.lowDamage || 1, low: !!m.low, draw: m.draw };
  }
  function meleeRaw(s) {
    return { damage: s.damage * (s.unarmored || 1), speed: 1000 / s.swing, reach: s.range, sweep: s.targets + s.arc / 200, blow: BLOW[s.stagger] + s.knock * 0.5, thrift: s.damage / s.stamina };
  }
  function meleeStats(x) {
    const all = Object.values(G.MELEE_WEAPONS).map((m) => meleeRaw(melee(m))), r = meleeRaw(melee(x)), out = {};
    M_KEYS.forEach((k) => {
      const A = all.map((v) => v[k]).sort((a, b) => a - b);
      let lo = 0, hi = 0;
      for (let i = 0; i < A.length; i++) { if (A[i] < r[k] - 1e-9) lo++; if (A[i] <= r[k] + 1e-9) hi++; }
      out[k] = { raw: r[k], pct: Math.round(((lo + hi - 1) / 2) / Math.max(1, A.length - 1) * 100) };
    });
    return out;
  }

  return { TUNED, KEYS, M_KEYS, apply, classOf, of, falloff, headMult, spread, reserve, pattern, perShot, dps, sustained, raw, stats, melee, meleeStats, active, reset() { sheets = {}; ranks = null; } };
})();

G.GunStats.apply();
