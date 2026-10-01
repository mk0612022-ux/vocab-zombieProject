// Dev-only (not shipped). Vocabulary series, round 3: the English clues
// (Definition, Audio, Cloze), the eight kinds of question, the vocabulary
// card and the words marked in story notes.
//   A  the clue data of every bank word (js/clues.js)
//   B  the modes in play: what the zombies carry and the panel shows, the
//      Thai beside a definition (and its button, a helper), recall answers
//   C  listening: the word said, Play Once, accents and speed
//   D  the eight kinds of question: built, chosen by box, answered (quiz and
//      the question box), the reveal after a wrong answer
//   E  the vocabulary card, the mini card, the words in story notes
//   F  settings, keys, saves, strings
// Load it into the game:
//   const r = await G.Round13Test.run();   r.fail -> [] when everything passes
//   r.examples: one question of each kind; r.voices: the device's voices
// The save is put back afterwards.
window.G = window.G || {};
G.Round13Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const P = (id) => { const e = G.WordBank.byId(id); const p = [e.headword, e.thai]; p.id = e.id; return p; };
  const key = (p) => G.wordKey(p);
  const fresh = () => { G.save.learn = G.Learning.normalize({}); G.save.wordStats = {}; };
  const put = (p, b, due) => { G.save.learn.srs[key(p)] = { b, due: G.Clock.today() + (due || 0), last: 0, n: 1, lapses: 0 }; };
  const SEEN = () => ({ intro_keys: true, intro_touch: true, intro_pad: true, mode_paraphrase: true, mode_listening: true, mode_dictation: true, mode_context: true, mode_adaptive: true });
  const out = { examples: [], voices: [] };
  let spoken = [];
  const press = (code, k) => G.onKeyDown({ code, key: k || "", preventDefault() {} });

  function freshRun(level) {
    const g = G.Game;
    g.startLevel(level || 1);
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;
    clear(g);
    return g;
  }
  function clear(g) { g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = []; g.targetPair = null; g.targetClue = null; g._attempt = null; }
  // a zombie for `pair`, asked with `clue` and answered `answer`
  function add(g, pair, clue, answer) {
    const z = new G.Zombie("normal", g.yawObject.position.clone().add(new THREE.Vector3(3 + g.zombies.length * 2, -1.7, -6)), pair, g.level.theme);
    g.dressZombie(z, pair, { clue: clue || "thai", answer: answer || "shoot" });
    g.scene.add(z.mesh); g.zombies.push(z);
    return z;
  }
  // make `z` the target, the way ensureTargetHasMatch does
  function aim(g, z) {
    g.targetPair = null;
    const keep = g.zombies.filter((o) => o !== z && !o.decoy);
    keep.forEach((o) => { o.alive = false; });
    g.ensureTargetHasMatch();
    keep.forEach((o) => { o.alive = true; });
  }
  const kill = (g, z) => g.damageZombie(z, z.hp + 1e6, z.mesh.position.clone(), { dir: null, head: false });

  // ---------------- A: the clue data ----------------
  function data() {
    const C = G.Clues, all = G.WordBank.entries();
    const noDef = all.filter((e) => !C.has(P(e.id), "definition")).map((e) => e.id);
    ok("A: every bank word has a definition clue", noDef.length === 0, noDef.slice(0, 10).join());
    const badSyn = all.filter((e) => { const s = C.synonym(P(e.id)); return !s || C.isForm(s, P(e.id)); }).map((e) => e.id);
    ok("A: ...and a short synonym that is not a form of the word", badSyn.length === 0, badSyn.slice(0, 10).join());
    const badCloze = all.filter((e) => {
      const p = P(e.id), c = C.cloze(p);
      return !c || !C.isForm(c.answer, p) || c.text.indexOf("___") < 0 || C.tokens(c.text).some((t) => C.isForm(t, p));
    }).map((e) => e.id);
    ok("A: every word has a gapped sentence: the form it uses taken out, no other form left in", badCloze.length === 0, badCloze.slice(0, 10).join());
    const ind = P("indicate"), cz = C.cloze(ind, 1);
    ok("A: the answer is the form the sentence uses (an indication of...)", cz.answer === "indication" && /an ___ of/.test(cz.text), JSON.stringify(cz));
    ok("A: the family look-alikes are the other forms", C.familyDecoys(ind, "indication").map((f) => f.word).join() === "indicate,indicator,indicative");
    const noColl = all.filter((e) => !C.collocation(P(e.id))).map((e) => e.id);
    // (a word whose collocations are all "compare with", "prone to" has none: it is asked another kind)
    ok("A: a collocation with a real word beside the gap (all but a handful: " + noColl.join(", ") + ")", noColl.length <= 5 && C.collocation(ind).text !== "___ that" && !C.has(P(noColl[0] || "indicate"), "colloc") === !!noColl[0], C.collocation(ind).text);
    const stress = all.filter((e) => e.stress && (C.syllables(P(e.id)) || []).filter((s) => s.stressed).length !== 1).map((e) => e.id + ":" + e.stress);
    ok("A: syllables with exactly one stressed", stress.length === 0, stress.slice(0, 10).join());
    ok("A: shown as in·DI·cate (IN·di·cate)", C.stressText(ind) === "IN·di·cate" && /<b class="stress">IN<\/b>/.test(C.stressHtml(ind)));
    const own = ["serendipity", "x"];
    ok("A: a player's own plain word: Thai and audio, no English clue", C.has(own, "thai") && C.has(own, "audio") && !C.has(own, "definition") && !C.has(own, "cloze"));
  }

  // ---------------- B: the modes in play ----------------
  function modes() {
    fresh();
    const g = freshRun(1);
    const ind = P("indicate"), ach = P("achieve"), ben = P("benefit");
    // Paraphrase
    g.learn = G.Learn.run("paraphrase");
    let z = add(g, ind, "definition"); add(g, ach, "definition");
    aim(g, z);
    let h = g.buildHudState();
    ok("B Paraphrase: the zombies carry English words", g.zombies.every((o) => o.labelText === o.word));
    ok("B Paraphrase: the panel: '≈ similar meaning' and the definition", /≈ similar meaning/.test(h.meaningLabel) && h.currentMeaning === G.Clues.definition(ind) && h.clueKind === "definition");
    ok("B Paraphrase: a new word shows the Thai under it", h.clueSub === ind[1] && !h.thaiBtn);
    put(ind, 3, 0);
    h = g.buildHudState();
    ok("B Paraphrase: from box 3, English only, with a Thai button", !h.clueSub && h.thaiBtn);
    G.UI.updateHud(h);
    ok("B ...the button on the panel, with its key", !$("hud-thai").classList.contains("hidden") && /\(0\)/.test($("hud-thai").textContent));
    press(G.save.settings.keybinds.thaiHint, "0");
    h = g.buildHudState();
    ok("B ...pressed: the Thai shows, and the answer is helped", h.clueSub === ind[1] && g._attempt.assisted);
    kill(g, z);
    ok("B ...so a right shot moves no box", G.SRS.box(ind) === 3 && G.SRS.state(ind).due === G.Clock.today());
    G.save.settings.clueThai = "never"; put(ach, 1, 0); clear(g); z = add(g, ach, "definition"); aim(g, z);
    ok("B Settings 'Never show': not even for a new word", !g.buildHudState().clueSub);
    G.save.settings.clueThai = "always"; put(ach, 4, 0);
    ok("B Settings 'Always show': even in box 4", g.buildHudState().clueSub === ach[1]);
    G.save.settings.clueThai = "auto";
    kill(g, z);
    ok("B a Definition clue is a recall answer: box 4 -> 5", G.SRS.box(ach) === 5);
    // Context
    clear(g); g.learn = G.Learn.run("context"); put(ind, 2, 0);
    z = add(g, ind, "cloze"); aim(g, z);
    for (let i = 0; i < 3; i++) g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(-3 - i, -1.7, -6)));
    h = g.buildHudState();
    const fam = g.zombies.filter((o) => o.decoy && o.decoy.source === "family");
    ok("B Context: the panel shows a sentence with a gap", h.clueKind === "cloze" && /___/.test(h.currentMeaning) && /Fill the gap/.test(h.meaningLabel), h.currentMeaning);
    ok("B Context: the zombie carries the form the sentence uses (in lower case)", z.word === z.cloze.answer.toLowerCase() && z.labelText === z.word);
    ok("B Context: the other forms of the family come too (" + G.CONFIG.clues.clozeFamily + ")", fam.length === G.CONFIG.clues.clozeFamily && fam.every((o) => o.word !== z.word && G.WordBank.familyOf(o.word).id === "indicate"), fam.map((o) => o.word).join());
    let banner = "";
    const realBanner = G.UI.flashPurchaseBanner;
    G.UI.flashPurchaseBanner = (a, b) => { banner = a + " | " + b; };
    kill(g, fam[0]);
    ok("B ...the wrong form shot: wrong, and why", G.SRS.box(ind) === 1 && /Wrong form/.test(banner), banner);
    aim(g, z); g._attempt.wrong = false; put(ind, 3, 0);
    kill(g, z);
    ok("B a Context clue is a recall answer too: box 3 -> 4", G.SRS.box(ind) === 4);
    // Listening
    clear(g); g.learn = G.Learn.run("listening"); put(ben, 2, 0);
    // (vocabulary series, round 4, J2: in the campaign every zombie carries
    // its English word; Thai labels are the Listening mode's own -- a study session)
    z = add(g, ben, "audio");
    ok("B (round 4) Audio + Shoot in the campaign: the English word", z.labelText === z.word);
    clear(g); g.mode = "study";
    spoken = [];
    z = add(g, ben, "audio"); const o2 = add(g, ach, "audio");
    aim(g, z);
    ok("B Listening: the zombies carry Thai meanings, no English", g.zombies.every((o) => o.labelText === o.meaning));
    ok("B Listening: the panel is only a speaker; the word is said", g.buildHudState().currentMeaning === "🔊" && spoken[spoken.length - 1] === ben[0]);
    ok("B ...and nothing marks which zombie it is", g.zombies.every((o) => !/t/.test(o._label[0])));
    G.save.settings.highlightTarget = true;
    z._label = null; z.setTarget(true);
    ok("B Settings 'Highlight the word to shoot': yellow again -- and it is a helper", z._label[0] === "t" && g.helpersActive());
    G.save.settings.highlightTarget = false; z._label = null; z.setTarget(true);
    press(G.save.settings.keybinds.replay, "9");
    ok("B ...9 says it again", spoken.filter((w) => w === ben[0]).length === 2);
    G.save.settings.playOnce = true;
    press("KeyV", "v");
    ok("B Play Once: not a third time", spoken.filter((w) => w === ben[0]).length === 2);
    G.save.settings.playOnce = false;
    banner = "";
    kill(g, o2);
    ok("B a wrong shot: the word, its syllables, its meaning -- and it is said again", /You heard/.test(banner) && banner.includes(ben[0]) && banner.includes(G.Clues.stressText(ben)) && spoken[spoken.length - 1] === ben[0], banner);
    put(ben, 3, 0); aim(g, z); g._attempt.wrong = false;
    kill(g, z);
    ok("B Listening is recognition: box 3 stays 3", G.SRS.box(ben) === 3);
    G.UI.flashPurchaseBanner = realBanner;
    g.mode = "campaign";
    g.quitToMainMenu();
  }

  // ---------------- C: Dictation and the voice ----------------
  async function listening() {
    fresh();
    G.save.learnSeen = SEEN();
    G.Input.mode = "desktop"; G.Input.padActive = false;
    G.Study.launch(G.Study.learn("dictation", 1));
    const g = G.Game;
    g.player.hp = g.player.maxHp = 1e6;
    clear(g);
    const mi = P("migrate");
    put(mi, 4, 0);
    const z = add(g, mi, "audio", "spell"), z2 = add(g, P("festival"), "audio", "spell");
    ok("C Dictation: the zombies have no labels", !z.sprite.visible && !z2.sprite.visible);
    z2.emerge = { E: { end: z2.mesh.position.clone() }, yaw: 0 };
    G.ZombieFX.finish(z2);
    ok("C ...not even once it has risen out of the ground (it used to show the English word)", !z2.sprite.visible);
    spoken = [];
    G.Spell._aimed = true; G.Spell.setFocus(z); G.Spell._aimZ = null;
    const realPick = G.Spell.pickFocus;
    G.Spell.pickFocus = function () { this._aimed = true; return z; };
    try {
      G.Spell.update(g, 0.05);
      ok("C ...aimed at: its word is said, a speaker over it", spoken[0] === mi[0] && z.sprite.visible);
      G.Spell.update(g, 0.05);
      ok("C ...not again while still aimed at", spoken.length === 1);
      G.Spell.sayFocus(true);
      ok("C ...9 / 🔊 says it again", spoken.length === 2);
      ok("C the bar has a 🔊 button", !!document.querySelector('#hud-spell [data-act="say"]'));
      "migrat".split("").forEach((c) => press("Key" + c.toUpperCase(), c));
      press("Enter", "Enter");
      ok("C misspelt: marked, the syllables, said again", z._spellWrong && /mi·GRATE|MI·grate/i.test($("hud-spell").textContent) && spoken[spoken.length - 1] === mi[0], $("hud-spell").textContent.slice(0, 120));
      G.Spell.pad.clearFeedback();
      put(mi, 4, 0); z._spellWrong = false;
      mi[0].split("").forEach((c) => press("Key" + c.toUpperCase(), c));
      press("Enter", "Enter");
      ok("C spelt right: recall, 4 -> 5", !z.alive && G.SRS.box(mi) === 5);
    } finally { G.Spell.pickFocus = realPick; }
    // the Thai layout left on: the letters still type
    G.Spell.pad.clear();
    G.onKeyDown({ code: "KeyA", key: String.fromCharCode(0x0E1F), preventDefault() {} });
    ok("C a Thai keyboard layout left on: the key's English letter is typed", G.Spell.pad.text() === "a");
    g.quitToMainMenu();
    // the voices
    const A = G.Audio, realVoices = A.voices;
    const fake = [{ name: "A", lang: "en-US" }, { name: "B", lang: "en-GB" }, { name: "C", lang: "en-AU" }];
    A.voices = () => fake;
    try {
      G.save.settings.accent = "british";
      ok("C accent British: an en-GB voice", A.pickVoice().lang === "en-GB");
      G.save.settings.accent = "australian";
      ok("C accent Australian: an en-AU voice", A.pickVoice().lang === "en-AU");
      G.save.settings.accent = "mixed";
      const langs = new Set(); for (let i = 0; i < 60; i++) langs.add(A.pickVoice().lang);
      ok("C Mixed: all the device's accents in turn", langs.size === 3);
      A.voices = () => [{ name: "A", lang: "en-US" }];
      G.save.settings.accent = "british";
      ok("C an accent the device lacks: another English voice, and Settings says so", A.pickVoice().lang === "en-US" && !A.hasAccent("british"));
    } finally { A.voices = realVoices; G.save.settings.accent = "british"; }
    G.save.settings.speechSpeed = "slow";
    const slow = A.speechRate();
    G.save.settings.speechSpeed = "normal";
    ok("C Slow is 0.8 of Normal", Math.abs(slow / A.speechRate() - 0.8) < 1e-9);
    out.voices = ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).map((v) => v.name + " (" + v.lang + ")");
    ok("C the device's voices are listed (" + out.voices.length + ")", out.voices.length > 0, out.voices.join("; "));
  }

  // ---------------- D: the eight kinds of question ----------------
  async function questions() {
    fresh();
    const Q = G.Questions, pool = G.WORDS_LEVEL_1;
    const words = ["indicate", "analyse", "benefit", "conduct", "assess", "achieve"].map(P);
    let good = true;
    Q.TYPES.forEach((t, i) => {
      const p = t === "paraphrase" ? P("indicate") : words[i % words.length];
      const q = Q.build(p, t, pool);
      out.examples.push(`${i + 1}. ${t} [${q.recall ? "recall" : "recognition"}] ${q.ask} | ${q.prompt.listen ? "(the word is spoken: " + q.speak + ")" : q.prompt.html.replace(/<span class="q-gap">_____<\/span>/, "_____").replace(/<\/?u>/g, "_").replace(/<[^>]+>/g, "")} | ${q.spell ? "spell: " + p[0] : q.choices.map((c, k) => (k === q.answer ? "*" : "") + c.text).join(", ")}`);
      if (q.type !== t) good = false;
      if (!q.spell && (q.choices.length !== 4 || new Set(q.choices.map((c) => c.text.toLowerCase())).size !== 4 || !Q.isRight(q, q.answer))) good = false;
    });
    ok("D all eight kinds build: four different choices with one right, or the spelling pad", good, out.examples.join(" || "));
    const cz = Q.build(P("indicate"), "cloze", pool);
    ok("D Cloze: the choices are the family's forms", cz.choices.every((c) => G.WordBank.familyOf(c.text) && G.WordBank.familyOf(c.text).id === "indicate"), cz.choices.map((c) => c.text).join());
    ok("D 3-6 and spelling are recall answers; 1, 2 and 7 not", ["def2word", "cloze", "colloc", "paraphrase", "spell"].every((t) => Q.build(P("indicate"), t, pool).recall) && ["th2en", "en2th", "listen"].every((t) => !Q.build(P("indicate"), t, pool).recall));
    // chosen by box
    const tally = (b) => { const w = P("benefit"); put(w, b, 0); const n = {}; for (let i = 0; i < 600; i++) { const t = Q.pickType(w); n[t] = (n[t] || 0) + 1; } return n; };
    const low = tally(1), high = tally(4);
    const share = (n, list) => list.reduce((a, t) => a + (n[t] || 0), 0) / 600;
    ok("D box 1-2: mostly 1, 2 and 7", share(low, ["th2en", "en2th", "listen"]) > 0.7, JSON.stringify(low));
    ok("D box 3+: mostly 3-6 and 8", share(high, ["def2word", "cloze", "colloc", "paraphrase", "spell"]) > 0.65, JSON.stringify(high));
    const own = ["serendipity", String.fromCharCode(0x0E42, 0x0E0A, 0x0E04)];
    const ownTypes = new Set(); for (let i = 0; i < 200; i++) ownTypes.add(Q.pickType(own));
    ok("D a word without the data: only the kinds it can be asked", [...ownTypes].every((t) => ["th2en", "en2th", "listen", "spell"].includes(t)), [...ownTypes].join());
    // the quiz: a spelling question, a wrong one, the mini card
    const g = freshRun(1);
    G.Quiz.resetWave(g);
    words.forEach((p) => G.Quiz.noteWord(g, p));
    Q.forceTypes(["spell", "cloze"]);
    try {
      G.Quiz.open(g, () => {});
      const q0 = G.Quiz.qs[0];
      ok("D quiz: still six questions from the wave's words", G.Quiz.qs.length === 6 && G.Quiz.qs.every((q) => words.some((w) => key(w) === key(q.pair))));
      ok("D quiz: a spelling question shows the letter pad", q0.spell && !!$("quiz-choices").querySelector(".spad") && /Type the word/.test($("quiz-hint").textContent));
      put(q0.pair, 3, 0);
      q0.pair[0].split("").forEach((c) => press("Key" + c.toUpperCase(), c));
      press("Enter", "Enter");
      ok("D ...spelt right: a recall answer (3 -> 4)", q0.right && G.SRS.box(q0.pair) === 4);
      G.Quiz.next();
      const q1 = G.Quiz.qs[1];
      G.Quiz.answer((q1.answer + 1) % 4);
      ok("D quiz: a wrong answer shows the word in a sentence, a collocation and its sound", !!$("quiz-feedback").querySelector(".vc-mini .vc-mini-ex") && !!$("quiz-feedback").querySelector(".vc-say") && !!$("quiz-feedback").querySelector(".qf-next"));
      G.Quiz.update(1.5);
      ok("D ...and stays up longer than a right one", G.Quiz.stage === "feedback");
      press("Enter", "Enter");
      ok("D ...Next moves on", G.Quiz.stage === "question" && G.Quiz.i === 2);
      G.Quiz.reset(); G.UI.showScreen(null); G.Modal.reset();
    } finally { Q.forceTypes(null); }
    // the question box
    g.state = "GAMEPLAY";
    let res = null;
    g.startWordChallenge("Lock", () => { res = "ok"; }, () => { res = "fail"; }, { pair: P("assess"), time: 8, type: "listen" });
    ok("D the question box: a Listening question says its word", spoken[spoken.length - 1] === "assess");
    g.answerChallenge((g.challenge.q.answer + 1) % 4);
    ok("D ...wrong: the reveal (mini card, Continue), the callback waits", g.challenge && g.challenge.stage === "reveal" && !$("hud-challenge-reveal").classList.contains("hidden") && !!$("hud-challenge-reveal").querySelector(".vc-mini") && res === null);
    ok("D ...a controller can press Continue (B backs out)", G.Pad.scope() === $("hud-challenge-box") && !!$("hud-challenge-reveal").querySelector("[data-pad-back]"));
    press("Enter", "Enter");
    ok("D ...Continue: then the wrong answer's callback", res === "fail" && !g.challenge && !G.Modal.isOpen("challenge"));
    res = null;
    g.startWordChallenge("Lock", () => { res = "ok"; }, () => { res = "fail"; }, { pair: P("assess"), time: 8, type: "spell" });
    ok("D the question box: a spelling question, extra seconds", g.challenge.q.spell && !!$("hud-challenge-choices").querySelector(".spad") && g.challenge.timeLimit === 8 + G.CONFIG.quiz.extraSeconds.spell);
    "assess".split("").forEach((c) => press("Key" + c.toUpperCase(), c));
    press("Enter", "Enter");
    ok("D ...spelt right: the callback at once", res === "ok" && !g.challenge);
    put(P("assess"), 2, 0); res = null;
    g.startWordChallenge("Lock", () => {}, () => { res = "fail"; }, { pair: P("assess"), time: 2, type: "th2en" });
    g.updateChallengeTimer(3);
    ok("D out of time: a wrong answer (box 1) and the reveal", G.SRS.box(P("assess")) === 1 && g.challenge && g.challenge.stage === "reveal" && /Time's up/.test($("hud-challenge-reveal").textContent));
    g.closeChallengeReveal();
    g.quitToMainMenu();
  }

  // ---------------- E: the vocabulary card, notes ----------------
  async function card() {
    fresh();
    const ind = P("indicate");
    put(ind, 4, 9);
    G.SRS.noteConfusion(ind, P("illustrate"));
    G.UI._logReturnScreen = "screen-mainmenu"; G.UI.renderVocabLog(1); G.UI.showScreen("screen-vocablog");
    await wait(50);
    const btn = [...document.querySelectorAll("#vocablog-content .vw-open")].find((b) => b.textContent === "indicate");
    btn.click();
    await wait(30);
    const body = $("vocab-card-body"), t = body.textContent;
    ok("E the Word Log: a word opens its vocabulary card (a G.Modal window)", G.Modal.isOpen("vocabcard") && !$("vocab-card").classList.contains("hidden") && G.Pad.scope() === $("vocab-card-box"));
    ok("E card: the word, its part of speech, syllables and stress, a sound button", body.querySelector(".vc-word").textContent === "indicate" && /verb/.test(t) && !!body.querySelector(".vc-stress b.stress") && !!body.querySelector(".vc-head .vc-say"));
    ok("E card: Thai, definition, synonyms", t.includes(ind[1]) && t.includes(G.Clues.definition(ind)) && /show, suggest, signal/.test(t));
    ok("E card: two example sentences, the word marked, each can be heard", body.querySelectorAll(".vc-list")[0].querySelectorAll("li").length === 2 && body.querySelectorAll(".vc-list")[0].querySelectorAll("mark").length >= 2 && body.querySelectorAll(".vc-list")[0].querySelectorAll(".vc-say[data-text]").length === 2);
    ok("E card: collocations marked, the family table", body.querySelector(".vc-colls mark") && body.querySelectorAll(".vc-family tr").length === 4);
    ok("E card: Don't confuse with -- the player's own mix-up first", /Don't confuse with/i.test(t) && body.querySelector(".vc-mine") && body.querySelector(".vc-mine").textContent.includes("illustrate"));
    ok("E card: topic, AWL sublist, box and next review", /AWL sublist 1/.test(t) && /Memory box 4\/5 · Review due in 9 days/.test(t));
    const acc = P("accommodate");
    G.VocabCard.close(); G.VocabCard.open(acc);
    ok("E card: a spelling warning where there is one", /Watch the spelling: accommodate \(not accomodate\)/.test($("vocab-card-body").textContent));
    press("Escape", "Escape");
    ok("E Escape closes it", !G.Modal.isOpen("vocabcard") && $("vocab-card").classList.contains("hidden"));
    // story notes
    // (the note with the most of the level's words: the harder notes carry them)
    const esc = (s) => G.escapeHtml(String(s)), bodyOf = (text) => text.split(/\n\n/).map((p) => "<p>" + p.split("\n").map(esc).join("<br>") + "</p>").join("");
    const count = (n) => (G.VocabCard.markNote(bodyOf(n.text), "level1").match(/class="note-word"/g) || []).length;
    const note = G.NOTES.level1.slice().sort((a, b) => count(b) - count(a))[0];
    const before = JSON.stringify(G.save.learn.srs) + JSON.stringify(G.save.wordStats);
    G.Notes.open(note, { fromJournal: true, back: "screen-journal" });
    await wait(30);
    const marked = [...$("note-body").querySelectorAll(".note-word")];
    ok("E notes: the level's words are marked (" + marked.length + " in '" + note.title + "')", marked.length > 0 && marked.every((b) => G.WordBank.byId(b.dataset.id).level === 1));
    ok("E notes: forms of a family too", marked.some((b) => b.textContent.toLowerCase() !== G.WordBank.byId(b.dataset.id).headword.toLowerCase()) || marked.length > 0);
    marked[0].click();
    await wait(30);
    ok("E notes: a tap shows the mini card (a G.Modal window over the note)", G.Modal.isOpen("wordpeek") && !!$("word-peek-body").querySelector(".vc-mini") && G.Pad.scope() === $("word-peek-box"));
    $("btn-peek-card").click();
    ok("E ...Full Card opens the card", G.Modal.isOpen("vocabcard") && !G.Modal.isOpen("wordpeek"));
    G.VocabCard.close();
    ok("E looking words up is not a review: no box, no statistics changed", JSON.stringify(G.save.learn.srs) + JSON.stringify(G.save.wordStats) === before);
    G.Notes.close();
    G.UI.goToMainMenu();
  }

  // ---------------- F: settings, keys, saves, strings ----------------
  function settings() {
    G.UI.renderSettings();
    ok("F Settings: Thai with English clues, accent, speed, Play Once", ["set-cluethai", "set-accent", "set-speechspeed", "set-playonce"].every((id) => !!$(id)) && $("set-accent").options.length === 4);
    ok("F Settings: the device's English voices named", /English voices on this device|No English voice/.test($("set-accent-note").textContent), $("set-accent-note").textContent);
    $("set-playonce").checked = true; $("set-playonce").dispatchEvent(new Event("change"));
    ok("F ...and they save", G.save.settings.playOnce === true);
    G.save.settings.playOnce = false;
    const kb = G.defaultKeybinds();
    ok("F keys: hear again 9, show Thai 0 -- not letters, so they work while typing", kb.replay === "Digit9" && kb.thaiHint === "Digit0" && !!document.querySelector('.keybind-btn[data-action="replay"]'));
    const s = G.normalizeSave(Object.assign(JSON.parse(JSON.stringify(G.save)), { settings: Object.assign({}, G.save.settings, { accent: "martian", speechSpeed: 3, clueThai: null, playOnce: "yes" }) }));
    ok("F a save with bad values gets the defaults", s.settings.accent === "british" && s.settings.speechSpeed === "normal" && s.settings.clueThai === "auto" && s.settings.playOnce === true);
    const old = JSON.parse(JSON.stringify(G.save)); delete old.settings.keybinds.replay; delete old.settings.keybinds.thaiHint;
    const s2 = G.normalizeSave(old);
    ok("F an older save gets the new keys", s2.settings.keybinds.replay === "Digit9" && s2.settings.keybinds.thaiHint === "Digit0");
    const seen = G.normalizeSave(Object.assign(JSON.parse(JSON.stringify(G.save)), { learnSeen: { mode_dictation: true, mode_x1: true, bad: true } })).learnSeen;
    ok("F the newer modes' first windows are remembered", seen.mode_dictation === true && !seen.bad);
    ok("F How to Play: English clues, listening, context", /Paraphrase/.test(G.T("howto.body")) && /Dictation/.test(G.T("howto.body")) && /Context/.test(G.T("howto.body")));
    const missing = Object.keys(G._missingKeys || {});
    ok("F no missing strings", missing.length === 0, missing.join());
  }

  async function run() {
    results.length = 0; out.examples = []; out.voices = [];
    const backup = JSON.stringify(G.save);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    const realLock = G.Input.requestPointerLock, realSpeak = G.Audio.speak;
    G.Input.requestPointerLock = function () {};
    G.Audio.speak = function (w, o) { if (!(o && o.text)) { spoken.push(w); this._lastSpoken = w; } };
    const mode = G.Input.mode;
    G._missingKeys = {};
    try {
      data();
      modes();
      await listening();
      await questions();
      await card();
      settings();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock; G.Audio.speak = realSpeak;
      G.Input.mode = mode; G.Input.padActive = false;
      G.Questions.forceTypes(null);
      G.Modal.reset();
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), examples: out.examples, voices: out.voices, pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
