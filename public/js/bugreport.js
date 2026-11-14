// ===================================================================
// The bug report (expansion, round 2)
// -------------------------------------------------------------------
// A window (G.Modal) from the pause menu, Settings > Help, the How to Play
// page and a key of its own; a small toast when an error nobody caught
// happens. What it leaves is a .vzreport file, JSON with the picture in base64
// (tools/read-report.ps1 reads it), or a Markdown summary for Claude Code. The
// player sends either: nothing leaves the game by itself.
//
// The report is taken as the window opens, before anything about the game
// changes; what the player adds goes with it when it is saved. No name, email
// or picture of the player goes in; the UID only when ticked.
//
// G.ReportStore keeps reports on this device, apart from the save: a restored
// or reset save leaves them alone.
//
//   G.BugReport.open({ cat })      the window
//   G.BugReport.collect()          what the game knows now
//   G.BugReport.summary(report)    the Markdown (its labels are for a developer: English)
// ===================================================================
window.G = window.G || {};

G.ReportStore = (function () {
  const names = { db: "vocabZombieReports", ls: "vocabZombie_reports_" };
  let db = null;
  const DB = () => db || (db = G.SaveManager.makeDB(() => names.db, ["reports", "words"]));
  const lsAll = (kind) => { try { return JSON.parse(localStorage.getItem(names.ls + kind) || "[]"); } catch (e) { return []; } };
  // (no IndexedDB: the newest that fit, without their pictures)
  function lsPut(kind, list) {
    const light = list.map((r) => (r.screenshot ? Object.assign({}, r, { screenshot: null }) : r));
    while (light.length) {
      try { localStorage.setItem(names.ls + kind, JSON.stringify(light)); return; } catch (e) { light.shift(); }
    }
  }
  // oldest first
  async function all(kind) {
    let out;
    try { out = await DB().run(kind, "readonly", (st) => st.getAll()); } catch (e) { out = lsAll(kind); }
    return (out || []).sort((a, b) => a.id - b.id);
  }
  async function put(kind, rec, keep) {
    try {
      await DB().run(kind, "readwrite", (st) => st.put(rec));
      const list = await all(kind), extra = list.slice(0, Math.max(0, list.length - keep));
      if (extra.length) await DB().run(kind, "readwrite", (st) => { extra.forEach((r) => st.delete(r.id)); });
    } catch (e) {
      lsPut(kind, lsAll(kind).filter((r) => r.id !== rec.id).concat([rec]).slice(-keep));
    }
    return rec;
  }
  async function clear(kind) {
    try { await DB().run(kind, "readwrite", (st) => st.clear()); } catch (e) { /* localStorage, below */ }
    try { localStorage.removeItem(names.ls + kind); } catch (e) { /* nothing there */ }
  }
  // (a test's own storage)
  function use(tag) {
    if (db && db.conn) { db.conn.close(); }
    db = null;
    names.db = tag ? tag + "_reports" : "vocabZombieReports";
    names.ls = tag ? tag + "_reports_" : "vocabZombie_reports_";
  }
  let lastId = 0;
  const newId = () => { lastId = Math.max(Date.now(), lastId + 1); return lastId; };
  return { all, put, clear, use, names, newId };
})();

(function () {
  const T = (k, v) => G.T(k, v);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const C = () => G.CONFIG.diag;
  // a part of the report that fails leaves its place empty, not the report: it
  // is made when things have gone wrong
  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback === undefined ? { failed: String(e && e.message || e) } : fallback; } };
  const round = (v, n) => { const k = Math.pow(10, n || 0); return Math.round(v * k) / k; };

  const CATS = ["crash", "visual", "audio", "controls", "vocab", "perf", "other"];
  const DOING = ["shooting", "reloading", "door", "answering", "level", "menu"];

  // ---------------- what goes in it ----------------
  function version() {
    const u = G.Updater, m = u && (u.installed || u.server);
    return { version: m ? m.version : G.save.meta.gameVersion, build: m ? m.build : null, commit: m ? m.commit : "", mode: u ? u.mode : "" };
  }
  function device() {
    const o = screen.orientation && screen.orientation.type;
    return {
      ua: navigator.userAgent, width: innerWidth, height: innerHeight, screen: screen.width + "x" + screen.height, dpr: devicePixelRatio,
      orientation: o || (innerWidth >= innerHeight ? "landscape" : "portrait"), input: G.Input.padActive ? "controller" : G.Input.mode === "touch" ? "touch" : "keyboard/mouse",
      touchPoints: navigator.maxTouchPoints || 0, language: navigator.language, online: navigator.onLine,
    };
  }
  function graphics() {
    const s = G.save.settings, r = G.Game.renderer;
    const out = { quality: s.graphicsQuality, fpsCap: s.fpsCap, renderScale: s.renderScale, fps: G.Diag.fps() };
    if (!r) return out;
    const i = r.info, gl = r.getContext(), e = gl.getExtension("WEBGL_debug_renderer_info");
    out.webgl2 = !!r.capabilities.isWebGL2;
    out.calls = i.render.calls; out.triangles = i.render.triangles;
    out.geometries = i.memory.geometries; out.textures = i.memory.textures; out.programs = i.programs ? i.programs.length : 0;
    out.gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "";
    return out;
  }
  function audio() {
    const A = G.Audio;
    return { state: A.ctx ? A.ctx.state : "none", playing: A.ctx ? A.counts() : null };
  }
  const SETTINGS = ["uiLang", "wordLang", "meaningLang", "controlMode", "campaignStyle", "gameSpeed", "fontSize", "shopTime", "autoReload", "spellReload", "aimAssist", "gore", "reduceMotion",
    "masterVolume", "musicVolume", "weaponsVolume", "sfxVolume", "speechMode", "explainDetail", "autoContinue", "showFpsCounter",
    "tips"];   // (expansion, round 9: the round 7 situation tips)
  function settings() {
    const s = G.save.settings, out = {};
    SETTINGS.forEach((k) => { out[k] = s[k]; });
    return out;
  }
  function game() {
    const g = G.Game, out = { state: g.state, mode: g.mode || "", paused: !!g.paused, screen: G.UI._currentScreen || "", windows: G.Modal.stack.map((m) => m.id) };
    if (!g.player || (g.state !== "GAMEPLAY" && g.state !== "PAUSE" && g.state !== "SHOP")) return out;
    const p = g.yawObject.position, pl = g.player, kinds = {};
    let alive = 0;
    g.zombies.forEach((z) => { if (z.alive) { alive++; kinds[z.type] = (kinds[z.type] || 0) + 1; } });
    const id = g.currentWeaponId(), W = g.wsm, a = pl.ammo[id];
    const Y = g.world && g.world.storeyY, feet = p.y - 1.7;
    Object.assign(out, {
      level: g.level ? g.level.id : null, zone: (G.Acoustics && G.Acoustics.zone) || "", wave: g.wave, floor: Y && Y.length > 1 ? (feet < Y[1] - 1 ? 1 : Y.length < 3 || feet < Y[2] - 1 ? 2 : 3) : null,
      zombies: alive, kinds, boss: G.Bosses && G.Bosses.phase ? G.Bosses.phase : "",
      player: { hp: round(pl.hp, 1), maxHp: pl.maxHp, stamina: round(g.stamina, 1), money: pl.money, score: pl.score, combo: pl.combo, x: round(p.x, 2), y: round(p.y, 2), z: round(p.z, 2) },
      weapon: { id, melee: pl.melee || "knife", state: W ? W.state : "",stateTime: W ? round(W.stateT, 2) : 0, held: W ? W.held : "", mag: a ? a.mag : null, reserve: a ? a.reserve : null, levels: pl.weaponLevels[id] || null, slots: pl.gunSlots,
        // (expansion, round 5) what the gun in hand wears
        attach: G.Attach && id !== "melee" && G.WEAPON_DEFS[id] ? Object.assign({}, G.Attach.loadoutOf(G.WEAPON_DEFS[id])) : null },
      word: g.targetPair ? { word: g.targetPair[0], id: g.targetPair.id || "", clue: g.targetClue ? g.targetClue.kind : "" } : null,
      question: g.challenge ? { word: g.challenge.pair[0], type: g.challenge.q.type, timeLeft: round(g.challenge.timeLeft, 1) } : null,
      // (expansion, round 9) in the Training Yard: which step, for how long, the hint up or not
      training: g.mode === "training" && G.TrainingYard && G.TrainingYard.run && G.TrainingYard.run.i >= 0
        ? { step: G.TrainingYard.run.i + 1, id: G.TrainingYard.STEPS[G.TrainingYard.run.i], secs: round(G.TrainingYard.run.t, 1), hint: !!G.TrainingYard.run.hintOn } : null,
    });
    return out;
  }
  // the HUD is HTML, not in the picture: its values instead
  function hud() {
    const g = G.Game;
    if (!g.player || g.state === "MENU") return null;
    const h = g.buildHudState();
    return { hp: round(h.hp), stamina: round(h.stamina), money: h.money, score: h.score, head: h.head, hand: h.hand, mission: h.mission, floor: h.floor, task: h.task, meaning: h.currentMeaning || "" };
  }
  // an event's payload, in plain values only (some hold whole objects)
  function events() {
    return G.Bus.recent.map((e) => {
      const p = {};
      if (e.p && typeof e.p === "object") Object.keys(e.p).forEach((k) => { const v = e.p[k]; if (v == null || typeof v !== "object") p[k] = v; });
      return { t: e.t, type: e.type, p };
    });
  }
  function collect() {
    const now = new Date();
    return {
      app: "vocab-zombie", kind: "report", format: 1,
      at: now.toISOString(), local: now.toString(), tzMinutes: -now.getTimezoneOffset(),
      version: safe(version), device: safe(device), graphics: safe(graphics), audio: safe(audio), settings: safe(settings), game: safe(game), hud: safe(hud, null),
      errors: G.Diag.errors(), logs: G.Diag.logs(), events: safe(events, []),
    };
  }

  // ---------------- the summary for Claude Code ----------------
  function summary(r) {
    const f = r.form || {}, g = r.game || {}, v = r.version || {}, d = r.device || {}, x = r.graphics || {}, fp = x.fps || {}, a = r.audio || {};
    const head = [`# Vocab Zombie bug report (${r.at})`];
    head.push(`- What: ${f.category || "-"}${f.doing ? ", while " + f.doing : ""}`);
    if (f.text) head.push("- Said: " + f.text.slice(0, 500));
    head.push(`- Version: ${v.version || "?"} build ${v.build || "?"} commit ${v.commit || "?"} (${v.mode || "?"})`);
    head.push(`- Device: ${d.ua || "?"}, ${d.width}x${d.height} @${d.dpr}, ${d.orientation}, ${d.input}`);
    head.push(`- Graphics: ${x.quality}, cap ${x.fpsCap}, FPS ${fp.avg} avg / ${fp.min} min / ${fp.low1} 1% low, ${fp.slow} slow frames, ${x.calls} calls, ${x.triangles} triangles, ${x.geometries} geometries, ${x.textures} textures, ${x.programs} programs, GPU ${x.gpu || "?"}`);
    head.push(`- Audio: ${a.state}, ${a.playing ? a.playing.total : 0} playing`);
    let where = `- Game: ${g.state}, ${g.mode || "-"}, screen ${g.screen || "-"}, windows [${(g.windows || []).join(", ")}]`;
    if (g.level != null) {
      const p = g.player || {}, w = g.weapon || {};
      where += `\n- Run: level ${g.level}, wave ${g.wave}, floor ${g.floor || "-"}, ${g.zombies} zombies ${JSON.stringify(g.kinds)}, HP ${p.hp}/${p.maxHp}, stamina ${p.stamina}, at ${p.x}, ${p.y}, ${p.z}`;
      where += `\n- Weapon: ${w.id}, ${w.state} ${w.stateTime}s, ${w.mag}/${w.reserve}`;
      if (g.word) where += `\n- Word: ${g.word.id || g.word.word} (${g.word.clue})`;
      if (g.question) where += `\n- Question: ${g.question.word} (${g.question.type})`;
    }
    head.push(where);
    const out = head.join("\n"), max = C().summaryChars;
    const errs = (r.errors || []).slice(-3).reverse().map((e) => `${e.message}${e.count > 1 ? " (x" + e.count + ")" : ""}${e.where ? " at " + e.where : ""}\n${String(e.stack).split("\n").slice(0, 5).join("\n")}`);
    const lines = (r.logs || []).slice(-8).map((l) => `${l.level}: ${l.text}`);
    const evs = (r.events || []).slice(-8).map((e) => e.type);
    let tail = "";
    if (errs.length) tail += "\n\n## Errors\n```\n" + errs.join("\n\n") + "\n```";
    if (lines.length) tail += "\n\n## Last log lines\n```\n" + lines.join("\n") + "\n```";
    if (evs.length) tail += "\n\n## Last events\n" + evs.join(", ");
    const text = out + tail;
    return text.length <= max ? text : text.slice(0, max - 40) + "\n...(cut: the file has the rest)";
  }

  // ---------------- the file, and the copy ----------------
  const fileOf = (r) => ({ name: "vocab-zombie-report-" + G.SaveFile.stamp(new Date(r.at)) + ".vzreport", text: JSON.stringify(r) });

  // ---------------- the window ----------------
  const R = G.BugReport = {
    CATS, DOING, collect, summary, fileOf,
    shown: false,
    open(o) {
      if (this.shown) return;
      o = o || {};
      this.shown = true;
      // (as things stand now: the window itself changes the state)
      this.snap = collect();
      this.f = { cat: o.cat || "", doing: "", text: "", shot: true, uid: false, url: null };
      this.rep = null;
      G.Diag.shot().then((url) => { if (!this.shown) return; this.f.url = url; this.thumb(); });
      this.hideToast();
      this.render();
      $("bug-report").classList.remove("hidden");
      const g = G.Game;
      G.Modal.open("bugreport", { pause: !!(g && g.state === "GAMEPLAY"), keys: (e) => {
        if (e.code === "Escape") { this.close(); return true; }
        return true;
      } });
      setTimeout(() => { const t = $("rp-text"); if (t && this.shown && G.Input.mode !== "touch") t.focus({ preventScroll: true }); }, 0);
    },
    close() {
      if (!this.shown) return;
      this.shown = false;
      if (document.activeElement) document.activeElement.blur();
      $("bug-report").classList.add("hidden");
      G.Modal.close("bugreport");
    },
    // the player's UID, when there is one
    uid() { const a = G.Account ? G.Account.state() : null; return a && a.signedIn ? a.uid : null; },
    render() {
      const f = this.f, chips = (list, key, on) => list.map((id) => `<button type="button" class="rp-chip${on === id ? " on" : ""}" data-${key}="${id}" aria-pressed="${on === id}">${esc(T("report." + key + "." + id))}</button>`).join("");
      const uid = this.uid();
      $("bug-report-body").innerHTML = `
        <div class="rp-h">${esc(T("report.category"))}</div><div class="rp-chips" id="rp-cats">${chips(CATS, "cat", f.cat)}</div>
        <label class="rp-h" for="rp-text">${esc(T("report.describe"))}</label>
        <textarea class="rp-text" id="rp-text" rows="3" maxlength="1000" data-pad placeholder="${esc(T("report.describeHint"))}">${esc(f.text)}</textarea>
        <div class="rp-h">${esc(T("report.doing"))}</div><div class="rp-chips" id="rp-doing">${chips(DOING, "do", f.doing)}</div>
        <div class="rp-row"><label class="dlg-check"><input type="checkbox" id="rp-shot"${f.shot ? " checked" : ""}><span>${esc(T("report.shot"))}</span></label><img class="rp-thumb hidden" id="rp-thumb" alt=""></div>
        <label class="dlg-check"><input type="checkbox" id="rp-uid"${uid ? "" : " disabled"}><span>${esc(T(uid ? "report.uid" : "report.uidNone"))}</span></label>
        <details class="rp-what"><summary>${esc(T("report.contents"))}</summary><p>${esc(T("report.contentsList"))}</p></details>
        <p class="rp-note">${esc(T("report.privacy"))}</p>`;
      $("bug-report-btns").innerHTML = `<button class="btn btn-primary" type="button" id="btn-rp-save">${esc(T("report.save"))}</button><button class="btn" type="button" id="btn-rp-copy">${esc(T("report.copy"))}</button><button class="btn" type="button" id="btn-rp-close" data-pad-back>${esc(T("common.close"))}</button>`;
      // a chip: chosen, or (tapped again) not
      const pick = (root, attr, field) => root.querySelectorAll(".rp-chip").forEach((b) => {
        b.onclick = () => {
          f[field] = f[field] === b.dataset[attr] ? "" : b.dataset[attr];
          root.querySelectorAll(".rp-chip").forEach((o) => { const on = f[field] === o.dataset[attr]; o.classList.toggle("on", on); o.setAttribute("aria-pressed", on); });
        };
      });
      pick($("rp-cats"), "cat", "cat");
      pick($("rp-doing"), "do", "doing");
      $("rp-text").oninput = (e) => { f.text = e.target.value; };
      $("rp-shot").onchange = (e) => { f.shot = e.target.checked; this.thumb(); };
      $("rp-uid").onchange = (e) => { f.uid = e.target.checked; };
      $("btn-rp-save").onclick = () => this.saveFile();
      $("btn-rp-copy").onclick = () => this.copy();
      $("btn-rp-close").onclick = () => this.close();
      this.thumb();
    },
    thumb() {
      const i = $("rp-thumb");
      if (!i) return;
      const on = !!(this.f.url && this.f.shot);
      i.classList.toggle("hidden", !on);
      if (on) i.src = this.f.url;
    },
    // the report with what the player has added; kept once, however often it leaves
    async finished() {
      const f = this.f, rep = Object.assign({}, this.snap, { form: { category: f.cat, doing: f.doing, text: f.text }, screenshot: f.shot ? f.url : null });
      if (f.uid && this.uid()) rep.uid = this.uid();
      rep.id = this.rep ? this.rep.id : G.ReportStore.newId();
      this.rep = rep;
      await G.ReportStore.put("reports", rep, C().reports);
      return rep;
    },
    async saveFile() {
      const rep = await this.finished();
      G.DataUI.send(fileOf(rep), () => { this.close(); this.said(T("report.saved")); });
    },
    async copy() {
      const rep = await this.finished();
      G.DataUI.copy(summary(rep), () => this.said(T("report.copied")));
    },
    said(text) { G.DataUI.notice(text); this.fill(); },

    // ---------------- Settings > Help ----------------
    bind() {
      const click = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
      click("btn-report-bug", () => this.open());
      G.WordReport.bind();
      this.fill();
    },
    fill() { this.fillReports(); G.WordReport.fill(); },
    async fillReports() {
      const box = $("set-reports"), P = G.SettingsUI.parts;
      if (!box) return;
      const list = (await G.ReportStore.all("reports")).reverse();
      if (!box.isConnected) return;
      box.innerHTML = list.length ? list.map((r) => P.row({
        id: "set-report-" + r.id, name: new Date(r.at).toLocaleString(G.locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + (r.form.category ? " · " + T("report.cat." + r.form.category) : ""),
        ctl: `<span class="set-btns">${P.button("btn-report-file-" + r.id, T("report.save"))}${P.button("btn-report-copy-" + r.id, T("report.copyShort"))}</span>`, desc: (r.form.text || T("report.noText")).slice(0, 90),
      })).join("") : `<p class="set-foot">${esc(T("help.none"))}</p>`;
      list.forEach((r) => {
        $("btn-report-file-" + r.id).onclick = () => G.DataUI.send(fileOf(r), () => this.said(T("report.saved")));
        $("btn-report-copy-" + r.id).onclick = () => G.DataUI.copy(summary(r), () => this.said(T("report.copied")));
      });
    },

    // ---------------- the toast ----------------
    // Nothing stops: the game goes on if it can.
    toast() {
      const el = $("diag-toast"), now = performance.now();
      if (!el || !G.save || this.shown || now - (this._toastAt || -1e9) < C().toastEveryMs) return;
      this._toastAt = now;
      const key = G.save.settings.keybinds.report;
      el.textContent = G.Input.mode === "touch" || !key ? T("report.toast") : T("report.toastKey", { key: G.keyLabel(key) });
      el.classList.remove("hidden");
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => this.hideToast(), C().toastMs);
    },
    hideToast() { clearTimeout(this._toastT); const el = $("diag-toast"); if (el) el.classList.add("hidden"); },
  };
  G.Diag.onError = () => R.toast();
  window.addEventListener("DOMContentLoaded", () => {
    $("diag-toast").onclick = () => R.open({ cat: "crash" });
    const late = () => { if (!G.save) setTimeout(late, 1000); else if (G.Diag.errors().length) R.toast(); };
    late();
  });
})();
