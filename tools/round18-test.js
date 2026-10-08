// Dev-only (not shipped). Visual series (Cinematic Dark Fantasy), round 1:
// colour, light, shadow, materials, fog and readability --
// js/visual-config.js and js/visuals.js.
//   A  the palette, the film (tone mapping, the grade, the vignette), the
//      night's base light
//   B  the moon: its light from where it is in the sky, its shadow by graphics
//      level (two cascades on High and up), only through the windows indoors
//   C  surfaces: MeshStandard by material, the night sky reflected, the grain
//      on stone, corners darkened at load (vertex AO)
//   D  the fog: exp2, by height, greyer far off, lit towards the moon
//   E  readable: the words over the zombies on their plates, never fogged or
//      filmed, never too small, fading out far off; the zombies' rim and least
//      light; the gun in hand lit like the world; Brightness, its calibration
//      the first time, Visibility Boost
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round18Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round18Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const S = () => G.save.settings;
  const V = () => G.VISUAL;
  const QS = ["vlow", "low", "medium", "high", "vhigh"];
  const rel = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const key = (code) => G.Modal.handleKey({ code, key: code, repeat: false, preventDefault() {} });

  // ---------------- A, D, B: the configuration and the shaders ----------------
  function config() {
    const P = V().palette;
    ok("A1 the palette as asked (navy, dark and royal blue, cyan, blue-white, fog, lit fog, shadow navy, amber, orange, red)",
      P.deepNavy === 0x0b1730 && P.darkBlue === 0x14284f && P.royalBlue === 0x23408e && P.cyan === 0x5ed6ff && P.blueWhite === 0xcfe4ff
      && P.fog === 0x263750 && P.fogLit === 0x3b6a8a && P.shadow === 0x0e1d3a && P.amber === 0xffb54a && P.orange === 0xff8540 && P.red === 0xe5484d);
    ok("M every effect set for each of the five graphics levels", QS.every((q) => V().quality[q] && typeof V().quality[q].lights === "number"), Object.keys(V().quality).join());
    ok("A2 the film: ACES Filmic or AgX, an exposure", ["aces", "agx"].includes(V().grade.toneMapping) && V().grade.exposure > 0, V().grade.toneMapping + " x" + V().grade.exposure);
    const r = G.Game.renderer;
    ok("A2 no material tone-maps on its own: the composite does it once, sRGB out", r.toneMapping === THREE.NoToneMapping && r.outputEncoding === THREE.LinearEncoding && G.Visuals.ready && !!G.Visuals.compMat);
    const C = THREE.ShaderChunk;
    ok("D the fog: exp2, thicker near the ground, greyer far off, lit towards the moon, less on a zombie",
      /exp\( - vzX \* vzX \* \( 1\.0 \+ vzH \) \)/.test(C.fog_fragment) && C.fog_fragment.includes("vzFogP.y") && C.fog_fragment.includes("vzFogLit") && C.fog_fragment.includes("vzFogP.w") && C.fog_fragment.includes("VZ_FOG_SCALE"));
    ok("B indoors the moon and the sky only through the windows: per pixel and per vertex",
      C.lights_fragment_begin.includes("vzMoonK") && C.lights_fragment_begin.includes("vzHemiK") && C.lights_lambert_vertex.includes("vzMoonK") && C.lights_pars_begin.includes("vzOutdoor"));
    ok("B two shadow cascades blended (per pixel, and Lambert's shadow mask)", C.lights_fragment_begin.includes("vzW0") && C.shadowmask_pars_fragment.includes("vzW0"));
    const pl = C.lights_fragment_begin.slice(C.lights_fragment_begin.indexOf("NUM_POINT_LIGHTS > 0"));
    ok("J a pixel out of a pool light's reach skips its shading (three.js leaves it at zero, after the work)",
      /if \( directLight\.visible \) RE_Direct/.test(pl.slice(0, pl.indexOf("#pragma unroll_loop_end"))) && /directLight\.visible = \( directLight\.color != vec3\( 0\.0 \) \)/.test(C.lights_pars_begin));
    ok("D world position without cameraPosition (three.js leaves it at zero for Lambert and Basic)", C.fog_vertex.includes("viewMatrix[ 3 ]") && !C.fog_vertex.includes("cameraPosition") && C.lights_lambert_vertex.includes("viewMatrix[ 3 ]"));
  }

  // ---------------- A2, E: the film in numbers ----------------
  function film() {
    const VZ = G.Visuals;
    const black = VZ.toDisplay([0, 0, 0], "school").map((x) => Math.round(x * 255));
    const L = 0.2126 * black[0] + 0.7152 * black[1] + 0.0722 * black[2];
    ok("A2 black comes out navy, never black (the shadows lifted)", L >= 10 && black[2] > black[0] && black[2] > black[1], black.join(","));
    const warm = VZ.toDisplay([0.9, 0.55, 0.2], "school"), cool = VZ.toDisplay([0.2, 0.5, 0.9], "school");
    ok("A2 the film keeps colour (orange stays orange, blue stays blue)", warm[0] > warm[2] + 0.15 && cool[2] > cool[0] + 0.1, warm.map((x) => x.toFixed(2)) + " / " + cool.map((x) => x.toFixed(2)));
    // the player's brightness and Visibility Boost
    const s = S(), b0 = s.brightness, v0 = s.visibilityBoost, u = VZ.compMat.uniforms;
    VZ.applyGrade("school"); const e0 = u.uExposure.value, l0 = u.uLift.value;
    s.brightness = 1.4; VZ.applyGrade("school"); const e1 = u.uExposure.value;
    s.brightness = b0; s.visibilityBoost = true; VZ.applyGrade("school"); const l1 = u.uLift.value, e2 = u.uExposure.value;
    s.visibilityBoost = v0; VZ.applyGrade("school");
    ok("E4 Brightness raises the film's exposure", Math.abs(e1 / e0 - 1.4 / b0) < 0.01, e0.toFixed(2) + " -> " + e1.toFixed(2));
    ok("E4 Visibility Boost lifts the shadows (and a little exposure)", l1 > l0 && e2 > e0, "lift " + l0 + " -> " + l1);
    // the words' contrast on their plate, over a white background (the worst case)
    const P = V().labels, pc = new THREE.Color(P.plate), a = P.plateAlpha;
    const plate = [pc.r * 255 * a + 255 * (1 - a), pc.g * 255 * a + 255 * (1 - a), pc.b * 255 * a + 255 * (1 - a)];
    const lp = rel(plate[0], plate[1], plate[2]);
    const cols = { white: P.text, spelling: 0x9ae8ff, target: 0xffe36b, crossedOut: P.outColor };
    const rs = Object.entries(cols).map(([k, c]) => { const t = new THREE.Color(c); return [k, +ratio(rel(t.r * 255, t.g * 255, t.b * 255), lp).toFixed(2)]; });
    ok("E1 every word colour >= 4.5:1 on its plate even over pure white", rs.every(([, r]) => r >= 4.5), rs.map((x) => x.join(" ")).join(", "));
  }

  // ---------------- B, C, D, E: a school level ----------------
  async function level() {
    const g = G.Game;
    const real = g._upd || g.update;
    G.save.tutorialDone = true;
    S().graphicsQuality = "medium";
    g.update = real;
    const t0 = performance.now();
    g.startLevel(1);
    const loadMs = Math.round(performance.now() - t0);
    g.update = function () {};
    g.requiredKills = 1e9;
    const sc = g.scene;
    let conv = 0, ao = 0, aoDark = 0, pal = null;
    const PAL = G.SchoolDress.P.PAL;
    sc.traverse((o) => {
      if (!o.isMesh || !o.userData.mergedParts) return;
      const m = o.material;
      if (m && m.isMeshStandardMaterial) conv++;
      if (m && m.isMeshStandardMaterial && m.map === PAL.tex) pal = m;
      const c = o.geometry.attributes.color;
      if (c && m && m.vertexColors) { ao++; for (let i = 0; i < c.count; i += 7) if (c.getX(i) < 0.8) { aoDark++; break; } }
    });
    ok("C the level's baked surfaces are MeshStandard (per-pixel light, roughness, metalness)", conv > 100 && G.Visuals.converted === conv, conv + " meshes");
    ok("C the palette's surfaces: roughness and metalness per colour (metal, wood, paint, stone...)", !!pal && pal.roughnessMap && pal.metalnessMap === pal.roughnessMap,
      pal ? "" : "no palette material");
    const surf = G.Visuals.surface(0x8a8e92), stone = G.Visuals.surface(0xb3a98c);
    ok("C a steel colour is metal, a plaster colour is rough stone", surf.metalness > 0.5 && surf.roughness < 0.6 && stone.metalness === 0 && stone.roughness > 0.85);
    const lm = Array.from(G.Visuals.levelMats || []);
    const refl = lm.filter((m) => m.userData.vzEnv), rough = lm.filter((m) => !m.userData.vzEnv);
    ok("C the night sky as an environment map -- on what reflects (metal, glass, water) only", !!G.Visuals._env && refl.length > 0 && refl.every((m) => m.envMap === G.Visuals._env)
      && rough.every((m) => !m.envMap) && !sc.environment, refl.length + " reflecting, " + rough.length + " not");
    ok("C corners and seams darkened once at load (vertex AO)", ao > 50 && aoDark > 10 && G.Perf.aoMs < 8000, ao + " meshes with AO, " + aoDark + " with darkened vertices, " + G.Perf.aoMs + " ms (" + G.Visuals.aoVerts + " vertices)");
    ok("C puddles and window glass reflect the sky (Standard)", (G.Details.puddles || []).length > 0 && G.Details.puddles.every((m) => m.material.isMeshStandardMaterial));
    const hemis = sc.children.filter((o) => o.isHemisphereLight), amb = sc.children.find((o) => o.isAmbientLight);
    const H = V().school.hemisphere;
    ok("A3 one hemisphere light, sky and ground from the config", hemis.length === 1 && hemis[0].color.getHex() === H.sky && hemis[0].groundColor.getHex() === H.ground && hemis[0].intensity === H.intensity, hemis.length + " hemisphere lights");
    ok("A3 the ambient from the config", amb && amb.color.getHex() === V().school.ambient.color);
    const moon = G.Sky.light;
    ok("B the moon's light: the config's colour, from where the moon is", moon && moon.color.getHex() === V().school.moon.color && moon.position.clone().sub(moon.target.position).normalize().distanceTo(G.Sky.MOON_DIR) < 0.01);
    ok("D the fog: the palette's blue-grey, near and far from the config", sc.fog.color.getHex() === V().palette.fog && G.THEME_PALETTES.school.fogNear === V().fog.near && G.THEME_PALETTES.school.fogFar === V().fog.far);
    const U = G.Visuals.U;
    ok("B the building's footprint and the indoor share of moon and sky", U.vzFoot.value[0].x < U.vzFoot.value[0].y && U.vzRoof.value > 8 && U.vzIndoor.value.x === V().school.indoor.moon);
    // the graphics levels
    const per = {};
    for (const q of QS) {
      S().graphicsQuality = q;
      g.applyGraphicsQuality();
      const r = g.renderer, Q = V().quality[q];
      const sw = G.Visuals.swaps[0];
      per[q] = { shadows: r.shadowMap.enabled, size: moon.castShadow ? moon.shadow.mapSize.x : 0, far: !!(G.Visuals.far && G.Visuals.far.parent), pool: G.Perf.pool.length, soft: r.shadowMap.type === THREE.PCFSoftShadowMap,
        pbr: !!(sw && sw.mesh.material === sw.standard) };
      g.renderFrame();
      per[q].msaa = G.Visuals._rt && G.Visuals._rt.samples || 0;
      // the fog: how far, how thick (the fog on a zombie at the edge of combat range)
      const F = V().fog, X = (F.combatRange - F.near) / (sc.fog.far - F.near) * U.vzFogP.value.x;
      per[q].view = Math.round(sc.fog.far); per[q].zFog = +((1 - Math.exp(-X * X)) * F.zombieScale).toFixed(2);
      per[q].fogOk = Math.abs(sc.fog.far - V().fog.far * Q.view) < 0.01 && U.vzFogP.value.x === Q.fogDensity && per[q].zFog <= 0.4;
      per[q].ok = per[q].pool === Q.lights && (Q.shadows === "off" ? !moon.castShadow : moon.castShadow) && (Q.shadows === "csm") === per[q].far && per[q].pbr === (Q.pbr !== false);
    }
    ok("M the moon's shadow by level: none / low-res / soft / two cascades", (!per.vlow.shadows || !per.vlow.size)
      && per.low.size === V().shadows.low.size && !per.low.soft && per.medium.size === V().shadows.medium.size && per.medium.soft && per.high.far && per.vhigh.far,
      JSON.stringify(per));
    ok("J, C a fixed number of lights per level, per-pixel (PBR) materials from Medium up", QS.every((q) => per[q].ok), QS.map((q) => q + ":" + per[q].pool + (per[q].pbr ? "pbr" : "vtx")).join(" "));
    ok("D each level's view and fog from the config: a shorter view below Medium, a thinner fog there, combat range still readable", QS.every((q) => per[q].fogOk) && per.low.view < per.medium.view,
      QS.map((q) => q + ":" + per[q].view + "m zombie fog " + per[q].zFog).join(" "));
    S().graphicsQuality = "medium"; g.applyGraphicsQuality();
    // a frame: the picture is there, and drawn through the composite
    g.yawObject.position.set(-2, 1.7, 44); g.yawObject.rotation.y = 0.22;
    for (let i = 0; i < 6; i++) real.call(g, 1 / 60);
    g.renderFrame();
    const gl = g.renderer.getContext(), px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    ok("A the frame is drawn (HDR target, then the film onto the screen)", px[0] + px[1] + px[2] > 20 && !!G.Visuals._rt && (!G.Visuals.hdr || G.Visuals._rt.texture.type === THREE.HalfFloatType), Array.from(px).join(",") + " hdr " + G.Visuals.hdr);
    // the film through its colour table, against the film worked out per pixel
    // (this frame, no vignette or noise)
    {
      const VZ = G.Visuals, r = g.renderer, u = VZ.compMat.uniforms, src = VZ._rt;
      const W = src.width, H = src.height;
      const exact = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VZ.compMat.vertexShader, depthTest: false, depthWrite: false,
        fragmentShader: VZ.FILM_GLSL + "\nuniform sampler2D tScene; varying vec2 vUv; void main() { gl_FragColor = vec4( vzFilm( texture2D( tScene, vUv ).rgb ), 1.0 ); }" });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), exact); quad.frustumCulled = false;
      const sc2 = new THREE.Scene(); sc2.add(quad);
      const out = () => new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
      const a = out(), b = out(), A = new Uint8Array(W * H * 4), B = new Uint8Array(W * H * 4);
      const vig = u.uVig.value, dit = u.uDither.value;
      u.uVig.value = 0; u.uDither.value = 0; u.tScene.value = src.texture;
      r.setRenderTarget(a); r.render(VZ.compScene, VZ.ortho); r.readRenderTargetPixels(a, 0, 0, W, H, A);
      r.setRenderTarget(b); r.render(sc2, VZ.ortho); r.readRenderTargetPixels(b, 0, 0, W, H, B);
      r.setRenderTarget(null);
      u.uVig.value = vig; u.uDither.value = dit;
      const hist = new Array(256).fill(0); let sum = 0, n = 0;
      for (let i = 0; i < A.length; i += 4) for (let k = 0; k < 3; k++) { const d = Math.abs(A[i + k] - B[i + k]); hist[d]++; sum += d; n++; }
      let acc = 0, p99 = 0; for (let d = 0; d < 256; d++) { acc += hist[d]; if (acc >= n * 0.99) { p99 = d; break; } }
      let max = 255; while (max > 0 && !hist[max]) max--;
      a.dispose(); b.dispose(); exact.dispose();
      ok("A the film is baked into a colour table: the same picture as worked out per pixel", sum / n < 0.8 && p99 <= 3,
        "mean " + (sum / n).toFixed(2) + "/255, 99% within " + p99 + ", max " + max + " (" + VZ.lutRT.width + "x" + VZ.lutRT.height + " table)");
    }
    // E1, E2: a zombie and its word
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    const p = g.yawObject.position, yaw = g.yawObject.rotation.y;
    const at = (d) => new THREE.Vector3(p.x - Math.sin(yaw) * d, 0, p.z - Math.cos(yaw) * d);
    const near = g.spawnZombieAt("normal", at(8), null), far = g.spawnZombieAt("normal", at(30), null), gone = g.spawnZombieAt("normal", at(55), null);
    [near, far, gone].forEach((z) => { z.emerge = null; z.speed = 0; });
    for (let i = 0; i < 8; i++) real.call(g, 1 / 60);
    g.renderFrame();
    const sp = near.sprite, mat = sp.material;
    ok("E1 the words are drawn last, on their own layer, never fogged or filmed", sp.layers.mask === (1 << G.Visuals.LABEL_LAYER) && mat.fog === false && mat.toneMapped === false && !g.camera.layers.test(sp.layers));
    const cv = sp.userData.canvas, ctx = cv.getContext("2d");
    const plateAlpha = ctx.getImageData(Math.round(cv.width / 2 - (cv.__fw || 0.5) * cv.width / 2 - 4), Math.round(cv.height / 2), 1, 1).data[3];
    ok("E1 a dark see-through plate behind every word", plateAlpha > 100 && plateAlpha < 250, "alpha " + plateAlpha);
    ok("E1 a far word grows to stay readable (never under the minimum size)", far.sprite.scale.y > (far.sprite.userData.baseScale[1] + 0.01), far.sprite.scale.y.toFixed(2) + " vs " + far.sprite.userData.baseScale[1]);
    ok("E1 past combat range a word fades out", G.Aim.labelFade(near) === 1 && G.Aim.labelFade(gone) === 0, G.Aim.labelFade(far).toFixed(2));
    const zm = G.ZOMBIE_MATS.lambert;
    ok("E2 zombies: per-pixel light, a cyan rim, a least light, less fog in combat range",
      zm.isMeshStandardMaterial && zm.userData.vzRim && zm.userData.vzMinLight && zm.defines.VZ_FOG_SCALE && near.mesh.getObjectByProperty("material", zm));
    // E3: the gun and the arms
    g.buildWeaponViewModel();
    const vmMats = []; g.weaponViewGroup.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) vmMats.push(o.material); });
    const lights = []; g.scene.traverse((o) => { if (o.isLight) lights.push(o); });
    ok("E3 the gun in hand: per-pixel light with the rim, lit by every light of the scene", vmMats.length > 0 && vmMats.every((m) => !m.isMeshLambertMaterial) && vmMats.some((m) => m.userData.vzRim)
      && lights.every((l) => l.layers.test(g.vmCamera.layers)), vmMats.length + " materials, " + lights.length + " lights");
    const arms = []; G.PlayerBody.armRig.group.traverse((o) => { if (o.isMesh) arms.push(o.material); });
    ok("E3 the arms too", arms.length > 0 && arms.every((m) => m.isMeshStandardMaterial), arms.length + " parts");
    g.update = real;
    g.quitToMainMenu();
    return loadMs;
  }

  // ---------------- E4: Brightness ----------------
  async function brightness() {
    const old = G.normalizeSave({ settings: {} });
    ok("E4 a save from before: Brightness 1, no boost, calibrated once on the next open", old.settings.brightness === 1 && old.settings.visibilityBoost === false && old.settings.brightnessSet === false);
    ok("E4 an out-of-range brightness is brought back into range", G.normalizeSave({ settings: { brightness: 9 } }).settings.brightness === V().brightness.max);
    const s = S(), b0 = s.brightness, set0 = s.brightnessSet;
    G.BrightnessCal.open("settings");
    await wait(50);
    ok("E4 the calibration window: a G.Modal window, three symbols drawn", G.Modal.isOpen("brightness") && !$("brightness-cal").classList.contains("hidden"));
    const cv = $("bcal-canvas"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let lo = 999, hi = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { const L = d[i] + d[i + 1] + d[i + 2]; lo = Math.min(lo, L); hi = Math.max(hi, L); }
    ok("E4 ...on the night's darkest colour (navy, not black)", lo > 20 && hi > lo + 20, lo + " - " + hi);
    // the symbols against the background: at the default Brightness the left
    // one barely shows, the middle one plainly, the right one clearly; the
    // slider's low end hides the left one, its high end brings it out
    const sym = (br) => {
      s.brightness = br; G.BrightnessCal.draw();
      const c2 = cv.getContext("2d"), W = cv.width, H = cv.height, Y = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
      const bg = Y(c2.getImageData(2, 2, 1, 1).data);
      return [0, 1, 2].map((i) => +(Y(c2.getImageData(Math.round(W * (0.18 + i * 0.32)), Math.round(H * 0.5 + H * 0.03), 1, 1).data) - bg).toFixed(1));
    };
    const B = V().brightness, at1 = sym(B.default), atMin = sym(B.min), atMax = sym(B.max);
    s.brightness = b0; G.BrightnessCal.draw();
    ok("E4 the three symbols: barely, plainly, clearly seen at the default; the left one gone at the lowest, brighter at the highest",
      at1[0] >= 0.5 && at1[0] <= 3.5 && at1[1] >= 3.5 && at1[2] >= 12 && atMin[0] < 0.5 && atMax[0] > at1[0],
      "default " + at1.join("/") + ", lowest " + atMin.join("/") + ", highest " + atMax.join("/") + " (above the background, of 255)");
    ok("E4 a controller works it (its own scope)", G.Pad.scope() === $("bcal-box"));
    const before = s.brightness;
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    key("ArrowRight");
    ok("E4 the arrow keys move the brightness", Math.abs(s.brightness - (before + V().brightness.step)) < 1e-6, before + " -> " + s.brightness);
    s.brightnessSet = false;
    key("Enter");
    ok("E4 Enter confirms: the window closes, the setting is kept and marked as set", !G.Modal.isOpen("brightness") && s.brightnessSet === true);
    // the first time the game opens: after the Start screen
    s.brightnessSet = false;
    G.Start.show(); await wait(30); G.Start.enter(); await wait(G.CONFIG.start.fadeMs + 120);
    ok("E4 the first time: shown after the Start screen", G.Modal.isOpen("brightness"));
    G.BrightnessCal.ok();
    s.brightness = b0; s.brightnessSet = set0 !== false; G.Visuals.applyGrade(null); G.persist();
    // Settings
    G.UI._settingsReturn = "screen-mainmenu"; G.UI.renderSettings(); G.UI.showScreen("screen-settings");
    G.SettingsUI.select("graphics");
    ok("E4 Settings > Graphics: a Brightness slider and Calibrate", !!$("set-brightness") && !!$("btn-brightcal") && +$("set-brightness").min === V().brightness.min && +$("set-brightness").max === V().brightness.max);
    G.SettingsUI.select("accessibility");
    ok("E4 Settings > Accessibility: Visibility Boost", !!$("set-visboost"));
    const sl = $("set-brightness"); sl.value = 1.2; sl.dispatchEvent(new Event("input", { bubbles: true }));
    ok("E4 the slider is seen at once (the film's exposure)", Math.abs(G.Visuals.compMat.uniforms.uExposure.value - G.Visuals.gradeFor(G.Visuals.theme).exposure) < 1e-6 && s.brightness === 1.2);
    s.brightness = b0; G.Visuals.applyGrade(null);
    G.UI.goToMainMenu();
  }

  async function run() {
    results.length = 0;
    const errs = [];
    const onErr = (e) => errs.push(String(e.message || e));
    window.addEventListener("error", onErr);
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    let lost = false;
    const onLost = () => { lost = true; };
    G.Game.renderer.domElement.addEventListener("webglcontextlost", onLost);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    let loadMs = 0;
    try {
      config();
      film();
      loadMs = await level();
      await brightness();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      console.error = oe;
      G.Game.renderer.domElement.removeEventListener("webglcontextlost", onLost);
      G.Input.requestPointerLock = realLock;
      G.Modal.reset();
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      if (G.Visuals.ready) G.Visuals.applyGrade(null);
      G.UI.goToMainMenu();
    }
    ok("no shader errors, no lost WebGL context, no uncaught errors", !errs.length && !lost, errs.slice(0, 2).join(" | "));
    return { total: results.length, loadMs, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
