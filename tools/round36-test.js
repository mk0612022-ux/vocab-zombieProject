// Dev-only (not shipped). The expansion's round 7: the Training Yard and the situation tips.
//   A  the data: the practice words (four languages, none twice), their pairs in
//      every pair of languages, the level, the config, the flags
//   B  the place: built small and quick, its rooms, doors, the gun on the wall,
//      the way round for the zombies, no story, the morning's look
//   C  the steps, played through one by one -- look, run, shoot by meaning (a
//      wrong one explained), aim and reload, switch and the knife, money and the
//      wall gun, the doors (a word door), the HUD's tour, the drill, the quiz and
//      a perk, the cards -- each only after the last; the hint after 20 s
//   D  never counted: no box, no statistics, no confusion, no cause kept; back
//      in a level, counted again
//   E  the checkpoint: every step saved, picked up there with what came before,
//      Continue or Start over; nothing ends the run
//   F  the pause menu's Skip; the save remembers it
//   G  what to press, by device (keys, controller, touch -- the touch buttons
//      lit); Reduce Motion; the text size
//   H  the first-time offer: a new player once (Skip, Languages, Play); an old
//      one never; from Help, the lobby's card, Settings
//   I  the tips: each once, what brings each one on, the card that does not
//      stop the game (put away under a window), Got it / Don't show (H / N),
//      none in the Training Yard, Settings > Tips
//   J  the save (an old save, the merge, the sections); four languages; the flags off
// Load it into the game (in the lobby), then:
//   const r = await G.Round36Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round36Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t36 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, TY = G.TrainingYard, GT = G.GameTips, C = G.CONFIG.training, T = (k, v) => G.T(k, v), $ = (id) => document.getElementById(id);
    const V3 = THREE.Vector3;
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock;
    const real = g._update0 || g.update, uir0 = g.updateInteractRay;
    const I = G.Input;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const yield0 = () => wait(0);
    const startTraining = (s) => {
      g.update = real;
      g.startTraining(s || 0);
      g.update = () => {};
      G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY";
      I.clearHeldInputs();
      step(2);
    };
    const startLevel = (lv) => {
      g.update = real;
      g.startLevel(lv);
      G.Spawner.update = () => {};
      g.update = () => {};
      G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY";
      g.player.hp = g.player.maxHp = 1e6; g.requiredKills = 1e9; g.clearZombies();
      I.clearHeldInputs();
      if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
      step(3);
    };
    const look = (x, z, tx, tz) => { g.teleportPlayer(new V3(x, 0, z)); g.yawObject.rotation.y = Math.atan2(-(tx - x), -(tz - z)); g.pitchObject.rotation.x = 0; step(1); };
    const stepId = () => (TY.run ? TY.STEPS[TY.run.i] : null);
    const until = (fn, n) => { for (let i = 0; i < (n || 600) && !fn(); i++) step(1); return fn(); };
    const snapLearn = () => JSON.stringify({ srs: G.save.learn.srs, conf: G.save.learn.conf, why: G.save.learn.why, skills: G.save.learn.skills, act: G.save.learn.activity, ws: G.save.wordStats });
    const kb = () => G.save.settings.keybinds;
    const key = (code) => G.onKeyDown({ code, preventDefault() {}, repeat: false });

    try {
      // ================= A: the data =================
      {
        const W = G.PRACTICE_WORDS || [];
        const langs = ["en", "th", "zh", "fr"];
        const full = W.length >= 12 && W.every((e) => langs.every((l) => typeof e[l] === "string" && e[l].trim()) && typeof e.py === "string" && e.py.trim());
        const unique = langs.every((l) => new Set(W.map((e) => e[l].toLowerCase())).size === W.length);
        ok("A the practice words: " + W.length + " everyday nouns, each in the four languages (pinyin for the Chinese), none twice in a language", full && unique);
        const bank = new Set(G.getAllBuiltinWords().map((p) => G.wordKey(p)));
        ok("A ...none of them a word of the bank (nothing here is ever asked in a level)", W.every((e) => !bank.has(e.en.toLowerCase())), W.filter((e) => bank.has(e.en.toLowerCase())).map((e) => e.en).join());
        const s0 = Object.assign({}, G.save.settings), combos = [["en", "th"], ["th", "en"], ["zh", "fr"], ["fr", "zh"], ["en", "zh"]];
        const okPairs = combos.every(([w, m]) => {
          G.save.settings.wordLang = w; G.save.settings.meaningLang = m;
          const P = TY.pairs();
          return P.length === W.length && P.every((p, i) => p[0] === W[i][w] && p[1] === W[i][m] && p.wl === w && p.ml === m && p.practice && (w !== "zh" || p.pyW === W[i].py) && (m !== "zh" || p.pyM === W[i].py));
        });
        G.save.settings.wordLang = s0.wordLang; G.save.settings.meaningLang = s0.meaningLang;
        ok("A ...as pairs in any Word and Meaning Language (the languages and the pinyin carried, no entry id)", okPairs);
        const L = TY.level();
        ok("A the level: theme training, one wave, its own name", L.theme === "training" && L.waves === 1 && L.name === T("train.title") && !G.LEVELS.some((l) => l.theme === "training"));
        ok("A the config: hint after 20 s, three right shots, the drill (5 Shamblers, a Crawler), a 3-question quiz", C.hintAfter === 20 && C.targets === 3 && C.wave.normal === 5 && C.wave.crawler === 1 && C.quiz === 3);
        ok("A the flags: expansion.trainingYard and expansion.tips, both on", G.CONFIG.expansion.trainingYard === true && G.CONFIG.expansion.tips === true);
        ok("A the dummy: a zombie kind that stands still and never bites", G.ZOMBIE_TYPES.dummy && G.ZOMBIE_TYPES.dummy.speed === 0 && G.ZOMBIE_TYPES.dummy.damage === 0);
        await yield0();
      }

      // ================= B: the place =================
      let learn0;
      {
        G.save.learn = G.Learning.normalize({}); G.save.wordStats = {};
        learn0 = snapLearn();
        const t0 = performance.now();
        startTraining(0);
        numbers.buildMs = Math.round(performance.now() - t0);
        const W = g.world;
        ok("B the Training Yard: a training run, its words the practice set, step 1", g.mode === "training" && g.level.theme === "training" && g.wordPool.length === G.PRACTICE_WORDS.length && g.wordPool.every((p) => p.practice) && stepId() === "look");
        ok("B ...built in " + numbers.buildMs + " ms (the School takes far longer)", numbers.buildMs > 0);
        const names = W.regions.map((r) => r.name).sort().join();
        ok("B a yard, a corridor and a classroom (and the corner by the word door)", names === "CORR,ROOM,YARD,YARD2", names);
        const E = W.waypointEdges;
        ok("B ...joined for the zombies: yard to corridor, corridor to classroom through its door, classroom to the yard through the word door", E.YARD.includes("DENT") && E.DENT.includes("CORR") && E.CORR.includes("DROOM") && E.DROOM.includes("ROOM") && E.ROOM.includes("DWORD") && E.DWORD.includes("YARD2"));
        ok("B a door to open (E) and a word door", !!W.trainRoomDoor && W.roomDoors.includes(W.trainRoomDoor) && !!W.trainWordDoor && W.trainWordDoor.kind === "word" && W.interactables.some((i) => i.kind === "door" && i.ref === W.trainWordDoor));
        ok("B the gun on the corridor wall: " + C.wallGun, W.wallWeapons.length === 1 && W.wallWeapons[0].id === C.wallGun && W.interactables.some((i) => i.kind === "wallweapon"));
        ok("B the start: the yard's far end, looking at the building", Math.abs(g.yawObject.position.z - 32) < 0.1 && Math.abs(g.yawObject.position.x) < 0.1);
        ok("B no story here: no notes, no floors to open, no Word Forge", !(W.notes && W.notes.length) && !g.world.interactables.some((i) => i.kind === "note" || i.kind === "forge" || i.kind === "gate3") && !W.secondFloor && !W.thirdFloor);
        const pal = G.THEME_PALETTES.training, grade = G.VISUAL.themeGrade.training;
        const lum = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
        ok("B a calm morning: a pale haze far off, warm light, no navy in the shadows", lum(pal.fog) > 0.6 && pal.fogFar >= 100 && grade.lift < 0.1 && !!W.sun && W.sun.isDirectionalLight);
        ok("B no zombies come on their own (no spawner here)", g.zombies.length === 0 && (step(120), g.zombies.length === 0));
        ok("B the panel: the step, its title, what to do -- and the HUD's header says Training Yard, step 1 of 11", !$("hud-train").classList.contains("hidden") && $("htr-title").textContent === T("train.look.title") && $("hud-level-name").textContent === T("train.title") && $("hud-level-wave").textContent === T("train.stepOf", { i: 1, n: 11 }));
        await yield0();
      }

      // ================= C: the steps =================
      {
        const order = [];
        G.Bus.on("training:step", (e) => order.push(e.id), "t36");
        // 1 look: turning alone or the ring alone is not enough
        look(0, 26.6, 0, 25);
        for (let i = 0; i < 40; i++) { g.yawObject.rotation.y += 0.02; step(1); }
        ok("C1 look: a little turning is not enough", stepId() === "look");
        for (let i = 0; i < 80; i++) { g.yawObject.rotation.y += 0.04; step(1); }
        ok("C1 ...turned round, still not on the ring", stepId() === "look" && TY.run.turn > C.lookTurn * Math.PI / 180);
        look(0, 25, 0, 20);
        step(2);
        ok("C1 ...and on the ring: step 2", stepId() === "sprint");
        // 2 run: walking there is not enough
        look(0, 11.2, 0, 5);
        step(3);
        ok("C2 run: walking onto the ring is not enough", stepId() === "sprint");
        look(0, 22, 0, 5);
        const K = kb();
        I.keys[K.forward] = true; I.keys[K.sprint] = true;
        const st0 = g.stamina;
        until(() => stepId() !== "sprint", 900);
        I.keys[K.forward] = false; I.keys[K.sprint] = false;
        ok("C2 ...run there (stamina used): step 3", stepId() === "shoot" && g.stamina < st0, "stamina " + Math.round(st0) + " -> " + Math.round(g.stamina));
        await yield0();
        // 3 shoot by meaning
        step(70);
        const dummies = () => g.zombies.filter((z) => z.alive && z.type === "dummy");
        const D = dummies();
        ok("C3 shoot: three straw dummies at the range, each with a practice word, one of them the target", D.length === 3 && D.every((z) => z.pair && z.pair.practice && z.speed === 0 && z.damage === 0) && !!g.targetPair && D.some((z) => z.word === g.targetPair[0]));
        ok("C3 ...the box at the top shows the target's meaning", $("hud-meaning").textContent.indexOf(g.targetPair[1]) === 0);
        const mesh = D[0].mesh.userData;
        ok("C3 ...a dummy: head and body hitboxes, its word over it, no limbs to animate", mesh.kind === "dummy" && D[0].hitboxes.some((h) => h.userData.hit === "head") && D[0].hitboxes.some((h) => h.userData.hit === "body") && !mesh.limbs && D[0].sprite.visible);
        // a wrong one first: explained, nothing counted
        const wrongZ = D.find((z) => z.word !== g.targetPair[0]);
        const k0 = g.correctKills;
        g.damageZombie(wrongZ, 999, wrongZ.mesh.position.clone(), { dir: null, head: false });
        step(2);
        ok("C3 ...a wrong one: no right shot, and the card under the word box explains both words", g.correctKills === k0 && !$("hud-xcard").classList.contains("hidden") && $("hud-xcard").textContent.length > 4, $("hud-xcard").textContent.slice(0, 80));
        let shots = 0;
        for (let i = 0; i < 12 && stepId() === "shoot"; i++) {
          step(70);
          const tz = dummies().find((z) => g.targetPair && z.word === g.targetPair[0]);
          if (tz) { g.damageZombie(tz, 999, tz.mesh.position.clone(), { dir: null, head: false }); shots++; }
          step(2);
        }
        ok("C3 ...three right shots: step 4 (the dummies cleared away)", stepId() === "aim" && shots === C.targets, "shots " + shots);
        await yield0();
        // 4 aim and reload
        const id = g.currentWeaponId(), a = g.player.ammo[id];
        ok("C4 aim: the magazine has room in it (or there is nothing to reload)", a.mag < Math.round(G.WEAPON_DEFS[id].magSize * g.player.weaponLevels[id].mag));
        I.aimDown = true;
        step(70);
        ok("C4 ...aimed for a while: not done before the reload", stepId() === "aim" && TY.run.aimT >= C.aimSeconds);
        I.aimDown = false;
        g.reload();
        until(() => stepId() !== "aim", 300);
        ok("C4 ...reloaded: step 5", stepId() === "switch");
        await yield0();
        // 5 switch and the knife
        ok("C5 switch: a shotgun given into the next gun slot", g.player.gunSlots.indexOf("shotgun") === 1);
        g.switchSlot(2); step(60);
        g.switchSlot(1); step(60);
        ok("C5 ...to the shotgun and back: still the knife to go", stepId() === "switch" && TY.run.sg && TY.run.back && !TY.run.knife);
        const td = g.zombies.find((z) => z.alive && z.type === "dummy");
        ok("C5 ...the knife's dummy: beside the player, no word to shoot, not the target", !!td && td.decoy && !td.sprite.visible && !g.targetPair);
        look(td.mesh.position.x, td.mesh.position.z + 1.15, td.mesh.position.x, td.mesh.position.z);
        G.onMeleePress();
        until(() => stepId() !== "switch", 200);
        ok("C5 ...hit with the knife (it stays standing, rocks on its post): step 6", stepId() === "money" && (td.alive === false || td.hp > 1000));
        await yield0();
        // 6 money and the wall gun
        const drops = g.drops.filter((d) => d.kind === "money"), each = TY.moneyEach(g), wg = g.world.wallWeapons[0];
        ok("C6 money: " + C.money.bundles + " bundles on the way in, the savings at 0, together enough for the wall gun as the stat sheet prices it ($" + wg.price + ")", drops.length === C.money.bundles && g.player.money === 0 && drops.every((d) => d.amount === each) && each * C.money.bundles >= wg.price);
        drops.forEach((d) => { look(d.mesh.position.x, d.mesh.position.z + 0.2, d.mesh.position.x, d.mesh.position.z - 3); step(2); });
        ok("C6 ...picked up: $" + C.money.bundles * each, g.player.money === C.money.bundles * each && !g.drops.some((d) => d.kind === "money"));
        look(-1.3, -3.5, -3, -3.5);
        g.updateInteractRay();
        ok("C6 ...looking at the gun on the wall: its prompt", g._lookedAtInteractable && g._lookedAtInteractable.kind === "wallweapon");
        g.doInteract(); step(2);
        ok("C6 ...bought: in the next slot, the money spent: step 7", wg.purchased && g.player.gunSlots.includes(C.wallGun) && stepId() === "doors", "money " + g.player.money);
        await yield0();
        // 7 the doors
        const rd = g.world.trainRoomDoor, wd = g.world.trainWordDoor;
        look(1.6, -10, 3, -10);
        g.updateInteractRay(); g.doInteract(); step(40);
        ok("C7 doors: the classroom's opened (E)", rd.open && stepId() === "doors");
        look(11, -5.4, 11, -4);
        g.updateInteractRay();
        ok("C7 ...the word door: its prompt", g._lookedAtInteractable && g._lookedAtInteractable.kind === "door");
        const before = snapLearn();
        g.doInteract();
        ok("C7 ...asks a practice word", !!g.challenge && g.challenge.pair.practice);
        g.answerChallengeAs(true); step(40);
        ok("C7 ...answered: open, nothing counted: step 8", wd.opened && stepId() === "hud" && snapLearn() === before);
        await yield0();
        // 8 the HUD's tour
        step(50);
        ok("C8 the HUD's tour: a window that holds the game, the panel out of the way", G.Modal.isOpen("train-tour") && !$("train-tour").classList.contains("hidden") && $("hud-train").classList.contains("hidden"));
        const lit = [];
        for (let i = 0; i < 5; i++) {
          const sp = $("tt-spot").getBoundingClientRect();
          lit.push([$("tt-title").textContent, Math.round(sp.width)]);
          if (i < 4) key("Enter");
        }
        const hpR = $("hud-hp").getBoundingClientRect();
        ok("C8 ...five stops (health, stamina, the slots, the panel on the right, the wave bar), each lit round its part", lit.length === 5 && new Set(lit.map((x) => x[0])).size === 5 && lit.every((x) => x[1] > 20), JSON.stringify(lit) + " hp " + Math.round(hpR.width));
        key("Enter"); step(3);
        ok("C8 ...done: step 9", !G.Modal.isOpen("train-tour") && stepId() === "wave");
        await yield0();
        // 9 the drill
        step(30);
        ok("C9 the drill waits for the player to come out to the yard", !g.zombies.some((z) => z.alive));
        look(9, 3, 9, 20);
        step(5);
        const Z = g.zombies.filter((z) => z.alive);
        ok("C9 ...out: five Shamblers and a Crawler, bites at half", Z.filter((z) => z.type === "normal").length === C.wave.normal && Z.filter((z) => z.type === "crawler").length === C.wave.crawler && Z.every((z) => z.damage === G.ZOMBIE_TYPES[z.type].damage * C.waveDamage));
        ok("C9 ...the header counts them down", $("hud-zombies-left").textContent.indexOf(String(Z.length)) >= 0, $("hud-zombies-left").textContent);
        // nothing ends a run here
        g.player.hp = 1; g.player.hp -= 50; g.checkPlayerDeath();
        ok("C9 ...a blow that would kill: a little health left, no game over", g.state === "GAMEPLAY" && g.player.hp >= g.player.maxHp * C.floorHp - 1);
        g.player.hp = g.player.maxHp;
        for (let i = 0; i < 20 && stepId() === "wave"; i++) {
          const tz = g.zombies.find((z) => z.alive && g.targetPair && z.word === g.targetPair[0]);
          if (tz) g.damageZombie(tz, 9999, tz.mesh.position.clone(), { dir: null, head: false });
          step(20);
        }
        ok("C9 ...all down: step 10", stepId() === "quiz");
        await yield0();
        // 10 the quiz and a perk
        step(80);
        ok("C10 the quiz: three questions on the practice words", G.Quiz.active && G.Quiz.qs.length === C.quiz && G.Quiz.qs.every((q) => q.pair.practice) && $("quiz-kicker").textContent === T("train.quizKicker"));
        const lq = snapLearn();
        for (let i = 0; i < 6 && G.Quiz.active && G.Quiz.stage !== "result"; i++) { G.Quiz.answerAs(i !== 1); if (G.Quiz.stage === "feedback") G.Quiz.next(); }
        ok("C10 ...answered (one wrong): nothing counted, its summary", G.Quiz.stage === "result" && snapLearn() === lq && $("quiz-verdict").textContent === T("train.quizDone"));
        G.Quiz.close();
        ok("C10 ...then the shop: no time limit, money for a perk, the training's note", g.state === "SHOP" && g.shopTimer === Infinity && g.player.money >= C.perkMoney && !$("shop-tip").classList.contains("hidden"));
        const perk = g._perkOffer.find((p) => G.Perks.price(p) <= g.player.money) || g._perkOffer[0];
        g.buyPerk(perk);
        g.leaveShop(); step(3);
        ok("C10 ...a perk bought, the shop left: step 11", Object.keys(g.player.perks).length >= 1 && stepId() === "cards" && g.state === "GAMEPLAY");
        await yield0();
        // 11 the cards, the end
        step(40);
        const cards = [];
        for (let i = 0; i < 6 && G.Dialog.isOpen() && cards.length < 5; i++) { cards.push($("dialog-title").textContent); G.Dialog.choose(1); }
        ok("C11 the cards: the Word Forge, attachments and skins, Daily Review, the word log, reports", cards.length === 5 && cards[0] === T("train.card.forge.title") && cards[4] === T("train.card.report.title"), cards.join(" | "));
        step(3);
        ok("C11 ...then done: the finish window, the save marks it done (no checkpoint left)", G.Dialog.isOpen() && $("dialog-title").textContent === T("train.done.title") && G.save.training.done && G.save.training.step === 0 && G.save.training.offered);
        ok("C the steps came in order, each once", order.join() === TY.STEPS.slice(1).join(), order.join());
        G.Dialog.choose(0); step(2);
        ok("C ...Main menu: out of the yard", g.state === "MENU");
        G.Bus.off("t36");
        await yield0();
      }

      // ================= D: never counted =================
      {
        ok("D the whole yard played: no box, no word statistic, no confused pair, no cause, no activity", snapLearn() === learn0);
        startLevel(1);
        const p = g.wordPool[0];
        G.Learning.answerWord(p, true, {});
        ok("D ...in a level, an answer is counted again", !!G.save.wordStats[G.wordKey(p)] && !!G.save.learn.srs[G.wordKey(p)]);
        g.quitToMainMenu();
        await yield0();
      }

      // ================= E: the checkpoint =================
      {
        G.save.training = { done: false, skipped: false, step: 0, offered: true, finishedAt: 0 };
        startTraining(0);
        TY.goTo(3); step(2);
        ok("E every step saved as it starts", G.save.training.step === 3);
        g.quitToMainMenu();
        ok("E ...left half-way: the step kept", G.save.training.step === 3 && !G.save.training.done);
        TY.open();
        ok("E ...from a menu: Continue (step 4 of 11) or Start over", G.Dialog.isOpen() && $("dialog-text").textContent === T("train.resume.text", { i: 4, n: 11 }));
        // (round 9: and Cancel -- Esc backs out, nothing started, the step kept)
        key("Escape");
        ok("E ...Esc backs out: nothing started, the step kept", !G.Dialog.isOpen() && g.state === "MENU" && G.save.training.step === 3);
        TY.open();
        G.Dialog.choose(G.Dialog._o.buttons.findIndex((b) => b.primary)); step(3);
        ok("E ...Continue: step 4", g.mode === "training" && stepId() === "aim");
        g.quitToMainMenu();
        startTraining(6);
        const W = g.world;
        ok("E ...picked up at the doors: the shotgun, the wall gun (bought), in the corridor", g.player.gunSlots.includes("shotgun") && g.player.gunSlots.includes(C.wallGun) && W.wallWeapons[0].purchased && stepId() === "doors" && g.yawObject.position.z < 0);
        g.quitToMainMenu();
        startTraining(8);
        ok("E ...at the drill: both doors open", g.world.trainRoomDoor.open && g.world.trainWordDoor.opened && stepId() === "wave");
        g.quitToMainMenu();
        await yield0();
      }

      // ================= F: Skip from the pause menu =================
      {
        G.save.training = { done: false, skipped: false, step: 0, offered: false, finishedAt: 0 };
        startTraining(2);
        g.state = "GAMEPLAY"; g.pause();
        const hid = ["btn-pause-vocablog", "btn-pause-weaponlog", "btn-pause-journal", "btn-pause-tutorial"].every((id) => $(id).classList.contains("hidden"));
        ok("F the pause menu in the yard: Skip, and not the logs, the journal or the old tutorial", !$("btn-pause-skiptrain").classList.contains("hidden") && hid);
        $("btn-pause-skiptrain").click();
        ok("F ...Skip asks first", G.Dialog.isOpen() && $("dialog-title").textContent === T("train.skip.title"));
        G.Dialog.choose(1);
        ok("F ...skipped: out to the menu, the save remembers (offered, skipped, no checkpoint)", g.state === "MENU" && G.save.training.skipped && G.save.training.offered && G.save.training.step === 0);
        startLevel(1);
        g.pause();
        ok("F ...in a level the pause menu is as it was", $("btn-pause-skiptrain").classList.contains("hidden") && !$("btn-pause-vocablog").classList.contains("hidden"));
        g.resume(); g.quitToMainMenu();
        await yield0();
      }

      // ================= G: what to press, by device =================
      {
        startTraining(0);
        const K = kb();
        I.padActive = false; I.mode = "desktop"; G.UI.applyControlMode(); step(2);
        const kbText = $("htr-text").innerHTML;
        ok("G keys and mouse: the keys bound (W A S D), the mouse", kbText.indexOf("<kbd>" + G.keyLabel(K.forward) + "</kbd>") >= 0 && $("htr-text").textContent.indexOf(T("train.dev.mouse")) >= 0);
        K.forward = "KeyI"; step(1); TY.goTo(0); step(1);
        ok("G ...a key rebound shows as bound", $("htr-text").innerHTML.indexOf("<kbd>I</kbd>") >= 0);
        K.forward = "KeyW";
        // the switch step: the knife, pistol and shotgun keys in their order; a key box and the
        // stop after it stay on one line (where the language puts a stop after a key)
        TY.goTo(4); step(1);
        const swHtml = $("htr-text").innerHTML;
        const swRaw = ((G.STRINGS[G.lang] || G.STRINGS.en)["train.switch.text"]) || "";
        ok("G ...switch: the slot keys 1 2 3 in order", swHtml.indexOf("<kbd>" + G.keyLabel(K.melee) + "</kbd><kbd>" + G.keyLabel(K.slot2) + "</kbd><kbd>" + G.keyLabel(K.slot3) + "</kbd>") >= 0);
        ok("G ...a key and the stop after it stay together", !/\{\w+\}[.,:;!?)。，：；！？）]/.test(swRaw) || /<span class="htr-nw"><kbd>[^<]+<\/kbd>[.,:;!?)。，：；！？）]+<\/span>/.test(swHtml));
        TY.goTo(0); step(1);
        I.padActive = true; step(2);
        ok("G a controller: the sticks, its buttons", $("htr-text").textContent.indexOf(T("train.dev.padMove")) >= 0 && $("htr-text").textContent.indexOf(T("train.dev.padLook")) >= 0);
        TY.goTo(1); step(1);
        ok("G ...run: L3", $("htr-text").innerHTML.indexOf(">L3<") >= 0);
        I.padActive = false; I.mode = "touch"; G.UI.applyControlMode(); step(2);
        ok("G touch: the RUN button by its name, lit on the screen", $("htr-text").textContent.indexOf(T("touch.sprintLabel")) >= 0 && $("touch-sprint").classList.contains("train-glow"));
        TY.goTo(2); step(2);
        ok("G ...shoot: FIRE lit, RUN no more", $("touch-fire").classList.contains("train-glow") && !$("touch-sprint").classList.contains("train-glow"));
        I.mode = "desktop"; G.UI.applyControlMode(); step(2);
        ok("G ...keys again: no touch button lit before the hint", !$("touch-fire").classList.contains("train-glow"));
        TY.run.t = C.hintAfter + 0.5; step(2);
        ok("G stuck " + C.hintAfter + " s: the clearer hint, the meaning box lit", !$("htr-hint").classList.contains("hidden") && $("htr-hint").textContent.indexOf(T("train.shoot.hint").slice(0, 12)) >= 0 && $("hud-meaning").classList.contains("train-glow"));
        G.save.settings.reduceMotion = true; TY.goTo(1); step(2);
        ok("G Reduce Motion: what is lit does not pulse", $("hud-stam").classList.contains("train-glow") && $("hud-stam").classList.contains("still"));
        G.save.settings.reduceMotion = false;
        G.save.settings.fontSize = "large"; G.UI.applyFontSizeClass(); step(1);
        const big = parseFloat(getComputedStyle($("hud-train")).fontSize);
        G.save.settings.fontSize = "medium"; G.UI.applyFontSizeClass(); step(1);
        const mid = parseFloat(getComputedStyle($("hud-train")).fontSize);
        ok("G the text size carries to the panel (rem)", big > mid, big + " vs " + mid);
        g.quitToMainMenu();
        await yield0();
      }

      // ================= H: the first-time offer =================
      {
        const fresh = (srs) => {
          G.save.training = { done: false, skipped: false, step: 0, offered: false, finishedAt: 0 };
          G.save.learn = G.Learning.normalize({}); G.save.levelHighScores = {}; G.save.tutorialDone = false; G.save.meta.playSec = 0;
          if (srs) G.save.learn.srs[G.wordKey(G.getAllBuiltinWords()[0])] = { b: 2, due: G.Clock.today(), last: null, n: 1, lapses: 0 };
        };
        fresh(false); G.Modal.reset();
        ok("H a new player: offered once -- Skip, Languages, Play the tutorial", TY.maybeOffer() && G.Dialog.isOpen() && $("dialog-title").textContent === T("train.offer.title") && $("dialog-btns").querySelectorAll("button").length === 3);
        G.Dialog.choose(0);
        ok("H ...Skip: never again", G.save.training.offered && G.save.training.skipped && !TY.maybeOffer() && !G.Dialog.isOpen());
        fresh(true);
        ok("H a player with words met: not offered (marked as offered)", !TY.maybeOffer() && !G.Dialog.isOpen() && G.save.training.offered);
        fresh(false);
        TY.maybeOffer(); G.Dialog.choose(1);
        ok("H ...Languages: Settings, at Language", G.UI._currentScreen === "screen-settings" && G.SettingsUI.cat === "language");
        G.SettingsUI.back(); await wait(400);
        ok("H ...and back: offered again", G.Dialog.isOpen() && $("dialog-title").textContent === T("train.offer.title"));
        G.Dialog.choose(2); step(3);
        ok("H ...Play the tutorial: the yard from step 1", g.mode === "training" && stepId() === "look" && G.save.training.offered);
        g.quitToMainMenu();
        G.save.training.done = true;
        G.UI.showScreen("screen-howtoplay");
        ok("H from How to Play: a Training Yard button", !$("btn-help-training").classList.contains("hidden") && $("btn-help-training").textContent === T("help.training"));
        $("btn-help-training").click(); step(3);
        ok("H ...it starts the yard", g.mode === "training");
        g.quitToMainMenu();
        const card = G.Lobby.modes("training").find((m) => m.id === "tutorial");
        ok("H the lobby's Training tab: the yard's card, with its status", !!card && G.Lobby.stats(card).some((r) => r[1] === T("lobby.tutDone")));
        G.SettingsUI.cat = "tips"; G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings");
        ok("H Settings > Tips: the yard's row with its Play button", !!$("btn-train-play") && !$("btn-train-play").disabled && $("set-train-v").textContent === T("lobby.tutDone"));
        G.UI.goToMainMenu();
        await yield0();
      }

      // ================= I: the tips =================
      {
        G.save.tipsSeen = {}; G.save.settings.tips = true;
        startLevel(1);
        GT.hide();
        ok("I nothing shown with nothing to say", !GT.current && (!$("game-tip") || $("game-tip").classList.contains("hidden")));
        // a Bloater in view
        const P = g.yawObject.position, fwd = new V3(); g.camera.getWorldDirection(fwd);
        const bz = g.spawnZombieAt("bloater", new V3(P.x + fwd.x * 8, 0, P.z + fwd.z * 8), null);
        bz.emerge = null; bz._hold = 1e9;
        step(40);
        ok("I a Bloater in view: its tip, a card over the play that does not stop it", GT.current === "bloater" && !$("game-tip").classList.contains("hidden") && g.state === "GAMEPLAY" && !g.paused && $("gt-title").textContent === T("tip.bloater.title"));
        ok("I ...seen as soon as shown, never again", G.save.tipsSeen.bloater === true && !GT.want("bloater"));
        g.startWordChallenge("x", () => {}, () => {}); step(2);
        ok("I ...a window over the play: the card put away, its time standing still", $("game-tip").classList.contains("gt-away"));
        g.answerChallengeAs(true); step(2);
        ok("I ...back after it", !$("game-tip").classList.contains("gt-away") && GT.current === "bloater");
        key("KeyH");
        ok("I ...H: got it", !GT.current && $("game-tip").classList.contains("hidden"));
        // each trigger
        const met = {};
        g.clearZombies(); g.player.hp = g.player.maxHp;
        ["screamer", "ironclad"].forEach((t) => { const z = g.spawnZombieAt(t, new V3(P.x + fwd.x * 9, 0, P.z + fwd.z * 9), null); z.emerge = null; z._hold = 1e9; step(30); met[t] = !!G.save.tipsSeen[t]; GT.hide(); g.clearZombies(); });
        const f0 = G.Bosses.fighting; G.Bosses.fighting = () => true; step(30); met.boss = !!G.save.tipsSeen.boss; G.Bosses.fighting = f0; GT.hide();
        const id = g.currentWeaponId(), am = g.player.ammo[id]; const keep = [am.mag, am.reserve]; am.mag = 2; am.reserve = 0; step(30); met.lowAmmo = !!G.save.tipsSeen.lowAmmo; am.mag = keep[0]; am.reserve = keep[1]; GT.hide();
        // (G.Game is an object literal: its method is put back, never deleted)
        const lk = g._lookedAtInteractable;
        g.updateInteractRay = () => { g._lookedAtInteractable = { kind: "forge" }; }; step(30); met.forge = !!G.save.tipsSeen.forge; GT.hide();
        g.updateInteractRay = () => { g._lookedAtInteractable = { kind: "note" }; }; step(30); met.storyNote = !!G.save.tipsSeen.storyNote; GT.hide();
        g.updateInteractRay = uir0; g._lookedAtInteractable = lk;
        const sf = g.world.secondFloor, was = sf && sf.unlocked; if (sf) sf.unlocked = true; step(30); met.floorUnlock = !!G.save.tipsSeen.floorUnlock; if (sf) sf.unlocked = was; GT.hide();
        G.Bus.emit("attach:unlock", { id: "x" }); step(30); met.attachUnlock = !!G.save.tipsSeen.attachUnlock; GT.hide();
        ok("I each comes when its thing comes: Screamer, Ironclad, a boss, ammo running out, the Word Forge, a story note, a floor opened, an attachment", Object.values(met).every(Boolean) && Object.keys(met).length === 8, JSON.stringify(met));
        // the shop's: over the shop
        g.player.money = 5000;
        g.openShop(); await wait(500); step(2);
        ok("I the perk shop: its tip over the shop", GT.current === "perkShop" && !$("game-tip").classList.contains("hidden") && $("game-tip").classList.contains("in-shop"));
        g.leaveShop(); step(2);
        ok("I ...the shop left: gone", !GT.current);
        ok("I all ten seen once", GT.IDS.every((t) => G.save.tipsSeen[t]));
        // Don't show tips
        GT.reset();
        ok("I reset: every tip unseen again", !Object.keys(G.save.tipsSeen).length);
        GT.want("lowAmmo"); step(2);
        key("KeyN");
        ok("I N: no more tips -- off in the settings, nothing more comes", G.save.settings.tips === false && !GT.current && !GT.want("boss"));
        G.save.settings.tips = true;
        // a key bound to something else is left to it
        kb().reload = "KeyH"; GT.want("boss"); step(2);
        const r0 = GT.current; key("KeyH");
        ok("I ...a key the player bound to something else is not taken", GT.current === r0 && !!r0);
        kb().reload = "KeyR"; GT.hide();
        g.quitToMainMenu();
        // none in the yard
        G.save.tipsSeen = {};
        startTraining(2); step(80);
        GT.want("lowAmmo"); step(30);
        ok("I none in the Training Yard", !GT.current && !G.save.tipsSeen.lowAmmo);
        g.quitToMainMenu();
        // Settings > Tips
        G.SettingsUI.cat = "tips"; G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings");
        const sw = $("set-tips");
        sw.checked = false; sw.dispatchEvent(new Event("change"));
        ok("I Settings > Tips: the switch turns them off", G.save.settings.tips === false);
        sw.checked = true; sw.dispatchEvent(new Event("change"));
        G.save.tipsSeen = { boss: true, forge: true }; G.UI.renderSettings();
        $("btn-tips-reset").click();
        ok("I ...and Show tips again", G.save.settings.tips === true && !Object.keys(G.save.tipsSeen).length);
        G.UI.goToMainMenu();
        await yield0();
      }

      // ================= J: the save, the languages, the flags =================
      {
        const old = JSON.parse(backup); delete old.training; delete old.tipsSeen; delete old.settings.tips;
        const n = G.normalizeSave(old);
        ok("J a save from before: not played, not offered, no tip seen, tips on", n.training.done === false && n.training.offered === false && n.training.step === 0 && !Object.keys(n.tipsSeen).length && n.settings.tips === true);
        const bad = G.normalizeSave(Object.assign(JSON.parse(backup), { training: { step: 99, done: "yes" }, tipsSeen: { boss: 1, "<x>": true } }));
        ok("J ...a broken one mended (a step out of range, odd keys)", bad.training.step === 10 && bad.training.done === true && bad.tipsSeen.boss === true && !bad.tipsSeen["<x>"]);
        const A = G.normalizeSave(Object.assign(JSON.parse(backup), { training: { done: false, step: 4, offered: true }, tipsSeen: { boss: true } }));
        const B = G.normalizeSave(Object.assign(JSON.parse(backup), { training: { done: false, step: 7, skipped: true }, tipsSeen: { forge: true } }));
        const M = G.SaveFile.merge(A, B);
        ok("J the merge: the further step, offered or skipped on either, the tips of both", M.training.step === 7 && M.training.offered && M.training.skipped && M.tipsSeen.boss && M.tipsSeen.forge);
        const Md = G.SaveFile.merge(Object.assign({}, A, { training: Object.assign({}, A.training, { done: true }) }), B);
        ok("J ...done on either: done, no step left", Md.training.done && Md.training.step === 0);
        const doc = G.SaveManager.toDoc(A), back = G.SaveManager.fromDoc(doc);
        ok("J the save's sections: both in flags, and back as they went", G.SaveManager.SECTIONS.flags.includes("training") && G.SaveManager.SECTIONS.flags.includes("tipsSeen") && doc.flags.training.step === 4 && doc.flags.tipsSeen.boss && !(doc.other && (doc.other.training || doc.other.tipsSeen)) && back.training.step === 4 && back.tipsSeen.boss);
        // four languages
        const langs = {};
        for (const l of ["th", "zh", "fr", "en"]) {
          await new Promise((res) => G.setUILang(l, { done: res }));
          G._missingKeys = {};
          startTraining(1); step(2);
          const t = $("htr-title").textContent, x = $("htr-text").textContent;
          GT.show("forge"); const tip = $("gt-title").textContent; GT.hide();
          g.quitToMainMenu();
          langs[l] = { t, x: x.length, tip, missing: Object.keys(G._missingKeys).length };
        }
        ok("J the panel and a tip in all four languages: their own words, none missing", Object.values(langs).every((v) => !v.missing && v.x > 20) && new Set(Object.values(langs).map((v) => v.t)).size === 4, JSON.stringify(langs));
        // the flags off
        G.CONFIG.expansion.trainingYard = false;
        G.save.training = { done: false, skipped: false, step: 0, offered: false, finishedAt: 0 }; G.save.learn = G.Learning.normalize({}); G.save.levelHighScores = {};
        const noCard = !G.Lobby.modes("training").some((m) => m.id === "tutorial");
        const noOffer = !TY.maybeOffer() && !G.Dialog.isOpen();
        G.UI.bindMainMenu();
        const noHelp = $("btn-help-training").classList.contains("hidden");
        G.CONFIG.expansion.trainingYard = true; G.UI.bindMainMenu();
        ok("J trainingYard off: no card, no offer, no Help button", noCard && noOffer && noHelp);
        G.CONFIG.expansion.tips = false;
        G.save.tipsSeen = {};
        const noTip = !GT.want("boss");
        G.CONFIG.expansion.tips = true;
        ok("J tips off: none", noTip);
      }

      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      G.Bus.off("t36");
      G.CONFIG.expansion.trainingYard = true; G.CONFIG.expansion.tips = true;
      I.aimDown = false; I.padActive = false; I.mode = "desktop";
      Object.keys(I.keys).forEach((k) => { I.keys[k] = false; });
      G.Spawner.update = spawn0;
      g.update = real;
      g.updateInteractRay = uir0;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      if (G.Quiz.active) G.Quiz.reset();
      G.Modal.reset();
      if (G.GameTips) G.GameTips.hide();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist(true);   // (written now: the runner closes the browser right after)
      G.UI.applyControlMode(); G.UI.applyFontSizeClass();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
