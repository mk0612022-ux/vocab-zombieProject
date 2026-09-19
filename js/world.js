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
// Multi-level height lookup. The school is a real two-storey building now, so
// one XZ point can carry several walkable surfaces (ground floor, the slab
// above it, a stair tread in between). `feetY` disambiguates: we take the
// HIGHEST surface that is still steppable-up-to from where the body currently
// is, which makes stairs climb naturally and stops anyone standing on the
// ground floor from being yanked up onto the storey above them. Omitting
// feetY keeps the old "highest surface wins" behaviour for callers that
// genuinely don't have a body position (level setup, editor-ish queries).
G.STEP_UP = 0.7;
G.getFloorHeightAt = function (world, x, z, feetY) {
  if (!world || !world.heightZones) return 0;
  let highest = null, best = null, lowest = null;
  for (const hz of world.heightZones) {
    if (x < hz.minX || x > hz.maxX || z < hz.minZ || z > hz.maxZ) continue;
    let h;
    if (hz.ramp) {
      const t = hz.axis === "x" ? (x - hz.minX) / (hz.maxX - hz.minX) : (z - hz.minZ) / (hz.maxZ - hz.minZ);
      h = hz.h0 + (hz.h1 - hz.h0) * Math.max(0, Math.min(1, t));
    } else h = hz.height;
    if (highest === null || h > highest) highest = h;
    if (lowest === null || h < lowest) lowest = h;
    if (feetY !== undefined && h <= feetY + G.STEP_UP && (best === null || h > best)) best = h;
  }
  if (highest === null) return 0;
  if (feetY === undefined) return highest;
  if (best !== null) return best;
  return lowest; // every surface here is above us (e.g. stepped under a slab)
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
// `y` matters now that rooms stack: a region carries the floor level it sits
// on, so the room upstairs and the room below it don't resolve to each other.
G.getRegionAt = function (world, x, z, y) {
  if (!world || !world.regions) return null;
  const onLevel = (r) => y === undefined || r.y === undefined || Math.abs(r.y - y) < 2.3;
  for (const r of world.regions) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && onLevel(r)) return r.name;
  }
  let best = null, bestDist = Infinity;
  for (const r of world.regions) {
    if (!onLevel(r)) continue;
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

  // The school is now a purpose-built two-storey block (see buildSchoolBuilding)
  // rather than the shared five-room hub layout the other themes use.
  if (level.theme === "school") { buildSchoolBuilding(); } else {

  Object.values(ROOMS).forEach((r) => {
    addFloor(r.cx, r.cz, r.w, r.d);
    addCeiling(r.cx, r.cz, r.w, r.d);
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
  const decorators = { hospital: decorateHospital, bunker: decorateBunker };
  (decorators[level.theme] || decorateHospital)(theme);

  } // end non-school layout

  // ---------------- Landmark decorators (one per theme) ----------------
  // Shared rule (item 4): every recurring object type keeps ONE consistent
  // color set everywhere it appears in a given level (ammo crates are always
  // the same yellow/black, lockers always the same blue, etc).
  // ---------------- School: a real stacked two-storey building ----------------
  // A central corridor with rooms down both sides, and the same footprint
  // repeated directly overhead, joined by one staircase. The old school
  // sprawled sideways because a single XZ point could only hold one walkable
  // height; G.getFloorHeightAt is multi-level now, so floors can truly stack.
  function buildSchoolBuilding() {
    const F1 = 0, F2 = 4.2, WH = 4.2, CEIL = 3.95;
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x6d737a });
    const boardMat = new THREE.MeshLambertMaterial({ color: 0x1f4436 });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x3a3a34 });
    const lockerMats = [0x2f6fb0, 0xc9433c, 0xd9b23c, 0x3f9e5c].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    const rl = pal.roomLight;

    const HALF = 3.5;          // corridor half width -> x[-3.5, 3.5]
    const ROOM_W = 12.5;
    const WX = -(HALF + ROOM_W / 2), EX = HALF + ROOM_W / 2;  // -9.75 / +9.75
    const GYM = { cx: 0, cz: -38.5, w: 32, d: 15 };           // x[-16,16] z[-46,-31]
    const STAIR = { cx: 0, cz: 25.5, w: 9, d: 11 };           // x[-4.5,4.5] z[20,31]

    world.regions = []; world.waypointNodes = {}; world.waypointEdges = {};
    world.extraSpawnPoints = [];
    world.wallWeapons = [];

    function link(a, b) {
      world.waypointEdges[a] = world.waypointEdges[a] || [];
      world.waypointEdges[b] = world.waypointEdges[b] || [];
      world.waypointEdges[a].push(b);
      world.waypointEdges[b].push(a);
    }
    function addSpace(key, cx, cz, w, d, baseY) {
      addFloor(cx, cz, w, d, baseY);
      world.heightZones.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height: baseY });
      world.regions.push({ name: key, y: baseY, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      world.waypointNodes[key] = { x: cx, z: cz };
      world.waypointEdges[key] = world.waypointEdges[key] || [];
    }

    // Rows are contiguous along Z, so the rooms' own inner walls form the
    // corridor's sides -- no separate corridor walls (and no double walls).
    const ROWS = [
      { cz: 13.5, d: 13, corr: "S" },   // z[7, 20]
      { cz: 0.5, d: 13, corr: "M" },    // z[-6, 7]
      { cz: -12.5, d: 13, corr: "N" },  // z[-19, -6]
      { cz: -25, d: 12, corr: "N" },    // z[-31, -19]
    ];
    const CORR_SEGS = [
      { name: "S", cz: 13.5, d: 13 },
      { name: "M", cz: 0.5, d: 13 },
      // must butt up against M (z=-6) exactly -- a gap here is invisible on the
      // ground floor (missing zones read as height 0) but upstairs it's a hole
      // in the corridor you fall through.
      { name: "N", cz: -19, d: 26 },    // z[-32, -6] covers both north rows
    ];
    const ROOM_PLAN = {
      1: [
        { key: "W1", side: "W", row: 0, label: "ห้องเรียน 1-1", light: 0, classroom: true },
        { key: "E1", side: "E", row: 0, label: "ห้องเรียน 1-2", light: 2 },
        { key: "W2", side: "W", row: 1, label: "ห้องเรียน 1-3", light: 1, gun: "hall_monitor" },
        { key: "E2", side: "E", row: 1, label: "ห้องคอมพิวเตอร์", light: 3, gun: "pop_quiz" },
        { key: "W3", side: "W", row: 2, label: "ห้องสมุด", light: 2, button: true },
        { key: "E3", side: "E", row: 2, label: "ห้องเรียน 1-4", light: 0, classroom: true },
        { key: "W4", side: "W", row: 3, label: "ห้องพักครู", light: 4, gun: "detention_slug", secret: true },
        { key: "E4", side: "E", row: 3, label: "ห้องเก็บของ", light: 1, gun: "cafeteria_cleaver", wordDoor: true },
      ],
      2: [
        { key: "PW1", side: "W", row: 0, label: "ห้องดนตรี", light: 1, gun: "honor_roll" },
        { key: "PE1", side: "E", row: 0, label: "ห้องเรียน 2-1", light: 3 },
        { key: "PW2", side: "W", row: 1, label: "ห้องเรียน 2-2", light: 0, classroom: true },
        { key: "PE2", side: "E", row: 1, label: "ห้องวิทยาศาสตร์", light: 2, gun: "science_fair" },
        { key: "PW3", side: "W", row: 2, label: "ห้องศิลปะ", light: 4, gun: "art_attack" },
        { key: "PE3", side: "E", row: 2, label: "ห้องประชุม", light: 1, mystery: true },
        { key: "PW4", side: "W", row: 3, label: "ห้องเก็บเอกสาร", light: 3 },
        { key: "PE4", side: "E", row: 3, label: "ห้องฉายภาพยนตร์", light: 0, gun: "principals_verdict" },
      ],
    };

    // ---- corridors, both floors ----
    [1, 2].forEach((fl) => {
      const baseY = fl === 1 ? F1 : F2;
      CORR_SEGS.forEach((c) => {
        const key = "C" + fl + c.name;
        addSpace(key, 0, c.cz, HALF * 2, c.d, baseY);
        addCeiling(0, c.cz, HALF * 2, c.d, baseY, CEIL);
        addLight(0, baseY + CEIL - 0.4, c.cz, rl[fl === 1 ? 0 : 1], 1.0, 1.2 + G.rng() * 0.7);
      });
      link("C" + fl + "S", "C" + fl + "M");
      link("C" + fl + "M", "C" + fl + "N");
    });

    // ---- rooms, both floors ----
    const classroomRooms = [];
    [1, 2].forEach((fl) => {
      const baseY = fl === 1 ? F1 : F2;
      ROOM_PLAN[fl].forEach((spec) => {
        const row = ROWS[spec.row];
        const cx = spec.side === "W" ? WX : EX;
        const r = { cx, cz: row.cz, w: ROOM_W, d: row.d };
        addSpace(spec.key, cx, row.cz, ROOM_W, row.d, baseY);
        addCeiling(cx, row.cz, ROOM_W, row.d, baseY, CEIL);
        // the wall facing the corridor carries the doorway
        const gaps = spec.side === "W"
          ? { east: { center: row.cz, width: 3 } }
          : { west: { center: row.cz, width: 3 } };
        addRoomWalls(r, gaps, WH, baseY);
        addLight(cx, baseY + CEIL - 0.45, row.cz, rl[spec.light], 1.15, 1.0 + G.rng() * 0.9);
        const doorX = spec.side === "W" ? -HALF : HALF;
        addRoomDoor(doorX, row.cz, 3, "z", baseY);
        link(spec.key, "C" + fl + row.corr);
        spec.room = r; spec.baseY = baseY; spec.floor = fl;
        if (spec.classroom) classroomRooms.push(spec);
        world.extraSpawnPoints.push({ pos: new THREE.Vector3(cx, baseY, row.cz), types: fl === 1 ? ["normal", "fast"] : ["normal"] });
      });
    });

    // ---- gym / boss hall (double height, no floor above it) ----
    addSpace("GYM", GYM.cx, GYM.cz, GYM.w, GYM.d, F1);
    addRoomWalls(GYM, { south: { center: 0, width: 6 } }, WH * 2, F1);
    addCeiling(GYM.cx, GYM.cz, GYM.w, GYM.d, F2, CEIL);
    addRoomDoor(0, -31, 6, "x");
    link("GYM", "C1N");
    addLight(GYM.cx - 7, F2 + 2.2, GYM.cz, rl[4], 1.4, 1.1);
    addLight(GYM.cx + 7, F2 + 2.2, GYM.cz, rl[2], 1.2, 1.7);
    addCanvasBox(0, 5.2, GYM.cz - GYM.d / 2 + 0.3, 4.2, 1.8, 0.14, (ctx, cv) => {
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center";
      ctx.font = "bold 22px monospace"; ctx.fillStyle = "#ffcc55";
      ctx.fillText("HOME", 64, 34); ctx.fillText("AWAY", 192, 34);
      ctx.font = "bold 54px monospace"; ctx.fillStyle = "#ff3b3b";
      ctx.fillText("00 : 00", 128, 96);
    }, 0x1a1a1a);
    for (let i = 0; i < 4; i++) {
      addProp(-13 + i * 1.1, GYM.cz + 5, 0.9, 0.45, 0.8, woodDarkMat);
      addProp(13 - i * 1.1, GYM.cz + 5, 0.9, 0.45, 0.8, woodDarkMat);
    }
    addCorpse(4, GYM.cz + 3, 0.7, 0x3a5c8a);
    addBloodStain(4, GYM.cz + 3, 0.9, 0.7);

    // ---- stair hall: one shaft, open through both storeys ----
    addSpace("STAIR1", STAIR.cx, STAIR.cz, STAIR.w, STAIR.d, F1);
    // The opening spans the corridor's full width: a narrower one left the
    // upstairs gallery reachable only through a diagonal pinch between the
    // stairwell railing and the wall stub.
    addRoomWalls(STAIR, { north: { center: 0, width: 7 } }, WH * 2, F1);
    addCeiling(STAIR.cx, STAIR.cz, STAIR.w, STAIR.d, F2, CEIL);
    addRoomDoor(0, 20, 7, "x");
    link("STAIR1", "C1S");
    addLight(STAIR.cx, F2 + 2.0, STAIR.cz, rl[1], 1.2, 1.3);

    // B1: a real flight of voxel steps instead of a sloped slab. The treads
    // are decoration + height zones only (no colliders) -- a collider on each
    // tread would catch the player's body box on the riser in front of them.
    const STEPS = 12, RISE = F2 / STEPS, RUN = 0.65;
    const stairZ0 = 21, stairW = 4;
    for (let i = 0; i < STEPS; i++) {
      const top = (i + 1) * RISE;
      const z0 = stairZ0 + i * RUN;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stairW, top, RUN), accentMat);
      step.position.set(0, top / 2, z0 + RUN / 2);
      scene.add(step);
      world.heightZones.push({ minX: -stairW / 2, maxX: stairW / 2, minZ: z0, maxZ: z0 + RUN, height: top });
      // railings climb with the flight
      [-stairW / 2 - 0.12, stairW / 2 + 0.12].forEach((rx) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), railMat);
        post.position.set(rx, top + 0.5, z0 + RUN / 2);
        scene.add(post);
      });
    }
    const stairTopZ = stairZ0 + STEPS * RUN; // 28.8
    // floor 2 inside the shaft: a gallery wrapping the stairwell void
    const gal = [
      { cx: 0, cz: (stairTopZ + 31) / 2, w: STAIR.w, d: 31 - stairTopZ },          // top landing
      { cx: 0, cz: 20.5, w: STAIR.w, d: 1 },                                        // corridor-side band
      { cx: -(stairW / 2 + 1.25) - 0.0, cz: (21 + stairTopZ) / 2, w: 2.5, d: stairTopZ - 21 },
      { cx: (stairW / 2 + 1.25), cz: (21 + stairTopZ) / 2, w: 2.5, d: stairTopZ - 21 },
    ];
    gal.forEach((g2, i) => {
      addFloor(g2.cx, g2.cz, g2.w, g2.d, F2);
      world.heightZones.push({ minX: g2.cx - g2.w / 2, maxX: g2.cx + g2.w / 2, minZ: g2.cz - g2.d / 2, maxZ: g2.cz + g2.d / 2, height: F2 });
      if (i === 0) world.waypointNodes.STAIR2 = { x: g2.cx, z: g2.cz };
    });
    // one region covering the whole upper gallery (all four bands route as one)
    world.regions.push({ name: "STAIR2", y: F2, minX: -STAIR.w / 2, maxX: STAIR.w / 2, minZ: 20, maxZ: 31 });
    link("STAIR2", "STAIR1");
    link("STAIR2", "C2S");
    // railing around the floor-2 void so you can't walk off into the stairwell
    [[-stairW / 2 - 0.05, 0], [stairW / 2 + 0.05, 0]].forEach(([rx]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, stairTopZ - 21), railMat);
      rail.position.set(rx, F2 + 0.5, (21 + stairTopZ) / 2);
      scene.add(rail);
      world.colliders.push(new THREE.Box3().setFromObject(rail));
    });

    // B2 gate: a roller shutter across the stair-hall doorway instead of the
    // old crossed-beam barricade (A2) -- same unlock rule, nothing to trip on.
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.6, 0.22), metalMat);
    shutter.position.set(0, 1.8, 20.25);
    scene.add(shutter);
    const shutterCollider = new THREE.Box3().setFromObject(shutter);
    world.colliders.push(shutterCollider);
    addGlowBox(0, 3.75, 20.25, 7.3, 0.14, 0.26, 0xffcc33);
    world.secondFloor = {
      unlocked: false, barrierMesh: shutter, barrierCollider: shutterCollider,
      killsNeeded: 20, countMode: "correct", room: { cx: 0, cz: 0.5 }, floorY: F2,
      cratePositions: [new THREE.Vector3(0, F2 + 0.3, 24), new THREE.Vector3(EX, F2 + 0.3, ROWS[0].cz)],
    };

    // ---- per-room dressing, loot, wall guns, classrooms ----
    function dress(spec) {
      const r = spec.room, y = spec.baseY;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let i = 0; i < 3; i++) {
        const [sx, sz] = corners[i];
        const px = r.cx + sx * (r.w / 2 - 1.3), pz = r.cz + sz * (r.d / 2 - 1.3);
        const w = 0.7 + G.rng() * 1.0, h = 0.7 + G.rng() * 1.2, d = 0.6 + G.rng() * 0.8;
        const mat = [woodMat, woodDarkMat, metalMat, lockerMats[i % lockerMats.length]][Math.floor(G.rng() * 4)];
        if (y > 0) addFloatBox(px, y + h / 2, pz, w, h, d, mat);
        else addProp(px, pz, w, h, d, mat);
      }
      if (G.rng() < 0.55) addBloodStain(r.cx + (G.rng() - 0.5) * 3, r.cz + (G.rng() - 0.5) * 3, 0.6 + G.rng() * 0.6, G.rng() * 3);
    }
    // D: full classroom kit -- rows of desks with walking aisles, board on the
    // outer wall (never across a doorway or the player's sightline).
    function furnishClassroom(spec) {
      const r = spec.room, y = spec.baseY;
      const outerX = r.cx < 0 ? r.cx - r.w / 2 + 0.25 : r.cx + r.w / 2 - 0.25;
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 4.2), boardMat);
      board.position.set(outerX, y + 1.9, r.cz);
      scene.add(board);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 4.5), woodDarkMat);
      frame.position.set(outerX + (r.cx < 0 ? 0.04 : -0.04), y + 1.9, r.cz);
      scene.add(frame);
      // desks: 3 columns x 3 rows with 1.4-unit aisles between every column
      const dirX = r.cx < 0 ? 1 : -1; // rows face the board
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
          const px = outerX + dirX * (2.6 + col * 2.6);
          const pz = r.cz - 3.4 + row * 3.4;
          const desk = { w: 1.3, h: 0.75, d: 0.7 };
          if (y > 0) {
            addFloatBox(px, y + desk.h - 0.05, pz, desk.w, 0.1, desk.d, woodMat);
            addFloatBox(px, y + desk.h / 2, pz, 0.1, desk.h, 0.1, metalMat);
            addFloatBox(px - dirX * 0.75, y + 0.45, pz, 0.5, 0.08, 0.5, woodDarkMat);
          } else {
            addProp(px, pz, desk.w, desk.h, desk.d, woodMat);
            addProp(px - dirX * 0.8, pz, 0.5, 0.45, 0.5, woodDarkMat);
          }
        }
      }
    }

    [1, 2].forEach((fl) => ROOM_PLAN[fl].forEach((spec) => {
      dress(spec);
      if (spec.classroom) furnishClassroom(spec);
      if (spec.gun) {
        const wdef = G.WEAPON_DEFS[spec.gun];
        const r = spec.room, y = spec.baseY;
        // mounted on the wall opposite the corridor door, at eye height
        const mx = r.cx < 0 ? r.cx - r.w / 2 + 0.3 : r.cx + r.w / 2 - 0.3;
        const mz = r.cz + (spec.classroom ? 4.2 : 0);
        const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 2.0), new THREE.MeshLambertMaterial({ color: 0x141414 }));
        plaque.position.set(mx, y + 1.85, mz);
        scene.add(plaque);
        const gunMesh = G.buildWeaponMesh(wdef);
        gunMesh.scale.set(3.0, 3.0, 3.0);
        gunMesh.position.set(mx + (r.cx < 0 ? 0.3 : -0.3), y + 2.0, mz);
        gunMesh.rotation.y = r.cx < 0 ? 0 : Math.PI;
        scene.add(gunMesh);
        addCanvasBox(mx + (r.cx < 0 ? 0.08 : -0.08), y + 1.0, mz, 1.5, 0.42, 0.05, (ctx, cv) => {
          ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center";
          ctx.font = "bold 22px sans-serif"; ctx.fillStyle = "#ffd43b"; ctx.fillText(wdef.name, 128, 32);
          ctx.font = "bold 26px monospace"; ctx.fillStyle = "#6bff7a"; ctx.fillText("$" + wdef.price, 128, 70);
        }, 0x1a1a1a, r.cx < 0 ? Math.PI / 2 : -Math.PI / 2);
        const ref = { id: spec.gun, price: wdef.price, purchased: false, gunMesh };
        world.wallWeapons.push(ref);
        world.interactables.push({ mesh: plaque, kind: "wallweapon", ref });
      }
      if (spec.mystery) {
        // F: same box, same behaviour -- moved upstairs and scaled up 1.4x.
        const s = 1.4;
        const mbX = spec.room.cx + spec.room.w / 2 - 2.2, mbZ = spec.room.cz - spec.room.d / 2 + 2.2;
        const crate = addProp(mbX, mbZ, 1.3 * s, 1.0 * s, 1.3 * s, new THREE.MeshLambertMaterial({ color: 0x1b1030 }));
        crate.position.y = spec.baseY + 0.5 * s;
        world.colliders[world.colliders.length - 1] = new THREE.Box3().setFromObject(crate);
        [[0, 0.52, 0.66], [0, 0.52, -0.66], [0.66, 0.52, 0], [-0.66, 0.52, 0]].forEach(([ox, oy, oz]) => {
          addGlowBox(mbX + ox * s, spec.baseY + (oy + 0.5) * s, mbZ + oz * s, ox ? 0.06 : 1.32 * s, 0.06, oz ? 0.06 : 1.32 * s, 0x7f5bff);
        });
        addCanvasBox(mbX, spec.baseY + 1.25 * s, mbZ + 0.67 * s, 0.9 * s, 0.7 * s, 0.05, (ctx, cv) => {
          ctx.fillStyle = "#12071f"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; ctx.font = "bold 84px sans-serif"; ctx.fillStyle = "#c9a3ff";
          ctx.fillText("?", 128, 96);
        }, 0x2a1350);
        world.mysteryBox = { mesh: crate, x: mbX, z: mbZ, uses: 0 };
        world.interactables.push({ mesh: crate, kind: "mysterybox", ref: world.mysteryBox });
      }
      if (spec.button) {
        const bm = addProp(spec.room.cx - 3, spec.room.cz + 4, 0.35, 0.35, 0.35, new THREE.MeshLambertMaterial({ color: 0xff4444 }), 0, 0, 0, true);
        bm.position.y = spec.baseY + 1.3;
        world.buttons.push({ mesh: bm, pressed: false });
        world.interactables.push({ mesh: bm, kind: "button", ref: world.buttons[world.buttons.length - 1] });
      }
      // a lootable, word-locked crate in about half the rooms
      if ((spec.row + (spec.side === "W" ? 0 : 1)) % 2 === 0) {
        const cm = addProp(spec.room.cx + 2.5, spec.room.cz - 2.5, 0.8, 0.8, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
        cm.position.y = spec.baseY + 0.4;
        world.colliders[world.colliders.length - 1] = new THREE.Box3().setFromObject(cm);
        world.crates.push({ mesh: cm, opened: false, locked: true });
        world.interactables.push({ mesh: cm, kind: "crate", ref: world.crates[world.crates.length - 1] });
      }
    }));

    // secret area: the staff room stays shut until the library button is hit
    const staff = ROOM_PLAN[1].find((s) => s.secret);
    const barricade = addBarricade(-HALF - 0.4, staff.room.cz, 3, new THREE.MeshLambertMaterial({ color: 0x5c5438 }));
    world.secretZone = {
      center: new THREE.Vector3(staff.room.cx, 0, staff.room.cz), radius: 6, unlocked: false,
      barricadeMesh: barricade.mesh, barricadeCollider: barricade.collider,
    };

    // word-locked door on the storage room (which holds a wall gun)
    const store = ROOM_PLAN[1].find((s) => s.wordDoor);
    const lockedDoor = addProp(HALF + 0.45, store.room.cz, 0.3, 3, 2.8, new THREE.MeshLambertMaterial({ color: 0xb2452f }));
    addGlowBox(HALF + 0.45, 3.05, store.room.cz, 0.34, 0.1, 2.9, 0xffcc33);
    world.doors.push({ mesh: lockedDoor, locked: true, kind: "word", opened: false, collider: world.colliders[world.colliders.length - 1] });
    world.interactables.push({ mesh: lockedDoor, kind: "door", ref: world.doors[world.doors.length - 1] });

    // spike trap in the north corridor, on the approach to the gym
    const trapMesh = addProp(0, -29, 5.6, 0.25, 0.8, new THREE.MeshLambertMaterial({ color: 0xff2222 }), 0, 0, 0, true);
    trapMesh.position.y = 0.12;
    world.traps.push({ mesh: trapMesh, active: true, damage: 45, cooldown: 0, collider: null });
    world.interactables.push({ mesh: trapMesh, kind: "trap", ref: world.traps[world.traps.length - 1] });

    // corridor dressing: lockers lining the main hall on both floors
    [1, 2].forEach((fl) => {
      const y = fl === 1 ? F1 : F2;
      for (let i = 0; i < 8; i++) {
        const z = 16 - i * 4.4;
        if (Math.abs(z - 13.5) < 1.6) continue;
        const mat = lockerMats[i % lockerMats.length];
        if (y > 0) { addFloatBox(-HALF + 0.35, y + 1.1, z, 0.5, 2.2, 0.9, mat); addFloatBox(HALF - 0.35, y + 1.1, z + 2.2, 0.5, 2.2, 0.9, mat); }
        else { addProp(-HALF + 0.35, z, 0.5, 2.2, 0.9, mat); addProp(HALF - 0.35, z + 2.2, 0.5, 2.2, 0.9, mat); }
      }
    });

    // spawn points in the shared spaces too
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(0, 0, 10), types: ["normal"] });
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(0, 0, -14), types: ["normal", "fast"] });
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(-8, 0, GYM.cz), types: ["normal", "fast"] });
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(8, 0, GYM.cz), types: ["normal", "fast"] });
    world.spawnPoints = world.extraSpawnPoints.map((sp) => Object.assign(sp, { cooldown: 0 }));
    world.spawnPoints.push(Object.assign({ pos: new THREE.Vector3(0, 0, GYM.cz - 3), types: ["boss"] }, { cooldown: 0 }));
    world.extraSpawnPoints = null;
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
  // The school builds its own spawn list / interactables, since none of the
  // shared A-E room coordinates below exist in its two-storey layout.
  if (level.theme !== "school") {

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

  } // end non-school spawn points + interactions

  world.spawn = { x: 0, z: 3 };
  world.bossRoomCenter = level.theme === "school"
    ? new THREE.Vector3(0, 0, -38.5)              // the gym at the north end
    : new THREE.Vector3(ROOMS.E.cx, 0, ROOMS.E.cz - 2);

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
