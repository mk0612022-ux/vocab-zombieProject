// Dev-only (not shipped). The overhaul, round 1: the Weapon State Machine
// in the game -- js/weaponsm.js, js/bus.js, js/game.js, js/viewmodel.js,
// js/gunaudio.js, js/settings.js, js/debug.js, js/lab/weapons.js.
//   A  one machine a run, the gun in the hands built on the first frame
//   B  firing: a pull, a held trigger, an automatic; the HUD's ammo always
//      the game's
//   C  out of a run: the shot waits for the gun's sprint-out
//   D  reloads: tactical (no release step, quicker) and empty; the rounds go
//      in once, when the magazine seats, and the HUD shows it then
//   E  the cancel table: a swap, the knife, a pull, a run, a window, a pause
//   F  switch spam: the last one asked for; the knife's hit frame
//   G  inspect (G, the reload button with a full magazine); lowered for Use
//      and behind a question; put away for a cutscene and shown again
//   H  the settings: Auto Reload, Camera Recoil, Camera Shake, the key
//   I  the gun's place on the screen at 16:9, 4:3, 19.5:9 and 21:9
//   J  the debug overlay and the lab load only when asked for; the machine's
//      own unit and fuzz tests (tools/overhaul/wsm-test.js) pass in the page
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round21Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round21Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const S = () => G.save.settings;
  const C = () => G.CONFIG.weaponSM;

  // a run in the school with nobody in it, stepped by hand
  let realUpd = null, realSpawn = null;
  function start() {
    const g = G.Game;
    // (the real update, wherever an earlier suite kept it while it stubbed its own)
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    g.update = realUpd;
    G.save.tutorialDone = true;
    g.startLevel(1);
    g.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    g.player.hp = g.player.maxHp = 1e6;
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    G.Input.clearHeldInputs();
    step(g, 3);
    return g;
  }
  const hudBad = [];
  function step(g, n, dt) {
    for (let i = 0; i < (n || 1); i++) {
      realUpd.call(g, dt || 1 / 60);
      // the HUD's ammo against the game's, every frame
      const id = g.currentWeaponId(), a = g.player.ammo[id], el = document.getElementById("hud-ammo");
      if (a && el && !G.Modal.isOpen() && g.state === "GAMEPLAY") {
        const m = /(\d+)\s*\/\s*(\d+)/.exec(el.textContent);
        if (m && (+m[1] !== a.mag || +m[2] !== a.reserve)) hudBad.push(el.textContent + " vs " + a.mag + "/" + a.reserve + " [" + g.wsm.state + "]");
      }
    }
  }
  const secs = (g, s) => step(g, Math.ceil(s * 60));
  const key = (code) => G.onKeyDown({ code, repeat: false, preventDefault() {}, stopPropagation() {} });
  const pull = (g) => { G.onFirePress(); step(g, 1); };
  const give = (g, id) => {
    const d = G.WEAPON_DEFS[id];
    if (!g.player.ammo[id]) { g.player.ammo[id] = { mag: d.magSize, reserve: d.magSize * 4 }; g.player.weaponLevels[id] = { dmg: 1, rate: 1, mag: 1 }; }
    if (!g.player.gunSlots.includes(id)) g.player.gunSlots.push(id);
    return g.player.gunSlots.indexOf(id) + 1;
  };
  const events = [];
  const listen = () => { events.length = 0; G.Bus.off("r21"); G.Bus.on("weapon:reload", (e) => events.push(e), "r21"); G.Bus.on("weapon:switch", (e) => events.push(e), "r21"); G.Bus.on("weapon:fire", (e) => events.push(e), "r21"); };

  // ---------------- A ----------------
  function basics() {
    const g = start();
    const W1 = g.wsm;
    ok("A one Weapon State Machine a run (G.WeaponSM), on G.Bus", !!W1 && !!G.Bus && typeof W1.requestFire === "function" && G.WeaponSM.STATES.length === 12);
    ok("A the first frame puts the chosen gun in the hands", W1.held === "pistol" && !!g.weaponViewGroup && G.ViewModel.def && G.ViewModel.def.id === "pistol");
    ok("A Idle", W1.state === "Idle", W1.state);
    const g2 = start();
    ok("A a new run, a new machine", g2.wsm !== W1);
    ok("A the old compatibility fields read the machine (player.reloading, reloadState, weaponAnim.switchT)", g2.player.reloading === false && g2.reloadState === null && g2.weaponAnim.switchT === 0);
  }

  // ---------------- B ----------------
  function firing() {
    const g = start();
    const a = g.player.ammo.pistol, m0 = a.mag;
    listen();
    pull(g);
    ok("B a pull: one round, one weapon:fire event", a.mag === m0 - 1 && events.filter((e) => e.type === "weapon:fire").length === 1, a.mag);
    G.Input.mouseDown = true; G.Input.mode = "desktop";
    secs(g, 0.6);
    ok("B the pistol: a held trigger does not fire again", a.mag === m0 - 1, a.mag);
    G.Input.mouseDown = false;
    const slot = give(g, "smg");
    g.switchSlot(slot); secs(g, 1);
    const s = g.player.ammo.smg, s0 = s.mag;
    G.Input.mouseDown = true; G.onFirePress(); secs(g, 0.5); G.Input.mouseDown = false; step(g, 2);
    ok("B an automatic: fires while held", s0 - s.mag >= 3, s0 + " -> " + s.mag);
    ok("B every frame the HUD's ammo was the game's", !hudBad.length, hudBad.slice(0, 2).join(" | "));
  }

  // ---------------- C ----------------
  function sprint() {
    const g = start();
    const kb = S().keybinds, I = G.Input;
    I.mode = "desktop"; I.keys[kb.sprint] = true; I.keys[kb.forward] = true;
    secs(g, 0.5);
    const a = g.player.ammo.pistol, m0 = a.mag;
    const ran = g.wsm.state === "Sprinting";
    pull(g);
    ok("C running, a pull: no shot yet (the sprint-out), the run ends", ran && a.mag === m0 && !g.wsm.sprinting && g._sprintLatch, g.wsm.state + " " + a.mag);
    secs(g, C().sprintOut.light + 0.05);
    ok("C ...the shot after the light gun's " + C().sprintOut.light + " s", a.mag === m0 - 1, a.mag);
    secs(g, 0.3);
    ok("C still holding sprint: no run until it is let go", !g.wsm.sprinting);
    I.keys[kb.sprint] = false; I.keys[kb.forward] = false; step(g, 2);
  }

  // ---------------- D ----------------
  function reloads() {
    const g = start();
    const a = g.player.ammo.pistol;
    listen();
    a.mag = 5;
    ok("D reload with rounds left: tactical", g.reload() === true && g.wsm.rl.kind === "tactical");
    const R = g.wsm.rl;
    ok("D tactical: no slide release, quicker than an empty one", !R.plan.events.some((e) => e.kind === "bolt") && R.plan.dur < G.WEAPON_DEFS.pistol.reloadTime / 1000);
    secs(g, R.commitAt - 0.06);
    ok("D before the magazine seats: nothing added, the HUD as it was", a.mag === 5 && /^5 \//.test(document.getElementById("hud-ammo").textContent));
    secs(g, 0.12);
    ok("D at magIn: the magazine full, the HUD with it", a.mag === 12 && /^12 \//.test(document.getElementById("hud-ammo").textContent));
    ok("D the HUD's reload ring follows the reload's own clock", g.buildHudState().reloadFrac > 0 && g.buildHudState().reloadFrac < 1);
    secs(g, 1.5);
    const marks = events.filter((e) => e.phase === "marker" && e.reloadId === R.reloadId).map((e) => e.marker);
    ok("D markers: start, magOut, magIn, end -- each once", ["start", "magOut", "magIn", "end"].every((m) => marks.filter((x) => x === m).length === 1), marks.join(","));
    ok("D one commit for the reload", events.filter((e) => e.phase === "commit" && e.reloadId === R.reloadId).length === 1);
    // empty
    a.mag = 0;
    pull(g);
    ok("D empty: a dry click and the reload by itself, an empty one", g.wsm.rl && g.wsm.rl.kind === "empty");
    const R2 = g.wsm.rl;
    secs(g, 2);
    const m2 = events.filter((e) => e.phase === "marker" && e.reloadId === R2.reloadId).map((e) => e.marker);
    ok("D empty: the slide let go at the end (boltRelease)", m2.includes("boltRelease") && a.mag === 12, m2.join(","));
    // shell by shell
    const slot = give(g, "shotgun");
    g.switchSlot(slot); secs(g, 1);
    const sh = g.player.ammo.shotgun;
    sh.mag = 2; g.reload();
    ok("D the shotgun: shell by shell", g.wsm.rl.kind === "loop");
    const R3 = g.wsm.rl;
    secs(g, R3.plan.events[1].t + 0.02);
    const loaded = sh.mag;
    G.onFirePress(); secs(g, 0.6);
    ok("D a pull during the shells: stops after the one in the hand, then fires", !g.wsm.rl && sh.mag === loaded, loaded + " -> " + sh.mag);
  }

  // ---------------- E ----------------
  function cancels() {
    let g = start();
    let a = g.player.ammo.pistol;
    const slot = give(g, "smg");
    a.mag = 4; g.reload(); secs(g, 0.15);
    g.switchSlot(slot); step(g, 1);
    ok("E switch before magIn: cancelled, nothing added", !g.wsm.rl && a.mag === 4 && a.reserve === 48);
    secs(g, 1);
    g.switchSlot(1); secs(g, 1);
    a.mag = 4; g.reload(); const ca = g.wsm.rl.commitAt; secs(g, ca + 0.05);
    key(S().keybinds.melee); step(g, 1);
    ok("E the knife after magIn: cancelled, the rounds stay in", !g.wsm.rl && a.mag === 12);
    secs(g, 1);
    g.switchSlot(1); secs(g, 1);
    a.mag = 4; g.reload(); secs(g, 0.15);
    pull(g);
    ok("E a pull before magIn: cancelled and fired", !g.wsm.rl && a.mag === 3, a.mag);
    secs(g, 0.5);
    // a run
    const kb = S().keybinds, I = G.Input;
    a.mag = 4; g.reload();
    I.keys[kb.sprint] = true; I.keys[kb.forward] = true;
    secs(g, 1.4);
    I.keys[kb.sprint] = false; I.keys[kb.forward] = false;
    ok("E running during a reload: it goes on to the end", !g.wsm.rl && a.mag === 12, a.mag);
    step(g, 5);
    // a question window (the world frozen)
    a.mag = 4; g.reload(); secs(g, 0.2);
    const t0 = g.wsm.rl.t;
    G.Modal.open("r21", { freeze: true });
    secs(g, 1);
    ok("E a question open: the reload waits where it was, the gun lowered", g.wsm.rl && g.wsm.rl.t === t0 && g.wsm.state === "Lowered" && G.ViewModel.S.lowW > 0.8, g.wsm.state + " lowW " + G.ViewModel.S.lowW.toFixed(2));
    G.Modal.close("r21");
    secs(g, 1.6);
    ok("E ...closed: raised, the reload carries on to the end", !g.wsm.rl && a.mag === 12 && g.wsm.state === "Idle", g.wsm.state);
    // pause
    a.mag = 4; g.reload(); secs(g, 0.2);
    const t1 = g.wsm.rl.t;
    g.pause(); step(g, 60);
    ok("E paused: the reload waits", g.wsm.rl && g.wsm.rl.t === t1);
    g.resume(); secs(g, 1.6);
    ok("E resumed: it finishes", !g.wsm.rl && a.mag === 12);
    // death resets everything
    a.mag = 4; g.reload(); secs(g, 0.2);
    g.onGameOver();
    ok("E Game Over: Disabled, the reload gone, the gun hidden", g.wsm.state === "Disabled" && !g.wsm.rl && g.weaponViewGroup && !g.weaponViewGroup.visible);
    G.UI.showScreen(null);
  }

  // ---------------- F ----------------
  function switching() {
    const g = start();
    ["smg", "shotgun", "rifle"].forEach((id) => give(g, id));
    listen();
    const builds = [];
    const realBuild = g.buildWeaponViewModel;
    g.buildWeaponViewModel = function () { builds.push(this.currentWeaponId()); return realBuild.call(this); };
    g.switchSlot(2); step(g, 2); g.switchSlot(3); step(g, 2); g.switchSlot(4); step(g, 2); g.switchSlot(2);
    secs(g, 1.5);
    g.buildWeaponViewModel = realBuild;
    ok("F switch spam: the last one asked for is in the hands, swapped once", g.wsm.held === "smg" && G.ViewModel.def.id === "smg" && builds.join() === "smg", builds.join());
    ok("F one lowering sound and one draw for it (G.Bus switch events)", events.filter((e) => e.phase === "lower").length === 1 && events.filter((e) => e.phase === "swap").length === 1);
    pull(g);
    ok("F ready to fire after it", g.player.ammo.smg.mag < G.WEAPON_DEFS.smg.magSize);
    // the knife: the blade at its hit frame, once
    let hits = 0;
    const realMelee = g.meleeAttack;
    g.meleeAttack = function (d) { hits++; return realMelee.call(this, d); };
    g.switchSlot(0); secs(g, 1);
    G.onFirePress(); step(g, 1);
    const early = hits;
    secs(g, C().melee.hit + 0.03);
    ok("F the knife: nothing at the pull, the hit at its hit frame (" + C().melee.hit + " s), once", early === 0 && hits === 1, early + " " + hits);
    secs(g, 0.6);
    g.meleeAttack = realMelee;
  }

  // ---------------- G ----------------
  function inspectLower() {
    const g = start();
    key(S().keybinds.inspect);
    step(g, 2);
    ok("G the Inspect key (G): Inspecting", g.wsm.state === "Inspecting" && G.ViewModel.S.inspW === 1);
    secs(g, 0.6);
    const y = g.weaponViewGroup.rotation.y;
    ok("G ...the gun turned in the hands", Math.abs(y - (-0.06)) > 0.15, y.toFixed(2));
    pull(g);
    ok("G a pull ends it and fires", g.wsm.state !== "Inspecting" && g.player.ammo.pistol.mag < 12);
    secs(g, 0.5);
    g.player.ammo.pistol.mag = 12;
    G.onReloadPress(); step(g, 1);
    ok("G the reload button with a full magazine inspects (touch; the pad's X too)", g.wsm.state === "Inspecting");
    secs(g, 3);
    ok("G ...and it ends by itself", g.wsm.state === "Idle", g.wsm.state);
    g.wsm.setLowered("use", true, C().lowerUse);
    secs(g, 0.25);
    ok("G Use: lowered a moment", g.wsm.state === "Lowered" && G.ViewModel.S.lowW > 0.6);
    secs(g, 0.6);
    ok("G ...and up again", g.wsm.state === "Idle" && G.ViewModel.S.lowW < 0.2, g.wsm.state + " " + G.ViewModel.S.lowW.toFixed(2));
    // a cutscene: put away, then shown again
    const cu = G.Cutscene.update;
    G.Cutscene.update = function () {};
    G.Cutscene.active = true;
    step(g, 2);
    const hidden = g.wsm.state === "Disabled" && !g.weaponViewGroup.visible && !G.PlayerBody.armRig.group.visible;
    G.Cutscene.active = false; G.Cutscene.update = cu;
    secs(g, 0.6);
    ok("G a boss's cutscene: the gun put away (Disabled), then raised again", hidden && g.wsm.state === "Idle" && g.weaponViewGroup.visible && G.PlayerBody.armRig.group.visible);
  }

  // ---------------- H ----------------
  function settings() {
    const d = G.defaultSave().settings;
    ok("H new settings: Auto Reload on, Camera Recoil and Camera Shake 100%, Inspect on G", d.autoReload === true && d.cameraRecoil === 1 && d.cameraShake === 1 && d.keybinds.inspect === "KeyG");
    const old = G.normalizeSave({ unlockedLevels: [1], settings: { keybinds: { forward: "KeyW" } } });
    ok("H an older save gets them too", old.settings.autoReload === true && old.settings.cameraRecoil === 1 && old.settings.keybinds.inspect === "KeyG");
    const taken = G.normalizeSave({ unlockedLevels: [1], settings: { keybinds: { reload: "KeyG" } } });
    ok("H ...but not G if that save already uses it", taken.settings.keybinds.inspect === "");
    const g = start();
    S().autoReload = false;
    g.player.ammo.pistol.mag = 0;
    pull(g);
    ok("H Auto Reload off: an empty pull clicks, no reload", !g.wsm.rl);
    S().autoReload = true;
    g.player.ammo.pistol.mag = 12;
    secs(g, 0.5);
    S().cameraRecoil = 0;
    const p0 = g.pitchObject.rotation.x;
    pull(g);
    ok("H Camera Recoil 0: the view does not kick (the gun still does)", Math.abs(g.pitchObject.rotation.x - p0) < 1e-6 && g.weaponAnim.recoilRot > 0);
    S().cameraRecoil = 1;
    secs(g, 0.5);
    const p1 = g.pitchObject.rotation.x;
    pull(g);
    ok("H Camera Recoil 100%: it does", g.pitchObject.rotation.x > p1);
    S().cameraShake = 0;
    secs(g, 1);
    secs(g, 0.5);
    g.player.hp -= 20000; step(g, 1);
    ok("H Camera Shake 0: no flinch from a hit", Math.abs(G.ViewModel.S.flinchZ.v) < 1e-3, G.ViewModel.S.flinchZ.v);
    S().cameraShake = 1;
    g.player.hp -= 20000; step(g, 1);
    ok("H Camera Shake 100%: a hit makes the gun flinch", Math.abs(G.ViewModel.S.flinchZ.v) > 0.01);
    // the Settings page
    G.SettingsUI.cat = "accessibility";
    G.UI.showScreen("screen-settings"); G.SettingsUI.render();
    const $ = (id) => document.getElementById(id);
    ok("H Settings: Auto Reload (gameplay), Camera Recoil and Camera Shake sliders (accessibility), Inspect in the keys",
      !!$("set-autoreload") && $("set-autoreload").closest("#set-sec-gameplay") && $("set-camrecoil").type === "range" && $("set-camshake").closest("#set-sec-accessibility")
      && !!document.querySelector('.keybind-btn[data-action="inspect"]'));
    $("set-camrecoil").value = "0.4"; $("set-camrecoil").dispatchEvent(new Event("input"));
    ok("H ...a slider applies at once", Math.abs(S().cameraRecoil - 0.4) < 1e-6 && $("set-camrecoil-v").textContent === "40%");
    S().cameraRecoil = 1;
    G.UI.showScreen(null);
  }

  // ---------------- I ----------------
  function screens() {
    const g = start();
    const cam = g.camera, v = new THREE.Vector3(), out = {};
    const asp0 = cam.aspect;
    [["16:9", 16 / 9], ["4:3", 4 / 3], ["19.5:9", 19.5 / 9], ["21:9", 21 / 9]].forEach(([name, asp]) => {
      cam.aspect = asp; cam.updateProjectionMatrix();
      secs(g, 0.6);
      cam.updateMatrixWorld(true);
      // the grip (where the hand is) and the muzzle, on the screen
      const grip = g.weaponViewGroup.userData.anchors.grip.clone().applyMatrix4(g.weaponViewGroup.matrixWorld).project(cam);
      const muz = (g.weaponViewGroup.userData.anchors.muzzle || g.weaponViewGroup.userData.anchors.fore).clone().applyMatrix4(g.weaponViewGroup.matrixWorld).project(cam);
      out[name] = { gx: +grip.x.toFixed(2), gy: +grip.y.toFixed(2), mx: +muz.x.toFixed(2), my: +muz.y.toFixed(2) };
    });
    cam.aspect = asp0; cam.updateProjectionMatrix();
    const all = Object.values(out);
    ok("I at 16:9, 4:3, 19.5:9 and 21:9 the gun is right of centre and low, clear of the crosshair",
      all.every((p) => p.gx > 0.15 && p.gx < 0.95 && p.gy < -0.15 && Math.hypot(p.mx, p.my) > 0.12), JSON.stringify(out));
    ok("I ...and in much the same place on each (moved in on 4:3, out on 21:9)", Math.max(...all.map((p) => p.gx)) - Math.min(...all.map((p) => p.gx)) < 0.2, JSON.stringify(out));
  }

  // ---------------- J ----------------
  async function devtools() {
    ok("J the debug overlay and the lab are not loaded in ordinary play", !G.Debug && !G.WeaponLab && !document.querySelector('script[src*="js/debug.js"], script[src*="lab/weapons.js"]'));
    const r = await fetch("/js/lab/weapons.js", { cache: "no-store" });
    ok("J ...but they are there to be fetched (?debug=1, ?lab=weapons)", r.ok && (await fetch("/js/debug.js", { cache: "no-store" })).ok);
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/tools/overhaul/wsm-test.js?v=" + Date.now(); s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const u = G.WsmTest.run();
    ok("J the machine's unit and fuzz tests pass in the page (" + u.pass + "/" + u.total + ")", u.fail.length === 0, u.fail.map((f) => f.name + " -- " + f.info).slice(0, 3).join(" | "));
    const g = start();
    g.player.ammo.pistol.mag = 4; g.reload();
    g.wsm.rl.endAt = 1e9;
    const lim = g.wsm.rl.plan.dur * C().watchdog.reloadScale + C().watchdog.reloadPad;
    secs(g, lim + 0.3);
    ok("J the watchdog: a reload that would never end is put right (the rounds that seated stay)", !g.wsm.rl && g.player.ammo.pistol.mag === 12 && g.wsm.warnings.some((w) => /watchdog/.test(w.text)));
  }

  async function run() {
    results.length = 0; hudBad.length = 0;
    const errs = [];
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    const onErr = (e) => errs.push(String(e.message));
    window.addEventListener("error", onErr);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    realSpawn = G.Spawner.update;
    G.Spawner.update = function () {};
    try {
      basics();
      firing();
      sprint();
      reloads();
      cancels();
      switching();
      inspectLower();
      settings();
      screens();
      await devtools();
      ok("every frame of every part: the HUD's ammo was the game's", !hudBad.length, hudBad.slice(0, 3).join(" | "));
    } catch (e) {
      ok("ran to the end", false, String(e && e.stack || e).slice(0, 400));
    } finally {
      console.error = oe;
      window.removeEventListener("error", onErr);
      G.Bus.off("r21");
      G.Input.requestPointerLock = realLock;
      G.Spawner.update = realSpawn;
      G.Input.clearHeldInputs();
      G.Modal.reset();
      if (realUpd) G.Game.update = realUpd;
      G.Game.timeScale = 1;
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no uncaught errors", !errs.length, errs.slice(0, 2).join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
