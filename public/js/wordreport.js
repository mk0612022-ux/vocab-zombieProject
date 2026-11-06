// ===================================================================
// Reporting a word (expansion, round 2)
// -------------------------------------------------------------------
// Some meanings and explanations were written by AI, so every word carries a
// flag: in the answer's explanation, the Word Log and the word's card. A short
// form (what is wrong, a note) keeps the word's id, its two languages and the
// text on screen at that moment, on this device (G.ReportStore). Settings > Help
// exports them all as a .vzwords file, or copies them for Claude Code.
// tools/list-word-reports.ps1 lists them against the word bank. Nothing here
// changes a word: a person does that.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const TYPES = ["meaning", "pos", "example", "explain", "spelling", "other"];

  // what the player is looking at, as text
  function shownOf(pair, ex) {
    if (ex && G.Explain) return G.Explain.text(ex, true);
    const i = G.VocabCard.info(pair), pos = G.POS.of(pair), en = G.Lang.enWord(pair);
    const out = [pair[0] + (pos ? " (" + G.POS.abbr(pos, G.POS.gender(pair)) + ")" : "") + " = " + pair[1]];
    if (en && i.definition) out.push(i.definition);
    if (en && (i.examples || [])[0]) out.push(i.examples[0]);
    return out.join("\n");
  }
  function record(pair, type, note, where, ex) {
    const pos = G.POS.of(pair), m = G.Updater && (G.Updater.installed || G.Updater.server);
    return {
      id: G.ReportStore.newId(), at: new Date().toISOString(), wordId: G.wordKey(pair), word: pair[0], meaning: pair[1], pos: pos || "",
      wl: G.Lang.wl(pair), ml: G.Lang.ml(pair), custom: !!pair.custom, uiLang: G.lang, where, type, note, shown: shownOf(pair, ex), gameVersion: m ? m.version : "",
    };
  }

  // ---------------- the file, and the copy ----------------
  function fileOf(list) {
    const m = G.Updater && (G.Updater.installed || G.Updater.server), now = new Date();
    return { name: "vocab-zombie-words-" + G.SaveFile.stamp(now) + ".vzwords", text: JSON.stringify({ app: "vocab-zombie", kind: "words", format: 1, exportedAt: now.toISOString(), gameVersion: m ? m.version : "", count: list.length, reports: list }) };
  }
  // for a developer: English
  function summary(list) {
    const max = G.CONFIG.diag.summaryChars;
    let text = `# Vocab Zombie word reports (${list.length})\nFix by hand in the word bank, after checking each one.\n`, left = list.length;
    for (const r of list) {
      const line = `- ${r.wordId} "${r.word}" = ${r.meaning} [${r.wl}>${r.ml}] ${r.type}${r.note ? ": " + r.note : ""}\n`;
      if (text.length + line.length > max - 40) break;
      text += line; left--;
    }
    return left ? text + `...and ${left} more in the file\n` : text;
  }

  G.WordReport = {
    TYPES, shownOf, record, fileOf, summary,
    // pair: the word; o: { where, ex (the explanation on screen), onClose }
    open(pair, o) {
      if (!pair) return;
      o = o || {};
      let type = "";
      const chips = TYPES.map((t) => `<button type="button" class="rp-chip" data-t="${t}" aria-pressed="false">${esc(T("word.t." + t))}</button>`).join("");
      const body = `<div class="rp-word"${G.Lang.attr(pair, 0)}>${G.Lang.html(pair, 0)}</div><div class="rp-mean"${G.Lang.attr(pair, 1)}>${G.Lang.html(pair, 1)}</div>
        <div class="rp-h">${esc(T("word.type"))}</div><div class="rp-chips" id="wr-types">${chips}</div>
        <label class="rp-h" for="wr-note">${esc(T("word.note"))}</label><textarea class="rp-text" id="wr-note" rows="2" maxlength="300" data-pad></textarea>`;
      G.Dialog.open({ icon: "🚩", title: T("word.title"), body, focus: "wr-note", buttons: [
        { label: T("word.send"), primary: true, disabled: true, action: () => {
          const note = $("wr-note").value.trim();
          G.ReportStore.put("words", record(pair, type, note, o.where || "", o.ex), G.CONFIG.diag.wordReports).then(() => {
            G.DataUI.notice(T("word.kept"));
            this.fill();
          });
          if (o.onClose) o.onClose();
        } },
        { label: T("dialog.cancel"), cancel: true, action: () => { if (o.onClose) o.onClose(); } },
      ] });
      const go = $("dialog-btns").querySelector("button");
      document.querySelectorAll("#wr-types .rp-chip").forEach((b) => {
        b.onclick = () => {
          type = b.dataset.t;
          document.querySelectorAll("#wr-types .rp-chip").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
          go.disabled = false;
        };
      });
    },

    // ---------------- Settings > Help ----------------
    bind() {
      const click = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
      const list = () => G.ReportStore.all("words");
      click("btn-words-file", async () => { const l = await list(); if (l.length) G.DataUI.send(fileOf(l), () => G.BugReport.said(T("report.saved"))); });
      click("btn-words-copy", async () => { const l = await list(); if (l.length) G.DataUI.copy(summary(l), () => G.BugReport.said(T("report.copied"))); });
      click("btn-words-clear", () => G.Dialog.confirm({ title: T("help.wordsClearTitle"), text: T("help.wordsClearText"), yes: T("help.wordsClear"), danger: true }, async () => { await G.ReportStore.clear("words"); this.fill(); }));
    },
    async fill() {
      const v = $("set-wordreports-v");
      if (!v) return;
      const n = (await G.ReportStore.all("words")).length;
      v.textContent = T("help.wordsCount", { n });
      ["btn-words-file", "btn-words-copy", "btn-words-clear"].forEach((id) => { const b = $(id); if (b) b.disabled = !n; });
    },
  };
})();
