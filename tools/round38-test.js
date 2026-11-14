// Dev-only (not shipped). The expansion's round 9: everything together, and the update's notes.
//   A  "What's new" (js/whatsnew.js): the Main Menu brings it up by itself, once, for a player
//      who played before; a player new to the game never sees it (read for them); its six lines
//      with the keys this player has bound; Got it / Esc / the controller's B close it and mark it
//      read; How to Play opens the help page; never over a window, never in a run; the flag off
//      or a new id; the save keeps it (flags, the merge)
//   B  How to Play's new part in four languages: its four headings and nine points, the names
//      the menus use (the Armory, the Word Forge, the melee weapons, Settings > Data/Tips/Help...),
//      the page scrolls to its end
//   C  every window the expansion added, by keys, controller and touch: the What's new window,
//      a word report, the bug report, the attachments window, the Word Forge's window, the
//      Training Yard's resume question and HUD tour, the upgrade scene; Settings > Data/Tips/Help:
//      a control focused, Tab / the D-pad move on, buttons a finger's size (44 px), Esc or B out
//   D  the save with every expansion key: to a file and back (G.SaveFile.make / read), the old
//      fixture (tests/fixtures/save-v-current.json) given every new key, two saves merged
//   E  one run with everything: a melee weapon, attachments, a forged gun, a shotgun; shooting,
//      reloading, swinging, switching; the Word Forge's window; a bug report that knows it all;
//      a wave-10 checkpoint keeps the tier and the melee weapon
//   F  the files: none of version.json's files at 25 MiB or more; every script of the page there
// Load it into the game (in the lobby), then:
//   const r = await G.Round38Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round38Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t38 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, WN = G.WhatsNew, C = G.CONFIG.whatsNew, T = (k, v) => G.T(k, v), $ = (id) => document.getElementById(id);
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock;
    const real = g._update0 || g.update;
    const I = G.Input, P = G.Pad;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const yield0 = () => wait(0);
    const key = (code) => G.onKeyDown({ code, preventDefault() {}, stopPropagation() {}, repeat: false });
    const mode = (m) => { I.padActive = false; I.mode = m; G.UI.applyControlMode(); };
    const topId = () => (G.Modal.top() ? G.Modal.top().id : null);
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
    const toMenus = () => { if (g.state !== "MENU") g.quitToMainMenu(); G.Modal.reset(); if (G.Dialog.isOpen()) G.Dialog.close(); G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu(); };
    const setLang = (l) => (G.lang === l ? Promise.resolve() : new Promise((r) => G.setUILang(l, { done: r })));
    const asOld = () => { G.save.tutorialDone = true; };
    const asNew = () => { G.save.learn.srs = {}; G.save.levelHighScores = {}; G.save.tutorialDone = false; if (G.save.meta) G.save.meta.playSec = 0; };
    const unread = () => { delete G.save.tutorialSeen[WN.key()]; };
    const dlgTitle = () => ($("dialog-title") ? $("dialog-title").textContent : "");
    const newsUp = () => G.Dialog.isOpen() && dlgTitle() === T("news.title") && document.querySelectorAll("#dialog-body .news-item").length > 0;
    // a finger's size: every visible, enabled button and list box of a window (touch mode) -- its
    // layout height (offsetHeight, as suite 26), not a moment of an opening animation's scale
    const small = (root) => Array.from(root.querySelectorAll("button, select")).filter((b) => b.getClientRects().length && !b.disabled && !b.closest(".hidden"))
      .map((b) => ({ b, h: b.offsetHeight })).filter((x) => x.h < 44).map((x) => (x.b.id || x.b.className.split(" ")[0] || "?") + ":" + x.h);
    // the controller in a window: its scope, its controls, a step of the D-pad
    const padIn = (root) => {
      const sc = P.scope(), items = P.focusables(sc);
      if (!items.length) return { scope: sc && sc.id, n: 0, moved: false };
      P.setFocus(items[0]);
      const a = P.focused;
      P.step("down", items); if (P.focused === a) P.step("right", items);
      return { scope: sc && sc.id, inside: !!sc && sc === root, n: items.length, moved: P.focused !== a };
    };

    try {
      // ================= A: "What's new" =================
      {
        toMenus(); mode("desktop");
        ok("A six lines, from the config, an id", C && C.id && C.items.length === 6 && C.items.every((it) => it.key && it.icon), C && C.items.length);
        // the Main Menu brings it up by itself, after its delay
        asOld(); unread(); G.CONFIG.expansion.whatsNew = true;
        G.MainMenu.show();
        await wait((C.delay || 600) + 500);
        ok("A an old player, the Main Menu up: the window comes by itself", newsUp(), dlgTitle());
        ok("A ...its six lines, each with its icon and words", document.querySelectorAll("#dialog-body .news-item").length === 6
          && Array.from(document.querySelectorAll("#dialog-body .news-item")).every((li) => li.querySelector(".news-icon").textContent && li.querySelector("b").textContent && !/news\./.test(li.textContent)));
        ok("A ...the wider window (news-box)", $("dialog-box").classList.contains("news-box"));
        ok("A ...the keys named as bound: Z, F8", /\bZ\b/.test($("dialog-body").textContent) && /F8/.test($("dialog-body").textContent));
        await wait(30);
        ok("A ...Got it has the keys' focus (Enter)", document.activeElement && document.activeElement.closest && !!document.activeElement.closest("#dialog-btns .btn-primary"));
        key("Enter");
        ok("A Enter: closed and read", !G.Dialog.isOpen() && WN.seen());
        // once
        G.MainMenu.show(); await wait((C.delay || 600) + 400);
        ok("A ...once: the Main Menu again, no window", !G.Dialog.isOpen());
        toMenus();
        // Esc and the controller's B
        unread(); ok("A Esc closes it, read", WN.maybeShow() && (key("Escape"), !G.Dialog.isOpen() && WN.seen()));
        unread(); WN.maybeShow();
        const box = $("dialog-box");
        const pd = padIn(box);
        ok("A the controller: in the window, its two buttons, the D-pad moves", pd.inside && pd.n === 2 && pd.moved, JSON.stringify(pd));
        P.back(P.scope());
        ok("A ...B: closed and read", !G.Dialog.isOpen() && WN.seen());
        // How to Play
        unread(); WN.maybeShow();
        G.Dialog.choose(0);
        ok("A How to Play: the help page, read", G.UI._currentScreen === "screen-howtoplay" && WN.seen() && !G.Dialog.isOpen(), G.UI._currentScreen);
        $("btn-howtoplay-back").click();
        ok("A ...its Back leaves the help page", G.UI._currentScreen !== "screen-howtoplay");
        toMenus();
        // the keys this player has
        const kb = G.save.settings.keybinds, qm0 = kb.quickMelee;
        kb.quickMelee = "KeyV"; unread(); WN.maybeShow();
        ok("A a melee key rebound to V: the line says V", /\bV\b/.test(document.querySelector('#dialog-body [data-news="melee"]').textContent));
        G.Dialog.close(); kb.quickMelee = qm0;
        // touch
        mode("touch"); unread(); WN.maybeShow();
        ok("A touch: its buttons a finger's size (44 px)", !small($("dialog-box")).length, small($("dialog-box")).join());
        G.Dialog.close(); mode("desktop");
        // never for a player new to the game
        unread(); asNew();
        ok("A a player new to the game: no window, read for them", !WN.maybeShow() && !G.Dialog.isOpen() && WN.seen());
        asOld();
        // never over a window, never in a run, never with the flag off
        unread();
        G.Dialog.open({ title: "x", buttons: [{ label: "ok", primary: true, cancel: true }] });
        ok("A over another window: not now (and not read)", !WN.due() && !WN.maybeShow() && !WN.seen() && dlgTitle() === "x");
        G.Dialog.close();
        startLevel(1);
        ok("A in a run: not now", !WN.due() && !WN.maybeShow() && !G.Dialog.isOpen());
        toMenus();
        G.CONFIG.expansion.whatsNew = false;
        ok("A the flag off: never", !WN.due() && !WN.maybeShow() && !G.Dialog.isOpen());
        G.CONFIG.expansion.whatsNew = true;
        // a new id: shown again
        WN.maybeShow(); if (G.Dialog.isOpen()) key("Enter");
        const id0 = C.id; C.id = "test-next";
        ok("A notes with a new id: due again", WN.due() && !WN.seen());
        C.id = id0;
        // the save: in flags, and the merge keeps it from either side
        unread(); G.save.tutorialSeen[WN.key()] = true;
        const doc = G.SaveManager.toDoc(G.save);
        ok("A the save: tutorialSeen (flags) keeps it", !!(doc.flags && doc.flags.tutorialSeen && doc.flags.tutorialSeen[WN.key()]) && G.SaveManager.fromDoc(doc).tutorialSeen[WN.key()] === true);
        const a = G.normalizeSave(JSON.parse(backup)), b = G.normalizeSave(JSON.parse(backup));
        delete a.tutorialSeen[WN.key()]; b.tutorialSeen[WN.key()] = true;
        ok("A ...two saves merged: read on either is read", !!G.SaveFile.merge(a, b).tutorialSeen[WN.key()] && !!G.SaveFile.merge(b, a).tutorialSeen[WN.key()]);
        await yield0();
      }

      // ================= B: How to Play, four languages =================
      {
        toMenus();
        for (const l of ["en", "th", "zh", "fr"]) {
          await setLang(l);
          G.UI.showScreen("screen-howtoplay"); await wait(30);
          const el = document.querySelector('[data-i18n-html="howto.body3"]');
          const txt = el ? el.textContent.toLowerCase() : "";
          const names = [T("weaponlog.title"), T("forge.title"), T("att.customize"), T("help.training").replace(/^▶\s*/, ""), T("settings.cat.data"), T("settings.cat.tips"),
            T("settings.cat.help"), T("help.report"), T("home.item.weapons"), T("home.item.awards"), T("melee.name.bat"), T("melee.name.machete"), T("melee.name.axe"),
            T("melee.name.crowbar"), T("melee.name.shovel")];
          const missing = names.filter((n) => txt.indexOf(String(n).toLowerCase()) < 0);
          ok("B " + l + ": the new part, four headings and nine points", !!el && el.querySelectorAll("h3").length === 4 && el.querySelectorAll("li").length === 9, el && el.querySelectorAll("li").length);
          ok("B " + l + ": the names the menus use", !missing.length, missing.join(" | "));
          // the language's own words for the window too
          unread(); WN.maybeShow();
          ok("B " + l + ": What's new in this language", newsUp() && dlgTitle() === G.STRINGS[l]["news.title"] && !/news\./.test($("dialog-body").textContent));
          G.Dialog.close();
          G.UI.showScreen("screen-howtoplay");
        }
        await setLang("en");
        // (the screen itself scrolls: .screen overflow-y auto)
        const sc = $("screen-howtoplay");
        sc.scrollTop = sc.scrollHeight; await wait(20);
        const lis = document.querySelectorAll('[data-i18n-html="howto.body3"] li'), last = lis[lis.length - 1];
        const lr = last ? last.getBoundingClientRect() : null;
        ok("B the page scrolls to its last point", getComputedStyle(sc).overflowY === "auto" && !!lr && lr.bottom <= window.innerHeight + 2 && lr.top >= -2, lr && Math.round(lr.top) + "-" + Math.round(lr.bottom) + " / " + window.innerHeight);
        sc.scrollTop = 0;
        ok("B its buttons: the Training Yard, a bug report, Back", !!$("btn-help-training") && !!$("btn-help-report") && !!$("btn-howtoplay-back"));
        toMenus();
        await yield0();
      }

      // ================= C: the expansion's windows, by keys, controller and touch =================
      {
        toMenus();
        const winCheck = async (name, open, rootOf, closeKey) => {
          mode("desktop"); open(); await wait(40);
          const top = topId(), root = rootOf();
          const a0 = document.activeElement, focused = !!a0 && !!root && root.contains(a0);
          key("Tab"); await yield0();
          const a1 = document.activeElement, tabbed = !!a1 && root.contains(a1) && a1 !== a0;
          const pd = padIn(root);
          mode("touch"); await yield0();
          const sm = small(root);
          mode("desktop");
          key(closeKey || "Escape"); await wait(30);
          const closed = topId() !== top;
          ok("C " + name + ": focused, Tab and the D-pad move on, " + (closeKey || "Esc") + " closes", focused && tabbed && pd.inside && pd.moved && closed,
            JSON.stringify({ top, focused, tabbed, pad: pd, closed }));
          ok("C " + name + ": a finger's size on touch (44 px)", !sm.length, sm.join());
          if (G.Dialog.isOpen()) G.Dialog.close();
          G.Modal.reset();
        };
        await winCheck("What's new", () => { unread(); WN.open(); }, () => $("dialog-box"));
        const pair = G.TrainingYard ? G.TrainingYard.pairs()[0] : G.WORD_SETS[G.getLevel(1).wordsKey].words[0];
        await winCheck("a word report", () => G.WordReport.open(pair, { where: "log" }), () => $("dialog-box"));
        await winCheck("the attachments window", () => G.Attach.openEditor(G.WEAPON_DEFS.pistol), () => $("dialog-box"));
        // the bug report: its text box takes Tab as the page does; the D-pad and Esc are its own
        mode("desktop"); G.BugReport.open(); await wait(60);
        const brRoot = $("bug-report-box"), brPad = padIn(brRoot);
        mode("touch"); await yield0(); const brSmall = small(brRoot); mode("desktop");
        key("Escape"); await wait(20);
        ok("C the bug report: the D-pad in it, Esc closes", brPad.inside && brPad.moved && !G.BugReport.shown, JSON.stringify(brPad));
        ok("C the bug report: a finger's size on touch (44 px)", !brSmall.length, brSmall.join());
        G.Modal.reset();
        // in a run: the Word Forge's window
        startLevel(1);
        await winCheck("the Word Forge's window", () => G.Forge.open(g, "pistol"), () => $("dialog-box"));
        // the upgrade scene: A skips it once seen (no button to focus)
        const W = g.world && g.world.forge;
        if (W && G.ForgeScene) {
          G.save.tutorialSeen.forge_scene = true;
          G.ForgeScene.play(g, W, "pistol", 1, () => {});
          const upScene = G.ForgeScene.active && topId() === "forge-scene";
          P.navigate({ axes: [0, 0, 0, 0], buttons: [] }, [], (b) => b === P.B.A, 1 / 60);
          ok("C the upgrade scene: the controller's A skips it (seen before)", upScene && !G.ForgeScene.active && topId() !== "forge-scene");
        } else ok("C the upgrade scene: a station in the school", false, "no station");
        G.Modal.reset();
        toMenus();
        // the Training Yard: the resume question, the HUD tour
        if (G.TrainingYard && G.TrainingYard.on()) {
          const TY = G.TrainingYard;
          G.save.training = Object.assign({}, G.save.training, { done: false, step: 3, offered: true });
          await winCheck("the Training Yard's resume question", () => TY.open(), () => $("dialog-box"));
          G.Modal.reset();
          // (the tour opens 0.6 s into its step)
          g.update = real; g.startTraining(7); g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(50);
          await wait(30);
          const tour = $("train-tour");
          const tourUp = topId() === "train-tour" && tour && !tour.classList.contains("hidden");
          const pd = padIn(tour);
          P.setFocus($("tt-next")); const stop0 = document.querySelector("#train-tour .tt-step") ? document.querySelector("#train-tour .tt-step").textContent : $("tt-next").textContent;
          P.activate($("tt-next")); await yield0();
          const stop1 = document.querySelector("#train-tour .tt-step") ? document.querySelector("#train-tour .tt-step").textContent : $("tt-next").textContent;
          mode("touch"); await yield0(); const tSmall = small(tour); mode("desktop");
          P.back(P.scope()); await yield0();
          ok("C the HUD tour: the controller's scope is the tour, A goes on, B skips", tourUp && pd.inside && pd.n >= 2 && topId() !== "train-tour", JSON.stringify({ tourUp, pd, stop0, stop1, top: topId() }));
          ok("C the HUD tour: a finger's size on touch (44 px)", !tSmall.length, tSmall.join());
          G.Modal.reset();
          toMenus();
        }
        // Settings > Data, Tips, Help: their buttons on touch
        mode("touch");
        for (const cat of ["data", "tips", "help"]) {
          G.SettingsUI.cat = cat; G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings"); await wait(20);
          const root = $("settings-content"), sm = small(root);
          ok("C Settings > " + cat + ": a finger's size on touch (44 px)", !sm.length, sm.join());
        }
        mode("desktop");
        toMenus();
        await yield0();
      }

      // ================= D: the save with everything =================
      {
        const gid = Object.keys(G.WEAPON_DEFS).find((id) => G.WEAPON_DEFS[id].magSize && G.Attach.allowed(G.WEAPON_DEFS[id], "optic").includes("x2"));
        G.Attach.setAll(gid, { optic: "x2" });
        G.save.training = { done: true, skipped: false, step: 0, offered: true, finishedAt: 1234 };
        G.save.tipsSeen = { boss: true, forge: true };
        G.save.tutorialSeen[WN.key()] = true; G.save.tutorialSeen.forge_scene = true;
        G.save.settings.tips = false;
        const pick = (s) => JSON.stringify({ attach: s.attach, training: s.training, tipsSeen: s.tipsSeen, ts: s.tutorialSeen, tips: s.settings.tips, kb: [s.settings.keybinds.quickMelee, s.settings.keybinds.report] });
        const file = await G.SaveFile.make();
        const back = await G.SaveFile.read(file.text);
        ok("D to a file and back: every expansion key as it was (" + gid + " x2, the Training Yard, tips, notes read)", pick(back.save) === pick(G.save), pick(back.save).slice(0, 160));
        const fx = await (await fetch("/tests/fixtures/save-v-current.json?r=" + Date.now())).json();
        const old = G.normalizeSave(fx), d0 = G.defaultSave();
        ok("D the old fixture: every new key there, as a new player's", old.training && old.training.done === false && old.tipsSeen && !Object.keys(old.tipsSeen).length
          && old.settings.tips === true && !!old.attach && typeof old.tutorialSeen === "object" && old.settings.keybinds.quickMelee === d0.settings.keybinds.quickMelee && old.settings.keybinds.report === d0.settings.keybinds.report);
        ok("D ...and through the file form unchanged", pick(G.SaveManager.fromDoc(G.SaveManager.toDoc(old))) === pick(old));
        const m = G.SaveFile.merge(old, back.save);
        ok("D two saves merged: the further one's expansion keys win", m.training.done === true && m.tipsSeen.boss === true && m.tutorialSeen[WN.key()] === true && !!(m.attach.loadout && m.attach.loadout[gid]));
        G.save = G.normalizeSave(JSON.parse(backup)); if (G.Attach) G.Attach.apply();
        await yield0();
      }

      // ================= E: one run with everything =================
      {
        startLevel(1);
        const gid = Object.keys(G.WEAPON_DEFS).find((id) => G.WEAPON_DEFS[id].magSize && G.Attach.allowed(G.WEAPON_DEFS[id], "optic").includes("x2"));
        const pl = g.player, d = G.WEAPON_DEFS[gid];
        if (!pl.ammo[gid]) { pl.ammo[gid] = { mag: d.magSize, reserve: d.magSize * 4 }; pl.weaponLevels[gid] = { dmg: 1, rate: 1, mag: 1 }; }
        if (!pl.gunSlots.includes(gid)) pl.gunSlots.push(gid);
        G.Attach.setAll(gid, { optic: "x2" });
        G.Forge.setTier(g, gid, 1);
        G.Melee.give(g, "bat");
        g.switchSlot(pl.gunSlots.indexOf(gid) + 1); step(60);
        const fired0 = pl.ammo[gid].mag;
        for (let i = 0; i < 3; i++) { G.onFirePress(); step(12); }
        ok("E the forged gun with its optic fires", pl.ammo[gid].mag < fired0 && G.Forge.tierOf(gid, g) === 1 && G.Attach.loadoutOf(d).optic === "x2", fired0 + " -> " + pl.ammo[gid].mag);
        g.reload(); step(150);
        ok("E ...and reloads", pl.ammo[gid].mag === (G.WEAPON_DEFS[gid].magSize || d.magSize), pl.ammo[gid].mag);
        G.onMeleePress(); step(70);
        ok("E the bat swings from any gun (quick melee)", pl.melee === "bat" && !(g.wsm && g.wsm.mel), g.wsm && g.wsm.state);
        g.switchSlot(0); step(40);
        ok("E switched to the melee slot: the bat in hand", g.currentWeaponId() === "melee" && pl.melee === "bat");
        g.switchSlot(pl.gunSlots.indexOf(gid) + 1); step(40);
        G.Forge.open(g, gid); await wait(20);
        ok("E the Word Forge's window over it: Mk II next", G.Dialog.isOpen() && $("dialog-box").textContent.indexOf(G.Forge.labelOf(2)) >= 0, G.Forge.labelOf(2));
        G.Dialog.close(); G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY";
        const rep = G.BugReport.collect(), w = rep.game && rep.game.weapon;
        ok("E a bug report knows the gun, its tier, its optic and the bat", !!w && w.id === gid && w.levels && w.levels.tier === 1 && w.attach && w.attach.optic === "x2" && w.melee === "bat" && rep.settings && "tips" in rep.settings, JSON.stringify(w).slice(0, 160));
        // wave 10's checkpoint, and back
        g.wave = 10;
        const cp = G.Checkpoint.save(g);
        ok("E the wave-10 checkpoint keeps the tier and the bat", !!cp && cp.player && cp.player.melee === "bat" && cp.player.weaponLevels[gid] && cp.player.weaponLevels[gid].tier === 1);
        g.quitToMainMenu(); G.Modal.reset();
        g.update = real; g.continueFromCheckpoint(1); g.update = () => {};
        G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; step(3);
        ok("E ...continued: wave 11, the forged gun and the bat back", g.wave === 11 && g.player.melee === "bat" && G.Forge.tierOf(gid, g) === 1 && g.player.gunSlots.includes(gid), g.wave + " " + g.player.melee + " " + G.Forge.tierOf(gid, g));
        toMenus();
        await yield0();
      }

      // ================= F: the files =================
      {
        const man = await (await fetch("/version.json?r=" + Date.now())).json();
        const files = man.files || {}, LIM = 25 * 1024 * 1024;
        const big = Object.keys(files).filter((p) => files[p].size >= LIM);
        const largest = Object.keys(files).reduce((a, p) => (files[p].size > (files[a] || { size: 0 }).size ? p : a), "");
        numbers.files = Object.keys(files).length; numbers.largest = largest + " " + Math.round(files[largest].size / 1024) + " KB";
        numbers.totalMB = +(Object.keys(files).reduce((s, p) => s + files[p].size, 0) / 1048576).toFixed(2);
        ok("F none of the site's files at 25 MiB or more (largest: " + numbers.largest + ")", !big.length, big.join());
        const scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src").split("?")[0]).filter((s) => !/^https?:/.test(s));
        // (one at a time: the dev server answers one request at a time)
        const res = [];
        for (const s of scripts) res.push(await fetch(s + "?r=" + Date.now()).then((r) => (r.ok ? null : s + " " + r.status)).catch(() => s + " ?"));
        ok("F every script of the page is on the server (" + scripts.length + ")", res.every((x) => !x), res.filter(Boolean).join());
      }

      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      G.CONFIG.expansion.whatsNew = true;
      I.padActive = false; I.mode = "desktop";
      Object.keys(I.keys).forEach((k) => { I.keys[k] = false; });
      G.Spawner.update = spawn0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      if (G.BugReport && G.BugReport.shown) G.BugReport.close();
      if (G.ForgeScene && G.ForgeScene.active) G.ForgeScene.skip();
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist(true);   // (written now: the runner closes the browser right after)
      if (G.Attach) G.Attach.apply();
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
