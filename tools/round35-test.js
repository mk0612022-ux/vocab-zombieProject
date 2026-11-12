// Dev-only (not shipped). The expansion's round 6: the Word Forge.
//   A  the rules: three tiers (the stat sheet's damage), prices by tier and
//      rarity, the tests, Tier III's extra by niche; zombie health by wave on
//   B  the words, pure (G.ForgePick): never one never met, the order (confused,
//      due, this level's harder, any met), none twice, the run's earlier tries
//      last, too few; the kinds (written answers, box 4-5 recall)
//   C  the stations: one a level, in its room, room to stand, its light, its
//      hum, its prompt
//   D  a try: the window; refused (money, words); the money; the test in the
//      quiz window (its rules, counters); passed: the tier, the scene; the SRS
//      by its own rules; failed: half back, the wait to the wave's end (from
//      the shop: the next one's); the next try's words; Tier II and III: the
//      written answers, no hints
//   E  what a tier does: the damage (on the shop's upgrades), Tier III's extra
//      (pierce, magazine, head hits), health by wave at a spawn, a run over, a
//      gun dropped and picked up, the checkpoint (and one from before)
//   F  the look and the sound: stripe, pips, plate, two draw calls at most, on
//      every gun; a skin leaves them; the HUD; a forged shot's sub, pitch and
//      tail, by numbers
//   G  the scene: plays through the first time, skippable after; sparks and
//      clangs; the view back as it was
//   H  only between waves: the prompt, the shop's rows, a try there
//   I  attachments at the Forge
//   J  the balance report's tiers; four languages; the flag
// Load it into the game (in the lobby), then:
//   const r = await G.Round35Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round35Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-6 : e);
  const dbOf = (r) => 20 * Math.log10(r || 1e-12);

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t35 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, F = G.Forge, P = G.ForgePick, K = G.CONFIG.forge, T = (k, v) => G.T(k, v), $ = (id) => document.getElementById(id);
    const V3 = THREE.Vector3;
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock;
    const gainDb0 = G.CONFIG.audio.gunGainDb, pitch0 = G.CONFIG.audio.gunPitch;
    const real = g._update0 || g.update;
    const I = G.Input;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const startLevel = (lv) => {
      g.update = real;
      g.startLevel(lv);
      G.Spawner.update = () => {};
      g.update = () => {};
      G.Modal.reset();
      g.paused = false; g.state = "GAMEPLAY";
      g.player.hp = g.player.maxHp = 1e6;
      g.requiredKills = 1e9;
      g.clearZombies();
      I.clearHeldInputs();
      if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
      step(4);
    };
    const give = (id) => {
      const p = g.player, d = G.WEAPON_DEFS[id];
      if (!p.gunSlots.includes(id)) p.gunSlots.push(id);
      if (!p.weaponLevels[id]) p.weaponLevels[id] = { dmg: 1, rate: 1, mag: 1 };
      p.ammo[id] = { mag: d.magSize, reserve: 200 };
      p.currentSlot = p.gunSlots.indexOf(id) + 1;
      if (g.wsm) { g.wsm.requestSwitch(); g.wsm.finishSwitch(); }
      g.buildWeaponViewModel(id);
      step(1);
    };
    // the player's learning: these words met, in box b, due `due` days from today
    const meet = (pairs, b, due) => {
      const L = G.save.learn, today = G.Clock.today();
      pairs.forEach((p) => { L.srs[G.wordKey(p)] = { b, due: today + (due || 0), last: today - 3, n: 2, lapses: 0 }; });
    };
    const freshLearning = () => { G.save.learn = G.Learning.normalize({}); g.wrongWordsThisRun = {}; };
    // the quiz window's question, answered right or wrong, then on to the next
    const answer = (right) => { const q = G.Quiz.qs[G.Quiz.i]; G.Quiz.answerAs(right); return q; };
    const playTest = (rights) => {
      const out = [];
      for (let i = 0; i < G.Quiz.qs.length; i++) {
        const right = typeof rights === "function" ? rights(i, G.Quiz.qs[G.Quiz.i]) : rights;
        out.push(answer(right));
        if (G.Quiz.stage === "feedback") G.Quiz.next();
      }
      return out;
    };
    const btn = (i) => document.querySelector(`#dialog-btns [data-i="${i}"]`);
    // standing in front of the station, looking at its anvil
    const atStation = () => {
      const W = g.world.forge;
      g.yawObject.position.set(W.front.x, W.y + 1.7, W.front.z); g._prevPos = null;
      const dx = W.anvil.x - W.front.x, dz = W.anvil.z - W.front.z;
      g.yawObject.rotation.y = Math.atan2(-dx, -dz); g.pitchObject.rotation.x = Math.atan2(W.anvil.y - (W.y + 1.7), Math.hypot(dx, dz));
      g.yawObject.updateMatrixWorld(true);
      // (the rooms drawn, and so reachable by a ray, follow where the player is -- js/zones.js)
      if (G.Zones) G.Zones.update(g, true);
    };
    const aw0 = G.Learning.answerWord;

    try {
      if (G.Audio.unlock) G.Audio.unlock();
      for (let i = 0; i < 40 && !G.Audio.ctx; i++) await wait(50);

      await wait(0); // ---------------- A: the rules ----------------
      {
        const tiers = G.CONFIG.balance.tiers.map((t) => t.dmg);
        ok("A three tiers, their damage the stat sheet's: x1.25 x1.55 x1.9", tiers.join() === "1.25,1.55,1.9" && [1, 2, 3].every((t) => F.dmgOf(t) === tiers[t - 1]) && F.dmgOf(0) === 1);
        const pd = G.WEAPON_DEFS.pistol, ep = Object.values(G.WEAPON_DEFS).find((d) => d.rarity === "epic");
        const pr = [1, 2, 3].map((t) => F.priceOf(pd, t));
        ok("A the price: by tier and by rarity, in fifties", pr[0] < pr[1] && pr[1] < pr[2] && F.priceOf(ep, 1) > pr[0] && pr.every((p) => p % 50 === 0), pr.join() + " | epic " + F.priceOf(ep, 1));
        const Q = K.quiz;
        ok("A the tests: I 4 questions, 3 right; II 5, 4, one written; III 5, all, two written, no hints",
          Q[0].n === 4 && Q[0].pass === 3 && Q[0].recall === 0 && Q[0].hints && Q[1].n === 5 && Q[1].pass === 4 && Q[1].recall === 1 && Q[1].hints && Q[2].n === 5 && Q[2].pass === 5 && Q[2].recall === 2 && !Q[2].hints);
        const kinds = new Set(), bad = Object.keys(G.CONFIG.balance.niches).filter((n) => { const k = F.perkKind(K.perks[n] || K.perks.default); kinds.add(k); return !["pierce", "head", "mag"].includes(k); });
        ok("A Tier III's extra by niche: every niche has one -- pierce +1, a magazine x1.25 or head hits x1.25", !bad.length && kinds.size === 3 && K.perks.crowd_pierce.pierce === 1 && K.perks.big_mag.mag === 1.25 && K.perks.headhunter.head === 1.25, [...kinds].join());
        ok("A zombie health by wave on (the user's choice): x1 at wave 1, x1.72 at 10, x2.52 at 20", G.CONFIG.zombies.hpByWave.on && near(G.zombieHpMult(1), 1) && near(G.zombieHpMult(10), 1.72) && near(G.zombieHpMult(20), 2.52));
        ok("A a failed try: half the money back", K.failKeep === 0.5);
      }

      await wait(0); // ---------------- B: the words, pure ----------------
      {
        let seed = 7;
        const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const words = Array.from({ length: 40 }, (_, i) => ["w" + i, "m" + i]);
        const st = {}, conf = { w0: 3, w1: 1 }, wrong = { w2: 2, w3: 1, w4: 1 }, lvl = {}, diff = {}, today = 1000;
        for (let i = 0; i < 30; i++) {
          if (i < 5) st["w" + i] = { b: 2, due: today + 4, n: 3, lapses: 1 };                       // confused or wrong lately
          else if (i < 13) st["w" + i] = { b: 1 + (i % 3), due: today - (13 - i), n: 2, lapses: 0 };  // due, boxes 1-3
          else if (i < 25) { st["w" + i] = { b: 4, due: today + 6, n: 5, lapses: 0 }; lvl["w" + i] = 1; diff["w" + i] = (i - 13) / 11; }   // this level's
          else { st["w" + i] = { b: 3, due: today + 2, n: 4, lapses: 0 }; lvl["w" + i] = 2; }       // met, another level
        }
        const ctx = (used, pool) => ({ pool: pool || words, key: (p) => p[0], state: (p) => st[p[0]] || null, today, confused: (p) => conf[p[0]] || 0, wrongLately: (p) => wrong[p[0]] || 0,
          level: 1, levelOf: (p) => (lvl[p[0]] == null ? null : lvl[p[0]]), difficulty: (p) => diff[p[0]] || 0, used: used || new Set(), rng });
        const r = P.pick(ctx(), 30), ids = r.words.map((p) => p[0]), gi = (gname) => P.GROUPS.indexOf(gname);
        ok("B never a word never met (no memory box)", r.words.every((p) => st[p[0]]) && r.seen === 30 && r.words.length === 30 && !ids.some((w) => +w.slice(1) >= 30));
        ok("B the order: confused or wrong lately, then due in boxes 1-3, then this level's harder, then any met", r.from.every((f, i) => !i || gi(f) >= gi(r.from[i - 1])) && r.from.slice(0, 5).every((f) => f === "confused") && r.from.slice(5, 13).every((f) => f === "due") && r.from.slice(13, 25).every((f) => f === "level") && r.from.slice(25).every((f) => f === "met"), r.from.join(","));
        ok("B ...within each: the most confused first, the most overdue, the hardest (AWL sublist; a topic word by the player's own mistakes)", ids[0] === "w0" && ids[1] === "w2" && ids[5] === "w5" && ids[12] === "w12" && ids[13] === "w24" && ids[24] === "w13", ids.slice(0, 14).join());
        const used = new Set(ids.slice(0, 5));
        const r2 = P.pick(ctx(used), 5);
        ok("B a try never asks a word twice; the run's earlier tries' words come last", new Set(r2.words.map((p) => p[0])).size === 5 && r2.words.every((p) => !used.has(p[0])) && r2.reused === 0, r2.words.map((p) => p[0]).join());
        const r3 = P.pick(ctx(new Set(words.slice(0, 28).map((p) => p[0]))), 5);
        ok("B ...and only when nothing else will do", r3.words.length === 5 && r3.reused === 3 && r3.words.slice(0, 2).map((p) => p[0]).sort().join() === "w28,w29", r3.words.map((p) => p[0]).join() + " reused " + r3.reused);
        const few = P.pick(ctx(null, words.slice(28)), 5);
        ok("B too few met: short by how many, never filled with a word never met", few.short === 3 && few.words.length === 2 && few.seen === 2, JSON.stringify({ short: few.short, n: few.words.length }));
        const W = ["spell", "dictation", "defspell", "clozespell"];
        const tctx = { can: (k, p) => !(k === "dictation" && p[0] === "w6"), box: (p) => (st[p[0]] ? st[p[0]].b : 0), pickType: (p, prev) => (prev === "th2en" ? "en2th" : "th2en"), recall: G.Questions.RECALL, written: W };
        const five = r.words.slice(5, 10), k1 = P.types(five.slice(0, 4), K.quiz[0], tctx), k2 = P.types(five, K.quiz[1], tctx), k3 = P.types(five, K.quiz[2], tctx);
        const wr = (ks) => ks.filter((k) => W.includes(k));
        ok("B Tier I: chosen by box, nothing forced; II: one written answer; III: two, of two kinds (typed, heard and typed)", wr(k1).length === 0 && wr(k2).length >= 1 && wr(k3).length >= 2 && new Set(wr(k3)).size >= 2, k1.join() + " | " + k2.join() + " | " + k3.join());
        st.h1 = { b: 4, due: today, n: 5, lapses: 0 }; st.h2 = { b: 5, due: today, n: 6, lapses: 0 };
        const kh = P.types([["h1", "x"], ["h2", "y"]], K.quiz[0], tctx);
        ok("B a word in box 4 or 5 gets a recall kind (the SRS reaches those boxes only by recall)", kh.every((k) => G.Questions.RECALL.includes(k)), kh.join());
      }

      await wait(0); // ---------------- C: the stations ----------------
      {
        const rooms = {}, stand = {}, light = {}, gunClear = {}, free = {};
        for (const lv of [1, 2, 3]) {
          startLevel(lv);
          const W = g.world.forge, its = g.world.interactables.filter((i) => i.kind === "forge");
          rooms[lv] = W ? W.room : null;
          if (!W) continue;
          numbers["station" + lv] = W.room + " @" + W.x.toFixed(1) + "," + W.z.toFixed(1) + (W.free ? " (a free spot)" : " (no free spot: the fallback)");
          free[lv] = !!W.free;
          const eye = new V3(W.front.x, W.y + 1.0, W.front.z);
          stand[lv] = !g.world.colliders.some((c) => c.containsPoint(eye)) && its.length === 1;
          // (the level's lights are the pool's anchors once it is built -- js/perf.js)
          light[lv] = (G.Perf.anchors || []).some((a) => Math.hypot(a.pos.x - W.x, a.pos.z - W.z) < 2.5 && a.color.getHex() === K.station.color);
          const gun = g.world.interactables.find((i) => i.kind === "wallweapon" && Math.abs(i.mesh.position.x - W.x) < 8 && Math.abs(i.mesh.position.z - W.z) < 8);
          gunClear[lv] = !gun || Math.hypot(gun.mesh.position.x - W.x, gun.mesh.position.z - W.z) > 1.6;
          if (lv === 1) {
            // what is seen from in front of it, and the hum
            atStation();
            g.updateInteractRay();
            numbers.prompt = $("hud-interact-prompt").textContent;
            ok("C seen from in front of it: its prompt", !$("hud-interact-prompt").classList.contains("hidden") && numbers.prompt === T("prompt.forge", { key: G.interactKeyLabel() }) && g._lookedAtInteractable && g._lookedAtInteractable.kind === "forge", numbers.prompt);
            if (G.Audio.ctx && G.Audio._level) {
              F.update(g, 0.016);
              const H = W.hum, pz = H && H.out && H.out.positionX ? [H.out.positionX.value, H.out.positionZ.value] : null;
              ok("C its hum: low, placed at the anvil, heard within a few metres", !!H && H.gain.gain.value > 0 && H.gain.gain.value < 0.1 && pz && Math.hypot(pz[0] - W.x, pz[1] - W.z) < 0.5 && H.out.refDistance <= 4, pz && pz.map((v) => v.toFixed(1)).join());
            } else ok("C its hum: low, placed at the anvil, heard within a few metres", false, "no audio context or level sound");
          }
        }
        ok("C one station a level, in its room: the school's science room (E2), the hospital's operating theatre (W2), the bunker's armoury (W2)", rooms[1] === "E2" && rooms[2] === "W2" && rooms[3] === "W2", JSON.stringify(rooms));
        ok("C ...each on a free spot (clear of the room's doors, furniture and paths)", free[1] && free[2] && free[3], JSON.stringify(free));
        ok("C ...room to stand in front of each, and the one thing to use there", stand[1] && stand[2] && stand[3], JSON.stringify(stand));
        ok("C ...its light, seen from the door", light[1] && light[2] && light[3], JSON.stringify(light));
        ok("C ...clear of the room's wall gun", gunClear[1] && gunClear[2] && gunClear[3], JSON.stringify(gunClear));
      }

      await wait(0); // ---------------- D: a try ----------------
      {
        startLevel(1);
        atStation();
        freshLearning();
        G.save.tutorialSeen = G.save.tutorialSeen || {}; delete G.save.tutorialSeen.forge_scene;
        const pool = g.wordPool.slice();
        meet(pool.slice(0, 12), 2, -1);            // due, box 2
        meet(pool.slice(12, 24), 4, 5);            // known, not due
        g.player.money = 0;
        const W = g.world.forge, it = g.world.interactables.find((i) => i.kind === "forge");
        g._lookedAtInteractable = it;
        g.doInteract();
        await wait(20);
        const open1 = G.Dialog.isOpen() && $("dialog-title").textContent === T("forge.title") && $("forge-gun") && [...$("forge-gun").options].map((o) => o.value).join() === g.player.gunSlots.join();
        ok("D E at it: its window -- the guns carried, the next tier, its price and its test", open1 && $("forge-info").textContent.includes(T("forge.cost", { price: "$" + F.priceOf(G.WEAPON_DEFS.pistol, 1).toLocaleString("en-US") })) && $("forge-info").textContent.includes(T("forge.ruleChoice", { n: 4, pass: 3 })));
        ok("D ...the gun's card as it would be, the damage up", !!$("forge-info").querySelector(".stat-card.compare .statc-delta.up"));
        ok("D too little money: Start cannot be pressed, it says how much more", btn(0).disabled && $("forge-info").textContent.includes(T("forge.whyMoney", { n: "$" + F.priceOf(G.WEAPON_DEFS.pistol, 1).toLocaleString("en-US") })));
        G.Dialog.close();
        const L0 = JSON.stringify(G.save.learn.srs);
        G.save.learn.srs = {};
        g.player.money = 99999;
        const noWords = F.canTry(g, "pistol");
        ok("D too few words met (a new player): refused, it says how many more", noWords.why === "words" && noWords.need === 4, JSON.stringify(noWords));
        G.save.learn.srs = JSON.parse(L0);
        // a try at Mk I, passed
        F.open(g, "pistol");
        await wait(20);
        const seenBefore = JSON.parse(JSON.stringify(G.save.learn.srs));
        const calls = [];
        G.Learning.answerWord = function (pair, right, o) { calls.push({ key: G.wordKey(pair), right, recall: !!(o && o.recall), assisted: !!(o && o.assisted) }); return aw0.apply(this, arguments); };
        const price1 = F.priceOf(G.WEAPON_DEFS.pistol, 1), lvl = g.player.weaponLevels.pistol;
        lvl.dmg = 1.15;                                            // a Damage upgrade from the shop
        G.Dialog.choose(0);
        await wait(20);
        const qs1 = G.Quiz.qs || [];
        ok("D Start: the money goes, the test opens in the quiz window -- Word Forge, four questions, one mistake allowed", G.Quiz.active && g.player.money === 99999 - price1 && qs1.length === 4 && G.Quiz.maxMistakes === 1 && $("quiz-kicker").textContent === T("forge.kicker", { name: G.WEAPON_DEFS.pistol.name, mk: "Mk I" }) && $("quiz-mistakes").textContent === T("quiz.mistakes", { x: 0, n: 1 }), $("quiz-kicker").textContent);
        const keys1 = qs1.map((q) => G.wordKey(q.pair));
        ok("D ...its words: all met before, none twice", keys1.every((k) => seenBefore[k]) && new Set(keys1).size === keys1.length, keys1.join());
        const asked1 = playTest(true);
        ok("D all right: passed, the summary under it", G.Quiz.stage === "result" && $("quiz-verdict").textContent === T("forge.passed") && $("quiz-verdict-sub").textContent.includes(T("forge.summary", { n: 4, m: 4 })), $("quiz-verdict-sub").textContent);
        // the SRS: each word as its rules say -- due and right: up a box (a recognition answer no higher than box 3)
        const today = G.Clock.today(), cap = G.CONFIG.srs.recognitionMaxBox;
        const srsBad = asked1.filter((q, i) => {
          const k = G.wordKey(q.pair), s0 = seenBefore[k], s1 = G.save.learn.srs[k], c = calls[i];
          const want = s0.due <= today ? (c.recall ? Math.min(6, s0.b + 1) : Math.max(s0.b, Math.min(s0.b + 1, cap))) : s0.b;
          return !c || c.key !== k || c.recall !== !!q.recall || s1.b !== want;
        });
        ok("D every answer a review by the SRS's own rules (recall or not as the question, boxes moved as they say)", calls.length === 4 && !srsBad.length, srsBad.map((q) => q.pair[0]).join());
        G.Quiz.close();
        ok("D passed: Mk I -- its damage x1.25 on the shop's upgrade, the scene begins", lvl.tier === 1 && near(lvl.dmg, 1.15 * 1.25, 1e-9) && G.ForgeScene.active && F.last.passed === true, lvl.dmg);
        // the scene (G covers it more): the first time it plays through
        const y0 = G.ForgeScene.cur ? G.ForgeScene.cur.from.yaw : null;
        G.Modal.handleKey({ code: "Space", repeat: false });
        const stillOn = G.ForgeScene.active;
        let sparks = 0, tones = 0;
        const tone0 = G.Audio.tone;
        G.Audio.tone = function (o) { tones++; return tone0.call(this, o); };
        for (let i = 0; i < 60 && G.ForgeScene.active; i++) { F.update(g, 0.1); if (G.FX._pools.d) sparks = Math.max(sparks, G.FX._pools.d.live); }
        G.Audio.tone = tone0;
        ok("G the first time the scene plays through (a key does not skip it), about 2.6 s", stillOn && !G.ForgeScene.active && G.save.tutorialSeen.forge_scene === true);
        ok("G ...three blows: sparks off the anvil, a clang each", sparks > 0 && (!G.Audio.ctx || tones >= 15), "sparks " + sparks + " tones " + tones);
        ok("G ...then the view as it was, the gun back in the hands with its mark", near(g.yawObject.rotation.y, y0, 1e-9) && g.weaponViewGroup && g.weaponViewGroup.visible !== false && g.weaponViewGroup.userData.forgeTier === 1);
        step(1);
        ok("F the HUD: the tier leads the gun's label", $("hud-weapon-status").textContent.indexOf(T("forge.mk", { n: "I" }) + " · ") === 0, $("hud-weapon-status").textContent);
        // a try at Mk II, failed
        const money1 = g.player.money, price2 = F.priceOf(G.WEAPON_DEFS.pistol, 2);
        F.open(g, "pistol");
        await wait(20);
        G.Dialog.choose(0);
        const qs2 = G.Quiz.qs;
        const keys2 = qs2.map((q) => G.wordKey(q.pair));
        ok("D the next try asks other words than the last", keys2.every((k) => !keys1.includes(k)), keys2.join());
        ok("D Tier II: five questions, one mistake allowed, at least one written answer", qs2.length === 5 && G.Quiz.maxMistakes === 1 && qs2.filter((q) => q.spell).length >= 1, qs2.map((q) => q.type).join());
        playTest(false);
        ok("D all wrong: failed; what it cost and what came back said", G.Quiz.stage === "result" && $("quiz-verdict").textContent === T("forge.failed") && $("quiz-verdict-sub").textContent.includes("$" + (price2 / 2).toLocaleString("en-US")));
        ok("D ...the words missed, under 'Words to come back to'", $("quiz-missed").textContent.includes(T("forge.revisit")));
        G.Quiz.close();
        ok("D failed: half the money back, the gun as it was", g.player.money === money1 - price2 / 2 && lvl.tier === 1 && F.last.passed === false, g.player.money + " vs " + (money1 - price2 / 2));
        const w1 = F.canTry(g, "pistol");
        F.open(g, "pistol");
        await wait(20);
        ok("D ...that gun waits: Start cannot be pressed, it says until the wave ends", w1.why === "cooldown" && btn(0).disabled && $("forge-info").textContent.includes(T("forge.whyWait")));
        G.Dialog.close();
        G.Bus.emit("game:wave", { wave: g.wave + 1 });
        ok("D ...the next wave: it may try again", F.canTry(g, "pistol").ok);
        // failed from the shop: the wait runs to the end of the next wave
        g.state = "SHOP";
        F.open(g, "pistol");
        await wait(20);
        G.Dialog.choose(0);
        playTest(false);
        G.Quiz.close();
        const cdShop = F.run.cooldown.pistol;
        G.Bus.emit("game:wave", { wave: g.wave + 1 });
        const afterWave = F.canTry(g, "pistol").why;
        G.Bus.emit("game:shop", { wave: g.wave + 1 });
        g.state = "GAMEPLAY";
        ok("D failed in the shop (between waves): the wait is the next wave's", cdShop === g.wave + 1 && afterWave === "cooldown" && F.canTry(g, "pistol").ok, cdShop + " " + afterWave);
        // Mk II passed, then Mk III: two written answers, no hints
        F.open(g, "pistol"); await wait(20); G.Dialog.choose(0);
        playTest(true); G.Quiz.close(); G.ForgeScene.skip();
        ok("D Mk II passed (the scene, seen before, skipped)", lvl.tier === 2 && !G.ForgeScene.active);
        meet(pool.slice(24, 40), 3, -2);
        F.open(g, "pistol"); await wait(20); G.Dialog.choose(0);
        const qs3 = G.Quiz.qs;
        let padHint = null, hintsAfterTab = null;
        for (let i = 0; i < qs3.length; i++) {
          const q = G.Quiz.qs[G.Quiz.i];
          if (q.spell && padHint === null) {
            padHint = !!$("quiz-choices").querySelector('[data-act="hint"]');
            G.Quiz.key({ code: "Tab", preventDefault() {} });
            hintsAfterTab = q.hints || 0;
          }
          answer(true);
          if (G.Quiz.stage === "feedback") G.Quiz.next();
        }
        ok("D Tier III: five questions, none may be wrong, two written answers at least", qs3.length === 5 && G.Quiz.maxMistakes === 0 && qs3.filter((q) => q.spell).length >= 2, qs3.map((q) => q.type).join());
        ok("D ...and no hints: no hint button on a written answer, Tab gives none", padHint === false && hintsAfterTab === 0 && G.Quiz.opts.noHint === true);
        G.Quiz.close(); G.ForgeScene.skip();
        const pk = F.perkOf(G.WEAPON_DEFS.pistol);
        ok("D Mk III: the damage x1.9 on the shop's, its niche's extra", lvl.tier === 3 && near(lvl.dmg, 1.15 * 1.9, 1e-9) && (pk.head ? near(lvl.head, pk.head) : pk.mag ? lvl.mag > 1 : lvl.pierce === 1), JSON.stringify(lvl));
        F.open(g, "pistol"); await wait(20);
        ok("D at Mk III: nothing more to forge", btn(0).disabled && $("forge-info").textContent.includes(T("forge.whyMax")));
        G.Dialog.close();
        G.Learning.answerWord = aw0;
      }

      await wait(0); // ---------------- E: what a tier does ----------------
      {
        startLevel(1);
        const pd = G.WEAPON_DEFS.pistol, lv = g.player.weaponLevels.pistol;
        const rs0 = g.raycastShoot;
        let got = null;
        g.raycastShoot = function (o, d, dmg, pierce) { got = { dmg, pierce }; return false; };
        const shot = () => { g.player.ammo.pistol.mag = 5; g.player.fireCooldown = 0; got = null; g.shoot(0, false, Math.random()); return got; };
        const base = shot().dmg;
        F.setTier(g, "pistol", 1);
        const t1 = shot().dmg;
        F.setTier(g, "pistol", 2);
        const t2 = shot().dmg;
        ok("E a shot of Mk I x1.25, Mk II x1.55 the gun's damage", near(t1 / base, 1.25, 1e-9) && near(t2 / base, 1.55, 1e-9), base + " " + t1 + " " + t2);
        F.setTier(g, "pistol", 0);
        // Tier III's extra: pierce, magazine, head
        const by = (kind) => Object.values(G.WEAPON_DEFS).find((d) => !d.boxOnly && F.perkKind(F.perkOf(d)) === kind && d.id !== "pistol") || Object.values(G.WEAPON_DEFS).find((d) => F.perkKind(F.perkOf(d)) === kind);
        const pg = by("pierce"), mg = by("mag"), hg = by("head");
        give(pg.id);
        const p0 = shot === null ? null : (() => { g.player.ammo[pg.id].mag = 5; g.player.fireCooldown = 0; got = null; g.shoot(0, false, Math.random()); return got && got.pierce; })();
        F.setTier(g, pg.id, 3);
        const p3 = (() => { g.player.ammo[pg.id].mag = 5; g.player.fireCooldown = 0; got = null; g.shoot(0, false, Math.random()); return got && got.pierce; })();
        const n0 = p0 === true ? 99 : p0 || 1, n3 = p3 === true ? 99 : p3 || 1;
        ok("E Tier III, a gun of a piercing niche: its rounds go through one more zombie", n3 === n0 + 1 || (p0 === true && p3 === true), pg.id + " " + p0 + " -> " + p3);
        g.raycastShoot = rs0;
        give(mg.id);
        const m0 = g.weaponHost().ammo(mg.id).magSize;
        F.setTier(g, mg.id, 3);
        const m3 = g.weaponHost().ammo(mg.id).magSize;
        ok("E ...of a magazine niche: its magazine x1.25", m3 === Math.round(mg.magSize * 1.25) && m0 === mg.magSize, mg.id + " " + m0 + " -> " + m3);
        // head hits: one zombie, hit in the head, through raycastShoot
        give(hg.id);
        const tr0 = G.Aim.trace, hm0 = G.ZombieAI.hitMod, dz0 = g.damageZombie, hb0 = G.ZombieFX.hitBlocked;
        const fake = { uid: 99001, alive: true, answer: "shoot" };
        let dealt = null;
        G.Aim.trace = () => [{ z: fake, head: true, point: new V3(0, 1.6, -3), distance: 3 }];
        G.ZombieAI.hitMod = (game, z, dmg, head) => ({ dmg, head });
        G.ZombieFX.hitBlocked = () => false;
        g.damageZombie = (z, dmg) => { dealt = dmg; };
        const o = new V3(0, 1.6, 0), d = new V3(0, 0, -1);
        g.raycastShoot(o, d, 10, false, hg); const h0 = dealt;
        F.setTier(g, hg.id, 3);
        g.raycastShoot(o, d, 10, false, hg); const h3 = dealt;
        G.Aim.trace = tr0; G.ZombieAI.hitMod = hm0; g.damageZombie = dz0; G.ZombieFX.hitBlocked = hb0;
        ok("E ...of a head-hunting niche: a head hit x1.25", h0 > 0 && near(h3 / h0, 1.25, 1e-9), hg.id + " " + h0 + " -> " + h3);
        // health by wave, as a zombie comes in
        g.wave = 10;
        const z = g.spawnZombieAt("normal", new V3(g.yawObject.position.x + 3, 0, g.yawObject.position.z - 3), null);
        ok("E a zombie of wave 10 comes in with x1.72 the health", z && z.maxHp === Math.round(G.ZOMBIE_TYPES.normal.hp * 1.72), z && z.maxHp);
        g.clearZombies(); g.wave = 1;
        // dropped and picked up: it keeps its tier
        F.setTier(g, "pistol", 2);
        const carry = G.Loadout.carryOf(g, "pistol");
        delete g.player.weaponLevels.pistol;
        G.Loadout._install(g, "pistol", carry);
        ok("E a gun dropped and picked up again keeps its tier", g.player.weaponLevels.pistol.tier === 2 && near(g.player.weaponLevels.pistol.dmg, 1.55, 1e-9));
        // the checkpoint
        F.setTier(g, hg.id, 3);
        F.run.cooldown.pistol = 11; F.run.used = ["alpha", "beta"]; F.run.tries = 4;
        const cp = JSON.parse(JSON.stringify(G.Checkpoint.snapshot(g)));
        startLevel(1);
        const fresh = F.tierOf("pistol") === 0 && !Object.keys(F.run.cooldown).length && F.run.tries === 0;
        ok("E a run over: no gun forged, no wait, no words asked", fresh);
        G.Checkpoint.apply(g, cp);
        const L = g.player.weaponLevels;
        ok("E the checkpoint keeps the tiers with the guns, Tier III's extra, the waits and the words asked", L.pistol.tier === 2 && L[hg.id] && L[hg.id].tier === 3 && near(L[hg.id].head, 1.25) && F.run.cooldown.pistol === 11 && F.run.used.join() === "alpha,beta" && F.run.tries === 4, JSON.stringify({ p: L.pistol, h: L[hg.id] }));
        const old = JSON.parse(JSON.stringify(cp)); delete old.forge; Object.values(old.player.weaponLevels).forEach((l) => { delete l.tier; delete l.head; delete l.pierce; });
        startLevel(1); G.Checkpoint.apply(g, old);
        ok("E ...one from before the Word Forge: no tier, no wait, nothing broken", F.tierOf("pistol") === 0 && !Object.keys(F.run.cooldown).length);
      }

      await wait(0); // ---------------- F: the look and the sound ----------------
      {
        startLevel(1);
        const tierGroup = (m) => m.children.find((c) => c.name === "forge-tier");
        const meshes = (o) => { let n = 0; o.traverse((c) => { if (c.isMesh) n++; }); return n; };
        const pd = G.WEAPON_DEFS.pistol;
        const m0 = G.buildWeaponMesh(pd, { loadout: true }), m1 = G.buildWeaponMesh(pd, { loadout: true, tier: 1 }), m3 = G.buildWeaponMesh(pd, { loadout: true, tier: 3 });
        const g1 = tierGroup(m1), g3 = tierGroup(m3);
        const verts = (grp) => { let v = 0; grp.traverse((c) => { if (c.isMesh && !c.material.map) v += c.geometry.attributes.position.count; }); return v; };
        ok("F a forged gun wears its tier: a stripe down each side, a pip for each tier (one mesh); from Mk II its plate (one more)", !tierGroup(m0) && g1 && meshes(g1) === 1 && verts(g1) === (2 + 2) * 24 && g3 && meshes(g3) === 2 && verts(g3) === (2 + 6) * 24 && g3.children.some((c) => c.material && c.material.map), meshes(g1) + " " + verts(g1) + " / " + (g3 && meshes(g3)) + " " + (g3 && verts(g3)));
        ok("F ...two draw calls at most", meshes(m3) - meshes(m0) <= 2, meshes(m0) + " -> " + meshes(m3));
        const col0 = g3.children[0].material.color.getHex();
        if (G.GunSkins) G.GunSkins.apply(m3, "scholarGold");
        ok("F ...unlit, in its tier's colour, and a skin leaves it", g3.children[0].material.isMeshBasicMaterial && col0 === K.look.colors[2] && g3.children[0].material.color.getHex() === col0);
        [m0, m1, m3].forEach((m) => G.disposeObject3D(m));
        // on every gun: its stripes against the gun's sides, not floating far off, not buried
        const badG = [];
        Object.values(G.WEAPON_DEFS).forEach((d) => {
          const m = G.buildWeaponMesh(d, { loadout: true, tier: 2 }), grp = tierGroup(m);
          if (!grp) { badG.push(d.id + " none"); G.disposeObject3D(m); return; }
          const gb = new THREE.Box3().setFromObject(grp);
          m.remove(grp); const bb = new THREE.Box3().setFromObject(m); m.add(grp);
          // (on its sides: within 2 cm of the gun's width, inside its length and height)
          if (![gb.min.x, gb.max.x, gb.min.y, gb.max.z].every(Number.isFinite) || gb.max.x - gb.min.x < 0.004 || gb.min.x < bb.min.x - 0.02 || gb.max.x > bb.max.x + 0.02
            || gb.min.z < bb.min.z - 0.01 || gb.max.z > bb.max.z + 0.01 || gb.min.y < bb.min.y - 0.01 || gb.max.y > bb.max.y + 0.01) badG.push(d.id);
          G.disposeObject3D(m);
        });
        ok("F ...on every gun, its stripes on its sides (" + Object.keys(G.WEAPON_DEFS).length + ")", !badG.length, badG.slice(0, 8).join());
        // the sound
        const def = G.WEAPON_DEFS.scrap_spitter;
        give("scrap_spitter");
        await G.GunAudio.render(def);
        const b0 = G.Audio.buffer, n0 = G.Audio.noise;
        let last = null, tails = [];
        G.Audio.buffer = function (buf, o) { last = o; return b0.call(this, buf, o); };
        G.Audio.noise = function (o) { if (o && o.freq === K.sound.tail.lp && o.freqEnd === K.sound.tail.lpEnd) tails.push(o); return n0.call(this, o); };
        G.CONFIG.audio.gunGainDb = 0; G.CONFIG.audio.gunPitch = 0;
        G.GunAudio.shot(def, {}); const plain = last, tPlain = tails.length;
        F.setTier(g, "scrap_spitter", 3);
        G.GunAudio.shot(def, {}); const heavy = last, tHeavy = tails.length - tPlain;
        F.setTier(g, "scrap_spitter", 1);
        G.GunAudio.shot(def, {}); const t1 = last;
        G.Audio.buffer = b0; G.Audio.noise = n0;
        G.CONFIG.audio.gunGainDb = gainDb0; G.CONFIG.audio.gunPitch = pitch0;
        ok("F a forged shot: pitch down (Mk III x0.97), its sub up (+3 dB), one tail more", plain && heavy && !plain.low && near(heavy.rate / plain.rate, 0.97, 1e-9) && heavy.low && heavy.low.db === 3 && heavy.low.hz === K.sound.lowHz && tPlain === 0 && tHeavy === 1 && t1.low.db === 2 && near(t1.rate / plain.rate, 0.98, 1e-9),
          plain && heavy ? (heavy.rate / plain.rate).toFixed(3) + " " + JSON.stringify(heavy.low) : "none");
        // ...by numbers: the low layer offline, 60 Hz up its dB, 3 kHz as it was
        const sr = 48000, N = sr / 2;
        const render = async (low) => {
          const ctx = new OfflineAudioContext(1, N, sr), buf = ctx.createBuffer(1, N, sr), x = buf.getChannelData(0);
          for (let i = 0; i < N; i++) x[i] = 0.4 * Math.sin(2 * Math.PI * 60 * i / sr) + 0.2 * Math.sin(2 * Math.PI * 3000 * i / sr);
          const src = ctx.createBufferSource(), gn = ctx.createGain(); src.buffer = buf; gn.connect(ctx.destination);
          if (low) G.Audio.lowLayer(ctx, src, gn, low); else src.connect(gn);           // (as G.Audio.buffer wires it)
          src.start(); return (await ctx.startRendering()).getChannelData(0);
        };
        const amp = (y, f) => { let re = 0, im = 0; const a = sr * 0.1, b = N; for (let i = a; i < b; i++) { re += y[i] * Math.cos(2 * Math.PI * f * i / sr); im += y[i] * Math.sin(2 * Math.PI * f * i / sr); } return 2 * Math.hypot(re, im) / (b - a); };
        const y0 = await render(null), y3 = await render({ db: 3, hz: K.sound.lowHz }), y2 = await render({ db: 2, hz: K.sound.lowHz });
        const lo3 = dbOf(amp(y3, 60) / amp(y0, 60)), hi3 = dbOf(amp(y3, 3000) / amp(y0, 3000)), lo2 = dbOf(amp(y2, 60) / amp(y0, 60));
        numbers.sub = { mk3_60Hz: +lo3.toFixed(2), mk3_3kHz: +hi3.toFixed(2), mk1_60Hz: +lo2.toFixed(2) };
        ok("F ...by numbers: Mk III's sub +3 dB, Mk I's +2 (60 Hz), the top as it was (3 kHz)", near(lo3, 3, 0.35) && near(lo2, 2, 0.35) && Math.abs(hi3) < 0.3, JSON.stringify(numbers.sub));
        g.quitToMainMenu();
        ok("F between runs (the Armory's Listen): the gun as it comes", F.inRunTier("scrap_spitter") === 0);
      }

      await wait(0); // ---------------- H: only between waves ----------------
      {
        startLevel(1);
        freshLearning();
        meet(g.wordPool.slice(0, 20), 2, -1);
        K.onlyBetweenWaves = true;
        g.player.money = 99999;
        const it = g.world.interactables.find((i) => i.kind === "forge");
        ok("H only between waves: its prompt says so", F.prompt(g) === T("prompt.forgeWaves"));
        g._lookedAtInteractable = it; g.doInteract();
        ok("H ...E at it in a wave: no window, a word on where", !G.Dialog.isOpen() && F.canTry(g, "pistol").why === "waves");
        g.openShop();
        await wait(30);
        const rows = $("shop-grid").querySelectorAll(".shop-forge [data-forge]");
        ok("H the shop: a row for each gun carried, the next tier and its price", rows.length === g.player.gunSlots.length && $("shop-grid").textContent.includes(T("forge.shopRow", { mk: "Mk I", price: "$" + F.priceOf(G.WEAPON_DEFS.pistol, 1).toLocaleString("en-US") })));
        const sectionsOk = $("shop-grid").querySelectorAll(".shop-section, .shop-section-title").length;
        rows[0].click();
        await wait(20);
        ok("H ...its window from there, Start ready", G.Dialog.isOpen() && !btn(0).disabled);
        G.Dialog.choose(0);
        const t0 = G.Quiz.t;
        step(1, 0.5);
        ok("H ...the test's clock runs in the shop", G.Quiz.active && G.Quiz.t > t0, (G.Quiz.t - t0).toFixed(2));
        playTest(true); G.Quiz.close();
        ok("H ...passed there: the tier, a banner (no anvil in view, no scene)", F.tierOf("pistol") === 1 && !G.ForgeScene.active);
        g.leaveShop();
        K.onlyBetweenWaves = false;
        numbers.shopSections = sectionsOk;
      }

      await wait(0); // ---------------- I: attachments at the Forge ----------------
      {
        startLevel(1);
        give("scrap_spitter");
        F.open(g, "scrap_spitter"); await wait(20);
        G.Dialog.choose(1); await wait(20);
        const save = btn(0);
        ok("I at the Forge, in a wave: the attachments window, Save works", $("dialog-title").textContent === T("att.title", { name: G.WEAPON_DEFS.scrap_spitter.name }) && save && !save.disabled);
        if ($("att-grip")) $("att-grip").value = "vgrip";
        G.Dialog.choose(0); await wait(20);
        ok("I ...saved: the gun wears it, and back to the Forge's window", G.Attach.loadoutOf(G.WEAPON_DEFS.scrap_spitter).grip === "vgrip" && G.Dialog.isOpen() && $("dialog-title").textContent === T("forge.title"));
        G.Dialog.choose(1); await wait(20);
        const cancel = [...document.querySelectorAll("#dialog-btns button")].findIndex((b) => b.hasAttribute("data-pad-back"));
        G.Dialog.choose(cancel); await wait(20);
        ok("I ...or cancelled: back to the Forge's window all the same", G.Dialog.isOpen() && $("dialog-title").textContent === T("forge.title"));
        G.Dialog.close();
        G.Attach.setAll("scrap_spitter", {});
      }

      await wait(0); // ---------------- J: the report, the languages, the flag ----------------
      {
        if (!G.Balance) await load("/tools/balance.js?v=" + Date.now());
        const md = G.Balance.run().md;
        ok("J the balance report: the Word Forge's tiers, each with its price, test and what it does", /## Word Forge tiers/.test(md) && /\| Mk I \| 1\.25 \|/.test(md) && /\| Mk II \| 1\.55 \|/.test(md) && /\| Mk III \| 1\.9 \|/.test(md) && /w20 \/ II \/ III/.test(md));
        startLevel(1);
        const langs = {};
        for (const l of ["th", "zh", "fr", "en"]) {
          await new Promise((res) => G.setUILang(l, { done: res }));
          G._missingKeys = {};
          F.open(g, "pistol"); await wait(20);
          const t = $("dialog-title").textContent, body = $("dialog-body").textContent.length;
          G.Dialog.close();
          langs[l] = { title: t, missing: Object.keys(G._missingKeys).length, body };
        }
        ok("J the window in all four languages: its own words, none missing", Object.values(langs).every((x) => !x.missing && x.body > 40) && new Set(Object.values(langs).map((x) => x.title)).size === 4, JSON.stringify(langs));
        G.CONFIG.expansion.forge = false;
        startLevel(1);
        const off = !g.world.forge && !g.world.interactables.some((i) => i.kind === "forge") && F.canTry(g, "pistol").why === "off" && F.inRunTier("pistol") === 0;
        G.CONFIG.expansion.forge = true;
        ok("J the flag off: no station, nothing forged", off);
      }

      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      G.Learning.answerWord = aw0;
      G.CONFIG.expansion.forge = true;
      K.onlyBetweenWaves = false;
      G.CONFIG.audio.gunGainDb = gainDb0; G.CONFIG.audio.gunPitch = pitch0;
      if (G.ForgeScene.active) G.ForgeScene.skip();
      I.aimDown = false;
      G.Spawner.update = spawn0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      if (G.Quiz.active) G.Quiz.reset();
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      if (G.Attach) G.Attach.apply();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
