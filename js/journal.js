// ===================================================================
// The note reader and the Notes Journal (round 3, H)
// -------------------------------------------------------------------
// The reader shows one story note on old paper -- stained, creased at the
// folds, a readable serif, not a scrawl -- with its CEFR level in the corner,
// a button that reads it aloud (the browser's own voice, British English
// where there is one) and Keep Note. It is a G.Modal window: while it is
// open the whole game stands still.
//
// The journal lists every note of a level: the kept ones by title, author
// and level (tap to read again), the rest as blanks, and how many of the
// twenty have been found. It opens from the main menu and the pause menu.
// ===================================================================
(function () {
  const LEVELS = [["level1", 1], ["level2", 2], ["level3", 3]];
  const esc = (s) => G.escapeHtml(String(s));
  // paragraphs (blank line) and line breaks (one newline), escaped
  const bodyHtml = (text) => text.split(/\n\n/).map((p) => "<p>" + p.split("\n").map(esc).join("<br>") + "</p>").join("");

  Object.assign(G.UI, {
    renderNoteReader(note, fromJournal) {
      this.el("note-cefr").textContent = note.cefr;
      this.el("note-cefr").className = "note-cefr cefr-" + note.cefr[0].toLowerCase();
      this.el("note-cefr").setAttribute("aria-label", G.T("notes.cefrAria", { level: note.cefr }));
      this.el("note-title").textContent = note.title;
      this.el("note-author").textContent = note.author;
      // (vocabulary series, round 3, H4) the words of the level's bank, any
      // form, marked: a tap or a click shows the word's mini card (reading it
      // is not a review)
      const levelKey = Object.keys(G.NOTES || {}).find((k) => (G.NOTES[k] || []).some((n) => n.id === note.id)) || "level1";
      const body = this.el("note-body");
      body.innerHTML = G.VocabCard ? G.VocabCard.markNote(bodyHtml(note.text), levelKey) : bodyHtml(note.text);
      body.scrollTop = 0;
      body.onclick = (e) => {
        const b = e.target.closest(".note-word");
        if (!b) return;
        const en = G.WordBank.byId(b.dataset.id);
        if (!en) return;
        const p = [en.headword, en.thai]; p.id = en.id;
        G.VocabCard.peek(p, b.dataset.form);
      };
      this.el("btn-note-keep").textContent = G.T(fromJournal ? "notes.close" : "notes.keep");
      this.setNoteSpeaking(false);
      // a slightly different tilt and stain for every note
      let h = 0;
      for (let i = 0; i < note.id.length; i++) h = (h * 31 + note.id.charCodeAt(i)) >>> 0;
      const paper = this.el("note-paper");
      paper.style.setProperty("--tilt", ((h % 7) - 3) * 0.35 + "deg");
      paper.style.setProperty("--stain-x", 20 + (h % 60) + "%");
      paper.style.setProperty("--stain-y", 30 + ((h >> 3) % 55) + "%");
    },
    setNoteSpeaking(on) {
      const b = this.el("note-listen-label");
      if (b) b.textContent = G.T(on ? "notes.stop" : "notes.listen");
    },

    openJournal(returnTo, levelKey) {
      this._journalReturn = returnTo || "screen-mainmenu";
      this._journalLevel = levelKey || this._journalLevel || "level1";
      this.renderJournal();
      this.showScreen("screen-journal");
    },
    renderJournal() {
      const cur = this._journalLevel || "level1";
      this.el("journal-tabs").innerHTML = LEVELS.map(([key, id]) => {
        const n = G.Notes.kept(key).length, total = G.Notes.all(key).length || 20;
        const lvl = G.getLevel(id);
        return `<button class="tab-btn${key === cur ? " active" : ""}" data-key="${key}">${esc(lvl ? lvl.name : key)} <span class="journal-count">${n} / ${total}</span></button>`;
      }).join("");
      this.el("journal-tabs").querySelectorAll("button").forEach((b) => { b.onclick = () => { this._journalLevel = b.dataset.key; this.renderJournal(); }; });
      const notes = G.Notes.all(cur), kept = G.Notes.kept(cur);
      const total = notes.length || 20;
      this.el("journal-summary").textContent = notes.length ? G.T("journal.found", { n: kept.length, total }) : G.T("journal.none");
      const list = this.el("journal-list");
      if (!notes.length) { list.innerHTML = `<p class="journal-empty">${esc(G.T("journal.soon"))}</p>`; return; }
      list.innerHTML = notes.map((n, i) => {
        const has = kept.includes(n.id);
        return has
          ? `<button class="journal-card" data-id="${n.id}"><span class="journal-num">${i + 1}</span><span class="note-cefr cefr-${n.cefr[0].toLowerCase()}">${n.cefr}</span><span class="journal-title">${esc(n.title)}</span><span class="journal-author">${esc(n.author)}</span></button>`
          : `<div class="journal-card locked"><span class="journal-num">${i + 1}</span><span class="note-cefr cefr-${n.cefr[0].toLowerCase()}">${n.cefr}</span><span class="journal-title">???</span><span class="journal-author">${esc(G.T("journal.notFound"))}</span></div>`;
      }).join("");
      list.querySelectorAll("button.journal-card").forEach((b) => {
        b.onclick = () => { const note = G.Notes.byId(cur, b.dataset.id); if (note) G.Notes.open(note, { fromJournal: true, back: "screen-journal" }); };
      });
    },
    bindJournal() {
      ["screen-journal", "screen-note"].forEach((s) => { if (!this.ALL_SCREENS.includes(s)) this.ALL_SCREENS.push(s); });
      this.el("btn-journal-back").onclick = () => {
        const back = this._journalReturn || "screen-mainmenu";
        if (back === "screen-mainmenu") this.goToMainMenu(); else this.showScreen(back);
      };
      this.el("btn-note-keep").onclick = () => G.Notes.close();
      this.el("btn-note-listen").onclick = () => G.Notes.toggleSpeech();
      this.el("btn-pause-journal").onclick = () => {
        const key = G.Game.level ? G.Notes.LEVEL_OF_THEME[G.Game.level.theme] : "level1";
        this.openJournal("screen-pause", key);
      };
    },
  });
})();
