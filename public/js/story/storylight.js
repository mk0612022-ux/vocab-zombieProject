// ===================================================================
// The chapter's light, scene by scene (story series, round 4)
// -------------------------------------------------------------------
// Design doc, its table of light and time: the day goes by in the light,
// from a bright morning to dusk. Each scene names a set (js/data/story/ch1.js
// `light`); a set is the sky's colour and the haze, the ambient and the sky's
// light, the sun (its colour, strength, how high -- a long low sun at 17:45),
// the picture's grade, and the lamps by kind (the map tags each one: room,
// corridor, emergency, exit, gym, outdoor, car) -- their colour, their
// strength, steady, flickering or blinking:
//   morning   07:10   bright, warm white (the prologue)
//   alarm     08:50   the corridor lights out, the emergency lamps blinking red,
//                     the morning sun through the windows (1-1)
//   blackout  09:10   the power off: only the green exit signs and the phone's torch (1-2)
//   library   09:30   warm brown light, sun through dusty windows (1-3)
//   nurse     10:15   the nurse's room's cold white light (1-4)
//   noon      12:30   midday sun in the canteen, the gym's lamps flickering (1-5)
//   golden    17:00   gold afternoon sun (1-6)
//   sunset    17:45   orange and red, long shadows (1-7)
//   dusk      18:15   blue dusk, the lamps on, the van's headlights (1-8)
// Nothing is added or taken away from the scene between sets (only colours and
// strengths change): the light count stays as it was built, so no shader is
// made again (js/perf.js's rule). The sun is made with the map, before the
// light pool; it follows the player so its shadow (Medium and up) stays sharp.
//
//   G.StoryLight.attach(kit)        the sun (js/story/ch1map.js, as the map is built)
//   G.StoryLight.apply(game, name)  a set (js/story/scenes.js: a scene's start, ["light", name])
//   G.StoryLight.update(game)       each frame of a chapter
//   G.StoryLight.SETS / INDOOR / LEVEL / current
// ===================================================================
window.G = window.G || {};

G.StoryLight = (function () {
  // kinds: [colour, strength (x the lamp's own; an off-by-day lamp: this itself), mode,
  // reach in metres (the lamp's own when left out: a sign's glow, a blinking lamp, a
  // headlight light only what is near them)]
  const EXIT = 4.5, EMERG = 8, CAR = 10;
  const SETS = {
    morning: { sky: 0xc8dcef, fog: [0xd6e2ec, 70, 230], amb: [0xfff1e0, 0.62], hemi: [0xe6f0ff, 0x9a8a72, 0.5], sun: [0xfff0d0, 1.5, [-0.45, 0.78, 0.43]], grade: { exposure: 1.0, saturation: 1.02 },
      kinds: { room: [0xeef2ff, 0.8], corridor: [0xeef2ff, 0.65], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0, null, EXIT], gym: [0xffffff, 1], outdoor: [0xffd8a0, 0], car: [0xfff0c0, 0, null, CAR] } },
    alarm: { own: true, sky: 0xc0d2e4, fog: [0xc8d4de, 60, 210], amb: [0xffe8e0, 0.38], hemi: [0xd8e4f4, 0x6a5a50, 0.32], sun: [0xffe8c8, 1.25, [-0.5, 0.62, 0.6]], grade: { exposure: 0.95 },
      kinds: { room: [0xeef2ff, 0.15], corridor: [0xeef2ff, 0.12, "flicker"], emergency: [0xff2a1a, 2.2, "blink", EMERG], exit: [0x2aff7a, 0.35, null, EXIT], gym: [0xffffff, 0.3], outdoor: [0xffd8a0, 0], car: [0xfff0c0, 0, null, CAR] } },
    blackout: { own: true, sky: 0x8a9aae, fog: [0x7a8898, 35, 150], amb: [0x8090a8, 0.32], hemi: [0x8a9ab8, 0x3a3a40, 0.18], sun: [0xd8e4f4, 0.45, [-0.3, 0.7, 0.65]], grade: { exposure: 0.9, saturation: 0.9 },
      kinds: { room: [0xeef2ff, 0], corridor: [0xeef2ff, 0], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.6, null, EXIT], gym: [0xffffff, 0], outdoor: [0xffd8a0, 0], car: [0xfff0c0, 0, null, CAR] } },
    library: { sky: 0xd0d8e0, fog: [0xd4d2cc, 60, 210], amb: [0xffe2c0, 0.52], hemi: [0xfff0d8, 0x8a6a48, 0.42], sun: [0xffe0b0, 1.45, [-0.35, 0.55, 0.76]], grade: { exposure: 1.0, saturation: 1.05, midTint: 0xffd8a8, midTintAmount: 0.06 },
      kinds: { room: [0xffe2b8, 0.9], corridor: [0xffe8c8, 0.5], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.35, null, EXIT], gym: [0xffffff, 0.4], outdoor: [0xffd8a0, 0], car: [0xfff0c0, 0, null, CAR] } },
    nurse: { sky: 0xd8e2ee, fog: [0xdce4ec, 70, 220], amb: [0xe8f0ff, 0.58], hemi: [0xeef4ff, 0x7a8088, 0.46], sun: [0xf4f8ff, 1.35, [0.1, 0.85, 0.5]], grade: { exposure: 1.0, saturation: 0.92, midTint: 0xdce8ff, midTintAmount: 0.05 },
      kinds: { room: [0xe4eeff, 1.1], corridor: [0xe8f0ff, 0.6], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.3, null, EXIT], gym: [0xffffff, 0.6], outdoor: [0xffd8a0, 0], car: [0xfff0c0, 0, null, CAR] } },
    noon: { sky: 0xb8d4f0, fog: [0xd2e0ee, 80, 250], amb: [0xfff8ee, 0.72], hemi: [0xeef6ff, 0xa89a80, 0.58], sun: [0xfff8e8, 1.8, [0.15, 0.95, 0.25]], grade: { exposure: 1.02, saturation: 1.05 },
      kinds: { room: [0xeef2ff, 0.7], corridor: [0xeef2ff, 0.6], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.3, null, EXIT], gym: [0xffffff, 1.6, "flicker"], outdoor: [0xffd8a0, 0], car: [0xfff0c0, 0, null, CAR] } },
    golden: { sky: 0xe8c8a0, fog: [0xe8d0b0, 70, 220], amb: [0xffd8a8, 0.55], hemi: [0xffe0b8, 0x8a6040, 0.45], sun: [0xffc070, 1.45, [0.55, 0.38, 0.74]], grade: { exposure: 1.0, saturation: 1.08, midTint: 0xffc890, midTintAmount: 0.08 },
      kinds: { room: [0xfff0d8, 0.7], corridor: [0xfff0d8, 0.55], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.3, null, EXIT], gym: [0xffffff, 0.8], outdoor: [0xffd8a0, 0.3], car: [0xfff0c0, 0, null, CAR] } },
    sunset: { sky: 0xe89870, fog: [0xd88868, 50, 190], amb: [0xff9a70, 0.42], hemi: [0xffa080, 0x5a3a3a, 0.38], sun: [0xff7a40, 1.25, [0.75, 0.18, 0.64]], grade: { exposure: 0.98, saturation: 1.1, midTint: 0xff9a70, midTintAmount: 0.1 },
      kinds: { room: [0xfff0d8, 0.8], corridor: [0xfff0d8, 0.6], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.35, null, EXIT], gym: [0xffffff, 0.8], outdoor: [0xffc880, 0.9], car: [0xfff0c0, 0, null, CAR] } },
    dusk: { own: true, sky: 0x2e3e6a, fog: [0x34446e, 35, 160], amb: [0x6a78a8, 0.3], hemi: [0x5a6aa0, 0x1a1a24, 0.26], sun: [0x8a9ad0, 0.35, [0.7, 0.1, 0.7]], grade: { exposure: 0.95, saturation: 0.95 },
      kinds: { room: [0xfff0d8, 0.9], corridor: [0xfff0d8, 0.7], emergency: [0xff2a1a, 0, null, EMERG], exit: [0x2aff7a, 0.5, null, EXIT], gym: [0xffffff, 0.6], outdoor: [0xffd8a0, 1.4], car: [0xfff0c0, 1.8, null, CAR] } },
  };
  // indoors. The building (js/story/ch1map.js world.lightFoot) is dimmed per pixel by
  // js/visuals.js on every graphics level: this much of the sun (`sun`) and of the sky's light
  // (`sky`) reaches its rooms -- the windows and the lamps light them. The gym's roof is lower
  // than the building's, so it is not in that: in there with no shadows (Low, Very Low) the sun
  // would light the floor through the roof, so while the player is in the gym the sun and the
  // sky's light are turned down to gymSun / gymSky (eased by `blend` a frame)
  const INDOOR = { sun: 0.06, sky: 0.45, gymSun: 0.12, gymSky: 0.7, blend: 0.12 };
  // how strong the sets come out. They were first set on Low, whose 8-bit picture stops at
  // white; on Medium and up (a float picture, then the film's curve) the same numbers burnt the
  // rooms and the yard to white. Each set's ambient, sky light, sun and lamps are multiplied by
  // these (near the Training Yard's tuned daylight: sun 0.62, sky 0.35) -- the exit signs and the
  // emergency lamps keep their own (they are for the dark), and so do the dark sets (`own`: the
  // alarm, the blackout, dusk -- never burnt; scaled down, they went black)
  const LEVEL = { amb: 0.6, sky: 0.65, sun: 0.45, lamp: 0.7 };
  const ONE = { amb: 1, sky: 1, sun: 1, lamp: 1 };
  const LAMP_OWN = { exit: 1, emergency: 1 };
  const levelOf = (S) => (S.own ? ONE : LEVEL);
  let cur = null, sun = null, dir = new THREE.Vector3(-0.45, 0.78, 0.43).normalize(), amb = null, hemi = null, scene = null;

  // the sun, made with the map (before the light pool: the count stays as built)
  function attach(kit) {
    scene = kit.scene;
    sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
    sun.name = "story-sun";
    sun.position.set(0, 60, 0);
    scene.add(sun); scene.add(sun.target);
    const q = (G.save && G.save.settings && G.save.settings.graphicsQuality) || "medium";
    sun.castShadow = q !== "vlow" && q !== "low";
    const size = q === "vhigh" || q === "high" ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    const c = sun.shadow.camera;
    c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 160; c.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    amb = scene.children.find((o) => o.isAmbientLight) || null;
    hemi = scene.children.find((o) => o.isHemisphereLight) || null;
    cur = null;
    return sun;
  }

  function apply(game, name) {
    if (!name || !game || !game.scene) return false;
    const S = SETS[name];
    if (!S) return false;
    cur = name;
    const sc = game.scene;
    if (scene !== sc) { scene = sc; amb = sc.children.find((o) => o.isAmbientLight) || null; hemi = sc.children.find((o) => o.isHemisphereLight) || null; sun = sc.children.find((o) => o.name === "story-sun") || null; }
    sc.background = new THREE.Color(S.sky);
    if (sc.fog) { sc.fog.color.setHex(S.fog[0]); sc.fog.near = S.fog[1]; sc.fog.far = S.fog[2]; }
    // (the haze's slow drift starts from the level's own every frame -- js/world.js fogBase)
    const fb = game.world && game.world.fogBase;
    if (fb) { fb.near = S.fog[1]; fb.far = S.fog[2]; }
    const Lv = levelOf(S);
    if (amb) { amb.color.setHex(S.amb[0]); amb.intensity = S.amb[1] * Lv.amb; }
    if (hemi) { hemi.color.setHex(S.hemi[0]); hemi.groundColor.setHex(S.hemi[1]); hemi.intensity = S.hemi[2] * Lv.sky; }
    if (sun) { sun.color.setHex(S.sun[0]); sun.intensity = S.sun[1] * Lv.sun; dir.set(S.sun[2][0], S.sun[2][1], S.sun[2][2]).normalize(); }
    // the lamps, by kind
    ((G.Perf && G.Perf.anchors) || []).forEach((a) => {
      const K = a.kind && S.kinds[a.kind];
      if (!K) return;
      a.color.setHex(K[0]);
      a.base = K[1] * (LAMP_OWN[a.kind] ? 1 : Lv.lamp) * (a.base0 > 0 ? a.base0 : 1);
      a.mode = K[2] || null;
      if (a.distance0 == null) a.distance0 = a.distance;
      a.distance = K[3] || a.distance0;
    });
    inK = null;
    // the picture's grade (js/visuals.js), from the Training Yard's daylight
    const V = G.Visuals, VC = G.VISUAL;
    if (V && V.ready && VC && VC.themeGrade && V.applyGrade) {
      const key = "story_" + name;
      VC.themeGrade[key] = Object.assign({}, VC.themeGrade.training || {}, S.grade || {});
      const prev = V.theme;
      V.applyGrade(key);
      V.theme = prev;
    }
    return true;
  }

  // each frame: the sun over the player, its shadow box with them; in the gym
  // without shadows, the sun and the sky's light turned down (eased)
  let inK = null;
  function update(game) {
    if (!sun || !game.yawObject || sun.parent !== game.scene) return;
    const p = game.yawObject.position;
    sun.target.position.set(Math.round(p.x), 0, Math.round(p.z));
    sun.position.copy(sun.target.position).addScaledVector(dir, 70);
    sun.target.updateMatrixWorld();
    const S = cur && SETS[cur];
    if (!S) return;
    const map = game.world && game.world.storyMap;
    const inside = !!(map && map.inGym && map.inGym(p.x, p.z)) && !sun.castShadow;
    const want = inside ? 1 : 0;
    inK = inK == null ? want : inK + (want - inK) * INDOOR.blend;
    const Lv = levelOf(S);
    sun.intensity = S.sun[1] * Lv.sun * (1 - inK * (1 - INDOOR.gymSun));
    if (hemi) hemi.intensity = S.hemi[2] * Lv.sky * (1 - inK * (1 - INDOOR.gymSky));
  }
  function reset() { cur = null; sun = null; amb = null; hemi = null; scene = null; inK = null; }

  return { SETS, INDOOR, LEVEL, attach, apply, update, reset, get current() { return cur; }, get sun() { return sun; } };
})();
