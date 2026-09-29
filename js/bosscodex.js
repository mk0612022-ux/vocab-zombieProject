// ===================================================================
// The Boss Codex (round 2, G4): the "Bosses" icon in the lobby
// -------------------------------------------------------------------
// One card per boss. A boss met at least once shows its picture (its body,
// rendered by G.BossModels.portrait), its name, its title with the title's
// Thai meaning, and its three moves; opening the card (a G.Modal window)
// adds what it looks like, what each move does and when (phase 1 down to
// 66% of its health, 2 down to 33%, 3 below), how to survive each, its weak
// spot and how often it has been met and beaten. A boss never met is a
// dark silhouette and "???".
//
// What has been met is G.save.bosses (js/core.js), so it goes with the save
// into Export / Import.
// ===================================================================
(function () {
  const esc = (s) => G.escapeHtml(String(s));
  const T = (k, v) => G.T(k, v);

  Object.assign(G.UI, {
    // a boss's three moves: its old one (boss.<id>.*), then its two new ones
    // (boss.move.<move>.*)
    codexMoves(d) {
      return (d.moves || [d.ability]).map((mv, i) => (i === 0
        ? { name: T("boss." + d.id + ".ability"), desc: T("boss." + d.id + ".desc"), counter: T("boss." + d.id + ".counter") }
        : { name: T("boss.move." + mv + ".name"), desc: T("boss.move." + mv + ".desc"), counter: T("boss.move." + mv + ".counter") }));
    },
    openCodex(returnTo) {
      this._codexReturn = returnTo || "screen-mainmenu";
      this.renderCodex();
      this.showScreen("screen-bosses");
    },
    renderCodex() {
      const S = G.save.bosses, defs = G.BOSS_DEFS;
      const met = defs.filter((d) => S.seen[d.id]).length, beaten = defs.filter((d) => S.defeated[d.id]).length;
      this.el("codex-summary").textContent = T("codex.summary", { n: met, total: defs.length, d: beaten });
      const grid = this.el("codex-grid");
      grid.innerHTML = defs.map((d) => {
        const seen = !!S.seen[d.id];
        const name = T("boss." + d.id + ".name");
        if (!seen) {
          return `<div class="codex-card locked" data-id="${d.id}"><div class="codex-img"><img alt="" data-pic="${d.id}" data-sil="1"></div>` +
            `<div class="codex-name">${esc(T("codex.unknown"))}</div><div class="codex-sub">${esc(T("codex.notMet"))}</div></div>`;
        }
        return `<button class="codex-card" data-id="${d.id}" aria-label="${esc(T("codex.open", { name }))}"><div class="codex-img"><img alt="" data-pic="${d.id}"></div>` +
          `<div class="codex-name">${esc(name)}</div>` +
          `<div class="codex-title">${esc(T("boss.the", { w: d.word.charAt(0).toUpperCase() + d.word.slice(1) }))}</div>` +
          `<div class="codex-thai" lang="th">${esc(G.Bosses.thai(d))}</div>` +
          `<div class="codex-sub">${esc(this.codexMoves(d).map((m) => m.name).join(" · "))}</div>` +
          (S.defeated[d.id] ? `<div class="codex-beaten">✓</div>` : "") + `</button>`;
      }).join("");
      grid.querySelectorAll("button.codex-card").forEach((b) => { b.onclick = () => this.openCodexDetail(b.dataset.id); });
      // the pictures, one a tick, so the screen opens at once
      const imgs = Array.from(grid.querySelectorAll("img[data-pic]"));
      const token = this._codexToken = (this._codexToken || 0) + 1;
      const next = () => {
        if (token !== this._codexToken || !imgs.length) return;
        const img = imgs.shift();
        const url = G.BossModels.portrait(img.dataset.pic, !!img.dataset.sil);
        if (url) img.src = url;
        setTimeout(next, 0);
      };
      setTimeout(next, 30);
    },
    openCodexDetail(id) {
      const d = G.BOSS_BY_ID[id], S = G.save.bosses;
      if (!d || !S.seen[id]) return;
      this.el("codex-d-img").src = G.BossModels.portrait(id, false) || "";
      this.el("codex-d-name").textContent = T("boss." + id + ".name");
      this.el("codex-d-title").textContent = T("boss.the", { w: d.word.charAt(0).toUpperCase() + d.word.slice(1) });
      this.el("codex-d-thai").textContent = G.Bosses.thai(d);
      this.el("codex-d-look").textContent = T("boss." + id + ".look");
      // (new series, round 2) its three moves, a phase each, with the way out of each
      this.el("codex-d-moves").innerHTML = this.codexMoves(d).map((m, i) =>
        `<div class="codex-move"><div class="codex-d-label">${esc(T("codex.phase" + (i + 1)))}</div>` +
        `<div class="codex-d-ability">${esc(m.name)}</div><p class="codex-d-desc">${esc(m.desc)}</p>` +
        `<p class="codex-d-how"><span class="codex-how-k">${esc(T("codex.counter"))}:</span> ${esc(m.counter)}</p></div>`).join("");
      this.el("codex-d-counter").textContent = T("codex.weak", { w: T("boss." + id + ".weak") }) + " " + T("codex.swipe");
      this.el("codex-d-stats").textContent = T("codex.record", { m: S.seen[id] || 0, d: S.defeated[id] || 0 });
      this.el("codex-detail").classList.remove("hidden");
      G.Modal.open("codex", { keys: (e) => {
        if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") { this.closeCodexDetail(); return true; }
        return false;
      } });
      this._codexOpenFrom = id;
      setTimeout(() => { const b = this.el("btn-codex-close"); if (b && G.Input.mode !== "touch") b.focus({ preventScroll: true }); }, 0);
    },
    closeCodexDetail() {
      if (!G.Modal.isOpen("codex")) return;
      this.el("codex-detail").classList.add("hidden");
      G.Modal.close("codex");
      const card = this.el("codex-grid").querySelector(`[data-id="${this._codexOpenFrom}"]`);
      if (card && card.focus && G.Input.mode !== "touch") card.focus({ preventScroll: true });
    },
    bindCodex() {
      if (!this.ALL_SCREENS.includes("screen-bosses")) this.ALL_SCREENS.push("screen-bosses");
      this.el("btn-codex-back").onclick = () => {
        this._codexToken = (this._codexToken || 0) + 1;
        G.BossModels.releaseRenderer();
        const back = this._codexReturn || "screen-mainmenu";
        if (back === "screen-mainmenu") this.goToMainMenu(); else this.showScreen(back);
      };
      this.el("btn-codex-close").onclick = () => this.closeCodexDetail();
      // a click on the dark around the box closes it too
      this.el("codex-detail").addEventListener("click", (e) => { if (e.target.id === "codex-detail") this.closeCodexDetail(); });
    },
  });
})();
