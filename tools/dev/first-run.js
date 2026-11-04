// Dev-only (not shipped). Passed to cdp.ps1 as -Init on the first page load of
// a new test profile: a new profile counts as the game's first run, which picks
// High graphics on a desktop -- far too slow in headless Edge on this machine
// (the page stops answering). The save is set to Low graphics, already past the
// brightness screen, before the game reads it.
(function () {
  try {
    if (location.protocol.indexOf("http") !== 0) return;
    var key = "vocabZombie_save_v1", raw = localStorage.getItem(key);
    var s = raw ? JSON.parse(raw) : { unlockedLevels: [1], settings: {} };
    s.settings = s.settings || {};
    s.settings.graphicsQuality = "low";
    s.settings.brightnessSet = true;
    localStorage.setItem(key, JSON.stringify(s));
  } catch (e) { /* no storage here */ }
})();
