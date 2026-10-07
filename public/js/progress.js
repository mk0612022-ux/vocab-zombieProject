// ===================================================================
// The Progress page (vocabulary series, round 4, I)
// -------------------------------------------------------------------
// From the lobby's Progress icon. Two tabs, kept apart on purpose:
//   Learning  what the player knows -- the words by box (New, Learning:
//             boxes 1-3, Review: 4-5, Mastered) and those due today; the
//             AWL words Mastered, sublist by sublist; how often they are
//             right by topic and by skill (recognition, spelling,
//             listening, paraphrase, context); the ten words missed most
//             (with "Practise these"); the last thirty days' answers and
//             the review streak; what comes due tomorrow and this week
//   Game      what the player has done in the game -- scores, waves, guns,
//             notes, bosses, achievements
// Every chart is drawn here, as SVG: no library. Any word on the page opens
// its vocabulary card (which moves no box). The numbers come from
// G.Progress.data() (the tests read it too); G.CONFIG.progress sets how many
// words and days are shown.
// Mouse, touch, keys (Tab / arrows, Enter, Q / E the tabs, Esc back) and a
// controller (D-pad, A, LB / RB the tabs, B back).
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));
  const $ = (id) => document.getElementById(id);
  const P = () => G.CONFIG.progress;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  // a day number (G.Clock.today()) as "3 Oct"
  const dayName = (d) => new Date(d * 864e5).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const COLORS = { fresh: "#5c6b75", learning: "#ffb340", review: "#48a8ff", mastered: "#4fe37a" };

  G.Progress = {
    tab: "learn",

    // ---------------- the numbers ----------------
    data() {
      const today = G.Clock.today();
      const L = G.save.learn;
      const pool = G.SRS.pool();
      const kindOf = (p) => { const b = G.SRS.box(p); return b === 0 ? "fresh" : b <= 3 ? "learning" : b <= 5 ? "review" : "mastered"; };
      const overview = { fresh: 0, learning: 0, review: 0, mastered: 0, total: pool.length };
      pool.forEach((p) => { overview[kindOf(p)]++; });
      const f = G.SRS.forecast();
      overview.due = f.today;
      // AWL: by sublist, and Mastered of all
      const subs = [];
      for (let i = 1; i <= 10; i++) subs.push({ n: i, total: 0, mastered: 0, review: 0, learning: 0 });
      G.WordBank.entries().forEach((e) => {
        if (e.source !== "AWL" || !e.awlSublist || !subs[e.awlSublist - 1]) return;
        const s = subs[e.awlSublist - 1], k = kindOf(e.id);
        s.total++;
        if (k !== "fresh") s[k]++;
      });
      const awlTotal = subs.reduce((a, s) => a + s.total, 0), awlMastered = subs.reduce((a, s) => a + s.mastered, 0);
      // right and wrong by topic (the long-term statistics of its words)
      const topics = {};
      G.WORD_TOPICS.forEach((t) => { topics[t] = { topic: t, r: 0, w: 0, words: 0 }; });
      pool.forEach((p) => {
        const e = G.WordBank.info(p), t = e && topics[e.topic];
        if (!t) return;
        t.words++;
        const s = G.wordStat(p);
        if (s) { t.r += s.correct || 0; t.w += s.wrong || 0; }
      });
      const skills = G.Learning.SKILLS.map((k) => ({ skill: k, r: L.skills[k] ? L.skills[k].r : 0, w: L.skills[k] ? L.skills[k].w : 0 }));
      // the words missed most
      const missed = G.Practice.byMisses(pool.filter((p) => G.Practice.misses(p)[0] > 0)).slice(0, P().topMissed)
        .map((p) => { const s = G.wordStat(p); return { pair: p, wrong: s.wrong, right: s.correct }; });
      // the last thirty days
      const days = [];
      for (let d = today - P().days + 1; d <= today; d++) days.push({ day: d, n: L.activity[d] || 0 });
      // the next seven
      const next = [];
      for (let d = today + 1; d <= today + 7; d++) next.push({ day: d, n: 0 });
      pool.forEach((p) => { const s = G.SRS.state(p); if (s && s.due > today && s.due <= today + 7) next[s.due - today - 1].n++; });
      return {
        today, overview, awl: { subs, total: awlTotal, mastered: awlMastered },
        topics: G.WORD_TOPICS.map((t) => topics[t]), skills, missed, days,
        streak: G.SRS.streakNow(), best: L.daily.best, forecast: { tomorrow: f.tomorrow, week: f.week, next },
      };
    },
    // the game side
    gameData() {
      const S = G.save;
      const guns = Object.values(G.WEAPON_DEFS);
      const notesTotal = ["level1", "level2", "level3"].reduce((n, k) => n + ((G.NOTES[k] || []).length || 20), 0);
      const notes = ["level1", "level2", "level3"].reduce((n, k) => n + (S.notes[k] || []).length, 0);
      const defs = G.BOSS_DEFS || [];
      const bosses = Array.isArray(defs) ? defs.length : Object.keys(defs).length;
      return {
        levels: G.LEVELS.map((l) => ({ id: l.id, name: l.name, best: S.levelHighScores[l.id], unlocked: S.unlockedLevels.includes(l.id) })),
        endless: S.endlessHighScore || 0, endlessWave: S.endlessHighWave || 0,
        daily: S.dailyHighScores[G.dailyKey()],
        guns: { have: guns.filter((w) => S.unlockedWeapons.includes(w.id)).length, total: guns.length },
        notes: { have: notes, total: notesTotal },
        bosses: { beaten: Object.keys(S.bosses.defeated).length, total: bosses },
        achievements: { have: G.ACHIEVEMENTS.filter((a) => S.achievements[a.id]).length, total: G.ACHIEVEMENTS.length },
      };
    },

    // ---------------- the page ----------------
    open(tab) {
      if (tab) this.tab = tab;
      this.render();
      G.UI.showScreen("screen-progress");
      G.Game.state = "MENU";
      $("progress-body").scrollTop = 0;
    },
    close() { G.UI.goToMainMenu(); },
    setTab(t) {
      if (t === this.tab) return;
      this.tab = t;
      this.render();
      const b = document.querySelector(`#screen-progress [data-pgtab="${t}"]`);
      if (b && G.Input.mode !== "touch") { b.focus({ preventScroll: true }); if (G.Pad.focused) G.Pad.setFocus(b); }
    },
    render() {
      document.querySelectorAll("#screen-progress [data-pgtab]").forEach((b) => { const on = b.dataset.pgtab === this.tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      const body = $("progress-body");
      body.innerHTML = this.tab === "game" ? this.gameHtml(this.gameData()) : this.learnHtml(this.data());
      body.querySelectorAll("[data-word]").forEach((b) => { b.onclick = () => { const p = this._words[+b.dataset.word]; if (p) G.VocabCard.open(p); }; });
      const pr = $("btn-progress-practise");
      if (pr) pr.onclick = () => G.Practice.startList(this._missed, "screen-progress");
      body.querySelectorAll("[data-goto]").forEach((b) => { b.onclick = () => this.go(b.dataset.goto); });
    },
    go(where) {
      if (where === "review") { G.UI.goToMainMenu({ tab: "training", select: "review" }); }
    },

    // a card of the page
    card(cls, title, inner, sub) {
      return `<section class="pg-card ${cls}"><h3 class="pg-h">${esc(title)}</h3>${sub ? `<div class="pg-sub">${sub}</div>` : ""}${inner}</section>`;
    },
    // a horizontal bar: segments [{v, color}] of `max`
    bar(segs, max, label) {
      let x = 0;
      const rects = segs.filter((s) => s.v > 0).map((s) => { const w = max ? (s.v / max) * 100 : 0; const r = `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="10" fill="${s.color}"/>`; x += w; return r; }).join("");
      return `<svg class="pg-bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><rect x="0" y="0" width="100" height="10" class="pg-track"/>${rects}</svg>`;
    },
    // a word the player can open
    wordBtn(pair, extra) {
      const i = this._words.push(pair) - 1;
      return `<button class="pg-word" type="button" data-word="${i}"><b lang="en">${esc(pair[0])}${G.POS.tag(pair)}</b><span lang="th">${esc(pair[1] || "")}</span>${extra ? `<em>${esc(extra)}</em>` : ""}</button>`;
    },

    learnHtml(d) {
      this._words = [];
      const o = d.overview;
      // 1. the words by box
      const kinds = [["fresh", T("progress.new")], ["learning", T("progress.learning")], ["review", T("progress.review")], ["mastered", T("progress.mastered")]];
      const tiles = kinds.map(([k, name]) => `<div class="pg-tile" style="--c:${COLORS[k]}"><b>${o[k]}</b><span>${esc(name)}</span><small>${esc(T("progress.kindDesc." + k))}</small></div>`).join("")
        + `<button class="pg-tile pg-due" type="button" data-goto="review" style="--c:#ff6b81"><b>${o.due}</b><span>${esc(T("progress.dueToday"))}</span><small>${esc(T(o.due ? "progress.dueGo" : "progress.dueNone"))}</small></button>`;
      const split = this.bar(kinds.map(([k]) => ({ v: o[k], color: COLORS[k] })), o.total, T("progress.splitLabel", { n: o.total }));
      const overview = this.card("pg-overview", T("progress.overview"), `<div class="pg-tiles">${tiles}</div>${split}<div class="pg-legend">${kinds.map(([k, n]) => `<span><i style="background:${COLORS[k]}"></i>${esc(n)} ${pct(o[k], o.total)}%</span>`).join("")}</div>`, esc(T("progress.overviewSub", { n: o.total })));
      // 2. AWL
      const awlRows = d.awl.subs.map((s) => `<div class="pg-row"><span class="pg-rl">${esc(T("progress.sublist", { n: s.n }))}</span>${this.bar([{ v: s.mastered, color: COLORS.mastered }, { v: s.review, color: COLORS.review }, { v: s.learning, color: COLORS.learning }], s.total, T("progress.sublistLabel", { n: s.n, m: s.mastered, t: s.total }))}<span class="pg-rv">${s.mastered}/${s.total}</span></div>`).join("");
      const awl = this.card("pg-awl", T("progress.awl"), `<div class="pg-big">${esc(T("progress.awlLine", { x: d.awl.mastered, n: d.awl.total, y: pct(d.awl.mastered, d.awl.total) }))}</div>
        ${this.bar([{ v: d.awl.mastered, color: COLORS.mastered }], d.awl.total, T("progress.awlLine", { x: d.awl.mastered, n: d.awl.total, y: pct(d.awl.mastered, d.awl.total) }))}
        <div class="pg-rows">${awlRows}</div>
        <div class="pg-legend"><span><i style="background:${COLORS.mastered}"></i>${esc(T("progress.mastered"))}</span><span><i style="background:${COLORS.review}"></i>${esc(T("progress.review"))}</span><span><i style="background:${COLORS.learning}"></i>${esc(T("progress.learning"))}</span></div>`);
      // 3. accuracy, by topic and by skill
      const accRow = (name, r, w) => {
        const n = r + w, a = pct(r, n);
        const color = !n ? "#5c6b75" : a >= 80 ? COLORS.mastered : a >= 60 ? COLORS.learning : "#ff6b6b";
        return `<div class="pg-row"><span class="pg-rl">${esc(name)}</span>${this.bar([{ v: n ? a : 0, color }], 100, T("progress.accLabel", { name, a: n ? a + "%" : "–", n }))}<span class="pg-rv">${n ? a + "%" : "–"}<small>${n ? esc(T("progress.answers", { n })) : ""}</small></span></div>`;
      };
      const topics = this.card("pg-topics", T("progress.byTopic"), `<div class="pg-rows">${d.topics.filter((t) => t.words).map((t) => accRow(G.topicLabel(t.topic), t.r, t.w)).join("")}</div>`);
      const skills = this.card("pg-skills", T("progress.bySkill"), `<div class="pg-rows">${d.skills.map((s) => accRow(T("progress.skill." + s.skill), s.r, s.w)).join("")}</div><p class="pg-note">${esc(T("progress.skillNote"))}</p>`);
      // 4. the words missed most
      this._missed = d.missed.map((m) => m.pair);
      const missed = this.card("pg-missed", T("progress.missed", { n: P().topMissed }), d.missed.length
        ? `<div class="pg-words">${d.missed.map((m) => this.wordBtn(m.pair, T("progress.missedTimes", { n: m.wrong }))).join("")}</div>
           <div class="row-center"><button class="btn btn-primary" id="btn-progress-practise" type="button">🎯 ${esc(T("progress.practise"))}</button></div>`
        : `<p class="pg-empty">${esc(T("progress.missedNone"))}</p>`);
      // 5. the last thirty days, and the streak
      const max = Math.max(5, ...d.days.map((x) => x.n));
      const W = 300, H = 96, bw = W / d.days.length;
      const cols = d.days.map((x, i) => {
        const h = Math.round((x.n / max) * (H - 14));
        return `<rect class="pg-col${x.day === d.today ? " today" : ""}" x="${(i * bw + 1).toFixed(1)}" y="${H - h}" width="${(bw - 2).toFixed(1)}" height="${Math.max(x.n ? 2 : 0, h)}"><title>${esc(T("progress.dayLabel", { d: dayName(x.day), n: x.n }))}</title></rect>`;
      }).join("");
      // (a date every week, and today -- not one so close to it that they overlap)
      const ticks = d.days.map((x, i) => ((i % 7 === 0 && i <= d.days.length - 5) || i === d.days.length - 1) ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${H + 11}" text-anchor="middle">${esc(dayName(x.day))}</text>` : "").join("");
      const total = d.days.reduce((a, x) => a + x.n, 0), active = d.days.filter((x) => x.n).length;
      const chart = `<svg class="pg-chart" viewBox="0 -4 ${W} ${H + 18}" role="img" aria-label="${esc(T("progress.activityLabel", { n: total, d: active }))}">
          <line x1="0" y1="${H}" x2="${W}" y2="${H}" class="pg-axis"/><line x1="0" y1="${H - (H - 14)}" x2="${W}" y2="${H - (H - 14)}" class="pg-grid"/>
          <text x="${W}" y="${H - (H - 14) - 2}" text-anchor="end" class="pg-max">${max}</text>${cols}${ticks}</svg>`;
      const activity = this.card("pg-activity", T("progress.activity", { n: P().days }), `${chart}
        <div class="pg-tiles small"><div class="pg-tile" style="--c:#ff9f43"><b>🔥 ${d.streak}</b><span>${esc(T("progress.streak"))}</span></div><div class="pg-tile" style="--c:#feca57"><b>${d.best}</b><span>${esc(T("progress.bestStreak"))}</span></div><div class="pg-tile" style="--c:#48a8ff"><b>${total}</b><span>${esc(T("progress.answered", { n: P().days }))}</span></div><div class="pg-tile" style="--c:#a29bfe"><b>${active}</b><span>${esc(T("progress.activeDays"))}</span></div></div>`, esc(T("progress.activitySub")));
      // 6. what comes due
      const fmax = Math.max(4, ...d.forecast.next.map((x) => x.n));
      const fw = 140, fh = 50, fb = fw / 7;
      const fcols = d.forecast.next.map((x, i) => { const h = Math.round((x.n / fmax) * (fh - 10)); return `<rect class="pg-col fc" x="${(i * fb + 2).toFixed(1)}" y="${fh - h}" width="${(fb - 4).toFixed(1)}" height="${h}"><title>${esc(T("progress.dueLabel", { d: dayName(x.day), n: x.n }))}</title></rect><text x="${(i * fb + fb / 2).toFixed(1)}" y="${fh + 9}" text-anchor="middle">${esc(new Date(x.day * 864e5).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" }))}</text>${x.n ? `<text x="${(i * fb + fb / 2).toFixed(1)}" y="${fh - h - 2}" text-anchor="middle" class="pg-n">${x.n}</text>` : ""}`; }).join("");
      const forecast = this.card("pg-forecast", T("progress.forecast"), `<div class="pg-fc-row"><div class="pg-tiles small"><div class="pg-tile" style="--c:#48a8ff"><b>${d.forecast.tomorrow}</b><span>${esc(T("progress.tomorrow"))}</span></div><div class="pg-tile" style="--c:#a29bfe"><b>${d.forecast.week}</b><span>${esc(T("progress.week"))}</span></div></div>
        <svg class="pg-chart pg-fchart" viewBox="0 -6 ${fw} ${fh + 16}" role="img" aria-label="${esc(T("progress.forecastLabel", { n: d.forecast.week }))}"><line x1="0" y1="${fh}" x2="${fw}" y2="${fh}" class="pg-axis"/>${fcols}</svg></div>`);
      return `<div class="pg-grid2">${overview}${awl}${topics}${skills}${missed}${activity}${forecast}</div>
        <p class="pg-foot">${esc(T("progress.tapWord"))}</p>`;
    },

    gameHtml(g) {
      const fmt = (n) => (n != null && n !== 0 ? Number(n).toLocaleString("en-GB") : "–");
      const levels = g.levels.map((l) => `<div class="pg-row"><span class="pg-rl">${esc(T("common.levelNamed", { n: l.id, name: l.name }))}</span><span class="pg-rv big">${l.unlocked ? fmt(l.best) : "🔒"}</span></div>`).join("");
      const tile = (c, v, name) => `<div class="pg-tile" style="--c:${c}"><b>${esc(v)}</b><span>${esc(name)}</span></div>`;
      return `<div class="pg-grid2">
        ${this.card("pg-scores", T("progress.scores"), `<div class="pg-rows">${levels}
          <div class="pg-row"><span class="pg-rl">${esc(T("lobby.mode.endless"))}</span><span class="pg-rv big">${fmt(g.endless)}<small>${g.endlessWave ? esc(T("progress.wave", { n: g.endlessWave })) : ""}</small></span></div>
          <div class="pg-row"><span class="pg-rl">${esc(T("progress.dailyToday"))}</span><span class="pg-rv big">${fmt(g.daily)}</span></div></div>`)}
        ${this.card("pg-found", T("progress.collection"), `<div class="pg-tiles">${tile("#ff9f43", g.guns.have + " / " + g.guns.total, T("progress.guns"))}${tile("#feca57", g.notes.have + " / " + g.notes.total, T("progress.notes"))}${tile("#ff6b81", g.bosses.beaten + " / " + g.bosses.total, T("progress.bosses"))}${tile("#4fe37a", g.achievements.have + " / " + g.achievements.total, T("progress.achievements"))}</div>`)}
      </div><p class="pg-foot">${esc(T("progress.gameNote"))}</p>`;
    },

    key(e) {
      if (G.UI._currentScreen !== "screen-progress" || G.Modal.isOpen()) return false;
      if (e.code === "Escape" || e.code === "Backspace") { this.close(); return true; }
      if (e.code === "KeyQ") { this.setTab("learn"); return true; }
      if (e.code === "KeyE") { this.setTab("game"); return true; }
      return false;
    },
  };

  if (!G.UI.ALL_SCREENS.includes("screen-progress")) G.UI.ALL_SCREENS.push("screen-progress");
  window.addEventListener("DOMContentLoaded", () => {
    $("btn-progress-back").onclick = () => G.Progress.close();
    document.querySelectorAll("#screen-progress [data-pgtab]").forEach((b) => { b.onclick = () => G.Progress.setTab(b.dataset.pgtab); });
    window.addEventListener("keydown", (e) => { if (G.Progress.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); } });
  });
})();
