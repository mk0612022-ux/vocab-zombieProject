// ===================================================================
// Study sessions (vocabulary series, round 2): Daily Review, the learning modes
// -------------------------------------------------------------------
// A short session on the school's grounds, one wave of words:
//   Daily Review (C4)  every word due today across the game, most overdue
//                      first, at most G.CONFIG.study.dailyMax (30) a session;
//                      each word answered the Adaptive way (shot while it is
//                      new or in boxes 1-2, spelt from box 3). No money, shop
//                      or boss: a score. Finishing a session counts the day
//                      for the streak (a day with nothing due does not break
//                      it: js/srs.js). Nothing due: "All caught up" and how
//                      many come tomorrow. More due: Continue.
//   Learning Modes (B) a ready-made mode (Classic, Spelling, Adaptive) on a
//                      level's words, picked the way a wave picks them (C3,
//                      js/learnmodes.js G.WavePlan).
// A word missed comes back once at the end of the session, for the player
// to get right -- it does not move its box again (it is not due any more).
// The windows (the mode picker, the first-time spelling intro, the results)
// are G.Modal windows: mouse, touch, keys and a controller.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const C = () => G.CONFIG.study;
  const $ = (id) => document.getElementById(id);

  G.Study = {
    session: null,

    // ---------------- sessions ----------------
    make(kind, cards, opts) {
      opts = opts || {};
      return {
        kind, preset: opts.preset || "adaptive", levelId: opts.levelId || 1,
        title: opts.title || T(kind === "review" ? "study.reviewTitle" : "study.learnTitle"),
        cards: cards.slice(), queue: cards.slice(), pool: opts.pool || cards.slice(),
        done: {},            // word key -> "right" | "wrong"   (the first answer of the session)
        retried: {}, retries: 0, right: 0, answered: 0, promoted: 0, due: opts.due || cards.length,
      };
    },
    daily() {
      const due = G.SRS.dueToday();
      if (!due.length) return null;
      // the most overdue make the session; in it, any order
      const cards = G.shuffle(due.slice(0, C().dailyMax));
      return this.make("review", cards, { preset: "adaptive", levelId: 1, due: due.length });
    },
    // (round 4, J1) the words of a session: a level's, or a topic's from
    // every level. `from`: { level } or { topic } (a number is a level)
    wordsFrom(from) {
      if (typeof from === "number") from = { level: from };
      if (from && from.topic) return G.getAllBuiltinWords().filter((p) => { const e = G.WordBank.info(p); return e && e.topic === from.topic; });
      return G.WORD_SETS["level" + ((from && from.level) || 1)].words;
    },
    fromLabel(from) {
      if (typeof from === "number") from = { level: from };
      return from && from.topic ? G.topicLabel(from.topic) : G.getLevel((from && from.level) || 1).name;
    },
    learn(presetId, from) {
      if (typeof from === "number") from = { level: from };
      from = from || { level: 1 };
      // (round 3: a mode built on a definition or a sentence takes the words
      // that have one -- a player's own word may not)
      const clue = G.Learn.run(presetId).clue;
      const all = this.wordsFrom(from);
      const usable = clue ? all.filter((p) => G.Learn.usable(p, clue)) : all;
      const pool = usable.length >= G.CONFIG.quiz.minWordsPerWave ? usable : all;
      const n = Math.min(pool.length, C().learnCards);
      // a learning session is two waves' worth: twice the new words a wave may bring
      const saved = G.CONFIG.waveWords.maxNew;
      G.CONFIG.waveWords.maxNew = saved * 2;
      let cards;
      try { cards = G.WavePlan.build(pool, n); } finally { G.CONFIG.waveWords.maxNew = saved; }
      // (played on the school's grounds whichever level the words are from)
      const s = this.make("learn", G.shuffle(cards), { preset: presetId, levelId: 1, pool,
        title: T("study.learnTitleMode", { mode: G.Learn.label(presetId), level: this.fromLabel(from) }) });
      s.from = from;
      return s;
    },

    // ---------------- from the lobby ----------------
    openDaily() {
      const s = this.daily();
      if (!s) {
        const f = G.SRS.forecast();
        G.Dialog.open({ icon: "✅", title: T("study.caughtUpTitle"), text: T("study.caughtUpText", { n: f.tomorrow }), buttons: [{ label: T("dialog.ok"), primary: true, cancel: true }] });
        return false;
      }
      this.launch(s);
      return true;
    },
    // first time a session asks for spelling on this kind of input: how it works
    // (round 3: and the first time in each of the newer modes, what it asks)
    launch(s) {
      this.introFor(s.preset, G.Learn.run(s.preset, s.cards), () => G.Game.startStudy(s));
    },
    // (round 4, J4) before any run -- a study session, a campaign level, a
    // practice -- the first time it asks this way on this input: how it
    // works. A pairing of the player's own shows the lines of the mode with
    // the same clue and answer; `campaign`: Audio + Shoot there is "shoot the
    // word you hear" (every zombie carries its English word)
    introFor(presetId, run, go, campaign) {
      const dev = G.Input.padActive ? "pad" : G.Input.mode === "touch" ? "touch" : "keys";
      const seen = (G.save.learnSeen = G.save.learnSeen || {});
      const mode = this.introKey(presetId, campaign);
      const spellIntro = !!run.spells && !seen["intro_" + dev];
      const modeIntro = !!mode && !seen["mode_" + mode];
      if (!spellIntro && !modeIntro) { go(); return; }
      this.openIntro(dev, () => {
        if (spellIntro) seen["intro_" + dev] = true;
        if (modeIntro) seen["mode_" + mode] = true;
        G.persistSoon(); go();
      }, { spell: spellIntro, preset: modeIntro ? mode : null, title: G.Learn.label(presetId) });
    },
    introKey(presetId, campaign) {
      const p = G.Learn.preset(presetId);
      if (!p.custom) return this.MODE_INTROS.includes(p.id) && !(campaign && p.id === "listening") ? p.id : null;
      if (p.clue === "audio") return p.answer === "spell" ? "dictation" : campaign ? "listenword" : "listening";
      if (p.answer === "spell") return { definition: "defspell", cloze: "clozespell" }[p.clue] || null;
      return { definition: "paraphrase", cloze: "context" }[p.clue] || null;
    },
    MODE_INTROS: ["paraphrase", "listening", "dictation", "context", "adaptive"],

    // ---------------- the run ----------------
    beginRun(game) {
      this.session = game.study;
      // no money in a study session: the gun never runs dry
      Object.values(game.player.ammo).forEach((a) => { a.reserve = 9999; });
    },
    startWave(game) {
      const s = game.study;
      game.wavePlan = null;
      game.requiredKills = s.queue.length;
      // (spelling takes longer than shooting: fewer at once, further apart)
      const spellOnly = game.learn && !game.learn.shoots;
      const every = spellOnly ? C().everySpell : C().every;
      G.Spawner.spec = { kills: s.queue.length, speed: 1, fast: 0, crawler: 0, alive: spellOnly ? C().aliveSpell : C().alive, every };
      G.Spawner.interval = every;
      G.Spawner.timer = 0.6;
    },
    // the next word to send (not one with the same word or meaning already out)
    nextCard(game) {
      const s = game.study;
      if (!s || !s.queue.length) return null;
      const alive = game.zombies.filter((z) => z.alive);
      const i = s.queue.findIndex((p) => !alive.some((z) => z.word === p[0] || (z.meaning || "").trim() === (p[1] || "").trim()));
      const k = i < 0 ? 0 : i;
      return s.queue.splice(k, 1)[0];
    },
    update(game) {
      const pl = game.player;
      Object.values(pl.ammo).forEach((a) => { if (a.reserve < 999) a.reserve = 9999; });
    },
    // the first answer on each word is the one that counts
    mark(game, pair, right) {
      const s = game.study, key = G.wordKey(pair);
      if (!s || s.done[key]) return;
      s.done[key] = right ? "right" : "wrong";
      s.answered++;
      if (right) s.right++;
      else if (C().retryWrong && !s.retried[key]) {
        s.retried[key] = true; s.retries++;
        s.queue.push(pair);
        game.requiredKills++;
      }
    },
    onAnswer(game, z, right) {
      if (z.decoy) return;
      this.mark(game, z.pair, right);
    },
    onMissed(game, z) { this.mark(game, z.pair, false); },
    // A zombie reached the player (js/game.js has scored the bite): it goes.
    // The word it was asking is a miss -- shown, and back at the end; one
    // that was not being asked simply comes again.
    onBite(game, z) {
      const s = game.study;
      if (!s || z.type === "boss") return;
      const key = G.wordKey(z.pair);
      const asked = z.answer === "spell" || (!!game.targetPair && G.wordKey(game.targetPair) === key);
      if (!z.decoy && asked) {
        this.mark(game, z.pair, false);
        if (z.answer === "spell" && G.Spell.pad && G.Spell.focus === z && !G.Spell.pad.feedback) G.Spell.pad.showFeedback(G.Spell.pad.text(), G.Spell.answerOf(z.pair), "");
        const back = s.queue.some((p) => G.wordKey(p) === key);
        G.UI.flashPurchaseBanner(T("study.bitten"), T(back ? "study.bittenBack" : "study.bittenText", { w: z.pair[0], m: z.pair[1] }));
      } else if (!z.decoy && !s.done[key]) { s.queue.push(z.pair); game.requiredKills++; }
      game.retireZombie(z);
    },
    onWrongShot(game, z, tp) {
      if (tp) this.mark(game, tp, false);
      // the word shot by mistake was not answered: it comes again
      if (!z.decoy && game.study && !game.study.done[G.wordKey(z.pair)]) { game.study.queue.push(z.pair); game.requiredKills++; }
    },
    scoreFor(game, z, spelled) {
      const S = C().score;
      return S.right + G.SRS.box(z.pair) * S.perBox + (spelled ? S.spell : 0);
    },
    hudLabel(game) {
      const s = game.study;
      if (!s) return "";
      return T("study.hud", { title: s.title, n: Math.min(s.answered, s.cards.length), total: s.cards.length });
    },

    // ---------------- the end ----------------
    finish(game, why) {
      const s = game.study;
      if (!s || this._finishing) return;
      this._finishing = true;
      game.state = "STUDY_DONE";
      G.Input.exitPointerLock();
      G.Modal.reset();
      const done = why === "done";
      let streak = null;
      if (done && s.kind === "review") streak = G.SRS.completeDaily(s.answered);
      // (round 4, J3) its leaderboard -- Daily Review's, or the mode's -- and
      // Perfect Dictation: a whole Dictation session right the first time
      if (done) {
        G.addLeaderboardEntry(s.kind === "review" ? "review" : G.Learn.boardOf(s.preset), game.player.score, "", { words: s.cards.length, mode: s.kind === "review" ? "review" : s.preset });
        const pr = G.Learn.preset(s.preset);
        const dictation = pr.id === "dictation" || (pr.custom && pr.clue === "audio" && pr.answer === "spell");
        if (dictation && s.cards.length >= G.CONFIG.achievements.perfectDictation && s.right === s.cards.length) G.unlockAchievement("perfect_dictation");
      }
      // the boxes the session's words are in now
      const up = s.cards.filter((p) => s.done[G.wordKey(p)] === "right").length;
      const moreDue = s.kind === "review" ? G.SRS.dueToday().length : 0;
      G.persist();
      const box = $("study-result");
      $("study-result-title").textContent = T(done ? (s.kind === "review" ? "study.doneReview" : "study.doneLearn") : "study.died");
      const rows = [
        [T("study.statWords"), s.answered + " / " + s.cards.length],
        [T("study.statRight"), up],
        [T("study.statScore"), game.player.score.toLocaleString("en-GB")],
      ];
      if (streak != null) rows.push([T("study.statStreak"), T(streak === 1 ? "study.day" : "study.days", { n: streak })]);
      $("study-result-stats").innerHTML = rows.map(([k, v]) => `<div class="sr-stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("");
      const missed = s.cards.filter((p) => s.done[G.wordKey(p)] === "wrong");
      // (round 3, H3) each word missed in context: a sentence, a collocation, its sound
      $("study-result-missed").innerHTML = missed.length
        ? `<div class="qm-title">${esc(T("quiz.review"))}</div>` + missed.map((p) => G.VocabCard.miniHtml(p)).join("")
        : "";
      G.VocabCard.bind($("study-result-missed"));
      const btns = [];
      if (s.kind === "review" && moreDue > 0) btns.push(`<button class="btn btn-primary" id="btn-study-more">${esc(T("study.continueMore", { n: Math.min(moreDue, C().dailyMax) }))}</button>`);
      if (s.kind === "learn") btns.push(`<button class="btn btn-primary" id="btn-study-again">${esc(T("study.again"))}</button>`);
      btns.push(`<button class="btn${btns.length ? "" : " btn-primary"}" id="btn-study-lobby" data-pad-back>${esc(T("study.toLobby"))}</button>`);
      $("study-result-btns").innerHTML = btns.join("");
      if (s.kind === "review" && moreDue === 0 && done) {
        $("study-result-note").textContent = T("study.caughtUpText", { n: G.SRS.forecast().tomorrow });
      } else $("study-result-note").textContent = "";
      box.classList.remove("hidden");
      G.UI.setHudVisible(false);
      G.UI.setTouchControlsVisible(false);
      const more = $("btn-study-more"), again = $("btn-study-again");
      if (more) more.onclick = () => this.next(game, this.daily());
      if (again) again.onclick = () => this.next(game, this.learn(s.preset, s.from || s.levelId));
      $("btn-study-lobby").onclick = () => this.toLobby(game);
      G.Modal.open("studyresult", { pause: true, keys: (e) => {
        if (e.code === "Enter" || e.code === "Space") { (more || again || $("btn-study-lobby")).click(); return true; }
        if (e.code === "Escape") { $("btn-study-lobby").click(); return true; }
        return true;
      } });
      setTimeout(() => { const b = more || again || $("btn-study-lobby"); if (b && G.Input.mode !== "touch") b.focus({ preventScroll: true }); }, 0);
      this._finishing = false;
    },
    closeResult() {
      $("study-result").classList.add("hidden");
      G.Modal.close("studyresult");
    },
    // another session, on the same grounds
    next(game, s) {
      this.closeResult();
      if (!s) { this.toLobby(game); return; }
      game.study = s; this.session = s;
      game.wordPool = s.pool || s.cards.slice();
      game.learn = G.Learn.run(s.preset, s.cards);
      game.player.hp = game.player.maxHp;
      game.player.score = 0;
      game.zombies.forEach((z) => { game.scene.remove(z.mesh); G.disposeObject3D(z.mesh); });
      game.zombies = [];
      game.targetPair = null; game._attempt = null;
      game.wave = 0;
      game.state = "GAMEPLAY"; game.paused = false;
      G.UI.setHudVisible(true);
      G.UI.applyControlMode();
      G.Spell.start(game);
      game.startWave();
      if (G.Input.mode === "desktop") G.Input.requestPointerLock();
    },
    toLobby(game) {
      this.closeResult();
      game.quitToMainMenu();
      G.UI.goToMainMenu({ tab: "training", select: game.study && game.study.kind === "learn" ? "learn" : "review" });
    },
    reset() {
      this.session = null; this._finishing = false;
      const r = $("study-result"); if (r) r.classList.add("hidden");
      const i = $("study-intro"); if (i) i.classList.add("hidden");
    },

    // ---------------- the Learning Modes window ----------------
    // (round 4, J1) a ready-made mode, or a clue x an answer of the player's
    // own; the words of a level, or of a topic across the levels
    openPicker() {
      const box = $("learn-pick");
      const p = (this._pick = Object.assign({ preset: "spelling", clue: "definition", answer: "spell" }, this._pick));
      if (!p.from) p.from = { level: p.level || 1 };
      // (round 3: every mode, those the languages rule out greyed with the reason)
      const presets = G.Learn.PRESETS;
      if (p.preset !== "custom" && G.Learn.whyNot(p.preset)) p.preset = "classic";
      if (G.Learn.clueWhyNot(p.clue)) p.clue = "thai";
      const levels = G.LEVELS.filter((l) => G.save.unlockedLevels.includes(l.id));
      if (!p.from.topic && !levels.some((l) => l.id === p.from.level)) p.from = { level: levels[0].id };
      const topicCount = {};
      G.WordBank.entries().forEach((e) => { topicCount[e.topic] = (topicCount[e.topic] || 0) + 1; });
      const opt = (attr, val, on, name, sub, small, lock) => `<button class="learn-opt${small ? " small" : ""}${on ? " on" : ""}${lock ? " locked" : ""}" data-${attr}="${esc(val)}" aria-pressed="${on}"${lock ? ` disabled aria-disabled="true" title="${esc(lock)}"` : ""}><b>${lock ? "\u{1F512} " : ""}${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</button>`;
      const render = () => {
        $("learn-modes").innerHTML = presets.map((x) => { const why = G.Learn.whyNot(x); return opt("preset", x.id, !why && x.id === p.preset, T("learn.preset." + x.id), why || T("learn.presetDesc." + x.id), false, why); }).join("")
          + opt("preset", "custom", p.preset === "custom", T("learn.preset.custom"), T("learn.presetDesc.custom"));
        const custom = $("learn-custom");
        custom.classList.toggle("hidden", p.preset !== "custom");
        custom.innerHTML = `<div class="learn-h">${esc(T("learn.clueHead"))}</div><div class="learn-row">${Object.keys(G.Learn.CLUES).map((c) => { const why = G.Learn.clueWhyNot(c); return opt("clue", c, !why && c === p.clue, T("learn.clue." + c), why, true, why); }).join("")}</div>
          <div class="learn-h">${esc(T("learn.answerHead"))}</div><div class="learn-row">${Object.keys(G.Learn.ANSWERS).map((a) => opt("answer", a, a === p.answer, T("learn.answer." + a), "", true)).join("")}</div>`;
        $("learn-levels").innerHTML = levels.map((l) => opt("level", l.id, !p.from.topic && l.id === p.from.level, l.name, T("learn.words", { n: G.WordBank.count(l.id) }), true)).join("");
        $("learn-topics").innerHTML = G.WORD_TOPICS.filter((t) => topicCount[t]).map((t) => opt("topic", t, p.from.topic === t, G.topicLabel(t), T("learn.words", { n: topicCount[t] }), true)).join("");
        box.querySelectorAll("[data-preset]").forEach((b) => { b.onclick = () => { p.preset = b.dataset.preset; render(); }; });
        box.querySelectorAll("[data-clue]").forEach((b) => { b.onclick = () => { p.clue = b.dataset.clue; render(); }; });
        box.querySelectorAll("[data-answer]").forEach((b) => { b.onclick = () => { p.answer = b.dataset.answer; render(); }; });
        box.querySelectorAll("[data-level]").forEach((b) => { b.onclick = () => { p.from = { level: +b.dataset.level }; render(); }; });
        box.querySelectorAll("[data-topic]").forEach((b) => { b.onclick = () => { p.from = { topic: b.dataset.topic }; render(); }; });
      };
      render();
      $("btn-learn-start").onclick = () => this.startPicked();
      $("btn-learn-cancel").onclick = () => this.closePicker();
      box.classList.remove("hidden");
      G.Modal.open("learnpick", { keys: (e) => {
        if (e.code === "Escape") { this.closePicker(); return true; }
        if (e.code === "Enter" && !(document.activeElement && document.activeElement.closest && document.activeElement.closest("#learn-pick .learn-opt"))) { this.startPicked(); return true; }
        return false;
      } });
      setTimeout(() => { if (G.Input.mode !== "touch") $("btn-learn-start").focus({ preventScroll: true }); }, 0);
    },
    closePicker() { $("learn-pick").classList.add("hidden"); G.Modal.close("learnpick"); },
    // the mode picked: a preset's id, or "custom:clue+answer"
    pickedMode() { const p = this._pick; return p.preset === "custom" ? G.Learn.customId(p.clue, p.answer) : p.preset; },
    startPicked() {
      const mode = this.pickedMode(), from = this._pick.from;
      this.closePicker();
      this.launch(this.learn(mode, from));
    },
    // ---------------- the spelling intro ----------------
    // o: { spell: the spelling lines, preset: a mode's own lines }
    openIntro(dev, go, o) {
      o = o || { spell: true };
      const keys = { replay: G.keyLabel(G.save.settings.keybinds.replay), thai: G.keyLabel(G.save.settings.keybinds.thaiHint) };
      const lines = (o.preset ? ["1", "2"].map((n) => T("study.mode." + o.preset + "." + n, keys)) : [])
        .concat(o.spell ? ["1", "2", "3", "4"].map((n) => T("study.intro." + dev + "." + n)) : []);
      $("study-intro-title").textContent = o.preset ? (o.title || G.Learn.label(o.preset)) + (o.spell ? " · " + T("study.introTitle") : "") : T("study.introTitle");
      $("study-intro-text").innerHTML = lines.map((l) => `<li>${esc(l)}</li>`).join("");
      $("study-intro").classList.remove("hidden");
      const start = () => { $("study-intro").classList.add("hidden"); G.Modal.close("studyintro"); go(); };
      $("btn-intro-start").onclick = start;
      G.Modal.open("studyintro", { keys: (e) => { if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") { start(); return true; } return true; } });
      setTimeout(() => { if (G.Input.mode !== "touch") $("btn-intro-start").focus({ preventScroll: true }); }, 0);
    },
  };
})();
