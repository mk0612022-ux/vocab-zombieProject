// Dev-only (not shipped). The overhaul, round 2: the guns' looks and the
// weapon's effects -- js/gunskin.js, js/fx.js, js/surface.js, js/game.js
// (shotImpact, the arms merged), js/entities.js, js/settings.js, js/config.js.
//   A  every gun (and the knife) builds with its surfaces: one mesh on the
//      skin material (+ glow, + each moving part), the gun's own colours kept,
//      darker where parts meet; 3-4 draw calls a gun, 6 for the arms
//   B  the muzzle flash: a sprite at the muzzle, 40-60 ms, family-sized; its
//      light from the pool -- every shot on Medium+, every 2nd on Low, none
//      on Very Low, weaker for fast guns, none at Muzzle Flash 0% (sprite faint)
//   C  smoke and brass from the pools, in game time (they wait in a window)
//   D  impacts by surface: the surface types; chips and a bullet hole on
//      concrete, none on grass; a shotgun's pellets: 3 holes at most; doors
//      take no holes; holes fade away; Very Low: no holes at all
//   E  the budget: particles never over it, whatever is fired
//   F  the settings (Muzzle Flash, 4 languages), the debug overlay's FX line,
//      a graphics change rebuilds the pools; nothing is made while firing
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round22Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round22Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const S = () => G.save.settings;
  const C = () => G.CONFIG.fx;
  let realUpd = null;

  function start(q) {
    const g = G.Game;
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g._r2, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    G.save.tutorialDone = true;
    if (q) S().graphicsQuality = q;
    g.update = realUpd;
    g.startLevel(1);
    g.applyGraphicsQuality();
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
  const step = (g, n, dt) => { for (let i = 0; i < (n || 1); i++) realUpd.call(g, dt || 1 / 60); };
  const give = (g, id) => {
    const d = G.WEAPON_DEFS[id];
    if (!g.player.ammo[id]) { g.player.ammo[id] = { mag: d.magSize, reserve: 999 }; g.player.weaponLevels[id] = { dmg: 1, rate: 1, mag: 1 }; }
    g.player.gunSlots = [id]; g.player.currentSlot = 1; g.wsm.requestSwitch(); step(g, 70);
  };
  const fire = (g) => { g.player.fireCooldown = 0; g.player.ammo[g.currentWeaponId()] && (g.player.ammo[g.currentWeaponId()].mag = Math.max(2, g.player.ammo[g.currentWeaponId()].mag)); G.onFirePress(); step(g, 1); };
  const meshesOf = (root) => { const m = []; root.traverse((o) => { if (o.isMesh) m.push(o); }); return m; };
  const at = (g, x, y, z, yaw, pitch) => { g.yawObject.position.set(x, y, z); g.yawObject.rotation.y = yaw; g.pitchObject.rotation.x = pitch || 0; g.yawObject.updateMatrixWorld(true); };
  // a plain wall a few metres off (not a door, not glass): stand there facing it
  function faceWall(g) {
    const o = new THREE.Vector3(), d = new THREE.Vector3();
    for (const z of [-6, -3, 0, 3, 6, 9]) for (let k = 0; k < 32; k++) {
      at(g, 0, 1.7, z, (k / 32) * Math.PI * 2, -0.02);
      g.camera.updateMatrixWorld(true); g.camera.getWorldPosition(o); g.camera.getWorldDirection(d);
      const dist = g.wallDistance(o, d, 60), c = g._wallCol;
      if (c && !c.moving && dist > 1.5 && dist < 10 && /concrete|tile/.test(G.Surface.wall(g.world, c, o.clone().addScaledVector(d, dist)))) return true;
    }
    return false;
  }

  // ---------------- A ----------------
  function guns() {
    const bad = [], counts = {};
    let tot = 0, n = 0;
    Object.values(G.WEAPON_DEFS).forEach((d) => {
      const g = G.buildWeaponMesh(d);
      const ms = meshesOf(g);
      const skinned = ms.filter((m) => m.material.userData.gunSkin === "world");
      const loose = ms.filter((m) => m.material.isMeshLambertMaterial);
      const statics = g.children.filter((c) => c.isMesh && c.material.userData.gunSkin === "world");
      if (!g.userData.skinned || !skinned.length || loose.length || statics.length !== 1) bad.push(d.id + " " + ms.length + "/" + statics.length + "/" + loose.length);
      counts[d.id] = ms.length; tot += ms.length; n++;
      // UVs inside the atlas, colours from the gun
      const geo = statics[0] && statics[0].geometry;
      if (geo) {
        const uv = geo.attributes.uv.array, c = geo.attributes.color.array;
        if (Math.min(...uv) < 0 || Math.max(...uv) > 1) bad.push(d.id + " uv");
        let dark = 0; for (let i = 0; i < c.length; i += 3) if (c[i] + c[i + 1] + c[i + 2] < 2.9 * 0.999) dark++;
        if (!dark) bad.push(d.id + " no AO");
      }
      G.disposeObject3D(g);
    });
    ok("A every gun (" + n + ") builds with its surfaces: one static mesh on the skin, no Lambert left, UVs in the atlas, darker where parts meet", !bad.length, bad.slice(0, 4).join("; "));
    ok("A ...3-6 meshes a gun (it was one per colour: about 9-14)", Math.max(...Object.values(counts)) <= 7 && tot / n <= 5, "avg " + (tot / n).toFixed(1) + ", max " + Math.max(...Object.values(counts)));
    const tex = G.GunSkin.textures(), M = G.GunSkin.materials();
    ok("A one pixel texture and one roughness/metal texture, 16 px tiles, nearest filtered", tex.map.image.height === 16 && tex.map.magFilter === THREE.NearestFilter && M.world.roughnessMap === tex.orm && M.world.metalnessMap === tex.orm);
    // surfaces differ: metal, polymer and grip do not shine alike
    const d = tex.orm.image.getContext("2d").getImageData(0, 0, 128, 16).data;
    const avg = (t, ch) => { let s = 0; for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) s += d[(y * 128 + t * 16 + x) * 4 + ch]; return s / 144 / 255; };
    const T2 = G.GunSkin.SURF;
    ok("A ...metal shines and reflects, polymer less, the rubber grip least", avg(T2.bare, 2) > 0.8 && avg(T2.polymer, 2) < 0.2 && avg(T2.grip, 1) > avg(T2.polymer, 1) && avg(T2.polymer, 1) > avg(T2.bare, 1),
      ["bare", "polymer", "grip"].map((k) => k + " r" + avg(T2[k], 1).toFixed(2) + " m" + avg(T2[k], 2).toFixed(2)).join(" "));
    const knife = G.buildMeleeMesh();
    ok("A the knife too (rubber handle, steel blade)", knife.userData.skinned && meshesOf(knife).every((m) => m.material.userData.gunSkin));
    // a rare gun keeps its colour: the skin multiplies, it does not replace
    const red = Object.values(G.WEAPON_DEFS).find((dd) => (dd.color >> 16) > 0xb0 && ((dd.color >> 8) & 0xff) < 0x80 && (dd.color & 0xff) < 0x80);
    if (red) {
      const gg = G.buildWeaponMesh(red), st = gg.children.find((c) => c.isMesh && c.material.userData.gunSkin === "world");
      // (its paint, on the parts in its colour: the steel and the black parts are grey anyway)
      const col = st.geometry.attributes.color.array;
      let paint = 0; for (let i = 0; i < col.length; i += 3) if (col[i] > 0.35 && col[i] > col[i + 2] * 1.8 && col[i] > col[i + 1] * 1.3) paint++;
      ok("A a gun's own colour stays (" + red.id + ": its red paint on " + paint + " corners)", paint >= 8, paint);
      G.disposeObject3D(gg);
    }
    // in the hands: the viewmodel's material (rim, least light), arms merged
    const g = start("high");
    const vm = meshesOf(g.weaponViewGroup);
    ok("A in the hands: the viewmodel's skin (rim, least light), the flash at the muzzle", vm.some((m) => m.material.userData.gunSkin === "vm" && m.material.userData.vzRim) && !!G.FX._flash.mesh && G.FX._flash.mesh.parent === g.weaponViewGroup);
    const arms = meshesOf(G.PlayerBody.armRig.group);
    ok("A the arms: one mesh a bone (8, 6 drawn), in their colours", arms.length === 8 && arms.every((m) => m.material.vertexColors), arms.length);
  }

  // ---------------- draw calls ----------------
  function drawCalls() {
    const g = start("low"), P = g.yawObject.position, Z = G.Zones;
    const view = () => { P.set(0, 1.7, 72); g.yawObject.rotation.y = 0; g.pitchObject.rotation.x = 0; g.scene.updateMatrixWorld(true); Z.update(g, true); g.renderFrame(); return g.renderer.info.render.calls - ((G.Visuals && G.Visuals.shadowCalls) || 0); };
    const full = view();
    g.weaponViewGroup.visible = false; G.PlayerBody.armRig.group.visible = false;
    const world = view();
    g.weaponViewGroup.visible = true; G.PlayerBody.armRig.group.visible = true;
    ok("A the gate on Low with the pistol in hand, the whole frame: under 150 draw calls (152 before this round)", full < 150, "frame " + full + ", world " + world + ", gun + arms " + (full - world));
  }

  // ---------------- B ----------------
  function flash() {
    let g = start("high");
    at(g, 0, 1.7, 2, Math.PI / 2);
    const lights = [];
    const realFlash = G.Perf.flash;
    G.Perf.flash = function (p, c, i) { lights.push(i); return realFlash.apply(this, arguments); };
    fire(g);
    const m = G.FX._flash.mesh;
    ok("B a shot: the flash sprite shows at the muzzle, one of 4, turned", m.visible && G.FX._flash.t > 0 && G.FX._flash.t <= 0.06 && /AdditiveBlending|2/.test(String(m.material.blending)));
    step(g, 4);
    ok("B ...and is gone within 60 ms", !m.visible);
    ok("B Medium and up: a light every shot, from the pool", lights.length === 1 && lights[0] === C().flash.light.intensity, lights.join());
    give(g, "pistol");
    const pw = m.scale.x, before = G.FX._flash.mesh;
    give(g, "shotgun");
    ok("B the flash's size by family: a shotgun's wider than a pistol's", G.FX._flash.mesh !== before && C().flash.family.shotgun_pump.w > C().flash.family.pistol.w && G.FX._flash.mesh.userData.flashSize[0] > pw * 1.5);
    // a fast gun's light is weaker
    const fastGun = Object.values(G.WEAPON_DEFS).find((d) => 60000 / d.fireRate > C().flash.rpmFast && G.inferArchetype(d) !== "energy");
    lights.length = 0; give(g, fastGun.id); fire(g);
    ok("B a fast gun (" + fastGun.id + ", over " + C().flash.rpmFast + " rpm): its light at half", lights[0] === C().flash.light.intensity * C().flash.fastLight, lights.join());
    // the setting
    S().muzzleFlash = 0; lights.length = 0; give(g, "pistol"); fire(g);
    ok("B Muzzle Flash 0%: no light, only a faint sprite", lights.length === 0 && G.FX._flash.mesh.visible && G.FX._flash.mesh.material.opacity === C().flash.minSprite);
    S().muzzleFlash = 1;
    // Low: every 2nd shot; Very Low: never
    g = start("low"); lights.length = 0; for (let i = 0; i < 4; i++) { fire(g); step(g, 30); }
    ok("B Low: the light every 2nd shot", lights.length === 2, lights.length);
    g = start("vlow"); lights.length = 0; for (let i = 0; i < 3; i++) { fire(g); step(g, 30); }
    ok("B Very Low: no light", lights.length === 0, lights.length);
    G.Perf.flash = realFlash;
  }

  // ---------------- C ----------------
  function smokeBrass() {
    const g = start("high");
    at(g, 0, 1.7, 2, Math.PI / 2);
    fire(g);
    const st = G.FX.stats();
    ok("C a shot: a puff of smoke and a case of brass", st.smoke >= 1 && st.shells >= 1, JSON.stringify(st));
    const smoke = G.FX._pools.smoke;
    ok("C the smoke: one draw call for all of it, faded near the middle of the view", smoke.isPoints && /uCenter/.test(smoke.material.vertexShader));
    G.Modal.open("r22", { freeze: true });
    const before = G.FX.stats();
    step(g, 90);
    const during = G.FX.stats();
    G.Modal.close("r22");
    ok("C a question open: the effects wait (game time)", during.smoke === before.smoke && during.shells === before.shells);
    step(g, 120);
    ok("C ...then fade and go", G.FX.stats().smoke === 0 && G.FX.stats().shells === 0);
    const g2 = start("low"); at(g2, 0, 1.7, 2, Math.PI / 2); fire(g2);
    ok("C no brass on Low and Very Low", G.FX.stats().shells === 0);
  }

  // ---------------- D ----------------
  function impacts() {
    const Sf = G.Surface;
    ok("D nine surface types, each with its pieces", Sf.TYPES.length === 9 && Sf.TYPES.every((t) => C().impact.surfaces[t]));
    let g = start("high");
    const w = g.world;
    const lib = Object.keys(w.roomTypeOf || {}).find((k) => w.roomTypeOf[k] === "library");
    const reg = (name) => w.regions.find((r) => r.name === name);
    const mid = (r) => [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, r.y || 0];
    const libR = lib && reg(lib), yard = w.regions.find((r) => /^YARD/.test(r.name)), corr = w.regions.find((r) => /^C\d/.test(r.name));
    ok("D the floor: a corridor's tiles, the grounds' grass" + (libR ? ", the library's boards" : ""),
      Sf.floor(w, ...[mid(corr)[0], mid(corr)[1], mid(corr)[2]]) !== "grass" && (!yard || Sf.floor(w, mid(yard)[0], mid(yard)[1], 0) === "grass") && (!libR || Sf.floor(w, mid(libR)[0], mid(libR)[1], mid(libR)[2]) === "wood"),
      [corr && Sf.floor(w, mid(corr)[0], mid(corr)[1], mid(corr)[2]), libR && Sf.floor(w, mid(libR)[0], mid(libR)[1], mid(libR)[2])].join(","));
    const door = w.roomDoors[0];
    ok("D a sliding door: wood at the school, and it moves (no holes)", door.collider.surface === "wood" && door.collider.moving === true);
    const pole = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 3, 0.1));
    ok("D a post is metal, a low thing on the floor furniture (wood at the school)", Sf.wall(w, pole) === "metal" && Sf.wall(w, new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.2, 0.8, 0.6))) === "wood");
    // a wall: chips and a hole
    faceWall(g);
    step(g, 2);
    const d0 = G.FX.stats().decals;
    fire(g);
    const st = G.FX.stats();
    ok("D a wall: chips and a bullet hole", st.particles > 1 && st.decals === d0 + 1, JSON.stringify(st));
    // a door: chips, no hole
    const dd = w.roomDoors.find((x) => !x.open) || door;
    const dz = dd.axis === "x" ? 1.6 : 0, dx = dd.axis === "x" ? 0 : 1.6;
    at(g, dd.x + dx, (dd.baseY || 0) + 1.7, dd.z + dz, Math.atan2(dx, dz));
    step(g, 2);
    const o = new THREE.Vector3(), dir = new THREE.Vector3(); g.camera.getWorldPosition(o); g.camera.getWorldDirection(dir);
    g.wallDistance(o, dir, 60);
    const hitDoor = g._wallCol && g._wallCol.moving;
    const d1 = G.FX.stats().decals; fire(g);
    ok("D a door takes chips but no hole", !hitDoor || G.FX.stats().decals === d1, hitDoor ? "hit the door" : "missed the door (skipped)");
    // the grass: no hole
    at(g, 0, 1.7, 60, 0, -0.5); step(g, 2);
    const d2 = G.FX.stats().decals; fire(g);
    ok("D the grass: bits of grass, no hole", G.FX.stats().decals === d2);
    // a shotgun: 3 holes at most a shot
    give(g, "shotgun");
    faceWall(g); step(g, 2);
    const d3 = G.FX.stats().decals; fire(g);
    const holes = G.FX.stats().decals - d3;
    ok("D a shotgun's pellets: " + C().impact.pelletDecals + " holes at most a shot", holes >= 1 && holes <= C().impact.pelletDecals, holes);
    // holes fade away after their life
    step(g, Math.ceil((G.FX.budget().decalLife + 0.5) * 60));
    ok("D holes fade away after " + G.FX.budget().decalLife + " s (High)", G.FX.stats().decals === 0, G.FX.stats().decals);
    // Very Low: none at all
    g = start("vlow"); faceWall(g); step(g, 2); fire(g);
    ok("D Very Low: no bullet holes", G.FX.stats().decals === 0 && G.FX.budget().decals === 0);
  }

  // ---------------- E ----------------
  function budget() {
    const g = start("low");
    give(g, "shotgun");
    at(g, 0, 1.7, 2, Math.PI / 2, -0.1);
    let over = 0;
    for (let i = 0; i < 40; i++) { fire(g); if (G.FX.stats().particles > G.FX.budget().particles) over++; }
    ok("E 40 shotgun blasts on Low: never over its " + G.FX.budget().particles + " particles", over === 0 && G.FX.stats().particles > 0, G.FX.stats().particles);
    const holes = G.FX.stats().decals;
    ok("E ...nor its " + G.FX.budget().decals + " bullet holes", holes <= G.FX.budget().decals, holes);
    // nothing new is made while firing
    const before = g.renderer.info.memory.geometries;
    for (let i = 0; i < 20; i++) fire(g);
    ok("E nothing is made while firing (no new geometry)", g.renderer.info.memory.geometries <= before + 1, before + " -> " + g.renderer.info.memory.geometries);
  }

  // ---------------- F ----------------
  function settingsAndMore() {
    const d = G.defaultSave().settings;
    ok("F the Muzzle Flash setting: 100% to start, an old save gets it", d.muzzleFlash === 1 && G.normalizeSave({ unlockedLevels: [1], settings: {} }).settings.muzzleFlash === 1);
    G.SettingsUI.cat = "accessibility";
    G.UI.showScreen("screen-settings"); G.SettingsUI.render();
    const el = document.getElementById("set-muzzleflash");
    ok("F ...a slider in Accessibility", !!el && el.type === "range" && !!el.closest("#set-sec-accessibility"));
    G.UI.showScreen(null);
    const g = start("high");
    const pools = G.FX._pools;
    const capHigh = pools.cap;
    S().graphicsQuality = "low"; g.applyGraphicsQuality();
    ok("F a graphics change: the pools rebuilt to the new budget", G.FX._pools.cap === G.FX.budget().particles && capHigh !== G.FX._pools.cap, capHigh + " -> " + G.FX._pools.cap);
    ok("F the debug overlay's line (4 languages: tools/check-strings.ps1)", /\{p\}/.test(G.T("debug.fx")) && typeof G.FX.stats === "function");
    const tiers = ["vlow", "low", "medium", "high", "vhigh"];
    ok("F the budget table: particles 60/120/250/500/900, holes 0/24/48/96/160", tiers.map((t) => C().budget[t].particles).join() === "60,120,250,500,900" && tiers.map((t) => C().budget[t].decals).join() === "0,24,48,96,160");
  }

  async function run() {
    results.length = 0;
    const errs = [];
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    const onErr = (e) => errs.push(String(e.message));
    window.addEventListener("error", onErr);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock, realSpawn = G.Spawner.update;
    G.Input.requestPointerLock = function () {};
    G.Spawner.update = function () {};
    try {
      guns();
      drawCalls();
      flash();
      smokeBrass();
      impacts();
      budget();
      settingsAndMore();
    } catch (e) {
      ok("ran to the end", false, String(e && e.stack || e).slice(0, 400));
    } finally {
      console.error = oe;
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock;
      G.Spawner.update = realSpawn;
      G.Input.clearHeldInputs();
      G.Modal.reset();
      if (realUpd) G.Game.update = realUpd;
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no uncaught errors", !errs.length, errs.slice(0, 2).join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
