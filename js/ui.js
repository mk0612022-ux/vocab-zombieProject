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
    "screen-mystery",
  ],

  showScreen(id) {
    // Crossfade instead of an instant cut: the outgoing screen fades out
    // briefly before being hidden, the incoming one fades/scales in.
    const prevId = this._currentScreen;
    if (prevId && prevId !== id && !this.el(prevId).classList.contains("hidden")) {
      const prevEl = this.el(prevId);
      prevEl.classList.add("fade-out");
      setTimeout(() => { prevEl.classList.add("hidden"); prevEl.classList.remove("fade-out"); }, 150);
      this.ALL_SCREENS.forEach((s) => { if (s !== id && s !== prevId) this.el(s).classList.add("hidden"); });
    } else {
      this.ALL_SCREENS.forEach((s) => { if (s !== id) this.el(s).classList.add("hidden"); });
    }
    if (id) {
      const el = this.el(id);
      el.classList.remove("hidden", "fade-in");
      void el.offsetWidth; // restart the animation even if this screen was already showing recently
      el.classList.add("fade-in");
    }
    this._currentScreen = id;
  },
  hideAllScreens() { this.showScreen(null); },
  setHudVisible(v) { this.el("hud").classList.toggle("hidden", !v); },
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
    document.body.classList.toggle("touch-mode", mode === "touch");
  },
  // On-screen weapon switcher: one button per slot the player actually holds
  // (knife + up to four guns), rebuilt only when the loadout or selection
  // changes so it isn't re-rendered every frame.
  refreshTouchSlots(slots, activeIndex) {
    const wrap = this.el("touch-slots");
    const sig = slots.length + ":" + activeIndex;
    if (this._touchSlotSig === sig) return;
    this._touchSlotSig = sig;
    wrap.innerHTML = slots.map((s, i) =>
      `<button class="touch-slot-btn${i === activeIndex ? " active" : ""}" data-slot="${i}">${i === 0 ? "🔪" : i + 1}</button>`
    ).join("");
  },

  init() {
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
    this.applyFontSizeClass();
  },

  applyFontSizeClass() {
    document.body.classList.remove("font-small", "font-large");
    const fs = G.save.settings.fontSize;
    if (fs === "small") document.body.classList.add("font-small");
    if (fs === "large") document.body.classList.add("font-large");
  },

  // ---------------- Main menu ----------------
  bindMainMenu() {
    this.el("btn-start-game").onclick = () => G.Game.goToLevelSelect();
    this.el("btn-practice").onclick = () => G.Game.goToPracticeSetup();
    this.el("btn-daily").onclick = () => G.Game.startDailyChallenge();
    this.el("btn-endless").onclick = () => G.Game.startEndless();
    this.el("btn-leaderboard").onclick = () => { this.renderLeaderboard("level1"); this.showScreen("screen-leaderboard"); };
    this.el("btn-achievements").onclick = () => { this.renderAchievements(); this.showScreen("screen-achievements"); };
    this.el("btn-vocablog").onclick = () => { this._logReturnScreen = "screen-mainmenu"; this.renderVocabLog(1); this.showScreen("screen-vocablog"); };
    this.el("btn-weaponlog").onclick = () => { this._logReturnScreen = "screen-mainmenu"; this.renderWeaponLog(1); this.showScreen("screen-weaponlog"); };
    this.el("btn-import-vocab").onclick = () => { this.renderImportedSets(); this.showScreen("screen-import"); };
    this.el("btn-howtoplay").onclick = () => this.showScreen("screen-howtoplay");
    this.el("btn-tutorial-replay").onclick = () => { G.Tutorial.reset(); G.Game.startLevel(1); };
    this.el("btn-settings").onclick = () => { this._settingsReturn = "screen-mainmenu"; this.renderSettings(); this.showScreen("screen-settings"); };
  },
  goToMainMenu() { this.showScreen("screen-mainmenu"); this.setHudVisible(false); this.setTouchControlsVisible(false); },

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
      if (unlocked) card.onclick = () => G.Game.startLevel(lvl.id);
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
    const actions = ["forward", "back", "left", "right", "sprint", "jump", "reload", "interact", "melee", "slot2", "slot3", "slot4", "slot5", "pause"];
    const pct = (v, d) => Math.round((v == null ? d : v) * 100);
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

      <div class="settings-section-title">${T("settings.keybinds")}</div>
      ${actions.map((a) => `
        <div class="keybind-row"><span>${T("key." + a)}</span>
          <button class="btn keybind-btn" data-action="${a}">${kb[a]}</button></div>`).join("")}
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

      <div class="settings-section-title">${T("settings.accessibility")}</div>
      <div class="settings-row"><label>${T("settings.fontSize")}</label>
        <select id="set-fontsize"><option value="small">${T("settings.fontSmall")}</option><option value="medium">${T("settings.fontMedium")}</option><option value="large">${T("settings.fontLarge")}</option></select></div>
      <div class="settings-row"><label>${T("settings.colorblind")}</label>
        <input type="checkbox" id="set-colorblind"></div>
      <div class="settings-row"><label>${T("settings.headBob", { v: pct(s.headBob, 1) })}</label>
        <input type="range" id="set-headbob" min="0" max="1" step="0.05" value="${s.headBob == null ? 1 : s.headBob}" ${s.headBobOff ? "disabled" : ""}></div>
      <div class="settings-row"><label>${T("settings.headBobOff")}</label>
        <input type="checkbox" id="set-headbob-off"></div>

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
      <ul class="leaderboard-list">${list.length ? list.map((e, i) => `<li><span>#${i + 1} ${e.date}</span><span>${e.score}</span></li>`).join("") : `<li>${G.T("leaderboard.empty")}</li>`}</ul>`;
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
    const items = words.map(([en, th]) => {
      const stat = G.save.wordStats[en.toLowerCase()];
      let badge = `<span class="vocab-badge unseen">${G.T("vocablog.unseen")}</span>`;
      if (stat && (stat.correct > 0 || stat.wrong > 0)) {
        const R = G.T("vocablog.right", { n: stat.correct }), W = G.T("vocablog.wrong", { n: stat.wrong });
        badge = stat.correct >= stat.wrong
          ? `<span class="vocab-badge correct">${R}${stat.wrong ? ` / ${W}` : ""}</span>`
          : `<span class="vocab-badge wrong">${W}${stat.correct ? ` / ${R}` : ""}</span>`;
      }
      return `<div class="vocab-item"><div><div class="vw-en">${en} <button class="speak-btn" data-word="${en}" aria-label="${G.T("vocablog.hear", { word: en })}">🔊</button></div><div class="vw-th">${th}</div></div>${badge}</div>`;
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
  bindImport() {
    this.el("btn-import-back").onclick = () => this.goToMainMenu();
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
      ? pairs.slice(0, 50).map((p) => `<div>${p[0]} — ${p[1]}</div>`).join("") + (pairs.length > 50 ? `<div>${G.T("import.more", { n: pairs.length - 50 })}</div>` : "")
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
  saveImportedSet() {
    if (!this._pendingImport || !this._pendingImport.words.length) return;
    const id = "import_" + Date.now();
    G.save.importedSets[id] = this._pendingImport;
    G.persist();
    this._pendingImport = null;
    this.el("import-preview").innerHTML = "";
    this.el("btn-import-save").disabled = true;
    this.el("import-file-input").value = "";
    this.el("import-image-input").value = "";
    this.renderImportedSets();
    alert(G.T("import.saved"));
  },
  renderImportedSets() {
    const wrap = this.el("imported-sets-list");
    const ids = Object.keys(G.save.importedSets);
    wrap.innerHTML = ids.length ? ids.map((id) => {
      const set = G.save.importedSets[id];
      return `<div class="imported-set-row"><span>${G.T("import.setRow", { name: set.name, n: set.words.length })}</span><button class="btn" data-id="${id}">${G.T("import.delete")}</button></div>`;
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
    reviewWrap.innerHTML = sorted.length
      ? `<div style="opacity:.7;margin-bottom:6px">${G.T("result.review")}</div>` + sorted.map(([w, d]) => `<div class="review-item"><span>${w} — ${d.meaning}</span><span class="wrong-count">${G.T("result.wrongTimes", { n: d.count })}</span></div>`).join("")
      : `<div style="opacity:.6">${G.T("result.perfect")}</div>`;
  },

  // ---------------- Shop ----------------
  bindShop() { this.el("btn-shop-continue").onclick = () => G.Game.leaveShop(); },
  renderShop() {
    this.el("shop-money").textContent = G.Game.player.money;
    const bonus = this.el("shop-bonus");
    if (bonus) {
      const b = G.Game._waveBonus || 0;
      bonus.textContent = b ? G.T("shop.bonus", { w: G.Game.wave, b }) : "";
      bonus.classList.toggle("hidden", !b);
    }
    const grid = this.el("shop-grid");
    grid.innerHTML = "";
    G.SHOP_ITEMS.forEach((item) => {
      const owned = item.kind === "unlock" && G.Game.player.gunSlots.includes(item.weapon);
      const stack = item.maxStack ? (G.Game.player.perks[item.id] || 0) : 0;
      const maxedOut = item.maxStack && stack >= item.maxStack;
      const price = G.Shop.priceFor(item.id, item.base, item.growth);
      const div = document.createElement("div");
      div.className = "shop-item";
      div.innerHTML = `<div class="shop-item-title">${item.label}</div>
        <div class="shop-item-desc">${item.maxStack ? G.T("shop.level", { s: stack, m: item.maxStack }) : ""}</div>
        <div class="shop-item-price">💰 ${owned ? G.T("shop.owned") : maxedOut ? G.T("shop.max") : price}</div>
        <button class="btn ${owned || maxedOut ? "" : "btn-primary"}" ${owned || maxedOut || G.Game.player.money < price ? "disabled" : ""}>${owned || maxedOut ? "-" : G.T("shop.buy")}</button>`;
      if (!owned && !maxedOut) {
        div.querySelector("button").onclick = () => { G.Game.buyShopItem(item, price); this.renderShop(); };
      }
      grid.appendChild(div);
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
    const slotsWrap = this.el("hud-slots");
    slotsWrap.innerHTML = "";
    p.slots.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "hud-slot" + (s.active ? " active" : "");
      d.textContent = i === 0 ? "K" : String(i + 1);
      slotsWrap.appendChild(d);
    });
    if (p.combo > 1) { this.el("hud-combo").classList.remove("hidden"); this.el("hud-combo").textContent = G.T("hud.combo", { n: p.combo }); }
    else this.el("hud-combo").classList.add("hidden");
    if (G.Input.mode === "touch") this.refreshTouchSlots(p.slots, p.slots.findIndex((s) => s.active));
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
  showHitmarker() {
    const hm = this.el("hud-hitmarker");
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
    if (text) el.textContent = text;
  },
  setBossBar(visible, name, hpPct) {
    this.el("hud-boss-bar").classList.toggle("hidden", !visible);
    if (!visible) return;
    const hint = G.T(G.Input.mode === "touch" ? "hud.bossHintTouch" : "hud.bossHintDesk");
    if (this.el("hud-boss-hint").textContent !== hint) this.el("hud-boss-hint").textContent = hint;
    this.el("hud-boss-name").textContent = name;
    this.el("hud-boss-hp-fill").style.width = Math.max(0, hpPct) + "%";
  },
  setBossWord(meaning) { this.el("hud-boss-word").textContent = meaning ? G.T("hud.meaning", { m: meaning }) : ""; },
  // The answers used to be plain text with no click handler, in a layer that
  // ignores the mouse: keys 1-4 were the only way to answer, and a touch
  // screen had none. Same buttons as the door/crate question now.
  setBossChoices(choices) {
    const wrap = this.el("hud-boss-choices");
    wrap.innerHTML = (choices || []).map((c, i) => `<div class="hud-boss-choice" role="button" data-idx="${i}"><b>[${i + 1}]</b>${c}</div>`).join("");
    wrap.querySelectorAll(".hud-boss-choice").forEach((el) => {
      el.onclick = () => G.Game.answerBossChoice(parseInt(el.dataset.idx, 10));
    });
  },
  setBossTimer(pct) { this.el("hud-boss-timer-fill").style.width = Math.max(0, pct * 100) + "%"; },
  // Desktop, mid-game, no window open and still no pointer lock: the browser
  // refused to re-lock (a question timed out, the shop timer ran out -- no
  // click or key behind them) or the player alt-tabbed back. Say so, rather
  // than leave a view that ignores the mouse. Held briefly so the frames
  // between asking for the lock and getting it don't flash it.
  updateResumeHint() {
    const g = G.Game, now = performance.now();
    const want = G.Input.mode === "desktop" && g.state === "GAMEPLAY" && !g.paused && !G.Modal.isOpen() && !G.Input.pointerLocked;
    if (!want) this._hintSince = 0; else if (!this._hintSince) this._hintSince = now;
    const show = want && now - this._hintSince > 350;
    if (show !== this._hintShown) { this._hintShown = show; this.el("hud-resume-hint").classList.toggle("hidden", !show); }
  },

  setChallengeVisible(v, label) {
    this.el("hud-challenge-box").classList.toggle("hidden", !v);
    if (label) this.el("hud-challenge-label").textContent = label;
  },
  setChallengeMeaning(meaning) { this.el("hud-challenge-meaning").textContent = meaning || ""; },
  setChallengeChoices(choices) {
    const wrap = this.el("hud-challenge-choices");
    wrap.innerHTML = (choices || []).map((c, i) => `<div class="hud-boss-choice" role="button" data-idx="${i}"><b>[${i + 1}]</b>${c}</div>`).join("");
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
