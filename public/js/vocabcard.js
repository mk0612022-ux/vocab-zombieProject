// ===================================================================
// The vocabulary card (vocabulary series, round 3, H2-H4)
// -------------------------------------------------------------------
//   card   everything about a word, from the Word Log: the headword, its
//          part of speech, syllables with the stressed one marked, its sound;
//          the Thai, the definition, synonyms; two example sentences (the
//          word marked, each can be heard); collocations and the family;
//          "Don't confuse with" (its confusables and the words the player
//          has taken for it, with their meanings); a spelling warning; the
//          topic, AWL sublist, its box and next review
//   mini   the word, one sentence, a collocation or two, its sound -- under
//          a wrong answer (the quiz, the boss's question, the locks, Daily
//          Review) and from a word marked in a story note
//   peek   the mini card in a window of its own (from a note): looking a
//          word up is not a review -- it moves no box
// All are G.Modal windows: mouse, touch, keys and a controller.
// (Round 3, H) The word and its meaning in the player's two languages
// (Chinese with its pinyin, a French noun with its gender) and the same
// word in the other two languages; the English parts -- syllables,
// definition, examples, collocations, family, look-alikes, spelling, AWL --
// only while English is the Word Language.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const $ = (id) => document.getElementById(id);
  // (a sentence is English: it is said in English; a word in its own language)
  const say = (w, text) => `<button class="vc-say" type="button" data-say="${esc(w)}"${text ? ' data-text data-lang="en"' : ""} aria-label="${esc(T(text ? "card.hearSentence" : "card.hear"))}">🔊</button>`;
  // a word for a "don't confuse" line: from the bank, the lexicon, or the player's own
  const describe = (w) => {
    const p = G.Distract.resolve(w);
    return p ? { w: G.Lang.html(p, 0), th: G.Lang.html(p, 1), pos: G.POS.tag(p), wa: G.Lang.attr(p, 0), ma: G.Lang.attr(p, 1) } : null;
  };
  // (round 3) the word in the languages that are neither the Word nor the Meaning Language
  const others = (pair, i) => {
    if (!i || i.custom || !i.id) return "";
    const wl = G.Lang.wl(pair), ml = G.Lang.ml(pair);
    const rows = G.LANGS.filter((l) => l !== wl && l !== ml).map((l) => {
      const p = G.WordBank.pairOf(i, l, l === "en" ? "th" : "en");
      return `<span class="vc-other-l"><small>${esc(G.Lang.label(l))}</small> <b${G.Lang.attr(l)}>${G.Lang.html(p, 0)}</b>${G.POS.tag(p)}</span>`;
    });
    return rows.length ? `<p class="vc-other">${rows.join("")}</p>` : "";
  };

  G.VocabCard = {
    // the word as the bank has it, or as the player added it
    info(pair) { return G.WordBank.info(pair) || { headword: pair[0], thai: pair[1] }; },

    cardHtml(pair) {
      const i = this.info(pair), C = G.Clues;
      const en = G.Lang.enWord(pair);
      const stress = C.stressHtml(pair);
      // (new series, round 2, G) its part of speech, as everywhere: (N./V.) --
      // a French noun with its gender, (N. f.)
      const pc = G.POS.of(pair), pg = G.POS.gender(pair);
      const pos = pc ? `<span class="vc-pos" title="${esc(G.POS.name(pc))}">(${esc(G.POS.abbr(pc, pg))})</span>` : "";
      const sec = (title, body) => body ? `<div class="vc-sec"><div class="vc-h">${esc(title)}</div>${body}</div>` : "";
      const examples = en ? (i.examples || []).map((s) => `<li>${C.markHtml(s, pair)} ${say(s, true)}</li>`).join("") : "";
      const colls = en ? (i.collocations || []).map((s) => `<li>${C.markHtml(s, pair)}</li>`).join("") : "";
      const fam = en ? C.family(pair) : [];
      const famRows = fam.length > 1 ? `<table class="vc-family">${fam.map((f) => `<tr><td lang="en">${esc(f.word)}</td><td title="${esc(f.pos ? G.POS.name(f.pos) : "")}">${esc(f.pos ? G.POS.abbr(f.pos) : "")}</td></tr>`).join("")}</table>` : "";
      // E2 + confusables: what it is not (the bank's confusables are English)
      const confused = G.SRS.confusedWith(pair).map(describe).filter(Boolean);
      const lex = en ? (i.confusables || []).map(describe).filter((d) => d && !confused.some((c) => c.w === d.w)) : [];
      const dont = confused.map((d) => `<li class="vc-mine"><b${d.wa}>${d.w}${d.pos}</b> <span${d.ma}>${d.th}</span> <span class="vc-tag">${esc(T("card.youConfused"))}</span></li>`)
        .concat(lex.map((d) => `<li><b${d.wa}>${d.w}${d.pos}</b> <span${d.ma}>${d.th}</span></li>`)).join("");
      const miss = en && (i.commonMisspellings || []).length ? `<p class="vc-warn">${esc(T("card.spelling", { w: i.headword || pair[0], x: i.commonMisspellings.join(", ") }))}</p>` : "";
      // its box and next review
      const st = G.SRS.state(pair);
      let mem = T("learn.boxNew");
      if (st) {
        const d = st.due - G.Clock.today();
        const when = T(d <= 0 ? "learn.dueToday" : d === 1 ? "learn.dueTomorrow" : "learn.dueIn", { n: d });
        mem = (st.b >= G.Learning.MASTERED ? T("learn.boxMastered") : T("learn.box", { n: st.b })) + " · " + T("learn.due", { when });
      }
      const meta = [i.topic ? G.topicLabel(i.topic) : "", en ? (i.awlSublist ? T("card.awl", { n: i.awlSublist }) : (i.source === "Topic" ? T("card.topicWord") : "")) : "", mem].filter(Boolean).map(esc).join(" · ");
      return `<div class="vc-head"><div class="vc-word"${G.Lang.attr(pair, 0)}>${G.Lang.html(pair, 0)}</div>${pos}${say(pair[0])}</div>
        ${stress ? `<div class="vc-stress" lang="en">${stress}</div>` : ""}
        <div class="vc-thai"${G.Lang.attr(pair, 1)}>${G.Lang.html(pair, 1)}</div>
        ${others(pair, i)}
        ${en && i.definition ? `<p class="vc-def" lang="en">${esc(i.definition)}</p>` : ""}
        ${en && (i.synonyms || []).length ? `<p class="vc-syn" lang="en"><span>${esc(T("card.synonyms"))}</span> ${esc(i.synonyms.join(", "))}</p>` : ""}
        ${sec(T("card.examples"), examples ? `<ul class="vc-list" lang="en">${examples}</ul>` : "")}
        ${sec(T("card.collocations"), colls ? `<ul class="vc-list vc-colls" lang="en">${colls}</ul>` : "")}
        ${sec(T("card.family"), famRows)}
        ${sec(T("card.dontConfuse"), dont ? `<ul class="vc-list">${dont}</ul>` : "")}
        ${miss}
        <div class="vc-meta">${meta}</div>`;
    },
    // H3: the right word in a few lines
    miniHtml(pair, opts) {
      opts = opts || {};
      const i = this.info(pair), C = G.Clues;
      const en = G.Lang.enWord(pair);
      const cz = en ? (i.examples || [])[0] : "";
      const colls = en ? (i.collocations || []).slice(0, 2) : [];
      const stress = C.stressHtml(pair);
      const head = en ? i.headword || pair[0] : pair[0];
      // (another form of the family: the syllables are the headword's, so they go with it)
      const other = opts.form && opts.form.toLowerCase() !== String(head).toLowerCase();
      const marks = other ? `<span class="vc-mini-from" lang="en">${esc(T("card.from", { w: head }))}${stress ? ` <span class="vc-stress">${stress}</span>` : ""}</span>`
        : stress ? `<span class="vc-stress" lang="en">${stress}</span>` : "";
      return `<div class="vc-mini">
        <div class="vc-mini-head"><b class="vc-mini-word"${G.Lang.attr(pair, 0)}>${other ? esc(opts.form) : G.Lang.html(pair, 0)}${other ? "" : G.POS.tag(pair)}</b>${marks}${say(other ? opts.form : pair[0])}<span class="vc-mini-th"${G.Lang.attr(pair, 1)}>${G.Lang.html(pair, 1)}</span></div>
        ${cz ? `<div class="vc-mini-ex" lang="en">${C.markHtml(cz, pair)}</div>` : ""}
        ${colls.length ? `<div class="vc-mini-col" lang="en">${colls.map((c) => C.markHtml(c, pair)).join(" · ")}</div>` : ""}
      </div>`;
    },
    // the sound buttons in something just drawn
    bind(root) {
      (root || document).querySelectorAll(".vc-say").forEach((b) => {
        b.onclick = (e) => { e.stopPropagation(); G.Audio.unlock && G.Audio.unlock(); G.Audio.speak(b.dataset.say, { text: b.hasAttribute("data-text"), lang: b.dataset.lang || undefined }); };
      });
    },

    // ---------------- the card window ----------------
    open(pair) {
      if (!pair) return;
      this.pair = pair;
      $("vocab-card-body").innerHTML = this.cardHtml(pair);
      $("vocab-card-body").scrollTop = 0;
      this.bind($("vocab-card-body"));
      $("vocab-card").classList.remove("hidden");
      $("btn-card-close").onclick = () => this.close();
      G.Modal.open("vocabcard", { keys: (e) => {
        if (e.code === "Escape" || e.code === "Enter" || e.code === "Backspace") { this.close(); return true; }
        if (e.code === G.save.settings.keybinds.replay || e.code === "KeyV") { G.Audio.speak(pair[0]); return true; }
        return true;
      } });
      setTimeout(() => { if (G.Input.mode !== "touch") $("btn-card-close").focus({ preventScroll: true }); }, 0);
    },
    close() {
      $("vocab-card").classList.add("hidden");
      G.Modal.close("vocabcard");
    },

    // ---------------- the peek (a word in a story note) ----------------
    peek(pair, form) {
      if (!pair) return;
      $("word-peek-body").innerHTML = this.miniHtml(pair, { form });
      this.bind($("word-peek-body"));
      $("word-peek").classList.remove("hidden");
      $("btn-peek-close").onclick = () => this.closePeek();
      $("btn-peek-card").onclick = () => { this.closePeek(); this.open(pair); };
      G.Modal.open("wordpeek", { keys: (e) => {
        if (e.code === "Escape" || e.code === "Backspace" || e.code === "Enter") { this.closePeek(); return true; }
        if (e.code === G.save.settings.keybinds.replay || e.code === "KeyV") { G.Audio.speak(form || pair[0]); return true; }
        return true;
      } });
      setTimeout(() => { if (G.Input.mode !== "touch") $("btn-peek-close").focus({ preventScroll: true }); }, 0);
    },
    closePeek() {
      $("word-peek").classList.add("hidden");
      G.Modal.close("wordpeek");
    },

    // ---------------- H4: the words of a level, marked in a story note ----------------
    // text (already escaped HTML) -> the words of the level's bank, any form,
    // as buttons that open the peek. Only text between tags is touched.
    markNote(html, levelKey) {
      const lv = G.WordBank.LEVEL_KEYS[levelKey];
      // (round 3: the notes are English -- their words are marked while English is the Word Language)
      if (!lv || !G.Lang.enWord()) return html;
      const own = new Set(G.WordBank.entries(lv).map((e) => e.id));
      // (an entity -- &amp; -- is passed over whole, never read as a word)
      return html.replace(/>([^<]+)</g, (m, text) => ">" + text.replace(/(&[a-z#0-9]+;)|([A-Za-z]+(?:-[A-Za-z]+)*)/gi, (all, ent, w) => {
        if (ent) return ent;
        const e = G.WordBank.familyOf(w);
        return e && own.has(e.id) ? `<button class="note-word" type="button" data-id="${esc(e.id)}" data-form="${esc(w)}">${w}</button>` : w;
      }) + "<");
    },
  };
})();
