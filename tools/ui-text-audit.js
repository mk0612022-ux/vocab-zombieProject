// Dev-only (not shipped). Walks every menu screen and every runtime popup and
// reports, for each one:
//   thai      -- Thai text that is NOT a vocabulary meaning (the UI must be
//                English; the meanings in js/data/words_*.js stay Thai)
//   overflow  -- text clipped by its box, or an element running off-screen
// plus any string key G.T could not find.
//
// Load it into the running game, then:
//   const r = await G.UIAudit.run();          // whole tour
//   r.problems                                  // [] when everything is clean
window.G = window.G || {};
// Thai block U+0E00-U+0E7F, built from char codes so this file itself stays
// free of Thai characters (tools/thai-scan.ps1 checks it too)
const THAI = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
G.UIAudit = {
  _meanings: null,
  meanings() {
    if (!this._meanings) {
      // (round 2: the bosses' epithets are vocabulary too, with their Thai)
      const all = G.getAllBuiltinWords().map((p) => p[1]).concat(Object.values(G.BOSS_WORDS || {}).map((w) => w.th)).filter(Boolean);
      this._meanings = Array.from(new Set(all)).sort((a, b) => b.length - a.length);
    }
    return this._meanings;
  },
  visible(el) {
    if (!el.getClientRects().length) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    }
    return true;
  },
  // Thai left over once every known meaning has been cut out of the text
  thai(root) {
    const out = [];
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    const M = this.meanings();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue;
      if (!THAI.test(t) || !n.parentElement || !this.visible(n.parentElement)) continue;
      let rest = t;
      for (const m of M) if (rest.includes(m)) rest = rest.split(m).join(" ");
      if (THAI.test(rest)) out.push({ text: t.trim().slice(0, 80), where: this.path(n.parentElement) });
    }
    // attributes a player can see or hear
    (root || document.body).querySelectorAll("[aria-label],[title],[placeholder]").forEach((el) => {
      ["aria-label", "title", "placeholder"].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && THAI.test(v)) out.push({ text: a + "=" + v.slice(0, 60), where: this.path(el) });
      });
    });
    return out;
  },
  overflow(root) {
    const out = [], W = window.innerWidth, H = window.innerHeight;
    (root || document.body).querySelectorAll("*").forEach((el) => {
      if (el.closest("#touchcfg-capture") || el.tagName === "CANVAS" || !this.visible(el)) return;
      const hasText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.nodeValue.trim());
      if (!hasText && !/^(BUTTON|LABEL|SELECT)$/.test(el.tagName)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const cs = getComputedStyle(el);
      // inside a scrolling panel, being below the fold is fine; sideways is not
      const scroller = el.parentElement && el.parentElement.closest(".screen, .overlay-panel, [class*='panel'], .shop-grid");
      if (r.right > W + 1 || r.left < -1) out.push({ kind: "off-screen-x", text: (el.textContent || "").trim().slice(0, 50), where: this.path(el), r: [Math.round(r.left), Math.round(r.right)] });
      else if (!scroller && (r.bottom > H + 1 || r.top < -1)) out.push({ kind: "off-screen-y", text: (el.textContent || "").trim().slice(0, 50), where: this.path(el), r: [Math.round(r.top), Math.round(r.bottom)] });
      const clipsX = cs.overflowX !== "visible" || cs.textOverflow === "ellipsis";
      if (clipsX && el.scrollWidth > el.clientWidth + 1 && hasText) out.push({ kind: "clipped", text: (el.textContent || "").trim().slice(0, 50), where: this.path(el), sw: el.scrollWidth, cw: el.clientWidth });
      // above the top of a scrolled-to-the-top screen: no way to scroll to it
      const screen = el.closest(".screen");
      if (screen && screen.scrollTop === 0 && r.top < screen.getBoundingClientRect().top - 1) out.push({ kind: "unreachable-top", text: (el.textContent || "").trim().slice(0, 50), where: this.path(el), top: Math.round(r.top) });
      const clipsY = cs.overflowY === "hidden";
      if (clipsY && el.scrollHeight > el.clientHeight + 2 && hasText) out.push({ kind: "clipped-y", text: (el.textContent || "").trim().slice(0, 50), where: this.path(el), sh: el.scrollHeight, ch: el.clientHeight });
    });
    return out;
  },
  path(el) {
    const bits = [];
    for (let e = el; e && e !== document.body && bits.length < 4; e = e.parentElement) {
      bits.unshift(e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.classList[0] ? "." + e.classList[0] : ""));
      if (e.id) break;
    }
    return bits.join(" > ");
  },
  // how much visible text a step actually put in front of the checks (a step
  // that shows nothing would otherwise pass without testing anything)
  visibleTexts() {
    let n = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (t.nodeValue.trim() && t.parentElement && this.visible(t.parentElement)) n++;
    return n;
  },
  check(name) {
    const r = { name, texts: this.visibleTexts(), thai: this.thai(), overflow: this.overflow() };
    this.results.push(r);
    return r;
  },
  // A timer rather than requestAnimationFrame, which stops in a background
  // tab. 200 ms: the outgoing screen is hidden 150 ms after a switch
  // (UI.showScreen), and until then it would be measured along with the new one.
  frame() { return new Promise((res) => setTimeout(res, 200)); },

  // The tour: every screen, then a live run with each popup forced open.
  async run(opts) {
    opts = opts || {};
    const UI = G.UI, Game = G.Game, T = G.T;
    this.results = [];
    G._missingKeys = {};
    const realAlert = window.alert, realConfirm = window.confirm, realUpdate = Game.update;
    const backup = JSON.stringify(G.save);   // the tour answers words and buys things; put the save back afterwards
    const dialogs = [];
    // Screens fade in and banners pop in with CSS animations, which stand still
    // in a background tab -- everything would be measured at opacity 0 and
    // pass. Pin every element to its settled, on-screen state instead.
    const freeze = document.createElement("style");
    freeze.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }"
      + " .hud-purchase-banner:not(.hidden) { opacity: 1 !important; transform: translate(-50%, -50%) !important; }";
    document.head.appendChild(freeze);
    window.alert = (m) => { dialogs.push(String(m)); };
    window.confirm = (m) => { dialogs.push(String(m)); return false; };
    const step = async (name, fn) => { try { await fn(); } catch (e) { this.results.push({ name, error: e.message }); return; } await this.frame(); this.check(name); };
    try {
      await step("main menu", () => UI.goToMainMenu());
      await step("level select", () => Game.goToLevelSelect());
      // round 4: every card of the lobby, both tabs, and the icon row in focus
      for (const m of G.Lobby.MODES) await step("lobby " + m.id, () => UI.goToMainMenu({ tab: m.tab, select: m.id }));
      await step("lobby icons focused", () => { UI.goToMainMenu({ tab: "campaign", select: "school" }); G.Lobby.focusIcons(true); });
      for (const d of ["pad", "touch", "kb"]) await step("lobby hints " + d, () => { G.Lobby.focusIcons(false); G.Lobby.setDevice(d); });
      // new list, round 1: an icon's tooltip, and the new-version window
      await step("lobby tooltip", () => { G.Lobby.iconI = 5; G.Lobby.focusIcons(true); });
      G.Lobby.focusIcons(false);
      await step("update window", () => { G.PWA.offer(); });
      G.PWA.later();
      await step("how to play", () => UI.showScreen("screen-howtoplay"));
      await step("settings", () => { UI._settingsReturn = "screen-mainmenu"; UI.renderSettings(); UI.showScreen("screen-settings"); });
      for (const c of ["level1", "daily", "endless"]) await step("leaderboard " + c, () => { UI.renderLeaderboard(c); UI.showScreen("screen-leaderboard"); });
      await step("achievements", () => { UI.renderAchievements(); UI.showScreen("screen-achievements"); });
      for (const l of [1, 2, 3]) await step("word log " + l, () => { UI._logReturnScreen = "screen-mainmenu"; UI.renderVocabLog(l); UI.showScreen("screen-vocablog"); });
      for (const l of [1, 2, 3]) await step("armory " + l, () => { UI._logReturnScreen = "screen-mainmenu"; UI.renderWeaponLog(l); UI.showScreen("screen-weaponlog"); });
      await step("import", () => { UI.renderImportedSets(); UI.showScreen("screen-import"); UI.renderImportPreview(G.WORDS_LEVEL_1.slice(0, 60)); });
      await step("import (empty preview)", () => UI.renderImportPreview([]));
      await step("practice setup", () => Game.goToPracticeSetup());
      await step("practice question", () => Game.startPractice("level2"));
      await step("practice feedback", () => { const b = document.querySelector("#practice-choices .practice-choice-btn"); if (b) b.click(); });

      // ---- a live run ----
      const tutorial = G.save.tutorialDone, seen = G.save.tutorialSeen;
      // the game loop would clear a forced prompt/boss bar on its next tick
      Game.update = function () {};
      await step("hud", () => { Game.startLevel(1); Game.player.hp = Game.player.maxHp = 1e9; Game.state = "GAMEPLAY"; UI.setHudVisible(true); UI.showScreen(null); UI.updateHud(Game.buildHudState()); });
      for (const st of G.Tutorial.STEPS) await step("tutorial " + st.id, () => G.Tutorial.show(st));
      G.Tutorial.hide();
      const longest = Object.values(G.WEAPON_DEFS).sort((a, b) => b.name.length - a.name.length)[0];
      const prompts = {
        interact: T("hud.interact"), door: T("prompt.wordDoor"), button: T("prompt.button"), crate: T("prompt.crate"),
        trap: T("prompt.trap"), hatch: T("prompt.hatch"), open: T("prompt.doorOpen"), close: T("prompt.doorClose"),
        mystery: T("prompt.mystery", { cost: G.MYSTERY_BOX_COST }) + T("prompt.notEnough"),
        wallgun: T("prompt.wallGun", { name: longest.name, price: longest.price, weight: G.weightClass(longest).label, short: T("prompt.notEnough") }),
      };
      for (const k in prompts) await step("prompt " + k, () => UI.setInteractPrompt(true, prompts[k]));
      UI.setInteractPrompt(false);
      const banners = [
        [T("banner.objectivesLeft"), T("banner.objectivesLeftText")], [T("banner.noMoney"), T("banner.noMoneyText", { cost: 1000, have: 250 })],
        [T("banner.upstairs"), T("banner.upstairsText", { n: 20 })], [T("banner.explored"), T("banner.exploredText", { n: 6 })],
        [T("banner.key"), T("banner.keyText", { k: 2, n: 3 })], [T("banner.allObjectives"), T("banner.clearThisWave")],
        [T("banner.allObjectives"), T("banner.surviveAll")], [T("save.persistFailTitle"), T("save.persistFailText")], [longest.name],
      ];
      for (const b of banners) await step("banner " + b[0], () => UI.flashPurchaseBanner(b[0], b[1]));
      for (const a of G.ACHIEVEMENTS) {
        const had = G.save.achievements[a.id];
        await step("achievement " + a.id, () => UI.showAchievementToast(a.id));
        G.save.achievements[a.id] = had;
      }
      await step("hud hint perk + combo", () => { Game.player.perks.perk_hint = 1; Game.player.combo = 12; UI.updateHud(Game.buildHudState()); });
      await step("hud overtime", () => { Game.wave = Game.level.waves + 1; UI.updateHud(Game.buildHudState()); Game.wave = 1; });
      await step("challenge door", () => Game.startWordChallenge(T("challenge.door"), () => {}, () => {}));
      await step("challenge (answered)", () => Game.answerChallenge(0));
      // round 2: the boss bar with the longest name and title, the boss's
      // question, the title card of every cutscene
      const longBoss = G.BOSS_DEFS.slice().sort((a, b) => G.Bosses.label(b).length - G.Bosses.label(a).length)[0];
      await step("boss bar", () => { UI.setBossBar(true, G.Bosses.label(longBoss), 64, true); UI.updateHud(Game.buildHudState()); });
      UI.setBossBar(false);
      await step("boss question", () => Game.startWordChallenge(T("challenge.boss"), () => {}, () => {}, { pair: G.WORDS_LEVEL_3.slice().sort((a, b) => b[1].length - a[1].length)[0], time: 10, boss: true }));
      await step("boss question (answered)", () => Game.answerChallenge(0));
      for (const d of G.BOSS_DEFS) {
        await step("cutscene card " + d.id, () => {
          G.Cutscene.ensure();
          const E = G.Cutscene.el;
          E.wave.textContent = T("cine.wave", { n: 20 }); E.name.textContent = T("boss." + d.id + ".name");
          E.title.textContent = T("boss.the", { w: d.word }); E.thai.textContent = G.Bosses.thai(d);
          document.body.classList.add("cine-on"); E.card.classList.add("show");
        });
      }
      document.body.classList.remove("cine-on"); G.Cutscene.el.card.classList.remove("show");
      await step("pause", () => { Game.state = "GAMEPLAY"; Game.pause(); });
      await step("pause settings", () => { UI._settingsReturn = "screen-pause"; UI.renderSettings(); UI.showScreen("screen-settings"); });
      await step("resume", () => { UI.showScreen("screen-pause"); Game.resume(); });
      await step("shop", () => { Game._waveBonus = 300; G.save.tutorialDone = false; G.save.tutorialSeen = {}; Game.player.money = 99999; Game.openShop(); });
      await step("shop (maxed)", () => { Game.player.perks.perk_speed = 3; UI.renderShop(); });
      // new list, round 1: the shop's clock in its last seconds, and with no limit
      await step("shop (last 10 s)", () => UI.updateShopTimer(7.2, 45));
      await step("shop (no limit)", () => UI.updateShopTimer(Infinity, 0));
      Game.leaveShop();
      // round 1: every perk owned (HUD icons, pause list), a full loadout of
      // six, the Inventory Full window, a gun on the floor
      await step("hud: all perks + 6 slots", () => {
        Game.update = function () {};
        G.PERKS.forEach((d) => { while (!G.Perks.maxed(d.id)) G.Perks.apply(d.id, Game); });
        Object.values(G.WEAPON_DEFS).filter((w) => w.id !== "pistol" && !w.boxOnly).slice(0, 5).forEach((w) => G.Loadout.offer(Game, w.id, { source: "crate" }));
        Game.targetPair = G.WORDS_LEVEL_1.slice().sort((a, b) => b[1].length - a[1].length)[0];
        UI.updateHud(Game.buildHudState());
      });
      await step("pause: perks", () => { Game.state = "GAMEPLAY"; Game.pause(); const b = document.querySelector("#pause-perks .pause-perk:last-child"); b && b.click(); });
      await step("inventory full", () => {
        Game.resume();
        const longest = Object.values(G.WEAPON_DEFS).filter((w) => !Game.player.gunSlots.includes(w.id)).sort((a, b) => b.name.length - a.name.length)[0];
        G.Loadout.offer(Game, longest.id, { source: "mystery", dropPos: Game.yawObject.position.clone() });
      });
      await step("inventory: kept -> floor gun prompt", () => {
        G.Loadout.keep();
        const fg = Game.floorGuns[Game.floorGuns.length - 1];
        Game.yawObject.position.x = fg.mesh.position.x; Game.yawObject.position.z = fg.mesh.position.z + 0.4;
        Game.updateInteractRay();
      });
      await step("shop with perks", () => { Game._interest = 250; Game._waveBonus = 500; Game.player.money = 12345; Game.openShop(); });
      Game.leaveShop();
      await step("crate", () => UI.showCrateScreen("secret", longest));
      const hand = Object.values(G.WEAPON_DEFS).slice(0, 6).map((d, i) => Object.assign({}, d, { boxTier: i === 2 ? "elite" : "normal" }));
      await step("mystery pick", () => UI.showMysteryCards(hand, () => {}));
      await step("mystery reveal", () => UI.revealMysteryCards(hand, 2));
      G.Modal.reset(); Game.state = "GAMEPLAY";
      const stats = { score: 123456, wave: 12, correct: 88, wrong: 17, money: 45678, bosses: [{ id: longBoss.id, wave: 5 }, { id: "void", wave: 10 }, { id: "examiner", wave: 15 }, { id: "headmaster", wave: 20 }] };
      const wrong = {}; G.WORDS_LEVEL_3.slice(0, 8).forEach((p, i) => { wrong[p[0]] = { meaning: p[1], count: 9 - i }; });
      await step("game over", () => { UI.renderResultScreen("lose", stats, wrong); UI.showScreen("screen-gameover"); });
      await step("victory", () => { UI.renderResultScreen("win", stats, {}); UI.showScreen("screen-victory"); });
      await step("touch editor", () => { Game.quitToMainMenu(); G.TouchCfg.openEditor(); });
      for (const id of G.TouchCfg.IDS) await step("touch editor: " + id, () => G.TouchCfg.select(id));
      await step("touch editor collapsed", () => document.getElementById("touchcfg-collapse").click());
      document.getElementById("touchcfg-collapse").click();
      await step("touch editor reset confirm", () => document.getElementById("touchcfg-reset").click());
      G.TouchCfg.closeEditor();
      G.save.tutorialDone = tutorial; G.save.tutorialSeen = seen;
      await step("back to menu", () => Game.quitToMainMenu());
      // round 3: the Notes Journal (none kept, some kept, every level), the
      // reader with the longest note, the third-floor and reward prompts
      await step("journal (empty)", () => { G.save.notes = { level1: [], level2: [], level3: [] }; UI.openJournal("screen-mainmenu", "level1"); });
      await step("journal (kept)", () => { G.save.notes.level1 = G.NOTES.level1.slice(0, 13).map((n) => n.id); UI.renderJournal(); });
      await step("journal (hospital)", () => { UI._journalLevel = "level2"; UI.renderJournal(); });
      const longNote = G.NOTES.level1.slice().sort((a, b) => b.text.length - a.text.length)[0];
      await step("note reader (longest)", () => { UI._journalLevel = "level1"; G.Notes.open(longNote, { fromJournal: true, back: "screen-journal" }); });
      await step("note reader (A1)", () => { G.Notes.close(); G.Notes.open(G.NOTES.level1[0], { fromJournal: false }); });
      G.Notes.close(); G.Modal.reset();
      // round 2: the Boss Codex, none met, some met, every one met, and the
      // card of the boss with the longest text
      const bossSave = JSON.parse(JSON.stringify(G.save.bosses));
      await step("codex (none met)", () => { G.save.bosses = { seen: {}, defeated: {} }; UI.openCodex("screen-mainmenu"); });
      await step("codex (some met)", () => { G.save.bosses = { seen: { gravedigger: 2, eye: 1, examiner: 1 }, defeated: { gravedigger: 1 } }; UI.renderCodex(); });
      await step("codex (all met)", () => { G.BOSS_DEFS.forEach((d) => { G.save.bosses.seen[d.id] = 3; G.save.bosses.defeated[d.id] = 2; }); UI.renderCodex(); });
      const wordy = G.BOSS_DEFS.slice().sort((a, b) => (T("boss." + b.id + ".desc") + T("boss." + b.id + ".counter")).length - (T("boss." + a.id + ".desc") + T("boss." + a.id + ".counter")).length)[0];
      await step("codex card", () => UI.openCodexDetail(wordy.id));
      UI.closeCodexDetail();
      G.save.bosses = bossSave;
      await step("r3 run hud", () => { Game.update = function () {}; Game.startLevel(1); Game.state = "GAMEPLAY"; UI.setHudVisible(true); UI.showScreen(null); UI.updateHud(Game.buildHudState()); });
      const r3prompts = [T("prompt.note", { key: "E" }), Game.thirdFloorStatus(), T("prompt.safe", { key: "E" }), T("prompt.trophy", { key: "E" }), T("prompt.coffee", { key: "E" }), T("prompt.radio", { key: "E" })];
      for (const pr of r3prompts) await step("prompt " + pr.slice(0, 18), () => UI.setInteractPrompt(true, pr));
      UI.setInteractPrompt(false);
      const r3banners = [[T("notes.kept"), T("notes.keptText", { n: 13, total: 20 })], [T("banner.thirdFloor"), T("banner.thirdFloorText")], [T("banner.gate3Locked"), Game.thirdFloorStatus()],
        [T("banner.coffee"), T("banner.coffeeText", { perk: G.Perks.name("second_life"), lvl: 1 })], [T("banner.radio"), T("banner.radioText", { n: 7 })], [T("banner.trophy"), T("banner.trophyText", { n: 1500 })]];
      for (const b of r3banners) await step("banner " + b[0], () => UI.flashPurchaseBanner(b[0], b[1]));
      await step("pause (journal button)", () => { Game.pause(); });
      await step("back to menu (r3)", () => Game.quitToMainMenu());
      // ---- round 3 of the new series: abilities, the third floor, the checkpoint ----
      const AB = G.Abilities, F3 = G.Floor3, CP = G.Checkpoint;
      const wordiest = G.ABILITIES.slice().sort((a, b) => (AB.name(b.id) + AB.desc(b.id)).length - (AB.name(a.id) + AB.desc(a.id)).length).map((a) => a.id);
      const longNames = G.ABILITIES.slice().sort((a, b) => AB.name(b.id).length - AB.name(a.id).length).map((a) => a.id);
      await step("hive (hidden)", () => { Game.update = function () {}; Game.startLevel(1); Game.state = "GAMEPLAY"; UI.setHudVisible(true); AB.resetRun(); AB.bag = wordiest.slice(0, 5).concat(AB.bag.filter((id) => !wordiest.slice(0, 5).includes(id))); AB.offer(Game, () => {}); });
      await step("hive (picked, all shown)", () => { UI.hivePick(0); UI.hiveFinishReveal(); });
      await step("hive (another looked at)", () => UI.hiveShow(3));
      await step("hive (four held: swap or keep)", () => { UI.hiveClose(); AB.slots = longNames.slice(0, 4).map((id) => ({ id, cd: 0 })); AB.offer(Game, () => {}); UI.hivePick(1); UI.hiveFinishReveal(); });
      await step("hive closed", () => UI.hiveClose(null, true));
      await step("hud: four abilities, cooling and live", () => {
        UI.showScreen(null);
        const four = longNames.filter((id) => id !== "barrier").slice(0, 3);
        four.splice(2, 0, "barrier");
        AB.slots = four.map((id, i) => ({ id, cd: i === 1 ? 12.4 : 0 }));
        AB.fx.barrier = 3;                                   // (one running: it glows)
        AB.update(Game, 0); UI.updateHud(Game.buildHudState());
      });
      await step("hud: abilities with a controller", () => { G.Input.padActive = true; UI.updateAbilityBar(Game, true); });
      await step("hud: ability refused", () => { G.Input.padActive = false; UI.updateAbilityBar(Game, true); UI.flashAbilityNote(T("ability.noTarget.freeze")); });
      await step("hud: whisper", () => { Game.spawnZombieAt("normal", new THREE.Vector3(0, 0, 40)); AB.fx.whisper = 5; UI.updateHud(Game.buildHudState()); });
      await step("hud: the third floor's chip", () => { AB.fx.whisper = 0; F3.s.spawned = true; F3.s.lockLeft = 27; F3._hudSig = null; F3.hud(Game); });
      const f3prompts = [T("prompt.gate3Card", { d: 4 }), T("prompt.gate3Jammed", { s: 30 }), T("prompt.gate3Lock", { key: "E", n: 3, s: 15 })];
      for (const pr of f3prompts) await step("prompt " + pr.slice(0, 24), () => UI.setInteractPrompt(true, pr));
      UI.setInteractPrompt(false);
      const f3banners = [[T("banner.keycard"), T("banner.keycardText")], [T("banner.keycardTaken"), T("banner.keycardTakenText")], [T("banner.lockJammed"), T("banner.lockFail", { s: 30 })],
        [T("banner.lockJammed"), T("banner.lockJammedText", { s: 30 })], [T("banner.gate3Locked"), T("banner.gate3Need", { d: 4 })], [T("banner.arenaAmmo"), T("banner.arenaAmmoText")]];
      for (const b of f3banners) await step("banner " + b[1].slice(0, 20), () => UI.flashPurchaseBanner(b[0], b[1]));
      await step("lock question", () => Game.startWordChallenge(T("challenge.lock", { i: 2, n: 3 }), () => {}, () => {}, { pair: G.WORDS_LEVEL_1.slice().sort((a, b) => b[1].length - a[1].length)[0], time: 15 }));
      await step("lock question (answered)", () => Game.answerChallenge(0));
      await step("checkpoint saved", () => { Game.wave = 10; CP.save(Game); Game.wave = 11; });
      await step("pause: abilities, 3rd floor, checkpoint", () => {
        Game.wave = 12; F3.s.spawned = true; F3.s.taken = false; F3.s.lockLeft = 0; Game.state = "GAMEPLAY"; Game.paused = false; G.Modal.reset(); Game.pause();
        const b = document.querySelector("#pause-abilities .pause-ab"); if (b) b.click();
      });
      await step("game over: continue / restart", () => { Game.state = "GAME_OVER"; UI.renderResultScreen("lose", { score: 12345, wave: 12, correct: 88, wrong: 9, money: 3000, bosses: [] }, {}); CP.onGameOver(Game); UI.showScreen("screen-gameover"); });
      await step("leaderboard: a continued run", () => { G.save.leaderboards.level1 = [{ score: 99999, date: "2026-09-28", meta: "continued" }, { score: 5000, date: "2026-09-27", meta: "" }]; UI.renderLeaderboard("level1"); UI.showScreen("screen-leaderboard"); });
      await step("lobby: continue a checkpoint", () => { Game.quitToMainMenu(); UI.goToMainMenu({ tab: "campaign", select: "school" }); });
      await step("dialog: continue or new run", () => CP.chooseRun(1));
      await step("dialog: delete the checkpoint?", () => { G.Dialog.close(); CP.confirmDelete(1, () => {}); });
      await step("dialog closed", () => G.Dialog.close());
      // ---- newer series, round 1: the end-of-wave quiz, HUD sizes, touch look sensitivity ----
      const longMeanings = G.WORDS_LEVEL_1.slice().sort((a, b) => b[1].length - a[1].length).slice(0, 6).map((p) => p.slice());
      const allWrong = () => { let n = 0; while (G.Quiz.stage !== "result" && n++ < 30) { if (G.Quiz.stage === "question") { const q = G.Quiz.qs[G.Quiz.i]; G.Quiz.answer((q.answer + 1) % 4); } G.Quiz.update(5); } };
      await step("quiz: a Thai meaning", () => { Game.update = function () {}; Game.startLevel(1); Game.state = "GAMEPLAY"; UI.setHudVisible(true); Game.waveWords = longMeanings; Game.waveMissed = new Set(); G.Quiz.open(Game, () => {}); });
      await step("quiz: answered wrong", () => { const q = G.Quiz.qs[0]; G.Quiz.answer((q.answer + 1) % 4); });
      await step("quiz: an English word, Thai choices", () => G.Quiz.update(5));
      await step("quiz: out of time", () => G.Quiz.update(99));
      await step("quiz: failed, the words listed", () => allWrong());
      await step("quiz: passed, no mistakes", () => { G.Quiz.close(); G.Quiz.open(Game, () => {}); let n = 0; while (G.Quiz.stage !== "result" && n++ < 30) { if (G.Quiz.stage === "question") G.Quiz.answer(G.Quiz.qs[G.Quiz.i].answer); G.Quiz.update(5); } });
      await step("quiz closed", () => G.Quiz.close());
      await step("settings: touch look sensitivities, HUD size", () => { Game.quitToMainMenu(); UI._settingsReturn = "screen-mainmenu"; UI.renderSettings(); UI.showScreen("screen-settings"); });
      await step("hud sizes editor", () => G.HudCfg.openEditor());
      await step("hud sizes at 150%", () => { G.HudCfg.PARTS.concat("all").forEach((p) => G.HudCfg.set(p, 1.5)); G.HudCfg.renderPanel(); });
      await step("hud sizes at 50%", () => { G.HudCfg.PARTS.concat("all").forEach((p) => G.HudCfg.set(p, 0.5)); G.HudCfg.renderPanel(); });
      await step("hud sizes closed", () => { G.HudCfg.reset(); G.HudCfg.closeEditor(); });
      // Custom Vocabulary: the page, an error, a warning, a long list, edit mode
      const thaiWord = G.WORDS_LEVEL_2[3][1];
      await step("custom vocab", () => {
        G.save.customWords = { level1: [], level2: [], level3: [] };
        ["Serendipity", "Ephemeral", "Well-being", "Quintessential", "Juxtaposition", "Idiosyncrasy"].forEach((w, i) => G.CustomVocab.save(w, G.WORDS_LEVEL_3[i][1] + " " + G.WORDS_LEVEL_3[i + 20][1], "level1"));
        G.CustomVocabUI.open("screen-mainmenu");
      });
      await step("custom vocab: duplicate error", () => { document.getElementById("cv-en").value = "Abandon"; document.getElementById("cv-th").value = thaiWord; G.CustomVocabUI.submit(); });
      await step("custom vocab: same-meaning warning", () => { document.getElementById("cv-en").value = "Forsake"; document.getElementById("cv-th").value = G.WORDS_LEVEL_1[0][1]; document.getElementById("cv-level").value = "level1"; G.CustomVocabUI.submit(); });
      await step("custom vocab: edit + delete armed", () => { G.CustomVocabUI.startEdit("level1", 2); document.querySelector("#cv-list button[data-act=del]").click(); });
      await step("import: into a level, summary", () => {
        UI.openImport("screen-customvocab", "level2");
        UI._pendingImport = { name: "t", words: [["Ubiquitous", thaiWord], ["abandon", thaiWord], ["bad1", thaiWord], ["Serendipity", thaiWord]] };
        UI.el("btn-import-save").disabled = false;
        UI.saveImportedSet();
      });
    } finally {
      window.alert = realAlert; window.confirm = realConfirm; Game.update = realUpdate;
      G.save = JSON.parse(backup); G.persist();
      freeze.remove();
    }
    const dialogThai = dialogs.filter((d) => THAI.test(d));
    const problems = [];
    this.results.forEach((r) => {
      if (r.error) problems.push({ screen: r.name, error: r.error });
      (r.thai || []).forEach((t) => problems.push(Object.assign({ screen: r.name, kind: "thai" }, t)));
      (r.overflow || []).forEach((o) => problems.push(Object.assign({ screen: r.name }, o)));
    });
    dialogThai.forEach((d) => problems.push({ screen: "dialog", kind: "thai", text: d }));
    return {
      viewport: window.innerWidth + "x" + window.innerHeight,
      screens: this.results.length, dialogs, missingKeys: Object.keys(G._missingKeys), problems,
      texts: this.results.map((r) => r.name + ":" + r.texts),
    };
  },
};
