// Dev-only (not shipped). Vocabulary series, round 2: memory boxes, the
// learning modes, spelling, Daily Review and look-alike distractors.
//   A  the five boxes over simulated days (G.Clock.offsetDays): intervals,
//      recall needed for boxes 4-5, Mastered, wrong -> box 1, help -> nothing
//   B  what counts as right in play (C2): first time only, a zombie that
//      bites, helpers, distractors, spelling with hints (money cut)
//   C  the words of a wave (C3): due first, at most four new, six at least,
//      the quiz only on the wave's words
//   D  Daily Review (C4): due words only, 30 a session + Continue, no money,
//      the streak (a day with nothing due does not break it)
//   E  the first boxes from the old statistics (C5), and a save kept valid
//   F  look-alike distractors (E1) and confused pairs (E2), with examples
//   G  spelling (D1, D3, D4, D5): matching, marks, tips, tiles, keys, pad
//   H  Spell to Reload (D2)
//   I  the windows, the lobby cards, Settings, strings
// Load it into the game:
//   const r = await G.Round12Test.run();   r.fail -> [] when everything passes
//   r.log (the simulated days), r.examples (distractors picked)
// The save is put back afterwards.
window.G = window.G || {};
G.Round12Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const P = (id) => { const e = G.WordBank.byId(id); const p = [e.headword, e.thai]; p.id = e.id; return p; };
  const key = (p) => G.wordKey(p);
  const fresh = () => { G.save.learn = G.Learning.normalize({}); G.save.wordStats = {}; };
  const day = (n) => { G.Clock.offsetDays = n; };
  let base = 0;
  // a word straight into a box, due on day `due` (relative to base)
  const put = (p, b, due) => { G.save.learn.srs[key(p)] = { b, due: base + due, last: base, n: 1, lapses: 0 }; };
  const out = { log: [], examples: [] };

  // ---------------- a run with the loop stopped ----------------
  function freshRun(level) {
    const g = G.Game;
    g.startLevel(level || 1);
    g._realUpdate = g._realUpdate || null;
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;
    clear(g);
    return g;
  }
  function clear(g) { g.zombies.forEach((z) => { g.scene.remove(z.mesh); }); g.zombies = []; g.targetPair = null; g._attempt = null; }
  function add(g, pair, answer) {
    const z = new G.Zombie("normal", g.yawObject.position.clone().add(new THREE.Vector3(3 + g.zombies.length * 2, -1.7, -6)), pair, g.level.theme);
    if (answer === "spell") z.setAnswer("spell", pair[1]);
    g.scene.add(z.mesh); g.zombies.push(z);
    return z;
  }
  function aim(g, pair) {
    g.targetPair = [pair[0], pair[1]]; g.targetPair.id = pair.id;
    g._attempt = { key: key(pair), wrong: false, assisted: g.helpersActive(), retry: false };
    g.zombies.forEach((z) => z.setTarget(z.word === pair[0]));
  }
  const kill = (g, z) => g.damageZombie(z, z.hp + 1e6, z.mesh.position.clone(), { dir: null, head: false });

  // ---------------- A: the boxes over simulated days ----------------
  function boxes() {
    fresh(); day(0); base = G.Clock.today();
    const w = P("analyse");
    const act = (d, right, opts, label) => {
      day(d);
      const r = G.SRS.answer(w, right, opts || {});
      out.log.push(`day ${d}: ${label} -> ${r.to >= 6 ? "Mastered" : "box " + r.to} (${r.change}), next review day ${r.due - base}`);
      return r;
    };
    ok("A: a word never met is New", G.SRS.isNew(w) && G.SRS.box(w) === 0);
    let r = act(0, true, {}, "right, first time met");
    ok("A: first right answer: box 1, due tomorrow", r.to === 1 && r.due === base + 1);
    r = act(0, true, {}, "right again the same day");
    ok("A: right before it is due: nothing moves (spacing)", r.change === "none" && G.SRS.box(w) === 1 && G.SRS.state(w).due === base + 1);
    r = act(1, true, {}, "right (shot)");
    ok("A: due and right: box 2, back in 3 days", r.to === 2 && r.due === base + 4);
    r = act(4, true, {}, "right (shot)");
    ok("A: box 3, back in 7 days", r.to === 3 && r.due === base + 11);
    r = act(11, true, {}, "right (shot)");
    ok("A: shooting (recognition) goes no higher than box 3", r.to === 3 && r.change === "same" && r.due === base + 18);
    r = act(18, true, { recall: true }, "right (spelt)");
    ok("A: spelt (recall): box 4, back in 14 days", r.to === 4 && r.due === base + 32);
    r = act(32, true, { recall: true }, "right (spelt)");
    ok("A: box 5, back in 30 days", r.to === 5 && r.due === base + 62);
    r = act(62, true, { recall: true }, "right (spelt)");
    ok("A: past box 5: Mastered, back in 60 days", r.to === 6 && r.due === base + 122);
    r = act(122, true, { recall: true }, "right (spelt)");
    ok("A: Mastered stays Mastered, every 60 days", r.to === 6 && r.due === base + 182);
    r = act(182, false, {}, "wrong");
    ok("A: wrong: back to box 1, due tomorrow, a lapse counted", r.to === 1 && r.due === base + 183 && G.SRS.state(w).lapses === 1);
    r = act(183, true, { assisted: true }, "right with a hint");
    ok("A: right with help: nothing moves", r.change === "none" && G.SRS.box(w) === 1);
    day(0);
    const d = new Date();
    ok("A: the day is the device's own calendar day", G.Clock.today() === Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5));
    const S = G.save.learn.srs;
    ok("A: every word in a box has a due date", Object.keys(S).length > 0 && Object.keys(S).every((k) => Number.isFinite(S[k].due)));
    // the quiz is recognition too
    const q = P("benefit"); put(q, 3, 0);
    G.Learning.answerWord(q, true, { inView: [] });
    ok("A: a multiple-choice right answer at box 3 stays at box 3", G.SRS.box(q) === 3 && G.SRS.state(q).due === base + 7);
  }

  // ---------------- B: what counts in play (C2) ----------------
  function play() {
    fresh(); day(0); base = G.Clock.today();
    const g = freshRun(1);
    const Y = P("assess"), X = P("illustrate");
    // right the first time
    put(Y, 2, 0);
    add(g, Y); add(g, X); aim(g, Y);
    kill(g, g.zombies.find((z) => z.word === Y[0]));
    ok("B: target shot first time: up a box (2 -> 3)", G.SRS.box(Y) === 3);
    // wrong first, then right
    clear(g); put(Y, 2, 0); put(X, 2, 0);
    const zy = add(g, Y), zx = add(g, X); aim(g, Y);
    kill(g, zx);
    ok("B: the wrong zombie shot: the target is wrong (box 1)", G.SRS.box(Y) === 1);
    ok("B: ...and the one shot is not scored (it was not asked)", G.SRS.box(X) === 2);
    ok("B: ...and the pair is noted (E2)", G.SRS.confusionCount(Y, X) === 1);
    aim(g, Y); g._attempt.wrong = true;             // (the same target, as the game keeps it)
    const before = JSON.stringify(G.SRS.state(Y));
    kill(g, zy);
    ok("B: right after a wrong shot: still wrong, nothing moves up", JSON.stringify(G.SRS.state(Y)) === before);
    // bitten
    clear(g); put(Y, 2, 0);
    const zb = add(g, Y); aim(g, Y);
    g.learnBitten(zb);
    ok("B: the target reaches the player first: wrong (box 1)", G.SRS.box(Y) === 1);
    // helpers
    clear(g); put(Y, 2, 0);
    const realHelp = g.helpersActive;
    g.helpersActive = () => true;
    try {
      add(g, Y); aim(g, Y);
      kill(g, g.zombies[0]);
      ok("B: with a hint perk or ability on: no box change", G.SRS.box(Y) === 2 && G.SRS.state(Y).due === base);
    } finally { g.helpersActive = realHelp; }
    // a decoy look-alike shot
    clear(g); put(Y, 2, 0);
    const lex = G.CONFUSABLES[0];
    add(g, Y); const zd = add(g, [lex.headword, lex.thai]); zd.decoy = { forKey: key(Y), source: "confusable" }; zd.lookAlikeFor = key(Y);
    aim(g, Y);
    const statsBefore = JSON.stringify(G.save.wordStats[lex.headword.toLowerCase()] || null);
    kill(g, zd);
    ok("B: a decoy shot: wrong on the target, the pair noted", G.SRS.box(Y) === 1 && G.SRS.confusionCount(Y, lex.headword) === 1);
    ok("B: ...the decoy's own word is not scored", JSON.stringify(G.save.wordStats[lex.headword.toLowerCase()] || null) === statsBefore && G.SRS.isNew([lex.headword, lex.thai]));
    // spelling: a hint moves nothing and costs money
    clear(g); const S1 = P("migrate"); put(S1, 3, 0);
    g.player.combo = 0; let m0 = g.player.money;
    g.spellKill(add(g, S1, "spell"), { hints: 0 });
    const noHint = g.player.money - m0;
    ok("B: spelt right: recall, 3 -> 4", G.SRS.box(S1) === 4);
    put(S1, 3, 0); g.player.combo = 0; m0 = g.player.money;
    g.spellKill(add(g, S1, "spell"), { hints: 1 });
    const oneHint = g.player.money - m0;
    ok("B: spelt with a hint: no box change", G.SRS.box(S1) === 3);
    ok("B: ...and the money is cut by 30% a hint", oneHint === Math.round(noHint * (1 - G.CONFIG.spell.hintPenalty)), noHint + " -> " + oneHint);
    // spelt wrong, then right
    clear(g); put(S1, 3, 0);
    const zs = add(g, S1, "spell");
    g.spellMiss(zs, "migrat");
    ok("B: misspelt: wrong (box 1)", G.SRS.box(S1) === 1);
    const st = JSON.stringify(G.SRS.state(S1));
    g.spellKill(zs, { hints: 0 });
    ok("B: then spelt right: stays wrong", JSON.stringify(G.SRS.state(S1)) === st);
    g.quitToMainMenu();
  }

  // ---------------- C: the words of a wave ----------------
  function waves() {
    fresh(); day(0); base = G.Clock.today();
    const pool = G.WORD_SETS.level1.words.slice(0, 60);
    pool.slice(0, 3).forEach((p) => put(p, 2, 0));          // due
    pool.slice(3, 11).forEach((p) => put(p, 1, 1));         // being learnt
    pool.slice(11, 21).forEach((p) => put(p, 4, 9));        // known
    const plan = G.WavePlan.build(pool, 12), d = G.WavePlan.describe(plan);
    out.examples.push("wave of 12 from 3 due / 8 learning / 10 known / 39 new -> " + JSON.stringify(d));
    ok("C: every due word is in the wave", pool.slice(0, 3).every((p) => plan.includes(p)));
    ok("C: at most 4 new words in a wave", d.fresh <= G.CONFIG.waveWords.maxNew && d.fresh > 0, JSON.stringify(d));
    ok("C: words being learnt (boxes 1-2) are mixed in", d.learning >= 3);
    ok("C: twelve different words", plan.length === 12 && new Set(plan.map(key)).size === 12);
    fresh();
    const newbie = G.WavePlan.build(pool, G.WavePlan.size(pool, 8));
    ok("C: a new player still gets six different words (more than four new only then)", newbie.length >= 6 && G.WavePlan.size(pool, 2) >= 6, newbie.length);
    // in a run: the zombies and the quiz take the wave's words
    fresh();
    const g = freshRun(1);
    g.startWave();
    const planned = new Set(g.wavePlan.map(key));
    for (let i = 0; i < 14; i++) { const z = g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(5, -1.7, -5))); g.scene.remove(z.mesh); g.zombies = g.zombies.filter((o) => o !== z); }
    ok("C: the wave's zombies carry the planned words", g.waveWords.length >= 6 && g.waveWords.every((p) => planned.has(key(p))), g.waveWords.length + " words");
    const qs = G.Quiz.build(g);
    ok("C: the end-of-wave quiz asks only this wave's words", qs.length === G.CONFIG.quiz.questions && qs.every((q) => planned.has(key(q.pair))));
    g.quitToMainMenu();
  }

  // ---------------- D: Daily Review and the streak ----------------
  async function daily() {
    fresh(); day(0); base = G.Clock.today();
    const all = G.getAllBuiltinWords();
    all.slice(0, 40).forEach((p) => put(p, 2, 0));
    all.slice(40, 45).forEach((p) => put(p, 3, 1));
    const s = G.Study.daily();
    ok("D: 40 due: a session of 30, the most overdue", s && s.cards.length === G.CONFIG.study.dailyMax && s.due === 40);
    ok("D: the lobby counts due today and tomorrow", G.SRS.forecast().today === 40 && G.SRS.forecast().tomorrow === 5);
    // nothing due
    fresh();
    all.slice(0, 7).forEach((p) => put(p, 2, 1));
    const opened = G.Study.openDaily();
    await wait(50);
    ok("D: nothing due: 'All reviewed' and tomorrow's count", !opened && G.Modal.isOpen("dialog") && /Tomorrow: 7/.test($("dialog-text").textContent), $("dialog-text").textContent);
    G.Dialog.close();
    G.Modal.reset();
    // a short session, played
    fresh();
    const cards = all.slice(0, 6);
    cards.forEach((p) => put(p, 1, 0));
    all.slice(6, 10).forEach((p) => put(p, 2, 0));          // 10 due: one session
    G.save.learnSeen = { intro_keys: true, intro_touch: true, intro_pad: true };
    G.Study.openDaily();
    await wait(50);
    const g = G.Game, sess = g.study;
    ok("D: the session starts: Adaptive, on the grounds, one wave", g.mode === "study" && g.learn.adaptive && g.level.waves === 1 && sess.cards.length === 10);
    const due = new Set(sess.cards.map(key));
    const seen = new Set();
    let guard = 0, decoys = 0;
    while (g.state === "GAMEPLAY" && guard++ < 1600) {
      g.update(0.05);
      g.zombies.forEach((z) => { if (z.decoy) decoys++; else seen.add(key(z.pair)); });
      const t = g.targetPair;
      const z = t && g.zombies.find((o) => o.alive && !o.emerge && o.word === t[0] && !o.decoy);
      if (z && guard % 8 === 0) kill(g, z);
      const sz = g.zombies.find((o) => o.alive && !o.emerge && o.answer === "spell");
      if (sz && guard % 8 === 4) g.spellKill(sz, { hints: 0 });
    }
    ok("D: only due words came (no look-alike decoys)", [...seen].every((k) => due.has(k)) && decoys === 0, seen.size + " words");
    ok("D: finished: the results window", g.state === "STUDY_DONE" && G.Modal.isOpen("studyresult") && !$("study-result").classList.contains("hidden"));
    ok("D: no money, no shop, no boss", g.player.money === 0 && G.UI._currentScreen !== "screen-shop" && !G.Bosses.phase && g.player.score > 0);
    ok("D: the review counted the day: streak 1", G.save.learn.daily.streak === 1 && /1 day/.test($("study-result-stats").textContent));
    $("btn-study-lobby").click();
    await wait(50);
    ok("D: back to the lobby, on Daily Review", g.state === "MENU" && G.Lobby.current().id === "review" && !G.Modal.isOpen());
    // the streak over days
    fresh();
    const w1 = all[0], w2 = all[1];
    put(w1, 1, 0);
    day(0); G.SRS.completeDaily(1);
    ok("D: streak: the first day 1", G.SRS.streakNow() === 1);
    day(1); G.SRS.answer(w1, true); put(w2, 3, 7);        // w1 -> box 2, due day 4; w2 due day 7
    G.SRS.completeDaily(1);
    ok("D: the next day: 2", G.save.learn.daily.streak === 2);
    day(4);
    ok("D: days 2 and 3 had nothing due: still 2 on day 4", G.SRS.streakNow() === 2);
    G.SRS.answer(w1, true); G.SRS.completeDaily(1);
    ok("D: ...and 3 after day 4's review", G.save.learn.daily.streak === 3 && G.save.learn.daily.best === 3);
    day(9);
    ok("D: a day with words due skipped (day 7): the streak is broken", G.SRS.streakNow() === 0);
    G.SRS.completeDaily(1);
    ok("D: ...and starts again at 1, the best kept", G.save.learn.daily.streak === 1 && G.save.learn.daily.best === 3);
    day(0);
  }

  // ---------------- E: from the old statistics, and a valid save ----------------
  function migrate() {
    day(0); base = G.Clock.today();
    const stats = { analyse: { correct: 9, wrong: 1 }, benefit: { correct: 7, wrong: 3 }, assess: { correct: 1, wrong: 4 }, empty: { correct: 0, wrong: 0 }, junk: "x" };
    const L = G.Learning.normalize(null, stats);
    ok("E: 90% right -> box 3, 70% -> box 2, 20% -> box 1", L.srs.analyse.b === 3 && L.srs.benefit.b === 2 && L.srs.assess.b === 1);
    ok("E: ...all due today; words never answered are left New", ["analyse", "benefit", "assess"].every((k) => L.srs[k].due === base) && !L.srs.empty && !L.srs.junk);
    const old = JSON.parse(JSON.stringify(G.save)); delete old.learn; old.wordStats = stats;
    const s1 = G.normalizeSave(old);
    ok("E: an old save gets its boxes when loaded (nothing else lost)", s1.learn && s1.learn.srs.analyse.b === 3 && s1.wordStats.analyse.correct === 9);
    const s2 = G.normalizeSave(JSON.parse(JSON.stringify(s1)));
    ok("E: loading it again changes nothing", JSON.stringify(s2.learn) === JSON.stringify(s1.learn));
    const bad = G.Learning.normalize({ srs: { a: { b: 99, due: "x" }, b: { b: 0 }, c: null }, conf: { a: { a: { n: 2 }, b: { n: "3", ok: -1 } } }, daily: { streak: -4, best: 2, days: { x: 3, 5: 2 } } });
    ok("E: bad values are made safe", bad.srs.a.b === 6 && bad.srs.a.due === G.Clock.today() && !bad.srs.b && !bad.srs.c && !bad.conf.a.a && bad.conf.a.b.n === 3 && bad.conf.a.b.ok === 0 && bad.daily.streak === 0 && bad.daily.best === 2 && !bad.daily.days.x && bad.daily.days[5] === 2, JSON.stringify(bad));
    ok("E: a new save has an empty memory", JSON.stringify(G.defaultSave().learn.srs) === "{}");
    const seen = G.normalizeSave(Object.assign(JSON.parse(JSON.stringify(s1)), { learnSeen: { intro_keys: true, intro_pad: "yes", evil: true } })).learnSeen;
    ok("E: the spelling intros seen are kept, nothing else", JSON.stringify(seen) === JSON.stringify({ intro_keys: true }), JSON.stringify(seen));
  }

  // ---------------- F: look-alikes and confused pairs ----------------
  async function distract() {
    fresh(); day(0); base = G.Clock.today();
    const pool = G.getAllBuiltinWords();
    const withConf = G.WordBank.entries().filter((e) => (e.confusables || []).length).slice(0, 6).map((e) => P(e.id));
    withConf.forEach((p) => put(p, 2, 5));
    let good = true, sameThai = false;
    withConf.forEach((p) => {
      const picks = G.Distract.forChoices(p, pool, 3);
      // (a look-alike carries where it came from: confusion, confusable, spelling, topic)
      const first = picks.slice(0, 2);
      if (!first.every((q) => !!q.source) || (picks[0].source !== "confusable" && picks[0].source !== "confusion")) good = false;
      if (picks.some((q) => q[1].trim() === p[1].trim())) sameThai = true;
      out.examples.push(`box 2 "${p[0]}": ` + picks.map((q) => `${q[0]}${q.source ? " (" + q.source + ")" : ""}`).join(", "));
    });
    ok("F: box 2+: the first two wrong choices are look-alikes", good);
    ok("F: never a choice with the target's Thai meaning", !sameThai);
    // a new word gets clearly different ones
    fresh();
    let clean = true;
    withConf.forEach((p) => {
      const sim = new Set(G.Distract.similar(p, false).map(key));
      const picks = G.Distract.forChoices(p, pool, 3);
      if (picks.some((q) => sim.has(key(q)))) clean = false;
      if (withConf.indexOf(p) < 2) out.examples.push(`new "${p[0]}": ` + picks.map((q) => q[0]).join(", "));
    });
    ok("F: a new word: no look-alikes among the choices", clean);
    ok("F: a new word gets no look-alike on the field", G.Distract.forField(withConf[0], { zombies: [], wordPool: pool }) === null);
    put(withConf[0], 2, 5);
    const f = G.Distract.forField(withConf[0], { zombies: [], wordPool: pool });
    ok("F: box 2+: a look-alike comes onto the field", !!f && G.Distract.isSimilar(withConf[0], f.pair), f && f.pair[0]);
    // the order: confused before confusable before spelling
    const Y = withConf[0], X = P("illustrate");
    G.SRS.noteConfusion(Y, X);
    const sim = G.Distract.similar(Y, true);
    ok("F: a pair the player confused comes first", sim[0][0] === X[0] && sim[0].source === "confusion" && sim.findIndex((s) => s.source === "confusable") > 0);
    const order = sim.map((s) => s.source);
    ok("F: then confusables, then near spellings, then the topic", order.join(",") === order.slice().sort((a, b) => ["confusion", "confusable", "spelling", "topic"].indexOf(a) - ["confusion", "confusable", "spelling", "topic"].indexOf(b)).join(","), order.join(","));
    out.examples.push(`"${Y[0]}" after the player shot "${X[0]}" for it: ` + sim.slice(0, 4).map((s) => `${s[0]} (${s.source})`).join(", "));
    // the Word Log line
    G.UI.renderVocabLog(Y.id && G.WordBank.byId(Y.id).level);
    const item = [...document.querySelectorAll("#vocablog-content .vocab-item")].find((el) => el.querySelector(".vw-en").textContent.trim().startsWith(Y[0]));
    ok("F: the Word Log: 'You often confuse this with: X' and what X means", item && /You often confuse this with:/.test(item.textContent) && item.textContent.includes(X[0]) && item.textContent.includes(X[1]), item && item.querySelector(".vw-conf") && item.querySelector(".vw-conf").textContent);
    ok("F: ...and the word's box and next review", item && /Memory box 2\/5 · Review due in 5 days/.test(item.textContent));
    // let go after three right answers in a row with X there
    G.SRS.noteAnswer(Y, true, [X]); G.SRS.noteAnswer(Y, true, []);
    ok("F: a right answer without X in view does not count", G.save.learn.conf[key(Y)][key(X)].ok === 1);
    G.SRS.noteAnswer(Y, false, [X]);
    ok("F: a wrong one starts the count again", G.save.learn.conf[key(Y)][key(X)].ok === 0);
    G.SRS.noteAnswer(Y, true, [X]); G.SRS.noteAnswer(Y, true, [X]); G.SRS.noteAnswer(Y, true, [X]);
    ok("F: three right in a row with X there: the pair is let go", G.SRS.confusedWith(Y).length === 0 && G.Distract.similar(Y)[0].source !== "confusion");
    // a typed word of the bank is a confusion too
    fresh(); put(Y, 3, 0);
    G.Learning.answerWord(Y, false, { typed: X[0] });
    ok("F: typing another bank word for it notes the pair", G.SRS.confusionCount(Y, X) === 1);
    G.Learning.answerWord(Y, false, { typed: "qqqq" });
    ok("F: a typing slip does not", G.SRS.confusedWith(Y).length === 1);
  }

  // ---------------- G: spelling ----------------
  async function spelling() {
    const S = G.Spell;
    const an = P("analyse");
    ok("G: every accepted spelling, any case, spaces trimmed", S.isRight("analyse", an) && S.isRight("  ANALYZE ", an) && !S.isRight("analise", an));
    ok("G: two-word and hyphenated words", S.isRight("Per Cent", P("percent")));
    const mk = S.markup("acomodation", "accommodation").map((m) => m.cls[0]).join("");
    ok("G: marks: right place green, a missing letter grey", /m/.test(mk) && !/b/.test(mk) && mk.replace(/m/g, "").length === 11, mk);
    const mk2 = S.markup("recieve", "receive").map((m) => m.cls[0]).join("");
    ok("G: ...a wrong letter red", /b/.test(mk2), mk2);
    const tip = S.tipFor("accomodate", P("accommodate"));
    ok("G: a well-known misspelling gets its own note", tip === "Common IELTS mistake: accommodate has double m", tip);
    ok("G: ...other slips no note", S.tipFor("acommodate", P("accommodate")) === "");
    // the pad, tiles
    const div = document.createElement("div"); div.style.width = "320px"; document.body.appendChild(div);
    let got = null;
    try {
      const pad = new G.SpellPad(div, { mode: "tiles", onSubmit: (t) => { got = t; } });
      pad.setWord(an, an[1]);
      const n = pad.tiles.length - 7;
      ok("G: tiles: the word's letters and 2-3 more", n >= 2 && n <= 3 && "analyse".split("").every((c) => pad.tiles.filter((t) => t.ch === c).length >= "analyse".split("").filter((x) => x === c).length));
      ok("G: dashes for every letter from the start", div.querySelectorAll(".sp-slot").length === 7 && div.querySelectorAll(".sp-slot.filled").length === 0);
      const place = (c) => pad.place(pad.tiles.findIndex((t) => !t.used && t.ch === c));
      place("a"); place("n"); place("a");
      pad.unplace(1);
      ok("G: tapping a placed letter takes it (and those after) back", pad.placed.length === 1);
      pad.hint();
      ok("G: a hint puts in the next right letter", pad.text() === "an" && pad.hints === 1);
      "alyse".split("").forEach(place);
      ok("G: the last letter in: it answers by itself", got === "analyse");
    } catch (e) { ok("G: pad", false, e.message); }
    div.remove();

    // in play, on a keyboard
    fresh(); day(0); base = G.Clock.today();
    G.save.learnSeen = { intro_keys: true, intro_touch: true, intro_pad: true };
    G.Input.mode = "desktop"; G.Input.padActive = false;
    G.Study.launch(G.Study.learn("spelling", 1));
    const g = G.Game;
    g.player.hp = g.player.maxHp = 1e6;
    clear(g);
    const A = P("migrate"), B = P("festival");
    const za = add(g, A, "spell"), zb = add(g, B, "spell");
    G.Spell.setFocus(za);
    ok("G: a spelling zombie shows its Thai clue, not the word", za.labelText === A[1] && za.clue === A[1]);
    const keyDown = (k, code) => G.onKeyDown({ key: k, code: code || ("Key" + k.toUpperCase()), preventDefault() {} });
    const p0 = g.yawObject.position.clone();
    G.Input.keys.KeyW = true; for (let i = 0; i < 6; i++) g.update(0.05); G.Input.keys.KeyW = false;
    ok("G: WASD do not walk while typing", g.yawObject.position.distanceTo(p0) < 0.01);
    G.Input.keys.ArrowUp = true; for (let i = 0; i < 6; i++) g.update(0.05); G.Input.keys.ArrowUp = false;
    ok("G: the arrow keys walk", g.yawObject.position.distanceTo(p0) > 0.2);
    "wasd".split("").forEach((c) => keyDown(c));
    ok("G: letters go into the bar", G.Spell.pad.text() === "wasd");
    // the longest word in the bank fits the bar
    const long = G.WordBank.entries().map((e) => e.headword).sort((a, b) => b.length - a.length)[0];
    const fits = () => { const s = document.querySelector("#hud-spell .spad-slots"); return s.scrollWidth <= s.clientWidth + 1 && $("hud-spell").getBoundingClientRect().right <= innerWidth; };
    G.Spell.pad.setWord([long, "x"], "x", true);
    ok("G: the longest word (" + long + ", " + long.length + " letters) fits the typing bar", fits(), innerWidth + "px");
    G.Spell.pad.setWord(za.pair, za.clue, true);
    G.Spell.pad.clear();
    // Enter fires at any zombie carrying the word, not only the one in focus
    B[0].split("").forEach((c) => keyDown(c));
    keyDown("Enter", "Enter");
    ok("G: Enter: the zombie with that word is shot (not the one in focus)", !zb.alive && za.alive && G.Spell.pad.text() === "");
    // a near miss: within two letters -> a misspelling of that word
    "migrat".split("").forEach((c) => keyDown(c));
    keyDown("Enter", "Enter");
    ok("G: two letters or fewer off: a misspelling of it, marked, the right word shown", za._spellWrong && G.Spell.pad.feedback && /Correct spelling: migrate/.test($("hud-spell").textContent));
    G.Spell.pad.clearFeedback();
    "zzzqq".split("").forEach((c) => keyDown(c));
    keyDown("Enter", "Enter");
    ok("G: anything else: a plain miss", /No zombie here carries/.test($("hud-spell").textContent) && za.alive);
    // speed (D5)
    const zn = g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(9, -1.7, 0)));
    const plain = new G.Zombie("normal", new THREE.Vector3(), A, g.level.theme);
    ok("G: spelling zombies walk slower", zn.answer === "spell" && Math.abs(zn.speed / (plain.speed * G.CONFIG.study.speed) - G.CONFIG.spell.zombieSpeed) < 0.01, (zn.speed / plain.speed).toFixed(2));
    // touch
    G.Input.mode = "touch";
    g.update(0.05);
    G.Spell.pad.setWord([long, "x"], "x");
    ok("G: ...and the tiles", fits());
    G.Spell.pad.setWord(za.pair, za.clue);
    ok("G: touch: the letters to tap, fire / aim / reload hidden", G.Spell.pad.mode === "tiles" && document.querySelectorAll("#hud-spell .sp-tile").length > 0 && document.body.classList.contains("spell-only") && getComputedStyle($("touch-fire")).display === "none");
    // controller
    G.Input.mode = "desktop"; G.Input.padActive = true;
    g.update(0.05);
    const pad = G.Spell.pad, word = pad.answer.toLowerCase();
    const gp = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    const B_ = G.Pad.B;
    let edges = [];
    const press = (b) => { edges = [b]; G.Spell.padInput(gp, [], (i) => edges.includes(i), 0.016); edges = []; };
    const target = pad.tiles.findIndex((t) => !t.used && t.ch === word[0]);
    while (pad.cursor !== target) press(B_.RIGHT);
    press(B_.A);
    ok("G: controller: D-pad to a letter, A places it", pad.text() === word[0]);
    press(B_.B);
    ok("G: ...B takes it back", pad.text() === "");
    press(B_.X);
    ok("G: ...X a hint", pad.text() === word[0] && G.Spell.focus._hints === 1);
    G.Input.padActive = false;
    g.quitToMainMenu();
  }

  // ---------------- H: Spell to Reload ----------------
  function reload() {
    fresh(); day(0); base = G.Clock.today();
    G.Input.mode = "desktop"; G.Input.padActive = false;
    G.save.settings.spellReload = false;
    const g = freshRun(1);
    const a = g.player.ammo.pistol, mag = G.WEAPON_DEFS.pistol.magSize;
    a.mag = 2; g.reload();
    ok("H: off: an ordinary reload", g.player.reloading && !G.Modal.isOpen("spellreload"));
    g.cancelReload();
    G.save.settings.spellReload = true;
    g.reload();
    ok("H: on: a word first, in a window (G.Modal), the Thai clue shown", G.Modal.isOpen("spellreload") && !$("spell-reload").classList.contains("hidden") && $("spell-reload-pad").querySelector(".spad-clue").textContent === G.SpellReload.pair[1]);
    ok("H: the word is one of this wave's", g.waveWords.length === 0 || g.waveWords.some((p) => key(p) === key(G.SpellReload.pair)) || g.wordPool.some((p) => key(p) === key(G.SpellReload.pair)));
    const p0 = g.yawObject.position.clone();
    G.Input.keys.KeyW = true; G.Input.keys.ArrowUp = true;
    for (let i = 0; i < 6; i++) g.update(0.05);
    G.Input.keys.KeyW = false; G.Input.keys.ArrowUp = false;
    ok("H: the player stands still while spelling", g.yawObject.position.distanceTo(p0) < 0.01);
    const w = G.SpellReload.pair;
    w[0].split("").forEach((c) => G.onKeyDown({ key: c, code: "Key" + c.toUpperCase(), preventDefault() {} }));
    G.onKeyDown({ key: "Enter", code: "Enter", preventDefault() {} });
    ok("H: right: a full magazine, the window gone", a.mag === mag && !G.Modal.isOpen("spellreload"));
    ok("H: ...a recall answer on the word", G.SRS.box(w) === 1);
    a.mag = 1; g.reload();
    const w2 = G.SpellReload.pair;
    "qqq".split("").forEach((c) => G.onKeyDown({ key: c, code: "KeyQ", preventDefault() {} }));
    G.onKeyDown({ key: "Enter", code: "Enter", preventDefault() {} });
    ok("H: wrong: the right word shown", /Correct spelling:/.test($("spell-reload-pad").textContent) && $("spell-reload-pad").textContent.includes(w2[0]));
    G.onKeyDown({ key: "Enter", code: "Enter", preventDefault() {} });
    ok("H: ...then half a magazine", a.mag === Math.ceil(mag * G.CONFIG.spell.reloadWrongShare) && !G.Modal.isOpen("spellreload"));
    ok("H: the controller works in it (its box is the pad's scope)", (() => { g.reload(); const r = G.Pad.scope() === $("spell-reload-box"); G.SpellReload.finish(); return r; })());
    G.save.settings.spellReload = false;
    g.quitToMainMenu();
  }

  // ---------------- I: windows, lobby, settings, strings ----------------
  async function ui() {
    fresh(); day(0);
    G.Lobby.open({ tab: "training", select: "review" });
    await wait(100);
    const ids = G.Lobby.modes("training").map((m) => m.id);
    ok("I: the Training tab has Daily Review and Learning Modes", ids[0] === "review" && ids[1] === "learn");
    ok("I: the Daily Review card: its count", /All reviewed|due today/.test(document.querySelector('.lcard[data-id="review"] .lcard-meta').textContent));
    G.Lobby.select(1); G.Lobby.launch();
    await wait(50);
    ok("I: Learning Modes: a G.Modal window, the controller's scope", G.Modal.isOpen("learnpick") && G.Pad.scope() === $("learn-box"));
    ok("I: the modes on offer: Classic, Spelling, Adaptive (the rest come in round 3)", [...document.querySelectorAll("#learn-modes .learn-opt")].map((b) => b.dataset.preset).join() === "classic,spelling,adaptive");
    document.querySelector('#learn-modes [data-preset="adaptive"]').click();
    ok("I: picking a mode marks it", document.querySelector('#learn-modes [data-preset="adaptive"]').classList.contains("on"));
    G.onKeyDown({ key: "Escape", code: "Escape", preventDefault() {} });
    ok("I: Escape closes it", !G.Modal.isOpen("learnpick") && $("learn-pick").classList.contains("hidden"));
    // the first spelling session on a device: the intro
    G.save.learnSeen = {};
    G.Input.mode = "desktop"; G.Input.padActive = false;
    G.Study._pick = { preset: "spelling", level: 1 };
    G.Study.openPicker(); $("btn-learn-start").click();
    await wait(50);
    ok("I: the first spelling session: how it works, for the keyboard", G.Modal.isOpen("studyintro") && /arrow keys/.test($("study-intro-text").textContent) && G.Pad.scope() === $("study-intro-box"));
    $("btn-intro-start").click();
    await wait(50);
    ok("I: ...then the session", G.Game.mode === "study" && G.Game.state === "GAMEPLAY" && !!G.save.learnSeen.intro_keys);
    ok("I: the spelling bar: bottom centre, not over the HUD panels", (() => {
      const r = $("hud-spell").getBoundingClientRect(), l = document.querySelector(".hud-left").getBoundingClientRect(), rr = document.querySelector(".hud-right").getBoundingClientRect();
      const over = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 4 && !over(r, l) && !over(r, rr);
    })());
    ok("I: the key help under the bar", /Arrow keys walk/.test($("hud-spell-keys").textContent));
    G.Game.quitToMainMenu();
    // Settings
    G.UI.renderSettings();
    ok("I: Settings: Spell to Reload (off by default)", !!$("set-spellreload") && $("set-spellreload").checked === !!G.save.settings.spellReload && G.defaultSave().settings.spellReload === false);
    $("set-spellreload").checked = true; $("set-spellreload").dispatchEvent(new Event("change"));
    ok("I: ...and it saves", G.save.settings.spellReload === true);
    G.save.settings.spellReload = false;
    ok("I: How to Play explains the boxes and spelling", /memory box/i.test(G.T("howto.body")) && /arrow keys/.test(G.T("howto.body")));
    const missing = Object.keys(G._missingKeys || {});
    ok("I: no missing strings", missing.length === 0, missing.join());
  }

  async function run() {
    results.length = 0; out.log = []; out.examples = [];
    const backup = JSON.stringify(G.save);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    const realLock = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    const mode = G.Input.mode;
    try {
      boxes();
      play();
      waves();
      await daily();
      migrate();
      await distract();
      await spelling();
      reload();
      await ui();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock;
      G.Input.mode = mode; G.Input.padActive = false;
      G.Clock.offsetDays = 0;
      G.Modal.reset();
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), log: out.log, examples: out.examples, pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
