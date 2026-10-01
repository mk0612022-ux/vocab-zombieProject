// Dev-only (not shipped). Vocabulary series, round 4: the Progress page,
// Practice Mode, the learning modes of the player's own, the campaign's
// Learning Style, the learning leaderboards and achievements, saves -- and a
// thirty-day simulation of a player on a simulated calendar (G.Clock).
//   A  saves: an old save, a round-3 save, export / import, bad values
//   B  thirty days: Daily Review every day but three, a learning session a
//      day; every box move checked against the rules, the streak against
//      the days played and missed, what is due and when
//   C  the Progress page: its numbers and what it draws, words, tabs, keys
//   D  Practice Mode: the filters, every way of asking, answers, the end
//   E  Learning Modes: a pairing of the player's own, a topic's words
//   F  the campaign's Learning Style window, and the campaign in each style
//   G  the learning achievements
//   H  the leaderboards of the modes; the lobby; the intros
// Load it into the game:
//   const r = await G.Round14Test.run();   r.fail -> [] when everything passes
//   r.sim: the thirty days, a row a day (G.Round14Test.table(r.sim) prints it)
// The save is put back afterwards (and the simulated date).
window.G = window.G || {};
G.Round14Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const P = (id) => { const e = G.WordBank.byId(id); const p = [e.headword, e.thai]; p.id = e.id; return p; };
  const key = (p) => G.wordKey(p);
  const fresh = () => { G.save.learn = G.Learning.normalize({}); G.save.wordStats = {}; G.save.achievements = {}; G.save.leaderboards = G.defaultSave().leaderboards; };
  const put = (p, b, due) => { G.save.learn.srs[key(p)] = { b, due: G.Clock.today() + (due || 0), last: 0, n: 1, lapses: 0 }; };
  const SEEN = () => ({ intro_keys: true, intro_touch: true, intro_pad: true, mode_paraphrase: true, mode_listening: true, mode_dictation: true, mode_context: true, mode_adaptive: true, mode_listenword: true, mode_defspell: true, mode_clozespell: true });
  const press = (code, k, extra) => G.onKeyDown(Object.assign({ code, key: k || "", preventDefault() {}, stopImmediatePropagation() {} }, extra || {}));
  // a key press the page's own window listeners see (Progress, Practice setup)
  const winKey = (code) => window.dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true }));
  // a repeatable random
  const lcg = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = { sim: [], balance: null };

  // ---------------- A: saves ----------------
  async function saves() {
    // a save from before the vocabulary series: word stats only
    const old = { unlockedLevels: [1, 2], wordStats: { analyse: { correct: 9, wrong: 1, lastCorrect: 1 }, benefit: { correct: 1, wrong: 3 } }, achievements: { first_boss: true }, settings: { musicVolume: 0.3 }, leaderboards: { level1: [{ score: 500, date: "2025-01-01", meta: "" }] } };
    const s = G.normalizeSave(JSON.parse(JSON.stringify(old)));
    ok("A an old save loads: its word stats kept", s.wordStats.analyse.correct === 9 && s.wordStats.benefit.wrong === 3);
    ok("A ...its words start in boxes by their accuracy", s.learn.srs.analyse.b === 3 && s.learn.srs.benefit.b === 1);
    ok("A ...and the round-4 learning data is there, empty", G.Learning.SKILLS.every((k) => s.learn.skills[k].r === 0 && s.learn.skills[k].w === 0) && Object.keys(s.learn.activity).length === 0 && s.learn.spellRun === 0);
    ok("A ...its scores, achievements, settings kept; campaign style Adaptive", s.leaderboards.level1[0].score === 500 && s.achievements.first_boss && s.settings.musicVolume === 0.3 && s.settings.campaignStyle === "adaptive");
    // a round-3 save: boxes, no skills or activity yet
    const r3 = JSON.parse(JSON.stringify(G.save));
    r3.learn = { v: 1, srs: { analyse: { b: 4, due: 100, last: 90, n: 5, lapses: 1 } }, conf: { analyse: { analysis: { n: 2, ok: 1, off: false } } }, daily: { streak: 3, best: 5, last: 99, nextDue: 100, days: { 99: 12 } } };
    delete r3.settings.campaignStyle;
    const s3 = G.normalizeSave(r3);
    ok("A a round-3 save: its boxes, confused pairs and streak kept", s3.learn.srs.analyse.b === 4 && s3.learn.srs.analyse.due === 100 && s3.learn.conf.analyse.analysis.n === 2 && s3.learn.daily.best === 5 && s3.learn.daily.days[99] === 12);
    ok("A ...with skills and activity added", s3.learn.skills.spelling.r === 0 && typeof s3.learn.activity === "object" && s3.settings.campaignStyle === "adaptive");
    // bad values
    const bad = JSON.parse(JSON.stringify(G.save));
    bad.settings.campaignStyle = "custom:smell+shoot";
    bad.learn = { srs: {}, skills: { spelling: { r: "12", w: -4 }, bogus: { r: 9 } }, activity: { 20000: 7, x: 3, 20001: -2 }, spellRun: "x" };
    bad.leaderboards = { level1: [{ score: 10, date: "d" }, null, { date: "no score" }], "bad key!": [], review: "nope", mode_custom: [{ score: 70, date: "d", mode: "custom:audio+spell" }] };
    const sb = G.normalizeSave(bad);
    ok("A bad values: an unknown campaign style is Adaptive", sb.settings.campaignStyle === "adaptive");
    ok("A ...skills made numbers, unknown ones dropped", sb.learn.skills.spelling.r === 12 && sb.learn.skills.spelling.w === 0 && !sb.learn.skills.bogus && sb.learn.spellRun === 0);
    ok("A ...activity: day numbers with counts only", sb.learn.activity[20000] === 7 && !("x" in sb.learn.activity) && !("20001" in sb.learn.activity));
    ok("A ...leaderboards: lists of entries with a score; the modes' boards kept", sb.leaderboards.level1.length === 1 && !("bad key!" in sb.leaderboards) && !("review" in sb.leaderboards) && sb.leaderboards.mode_custom[0].score === 70 && Array.isArray(sb.leaderboards.daily));
    const good = JSON.parse(JSON.stringify(G.save)); good.settings.campaignStyle = "custom:definition+spell";
    ok("A ...a pairing of the player's own is kept", G.normalizeSave(good).settings.campaignStyle === "custom:definition+spell");
    // export / import keeps every piece of learning data
    fresh();
    put(P("analyse"), 4, 2); put(P("benefit"), 1, 0);
    G.Learning.answerWord(P("benefit"), true, { recall: false, skills: ["recognition"] });
    G.Learning.answerWord(P("indicate"), false, { recall: true, skills: ["spelling", "listening"], typed: "indicat" });
    G.SRS.noteConfusion(P("affect"), P("effect"));
    G.SRS.completeDaily(3);
    G.save.learnSeen = { intro_keys: true, mode_dictation: true };
    G.save.settings.campaignStyle = "custom:audio+shoot";
    G.save.leaderboards.mode_dictation = [{ score: 321, date: "2026-01-01", meta: "", words: 8, mode: "dictation" }];
    const payload = { format: G.SAVE_FORMAT, version: G.SAVE_FORMAT_VERSION, exportedAt: "x", summary: G.saveSummary(G.save), save: G.save };
    const res = await new Promise((r) => G.readSaveFile(new File([JSON.stringify(payload)], "save.json", { type: "application/json" }), (err, x) => r(err ? { err } : x)));
    const L0 = G.save.learn, L1 = res.save && res.save.learn;
    ok("A export -> import: boxes, confused pairs, streak", !!L1 && JSON.stringify(L1.srs) === JSON.stringify(L0.srs) && JSON.stringify(L1.conf) === JSON.stringify(L0.conf) && JSON.stringify(L1.daily) === JSON.stringify(L0.daily), res.err && res.err.message);
    ok("A ...skills, activity, the spelling run", !!L1 && JSON.stringify(L1.skills) === JSON.stringify(L0.skills) && JSON.stringify(L1.activity) === JSON.stringify(L0.activity) && L1.spellRun === L0.spellRun);
    ok("A ...the intros seen, the campaign style, the modes' leaderboards", !!res.save && res.save.learnSeen.mode_dictation && res.save.settings.campaignStyle === "custom:audio+shoot" && res.save.leaderboards.mode_dictation[0].score === 321);
    ok("A ...the word stats", !!res.save && JSON.stringify(res.save.wordStats) === JSON.stringify(G.save.wordStats));
  }

  // ---------------- B: thirty days ----------------
  // A player who does the Daily Review on 27 of 30 days and one Adaptive
  // learning session (level 1's words) each of those days; right 75% of the
  // time on a new word, 82% in boxes 1-2, 90% higher. Days 9-10 are missed
  // with words due (the streak starts again); day 23 is missed too.
  async function sim30(o) {
    o = o || {};
    fresh();
    const rnd = lcg(14);
    const skip = new Set(o.skip || [9, 10, 23]);
    const I = G.CONFIG.srs.intervals;
    const rows = [];
    let bad = [], played = [], expStreak = 0, lastPlayed = null, missedDue = false;
    const answer = (p, row, today) => {
      const before = G.SRS.state(p) ? Object.assign({}, G.SRS.state(p)) : null;
      const way = G.Learn.adaptiveFor(p);
      const recall = G.Learn.isRecall(way.clue, way.answer);
      const b = before ? before.b : 0;
      const right = rnd() < (b === 0 ? 0.75 : b <= 2 ? 0.82 : 0.9);
      const r = G.Learning.answerWord(p, right, { recall, skills: G.Learning.skillsFor(way.clue, way.answer) });
      const st = G.SRS.state(p);
      let want;
      if (!right) want = { b: 1, due: today + I[0] };
      else if (!before) want = { b: 1, due: today + I[0] };
      else if (before.due > today) want = { b: before.b, due: before.due };
      else { const to = recall ? Math.min(6, b + 1) : (b + 1 <= G.CONFIG.srs.recognitionMaxBox ? b + 1 : b); want = { b: to, due: today + G.SRS.interval(to) }; }
      if (!st || st.b !== want.b || st.due !== want.due) bad.push(key(p) + ": box " + b + (right ? " right" : " wrong") + (recall ? " recall" : "") + " -> " + (st && st.b) + "/" + (st && st.due - today) + "d, want " + want.b + "/" + (want.due - today) + "d");
      if (row) { row[right ? "right" : "wrong"]++; row[way.answer === "spell" ? "spelt" : "shot"]++; }
      return { right, r };
    };
    for (let d = 1; d <= 30; d++) {
      G.Clock.offsetDays = d - 1;
      const today = G.Clock.today();
      const dueStart = G.SRS.dueToday().length;
      const row = { day: d, date: new Date(G.Clock.now()).toISOString().slice(5, 10), dueStart, reviewed: 0, right: 0, wrong: 0, shot: 0, spelt: 0, sessions: 0, learnt: 0 };
      if (skip.has(d)) {
        row.skipped = true;
        if (dueStart > 0) missedDue = true;
      } else {
        // Daily Review: every session there is (more than 30 due: Continue)
        let s, guard = 0;
        while ((s = G.Study.daily()) && guard++ < 10) {
          row.sessions++;
          s.cards.forEach((p) => { const a = answer(p, row, today); row.reviewed++; s.answered++; if (a.right) s.right++; else s.retry = (s.retry || []).concat([p]); });
          // a word missed comes back once at the end of the session
          (s.retry || []).forEach((p) => answer(p, null, today));
          G.SRS.completeDaily(s.answered, today);
        }
        if (G.SRS.dueToday().length) bad.push("day " + d + ": still " + G.SRS.dueToday().length + " due after the review");
        // one learning session: Adaptive, the School's words
        const L = G.Study.learn("adaptive", { level: 1 });
        L.cards.forEach((p) => { if (!G.SRS.state(p)) row.learnt++; answer(p, null, today); });
        // the streak as it should be: a day counts once a review is done (a
        // day with nothing due has no review -- it neither counts nor breaks
        // it); a day missed with words due breaks it
        if (row.sessions) {
          expStreak = lastPlayed != null && !missedDue ? expStreak + 1 : 1;
          missedDue = false; lastPlayed = d;
        }
        played.push(d);
      }
      const S = G.save.learn.srs, box = [0, 0, 0, 0, 0, 0, 0];
      Object.keys(S).forEach((k) => { box[S[k].b]++; });
      const f = G.SRS.forecast();
      Object.assign(row, { b1: box[1], b2: box[2], b3: box[3], b4: box[4], b5: box[5], M: box[6], met: Object.keys(S).length,
        streak: G.SRS.streakNow(), best: G.save.learn.daily.best, expStreak: row.skipped ? null : expStreak, tomorrow: f.tomorrow, week: f.week, activity: G.save.learn.activity[today] || 0 });
      // overdue words: none, on a day played
      if (!row.skipped && Object.keys(S).some((k) => S[k].due <= today)) bad.push("day " + d + ": a word is still due");
      rows.push(row);
    }
    out.sim = rows;
    if (o.keep) return rows;
    ok("B 30 days: every box move and next review follows the rules (" + rows.reduce((a, r) => a + r.right + r.wrong, 0) + " review answers)", bad.length === 0, bad.slice(0, 6).join(" | "));
    const playedRows = rows.filter((r) => !r.skipped);
    ok("B ...after each day's review nothing is left due (" + playedRows.length + " days played)", playedRows.every((r) => r.dueStart === 0 || r.reviewed >= r.dueStart));
    ok("B ...the streak: one more each day reviewed, back to 1 after days missed with words due", playedRows.every((r) => r.streak === r.expStreak), playedRows.map((r) => r.day + ":" + r.streak + "/" + r.expStreak).join(" "));
    const r8 = rows[7], r11 = rows[10], r30 = rows[29];
    ok("B ...day 1 has nothing due yet (no review); days 2-8: 7 in a row; days 9-10 missed: day 11 starts at 1", rows[0].dueStart === 0 && rows[0].streak === 0 && r8.streak === 7 && rows[8].dueStart > 0 && r11.streak === 1, [rows[0].dueStart, r8.streak, rows[8].dueStart, r11.streak].join());
    ok("B ...the best streak is kept (" + r30.best + ")", r30.best === Math.max(...playedRows.map((r) => r.expStreak)) && r30.best >= 12);
    ok("B ...a missed day: the streak holds that day (it can still be done), is broken the next", rows[8].streak === 7 && rows[9].streak === 0 && rows[22].streak === 12, [rows[8].streak, rows[9].streak, rows[22].streak].join());
    ok("B ...7-Day Streak unlocked on the way", !!G.save.achievements.review_streak7);
    ok("B ...the day's activity is the day's answers", playedRows.every((r) => r.activity >= r.reviewed + r.learnt) && rows.filter((r) => r.skipped).every((r) => r.activity === 0));
    ok("B ...words climb the boxes: by day 30 some in box 4 and 5 (spelt and recalled)", r30.b4 > 0 && r30.b5 > 0, JSON.stringify([r30.b1, r30.b2, r30.b3, r30.b4, r30.b5, r30.M]));
    ok("B ...none Mastered yet: that takes 1+3+7+14+30 days at least", r30.M === 0);
    ok("B ...the review load stays a session or two a day (at most " + Math.max(...rows.map((r) => r.dueStart)) + " due)", playedRows.every((r) => r.sessions <= 2));
    // the forecast agrees with the boxes
    const t = G.Clock.today(), S = G.save.learn.srs;
    const tomorrow = Object.keys(S).filter((k) => S[k].due === t + 1).length, week = Object.keys(S).filter((k) => S[k].due > t && S[k].due <= t + 7).length;
    ok("B ...due tomorrow and this week as the boxes say (" + tomorrow + ", " + week + ")", r30.tomorrow === tomorrow && r30.week === week);
    // a missed day with nothing due does not break the streak
    fresh(); G.Clock.offsetDays = 0;
    put(P("analyse"), 2, 3);
    G.SRS.completeDaily(1);
    G.Clock.offsetDays = 3;
    ok("B a day missed with nothing due keeps the streak", G.SRS.streakNow() === 1 && G.SRS.completeDaily(1) === 2);
    G.Clock.offsetDays = 0;
    // the review session's length (a balance check: K)
    const rv = playedRows.map((r) => r.reviewed), avg = rv.reduce((a, x) => a + x, 0) / rv.length;
    const spellShare = playedRows.reduce((a, r) => a + r.spelt, 0) / Math.max(1, playedRows.reduce((a, r) => a + r.shot + r.spelt, 0));
    out.balance = { avgReviewed: +avg.toFixed(1), maxReviewed: Math.max(...rv), spellShare: +spellShare.toFixed(2) };
    return rows;
  }
  // the simulation as a text table
  function table(rows) {
    const cols = ["day", "date", "dueStart", "reviewed", "right", "wrong", "shot", "spelt", "learnt", "b1", "b2", "b3", "b4", "b5", "M", "streak", "best", "tomorrow", "week"];
    return [cols.join("\t")].concat(rows.map((r) => r.skipped ? [r.day, r.date, r.dueStart, "-- missed --", "", "", "", "", "", r.b1, r.b2, r.b3, r.b4, r.b5, r.M, r.streak, r.best, r.tomorrow, r.week].join("\t") : cols.map((c) => r[c]).join("\t"))).join("\n");
  }

  // ---------------- C: the Progress page ----------------
  async function progress() {
    fresh(); G.Clock.offsetDays = 0;
    // (words of the Bunker: none of them in AWL sublist 1, set below)
    const words = G.WordBank.entries(3).filter((e) => e.awlSublist !== 1).slice(0, 40).map((e) => P(e.id));
    words.slice(0, 5).forEach((p) => put(p, 1, 1));
    words.slice(5, 9).forEach((p) => put(p, 3, 0));          // due today
    words.slice(9, 12).forEach((p) => put(p, 4, 5));
    words.slice(12, 14).forEach((p) => put(p, 6, 50));
    const sub1 = G.WordBank.entries().filter((e) => e.source === "AWL" && e.awlSublist === 1);
    sub1.slice(0, 6).forEach((e) => put(P(e.id), 6, 40));
    words.slice(20, 32).forEach((p, i) => { G.save.wordStats[key(p)] = { correct: 2, wrong: i + 1, lastCorrect: 0 }; });
    G.save.learn.skills.spelling = { r: 30, w: 10 };
    G.save.learn.skills.listening = { r: 0, w: 0 };
    const today = G.Clock.today();
    G.save.learn.activity[today] = 12; G.save.learn.activity[today - 3] = 40;
    const d = G.Progress.data(), o = d.overview;
    const S = G.save.learn.srs, met = Object.keys(S);
    ok("C overview: New / Learning (1-3) / Review (4-5) / Mastered add up to every word", o.fresh + o.learning + o.review + o.mastered === o.total && o.total === G.SRS.pool().length);
    ok("C ...each counted by its box", o.learning === met.filter((k) => S[k].b <= 3).length && o.review === 3 && o.mastered === 8 && o.due === 4, JSON.stringify(o));
    ok("C AWL: 570 word families, 10 sublists (60 x 9 + 30)", d.awl.total === 570 && d.awl.subs.length === 10 && d.awl.subs[9].total === 30 && d.awl.subs.slice(0, 9).every((s) => s.total === 60));
    ok("C ...Mastered counted by sublist", d.awl.subs[0].mastered === met.filter((k) => S[k].b === 6 && G.WordBank.byId(k).awlSublist === 1 && G.WordBank.byId(k).source === "AWL").length && d.awl.mastered === d.awl.subs.reduce((a, s) => a + s.mastered, 0));
    const topic = G.WordBank.byId(key(words[20])).topic, tr = d.topics.find((t) => t.topic === topic);
    ok("C accuracy by topic from the words' statistics", tr && tr.w >= 1 && tr.r >= 2 && d.topics.length === 12);
    ok("C accuracy by skill: the five", d.skills.map((s) => s.skill).join() === "recognition,spelling,listening,paraphrase,context" && d.skills[1].r === 30 && d.skills[1].w === 10);
    ok("C missed most: ten, the most missed first", d.missed.length === 10 && d.missed[0].wrong === 12 && d.missed.every((m, i) => !i || d.missed[i - 1].wrong >= m.wrong));
    ok("C the last 30 days, today last", d.days.length === 30 && d.days[29].day === today && d.days[29].n === 12 && d.days[26].n === 40);
    ok("C coming up: tomorrow, this week, day by day", d.forecast.tomorrow === 5 && d.forecast.next[0].n === 5 && d.forecast.week === d.forecast.next.reduce((a, x) => a + x.n, 0) && d.forecast.next[4].n === 3);
    // the page
    G.UI.goToMainMenu({ tab: "campaign" });
    await wait(60);
    const icons = Array.from(document.querySelectorAll(".lobby-icon")).map((b) => b.dataset.icon);
    const pi = document.querySelector('.lobby-icon[data-icon="progress"]');
    ok("C the lobby: Progress, first icon top right, its short name and full name", icons[0] === "progress" && pi.querySelector(".li-label").textContent === "Progress" && pi.dataset.tip === "Learning Progress");
    pi.click();
    await wait(80);
    ok("C ...opens the page", G.UI._currentScreen === "screen-progress" && G.Progress.tab === "learn");
    const body = $("progress-body");
    const tiles = Array.from(body.querySelectorAll(".pg-overview .pg-tile b")).map((b) => +b.textContent);
    ok("C the tiles: New, Learning, Review, Mastered, due today", tiles.join() === [o.fresh, o.learning, o.review, o.mastered, o.due].join(), tiles.join());
    ok("C AWL line", body.querySelector(".pg-awl .pg-big").textContent === "Mastered " + d.awl.mastered + " of 570 AWL word families (" + Math.round(d.awl.mastered / 570 * 100) + "%)");
    ok("C charts drawn as SVG: a bar per sublist, topic and skill; a column per day; 7 in the forecast", body.querySelectorAll(".pg-awl .pg-rows svg").length === 10 && body.querySelectorAll(".pg-topics svg").length === 12 && body.querySelectorAll(".pg-skills svg").length === 5 && body.querySelectorAll(".pg-activity rect.pg-col").length === 30 && body.querySelectorAll(".pg-fchart rect.pg-col").length === 7);
    ok("C a skill never practised shows –, not 0%", body.querySelectorAll(".pg-skills .pg-rv")[2].textContent.trim().startsWith("–"));
    ok("C learning and game progress apart: no scores or guns on the Learning tab", !/High score|Guns|Bosses/.test(body.textContent));
    // a word opens its card
    const wb = body.querySelector(".pg-missed .pg-word");
    wb.click();
    await wait(30);
    ok("C a word opens its vocabulary card", G.Modal.isOpen("vocabcard") && $("vocab-card-body").textContent.includes(d.missed[0].pair[0]));
    press("Escape");
    ok("C ...Escape closes the card, the page stays", !G.Modal.isOpen() && G.UI._currentScreen === "screen-progress");
    const boxBefore = JSON.stringify(G.save.learn.srs);
    // tabs: Q / E, the controller's LB / RB (js/gamepad.js), clicks
    winKey("KeyE");
    ok("C E: the Game tab -- scores, guns, notes, bosses", G.Progress.tab === "game" && /Best scores/.test(body.textContent) && /Guns/.test(body.textContent) && !/AWL/.test(body.textContent));
    winKey("KeyQ");
    ok("C Q: back to Learning", G.Progress.tab === "learn" && /AWL/.test(body.textContent));
    ok("C looking moves no box", JSON.stringify(G.save.learn.srs) === boxBefore);
    ok("C the due tile takes you to Daily Review", (() => { body.querySelector(".pg-due").click(); return G.UI._currentScreen === "screen-mainmenu" && G.Lobby.current().id === "review"; })());
    // Practise these
    G.Progress.open();
    await wait(30);
    $("btn-progress-practise").click();
    await wait(30);
    const listed = d.missed.map((m) => key(m.pair)).sort().join();
    ok("C Practise these: a practice session on exactly those words", G.UI._currentScreen === "screen-practice-play" && G.Practice.qs.map((q) => key(q.pair)).sort().join() === listed);
    G.Practice.answerAs(true);
    G.Practice.quit();
    await wait(20);
    ok("C ...ending it asks Again or Done", G.Dialog.isOpen() && G.Practice.from === "screen-progress");
    $("dialog-btns").querySelector("[data-pad-back]").click();
    await wait(30);
    ok("C ...Done: back on the Progress page", G.UI._currentScreen === "screen-progress");
    winKey("Escape");
    await wait(30);
    ok("C Escape: back to the lobby, its keys working", G.UI._currentScreen === "screen-mainmenu" && G.Game.state === "MENU");
  }

  // ---------------- D: Practice Mode ----------------
  async function practice() {
    fresh(); G.Clock.offsetDays = 0;
    const Pr = G.Practice;
    const lv1 = G.WORD_SETS.level1.words;
    Pr.f = { mode: "classic", clue: "definition", answer: "spell", src: "level1", topic: "Education", boxes: [], wrong: false };
    let m = Pr.matching();
    ok("D filter: a level and a topic", m.length > 5 && m.every((p) => G.WordBank.info(p).topic === "Education" && lv1.includes(p)), m.length);
    const three = m.slice(0, 3);
    three.forEach((p) => put(p, 2, 1));
    Pr.f.boxes = ["2"];
    ok("D filter: a box", Pr.matching().map(key).sort().join() === three.map(key).sort().join());
    Pr.f.boxes = ["0"];
    ok("D filter: New", Pr.matching().every((p) => !G.SRS.state(p)) && Pr.matching().length === m.length - 3);
    Pr.f.boxes = []; Pr.f.topic = ""; Pr.f.src = "all"; Pr.f.wrong = true;
    const often = [P("analyse"), P("benefit"), P("indicate")];
    G.save.wordStats.analyse = { correct: 1, wrong: 5 }; G.save.wordStats.benefit = { correct: 9, wrong: 2 }; G.save.wordStats.indicate = { correct: 2, wrong: 3 }; G.save.wordStats.affect = { correct: 1, wrong: 1 };
    m = Pr.matching();
    ok("D filter: often wrong (missed 2+ times, a quarter of its answers): the most missed first", m.map(key).join() === "analyse,indicate", m.map(key).join());
    void often;
    // the setup screen
    Pr.f = { mode: "classic", clue: "definition", answer: "spell", src: "level1", topic: "", boxes: [], wrong: false };
    G.Lobby.open({ tab: "training", select: "practice" }); G.UI.showScreen("screen-mainmenu");
    await wait(30);
    G.Lobby.instant = true; G.Lobby.select(G.Lobby.modes("training").findIndex((x) => x.id === "practice")); G.Lobby.launch();
    await wait(40);
    const root = $("practice-setup-content");
    ok("D the lobby card opens the setup", G.UI._currentScreen === "screen-practice-setup" && G.Game.state === "PRACTICE_SETUP");
    ok("D every mode on offer, and Your own", Array.from(root.querySelectorAll("[data-mode]")).map((b) => b.dataset.mode).join() === "classic,spelling,paraphrase,listening,dictation,context,adaptive,custom");
    ok("D filters: words from, topic, box, often wrong; how many match", !!root.querySelector('[data-src="level2"]') && $("practice-topic").options.length === 13 && root.querySelectorAll("[data-box]").length === 8 && !!root.querySelector("[data-wrong]") && /words match/.test($("practice-count").textContent));
    root.querySelector('[data-mode="custom"]').click();
    ok("D Your own: the clue and the answer to choose", !root.querySelector(".learn-custom").classList.contains("hidden") && root.querySelectorAll(".learn-custom [data-clue]").length === 4 && root.querySelectorAll(".learn-custom [data-answer]").length === 2);
    $("practice-setup-content").querySelector('[data-clue="audio"]').click();
    $("practice-setup-content").querySelector('[data-answer="spell"]').click();
    ok("D ...Audio + Spell", Pr.modeId() === "custom:audio+spell");
    $("practice-topic").value = "Media & Communication"; $("practice-topic").dispatchEvent(new Event("change"));
    ok("D a topic picked: the count follows", Pr.f.topic === "Media & Communication" && Pr.matching().length > 3 && Pr.matching().every((p) => G.WordBank.info(p).topic === "Media & Communication") && $("practice-count").textContent.startsWith(Pr.matching().length + " words"));
    $("btn-practice-start").click();
    await wait(30);
    const qs = Pr.qs;
    ok("D Audio + Spell: dictation questions, up to " + G.CONFIG.practice.words, G.UI._currentScreen === "screen-practice-play" && qs.length === Math.min(G.CONFIG.practice.words, Pr.matching().length) && qs.every((q) => q.type === ("speechSynthesis" in window ? "dictation" : "spell")), qs.map((q) => q.type).join());
    ok("D ...a window of its own: the controller works in it", G.Modal.isOpen("practice") && G.Pad.scope() === $("screen-practice-play") && /Audio \+ Spell/.test($("practice-kicker").textContent));
    const sk0 = G.save.learn.skills.spelling.r, ls0 = G.save.learn.skills.listening.r;
    Pr.answerAs(true);
    ok("D right: counted, its skills too", Pr.right === 1 && G.save.learn.skills.spelling.r === sk0 + 1 && G.save.learn.skills.listening.r === ls0 + 1 && $("practice-feedback").classList.contains("ok"));
    await wait(G.CONFIG.quiz.feedback * 1000 + 120);
    ok("D ...then the next question by itself", Pr.i === 1 && Pr.stage === "question");
    const q1 = Pr.qs[1];
    Pr.answerAs(false);
    ok("D wrong: the word's mini card and Continue", !!$("practice-feedback").querySelector(".vc-mini") && !!$("practice-feedback").querySelector(".qf-next") && G.SRS.box(q1.pair) === 1 && G.wordStat(q1.pair).wrong >= 1);
    press("Enter");
    ok("D ...Enter goes on", Pr.i === 2 && Pr.stage === "question");
    // typing a spelling with the keys
    const q2 = Pr.qs[2], w2 = G.Questions.spellTarget(q2)[0];
    for (const ch of w2) press(ch === " " ? "Space" : ch === "-" ? "Minus" : "Key" + ch.toUpperCase(), ch);
    press("Enter");
    ok("D keys: the word typed and Enter", Pr.right === 2, w2);
    press("Escape");
    await wait(20);
    ok("D Escape: the session ends, with how it went", G.Dialog.isOpen() && /2 of 3 right/.test($("dialog-text").textContent), $("dialog-text").textContent);
    $("dialog-btns").querySelector(".btn-primary").click();
    await wait(30);
    ok("D Again: the missed word once more", Pr.active && Pr.qs.length === 1 && key(Pr.qs[0].pair) === key(q1.pair));
    Pr.quit(); await wait(10);
    ok("D ...nothing answered yet: straight back to the setup", !Pr.active && G.UI._currentScreen === "screen-practice-setup" && !G.Modal.isOpen());
    // choices: digits; a ready-made mode
    root.querySelector('[data-mode="classic"]').click();
    $("btn-practice-start").click();
    await wait(30);
    const qc = Pr.qs[0];
    ok("D Classic: Thai -> English, four choices", qc.type === "th2en" && $("practice-choices").querySelectorAll(".quiz-choice").length === 4);
    press("Digit" + (qc.answer + 1), String(qc.answer + 1));
    ok("D ...digit keys answer", Pr.right === 1);
    Pr.quit(); await wait(10);
    G.Dialog.choose(1); await wait(20);
    // every preset asks its own kind
    const kinds = { classic: "th2en", spelling: "spell", paraphrase: "def2word", context: "cloze", "custom:definition+spell": "defspell", "custom:cloze+spell": "clozespell" };
    const got = Object.keys(kinds).map((id) => { Pr.run([P("analyse")], id, G.WORD_SETS.level1.words, "setup"); const t = Pr.qs[0].type; Pr.active = false; G.Modal.close("practice"); return t; });
    ok("D every pairing asks its kind of question", got.join() === Object.values(kinds).join(), got.join());
    Pr.run([P("analyse")], "custom:cloze+spell", G.WORD_SETS.level1.words, "setup");
    const cq = Pr.qs[0];
    ok("D Sentence gap + Spell: the form the sentence wants", cq.spellPair && G.WordBank.familyOf(cq.answerText).id === "analyse" && /q-gap/.test($("practice-prompt").innerHTML));
    Pr.answerAs(true);
    ok("D ...counted as spelling and context", G.save.learn.skills.context.r >= 1);
    Pr.active = false; G.Modal.close("practice"); clearTimeout(Pr._t);
    // back to the lobby: its keys work (the menu state is back)
    G.Practice.open("screen-mainmenu"); await wait(20);
    winKey("Escape"); await wait(40);
    ok("D Escape on the setup: the lobby, and its keys answer", G.UI._currentScreen === "screen-mainmenu" && G.Game.state === "MENU" && (() => { const i = G.Lobby.sel[G.Lobby.tab]; press("ArrowLeft"); return G.Lobby.sel[G.Lobby.tab] !== i || i === 0; })());
    G.Lobby.instant = false;
  }

  // ---------------- E: Learning Modes ----------------
  async function learning() {
    fresh();
    G.Study._pick = null;
    G.Study.openPicker();
    await wait(20);
    const box = $("learn-box");
    ok("E the modes, then Your own", Array.from(box.querySelectorAll("#learn-modes [data-preset]")).map((b) => b.dataset.preset).join() === "classic,spelling,paraphrase,listening,dictation,context,adaptive,custom");
    box.querySelector('[data-preset="custom"]').click();
    box.querySelector('[data-clue="definition"]').click();
    box.querySelector('[data-answer="spell"]').click();
    ok("E Your own: Definition + Spell", G.Study.pickedMode() === "custom:definition+spell" && !$("learn-custom").classList.contains("hidden"));
    ok("E words from a level, or a topic from every level (12)", box.querySelectorAll("#learn-levels [data-level]").length >= 1 && box.querySelectorAll("#learn-topics [data-topic]").length === 12);
    box.querySelector('[data-topic="Health"]').click();
    ok("E a topic picked", G.Study._pick.from.topic === "Health" && box.querySelector('[data-topic="Health"]').classList.contains("on") && !box.querySelector("#learn-levels .on"));
    G.Study.closePicker();
    const s = G.Study.learn(G.Study.pickedMode(), G.Study._pick.from);
    const health = G.getAllBuiltinWords().filter((p) => G.WordBank.info(p).topic === "Health");
    ok("E the session: Health's words, from every level that has them", s.cards.length > 0 && s.cards.every((p) => G.WordBank.info(p).topic === "Health") && s.pool.length === health.length);
    ok("E ...its title: the pairing and the topic", s.title === "Definition + Spell · " + G.topicLabel("Health"), s.title);
    const run = G.Learn.run(s.preset, s.cards);
    ok("E ...every word asked Definition + Spell", s.cards.every((p) => run.pick(p).clue === "definition" && run.pick(p).answer === "spell") && run.spells && !run.shoots);
    ok("E its leaderboard: Custom", G.Learn.boardOf(s.preset) === "mode_custom" && G.Learn.boardOf("dictation") === "mode_dictation");
    // the labels a pairing puts on the zombies (learning modes: not the campaign)
    const ind = P("indicate");
    ok("E labels: Definition + Spell a synonym; Sentence gap + Spell ___; Audio + Shoot the Thai", G.Learn.labelFor(ind, "definition", "spell") === G.Clues.synonym(ind) && G.Learn.labelFor(ind, "cloze", "spell") === "___" && G.Learn.labelFor(ind, "audio", "shoot", null, false) === ind[1]);
    ok("E ...in the campaign Audio + Shoot carries the English word", G.Learn.labelFor(ind, "audio", "shoot", null, true) === "indicate");
  }

  // ---------------- F: the campaign's Learning Style ----------------
  async function campaign() {
    fresh();
    G.save.learnSeen = SEEN();
    G.save.settings.campaignStyle = "adaptive"; G.save.settings.spellReload = false;
    G.Checkpoint && G.Checkpoint.remove && G.Checkpoint.remove(1);
    G.UI.goToMainMenu({ tab: "campaign", select: "school" });
    await wait(40);
    G.Lobby.instant = true;
    G.Lobby.launch();
    await wait(20);
    const box = $("camp-style-box");
    ok("F a level: its Learning Style first, a window of its own", G.Modal.isOpen("campstyle") && G.Pad.scope() === box && G.Game.state === "MENU");
    ok("F ...Adaptive (picked), Classic, Your own; Spell to Reload", Array.from(box.querySelectorAll("[data-style]")).map((b) => b.dataset.style + (b.classList.contains("on") ? "*" : "")).join() === "adaptive*,classic,custom" && !!box.querySelector("[data-reload]"));
    press("Escape");
    await wait(20);
    ok("F Escape: back to the lobby, nothing started", !G.Modal.isOpen() && G.UI._currentScreen === "screen-mainmenu" && G.Game.state === "MENU" && !G.Lobby._launching);
    G.Lobby.launch(); await wait(20);
    box.querySelector('[data-style="classic"]').click();
    $("btn-camp-go").click();
    await wait(60);
    const g = G.Game;
    ok("F Classic: the level starts with the Thai, shot", g.state === "GAMEPLAY" && g.mode === "campaign" && g.learn.id === "classic" && G.save.settings.campaignStyle === "classic");
    g.quitToMainMenu(); await wait(30);
    G.Lobby.launch(); await wait(20);
    ok("F the choice comes back picked", box.querySelector('[data-style="classic"]').classList.contains("on"));
    box.querySelector('[data-style="custom"]').click();
    box.querySelector('[data-clue="audio"]').click();
    box.querySelector('[data-answer="shoot"]').click();
    ok("F Your own, Audio + Shoot: it says what that means here", /listen to the word, then shoot the zombie that carries it/i.test($("camp-style-custom").textContent));
    box.querySelector("[data-reload]").click();
    // the first time: its intro
    delete G.save.learnSeen.mode_listenword;
    $("btn-camp-go").focus();
    press("Enter");
    await wait(30);
    ok("F ...the first time: its short intro", G.Modal.isOpen("studyintro") && /Audio \+ Shoot/.test($("study-intro-title").textContent) && /every zombie carries its English word/.test($("study-intro-text").textContent));
    $("btn-intro-start").click();
    await wait(60);
    ok("F ...then the level, with Spell to Reload on", g.state === "GAMEPLAY" && g.learn.id === "custom:audio+shoot" && G.save.settings.spellReload === true && G.save.learnSeen.mode_listenword);
    // the zombies carry English; the panel says to shoot the word heard
    g.player.hp = g.player.maxHp = 1e6; g.requiredKills = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = []; g.targetPair = null;
    const ben = P("benefit"), ach = P("achieve");
    [ben, ach].forEach((p, i) => {
      const z = new G.Zombie("normal", g.yawObject.position.clone().add(new THREE.Vector3(3 + i * 2, -1.7, -6)), p, g.level.theme);
      g.dressZombie(z, p, { clue: "audio", answer: "shoot" });
      g.scene.add(z.mesh); g.zombies.push(z);
    });
    g.ensureTargetHasMatch();
    const h = g.buildHudState();
    ok("F Audio in the campaign: zombies carry English words", g.zombies.every((z) => z.labelText === z.word));
    ok("F ...the panel: listen, shoot the word you hear", /shoot the word you hear/.test(h.meaningLabel) && h.currentMeaning === "🔊", h.meaningLabel);
    // a run's leaderboard entry notes its style
    g.onGameOver();
    await wait(20);
    const e = G.save.leaderboards.level1[0];
    ok("F a campaign score notes its Learning Style", e && e.style === "custom:audio+shoot");
    g.quitToMainMenu(); await wait(30);
    // Adaptive in the campaign: the clue by the box
    G.Lobby.launch(); await wait(20);
    box.querySelector('[data-style="adaptive"]').click();
    box.querySelector("[data-reload]").click();
    $("btn-camp-go").click();
    await wait(60);
    put(ach, 4, 0);
    ok("F Adaptive: each word asked by its box", g.learn.id === "adaptive" && g.learn.pick(P("analyse")).clue === "thai" && ["thai+spell", "audio+spell", "definition+shoot", "cloze+shoot"].includes(g.learn.pick(ach).clue + "+" + g.learn.pick(ach).answer) && G.save.settings.spellReload === false);
    g.quitToMainMenu(); await wait(30);
    // the spelling cards of the tutorial come in a campaign played by spelling
    G.save.settings.campaignStyle = "custom:thai+spell";
    G.save.tutorialSeen = {}; G.save.tutorialDone = true;
    G.Lobby.launch(); await wait(20);
    $("btn-camp-go").click(); await wait(60);
    ok("F Your own Thai + Spell: the typing bar", g.learn.id === "custom:thai+spell" && G.Spell.active);
    for (let i = 0; i < 300 && !G.Tutorial.current; i++) g.update(0.05);
    ok("F ...and its tutorial card (letters type, arrows walk)", G.Tutorial.current && G.Tutorial.current.id === "spell", G.Tutorial.current && G.Tutorial.current.id);
    g.quitToMainMenu(); await wait(30);
    G.save.settings.campaignStyle = "adaptive";
    G.Lobby.instant = false;
  }

  // ---------------- G: the learning achievements ----------------
  async function achievements() {
    fresh();
    const toasts = [];
    const realToast = G.UI.showAchievementToast;
    G.UI.showAchievementToast = (id) => toasts.push(id);
    const ana = P("analyse");
    put(ana, 5, 0);
    G.Learning.answerWord(ana, true, { recall: true, skills: ["spelling"] });
    ok("G First Mastered Word: a word past its box-5 review", G.SRS.box(ana) === 6 && G.save.achievements.first_mastered && toasts.includes("first_mastered"));
    ok("G ...not yet 100", !G.save.achievements.mastered_100);
    const all = G.WordBank.entries();
    all.slice(0, 99).forEach((e) => { if (e.id !== "analyse") put(P(e.id), 6, 30); });
    const last = P(all[120].id); put(last, 5, 0);
    G.Learning.answerWord(last, true, { recall: true });
    ok("G 100 Words Mastered", G.save.achievements.mastered_100);
    const sub1 = all.filter((e) => e.source === "AWL" && e.awlSublist === 1);
    ok("G ...AWL Sublist 1 not until all 60", !G.save.achievements.awl_sublist1);
    sub1.slice(1).forEach((e) => put(P(e.id), 6, 30));
    put(P(sub1[0].id), 5, 0);
    G.Learning.answerWord(P(sub1[0].id), true, { recall: true });
    ok("G AWL Sublist 1 Complete: its 60 Mastered", G.save.achievements.awl_sublist1 && sub1.length === 60);
    // Spelling Bee: fifty right in a row; a miss starts again; a hinted one neither counts nor breaks it
    fresh(); toasts.length = 0;
    for (let i = 0; i < 30; i++) G.Learning.track(true, { skills: ["spelling"] });
    G.Learning.track(false, { skills: ["spelling"] });
    ok("G Spelling Bee: a miss starts the run again", G.save.learn.spellRun === 0);
    for (let i = 0; i < 49; i++) G.Learning.track(true, { skills: ["spelling"] });
    G.Learning.track(false, { skills: ["spelling"], assisted: true });
    G.Learning.track(true, { skills: ["recognition"] });
    ok("G ...49, a hinted miss and a shot: still 49", G.save.learn.spellRun === 49 && !G.save.achievements.spelling_bee);
    G.Learning.track(true, { skills: ["spelling", "listening"] });
    ok("G Spelling Bee: 50 right spellings in a row", G.save.achievements.spelling_bee);
    // Perfect Dictation Wave: a Dictation session, six words or more, none missed
    const cards = G.WordBank.entries(1).slice(0, 6).map((e) => P(e.id));
    const fake = { study: null, player: { score: 600 }, state: "GAMEPLAY" };
    const sess = (preset, n, right) => { const s = G.Study.make("learn", cards.slice(0, n), { preset }); s.answered = n; s.right = right; s.cards.forEach((p, i) => { s.done[key(p)] = i < right ? "right" : "wrong"; }); fake.study = s; G.Study.finish(fake, "done"); G.Study.closeResult(); };
    sess("dictation", 6, 5);
    ok("G Perfect Dictation: not with a miss", !G.save.achievements.perfect_dictation);
    sess("dictation", 5, 5);
    ok("G ...not with fewer than six words", !G.save.achievements.perfect_dictation);
    sess("custom:audio+spell", 6, 6);
    ok("G Perfect Dictation Wave: six words, none missed (Audio + Spell counts too)", G.save.achievements.perfect_dictation);
    ok("G the sessions went on their boards", G.save.leaderboards.mode_dictation.length === 2 && G.save.leaderboards.mode_custom[0].mode === "custom:audio+spell" && G.save.leaderboards.mode_custom[0].words === 6);
    G.UI.showAchievementToast = realToast;
    // the Achievements screen lists them
    G.UI.renderAchievements();
    const names = $("achievements-content").textContent;
    ok("G the Achievements screen: all six", ["First Mastered Word", "100 Words Mastered", "AWL Sublist 1 Complete", "7-Day Streak", "Perfect Dictation Wave", "Spelling Bee"].every((n) => names.includes(n)));
  }

  // ---------------- H: leaderboards, lobby, intros ----------------
  async function boards() {
    G.save.leaderboards.review = [{ score: 900, date: "2026-10-01", meta: "", words: 24, mode: "review" }];
    G.save.leaderboards.level1 = [{ score: 5000, date: "2026-10-01", meta: "", style: "adaptive" }, { score: 4000, date: "2026-09-30", meta: "", style: "custom:definition+spell" }];
    G.UI.renderLeaderboard("level1");
    const c = $("leaderboard-content");
    const tabs = Array.from(c.querySelectorAll(".tab-btn")).map((t) => t.dataset.cat);
    ok("H leaderboards: the game's five, then Daily Review and every mode, Custom last", tabs.join() === "level1,level2,level3,daily,endless,review,mode_classic,mode_spelling,mode_paraphrase,mode_listening,mode_dictation,mode_context,mode_adaptive,mode_custom", tabs.join());
    ok("H a campaign entry shows its Learning Style", Array.from(c.querySelectorAll(".lb-style")).map((s) => s.textContent).join() === "Adaptive,Definition + Spell");
    c.querySelector('[data-cat="review"]').click();
    ok("H Daily Review's board: score and words", /900/.test(c.querySelector(".leaderboard-list").textContent) && /24 words/.test(c.textContent));
    // the lobby's cards use the Progress page's words
    G.UI.goToMainMenu({ tab: "training", select: "learn" });
    await wait(40);
    const st = G.Lobby.stats(G.Lobby.MODES.find((m) => m.id === "learn")).map((r) => r[0]).join();
    ok("H the Learning Modes card: Learning, Review, Mastered", st === "Learning,Review,Mastered", st);
    // the intros: the pairing's own lines
    const k = (id, c2) => G.Study.introKey(id, c2);
    ok("H intros: a pairing gets the lines that fit it", k("custom:audio+shoot") === "listening" && k("custom:audio+shoot", true) === "listenword" && k("listening", true) === null && k("custom:definition+spell") === "defspell" && k("custom:cloze+spell") === "clozespell" && k("custom:cloze+shoot") === "context" && k("custom:thai+spell") === null, [k("custom:audio+shoot"), k("custom:audio+shoot", true), k("custom:definition+spell")].join());
    ok("H every intro has its two lines", ["listenword", "defspell", "clozespell"].every((m) => G.T("study.mode." + m + ".1") !== "study.mode." + m + ".1" && G.T("study.mode." + m + ".2") !== "study.mode." + m + ".2"));
    const missing = Object.keys(G._missingKeys || {});
    ok("H no missing strings", missing.length === 0, missing.join());
  }

  // ---------------- K: how long a Daily Review takes (balance) ----------------
  // A real session in simulated game time, played by a model player who
  // answers each word `react` seconds after it can see it (spelling: plus
  // `perLetter` a letter) -- no misses. The words: `n` due, in the boxes a
  // day-30 player has them (the simulation's mix). Returns the session's
  // length, the bites, how close the zombies came. The save is put back.
  async function reviewTiming(o) {
    o = Object.assign({ n: 30, react: 2.5, perLetter: 0.35, mix: [1, 1, 1, 2, 2, 3, 3, 4, 5] }, o || {});
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock, realSpeak = G.Audio.speak, realBite = G.Study.onBite;
    G.Input.requestPointerLock = function () {}; G.Audio.speak = function () {};
    let bites = 0, t = 0, closest = Infinity, spelt = 0, shot = 0;
    G.Study.onBite = function (game, z) { bites++; return realBite.call(this, game, z); };
    try {
      fresh(); G.save.learnSeen = SEEN();
      G.Input.mode = "desktop"; G.Input.padActive = false;
      G.WordBank.entries(1).slice(0, o.n).forEach((e, i) => put(P(e.id), o.mix[i % o.mix.length], 0));
      G.Study.openDaily();
      const g = G.Game, seen = new Map(), DT = 0.05;
      let lastKey = null, tChange = 0;
      while (g.mode === "study" && g.state === "GAMEPLAY" && t < 1200) {
        g.update(DT); t += DT;
        const p = g.yawObject.position;
        g.zombies.filter((z) => z.alive).forEach((z) => {
          const d = z.mesh.position.distanceTo(p);
          closest = Math.min(closest, d);
          if (d < 26 && !z.emerge && !seen.has(z)) seen.set(z, t);
        });
        // a spelt one: once it has been seen long enough to type it
        const sz = G.Spell.active ? G.Spell.spellZombies().find((z) => seen.has(z) && t - seen.get(z) >= o.react + o.perLetter * G.Spell.target(z)[0].length) : null;
        if (sz) { G.Spell.setFocus(sz); G.Spell.submit(G.Spell.target(sz)[0]); spelt++; continue; }
        // a shot one: the target, once seen long enough
        const k = g.targetPair ? G.wordKey(g.targetPair) : null;
        if (k !== lastKey) { lastKey = k; tChange = t; }
        if (g.targetPair) {
          const z = g.zombies.find((x) => x.alive && !x.decoy && x.answer !== "spell" && G.wordKey(x.pair) === G.wordKey(g.targetPair) && seen.has(x));
          if (z && t - Math.max(seen.get(z), tChange) >= o.react) { g.damageZombie(z, z.hp + 1e6, z.mesh.position.clone(), { dir: null, head: false }); shot++; }
        }
        if (Math.round(t / DT) % 400 === 0) await wait(0);
      }
      const s = G.Study.session || g.study;
      const res = { seconds: Math.round(t), minutes: +(t / 60).toFixed(1), words: o.n, shot, spelt, bites, closest: +closest.toFixed(1), finished: g.state === "STUDY_DONE", right: s ? s.right : null };
      G.Study.closeResult();
      if (g.state !== "MENU") g.quitToMainMenu();
      return res;
    } finally {
      G.Study.onBite = realBite; G.Input.requestPointerLock = realLock; G.Audio.speak = realSpeak;
      G.Modal.reset();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
    }
  }

  async function run() {
    results.length = 0; out.sim = []; out.balance = null;
    const backup = JSON.stringify(G.save);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    const realLock = G.Input.requestPointerLock, realSpeak = G.Audio.speak;
    G.Input.requestPointerLock = function () {};
    G.Audio.speak = function () {};
    const mode = G.Input.mode;
    G.Input.mode = "desktop"; G.Input.padActive = false;
    G._missingKeys = {};
    try {
      await saves();
      await sim30();
      await progress();
      await practice();
      await learning();
      await campaign();
      await achievements();
      await boards();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Clock.offsetDays = 0;
      G.Input.requestPointerLock = realLock; G.Audio.speak = realSpeak;
      G.Input.mode = mode; G.Input.padActive = false;
      G.Questions.forceTypes(null);
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Practice.active = false; clearTimeout(G.Practice._t);
      ["camp-style", "learn-pick", "study-intro", "vocab-card"].forEach((id) => $(id) && $(id).classList.add("hidden"));
      G.Modal.reset();
      G.Lobby.instant = false;
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), sim: out.sim, balance: out.balance, pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run, sim30, table, reviewTiming };
})();
