// ===================================================================
// The chapter's pixel textures (story series, round 3)
// -------------------------------------------------------------------
// Chapter 1 is built of blocks, a voxel blocky look (design doc, its section on
// pictures, light and sound): a block is 1 x 1 x 1 m and every face of it is 16 x 16 pixels, the
// same pixel size across the scene, flat colours with one or two steps of
// pixel shading. Every block face is drawn here, in code, the first time a
// chapter needs it -- no image files, nothing taken from any other game --
// into one atlas: 80 tiles of 16 px on an 8 x 16 grid (a 128 x 256 canvas,
// 48 places still free), drawn with NearestFilter so a pixel stays a square.
//
//   G.VoxelTex.TILES / IDX     the tiles' names, in atlas order
//   G.VoxelTex.texture()       the atlas
//   G.VoxelTex.rect(name)      a tile's UV rectangle [u0, v0, u1, v1] (half a texel in,
//                              so a neighbour's pixels never bleed across a seam)
//   G.VoxelTex.surface()       roughness (G) and metalness (B) per tile, one texel a
//                              tile, for the per-pixel materials (js/visuals.js)
//   G.VoxelTex.text / textWidth / hasGlyphs   a 5 x 7 pixel font of our own (A-Z,
//                              0-9 and a few signs), for headings on signs
//   G.VoxelTex.sign(lines, o)  a sign's face: a block-style pixel frame and its text
// ===================================================================
window.G = window.G || {};

G.VoxelTex = (function () {
  const T = 16, COLS = 8, ROWS = 16, W = T * COLS, H = T * ROWS;
  const TILES = [
    // building
    "cream", "creamBase", "creamBand", "white", "whiteDado", "terrazzo", "tiles", "tilesGreen",
    "wood", "woodDark", "plank", "concrete", "concreteDark", "brick", "roof", "ceiling",
    // outdoors
    "grassTop", "grassSide", "dirt", "asphalt", "asphaltLine", "paving", "yellowLine", "sand",
    "leaves", "logSide", "logTop", "track", "fieldLine", "metal", "metalDark", "corrugated",
    // indoors
    "books", "booksB", "shelfSide", "blackboard", "whiteboard", "cork", "handmade", "handmadeB",
    "locker", "doorTop", "doorBottom", "glass", "frame", "curtain", "fabricBlue", "sheet",
    // NeuroLex, the gym, boxes
    "neurolex", "lexaAd", "screen", "gymFloor", "bleacher", "vault", "mat", "cardboard",
    // vehicles, lamps, signs
    "carWhite", "carStripe", "tire", "headlight", "emergency", "exitSign", "clock", "paper",
    // paint, and the props' own
    "paintRed", "paintBlue", "paintYellow", "paintGreen", "paintBlack", "paintWhite", "paintOrange", "paintGrey",
    "pianoKeys", "drumSkin", "medGreen", "medBlue", "medOrange", "fireExt", "lamp", "lightBlue",
  ];
  const IDX = {};
  TILES.forEach((n, i) => { IDX[n] = i; });
  // what glows (drawn unlit): js/story/voxel.js gives these the glow material
  const GLOW = new Set(["emergency", "exitSign", "headlight", "screen", "lamp", "lightBlue"]);
  let canvas = null, tex = null, surf = null;

  function rngOf(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100003) / 100003; };
  }
  const mul = (h, k) => {
    const r = Math.min(255, Math.round(((h >> 16) & 255) * k)), g = Math.min(255, Math.round(((h >> 8) & 255) * k)), b = Math.min(255, Math.round((h & 255) * k));
    return (r << 16) | (g << 8) | b;
  };
  const mix = (a, b, k) => {
    const f = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
    return (f(16) << 16) | (f(8) << 8) | f(0);
  };

  // a painter on one 16 px tile of the atlas's pixels
  function painter(img, ox, oy, r) {
    const p = {
      r,
      set(x, y, h) {
        if (x < 0 || y < 0 || x >= T || y >= T) return;
        const i = ((oy + y) * W + ox + x) * 4;
        img.data[i] = (h >> 16) & 255; img.data[i + 1] = (h >> 8) & 255; img.data[i + 2] = h & 255; img.data[i + 3] = 255;
      },
      get(x, y) {
        const i = ((oy + Math.max(0, Math.min(T - 1, y))) * W + ox + Math.max(0, Math.min(T - 1, x))) * 4;
        return (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
      },
      rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) p.set(i, j, c); },
      hline(y, c, x0, x1) { for (let x = x0 || 0; x <= (x1 == null ? T - 1 : x1); x++) p.set(x, y, c); },
      vline(x, c, y0, y1) { for (let y = y0 || 0; y <= (y1 == null ? T - 1 : y1); y++) p.set(x, y, c); },
      // flat colour with a step of shadow and a step of light, here and there
      mottle(base, dark, light, pd, pl, x0, y0, w, h) {
        x0 = x0 || 0; y0 = y0 || 0; w = w == null ? T : w; h = h == null ? T : h;
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
          const v = r();
          p.set(x, y, v < pd ? dark : v < pd + pl ? light : base);
        }
      },
      speck(n, colors) { for (let i = 0; i < n; i++) p.set(Math.floor(r() * T), Math.floor(r() * T), colors[Math.floor(r() * colors.length)]); },
      dim(x, y, k) { p.set(x, y, mul(p.get(x, y), k)); },
    };
    return p;
  }

  // ---------------- the tiles ----------------
  // (each draws its 16 x 16 pixels, x to the right, y down)
  const D = {};
  const CREAM = [0xe6d6aa, 0xd8c698, 0xf0e3be];
  D.cream = (p) => p.mottle(CREAM[0], CREAM[1], CREAM[2], 0.16, 0.1);
  D.creamBase = (p) => { D.cream(p); p.mottle(0x9c8364, 0x8a7255, 0xab9273, 0.2, 0.1, 0, 11, 16, 5); p.hline(11, 0x75603f); p.hline(10, mul(CREAM[0], 0.92)); };
  D.creamBand = (p) => { D.cream(p); p.mottle(0x8a3a2e, 0x7a3226, 0x9a4636, 0.15, 0.1, 0, 6, 16, 3); p.hline(5, mul(CREAM[0], 0.9)); p.hline(9, mul(CREAM[0], 0.9)); };
  D.white = (p) => p.mottle(0xe2e0d8, 0xd6d3c9, 0xeae8e2, 0.14, 0.1);
  D.whiteDado = (p) => { D.white(p); p.mottle(0x9db5a8, 0x8ea596, 0xabc2b5, 0.18, 0.1, 0, 9, 16, 7); p.hline(9, 0x7d9486); };
  // (the chips quiet: a floor seen across a room must not fizz behind the words)
  D.terrazzo = (p) => {
    p.mottle(0xc4bfb3, 0xbab5a9, 0xcdc8bc, 0.14, 0.08);
    const chips = [0xa49e94, 0xdcd8ce, 0xb49a84, 0x8c96a0, 0x948e84];
    p.speck(24, chips);
  };
  D.tiles = (p) => {
    for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
      const k = 0.97 + p.r() * 0.05, c = mul(0xd6d6ce, k);
      p.mottle(c, mul(c, 0.96), mul(c, 1.02), 0.1, 0.06, cx * 8, cy * 8, 8, 8);
      p.set(cx * 8 + 2, cy * 8 + 2, mul(c, 1.05));
    }
    p.hline(0, 0xb4b2aa); p.hline(8, 0xb4b2aa); p.vline(0, 0xb4b2aa); p.vline(8, 0xb4b2aa);
  };
  D.tilesGreen = (p) => {
    for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
      const c = (cx + cy) % 2 ? 0x7fa88f : 0xe4e4dc;
      p.mottle(c, mul(c, 0.95), mul(c, 1.03), 0.1, 0.06, cx * 8, cy * 8, 8, 8);
    }
    p.hline(0, 0xa8a69e); p.hline(8, 0xa8a69e); p.vline(0, 0xa8a69e); p.vline(8, 0xa8a69e);
  };
  D.wood = (p) => {
    const cs = [0xa8784a, 0x9c6e42, 0xb0804f, 0xa27448];
    for (let k = 0; k < 4; k++) {
      const c = cs[k], y0 = k * 4;
      p.mottle(c, mul(c, 0.9), mul(c, 1.06), 0.2, 0.1, 0, y0, 16, 4);
      p.hline(y0 + 3, mul(c, 0.72));
      const sx = (k * 5 + 3) % 16;
      p.vline(sx, mul(c, 0.7), y0, y0 + 3);
      for (let i = 0; i < 3; i++) p.set(Math.floor(p.r() * 16), y0 + 1, mul(c, 0.84));
    }
  };
  D.woodDark = (p) => {
    const cs = [0x6b4428, 0x5f3c22, 0x704a2c, 0x654026];
    for (let k = 0; k < 4; k++) {
      const c = cs[k];
      p.mottle(c, mul(c, 0.88), mul(c, 1.08), 0.2, 0.1, k * 4, 0, 4, 16);
      p.vline(k * 4, 0x4a2e18);
    }
  };
  D.plank = (p) => {
    p.mottle(0xc8a06a, 0xbc945e, 0xd2aa74, 0.16, 0.1);
    for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) if (p.r() < 0.7) p.set(x, y, 0xb08654);
    p.rect(10, 6, 2, 2, 0x9a7044);
    p.hline(0, 0xd8b480); p.hline(15, 0xa88050);
  };
  D.concrete = (p) => {
    p.mottle(0x9a9893, 0x8c8a85, 0xa6a49f, 0.25, 0.12);
    let x = 3 + Math.floor(p.r() * 8);
    for (let y = 0; y < 9; y++) { p.set(x, y, 0x76746f); if (p.r() < 0.45) x += p.r() < 0.5 ? -1 : 1; }
  };
  D.concreteDark = (p) => { p.mottle(0x6e6c68, 0x62605c, 0x7a7874, 0.25, 0.12); p.speck(6, [0x8a8884]); };
  D.brick = (p) => {
    p.rect(0, 0, 16, 16, 0xc8bba5);
    const cs = [0x9a4a36, 0x8a3f2e, 0xa45240, 0x934634];
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let b = -1; b < 2; b++) {
        const x0 = b * 8 + off, c = cs[Math.floor(p.r() * cs.length)];
        for (let y = row * 4; y < row * 4 + 3; y++) for (let x = x0; x < x0 + 7; x++) if (x >= 0 && x < 16) p.set(x, y, p.r() < 0.18 ? mul(c, 0.88) : c);
        if (x0 >= 0 && x0 < 16) p.set(x0, row * 4, mul(c, 1.12));
      }
    }
  };
  D.roof = (p) => {
    for (let row = 0; row < 4; row++) {
      const y0 = row * 4;
      p.mottle(0xc8642e, 0xb85a28, 0xd87a40, 0.18, 0.12, 0, y0, 16, 4);
      p.hline(y0 + 3, 0x9a4a20);
      for (let x = (row % 2) * 2; x < 16; x += 4) p.set(x, y0 + 2, 0xa8501f);
    }
  };
  D.ceiling = (p) => {
    p.mottle(0xdcdad2, 0xd2d0c8, 0xe4e2da, 0.1, 0.08);
    for (let y = 1; y < 16; y += 3) for (let x = 1; x < 16; x += 3) p.set(x, y, 0xd0cec6);
    p.hline(0, 0xc6c4bc); p.hline(8, 0xc6c4bc); p.vline(0, 0xc6c4bc); p.vline(8, 0xc6c4bc);
  };
  const GRASS = [0x5d9a3a, 0x4f8a30, 0x6eae48];
  D.grassTop = (p) => { p.mottle(GRASS[0], GRASS[1], GRASS[2], 0.3, 0.2); p.speck(10, [0x467e2a]); };
  D.dirt = (p) => { p.mottle(0x8a6440, 0x7a5636, 0x9a7450, 0.3, 0.15); p.speck(5, [0xa89a8a, 0x6a4a30]); };
  D.grassSide = (p) => {
    D.dirt(p);
    for (let x = 0; x < 16; x++) {
      const h = 3 + (p.r() < 0.4 ? 1 : 0) + (p.r() < 0.15 ? 1 : 0);
      for (let y = 0; y < h; y++) p.set(x, y, [GRASS[0], GRASS[1], GRASS[2]][Math.floor(p.r() * 3)]);
    }
  };
  D.asphalt = (p) => { p.mottle(0x4a4a4e, 0x404044, 0x55555a, 0.3, 0.15); p.speck(8, [0x6a6a6e, 0x38383b]); };
  D.asphaltLine = (p) => { D.asphalt(p); for (let x = 0; x < 16; x++) for (let y = 7; y < 9; y++) p.set(x, y, p.r() < 0.12 ? 0xb8b8b0 : 0xe8e8e0); };
  D.paving = (p) => {
    for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
      const c = mul(0xb8b0a0, 0.94 + p.r() * 0.1);
      p.mottle(c, mul(c, 0.92), mul(c, 1.05), 0.2, 0.1, cx * 8, cy * 8, 8, 8);
    }
    p.hline(0, 0x8a8478); p.hline(8, 0x8a8478); p.vline(0, 0x8a8478); p.vline(8, 0x8a8478);
  };
  D.yellowLine = (p) => { p.mottle(0xb4b0a8, 0xa8a49c, 0xc0bcb4, 0.2, 0.1); for (let x = 0; x < 16; x++) for (let y = 6; y < 10; y++) p.set(x, y, p.r() < 0.1 ? 0xb8a040 : 0xe8c020); };
  D.sand = (p) => p.mottle(0xd8c08a, 0xc8b07a, 0xe6d09a, 0.3, 0.2);
  D.leaves = (p) => {
    p.mottle(0x4f8a34, 0x3f7a2a, 0x61a03f, 0.3, 0.2);
    for (let i = 0; i < 9; i++) { const x = Math.floor(p.r() * 15), y = Math.floor(p.r() * 15); p.set(x, y, 0x2a5a1c); p.set(x + 1, y, 0x35682a); }
  };
  D.logSide = (p) => {
    const cs = [0x6a4a2a, 0x5a3c22, 0x7a5632];
    for (let x = 0; x < 16; x++) { const c = cs[(x + (x >> 2)) % 3]; for (let y = 0; y < 16; y++) p.set(x, y, p.r() < 0.12 ? mul(c, 0.85) : c); }
    p.rect(5, 6, 2, 3, 0x4a3018);
  };
  D.logTop = (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      p.set(x, y, d > 7 ? 0x6a4a2a : Math.floor(d) % 2 ? 0xb08a5a : 0x9a7448);
    }
  };
  D.track = (p) => { p.mottle(0xb84a3a, 0xa84030, 0xc85646, 0.25, 0.15); p.hline(0, 0xe8e8e0); };
  D.fieldLine = (p) => { D.grassTop(p); p.hline(7, 0xeeeee6); p.hline(8, 0xe2e2da); };
  const metal = (p, c) => {
    for (let y = 0; y < 16; y++) {
      const k = 0.95 + p.r() * 0.08;
      for (let x = 0; x < 16; x++) p.set(x, y, mul(c, k * (p.r() < 0.06 ? 0.94 : 1)));
    }
    p.hline(0, mul(c, 1.12)); p.hline(15, mul(c, 0.8));
  };
  D.metal = (p) => metal(p, 0xa8adb2);
  D.metalDark = (p) => metal(p, 0x5e6368);
  D.corrugated = (p) => {
    const cs = [0x8a9090, 0xb0b6b6, 0x9aa0a0, 0x7a8080];
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, cs[x % 4]);
    p.speck(4, [0x9a6a4a]);
  };
  const BOOK = [0x7a1f2a, 0x1f3a6b, 0x2f6a3a, 0xb88a2a, 0xe8dcc0, 0x2a7a7a, 0x5a2a6a, 0x9a4a2a, 0x3a3a3a];
  const books = (p, lean) => {
    p.rect(0, 0, 16, 16, 0x2a1a10);
    for (const y0 of [0, 5, 10, 15]) { p.hline(y0, 0x6b4428); }
    for (const top of [1, 6, 11]) {
      let x = 1;
      while (x < 15) {
        const w = p.r() < 0.6 ? 1 : 2, h = 3 + (p.r() < 0.5 ? 1 : 0), c = BOOK[Math.floor(p.r() * BOOK.length)];
        if (p.r() < 0.1) { x += 1; continue; }            // a gap
        for (let i = 0; i < w && x + i < 15; i++) for (let y = top + 4 - h; y < top + 4; y++) p.set(x + i, y, c);
        p.set(x, top + 4 - h, mul(c, 1.25));               // the band at the top of the spine
        x += w;
      }
      if (lean) { p.set(13, top + 1, 0xe8dcc0); p.set(14, top + 2, 0xe8dcc0); }
    }
    p.vline(0, 0x5a3820); p.vline(15, 0x5a3820);
  };
  D.books = (p) => books(p, false);
  D.booksB = (p) => books(p, true);
  D.shelfSide = (p) => {
    p.mottle(0x7a5232, 0x6a4628, 0x86603c, 0.16, 0.1);
    for (const y of [0, 5, 10, 15]) p.hline(y, 0x5a3820);
    p.vline(0, 0x8a6440);
  };
  D.blackboard = (p) => {
    p.mottle(0x2f5a46, 0x2a5240, 0x356450, 0.2, 0.15);
    p.speck(10, [0x5a7a68, 0x6a8a78]);
    for (const [y, x0, n] of [[4, 2, 7], [7, 3, 9], [10, 2, 5]]) for (let i = 0; i < n; i++) if (p.r() < 0.8) p.set(x0 + i, y, 0xdfe8de);
  };
  D.whiteboard = (p) => {
    p.mottle(0xf0f2f0, 0xe4e8e6, 0xf8faf8, 0.1, 0.1);
    for (const [y, x0, n, c] of [[4, 2, 8, 0x2a4a9a], [7, 2, 10, 0x2a4a9a], [11, 4, 6, 0xb83a3a]]) for (let i = 0; i < n; i++) if (p.r() < 0.85) p.set(x0 + i, y, c);
  };
  D.cork = (p) => {
    p.mottle(0xb8945a, 0xa8844a, 0xc8a46a, 0.25, 0.15);
    for (const [x, y, c] of [[1, 2, 0xf4f0d8], [7, 1, 0xd8e8f4], [3, 9, 0xf4d8d8], [10, 8, 0xe0f4d8]]) {
      p.rect(x, y, 5, 5, c);
      p.hline(y + 2, 0x9a9a9a, x + 1, x + 3); p.hline(y + 3, 0x9a9a9a, x + 1, x + 2);
      p.set(x + 2, y, 0xd83a3a);
    }
  };
  // the students' own: crayon on paper, paper cut and stuck on (the theme: the
  // long way, set against NeuroLex's clean blue and white)
  D.handmade = (p) => {
    p.mottle(0xf6f0dc, 0xece4cc, 0xfaf6e8, 0.1, 0.08);
    const cr = (x, y, c) => { if (p.r() < 0.82) p.set(x, y, c); };
    for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) cr(x, y, 0xf0c020);           // a sun
    [[0, 2], [5, 2], [2, 0], [2, 5], [0, 0], [5, 5]].forEach(([x, y]) => cr(x, y, 0xf0a020));
    for (const [x, y] of [[10, 3], [12, 3], [9, 4], [10, 4], [11, 4], [12, 4], [13, 4], [10, 5], [11, 5], [12, 5], [11, 6]]) cr(x, y, 0xd83a4a);   // a heart
    for (let x = 0; x < 16; x++) { cr(x, 14, 0x3a9a3a); if (p.r() < 0.5) cr(x, 13, 0x4aaa4a); }   // the ground
    cr(7, 8, 0x2a4ab8); cr(7, 9, 0x2a4ab8); cr(7, 10, 0x2a4ab8); cr(6, 9, 0x2a4ab8); cr(8, 9, 0x2a4ab8); cr(6, 11, 0x2a4ab8); cr(8, 11, 0x2a4ab8); cr(7, 7, 0x2a4ab8);   // someone
  };
  D.handmadeB = (p) => {
    p.mottle(0x9ad0e8, 0x8ac0d8, 0xa8dcf0, 0.12, 0.08);
    for (let y = 0; y < 6; y++) for (let x = 6 - y; x <= 6 + y && x < 16; x++) if (x >= 0) p.set(x, y + 1, 0xf08a3a);     // a paper triangle
    p.rect(9, 9, 5, 5, 0xf0a8c8); p.rect(10, 10, 3, 3, 0xf8d0e0);
    const A = ["..#..", ".#.#.", "#...#", "#####", "#...#"], B = ["####.", "#...#", "####.", "#...#", "####."];
    A.forEach((row, y) => row.split("").forEach((ch, x) => { if (ch === "#") p.set(1 + x, 9 + y, 0x1f3a8a); }));
    B.forEach((row, y) => row.split("").forEach((ch, x) => { if (ch === "#") p.set(10 + x, 2 + y, 0x1f3a8a); }));
  };
  D.locker = (p) => {
    p.mottle(0x6f93b3, 0x648aa8, 0x7a9ebe, 0.15, 0.1);
    for (const y of [2, 4, 6]) p.hline(y, 0x3f5f7a, 4, 11);
    p.rect(12, 8, 1, 2, 0xd0d4d6);
    p.hline(12, 0xe8e8e0, 5, 10); p.set(7, 12, 0x3a3a3a);
    p.vline(0, 0x5a7a9a); p.vline(15, 0x5a7a9a); p.hline(0, 0x8aaecc); p.hline(15, 0x4f6f8a);
  };
  const WOODDOOR = [0x8a5a32, 0x7a4e2a, 0x96663c];
  D.doorTop = (p) => {
    p.mottle(WOODDOOR[0], WOODDOOR[1], WOODDOOR[2], 0.18, 0.1);
    p.vline(0, 0x6a4426); p.vline(15, 0x6a4426); p.hline(0, 0x6a4426);
    p.rect(4, 3, 8, 7, 0x5a3820); p.rect(5, 4, 6, 5, 0x9cc4e0); p.set(6, 5, 0xd8ecf6); p.set(7, 5, 0xd8ecf6); p.set(6, 6, 0xd8ecf6);
    p.rect(5, 12, 6, 2, 0xe8e0c8);
  };
  D.doorBottom = (p) => {
    p.mottle(WOODDOOR[0], WOODDOOR[1], WOODDOOR[2], 0.18, 0.1);
    p.vline(0, 0x6a4426); p.vline(15, 0x6a4426); p.hline(15, 0x5a3820);
    for (const y0 of [2, 9]) {
      p.rect(3, y0, 10, 5, 0x6a4426); p.rect(4, y0 + 1, 8, 3, 0x93623a);
    }
    p.rect(13, 0, 1, 2, 0xc8a84a);
  };
  D.glass = (p) => {
    p.mottle(0xa8cce0, 0x9cc2d8, 0xb4d6e8, 0.12, 0.1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 9 === 0 && x < 11 && y < 11) p.set(x, y, 0xe0f0f8);
    p.hline(0, 0x8ab0c8); p.hline(15, 0x8ab0c8); p.vline(0, 0x8ab0c8); p.vline(15, 0x8ab0c8);
  };
  D.frame = (p) => {
    p.rect(0, 0, 16, 16, 0xd0d4d6);
    p.mottle(0x6a90a8, 0x5e849c, 0x7a9cb4, 0.1, 0.1, 2, 2, 12, 12);
    p.set(4, 4, 0xc8e0ee); p.set(5, 4, 0xc8e0ee); p.set(4, 5, 0xc8e0ee);
    p.hline(0, 0xe4e8ea); p.vline(0, 0xe4e8ea); p.hline(15, 0xa8acae); p.vline(15, 0xa8acae);
    p.vline(8, 0xd0d4d6, 2, 13);
  };
  D.curtain = (p) => {
    const cs = [0xa02a2a, 0xb83636, 0x8a2222, 0x962828];
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, cs[x % 4]);
    p.hline(15, 0x6a1818); p.hline(0, 0xc8a84a);
  };
  D.fabricBlue = (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, (x + y) % 2 ? 0x4274aa : 0x3a6aa0); };
  D.sheet = (p) => { p.mottle(0xeeeeea, 0xe2e2dc, 0xf6f6f2, 0.1, 0.08); p.hline(5, 0xd8d8d2, 2, 13); p.hline(11, 0xd8d8d2, 1, 9); };
  D.neurolex = (p) => {
    p.mottle(0xf4f7fa, 0xeaeef2, 0xfafcfe, 0.08, 0.08);
    p.hline(13, 0x2bb6e8); p.hline(14, 0x1a9ad0);
    // the mark: a ring and a point (a mind, read by a machine)
    [[7, 3], [8, 3], [6, 4], [9, 4], [5, 5], [10, 5], [5, 6], [10, 6], [6, 7], [9, 7], [7, 8], [8, 8]].forEach(([x, y]) => p.set(x, y, 0x1a7ac8));
    p.set(7, 5, 0x2bb6e8); p.set(8, 5, 0x2bb6e8); p.set(7, 6, 0x2bb6e8); p.set(8, 6, 0x2bb6e8);
  };
  D.lexaAd = (p) => {
    for (let y = 0; y < 16; y++) { const c = mix(0x1a5aa8, 0x2bb6e8, y / 15); for (let x = 0; x < 16; x++) p.set(x, y, c); }
    for (const [cx, cy] of [[4, 4], [12, 8]]) { p.set(cx, cy, 0xffffff); p.set(cx - 1, cy, 0xd8f0ff); p.set(cx + 1, cy, 0xd8f0ff); p.set(cx, cy - 1, 0xd8f0ff); p.set(cx, cy + 1, 0xd8f0ff); }
    for (let x = 0; x < 16; x++) p.set(x, 12 + Math.round(Math.sin(x / 2.4)), 0xffffff);
  };
  D.screen = (p) => {
    p.rect(0, 0, 16, 16, 0x10202a);
    for (const [y, n] of [[3, 10], [6, 7], [9, 12]]) p.hline(y, 0x3ad0f0, 2, 1 + n);
    for (let i = 0; i < 4; i++) p.vline(10 + i, 0x2bb6e8, 14 - i - 1, 14);
    p.hline(0, 0x2a3a44); p.hline(15, 0x2a3a44); p.vline(0, 0x2a3a44); p.vline(15, 0x2a3a44);
  };
  D.gymFloor = (p) => {
    const cs = [0xc89a5a, 0xbc8e50, 0xd2a466, 0xc49656];
    for (let k = 0; k < 4; k++) { p.mottle(cs[k], mul(cs[k], 0.94), mul(cs[k], 1.04), 0.15, 0.1, 0, k * 4, 16, 4); p.hline(k * 4 + 3, mul(cs[k], 0.86)); }
  };
  D.bleacher = (p) => {
    p.mottle(0x8a6a4a, 0x7a5c3e, 0x9a7854, 0.15, 0.1, 0, 0, 16, 6); p.hline(2, 0x6a5034);
    p.mottle(0x6a6a6a, 0x5e5e5e, 0x767676, 0.2, 0.1, 0, 6, 16, 10); p.hline(6, 0x3a3a3a);
  };
  D.vault = (p) => {
    for (let k = 0; k < 4; k++) { p.mottle(0xa8784a, 0x9a6c40, 0xb48454, 0.15, 0.1, 0, k * 4, 16, 3); p.hline(k * 4 + 3, 0x3a2a1a); }
    p.vline(0, 0x8a6038); p.vline(15, 0x8a6038);
  };
  D.mat = (p) => { p.mottle(0x2a5a9a, 0x245290, 0x3264a6, 0.15, 0.1); p.hline(1, 0xe8e8e0, 1, 14); p.hline(14, 0xe8e8e0, 1, 14); p.vline(1, 0xe8e8e0, 1, 14); p.vline(14, 0xe8e8e0, 1, 14); };
  D.cardboard = (p) => { p.mottle(0xb08a5a, 0xa47e50, 0xbc9664, 0.18, 0.1); p.rect(7, 0, 2, 16, 0xd8c090); p.set(3, 3, 0x5a4028); p.set(3, 4, 0x5a4028); p.set(2, 4, 0x5a4028); p.set(4, 4, 0x5a4028); };
  D.carWhite = (p) => { p.mottle(0xeef0f2, 0xe2e4e8, 0xf8f9fa, 0.08, 0.08); p.hline(2, 0xffffff); p.hline(14, 0xd2d4d8); };
  D.carStripe = (p) => { D.carWhite(p); p.rect(0, 6, 16, 4, 0x1f2f5a); p.hline(6, 0x2a3e72); };
  D.tire = (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      p.set(x, y, d < 2 ? 0x3a3a3c : d < 4.6 ? 0x8a8e92 : d < 5.2 ? 0x5a5e62 : (x + y * 2) % 4 === 0 ? 0x2a2a2c : 0x1e1e20);
    }
  };
  D.headlight = (p) => { p.rect(0, 0, 16, 16, 0x9aa0a6); p.mottle(0xf6f0c0, 0xece6b0, 0xfffbe0, 0.1, 0.1, 2, 2, 12, 12); p.set(4, 4, 0xffffff); p.set(5, 4, 0xffffff); };
  D.emergency = (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); p.set(x, y, d < 4 ? 0xff3a2a : d < 6.5 ? 0xd82a1c : 0xa81e14); }
    p.set(6, 5, 0xffb0a0); p.set(5, 6, 0xffb0a0);
  };
  D.exitSign = (p) => {
    p.rect(0, 0, 16, 16, 0x1f9a4a); p.hline(1, 0xe8f8ee, 1, 14); p.hline(14, 0xe8f8ee, 1, 14); p.vline(1, 0xe8f8ee, 1, 14); p.vline(14, 0xe8f8ee, 1, 14);
    // someone running (drawn for this game), and the way out
    [[6, 4], [5, 6], [6, 6], [7, 6], [6, 7], [4, 7], [8, 5], [6, 8], [7, 9], [5, 9], [8, 10], [4, 10]].forEach(([x, y]) => p.set(x, y, 0xffffff));
    [[10, 8], [11, 8], [12, 8], [11, 7], [11, 9]].forEach(([x, y]) => p.set(x, y, 0xffffff));
  };
  D.clock = (p) => {
    p.rect(0, 0, 16, 16, 0x3a3a3a);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); p.set(x, y, d < 6.2 ? 0xf4f4ee : d < 7.4 ? 0x222222 : 0x3a3a3a); }
    [[7, 2], [8, 2], [13, 7], [13, 8], [7, 13], [8, 13], [2, 7], [2, 8]].forEach(([x, y]) => p.set(x, y, 0x222222));
    [[7, 7], [8, 7], [7, 6], [7, 5], [7, 4], [8, 8], [9, 8], [10, 8], [11, 8]].forEach(([x, y]) => p.set(x, y, 0x222222));
    p.set(8, 6, 0xc83a2a);
  };
  D.paper = (p) => {
    p.mottle(0xf4f2ea, 0xeae8e0, 0xfaf8f2, 0.08, 0.08);
    for (let y = 3; y < 16; y += 3) p.hline(y, 0x9ab8d8);
    p.vline(2, 0xd88a8a);
    for (const [y, n] of [[2, 8], [5, 10], [8, 6], [11, 9]]) for (let i = 0; i < n; i++) if (p.r() < 0.7) p.set(4 + i, y, 0x5a5a6a);
  };
  // plain paint, a step of shade and light
  const paint = (c) => (p) => p.mottle(c, mul(c, 0.9), mul(c, 1.08), 0.14, 0.1);
  D.paintRed = paint(0xc0302a); D.paintBlue = paint(0x2a4a8a); D.paintYellow = paint(0xe8c020); D.paintGreen = paint(0x3a8a4a);
  D.paintBlack = paint(0x222226); D.paintWhite = paint(0xeeeeea); D.paintOrange = paint(0xe8702a); D.paintGrey = paint(0x8a8c90);
  D.pianoKeys = (p) => {
    p.rect(0, 0, 16, 16, 0xf4f2ea);
    for (let x = 1; x < 16; x += 2) p.vline(x, 0xc8c6be);
    for (const x of [1, 3, 7, 9, 11, 15]) p.rect(x, 0, 1, 9, 0x1a1a1a);
    p.hline(15, 0xc8c6be);
  };
  D.drumSkin = (p) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); p.set(x, y, d > 7 ? 0xb8bcc0 : d > 6.2 ? 0x8a8e92 : p.r() < 0.1 ? 0xe2dccc : 0xece6d8); }
  };
  const med = (band) => (p) => {
    p.mottle(0xf2f2ee, 0xe6e6e0, 0xfafaf6, 0.08, 0.08);
    p.rect(0, 5, 16, 5, band); p.hline(5, mul(band, 1.2));
    for (let i = 0; i < 9; i++) if (p.r() < 0.8) p.set(3 + i, 12, 0x5a5a6a);
  };
  D.medGreen = med(0x3a9a5a); D.medBlue = med(0x2a6ab8); D.medOrange = med(0xe8802a);
  D.fireExt = (p) => {
    p.mottle(0xc0302a, 0xa82820, 0xd04038, 0.14, 0.12);
    p.rect(3, 6, 10, 5, 0xf2f2ee); p.hline(8, 0x2a2a2a, 5, 10);
    p.vline(2, 0xe05a50);
  };
  D.lamp = (p) => { p.mottle(0xf6f8ff, 0xe8ecf6, 0xffffff, 0.06, 0.1); p.hline(0, 0xd0d6e2); p.hline(15, 0xd0d6e2); };
  D.lightBlue = (p) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); p.set(x, y, d < 4 ? 0x5ab0ff : d < 6.5 ? 0x2a7ae8 : 0x1a50b8); } p.set(6, 5, 0xc8e4ff); };

  function draw() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const cx = c.getContext("2d"), img = cx.createImageData(W, H);
    TILES.forEach((name, i) => {
      const p = painter(img, (i % COLS) * T, Math.floor(i / COLS) * T, rngOf(7919 * (i + 1) + 13));
      (D[name] || ((q) => q.rect(0, 0, T, T, 0xff00ff)))(p);
    });
    cx.putImageData(img, 0, 0);
    return c;
  }
  function getCanvas() { return canvas || (canvas = draw()); }
  function texture() {
    if (tex) return tex;
    tex = new THREE.CanvasTexture(getCanvas());
    tex.magFilter = THREE.NearestFilter;
    // (16 px tiles on a power of two: each tile stays itself down the mip chain)
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.userData = { shared: true, voxel: true };
    return tex;
  }
  // [u0, v0, u1, v1]: a tile, half a texel in from each edge (v up, as three.js has it)
  function rect(name) {
    const i = IDX[name] != null ? IDX[name] : 0;
    const x = (i % COLS) * T, y = Math.floor(i / COLS) * T, e = 0.5;
    return [(x + e) / W, 1 - (y + T - e) / H, (x + T - e) / W, 1 - (y + e) / H];
  }
  // roughness and metalness, one texel a tile (G and B, as three.js reads them)
  const SURF = {
    metal: [0.42, 0.7], metalDark: [0.45, 0.65], corrugated: [0.5, 0.6], locker: [0.5, 0.55], carWhite: [0.35, 0.25], carStripe: [0.35, 0.25],
    glass: [0.12, 0], frame: [0.35, 0.4], screen: [0.25, 0], headlight: [0.2, 0], tiles: [0.38, 0], tilesGreen: [0.38, 0], terrazzo: [0.52, 0],
    wood: [0.72, 0], woodDark: [0.7, 0], plank: [0.74, 0], gymFloor: [0.55, 0], doorTop: [0.7, 0], doorBottom: [0.7, 0], whiteboard: [0.3, 0], blackboard: [0.85, 0],
  };
  function surface() {
    if (surf) return surf;
    const data = new Uint8Array(COLS * ROWS * 4).fill(255);
    TILES.forEach((name, i) => {
      const s = SURF[name] || [0.92, 0];
      const x = i % COLS, row = ROWS - 1 - Math.floor(i / COLS), q = (row * COLS + x) * 4;
      data[q] = 255; data[q + 1] = Math.round(s[0] * 255); data[q + 2] = Math.round(s[1] * 255);
    });
    surf = new THREE.DataTexture(data, COLS, ROWS, THREE.RGBAFormat);
    surf.magFilter = surf.minFilter = THREE.NearestFilter;
    surf.generateMipmaps = false;
    surf.needsUpdate = true;
    surf.userData = { shared: true, voxel: true };
    return surf;
  }

  // ---------------- a 5 x 7 pixel font (our own) ----------------
  const GLYPHS = {
    A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.", C: ".###.|#...#|#....|#....|#....|#...#|.###.",
    D: "####.|#...#|#...#|#...#|#...#|#...#|####.", E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
    G: ".###.|#...#|#....|#.###|#...#|#...#|.####", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#", I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
    J: "..###|...#.|...#.|...#.|#..#.|#..#.|.##..", K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####",
    M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", N: "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#", O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    P: "####.|#...#|#...#|####.|#....|#....|#....", Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    S: ".####|#....|#....|.###.|....#|....#|####.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..", U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..", W: "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.", X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
    0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", 1: "..#..|.##..|..#..|..#..|..#..|..#..|.###.", 2: ".###.|#...#|....#|...#.|..#..|.#...|#####",
    3: "####.|....#|....#|.###.|....#|....#|####.", 4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", 5: "#####|#....|####.|....#|....#|#...#|.###.",
    6: ".###.|#....|#....|####.|#...#|#...#|.###.", 7: "#####|....#|...#.|..#..|.#...|.#...|.#...", 8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    9: ".###.|#...#|#...#|.####|....#|....#|.###.",
    " ": ".....|.....|.....|.....|.....|.....|.....", ".": ".....|.....|.....|.....|.....|.##..|.##..", ",": ".....|.....|.....|.....|.##..|..#..|.#...",
    "-": ".....|.....|.....|#####|.....|.....|.....", "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..", "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
    ":": ".....|.##..|.##..|.....|.##..|.##..|.....", "/": "....#|....#|...#.|..#..|.#...|#....|#....", "'": "..#..|..#..|.#...|.....|.....|.....|.....",
    "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.", ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...", "#": ".#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.",
    "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#", "+": ".....|..#..|..#..|#####|..#..|..#..|.....", "%": "##...|##..#|...#.|..#..|.#...|#..##|...##",
  };
  const FONT = {};
  Object.keys(GLYPHS).forEach((k) => { FONT[k] = GLYPHS[k].split("|"); });
  const norm = (s) => String(s == null ? "" : s).toUpperCase().replace(/[—–]/g, "-").replace(/[…]/g, "...");
  function hasGlyphs(s) { return norm(s).split("").every((ch) => !!FONT[ch]); }
  function textWidth(s, scale) { const n = norm(s).length; return n ? (n * 6 - 1) * (scale || 1) : 0; }
  // the text's pixels on a 2D canvas, from its top-left corner
  function text(ctx, s, x, y, scale, color) {
    scale = scale || 1;
    ctx.fillStyle = color || "#ffffff";
    norm(s).split("").forEach((ch, i) => {
      const g = FONT[ch] || FONT["?"];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "#") ctx.fillRect(x + (i * 6 + c) * scale, y + r * scale, scale, scale);
    });
  }

  // ---------------- a sign's face ----------------
  // lines: a string or several; o: { scale, pad, fg, bg, edge, light, minW, minH }.
  // A block-style plate: a dark outer pixel line, a light inner one, the text in
  // the pixel font -- or, for text the font has no letters for (Thai), the
  // system's sans-serif, drawn small and enlarged so it is still pixels.
  // Returns { tex, w, h } (w and h in the canvas's pixels, for the plate's shape).
  const hexCss = (h) => "#" + (h >>> 0).toString(16).padStart(6, "0");
  function sign(lines, o) {
    o = o || {};
    lines = [].concat(lines).map((l) => String(l == null ? "" : l));
    const sc = o.scale || 2, pad = (o.pad != null ? o.pad : 3) * sc, lineH = 8 * sc;
    const latin = lines.every(hasGlyphs);
    const c = document.createElement("canvas"), ctx = c.getContext("2d");
    let tw;
    if (latin) tw = Math.max(1, ...lines.map((l) => textWidth(l, sc)));
    else { ctx.font = "bold " + (7 * sc) + "px sans-serif"; tw = Math.max(1, ...lines.map((l) => Math.ceil(ctx.measureText(l).width))); }
    c.width = Math.max(o.minW || 0, tw + pad * 2 + 4 * sc);
    c.height = Math.max(o.minH || 0, lines.length * lineH - sc + pad * 2 + 4 * sc);
    const bg = o.bg != null ? o.bg : 0x1f3a2a, fg = o.fg != null ? o.fg : 0xf4f0dc;
    ctx.fillStyle = hexCss(bg); ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = hexCss(o.edge != null ? o.edge : mul(bg, 0.6)); ctx.fillRect(0, 0, c.width, sc); ctx.fillRect(0, c.height - sc, c.width, sc); ctx.fillRect(0, 0, sc, c.height); ctx.fillRect(c.width - sc, 0, sc, c.height);
    ctx.fillStyle = hexCss(o.light != null ? o.light : mul(bg, 1.45)); ctx.fillRect(sc, sc, c.width - 2 * sc, sc); ctx.fillRect(sc, sc, sc, c.height - 2 * sc);
    const y0 = Math.round((c.height - (lines.length * lineH - sc)) / 2);
    lines.forEach((l, i) => {
      if (latin) text(ctx, l, Math.round((c.width - textWidth(l, sc)) / 2), y0 + i * lineH, sc, hexCss(fg));
      else { ctx.fillStyle = hexCss(fg); ctx.font = "bold " + (7 * sc) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(l, c.width / 2, y0 + i * lineH); }
    });
    // (story round 4: onto a map's shared sheet of signs when one is given -- one
    // material for all of them, so the level's merge bakes them together)
    const uv = o.atlas ? o.atlas.put(c) : null;
    if (uv) return { tex: o.atlas.tex, w: c.width, h: c.height, uv, atlas: o.atlas };
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return { tex: t, w: c.width, h: c.height };
  }
  // a sheet the signs of a map are drawn on, packed in rows (story round 4):
  // put(canvas) -> its [u0, v0, u1, v1], or null when the sheet is full;
  // mat(glow) the sheet's two shared materials (lit, glowing)
  function atlas(W, H) {
    const c = document.createElement("canvas");
    c.width = W || 1024; c.height = H || 1024;
    const ctx = c.getContext("2d"), GAP = 2;
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    let x = 0, y = 0, rowH = 0, n = 0;
    const mats = {};
    return {
      canvas: c, tex: t,
      put(src) {
        const w = src.width + GAP * 2, h = src.height + GAP * 2;
        if (w > c.width) return null;
        if (x + w > c.width) { x = 0; y += rowH; rowH = 0; }
        if (y + h > c.height) return null;
        // (the sign stretched under itself first: its own edge colour round it,
        // which is what a far, filtered look picks up)
        ctx.drawImage(src, x, y, w, h);
        ctx.drawImage(src, x + GAP, y + GAP);
        const r = [(x + GAP) / c.width, 1 - (y + GAP + src.height) / c.height, (x + GAP + src.width) / c.width, 1 - (y + GAP) / c.height];
        x += w; rowH = Math.max(rowH, h); n++;
        t.needsUpdate = true;
        return r;
      },
      mat(glow) {
        const k = glow ? "glow" : "lit";
        if (mats[k]) return mats[k];
        const m = glow ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshLambertMaterial({ map: t });
        if (glow) m.userData.vzGlow = "sign";
        m.userData.shared = true; m.name = "voxel-signs-" + k;
        return (mats[k] = m);
      },
      get count() { return n; },
      get used() { return (y + rowH) / c.height; },
    };
  }

  return { TILES, IDX, GLOW, T, COLS, ROWS, texture, rect, surface, canvas: getCanvas, text, textWidth, hasGlyphs, sign, atlas, mul, mix, rngOf, get made() { return !!tex; } };
})();
