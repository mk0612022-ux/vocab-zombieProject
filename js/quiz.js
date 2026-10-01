// ===================================================================
// The end-of-wave quiz (new series, round 1, A)
// -------------------------------------------------------------------
// After every wave, boss waves included, six questions on the words that
// wave brought -- the words on every zombie that came in it, a boss's
// minions too, and nothing else. Four right (two mistakes at most) and the
// shop opens; three mistakes and there is no shop: the next wave starts.
//
//   the words    G.Game.waveWords, noted as each zombie spawns; the spawner
//                gives every wave at least six different ones. With more than
//                six, the ones the player shot wrong this wave go first.
//   a question   four choices; Thai meaning -> English word and English word
//                -> Thai meaning in turn; the wrong choices are other words of
//                the level, never one meaning the same (vocabulary series
//                round 2: look-alikes for a word being learnt, clearly
//                different words for a new one -- js/distract.js). Fifteen seconds; out
//                of time is a mistake. The answer shows at once -- the right
//                one lit green, a wrong pick red -- then the next.
//   the window   a G.Modal window that pauses everything; "Correct: X/6" and
//                "Mistakes: X/2" all the while; at the end, passed or not and
//                the words missed. Keys 1-4 (weapon keys do nothing while it
//                is open), a tap or a click, or a controller's D-pad and A.
// Every answer goes into the long-term word statistics and the word's memory
// box (G.Learning.answerWord), so a word missed here comes up more often, and onto the run's list of
// words to review. The numbers are G.CONFIG.quiz (js/config.js).
// ===================================================================
(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const C = () => G.CONFIG.quiz;
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

  G.Quiz = {
    active: false,

    // ---- the words of a wave ----
    resetWave(game) { game.waveWords = []; game.waveMissed = new Set(); },
    noteWord(game, pair) {
      if (!game.waveWords) this.resetWave(game);
      if (!game.waveWords.some((p) => same(p[0], pair[0]))) game.waveWords.push([pair[0], pair[1]]);
    },
    noteMissed(game, word) { if (word && game.waveMissed) game.waveMissed.add(word.toLowerCase()); },
    usedThisWave(game, word) { return !!game.waveWords && game.waveWords.some((p) => same(p[0], word)); },

    // ---- the questions ----
    // six of the wave's words (the missed ones first), each with three wrong
    // choices from the level's words
    build(game) {
      const words = (game.waveWords || []).slice();
      const missed = G.shuffle(words.filter((p) => game.waveMissed && game.waveMissed.has(p[0].toLowerCase())));
      const rest = G.shuffle(words.filter((p) => !(game.waveMissed && game.waveMissed.has(p[0].toLowerCase()))));
      const chosen = missed.concat(rest).slice(0, C().questions);
      const pool = (game.wordPool && game.wordPool.length ? game.wordPool : G.getAllBuiltinWords());
      return chosen.map((pair, i) => {
        const kind = i % 2 === 0 ? "th2en" : "en2th";
        // (vocabulary series, round 2, E1) the wrong choices: look-alikes
        // for a word the player is getting to know, clearly different
        // words for a new one (js/distract.js)
        const picks = G.Distract.forChoices(pair, pool, 3);
        const opts = G.shuffle([pair].concat(picks));
        return { pair, kind, opts, choices: opts.map((p) => (kind === "th2en" ? p[0] : p[1])), answer: opts.indexOf(pair) };
      });
    },

    // ---- the window ----
    // done(passed) once the player has seen the result and pressed Continue
    open(game, done) {
      const qs = this.build(game);
      if (!qs.length) { done(true); return; }
      this.game = game; this.done = done;
      this.qs = qs; this.i = -1; this.correct = 0; this.mistakes = 0; this.missed = [];
      this.stage = "question"; this.t = 0; this.active = true;
      this.limit = C().seconds + (G.Perks.val("extra_time") || 0);   // (Extra Time adds to every word question)
      this.log = { wave: game.wave, words: (game.waveWords || []).map((p) => p[0]), asked: qs.map((q) => q.pair[0]), missedFirst: Array.from(game.waveMissed || []) };
      (G.Quiz.history = G.Quiz.history || []).push(this.log);
      if (G.Quiz.history.length > 30) G.Quiz.history.shift();
      G.Modal.open("quiz", { pause: true, keys: (e) => this.key(e) });
      const el = (id) => document.getElementById(id);
      el("quiz-kicker").textContent = T("quiz.kicker", { n: game.wave });
      el("quiz-q").classList.remove("hidden");
      el("quiz-result").classList.add("hidden");
      G.UI.showScreen("screen-quiz");
      this.next();
    },
    next() {
      this.i++;
      if (this.i >= this.qs.length) { this.finish(); return; }
      this.stage = "question"; this.t = 0;
      const q = this.qs[this.i], el = (id) => document.getElementById(id);
      el("quiz-progress").textContent = T("quiz.progress", { i: this.i + 1, n: this.qs.length });
      el("quiz-ask").textContent = T(q.kind === "th2en" ? "quiz.askEnglish" : "quiz.askThai");
      const pr = el("quiz-prompt");
      pr.textContent = q.kind === "th2en" ? q.pair[1] : q.pair[0];
      pr.lang = q.kind === "th2en" ? "th" : "en";
      pr.classList.toggle("en", q.kind !== "th2en");
      const box = el("quiz-choices");
      box.innerHTML = q.choices.map((c, k) => `<button class="quiz-choice${q.kind === "en2th" ? " th" : ""}" data-k="${k}" lang="${q.kind === "en2th" ? "th" : "en"}"><b>${k + 1}</b><span>${esc(c)}</span></button>`).join("");
      box.querySelectorAll(".quiz-choice").forEach((b) => { b.onclick = () => this.answer(parseInt(b.dataset.k, 10)); });
      el("quiz-feedback").textContent = "";
      el("quiz-feedback").className = "quiz-feedback";
      this.counters();
      this.timerBar();
      if (G.Input.mode !== "touch") setTimeout(() => { const b = box.querySelector(".quiz-choice"); if (b && this.active && this.stage === "question") b.focus({ preventScroll: true }); }, 0);
    },
    counters() {
      const el = (id) => document.getElementById(id);
      el("quiz-correct").textContent = T("quiz.correct", { x: this.correct, n: this.qs.length });
      el("quiz-mistakes").textContent = T("quiz.mistakes", { x: this.mistakes, n: C().maxMistakes });
      el("quiz-mistakes").classList.toggle("over", this.mistakes > C().maxMistakes);
    },
    timerBar() {
      const f = document.getElementById("quiz-timer-fill");
      if (!f) return;
      const left = Math.max(0, 1 - this.t / this.limit);
      f.style.transform = "scaleX(" + left.toFixed(3) + ")";
      f.classList.toggle("warn", this.limit - this.t <= 5);
    },
    // k: the choice picked, or -1 (out of time)
    answer(k) {
      if (!this.active || this.stage !== "question") return;
      const q = this.qs[this.i], right = k === q.answer, game = this.game;
      this.stage = "feedback"; this.t = 0;
      if (right) this.correct++;
      else { this.mistakes++; this.missed.push(q.pair); game.trackWrongWord(q.pair[0], q.pair[1]); }
      // its box (a recognition answer: box 3 at most), and a wrong pick is a
      // pair the player confuses (E2); the others shown count towards
      // letting such a pair go
      G.Learning.answerWord(q.pair, right, { picked: !right && k >= 0 ? q.opts[k] : null, inView: q.opts.filter((p) => p !== q.pair) });
      q.picked = k; q.right = right;
      const btns = document.querySelectorAll("#quiz-choices .quiz-choice");
      btns.forEach((b, i) => { b.disabled = true; b.classList.toggle("is-right", i === q.answer); b.classList.toggle("is-wrong", i === k && !right); });
      const fb = document.getElementById("quiz-feedback");
      const ans = q.kind === "th2en" ? q.pair[0] : q.pair[1];
      fb.textContent = right ? T("quiz.right") : k < 0 ? T("quiz.timeUp", { a: ans }) : T("quiz.wrong", { a: ans });
      fb.className = "quiz-feedback " + (right ? "ok" : "bad");
      G.Audio.sfx(right ? "correct" : "wrong");
      if ((G.save.settings.speechMode || "after") !== "off") G.Audio.speak(q.pair[0]);
      this.counters();
    },
    finish() {
      this.stage = "result";
      const passed = this.mistakes <= C().maxMistakes;
      this.passed = passed;
      this.log.correct = this.correct; this.log.mistakes = this.mistakes; this.log.passed = passed;
      const el = (id) => document.getElementById(id);
      el("quiz-q").classList.add("hidden");
      el("quiz-result").classList.remove("hidden");
      el("quiz-result").classList.toggle("fail", !passed);
      el("quiz-verdict").textContent = T(passed ? "quiz.passed" : "quiz.failed");
      el("quiz-verdict-sub").textContent = T(passed ? "quiz.passedSub" : "quiz.failedSub", { x: this.correct, n: this.qs.length });
      el("quiz-missed").innerHTML = this.missed.length
        ? `<div class="qm-title">${esc(T("quiz.review"))}</div>` + this.missed.map((p) => `<div class="qm-row"><b lang="en">${esc(p[0])}</b><span lang="th">${esc(p[1])}</span></div>`).join("")
        : `<div class="qm-none">${esc(T("quiz.noneMissed"))}</div>`;
      G.Audio.sfx(passed ? "unlock" : "wrong");
      this.counters();
      if (G.Input.mode !== "touch") setTimeout(() => { const b = el("btn-quiz-continue"); if (b && this.active) b.focus({ preventScroll: true }); }, 0);
    },
    close() {
      if (!this.active || this.stage !== "result") return;
      this.active = false;
      const done = this.done, passed = this.passed;
      this.done = null;
      G.UI.showScreen(null);
      // (the callback opens the shop first, so the mouse is not re-locked in between)
      try { if (done) done(passed); } finally { G.Modal.close("quiz"); }
    },

    // the quiz's own clock (the rest of the game is paused)
    update(dt) {
      if (!this.active) return;
      // (a phone turned upright: the "Rotate your device" card is over the
      // question, so its clock waits -- js/pwa.js)
      if (G.Modal.isOpen("rotate")) return;
      this.t += dt;
      if (this.stage === "question") {
        this.timerBar();
        if (this.t >= this.limit) this.answer(-1);
      } else if (this.stage === "feedback" && this.t >= C().feedback) this.next();
    },
    key(e) {
      const n = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
      if (this.stage === "question") { if (n) this.answer(+n[1] - 1); return true; }
      if (this.stage === "feedback") { if (e.code === "Enter" || e.code === "Space") this.next(); return true; }
      if (this.stage === "result" && (e.code === "Enter" || e.code === "Space" || e.code === "KeyE")) this.close();
      return true;
    },
    // leaving the run with it open
    reset() { this.active = false; this.done = null; },
  };

  if (!G.UI.ALL_SCREENS.includes("screen-quiz")) G.UI.ALL_SCREENS.push("screen-quiz");
  window.addEventListener("DOMContentLoaded", () => {
    const b = document.getElementById("btn-quiz-continue");
    if (b) b.onclick = () => G.Quiz.close();
  });
})();
