// ============================================================
// WORLD: level defs, voxel scene builders, spawner, interactions, boss
// ============================================================
window.G = window.G || {};

// ---------------- Level definitions ----------------
G.LEVELS = [
  {
    id: 1, name: "โรงเรียนร้าง", theme: "school", icon: "🏚️", wordsKey: "level1",
    waves: 5, difficulty: 1, bossEvery: 3,
    spawnBaseInterval: 5.0, maxAliveZombies: 7,
  },
  {
    id: 2, name: "โรงพยาบาลร้าง", theme: "hospital", icon: "🏥", wordsKey: "level2",
    waves: 6, difficulty: 1.35, bossEvery: 3,
    spawnBaseInterval: 4.2, maxAliveZombies: 9,
  },
  {
    id: 3, name: "บังเกอร์ใต้ดิน", theme: "bunker", icon: "🛡️", wordsKey: "level3",
    waves: 7, difficulty: 1.7, bossEvery: 3,
    spawnBaseInterval: 3.4, maxAliveZombies: 11,
  },
];

G.getLevel = (id) => G.LEVELS.find((l) => l.id === id);

// Each theme keeps its own recognizable hue family but now carries a couple of
// accent tones too, used for lighting variety and small color-coded landmarks.
G.THEME_PALETTES = {
  school: {
    floor: 0x2f2b1e, floorLine: 0x1f1c14, floorStain: 0x3d3624, wall: 0x3d3826, accent: 0x5c5438,
    fog: 0x1a170f, fogNear: 3, fogFar: 30, light: 0xd8c98c, ambient: 0x36311f,
    roomLight: [0xd8c98c, 0x8fa0c9, 0xe8dca0, 0xc9a86b, 0xffe08a],
  },
  hospital: {
    floor: 0x18261d, floorLine: 0x0e1811, floorStain: 0x24352a, wall: 0x203024, accent: 0x3d6b52,
    fog: 0x0b150f, fogNear: 2.5, fogFar: 25, light: 0x7dffc0, ambient: 0x17281d,
    roomLight: [0x7dffc0, 0x6bd4ff, 0xff6b6b, 0x9dffb0, 0xffe27a],
  },
  bunker: {
    floor: 0x161615, floorLine: 0x0a0a0a, floorStain: 0x24211c, wall: 0x232320, accent: 0x35322a,
    fog: 0x060605, fogNear: 1.8, fogFar: 18, light: 0xff9a4d, ambient: 0x131210,
    roomLight: [0xff9a4d, 0xff5c3d, 0x7dc9ff, 0xffcf4d, 0xff7a7a],
  },
};

// ---------------- Floor height (stairs / raised platforms / ramps) ----------------
// The engine has no real "standing on top of geometry" physics -- instead each
// level registers rectangular height zones, and the player/zombies simply look
// up "what height should I be at (x,z)" every frame. Flat zones give a raised
// platform; "ramp" zones interpolate between h0 (at the zone's min edge) and h1
// (at its max edge) along X or Z, which reads as a walkable slope.
G.getFloorHeightAt = function (world, x, z) {
  if (!world || !world.heightZones) return 0;
  for (const hz of world.heightZones) {
    if (x < hz.minX || x > hz.maxX || z < hz.minZ || z > hz.maxZ) continue;
    if (hz.ramp) {
      const t = hz.axis === "x" ? (x - hz.minX) / (hz.maxX - hz.minX) : (z - hz.minZ) / (hz.maxZ - hz.minZ);
      return hz.h0 + (hz.h1 - hz.h0) * Math.max(0, Math.min(1, t));
    }
    return hz.height;
  }
  return 0;
};

// Subtle always-on flicker (base intensity plus a slow sine wobble and rare
// dips) so a level's lighting reads as uneven instead of one flat brightness
// everywhere. Called once per frame from the main loop.
G.updateFlickerLights = function (world, tSec) {
  if (!world || !world.lights) return;
  for (const l of world.lights) {
    const u = l.userData;
    if (!u || u.base == null) continue;
    let mult = 0.88 + 0.12 * Math.sin(tSec * u.speed + u.phase);
    if (Math.sin(tSec * 1.7 + u.phase * 3) > 0.985) mult *= 0.35; // occasional dip, like a failing bulb
    l.intensity = u.base * mult;
  }
};

// ---------------- Scene (voxel) builder ----------------
// Layout: a central hub room with four wings (start / east / west / boss),
// each pair joined by a short corridor with a real doorway gap cut into the
// walls (earlier versions built solid, gapless perimeter walls per room --
// zombies ignore collision entirely so they still "reached" the player, but
// the player themselves could never actually walk out of the start room).
// Returns { colliders, spawnPoints, doors, buttons, crates, traps, lights,
// interactables, heightZones, secretZone, spawn, bossRoomCenter }.
G.buildLevelScene = function (scene, level, quality) {
  const pal = G.THEME_PALETTES[level.theme];
  scene.background = new THREE.Color(pal.fog);
  const fogFar = quality === "vlow" ? pal.fogFar * 0.5 : quality === "low" ? pal.fogFar * 0.7 : pal.fogFar;
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, fogFar);

  const ambient = new THREE.AmbientLight(pal.ambient, 0.85);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(pal.light, pal.floor, 0.35);
  scene.add(hemi);

  const world = {
    colliders: [], spawnPoints: [], doors: [], buttons: [], crates: [], traps: [],
    lights: [], interactables: [], heightZones: [], secretZone: null,
  };

  const wallMat = new THREE.MeshLambertMaterial({ color: pal.wall });
  const accentMat = new THREE.MeshLambertMaterial({ color: pal.accent });

  // ---- Floor texture: a tiled canvas pattern (grid lines + random stains/
  // scratches) cloned per room so each can repeat at its own scale, instead of
  // one flat MeshLambertMaterial color -- item 2's "ลายกระเบื้อง / รอยขีดข่วน / คราบสกปรก".
  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = floorCanvas.height = 256;
  const fctx = floorCanvas.getContext("2d");
  const hexColor = (c) => "#" + c.toString(16).padStart(6, "0");
  fctx.fillStyle = hexColor(pal.floor);
  fctx.fillRect(0, 0, 256, 256);
  fctx.strokeStyle = hexColor(pal.floorLine);
  fctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i, 256); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(0, i); fctx.lineTo(256, i); fctx.stroke();
  }
  const stainRng = G.makeRng(1337);
  fctx.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) {
    fctx.fillStyle = stainRng() > 0.5 ? hexColor(pal.floorStain) : hexColor(pal.floorLine);
    const sx = stainRng() * 256, sy = stainRng() * 256, sr = 4 + stainRng() * 14;
    fctx.beginPath(); fctx.ellipse(sx, sy, sr, sr * (0.5 + stainRng() * 0.5), stainRng() * Math.PI, 0, Math.PI * 2); fctx.fill();
  }
  fctx.globalAlpha = 0.5;
  fctx.strokeStyle = hexColor(pal.floorLine);
  for (let i = 0; i < 10; i++) {
    fctx.lineWidth = 1 + stainRng() * 2;
    fctx.beginPath();
    const sx = stainRng() * 256, sy = stainRng() * 256;
    fctx.moveTo(sx, sy); fctx.lineTo(sx + (stainRng() - 0.5) * 60, sy + (stainRng() - 0.5) * 60); fctx.stroke();
  }
  fctx.globalAlpha = 1;
  const floorBaseTex = new THREE.CanvasTexture(floorCanvas);
  const floorSideMat = new THREE.MeshLambertMaterial({ color: pal.floorLine });

  function addFloor(cx, cz, w, d) {
    const tex = floorBaseTex.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
    const topMat = new THREE.MeshLambertMaterial({ map: tex });
    // BoxGeometry face order: [px, nx, py, ny, pz, nz] -- only the top (py) gets the tile texture.
    const mats = [floorSideMat, floorSideMat, topMat, floorSideMat, floorSideMat, floorSideMat];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mats);
    m.position.set(cx, -0.2, cz);
    m.receiveShadow = true;
    scene.add(m);
  }
  function addWallSeg(x, z, w, d, h) {
    h = h || 3.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2, z);
    scene.add(m);
    world.colliders.push(new THREE.Box3().setFromObject(m));
  }
  // Cuts a doorway into a wall run: axis 'x' = wall runs along X at world Z=fixedCoord
  // (wallCenterAlong is its X center); axis 'z' = runs along Z at world X=fixedCoord.
  function addWallWithGap(fixedCoord, wallCenterAlong, totalLen, thickness, gapCenter, gapWidth, axis, height) {
    const half = totalLen / 2;
    const start = wallCenterAlong - half, end = wallCenterAlong + half;
    const gapStart = gapCenter - gapWidth / 2, gapEnd = gapCenter + gapWidth / 2;
    const seg1Len = Math.max(0, gapStart - start);
    const seg2Len = Math.max(0, end - gapEnd);
    if (axis === "x") {
      if (seg1Len > 0.05) addWallSeg(start + seg1Len / 2, fixedCoord, seg1Len, thickness, height);
      if (seg2Len > 0.05) addWallSeg(end - seg2Len / 2, fixedCoord, seg2Len, thickness, height);
    } else {
      if (seg1Len > 0.05) addWallSeg(fixedCoord, start + seg1Len / 2, thickness, seg1Len, height);
      if (seg2Len > 0.05) addWallSeg(fixedCoord, end - seg2Len / 2, thickness, seg2Len, height);
    }
  }
  // gaps: {north,south,east,west}, each null (solid wall) or {center,width}.
  function addRoomWalls(r, gaps) {
    gaps = gaps || {};
    const hw = r.w / 2, hd = r.d / 2;
    if (gaps.west) addWallWithGap(r.cx - hw, r.cz, r.d, 0.4, gaps.west.center, gaps.west.width, "z");
    else addWallSeg(r.cx - hw, r.cz, 0.4, r.d);
    if (gaps.east) addWallWithGap(r.cx + hw, r.cz, r.d, 0.4, gaps.east.center, gaps.east.width, "z");
    else addWallSeg(r.cx + hw, r.cz, 0.4, r.d);
    if (gaps.north) addWallWithGap(r.cz - hd, r.cx, r.w, 0.4, gaps.north.center, gaps.north.width, "x");
    else addWallSeg(r.cx, r.cz - hd, r.w, 0.4);
    if (gaps.south) addWallWithGap(r.cz + hd, r.cx, r.w, 0.4, gaps.south.center, gaps.south.width, "x");
    else addWallSeg(r.cx, r.cz + hd, r.w, 0.4);
  }
  // rx/rz let a prop be tipped/toppled; the collider is always computed AFTER
  // rotation so knocked-over furniture still blocks movement in its real footprint.
  function addProp(x, z, w, h, d, mat, ry, rx, rz, noCollider) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || accentMat);
    m.position.set(x, h / 2, z);
    if (ry) m.rotation.y = ry;
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    scene.add(m);
    if (!noCollider) world.colliders.push(new THREE.Box3().setFromObject(m));
    return m;
  }
  function addLight(x, y, z, color, intensity, speed) {
    const l = new THREE.PointLight(color, intensity, 13);
    l.position.set(x, y, z);
    l.userData.base = intensity; l.userData.phase = G.rng() * 10; l.userData.speed = speed || 1.4;
    scene.add(l);
    world.lights.push(l);
    return l;
  }
  // A box with a simple canvas-drawn texture on its +Z face only (chalkboard
  // scribbles, scoreboards, monitor screens, control-panel readouts, etc).
  function addCanvasBox(x, y, z, w, h, d, drawFn, frameColor, ry) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    drawFn(ctx, canvas);
    const tex = new THREE.CanvasTexture(canvas);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });
    const frameMat = new THREE.MeshLambertMaterial({ color: frameColor != null ? frameColor : 0x222222 });
    const mats = [frameMat, frameMat, frameMat, frameMat, faceMat, frameMat];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  // An unshaded "glowing" sign/light box (exit signs, warning labels, LED strips).
  function addGlowBox(x, y, z, w, h, d, color, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  // Small flat decorative litter (paper/books/debris) that never blocks movement.
  function addDecal(x, z, w, h, d, color, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, h / 2 + 0.001, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  // Decorative box at an explicit height (shelf items, wall trim, hanging
  // cables) -- unlike addDecal this is NOT floor-anchored, and unlike addProp
  // it never blocks movement.
  function addFloatBox(x, y, z, w, h, d, mat, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  // A raised platform: a solid block whose TOP is walkable (registered as a
  // flat height zone), plus a matching ramp on one edge so it's reachable on
  // foot. axis/dir picks which edge the ramp is on ('z'/1 = ramp approaches
  // from +Z growing toward -Z into the platform, etc).
  function addPlatform(cx, cz, w, d, height, mat, rampAxis, rampDir, rampLen) {
    addFloatBox(cx, height / 2, cz, w, height, d, mat || accentMat);
    world.heightZones.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height });
    rampLen = rampLen || 1.6;
    if (rampAxis === "z") {
      const rz = rampDir > 0 ? cz + d / 2 + rampLen / 2 : cz - d / 2 - rampLen / 2;
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 3), 0.15, rampLen), mat || accentMat);
      rampMesh.position.set(cx, height / 2, rz);
      rampMesh.rotation.x = rampDir > 0 ? Math.PI / 10 : -Math.PI / 10;
      scene.add(rampMesh);
      const minZ = rampDir > 0 ? cz + d / 2 : cz + d / 2 + rampLen - rampLen;
      world.heightZones.push(rampDir > 0
        ? { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz + d / 2, maxZ: cz + d / 2 + rampLen, ramp: true, axis: "z", h0: height, h1: 0 }
        : { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2 - rampLen, maxZ: cz - d / 2, ramp: true, axis: "z", h0: 0, h1: height });
    } else {
      const rx = rampDir > 0 ? cx + w / 2 + rampLen / 2 : cx - w / 2 - rampLen / 2;
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.15, Math.min(d, 3)), mat || accentMat);
      rampMesh.position.set(rx, height / 2, cz);
      rampMesh.rotation.z = rampDir > 0 ? -Math.PI / 10 : Math.PI / 10;
      scene.add(rampMesh);
      world.heightZones.push(rampDir > 0
        ? { minX: cx + w / 2, maxX: cx + w / 2 + rampLen, minZ: cz - d / 2, maxZ: cz + d / 2, ramp: true, axis: "x", h0: height, h1: 0 }
        : { minX: cx - w / 2 - rampLen, maxX: cx - w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, ramp: true, axis: "x", h0: 0, h1: height });
    }
  }
  // Decorative crossed-beam barricade (barbed-wire-style fence look) that can
  // later be cleared by a button press -- returns {mesh, collider}.
  function addBarricade(cx, cz, w, mat) {
    const g = new THREE.Group();
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), mat);
    postL.position.set(-w / 2 + 0.15, 0.7, 0); g.add(postL);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), mat);
    postR.position.set(w / 2 - 0.15, 0.7, 0); g.add(postR);
    const barA = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), mat);
    barA.position.set(0, 1.1, 0); barA.rotation.z = 0.18; g.add(barA);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), mat);
    barB.position.set(0, 0.5, 0); barB.rotation.z = -0.18; g.add(barB);
    g.position.set(cx, 0, cz);
    scene.add(g);
    const collider = new THREE.Box3().setFromObject(g);
    world.colliders.push(collider);
    return { mesh: g, collider };
  }

  // ---------------- Room layout (5 rooms, ~1.8x the previous total area) ----------------
  // A: start | B: central hub | C: east wing | D: west wing (behind a barricade
  // the button clears) | E: south/boss wing. Corridors are 4 units wide and
  // every doorway gap matches that width exactly.
  const ROOMS = {
    A: { cx: 0, cz: 0, w: 10, d: 10 },
    B: { cx: 0, cz: -14.5, w: 13, d: 13 },
    C: { cx: 14.5, cz: -14.5, w: 11, d: 11 },
    D: { cx: -14.5, cz: -14.5, w: 10, d: 10 },
    E: { cx: 0, cz: -32, w: 15, d: 15 },
  };
  const DOOR_W = 4;

  Object.values(ROOMS).forEach((r) => addFloor(r.cx, r.cz, r.w, r.d));
  addFloor(0, -6.5, DOOR_W, 3);      // A-B corridor
  addFloor(7.75, -14.5, 3, DOOR_W);  // B-C corridor
  addFloor(-8, -14.5, 3, DOOR_W);    // B-D corridor
  addFloor(0, -22.75, DOOR_W, 3.5);  // B-E corridor

  // addRoomWalls' "north" = the wall at cz-hd (more-negative Z, deeper into
  // the level); "south" = cz+hd (toward the player's start / less negative Z).
  addRoomWalls(ROOMS.A, { north: { center: 0, width: DOOR_W } });
  addRoomWalls(ROOMS.B, {
    south: { center: 0, width: DOOR_W },   // -> A (A sits at less-negative Z)
    east: { center: -14.5, width: DOOR_W }, // -> C
    west: { center: -14.5, width: DOOR_W }, // -> D
    north: { center: 0, width: DOOR_W },   // -> E (E sits at more-negative Z)
  });
  addRoomWalls(ROOMS.C, { west: { center: -14.5, width: DOOR_W } });
  addRoomWalls(ROOMS.D, { east: { center: -14.5, width: DOOR_W } });
  addRoomWalls(ROOMS.E, { south: { center: 0, width: DOOR_W } });

  // Per-room lighting variety (item 2): each wing gets its own color/height/
  // intensity from the theme's roomLight set instead of one uniform light.
  const rl = pal.roomLight;
  addLight(ROOMS.A.cx, 3.1, ROOMS.A.cz, rl[0], 1.3, 1.2);
  addLight(ROOMS.B.cx - 3, 3.4, ROOMS.B.cz - 3, rl[1], 1.1, 1.6);
  addLight(ROOMS.B.cx + 3, 3.4, ROOMS.B.cz + 3, rl[2], 0.9, 2.0);
  addLight(ROOMS.C.cx, 3.2, ROOMS.C.cz, rl[3], 1.2, 1.4);
  addLight(ROOMS.D.cx, 3.0, ROOMS.D.cz, rl[4], 1.0, 1.8);
  addLight(ROOMS.E.cx - 4, 3.5, ROOMS.E.cz - 4, rl[0], 1.4, 1.1);
  addLight(ROOMS.E.cx + 4, 3.5, ROOMS.E.cz + 4, rl[2], 1.0, 2.2);

  // A raised platform in the hub (watch-post / mezzanine / stage depending on
  // theme) -- item 2's "พื้นที่ยกสูง" made genuinely walkable via a height zone + ramp.
  // Placed in the SE corner, clear of all four of the hub's doorway gaps
  // (north/south open at x=[-2,2], east/west open at z=[-16.5,-12.5]) --
  // an earlier position's ramp physically clipped through the north doorway.
  addPlatform(ROOMS.B.cx + 4.3, ROOMS.B.cz - 4.5, 3, 3, 0.4, accentMat, "z", 1, 1.8);
  // A boss podium in the finale room, with ramps on two sides.
  addPlatform(ROOMS.E.cx, ROOMS.E.cz - 2, 5, 5, 0.45, accentMat, "z", -1, 2);

  const theme = { addProp, addLight, addGlowBox, addCanvasBox, addDecal, addFloatBox, addBarricade, addPlatform, ROOMS, pal };
  const decorators = { school: decorateSchool, hospital: decorateHospital, bunker: decorateBunker };
  (decorators[level.theme] || decorateSchool)(theme);

  // ---------------- Landmark decorators (one per theme) ----------------
  // Shared rule (item 4): every recurring object type keeps ONE consistent
  // color set everywhere it appears in a given level (ammo crates are always
  // the same yellow/black, lockers always the same blue, etc).
  function decorateSchool(t) {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    const lockerBlue = new THREE.MeshLambertMaterial({ color: 0x2f6fb0 });
    const lockerBlueDark = new THREE.MeshLambertMaterial({ color: 0x1f4d80 });
    const paperMat = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 });

    // Room A -- classroom: chalkboard + desks/chairs (upright and knocked over).
    addCanvasBox(-1, 2.1, -4.85, 3.2, 1.5, 0.12, (ctx, cv) => {
      ctx.fillStyle = "#1c3b2e"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#eaf2ea"; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(120, 20); ctx.lineTo(90, 70); ctx.stroke();
      ctx.font = "italic 26px Georgia"; ctx.fillStyle = "#eaf2ea"; ctx.globalAlpha = 0.5;
      ctx.fillText("A B C ...", 140, 40); ctx.fillText("help us", 30, 95);
    }, 0x3a2a1a);
    addProp(-2.5, 2, 1.4, 0.9, 0.7, woodMat);
    addProp(2, 2, 1.4, 0.9, 0.7, woodMat);
    addProp(1.6, 3.4, 1.4, 0.7, 0.7, woodMat, 0, 0, Math.PI / 2.1);
    addProp(2.6, 2.2, 0.45, 0.75, 0.45, woodDarkMat, 0, Math.PI / 2.4, 0);
    addProp(-3.6, -0.6, 0.45, 0.75, 0.45, woodDarkMat);
    addProp(-3.6, 1, 0.45, 0.75, 0.45, woodDarkMat);
    addGlowBox(-1.8, 2.9, -4.6, 0.6, 0.28, 0.05, 0x33ff66);
    addGlowBox(1.5, 2.9, 4.6, 0.5, 0.25, 0.05, 0xff3333, Math.PI);
    addDecal(-1.1, 0.4, 0.3, 0.02, 0.4, paperMat, 0.4);
    addDecal(-0.6, 0.9, 0.28, 0.02, 0.36, paperMat, -0.6);
    addDecal(0.4, -1.2, 0.3, 0.02, 0.4, paperMat, 1.1);
    addDecal(3.5, 3.5, 0.3, 0.02, 0.4, paperMat, -0.3);

    // Room B (hub) -- locker-lined hallway + the raised watch-stage platform.
    // Confined to z <= -17.5, well clear of the west doorway's opening
    // (z=[-16.5,-12.5] at x=-6.5) -- an earlier version spanned right across
    // it and made that doorway physically unwalkable.
    for (let i = 0; i < 4; i++) {
      const lz = ROOMS.B.cz - 5.8 + i * 1.0; // -20.3 .. -17.3, inside the room and north of the gap
      addProp(-5.9, lz, 0.5, 2.2, 0.85, i % 2 === 0 ? lockerBlue : lockerBlueDark);
    }
    const doorPivot = new THREE.Group();
    const openLockerZ = ROOMS.B.cz - 5.8 + 1 * 1.0; // matches locker index 1 above
    doorPivot.position.set(-5.65, 1.1, openLockerZ - 0.42);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.0, 0.04), lockerBlueDark);
    doorMesh.position.set(0.21, 0, 0);
    doorPivot.add(doorMesh);
    doorPivot.rotation.y = -1.1;
    scene.add(doorPivot);
    world.colliders.push(new THREE.Box3().setFromObject(doorPivot));
    addCanvasBox(ROOMS.B.cx, 1.1, ROOMS.B.cz - 4.2 - 1.55, 1.6, 0.9, 0.08, (ctx, cv) => {
      ctx.fillStyle = "#2a2410"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = "bold 24px sans-serif"; ctx.fillStyle = "#ffe08a"; ctx.textAlign = "center";
      ctx.fillText("STAGE", 128, 70);
    }, 0x1a1608);

    // Room C (east) -- library nook with the striped bookshelf.
    addProp(ROOMS.C.cx + 2.1, ROOMS.C.cz, 0.4, 2.4, 2.4, woodDarkMat);
    const stripeColors = [0xd94f4f, 0x4f8fd9, 0xe0c23c, 0x4fd97a, 0xb04fd9];
    [0.55, 1.2, 1.85].forEach((y, row) => {
      for (let i = 0; i < 8; i++) {
        const z = ROOMS.C.cz - 0.9 + i * 0.2;
        addFloatBox(ROOMS.C.cx + 1.88, y, z, 0.06, 0.5, 0.15, new THREE.MeshLambertMaterial({ color: stripeColors[(i + row) % stripeColors.length] }));
      }
    });
    addProp(ROOMS.C.cx - 2, ROOMS.C.cz + 3, 1.4, 0.9, 0.9, woodMat);

    // Room D (west, behind the barricade) -- art-room supply nook.
    addProp(ROOMS.D.cx, ROOMS.D.cz - 2, 1.6, 1.1, 0.8, woodDarkMat);
    addDecal(ROOMS.D.cx - 0.6, ROOMS.D.cz - 2, 0.25, 0.02, 0.25, new THREE.MeshLambertMaterial({ color: 0xd94f4f }));
    addDecal(ROOMS.D.cx + 0.6, ROOMS.D.cz - 2, 0.25, 0.02, 0.25, new THREE.MeshLambertMaterial({ color: 0x4f8fd9 }));

    // Room E (final) -- gym scoreboard + the boss podium.
    addCanvasBox(ROOMS.E.cx, 2.6, ROOMS.E.cz - 7.35, 2.4, 1.1, 0.12, (ctx, cv) => {
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center";
      ctx.font = "bold 20px monospace"; ctx.fillStyle = "#ffcc55";
      ctx.fillText("HOME", 64, 30); ctx.fillText("AWAY", 192, 30);
      ctx.font = "bold 52px monospace"; ctx.fillStyle = "#ff3b3b";
      ctx.fillText("00 : 00", 128, 92);
    }, 0x1a1a1a);
  }

  function decorateHospital(t) {
    const bedMat = new THREE.MeshLambertMaterial({ color: 0xd6dede });
    const bedDarkMat = new THREE.MeshLambertMaterial({ color: 0x8a9494 });
    const cabinetMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });
    const crossRed = new THREE.MeshLambertMaterial({ color: 0xd6423c });
    const tankWhite = new THREE.MeshLambertMaterial({ color: 0xe8ece8 });
    const tankGreen = new THREE.MeshLambertMaterial({ color: 0x3d9e5c });

    // Room A -- ward: overturned beds + a reception counter.
    addProp(-2.5, 2, 1.9, 0.7, 0.9, bedMat);
    addProp(-2.5, 2, 0.2, 0.05, 0.9, bedDarkMat, 0, 0, 0, true); // thin blanket decal on the bed, non-blocking
    addProp(2.2, 2.6, 1.9, 0.7, 0.9, bedMat, 0, 0, Math.PI / 2.2); // knocked-over bed
    // Off to the side, well clear of the player spawn point (world.spawn = x:0,z:3)
    // -- an earlier position sat almost exactly on top of it and trapped the
    // player inside its collider from the very first frame.
    addProp(ROOMS.A.cx - 3.5, ROOMS.A.cz + 3.8, 2.4, 1.1, 0.7, cabinetMat); // reception counter
    addFloatBox(ROOMS.A.cx - 3.5, 1.2, ROOMS.A.cz + 3.86, 0.5, 0.5, 0.05, crossRed);
    addGlowBox(-1.8, 2.9, -4.6, 0.6, 0.28, 0.05, 0x33ff66);
    addGlowBox(1.5, 2.9, 4.6, 0.5, 0.25, 0.05, 0xff3333, Math.PI);

    // Room B (hub) -- nurse station on the raised platform + medicine cabinets.
    addCanvasBox(ROOMS.B.cx, 1.3, ROOMS.B.cz - 4.2 - 1.55, 1.6, 1.0, 0.08, (ctx, cv) => {
      ctx.fillStyle = "#04140a"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#7dffc0"; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 256; i += 8) ctx.lineTo(i, 64 + Math.sin(i * 0.15) * 20);
      ctx.stroke();
      ctx.fillStyle = "#7dffc0"; ctx.font = "bold 20px monospace"; ctx.fillText("ICU MONITOR", 20, 110);
    }, 0x0a0a0a);
    for (let i = 0; i < 4; i++) {
      addProp(ROOMS.B.cx + 3 + i * 1.1, ROOMS.B.cz + 5.8, 1.0, 1.6, 0.5, cabinetMat);
      addFloatBox(ROOMS.B.cx + 3 + i * 1.1, 1.4, ROOMS.B.cz + 5.51, 0.4, 0.4, 0.04, crossRed);
    }

    // Room C (east) -- pharmacy / oxygen-tank nook.
    for (let i = 0; i < 3; i++) {
      addProp(ROOMS.C.cx - 3 + i * 1.0, ROOMS.C.cz - 3, 0.5, 1.6, 0.5, tankWhite);
      addFloatBox(ROOMS.C.cx - 3 + i * 1.0, 1.65, ROOMS.C.cz - 3, 0.5, 0.25, 0.5, tankGreen);
    }
    addProp(ROOMS.C.cx + 2, ROOMS.C.cz + 3, 1.6, 1.1, 0.6, cabinetMat);

    // Room D (west, behind the barricade) -- biohazard waste nook.
    const bioMat = new THREE.MeshLambertMaterial({ color: 0xd63c9e });
    addProp(ROOMS.D.cx, ROOMS.D.cz - 2, 0.9, 1.1, 0.9, new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
    addFloatBox(ROOMS.D.cx, 1.2, ROOMS.D.cz - 1.54, 0.4, 0.4, 0.04, bioMat);

    // Room E (final) -- operating theater centerpiece + boss podium.
    addProp(ROOMS.E.cx, ROOMS.E.cz - 2, 2.0, 0.9, 1.0, bedMat, 0, 0, 0, true);
    addGlowBox(ROOMS.E.cx, 3.2, ROOMS.E.cz - 2, 0.8, 0.15, 0.8, 0xbfffe0);
  }

  function decorateBunker(t) {
    const crateYellow = new THREE.MeshLambertMaterial({ color: 0xd6b23c });
    const crateStripe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const crateOlive = new THREE.MeshLambertMaterial({ color: 0x545c3a });
    const rackMat = new THREE.MeshLambertMaterial({ color: 0x2e2e2c });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x4a4a46 });

    function ammoCrate(x, z) {
      addProp(x, z, 0.9, 0.6, 0.9, crateYellow);
      addFloatBox(x, 0.61, z, 0.9, 0.05, 0.2, crateStripe);
      addFloatBox(x, 0.61, z, 0.2, 0.05, 0.9, crateStripe);
    }
    // Room A -- supply nook.
    ammoCrate(-2.5, 2);
    ammoCrate(-2.5, 2.9);
    addProp(2, 2.2, 1.4, 0.8, 0.9, crateOlive);
    addGlowBox(-1.8, 2.9, -4.6, 0.6, 0.28, 0.05, 0xffcc33);
    addGlowBox(1.5, 2.9, 4.6, 0.5, 0.25, 0.05, 0xff5533, Math.PI);

    // Room B (hub) -- watchtower platform + control panel.
    addCanvasBox(ROOMS.B.cx, 1.3, ROOMS.B.cz - 4.2 - 1.55, 1.6, 1.0, 0.08, (ctx, cv) => {
      ctx.fillStyle = "#1a1512"; ctx.fillRect(0, 0, cv.width, cv.height);
      const colors = ["#ff5c3d", "#ffcf4d", "#7dc9ff", "#4dff88"];
      for (let i = 0; i < 12; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(14 + (i % 6) * 38, 20 + Math.floor(i / 6) * 40, 22, 22); }
    }, 0x0a0908);
    for (let i = 0; i < 3; i++) ammoCrate(ROOMS.B.cx + 3.5, ROOMS.B.cz + 4.5 + i * 0.75);
    addGlowBox(ROOMS.B.cx - 5.5, 3.0, ROOMS.B.cz, 0.5, 0.5, 0.06, 0xffcc33); // hazard sign

    // Room C (east) -- weapon rack.
    for (let i = 0; i < 4; i++) {
      addFloatBox(ROOMS.C.cx - 3 + i * 0.5, 1.6, ROOMS.C.cz - 3, 0.06, 1.0, 0.06, gunMat);
    }
    addProp(ROOMS.C.cx - 1.5, ROOMS.C.cz - 3, 1.6, 0.15, 0.4, rackMat, 0, 0, 0, true);
    ammoCrate(ROOMS.C.cx + 2, ROOMS.C.cz + 3);
    ammoCrate(ROOMS.C.cx + 2.9, ROOMS.C.cz + 3);

    // Room D (west, behind the barricade) -- barbed-wire choke + sandbags.
    const sandbagMat = new THREE.MeshLambertMaterial({ color: 0xa89468 });
    for (let i = 0; i < 3; i++) addProp(ROOMS.D.cx - 1 + i * 0.85, ROOMS.D.cz - 2, 0.8, 0.4, 0.5, sandbagMat);
    addGlowBox(ROOMS.D.cx, 2.6, ROOMS.D.cz - 4.6, 0.5, 0.5, 0.06, 0xffcc33);

    // Room E (final) -- reinforced chamber, sandbag cover, boss podium.
    for (let i = 0; i < 3; i++) addProp(ROOMS.E.cx - 4 + i * 0.85, ROOMS.E.cz + 3, 0.8, 0.4, 0.5, sandbagMat);
    for (let i = 0; i < 3; i++) addProp(ROOMS.E.cx + 3 + i * 0.85, ROOMS.E.cz + 3, 0.8, 0.4, 0.5, sandbagMat);
  }

  // ---------------- Spawn points (spread across all 5 rooms) ----------------
  world.spawnPoints = [
    { pos: new THREE.Vector3(-3.5, 0, 3.5), types: ["normal"] },
    { pos: new THREE.Vector3(3.5, 0, 3.5), types: ["normal"] },
    { pos: new THREE.Vector3(-5, 0, ROOMS.B.cz - 5), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(5, 0, ROOMS.B.cz - 5), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(-5, 0, ROOMS.B.cz + 5), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(5, 0, ROOMS.B.cz + 5), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(ROOMS.C.cx + 3, 0, ROOMS.C.cz - 3), types: ["fast"] },
    { pos: new THREE.Vector3(ROOMS.C.cx - 3, 0, ROOMS.C.cz + 3), types: ["normal"] },
    { pos: new THREE.Vector3(ROOMS.D.cx, 0, ROOMS.D.cz - 3), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(ROOMS.E.cx - 5, 0, ROOMS.E.cz - 5), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(ROOMS.E.cx + 5, 0, ROOMS.E.cz - 5), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(ROOMS.E.cx, 0, ROOMS.E.cz - 5), types: ["boss"] },
  ].map((sp) => Object.assign(sp, { cooldown: 0 }));

  // ---------------- Interactions ----------------
  // Word-locked door blocking a direct look at the east wing's landmark.
  const lockedDoor = addProp(ROOMS.C.cx - 3.3, ROOMS.C.cz - 5.4, 0.3, 3, 3.4, new THREE.MeshLambertMaterial({ color: 0x995533 }));
  // `collider` is captured so opening the door can remove it from world.colliders --
  // hiding the mesh alone (the previous behavior) left an invisible wall in place.
  world.doors.push({ mesh: lockedDoor, locked: true, kind: "word", opened: false, collider: world.colliders[world.colliders.length - 1] });
  world.interactables.push({ mesh: lockedDoor, kind: "door", ref: world.doors[world.doors.length - 1] });

  // Button (in the east wing) that clears the barricade blocking the west wing.
  const buttonMesh = addProp(ROOMS.C.cx + 4.5, ROOMS.C.cz - 4.5, 0.3, 0.3, 0.3, new THREE.MeshLambertMaterial({ color: 0xff4444 }), 0, 0, 0, true);
  world.buttons.push({ mesh: buttonMesh, pressed: false });
  world.interactables.push({ mesh: buttonMesh, kind: "button", ref: world.buttons[world.buttons.length - 1] });

  const barricade = addBarricade(-8, ROOMS.B.cz, 3.4, new THREE.MeshLambertMaterial({ color: 0x555550 }));
  world.secretZone = {
    center: new THREE.Vector3(ROOMS.D.cx, 0, ROOMS.D.cz), radius: 5, unlocked: false,
    barricadeMesh: barricade.mesh, barricadeCollider: barricade.collider,
  };

  // A lootable crate (word-locked) in the west wing -- the payoff for clearing the barricade.
  const crateMesh = addProp(ROOMS.D.cx, ROOMS.D.cz + 3, 0.8, 0.8, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
  world.crates.push({ mesh: crateMesh, opened: false, locked: true });
  world.interactables.push({ mesh: crateMesh, kind: "crate", ref: world.crates[world.crates.length - 1] });

  // A word-locked trap (laser wall) in the corridor to the final room.
  const trapMesh = addProp(0, ROOMS.E.cz + 8.7, DOOR_W - 0.4, 2.8, 0.15, new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.55 }));
  // This laser wall fully blocks the only corridor to the boss room via its
  // collider. There was previously no way to interact with a "trap" at all
  // (doInteract had no case for it) -- meaning the corridor was permanently
  // impassable on foot. `collider` is captured so solving it can remove the
  // block, same fix as the door above.
  world.traps.push({ mesh: trapMesh, active: true, damage: 12, cooldown: 0, collider: world.colliders[world.colliders.length - 1] });
  world.interactables.push({ mesh: trapMesh, kind: "trap", ref: world.traps[world.traps.length - 1] });

  world.spawn = { x: 0, z: 3 };
  world.bossRoomCenter = new THREE.Vector3(ROOMS.E.cx, 0, ROOMS.E.cz - 2);

  return world;
};
