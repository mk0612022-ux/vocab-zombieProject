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
  function addFlickerLight(x, y, z, color) {
    const l = new THREE.PointLight(color || pal.light, 1.2, 12);
    l.position.set(x, y, z);
    scene.add(l);
    world.lights.push(l);
    return l;
  }
  // A box with a simple canvas-drawn texture on its +Z face only (chalkboard
  // scribbles, scoreboards, monitor screens, control-panel readouts, etc).
  // Purely decorative -- never added to world.colliders by itself.
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
  if (level.theme === "school") {
    decorateSchool();
  } else {
    addProp(-2, 2, 1.4, 0.9, 0.7, accentMat);
    addProp(2, 3, 1.4, 0.9, 0.7, accentMat);
    addProp(-3, -14, 1.2, 1, 2, accentMat);
    addProp(3, -12, 1.2, 1, 2, accentMat);
    addProp(0, -28, 2, 1.2, 2, accentMat);
  }

  // ---------------- Theme decorators ----------------
  // Landmarks (school): (1) the chalkboard classroom at room 1, (2) the locker
  // hallway at room 2, (3) the library nook with the striped bookshelf at room 3
  // (the secret side room), (4) the gym scoreboard wall at the final room.
  function decorateSchool() {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    const lockerBlue = new THREE.MeshLambertMaterial({ color: 0x2f6fb0 });
    const lockerBlueDark = new THREE.MeshLambertMaterial({ color: 0x1f4d80 });
    const paperMat = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 });

    // Landmark 1: chalkboard + upright/overturned desks in the start classroom
    addCanvasBox(-1, 2.1, -3.85, 3.2, 1.5, 0.12, (ctx, cv) => {
      ctx.fillStyle = "#1c3b2e"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#eaf2ea"; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(120, 20); ctx.lineTo(90, 70); ctx.stroke();
      ctx.font = "italic 26px Georgia"; ctx.fillStyle = "#eaf2ea"; ctx.globalAlpha = 0.5;
      ctx.fillText("A B C ...", 140, 40); ctx.fillText("help us", 30, 95);
    }, 0x3a2a1a);
    addProp(-2, 2, 1.4, 0.9, 0.7, woodMat); // upright desk
    addProp(1.6, 2.6, 1.4, 0.7, 0.7, woodMat, 0, 0, Math.PI / 2.1); // desk tipped on its side
    addProp(2.6, 1.6, 0.45, 0.75, 0.45, woodDarkMat, 0, Math.PI / 2.4, 0); // toppled chair
    addProp(-3.2, -0.6, 0.45, 0.75, 0.45, woodDarkMat); // upright chair

    // Exit signs (glow, no collider) near the corridor mouths. Mounted just
    // inside the wall's interior face (not centered on it) so they actually
    // poke into the room instead of rendering hidden inside the wall mesh.
    addGlowBox(-1.8, 2.9, -3.7, 0.6, 0.28, 0.05, 0x33ff66);
    addGlowBox(1.5, 2.9, 3.7, 0.5, 0.25, 0.05, 0xff3333, Math.PI);

    // Scattered papers/books on the floor
    addDecal(-1.1, 0.4, 0.3, 0.02, 0.4, paperMat, 0.4);
    addDecal(-0.6, 0.9, 0.28, 0.02, 0.36, paperMat, -0.6);
    addDecal(0.4, -1.2, 0.3, 0.02, 0.4, paperMat, 1.1);
    addDecal(-1.6, -18.5, 0.3, 0.02, 0.4, paperMat, 0.2);
    addDecal(0.5, 5, 0.3, 0.02, 0.4, paperMat, -0.3);

    // Landmark 2: locker row lining the mid-room hallway (room 2 west wall).
    // Locker bodies stay flush/closed; the "ajar" one gets its own hinged door
    // panel (a pivot group rotated at the hinge edge) rather than tilting the
    // whole locker body, which read as just a crooked box rather than a door.
    for (let i = 0; i < 5; i++) {
      const lz = -18.5 + i * 1.05;
      addProp(-4.75, lz, 0.5, 2.2, 0.85, i % 2 === 0 ? lockerBlue : lockerBlueDark);
    }
    const doorPivot = new THREE.Group();
    const openLockerZ = -18.5 + 2 * 1.05;
    doorPivot.position.set(-4.5, 1.1, openLockerZ - 0.42);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.0, 0.04), lockerBlueDark);
    doorMesh.position.set(0.21, 0, 0); // offsets the panel so it swings from the hinge edge, not its own center
    doorPivot.add(doorMesh);
    doorPivot.rotation.y = -1.1;
    scene.add(doorPivot);
    world.colliders.push(new THREE.Box3().setFromObject(doorPivot));
    // Small floating marker above the shortcut button (kept off the locker
    // wall entirely so it can't end up embedded inside a locker's hitbox).
    addGlowBox(-4.5, 2.2, -9.5, 0.4, 0.2, 0.4, 0x33ff66);

    // Landmark 3: library nook -- striped bookshelf marks the secret side room.
    // Colorful book spines sit on 3 shelf rows, mounted on the shelf's front
    // face (x=12.38, just proud of the frame at x=12.4) so they read clearly
    // instead of blending into the wood -- purely decorative, no collider.
    addProp(12.6, -14, 0.4, 2.4, 2.4, woodDarkMat); // bookshelf frame
    const stripeColors = [0xd94f4f, 0x4f8fd9, 0xe0c23c, 0x4fd97a, 0xb04fd9];
    const shelfRowY = [0.55, 1.2, 1.85];
    shelfRowY.forEach((y, row) => {
      for (let i = 0; i < 8; i++) {
        const z = -14.9 + i * 0.2;
        const mat = new THREE.MeshLambertMaterial({ color: stripeColors[(i + row) % stripeColors.length] });
        addFloatBox(12.38, y, z, 0.06, 0.5, 0.15, mat);
      }
    });

    // Landmark 4: gym-style scoreboard on the far wall of the finale room
    addCanvasBox(0, 2.6, -33.85, 2.4, 1.1, 0.12, (ctx, cv) => {
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center";
      ctx.font = "bold 20px monospace"; ctx.fillStyle = "#ffcc55";
      ctx.fillText("HOME", 64, 30); ctx.fillText("AWAY", 192, 30);
      ctx.font = "bold 52px monospace"; ctx.fillStyle = "#ff3b3b";
      ctx.fillText("00 : 00", 128, 92);
    }, 0x1a1a1a);
  }

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

  // A button that opens a shortcut / toggles a light, tucked in room 2.
  // Kept clear of the school locker row (z -18.5..-14.3 at x=-4.75) so new
  // decoration never overlaps an existing interactable's hitbox.
  const buttonMesh = addProp(-4.5, -9.5, 0.3, 0.3, 0.3, new THREE.MeshLambertMaterial({ color: 0xff4444 }), 0, 0, 0, true);
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
