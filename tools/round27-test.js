// Dev-only (not shipped). The overhaul, round 7: every answer explained
// (js/explain.js, js/data/explain_th|zh|fr.js).
//   A  the explanation of every kind of question (the eight, and the three
//      written ones), right and wrong: the words, part of speech and
//      meaning, the cause, an example with its translation; each cause
//      (meaning, confusable with its note, form, part of speech,
//      collocation, context, spelling with the letters marked and its note,
//      another word typed, out of time); a player's own word
//   B  the end-of-wave quiz: in its window, Continue (Enter, Space, a click),
//      1-4 dead, the clock stopped, More / M, Auto-continue after a right
//      answer (Off / 2 s / 4 s), Short / Full; the review at the end (the
//      words missed first, in full; the right ones short, with More)
//   C  the questions of doors, crates, the boss and the third floor's lock:
//      right and wrong both explained before the door opens (or not)
//   D  Practice
//   E  while shooting: the card under the word box -- a wrong word, a right
//      one, two wrong ones merged, nothing for a zombie with no word, never
//      over the combo or the boss's bar, off in Settings; a misspelling in
//      play; Spell to Reload; the Examiner's copies
//   F  a study session's end (Daily Review, the learning modes): the words
//      missed, explained
//   G  the languages: the explanation in the Meaning Language, the example
//      in the Word Language with a translation; the menus' language while a
//      file loads; every example of the bank translated (th, zh, fr)
//   H  Settings (three new rows), the save (defaults, bad values, a save
//      from before), the history of why a word was missed (vocabulary card,
//      Progress), reading moves no box, the sound buttons; four languages
// Load it into the game (in the lobby), then:
//   const r = await G.Round27Test.run();   r.fail -> [] when everything passes
//   r.samples -> 40 explanations as text (the report's spot check)
window.G = window.G || {};
G.Round27Test = (function () {
  const results = [], numbers = {};
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const rect = (el) => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const shown = (el) => !!el && !el.classList.contains("hidden") && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none";
  const X = () => G.Explain;
  const P = (id) => G.WordBank.pairOf(G.WordBank.byId(id));
  const THAI = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
  const HAN = /[一-鿿]/;
  const key = (code) => ({ code, key: code.replace(/^Key|^Digit/, "").toLowerCase(), preventDefault() {} });

  // a question of this kind on this word, answered right (true) or wrong (false, or the text typed)
  function ask(id, type, answer) {
    const pool = G.getAllBuiltinWords();
    const q = G.Questions.build(P(id), type, pool);
    let k;
    if (answer === true) k = q.spell ? G.Questions.rightText(q) : q.answer;
    else if (typeof answer === "string") k = answer;
    else if (typeof answer === "number") k = answer;
    else k = q.spell ? "qqqqq" : (q.answer + 1) % q.choices.length;
    return { q, k, ex: X().forQuestion(q, k, k !== -1 && G.Questions.isRight(q, k), false) };
  }

  // ---------------- A: the explanation of every kind ----------------
  function kinds() {
    const kindsAll = G.Questions.TYPES.concat(G.Questions.EXTRA);
    const words = ["affect", "achieve", "analyse", "acquire", "assess", "evaluate", "benefit"];
    const bad = [];
    let n = 0;
    kindsAll.forEach((type) => {
      const id = words.find((w) => G.Questions.can(type, P(w)));
      // (heard in the Word Language's voice: a device with none is never asked it)
      if (!id && (type === "listen" || type === "dictation") && !G.Clues.has(P("benefit"), "audio")) { (numbers.skipped = numbers.skipped || []).push(type + " (no voice)"); return; }
      if (!id) { bad.push(type + ": no word"); return; }
      [true, false].forEach((right) => {
        const { q, ex } = ask(id, type, right);
        n++;
        const html = X().html(ex, true), text = X().text(ex);
        const yes = ex && ex.right === right && ex.y && ex.y.meaning && html.includes("✓") && (right || html.includes("✗") || ex.cause === "timeout")
          && (right || (ex.why && THAI.test(ex.why))) && ex.example && ex.example.text && THAI.test(ex.example.tr || "");
        if (!yes) bad.push(type + (right ? " right" : " wrong") + ": " + text.replace(/\n/g, " / "));
        if (type === q.type && right) ok("A " + type + ": right -- the word, its meaning, an example (" + q.type + ")", yes, text.split("\n")[0]);
      });
    });
    ok("A every kind of question, right and wrong, is explained (" + n + ")", !bad.length, bad.join(" | "));
    numbers.kinds = kindsAll.length;

    // ---- the causes ----
    const pool = G.getAllBuiltinWords();
    // confusable, with its hand-written note: affect asked, effect picked
    const q1 = G.Questions.build(P("affect"), "th2en", pool);
    const eff = q1.choices.findIndex((c) => c.pair && c.pair.id === "effect");
    const e1 = eff >= 0 ? X().forQuestion(q1, eff, false, false) : X().build({ pair: P("affect"), picked: P("effect"), type: "th2en", right: false });
    ok("A confusable: affect / effect, the note on the pair", e1.cause === "confusable" && e1.note && /affect/.test(e1.why) && THAI.test(e1.why) && e1.x.word === "effect", e1.why);
    ok("A confusable: ✗ effect (N.) = meaning, ✓ affect (V.) = meaning", e1.x.abbr === "N." && e1.y.abbr === "V." && THAI.test(e1.x.meaning) && THAI.test(e1.y.meaning));
    ok("A a tip (common IELTS mistake) in the full version", !!e1.tip && X().html(e1, true).includes("xp-tip") && !X().html(e1, false).includes("xp-tip"), e1.tip);
    // a lexicon look-alike (not a word of the bank)
    const lex = G.Distract.resolve("insure");
    const e2 = X().build({ pair: P("ensure"), picked: lex, type: "th2en", right: false });
    ok("A confusable from the lexicon: ensure / insure (its own part of speech and meaning)", e2.cause === "confusable" && e2.x.abbr === "V." && THAI.test(e2.x.meaning) && e2.note, e2.why);
    // a form of the family in a gap
    const qc = G.Questions.build(P("achieve"), "cloze", pool);
    const fk = qc.choices.findIndex((c) => c.form && c.pair && c.pair.id === "achieve" && !["achieve", qc.answerText.toLowerCase()].includes(c.form.toLowerCase()));
    if (fk >= 0) {
      const e3 = X().forQuestion(qc, fk, false, false);
      ok("A form: another form of the family in the gap -- its part of speech, the headword, the sentence", e3.cause === "form" && e3.x.form && e3.x.head === "achieve" && e3.example && e3.example.i === qc.cloze.which, e3.why);
    } else ok("A form: a family form among the choices", false, JSON.stringify(qc.choices.map((c) => c.text)));
    // part of speech
    const e4 = X().build({ pair: P("ability"), picked: P("achieve"), type: "th2en", right: false });
    ok("A part of speech: a verb taken for a noun", e4.cause === "pos" && e4.why.includes(G.EXPLAIN.th.t.posA.v) && e4.why.includes(G.EXPLAIN.th.t.posA.n), e4.why);
    // collocation
    const qo = G.Questions.build(P("acquire"), "colloc", pool);
    const e5 = X().forQuestion(qo, (qo.answer + 1) % 4, false, false);
    ok("A collocation: what goes with the phrase", e5.cause === "colloc" && e5.why.includes(qo.colloc.partner), e5.why);
    // context: definition, paraphrase, gap
    const e6 = ask("analyse", "def2word", false).ex;
    ok("A context: the definition describes the other word", e6.cause === "context" || e6.cause === "confusable", e6.cause + ": " + e6.why);
    // spelling: a known misspelling, its note, the letters marked
    const e7 = ask("achieve", "spell", "acheive").ex;
    ok("A spelling: the note on a known misspelling", e7.cause === "spelling" && e7.note && /acheive/.test(e7.why), e7.why);
    ok("A spelling: the letters that differ marked on both", e7.diff && /<mark>/.test(e7.diff.typed) && /<mark>/.test(e7.diff.answer) && X().html(e7, false).includes("<mark>"), e7.diff && e7.diff.typed);
    const e8 = ask("evaluate", "spell", "evaluete").ex;
    ok("A spelling: another misspelling -- the template and the tip", e8.cause === "spelling" && !e8.note && THAI.test(e8.why), e8.why);
    // another real word typed
    const e9 = ask("affect", "spell", "effect").ex;
    ok("A typed another word: effect for affect -- confusable, its meaning", e9.cause === "confusable" && e9.x && e9.x.word === "effect" && e9.note, e9.why);
    const e10 = ask("achieve", "spell", "benefit").ex;
    ok("A typed another word: an unrelated one", e10.cause === "word" && e10.x && THAI.test(e10.why), e10.why);
    // out of time
    const e11 = ask("benefit", "th2en", -1).ex;
    ok("A out of time: the answer", e11.cause === "timeout" && !e11.x && THAI.test(e11.why) && !X().html(e11, false).includes("✗"), e11.why);
    // English word -> meaning, listening
    const e12 = ask("benefit", "en2th", false).ex;
    ok("A English -> meaning: whose meaning the one picked is", ["meaning", "confusable"].includes(e12.cause) && e12.why.includes(e12.x.word), e12.why);
    if (G.Questions.can("listen", P("benefit"))) {
      const e13 = ask("benefit", "listen", false).ex;
      ok("A listening: the word that was said", ["meaning", "confusable"].includes(e13.cause) && e13.why.includes("benefit"), e13.why);
    }
    // a right answer: short (one example) and full (translation, family, collocations)
    const r1 = ask("achieve", "th2en", true).ex;
    const sh = X().html(r1, false), fu = X().html(r1, true);
    ok("A right: short = the word and one example; full adds the translation and the family", sh.includes("xp-ex") && !sh.includes("xp-tr") && fu.includes("xp-tr") && fu.includes("xp-fam"));
    // a player's own word
    const own = Object.assign(["zibble", String.fromCharCode(0x0E04, 0x0E33, 0x0E17, 0x0E14, 0x0E2A, 0x0E2D, 0x0E1A), { pos: "n", example: "The zibble was broken." }], { wl: "en", ml: "th" });
    const e14 = X().build({ pair: own, picked: P("benefit"), type: "th2en", right: false });
    ok("A a player's own word: explained, its own example (no translation)", e14 && e14.y.abbr === "N." && e14.example && e14.example.text === "The zibble was broken." && !e14.example.tr && THAI.test(e14.why), X().text(e14));
  }

  // ---------------- B: the end-of-wave quiz ----------------
  async function quiz() {
    const g = G.Game, Q = G.Quiz, S = G.save.settings;
    S.explainDetail = "short"; S.autoContinue = 2;
    const words = ["affect", "achieve", "acquire", "ability", "alternative", "analyse"].map(P);
    g.wordPool = G.WORDS_LEVEL_1.slice(); g.waveWords = words.slice(); g.waveMissed = new Set(); g.wave = 3;
    G.Questions.forceTypes(["th2en", "cloze", "spell", "colloc", "en2th", "def2word"]);
    let passed = null;
    try { Q.open(g, (p) => { passed = p; }); } finally { G.Questions.forceTypes(null); }
    const fb = $("quiz-feedback");
    // 1: wrong
    const q0 = Q.qs[0], box0 = G.SRS.box(q0.pair);
    Q.answer((q0.answer + 1) % q0.choices.length);
    ok("B wrong: the explanation in the window (✗, ✓, why) and Continue", Q.stage === "feedback" && !!fb.querySelector(".xp .xp-x") && !!fb.querySelector(".xp .xp-y") && !!fb.querySelector(".xp-why") && !!fb.querySelector(".qf-next"));
    Q.update(30);
    ok("B wrong: it waits -- the clock stopped (30 s later still there)", Q.stage === "feedback" && Q.i === 0);
    Q.key(key("Digit1")); Q.key(key("Digit3"));
    ok("B the keys 1-4 do nothing while it is up", Q.stage === "feedback" && Q.i === 0);
    Q.key(key("KeyM"));
    ok("B More (M): the full version -- the example's translation", !!fb.querySelector(".xp-body.full") && !!fb.querySelector(".xp-tr") && THAI.test(fb.querySelector(".xp-tr").textContent));
    ok("B reading it moves no box (More, then Continue)", G.SRS.box(q0.pair) === 1 && box0 >= 0);
    const boxAfter = G.SRS.box(q0.pair);
    Q.key(key("Enter"));
    ok("B Enter: the next question", Q.stage === "question" && Q.i === 1 && G.SRS.box(q0.pair) === boxAfter);
    // 2: right, Auto-continue 2 s
    Q.answerAs(true);
    ok("B right: explained too (✓ and an example)", Q.stage === "feedback" && !!fb.querySelector(".xp-ok .xp-y") && !!fb.querySelector(".xp-ex") && !!fb.querySelector(".xp-auto"));
    Q.update(1.5);
    const held = Q.stage === "feedback" && Q.i === 1;
    Q.update(0.6);
    ok("B right: Auto-continue after 2 s", held && Q.stage === "question" && Q.i === 2);
    // 3: right with Auto-continue Off: Space goes on
    S.autoContinue = 0;
    Q.answerAs(true);
    Q.update(10);
    const waited = Q.stage === "feedback" && Q.i === 2;
    Q.key(key("Space"));
    ok("B Auto-continue Off: a right one waits for Continue (Space)", waited && Q.stage === "question" && Q.i === 3);
    // 4: wrong, Full at once; a click on Continue
    S.explainDetail = "full"; S.autoContinue = 4;
    Q.answerAs(false);
    ok("B Full: the full version at once", !!fb.querySelector(".xp-body.full"));
    fb.querySelector(".qf-next").click();
    ok("B a click on Continue", Q.stage === "question" && Q.i === 4);
    // 5: right, 4 s
    Q.answerAs(true);
    Q.update(3.5);
    const held4 = Q.stage === "feedback";
    Q.update(0.6);
    ok("B Auto-continue 4 s", held4 && Q.i === 5);
    // 6: wrong; More pressed holds Auto-continue even for a right one -- (wrong here) Continue
    Q.answerAs(false); Q.key(key("Enter"));
    ok("B the result: the review", Q.stage === "result");
    const miss = $("quiz-missed");
    const wrongRows = miss.querySelectorAll(".qm-row.qm-xp"), rightRows = miss.querySelectorAll(".qm-right");
    ok("B review: the words missed first, each in full", wrongRows.length === Q.mistakes && wrongRows.length === 3 && wrongRows[0].querySelector(".xp-body.full") && miss.firstElementChild.classList.contains("qm-title"), wrongRows.length + " / " + Q.mistakes);
    ok("B review: then the right ones, short, with More", rightRows.length === 3 && !rightRows[0].querySelector(".xp-body.full") && !!rightRows[0].querySelector(".qm-more"));
    rightRows[0].querySelector(".qm-more").click();
    ok("B review: More opens the full one", !!rightRows[0].querySelector(".xp-body.full") && rightRows[0].querySelector(".qm-more").getAttribute("aria-expanded") === "true");
    // the history
    const why = G.Explain.history(q0.pair);
    ok("B a wrong answer's cause is kept on the word (G.save.learn.why)", why.length >= 1 && X().CAUSES.includes(why[why.length - 1].c), JSON.stringify(why));
    Q.close();
    ok("B closed: the callback", passed === false);
    S.explainDetail = "short"; S.autoContinue = 2;
  }

  // ---------------- a run in the school, stepped by hand ----------------
  let realUpd = null;
  function startRun() {
    const g = G.Game;
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    g.update = realUpd;
    G.save.tutorialDone = true;
    G.Input.requestPointerLock = function () {};
    g.startLevel(1);
    g.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    G.Input.clearHeldInputs();
    for (let i = 0; i < 3; i++) realUpd.call(g, 1 / 60);
    return g;
  }

  // ---------------- C: doors, crates, the boss, the lock ----------------
  function challenges(g) {
    const S = G.save.settings;
    S.autoContinue = 2; S.explainDetail = "short";
    let res = null;
    // wrong
    G.Questions.forceTypes(["th2en"]);
    g.startWordChallenge("door", () => { res = "open"; }, () => { res = "fail"; }, { pair: P("affect"), type: "th2en" });
    const c = g.challenge, q = c.q;
    g.answerChallenge((q.answer + 1) % q.choices.length);
    const r = $("hud-challenge-reveal");
    ok("C wrong: explained in the question's box, the door waits", c.stage === "reveal" && !r.classList.contains("hidden") && !!r.querySelector(".xp .xp-x") && !!r.querySelector(".qf-next") && res === null);
    const t0 = c.timeLeft;
    g.updateChallengeTimer(5);
    g.challengeKey(key("Digit2"));
    ok("C wrong: the clock stopped, 1-4 do nothing", g.challenge === c && c.timeLeft === t0 && c.stage === "reveal");
    g.challengeKey(key("Enter"));
    ok("C wrong: Enter -- the door stays shut (onFail)", res === "fail" && !g.challenge && !G.Modal.isOpen("challenge"));
    // right: the boss's question
    res = null;
    g.startWordChallenge("boss", () => { res = "reward"; }, () => { res = "fail"; }, { pair: P("achieve"), type: "th2en", boss: true });
    const c2 = g.challenge;
    g.answerChallenge(c2.q.answer);
    ok("C right (the boss's question): explained first, the reward waits", c2.stage === "reveal" && c2.right && !!r.querySelector(".xp-ok .xp-y") && $("hud-challenge-box").classList.contains("right") && res === null);
    g.updateChallengeTimer(1.5);
    const stillUp = g.challenge === c2;
    g.updateChallengeTimer(0.6);
    ok("C right: Auto-continue -- then the reward (onSuccess)", stillUp && res === "reward" && !g.challenge);
    // out of time
    res = null;
    g.startWordChallenge("crate", () => { res = "open"; }, () => { res = "fail"; }, { pair: P("benefit"), type: "th2en" });
    g.challenge.timeLeft = 0.01; g.updateChallengeTimer(0.05);
    ok("C out of time: explained (the answer), then onFail", g.challenge && g.challenge.stage === "reveal" && r.textContent.includes(G.EXPLAIN.th.t.why.timeout.split(" ")[0]));
    g.closeChallengeReveal();
    ok("C ...Continue: onFail", res === "fail");
    // a written answer
    g.startWordChallenge("hatch", () => { res = "open"; }, () => { res = "fail"; }, { pair: P("achieve"), type: "spell" });
    g.answerChallenge("acheive");
    ok("C a misspelling: the note and the letters marked", g.challenge.stage === "reveal" && /acheive/.test(r.textContent) && !!r.querySelector("mark"));
    g.closeChallengeReveal();
    // the test helper goes past both
    g.startWordChallenge("t", () => { res = "ok2"; }, () => {}, { pair: P("benefit"), type: "th2en" });
    g.answerChallengeAs(true);
    ok("C answerChallengeAs(true): right, explained and closed (the callback run)", res === "ok2" && !g.challenge);
    G.Questions.forceTypes(null);
    // the third floor's lock asks through the same window
    ok("C the third floor's lock and the boss use startWordChallenge", /startWordChallenge\(T\("challenge\.lock"/.test(String(G.Floor3.ask)) && /startWordChallenge\(G\.T\("challenge\.boss"\)/.test(String(g.afterBoss)));
  }

  // ---------------- D: Practice ----------------
  async function practice() {
    const Pr = G.Practice, S = G.save.settings;
    S.autoContinue = 0;
    G.Questions.forceTypes(["th2en", "spell"]);
    try { Pr.run(["affect", "achieve", "benefit"].map(P), "classic", G.WORDS_LEVEL_1, "setup"); } finally { G.Questions.forceTypes(null); }
    const fb = $("practice-feedback");
    Pr.answerAs(false);
    ok("D wrong: explained, Continue", Pr.stage === "feedback" && !!fb.querySelector(".xp .xp-x") && !!fb.querySelector(".qf-next"));
    Pr.key(key("Digit1"));
    ok("D 1-4 do nothing", Pr.stage === "feedback" && Pr.i === 0);
    Pr.key(key("Enter"));
    ok("D Enter: the next", Pr.stage === "question" && Pr.i === 1);
    Pr.answerAs(true);
    ok("D right: explained, waits (Auto-continue Off)", Pr.stage === "feedback" && !!fb.querySelector(".xp-ok"));
    Pr.key(key("Space"));
    ok("D Space: the next", Pr.i === 2);
    Pr.active = false; clearTimeout(Pr._t); G.Modal.close("practice");
    S.autoContinue = 2;
  }

  // ---------------- E: while shooting ----------------
  async function shooting(g) {
    const S = G.save.settings, card = $("hud-xcard");
    S.explainCards = true;
    g.player.hp = g.player.maxHp = 1e6;          // (wrong shots hurt)
    G.UI.setHudVisible && G.UI.setHudVisible(true);
    const mkZ = (pair) => {
      const z = g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(3, -1.7, 0)));
      z.word = pair[0]; z.meaning = pair[1]; z.pair = pair; z.clueKind = "thai";
      return z;
    };
    const target = (pair) => {
      g.targetPair = [pair[0], pair[1]]; g.targetPair.id = G.wordKey(pair);
      g.targetClue = { kind: "thai", pair, cloze: null, full: "", played: 0, thaiShown: false };
      g._attempt = { key: G.wordKey(pair), wrong: false, assisted: false, retry: false };
    };
    // (the target is set again before each shot: a kill may pick a new one)
    const kill = (z, t) => { target(t || P("consistent")); z.alive = false; g.onZombieDeath(z); };
    G.ExplainCard.hide();
    target(P("consistent"));
    kill(mkZ(P("constant")));
    ok("E a wrong word shot: the card -- ✗ constant = meaning · ✓ consistent = meaning", shown(card) && card.classList.contains("bad") && /✗/.test(card.textContent) && /constant/.test(card.textContent) && /consistent/.test(card.textContent) && THAI.test(card.textContent), card.textContent);
    ok("E ...its cause kept (a look-alike)", G.Explain.history(P("consistent")).slice(-1)[0].c === "confusable");
    kill(mkZ(P("considerable")));
    ok("E two wrong shots in quick succession: one card, both words", (card.textContent.match(/✗/g) || []).length === 1 && /constant/.test(card.textContent) && /considerable/.test(card.textContent), card.textContent);
    target(P("consistent"));
    kill(mkZ(P("consistent")));
    ok("E the right word: ✓ consistent (Adj.) = meaning", shown(card) && card.classList.contains("ok") && /consistent/.test(card.textContent) && /Adj\./.test(card.textContent) && !/✗/.test(card.textContent), card.textContent);
    ok("E the card stays 2 s for a right one, 3.5 s for a wrong one", G.CONFIG.explain.cardRight === 2 && G.CONFIG.explain.cardWrong >= 3 && G.CONFIG.explain.cardWrong <= 4);
    // a zombie with no word on it
    G.ExplainCard.hide();
    target(P("consistent"));
    const blank = mkZ(P("benefit")); blank.word = "";
    kill(blank);
    ok("E a zombie with no word: no card", !shown(card));
    // never over the combo or the boss's bar
    target(P("consistent"));
    kill(mkZ(P("constant")));
    const combo = $("hud-combo"), boss = $("hud-boss-bar");
    combo.textContent = "x5 COMBO"; combo.classList.remove("hidden");
    boss.classList.remove("hidden");
    const cr = rect(card), ok1 = !over(cr, rect(combo)), ok2 = !over(cr, rect(boss)), ok3 = !over(cr, rect(document.querySelector(".hud-meaning-box")));
    ok("E the card: under the word box, not over the combo or the boss's bar", shown(card) && ok1 && ok2 && ok3, JSON.stringify({ card: [cr.top | 0, cr.bottom | 0], combo: [rect(combo).top | 0], boss: [rect(boss).top | 0, rect(boss).bottom | 0] }));
    boss.classList.add("hidden"); combo.classList.add("hidden");
    // off in Settings
    G.ExplainCard.hide(); S.explainCards = false;
    target(P("consistent"));
    kill(mkZ(P("constant")));
    ok("E cards off in Settings: none", !shown(card));
    S.explainCards = true;
    // a misspelling in play
    const zs = mkZ(P("achieve")); zs.answer = "spell"; zs.clueKind = "thai";
    g.spellMiss(zs, "acheive");
    ok("E a misspelling in play: the card, the letters marked", shown(card) && /acheive/.test(card.textContent) && !!card.querySelector("mark"), card.textContent);
    ok("E ...its cause: spelling", G.Explain.history(P("achieve")).slice(-1)[0].c === "spelling");
    // Spell to Reload
    G.ExplainCard.hide();
    g.waveWords = [P("achieve")]; g.wordPool = G.WORDS_LEVEL_1.slice();
    let done = null;
    G.SpellReload.open(g, (r) => { done = r; });
    G.SpellReload.submit("acheive");
    ok("E Spell to Reload, wrong: the card", shown(card) && /acheive/.test(card.textContent));
    G.SpellReload.finish();
    ok("E ...half a reload", done === "half");
    // the Examiner's copies (js/bossmoves.js): a copy shot, the real one -- the card
    const src = await fetch("js/bossmoves.js?v=" + Date.now()).then((r) => r.text());
    ok("E the Examiner's copies: a wrong copy and the right one, on the card", /c\.onShot = \(\) => \{[\s\S]{0,500}G\.ExplainCard\.show\(G\.Explain\.answer\(\{ pair: ans, picked: w/.test(src) && /G\.ExplainCard\.show\(G\.Explain\.build\(\{ pair: ans, right: true/.test(src));
  }

  // ---------------- F: the end of a study session ----------------
  function studyEnd(g) {
    const cards = [P("affect"), P("achieve")];
    g.study = G.Study.make("learn", cards, { preset: "classic", levelId: 1 });
    g.study.done[G.wordKey(cards[0])] = "wrong"; g.study.done[G.wordKey(cards[1])] = "wrong"; g.study.answered = 2;
    g.explainLog = { [G.wordKey(cards[0])]: X().build({ pair: cards[0], picked: P("effect"), type: "th2en", right: false }) };
    G.Study.finish(g, "done");
    const m = $("study-result-missed"), rows = m.querySelectorAll(".qm-xp");
    ok("F a study session's end: the words missed, explained (the word taken for it; or the word itself)", rows.length === 2 && /effect/.test(rows[0].textContent) && !!rows[1].querySelector(".xp-y") && !!rows[0].querySelector(".xp-tr"), rows.length);
    G.Study.closeResult();
    g.study = null;
  }

  // ---------------- G: the languages ----------------
  async function languages() {
    const S = G.save.settings, wl0 = S.wordLang, ml0 = S.meaningLang;
    const load = (l) => new Promise((r) => X().load(l, r));
    await load("zh"); await load("fr");
    const set = (w, m) => { S.wordLang = w; S.meaningLang = m; G.Lang.apply(); };
    try {
      set("en", "zh");
      const z = X().build({ pair: P("affect"), picked: P("effect"), type: "th2en", right: false });
      ok("G Meaning Language Chinese: the note, the meanings and the translation in Chinese", z.lang === "zh" && HAN.test(z.why) && HAN.test(z.y.meaning) && HAN.test(z.example.tr), z.why);
      const lx = G.Distract.resolve("insure");
      ok("G the lexicon's words have a Chinese meaning (English > Chinese)", lx && HAN.test(lx[1]) && lx.ml === "zh", lx && lx[1]);
      set("en", "fr");
      const f = X().build({ pair: P("benefit"), picked: P("achieve"), type: "th2en", right: false });
      ok("G Meaning Language French: the template in French, the translation French", f.lang === "fr" && /signifie|nom|verbe/.test(f.why) && /[a-z]/.test(f.example.tr) && f.example.tr !== f.example.text, f.why + " | " + f.example.tr);
      set("fr", "th");
      const ft = X().build({ pair: P("benefit"), right: true, type: "th2en" });
      ok("G Word Language French: the example in French, translated into Thai", ft.example && ft.example.lang === "fr" && ft.example.text === G.EXPLAIN.fr.ex.benefit[0] && THAI.test(ft.example.tr), ft.example && ft.example.text);
      set("th", "en");
      const te = X().build({ pair: P("benefit"), picked: P("achieve"), type: "th2en", right: false });
      ok("G Meaning Language English: the English templates, the example in Thai with the English", te.lang === "en" && /means|meaning/.test(te.why) && THAI.test(te.example.text) && /[A-Za-z]/.test(te.example.tr), te.why);
      // while the Meaning Language's file is not there: the menus' language
      set("en", "zh");
      const keep = G.EXPLAIN.zh; delete G.EXPLAIN.zh;
      const realLoad = X().load; X().load = function () {};
      const lang0 = G.lang; G.lang = "th";
      const fb = X().build({ pair: P("affect"), picked: P("benefit"), type: "th2en", right: false });
      G.lang = lang0; X().load = realLoad; G.EXPLAIN.zh = keep;
      ok("G the Meaning Language's file not loaded yet: the menus' language", fb.lang === "th" && THAI.test(fb.why), fb.why);
    } finally { set(wl0, ml0); }
    // every example of the bank translated
    const E = G.WordBank.entries();
    ["th", "zh", "fr"].forEach((l) => {
      const n = E.filter((e) => { const x = G.EXPLAIN[l].ex[e.id]; return x && x.length === e.examples.length && x.every((s) => s && s.trim()); }).length;
      numbers["examples_" + l] = n + "/" + E.length;
      ok("G every example translated: " + l, n === E.length, n + "/" + E.length);
    });
  }

  // ---------------- H: Settings, the save, the history, sound, strings ----------------
  async function settingsAndSave() {
    const S = G.save.settings;
    // the defaults, a bad value, a save from before
    const d = G.normalizeSave({ settings: {} });
    ok("H a save from before: Short, Auto-continue 2 s, cards on", d.settings.explainDetail === "short" && d.settings.autoContinue === 2 && d.settings.explainCards === true);
    const b = G.normalizeSave({ settings: { explainDetail: "huge", autoContinue: 7, explainCards: false } });
    ok("H bad values back to the defaults; Off kept", b.settings.explainDetail === "short" && b.settings.autoContinue === 2 && b.settings.explainCards === false);
    const L = G.Learning.normalize({ v: 1, srs: {}, why: { affect: [{ d: 5, c: "confusable", x: "effect", t: "th2en" }, { c: "nonsense" }, "x", { d: 6, c: "spelling", x: "affec" }], bad: "no" } });
    ok("H the history: kept, cleaned (unknown causes and junk dropped), v 2", L.v === 2 && L.why.affect.length === 2 && L.why.affect[1].c === "spelling" && !L.why.bad);
    const L0 = G.Learning.normalize({ v: 1, srs: {} });
    ok("H a learn save from before the history: an empty one", L0.why && Object.keys(L0.why).length === 0);
    for (let i = 0; i < 8; i++) X().answer({ pair: P("benefit"), picked: P("achieve"), type: "th2en", right: false });
    ok("H the history keeps the last " + G.CONFIG.explain.history, X().history(P("benefit")).length === G.CONFIG.explain.history);
    // Settings > Gameplay
    G.SettingsUI.cat = "gameplay"; G.SettingsUI.render();
    ok("H Settings: Explanations, Auto-continue, the cards", !!$("set-explaindetail") && !!$("set-autocontinue") && !!$("set-explaincards"));
    G.SettingsUI.pick($("set-explaindetail"), "full"); G.SettingsUI.pick($("set-autocontinue"), "4");
    const sw = $("set-explaincards"); sw.checked = false; sw.onchange();
    ok("H ...each saved", S.explainDetail === "full" && S.autoContinue === 4 && S.explainCards === false);
    G.SettingsUI.pick($("set-explaindetail"), "short"); G.SettingsUI.pick($("set-autocontinue"), "0");
    ok("H ...Off is 0", S.autoContinue === 0);
    S.autoContinue = 2; S.explainCards = true;
    // the vocabulary card and Progress
    G.VocabCard.open(P("benefit"));
    const card = $("vocab-card-body").textContent;
    G.VocabCard.close();
    ok("H the vocabulary card: why it was missed", card.includes(G.T("card.whyWrong")) && card.includes("achieve"), card.slice(card.indexOf(G.T("card.whyWrong")), card.indexOf(G.T("card.whyWrong")) + 80));
    const lw = G.Progress.lastWhy(P("benefit"));
    ok("H Progress: the last cause beside a word missed", /achieve/.test(lw) && (lw.includes(G.T("explain.cause.pos")) || lw.includes(G.T("explain.cause.meaning"))), lw);
    // the sound buttons: the word, and the sentence in the Word Language
    const host = document.createElement("div"); document.body.appendChild(host);
    const said = [], realSpeak = G.Audio.speak;
    G.Audio.speak = (w, o) => said.push([w, o && o.lang, !!(o && o.text)]);
    try {
      const v = G.ExplainView.show(host, X().build({ pair: P("benefit"), right: true, type: "th2en" }), { onContinue() {} });
      host.querySelectorAll(".vc-say").forEach((btn) => btn.click());
      v.closed = true;
    } finally { G.Audio.speak = realSpeak; host.remove(); }
    ok("H the speaker: the word and the example sentence", said.some((s) => s[0] === "benefit" && !s[2]) && said.some((s) => s[2] && s[1] === "en" && /benefit/i.test(s[0])), JSON.stringify(said));
    // the strings in four languages
    const lang0 = G.lang;
    for (const l of ["th", "zh", "fr", "en"]) {
      await new Promise((r) => G.setUILang(l, { done: r }));
      G.SettingsUI.cat = "gameplay"; G.SettingsUI.render();
      const ex = X().build({ pair: P("benefit"), picked: P("achieve"), type: "th2en", right: false });
      const host2 = document.createElement("div"); document.body.appendChild(host2);
      const v2 = G.ExplainView.show(host2, ex, {}); v2.closed = true;
      const txt = host2.textContent; host2.remove();
      const page = $("settings-content").textContent;
      ok("H the strings in " + l + " (Settings rows, More, Continue)", page.includes(G.T("settings.explainDetail")) && page.includes(G.T("settings.autoContinue")) && page.includes(G.T("settings.explainCards")) && txt.includes(G.T("explain.more")) && txt.includes(G.T("challenge.continue")), txt.slice(0, 60));
    }
    await new Promise((r) => G.setUILang(lang0, { done: r }));
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save), lang0 = G.lang, mode0 = G.Input.mode;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    G._missingKeys = {};
    let samples = [];
    try {
      G.save.settings.controlMode = "auto"; G.Input.mode = "desktop";
      G.save.settings.wordLang = "en"; G.save.settings.meaningLang = "th"; G.Lang.apply();
      await new Promise((r) => X().preload(r));
      kinds();
      await quiz();
      await practice();
      const g = startRun();
      challenges(g);
      await shooting(g);
      studyEnd(g);
      await languages();
      await settingsAndSave();
      samples = X().sample(40, 7).map((s, i) => (i + 1) + ". [" + s.type + (s.right ? ", right" : ", wrong") + "] " + s.text.replace(/\n/g, " / "));
      ok("the spot check: 40 explanations", samples.length === 40);
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      if (realUpd) G.Game.update = realUpd;
      G.Questions.forceTypes(null);
      G.Modal.reset();
      G.ExplainCard.hide();
      G.Input.mode = mode0; G.UI.applyControlMode();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.Lang.apply();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers, samples };
  }
  return { run };
})();
