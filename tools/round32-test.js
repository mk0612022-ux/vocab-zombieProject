// Dev-only (not shipped). The expansion's round 3: the guns' stat sheet.
//   A  the sheet: every field of every gun, of the right kind and in range
//   B  who a gun is: its model, sound, weight, name and colours untouched
//   C  the balance: G.Balance run here, in the game: no flag left unexplained
//   D  in play: falloff, the head, spread and bloom, the aim, a run's end, the
//      reload, the reserve, the kick's pattern
//   E  the word rules: a round goes through no more than it may, and stops at
//      a zombie that is spelt; a helmet still has its say
//   F  health by wave: off; on, the curve; a boss keeps its own
//   G  the flag: gunStats off is the old numbers and the old way of shooting
//   H  the Stat Card: six bars, the numbers, against the gun in hand; in the
//      Armory, the mystery box, a crate, the shop, beside a wall gun, the HUD
//   I  every word in all four languages; no card wider than its box
// Load it into the game (in the lobby), with tools/balance.js loaded by it, then:
//   const r = await G.Round32Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round32Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-6 : e);

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const S = G.GunStats, g = G.Game, $ = (id) => document.getElementById(id);
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock;
    const trace0 = G.Aim.trace;
    const real = g._update0 || g.update;
    G._missingKeys = {};
    const all = Object.values(G.WEAPON_DEFS);
    try {
      if (!G.Balance) await load("/tools/balance.js?v=" + Date.now());
      for (const l of ["th", "zh", "fr"]) if (!G.STRINGS[l] && G.UI_LANG_FILES[l]) await load(G.UI_LANG_FILES[l]);

      // ---------------- A: the sheet ----------------
      {
        const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
        const SCHEMA = {
          id: (v, d) => v === d.id, archetype: (v) => !!G.WEAPON_ARCHETYPES[v], cls: (v) => !!G.CONFIG.balance.classes[v], level: (v) => [0, 1, 2, 3].includes(v),
          rarity: (v) => G.RARITY_ORDER.includes(v), source: (v) => ["start", "wall", "box", "shop", "drop"].includes(v), slot: (v) => ["sidearm", "primary"].includes(v),
          niche: (v) => !!G.CONFIG.balance.niches[v], fireMode: (v) => ["semi", "auto", "burst", "bolt", "pump"].includes(v), rpm: (v) => num(v, 10, 2000), interval: (v) => num(v, 0.02, 3),
          damage: (v) => num(v, 1, 400), headMult: (v) => num(v, 1, 4), falloffStart: (v) => num(v, 3, 80), falloffEnd: (v) => num(v, 3, 100), falloffMin: (v) => num(v, 0.2, 1),
          pierce: (v) => num(v, 0, 99), pellets: (v) => num(v, 1, 12), pelletSpread: (v) => num(v, 0, 0.2), burst: (v) => num(v, 1, 5), splash: (v) => num(v, 0, 9),
          mag: (v) => num(v, 1, 100), reserve: (v, d, s) => v === s.mag * s.reserveMags, reserveMags: (v) => num(v, 1, 10),
          reloadEmpty: (v) => num(v, 0.5, 4), reloadTactical: (v, d, s) => num(v, 0.4, s.reloadEmpty),
          weight: (v) => num(v, 0.5, 10), weightClass: (v) => G.WEIGHT_CLASSES.some((c) => c.key === v), moveMult: (v, d) => v === G.weightClass(d).speedMult,
          swapTime: (v) => num(v, 0.2, 2.5), adsTime: (v) => num(v, 0.08, 0.6), sprintOut: (v) => num(v, 0.03, 0.5),
          hipSpread: (v) => num(v, 0.002, 0.2), adsSpread: (v, d, s) => num(v, 0, s.hipSpread), bloom: (v) => num(v, 0, 0.01), bloomMax: (v) => num(v, 0, 0.04), bloomDecay: (v) => num(v, 0, 1),
          recoilV: (v) => num(v, 0.001, 0.1), recoilH: (v) => num(v, 0, 0.05), recoilBack: (v) => num(v, 0.05, 1), recoilSeed: (v) => Number.isInteger(v) && v >= 0,
          sound: (v) => /^(voice|family):/.test(v), color: (v) => num(v, 0, 0xffffff), accent: (v) => num(v, 0, 0xffffff), flash: (v) => ["S", "M", "L", "XL"].includes(v), casing: (v) => typeof v === "string" && !!v,
          priceWall: (v) => num(v, 0, 20000), priceShop: (v) => num(v, 0, 20000), tiers: (v) => Array.isArray(v) && v.length === 3 && v.every((t, i) => t.dmg > (i ? v[i - 1].dmg : 1)),
        };
        const bad = [];
        all.forEach((d) => {
          const s = S.of(d);
          Object.keys(SCHEMA).forEach((k) => { if (!SCHEMA[k](s[k], d, s)) bad.push(d.id + "." + k + "=" + JSON.stringify(s[k])); });
          if (s.falloffEnd < s.falloffStart) bad.push(d.id + " falloff");
          if (d.wallExclusive && !s.priceWall) bad.push(d.id + " no wall price");
        });
        ok("A every field of all " + all.length + " guns, of the right kind and in range (" + Object.keys(SCHEMA).length + " fields)", !bad.length && all.length === 85, bad.slice(0, 8).join(" | "));
        const keys = new Set(["niche", "cls", "fall", "hip", "ads", "bloom", "headMult", "reserveMags", "reloadTactical", "adsTime", "sprintOut"].concat(S.TUNED));
        const stray = Object.keys(G.GUN_SHEET).filter((id) => !G.WEAPON_DEFS[id] || Object.keys(G.GUN_SHEET[id]).some((k) => !keys.has(k)));
        ok("A the sheet holds no gun that is not one, and no field it should not", !stray.length && Object.keys(G.GUN_SHEET).length === all.length, stray.join());
        const fm = {}; all.forEach((d) => { const m = S.of(d).fireMode; fm[m] = (fm[m] || 0) + 1; });
        ok("A all five firing modes are there", ["semi", "auto", "burst", "bolt", "pump"].every((m) => fm[m] > 0), JSON.stringify(fm));
        ok("A the .50 is a bolt gun, the shotgun a pump, the rifle automatic", S.of("overwatch").fireMode === "bolt" && S.of("shotgun").fireMode === "pump" && S.of("rifle").fireMode === "auto");
        ok("A where it comes from", S.of("pistol").source === "start" && S.of("shotgun").source === "shop" && S.of("hall_monitor").source === "wall" && S.of("scrap_spitter").source === "box" && S.of("lmg").source === "drop");
      }

      // ---------------- B: who a gun is ----------------
      {
        const lost = all.filter((d) => {
          const o = Object.assign({}, d, d.orig, { archetype: undefined, proto: undefined, weight: undefined });
          return !d.orig || d.weight !== G.weaponWeight(o) || d.proto !== G.GunRef.proto(Object.assign({}, o, { archetype: d.archetype }));
        });
        ok("B its weight and prototype are the ones of its old numbers (so its model, hold and sound)", !lost.length, lost.map((d) => d.id).join());
        ok("B changing a gun's damage leaves its weight", G.WEAPON_DEFS.science_fair.damage !== G.WEAPON_DEFS.science_fair.orig.damage && G.weaponWeight(G.WEAPON_DEFS.science_fair) === G.WEAPON_DEFS.science_fair.weight);
        ok("B the sheet changes no name, colour or sound", !Object.keys(G.GUN_SHEET).some((id) => ["name", "color", "accent", "proto", "archetype", "rarity"].some((k) => G.GUN_SHEET[id][k] !== undefined)));
        ok("B the guns of the clips keep their rate of fire", G.WEAPON_DEFS.last_stand.fireRate === 80 && G.WEAPON_DEFS.void_principal.fireRate === 100 && G.WEAPON_DEFS.scrap_spitter.fireRate === 52 && G.WEAPON_DEFS.overwatch.fireRate === 1850 && G.WEAPON_DEFS.sniper.fireRate === 1500);
        const d = G.WEAPON_DEFS.hall_monitor, keep = G.GunAudio._prof[d.id];
        delete G.GunAudio._prof[d.id];
        const p = G.GunAudio.profile(d), want = Math.max(0.85, Math.min(1.4, 0.7 + Math.log10(Math.max(5, d.orig.damage)) * 0.25));
        if (keep) G.GunAudio._prof[d.id] = keep;
        ok("B a gun's punch is still heard from its old damage", p.proto ? p.punch === 1 : near(p.punch, want, 1e-9), p.punch);
      }

      // ---------------- C: the balance ----------------
      const B = G.Balance.run();
      {
        numbers.flags = B.flags.length; numbers.explained = B.flags.length - B.unexplained.length;
        ok("C no flag left unexplained", !B.unexplained.length, B.unexplained.map((f) => f.kind + " " + f.id + ": " + f.text).join(" | "));
        ok("C one row for each gun", B.rows.length === 85);
        const off = B.rows.filter((r) => r.id !== "golden_smg").filter((r) => { const K = G.CONFIG.balance.classes[r.cls]; return r.stkBody < K.body[0] || r.stkBody > K.body[1] || r.stkHead < K.head[0] || r.stkHead > K.head[1]; });
        ok("C shots to a Shambler in every class's window, the jackpot apart", !off.length, off.map((r) => r.id + " " + r.stkBody + "/" + r.stkHead).join());
        const over = B.rows.filter((r) => r.id !== "golden_smg" && r.score > r.allowed * (1 + G.CONFIG.balance.tolerance));
        ok("C every gun in its rarity's budget, the jackpot apart", !over.length, over.map((r) => r.id).join());
        const niche = B.flags.filter((f) => f.kind === "niche");
        ok("C a niche for every gun, none twice in a (level, rarity)", !niche.length, niche.map((f) => f.id).join());
        const avg = (i) => B.rows.reduce((s, r) => s + r.byWave[i], 0) / B.rows.length;
        const single = B.rows.filter((r) => r.byWave[0] >= 3);
        const ratio = single.reduce((s, r) => s + r.byWave[4] / r.byWave[0], 0) / single.length;
        numbers.wave20 = +ratio.toFixed(2); numbers.avgShots = [0, 1, 2, 3, 4].map((i) => +avg(i).toFixed(2));
        ok("C at wave 20 an unupgraded gun needs 2-3 times the shots", ratio >= 2 && ratio <= 3, ratio.toFixed(2));
        const t3 = single.filter((r) => r.tier3 > r.byWave[1] + 1);
        ok("C Tier III at wave 20 is back near wave 5", !t3.length, t3.map((r) => r.id + " " + r.tier3 + "/" + r.byWave[1]).join());
        ok("C the report, the table and the changelog are made", /# Balance report/.test(B.md) && B.csv.split("\n").length === 87 && /# Gun changelog/.test(B.changelog) && /hall_monitor \| rare \| damage \| 24 \| 11/.test(B.changelog));
        const byW = {};
        B.rows.forEach((r) => { (byW[r.weightClass] = byW[r.weightClass] || []).push(S.of(r.id)); });
        const mean = (a, k) => a.reduce((t, s) => t + s[k], 0) / a.length;
        const line = G.WEIGHT_CLASSES.map((c) => byW[c.key]).filter(Boolean);
        // (a gun of the clips comes up in its clip's time, whatever it weighs: the others go by weight)
        const free = line.map((a) => a.filter((s) => !G.GunRef.info(G.WEAPON_DEFS[s.id])));
        ok("C weight as it was: the heavier, the slower to walk, to aim, out of a run and to bring up", line.every((a, i) => !i || (mean(a, "moveMult") < mean(line[i - 1], "moveMult") && mean(a, "adsTime") > mean(line[i - 1], "adsTime") && mean(a, "sprintOut") > mean(line[i - 1], "sprintOut") && mean(free[i], "swapTime") > mean(free[i - 1], "swapTime"))), line.map((a, i) => mean(a, "adsTime").toFixed(2) + "/" + mean(free[i], "swapTime").toFixed(2)).join());
        ok("C the report looks at the boss fights", /## Boss fights/.test(B.md));
        ok("C the rarities: more budget, higher up", ["common", "uncommon", "rare", "epic", "secret"].every((r, i, a) => !i || G.CONFIG.balance.rarity[r] > G.CONFIG.balance.rarity[a[i - 1]]));
      }

      // ---------------- D: in play ----------------
      G.Input.requestPointerLock = () => {};
      G.save.tutorialDone = true;
      g.update = real;
      g.startLevel(1);
      G.Spawner.update = () => {};
      g.update = () => {};
      G.Modal.reset();
      g.paused = false; g.state = "GAMEPLAY";
      g.player.hp = g.player.maxHp = 1e6;
      g.clearZombies();
      G.Input.clearHeldInputs();
      for (let i = 0; i < 4; i++) real.call(g, 1 / 60);
      const P = g.yawObject.position;
      const dirOf = () => { const d = new THREE.Vector3(); g.camera.getWorldDirection(d); return d; };
      const originOf = () => { const o = new THREE.Vector3(); g.camera.getWorldPosition(o); return o; };
      // a shot that meets these zombies, at these distances
      const shotAt = (list, dmg, pierce, def) => {
        G.Aim.trace = () => list.map((x) => ({ z: x.z, head: !!x.head, distance: x.dist, point: x.z.mesh.position.clone().setY(P.y) }));
        try { g.raycastShoot(originOf(), dirOf(), dmg, pierce, def); } finally { G.Aim.trace = trace0; }
      };
      const zombie = (type) => { const z = g.spawnZombieAt(type || "normal", P.clone().add(new THREE.Vector3(30, 0, 30)), null); z.hp = z.maxHp = 9999; return z; };
      {
        const smg = G.WEAPON_DEFS.smg, s = S.of(smg);
        ok("D full damage to where its falloff starts", S.falloff(smg, s.falloffStart) === 1 && S.falloff(smg, 1) === 1);
        ok("D falling with distance, down to its least", near(S.falloff(smg, (s.falloffStart + s.falloffEnd) / 2), (1 + s.falloffMin) / 2) && S.falloff(smg, 500) === s.falloffMin);
        ok("D a sniper and a launcher do not fall off", S.falloff(G.WEAPON_DEFS.sniper, 55) === 1 && S.falloff(G.WEAPON_DEFS.grenadelauncher, 55) === 1);
        const none = [{ damage: 1 }, G.WEAPON_DEFS.melee];
        ok("D what lands without a sheet keeps the old rules (the knife, a stand-in with no id)", none.every((d) => S.falloff(d, 55) === 1 && S.headMult(d) === G.HEADSHOT_MULT));
        const z = zombie();
        const hp0 = z.hp;
        shotAt([{ z, dist: 5 }], 10, 0, smg);
        const close = hp0 - z.hp, hp1 = z.hp;
        shotAt([{ z, dist: 60 }], 10, 0, smg);
        const far = hp1 - z.hp;
        ok("D a real shot: 10 close, its least far off", near(close, 10) && near(far, 10 * s.falloffMin), close + " / " + far);
        const hp2 = z.hp;
        shotAt([{ z, dist: 5, head: true }], 10, 0, smg);
        ok("D a head hit: the gun's multiplier", near(hp2 - z.hp, 10 * s.headMult), hp2 - z.hp);
        const hh = G.WEAPON_DEFS.tri_burst, hp3 = z.hp;
        shotAt([{ z, dist: 5, head: true }], 10, 0, hh);
        ok("D a headhunter's is higher than its class's", near(hp3 - z.hp, 10 * S.of(hh).headMult) && S.of(hh).headMult > G.CONFIG.balance.classes.rifle.headMult, S.of(hh).headMult);
        const b0 = G.Bosses.onShot;
        let bossDmg = null;
        G.Bosses.onShot = (a, b, d) => { bossDmg = d; return { hit: false }; };
        const box = new THREE.Object3D(); box.userData.bossHit = {};
        const hb0 = G.Bosses.hitboxes, ray0 = g.raycaster.intersectObjects;
        G.Bosses.hitboxes = () => [box];
        g.raycaster.intersectObjects = () => [{ distance: 60, object: box, point: P.clone() }];
        G.Aim.trace = () => [];
        try { g.raycastShoot(originOf(), dirOf(), 100, 0, smg); } finally { G.Aim.trace = trace0; G.Bosses.onShot = b0; G.Bosses.hitboxes = hb0; g.raycaster.intersectObjects = ray0; }
        ok("D a boss too takes less from far off", near(bossDmg, 100 * s.falloffMin), bossDmg);

        const rf = G.WEAPON_DEFS.rifle;
        ok("D tighter in the aim than from the hip", S.spread(rf, 1, 0) < S.spread(rf, 0, 0) && S.spread(rf, 0, 0) === S.of(rf).hipSpread && near(S.spread(rf, 1, 0), S.of(rf).adsSpread));
        ok("D a shotgun's pattern is its own spread, a little tighter aimed", S.spread(G.WEAPON_DEFS.sterile_slug, 0, 0) === 0.075 && S.spread(G.WEAPON_DEFS.sterile_slug, 1, 0) < 0.075);
        g._bloom = 0; g._shotN = 0;
        g.addBloom(rf); g.addBloom(rf);
        const two = g._bloom;
        for (let i = 0; i < 60; i++) g.addBloom(rf);
        ok("D shots open the spread, up to its most", near(two, S.of(rf).bloom * 2) && near(g._bloom, S.of(rf).bloomMax) && g._shotN === 62, g._bloom);
        ok("D ...which a shot then feels", S.spread(rf, 0, g._bloom) > S.of(rf).hipSpread);
        g.updateBloom(0.1, rf);
        const after = g._bloom;
        g.updateBloom(5, rf);
        ok("D it closes on its own, and the string ends", after < S.of(rf).bloomMax && g._bloom === 0 && g._shotN === 0, after);

        const pa = S.pattern(rf, 5), pb = S.pattern(rf, 5), pc = S.pattern(rf, 6), pd = S.pattern(G.WEAPON_DEFS.smg, 5);
        ok("D the kick's pattern: the same each time, its own for each gun", pa === pb && pa !== pc && pa !== pd && Math.abs(pa) <= 1);

        const nim = G.WEAPON_DEFS.smg, hv = G.WEAPON_DEFS.overwatch;
        ok("D the aim's time is the gun's: a nimble one quicker than its weight's", S.of(nim).adsTime < G.CONFIG.weaponSM.aimIn[S.of(nim).weightClass]);
        g.player.gunSlots = ["smg", "pistol"]; g.player.ammo.smg = { mag: 30, reserve: 120 }; g.player.weaponLevels.smg = { dmg: 1, rate: 1, mag: 1 };
        g.player.currentSlot = 1;
        g.wsm.finishSwitch && g.wsm.finishSwitch();
        for (let i = 0; i < 40; i++) real.call(g, 1 / 60);
        const hold = g.currentWeaponDef();
        g.aimP = 0; G.Input.aimDown = true;
        real.call(g, 1 / 60); real.call(g, 1 / 60);
        const was = g.aimP;
        real.call(g, 1 / 60);
        const gain = g.aimP - was;
        G.Input.aimDown = false;
        ok("D ...in the game too", hold.id === "smg" && near(gain, (1 / 60) / S.of(hold).adsTime, 1e-6), hold.id + " " + gain);
        ok("D out of a run, the gun's own", g.wsm && g.weaponHost().sprintOut("smg") === S.of("smg").sprintOut && S.of("smg").sprintOut < G.CONFIG.weaponSM.sprintOut.medium);
        ok("D a tactical reload takes the sheet's time", near(G.ViewModel.planReload(G.WEAPON_DEFS.rifle, 5, "tactical").dur, S.of("rifle").reloadTactical) && near(G.ViewModel.planReload(G.WEAPON_DEFS.rifle, 5, "empty").dur, S.of("rifle").reloadEmpty));
        ok("D the reserve is the sheet's", g.fullReserve("smg") === S.of("smg").reserve && G.Loadout.freshAmmo("smg").reserve === S.of("smg").reserve, g.fullReserve("smg"));
        ok("D an upgraded magazine carries more", (() => { g.player.weaponLevels.smg.mag = 1.2; const v = g.fullReserve("smg"); g.player.weaponLevels.smg.mag = 1; return v === 36 * S.of("smg").reserveMags; })());
        ok("D the boss's sizing of a gun still reads it", G.Bosses.playerDps(g) > 30);
      }

      // ---------------- E: the word rules ----------------
      {
        const def = G.WEAPON_DEFS.overwatch, list = [1, 2, 3, 4, 5].map((i) => ({ z: zombie(), dist: i * 3 }));
        ok("E the .50 goes through (+ class rule)", def.pierce === 3);
        const hp = list.map((x) => x.z.hp);
        shotAt(list, 50, def.pierce, def);
        const hit = list.filter((x, i) => x.z.hp < hp[i]).length;
        ok("E a round goes through as many as its pierce, and no more", hit === 3, hit);
        const a = zombie(), b = zombie(), c = zombie();
        const h = [a.hp, b.hp, c.hp];
        b.answer = "spell";
        shotAt([{ z: a, dist: 3 }, { z: b, dist: 6 }, { z: c, dist: 9 }], 50, 99, G.WEAPON_DEFS.railgun);
        ok("E a zombie that must be spelt stops the round, unhurt", a.hp < h[0] && b.hp === h[1] && c.hp === h[2], [a.hp, b.hp, c.hp].join());
        b.answer = "shoot";
        const iron = zombie("ironclad"), i0 = iron.hp;
        const I = G.CONFIG.zombies.ironclad || (G.CONFIG.zombieAI && G.CONFIG.zombieAI.ironclad);
        shotAt([{ z: iron, dist: 3, head: true }], 100, 0, G.WEAPON_DEFS.sniper);
        const took = i0 - iron.hp;
        ok("E a helmet still has its say: a head hit is not doubled", took < 100 * S.of("sniper").headMult && took <= 100, took + (I ? "" : ""));
        g.clearZombies();
      }

      // ---------------- F: health by wave ----------------
      {
        // (on since expansion round 6 -- the user's choice, 2026-11-12, with the Word Forge)
        const H = G.CONFIG.zombies.hpByWave, keep = H.on;
        ok("F on (since round 6): the curve", H.on === true && near(G.zombieHpMult(1), 1) && near(G.zombieHpMult(20), 1 + 19 * H.perWave), G.zombieHpMult(20));
        const sw = g.wave;
        g.wave = 20;
        const on = g.spawnZombieAt("normal", P.clone().add(new THREE.Vector3(8, 0, 0)), null).hp;
        H.on = false;
        ok("F off: every wave has the kind's health", G.zombieHpMult(20) === 1);
        const off = g.spawnZombieAt("normal", P.clone().add(new THREE.Vector3(9, 0, 0)), null).hp;
        H.on = keep;
        g.wave = sw;
        ok("F a zombie of wave 20: the curve's health while it is on, the kind's own while it is off", on === Math.round(G.ZOMBIE_TYPES.normal.hp * (1 + 19 * H.perWave)) && off === G.ZOMBIE_TYPES.normal.hp, on + " / " + off);
        g.clearZombies();
        ok("F a boss has its own curve", G.CONFIG.boss.hpByWave[20] === 32000);
      }

      // ---------------- G: the flag ----------------
      {
        const X = G.CONFIG.expansion, keep = X.gunStats;
        X.gunStats = false;
        const smg = G.WEAPON_DEFS.smg;
        const legacy = S.spread(smg, 1, 0.01) === 0.004 && S.spread(G.WEAPON_DEFS.sterile_slug, 0, 0) === 0.075 && S.falloff(smg, 60) === 1 && S.headMult(smg) === G.HEADSHOT_MULT && S.reserve(smg, 30) === 120;
        X.gunStats = keep;
        ok("G off: one spread, no falloff, one head multiplier, four magazines", legacy);
        // a real load with it off: the old numbers, on the page of the tools
        const f = document.createElement("iframe");
        f.style.cssText = "position:fixed;left:-2000px;width:100px;height:100px";
        document.body.appendChild(f);
        const w = f.contentWindow, d = f.contentDocument;
        const add = (src, code) => new Promise((res, rej) => { const s = d.createElement("script"); if (src) { s.src = src; s.onload = res; s.onerror = rej; } else s.textContent = code; d.head.appendChild(s); if (!src) res(); });
        await add("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        await add("/js/config.js");
        await add(null, "G.CONFIG.expansion.gunStats = false;");
        for (const s of ["/js/gunref.js", "/js/entities.js", "/js/data/gunstats.js", "/js/gunstats.js"]) await add(s);
        const W = w.G.WEAPON_DEFS;
        ok("G off, loaded: every gun's old numbers", W.hall_monitor.damage === 24 && W.overwatch.pierce === undefined && W.overwatch.damage === 352 && W.science_fair.magSize === 40 && W.golden_smg.damage === 55, W.hall_monitor.damage);
        await add(null, "G.CONFIG.expansion.diag = false; window.__log0 = console.log;");
        await add("/js/diag.js");
        w.G.Diag.frame(16);
        ok("G the bug report's collecting has a flag too: off, the console is its own and no frame is kept", w.console.log === w.__log0 && w.G.Diag.fps().frames === 0);
        f.remove();
      }

      // ---------------- H: the Stat Card ----------------
      {
        const C = G.StatCard, smg = G.WEAPON_DEFS.smg, box = document.createElement("div");
        box.style.cssText = "position:fixed;left:0;top:0;width:260px;z-index:9999;background:#123";
        document.body.appendChild(box);
        box.innerHTML = C.html(smg);
        const bars = box.querySelectorAll(".statc-bar");
        ok("H six bars", bars.length === 6);
        const nameStyle = getComputedStyle(box.querySelector(".statc-name"));
        ok("H a long name wraps, it is not cut", nameStyle.whiteSpace !== "nowrap" && nameStyle.overflowX === "visible");
        // (the first draft shared .sc-name with Settings' categories: each took on the other's look)
        const setName = document.createElement("span");
        setName.className = "sc-name"; box.appendChild(setName);
        ok("H the card's classes are its own: a Settings category's name keeps its look", getComputedStyle(setName).fontWeight !== "800" && getComputedStyle(setName).whiteSpace === "nowrap");
        setName.remove();
        const st = S.stats(smg);
        ok("H each 0-100, what the sheet says", S.KEYS.every((k, i) => bars[i].querySelector(".statc-pct").textContent === String(st[k].pct) && st[k].pct >= 0 && st[k].pct <= 100 && bars[i].querySelector("i").style.width === st[k].pct + "%"));
        const top = (k) => all.slice().sort((a, b) => S.raw(S.of(b))[k] - S.raw(S.of(a))[k])[0];
        ok("H the best gun at a thing is at 100, the worst near 0", S.KEYS.every((k) => { const v = all.map((d) => S.stats(d)[k].pct); return Math.max.apply(null, v) >= 98 && Math.min.apply(null, v) <= 3; }));
        ok("H the .50 and the doomsday lead on damage, the two-tone SMG on rate", ["overwatch", "doomsday", "warhead", "flatline", "vital_sign"].includes(top("damage").id) && top("rate").id === "scrap_spitter", top("damage").id + " " + top("rate").id);
        const text = box.textContent;
        ok("H the real numbers: magazine, reserve, reload, RPM", text.includes(String(S.of(smg).mag)) && text.includes(String(S.of(smg).reserve)) && text.includes(S.of(smg).reloadEmpty.toFixed(1)) && text.includes(String(S.of(smg).rpm)));
        ok("H its niche, its firing mode, its weight", text.includes(G.T("niche.nimble")) && text.includes(G.fireModeLabel(smg)) && text.includes(G.weightClass(smg).label));
        ok("H no difference shown with nothing to compare", !box.querySelector(".statc-delta"));
        box.innerHTML = C.html(smg, { compare: G.WEAPON_DEFS.sniper });
        const del = Array.from(box.querySelectorAll(".statc-delta"));
        const other = S.stats("sniper");
        const signs = S.KEYS.every((k, i) => { const d = st[k].pct - other[k].pct, e = del[i]; return d > 0 ? e.classList.contains("up") && e.textContent.includes("▲") && e.textContent.includes(String(d)) : d < 0 ? e.classList.contains("down") && e.textContent.includes("▼") && e.textContent.includes(String(-d)) : e.classList.contains("same"); });
        ok("H against another gun: an arrow for each, green up, red down, and by how much", del.length === 6 && signs);
        ok("H ...and it says against what", box.textContent.includes(G.T("stat.vs", { name: G.WEAPON_DEFS.sniper.name })));
        box.innerHTML = C.html(smg, { compare: smg });
        ok("H against itself: nothing to show", !box.querySelector(".statc-delta"));
        ok("H the gun in hand", C.held() && C.held().id === g.currentWeaponDef().id);
        box.innerHTML = C.html(smg, { lvl: { mag: 1.2 } });
        ok("H an upgraded magazine shows", box.textContent.includes("36"));
        box.remove();

        // the Armory: a known gun has the card, an unknown one stays a lock
        const known = G.save.unlockedWeapons, shown = (G.save.unlockedWeapons = ["smg"]);
        G.UI.renderWeaponLog(1);
        const log = $("weaponlog-content");
        // (round 4: the melee weapons have their own section, never locked)
        ok("H the Armory: a gun you have met has the card", log.querySelectorAll(".stat-card:not(.melee)").length === 1 && log.querySelector(".stat-card:not(.melee)").textContent.includes(G.WEAPON_DEFS.smg.name), shown.length);
        ok("H ...one you have not stays a lock", log.querySelectorAll(".weaponlog-card.locked").length === G.weaponsForLevel(1).length - 1);
        G.save.unlockedWeapons = known;
        const hand = G.WEAPON_DEFS.sniper;
        const curr = g.currentWeaponDef;
        g.currentWeaponDef = () => hand;
        ok("H ...and in a run, against the gun in hand", C.html(smg, { compare: C.held() }).includes(G.T("stat.vs", { name: hand.name })));
        G.UI.showCrateScreen("uncommon", smg);
        ok("H a crate", !!$("crate-weapon-stats").querySelector(".stat-card.compare"));
        G.UI.revealMysteryCards([G.WEAPON_DEFS.scrap_spitter], 0);
        ok("H the mystery box", !!$("mystery-result-stats").querySelector(".stat-card.compare"), $("mystery-result-stats").textContent.slice(0, 40));
        g.currentWeaponDef = curr;
        G.UI.hideAllScreens();

        // the shop: a gun on sale
        g.player.gunSlots = ["pistol"];
        g.player.money = 99999;
        G.UI.renderShop();
        const cards = Array.from(document.querySelectorAll("#shop-grid .shop-item")).filter((e) => e.querySelector(".stat-card"));
        ok("H the shop: the three guns on sale", cards.length === 3, cards.length);
        const buy = cards[0].querySelector("button");
        ok("H ...which can still be bought", !!buy && !buy.disabled);

        // beside a wall gun, whatever the controls
        const panel = $("hud-statcard");
        C.showHud(G.WEAPON_DEFS.hall_monitor);
        ok("H a wall gun shows its card, no button needed", !panel.classList.contains("hidden") && !!panel.querySelector(".stat-card") && getComputedStyle(panel).pointerEvents === "none");
        const first = panel.innerHTML;
        C.showHud(G.WEAPON_DEFS.hall_monitor);
        ok("H ...not rebuilt every frame", panel.innerHTML === first);
        g.updateInteractRay();
        ok("H ...and gone when you look away", panel.classList.contains("hidden") && !panel.querySelector(".stat-card"));
        const it = g.world.interactables.find((i) => i.kind === "wallweapon");
        if (it) {
          const ray = g.raycaster;
          ray.intersectObjects = () => [{ object: it.mesh, distance: 1 }];
          it.ref.purchased = false;
          g.updateInteractRay();
          const seen = !panel.classList.contains("hidden");
          it.ref.purchased = true;
          g.updateInteractRay();
          const gone = panel.classList.contains("hidden");
          it.ref.purchased = false;
          delete ray.intersectObjects;
          ok("H looking at a real wall gun: the card; bought: none", seen && gone, it.ref.id);
        } else ok("H (no wall gun in this level)", false);
        C.hideHud();

        // the HUD's label comes from the same sheet
        const W = g.buildHudState().hand;
        const dh = g.currentWeaponDef();
        ok("H the HUD's label: rarity and weight", dh.id === "melee" ? W.status === G.T("hud.melee") : W.status === G.RARITY[dh.rarity].label + " · " + G.weightClass(dh).label, W.status);
      }

      // ---------------- I: words and room ----------------
      {
        const keys = Object.keys(G.CONFIG.balance.niches).map((k) => "niche." + k).concat(S.KEYS.map((k) => "stat." + k), ["stat.mag", "stat.reserve", "stat.reload", "stat.rpm", "stat.seconds", "stat.vs"]);
        const miss = [];
        ["en", "th", "zh", "fr"].forEach((l) => keys.forEach((k) => { if (!G.STRINGS[l] || !G.STRINGS[l][k]) miss.push(l + ":" + k); }));
        ok("I every word in all four languages (" + keys.length + ")", !miss.length, miss.slice(0, 6).join());
        const used = new Set(Object.values(G.GUN_SHEET).map((s) => s.niche));
        ok("I every niche in use has its meaning", Array.from(used).every((n) => G.CONFIG.balance.niches[n]) && used.size >= 12, used.size);
        const box = document.createElement("div");
        box.style.cssText = "position:fixed;left:0;top:0;width:210px;z-index:9999";
        document.body.appendChild(box);
        const longest = all.slice().sort((a, b) => b.name.length - a.name.length)[0];
        const wide = [];
        for (const l of ["en", "th", "zh", "fr"]) {
          await new Promise((r) => G.setUILang(l, { done: r }));
          box.innerHTML = G.StatCard.html(longest, { compare: G.WEAPON_DEFS.sniper });
          const c = box.querySelector(".stat-card");
          if (c.scrollWidth > c.clientWidth + 1) wide.push(l + " " + c.scrollWidth);
        }
        box.remove();
        ok("I the card fits a 210 px box in all four languages, against another gun", !wide.length, wide.join());
      }
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
      G.Aim.trace = trace0;
      G.Input.aimDown = false;
      G.Spawner.update = spawn0;
      G.Input.requestPointerLock = lock0;
      g.update = real;
      G.Modal.reset();
      if (G.StatCard) G.StatCard.hideHud();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
