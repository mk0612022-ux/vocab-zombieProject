// ===================================================================
// Chapter 1's map: the school, built of blocks (story series, round 4)
// -------------------------------------------------------------------
// Design doc: a three-storey cream school with long corridors (a central one
// here, rooms both sides), the flag yard in front with its stage, the gate
// with the guard's booth, the football field by the gate, the gym and the car
// park behind. Its rooms are where the scenes need them, and floor 2 is laid
// out exactly as Kru Min's directions say (the chapter teaches by them):
//
//   3F  301-310 off the long corridor, 305 (the exam) west of the main stairs
//       (behind glass fire doors), the janitor's room, the east stairs at the
//       corridor's east end, the toilets
//   2F  coming from the east stairs: the science room and the language lab,
//       a storeroom, the main stairs, 201-207, the staff room, and at the end
//       of the corridor the music room -- next to the staff room -- with the
//       library opposite it; the library's back door opens by the back stairs;
//       the west wing runs north to the nurse's room at its end (under 30 m)
//   1F  the canteen in the west wing, the kitchen behind its counter (its back
//       door: the walkway to the gym, the only way to the car park), the
//       entrance hall, the admin office next to the PR room, looking out on
//       the flag yard
//
// How it is built: each storey's footprint is filled solid with wall blocks,
// then rooms, corridors, stairwells and doorways are carved out of it (every
// wall between two rooms comes for free), windows set in the outer walls; the
// slabs between storeys carry each room's floor on top and the ceiling below.
// The building's blocks are cut into storey bands (G.Voxel.Grid band) so only
// the player's storey and the one above are drawn indoors; the grounds are a
// grid of their own, always drawn. Three switchback stairwells (main, east,
// back), each flight eight treads (0.25 m), a walkable height zone per tread.
// Regions and waypoints for the zombies' routes (and js/acoustics.js's spaces:
// C<n> corridors, STAIR_ halls, YARD_ outdoors), a block-true surface under the
// feet (world.surfaceAt: tile, wood, concrete, grass), doors that a scene opens
// or shuts, the lamps by kind for js/story/storylight.js.
//
//   G.Ch1Map.build(kit)           (js/world.js, a level whose map is "ch1")
//   world.storyMap.door(id, open) / doors / update(game) / rooms / regionOf
//   G.Ch1Map.ROOMS F MAIN WING ...   the plan, for the scenes and the tests
// ===================================================================
window.G = window.G || {};
G.StoryMaps = G.StoryMaps || {};

G.Ch1Map = (function () {
  const V = () => G.Voxel, VP = () => G.VoxelProps;
  const CFG = () => (G.CONFIG.story && G.CONFIG.story.voxel) || {};
  const MAP_CHUNK = () => CFG().mapChunk || 32;
  // the grounds: chunks and merge cells of this size (seen whole from anywhere outdoors)
  const SITE_CHUNK = () => CFG().siteChunk || 64;
  // which rows of blocks are colliders (see the build): a storey's rows 0 and 1
  const SOLID_HOUSE = (y) => y >= 0 && y < 11 && (y % 4 === 0 || y % 4 === 1);
  const SOLID_SITE = (y) => y === 0 || y === 1;
  const F = [0, 4, 8];                                     // the storeys' floors, where one walks
  // cells: a cell c covers c .. c+1 m; these boxes' edge cells are the outer walls
  const MAIN = { x0: -40, x1: 31, z0: -10, z1: 9 };
  const WING = { x0: -52, x1: -40, z0: -28, z1: 9 };
  const COL = { A: [-39, -33], B: [-31, -25], C: [-23, -17], D: [-15, -9], E: [-7, -1], F: [1, 7], G: [9, 15], H: [17, 23] };
  const NZ = [-9, -4], SZ = [3, 8];
  const SITE = { x0: -56, x1: 72, z0: -70, z1: 59 };
  const GYM = { x0: -37, x1: -10, z0: -47, z1: -22 };
  const PARK = { x0: -44, x1: -4, z0: -66, z1: -48 };
  const YARD = { x0: -34, x1: 30, z0: 10, z1: 44 };
  const FIELD = { x0: 41, x1: 68, z0: 14, z1: 54 };
  const GATE = { x0: 26, x1: 32, z: 59 };
  const STAGE = { x: -9, z: 13 };                          // (its front doors' path clear: 3..5)

  // ---------------- the rooms ----------------
  const N = (c) => ({ x0: COL[c][0], x1: COL[c][1], z0: NZ[0], z1: NZ[1], side: "N" });
  const S = (c) => ({ x0: COL[c][0], x1: COL[c][1], z0: SZ[0], z1: SZ[1], side: "S" });
  const W = (z0, z1) => ({ x0: -51, x1: -46, z0, z1, side: "W" });
  const NORTH_END = { x0: -51, x1: -41, z0: -27, z1: -21, side: "NW" };
  const R = (id, k, rect, type, o) => Object.assign({ id, k, type }, rect, o || {});
  const ROOMS = [
    // the ground floor (1F)
    R("R101", 0, N("A"), "class"), R("R102", 0, N("B"), "class"), R("R103", 0, N("C"), "class"), R("R104", 0, N("D"), "class"),
    R("TEACHERS", 0, N("E"), "staff"), R("R105", 0, N("G"), "class"), R("STORE1", 0, N("H"), "store"),
    R("R106", 0, S("A"), "class"), R("R107", 0, S("B"), "class"), R("R108", 0, S("C"), "class"), R("PR", 0, S("D"), "pr", { sign: "story.sign.pr" }),
    R("ADMIN", 0, S("E"), "admin", { sign: "story.sign.admin" }), R("ENTRY", 0, S("F"), "entry", { open: true }), R("PRINCIPAL", 0, S("G"), "principal", { sign: "story.sign.principal" }), R("R109", 0, S("H"), "class"),
    R("CANTEEN", 0, { x0: -51, x1: -41, z0: -19, z1: 0, side: "X" }, "canteen", { noDoor: true }),
    R("KITCHEN", 0, Object.assign({}, NORTH_END), "kitchen", { noDoor: true }),
    // the first floor up (2F): the room signs have fallen off (the doc's 1-2) -- no plates here
    R("MUSIC", 1, N("A"), "music"), R("STAFF", 1, N("B"), "staff"), R("R201", 1, N("C"), "class"), R("R203", 1, N("D"), "class"), R("R205", 1, N("E"), "class"),
    R("STORE2", 1, N("G"), "store", { closed: true }), R("SCIENCE", 1, N("H"), "science"),
    R("LIBRARY", 1, { x0: -39, x1: -25, z0: 3, z1: 8, side: "S" }, "library", { doorX: -26, closed: true }),
    R("R202", 1, S("C"), "class"), R("R204", 1, S("D"), "class"), R("R206", 1, S("E"), "class"),
    R("LOBBY2", 1, S("F"), "lobby", { open: true }), R("R207", 1, S("G"), "class"), R("LAB", 1, S("H"), "lab"),
    R("PE", 1, W(-5, 0), "pe"), R("STOREW", 1, W(-12, -7), "store"), R("WC2", 1, W(-19, -14), "wc"), R("NURSE", 1, Object.assign({}, NORTH_END), "nurse"),
    // the top floor (3F)
    R("R301", 2, N("A"), "class"), R("R302", 2, N("B"), "class"), R("R303", 2, N("C"), "class"), R("R304", 2, N("D"), "class"), R("R305", 2, N("E"), "exam", { door2: -6 }),
    R("JANITOR", 2, N("G"), "janitor"), R("STORE3", 2, N("H"), "store"),
    R("R310", 2, S("A"), "class"), R("R309", 2, S("B"), "class"), R("R308", 2, S("C"), "class"), R("R307", 2, S("D"), "class"), R("R306", 2, S("E"), "class"),
    R("LOBBY3", 2, S("F"), "lobby", { open: true }), R("WC3", 2, S("G"), "wc"), R("STORE3S", 2, S("H"), "store"),
    R("R311", 2, W(-5, 0), "class"), R("R312", 2, W(-12, -7), "class"), R("WC3W", 2, W(-19, -14), "wc"), R("R313", 2, Object.assign({}, NORTH_END), "class"),
  ];
  // the plates on the doors: a room's number on 3F, a name on 1F (none on 2F)
  ROOMS.forEach((r) => { if (r.k === 2 && /^R3\d\d$/.test(r.id)) r.plate = r.id.slice(1); });
  function corridors(k) {
    const f = k + 1;
    if (k === 0) return [{ id: "C1W", x0: -40, x1: -9, z0: -2, z1: 1 }, { id: "C1E", x0: -8, x1: 23, z0: -2, z1: 1 }, { id: "C1L", x0: -44, x1: -41, z0: 1, z1: 8 }];
    return [{ id: "C" + f + "W", x0: -44, x1: -9, z0: -2, z1: 1 }, { id: "C" + f + "E", x0: -8, x1: 23, z0: -2, z1: 1 },
      { id: "C" + f + "N", x0: -44, x1: -41, z0: -19, z1: -3 }, { id: "C" + f + "L", x0: -44, x1: -41, z0: 2, z1: 8 }];
  }
  // the stairwells (metres): the floor's strip, flight A (from the strip up to
  // the mid landing), the mid landing, flight B (from the mid landing up to the
  // next floor's strip); `ax` the flights' axis, A rising towards `dir`
  const STAIRS = {
    M: { strip: [1, 8, -4, -3], A: [1, 4, -7, -4], mid: [1, 8, -9, -7], B: [5, 8, -7, -4], ax: "z", dir: -1, div: { x: [4, 4], z: [-7, -5] },
      door: [4.5, -2.5], corr: "E", cells: { x: [1, 7], z: [-9, -4] } },
    E: { strip: [25, 26, -3, 2], A: [26, 30, -3, -1], mid: [30, 31, -3, 2], B: [26, 30, 0, 2], ax: "x", dir: 1, div: { x: [26, 29], z: [-1, -1] },
      door: [24.5, 0], corr: "E", cells: { x: [25, 30], z: [-3, 1] } },
    B: { strip: [-46, -45, 2, 9], A: [-50, -46, 2, 5], mid: [-51, -50, 2, 9], B: [-50, -46, 6, 9], ax: "x", dir: -1, div: { x: [-50, -47], z: [5, 5] },
      door: [-44.5, 5], corr: "L", cells: { x: [-51, -46], z: [2, 8] } },
  };
  // the holes in a floor above a stairwell: its flights and mid landing
  const holeOf = (s) => ({ x0: Math.min(s.A[0], s.B[0], s.mid[0]), x1: Math.max(s.A[1], s.B[1], s.mid[1]), z0: Math.min(s.A[2], s.B[2], s.mid[2]), z1: Math.max(s.A[3], s.B[3], s.mid[3]) });

  // ---------------- blocks of their own ----------------
  // a slab: its top the floor above, its bottom the ceiling below
  function defineBlocks() {
    const B = V().BLOCKS;
    if (B.slabTerrazzo) return;
    [["slabTerrazzo", "terrazzo"], ["slabTiles", "tiles"], ["slabWood", "wood"], ["slabGreen", "tilesGreen"], ["slabConcrete", "concrete"]].forEach(([n, t]) => V().def(n, { side: "concreteDark", top: t, bottom: "ceiling" }));
    V().def("roofSlab", { side: "creamBand", top: "concreteDark", bottom: "ceiling" });
    V().def("gymRoof", { side: "metalDark", top: "corrugated", bottom: "ceiling" });
    V().def("canopy", { side: "metal", top: "corrugated", bottom: "metal" });
  }
  const FLOOR_OF = { class: "slabTiles", exam: "slabTiles", library: "slabWood", music: "slabWood", principal: "slabWood", staff: "slabTiles", wc: "slabGreen", kitchen: "slabGreen",
    store: "slabConcrete", janitor: "slabConcrete", nurse: "slabTiles", science: "slabTiles", lab: "slabTiles", pe: "slabWood", admin: "slabTiles", pr: "slabTiles",
    entry: "slabTerrazzo", lobby: "slabTerrazzo", canteen: "slabTerrazzo" };
  const SURFACE = { terrazzo: "tile", tiles: "tile", tilesGreen: "tile", wood: "wood", plank: "wood", gymFloor: "wood", woodDark: "wood", grass: "grass", grassTop: "grass", fieldLine: "grass", dirt: "dirt", sand: "dirt",
    metal: "metal", corrugated: "metal" };

  // ---------------- the build ----------------
  let state = null;
  function build(kit) {
    defineBlocks();
    const { scene, world } = kit;
    const t0 = performance.now(), parts = {};
    let tp = t0;
    const lap = (name) => { const t = performance.now(); parts[name] = Math.round(t - tp); tp = t; };
    const VPm = VP();
    world.regions = []; world.waypointNodes = {}; world.waypointEdges = {}; world.stairs = []; world.roomTypeOf = {}; world.roomNames = new Set();
    world.roomInfo = {}; world.wallWeapons = []; world.keys = []; world.spawnPoints = []; world.noMerge = world.noMerge || [];
    const st = state = { world, scene, kit, doors: {}, house: new (V().Grid)(), site: new (V().Grid)(), rooms: ROOMS, chunks: [], siteChunks: [], lamps: [],
      doorMeshes: {}, shown: {}, items: null, viewKey: "", atlas: G.VoxelTex.atlas(1024, 1024) };
    // every sign of the map on one sheet (one material: the merge bakes them together)
    VPm.useAtlas(st.atlas);
    const house = st.house, site = st.site;
    const region = (name, y, x0, x1, z0, z1, type) => {
      world.regions.push({ name, y, minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
      world.roomNames.add(name);
      if (type) world.roomTypeOf[name] = type;
      node(name, (x0 + x1) / 2, y, (z0 + z1) / 2);
    };
    const node = (name, x, y, z) => { world.waypointNodes[name] = { x, y, z }; world.waypointEdges[name] = world.waypointEdges[name] || []; };
    const link = (a, b) => { if (!world.waypointEdges[a] || !world.waypointEdges[b]) return; if (!world.waypointEdges[a].includes(b)) world.waypointEdges[a].push(b); if (!world.waypointEdges[b].includes(a)) world.waypointEdges[b].push(a); };
    const zone = (x0, x1, z0, z1, h) => world.heightZones.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, height: h });
    st.link = link;
    const P = (id, x, z, ry, o) => VPm.place(kit, id, x, z, ry, o);
    const lamp = (x, y, z, kind, color, base, mode) => {
      const l = kit.addLight(x, y, z, color, base, 1.4);
      l.userData.kind = kind; if (mode) l.userData.mode = mode;
      st.lamps.push(l);
      return l;
    };

    // ================= the building =================
    const inFoot = (x, z) => (x >= MAIN.x0 && x <= MAIN.x1 && z >= MAIN.z0 && z <= MAIN.z1) || (x >= WING.x0 && x <= WING.x1 && z >= WING.z0 && z <= WING.z1);
    st.inFoot = inFoot;
    const each = (b, fn) => { for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) fn(x, z); };
    const inMain = (x, z) => x >= MAIN.x0 && x <= MAIN.x1 && z >= MAIN.z0 && z <= MAIN.z1;
    const footCells = (fn) => { each(MAIN, fn); each(WING, (x, z) => { if (!inMain(x, z)) fn(x, z); }); };
    const wallRow = (r) => (r === 0 ? "creamBase" : r === 2 ? "creamBand" : "cream");
    for (let k = 0; k < 3; k++) {
      const y0 = F[k];
      // the slab under this storey (k = 0: the ground floor's own floor)
      footCells((x, z) => house.set(x, y0 - 1, z, "slabConcrete"));
      // solid walls everywhere on the storey, then carved
      footCells((x, z) => { for (let r = 0; r < 3; r++) house.set(x, y0 + r, z, wallRow(r)); });
      const carve = (x0, x1, z0, z1, r0, r1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let r = (r0 || 0); r <= (r1 == null ? 2 : r1); r++) house.del(x, y0 + r, z); };
      const floorOf = (x0, x1, z0, z1, blk) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) house.set(x, y0 - 1, z, blk); };
      corridors(k).forEach((c) => { carve(c.x0, c.x1, c.z0, c.z1); floorOf(c.x0, c.x1, c.z0, c.z1, "slabTerrazzo"); });
      ROOMS.filter((r) => r.k === k).forEach((r) => { carve(r.x0, r.x1, r.z0, r.z1); floorOf(r.x0, r.x1, r.z0, r.z1, FLOOR_OF[r.type] || "slabTiles"); });
      Object.keys(STAIRS).forEach((id) => { const c = STAIRS[id].cells; carve(c.x[0], c.x[1], c.z[0], c.z[1]); floorOf(c.x[0], c.x[1], c.z[0], c.z[1], "slabConcrete"); });
      // rooms open to the corridor: the entrance hall, the lobbies
      ROOMS.filter((r) => r.k === k && r.open).forEach((r) => carve(r.x0, r.x1, 2, 2));
      // the main stairs: open to the ground floor's corridor; behind glass on the floors above
      if (k === 0) carve(1, 7, -3, -3);
      else { for (let x = 1; x <= 7; x++) for (let r = 0; r < 3; r++) house.set(x, y0 + r, -3, "glass"); carve(3, 5, -3, -3, 0, 1); }
      // the east and back stairs' doorways (2 wide); the library's back door
      carve(24, 24, -1, 0, 0, 1);
      carve(-45, -45, 4, 5, 0, 1);
      if (k === 1) carve(-40, -40, 5, 5, 0, 1);
      // the ground floor's own: the front doors, the canteen's counter and kitchen door, the kitchen's back door
      if (k === 0) {
        carve(3, 5, 9, 9, 0, 1); for (let x = 3; x <= 5; x++) house.set(x, y0 + 2, 9, "glass");
        carve(-48, -46, -20, -20, 1, 2); carve(-43, -43, -20, -20, 0, 1);
        carve(-40, -40, -25, -24, 0, 1);
        // the canteen opens on the lobby by the back stairs, and on the corridor
        carve(-44, -41, 1, 1);
      }
      // room doors in the corridor walls
      ROOMS.filter((r) => r.k === k && !r.open && !r.noDoor).forEach((r) => {
        const d = doorCellOf(r);
        for (let i = 0; i < d.w; i++) carve(d.axis === "x" ? d.x + i : d.x, d.axis === "x" ? d.x + i : d.x, d.axis === "z" ? d.z + i : d.z, d.axis === "z" ? d.z + i : d.z, 0, 1);
        // (story round 5) a second door at the room's front (305's: the one that jams, the doc's prologue)
        if (r.door2 != null) carve(r.door2, r.door2, d.z, d.z, 0, 1);
      });
      // windows in the outer walls: a pair of 2 m panes in every room
      ROOMS.filter((r) => r.k === k).forEach((r) => windowsOf(r, (x, z, rr) => house.set(x, y0 + rr, z, "glass")));
      // the stairwells' windows; the lobbies' glass fronts
      for (let x = 2; x <= 6; x++) for (let rr = 1; rr <= 2; rr++) house.set(x, y0 + rr, MAIN.z0, "glass");
      for (let z = -2; z <= 0; z++) for (let rr = 1; rr <= 2; rr++) house.set(MAIN.x1, y0 + rr, z, "glass");
      for (let z = 3; z <= 7; z++) for (let rr = 1; rr <= 2; rr++) house.set(WING.x0, y0 + rr, z, "glass");
      if (k > 0) for (let x = 1; x <= 7; x++) for (let rr = 1; rr <= 2; rr++) house.set(x, y0 + rr, MAIN.z1, "glass");
      // the wing corridor's east windows (and the canteen's, below)
      for (let z = -19; z <= -11; z++) if ((z + 19) % 4 !== 3) for (let rr = 1; rr <= 2; rr++) house.set(WING.x1, y0 + rr, z, "glass");
      // the stairwells' dividers, the whole height
      Object.keys(STAIRS).forEach((id) => { const d = STAIRS[id].div; for (let x = d.x[0]; x <= d.x[1]; x++) for (let z = d.z[0]; z <= d.z[1]; z++) for (let r = 0; r < 3; r++) house.set(x, y0 + r, z, "cream"); });
      // the holes in this storey's floor over the stairs below
      if (k > 0) Object.keys(STAIRS).forEach((id) => {
        const h = holeOf(STAIRS[id]);
        for (let x = Math.floor(h.x0); x < Math.ceil(h.x1); x++) for (let z = Math.floor(h.z0); z < Math.ceil(h.z1); z++) {
          const d = STAIRS[id].div;
          if (x >= d.x[0] && x <= d.x[1] && z >= d.z[0] && z <= d.z[1]) continue;
          house.del(x, y0 - 1, z);
        }
      });
    }
    // the roof and its parapet
    footCells((x, z) => house.set(x, 11, z, "roofSlab"));
    footCells((x, z) => { const edge = !inFoot(x - 1, z) || !inFoot(x + 1, z) || !inFoot(x, z - 1) || !inFoot(x, z + 1); if (edge) house.set(x, 12, z, "creamBand"); });
    // the stairwells' dividers through the slabs too (the holes left them)
    Object.keys(STAIRS).forEach((id) => { const d = STAIRS[id].div; for (let x = d.x[0]; x <= d.x[1]; x++) for (let z = d.z[0]; z <= d.z[1]; z++) [3, 7].forEach((y) => house.set(x, y, z, "cream")); });

    // ================= the grounds =================
    const inBox = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
    for (let x = SITE.x0; x <= SITE.x1; x++) for (let z = SITE.z0; z <= SITE.z1; z++) {
      if (inFoot(x, z)) continue;
      let b = "grass";
      if (inBox(YARD, x, z)) b = "paving";
      if (inBox(PARK, x, z)) b = "asphalt";
      if (inBox(GYM, x, z)) b = "gymFloor";
      if (x >= GATE.x0 && x <= GATE.x1 && z > YARD.z1 && z <= SITE.z1) b = "asphalt";          // the gate's road
      if (x >= 34 && x <= 37 && z >= -58 && z <= SITE.z1) b = "asphalt";                       // the service road...
      if (z >= -58 && z <= -55 && x >= PARK.x1 + 1 && x <= 37) b = "asphalt";                   // ...round to the car park's back gate
      if (x >= -39 && x <= -37 && z >= -27 && z <= -22) b = "paving";                          // the walkway to the gym
      if (inBox({ x0: -39, x1: 30, z0: -21, z1: -11 }, x, z) && (x + z) % 7 !== 0 && z >= -14) b = "paving";   // the courtyard's path
      site.set(x, -1, z, b);
    }
    // the flag yard's lines (where the school lines up), the car park's bays, the field's markings
    for (let z = 24; z <= 38; z += 3) for (let x = -18; x <= 18; x++) site.set(x, -1, z, "yellowLine");
    for (let x = PARK.x0 + 2; x <= PARK.x1 - 2; x += 3) for (let z = -64; z <= -59; z++) site.set(x, -1, z, "asphaltLineZ");
    for (let x = FIELD.x0; x <= FIELD.x1; x++) { site.set(x, -1, FIELD.z0, "fieldLine"); site.set(x, -1, FIELD.z1, "fieldLine"); site.set(x, -1, 36, "fieldLine"); }
    for (let z = FIELD.z0; z <= FIELD.z1; z++) { site.set(FIELD.x0, -1, z, "fieldLineZ"); site.set(FIELD.x1, -1, z, "fieldLineZ"); }
    for (let x = FIELD.x0 - 2; x <= FIELD.x1 + 2; x++) { site.set(x, -1, FIELD.z0 - 2, "track"); site.set(x, -1, FIELD.z1 + 2, "track"); }
    for (let z = FIELD.z0 - 2; z <= FIELD.z1 + 2; z++) { site.set(FIELD.x0 - 2, -1, z, "track"); site.set(FIELD.x1 + 2, -1, z, "track"); }
    // the campus wall (2 m), the gate's gap
    for (let x = SITE.x0; x <= SITE.x1; x++) [SITE.z0, SITE.z1].forEach((z) => { if (z === SITE.z1 && x >= GATE.x0 && x <= GATE.x1) return; for (let y = 0; y < 2; y++) site.set(x, y, z, y ? "creamBand" : "concrete"); });
    for (let z = SITE.z0; z <= SITE.z1; z++) [SITE.x0, SITE.x1].forEach((x) => { for (let y = 0; y < 2; y++) site.set(x, y, z, y ? "creamBand" : "concrete"); });
    // the gym: walls of six, high windows, a corrugated roof; its doors (west: the walkway, north: the car park)
    for (let x = GYM.x0; x <= GYM.x1; x++) for (let z = GYM.z0; z <= GYM.z1; z++) {
      const edge = x === GYM.x0 || x === GYM.x1 || z === GYM.z0 || z === GYM.z1;
      if (edge) for (let y = 0; y < 6; y++) site.set(x, y, z, y === 0 ? "creamBase" : y === 5 ? "creamBand" : (y === 3 || y === 4) && ((x + z) % 5 !== 0) && !(x === GYM.x0 || x === GYM.x1) ? "glass" : "cream");
      site.set(x, 6, z, "gymRoof");
    }
    [[GYM.x0, -27], [GYM.x0, -26]].forEach(([x, z]) => { site.del(x, 0, z); site.del(x, 1, z); });
    [[-25, GYM.z0], [-24, GYM.z0]].forEach(([x, z]) => { site.del(x, 0, z); site.del(x, 1, z); });
    // the gym's locker room (Coach Ek's Sprinters come out of it)
    for (let y = 0; y < 3; y++) { for (let z = -29; z <= -23; z++) site.set(-19, y, z, wallRow(y)); for (let x = -18; x <= -11; x++) site.set(x, y, -30, wallRow(y)); }
    // (story round 8: its door two wide -- and the stands no longer across it, see outdoors())
    [-26, -25].forEach((z) => { site.del(-19, 0, z); site.del(-19, 1, z); });
    // the walkway's roof on its posts
    for (let x = -39; x <= -38; x++) for (let z = -27; z <= -22; z++) site.set(x, 3, z, "canopy");
    [[-39, -27], [-39, -22]].forEach(([x, z]) => { for (let y = 0; y < 3; y++) site.set(x, y, z, "concrete"); });
    // the car park's walls, its back gate shut; the courtyard fenced: the gym is the only way through
    const wallLine = (x0, x1, z0, z1, h) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = 0; y < h; y++) site.set(x, y, z, y ? "creamBand" : "concrete"); };
    wallLine(PARK.x0 - 1, PARK.x0 - 1, PARK.z0 - 1, PARK.z1 + 1, 2); wallLine(PARK.x0 - 1, PARK.x1 + 1, PARK.z0 - 1, PARK.z0 - 1, 2);
    wallLine(PARK.x1 + 1, PARK.x1 + 1, PARK.z0 - 1, PARK.z1 + 1, 2); wallLine(PARK.x0 - 1, GYM.x0 - 1, PARK.z1 + 1, PARK.z1 + 1, 2); wallLine(GYM.x1 + 1, PARK.x1 + 1, PARK.z1 + 1, PARK.z1 + 1, 2);
    for (let z = -58; z <= -55; z++) for (let y = 0; y < 2; y++) site.set(PARK.x1 + 1, y, z, "metal");      // the back gate, shut
    wallLine(GYM.x1 + 1, MAIN.x1, GYM.z1, GYM.z1, 2); wallLine(MAIN.x1, MAIN.x1, GYM.z1, MAIN.z0 - 1, 2);
    // the covered walkways down both sides of the flag yard: a roof on posts (cover for 1-7)
    [YARD.x0 + 4, YARD.x1 - 4].forEach((cx) => {
      for (let z = YARD.z0; z <= YARD.z1; z++) for (let x = cx - 1; x <= cx + 1; x++) site.set(x, 3, z, "canopy");
      for (let z = YARD.z0 + 2; z <= YARD.z1; z += 4) [cx - 1, cx + 1].forEach((x) => { for (let y = 0; y < 3; y++) site.set(x, y, z, "concrete"); });
    });

    lap("grid");
    // ================= meshes =================
    // (the sun first: made with the level, before the light pool -- js/story/storylight.js)
    if (G.StoryLight) G.StoryLight.attach(kit);
    // (the school in 32 m chunks, the grounds in 64 m -- a map this size in 16 m ones was
    // some 180 draw calls from the gate; G.CONFIG.story.voxel mapChunk / siteChunk)
    // (colliders: a storey's two lowest rows of blocks only -- js/game.js tests a 2.6 m box
    // from the player's floor, so a doorway's lintel, a floor slab one steps up onto from
    // the stairs or a walkway's roof must not be one; 0-2 m of wall still stops everyone)
    const CH = MAP_CHUNK();
    const hb = house.build(scene, world, { floorY: 0, band: 4, chunk: CH, solid: SOLID_HOUSE });
    const sb = site.build(scene, world, { floorY: 0, chunk: SITE_CHUNK(), solid: SOLID_SITE });
    hb.meshes.forEach((m) => { m.userData.house = true; st.chunks.push(m); });
    sb.meshes.forEach((m) => { m.userData.site = true; st.siteChunks.push(m); });
    st.stats = { houseBlocks: house.size, siteBlocks: site.size, faces: hb.faces + sb.faces, chunks: hb.meshes.length + sb.meshes.length, colliders: hb.colliders.length + sb.colliders.length, parts };
    lap("mesh");

    // ================= walking: floors, stairs =================
    zone(SITE.x0, SITE.x1 + 1, SITE.z0, SITE.z1 + 1, 0);
    const holes = Object.keys(STAIRS).map((id) => holeOf(STAIRS[id]));
    [1, 2].forEach((k) => {
      [{ x0: MAIN.x0, x1: MAIN.x1 + 1, z0: MAIN.z0, z1: MAIN.z1 + 1 }, { x0: WING.x0, x1: WING.x1, z0: WING.z0, z1: WING.z1 + 1 }].forEach((r) => rectMinus(r, holes).forEach((q) => zone(q.x0, q.x1, q.z0, q.z1, F[k])));
    });
    // the stage (west of the front doors): its top, its three steps -- up them only
    // (its sides a collider to 0.8 m: the top step's 0.75 walks on over it)
    const SX = STAGE.x;
    zone(SX - 3, SX + 3, 11.5, 14.5, 1);
    for (let i = 0; i < 3; i++) zone(SX - 0.8, SX + 0.8, 14.5 + i * 0.3, 14.8 + i * 0.3, 1 - (i + 1) * 0.25);
    world.colliders.push(new THREE.Box3(new THREE.Vector3(SX - 3, 0, 11.5), new THREE.Vector3(SX + 3, 0.8, 14.5)));
    world.colliders.push(new THREE.Box3(new THREE.Vector3(SX - 3.2, 1, 11.5), new THREE.Vector3(SX + 3.2, 4.3, 11.8)));

    lap("walk");
    // ================= regions, waypoints =================
    for (let k = 0; k < 3; k++) {
      corridors(k).forEach((c) => region(c.id, F[k], c.x0, c.x1 + 1, c.z0, c.z1 + 1));
      const cs = corridors(k);
      // the corridors' own chain
      if (k === 0) { link("C1W", "C1E"); link("C1W", "CANTEEN"); }
      else { link("C" + (k + 1) + "W", "C" + (k + 1) + "E"); link("C" + (k + 1) + "W", "C" + (k + 1) + "N"); link("C" + (k + 1) + "W", "C" + (k + 1) + "L"); }
      st.corr = st.corr || {}; st.corr[k] = cs;
    }
    ROOMS.forEach((r) => region(r.id, F[r.k], r.x0, r.x1 + 1, r.z0, r.z1 + 1, r.type === "library" ? "library" : r.type === "canteen" ? "canteen" : null));
    link("C1L", "CANTEEN"); link("C1W", "C1L");
    ROOMS.forEach((r) => {
      if (r.open) { const c = corridorAt(r.k, (r.x0 + r.x1 + 1) / 2, 1.5); if (c) link(r.id, c); return; }
      if (r.noDoor) return;
      const d = doorCellOf(r), cx = d.axis === "x" ? d.x + d.w / 2 : d.x + 0.5, cz = d.axis === "z" ? d.z + d.w / 2 : d.z + 0.5;
      const dn = "D" + r.id;
      node(dn, cx, F[r.k], cz);
      const out = outsideOf(r, d, cx, cz), c = corridorAt(r.k, out[0], out[1]);
      // (story round 6) a node a metre each side of the doorway: a zombie leaving a room heads
      // straight out through it before it turns for the corridor -- with only the doorway's own
      // node it turned while still in line with the wall and slid along its inside, back and forth
      // (the 3F toilets' Shamblers in 1-1)
      node(dn + "I", 2 * cx - out[0], F[r.k], 2 * cz - out[1]); node(dn + "O", out[0], F[r.k], out[1]);
      link(r.id, dn + "I"); link(dn + "I", dn); link(dn, dn + "O");
      if (c) link(dn + "O", c);
    });
    node("DLIBBACK", -39.5, F[1], 5.5); node("DLIBBACKI", -38.4, F[1], 5.5); node("DLIBBACKO", -40.6, F[1], 5.5);
    link("LIBRARY", "DLIBBACKI"); link("DLIBBACKI", "DLIBBACK"); link("DLIBBACK", "DLIBBACKO"); link("DLIBBACKO", "C2L");
    node("DKITCHEN", -42.5, 0, -19.5); link("KITCHEN", "DKITCHEN"); link("DKITCHEN", "CANTEEN");
    // the stairwells (after the corridors: their doorways link to them)
    Object.keys(STAIRS).forEach((id) => stairwell(st, id, kit, zone, region, node, link));
    // outdoors
    // (story round 8: the doorway and a step in front of it a place of its own, so that who comes out is clear
    // of the wall before they turn for the player)
    region("GYM_LDOOR", 0, -20, -18, -26, -24, null);
    region("GYM_LOCKER", 0, -18, -10, -29, -22, null);
    region("GYM", 0, GYM.x0 + 1, GYM.x1, GYM.z0 + 1, GYM.z1, "sports");
    region("YARD_WALK", 0, -39, -37, -28, -22);
    region("YARD_COURT", 0, -39, MAIN.x1, -21, MAIN.z0);
    region("YARD_PARK", 0, PARK.x0, PARK.x1 + 1, PARK.z0, PARK.z1 + 1);
    region("YARD_FRONT", 0, SITE.x0 + 1, SITE.x1, MAIN.z1 + 1, SITE.z1);
    region("YARD_SIDE_W", 0, SITE.x0 + 1, WING.x0, SITE.z0 + 1, MAIN.z1 + 1);
    region("YARD_SIDE_E", 0, MAIN.x1 + 1, SITE.x1, SITE.z0 + 1, MAIN.z1 + 1);
    region("YARD_NORTH", 0, PARK.x1 + 2, MAIN.x1 + 1, SITE.z0 + 1, GYM.z1);
    node("DENTRY", 4.5, 0, 9.5); link("ENTRY", "DENTRY"); link("DENTRY", "YARD_FRONT");
    node("DKITCHENB", -39.5, 0, -24); link("KITCHEN", "DKITCHENB"); link("DKITCHENB", "YARD_WALK");
    node("DGYMW", -36.5, 0, -26); link("YARD_WALK", "DGYMW"); link("DGYMW", "GYM");
    node("DGYMN", -24, 0, -46.5); link("GYM", "DGYMN"); link("DGYMN", "YARD_PARK");
    node("DLOCKER", -17.2, 0, -25); node("DLOCKERO", -20.3, 0, -25);
    link("GYM_LOCKER", "DLOCKER"); link("DLOCKER", "GYM_LDOOR"); link("GYM_LDOOR", "DLOCKERO"); link("DLOCKERO", "GYM");
    link("YARD_WALK", "YARD_COURT");
    link("YARD_FRONT", "YARD_SIDE_W"); link("YARD_FRONT", "YARD_SIDE_E"); link("YARD_SIDE_E", "YARD_NORTH");
    world.spawn = { x: 29.5, z: 55 };
    world.bossRoomCenter = new THREE.Vector3(0, 0, 22);
    [[-12, 30], [12, 30], [0, 40], [-20, 20], [20, 20]].forEach(([x, z]) => world.spawnPoints.push({ pos: new THREE.Vector3(x, 0, z), region: "YARD_FRONT" }));

    lap("regions");
    // ================= doors =================
    ROOMS.forEach((r) => {
      if (r.open || r.noDoor) return;
      const d = doorCellOf(r), cx = d.axis === "x" ? d.x + d.w / 2 : d.x + 0.5, cz = d.axis === "z" ? d.z + d.w / 2 : d.z + 0.5;
      const out = outsideOf(r, d, cx, cz);
      makeDoor(st, "D" + r.id, cx, F[r.k], cz, d.axis, d.w, { into: [cx * 2 - out[0], cz * 2 - out[1]], open: !r.closed, plate: r.plate, sign: r.k === 0 ? r.sign : null });
      // (story round 5) its front door: shut (a scene opens it, or -- 305's -- never does)
      if (r.door2 != null) { const fx = r.door2 + 0.5; makeDoor(st, "D" + r.id + "F", fx, F[r.k], cz, "x", 1, { into: [fx, cz * 2 - out[1]], open: false }); }
    });
    [1, 2].forEach((k) => makeDoor(st, "STAIRM" + (k + 1), 4.5, F[k], -2.5, "x", 3, { into: [4.5, -4], open: true, glass: true }));
    [0, 1, 2].forEach((k) => makeDoor(st, "STAIRE" + (k + 1), 24.5, F[k], 0, "z", 2, { into: [26, 0], open: true }));
    [0, 1, 2].forEach((k) => makeDoor(st, "STAIRB" + (k + 1), -44.5, F[k], 5, "z", 2, { into: [-46, 5], open: true }));
    makeDoor(st, "LIBBACK", -39.5, F[1], 5.5, "z", 1, { into: [-38, 5.5], open: true });
    makeDoor(st, "KITCHEN", -42.5, 0, -19.5, "x", 1, { into: [-42.5, -21], open: true });
    makeDoor(st, "KITCHENB", -39.5, 0, -24, "z", 2, { into: [-41, -24], open: true });
    makeDoor(st, "ENTRANCE", 4.5, 0, 9.5, "x", 3, { into: [4.5, 8], open: true, glass: true });
    makeDoor(st, "GYMW", GYM.x0 + 0.5, 0, -26, "z", 2, { into: [GYM.x0 + 2, -26], open: true });
    makeDoor(st, "GYMN", -24, 0, GYM.z0 + 0.5, "x", 2, { into: [-24, GYM.z0 + 2], open: true });
    makeDoor(st, "LOCKER", -18.5, 0, -25, "z", 2, { into: [-17, -25], open: true });
    ["s0", "s1", "s2", "out"].forEach((g) => bakeDoors(st, g));
    lap("doors");

    // ================= what is in it =================
    furnish(st, P, lamp);
    lap("furnish");
    outdoors(st, P, lamp);
    VPm.useAtlas(null);
    lap("outdoors");

    // ================= the map's own hooks =================
    world.storyMap = { door: (id, open) => setDoor(st, id, open), doors: st.doors, update: (game) => update(st, game), rooms: ROOMS, regionOf: (x, y, z) => G.getRegionAt(world, x, z, y), stats: st.stats, inFoot,
      zoneOf: (x, y, z) => zoneAt(st, x, y, z), get shown() { return st.shown; }, get mode() { return st.mode; },
      // (story round 6) a storey's plan for the evacuation sign (js/story/screen.js planSvg), and where
      // a door is (js/story/interact.js: a door the player opens by hand)
      plan: (k) => ({ rooms: ROOMS.filter((r) => r.k === k), corridors: corridors(k), stairs: STAIRS, main: MAIN, wing: WING }),
      doorInfo: (id) => { const d = st.doors[id]; return d ? { id, x: d.x, y: d.y, z: d.z, axis: d.axis, w: d.w, open: d.open } : null; } };
    world.surfaceAt = (x, z, y) => surfaceAt(st, x, z, y);
    // the light indoors (js/visuals.js footprint, per pixel on every graphics level): inside the
    // building, under its roof, only a little of the sun and the sky's light (G.StoryLight.INDOOR)
    // -- the windows and the lamps light the rooms. The gym's roof is lower than the building's,
    // so it is not one of these: js/story/storylight.js turns the sun down in there on Low
    const IN = (G.StoryLight && G.StoryLight.INDOOR) || {};
    world.lightFoot = { rects: [{ minX: MAIN.x0, maxX: MAIN.x1 + 1, minZ: MAIN.z0, maxZ: MAIN.z1 + 1 }, { minX: WING.x0, maxX: WING.x1 + 1, minZ: WING.z0, maxZ: WING.z1 + 1 }],
      roof: F[2] + 3.95, indoor: { moon: IN.sun != null ? IN.sun : 0.06, hemisphere: IN.sky != null ? IN.sky : 0.45 } };
    world.storyMap.inGym = (x, z) => x >= GYM.x0 && x <= GYM.x1 + 1 && z >= GYM.z0 && z <= GYM.z1 + 1;
    // what the level's merge bakes together: one storey's things, or the grounds' (js/perf.js
    // mergeStatic; js/zones.js leaves a map that sorts its own alone)
    world.ownZones = true;
    world.mergeCellOf = (zone) => (zone === "out" ? SITE_CHUNK() : 0);
    const bb = new THREE.Box3(), cc = new THREE.Vector3();
    world.zoneKey = (o) => {
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld).getCenter(cc);
      return zoneAt(st, cc.x, bb.min.y + 0.05, cc.z);
    };
    st.stats.signs = st.atlas.count;
    st.stats.ms = Math.round(performance.now() - t0);
    return world;
  }
  // where a thing is, for what is drawn: "s0" "s1" "s2" (a storey of the building), "out"
  function zoneAt(st, x, y, z) {
    if (!st.inFoot(Math.floor(x), Math.floor(z))) return "out";
    return y < F[1] - 1 ? "s0" : y < F[2] - 1 ? "s1" : "s2";
  }

  // ---------------- helpers of the plan ----------------
  // a room's doorway: { x, z, axis, w } (its first cell, the way it runs, how many cells)
  function doorCellOf(r) {
    if (r.side === "N") return { x: r.x1 - 1, z: -3, axis: "x", w: 1 };
    if (r.side === "S") return { x: r.doorX != null ? r.doorX : r.x1 - 1, z: 2, axis: "x", w: 1 };
    if (r.side === "W") return { x: -45, z: r.z1 - 1, axis: "z", w: 1 };
    if (r.side === "NW") return { x: -43, z: -20, axis: "x", w: 2 };
    return { x: r.x1, z: r.z1, axis: "x", w: 1 };
  }
  // just outside a doorway, on the corridor's side
  function outsideOf(r, d, cx, cz) {
    if (r.side === "N") return [cx, cz + 1];
    if (r.side === "S") return [cx, cz - 1];
    if (r.side === "W") return [cx + 1, cz];
    return [cx, cz + 1];
  }
  function corridorAt(k, x, z) {
    const c = corridors(k).find((q) => x >= q.x0 && x < q.x1 + 1 && z >= q.z0 && z < q.z1 + 1);
    return c ? c.id : null;
  }
  // a room's windows: cells in its outer wall, rows 1-2 of the storey
  function windowsOf(r, set) {
    const pane = (a0, a1, fn) => { for (let a = a0 + 1; a <= a1 - 1; a++) if ((a - a0) % 3 !== 0) for (let rr = 1; rr <= 2; rr++) fn(a, rr); };
    if (r.z0 === NZ[0] && r.side === "N") pane(r.x0, r.x1, (x, rr) => set(x, MAIN.z0, rr));
    if (r.z1 === SZ[1] && r.side === "S" && r.type !== "entry") pane(r.x0, r.x1, (x, rr) => set(x, MAIN.z1, rr));
    if (r.side === "W" || r.side === "NW" || r.side === "X") pane(r.z0, r.z1, (z, rr) => set(WING.x0, z, rr));
    if (r.side === "NW") pane(r.x0, r.x1, (x, rr) => set(x, WING.z0, rr));
    if (r.x1 === COL.H[1] && (r.side === "N" || r.side === "S")) { /* the east rooms meet the stair block, no outer wall */ }
  }
  // a rectangle with holes in it, as rectangles without
  function rectMinus(r, holes) {
    const xs = new Set([r.x0, r.x1]);
    holes.forEach((h) => { if (h.x1 > r.x0 && h.x0 < r.x1 && h.z1 > r.z0 && h.z0 < r.z1) { xs.add(Math.max(r.x0, h.x0)); xs.add(Math.min(r.x1, h.x1)); } });
    const X = Array.from(xs).sort((a, b) => a - b), out = [];
    for (let i = 0; i < X.length - 1; i++) {
      const a = X[i], b = X[i + 1], mid = (a + b) / 2;
      const cuts = holes.filter((h) => h.x0 < mid && h.x1 > mid).map((h) => [Math.max(r.z0, h.z0), Math.min(r.z1, h.z1)]).filter((c) => c[1] > c[0]).sort((p, q) => p[0] - q[0]);
      let z = r.z0;
      cuts.forEach(([c0, c1]) => { if (c0 > z) out.push({ x0: a, x1: b, z0: z, z1: c0 }); z = Math.max(z, c1); });
      if (z < r.z1) out.push({ x0: a, x1: b, z0: z, z1: r.z1 });
    }
    return out;
  }

  // ---------------- a stairwell ----------------
  // per storey: the strip's region and node; flights A and B of eight treads each
  // (the ground floor's solid down to the floor: a block of stairs; the ones above
  // thin -- each flight is 4 m over the same flight of the storey below, and the
  // player's 2.6 m box needs the room), the mid landing, and on the ground floor a
  // collider under flight B and the mid landing (nobody walks into them from the
  // floor); the top floor's strip railed over the hole
  const TREAD = 0.45, LANDING = 0.35;
  function stairwell(st, id, kit, zone, region, node, link) {
    const s = STAIRS[id], world = st.world, scene = st.scene;
    const flight = (rect, k, which) => {
      const y0 = F[k] + (which === "B" ? 2 : 0), out = [];
      // A rises towards `dir` along the axis; B the other way
      const rises = which === "A" ? s.dir : -s.dir;
      const lo = s.ax === "x" ? rect[0] : rect[2], hi = s.ax === "x" ? rect[1] : rect[3], run = (hi - lo) / 8;
      for (let i = 0; i < 8; i++) {
        const top = y0 + (i + 1) * 0.25, base = k === 0 ? F[k] : top - TREAD;
        const a = rises > 0 ? lo + i * run : hi - (i + 1) * run, b = a + run;
        const r = s.ax === "x" ? [a, b, rect[2], rect[3]] : [rect[0], rect[1], a, b];
        zone(r[0], r[1], r[2], r[3], top);
        const m = V().box({ side: "concreteDark", top: "terrazzo" }, r[1] - r[0], top - base, r[3] - r[2]);
        m.position.set((r[0] + r[1]) / 2, (base + top) / 2, (r[2] + r[3]) / 2);
        scene.add(m);
        out.push(m);
      }
      return out;
    };
    for (let k = 0; k < 3; k++) {
      const f = k + 1, nm = "STAIR_" + id + f;
      const sr = s.strip;
      region(nm, F[k], sr[0], sr[1], sr[2], sr[3]);
      zone(sr[0], sr[1], sr[2], sr[3], F[k]);
      // its doorway (the main stairs on the ground floor: open to the corridor)
      const corr = "C" + f + s.corr;
      if (id === "M" && k === 0) link(nm, corr);
      else { node("DSTAIR_" + id + f, s.door[0], F[k], s.door[1]); link(nm, "DSTAIR_" + id + f); link("DSTAIR_" + id + f, corr); }
      if (k === 2) {
        // the top: a rail over the hole on flight A's side
        const A = s.A, r = s.ax === "x" ? [s.dir > 0 ? A[0] - 0.06 : A[1] - 0.06, s.dir > 0 ? A[0] + 0.06 : A[1] + 0.06, A[2], A[3]] : [A[0], A[1], s.dir > 0 ? A[2] - 0.06 : A[3] - 0.06, s.dir > 0 ? A[2] + 0.06 : A[3] + 0.06];
        const rail = V().box("metal", r[1] - r[0], 1.1, r[3] - r[2]);
        rail.position.set((r[0] + r[1]) / 2, F[k] + 0.55, (r[2] + r[3]) / 2);
        scene.add(rail);
        world.colliders.push(new THREE.Box3(new THREE.Vector3(r[0], F[k], r[2]), new THREE.Vector3(r[1], F[k] + 1.1, r[3])));
        continue;
      }
      flight(s.A, k, "A");
      flight(s.B, k, "B");
      const md = s.mid;
      zone(md[0], md[1], md[2], md[3], F[k] + 2);
      const mh = k === 0 ? 2 : LANDING;
      const mm = V().box({ side: "concreteDark", top: "terrazzo" }, md[1] - md[0], mh, md[3] - md[2]);
      mm.position.set((md[0] + md[1]) / 2, F[k] + 2 - mh / 2, (md[2] + md[3]) / 2);
      scene.add(mm);
      if (k === 0) [s.B, md].forEach((q) => world.colliders.push(new THREE.Box3(new THREE.Vector3(q[0], F[k], q[2]), new THREE.Vector3(q[1], F[k] + 2, q[3]))));
      region(nm + "A", F[k] + 1, s.A[0], s.A[1], s.A[2], s.A[3]);
      region(nm + "M", F[k] + 2, md[0], md[1], md[2], md[3]);
      region(nm + "B", F[k] + 3, s.B[0], s.B[1], s.B[2], s.B[3]);
      const up = "STAIR_" + id + (f + 1);
      link(nm, nm + "A"); link(nm + "A", nm + "M"); link(nm + "M", nm + "B");
      // (the next storey's strip node is made on its turn; linked once both exist)
      st.pendingLinks = st.pendingLinks || [];
      st.pendingLinks.push([nm + "B", up]);
      const box = (q, y0) => new THREE.Box3(new THREE.Vector3(q[0], y0, q[2]), new THREE.Vector3(q[1], y0 + 4, q[3]));
      const exitA = s.ax === "x" ? new THREE.Vector3(s.dir, 0, 0) : new THREE.Vector3(0, 0, s.dir);
      world.stairs.push({ block: box(s.A, F[k]), y0: F[k], y1: F[k] + 2, foot: nm, top: nm + "M", nodes: [nm, nm + "A", nm + "M"], exit: exitA });
      world.stairs.push({ block: box(s.B, F[k]), y0: F[k] + 2, y1: F[k] + 4, foot: nm + "M", top: up, nodes: [nm + "M", nm + "B", up], exit: exitA.clone().multiplyScalar(-1) });
    }
    (st.pendingLinks || []).forEach(([a, b]) => link(a, b));
    // lamps on each landing
    for (let k = 0; k < 3; k++) {
      const sr = s.strip;
      const l = kit.addLight((sr[0] + sr[1]) / 2, F[k] + 2.7, (sr[2] + sr[3]) / 2, 0xe6eeff, 0.9, 1.4);
      l.userData.kind = "corridor";
      st.lamps.push(l);
    }
  }

  // ---------------- doors ----------------
  // a doorway's frame (merged with the walls) and its leaves, which swing: the
  // leaves of a storey (or of the grounds) baked into one mesh a material -- 64
  // doors at two to six boxes a leaf were some 190 draw calls on their own --
  // and baked again when one of them moves (bakeDoors); a collider while shut;
  // `into`: a point in the room it opens into
  function makeDoor(st, id, cx, y, cz, axis, w, o) {
    const scene = st.scene, world = st.world, VPm = VP();
    const ry = axis === "x" ? 0 : -Math.PI / 2;
    const frame = VPm.build("doorFrame", { w, label: o.plate || null });
    frame.position.set(cx, y, cz); frame.rotation.y = ry;
    scene.add(frame);
    // which side of the wall the room is: its local +z (s = 1) or -z
    const lz = axis === "x" ? o.into[1] - cz : -(o.into[0] - cx);
    const s = lz >= 0 ? 1 : -1;
    // a name over the door, on the corridor's side (the wall's face, half a block out)
    if (o.sign) {
      const sg = VPm.build("wallSign", { key: o.sign, w: 1.1, h: 2.45, pxm: 160 });
      const off = new THREE.Vector3(0, 0, -s * 0.52).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      sg.position.set(cx + off.x, y, cz + off.z); sg.rotation.y = ry + (s > 0 ? Math.PI : 0);
      scene.add(sg);
    }
    const leaves = [], holders = [], n = w === 1 ? 1 : 2, lw = w / n;
    for (let i = 0; i < n; i++) {
      const hinge = new THREE.Group();
      const leaf = VPm.build("doorLeaf", { w: lw, glass: !!o.glass });
      hinge.add(leaf);
      // (local frame of the doorway: +x along it; the left leaf hinged at -w/2, the right at +w/2 turned round)
      const lx = i === 0 ? -w / 2 : w / 2;
      const holder = new THREE.Group();
      holder.position.set(cx, y, cz); holder.rotation.y = ry;
      hinge.position.set(lx, 0, 0);
      hinge.userData.base = i === 0 ? 0 : Math.PI;
      hinge.userData.open = i === 0 ? -s * Math.PI / 2 : Math.PI + s * Math.PI / 2;
      holder.add(hinge);
      holders.push(holder);            // (never in the scene: only what bakeDoors reads)
      leaves.push(hinge);
    }
    const shut = axis === "x" ? new THREE.Box3(new THREE.Vector3(cx - w / 2, y, cz - 0.25), new THREE.Vector3(cx + w / 2, y + 2.1, cz + 0.25))
      : new THREE.Box3(new THREE.Vector3(cx - 0.25, y, cz - w / 2), new THREE.Vector3(cx + 0.25, y + 2.1, cz + w / 2));
    const collider = shut.clone();
    collider.dynamic = true;
    world.colliders.push(collider);
    const group = st.inFoot(Math.floor(cx), Math.floor(cz)) ? "s" + F.indexOf(y) : "out";
    const d = { id, leaves, holders, collider, shut, open: null, y, x: cx, z: cz, axis, w, group };
    st.doors[id] = d;
    setDoor(st, id, o.open !== false, true);
    return d;
  }
  function setDoor(st, id, open, noBake) {
    const d = st && st.doors[id];
    if (!d) return false;
    open = !!open;
    if (d.open === open) return true;
    d.open = open;
    d.leaves.forEach((h) => { h.rotation.y = open ? h.userData.open : h.userData.base; });
    if (open) d.collider.makeEmpty(); else d.collider.copy(d.shut);
    if (!noBake) bakeDoors(st, d.group);
    return true;
  }
  // a group's leaves ("s0" "s1" "s2" "out") into one mesh a material; the meshes
  // are kept and given new geometry (whatever the quality's look has done to
  // their materials stays), drawn or not as the group is (update below)
  function bakeDoors(st, group) {
    const byMat = new Map();
    Object.keys(st.doors).forEach((id) => {
      const d = st.doors[id];
      if (d.group !== group) return;
      d.holders.forEach((h) => {
        h.updateMatrixWorld(true);
        h.traverse((m) => { if (m.isMesh) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); } });
      });
    });
    const have = st.doorMeshes[group] || (st.doorMeshes[group] = new Map());
    have.forEach((mesh, mat) => { if (!byMat.has(mat)) { mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry(); } });
    byMat.forEach((list, mat) => {
      const geo = bakeGeo(list);
      let mesh = have.get(mat);
      if (mesh) { mesh.geometry.dispose(); mesh.geometry = geo; return; }
      mesh = new THREE.Mesh(geo, mat);
      mesh.name = "doors:" + group;
      mesh.userData.doorGroup = group;
      mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
      mesh.visible = st.shown[group] !== false;
      st.scene.add(mesh);
      st.world.noMerge.push(mesh);
      have.set(mat, mesh);
    });
  }
  // meshes (world matrices set) into one geometry in world space: position,
  // normal, uv, and colour when every one of them has it
  function bakeGeo(list) {
    let nv = 0, ni = 0;
    const col = list.every((m) => m.geometry.attributes.color);
    list.forEach((m) => { nv += m.geometry.attributes.position.count; ni += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), c = col ? new Float32Array(nv * 3) : null;
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    list.forEach((m) => {
      const ga = m.geometry.attributes, mw = m.matrixWorld;
      nm.getNormalMatrix(mw);
      for (let i = 0; i < ga.position.count; i++) {
        v.fromBufferAttribute(ga.position, i).applyMatrix4(mw); pos.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(ga.normal, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
        if (ga.uv) uv.set([ga.uv.getX(i), ga.uv.getY(i)], (vo + i) * 2);
        if (c) c.set([ga.color.getX(i), ga.color.getY(i), ga.color.getZ(i)], (vo + i) * 3);
      }
      const ix = m.geometry.index;
      if (ix) for (let i = 0; i < ix.count; i++) idx[io + i] = ix.getX(i) + vo;
      else for (let i = 0; i < ga.position.count; i++) idx[io + i] = i + vo;
      vo += ga.position.count; io += ix ? ix.count : ga.position.count;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    if (c) g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }

  // ---------------- furniture ----------------
  function furnish(st, P, lamp) {
    const yOf = (k) => F[k];
    ROOMS.forEach((r) => {
      const y = yOf(r.k), x0 = r.x0, x1 = r.x1 + 1, z0 = r.z0, z1 = r.z1 + 1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const fixtures = (n, color) => {
        // the ceiling's lamps and a fan, still unless the room is one the player stays in
        const still = !(r.id === "R305" || r.id === "LIBRARY");
        P("fan", cx, cz, 0, { y: y - 0.6, still });
        if (n > 1) { P("lamp", cx - 2, cz, Math.PI / 2, { y: y - 0.6 }); P("lamp", cx + 2, cz, Math.PI / 2, { y: y - 0.6 }); }
        else P("lamp", cx, cz - 1.5, 0, { y: y - 0.6 });
        lamp(cx, y + 2.6, cz, "room", color || 0xe6eeff, r.type === "library" || r.type === "canteen" ? 1.2 : 1.0);
      };
      const T = r.type;
      if (T === "class" || T === "exam") {
        // the board on the west wall, desks facing it
        P("blackboard", x0 + 0.06, cz, Math.PI / 2, { y, w: 3 });
        P("teacherDesk", x0 + 1.3, cz + 1.2, Math.PI / 2, { y });
        const exam = T === "exam";
        // (as many desk columns as the room is wide: the west wing's rooms are 6 m, and their door
        // is on the east side -- keep its way clear)
        const cols = (exam ? [2.9, 4.5, 6.1] : [2.6, 3.9, 5.2, 6.4]).map((d) => x0 + d).filter((x) => x <= x1 - (r.side === "W" ? 1.6 : 0.7));
        const rows = exam ? [z0 + 1.0, z0 + 2.6, z0 + 4.2] : [z0 + 0.9, z0 + 2.4, z0 + 3.9];
        cols.forEach((x) => rows.forEach((z) => { P("deskSet", x, z, Math.PI / 2, { y }); if (exam) P("papers", x - 0.15, z, 0, { y: y + 0.745 }); }));
        P("clock", x1 - 0.06, cz, -Math.PI / 2, { y });
        if (exam) P("wallSign", x0 + 0.08, cz, Math.PI / 2, { y, h: 2.5, key: "story.sign.examTitle", w: 2.2, bg: 0x24443a });
        fixtures(2);
      } else if (T === "library") {
        // shelves along the south wall, reading tables, the sponsor's sign, the air vents over the windows
        // (story round 7: the two shelves the doors are barricaded with -- the one against the front
        // door, the one by the back door -- are the scenes' own, pushed: js/story/push.js, js/data/
        // story/ch1.js; the wall shelves stop short of the front door to leave them the room)
        for (let x = x0 + 1; x < x1 - 7; x += 2) P("bookshelf", x + 0.5, z0 + 0.25, 0, { y, w: 1 });
        // (round 7: only the tables' tops are in the way -- a Crawler goes under them, the player and a
        // round do not get through them)
        [cx - 4, cx, cx + 4].forEach((x) => { P("canteenTable", x, cz + 0.6, 0, { y, colY0: 0.68, bare: true }); });
        P("teacherDesk", x1 - 1.5, z0 + 3.2, -Math.PI / 2, { y });
        P("wallSign", cx, z0 + 0.47, 0, { y, h: 2.45, lines: [sign("story.sign.sponsorLib1"), sign("story.sign.sponsorLib2")], w: 2.6, bg: 0xf4f7fa, fg: 0x1a7ac8 });
        [cx - 4, cx + 4].forEach((x) => P("vent", x, z1 - 0.06, Math.PI, { y }));
        fixtures(2, 0xffe2b8);
        lamp(cx - 4, y + 2.6, cz, "room", 0xffe2b8, 0.9);
      } else if (T === "music") {
        P("piano", x0 + 2, z0 + 1, 0, { y }); P("drums", x1 - 2, z0 + 1.6, 0, { y });
        [x0 + 2, x0 + 3.5, x0 + 5].forEach((x) => P("chair", x, z1 - 1.5, Math.PI, { y }));
        fixtures(1);
      } else if (T === "staff") {
        // desks with their teachers' names: how the room is known (the doc's 1-2)
        const names = ["story.who.min", "story.who.ek", "story.who.chai", "story.who.porn"];
        [[x0 + 1.5, z0 + 1.6], [x0 + 4.5, z0 + 1.6], [x0 + 1.5, z1 - 1.6], [x0 + 4.5, z1 - 1.6]].forEach(([x, z], i) => {
          P("teacherDesk", x, z, 0, { y });
          if (r.k === 1) P("wallSign", x, z + 0.33, 0, { y, h: 0.55, lines: [sign(names[i])], w: 0.6, bg: 0x2a2a2e, pxm: 220 });
        });
        P("cabinet", x1 - 0.5, cz, -Math.PI / 2, { y }); P("cabinet", x1 - 0.5, cz - 0.7, -Math.PI / 2, { y });
        fixtures(1);
      } else if (T === "science") {
        [z0 + 1.5, z0 + 4].forEach((z) => { P("counter", cx, z, 0, { y, w: 4 }); for (let i = 0; i < 3; i++) { const b = V().box("glass", 0.12, 0.2, 0.12, { mat: "glass" }); b.position.set(cx - 1 + i, y + 1.1, z); st.scene.add(b); } });
        P("sink", x1 - 0.6, z0 + 0.6, 0, { y }); P("cabinet", x0 + 0.5, z1 - 0.6, Math.PI / 2, { y });
        fixtures(1);
      } else if (T === "lab") {
        [z0 + 1.2, z0 + 2.8, z0 + 4.4].forEach((z) => [cx - 2, cx, cx + 2].forEach((x) => { P("deskSet", x, z, 0, { y }); const m = V().box({ all: "metalDark", front: "screen" }, 0.4, 0.3, 0.05, { mat: "glow" }); m.position.set(x, y + 0.92, z - 0.1); st.scene.add(m); }));
        fixtures(1);
      } else if (T === "store" || T === "janitor") {
        P("shelf", x0 + 1, z0 + 0.4, 0, { y, w: 1.6 }); P("shelf", x0 + 3.2, z0 + 0.4, 0, { y, w: 1.6 });
        P("supplyBoxes", x0 + 1.4, z1 - 0.8, 0, { y });      // (the far corner from the door)
        if (T === "janitor") { P("photo", x1 - 0.06, cz, -Math.PI / 2, { y }); P("trashBin", x0 + 0.6, z0 + 1.6, 0, { y }); P("sink", cx, z1 - 0.4, Math.PI, { y }); }
        lamp(cx, y + 2.6, cz, "room", 0xe6eeff, 0.7);
      } else if (T === "wc") {
        for (let i = 0; i < 3; i++) P("stall", x0 + 1.2 + i * 1.3, z0 + 0.03, 0, { y });
        [cx - 1, cx + 1].forEach((x) => P("sink", x, z1 - 0.4, Math.PI, { y }));
        if (r.k === 2 && r.id === "WC3") P("wallSign", x1 - 0.06, cz, -Math.PI / 2, { y, h: 1.5, lines: [sign("story.sign.notice1"), sign("story.sign.notice2"), sign("story.sign.notice3"), sign("story.sign.notice4")], w: 1.6, bg: 0xf4f2ea, fg: 0x2a2a3a });
        lamp(cx, y + 2.6, cz, "room", 0xe6eeff, 0.8);
      } else if (T === "nurse") {
        P("nurseBed", x0 + 1.2, z0 + 2, 0, { y }); P("nurseBed", x0 + 3.4, z0 + 2, 0, { y });
        // (story round 7: the nurse's desk by the east wall -- it stood across the doorway, and the room
        // could not be walked into)
        P("medCabinet", x1 - 1.2, z0 + 0.25, 0, { y }); P("teacherDesk", x1 - 1.0, z1 - 1.7, Math.PI / 2, { y }); P("sink", x1 - 0.5, cz, -Math.PI / 2, { y });
        fixtures(1, 0xe0ecff);
      } else if (T === "pe") {
        P("vaultBox", cx - 1, cz - 0.5, 0, { y }); P("shelf", x1 - 1, z0 + 0.4, 0, { y, w: 1.4 });
        lamp(cx, y + 2.6, cz, "room", 0xe6eeff, 0.8);
      } else if (T === "admin" || T === "pr" || T === "principal") {
        if (T === "pr") P("paConsole", cx, z0 + 1.2, 0, { y });
        else [[x0 + 1.6, cz - 0.8], [x0 + 4.6, cz - 0.8]].forEach(([x, z]) => P("teacherDesk", x, z, Math.PI, { y }));
        P("cabinet", x0 + 0.5, z0 + 0.6, Math.PI / 2, { y }); P("plant", x1 - 0.6, z0 + 0.6, 0, { y });
        fixtures(1);
      } else if (T === "entry") {
        // the seating plan for the exam, LEXA's poster beside the students' own, the sponsor's sign
        P("exhibitBoard", x0 + 2.2, z0 + 1.8, 0, { y });
        P("lexaStandee", x1 - 1.2, z0 + 1.2, 0, { y });
        P("wallSign", cx, z1 - 0.08, Math.PI, { y, h: 2.45, lines: [sign("story.sign.examTitle"), sign("story.sign.sponsored")], w: 2.4, bg: 0xf4f7fa, fg: 0x1a7ac8 });
        P("wallSign", x0 + 0.06, cz + 1, Math.PI / 2, { y, h: 1.6, lines: [sign("story.sign.lexaPoster1"), sign("story.sign.lexaPoster2")], w: 1.4, bg: 0x1a5aa8, fg: 0xffffff });
        P("wallSign", x1 - 0.06, cz + 1, -Math.PI / 2, { y, h: 1.6, lines: [sign("story.sign.handPoster1"), sign("story.sign.handPoster2")], w: 1.4, bg: 0xf6f0dc, fg: 0x2a4ab8 });
        P("plant", x0 + 0.6, z1 - 0.6, 0, { y }); P("plant", x1 - 0.6, z1 - 0.6, 0, { y });
        lamp(cx, y + 2.6, cz, "room", 0xfff4e0, 1.1);
      } else if (T === "lobby") {
        P("bench", cx, z1 - 1, 0, { y }); P("plant", x0 + 0.6, z1 - 0.6, 0, { y }); P("waterCooler", x1 - 0.6, z0 + 0.6, 0, { y });
        lamp(cx, y + 2.6, cz, "corridor", 0xe6eeff, 0.9);
      } else if (T === "canteen") {
        for (let z = z0 + 2; z < z1 - 1; z += 4) [x0 + 2.5, x0 + 7.5].forEach((x) => P("canteenTable", x, z, 0, { y }));
        P("counter", -47, -19.4, 0, { y, w: 3 }); P("waterCooler", x1 - 0.6, z1 - 0.6, 0, { y }); P("trashBin", x0 + 0.6, z1 - 0.6, 0, { y });
        P("wallSign", -50, -19.94, 0, { y, h: 2.1, lines: [sign("story.sign.canteen")], w: 1.4, bg: 0x8a3a2e });
        lamp(cx, y + 2.6, cz - 5, "room", 0xfff0d8, 1.2); lamp(cx, y + 2.6, cz + 5, "room", 0xfff0d8, 1.2);
      } else if (T === "kitchen") {
        P("counter", x0 + 2.5, z0 + 0.5, 0, { y, w: 4 }); P("counter", x1 - 2.5, z0 + 0.5, 0, { y, w: 4 }); P("sink", cx, z0 + 0.5, 0, { y: y + 0 });
        // (story round 8: the supplies are the scene's own -- 1-5 takes them one by one: js/data/story/ch1.js;
        // the shelf by the west wall -- it stood across the back door's way)
        P("shelf", x0 + 0.4, cz - 0.9, Math.PI / 2, { y, w: 1.6 });
        lamp(cx, y + 2.6, cz, "room", 0xfff0d8, 1.0);
      }
    });
    // ---- the corridors: lamps, the emergency lamps, lockers, extinguishers, the exits ----
    for (let k = 0; k < 3; k++) {
      const y = F[k];
      for (let x = -38; x <= 22; x += 8) lamp(x, y + 2.7, 0, "corridor", 0xe6eeff, 0.85);
      for (let x = -36; x <= 20; x += 16) { P("emergencyLight", x, -2.0, 0, { y: y - 0.1 }); lamp(x, y + 2.5, -1.2, "emergency", 0xff2a1a, 0); }
      P("exitSign", 23.9, 0, -Math.PI / 2, { y: y + 0.1 }); lamp(23.4, y + 2.4, 0, "exit", 0x2aff7a, 0);
      P("exitSign", -43.95, 5, Math.PI / 2, { y: y + 0.1 }); lamp(-43.5, y + 2.4, 5, "exit", 0x2aff7a, 0);
      if (k > 0) { P("exitSign", 4.5, -1.94, 0, { y: y + 0.1 }); lamp(4.5, y + 2.4, -1.5, "exit", 0x2aff7a, 0); }
      if (k > 0) { for (let z = -17; z <= -5; z += 8) lamp(-42.5, y + 2.7, z, "corridor", 0xe6eeff, 0.85); lamp(-42.5, y + 2.7, 5, "corridor", 0xe6eeff, 0.85); }
      [-20, 12].forEach((x) => P("fireExtinguisher", x, -1.94, 0, { y }));
      [[-12, 1.75], [16, 1.75]].forEach(([x, z]) => P("locker", x, z, Math.PI, { y, n: 3 }));
      if (k === 2) {
        // 3F: the evacuation plan by 305 (the doc's 1-1), EMERGENCY EXIT at the east stairs
        P("evacSign", -5.5, -1.95, 0, { y });
        P("wallSign", 23.94, -1.6, -Math.PI / 2, { y, h: 2.3, lines: [sign("story.sign.emergencyExit")], w: 1.4, bg: 0x1f9a4a, fg: 0xffffff });
      }
    }
  }
  const sign = (k) => (G.STRINGS && G.STRINGS.en && G.STRINGS.en[k]) || k;

  // ---------------- outdoors ----------------
  function outdoors(st, P, lamp) {
    // the flag yard: the stage (the principal's, 1-7), its podium, the flagpole, benches
    P("stage", STAGE.x, STAGE.z, 0, { collider: false }); P("podium", STAGE.x, STAGE.z - 0.2, 0, { y: 1 });
    P("flagpole", 0, 21, 0);
    [-24, 24].forEach((x) => [16, 32].forEach((z) => P("bench", x, z, x < 0 ? Math.PI / 2 : -Math.PI / 2)));
    [-22, 22].forEach((x) => [12, 40].forEach((z) => P("tree", x, z, 0)));
    [[-14, 42], [14, 42], [-34, 26], [30, 26]].forEach(([x, z]) => { P("lampPost", x, z, 0); lamp(x, 4, z + 0.6, "outdoor", 0xffd8a0, 0); });
    P("trashBin", -10, 11.5, 0); P("trashBin", 10, 11.5, 0);
    // the gate: the booth, the school van, the sponsor's banner for exam day
    P("gate", 29.5, 59.4, Math.PI);
    P("guardBooth", 23.5, 54.5, 0);
    P("schoolVan", 19.5, 50, 0);
    lamp(19.5, 0.8, 52.8, "car", 0xfff0c0, 0); lamp(19.5, 0.8, 47.2, "car", 0xffe8b0, 0);
    P("wallSign", 36.5, 58.94, Math.PI, { h: 1.3, lines: [sign("story.sign.examTitle"), sign("story.sign.sponsored")], w: 3.2, bg: 0xf4f7fa, fg: 0x1a7ac8 });
    P("cone", 27, 56, 0); P("cone", 31.5, 56, 0);
    // the football field: goals, a fence along its side (Beam stands at it, 1-8)
    P("goal", 54.5, FIELD.z0 + 0.5, 0); P("goal", 54.5, FIELD.z1 + 0.5, Math.PI);
    for (let z = 16; z <= 52; z += 8) if (z !== 40) P("fence", 38.5, z, Math.PI / 2, { len: 8 });
    [46, 62].forEach((x) => P("bench", x, 10.5, 0));
    // round the campus: trees
    for (let x = -50; x <= 66; x += 12) { P("tree", x, SITE.z0 + 3, 0); }
    for (let z = -60; z <= 50; z += 12) { P("tree", SITE.x0 + 3, z, 0); P("tree", SITE.x1 - 3, z, 0); }
    [[-20, -16], [0, -18], [20, -16]].forEach(([x, z]) => P("tree", x, z, 0));
    // the gym: stands both sides, the vaulting box, mats, hoops, its locker room
    // (story round 8: the south stands clear of the locker room's door -- it opened on their end, and nobody could
    // come out; the north ones clear of the car park's door)
    P("bleachers", -17, -43, 0, { w: 10 }); P("bleachers", -26, -26, Math.PI, { w: 10 });
    P("vaultBox", -30, -35, 0); P("hoop", -35.5, -34.5, Math.PI / 2); P("hoop", -11.5, -34.5, -Math.PI / 2);
    P("locker", -14.5, -28.6, 0, { n: 4 });
    [[-30, -30], [-18, -40], [-30, -40], [-18, -30]].forEach(([x, z]) => lamp(x, 5.4, z, "gym", 0xffffff, 1.2));
    // the car park: Sgt. Chai's police car (1-5), cones, lamps
    P("policeCar", -24, -58, Math.PI / 2);
    P("cone", -30, -52, 0); P("cone", -16, -52, 0);
    [[-40, -50], [-8, -64]].forEach(([x, z]) => { P("lampPost", x, z, 0); lamp(x, 4, z + 0.6, "outdoor", 0xffd8a0, 0); });
    // the courtyard
    [[-30, -14], [10, -14]].forEach(([x, z]) => P("bench", x, z, 0));
  }

  // ---------------- each frame: what is drawn ----------------
  // Indoors: the player's storey -- its band of blocks and the one above (whose
  // floor is this storey's ceiling), its things, its doors -- and of the
  // grounds what is near enough to be seen through a window. In a stairwell
  // the storeys either side as well, every band. Outdoors: the building's
  // blocks, its insides only from near it (through the windows), the grounds.
  // Never what is past the fog. Worked out again when the player has moved
  // a few metres or changed storey.
  const VIEW = { nearIn: 20, window: 48, step: 4 };
  const ZONES = { s0: 1, s1: 1, s2: 1, out: 1 };
  function collect(st, game) {
    const items = [];
    const boxOf = (m) => { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); return m.geometry.boundingBox; };
    st.chunks.forEach((m) => items.push({ obj: m, kind: "house", band: m.userData.band, box: boxOf(m) }));
    st.siteChunks.forEach((m) => items.push({ obj: m, kind: "zone", zone: "out", box: boxOf(m) }));
    // (the level's merge: its meshes are in world space, each one zone's -- world.zoneKey)
    game.scene.children.forEach((m) => { if (m.isMesh && m.userData.mergedParts && ZONES[m.userData.zone]) items.push({ obj: m, kind: "zone", zone: m.userData.zone, box: boxOf(m) }); });
    // (story round 8: what moves and is kept out of the merge -- a room's fan -- with its storey's things)
    game.scene.children.forEach((g) => { if (g.isGroup && g.userData.prop && g.userData.moves && g.userData.spin) items.push({ obj: g, kind: "zone", zone: zoneAt(st, g.position.x, g.position.y, g.position.z), box: new THREE.Box3().setFromObject(g) }); });
    st.items = items;
  }
  function update(st, game) {
    if (!st || !game.yawObject) return;
    if (!st.items) collect(st, game);
    const p = game.yawObject.position, feet = p.y - 1.7;
    const inStairs = Object.keys(STAIRS).some((id) => { const c = STAIRS[id].cells; return p.x >= c.x[0] - 0.5 && p.x <= c.x[1] + 1.5 && p.z >= c.z[0] - 0.5 && p.z <= c.z[1] + 1.5; });
    const indoor = st.inFoot(Math.floor(p.x), Math.floor(p.z)) && feet > -0.5;
    // (story round 8) in the gym: walls all round, its windows above the head -- the building's insides and its
    // ground floor cannot be seen (Coach Ek's fight: 180 draw calls with nobody in it)
    const inGym = p.x > GYM.x0 + 1 && p.x < GYM.x1 && p.z > GYM.z0 + 1 && p.z < GYM.z1;
    const s = feet < 2 ? 0 : feet < 6 ? 1 : 2;
    const fog = game.scene.fog ? game.scene.fog.far + 8 : 1e9;
    const key = (indoor ? (inStairs ? "t" : "i") : inGym ? "g" : "o") + s + "|" + Math.round(p.x / VIEW.step) + "|" + Math.round(p.z / VIEW.step) + "|" + Math.round(fog);
    if (key === st.viewKey) return;
    st.viewKey = key;
    const dist = (b) => Math.hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.z - p.z, 0, p.z - b.max.z));
    const foot = Math.min(dist({ min: { x: MAIN.x0, z: MAIN.z0 }, max: { x: MAIN.x1 + 1, z: MAIN.z1 + 1 } }), dist({ min: { x: WING.x0, z: WING.z0 }, max: { x: WING.x1 + 1, z: WING.z1 + 1 } }));
    // which storeys' things are drawn
    const on = {};
    [0, 1, 2].forEach((k) => { on["s" + k] = indoor ? (inStairs ? Math.abs(k - s) <= 1 : k === s) : !inGym && foot < VIEW.nearIn; });
    on.out = true;
    st.shown = on;
    st.mode = indoor ? (inStairs ? "stairs" : "s" + s) : inGym ? "gym" : "out";
    let drawn = 0;
    const set = (o, v) => { if (o.visible !== v) o.visible = v; if (v) drawn++; };
    st.items.forEach((it) => {
      let v = dist(it.box) < fog;
      if (v && it.kind === "house") v = inGym ? it.band >= 1 : !indoor || inStairs || it.band === s || it.band === s + 1;
      else if (v && it.kind === "zone") v = on[it.zone] && (it.zone !== "out" || !indoor || dist(it.box) < VIEW.window);
      set(it.obj, v);
    });
    Object.keys(st.doorMeshes).forEach((g) => st.doorMeshes[g].forEach((m) => set(m, !!on[g])));
    st.drawn = drawn;
  }

  // ---------------- underfoot ----------------
  function surfaceAt(st, x, z, y) {
    const cy = Math.round(y || 0) - 1, cx = Math.floor(x), cz = Math.floor(z);
    const b = st.house.get(cx, cy, cz) || st.site.get(cx, cy, cz);
    if (!b) return null;
    const t = b.tiles[2];
    return SURFACE[t] || "concrete";
  }

  const api = { build, F, MAIN, WING, COL, NZ, SZ, SITE, GYM, PARK, YARD, FIELD, GATE, STAGE, ROOMS, STAIRS, VIEW, corridors, doorCellOf, rectMinus, get state() { return state; } };
  G.StoryMaps.ch1 = api;
  return api;
})();
