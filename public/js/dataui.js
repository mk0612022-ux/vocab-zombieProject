// ===================================================================
// The player's data on screen (expansion, round 1)
// -------------------------------------------------------------------
// Settings > Data (the rows are in js/settings.js, what they do is here):
// where the save is kept, the last backup file, Export and Import, the
// snapshots with Restore, Reset Progress. In the Main Menu: a save that could
// not be read, and the quiet reminder to keep a file. Every window is
// G.Dialog; a change to the whole save ends in a restart of the page, so
// everything that read a setting at the start reads the new one.
//
// Import, Restore and Reset are for the menus, not in a run. Reset asks for a
// four-digit code to be typed: digits in every language and on every
// keyboard, with buttons for a controller.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const M = () => G.SaveManager;
  const F = () => G.SaveFile;

  const when = (ms) => new Date(ms).toLocaleString(G.locale(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function played(sec) {
    const min = Math.round(sec / 60), h = Math.floor(min / 60);
    return h ? T("data.time.hm", { h, m: min % 60 }) : T("data.time.m", { m: min });
  }
  const size = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(1) + " GB" : b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  function ago(ms) {
    if (!ms) return T("data.never");
    const days = G.Clock.today() - Math.floor((ms - new Date(ms).getTimezoneOffset() * 6e4) / 864e5);
    return days <= 0 ? T("data.today") : days === 1 ? T("data.yesterday") : T("data.daysAgo", { n: days });
  }
  const line = (sum) => T("data.summary", { words: sum.remembered, levels: sum.levels, time: played(sum.playSec) });

  G.DataUI = {
    ago,

    // ---------------- Settings > Data ----------------
    // what cannot be drawn at once: the browser's answers, the snapshots
    fill() {
      this.fillStore();
      this.fillBackups();
    },
    async fillStore() {
      const st = await M().status(), v = $("set-store-v"), note = $("set-store-note");
      if (!v) return;
      v.textContent = T("data.store." + st.backend);
      const kept = T(st.persisted === true ? "data.persist.yes" : st.persisted === false ? "data.persist.no" : "data.persist.na");
      note.textContent = st.usage != null && st.quota ? kept + " " + T("data.used", { used: size(st.usage), quota: size(st.quota) }) : kept;
    },
    async fillBackups() {
      const box = $("set-backups"), P = G.SettingsUI.parts;
      if (!box) return;
      const inRun = G.SettingsUI.inRun(), list = await M().snapshots();
      if (!box.isConnected) return;               // (the page was drawn again meanwhile)
      box.innerHTML = list.length ? list.map((r) => P.row({
        id: "set-backup-" + r.id, name: when(r.id) + " · " + T("data.reason." + r.reason), ctl: P.button("btn-restore-" + r.id, T("data.restore"), "", inRun), desc: line(r.summary), locked: inRun,
      })).join("") : `<p class="set-foot">${esc(T("data.noBackups"))}</p>`;
      list.forEach((r) => { $("btn-restore-" + r.id).onclick = () => this.askRestore(r); });
    },
    bind() {
      const click = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
      click("btn-export-save", () => this.exportNow());
      click("btn-import-save-settings", () => $("import-save-file").click());
      click("btn-reset-progress", () => this.askReset());
      click("btn-export-raw", () => this.exportRaw(M().rescueText()));
      const file = $("import-save-file");
      if (!file) return;
      // (iOS greys out a file type it does not know: no filter on a tablet)
      if (!G.isHandheld()) file.accept = ".vzsave,.json";
      file.onchange = (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        if (f) this.onFile(f);
      };
      this.fill();
    },

    // ---------------- export ----------------
    async exportNow() {
      G.persist(true);
      let file;
      try { file = await F().make(); } catch (e) { console.warn("Export failed", e); this.oops(T("data.exportFailed"), e.message); return; }
      await this.send(file, () => this.exported());
    },
    exported() {
      M().backedUp();
      this.notice(T("data.exportDone"));
      const v = $("set-lastbackup-v");
      if (v) v.textContent = ago(G.save.meta.lastExportAt);
      this.closeNudge();
      if (G.SettingsUI) G.SettingsUI.dots();
    },
    exportRaw(text) { if (text) F().deliver(F().rawFile(text)); },

    // ---------------- out of the game ----------------
    // a file; `done` once it has gone (not when the player cancels)
    send(file, done) {
      return F().deliver(file).then((how) => {
        if (how === "needTap") this.askTap(file, done);
        else if (how !== "cancelled" && done) done();
      });
    },
    // a browser that wants a tap of its own before it shares
    askTap(file, done) {
      G.Dialog.open({ icon: "💾", title: T("data.exportTitle"), text: T("data.exportText"), buttons: [
        { label: T("data.exportSave"), primary: true, action: () => F().deliver(file).then((h) => { if (h !== "cancelled" && done) done(); }) },
        { label: T("dialog.cancel"), cancel: true },
      ] });
    },
    // text for the clipboard (the Clipboard API needs https or localhost, so
    // the old way behind it); a browser that refuses both: a window to copy from
    async copy(text, done) {
      let ok = false;
      try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { /* the old way */ }
      if (!ok) {
        const ta = document.createElement("textarea");
        ta.value = text; ta.readOnly = true;
        ta.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.appendChild(ta);
        ta.select(); ta.setSelectionRange(0, text.length);
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        ta.remove();
      }
      if (ok) { if (done) done(); return; }
      G.Dialog.open({ title: T("report.copyTitle"), body: `<textarea class="rp-text" id="dlg-copy" rows="8" readonly>${esc(text)}</textarea>`, focus: "dlg-copy", buttons: [{ label: T("common.close"), primary: true, cancel: true }] });
      $("dlg-copy").select();
    },
    // a word on screen for a moment, in the menus too (the HUD's banner is hidden there)
    notice(text) {
      const el = $("ui-notice");
      el.textContent = text;
      el.classList.remove("hidden");
      clearTimeout(this._noticeT);
      this._noticeT = setTimeout(() => el.classList.add("hidden"), 2600);
    },

    // ---------------- import ----------------
    async onFile(file) {
      let res;
      try { res = await F().readFile(file); } catch (e) { this.oops(T("data.importFailed"), e.message); return; }
      this.askImport(res);
    },
    askImport(res) {
      const a = G.saveSummary(G.save), b = res.summary;
      const cell = (k, x, y) => `<tr><th scope="row">${esc(T(k))}</th><td>${esc(x)}</td><td>${esc(y)}</td></tr>`;
      const date = res.exportedAt && !isNaN(new Date(res.exportedAt)) ? when(new Date(res.exportedAt).getTime()) : res.save.meta.updatedAt ? when(res.save.meta.updatedAt) : T("common.unknown");
      const body = `<table class="dlg-table"><thead><tr><th></th><th scope="col">${esc(T("data.col.this"))}</th><th scope="col">${esc(T("data.col.file"))}</th></tr></thead><tbody>
          ${cell("data.row.date", G.save.meta.updatedAt ? when(G.save.meta.updatedAt) : "-", date)}
          ${cell("data.row.words", a.remembered, b.remembered)}
          ${cell("data.row.levels", a.levels, b.levels)}
          ${cell("data.row.time", played(a.playSec), played(b.playSec))}
        </tbody></table>
        <label class="dlg-check"><input type="checkbox" id="dlg-use-settings"><span>${esc(T("data.useFileSettings"))}</span></label>`;
      G.Dialog.open({ icon: "📥", title: T("data.importTitle"), text: T("data.importText"), body, buttons: [
        { label: T("data.merge"), primary: true, action: () => { const on = $("dlg-use-settings").checked; this.change(() => M().adopt(F().merge(G.save, res.save, { useFileSettings: on }), "merge"), "merge"); } },
        { label: T("data.replace"), danger: true, action: () => this.change(() => M().adopt(res.save, "import"), "import") },
        { label: T("dialog.cancel"), cancel: true },
      ] });
    },

    // ---------------- a backup ----------------
    askRestore(rec) {
      G.Dialog.confirm({ icon: "⏪", title: T("data.restoreTitle"), text: T("data.restoreText", { when: when(rec.id) }) + "\n" + line(rec.summary), yes: T("data.restore") },
        () => this.change(() => M().restore(rec.id), "restore"));
    },

    // ---------------- starting again ----------------
    askReset() {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      const pad = G.Input.padActive ? `<div class="dlg-digits">${"1234567890".split("").map((d) => `<button type="button" class="btn dlg-digit" data-d="${d}">${d}</button>`).join("")}</div>` : "";
      const body = `<input type="text" class="dlg-input" id="dlg-code" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="${esc(T("data.resetLabel"))}">${pad}`;
      G.Dialog.open({ icon: "⚠️", danger: true, title: T("data.resetTitle"), text: T("data.resetText", { code }), body, focus: "dlg-code", buttons: [
        { label: T("data.resetGo"), danger: true, primary: true, disabled: true, action: () => this.change(() => M().reset(), "reset") },
        { label: T("dialog.cancel"), cancel: true },
      ] });
      const inp = $("dlg-code"), go = $("dialog-btns").querySelector("button");
      const check = () => { go.disabled = inp.value.trim() !== code; };
      inp.oninput = check;
      document.querySelectorAll("#dialog-body .dlg-digit").forEach((b) => { b.onclick = () => { inp.value = (inp.value + b.dataset.d).slice(0, 4); check(); }; });
    },

    // ---------------- the end of any of them ----------------
    async change(fn, kind) {
      try { await fn(); } catch (e) { console.warn("Save change failed", e); this.oops(T("data.importFailed"), e.message); return; }
      const go = () => M().restart();
      G.Dialog.open({ icon: "✅", title: T("data.doneTitle"), text: T("data.done." + kind), buttons: [{ label: T("data.restart"), primary: true, cancel: true, action: go }] });
    },
    oops(title, text) {
      G.Dialog.open({ icon: "⚠️", title, text, buttons: [{ label: T("dialog.ok"), primary: true, cancel: true }] });
    },

    // ---------------- in the Main Menu ----------------
    atMenu() {
      const f = M().failure();
      if (f) { if (!G.Dialog.isOpen()) this.askFailed(f); return; }
      this.nudge();
    },
    // nothing is stored until this is answered; the game runs on a blank save
    askFailed(f) {
      G.Dialog.open({ icon: "⚠️", danger: true, title: T("data.failTitle"), text: T("data.failText") + (f.why ? "\n(" + f.why + ")" : ""), buttons: [
        { label: T("data.failExport"), primary: true, action: () => { this.exportRaw(f.raw); this.askFailed(f); } },
        { label: T("data.failFresh"), danger: true, action: () => { M().startFresh(); this.nudge(); } },
      ] });
    },
    // Safari clears what it thinks is unused, unless it is on the Home Screen
    safari() { return /Safari\//.test(navigator.userAgent) && !/Chrome\/|CriOS\/|Edg\/|Firefox\//.test(navigator.userAgent) && !navigator.standalone; },
    nudge() {
      const card = $("home-nudge");
      if (!card) return;
      if (!this._nudged && M().needsBackup()) { this._nudged = true; M().nudged(); }
      card.classList.toggle("hidden", !this._nudged);
      $("home-nudge-title").textContent = T("data.nudgeTitle");
      $("home-nudge-text").textContent = T(this.safari() ? "data.nudgeSafari" : "data.nudgeText");
      $("home-nudge-go").textContent = T("data.nudgeGo");
      $("home-nudge-later").textContent = T("data.nudgeLater");
      G.MainMenu.setExtra(this._nudged ? [$("home-nudge-go"), $("home-nudge-later")] : []);
    },
    closeNudge() {
      if (!this._nudged) return;
      this._nudged = false;
      const card = $("home-nudge");
      if (card) card.classList.add("hidden");
      if (G.MainMenu) G.MainMenu.setExtra([]);
    },
    // the reminder's two buttons, from G.MainMenu.activate
    openData() { this.closeNudge(); G.SettingsUI.cat = "data"; },
  };
})();
