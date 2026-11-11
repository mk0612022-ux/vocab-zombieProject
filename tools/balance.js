// ===================================================================
// The guns' balance (expansion, round 3)
// -------------------------------------------------------------------
// Reads the guns (G.WEAPON_DEFS, G.GunStats), the zombies (G.ZOMBIE_TYPES)
// and the wave curve (G.CONFIG.zombies.hpByWave) and holds them to the rules
// of G.CONFIG.balance:
//
//   stk-body stk-head stk-mid   shots to put down a Shambler of wave 1, by class
//   budget     sustained DPS and point-buy against the rarity's budget
//   distinct   two guns of a level too alike (six stats, 0-1)
//   niche      none, or one already taken in its (level, rarity)
//
// A flag that stays has its reason in EXPLAINED below: the suite (and so
// every test run) fails on any other. No Node on the machine this was made
// on, so it runs in a browser: tools/balance.html + tools/balance.ps1 write
// docs/expansion/balance-report.md, balance.csv and gun-changelog.md;
// tools/round32-test.js runs it in the game itself.
//
//   const r = G.Balance.run();  r.rows, r.flags, r.unexplained, r.md, r.csv, r.meleeCsv, r.melee, r.changelog
// ===================================================================
window.G = window.G || {};

G.Balance = (function () {
  // ---------------- flags that stay, and why ----------------
  const EXPLAINED = {
    // the 1% jackpot of a crate, and the only gun with the `legendary` flag:
    // kept as it was, on purpose, far over every rule
    golden_smg: {
      "stk-body": "the 1% jackpot: one body shot, on purpose",
      "stk-head": "the 1% jackpot: one body shot, on purpose",
      budget: "the 1% jackpot: kept at its old numbers, the one gun outside the budget",
    },
  };
  const EXPLAINED_PAIRS = {
    // the starting pistol is in every level: the mark the other common pistols are read against
    "pistol|detention_deuce": "the starting pistol, in every level; this one fires two-round bursts",
    "pistol|rebound_pistol": "the starting pistol, in every level; this one reloads in 0.9 s and has 2 rounds more",
    "pistol|syringe_spitter": "the starting pistol, in every level; this one fires twice as fast for less a round",
    "pistol|rebar_repeater": "the starting pistol, in every level; this one fires faster for less a round",
    "pistol|nut_cracker": "the starting pistol, in every level; this one hits harder, slower",
  };

  const C = () => G.CONFIG.balance;
  const GS = () => G.GunStats;
  const guns = () => Object.values(G.WEAPON_DEFS);
  const round = (v, n) => { const k = Math.pow(10, n || 0); return Math.round(v * k) / k; };
  const median = (a) => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

  // ---------------- the zombies, by wave ----------------
  // the curve as the rules plan it, on or not: `on` false reads every wave as the first
  function hpMult(wave, on) {
    const H = G.CONFIG.zombies.hpByWave;
    return on ? 1 + H.perWave * (wave - 1) : 1;
  }

  // ---------------- a shot ----------------
  // what a round does: at `dist` m, in the head or not. pelletShare: the
  // pellets that find the body. A launcher's round also bursts on what it hits.
  function roundDamage(s, dist, head, pelletShare) {
    let d = s.damage * (s.charge ? s.charge.mult : 1);
    if (s.pellets > 1) d *= s.pellets * (pelletShare == null ? 1 : pelletShare);
    const f = s.falloffMin >= 1 || dist <= s.falloffStart ? 1 : dist >= s.falloffEnd ? s.falloffMin : 1 - (1 - s.falloffMin) * (dist - s.falloffStart) / (s.falloffEnd - s.falloffStart);
    d *= f;
    if (head) d *= s.headMult;
    if (s.splash) d *= 1.6;
    return d;
  }
  const shots = (hp, d) => Math.max(1, Math.ceil(hp / d - 1e-9));
  // seconds from the first round to the one that does it
  function ttk(s, n) {
    const iv = s.interval, step = s.charge ? Math.max(iv, s.charge.time) : iv;
    if (s.burst > 1) return Math.floor((n - 1) / s.burst) * step + ((n - 1) % s.burst) * 0.06;
    return (n - 1) * step;
  }

  // ---------------- the sheet of one gun, in numbers ----------------
  function rowOf(def) {
    const s = GS().of(def), Z = G.ZOMBIE_TYPES.normal.hp, B = C(), K = B.classes[s.cls];
    const close = B.closeRange, mid = B.midRange;
    const at = (dist, head, share) => roundDamage(s, dist, head, share);
    const row = {
      id: def.id, name: def.name || def.id, level: def.level, rarity: def.rarity, cls: s.cls, source: s.source, niche: s.niche, fireMode: s.fireMode,
      damage: s.damage, pellets: s.pellets, burst: s.burst, rpm: s.rpm, mag: s.mag, reserve: s.reserve, reload: s.reloadEmpty,
      headMult: s.headMult, fall: s.falloffStart + "-" + s.falloffEnd + "/" + s.falloffMin, pierce: s.pierce,
      weight: s.weight, weightClass: s.weightClass,
      dps: round(GS().dps(s)), sustained: round(GS().sustained(s)),
      stkBody: shots(Z, at(close, false)), stkHead: shots(Z, at(close, true)), stkMid: shots(Z, at(mid, false, B.pelletShare)),
      stats: GS().stats(def),
    };
    row.ttkBody = round(ttk(s, row.stkBody), 2);
    row.byWave = B.waves.map((w) => shots(Z * hpMult(w, true), at(close, false)));
    row.tier3 = shots(Z * hpMult(20, true), at(close, false) * B.tiers[2].dmg);
    row.kinds = {};
    G.ZOMBIE_KINDS.forEach((k) => {
      const hp = G.ZOMBIE_TYPES[k].hp;
      row.kinds[k] = [shots(hp, at(close, false)), shots(hp * hpMult(20, true), at(close, false))];
    });
    row.budget = K.sustained * (B.rarity[def.rarity] || 1);
    return row;
  }

  // ---------------- point-buy ----------------
  function scores(rows) {
    const B = C(), by = {};
    rows.forEach((r) => { (by[r.cls] = by[r.cls] || []).push(r); });
    const med = {};
    Object.keys(by).forEach((c) => {
      med[c] = {};
      ["range", "accuracy", "handling", "mobility"].forEach((k) => { med[c][k] = median(by[c].map((r) => r.stats[k].raw)); });
      med[c].pierce = median(by[c].map((r) => r.pierce >= 99 ? 8 : r.pierce));
    });
    rows.forEach((r) => {
      const m = med[r.cls], P = B.pointBuy;
      let k = 1;
      ["range", "accuracy", "handling", "mobility"].forEach((x) => { k *= Math.pow(r.stats[x].raw / m[x], P[x]); });
      const pierce = r.pierce >= 99 ? 8 : r.pierce;
      k *= 1 + Math.max(0, pierce - m.pierce) * B.pierceValue;
      r.extra = round(k, 3);
      r.score = round((r.sustained / B.classes[r.cls].sustained) * k, 3);
      r.allowed = B.rarity[r.rarity] || 1;
    });
  }

  // ---------------- the flags ----------------
  function vector(r) { return GS().KEYS.map((k) => r.stats[k].pct / 100); }
  function distance(a, b) {
    const x = vector(a), y = vector(b);
    let d = 0;
    x.forEach((v, i) => { d += (v - y[i]) * (v - y[i]); });
    return Math.sqrt(d);
  }
  function check(rows) {
    const B = C(), flags = [];
    const add = (kind, id, text, other) => flags.push({ kind, id, other: other || null, text });
    rows.forEach((r) => {
      const K = B.classes[r.cls];
      if (r.stkBody < K.body[0] || r.stkBody > K.body[1]) add("stk-body", r.id, r.stkBody + " to the body, " + K.body.join("-") + " for a " + r.cls);
      if (r.stkHead < K.head[0] || r.stkHead > K.head[1]) add("stk-head", r.id, r.stkHead + " to the head, " + K.head.join("-") + " for a " + r.cls);
      if (K.mid && (r.stkMid < K.mid[0] || r.stkMid > K.mid[1])) add("stk-mid", r.id, r.stkMid + " at mid range, " + K.mid.join("-") + " for a " + r.cls);
      if (K.pierce && r.pierce < K.pierce) add("stk-body", r.id, "a " + r.cls + " must pierce");
      if (r.score > r.allowed * (1 + B.tolerance)) add("budget", r.id, "score " + r.score + ", " + r.rarity + " allows " + r.allowed);
      if (!r.niche) add("niche", r.id, "no niche tag");
    });
    // a level's guns, the starting pistol in each
    [1, 2, 3].forEach((lv) => {
      const list = rows.filter((r) => r.level === lv || r.level === 0);
      const seen = {};
      list.forEach((r) => {
        const key = r.rarity + "/" + r.niche;
        if (r.niche && seen[key]) add("niche", r.id, "'" + r.niche + "' is taken by " + seen[key] + " in level " + lv + " (" + r.rarity + ")");
        seen[key] = r.id;
      });
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const d = distance(list[i], list[j]);
        if (d < B.distinct) add("distinct", list[i].id, list[j].id + " is " + round(d, 3) + " away in level " + lv, list[j].id);
      }
    });
    return flags;
  }
  function explainOf(f) {
    if (f.kind === "distinct") return EXPLAINED_PAIRS[f.id + "|" + f.other] || EXPLAINED_PAIRS[f.other + "|" + f.id] || "";
    return (EXPLAINED[f.id] && EXPLAINED[f.id][f.kind]) || "";
  }

  // ---------------- the writing ----------------
  const cell = (v) => String(v == null ? "" : v).replace(/\|/g, "/");
  const table = (head, rows) => "| " + head.join(" | ") + " |\n|" + head.map(() => "---").join("|") + "|\n" + rows.map((r) => "| " + r.map(cell).join(" | ") + " |").join("\n") + "\n";
  function report(rows, flags) {
    const B = C(), H = G.CONFIG.zombies.hpByWave;
    const curve = B.waves.map((w) => "x" + round(hpMult(w, true), 2)).join(" ");
    let o = "# Balance report\n\nMade by tools/balance.ps1 from the game's own data: do not edit by hand.\n\n";
    o += "Zombie health by wave (G.CONFIG.zombies.hpByWave): perWave " + H.perWave + ", " + (H.on ? "ON" : "OFF in the game for now: every wave plays as wave 1") + ". Waves " + B.waves.join("/") + " read " + curve + ".\n";
    o += "The columns w1-w20 are the planned curve. T3 w20: a Tier III gun (x" + B.tiers[2].dmg + ") at wave 20, to set beside w5.\n\n";
    const hold = flags.filter((f) => f.why), open = flags.filter((f) => !f.why);
    o += "## Flags\n\n" + (flags.length ? "" : "None.\n\n");
    if (open.length) o += "### Not explained: " + open.length + "\n\n" + table(["kind", "gun", "what"], open.map((f) => [f.kind, f.id, f.text])) + "\n";
    if (hold.length) o += "### Explained: " + hold.length + "\n\n" + table(["kind", "gun", "what", "why"], hold.map((f) => [f.kind, f.id, f.text, f.why])) + "\n";
    o += "## Classes\n\n" + table(["class", "guns", "body", "head", "sustained x1.00", "head x", "falloff (m)"],
      Object.keys(B.classes).map((c) => { const K = B.classes[c]; return [c, rows.filter((r) => r.cls === c).length, K.body.join("-") + (K.mid ? " (mid " + K.mid.join("-") + ")" : ""), K.head.join("-"), K.sustained, K.headMult, K.fall.join("-")]; }));
    Object.keys(B.classes).forEach((c) => {
      const list = rows.filter((r) => r.cls === c).sort((a, b) => a.allowed - b.allowed || a.sustained - b.sustained);
      if (!list.length) return;
      o += "\n## " + c + "\n\n" + table(["gun", "lv", "rarity", "niche", "dmg", "rpm", "mag", "rl s", "DPS", "sust.", "score", "allowed", "body", "head", "TTK s", "w1", "w5", "w10", "w15", "w20", "T3 w20"],
        list.map((r) => [r.id, r.level, r.rarity, r.niche, r.damage + (r.pellets > 1 ? "x" + r.pellets : "") + (r.burst > 1 ? " b" + r.burst : ""), r.rpm, r.mag, r.reload, r.dps, r.sustained, r.score, r.allowed, r.stkBody, r.stkHead, r.ttkBody].concat(r.byWave, [r.tier3])));
    });
    return o + bossTable(rows) + meleeTable() + attachTable();
  }
  // ---------------- attachments (round 5) ----------------
  // Everything above is the guns as they come (the player's own choices are
  // left out: run() turns them off while it counts). Here each attachment on
  // the middle gun (by sustained DPS) of each family it fits: what it gives,
  // what it costs -- a sidegrade has at least one of each.
  const ATT_BETTER = { zoom: (v) => v > 1, ads: (v) => v < 1, sway: (v) => v < 1, range: (v) => v > 1, recoilV: (v) => v < 1, recoilH: (v) => v < 1, mag: (v) => v > 1, reload: (v) => v < 1, hip: (v) => v < 1, flash: (v) => v < 1 };
  function attSides(a) {
    let b = 0, w = 0;
    Object.keys(ATT_BETTER).forEach((k) => { if (a[k] != null && a[k] !== 1) { if (ATT_BETTER[k](a[k])) b++; else w++; } });
    if (a.sound === "suppressed") b++;
    if (a.loud > 0) w++;
    if (a.laser) b++;
    return { b, w };
  }
  function attachTable() {
    if (!G.ATTACHMENTS || !G.Attach) return "";
    const AT = G.ATTACHMENTS, keys = Object.keys(ATT_BETTER);
    const fx = (a) => keys.filter((k) => a[k] != null).map((k) => k + " x" + a[k]).concat(a.loud ? ["+" + a.loud + " dB"] : [], a.sound ? [a.sound] : [], a.laser ? ["laser dot"] : []).join(", ");
    const by = (id) => { const u = G.ATTACH_UNLOCKS.find((x) => x.id === id); return u ? u.kind + " " + (u.n != null ? u.n : u.share != null ? u.share : u.level) : "free"; };
    const list = table(["attachment", "slot", "effects", "unlocked by", "sidegrade"], Object.keys(AT).map((id) => {
      const s = attSides(AT[id]);
      return [id, AT[id].slot, fx(AT[id]), by(id), s.b && s.w ? "yes" : id === "laser" ? "hip only (nothing aimed)" : "NO"];
    }));
    const pct = (a, b) => (!b || Math.abs(a / b - 1) < 1e-9 ? "=" : (a > b ? "+" : "") + Math.round((a / b - 1) * 100) + "%");
    const rows = [];
    Object.keys(G.ATTACH_FAMILIES).forEach((f) => {
      const all = guns().filter((d) => G.ViewModel.family(d) === f);
      if (!all.length) return;
      const mid = all.slice().sort((a, b) => GS().sustained(GS().of(a)) - GS().sustained(GS().of(b)))[Math.floor(all.length / 2)];
      const s = GS().of(mid), base = GS().sustained(s);
      G.ATTACH_SLOTS.forEach((slot) => G.Attach.allowed(mid, slot).forEach((id) => {
        const M = G.Attach.combine([id]);
        const sus = GS().sustained(Object.assign({}, s, { mag: Math.max(1, Math.round(s.mag * M.mag)), reloadEmpty: s.reloadEmpty * M.reload }));
        rows.push([f, mid.id, id, pct(sus, base), Math.max(1, Math.round(s.mag * M.mag)) + " / " + round(s.reloadEmpty * M.reload, 2) + " s", pct(s.adsTime * M.ads, s.adsTime), pct(M.sway, 1),
          pct(s.hipSpread * M.hip, s.hipSpread), pct(M.recoilV, 1) + " / " + pct(M.recoilH, 1), pct(s.falloffEnd * M.range, s.falloffEnd), M.optic ? "x" + AT[id].zoom : "", M.loud ? "+" + M.loud + " dB" : M.sound || "", M.flash === 0 ? "none" : pct(M.flash, 1)]);
      }));
    });
    const open = Object.keys(AT).filter((id) => { const s = attSides(AT[id]); return !(s.b && s.w) && id !== "laser"; });
    return "\n## Attachments\n\nG.ATTACHMENTS (js/data/attachments.js). The tables above are the guns as they come; a player's attachments are on top of them. Not a sidegrade: "
      + (open.length ? open.join(", ") : "none") + ".\n\n" + list
      + "\nEach on the middle gun of each family it fits (the reserve carries as many rounds in all; a 2x-8x scope and a red dot change the aimed zoom):\n\n"
      + table(["family", "gun", "attachment", "sustained", "mag / reload", "aim time", "drift", "hip spread", "kick up / side", "range", "zoom", "sound", "flash"], rows);
  }
  // how long a boss lasts, by what the middle gun of a rarity does: boss health
  // (G.CONFIG.boss.hpByWave) was sized for a fight of the wanted length
  function bossTable(rows) {
    const B = C().bossCheck, H = G.CONFIG.boss.hpByWave, R = G.RARITY_ORDER;
    const fights = (of) => {
      const mid = {};
      R.forEach((r) => { mid[r] = median(rows.filter((x) => x.rarity === r && x.id !== "golden_smg").map(of)); });
      return Object.keys(H).map(Number).map((w) => {
        const dps = (r) => mid[r] * Math.pow(1.15, B.upgrades[w]) * B.hitShare;
        return ["wave " + w, H[w], B.upgrades[w], B.target[w].join("-")].concat(R.map((r) => round(H[w] / dps(r))));
      });
    };
    // the same guns before this sheet: the numbers kept in def.orig
    const before = (x) => {
      const d = G.WEAPON_DEFS[x.id], o = d.orig;
      return GS().sustained(Object.assign({}, GS().of(d), { damage: o.damage, pellets: o.pellets || 1, mag: o.magSize, interval: o.fireRate / 1000, reloadEmpty: o.reloadTime / 1000 }));
    };
    const head = ["boss", "health", "upgrades", "wanted (s)"].concat(R);
    return "\n## Boss fights\n\nSeconds to bring a boss of level 1 down: the middle gun of a rarity, " + B.hitShare * 100 + "% of its shots landing, with that many Damage upgrades.\n\n"
      + table(head, fights((x) => x.sustained)) + "\n\nThe same fights with the old numbers (before the sheet):\n\n" + table(head, fights(before));
  }
  // ---------------- the melee slot (round 4) ----------------
  // each weapon's numbers, and the blows a kind of zombie takes (to the body, at full stamina)
  function meleeRows() {
    const I = G.CONFIG.zombies.ironclad;
    return Object.values(G.MELEE_WEAPONS).map((m) => {
      const s = GS().melee(m), kinds = {};
      G.ZOMBIE_KINDS.forEach((k) => {
        let d = m.damage;
        if (m.unarmored && k !== "ironclad") d *= m.unarmored;
        if (m.lowDamage && (k === "crawler" || k === "runt")) d *= m.lowDamage;
        if (k === "ironclad") d *= I.vest + (1 - I.vest) * (m.armor || 0);
        kinds[k] = Math.ceil(G.ZOMBIE_TYPES[k].hp / d);
      });
      return Object.assign(s, { kinds, ttk: round(((kinds.normal - 1) * s.swing + s.windup + s.active) / 1000, 2), dps: round(s.dps) });
    });
  }
  function meleeTable() {
    const rows = meleeRows();
    return "\n## Melee\n\nG.MELEE_WEAPONS and G.CONFIG.melee. Times in ms: wind-up / edge moving / back to ready. Blows: to the body, at full stamina.\n\n"
      + table(["weapon", "lv", "price", "move", "times", "swing", "reach m", "targets", "stagger", "stamina", "dmg", "head x", "charged", "DPS", "TTK s"].concat(G.ZOMBIE_KINDS),
        rows.map((s) => [s.key, s.level, s.price, s.move, s.windup + "/" + s.active + "/" + s.recover, s.swing, s.range, s.targets, s.stagger, s.stamina, s.damage, s.head, s.charged ? round(s.charged) : "-", s.dps, s.ttk].concat(G.ZOMBIE_KINDS.map((k) => s.kinds[k]))));
  }
  function meleeCsv() {
    const rows = meleeRows();
    const head = ["key", "level", "price", "move", "windup_ms", "active_ms", "recover_ms", "swing_ms", "reach_m", "arc_deg", "targets", "stagger", "stamina", "damage", "head", "charged", "dps", "ttk_s"].concat(G.ZOMBIE_KINDS.map((k) => "blows_" + k));
    return head.join(",") + "\n" + rows.map((s) => [s.key, s.level, s.price, s.move, s.windup, s.active, s.recover, s.swing, s.range, s.arc, s.targets, s.stagger, s.stamina, s.damage, s.head, s.charged ? round(s.charged) : "", s.dps, s.ttk].concat(G.ZOMBIE_KINDS.map((k) => s.kinds[k])).join(",")).join("\n") + "\n";
  }
  function csv(rows) {
    const B = C();
    const head = ["id", "level", "rarity", "class", "source", "niche", "fireMode", "damage", "pellets", "burst", "rpm", "mag", "reserve", "reload_s", "headMult", "falloff", "pierce", "weight", "weightClass", "dps", "sustained", "score", "allowed", "stk_body", "stk_head", "stk_mid", "ttk_body_s"]
      .concat(B.waves.map((w) => "stk_w" + w), ["stk_w20_tier3"], G.ZOMBIE_KINDS.reduce((a, k) => a.concat("stk_" + k + "_w1", "stk_" + k + "_w20"), []), G.GunStats.KEYS.map((k) => "bar_" + k));
    const q = (v) => (/[",]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
    return head.join(",") + "\n" + rows.map((r) => [r.id, r.level, r.rarity, r.cls, r.source, r.niche, r.fireMode, r.damage, r.pellets, r.burst, r.rpm, r.mag, r.reserve, r.reload, r.headMult, r.fall, r.pierce, r.weight, r.weightClass, r.dps, r.sustained, r.score, r.allowed, r.stkBody, r.stkHead, r.stkMid, r.ttkBody]
      .concat(r.byWave, [r.tier3], G.ZOMBIE_KINDS.reduce((a, k) => a.concat(r.kinds[k]), []), G.GunStats.KEYS.map((k) => r.stats[k].pct)).map(q).join(",")).join("\n") + "\n";
  }
  function changelog() {
    const rows = [];
    guns().forEach((d) => {
      GS().TUNED.forEach((k) => {
        const a = d.orig ? d.orig[k] : d[k], own = G.GUN_SHEET[d.id] || {}, b = own[k];
        if (b !== undefined && a !== b) rows.push([d.id, d.rarity, k, a == null ? "-" : a, b]);
      });
    });
    return "# Gun changelog\n\nMade by tools/balance.ps1 from js/data/gunstats.js: do not edit by hand. Old: js/config.js, new: the sheet. `G.CONFIG.expansion.gunStats = false` brings the old ones back. Names, colours and sounds did not change.\n\n"
      + rows.length + " values changed, on " + new Set(rows.map((r) => r[0])).size + " of " + guns().length + " guns.\n\n" + table(["gun", "rarity", "field", "old", "new"], rows)
      + "\n## What changed for every gun\n\nBefore: one spread for all but shotguns (0.004), a head hit x2, no falloff, a bloom of none, four magazines. Now by class (a gun's niche leans on these: G.CONFIG.balance.niches).\n\n"
      + table(["class", "head x", "spread hip / aimed", "falloff: full to, gone by (m), least", "bloom: a shot, most"], Object.keys(C().classes).map((c) => {
        const K = C().classes[c];
        return [c, K.headMult, c === "shotgun" ? "its own spread / x0.8" : K.hip + " / " + K.ads, K.fall[2] >= 1 ? "none" : K.fall[0] + ", " + K.fall[1] + ", x" + K.fall[2], K.bloom[0] + ", " + K.bloom[1]];
      }));
  }

  function run() {
    // (round 5: the guns as they come -- the player's attachments off while counting)
    const keep = G.CONFIG.expansion.attachments, off = !!G.Attach && keep !== false;
    if (off) { G.CONFIG.expansion.attachments = false; G.Attach.apply(); }
    try {
      const rows = guns().map(rowOf);
      scores(rows);
      const flags = check(rows);
      flags.forEach((f) => { f.why = explainOf(f); });
      return { rows, flags, unexplained: flags.filter((f) => !f.why), md: report(rows, flags), csv: csv(rows), meleeCsv: meleeCsv(), melee: meleeRows(), changelog: changelog() };
    } finally {
      if (off) { G.CONFIG.expansion.attachments = keep; G.Attach.apply(); }
    }
  }
  return { run, rowOf, EXPLAINED, EXPLAINED_PAIRS, distance, roundDamage };
})();
