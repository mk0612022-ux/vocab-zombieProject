// ============================================================
// CUSTOM VOCABULARY: words the player adds to a level's word list
// ------------------------------------------------------------
// Stored in the save (G.save.customWords = {level1: [[en, th], ...], ...}),
// so they go wherever the save goes, Export Save included. A level's word
// list (G.WORD_SETS[key].words) is its built-in words followed by these.
//
// Rules, for a word typed in and for every row of an imported CSV alike:
//   - neither field empty; spaces at either end are dropped
//   - the English word is letters A-Z (with hyphens, apostrophes or single
//     spaces between letters: "well-being", "give up")
//   - the Thai meaning has Thai in it
//   - the English word must not already be ANYWHERE in the game, built-in
//     or added, in any level, ignoring capitals -- the player is told where
//     it already is and nothing is saved
//   - a Thai meaning identical to another word's in the same level is saved
//     with a warning: two zombies asking for the same meaning at once would
//     be a coin toss, so the game never has both on the field together
//     (see Game.spawnZombieAt)
// ============================================================
window.G = window.G || {};

G.CustomVocab = {
  LEVEL_KEYS: ["level1", "level2", "level3"],
  EN_RE: /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/,
  THAI_RE: new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]"),

  store() {
    const s = G.save.customWords || (G.save.customWords = {});
    this.LEVEL_KEYS.forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    return s;
  },
  list(key) { return this.store()[key] || []; },
  builtin(key) { return { level1: G.WORDS_LEVEL_1, level2: G.WORDS_LEVEL_2, level3: G.WORDS_LEVEL_3 }[key] || []; },
  levelName(key) { const l = G.LEVELS.find((x) => x.wordsKey === key); return l ? l.name : key; },
  count() { return this.LEVEL_KEYS.reduce((n, k) => n + this.list(k).length, 0); },

  cleanEn(s) { return String(s || "").trim().replace(/\s+/g, " "); },
  cleanTh(s) { return String(s || "").trim().replace(/\s+/g, " "); },

  // null when fine, else the reason (a strings key)
  checkFields(en, th) {
    if (!en || !th) return "cv.errEmpty";
    if (en.length > 32) return "cv.errLong";
    if (!this.EN_RE.test(en)) return "cv.errLetters";
    if (th.length > 80) return "cv.errLong";
    if (!this.THAI_RE.test(th)) return "cv.errThai";
    return null;
  },
  // where an English word already is: {key, custom} or null. `skip` is the
  // entry being edited, {key, index}, which must not count against itself.
  findWord(en, skip) {
    const w = en.toLowerCase();
    for (const key of this.LEVEL_KEYS) {
      if (this.builtin(key).some((p) => p[0].toLowerCase() === w)) return { key, custom: false };
      const i = this.list(key).findIndex((p) => p[0].toLowerCase() === w);
      if (i >= 0 && !(skip && skip.key === key && skip.index === i)) return { key, custom: true };
    }
    return null;
  },
  // other words in the level with exactly this meaning
  sameMeaning(th, key, skip) {
    const out = [];
    this.builtin(key).forEach((p) => { if (p[1].trim() === th) out.push(p[0]); });
    this.list(key).forEach((p, i) => { if (p[1].trim() === th && !(skip && skip.key === key && skip.index === i)) out.push(p[0]); });
    return out;
  },

  // add, or with `edit` ({key, index}) change an existing entry.
  // -> { ok, error?, dupWhere?, warnSame? }
  save(enRaw, thRaw, key, edit) {
    const en = this.cleanEn(enRaw), th = this.cleanTh(thRaw);
    const err = this.checkFields(en, th);
    if (err) return { ok: false, error: err };
    if (!this.LEVEL_KEYS.includes(key)) return { ok: false, error: "cv.errLevel" };
    const dup = this.findWord(en, edit);
    if (dup) return { ok: false, error: "cv.errDup", dupWhere: dup, word: en };
    const same = this.sameMeaning(th, key, edit);
    const store = this.store();
    if (edit && edit.key === key) store[key][edit.index] = [en, th];
    else {
      if (edit) store[edit.key].splice(edit.index, 1);        // moved to another level
      store[key].push([en, th]);
    }
    G.persist();
    return { ok: true, word: en, key, warnSame: same };
  },
  remove(key, index) {
    const list = this.list(key);
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    G.persist();
  },

  // A whole file into one level, every row through the same checks -- the
  // file's own repeats included.
  // -> { added: [en], dupes: [{en, key}], invalid: [{en, reason}], sameMeaning: [en] }
  importPairs(pairs, key) {
    const res = { added: [], dupes: [], invalid: [], sameMeaning: [] };
    const seenInFile = new Set();
    (pairs || []).forEach((p) => {
      const en = this.cleanEn(p[0]), th = this.cleanTh(p[1]);
      const err = this.checkFields(en, th);
      if (err) { res.invalid.push({ en: en || "?", reason: err }); return; }
      const lower = en.toLowerCase();
      if (seenInFile.has(lower)) { res.dupes.push({ en, key: null }); return; }
      seenInFile.add(lower);
      const dup = this.findWord(en);
      if (dup) { res.dupes.push({ en, key: dup.key }); return; }
      if (this.sameMeaning(th, key).length) res.sameMeaning.push(en);
      this.store()[key].push([en, th]);
      res.added.push(en);
    });
    if (res.added.length) G.persist();
    return res;
  },
  // A practice set keeps game words on purpose (that is what it is for), so
  // only broken rows and the file's own repeats are dropped.
  cleanPracticeSet(pairs) {
    const res = { words: [], dupes: [], invalid: [] };
    const seen = new Set();
    (pairs || []).forEach((p) => {
      const en = this.cleanEn(p[0]), th = this.cleanTh(p[1]);
      const err = this.checkFields(en, th);
      if (err) { res.invalid.push({ en: en || "?", reason: err }); return; }
      if (seen.has(en.toLowerCase())) { res.dupes.push({ en, key: null }); return; }
      seen.add(en.toLowerCase());
      res.words.push([en, th]);
    });
    return res;
  },
};

// A level's full word list: built-in, then the player's own.
G.levelWords = function (key) {
  const custom = G.save && G.save.customWords && Array.isArray(G.save.customWords[key]) ? G.save.customWords[key] : [];
  return G.CustomVocab.builtin(key).concat(custom);
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
    this.showMsg("", "");
    this.render();
    G.UI.showScreen("screen-customvocab");
  },
  bind() {
    const $ = (id) => document.getElementById(id);
    $("btn-cv-back").onclick = () => { if (this.returnTo === "screen-settings") { G.UI.renderSettings(); } G.UI.showScreen(this.returnTo); };
    $("cv-save").onclick = () => this.submit();
    $("cv-cancel").onclick = () => { this.cancelEdit(); this.showMsg("", ""); };
    $("cv-import").onclick = () => G.UI.openImport("screen-customvocab", $("cv-level").value);
    ["cv-en", "cv-th"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.submit(); } }));
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
        return `<div class="cv-row${editing ? " editing" : ""}"><div class="cv-word"><b>${esc(p[0])}</b><span>${esc(p[1])}</span></div>
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
    $("cv-save").textContent = G.T("cv.add");
    $("cv-cancel").classList.add("hidden");
    if (document.getElementById("cv-list").children.length) this.renderList();
  },
  submit() {
    const $ = (id) => document.getElementById(id);
    const key = $("cv-level").value;
    const r = G.CustomVocab.save($("cv-en").value, $("cv-th").value, key, this.editing);
    if (!r.ok) {
      const msg = r.error === "cv.errDup"
        ? G.T(r.dupWhere.custom ? "cv.errDupCustom" : "cv.errDup", { w: r.word, level: G.CustomVocab.levelName(r.dupWhere.key) })
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
  showMsg(text, kind) {
    const el = document.getElementById("cv-msg");
    el.textContent = text;
    el.className = "cv-msg" + (kind ? " " + kind : "");
  },
};

G.escapeHtml = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
};
