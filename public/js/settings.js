// ===================================================================
// The Settings page (new series, round 2, F)
// -------------------------------------------------------------------
// A round back button and the page's ribbon at the top left; the categories
// down the left (along the top on a narrow phone), the chosen one lit with
// its colour and a picture, a red dot on one that wants a look (not signed
// in, a new version out); on the right that category's settings, one a row:
// its name on the left, its control on the right -- a segmented choice for
// steps (Low / Medium / High), a slider for an amount, a switch for on/off --
// and a line of faint text under it. Every setting the game had is here
// (the report of round 2 lists where each went), plus Render Resolution and
// the screen-edge margin.
//
// From the lobby and from the pause menu. A change applies at once (a row
// that needs a restart says so); what a run cannot change mid-level (the
// Learning Style, the word languages) is greyed out there with "Change this
// from the lobby".
//
// Every category's rows are drawn at once and only the chosen one shown, so
// a control is always there by its id (#set-quality, #set-spellreload ...).
// Mouse and touch: tap. Keys: Tab, the arrows (up/down a row, left/right a
// choice), Q / E a category, Esc back. A controller: the D-pad (left/right
// changes a choice), A, B back, LB / RB a category.
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const $ = (id) => document.getElementById(id);

  // the categories: their icon and the picture behind the chosen one
  const CATS = [
    { id: "graphics", icon: "🖥️", art: "school-card" },
    { id: "audio", icon: "🔊", art: "hospital-card" },
    { id: "controls", icon: "🎮", art: "bunker-card" },
    { id: "gameplay", icon: "🧟", art: "endless-card" },
    { id: "language", icon: "🌐", art: "daily-card" },
    { id: "accessibility", icon: "👁️", art: "practice-card" },
    { id: "account", icon: "👤", art: "custom-card" },
    { id: "about", icon: "ℹ️", art: "school-card" },
  ];
  const ACTIONS = ["forward", "back", "left", "right", "sprint", "jump", "reload", "interact", "melee", "slot2", "slot3", "slot4", "slot5", "slot6", "slot7",
    "ability1", "ability2", "ability3", "ability4", "replay", "thaiHint", "pause"];
  // a language's name in itself (the Thai built from its code points: no
  // Thai letters in the UI's source, tools/thai-scan.ps1)
  const LANG_NAMES = { en: "English", th: String.fromCharCode(0x0E44, 0x0E17, 0x0E22) };

  // ---------------- the pieces of a row ----------------
  const row = (o) => `<div class="set-row${o.locked ? " locked" : ""}${o.hidden ? " hidden" : ""}" data-row="${o.id}">
      <div class="set-line"><span class="set-name" id="${o.id}-name">${o.nameHtml || esc(o.name)}</span><div class="set-ctl">${o.ctl}</div></div>
      ${o.locked || o.desc != null ? `<div class="set-desc"${o.descId ? ` id="${o.descId}"` : ""}>${o.locked ? `<span class="set-lock">🔒 ${esc(T("settings.lobbyOnly"))}</span> ` : ""}${o.desc ? esc(o.desc) : ""}</div>` : ""}
    </div>`;
  const seg = (id, value, opts, off) => `<div class="seg" id="${id}" role="radiogroup" aria-labelledby="${id}-name" data-value="${esc(value)}">${opts.map(([v, label]) =>
    `<button type="button" role="radio" class="seg-o${String(v) === String(value) ? " on" : ""}" data-v="${esc(v)}" aria-checked="${String(v) === String(value)}"${off ? " disabled" : ""}>${esc(label)}</button>`).join("")}</div>`;
  // (--p: how far along it is, for the green fill)
  const fill = (v, min, max) => Math.round(((v - min) / (max - min)) * 100) + "%";
  const slider = (id, value, min, max, step, text, off) => `<div class="sld"><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="--p:${fill(value, min, max)}" aria-labelledby="${id}-name"${off ? " disabled" : ""}><output id="${id}-v">${esc(text)}</output></div>`;
  const toggle = (id, on, off) => `<label class="sw"><input type="checkbox" role="switch" id="${id}"${on ? " checked" : ""} aria-labelledby="${id}-name"${off ? " disabled" : ""}><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span></label>`;
  const button = (id, label, cls, off) => `<button class="btn set-btn${cls ? " " + cls : ""}" id="${id}" type="button"${off ? " disabled" : ""}>${esc(label)}</button>`;
  const pct = (v) => Math.round(v * 100) + "%";
  const times = (v) => Number(v).toFixed(2) + "×";

  G.SettingsUI = {
    cat: "graphics",

    // what each control does: its id -> (value) => applied (and saved)
    on: {},

    render() {
      const s = G.save.settings;
      const inRun = this.inRun();
      const wrap = $("settings-content");
      // a full redraw keeps the category and, if it can, the focus
      const keep = document.activeElement && document.activeElement.id && wrap.contains(document.activeElement) ? document.activeElement.id : null;
      $("set-cats").innerHTML = CATS.map((c) => `<button type="button" role="tab" class="set-cat${c.id === this.cat ? " on" : ""}" id="set-cat-${c.id}" data-cat="${c.id}" aria-selected="${c.id === this.cat}"
          aria-controls="set-sec-${c.id}" style="--art:url('assets/lobby/${c.art}.jpg')"${c.id === this.cat ? " data-pad-start" : ""}><span class="sc-icon" aria-hidden="true">${c.icon}</span><span class="sc-name">${esc(T("settings.cat." + c.id))}</span><i class="sc-dot hidden" aria-hidden="true"></i></button>`).join("");
      wrap.innerHTML = CATS.map((c) => `<section class="set-sec${c.id === this.cat ? "" : " hidden"}" id="set-sec-${c.id}" role="tabpanel" aria-labelledby="set-cat-${c.id}">
          <header class="set-head"><h3>${esc(T("settings.cat." + c.id))}</h3><p>${esc(T("settings.catDesc." + c.id))}</p></header>
          ${this[c.id](s, inRun)}
        </section>`).join("");
      this.bind(s, inRun);
      this.dots();
      this.keysHint();
      const back = keep && $(keep);
      if (back && G.Input.mode !== "touch") back.focus({ preventScroll: true });
    },
    inRun() { return G.UI._settingsReturn === "screen-pause" || (G.Game && (G.Game.state === "PAUSE" || G.Game.state === "GAMEPLAY")); },

    // ---------------- the categories ----------------
    graphics(s) {
      const q = [["vlow", T("settings.qVlow")], ["low", T("settings.qLow")], ["medium", T("settings.qMedium")], ["high", T("settings.qHigh")], ["vhigh", T("settings.qVhigh")]];
      const manual = s.safeArea === "manual";
      return row({ id: "set-quality", name: T("settings.quality"), ctl: seg("set-quality", s.graphicsQuality, q), desc: T("settings.qualityDesc") })
        + row({ id: "set-render", name: T("settings.renderScale"), ctl: slider("set-render", s.renderScale, 0.5, 1, 0.05, pct(s.renderScale)), desc: T("settings.renderScaleDesc") })
        + row({ id: "set-fpscap", name: T("settings.fpsCap"), ctl: seg("set-fpscap", s.fpsCap, [[60, "60"], [90, "90"], [120, "120"], [144, "144"], [0, T("settings.unlimited")]]), desc: T("settings.fpsCapDesc") })
        + row({ id: "set-showfps", name: T("settings.showFps"), ctl: toggle("set-showfps", s.showFpsCounter), desc: T("settings.showFpsDesc") })
        + row({ id: "set-showdraws", name: T("settings.showDraws"), ctl: toggle("set-showdraws", !!s.showDrawCalls), desc: T("settings.showDrawsDesc") })
        + row({ id: "btn-hudcfg", name: T("settings.hudSize"), ctl: button("btn-hudcfg", T("settings.hudSizeBtn")), desc: T("settings.hudSizeDesc") })
        + row({ id: "set-safearea", name: T("settings.safeArea"), ctl: seg("set-safearea", s.safeArea, [["auto", T("settings.safeAuto")], ["manual", T("settings.safeManual")]]), desc: T("settings.safeAreaDesc") })
        + row({ id: "set-safemargin", name: T("settings.safeMargin"), ctl: slider("set-safemargin", s.safeMargin, 0, 60, 2, s.safeMargin + " px"), desc: T("settings.safeMarginDesc"), hidden: !manual });
    },
    audio(s) {
      return ["sfxVolume", "musicVolume", "ambientVolume", "speechVolume"].map((k) => {
        const v = s[k] == null ? 0.7 : s[k];
        return row({ id: "set-" + k, name: T("settings.vol." + k), ctl: slider("set-" + k, v, 0, 1, 0.05, pct(v)).replace("<input ", `<input class="set-vol" data-key="${k}" `), desc: T("settings.volDesc." + k) });
      }).join("")
        + row({ id: "set-speechmode", name: T("settings.speechMode"), ctl: seg("set-speechmode", s.speechMode || "after", [["after", T("settings.speechAfterShort")], ["before", T("settings.speechBeforeShort")], ["off", T("settings.speechOff")]]), desc: T("settings.speechModeDesc") })
        + row({ id: "set-accent", name: T("settings.accent"), ctl: seg("set-accent", s.accent || "british", ["mixed", "british", "american", "australian"].map((a) => [a, T("settings.accent." + a)])), desc: "", descId: "set-accent-note" })
        + row({ id: "set-speechspeed", name: T("settings.speechSpeed"), ctl: seg("set-speechspeed", s.speechSpeed || "normal", [["normal", T("settings.speedNormal")], ["slow", T("settings.speedSlow")]]), desc: T("settings.speechSpeedDesc") })
        + row({ id: "set-playonce", name: T("settings.playOnce"), ctl: toggle("set-playonce", !!s.playOnce), desc: T("settings.playOnceDesc") })
        + row({ id: "btn-speech-test", name: T("settings.speechTestName"), ctl: button("btn-speech-test", T("settings.speechTest")), desc: T("settings.speechTestDesc") });
    },
    controls(s) {
      const kb = s.keybinds;
      const pad = G.Input.pollGamepad && G.Input.pollGamepad();
      return row({ id: "set-controlmode", name: T("settings.controlMode"), ctl: seg("set-controlmode", s.controlMode, [["auto", T("settings.controlAuto")], ["desktop", T("settings.controlDesktopShort")], ["touch", T("settings.controlTouchShort")]]), desc: T("settings.controlModeDesc") })
        + row({ id: "set-sens", name: T("settings.mouseSensName"), ctl: slider("set-sens", s.mouseSensitivity, 0.2, 2.5, 0.05, times(s.mouseSensitivity)), desc: T("settings.mouseSensDesc") })
        + row({ id: "set-aimassist", name: T("settings.aimAssist"), ctl: seg("set-aimassist", s.aimAssist || "medium", ["off", "low", "medium", "high"].map((v) => [v, T("settings.aimAssist." + v)])), desc: T("settings.aimAssistNote") })
        + row({ id: "set-tlook", name: T("settings.touchLookName"), ctl: slider("set-tlook", G.TouchCfg.lookSens(), 0.3, 3, 0.05, times(G.TouchCfg.lookSens())), desc: T("settings.touchLookDesc") })
        + row({ id: "set-blook", name: T("settings.btnLookName"), ctl: slider("set-blook", G.TouchCfg.btnLookSens(), 0.3, 3, 0.05, times(G.TouchCfg.btnLookSens())), desc: T("settings.btnLookDesc") })
        + row({ id: "btn-touchcfg", name: T("settings.touchLayout"), ctl: button("btn-touchcfg", T("settings.touchLayoutBtn")), desc: T("settings.touchLayoutDesc") })
        + row({ id: "set-padsens", name: T("settings.padSens"), ctl: slider("set-padsens", s.padSensitivity, 0.3, 2.5, 0.05, times(s.padSensitivity)),
          desc: pad ? T("settings.padConnected", { name: String(pad.id || "").replace(/\s*\(.*$/, "").slice(0, 40) }) : T("settings.padNone") })
        + `<div class="set-sub">${esc(T("settings.keybinds"))}<small>${esc(T("settings.keybindsDesc"))}</small></div>
          <div class="keybind-grid">${ACTIONS.map((a) => `<div class="keybind-row"><span>${esc(T("key." + a))}</span><button class="btn keybind-btn" type="button" data-action="${a}">${esc(G.keyLabel(kb[a]))}</button></div>`).join("")}</div>
          <div class="set-actions">${button("btn-reset-keybinds", T("settings.resetKeys"))}</div>`;
    },
    gameplay(s, inRun) {
      const pr = G.Learn.preset(s.campaignStyle || "adaptive");
      const style = pr && pr.custom ? "custom" : (s.campaignStyle || "adaptive");
      const clue = pr && pr.custom ? pr.clue : "definition", answer = pr && pr.custom ? pr.answer : "shoot";
      return row({ id: "set-shoptime", name: T("settings.shopTime"), ctl: seg("set-shoptime", s.shopTime, [[30, T("settings.secondsShort", { n: 30 })], [45, T("settings.secondsShort", { n: 45 })], [60, T("settings.secondsShort", { n: 60 })], [0, T("settings.shopNoLimitShort")]]), desc: T("settings.shopTimeDesc") })
        + row({ id: "set-campstyle", name: T("settings.campStyle"), ctl: seg("set-campstyle", style, ["adaptive", "classic", "custom"].map((v) => [v, T("camp.style." + v)]), inRun), desc: T("settings.campStyleDesc"), locked: inRun })
        + row({ id: "set-campclue", name: T("learn.clueHead"), ctl: seg("set-campclue", clue, Object.keys(G.Learn.CLUES).map((c) => [c, T("learn.clue." + c)]), inRun), desc: null, locked: inRun, hidden: style !== "custom" })
        + row({ id: "set-campanswer", name: T("learn.answerHead"), ctl: seg("set-campanswer", answer, Object.keys(G.Learn.ANSWERS).map((a) => [a, T("learn.answer." + a)]), inRun), desc: null, locked: inRun, hidden: style !== "custom" })
        + row({ id: "set-spellreload", name: T("settings.spellReload"), ctl: toggle("set-spellreload", !!s.spellReload), desc: T("settings.spellReloadDesc") })
        + row({ id: "set-highlight", name: T("settings.highlightTarget"), ctl: toggle("set-highlight", !!s.highlightTarget), desc: T("settings.highlightDesc") })
        + row({ id: "set-cluethai", name: T("settings.clueThaiName"), ctl: seg("set-cluethai", s.clueThai || "auto", [["auto", T("settings.clueThaiAutoShort")], ["always", T("settings.clueThaiAlways")], ["never", T("settings.clueThaiNever")]]), desc: T("settings.clueThaiDesc") })
        + row({ id: "btn-settings-customvocab", name: T("settings.customVocab", { n: G.CustomVocab.count() }), ctl: button("btn-settings-customvocab", T("settings.customVocabBtn")), desc: T("settings.customVocabDesc") });
    },
    // (the three languages, as round 3 will let them be chosen; each named in
    // its own language)
    language(s, inRun) {
      const self = (html) => html.replace(/<button /g, "<button data-lang-self ");
      return row({ id: "set-uilang", name: T("settings.uiLang"), ctl: self(seg("set-uilang", "en", [["en", LANG_NAMES.en]])), desc: T("settings.uiLangDesc") })
        + row({ id: "set-wordlang", name: T("settings.wordLang"), ctl: self(seg("set-wordlang", "en", [["en", LANG_NAMES.en]], inRun)), desc: T("settings.wordLangDesc"), locked: inRun })
        + row({ id: "set-meanlang", name: T("settings.meanLang"), ctl: self(seg("set-meanlang", "th", [["th", LANG_NAMES.th]], inRun)), desc: T("settings.meanLangDesc"), locked: inRun })
        + `<p class="set-foot">${esc(T("settings.langMore"))}</p>`;
    },
    accessibility(s) {
      const hb = s.headBob == null ? 1 : s.headBob;
      return row({ id: "set-gamespeed", name: T("settings.gameSpeedName"), ctl: slider("set-gamespeed", s.gameSpeed, 0.5, 1.5, 0.05, times(s.gameSpeed)), desc: T("settings.gameSpeedDesc") })
        + row({ id: "set-fontsize", name: T("settings.fontSize"), ctl: seg("set-fontsize", s.fontSize, [["small", T("settings.fontSmall")], ["medium", T("settings.fontMedium")], ["large", T("settings.fontLarge")]]), desc: T("settings.fontSizeDesc") })
        + row({ id: "set-colorblind", name: T("settings.colorblind"), ctl: toggle("set-colorblind", !!s.colorblindMode), desc: T("settings.colorblindDesc") })
        + row({ id: "set-headbob", name: T("settings.headBobName"), ctl: slider("set-headbob", hb, 0, 1, 0.05, pct(hb), !!s.headBobOff), desc: T("settings.headBobDesc") })
        + row({ id: "set-headbob-off", name: T("settings.headBobOff"), ctl: toggle("set-headbob-off", !!s.headBobOff), desc: T("settings.headBobOffDesc") });
    },
    account() {
      const a = G.Account.state();
      return `<div class="set-profile"><span class="sp-avatar" aria-hidden="true">👤</span><div class="sp-who"><b>${esc(a.signedIn ? a.name : T("account.guest"))}</b>
          <small>${esc(a.signedIn ? T("start.uid", { uid: a.uid }) : T("settings.notSignedIn"))}</small></div>${a.signedIn ? "" : button("btn-set-signin", T("account.signIn"), "btn-primary")}</div>`
        + row({ id: "set-sync", name: T("settings.sync"), ctl: `<span class="set-val" id="set-sync">${esc(T(a.signedIn ? "settings.syncOn" : "settings.syncLocal"))}</span>`, desc: T("settings.syncDesc") })
        + row({ id: "btn-export-save", name: T("settings.saveData"), ctl: `<span class="set-btns">${button("btn-export-save", T("settings.exportSave"))}${button("btn-import-save-settings", T("settings.importSave"))}</span><input type="file" id="import-save-file" accept="application/json" class="hidden">`, desc: T("settings.saveDataDesc") })
        + row({ id: "btn-delete-account", name: T("settings.deleteAccount"), ctl: button("btn-delete-account", T("settings.deleteAccountBtn"), "btn-danger", !a.signedIn), desc: T("settings.deleteAccountDesc") })
        + `<div class="set-bar">${button("btn-signout", T("settings.signOut"), "", !a.signedIn)}<small>${esc(a.signedIn ? "" : T("settings.signOutGuest"))}</small></div>`;
    },
    about() {
      return row({ id: "btn-check-update", name: T("settings.version"), nameHtml: `${esc(T("settings.version"))}`, ctl: `<span class="set-version" data-version>${esc(G.Updater ? G.Updater.label() : "")}</span>${button("btn-check-update", T("settings.checkUpdates"))}`, desc: "", descId: "set-update-note" })
        + row({ id: "btn-privacy", name: T("privacy.title"), ctl: button("btn-privacy", T("settings.privacyBtn")), desc: T("settings.privacyDesc") })
        + `<p class="set-foot">${esc(T("menu.madeWith"))}</p>`;
    },

    // ---------------- what the controls do ----------------
    bind(s, inRun) {
      const wrap = $("settings-content");
      const save = () => G.persist();
      const H = this.on = {
        "set-quality": (v) => { s.graphicsQuality = v; G.Game.applyGraphicsQuality && G.Game.applyGraphicsQuality(); },
        "set-render": (v) => { s.renderScale = v; G.Game.applyGraphicsQuality && G.Game.applyGraphicsQuality(); return pct(v); },
        "set-fpscap": (v) => { s.fpsCap = parseInt(v, 10); },
        "set-showfps": (v) => { s.showFpsCounter = v; G.UI.el("hud-fps-counter").classList.toggle("hidden", !v); },
        "set-showdraws": (v) => { s.showDrawCalls = v; },
        "set-safearea": (v) => { s.safeArea = v; G.applySafeArea(); this.show("set-safemargin", v === "manual"); },
        "set-safemargin": (v) => { s.safeMargin = Math.round(v); G.applySafeArea(); return Math.round(v) + " px"; },
        "set-speechmode": (v) => { s.speechMode = v; },
        "set-accent": (v) => { s.accent = v; this.accentNote(); G.Audio.unlock(); G.Audio.speak("vocabulary"); },
        "set-speechspeed": (v) => { s.speechSpeed = v; G.Audio.unlock(); G.Audio.speak("vocabulary"); },
        "set-playonce": (v) => { s.playOnce = v; },
        "set-controlmode": (v) => { s.controlMode = v; G.Input.mode = v === "auto" ? G.Input.mode : v; G.UI.applyControlMode(); this.keysHint(); },
        "set-sens": (v) => { s.mouseSensitivity = v; return times(v); },
        "set-aimassist": (v) => { s.aimAssist = v; },
        "set-tlook": (v) => { G.TouchCfg.setLookSens(v); return times(v); },
        "set-blook": (v) => { G.TouchCfg.setBtnLookSens(v); return times(v); },
        "set-padsens": (v) => { s.padSensitivity = v; return times(v); },
        "set-shoptime": (v) => { s.shopTime = parseInt(v, 10); },                // (a shop already open keeps its clock)
        "set-campstyle": (v) => { this.setStyle({ style: v }); },
        "set-campclue": (v) => { this.setStyle({ clue: v }); },
        "set-campanswer": (v) => { this.setStyle({ answer: v }); },
        "set-spellreload": (v) => { s.spellReload = v; },                         // (from the next reload on)
        "set-highlight": (v) => {
          s.highlightTarget = v;
          if (G.Game.zombies) G.Game.zombies.forEach((z) => { if (z.alive) { z._label = null; z.setTarget(z.isTarget); } });
        },
        "set-cluethai": (v) => { s.clueThai = v; },
        "set-gamespeed": (v) => { s.gameSpeed = v; return times(v); },
        "set-fontsize": (v) => { s.fontSize = v; G.UI.applyFontSizeClass(); },
        "set-colorblind": (v) => { s.colorblindMode = v; if (G.Game.state === "GAMEPLAY" && G.Game.buildWeaponViewModel) G.Game.buildWeaponViewModel(); },
        "set-headbob": (v) => { s.headBob = v; return pct(v); },
        "set-headbob-off": (v) => { s.headBobOff = v; const hb = $("set-headbob"); if (hb) hb.disabled = v; },
        "set-uilang": () => {}, "set-wordlang": () => {}, "set-meanlang": () => {},
      };
      // the volumes: heard as they move
      ["sfxVolume", "musicVolume", "ambientVolume", "speechVolume"].forEach((k) => {
        H["set-" + k] = (v) => { s[k] = v; G.Audio.applyVolumes(); return pct(v); };
      });
      // segmented choices
      wrap.querySelectorAll(".seg").forEach((g) => {
        g.querySelectorAll(".seg-o").forEach((b) => {
          b.onclick = () => { if (!b.disabled) this.pick(g, b.dataset.v); };
        });
      });
      // sliders: live, saved when let go
      wrap.querySelectorAll('input[type="range"]').forEach((inp) => {
        inp.oninput = () => {
          const h = H[inp.id], text = h ? h(parseFloat(inp.value)) : null;
          const out = $(inp.id + "-v"); if (out && text != null) out.textContent = text;
          inp.style.setProperty("--p", fill(parseFloat(inp.value), parseFloat(inp.min), parseFloat(inp.max)));
        };
        inp.onchange = () => {
          save();
          // (a test sound at the new volume)
          if (inp.id === "set-sfxVolume") { G.Audio.unlock(); G.Audio.sfx("pickup"); }
        };
      });
      // switches
      wrap.querySelectorAll('input[type="checkbox"][role="switch"]').forEach((inp) => {
        inp.onchange = () => { const h = H[inp.id]; if (h) h(inp.checked); save(); this.flash(inp.closest(".sw")); };
      });
      // the buttons
      const click = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
      click("btn-hudcfg", () => G.HudCfg.openEditor());
      click("btn-touchcfg", () => G.TouchCfg.openEditor());
      click("btn-speech-test", () => { G.Audio.unlock(); G.Audio.speak("vocabulary"); });
      click("btn-reset-keybinds", () => { s.keybinds = G.defaultKeybinds(); save(); this.render(); });
      wrap.querySelectorAll(".keybind-btn").forEach((b) => { b.onclick = () => { b.textContent = "..."; G.Input.rebindingAction = b.dataset.action; }; });
      click("btn-settings-customvocab", () => G.CustomVocabUI.open("screen-settings"));
      click("btn-set-signin", () => G.Account.signIn(() => this.render()));
      click("btn-signout", () => G.Account.signOut(() => this.render()));
      click("btn-delete-account", () => G.Account.deleteAccount(() => this.render()));
      click("btn-export-save", () => G.exportSave());
      click("btn-import-save-settings", () => $("import-save-file").click());
      click("btn-privacy", () => this.openPrivacy());
      // (C1) a look for a newer version now
      click("btn-check-update", async () => {
        const note = $("set-update-note");
        note.textContent = T("settings.checking");
        const r = G.Updater ? await G.Updater.checkNow() : "dev";
        note.textContent = T("settings.update." + r, { v: G.Updater && G.Updater.pending ? "v" + G.Updater.pending.version : "" });
        this.dots();
        // (from the lobby's Settings: straight to Update; in a run, it waits for the lobby)
        if (r === "found") { if (G.Game.state === "MENU") G.Updater.showUpdate(); else G.Updater._offerLater = true; }
      });
      // (category L) the file is read and checked BEFORE asking, so the
      // overwrite question shows what is in it next to what would be lost
      const file = $("import-save-file");
      if (file) file.onchange = (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        if (!f) return;
        G.readSaveFile(f, (err, res) => {
          if (err) { alert(T("save.importFailed", { msg: err.message })); return; }
          const a = res.summary, b = G.saveSummary(G.save);
          const when = res.exportedAt ? new Date(res.exportedAt).toLocaleString("en-GB") : T("common.unknown");
          if (!confirm(T("save.importConfirm", { when, al: a.levels, aw: a.words, aa: a.achievements, ag: a.weapons, bl: b.levels, bw: b.words, ba: b.achievements, bg: b.weapons }))) return;
          G.applyImportedSave(res.save);
          alert(T("save.importDone"));
          this.render();
        });
      };
      // the categories: a tap, or the focus arriving (keys, a controller)
      $("set-cats").querySelectorAll(".set-cat").forEach((b) => {
        b.onclick = () => this.select(b.dataset.cat);
        b.onfocus = () => this.select(b.dataset.cat);
      });
      this.accentNote();
    },
    // a segmented choice made: lit, applied, saved
    pick(g, v) {
      if (g.dataset.value === String(v)) return;
      g.dataset.value = v;
      let picked = null;
      g.querySelectorAll(".seg-o").forEach((o) => {
        const on = o.dataset.v === String(v);
        o.classList.toggle("on", on); o.setAttribute("aria-checked", on);
        if (on) picked = o;
      });
      const h = this.on[g.id];
      if (h) h(v);
      G.persist();
      this.flash(picked);
    },
    // the glow of a choice just made
    flash(el) { if (!el) return; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); },
    show(rowId, on) { const r = document.querySelector(`#settings-content [data-row="${rowId}"]`); if (r) r.classList.toggle("hidden", !on); },
    // the campaign's Learning Style (js/campstyle.js keeps the same setting)
    setStyle(p) {
      const s = G.save.settings, pr = G.Learn.preset(s.campaignStyle || "adaptive");
      const cur = { style: pr && pr.custom ? "custom" : s.campaignStyle, clue: pr && pr.custom ? pr.clue : ($("set-campclue") || {}).dataset.value || "definition", answer: pr && pr.custom ? pr.answer : ($("set-campanswer") || {}).dataset.value || "shoot" };
      Object.assign(cur, p);
      const id = cur.style === "custom" ? G.Learn.customId(cur.clue, cur.answer) : cur.style;
      if (G.Learn.campaignStyleOk(id)) s.campaignStyle = id;
      this.show("set-campclue", cur.style === "custom");
      this.show("set-campanswer", cur.style === "custom");
    },
    accentNote() {
      const el = $("set-accent-note");
      if (!el) return;
      const s = G.save.settings, a = s.accent || "british", A = G.Audio;
      const names = A.voices().map((v) => v.name.replace(/^Microsoft |^Google /, "").split(/ [-(]/)[0] + " (" + v.lang + ")");
      // (the voices come a moment after the page: say so when they do)
      if (!names.length && "speechSynthesis" in window && speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", () => this.accentNote(), { once: true });
      el.textContent = !names.length ? T("settings.accentNone")
        : (a !== "mixed" && !A.hasAccent(a) ? T("settings.accentMissing", { a: T("settings.accent." + a) }) + " " : "") + T("settings.accentVoices", { list: names.join(", ") });
    },
    // the red dots: not signed in; a new version out
    dots() {
      const dot = (c, on) => { const d = document.querySelector(`#set-cat-${c} .sc-dot`); if (d) d.classList.toggle("hidden", !on); };
      dot("account", !(G.Account && G.Account.state().signedIn));
      dot("about", !!(G.Updater && G.Updater.pending));
    },
    keysHint() {
      const el = $("set-keys");
      if (el) el.textContent = T(G.Input.padActive ? "settings.keysPad" : "settings.keysKbd");
    },

    // ---------------- moving about ----------------
    select(cat) {
      if (!CATS.some((c) => c.id === cat)) return;
      const sec = $("set-sec-" + cat);
      if (cat === this.cat && sec && !sec.classList.contains("hidden")) return;
      this.cat = cat;
      CATS.forEach((c) => {
        const b = $("set-cat-" + c.id), sec = $("set-sec-" + c.id), on = c.id === cat;
        if (b) { b.classList.toggle("on", on); b.setAttribute("aria-selected", on); if (on) b.setAttribute("data-pad-start", ""); else b.removeAttribute("data-pad-start"); }
        if (sec) sec.classList.toggle("hidden", !on);
      });
      const panel = $("settings-content"); if (panel) panel.scrollTop = 0;
    },
    cycle(d) {
      const i = CATS.findIndex((c) => c.id === this.cat);
      const next = CATS[(i + d + CATS.length) % CATS.length].id;
      this.select(next);
      const b = $("set-cat-" + next);
      if (b && G.Input.mode !== "touch") { b.focus({ preventScroll: true }); if (G.Pad.focused) G.Pad.setFocus(b); }
    },
    back() {
      if (this._privacy) { this.closePrivacy(); return; }
      if (G.UI._settingsReturn === "screen-pause") G.UI.showScreen("screen-pause");
      else G.UI.goToMainMenu();
    },
    // the rows of the shown category, top to bottom: where up and down go
    stops() {
      const sec = $("set-sec-" + this.cat);
      if (!sec) return [];
      const out = [];
      sec.querySelectorAll(".set-row:not(.hidden), .set-profile, .keybind-row, .set-actions, .set-bar").forEach((r) => {
        const on = r.querySelector(".seg-o.on:not([disabled])") || r.querySelector("button:not([disabled]), input:not([disabled]):not([type=file])");
        if (on && on.getClientRects().length) out.push(on);
      });
      return out;
    },
    // keys on this page (from G.onKeyDown, before the game's own)
    onKey(e) {
      if (G.UI._currentScreen !== "screen-settings" || G.Modal.isOpen() || G.Input.rebindingAction) return false;
      const k = e.code, a = document.activeElement;
      const prevent = () => { if (e.preventDefault) e.preventDefault(); };
      if (k === "Escape" || k === "Backspace") { prevent(); this.back(); return true; }
      if (k === "KeyQ" || k === "PageUp") { prevent(); this.cycle(-1); return true; }
      if (k === "KeyE" || k === "PageDown") { prevent(); this.cycle(1); return true; }
      const inNav = a && a.closest && a.closest("#set-cats");
      if (k === "ArrowUp" || k === "ArrowDown") {
        prevent();
        const d = k === "ArrowUp" ? -1 : 1;
        if (inNav) { this.cycle(d); return true; }
        const list = this.stops();
        const cur = a && list.findIndex((x) => x === a || (x.closest(".set-row, .keybind-row, .set-actions, .set-bar, .set-profile") && x.closest(".set-row, .keybind-row, .set-actions, .set-bar, .set-profile") === (a.closest && a.closest(".set-row, .keybind-row, .set-actions, .set-bar, .set-profile"))));
        const next = list[cur < 0 ? 0 : Math.max(0, Math.min(list.length - 1, cur + d))];
        if (next) next.focus({ preventScroll: false });
        return true;
      }
      if (k === "ArrowLeft" || k === "ArrowRight") {
        const d = k === "ArrowLeft" ? -1 : 1;
        if (inNav) { if (d > 0) { const f = this.stops()[0]; if (f) { prevent(); f.focus(); } } return true; }
        if (a && a.closest && a.closest(".seg")) { prevent(); if (!this.segStep(a, d) && d < 0) this.toNav(); return true; }
        if (a && a.type === "range") return false;          // the slider's own
        if (d < 0) { prevent(); this.toNav(); return true; }
        return false;
      }
      if ((k === "Enter" || k === "NumpadEnter") && a && a.type === "checkbox") { prevent(); a.click(); return true; }
      return false;
    },
    toNav() { const b = $("set-cat-" + this.cat); if (b) b.focus({ preventScroll: true }); },
    // left / right on a segmented choice: the next one along, chosen
    // (false at the end: nothing that way)
    segStep(el, d) {
      const g = el.closest(".seg"), opts = Array.from(g.querySelectorAll(".seg-o:not([disabled])"));
      const i = opts.indexOf(el.closest(".seg-o")), next = opts[i + d];
      if (!next) return false;
      this.pick(g, next.dataset.v);
      next.focus({ preventScroll: true });
      if (G.Pad.focused) G.Pad.setFocus(next);
      return true;
    },

    // ---------------- the privacy policy ----------------
    openPrivacy() {
      $("privacy-body").innerHTML = T("privacy.body");
      $("privacy").classList.remove("hidden");
      this._privacy = true;
      $("btn-privacy-close").onclick = () => this.closePrivacy();
      G.Modal.open("privacy", { keys: (e) => {
        if (e.code === "Escape" || e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Backspace") { if (e.preventDefault) e.preventDefault(); this.closePrivacy(); return true; }
        if (e.code === "ArrowDown" || e.code === "ArrowUp") { $("privacy-body").scrollTop += e.code === "ArrowDown" ? 60 : -60; return true; }
        return true;
      } });
      $("privacy-body").scrollTop = 0;
      setTimeout(() => { if (G.Input.mode !== "touch") $("btn-privacy-close").focus({ preventScroll: true }); }, 0);
    },
    closePrivacy() {
      if (!this._privacy) return;
      this._privacy = false;
      $("privacy").classList.add("hidden");
      G.Modal.close("privacy");
      const b = $("btn-privacy");
      if (b && G.Input.mode !== "touch") { b.focus({ preventScroll: true }); if (G.Pad.focused) G.Pad.setFocus(b); }
    },
  };

  // (new series, round 2, F) the screen-edge margin: Auto takes what the
  // device reports (a notch, rounded corners); Manual, the player's own --
  // every padding that keeps clear of the edges reads --sa-l/r/t/b (css)
  G.applySafeArea = function () {
    const s = G.save && G.save.settings, root = document.documentElement.style;
    if (!s || s.safeArea !== "manual") { ["l", "r", "t", "b"].forEach((k) => root.removeProperty("--sa-" + k)); return; }
    const m = Math.max(0, Math.min(60, Math.round(s.safeMargin))) + "px", half = Math.round(Math.max(0, Math.min(60, s.safeMargin)) / 2) + "px";
    root.setProperty("--sa-l", m); root.setProperty("--sa-r", m); root.setProperty("--sa-t", half); root.setProperty("--sa-b", half);
  };
})();
