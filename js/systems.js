// ============================================================
// SYSTEMS: spawner, boss fight, shop, achievements, leaderboard,
//          daily challenge
// ============================================================
window.G = window.G || {};

// ---------------- Spawner ----------------
G.Spawner = {
  timer: 0,
  interval: 5,
  reset(level, wave) {
    this.interval = Math.max(1.1, level.spawnBaseInterval - wave * 0.35);
    this.timer = this.interval * 0.5;
  },
  update(dt, world, aliveCount, maxAlive, spawnFn, waveDifficulty, playerPos) {
    if (aliveCount >= maxAlive) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.interval;
      const minDist = 6;
      // Category P: never behind something the player has not opened yet --
      // see G.spawnPointOpen.
      const usable = world.spawnPoints.filter((sp) => sp.cooldown <= 0 && sp.types[0] !== "boss" && G.spawnPointOpen(world, sp));
      let candidates = usable.filter((sp) => !playerPos || sp.pos.distanceTo(playerPos) >= minDist);
      if (candidates.length === 0) candidates = usable;
      if (candidates.length === 0) return;
      // The school runs 120 units end to end now. Picking uniformly kept
      // spawning zombies ninety units away, where they spent the entire wave
      // walking and never arrived -- so waves stalled and the player stood
      // around waiting. Prefer points near them (never closer than minDist),
      // weighted by inverse distance so the far ones still see some use.
      const NEAR = 48;
      let pool = playerPos ? candidates.filter((c) => c.pos.distanceTo(playerPos) <= NEAR) : candidates;
      if (!pool.length) pool = candidates;
      let sp = pool[pool.length - 1];
      if (playerPos && pool.length > 1) {
        let total = 0;
        const weights = pool.map((c) => { const wgt = 1 / (6 + c.pos.distanceTo(playerPos)); total += wgt; return wgt; });
        let r = G.rng() * total;
        for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { sp = pool[i]; break; } }
      } else sp = G.pick(pool);
      sp.cooldown = 2.5;
      const fastChance = Math.min(0.55, 0.1 + waveDifficulty * 0.08);
      const crawlerChance = Math.min(0.22, 0.05 + waveDifficulty * 0.025);
      let type = "normal";
      if (sp.types.includes("fast") && G.rng() < fastChance) type = "fast";
      else if (G.rng() < crawlerChance) type = "crawler";
      spawnFn(type, sp.pos);
    }
    world.spawnPoints.forEach((sp) => { if (sp.cooldown > 0) sp.cooldown -= dt; });
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
  if (sp.gate === "secret") return !world.secretZone || world.secretZone.unlocked;
  if (sp.gate === "word") return (world.doors || []).every((d) => d.kind !== "word" || d.opened);
  return true;
};

// ---------------- Boss fight ----------------
G.BossFight = {
  active: false,
  zombie: null,
  wordsRemaining: 0,
  totalWords: 5,
  currentWord: null,
  timeLimit: 8,
  timeLeft: 0,
  onDamageStep: null,

  start(zombie, hardWordPairs, onDamageStep) {
    this.active = true;
    this.zombie = zombie;
    this.totalWords = 5;
    this.wordsRemaining = 5;
    this.pool = hardWordPairs.slice();
    this.words = hardWordPairs.slice();
    this.missed = [];
    this.onDamageStep = onDamageStep;
    this.nextWord();
  },
  nextWord() {
    // The fight is won on 5 right answers out of 8 words. Running out of
    // words used to end it quietly with the boss still standing and no way
    // left to hurt it -- the wave could never clear. Missed words come back.
    if (this.pool.length === 0) this.pool = this.missed.length ? this.missed.splice(0) : this.words.slice();
    const idx = Math.floor(G.rng() * this.pool.length);
    this.currentWord = this.pool.splice(idx, 1)[0];
    this.timeLeft = this.timeLimit;
  },
  update(dt) {
    if (!this.active) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.fail();
    }
  },
  answer(correctWordEnglish) {
    if (!this.active) return false;
    const correct = this.currentWord[0] === correctWordEnglish;
    if (correct) {
      this.wordsRemaining--;
      this.onDamageStep && this.onDamageStep(true, this.wordsRemaining);
      if (this.wordsRemaining <= 0) { this.active = false; return true; }
      this.nextWord();
    } else {
      this.fail();
    }
    return correct;
  },
  fail() {
    if (this.currentWord) this.missed.push(this.currentWord);
    this.onDamageStep && this.onDamageStep(false, this.wordsRemaining);
    this.nextWord();
  },
  stop() { this.active = false; this.zombie = null; },
};

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

// labels are "shopItem.<id>" in js/strings.js, set on load by G.localizeData.
// Full Health and Full Ammo are on sale at every shop; the perks rotate
// (G.PERKS and G.PerkBag in js/perks.js); the rest is the armory.
G.SHOP_ITEMS = [
  { id: "heal", base: 120, growth: 1.2, kind: "heal", section: "essential" },
  { id: "ammo_refill", base: 80, growth: 1.15, kind: "refill_ammo", section: "essential" },
  { id: "dmg_up", base: 250, growth: 1.35, kind: "upgrade_damage" },
  { id: "firerate_up", base: 300, growth: 1.35, kind: "upgrade_firerate" },
  { id: "mag_up", base: 220, growth: 1.3, kind: "upgrade_mag" },
  { id: "unlock_shotgun", base: 400, growth: 1, kind: "unlock", weapon: "shotgun", once: true },
  { id: "unlock_smg", base: 900, growth: 1, kind: "unlock", weapon: "smg", once: true },
  { id: "unlock_rifle", base: 1200, growth: 1, kind: "unlock", weapon: "rifle", once: true },
  { id: "crate_common", base: 600, growth: 1.2, kind: "crate" },
];

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
