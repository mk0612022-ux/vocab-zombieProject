// Dev-only (not shipped). The expansion's round 0: a sample of the save exactly
// as the game writes it today, kept as tests/fixtures/save-v-current.json for
// the migration tests of round 1. Nothing in it is a real player's: a player of
// twelve simulated days, made with the game's own functions (G.Learning.answerWord,
// G.SRS.completeDaily, G.addLeaderboardEntry, G.Checkpoint.snapshot on a real
// run ...), so every part of the save holds what the game itself would put there.
// The game's save and clock are put back when it ends; nothing is written to
// this browser's storage.
//   Load it into the game at the Main Menu, then:
//     const r = await G.MakeSaveFixture.run();
//     r.json        the file (ASCII: other scripts as \u escapes)
//     r.stable      normalizeSave leaves it as it is
//     r.changed     what normalizeSave did to what was built (each: path, was -> is)
//     r.sections    how much is in each part
window.G = window.G || {};
G.MakeSaveFixture = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const DAYS = 12;

  // keys in a fixed order at every level, so two objects can be compared as text
  function sorted(v) {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = sorted(v[k]); }); return o; }
    return v;
  }
  function differences(a, b, path, out) {
    if (a && b && typeof a === "object" && typeof b === "object") {
      new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => differences(a[k], b[k], path ? path + "." + k : k, out));
    } else if (a !== b) out.push(path + ": " + JSON.stringify(a) + " -> " + JSON.stringify(b));
    return out;
  }
  // the file's text: anything past ASCII as an escape
  function ascii(s) {
    let out = "";
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out += c < 128 ? s[i] : "\\" + "u" + c.toString(16).padStart(4, "0"); }
    return out;
  }

  function learning(s) {
    const pairs = G.getAllBuiltinWords(), today = G.Clock.today();
    const R = G.makeRng(20261104), set = pairs.slice(0, 140);
    // the days played: new words met, the ones due answered -- some right, some wrong
    for (let day = 0; day < DAYS; day++) {
      G.Clock.offsetDays = day - DAYS;
      const now = G.Clock.today();
      set.slice(0, 40 + day * 8).forEach((p, i) => {
        const st = G.save.learn.srs[G.wordKey(p)];
        if (st && st.due > now) return;
        const right = R() < 0.78, recall = i % 3 === 0;
        const wrongPick = !right && i % 2 === 0 ? pairs[(i + 200) % pairs.length] : null;
        G.Learning.answerWord(p, right, { recall, skills: recall ? ["spelling"] : ["recognition"], picked: wrongPick ? wrongPick[0] : undefined, assisted: i % 37 === 0 });
      });
      if (day !== 4 && day !== 9) G.SRS.completeDaily(20 + day, now);
    }
    G.Clock.offsetDays = 0;
    // the causes of the last wrong answers, as js/explain.js keeps them
    const missed = Object.keys(s.learn.srs).filter((k) => s.learn.srs[k].lapses > 0).slice(0, 8);
    missed.forEach((k, i) => { s.learn.why[k] = [{ d: today - 1 - i, c: i % 2 ? "confusable" : "spelling", x: pairs[i + 300][0], t: i % 2 ? "th2en" : "spell" }]; });
    // a word learnt in another language has its own key
    const zh = pairs[5][0];
    s.wordStats[zh + "@zh"] = { correct: 3, wrong: 1, lastCorrect: G.Clock.now() - 864e5 };
    s.learn.srs[zh + "@zh"] = { b: 2, due: today + 2, last: today - 1, n: 4, lapses: 1 };
  }

  function progress(s) {
    const today = new Date().toISOString().slice(0, 10);
    s.unlockedLevels = [1, 2];
    s.levelHighScores = { 1: 18450, 2: 6120 };
    s.dailyHighScores = { [today]: 3210 };
    s.endlessHighScore = 9400; s.endlessHighWave = 14;
    G.addLeaderboardEntry("level1", 18450, "", { style: "adaptive" });
    G.addLeaderboardEntry("level1", 12020, "continued", { style: "classic" });
    G.addLeaderboardEntry("level2", 6120, "");
    G.addLeaderboardEntry("endless", 9400, "");
    G.addLeaderboardEntry("daily", 3210, "");
    G.addLeaderboardEntry("review", 41, "");
    G.ACHIEVEMENTS.slice(0, 5).forEach((a) => { s.achievements[a.id] = true; });
    s.unlockedWeapons = ["pistol", "shotgun", "smg", "rifle", "lmg", "school_wall", "pop_quiz"];
    s.notes = { level1: (G.NOTES.level1 || []).slice(0, 7).map((n) => n.id), level2: [], level3: [] };
    const bosses = (G.BOSS_DEFS || []).slice(0, 3).map((b) => b.id);
    s.bosses = { seen: {}, defeated: {} };
    bosses.forEach((id, i) => { s.bosses.seen[id] = 3 - i; if (i < 2) s.bosses.defeated[id] = 2 - i; });
    s.learnSeen = { intro_keys: true, intro_touch: true, mode_review: true };
    s.tutorialDone = true;
    s.tutorialSeen = { move: true, rule: true, shoot: true, door: true, pickup: true, shop: true };
  }

  function words(s) {
    const pairs = G.getAllBuiltinWords();
    const th = (i) => pairs[i][1];
    s.customWords = {
      level1: [["lexicon", th(10), { definition: "all the words of a language", synonyms: ["vocabulary"], example: "A wide lexicon helps.", collocations: ["mental lexicon"], topic: "Education", pos: "n" }], ["plain word", th(11)]],
      level2: [["bonjour", th(12), { wl: "fr", ml: "th" }]],
      level3: [],
    };
    s.importedSets = { import_1793000000000: { name: "Week 3", words: [[pairs[20][0], th(20)], [pairs[21][0], th(21)]] } };
  }

  function settings(s) {
    const k = s.settings;
    Object.assign(k, { uiLang: "th", wordLang: "en", meaningLang: "th", graphicsQuality: "medium", fontSize: "large", musicVolume: 0.35, weaponsVolume: 0.6, mouseSensitivity: 1.4,
      shopTime: 60, spellReload: true, clueThai: "always", accent: "american", campaignStyle: "classic", aimAssist: "high", renderScale: 0.8, safeArea: "manual", safeMargin: 30,
      brightness: 1.2, brightnessSet: true, autoReload: false, cameraRecoil: 0.5, muzzleFlash: 0.7, gore: "reduced", reduceMotion: true, explainDetail: "full", autoContinue: 4, weaponBob: 0.5, screenEffects: 0.8,
      hudScale: { all: 1.1, hp: 1.25 } });
    k.keybinds.reload = "KeyT";
    k.touchLayout = { pos: { fire: { x: 0.82, y: 0.7 }, jump: { x: 0.9, y: 0.55 } }, scale: { fire: 1.2 }, opacity: 0.8, lookSens: 1.3, btnLookSens: 0.9 };
  }

  // a real run's checkpoint: the school, at wave 10's shop
  async function checkpoint(s) {
    const g = G.Game;
    const real = [g._update0, g._update, g._upd, g._r20, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    if (G.MainMenu.visible()) { G.MainMenu.toLobby(); await wait(900); }
    if (G.Modal.isOpen && G.Modal.isOpen("brightness")) G.BrightnessCal.ok();
    G.Input.requestPointerLock = () => {};
    const quality = s.settings.graphicsQuality, spawn = G.Spawner.update;
    s.settings.graphicsQuality = "vlow";
    g.update = real;
    g.startLevel(1);
    g.update = function () {};
    G.Spawner.update = function () {};
    g.requiredKills = 1e9; g.clearZombies(); G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs();
    for (let i = 0; i < 3; i++) real.call(g, 1 / 60);
    const p = g.player;
    p.score = 8120; p.money = 1450; p.hp = 72;
    ["smg", "rifle"].forEach((id) => {
      const d = G.WEAPON_DEFS[id];
      p.ammo[id] = { mag: d.magSize - 3, reserve: d.magSize * 3 };
      p.weaponLevels[id] = { dmg: 1.15, rate: 1, mag: 1.2 };
    });
    p.gunSlots = ["smg", "rifle"]; p.currentSlot = 1;
    g.wave = 10;
    s.checkpoints = { level1: JSON.parse(JSON.stringify(G.Checkpoint.snapshot(g))) };
    G.Spawner.update = spawn;
    g.update = real;
    s.settings.graphicsQuality = quality;
    if (g.state !== "MENU") g.quitToMainMenu();
  }

  async function run() {
    const keep = { save: G.save, persist: G.persist, soon: G.persistSoon, unlock: G.unlockAchievement };
    const s = G.defaultSave();
    let out = null;
    G.save = s;
    G.persist = G.persistSoon = function () {};
    G.unlockAchievement = function (id) { s.achievements[id] = true; };          // (no card on the screen)
    try {
      settings(s);
      learning(s);
      progress(s);
      words(s);
      await checkpoint(s);
      // what the game itself holds after loading it
      const built = JSON.parse(JSON.stringify(s));
      const once = G.normalizeSave(JSON.parse(JSON.stringify(s)));
      const twice = G.normalizeSave(JSON.parse(JSON.stringify(once)));
      const a = JSON.stringify(sorted(once)), b = JSON.stringify(sorted(twice));
      const json = ascii(JSON.stringify(once, null, 1)) + "\n";
      const sections = {};
      Object.keys(once).forEach((k) => { sections[k] = JSON.stringify(once[k]).length; });
      out = { json, bytes: json.length, stable: a === b, changed: differences(built, once, "", []), sections,
        words: Object.keys(once.wordStats).length, boxes: Object.keys(once.learn.srs).length, checkpointWave: once.checkpoints.level1 && once.checkpoints.level1.wave };
    } finally {
      G.Clock.offsetDays = 0;
      G.persist = keep.persist; G.persistSoon = keep.soon; G.unlockAchievement = keep.unlock;
      G.save = keep.save;
    }
    return out;
  }
  return { run };
})();
