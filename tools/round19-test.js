// Dev-only (not shipped). Visual series (Cinematic Dark Fantasy), round 2:
// the light hierarchy, rim light, light in the air, bloom, light spill --
// js/lightfx.js, js/post.js, js/visuals.js, js/visual-config.js.
//   F  four tiers of light; a tier's head start in the fixed pool of dynamic
//      lights; the hero lights (the front doors at the start, the stairs up,
//      the keycard, the field's floodlights at the boss); warm kept rare
//   G  rim light: the buildings (out of doors), the important things
//      (breathing), the doors (faint), the boss (strong); per vertex too
//   H  the light in the air (Medium and up): soft twins of the moonbeams, the
//      lamp cones, fog sheets; god rays (High up); raymarched fog (Very High)
//   I  bloom from Medium up, half resolution on Medium; only what is pushed
//      over 1.0 glows
//   J  light spill baked at load; pools of light on the floors; SSAO (High up);
//      never more or fewer dynamic lights while playing
//   K  the frame darkened at the edges where something is right in front
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round19Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round19Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const S = () => G.save.settings;
  const V = () => G.VISUAL;
  const QS = ["vlow", "low", "medium", "high", "vhigh"];
  const L = () => G.LightFX;

  async function start(q) {
    const g = G.Game;
    const real = g._upd || g.update;
    G.save.tutorialDone = true;
    S().graphicsQuality = q;
    g.update = real;
    g.startLevel(1);
    g.update = function () {};
    g._r19 = real;
    g.requiredKills = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    await wait(30);
    return g;
  }
  // a few frames of the game at a place (the real update: the pool, the heroes)
  function step(g, n, at, yaw) {
    for (let i = 0; i < (n || 1); i++) {
      if (at) { g.yawObject.position.copy(at); if (yaw != null) g.yawObject.rotation.y = yaw; }
      g._r19.call(g, 1 / 30);
    }
  }
  const anchor = (key) => (G.Perf.anchors || []).find((a) => a.key === key);
  const inPool = (a) => !!a && G.Perf.pool.some((l) => l.position.distanceTo(a.pos) < 0.01 && l.intensity > 0);

  // ---------------- F: the tiers, in the configuration ----------------
  function config() {
    const T = V().tiers;
    ok("F1 four tiers in js/visual-config.js, each with its glow and its head start in the pool",
      T.ambient && T.environmental && T.important && T.hero && T.hero.priority > T.important.priority && T.important.priority > T.environmental.priority && T.hero.glow > T.important.glow && T.important.glow >= T.environmental.glow,
      "priority " + [T.environmental.priority, T.important.priority, T.hero.priority].join("/") + ", glow " + [T.environmental.glow, T.important.glow, T.hero.glow].join("/"));
    const cool = (c) => { const k = new THREE.Color(c); return k.b >= k.r; };
    ok("F2 the rooms' lights are cool (warm kept for the few places that need it)", V().lighting.roomLight.every(cool) && G.THEME_PALETTES.school.roomLight.every(cool));
    ok("M round 2's effects in the table for each graphics level",
      QS.every((q) => { const Q = V().quality[q]; return Q.bloom != null && Q.air != null && Q.fogSheets != null && Q.godRays != null && Q.ssao != null && Q.raymarch != null; })
      && V().quality.vlow.bloom === "off" && V().quality.low.air === false && V().quality.medium.bloom === "half" && V().quality.medium.air && !V().quality.medium.godRays
      && V().quality.high.godRays && V().quality.high.ssao === 0.5 && V().quality.vhigh.ssao === 1 && V().quality.vhigh.raymarch && !V().quality.high.raymarch,
      QS.map((q) => q + ":" + V().quality[q].bloom + "/" + (V().quality[q].air ? "air" : "-") + "/" + V().quality[q].fogSheets).join(" "));
    ok("I the bloom's threshold is over paper white (only what is pushed over 1.0 glows)", V().bloom.threshold > 1.2, V().bloom.threshold);
  }

  // ---------------- a school level on Medium: F, G, H, I, J ----------------
  async function medium() {
    const g = await start("medium");
    const W = g.world, LF = L();
    // F: what is in which tier
    const tiers = new Set(LF.registry.map((r) => r.tier.split(" ")[0]));
    ok("F1 every tier has its things (the round's report lists them)", ["ambient", "environmental", "important", "hero"].every((t) => tiers.has(t)), LF.registry.length + " entries");
    ok("F1 the hero lights: the front doors, the field's floodlights, the stairs up, the keycard", ["entrance", "flood", "gate2", "gate3", "keycard"].every((k) => LF.heroes[k]), Object.keys(LF.heroes).join(","));
    // the floodlights: four towers, out of the arena
    const p = W.pitch, A = G.Arena.plan(g), r = A.rect;
    const towers = LF.heroes.flood.lights.map((l) => l.position);
    ok("F1 four floodlight towers round the field, each outside the arena's fence",
      towers.length === 4 && towers.every((t) => t.x < r.minX - 0.5 || t.x > r.maxX + 0.5 || t.z < r.minZ - 0.5 || t.z > r.maxZ + 0.5),
      towers.map((t) => t.x.toFixed(1) + "," + t.z.toFixed(1)).join(" "));
    // F3: the warm accents
    const lamps = (G.Perf.anchors || []).filter((a) => a.src && a.src.userData.lampKind === "library");
    const lib = Object.keys(W.roomInfo).find((k) => W.roomInfo[k].type === "library"), libReg = W.regions.find((x) => x.name === lib);
    const inLib = lamps.filter((a) => libReg && a.pos.x > libReg.minX && a.pos.x < libReg.maxX && a.pos.z > libReg.minZ && a.pos.z < libReg.maxZ);
    ok("F3 warm reading lamps on the library's tables", inLib.length >= 2 && inLib.every((a) => a.color.r > a.color.b), inLib.length + " in the library, " + lamps.length + " in all");
    const em = (G.Perf.anchors || []).filter((a) => a.src && a.src.userData.lampKind === "emergency");
    ok("F3 red emergency lights in some of the dead rooms (not all)", em.length >= 1 && em.every((a) => a.color.r > a.color.g * 2), em.length + " of " + (W.fixtures || []).filter((f) => f.mode === "off").length + " dead rooms");
    const corr = (W.fixtures || []).filter((f) => f.light && /^C\d/.test(f.key));
    ok("F3 the corridors darker: pools of light, then dark", corr.length > 0 && corr.every((f) => Math.abs(f.light.distance - V().lighting.corridor.distance) < 1e-6), corr.length + " corridor lights");
    const warmWins = (W.innerWindows || []).filter((w) => w.behind && w.behind.material && w.behind.material.userData.vzGlow === "warmWindow");
    ok("F2 a few windows lit warm from inside (the library's, the head's office)", warmWins.length >= 1 && warmWins.length <= 12, warmWins.length);
    // F2: warm stays rare among the lights
    const st = (G.Perf.anchors || []).filter((a) => !a.key && a.base > 0);
    const warm = st.filter((a) => a.color.r > a.color.b * 1.35);
    ok("F2 warm is rare: most of the lights are cool", warm.length / Math.max(1, st.length) < 0.35, warm.length + " warm of " + st.length);

    // F1: the front doors' light, from the start; the pool picks it first
    const ent = anchor("entrance");
    step(g, 6, new THREE.Vector3(0, 1.7, 53), 0);
    ok("F1 at the start the front doors are lit (the hero light, in the pool)", ent && ent.base >= V().hero.entrance.intensity * 0.95 && inPool(ent), ent && ent.base.toFixed(2));
    // a head start: from inside the entry hall, nearer lights than the pool holds, and still it
    const fwd = new THREE.Vector3(0, 1.7, 21);
    const nearer = (G.Perf.anchors || []).filter((a) => a !== ent && a.base > 0 && a.pos.distanceTo(fwd) < ent.pos.distanceTo(fwd)).length;
    step(g, 3, fwd, Math.PI);
    ok("F1 a hero light wins over nearer lights of a lower tier", nearer >= G.Perf.pool.length ? inPool(ent) : true, nearer + " nearer lights, pool of " + G.Perf.pool.length);
    // ...and once the player has gone in, it is an ordinary lamp again
    G.Sky.indoors = true; step(g, 1, fwd); G.Sky.indoors = false;
    step(g, 90, new THREE.Vector3(0, 1.7, 53), 0);
    ok("F1 once the player has gone in, the doors' light dims to an ordinary lamp", ent.base < V().hero.entrance.intensity * 0.6 && ent.priority === 0, ent.base.toFixed(2));
    // the floodlights: off, until the boss comes onto the field
    const fl = LF.heroes.flood.lights.map((l) => (G.Perf.anchors || [])[LF.idxOf(l)]);
    step(g, 3, new THREE.Vector3(-44, 1.7, -20), 0);
    ok("F1 the floodlights are dead -- and an off light never takes a slot in the pool", fl.every((a) => a.base === 0 && !inPool(a)));
    G.Bosses.arena = A; G.Bosses.phase = "fight";
    step(g, Math.ceil(V().hero.floodlights.warmUp * 30) + 30, new THREE.Vector3(-44, 1.7, -20), 0);
    const onCount = fl.filter((a) => a.base > V().hero.floodlights.intensity * 0.9).length;
    ok("F1 the boss on the field: the floodlights stutter on and stay on (and take the pool)", onCount === 4 && fl.some(inPool), onCount + " on");
    G.Bosses.phase = null; G.Bosses.arena = null;
    step(g, 60, new THREE.Vector3(-44, 1.7, -20), 0);
    ok("F1 ...and go out again after it", fl.every((a) => a.base < 0.05));
    // the stairs: floor 2's shutter once it rolls up, until the player is upstairs
    const g2 = anchor("gate2"), sf = W.secondFloor;
    sf.unlocked = true;
    step(g, 45, new THREE.Vector3(0, 1.7, 21), Math.PI);
    ok("F1 the shutter to floor 2 lights up once it has rolled up", g2.base > V().hero.gate.intensity * 0.8, g2.base.toFixed(2));
    step(g, 90, new THREE.Vector3(0, 1.7 + sf.floorY, 21), Math.PI);
    ok("F1 ...and goes back to dark when the player is upstairs", g2.base < 0.1, g2.base.toFixed(2));
    // floor 3: the keycard while it lies there, then the grille
    const kc = anchor("keycard"), g3 = anchor("gate3");
    if (G.Floor3 && G.Floor3.applies(g)) {
      const s3 = G.Floor3.s;
      s3.taken = false;
      G.Floor3.spawnKeycard(g, new THREE.Vector3(-5, 4.2, 4), true);
      step(g, 45, new THREE.Vector3(0, 1.7 + 4.2, 12), Math.PI);
      ok("F1 floor 3's keycard: a hero light over it while it lies there", kc.base > V().hero.keycard.intensity * 0.8 && kc.pos.distanceTo(G.Floor3.mesh.position) < 2, kc.base.toFixed(2));
      s3.taken = true; G.Floor3.mesh.visible = false;
      step(g, 45, new THREE.Vector3(0, 1.7 + 4.2, 12), Math.PI);
      ok("F1 ...gone once it is picked up; the grille to floor 3 lights up instead", kc.base < 0.1 && g3.base > V().hero.gate.intensity * 0.8, kc.base.toFixed(2) + " / " + g3.base.toFixed(2));
    } else ok("F1 floor 3's keycard and grille (this level has none)", true);

    // G: rims
    const sw = G.Visuals.swaps[0];
    ok("G the buildings' faint rim, out of doors only (the baked level, both materials)", sw && sw.standard.userData.vzRim && sw.standard.userData.vzRim.outdoor && sw.lambert.userData.vzRim && sw.lambert.userData.vzRim.outdoor);
    const mb = W.mysteryBox && W.mysteryBox.mesh.material, plaque = (W.interactables.find((i) => i.kind === "wallweapon") || {}).mesh;
    ok("G the important things: a warm rim that breathes (the mystery box, the wall guns)",
      mb && mb.userData.vzRim && mb.userData.vzRim.pulse && plaque && plaque.material.userData.vzRim && plaque.material.userData.vzRim.pulse);
    const door = (W.interactables.find((i) => i.kind === "roomdoor") || {}).mesh;
    let doorRim = null; door && door.traverse((o) => { if (!doorRim && o.isMesh && o.material && o.material.userData && o.material.userData.vzRim) doorRim = o.material.userData.vzRim; });
    ok("G the doors: a faint cool rim, no breathing (there are many)", doorRim && !doorRim.pulse && doorRim.color.b >= doorRim.color.r);
    const bm = G.Visuals.bossMaterial();
    ok("G the boss: a stronger rim than a zombie's", bm.userData.vzRim.color.r + bm.userData.vzRim.color.g + bm.userData.vzRim.color.b > G.ZOMBIE_MATS.lambert.userData.vzRim.color.r + G.ZOMBIE_MATS.lambert.userData.vzRim.color.g + G.ZOMBIE_MATS.lambert.userData.vzRim.color.b);
    const lam = new THREE.MeshLambertMaterial(); lam.userData.vzRim = { color: new THREE.Color(0.2, 0.2, 0.2), power: 2, pulse: true };
    const sh = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader, uniforms: {} };
    G.Visuals.inject(sh, lam);
    ok("G a per-vertex material takes the rim per vertex (Very Low and Low, the props)", sh.vertexShader.includes("vVzRim") && sh.fragmentShader.includes("vVzRim * vzPulse"));
    const cl = mb.clone();
    ok("G a cloned material keeps its rim (three.js turns the colour into a number)", /\|r[0-9a-f]{6}/.test(cl.customProgramCacheKey()));

    // H: the light in the air
    g.yawObject.position.set(0, 1.7, 53); g.renderFrame();
    const rt = G.Visuals._rt;
    ok("H the scene's depth as a texture (Medium and up)", !!rt.depthTexture && rt.depthTexture.type === THREE.UnsignedIntType);
    // (the keycard's column is hidden by its material: the soft twin hangs on it)
    const pairs = LF.air.filter((a) => a.plain && !a.keycard);
    ok("H the moonbeams' soft twins in the air picture, the plain ones hidden", pairs.length >= 3 && pairs.every((a) => !a.plain.visible && a.soft.layers.mask === 1 << G.Post.AIR_LAYER), pairs.length + " beams, " + LF.air.length + " in the air");
    ok("H the air picture is half the screen", G.Post.out.air && G.Post.rts.air.width === Math.round(rt.width * V().air.resolution));
    ok("H a shaft fades where it meets the scene (its depth compared with the scene's)", G.Post.AIR_GLSL.includes("vzSoftK") && G.Post.AIR_GLSL.includes("tDepth"));
    ok("H fog sheets on Medium, low over the grounds, out of doors only", LF.sheets && LF.sheets.mesh.count === V().quality.medium.fogSheets && LF.sheets.mesh.material.fragmentShader.includes("vzOutAt"), LF.sheets && LF.sheets.mesh.count);
    ok("H no rays from the moon on Medium (High up)", G.Post.out.god === null);
    // I: bloom
    ok("I bloom on Medium, at half the resolution", !!G.Post.out.bloom && G.Post.rts.b0.width === Math.round(rt.width / 2));
    const glowing = []; g.scene.traverse((o) => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && m.userData && m.userData.vzGlowBase != null && Math.max(m.color.r, m.color.g, m.color.b) > 1) glowing.push(m.userData.vzGlow); });
    ok("I what glows is over 1.0 in the HDR picture: tubes, signs, lamps, the important things", ["tube", "sign"].every((k) => glowing.includes(k)), [...new Set(glowing)].join(","));
    ok("I the moon's disc glows", G.Sky.moon.material.color.r > 1);
    // J: spill, pools
    const stats = LF.spillStats;
    const withSpill = []; g.scene.traverse((o) => { if (o.isMesh && o.userData.mergedParts && o.geometry.attributes.vzSpill) withSpill.push(o); });
    ok("J the lamps' light spilt onto walls and floors at load (baked, per vertex)", stats && stats.sources > 20 && stats.lit > 1000 && withSpill.length > 20 && withSpill[0].geometry.attributes.vzSpill.normalized,
      stats && (stats.sources + " lamps, " + withSpill.length + " meshes, " + stats.ms + " ms"));
    ok("J ...only round the lamps (most of the level is untouched)", stats.lit / (stats.verts * 3) < 0.3, (100 * stats.lit / (stats.verts * 3)).toFixed(1) + "% of the vertex colours");
    ok("J a pool of light on the floor under each lit tube, in one mesh", LF.decals && LF.decals.geometry.index.count / 6 >= (W.fixtures || []).filter((f) => f.light && f.mode !== "off").length, LF.decals && LF.decals.geometry.index.count / 6);
    const t0 = LF._anchorData.slice(0);
    step(g, 20, new THREE.Vector3(0, 1.7, 0), 0);
    ok("J the pools follow their lamps' flicker (the pool's intensities, a texel each)", LF._anchorData.some((v, i) => v !== t0[i]));
    const lights = []; g.scene.traverse((o) => { if (o.isPointLight) lights.push(o); });
    ok("J a fixed number of dynamic lights: the pool and the muzzle flash, whatever the heroes do", lights.length === V().quality.medium.lights + 1, lights.length);
    ok("K the edges framed where something is right in front (Medium and up)", G.Visuals.compMat.uniforms.uFrame.value.w === 1 && G.Visuals.compMat.defines.VZ_DEPTH);
    // E2: a zombie kept clear of the haze -- its pixels marked in the HDR
    // picture's alpha (0.5), a cut-out leaf's never (1.0), a see-through
    // thing's left alone (its alpha is what it is blended by)
    const mark = (m) => { const s = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader, uniforms: {} }; G.Visuals.inject(s, m); return s.fragmentShader; };
    const zm = new THREE.MeshLambertMaterial(); zm.userData.vzMark = true;
    const zt = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.5 }); zt.userData.vzMark = true;
    const leaf = new THREE.MeshLambertMaterial({ alphaTest: 0.5 });
    ok("E2 the zombies and the bosses mark their pixels (the shared materials, the boss's)",
      G.ZOMBIE_MATS.lambert.userData.vzMark && G.ZOMBIE_MATS.basic.userData.vzMark && G.ZOMBIE_MATS_BOSS.userData.vzMark && bm.userData.vzMark);
    ok("E2 ...in the alpha: 0.5 for a zombie, whole for a cut-out leaf, a see-through one untouched",
      mark(zm).includes("vec4( outgoingLight, 0.5 )") && mark(leaf).includes("vec4( outgoingLight, 1.0 )") && mark(zt).includes("vec4( outgoingLight, diffuseColor.a )")
      && zm.customProgramCacheKey() !== new THREE.MeshLambertMaterial().customProgramCacheKey() && zt.customProgramCacheKey() !== zm.customProgramCacheKey());
    ok("E2 the composite keeps the haze, the SSAO and the rays off them (strength in js/visual-config.js)",
      G.Visuals.compMat.fragmentShader.includes("uZom") && G.Visuals.compMat.uniforms.uZom.value === V().zombies.clearOfAir && V().zombies.clearOfAir > 0, V().zombies.clearOfAir);
  }

  // ---------------- the other graphics levels ----------------
  async function levels() {
    const g = G.Game;
    const at = {};
    for (const q of ["low", "high", "vhigh"]) {
      S().graphicsQuality = q;
      g.applyGraphicsQuality();
      // facing the moon, out of doors
      const md = G.Sky.MOON_DIR;
      g.yawObject.position.set(0, 1.7, 53); g.yawObject.rotation.y = Math.atan2(-md.x, -md.z); g.pitchObject.rotation.x = 0.35;
      g.scene.updateMatrixWorld(true);
      g.renderFrame(); g.renderFrame();
      const o = G.Post.out, rt = G.Visuals._rt;
      // (the plain beams as js/sky.js shows them at this level: the window beams
      // from Low up, the shafts over the grounds by their own minQ)
      const sq = G.Sky.q;
      at[q] = { depth: !!rt.depthTexture, bloom: !!o.bloom, air: !!o.air, god: !!o.god, ao: !!o.ao, fogv: !!o.fogv,
        plainBeams: L().air.filter((a) => a.plain && !a.keycard).every((a) => a.plain.visible === (a.plain.userData.minQ != null ? sq >= a.plain.userData.minQ : sq >= 1) && !a.soft.visible),
        sheets: L().sheets ? L().sheets.mesh.count : 0,
        b0: G.Post.rts.b0 ? G.Post.rts.b0.width / rt.width : 0, ao0: G.Post.rts.ao1 ? G.Post.rts.ao1.width / rt.width : 0 };
    }
    g.pitchObject.rotation.x = 0;
    ok("H, I Low: none of it -- no depth texture, no bloom, the plain moonbeams, no fog sheets", !at.low.depth && !at.low.bloom && !at.low.air && at.low.plainBeams && at.low.sheets === 0, JSON.stringify(at.low));
    ok("H High: rays from the moon (facing it); SSAO at half the resolution; bloom at full", at.high.god && at.high.ao && Math.abs(at.high.ao0 - 0.5) < 0.01 && Math.abs(at.high.b0 - 1) < 0.01 && !at.high.fogv, JSON.stringify(at.high));
    ok("H Very High: the raymarched fog too; SSAO at full resolution", at.vhigh.fogv && at.vhigh.god && Math.abs(at.vhigh.ao0 - 1) < 0.01 && at.vhigh.sheets === V().quality.vhigh.fogSheets, JSON.stringify(at.vhigh));
    S().graphicsQuality = "medium"; g.applyGraphicsQuality();
  }

  async function run() {
    results.length = 0;
    const errs = [];
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    let lost = false;
    const onLost = () => { lost = true; };
    G.Game.renderer.domElement.addEventListener("webglcontextlost", onLost);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    try {
      config();
      await medium();
      await levels();
    } catch (e) {
      ok("ran to the end", false, String(e && e.stack || e).slice(0, 400));
    } finally {
      console.error = oe;
      G.Game.renderer.domElement.removeEventListener("webglcontextlost", onLost);
      G.Input.requestPointerLock = realLock;
      if (G.Bosses) { G.Bosses.phase = null; G.Bosses.arena = null; }
      G.Modal.reset();
      if (G.Game._r19) { G.Game.update = G.Game._r19; }
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no shader errors, no lost WebGL context, no uncaught errors", !errs.length && !lost, errs.slice(0, 2).join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
