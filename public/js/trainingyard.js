// ===================================================================
// The Training Yard (expansion, round 7)
// -------------------------------------------------------------------
// A small place built from the school's pieces -- a yard out front, one
// stretch of corridor, one classroom -- on a calm morning, and eleven steps
// played one after another, each only once the last is done:
//    1 look       look round and walk onto the ring
//    2 sprint     run to the next one (the stamina bar)
//    3 shoot      straw dummies carrying words: the one whose word the box
//                 at the top means (a wrong one: the card that explains it)
//    4 aim        aim down the sights, reload
//    5 switch     to the shotgun and back (number keys, the wheel, LB / RB, a
//                 slot tapped) and the knife on a dummy
//    6 money      money on the way in, the gun on the corridor wall bought
//    7 doors      a door opened (E), a word door answered
//    8 hud        a tour of the HUD: health, stamina, the slots, the panel on
//                 the right, the wave bar
//    9 wave       a drill: five Shamblers and a Crawler
//   10 quiz       three questions, then the shop and a perk
//   11 cards      the Word Forge, what learning unlocks, Daily Review, the
//                 word log, reporting a bug or a word
// Stuck on a step for G.CONFIG.training.hintAfter seconds: a clearer hint, and
// what to use lit up. Every step is a checkpoint (G.save.training.step): left
// half-way, the yard starts again there. The words are a fixed easy set in
// the player's Word Language (js/data/practicewords.js) and nothing played
// here is counted -- no box, no statistics (practice(), read by js/srs.js,
// js/core.js and js/explain.js). Nothing ends a run here: a blow that would
// kill leaves a little health.
//
// What the instructions show follows the last thing used -- keys and the
// mouse, a controller or the touch screen -- and on a touch screen the
// button to press is lit. Reduce Motion stills the glow and the ring; the
// text is in rem, so the Text Size setting carries to it.
//
// Offered once, after the first setup (the brightness, the languages):
// "Play the tutorial" / "Skip"; played again from Help, the lobby's Training
// tab or Settings > Tips; skipped from the pause menu at any time.
//
//   G.TrainingYard.open()            from a menu: continue or start over
//   G.TrainingYard.maybeOffer()      the first-time offer (js/mainmenu.js)
//   G.TrainingYard.build(kit)        the place (js/world.js, theme "training")
//   G.TrainingYard.beginRun(game, i) / update(game, dt) / teardown(game)
//   G.TrainingYard.practice()        a practice run: nothing is to be counted
// ===================================================================
window.G = window.G || {};

G.TrainingYard = (function () {
  const C = () => G.CONFIG.training;
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const $ = (id) => document.getElementById(id);
  const on = () => !!(G.CONFIG.expansion && G.CONFIG.expansion.trainingYard);

  const STEPS = ["look", "sprint", "shoot", "aim", "switch", "money", "doors", "hud", "wave", "quiz", "cards"];

  // ---------------- the save ----------------
  // G.save.training = { done, skipped, step (the checkpoint), offered, finishedAt }
  function data() {
    if (!G.save.training || typeof G.save.training !== "object") G.save.training = { done: false, skipped: false, step: 0, offered: false, finishedAt: 0 };
    return G.save.training;
  }
  // a practice run: nothing answered is counted (js/srs.js, js/core.js, js/explain.js)
  function practice() { return !!(G.Game && G.Game.mode === "training"); }

  // ---------------- the words ----------------
  // the practice set as pairs in the Word and Meaning Language; no entry id,
  // so the key is the word itself (G.wordKey)
  function pairs() {
    const wl = G.Lang.word(), ml = G.Lang.meaning();
    return (G.PRACTICE_WORDS || []).map((e) => {
      const p = [String(e[wl] || e.en), String(e[ml] || e.th)];
      p.wl = wl; p.ml = ml; p.practice = true;
      if (wl === "zh") p.pyW = e.py || "";
      if (ml === "zh") p.pyM = e.py || "";
      return p;
    });
  }
  function level() {
    return { id: "training", theme: "training", icon: "🎯", waves: 1, difficulty: 0.6, spawnBaseInterval: 99, maxAliveZombies: 8, wordsKey: null, name: T("train.title") };
  }

  // ---------------- the place ----------------
  // forward is -z. The yard out front (spawn at its south end), the corridor
  // north of it -- open to the yard -- with the gun on its west wall, the
  // classroom east of the corridor through a door, and from the classroom a
  // word door out to the yard's north-east corner.
  const MAP = {
    yard: { x0: -15, x1: 15, z0: 4, z1: 36 },
    yard2: { x0: 3, x1: 15, z0: -4, z1: 4 },
    corr: { x0: -3, x1: 3, z0: -16, z1: 4 },
    room: { x0: 3, x1: 15, z0: -16, z1: -4 },
    spawn: { x: 0, z: 32 },
    ring1: { x: 0, z: 25 },
    ring2: { x: 0, z: 11 },
    dummies: [{ x: 10.5, z: 7 }, { x: 11.5, z: 11 }, { x: 10.5, z: 15 }],
    meleeDummy: { x: 2.2, z: 13.2 },
    money: [{ x: 0, z: 8.5 }, { x: 0.6, z: 6 }, { x: -0.4, z: 3.2 }, { x: 0.4, z: 0.4 }, { x: 0, z: -2.2 }],
    wallGun: { x: -3, z: -3.5 },
    roomDoor: { x: 3, z: -10, w: 1.8 },
    wordDoor: { x: 11, z: -4, w: 2.2 },
    wave: [{ x: -10, z: 33 }, { x: -5, z: 34.5 }, { x: 0, z: 35 }, { x: 5, z: 34.5 }, { x: 10, z: 33 }, { x: 2, z: 32 }],
  };
  // where each step starts, when the yard is picked up again there
  const START = [
    { x: 0, z: 32, yaw: 0 }, { x: 0, z: 25, yaw: 0 }, { x: 0, z: 11, yaw: -Math.PI / 2 }, { x: 0, z: 11, yaw: -Math.PI / 2 },
    { x: 0, z: 11, yaw: -Math.PI / 2 }, { x: 0, z: 10, yaw: 0 }, { x: 0, z: -6, yaw: 0 }, { x: 9, z: -7, yaw: Math.PI },
    { x: 11, z: 2, yaw: Math.PI }, { x: 0, z: 20, yaw: Math.PI }, { x: 0, z: 20, yaw: Math.PI },
  ];

  // a grass texture of its own: green, a little uneven, tufts
  function grassTex() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const c = cv.getContext("2d"), rng = G.makeRng(712);
    c.fillStyle = "#5f8a3e"; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 420; i++) {
      const g = 0.75 + rng() * 0.45;
      c.fillStyle = `rgb(${Math.round(80 * g)},${Math.round(130 * g)},${Math.round(56 * g)})`;
      c.fillRect(rng() * 128, rng() * 128, 1 + rng() * 2, 2 + rng() * 4);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function build(kit) {
    const { scene, world } = kit;
    const M = kit.M;
    const Lam = (hex) => new THREE.MeshLambertMaterial({ color: hex });
    world.regions = []; world.waypointNodes = {}; world.waypointEdges = {};
    world.wallWeapons = []; world.keys = []; world.roomNames = new Set(["ROOM"]); world.roomInfo = {};
    world.spawnPoints = [];
    const region = (name, r) => {
      world.regions.push({ name, y: 0, minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1 });
      world.heightZones.push({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, height: 0 });
      world.waypointNodes[name] = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: 0 };
      world.waypointEdges[name] = world.waypointEdges[name] || [];
    };
    const node = (name, x, z) => { world.waypointNodes[name] = { x, z, y: 0 }; world.waypointEdges[name] = world.waypointEdges[name] || []; };
    const link = (a, b) => { world.waypointEdges[a].push(b); world.waypointEdges[b].push(a); };
    region("YARD", MAP.yard); region("YARD2", MAP.yard2); region("CORR", MAP.corr); region("ROOM", MAP.room);
    node("DENT", 0, 4); node("DROOM", MAP.roomDoor.x, MAP.roomDoor.z); node("DWORD", MAP.wordDoor.x, MAP.wordDoor.z);
    link("YARD", "YARD2"); link("YARD", "DENT"); link("DENT", "CORR"); link("CORR", "DROOM"); link("DROOM", "ROOM"); link("ROOM", "DWORD"); link("DWORD", "YARD2");

    // ---- the ground: grass all round, a paved path to the door ----
    const gt = grassTex(); gt.repeat.set(22, 22);
    // (2 cm under the rooms' floors, or the two would fight where they meet)
    const grass = new THREE.Mesh(new THREE.BoxGeometry(110, 0.4, 110), new THREE.MeshLambertMaterial({ map: gt }));
    grass.position.set(0, -0.22, 10);
    scene.add(grass);
    const pave = Lam(0x9a968c);
    kit.addFloatBox(0, 0.01, 18, 4, 0.02, 28, pave);
    kit.addFloatBox(9, 0.01, 0, 12, 0.02, 7.6, pave);
    // ---- inside: floors and ceilings ----
    kit.addFloor(0, -6, 6, 20, 0, "tileWhite");
    kit.addFloor(9, -10, 12, 12, 0, "wood");
    kit.addCeiling(0, -6, 6, 20, 0);
    kit.addCeiling(9, -10, 12, 12, 0);
    // ---- walls (4.2 high, as the school's) ----
    const WH = 4.2;
    kit.addWallSeg(-3, -6, 0.4, 20.4, WH, 0);                                                // corridor, west
    kit.addWallWithGaps(3, -6, 20.4, 0.4, [{ center: MAP.roomDoor.z, width: MAP.roomDoor.w }], "z", WH, 0);   // corridor, east (the classroom's door)
    kit.addWallSeg(0, -16, 6.4, 0.4, WH, 0);                                                 // corridor, north
    kit.addWallSeg(15, -10, 0.4, 12.4, WH, 0);                                               // classroom, east
    kit.addWallSeg(9, -16, 12.4, 0.4, WH, 0);                                                // classroom, north
    kit.addWallWithGaps(-4, 9, 12.4, 0.4, [{ center: MAP.wordDoor.x, width: MAP.wordDoor.w }], "x", WH, 0);    // classroom, south (the word door)
    // a beam over the open end of the corridor, the school's brick along the
    // foot of the outside walls, a cap on the roofs, and windows (both faces)
    const brick = Lam(0x8a3a2e), cap = Lam(0x5e5248), frame = Lam(0xf0ece2), glassOut = Lam(0x3a5068), glassIn = Lam(0x9cc4e0);
    kit.addFloatBox(0, 3.9, 4, 6.4, 0.6, 0.4, brick);
    kit.addFloatBox(-3.26, 0.3, -6, 0.12, 0.6, 20.4, brick);
    kit.addFloatBox(15.26, 0.3, -10, 0.12, 0.6, 12.4, brick);
    kit.addFloatBox(6, 0.3, -16.26, 18.4, 0.6, 0.12, brick);
    kit.addFloatBox(3.26, 0.3, 0, 0.12, 0.6, 8, brick);
    kit.addFloatBox(6.4, 0.3, -3.74, 7, 0.6, 0.12, brick);
    kit.addFloatBox(13.55, 0.3, -3.74, 2.9, 0.6, 0.12, brick);
    kit.addFloatBox(0, 4.3, -6, 6.8, 0.2, 20.8, cap);
    kit.addFloatBox(9, 4.3, -10, 12.8, 0.2, 12.8, cap);
    const win = (x, z, alongX) => {
      [[-1, glassIn], [1, glassOut]].forEach(([s, glass]) => {
        const off = s * 0.23;
        if (alongX) { kit.addFloatBox(x, 2.0, z + off, 1.7, 1.3, 0.04, frame); kit.addFloatBox(x, 2.0, z + off + s * 0.01, 1.5, 1.1, 0.04, glass); }
        else { kit.addFloatBox(x + off, 2.0, z, 0.04, 1.3, 1.7, frame); kit.addFloatBox(x + off + s * 0.01, 2.0, z, 0.04, 1.1, 1.5, glass); }
      });
    };
    win(5.6, -4, true); win(8.2, -4, true);
    win(15, -13, false); win(15, -7.5, false);
    // ---- the doors ----
    const rd = kit.addRoomDoor(MAP.roomDoor.x, MAP.roomDoor.z, MAP.roomDoor.w, "z", 0);
    world.trainRoomDoor = rd;
    const wd = MAP.wordDoor;
    const lockedDoor = kit.addProp(wd.x, wd.z, wd.w, 2.9, 0.3, Lam(0xb2452f));
    const wdc = world.colliders[world.colliders.length - 1];
    // the wall over it, and the amber strip of a word lock on both faces
    kit.addWallSeg(wd.x, wd.z, wd.w, 0.4, WH - 2.95, 2.95);
    kit.addGlowBox(wd.x, 3.1, wd.z - 0.22, wd.w + 0.1, 0.1, 0.05, 0xffcc33);
    kit.addGlowBox(wd.x, 3.1, wd.z + 0.22, wd.w + 0.1, 0.1, 0.05, 0xffcc33);
    wdc.dynamic = true;
    const wordDoor = { mesh: lockedDoor, locked: true, kind: "word", opened: false, collider: wdc };
    world.doors.push(wordDoor);
    world.interactables.push({ mesh: lockedDoor, kind: "door", ref: wordDoor });
    world.trainWordDoor = wordDoor;
    // ---- the gun on the corridor wall (as world.js mounts one) ----
    mountGun(kit, C().wallGun, MAP.wallGun.x + 0.26, 0, MAP.wallGun.z);
    // ---- the yard's fence: posts and two rails, knee to waist high ----
    const wood = Lam(0x7a5232), dark = Lam(0x4a3220);
    // (what stops a body is a box of its own, as tall as the fence: rails and posts are only looks)
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      world.colliders.push(new THREE.Box3(new THREE.Vector3(Math.min(x0, x1) - 0.1, 0, Math.min(z0, z1) - 0.1), new THREE.Vector3(Math.max(x0, x1) + 0.1, 1.25, Math.max(z0, z1) + 0.1)));
      kit.addFloatBox(cx, 1.0, cz, alongX ? len : 0.1, 0.12, alongX ? 0.1 : len, wood);
      kit.addFloatBox(cx, 0.5, cz, alongX ? len : 0.1, 0.1, alongX ? 0.1 : len, wood);
      for (let s = 0; s <= len; s += 2.5) {
        const k = len ? s / len : 0;
        kit.addFloatBox(x0 + (x1 - x0) * k, 0.6, z0 + (z1 - z0) * k, 0.16, 1.2, 0.16, dark);
      }
    };
    fence(-15, 4, -15, 36); fence(-15, 36, 15, 36); fence(15, -4, 15, 36); fence(-15, 4, -3.2, 4);
    // ---- trees beyond the fence (a trunk and two blocks of leaves) ----
    const trunk = Lam(0x5a3a20), leaf = [Lam(0x4f7a32), Lam(0x5d8a3a), Lam(0x46702c)];
    [[-20, 8], [-22, 20], [-19, 31], [-8, 41], [6, 42], [19, 39], [21, 24], [20, 8], [19, -10], [-8, -22], [9, -22], [-10, -6]].forEach(([x, z], i) => {
      kit.addFloatBox(x, 1.6, z, 0.5, 3.2, 0.5, trunk);
      kit.addFloatBox(x, 3.9, z, 3.2, 1.8, 3.2, leaf[i % 3]);
      kit.addFloatBox(x + 0.2, 5.1, z - 0.1, 2.2, 1.2, 2.2, leaf[(i + 1) % 3]);
    });
    // ---- the range: hay bales behind the dummies, a white firing line ----
    const hay = Lam(0xc9a95a);
    [5, 9, 13, 17].forEach((z) => kit.addProp(13.6, z, 1.2, 0.9, 1.6, hay));
    kit.addFloatBox(4.5, 0.015, 11, 0.12, 0.01, 12, Lam(0xf2f2ea));
    // ---- the sign by the gate: the yard's name in the game's language ----
    kit.addProp(-3.2, 33, 0.12, 2.2, 0.12, dark, 0, 0, 0, true);
    kit.addCanvasBox(-3.2, 2.1, 33, 1.8, 0.6, 0.08, (ctx, cv) => {
      ctx.fillStyle = "#2a3a28"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#e8e2c8"; ctx.lineWidth = 5; ctx.strokeRect(6, 6, cv.width - 12, cv.height - 12);
      ctx.fillStyle = "#f4efd8"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      G.fitFont(ctx, T("train.title"), 40, cv.width - 30); ctx.fillText(T("train.title"), cv.width / 2, cv.height / 2 + 2);
    }, 0x3a2a1a, Math.PI / 2);
    // ---- the classroom: desks in rows, the teacher's desk, a board ----
    const desk = (x, z) => {
      kit.addProp(x, z, 1.1, 0.74, 0.62, M.wood || wood);
      kit.addFloatBox(x, 0.47, z + 0.55, 0.42, 0.06, 0.42, M.woodDark || dark);
      kit.addFloatBox(x, 0.75, z + 0.76, 0.42, 0.5, 0.05, M.woodDark || dark);
    };
    [-13.2, -11.2].forEach((z) => [6.2, 9, 11.8].forEach((x) => desk(x, z)));
    kit.addProp(13.6, -7.5, 1.6, 0.8, 0.8, M.woodDark || dark);
    kit.addCanvasBox(9, 1.7, -15.72, 4.2, 1.3, 0.06, (ctx, cv) => {
      ctx.fillStyle = "#24443a"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#e8efe6"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      G.fitFont(ctx, T("train.board"), 30, cv.width - 24); ctx.fillText(T("train.board"), cv.width / 2, cv.height / 2);
    }, 0x6b4a2f);
    // a notice board and two lockers in the corridor
    kit.addCanvasBox(-2.76, 1.6, -9, 1.6, 1.0, 0.06, (ctx, cv) => {
      ctx.fillStyle = "#b8945a"; ctx.fillRect(0, 0, cv.width, cv.height);
      const n = ["#f4f0d8", "#d8e8f4", "#f4d8d8", "#e0f4d8"];
      for (let i = 0; i < 6; i++) { ctx.fillStyle = n[i % 4]; ctx.fillRect(14 + (i % 3) * 80, 14 + Math.floor(i / 3) * 56, 66, 44); }
    }, 0x6b4a2f, Math.PI / 2);
    const lockerMat = Lam(0x6f93b3);
    kit.addProp(2.55, 1.5, 0.5, 2.2, 0.9, lockerMat);
    kit.addProp(2.55, 0.5, 0.5, 2.2, 0.9, lockerMat);
    // ---- light: the morning sun, a pale sky, and the rooms' lamps ----
    const sun = new THREE.DirectionalLight(0xfff0d6, 0.62);
    sun.position.set(30, 40, 45);
    sun.target.position.set(0, 0, 4);
    scene.add(sun); scene.add(sun.target);
    world.sun = sun;
    const dome = sky();
    scene.add(dome);
    (world.noMerge = world.noMerge || []).push(dome);
    kit.addLight(0, 3.1, -1, 0xfff4e2, 0.6, 0);
    kit.addLight(0, 3.1, -11, 0xfff4e2, 0.6, 0);
    kit.addLight(9, 3.1, -10, 0xfff4e2, 0.75, 0);
    // ---- where the drill comes from ----
    MAP.wave.forEach((p, i) => world.spawnPoints.push({ pos: new THREE.Vector3(p.x, 0, p.z), types: i === 5 ? ["crawler"] : ["normal"], cooldown: 0 }));
    world.spawn = { x: MAP.spawn.x, z: MAP.spawn.z };
    world.bossRoomCenter = new THREE.Vector3(0, 0, 20);
    kit.buildSlidingDoors();
  }
  // a pale morning sky: a dome with the light blue up high, warm by the horizon
  function sky() {
    const geo = new THREE.SphereGeometry(160, 24, 12);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0x8fb8e0), hor = new THREE.Color(0xf4e2c4), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const k = Math.max(0, Math.min(1, pos.getY(i) / 120));
      c.copy(hor).lerp(top, Math.pow(k, 0.6));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.position.set(0, -20, 10);
    m.renderOrder = -10;
    m.frustumCulled = false;
    m.userData.noMerge = true;
    return m;
  }
  // the gun on the wall: plaque, the gun, the price card (as js/world.js mountWallGun)
  function mountGun(kit, id, mx, y, mz) {
    const wdef = G.WEAPON_DEFS[id];
    if (!wdef) return;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 2.0), new THREE.MeshLambertMaterial({ color: 0x141414 }));
    plaque.position.set(mx, y + 1.85, mz);
    kit.scene.add(plaque);
    const gunMesh = G.buildWeaponMesh(wdef, { still: true });
    gunMesh.scale.set(3.0, 3.0, 3.0);
    gunMesh.position.set(mx + 0.3, y + 2.0, mz);
    kit.scene.add(gunMesh);
    kit.addCanvasBox(mx + 0.08, y + 1.0, mz, 1.5, 0.42, 0.05, (ctx, cv) => {
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = "center";
      G.fitFont(ctx, wdef.name, 20, 240); ctx.fillStyle = "#ffd43b"; ctx.fillText(wdef.name, 128, 28);
      ctx.font = "bold 24px monospace"; ctx.fillStyle = "#6bff7a"; ctx.fillText("$" + wdef.price, 128, 62);
      const wc = G.weightClass(wdef), wt = T("world.wallWeight", { w: wc.label });
      G.fitFont(ctx, wt, 17, 240); ctx.fillStyle = wc.color; ctx.fillText(wt, 128, 92);
    }, 0x1a1a1a, Math.PI / 2);
    const ref = { id, price: wdef.price, purchased: false, gunMesh };
    kit.world.wallWeapons.push(ref);
    kit.world.interactables.push({ mesh: plaque, kind: "wallweapon", ref });
  }

  // the straw dummy on its post (G.ZOMBIE_TYPES.dummy, built by G.buildZombieMesh):
  // the hitboxes, the head, the top for its word, as a zombie has them
  function dummyMesh() {
    const g = new THREE.Group();
    const Lam = (hex) => new THREE.MeshLambertMaterial({ color: hex });
    const post = Lam(0x5a3a20), straw = Lam(0xc8a96a), sack = Lam(0xb89660), red = Lam(0xc8322a), white = Lam(0xf2eee2);
    const box = (parent, w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    box(g, 0.7, 0.08, 0.14, 0, 0.04, 0, post); box(g, 0.14, 0.08, 0.7, 0, 0.04, 0, post);
    box(g, 0.12, 1.1, 0.12, 0, 0.55, 0, post);
    const body = new THREE.Group(); body.position.set(0, 1.08, 0); g.add(body);
    box(body, 0.56, 0.74, 0.34, 0, 0.37, 0, straw);
    box(body, 0.9, 0.07, 0.07, 0, 0.6, 0, post);
    box(body, 0.3, 0.3, 0.02, 0, 0.36, 0.175, white);
    box(body, 0.2, 0.2, 0.025, 0, 0.36, 0.18, red);
    box(body, 0.08, 0.08, 0.03, 0, 0.36, 0.185, white);
    const neck = new THREE.Group(); neck.position.set(0, 1.86, 0); g.add(neck);
    box(neck, 0.32, 0.32, 0.3, 0, 0.16, 0, sack);
    box(neck, 0.34, 0.05, 0.32, 0, 0.02, 0, post);
    const hbs = [
      { parent: neck, w: 0.32, h: 0.32, d: 0.3, x: 0, y: 0.16, z: 0, part: "head" },
      { parent: body, w: 0.56, h: 0.74, d: 0.34, x: 0, y: 0.37, z: 0, part: "body" },
      { parent: g, w: 0.16, h: 1.08, d: 0.16, x: 0, y: 0.54, z: 0, part: "leg" },
    ];
    g.userData.kind = "dummy";
    g.userData.look = {};
    g.userData.neck = neck;
    neck.userData.isNeck = true;
    g.userData.top = 2.2;
    g.userData.hitboxes = G.Aim ? G.Aim.makeHitboxes(hbs) : [];
    g.rotation.order = "YXZ";
    g.traverse((o) => { if (o.isMesh && !o.userData.hit) { o.castShadow = true; o.receiveShadow = false; } });
    return g;
  }

  // ---------------- the run ----------------
  let run = null;
  const dev = () => (G.Input.padActive ? "pad" : G.Input.mode === "touch" ? "touch" : "kb");
  const kb = () => G.save.settings.keybinds;
  const kbd = (code) => `<kbd>${esc(G.keyLabel(code))}</kbd>`;
  const pad = (b) => `<kbd class="tpad">${esc(b)}</kbd>`;
  const tch = (k) => `<b class="ttouch">${esc(T(k))}</b>`;
  // several keys in one group never break across lines (W A S D, 1 2 3, LB / RB)
  const keys = (html) => `<span class="htr-nw">${html}</span>`;
  // what to press, as the device in use shows it (HTML)
  function glyph(action) {
    const d = dev(), K = kb();
    if (d === "pad") {
      return { move: esc(T("train.dev.padMove")), look: esc(T("train.dev.padLook")), sprint: pad("L3"), fire: pad("RT"), aim: pad("LT"), reload: pad("X"),
        use: pad("Y"), melee: pad("B"), switch: keys(pad("LB") + " / " + pad("RB")), pause: pad("Menu"), jump: pad("A") }[action] || "";
    }
    if (d === "touch") {
      return { move: esc(T("train.dev.joy")), look: esc(T("train.dev.swipe")), sprint: tch("touch.sprintLabel"), fire: tch("touch.fireLabel"), aim: tch("touch.aimLabel"),
        reload: tch("touch.reloadLabel"), use: tch("touch.interactLabel"), melee: tch("touch.meleeLabel"), switch: esc(T("train.dev.tapSlot")), pause: tch("touch.pauseLabel"), jump: tch("touch.jumpLabel") }[action] || "";
    }
    return { move: keys(kbd(K.forward) + kbd(K.left) + kbd(K.back) + kbd(K.right)), look: esc(T("train.dev.mouse")), sprint: kbd(K.sprint), fire: `<kbd>${esc(T("train.dev.lmb"))}</kbd>`,
      aim: `<kbd>${esc(T("train.dev.rmb"))}</kbd>`, reload: kbd(K.reload), use: kbd(K.interact), melee: kbd(K.quickMelee || K.melee),
      // (the knife is key 1 = keybinds.melee, the pistol slot2, the shotgun given in step 5 slot3)
      switch: keys(kbd(K.melee) + kbd(K.slot2) + kbd(K.slot3)) + " " + esc(T("train.dev.wheel")), pause: kbd(K.pause), jump: kbd(K.jump) }[action] || "";
  }
  const ACTIONS = ["move", "look", "sprint", "fire", "aim", "reload", "use", "melee", "switch", "pause", "jump"];
  // a step's text with what to press filled in (strings carry {move}, {fire} ...)
  function fill(key) {
    const vars = {};
    ACTIONS.forEach((a) => { vars[a] = "\u0001" + a + "\u0002"; });
    const s = esc(T(key, vars));
    // a key box is an inline-block: the line may break right after it, so its last box and
    // the punctuation that follows stay together ("...with the knife: [Z]." never leaves "." alone);
    // after a group of keys the punctuation goes inside the group
    return s.replace(/\u0001(\w+)\u0002([.,:;!?)。，：；！？）]+)?/g, (m, a, p) => {
      const gl = glyph(a);
      if (p && /<\/span>$/.test(gl)) return gl.slice(0, -7) + p + "</span>";
      const at = Math.max(gl.lastIndexOf("<kbd"), gl.lastIndexOf("<b "));
      if (!p || at < 0 || !/<\/(kbd|b)>$/.test(gl)) return gl + (p || "");
      return gl.slice(0, at) + `<span class="htr-nw">${gl.slice(at)}${p}</span>`;
    });
  }
  // the touch buttons a step uses, lit on a touch screen (and at the hint on any)
  const TOUCH = {
    look: ["touch-joystick"], sprint: ["touch-sprint"], shoot: ["touch-fire"], aim: ["touch-ads", "touch-reload"],
    switch: ["hud-slots", "touch-melee"], money: ["touch-interact"], doors: ["touch-interact"], wave: ["touch-fire"],
  };
  // the parts of the HUD a step is about, lit when its hint comes (sprint: from the start)
  const HUD = { sprint: ["hud-stam"], shoot: ["hud-meaning"], aim: ["hud-detail"], switch: ["hud-slots"], money: ["hud-savings"], wave: ["hud-head"] };

  const yawOf = (g) => g.yawObject.rotation.y;
  const near = (g, p, r) => Math.hypot(g.yawObject.position.x - p.x, g.yawObject.position.z - p.z) < r;
  const inYard = (g) => { const p = g.yawObject.position; return (p.z > MAP.yard.z0 + 0.5) || (p.x > MAP.yard2.x0 + 0.3 && p.z > MAP.yard2.z0); };

  // ---- the steps: enter, tick (true when done), the lines ticked off, the goal ----
  const DEF = {
    look: {
      enter(r, g) { r.turn = 0; r.lastYaw = yawOf(g); },
      tick(r, g) {
        const y = yawOf(g); let d = y - r.lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        r.turn += Math.abs(d); r.lastYaw = y;
        return r.turn >= C().lookTurn * Math.PI / 180 && near(g, MAP.ring1, 1.5);
      },
      lines: (r, g) => [[T("train.sub.turn"), r.turn >= C().lookTurn * Math.PI / 180], [T("train.sub.ring"), near(g, MAP.ring1, 1.5)]],
      goal: () => MAP.ring1,
    },
    sprint: {
      enter(r, g) { r.runT = 0; r.lastSt = g.stamina; },
      tick(r, g, dt) {
        if (g.stamina < r.lastSt - 1e-4) r.runT += dt;
        r.lastSt = g.stamina;
        return r.runT >= C().sprintSeconds && near(g, MAP.ring2, 1.8);
      },
      lines: (r, g) => [[T("train.sub.run"), r.runT >= C().sprintSeconds], [T("train.sub.ring"), near(g, MAP.ring2, 1.8)]],
      goal: () => MAP.ring2,
    },
    shoot: {
      enter(r, g) { r.k0 = g.correctKills; r.w0 = g.wrongCount; r.slots = MAP.dummies.map(() => ({ z: null, wait: 0 })); },
      tick(r, g, dt) {
        r.hits = g.correctKills - r.k0;
        if (r.hits >= C().targets) return true;
        r.slots.forEach((s, i) => {
          if (s.z && s.z.alive) return;
          s.z = null; s.wait -= dt;
          if (s.wait <= 0) { s.z = spawnDummy(g, MAP.dummies[i]); s.wait = 0.9; }
        });
        return false;
      },
      exit(r, g) { clearDummies(g); },
      lines: (r) => [[T("train.sub.hits", { n: Math.min(r.hits || 0, C().targets), t: C().targets }), (r.hits || 0) >= C().targets]],
      goal: () => null,
    },
    aim: {
      enter(r, g) {
        r.aimT = 0; r.reloaded = false;
        // a magazine with room in it, or there is nothing to reload
        const id = g.currentWeaponId();
        if (id !== "melee") { const a = g.player.ammo[id], full = Math.round(G.WEAPON_DEFS[id].magSize * g.player.weaponLevels[id].mag); if (a.mag >= full) a.mag = Math.max(1, Math.floor(full / 2)); }
        r.target = spawnDummy(g, MAP.dummies[1]);
        G.Bus.on("weapon:reload", (e) => { if (e && e.phase === "commit") r.reloaded = true; }, "train");
      },
      tick(r, g, dt) {
        if ((g.aimP || 0) > 0.8) r.aimT += dt;
        return r.aimT >= C().aimSeconds && r.reloaded;
      },
      exit(r, g) { clearDummies(g); },
      lines: (r) => [[T("train.sub.aim"), r.aimT >= C().aimSeconds], [T("train.sub.reload"), r.reloaded]],
      goal: () => null,
    },
    switch: {
      enter(r, g) {
        if (!g.player.gunSlots.includes("shotgun")) {
          G.Loadout.add(g, "shotgun");
          G.UI.flashPurchaseBanner(G.WEAPON_DEFS.shotgun.name, T("train.gotShotgun"));
        }
        r.sg = false; r.back = false; r.knife = false;
        // (back to the pistol only counts once the shotgun has been in hand)
        G.Bus.on("weapon:switch", (e) => {
          if (!e || e.phase !== "done") return;
          if (e.toId === "shotgun") r.sg = true; else if (e.toId === "pistol" && r.sg) r.back = true;
        }, "train");
        G.Bus.on("weapon:melee", (e) => { if (e && e.phase === "hit" && e.hit) r.knife = true; }, "train");
        r.dummy = spawnDummy(g, MAP.meleeDummy, { tough: true });
      },
      tick(r) { return r.sg && r.back && r.knife; },
      exit(r, g) { clearDummies(g); },
      lines: (r) => [[T("train.sub.toShotgun"), !!r.sg], [T("train.sub.toPistol"), !!r.back], [T("train.sub.knife"), !!r.knife]],
      goal: () => null,
    },
    money: {
      enter(r, g) {
        g.player.money = 0;
        const each = moneyEach(g);
        r.drops = MAP.money.slice(0, C().money.bundles).map((p) => g.spawnDrop("money", new THREE.Vector3(p.x, 0, p.z), { amount: each }));
        r.gun = g.world.wallWeapons[0];
      },
      tick(r, g) {
        r.left = g.drops.filter((d) => d.kind === "money").length;
        return !!(r.gun && r.gun.purchased);
      },
      lines: (r) => {
        const n = C().money.bundles;
        return [[T("train.sub.cash", { n: n - (r.left == null ? n : r.left), t: n }), r.left === 0 || !!(r.gun && r.gun.purchased)], [T("train.sub.buy"), !!(r.gun && r.gun.purchased)]];
      },
      goal: (r, g) => {
        const left = g.drops.find((d) => d.kind === "money");
        if (left) return { x: left.mesh.position.x, z: left.mesh.position.z };
        return { x: MAP.wallGun.x + 1.2, z: MAP.wallGun.z };
      },
    },
    doors: {
      enter(r, g) { r.room = g.world.trainRoomDoor; r.word = g.world.trainWordDoor; },
      tick(r) { return !!(r.room && r.room.open && r.word && r.word.opened); },
      lines: (r) => [[T("train.sub.door"), !!(r.room && r.room.open)], [T("train.sub.wordDoor"), !!(r.word && r.word.opened)]],
      goal: (r) => (r.room && !r.room.open ? { x: MAP.roomDoor.x - 0.9, z: MAP.roomDoor.z } : { x: MAP.wordDoor.x, z: MAP.wordDoor.z - 1.0 }),
    },
    hud: {
      enter(r, g) { r.tour = false; r.wait = 0.6; },
      tick(r, g, dt) {
        if (!r.tourOpen) { r.wait -= dt; if (r.wait <= 0) { r.tourOpen = true; tour(g, () => { r.tour = true; }); } }
        return r.tour;
      },
      lines: () => [],
      goal: () => null,
      panelOff: true,
    },
    wave: {
      enter(r, g) { r.spawned = 0; r.started = false; r.t0 = 0; },
      tick(r, g, dt) {
        if (!r.started) {
          r.t0 += dt;
          if (inYard(g) || r.t0 > 25) { r.started = true; startDrill(g, r); }
          return false;
        }
        return r.spawned > 0 && !g.zombies.some((z) => z.alive && z.type !== "dummy");
      },
      lines: (r, g) => r.started ? [[T("train.sub.kill", { n: r.spawned - g.zombies.filter((z) => z.alive && z.type !== "dummy").length, t: r.spawned }), false]] : [[T("train.sub.outside"), false]],
      goal: (r) => (r.started ? null : { x: 9, z: 6 }),
    },
    quiz: {
      enter(r, g) { r.wait = 1.0; r.shopDone = false; },
      tick(r, g, dt) {
        if (!r.opened) { r.wait -= dt; if (r.wait <= 0 && !G.Modal.isOpen()) { r.opened = true; quiz(g, r); } }
        return r.shopDone;
      },
      lines: (r) => [[T("train.sub.quiz"), !!r.quizDone], [T("train.sub.perk"), !!r.shopDone]],
      goal: () => null,
    },
    cards: {
      enter(r, g) { r.wait = 0.5; },
      tick(r, g, dt) {
        if (!r.opened) { r.wait -= dt; if (r.wait <= 0 && !G.Modal.isOpen()) { r.opened = true; cards(0, () => { r.cardsDone = true; }); } }
        return !!r.cardsDone;
      },
      lines: () => [],
      goal: () => null,
      panelOff: true,
    },
  };

  // step 6: a bundle's worth -- together they pay the wall gun (as the stat sheet prices it) and a little more
  function moneyEach(g) {
    const gun = g && g.world && g.world.wallWeapons && g.world.wallWeapons[0], M = C().money;
    const price = gun ? gun.price : (G.WEAPON_DEFS[C().wallGun] || { price: 1000 }).price;
    return Math.ceil(price * (1 + (M.spare || 0)) / M.bundles / 10) * 10;
  }
  // a straw dummy at p, carrying one of the practice words; `tough`: one the
  // knife is tried on -- it takes a blow and stays, and carries no word to shoot
  function spawnDummy(g, p, o) {
    o = o || {};
    const pos = new THREE.Vector3(p.x, 0, p.z);
    const z = g.spawnZombieAt("dummy", pos, null);
    if (!z) return null;
    z._hold = 1e9; z._holdNoTurn = true; z.speed = 0; z.damage = 0; z.dummy = true;
    const P = g.yawObject.position;
    z.mesh.rotation.y = Math.atan2(START[2].x - p.x, START[2].z - p.z);
    if (o.tough) {
      z.hp = z.maxHp = 1e6;
      z.decoy = { forKey: null, source: "training" };
      z.sprite.visible = false; z.labelText = "";
      z.mesh.rotation.y = Math.atan2(P.x - p.x, P.z - p.z);
      g.ensureTargetHasMatch();
    }
    return z;
  }
  function clearDummies(g) {
    g.zombies.slice().forEach((z) => { if (z.type === "dummy" && z.alive) g.retireZombie(z); });
    g.ensureTargetHasMatch();
  }
  // step 9: five Shamblers and a Crawler from the yard's far end, gentler bites
  function startDrill(g, r) {
    const W = C().wave, kinds = [];
    for (let i = 0; i < W.normal; i++) kinds.push("normal");
    for (let i = 0; i < W.crawler; i++) kinds.push("crawler");
    kinds.forEach((type, i) => {
      const p = MAP.wave[i % MAP.wave.length];
      const z = g.spawnZombieAt(type, new THREE.Vector3(p.x, 0, p.z), null);
      if (z) { z.damage *= C().waveDamage; r.spawned++; }
    });
    g.requiredKills = r.spawned; g.spawnedCount = r.spawned;
    G.Audio.sfx && G.Audio.sfx("shop_warn");
  }
  // step 10: three questions on the run's words, then the shop
  function quiz(g, r) {
    // (the wave's words, as the pairs of the practice set: G.Quiz keeps bare copies,
    // without the languages and the pinyin a pair carries)
    const pool = g.wordPool, low = (s) => String(s).toLowerCase();
    const met = new Set((g.waveWords || []).map((p) => low(p[0])));
    const seen = pool.filter((p) => met.has(low(p[0])));
    const picks = G.shuffle((seen.length ? seen : pool).slice()).slice(0, C().quiz);
    while (picks.length < C().quiz) picks.push(G.pick(pool));
    const kinds = ["th2en", "en2th", "th2en"];
    const qs = picks.map((p, i) => G.Questions.build(p, G.Questions.can(kinds[i % kinds.length], p) ? kinds[i % kinds.length] : "th2en", pool));
    G.Quiz.open(g, () => {
      r.quizDone = true;
      g.player.money = Math.max(g.player.money, C().perkMoney);
      g.openShop();
      const tip = $("shop-tip");
      if (tip) { tip.textContent = "🎯 " + T("train.shopTip"); tip.classList.remove("hidden"); }
    }, {
      qs, maxMistakes: qs.length, kicker: T("train.quizKicker"), log: { training: true },
      verdict: { passed: "train.quizDone", failed: "train.quizDone", passedSub: "train.quizDoneSub", failedSub: "train.quizDoneSub", vars: {} },
      summary: (Q) => T("train.quizSummary", { n: qs.length, m: Q.correct }),
    });
  }

  // ---------------- the HUD tour (step 8) ----------------
  const TOUR = [["hp", "hud-hp"], ["stam", "hud-stam"], ["slots", "hud-slots"], ["detail", "hud-detail"], ["head", "hud-head"]];
  function tour(g, done) {
    let i = 0;
    let root = $("train-tour");
    if (!root) {
      root = document.createElement("div");
      root.id = "train-tour"; root.className = "train-tour hidden";
      root.innerHTML = `<div class="tt-spot" id="tt-spot"></div><div class="tt-box" id="tt-box" role="dialog" aria-modal="true" aria-labelledby="tt-title"><div class="tt-count" id="tt-count"></div><b id="tt-title"></b><p id="tt-text"></p>
        <div class="tt-btns"><button type="button" class="btn" id="tt-skip" data-pad-back></button><button type="button" class="btn btn-primary" id="tt-next"></button></div></div>`;
      document.body.appendChild(root);
    }
    const show = () => {
      const [id, elId] = TOUR[i], el = $(elId);
      $("tt-count").textContent = (i + 1) + " / " + TOUR.length;
      $("tt-title").textContent = T("train.tour." + id + ".title");
      $("tt-text").innerHTML = fill("train.tour." + id + ".text");
      $("tt-next").innerHTML = esc(T(i === TOUR.length - 1 ? "train.tour.done" : "train.tour.next")) + `<span class="kbd-only dlg-key"> (Enter)</span>`;
      $("tt-skip").innerHTML = esc(T("train.tour.skip")) + `<span class="kbd-only dlg-key"> (Esc)</span>`;
      const spot = $("tt-spot"), box = $("tt-box");
      const r = el && el.offsetParent ? el.getBoundingClientRect() : null;
      if (r && r.width) {
        const m = 6;
        Object.assign(spot.style, { left: (r.left - m) + "px", top: (r.top - m) + "px", width: (r.width + m * 2) + "px", height: (r.height + m * 2) + "px", display: "" });
        // the words beside it: above when it is low on the screen, else below
        const vh = window.innerHeight, vw = window.innerWidth, bw = Math.min(360, vw - 24);
        box.style.width = bw + "px";
        box.style.left = Math.max(12, Math.min(vw - bw - 12, r.left + r.width / 2 - bw / 2)) + "px";
        if (r.top > vh * 0.5) { box.style.top = ""; box.style.bottom = (vh - r.top + 14) + "px"; } else { box.style.bottom = ""; box.style.top = (r.bottom + 14) + "px"; }
      } else { spot.style.display = "none"; box.style.left = "50%"; box.style.top = "30%"; }
      setTimeout(() => { if (G.Input.mode !== "touch") $("tt-next").focus({ preventScroll: true }); }, 0);
    };
    const close = () => {
      root.classList.add("hidden");
      G.Modal.close("train-tour");
      done();
    };
    const next = () => { i++; if (i >= TOUR.length) close(); else show(); };
    $("tt-next").onclick = next;
    $("tt-skip").onclick = close;
    G.UI.setHudVisible(true);
    root.classList.remove("hidden");
    G.Modal.open("train-tour", { pause: true, keys: (e) => {
      if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter" || e.code === "KeyE") { if (e.preventDefault) e.preventDefault(); next(); return true; }
      if (e.code === "Escape") { close(); return true; }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Tab") { if (e.preventDefault) e.preventDefault(); (document.activeElement === $("tt-next") ? $("tt-skip") : $("tt-next")).focus({ preventScroll: true }); return true; }
      return true;
    } });
    show();
  }

  // ---------------- the cards (step 11) ----------------
  const CARDS = [["forge", "⚒"], ["attach", "🔧"], ["srs", "🧠"], ["vocab", "📖"], ["report", "🐞"]];
  function cards(i, done) {
    if (i >= CARDS.length) { done(); return; }
    const [id, icon] = CARDS[i], last = i === CARDS.length - 1;
    G.Dialog.open({
      icon, title: T("train.card." + id + ".title"), text: T("train.card." + id + ".text"),
      body: `<p class="train-card-count">${i + 1} / ${CARDS.length}</p>`,
      buttons: [
        { label: T("train.card.skip"), cancel: true, action: () => done() },
        { label: T(last ? "train.card.done" : "train.card.next"), primary: true, action: () => cards(i + 1, done) },
      ],
    });
  }

  // ---------------- the panel ----------------
  function panel() {
    let el = $("hud-train");
    if (!el) {
      el = document.createElement("div");
      el.id = "hud-train"; el.className = "hud-train hidden"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      el.innerHTML = `<div class="htr-top"><span class="htr-step" id="htr-step"></span></div><div class="htr-title" id="htr-title"></div><div class="htr-text" id="htr-text"></div>
        <ul class="htr-lines" id="htr-lines"></ul><div class="htr-hint hidden" id="htr-hint"></div>`;
      const hud = $("hud");
      (hud || document.body).appendChild(el);
      const ar = document.createElement("div");
      ar.id = "htr-arrow"; ar.className = "htr-arrow hidden"; ar.setAttribute("aria-hidden", "true");
      ar.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 12h12M11 6l6 6-6 6"/></svg>`;
      (hud || document.body).appendChild(ar);
    }
    return el;
  }
  function render(r) {
    const el = panel(), id = STEPS[r.i], D = DEF[id];
    el.classList.toggle("hidden", !!D.panelOff);
    el.classList.toggle("still", G.Access.reduce());
    $("htr-step").textContent = T("train.stepOf", { i: r.i + 1, n: STEPS.length });
    $("htr-title").textContent = T("train." + id + ".title");
    $("htr-text").innerHTML = fill("train." + id + ".text");
    const hint = $("htr-hint");
    hint.classList.toggle("hidden", !r.hintOn);
    if (r.hintOn) hint.innerHTML = "💡 " + fill("train." + id + ".hint");
    r.dev = dev();
    lines(r);
  }
  function lines(r) {
    const D = DEF[STEPS[r.i]], L = D.lines ? D.lines(r, r.game) : [];
    const sig = L.map((x) => x[0] + (x[1] ? 1 : 0)).join("|");
    if (sig === r.linesSig) return;
    r.linesSig = sig;
    $("htr-lines").innerHTML = L.map(([text, ok]) => `<li class="${ok ? "ok" : ""}"><span aria-hidden="true">${ok ? "✔" : "○"}</span> ${esc(text)}</li>`).join("");
  }
  // what is lit: the touch buttons of the step (on a touch screen), and at the
  // hint the HUD's parts too -- and the touch buttons on any device
  function light(r) {
    const id = STEPS[r.i], want = new Set();
    if (dev() === "touch" || r.hintOn) (TOUCH[id] || []).forEach((x) => want.add(x));
    if (r.hintOn || id === "sprint" || id === "shoot") (HUD[id] || []).forEach((x) => want.add(x));
    const still = G.Access.reduce();
    document.querySelectorAll(".train-glow").forEach((n) => { if (!want.has(n.id)) n.classList.remove("train-glow", "still"); });
    want.forEach((x) => { const n = $(x); if (n) { n.classList.add("train-glow"); n.classList.toggle("still", still); } });
  }
  function unlight() { document.querySelectorAll(".train-glow").forEach((n) => n.classList.remove("train-glow", "still")); }

  // ---------------- the ring on the ground, and the arrow to it ----------------
  function beacon(g) {
    if (run && run.beacon) return run.beacon;
    const grp = new THREE.Group();
    const ringM = new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 8, 40), ringM);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
    // (a faint shaft over it, to be found from across the yard)
    const beamM = new THREE.MeshBasicMaterial({ color: 0x3ad27a, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 5, 12, 1, true), beamM);
    beam.position.y = 2.5;
    grp.add(ring); grp.add(beam);
    grp.userData.ring = ring;
    grp.visible = false;
    g.scene.add(grp);
    return grp;
  }
  function placeGoal(r, g, dt) {
    const D = DEF[STEPS[r.i]], goal = D.goal ? D.goal(r, g) : null, b = r.beacon, ar = $("htr-arrow");
    if (!goal || G.Modal.isOpen()) { b.visible = false; if (ar) ar.classList.add("hidden"); return; }
    b.visible = true;
    b.position.set(goal.x, 0, goal.z);
    if (!G.Access.reduce()) { r.pulse = (r.pulse || 0) + dt; const s = 1 + Math.sin(r.pulse * 3) * 0.08; b.userData.ring.scale.set(s, s, s); }
    // the arrow: towards the goal, when it is off to the side or behind
    const P = g.yawObject.position, dx = goal.x - P.x, dz = goal.z - P.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(-dx, -dz);
    let rel = want - yawOf(g); rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (!ar) return;
    const show = dist > 2.2 && Math.abs(rel) > 0.45;
    ar.classList.toggle("hidden", !show);
    if (show) ar.style.transform = `translate(-50%, -50%) rotate(${(-rel - Math.PI / 2) * 180 / Math.PI}deg) translateX(110px)`;
  }

  // ---------------- the run's life ----------------
  function beginRun(game, step) {
    const i = Math.max(0, Math.min(STEPS.length - 1, step | 0));
    run = { game, i: -1, t: 0, hintOn: false };
    run.beacon = beacon(game);
    document.body.classList.add("training-run");
    // (picked up at a later step: what the steps before it gave, as they left it)
    if (i > STEPS.indexOf("switch") && !game.player.gunSlots.includes("shotgun")) G.Loadout.add(game, "shotgun");
    if (i > STEPS.indexOf("money")) {
      const ref = game.world.wallWeapons[0];
      if (ref && !ref.purchased) { ref.purchased = true; if (!game.player.gunSlots.includes(ref.id)) G.Loadout.add(game, ref.id); }
    }
    if (i > STEPS.indexOf("doors")) {
      const rd = game.world.trainRoomDoor, wd = game.world.trainWordDoor;
      if (rd && !rd.open) game.toggleRoomDoor(rd, true);
      if (wd && !wd.opened) game.clearBlockingObstacle(wd, "opened");
    }
    const s = START[i];
    if (i > 0) game.teleportPlayer(new THREE.Vector3(s.x, 0, s.z));
    game.yawObject.rotation.y = s.yaw;
    game.requiredKills = 0; game.spawnedCount = 0;
    goTo(i);
  }
  function goTo(i) {
    const r = run, g = r.game;
    if (r.i >= 0) { const D = DEF[STEPS[r.i]]; if (D.exit) D.exit(r, g); }
    G.Bus.off("train");                                 // (the last step's listeners)
    if (i >= STEPS.length) { finish(g); return; }
    const keep = { game: g, beacon: r.beacon, i, t: 0, hintOn: false };
    Object.keys(r).forEach((k) => delete r[k]);
    Object.assign(r, keep);
    data().step = i;
    G.persistSoon && G.persistSoon();
    G.Bus.emit("training:step", { step: i, id: STEPS[i] });
    const D = DEF[STEPS[i]];
    if (D.enter) D.enter(r, g);
    render(r);
    light(r);
    if (i > 0) G.Audio.sfx && G.Audio.sfx("correct");
  }
  function update(game, dt) {
    const r = run;
    if (!r || r.game !== game || r.finished) return;
    const id = STEPS[r.i], D = DEF[id];
    if (G.Modal.isOpen() && id !== "hud" && id !== "quiz" && id !== "cards") { placeGoal(r, game, dt); return; }
    r.t += dt;
    if (!r.hintOn && r.t > C().hintAfter) { r.hintOn = true; render(r); light(r); }
    if (r.dev !== dev()) { render(r); light(r); }
    const done = D.tick(r, game, dt);
    lines(r);
    placeGoal(r, game, dt);
    // a dummy hit and still standing rocks on its post (Reduce Motion: a little)
    game.zombies.forEach((z) => {
      if (z.type !== "dummy" || !z.alive || !z._wob) return;
      z._wob = Math.max(0, z._wob - dt * 1.6);
      z._wt = (z._wt || 0) + dt;
      z.mesh.rotation.x = Math.sin(z._wt * 18) * 0.16 * z._wob * (G.Access.reduce() ? 0.4 : 1);
    });
    if (done) goTo(r.i + 1);
  }
  // the shop closed: step 10 is over (js/game.js nextWave in a training run)
  function afterShop(game) {
    const tip = $("shop-tip");
    if (tip) tip.classList.add("hidden");
    if (run && STEPS[run.i] === "quiz") run.shopDone = true;
  }
  // nothing ends a run here (js/game.js checkPlayerDeath)
  function downed(game) {
    game.player.hp = Math.max(1, game.player.maxHp * C().floorHp);
    G.UI.flashPurchaseBanner(T("train.downedTitle"), T("train.downed"));
  }
  function finish(game) {
    const d = data();
    d.done = true; d.step = 0; d.offered = true; d.finishedAt = Date.now();
    G.persist();
    run.finished = true;
    unlight();
    $("hud-train") && $("hud-train").classList.add("hidden");
    $("htr-arrow") && $("htr-arrow").classList.add("hidden");
    if (run.beacon) run.beacon.visible = false;
    G.Bus.emit("training:done", {});
    G.Audio.sfx && G.Audio.sfx("unlock");
    G.Dialog.open({
      icon: "🎓", title: T("train.done.title"), text: T("train.done.text"),
      buttons: [
        { label: T("train.done.menu"), cancel: true, action: () => leave(game) },
        { label: T("train.done.play"), primary: true, action: () => { leave(game, true); } },
      ],
    });
  }
  function leave(game, playSchool) {
    game.quitToMainMenu();
    if (playSchool) setTimeout(() => G.Game.newRun(1), 0);
  }
  // from the pause menu: skip the rest (asked first)
  function skip() {
    G.Dialog.open({
      icon: "⏭", title: T("train.skip.title"), text: T("train.skip.text"),
      buttons: [
        { label: T("train.skip.no"), cancel: true, action: () => {} },
        { label: T("train.skip.yes"), primary: true, action: () => {
          const d = data(); d.skipped = true; d.offered = true; d.step = 0;
          G.persist();
          G.Bus.emit("training:skip", {});
          G.Game.quitToMainMenu();
        } },
      ],
    });
  }
  function teardown(game) {
    G.Bus.off("train");
    unlight();
    if ($("hud-train")) $("hud-train").classList.add("hidden");
    if ($("htr-arrow")) $("htr-arrow").classList.add("hidden");
    const tt = $("train-tour");
    if (tt) tt.classList.add("hidden");
    document.body.classList.remove("training-run");
    run = null;
  }

  // ---------------- from the menus ----------------
  // the yard from the start, or -- left half-way -- from its checkpoint (asked)
  function open() {
    if (!on()) return;
    const d = data();
    if (d.step > 0 && !d.done) {
      G.Dialog.open({
        icon: "🎯", title: T("train.title"), text: T("train.resume.text", { i: d.step + 1, n: STEPS.length }),
        buttons: [
          // (expansion, round 9: a way back out -- Esc, the controller's B)
          { label: T("dialog.cancel"), cancel: true },
          { label: T("train.resume.restart"), action: () => G.Game.startTraining(0) },
          { label: T("train.resume.cont"), primary: true, action: () => G.Game.startTraining(d.step) },
        ],
      });
      return;
    }
    G.Game.startTraining(0);
  }
  // a player who has played nothing yet: no memory boxes, no level scores
  function isNew() {
    const S = G.save;
    const srs = S.learn && S.learn.srs ? Object.keys(S.learn.srs).length : 0;
    return !srs && !Object.keys(S.levelHighScores || {}).length && !S.tutorialDone && !(S.meta && S.meta.playSec > 600);
  }
  // after the first setup (the brightness, js/brightness.js; the lobby coming
  // up): once, "Play the tutorial" / "Skip" -- and the languages first, if they
  // are not right yet
  function maybeOffer() {
    if (!on() || !G.save || G.Modal.isOpen() || !G.Game || G.Game.state !== "MENU") return false;
    const d = data();
    if (d.offered || d.done) return false;
    if (C().offerNewOnly && !isNew()) { d.offered = true; G.persistSoon && G.persistSoon(); return false; }
    const L = G.Lang;
    G.Dialog.open({
      icon: "🎓", title: T("train.offer.title"), text: T("train.offer.text"),
      body: `<p class="train-offer-langs">🌐 ${esc(T("train.offer.langLine", { w: L.label(L.word()), m: L.label(L.meaning()), u: L.label(G.lang) }))}</p>`,
      buttons: [
        { label: T("train.offer.skip"), cancel: true, action: () => { d.offered = true; d.skipped = true; G.persist(); } },
        { label: T("train.offer.langs"), action: () => { G.UI._settingsReturn = G.UI._currentScreen || "screen-mainmenu"; if (G.SettingsUI) G.SettingsUI.cat = "language"; G.UI.renderSettings(); G.UI.showScreen("screen-settings"); G.TrainingYard._offerAgain = true; } },
        { label: T("train.offer.play"), primary: true, action: () => { d.offered = true; G.persist(); G.Game.startTraining(0); } },
      ],
    });
    return true;
  }
  // the lobby's card: what has been done here
  function status() {
    const d = data();
    if (d.done) return T("lobby.tutDone");
    if (d.step > 0) return T("lobby.tutStep", { i: d.step + 1, n: STEPS.length });
    return T("lobby.tutNew");
  }
  // the HUD's header in a training run
  function hudHead(game, left) {
    const r = run;
    return { level: T("train.title"), wave: r ? T("train.stepOf", { i: Math.min(r.i + 1, STEPS.length), n: STEPS.length }) : "", left: r && STEPS[r.i] === "wave" && game.requiredKills ? T("hud.zombiesLeftOf", { n: left, t: game.requiredKills }) : "", boss: false };
  }
  function idleMeaning() { return run ? T("train." + STEPS[run.i] + ".title") : "-"; }

  return {
    STEPS, MAP, on, data, practice, pairs, level, build, dummyMesh, glyph, fill, moneyEach,
    beginRun, update, afterShop, downed, teardown, skip, open, maybeOffer, isNew, status, hudHead, idleMeaning,
    goTo: (i) => { if (run) goTo(i); },
    get run() { return run; },
    _offerAgain: false,
  };
})();
