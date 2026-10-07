// Dev-only (not shipped). New series, round 2: Loading, Start, Settings, parts of speech.
//   D  the Loading screen: the progress is the real loading (every script and
//      picture, by size), what it says it is doing, the words over the heads
//      (new each time, never touching), tips and the Word of the Day, the
//      pictures' sizes, at least a second on screen
//   E  the Start screen: in by a tap, a key or A -- not by Sign In or Tab --
//      the bar (Guest, Sign In), the version, the lobby's music from that tap
//   F  the Settings page: eight categories, every old setting in one, the
//      kinds of control, a description under each row, changes applied and
//      saved, the run's locked rows, keys and a controller, the red dots, the
//      privacy policy, the new settings (render resolution, screen-edge
//      margin, controller look), saves from before them
//   G  parts of speech: the data, the tags on zombies, cards, logs, choices
//      and Progress; none in a question of a word's forms; wrong choices of
//      the same part of speech
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round16Test.run();   r.fail -> [] when everything passes
//   r.table: where each setting of the old page went
window.G = window.G || {};
G.Round16Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const key = (code, extra) => window.dispatchEvent(new KeyboardEvent("keydown", Object.assign({ code, key: code, bubbles: true }, extra || {})));
  const pad = (buttons, axes) => { const b = []; for (let i = 0; i < 17; i++) b.push({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 }); return { id: "Test Pad (STANDARD GAMEPAD)", buttons: b, axes: axes || [0, 0, 0, 0] }; };
  const padPress = (btn, axes) => {
    const P = G.Pad, real = G.Input.pollGamepad;
    G.Input.pollGamepad = () => pad(btn == null ? [] : [btn], axes); P.poll(1 / 60);
    G.Input.pollGamepad = () => pad([]); P.poll(1 / 60);
    G.Input.pollGamepad = real;
  };
  const S = () => G.save.settings;
  const openSettings = (from, cat) => { G.UI._settingsReturn = from || "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings"); if (cat) G.SettingsUI.select(cat); };

  // where every setting of the old page went (F3), and the new ones
  const TABLE = [
    ["Graphics quality", "set-quality", "graphics"], ["FPS cap", "set-fpscap", "graphics"], ["FPS counter", "set-showfps", "graphics"], ["Draw call count", "set-showdraws", "graphics"],
    ["HUD size (editor)", "btn-hudcfg", "graphics"],
    ["Sound effects volume", "set-sfxVolume", "audio"], ["Music volume", "set-musicVolume", "audio"], ["Ambience volume", "set-ambientVolume", "audio"], ["Word pronunciation volume", "set-speechVolume", "audio"],
    ["Read words aloud", "set-speechmode", "audio"], ["Accent", "set-accent", "audio"], ["Speaking speed", "set-speechspeed", "audio"], ["Play Once", "set-playonce", "audio"], ["Test pronunciation", "btn-speech-test", "audio"],
    ["Control mode", "set-controlmode", "controls"], ["Mouse sensitivity", "set-sens", "controls"], ["Aim assist", "set-aimassist", "controls"], ["Touch look sensitivity", "set-tlook", "controls"],
    ["Fire / Aim button look sensitivity", "set-blook", "controls"], ["Touch controls layout (editor)", "btn-touchcfg", "controls"], ["Key bindings (22 keys)", "btn-reset-keybinds", "controls"],
    ["Shop time between waves", "set-shoptime", "gameplay"], ["Spell to Reload", "set-spellreload", "gameplay"], ["Highlight the word to shoot", "set-highlight", "gameplay"],
    ["Thai with English clues", "set-cluethai", "gameplay"], ["Custom Vocabulary", "btn-settings-customvocab", "gameplay"],
    ["Game speed", "set-gamespeed", "accessibility"], ["Text size", "set-fontsize", "accessibility"], ["Colorblind mode", "set-colorblind", "accessibility"],
    ["Camera bob", "set-headbob", "accessibility"], ["Camera bob off", "set-headbob-off", "accessibility"],
    ["Export Save / Import Save", "btn-export-save", "account"],
    ["Version, Check for updates", "btn-check-update", "about"],
  ];
  const NEW = [
    ["Render resolution", "set-render", "graphics"], ["Screen edge margin (Auto / Manual)", "set-safearea", "graphics"], ["Margin (Manual)", "set-safemargin", "graphics"],
    ["Controller look sensitivity", "set-padsens", "controls"], ["Learning Style (was only before a level)", "set-campstyle", "gameplay"],
    ["UI / Word / Meaning language", "set-uilang", "language"], ["Profile, Sign In", "btn-set-signin", "account"], ["Sync status", "set-sync", "account"],
    ["Delete account", "btn-delete-account", "account"], ["Sign Out", "btn-signout", "account"], ["Privacy Policy", "btn-privacy", "about"],
  ];

  // ---------------- D: the Loading screen ----------------
  async function loading() {
    const B = G.Boot, U = G.Updater;
    const tags = document.querySelectorAll("script[defer][src]").length;
    ok("D every game script is counted as it arrives", B.scripts.length === tags && tags > 60 && B.scripts.every((s) => s.done), B.scripts.length + " of " + tags);
    ok("D ...and both pictures (Loading, Start)", B.images.length === 2 && B.images.every((s) => s.done), B.images.map((s) => s.src).join(", "));
    ok("D ...and the update check's version.json", B.check.done);
    ok("D everything in: 100%", Math.abs(B.progress() - 1) < 1e-9);
    // what the screen showed as the page opened: the bar went up as pieces came
    const log = B.log.slice(), pcts = log.map((x) => x[1]);
    const steps = new Set(pcts).size, rising = pcts.every((p, i) => i === 0 || p >= pcts[i - 1]);
    ok("D as it opened, the bar only went up, a piece at a time, to 100%", log.length >= 5 && steps >= 5 && rising && pcts[pcts.length - 1] === 100,
      steps + " steps: " + log.filter((x, i) => i === 0 || x[2] !== log[i - 1][2] || i === log.length - 1).map((x) => x[0] + "ms " + x[1] + "% " + x[2]).join(" | "));
    // the bar follows what has come, weighted by size: three.js is a big piece
    const three = B.scripts.find((s) => /three/.test(s.src)), bank = B.scripts.find((s) => /bank_school/.test(s.src)), core = B.scripts.find((s) => /js\/core\.js/.test(s.src));
    // (a piece is in when it has arrived or run: both taken back, for a moment)
    const out = (s, v) => { s.done = !v; s.arrived = !v; };
    out(three, true);
    const p1 = B.progress();
    const st1 = B.status();
    out(three, false); out(bank, true);
    const st2 = B.status();
    out(bank, false); out(core, true);
    const st3 = B.status();
    out(core, false);
    const t0 = B.t0; B.check.done = false; B.t0 = Date.now();
    const st4 = B.status();
    B.check.done = true; B.t0 = t0;
    ok("D a script not in yet holds the bar back by its size (three.js ~600 KB)", p1 < 0.9 && p1 > 0.4, Math.round(p1 * 100) + "%");
    ok("D it says what it is doing: assets / vocabulary / checking for updates",
      st1 === G.T("boot.assets") && st2 === G.T("boot.vocab") && st3 === G.T("boot.assets") && st4 === G.T("boot.checking"), [st1, st2, st3, st4].join(" | "));
    ok("D on screen at least " + G.CONFIG.update.minBootMs + " ms (no flash)", U._enteredAt && U._enteredAt - B.t0 >= G.CONFIG.update.minBootMs - 5, U._enteredAt ? (U._enteredAt - B.t0) + " ms" : "not entered");
    // the words over the heads
    const overlay = $("loading-overlay");
    overlay.classList.remove("hidden");
    const first = (B.words || []).map((w) => w.word).join();
    B.onVocab();
    await wait(80);
    const second = B.words.map((w) => w.word).join();
    const labels = Array.from(document.querySelectorAll("#boot-words .bw"));
    const rects = labels.map((l) => l.getBoundingClientRect());
    const touching = rects.some((a, i) => rects.some((b, j) => j > i && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
    ok("D a word over each head it fits on (5 or more), from the word bank", labels.length >= 5 && labels.every((l) => G.WordBank.lookup(l.firstChild.nodeValue.trim())), labels.length + ": " + labels.map((l) => l.textContent).slice(0, 6).join(", "));
    ok("D ...with its part of speech", labels.every((l) => l.querySelector(".pos-tag")));
    ok("D ...none touching, none off the screen", !touching && rects.every((r) => r.left >= 0 && r.right <= innerWidth && r.top >= 0));
    ok("D new words each time the game opens", first && second && first !== second);
    // tips and the Word of the Day
    const tips = B.tips();
    ok("D tips to show by turns (10 or more), from the strings", tips.length >= 10 && tips.every((t) => t && !/^boot\./.test(t)), tips.length + " tips");
    const w1 = B.wordOfTheDay(), w2 = B.wordOfTheDay();
    ok("D Word of the Day: the same all day, with its part of speech and meaning", w1 && w2 && w1.word === w2.word && !!w1.pos && !!w1.thai, w1 && (w1.word + " (" + w1.pos + ") " + w1.thai));
    B.active = true; B.showWord = true; B.tip(); await wait(320);
    const wotdShown = $("boot-tip-h").textContent === G.T("boot.wotd") && $("boot-tip-text").textContent.includes(w1.word);
    B.tip(); await wait(320);
    const tipShown = $("boot-tip-h").textContent === G.T("boot.tipHead") && tips.includes($("boot-tip-text").textContent);
    ok("D a tip, then the Word of the Day, by turns", wotdShown && tipShown);
    B.finish(); overlay.classList.add("hidden");
    // the pictures: WebP, at most ~500 KB, two sizes of the Loading one
    const sizes = {};
    for (const f of ["loading-large", "loading-small", "start-horde"]) { const r = await fetch("assets/boot/" + f + ".webp", { cache: "no-store" }); sizes[f] = r.ok ? (await r.blob()).size : -1; }
    ok("D the pictures: two sizes for Loading, one for Start, WebP, at most 500 KB each", Object.values(sizes).every((n) => n > 20000 && n <= 512000), Object.keys(sizes).map((k) => k + " " + Math.round(sizes[k] / 1024) + " KB").join(", "));
    ok("D a phone gets the small one (<picture> media)", !!document.querySelector('#loading-overlay source[media][srcset*="loading-small"]'));
  }

  // ---------------- E: the Start screen ----------------
  async function start() {
    const St = G.Start, el = $("start-screen");
    const fade = G.CONFIG.start.fadeMs + 120;
    const show = () => { G.UI.goToMainMenu(); St.show(); };
    show();
    ok("E after Loading, before the lobby: a window of its own", !el.classList.contains("hidden") && G.Modal.top() && G.Modal.top().id === "start");
    ok("E 'Tap To Lobby', and the version in the corner", $("start-tap").textContent === G.T("start.tap") && el.querySelector("[data-version]").textContent === G.Updater.label());
    ok("E the bar: Guest and Sign In (no accounts yet)", $("start-name").textContent === G.T("account.guest") && !$("btn-start-signin").classList.contains("hidden") && $("start-uid").classList.contains("hidden"));
    $("btn-start-signin").click();
    await wait(50);
    const dialog = G.Dialog.isOpen() && !el.classList.contains("hidden");
    G.Dialog.close();
    ok("E Sign In: its own window, not the way in", dialog && St.shown);
    key("Tab");
    ok("E Tab only moves between the two", St.shown);
    key("KeyM");
    await wait(fade);
    ok("E any key: the lobby", !St.shown && el.classList.contains("hidden") && !G.Modal.isOpen("start") && G.UI._currentScreen === "screen-mainmenu");
    ok("E ...and the lobby's music starts with it", !G.Audio.ctx || !!G.Audio._menu);
    show();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(fade);
    ok("E a tap anywhere: the lobby", !St.shown);
    show();
    G.Pad.clearFocus();
    padPress(G.Pad.B.A);
    await wait(fade);
    ok("E A on a controller: the lobby", !St.shown);
    // the music: off in a level, back in the lobby
    if (G.Audio.ctx) {
      G.Input.requestPointerLock = function () {};
      G.Game.startLevel(1);
      const inLevel = !!G.Audio._menu;
      G.Game.quitToMainMenu();
      ok("E the music stops for a level and comes back in the lobby", !inLevel && !!G.Audio._menu);
    }
  }

  // ---------------- F: the Settings page ----------------
  async function settings() {
    const keep = JSON.stringify(S());
    openSettings("screen-mainmenu", "graphics");
    const cats = Array.from(document.querySelectorAll("#set-cats .set-cat")).map((b) => b.dataset.cat);
    ok("F eight categories down the side", cats.join() === "graphics,audio,controls,gameplay,language,accessibility,account,about", cats.join());
    ok("F one shown at a time", document.querySelectorAll("#settings-content .set-sec:not(.hidden)").length === 1);
    const where = (id) => { const e = $(id); const sec = e && e.closest(".set-sec"); return sec ? sec.id.replace("set-sec-", "") : null; };
    const lost = TABLE.filter(([, id, cat]) => where(id) !== cat);
    ok("F every setting of the old page is here, in its category (" + TABLE.length + ")", !lost.length && document.querySelectorAll("#set-sec-controls .keybind-btn").length === 22, lost.map((x) => x[0] + " -> " + where(x[1])).join("; "));
    const missingNew = NEW.filter(([, id, cat]) => where(id) !== cat);
    ok("F the new ones too: render resolution, screen-edge margin, controller look, Learning Style, languages, account, privacy", !missingNew.length, missingNew.map((x) => x[0]).join("; "));
    // the kinds of control
    const kind = (id) => { const e = $(id); return !e ? "none" : e.classList.contains("seg") ? "seg" : e.type === "range" ? "slider" : e.getAttribute("role") === "switch" ? "switch" : e.tagName.toLowerCase(); };
    const want = { "set-quality": "seg", "set-fpscap": "seg", "set-aimassist": "seg", "set-fontsize": "seg", "set-shoptime": "seg", "set-safearea": "seg",
      "set-render": "slider", "set-sfxVolume": "slider", "set-sens": "slider", "set-gamespeed": "slider", "set-headbob": "slider",
      "set-showfps": "switch", "set-spellreload": "switch", "set-colorblind": "switch", "set-playonce": "switch" };
    const wrong = Object.keys(want).filter((id) => kind(id) !== want[id]);
    ok("F steps: segmented, amounts: sliders, on/off: switches", !wrong.length, wrong.map((id) => id + "=" + kind(id)).join(", "));
    const rows = Array.from(document.querySelectorAll("#settings-content .set-row"));
    const noDesc = rows.filter((r) => !r.querySelector(".set-desc") && !/campclue|campanswer/.test(r.dataset.row)).map((r) => r.dataset.row);
    ok("F a line of description under each row", rows.length > 35 && !noDesc.length, rows.length + " rows; without: " + noDesc.join(", "));
    ok("F a row that needs a restart says so (anti-aliasing)", /restart/i.test(document.querySelector('[data-row="set-quality"] .set-desc').textContent));
    // a change: applied at once, saved
    const q0 = S().graphicsQuality;
    document.querySelector('#set-quality [data-v="low"]').click();
    const saved = JSON.parse(localStorage.getItem("vocabZombie_save_v1")).settings.graphicsQuality;
    ok("F a choice: lit, applied, saved", S().graphicsQuality === "low" && saved === "low" && document.querySelector('#set-quality .seg-o.on').dataset.v === "low" && document.querySelector('#set-quality .seg-o.on').classList.contains("flash"));
    document.querySelector(`#set-quality [data-v="${q0}"]`).click();
    const r = $("set-render"), pr0 = G.Game.renderer.getPixelRatio();
    r.value = 0.6; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change"));
    const pr1 = G.Game.renderer.getPixelRatio();
    ok("F Render resolution: the 3D view's pixels at once", S().renderScale === 0.6 && Math.abs(pr1 - pr0 * 0.6) < 0.02 && $("set-render-v").textContent === "60%", pr0 + " -> " + pr1);
    r.value = 1; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change"));
    const fps = $("set-showfps"), fps0 = fps.checked;
    fps.checked = !fps0; fps.dispatchEvent(new Event("change"));
    ok("F a switch: on at once (the FPS counter)", S().showFpsCounter === !fps0 && $("hud-fps-counter").classList.contains("hidden") === fps0);
    fps.checked = fps0; fps.dispatchEvent(new Event("change"));
    document.querySelector('#set-safearea [data-v="manual"]').click();
    const man = document.documentElement.style.getPropertyValue("--sa-l"), rowShown = !document.querySelector('[data-row="set-safemargin"]').classList.contains("hidden");
    const sm = $("set-safemargin"); sm.value = 40; sm.dispatchEvent(new Event("input"));
    const man40 = document.documentElement.style.getPropertyValue("--sa-l");
    document.querySelector('#set-safearea [data-v="auto"]').click();
    ok("F screen-edge margin: Manual uses the player's margin, Auto the device's", man === "24px" && rowShown && man40 === "40px" && !document.documentElement.style.getPropertyValue("--sa-l") && document.querySelector('[data-row="set-safemargin"]').classList.contains("hidden"), man + " / " + man40);
    // the controller's look speed
    G.Input.requestPointerLock = function () {};
    G.Game.startLevel(1);
    const g = G.Game, real = G.Input.pollGamepad;
    G.Input.pollGamepad = () => pad([], [0, 0, 1, 0]);
    const turn = (k) => { S().padSensitivity = k; const y = g.yawObject.rotation.y; g.updatePlayerMovement(1 / 60); return Math.abs(g.yawObject.rotation.y - y); };
    const t1 = turn(1), t2 = turn(2);
    G.Input.pollGamepad = real; S().padSensitivity = 1;
    ok("F controller look sensitivity: twice the setting, twice the turn", t1 > 0 && Math.abs(t2 / t1 - 2) < 0.01, t1.toFixed(4) + " / " + t2.toFixed(4));
    // in a run: what cannot change there is greyed out
    g.pause();
    openSettings("screen-pause", "gameplay");
    const locked = Array.from(document.querySelectorAll("#settings-content .set-row.locked")).map((x) => x.dataset.row);
    const style0 = S().campaignStyle;
    document.querySelector('#set-campstyle [data-v="classic"]').click();
    ok("F in a run: Learning Style and the word languages greyed out, 'Change this from the lobby'", ["set-campstyle", "set-wordlang", "set-meanlang"].every((x) => locked.includes(x)) && S().campaignStyle === style0
      && document.querySelector('[data-row="set-campstyle"] .set-lock').textContent.includes(G.T("settings.lobbyOnly")), locked.join(", "));
    ok("F ...but the rest still changes in a run (the shop time)", (() => { const v0 = S().shopTime; document.querySelector('#set-shoptime [data-v="60"]').click(); const okk = S().shopTime === 60; document.querySelector(`#set-shoptime [data-v="${v0}"]`).click(); return okk; })());
    key("Escape");
    ok("F Esc in a run: back to the pause menu", G.UI._currentScreen === "screen-pause" && g.state === "PAUSE");
    G.Game.quitToMainMenu();
    openSettings("screen-mainmenu", "gameplay");
    ok("F from the lobby: not locked", !document.querySelector("#settings-content .set-row.locked"));
    document.querySelector('#set-campstyle [data-v="custom"]').click();
    const custom = !document.querySelector('[data-row="set-campclue"]').classList.contains("hidden");
    document.querySelector('#set-campclue [data-v="audio"]').click();
    const cid = S().campaignStyle;
    document.querySelector(`#set-campstyle [data-v="${G.Learn.preset(style0).custom ? "custom" : style0}"]`).click();
    S().campaignStyle = style0;
    ok("F Learning Style: your own shows the clue and the answer", custom && /^custom:audio\+/.test(cid), cid);
    // keys
    openSettings("screen-mainmenu", "graphics");
    $("set-cat-graphics").focus();
    key("ArrowRight");
    const first = document.activeElement;
    key("ArrowDown");
    const second = document.activeElement;
    ok("F keys: right into the rows, down to the next", first && first.closest('[data-row="set-quality"]') && second && second.id === "set-render", (first && first.textContent) + " -> " + (second && second.id));
    $("set-cat-audio").click(); $("set-cat-audio").focus();
    key("ArrowRight"); key("ArrowDown"); key("ArrowDown"); key("ArrowDown"); key("ArrowDown");
    const segFocus = document.activeElement && document.activeElement.closest("#set-speechmode");
    const sm0 = S().speechMode;
    key("ArrowRight");
    ok("F keys: left / right change a choice", segFocus && S().speechMode !== sm0, sm0 + " -> " + S().speechMode);
    S().speechMode = sm0;
    key("KeyE"); const e1 = G.SettingsUI.cat; key("KeyQ"); key("KeyQ"); const q1 = G.SettingsUI.cat;
    ok("F keys: Q / E a category", e1 === "controls" && q1 === "graphics", e1 + ", " + q1);
    key("Escape");
    ok("F Esc from the lobby's Settings: the lobby", G.UI._currentScreen === "screen-mainmenu");
    // a controller
    openSettings("screen-mainmenu", "graphics");
    G.Pad.clearFocus();
    padPress(null);
    ok("F controller: starts on the chosen category", G.Pad.focused && G.Pad.focused.id === "set-cat-graphics");
    padPress(G.Pad.B.RB);
    const rb = G.SettingsUI.cat;
    padPress(G.Pad.B.LB);
    ok("F controller: LB / RB a category", rb === "audio" && G.SettingsUI.cat === "graphics");
    padPress(G.Pad.B.RIGHT);
    const onSeg = G.Pad.focused && G.Pad.focused.closest("#set-quality");
    const fq = S().graphicsQuality;
    padPress(G.Pad.B.LEFT);
    const changed = S().graphicsQuality !== fq;
    if (changed) document.querySelector(`#set-quality [data-v="${fq}"]`).click();
    ok("F controller: into the rows, left / right change a choice", onSeg && changed, fq + " -> changed: " + changed);
    padPress(G.Pad.B.B);
    ok("F controller: B back", G.UI._currentScreen === "screen-mainmenu");
    // the red dots
    openSettings("screen-mainmenu", "account");
    const dotA = !document.querySelector("#set-cat-account .sc-dot").classList.contains("hidden"), dotB0 = !document.querySelector("#set-cat-about .sc-dot").classList.contains("hidden");
    const keepP = G.Updater.pending; G.Updater.pending = { version: "2099.01.01-0000", build: 1, files: {} };
    G.SettingsUI.dots();
    const dotB1 = !document.querySelector("#set-cat-about .sc-dot").classList.contains("hidden");
    G.Updater.pending = keepP; G.SettingsUI.dots();
    ok("F a red dot: Account (not signed in), About (a new version out)", dotA && dotB1 && dotB0 === !!keepP);
    ok("F Account: Guest, Sign In; Sign Out on the bar at the bottom (none for a guest)", document.querySelector("#set-sec-account .sp-who b").textContent === G.T("account.guest") && !!$("btn-set-signin") && $("btn-signout").closest(".set-bar") && $("btn-signout").disabled);
    // the privacy policy
    G.SettingsUI.select("about");
    $("btn-privacy").click();
    const pv = G.Modal.isOpen("privacy") && !$("privacy").classList.contains("hidden") && $("privacy-body").querySelectorAll("h4").length >= 4;
    key("Escape");
    ok("F About: the privacy policy, a window of its own (Esc closes)", pv && !G.Modal.isOpen("privacy") && $("privacy").classList.contains("hidden") && G.UI._currentScreen === "screen-settings");
    // a save from before
    const old = G.normalizeSave({ unlockedLevels: [1], settings: { musicVolume: 0.3, graphicsQuality: "low" } });
    ok("F a save from before: its settings kept, the new ones at their defaults", old.settings.musicVolume === 0.3 && old.settings.graphicsQuality === "low" && old.settings.renderScale === 1 && old.settings.safeArea === "auto" && old.settings.safeMargin === 24 && old.settings.padSensitivity === 1);
    const bad = G.normalizeSave({ settings: { renderScale: 7, safeArea: "left", safeMargin: -5, padSensitivity: "fast" } });
    ok("F ...and bad values put right", bad.settings.renderScale === 1 && bad.settings.safeArea === "auto" && bad.settings.safeMargin === 0 && bad.settings.padSensitivity === 1);
    G.save.settings = Object.assign(G.save.settings, JSON.parse(keep)); G.persist(); G.applySafeArea();
    G.UI.goToMainMenu();
  }

  // ---------------- G: parts of speech ----------------
  async function pos() {
    const P = G.POS, all = G.WordBank.entries();
    const badPos = all.filter((e) => !P.valid(e.partOfSpeech));
    ok("G every word of the bank has its part of speech (" + all.length + ")", all.length > 800 && !badPos.length, badPos.slice(0, 5).map((e) => e.id).join());
    const two = all.filter((e) => P.parts(e.partOfSpeech).length === 2);
    ok("G a meaning used as two is shown as two: research-style (N./V.)", two.length >= 20 && P.abbr(G.WordBank.byId("approach").partOfSpeech) === "N./V." && P.abbr("prep/conj") === "Prep./Conj." && P.abbr("phrase") === "Phr.", two.length + " words: " + two.slice(0, 6).map((e) => P.text(e.headword, e.partOfSpeech)).join(", "));
    ok("G the short forms: N. V. Adj. Adv. Prep. Conj. Pron. Det. Phr.", P.ORDER.map((c) => P.ABBR[c]).join(" ") === "N. V. Adj. Adv. Prep. Conj. Pron. Det. Phr.");
    ok("G a player's word: the part of speech given, or Phr. for several words", P.of(["give up", "x"]) === "phrase" && P.of(["zany", "x", { pos: "adj" }]) === "adj" && P.of(["zany", "x"]) === "");
    ok("G the save keeps it, and drops one that is not", (G.cleanCustomExtra({ pos: "n/v" }) || {}).pos === "n/v" && !G.cleanCustomExtra({ pos: "v/n" }));
    // on a zombie
    const ap = G.WORDS_LEVEL_1.find((p) => p[0] === "approach");
    const z = new G.Zombie("normal", new THREE.Vector3(0, 0, 0), ap, "school");
    z.setAnswer("shoot", ap[1], { kind: "thai" });
    const shot = z.labelPos(), w1 = z.sprite.userData.canvas.__fw;
    z.setAnswer("shoot", ap[1], { kind: "cloze", label: "approaching" });
    const cloze = z.labelPos();
    z.setAnswer("spell", ap[1], { kind: "thai" });
    const spell = z.labelPos();
    z.setAnswer("shoot", ap[1], { kind: "audio", label: ap[1] });
    const thai = z.labelPos();
    const z2 = new G.Zombie("normal", new THREE.Vector3(0, 0, 0), ap, "school");
    G.drawWordLabel(z2.sprite.userData.ctx, z2.sprite.userData.canvas, "approach", "#fff", "");
    const w0 = z2.sprite.userData.canvas.__fw;
    ok("G a zombie's word with its part of speech, smaller after it", shot === "N./V." && w1 > w0, shot + " " + w0.toFixed(2) + " -> " + w1.toFixed(2));
    ok("G ...not on a form to fit a gap (Cloze), a word to spell, or a Thai meaning", cloze === "" && spell === "" && thai === "");
    // questions
    const Q = G.Questions, pool = G.WORDS_LEVEL_1;
    let same = 0, total = 0, tagged = 0;
    for (let i = 0; i < 40; i++) {
      const p = pool[(i * 37) % pool.length];
      for (const t of ["th2en", "def2word"]) {
        if (!Q.can(t, p)) continue;
        const q = Q.build(p, t, pool);
        total++;
        if (q.choices.every((c) => c.pos === q.choices[q.answer].pos)) same++;
        if (q.choices.every((c) => c.pos) && !q.noPos) tagged++;
      }
    }
    ok("G question choices carry their part of speech", tagged === total, tagged + "/" + total);
    ok("G ...and the wrong ones are of the answer's part of speech (it never gives it away)", same === total, same + "/" + total);
    const box = document.createElement("div"); box.innerHTML = "<div></div><div></div><div></div>";
    const els = { ask: box.children[0], prompt: box.children[1], choices: box.children[2] };
    G.QuestionView.fill(els, Q.build(ap, "th2en", pool), {});
    const th2en = els.choices.querySelectorAll(".pos-tag").length;
    const cq = Q.build(ap, "cloze", pool);
    G.QuestionView.fill(els, cq, {});
    const clozeTags = els.choices.querySelectorAll(".pos-tag").length;
    G.QuestionView.fill(els, Q.build(ap, "en2th", pool), {});
    const prompt = els.prompt.querySelector(".pos-tag");
    ok("G drawn: on each English choice, after the word asked about", th2en === 4 && prompt && prompt.textContent === "(N./V.)");
    ok("G none in a question of the word's forms (Cloze)", cq.noPos && clozeTags === 0);
    // the card, the log, Progress, the custom words
    const card = G.VocabCard.cardHtml(ap);
    ok("G the vocabulary card", /class="vc-pos"[^>]*>\(N\.\/V\.\)/.test(card));
    G.UI._logReturnScreen = "screen-mainmenu"; G.UI.renderVocabLog(1);
    const logTags = document.querySelectorAll("#vocablog-content .vocab-item .vw-en .pos-tag").length, logItems = document.querySelectorAll("#vocablog-content .vocab-item").length;
    ok("G the Vocabulary Log: every word", logItems > 200 && logTags === logItems, logTags + "/" + logItems);
    G.Progress._words = [];
    ok("G the Progress page's words", /pos-tag[^>]*>\(N\.\/V\.\)/.test(G.Progress.wordBtn(ap)));
    G.CustomVocabUI.open("screen-mainmenu");
    const opts = Array.from($("cv-pos").options).map((o) => o.value);
    $("cv-en").value = "zanyword"; $("cv-th").value = String.fromCharCode(0x0E1A, 0x0E49, 0x0E32); $("cv-level").value = "level1"; $("cv-pos").value = "adj";
    G.CustomVocabUI.submit();
    const list = G.CustomVocab.list("level1"), mine = list[list.length - 1];
    const shown = Array.from(document.querySelectorAll("#cv-list .cv-word b")).some((b) => /zanyword/.test(b.textContent) && b.querySelector(".pos-tag") && b.querySelector(".pos-tag").textContent === "(Adj.)");
    if (mine && mine[0] === "zanyword") G.CustomVocab.remove("level1", list.length - 1);
    ok("G your own words: a part of speech to pick, kept and shown", opts.includes("n") && opts.includes("phrase") && opts.includes("n/v") && mine && mine[2] && mine[2].pos === "adj" && shown);
    G.UI.goToMainMenu();
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    const realLock = G.Input.requestPointerLock, mode = G.Input.mode;
    G._missingKeys = {};
    try {
      G.Input.mode = "desktop";
      await loading();
      await start();
      await settings();
      await pos();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock;
      G.Input.mode = mode; G.Input.padActive = false;
      G.Pad.clearFocus();
      G.Modal.reset();
      if (G.Start.shown) { G.Start.shown = false; $("start-screen").classList.add("hidden"); }
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist(); G.applySafeArea();
      G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")),
      table: TABLE.map(([name, id, cat]) => ({ setting: name, category: cat })).concat(NEW.map(([name, id, cat]) => ({ setting: name + " (new)", category: cat }))) };
  }
  return { run, TABLE, NEW };
})();
