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
  setTouchControlsVisible(v) { this.el("touch-controls").classList.toggle("hidden", !v); },

  applyControlMode() {
    const mode = G.Input.mode;
    this.setTouchControlsVisible(mode === "touch" && G.Game && G.Game.state === "GAMEPLAY");
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
    this.el("btn-settings").onclick = () => { this.renderSettings(); this.showScreen("screen-settings"); };
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
          <div class="level-card-title">ด่าน ${lvl.id}: ${lvl.name}</div>
          <div class="level-card-sub">${lvl.waves} เวฟ · ความยาก ${lvl.difficulty.toFixed(1)}x</div>
          ${unlocked ? `<div class="level-card-score">คะแนนสูงสุด: ${hs || "-"}</div>` : `<div class="level-card-lock">🔒 ผ่านด่านก่อนหน้าเพื่อปลดล็อก</div>`}
        </div>`;
      if (unlocked) card.onclick = () => G.Game.startLevel(lvl.id);
      wrap.appendChild(card);
    });
  },

  // ---------------- How to play ----------------
  bindHowTo() { this.el("btn-howtoplay-back").onclick = () => this.goToMainMenu(); },

  // ---------------- Settings ----------------
  bindSettings() { this.el("btn-settings-back").onclick = () => this.goToMainMenu(); },
  refreshSettingsScreen() { if (!this.el("screen-settings").classList.contains("hidden")) this.renderSettings(); },
  renderSettings() {
    const s = G.save.settings;
    const wrap = this.el("settings-content");
    const kb = s.keybinds;
    const actionLabels = { forward: "เดินหน้า", back: "ถอยหลัง", left: "ซ้าย", right: "ขวา", sprint: "วิ่ง", jump: "กระโดด",
      reload: "Reload", interact: "Interact", melee: "มีด", slot2: "อาวุธช่อง 2", slot3: "อาวุธช่อง 3", slot4: "อาวุธช่อง 4", slot5: "อาวุธช่อง 5", pause: "Pause" };
    wrap.innerHTML = `
      <div class="settings-section-title">ควบคุม</div>
      <div class="settings-row"><label>โหมดควบคุม</label>
        <select id="set-controlmode">
          <option value="auto">อัตโนมัติ</option>
          <option value="desktop">Desktop Controls</option>
          <option value="touch">Touch Controls</option>
        </select>
      </div>
      <div class="settings-row"><label>ความไวเมาส์ (${s.mouseSensitivity.toFixed(2)})</label>
        <input type="range" id="set-sens" min="0.2" max="2.5" step="0.05" value="${s.mouseSensitivity}"></div>

      <div class="settings-section-title">Key Bindings</div>
      ${Object.keys(actionLabels).map((a) => `
        <div class="keybind-row"><span>${actionLabels[a]}</span>
          <button class="btn keybind-btn" data-action="${a}">${kb[a]}</button></div>`).join("")}
      <div class="row-center"><button class="btn" id="btn-reset-keybinds">Reset to Default</button></div>

      <div class="settings-section-title">Performance</div>
      <div class="settings-row"><label>FPS Cap</label>
        <select id="set-fpscap">
          <option value="60">60</option><option value="90">90</option><option value="120">120</option>
          <option value="144">144</option><option value="0">Unlimited</option>
        </select>
      </div>
      <div class="settings-row"><label>แสดง FPS Counter</label>
        <input type="checkbox" id="set-showfps"></div>
      <div class="settings-row"><label>คุณภาพกราฟิก</label>
        <select id="set-quality">
          <option value="vlow">ต่ำมาก</option><option value="low">ต่ำ</option><option value="medium">ปานกลาง</option>
          <option value="high">สวย</option><option value="vhigh">สวยมาก</option>
        </select>
      </div>
      <div class="settings-row"><label>ความเร็วเกม (${s.gameSpeed.toFixed(2)}x)</label>
        <input type="range" id="set-gamespeed" min="0.5" max="1.5" step="0.05" value="${s.gameSpeed}"></div>

      <div class="settings-section-title">Accessibility</div>
      <div class="settings-row"><label>ขนาดตัวอักษร</label>
        <select id="set-fontsize"><option value="small">เล็ก</option><option value="medium">กลาง</option><option value="large">ใหญ่</option></select></div>
      <div class="settings-row"><label>โหมดสีสำหรับผู้มีภาวะตาบอดสี (แสดงไอคอน rarity เพิ่ม)</label>
        <input type="checkbox" id="set-colorblind"></div>

      <div class="settings-section-title">Save Data</div>
      <div class="row-center">
        <button class="btn" id="btn-export-save">Export Save</button>
        <button class="btn" id="btn-import-save-settings">Import Save</button>
        <input type="file" id="import-save-file" accept="application/json" style="display:none">
      </div>
    `;
    wrap.querySelector("#set-controlmode").value = s.controlMode;
    wrap.querySelector("#set-fpscap").value = String(s.fpsCap);
    wrap.querySelector("#set-showfps").checked = s.showFpsCounter;
    wrap.querySelector("#set-quality").value = s.graphicsQuality;
    wrap.querySelector("#set-fontsize").value = s.fontSize;
    wrap.querySelector("#set-colorblind").checked = s.colorblindMode;

    wrap.querySelector("#set-controlmode").onchange = (e) => { s.controlMode = e.target.value; G.persist(); G.Input.mode = e.target.value === "auto" ? G.Input.mode : e.target.value; this.applyControlMode(); };
    wrap.querySelector("#set-sens").oninput = (e) => { s.mouseSensitivity = parseFloat(e.target.value); G.persist(); this.renderSettings(); };
    wrap.querySelector("#set-fpscap").onchange = (e) => { s.fpsCap = parseInt(e.target.value); G.persist(); };
    wrap.querySelector("#set-showfps").onchange = (e) => { s.showFpsCounter = e.target.checked; G.persist(); this.el("hud-fps-counter").classList.toggle("hidden", !s.showFpsCounter); };
    wrap.querySelector("#set-quality").onchange = (e) => { s.graphicsQuality = e.target.value; G.persist(); G.Game.applyGraphicsQuality && G.Game.applyGraphicsQuality(); };
    wrap.querySelector("#set-gamespeed").oninput = (e) => { s.gameSpeed = parseFloat(e.target.value); G.persist(); this.renderSettings(); };
    wrap.querySelector("#set-fontsize").onchange = (e) => { s.fontSize = e.target.value; G.persist(); this.applyFontSizeClass(); };
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
    wrap.querySelector("#import-save-file").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!confirm("การนำเข้าจะเขียนทับข้อมูลปัจจุบันทั้งหมด ยืนยันหรือไม่?")) return;
      G.importSaveFromFile(f, (ok) => { alert(ok ? "นำเข้าสำเร็จ" : "ไฟล์ไม่ถูกต้อง"); if (ok) this.renderSettings(); });
    };
  },

  // ---------------- Leaderboard ----------------
  bindLeaderboard() { this.el("btn-leaderboard-back").onclick = () => this.goToMainMenu(); },
  renderLeaderboard(cat) {
    const content = this.el("leaderboard-content");
    const cats = [
      { id: "level1", label: "ด่าน 1" }, { id: "level2", label: "ด่าน 2" }, { id: "level3", label: "ด่าน 3" },
      { id: "daily", label: "Daily" }, { id: "endless", label: "Endless" },
    ];
    const tabs = cats.map((c) => `<div class="tab-btn ${c.id === cat ? "active" : ""}" data-cat="${c.id}">${c.label}</div>`).join("");
    const list = (G.save.leaderboards[cat] || []);
    content.innerHTML = `<div class="leaderboard-tabs">${tabs}</div>
      <ul class="leaderboard-list">${list.length ? list.map((e, i) => `<li><span>#${i + 1} ${e.date}</span><span>${e.score}</span></li>`).join("") : "<li>ยังไม่มีสถิติ</li>"}</ul>`;
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
    toast.innerHTML = `<b>🏅 ปลดล็อก Achievement!</b><br>${a.icon} ${a.name}`;
    toast.classList.remove("hidden");
    toast.style.opacity = "1"; toast.style.transform = "translateX(0)";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(20px)"; setTimeout(() => toast.classList.add("hidden"), 300); }, 3200);
  },

  // ---------------- Vocabulary Log (category F) ----------------
  bindVocabLog() {
    this.el("btn-vocablog-back").onclick = () => this.showScreen(this._logReturnScreen || "screen-mainmenu");
  },
  renderVocabLog(levelId) {
    this._vocabLogLevel = levelId;
    const tabs = this.el("vocablog-tabs");
    tabs.innerHTML = G.LEVELS.map((l) => `<div class="tab-btn ${l.id === levelId ? "active" : ""}" data-id="${l.id}">ด่าน ${l.id}: ${l.name}</div>`).join("");
    tabs.querySelectorAll(".tab-btn").forEach((t) => (t.onclick = () => this.renderVocabLog(parseInt(t.dataset.id))));
    const level = G.getLevel(levelId);
    const words = G.WORD_SETS[level.wordsKey].words;
    const items = words.map(([en, th]) => {
      const stat = G.save.wordStats[en.toLowerCase()];
      let badge = `<span class="vocab-badge unseen">ยังไม่เคยเจอ</span>`;
      if (stat && (stat.correct > 0 || stat.wrong > 0)) {
        badge = stat.correct >= stat.wrong
          ? `<span class="vocab-badge correct">ถูก ${stat.correct}${stat.wrong ? ` / ผิด ${stat.wrong}` : ""}</span>`
          : `<span class="vocab-badge wrong">ผิด ${stat.wrong}${stat.correct ? ` / ถูก ${stat.correct}` : ""}</span>`;
      }
      return `<div class="vocab-item"><div><div class="vw-en">${en}</div><div class="vw-th">${th}</div></div>${badge}</div>`;
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
    tabs.innerHTML = G.LEVELS.map((l) => `<div class="tab-btn ${l.id === levelId ? "active" : ""}" data-id="${l.id}">ด่าน ${l.id}: ${l.name}</div>`).join("");
    tabs.querySelectorAll(".tab-btn").forEach((t) => (t.onclick = () => this.renderWeaponLog(parseInt(t.dataset.id))));
    const level = G.getLevel(levelId);
    const wallId = { school: "school_wall", hospital: "hospital_wall", bunker: "bunker_wall" }[level.theme];
    let html = "";
    G.RARITY_ORDER.forEach((rk) => {
      const weapons = Object.values(G.WEAPON_DEFS).filter((w) => w.rarity === rk && !w.wallExclusive);
      if (!weapons.length) return;
      html += `<div class="weaponlog-section-title rarity-${rk}">${G.RARITY[rk].label}${G.save.settings.colorblindMode ? ` [${rk[0].toUpperCase()}]` : ""}</div>`;
      html += `<div class="weaponlog-grid">${weapons.map((w) => this.weaponLogCardHtml(w)).join("")}</div>`;
    });
    if (wallId) {
      const w = G.WEAPON_DEFS[wallId];
      html += `<div class="weaponlog-section-title rarity-secret">🔒 ปืนติดผนังประจำด่านนี้</div>`;
      html += `<div class="weaponlog-grid">${this.weaponLogCardHtml(w)}</div>`;
    }
    this.el("weaponlog-content").innerHTML = html;
  },
  weaponLogCardHtml(w) {
    const unlocked = (G.save.unlockedWeapons || []).includes(w.id);
    if (!unlocked) {
      return `<div class="weaponlog-card locked"><div class="wl-icon">🔒</div><div class="wl-name">???</div><div class="wl-stats">ยังไม่ปลดล็อก</div></div>`;
    }
    const dps = Math.round(w.damage * (w.pellets || 1) * (1000 / w.fireRate));
    return `<div class="weaponlog-card border-${w.rarity}" style="border-style:solid">
      <div class="wl-icon">🔫</div><div class="wl-name rarity-${w.rarity}">${w.name}</div>
      <div class="wl-stats">ดาเมจ: ${w.damage}${w.pellets ? ` x${w.pellets} นัด` : ""}<br>อัตรายิง: ${(1000 / w.fireRate).toFixed(1)}/วิ<br>แม็กกาซีน: ${w.magSize}<br>DPS โดยประมาณ: ${dps}${w.price ? `<br>ราคา: $${w.price}` : ""}</div>
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
      ? pairs.slice(0, 50).map((p) => `<div>${p[0]} — ${p[1]}</div>`).join("") + (pairs.length > 50 ? `<div>... และอีก ${pairs.length - 50} คำ</div>` : "")
      : "<div>ไม่พบคำศัพท์ที่ถูกต้อง</div>";
    this.el("btn-import-save").disabled = pairs.length === 0;
  },
  handleImportImage(file) {
    if (!file) return;
    const status = this.el("import-ocr-status");
    status.textContent = "กำลังโหลดไลบรารี OCR (ครั้งแรกอาจใช้เวลาสักครู่)...";
    const run = () => {
      status.textContent = "กำลังอ่านตัวอักษรจากภาพ...";
      const url = URL.createObjectURL(file);
      Tesseract.recognize(url, "eng").then(({ data }) => {
        status.textContent = "อ่านเสร็จแล้ว กรุณาตรวจสอบ/แก้ไขคำก่อนบันทึก";
        const lines = data.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        // OCR only reliably gives English words; pair each with a blank Thai meaning for manual edit
        const pairs = lines.map((l) => [l.split(/\s+/)[0], ""]);
        this._pendingImport = { name: file.name.replace(/\.[^.]+$/, "") + "_ocr", words: pairs };
        this.renderImportPreview(pairs);
      }).catch((err) => { status.textContent = "OCR ล้มเหลว: " + err.message + " — ลองใช้ไฟล์ CSV แทน"; });
    };
    if (window.Tesseract) { run(); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js";
    script.onload = run;
    script.onerror = () => { status.textContent = "ไม่สามารถโหลดไลบรารี OCR ได้ (ต้องใช้อินเทอร์เน็ต) — ใช้ไฟล์ CSV แทน"; };
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
    alert("บันทึกชุดคำศัพท์เรียบร้อย ใช้งานได้ใน Practice Mode");
  },
  renderImportedSets() {
    const wrap = this.el("imported-sets-list");
    const ids = Object.keys(G.save.importedSets);
    wrap.innerHTML = ids.length ? ids.map((id) => {
      const set = G.save.importedSets[id];
      return `<div class="imported-set-row"><span>${set.name} (${set.words.length} คำ)</span><button class="btn" data-id="${id}">ลบ</button></div>`;
    }).join("") : "<div style='opacity:.6'>ยังไม่มีชุดคำศัพท์ที่นำเข้า</div>";
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
      <p>เลือกชุดคำศัพท์ที่จะฝึก:</p>
      <div class="tabs">
        <div class="tab-btn" data-src="level1">ด่าน 1</div>
        <div class="tab-btn" data-src="level2">ด่าน 2</div>
        <div class="tab-btn" data-src="level3">ด่าน 3</div>
        <div class="tab-btn" data-src="weak">คำที่เคยตอบผิดบ่อย</div>
        ${importedIds.map((id) => `<div class="tab-btn" data-src="${id}">${G.save.importedSets[id].name}</div>`).join("")}
      </div>
      <div class="row-center"><button class="btn btn-primary" id="btn-practice-start" disabled>เริ่มฝึก</button></div>
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
      alert(`จบการฝึก! ตอบถูก ${this.practiceCorrect}/${this.practicePairs.length}`);
      G.Game.endPractice();
      return;
    }
    const [word, meaning] = this.practicePairs[this.practiceIdx];
    this.el("practice-progress").textContent = `${this.practiceIdx + 1} / ${this.practicePairs.length}`;
    this.el("practice-word").textContent = word;
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
        this.el("practice-feedback").textContent = correct ? "ถูกต้อง!" : `ผิด — คำตอบคือ "${meaning}"`;
        Array.from(cWrap.children).forEach((b) => (b.onclick = null));
        setTimeout(() => { this.practiceIdx++; G.persist(); this.showPracticeCard(); }, 700);
      };
      cWrap.appendChild(btn);
    });
  },

  // ---------------- Pause ----------------
  bindPause() {
    this.el("btn-resume").onclick = () => G.Game.resume();
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
    this.el("btn-pause-settings").onclick = () => { this.renderSettings(); this.showScreen("screen-settings"); };
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
    statsWrap.innerHTML = `
      <div class="result-stat"><div class="result-stat-value">${stats.score}</div><div class="result-stat-label">คะแนน</div></div>
      <div class="result-stat"><div class="result-stat-value">${stats.wave}</div><div class="result-stat-label">เวฟที่ไปถึง</div></div>
      <div class="result-stat"><div class="result-stat-value">${stats.correct}</div><div class="result-stat-label">ตอบถูก</div></div>
      <div class="result-stat"><div class="result-stat-value">${stats.wrong}</div><div class="result-stat-label">ตอบผิด</div></div>
      <div class="result-stat"><div class="result-stat-value">${stats.money}</div><div class="result-stat-label">เงินที่ได้</div></div>
    `;
    const reviewWrap = this.el(kind === "win" ? "victory-review" : "gameover-review");
    const sorted = Object.entries(wrongWords || {}).sort((a, b) => b[1].count - a[1].count);
    reviewWrap.innerHTML = sorted.length
      ? `<div style="opacity:.7;margin-bottom:6px">คำศัพท์ที่ควรทบทวน</div>` + sorted.map(([w, d]) => `<div class="review-item"><span>${w} — ${d.meaning}</span><span class="wrong-count">ผิด ${d.count} ครั้ง</span></div>`).join("")
      : `<div style="opacity:.6">เยี่ยมมาก ไม่มีคำที่ตอบผิดเลย!</div>`;
  },

  // ---------------- Shop ----------------
  bindShop() { this.el("btn-shop-continue").onclick = () => G.Game.leaveShop(); },
  renderShop() {
    this.el("shop-money").textContent = G.Game.player.money;
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
        <div class="shop-item-desc">${item.maxStack ? `ระดับ: ${stack}/${item.maxStack}` : ""}</div>
        <div class="shop-item-price">💰 ${owned ? "ปลดล็อกแล้ว" : maxedOut ? "MAX" : price}</div>
        <button class="btn ${owned || maxedOut ? "" : "btn-primary"}" ${owned || maxedOut || G.Game.player.money < price ? "disabled" : ""}>${owned || maxedOut ? "-" : "ซื้อ"}</button>`;
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
    this.el("crate-weapon-stats").innerHTML = `ดาเมจ: ${weaponDef.damage}<br>อัตรายิง: ${(1000 / weaponDef.fireRate).toFixed(1)} นัด/วิ<br>แม็กกาซีน: ${weaponDef.magSize}`;
    this.showScreen("screen-crate");
  },

  // ---------------- HUD update ----------------
  // Smoothly eases a displayed number toward its real value over real
  // elapsed wall-clock time (not tied to the game's own dt/FPS cap) --
  // money/score/HP used to just snap to the new value instantly.
  _tweenValue(key, target) {
    const now = performance.now();
    this._tweenState = this._tweenState || {};
    const st = this._tweenState[key] || { val: target, t: now };
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
    this.el("hud-stamina-fill").style.width = Math.max(0, p.stamina) + "%";
    this.el("hud-money").textContent = Math.round(dispMoney);
    this.el("hud-score").textContent = Math.round(dispScore);
    this.el("hud-level-wave").textContent = p.levelLabel;
    this.el("hud-zombies-left").textContent = "Zombies: " + p.zombiesLeft;
    this.el("hud-weapon-name").textContent = p.weaponName;
    this.el("hud-ammo").textContent = p.weaponName === "Combat Knife" ? "∞" : `${p.ammoInMag} / ${p.ammoReserve}`;
    this.el("hud-meaning").textContent = p.currentMeaning || "-";
    const slotsWrap = this.el("hud-slots");
    slotsWrap.innerHTML = "";
    p.slots.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "hud-slot" + (s.active ? " active" : "");
      d.textContent = i === 0 ? "K" : String(i + 1);
      slotsWrap.appendChild(d);
    });
    if (p.combo > 1) { this.el("hud-combo").classList.remove("hidden"); this.el("hud-combo").textContent = "COMBO x" + p.combo; }
    else this.el("hud-combo").classList.add("hidden");
  },
  setAimingVisual(v) { this.el("hud-crosshair").classList.toggle("aiming", !!v); },
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
    el.innerHTML = `<div class="pb-title">${subtitle || "ปลดล็อกแล้ว"}</div><div class="pb-name">${name}</div>`;
    el.classList.remove("hidden", "showing");
    void el.offsetWidth;
    el.classList.add("showing");
    clearTimeout(this._pbTimer);
    this._pbTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  },
  // Brief pulse on the relevant HUD stat when a drop is collected (item A1's
  // "ไอเทมเด้งเข้าหา HUD" feedback).
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
    this.el("hud-boss-name").textContent = name;
    this.el("hud-boss-hp-fill").style.width = Math.max(0, hpPct) + "%";
  },
  setBossWord(meaning) { this.el("hud-boss-word").textContent = meaning ? `แปลว่า: ${meaning}` : ""; },
  setBossChoices(choices) {
    const wrap = this.el("hud-boss-choices");
    wrap.innerHTML = (choices || []).map((c, i) => `<div class="hud-boss-choice"><b>[${i + 1}]</b>${c}</div>`).join("");
  },
  setBossTimer(pct) { this.el("hud-boss-timer-fill").style.width = Math.max(0, pct * 100) + "%"; },

  setChallengeVisible(v, label) {
    this.el("hud-challenge-box").classList.toggle("hidden", !v);
    if (label) this.el("hud-challenge-label").textContent = label;
  },
  setChallengeMeaning(meaning) { this.el("hud-challenge-meaning").textContent = meaning || ""; },
  setChallengeChoices(choices) {
    const wrap = this.el("hud-challenge-choices");
    wrap.innerHTML = (choices || []).map((c, i) => `<div class="hud-boss-choice" data-idx="${i}"><b>[${i + 1}]</b>${c}</div>`).join("");
    wrap.querySelectorAll(".hud-boss-choice").forEach((el) => {
      el.onclick = () => G.Game.answerChallenge(parseInt(el.dataset.idx, 10));
    });
  },
  setChallengeTimer(pct) { this.el("hud-challenge-timer-fill").style.width = Math.max(0, pct * 100) + "%"; },
  updateFpsCounter(fps) {
    const el = this.el("hud-fps-counter");
    if (G.save.settings.showFpsCounter) { el.classList.remove("hidden"); el.textContent = Math.round(fps) + " FPS"; }
    else el.classList.add("hidden");
  },
};
