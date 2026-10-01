// Dev-only (not shipped). New list, round 1: the installable app (manifest,
// icons, service worker registration, the update window), icon labels and
// tooltips everywhere, the shop's clock and Ready, health coming back by
// itself, and the moon (sky, light, clouds, shadows, beams, water, the
// bunker's hatch). The save is put back afterwards.
//   const r = await G.Round5Test.run();   r.fail -> []
window.G = window.G || {};
G.Round5Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const until = async (fn, ms) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await tick(); return fn(); };
  const key = (code) => G.onKeyDown({ code, key: code, preventDefault() {}, stopPropagation() {} });

  function fresh(level, quality) {
    const g = G.Game;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = quality || "medium";
    g.startLevel(level || 1);
    g.applyGraphicsQuality();
    g._upd = g._upd || g.update;
    g.update = function () {};
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    g.requiredKills = 1e9;
    return g;
  }

  async function pwa() {
    const man = await fetch("manifest.json?t=" + Date.now()).then((r) => r.json()).catch(() => null);
    ok("A4 manifest: name, fullscreen, landscape", man && /Vocab Zombie/.test(man.name) && man.display === "fullscreen" && man.orientation === "landscape", man && man.display);
    const icons = man ? man.icons.map((i) => i.sizes) : [];
    ok("A4 manifest: icons 192 and 512", icons.includes("192x192") && icons.includes("512x512"), icons.join(","));
    const sizes = await Promise.all(["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].map((f) => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = f + "?t=" + Date.now(); })));
    ok("A4 icon files load at their sizes (192, 512, 180)", sizes[0] === 192 && sizes[1] === 512 && sizes[2] === 180, sizes.join(","));
    ok("A4 page links the manifest and the iOS tags", !!document.querySelector('link[rel=manifest]') && !!document.querySelector('meta[name=apple-mobile-web-app-capable]') && !!document.querySelector('link[rel=apple-touch-icon]'));
    const sw = await fetch("sw.js?t=" + Date.now()).then((r) => r.text()).catch(() => "");
    ok("A4 service worker: a cache version, offline fetch, update check", /CACHE_VERSION/.test(sw) && /addEventListener\("fetch"/.test(sw) && /checkUpdates/.test(sw));
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      ok("A4 no service worker on the local dev server (nothing served stale)", !/[?&]sw=1/.test(location.search) ? regs.length === 0 : true, regs.length);
    }
    // the update window: a modal, keys and a controller reach it, Later closes it
    G.Game.quitToMainMenu();
    G.PWA.offer();
    ok("A4 'New version available' opens in the lobby, as a modal", !document.getElementById("update-dialog").classList.contains("hidden") && G.Modal.isOpen("update"));
    ok("A4 its text", /New version available/.test(document.getElementById("update-dialog").textContent) && /reload/i.test(document.getElementById("btn-update-reload").textContent), document.getElementById("btn-update-reload").textContent);
    ok("A4 a controller's navigation stays in it", G.Pad.scope() === document.getElementById("update-dialog"));
    key("Escape");
    ok("A4 Escape = Later: closed", document.getElementById("update-dialog").classList.contains("hidden") && !G.Modal.isOpen("update"));
    // found during a run: waits for the lobby
    fresh(1); G.Game.state = "GAMEPLAY";
    G.PWA.offer();
    ok("A4 found during a run: not shown over the game", document.getElementById("update-dialog").classList.contains("hidden"));
    G.Game.quitToMainMenu();
    ok("A4 ... shown once back in the lobby", !document.getElementById("update-dialog").classList.contains("hidden"));
    G.PWA.later();
  }

  async function labels() {
    G.UI.goToMainMenu({ tab: "campaign", select: "school" });
    const icons = Array.from(document.querySelectorAll(".lobby-icon"));
    const want = { settings: "Settings", wordlog: "Vocab", armory: "Weapons", journal: "Notes", leaderboard: "Ranks", achievements: "Awards", custom: "Custom" };
    ok("B lobby icons: short name under each", Object.keys(want).every((k) => { const b = icons.find((x) => x.dataset.icon === k); return b && b.querySelector(".li-label").textContent === want[k]; }), icons.map((b) => b.querySelector(".li-label").textContent).join(","));
    ok("B lobby icons: full name as the tooltip", icons.find((b) => b.dataset.icon === "wordlog").dataset.tip === "Vocabulary Log" && icons.find((b) => b.dataset.icon === "leaderboard").dataset.tip === "Leaderboard");
    // a controller or the keys on an icon: its tooltip shows
    // (vocabulary series, round 4: Progress first, so the Word Log is the sixth)
    G.Lobby.setDevice("pad"); G.Lobby.iconI = 5; G.Lobby.focusIcons(true);
    const tip = document.getElementById("tip");
    ok("B controller on an icon: the full name shows", !tip.classList.contains("hidden") && tip.textContent === "Vocabulary Log", tip.textContent);
    G.Lobby.focusIcons(false);
    ok("B ... and goes when it leaves", tip.classList.contains("hidden"));
    // a long press on a touch screen shows it, and does not also open it
    G.Lobby.setDevice("touch");
    const b = icons.find((x) => x.dataset.icon === "settings");
    const r = b.getBoundingClientRect();
    const pe = (type) => b.dispatchEvent(new PointerEvent(type, { pointerType: "touch", clientX: r.left + 5, clientY: r.top + 5, bubbles: true }));
    pe("pointerdown");
    await until(() => false, 600);                 // held for 0.6 s
    pe("pointerup");
    ok("B touch: a long press shows the full name", !tip.classList.contains("hidden") && tip.textContent === "Settings", tip.textContent);
    b.click();
    ok("B touch: the long press does not also open Settings", G.UI._currentScreen === "screen-mainmenu");
    await until(() => false, 750);
    b.click();
    ok("B touch: a normal tap still opens it", G.UI._currentScreen === "screen-settings");
    G.UI.goToMainMenu(); G.Lobby.setDevice("kb");
    // in the game: the HUD's icon buttons and the pause menu's perks
    ok("B HUD: the speaker and the one-letter touch buttons carry names", document.getElementById("hud-speak").dataset.label === "Hear" && document.getElementById("touch-interact").dataset.label === "Use" && document.getElementById("touch-reload").dataset.label === "Reload" && document.getElementById("touch-pause").dataset.label === "Pause");
    const g = fresh(1);
    g.player.perks.focus_time = 1; g.player.perks.second_life = 1;
    g.state = "GAMEPLAY"; g.pause();
    const pp = Array.from(document.querySelectorAll(".pause-perk"));
    ok("B pause menu: every perk icon has its short name and full-name tooltip", pp.length === 2 && pp.every((x) => x.querySelector(".icon-label").textContent && x.dataset.tip), pp.map((x) => x.querySelector(".icon-label").textContent + "/" + x.dataset.tip).join(","));
    g.resume();
  }

  async function shop() {
    const g = fresh(1);
    const S = G.save.settings;
    ok("C Settings: shop time 30 / 45 / 60 / no limit", (() => { G.UI.renderSettings(); const o = Array.from(document.querySelectorAll("#set-shoptime option")).map((x) => x.value); return o.join() === "30,45,60,0"; })());
    ok("C default 45 s", G.defaultSave().settings.shopTime === 45);
    S.shopTime = 45; g.state = "GAMEPLAY"; g.openShop();
    ok("C the shop opens with 45 s", Math.round(g.shopTimer) === 45);
    g._upd.call(g, 0.5);
    ok("C the countdown shows, with a Ready button", /Next wave in/.test(document.getElementById("shop-timer").textContent) && /45|44/.test(document.getElementById("shop-timer").textContent) && document.getElementById("btn-shop-continue").textContent === "Ready");
    // a window on top of the shop holds the clock
    const t0 = g.shopTimer;
    G.Modal.open("inventory", { pause: true });
    for (let i = 0; i < 30; i++) g._upd.call(g, 0.1);
    ok("C the clock waits while another window is on top", Math.abs(g.shopTimer - t0) < 1e-6);
    G.Modal.close("inventory");
    for (let i = 0; i < 10; i++) g._upd.call(g, 0.1);
    ok("C ... and runs again after", g.shopTimer < t0 - 0.9);
    // the game speed setting does not shorten it
    S.gameSpeed = 1.5; const t1 = g.shopTimer; g._upd.call(g, 1); S.gameSpeed = 1;
    ok("C real seconds, whatever the game speed", Math.abs((t1 - g.shopTimer) - 1) < 1e-6);
    g.shopTimer = 10.4; g._upd.call(g, 0.5);
    ok("C the last 10 s: red, pulsing", document.getElementById("shop-timer").classList.contains("warn"));
    document.getElementById("btn-shop-continue").click();
    ok("C Ready starts the next wave at once", g.state === "GAMEPLAY" && !G.Modal.isOpen("shop"));
    S.shopTime = 0; g.openShop();
    for (let i = 0; i < 20; i++) g._upd.call(g, 10);
    ok("C no limit: 200 s later still in the shop", g.state === "SHOP" && /No time limit/.test(document.getElementById("shop-timer").textContent));
    key("Enter");
    ok("C Enter = Ready", g.state === "GAMEPLAY");
    S.shopTime = 45;
  }

  async function regen() {
    const g = fresh(1);
    g.state = "GAMEPLAY"; g.paused = false;
    const pl = g.player, max = pl.maxHp;
    pl.hp = max * 0.5; g._regenFor = null;
    // (new series, round 1, B: 12 s without damage, then 1 HP every 2 s --
    // G.CONFIG.player)
    const C = G.CONFIG.player;
    for (let i = 0; i < C.regenDelay * 10 - 1; i++) g.updateRegen(0.1);   // 11.9 s
    ok("D nothing before 12 s without damage", Math.abs(pl.hp - max * 0.5) < 1e-6);
    for (let i = 0; i < 41; i++) g.updateRegen(0.1);                       // to 16.0 s: 4 s of it
    const got = pl.hp - max * 0.5;
    ok("D then 1 HP every 2 seconds", Math.abs(got - 2) < 1e-6, got);
    ok("D the HUD shows it (green glow)", (() => { G.UI.updateHud(g.buildHudState()); return document.querySelector(".hud-health").classList.contains("regen"); })());
    pl.hp -= 20; g.updateRegen(0.1);
    const after = pl.hp;
    for (let i = 0; i < 110; i++) g.updateRegen(0.1);
    ok("D any damage starts the 12 s again", Math.abs(pl.hp - after) < 1e-6 && !g.regenerating);
    pl.hp = max - 1.5;
    for (let i = 0; i < 200; i++) g.updateRegen(0.1);
    ok("D up to full, not past it", Math.abs(pl.hp - max) < 1e-6 && !g.regenerating);
    // paused, or a window open: nothing moves
    pl.hp = max * 0.5; g._regenFor = null; g.updateRegen(0.01);
    g.pause();
    for (let i = 0; i < 100; i++) g._upd.call(g, 0.1);
    ok("D paused: no health back and the wait does not run", Math.abs(pl.hp - max * 0.5) < 1e-6 && g._sinceHurt < 0.1);
    g.resume();
    G.Modal.open("challenge", { freeze: true });
    for (let i = 0; i < 100; i++) g._upd.call(g, 0.1);
    ok("D a question window open: the same", Math.abs(pl.hp - max * 0.5) < 1e-6);
    G.Modal.close("challenge");
    pl.hp = max * 0.1; G.UI.updateHud(g.buildHudState());
    ok("D low health: red at the edges of the screen", document.getElementById("hud-lowhp").classList.contains("on"));
    pl.hp = max; G.UI.updateHud(g.buildHudState());
    ok("D ... gone when healthy", !document.getElementById("hud-lowhp").classList.contains("on"));
  }

  async function moon() {
    let g = fresh(1, "high");
    const S = G.Sky;
    ok("E school: sky dome, moon, halo, clouds", !!S.dome && !!S.moon && !!S.halo && S.clouds.length >= 7);
    ok("E the moonlight is a silver-blue light from above", !!S.light && S.light.isDirectionalLight && S.light.position.y > S.light.target.position.y && S.light.color.b > S.light.color.r);
    ok("E soft shadows on High", S.light.castShadow && G.Game.renderer.shadowMap.enabled && G.Game.renderer.shadowMap.type === THREE.PCFSoftShadowMap);
    let casters = 0; g.scene.children.forEach((o) => { if (o.castShadow) casters++; });
    ok("E the building, trees and salas cast them", casters > 50, casters);
    ok("E beams through the windows that face the moon, with dust", S.beams.length >= 4 && S.dust.length >= 1);
    ok("E shafts through the fog outdoors", S.shafts.length >= 3);
    ok("E the puddles reflect this sky", G.Details.puddles.length > 0 && G.Details.puddles.every((m) => m.material.envMap === S.cube));
    // a cloud over the moon: the light dims, slowly, and comes back
    S.clouds.forEach((c, i) => { c.speed = 0; c.az = S._moonAz + Math.PI + i * 0.3; });
    const cl = S.clouds[0]; cl.az = S._moonAz; cl.el = S._moonEl;
    for (let i = 0; i < 300; i++) S.update(g, 0.05);
    const dimmed = S.uniforms.uMoon.value, li = S.light.intensity;
    ok("E a cloud over the moon dims the moonlight", dimmed < 0.6 && li < S.LIGHT * 0.8, dimmed.toFixed(2) + " / " + li.toFixed(2));
    cl.az += Math.PI;
    for (let i = 0; i < 300; i++) S.update(g, 0.05);
    ok("E ... and it comes back", S.uniforms.uMoon.value > 0.95);
    // quality: the cheap mesh beams everywhere but the lowest, no shadows low
    G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality();
    ok("E Low: no shadows, the beams still there (plain meshes)", !S.light.castShadow && S.beams.every((m) => m.visible));
    G.save.settings.graphicsQuality = "vlow"; g.applyGraphicsQuality();
    ok("E Very Low: the beams off too", S.beams.every((m) => !m.visible));
    g = fresh(2, "high");
    ok("E hospital: beams through its windows, no sky (no grounds)", G.Sky.beams.length > 0 && !G.Sky.dome && !G.Sky.light);
    g = fresh(3, "high");
    ok("E bunker: no moon, only the hatch to the surface over the entry hall", !G.Sky.dome && !G.Sky.light && !!G.Sky.hatch && G.Sky.hatch.y > 3);
  }

  async function run() {
    results.length = 0;
    const saved = JSON.stringify(G.save);
    G._missingKeys = {};
    try {
      await pwa();
      await labels();
      await shop();
      await regen();
      await moon();
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.save = JSON.parse(saved);
      G.Modal.reset();
      if (G.Game._upd) { G.Game.update = G.Game._upd; }
      G.Game.quitToMainMenu();
    }
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results };
  }
  return { run };
})();
