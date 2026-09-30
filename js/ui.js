// ============================================================
// UI: menus, HUD, settings, leaderboard, achievements, import,
//     practice mode screens, shop screen, crate screen
// ============================================================
window.G = window.G || {};

G.UI = {
  el(id) { return document.getElementById(id); },

  ALL_SCREENS: [
    "screen-mainmenu", "screen-levelselect", "screen-howtoplay", "screen-settings",
    "screen-leaderboard", "screen-achievements", "screen-import", "screen-practice-setup",
    "screen-practice-play", "screen-shop", "screen-crate", "screen-pause",
    "screen-gameover", "screen-victory", "screen-vocablog", "screen-weaponlog",
    "screen-mystery", "screen-inventory", "screen-customvocab",
  ],

  showScreen(id) {
    // Crossfade instead of an instant cut: the outgoing screen fades out
    // briefly before being hidden, the incoming one fades/scales in.
    const prevId = this._currentScreen;
    if (prevId && prevId !== id && !this.el(prevId).classList.contains("hidden")) {
      const prevEl = this.el(prevId);
      prevEl.classList.add("fade-out");
      // (unless it has been shown again in the meantime -- closing one note
      // and opening the next, or backing out of a menu at once, used to hide
      // the screen that had just come back)
      setTimeout(() => { prevEl.classList.remove("fade-out"); if (this._currentScreen !== prevId) prevEl.classList.add("hidden"); }, 150);
      this.ALL_SCREENS.forEach((s) => { if (s !== id && s !== prevId) this.el(s).classList.add("hidden"); });
    } else {
      this.ALL_SCREENS.forEach((s) => { if (s !== id) this.el(s).classList.add("hidden"); });
    }
    if (id) {
      const el = this.el(id);
      el.classList.remove("hidden", "fade-in", "fade-out");
      void el.offsetWidth; // restart the animation even if this screen was already showing recently
      el.classList.add("fade-in");
    }
    this._currentScreen = id;
    if (G.Tips) G.Tips.hide();
    // the lobby is refreshed each time it comes back (scores, notes, words
    // and locks may have changed behind it)
    if (id === "screen-mainmenu" && G.Lobby) G.Lobby.open(this._lobbyOpts);
    this._lobbyOpts = null;
    // a new version found during a run is offered once back in the lobby
    if (id === "screen-mainmenu" && G.PWA) G.PWA.maybeShow();
  },
  hideAllScreens() { this.showScreen(null); },
  setHudVisible(v) {
    this.el("hud").classList.toggle("hidden", !v);
    // (new series, round 1, F) the player's HUD sizes, fitted to the screen
    if (v && G.HudCfg) G.HudCfg.refresh();
  },
  setTouchControlsVisible(v) {
    this.el("touch-controls").classList.toggle("hidden", !v);
    // A hidden control measures 0x0, so a stored custom position can only be
    // resolved to pixels once it is on screen.
    if (v && G.TouchCfg) G.TouchCfg.apply();
  },

  applyControlMode() {
    // The layout editor owns the controls while it is open -- it shows them
    // outside gameplay on purpose, and this would hide them again.
    if (G.TouchCfg && G.TouchCfg.editing) return;
    const mode = G.Input.mode;
    this.setTouchControlsVisible(mode === "touch" && G.Game && G.Game.state === "GAMEPLAY");
    const was = document.body.classList.contains("touch-mode");
    document.body.classList.toggle("touch-mode", mode === "touch");
    // (the HUD is laid out differently for touch: fit its sizes again)
    if (was !== (mode === "touch") && G.HudCfg) G.HudCfg.refresh();
  },
  // On-screen weapon switcher: one button per slot the player actually holds
  // (knife + up to four guns, six with the Extra Weapon Slot perk), rebuilt
  // only when the loadout or selection changes so it isn't re-rendered every
  // frame. Empty slots get no button.
  refreshTouchSlots(slots, activeIndex) {
    slots = slots.filter((s) => !s.empty);
    const wrap = this.el("touch-slots");
    const sig = slots.length + ":" + activeIndex;
    if (this._touchSlotSig === sig) return;
    this._touchSlotSig = sig;
    wrap.innerHTML = slots.map((s, i) =>
      `<button class="touch-slot-btn${i === activeIndex ? " active" : ""}${i === 0 ? " icon-btn" : ""}" data-slot="${i}"${i === 0 ? ` data-label="${G.T("touch.knifeLabel")}"` : ""}>${i === 0 ? "🔪" : i + 1}</button>`
    ).join("");
  },

  init() {
    if (G.Tips) G.Tips.init();
    this.bindMainMenu();
    this.bindLevelSelect();
    this.bindHowTo();
    this.bindSettings();
    this.bindLeaderboard();
    this.bindAchievements();
    this.bindVocabLog();
    this.bindWeaponLog();
    this.bindImport();
    this.bindPractice();
    this.bindPause();
    this.bindGameOverVictory();
    this.bindShop();
    this.bindCrate();
    this.bindMystery();
    G.CustomVocabUI.bind();
    if (this.bindJournal) this.bindJournal();
    if (this.bindCodex) this.bindCodex();
    this.applyFontSizeClass();
  },

  applyFontSizeClass() {
    document.body.classList.remove("font-small", "font-large");
    const fs = G.save.settings.fontSize;
    if (fs === "small") document.body.classList.add("font-small");
    if (fs === "large") document.body.classList.add("font-large");
  },

  // ---------------- Main menu ----------------
  // (round 4: the main menu is the lobby carousel, js/lobby.js -- every mode
  // and every menu the old button list had is a card or an icon there; the
  // tutorial replay moved to How to Play, Import to Custom Vocabulary)
  bindMainMenu() {
    G.Lobby.build();
    this.el("btn-tutorial-replay").onclick = () => { G.Tutorial.reset(); G.Game.newRun(1); };
  },
  goToMainMenu(opts) {
    this._lobbyOpts = opts || null;
    this.showScreen("screen-mainmenu"); this.setHudVisible(false); this.setTouchControlsVisible(false);
  },

  // ---------------- Level select ----------------
  bindLevelSelect() {
    this.el("btn-levelselect-back").onclick = () => this.goToMainMenu();
  },
  renderLevelSelect() {
    const wrap = this.el("level-cards");
    wrap.innerHTML = "";
    G.LEVELS.forEach((lvl, i) => {
      const unlocked = G.save.unlockedLevels.includes(lvl.id);
      const card = document.createElement("div");
      card.className = "level-card" + (unlocked ? "" : " locked");
      const hs = G.save.levelHighScores[lvl.id];
      card.innerHTML = `
        <div class="level-card-thumb">${lvl.icon}</div>
        <div class="level-card-body">
          <div class="level-card-title">${G.T("common.levelNamed", { n: lvl.id, name: lvl.name })}</div>
          <div class="level-card-sub">${G.T("levels.info", { waves: lvl.waves, diff: lvl.difficulty.toFixed(1) })}</div>
          ${unlocked ? `<div class="level-card-score">${G.T("levels.best", { score: hs || "-" })}</div>` : `<div class="level-card-lock">${G.T("levels.locked")}</div>`}
        </div>`;
      // (round 3: a level with a checkpoint asks whether to continue it)
      if (unlocked) card.onclick = () => G.Checkpoint.chooseRun(lvl.id);
      wrap.appendChild(card);
    });
  },

  // ---------------- How to play ----------------
  bindHowTo() { this.el("btn-howtoplay-back").onclick = () => this.goToMainMenu(); },

  // ---------------- Settings ----------------
  // Settings is reachable from the main menu AND from the pause screen; "back"
  // used to always drop to the main menu, which quietly threw away the run.
  bindSettings() {
    this.el("btn-settings-back").onclick = () => {
      if (this._settingsReturn === "screen-pause") this.showScreen("screen-pause");
      else this.goToMainMenu();
    };
  },
  refreshSettingsScreen() { if (!this.el("screen-settings").classList.contains("hidden")) this.renderSettings(); },
  renderSettings() {
    const s = G.save.settings;
    const wrap = this.el("settings-content");
    const kb = s.keybinds;
    const T = G.T;
    const actions = ["forward", "back", "left", "right", "sprint", "jump", "reload", "interact", "melee", "slot2", "slot3", "slot4", "slot5", "slot6", "slot7",
      "ability1", "ability2", "ability3", "ability4", "pause"];
    const pct = (v, d) => Math.round((v == null ? d : v) * 100);
    this._hudSlotSig = null;              // the HUD slot row shows these keys
    wrap.innerHTML = `
      <div class="settings-section-title">${T("settings.controls")}</div>
      <div class="settings-row"><label>${T("settings.controlMode")}</label>
        <select id="set-controlmode">
          <option value="auto">${T("settings.controlAuto")}</option>
          <option value="desktop">${T("settings.controlDesktop")}</option>
          <option value="touch">${T("settings.controlTouch")}</option>
        </select>
      </div>
      <div class="settings-row"><label>${T("settings.mouseSens", { v: s.mouseSensitivity.toFixed(2) })}</label>
        <input type="range" id="set-sens" min="0.2" max="2.5" step="0.05" value="${s.mouseSensitivity}"></div>
      <div class="settings-row"><label>${T("settings.touchLayout")}</label>
        <button class="btn" id="btn-touchcfg">${T("settings.touchLayoutBtn")}</button></div>
      <div class="settings-row"><label>${T("settings.touchLookSens", { v: G.TouchCfg.lookSens().toFixed(2) })}</label>
        <input type="range" id="set-tlook" min="0.3" max="3" step="0.05" value="${G.TouchCfg.lookSens()}"></div>
      <div class="settings-row"><label>${T("settings.btnLookSens", { v: G.TouchCfg.btnLookSens().toFixed(2) })}</label>
        <input type="range" id="set-blook" min="0.3" max="3" step="0.05" value="${G.TouchCfg.btnLookSens()}"></div>
      <div class="settings-row"><label>${T("settings.hudSize")}</label>
        <button class="btn" id="btn-hudcfg">${T("settings.hudSizeBtn")}</button></div>

      <div class="settings-section-title">${T("settings.keybinds")}</div>
      ${actions.map((a) => `
        <div class="keybind-row"><span>${T("key." + a)}</span>
          <button class="btn keybind-btn" data-action="${a}">${G.keyLabel(kb[a])}</button></div>`).join("")}
      <div class="row-center"><button class="btn" id="btn-reset-keybinds">${T("settings.resetKeys")}</button></div>

      <div class="settings-section-title">${T("settings.audio")}</div>
      ${["sfxVolume", "musicVolume", "ambientVolume", "speechVolume"].map((k) => `
      <div class="settings-row"><label>${T("settings." + k, { v: pct(s[k], 0.7) })}</label>
        <input type="range" class="set-vol" data-key="${k}" min="0" max="1" step="0.05" value="${s[k] == null ? 0.7 : s[k]}"></div>`).join("")}
      <div class="settings-row"><label>${T("settings.speechMode")}</label>
        <select id="set-speechmode">
          <option value="after">${T("settings.speechAfter")}</option>
          <option value="before">${T("settings.speechBefore")}</option>
          <option value="off">${T("settings.speechOff")}</option>
        </select></div>
      <div class="row-center"><button class="btn" id="btn-speech-test">${T("settings.speechTest")}</button></div>

      <div class="settings-section-title">${T("settings.performance")}</div>
      <div class="settings-row"><label>${T("settings.fpsCap")}</label>
        <select id="set-fpscap">
          <option value="60">60</option><option value="90">90</option><option value="120">120</option>
          <option value="144">144</option><option value="0">${T("settings.unlimited")}</option>
        </select>
      </div>
      <div class="settings-row"><label>${T("settings.showFps")}</label>
        <input type="checkbox" id="set-showfps"></div>
      <div class="settings-row"><label>${T("settings.showDraws")}</label>
        <input type="checkbox" id="set-showdraws"></div>
      <div class="settings-row"><label>${T("settings.quality")}</label>
        <select id="set-quality">
          <option value="vlow">${T("settings.qVlow")}</option><option value="low">${T("settings.qLow")}</option><option value="medium">${T("settings.qMedium")}</option>
          <option value="high">${T("settings.qHigh")}</option><option value="vhigh">${T("settings.qVhigh")}</option>
        </select>
      </div>
      <div class="settings-row"><label>${T("settings.gameSpeed", { v: s.gameSpeed.toFixed(2) })}</label>
        <input type="range" id="set-gamespeed" min="0.5" max="1.5" step="0.05" value="${s.gameSpeed}"></div>

      <div class="settings-section-title">${T("settings.gameplay")}</div>
      <div class="settings-row"><label>${T("settings.shopTime")}</label>
        <select id="set-shoptime">
          <option value="30">${T("settings.seconds", { n: 30 })}</option><option value="45">${T("settings.seconds", { n: 45 })}</option>
          <option value="60">${T("settings.seconds", { n: 60 })}</option><option value="0">${T("settings.shopNoLimit")}</option>
        </select></div>

      <div class="settings-section-title">${T("settings.accessibility")}</div>
      <div class="settings-row"><label>${T("settings.fontSize")}</label>
        <select id="set-fontsize"><option value="small">${T("settings.fontSmall")}</option><option value="medium">${T("settings.fontMedium")}</option><option value="large">${T("settings.fontLarge")}</option></select></div>
      <div class="settings-row"><label>${T("settings.colorblind")}</label>
        <input type="checkbox" id="set-colorblind"></div>
      <div class="settings-row"><label>${T("settings.headBob", { v: pct(s.headBob, 1) })}</label>
        <input type="range" id="set-headbob" min="0" max="1" step="0.05" value="${s.headBob == null ? 1 : s.headBob}" ${s.headBobOff ? "disabled" : ""}></div>
      <div class="settings-row"><label>${T("settings.headBobOff")}</label>
        <input type="checkbox" id="set-headbob-off"></div>

      <div class="settings-section-title">${T("settings.vocabulary")}</div>
      <div class="settings-row"><label>${T("settings.customVocab", { n: G.CustomVocab.count() })}</label>
        <button class="btn" id="btn-settings-customvocab">${T("settings.customVocabBtn")}</button></div>

      <div class="settings-section-title">${T("settings.saveData")}</div>
      <div class="row-center">
        <button class="btn" id="btn-export-save">${T("settings.exportSave")}</button>
        <button class="btn" id="btn-import-save-settings">${T("settings.importSave")}</button>
        <input type="file" id="import-save-file" accept="application/json" style="display:none">
      </div>
    `;
    wrap.querySelector("#set-controlmode").value = s.controlMode;
    wrap.querySelector("#set-fpscap").value = String(s.fpsCap);
    wrap.querySelector("#set-showfps").checked = s.showFpsCounter;
    wrap.querySelector("#set-showdraws").checked = !!s.showDrawCalls;
    wrap.querySelector("#set-showdraws").onchange = (e) => { s.showDrawCalls = e.target.checked; G.persist(); };
    wrap.querySelector("#set-quality").value = s.graphicsQuality;
    wrap.querySelector("#set-fontsize").value = s.fontSize;
    wrap.querySelector("#set-colorblind").checked = s.colorblindMode;
    wrap.querySelector("#set-headbob-off").checked = !!s.headBobOff;
    // animation pass B: camera bob strength, live while playing (pause > settings)
    const hbIn = wrap.querySelector("#set-headbob");
    hbIn.oninput = (e) => {
      s.headBob = parseFloat(e.target.value);
      hbIn.previousElementSibling.textContent = hbIn.previousElementSibling.textContent.replace(/\(\d+%\)/, `(${Math.round(s.headBob * 100)}%)`);
    };
    hbIn.onchange = () => G.persist();
    wrap.querySelector("#set-headbob-off").onchange = (e) => { s.headBobOff = e.target.checked; G.persist(); this.renderSettings(); };

    wrap.querySelector("#set-controlmode").onchange = (e) => { s.controlMode = e.target.value; G.persist(); G.Input.mode = e.target.value === "auto" ? G.Input.mode : e.target.value; this.applyControlMode(); };
    wrap.querySelector("#btn-touchcfg").onclick = () => G.TouchCfg.openEditor();
    // (new series, round 1, D/F) touch look sensitivities, the HUD's sizes
    const sens = (id, set, key) => {
      const inp = wrap.querySelector(id);
      inp.oninput = (e) => { set(parseFloat(e.target.value)); inp.previousElementSibling.textContent = T(key, { v: parseFloat(e.target.value).toFixed(2) }); };
      inp.onchange = () => G.persist();
    };
    sens("#set-tlook", (v) => G.TouchCfg.setLookSens(v), "settings.touchLookSens");
    sens("#set-blook", (v) => G.TouchCfg.setBtnLookSens(v), "settings.btnLookSens");
    wrap.querySelector("#btn-hudcfg").onclick = () => G.HudCfg.openEditor();
    wrap.querySelector("#set-sens").oninput = (e) => { s.mouseSensitivity = parseFloat(e.target.value); G.persist(); this.renderSettings(); };
    wrap.querySelector("#set-fpscap").onchange = (e) => { s.fpsCap = parseInt(e.target.value); G.persist(); };
    wrap.querySelector("#set-showfps").onchange = (e) => { s.showFpsCounter = e.target.checked; G.persist(); this.el("hud-fps-counter").classList.toggle("hidden", !s.showFpsCounter); };
    wrap.querySelector("#set-quality").onchange = (e) => { s.graphicsQuality = e.target.value; G.persist(); G.Game.applyGraphicsQuality && G.Game.applyGraphicsQuality(); };
    wrap.querySelector("#set-gamespeed").oninput = (e) => { s.gameSpeed = parseFloat(e.target.value); G.persist(); this.renderSettings(); };
    wrap.querySelector("#set-fontsize").onchange = (e) => { s.fontSize = e.target.value; G.persist(); this.applyFontSizeClass(); };
    // J4: four independent volumes, saved as they move
    wrap.querySelectorAll(".set-vol").forEach((inp) => {
      inp.oninput = (e) => {
        s[inp.dataset.key] = parseFloat(e.target.value);
        G.Audio.applyVolumes();
        inp.previousElementSibling.textContent = inp.previousElementSibling.textContent.replace(/\(\d+%\)/, `(${Math.round(s[inp.dataset.key] * 100)}%)`);
      };
      inp.onchange = () => { G.persist(); if (inp.dataset.key === "sfxVolume") { G.Audio.unlock(); G.Audio.sfx("pickup"); } };
    });
    wrap.querySelector("#set-shoptime").value = String(s.shopTime);
    // (a shop already open keeps its clock; the new time applies from the next one)
    wrap.querySelector("#set-shoptime").onchange = (e) => { s.shopTime = parseInt(e.target.value, 10); G.persist(); };
    wrap.querySelector("#set-speechmode").value = s.speechMode || "after";
    wrap.querySelector("#set-speechmode").onchange = (e) => { s.speechMode = e.target.value; G.persist(); };
    wrap.querySelector("#btn-speech-test").onclick = () => G.Audio.speak("vocabulary");
    wrap.querySelector("#set-colorblind").onchange = (e) => {
      s.colorblindMode = e.target.checked; G.persist();
      if (G.Game.state === "GAMEPLAY" && G.Game.buildWeaponViewModel) G.Game.buildWeaponViewModel();
    };
    wrap.querySelector("#btn-reset-keybinds").onclick = () => { s.keybinds = G.defaultKeybinds(); G.persist(); this.renderSettings(); };
    wrap.querySelectorAll(".keybind-btn").forEach((btn) => {
      btn.onclick = () => { btn.textContent = "..."; G.Input.rebindingAction = btn.dataset.action; };
    });
    wrap.querySelector("#btn-settings-customvocab").onclick = () => G.CustomVocabUI.open("screen-settings");
    wrap.querySelector("#btn-export-save").onclick = () => G.exportSave();
    wrap.querySelector("#btn-import-save-settings").onclick = () => wrap.querySelector("#import-save-file").click();
    // Category L: the file is read and validated BEFORE asking, so the
    // overwrite confirmation shows what is in it next to what will be lost.
    wrap.querySelector("#import-save-file").onchange = (e) => {
      const f = e.target.files[0];
      e.target.value = "";                    // picking the same file twice should still fire
      if (!f) return;
      G.readSaveFile(f, (err, res) => {
        if (err) { alert(G.T("save.importFailed", { msg: err.message })); return; }
        const a = res.summary, b = G.saveSummary(G.save);
        const when = res.exportedAt ? new Date(res.exportedAt).toLocaleString("en-GB") : G.T("common.unknown");
        const msg = G.T("save.importConfirm", { when, al: a.levels, aw: a.words, aa: a.achievements, ag: a.weapons,
          bl: b.levels, bw: b.words, ba: b.achievements, bg: b.weapons });
        if (!confirm(msg)) return;
        G.applyImportedSave(res.save);
        alert(G.T("save.importDone"));
        this.renderSettings();
      });
    };
  },

  // ---------------- Leaderboard ----------------
  bindLeaderboard() { this.el("btn-leaderboard-back").onclick = () => this.goToMainMenu(); },
  renderLeaderboard(cat) {
    const content = this.el("leaderboard-content");
    const cats = [
      { id: "level1", label: G.T("common.level", { n: 1 }) }, { id: "level2", label: G.T("common.level", { n: 2 }) }, { id: "level3", label: G.T("common.level", { n: 3 }) },
      { id: "daily", label: G.T("leaderboard.daily") }, { id: "endless", label: G.T("leaderboard.endless") },
    ];
    const tabs = cats.map((c) => `<div class="tab-btn ${c.id === cat ? "active" : ""}" data-cat="${c.id}">${c.label}</div>`).join("");
    const list = (G.save.leaderboards[cat] || []);
    content.innerHTML = `<div class="leaderboard-tabs">${tabs}</div>
      <ul class="leaderboard-list">${list.length ? list.map((e, i) => `<li><span>#${i + 1} ${e.date}</span><span>${e.meta === "continued" ? `<span class="lb-cont" title="${G.escapeHtml(G.T("leaderboard.continued"))}" aria-label="${G.escapeHtml(G.T("leaderboard.continued"))}">💾</span> ` : ""}${e.score}</span></li>`).join("") : `<li>${G.T("leaderboard.empty")}</li>`}</ul>
      ${list.some((e) => e.meta === "continued") ? `<div class="lb-legend">💾 ${G.escapeHtml(G.T("leaderboard.continued"))}</div>` : ""}`;
    content.querySelectorAll(".tab-btn").forEach((t) => t.onclick = () => this.renderLeaderboard(t.dataset.cat));
  },

  // ---------------- Achievements ----------------
  bindAchievements() { this.el("btn-achievements-back").onclick = () => this.goToMainMenu(); },
  renderAchievements() {
    const content = this.el("achievements-content");
    content.innerHTML = G.ACHIEVEMENTS.map((a) => {
      const unlocked = !!G.save.achievements[a.id];
      return `<div class="achievement-item ${unlocked ? "" : "locked"}">
        <div class="achievement-icon">${unlocked ? a.icon : "🔒"}</div>
        <div><div class="achievement-name">${a.name}</div><div class="achievement-desc">${a.desc}</div></div>
      </div>`;
    }).join("");
  },
  showAchievementToast(id) {
    const a = G.ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    const toast = this.el("hud-achievement-toast");
    toast.innerHTML = `<b>${G.T("achievements.unlocked")}</b><br>${a.icon} ${a.name}`;
    toast.classList.remove("hidden");
    toast.style.opacity = "1"; toast.style.transform = "translateX(0)";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(20px)"; setTimeout(() => toast.classList.add("hidden"), 300); }, 3200);
  },

  // ---------------- Vocabulary Log (category F) ----------------
  bindVocabLog() {
    this.el("btn-vocablog-back").onclick = () => this.showScreen(this._logReturnScreen || "screen-mainmenu");
    // J3: every word in the log can be heard
    this.el("vocablog-content").addEventListener("click", (e) => {
      const b = e.target.closest(".speak-btn");
      if (b) { G.Audio.unlock(); G.Audio.speak(b.dataset.word); }
    });
    const hs = this.el("hud-speak");
    const replay = (e) => { e.preventDefault(); e.stopPropagation(); G.Audio.unlock(); G.Game.speakCurrentWord(); };
    hs.addEventListener("click", replay);
    hs.addEventListener("touchstart", replay, { passive: false });
  },
  renderVocabLog(levelId) {
    this._vocabLogLevel = levelId;
    const tabs = this.el("vocablog-tabs");
    tabs.innerHTML = G.LEVELS.map((l) => `<div class="tab-btn ${l.id === levelId ? "active" : ""}" data-id="${l.id}">${G.T("common.levelNamed", { n: l.id, name: l.name })}</div>`).join("");
    tabs.querySelectorAll(".tab-btn").forEach((t) => (t.onclick = () => this.renderVocabLog(parseInt(t.dataset.id))));
    const level = G.getLevel(levelId);
    const words = G.WORD_SETS[level.wordsKey].words;
    const builtinCount = G.CustomVocab.builtin(level.wordsKey).length;
    const esc = G.escapeHtml;
    const items = words.map((pair, i) => {
      const en = pair[0], th = pair[1];
      const mine = i >= builtinCount ? ` <span class="vocab-badge custom">${G.T("vocablog.custom")}</span>` : "";
      const stat = G.wordStat(pair);
      let badge = `<span class="vocab-badge unseen">${G.T("vocablog.unseen")}</span>`;
      if (stat && (stat.correct > 0 || stat.wrong > 0)) {
        const R = G.T("vocablog.right", { n: stat.correct }), W = G.T("vocablog.wrong", { n: stat.wrong });
        badge = stat.correct >= stat.wrong
          ? `<span class="vocab-badge correct">${R}${stat.wrong ? ` / ${W}` : ""}</span>`
          : `<span class="vocab-badge wrong">${W}${stat.correct ? ` / ${R}` : ""}</span>`;
      }
      return `<div class="vocab-item"><div><div class="vw-en">${esc(en)} <button class="speak-btn" data-word="${esc(en)}" aria-label="${G.T("vocablog.hear", { word: esc(en) })}">🔊</button>${mine}</div><div class="vw-th">${esc(th)}</div></div>${badge}</div>`;
    }).join("");
    this.el("vocablog-content").innerHTML = `<div class="vocab-grid">${items}</div>`;
  },

  // ---------------- Weapon Log (category F) ----------------
  bindWeaponLog() {
    this.el("btn-weaponlog-back").onclick = () => this.showScreen(this._logReturnScreen || "screen-mainmenu");
  },
  renderWeaponLog(levelId) {
    this._weaponLogLevel = levelId;
    const tabs = this.el("weaponlog-tabs");
    tabs.innerHTML = G.LEVELS.map((l) => `<div class="tab-btn ${l.id === levelId ? "active" : ""}" data-id="${l.id}">${G.T("common.levelNamed", { n: l.id, name: l.name })}</div>`).join("");
    tabs.querySelectorAll(".tab-btn").forEach((t) => (t.onclick = () => this.renderWeaponLog(parseInt(t.dataset.id))));
    const level = G.getLevel(levelId);
    // Derived, not hand-listed: the wall guns for a level are simply its
    // wallExclusive weapons, so adding one to a level plan lists it here too.
    const wallIds = G.weaponsForLevel(levelId, (w) => w.wallExclusive).map((w) => w.id);
    let html = "";
    G.RARITY_ORDER.forEach((rk) => {
      const weapons = G.weaponsForLevel(levelId, (w) => w.rarity === rk && !w.wallExclusive && !w.boxOnly);
      if (!weapons.length) return;
      html += `<div class="weaponlog-section-title rarity-${rk}">${G.RARITY[rk].label}${G.save.settings.colorblindMode ? ` [${rk[0].toUpperCase()}]` : ""}</div>`;
      html += `<div class="weaponlog-grid">${weapons.map((w) => this.weaponLogCardHtml(w)).join("")}</div>`;
    });
    if (wallIds.length) {
      html += `<div class="weaponlog-section-title rarity-secret">${G.T("weaponlog.wall", { n: wallIds.length })}</div>`;
      html += `<div class="weaponlog-grid">${wallIds.map((id) => this.weaponLogCardHtml(G.WEAPON_DEFS[id])).join("")}</div>`;
    }
    const boxGuns = G.weaponsForLevel(levelId, (w) => w.boxOnly);
    if (boxGuns.length) {
      const eliteTotal = boxGuns.filter((w) => w.boxTier === "elite").reduce((s, w) => s + w.boxWeight, 0);
      const stdTotal = boxGuns.filter((w) => w.boxTier === "standard").reduce((s, w) => s + w.boxWeight, 0);
      html += `<div class="weaponlog-section-title rarity-epic">${G.T("weaponlog.box", { cost: G.MYSTERY_BOX_COST })}</div>`;
      html += `<div class="weaponlog-grid">${boxGuns.map((w) => {
        const pct = w.boxTier === "elite" ? (100 / 6) * (w.boxWeight / eliteTotal) : (500 / 6) * (w.boxWeight / stdTotal);
        return this.weaponLogCardHtml(w, pct.toFixed(2) + "%");
      }).join("")}</div>`;
    }
    this.el("weaponlog-content").innerHTML = html;
    // pass C: every gun sounds different, so let it be heard before it is
    // bought or picked up (a locked one too -- only its name is secret)
    this.el("weaponlog-content").querySelectorAll(".wl-listen").forEach((b) => {
      b.onclick = () => {
        const len = G.GunAudio.preview(G.WEAPON_DEFS[b.dataset.id]);
        this.el("weaponlog-content").querySelectorAll(".wl-listen.playing").forEach((o) => o.classList.remove("playing"));
        b.classList.add("playing");
        clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("playing"), (len || 1) * 1000);
      };
    });
  },
  // Category E: weight is a real stat now -- it costs movement speed and
  // stamina -- so it is shown everywhere a weapon's numbers are: the log, the
  // shop crate reveal, the mystery box and the wall mounts.
  // Weight (category E) and firing mode (category N) are both real stats, so
  // they are shown everywhere a weapon.s numbers are: the log, the shop crate
  // reveal, the mystery box and the wall mounts.
  weightLine(def) {
    const c = G.weightClass(def);
    const pen = Math.round((1 - c.speedMult) * 100);
    return `<span style="color:#9fd6ff">${G.T("weapon.mode", { m: G.fireModeLabel(def) })}</span><br>`
      + `<span style="color:${c.color}">${G.T("weapon.weight", { w: c.label, v: G.weaponWeight(def).toFixed(1) })}</span>`
      + ` <span style="opacity:.75">${pen ? G.T("weapon.speedPenalty", { p: pen }) : G.T("weapon.noPenalty")}</span>`;
  },
  listenBtn(w) { return `<button class="btn wl-listen" data-id="${w.id}">${G.T("weaponlog.listen")}</button>`; },
  weaponLogCardHtml(w, dropChance) {
    const unlocked = (G.save.unlockedWeapons || []).includes(w.id);
    const odds = dropChance ? `<br>${G.T("weaponlog.odds", { p: dropChance })}` : "";
    if (!unlocked) {
      return `<div class="weaponlog-card locked"><div class="wl-icon">🔒</div><div class="wl-name">???</div><div class="wl-stats">${G.T("weaponlog.locked")}${odds}</div>${this.listenBtn(w)}</div>`;
    }
    const dps = Math.round(w.damage * (w.pellets || 1) * (1000 / w.fireRate));
    return `<div class="weaponlog-card border-${w.rarity}" style="border-style:solid">
      <div class="wl-icon">🔫</div><div class="wl-name rarity-${w.rarity}">${w.name}</div>
      <div class="wl-stats">${G.T("weaponlog.damage", { d: w.damage })}${w.pellets ? G.T("weaponlog.pellets", { n: w.pellets }) : ""}<br>${G.T("weaponlog.rate", { r: (1000 / w.fireRate).toFixed(1) })}<br>${G.T("weaponlog.mag", { n: w.magSize })}<br>${G.T("weaponlog.dps", { n: dps })}<br>${this.weightLine(w)}${w.price ? `<br>${G.T("weaponlog.price", { p: w.price })}` : ""}${odds}</div>
      ${this.listenBtn(w)}
    </div>`;
  },

  // ---------------- Import vocabulary ----------------
  _pendingImport: null,
  // The import page is reached from the main menu and from Custom
  // Vocabulary (which opens it set to the level it was showing).
  openImport(returnTo, levelKey) {
    this._importReturn = returnTo || "screen-mainmenu";
    const sel = this.el("import-dest");
    sel.innerHTML = `<option value="practice">${G.T("import.destPractice")}</option>` +
      G.CustomVocab.LEVEL_KEYS.map((k) => `<option value="${k}">${G.T("import.destLevel", { level: G.CustomVocab.levelName(k) })}</option>`).join("");
    sel.value = levelKey || "practice";
    this.el("import-summary").innerHTML = "";
    this.renderImportedSets();
    this.showScreen("screen-import");
  },
  bindImport() {
    this.el("btn-import-back").onclick = () => {
      if (this._importReturn === "screen-customvocab") { G.CustomVocabUI.render(); this.showScreen("screen-customvocab"); }
      else this.goToMainMenu();
    };
    this.el("import-file-input").onchange = (e) => this.handleImportFile(e.target.files[0]);
    this.el("import-image-input").onchange = (e) => this.handleImportImage(e.target.files[0]);
    this.el("btn-import-save").onclick = () => this.saveImportedSet();
  },
  handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pairs = this.parseCsvVocab(reader.result);
      this._pendingImport = { name: file.name.replace(/\.[^.]+$/, ""), words: pairs };
      this.renderImportPreview(pairs);
    };
    reader.readAsText(file);
  },
  parseCsvVocab(text) {
    return text.split(/\r?\n/).map((line) => line.split(",")).filter((parts) => parts.length >= 2 && parts[0].trim())
      .map((parts) => [parts[0].trim(), parts.slice(1).join(",").trim()]);
  },
  renderImportPreview(pairs) {
    const prev = this.el("import-preview");
    prev.innerHTML = pairs.length
      ? pairs.slice(0, 50).map((p) => `<div>${G.escapeHtml(p[0])} — ${G.escapeHtml(p[1])}</div>`).join("") + (pairs.length > 50 ? `<div>${G.T("import.more", { n: pairs.length - 50 })}</div>` : "")
      : `<div>${G.T("import.none")}</div>`;
    this.el("btn-import-save").disabled = pairs.length === 0;
  },
  handleImportImage(file) {
    if (!file) return;
    const status = this.el("import-ocr-status");
    status.textContent = G.T("import.ocrLoading");
    const run = () => {
      status.textContent = G.T("import.ocrReading");
      const url = URL.createObjectURL(file);
      Tesseract.recognize(url, "eng").then(({ data }) => {
        status.textContent = G.T("import.ocrDone");
        const lines = data.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        // OCR only reliably gives English words; pair each with a blank Thai meaning for manual edit
        const pairs = lines.map((l) => [l.split(/\s+/)[0], ""]);
        this._pendingImport = { name: file.name.replace(/\.[^.]+$/, "") + "_ocr", words: pairs };
        this.renderImportPreview(pairs);
      }).catch((err) => { status.textContent = G.T("import.ocrFailed", { msg: err.message }); });
    };
    if (window.Tesseract) { run(); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js";
    script.onload = run;
    script.onerror = () => { status.textContent = G.T("import.ocrNoLib"); };
    document.head.appendChild(script);
  },
  // Every row goes through the Custom Vocabulary checks (js/customvocab.js).
  // Into a level: nothing already in the game anywhere, in any level, gets
  // in twice. As a practice set: game words are the point of it, so only
  // broken rows and the file's own repeats are dropped. Either way the page
  // then says what went in and what was left out, and why.
  saveImportedSet() {
    if (!this._pendingImport || !this._pendingImport.words.length) return;
    const dest = this.el("import-dest").value;
    const T = G.T, esc = G.escapeHtml;
    let res, head;
    if (dest === "practice") {
      const clean = G.CustomVocab.cleanPracticeSet(this._pendingImport.words);
      res = { added: clean.words.map((p) => p[0]), dupes: clean.dupes, invalid: clean.invalid, sameMeaning: [] };
      if (clean.words.length) {
        G.save.importedSets["import_" + Date.now()] = { name: this._pendingImport.name, words: clean.words };
        G.persist();
      }
      head = T("import.sumPractice", { n: res.added.length });
    } else {
      res = G.CustomVocab.importPairs(this._pendingImport.words, dest);
      head = T("import.sumLevel", { n: res.added.length, level: G.CustomVocab.levelName(dest) });
    }
    const reason = (d) => d.key ? T("import.whyDup", { level: G.CustomVocab.levelName(d.key) }) : T("import.whyDupFile");
    let html = `<div class="sum-head">${head}</div>`;
    if (res.dupes.length) html += `<div class="sum-skip"><b>${T("import.sumDupes", { n: res.dupes.length })}</b> ${res.dupes.map((d) => `${esc(d.en)} <i>(${reason(d)})</i>`).join(", ")}</div>`;
    if (res.invalid.length) html += `<div class="sum-skip"><b>${T("import.sumInvalid", { n: res.invalid.length })}</b> ${res.invalid.map((d) => `${esc(d.en)} <i>(${T(d.reason)})</i>`).join(", ")}</div>`;
    if (res.sameMeaning.length) html += `<div class="sum-warn">${T("import.sumSame", { words: res.sameMeaning.map(esc).join(", ") })}</div>`;
    this.el("import-summary").innerHTML = html;
    this._pendingImport = null;
    this.el("import-preview").innerHTML = "";
    this.el("btn-import-save").disabled = true;
    this.el("import-file-input").value = "";
    this.el("import-image-input").value = "";
    this.renderImportedSets();
  },
  renderImportedSets() {
    const wrap = this.el("imported-sets-list");
    const ids = Object.keys(G.save.importedSets);
    wrap.innerHTML = ids.length ? ids.map((id) => {
      const set = G.save.importedSets[id];
      return `<div class="imported-set-row"><span>${G.T("import.setRow", { name: G.escapeHtml(set.name), n: set.words.length })}</span><button class="btn" data-id="${id}">${G.T("import.delete")}</button></div>`;
    }).join("") : `<div style='opacity:.6'>${G.T("import.empty")}</div>`;
    wrap.querySelectorAll("button[data-id]").forEach((b) => b.onclick = () => { delete G.save.importedSets[b.dataset.id]; G.persist(); this.renderImportedSets(); });
  },

  // ---------------- Practice mode ----------------
  bindPractice() {
    this.el("btn-practice-back").onclick = () => this.goToMainMenu();
    this.el("btn-practice-quit").onclick = () => G.Game.endPractice();
  },
  renderPracticeSetup() {
    const wrap = this.el("practice-setup-content");
    const importedIds = Object.keys(G.save.importedSets);
    wrap.innerHTML = `
      <p>${G.T("practice.choose")}</p>
      <div class="tabs">
        ${[1, 2, 3].map((n) => `<div class="tab-btn" data-src="level${n}">${G.T("common.levelNamed", { n, name: G.getLevel(n).name })}</div>`).join("")}
        <div class="tab-btn" data-src="weak">${G.T("practice.weak")}</div>
        ${importedIds.map((id) => `<div class="tab-btn" data-src="${id}">${G.save.importedSets[id].name}</div>`).join("")}
      </div>
      <div class="row-center"><button class="btn btn-primary" id="btn-practice-start" disabled>${G.T("practice.start")}</button></div>
    `;
    let selected = null;
    wrap.querySelectorAll(".tab-btn").forEach((t) => t.onclick = () => {
      wrap.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
      t.classList.add("active"); selected = t.dataset.src;
      wrap.querySelector("#btn-practice-start").disabled = false;
    });
    wrap.querySelector("#btn-practice-start").onclick = () => G.Game.startPractice(selected);
  },
  startPracticeRound(pairs) {
    this.practicePairs = G.shuffle(pairs);
    this.practiceIdx = 0;
    this.practiceCorrect = 0;
    this.showPracticeCard();
  },
  showPracticeCard() {
    if (this.practiceIdx >= this.practicePairs.length) {
      alert(G.T("practice.done", { c: this.practiceCorrect, n: this.practicePairs.length }));
      G.Game.endPractice();
      return;
    }
    const [word, meaning] = this.practicePairs[this.practiceIdx];
    this.el("practice-progress").textContent = `${this.practiceIdx + 1} / ${this.practicePairs.length}`;
    this.el("practice-word").textContent = word;
    // J3: Practice Mode reads every card aloud, on its own speech setting
    if ((G.save.settings.speechMode || "after") !== "off") G.Audio.speak(word);
    this.el("practice-feedback").textContent = "";
    const allMeanings = G.getAllBuiltinWords().map((p) => p[1]).filter((m) => m !== meaning);
    const distractors = G.shuffle(allMeanings).slice(0, 3);
    const choices = G.shuffle([meaning, ...distractors]);
    const cWrap = this.el("practice-choices");
    cWrap.innerHTML = "";
    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "practice-choice-btn"; btn.textContent = c;
      btn.onclick = () => {
        const correct = c === meaning;
        G.recordWordResult(word, correct);
        btn.classList.add(correct ? "correct" : "wrong");
        if (correct) this.practiceCorrect++;
        this.el("practice-feedback").textContent = correct ? G.T("practice.correct") : G.T("practice.wrong", { a: meaning });
        Array.from(cWrap.children).forEach((b) => (b.onclick = null));
        setTimeout(() => { this.practiceIdx++; G.persist(); this.showPracticeCard(); }, 700);
      };
      cWrap.appendChild(btn);
    });
  },

  // ---------------- Pause ----------------
  bindPause() {
    this.el("btn-resume").onclick = () => G.Game.resume();
    // Category O: replay the tutorial mid-run, and skip it from the card
    this.el("btn-pause-tutorial").onclick = () => { G.Tutorial.reset(); G.Tutorial.startRun(G.Game); G.Game.resume(); };
    const skip = (e) => { e.preventDefault(); e.stopPropagation(); G.Tutorial.skip(); };
    this.el("hud-tip-skip").addEventListener("click", skip);
    this.el("hud-tip-skip").addEventListener("touchstart", skip, { passive: false });
    this.el("btn-pause-vocablog").onclick = () => {
      this._logReturnScreen = "screen-pause";
      const lvlId = (G.Game.level && G.Game.level.id) || 1;
      this.renderVocabLog(lvlId); this.showScreen("screen-vocablog");
    };
    this.el("btn-pause-weaponlog").onclick = () => {
      this._logReturnScreen = "screen-pause";
      const lvlId = (G.Game.level && G.Game.level.id) || 1;
      this.renderWeaponLog(lvlId); this.showScreen("screen-weaponlog");
    };
    this.el("btn-pause-settings").onclick = () => { this._settingsReturn = "screen-pause"; this.renderSettings(); this.showScreen("screen-settings"); };
    this.el("btn-pause-mainmenu").onclick = () => G.Game.quitToMainMenu();
  },

  // ---------------- Game over / Victory ----------------
  bindGameOverVictory() {
    this.el("btn-gameover-retry").onclick = () => G.Game.retry();
    this.el("btn-gameover-menu").onclick = () => G.Game.quitToMainMenu();
    this.el("btn-victory-levelselect").onclick = () => G.Game.goToLevelSelect();
    this.el("btn-victory-retry").onclick = () => G.Game.retry();
    this.el("btn-victory-menu").onclick = () => G.Game.quitToMainMenu();
  },
  renderResultScreen(kind, stats, wrongWords) {
    const statsWrap = this.el(kind === "win" ? "victory-stats" : "gameover-stats");
    statsWrap.innerHTML = ["score", "wave", "correct", "wrong", "money"].map((k) =>
      `<div class="result-stat"><div class="result-stat-value">${stats[k]}</div><div class="result-stat-label">${G.T("result." + k)}</div></div>`).join("");
    const reviewWrap = this.el(kind === "win" ? "victory-review" : "gameover-review");
    const sorted = Object.entries(wrongWords || {}).sort((a, b) => b[1].count - a[1].count);
    // (G4) the bosses beaten this run, by name and title, and the wave
    const downs = stats.bosses || [];
    const bossHtml = `<div class="result-bosses"><div class="result-bosses-title">${G.T("result.bosses")}</div>` +
      (downs.length ? downs.map((d) => {
        const def = G.BOSS_BY_ID[d.id];
        return `<div class="result-boss"><span class="rb-name">${G.escapeHtml(G.Bosses.label(def))}</span><span class="rb-wave">${G.T("cine.wave", { n: d.wave })}</span></div>`;
      }).join("") : `<div class="result-boss none">${G.T("result.bossesNone")}</div>`) + "</div>";
    reviewWrap.innerHTML = bossHtml + (sorted.length
      ? `<div style="opacity:.7;margin-bottom:6px">${G.T("result.review")}</div>` + sorted.map(([w, d]) => `<div class="review-item"><span>${G.escapeHtml(w)} — ${G.escapeHtml(d.meaning)}</span><span class="wrong-count">${G.T("result.wrongTimes", { n: d.count })}</span></div>`).join("")
      : `<div style="opacity:.6">${G.T("result.perfect")}</div>`);
  },

  // ---------------- Shop ----------------
  bindShop() { this.el("btn-shop-continue").onclick = () => G.Game.leaveShop(); },
  // (C) the countdown: big seconds and a bar that empties; red and pulsing
  // for the last ten; with no limit, a line saying the wave waits for Ready
  updateShopTimer(t, lim) {
    const box = this.el("shop-timer");
    const s = Number.isFinite(t) ? Math.max(0, Math.ceil(t)) : -1;
    if (s === this._shopSec && lim === this._shopLim) return;
    this._shopSec = s; this._shopLim = lim;
    if (s < 0) {
      box.innerHTML = `<span class="st-label">${G.T("shop.noLimit")}</span>`;
      box.classList.remove("warn");
      return;
    }
    box.innerHTML = `<span class="st-label">${G.T("shop.timerLabel")}</span> <b class="st-num">${s}</b><span class="st-unit">s</span>` +
      `<span class="st-bar"><i style="transform:scaleX(${lim > 0 ? Math.min(1, t / lim) : 1})"></i></span>`;
    box.classList.toggle("warn", s <= 10);
  },
  renderShop() {
    this.el("shop-money").textContent = G.Game.player.money;
    const g = G.Game, pl = g.player;
    const bonus = this.el("shop-bonus");
    if (bonus) {
      const b = g._waveBonus || 0, it = g._interest || 0;
      const parts = [];
      if (b) parts.push(G.T("shop.bonus", { w: g.wave, b }));
      if (it) parts.push(G.T("shop.interest", { v: it }));
      bonus.textContent = parts.join(" · ");
      bonus.classList.toggle("hidden", !parts.length);
    }
    // Three sections: what is always on sale, this wave's four perks (the
    // shuffle bag, js/perks.js), and the armory.
    const grid = this.el("shop-grid");
    grid.innerHTML = "";
    const section = (key) => {
      const h = document.createElement("div");
      h.className = "shop-section";
      h.textContent = G.T(key);
      grid.appendChild(h);
    };
    const card = (o) => {
      const div = document.createElement("div");
      div.className = "shop-item" + (o.perk ? " shop-perk cat-" + o.perk.cat : "");
      const blocked = o.owned || o.maxed || o.full;
      div.innerHTML = `<div class="shop-item-title">${o.icon ? `<span class="shop-icon">${o.icon}</span>` : ""}${o.title}</div>
        ${o.level ? `<div class="shop-item-level">${o.level}</div>` : ""}
        <div class="shop-item-desc">${o.desc || ""}</div>
        <div class="shop-item-price">💰 ${o.owned ? G.T("shop.owned") : o.maxed ? G.T("shop.max") : o.price}</div>
        <button class="btn ${blocked ? "" : "btn-primary"}" ${blocked || pl.money < o.price ? "disabled" : ""}>${o.full ? G.T("shop.full") : blocked ? "-" : G.T("shop.buy")}</button>`;
      if (!blocked) div.querySelector("button").onclick = () => { o.buy(); this.renderShop(); };
      grid.appendChild(div);
    };
    const cur = g.currentWeaponDef();
    const itemCard = (item, extra) => {
      const price = G.Shop.priceFor(item.id, item.base, item.growth);
      const vars = { w: cur.name, hp: Math.round(pl.hp), max: pl.maxHp };
      card(Object.assign({ title: item.label, price, desc: G.T("shopItem." + item.id + ".desc", vars), buy: () => g.buyShopItem(item, price) }, extra || {}));
    };
    section("shop.essentials");
    // nothing to fill: not for sale (no paying for nothing)
    const ammoFull = pl.gunSlots.every((id) => pl.ammo[id].mag >= Math.round(G.WEAPON_DEFS[id].magSize * pl.weaponLevels[id].mag) && pl.ammo[id].reserve >= g.fullReserve(id));
    G.SHOP_ITEMS.filter((i) => i.section === "essential").forEach((item) => itemCard(item, {
      icon: item.id === "heal" ? "❤" : "🔋",
      full: item.id === "heal" ? pl.hp >= pl.maxHp : ammoFull,
    }));
    section("shop.perks");
    (g._perkOffer || []).forEach((id) => {
      const def = G.PERK_BY_ID[id], lvl = G.Perks.level(id), maxed = lvl >= def.max;
      card({
        perk: def, icon: def.icon, title: G.Perks.name(id), maxed, price: G.Perks.price(id),
        level: G.T("shop.perkLevel", { l: lvl, m: def.max }) + " · " + G.T("perkCat." + def.cat),
        desc: (lvl && !maxed ? `<b>${G.T("shop.nextLevel")}</b> ` : "") + G.Perks.describe(id, maxed ? lvl : lvl + 1),
        buy: () => g.buyPerk(id),
      });
    });
    section("shop.armory");
    G.SHOP_ITEMS.filter((i) => i.section !== "essential").forEach((item) => {
      itemCard(item, { owned: item.kind === "unlock" && pl.gunSlots.includes(item.weapon) });
    });
  },

  // ---------------- Crate open ----------------
  bindCrate() { this.el("btn-crate-continue").onclick = () => G.Game.closeCrateScreen(); },
  showCrateScreen(rarityKey, weaponDef) {
    const panel = this.el("crate-open-panel");
    panel.className = "crate-open-panel border-" + rarityKey;
    this.el("crate-rarity-label").className = "crate-rarity-label rarity-" + rarityKey;
    this.el("crate-rarity-label").textContent = G.RARITY[rarityKey].label + (G.save.settings.colorblindMode ? ` [${rarityKey[0].toUpperCase()}]` : "");
    this.el("crate-weapon-name").textContent = weaponDef.name;
    this.el("crate-weapon-stats").innerHTML = G.T("crate.stats", { d: weaponDef.damage, r: (1000 / weaponDef.fireRate).toFixed(1), m: weaponDef.magSize }) + this.weightLine(weaponDef);
    this.showScreen("screen-crate");
  },

  // ---------------- Inventory Full (js/loadout.js) ----------------
  // The new gun on top, then one card per slot: that gun's numbers, and what
  // each would become if this slot took the new one -- green when the new gun
  // is better at it, red when it is worse. The whole card is the button.
  gunStats(def, lvl) {
    lvl = lvl || { dmg: 1, rate: 1, mag: 1 };
    return {
      dmg: Math.round(def.damage * lvl.dmg * (def.pellets || 1)),
      dmgLabel: def.pellets ? `${Math.round(def.damage * lvl.dmg)}×${def.pellets}` : String(Math.round(def.damage * lvl.dmg)),
      rate: Math.round(1000 / def.fireRate * lvl.rate * 10) / 10,
      mag: Math.round(def.magSize * lvl.mag),
      weight: G.weaponWeight(def),
    };
  },
  renderInventoryFull(newId, opts) {
    const g = G.Game, pl = g.player, T = G.T, esc = G.escapeHtml;
    const nd = G.WEAPON_DEFS[newId];
    const ns = this.gunStats(nd, opts.carry ? opts.carry.levels : null);
    const col = (r) => "#" + G.RARITY[r].color.toString(16).padStart(6, "0");
    const statRow = (label, v) => `<div class="inv-stat"><span>${label}</span><b>${v}</b></div>`;
    this.el("inv-new").innerHTML = `
      <div class="inv-new-tag">${T("inv.newGun")}</div>
      <div class="inv-name" style="color:${col(nd.rarity)}">${esc(nd.name)}</div>
      <div class="inv-rarity">${G.RARITY[nd.rarity].label} · ${G.fireModeLabel(nd)}</div>
      <div class="inv-stats">${statRow(T("inv.damage"), nd.pellets ? `${ns.dmg} <small>(${ns.dmgLabel})</small>` : ns.dmg)}${statRow(T("inv.rate"), ns.rate + "/s")}${statRow(T("inv.mag"), ns.mag)}${statRow(T("inv.weight"), G.weightClass(nd).label + " " + ns.weight.toFixed(1))}</div>`;
    const kb = G.save.settings.keybinds;
    // + / - for the new gun against this slot's; `lowerBetter` for weight
    const cmp = (label, oldV, newV, show, lowerBetter) => {
      const diff = newV - oldV;
      const better = lowerBetter ? diff < 0 : diff > 0;
      const cls = Math.abs(diff) < 1e-6 ? "same" : better ? "up" : "down";
      const arrow = cls === "same" ? "=" : better ? "▲" : "▼";
      return `<div class="inv-stat ${cls}"><span>${label}</span><b>${show(oldV)} → ${show(newV)} <i>${arrow}</i></b></div>`;
    };
    this.el("inv-slots").innerHTML = pl.gunSlots.map((id, i) => {
      const d = G.WEAPON_DEFS[id], s = this.gunStats(d, pl.weaponLevels[id]);
      const a = pl.ammo[id];
      return `<button class="inv-slot" data-idx="${i}">
        <div class="inv-slot-head"><span class="inv-key">${G.keyLabel(kb["slot" + (i + 2)])}</span>
          <span class="inv-name" style="color:${col(d.rarity)}">${esc(d.name)}</span>${pl.currentSlot === i + 1 ? `<span class="inv-held">${T("inv.held")}</span>` : ""}</div>
        <div class="inv-stats">
          ${cmp(T("inv.damage"), s.dmg, ns.dmg, (v) => v)}
          ${cmp(T("inv.rate"), s.rate, ns.rate, (v) => v + "/s")}
          ${cmp(T("inv.mag"), s.mag, ns.mag, (v) => v)}
          ${cmp(T("inv.weight"), s.weight, ns.weight, (v) => v.toFixed(1), true)}
        </div>
        <div class="inv-ammo">${T("inv.ammo", { m: a.mag, r: a.reserve })}</div>
        <div class="inv-replace">${T("inv.replace")}</div>
      </button>`;
    }).join("");
    this.el("inv-slots").querySelectorAll(".inv-slot").forEach((b) => (b.onclick = () => G.Loadout.choose(parseInt(b.dataset.idx, 10))));
    const keepNote = { wall: "inv.keepWall", shop: "inv.keepWall", mystery: "inv.keepBox", crate: "inv.keepFloor", drop: "inv.keepFloor", floor: "inv.keepStays" }[opts.source] || "inv.keepFloor";
    this.el("inv-note").textContent = T("inv.dropNote", { s: G.Loadout.RETURN_SECONDS }) + " " + T(keepNote);
    this.el("btn-inv-keep").onclick = () => G.Loadout.keep();
  },

  // ---------------- HUD update ----------------
  // Smoothly eases a displayed number toward its real value over real
  // elapsed wall-clock time (not tied to the game's own dt/FPS cap) --
  // money/score/HP used to just snap to the new value instantly.
  _tweenValue(key, target) {
    // A single bad value used to wedge the HUD for good: NaN never converges
    // back toward the target, so once it got in, HP/money/score read "NaN"
    // until the page reloaded.
    if (!Number.isFinite(target)) target = 0;
    const now = performance.now();
    this._tweenState = this._tweenState || {};
    const prev = this._tweenState[key];
    const st = prev && Number.isFinite(prev.val) ? prev : { val: target, t: now };
    const dt = Math.min(0.1, (now - st.t) / 1000);
    const factor = 1 - Math.exp(-7 * dt);
    let val = st.val + (target - st.val) * factor;
    if (Math.abs(target - val) < 0.4) val = target;
    this._tweenState[key] = { val, t: now };
    return val;
  },
  updateHud(p) {
    const dispHp = this._tweenValue("hp", p.hp);
    const dispMoney = this._tweenValue("money", p.money);
    const dispScore = this._tweenValue("score", p.score);
    this.el("hud-hp-fill").style.width = Math.max(0, dispHp) + "%";
    this.el("hud-hp-text").textContent = Math.max(0, Math.round(dispHp));
    // (D) the bar glows green while health comes back; under 30% the edges
    // of the screen go red, deeper the lower it gets (the heartbeat is in
    // game.js updateAudio)
    const hpBox = this.el("hud-hp-fill").closest(".hud-health");
    if (hpBox) hpBox.classList.toggle("regen", !!p.regenerating);
    const low = p.hp > 0 && p.hp < 30 ? (30 - p.hp) / 30 : 0;
    if (low !== this._lowHp) {
      this._lowHp = low;
      const v = this.el("hud-lowhp");
      v.classList.toggle("on", low > 0);
      v.style.setProperty("--low", (0.35 + low * 0.65).toFixed(2));
    }
    const staminaEl = this.el("hud-stamina-fill");
    staminaEl.style.width = Math.max(0, p.stamina) + "%";
    staminaEl.classList.toggle("exhausted", !!p.staminaExhausted);
    this.el("hud-money").textContent = Math.round(dispMoney);
    this.el("hud-score").textContent = Math.round(dispScore);
    this.el("hud-level-wave").textContent = p.levelLabel;
    this.el("hud-zombies-left").textContent = G.T("hud.zombies", { n: p.zombiesLeft });
    // Category E: the speed penalty is otherwise invisible, so the HUD names
    // the weight band of whatever is in hand.
    this.el("hud-weapon-name").innerHTML = p.weaponName +
      (p.weightLabel ? ` <span style="color:${p.weightColor};font-size:0.78em">[${p.weightLabel}]</span>` : "");
    this.el("hud-ammo").textContent = p.isMelee ? G.T("hud.ammoMelee") : `${p.ammoInMag} / ${p.ammoReserve}`;
    this.el("hud-meaning").textContent = p.currentMeaning || "-";
    const obj = this.el("hud-objectives");
    if (p.objectives) {
      obj.classList.remove("hidden");
      if (obj.textContent !== p.objectives) obj.textContent = p.objectives;
      const [d, t] = p.objectives.replace(/[^0-9/]/g, "").split("/").map(Number);
      obj.classList.toggle("done", d === t);
    } else obj.classList.add("hidden");
    // rebuilt only when something in it changes
    const slotSig = p.slots.map((s) => (s.empty ? "e" : s.active ? "a" : "o")).join("");
    if (slotSig !== this._hudSlotSig) {
      this._hudSlotSig = slotSig;
      const kb = G.save.settings.keybinds;
      this.el("hud-slots").innerHTML = p.slots.map((s, i) =>
        `<div class="hud-slot${s.active ? " active" : ""}${s.empty ? " empty" : ""}">${i === 0 ? "K" : G.keyLabel(kb["slot" + (i + 1)])}</div>`).join("");
    }
    if (this._comboSavedUntil > performance.now()) {
      this.el("hud-combo").classList.remove("hidden");
      this.el("hud-combo").textContent = G.T("hud.comboSaved", { n: p.combo });
    } else if (p.combo > 1) { this.el("hud-combo").classList.remove("hidden"); this.el("hud-combo").textContent = G.T("hud.combo", { n: p.combo }); }
    else this.el("hud-combo").classList.add("hidden");
    if (G.Input.mode === "touch") {
      this.refreshTouchSlots(p.slots, p.slots.findIndex((s) => s.active));
      // (new series, round 1, E) the reload button fills its ring as the gun reloads
      const f = Math.round((p.reloadFrac || 0) * 50) / 50;
      if (f !== this._reloadRing) {
        this._reloadRing = f;
        const rb = this.el("touch-reload");
        rb.style.setProperty("--rp", f);
        rb.classList.toggle("reloading", f > 0);
      }
    }
    this.updateHudPerks();
  },
  noteComboSaved() { this._comboSavedUntil = performance.now() + 1600; },
  // Small perk icons under the stats: out of the way of the crosshair. A
  // spent Combo Shield or Second Life is dimmed until it is ready again;
  // Focus Time and Adrenaline glow while they run.
  updateHudPerks() {
    const g = G.Game, pl = g.player;
    // (no run yet -- the touch layout editor opened from the menu shows a
    // sample HUD before any player exists)
    if (!pl || !pl.perks) { this._hudPerkSig = ""; this.el("hud-perks").classList.add("hidden"); return; }
    const ids = G.PERKS.map((d) => d.id).filter((id) => pl.perks[id]);
    const state = (id) => {
      if (id === "combo_shield") return pl.comboShield && pl.comboShield.charged ? "" : " spent";
      if (id === "second_life") return pl.secondLifeUsed ? " spent" : "";
      if (id === "focus_time") return g._slowmoT > 0 ? " live" : "";
      if (id === "adrenaline") return g._adrenalineT > 0 ? " live" : "";
      return "";
    };
    const sig = ids.map((id) => id + pl.perks[id] + state(id)).join("|");
    if (sig === this._hudPerkSig) return;
    this._hudPerkSig = sig;
    const wrap = this.el("hud-perks");
    wrap.classList.toggle("hidden", !ids.length);
    wrap.innerHTML = ids.map((id) => `<span class="hud-perk${state(id)}" title="${G.escapeHtml(G.Perks.name(id))}">${G.PERK_BY_ID[id].icon}${pl.perks[id] > 1 ? `<sub>${pl.perks[id]}</sub>` : ""}</span>`).join("");
  },
  // Pause screen: every perk owned, with what it does on hover, tap, focus
  // or a controller's A.
  renderPausePerks() {
    const box = this.el("pause-perks");
    const pl = G.Game.player;
    const ids = pl ? G.PERKS.map((d) => d.id).filter((id) => pl.perks[id]) : [];
    if (!ids.length) { box.innerHTML = `<h4>${G.T("pause.perks")}</h4><div class="pause-perk-detail">${G.T("pause.noPerks")}</div>`; return; }
    box.innerHTML = `<h4>${G.T("pause.perks")}</h4><div class="pause-perk-icons">${ids.map((id) =>
      `<button class="pause-perk" data-id="${id}" data-tip="${G.escapeHtml(G.Perks.name(id))}" aria-label="${G.escapeHtml(G.Perks.name(id))}"><span class="pp-ico">${G.PERK_BY_ID[id].icon}${pl.perks[id] > 1 ? `<sub>${pl.perks[id]}</sub>` : ""}</span><span class="icon-label">${G.escapeHtml(G.T("perk." + id + ".short"))}</span></button>`).join("")}</div>
      <div class="pause-perk-detail" id="pause-perk-detail">${G.T("pause.perkHint")}</div>`;
    const detail = box.querySelector("#pause-perk-detail");
    const show = (b) => {
      const id = b.dataset.id, def = G.PERK_BY_ID[id], lvl = pl.perks[id];
      box.querySelectorAll(".pause-perk").forEach((x) => x.classList.toggle("sel", x === b));
      detail.innerHTML = `<b>${def.icon} ${G.escapeHtml(G.Perks.name(id))}</b> <span class="pp-lvl">${G.T("shop.perkLevel", { l: lvl, m: def.max })}</span><br>${G.Perks.describe(id, lvl)}`;
    };
    box.querySelectorAll(".pause-perk").forEach((b) => {
      b.onmouseenter = () => show(b); b.onfocus = () => show(b); b.onclick = () => show(b);
    });
  },
  // Category I: the full checklist, shown on the pause screen.
  renderPauseObjectives() {
    const box = this.el("pause-objectives");
    const game = G.Game;
    if (!G.Objectives.state) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const rows = G.Objectives.list(game);
    box.innerHTML = `<h4>${G.T("obj.title", { d: rows.filter((r) => r.done).length, n: rows.length })}</h4>` +
      rows.map((r) => `<div class="obj-row ${r.done ? "done" : "todo"}"><span>${r.done ? "✔" : "○"} ${r.label}</span><span class="obj-val">${r.value}</span></div>`).join("");
  },
  setAimingVisual(v) { this.el("hud-crosshair").classList.toggle("aiming", !!v); },
  // Category N: the scope replaces the crosshair entirely -- a reticle drawn
  // on top of a scope ring reads as two sights at once.
  setScopeVisual(v) {
    this.el("hud-scope").classList.toggle("hidden", !v);
    this.el("hud-crosshair").classList.toggle("hidden", !!v);
  },
  setChargeMeter(frac) {
    const box = this.el("hud-charge");
    if (frac == null) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    const fill = this.el("hud-charge-fill");
    fill.style.width = Math.round(Math.min(1, frac) * 100) + "%";
    fill.classList.toggle("full", frac >= 0.999);
  },

  // ---------------- Mystery weapon box (category C3) ----------------
  bindMystery() {
    this.el("btn-mystery-take").onclick = () => G.Game.confirmMysteryPick();
  },
  showMysteryCards(hand, onPick) {
    const wrap = this.el("mystery-cards");
    this.el("mystery-result").classList.add("hidden");
    this.el("mystery-title").textContent = G.T("mystery.pick");
    this.el("mystery-sub").textContent = G.T("mystery.pickSub");
    // Face-down colours are deliberately NOT the weapon's rarity colour, so
    // the backs can't be read as a hint about which card is the elite one.
    const backs = ["#3dff9e", "#ff4fd8", "#4fd2ff", "#3dff9e", "#ff4fd8", "#4fd2ff"];
    wrap.innerHTML = hand.map((w, i) => `
      <div class="mcard" data-idx="${i}" style="--mc:${backs[i % backs.length]}; animation-delay:${i * 70}ms">
        <div class="mc-back">?</div>
        <div class="mc-face"></div>
      </div>`).join("");
    wrap.querySelectorAll(".mcard").forEach((el) => {
      el.onclick = () => { if (!el.classList.contains("revealed")) onPick(parseInt(el.dataset.idx, 10)); };
    });
    this.showScreen("screen-mystery");
  },
  revealMysteryCards(hand, pickedIdx) {
    const wrap = this.el("mystery-cards");
    this.el("mystery-title").textContent = G.T("mystery.reveal");
    this.el("mystery-sub").textContent = G.T("mystery.revealSub");
    wrap.querySelectorAll(".mcard").forEach((el, i) => {
      const w = hand[i];
      const col = G.RARITY[w.rarity].color;
      const hex = "#" + col.toString(16).padStart(6, "0");
      el.style.setProperty("--mc", hex);
      el.classList.add("revealed");
      if (w.boxTier === "elite") el.classList.add("elite");
      if (i === pickedIdx) el.classList.add("picked");
      el.style.animationDelay = (i * 60) + "ms";
      const dps = Math.round(w.damage * (w.pellets || 1) * (1000 / w.fireRate));
      el.querySelector(".mc-face").innerHTML =
        `<div class="mc-name" style="color:${hex}">${w.name}</div>
         <div class="mc-tier">${G.RARITY[w.rarity].label}${w.boxTier === "elite" ? " ★" : ""}</div>
         <div class="mc-dps">${G.T("mystery.dps", { n: dps })}</div>
         ${i === pickedIdx ? `<div class="mc-tier" style="margin-top:6px;color:#fff">${G.T("mystery.yourPick")}</div>` : ""}`;
    });
    const picked = hand[pickedIdx];
    const pcol = "#" + G.RARITY[picked.rarity].color.toString(16).padStart(6, "0");
    const res = this.el("mystery-result");
    res.classList.remove("hidden");
    this.el("mystery-result-rarity").textContent = G.RARITY[picked.rarity].label + (picked.boxTier === "elite" ? G.T("mystery.elite") : "");
    this.el("mystery-result-rarity").style.color = pcol;
    this.el("mystery-result-name").textContent = picked.name;
    const dps = Math.round(picked.damage * (picked.pellets || 1) * (1000 / picked.fireRate));
    this.el("mystery-result-stats").innerHTML =
      `${G.T("weaponlog.damage", { d: picked.damage })}${picked.pellets ? G.T("weaponlog.pellets", { n: picked.pellets }) : ""} · ${G.T("weaponlog.rate", { r: (1000 / picked.fireRate).toFixed(1) })}<br>
       ${G.T("weaponlog.mag", { n: picked.magSize })} · ${G.T("weapon.reload", { s: (picked.reloadTime / 1000).toFixed(1) })} · ${G.T("weapon.recoil", { r: picked.recoil.toFixed(1) })}<br>
       ${G.T("weaponlog.dps", { n: dps })}${picked.pierce ? " · " + G.T("weapon.pierce") : ""}${picked.splash ? " · " + G.T("weapon.splash") : ""}<br>${this.weightLine(picked)}`;
    // rarer pull = bigger screen flash
    const flash = this.el("mystery-flash");
    const strength = { common: 0, uncommon: 0, rare: 1, epic: 1, secret: 1 }[picked.rarity];
    if (strength) {
      flash.style.setProperty("--mc", pcol);
      flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go");
    }
  },
  // `head`: a headshot -- the marker turns red (a later plain call in the
  // same shot keeps it red)
  showHitmarker(head) {
    const hm = this.el("hud-hitmarker");
    if (head) this._hmHeadAt = performance.now();
    hm.classList.toggle("head", performance.now() - (this._hmHeadAt || -1e9) < 60);
    hm.classList.remove("hidden");
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => hm.classList.add("hidden"), 120);
  },
  // Big celebratory banner for special one-off moments (buying a wall-mounted
  // weapon, unlocking the hospital's 2nd floor) -- more prominent than the
  // achievement toast since these are rarer, deliberate player achievements.
  flashPurchaseBanner(name, subtitle) {
    const el = this.el("hud-purchase-banner");
    el.innerHTML = `<div class="pb-title">${subtitle || G.T("banner.unlocked")}</div><div class="pb-name">${name}</div>`;
    el.classList.remove("hidden", "showing");
    void el.offsetWidth;
    el.classList.add("showing");
    clearTimeout(this._pbTimer);
    this._pbTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  },
  // Brief pulse on the relevant HUD stat when a drop is collected (item A1's
  // "items fly into the HUD" feedback).
  pulseHudStat(kind) {
    const idMap = { money: "hud-money", ammo: "hud-ammo", health: "hud-hp-text" };
    const el = this.el(idMap[kind]);
    if (!el) return;
    el.classList.remove("hud-pulse"); void el.offsetWidth; // restart the animation if it's already running
    el.classList.add("hud-pulse");
  },
  flashDamage() {
    const f = this.el("hud-damage-flash");
    f.classList.add("active");
    clearTimeout(this._dmgTimer);
    this._dmgTimer = setTimeout(() => f.classList.remove("active"), 200);
  },
  setInteractPrompt(visible, text) {
    const el = this.el("hud-interact-prompt");
    el.classList.toggle("hidden", !visible);
    if (text && el.textContent !== text) el.textContent = text;
  },
  // (round 2, G4) The boss's health: a big red bar across the top with its
  // name and title over it; it pulses while the boss is open to extra damage.
  // (New series, round 2) two marks on it where phases 2 and 3 begin (66%
  // and 33%, G.CONFIG.boss.phases), lit once passed; the bar takes the
  // phase's colour.
  setBossBar(visible, name, hpPct, vulnerable, phase) {
    const bar = this.el("hud-boss-bar");
    if (bar.classList.contains("hidden") === !visible && !visible) return;
    bar.classList.toggle("hidden", !visible);
    document.body.classList.toggle("boss-on", !!visible);
    if (!visible) { this.setBossHint(null); return; }
    if (name && this.el("hud-boss-name").textContent !== name) this.el("hud-boss-name").textContent = name;
    const w = Math.max(0, Math.min(100, hpPct)).toFixed(1) + "%";
    const fill = this.el("hud-boss-hp-fill");
    if (fill.style.width !== w) { fill.style.width = w; this.el("hud-boss-hp-lag").style.width = w; }
    bar.classList.toggle("vuln", !!vulnerable);
    const P = G.CONFIG.boss.phases, ph = phase || 1;
    [2, 3].forEach((n) => {
      const m = this.el("hud-boss-mark" + n);
      const left = Math.round(P[n - 2] * 1000) / 10 + "%";
      if (m.style.left !== left) m.style.left = left;
      m.classList.toggle("passed", ph >= n);
    });
    bar.classList.toggle("phase2", ph === 2);
    bar.classList.toggle("phase3", ph >= 3);
  },
  // (new series, round 2) a line under the boss's bar: what to do about the
  // move under way; gone after secs (null: at once)
  setBossHint(text, secs) {
    const el = this.el("hud-boss-hint");
    if (!el) return;
    clearTimeout(this._bossHintT);
    if (!text) { el.classList.add("hidden"); return; }
    if (el.textContent !== text) el.textContent = text;
    el.classList.remove("hidden");
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    this._bossHintT = setTimeout(() => el.classList.add("hidden"), Math.max(1, secs || 4) * 1000);
  },
  // Desktop, mid-game, no window open and still no pointer lock: the browser
  // refused to re-lock (a question timed out, the shop timer ran out -- no
  // click or key behind them) or the player alt-tabbed back. Say so, rather
  // than leave a view that ignores the mouse. Held briefly so the frames
  // between asking for the lock and getting it don't flash it.
  updateResumeHint() {
    const g = G.Game, now = performance.now();
    // (a controller needs no mouse lock, so it never needs the hint)
    const want = G.Input.mode === "desktop" && !G.Input.padActive && g.state === "GAMEPLAY" && !g.paused && !G.Modal.isOpen() && !G.Input.pointerLocked;
    if (!want) this._hintSince = 0; else if (!this._hintSince) this._hintSince = now;
    const show = want && now - this._hintSince > 350;
    if (show !== this._hintShown) { this._hintShown = show; this.el("hud-resume-hint").classList.toggle("hidden", !show); }
  },

  // `boss`: the one hard word after a boss -- its own red frame
  setChallengeVisible(v, label, boss) {
    this.el("hud-challenge-box").classList.toggle("hidden", !v);
    if (v) this.el("hud-challenge-box").classList.toggle("boss", !!boss);
    if (label) this.el("hud-challenge-label").textContent = label;
  },
  setChallengeMeaning(meaning) { this.el("hud-challenge-meaning").textContent = meaning || ""; },
  setChallengeChoices(choices) {
    const wrap = this.el("hud-challenge-choices");
    wrap.innerHTML = (choices || []).map((c, i) => `<div class="hud-boss-choice" role="button" data-idx="${i}"><b>[${i + 1}]</b>${G.escapeHtml(c)}</div>`).join("");
    wrap.querySelectorAll(".hud-boss-choice").forEach((el) => {
      el.onclick = () => G.Game.answerChallenge(parseInt(el.dataset.idx, 10));
    });
  },
  setChallengeTimer(pct) { this.el("hud-challenge-timer-fill").style.width = Math.max(0, pct * 100) + "%"; },
  // Category K: FPS and draw calls, each toggleable in Settings
  updateFpsCounter(fps) {
    const el = this.el("hud-fps-counter");
    const s = G.save.settings;
    if (!s.showFpsCounter && !s.showDrawCalls) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    const parts = [];
    if (s.showFpsCounter) parts.push(G.T("hud.fps", { n: Math.round(fps) }));
    if (s.showDrawCalls && G.Game.renderer) {
      const r = G.Game.renderer.info.render;
      parts.push(G.T("hud.draws", { n: r.calls }), G.T("hud.tris", { n: Math.round(r.triangles / 1000) }));
    }
    const txt = parts.join(" · ");
    if (el.textContent !== txt) el.textContent = txt;
  },
};
