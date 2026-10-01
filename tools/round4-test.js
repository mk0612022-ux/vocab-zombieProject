// Dev-only (not shipped). Round 4 checks: the lobby carousel -- its modes,
// tabs and icons, the artwork files, locks and stats, and every way of
// driving it (keys, wheel, swipe, tap, gamepad), the hints for each device,
// the animation timings and the launch into each mode. The save is put back
// afterwards.
//   const r = await G.Round4Test.run();   r.fail -> []
window.G = window.G || {};
G.Round4Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  // a message, not a timer: timers crawl in a hidden tab
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const until = async (fn, ms) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await tick(); return fn(); };
  const key = (code) => G.onKeyDown({ code, key: code, preventDefault() {}, stopPropagation() {} });
  const L = () => G.Lobby;
  const cur = () => L().current().id;

  // a pretend controller: press(buttons...) for one poll, then let go
  function pad(buttons, axes) {
    const b = []; for (let i = 0; i < 17; i++) b.push({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 });
    return { buttons: b, axes: axes || [0, 0, 0, 0] };
  }
  function padPress(btn, axes) {
    const P = G.Pad, real = G.Input.pollGamepad;
    G.Input.pollGamepad = () => pad(btn == null ? [] : [btn], axes); P.poll(1 / 60);
    G.Input.pollGamepad = () => pad([]); P.poll(1 / 60);
    G.Input.pollGamepad = real;
  }

  async function run() {
    results.length = 0;
    const saved = JSON.stringify(G.save);
    G._missingKeys = {};
    const realLaunchDelay = L().instant;
    try {
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
      G.Game.state = "MENU";
      const root = document.getElementById("lobby");
      ok("lobby is the main menu", !!root && !document.getElementById("screen-mainmenu").classList.contains("hidden"));
      ok("two tabs: CAMPAIGN, TRAINING & CUSTOM", root.querySelectorAll(".lobby-tab").length === 2 && /CAMPAIGN/.test(root.querySelector(".lobby-tab").textContent));
      const icons = Array.from(root.querySelectorAll(".lobby-icon")).map((b) => b.dataset.icon);
      ok("icon bar: settings, leaderboard, achievements, weapon log, word log, notes journal", ["settings", "leaderboard", "achievements", "armory", "wordlog", "journal"].every((k) => icons.includes(k)), icons.join(","));
      ok("FEATURED heading", /FEATURED/.test(root.querySelector(".lobby-featured").textContent));
      const ids = L().MODES.map((m) => m.id);
      ok("seven modes", ["school", "hospital", "bunker", "endless", "daily", "practice", "custom"].every((k) => ids.includes(k)), ids.join(","));
      ok("campaign tab: school, hospital, bunker, endless, daily", L().modes("campaign").map((m) => m.id).join() === "school,hospital,bunker,endless,daily");
      // (vocabulary series, round 2: Daily Review and Learning Modes first)
      ok("training tab: review, learn, practice, custom", L().modes("training").map((m) => m.id).join() === "review,learn,practice,custom");
      ok("every mode its own colours", new Set(L().MODES.map((m) => m.c1)).size === L().MODES.length);
      ok("school is FEATURED, daily a DAILY EVENT, practice TRAINING, custom CREATIVE",
        L().MODES.find((m) => m.id === "school").badge === "featured" && L().MODES.find((m) => m.id === "daily").badge === "daily" && L().MODES.find((m) => m.id === "practice").badge === "training" && L().MODES.find((m) => m.id === "custom").badge === "creative");

      // artwork: two files a mode, rendered from the game (tools/art-render.js)
      const files = [];
      L().MODES.forEach((m) => files.push(L().art(m, false), L().art(m, true)));
      const sizes = await Promise.all(files.map((f) => new Promise((res) => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res(null); im.src = f + "?t=" + Date.now(); })));
      ok("artwork: every mode has a 16:9 preview and a portrait card", sizes.every(Boolean) && sizes.every((s, i) => (i % 2 ? s[1] > s[0] : Math.abs(s[0] / s[1] - 16 / 9) < 0.01)), files.filter((f, i) => !sizes[i]).join(","));

      // locks
      G.save.unlockedLevels = [1];
      G.UI.goToMainMenu({ tab: "campaign", select: "hospital" });
      ok("hospital locked until the school is cleared", L().locked(L().current()) && root.querySelector('.lcard[data-id="hospital"]').classList.contains("locked") && /Abandoned School/.test(document.getElementById("lp-lock").textContent));
      ok("a locked card shows a lock", !!root.querySelector('.lcard[data-id="hospital"] .lcard-lock'));
      ok("bunker locked until the hospital is cleared", L().locked(L().MODES.find((m) => m.id === "bunker")) && /Hospital/.test(G.T("lobby.unlock.bunker")));
      const stateBefore = G.Game.state;
      key("Enter");
      await tick();
      ok("choosing a locked mode does nothing but shake", G.Game.state === stateBefore && !L()._launching && root.querySelector('.lcard[data-id="hospital"]').classList.contains("shake"));
      G.save.unlockedLevels = [1, 2];
      G.UI.goToMainMenu({ tab: "campaign", select: "hospital" });
      ok("clearing the school opens the hospital", !L().locked(L().current()) && !root.querySelector('.lcard[data-id="hospital"]').classList.contains("locked"));
      G.save.unlockedLevels = [1];

      // the preview's facts
      G.save.notes.level1 = ["s01", "s02", "s03"];
      G.save.levelHighScores[1] = 12345;
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
      const stats = document.getElementById("lp-stats").textContent;
      ok("preview: high score, notes X/20, words X/(level's word families), guns", /12,345/.test(stats) && /3 \/ 20/.test(stats) && new RegExp("/ " + G.WORDS_LEVEL_1.length).test(stats) && /Guns found/i.test(stats), stats);
      ok("preview: title, description, badge", /Abandoned School/i.test(document.getElementById("lp-title").textContent) && document.getElementById("lp-desc").textContent.length > 40 && /FEATURED/.test(document.getElementById("lp-badge").textContent));
      G.UI.goToMainMenu({ tab: "campaign", select: "daily" });
      ok("daily: a countdown to the next challenge", /\d\d:\d\d:\d\d/.test(document.getElementById("lp-stats").textContent) && /\d\d:\d\d:\d\d/.test(root.querySelector('.lcard[data-id="daily"] .lcard-meta').textContent));

      // keyboard (from a known start: a test run before this one can leave
      // the training tab on another card)
      L().sel.training = 0;
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
      key("ArrowRight"); ok("→ moves right", cur() === "hospital");
      key("KeyD"); ok("D moves right", cur() === "bunker");
      key("ArrowLeft"); key("KeyA"); ok("← and A move left", cur() === "school");
      key("ArrowLeft"); ok("the row ends: stays on the first card", cur() === "school");
      key("KeyE"); ok("E: next tab", L().tab === "training" && cur() === "review");
      key("KeyQ"); ok("Q: previous tab, the selection remembered", L().tab === "campaign" && cur() === "school");
      ok("selected card: centred, bigger, ringed", (() => { const c = root.querySelector(".lcard.sel"); return c && c.dataset.id === "school" && /scale\(1\.12\)/.test(c.style.transform) && /translateX\(0%\)/.test(c.style.transform); })());
      L().iconI = 0;
      key("ArrowUp"); ok("↑ moves up to the icon row", L().focus === "icons" && root.querySelector(".lobby-icon.pad-focus"));
      key("ArrowRight"); key("Enter");
      ok("Enter on an icon opens it (leaderboard)", G.UI._currentScreen === "screen-leaderboard");
      G.UI.goToMainMenu();
      key("ArrowDown"); ok("↓ back to the cards", L().focus === "cards");

      // mouse wheel and a swipe
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
      const car = document.getElementById("lobby-carousel");
      L()._wheelAt = 0;
      car.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
      ok("mouse wheel: one card a notch", cur() === "hospital");
      const pe = (type, x) => car.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 300, pointerId: 7, pointerType: "touch", bubbles: true }));
      // (an unhurried swipe moves one card; a fling moves two)
      pe("pointerdown", 500); pe("pointermove", 420); await until(() => false, 220); pe("pointermove", 380); pe("pointerup", 380);
      ok("swipe left: next card", cur() === "bunker");
      ok("touch shows the touch hints", document.body.dataset.input === "touch" && getComputedStyle(root.querySelector(".lobby-hints .touch-only")).display !== "none");
      pe("pointerdown", 300); pe("pointermove", 400); await until(() => false, 220); pe("pointerup", 420);
      ok("swipe right: previous card", cur() === "hospital");
      pe("pointerdown", 300); pe("pointermove", 420); pe("pointerup", 520);
      ok("a fast fling: two cards", cur() === "school");
      await until(() => false, 300);
      root.querySelector('.lcard[data-id="hospital"]').click();
      ok("tap a side card: selects it", cur() === "hospital" && !L()._launching);
      root.querySelector('.lcard[data-id="school"]').click();
      ok("tap a side card: selects it", cur() === "school" && !L()._launching);

      // gamepad
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
      const B = G.Pad.B;
      padPress(B.RIGHT); ok("D-pad right", cur() === "hospital");
      padPress(null, [-0.9, 0, 0, 0]); ok("stick left", cur() === "school");
      padPress(B.RB); ok("RB: next tab", L().tab === "training");
      padPress(B.LB); ok("LB: previous tab", L().tab === "campaign");
      ok("controller hints", document.body.dataset.input === "pad" && getComputedStyle(root.querySelector(".lobby-hints .pad-only")).display !== "none" && getComputedStyle(root.querySelector(".lobby-hints .kb-only")).display === "none");
      L().iconI = 0;
      padPress(B.UP); padPress(B.A);
      ok("controller: up to the icons, A opens (settings)", G.UI._currentScreen === "screen-settings");
      G.UI.goToMainMenu();
      key("Escape");
      L().setDevice("kb");
      ok("keyboard hints", getComputedStyle(root.querySelector(".lobby-hints .kb-only")).display !== "none" && getComputedStyle(root.querySelector(".lobby-hints .touch-only")).display === "none");

      // animation: transform/opacity, 300-450 ms, console ease
      const cs = getComputedStyle(root.querySelector(".lcard"));
      const durs = cs.transitionDuration.split(",").map((s) => parseFloat(s) * 1000);
      ok("cards animate transform and opacity in 300-450 ms", /transform/.test(cs.transitionProperty) && /opacity/.test(cs.transitionProperty) && durs.every((d) => d >= 300 && d <= 450), cs.transitionProperty + " " + cs.transitionDuration);
      ok("console ease-out curve", /cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(cs.transitionTimingFunction));
      const img = getComputedStyle(root.querySelector(".lp-img"));
      ok("preview crossfades (opacity, 450 ms)", /opacity/.test(img.transitionProperty) && Math.abs(parseFloat(img.transitionDuration) - 0.45) < 0.01);
      ok("preview slowly zooms", root.querySelector(".lp-img.on").classList.contains("zoom"));

      // launching: zoom in, fade out, then the mode
      G.UI.goToMainMenu({ tab: "training", select: "practice" });
      key("Enter");
      ok("choosing zooms in and fades", root.classList.contains("launching"));
      await until(() => G.UI._currentScreen === "screen-practice-setup", 8000);
      ok("... then opens the mode (practice setup)", G.UI._currentScreen === "screen-practice-setup");
      G.Game.quitToMainMenu();
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
      key("Space");
      await until(() => G.Game.state === "GAMEPLAY", 15000);
      ok("Space on the school starts it", G.Game.state === "GAMEPLAY" && G.Game.level && G.Game.level.id === 1);
      G.Game.quitToMainMenu();
      ok("back in the lobby after quitting", G.UI._currentScreen === "screen-mainmenu" && !root.classList.contains("launching"));
      G.Game.goToLevelSelect();
      ok("Level Select (from the victory screen) is the lobby's campaign tab", G.UI._currentScreen === "screen-mainmenu" && L().tab === "campaign");
      ok("How to Play has the tutorial replay", !!document.querySelector("#screen-howtoplay #btn-tutorial-replay"));
      // a screen shown again before the last one finished fading out stays up
      G.UI.showScreen("screen-howtoplay"); G.UI.showScreen("screen-mainmenu"); G.UI.showScreen("screen-howtoplay");
      await until(() => false, 400);
      // (the one underneath goes when its fade-out timer fires -- late in a
      // background tab -- so it may still be fading)
      const under = document.getElementById("screen-mainmenu").classList;
      ok("going back and forth fast never hides the screen on top", !document.getElementById("screen-howtoplay").classList.contains("hidden") && (under.contains("hidden") || under.contains("fade-out")));
      // the touch layout editor opened from the menu before any run: no player
      // yet (the perk icons threw), and its preview of the school baked like
      // a run (drawn raw since round 3 it froze the page)
      G.Game.quitToMainMenu();
      const pl = G.Game.player; G.Game.player = null;
      let tcErr = null, tcCalls = -1;
      try { G.TouchCfg.openEditor(); G.Game.renderLayoutPreviewFrame(); tcCalls = G.Game.renderer.info.render.calls; } catch (e) { tcErr = String(e); }
      try { G.TouchCfg.closeEditor(); } catch (e) { tcErr = tcErr || String(e); }
      G.Game.player = pl;
      ok("touch layout editor from the menu: opens, preview baked (draw calls)", !tcErr && tcCalls > 0 && tcCalls < 600, tcErr || tcCalls);
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.save = JSON.parse(saved);
      L().instant = realLaunchDelay;
      L().setDevice("kb");
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.UI.goToMainMenu({ tab: "campaign", select: "school" });
    }
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results };
  }
  return { run };
})();
