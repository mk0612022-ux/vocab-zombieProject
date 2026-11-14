// Dev-only (not shipped). Runs the test suites window.__suites (numbers) in
// order in the game's page (tools/dev/run-suites.ps1); results in window._all.
// (expansion, round 7: the Training Yard's first-time offer and the situation tips are kept
// from popping up in the other suites -- round 36 sets them as it needs them)
if (G.save) { G.save.training = Object.assign({}, G.save.training, { offered: true }); G.save.settings.tips = false; }
if (G.MainMenu && G.MainMenu.visible()) G.MainMenu.toLobby();
await new Promise((r) => setTimeout(r, 900));
if (G.Modal.isOpen && G.Modal.isOpen("brightness")) G.BrightnessCal.ok();
G.Input.requestPointerLock = () => {};
if (G.save) G.save.settings.spellReload = false;
// (and Auto Reload on: suite 26 turns it off, and a restore not yet written when the browser was
// closed left it off -- suite 21's empty-magazine reload then never came, 2026-11-14)
if (G.save) G.save.settings.autoReload = true;
// (a suite that died mid-way can leave the profile in another language or on touch controls)
if (G.save) G.save.settings.controlMode = "auto";
// (a run cut off in a suite that tries the higher tiers leaves the profile there: too slow for this browser)
if (G.save && G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; G.Game.applyGraphicsQuality(); }
// (learning progress piled up by earlier runs turns campaign runs into spelling runs: start from none)
if (G.save) { const d0 = G.defaultSave(); ["learn", "learnSeen", "wordStats", "checkpoints", "customWords", "attach"].forEach((k) => { G.save[k] = JSON.parse(JSON.stringify(d0[k])); }); if (G.Attach) G.Attach.apply(); G.save.settings.fontSize = "medium"; G.save = G.normalizeSave(G.save); G.persist(); }
// (and the words in English with Thai meanings: a run left Chinese words with Thai meanings in the profile, 2026-11, and suite 16 read the Loading screen's words as English)
if (G.save && (G.save.settings.wordLang !== "en" || G.save.settings.meaningLang !== "th")) { G.save.settings.wordLang = "en"; G.save.settings.meaningLang = "th"; G.persist(true); }
if (G.lang !== "en") await new Promise((r) => G.setUILang("en", { done: r }));
window._all = { running: true, res: {}, cur: null };
(async () => {
  for (const n of window.__suites || [18]) {
    window._all.cur = n;
    // (a suite that left the game's update stubbed does not break the next one)
    if (G.Game._update0) G.Game.update = G.Game._update0;
    try {
      await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "/tools/round" + n + "-test.js?v=" + Date.now(); s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const r = await G["Round" + n + "Test"].run();
      const pass = Array.isArray(r.pass) ? r.pass.length : r.pass;
      const fails = Array.isArray(r.fail) ? r.fail : (r.results || []).filter((c) => c.pass === false).map((c) => c.name + " :: " + c.info);
      window._all.res[n] = { pass, total: r.total, fails };
    } catch (e) { window._all.res[n] = { err: String(e && e.stack || e) }; }
  }
  window._all.running = false;
})();
return "started";
