// ============================================================
// WORLD: level defs, voxel scene builders, spawner, interactions, boss
// ============================================================
window.G = window.G || {};

// ---------------- Level definitions ----------------
G.LEVELS = [
  {
    id: 1, name: "โรงเรียนร้าง", theme: "school", icon: "🏚️", wordsKey: "level1",
    waves: 5, difficulty: 1, bossEvery: 3,
    spawnBaseInterval: 5.0, maxAliveZombies: 6,
  },
  {
    id: 2, name: "โรงพยาบาลร้าง", theme: "hospital", icon: "🏥", wordsKey: "level2",
    waves: 6, difficulty: 1.35, bossEvery: 3,
    spawnBaseInterval: 4.2, maxAliveZombies: 8,
  },
  {
    id: 3, name: "บังเกอร์ใต้ดิน", theme: "bunker", icon: "🛡️", wordsKey: "level3",
    waves: 7, difficulty: 1.7, bossEvery: 3,
    spawnBaseInterval: 3.4, maxAliveZombies: 10,
  },
];

G.getLevel = (id) => G.LEVELS.find((l) => l.id === id);

G.THEME_PALETTES = {
  school:   { floor: 0x2b2b26, wall: 0x3a3a30, accent: 0x555540, fog: 0x1a1a16, fogNear: 3, fogFar: 26, light: 0x8899aa, ambient: 0x33362a },
  hospital: { floor: 0x1e2b23, wall: 0x24352a, accent: 0x3a5c46, fog: 0x0e1a13, fogNear: 2.5, fogFar: 22, light: 0x66ffaa, ambient: 0x1c3325 },
  bunker:   { floor: 0x18181c, wall: 0x232328, accent: 0x33333c, fog: 0x08080a, fogNear: 1.8, fogFar: 16, light: 0xff8844, ambient: 0x151518 },
};

// ---------------- Scene (voxel) builder ----------------
// Simple modular layout: a sequence of connected rectangular rooms with corridors.
// Returns { colliders:[Box3...], spawnPoints:[{pos, types:[...]}], doors:[...], buttons:[...], crates:[...], traps:[...], secretZone:{...} }
G.buildLevelScene = function (scene, level, quality) {
  const pal = G.THEME_PALETTES[level.theme];
  scene.background = new THREE.Color(pal.fog);
  const fogFar = quality === "vlow" ? pal.fogFar * 0.5 : quality === "low" ? pal.fogFar * 0.7 : pal.fogFar;
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, fogFar);

  const ambient = new THREE.AmbientLight(pal.ambient, 0.9);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(pal.light, pal.floor, 0.4);
  scene.add(hemi);

  const world = { colliders: [], spawnPoints: [], doors: [], buttons: [], crates: [], traps: [], lights: [], interactables: [], secretZone: null };

  const floorMat = new THREE.MeshLambertMaterial({ color: pal.floor });
  const wallMat = new THREE.MeshLambertMaterial({ color: pal.wall });
  const accentMat = new THREE.MeshLambertMaterial({ color: pal.accent });

  // Room chain: main corridor (Z axis) + 3 side rooms
  const rooms = [
    { cx: 0, cz: 0, w: 8, d: 8 },     // start room
    { cx: 0, cz: -14, w: 10, d: 10 }, // mid room
    { cx: 10, cz: -14, w: 9, d: 9 },  // side room (secret-ish)
    { cx: 0, cz: -28, w: 12, d: 12 }, // final/boss room
  ];

  function addFloor(cx, cz, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), floorMat);
    m.position.set(cx, -0.2, cz);
    m.receiveShadow = true;
    scene.add(m);
  }
  function addWallSeg(x, z, w, d, h) {
    h = h || 3.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2, z);
    scene.add(m);
    world.colliders.push(new THREE.Box3().setFromObject(m));
  }
  function addProp(x, z, w, h, d, mat, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || accentMat);
    m.position.set(x, h / 2, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    world.colliders.push(new THREE.Box3().setFromObject(m));
    return m;
  }
  function addFlickerLight(x, y, z, color) {
    const l = new THREE.PointLight(color || pal.light, 1.2, 12);
    l.position.set(x, y, z);
    scene.add(l);
    world.lights.push(l);
    return l;
  }

  rooms.forEach((r) => addFloor(r.cx, r.cz, r.w, r.d));
  // connecting corridor floors
  addFloor(0, -7, 3.4, 6);
  addFloor(0, -21, 3.4, 6);
  addFloor(5, -14, 6, 3.4);

  // outer walls per room (simple box perimeter with gaps left implicit via corridor floors — use thin perimeter walls not fully sealing corridors)
  rooms.forEach((r, i) => {
    const hw = r.w / 2, hd = r.d / 2;
    addWallSeg(r.cx - hw, r.cz, 0.4, r.d);
    addWallSeg(r.cx + hw, r.cz, 0.4, r.d);
    addWallSeg(r.cx, r.cz - hd, r.w, 0.4);
    addWallSeg(r.cx, r.cz + hd, r.w, 0.4);
    addFlickerLight(r.cx, 3, r.cz, pal.light);
  });

  // furniture / cover props (desks, beds, crates depending on theme)
  addProp(-2, 2, 1.4, 0.9, 0.7, accentMat);
  addProp(2, 3, 1.4, 0.9, 0.7, accentMat);
  addProp(-3, -14, 1.2, 1, 2, accentMat);
  addProp(3, -12, 1.2, 1, 2, accentMat);
  addProp(0, -28, 2, 1.2, 2, accentMat);

  // Spawn points: behind doors, dark corners, end of corridors
  world.spawnPoints = [
    { pos: new THREE.Vector3(-3, 0, 3), types: ["normal"] },
    { pos: new THREE.Vector3(3, 0, 3), types: ["normal"] },
    { pos: new THREE.Vector3(-4, 0, -14), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(4, 0, -14), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(10, 0, -17), types: ["fast"] },
    { pos: new THREE.Vector3(0, 0, -28), types: ["normal", "fast"] },
    { pos: new THREE.Vector3(-4, 0, -28), types: ["boss"] },
  ].map((sp) => Object.assign(sp, { cooldown: 0 }));

  // Interaction: a locked door blocking the side room (word-lock), and a laser trap in mid corridor
  const lockedDoor = addProp(5, -12.2, 0.3, 3, 3.2, new THREE.MeshLambertMaterial({ color: 0x995533 }));
  world.doors.push({ mesh: lockedDoor, locked: true, kind: "word", opened: false });
  world.interactables.push({ mesh: lockedDoor, kind: "door", ref: world.doors[world.doors.length - 1] });

  // A button that opens a shortcut / toggles a light, tucked in room 2
  const buttonMesh = addProp(-4.5, -18, 0.3, 0.3, 0.3, new THREE.MeshLambertMaterial({ color: 0xff4444 }));
  world.colliders.pop(); // buttons shouldn't block movement much; keep small so fine to leave collider, remove for simplicity
  world.buttons.push({ mesh: buttonMesh, pressed: false });
  world.interactables.push({ mesh: buttonMesh, kind: "button", ref: world.buttons[world.buttons.length - 1] });

  // A lootable crate (word-locked) in the secret room
  const crateMesh = addProp(11, -14, 0.8, 0.8, 0.8, new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
  world.crates.push({ mesh: crateMesh, opened: false, locked: true });
  world.interactables.push({ mesh: crateMesh, kind: "crate", ref: world.crates[world.crates.length - 1] });

  // A word-locked trap (laser wall) in the corridor to the final room
  const trapMesh = addProp(0, -21, 3.2, 2.6, 0.15, new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.55 }));
  world.traps.push({ mesh: trapMesh, active: true, damage: 12, cooldown: 0 });
  world.interactables.push({ mesh: trapMesh, kind: "trap", ref: world.traps[world.traps.length - 1] });

  world.secretZone = { center: new THREE.Vector3(11, 0, -14), radius: 3.5, unlocked: false };
  world.spawn = { x: 0, z: 2.5 };
  world.bossRoomCenter = new THREE.Vector3(0, 0, -28);

  return world;
};
