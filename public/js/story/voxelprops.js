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
  // (story round 4: while a map is built, onto its shared sheet -- useAtlas)
  let sheet = null;
  function sign(lines, w, o) {
    o = o || {};
    const s = G.VoxelTex.sign(lines, sheet && o.atlas !== false ? Object.assign({ atlas: sheet }, o) : o);
    if (o.pxm) w = s.w / o.pxm;
    const h = w * (s.h / s.w), g = new THREE.Group();
    add(g, o.frame || "metalDark", [-w / 2 - 0.03, -h / 2 - 0.03, -0.04, w / 2 + 0.03, h / 2 + 0.03, 0]);
    let mat;
    if (s.uv) mat = s.atlas.mat(!!o.glow);
    else {
      mat = o.glow ? new THREE.MeshBasicMaterial({ map: s.tex }) : new THREE.MeshLambertMaterial({ map: s.tex });
      if (o.glow) mat.userData.vzGlow = "sign";
    }
    const geo = new THREE.PlaneGeometry(w, h);
    if (s.uv) { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) > 0.5 ? s.uv[2] : s.uv[0], a.getY(i) > 0.5 ? s.uv[3] : s.uv[1]); }
    const face = new THREE.Mesh(geo, mat);
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
  B.canteenTable = (g, o) => {
    add(g, "paintWhite", [-1.2, 0.72, -0.4, 1.2, 0.76, 0.4]);
    [[-1.1, -0.35], [1.06, -0.35], [-1.1, 0.31], [1.06, 0.31]].forEach(([x, z]) => add(g, "metalDark", [x, 0, z, x + 0.04, 0.72, z + 0.04]));
    for (const s of [-1, 1]) { add(g, "plank", [-1.2, 0.42, s * 0.62 - 0.14, 1.2, 0.46, s * 0.62 + 0.14]); add(g, "metalDark", [-1.1, 0, s * 0.62 - 0.02, -1.06, 0.42, s * 0.62 + 0.02]); add(g, "metalDark", [1.06, 0, s * 0.62 - 0.02, 1.1, 0.42, s * 0.62 + 0.02]); }
    // breakfast left on the trays (the doc's 1-5) -- not on the library's reading tables (story round 7: `bare`)
    if (!(o && o.bare)) [[-0.8, -0.15], [-0.1, 0.12], [0.6, -0.1]].forEach(([x, z]) => { add(g, "metal", [x, 0.76, z, x + 0.4, 0.78, z + 0.28]); add(g, "paintYellow", [x + 0.05, 0.78, z + 0.05, x + 0.15, 0.8, z + 0.13]); add(g, "paintGreen", [x + 0.22, 0.78, z + 0.1, x + 0.33, 0.81, z + 0.22]); });
  };
  // (story round 8: `only` one of the three -- "water", "food", "torch" -- the kitchen's boxes 1-5 takes one by one)
  B.supplyBoxes = (g, o) => {
    const only = o && o.only;
    if (!only || only === "water") add(g, { all: "cardboard", front: "medBlue" }, only ? [-0.25, 0, -0.25, 0.25, 0.4, 0.25] : [-0.75, 0, -0.25, -0.25, 0.4, 0.25]);   // water
    if (!only || only === "food") add(g, "cardboard", only ? [-0.25, 0, -0.25, 0.25, 0.4, 0.25] : [-0.15, 0, -0.25, 0.35, 0.4, 0.25]);                           // dry food
    if (!only || only === "torch") add(g, { all: "cardboard", front: "paintYellow" }, only ? [-0.18, 0, -0.2, 0.18, 0.3, 0.2] : [0.45, 0, -0.2, 0.8, 0.3, 0.2]); // the torch and batteries
  };
  // ---- the story's own ----
  // (story round 8) Coach Ek's stopwatch: a dark case, the face in front, the crown on top
  B.stopwatch = (g) => {
    add(g, "metalDark", [-0.06, 0, -0.018, 0.06, 0.12, 0.018]);
    add(g, { all: "metal", front: "clock" }, [-0.05, 0.01, 0.018, 0.05, 0.11, 0.024]);
    add(g, "metal", [-0.015, 0.12, -0.012, 0.015, 0.145, 0.012]);
    add(g, "paintYellow", [0.045, 0.105, -0.01, 0.07, 0.13, 0.01]);
  };
  // (story round 9) a fire extinguisher in the hands (Kru Min's: the wall's own is `fireExtinguisher`), and the
  // principal's megaphone, its mouth out along +z
  B.extinguisher = (g) => {
    add(g, { all: "paintRed", front: "fireExt" }, [-0.085, 0, -0.085, 0.085, 0.46, 0.085]);
    add(g, "paintBlack", [-0.035, 0.46, -0.035, 0.035, 0.53, 0.035]);
    add(g, "metal", [-0.02, 0.53, -0.1, 0.02, 0.56, 0.06]);
    add(g, "paintBlack", [-0.13, 0.34, 0.02, -0.095, 0.52, 0.055]); add(g, "paintBlack", [-0.13, 0.34, 0.055, -0.095, 0.375, 0.26]);
  };
  B.megaphone = (g) => {
    add(g, "paintWhite", [-0.045, -0.045, -0.12, 0.045, 0.045, 0.08]);
    add(g, "paintWhite", [-0.085, -0.085, 0.08, 0.085, 0.085, 0.17]);
    add(g, "paintRed", [-0.125, -0.125, 0.17, 0.125, 0.125, 0.24]);
    add(g, "metalDark", [-0.1, -0.1, 0.24, 0.1, 0.1, 0.245]);
    add(g, "paintBlack", [-0.02, -0.17, -0.06, 0.02, -0.045, 0.0]);
  };
  B.examBox = (g) => { add(g, "cardboard", [-0.3, 0, -0.22, 0.3, 0.36, 0.22]); add(g, "paintRed", [-0.31, 0.15, -0.23, 0.31, 0.21, 0.23]); };
  B.schoolBag = (g) => { add(g, "paintBlue", [-0.18, 0, -0.1, 0.18, 0.4, 0.1]); add(g, "paintBlack", [-0.12, 0.05, 0.1, -0.08, 0.36, 0.12]); add(g, "paintBlack", [0.08, 0.05, 0.1, 0.12, 0.36, 0.12]); add(g, "paintBlue", [-0.14, 0.05, -0.16, 0.14, 0.22, -0.1]); };
  // (story round 5) the exam's LexiLens glasses, folded on a desk: a dark frame, the lenses' blue
  B.lexiLens = (g) => {
    add(g, "metalDark", [-0.075, 0.0, -0.012, 0.075, 0.014, 0.012]);
    add(g, "lightBlue", [-0.068, 0.014, -0.006, -0.008, 0.044, 0.006], { mat: "glow" });
    add(g, "lightBlue", [0.008, 0.014, -0.006, 0.068, 0.044, 0.006], { mat: "glow" });
    add(g, "metalDark", [-0.075, 0.044, -0.012, 0.075, 0.052, 0.012]);
    add(g, "metalDark", [-0.078, 0.0, -0.012, -0.072, 0.012, 0.13]); add(g, "metalDark", [0.072, 0.0, -0.012, 0.078, 0.012, 0.13]);
  };
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

  // ---- (story round 4) the chapter's map ----
  // a desk and its chair in one, for rooms full of them (fewer pieces than the two apart)
  B.deskSet = (g) => {
    add(g, "plank", [-0.3, 0.7, -0.22, 0.3, 0.74, 0.22]);
    add(g, "metalDark", [-0.27, 0, -0.19, -0.24, 0.7, 0.19]); add(g, "metalDark", [0.24, 0, -0.19, 0.27, 0.7, 0.19]);
    add(g, "plank", [-0.2, 0.43, 0.35, 0.2, 0.46, 0.73]); add(g, "plank", [-0.2, 0.62, 0.73, 0.2, 0.86, 0.76]);
    add(g, "metalDark", [-0.18, 0, 0.37, 0.18, 0.43, 0.4]); add(g, "metalDark", [-0.18, 0, 0.7, 0.18, 0.62, 0.73]);
  };
  B.shelf = (g, o) => {
    const w = (o && o.w) || 1.2;
    add(g, "metal", [-w / 2, 0, -0.25, -w / 2 + 0.05, 1.9, 0.25]); add(g, "metal", [w / 2 - 0.05, 0, -0.25, w / 2, 1.9, 0.25]);
    [0.1, 0.65, 1.2, 1.75].forEach((y) => add(g, "metal", [-w / 2, y, -0.25, w / 2, y + 0.04, 0.25]));
    add(g, "cardboard", [-w / 2 + 0.1, 0.14, -0.2, -w / 2 + 0.5, 0.44, 0.15]); add(g, "paintBlue", [0.0, 0.69, -0.15, 0.3, 0.95, 0.15]); add(g, "cardboard", [-0.2, 1.24, -0.2, 0.35, 1.5, 0.18]);
  };
  B.counter = (g, o) => {
    const w = (o && o.w) || 3;
    add(g, { all: "woodDark", front: "paintWhite" }, [-w / 2, 0, -0.3, w / 2, 0.95, 0.3]);
    add(g, "metal", [-w / 2 - 0.02, 0.95, -0.34, w / 2 + 0.02, 1.0, 0.34]);
  };
  B.cabinet = (g) => { add(g, { all: "metalDark", front: "metal" }, [-0.25, 0, -0.3, 0.25, 1.3, 0.3]); [0.35, 0.75, 1.1].forEach((y) => add(g, "paintBlack", [-0.06, y, 0.3, 0.06, y + 0.03, 0.32])); };
  B.sink = (g) => { add(g, "paintWhite", [-0.3, 0.75, -0.25, 0.3, 0.9, 0.25]); add(g, "metal", [-0.03, 0.9, -0.2, 0.03, 1.1, -0.12]); add(g, "metalDark", [-0.08, 0, -0.08, 0.08, 0.75, 0.08]); };
  B.stall = (g) => { add(g, "paintGrey", [-0.55, 0, -0.03, 0.55, 2.0, 0.03]); add(g, "paintGrey", [-0.03, 0, 0, 0.03, 2.0, 1.4]); };
  B.plant = (g) => { add(g, "paintOrange", [-0.2, 0, -0.2, 0.2, 0.35, 0.2]); add(g, "leaves", [-0.32, 0.35, -0.32, 0.32, 0.95, 0.32]); };
  B.vent = (g) => { add(g, { all: "paintWhite", front: "corrugated" }, [-0.5, 2.5, -0.08, 0.5, 2.8, 0]); };
  B.photo = (g) => {
    // the janitor's photographs with the students, year by year (the doc's 1-1): frames of colour
    [[-0.5, 1.7], [0.1, 1.75], [-0.25, 1.25], [0.4, 1.3]].forEach(([x, y], i) => { add(g, "woodDark", [x - 0.2, y - 0.15, -0.03, x + 0.2, y + 0.15, 0]); add(g, ["handmade", "paper", "handmadeB", "paper"][i], [x - 0.16, y - 0.11, 0, x + 0.16, y + 0.11, 0.01]); });
  };
  B.hoop = (g) => {
    add(g, "metalDark", [-0.08, 0, -0.08, 0.08, 3.4, 0.08]);
    add(g, "paintWhite", [-0.9, 2.9, 0.05, 0.9, 3.95, 0.1]); add(g, "paintRed", [-0.3, 3.0, 0.1, 0.3, 3.04, 0.5]);
  };
  B.goal = (g) => {
    add(g, "paintWhite", [-3.66, 0, -0.06, -3.54, 2.44, 0.06]); add(g, "paintWhite", [3.54, 0, -0.06, 3.66, 2.44, 0.06]); add(g, "paintWhite", [-3.66, 2.38, -0.06, 3.66, 2.5, 0.06]);
    add(g, "paintGrey", [-3.6, 2.38, -1.6, 3.6, 2.42, 0.0]);
  };
  // a run of fence (o.len metres along x): posts and rails, waist high
  B.fence = (g, o) => {
    const len = (o && o.len) || 6;
    add(g, "metal", [-len / 2, 0.95, -0.03, len / 2, 1.02, 0.03]); add(g, "metal", [-len / 2, 0.45, -0.03, len / 2, 0.52, 0.03]);
    for (let x = -len / 2; x <= len / 2 + 1e-6; x += 2) add(g, "metalDark", [x - 0.05, 0, -0.05, x + 0.05, 1.1, 0.05]);
  };
  B.lampPost = (g) => { add(g, "metalDark", [-0.08, 0, -0.08, 0.08, 4.2, 0.08]); add(g, "metalDark", [-0.08, 4.1, -0.08, 0.08, 4.2, 0.7]); add(g, "lamp", [-0.15, 3.95, 0.45, 0.15, 4.1, 0.75], { mat: "glow" }); };
  // a sign on a wall: o.key (a string, read in English) or o.text / o.lines; o.bg its
  // colour; o.h its height over the floor (o.y is where place() stands it)
  B.wallSign = (g, o) => {
    o = o || {};
    const lines = [].concat(o.lines || (o.key ? SIGN(o.key) : o.text || ""));
    const s = sign(lines, o.w || 1.2, { bg: o.bg != null ? o.bg : 0x1f3a6b, fg: o.fg, scale: 2, pxm: o.pxm });
    s.position.set(0, o.h != null ? o.h : 1.7, 0.01);
    g.add(s);
  };
  // a door's frame (merged with the room) and, apart, its leaf (it swings: js/story/ch1map.js)
  B.doorFrame = (g, o) => {
    const h = ((o && o.w) || 1) / 2;
    add(g, "woodDark", [-h - 0.08, 0, -0.1, -h, 2.08, 0.1]); add(g, "woodDark", [h, 0, -0.1, h + 0.08, 2.08, 0.1]); add(g, "woodDark", [-h - 0.08, 2.0, -0.1, h + 0.08, 2.08, 0.1]);
    if (o && o.label) { const s = sign(String(o.label), 0.36, { bg: 0x1f3a6b, scale: 2 }); s.position.set(0, 2.25, 0.11); g.add(s); const s2 = sign(String(o.label), 0.36, { bg: 0x1f3a6b, scale: 2 }); s2.position.set(0, 2.25, -0.11); s2.rotation.y = Math.PI; g.add(s2); }
  };
  B.doorLeaf = (g, o) => {
    const glass = o && o.glass, w = (o && o.w) || 1;
    // (hinged at its left edge: the group's origin; the leaf reaches +x)
    if (glass) { add(g, "metal", [0, 0, -0.03, 0.06, 2, 0.03]); add(g, "metal", [w - 0.06, 0, -0.03, w, 2, 0.03]); add(g, "metal", [0, 1.94, -0.03, w, 2, 0.03]); add(g, "metal", [0, 0, -0.03, w, 0.1, 0.03]); add(g, "glass", [0.06, 0.1, -0.01, w - 0.06, 1.94, 0.01], { mat: "glass" }); add(g, "paintRed", [0.06, 1.0, 0.02, w - 0.06, 1.06, 0.035]); return; }
    add(g, { all: "woodDark", front: "doorBottom", back: "doorBottom" }, [0, 0, -0.04, w, 1, 0.04]);
    add(g, { all: "woodDark", front: "doorTop", back: "doorTop" }, [0, 1, -0.04, w, 2, 0.04]);
  };

  const LIST = ["desk", "chair", "teacherDesk", "blackboard", "clock", "fan", "lamp", "bookshelf", "door", "locker", "window", "exitSign", "emergencyLight", "evacSign",
    "fireExtinguisher", "exhibitBoard", "lexaStandee", "paConsole", "medCabinet", "nurseBed", "piano", "drums", "bleachers", "vaultBox", "canteenTable", "supplyBoxes",
    "examBox", "schoolBag", "papers", "waterCooler", "trashBin", "cone", "bench", "tree", "flagpole", "stage", "podium", "guardBooth", "gate", "policeCar", "schoolVan"];
  // (round 4: the map's own, not in the gallery's list)
  const MORE = ["deskSet", "shelf", "counter", "cabinet", "sink", "stall", "plant", "vent", "photo", "hoop", "goal", "fence", "lampPost", "wallSign", "doorFrame", "doorLeaf", "lexiLens", "stopwatch", "extinguisher", "megaphone"];
  // what stands on its own (a collider) and what is on a wall or overhead (none)
  const NO_COLLIDER = new Set(["clock", "fan", "lamp", "exitSign", "emergencyLight", "evacSign", "papers", "window", "blackboard", "fireExtinguisher",
    "vent", "photo", "wallSign", "doorFrame", "doorLeaf", "hoop", "goal", "lampPost", "lexiLens", "stopwatch", "extinguisher", "megaphone"]);

  function build(id, o) {
    const g = new THREE.Group();
    g.name = "prop:" + id;
    (B[id] || B.examBox)(g, o || {});
    g.userData.prop = id;
    return g;
  }
  // (story round 4) a prop of one look built once, then cloned -- its geometry
  // shared: a map's 360 desks were 4 800 boxes built one by one, most of its
  // build time. Not what moves (a fan's blades: its userData holds them).
  // Emptied with each new sheet of signs (useAtlas): a map's own.
  const made = new Map();
  const PLACING = { y: 1, still: 1, collider: 1, colY0: 1 };
  function make(id, o) {
    const k = id + "|" + JSON.stringify(o, (key, v) => (PLACING[key] ? undefined : v));
    let t = made.get(k);
    if (!t) { t = build(id, o); if (t.userData.moves) return t; made.set(k, t); }
    return t.clone();
  }
  function place(kit, id, x, z, ry, o) {
    o = o || {};
    const g = make(id, o);
    g.position.set(x, o.y || 0, z);
    if (ry) g.rotation.y = ry;
    kit.scene.add(g);
    const w = kit.world;
    // (o.still: a fan in a room nobody looks into stays still, and merges with the room)
    if (g.userData.moves && !o.still) (w.noMerge = w.noMerge || []).push(g);
    if (o.still) g.userData.spin = null;
    if (o.collider !== false && !NO_COLLIDER.has(id)) {
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      if (id === "tree") { b.min.x = x - 0.3; b.max.x = x + 0.3; b.min.z = z - 0.3; b.max.z = z + 0.3; }      // (the trunk: the leaves are overhead)
      if (id === "flagpole") { b.min.x = x - 0.5; b.max.x = x + 0.5; b.min.z = z - 0.5; b.max.z = z + 0.5; }
      // (story round 7: `colY0` -- only its top is in the way, from that height: a reading table a
      // Crawler goes under; the player's box, and a round, still meet its top)
      if (o.colY0 != null) b.min.y = (o.y || 0) + o.colY0;
      w.colliders.push(b);
      g.userData.collider = b;
    }
    return g;
  }

  // a map's sheet of signs (G.VoxelTex.atlas) while it is built; null after
  const useAtlas = (a) => { sheet = a || null; made.clear(); };
  return { LIST, MORE, NO_COLLIDER, build, place, sign, add, useAtlas };
})();
