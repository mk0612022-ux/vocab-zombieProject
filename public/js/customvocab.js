// ============================================================
// CUSTOM VOCABULARY: words the player adds to a level's word list
// ------------------------------------------------------------
// Stored in the save (G.save.customWords = {level1: [[word, meaning], ...],
// ...}), so they go wherever the save goes, Export Save included. A level's
// word list (G.WORD_SETS[key].words) is its built-in words followed by these.
// A word may carry optional fields as a third item, [word, meaning,
// {definition, synonyms, example, collocations, topic, pos, wl, ml}]
// (G.cleanCustomExtra); modes that need a field a word does not have skip
// that word (G.WordBank.has).
//
// (Round 3, H5) Each word has its languages: wl the word's, ml the meaning's
// (none given: English and Thai, as every word from before languages). A
// word is in the game only while the player's Word and Meaning Language are
// that pair -- or the reverse, when it is asked the other way round
// (G.CustomVocab.current).
//
// Rules, for a word typed in and for every row of an imported CSV alike:
//   - neither field empty; spaces at either end are dropped
//   - the word is written in its language: English A-Z, French with its
//     accents, Chinese characters, Thai script (hyphens, apostrophes or
//     single spaces between words: "well-being", "give up")
//   - the meaning is written in its language
//   - the word must not already be ANYWHERE in the game in that language,
//     built-in or added, in any level, ignoring capitals -- in English that
//     includes every form of a word-bank family and its regular endings
//     ("analysis", "analysed" belong to analyse). The player is told where
//     it already is and nothing is saved
//   - a meaning identical to another word's in the same level is saved
//     with a warning: two zombies asking for the same meaning at once would
//     be a coin toss, so the game never has both on the field together
//     (see Game.spawnZombieAt)
// ============================================================
window.G = window.G || {};

G.CustomVocab = {
  LEVEL_KEYS: ["level1", "level2", "level3"],
  EN_RE: /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/,
  THAI_RE: new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]"),
  // (round 3) how each language's words are written
  WORD_RE: {
    en: /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/,
    fr: /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0152\u0153]+(?:[ '\u2019\-][A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0152\u0153]+)*$/,
    zh: /^[\u3400-\u4DBF\u4E00-\u9FFF]+$/,
    th: /^[\u0E00-\u0E7F]+(?: [\u0E00-\u0E7F]+)*$/,
  },
  // what a meaning must have in it
  MEANING_RE: { en: /[A-Za-z]/, fr: /[A-Za-z\u00C0-\u00FF]/, zh: /[\u3400-\u9FFF]/, th: /[\u0E00-\u0E7F]/ },
  MAX_WORD: { en: 32, fr: 32, zh: 12, th: 40 },

  store() {
    const s = G.save.customWords || (G.save.customWords = {});
    this.LEVEL_KEYS.forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    return s;
  },
  list(key) { return this.store()[key] || []; },
  builtin(key) { return { level1: G.WORDS_LEVEL_1, level2: G.WORDS_LEVEL_2, level3: G.WORDS_LEVEL_3 }[key] || []; },
  levelName(key) { const l = G.LEVELS.find((x) => x.wordsKey === key); return l ? l.name : key; },
  count() { return this.LEVEL_KEYS.reduce((n, k) => n + this.list(k).length, 0); },
  // a stored word's languages
  langsOf(p) { const x = p && p[2]; return x && x.wl && x.ml ? { wl: x.wl, ml: x.ml } : { wl: "en", ml: "th" }; },

  // (round 3) a level's own words as the game uses them now: those of the
  // player's Word > Meaning pair as they are, those of the reverse pair the
  // other way round; the rest are kept but not in play. Built again only
  // when the words or the languages change.
  _v: 0, _cache: {},
  invalidate() { this._v++; this._cache = {}; },
  current(key) {
    const list = this.list(key), sig = G.Lang.built + "|" + this._v + "|" + list.length;
    const c = this._cache[key];
    if (c && c.sig === sig && c.save === G.save) return c.out;
    const wl = G.Lang.word(), ml = G.Lang.meaning(), out = [];
    list.forEach((p) => {
      const L = this.langsOf(p);
      let q = null;
      if (L.wl === wl && L.ml === ml) q = p.length > 2 ? [p[0], p[1], p[2]] : [p[0], p[1]];
      else if (L.wl === ml && L.ml === wl) {
        // (asked the other way round: only its part of speech goes with it)
        q = [p[1], p[0]];
        if (p[2] && p[2].pos) q.push({ pos: p[2].pos });
        q.rev = true;
      }
      if (!q) return;
      q.wl = wl; q.ml = ml; q.custom = true;
      out.push(q);
    });
    this._cache[key] = { sig, save: G.save, out };
    return out;
  },
  allCurrent() { return [].concat(...this.LEVEL_KEYS.map((k) => this.current(k))); },

  clean(s) { return String(s || "").trim().replace(/\s+/g, " "); },
  cleanEn(s) { return this.clean(s); },
  cleanTh(s) { return this.clean(s); },

  // null when fine, else the reason (a strings key); `L` the languages ({wl, ml}, English > Thai if none)
  checkFields(w, m, L) {
    L = L || { wl: "en", ml: "th" };
    if (!w || !m) return "cv.errEmpty";
    if (L.wl === L.ml) return "cv.errSameLang";
    if (w.length > (this.MAX_WORD[L.wl] || 32) || m.length > 80) return "cv.errLong";
    if (!(this.WORD_RE[L.wl] || this.EN_RE).test(w)) return "cv.errLetters." + L.wl;
    if (!(this.MEANING_RE[L.ml] || this.THAI_RE).test(m)) return "cv.errMeaning." + L.ml;
    return null;
  },
  // where a word already is: {key, custom, family?} or null -- `family` is
  // the headword when the word is another form of a bank family (English).
  // `skip` is the entry being edited, {key, index}, which must not count
  // against itself. `wl` the word's language (English if none).
  findWord(word, skip, wl) {
    wl = wl || "en";
    const w = word.toLowerCase();
    const owner = wl === "en" ? G.WordBank.familyOf(w) : G.WordBank.byText(w, wl);
    if (owner) return { key: "level" + owner.level, custom: false, family: wl !== "en" || owner.headword.toLowerCase() === w ? null : owner.headword };
    for (const key of this.LEVEL_KEYS) {
      const i = this.list(key).findIndex((p) => { const L = this.langsOf(p); return (L.wl === wl && p[0].toLowerCase() === w) || (L.ml === wl && p[1].toLowerCase() === w); });
      if (i >= 0 && !(skip && skip.key === key && skip.index === i)) return { key, custom: true };
    }
    return null;
  },
  // other words in the level with exactly this meaning (in the meaning's language)
  sameMeaning(m, key, skip, L) {
    L = L || { wl: "en", ml: "th" };
    const out = [];
    G.WordBank.entries(G.WordBank.LEVEL_KEYS[key]).forEach((e) => { if (G.Lang.text(e, L.ml).trim() === m) out.push(G.Lang.text(e, L.wl)); });
    this.list(key).forEach((p, i) => {
      const P = this.langsOf(p);
      if (P.wl === L.wl && P.ml === L.ml && p[1].trim() === m && !(skip && skip.key === key && skip.index === i)) out.push(p[0]);
    });
    return out;
  },
  // the optional fields with the word's languages in them (none for English > Thai)
  withLangs(extra, L) {
    const x = Object.assign({}, extra || {});
    if (L && !(L.wl === "en" && L.ml === "th")) { x.wl = L.wl; x.ml = L.ml; } else { delete x.wl; delete x.ml; }
    // (a definition, synonyms, an example and collocations are English: kept for an English word only)
    if (L && L.wl !== "en") ["definition", "synonyms", "example", "collocations"].forEach((f) => { delete x[f]; });
    return G.cleanCustomExtra(x);
  },

  // add, or with `edit` ({key, index}) change an existing entry. `extra` is
  // the optional fields ({definition, synonyms, example, collocations, topic,
  // pos}); `L` the languages ({wl, ml}; English > Thai if none).
  // -> { ok, error?, dupWhere?, warnSame? }
  save(wRaw, mRaw, key, edit, extra, L) {
    L = L || { wl: "en", ml: "th" };
    const w = this.clean(wRaw), m = this.clean(mRaw);
    const err = this.checkFields(w, m, L);
    if (err) return { ok: false, error: err };
    if (!this.LEVEL_KEYS.includes(key)) return { ok: false, error: "cv.errLevel" };
    const dup = this.findWord(w, edit, L.wl);
    if (dup) return { ok: false, error: "cv.errDup", dupWhere: dup, word: w };
    const same = this.sameMeaning(m, key, edit, L);
    const store = this.store();
    const x = this.withLangs(extra, L);
    const entry = x ? [w, m, x] : [w, m];
    if (edit && edit.key === key) store[key][edit.index] = entry;
    else {
      if (edit) store[edit.key].splice(edit.index, 1);        // moved to another level
      store[key].push(entry);
    }
    this.invalidate();
    G.persist();
    return { ok: true, word: w, key, warnSame: same };
  },
  remove(key, index) {
    const list = this.list(key);
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    this.invalidate();
    G.persist();
  },

  // A whole file into one level, every row through the same checks -- the
  // file's own repeats included. `L` the languages of its words (the Custom
  // Vocabulary page's; English > Thai if none).
  // -> { added: [word], dupes: [{en, key}], invalid: [{en, reason}], sameMeaning: [word] }
  importPairs(pairs, key, L) {
    L = L || { wl: "en", ml: "th" };
    const res = { added: [], dupes: [], invalid: [], sameMeaning: [] };
    const seenInFile = new Set();
    (pairs || []).forEach((p) => {
      const w = this.clean(p[0]), m = this.clean(p[1]);
      const err = this.checkFields(w, m, L);
      if (err) { res.invalid.push({ en: w || "?", reason: err }); return; }
      const lower = w.toLowerCase();
      if (seenInFile.has(lower)) { res.dupes.push({ en: w, key: null }); return; }
      seenInFile.add(lower);
      const dup = this.findWord(w, null, L.wl);
      if (dup) { res.dupes.push({ en: w, key: dup.key }); return; }
      if (this.sameMeaning(m, key, null, L).length) res.sameMeaning.push(w);
      const x = this.withLangs(p[2], L);
      this.store()[key].push(x ? [w, m, x] : [w, m]);
      res.added.push(w);
    });
    if (res.added.length) { this.invalidate(); G.persist(); }
    return res;
  },
  // A practice set keeps game words on purpose (that is what it is for), so
  // only broken rows and the file's own repeats are dropped. (Round 3: its
  // words are in the languages `L` -- the player's when it was imported.)
  cleanPracticeSet(pairs, L) {
    const res = { words: [], dupes: [], invalid: [] };
    const seen = new Set();
    (pairs || []).forEach((p) => {
      const w = this.clean(p[0]), m = this.clean(p[1]);
      const err = this.checkFields(w, m, L);
      if (err) { res.invalid.push({ en: w || "?", reason: err }); return; }
      if (seen.has(w.toLowerCase())) { res.dupes.push({ en: w, key: null }); return; }
      seen.add(w.toLowerCase());
      res.words.push([w, m]);
    });
    return res;
  },
};

// A level's full word list: built-in, then the player's own (those in the
// languages chosen, round 3).
G.levelWords = function (key) {
  return G.CustomVocab.builtin(key).concat(G.save ? G.CustomVocab.current(key) : []);
};

// ---------------- the page ----------------
G.CustomVocabUI = {
  returnTo: "screen-mainmenu",
  tab: "level1",
  editing: null,
  armDelete: null,

  open(returnTo) {
    this.returnTo = returnTo || "screen-mainmenu";
    this.cancelEdit();
    this.showExtra(false);
    this.showMsg("", "");
    this.render();
    // (round 3) a new word starts in the player's own pair of languages
    document.getElementById("cv-wl").value = G.Lang.word(); document.getElementById("cv-ml").value = G.Lang.meaning();
    this.langsChanged();
    G.UI.showScreen("screen-customvocab");
  },
  bind() {
    const $ = (id) => document.getElementById(id);
    $("btn-cv-back").onclick = () => { if (this.returnTo === "screen-settings") { G.UI.renderSettings(); } G.UI.showScreen(this.returnTo); };
    $("cv-save").onclick = () => this.submit();
    $("cv-cancel").onclick = () => { this.cancelEdit(); this.showMsg("", ""); };
    $("cv-import").onclick = () => G.UI.openImport("screen-customvocab", $("cv-level").value);
    $("cv-more").onclick = () => this.showExtra($("cv-extra").classList.contains("hidden"));
    // (round 3, H5) the word's and the meaning's languages: never the same one
    $("cv-wl").onchange = () => { if ($("cv-ml").value === $("cv-wl").value) $("cv-ml").value = G.LANGS.find((l) => l !== $("cv-wl").value && l === G.Lang.meaning()) || G.LANGS.find((l) => l !== $("cv-wl").value); this.langsChanged(); };
    $("cv-ml").onchange = () => { if ($("cv-ml").value === $("cv-wl").value) $("cv-wl").value = G.LANGS.find((l) => l !== $("cv-ml").value && l === G.Lang.word()) || G.LANGS.find((l) => l !== $("cv-ml").value); this.langsChanged(); };
    // (an IME's Enter chooses a character: it does not add the word)
    ["cv-en", "cv-th", "cv-def", "cv-syn", "cv-col", "cv-ex"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); this.submit(); } }));
    $("cv-list").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const idx = parseInt(b.dataset.idx, 10);
      if (b.dataset.act === "edit") this.startEdit(this.tab, idx);
      if (b.dataset.act === "del") {
        // two taps: the first arms it, the second (within 4 s) deletes
        if (this.armDelete && this.armDelete.key === this.tab && this.armDelete.index === idx) {
          const w = G.CustomVocab.list(this.tab)[idx];
          G.CustomVocab.remove(this.tab, idx);
          this.armDelete = null;
          if (this.editing && this.editing.key === this.tab) this.cancelEdit();
          this.showMsg(G.T("cv.deleted", { w: w ? w[0] : "" }), "ok");
          this.render();
        } else {
          this.armDelete = { key: this.tab, index: idx };
          clearTimeout(this._armT);
          this._armT = setTimeout(() => { this.armDelete = null; this.renderList(); }, 4000);
          this.renderList();
        }
      }
    });
  },
  render() {
    const $ = (id) => document.getElementById(id);
    const sel = $("cv-level");
    const keep = sel.value || this.tab;
    sel.innerHTML = G.CustomVocab.LEVEL_KEYS.map((k) => `<option value="${k}">${G.CustomVocab.levelName(k)}</option>`).join("");
    sel.value = keep;
    // (new series, round 2, G) its part of speech: one, or the two the bank
    // pairs most (noun and verb, noun and adjective)
    const ps = $("cv-pos"), keepPos = ps.value;
    ps.innerHTML = `<option value="">${G.T("cv.posNone")}</option>` + G.POS.ORDER.concat(["n/v", "n/adj", "v/adj"]).map((c) =>
      `<option value="${c}">${G.escapeHtml(G.POS.abbr(c) + " " + G.POS.name(c))}</option>`).join("");
    ps.value = keepPos;
    const tp = $("cv-topic"), keepTopic = tp.value;
    tp.innerHTML = `<option value="">${G.T("cv.topicNone")}</option>` + G.WORD_TOPICS.map((t) => `<option value="${G.escapeHtml(t)}">${G.escapeHtml(G.topicLabel(t))}</option>`).join("");
    tp.value = keepTopic;
    // (round 3) the two languages, each in its own language; the player's pair to start with
    const opts = G.LANGS.map((l) => `<option value="${l}" lang="${G.Lang.TAG[l]}">${G.escapeHtml(G.Lang.NAMES[l])}</option>`).join("");
    ["cv-wl", "cv-ml"].forEach((id, i) => {
      const s = $(id), keepL = s.value;
      s.innerHTML = opts;
      s.value = keepL || (i ? G.Lang.meaning() : G.Lang.word());
    });
    this.langsChanged();
    const tabs = $("cv-tabs");
    tabs.innerHTML = G.CustomVocab.LEVEL_KEYS.map((k) =>
      `<button class="tab-btn ${k === this.tab ? "active" : ""}" data-key="${k}">${G.CustomVocab.levelName(k)} (${G.CustomVocab.list(k).length})</button>`).join("");
    tabs.querySelectorAll(".tab-btn").forEach((t) => (t.onclick = () => { this.tab = t.dataset.key; this.armDelete = null; this.render(); }));
    this.renderList();
  },
  renderList() {
    const list = G.CustomVocab.list(this.tab);
    const esc = G.escapeHtml;
    document.getElementById("cv-list").innerHTML = list.length
      ? list.map((p, i) => {
        const armed = this.armDelete && this.armDelete.key === this.tab && this.armDelete.index === i;
        const editing = this.editing && this.editing.key === this.tab && this.editing.index === i;
        const has = p[2] ? ["definition", "synonyms", "example", "collocations", "topic"].filter((f) => p[2][f]).map((f) => G.T("cv.has." + f)) : [];
        const note = has.length ? `<span class="cv-extra-note">+ ${esc(has.join(", "))}</span>` : "";
        // (round 3) its languages; dimmed while they are not the player's pair (or its reverse)
        const L = G.CustomVocab.langsOf(p), wl = G.Lang.word(), ml = G.Lang.meaning();
        const live = (L.wl === wl && L.ml === ml) || (L.wl === ml && L.ml === wl);
        const tagged = Object.assign([p[0], p[1], p[2]], { wl: L.wl, ml: L.ml, custom: true });
        const langs = `<span class="cv-langs${live ? "" : " off"}" title="${esc(live ? "" : G.T("cv.notInPlay"))}">${L.wl.toUpperCase()} → ${L.ml.toUpperCase()}</span>`;
        return `<div class="cv-row${editing ? " editing" : ""}${live ? "" : " cv-off"}"><div class="cv-word">${langs}<b${G.Lang.attr(L.wl)}>${esc(p[0])}${G.POS.tag(tagged)}</b><span${G.Lang.attr(L.ml)}>${esc(p[1])}</span>${note}</div>
          <div class="cv-actions"><button class="btn" data-act="edit" data-idx="${i}">${G.T("cv.edit")}</button>
          <button class="btn${armed ? " danger" : ""}" data-act="del" data-idx="${i}">${G.T(armed ? "cv.confirmDelete" : "cv.delete")}</button></div></div>`;
      }).join("")
      : `<div class="cv-empty">${G.T("cv.empty", { level: G.CustomVocab.levelName(this.tab) })}</div>`;
  },
  startEdit(key, index) {
    const p = G.CustomVocab.list(key)[index];
    if (!p) return;
    this.editing = { key, index };
    const $ = (id) => document.getElementById(id);
    $("cv-en").value = p[0]; $("cv-th").value = p[1]; $("cv-level").value = key;
    const L = G.CustomVocab.langsOf(p);
    $("cv-wl").value = L.wl; $("cv-ml").value = L.ml;
    this.langsChanged();
    this.fillExtra(p[2]);
    // (its part of speech sits in the main row: "More" opens for the rest)
    this.showExtra(!!p[2] && ["definition", "synonyms", "example", "collocations", "topic"].some((f) => p[2][f]));
    $("cv-save").textContent = G.T("cv.saveChanges");
    $("cv-cancel").classList.remove("hidden");
    this.showMsg(G.T("cv.editing", { w: p[0] }), "");
    this.renderList();
    $("cv-en").focus();
  },
  cancelEdit() {
    this.editing = null;
    const $ = (id) => document.getElementById(id);
    $("cv-en").value = ""; $("cv-th").value = "";
    this.fillExtra(null);
    $("cv-save").textContent = G.T("cv.add");
    $("cv-cancel").classList.add("hidden");
    if (document.getElementById("cv-list").children.length) this.renderList();
  },
  submit() {
    const $ = (id) => document.getElementById(id);
    const key = $("cv-level").value;
    const r = G.CustomVocab.save($("cv-en").value, $("cv-th").value, key, this.editing, this.readExtra(), this.langs());
    if (!r.ok) {
      const d = r.dupWhere;
      const msg = r.error === "cv.errDup"
        ? G.T(d.custom ? "cv.errDupCustom" : d.family ? "cv.errDupFamily" : "cv.errDup", { w: r.word, family: d.family || "", level: G.CustomVocab.levelName(d.key) })
        : G.T(r.error);
      this.showMsg(msg, "error");
      return;
    }
    const wasEdit = !!this.editing;
    this.tab = key;
    this.cancelEdit();
    let msg = G.T(wasEdit ? "cv.updated" : "cv.added", { w: r.word, level: G.CustomVocab.levelName(key) });
    let kind = "ok";
    if (r.warnSame.length) { msg += " " + G.T("cv.warnSame", { others: r.warnSame.join(", ") }); kind = "warn"; }
    this.showMsg(msg, kind);
    this.render();
    $("cv-en").focus();
  },
  // (round 3, H5) the languages chosen on the form
  langs() {
    const $ = (id) => document.getElementById(id);
    const wl = $("cv-wl").value || G.Lang.word(), ml = $("cv-ml").value || G.Lang.meaning();
    return { wl, ml };
  },
  // the inputs follow them: the right lang (an IME, a font, a spell-checker),
  // and the English-only fields (definition, synonyms, example, collocations)
  // only for an English word
  langsChanged() {
    const $ = (id) => document.getElementById(id);
    if (!$("cv-wl") || !$("cv-wl").value) return;
    const L = this.langs();
    $("cv-en").lang = G.Lang.TAG[L.wl]; $("cv-th").lang = G.Lang.TAG[L.ml];
    $("cv-en").maxLength = G.CustomVocab.MAX_WORD[L.wl] || 32;
    document.getElementById("cv-extra").classList.toggle("cv-noen", L.wl !== "en");
    const note = $("cv-langnote");
    if (note) {
      const wl = G.Lang.word(), ml = G.Lang.meaning();
      const live = (L.wl === wl && L.ml === ml) || (L.wl === ml && L.ml === wl);
      note.textContent = live ? "" : G.T("cv.langNote", { pair: G.Lang.label(L.wl) + " → " + G.Lang.label(L.ml) });
    }
  },
  // the optional fields: open/closed, read, filled in
  showExtra(open) {
    document.getElementById("cv-extra").classList.toggle("hidden", !open);
    const b = document.getElementById("cv-more");
    b.textContent = G.T(open ? "cv.less" : "cv.more");
    b.setAttribute("aria-expanded", open ? "true" : "false");
  },
  readExtra() {
    const v = (id) => document.getElementById(id).value;
    return { definition: v("cv-def"), synonyms: v("cv-syn"), example: v("cv-ex"), collocations: v("cv-col"), topic: v("cv-topic"), pos: v("cv-pos") };
  },
  fillExtra(x) {
    x = x || {};
    const set = (id, val) => { document.getElementById(id).value = val || ""; };
    set("cv-def", x.definition); set("cv-syn", (x.synonyms || []).join(", ")); set("cv-ex", x.example);
    set("cv-col", (x.collocations || []).join(", ")); set("cv-topic", x.topic); set("cv-pos", x.pos);
  },
  showMsg(text, kind) {
    const el = document.getElementById("cv-msg");
    el.textContent = text;
    el.className = "cv-msg" + (kind ? " " + kind : "");
  },
};

G.escapeHtml = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};
