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
      const all = G.getAllBuiltinWords().map((p) => p[1]).filter(Boolean);
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
      await step("boss bar", () => {
        UI.setBossBar(true, T("hud.zombieBoss"), 64);
        const longestMeaning = this.meanings()[0];
        UI.setBossWord(longestMeaning);
      });
      UI.setBossBar(false); UI.setBossWord("");
      await step("pause", () => { Game.state = "GAMEPLAY"; Game.pause(); });
      await step("pause settings", () => { UI._settingsReturn = "screen-pause"; UI.renderSettings(); UI.showScreen("screen-settings"); });
      await step("resume", () => { UI.showScreen("screen-pause"); Game.resume(); });
      await step("shop", () => { Game._waveBonus = 300; G.save.tutorialDone = false; G.save.tutorialSeen = {}; Game.player.money = 99999; Game.openShop(); });
      await step("shop (maxed)", () => { Game.player.perks.perk_speed = 3; UI.renderShop(); });
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
      const stats = { score: 123456, wave: 12, correct: 88, wrong: 17, money: 45678 };
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
