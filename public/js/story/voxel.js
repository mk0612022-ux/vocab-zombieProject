// ===================================================================
// Blocks (story series, round 3)
// -------------------------------------------------------------------
// The chapter's world is blocks of 1 x 1 x 1 m with 16 px faces from one
// atlas (js/story/voxeltex.js). This file is how they become meshes:
//
//   materials  four, shared by everything built of blocks: "block" (a grid's
//              chunks: lit, the atlas, ambient occlusion in the vertices),
//              "prop" (lit, the atlas: merged with the level and its corners
//              darkened as the level's are -- js/perf.js, js/visuals.js),
//              "glow" (unlit: lamps, signs, screens) and "glass" (see-through)
//   boxGeo     a box with a tile on each face -- stretched over the face, or
//              one tile a metre, cut where the metre lines fall
//   Grid       blocks on a grid of whole metres: only the faces that can be
//              seen (not two blocks' shared one), each corner darkened by the
//              blocks round it, in sharp steps (the doc: AO along the blocks'
//              edges, never so soft the blocks look soft), cut into 16 m chunks
//              (one draw call a chunk and a material), and the solid blocks
//              joined into a few big colliders
//   afterBake  a grid's chunks lit per pixel from Medium up, as the level is
//              (js/visuals.js afterBake swaps the level's own; js/game.js calls
//              this right after)
//
//   G.Voxel.mat(kind)  G.Voxel.BLOCKS  G.Voxel.boxGeo(w, h, d, faces, o)
//   G.Voxel.box(faces, w, h, d, o)     a mesh of boxGeo (o.mat: the material's kind)
//   new G.Voxel.Grid()  .set(x, y, z, name, facing) .fill(x0, y0, z0, x1, y1, z1, name, facing)
//                       .get .del .build(scene, world, o)
// ===================================================================
window.G = window.G || {};

G.Voxel = (function () {
  const C = () => (G.CONFIG.story && G.CONFIG.story.voxel) || {};
  const VT = () => G.VoxelTex;

  // ---------------- materials ----------------
  const mats = {};
  function mat(kind) {
    if (mats[kind]) return mats[kind];
    const map = VT().texture();
    let m;
    if (kind === "block") m = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    else if (kind === "glow") { m = new THREE.MeshBasicMaterial({ map }); m.userData.vzGlow = "sign"; }
    else if (kind === "glass") m = new THREE.MeshLambertMaterial({ map, transparent: true, opacity: C().glassOpacity || 0.42, depthWrite: false });
    else m = new THREE.MeshLambertMaterial({ map });
    m.userData.shared = true;
    m.userData.voxel = kind;
    m.name = "voxel-" + kind;
    mats[kind] = m;
    return m;
  }

  // ---------------- a box's faces ----------------
  // in three.js's order (+x, -x, +y, -y, +z, -z); for each: its normal, the way
  // "right" and "up" run as seen from outside, and its corners (bottom-left,
  // bottom-right, top-right, top-left) as 0 (min) / 1 (max) on x, y and z
  const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  // the faces' tiles from a short description: a name for all six, or
  // { all, side, top, bottom, front (+z), back (-z), px (+x), nx (-x) }
  function faceTiles(f) {
    if (typeof f === "string") return [f, f, f, f, f, f];
    const all = f.all || "cream", side = f.side || all;
    return [f.px || side, f.nx || side, f.top || all, f.bottom || f.top || all, f.front || side, f.back || side];
  }

  // a growing buffer of quads: positions, normals, uvs, colours (optional), indices
  function Buf(colors) { this.p = []; this.n = []; this.uv = []; this.c = colors ? [] : null; this.i = []; this.v = 0; }
  // corners: four [x, y, z]; n: the normal; r: [u0, v0, u1, v1] and, fifth, quarter
  // turns of the picture (a lying body's faces); col: four brightnesses (or null)
  // (the rectangle's corners in quad order -- bottom-left, bottom-right, top-right,
  // top-left -- as indices into r: nothing made per quad, a map has 60 000 of them)
  const UVX = [0, 2, 2, 0], UVY = [1, 1, 3, 3];
  Buf.prototype.quad = function (corners, n, r, col, flip) {
    const rot = r[4] || 0;
    for (let k = 0; k < 4; k++) {
      const c = corners[k];
      this.p.push(c[0], c[1], c[2]);
      this.n.push(n[0], n[1], n[2]);
      const j = (k + rot) % 4;
      this.uv.push(r[UVX[j]], r[UVY[j]]);
      if (this.c) { const b = col ? col[k] : 1; if (Array.isArray(b)) this.c.push(b[0], b[1], b[2]); else this.c.push(b, b, b); }
    }
    const o = this.v;
    // (the diagonal turned where the corners' darkness would otherwise smear across it)
    if (flip) this.i.push(o, o + 1, o + 3, o + 1, o + 2, o + 3);
    else this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
    this.v += 4;
  };
  Buf.prototype.geometry = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  };

  // ---------------- a box with its tiles ----------------
  // centred on its own origin. o.mode: "stretch" (a tile over each face: the
  // default) or "meter" (a tile every o.unit metres -- 1 -- the last one cut);
  // o.rects: [six UV rectangles] in place of tiles (js/story/voxelchars.js)
  function boxGeo(w, h, d, faces, o) {
    o = o || {};
    const tiles = o.rects ? null : faceTiles(faces || "cream");
    const b = new Buf(!!o.colors);
    addBox(b, -w / 2, -h / 2, -d / 2, w / 2, h / 2, d / 2, tiles, o);
    return b.geometry();
  }
  // a box into a buffer, between (x0, y0, z0) and (x1, y1, z1)
  function addBox(b, x0, y0, z0, x1, y1, z1, tiles, o) {
    o = o || {};
    const lo = [x0, y0, z0], hi = [x1, y1, z1], size = [x1 - x0, y1 - y0, z1 - z0];
    FACES.forEach((F, fi) => {
      if (o.skip && o.skip[fi]) return;
      const r = o.rects ? o.rects[fi] : VT().rect(tiles[fi]);
      const corner = (s) => [s[0] ? hi[0] : lo[0], s[1] ? hi[1] : lo[1], s[2] ? hi[2] : lo[2]];
      const cs = F.c.map(corner);
      const col = o.color ? [o.color, o.color, o.color, o.color] : null;
      if (o.mode !== "meter") { b.quad(cs, F.n, r, col); return; }
      // one tile a unit along "right" and "up"
      const unit = o.unit || 1;
      const ax = (vec) => (vec[0] ? 0 : vec[1] ? 1 : 2);
      const ua = ax(F.u), va = ax(F.v), fu = size[ua], fv = size[va];
      const nu = Math.max(1, Math.ceil(fu / unit - 1e-6)), nv = Math.max(1, Math.ceil(fv / unit - 1e-6));
      const bl = cs[0], U = F.u, V = F.v;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a0 = i * unit, a1 = Math.min(fu, (i + 1) * unit), b0 = j * unit, b1 = Math.min(fv, (j + 1) * unit);
        const P = (a, bb) => [bl[0] + U[0] * a + V[0] * bb, bl[1] + U[1] * a + V[1] * bb, bl[2] + U[2] * a + V[2] * bb];
        const sub = [r[0], r[1], r[0] + (r[2] - r[0]) * ((a1 - a0) / unit), r[1] + (r[3] - r[1]) * ((b1 - b0) / unit)];
        b.quad([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], F.n, sub, col);
      }
    });
  }
  // a mesh of one box: o.mat "prop" (default) | "glow" | "glass" | "block"
  function box(faces, w, h, d, o) {
    o = o || {};
    const kind = o.mat || (typeof faces === "string" && VT().GLOW.has(faces) ? "glow" : "prop");
    const m = new THREE.Mesh(boxGeo(w, h, d, faces, o), mat(kind));
    m.castShadow = kind !== "glow" && kind !== "glass";
    m.receiveShadow = true;
    return m;
  }

  // ---------------- the blocks ----------------
  // faces: as faceTiles; front: a facing block (facing 0 = its front to +z,
  // 1 = +x, 2 = -z, 3 = -x); glass: see-through; glow: unlit; open: drawn and
  // solid, but no collider (a floor's top layer, leaves overhead)
  const BLOCKS = {}, BY_ID = [null];
  function def(name, faces, o) {
    o = o || {};
    const b = { name, id: BY_ID.length, tiles: faceTiles(faces), front: !!o.front, glass: !!o.glass, glow: !!o.glow, open: !!o.open, rotTop: o.rotTop || 0 };
    BLOCKS[name] = b; BY_ID.push(b);
    return b;
  }
  ["cream", "creamBase", "creamBand", "white", "whiteDado", "terrazzo", "tiles", "tilesGreen", "wood", "woodDark", "plank", "concrete", "concreteDark", "brick", "roof",
    "ceiling", "dirt", "asphalt", "asphaltLine", "paving", "yellowLine", "sand", "track", "fieldLine", "metal", "metalDark", "corrugated", "curtain", "fabricBlue",
    "gymFloor", "mat", "cardboard", "cork", "handmade", "handmadeB", "neurolex", "lexaAd", "paper", "sheet"].forEach((n) => def(n, n));
  // (a line painted along z: the tile's picture turned a quarter on the top face)
  def("asphaltLineZ", "asphaltLine", { rotTop: 1 });
  def("yellowLineZ", "yellowLine", { rotTop: 1 });
  def("fieldLineZ", "fieldLine", { rotTop: 1 });
  def("grass", { side: "grassSide", top: "grassTop", bottom: "dirt" });
  def("log", { side: "logSide", top: "logTop" });
  def("leaves", "leaves");
  def("books", { side: "shelfSide", front: "books", back: "booksB" }, { front: true });
  def("booksB", { side: "shelfSide", front: "booksB", back: "books" }, { front: true });
  def("blackboard", { side: "woodDark", front: "blackboard" }, { front: true });
  def("whiteboard", { side: "metal", front: "whiteboard" }, { front: true });
  def("locker", { side: "metal", front: "locker" }, { front: true });
  def("doorTop", { side: "woodDark", front: "doorTop", back: "doorTop" }, { front: true });
  def("doorBottom", { side: "woodDark", front: "doorBottom", back: "doorBottom" }, { front: true });
  def("bleacher", { side: "concreteDark", front: "bleacher", top: "plank" }, { front: true });
  def("vault", { side: "vault", top: "mat" });
  def("glass", "glass", { glass: true });
  def("frame", "frame");
  def("emergency", { side: "metalDark", front: "emergency" }, { front: true, glow: true });
  def("exitSign", { side: "metalDark", front: "exitSign", back: "exitSign" }, { front: true, glow: true });
  def("screen", { side: "metalDark", front: "screen" }, { front: true, glow: true });
  def("clock", { side: "metalDark", front: "clock" }, { front: true });

  // ---------------- a grid of blocks ----------------
  const KX = 2048, KY = 128, OFF = 1024, OFY = 32;
  const key = (x, y, z) => ((x + OFF) * KX + (z + OFF)) * KY + (y + OFY);
  function unkey(k) { const y = (k % KY) - OFY, r = Math.floor(k / KY), z = (r % KX) - OFF, x = Math.floor(r / KX) - OFF; return [x, y, z]; }
  function Grid() { this.cells = new Map(); }
  Grid.prototype.set = function (x, y, z, name, facing) {
    const b = BLOCKS[name];
    if (!b) throw new Error("no block " + name);
    this.cells.set(key(x, y, z), b.id | ((facing || 0) << 8));
    return this;
  };
  Grid.prototype.del = function (x, y, z) { this.cells.delete(key(x, y, z)); return this; };
  Grid.prototype.get = function (x, y, z) { const v = this.cells.get(key(x, y, z)); return v ? BY_ID[v & 255] : null; };
  Grid.prototype.fill = function (x0, y0, z0, x1, y1, z1, name, facing) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, name, facing);
    return this;
  };
  Object.defineProperty(Grid.prototype, "size", { get() { return this.cells.size; } });

  // the face of block b turned to face fi, with the block facing f
  const FRONT_FACE = [4, 0, 5, 1], BACK_FACE = [5, 1, 4, 0];
  function tileOf(b, fi, f) {
    if (!b.front) return b.tiles[fi];
    if (fi === FRONT_FACE[f]) return b.tiles[4];
    if (fi === BACK_FACE[f]) return b.tiles[5];
    if (fi === 2 || fi === 3) return b.tiles[fi];
    return b.tiles[0];
  }

  // Into meshes. o: { origin: [x, y, z] (metres, where block 0,0,0 sits), chunk (m),
  // colliders (true: the solid blocks above the floor into world.colliders),
  // floorY (blocks below this y are the floor: no collider), zone (userData.zone),
  // band (story round 4: blocks of y a chunk is also cut by -- a storey's own
  // chunks, userData.band = floor((y + 1) / band), so a map can leave out the
  // storeys the player cannot see), solid (story round 4: (y) => which rows get
  // colliders -- the player's box is 2.6 m tall (js/game.js), so a 2 m doorway's
  // lintel, or a floor one steps up onto, must not be one) }
  // Returns { meshes, faces, colliders: [Box3] }.
  Grid.prototype.build = function (scene, world, o) {
    o = o || {};
    const org = o.origin || [0, 0, 0], CH = o.chunk || C().chunk || 16, BAND = o.band || 0;
    const AO = C().ao || [0.52, 0.68, 0.84, 1];
    const cells = this.cells;
    // (story round 4: the neighbours read from a dense copy of the grid's box, not
    // the Map -- some 900 000 lookups for a map's faces and their corners)
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    cells.forEach((v, k) => {
      const y = (k % KY) - OFY, kr = Math.floor(k / KY), z = (kr % KX) - OFF, x = Math.floor(kr / KX) - OFF;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    });
    const NX = x1 - x0 + 3, NY = y1 - y0 + 3, NZ = z1 - z0 + 3;
    const dense = new Uint16Array(Math.max(1, NX * NY * NZ));
    cells.forEach((v, k) => {
      const y = (k % KY) - OFY, kr = Math.floor(k / KY), z = (kr % KX) - OFF, x = Math.floor(kr / KX) - OFF;
      dense[((x - x0 + 1) * NZ + (z - z0 + 1)) * NY + (y - y0 + 1)] = v;
    });
    const at = (x, y, z) => {
      const ix = x - x0 + 1, iy = y - y0 + 1, iz = z - z0 + 1;
      if (ix < 0 || iy < 0 || iz < 0 || ix >= NX || iy >= NY || iz >= NZ) return null;
      const v = dense[(ix * NZ + iz) * NY + iy];
      return v ? BY_ID[v & 255] : null;
    };
    const opaque = (x, y, z) => { const b = at(x, y, z); return b && !b.glass ? 1 : 0; };
    const chunks = new Map();
    const bufOf = (cx, cz, band, kind) => {
      const k = ((cx + 512) * 1024 + (cz + 512)) * 64 + band;
      let ch = chunks.get(k);
      if (!ch) { ch = { band }; chunks.set(k, ch); }
      return ch[kind] || (ch[kind] = new Buf(kind !== "glass"));
    };
    // (story round 4: nothing made per face -- the corners, the shading and the
    // tiles' rectangles reused; a map's 60 000 faces took over a second this way)
    const corners = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], ao = [0, 0, 0, 0], col = [1, 1, 1, 1];
    const SIG = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const rects = new Map();
    const rectOf = (name, rot) => {
      const k = rot ? name + "@" + rot : name;
      let r = rects.get(k);
      if (!r) { r = VT().rect(name); if (rot) r = r.concat([rot]); rects.set(k, r); }
      return r;
    };
    let faces = 0;
    cells.forEach((v, k) => {
      const y = (k % KY) - OFY, kr = Math.floor(k / KY), z = (kr % KX) - OFF, x = Math.floor(kr / KX) - OFF;
      const b = BY_ID[v & 255], f = (v >> 8) & 3;
      const kind = b.glass ? "glass" : b.glow ? "glow" : "block";
      const buf = bufOf(Math.floor(x / CH), Math.floor(z / CH), BAND ? Math.floor((y + 1) / BAND) : 0, kind);
      for (let fi = 0; fi < 6; fi++) {
        const F = FACES[fi];
        const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
        const nb = at(nx, ny, nz);
        if (nb && (!nb.glass || nb === b)) continue;          // hidden behind a block (or glass behind the same glass)
        faces++;
        for (let q = 0; q < 4; q++) { const s = F.c[q], c = corners[q]; c[0] = org[0] + x + s[0]; c[1] = org[1] + y + s[1]; c[2] = org[2] + z + s[2]; }
        const r = rectOf(tileOf(b, fi, f), b.rotTop && (fi === 2 || fi === 3) ? b.rotTop : 0);
        if (kind === "glass") { buf.quad(corners, F.n, r, null); continue; }
        // each corner: the two blocks beside it and the one across, in front of the face
        for (let q = 0; q < 4; q++) {
          const su = SIG[q][0], sv = SIG[q][1], U = F.u, W = F.v;
          const s1 = opaque(nx + U[0] * su, ny + U[1] * su, nz + U[2] * su);
          const s2 = opaque(nx + W[0] * sv, ny + W[1] * sv, nz + W[2] * sv);
          const cc = opaque(nx + U[0] * su + W[0] * sv, ny + U[1] * su + W[1] * sv, nz + U[2] * su + W[2] * sv);
          ao[q] = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
          col[q] = kind === "glow" ? 1 : AO[ao[q]];
        }
        buf.quad(corners, F.n, r, col, ao[0] + ao[2] < ao[1] + ao[3]);
      }
    });
    const meshes = [];
    world.noMerge = world.noMerge || [];
    world.voxelMeshes = world.voxelMeshes || [];
    chunks.forEach((ch) => {
      Object.keys(ch).forEach((kind) => {
        if (kind === "band") return;
        const g = ch[kind].geometry();
        const m = new THREE.Mesh(g, kind === "block" ? mat("block") : kind === "glow" ? glowBlockMat() : mat("glass"));
        m.castShadow = kind === "block";
        m.receiveShadow = kind !== "glow";
        m.userData.voxelChunk = kind;
        m.userData.band = ch.band;
        if (o.zone) m.userData.zone = o.zone;
        scene.add(m);
        meshes.push(m);
        // (already one mesh a chunk: kept out of the level's merge, whose AO and
        // merged buffers would drop the corners' shading kept in these vertices)
        world.noMerge.push(m);
        world.voxelMeshes.push(m);
      });
    });
    const colliders = o.colliders === false ? [] : this.colliders(world, org, o.floorY != null ? o.floorY : 0, o.solid);
    return { meshes, faces, colliders };
  };
  // glowing blocks: unlit, the atlas, the corners' colours ignored (all 1)
  function glowBlockMat() {
    if (mats.glowBlock) return mats.glowBlock;
    const m = new THREE.MeshBasicMaterial({ map: VT().texture(), vertexColors: true });
    m.userData.vzGlow = "sign"; m.userData.shared = true; m.userData.voxel = "glowBlock";
    return (mats.glowBlock = m);
  }
  // the solid blocks above the floor as a few boxes: runs along x, joined
  // along z where they match, then along y
  Grid.prototype.colliders = function (world, org, floorY, solid) {
    org = org || [0, 0, 0];
    const rows = new Map();     // (y, z) as one number -> xs
    this.cells.forEach((v, k) => {
      const y = (k % KY) - OFY, kr = Math.floor(k / KY), z = (kr % KX) - OFF, x = Math.floor(kr / KX) - OFF, b = BY_ID[v & 255];
      if (b.open || org[1] + y < (floorY || 0) || (solid && !solid(y))) return;
      const rk = (y + OFY) * 4096 + (z + OFF);
      let xs = rows.get(rk);
      if (!xs) rows.set(rk, (xs = []));
      xs.push(x);
    });
    // runs: per y, "x0,x1" -> list of z
    const perY = new Map();
    rows.forEach((xs, rk) => {
      const y = Math.floor(rk / 4096) - OFY, z = (rk % 4096) - OFF;
      xs.sort((a, b) => a - b);
      let s = xs[0], p = xs[0];
      const flush = () => {
        const yk = perY.get(y) || perY.set(y, new Map()).get(y), rk2 = s + "," + p;
        (yk.get(rk2) || yk.set(rk2, []).get(rk2)).push(z);
      };
      for (let i = 1; i < xs.length; i++) { if (xs[i] === p + 1) p = xs[i]; else { flush(); s = p = xs[i]; } }
      flush();
    });
    // rectangles per y, then stacked along y where the same rectangle repeats
    const rects = new Map();    // "x0,x1,z0,z1" -> list of y
    perY.forEach((runs, y) => runs.forEach((zs, rk) => {
      zs.sort((a, b) => a - b);
      let s = zs[0], p = zs[0];
      const flush = () => { const k = rk + "," + s + "," + p; (rects.get(k) || rects.set(k, []).get(k)).push(y); };
      for (let i = 1; i < zs.length; i++) { if (zs[i] === p + 1) p = zs[i]; else { flush(); s = p = zs[i]; } }
      flush();
    }));
    const out = [];
    rects.forEach((ys, k) => {
      const [x0, x1, z0, z1] = k.split(",").map(Number);
      ys.sort((a, b) => a - b);
      let s = ys[0], p = ys[0];
      const flush = () => out.push(new THREE.Box3(new THREE.Vector3(org[0] + x0, org[1] + s, org[2] + z0), new THREE.Vector3(org[0] + x1 + 1, org[1] + p + 1, org[2] + z1 + 1)));
      for (let i = 1; i < ys.length; i++) { if (ys[i] === p + 1) p = ys[i]; else { flush(); s = p = ys[i]; } }
      flush();
    });
    if (world && world.colliders) out.forEach((b) => world.colliders.push(b));
    return out;
  };

  // ---------------- per-pixel light from Medium up ----------------
  // the grid's chunks (kept out of the merge) and the merged props (which
  // js/visuals.js has already made MeshStandard) take the atlas's roughness
  // and metalness, one texel a tile
  function afterBake(game) {
    const V = G.Visuals, world = game && game.world;
    if (!world || !V || !V.ready || !V.toStandard) return 0;
    const Q = V.cfgQ ? V.cfgQ() : {};
    const surf = VT().surface();
    let n = 0;
    (world.voxelMeshes || []).forEach((m) => {
      const lam = m.material;
      if (!lam || !lam.isMeshLambertMaterial || lam.transparent) return;
      const s = V.toStandard(lam, { roughness: 1, metalness: 1 });
      s.roughnessMap = surf; s.metalnessMap = surf;
      s.userData.vzDetail = false; s.userData.vzEnv = false;
      m.material = Q.pbr === false ? lam : s;
      (V.swaps || (V.swaps = [])).push({ mesh: m, lambert: lam, standard: s });
      n++;
    });
    (V.swaps || []).forEach((w) => {
      const ud = w.lambert && w.lambert.userData;
      if (!ud || ud.voxel !== "prop" || !w.standard || w.standard.roughnessMap === surf) return;
      w.standard.roughness = 1; w.standard.metalness = 1;
      w.standard.roughnessMap = surf; w.standard.metalnessMap = surf;
      w.standard.userData.vzDetail = false;
      w.standard.needsUpdate = true;
    });
    return n;
  }

  return { mat, FACES, faceTiles, Buf, boxGeo, addBox, box, BLOCKS, BY_ID, def, Grid, afterBake, key, unkey };
})();
