// Dev-only (not shipped). Round 1 checks: the slot-5 bug and the Inventory
// Full flow for every way a gun arrives, the perk shop and its shuffle bag,
// the perks' effects, and Custom Vocabulary. Load it into the running game:
//   const r = await G.Round1Test.run();   r.fail -> [] when everything passes
// The save is put back afterwards.
window.G = window.G || {};
G.Round1Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Thai text built from char codes, so this file has no Thai in it
  const th = (...codes) => String.fromCharCode(...codes);
  const THAI_X = th(0x0E17, 0x0E14, 0x0E2A, 0x0E2D, 0x0E1A);          // a made-up meaning

  function freshRun(level) {
    const g = G.Game;
    g.startLevel(level || 1);
    g.update = function () {};            // stepped by hand
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;                 // the wave never ends under the test
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    G.Spawner.update = function () {};
    return g;
  }
  function fill(g, ids) { ids.forEach((id) => G.Loadout.offer(g, id, { source: "crate" })); }
  const guns4 = ["pistol", "shotgun", "smg", "rifle"];

  async function loadout() {
    const g = freshRun(1), L = G.Loadout;
    fill(g, guns4.slice(1));
    ok("A: four guns fill the four slots", g.player.gunSlots.join() === guns4.join(), g.player.gunSlots.join());
    // --- the bug: a fifth gun used to overwrite slot 5 silently ---
    const before = g.player.gunSlots.slice();
    g.openCrate("rare", null, null, { source: "drop", dropPos: g.yawObject.position.clone() });
    // make sure the crate holds a gun not already carried
    g._crateWeapon = G.weaponsForLevel(1, (w) => !w.wallExclusive && !w.boxOnly && !before.includes(w.id))[0].id;
    g.closeCrateScreen();
    ok("A1: a 5th gun no longer replaces slot 5", g.player.gunSlots.join() === before.join(), g.player.gunSlots.join());
    ok("A2: the Inventory Full window opens", G.Modal.isOpen("inventory") && !!L.pending && G.UI._currentScreen === "screen-inventory");
    ok("A2: the game is paused behind it", g.paused === true);
    const cards = document.querySelectorAll("#inv-slots .inv-slot");
    ok("A2: one card per gun, the knife never offered", cards.length === 4);
    const cmp = document.querySelectorAll("#inv-slots .inv-stat.up, #inv-slots .inv-stat.down, #inv-slots .inv-stat.same");
    ok("A2: stats compared (damage, fire rate, magazine, weight) on every card", cmp.length === 16, cmp.length);
    // keep: a zombie-dropped gun stays on the floor, no timer
    const newId = L.pending.id;
    L.keep();
    ok("A2: keep -> loadout unchanged", g.player.gunSlots.join() === before.join());
    const fgKept = g.floorGuns.find((f) => f.id === newId);
    ok("A2: keep (zombie drop) -> the new gun waits on the floor, no timer", !!fgKept && fgKept.expires === null);
    ok("A2: window closed, game resumed", !G.Modal.isOpen("inventory") && !g.paused);

    // pick it up from the floor: full -> window -> swap slot 2 (index 1)
    g.yawObject.position.x = fgKept.mesh.position.x; g.yawObject.position.z = fgKept.mesh.position.z + 0.5;
    g.updateInteractRay();
    ok("A2: standing by a floor gun shows the pick-up prompt", /pick up/i.test(document.getElementById("hud-interact-prompt").textContent), document.getElementById("hud-interact-prompt").textContent);
    g.doInteract();
    ok("A2: picking it up with full slots asks first", G.Modal.isOpen("inventory"));
    // the slot keys choose: slot 3's key replaces index 1
    const kb = G.save.settings.keybinds;
    G.onKeyDown({ code: kb.slot3, repeat: false });
    ok("A2: the slot's own key picks it", g.player.gunSlots[1] === newId, g.player.gunSlots.join());
    ok("A2: the picked-up gun is gone from the floor", !g.floorGuns.includes(fgKept));
    const dropped = g.floorGuns.find((f) => f.id === "shotgun");
    ok("A2: the swapped-out gun lies on the floor with a 30 s timer", !!dropped && dropped.expires === 30);
    ok("A2: its ammo went with it", dropped && dropped.carry && dropped.carry.ammo.mag >= 0);
    L.update(g, 29);
    ok("A2: still there at 29 s", g.floorGuns.includes(dropped));
    L.update(g, 1.5);
    ok("A2: gone after 30 s", !g.floorGuns.includes(dropped));

    // --- wall gun: asked BEFORE paying ---
    const ref = g.world.wallWeapons[0];
    g.player.money = ref.price + 50;
    const m0 = g.player.money;
    g.buyWallWeapon(ref);
    ok("A2 wall: window opens, nothing charged yet", G.Modal.isOpen("inventory") && g.player.money === m0);
    L.keep();
    ok("A2 wall: keep -> no charge, not bought, nothing dropped", g.player.money === m0 && !ref.purchased && !g.floorGuns.some((f) => f.id === ref.id));
    g.buyWallWeapon(ref);
    L.choose(3);
    ok("A2 wall: swap -> charged once, bought", g.player.money === m0 - ref.price && ref.purchased && g.player.gunSlots[3] === ref.id);

    // --- mystery box: paid, kept gun goes beside the box ---
    if (g.world.mysteryBox) {
      g.player.money = G.MYSTERY_BOX_COST + 10;
      g.openMysteryBox(); g.pickMysteryCard(0);
      const got = g._mysteryHand[0].id;
      g.confirmMysteryPick();
      const owned = g.player.gunSlots.includes(got);
      if (!owned) {
        ok("A2 box: window opens after the pick", G.Modal.isOpen("inventory") && !G.Modal.isOpen("mystery"));
        L.keep();
        const fg = g.floorGuns.find((f) => f.id === got);
        const mb = g.world.mysteryBox;
        ok("A2 box: keep -> the gun is left beside the box, no timer", !!fg && fg.expires === null && Math.hypot(fg.mesh.position.x - mb.x, fg.mesh.position.z - mb.z) < 2, fg && Math.hypot(fg.mesh.position.x - mb.x, fg.mesh.position.z - mb.z).toFixed(2));
        ok("A2 box: the $1,000 stays spent", g.player.money === 10);
      } else ok("A2 box: (dealt a gun already held -- ammo instead)", true);
    }

    // --- shop unlock: asked before paying ---
    g.openShop();
    const unlock = G.SHOP_ITEMS.find((i) => i.kind === "unlock" && !g.player.gunSlots.includes(i.weapon));
    if (unlock) {
      g.player.money = 5000;
      g.buyShopItem(unlock, G.Shop.priceFor(unlock.id, unlock.base, unlock.growth));
      ok("A2 shop: unlock with full slots asks first, no charge", G.Modal.isOpen("inventory") && g.player.money === 5000);
      L.keep();
      ok("A2 shop: keep -> no charge, back to the shop", g.player.money === 5000 && G.UI._currentScreen === "screen-shop");
    }
    g.leaveShop();

    // --- Extra Weapon Slot ---
    G.Perks.apply("extra_slot", g);
    ok("A3: Extra Weapon Slot -> 5 slots", L.maxSlots(g) === 5);
    const extra = Object.keys(G.WEAPON_DEFS).find((id) => !g.player.gunSlots.includes(id) && G.WEAPON_DEFS[id].rarity === "common");
    L.offer(g, extra, { source: "crate" });
    ok("A3: a 5th gun goes straight into the new slot", g.player.gunSlots.length === 5 && !G.Modal.isOpen("inventory"));
    G.Perks.apply("extra_slot", g);
    ok("A3: level 2 -> 6 slots, never more", L.maxSlots(g) === 6 && G.Perks.maxed("extra_slot"));
    g.switchSlot(1);
    G.onKeyDown({ code: kb.slot6, repeat: false });
    ok("A3: slot 6 key selects the 5th gun", g.player.currentSlot === 5, g.player.currentSlot);
    g.switchSlot(0);
    for (let i = 0; i < 5; i++) L.cycle(g, 1);
    ok("A3: wheel / LB-RB cycle reaches the last gun", g.player.currentSlot === 5);
    L.cycle(g, 1);
    ok("A3: ...and wraps round to the knife", g.player.currentSlot === 0);
    const hud = g.buildHudState();
    ok("A3: HUD shows knife + 5 guns + 1 empty slot", hud.slots.length === 7 && hud.slots.filter((s) => s.empty).length === 1);
    G.UI.updateHud(hud);
    ok("A3: HUD slot row drawn", document.querySelectorAll("#hud-slots .hud-slot").length === 7);
  }

  async function perks() {
    const g = freshRun(1);
    // --- shuffle bag: four a shop, no repeats back to back, all twenty per cycle ---
    G.PerkBag.reset();
    const seen = [];
    let prev = [];
    let backToBack = 0, dupInOffer = 0;
    for (let w = 0; w < 5; w++) {
      const o = G.PerkBag.draw(g.player);
      if (new Set(o).size !== o.length) dupInOffer++;
      if (o.some((id) => prev.includes(id))) backToBack++;
      prev = o; seen.push(...o);
    }
    ok("B: 4 perks per shop", prev.length === 4);
    ok("B: five shops show all 20 perks exactly once", new Set(seen).size === 20 && seen.length === 20, new Set(seen).size);
    let cycles = 0;
    for (let w = 0; w < 60; w++) {
      const o = G.PerkBag.draw(g.player);
      if (new Set(o).size !== o.length) dupInOffer++;
      if (o.some((id) => prev.includes(id))) backToBack++;
      prev = o;
    }
    ok("B: never the same perk two shops running (65 shops)", backToBack === 0, backToBack);
    ok("B: no perk twice in one offer", dupInOffer === 0);
    // cycle fairness: over 20 shops (4 cycles) every perk shown 4 times
    G.PerkBag.reset();
    const count = {};
    for (let w = 0; w < 20; w++) G.PerkBag.draw(g.player).forEach((id) => { count[id] = (count[id] || 0) + 1; });
    ok("B: over 20 shops every perk comes up exactly 4 times", Object.values(count).every((n) => n === 4) && Object.keys(count).length === 20, JSON.stringify(Object.values(count)));
    // maxed perks drop out
    G.PerkBag.reset();
    ["perk_speed", "perk_speed", "marksman"].forEach((id) => G.Perks.apply(id, g));
    let offeredMaxed = 0;
    for (let w = 0; w < 30; w++) G.PerkBag.draw(g.player).forEach((id) => { if (id === "perk_speed" || id === "marksman") offeredMaxed++; });
    ok("B: a maxed perk is never offered", offeredMaxed === 0);

    // --- the shop screen ---
    g.player.money = 99999;
    g.openShop();
    const sections = Array.from(document.querySelectorAll("#shop-grid .shop-section")).map((s) => s.textContent);
    ok("B: shop has Always Available / Perks This Wave / Armory", sections.length === 3, sections.join(" | "));
    const essentials = G.SHOP_ITEMS.filter((i) => i.section === "essential").map((i) => i.label);
    ok("B: Full Health and Full Ammo always on sale", essentials.join() === [G.T("shopItem.heal"), G.T("shopItem.ammo_refill")].join());
    ok("B: 4 perk cards", document.querySelectorAll("#shop-grid .shop-perk").length === 4);
    // price goes up with each level
    const pid = g._perkOffer.find((id) => G.PERK_BY_ID[id].max > 1);
    if (pid) {
      const p1 = G.Perks.price(pid); g.buyPerk(pid); const p2 = G.Perks.price(pid);
      ok("B: a multi-level perk costs more at the next level", p2 > p1, p1 + " -> " + p2);
    }
    // Full Ammo fills every gun
    fill(g, ["shotgun"]);
    g.player.ammo.pistol = { mag: 0, reserve: 0 }; g.player.ammo.shotgun = { mag: 1, reserve: 2 };
    g.buyShopItem(G.SHOP_ITEMS.find((i) => i.id === "ammo_refill"), 1);
    ok("B: Full Ammo fills every gun's magazine and reserve", g.player.ammo.pistol.mag === G.WEAPON_DEFS.pistol.magSize && g.player.ammo.shotgun.reserve >= G.WEAPON_DEFS.shotgun.magSize * 4);
    g.player.hp = 10;
    g.buyShopItem(G.SHOP_ITEMS.find((i) => i.id === "heal"), 1);
    ok("B: Full Health", g.player.hp === g.player.maxHp);
    g.leaveShop();

    // --- effects ---
    const g2 = freshRun(1), P = G.Perks, pl = g2.player;
    pl.hp = pl.maxHp = 450;
    const mkZ = (pair, target) => {
      const z = g2.spawnZombieAt("normal", g2.yawObject.position.clone().add(new THREE.Vector3(3, -1.7, 0)));
      z.word = pair[0]; z.meaning = pair[1];
      if (target) g2.targetPair = [z.word, z.meaning];
      return z;
    };
    const killTarget = (pair) => { const z = mkZ(pair, true); z.alive = false; g2.onZombieDeath(z); };
    const killWrong = () => { const z = mkZ(["zzzwrong", THAI_X], false); g2.targetPair = ["other", "x"]; z.alive = false; g2.onZombieDeath(z); };
    // Hint Reader
    P.apply("perk_hint", g2); P.apply("perk_hint", g2);
    g2.targetPair = ["abandon", G.WORDS_LEVEL_1[0][1]];
    ok("perk Hint Reader L2: first letter and length", /"A", 7 letters/.test(g2.buildHudState().currentMeaning), g2.buildHudState().currentMeaning);
    // Focus Time
    P.apply("focus_time", g2);
    killTarget(["alpha", THAI_X]);
    ok("perk Focus Time: a right answer slows the zombies", g2._slowmoT === 1.5);
    // Combo Shield
    P.apply("combo_shield", g2);
    pl.combo = 6;
    killWrong();
    ok("perk Combo Shield: a wrong answer keeps the combo", pl.combo === 6 && !pl.comboShield.charged);
    for (let i = 0; i < 5; i++) killTarget(["beta" + "abcde"[i], THAI_X]);
    ok("perk Combo Shield: recharged after 5 right answers", pl.comboShield.charged);
    killWrong(); killWrong();
    ok("perk Combo Shield: only one wrong answer is forgiven", pl.combo === 0);
    // Big Word Bounty
    const payFor = (word) => { const m = pl.money; pl.combo = 0; killTarget([word, THAI_X]); return pl.money - m; };
    const plainLong = payFor("comprehensive");
    P.apply("word_bounty", g2);
    const bountyLong = payFor("comprehensive");
    ok("perk Big Word Bounty: hard (long) words pay 75% more", Math.abs(bountyLong / plainLong - 1.75) < 0.05, plainLong + " -> " + bountyLong);
    // Bloodthirst
    P.apply("bloodthirst", g2);
    pl.hp = 100; killTarget(["gamma", THAI_X]);
    ok("perk Bloodthirst: a right kill heals 30", pl.hp === 130, pl.hp);
    // Extra Time
    P.apply("extra_time", g2);
    // (vocabulary series, round 3: a Thai -> English question, which has no extra time of its own)
    g2.startWordChallenge("t", () => {}, () => {}, { type: "th2en" });
    ok("perk Extra Time: word questions get 12 s", g2.challenge.timeLimit === 12);
    g2.answerChallengeAs(true);
    // Second Life
    P.apply("second_life", g2);
    pl.hp = -5; g2.checkPlayerDeath();
    ok("perk Second Life: a fatal blow leaves 25% health", g2.state === "GAMEPLAY" && Math.round(pl.hp) === Math.round(pl.maxHp * 0.25), pl.hp);
    // Thorns + Riot Gear on a bite
    P.apply("thorns", g2); P.apply("perk_armor", g2);
    const biter = mkZ(["delta", THAI_X], false);
    biter.mesh.position.set(g2.yawObject.position.x + 0.8, g2.yawObject.position.y - 1.7, g2.yawObject.position.z);
    biter.attackCooldown = 0; biter.hp = 500;
    const hp0 = pl.hp, zx0 = biter.mesh.position.x;
    g2.updateZombies(1 / 60);
    ok("perk Thorns: the biter takes 60 and is thrown back", biter.hp <= 440 && biter.mesh.position.x > zx0 + 0.5, biter.hp + " / moved " + (biter.mesh.position.x - zx0).toFixed(2));
    ok("perk Riot Gear: bites do 12% less", Math.abs((hp0 - pl.hp) - biter.damage * 0.88) < 0.01, (hp0 - pl.hp).toFixed(1));
    // Last Round
    let seenDmg = [];
    const realRay = g2.raycastShoot;
    g2.raycastShoot = function (o, d, dmg) { seenDmg.push(dmg); return false; };
    P.apply("last_round", g2);
    g2.switchSlot(1); g2.player.ammo.pistol.mag = 2; g2.player.fireCooldown = 0; g2.fireWeapon();
    g2.player.fireCooldown = 0; g2.player.reloading = false; g2.fireWeapon();
    ok("perk Last Round: the last round hits 3x", seenDmg.length === 2 && Math.abs(seenDmg[1] / seenDmg[0] - 3) < 1e-6, seenDmg.join(","));
    g2.raycastShoot = realRay;
    // Quick Hands: reload time
    const reloadTime = () => {
      g2.updateShooting(0);                // settle the view model on the pistol first
      g2.weaponAnim.switchT = 0;
      g2.player.reloading = false; g2.reloadState = null;
      g2.player.ammo.pistol = { mag: 0, reserve: 50 }; g2.weaponAnim.switchT = 0;
      g2.reload();
      let t = 0; while (g2.player.reloading && t < 10) { g2.updateShooting(1 / 60); t += 1 / 60; }
      return t;
    };
    const tNo = reloadTime();
    P.apply("quick_hands", g2);
    const tQuick = reloadTime();
    ok("perk Quick Hands: reload 35% faster", Math.abs(tNo / tQuick - 1.35) < 0.06, tNo.toFixed(2) + " -> " + tQuick.toFixed(2));
    // Savings Account
    P.apply("interest", g2);
    pl.money = 1000; g2.openShop();
    ok("perk Savings Account: 10% of 1000 at the shop", pl.money === 1100, pl.money);
    g2.leaveShop();
    // every perk to its max, then a few simulated seconds: nothing throws
    G.PERKS.forEach((d) => { while (!P.maxed(d.id)) P.apply(d.id, g2); });
    let threw = null;
    try {
      g2.update = G.Game.__realUpdate || g2.update;
      for (let i = 0; i < 120; i++) { g2.updatePlayerMovement(1 / 60); g2.updateShooting(1 / 60); g2.updateZombies(1 / 60); G.UI.updateHud(g2.buildHudState()); }
    } catch (e) { threw = e.message; }
    ok("B: every perk maxed, 2 s of play, no errors", !threw, threw || "");
    G.UI.updateHud(g2.buildHudState());
    ok("B: HUD perk icons (20)", document.querySelectorAll("#hud-perks .hud-perk").length === 20);
    g2.state = "GAMEPLAY"; g2.pause();
    const pp = document.querySelectorAll("#pause-perks .pause-perk");
    pp[3] && pp[3].click();
    ok("B: pause menu lists the perks and explains one on tap", pp.length === 20 && document.getElementById("pause-perk-detail").textContent.length > 20);
    g2.resume();
  }

  async function vocab() {
    const CV = G.CustomVocab;
    G.save.customWords = { level1: [], level2: [], level3: [] };
    const firstEn = G.WORDS_LEVEL_1[0][0], abandonTh = G.WORDS_LEVEL_1[0][1];   // the school list's first word (word bank)
    let r = CV.save("  Serendipity ", "  " + THAI_X + "  ", "level1");
    ok("C: a valid word is saved, trimmed", r.ok && CV.list("level1")[0][0] === "Serendipity" && CV.list("level1")[0][1] === THAI_X);
    r = CV.save(firstEn.toUpperCase(), THAI_X, "level3");
    ok("C: a built-in word (any case, any level) is refused", !r.ok && r.error === "cv.errDup" && r.dupWhere.key === "level1" && !r.dupWhere.custom);
    r = CV.save("serendipity", THAI_X, "level2");
    ok("C: a word already added elsewhere is refused and says where", !r.ok && r.dupWhere.key === "level1" && r.dupWhere.custom);
    ok("C: empty fields refused", CV.save("", THAI_X, "level1").error === "cv.errEmpty" && CV.save("word", "   ", "level1").error === "cv.errEmpty");
    ok("C: non-letters refused", CV.save("abc1", THAI_X, "level1").error === "cv.errLetters.en" && CV.save("hello!", THAI_X, "level1").error === "cv.errLetters.en");   // (round 3: by language)
    ok("C: hyphen / space between letters allowed", CV.save("long-winded", THAI_X + "1", "level2").ok && CV.save("give up", THAI_X + "2", "level2").ok);
    ok("C: meaning must be Thai", CV.save("zebra", "a horse", "level1").error === "cv.errMeaning.th");   // (round 3: by language)
    r = CV.save("forsake", abandonTh, "level1");
    ok("C: same meaning as another word in the level -> saved with a warning", r.ok && r.warnSame.includes(firstEn), JSON.stringify(r.warnSame));
    // edit / delete
    r = CV.save("Serendipitous", THAI_X, "level1", { key: "level1", index: 0 });
    ok("C: edit in place", r.ok && CV.list("level1")[0][0] === "Serendipitous" && CV.list("level1").length === 2);
    r = CV.save(firstEn, THAI_X, "level1", { key: "level1", index: 0 });
    ok("C: an edit can't create a duplicate", !r.ok);
    CV.remove("level1", 0);
    ok("C: delete", CV.list("level1").length === 1 && CV.list("level1")[0][0] === "forsake");
    // import
    const res = CV.importPairs([["quixotic", THAI_X], [firstEn[0].toUpperCase() + firstEn.slice(1), THAI_X], ["quixotic", THAI_X], ["bad1", THAI_X], ["lucid", ""], ["forsake", THAI_X], ["zealous", THAI_X]], "level2");
    ok("C: CSV import adds the new words", res.added.join() === "quixotic,zealous", res.added.join());
    ok("C: CSV import leaves out duplicates, and says where", res.dupes.length === 3 && res.dupes.some((d) => d.en.toLowerCase() === firstEn && d.key === "level1") && res.dupes.some((d) => d.en === "quixotic" && d.key === null), JSON.stringify(res.dupes));
    ok("C: CSV import leaves out broken rows", res.invalid.length === 2);
    // the level's list, the run, the save
    ok("C: custom words join the level's word list", G.WORD_SETS.level1.words.some((p) => p[0] === "forsake") && G.WORD_SETS.level1.words.length === G.WORDS_LEVEL_1.length + 1);
    const g = freshRun(1);
    ok("C: ... and the run's word pool", g.wordPool.some((p) => p[0] === "forsake"));
    // never two zombies with the same meaning on the field
    g.wordPool = [[firstEn, abandonTh], ["forsake", abandonTh], ["alpha", THAI_X + "a"], ["beta", THAI_X + "b"]];
    let clash = 0;
    for (let k = 0; k < 40; k++) {
      g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
      for (let i = 0; i < 3; i++) g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(4 + i, -1.7, 0)));
      const ms = g.zombies.map((z) => z.meaning);
      if (new Set(ms).size !== ms.length) clash++;
    }
    ok("C: two zombies with the same meaning never on the field together (40 tries)", clash === 0, clash);
    const snap = JSON.parse(JSON.stringify(G.save));
    const norm = G.normalizeSave(Object.assign(snap, { customWords: { level1: [["ok", THAI_X], [1, 2], "junk"], level9: [["x", "y"]] } }));
    ok("C: saves are cleaned on load/import", norm.customWords.level1.length === 1 && !norm.customWords.level9 && Array.isArray(norm.customWords.level3));
    ok("C: custom words are in the save that Export Save writes", Array.isArray(G.save.customWords.level2) && G.save.customWords.level2.length === 4);

    // the page itself
    g.quitToMainMenu();
    // (round 4: Custom Vocabulary is a card in the lobby's second tab)
    G.Lobby.open({ tab: "training", select: "custom" }); G.Lobby.launch();
    await wait(700);
    ok("C: the page opens from the main menu", G.UI._currentScreen === "screen-customvocab");
    document.getElementById("cv-en").value = "Luminous"; document.getElementById("cv-th").value = THAI_X; document.getElementById("cv-level").value = "level3";
    document.getElementById("cv-save").click();
    ok("C: form: added, list shows it", /Luminous/.test(document.getElementById("cv-msg").textContent) && /Luminous/.test(document.getElementById("cv-list").textContent));
    document.getElementById("cv-en").value = "luminous"; document.getElementById("cv-th").value = THAI_X;
    document.getElementById("cv-save").click();
    ok("C: form: a duplicate shows where it already is", document.getElementById("cv-msg").classList.contains("error") && /Underground Bunker/.test(document.getElementById("cv-msg").textContent), document.getElementById("cv-msg").textContent);
    const del = document.querySelector("#cv-list button[data-act=del]");
    del.click();
    const armed = document.querySelector("#cv-list button[data-act=del]");
    ok("C: form: delete asks for a second tap", armed.classList.contains("danger"));
    armed.click();
    ok("C: form: second tap deletes", CV.list("level3").length === 0);
    // from Settings
    G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings");
    document.getElementById("btn-settings-customvocab").click();
    await wait(200);
    ok("C: reachable from Settings", G.UI._currentScreen === "screen-customvocab" && G.CustomVocabUI.returnTo === "screen-settings");
    document.getElementById("btn-cv-back").click();
    await wait(200);
    ok("C: Back returns to Settings", G.UI._currentScreen === "screen-settings");
    // the import page, into a level
    G.UI.openImport("screen-customvocab", "level2");
    G.UI._pendingImport = { name: "t", words: [["ephemeral", THAI_X], [firstEn, THAI_X], ["x2", THAI_X]] };
    G.UI.el("btn-import-save").disabled = false;
    G.UI.saveImportedSet();
    const sum = document.getElementById("import-summary").textContent;
    ok("C: import summary: added count, duplicates with their level, broken rows", /Words added to Abandoned Hospital: 1/.test(sum) && new RegExp(firstEn + " \\(already in Abandoned School\\)").test(sum) && /x2/.test(sum), sum);
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save);
    const realSpawner = G.Spawner.update, realUpdate = G.Game.update;
    G.Game.__realUpdate = realUpdate;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    try {
      await loadout();
      await perks();
      await vocab();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Spawner.update = realSpawner; G.Game.update = realUpdate;
      G.Modal.reset();
      G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
