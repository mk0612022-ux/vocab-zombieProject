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
  // Layout redesign item 4: shifted from a wood/olive-brown school to a
  // modern institutional building -- pale concrete/quartz walls and floor,
  // red brick as the accent color, cooler quartz-white main light. Still
  // dim/desaturated enough (not literally white) to keep the horror mood.
  school: {
    floor: 0x4a4740, floorLine: 0x2e2c27, floorStain: 0x3d3624, wall: 0x8a8578, accent: 0x8a3a2e,
    fog: 0x181814, fogNear: 3, fogFar: 30, light: 0xdadad0, ambient: 0x3a3a34,
    roomLight: [0xdadad0, 0xcfe8ff, 0xe8dca0, 0x8a3a2e, 0xffe08a],
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

// Slowly drifts the scene fog's near/far planes so fog reads as a moving
// haze rather than a static render trick. Anchored to fogBase so quality
// changes (which rewrite fog.far) keep drifting around the new baseline.
G.updateDriftingFog = function (scene, world, tSec) {
  if (!scene || !scene.fog || !world || !world.fogBase) return;
  const driftFar = Math.sin(tSec * 0.11) * (world.fogBase.far * 0.1);
  const driftNear = Math.sin(tSec * 0.16 + 1.7) * (world.fogBase.near * 0.2);
  scene.fog.far = world.fogBase.far + driftFar;
  scene.fog.near = Math.max(0.4, world.fogBase.near + driftNear);
};

// Periodic electrical-spark bursts at registered world.sparkPoints (frayed
// wires / damaged fixtures). Uses a one-shot particle+light burst like
// G.spawnHitParticles, driven off real elapsed time so it's frame-rate independent.
G.updateSparks = function (scene, world, dt) {
  if (!scene || !world || !world.sparkPoints || !world.sparkPoints.length) return;
  for (const sp of world.sparkPoints) {
    sp.timer -= dt;
    if (sp.timer <= 0) {
      sp.timer = 2 + G.rng() * 3.5;
      G.spawnSparkBurst(scene, sp);
    }
  }
};

// ---------------- Room-level pathfinding (waypoint graph) ----------------
// Which region (room/corridor) contains a point. Falls back to the nearest
// region's center if the point is in a gap (e.g. momentarily inside wall
// thickness) so callers always get a usable answer.
G.getRegionAt = function (world, x, z) {
  if (!world || !world.regions) return null;
  for (const r of world.regions) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r.name;
  }
  let best = null, bestDist = Infinity;
  for (const r of world.regions) {
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (d < bestDist) { bestDist = d; best = r.name; }
  }
  return best;
};

// BFS over the (tiny, tree-shaped) waypoint graph -- returns an array of node
// names from just-after `from` up to and including `to` (empty if from===to).
G.findPath = function (world, from, to) {
  if (!world || !world.waypointEdges || from === to) return [];
  const edges = world.waypointEdges;
  const queue = [from];
  const cameFrom = { [from]: null };
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const next of edges[cur] || []) {
      if (!(next in cameFrom)) { cameFrom[next] = cur; queue.push(next); }
    }
  }
  if (!(to in cameFrom)) return [];
  const path = [];
  let node = to;
  while (node !== from) { path.unshift(node); node = cameFrom[node]; }
  return path;
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
    fogBase: { near: pal.fogNear, far: fogFar }, sparkPoints: [],
    roomDoors: [], mysteryBox: null,
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

  function addFloor(cx, cz, w, d, baseY) {
    baseY = baseY || 0; // lets an upper floor (category E3) reuse the same tiled-texture floor
    const tex = floorBaseTex.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
    const topMat = new THREE.MeshLambertMaterial({ map: tex });
    // BoxGeometry face order: [px, nx, py, ny, pz, nz] -- only the top (py) gets the tile texture.
    const mats = [floorSideMat, floorSideMat, topMat, floorSideMat, floorSideMat, floorSideMat];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mats);
    m.position.set(cx, baseY - 0.2, cz);
    m.receiveShadow = true;
    scene.add(m);
  }
  // Every room/corridor previously had open sky above the walls (3.4 tall) --
  // no ceiling at all, which also let light values read as if leaking upward
  // without bound. A flat ceiling slab closes each space and gives lights a
  // surface to bounce/occlude against.
  // Item D2: the school's ceilings are white so the interior reads bright and
  // legible against its colorful walls/props; the other themes keep the old
  // wall-colored ceiling that suits their darker mood.
  const ceilingMat = new THREE.MeshLambertMaterial({ color: level.theme === "school" ? 0xe8e8e4 : pal.wall });
  function addCeiling(cx, cz, w, d, baseY) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), ceilingMat);
    m.position.set(cx, (baseY || 0) + 3.55, cz);
    scene.add(m);
  }
  function addWallSeg(x, z, w, d, h, baseY) {
    h = h || 3.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, (baseY || 0) + h / 2, z);
    scene.add(m);
    world.colliders.push(new THREE.Box3().setFromObject(m));
  }
  // Cuts a doorway into a wall run: axis 'x' = wall runs along X at world Z=fixedCoord
  // (wallCenterAlong is its X center); axis 'z' = runs along Z at world X=fixedCoord.
  function addWallWithGap(fixedCoord, wallCenterAlong, totalLen, thickness, gapCenter, gapWidth, axis, height, baseY) {
    const half = totalLen / 2;
    const start = wallCenterAlong - half, end = wallCenterAlong + half;
    const gapStart = gapCenter - gapWidth / 2, gapEnd = gapCenter + gapWidth / 2;
    const seg1Len = Math.max(0, gapStart - start);
    const seg2Len = Math.max(0, end - gapEnd);
    if (axis === "x") {
      if (seg1Len > 0.05) addWallSeg(start + seg1Len / 2, fixedCoord, seg1Len, thickness, height, baseY);
      if (seg2Len > 0.05) addWallSeg(end - seg2Len / 2, fixedCoord, seg2Len, thickness, height, baseY);
    } else {
      if (seg1Len > 0.05) addWallSeg(fixedCoord, start + seg1Len / 2, thickness, seg1Len, height, baseY);
      if (seg2Len > 0.05) addWallSeg(fixedCoord, end - seg2Len / 2, thickness, seg2Len, height, baseY);
    }
  }
  // gaps: {north,south,east,west}, each null (solid wall) or {center,width}.
  function addRoomWalls(r, gaps, height, baseY) {
    gaps = gaps || {};
    const hw = r.w / 2, hd = r.d / 2;
    if (gaps.west) addWallWithGap(r.cx - hw, r.cz, r.d, 0.4, gaps.west.center, gaps.west.width, "z", height, baseY);
    else addWallSeg(r.cx - hw, r.cz, 0.4, r.d, height, baseY);
    if (gaps.east) addWallWithGap(r.cx + hw, r.cz, r.d, 0.4, gaps.east.center, gaps.east.width, "z", height, baseY);
    else addWallSeg(r.cx + hw, r.cz, 0.4, r.d, height, baseY);
    if (gaps.north) addWallWithGap(r.cz - hd, r.cx, r.w, 0.4, gaps.north.center, gaps.north.width, "x", height, baseY);
    else addWallSeg(r.cx, r.cz - hd, r.w, 0.4, height, baseY);
    if (gaps.south) addWallWithGap(r.cz + hd, r.cx, r.w, 0.4, gaps.south.center, gaps.south.width, "x", height, baseY);
    else addWallSeg(r.cx, r.cz + hd, r.w, 0.4, height, baseY);
  }
  // Category B: a hinged door filling a doorway gap. axis "x" = the opening
  // runs along X (so the panel blocks Z travel), axis "z" = the reverse.
  // Doors start closed (so you never know what's behind one until you open
  // it); a zombie held up against a closed door bashes it open after a couple
  // of seconds, which is what keeps a fully-shut map from soft-locking a wave.
  const doorPanelMat = new THREE.MeshLambertMaterial({ color: level.theme === "school" ? 0x9c4a33 : pal.accent });
  const doorTrimMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
  function addRoomDoor(cx, cz, width, axis, baseY) {
    baseY = baseY || 0;
    const h = 2.9, t = 0.16, half = width / 2;
    const pivot = new THREE.Group();
    pivot.position.set(axis === "x" ? cx - half : cx, baseY, axis === "x" ? cz : cz - half);
    const panel = new THREE.Mesh(
      axis === "x" ? new THREE.BoxGeometry(width, h, t) : new THREE.BoxGeometry(t, h, width), doorPanelMat);
    panel.position.set(axis === "x" ? half : 0, h / 2, axis === "x" ? 0 : half);
    pivot.add(panel);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), doorTrimMat);
    handle.position.set(axis === "x" ? width - 0.25 : 0.13, h * 0.45, axis === "x" ? 0.13 : width - 0.25);
    pivot.add(handle);
    scene.add(pivot);
    const collider = new THREE.Box3(
      new THREE.Vector3(axis === "x" ? cx - half : cx - 0.3, baseY, axis === "x" ? cz - 0.3 : cz - half),
      new THREE.Vector3(axis === "x" ? cx + half : cx + 0.3, baseY + h, axis === "x" ? cz + 0.3 : cz + half));
    const ref = { mesh: pivot, open: false, collider, axis, bashTimer: 0, x: cx, z: cz, baseY, animT: 1, fromRot: 0, toRot: 0 };
    world.colliders.push(collider);
    world.roomDoors.push(ref);
    world.interactables.push({ mesh: pivot, kind: "roomdoor", ref });
    return ref;
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

  // A fallen body lying on the floor -- torso + head + a limb splayed out,
  // plus a dark blood pool underneath. Never blocks movement (you can step
  // over a corpse), so it's built with noCollider-equivalent placement: added
  // directly to the scene rather than through addProp.
  function addCorpse(x, z, ry, clothColor) {
    const clothMat = new THREE.MeshLambertMaterial({ color: clothColor });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.28), clothMat);
    torso.position.set(0, 0.08, 0); g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), skinMat);
    head.position.set(0.42, 0.08, 0); g.add(head);
    const armOut = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.1), skinMat);
    armOut.position.set(-0.1, 0.07, 0.22); armOut.rotation.y = 0.3; g.add(armOut);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.22), clothMat);
    legs.position.set(-0.5, 0.07, 0.04); g.add(legs);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.6), new THREE.MeshBasicMaterial({ color: 0x4a0a0a, transparent: true, opacity: 0.8 }));
    pool.position.set(0, 0.005, 0); g.add(pool);
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    scene.add(g);
  }
  // A flat blood stain/scuff decal on the floor -- purely cosmetic.
  function addBloodStain(x, z, size, ry) {
    const stain = new THREE.Mesh(new THREE.BoxGeometry(size, 0.012, size * (0.6 + G.rng() * 0.4)), new THREE.MeshBasicMaterial({ color: 0x5a0e0e, transparent: true, opacity: 0.75 }));
    stain.position.set(x, 0.006, z);
    if (ry) stain.rotation.y = ry;
    scene.add(stain);
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

  Object.values(ROOMS).forEach((r) => {
    addFloor(r.cx, r.cz, r.w, r.d);
    // School's room E (layout redesign item 2) gets its own taller enclosure
    // + custom ceiling built in decorateSchool instead of the standard one,
    // to read as an open double-height hall with a mezzanine.
    if (!(level.theme === "school" && r === ROOMS.E)) addCeiling(r.cx, r.cz, r.w, r.d);
  });
  addFloor(0, -6.5, DOOR_W, 3);      addCeiling(0, -6.5, DOOR_W, 3);      // A-B corridor
  addFloor(7.75, -14.5, 3, DOOR_W);  addCeiling(7.75, -14.5, 3, DOOR_W);  // B-C corridor
  addFloor(-8, -14.5, 3, DOOR_W);    addCeiling(-8, -14.5, 3, DOOR_W);    // B-D corridor
  addFloor(0, -22.75, DOOR_W, 3.5);  addCeiling(0, -22.75, DOOR_W, 3.5);  // B-E corridor
  // A1 fix: the four connecting corridors had floors and ceilings but NO side
  // walls, so stepping through any room's doorway and then sideways walked
  // straight out of the building into empty space. Each corridor now has a
  // wall down both long sides.
  addWallSeg(-DOOR_W / 2, -6.5, 0.4, 3);      addWallSeg(DOOR_W / 2, -6.5, 0.4, 3);      // A-B
  addWallSeg(7.75, -14.5 - DOOR_W / 2, 3, 0.4); addWallSeg(7.75, -14.5 + DOOR_W / 2, 3, 0.4); // B-C
  addWallSeg(-8, -14.5 - DOOR_W / 2, 3, 0.4);   addWallSeg(-8, -14.5 + DOOR_W / 2, 3, 0.4);   // B-D
  addWallSeg(-DOOR_W / 2, -22.75, 0.4, 3.5);  addWallSeg(DOOR_W / 2, -22.75, 0.4, 3.5);  // B-E

  // addRoomWalls' "north" = the wall at cz-hd (more-negative Z, deeper into
  // the level); "south" = cz+hd (toward the player's start / less negative Z).
  // School only: room A's east wall gets a gap leading to the annex wing
  // (layout redesign item 1).
  const aGaps = { north: { center: 0, width: DOOR_W } };
  if (level.theme === "school") {
    aGaps.east = { center: 0, width: 3 };
    aGaps.west = { center: 0, width: 3 };  // -> music room (item D1)
    aGaps.south = { center: 0, width: 3 }; // -> cafeteria (item D1)
  }
  addRoomWalls(ROOMS.A, aGaps);
  addRoomWalls(ROOMS.B, {
    south: { center: 0, width: DOOR_W },   // -> A (A sits at less-negative Z)
    east: { center: -14.5, width: DOOR_W }, // -> C
    west: { center: -14.5, width: DOOR_W }, // -> D
    north: { center: 0, width: DOOR_W },   // -> E (E sits at more-negative Z)
  });
  // Hospital and School: room C's east wall gets a second gap for the
  // staircase up to their 2nd floor. School also gets a north gap for a
  // small restroom nook (layout redesign item 3).
  const cGaps = { west: { center: -14.5, width: DOOR_W } };
  if (level.theme === "hospital" || level.theme === "school") cGaps.east = { center: -14.5, width: 3 };
  if (level.theme === "school") cGaps.north = { center: 14.5, width: 2 };
  addRoomWalls(ROOMS.C, cGaps);
  // School: room D gets a south gap for a small supply-closet nook (item 3).
  const dGaps = { east: { center: -14.5, width: DOOR_W } };
  if (level.theme === "school") {
    dGaps.south = { center: -14.5, width: 2 };
    dGaps.north = { center: -13, width: 2.5 }; // -> boiler room (item D1)
  }
  addRoomWalls(ROOMS.D, dGaps);
  const eGaps = { south: { center: 0, width: DOOR_W } };
  if (level.theme === "school") eGaps.west = { center: -33, width: 2.5 }; // -> sports store (item D1)
  addRoomWalls(ROOMS.E, eGaps);

  // Category B: every room-to-room opening now carries a real hinged door.
  // One door per connection (placed at the room-side end of each corridor).
  addRoomDoor(0, -5, DOOR_W, "x");        // A <-> A-B corridor
  addRoomDoor(0, -8, DOOR_W, "x");        // A-B corridor <-> B
  addRoomDoor(6.5, -14.5, DOOR_W, "z");   // B <-> B-C corridor
  addRoomDoor(9, -14.5, DOOR_W, "z");     // B-C corridor <-> C
  addRoomDoor(-6.5, -14.5, DOOR_W, "z");  // B <-> B-D corridor
  addRoomDoor(-9.5, -14.5, DOOR_W, "z");  // B-D corridor <-> D
  addRoomDoor(0, -21, DOOR_W, "x");       // B <-> B-E corridor
  addRoomDoor(0, -24.5, DOOR_W, "x");     // B-E corridor <-> E
  if (level.theme === "school") {
    addRoomDoor(14.5, -20, 2, "x");       // C <-> restroom
    addRoomDoor(-14.5, -9.5, 2, "x");     // D <-> supply closet
  }

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

  // ---------------- Waypoint graph (room-level pathfinding) ----------------
  // Zombies used to walk straight at the player regardless of walls (they
  // don't test world.colliders at all -- cheap, but meant they'd cut through
  // solid walls between rooms). This gives each zombie a room-to-room route:
  // "regions" are AABBs matching the rooms/corridors above, "waypointNodes"
  // are their centers, and "waypointEdges" mirrors the actual doorway
  // topology, so a BFS route only ever crosses connections that really exist.
  // Built BEFORE the theme decorators run (below) since decorateHospital
  // extends this graph with its 2nd-floor region/nodes/edges.
  world.regions = [
    { name: "A", minX: ROOMS.A.cx - ROOMS.A.w / 2, maxX: ROOMS.A.cx + ROOMS.A.w / 2, minZ: ROOMS.A.cz - ROOMS.A.d / 2, maxZ: ROOMS.A.cz + ROOMS.A.d / 2 },
    { name: "AB", minX: -DOOR_W / 2, maxX: DOOR_W / 2, minZ: -8, maxZ: -5 },
    { name: "B", minX: ROOMS.B.cx - ROOMS.B.w / 2, maxX: ROOMS.B.cx + ROOMS.B.w / 2, minZ: ROOMS.B.cz - ROOMS.B.d / 2, maxZ: ROOMS.B.cz + ROOMS.B.d / 2 },
    { name: "BC", minX: 6.5, maxX: 9, minZ: -16.5, maxZ: -12.5 },
    { name: "C", minX: ROOMS.C.cx - ROOMS.C.w / 2, maxX: ROOMS.C.cx + ROOMS.C.w / 2, minZ: ROOMS.C.cz - ROOMS.C.d / 2, maxZ: ROOMS.C.cz + ROOMS.C.d / 2 },
    { name: "BD", minX: -9.5, maxX: -6.5, minZ: -16.5, maxZ: -12.5 },
    { name: "D", minX: ROOMS.D.cx - ROOMS.D.w / 2, maxX: ROOMS.D.cx + ROOMS.D.w / 2, minZ: ROOMS.D.cz - ROOMS.D.d / 2, maxZ: ROOMS.D.cz + ROOMS.D.d / 2 },
    { name: "BE", minX: -DOOR_W / 2, maxX: DOOR_W / 2, minZ: -24.5, maxZ: -21 },
    { name: "E", minX: ROOMS.E.cx - ROOMS.E.w / 2, maxX: ROOMS.E.cx + ROOMS.E.w / 2, minZ: ROOMS.E.cz - ROOMS.E.d / 2, maxZ: ROOMS.E.cz + ROOMS.E.d / 2 },
  ];
  world.waypointNodes = {
    A: { x: ROOMS.A.cx, z: ROOMS.A.cz }, AB: { x: 0, z: -6.5 },
    B: { x: ROOMS.B.cx, z: ROOMS.B.cz }, BC: { x: 7.75, z: -14.5 },
    C: { x: ROOMS.C.cx, z: ROOMS.C.cz }, BD: { x: -8, z: -14.5 },
    D: { x: ROOMS.D.cx, z: ROOMS.D.cz }, BE: { x: 0, z: -22.75 },
    E: { x: ROOMS.E.cx, z: ROOMS.E.cz - 2 },
  };
  world.waypointEdges = {
    A: ["AB"], AB: ["A", "B"], B: ["AB", "BC", "BD", "BE"],
    BC: ["B", "C"], C: ["BC"], BD: ["B", "D"], D: ["BD"], BE: ["B", "E"], E: ["BE"],
  };

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
    // Category F (this round): the school theme's wall/floor/wood tones are
    // all muted olive-brown, so a few saturated accent colors are reused
    // across lockers/posters/backpacks to keep the level from reading flat.
    const lockerColors = [0x2f6fb0, 0xc9433c, 0xd9b23c, 0x3f9e5c].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    const posterColors = [0xd94f4f, 0x4f8fd9, 0xe0c23c, 0x4fd97a, 0xd97ad9];
    // Layout redesign item 4: literal brick + glass focal points, not just a
    // palette shift -- patches of exposed brick where the concrete has
    // crumbled, and glass partitions reading as "modern institutional".
    const brickMat = new THREE.MeshLambertMaterial({ color: 0x8a3a2e });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.32 });
    function addExposedBrick(x, y, z, w, h, ry) {
      addFloatBox(x, y, z, w, h, 0.06, brickMat, ry);
    }
    function addGlassPanel(x, y, z, w, h, ry) {
      addFloatBox(x, y, z, w, h, 0.04, glassMat, ry);
    }
    // Floor hatch (layout redesign item 5): word-locked, hinges open flat on
    // the ground via game.js's animateHatchOpen, revealing a bonus drop.
    const hatchMat = new THREE.MeshLambertMaterial({ color: 0x4a4740 });
    function addHatch(x, z, dropKind) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.05, z - 0.55);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.1), hatchMat);
      panel.position.set(0, 0, 0.55);
      pivot.add(panel);
      scene.add(pivot);
      // Hazard-yellow frame outline so it reads as interactive, same visual
      // language as the level's word-locked doors.
      addGlowBox(x, 0.09, z - 0.55, 1.15, 0.02, 0.06, 0xffcc33);
      addGlowBox(x, 0.09, z + 0.55, 1.15, 0.02, 0.06, 0xffcc33);
      addGlowBox(x - 0.55, 0.09, z, 0.06, 0.02, 1.15, 0xffcc33);
      addGlowBox(x + 0.55, 0.09, z, 0.06, 0.02, 1.15, 0xffcc33);
      world.doors.push({ mesh: pivot, locked: true, kind: "hatch", opened: false, dropKind });
      world.interactables.push({ mesh: pivot, kind: "hatch", ref: world.doors[world.doors.length - 1] });
    }

    // Room A -- classroom: chalkboard + desks/chairs (upright and knocked over).
    addCanvasBox(-1, 2.1, -4.85, 3.2, 1.5, 0.12, (ctx, cv) => {
      ctx.fillStyle = "#1c3b2e"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#eaf2ea"; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(120, 20); ctx.lineTo(90, 70); ctx.stroke();
      ctx.font = "italic 26px Georgia"; ctx.fillStyle = "#eaf2ea"; ctx.globalAlpha = 0.5;
      ctx.fillText("A B C ...", 140, 40);
      // hand-scrawled blood warning replaces the old plain "help us" text
      ctx.globalAlpha = 0.85; ctx.fillStyle = "#7a1414"; ctx.font = "bold italic 30px Georgia";
      ctx.fillText("THEY'RE INSIDE", 20, 95);
      ctx.globalAlpha = 0.6; ctx.strokeStyle = "#8a1a1a"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(15, 105); ctx.lineTo(45, 118); ctx.lineTo(20, 122); ctx.stroke(); // drip smear
    }, 0x3a2a1a);
    addBloodStain(-1, -3.7, 0.5, 0.3); // pooled beneath the chalkboard
    addProp(-2.5, 2, 1.4, 0.9, 0.7, woodMat);
    addProp(2, 2, 1.4, 0.9, 0.7, woodMat);
    addProp(1.6, 3.4, 1.4, 0.7, 0.7, woodMat, 0, 0, Math.PI / 2.1);
    addProp(2.6, 2.2, 0.45, 0.75, 0.45, woodDarkMat, 0, Math.PI / 2.4, 0);
    addProp(-3.6, -0.6, 0.45, 0.75, 0.45, woodDarkMat);
    addProp(-3.6, 1, 0.45, 0.75, 0.45, woodDarkMat);
    addGlowBox(-1.8, 2.9, -4.6, 0.6, 0.28, 0.05, 0x33ff66);
    addGlowBox(1.5, 2.9, 4.6, 0.5, 0.25, 0.05, 0xff3333, Math.PI);
    addExposedBrick(-4.9, 1.5, 2, 1.5, 2, Math.PI / 2); // crumbled concrete revealing brick underneath
    addDecal(-1.1, 0.4, 0.3, 0.02, 0.4, paperMat, 0.4);
    addDecal(-0.6, 0.9, 0.28, 0.02, 0.36, paperMat, -0.6);
    addDecal(0.4, -1.2, 0.3, 0.02, 0.4, paperMat, 1.1);
    addDecal(3.5, 3.5, 0.3, 0.02, 0.4, paperMat, -0.3);
    // Colorful torn posters/bulletin-board pages scattered on the floor --
    // a plain cream color everywhere read as flat, these pop against the
    // olive-brown classroom tones.
    addDecal(-2.8, 3.2, 0.26, 0.02, 0.34, new THREE.MeshLambertMaterial({ color: posterColors[0] }), 0.8);
    addDecal(2.9, -0.8, 0.28, 0.02, 0.3, new THREE.MeshLambertMaterial({ color: posterColors[1] }), -0.4);
    addDecal(-0.2, 3.9, 0.24, 0.02, 0.32, new THREE.MeshLambertMaterial({ color: posterColors[2] }), 0.2);

    // Room B (hub) -- locker-lined hallway + the raised watch-stage platform.
    // Confined to z <= -17.5, well clear of the west doorway's opening
    // (z=[-16.5,-12.5] at x=-6.5) -- an earlier version spanned right across
    // it and made that doorway physically unwalkable.
    const lockerMeshes = [];
    for (let i = 0; i < 4; i++) {
      const lz = ROOMS.B.cz - 5.8 + i * 1.0; // -20.3 .. -17.3, inside the room and north of the gap
      lockerMeshes.push(addProp(-5.9, lz, 0.5, 2.2, 0.85, lockerColors[i % lockerColors.length]));
    }
    // A couple of the lockers are actually openable loot containers (layout
    // redesign item 3), reusing the existing static-crate interaction --
    // press E to pop them open just like a crate.
    [0, 2].forEach((i) => {
      world.crates.push({ mesh: lockerMeshes[i], opened: false, locked: false });
      world.interactables.push({ mesh: lockerMeshes[i], kind: "crate", ref: world.crates[world.crates.length - 1] });
    });
    // A couple of colorful dropped backpacks along the locker row.
    addDecal(-5.3, ROOMS.B.cz - 5.5, 0.3, 0.16, 0.22, new THREE.MeshLambertMaterial({ color: 0xc9433c }), 0.5);
    addDecal(-5.2, ROOMS.B.cz - 18.3, 0.3, 0.16, 0.22, new THREE.MeshLambertMaterial({ color: 0xd9b23c }), -0.3);
    addHatch(ROOMS.B.cx + 3, ROOMS.B.cz + 2, "crate");
    const doorPivot = new THREE.Group();
    const openLockerZ = ROOMS.B.cz - 5.8 + 1 * 1.0; // matches locker index 1 above
    doorPivot.position.set(-5.65, 1.1, openLockerZ - 0.42);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.0, 0.04), lockerColors[1 % lockerColors.length]);
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
    addCorpse(2, ROOMS.B.cz + 4, 0.6, 0x3a5c8a); // fallen student near the hub entrance
    addBloodStain(2, ROOMS.B.cz + 4, 0.9, 0.6);
    addBloodStain(-2.5, ROOMS.B.cz - 3, 0.6, 1.1);

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
    // A modern glass partition standing between the reading area and the
    // rest of the library -- literal glass accent, not just a palette tint.
    addGlassPanel(ROOMS.C.cx - 2.8, 1.4, ROOMS.C.cz + 0.5, 2.0, 2.4, 0.3);
    addExposedBrick(ROOMS.C.cx + 5.4, 1.5, ROOMS.C.cz - 2, 1.2, 2, Math.PI / 2);

    // Room D (west, behind the barricade) -- art-room supply nook.
    addProp(ROOMS.D.cx, ROOMS.D.cz - 2, 1.6, 1.1, 0.8, woodDarkMat);
    addDecal(ROOMS.D.cx - 0.6, ROOMS.D.cz - 2, 0.25, 0.02, 0.25, new THREE.MeshLambertMaterial({ color: 0xd94f4f }));
    addDecal(ROOMS.D.cx + 0.6, ROOMS.D.cz - 2, 0.25, 0.02, 0.25, new THREE.MeshLambertMaterial({ color: 0x4f8fd9 }));

    // Room E (final) -- gym scoreboard + the boss podium.
    addCanvasBox(ROOMS.E.cx, 3.6, ROOMS.E.cz - 7.35, 2.4, 1.1, 0.12, (ctx, cv) => {
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center";
      ctx.font = "bold 20px monospace"; ctx.fillStyle = "#ffcc55";
      ctx.fillText("HOME", 64, 30); ctx.fillText("AWAY", 192, 30);
      ctx.font = "bold 52px monospace"; ctx.fillStyle = "#ff3b3b";
      ctx.fillText("00 : 00", 128, 92);
    }, 0x1a1a1a);

    // ---------------- Open double-height hall + mezzanine (layout redesign item 2) ----------------
    // Room E keeps its normal walls up to y=3.4 (built by the shared
    // addRoomWalls call above) but gets extra risers on top of those, up to
    // a much taller custom ceiling, instead of the standard low one -- reads
    // as a gym with a running-track balcony rather than a flat box.
    const riserH = 3.4, riserY = 3.4 + riserH / 2;
    function addRiserWall(x, z, w, d) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, riserH, d), wallMat);
      m.position.set(x, riserY, z);
      scene.add(m);
      world.colliders.push(new THREE.Box3().setFromObject(m));
    }
    addRiserWall(ROOMS.E.cx - ROOMS.E.w / 2, ROOMS.E.cz, 0.4, ROOMS.E.d);
    addRiserWall(ROOMS.E.cx + ROOMS.E.w / 2, ROOMS.E.cz, 0.4, ROOMS.E.d);
    addRiserWall(ROOMS.E.cx, ROOMS.E.cz - ROOMS.E.d / 2, ROOMS.E.w, 0.4);
    addRiserWall(ROOMS.E.cx, ROOMS.E.cz + ROOMS.E.d / 2, ROOMS.E.w, 0.4); // solid above the south doorway is fine -- the doorway itself is well under 3.4
    const eCeilY = 3.4 + riserH;
    const eCeil = new THREE.Mesh(new THREE.BoxGeometry(ROOMS.E.w, 0.3, ROOMS.E.d), ceilingMat);
    eCeil.position.set(ROOMS.E.cx, eCeilY + 0.15, ROOMS.E.cz);
    scene.add(eCeil);
    addLight(ROOMS.E.cx, eCeilY - 0.6, ROOMS.E.cz, 0xffe08a, 1.0, 1.6);

    // A running-track-style mezzanine along the east wall, reachable by a
    // ramp from the gym floor, overlooking the court toward the scoreboard
    // and boss podium -- a real height/sightline advantage for combat, not
    // just a cosmetic ledge. Kept along the entrance-side east wall (well
    // south of the boss spawn points at z=-37/-34) so it never overlaps
    // where zombies/the boss actually spawn.
    const mezzMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    const mezzCx = ROOMS.E.cx + ROOMS.E.w / 2 - 1.5, mezzCz = -28;
    addPlatform(mezzCx, mezzCz, 3, 6, 2.2, mezzMat, "x", -1, 2.4);
    // Railing along the mezzanine's open (west-facing) edge.
    const railMat = new THREE.MeshLambertMaterial({ color: 0x2a2015 });
    const railX = mezzCx - 1.5;
    for (let z = mezzCz - 2.5; z <= mezzCz + 2.5; z += 2) addFloatBox(railX, 2.2 + 0.5, z, 0.08, 1.0, 0.08, railMat);
    addFloatBox(railX, 2.2 + 0.95, mezzCz, 0.08, 0.08, 5.2, railMat);

    // ---------------- 2nd floor (category E, this round) ----------------
    // Library / staff meeting room / teachers' lounge, continuing the school
    // theme. Same staircase-and-offset-room pattern as the hospital's 2nd
    // floor (the height-zone system can't stack two floors at one XZ point).
    const floor2Y = 4.2;
    // stairX1 now lands exactly on room F's west wall (24.7). It used to stop
    // at 24.2, leaving a half-unit strip with no height zone where anyone
    // walking off the top of the stairs dropped back to ground level -- i.e.
    // straight through the building's footprint and outside the map (A1).
    const stairX0 = 20.2, stairX1 = 24.7;
    const rampLen = stairX1 - stairX0;
    // A2 fix: rotation.z was NEGATIVE, tilting the slab down toward +X while
    // the walkable height zone rose toward +X -- the visible staircase ran the
    // opposite way to the surface you actually climbed. Length is the slope's
    // hypotenuse so the slab spans the whole run instead of falling short.
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(rampLen, floor2Y), 0.2, 3), wallMat);
    rampMesh.position.set((stairX0 + stairX1) / 2, floor2Y / 2, -14.5);
    rampMesh.rotation.z = Math.atan2(floor2Y, rampLen);
    scene.add(rampMesh);
    world.heightZones.push({ minX: stairX0, maxX: stairX1, minZ: -16, maxZ: -13, ramp: true, axis: "x", h0: 0, h1: floor2Y });
    // Stairwell side walls (A1): the ramp's long sides were completely open,
    // so you could climb it and step straight off into the void beside it.
    addWallSeg((stairX0 + stairX1) / 2, -16.2, rampLen, 0.4, floor2Y + 3.2);
    addWallSeg((stairX0 + stairX1) / 2, -12.8, rampLen, 0.4, floor2Y + 3.2);

    const F = { cx: 29.7, cz: -14.5, w: 10, d: 10 };
    world.heightZones.push({ minX: F.cx - F.w / 2, maxX: F.cx + F.w / 2, minZ: F.cz - F.d / 2, maxZ: F.cz + F.d / 2, height: floor2Y });
    addFloor(F.cx, F.cz, F.w, F.d, floor2Y);
    const fh = 3.2;
    // West gap (z=[-16,-13]) is the stair arrival; the other three now open
    // onto the new upstairs wings added in item D1.
    addRoomWalls(F, {
      west: { center: -14.5, width: 3 },
      east: { center: -14.5, width: 3 },
      north: { center: F.cx, width: 3 },
      south: { center: F.cx, width: 3 },
    }, fh, floor2Y);
    const fCeil = new THREE.Mesh(new THREE.BoxGeometry(F.w, 0.3, F.d), ceilingMat);
    fCeil.position.set(F.cx, floor2Y + fh + 0.15, F.cz);
    scene.add(fCeil);
    addLight(F.cx - 2, floor2Y + fh - 0.4, F.cz - 2, 0xd8c98c, 1.2, 1.4);
    addLight(F.cx + 2, floor2Y + fh - 0.4, F.cz + 2, 0xffe08a, 1.0, 1.8);

    // Library nook -- more striped bookshelves, continuing room C's look.
    [0.55, 1.2, 1.85].forEach((y, row) => {
      for (let i = 0; i < 6; i++) {
        const z = F.cz - 3.9 + i * 0.2;
        addFloatBox(F.cx - 3.9, floor2Y + y, z, 0.06, 0.5, 0.15, new THREE.MeshLambertMaterial({ color: stripeColors[(i + row) % stripeColors.length] }));
      }
    });
    // Staff meeting room -- long table with a corpse slumped over it.
    addFloatBox(F.cx + 1, floor2Y + 0.45, F.cz - 1, 2.4, 0.1, 1.0, woodMat);
    addFloatBox(F.cx + 1, floor2Y + 0.22, F.cz - 1.7, 0.4, 0.4, 0.4, woodDarkMat);
    addFloatBox(F.cx + 1, floor2Y + 0.22, F.cz - 0.3, 0.4, 0.4, 0.4, woodDarkMat);
    addCorpse(F.cx + 1.5, F.cz - 1, 0.8, 0xd9a83c);
    addBloodStain(F.cx + 1.5, F.cz - 1, 0.7, 0.8);
    // Teachers' lounge -- lockers + a second corpse.
    addFloatBox(F.cx - 2, floor2Y + 0.9, F.cz + 3, 0.5, 1.8, 0.7, lockerBlue);
    addFloatBox(F.cx - 1.3, floor2Y + 0.9, F.cz + 3, 0.5, 1.8, 0.7, lockerBlueDark);
    addCorpse(F.cx + 3, F.cz + 3, 1.6, 0x8a3fb0);
    addBloodStain(F.cx + 3, F.cz + 3, 0.6, 1.6);

    world.regions.push({ name: "F", minX: F.cx - F.w / 2, maxX: F.cx + F.w / 2, minZ: F.cz - F.d / 2, maxZ: F.cz + F.d / 2 });
    world.regions.push({ name: "CF", minX: stairX0, maxX: stairX1, minZ: -16, maxZ: -13 });
    world.waypointNodes.F = { x: F.cx, z: F.cz };
    world.waypointNodes.CF = { x: (stairX0 + stairX1) / 2, z: -14.5 };
    world.waypointEdges.C.push("CF"); world.waypointEdges.CF = ["C", "F"]; world.waypointEdges.F = ["CF"];

    const barrier2 = addBarricade(stairX0 - 0.3, -14.5, 3, new THREE.MeshLambertMaterial({ color: 0x5c5438 }));
    addBloodStain(stairX0 - 0.3, -14.5, 0.6, 0.5);
    world.secondFloor = {
      unlocked: false, barrierMesh: barrier2.mesh, barrierCollider: barrier2.collider,
      // Category E (this round): School's 2nd floor counts ONLY kills scored
      // by answering the target word correctly, unlike Hospital's "any kill"
      // rule -- see countMode in checkSecondFloorUnlock (game.js).
      killsNeeded: 20, countMode: "correct", room: F, floorY: floor2Y,
      cratePositions: [new THREE.Vector3(F.cx + 3, floor2Y + 0.3, F.cz + 3), new THREE.Vector3(F.cx - 2, floor2Y + 0.3, F.cz + 3.5)],
    };

    // ---------------- Annex wing (layout redesign item 1: organic footprint) ----------------
    // A narrow branch off the main block, ending in a small room, instead of
    // another compact room flush against the core -- reads as an irregular
    // extension rather than the same rectangle repeated. Gated by a second
    // word-locked door (mirrors the existing Room C door mechanic) so it
    // plugs into the interaction system already in place.
    const wingDoorX = 5.15, wingDoorZ = 0;
    const wingDoor = addProp(wingDoorX, wingDoorZ, 0.3, 3, 2.6, new THREE.MeshLambertMaterial({ color: 0xb2452f }));
    addGlowBox(wingDoorX, 3.05, wingDoorZ, 0.34, 0.1, 2.7, 0xffcc33);
    addGlowBox(wingDoorX, 1.5, wingDoorZ - 1.35, 0.34, 3.1, 0.08, 0xffcc33);
    addGlowBox(wingDoorX, 1.5, wingDoorZ + 1.35, 0.34, 3.1, 0.08, 0xffcc33);
    world.doors.push({ mesh: wingDoor, locked: true, kind: "word", opened: false, collider: world.colliders[world.colliders.length - 1] });
    world.interactables.push({ mesh: wingDoor, kind: "door", ref: world.doors[world.doors.length - 1] });

    const corridorCx = 8.25, corridorLen = 6.5; // spans x=[5, 11.5]
    addFloor(corridorCx, 0, corridorLen, 3); addCeiling(corridorCx, 0, corridorLen, 3);
    addWallSeg(corridorCx, -1.5, corridorLen, 0.4);
    addWallSeg(corridorCx, 1.5, corridorLen, 0.4);
    addLight(corridorCx, 3.0, 0, 0xd8c98c, 0.9, 1.7);

    const WING = { cx: 15, cz: 0, w: 7, d: 6 };
    addFloor(WING.cx, WING.cz, WING.w, WING.d); addCeiling(WING.cx, WING.cz, WING.w, WING.d);
    addRoomWalls(WING, { west: { center: 0, width: 3 }, north: { center: 14.5, width: 2.5 } }); // north -> computer lab (item D1)
    addLight(WING.cx, 3.1, WING.cz, 0xffe08a, 1.1, 1.3);
    // Bonus-loot dressing so exploring the wing already pays off; item 3
    // (more small rooms/puzzle nooks) subdivides this further later.
    addProp(WING.cx + 2, WING.cz - 2, 0.9, 1.0, 0.6, woodDarkMat);
    addCorpse(WING.cx - 1, WING.cz + 1.5, 0.4, 0x6b4a2f);
    addBloodStain(WING.cx - 1, WING.cz + 1.5, 0.6, 0.4);
    addHatch(WING.cx - 2, WING.cz, "crate");

    world.regions.push({ name: "AWing", minX: 5, maxX: 11.5, minZ: -1.5, maxZ: 1.5 });
    world.regions.push({ name: "Wing", minX: WING.cx - WING.w / 2, maxX: WING.cx + WING.w / 2, minZ: WING.cz - WING.d / 2, maxZ: WING.cz + WING.d / 2 });
    world.waypointNodes.AWing = { x: corridorCx, z: 0 };
    world.waypointNodes.Wing = { x: WING.cx, z: WING.cz };
    world.waypointEdges.A.push("AWing"); world.waypointEdges.AWing = ["A", "Wing"]; world.waypointEdges.Wing = ["AWing"];

    // ---------------- Small side rooms (layout redesign item 3) ----------------
    // Two tiny rooms branching off the main rooms, each with its own doorway
    // and a bit of bonus loot -- rewards for checking every corner instead of
    // just following the main corridors.
    const REST = { cx: 14.5, cz: -21.5, w: 3, d: 3 };
    addRoomWalls(REST, { south: { center: 14.5, width: 2 }, east: { center: -21.5, width: 2 } }); // east -> under-stair storage (item D1)
    addFloor(REST.cx, REST.cz, REST.w, REST.d); addCeiling(REST.cx, REST.cz, REST.w, REST.d);
    addLight(REST.cx, 3.0, REST.cz, 0xd8c98c, 0.8, 1.5);
    const tileMat = new THREE.MeshLambertMaterial({ color: 0xbcd6d0 });
    addProp(REST.cx - 0.9, REST.cz - 0.9, 0.5, 0.9, 0.4, tileMat);
    addProp(REST.cx + 0.9, REST.cz - 0.9, 0.5, 0.9, 0.4, tileMat);
    addBloodStain(REST.cx, REST.cz, 0.6, 0);

    const CLOSET = { cx: -14.5, cz: -8.25, w: 3, d: 2.5 };
    addRoomWalls(CLOSET, { north: { center: -14.5, width: 2 } });
    addFloor(CLOSET.cx, CLOSET.cz, CLOSET.w, CLOSET.d); addCeiling(CLOSET.cx, CLOSET.cz, CLOSET.w, CLOSET.d);
    addLight(CLOSET.cx, 3.0, CLOSET.cz, 0xffe08a, 0.8, 1.7);
    // Both props pushed to the back wall (away from the z=-9.5 doorway) so
    // neither one blocks the only path in -- the closet is only 2.5 deep.
    addProp(CLOSET.cx - 0.7, CLOSET.cz + 0.8, 1.0, 1.6, 0.5, woodDarkMat);
    // A crate in the closet -- bonus loot for finding it, word-locked like
    // the level's other big-ticket containers.
    const closetCrateMesh = addProp(CLOSET.cx + 0.7, CLOSET.cz + 0.7, 0.7, 0.7, 0.7, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
    world.crates.push({ mesh: closetCrateMesh, opened: false, locked: true });
    world.interactables.push({ mesh: closetCrateMesh, kind: "crate", ref: world.crates[world.crates.length - 1] });

    world.regions.push({ name: "Rest", minX: REST.cx - REST.w / 2, maxX: REST.cx + REST.w / 2, minZ: REST.cz - REST.d / 2, maxZ: REST.cz + REST.d / 2 });
    world.regions.push({ name: "Closet", minX: CLOSET.cx - CLOSET.w / 2, maxX: CLOSET.cx + CLOSET.w / 2, minZ: CLOSET.cz - CLOSET.d / 2, maxZ: CLOSET.cz + CLOSET.d / 2 });
    world.waypointNodes.Rest = { x: REST.cx, z: REST.cz };
    world.waypointNodes.Closet = { x: CLOSET.cx, z: CLOSET.cz };
    world.waypointEdges.C.push("Rest"); world.waypointEdges.Rest = ["C"];
    world.waypointEdges.D.push("Closet"); world.waypointEdges.Closet = ["D"];

    // ---------------- Extra room network (item D1) ----------------
    // Ten more ground-floor rooms and five more upstairs, all hung off the
    // existing block through short corridors with real doors, so the school
    // reads as a warren you have to explore rather than five big halls.
    function addPlainRoom(r, gaps, baseY, lightColor, name) {
      baseY = baseY || 0;
      addFloor(r.cx, r.cz, r.w, r.d, baseY);
      addCeiling(r.cx, r.cz, r.w, r.d, baseY);
      addRoomWalls(r, gaps, 3.4, baseY);
      if (baseY > 0) world.heightZones.push({ minX: r.cx - r.w / 2, maxX: r.cx + r.w / 2, minZ: r.cz - r.d / 2, maxZ: r.cz + r.d / 2, height: baseY });
      addLight(r.cx, baseY + 3.0, r.cz, lightColor, 1.0, 1.1 + G.rng() * 0.9);
      world.regions.push({ name, minX: r.cx - r.w / 2, maxX: r.cx + r.w / 2, minZ: r.cz - r.d / 2, maxZ: r.cz + r.d / 2 });
      world.waypointNodes[name] = { x: r.cx, z: r.cz };
      world.waypointEdges[name] = world.waypointEdges[name] || [];
    }
    // axis is the direction of travel, so the side walls always run parallel
    // to it -- deriving it from "whichever dimension is bigger" would seal a
    // short-but-wide corridor shut across the way you actually walk.
    function addCorridorSeg(cx, cz, w, d, baseY, name, aName, bName, axis) {
      baseY = baseY || 0;
      addFloor(cx, cz, w, d, baseY); addCeiling(cx, cz, w, d, baseY);
      if (axis === "x") { addWallSeg(cx, cz - d / 2, w, 0.4, 3.4, baseY); addWallSeg(cx, cz + d / 2, w, 0.4, 3.4, baseY); }
      else { addWallSeg(cx - w / 2, cz, 0.4, d, 3.4, baseY); addWallSeg(cx + w / 2, cz, 0.4, d, 3.4, baseY); }
      if (baseY > 0) world.heightZones.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height: baseY });
      world.regions.push({ name, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      world.waypointNodes[name] = { x: cx, z: cz };
      world.waypointEdges[name] = [aName, bName];
      world.waypointEdges[aName] = world.waypointEdges[aName] || [];
      world.waypointEdges[bName] = world.waypointEdges[bName] || [];
      world.waypointEdges[aName].push(name);
      world.waypointEdges[bName].push(name);
    }
    // Props hug the corners so they can never end up blocking a doorway.
    const dressMats = [woodMat, woodDarkMat].concat(lockerColors);
    function dressRoom(r, baseY, count) {
      baseY = baseY || 0;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let i = 0; i < count; i++) {
        const [sx, sz] = corners[i % 4];
        const px = r.cx + sx * (r.w / 2 - 1.1), pz = r.cz + sz * (r.d / 2 - 1.1);
        const w = 0.6 + G.rng() * 0.9, h = 0.7 + G.rng() * 1.1, d = 0.5 + G.rng() * 0.8;
        const mat = dressMats[Math.floor(G.rng() * dressMats.length)];
        if (baseY > 0) addFloatBox(px, baseY + h / 2, pz, w, h, d, mat);
        else addProp(px, pz, w, h, d, mat);
      }
      if (G.rng() < 0.6 && baseY === 0) addBloodStain(r.cx + (G.rng() - 0.5) * 2, r.cz + (G.rng() - 0.5) * 2, 0.5 + G.rng() * 0.5, G.rng() * 3);
    }
    world.extraSpawnPoints = [];
    function roomSpawn(r, types) {
      world.extraSpawnPoints.push({ pos: new THREE.Vector3(r.cx, 0, r.cz), types: types || ["normal", "fast"] });
    }
    function roomCrate(r, locked, baseY) {
      const m = baseY
        ? addFloatBox(r.cx + 1.2, baseY + 0.4, r.cz - 1.2, 0.8, 0.8, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }))
        : addProp(r.cx + 1.2, r.cz - 1.2, 0.8, 0.8, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
      world.crates.push({ mesh: m, opened: false, locked: !!locked });
      world.interactables.push({ mesh: m, kind: "crate", ref: world.crates[world.crates.length - 1] });
    }
    const rl2 = pal.roomLight;

    // --- ground floor ---
    const N1 = { cx: -13, cz: 0, w: 9, d: 9 };        // music room, west of the classroom
    addPlainRoom(N1, { east: { center: 0, width: 3 }, south: { center: -13, width: 2.5 } }, 0, rl2[1], "N1");
    addCorridorSeg(-6.75, 0, 3.5, 3, 0, "N1c", "A", "N1", "x");
    addRoomDoor(-5, 0, 3, "z"); addRoomDoor(-8.5, 0, 3, "z");
    dressRoom(N1, 0, 4); roomSpawn(N1); roomCrate(N1, true);

    const N2 = { cx: -13, cz: 10, w: 7, d: 7 };       // nurse's room
    addPlainRoom(N2, { north: { center: -13, width: 2.5 } }, 0, rl2[2], "N2");
    addCorridorSeg(-13, 5.5, 2.5, 2, 0, "N2c", "N1", "N2", "z");
    addRoomDoor(-13, 4.5, 2.5, "x"); addRoomDoor(-13, 6.5, 2.5, "x");
    dressRoom(N2, 0, 3); roomSpawn(N2, ["normal"]);

    const N3 = { cx: 0, cz: 12, w: 12, d: 8 };        // cafeteria
    addPlainRoom(N3, { north: { center: 0, width: 3 }, east: { center: 12, width: 2.5 } }, 0, rl2[3], "N3");
    addCorridorSeg(0, 6.5, 3, 3, 0, "N3c", "A", "N3", "z");
    addRoomDoor(0, 5, 3, "x"); addRoomDoor(0, 8, 3, "x");
    dressRoom(N3, 0, 4); roomSpawn(N3); roomCrate(N3, false);

    const N4 = { cx: 11, cz: 12, w: 7, d: 6 };        // kitchen
    addPlainRoom(N4, { west: { center: 12, width: 2.5 } }, 0, rl2[4], "N4");
    addCorridorSeg(6.75, 12, 1.5, 2.5, 0, "N4c", "N3", "N4", "x");
    addRoomDoor(7.5, 12, 2.5, "z");
    dressRoom(N4, 0, 3); roomSpawn(N4, ["normal", "fast"]);

    const N5 = { cx: 14.5, cz: -6.5, w: 7, d: 4 };    // computer lab, north of the annex
    addPlainRoom(N5, { south: { center: 14.5, width: 2.5 }, east: { center: -5.5, width: 2 } }, 0, rl2[0], "N5");
    addCorridorSeg(14.5, -3.75, 2.5, 1.5, 0, "N5c", "Wing", "N5", "z");
    addRoomDoor(14.5, -3, 2.5, "x"); addRoomDoor(14.5, -4.5, 2.5, "x");
    dressRoom(N5, 0, 3); roomSpawn(N5); roomCrate(N5, true);

    const N6 = { cx: 24, cz: -4, w: 7, d: 7 };        // admin office
    addPlainRoom(N6, { west: { center: -5.5, width: 2 } }, 0, rl2[1], "N6");
    addCorridorSeg(19.25, -5.5, 2.5, 2, 0, "N6c", "N5", "N6", "x");
    addRoomDoor(18, -5.5, 2, "z"); addRoomDoor(20.5, -5.5, 2, "z");
    dressRoom(N6, 0, 4); roomSpawn(N6);

    const N7 = { cx: 23, cz: -21.5, w: 4, d: 3 };     // under-stair storage
    addPlainRoom(N7, { west: { center: -21.5, width: 2 } }, 0, rl2[2], "N7");
    addCorridorSeg(18.5, -21.5, 5, 2, 0, "N7c", "Rest", "N7", "x");
    addRoomDoor(16, -21.5, 2, "z"); addRoomDoor(21, -21.5, 2, "z");
    dressRoom(N7, 0, 2); roomCrate(N7, true);

    const N8 = { cx: -13, cz: -24, w: 7, d: 6 };      // boiler room
    addPlainRoom(N8, { south: { center: -13, width: 2.5 }, west: { center: -24, width: 2.5 } }, 0, rl2[3], "N8");
    addCorridorSeg(-13, -20.25, 2.5, 1.5, 0, "N8c", "D", "N8", "z");
    addRoomDoor(-13, -19.5, 2.5, "x"); addRoomDoor(-13, -21, 2.5, "x");
    dressRoom(N8, 0, 3); roomSpawn(N8);

    const N9 = { cx: -22, cz: -24, w: 6, d: 6 };      // staff room
    addPlainRoom(N9, { east: { center: -24, width: 2.5 } }, 0, rl2[4], "N9");
    addCorridorSeg(-17.75, -24, 2.5, 2.5, 0, "N9c", "N8", "N9", "x");
    addRoomDoor(-16.5, -24, 2.5, "z"); addRoomDoor(-19, -24, 2.5, "z");
    dressRoom(N9, 0, 3); roomSpawn(N9, ["normal"]); roomCrate(N9, false);

    const N10 = { cx: -13, cz: -33, w: 8, d: 7 };     // sports equipment store
    addPlainRoom(N10, { east: { center: -33, width: 2.5 } }, 0, rl2[0], "N10");
    addCorridorSeg(-8.25, -33, 1.5, 2.5, 0, "N10c", "E", "N10", "x");
    addRoomDoor(-7.5, -33, 2.5, "z"); addRoomDoor(-9, -33, 2.5, "z");
    dressRoom(N10, 0, 4); roomSpawn(N10); roomCrate(N10, true);

    // --- second floor (reached through room F, so it shares its unlock gate) ---
    const P1 = { cx: 29.7, cz: -25, w: 8, d: 8 };     // upstairs reading annex
    addPlainRoom(P1, { south: { center: 29.7, width: 3 }, north: { center: 29.7, width: 3 } }, floor2Y, rl2[2], "P1");
    addCorridorSeg(29.7, -20.25, 3, 1.5, floor2Y, "P1c", "F", "P1", "z");
    addRoomDoor(29.7, -19.5, 3, "x", floor2Y); addRoomDoor(29.7, -21, 3, "x", floor2Y);
    dressRoom(P1, floor2Y, 3);

    const P2 = { cx: 33, cz: -4, w: 9, d: 8 };        // assembly/meeting hall
    addPlainRoom(P2, { north: { center: 29.7, width: 3 } }, floor2Y, rl2[3], "P2");
    addCorridorSeg(29.7, -8.75, 3, 1.5, floor2Y, "P2c", "F", "P2", "z");
    addRoomDoor(29.7, -9.5, 3, "x", floor2Y); addRoomDoor(29.7, -8, 3, "x", floor2Y);
    dressRoom(P2, floor2Y, 4);

    const P3 = { cx: 40, cz: -14.5, w: 8, d: 8 };     // records room
    addPlainRoom(P3, { west: { center: -14.5, width: 3 }, north: { center: 40, width: 2.5 } }, floor2Y, rl2[1], "P3");
    addCorridorSeg(35.35, -14.5, 1.3, 3, floor2Y, "P3c", "F", "P3", "x");
    addRoomDoor(34.7, -14.5, 3, "z", floor2Y); addRoomDoor(36, -14.5, 3, "z", floor2Y);
    dressRoom(P3, floor2Y, 3);

    const P4 = { cx: 40, cz: -26, w: 7, d: 7 };       // rooftop store
    addPlainRoom(P4, { south: { center: 40, width: 2.5 } }, floor2Y, rl2[4], "P4");
    addCorridorSeg(40, -20.5, 2.5, 4, floor2Y, "P4c", "P3", "P4", "z");
    addRoomDoor(40, -18.5, 2.5, "x", floor2Y); addRoomDoor(40, -22.5, 2.5, "x", floor2Y);
    dressRoom(P4, floor2Y, 3);

    const P5 = { cx: 29.7, cz: -36, w: 8, d: 7 };     // projection room
    addPlainRoom(P5, { south: { center: 29.7, width: 3 } }, floor2Y, rl2[0], "P5");
    addCorridorSeg(29.7, -30.75, 3, 3.5, floor2Y, "P5c", "P1", "P5", "z");
    addRoomDoor(29.7, -29, 3, "x", floor2Y); addRoomDoor(29.7, -32.5, 3, "x", floor2Y);
    dressRoom(P5, floor2Y, 3);
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
    // Wheeled gurney (bed + small dark wheel blocks at each corner) and a
    // patient corpse lying beside it, with medical debris scattered nearby.
    const gurney = addProp(0.5, -2, 1.7, 0.55, 0.8, bedMat);
    [[-0.75, -0.35], [-0.75, 0.35], [0.75, -0.35], [0.75, 0.35]].forEach(([dx, dz]) => {
      addFloatBox(0.5 + dx, 0.12, -2 + dz, 0.1, 0.12, 0.1, bedDarkMat);
    });
    addCorpse(-3, -3, -0.4, 0xc9d0d0); // patient gown
    addBloodStain(-3, -3, 0.8, -0.4);
    addBloodStain(0.5, -1.4, 0.5, 0.2);
    const debrisMat = new THREE.MeshLambertMaterial({ color: 0xd8dcd8 });
    for (let i = 0; i < 4; i++) addDecal(-1.5 + i * 0.5, -3.5 + (i % 2) * 0.6, 0.14, 0.05, 0.14, debrisMat, i * 0.5);

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
    addBloodStain(ROOMS.E.cx, ROOMS.E.cz - 2, 1.4, 0);
    addCorpse(ROOMS.E.cx - 4, ROOMS.E.cz + 4, 1.0, 0x3a6a5c); // surgeon's scrubs
    addBloodStain(ROOMS.E.cx - 4, ROOMS.E.cz + 4, 0.7, 1.0);
    addCorpse(ROOMS.B.cx - 3, ROOMS.B.cz + 2, -0.7, 0xc9d0d0);
    addBloodStain(ROOMS.B.cx - 3, ROOMS.B.cz + 2, 0.7, -0.7);

    // ---------------- 2nd floor (category E3) ----------------
    // No stacked-floor support in the height-zone system (one XZ point can
    // only have one height), so the 2nd floor is a real elevated room
    // reached by climbing a staircase rather than sitting directly overhead
    // -- functionally identical (locked until earned, distinct area,
    // rarer rewards), just offset to the east instead of straight up.
    const floor2Y = 4.2;
    // stairX1 now lands exactly on room F's west wall (24.7). It used to stop
    // at 24.2, leaving a half-unit strip with no height zone where anyone
    // walking off the top of the stairs dropped back to ground level -- i.e.
    // straight through the building's footprint and outside the map (A1).
    const stairX0 = 20.2, stairX1 = 24.7;
    const rampLen = stairX1 - stairX0;
    // A2 fix: rotation.z was NEGATIVE, tilting the slab down toward +X while
    // the walkable height zone rose toward +X -- the visible staircase ran the
    // opposite way to the surface you actually climbed. Length is the slope's
    // hypotenuse so the slab spans the whole run instead of falling short.
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(rampLen, floor2Y), 0.2, 3), wallMat);
    rampMesh.position.set((stairX0 + stairX1) / 2, floor2Y / 2, -14.5);
    rampMesh.rotation.z = Math.atan2(floor2Y, rampLen);
    scene.add(rampMesh);
    world.heightZones.push({ minX: stairX0, maxX: stairX1, minZ: -16, maxZ: -13, ramp: true, axis: "x", h0: 0, h1: floor2Y });
    // Stairwell side walls (A1): the ramp's long sides were completely open,
    // so you could climb it and step straight off into the void beside it.
    addWallSeg((stairX0 + stairX1) / 2, -16.2, rampLen, 0.4, floor2Y + 3.2);
    addWallSeg((stairX0 + stairX1) / 2, -12.8, rampLen, 0.4, floor2Y + 3.2);

    const F = { cx: 29.7, cz: -14.5, w: 10, d: 10 };
    // Flat height zone for the room itself -- without this, a player/zombie
    // walking past the end of the ramp would fall straight back to height 0,
    // since only the ramp's own XZ range had a height entry.
    world.heightZones.push({ minX: F.cx - F.w / 2, maxX: F.cx + F.w / 2, minZ: F.cz - F.d / 2, maxZ: F.cz + F.d / 2, height: floor2Y });
    addFloor(F.cx, F.cz, F.w, F.d, floor2Y);
    const fh = 3.2;
    function addUpperWall(x, z, w, d) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, fh, d), wallMat);
      m.position.set(x, floor2Y + fh / 2, z);
      scene.add(m);
      world.colliders.push(new THREE.Box3().setFromObject(m));
    }
    // West wall has a 3-unit gap (matching the ramp/stair width, z=[-16,-13])
    // where the staircase actually arrives -- a solid wall there sealed the
    // room's only entrance completely, so the player got stuck right at the
    // top of the stairs. Room F spans z=[-19.5,-9.5], so the two remaining
    // wall segments are z=[-19.5,-16] and z=[-13,-9.5].
    const fWestX = F.cx - F.w / 2;
    addUpperWall(fWestX, -17.75, 0.4, 3.5);
    addUpperWall(fWestX, -11.25, 0.4, 3.5);
    [[F.cx + F.w / 2, F.cz, 0.4, F.d], [F.cx, F.cz - F.d / 2, F.w, 0.4], [F.cx, F.cz + F.d / 2, F.w, 0.4]].forEach(([x, z, w, d]) => addUpperWall(x, z, w, d));
    const fCeil = new THREE.Mesh(new THREE.BoxGeometry(F.w, 0.3, F.d), ceilingMat);
    fCeil.position.set(F.cx, floor2Y + fh + 0.15, F.cz);
    scene.add(fCeil);
    addLight(F.cx - 2, floor2Y + fh - 0.4, F.cz - 2, 0x7dffc0, 1.3, 1.5);
    addLight(F.cx + 2, floor2Y + fh - 0.4, F.cz + 2, 0xff6b6b, 1.0, 1.9);

    // ICU/operating-theater dressing, continuing floor 1's theme + more gore.
    addFloatBox(F.cx - 3, floor2Y, F.cz - 3, 2.0, 0.9, 1.0, bedMat);
    addFloatBox(F.cx - 3, floor2Y + 0.95, F.cz - 3, 0.15, 0.5, 0.15, cabinetMat);
    addCorpse(F.cx + 2, F.cz - 2, 0.5, 0xc9d0d0);
    world.regions.push({ name: "F", minX: F.cx - F.w / 2, maxX: F.cx + F.w / 2, minZ: F.cz - F.d / 2, maxZ: F.cz + F.d / 2 });
    world.regions.push({ name: "CF", minX: stairX0, maxX: stairX1, minZ: -16, maxZ: -13 });
    world.waypointNodes.F = { x: F.cx, z: F.cz };
    world.waypointNodes.CF = { x: (stairX0 + stairX1) / 2, z: -14.5 };
    world.waypointEdges.C.push("CF"); world.waypointEdges.CF = ["C", "F"]; world.waypointEdges.F = ["CF"];

    const barrier2 = addBarricade(stairX0 - 0.3, -14.5, 3, new THREE.MeshLambertMaterial({ color: 0x555550 }));
    // Blood-stained floor decal right at the barrier reads as "someone tried
    // to get up there and didn't make it" -- a small storytelling touch.
    addBloodStain(stairX0 - 0.3, -14.5, 0.6, 0.5);
    world.secondFloor = {
      unlocked: false, barrierMesh: barrier2.mesh, barrierCollider: barrier2.collider,
      killsNeeded: 20, room: F, floorY: floor2Y,
      // Fewer, rarer drops than the ground floor -- a special reward, not a farm spot.
      cratePositions: [new THREE.Vector3(F.cx + 3, floor2Y + 0.3, F.cz + 3), new THREE.Vector3(F.cx - 2, floor2Y + 0.3, F.cz + 3.5)],
    };
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
    addCorpse(0.5, -1.5, 0.9, 0x4a5c3a); // fallen soldier, fatigues
    addBloodStain(0.5, -1.5, 0.7, 0.9);
    addBloodStain(-2.3, 3.2, 0.5, -0.2); // stain on/near the ammo crates

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

    // Damaged hanging cables -- dark dangling wire bundles that periodically
    // spark (see world.sparkPoints / G.updateSparks), reinforcing the
    // "backup generator is failing" read of the bunker theme.
    const cableMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1a });
    function hangingCable(x, y, z, sparkY) {
      addFloatBox(x, y, z, 0.06, 0.7, 0.06, cableMat);
      addFloatBox(x + 0.15, y - 0.05, z, 0.06, 0.5, 0.06, cableMat, 0.3);
      world.sparkPoints.push({ x, y: sparkY != null ? sparkY : y - 0.35, z, timer: G.rng() * 3 });
    }
    hangingCable(ROOMS.B.cx - 4.5, 3.0, ROOMS.B.cz + 2);
    hangingCable(ROOMS.D.cx + 1.5, 3.0, ROOMS.D.cz + 1);
    hangingCable(ROOMS.E.cx - 2, 3.0, ROOMS.E.cz - 2.5);

    // Room E (final) -- reinforced chamber, sandbag cover, boss podium.
    for (let i = 0; i < 3; i++) addProp(ROOMS.E.cx - 4 + i * 0.85, ROOMS.E.cz + 3, 0.8, 0.4, 0.5, sandbagMat);
    for (let i = 0; i < 3; i++) addProp(ROOMS.E.cx + 3 + i * 0.85, ROOMS.E.cz + 3, 0.8, 0.4, 0.5, sandbagMat);
    addCorpse(ROOMS.E.cx, ROOMS.E.cz + 5.5, 0, 0x4a5c3a);
    addBloodStain(ROOMS.E.cx, ROOMS.E.cz + 5.5, 0.8, 0);
    addCorpse(ROOMS.C.cx - 1, ROOMS.C.cz + 5, 1.3, 0x545c3a);
    addBloodStain(ROOMS.C.cx - 1, ROOMS.C.cz + 5, 0.6, 1.3);
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
  // The theme decorators run before this list is assigned, so any spawn points
  // they registered (item D1's extra rooms) get merged in here rather than
  // pushed straight onto world.spawnPoints -- that array is replaced above.
  if (world.extraSpawnPoints && world.extraSpawnPoints.length) {
    world.spawnPoints = world.spawnPoints.concat(
      world.extraSpawnPoints.map((sp) => Object.assign(sp, { cooldown: 0 })));
  }

  // ---------------- Interactions ----------------
  // Word-locked door blocking a direct look at the east wing's landmark. Its
  // color reads too close to the surrounding wall in every theme's dim
  // lighting, so it also gets a bright self-lit frame (never used for walls)
  // that makes it obvious at a glance which panel is the interactive door.
  const lockedDoorX = ROOMS.C.cx - 3.3, lockedDoorZ = ROOMS.C.cz - 5.4;
  const lockedDoor = addProp(lockedDoorX, lockedDoorZ, 0.3, 3, 3.4, new THREE.MeshLambertMaterial({ color: 0xb2452f }));
  addGlowBox(lockedDoorX, 3.05, lockedDoorZ, 0.34, 0.1, 3.5, 0xffcc33);
  addGlowBox(lockedDoorX, 1.5, lockedDoorZ - 1.75, 0.34, 3.1, 0.08, 0xffcc33);
  addGlowBox(lockedDoorX, 1.5, lockedDoorZ + 1.75, 0.34, 3.1, 0.08, 0xffcc33);
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
  world.traps.push({ mesh: trapMesh, active: true, damage: 45, cooldown: 0, collider: world.colliders[world.colliders.length - 1] }); // was 12, scaled 3.75x with player HP
  world.interactables.push({ mesh: trapMesh, kind: "trap", ref: world.traps[world.traps.length - 1] });

  // ---------------- Wall-mounted exclusive weapon (category C3) ----------------
  // Mounted on room A's solid south wall (no doorway there), off to the +X
  // side where no theme's starting-room decor reaches, so it's clear in all
  // three levels. See the wallExclusive weapon defs in entities.js for the
  // pricing rationale.
  const wallWeaponId = { school: "school_wall", hospital: "hospital_wall", bunker: "bunker_wall" }[level.theme];
  if (wallWeaponId) {
    const wdef = G.WEAPON_DEFS[wallWeaponId];
    const mountX = 3.5, mountY = 1.7, mountZ = 4.7;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.08), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    plaque.position.set(mountX, mountY, mountZ);
    scene.add(plaque);
    const gunMesh = G.buildWeaponMesh(wdef);
    gunMesh.scale.set(2.6, 2.6, 2.6);
    gunMesh.position.set(mountX, mountY + 0.15, mountZ - 0.14);
    gunMesh.rotation.y = Math.PI / 2 - 0.25;
    scene.add(gunMesh);
    addCanvasBox(mountX, mountY - 0.68, mountZ - 0.02, 1.1, 0.32, 0.04, (ctx, cv) => {
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center";
      ctx.font = "bold 24px sans-serif"; ctx.fillStyle = "#ffd43b"; ctx.fillText(wdef.name, 128, 34);
      ctx.font = "bold 26px monospace"; ctx.fillStyle = "#6bff7a"; ctx.fillText("$" + wdef.price, 128, 68);
    }, 0x1a1a1a);
    world.wallWeapon = { id: wallWeaponId, price: wdef.price, purchased: false, gunMesh };
    world.interactables.push({ mesh: plaque, kind: "wallweapon", ref: world.wallWeapon });
  }

  // ---------------- Mystery weapon box (category C1) ----------------
  // Sits in the east wing, a couple of rooms in from the spawn, so it is a
  // deliberate trip rather than something you bump into at the start.
  {
    const mbX = ROOMS.C.cx - 3.5, mbZ = ROOMS.C.cz + 2;
    const crate = addProp(mbX, mbZ, 1.3, 1.0, 1.3, new THREE.MeshLambertMaterial({ color: 0x1b1030 }));
    // neon edge glow so it's findable in the dark
    [[0, 0.52, 0.66], [0, 0.52, -0.66], [0.66, 0.52, 0], [-0.66, 0.52, 0]].forEach(([ox, oy, oz]) => {
      addGlowBox(mbX + ox, oy + 0.5, mbZ + oz, ox ? 0.06 : 1.32, 0.06, oz ? 0.06 : 1.32, 0x7f5bff);
    });
    addCanvasBox(mbX, 1.25, mbZ + 0.67, 0.9, 0.7, 0.05, (ctx, cv) => {
      ctx.fillStyle = "#12071f"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center"; ctx.font = "bold 84px sans-serif"; ctx.fillStyle = "#c9a3ff";
      ctx.fillText("?", 128, 96);
    }, 0x2a1350);
    world.mysteryBox = { mesh: crate, x: mbX, z: mbZ, uses: 0 };
    world.interactables.push({ mesh: crate, kind: "mysterybox", ref: world.mysteryBox });
  }

  world.spawn = { x: 0, z: 3 };
  world.bossRoomCenter = new THREE.Vector3(ROOMS.E.cx, 0, ROOMS.E.cz - 2);

  // ---------------- Outer safety boundary (A1) ----------------
  // Backstop for any wall hole that slips through: a ring of tall invisible
  // colliders just outside the union of every walkable region/height zone.
  // Even if some doorway is left open to the void, you can only step a couple
  // of units past the shell before this stops you.
  let bMinX = Infinity, bMaxX = -Infinity, bMinZ = Infinity, bMaxZ = -Infinity;
  const spanOf = (a) => {
    bMinX = Math.min(bMinX, a.minX); bMaxX = Math.max(bMaxX, a.maxX);
    bMinZ = Math.min(bMinZ, a.minZ); bMaxZ = Math.max(bMaxZ, a.maxZ);
  };
  world.regions.forEach(spanOf);
  world.heightZones.forEach(spanOf);
  const bm = 2.5, bt = 3;
  const boundaryBox = (x0, z0, x1, z1) => world.colliders.push(
    new THREE.Box3(new THREE.Vector3(x0, -2, z0), new THREE.Vector3(x1, 40, z1)));
  boundaryBox(bMinX - bm - bt, bMinZ - bm - bt, bMinX - bm, bMaxZ + bm + bt);
  boundaryBox(bMaxX + bm, bMinZ - bm - bt, bMaxX + bm + bt, bMaxZ + bm + bt);
  boundaryBox(bMinX - bm - bt, bMinZ - bm - bt, bMaxX + bm + bt, bMinZ - bm);
  boundaryBox(bMinX - bm - bt, bMaxZ + bm, bMaxX + bm + bt, bMaxZ + bm + bt);
  world.bounds = { minX: bMinX, maxX: bMaxX, minZ: bMinZ, maxZ: bMaxZ };

  return world;
};
