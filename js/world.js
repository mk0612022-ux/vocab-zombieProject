// ============================================================
// WORLD: level defs, voxel scene builders, spawner, interactions, boss
// ============================================================
window.G = window.G || {};

// ---------------- Level definitions ----------------
// names are "level.<id>" in js/strings.js, set on load by G.localizeData
G.LEVELS = [
  {
    id: 1, theme: "school", icon: "🏚️", wordsKey: "level1",
    waves: 5, difficulty: 1, bossEvery: 3,
    spawnBaseInterval: 5.0, maxAliveZombies: 7,
  },
  {
    id: 2, theme: "hospital", icon: "🏥", wordsKey: "level2",
    waves: 6, difficulty: 1.35, bossEvery: 3,
    spawnBaseInterval: 4.2, maxAliveZombies: 9,
  },
  {
    id: 3, theme: "bunker", icon: "🛡️", wordsKey: "level3",
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
    floor: 0x4a4740, floorLine: 0x2e2c27, floorStain: 0x3d3624, wall: 0xb3a98c, accent: 0x8a3a2e,
    // C1: dusk outside. A cool blue-grey haze that the warm room lights inside
    // read against, and a far plane that actually reaches across the yard.
    fog: 0x1e2530, fogNear: 4, fogFar: 44, light: 0xdadad0, ambient: 0x3f4046,
    roomLight: [0xdadad0, 0xcfe8ff, 0xe8dca0, 0x8a3a2e, 0xffe08a],
  },
  hospital: {
    floor: 0x18261d, floorLine: 0x0e1811, floorStain: 0x24352a, wall: 0x203024, accent: 0x3d6b52,
    // lifted with the rebuild (category M): the level is five times the size
    // now, and at the old settings everything past the next doorway was black
    fog: 0x0b150f, fogNear: 3, fogFar: 34, light: 0x7dffc0, ambient: 0x2b3c31,
    roomLight: [0x7dffc0, 0x6bd4ff, 0xff6b6b, 0x9dffb0, 0xffe27a],
  },
  bunker: {
    floor: 0x161615, floorLine: 0x0a0a0a, floorStain: 0x24211c, wall: 0x232320, accent: 0x35322a,
    fog: 0x060605, fogNear: 2.2, fogFar: 27, light: 0xff9a4d, ambient: 0x22201b,
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
G.LIGHT_CULL_DIST = 34;
G.updateFlickerLights = function (world, tSec, camPos) {
  if (!world || !world.lights) return;
  for (const l of world.lights) {
    const u = l.userData;
    if (!u || u.base == null) continue;
    // The rebuilt school carries well over thirty point lights. A light the
    // player cannot possibly see still costs a full lighting slot in every
    // shader, so anything past its own falloff is switched off for the frame
    // -- three.js skips invisible lights entirely when it collects them.
    if (camPos) {
      const dx = l.position.x - camPos.x, dy = l.position.y - camPos.y, dz = l.position.z - camPos.z;
      const far = dx * dx + dy * dy + dz * dz > G.LIGHT_CULL_DIST * G.LIGHT_CULL_DIST;
      if (l.visible === far) l.visible = !far;
      if (far) continue;
    }
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
  // one flat MeshLambertMaterial color -- item 2's "tile pattern / scratches / grime".
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
    // BoxGeometry face order: [px, nx, py, ny, pz, nz] -- only the top (py) gets
    // the tile texture. The UNDERSIDE (ny) is the ceiling of whatever is below:
    // in the lobby the upstairs floor slab IS the ceiling, and leaving it the
    // near-black floor-edge colour made those bays read as holes.
    const mats = [floorSideMat, floorSideMat, topMat, ceilingMat, floorSideMat, floorSideMat];
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
  // Category B: sliding doors. Every doorway gets sliding panels -- one leaf
  // for a room door, a split pair for the wide openings (the boss hall, the
  // entry hall, the school's front doors). axis "x" = the opening runs along
  // X (so the panels block Z travel), axis "z" = the reverse.
  // Where a panel can slide to depends on what stands beside the doorway --
  // lockers, furniture, a wall gun -- and that is only known once the whole
  // map is built. So addRoomDoor() reserves the doorway (a closed collider,
  // plus the wall over a room door) and buildSlidingDoors() fits the panels
  // at the very end.
  // Doors start closed (so you never know what's behind one until you open
  // it); a zombie held up against a closed door bashes it open after a couple
  // of seconds, which is what keeps a fully-shut map from soft-locking a wave.
  const doorPanelMat = new THREE.MeshLambertMaterial({ color: level.theme === "school" ? 0x9c4a33 : pal.accent });
  const doorPullMat = new THREE.MeshLambertMaterial({ color: 0x1c1a18 });
  const doorFrameMat = new THREE.MeshLambertMaterial({ color: level.theme === "school" ? 0x6b4a2f : level.theme === "hospital" ? 0xb9c4c2 : 0x55584f });
  const doorRailMat = new THREE.MeshLambertMaterial({ color: 0x8e9296 });
  const DOOR_H = 2.9;
  function addRoomDoor(cx, cz, width, axis, baseY) {
    baseY = baseY || 0;
    const half = width / 2;
    const root = new THREE.Group();
    root.position.set(cx, baseY, cz);
    scene.add(root);
    const collider = new THREE.Box3(
      new THREE.Vector3(axis === "x" ? cx - half : cx - 0.3, baseY, axis === "x" ? cz - 0.3 : cz - half),
      new THREE.Vector3(axis === "x" ? cx + half : cx + 0.3, baseY + DOOR_H, axis === "x" ? cz + 0.3 : cz + half));
    // A room doorway was cut the full height of the wall, leaving a 1.3m slot
    // over the door you could see (and shoot) straight through. It is wall now.
    if (width <= 3.5) {
      const top = 4.2 - (DOOR_H + 0.1);
      if (axis === "x") addWallSeg(cx, cz, width, 0.4, top, baseY + DOOR_H + 0.1);
      else addWallSeg(cx, cz, 0.4, width, top, baseY + DOOR_H + 0.1);
    }
    const ref = {
      mesh: root, open: false, axis, width, x: cx, z: cz, baseY, h: DOOR_H, double: width >= 5,
      leaves: [], colliders: [collider], collider, style: null,
      p: 0, from: 0, to: 0, animT: 1, dur: 0.45, settleT: 0, bashTimer: 0,
    };
    world.colliders.push(collider);
    world.roomDoors.push(ref);
    world.interactables.push({ mesh: root, kind: "roomdoor", ref });
    return ref;
  }

  // ---- fitting the panels -------------------------------------------------
  // Door-local frame: "a" runs along the opening (0 = its centre), "n" across
  // it (0 = the middle of the 0.4m wall, the faces at n = +-0.2).
  function doorToWorld(d, a, n, y) {
    return d.axis === "x" ? new THREE.Vector3(d.x + a, y, d.z + n) : new THREE.Vector3(d.x + n, y, d.z + a);
  }
  function doorBox(d, a0, a1, n0, n1, y0, y1) {
    const p = doorToWorld(d, Math.min(a0, a1), Math.min(n0, n1), d.baseY + y0);
    const q = doorToWorld(d, Math.max(a0, a1), Math.max(n0, n1), d.baseY + y1);
    return new THREE.Box3(p.clone().min(q), p.clone().max(q));
  }
  const DOOR_T = 0.08;                     // panel thickness
  const FACE_N = 0.2 + 0.03 + DOOR_T / 2;  // a surface panel's plane, off the wall face
  // A leaf: where it sits closed (centre a0, length L, plane n), which way it
  // opens (dir) and how far (T).
  function planLeaves(d, style, face, dir) {
    const half = d.width / 2;
    if (!d.double) {
      if (style === "pocket") {
        // tucked 0.1 into the pocket when shut, its pull edge left 8cm proud
        // of the jamb when open, the way a real pocket door is left
        const L = d.width + 0.12;
        const lead = -dir * (half + 0.02);
        return [{ dir, L, a0: lead + dir * L / 2, n: 0, T: d.width - 0.06 }];
      }
      const L = d.width + 0.1;
      return [{ dir, L, a0: 0, n: face * FACE_N, T: d.width + 0.05 }];
    }
    if (style === "pocket") {
      const L = half + 0.1;
      return [-1, 1].map((s) => ({ dir: s, L, a0: s * L / 2, n: 0, T: half - 0.04 }));
    }
    const L = half + 0.05;
    return [-1, 1].map((s) => ({ dir: s, L, a0: s * L / 2, n: face * FACE_N, T: half + 0.05 }));
  }
  // Everything already standing in the level, as boxes -- the doors' own
  // groups left out.
  function sceneObstacles() {
    const roots = new Set(world.roomDoors.map((d) => d.mesh));
    const out = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      for (let p = o; p; p = p.parent) if (roots.has(p)) return;
      const b = new THREE.Box3().setFromObject(o);
      if (!b.isEmpty()) out.push(b);
    });
    return out;
  }
  function wallSolid(d, a0, a1, walls) {
    // sampled down the middle of the wall at knee, waist and head height
    for (let a = Math.min(a0, a1); a <= Math.max(a0, a1) + 1e-6; a += 0.2) {
      for (const y of [0.4, 1.4, 2.5]) {
        const p = doorToWorld(d, a, 0, d.baseY + y);
        if (!walls.some((c) => c.containsPoint(p))) return false;
      }
    }
    return true;
  }
  // Can this leaf open that way? A surface leaf needs the wall face beside the
  // doorway clear (and a wall behind it to run along); a pocket leaf needs the
  // wall itself to be solid for the whole of its pocket.
  function leafFits(d, leaf, walls, obstacles) {
    const half = d.width / 2;
    const c = leaf.a0 + leaf.dir * leaf.T;          // centre when open
    const lo = c - leaf.L / 2, hi = c + leaf.L / 2;
    const outer = leaf.dir > 0 ? [half, hi + 0.05] : [lo - 0.05, -half];
    if (leaf.n === 0) return wallSolid(d, outer[0], outer[1], walls);
    const s = Math.sign(leaf.n);
    const room = doorBox(d, outer[0], outer[1] + (leaf.dir > 0 ? 0.08 : -0.08), s * 0.21, s * 0.4, 0.06, DOOR_H + 0.05);
    if (obstacles.some((b) => b.intersectsBox(room))) return false;
    return wallSolid(d, outer[0] + 0.1, outer[1] - 0.05, walls);
  }
  function buildSlidingDoors() {
    const placeholders = new Set(world.roomDoors.map((d) => d.collider));
    const walls = world.colliders.filter((c) => !placeholders.has(c));
    const obstacles = sceneObstacles();
    const tally = { single: 0, double: 0, parallel: 0, pocket: 0, forced: 0 };
    world.roomDoors.forEach((d, i) => {
      // Which face first: a room door slides along the corridor (the side
      // facing the building's spine); a wide door on the side of the bigger
      // space it opens into.
      let prefFace;
      if (!d.double) prefFace = -Math.sign(d.axis === "z" ? d.x : d.z) || 1;
      else {
        const areaAt = (s) => {
          const p = doorToWorld(d, 0, s * 1.5, d.baseY + 1);
          const r = world.regions.find((g) => p.x >= g.minX && p.x <= g.maxX && p.z >= g.minZ && p.z <= g.maxZ && Math.abs((g.y || 0) - d.baseY) < 1);
          return r ? (r.maxX - r.minX) * (r.maxZ - r.minZ) : 0;
        };
        prefFace = areaAt(1) >= areaAt(-1) ? 1 : -1;
      }
      const prefDir = i % 2 ? -1 : 1;        // neighbours alternate where they can
      let options = [];
      [prefFace, -prefFace].forEach((f) => [prefDir, -prefDir].forEach((dir) => options.push({ style: "parallel", face: f, dir })));
      [prefDir, -prefDir].forEach((dir) => options.push({ style: "pocket", face: 0, dir }));
      if (d.double) options = [{ style: "parallel", face: prefFace, dir: 1 }, { style: "parallel", face: -prefFace, dir: 1 }, { style: "pocket", face: 0, dir: 1 }];
      let pick = null;
      for (const o of options) {
        const leaves = planLeaves(d, o.style, o.face, o.dir);
        if (leaves.every((lf) => leafFits(d, lf, walls, obstacles))) { pick = Object.assign({ leaves }, o); break; }
      }
      if (!pick) { pick = { style: "pocket", face: 0, dir: prefDir, leaves: planLeaves(d, "pocket", 0, prefDir), forced: true }; tally.forced++; }
      d.style = pick.style; d.leaves = pick.leaves;
      tally[d.double ? "double" : "single"]++; tally[pick.style]++;
      fitDoor(d, pick);
    });
    world.doorTally = tally;
  }
  function fitDoor(d, pick) {
    const H = DOOR_H, half = d.width / 2;
    const along = (len, h, thick) => d.axis === "x" ? new THREE.BoxGeometry(len, h, thick) : new THREE.BoxGeometry(thick, h, len);
    const place = (m, a, y, n) => { const p = doorToWorld(d, a, n, 0); m.position.set(p.x - d.x, y, p.z - d.z); };
    // frame: two jambs and a head, proud of both faces -- static, so it lives
    // outside the door group and gets merged with the rest of the building
    const addStatic = (geo, mat, a, y, n) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(doorToWorld(d, a, n, d.baseY + y));
      scene.add(m);
      return m;
    };
    [-1, 1].forEach((s) => addStatic(along(0.1, H + 0.06, 0.5), doorFrameMat, s * (half + 0.02), (H + 0.06) / 2, 0));
    addStatic(along(d.width + 0.24, 0.1, 0.5), doorFrameMat, 0, H + 0.05, 0);
    // the top rail the panels hang from, run out over the whole travel
    if (pick.style === "parallel") {
      let lo = -half - 0.1, hi = half + 0.1;
      d.leaves.forEach((lf) => {
        const c = lf.a0 + lf.dir * lf.T;
        lo = Math.min(lo, c - lf.L / 2 - 0.06); hi = Math.max(hi, c + lf.L / 2 + 0.06);
      });
      const n = d.leaves[0].n, s = Math.sign(n);
      addStatic(along(hi - lo, 0.07, 0.07), doorRailMat, (lo + hi) / 2, H + 0.06, n);
      // brackets back to the wall at both ends
      [lo + 0.05, hi - 0.05].forEach((a) => addStatic(along(0.05, 0.07, Math.abs(n) - 0.2), doorRailMat, a, H + 0.06, s * (0.2 + (Math.abs(n) - 0.2) / 2)));
    }
    // the panels, each with a recessed pull near its leading edge
    d.leaves.forEach((lf) => {
      const panel = new THREE.Mesh(along(lf.L, H - 0.04, DOOR_T), doorPanelMat);
      const lead = -lf.dir;                                 // the edge that closes the gap
      const pull = new THREE.Mesh(along(0.07, 0.3, DOOR_T + 0.012), doorPullMat);
      const pa = lead * (lf.L / 2 - (pick.style === "pocket" && !d.double ? 0.05 : 0.14));
      pull.position.copy(doorToWorld({ axis: d.axis, x: 0, z: 0 }, pa, 0, 1.05 - (H - 0.04) / 2));
      panel.add(pull);
      place(panel, lf.a0, (H - 0.04) / 2, lf.n);
      d.mesh.add(panel);
      lf.mesh = panel;
      lf.collider = new THREE.Box3();
    });
    // the placeholder gives way to one collider per panel, kept on the panel
    const i = world.colliders.indexOf(d.collider);
    if (i >= 0) world.colliders.splice(i, 1);
    d.colliders = d.leaves.map((lf) => lf.collider);
    d.collider = d.colliders[0];
    d.colliders.forEach((c) => world.colliders.push(c));
    G.placeDoorLeaves(d, 0, 0);
    // what the "press E" ray hits whether the door is open or shut: the
    // doorway itself (never drawn)
    const hit = new THREE.Mesh(along(d.width, H, 0.5), doorPullMat);
    hit.visible = false;
    place(hit, 0, H / 2, 0);
    d.mesh.add(hit);
  }
  // The word-locked door (a panel just inside the store room) slides open too
  // once its word is answered, to whichever side has room -- the room door's
  // panels included, which are fitted first.
  function fitWordDoorSlide() {
    const wd = world.doors.find((d) => d.kind === "word");
    if (!wd) return;
    const m = wd.mesh, gp = m.geometry.parameters;
    const alongZ = gp.depth >= gp.width;
    const L = alongZ ? gp.depth : gp.width;
    const bb = new THREE.Box3().setFromObject(m);
    const obstacles = sceneObstacles().filter((b) => !b.equals(bb));
    world.roomDoors.forEach((d) => d.leaves.forEach((lf) => {
      const c = lf.a0 + lf.dir * lf.T;
      obstacles.push(doorBox(d, c - lf.L / 2, c + lf.L / 2, lf.n - 0.1, lf.n + 0.1, 0, DOOR_H));
    }));
    for (const dir of [1, -1]) {
      const shift = new THREE.Vector3(alongZ ? 0 : dir * (L + 0.1), 0, alongZ ? dir * (L + 0.1) : 0);
      const dest = bb.clone().translate(shift).expandByScalar(-0.03);
      dest.min.y = Math.max(dest.min.y, bb.min.y + 0.06);
      dest.max.y = Math.min(dest.max.y, bb.min.y + 3.0);
      if (!obstacles.some((b) => b.intersectsBox(dest))) { wd.slide = shift; return; }
    }
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
  // `opts` lets a body be posed off the floor -- {y, rz, rx} -- for the ones
  // slumped over furniture or draped across the downed fence outside.
  function addCorpse(x, z, ry, clothColor, opts) {
    opts = opts || {};
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
    g.position.set(x, opts.y || 0, z);
    if (ry) g.rotation.y = ry;
    if (opts.rz) g.rotation.z = opts.rz;
    if (opts.rx) g.rotation.x = opts.rx;
    scene.add(g);
  }
  // A flat blood stain/scuff decal on the floor -- purely cosmetic.
  function addBloodStain(x, z, size, ry) {
    const stain = new THREE.Mesh(new THREE.BoxGeometry(size, 0.012, size * (0.6 + G.rng() * 0.4)), new THREE.MeshBasicMaterial({ color: 0x5a0e0e, transparent: true, opacity: 0.75 }));
    stain.position.set(x, 0.006, z);
    if (ry) stain.rotation.y = ry;
    scene.add(stain);
  }


  // ---------------- Landmark decorators (one per theme) ----------------
  // Shared rule (item 4): every recurring object type keeps ONE consistent
  // color set everywhere it appears in a given level (ammo crates are always
  // the same yellow/black, lockers always the same blue, etc).
  // ================= Room complex builder (categories C3 and M) =================
  // All three levels are built by one parameterised generator. Before this the
  // school was a purpose-built two-storey block and the other two shared a
  // five-room hub layout with theme paint on top -- which is why the hospital
  // and the bunker came out at about an eighth of the school's size, with one
  // wall gun each and almost no cover.
  //
  // The shape every level shares:
  //
  //     [ boss hall ]            -Z end, double height, no floor above
  //          |
  //     [ spine corridor with rooms down both sides, N rows ]
  //          |
  //     [ entry hall ]           +Z end, holds the staircase on two-storey maps
  //          |
  //     [ yard ]                 outdoors, school only
  //
  // What a plan changes: how many rows, how wide the rooms and corridor are,
  // one storey or two, what each room is called and carries, the boss hall and
  // entry hall dimensions, and the per-room furniture.
  function buildComplex(cfg) {
    const F1 = 0, F2 = cfg.f2 || 4.2, WH = cfg.wallH || 4.2, CEIL = 3.95;
    // Pass D3: in the school some rooms light normally, some flicker and some
    // are dead dark, so walking the building has a rhythm of light and dark.
    // The ceiling fixtures are fitted later (G.SchoolDress) from this list.
    world.fixtures = [];
    function schoolLight(key, x, baseY, z, color, intensity, speed, w, d) {
      const mode = level.theme === "school" && G.SchoolDress ? G.SchoolDress.lightMode(key) : "steady";
      const l = mode === "off" ? null : addLight(x, baseY + CEIL - 0.45, z, color, intensity, speed);
      if (l && mode === "flicker") l.userData.mode = "flicker";
      // point lights ignore walls: at the default 13m a room lit its dark
      // neighbours through them, so a dead room never looked dead
      if (l && level.theme === "school") l.distance = /^C\d/.test(key) ? 11 : 8.5;
      world.fixtures.push({ key, x, z, baseY, mode, light: l, w, d, color });
      return l;
    }
    // what the school dressing (js/schooldress.js) gets to work with
    function dressApi() {
      return { scene, world, cfg, level, quality, M, ENTRY, BOSS, F1, F2, WH, CEIL, HALF, ROOM_W, WX, EX,
        storeyList, corrZ0, corrZ1, wallMat, ceilingMat,
        addSolid, addFloatBox, addGlowBox, addCanvasBox, addLight, addProp, addBloodStain };
    }
    const HALF = cfg.half, ROOM_W = cfg.roomW;
    const WX = -(HALF + ROOM_W / 2), EX = HALF + ROOM_W / 2;
    const STOREYS = cfg.storeys;
    const BOSS = cfg.boss, ENTRY = cfg.entry;
    const M = cfg.mats;
    const rl = pal.roomLight;

    world.regions = []; world.waypointNodes = {}; world.waypointEdges = {};
    world.extraSpawnPoints = [];
    world.wallWeapons = [];
    world.keys = [];
    // category I: the rooms the "explore" objective counts -- every real room,
    // not corridors, halls or the gallery
    world.roomNames = new Set(cfg.plan.map((s) => s.key).concat(cfg.storeys === 2 ? cfg.upperKeys : []));

    // A hidden key (category I): a ring, a shaft and two teeth, gold and
    // self-lit so it reads in the dark from across a room.
    function buildKeyMesh() {
      const g = new THREE.Group();
      const gold = new THREE.MeshBasicMaterial({ color: 0xffd43b });
      const dark = new THREE.MeshLambertMaterial({ color: 0xb8860b });
      [[0, 0.16, 0.2, 0.05], [0, -0.0, 0.2, 0.05], [-0.08, 0.08, 0.05, 0.2], [0.08, 0.08, 0.05, 0.2]].forEach(([x, y, w, h]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), gold); b.position.set(x, y, 0); g.add(b);
      });
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), dark); shaft.position.set(0, -0.2, 0); g.add(shaft);
      [[0.05, -0.3], [0.05, -0.38]].forEach(([x, y]) => {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), gold); t.position.set(x, y, 0); g.add(t);
      });
      g.scale.set(1.6, 1.6, 1.6);
      return g;
    }

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
      world.waypointNodes[key] = { x: cx, z: cz, y: baseY };
      world.waypointEdges[key] = world.waypointEdges[key] || [];
    }
    // addProp anchors to y=0, so every piece of upstairs furniture had to go
    // through addFloatBox -- which registers no collider, leaving the whole
    // second storey walk-through. This places a solid prop at any height.
    const solidProps = [];
    function addSolid(x, y, z, w, h, d, mat, rz, ry) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h / 2, z);
      if (rz) m.rotation.z = rz;
      if (ry) m.rotation.y = ry;
      scene.add(m);
      const box = new THREE.Box3().setFromObject(m);
      world.colliders.push(box);
      solidProps.push({ mesh: m, collider: box });
      return m;
    }

    // ---- C3: tactical cover ----------------------------------------------
    // Tipped furniture, crates, trolleys and rubble. Anything under 0.6 tall
    // stays collider-free so the floor never becomes a minefield of ankle-high
    // walls, and every piece is kept out of a protected lane so a route can't
    // be plugged.
    function clutterPiece(x, y, z) {
      const kind = Math.floor(G.rng() * 5);
      const ry = G.rng() * Math.PI;
      if (kind === 0) {
        addSolid(x, y, z, 1.3, 0.72, 0.7, M.wood, Math.PI / 2 * (G.rng() < 0.5 ? 1 : -1), ry);
        addFloatBox(x + 0.4, y + 0.1, z + 0.3, 0.45, 0.06, 0.35, M.woodDark, ry);
      } else if (kind === 1) {
        addSolid(x, y, z, 1.0, 1.9, 0.52, M.metal, Math.PI / 2, ry);
        addFloatBox(x - 0.3, y + 0.06, z + 0.5, 0.3, 0.04, 0.4, M.woodDark, ry);
      } else if (kind === 2) {
        addSolid(x, y, z, 0.9, 0.9, 0.9, M.crate, 0, ry);
        if (G.rng() < 0.6) addSolid(x + 0.25, y + 0.9, z - 0.2, 0.6, 0.6, 0.6, M.crate, 0, ry * 1.7);
      } else if (kind === 3) {
        addSolid(x, y + 0.28, z, 1.05, 0.62, 0.66, M.metal, 0, ry);
        [[-0.42, -0.26], [-0.42, 0.26], [0.42, -0.26], [0.42, 0.26]].forEach(([dx, dz]) => {
          addFloatBox(x + dx, y + 0.13, z + dz, 0.12, 0.26, 0.12, M.woodDark);
        });
      } else {
        for (let i = 0; i < 4; i++) {
          addFloatBox(x + (G.rng() - 0.5) * 1.5, y + 0.07, z + (G.rng() - 0.5) * 1.5,
            0.25 + G.rng() * 0.4, 0.14, 0.2 + G.rng() * 0.4, M.rubble, G.rng() * 3);
        }
      }
    }
    function scatterClutter(cx, cz, w, d, y, count, lane) {
      for (let i = 0; i < count; i++) {
        let x = 0, z = 0, ok = false;
        for (let t = 0; t < 14 && !ok; t++) {
          x = cx + (G.rng() - 0.5) * (w - 2.6);
          z = cz + (G.rng() - 0.5) * (d - 2.6);
          ok = !lane || (lane.axis === "x" ? Math.abs(z - lane.at) > lane.half : Math.abs(x - lane.at) > lane.half);
        }
        if (ok) clutterPiece(x, y, z);
      }
    }

    // Shared wall-gun mount: plaque + scaled weapon mesh + price card.
    // facingWest = the gun hangs on a wall to the player's west and points east.
    function mountWallGun(id, mx, y, mz, facingWest) {
      const wdef = G.WEAPON_DEFS[id];
      if (!wdef) return;
      const sign = facingWest ? 1 : -1;
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 2.0), new THREE.MeshLambertMaterial({ color: 0x141414 }));
      plaque.position.set(mx, y + 1.85, mz);
      scene.add(plaque);
      const gunMesh = G.buildWeaponMesh(wdef);
      gunMesh.scale.set(3.0, 3.0, 3.0);
      gunMesh.position.set(mx + sign * 0.3, y + 2.0, mz);
      gunMesh.rotation.y = facingWest ? 0 : Math.PI;
      scene.add(gunMesh);
      addCanvasBox(mx + sign * 0.08, y + 1.0, mz, 1.5, 0.42, 0.05, (ctx, cv) => {
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.textAlign = "center";
        G.fitFont(ctx, wdef.name, 20, 240); ctx.fillStyle = "#ffd43b"; ctx.fillText(wdef.name, 128, 28);
        ctx.font = "bold 24px monospace"; ctx.fillStyle = "#6bff7a"; ctx.fillText("$" + wdef.price, 128, 62);
        const wc = G.weightClass(wdef);
        const wt = G.T("world.wallWeight", { w: wc.label });
        G.fitFont(ctx, wt, 17, 240); ctx.fillStyle = wc.color;
        ctx.fillText(wt, 128, 92);
      }, 0x1a1a1a, facingWest ? Math.PI / 2 : -Math.PI / 2);
      const ref = { id, price: wdef.price, purchased: false, gunMesh };
      world.wallWeapons.push(ref);
      world.interactables.push({ mesh: plaque, kind: "wallweapon", ref });
    }

    // ---- corridors, every storey ----
    const storeyList = STOREYS === 2 ? [1, 2] : [1];
    storeyList.forEach((fl) => {
      const baseY = fl === 1 ? F1 : F2;
      cfg.corrSegs.forEach((c) => {
        const key = "C" + fl + c.name;
        addSpace(key, 0, c.cz, HALF * 2, c.d, baseY);
        addCeiling(0, c.cz, HALF * 2, c.d, baseY, CEIL);
        schoolLight("C" + fl + c.name, 0, baseY, c.cz, rl[fl === 1 ? 0 : 1], 1.0, 1.2 + G.rng() * 0.7, HALF * 2, c.d);
      });
      for (let i = 0; i < cfg.corrSegs.length - 1; i++) {
        link("C" + fl + cfg.corrSegs[i].name, "C" + fl + cfg.corrSegs[i + 1].name);
      }
    });

    // ---- rooms ----
    cfg.plan.forEach((spec) => {
      const fl = spec.storey || 1;
      const baseY = fl === 1 ? F1 : F2;
      const row = cfg.rows[spec.row];
      const cx = spec.side === "W" ? WX : EX;
      const r = { cx, cz: row.cz, w: ROOM_W, d: row.d };
      addSpace(spec.key, cx, row.cz, ROOM_W, row.d, baseY);
      addCeiling(cx, row.cz, ROOM_W, row.d, baseY, CEIL);
      const gaps = spec.side === "W"
        ? { east: { center: row.cz, width: 3 } }
        : { west: { center: row.cz, width: 3 } };
      addRoomWalls(r, gaps, WH, baseY);
      schoolLight(spec.key, cx, baseY, row.cz, rl[spec.light % rl.length], 1.15, 1.0 + G.rng() * 0.9, ROOM_W, row.d);
      addRoomDoor(spec.side === "W" ? -HALF : HALF, row.cz, 3, "z", baseY);
      // A room is entered through its door, not its wall: the route passes a
      // node just inside the corridor in front of the doorway. Without it a
      // zombie in a long corridor steered straight at the room's centre and
      // pinned itself against the wall beside the door (category P).
      const dKey = "D" + spec.key;
      world.waypointNodes[dKey] = { x: (spec.side === "W" ? -1 : 1) * (HALF - 1.0), z: row.cz, y: baseY };
      link(spec.key, dKey); link(dKey, "C" + fl + row.corr);
      spec.room = r; spec.baseY = baseY; spec.floor = fl;
      world.extraSpawnPoints.push({ pos: new THREE.Vector3(cx, baseY, row.cz), types: fl === 1 ? ["normal", "fast"] : ["normal"] });
    });

    // ---- boss hall (double height, no floor above it) ----
    addSpace("BOSS", BOSS.cx, BOSS.cz, BOSS.w, BOSS.d, F1);
    addRoomWalls(BOSS, { south: { center: 0, width: 6 } }, WH * 2, F1);
    addCeiling(BOSS.cx, BOSS.cz, BOSS.w, BOSS.d, F2, CEIL);
    addRoomDoor(0, BOSS.cz + BOSS.d / 2, 6, "x");
    addWallSeg(0, BOSS.cz + BOSS.d / 2, 6, 0.4, 5.5, 2.9);   // lintel over the doors
    link("BOSS", "C1" + cfg.corrSegs[cfg.corrSegs.length - 1].name);
    addLight(BOSS.cx - BOSS.w * 0.25, F2 + 2.2, BOSS.cz, rl[4 % rl.length], 1.4, 1.1);
    addLight(BOSS.cx + BOSS.w * 0.25, F2 + 2.2, BOSS.cz, rl[2 % rl.length], 1.2, 1.7);
    addLight(BOSS.cx - BOSS.w * 0.35, F2 + 2.4, BOSS.cz - BOSS.d * 0.28, rl[2 % rl.length], 1.2, 1.3);
    addLight(BOSS.cx + BOSS.w * 0.35, F2 + 2.4, BOSS.cz + BOSS.d * 0.28, rl[4 % rl.length], 1.2, 1.9);
    scatterClutter(BOSS.cx, BOSS.cz, BOSS.w - 12, BOSS.d - 5, F1, 5, { axis: "z", at: 0, half: 4 });

    // ---- entry hall ----
    const ENTRY_R = { cx: 0, cz: ENTRY.cz, w: ENTRY.w, d: ENTRY.d };
    addSpace("ENTRY", 0, ENTRY.cz, ENTRY.w, ENTRY.d, F1);
    const entryGaps = { north: { center: 0, width: 7 } };
    if (cfg.yard) entryGaps.south = { center: 0, width: 6 };
    addRoomWalls(ENTRY_R, entryGaps, WH * 2, F1);
    addRoomDoor(0, ENTRY.cz - ENTRY.d / 2, 7, "x");
    if (cfg.yard) {
      addRoomDoor(0, ENTRY.cz + ENTRY.d / 2, 6, "x");
      // addRoomWalls cuts the gap through the walls FULL height, which for a
      // double-height hall means the front entrance would be a 6x8.4 slot you
      // could see straight through. The doors are 2.9 tall; above them is wall.
      addWallSeg(0, ENTRY.cz + ENTRY.d / 2, 6, 0.4, 5.5, 2.9);
      addGlowBox(0, 3.2, ENTRY.cz + ENTRY.d / 2 - 0.3, 2.2, 0.32, 0.08, 0x6bff7a);
    }
    if (STOREYS === 2) {
      // The hall's own node sat in the middle of the floor -- on a two-storey
      // map, on the staircase. Put it in the west bay, and reach the corridor
      // through a node beside the stairs at the north doorway.
      const sx = cfg.stair.halfX;
      world.waypointNodes.ENTRY = { x: -(sx + 3), z: ENTRY.cz, y: F1 };
      world.waypointNodes.DENTRY = { x: -(sx + 0.5), z: ENTRY.cz - ENTRY.d / 2 + 1, y: F1 };
      link("ENTRY", "DENTRY"); link("DENTRY", "C1" + cfg.corrSegs[0].name);
    } else link("ENTRY", "C1" + cfg.corrSegs[0].name);
    // The entry hall is only double height down its middle -- the side bays are
    // roofed by the upstairs floor slab, so a light hung at F2+2 would sit
    // inside the rooms above and leave the bays pitch black.
    addLight(-ENTRY.w * 0.34, 3.5, ENTRY.cz - 3, rl[1 % rl.length], 1.2, 1.3);
    addLight(-ENTRY.w * 0.34, 3.5, ENTRY.cz + 4, rl[4 % rl.length], 1.1, 1.6);
    addLight(ENTRY.w * 0.34, 3.5, ENTRY.cz - 3, rl[4 % rl.length], 1.1, 1.5);
    addLight(ENTRY.w * 0.34, 3.5, ENTRY.cz + 4, rl[1 % rl.length], 1.2, 1.2);
    addLight(0, 6.8, ENTRY.cz + 5, rl[2 % rl.length], 1.3, 1.1);

    // ---- upper storey over the entry hall: two rooms plus the gallery ----
    if (STOREYS === 2) {
      const sideW = (ENTRY.w - 12) / 2;
      const UP = [
        { key: cfg.upperKeys[0], cx: -(6 + sideW / 2), w: sideW, li: 3 },
        { key: cfg.upperKeys[1], cx: 6 + sideW / 2, w: sideW, li: 1 },
      ];
      UP.forEach((u) => {
        const r = { cx: u.cx, cz: ENTRY.cz, w: u.w, d: ENTRY.d };
        addSpace(u.key, r.cx, r.cz, r.w, r.d, F2);
        addCeiling(r.cx, r.cz, r.w, r.d, F2, CEIL);
        const west = u.cx < 0;
        addRoomWalls(r, west ? { east: { center: ENTRY.cz - 2, width: 3 } } : { west: { center: ENTRY.cz - 2, width: 3 } }, WH, F2);
        addRoomDoor(west ? -6 : 6, ENTRY.cz - 2, 3, "z", F2);
        addLight(r.cx, F2 + CEIL - 0.45, r.cz, rl[u.li % rl.length], 1.1, 1.3);
        scatterClutter(r.cx, r.cz, r.w, r.d, F2, 4, { axis: "x", at: ENTRY.cz - 2, half: 2.2 });
        world.extraSpawnPoints.push({ pos: new THREE.Vector3(r.cx, F2, r.cz), types: ["normal"] });
      });

      const SX = cfg.stair.halfX;
      const Z0 = ENTRY.cz - ENTRY.d / 2 + 2;                 // top of the flight (F2)
      const Z1 = Z0 + cfg.stair.run;                          // foot of the flight (F1)
      const bandCz = (Z0 + Z1) / 2 - 1 + 1, bandD = Z1 - (ENTRY.cz - ENTRY.d / 2);
      const GAL_BANDS = [
        { cx: 0, cz: ENTRY.cz - ENTRY.d / 2 + 1, w: SX * 2, d: 2 },
        { cx: -(SX + (6 - SX) / 2), cz: (ENTRY.cz - ENTRY.d / 2 + Z1) / 2, w: 6 - SX, d: bandD },
        { cx: SX + (6 - SX) / 2, cz: (ENTRY.cz - ENTRY.d / 2 + Z1) / 2, w: 6 - SX, d: bandD },
      ];
      GAL_BANDS.forEach((g2) => {
        addFloor(g2.cx, g2.cz, g2.w, g2.d, F2);
        world.heightZones.push({ minX: g2.cx - g2.w / 2, maxX: g2.cx + g2.w / 2, minZ: g2.cz - g2.d / 2, maxZ: g2.cz + g2.d / 2, height: F2 });
      });
      world.regions.push({ name: "GAL", y: F2, minX: -6, maxX: 6, minZ: ENTRY.cz - ENTRY.d / 2, maxZ: Z1 });
      world.waypointNodes.GAL = { x: 0, z: ENTRY.cz - ENTRY.d / 2 + 1, y: F2 };
      link("GAL", "C2" + cfg.corrSegs[0].name);
      // The two upstairs rooms open off the side bays of the gallery, beyond
      // the stairwell rails: go along the landing first, then down the bay to
      // the door.
      [[cfg.upperKeys[0], -1], [cfg.upperKeys[1], 1]].forEach(([key, s]) => {
        world.waypointNodes["GAL" + key] = { x: s * (SX + 1.9), z: ENTRY.cz - ENTRY.d / 2 + 1, y: F2 };
        world.waypointNodes["D" + key] = { x: s * (6 - 1.1), z: ENTRY.cz - 2, y: F2 };
        link("GAL", "GAL" + key); link("GAL" + key, "D" + key); link("D" + key, key);
      });
      // Up and down go by way of the foot of the flight. A direct ENTRY-GAL
      // hop sent zombies straight at the landing from wherever they stood in
      // the hall, i.e. into the side of the staircase; the only one that ever
      // got up did it through the gap underneath (closed below).
      world.waypointNodes.STAIR = { x: 0, z: ENTRY.cz - ENTRY.d / 2 + 2 + cfg.stair.run + 1.3, y: F1 };
      // ...and the top of it: from the gallery's side bays a straight line to
      // the foot runs into the stairwell and gallery rails, and a zombie
      // wedged itself in that corner for six minutes in the playtest. Going
      // down, it walks round to the landing first.
      world.waypointNodes.LANDING = { x: 0, z: ENTRY.cz - ENTRY.d / 2 + 1.5, y: F2 };
      link("STAIR", "ENTRY"); link("STAIR", "LANDING"); link("LANDING", "GAL");
      addCeiling(0, ENTRY.cz, 12, ENTRY.d, F2, CEIL);
      addLight(0, F2 + 3.4, ENTRY.cz - ENTRY.d / 2 + 1, rl[0], 1.05, 1.4);
      addLight(4.5, F2 + 3.4, ENTRY.cz + 1, rl[2 % rl.length], 0.95, 1.8);
      [-SX - 0.06, SX + 0.06].forEach((rx) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, Z1 - Z0), M.rail);
        rail.position.set(rx, F2 + 0.5, (Z0 + Z1) / 2);
        scene.add(rail);
        world.colliders.push(new THREE.Box3().setFromObject(rail));
      });
      const galRail = new THREE.Mesh(new THREE.BoxGeometry(12, 1.0, 0.12), M.rail);
      galRail.position.set(0, F2 + 0.5, Z1 + 0.06);
      scene.add(galRail);
      world.colliders.push(new THREE.Box3().setFromObject(galRail));

      // The treads are decoration + height zones only -- a collider on each one
      // would catch the player's body box on the riser in front of them. Solid
      // side walls stop you walking into the flight from the hall floor
      // instead, which is also what makes the shutter below a real gate.
      const STEPS = 12, RISE = F2 / STEPS, RUN = (Z1 - Z0) / STEPS;
      for (let i = 0; i < STEPS; i++) {
        const top = (i + 1) * RISE;
        const zHi = Z1 - i * RUN, zLo = zHi - RUN;
        const step = new THREE.Mesh(new THREE.BoxGeometry(SX * 2 - 0.3, top, RUN), accentMat);
        step.position.set(0, top / 2, zLo + RUN / 2);
        scene.add(step);
        // Out to the side walls' centre line, not just the drawn tread: at the
        // top of the flight the wall tops are level with the treads, and a
        // zombie that stepped onto that 0.15 strip found only the hall floor
        // under it and dropped through the staircase.
        world.heightZones.push({ minX: -SX, maxX: SX, minZ: zLo, maxZ: zHi, height: top });
      }
      [-SX, SX].forEach((sx) => addWallSeg(sx, (Z0 + Z1) / 2, 0.3, Z1 - Z0, F2, F1));
      // ...and the top end. Under the landing the flight was open at floor
      // level: anything on the hall floor could walk in beneath the treads
      // (they are drawn solid, but only the side walls were colliders), step
      // onto the bottom tread from the inside and climb past the locked
      // shutter. The playtest bot found a zombie on the gallery with the
      // shutter still down. This block sits inside the top tread, so it is
      // never seen, and stops 0.7 below the landing so nobody walking the
      // stairs can touch it.
      world.colliders.push(new THREE.Box3(
        new THREE.Vector3(-SX, F1, Z0 + 0.15), new THREE.Vector3(SX, F2 - 0.7, Z0 + 0.6)));
      // Zombies not routed up or down treat the whole flight as solid, or one
      // crossing the hall wanders onto the bottom tread and climbs by accident
      // (see updateZombies). Not a collider: the player and routed zombies use it.
      world.stairBlock = new THREE.Box3(new THREE.Vector3(-SX - 0.15, F1, Z0), new THREE.Vector3(SX + 0.15, F1 + 3, Z1 + 0.45));

      // The gate sits across the foot of the stairs, not the hall doorway --
      // the hall is the only way in from outside, so gating it would lock the
      // player out of the whole building.
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(SX * 2 + 0.2, 3.6, 0.22), M.metal);
      shutter.position.set(0, 1.8, Z1 + 0.15);
      scene.add(shutter);
      const shutterCollider = new THREE.Box3().setFromObject(shutter);
      world.colliders.push(shutterCollider);
      addGlowBox(0, 3.75, Z1 + 0.15, SX * 2 + 0.3, 0.14, 0.26, 0xffcc33);
      world.secondFloor = {
        unlocked: false, barrierMesh: shutter, barrierCollider: shutterCollider,
        killsNeeded: cfg.upperKills || 20, countMode: "correct", room: { cx: 0, cz: 0 }, floorY: F2,
        cratePositions: [new THREE.Vector3(-4, F2 + 0.3, ENTRY.cz - 2), new THREE.Vector3(EX, F2 + 0.3, cfg.rows[0].cz)],
      };
    }

    // ---- per-room dressing, loot, wall guns ----
    function dressGeneric(spec) {
      const r = spec.room, y = spec.baseY;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let i = 0; i < 3; i++) {
        const [sx, sz] = corners[i];
        const px = r.cx + sx * (r.w / 2 - 1.3), pz = r.cz + sz * (r.d / 2 - 1.3);
        const w = 0.7 + G.rng() * 1.0, h = 0.7 + G.rng() * 1.2, d = 0.6 + G.rng() * 0.8;
        addSolid(px, y, pz, w, h, d, M.locker[i % M.locker.length]);
      }
      scatterClutter(r.cx, r.cz, r.w, r.d, y, 2 + Math.floor(G.rng() * 2), { axis: "x", at: r.cz, half: 1.9 });
      if (G.rng() < 0.55) addBloodStain(r.cx + (G.rng() - 0.5) * 3, r.cz + (G.rng() - 0.5) * 3, 0.6 + G.rng() * 0.6, G.rng() * 3);
    }

    cfg.plan.forEach((spec) => {
      dressGeneric(spec);
      const f = cfg.furnish && cfg.furnish[spec.furnish];
      if (f) f(spec, { addSolid, addFloatBox, addCanvasBox, addGlowBox, addCorpse, addBloodStain, addLight, M, scene });
      if (spec.gun) {
        const r = spec.room, y = spec.baseY;
        const mx = r.cx < 0 ? r.cx - r.w / 2 + 0.3 : r.cx + r.w / 2 - 0.3;
        mountWallGun(spec.gun, mx, y, r.cz + (spec.gunOffZ || 0), r.cx < 0);
      }
      if (spec.mystery) {
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
      // `hasKey`, not `key`: `key` is already the room.s region name
      if (spec.hasKey) {
        const km = buildKeyMesh();
        km.position.set(spec.room.cx + (spec.side === "W" ? 2 : -2), spec.baseY + 1.1, spec.room.cz);
        scene.add(km);
        world.keys.push({ mesh: km, baseY: spec.baseY, taken: false, phase: world.keys.length * 1.7, room: spec.key });
      }
      if (spec.button) {
        const bm = addProp(spec.room.cx - 3, spec.room.cz + 4, 0.35, 0.35, 0.35, new THREE.MeshLambertMaterial({ color: 0xff4444 }), 0, 0, 0, true);
        bm.position.y = spec.baseY + 1.3;
        world.buttons.push({ mesh: bm, pressed: false });
        world.interactables.push({ mesh: bm, kind: "button", ref: world.buttons[world.buttons.length - 1] });
      }
      if ((spec.row + (spec.side === "W" ? 0 : 1)) % 2 === 0) {
        const cm = addProp(spec.room.cx + 2.5, spec.room.cz - 2.5, 0.8, 0.8, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
        cm.position.y = spec.baseY + 0.4;
        world.colliders[world.colliders.length - 1] = new THREE.Box3().setFromObject(cm);
        world.crates.push({ mesh: cm, opened: false, locked: true });
        world.interactables.push({ mesh: cm, kind: "crate", ref: world.crates[world.crates.length - 1] });
      }
    });

    // secret area: stays shut until the button elsewhere on the map is hit
    const secret = cfg.plan.find((s) => s.secret);
    if (secret) {
      const side = secret.side === "W" ? -1 : 1;
      const barricade = addBarricade(side * (HALF + 0.4), secret.room.cz, 3, M.barricade);
      world.secretZone = {
        center: new THREE.Vector3(secret.room.cx, 0, secret.room.cz), radius: 6, unlocked: false,
        barricadeMesh: barricade.mesh, barricadeCollider: barricade.collider,
      };
    }

    // word-locked door on a room that holds a wall gun
    const store = cfg.plan.find((s) => s.wordDoor);
    if (store) {
      const side = store.side === "W" ? -1 : 1;
      const lockedDoor = addProp(side * (HALF + 0.45), store.room.cz, 0.3, 3, 2.8, new THREE.MeshLambertMaterial({ color: 0xb2452f }));
      addGlowBox(side * (HALF + 0.45), 3.05, store.room.cz, 0.34, 0.1, 2.9, 0xffcc33);
      world.doors.push({ mesh: lockedDoor, locked: true, kind: "word", opened: false, collider: world.colliders[world.colliders.length - 1] });
      world.interactables.push({ mesh: lockedDoor, kind: "door", ref: world.doors[world.doors.length - 1] });
    }

    // a hazard in the corridor on the last approach to the boss hall
    const trapMesh = addProp(0, cfg.trapZ, HALF * 1.6, 0.25, 0.8, new THREE.MeshLambertMaterial({ color: 0xff2222 }), 0, 0, 0, true);
    trapMesh.position.y = 0.12;
    world.traps.push({ mesh: trapMesh, active: true, damage: 45, cooldown: 0, collider: null });
    world.interactables.push({ mesh: trapMesh, kind: "trap", ref: world.traps[world.traps.length - 1] });

    // corridor dressing: lockers lining the spine, plus cover pressed against
    // the walls so the middle lane stays runnable
    const corrZ0 = cfg.corrSegs[cfg.corrSegs.length - 1].cz - cfg.corrSegs[cfg.corrSegs.length - 1].d / 2;
    const corrZ1 = cfg.corrSegs[0].cz + cfg.corrSegs[0].d / 2;
    storeyList.forEach((fl) => {
      const y = fl === 1 ? F1 : F2;
      // Lockers hug the corridor walls -- but a locker that lands level with a
      // room's doorway walls that room off, and a room you cannot walk into is
      // a room the wave never clears.
      const nearDoor = (z) => cfg.rows.some((rw) => Math.abs(z - rw.cz) < 2.6);
      for (let z = corrZ1 - 3; z > corrZ0 + 1; z -= 4.4) {
        const mat = M.locker[Math.abs(Math.round(z / 4.4)) % M.locker.length];
        if (!nearDoor(z)) addSolid(-HALF + 0.35, y, z, 0.5, 2.2, 0.9, mat);
        if (z - 2.2 > corrZ0 + 1 && !nearDoor(z - 2.2)) addSolid(HALF - 0.35, y, z - 2.2, 0.5, 2.2, 0.9, mat);
      }
      cfg.corrSegs.forEach((c) => scatterClutter(0, c.cz, HALF * 2, c.d, y, Math.max(1, Math.round(c.d / 9)), { axis: "z", at: 0, half: 1.95 }));
    });

    // ---- doorway clearance sweep -----------------------------------------
    // Every furniture kit is written to keep the middle of its room open, but a
    // kit plus random clutter plus a corridor locker can still conspire to wall
    // a doorway off, and a room the player cannot walk into is a room the wave
    // never clears. Anything still standing in a doorway is deleted outright --
    // mesh and collider together, so nothing invisible is left behind.
    function clearDoorways() {
      world.roomDoors.forEach((d) => {
        const halfOpen = (d.width || 3) / 2 - 0.15;
        const deep = 2.5;
        const alongX = d.axis === "x";
        const box = new THREE.Box3(
          new THREE.Vector3(alongX ? d.x - halfOpen : d.x - deep, (d.baseY || 0) + 0.15, alongX ? d.z - deep : d.z - halfOpen),
          new THREE.Vector3(alongX ? d.x + halfOpen : d.x + deep, (d.baseY || 0) + 2.4, alongX ? d.z + deep : d.z + halfOpen));
        for (let i = solidProps.length - 1; i >= 0; i--) {
          const sp = solidProps[i];
          if (!sp.collider.intersectsBox(box)) continue;
          scene.remove(sp.mesh);
          G.disposeObject3D(sp.mesh);
          const ci = world.colliders.indexOf(sp.collider);
          if (ci >= 0) world.colliders.splice(ci, 1);
          solidProps.splice(i, 1);
        }
      });
    }

    if (cfg.dressEntry) cfg.dressEntry({ addSolid, addFloatBox, addCanvasBox, addGlowBox, addCorpse, addBloodStain, addProp, addLight, mountWallGun, scatterClutter, ENTRY, BOSS, F2, M, scene });
    if (level.theme === "school" && G.SchoolDress) G.SchoolDress.facade(dressApi());
    if (cfg.dressBoss) cfg.dressBoss({ addSolid, addFloatBox, addCanvasBox, addGlowBox, addCorpse, addBloodStain, addProp, addLight, mountWallGun, scatterClutter, BOSS, ENTRY, F2, M, scene });
    if (cfg.yard) buildSchoolYard({ cz: ENTRY.cz, d: ENTRY.d, w: ENTRY.w }, cfg.yard);
    clearDoorways();
    buildSlidingDoors();
    fitWordDoorSlide();
    if (level.theme === "school" && G.SchoolDress) G.SchoolDress.interior(dressApi());

    // ---- spawn points ----
    cfg.corrSegs.forEach((c) => world.extraSpawnPoints.push({ pos: new THREE.Vector3(0, 0, c.cz), types: ["normal", "fast"] }));
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(-BOSS.w * 0.25, 0, BOSS.cz), types: ["normal", "fast"] });
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(BOSS.w * 0.25, 0, BOSS.cz), types: ["normal", "fast"] });
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(-ENTRY.w * 0.3, 0, ENTRY.cz), types: ["normal"] });
    world.extraSpawnPoints.push({ pos: new THREE.Vector3(ENTRY.w * 0.3, 0, ENTRY.cz), types: ["normal"] });
    (cfg.extraSpawns || []).forEach((s) => world.extraSpawnPoints.push({ pos: new THREE.Vector3(s[0], s[1], s[2]), types: s[3] }));
    world.spawnPoints = world.extraSpawnPoints.map((sp) => Object.assign(sp, { cooldown: 0 }));
    world.spawnPoints.push(Object.assign({ pos: new THREE.Vector3(BOSS.cx, 0, BOSS.cz - 3), types: ["boss"] }, { cooldown: 0 }));
    world.extraSpawnPoints = null;
    // tag the points that sit behind a gate (see G.spawnPointOpen)
    const inGroundRoom = (p, spec) => spec && p.y < 1 && Math.abs(p.x - spec.room.cx) < spec.room.w / 2 && Math.abs(p.z - spec.room.cz) < spec.room.d / 2;
    world.spawnPoints.forEach((sp) => {
      if (world.secondFloor && sp.pos.y > 1) sp.gate = "upper";
      else if (world.secretZone && inGroundRoom(sp.pos, secret)) sp.gate = "secret";
      else if (inGroundRoom(sp.pos, store)) sp.gate = "word";
    });

    world.spawn = cfg.spawn;
    // Not the dead centre: the bunker's reactor stands there, and a boss
    // spawned inside it had to shoulder its way out through the casing.
    world.bossRoomCenter = new THREE.Vector3(BOSS.cx, 0, BOSS.cz - 3);
  }
  // ================= Level plans (category M) =================
  // One plan per theme, fed to buildComplex above. Each keeps the same skeleton
  // -- spine corridor, rooms both sides, entry hall, boss hall -- but its own
  // proportions, room list and furniture, so the three levels read as three
  // different buildings rather than one building repainted.
  function themeMats(theme) {
    const C = (n) => new THREE.MeshLambertMaterial({ color: n });
    const base = {
      school: {
        wood: 0x6b4a2f, woodDark: 0x4a3220, metal: 0x6d737a, crate: 0x8a6a3a, rubble: 0x5f5c55,
        rail: 0x3a3a34, barricade: 0x5c5438, board: 0x1f4436,
        locker: [0x6f93b3, 0xb0615a, 0xc9b26a, 0x7a9a86], accent: 0x8a3a2e,   // faded blue, red, yellow (pass D2)
      },
      hospital: {
        wood: 0x9aa5a0, woodDark: 0x6d7a75, metal: 0xc6cdc9, crate: 0x7d8c84, rubble: 0x4d5a53,
        rail: 0x8f9c96, barricade: 0x4a5c52, board: 0x2b4a3c,
        locker: [0xe6ece8, 0x9fd6c0, 0xd6423c, 0x7fa8bd], accent: 0x3d6b52,
      },
      bunker: {
        wood: 0x5a5344, woodDark: 0x3b362c, metal: 0x6a6a64, crate: 0x6b5f3e, rubble: 0x3f3d38,
        rail: 0x4a4a44, barricade: 0x4a4636, board: 0x2a2f22,
        locker: [0x4c5240, 0x7a6a3a, 0x8a4a2a, 0x3f4a55], accent: 0x8a5a2a,
      },
    }[theme];
    const M = {};
    for (const k in base) M[k] = Array.isArray(base[k]) ? base[k].map(C) : C(base[k]);
    return M;
  }

  // ---- shared furniture kits -------------------------------------------
  // Each takes the room spec plus the drawing helpers and fills the room with
  // something recognisable. They deliberately leave the middle strip (the line
  // from the door to the far wall) clear.
  const FURNISH = {
    // school: rows of desks facing a board on the outer wall
    classroom(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      const outerX = r.cx < 0 ? r.cx - r.w / 2 + 0.25 : r.cx + r.w / 2 - 0.25;
      a.addFloatBox(outerX, y + 1.9, r.cz, 0.1, 1.5, 4.2, M.board);
      a.addFloatBox(outerX + (r.cx < 0 ? 0.04 : -0.04), y + 1.9, r.cz, 0.06, 1.7, 4.5, M.woodDark);
      const dirX = r.cx < 0 ? 1 : -1;
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
          const px = outerX + dirX * (2.6 + col * 2.6);
          const pz = r.cz - 3.4 + row * 3.4;
          if (col === 1 && row === 2) { a.addSolid(px, y, pz, 1.3, 0.72, 0.7, M.wood, Math.PI / 2, 0.4); continue; }
          a.addSolid(px, y, pz, 1.3, 0.75, 0.7, M.wood);
          a.addSolid(px - dirX * 0.8, y, pz, 0.5, 0.45, 0.5, M.woodDark);
        }
      }
    },
    // school: long canteen tables, one flipped
    canteen(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      for (let i = 0; i < 3; i++) {
        const pz = r.cz - 3.8 + i * 3.8;
        if (i === 1) { a.addSolid(r.cx - 1, y, pz, 3.6, 0.75, 1.0, M.wood, Math.PI / 2, 0.25); continue; }
        a.addSolid(r.cx, y, pz, 4.2, 0.72, 1.0, M.wood);
        [-1.4, 1.4].forEach((dx) => a.addSolid(r.cx + dx, y, pz + 1.0, 1.6, 0.42, 0.4, M.woodDark));
      }
      for (let i = 0; i < 3; i++) a.addSolid(r.cx + r.w / 2 - 1.2, y, r.cz - 3 + i * 3, 1.0, 2.0, 0.6, M.metal);
      a.addCorpse(r.cx + 2.5, r.cz + 4, 1.9, 0x7a6a3a);
    },
    // hospital: beds down both sides with curtain rails, a couple overturned
    ward(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 3; i++) {
          const px = r.cx + side * (r.w / 2 - 2.0);
          const pz = r.cz - 3.8 + i * 3.8;
          if (side < 0 && i === 1) { a.addSolid(px, y, pz, 1.9, 0.7, 0.95, M.locker[0], Math.PI / 2, 0.3); continue; }
          a.addSolid(px, y + 0.42, pz, 1.9, 0.26, 0.95, M.locker[0]);
          [[-0.82, -0.4], [-0.82, 0.4], [0.82, -0.4], [0.82, 0.4]].forEach(([dx, dz]) =>
            a.addFloatBox(px + dx, y + 0.21, pz + dz, 0.1, 0.42, 0.1, M.woodDark));
          a.addFloatBox(px, y + 0.58, pz, 1.7, 0.06, 0.85, M.locker[1]);   // blanket
          a.addFloatBox(px, y + 1.45, pz, 0.1, 1.7, 0.1, M.rail);          // drip stand
          a.addFloatBox(px, y + 2.3, pz, 0.3, 0.22, 0.2, M.locker[1]);
          if (i === 2) a.addSolid(px + (side < 0 ? 1.4 : -1.4), y, pz, 0.6, 0.8, 0.6, M.metal);
        }
      });
      a.addBloodStain(r.cx, r.cz + 2, 1.2, 0.4);
    },
    // hospital: operating table under a lamp, instrument trolleys, screens
    theatre(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      a.addSolid(r.cx, y + 0.55, r.cz, 2.2, 0.22, 0.95, M.locker[0]);
      [[-0.9, 0], [0.9, 0]].forEach(([dx]) => a.addFloatBox(r.cx + dx, y + 0.28, r.cz, 0.14, 0.55, 0.6, M.metal));
      a.addFloatBox(r.cx, y + 3.0, r.cz, 1.5, 0.22, 1.5, M.metal);
      a.addGlowBox(r.cx, y + 2.85, r.cz, 1.3, 0.1, 1.3, 0xf2fff4);
      a.addLight(r.cx, y + 2.6, r.cz, 0xd8ffe8, 1.3, 1.1);
      [[-2.8, -2.4], [2.8, 2.4]].forEach(([dx, dz]) => {
        a.addSolid(r.cx + dx, y + 0.5, r.cz + dz, 0.9, 0.5, 0.6, M.metal);
        a.addFloatBox(r.cx + dx, y + 0.8, r.cz + dz, 0.5, 0.1, 0.35, M.locker[2]);
      });
      // screens on the OUTER wall, clear of the doorway
      const thOuter = r.cx + (r.cx < 0 ? -1 : 1) * (r.w / 2 - 1.1);
      for (let i = 0; i < 3; i++) a.addSolid(thOuter, y, r.cz - 3 + i * 3, 0.7, 2.0, 1.4, M.locker[0]);
      a.addBloodStain(r.cx, r.cz + 1.3, 1.6, 0.2);
      a.addBloodStain(r.cx + 1.2, r.cz - 1.1, 1.0, 1.1);
    },
    // both: benches with equipment plus tall cabinets
    lab(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      // Benches run in two lengths with a gap in the middle: one continuous
      // bench down the corridor-side wall seals the doorway off entirely.
      [-1, 1].forEach((side) => {
        const px = r.cx + side * (r.w / 2 - 1.8);
        [-1, 1].forEach((half) => {
          const bz = r.cz + half * (r.d / 4 + 0.4);
          a.addSolid(px, y, bz, 1.3, 0.92, r.d / 2 - 2.6, M.locker[0]);
          for (let i = 0; i < 2; i++) {
            a.addFloatBox(px, y + 1.05, bz - 0.7 + i * 1.4, 0.34, 0.26, 0.34, M.locker[3]);
            if (i === 0) a.addGlowBox(px, y + 1.28, bz - 0.7, 0.16, 0.2, 0.16, 0x7dffc0);
          }
        });
      });
      a.addSolid(r.cx, y, r.cz - r.d / 2 + 1.2, 3.2, 2.0, 0.7, M.metal);
      a.addCanvasBox(r.cx, y + 1.5, r.cz - r.d / 2 + 0.82, 1.6, 0.9, 0.06, (ctx, cv) => {
        ctx.fillStyle = "#04140a"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = "#7dffc0"; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i <= 256; i += 8) ctx.lineTo(i, 64 + Math.sin(i * 0.17) * 24);
        ctx.stroke();
      }, 0x0a0a0a);
    },
    // both: desks, filing cabinets, scattered paper
    office(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      for (let i = 0; i < 3; i++) {
        const px = r.cx + (i - 1) * 3.2;
        a.addSolid(px, y, r.cz - 2.6, 2.2, 0.75, 1.0, M.wood, i === 2 ? Math.PI / 2 : 0, i === 2 ? 0.3 : 0);
        if (i !== 2) a.addSolid(px, y, r.cz - 1.2, 0.6, 0.5, 0.6, M.woodDark);
        a.addFloatBox(px, y + 0.82, r.cz - 2.6, 0.5, 0.06, 0.4, M.locker[0]);
      }
      // filing cabinets go on the OUTER wall -- against the corridor-side wall
      // they line up with the doorway and seal it
      const offOuter = r.cx + (r.cx < 0 ? -1 : 1) * (r.w / 2 - 1.0);
      for (let i = 0; i < 4; i++) a.addSolid(offOuter, y, r.cz + 1 + (i - 2) * 1.2, 0.7, 1.9, 1.0, M.metal);
      for (let i = 0; i < 6; i++) a.addFloatBox(r.cx + (G.rng() - 0.5) * 6, y + 0.02, r.cz + 2 + G.rng() * 3, 0.3, 0.02, 0.22, M.locker[0], G.rng() * 3);
    },
    // both: racked shelving down both walls, stacked crates between
    storage(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      // Two racks per wall with a clear band between them -- a third rack in
      // the middle sits exactly in the doorway.
      [-1, 1].forEach((side) => {
        [-1, 1].forEach((half) => {
          const px = r.cx + side * (r.w / 2 - 1.1);
          const pz = r.cz + half * 4.2;
          a.addSolid(px, y, pz, 0.9, 2.3, 2.4, M.metal);
          [0.7, 1.45, 2.1].forEach((sy) => a.addFloatBox(px - side * 0.1, y + sy, pz, 0.85, 0.07, 2.3, M.woodDark));
          for (let k = 0; k < 3; k++) a.addFloatBox(px - side * 0.1, y + 0.85 + (k % 2) * 0.75, pz - 0.8 + k * 0.8, 0.5, 0.4, 0.5, M.crate);
        });
      });
      const outerX = r.cx + (r.cx < 0 ? -1 : 1) * (r.w / 2 - 1.1);
      a.addSolid(outerX, y, r.cz, 0.9, 2.3, 2.4, M.metal);
      a.addSolid(r.cx, y, r.cz + 2.4, 1.1, 1.1, 1.1, M.crate, 0, 0.4);
      a.addSolid(r.cx + 0.9, y + 1.1, r.cz + 2.1, 0.8, 0.8, 0.8, M.crate, 0, 1.1);
    },
    // hospital: steel slabs and a wall of cold drawers
    morgue(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      for (let i = 0; i < 3; i++) {
        const px = r.cx - 2.6 + i * 2.6;
        a.addSolid(px, y + 0.5, r.cz - 1, 1.0, 0.18, 2.2, M.metal);
        [[-0.4, -0.95], [-0.4, 0.95], [0.4, -0.95], [0.4, 0.95]].forEach(([dx, dz]) =>
          a.addFloatBox(px + dx, y + 0.25, r.cz - 1 + dz, 0.1, 0.5, 0.1, M.woodDark));
        if (i !== 1) a.addFloatBox(px, y + 0.66, r.cz - 1, 0.9, 0.14, 2.0, M.locker[0]);
      }
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 3; row++) {
          a.addSolid(r.cx - r.w / 2 + 0.55, y + row * 0.9, r.cz - 3 + col * 2.0, 0.8, 0.82, 1.8, M.metal);
          a.addFloatBox(r.cx - r.w / 2 + 0.98, y + row * 0.9 + 0.4, r.cz - 3 + col * 2.0, 0.06, 0.16, 0.5, M.locker[3]);
        }
      }
      a.addCorpse(r.cx + 2, r.cz + 3.4, 1.2, 0xc9d0d0);
      a.addBloodStain(r.cx + 2, r.cz + 3.4, 1.0, 0.5);
    },
    // bunker: stacked bunks and footlockers
    barracks(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 3; i++) {
          const px = r.cx + side * (r.w / 2 - 1.5);
          const pz = r.cz - 3.6 + i * 3.6;
          [0, 1].forEach((tier) => {
            a.addSolid(px, y + tier * 1.1, pz, 1.6, 0.9, 0.9, M.metal);
            a.addFloatBox(px, y + tier * 1.1 + 0.95, pz, 1.5, 0.08, 0.8, M.locker[0]);
          });
          a.addSolid(px - side * 1.1, y, pz, 0.6, 0.55, 1.1, M.crate);
        }
      });
    },
    // bunker: weapon racks, ammo crates, a workbench
    armoury(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      [-1, 1].forEach((side) => {
        const px = r.cx + side * (r.w / 2 - 0.9);
        [-1, 1].forEach((half) => {
          const rz = r.cz + half * (r.d / 4 + 0.4);
          a.addSolid(px, y, rz, 0.7, 2.4, r.d / 2 - 2.6, M.metal);
          for (let i = 0; i < 3; i++) {
            a.addFloatBox(px - side * 0.35, y + 1.1 + (i % 2) * 0.8, rz - 1 + i * 1.0, 0.12, 0.7, 0.12, M.woodDark, 0.2);
          }
        });
      });
      a.addSolid(r.cx, y, r.cz + r.d / 2 - 1.6, 3.4, 0.95, 1.0, M.woodDark);
      for (let i = 0; i < 4; i++) a.addSolid(r.cx - 2.4 + i * 1.6, y, r.cz - r.d / 2 + 1.4, 1.1, 0.7, 0.8, M.crate, 0, G.rng());
      a.addGlowBox(r.cx, y + 2.4, r.cz + r.d / 2 - 1.6, 1.6, 0.08, 0.5, 0xffcf4d);
    },
    // bunker: banks of consoles and screens along the far wall
    control(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      const outerX = r.cx < 0 ? r.cx - r.w / 2 + 0.9 : r.cx + r.w / 2 - 0.9;
      for (let i = 0; i < 4; i++) {
        const pz = r.cz - 3.6 + i * 2.4;
        a.addSolid(outerX, y, pz, 1.3, 1.15, 2.0, M.metal);
        a.addCanvasBox(outerX + (r.cx < 0 ? 0.68 : -0.68), y + 1.55, pz, 1.5, 0.9, 0.08, (ctx, cv) => {
          ctx.fillStyle = "#06120a"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = "#7dc9ff";
          for (let k = 0; k < 7; k++) ctx.fillRect(16, 12 + k * 15, 40 + G.rng() * 180, 7);
        }, 0x14140f, r.cx < 0 ? Math.PI / 2 : -Math.PI / 2);
        a.addGlowBox(outerX + (r.cx < 0 ? 0.6 : -0.6), y + 1.1, pz, 0.08, 0.06, 1.6, 0xff5c3d);
      }
      a.addSolid(r.cx + (r.cx < 0 ? 2.6 : -2.6), y, r.cz, 1.0, 0.95, 3.0, M.woodDark);
    },
    // bunker: pipes, turbines and a caged fan
    generator(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      for (let i = 0; i < 2; i++) {
        const px = r.cx - 2.4 + i * 4.8;
        a.addSolid(px, y, r.cz, 2.2, 2.1, 3.4, M.metal);
        a.addFloatBox(px, y + 2.3, r.cz, 0.7, 0.5, 0.7, M.woodDark);
        a.addGlowBox(px, y + 1.2, r.cz + 1.75, 0.5, 0.3, 0.06, i ? 0xff5c3d : 0xffcf4d);
      }
      for (let i = 0; i < 5; i++) {
        a.addFloatBox(r.cx, y + 3.1, r.cz - 4 + i * 2, 9.0, 0.28, 0.28, M.rail);
      }
      a.addSolid(r.cx, y, r.cz + r.d / 2 - 1.4, 2.6, 2.6, 0.5, M.metal);
      for (let i = 0; i < 4; i++) a.addFloatBox(r.cx - 0.9 + i * 0.6, y + 1.3, r.cz + r.d / 2 - 1.15, 0.12, 2.2, 0.12, M.rail);
      a.addLight(r.cx, y + 2.6, r.cz, 0xff7a4d, 1.1, 3.2);
    },
    // bunker: barred cells along one wall
    cells(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      const outerX = r.cx < 0 ? r.cx - r.w / 2 + 2.4 : r.cx + r.w / 2 - 2.4;
      for (let c = 0; c < 3; c++) {
        const pz = r.cz - 3.6 + c * 3.6;
        a.addSolid(outerX, y, pz - 1.6, 4.4, 2.8, 0.25, M.metal);
        for (let b = 0; b < 7; b++) {
          if (b === 3 && c === 1) continue;                      // one door forced open
          a.addFloatBox(outerX + (r.cx < 0 ? 2.3 : -2.3), y + 1.4, pz - 1.4 + b * 0.45, 0.1, 2.7, 0.1, M.rail);
        }
        a.addSolid(outerX, y + 0.35, pz, 1.7, 0.2, 0.8, M.woodDark);
      }
      a.addCorpse(r.cx + (r.cx < 0 ? 1.5 : -1.5), r.cz + 2.2, 0.8, 0x54503f);
    },
    // hospital: reception counter, wheelchairs, a notice wall
    reception(spec, a) {
      const r = spec.room, y = spec.baseY, M = a.M;
      a.addSolid(r.cx, y, r.cz - 2.2, 5.2, 1.05, 1.0, M.locker[0]);
      a.addFloatBox(r.cx, y + 1.12, r.cz - 2.2, 5.0, 0.1, 1.1, M.metal);
      a.addFloatBox(r.cx, y + 1.5, r.cz - 2.75, 1.0, 0.5, 0.06, M.locker[2]);
      for (let i = 0; i < 3; i++) {
        const px = r.cx - 2.6 + i * 2.6;
        a.addSolid(px, y, r.cz + 3, 0.8, 0.55, 0.8, M.metal, 0, G.rng());
        a.addFloatBox(px, y + 0.85, r.cz + 3, 0.72, 0.5, 0.1, M.locker[3]);
      }
      a.addSolid(r.cx + r.w / 2 - 1.2, y, r.cz + 1, 0.7, 2.1, 3.0, M.locker[0]);
    },
  };

  function levelPlan(theme) {
    const M = themeMats(theme);
    if (theme === "school") {
      return {
        half: 3.5, roomW: 12.5, storeys: 2, f2: 4.2, wallH: 4.2, mats: M, furnish: FURNISH,
        rows: [
          { cz: 13.5, d: 13, corr: "S" }, { cz: 0.5, d: 13, corr: "M" },
          { cz: -12.5, d: 13, corr: "N" }, { cz: -25, d: 12, corr: "N" },
          { cz: -37.5, d: 13, corr: "N2" },
        ],
        corrSegs: [
          { name: "S", cz: 13.5, d: 13 }, { name: "M", cz: 0.5, d: 13 },
          { name: "N", cz: -19, d: 26 }, { name: "N2", cz: -38, d: 12 },
        ],
        boss: { cx: 0, cz: -52.5, w: 36, d: 17 },
        entry: { cz: 26.5, w: 32, d: 13 },
        upperKeys: ["PLW", "PLE"],
        stair: { halfX: 2.15, run: 7.8 },
        trapZ: -42, spawn: { x: 0, z: 53 }, upperKills: 20,
        dressEntry: DRESSERS.school.entry, dressBoss: DRESSERS.school.boss,
        yard: { cx: 0, cz: 46.5, w: 52, d: 27 },
        extraSpawns: [[-18, 0, 42, ["normal"]], [18, 0, 42, ["normal"]],
          [-12, 0, 56, ["normal", "fast"]], [12, 0, 56, ["normal", "fast"]]],
        plan: [
          { key: "W1", side: "W", row: 0, light: 0, furnish: "classroom" },
          { key: "E1", side: "E", row: 0, light: 2 },
          { key: "W2", side: "W", row: 1, light: 1, gun: "hall_monitor" },
          { key: "E2", side: "E", row: 1, light: 3, gun: "pop_quiz", furnish: "lab" },
          { key: "W3", side: "W", row: 2, light: 2, button: true, furnish: "office" },
          { key: "E3", side: "E", row: 2, light: 0, furnish: "classroom" },
          { key: "W4", side: "W", row: 3, light: 4, gun: "detention_slug", secret: true, hasKey: true },
          { key: "E4", side: "E", row: 3, light: 1, gun: "cafeteria_cleaver", wordDoor: true, furnish: "storage", hasKey: true },
          { key: "W5", side: "W", row: 4, light: 2, furnish: "canteen" },
          { key: "E5", side: "E", row: 4, light: 3 },
          { key: "PW1", side: "W", row: 0, storey: 2, light: 1, gun: "honor_roll" },
          { key: "PE1", side: "E", row: 0, storey: 2, light: 3 },
          { key: "PW2", side: "W", row: 1, storey: 2, light: 0, furnish: "classroom" },
          { key: "PE2", side: "E", row: 1, storey: 2, light: 2, gun: "science_fair", furnish: "lab" },
          { key: "PW3", side: "W", row: 2, storey: 2, light: 4, gun: "art_attack" },
          { key: "PE3", side: "E", row: 2, storey: 2, light: 1, mystery: true },
          { key: "PW4", side: "W", row: 3, storey: 2, light: 3, furnish: "office", hasKey: true },
          { key: "PE4", side: "E", row: 3, storey: 2, light: 0, gun: "principals_verdict" },
          { key: "PW5", side: "W", row: 4, storey: 2, light: 2, furnish: "storage" },
          { key: "PE5", side: "E", row: 4, storey: 2, light: 4, furnish: "classroom" },
        ],
      };
    }
    if (theme === "hospital") {
      return {
        half: 4.0, roomW: 13, storeys: 2, f2: 4.2, wallH: 4.2, mats: M, furnish: FURNISH,
        rows: [
          { cz: 12, d: 13, corr: "S" }, { cz: -1, d: 13, corr: "M" },
          { cz: -14, d: 13, corr: "N" }, { cz: -27, d: 13, corr: "N2" },
          { cz: -40, d: 13, corr: "N3" },
        ],
        corrSegs: [
          { name: "S", cz: 12, d: 13 }, { name: "M", cz: -1, d: 13 },
          { name: "N", cz: -14, d: 13 }, { name: "N2", cz: -27, d: 13 },
          { name: "N3", cz: -40, d: 13 },
        ],
        boss: { cx: 0, cz: -54.5, w: 34, d: 16 },
        entry: { cz: 24.5, w: 30, d: 12 },
        upperKeys: ["PLW", "PLE"],
        stair: { halfX: 2.15, run: 7.8 },
        trapZ: -46, spawn: { x: -8, z: 24.5 }, upperKills: 24,
        dressEntry: DRESSERS.hospital.entry, dressBoss: DRESSERS.hospital.boss,
        extraSpawns: [[0, 0, 20, ["normal"]], [0, 0, -46, ["normal", "fast"]]],
        plan: [
          { key: "W1", side: "W", row: 0, light: 0, furnish: "reception" },
          { key: "E1", side: "E", row: 0, light: 2, furnish: "ward" },
          { key: "W2", side: "W", row: 1, light: 1, furnish: "theatre", gun: "bone_saw" },
          { key: "E2", side: "E", row: 1, light: 3, furnish: "storage", gun: "iv_repeater" },
          { key: "W3", side: "W", row: 2, light: 2, button: true, furnish: "office" },
          { key: "E3", side: "E", row: 2, light: 0, furnish: "ward" },
          { key: "W4", side: "W", row: 3, light: 4, secret: true, furnish: "lab", gun: "quarantine_lance", hasKey: true },
          { key: "E4", side: "E", row: 3, light: 1, wordDoor: true, furnish: "storage", gun: "morphine_mist", hasKey: true },
          { key: "W5", side: "W", row: 4, light: 2, furnish: "morgue" },
          { key: "E5", side: "E", row: 4, light: 3, furnish: "ward" },
          { key: "PW1", side: "W", row: 0, storey: 2, light: 1, furnish: "ward" },
          { key: "PE1", side: "E", row: 0, storey: 2, light: 3, furnish: "office" },
          { key: "PW2", side: "W", row: 1, storey: 2, light: 0, furnish: "theatre", gun: "autoclave" },
          { key: "PE2", side: "E", row: 1, storey: 2, light: 2, furnish: "lab", gun: "defib_driver" },
          { key: "PW3", side: "W", row: 2, storey: 2, light: 4, furnish: "ward", hasKey: true },
          { key: "PE3", side: "E", row: 2, storey: 2, light: 1, mystery: true, furnish: "storage" },
          { key: "PW4", side: "W", row: 3, storey: 2, light: 3, furnish: "lab", gun: "vital_sign" },
          { key: "PE4", side: "E", row: 3, storey: 2, light: 0, furnish: "office", gun: "code_blue" },
          { key: "PW5", side: "W", row: 4, storey: 2, light: 2, furnish: "storage" },
          { key: "PE5", side: "E", row: 4, storey: 2, light: 4, furnish: "ward" },
        ],
      };
    }
    // bunker: narrower corridors and smaller rooms, so it reads as tunnels
    return {
      half: 3.0, roomW: 11, storeys: 2, f2: 4.2, wallH: 4.2, mats: M, furnish: FURNISH,
      rows: [
        { cz: 11, d: 12, corr: "S" }, { cz: -1, d: 12, corr: "M" },
        { cz: -13, d: 12, corr: "N" }, { cz: -25, d: 12, corr: "N2" },
        { cz: -37, d: 12, corr: "N3" },
      ],
      corrSegs: [
        { name: "S", cz: 11, d: 12 }, { name: "M", cz: -1, d: 12 },
        { name: "N", cz: -13, d: 12 }, { name: "N2", cz: -25, d: 12 },
        { name: "N3", cz: -37, d: 12 },
      ],
      boss: { cx: 0, cz: -50.5, w: 30, d: 15 },
      entry: { cz: 22.5, w: 26, d: 11 },
      upperKeys: ["PLW", "PLE"],
      stair: { halfX: 2.0, run: 7.4 },
      trapZ: -42, spawn: { x: 0, z: 27.3 }, upperKills: 28,
      dressEntry: DRESSERS.bunker.entry, dressBoss: DRESSERS.bunker.boss,
      extraSpawns: [[0, 0, 18, ["normal"]], [0, 0, -43, ["normal", "fast"]]],
      plan: [
        { key: "W1", side: "W", row: 0, light: 0, furnish: "barracks" },
        { key: "E1", side: "E", row: 0, light: 2, furnish: "storage" },
        { key: "W2", side: "W", row: 1, light: 1, furnish: "armoury", gun: "vent_ripper" },
        { key: "E2", side: "E", row: 1, light: 3, furnish: "generator", gun: "bolt_thrower" },
        { key: "W3", side: "W", row: 2, light: 2, button: true, furnish: "control" },
        { key: "E3", side: "E", row: 2, light: 0, secret: true, furnish: "cells", hasKey: true },
        { key: "W4", side: "W", row: 3, light: 4, wordDoor: true, furnish: "storage", gun: "siege_slug", hasKey: true },
        { key: "E4", side: "E", row: 3, light: 1, furnish: "office", gun: "drum_hammer" },
        { key: "W5", side: "W", row: 4, light: 2, furnish: "storage" },
        { key: "E5", side: "E", row: 4, light: 3, furnish: "armoury" },
        { key: "PW1", side: "W", row: 0, storey: 2, light: 1, furnish: "control" },
        { key: "PE1", side: "E", row: 0, storey: 2, light: 3, furnish: "office" },
        { key: "PW2", side: "W", row: 1, storey: 2, light: 0, furnish: "lab", gun: "capacitor_lance" },
        { key: "PE2", side: "E", row: 1, storey: 2, light: 2, furnish: "armoury", gun: "thermite_tube" },
        { key: "PW3", side: "W", row: 2, storey: 2, light: 4, furnish: "storage" },
        { key: "PE3", side: "E", row: 2, storey: 2, light: 1, mystery: true, furnish: "control" },
        { key: "PW4", side: "W", row: 3, storey: 2, light: 3, furnish: "barracks", gun: "overwatch" },
        { key: "PE4", side: "E", row: 3, storey: 2, light: 0, furnish: "storage", gun: "warhead" },
        { key: "PW5", side: "W", row: 4, storey: 2, light: 2, furnish: "generator", hasKey: true },
        { key: "PE5", side: "E", row: 4, storey: 2, light: 4, furnish: "office" },
      ],
    };
  }
  // ---- entry-hall and boss-hall dressing, one pair per theme -------------
  const DRESSERS = {
    school: {
      entry(a) {
        const M = a.M, E = a.ENTRY, B = a.BOSS;
        a.addProp(-6.5, E.cz + 3.5, 3.4, 1.05, 0.9, M.wood);
        a.addFloatBox(-6.5, 1.15, E.cz + 3.5, 3.2, 0.1, 1.0, M.woodDark);
        a.addCanvasBox(-6.5, 1.55, E.cz + 3.0, 1.1, 0.5, 0.06, (ctx, cv) => {
          ctx.fillStyle = "#101014"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; G.fitFont(ctx, G.T("world.info"), 34, 236); ctx.fillStyle = "#cfe8ff";
          ctx.fillText(G.T("world.info"), 128, 80);
        }, 0x222222);
        for (let i = 0; i < 3; i++) a.addProp(9 + i * 1.5, E.cz + 4.8, 1.2, 2.0, 0.6, M.metal);
        a.addCanvasBox(0, 2.2, E.cz - E.d / 2 + 0.35, 3.0, 1.4, 0.08, (ctx, cv) => {
          ctx.fillStyle = "#1d3b22"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = "#e8e8d8";
          for (let i = 0; i < 6; i++) ctx.fillRect(18 + (i % 3) * 78, 16 + Math.floor(i / 3) * 52, 62, 40);
        }, 0x3a2a18);
        a.scatterClutter(-11, E.cz - 1.5, 9, 10, 0, 3, { axis: "z", at: 0, half: 5 });
        a.scatterClutter(11, E.cz - 1.5, 9, 10, 0, 3, { axis: "z", at: 0, half: 5 });
        a.addCorpse(-3.2, E.cz + 5, 2.4, 0x2f4f7a);
        a.addBloodStain(-3.2, E.cz + 5, 1.1, 0.4);
        a.addBloodStain(-1.6, E.cz + 2, 0.9, 1.2);

        // The face the player arrives at: parapet, window bays, an entrance
        // canopy and a name board rather than a blank slab -- plus roof slabs,
        // so the building reads as a solid mass and not an open-topped box.
        const wallLight = new THREE.MeshLambertMaterial({ color: 0x9a9587 });
        const wallDark = new THREE.MeshLambertMaterial({ color: 0x6f6b60 });
        const glassMat = new THREE.MeshLambertMaterial({ color: 0x27323c });
        const brokenMat = new THREE.MeshBasicMaterial({ color: 0x0a0d10 });
        const zf = E.cz + E.d / 2;
        a.addFloatBox(0, 8.7, zf, E.w + 1.2, 0.6, 1.0, wallDark);
        a.addFloatBox(0, 4.35, zf + 0.38, E.w + 0.4, 0.3, 0.5, wallLight);
        [2.4, 6.2].forEach((wy, rowIdx) => {
          for (let i = -4; i <= 4; i++) {
            const wx = i * 3.4;
            if (Math.abs(wx) < 4.4 || Math.abs(wx) > E.w / 2 - 1.5) continue;
            a.addFloatBox(wx, wy, zf + 0.32, 2.0, 1.5, 0.22, wallDark);
            a.addFloatBox(wx, wy, zf + 0.45, 1.7, 1.2, 0.08, glassMat);
            if ((i + rowIdx) % 3 === 0) a.addFloatBox(wx + 0.35, wy + 0.1, zf + 0.52, 0.75, 0.9, 0.05, brokenMat);
          }
        });
        [-3.7, 3.7].forEach((px) => a.addSolid(px, 0, zf + 0.5, 0.8, 4.4, 0.8, wallLight));
        a.addFloatBox(0, 4.6, zf + 0.6, 9.2, 0.35, 2.4, wallDark);
        a.addCanvasBox(0, 6.4, zf + 0.4, 7.0, 1.3, 0.16, (ctx, cv) => {
          ctx.fillStyle = "#1d2a33"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center";
          G.fitFont(ctx, G.T("world.schoolName"), 28, 236); ctx.fillStyle = "#cddbe6";
          ctx.fillText(G.T("world.schoolName"), 128, 74);
          ctx.fillStyle = "#101418";
          for (let i = 0; i < 5; i++) ctx.fillRect(G.rng() * 230, G.rng() * 110, 8 + G.rng() * 24, 5 + G.rng() * 10);
        }, 0x3a3a34);
        // roofs sit above every interior ceiling (3.55 downstairs, 7.75 up)
        const mainD = zf - (B.cz + B.d / 2);
        a.addFloatBox(0, 8.75, (zf + B.cz + B.d / 2) / 2, E.w + 1, 0.5, mainD, wallDark);
        a.addFloatBox(0, 9.3, B.cz, B.w + 2, 0.5, B.d + 2, wallDark);
      },
      boss(a) {
        const M = a.M, B = a.BOSS, F2 = a.F2, gz = B.cz;
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xc9b06a });
        const courtMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3c });
        const boardMat2 = new THREE.MeshLambertMaterial({ color: 0xd8d4c8 });
        const hoopMat = new THREE.MeshBasicMaterial({ color: 0xd94f2b });
        const matMat = new THREE.MeshLambertMaterial({ color: 0x2f5a7a });
        a.addFloatBox(0, 0.02, gz, B.w - 4, 0.04, B.d - 3, courtMat);
        const line = (x, z, w, d, ry) => a.addFloatBox(x, 0.05, z, w, 0.03, d, lineMat, ry);
        line(0, gz, 0.14, B.d - 3.4);
        line(0, gz - (B.d - 3.4) / 2, B.w - 4.4, 0.14);
        line(0, gz + (B.d - 3.4) / 2, B.w - 4.4, 0.14);
        [-1, 1].forEach((s) => {
          line(s * (B.w - 4.4) / 2, gz, 0.14, B.d - 3.4);
          [-2.4, 2.4].forEach((dz) => line(s * (B.w / 2 - 4.6), gz + dz, 5.2, 0.12));
          line(s * (B.w / 2 - 7.2), gz, 0.12, 4.8);
        });
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          a.addFloatBox(Math.cos(ang) * 2.6, 0.05, gz + Math.sin(ang) * 2.6, 1.4, 0.03, 0.12, lineMat, -ang + Math.PI / 2);
        }
        [-1, 1].forEach((s) => {
          const bx = s * (B.w / 2 - 0.6);
          a.addFloatBox(bx, 3.3, gz, 0.14, 1.1, 1.8, boardMat2);
          [-0.42, 0, 0.42].forEach((dz) => a.addFloatBox(bx - s * 0.5, 2.85, gz + dz, 0.9, 0.07, 0.07, hoopMat));
        });
        [G.T("world.banner1"), G.T("world.banner2"), G.T("world.banner3")].forEach((t, i) => {
          [-1, 1].forEach((s) => {
            a.addCanvasBox(-9 + i * 9, 6.2, s * (B.d / 2 - 0.35) + gz, 3.0, 1.6, 0.08, (ctx, cv) => {
              ctx.fillStyle = i % 2 ? "#7a2f2a" : "#2f4a7a"; ctx.fillRect(0, 0, cv.width, cv.height);
              ctx.textAlign = "center"; G.fitFont(ctx, t, 56, 232); ctx.fillStyle = "#f0e6cf";
              ctx.fillText(t, 128, 88);
            }, 0x2a2a26, s > 0 ? Math.PI : 0);
          });
        });
        a.addCanvasBox(0, 5.2, gz - B.d / 2 + 0.3, 4.2, 1.8, 0.14, (ctx, cv) => {
          ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center";
          ctx.font = "bold 22px monospace"; ctx.fillStyle = "#ffcc55";
          ctx.fillText(G.T("world.home"), 64, 34); ctx.fillText(G.T("world.away"), 192, 34);
          ctx.font = "bold 54px monospace"; ctx.fillStyle = "#ff3b3b";
          ctx.fillText("00 : 00", 128, 96);
        }, 0x1a1a1a);
        for (let i = 0; i < 5; i++) {
          [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) =>
            a.addProp(sx * (15 - i * 1.1), gz + sz * 5.5, 0.9, 0.45 + i * 0.22, 0.8, M.woodDark));
        }
        [[-14, gz - 6.5], [14, gz + 6.5]].forEach(([mx, mz]) => {
          for (let i = 0; i < 3; i++) a.addSolid(mx, 0.38 * i, mz, 2.2, 0.38, 1.1, matMat, 0, i * 0.08);
        });
        for (let i = 0; i < 7; i++) {
          a.addFloatBox(-13 + G.rng() * 26, 0.16, gz - 6 + G.rng() * 12, 0.32, 0.32, 0.32,
            new THREE.MeshLambertMaterial({ color: i % 2 ? 0xd9873c : 0xb6543a }), G.rng() * 3);
        }
        a.addCorpse(5, gz + 3, 0.7, 0x3a5c8a);
        a.mountWallGun("school_wall", -B.w / 2 + 0.3, 0, gz + 2, true);
      },
    },
    hospital: {
      entry(a) {
        const M = a.M, E = a.ENTRY;
        // the counter sits well off-centre: the staircase comes down the
        // middle of the hall and the player spawns beside it
        a.addSolid(9, 0, E.cz + 3.4, 6.4, 1.05, 1.1, M.locker[0]);
        a.addFloatBox(9, 1.14, E.cz + 3.4, 6.2, 0.1, 1.2, M.metal);
        a.addFloatBox(9, 1.6, E.cz + 2.85, 1.0, 0.7, 0.07, M.locker[2]);   // red cross
        a.addFloatBox(9, 1.6, E.cz + 2.84, 0.32, 0.9, 0.08, M.locker[2]);
        for (let i = 0; i < 4; i++) {
          const px = -9 + i * 6;
          a.addSolid(px, 0, E.cz - 2.6, 2.6, 0.5, 0.7, M.locker[3]);
          a.addFloatBox(px, 0.95, E.cz - 2.9, 2.6, 0.9, 0.12, M.locker[3]);
        }
        a.addCanvasBox(0, 2.6, E.cz - E.d / 2 + 0.35, 4.0, 1.2, 0.08, (ctx, cv) => {
          ctx.fillStyle = "#08281c"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; G.fitFont(ctx, G.T("world.emergency"), 30, 236); ctx.fillStyle = "#9fe1cb";
          ctx.fillText(G.T("world.emergency"), 128, 52);
          G.fitFont(ctx, G.T("world.emergencySub"), 20, 236); ctx.fillStyle = "#6fb79c";
          ctx.fillText(G.T("world.emergencySub"), 128, 92);
        }, 0x123b2c);
        a.scatterClutter(-10, E.cz, 8, 9, 0, 3, { axis: "z", at: 0, half: 5 });
        a.scatterClutter(10, E.cz, 8, 9, 0, 3, { axis: "z", at: 0, half: 5 });
        a.addCorpse(-4.2, E.cz - 3.6, 1.3, 0xc9d0d0);
        a.addBloodStain(-4.2, E.cz - 3.6, 1.2, 0.3);
        a.addBloodStain(-2.4, E.cz - 1.2, 0.9, 1.4);
      },
      boss(a) {
        const M = a.M, B = a.BOSS, gz = B.cz;
        const tileMat = new THREE.MeshLambertMaterial({ color: 0x2c4a3c });
        a.addFloatBox(0, 0.02, gz, B.w - 5, 0.04, B.d - 3, tileMat);
        // triage bays down both long walls
        [-1, 1].forEach((s) => {
          for (let i = 0; i < 4; i++) {
            const px = -10 + i * 6.6, pz = gz + s * (B.d / 2 - 2.2);
            a.addSolid(px, 0.42, pz, 1.9, 0.24, 0.95, M.locker[0]);
            a.addFloatBox(px, 0.6, pz, 1.7, 0.06, 0.85, M.locker[1]);
            a.addFloatBox(px + 1.2, 1.4, pz, 0.1, 1.7, 0.1, M.rail);
            a.addFloatBox(px - 1.5, 1.5, pz, 0.12, 2.8, 2.0, M.locker[3]);   // curtain
          }
        });
        a.addSolid(0, 0, gz - B.d / 2 + 1.4, 7.0, 1.1, 1.0, M.locker[0]);
        a.addCanvasBox(0, 4.8, gz - B.d / 2 + 0.3, 5.0, 1.6, 0.14, (ctx, cv) => {
          ctx.fillStyle = "#06170f"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; G.fitFont(ctx, G.T("world.triage"), 40, 236); ctx.fillStyle = "#ff6b6b";
          ctx.fillText(G.T("world.triage"), 128, 58);
          ctx.strokeStyle = "#7dffc0"; ctx.lineWidth = 3; ctx.beginPath();
          for (let i = 0; i <= 256; i += 6) ctx.lineTo(i, 96 + Math.sin(i * 0.24) * 16);
          ctx.stroke();
        }, 0x0c2a1e);
        a.addLight(0, 6.0, gz, 0xff6b6b, 1.2, 2.6);
        a.addCorpse(3.5, gz + 2.5, 0.9, 0xc9d0d0);
        a.addBloodStain(3.5, gz + 2.5, 1.4, 0.6);
        a.mountWallGun("hospital_wall", -B.w / 2 + 0.3, 0, gz + 2, true);
      },
    },
    bunker: {
      entry(a) {
        const M = a.M, E = a.ENTRY;
        // blast door frame on the outer wall, sealed for good
        a.addFloatBox(0, 2.2, E.cz + E.d / 2 - 0.35, 6.0, 4.2, 0.35, M.metal);
        for (let i = 0; i < 5; i++) a.addFloatBox(-2.2 + i * 1.1, 2.2, E.cz + E.d / 2 - 0.55, 0.22, 4.0, 0.12, M.rail);
        a.addGlowBox(0, 4.5, E.cz + E.d / 2 - 0.55, 2.0, 0.16, 0.14, 0xff5c3d);
        a.addCanvasBox(0, 2.6, E.cz + E.d / 2 - 0.58, 3.4, 1.0, 0.08, (ctx, cv) => {
          ctx.fillStyle = "#1a1408"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; G.fitFont(ctx, G.T("world.blastDoor"), 28, 236); ctx.fillStyle = "#ffcf4d";
          ctx.fillText(G.T("world.blastDoor"), 128, 48);
          ctx.font = "bold 19px monospace"; ctx.fillStyle = "#ff7a7a";
          ctx.fillText(G.T("world.sealed"), 128, 86);
        }, 0x2a2118);
        // kept clear of the stair shaft down the middle of the hall
        [-9.5, -5, 5, 9.5].forEach((px) => {
          a.addSolid(px, 0, E.cz + 3.2, 1.2, 1.2, 1.2, M.crate, 0, G.rng());
          a.addSolid(px + 0.5, 1.2, E.cz + 3.0, 0.8, 0.8, 0.8, M.crate, 0, G.rng());
        });
        for (let i = 0; i < 4; i++) a.addFloatBox(0, 3.4, E.cz - 4 + i * 2.4, E.w - 2, 0.26, 0.26, M.rail);
        a.scatterClutter(-9.5, E.cz - 2, 6, 7, 0, 3, { axis: "z", at: 0, half: 5.5 });
        a.scatterClutter(9.5, E.cz - 2, 6, 7, 0, 3, { axis: "z", at: 0, half: 5.5 });
        a.addCorpse(-3.6, E.cz - 3.2, 2.1, 0x54503f);
        a.addBloodStain(-3.6, E.cz - 3.2, 1.1, 0.5);
      },
      boss(a) {
        const M = a.M, B = a.BOSS, gz = B.cz;
        const plateMat = new THREE.MeshLambertMaterial({ color: 0x3a3a34 });
        a.addFloatBox(0, 0.02, gz, B.w - 5, 0.04, B.d - 3, plateMat);
        // the reactor column at the centre, caged, with coolant pipes
        a.addSolid(0, 0, gz, 3.2, 6.0, 3.2, M.metal);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          a.addFloatBox(Math.cos(ang) * 2.6, 2.0, gz + Math.sin(ang) * 2.6, 0.16, 4.0, 0.16, M.rail);
        }
        a.addGlowBox(0, 3.3, gz, 3.4, 0.6, 3.4, 0xff7a3d);
        a.addLight(0, 3.6, gz, 0xff7a3d, 1.5, 3.4);
        [-1, 1].forEach((s) => {
          for (let i = 0; i < 3; i++) {
            const px = s * (B.w / 2 - 2.6);
            a.addSolid(px, 0, gz - 4 + i * 4, 2.0, 2.4, 2.2, M.metal);
            a.addGlowBox(px - s * 1.05, 1.5, gz - 4 + i * 4, 0.08, 0.5, 0.7, i % 2 ? 0x7dc9ff : 0xffcf4d);
          }
          for (let i = 0; i < 5; i++) a.addFloatBox(s * (B.w / 2 - 1.0), 3.2 + (i % 2) * 0.5, gz - 5 + i * 2.5, 0.3, 0.3, 2.4, M.rail);
        });
        a.addCanvasBox(0, 5.4, gz - B.d / 2 + 0.3, 4.6, 1.5, 0.14, (ctx, cv) => {
          ctx.fillStyle = "#170d04"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; G.fitFont(ctx, G.T("world.reactor"), 34, 236); ctx.fillStyle = "#ff9a4d";
          ctx.fillText(G.T("world.reactor"), 128, 52);
          ctx.font = "bold 20px monospace"; ctx.fillStyle = "#ff5c3d";
          ctx.fillText(G.T("world.coreUnstable"), 128, 92);
        }, 0x2a1a0c);
        a.addCorpse(-4, gz + 4, 1.7, 0x54503f);
        a.addBloodStain(-4, gz + 4, 1.2, 0.8);
        a.mountWallGun("bunker_wall", -B.w / 2 + 0.3, 0, gz + 5, true);
      },
    },
  };
  // ---------------- C1: the yard in front of the school ----------------
  // Dusk, not night: cool blue-grey moonlight over the grounds, so the warm room
  // lights burning inside read as somewhere to head for. Everything out here is
  // ground level, and the perimeter keeps an unbroken collider line even where
  // the fence is meant to look torn open -- a real hole would let the player
  // walk out along the side of the building and off the edge of the level.
  function buildSchoolYard(ENTRY_HALL, YARD) {
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x3c4f2c });
    const grassTuftMat = new THREE.MeshLambertMaterial({ color: 0x53703a });
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x4a4436 });
    const concreteMat = new THREE.MeshLambertMaterial({ color: 0x6b6a63 });
    const crackMat = new THREE.MeshLambertMaterial({ color: 0x2a2a26 });
    const barkMat = new THREE.MeshLambertMaterial({ color: 0x3b2f24 });
    const branchMat = new THREE.MeshLambertMaterial({ color: 0x4a3c2d });
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x55565a });
    const brickMat = new THREE.MeshLambertMaterial({ color: 0x6b4a40 });

    const x0 = YARD.cx - YARD.w / 2, x1 = YARD.cx + YARD.w / 2;   // -26 .. 26
    const z0 = YARD.cz - YARD.d / 2, z1 = YARD.cz + YARD.d / 2;   // 33 .. 60

    // ---- ground ----
    const ground = new THREE.Mesh(new THREE.BoxGeometry(YARD.w, 0.4, YARD.d), grassMat);
    ground.position.set(YARD.cx, -0.2, YARD.cz);
    ground.receiveShadow = true;
    scene.add(ground);
    world.heightZones.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, height: 0 });
    world.regions.push({ name: "YARD", y: 0, minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    world.waypointNodes.YARD = { x: 0, z: 46, y: 0 };
    // through the front doors, not the facade beside them
    world.waypointNodes.DFRONT = { x: 0, z: z0 + 1.2, y: 0 };
    world.waypointEdges.YARD = world.waypointEdges.YARD || [];
    world.waypointEdges.DFRONT = ["YARD", "ENTRY"];
    world.waypointEdges.YARD.push("DFRONT");
    world.waypointEdges.ENTRY.push("DFRONT");

    // Uneven, overgrown ground: shallow mounds you step straight onto (well
    // under STEP_UP), rather than real terrain the collision system can't model.
    const MOUNDS = [
      [-17, 39, 7, 5, 0.32], [15, 41, 8, 6, 0.28], [-9, 50, 6, 4.5, 0.22],
      [10, 52, 7, 5, 0.34], [-21, 53, 6, 6, 0.26], [20, 48, 5, 5, 0.3],
      [0, 57.5, 9, 4, 0.2],
    ];
    MOUNDS.forEach(([mx, mz, mw, md, mh]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md), dirtMat);
      m.position.set(mx, mh / 2, mz);
      scene.add(m);
      world.heightZones.push({ minX: mx - mw / 2, maxX: mx + mw / 2, minZ: mz - md / 2, maxZ: mz + md / 2, height: mh });
    });

    // ---- cracked concrete path from the gate to the front doors ----
    for (let i = 0; i < 9; i++) {
      const pz = z0 + 1.4 + i * 3.0;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 2.7), concreteMat);
      slab.position.set(i % 3 === 1 ? 0.18 : -0.12, 0.05, pz);
      slab.rotation.y = (G.rng() - 0.5) * 0.03;
      scene.add(slab);
      for (let c = 0; c < 2; c++) {
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 1.2 + G.rng() * 1.2), crackMat);
        crack.position.set((G.rng() - 0.5) * 3.4, 0.11, pz + (G.rng() - 0.5) * 1.8);
        crack.rotation.y = G.rng() * Math.PI;
        scene.add(crack);
      }
    }

    // ---- grass, weeds, fallen leaves, vines, bushes, old trees and the
    // junk of an abandoned school (pass D1, js/schooldress.js) ----
    if (G.SchoolDress) G.SchoolDress.yard({ scene, world, level, quality, x0, x1, z0, z1, YARD, ENTRY_HALL,
      addFloatBox, addBloodStain, addLight, addGlowBox, fenceMat, barkMat, branchMat });

    // ---- perimeter: steel railings and brick piers, wrecked but sealed ----
    function railRun(ax, from, to, fixed, broken) {
      const span = Math.abs(to - from), steps = Math.max(1, Math.round(span / 3)), seg = span / steps;
      const lo = Math.min(from, to);
      for (let i = 0; i < steps; i++) {
        const c = lo + seg * (i + 0.5);
        const px = ax === "x" ? c : fixed, pz = ax === "x" ? fixed : c;
        const gone = broken && i % 4 === 1;              // a missing panel
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.1, 0.22), fenceMat);
        post.position.set(ax === "x" ? c - seg / 2 : fixed, 1.05, ax === "x" ? fixed : c - seg / 2);
        post.rotation.z = gone ? 0.28 : 0;
        scene.add(post);
        if (gone) continue;
        [0.6, 1.5].forEach((ry) => {
          const rail = new THREE.Mesh(ax === "x"
            ? new THREE.BoxGeometry(seg, 0.12, 0.12) : new THREE.BoxGeometry(0.12, 0.12, seg), fenceMat);
          rail.position.set(px, ry, pz);
          scene.add(rail);
        });
        for (let k = 0; k < 5; k++) {
          if (G.rng() < 0.22) continue;                  // missing pickets
          const off = (k - 2) * (seg / 5);
          const pk = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.7, 0.09), fenceMat);
          pk.position.set(ax === "x" ? px + off : px, 0.85, ax === "x" ? pz : pz + off);
          scene.add(pk);
        }
      }
      // the sealed line behind the panels, whatever they look like
      world.colliders.push(ax === "x"
        ? new THREE.Box3(new THREE.Vector3(lo, 0, fixed - 0.3), new THREE.Vector3(lo + span, 3.2, fixed + 0.3))
        : new THREE.Box3(new THREE.Vector3(fixed - 0.3, 0, lo), new THREE.Vector3(fixed + 0.3, 3.2, lo + span)));
    }
    railRun("x", x0, x1, z1 - 0.5, true);            // front fence, along the road
    railRun("z", z0, z1, x0 + 0.5, true);            // west fence
    railRun("z", z0, z1, x1 - 0.5, false);           // east fence
    // brick walls closing the two flanks between the fence and the building
    [[x0 + 0.5, -ENTRY_HALL.w / 2], [ENTRY_HALL.w / 2, x1 - 0.5]].forEach(([fx0, fx1]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(fx1 - fx0, 2.6, 0.5), brickMat);
      wall.position.set((fx0 + fx1) / 2, 1.3, z0 + 0.25);
      scene.add(wall);
      world.colliders.push(new THREE.Box3().setFromObject(wall));
    });
    // the gate itself: both leaves wrenched off their hinges and jammed shut
    [-1, 1].forEach((s) => {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.3, 0.14), fenceMat);
      leaf.position.set(s * 1.6, 1.15, z1 - 0.55);
      leaf.rotation.z = s * 0.17;
      leaf.rotation.y = s * 0.12;
      scene.add(leaf);
      world.colliders.push(new THREE.Box3().setFromObject(leaf));
    });
    // a fallen fence section on the grass, which is where the "hole" went
    const fallen = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 2.0), fenceMat);
    fallen.position.set(x0 + 3.4, 0.09, 45);
    fallen.rotation.y = 0.42;
    scene.add(fallen);

    // ---- the ruined school sign ----
    {
      const sx = -7.5, sz = 37.5;
      [-1.7, 1.7].forEach((dx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), concreteMat);
        leg.position.set(sx + dx, 0.75, sz);
        leg.rotation.z = dx < 0 ? 0.05 : -0.09;
        scene.add(leg);
        world.colliders.push(new THREE.Box3().setFromObject(leg));
      });
      const board = addCanvasBox(sx, 2.15, sz + 0.1, 4.6, 1.5, 0.16, (ctx, cv) => {
        ctx.fillStyle = "#2c4a63"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.textAlign = "center";
        // pass D1: the letters are separate pieces bolted on, and some are gone --
        // two fell off, one hangs by a single screw
        const name = G.T("world.schoolName");
        G.fitFont(ctx, name, 26, 236); ctx.fillStyle = "#d8e4ee";
        const letters = Array.from(name);
        const solid = letters.map((c, i) => (c.trim() ? i : -1)).filter((i) => i >= 0);
        const gone = [solid[3], solid[8]], hanging = solid[6];   // picked among real letters, never a space
        const widths = letters.map((c) => ctx.measureText(c).width);
        let cxp = 128 - widths.reduce((s, w) => s + w, 0) / 2;
        ctx.textAlign = "left";
        letters.forEach((c, i) => {
          if (gone.includes(i)) { ctx.fillStyle = "rgba(10,14,18,0.35)"; ctx.fillRect(cxp + 2, 30, widths[i] - 4, 26); ctx.fillStyle = "#d8e4ee"; }   // a paler patch where it was
          else if (i === hanging) { ctx.save(); ctx.translate(cxp + 4, 38); ctx.rotate(0.9); ctx.fillText(c, 0, 14); ctx.restore(); }
          else ctx.fillText(c, cxp, 52);
          cxp += widths[i];
        });
        ctx.textAlign = "center";
        G.fitFont(ctx, G.T("world.welcome"), 22, 236); ctx.fillStyle = "#9fb4c6";
        ctx.fillText(G.T("world.welcome"), 128, 92);
        ctx.fillStyle = "#101418";
        ctx.fillRect(196, 98, 60, 30);                 // the corner that broke off (clear of the name)
        for (let i = 0; i < 7; i++) ctx.fillRect(G.rng() * 240, G.rng() * 120, 6 + G.rng() * 26, 4 + G.rng() * 9);
      }, 0x3a3a34);
      board.rotation.z = -0.07;
      board.rotation.y = 0.05;
      world.colliders.push(new THREE.Box3().setFromObject(board));
    }

    // ---- outdoor cover: crates, bins, a flattened bike rack ----
    const outMat = new THREE.MeshLambertMaterial({ color: 0x6f5a3a });
    const binMat = new THREE.MeshLambertMaterial({ color: 0x35553f });
    [[-11.5, 41], [12.5, 44.5], [-20, 48.5], [16, 51], [-5.5, 55.5], [7, 38.5]].forEach(([cx, cz], i) => {
      if (i % 3 === 0) {
        const bin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.9), binMat);
        bin.position.set(cx, 0.62, cz); bin.rotation.y = G.rng();
        scene.add(bin);
        world.colliders.push(new THREE.Box3().setFromObject(bin));
      } else {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), outMat);
        crate.position.set(cx, 0.5, cz); crate.rotation.y = G.rng();
        scene.add(crate);
        world.colliders.push(new THREE.Box3().setFromObject(crate));
        if (G.rng() < 0.6) {
          const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), outMat);
          top.position.set(cx + 0.2, 1.35, cz - 0.15); top.rotation.y = G.rng();
          scene.add(top);
        }
      }
    });
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.4), fenceMat);
      bar.position.set(9.5 + i * 0.55, 0.28, 56);
      bar.rotation.x = 0.5 + G.rng() * 0.6;
      scene.add(bar);
    }

    // ---- five bodies, read gate-to-door as one story ----
    // Someone went down just inside the gate, one fell off a bike on the path,
    // one died trying to climb the fence the wrong way, one bled out at the
    // sign, and the last made it as far as the threshold.
    addCorpse(2.6, 56.5, 2.2, 0x5a4a6a);
    addBloodStain(2.6, 56.5, 1.1, 0.4);
    for (let i = 0; i < 6; i++) addBloodStain(2.2 - i * 0.35, 55.6 - i * 1.5, 0.45 + G.rng() * 0.3, G.rng() * 3);
    addFloatBox(3.8, 0.16, 57.2, 0.6, 0.32, 0.4, new THREE.MeshLambertMaterial({ color: 0x8a3f3f }), 0.5);
    addCorpse(-3.4, 48.5, 0.6, 0x3f6a8a);
    addBloodStain(-3.4, 48.5, 1.2, 1.1);
    for (let i = 0; i < 4; i++) addFloatBox(-4.6 + i * 0.3, 0.2, 47.4 + (i % 2) * 0.5, 0.12, 0.4, 0.12, fenceMat, 0.8);
    addCorpse(x0 + 2.2, 45.2, 1.4, 0x6a6a3a, { y: 0.45, rz: -0.55 });
    addBloodStain(x0 + 2.6, 45.9, 0.9, 0.2);
    addCorpse(-7.2, 39.4, 2.9, 0x7a5a3a);
    addBloodStain(-7.2, 39.4, 1.0, 0.9);
    addFloatBox(-8.6, 0.18, 38.9, 0.55, 0.36, 0.34, new THREE.MeshLambertMaterial({ color: 0x3f5a8a }), 1.1);
    addCorpse(0.4, 34.6, 1.55, 0x2f4f7a);
    addBloodStain(0.4, 34.6, 1.3, 0.6);
    for (let i = 0; i < 5; i++) addBloodStain(0.3, 35.2 + i * 0.9, 0.5 + G.rng() * 0.25, G.rng() * 3);

    // ---- dusk lighting ----
    // One cheap directional fill so the grounds read as "just after sunset,
    // still legible" rather than a black void, biased cool against the warm
    // point lights burning inside the building.
    const moon = new THREE.DirectionalLight(0x8fb0e8, 0.68);
    moon.position.set(-34, 46, 78);
    moon.target.position.set(0, 0, 42);
    scene.add(moon); scene.add(moon.target);
    scene.add(new THREE.HemisphereLight(0x53627a, 0x2a3323, 0.45));
    // two failing lamp posts, the only warm light out here
    [[-13, 46], [13, 50]].forEach(([lx, lz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.4, 0.24), fenceMat);
      post.position.set(lx, 2.2, lz);
      scene.add(post);
      world.colliders.push(new THREE.Box3().setFromObject(post));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.5), fenceMat);
      head.position.set(lx, 4.4, lz);
      scene.add(head);
      addGlowBox(lx, 4.2, lz, 0.6, 0.08, 0.36, 0xffd9a0);
      addLight(lx, 4.1, lz, 0xffcf96, 0.85, 2.6);
    });
  }
  // buildComplex + levelPlan replaced the old per-theme decorators: the theme
  // now lives in the plan (room list, furniture kits, entry/boss dressing and
  // material palette) rather than in a pass that painted props onto a shared
  // five-room layout.



  // ---------------- Layout ----------------
  // Every level is generated by buildComplex() from a per-theme plan (see
  // levelPlan below). The old shared five-room A-E hub layout is gone: it left
  // the hospital and the bunker at roughly an eighth of the school.s size with
  // one wall gun each (category M).
  //
  // Called down here, not at the top: the plan tables are `const`, so calling
  // before their declarations hits the temporal dead zone.
  buildComplex(levelPlan(level.theme));

  // buildComplex sets both of these from the level plan; these are only a
  // backstop in case a plan ever omits them.
  if (!world.spawn) world.spawn = { x: 0, z: 3 };
  if (!world.bossRoomCenter) world.bossRoomCenter = new THREE.Vector3(0, 0, -30);


  // ---------------- Unstick spawn points ----------------
  // Room-centre spawn points drift into furniture as the rooms get dressed --
  // a classroom's desk grid sits exactly where the middle of the room is. A
  // zombie that appears inside a desk is pinned against it for the rest of the
  // wave, so anything blocked is nudged outward until it has room to stand.
  (function unstickSpawnPoints() {
    if (!world.spawnPoints) return;
    const R = 0.45;
    const blocked = (x, y, z) => world.colliders.some((c) =>
      x - R < c.max.x && x + R > c.min.x && z - R < c.max.z && z + R > c.min.z && y + 0.1 < c.max.y && y + 2.0 > c.min.y);
    // The player spawn gets the same treatment: starting inside a crate means
    // starting unable to move at all.
    if (world.spawn && blocked(world.spawn.x, G.getFloorHeightAt(world, world.spawn.x, world.spawn.z, 0), world.spawn.z)) {
      const y0 = G.getFloorHeightAt(world, world.spawn.x, world.spawn.z, 0);
      outer: for (let ring = 1; ring <= 8; ring++) {
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2;
          const nx = world.spawn.x + Math.cos(ang) * ring * 1.0;
          const nz = world.spawn.z + Math.sin(ang) * ring * 1.0;
          if (Math.abs(G.getFloorHeightAt(world, nx, nz, y0) - y0) > 0.05) continue;
          if (blocked(nx, y0, nz)) continue;
          world.spawn = { x: nx, z: nz };
          break outer;
        }
      }
    }
    world.spawnPoints.forEach((sp) => {
      const y = sp.pos.y;
      if (!blocked(sp.pos.x, y, sp.pos.z)) return;
      for (let ring = 1; ring <= 6; ring++) {
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2 + ring * 0.26;
          const nx = sp.pos.x + Math.cos(ang) * ring * 0.9;
          const nz = sp.pos.z + Math.sin(ang) * ring * 0.9;
          // must stay on the same storey, or an upstairs spawn drops through
          if (Math.abs(G.getFloorHeightAt(world, nx, nz, y) - y) > 0.05) continue;
          if (blocked(nx, y, nz)) continue;
          sp.pos.set(nx, y, nz);
          return;
        }
      }
    });
  })();
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

// Puts a sliding door's panels where its open fraction d.p says, and their
// colliders with them. `bounce` (metres) pushes every panel back against its
// direction of travel -- the little rebound off the stop; `jiggle` rattles
// them across the rail while a zombie leans on the door.
G.placeDoorLeaves = function (d, bounce, jiggle) {
  const back = d.open ? -1 : 1;
  for (const lf of d.leaves) {
    const a = lf.a0 + lf.dir * (d.p * lf.T + back * (bounce || 0));
    const n = lf.n + (jiggle || 0);
    if (d.axis === "x") lf.mesh.position.set(a, lf.mesh.position.y, n);
    else lf.mesh.position.set(n, lf.mesh.position.y, a);
    // the collider is the panel padded to half a metre thick and the full
    // doorway high: a thin box is easy to slip through or over
    const lo = a - lf.L / 2, hi = a + lf.L / 2;
    if (d.axis === "x") lf.collider.set(new THREE.Vector3(d.x + lo, d.baseY, d.z + n - 0.25), new THREE.Vector3(d.x + hi, d.baseY + d.h, d.z + n + 0.25));
    else lf.collider.set(new THREE.Vector3(d.x + n - 0.25, d.baseY, d.z + lo), new THREE.Vector3(d.x + n + 0.25, d.baseY + d.h, d.z + hi));
  }
};
// Who would moving this door from open fraction p0 to p1 run a panel's
// leading edge into? Only the strip each panel sweeps into counts, so a
// player leaning on the flat of a panel does not jam it.
G.doorSweepHits = function (d, p0, p1, bodies) {
  const out = [];
  for (const lf of d.leaves) {
    const c0 = lf.a0 + lf.dir * p0 * lf.T, c1 = lf.a0 + lf.dir * p1 * lf.T;
    const s = Math.sign(c1 - c0);
    if (!s) continue;
    const e0 = c0 + s * lf.L / 2, e1 = c1 + s * lf.L / 2;
    const lo = Math.min(e0, e1) - 0.03, hi = Math.max(e0, e1) + 0.03;
    for (const b of bodies) {
      if (b.y < d.baseY - 1 || b.y > d.baseY + 2.4) continue;
      const a = d.axis === "x" ? b.x - d.x : b.z - d.z, n = d.axis === "x" ? b.z - d.z : b.x - d.x;
      if (a + b.r > lo && a - b.r < hi && Math.abs(n - lf.n) < 0.25 + b.r) out.push(Object.assign({ leaf: lf }, b));
    }
  }
  return out;
};
