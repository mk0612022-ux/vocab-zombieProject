// ============================================================
// SYSTEMS: spawner, boss fight, shop, achievements, leaderboard,
//          daily challenge
// ============================================================
window.G = window.G || {};

// ---------------- Spawner ----------------
// ---------------- The waves: G.WAVE_COUNT, G.BOSS_EVERY and G.WAVE_TABLE are in js/config.js ----------------
// the wave `wave` of `level`: its row, made harder for the later levels.
// Campaign overtime (past 20, objectives still to do) plays like wave 19;
// Endless keeps climbing slowly past 20, to a ceiling.
G.waveSpec = function (level, wave, mode) {
  let row;
  if (wave <= G.WAVE_TABLE.length) row = G.WAVE_TABLE[Math.max(1, wave) - 1];
  else if (mode === "endless") {
    const k = wave - G.WAVE_TABLE.length, r = G.WAVE_TABLE[18];
    row = [Math.min(40, r[0] + k * 0.6), Math.min(1.45, r[1] + k * 0.01), Math.min(0.55, r[2] + k * 0.006), 0.16, Math.min(14, r[4] + Math.floor(k / 5)), Math.max(1.3, r[5] - k * 0.02)];
  } else row = G.WAVE_TABLE[18];
  const d = (level && level.difficulty || 1) - 1;
  return {
    kills: Math.round(row[0] * (1 + d * 0.25)),
    speed: row[1] + d * 0.12,
    fast: Math.min(0.6, row[2] + d * 0.1),
    crawler: row[3],
    alive: row[4] + Math.round(d * 4),
    every: row[5] * (1 - d * 0.2),
  };
};
G.isBossWave = function (wave) { return wave > 0 && wave % G.BOSS_EVERY === 0; };

// ---------------- Money: G.ECONOMY is in js/config.js ----------------
(function () {
  Object.values(G.WEAPON_DEFS || {}).forEach((d) => { if (d.price && d.price < 9999) d.price = Math.round(d.price * G.ECONOMY.gunScale / 50) * 50; });
})();

G.Spawner = {
  timer: 0,
  interval: 5,
  spec: null,
  reset(level, wave, mode) {
    this.spec = G.waveSpec(level, wave, mode);
    this.interval = this.spec.every;
    this.timer = this.interval * 0.5;
  },
  update(dt, world, aliveCount, maxAlive, spawnFn, waveDifficulty, playerPos, fwd) {
    const spec = this.spec;
    if (aliveCount >= (spec ? spec.alive : maxAlive)) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.interval;
      const sp = this.pickPoint(world, playerPos, fwd);
      if (!sp) return;
      sp.cooldown = 2.5;
      const fastChance = spec ? spec.fast : Math.min(0.55, 0.1 + waveDifficulty * 0.08);
      const crawlerChance = spec ? spec.crawler : Math.min(0.22, 0.05 + waveDifficulty * 0.025);
      let type = "normal";
      if (sp.types.includes("fast") && G.rng() < fastChance) type = "fast";
      else if (G.rng() < crawlerChance) type = "crawler";
      spawnFn(type, sp.pos, sp);
    }
    world.spawnPoints.forEach((sp) => { if (sp.cooldown > 0) sp.cooldown -= dt; });
  },

  // Where the next zombie comes from (round 3, F3). The campus is ten times
  // the old yard and the building three storeys, so a fixed point is usually
  // nowhere near the player. Zombies come in AROUND the player instead:
  //   indoors   a fixed point (a locker, a vent, a desk, a window) within
  //             reach -- the same storey counts for more than one upstairs --
  //             and out of sight if there is one
  //   outdoors  mostly up through the ground somewhere behind the player, 12
  //             to 28 m off, clear of anything solid
  // Category P still holds: never behind a door the player has not opened
  // (G.spawnPointOpen). `fwd` is the way the camera faces (flat).
  pickPoint(world, playerPos, fwd) {
    const usable = world.spawnPoints.filter((sp) => sp.cooldown <= 0 && sp.types[0] !== "boss" && G.spawnPointOpen(world, sp));
    if (!playerPos) return usable.length ? G.pick(usable) : null;
    const feet = playerPos.y - 1.7;
    const region = G.getRegionAt(world, playerPos.x, playerPos.z, feet) || "";
    const outdoors = /^YARD/.test(region);
    if (outdoors && world.campus && (G.rng() < 0.65)) {
      const g = this.groundPoint(world, playerPos, fwd);
      if (g) return g;
    }
    const cands = [];
    for (const sp of usable) {
      const dx = sp.pos.x - playerPos.x, dz = sp.pos.z - playerPos.z, flat = Math.hypot(dx, dz);
      const d = flat + Math.abs(sp.pos.y - feet) * 3;
      if (flat < 6 || d > 46) continue;
      const sameStorey = Math.abs(sp.pos.y - feet) < 1.5;
      const seen = fwd && flat > 0.1 && (dx * fwd.x + dz * fwd.z) / flat > 0.45 && sameStorey;
      // another storey is a long way round by the stairs, however close it
      // looks through the floor
      cands.push({ sp, w: (1 / (6 + d)) * (seen ? 0.3 : 1) * (sameStorey ? 1 : 0.12) });
    }
    if (!cands.length) {
      if (outdoors && world.campus) { const g = this.groundPoint(world, playerPos, fwd, true); if (g) return g; }
      // nothing near: the old rule, nearest-weighted over everything open
      const far = usable.filter((sp) => sp.pos.distanceTo(playerPos) >= 6);
      const pool = far.length ? far : usable;
      if (!pool.length) return null;
      pool.forEach((sp) => cands.push({ sp, w: 1 / (6 + sp.pos.distanceTo(playerPos)) }));
    }
    let total = 0;
    cands.forEach((c) => { total += c.w; });
    let r = G.rng() * total;
    for (const c of cands) { r -= c.w; if (r <= 0) return c.sp; }
    return cands[cands.length - 1].sp;
  },
  // a patch of open ground near the player, out of their sight, where a
  // zombie can come up through the grass
  groundPoint(world, playerPos, fwd, anyAngle) {
    const C = world.campus;
    const inRect = (x, z, r, pad) => x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;
    const tmp = [];
    for (let t = 0; t < 30; t++) {
      const a = G.rng() * Math.PI * 2, rad = 12 + G.rng() * 16;
      const ux = Math.cos(a), uz = Math.sin(a);
      if (!anyAngle && fwd && ux * fwd.x + uz * fwd.z > 0.25) continue;     // in front of them: somewhere else
      const x = playerPos.x + ux * rad, z = playerPos.z + uz * rad;
      if (x < C.x0 + 2.5 || x > C.x1 - 2.5 || z < C.z0 + 2.5 || z > C.z1 - 2.5) continue;
      if ((world.footprint || []).some((f) => inRect(x, z, f, 1.5))) continue;
      if (Math.abs(G.getFloorHeightAt(world, x, z, 0)) > 0.05) continue;     // not on the stand or a sala floor
      const hit = G.ColGrid.near(world, x, z, 1.2, tmp).some((c) => c.min.y < 1.8 && c.max.y > 0.05 && x + 0.7 > c.min.x && x - 0.7 < c.max.x && z + 0.7 > c.min.z && z - 0.7 < c.max.z);
      if (hit) continue;
      const end = new THREE.Vector3(x, 0, z);
      return { pos: end.clone(), types: ["normal", "fast"], cooldown: 0, ground: true, emerge: { kind: "ground", end, floorY: 0 } };
    }
    return null;
  },
};

// A third of the school's spawn points are on the upper floor, and two more
// sit inside the secret room and the word-locked store. A zombie spawned there
// before that part of the building is open can never reach the player -- and
// since a wave only ends when everything spawned is dead, it stalled the wave
// until the player happened to unlock the area. (The spawner's preference for
// nearby points made it worse: a point on the floor above is only 4.2 units
// away.) Each gated point records what gates it, in buildComplex.
G.spawnPointOpen = function (world, sp) {
  if (!sp.gate) return true;
  if (sp.gate === "upper") return !world.secondFloor || world.secondFloor.unlocked;
  if (sp.gate === "top") return !world.thirdFloor || world.thirdFloor.unlocked;
  if (sp.gate === "secret") return !world.secretZone || world.secretZone.unlocked;
  if (sp.gate === "word") return (world.doors || []).every((d) => d.kind !== "word" || d.opened);
  return true;
};

// (the old quiz boss, G.BossFight, is gone: the bosses are js/bosses.js now,
// and the one word question comes after the boss is down)
G.pickHardWords = function (wordPool, count) {
  // Priority: previously-wrong words > longer-than-average words > random
  const avgLen = wordPool.reduce((a, p) => a + p[0].length, 0) / wordPool.length;
  const wrongOnes = wordPool.filter((p) => {
    const s = G.save.wordStats[p[0].toLowerCase()];
    return s && s.wrong > 0 && s.wrong >= s.correct;
  });
  const longOnes = wordPool.filter((p) => p[0].length > avgLen && !wrongOnes.includes(p));
  const rest = wordPool.filter((p) => !wrongOnes.includes(p) && !longOnes.includes(p));
  const combined = [].concat(G.shuffle(wrongOnes), G.shuffle(longOnes), G.shuffle(rest));
  return combined.slice(0, count);
};

// ---------------- Shop ----------------
G.Shop = {
  prices: {}, // runtime per-run purchase counters, reset each new game
  resetRun() { this.prices = {}; },
  priceFor(baseKey, basePrice, growth) {
    const n = this.prices[baseKey] || 0;
    return Math.round(basePrice * Math.pow(growth || 1.28, n));
  },
  recordPurchase(baseKey) { this.prices[baseKey] = (this.prices[baseKey] || 0) + 1; },
};

// ---------------- G.SHOP_ITEMS (what the shop sells, and for how much): js/config.js ----------------

// ---------------- Achievements ----------------
// The ids are save keys (G.save.achievements); name/desc come from
// "ach.<id>.name" / "ach.<id>.desc" in js/strings.js.
G.ACHIEVEMENTS = [
  { id: "streak50", icon: "🧠" },
  { id: "secret_crate", icon: "🌟" },
  { id: "no_hit_level", icon: "🥷" },
  { id: "all_levels", icon: "🏆" },
  { id: "first_boss", icon: "💀" },
  { id: "endless_10", icon: "⏳" },
  // round 3: every story note of a level in the journal
  { id: "notes_level1", icon: "📜" },
  { id: "notes_level2", icon: "📜" },
  { id: "notes_level3", icon: "📜" },
];

G.unlockAchievement = function (id) {
  if (G.save.achievements[id]) return false;
  G.save.achievements[id] = true;
  G.persist();
  G.UI && G.UI.showAchievementToast && G.UI.showAchievementToast(id);
  return true;
};

// ---------------- Leaderboard ----------------
G.addLeaderboardEntry = function (category, score, meta) {
  const list = G.save.leaderboards[category] || (G.save.leaderboards[category] = []);
  list.push({ score, date: new Date().toISOString().slice(0, 10), meta: meta || "" });
  list.sort((a, b) => b.score - a.score);
  G.save.leaderboards[category] = list.slice(0, 10);
  G.persist();
};

// ---------------- Daily challenge ----------------
G.getDailyWordSet = function () {
  const seed = G.dateSeed();
  const savedRng = G.rng;
  G.rng = G.makeRng(seed);
  const all = G.getAllBuiltinWords();
  const chosen = G.shuffle(all).slice(0, 20);
  G.rng = savedRng;
  return chosen;
};
G.dailyKey = function (d) {
  d = d || new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
