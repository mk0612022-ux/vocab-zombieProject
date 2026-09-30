// Dev-only (not shipped). Vocabulary series, round 1: the Master Word Bank.
// The bank as the game loads it (sizes, AWL coverage, fields), the 300 old
// words all still there, stats keyed by entry id and the save migration
// that moves old keys over, Custom Vocabulary's family check and optional
// fields, the field check modes will use to skip a word, and the things
// that ask words (zombies, boss / lock / crate questions, the end-of-wave
// quiz, the lobby counts) working from the bank. Load it into the game:
//   const r = await G.Round11Test.run();   r.fail -> [] when everything passes
// The save is put back afterwards.
window.G = window.G || {};
G.Round11Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const th = (...codes) => String.fromCharCode(...codes);          // Thai from char codes: no Thai in this file
  const THAI_X = th(0x0E17, 0x0E14, 0x0E2A, 0x0E2D, 0x0E1A);
  const $ = (id) => document.getElementById(id);

  // the 300 words the game had before the word bank, by their old level
  const OLD = {
    1: "abandon ability accurate achieve adapt adequate adult affect approach area aspect assist assume available aware benefit capacity category challenge circumstance comment community compare complex concept conclude conduct consist constant consume contact contrast contribute create culture data decline define demonstrate design develop discuss diverse economy effect element employ encourage environment equal establish evidence examine example expand expert explain factor feature focus function goal identify image impact improve include income increase indicate individual industry influence involve issue knowledge limit maintain major method obtain occur opportunity organize percent period policy positive previous process produce project provide purpose quality reduce region require research resource",
    2: "accumulate adjust advocate allocate alter alternative analyse anticipate apparent appropriate approximate assess attribute authority bias capable chemical clarify commission compensate compile component comprehensive conference confirm consequent considerable consistent constrain construct consult contemporary context controversy convince cooperate crucial cycle debate dedicate deduce detect deviate device diagnose dimension distinct distribute domestic dominate emerge emphasis enable enhance ensure equivalent essential estimate ethical evaluate eventual exceed exclude exhibit expose external facilitate flexible fluctuate formula foundation framework generate guarantee hypothesis identical ignore illustrate implement implication incidence initial injure innovate insert instance institute integrate intense interpret interval isolate justify label margin mechanism minimize modify monitor mutual",
    3: "abstract accommodate adjacent aggregate albeit ambiguous analogy arbitrary assemble attain augment autonomy coherent coincide collapse commodity compatible compound conceive confine conform contradict converse convey cumulative denote depict deter deteriorate differentiate diminish discrete disperse displace distort diverge elaborate eliminate empirical encompass endure entail erode exert explicit exploit extract feasible finite forthcoming fundamental hierarchy hinder implicit incentive inclination incompatible inevitable inference inherent inhibit integral intermediate intervene intricate intrinsic invoke levy manipulate mediate mitigate negate nonetheless notwithstanding nuance offset ongoing paradigm parallel persist pervasive phenomenon plausible precede predominant presume prohibit proliferate prone provoke reciprocal refute reinforce scrutiny subsequent substantiate supersede thereby ultimately vulnerable",
  };

  function freshRun(level) {
    const g = G.Game;
    g.startLevel(level || 1);
    g.update = function () {};
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    G.Spawner.update = function () {};
    return g;
  }

  // ---------------- A: the bank ----------------
  function bank() {
    const B = G.WordBank, all = B.entries();
    const sizes = [1, 2, 3].map((lv) => B.count(lv));
    ok("A: the three levels hold 240-330 word families each", sizes.every((n) => n >= 240 && n <= 330), sizes.join(" / "));
    ok("A: 886 families in all, every id unique", all.length === 886 && new Set(all.map((e) => e.id)).size === 886, all.length);
    const awl = all.filter((e) => e.source === "AWL");
    const bySub = {}; awl.forEach((e) => { bySub[e.awlSublist] = (bySub[e.awlSublist] || 0) + 1; });
    ok("A: all 570 AWL families, 60 in sublists 1-9 and 30 in 10", awl.length === 570 && [1, 2, 3, 4, 5, 6, 7, 8, 9].every((s) => bySub[s] === 60) && bySub[10] === 30, JSON.stringify(bySub));
    ok("A: AWL sublists by level: 1-3 School, 4-7 Hospital, 8-10 Bunker (for General Academic words)",
      awl.filter((e) => e.topic === "General Academic").every((e) => (e.awlSublist <= 3 ? 1 : e.awlSublist <= 7 ? 2 : 3) === e.level));
    const levelTopics = { 1: ["General Academic", "Education", "Society & Culture", "Media & Communication"], 2: ["General Academic", "Health", "Science & Research", "Environment"],
      3: ["General Academic", "Technology", "Government & Law", "Crime & Security", "Work & Economy", "Urban Life & Transport"] };
    ok("A: each level holds its own topics", all.every((e) => levelTopics[e.level].includes(e.topic)), all.filter((e) => !levelTopics[e.level].includes(e.topic)).map((e) => e.id).join());
    const need = ["id", "headword", "partOfSpeech", "thai", "definition", "topic", "source"];
    const bad = all.filter((e) => need.some((f) => !e[f]) || !(e.acceptedSpellings || []).length || !(e.synonyms || []).length || (e.examples || []).length !== 2 || !(e.collocations || []).length || !Array.isArray(e.family));
    ok("A: every entry has the required fields", bad.length === 0, bad.map((e) => e.id).join());
    const L1 = G.WORDS_LEVEL_1;
    ok("A: the game's pairs come from the bank, with ids", L1.length === B.count(1) && L1.every((p) => p.id && B.byId(p.id).headword === p[0] && B.byId(p.id).thai === p[1]));
    ok("A: the runtime audit passes", G.auditWordSets().ok);
    ok("A: the confusables lexicon is loaded", (G.CONFUSABLES || []).length > 0 && !!B.confusable("adopt") && !B.byId("adopt"));
  }

  // ---------------- B: the 300 old words ----------------
  function oldWords() {
    const B = G.WordBank, missing = [], moved = [];
    [1, 2, 3].forEach((lv) => OLD[lv].split(" ").forEach((w) => {
      const e = B.lookup(w);
      if (!e) missing.push(w);
      else if (e.level !== lv) moved.push(w);
    }));
    ok("B: all 300 old words are in the bank (as an id or a merged word)", missing.length === 0, missing.join());
    ok("B: 120 of them changed level", moved.length === 120, moved.length);
    const idsKept = [1, 2, 3].every((lv) => OLD[lv].split(" ").every((w) => ["consist", "incompatible"].includes(w) || B.byId(w)));
    ok("B: every old word is still an entry id, except the two merged ones", idsKept);
    ok("B: consist is merged into consistent, incompatible into compatible", B.lookup("consist").id === "consistent" && B.lookup("incompatible").id === "compatible");
    ok("B: minimize keeps its id and shows as minimise (British)", B.byId("minimize").headword === "minimise" && B.byId("organize").headword === "organise");
  }

  // ---------------- C: stats by id, the migration ----------------
  function stats() {
    ok("C: G.wordKey: spellings and merged words -> the entry id",
      G.wordKey("minimise") === "minimize" && G.wordKey("Minimize") === "minimize" && G.wordKey("consist") === "consistent"
      && G.wordKey("incompatible") === "compatible" && G.wordKey("per cent") === "percent" && G.wordKey(G.WORDS_LEVEL_1[0]) === G.WORDS_LEVEL_1[0].id);
    ok("C: a player's own word keeps its lower-cased key", G.wordKey("Serendipity") === "serendipity");

    const oldSave = {                       // a save from before the word bank (no wordStatsVersion)
      unlockedLevels: [1, 2],
      wordStats: {
        consist: { correct: 2, wrong: 1, lastCorrect: 100 },
        consistent: { correct: 1, wrong: 0, lastCorrect: 200, box: 3 },
        incompatible: { correct: 4, wrong: 2, lastCorrect: 300 },
        compatible: { correct: 1, wrong: 1, lastCorrect: 50 },
        minimize: { correct: 5, wrong: 0, lastCorrect: 400 },
        analyse: { correct: 3, wrong: 3, lastCorrect: 10 },
        serendipity: { correct: 1, wrong: 0, lastCorrect: 1 },
        broken: "junk",
      },
    };
    const sum = (ws, f) => Object.values(ws).reduce((a, v) => a + (v && typeof v === "object" ? v[f] : 0), 0);
    const s1 = G.normalizeSave(JSON.parse(JSON.stringify(oldSave))), w = s1.wordStats;
    ok("C: migration: merged words add into the id", w.consistent.correct === 3 && w.consistent.wrong === 1 && w.compatible.correct === 5 && w.compatible.wrong === 3, JSON.stringify(w.consistent) + JSON.stringify(w.compatible));
    ok("C: migration: the most recent lastCorrect kept, the id's own fields kept", w.consistent.lastCorrect === 200 && w.consistent.box === 3 && w.compatible.lastCorrect === 300);
    ok("C: migration: nothing lost (right and wrong totals unchanged)", sum(w, "correct") === sum(oldSave.wordStats, "correct") && sum(w, "wrong") === sum(oldSave.wordStats, "wrong"));
    ok("C: migration: old keys gone, other keys as they were", !w.consist && !w.incompatible && w.minimize.correct === 5 && w.analyse.wrong === 3 && w.serendipity.correct === 1 && !w.broken);
    ok("C: migration: marked as version 2", s1.wordStatsVersion === 2 && G.defaultSave().wordStatsVersion === 2);
    const s2 = G.normalizeSave(JSON.parse(JSON.stringify(s1)));
    ok("C: migration: running it again changes nothing", JSON.stringify(s2.wordStats) === JSON.stringify(s1.wordStats));
    // an exported save file goes through the same door
    const exported = { format: G.SAVE_FORMAT, version: G.SAVE_FORMAT_VERSION, save: oldSave };
    ok("C: an old exported save is migrated on import", G.normalizeSave(exported.save).wordStats.consistent.correct === 3);

    // recording and reading through a spelling or a pair
    G.save.wordStats = {};
    G.recordWordResult("minimise", true); G.recordWordResult("minimize", true); G.recordWordResult(["minimise", "x"], false);
    ok("C: answers under any spelling go to one record", G.save.wordStats.minimize && G.save.wordStats.minimize.correct === 2 && G.save.wordStats.minimize.wrong === 1 && !G.save.wordStats.minimise);
    G.recordWordResult("consist", true); G.recordWordResult("consistent", true); G.recordWordResult("consistent", true);
    ok("C: mastery read through any spelling", G.isWordMastered("consist") && G.isWordMastered(G.WordBank.pairs(1).find((p) => p.id === "consistent")) && !G.isWordMastered("minimise"));
    ok("C: G.wordStat finds it too", G.wordStat("consist") === G.save.wordStats.consistent);
  }

  // ---------------- D: Custom Vocabulary ----------------
  async function custom() {
    const CV = G.CustomVocab;
    G.save.customWords = { level1: [], level2: [], level3: [] };
    let r = CV.save("analysis", THAI_X, "level2");
    ok("D: another form of a bank family is refused, naming the family", !r.ok && r.error === "cv.errDup" && r.dupWhere.family === "analyse" && r.dupWhere.key === "level1", JSON.stringify(r.dupWhere));
    r = CV.save("analysed", THAI_X, "level3");
    ok("D: ...a regular ending too", !r.ok && r.dupWhere.family === "analyse");
    r = CV.save("Consist", THAI_X, "level1");
    ok("D: ...and a merged old word", !r.ok && r.dupWhere.family === "consistent");
    r = CV.save("Minimize", THAI_X, "level1");
    ok("D: ...and the other spelling of a headword", !r.ok && r.dupWhere.key === "level3");
    ok("D: no false alarm on look-alikes (ranger, pester)", CV.save("ranger", THAI_X + "1", "level1").ok && CV.save("pester", THAI_X + "2", "level1").ok);
    r = CV.save("serendipity", THAI_X + "3", "level1", null, { definition: "  finding good things by chance ", synonyms: "luck,  chance ; fortune | fluke", example: "It was pure serendipity.", collocations: "", topic: "General Academic" });
    const saved = CV.list("level1").find((p) => p[0] === "serendipity");
    ok("D: optional fields saved, cleaned (at most 3 synonyms)", r.ok && saved && saved[2] && saved[2].definition === "finding good things by chance" && saved[2].synonyms.join() === "luck,chance,fortune" && saved[2].example && saved[2].topic === "General Academic" && !saved[2].collocations, JSON.stringify(saved));
    r = CV.save("zealot", THAI_X + "4", "level1", null, { topic: "Astrology", definition: "" });
    ok("D: an unknown topic and empty fields are dropped (plain pair)", r.ok && CV.list("level1").find((p) => p[0] === "zealot").length === 2);
    const norm = G.normalizeSave(JSON.parse(JSON.stringify(Object.assign({}, G.save, { customWords: { level1: [["a", "b", { definition: "x", evil: 1 }], ["c", "d", "junk"]] } }))));
    ok("D: saves keep the extra fields and drop anything else", norm.customWords.level1[0][2].definition === "x" && !("evil" in norm.customWords.level1[0][2]) && norm.customWords.level1[1].length === 2);
    const imp = CV.importPairs([["lucid", THAI_X + "5", { example: "A lucid account." }], ["analyses", THAI_X]], "level2");
    ok("D: CSV import: extra fields kept, family forms left out", imp.added.join() === "lucid" && imp.dupes.length === 1 && CV.list("level2")[0][2].example === "A lucid account.");

    // the page
    G.Game.quitToMainMenu();
    G.CustomVocabUI.open("screen-mainmenu");
    await wait(200);
    ok("D: form: the details are hidden at first", $("cv-extra").classList.contains("hidden") && $("cv-more").getAttribute("aria-expanded") === "false");
    $("cv-more").click();
    ok("D: form: More details opens them", !$("cv-extra").classList.contains("hidden") && $("cv-more").textContent === G.T("cv.less"));
    ok("D: form: the topic list has the twelve topics", $("cv-topic").options.length === 13 && [...$("cv-topic").options].some((o) => o.value === "Urban Life & Transport"));
    $("cv-en").value = "Quixotic"; $("cv-th").value = THAI_X + "6"; $("cv-level").value = "level3";
    $("cv-def").value = "hopeful in a way that is not practical"; $("cv-syn").value = "idealistic, unrealistic"; $("cv-ex").value = "It was a quixotic plan."; $("cv-col").value = "quixotic quest"; $("cv-topic").value = "Society & Culture";
    $("cv-save").click();
    const q = CV.list("level3").find((p) => p[0] === "Quixotic");
    ok("D: form: all the details go into the save", q && q[2].definition && q[2].synonyms.length === 2 && q[2].collocations[0] === "quixotic quest" && q[2].topic === "Society & Culture", JSON.stringify(q));
    ok("D: form: fields cleared after saving", $("cv-def").value === "" && $("cv-syn").value === "");
    G.CustomVocabUI.tab = "level3"; G.CustomVocabUI.render();
    ok("D: form: the list says which details a word has", /definition, synonyms, example, collocations, topic/.test($("cv-list").textContent), $("cv-list").textContent);
    document.querySelector("#cv-list button[data-act=edit]").click();
    ok("D: form: Edit brings the details back", $("cv-def").value === "hopeful in a way that is not practical" && $("cv-syn").value === "idealistic, unrealistic" && $("cv-topic").value === "Society & Culture" && !$("cv-extra").classList.contains("hidden"));
    $("cv-cancel").click();
    $("cv-en").value = "analysis"; $("cv-th").value = THAI_X + "7"; $("cv-save").click();
    ok("D: form: a family form says whose family it is", $("cv-msg").classList.contains("error") && /word family of .analyse. in Abandoned School/.test($("cv-msg").textContent), $("cv-msg").textContent);
    ok("D: form: every field reachable by keyboard/controller", ["cv-def", "cv-syn", "cv-col", "cv-ex", "cv-topic"].every((id) => G.Pad.focusables($("screen-customvocab")).includes($(id))));
    $("cv-more").click();
    ok("D: form: hidden details are skipped by the controller", !G.Pad.focusables($("screen-customvocab")).includes($("cv-def")));
  }

  // ---------------- E: fields a mode can count on ----------------
  function fields() {
    const B = G.WordBank, p = G.WORDS_LEVEL_1[0];
    ok("E: a bank word has definition, synonyms, examples, collocations", B.has(p, "definition", "synonyms", "examples", "collocations", "topic"));
    const plain = ["kettle", THAI_X], rich = ["kettle", THAI_X, { definition: "a pot for boiling water", example: "Put the kettle on." }];
    ok("E: a plain custom word lacks them", !B.has(plain, "definition") && B.has(plain, "thai"));
    ok("E: a custom word with extras has those", B.has(rich, "definition", "examples") && !B.has(rich, "synonyms"));
    const withPara = B.entries().filter((e) => B.has(e, "paraphrase"));
    ok("E: paraphrase is optional: some have it, modes pick those", withPara.length > 50 && withPara.length < 886, withPara.length);
    ok("E: usable() skips words missing a field", B.usable([p, plain, rich], "definition").length === 2 && B.usable([p, plain, rich], "collocations").length === 1);
    ok("E: info() gives a custom word the entry shape", B.info(rich).custom === true && B.info(rich).examples[0] === "Put the kettle on." && B.info(p) === B.byId(p.id));
  }

  // ---------------- F: the game asks words from the bank ----------------
  async function game() {
    G.save.customWords = { level1: [], level2: [], level3: [] };
    const g = freshRun(1);
    ok("F: a School run's words are the School bank", g.wordPool.length === G.WordBank.count(1) && g.wordPool.every((p) => p.id && G.WordBank.byId(p.id).level === 1));
    for (let i = 0; i < 4; i++) g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(4 + i, -1.7, 0)));
    ok("F: zombies carry bank words", g.zombies.length === 4 && g.zombies.every((z) => G.WordBank.lookup(z.word) && z.meaning === G.WordBank.lookup(z.word).thai));
    // a two-word headword works on a zombie
    g.wordPool = [G.WordBank.pairs(1).find((p) => p.id === "percent")];
    g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(9, -1.7, 0)));
    ok("F: a two-word headword (per cent) spawns on a zombie", g.zombies.some((z) => z.word === "per cent"));
    g.wordPool = G.WORD_SETS.level1.words;
    // boss / lock / crate questions
    G.save.wordStats = {};
    const pair = G.WordBank.pairs(3).find((p) => p.id === "minimize");
    g.startWordChallenge(G.T("challenge.boss"), () => {}, () => {}, { pair, time: 10, boss: true });
    const ch = g.challenge;
    ok("F: a boss question: four different words, the right one among them", ch && ch.choices.length === 4 && new Set(ch.choices).size === 4 && ch.choices.includes("minimise"));
    g.answerChallenge(ch.choices.indexOf("minimise"));
    ok("F: ...answered, it is saved under the entry id", G.save.wordStats.minimize && G.save.wordStats.minimize.correct === 1 && !G.save.wordStats.minimise);
    const hard = G.pickHardWords(g.wordPool, 3);
    ok("F: the vocabulary lock's hard words come from the bank", hard.length === 3 && hard.every((p) => G.WordBank.lookup(p[0])));
    // the end-of-wave quiz
    G.Quiz.resetWave(g);
    g.wordPool.slice(0, 8).forEach((p) => G.Quiz.noteWord(g, p));
    const qs = G.Quiz.build(g);
    ok("F: the end-of-wave quiz builds six questions from the wave's bank words", qs.length === G.CONFIG.quiz.questions && qs.every((q) => G.WordBank.lookup(q.pair[0]) && q.choices.length === 4));
    ok("F: story notes still load (20 for the School)", (G.NOTES.level1 || []).length === 20);
    g.quitToMainMenu();
    // the lobby counts the level's real size
    G.Lobby.open({ tab: "campaign", select: "level1" });
    await wait(300);
    ok("F: the lobby shows mastered / the level's word count", new RegExp("/ " + G.WordBank.count(1)).test(G.Lobby.stats(G.Lobby.MODES.find((m) => m.level === 1)).map((r) => r[1]).join(" ")));
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save);
    const realSpawner = G.Spawner.update, realUpdate = G.Game.update;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    try {
      bank();
      oldWords();
      stats();
      await custom();
      fields();
      await game();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Spawner.update = realSpawner; G.Game.update = realUpdate;
      G.Modal.reset();
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
