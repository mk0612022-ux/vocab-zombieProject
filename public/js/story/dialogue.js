// ===================================================================
// Story Mode's dialogue (story series, round 2): the characters' lines,
// their subtitles at three levels, the words in them, and the choices
// -------------------------------------------------------------------
// The lines are English -- an English Program school, and Kru Min's
// English-only rule: the text under a line's key in js/strings.js. Its
// subtitle is the same key in the menus' language (strings-th/zh/fr.js),
// at one of three levels (Settings > Language, or the button on the box):
//   full  the whole line translated
//   key   only the chapter's words, each with its meaning
//   en    English only
// (the menus in English: English only). Every word the Master Word Bank
// has, in any form, can be tapped for its mini card -- a look, not a review
// (js/vocabcard.js); the chapter's own words are bold.
//
//   G.StoryDialogue.say([{ who, line, vars }, ...])   lines, queued (a bare key: no speaker)
//   G.StoryDialogue.ask({ who, line, options: [{ text, value, right }], quiz }, done)
//       a choice of 1-3 in G.Dialog's window (keys 1-3, the controller, a tap). quiz:
//       { word, practice, kind: "meaning" | "cloze" } -- the answer counts for the word as
//       any other (G.Learning.answerWord), unless it is one of the chapter's practice words
//   G.StoryDialogue.busy() / next() / clear()
// A line stays G.CONFIG.story.dialogue.minSec + perChar a letter. Held -- Space (the jump
// key), A, a finger on the box or on the jump button -- everything runs `fast` times as
// fast (the camera and the scene's waits too); a press shorter than tapSec is "next line".
// On a cinematic part the player has seen before, held for holdSkip it is skipped
// (js/story/scenes.js).
// ===================================================================
window.G = window.G || {};

G.StoryDialogue = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => G.CONFIG.story.dialogue;
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);
  const $ = (id) => document.getElementById(id);
  const LEVELS = ["full", "key", "en"];
  const WORD = /([A-Za-z]+(?:['’-][A-Za-z]+)*)|([^A-Za-z]+)/g;
  let el = null, hold = null, queue = [], cur = null, gapT = 0, hideT = 0;
  let down = false, downT = 0, touchDown = false, fastNow = false, lastTouch = 0, skipDone = false;

  // ---------------- the text ----------------
  function en(key, vars) { const s = G.STRINGS.en[key]; return s == null ? key : fill(s, vars); }
  function sub(key, vars) {
    if (G.lang === "en") return "";
    const s = (G.STRINGS[G.lang] || {})[key];
    return s == null ? "" : fill(s, vars);
  }
  const tag = () => (G.Lang && G.Lang.TAG ? G.Lang.TAG[G.lang] : G.lang);
  function level() { const l = G.save && G.save.settings.storySubs; return LEVELS.includes(l) ? l : "full"; }
  function setLevel(l) {
    if (!LEVELS.includes(l)) return;
    G.save.settings.storySubs = l;
    G.persist();
    if (cur) render();
    if (G.StoryPhone) G.StoryPhone.refresh();
  }
  function cycle() { setLevel(LEVELS[(LEVELS.indexOf(level()) + 1) % LEVELS.length]); }
  // the chapter's own words (entry ids): bold, and glossed at the "key" level
  function keyIds() { const r = G.Story && G.Story.run; return (r && r.keyIds) || new Set(); }
  const entryOf = (w) => (G.WordBank && (!G.Lang.enWord || G.Lang.enWord()) ? G.WordBank.familyOf(w.replace(/['’]s$/i, "")) : null);
  // English -> HTML: the bank's words a button (tap: the mini card), the chapter's bold.
  // In a button of its own (a choice) a word cannot be a button: { tap: false }
  function mark(text, opts) {
    const ids = keyIds(), tap = !opts || opts.tap !== false, out = [];
    let m;
    WORD.lastIndex = 0;
    while ((m = WORD.exec(text))) {
      if (m[2]) { out.push(esc(m[2])); continue; }
      const w = m[1], e = entryOf(w), key = !!e && ids.has(e.id);
      if (!e) out.push(esc(w));
      else if (tap) out.push(`<button type="button" class="sd-word${key ? " key" : ""}" data-id="${esc(e.id)}" data-form="${esc(w)}">${esc(w)}</button>`);
      else out.push(key ? `<b class="sd-key">${esc(w)}</b>` : esc(w));
    }
    return out.join("");
  }
  // the chapter's words in a line, each with its meaning in the menus' language
  function glosses(text) {
    const ids = keyIds(), seen = new Set(), out = [];
    (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).forEach((w) => {
      const e = entryOf(w);
      if (!e || !ids.has(e.id) || seen.has(e.id)) return;
      seen.add(e.id);
      const p = G.WordBank.pairOf(e, "en", G.lang);
      if (p && p[1]) out.push([w, p[1]]);
    });
    return out;
  }
  // the subtitle under a line (or a choice), as the level says
  function subText(key, vars, text) {
    const lv = level();
    if (lv === "en" || G.lang === "en") return null;
    if (lv === "full") { const s = sub(key, vars); return s ? { full: s } : null; }
    const g = glosses(text);
    return g.length ? { gloss: g } : null;
  }
  function subHtml(key, vars, text, cls) {
    const s = subText(key, vars, text);
    if (!s) return "";
    const inner = s.full ? esc(s.full) : s.gloss.map(([w, m]) => `<span class="sd-g"><b>${esc(w)}</b> = ${esc(m)}</span>`).join(" · ");
    return `<div class="${cls || "sd-sub"}${s.gloss ? " sd-gloss" : ""}" lang="${tag()}">${inner}</div>`;
  }
  const who = (id) => (id ? T("story.who." + id) : "");

  // ---------------- the box ----------------
  function peek(w) {
    const e = G.WordBank && G.WordBank.byId(w.dataset.id);
    if (e && G.VocabCard) G.VocabCard.peek(G.WordBank.pairOf(e), w.dataset.form, { freeze: true });
  }
  function ensure() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "story-dlg"; el.className = "story-dlg hidden";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = `<div class="sd-head"><span class="sd-who" id="sd-who"></span><button type="button" class="sd-lvl" id="sd-lvl"></button></div>`
      + `<div class="sd-line" id="sd-line"></div><div id="sd-subwrap"></div>`;
    document.body.appendChild(el);
    // a word: its card; the level button: the next level; anywhere else (a mouse): the next line
    el.addEventListener("click", (e) => {
      const w = e.target.closest(".sd-word");
      if (w) { peek(w); return; }
      if (e.target.closest("#sd-lvl")) { cycle(); return; }
      if (performance.now() - lastTouch < 700) return;      // (a tap is handled as a press, in update)
      if (cur) next();
    });
    el.addEventListener("touchstart", (e) => { lastTouch = performance.now(); if (!e.target.closest(".sd-word, #sd-lvl")) touchDown = true; }, { passive: true });
    const up = () => { touchDown = false; lastTouch = performance.now(); };
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", up, { passive: true });
    // what is held, and what holding does: faster, or (seen before) skip
    hold = document.createElement("div");
    hold.id = "story-hold"; hold.className = "story-hold hidden";
    hold.innerHTML = `<i class="sh-ring" id="sh-ring"></i><span id="sh-text"></span>`;
    document.body.appendChild(hold);
    // the words in a choice's question (G.Dialog's body) can be tapped too
    const db = $("dialog-body");
    if (db) db.addEventListener("click", (e) => { const w = e.target.closest(".sd-word"); if (w) peek(w); });
    return el;
  }
  function render() {
    ensure();
    const it = cur, text = en(it.line, it.vars);
    el.dataset.who = it.who || "";
    $("sd-who").textContent = who(it.who);
    $("sd-who").classList.toggle("hidden", !it.who);
    $("sd-line").innerHTML = mark(text);
    $("sd-subwrap").innerHTML = subHtml(it.line, it.vars, text);
    const lv = $("sd-lvl");
    lv.textContent = T("story.subs.short." + level());
    lv.setAttribute("aria-label", T("story.subs.title") + ": " + T("story.subs." + level()));
    lv.classList.toggle("hidden", G.lang === "en");
  }
  function show() {
    cur = queue.shift() || null;
    if (!cur) return;
    cur.t = 0;
    cur.dur = Math.min(C().maxSec, C().minSec + C().perChar * en(cur.line, cur.vars).length);
    render();
    el.classList.remove("hidden");
    beep([{ type: "sine", freq: 880, freqEnd: 990, dur: 0.06, gain: 0.025 }]);
  }
  function next() {
    cur = null;
    if (queue.length) gapT = C().gapSec;
    else hideT = 0.35;
  }
  function say(items) {
    ensure();
    [].concat(items || []).forEach((it) => queue.push(typeof it === "string" ? { line: it } : Object.assign({}, it)));
    if (!cur && gapT <= 0) show();
  }
  function busy() { return !!cur || queue.length > 0 || gapT > 0; }
  function clear() {
    queue = []; cur = null; gapT = 0;
    if (el) el.classList.add("hidden");
  }
  const beep = (list) => { const A = G.Audio; if (!A || !A.ctx || !A.group) return; A.group({ cat: "ui", prio: 1, pos: null, dur: 0.6 }, () => list.forEach((o) => A.tone(o))); };

  // ---------------- held, and a press ----------------
  function update(game, dt) {
    const I = G.Input;
    const now = !!((I.mode === "desktop" && I.isDown("jump")) || I.padJump || touchDown || I.touchJump);
    if (now) downT += dt;
    if (!now && down && downT < C().tapSec && cur) next();      // a short press: the next line
    if (!now) { downT = 0; skipDone = false; }
    down = now;
    fastNow = now && downT >= C().tapSec;
    // a cinematic part seen before: held long enough, skipped (once a press)
    const run = G.Story && G.Story.run;
    const canSkip = !!(run && G.StoryScenes && G.StoryScenes.canSkip(run));
    if (canSkip && now && !skipDone && downT >= C().holdSkip) { skipDone = true; G.StoryScenes.skip(game, run); }
    if (gapT > 0) { gapT -= dt; if (gapT <= 0) { gapT = 0; show(); } }
    if (cur) { cur.t += dt * (fastNow ? C().fast : 1); if (cur.t >= cur.dur) next(); }
    else if (el && !queue.length && gapT <= 0 && !el.classList.contains("hidden")) { hideT -= dt; if (hideT <= 0) el.classList.add("hidden"); }
    hint(canSkip);
  }
  // the hint at the corner: what holding would do, and how far it has got
  function hint(canSkip) {
    if (!hold) return;
    const camBusy = !!(G.StoryCam && G.StoryCam.busy());
    const on = !!cur || camBusy || canSkip;
    hold.classList.toggle("hidden", !on);
    if (!on) return;
    const I = G.Input, kb = G.save.settings.keybinds;
    const key = I.padActive ? "A" : I.mode === "touch" ? "" : G.keyLabel(kb.jump);
    const what = canSkip ? "skip" : "fast";
    $("sh-text").textContent = key ? T("story.hold." + what, { key }) : T("story.hold." + what + "Touch");
    const p = canSkip ? Math.min(1, downT / C().holdSkip) : fastNow ? 1 : 0;
    hold.style.setProperty("--p", p.toFixed(3));
    hold.classList.toggle("on", fastNow || p > 0);
  }
  function onKey(e) {
    if ((e.code === "Enter" || e.code === "NumpadEnter") && cur) { if (!e.repeat) next(); return true; }
    return false;
  }
  // while a line is up (or the camera turns) the jump key is the dialogue's (js/game.js)
  function holdsJump() { return !!cur || !!(G.StoryCam && G.StoryCam.busy()); }
  function fast() { return fastNow ? C().fast : 1; }

  // ---------------- a choice ----------------
  function optHtml(op) {
    const text = en(op.text, op.vars);
    return `<span class="sc-en">${mark(text, { tap: false })}</span>${subHtml(op.text, op.vars, text, "sc-sub")}`;
  }
  function ask(o, done) {
    ensure();
    const opts = (o.options || []).slice(0, 3);
    const qText = o.line ? en(o.line, o.vars) : "";
    const head = o.line ? `<div class="sc-q" data-who="${esc(o.who || "")}">${o.who ? `<span class="sd-who">${esc(who(o.who))}</span>` : ""}<div class="sd-line">${mark(qText)}</div>${subHtml(o.line, o.vars, qText)}</div>` : "";
    // (story round 7: a word question's answers bare -- no subtitle, no bold for the chapter's words,
    // no gloss at the "key words" level: any of them would give the answer away)
    const bare = (op) => `<span class="sc-en">${esc(en(op.text, op.vars))}</span>`;
    // (G.Dialog takes one class of its own: a word question's is its own one)
    G.Dialog.open({ cls: o.quiz ? "story-quiz-q" : "story-choice", title: "", body: head,
      buttons: opts.map((op, i) => ({ label: en(op.text, op.vars), html: o.quiz ? bare(op) : optHtml(op), action: () => picked(o, op, i, done) })) });
  }
  function picked(o, op, i, done) {
    if (o.quiz) {
      const right = !!op.right;
      const e = !o.quiz.practice && G.WordBank ? (G.WordBank.byId(o.quiz.word) || G.WordBank.familyOf(o.quiz.word)) : null;
      if (e) {
        const clue = o.quiz.kind === "cloze" ? "cloze" : "thai";
        G.Learning.answerWord(G.WordBank.pairOf(e), right, { recall: G.Learn.isRecall(clue, "shoot"), skills: G.Learning.skillsFor(clue, "shoot") });
        // (story round 7: and its card under the word box, as any answer has -- "✗ systems · ✓ symptom = ...")
        if (G.Explain && G.ExplainCard) {
          const ex = G.Explain.answer({ pair: G.WordBank.pairOf(e), form: o.quiz.form || null, right, clue, answer: "shoot", picked: right ? null : [en(op.text, op.vars), ""] });
          if (ex) G.ExplainCard.show(ex);
        }
      }
      if (G.Audio) G.Audio.sfx(right ? "correct" : "wrong");
    }
    if (done) done(i, op);
  }

  function reset() {
    clear();
    down = false; downT = 0; touchDown = false; fastNow = false; skipDone = false;
    if (hold) hold.classList.add("hidden");
  }

  return { say, ask, busy, next, clear, update, onKey, holdsJump, fast, level, setLevel, cycle, en, sub, mark, glosses, subText, subHtml, reset, ensure,
    get current() { return cur; }, get queued() { return queue.length; } };
})();
