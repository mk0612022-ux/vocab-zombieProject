// ===================================================================
// The voxel kit's gallery (story series, round 3)
// -------------------------------------------------------------------
// The plan: show the user the chapter's look before it is used for the
// whole chapter. This is a walk-round preview, played as a hidden chapter of
// Story Mode ("kit": one scene, no words, nothing written to the save):
//   the north wall  every block face of the atlas, 16 x 5
//   people          the twelve of Chapter 1, standing, a few walking, one
//                   talking, one waving, their names at their feet
//   zombies         the seven who turn (their last words over them) and the
//                   everyday kinds: students, a Sprinter in PE kit, a Crawler, a
//                   Screamer -- the one nearest the crosshair has its LEXA patch lit
//   side by side    a campaign zombie next to a Chapter 1 one
//   a corridor      a stretch of the school as round 4 will build it: cream
//                   walls, windows, two classroom doors, lockers, the signs
//   a classroom     desks, the board, a fan, the lights
//   corners         the library, the nurse's room, the music room, the gym,
//                   the canteen, NeuroLex against the students' own work, and
//                   outdoors: the flagpole, the stage, the cars, the gate
// Opened from the Story tab with ?story=1&kit=1 in the address.
//
//   G.VoxelKit.on()          the address asks for it
//   G.VoxelKit.build(kit)    the place (js/world.js, a level with .kit)
//   G.VoxelKit.update(game, dt) / teardown()
// ===================================================================
window.G = window.G || {};

G.VoxelKit = (function () {
  const en = (k) => (G.STRINGS && G.STRINGS.en && G.STRINGS.en[k]) || k;
  function on() { return /[?&]kit=1(\b|$)/.test(location.search || ""); }
  let gal = null;

  // the hidden chapter (js/story/story.js: preview -- nothing kept)
  G.STORY_CHAPTERS = G.STORY_CHAPTERS || {};
  G.STORY_CHAPTERS.kit = {
    id: "kit", n: 0, title: "story.kit.title", map: "training", kit: true, preview: true, words: null,
    scenes: [{ id: "kit", title: "story.kit.scene", hud: ["word", "labels"], lens: false, clock: "10:00", start: { x: 0, z: 19, yaw: 0 }, beats: [{ do: [["objective", "story.kit.obj"]] }] }],
  };

  const X0 = -30, X1 = 30, Z0 = -24, Z1 = 24;
  function build(kit) {
    const { scene, world } = kit;
    const VP = G.VoxelProps, VC = G.VoxelChars;
    world.regions = []; world.waypointNodes = { KIT: { x: 0, z: 0, y: 0 } }; world.waypointEdges = { KIT: [] };
    world.wallWeapons = []; world.keys = []; world.roomNames = new Set(["KIT"]); world.roomInfo = {};
    world.spawnPoints = [];
    world.regions.push({ name: "KIT", y: 0, minX: X0, maxX: X1, minZ: Z0, maxZ: Z1 });
    world.heightZones.push({ minX: X0, maxX: X1, minZ: Z0, maxZ: Z1, height: 0 });
    world.spawn = { x: 0, z: 19 };
    world.bossRoomCenter = new THREE.Vector3(0, 0, -10);
    world.noMerge = world.noMerge || [];
    gal = { people: [], zombies: [], fans: [], props: [], made: performance.now() };
    // (what moves stays out of the level's merge: js/perf.js would bake its parts, and
    // its hidden hitboxes, into the walls)
    const keep = (o) => { world.noMerge.push(o); return o; };

    // ---------------- the shell: one grid of blocks ----------------
    const grid = new G.Voxel.Grid();
    grid.fill(X0, -1, Z0, X1 - 1, -1, Z1 - 1, "terrazzo");
    grid.fill(16, -1, -10, X1 - 1, -1, Z1 - 1, "grass");
    grid.fill(18, -1, 8, 29, -1, 16, "asphalt");
    for (let x = 18; x <= 29; x += 3) grid.fill(x, -1, 8, x, -1, 16, "asphaltLineZ");
    grid.fill(6, -1, -8, 14, -1, 4, "gymFloor");
    grid.fill(-22, -1, -10, -12, -1, 1, "tiles");
    grid.fill(-29, -1, -10, -24, -1, 10, "terrazzo");
    grid.fill(-6, -1, 5, 6, -1, 11, "paving");
    const wall = (x0, z0, x1, z1, y0, y1) => { for (let y = y0; y <= y1; y++) grid.fill(x0, y, z0, x1, y, z1, y === 0 ? "creamBase" : y === y1 ? "creamBand" : "cream"); };
    wall(X0 - 1, Z0 - 1, X1, Z0 - 1, 0, 2);                    // north
    wall(X0 - 1, Z1, X1, Z1, 0, 2);                            // south
    wall(X0 - 1, Z0, X0 - 1, Z1 - 1, 0, 2);                    // west
    wall(X1, Z0, X1, Z1 - 1, 0, 2);                            // east
    for (let y = 3; y <= 6; y++) grid.fill(-10, y, Z0 - 1, 9, y, Z0 - 1, y === 6 ? "creamBand" : "cream");     // behind the tile wall
    // the corridor: a window wall (west), a wall with two classroom doors (east), a ceiling
    for (let z = -10; z <= 10; z++) {
      grid.set(-29, 0, z, "creamBase"); grid.set(-29, 3, z, "creamBand");
      const win = ((z % 3) + 3) % 3 !== 0;
      grid.set(-29, 1, z, win ? "glass" : "cream"); grid.set(-29, 2, z, win ? "glass" : "cream");
      grid.set(-24, 0, z, "creamBase"); grid.set(-24, 1, z, "cream"); grid.set(-24, 2, z, "cream"); grid.set(-24, 3, z, "creamBand");
    }
    [-5, 4].forEach((z) => { grid.del(-24, 0, z); grid.del(-24, 1, z); });
    grid.fill(-29, 4, -10, -24, 4, 10, "ceiling");
    // the classroom: a back wall, a side wall, a ceiling; open to the gallery on two sides
    for (let y = 0; y <= 3; y++) { grid.fill(-22, y, -11, -12, y, -11, y === 0 ? "whiteDado" : "white"); grid.fill(-22, y, -10, -22, y, 1, y === 0 ? "whiteDado" : "white"); }
    [-6, -5, -2, -1].forEach((z) => grid.del(-22, 1, z));          // two window openings, 2 x 1 blocks
    grid.fill(-22, 4, -11, -12, 4, 1, "ceiling");
    const built = grid.build(scene, world, { floorY: 0 });
    gal.grid = grid; gal.built = built;

    // ---------------- the north wall: every tile ----------------
    G.VoxelTex.TILES.forEach((t, i) => {
      const col = i % 16, row = Math.floor(i / 16);
      const m = G.Voxel.box(t, 0.92, 0.92, 0.06);
      m.position.set(-7.5 + col, 5 - row, Z0 + 0.05);
      scene.add(m);
    });
    const plate = (lines, w, x, y, z, ry, o) => { const s = VP.sign(lines, w, o); s.position.set(x, y, z); if (ry) s.rotation.y = ry; scene.add(s); return s; };
    plate([en("story.kit.blocks")], 4, 0, 6.15, Z0 + 0.08, 0, { bg: 0x1f3a6b });

    // ---------------- people ----------------
    plate([en("story.kit.people")], 3, -13.75, 3.1, -17.4, 0, { bg: 0x1f3a6b });
    VC.CAST.forEach((id, i) => {
      const m = keep(VC.build(id));
      const x = -22 + i * 1.5;
      m.position.set(x, 0, -16);
      scene.add(m);
      const D = VC.DEFS[id];
      plate([en(D.who)], 1.25, x, 0.3, -15.2, 0, { bg: 0x2a2a2e, scale: 2, pxm: 150 });
      // a few of them moving (on the spot): walking, talking, waving
      const st = id === "beam" ? { wave: true } : id === "min" ? { talk: true } : id === "tonkla" || id === "nam" ? { speed: 1.3 } : {};
      gal.people.push({ model: m, st });
    });
    world.colliders.push(new THREE.Box3(new THREE.Vector3(-22.6, 0, -16.6), new THREE.Vector3(-4.9, 2, -15.4)));

    // ---------------- zombies ----------------
    plate([en("story.kit.zombies")], 3, 13.75, 3.1, -17.4, 0, { bg: 0x6a1f1f });
    const Z = [
      ["beam", "normal", "TOGETHER"], ["chai", "ironclad", "PROTECT"], ["somsak", "normal", "DISCIPLINE"], ["invig", "normal", ""], ["porn", "normal", "CLEAN"],
      ["pim", "normal", "REST"], ["ek", "fast", "FASTER"], ["zm1", "normal", ""], ["zf1", "normal", ""], ["zp1", "fast", ""], ["zm2", "crawler", ""], ["zf2", "screamer", ""],
    ];
    Z.forEach(([who, type, word], i) => {
      const x = 5.5 + i * 1.5;
      const look = VC.zombieLook(type, null, who);
      const z = new G.Zombie(type, new THREE.Vector3(x, 0, -16), [word || "-", ""], "training", { look });
      z.sprite.visible = !!word;
      scene.add(keep(z.mesh));
      const st = type === "fast" && who === "zp1" ? { run: 3.1 } : who === "zm1" ? { run: 1.2 } : type === "crawler" ? { run: 0.9 } : {};
      gal.zombies.push({ z, st, word });
    });
    world.colliders.push(new THREE.Box3(new THREE.Vector3(4.9, 0, -16.8), new THREE.Vector3(22.6, 2, -15.2)));

    // ---------------- side by side: the campaign's and Chapter 1's ----------------
    const camp = new G.Zombie("normal", new THREE.Vector3(-1.2, 0, 8), ["-", ""], "school", { look: G.randomZombieLook("normal", "school") });
    camp.sprite.visible = false;
    scene.add(keep(camp.mesh));
    const vox = new G.Zombie("normal", new THREE.Vector3(1.2, 0, 8), ["-", ""], "training", { look: VC.zombieLook("normal", null, "zm3") });
    vox.sprite.visible = false;
    scene.add(keep(vox.mesh));
    gal.zombies.push({ z: camp, st: {} }, { z: vox, st: {} });
    gal.compare = [camp, vox];
    plate([en("story.kit.campaign")], 1.4, -1.2, 0.3, 8.8, 0, { bg: 0x2a2a2e });
    plate([en("story.kit.chapter")], 1.4, 1.2, 0.3, 8.8, 0, { bg: 0x1f3a6b });
    world.colliders.push(new THREE.Box3(new THREE.Vector3(-1.8, 0, 7.6), new THREE.Vector3(1.8, 2, 8.4)));

    // ---------------- the corridor ----------------
    const P = (id, x, z, ry, o) => { gal.props.push(id); return VP.place(kit, id, x, z, ry, o); };
    const W = -Math.PI / 2, E = Math.PI / 2, S = Math.PI;
    P("door", -23.5, -4.5, W, { label: "301" });
    P("door", -23.5, 4.5, W, { label: "302" });
    P("locker", -24.25, 0.5, W, { n: 3 });
    P("fireExtinguisher", -24, -7.5, W);
    P("evacSign", -24, -2, W);
    P("exitSign", -26.5, -10, 0, { y: 1.0 });
    P("emergencyLight", -28, -6.5, E);
    P("emergencyLight", -28, 6.5, E);
    P("exhibitBoard", -24.4, 8, W);
    P("clock", -24, 2.5, W);
    P("papers", -26.5, -1.5, 0);
    P("schoolBag", -27.3, 3.2, 0.6);
    P("waterCooler", -27.7, 9.3, E);
    [-7, -1, 5].forEach((z) => P("lamp", -26.5, z, E, { y: 0.4 }));
    // ---------------- the classroom ----------------
    P("blackboard", -17, -10, 0);
    P("clock", -13, -10, 0);
    P("teacherDesk", -17, -8, S);
    [-20, -17, -14].forEach((x) => [-5.5, -3].forEach((z) => { P("desk", x, z, 0); P("chair", x, z + 0.55, S); }));
    P("fan", -17, -4.2, 0, { y: 0.4 });
    P("lamp", -20, -6, 0, { y: 0.4 }); P("lamp", -14, -6, 0, { y: 0.4 });
    P("window", -21.5, -5, E); P("window", -21.5, -1, E);
    // ---------------- the library, the nurse's room, the music room ----------------
    P("bookshelf", -19.5, 7.5, 0, { w: 4 });
    P("bookshelf", -19.5, 10.5, S, { w: 4 });
    P("nurseBed", -13, 9, 0);
    P("medCabinet", -10.5, 7, 0);
    P("piano", -20, 16, 0);
    P("drums", -16.5, 16, 0);
    // ---------------- NeuroLex and the students' own ----------------
    P("paConsole", -4.5, -2, 0);
    P("lexaStandee", -1.2, -3, 0);
    P("exhibitBoard", 3, -2.5, 0);
    P("examBox", 0.8, 0, 0);
    // ---------------- the gym and the canteen ----------------
    P("bleachers", 10, -4, 0, { w: 6 });
    P("vaultBox", 8, 0, 0);
    P("canteenTable", 11, 4, 0);
    P("supplyBoxes", 13, 7.5, 0);
    P("waterCooler", 7, 7.5, 0);
    P("trashBin", 9, 8, 0);
    // ---------------- outdoors ----------------
    P("stage", 23, -6, 0);
    P("podium", 23, -6.2, 0, { y: 1 });
    P("flagpole", 23, 2, 0);
    P("policeCar", 20.5, 12, 0);
    P("schoolVan", 26, 12, 0);
    P("guardBooth", 27, 20.5, 0);
    P("gate", 21, 23.4, S);
    P("tree", 17.5, 19, 0); P("tree", 28, -8, 0); P("tree", 17.5, -2, 0);
    P("bench", 19, 4.5, E);
    P("cone", 24, 7.5, 0); P("cone", 25, 7.5, 0);
    P("trashBin", 28.5, 5, 0);
    scene.traverse((o) => { if (o.userData && o.userData.spin) gal.fans.push(o.userData.spin); });
    // lights: the corridor's and the classroom's (the light pool takes the nearest)
    [[-26.5, -6], [-26.5, 5], [-17, -5]].forEach(([x, z]) => kit.addLight(x, 3.4, z, 0xfff2dc, 1.1, 0));
    gal.ms = Math.round(performance.now() - gal.made);
    return gal;
  }

  // ---------------- each frame ----------------
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), cam = new THREE.Vector3();
  function update(game, dt) {
    if (!gal) return;
    gal.people.forEach((p) => G.VoxelChars.animate(p.model, dt, p.st));
    gal.zombies.forEach((e) => e.z.animate(dt, e.st.run ? e.st.run * dt : 0));
    gal.fans.forEach((f) => { f.rotation.y += dt * 4; });
    // (their words are drawn over everything: only the ones near enough to read, so
    // none shows through the corridor's walls)
    if (game.camera) {
      game.camera.getWorldPosition(cam);
      gal.zombies.forEach((e) => { if (e.z.sprite && e.word) e.z.sprite.visible = e.z.mesh.position.distanceTo(cam) < 16; });
    }
    // the LexiLens locking on: the zombie nearest the crosshair (within ~12 degrees)
    if (game.camera) {
      game.camera.getWorldPosition(cam); game.camera.getWorldDirection(fwd);
      let best = null, bd = 0.978;
      gal.zombies.forEach((e) => {
        tmp.copy(e.z.mesh.position); tmp.y += 1.4;
        const d = tmp.sub(cam).normalize().dot(fwd);
        if (d > bd) { bd = d; best = e.z; }
      });
      gal.zombies.forEach((e) => G.VoxelChars.setLock(e.z.mesh, e.z === best));
      gal.locked = best;
    }
  }
  function teardown() { gal = null; }

  return { on, build, update, teardown, get gallery() { return gal; } };
})();
