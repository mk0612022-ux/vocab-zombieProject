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

// G.PERKS -- levels, prices and what each level gives: js/config.js
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
