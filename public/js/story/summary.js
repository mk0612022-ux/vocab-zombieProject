// ===================================================================
// A chapter's end (story series, round 10): the final test, then its summary
// -------------------------------------------------------------------
// The design's 1-8, steps 7 and 8:
//   the final test   six questions on the chapter's words -- the ones the player got wrong most often in
//                    this play-through first, then the others it asked, then the rest -- in the end-of-wave
//                    quiz's own window (js/quiz.js, each question one of the eight kinds by the word's box:
//                    js/questions.js). Every answer counts in its memory box as anywhere. Nothing is lost by a
//                    bad score: the summary comes after it either way.
//   the summary      the time the play-through took (its checkpoints and sittings added up), its accuracy,
//                    the test's score, the new words (first met in it) and the ones that got stronger (moved up
//                    a box: js/srs.js) -- each a word that can be tapped for its card -- and the collectibles
//                    found (story round 11 adds the rest of them and the achievements); then on to the next
//                    chapter (still to come: its button off) or the Main Menu. A G.Modal window ("story-summary",
//                    paused): keys (Enter, Escape), a tap, the controller (js/gamepad.js).
//   G.StorySummary.test(game, run, done(result))   the final test; result { correct, mistakes, n, missed }
//   G.StorySummary.show(game, { id, ch, d, found, test })   the summary
//   G.StorySummary.words(d)   { fresh, stronger } -- the play-through's new and stronger words, as pairs
//   G.StorySummary.close() / reset() / info()
// The play-through's words: G.Story.noteWord (its save's curWords). Numbers: G.CONFIG.story.summary.
// ===================================================================
window.G = window.G || {};

G.StorySummary = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.summary) || {};
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  let el = null, open = false, last = null, focusI = 0;

  // ---------------- the final test ----------------
  function questions(run) {
    const pool = (run && run.pool) || [], d = G.Story.data(run.id), cw = d.curWords || {};
    const key = (p) => G.wordKey(p);
    const missed = pool.filter((p) => cw[key(p)] && cw[key(p)][2] > 0).sort((a, b) => cw[key(b)][2] - cw[key(a)][2]);
    const met = G.shuffle(pool.filter((p) => cw[key(p)] && !(cw[key(p)][2] > 0)));
    const rest = G.shuffle(pool.filter((p) => !cw[key(p)]));
    const chosen = missed.concat(met, rest).slice(0, C().questions || 6);
    const base = pool.length >= 4 ? pool : G.getAllBuiltinWords();
    let prev = null;
    G.Questions._fi = 0;
    return chosen.map((pair) => { const type = G.Questions.pickType(pair, prev); prev = type; return G.Questions.build(pair, type, base); });
  }
  function test(game, run, done) {
    const qs = run ? questions(run) : [];
    if (!qs.length || !G.Quiz) { done(null); return; }
    const log = { story: run.id, asked: qs.map((q) => q.pair[0]), types: qs.map((q) => q.type) };
    last = { qs: qs.length, asked: log.asked.slice() };
    G.Quiz.open(game, () => {
      const res = { correct: G.Quiz.correct || 0, mistakes: G.Quiz.mistakes || 0, n: qs.length, missed: (G.Quiz.missed || []).map((p) => p[0]) };
      last.result = res;
      done(res);
    }, {
      qs, log, maxMistakes: qs.length, noFail: true, kicker: T("story.final.kicker", { n: run.ch.n }),
      verdict: { passed: "story.final.verdict", failed: "story.final.verdict", passedSub: "story.final.sub", failedSub: "story.final.sub", vars: { n: qs.length } },
      reviewTitle: "story.final.review",
    });
  }

  // ---------------- the play-through's words ----------------
  function pairOfKey(k) {
    const id = String(k).split("@")[0], e = G.WordBank && (G.WordBank.byId(id) || G.WordBank.lookup(id));
    return e ? G.WordBank.pairOf(e) : null;
  }
  function words(d) {
    const cw = (d && d.curWords) || {}, fresh = [], stronger = [];
    Object.keys(cw).forEach((k) => {
      const v = cw[k], p = pairOfKey(k);
      if (!p) return;
      if (v[0] === 0 && v[1] > 0) fresh.push(p);
      else if (v[0] > 0 && v[1] > v[0]) stronger.push(p);
    });
    return { fresh, stronger };
  }

  // ---------------- the window ----------------
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-summary-box"; el.className = "story-summary hidden";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "ssum-title");
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      const w = e.target.closest(".ssum-word");
      if (w) { const p = pairOfKey(w.dataset.k); if (p && G.VocabCard) G.VocabCard.peek(p, w.dataset.form || p[0], { freeze: false }); return; }
      const b = e.target.closest("[data-act]");
      if (b && !b.disabled) act(b.dataset.act);
    });
    return el;
  }
  const clock = (sec) => {
    const t = Math.max(0, Math.round(sec || 0)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
  };
  function chips(list, max) {
    const n = max || C().chips || 18, shown = list.slice(0, n);
    return shown.map((p) => `<button type="button" class="ssum-word" data-k="${esc(G.wordKey(p))}" lang="en" title="${esc(p[1])}">${esc(p[0])}</button>`).join("")
      + (list.length > n ? `<span class="ssum-more">${esc(T("story.sum.more", { n: list.length - n }))}</span>` : "");
  }
  function show(game, o) {
    const c = o.ch, d = o.d, run = G.Story.run;
    ensure();
    const total = (d.curRight || 0) + (d.curWrong || 0), acc = total ? Math.round(((d.curRight || 0) / total) * 100) : 0;
    const w = words(d), test = o.test;
    const list = c.collectibles || [], main = list.filter((x) => !x.extra), found = new Set(o.found || []);
    const have = new Set((d.collected || []).filter((id) => main.some((x) => x.id === id)));
    const next = c.next && G.Story.chapter(c.next);
    last = Object.assign(last || {}, { shown: true, time: d.curTime, acc, fresh: w.fresh.length, stronger: w.stronger.length, test: test || null, found: Array.from(found), have: have.size, of: main.length });
    const stat = (k, v, cls) => `<div class="ssum-stat${cls ? " " + cls : ""}"><b>${esc(v)}</b><span>${esc(T(k))}</span></div>`;
    el.innerHTML = `<div class="ssum-head"><div class="ssum-kicker">${esc(T("story.chapterN", { n: c.n }))}</div>`
      + `<h2 id="ssum-title">${esc(T(c.title))}</h2><div class="ssum-done">${esc(T("story.sum.done"))}</div></div>`
      + `<div class="ssum-stats">${stat("story.sum.time", clock(d.curTime))}${stat("story.sum.acc", acc + "%")}`
      + (test ? stat("story.sum.test", test.correct + " / " + test.n, test.correct >= test.n - 1 ? "good" : "") : "") + `</div>`
      + `<div class="ssum-sec"><div class="ssum-h">${esc(T("story.sum.new", { n: w.fresh.length }))}</div><div class="ssum-words">${w.fresh.length ? chips(w.fresh) : `<span class="ssum-none">${esc(T("story.sum.noNew"))}</span>`}</div></div>`
      + `<div class="ssum-sec"><div class="ssum-h">${esc(T("story.sum.stronger", { n: w.stronger.length }))}</div><div class="ssum-words">${w.stronger.length ? chips(w.stronger) : `<span class="ssum-none">${esc(T("story.sum.noStronger"))}</span>`}</div></div>`
      + `<div class="ssum-sec"><div class="ssum-h">${esc(T("story.sum.items", { n: have.size, of: main.length }))}</div><div class="ssum-items">`
      + list.map((x) => `<span class="ssum-item${found.has(x.id) ? " got" : have.has(x.id) ? " had" : ""}${x.extra ? " extra" : ""}" title="${esc(found.has(x.id) || have.has(x.id) ? T("story.item." + x.id) : T("story.sum.notFound"))}" aria-label="${esc(found.has(x.id) || have.has(x.id) ? T("story.item." + x.id) : T("story.sum.notFound"))}">${found.has(x.id) || have.has(x.id) ? x.icon : "?"}</span>`).join("")
      + `</div><div class="ssum-note">${esc(T("story.sum.itemsNote"))}</div></div>`
      + `<div class="ssum-btns">`
      + (next ? `<button type="button" class="btn ssum-next" data-act="next"${next.soon ? " disabled" : ""}>${esc(T(next.soon ? "story.sum.nextSoon" : "story.sum.next", { n: next.n, title: T(next.title) }))}</button>` : "")
      + `<button type="button" class="btn btn-primary ssum-menu" data-act="menu">${esc(T("story.menu"))}</button></div>`;
    if (!open) { G.Modal.open("story-summary", { pause: true, keys }); open = true; }
    el.classList.remove("hidden");
    if (G.Audio && G.Audio.sfx) G.Audio.sfx("unlock");
    focusI = 0;
    if (G.Input.mode !== "touch") setTimeout(() => { const b = el.querySelector(".ssum-menu"); if (b && open) b.focus({ preventScroll: true }); }, 0);
    if (G.Bus) G.Bus.emit("story:summary", { ch: o.id, time: d.curTime, acc, test: test || null });
  }
  function act(a) {
    if (a === "menu") { close(); G.Game.quitToMainMenu(); }
    else if (a === "next") {
      const run = G.Story.run, c = run && run.ch, next = c && c.next && G.Story.chapter(c.next);
      if (next && !next.soon) { close(); G.Story.start(next.id, null); }
    }
  }
  function keys(e) {
    if (!open) return false;
    if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
      const f = document.activeElement && el.contains(document.activeElement) && document.activeElement.dataset && document.activeElement.dataset.act ? document.activeElement : el.querySelector(".ssum-menu");
      if (f && !f.disabled) act(f.dataset.act);
      return true;
    }
    if (e.code === "Escape") { act("menu"); return true; }
    return true;
  }
  function close() {
    if (el) el.classList.add("hidden");
    if (open) { open = false; G.Modal.close("story-summary"); }
  }
  function reset() { close(); }
  function info() { return last ? Object.assign({ open }, last) : { open }; }

  return { test, show, words, close, reset, info, questions, get open() { return open; } };
})();
