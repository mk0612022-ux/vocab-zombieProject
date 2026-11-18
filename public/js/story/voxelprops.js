// ===================================================================
// The chapter's props, built of blocks (story series, round 3)
// -------------------------------------------------------------------
// Design doc: every prop square-edged -- a bookshelf a block of book spines,
// a desk of small blocks, a door two blocks high, a tree's leaves in cubes.
// All of them on the block atlas (js/story/voxeltex.js) and its shared
// materials (js/story/voxel.js), so the level's merge bakes a room's worth of
// them into a draw call or two; what moves (a fan's blades) is kept apart.
// Two worlds side by side, as the doc wants: NeuroLex's clean blue and white
// (the PA desk, the LEXA standee) and the students' crayon and cut paper (the
// exhibition board). Sign text comes from the strings (G.STRINGS.en: the
// school's signs are in English in every language -- the chapter teaches by them),
// drawn in the pixel font.
//
//   G.VoxelProps.LIST                 the props' ids, in the gallery's order
//   G.VoxelProps.build(id, o)         a THREE.Group, standing on y = 0, facing +z
//   G.VoxelProps.place(kit, id, x, z, ry, o)   into a level: the scene, a collider
//                                     (o.collider false: none), world.noMerge for
//                                     what moves; returns the group
//   G.VoxelProps.sign(lines, w, o)    a sign plate w metres wide (its height from its text)
// ===================================================================
window.G = window.G || {};

G.VoxelProps = (function () {
  const V = () => G.Voxel;
  const SIGN = (k) => (G.STRINGS && G.STRINGS.en && G.STRINGS.en[k]) || k;
  // a box from (x0, y0, z0) to (x1, y1, z1) metres into a group; o as G.Voxel.box
  function add(g, faces, b, o) {
    const w = b[3] - b[0], h = b[4] - b[1], d = b[5] - b[2];
    const m = V().box(faces, w, h, d, o);
    m.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
    g.add(m);
    return m;
  }
  // a sign: a thin dark frame and its face in front (lit, or glowing with o.glow);
  // o.pxm: the plate's pixels a metre, its width from its text (every letter one size)
  function sign(lines, w, o) {
    o = o || {};
    const s = G.VoxelTex.sign(lines, o);
    if (o.pxm) w = s.w / o.pxm;
    const h = w * (s.h / s.w), g = new THREE.Group();
    add(g, o.frame || "metalDark", [-w / 2 - 0.03, -h / 2 - 0.03, -0.04, w / 2 + 0.03, h / 2 + 0.03, 0]);
    const mat = o.glow ? new THREE.MeshBasicMaterial({ map: s.tex }) : new THREE.MeshLambertMaterial({ map: s.tex });
    if (o.glow) mat.userData.vzGlow = "sign";
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    face.position.z = 0.004;
    g.add(face);
    g.userData.size = [w, h];
    return g;
  }

  const B = {};
  // ---- a classroom ----
  B.desk = (g) => {
    add(g, "plank", [-0.3, 0.7, -0.22, 0.3, 0.74, 0.22]);
    add(g, "metalDark", [-0.27, 0.56, -0.2, 0.27, 0.6, 0.2]);                         // the book tray
    [[-0.27, -0.19], [0.24, -0.19], [-0.27, 0.16], [0.24, 0.16]].forEach(([x, z]) => add(g, "metalDark", [x, 0, z, x + 0.03, 0.7, z + 0.03]));
  };
  B.chair = (g) => {
    add(g, "plank", [-0.2, 0.43, -0.2, 0.2, 0.46, 0.2]);
    add(g, "plank", [-0.2, 0.62, -0.22, 0.2, 0.86, -0.19]);
    [[-0.19, -0.19], [0.16, -0.19], [-0.19, 0.16], [0.16, 0.16]].forEach(([x, z]) => add(g, "metalDark", [x, 0, z, x + 0.03, 0.43, z + 0.03]));
    add(g, "metalDark", [-0.19, 0.46, -0.21, -0.16, 0.86, -0.19]); add(g, "metalDark", [0.16, 0.46, -0.21, 0.19, 0.86, -0.19]);
  };
  B.teacherDesk = (g) => {
    add(g, "woodDark", [-0.6, 0, -0.3, 0.6, 0.72, 0.3]);
    add(g, "plank", [-0.64, 0.72, -0.33, 0.64, 0.77, 0.33]);
    add(g, "paper", [-0.3, 0.771, -0.1, 0.0, 0.775, 0.12]);
    add(g, "paintRed", [0.15, 0.77, 0.05, 0.3, 0.8, 0.15]);                         // a mug's worth of red: a stapler
  };
  B.blackboard = (g, o) => {
    const w = (o && o.w) || 3;
    add(g, "woodDark", [-w / 2 - 0.08, 0.82, -0.05, w / 2 + 0.08, 2.18, 0]);
    add(g, "blackboard", [-w / 2, 0.9, -0.04, w / 2, 2.1, 0.01], { mode: "meter" });
    add(g, "woodDark", [-w / 2, 0.86, 0, w / 2, 0.9, 0.08]);                           // the chalk tray
    add(g, "paintWhite", [-0.2, 0.9, 0.02, -0.12, 0.92, 0.04]);
  };
  B.clock = (g) => add(g, { all: "metalDark", front: "clock" }, [-0.18, 2.3, -0.04, 0.18, 2.66, 0]);
  B.fan = (g) => {
    add(g, "metal", [-0.02, 3.2, -0.02, 0.02, 3.6, 0.02]);
    const hub = new THREE.Group(); hub.position.y = 3.15; g.add(hub);
    add(hub, "metal", [-0.12, -0.08, -0.12, 0.12, 0.04, 0.12]);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group(); arm.rotation.y = (i * Math.PI * 2) / 3; hub.add(arm);
      add(arm, "plank", [0.1, -0.03, -0.07, 0.75, -0.01, 0.07]);
    }
    g.userData.spin = hub;
    g.userData.moves = true;
  };
  B.lamp = (g) => {
    add(g, "metal", [-0.66, 3.5, -0.08, 0.66, 3.56, 0.08]);
    add(g, "lamp", [-0.6, 3.44, -0.04, 0.6, 3.5, 0.04], { mat: "glow" });
  };
  B.bookshelf = (g, o) => {
    const w = (o && o.w) || 1;
    for (let i = 0; i < w; i++) add(g, { side: "shelfSide", front: i % 2 ? "booksB" : "books", back: "shelfSide", top: "plank" }, [-w / 2 + i, 0, -0.2, -w / 2 + i + 1, 2, 0.2], { mode: "meter" });
  };
  B.door = (g, o) => {
    add(g, "woodDark", [-0.58, 0, -0.08, -0.5, 2.08, 0.08]); add(g, "woodDark", [0.5, 0, -0.08, 0.58, 2.08, 0.08]); add(g, "woodDark", [-0.58, 2, -0.08, 0.58, 2.08, 0.08]);
    add(g, { all: "woodDark", front: "doorBottom", back: "doorBottom" }, [-0.5, 0, -0.04, 0.5, 1, 0.04]);
    add(g, { all: "woodDark", front: "doorTop", back: "doorTop" }, [-0.5, 1, -0.04, 0.5, 2, 0.04]);
    if (o && o.label) { const s = sign(String(o.label), 0.36, { bg: 0x1f3a6b, scale: 2 }); s.position.set(0, 2.24, 0.09); g.add(s); }
  };
  B.locker = (g, o) => {
    const n = (o && o.n) || 3;
    for (let i = 0; i < n; i++) add(g, { all: "metal", front: "locker" }, [-n * 0.25 + i * 0.5, 0, -0.25, -n * 0.25 + (i + 1) * 0.5, 1.8, 0.25]);
  };
  // (fits an opening of 2 x 1 blocks with its sill at 1 m: a classroom's wide window)
  B.window = (g) => {
    add(g, "metal", [-1, 1, -0.06, -0.94, 2, 0.06]); add(g, "metal", [0.94, 1, -0.06, 1, 2, 0.06]);
    add(g, "metal", [-1, 1, -0.06, 1, 1.06, 0.06]); add(g, "metal", [-1, 1.94, -0.06, 1, 2, 0.06]);
    add(g, "metal", [-0.03, 1.06, -0.05, 0.03, 1.94, 0.05]);
    add(g, "glass", [-0.94, 1.06, -0.01, 0.94, 1.94, 0.01], { mat: "glass" });
  };
  // ---- the corridor's walls ----
  B.exitSign = (g) => add(g, { all: "metalDark", front: "exitSign", back: "exitSign" }, [-0.25, 2.4, -0.04, 0.25, 2.7, 0.04], { mat: "glow" });
  B.emergencyLight = (g) => { add(g, "metalDark", [-0.16, 2.6, -0.06, 0.16, 2.78, 0]); add(g, "emergency", [-0.12, 2.62, 0, 0.12, 2.76, 0.05], { mat: "glow" }); };
  B.evacSign = (g) => { const s = sign([SIGN("story.sign.evac1"), SIGN("story.sign.evac2"), "", SIGN("story.sign.evac3")], 0.9, { bg: 0x1f6a3a, scale: 2 }); s.position.set(0, 1.6, 0.01); g.add(s); };
  B.fireExtinguisher = (g) => {
    add(g, "metalDark", [-0.12, 0.6, -0.06, 0.12, 0.66, 0]);
    add(g, { all: "paintRed", front: "fireExt" }, [-0.09, 0.08, 0.0, 0.09, 0.62, 0.18]);
    add(g, "paintBlack", [-0.04, 0.62, 0.05, 0.04, 0.7, 0.13]);
    add(g, "paintBlack", [0.09, 0.3, 0.07, 0.12, 0.6, 0.1]);
  };
  // the students' crayon and cut paper
  B.exhibitBoard = (g) => {
    add(g, "metalDark", [-1.05, 0, -0.03, -0.99, 1.9, 0.03]); add(g, "metalDark", [0.99, 0, -0.03, 1.05, 1.9, 0.03]);
    add(g, "cork", [-1, 0.7, -0.03, 1, 1.9, 0.02], { mode: "meter" });
    [["handmade", -0.85, 1.1], ["handmadeB", -0.2, 0.8], ["handmade", 0.45, 1.25], ["handmadeB", 0.2, 1.45]].forEach(([t, x, y]) => add(g, t, [x, y, 0.02, x + 0.5, y + 0.42, 0.025]));
  };
  // ---- NeuroLex: clean, blue and white, expensive ----
  B.lexaStandee = (g) => {
    add(g, "paintWhite", [-0.45, 0, -0.2, 0.45, 0.06, 0.2]);
    add(g, { all: "paintWhite", front: "lexaAd", back: "neurolex" }, [-0.42, 0.06, -0.03, 0.42, 2, 0.03], { mode: "meter" });
    const s = sign([SIGN("story.sign.lexa1"), SIGN("story.sign.lexa2"), SIGN("story.sign.lexa3")], 0.7, { bg: 0x1a5aa8, fg: 0xffffff, light: 0x5ac8f0, edge: 0x0e3a78, scale: 2 });
    s.position.set(0, 1.55, 0.04); g.add(s);
  };
  B.paConsole = (g) => {
    add(g, { all: "paintWhite", front: "neurolex" }, [-0.8, 0, -0.35, 0.8, 0.78, 0.35]);
    add(g, "paintWhite", [-0.84, 0.78, -0.38, 0.84, 0.82, 0.38]);
    add(g, { all: "metalDark", front: "screen" }, [-0.35, 0.82, -0.3, 0.35, 1.22, -0.25], { mat: "glow" });
    add(g, "metalDark", [0.4, 0.82, 0.0, 0.43, 1.15, 0.03]); add(g, "paintBlack", [0.38, 1.15, -0.02, 0.45, 1.24, 0.05]);    // the microphone
    add(g, "lightBlue", [-0.7, 0.83, 0.15, -0.55, 0.86, 0.3], { mat: "glow" });                                      // its button
    const s = sign([SIGN("story.sign.pa1"), SIGN("story.sign.pa2")], 0.9, { bg: 0xf4f7fa, fg: 0x1a7ac8, light: 0xffffff, edge: 0x2bb6e8, scale: 2 });
    s.position.set(0, 0.5, 0.36); g.add(s);
  };
  // ---- the nurse's room ----
  B.medCabinet = (g) => {
    add(g, "paintWhite", [-0.6, 0, -0.2, 0.6, 1.8, 0.2]);
    for (const y of [0.6, 1.0, 1.4]) add(g, "paintWhite", [-0.56, y, -0.18, 0.56, y + 0.03, 0.18]);
    // six boxes, labels in English (story round 7's puzzle reads them)
    [["medGreen", -0.45, 0.63], ["medBlue", -0.1, 0.63], ["medOrange", 0.25, 0.63], ["medBlue", -0.45, 1.03], ["medOrange", -0.1, 1.03], ["medGreen", 0.25, 1.03]].forEach(([t, x, y]) => add(g, { all: "paintWhite", front: t }, [x, y, -0.1, x + 0.28, y + 0.3, 0.12]));
    add(g, "glass", [-0.58, 0.05, 0.19, 0.58, 1.75, 0.2], { mat: "glass" });
  };
  B.nurseBed = (g) => {
    add(g, "metal", [-0.45, 0.4, -1, 0.45, 0.46, 1]);
    [[-0.45, -1], [0.41, -1], [-0.45, 0.96], [0.41, 0.96]].forEach(([x, z]) => add(g, "metal", [x, 0, z, x + 0.04, 0.4, z + 0.04]));
    add(g, "sheet", [-0.42, 0.46, -0.98, 0.42, 0.6, 0.98]);
    add(g, "paintWhite", [-0.3, 0.6, -0.95, 0.3, 0.7, -0.65]);
    add(g, "metal", [-0.47, 0.46, -1.02, 0.47, 0.9, -0.98]);
    add(g, "metal", [0.7, 0, 0.7, 0.73, 2.1, 0.73]); add(g, "metal", [0.7, 2.06, -1.1, 0.73, 2.09, 0.73]);              // the curtain's rail
    add(g, "fabricBlue", [0.69, 0.3, -1.05, 0.71, 2.04, 0.2], { mode: "meter" });
  };
  // ---- the music room (1-2: the room is told apart by what is in it) ----
  B.piano = (g) => {
    add(g, "woodDark", [-0.7, 0, -0.28, 0.7, 1.2, 0.0]);
    add(g, "woodDark", [-0.7, 0.62, 0.0, 0.7, 0.72, 0.3]);
    add(g, { all: "woodDark", top: "pianoKeys" }, [-0.64, 0.72, 0.0, 0.64, 0.76, 0.28]);
    add(g, "woodDark", [-0.7, 0, 0.18, -0.64, 0.62, 0.3]); add(g, "woodDark", [0.64, 0, 0.18, 0.7, 0.62, 0.3]);
    add(g, "paintBlack", [-0.5, 0, 0.6, 0.5, 0.48, 0.95]);                         // the stool
  };
  B.drums = (g) => {
    add(g, { all: "paintRed", front: "drumSkin", back: "drumSkin" }, [-0.3, 0, -0.2, 0.3, 0.55, 0.2]);
    add(g, { all: "paintRed", top: "drumSkin" }, [-0.35, 0.6, 0.1, -0.1, 0.75, 0.35]); add(g, { all: "paintRed", top: "drumSkin" }, [0.1, 0.6, 0.1, 0.35, 0.75, 0.35]);
    add(g, "metal", [0.5, 0, 0.3, 0.53, 0.65, 0.33]); add(g, { all: "metal", top: "drumSkin" }, [0.38, 0.5, 0.22, 0.66, 0.62, 0.48]);
    add(g, "metal", [-0.6, 0, 0.0, -0.57, 1.0, 0.03]); add(g, "paintYellow", [-0.85, 1.0, -0.25, -0.33, 1.02, 0.27]);   // a cymbal
  };
  // ---- the gym ----
  B.bleachers = (g, o) => {
    const w = (o && o.w) || 4;
    for (let r = 0; r < 3; r++) add(g, { all: "concreteDark", front: "bleacher", top: "plank" }, [-w / 2, 0, -0.6 * r - 0.6, w / 2, 0.45 * (r + 1), -0.6 * r], { mode: "meter" });
  };
  B.vaultBox = (g) => {
    for (let i = 0; i < 4; i++) { const k = i * 0.05; add(g, "vault", [-0.6 + k, i * 0.25, -0.25 + k * 0.4, 0.6 - k, (i + 1) * 0.25, 0.25 - k * 0.4]); }
    add(g, "mat", [-0.45, 1.0, -0.15, 0.45, 1.08, 0.15]);
    add(g, "mat", [-1, 0, 0.6, 1, 0.08, 1.8]);                                      // the landing mat
  };
  // ---- the canteen ----
  B.canteenTable = (g) => {
    add(g, "paintWhite", [-1.2, 0.72, -0.4, 1.2, 0.76, 0.4]);
    [[-1.1, -0.35], [1.06, -0.35], [-1.1, 0.31], [1.06, 0.31]].forEach(([x, z]) => add(g, "metalDark", [x, 0, z, x + 0.04, 0.72, z + 0.04]));
    for (const s of [-1, 1]) { add(g, "plank", [-1.2, 0.42, s * 0.62 - 0.14, 1.2, 0.46, s * 0.62 + 0.14]); add(g, "metalDark", [-1.1, 0, s * 0.62 - 0.02, -1.06, 0.42, s * 0.62 + 0.02]); add(g, "metalDark", [1.06, 0, s * 0.62 - 0.02, 1.1, 0.42, s * 0.62 + 0.02]); }
    // breakfast left on the trays (the doc's 1-5)
    [[-0.8, -0.15], [-0.1, 0.12], [0.6, -0.1]].forEach(([x, z]) => { add(g, "metal", [x, 0.76, z, x + 0.4, 0.78, z + 0.28]); add(g, "paintYellow", [x + 0.05, 0.78, z + 0.05, x + 0.15, 0.8, z + 0.13]); add(g, "paintGreen", [x + 0.22, 0.78, z + 0.1, x + 0.33, 0.81, z + 0.22]); });
  };
  B.supplyBoxes = (g) => {
    add(g, { all: "cardboard", front: "medBlue" }, [-0.75, 0, -0.25, -0.25, 0.4, 0.25]);      // water
    add(g, "cardboard", [-0.15, 0, -0.25, 0.35, 0.4, 0.25]);                                  // dry food
    add(g, { all: "cardboard", front: "paintYellow" }, [0.45, 0, -0.2, 0.8, 0.3, 0.2]);       // the torch and batteries
  };
  // ---- the story's own ----
  B.examBox = (g) => { add(g, "cardboard", [-0.3, 0, -0.22, 0.3, 0.36, 0.22]); add(g, "paintRed", [-0.31, 0.15, -0.23, 0.31, 0.21, 0.23]); };
  B.schoolBag = (g) => { add(g, "paintBlue", [-0.18, 0, -0.1, 0.18, 0.4, 0.1]); add(g, "paintBlack", [-0.12, 0.05, 0.1, -0.08, 0.36, 0.12]); add(g, "paintBlack", [0.08, 0.05, 0.1, 0.12, 0.36, 0.12]); add(g, "paintBlue", [-0.14, 0.05, -0.16, 0.14, 0.22, -0.1]); };
  B.papers = (g) => { [[-0.3, -0.2, 0.3], [0.1, 0.05, -0.5], [-0.05, 0.3, 1.1], [0.35, -0.25, 0.2]].forEach(([x, z, r]) => { const m = add(g, "paper", [-0.11, 0.002, -0.15, 0.11, 0.006, 0.15]); m.position.x += x; m.position.z += z; m.rotation.y = r; }); };
  B.waterCooler = (g) => { add(g, "metal", [-0.3, 0, -0.25, 0.3, 1.1, 0.25]); add(g, "paintBlue", [-0.2, 0.75, 0.25, -0.12, 0.82, 0.3]); add(g, "paintRed", [0.12, 0.75, 0.25, 0.2, 0.82, 0.3]); add(g, "metalDark", [-0.24, 0.5, 0.2, 0.24, 0.53, 0.32]); };
  B.trashBin = (g) => { add(g, "paintGreen", [-0.22, 0, -0.22, 0.22, 0.7, 0.22]); add(g, "paintGreen", [-0.24, 0.7, -0.24, 0.24, 0.76, 0.24]); };
  B.cone = (g) => { add(g, "paintOrange", [-0.2, 0, -0.2, 0.2, 0.05, 0.2]); add(g, "paintOrange", [-0.12, 0.05, -0.12, 0.12, 0.3, 0.12]); add(g, "paintWhite", [-0.1, 0.3, -0.1, 0.1, 0.4, 0.1]); add(g, "paintOrange", [-0.07, 0.4, -0.07, 0.07, 0.6, 0.07]); };
  B.bench = (g) => { add(g, "plank", [-0.9, 0.42, -0.18, 0.9, 0.47, 0.18]); add(g, "concrete", [-0.8, 0, -0.15, -0.6, 0.42, 0.15]); add(g, "concrete", [0.6, 0, -0.15, 0.8, 0.42, 0.15]); };
  // ---- outdoors ----
  B.tree = (g) => {
    add(g, { side: "logSide", top: "logTop" }, [-0.25, 0, -0.25, 0.25, 3, 0.25]);
    [[-1, 2, -1, 2, 4, 2], [-1.5, 2.5, -0.5, -0.5, 3.5, 1], [0.5, 2.5, -1.5, 1.5, 3.5, -0.5], [-0.5, 4, -0.5, 0.5, 5, 0.5], [0.5, 3.2, 0.5, 1.4, 4.1, 1.4]].forEach((b) => add(g, "leaves", b, { mode: "meter" }));
  };
  B.flagpole = (g) => {
    add(g, "concrete", [-0.5, 0, -0.5, 0.5, 0.3, 0.5]);
    add(g, "metal", [-0.05, 0.3, -0.05, 0.05, 8, 0.05]);
    add(g, "paintYellow", [-0.08, 8, -0.08, 0.08, 8.12, 0.08]);
    g.add(flag());
  };
  // the flag of Thailand, its own small texture: red, white, blue twice as wide, white, red (1:1:2:1:1), 3:2
  let flagTex = null;
  function flag() {
    if (!flagTex) {
      const c = document.createElement("canvas"); c.width = 18; c.height = 12;
      const x = c.getContext("2d");
      [[0, 2, "#a51931"], [2, 2, "#f4f5f8"], [4, 4, "#2d2a4a"], [8, 2, "#f4f5f8"], [10, 2, "#a51931"]].forEach(([y, h, col]) => { x.fillStyle = col; x.fillRect(0, y, 18, h); });
      flagTex = new THREE.CanvasTexture(c);
      flagTex.magFilter = THREE.NearestFilter; flagTex.minFilter = THREE.LinearFilter; flagTex.generateMipmaps = false;
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.02), new THREE.MeshLambertMaterial({ map: flagTex }));
    m.position.set(0.8, 7.4, 0);
    return m;
  }
  B.stage = (g) => {
    add(g, { all: "concrete", top: "wood", front: "creamBase" }, [-3, 0, -1.5, 3, 1, 1.5], { mode: "meter" });
    add(g, "curtain", [-3, 1, -1.5, 3, 4, -1.3], { mode: "meter" });
    add(g, "woodDark", [-3.2, 1, -1.5, -3, 4.3, -1.2]); add(g, "woodDark", [3, 1, -1.5, 3.2, 4.3, -1.2]); add(g, "woodDark", [-3.2, 4, -1.5, 3.2, 4.3, -1.2]);
    for (let i = 0; i < 3; i++) add(g, "concrete", [-0.8, 0, 1.5 + i * 0.3, 0.8, 1 - (i + 1) * 0.25, 1.8 + i * 0.3]);      // the steps
  };
  B.podium = (g) => {
    add(g, { all: "woodDark", front: "neurolex" }, [-0.32, 0, -0.25, 0.32, 1.1, 0.25]);
    add(g, "woodDark", [-0.36, 1.1, -0.3, 0.36, 1.16, 0.3]);
    add(g, "metalDark", [0.1, 1.16, 0.0, 0.13, 1.4, 0.03]);
  };
  B.guardBooth = (g) => {
    add(g, { all: "cream", bottom: "concrete" }, [-0.8, 0, -0.8, 0.8, 2.4, 0.8], { mode: "meter" });
    add(g, "roof", [-1, 2.4, -1, 1, 2.6, 1], { mode: "meter" });
    add(g, "glass", [-0.6, 1.1, 0.79, 0.6, 1.9, 0.82], { mat: "glass" });
    add(g, "frame", [-0.65, 1.05, 0.8, 0.65, 1.1, 0.84]);
    add(g, { all: "woodDark", front: "doorBottom" }, [0.81, 0, -0.4, 0.84, 1, 0.4]); add(g, { all: "woodDark", front: "doorTop" }, [0.81, 1, -0.4, 0.84, 2, 0.4]);
  };
  B.gate = (g) => {
    add(g, "concrete", [-3.4, 0, -0.3, -3, 2.4, 0.3]); add(g, "concrete", [3, 0, -0.3, 3.4, 2.4, 0.3]);
    add(g, "metal", [-3, 1.9, -0.04, 3, 1.98, 0.04]); add(g, "metal", [-3, 0.1, -0.04, 3, 0.18, 0.04]);
    for (let x = -2.9; x < 3; x += 0.25) add(g, "metal", [x, 0.1, -0.02, x + 0.04, 1.98, 0.02]);
    const s = sign([SIGN("story.sign.school")], 3.2, { bg: 0x8a3a2e, fg: 0xf4efd8, scale: 2 }); s.position.set(0, 2.75, 0.32); g.add(s);
    add(g, "concrete", [-1.8, 2.3, 0.2, 1.8, 3.2, 0.3]);
  };
  // ---- vehicles ----
  const wheel = (g, x, z) => add(g, { all: "paintBlack", px: "tire", nx: "tire" }, [x - 0.12, 0, z - 0.35, x + 0.12, 0.7, z + 0.35]);
  B.policeCar = (g) => {
    add(g, { all: "carWhite", px: "carStripe", nx: "carStripe", bottom: "paintBlack" }, [-0.9, 0.3, -2.1, 0.9, 1.0, 2.1]);
    add(g, { all: "carWhite", px: "glass", nx: "glass", front: "glass", back: "glass" }, [-0.8, 1.0, -1.0, 0.8, 1.55, 0.9]);
    add(g, "carWhite", [-0.82, 1.55, -1.05, 0.82, 1.6, 0.95]);
    add(g, "lightBlue", [-0.55, 1.6, -0.15, -0.05, 1.75, 0.15], { mat: "glow" }); add(g, "emergency", [0.05, 1.6, -0.15, 0.55, 1.75, 0.15], { mat: "glow" });
    add(g, "headlight", [-0.75, 0.6, 2.1, -0.4, 0.8, 2.12], { mat: "glow" }); add(g, "headlight", [0.4, 0.6, 2.1, 0.75, 0.8, 2.12], { mat: "glow" });
    [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]].forEach(([x, z]) => wheel(g, x, z));
    const s = sign([SIGN("story.sign.police")], 0.9, { bg: 0x1f2f5a, fg: 0xffffff, scale: 2 }); s.position.set(0.92, 0.65, 0); s.rotation.y = Math.PI / 2; g.add(s);
  };
  B.schoolVan = (g) => {
    add(g, { all: "carWhite", bottom: "paintBlack" }, [-1, 0.3, -2.5, 1, 1.4, 2.5]);
    add(g, { all: "carWhite", px: "glass", nx: "glass", front: "glass" }, [-0.98, 1.4, -2.3, 0.98, 2.1, 2.2]);
    add(g, "paintYellow", [-1.01, 0.9, -2.45, 1.01, 1.05, 2.45]);
    add(g, "headlight", [-0.8, 0.7, 2.5, -0.45, 0.9, 2.52], { mat: "glow" }); add(g, "headlight", [0.45, 0.7, 2.5, 0.8, 0.9, 2.52], { mat: "glow" });
    [[-1, 1.7], [1, 1.7], [-1, -1.7], [1, -1.7]].forEach(([x, z]) => wheel(g, x, z));
  };

  const LIST = ["desk", "chair", "teacherDesk", "blackboard", "clock", "fan", "lamp", "bookshelf", "door", "locker", "window", "exitSign", "emergencyLight", "evacSign",
    "fireExtinguisher", "exhibitBoard", "lexaStandee", "paConsole", "medCabinet", "nurseBed", "piano", "drums", "bleachers", "vaultBox", "canteenTable", "supplyBoxes",
    "examBox", "schoolBag", "papers", "waterCooler", "trashBin", "cone", "bench", "tree", "flagpole", "stage", "podium", "guardBooth", "gate", "policeCar", "schoolVan"];
  // what stands on its own (a collider) and what is on a wall or overhead (none)
  const NO_COLLIDER = new Set(["clock", "fan", "lamp", "exitSign", "emergencyLight", "evacSign", "papers", "window", "blackboard", "fireExtinguisher"]);

  function build(id, o) {
    const g = new THREE.Group();
    g.name = "prop:" + id;
    (B[id] || B.examBox)(g, o || {});
    g.userData.prop = id;
    return g;
  }
  function place(kit, id, x, z, ry, o) {
    o = o || {};
    const g = build(id, o);
    g.position.set(x, o.y || 0, z);
    if (ry) g.rotation.y = ry;
    kit.scene.add(g);
    const w = kit.world;
    if (g.userData.moves) (w.noMerge = w.noMerge || []).push(g);
    if (o.collider !== false && !NO_COLLIDER.has(id)) {
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      if (id === "tree") { b.min.x = x - 0.3; b.max.x = x + 0.3; b.min.z = z - 0.3; b.max.z = z + 0.3; }      // (the trunk: the leaves are overhead)
      if (id === "flagpole") { b.min.x = x - 0.5; b.max.x = x + 0.5; b.min.z = z - 0.5; b.max.z = z + 0.5; }
      w.colliders.push(b);
      g.userData.collider = b;
    }
    return g;
  }

  return { LIST, NO_COLLIDER, build, place, sign, add };
})();
