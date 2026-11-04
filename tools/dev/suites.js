// Dev-only (not shipped). Runs the test suites window.__suites (numbers) in
// order in the game's page (tools/dev/run-suites.ps1); results in window._all.
if (G.MainMenu && G.MainMenu.visible()) G.MainMenu.toLobby();
await new Promise((r) => setTimeout(r, 900));
if (G.Modal.isOpen && G.Modal.isOpen("brightness")) G.BrightnessCal.ok();
G.Input.requestPointerLock = () => {};
if (G.save) G.save.settings.spellReload = false;
// (a suite that died mid-way can leave the profile in another language or on touch controls)
if (G.save) G.save.settings.controlMode = "auto";
// (learning progress piled up by earlier runs turns campaign runs into spelling runs: start from none)
if (G.save) { const d0 = G.defaultSave(); ["learn", "learnSeen", "wordStats", "checkpoints", "customWords"].forEach((k) => { G.save[k] = JSON.parse(JSON.stringify(d0[k])); }); G.save.settings.fontSize = "medium"; G.save = G.normalizeSave(G.save); G.persist(); }
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
