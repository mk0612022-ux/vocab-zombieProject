// ===================================================================
// The look of the game -- visual series (Cinematic Dark Fantasy)
// -------------------------------------------------------------------
// Every colour, light level and effect value of the new look lives in this
// one file: change a number, reload, and the game uses it. Nothing here is
// code. js/visuals.js reads it.
//
// Colours are 0xRRGGBB. "intensity" values are three.js light intensities.
// The quality table at the bottom says which effect runs at which of the
// five graphics levels (Settings > Graphics): vlow, low, medium, high, vhigh.
//
// The goal, in one line: dark but readable -- the night is deep blue, never
// black, and a zombie and the word over its head always read clearly.
// ===================================================================
G.VISUAL = {
  // ---- A1: the palette ---------------------------------------------------
  palette: {
    deepNavy: 0x0b1730, darkBlue: 0x14284f, royalBlue: 0x23408e,   // the surroundings
    cyan: 0x5ed6ff, blueWhite: 0xcfe4ff,                              // the night's main light
    fog: 0x263750, fogLit: 0x3b6a8a,                                  // haze, and haze where light passes
    shadow: 0x0e1d3a,                                                 // shadows are navy, not black
    amber: 0xffb54a, orange: 0xff8540, red: 0xe5484d,                 // warm: important places only
  },

  // ---- A2: the camera's film -- tone mapping and the grade -----------------
  // Applied once to the finished picture (js/visuals.js, the composite). The
  // words over the zombies and the HUD are drawn after it and never touched.
  grade: {
    toneMapping: "aces",       // "aces" (ACES Filmic) or "agx"
    exposure: 1.22,            // before tone mapping
    // the darkest parts are lifted to navy instead of black: `lift` of the
    // shadow colour is added where the picture is dark, fading out by `liftEnd`
    shadowColor: 0x0e1d3a, lift: 0.62, liftEnd: 0.26,
    midTint: 0x8ea6d0, midTintAmount: 0.06,      // midtones lean cool blue
    highTint: 0xdce9ff, highTintAmount: 0.10,    // highlights lean blue-white
    saturation: 0.74,          // overall saturation (1 = unchanged)
    warmKeep: 0.92,            // ...but warm hues (orange, amber, red) keep this much of theirs
    contrast: 1.04,            // around mid grey; kept moderate
    vignette: 0.32,            // how dark the corners get (0 = none)
    vignetteStart: 0.55,       // from this far out (0 = centre, 1 = corner)
    dither: 1.0,               // a touch of noise against banding in dark gradients
    lutSize: 64,               // the film is baked into a colour table this many steps a channel (js/visuals.js)
  },
  // the other levels keep their own look: the same film, a lighter hand
  themeGrade: {
    hospital: { exposure: 1.3, lift: 0.35, saturation: 0.9, warmKeep: 1, midTintAmount: 0.03, highTintAmount: 0.03, vignette: 0.26 },
    bunker: { exposure: 1.35, lift: 0.3, saturation: 0.92, warmKeep: 1, midTintAmount: 0.02, highTintAmount: 0.02, vignette: 0.26 },
  },

  // ---- E4: the player's brightness ---------------------------------------
  brightness: {
    min: 0.6, max: 1.6, step: 0.05, default: 1,   // Settings > Graphics > Brightness (x exposure)
    // the calibration's three symbols: how far above the night's darkest colour
    // each comes out at the default Brightness (in 1/255 of the screen's range) --
    // the left one barely, the middle one plainly, the right one clearly
    calibration: [1.5, 5, 16],
    visibilityBoost: { lift: 0.9, exposure: 1.15, liftEnd: 0.5 },   // Accessibility: shadows lifted further
  },

  // ---- A3, B: the school's lights -------------------------------------------
  school: {
    background: 0x0b1730,
    hemisphere: { sky: 0x3c4a66, ground: 0x1e2433, intensity: 0.8 },
    // (the ambient stands in, for the cheaper per-vertex materials -- the
    // grass -- for the sky light the others get from the environment map)
    ambient: { color: 0x323a4c, intensity: 0.6 },
    moon: {
      color: 0xbfe0ff,        // blue-white, a little cyan
      intensity: 1.0,
      cloudDim: 0.6,          // how much a cloud over the moon takes away (eased in and out)
    },
    // inside the building the moon and the open sky reach only through the
    // windows (their beams): this much of each is left indoors
    indoor: { moon: 0.06, hemisphere: 0.35 },
    // room lights (the pooled point lights) are scaled by this
    roomLights: 1.0,
    // the sky dome: zenith, middle, horizon (= the fog, so they meet unseen)
    sky: { top: 0x050b1d, mid: 0x0e1a3d },
    // environment map for metal, glass and wet floors: the night sky's
    // reflection, this strong outdoors and indoors
    envOutdoor: 0.55, envIndoor: 0.25,
    // the specks of dust floating in the rooms' light: their brightness (1 = as made)
    dust: 0.35,
  },

  // ---- C: materials ----------------------------------------------------------
  // How every surface takes the light: roughness (0 mirror - 1 chalk) and
  // metalness. Colours listed under a kind take that kind; any other colour
  // is "rough" (stone, concrete, brick, plaster, earth). Matched by the exact
  // colour a part was painted with in the level's code.
  materials: {
    rough: { roughness: 0.94, metalness: 0.0 },
    wood: { roughness: 0.78, metalness: 0.0, colors: [0x6b4a2f, 0x4a3220, 0x6a5a44, 0x4a3e30, 0x7a6448, 0x8b5a2b, 0x6e4a2a, 0x5a3a20, 0x7a5232, 0x4f4030, 0x3b2f24, 0x9a6a3a] },
    paint: { roughness: 0.62, metalness: 0.0, colors: [0x2f6a8a, 0xc0501f, 0x6a7a86, 0x4a5660, 0x3f5a8a, 0x2b6a4a, 0x1c2228] },
    metal: { roughness: 0.42, metalness: 0.85, colors: [0x8a8e92, 0x8a8a88, 0x7a7a78, 0x5a5e62, 0x3a3a38, 0x9a9a98, 0x6a6e72, 0x707478, 0x4a4e52, 0x2e3236, 0x808488, 0xa0a4a8, 0x5c6066] },
    rust: { roughness: 0.85, metalness: 0.35, colors: [0x6a4a2e, 0x7a4a2a] },
    rubber: { roughness: 0.9, metalness: 0.0, colors: [0x1c1c1c, 0x1a1a1a, 0x191a1f] },
    // the held gun and arms (weapon parts: dark = metal, light = polymer)
    gunMetal: { roughness: 0.38, metalness: 0.8, maxLum: 0.32 },
    gunPolymer: { roughness: 0.6, metalness: 0.05 },
    zombie: { roughness: 0.82, metalness: 0.0 },
    // puddles and standing water: a dark mirror of the night sky
    wet: { color: 0x5a6472, roughness: 0.06, metalness: 1.0, env: 1.0 },
    // window glass (Medium and up): reflects the sky, still see-through
    glass: { roughness: 0.08, metalness: 0.35, env: 1.25 },
    // the fine grain over stone and brick (High and up): how much it changes
    // the colour and tilts the surface, and how many times a metre it repeats
    detail: { albedo: 0.09, normal: 0.22, scale: 0.9, minRoughness: 0.85 },
    // vertex AO: corners and seams darkened once, when the level loads
    // (grain: a faint unevenness baked into the same vertices, every level --
    // free while playing, unlike the texture above)
    ao: { strength: 0.62, radius: 0.42, segment: 1.6, minFace: 0.3, grain: 0.06 },
  },

  // ---- D: fog and distance -------------------------------------------------
  fog: {
    // school: where the fog starts and the distance at which nothing is left;
    // in between it thickens as distance squared (exp2)
    near: 3, far: 62,
    density: 2.0,            // how thick it is by `far` (2 = 98%; per graphics level: quality.fogDensity)
    height: 0.7,             // extra fog near the ground (Medium and up)...
    heightFalloff: 3.2,      // ...thinning out over this many metres up
    desaturate: 0.55,        // far things lose this much colour as they fade
    litAmount: 0.55,         // the fog towards the moon takes the lit colour
    litPower: 5,
    // E2: in combat range the fog touches a zombie this much less (0.45 = 55% less)
    zombieScale: 0.45,
    combatRange: 25,
    // (the school's distance and thickness by graphics level are in the quality
    // table below: view, fogDensity. The other levels keep their own share of
    // their far distance, as before)
    themeView: { vlow: 0.5, low: 0.7 },
  },

  // ---- E: readability ---------------------------------------------------
  labels: {
    text: 0xffffff,
    plate: 0x081226, plateAlpha: 0.8,         // the dark see-through plate behind every word (>= 4.5:1 even over white)
    outColor: 0xb4bbc6,                       // a word crossed out (Fifty-Fifty): grey and struck through, still readable
    minPx: 17,                                // the word's letters are never smaller than this on screen...
    maxGrow: 2.2,                             // ...growing at most this much to stay so
    fadeStart: 34, fadeEnd: 46,               // past combat range a word fades out between these (metres)
  },
  zombies: {
    minLight: 0x1a2a48,      // the least light a zombie ever gets (added, never darker than this)
    rim: 0x5ed6ff, rimStrength: 0.55, rimPower: 2.4,
    bossRim: 0x8fe4ff, bossRimStrength: 0.9,
    // (round 2) how much of the haze in the air -- fog sheets, shafts, the
    // raymarched fog -- and of the SSAO and the rays is kept off a zombie
    // (1 = all of it): E2, the fog touches a zombie less than the scene
    clearOfAir: 0.8,
  },
  viewmodel: {
    rim: 0x5ed6ff, rimStrength: 0.28, rimPower: 3.0,
    minLight: 0x101c34,
  },

  // ---- shadows ----------------------------------------------------------------
  shadows: {
    // (every: the shadow map is drawn again every so many frames -- the
    // zombies' shadows move at that rate -- and at once whenever it moves
    // with the player)
    low: { size: 512, extent: 22, every: 4, soft: false },
    medium: { size: 1024, extent: 30, every: 3, soft: true },
    csmEvery: 2,
    // High and up: two cascades -- a sharp one near the player, a wide one
    near: { extent: 16 }, far: { extent: 70, every: 4 },
    high: { nearSize: 2048, farSize: 1024 },
    vhigh: { nearSize: 2048, farSize: 2048 },
    bias: -0.0006, normalBias: 0.03,
  },

  // ======================= round 2: light hierarchy, rim, bloom, spill =======================
  // ---- F: four tiers of light -------------------------------------------------
  // What is lit how much, so the eye goes where it should. Each object's tier
  // is set in js/lightfx.js. glow: how far over 1.0 an emitter goes in the HDR
  // picture -- only what goes over the bloom threshold below glows (Medium and
  // up). priority: metres taken off a light's distance when the fixed pool of
  // dynamic lights (J) picks the nearest ones, so a hero light is never left out.
  tiers: {
    ambient: { note: "the hemisphere and ambient above (school)" },
    environmental: { glow: 2.2, priority: 0 },          // the moon, window beams, corridor and room lights, lamp posts
    important: {                                        // what the player can use: pick-ups, wall guns, the mystery box, notes...
      glow: 2.6, priority: 3,
      color: 0xffb54a,                                  // warm: rare in the scene, so it means "this matters" (F2)
      rimStrength: 0.42, rimPower: 2.2, pulse: 0.3,     // a warm edge that breathes slowly
      door: { color: 0xcfe4ff, rimStrength: 0.16 },     // doors: many of them, so a faint cool edge only
    },
    hero: {                                             // the goal of the moment
      glow: 5.0, priority: 14, color: 0xffb54a, pulse: 0.35,
    },
  },
  // F2, F3: the rooms' lights are cool; warm is kept for the few places that need it
  lighting: {
    roomLight: [0xcfe0ff, 0xd6e2f2, 0xbcd0f0, 0xc6d8ee, 0xdce6ff],   // replaces the school's room-light colours
    tubeColor: 0xe6eeff, tubeGlow: 2.4,                 // the ceiling tubes themselves, in the HDR picture
    corridor: { intensity: 0.85, distance: 7.0 },       // darker corridors: pools of light, then dark
    lampPost: { color: 0xffcf96, glow: 3.0, intensity: 0.9, distance: 15 },
    moonGlow: 2.4,                                      // the moon's disc
    eyes: 2.0,                                          // the zombies' eyes (more and a near one's face is lost in its glow)
    library: { color: 0xffb54a, glow: 3.2, intensity: 0.85, distance: 6.5, lamps: 3 },   // warm reading lamps (F3)
    emergency: { color: 0xe5484d, glow: 2.6, intensity: 0.65, distance: 6, share: 0.4 },  // red emergency lights in some dead rooms
    warmWindow: { color: 0xff9a4a, glow: 2.2, spill: 0.55 },   // a lit window seen from outside (the library's)
    glowSign: 2.0,                                      // signs and LED strips (the glow boxes)
  },
  // the hero lights (F1): when each is on is in js/lightfx.js
  hero: {
    entrance: { color: 0xffb54a, intensity: 1.5, distance: 11, glow: 5.0, seconds: 120 },   // over the front doors, at the start
    gate: { color: 0xffb54a, intensity: 1.6, distance: 9, glow: 5.0, seconds: 150 },        // stairs to floors 2 and 3, once they can open
    keycard: { color: 0x7ac8ff, intensity: 1.3, distance: 7, glow: 4.0 },                   // floor 3's keycard while it lies there
    floodlights: { color: 0xdfe8ff, intensity: 2.4, distance: 36, height: 13, glow: 6.0, warmUp: 2.2 },   // the field's, at the boss
  },

  // ---- G: rim light -----------------------------------------------------------------
  // a thin line of light along an object's edge (fresnel), stronger on the side
  // the moon is on. Zombies, the boss and the gun: above (zombies, viewmodel)
  rim: {
    world: { color: 0x6a8cc8, strength: 0.12, power: 3.0 },   // the buildings and big structures, outdoors only
  },

  // ---- H: light in the air -------------------------------------------------------------
  // Shafts and fog sheets are drawn into their own smaller picture (Medium and
  // up), which knows how far away the scene is behind each pixel: where a shaft
  // meets a floor or a wall it fades out over `soft` metres instead of cutting.
  air: {
    resolution: 0.5,                 // its share of the screen's width and height
    soft: 0.7,                       // metres
    windowBeam: 0.48, outdoorShaft: 0.07, hatch: 0.24,   // the existing moonbeams' strength
    lampCone: { strength: 0.15, radius: 1.7, length: 4.3 },   // under the lit lamp posts and the hero lights
    fogSheets: { radius: 24, size: 10, heightMin: 0.25, heightMax: 1.5, opacity: 0.14, color: 0x3b6a8a, drift: 0.22 },
  },
  // High and up: rays from the moon, through gaps and windows (screen space)
  // (threshold: only the sky brighter than this sends rays -- the moon and its halo)
  godRays: { resolution: 0.25, samples: 40, density: 0.92, decay: 0.95, weight: 0.3, exposure: 0.14, threshold: 0.25, color: 0xcfe4ff },
  // Very High: fog lit from inside by the moon and the lamps (raymarched, low resolution)
  // (density: haze per metre; extinction: how much of it also dims what is behind
  // -- kept low, the distance fog already does that; heightFalloff: thinning upwards)
  raymarch: { resolution: 0.25, steps: 24, density: 0.004, extinction: 0.35, moon: 0.8, lamps: 1.2, maxDistance: 40, heightFalloff: 6, color: 0x3b6a8a },

  // ---- I: bloom ---------------------------------------------------------------------------
  // Only what is brighter than `threshold` (in the HDR picture, 1 = paper white)
  // glows: the emitters above. Labels and the HUD are drawn after it.
  bloom: { threshold: 1.45, knee: 0.4, strength: 0.6, radius: 0.85, levels: 5 },

  // ---- J: light spill ----------------------------------------------------------------------
  // The lamps that never move light the walls and floors round them once, when
  // the level loads (per vertex, every level); the dynamic lights do the rest.
  spill: { strength: 0.3, flicker: 0.6, range: 1.0, step: 0.3, max: 2.0 },
  // a soft pool of light on the floor under each lamp, following its flicker
  decals: { strength: 0.32, size: 0.55 },
  // High and up: ambient occlusion from the depth of the picture
  ssao: { radius: 0.55, strength: 0.6, bias: 0.03, samples: 10 },

  // ---- K: composition -----------------------------------------------------------------------
  // what is right in front of the camera at the edges of the picture -- a fence
  // post, a tree trunk, the eaves -- goes darker, framing the view (Medium and up)
  framing: { near: 1.6, edge: 0.55, amount: 0.22 },

  // ---- M: which effect at which graphics level ----------------------------------
  // (rounds 2 and 3 add to this table)
  // round 2: bloom "off" / "half" (half resolution) / "full"; air: the shafts'
  // and fog sheets' picture; fogSheets: how many; ssao: off (0) or its share
  // of the resolution; godRays, raymarch: on or off
  // (view: the share of fog.far that is seen -- everything past it plus 8 m
  // is not drawn, js/zones.js -- and fogDensity: how thick the fog is by
  // then; a thinner fog on the short views keeps combat range readable)
  quality: {
    //            shadows    height fog  detail  dynamic lights  AO    msaa
    vlow:   { shadows: "off", pbr: false, heightFog: false, detail: false, lights: 3, ao: true, msaa: 0, fxaa: false, hdr: false, view: 0.5, fogDensity: 1.5,
              bloom: "off", air: false, fogSheets: 0, godRays: false, ssao: 0, raymarch: false },
    low:    { shadows: "low", pbr: false, heightFog: false, detail: false, lights: 3, ao: true, msaa: 0, fxaa: false, hdr: false, view: 0.56, fogDensity: 1.6,
              bloom: "off", air: false, fogSheets: 0, godRays: false, ssao: 0, raymarch: false },
    medium: { shadows: "medium", pbr: true, heightFog: true, detail: false, lights: 4, ao: true, msaa: 0, fxaa: false, hdr: true, view: 1, fogDensity: 2.0,
              bloom: "half", air: true, fogSheets: 10, godRays: false, ssao: 0, raymarch: false },
    high:   { shadows: "csm", pbr: true, heightFog: true, detail: true, lights: 8, ao: true, msaa: 0, fxaa: true, hdr: true, view: 1, fogDensity: 2.0,
              bloom: "full", air: true, fogSheets: 16, godRays: true, ssao: 0.5, raymarch: false },
    vhigh:  { shadows: "csm", pbr: true, heightFog: true, detail: true, lights: 8, ao: true, msaa: 0, fxaa: true, hdr: true, view: 1, fogDensity: 2.0,
              bloom: "full", air: true, fogSheets: 22, godRays: true, ssao: 1, raymarch: true },
  },
};
