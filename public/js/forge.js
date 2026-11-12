// ===================================================================
// The Word Forge (expansion, round 6)
// -------------------------------------------------------------------
// One station a level, in a room easy to remember and close to where a run
// starts: the school's science room (E2), the hospital's operating theatre
// (W2), the bunker's armoury (W2). An anvil on a stone block, a furnace with a
// glowing mouth, glowing seams and an amber light over it -- seen from the
// door -- and a low hum, heard within a few metres.
//
// E (a tap, the controller's A) at it opens its window: a gun carried, its
// tier (Mk I-III), what the next costs -- money, by the tier and the gun's
// rarity, and a test on words the player has met (js/forgepick.js; the rules
// G.CONFIG.forge.quiz: I four questions, three right; II five, four right,
// one of them written; III five, all right, two written, no hints) -- and the
// gun's Stat Card as it would be. Its attachments can be changed here too
// (js/attachments.js: in a run, at the shop or the Word Forge).
// The money goes as the test starts. Failed: half of it comes back, and that
// gun waits for the wave to end before another try (no guessing at random
// again and again). Passed: the gun goes up -- its damage x the sheet's tier
// (G.CONFIG.balance.tiers, on top of the shop's upgrades), at Tier III its
// niche's extra (pierce, magazine, head hits; G.CONFIG.forge.perks) -- a
// short scene (js/forgescene.js), and the gun in hand wears its tier's band,
// glow and plate, and sounds heavier (js/gunaudio.js). Every answer is a
// review by the SRS's own rules (the test is the quiz window, js/quiz.js).
// A tier is the run's: Game Over takes it with the guns, a gun dropped and
// picked up keeps it (its levels go with it), and the checkpoint after wave
// 10 keeps it with the guns -- the waits and the words already asked too.
//
//   G.Forge.mount(world, scene, spec, kit)  the station, in a room (js/world.js)
//   G.Forge.open(game, id) / begin(game, id)  its window / a try
//   G.Forge.canTry(game, id)                { ok, why, need, price }
//   G.Forge.tierOf(id) / labelOf(tier)      a gun's tier this run / "Mk II"
//   G.Forge.priceOf(def, tier) / perkOf(def) / setTier(game, id, tier)
//   G.Forge.pick(game, n)                   the words a try would ask
//   G.Forge.state() / restore(game, st)     the checkpoint's part
//   G.Forge.update(game, dt)                its hum, its light, the scene
// Off (G.CONFIG.expansion.forge = false): no station, no row in the shop, and
// no gun is forged.
// ===================================================================
window.G = window.G || {};

G.Forge = (function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const C = () => G.CONFIG.forge;
  const on = () => !(G.CONFIG.expansion && G.CONFIG.expansion.forge === false);
  const ROMAN = ["I", "II", "III"];
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  // the run's: when each gun may try again (the wave its wait ends with), the
  // words the run's tries have asked (keys), how many tries
  let run = { cooldown: {}, used: [], tries: 0 };
  let last = null;                                   // the last try (the tests, the bug report)

  // ---------------- a gun's tier ----------------
  const lvlOf = (game, id) => (game && game.player && game.player.weaponLevels ? game.player.weaponLevels[id] : null);
  function tierOf(id, game) { const l = lvlOf(game || G.Game, id); return Math.max(0, Math.min(3, (l && l.tier) | 0)); }
  // ...only while a run is on (the Armory's Listen, between runs, plays the gun as it comes)
  function inRunTier(id) { const g = G.Game; return on() && g && (g.state === "GAMEPLAY" || g.state === "PAUSE" || g.state === "SHOP") ? tierOf(id, g) : 0; }
  function labelOf(t) { return t > 0 ? T("forge.mk", { n: ROMAN[t - 1] }) : ""; }
  const dmgOf = (t) => (t > 0 ? G.CONFIG.balance.tiers[t - 1].dmg : 1);
  function priceOf(def, t) { const P = C().price; return Math.round((P.base[t - 1] * (P.rarity[def.rarity] || 1)) / 50) * 50; }
  function perkOf(def) { const s = G.GunStats.of(def); return (s && C().perks[s.niche]) || C().perks.default; }
  const perkKind = (p) => (p.pierce ? "pierce" : p.head ? "head" : "mag");
  // a gun to tier t: its damage x the tier's (the shop's upgrades stay -- the
  // two multiply), Tier III its niche's extra (taken back if it comes down:
  // the tests only, a tier never falls in play)
  function setTier(game, id, t) {
    const l = lvlOf(game, id), def = G.WEAPON_DEFS[id];
    if (!l || !def) return;
    const from = Math.max(0, Math.min(3, l.tier | 0));
    t = Math.max(0, Math.min(3, t | 0));
    l.dmg = (l.dmg || 1) * dmgOf(t) / dmgOf(from);
    const p = perkOf(def);
    if (t >= 3 && from < 3) {
      if (p.mag) l.mag = (l.mag || 1) * p.mag;
      if (p.pierce) l.pierce = (l.pierce || 0) + p.pierce;
      if (p.head) l.head = (l.head || 1) * p.head;
    } else if (t < 3 && from >= 3) {
      if (p.mag) l.mag = (l.mag || 1) / p.mag;
      if (p.pierce) l.pierce = Math.max(0, (l.pierce || 0) - p.pierce);
      if (p.head) l.head = (l.head || 1) / p.head;
    }
    l.tier = t;
  }
  // what a forged gun does more, as it shoots (js/game.js)
  function pierceOf(def, lvl) {
    const extra = (lvl && lvl.pierce) | 0;
    if (!extra) return def.pierce;
    return def.pierce === true ? true : (typeof def.pierce === "number" ? def.pierce : 1) + extra;
  }
  const headOf = (lvl) => (lvl && lvl.head) || 1;

  // ---------------- the words of a try ----------------
  function rankCtx(game) {
    const L = G.save.learn, today = G.Clock.today(), since = today - C().recentDays;
    const wrongRun = (game && game.wrongWordsThisRun) || {};
    const conf = (L && L.conf) || {};
    // the words the player takes others for (X), as well as the ones they miss (Y)
    const taken = {};
    Object.keys(conf).forEach((y) => Object.keys(conf[y]).forEach((x) => { const c = conf[y][x]; if (c && !c.off) taken[x] = (taken[x] || 0) + c.n; }));
    const entry = (p) => (G.Clues ? G.Clues.info(p) : null);
    return {
      pool: G.SRS.pool(),
      key: (p) => G.wordKey(p),
      state: (p) => G.SRS.state(p),
      today,
      confused: (p) => {
        const k = G.wordKey(p), row = conf[k];
        let n = 0;
        if (row) Object.keys(row).forEach((x) => { if (!row[x].off) n += row[x].n * 2; });
        return n + (taken[k] || 0);
      },
      wrongLately: (p) => {
        const w = wrongRun[String(p[0]).toLowerCase()] || wrongRun[p[0]];
        const why = (L && L.why && L.why[G.wordKey(p)]) || [];
        return (w ? w.count || 1 : 0) + why.filter((h) => h.d >= since).length;
      },
      level: game && game.level ? game.level.id : null,
      levelOf: (p) => { const e = entry(p); return e ? e.level : null; },
      // the user's choice (2026-11-12): the AWL sublist stands in for CEFR; a
      // word without one (a topic word, a player's own) by this player's mistakes
      difficulty: (p) => {
        const e = entry(p);
        if (e && e.source === "AWL" && e.awlSublist) return (e.awlSublist - 1) / 9;
        const st = G.wordStat(p) || { correct: 0, wrong: 0 }, s = G.SRS.state(p);
        const wrong = (st.wrong || 0) + ((s && s.lapses) || 0);
        return Math.min(1, wrong / ((st.correct || 0) + (st.wrong || 0) + 2));
      },
      used: new Set(run.used),
      rng: G.rng,
    };
  }
  function pick(game, n) { return G.ForgePick.pick(rankCtx(game), n); }
  function typeCtx() {
    return {
      can: (k, p) => G.Questions.can(k, p),
      box: (p) => G.SRS.box(p),
      pickType: (p, prev) => G.Questions.pickType(p, prev),
      recall: G.Questions.RECALL,
      written: ["spell", "dictation", "defspell", "clozespell"],
    };
  }

  // ---------------- may this gun try? ----------------
  const coolingDown = (id) => run.cooldown[id] != null;
  function canTry(game, id) {
    if (!on()) return { ok: false, why: "off" };
    const def = G.WEAPON_DEFS[id], pl = game && game.player;
    if (!def || !pl || id === "melee" || !pl.gunSlots.includes(id)) return { ok: false, why: "gun" };
    const t = tierOf(id, game);
    if (t >= 3) return { ok: false, why: "max" };
    if (C().onlyBetweenWaves && game.state !== "SHOP") return { ok: false, why: "waves" };
    if (coolingDown(id)) return { ok: false, why: "cooldown" };
    const price = priceOf(def, t + 1);
    if (pl.money < price) return { ok: false, why: "money", need: price - pl.money, price };
    const W = pick(game, C().quiz[t].n);
    if (W.short) return { ok: false, why: "words", need: W.short, price };
    return { ok: true, price };
  }

  // ---------------- a try ----------------
  function begin(game, id) {
    const chk = canTry(game, id);
    if (!chk.ok) return false;
    const def = G.WEAPON_DEFS[id], t = tierOf(id, game) + 1, rule = C().quiz[t - 1], price = chk.price;
    const W = pick(game, rule.n);
    if (W.short) return false;
    const kinds = G.ForgePick.types(W.words, rule, typeCtx());
    const pool = game.wordPool && game.wordPool.length >= 4 ? game.wordPool : G.getAllBuiltinWords();
    G.Questions._fi = 0;
    const qs = W.words.map((p, i) => G.Questions.build(p, kinds[i], pool));
    game.player.money -= price;
    run.tries++;
    W.words.forEach((p) => { const k = G.wordKey(p); if (!run.used.includes(k)) run.used.push(k); });
    if (run.used.length > 400) run.used.splice(0, run.used.length - 400);
    const back = Math.round(price * C().failKeep);
    last = { id, tier: t, price, back, wave: game.wave, words: W.words.map((p) => p[0]), keys: W.words.map((p) => G.wordKey(p)), kinds: qs.map((q) => q.type), from: W.from, reused: W.reused, passed: null };
    G.Bus.emit("forge:try", { id, tier: t, price });
    G.Quiz.open(game, (passed) => finish(game, id, t, passed), {
      qs, seconds: C().seconds, maxMistakes: rule.n - rule.pass, noHint: !rule.hints, log: last,
      kicker: T("forge.kicker", { name: def.name, mk: labelOf(t) }),
      verdict: { passed: "forge.passed", failed: "forge.failed", passedSub: "forge.passedSub", failedSub: "forge.failedSub", vars: { name: def.name, mk: labelOf(t), lost: money(price - back), back: money(back) } },
      summary: (Q) => T("forge.summary", { n: qs.length, m: Q.correct }),
      reviewTitle: "forge.revisit",
    });
    return true;
  }
  function finish(game, id, t, passed) {
    if (!last) return;
    last.passed = !!passed;
    if (!game.player || !game.player.weaponLevels[id]) return;
    if (passed) {
      setTier(game, id, t);
      G.Bus.emit("forge:upgrade", { id, tier: t, perk: t >= 3 ? perkKind(perkOf(G.WEAPON_DEFS[id])) : null });
      const W = game.world && game.world.forge;
      // (from the shop -- between waves only -- there is no anvil in view: a banner)
      if (W && game.state === "GAMEPLAY" && G.ForgeScene) G.ForgeScene.play(game, W, id, t, () => refit(game, id));
      else { refit(game, id); G.Audio.sfx("unlock"); G.UI.flashPurchaseBanner(T("forge.bannerUp", { name: G.WEAPON_DEFS[id].name, mk: labelOf(t) }), T("forge.bannerUpText")); }
    } else {
      game.player.money += last.back;
      // the wait: to the end of this wave (from the shop: of the next one)
      run.cooldown[id] = game.state === "SHOP" ? game.wave + 1 : game.wave;
      G.Bus.emit("forge:fail", { id, tier: t });
    }
    if (game.state === "SHOP" && G.UI.renderShop) G.UI.renderShop();
  }
  // the gun in hand, if it is this one, as it looks now
  function refit(game, id) { if (game.currentWeaponId && game.currentWeaponId() === id && game.buildWeaponViewModel) game.buildWeaponViewModel(id); }

  // ---------------- its window ----------------
  function why(chk) {
    switch (chk.why) {
      case "max": return T("forge.whyMax");
      case "waves": return T("forge.whyWaves");
      case "cooldown": return T("forge.whyWait");
      case "money": return T("forge.whyMoney", { n: money(chk.need) });
      case "words": return T("forge.whyWords", { n: chk.need });
      default: return "";
    }
  }
  function rulesText(t) {
    const r = C().quiz[t - 1];
    return T(r.recall ? (r.hints ? "forge.rule" : "forge.ruleNoHints") : "forge.ruleChoice", { n: r.n, pass: r.pass, w: r.recall });
  }
  function perkText(def) { const p = perkOf(def); return T("forge.perk." + perkKind(p), { n: p.pierce || Math.round(((p.head || p.mag) - 1) * 100) }); }
  function infoHtml(game, id) {
    const def = G.WEAPON_DEFS[id], l = lvlOf(game, id) || { dmg: 1, rate: 1, mag: 1 }, t = tierOf(id, game);
    const now = t ? T("forge.now", { mk: labelOf(t), x: dmgOf(t) }) : T("forge.nowNone");
    if (t >= 3) return `<div class="forge-line">${esc(now)}</div><div class="forge-line forge-max">${esc(T("forge.whyMax"))}</div><div class="forge-card">${G.StatCard.html(def, { lvl: l })}</div>`;
    const n = t + 1, chk = canTry(game, id);
    const next = Object.assign({}, l, { dmg: (l.dmg || 1) * dmgOf(n) / dmgOf(t), tier: n });
    if (n === 3) { const p = perkOf(def); if (p.mag) next.mag = (l.mag || 1) * p.mag; if (p.head) next.head = (l.head || 1) * p.head; if (p.pierce) next.pierce = (l.pierce || 0) + p.pierce; }
    return `<div class="forge-line">${esc(now)}</div>`
      + `<div class="forge-line forge-next">${esc(T("forge.next", { mk: labelOf(n), x: dmgOf(n), pct: Math.round((dmgOf(n) / dmgOf(t) - 1) * 100) }))}${n === 3 ? `<br>${esc(perkText(def))}` : ""}</div>`
      + `<div class="forge-line">${esc(T("forge.cost", { price: money(priceOf(def, n)) }))} · ${esc(rulesText(n))}</div>`
      + `<div class="forge-line forge-fine">${esc(T("forge.fail", { back: Math.round(C().failKeep * 100) }))}</div>`
      + (chk.ok ? "" : `<div class="forge-line forge-why" role="status">${esc(why(chk))}</div>`)
      + `<div class="forge-card">${G.StatCard.html(def, { lvl: next, from: l })}</div>`;
  }
  function open(game, id) {
    if (!on() || !game || !game.player || !G.Dialog) return;
    const guns = game.player.gunSlots.filter((g) => G.WEAPON_DEFS[g]);
    if (!guns.length) return;
    const held = game.currentWeaponId ? game.currentWeaponId() : null;
    let sel = guns.includes(id) ? id : guns.includes(held) ? held : guns[0];
    const opts = guns.map((g) => `<option value="${esc(g)}"${g === sel ? " selected" : ""}>${esc(G.WEAPON_DEFS[g].name)}${tierOf(g, game) ? " · " + esc(labelOf(tierOf(g, game))) : ""}</option>`).join("");
    const body = `<div class="forge-win"><div class="forge-money">${esc(T("forge.money", { n: money(game.player.money) }))}</div>`
      + `<div class="att-row"><label for="forge-gun">${esc(T("forge.gun"))}</label><select id="forge-gun">${opts}</select></div>`
      + `<div id="forge-info">${infoHtml(game, sel)}</div></div>`;
    const startLabel = (g) => { const t = tierOf(g, game); return t >= 3 ? T("forge.done") : T("forge.start", { mk: labelOf(t + 1), price: money(priceOf(G.WEAPON_DEFS[g], t + 1)) }); };
    G.Dialog.open({
      title: T("forge.title"), icon: "⚒", body, focus: "forge-gun",
      buttons: [
        { label: startLabel(sel), primary: true, disabled: !canTry(game, sel).ok, action: () => begin(game, sel) },
        { label: T("forge.attach"), disabled: !(G.Attach && G.Attach.on() && G.WEAPON_DEFS[sel]), action: () => G.Attach.openEditor(G.WEAPON_DEFS[sel], () => open(game, sel), { forge: true }) },
        { label: T("common.close"), cancel: true },
      ],
    });
    const box = document.getElementById("dialog-body"), s = box && box.querySelector("#forge-gun");
    if (!s) return;
    s.onchange = () => {
      sel = s.value;
      document.getElementById("forge-info").innerHTML = infoHtml(game, sel);
      const b = document.querySelector('#dialog-btns [data-i="0"]');
      if (b) { b.disabled = !canTry(game, sel).ok; if (b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = startLabel(sel); }
    };
  }

  // ---------------- the station ----------------
  // In the room `spec`, against its outer wall, clear of its doors, its
  // furniture and the wall gun if it has one; its front to the room
  function mount(world, scene, spec, kit) {
    if (!on() || !spec || !spec.room) return null;
    const r = spec.room, y = spec.baseY || 0, outer = r.cx < 0 ? -1 : 1;
    const gunZ = spec.gun ? r.cz + (spec.gunOffZ || 0) : null;
    const nearZ = gunZ == null ? r.cz - r.d * 0.25 : gunZ + (gunZ > r.cz ? -1 : 1) * r.d * 0.3;
    const near = { x: r.cx + outer * (r.w / 2 - 1.6), z: nearZ };
    // (its footprint turned to the wall: about 0.8 m across x, 2.1 m along z)
    const fs = kit.freeSpot ? kit.freeSpot(spec, 1.2, 2.6, near, 1.9) : null, spot = fs || near;
    const x = spot.x, z = spot.z;
    // its front faces the corridor side (the way in); local +z = its front
    const ry = outer < 0 ? Math.PI / 2 : -Math.PI / 2;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const at = (lx, lz) => ({ x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs });
    const S = C().station, M = (hex) => new THREE.MeshLambertMaterial({ color: hex });
    const solid = (lx, ly, lz, w, h, d, hex) => { const p = at(lx, lz); return kit.addSolid(p.x, y + ly, p.z, w, h, d, M(hex), 0, ry); };
    const deco = (lx, ly, lz, w, h, d, hex) => { const p = at(lx, lz); return kit.addFloatBox(p.x, y + ly, p.z, w, h, d, M(hex), ry); };
    const glow = (lx, ly, lz, w, h, d, hex) => { const p = at(lx, lz); return kit.addGlowBox(p.x, y + ly, p.z, w, h, d, hex, ry); };
    // the block, the anvil on it (waist, face, horn, heel), a hammer resting on it
    solid(0, 0, 0, 1.3, 0.5, 0.75, 0x2b2826);
    deco(0, 0.58, 0, 0.36, 0.16, 0.3, 0x30343a);
    deco(0, 0.75, 0, 0.92, 0.18, 0.38, 0x3d4248);
    deco(0, 0.845, 0, 0.88, 0.012, 0.34, 0x6b7178);
    deco(0.58, 0.77, 0, 0.26, 0.12, 0.18, 0x3d4248);
    deco(0.74, 0.78, 0, 0.12, 0.08, 0.1, 0x3d4248);
    deco(-0.52, 0.75, 0, 0.12, 0.16, 0.3, 0x353a40);
    deco(0.12, 0.875, 0.06, 0.38, 0.034, 0.034, 0x6b4a2b);
    deco(0.32, 0.89, 0.06, 0.09, 0.08, 0.15, 0x585e66);
    // the furnace beside it, its mouth aglow, its flue
    solid(-0.98, 0, -0.08, 0.56, 0.86, 0.6, 0x1d1a17);
    glow(-0.98, 0.36, 0.225, 0.34, 0.16, 0.02, 0xff7a1a);
    glow(-0.98, 0.3, 0.226, 0.22, 0.05, 0.02, 0xffd27a);
    deco(-0.98, 1.17, -0.14, 0.2, 0.62, 0.2, 0x26221e);
    // glowing seams round the block's top, and a strip of letters on its front
    glow(0, 0.5, 0.378, 1.3, 0.024, 0.012, S.color);
    glow(0, 0.5, -0.378, 1.3, 0.024, 0.012, S.color);
    glow(0.652, 0.5, 0, 0.012, 0.024, 0.75, S.color);
    glow(-0.652, 0.5, 0, 0.012, 0.024, 0.75, S.color);
    // ...and a sign over it: the anvil and hammer, its name in the game's
    // language. Both printed on one canvas (the sign its top half, the strip
    // its bottom), on boards of plain colour: the level's merge makes the two
    // faces one draw call and the boards none (two canvas boxes cost four)
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#120d09"; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = "#ff8a2a"; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 244, 116);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffb15c";
    ctx.font = "48px sans-serif"; ctx.fillText("⚒", 128, 40);
    G.fitFont(ctx, T("forge.title"), 34, 226); ctx.fillText(T("forge.title"), 128, 92);
    ctx.fillStyle = "#14100c"; ctx.fillRect(0, 128, 256, 128);
    ctx.fillStyle = "#ffb15c"; ctx.font = "bold 64px serif"; ctx.fillText("A · B · C", 128, 196);
    // (the face lies just off its board: pulled forward in the depth test too,
    // or the two fight in stripes from a few metres away)
    const face = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const board = (lx, ly, lz, w, h, d, v0) => {
      deco(lx, ly, lz, w, h, d, 0x2b2826);
      const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * 0.5);
      const p = at(lx, lz + d / 2 + 0.004), m = new THREE.Mesh(geo, face);
      m.position.set(p.x, y + ly, p.z);
      m.rotation.y = ry;
      scene.add(m);
    };
    board(0, 0.26, 0.38, 1.0, 0.26, 0.02, 0);
    const sp = at(0, -0.32);
    kit.addSolid(sp.x, y + 0.5, sp.z, 0.08, 0.95, 0.08, M(0x2b2826), 0, ry);
    board(0, 1.55, -0.32, 1.05, 0.5, 0.05, 0.5);
    // its light: a warm one that flickers like a fire
    const lp = at(0, 0.6);
    if (kit.addLight) kit.addLight(lp.x, y + 1.6, lp.z, S.color, 1.6, 3.2);
    // what "press E" meets: the anvil's box, never drawn
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.85), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.position.set(x, y + 0.6, z);
    hit.rotation.y = ry;
    scene.add(hit);
    const top = at(0.05, 0.02);
    const fr = at(0, 1.4);
    const ref = { room: spec.key, x, z, y, ry, free: !!fs, anvil: new THREE.Vector3(top.x, y + 0.86, top.z), front: new THREE.Vector3(fr.x, y, fr.z), mesh: hit };
    world.forge = ref;
    world.interactables.push({ mesh: hit, kind: "forge", ref });
    return ref;
  }
  // the prompt where it is looked at
  function prompt(game) {
    if (!on()) return "";
    const key = G.interactKeyLabel();
    if (C().onlyBetweenWaves) return T("prompt.forgeWaves");
    return T("prompt.forge", { key });
  }
  function interact(game) {
    if (!on()) return;
    if (C().onlyBetweenWaves && game.state !== "SHOP") { G.UI.flashPurchaseBanner(T("forge.title"), T("forge.whyWaves")); return; }
    open(game);
  }

  // ---------------- the shop (only between waves) ----------------
  // what the shop's row for a gun carried says (js/ui.js draws it): its name and
  // tier, the next tier's price, or why it cannot go up now
  function shopRow(game, id) {
    const d = G.WEAPON_DEFS[id];
    if (!on() || !d || !game || !game.player) return null;
    const t = tierOf(id, game), chk = canTry(game, id);
    const what = t >= 3 ? T("forge.whyMax") : T("forge.shopRow", { mk: labelOf(t + 1), price: money(priceOf(d, t + 1)) });
    return { name: d.name + (t ? " · " + labelOf(t) : ""), desc: chk.ok || t >= 3 ? what : what + " · " + why(chk), ok: chk.ok };
  }

  // ---------------- the run's ----------------
  function reset() { run = { cooldown: {}, used: [], tries: 0 }; last = null; if (G.ForgeScene) G.ForgeScene.reset(); }
  function state() { return JSON.parse(JSON.stringify(run)); }
  function restore(game, st) {
    reset();
    if (!st || typeof st !== "object") return;
    const cd = st.cooldown && typeof st.cooldown === "object" ? st.cooldown : {};
    Object.keys(cd).forEach((id) => { const w = Math.floor(Number(cd[id])); if (G.WEAPON_DEFS[id] && Number.isFinite(w) && w > 0) run.cooldown[id] = w; });
    run.used = Array.isArray(st.used) ? st.used.filter((k) => typeof k === "string" && k.length < 60).slice(-400) : [];
    run.tries = Math.max(0, Math.floor(Number(st.tries) || 0));
  }
  // a wave over (its shop open) or the next begun: the waits that ended with it go
  function endWait(wave) { Object.keys(run.cooldown).forEach((id) => { if (run.cooldown[id] <= wave) delete run.cooldown[id]; }); }
  if (G.Bus) {
    G.Bus.on("game:shop", (p) => endWait(p && p.wave != null ? p.wave : 0), "forge");
    G.Bus.on("game:wave", (p) => endWait(p && p.wave != null ? p.wave - 1 : 0), "forge");
  }

  // ---------------- each frame (paused too: the scene goes on) ----------------
  let humFor = null;
  function update(game, dt) {
    if (!on() || !game || !game.world) return;
    const W = game.world.forge;
    if (W && G.Audio && G.Audio.ctx && G.Audio._level && humFor !== G.Audio._level) hum(W);
    if (G.ForgeScene) G.ForgeScene.update(game, dt);
  }
  // its hum: two low sines and a little noise, placed at the anvil
  function hum(W) {
    const A = G.Audio, ctx = A.ctx, L = A._level, H = C().station.hum;
    humFor = L;
    const out = A._out("ambient", { x: W.x, y: W.y + 0.9, z: W.z });
    if (out.refDistance != null) { out.refDistance = H.ref; out.rolloffFactor = 1.6; out.maxDistance = 30; }
    const g = ctx.createGain(); g.gain.value = H.gain;
    [[H.f, 1], [H.f * 2, 0.45], [H.f * 3.01, 0.18]].forEach(([f, k]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; og.gain.value = k;
      o.connect(og); og.connect(g); o.start(); L.nodes.push(o);
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.4; lg.gain.value = H.gain * 0.35; lfo.connect(lg); lg.connect(g.gain); lfo.start(); L.nodes.push(lfo);
    g.connect(out);
    W.hum = { gain: g, out };
  }

  return {
    on, ROMAN, tierOf, inRunTier, labelOf, priceOf, perkOf, perkKind, setTier, pierceOf, headOf, dmgOf,
    pick, rankCtx, typeCtx, canTry, begin, finish, open, infoHtml, mount, prompt, interact, shopRow,
    reset, state, restore, endWait, update,
    get last() { return last; }, get run() { return run; },
  };
})();
