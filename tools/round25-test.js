// Dev-only (not shipped). The overhaul, round 5: the Main Menu --
// js/mainmenu.js (the menu, its keys, its sounds), js/menuscene.js (the
// underground corridor, the survivor), the lobby's Back.
//   A  the way in: Loading -> the Main Menu -> PLAY -> the lobby -> Back; a
//      level leaves the scene waiting, silent, and Back finds it at once
//   B  the menu: twelve items in four groups, the logo, the corner (Guest,
//      Sign In, the version), the sound hint, the Daily Review badge
//   C  keys, a controller, a mouse and a finger, and the sound of each
//   D  every page from the menu, over the scene, and Back to it; a third of
//      the frames under a page, none in a hidden tab
//   E  the scene: shaders compiled first, draw calls, the lights (no flashing),
//      the survivor's idle and the hands on the rifle, the frame at each
//      aspect, Reduce Motion, another graphics tier, the memory let go
//   F  the facility's sound; Settings' Reduce Motion and the save; the words
//      in four languages
// Load it into the game (in the lobby), then:
//   const r = await G.Round25Test.run();   r.fail -> [] when everything passes
//   r.numbers: build time, draw calls, memory before and after letting go, frame time
window.G = window.G || {};
G.Round25Test = (function () {
  const results = [], numbers = {};
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const key = (code) => window.dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true }));
  const pad = (buttons, axes) => { const b = []; for (let i = 0; i < 17; i++) b.push({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 }); return { id: "Test Pad (STANDARD GAMEPAD)", buttons: b, axes: axes || [0, 0, 0, 0] }; };
  const padPress = (btn, axes) => {
    const P = G.Pad, real = G.Input.pollGamepad;
    G.Input.pollGamepad = () => pad(btn == null ? [] : [btn], axes); P.poll(1 / 60);
    G.Input.pollGamepad = () => pad([]); P.poll(1 / 60);
    G.Input.pollGamepad = real;
  };
  const M = () => G.MainMenu;
  const home = () => M().visible();
  const inLobby = () => G.UI._currentScreen === "screen-mainmenu" && !home();
  // (G.Input.mode: "desktop" or "touch"; the body's data-input: kb, pad or touch)
  const device = (d) => { G.Input.mode = d === "touch" ? "touch" : "desktop"; document.body.dataset.input = d; };
  // what the menu played (G.Audio.sfx, watched while the suite runs)
  let played = [];
  const count = (n) => played.filter((x) => x === n).length;
  const sound = () => !!(G.Audio.ctx && G.Audio.ctx.state === "running");

  // ---------------- A: the way in ----------------
  async function flow() {
    G.Modal.reset();
    M().show();
    ok("A the Main Menu: its own screen, the game in MENU, no HUD", home() && !$("screen-home").classList.contains("hidden") && G.Game.state === "MENU" && $("hud").classList.contains("hidden"));
    ok("A its scene built, drawn by the game's own renderer", !!M().scene && M().scene.scene.isScene && M().scene.camera.isPerspectiveCamera);
    G.save.settings.brightnessSet = true;
    M().activate("play");
    ok("A PLAY: the lobby", inLobby() && G.UI.menuOrigin === "lobby");
    ok("A the lobby: a Back button", !!$("lobby-back") && $("lobby-back").textContent.includes(G.T("lobby.back")));
    $("lobby-back").click();
    ok("A Back: the Main Menu again", home() && G.UI.menuOrigin === "home");
    M().activate("play"); key("Escape");
    ok("A Esc in the lobby: the Main Menu", home());
    M().activate("play"); G.Pad.clearFocus(); padPress(G.Pad.B.B);
    ok("A B on a controller in the lobby: the Main Menu", home());
    // a level: the facility falls silent, the scene waits undrawn; out of it, the lobby, then Back
    M().activate("play");
    G.Input.requestPointerLock = function () {};
    const sc0 = M().scene;
    G.Game.startLevel(1);
    let drawn = 0;
    const up0 = sc0.update;
    sc0.update = function () { drawn++; return up0.apply(this, arguments); };
    try { for (let i = 0; i < 3; i++) M().frame(1 / 60); } finally { sc0.update = up0; }
    ok("A a level: the facility falls silent, the menu's scene kept but not drawn, the High pass's target let go", M().scene === sc0 && !drawn && !M()._amb && (!M().post || !M().post.rt) && G.Game.state !== "MENU" && !!G.Game.scene);
    G.Game.quitToMainMenu();
    ok("A out of the level: the lobby, where it was started from", inLobby());
    const t0 = performance.now();
    M().back();
    numbers.backMs = Math.round(performance.now() - t0);
    ok("A ...and Back: the Main Menu at once, the same scene (nothing to build or compile)", home() && M().scene === sc0 && numbers.backMs < 400, numbers.backMs + " ms");
  }

  // ---------------- B: the menu ----------------
  function menu() {
    M().show();
    const items = Array.from(document.querySelectorAll("#home-menu .hm-item")).map((b) => b.dataset.item);
    ok("B twelve items: PLAY first, then Daily Review, the pages, Settings, Help", items.join() === "play,review,progress,vocab,notes,custom,weapons,bosses,ranks,awards,settings,help", items.join());
    const groups = Array.from(document.querySelectorAll("#home-menu .hm-group")).map((g) => g.dataset.group);
    ok("B four groups -- play, learn, collection, system -- thin lines between", groups.join() === "play,learn,collect,system" && document.querySelectorAll("#home-menu .hm-sep").length === 3, groups.join());
    ok("B PLAY stands out", document.querySelector('.hm-item[data-item="play"]').classList.contains("primary"));
    const due = G.SRS.dueToday().length, badge = $("home-due");
    ok("B Daily Review: a badge with the words due today", due ? !badge.classList.contains("hidden") && badge.textContent === (due > 99 ? "99+" : String(due)) : badge.classList.contains("hidden"), due);
    const svg = document.querySelector(".home-logo svg");
    ok("B the logo: drawn as SVG over the scene, named for screen readers", !!svg && svg.getAttribute("aria-label") === "VOCAB ZOMBIE: IELTS SURVIVAL" && svg.querySelectorAll("rect").length > 100);
    ok("B the corner: Guest, Sign In, the version", $("home-name").textContent === G.T("account.guest") && !$("home-signin").classList.contains("hidden") && $("screen-home").querySelector("[data-version]").textContent === G.Updater.label());
    M().wake(true);
    ok("B 'Click / tap to enable sound' until the sound can start", $("home-sound").classList.contains("gone") === sound() && $("home-sound").textContent.includes(G.T("home.sound")), sound());
    const cs = getComputedStyle($("home-menu"));
    ok("B the panel: dark green, see-through, a green edge", cs.backgroundColor === "rgba(8, 14, 10, 0.72)" && cs.borderTopColor === "rgb(94, 122, 85)", cs.backgroundColor + " " + cs.borderTopColor);
  }

  // ---------------- C: keys, a controller, a mouse, a finger ----------------
  async function input() {
    M().show();
    device("kb");
    M().focusI = 0; M().mark();
    played = [];
    key("ArrowDown");
    ok("C ↓ moves down (Daily Review), marked", M().focusI === 1 && M().btns[1].classList.contains("pad-focus") && !M().btns[0].classList.contains("pad-focus"));
    key("KeyS"); key("ArrowUp"); key("KeyW");
    ok("C S, ↑, W too", M().focusI === 0);
    key("ArrowUp");
    ok("C up from the top: round to the bottom (Help)", M().focusI === 11);
    key("ArrowDown");
    if (sound()) ok("C a tick for each move", count("ui_hover") === 6, count("ui_hover"));
    // the mouse: once on entering a button
    const pe = (el, type, pt) => el.dispatchEvent(new PointerEvent(type, { pointerType: pt, bubbles: false }));
    played = [];
    const b3 = M().btns[3];
    pe(b3, "pointerenter", "mouse"); pe(b3, "pointermove", "mouse"); pe(b3, "pointerenter", "mouse");
    if (sound()) {
      ok("C the mouse: one tick on entering a button, not again while on it", count("ui_hover") === 1, count("ui_hover"));
      pe(b3, "pointerleave", "mouse"); pe(b3, "pointerenter", "mouse");
      ok("C ...one more on coming back to it", count("ui_hover") === 2, count("ui_hover"));
      played = [];
      pe(M().btns[4], "pointerenter", "touch");
      ok("C a finger: no hover tick", count("ui_hover") === 0);
    }
    // a finger: big enough to tap
    device("touch"); M().mark();
    const h = Math.min(...M().btns.map((b) => b.offsetHeight));
    ok("C touch: every item at least 44 px tall, no focus ring", h >= 44 && !document.querySelector("#home-menu .pad-focus"), Math.round(h));
    device("kb");
    // Enter, Esc
    M().focusI = 2; M().mark();
    key("Escape");
    ok("C Esc on the menu: back up to PLAY", M().focusI === 0);
    played = [];
    key("Enter");
    ok("C Enter on PLAY: the lobby" + (sound() ? ", with its sound" : ""), inLobby() && (!sound() || count("ui_select") === 1));
    played = [];
    key("Escape");
    ok("C Esc in the lobby: back" + (sound() ? ", with its sound" : ""), home() && (!sound() || count("ui_back") === 1));
    M().activate("play");
    key("ArrowUp");
    ok("C the lobby: ↑ to its Back button", G.Lobby.focus === "back" && $("lobby-back").classList.contains("pad-focus"));
    key("Enter");
    ok("C ...Enter on it: the Main Menu", home());
    // a controller
    G.Pad.clearFocus();
    M().focusI = 0; M().mark();
    padPress(G.Pad.B.DOWN);
    ok("C controller: D-pad down", M().focusI === 1);
    padPress(null, [0, -0.9, 0, 0]);
    ok("C controller: the stick up", M().focusI === 0);
    padPress(G.Pad.B.A);
    ok("C controller: A on PLAY, the lobby", inLobby());
    padPress(G.Pad.B.UP); padPress(G.Pad.B.A);
    ok("C controller: up to Back in the lobby, A", home());
    G.Pad.clearFocus(); device("kb");
  }

  // ---------------- D: the pages ----------------
  async function pages() {
    const PAGES = [["progress", "screen-progress", "btn-progress-back"], ["vocab", "screen-vocablog", "btn-vocablog-back"], ["notes", "screen-journal", "btn-journal-back"],
      ["custom", "screen-customvocab", "btn-cv-back"], ["weapons", "screen-weaponlog", "btn-weaponlog-back"], ["bosses", "screen-bosses", "btn-codex-back"],
      ["ranks", "screen-leaderboard", "btn-leaderboard-back"], ["awards", "screen-achievements", "btn-achievements-back"], ["settings", "screen-settings", "btn-settings-back"],
      ["help", "screen-howtoplay", "btn-howtoplay-back"]];
    const bad = [];
    for (const [id, scr, back] of PAGES) {
      M().show();
      played = [];
      M().activate(id);
      await wait(20);
      const opened = G.UI._currentScreen === scr, over = M().over() && document.body.classList.contains("over-home");
      const see = /rgba\(6, 11, 8, 0\.78\)/.test(getComputedStyle($(scr)).backgroundImage);
      const snd = !sound() || count("ui_open") === 1;
      $(back).click();
      await wait(20);
      const back2 = home() && !document.body.classList.contains("over-home");
      if (!(opened && over && see && snd && back2)) bad.push(id + ":" + [opened, over, see, snd, back2].map(Number).join(""));
    }
    ok("D every page opens from the menu over the scene (see-through), and its Back comes home", !bad.length, bad.join(" "));
    // Daily Review: today's session, or "all caught up"
    M().show();
    const realLaunch = G.Study.launch;
    let launched = null;
    G.Study.launch = (s) => { launched = s; };
    try { M().activate("review"); } finally { G.Study.launch = realLaunch; }
    ok("D Daily Review: today's session, or 'all caught up' when nothing is due", launched ? !!launched.cards : G.Dialog.isOpen());
    G.Dialog.close();
    // a third of the frames under a page; none in a hidden tab
    M().show();
    const S0 = M().scene, up = S0.update;
    let n = 0;
    S0.update = function () { n++; return up.apply(this, arguments); };
    try {
      M().activate("help");
      for (let i = 0; i < 9; i++) M().frame(1 / 60);
      const under = n;
      n = 0;
      $("btn-howtoplay-back").click();
      for (let i = 0; i < 9; i++) M().frame(1 / 60);
      const full = n;
      ok("D a page over the scene: a third of the frames (it still moves); on the menu, every one", under === 3 && full === 9, under + " / " + full);
      n = 0;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      try { for (let i = 0; i < 9; i++) M().frame(1 / 60); } finally { delete document.hidden; }
      ok("D a hidden tab: nothing drawn", n === 0 && !document.hidden, n);
    } finally { S0.update = up; }
  }

  // ---------------- E: the scene ----------------
  async function scene() {
    M().show();
    const r = G.Game.renderer;
    // built again from nothing: every shader compiled before the first frame
    M().dispose();
    M().makeScene();
    const progs = r.info.programs.length;
    M().frame(1 / 60);
    const hi = /high/.test(G.save.settings.graphicsQuality);
    ok("E shaders compiled with the build: nothing new on the first frame", r.info.programs.length - progs <= (hi ? 1 : 0), progs + " -> " + r.info.programs.length + (hi ? " (High: the shadow's own)" : ""));
    numbers.buildMs = Math.round(M().buildMs);
    ok("E built and compiled in under 5 s (no long freeze, even on a busy machine)", M().buildMs < 5000, numbers.buildMs + " ms");
    M().frame(1 / 60);
    numbers.calls = r.info.render.calls; numbers.triangles = r.info.render.triangles;
    ok("E one frame: under 80 draw calls", numbers.calls > 10 && numbers.calls < 80, numbers.calls + " calls, " + numbers.triangles + " triangles");
    const S = M().scene, L = S.live, sv = S.survivor;
    ok("E the lights: red at the door, a teal rim on the survivor, a warm lamp over them", !!L.red && L.rim && L.rim.color.getHex() === 0x3fc1b0 && !!L.key && L.rim.target.position.distanceTo(sv.root.position) < 1.5);
    // over a minute: the lights breathe and flicker, never the whole scene in a flash
    const lights = [];
    S.scene.traverse((o) => { if (o.isLight && !o.isHemisphereLight) lights.push(o); });
    let t = 0, prev = null, jump = 0, lo = Infinity, hi2 = 0;
    const neck = [Infinity, -Infinity], hips = [Infinity, -Infinity], pack = [Infinity, -Infinity];
    let gripOff = 0, foreNear = Infinity;
    const hand = (arm) => new THREE.Vector3(0, -0.33, 0.01).applyMatrix4(arm.el.matrixWorld);
    for (let i = 0; i < 30 * 60; i++) {
      t += 1 / 30;
      S.update(1 / 30, t, true);
      const sum = lights.reduce((a, l) => a + l.intensity, 0);
      if (prev !== null) jump = Math.max(jump, Math.abs(sum - prev) / Math.max(0.01, prev));
      prev = sum; lo = Math.min(lo, sum); hi2 = Math.max(hi2, sum);
      neck[0] = Math.min(neck[0], sv.neck.rotation.y); neck[1] = Math.max(neck[1], sv.neck.rotation.y);
      hips[0] = Math.min(hips[0], sv.hips.position.x); hips[1] = Math.max(hips[1], sv.hips.position.x);
      pack[0] = Math.min(pack[0], sv.pack.rotation.y); pack[1] = Math.max(pack[1], sv.pack.rotation.y);
      if (i % 15 === 0 && sv.grip) {
        sv.root.updateMatrixWorld(true);
        gripOff = Math.max(gripOff, hand(sv.L.armR).distanceTo(sv.upper.localToWorld(sv.grip.clone())));
        foreNear = Math.min(foreNear, hand(sv.L.armL).distanceTo(sv.upper.localToWorld(sv.fore.clone())));
      }
    }
    ok("E the lights: no frame more than 20% brighter or darker than the last (no flashing)", jump < 0.2 && lo > 0, "largest step " + Math.round(jump * 100) + "%, " + lo.toFixed(2) + "-" + hi2.toFixed(2));
    ok("E the survivor: looks to the door and to the dark", neck[1] > 0.5 && neck[0] < -0.4, neck.map((v) => v.toFixed(2)).join(" .. "));
    ok("E ...shifts its weight, and the pack swings after the body", hips[1] - hips[0] > 0.03 && pack[1] - pack[0] > 0.02, (hips[1] - hips[0]).toFixed(3) + " / " + (pack[1] - pack[0]).toFixed(3));
    ok("E ...the right hand on the rifle's grip, the left on its fore-end (but for the strap)", sv.grip && gripOff < 0.05 && foreNear < 0.05, gripOff.toFixed(3) + " / " + foreNear.toFixed(3));
    // every aspect: the door in the middle, the survivor to the right of it, in frame
    const ndc = (v) => v.clone().project(S.camera);
    const bad = [];
    for (const [w, h, name] of [[1600, 900, "16:9"], [1200, 900, "4:3"], [1950, 900, "19.5:9"], [2100, 900, "21:9"], [900, 1600, "upright"]]) {
      S.fit(w, h); S.update(1 / 60, 100, false); S.camera.updateMatrixWorld(true);
      const door = ndc(S.sounds.door), head = ndc(sv.root.position.clone().setY(2.0)), feet = ndc(sv.root.position.clone().setY(0.3));
      const doorIn = Math.abs(door.x) < 0.35 && Math.abs(door.y) < 0.6;
      const svIn = (name === "upright" ? Math.abs(head.x) < 0.9 : head.x > 0.2 && head.x < 0.9) && head.y < 1 && feet.y > -1;
      if (!(doorIn && svIn)) bad.push(name + ": door " + door.x.toFixed(2) + "," + door.y.toFixed(2) + " head " + head.x.toFixed(2) + "," + head.y.toFixed(2) + " feet " + feet.y.toFixed(2));
    }
    S.fit(window.innerWidth, window.innerHeight);
    ok("E 16:9, 4:3, 19.5:9, 21:9 and upright: the door in the middle, the survivor whole, to its right", !bad.length, bad.join("; "));
    // Reduce Motion: the camera still
    const s = G.save.settings, rm = s.reduceMotion;
    S.point(1, 0.8);
    s.reduceMotion = true;
    for (let i = 0; i < 30; i++) M().frame(1 / 30);
    const a = S.camera.position.clone(), qa = S.camera.quaternion.clone();
    for (let i = 0; i < 30; i++) M().frame(1 / 30);
    ok("E Reduce Motion: no sway, no parallax", a.distanceTo(S.camera.position) < 1e-6 && qa.angleTo(S.camera.quaternion) < 1e-6);
    s.reduceMotion = false;
    for (let i = 0; i < 30; i++) M().frame(1 / 30);
    const b = S.camera.position.clone();
    for (let i = 0; i < 30; i++) M().frame(1 / 30);
    ok("E ...without it: the camera sways and leans after the pointer", b.distanceTo(S.camera.position) > 1e-4);
    s.reduceMotion = rm; S.point(0, 0);
    // the time a frame takes here (the scene's update and its draw)
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) M().frame(1 / 60);
    numbers.frameMs = +((performance.now() - t0) / 60).toFixed(2);
    // another graphics tier chosen in Settings: built again for it
    const q0 = G.save.settings.graphicsQuality, sc1 = M().scene;
    G.save.settings.graphicsQuality = q0 === "low" ? "medium" : "low";
    M().frame(1 / 60);
    ok("E another graphics tier in Settings: the scene built again for it", !!M().scene && M().scene !== sc1 && M().quality === G.save.settings.graphicsQuality);
    G.save.settings.graphicsQuality = q0;
    M().frame(1 / 60);
    // let go: the memory comes back
    const m0 = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
    M().dispose();
    const m1 = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
    numbers.memory = { before: m0, after: m1 };
    ok("E let go (the Zombie Gallery, a new tier): its geometry and textures freed", !M().scene && m0.geometries - m1.geometries >= 20 && m1.textures < m0.textures, "geometries " + m0.geometries + " -> " + m1.geometries + ", textures " + m0.textures + " -> " + m1.textures);
    M().show();
    ok("E ...and built again when the menu comes back", !!M().scene);
  }

  // ---------------- F: sound, the setting, the words ----------------
  async function rest() {
    M().show();
    if (sound()) {
      M().wake(true);
      ok("F with the sound on: the menu's music and the facility (fan, panels, door, wind)", !!G.Audio._menu && !!M()._amb && M()._amb.nodes.length >= 7, M()._amb && M()._amb.nodes.length);
      ok("F ...in an underground room's reverb", !G.Acoustics || G.Acoustics.zone === "underground", G.Acoustics && G.Acoustics.zone);
      const Am = M()._amb;
      Am.next = 0;
      let thrown = null;
      try { M().ambienceTick(0.1); } catch (e) { thrown = e.message; }
      ok("F now and then a sound of its own (a creak, a knock in the dark, a pipe)", !thrown && Am.next > G.Audio.ctx.currentTime, thrown || "");
    }
    // the setting
    const s = G.save.settings, rm = s.reduceMotion;
    ok("F Reduce Motion: off in a new save", G.normalizeSave({ unlockedLevels: [1] }).settings.reduceMotion === false);
    ok("F ...an older save gets it too; a stray value made true or false", G.normalizeSave({ unlockedLevels: [1], settings: { reduceMotion: 1 } }).settings.reduceMotion === true && G.normalizeSave({ unlockedLevels: [1], settings: {} }).settings.reduceMotion === false);
    M().activate("settings");
    G.SettingsUI.select("accessibility");
    const box = $("set-reducemotion");
    ok("F Settings > Accessibility: a Reduce Motion switch", !!box && box.closest(".set-sec").id === "set-sec-accessibility");
    box.click();
    ok("F ...it sets the save", s.reduceMotion === !rm);
    box.click();
    s.reduceMotion = rm;
    $("btn-settings-back").click();
    // the words
    const KEYS = ["home.menu", "home.sound", "home.rotate", "lobby.back", "settings.reduceMotion", "settings.reduceMotionDesc"]
      .concat(["play", "learn", "collect", "system"].map((g) => "home.group." + g), M().items().map((i) => "home.item." + i));
    // (the other languages' files come when first asked for)
    const lang = G.lang, use = (code) => new Promise((res) => G.setUILang(code, { done: res }));
    M().show();
    await use("th");
    const th = document.querySelector('.hm-item[data-item="play"] .hm-label').textContent;
    await use("zh"); await use("fr");
    await use(lang);
    const back = document.querySelector('.hm-item[data-item="play"] .hm-label').textContent;
    const miss = [];
    ["en", "th", "zh", "fr"].forEach((l) => KEYS.forEach((k) => { if (!G.STRINGS[l] || !G.STRINGS[l][k]) miss.push(l + ":" + k); }));
    ok("F the menu's words in all four languages", !miss.length, miss.join());
    ok("F another language: the menu written again at once", th === G.STRINGS.th["home.item.play"] && back === G.T("home.item.play"), th + " / " + back);
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save), realLock = G.Input.requestPointerLock, mode = G.Input.mode, input0 = document.body.dataset.input, lang0 = G.lang;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    G._missingKeys = {};
    const A = G.Audio, realSfx = A.sfx;
    A.sfx = function (n) { played.push(n); return realSfx.apply(this, arguments); };
    try {
      if (A.unlock) A.unlock();
      G.save.settings.controlMode = "auto"; device("kb");
      // (on High: the shadows and the pass after the scene are part of it)
      G.save.settings.graphicsQuality = "high";
      if (M().scene) M().dispose();
      await flow();
      menu();
      await input();
      await pages();
      await scene();
      await rest();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      A.sfx = realSfx;
      G.Input.requestPointerLock = realLock;
      G.Input.mode = mode; document.body.dataset.input = input0; G.Input.padActive = false;
      G.Pad.clearFocus();
      G.Modal.reset(); G.Dialog.close();
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      // (the language as it was, even when a check threw between two switches)
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.menuOrigin = "lobby"; document.body.classList.remove("over-home");
      G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
