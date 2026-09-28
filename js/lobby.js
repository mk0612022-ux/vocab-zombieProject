// ===================================================================
// The lobby (round 4): a console-style carousel
// -------------------------------------------------------------------
//   top      two tabs -- CAMPAIGN, TRAINING & CUSTOM -- with the keys that
//            switch them, and a row of icons: Settings, Leaderboard,
//            Achievements, Armory, Word Log, Notes Journal, Custom, Bosses
//            (the Boss Codex, round 2), Help
//   upper    a large preview of the selected mode: its artwork (rendered
//            from the game itself, assets/lobby/), a big title, a line about
//            it, its badge, and what the player has done there (best score,
//            notes found, words mastered, guns found) -- or what unlocks it
//   middle   FEATURED
//   bottom   the cards, side by side: the selected one in the middle, bigger,
//            with a bright ring and a glow, and the button to press under it;
//            dots show where in the row you are
//
// Driven by keyboard (arrows or A/D, Enter or Space, Q/E for the tabs),
// mouse (click, wheel), touch (swipe, tap) and gamepad (D-pad or stick, A,
// LB/RB) -- and the hints at the bottom follow whichever was used last.
// Every animation is transform and opacity only, 300-450 ms on a console
// ease-out; choosing a mode zooms into its picture and fades to the game.
// ===================================================================
G.Lobby = {
  EASE: "cubic-bezier(0.22, 1, 0.36, 1)",
  TABS: ["campaign", "training"],
  MODES: [
    { id: "school", tab: "campaign", level: 1, badge: "featured", c1: "#ff9f43", c2: "#ee5a24", icon: "🏫" },
    { id: "hospital", tab: "campaign", level: 2, badge: "campaign", c1: "#1dd1a1", c2: "#0a8f86", icon: "🏥", needs: 2 },
    { id: "bunker", tab: "campaign", level: 3, badge: "campaign", c1: "#ff6b81", c2: "#a3203c", icon: "🛡️", needs: 3 },
    { id: "endless", tab: "campaign", badge: "survival", c1: "#a55eea", c2: "#5f27cd", icon: "♾️" },
    { id: "daily", tab: "campaign", badge: "daily", c1: "#feca57", c2: "#ff9f1a", icon: "📅" },
    { id: "practice", tab: "training", badge: "training", c1: "#55efc4", c2: "#00a86b", icon: "🎯" },
    { id: "custom", tab: "training", badge: "creative", c1: "#fd79a8", c2: "#a55eea", icon: "✏️" },
  ],
  // (B) each with its short name under it and its full name as a tooltip
  ICONS: [
    { id: "settings", glyph: "⚙️" }, { id: "leaderboard", glyph: "🏆" }, { id: "achievements", glyph: "🎖️" },
    { id: "armory", glyph: "🔫" }, { id: "wordlog", glyph: "📖" }, { id: "journal", glyph: "📜" },
    { id: "custom", glyph: "✏️" }, { id: "bosses", glyph: "💀" }, { id: "help", glyph: "❔" },
  ],
  tab: "campaign",
  sel: { campaign: 0, training: 0 },
  focus: "cards",
  iconI: 0,
  device: "kb",
  built: false,

  // ---------------- data ----------------
  modes(tab) { return this.MODES.filter((m) => m.tab === (tab || this.tab)); },
  current() { return this.modes()[this.sel[this.tab]] || this.modes()[0]; },
  locked(m) { return !!m.needs && !G.save.unlockedLevels.includes(m.needs); },
  art(m, card) { return "assets/lobby/" + m.id + (card ? "-card" : "") + ".jpg"; },
  title(m) { return m.level ? G.getLevel(m.level).name : G.T("lobby.mode." + m.id); },
  // the level's own 100 words (the player's added ones are not counted)
  wordsFor(levelId) { return G.CustomVocab.builtin(G.getLevel(levelId).wordsKey); },
  mastered(list) { return list.filter((p) => G.isWordMastered && G.isWordMastered(p[0])).length; },
  // what the player has done in this mode, as rows of [label, value]
  stats(m) {
    const T = G.T, S = G.save, rows = [];
    if (m.level) {
      const hs = S.levelHighScores[m.level];
      rows.push([T("lobby.best"), hs != null ? hs.toLocaleString("en-GB") : "–"]);
      const key = "level" + m.level, total = (G.NOTES[key] || []).length || 20;
      rows.push([T("lobby.notes"), (S.notes && S.notes[key] ? S.notes[key].length : 0) + " / " + total]);
      const words = this.wordsFor(m.level);
      rows.push([T("lobby.words"), this.mastered(words) + " / " + (words.length || 100)]);
      const guns = Object.values(G.WEAPON_DEFS).filter((w) => w.level === m.level);
      rows.push([T("lobby.guns"), guns.filter((w) => S.unlockedWeapons.includes(w.id)).length + " / " + guns.length]);
    } else if (m.id === "endless") {
      rows.push([T("lobby.best"), S.endlessHighScore ? S.endlessHighScore.toLocaleString("en-GB") : "–"]);
      rows.push([T("lobby.bestWave"), S.endlessHighWave || "–"]);
      const all = G.getAllBuiltinWords();
      rows.push([T("lobby.words"), this.mastered(all) + " / " + all.length]);
    } else if (m.id === "daily") {
      const today = S.dailyHighScores[G.dailyKey()];
      rows.push([T("lobby.today"), today != null ? today.toLocaleString("en-GB") : "–"]);
      rows.push([T("lobby.next"), this.countdown()]);
    } else if (m.id === "practice") {
      const all = G.getAllBuiltinWords();
      const weak = all.filter((p) => { const s = S.wordStats[p[0].toLowerCase()]; return s && s.wrong > 0 && !G.isWordMastered(p[0]); }).length;
      rows.push([T("lobby.words"), this.mastered(all) + " / " + all.length]);
      rows.push([T("lobby.weak"), weak]);
    } else if (m.id === "custom") {
      const n = Object.values(S.customWords || {}).reduce((a, l) => a + l.length, 0);
      rows.push([T("lobby.yourWords"), n]);
      rows.push([T("lobby.sets"), Object.keys(S.importedSets || {}).length]);
    }
    return rows;
  },
  // time to the next daily challenge (local midnight)
  countdown() {
    const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const p = (n) => String(n).padStart(2, "0");
    return p(Math.floor(s / 3600)) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60);
  },
  meta(m) {
    const T = G.T;
    if (m.level) { const l = G.getLevel(m.level); return T("lobby.waves", { n: l.waves }) + " · " + "★".repeat(Math.round(l.difficulty * 2)); }
    if (m.id === "daily") return "⏱ " + this.countdown();
    return T("lobby.meta." + m.id);
  },

  // ---------------- building ----------------
  build() {
    const root = document.getElementById("screen-mainmenu");
    if (!root) return;
    this.root = root;
    const T = G.T, esc = G.escapeHtml;
    root.innerHTML = `
      <div class="lobby" id="lobby">
        <div class="lobby-bg"><div class="lobby-bg-art" id="lobby-bg-art"></div><div class="lobby-bg-glow"></div><div class="lobby-embers">${"<i></i>".repeat(14)}</div></div>
        <div class="lobby-top">
          <div class="lobby-logo">${T("menu.title")}</div>
          <div class="lobby-tabs" role="tablist">
            <span class="lobby-key kb-only">Q</span><span class="lobby-key pad-only">LB</span>
            ${this.TABS.map((t) => `<button class="lobby-tab" role="tab" data-tab="${t}">${esc(T("lobby.tab." + t))}</button>`).join("")}
            <span class="lobby-key kb-only">E</span><span class="lobby-key pad-only">RB</span>
          </div>
          <div class="lobby-icons">${this.ICONS.map((ic) => `<button class="lobby-icon" data-icon="${ic.id}" data-tip="${esc(T("lobby.icon." + ic.id))}" aria-label="${esc(T("lobby.icon." + ic.id))}"><span class="li-glyph" aria-hidden="true">${ic.glyph}</span><span class="li-label" aria-hidden="true">${esc(T("lobby.iconShort." + ic.id))}</span></button>`).join("")}</div>
        </div>
        <div class="lobby-preview" id="lobby-preview">
          <div class="lp-art"><div class="lp-img" data-layer="0"></div><div class="lp-img" data-layer="1"></div></div>
          <div class="lp-scrim"></div>
          <div class="lp-text" id="lp-text">
            <div class="lp-badge" id="lp-badge"></div>
            <h2 class="lp-title" id="lp-title"></h2>
            <p class="lp-desc" id="lp-desc"></p>
            <div class="lp-stats" id="lp-stats"></div>
            <div class="lp-lock" id="lp-lock"></div>
          </div>
        </div>
        <div class="lobby-featured">${T("lobby.featured")}</div>
        <div class="lobby-carousel" id="lobby-carousel"><div class="lobby-track" id="lobby-track"></div></div>
        <div class="lobby-dots" id="lobby-dots"></div>
        <div class="lobby-confirm" id="lobby-confirm"></div>
        <div class="lobby-hints" id="lobby-hints">
          <span class="kb-only">${T("lobby.hint.kb")}</span>
          <span class="pad-only">${T("lobby.hint.pad")}</span>
          <span class="touch-only">${T("lobby.hint.touch")}</span>
        </div>
        <div class="lobby-footer">${T("menu.footer")}</div>
        <div class="lobby-launch" id="lobby-launch"></div>
      </div>`;
    this.el = (id) => document.getElementById(id);
    // fetch every picture now, so no crossfade ever fades in an empty frame
    this._pre = [];
    this.MODES.forEach((m) => [false, true].forEach((c) => { const im = new Image(); im.src = this.art(m, c); this._pre.push(im); }));
    this.layers = Array.from(root.querySelectorAll(".lp-img"));
    this.front = 0;
    this.bindInput();
    this.built = true;
    this.setDevice(G.Input && G.Input.mode === "touch" ? "touch" : "kb");
  },

  cardsFor(tab) {
    const esc = G.escapeHtml, T = G.T;
    return this.modes(tab).map((m) => {
      const lock = this.locked(m);
      return `<button class="lcard${lock ? " locked" : ""}" data-id="${m.id}" style="--c1:${m.c1};--c2:${m.c2};--c1a:${m.c1}bb" aria-label="${esc(this.title(m))}">
        <span class="lcard-bg"></span>
        <span class="lcard-art" style="background-image:url('${this.art(m, true)}')"></span>
        <span class="lcard-shade"></span>
        <span class="lcard-text"><span class="lcard-title">${esc(this.title(m))}</span><span class="lcard-meta">${esc(this.meta(m))}</span></span>
        <span class="lcard-badge">${esc(T("lobby.badge." + (lock ? "locked" : m.badge)))}</span>
        ${lock ? `<span class="lcard-lock" aria-hidden="true">🔒</span>` : ""}
        <span class="lcard-dim"></span>
        <span class="lcard-ring"></span>
      </button>`;
    }).join("");
  },

  // ---------------- showing ----------------
  open(opts) {
    opts = opts || {};
    if (!this.built) this.build();
    if (opts.tab) this.tab = opts.tab;
    if (opts.select) { const i = this.modes().findIndex((m) => m.id === opts.select); if (i >= 0) this.sel[this.tab] = i; }
    this.root.classList.remove("lobby-launching");
    this.el("lobby").classList.remove("launching");
    this.focus = "cards";
    this.renderTab(true);
    this.startClock();
  },
  renderTab(instant) {
    const track = this.el("lobby-track");
    track.innerHTML = this.cardsFor(this.tab);
    track.querySelectorAll(".lcard").forEach((c, i) => {
      c.onclick = (e) => {
        // the click that ends a swipe is not a tap
        if (this._dragged || performance.now() - (this._dragEnd || 0) < 250) { e.preventDefault(); return; }
        if (i === this.sel[this.tab]) this.launch(); else this.select(i);
      };
    });
    this.root.querySelectorAll(".lobby-tab").forEach((b) => { b.classList.toggle("active", b.dataset.tab === this.tab); b.setAttribute("aria-selected", b.dataset.tab === this.tab); });
    this.el("lobby-dots").innerHTML = this.modes().map(() => "<i></i>").join("");
    this.layout(instant);
    this.showPreview(instant);
  },
  // place every card: the selected one centred and larger, the rest beside
  // it, smaller and dimmed, the far ones faded out
  layout(instant) {
    const track = this.el("lobby-track");
    const cards = Array.from(track.children), s = this.sel[this.tab];
    // as many cards each side as fit whole on this screen; the rest fade out
    // at the edge rather than hang off it
    const cw = cards.length ? cards[0].offsetWidth : 1;
    const room = Math.max(1, Math.min(3, Math.floor((track.clientWidth / 2 - cw * 0.46) / (cw * 1.12))));
    cards.forEach((c, i) => {
      const off = i - s, a = Math.abs(off);
      c.style.transition = instant ? "none" : "";
      c.style.transform = `translateX(${off * 112}%) scale(${off === 0 ? 1.12 : 0.9 - Math.min(a, 3) * 0.02})`;
      c.style.opacity = a > room ? 0 : 1;
      c.style.pointerEvents = a > room ? "none" : "";
      c.style.zIndex = 10 - a;
      c.classList.toggle("sel", off === 0);
      c.setAttribute("tabindex", off === 0 ? "0" : "-1");
    });
    Array.from(this.el("lobby-dots").children).forEach((d, i) => d.classList.toggle("on", i === s));
    if (instant) void this.el("lobby-track").offsetWidth;
    cards.forEach((c) => { c.style.transition = ""; });
    this.updateConfirm();
    // the background drifts a little with the selection (parallax)
    const bg = this.el("lobby-bg-art");
    if (bg) bg.style.transform = `translateX(${-s * 1.2}%) scale(1.12)`;
  },
  updateConfirm() {
    const m = this.current(), T = G.T;
    const el = this.el("lobby-confirm");
    if (this.locked(m)) el.innerHTML = `<span class="lc-lock">🔒 ${G.escapeHtml(T("lobby.lockedShort"))}</span>`;
    else el.innerHTML = `<span class="kb-only"><kbd>Enter</kbd></span><span class="pad-only"><kbd class="pad-a">A</kbd></span><span class="touch-only">${G.escapeHtml(T("lobby.tapAgain"))}</span> ${G.escapeHtml(T(m.level || m.id === "endless" || m.id === "daily" ? "lobby.play" : "lobby.open"))}`;
  },
  // the big picture and the text: cross-faded, the new title rising in
  showPreview(instant) {
    const m = this.current(), T = G.T;
    const next = this.layers[1 - this.front], cur = this.layers[this.front];
    next.style.backgroundImage = `url('${this.art(m, false)}')`;
    next.classList.remove("zoom"); void next.offsetWidth; next.classList.add("zoom");
    next.classList.add("on"); cur.classList.remove("on");
    this.front = 1 - this.front;
    const bg = this.el("lobby-bg-art");
    if (bg) bg.style.backgroundImage = `url('${this.art(m, false)}')`;
    this.el("lobby-preview").style.setProperty("--c1", m.c1);
    this.el("lobby-preview").style.setProperty("--c2", m.c2);
    this.el("lobby-preview").style.setProperty("--c1a", m.c1 + "99");
    const lock = this.locked(m);
    this.el("lp-badge").textContent = T("lobby.badge." + (lock ? "locked" : m.badge));
    this.el("lp-title").textContent = this.title(m);
    this.el("lp-desc").textContent = T("lobby.desc." + m.id);
    this.renderStats();
    this.el("lp-lock").textContent = lock ? T("lobby.unlock." + m.id) : "";
    this.el("lp-lock").classList.toggle("hidden", !lock);
    const text = this.el("lp-text");
    text.classList.remove("in"); void text.offsetWidth; if (!instant) text.classList.add("in"); else text.classList.add("in", "now");
    if (instant) setTimeout(() => text.classList.remove("now"), 30);
  },
  renderStats() {
    const m = this.current();
    this.el("lp-stats").innerHTML = this.stats(m).map(([k, v]) => `<div class="lp-stat"><span class="lp-stat-v">${G.escapeHtml(String(v))}</span><span class="lp-stat-k">${G.escapeHtml(k)}</span></div>`).join("");
  },
  startClock() {
    clearInterval(this._clock);
    this._clock = setInterval(() => {
      if (!this.visible()) return;
      const m = this.current();
      if (m.id === "daily") this.renderStats();
      const d = this.el("lobby-track").querySelector('.lcard[data-id="daily"] .lcard-meta');
      if (d) d.textContent = this.meta(this.MODES.find((x) => x.id === "daily"));
    }, 1000);
  },
  visible() { return this.built && G.UI._currentScreen === "screen-mainmenu" && !this.root.classList.contains("hidden"); },

  // ---------------- moving about ----------------
  select(i) {
    const n = this.modes().length;
    i = Math.max(0, Math.min(n - 1, i));
    if (i === this.sel[this.tab]) { this.bump(i === 0 ? -1 : 1); return; }
    this.sel[this.tab] = i;
    this.focus = "cards"; this.markIcon(-1);
    this.layout(false);
    this.showPreview(false);
    if (G.Audio && G.Audio.ctx) G.Audio.tone({ type: "triangle", freq: 660, freqEnd: 720, dur: 0.05, gain: 0.05 });
  },
  move(d) { this.select(this.sel[this.tab] + d); },
  // at the end of the row: a small nudge instead of nothing
  bump(d) {
    const c = this.el("lobby-track").children[this.sel[this.tab]];
    if (!c) return;
    c.classList.remove("bump-l", "bump-r"); void c.offsetWidth; c.classList.add(d < 0 ? "bump-l" : "bump-r");
  },
  switchTab(d) {
    const i = (this.TABS.indexOf(this.tab) + d + this.TABS.length) % this.TABS.length;
    this.tab = this.TABS[i];
    this.focus = "cards"; this.markIcon(-1);
    this.renderTab(false);
    if (G.Audio && G.Audio.ctx) G.Audio.tone({ type: "triangle", freq: 520, freqEnd: 780, dur: 0.08, gain: 0.05 });
  },
  markIcon(i) {
    this.iconI = i < 0 ? this.iconI : i;
    const btns = this.root.querySelectorAll(".lobby-icon");
    btns.forEach((b, k) => b.classList.toggle("pad-focus", i >= 0 && k === i));
    // the full name shows while the keys or a controller are on it
    if (G.Tips) { if (i >= 0 && btns[i]) G.Tips.show(btns[i]); else G.Tips.hide(); }
  },
  focusIcons(on) {
    this.focus = on ? "icons" : "cards";
    this.markIcon(on ? this.iconI || 0 : -1);
    this.el("lobby-track").classList.toggle("dimmed", on);
  },
  openIcon(id) {
    const UI = G.UI;
    if (id === "settings") { UI._settingsReturn = "screen-mainmenu"; UI.renderSettings(); UI.showScreen("screen-settings"); }
    else if (id === "leaderboard") { UI.renderLeaderboard("level1"); UI.showScreen("screen-leaderboard"); }
    else if (id === "achievements") { UI.renderAchievements(); UI.showScreen("screen-achievements"); }
    else if (id === "armory") { UI._logReturnScreen = "screen-mainmenu"; UI.renderWeaponLog(1); UI.showScreen("screen-weaponlog"); }
    else if (id === "wordlog") { UI._logReturnScreen = "screen-mainmenu"; UI.renderVocabLog(1); UI.showScreen("screen-vocablog"); }
    else if (id === "journal") UI.openJournal("screen-mainmenu");
    else if (id === "custom") G.CustomVocabUI.open("screen-mainmenu");
    else if (id === "bosses") UI.openCodex("screen-mainmenu");
    else if (id === "help") UI.showScreen("screen-howtoplay");
    if (G.Tips) G.Tips.hide();
  },

  // ---------------- choosing ----------------
  launch() {
    const m = this.current();
    if (this._launching) return;
    if (this.locked(m)) {
      const c = this.el("lobby-track").children[this.sel[this.tab]];
      c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
      this.el("lp-lock").classList.remove("pulse"); void this.el("lp-lock").offsetWidth; this.el("lp-lock").classList.add("pulse");
      if (G.Audio && G.Audio.ctx) G.Audio.sfx("wrong");
      return;
    }
    if (G.Audio) { G.Audio.unlock && G.Audio.unlock(); G.Audio.ctx && G.Audio.sfx("unlock"); }
    // into the picture, then to black, then the game
    this._launching = true;
    this.el("lobby").classList.add("launching");
    const go = () => {
      this._launching = false;
      if (m.level) G.Game.startLevel(m.level);
      else if (m.id === "endless") G.Game.startEndless();
      else if (m.id === "daily") G.Game.startDailyChallenge();
      else if (m.id === "practice") G.Game.goToPracticeSetup();
      else if (m.id === "custom") G.CustomVocabUI.open("screen-mainmenu");
      this.el("lobby").classList.remove("launching");
    };
    setTimeout(go, this.instant ? 0 : 480);
  },

  // ---------------- input ----------------
  setDevice(d) {
    if (this.device === d && document.body.dataset.input === d) return;
    this.device = d;
    document.body.dataset.input = d;
  },
  onKey(e) {
    if (!this.visible()) return false;
    this.setDevice("kb");
    const k = e.code;
    if (this.focus === "icons") {
      if (k === "ArrowLeft" || k === "KeyA") { this.markIcon((this.iconI + this.ICONS.length - 1) % this.ICONS.length); return true; }
      if (k === "ArrowRight" || k === "KeyD") { this.markIcon((this.iconI + 1) % this.ICONS.length); return true; }
      if (k === "ArrowDown" || k === "KeyS" || k === "Escape") { this.focusIcons(false); return true; }
      if (k === "Enter" || k === "Space") { e.preventDefault(); this.openIcon(this.ICONS[this.iconI].id); return true; }
    }
    if (k === "ArrowLeft" || k === "KeyA") { this.move(-1); return true; }
    if (k === "ArrowRight" || k === "KeyD") { this.move(1); return true; }
    if (k === "ArrowUp" || k === "KeyW") { this.focusIcons(true); return true; }
    if (k === "ArrowDown" || k === "KeyS") { this.focusIcons(false); return true; }
    if (k === "KeyQ") { this.switchTab(-1); return true; }
    if (k === "KeyE") { this.switchTab(1); return true; }
    if (k === "Enter" || k === "Space") { e.preventDefault(); this.launch(); return true; }
    if (k === "Escape") return true;          // already at the top
    return false;
  },
  // the gamepad, from G.Pad.navigate while the lobby is on screen
  pad(gp, now, edge, dt) {
    this.setDevice("pad");
    const B = G.Pad.B, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    let dir = null;
    if (now[B.LEFT] || ax < -0.6) dir = "left";
    else if (now[B.RIGHT] || ax > 0.6) dir = "right";
    else if (now[B.UP] || ay < -0.6) dir = "up";
    else if (now[B.DOWN] || ay > 0.6) dir = "down";
    const act = (d) => {
      if (d === "up") this.focusIcons(true);
      else if (d === "down") this.focusIcons(false);
      else if (this.focus === "icons") this.markIcon((this.iconI + (d === "left" ? -1 : 1) + this.ICONS.length) % this.ICONS.length);
      else this.move(d === "left" ? -1 : 1);
    };
    if (dir !== this._padDir) { this._padDir = dir; this._padT = 0; if (dir) act(dir); }
    else if (dir && dir !== "up" && dir !== "down") { this._padT += dt; if (this._padT > 0.34) { this._padT = 0.22; act(dir); } }
    if (edge(B.LB)) this.switchTab(-1);
    if (edge(B.RB)) this.switchTab(1);
    if (edge(B.A)) { if (this.focus === "icons") this.openIcon(this.ICONS[this.iconI].id); else this.launch(); }
    if (edge(B.B) && this.focus === "icons") this.focusIcons(false);
  },
  bindInput() {
    const car = this.el("lobby-carousel");
    // wheel: one card a notch (a trackpad's stream of small deltas is
    // throttled to the same pace)
    car.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setDevice("kb");
      const now = performance.now();
      if (now - (this._wheelAt || 0) < 180) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 4) return;
      this._wheelAt = now;
      this.move(d > 0 ? 1 : -1);
    }, { passive: false });
    // swipe: drag the row sideways; a long enough drag moves one card (two
    // for a fling), and the tap that ends a drag does not count as a tap
    let x0 = null, t0 = 0, id = null;
    car.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") this.setDevice("touch");
      x0 = e.clientX; t0 = performance.now(); id = e.pointerId; this._dragged = false;
    });
    car.addEventListener("pointermove", (e) => {
      if (x0 == null || e.pointerId !== id) return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 12) this._dragged = true;
      if (this._dragged) this.el("lobby-track").style.transform = `translateX(${dx * 0.35}px)`;
    });
    const end = (e) => {
      if (x0 == null || e.pointerId !== id) return;
      const dx = e.clientX - x0, dt = Math.max(1, performance.now() - t0);
      this.el("lobby-track").style.transform = "";
      x0 = null;
      if (Math.abs(dx) > 40) {
        const steps = Math.abs(dx) / dt > 0.9 ? 2 : 1;
        this.move(dx < 0 ? steps : -steps);
      }
      if (this._dragged) this._dragEnd = performance.now();
      this._dragged = false;
    };
    car.addEventListener("pointerup", end);
    car.addEventListener("pointercancel", end);
    this.root.querySelectorAll(".lobby-tab").forEach((b) => { b.onclick = () => { if (b.dataset.tab !== this.tab) this.switchTab(this.TABS.indexOf(b.dataset.tab) - this.TABS.indexOf(this.tab)); }; });
    this.root.querySelectorAll(".lobby-icon").forEach((b) => { b.onclick = () => this.openIcon(b.dataset.icon); });
    this.el("lobby-preview").onclick = () => { if (!this.locked(this.current())) this.launch(); };
    // how many cards fit changes with the window (a phone turned round)
    window.addEventListener("resize", () => { if (this.visible()) this.layout(true); });
    // which kind of input was used last decides the hints
    window.addEventListener("mousemove", (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2 && this.device !== "kb" && this.device !== "pad") this.setDevice("kb"); }, { passive: true });
    window.addEventListener("touchstart", () => this.setDevice("touch"), { passive: true });
    window.addEventListener("keydown", () => { if (this.device !== "kb") this.setDevice("kb"); });
  },
};
