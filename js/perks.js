// ============================================================
// PERKS: the 20-perk pool offered between waves, and the shuffle bag that
// decides which four are on sale each time
// ------------------------------------------------------------
// Every perk changes how something WORKS rather than nudging one number:
// movement, shooting, survival, money, and five that hang off the word game
// itself. Levels, prices and the numbers each level gives live here; names
// and descriptions are "perk.<id>.name" / "perk.<id>.desc" in js/strings.js,
// filled with the figures from val(). A run's perks sit in player.perks
// ({id: level}) and go with the run, like its money.
//
// The shop always sells Full Health and Full Ammo (G.SHOP_ITEMS); the perks
// rotate: four a wave, drawn from a shuffle bag so every perk turns up once
// before any comes round again, and never the same one two shops running.
// ============================================================
window.G = window.G || {};

// cat: move | shoot | survive | money | vocab. `vals` holds the figures per
// level (index 0 = level 1) that the description and the effect both read.
G.PERKS = [
  // ---- the word game ----
  { id: "perk_hint", icon: "🔤", cat: "vocab", max: 2, base: 300, growth: 1.6, vals: [1, 2] },               // 1: first letter, 2: + letter count
  { id: "focus_time", icon: "⏳", cat: "vocab", max: 2, base: 450, growth: 1.6, vals: [1.5, 2.5] },          // seconds of slowed zombies after a right answer
  { id: "combo_shield", icon: "🛡️", cat: "vocab", max: 1, base: 400, growth: 1, vals: [5] },                 // right answers to recharge
  { id: "word_bounty", icon: "💎", cat: "vocab", max: 2, base: 350, growth: 1.7, vals: [75, 150] },          // % extra money for a hard word
  { id: "extra_time", icon: "⏱️", cat: "vocab", max: 2, base: 300, growth: 1.6, vals: [4, 8] },              // seconds added to word questions
  // ---- movement ----
  { id: "perk_speed", icon: "👟", cat: "move", max: 2, base: 350, growth: 1.5, vals: [15, 30] },             // % move speed
  { id: "second_wind", icon: "💨", cat: "move", max: 1, base: 350, growth: 1, vals: [2] },                   // stamina regen multiplier
  { id: "pack_mule", icon: "🎒", cat: "move", max: 1, base: 400, growth: 1, vals: [50] },                    // % of the weight penalty removed
  { id: "adrenaline", icon: "⚡", cat: "move", max: 1, base: 350, growth: 1, vals: [35] },                   // % speed for 3 s after a kill
  // ---- shooting ----
  { id: "quick_hands", icon: "✋", cat: "shoot", max: 2, base: 400, growth: 1.6, vals: [35, 70] },           // % faster reloads and swaps
  { id: "piercing_rounds", icon: "➶", cat: "shoot", max: 2, base: 500, growth: 1.7, vals: [1, 2] },          // extra zombies a bullet goes through
  { id: "last_round", icon: "🎯", cat: "shoot", max: 2, base: 350, growth: 1.6, vals: [1, 2] },              // last N rounds of a magazine hit 3x
  { id: "marksman", icon: "🔭", cat: "shoot", max: 1, base: 450, growth: 1, vals: [40] },                    // % damage while aiming
  // ---- survival ----
  { id: "bloodthirst", icon: "🩸", cat: "survive", max: 2, base: 400, growth: 1.6, vals: [[10, 30], [20, 60]] }, // HP per kill / per right kill
  { id: "perk_armor", icon: "🦺", cat: "survive", max: 2, base: 400, growth: 1.5, vals: [12, 24] },          // % less damage from bites and traps
  { id: "second_life", icon: "❤️‍🔥", cat: "survive", max: 1, base: 700, growth: 1, vals: [25] },          // % HP a fatal hit leaves you with
  { id: "thorns", icon: "🌵", cat: "survive", max: 2, base: 350, growth: 1.6, vals: [60, 120] },             // damage back to a zombie that bites
  // ---- money and loadout ----
  { id: "extra_slot", icon: "➕", cat: "money", max: 2, base: 900, growth: 1.8, vals: [1, 2] },              // extra gun slots
  { id: "interest", icon: "🏦", cat: "money", max: 2, base: 500, growth: 1.7, vals: [[10, 250], [15, 400]] }, // % of banked money paid at each shop, capped
  { id: "lucky_charm", icon: "🍀", cat: "money", max: 2, base: 600, growth: 1.8, vals: [2, 3] },             // crate rarity rolls, best one kept
];
G.PERK_BY_ID = {};
G.PERKS.forEach((p) => { G.PERK_BY_ID[p.id] = p; });

G.Perks = {
  level(id, player) {
    const p = player || (G.Game && G.Game.player);
    return (p && p.perks && p.perks[id]) || 0;
  },
  has(id, player) { return this.level(id, player) > 0; },
  // the figure a perk gives at the player's level (or at `lvl`), or null
  val(id, lvl) {
    const def = G.PERK_BY_ID[id];
    const l = lvl === undefined ? this.level(id) : lvl;
    return def && l > 0 ? def.vals[Math.min(l, def.max) - 1] : null;
  },
  price(id) {
    const def = G.PERK_BY_ID[id];
    // (round 2: twenty waves earn more, so perks cost more -- G.ECONOMY)
    return G.Shop.priceFor(id, Math.round(def.base * (G.ECONOMY ? G.ECONOMY.perkScale : 1) / 10) * 10, def.growth);
  },
  maxed(id, player) { return this.level(id, player) >= G.PERK_BY_ID[id].max; },
  // What one level of a perk does, for the shop card (the NEXT level) or the
  // pause screen (the level owned).
  describe(id, lvl) {
    lvl = lvl || 1;
    const v = this.val(id, lvl);
    const a = Array.isArray(v) ? v : [v];
    // a perk whose levels read differently has one line per level (".desc2")
    const perLevel = "perk." + id + ".desc" + lvl;
    const key = (G.STRINGS[G.lang] || {})[perLevel] || G.STRINGS.en[perLevel] ? perLevel : "perk." + id + ".desc";
    return G.T(key, { a: a[0], b: a[1] });
  },
  name(id) { return G.T("perk." + id + ".name"); },

  // Owning a perk takes effect straight away; the ones that change a stored
  // stat are applied here, the rest are read where they act.
  apply(id, game) {
    const p = game.player;
    p.perks[id] = (p.perks[id] || 0) + 1;
    if (id === "perk_speed") p.moveSpeedMult = 1 + this.val("perk_speed") / 100;
    if (id === "perk_armor") p.armorPct = this.val("perk_armor") / 100;
    if (id === "combo_shield") p.comboShield = { charged: true, streak: 0 };
    if (id === "second_life") p.secondLifeUsed = false;
  },
};

// ---------------- Shuffle bag ----------------
// Four perks a wave. The bag holds every perk not yet shown in this cycle;
// only when it is empty is it refilled (reshuffled), so all twenty appear
// before any repeats. A perk shown at the last shop is never offered again
// at the next one, even across a refill, and a maxed perk is skipped.
G.PerkBag = {
  bag: [],
  last: [],
  offer: [],
  cycles: 0,            // how many times the bag has been refilled (tests read it)
  OFFER_SIZE: 4,
  reset() { this.bag = []; this.last = []; this.offer = []; this.cycles = 0; },
  draw(player) {
    const out = [], held = [];
    const open = (id) => !G.Perks.maxed(id, player);
    const want = Math.min(this.OFFER_SIZE, G.PERKS.filter((p) => open(p.id)).length);
    let guard = 0;
    while (out.length < want && guard++ < 200) {
      if (!this.bag.length) { this.bag = G.shuffle(G.PERKS.map((p) => p.id)); this.cycles++; }
      const id = this.bag.shift();
      if (!open(id)) continue;                        // maxed: never offered again
      // on sale last time, or already on the table (the tail of the old
      // cycle meeting the head of a new one): kept for the next shop instead
      if (this.last.includes(id) || out.includes(id)) { if (!held.includes(id)) held.push(id); continue; }
      out.push(id);
    }
    // whatever was held back is still owed to this cycle: it goes first next time
    this.bag = held.filter((id) => !out.includes(id)).concat(this.bag.filter((id) => !held.includes(id)));
    // only a handful of perks left unmaxed, all shown last time: allow a repeat
    if (out.length < want) {
      G.PERKS.forEach((p) => { if (out.length < want && open(p.id) && !out.includes(p.id)) out.push(p.id); });
    }
    this.last = out.slice();
    this.offer = out;
    return out;
  },
};
