// ===================================================================
// The chapter's people and zombies, built of blocks (story series, round 3)
// -------------------------------------------------------------------
// Design doc, its voxel blocky style sheet: six boxes -- a head, a body, two arms,
// two legs -- in the blocky proportions (the head 8 x 8 x 8 pixels, the body
// 8 x 12 x 4, an arm or a leg 4 x 12 x 4), a face of pixels on the head's front
// and no moving mouth, flat colours with a step or two of pixel shading, moved
// only by turning the boxes at the shoulders, hips and neck. A pixel here is
// G.CONFIG.story.voxel.px metres (32 of them: 1.8 m tall; a block's own is
// 1/16 m, near enough the same).
//
// Every look is painted here in code, at the first chapter that needs it,
// on a 64 x 32 sheet of its own (a layout of this game's -- not any other
// game's skin format), into one atlas of 512 x 256: the twelve characters of
// Chapter 1, the seven of them who turn (their zombie selves), and twelve
// everyday zombies -- students in the Thai uniform (white shirt, navy
// trousers or skirt) and Sprinters in PE kit. Hats, a bun, a stopwatch, a
// dictionary are small boxes of flat colour on top (the sheet's white corner,
// coloured in the vertices); a zombie's eyes and the LEXA patch behind its
// ear glow (unlit). The patch lights up when the LexiLens locks on -- the
// zombie under the crosshair (G.Aim.hover): never the right answer, which
// would give it away (the "Highlight the target word" helper aside).
//
// A zombie is rigged as every other (js/entities.js): hips, knees, feet,
// shoulders, elbows, the neck; the knees, feet and elbows are there but carry
// nothing (a leg is one box), so js/zombieanim.js poses it unchanged, js/aim.js
// hits it part by part (anything on the neck: the head) and js/zombiefx.js
// knocks its head off or bursts it into its own colours. A Crawler lies on
// its front, pulling itself on its arms, its legs dragging behind.
//
// (Story round 5: and six candidates of Room 305 as they were before the LEXA signal
// spiked -- GENERIC.candidates, each `turnsInto` the everyday zombie it becomes.)
//
//   G.VoxelChars.texture()             the atlas
//   G.VoxelChars.CAST / NAMED / GENERIC the ids
//   G.VoxelChars.build(id, o)          a character (o.zombie: its kind's eyes and rig)
//   G.VoxelChars.zombieLook(type, game, who)  a look for js/zombiefactory.js
//   G.VoxelChars.buildZombie(type, look)      the mesh G.buildZombieMesh hands back
//   G.VoxelChars.animate(model, dt, st)       a person standing, walking, talking, waving
//   G.VoxelChars.setLock(model, on)    the LEXA patch lit / dim
//   G.VoxelChars.update(game)          the patch of the zombie under the crosshair
// ===================================================================
window.G = window.G || {};

G.VoxelChars = (function () {
  const C = () => (G.CONFIG.story && G.CONFIG.story.voxel) || {};
  const SW = 64, SH = 32, AW = 512, AH = 256, PER_ROW = AW / SW;
  const mul = (h, k) => G.VoxelTex.mul(h, k), mix = (a, b, k) => G.VoxelTex.mix(a, b, k);

  // ---------------- the sheet's layout (pixels within a sheet) ----------------
  // each box: its faces in three.js's order (+x, -x, +y, -y, +z, -z) as [x, y, w, h]
  // (the character faces +z; its left hand is on +x)
  const HEAD = [[24, 0, 8, 8], [8, 0, 8, 8], [32, 0, 8, 8], [40, 0, 8, 8], [0, 0, 8, 8], [16, 0, 8, 8]];
  const TORSO = [[20, 8, 4, 12], [8, 8, 4, 12], [48, 0, 8, 4], [48, 4, 8, 4], [0, 8, 8, 12], [12, 8, 8, 12]];
  // a limb's four sides side by side (front, outer, back, inner) and its two caps
  const LIMBS = {
    armN: { x: 24, y: 8, top: [56, 8], bot: [60, 8], side: -1 },
    armP: { x: 40, y: 8, top: [56, 12], bot: [60, 12], side: 1 },
    legN: { x: 0, y: 20, top: [56, 16], bot: [60, 16], side: -1 },
    legP: { x: 16, y: 20, top: [56, 20], bot: [60, 20], side: 1 },
  };
  function limbFaces(L) {
    const f = [L.x, L.y, 4, 12], o = [L.x + 4, L.y, 4, 12], b = [L.x + 8, L.y, 4, 12], i = [L.x + 12, L.y, 4, 12];
    return [L.side > 0 ? o : i, L.side > 0 ? i : o, [L.top[0], L.top[1], 4, 4], [L.bot[0], L.bot[1], 4, 4], f, b];
  }
  const SKIRT = [[42, 25, 6, 5], [42, 20, 6, 5], [48, 20, 8, 4], [48, 24, 8, 4], [32, 20, 10, 5], [32, 25, 10, 5]];
  const SWATCH = [58, 2, 4, 4];         // the sheet's white corner: flat colour, coloured in the vertices

  // ---------------- the characters ----------------
  const SKIN = { light: 0xe8c39e, medium: 0xd8a77a, tan: 0xc08a5e, deep: 0x9a6a44 };
  const ZSKIN = { a: 0x8f9c82, b: 0x9aa094, c: 0x86958c };
  const HAIRC = { black: 0x1b1612, brown: 0x33241a, grey: 0x9a9a98, salt: 0x5a5a58 };
  // hair: rows of hair down the front (by column), down the sides (by depth
  // from the front), down the back
  const HAIR = {
    short: { front: [2, 1, 1, 1, 1, 1, 1, 2], side: [2, 3, 3, 3, 4, 5, 5, 5], back: 5 },
    messy: { front: [2, 2, 1, 2, 1, 2, 2, 2], side: [2, 3, 3, 3, 4, 5, 5, 6], back: 6, jag: true },
    spiky: { front: [1, 1, 1, 1, 1, 1, 1, 1], side: [2, 2, 2, 3, 3, 4, 4, 4], back: 4, spikes: true },
    bowl: { front: [3, 3, 3, 3, 3, 3, 3, 3], side: [3, 3, 4, 4, 5, 5, 5, 5], back: 5 },
    buzz: { front: [1, 1, 1, 1, 1, 1, 1, 1], side: [1, 1, 1, 2, 2, 2, 2, 2], back: 2, thin: true },
    bob: { front: [2, 2, 1, 1, 1, 1, 2, 2], side: [6, 6, 6, 6, 6, 7, 7, 7], back: 7 },
    pony: { front: [2, 1, 1, 1, 1, 1, 1, 2], side: [3, 3, 3, 4, 4, 5, 5, 5], back: 5 },
    bun: { front: [2, 1, 1, 1, 1, 1, 1, 2], side: [2, 2, 3, 3, 4, 4, 4, 4], back: 4 },
    parted: { front: [2, 2, 2, 1, 1, 1, 1, 1], side: [2, 2, 3, 3, 4, 4, 4, 4], back: 4 },
    receding: { front: [1, 0, 0, 0, 0, 0, 0, 1], side: [2, 2, 3, 3, 3, 4, 4, 4], back: 4 },
  };
  // the twelve of Chapter 1 (design doc, its list of characters); patch: LEXA patches (the
  // ones bitten -- the janitor, Sgt. Chai -- have none)
  const DEFS = {
    player: { who: "story.who.player", skin: "medium", hair: ["short", "black"], outfit: "studentM", legs: "trousers" },
    beam: { who: "story.who.beam", skin: "medium", hair: ["messy", "black"], outfit: "studentM", legs: "trousers", mouth: "smile", blush: true, band: [0xf0c020, "P", 10], patch: 1 },
    min: { who: "story.who.min", skin: "light", hair: ["bun", "black"], outfit: "teacherF", glasses: 0x6b4a3a, mouth: "stern", extra: ["bun"], skirt: "long" },
    chai: { who: "story.who.chai", skin: "tan", hair: ["short", "black"], outfit: "police", mustache: true, extra: ["capPolice", "holster"], scale: 1.04 },
    somsak: { who: "story.who.somsak", skin: "medium", hair: ["receding", "salt"], outfit: "suit", mouth: "stern", wrinkles: true, patch: 3, scale: 1.02 },
    invig: { who: "story.who.invig", skin: "light", hair: ["parted", "black"], outfit: "corporate", glasses: 0x2bb6e8, patch: 1 },
    porn: { who: "story.who.porn", skin: "tan", hair: ["short", "grey"], outfit: "janitor", mustache: true, wrinkles: true, extra: ["capJanitor"] },
    pim: { who: "story.who.pim", skin: "light", hair: ["bob", "brown"], outfit: "nurse", extra: ["nurseCap"], skirt: "short" },
    ek: { who: "story.who.ek", skin: "tan", hair: ["buzz", "black"], outfit: "tracksuit", stubble: true, mouth: "stern", extra: ["stopwatch"], patch: 1, scale: 1.03 },
    fai: { who: "story.who.fai", skin: "light", hair: ["pony", "black"], outfit: "studentF", glasses: 0x5a4a6a, extra: ["pony"], skirt: "short" },
    tonkla: { who: "story.who.tonkla", skin: "tan", hair: ["spiky", "black"], outfit: "studentM", legs: "trousers", band: [0xc83a3a, "N", 9], rolled: true, mouth: "smile" },
    nam: { who: "story.who.nam", skin: "light", hair: ["bowl", "black"], outfit: "studentM", legs: "trousers", extra: ["dictionary"], scale: 0.92 },
  };
  const CAST = ["player", "beam", "min", "chai", "somsak", "invig", "porn", "pim", "ek", "fai", "tonkla", "nam"];
  // the seven who turn: each one's zombie self
  const NAMED = ["beam", "chai", "somsak", "invig", "porn", "pim", "ek"];
  NAMED.forEach((id, i) => {
    DEFS[id + "_z"] = Object.assign({}, DEFS[id], { base: id, zombie: true, zskin: "abc"[i % 3] },
      id === "chai" ? { extra: ["capPolice", "holster", "vest"], bite: true } : id === "porn" ? { bite: true } : {});
  });
  // everyday zombies: students (who used LEXA: a patch each) and Sprinters in PE kit
  const GENERIC = { students: [], pe: [] };
  const houses = [0xe8c430, 0xc83a3a, 0x2f6ac8, 0x3a9a5a];
  [["short", "black", "trousers"], ["messy", "brown", "shorts"], ["bowl", "black", "trousers"], ["spiky", "black", "shorts"]].forEach((h, i) => {
    const id = "zm" + (i + 1);
    DEFS[id] = { skin: "medium", hair: [h[0], h[1]], outfit: "studentM", legs: h[2], zombie: true, zskin: "abc"[i % 3], patch: 1, generic: true };
    GENERIC.students.push(id);
  });
  [["bob", "black"], ["pony", "brown"], ["bob", "brown"], ["pony", "black"]].forEach((h, i) => {
    const id = "zf" + (i + 1);
    DEFS[id] = { skin: "light", hair: [h[0], h[1]], outfit: "studentF", zombie: true, zskin: "bca"[i % 3], patch: 1, skirt: "short", extra: h[0] === "pony" ? ["pony"] : [], generic: true };
    GENERIC.students.push(id);
  });
  [["short", "shorts"], ["buzz", "track"], ["messy", "shorts"], ["bob", "track"]].forEach((h, i) => {
    const id = "zp" + (i + 1);
    DEFS[id] = { skin: "tan", hair: [h[0], "black"], outfit: "pe", house: houses[i], legs: h[1], zombie: true, zskin: "cab"[i % 3], patch: 1, generic: true };
    GENERIC.pe.push(id);
  });
  // (story round 5) the candidates in Room 305 before the LEXA signal spikes: students as they
  // are, each with the patch behind the ear -- and the everyday zombie each one turns into
  GENERIC.candidates = [];
  [["short", "black", "trousers", "medium", "zm1"], ["bowl", "black", "trousers", "tan", "zm3"], ["spiky", "black", "trousers", "light", "zm4"],
    ["bob", "black", null, "light", "zf1"], ["pony", "brown", null, "medium", "zf2"], ["bob", "brown", null, "tan", "zf3"]].forEach((h, i) => {
    const id = "c" + (i + 1);
    DEFS[id] = h[2] ? { skin: h[3], hair: [h[0], h[1]], outfit: "studentM", legs: h[2], patch: 1, generic: true, turnsInto: h[4] }
      : { skin: h[3], hair: [h[0], h[1]], outfit: "studentF", skirt: "short", extra: h[0] === "pony" ? ["pony"] : [], patch: 1, generic: true, turnsInto: h[4] };
    GENERIC.candidates.push(id);
  });
  const ORDER = CAST.concat(NAMED.map((n) => n + "_z"), GENERIC.students, GENERIC.pe, GENERIC.candidates);
  const SLOT = {};
  ORDER.forEach((id, i) => { SLOT[id] = i; });

  // ---------------- outfits: colours ----------------
  const OUT = {
    studentM: { top: 0xf0efe8, bottom: 0x1f2a4a, shoe: 0x18181a, sock: 0xe8e8e0, sleeves: "short" },
    studentF: { top: 0xf2f1ea, bottom: 0x1f2a4a, shoe: 0x18181a, sock: 0xecece4, sleeves: "short" },
    pe: { top: 0xe8c430, bottom: 0x1f2a4a, shoe: 0xe8e8e8, sock: 0xf0f0ea, sleeves: "short" },
    teacherF: { top: 0x9cc3e0, bottom: 0x2e2e36, shoe: 0x2a2a2a, sock: 0xd8b494, sleeves: "long" },
    police: { top: 0x7a5a32, bottom: 0x4e3a22, shoe: 0x141414, sock: 0x141414, sleeves: "short" },
    suit: { top: 0x2e3138, bottom: 0x2a2d33, shoe: 0x121212, sock: 0x1a1a1a, sleeves: "long" },
    corporate: { top: 0xeef2f6, bottom: 0x2a2f3a, shoe: 0x141414, sock: 0x1a1a1a, sleeves: "long" },
    janitor: { top: 0x4d5d6b, bottom: 0x8a7a5a, shoe: 0x3a2a1a, sock: 0x3a3a3a, sleeves: "rolled" },
    nurse: { top: 0xf4f4f0, bottom: 0xf4f4f0, shoe: 0xe8e8e8, sock: 0xf0f0ec, sleeves: "short" },
    tracksuit: { top: 0x1f2a6b, bottom: 0x1f2a6b, shoe: 0xe8e8e8, sock: 0xf0f0ea, sleeves: "long" },
  };
  function full(id) {
    const D = Object.assign({ id }, DEFS[id] || DEFS.zm1);
    const O = Object.assign({}, OUT[D.outfit] || OUT.studentM);
    if (D.outfit === "pe" && D.house) O.top = D.house;
    D.O = O;
    D.skinHex = D.zombie ? ZSKIN[D.zskin && "abc".includes(D.zskin) ? D.zskin : "a"] : SKIN[D.skin] || SKIN.medium;
    D.hairHex = HAIRC[(D.hair || [])[1]] || HAIRC.black;
    return D;
  }

  // ---------------- painting a sheet ----------------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function paint(img, id) {
    const D = full(id), O = D.O, slot = SLOT[id];
    const sx = (slot % PER_ROW) * SW, sy = Math.floor(slot / PER_ROW) * SH;
    const r = G.VoxelTex.rngOf(hash(id) + 17);
    const Z = !!D.zombie;
    const set = (x, y, h) => {
      const i = ((sy + y) * AW + sx + x) * 4;
      img.data[i] = (h >> 16) & 255; img.data[i + 1] = (h >> 8) & 255; img.data[i + 2] = h & 255; img.data[i + 3] = 255;
    };
    const get = (x, y) => { const i = ((sy + y) * AW + sx + x) * 4; return (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]; };
    // a zombie's clothes: darker, greyer, dirtied (painted at the end)
    const cloth = (h) => (Z ? mix(mul(h, 0.8), 0x6a6a62, 0.18) : h);
    const tone = (h) => { const v = r(); return v < 0.12 ? mul(h, 0.9) : v < 0.2 ? mul(h, 1.06) : h; };
    // one face of a box: fn(x, y) its colour (x to the right, y down, as seen from outside)
    const face = (rect, fn) => { for (let y = 0; y < rect[3]; y++) for (let x = 0; x < rect[2]; x++) { const c = fn(x, y); if (c != null) set(rect[0] + x, rect[1] + y, c); } };
    // a limb's faces by name: front, outer, back, inner (4 x 12), top, bottom (4 x 4)
    const limb = (key, fn) => {
      const L = LIMBS[key];
      ["front", "outer", "back", "inner"].forEach((nm, k) => face([L.x + 4 * k, L.y, 4, 12], (x, y) => fn(nm, x, y)));
      face([L.top[0], L.top[1], 4, 4], (x, y) => fn("top", x, y));
      face([L.bot[0], L.bot[1], 4, 4], (x, y) => fn("bottom", x, y));
    };
    const skin = D.skinHex, sk = (x, y) => tone(skin);
    // ---- the swatch, and skin under everything ----
    for (let y = 0; y < 8; y++) for (let x = 56; x < 64; x++) set(x, y, 0xffffff);
    HEAD.forEach((rc) => face(rc, sk));
    Object.keys(LIMBS).forEach((k) => limb(k, () => tone(skin)));
    // ---- the head: hair ----
    const H = HAIR[(D.hair || ["short"])[0]] || HAIR.short, hc = D.hairHex;
    const hair = (x, y) => { const v = r(); return v < 0.2 ? mul(hc, 0.82) : v < 0.3 ? mul(hc, 1.3) : hc; };
    if (H) {
      face(HEAD[2], hair);                                                          // the top
      face(HEAD[4], (x, y) => (y < H.front[x] ? hair() : null));                   // the front
      // +x (left side: x = 0 at the front) and -x (right side: x = 0 at the back)
      face(HEAD[0], (x, y) => (y < H.side[x] + (H.jag && r() < 0.3 ? 1 : 0) ? hair() : null));
      face(HEAD[1], (x, y) => (y < H.side[7 - x] + (H.jag && r() < 0.3 ? 1 : 0) ? hair() : null));
      face(HEAD[5], (x, y) => (y < H.back + (H.jag && r() < 0.35 ? 1 : 0) ? hair() : null));
      if (H.spikes) face(HEAD[2], (x, y) => ((x + y) % 3 === 0 ? mul(hc, 1.4) : null));
      if (D.hair && D.hair[0] === "receding") { face(HEAD[2], (x, y) => (y > 4 && x > 1 && x < 6 ? tone(skin) : null)); face(HEAD[0], (x, y) => (y < H.side[x] && x > 2 ? mul(HAIRC.grey, 0.95) : null)); face(HEAD[1], (x, y) => (y < H.side[7 - x] && x < 5 ? mul(HAIRC.grey, 0.95) : null)); }
    }
    // ---- the face ----
    const F = (x, y, c) => set(HEAD[4][0] + x, HEAD[4][1] + y, c);
    if (!Z) {
      const pupil = 0x2a1a10, white = 0xf4f4f0, brow = mul(hc, 0.9);
      F(1, 4, white); F(2, 4, pupil); F(5, 4, pupil); F(6, 4, white);
      [1, 2, 5, 6].forEach((x) => F(x, 3, D.glasses ? D.glasses : brow));
      // glasses: the rims and the bridge over the eyes, the arms at the sides (the eyes left clear)
      if (D.glasses) { F(3, 3, D.glasses); F(4, 3, D.glasses); F(0, 4, D.glasses); F(7, 4, D.glasses); F(1, 4, mix(white, D.glasses, 0.18)); F(6, 4, mix(white, D.glasses, 0.18)); }
      F(3, 5, mul(skin, 0.86)); F(4, 5, mul(skin, 0.86));
      const lip = 0x9a5a4e;
      if (D.mouth === "smile") { F(3, 6, lip); F(4, 6, lip); F(2, 5, lip); F(5, 5, lip); }
      else if (D.mouth === "stern") { F(2, 6, mul(skin, 0.7)); F(3, 6, mul(skin, 0.66)); F(4, 6, mul(skin, 0.66)); F(5, 6, mul(skin, 0.7)); }
      else { F(3, 6, lip); F(4, 6, lip); }
      if (D.mustache) { F(2, 5, mul(hc, 1.1)); F(3, 5, mul(hc, 1.1)); F(4, 5, mul(hc, 1.1)); F(5, 5, mul(hc, 1.1)); }
      if (D.blush) { F(1, 5, mix(skin, 0xd87a7a, 0.4)); F(6, 5, mix(skin, 0xd87a7a, 0.4)); }
      if (D.stubble) [1, 2, 3, 4, 5, 6].forEach((x) => { if (r() < 0.6) F(x, 7, mul(skin, 0.8)); });
      if (D.wrinkles) { F(2, 2, mul(skin, 0.88)); F(3, 2, mul(skin, 0.88)); F(5, 2, mul(skin, 0.88)); F(1, 5, mul(skin, 0.9)); F(6, 5, mul(skin, 0.9)); }
    } else {
      const socket = 0x2a2a22;
      F(1, 4, socket); F(2, 4, socket); F(5, 4, socket); F(6, 4, socket);
      F(1, 3, mul(skin, 0.72)); F(6, 3, mul(skin, 0.72));
      F(3, 5, mul(skin, 0.7)); F(4, 5, mul(skin, 0.7));
      F(2, 6, 0x1a0808); F(3, 6, 0xd8d0b8); F(4, 6, 0xd8d0b8); F(5, 6, 0x1a0808); F(3, 7, 0x1a0808); F(4, 7, 0x1a0808);
      for (let i = 0; i < 3; i++) F(r() < 0.5 ? 0 : 7, 5 + Math.floor(r() * 3), mul(skin, 0.72));
      if (D.glasses) { F(0, 4, mul(D.glasses, 0.7)); F(3, 4, mul(D.glasses, 0.7)); F(4, 4, mul(D.glasses, 0.7)); F(7, 4, mul(D.glasses, 0.7)); }
      if (D.mustache) { F(2, 5, mul(hc, 1.1)); F(5, 5, mul(hc, 1.1)); }
    }
    // ---- the body, the arms, the legs ----
    const top = cloth(O.top), bot = cloth(O.bottom), shoe = cloth(O.shoe), sock = cloth(O.sock);
    const T = (x, y) => tone(top), Bt = (x, y) => tone(bot);
    TORSO.forEach((rc) => face(rc, T));
    face(TORSO[3], Bt);
    const front = (fn) => face(TORSO[4], fn), back = (fn) => face(TORSO[5], fn);
    const sides = (fn) => { face(TORSO[0], fn); face(TORSO[1], fn); };
    const below = (y0, c) => { const f = (x, y) => (y >= y0 ? tone(c) : null); front(f); back(f); sides(f); };
    const belt = (y, c, buckle) => { const f = (x, yy) => (yy === y ? c : null); front(f); back(f); sides(f); if (buckle) { front((x, yy) => (yy === y && (x === 3 || x === 4) ? buckle : null)); } };
    const o = D.outfit;
    if (o === "studentM" || o === "studentF" || o === "pe") {
      if (o === "studentF") {
        below(9, bot);
        front((x, y) => (y >= 9 && x % 2 === 0 ? mul(bot, 0.84) : null));
        front((x, y) => (y === 0 && (x === 1 || x === 2 || x === 5 || x === 6) ? mul(top, 0.88) : null));
        front((x, y) => ((y === 1 && x >= 2 && x <= 5) || (y === 2 && (x === 3 || x === 4)) || (y === 3 && x === 3) || (y === 4 && x === 4) ? cloth(0x1f2a4a) : null));
      } else if (o === "pe") {
        below(10, bot); belt(9, cloth(0x1f2a4a));
        front((x, y) => (y === 9 && (x === 3 || x === 4) ? 0xe8e8e8 : y === 0 && x >= 2 && x <= 5 ? 0xf4f4f0 : y === 2 && x === 5 ? 0xf4f4f0 : y === 8 ? mul(top, 0.86) : null));
      } else {
        below(10, bot); belt(9, 0x1a1a1a, 0xc8a84a);
        front((x, y) => {
          if (y === 0 && (x === 3 || x === 4)) return tone(skin);
          if (y === 0 && (x === 1 || x === 2 || x === 5 || x === 6)) return mul(top, 0.88);
          if (y >= 1 && y <= 8 && x === 4) return y % 3 === 2 ? mul(top, 0.78) : mul(top, 0.93);
          if (y === 2 && (x === 5 || x === 6)) return mul(top, 0.86);
          if (y === 3 && x === 5) return cloth(0x2a4aa8);                  // the name embroidered on the pocket
          if (y >= 10 && x === 4) return mul(bot, 0.82);
          if (x === 0 || x === 7) return y < 9 ? mul(top, 0.94) : null;
          return null;
        });
        back((x, y) => (y === 1 ? mul(top, 0.9) : null));
      }
    } else if (o === "teacherF") {
      below(9, bot);
      front((x, y) => (y === 0 && (x <= 2 || x >= 5) ? 0xf0f4f8 : y >= 1 && y <= 8 && x === 4 && y % 3 === 2 ? 0xf0f4f8 : (y <= 2 && x === 2) || (y === 3 && x === 3) ? 0xb83a3a : (y === 4 || y === 5) && (x === 3 || x === 4) ? (x === 3 && y === 4 ? 0x2a5aa8 : 0xf4f4f0) : null));
    } else if (o === "police") {
      below(10, bot); belt(9, 0x141414, 0xd8b040);
      front((x, y) => {
        if (y >= 2 && y <= 4 && (x === 1 || x === 2 || x === 5 || x === 6)) return y === 2 ? mul(top, 0.82) : mul(top, 0.94);
        if (y === 1 && x === 6) return 0xd8b040;
        if (y === 1 && (x === 1 || x === 2)) return x === 1 ? 0xf0f0ea : 0x1a1a1a;
        if (y >= 1 && y <= 8 && x === 4) return y % 3 === 2 ? 0xd8b040 : mul(top, 0.9);
        return null;
      });
      face(TORSO[2], (x, y) => (x <= 1 || x >= 6 ? mul(top, 0.7) : null));     // the shoulder straps
    } else if (o === "suit") {
      below(10, bot);
      front((x, y) => {
        if (y <= 4 && (x === 3 || x === 4)) return y >= 1 && y <= 6 ? 0x7a1f2a : 0xf0f0ec;
        if ((y === 5 || y === 6) && (x === 3 || x === 4)) return 0x7a1f2a;
        if (y <= 5 && (x === 2 || x === 5)) return mul(top, 1.25);
        if (y === 2 && x === 6) return 0x2bb6e8;                           // a NeuroLex pin on the lapel
        if (y === 3 && x === 1) return 0xf0f0ec;
        if (y === 8 && x === 4) return 0x111111;
        return null;
      });
    } else if (o === "corporate") {
      below(10, bot); belt(9, 0x1a1a1a);
      front((x, y) => {
        if (y <= 4 && (x === 3 || x === 4)) return 0xc8d8e8;
        if (y === 0 && (x <= 2 || x >= 5)) return 0x2bb6e8;
        if (y >= 1 && y <= 4 && (x === 2 || x === 5)) return 0x9ad8f0;
        if (y === 3 && x === 6) return 0x2bb6e8;
        if (y === 4 && x === 6) return 0xffffff;
        return null;
      });
    } else if (o === "janitor") {
      below(10, bot); belt(9, 0x5a3a1a);
      front((x, y) => (y === 2 && x === 5 ? 0xf0f0ea : y === 2 && x === 6 ? 0xc83a3a : y === 3 && (x === 1 || x === 2) ? mul(top, 0.84) : y === 2 && x === 1 ? 0xe8c020 : y === 9 && x === 2 ? 0xc8ccd0 : null));
      back((x, y) => (y >= 10 && (x === 5 || x === 6) ? 0xd8c890 : null));
    } else if (o === "nurse") {
      front((x, y) => {
        if (y === 0 && x >= 1 && x <= 6) return 0x9ac8e0;
        if ((y === 1 || y === 2) && (x === 2 || x === 5)) return 0x7a7e84;
        if (y === 3 && (x === 3 || x === 4)) return 0x7a7e84;
        if (y === 4 && x === 4) return 0xb8bcc0;
        if (y === 3 && x === 1) return 0x2a4aa8;
        if (y === 3 && x === 2) return 0xc83a3a;
        if (y === 4 && (x === 1 || x === 2)) return mul(top, 0.88);
        if (y === 3 && x === 6) return 0xd8e8f0;
        return null;
      });
    } else if (o === "tracksuit") {
      front((x, y) => (x === 4 && y <= 9 ? 0xc8c8c8 : y === 0 && (x <= 2 || x >= 5) ? mul(top, 0.8) : (y === 0 && x === 2) || (y === 1 && x === 2) || (y === 2 && x === 3) ? 0xe8e8e8 : y === 3 && x === 3 ? 0xb8bcc0 : null));
    }
    // arms: sleeves (short, long or rolled up), bands, a watch
    const sleeve = O.sleeves, cuff = o === "suit" ? 0xf0f0ec : o === "corporate" ? 0x2bb6e8 : o === "teacherF" ? 0xf0f4f8 : mul(top, 0.86);
    ["armN", "armP"].forEach((k) => limb(k, (nm, x, y) => {
      if (nm === "top") return tone(top);
      if (nm === "bottom") return tone(skin);
      let n = sleeve === "long" ? 10 : sleeve === "rolled" ? 6 : D.rolled ? 3 : 4;
      if (y < n) {
        if (o === "tracksuit" && nm === "outer" && (x === 1 || x === 2)) return x === 1 ? 0xe8e8e8 : 0xc83a3a;
        if (o === "pe" && nm === "outer" && y === 2) return 0xf4f4f0;
        if (y === n - 1) return sleeve === "long" ? tone(top) : mul(top, 0.86);
        return tone(top);
      }
      if (sleeve === "long" && y === 10) return cuff;
      if (sleeve === "rolled" && y === 6) return mul(top, 1.15);
      return tone(skin);
    }));
    if (D.band) { const key = D.band[1] === "P" ? "armP" : "armN"; limb(key, (nm, x, y) => (y === D.band[2] && nm !== "top" && nm !== "bottom" ? D.band[0] : null)); }
    if (o === "police") limb("armP", (nm, x, y) => (y === 9 && nm !== "top" && nm !== "bottom" ? (nm === "front" && x === 1 ? 0xc8ccd0 : 0x1a1a1a) : null));
    // legs: trousers, shorts, a skirt's (bare legs under it), socks, shoes
    const legs = D.legs || (o === "studentF" || o === "nurse" || o === "teacherF" ? "bare" : o === "pe" ? "shorts" : "trousers");
    ["legN", "legP"].forEach((k) => limb(k, (nm, x, y) => {
      if (nm === "bottom") return mul(shoe, 0.7);
      if (nm === "top") return tone(legs === "bare" ? skin : bot);
      if (y === 11) return nm === "front" && x === 1 && o === "suit" ? 0x3a3a3a : tone(shoe);
      if (o === "police" && y === 10) return tone(shoe);
      if (legs === "trousers" || legs === "track") {
        if ((o === "tracksuit" || legs === "track") && nm === "outer" && (x === 1 || x === 2)) return x === 1 ? 0xe8e8e8 : o === "tracksuit" ? 0xc83a3a : 0xe8e8e8;
        if (nm === "front" && x === 1 && y < 10) return mul(bot, 0.92);
        return tone(bot);
      }
      if (legs === "shorts") return y < 5 ? (nm === "outer" && x === 1 && o === "pe" ? 0xe8e8e8 : tone(bot)) : y < 9 ? tone(skin) : tone(sock);
      // bare: under a skirt or a dress
      if (o === "nurse") return y < 10 ? tone(0xf0f0ec) : tone(shoe);
      return y < 8 ? tone(skin) : tone(sock);
    }));
    // the skirt's box (a skirt, a teacher's long one, a nurse's dress)
    const sc = o === "nurse" ? top : bot;
    SKIRT.forEach((rc, fi) => face(rc, (x, y) => (fi >= 4 && x % 2 === 0 ? mul(cloth(sc), 0.85) : y === rc[3] - 1 && fi !== 2 && fi !== 3 ? mul(cloth(sc), 0.78) : tone(cloth(sc)))));
    // ---- a zombie: dirt, torn cloth, grey skin showing through ----
    if (Z) {
      const dirt = [0x4a4034, 0x5a5040, 0x3a342a];
      [TORSO, [SKIRT[4], SKIRT[5]]].forEach((boxes) => boxes.forEach((rc) => face(rc, () => (r() < 0.08 ? dirt[Math.floor(r() * 3)] : null))));
      Object.keys(LIMBS).forEach((k) => limb(k, (nm) => (nm !== "top" && nm !== "bottom" && r() < 0.06 ? dirt[Math.floor(r() * 3)] : null)));
      for (let i = 0; i < 3; i++) {             // rips: skin showing through the shirt
        const fx = Math.floor(r() * 6), fy = 1 + Math.floor(r() * 6);
        face(TORSO[4], (x, y) => ((x === fx || x === fx + 1) && y === fy ? mul(skin, 0.9) : null));
      }
      face(TORSO[5], (x, y) => (y === 2 + Math.floor(r() * 5) && x > 1 && x < 6 && r() < 0.4 ? mul(skin, 0.86) : null));
    }
  }

  let canvas = null, tex = null;
  function draw() {
    const c = document.createElement("canvas");
    c.width = AW; c.height = AH;
    const cx = c.getContext("2d"), img = cx.createImageData(AW, AH);
    ORDER.forEach((id) => paint(img, id));
    cx.putImageData(img, 0, 0);
    return c;
  }
  function getCanvas() { return canvas || (canvas = draw()); }
  function texture() {
    if (tex) return tex;
    tex = new THREE.CanvasTexture(getCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.userData = { shared: true, voxel: true };
    return tex;
  }

  // ---------------- materials ----------------
  const num = (x) => { const s = String(+x); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; };
  const cmats = {};
  // "zombie": as the campaign's zombies are lit (per pixel, the cyan rim, a least
  // light -- js/visuals.js zombieMaterials), on this atlas; "human": the same
  // with a soft warm rim
  function charMat(kind) {
    if (cmats[kind]) return cmats[kind];
    const map = texture();
    const V = G.VISUAL, std = !!(V && G.ZOMBIE_MATS && G.ZOMBIE_MATS.lambert && G.ZOMBIE_MATS.lambert.isMeshStandardMaterial);
    let m;
    if (std) {
      const Z = V.zombies, F = V.fog, M = V.materials.zombie;
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: M.roughness, metalness: M.metalness, map });
      m.userData.vzRim = kind === "zombie" ? { color: new THREE.Color(Z.rim).multiplyScalar(Z.rimStrength), power: Z.rimPower }
        : { color: new THREE.Color(0xfff0dc).multiplyScalar(Z.rimStrength * 0.45), power: Z.rimPower };
      m.userData.vzMinLight = new THREE.Color(Z.minLight);
      m.userData.vzMark = true;
      m.defines = Object.assign({}, m.defines, { VZ_FOG_SCALE: num(F.zombieScale), VZ_FOG_RANGE: num(F.combatRange) });
    } else m = new THREE.MeshLambertMaterial({ vertexColors: true, map });
    m.userData.shared = true;
    m.userData.voxelChar = kind;
    m.name = "voxel-char-" + kind;
    return (cmats[kind] = m);
  }
  const glowMat = () => (G.ZOMBIE_MATS && G.ZOMBIE_MATS.basic) || (cmats.glow || (cmats.glow = Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true }), { userData: { shared: true } })));

  // ---------------- building a model ----------------
  // UV rectangles of a sheet's faces: [x, y, w, h] (sheet px) -> [u0, v0, u1, v1, rot]
  function rectsOf(slot, faces, rots) {
    const sx = (slot % PER_ROW) * SW, sy = Math.floor(slot / PER_ROW) * SH;
    return faces.map((f, i) => {
      const u0 = (sx + f[0]) / AW, u1 = (sx + f[0] + f[2]) / AW, vT = 1 - (sy + f[1]) / AH, vB = 1 - (sy + f[1] + f[3]) / AH;
      const e = 0.02 / AW;          // (a hair inside, so a face never picks up its neighbour's edge)
      return [u0 + e, vB + e, u1 - e, vT - e, rots ? rots[i] : 0];
    });
  }
  // a part being built: boxes into a lit buffer and a glowing one, and the
  // pieces' boxes and colours (js/zombiefx.js shatters a zombie into them)
  function Part() { this.lit = new G.Voxel.Buf(true); this.glow = new G.Voxel.Buf(true); this.parts = []; this.patch = null; }
  // a box from (x0, y0, z0) to (x1, y1, z1), in pixels, on a sheet's faces
  Part.prototype.box = function (P, b, rects, color) {
    G.Voxel.addBox(this.lit, b[0] * P, b[1] * P, b[2] * P, b[3] * P, b[4] * P, b[5] * P, null, { rects });
    this.parts.push({ box: new THREE.Box3(new THREE.Vector3(b[0] * P, b[1] * P, b[2] * P), new THREE.Vector3(b[3] * P, b[4] * P, b[5] * P)), color: new THREE.Color(color) });
  };
  // a box of one flat colour (the swatch, coloured in the vertices); glow: unlit, an HDR colour
  Part.prototype.flat = function (P, b, hex, glow, k, slot) {
    const sw = rectsOf(slot, [SWATCH])[0];
    const c = new THREE.Color(hex).multiplyScalar(k || 1);
    const buf = glow ? this.glow : this.lit;
    const start = buf.v;
    G.Voxel.addBox(buf, b[0] * P, b[1] * P, b[2] * P, b[3] * P, b[4] * P, b[5] * P, null, { rects: [sw, sw, sw, sw, sw, sw], colors: true, color: [c.r, c.g, c.b] });
    if (!glow) this.parts.push({ box: new THREE.Box3(new THREE.Vector3(b[0] * P, b[1] * P, b[2] * P), new THREE.Vector3(b[3] * P, b[4] * P, b[5] * P)), color: new THREE.Color(hex) });
    return { start, count: buf.v - start };
  };
  // into meshes on a group: the lit one (the atlas) and the glowing one
  Part.prototype.into = function (group, kind, name) {
    const out = [];
    if (this.lit.v) {
      const m = new THREE.Mesh(this.lit.geometry(), charMat(kind));
      m.userData.parts = this.parts; m.castShadow = true; m.receiveShadow = false;
      if (name) m.name = name;
      group.add(m); out.push(m);
    }
    if (this.glow.v) {
      const m = new THREE.Mesh(this.glow.geometry(), glowMat());
      m.userData.parts = [];
      group.add(m); out.push(m);
      if (this.patch) { this.patch.mesh = m; }
    }
    return out;
  };

  // the overlays: small boxes of flat colour, in pixels, on a part
  // [part, box, colour] -- part: head | upper | armN | armP
  function extras(D) {
    const hc = D.hairHex, out = [];
    (D.extra || []).forEach((e) => {
      if (e === "capPolice") {
        out.push(["head", [-4.4, 7.2, -4.4, 4.4, 9.4, 4.4], 0x5a4428, "helmet"], ["head", [-4.46, 7.2, -4.46, 4.46, 7.9, 4.46], 0x1a1a1a, "helmet"],
          ["head", [-3.6, 7.0, 3.8, 3.6, 7.5, 6.6], 0x141414, "helmet"], ["head", [-0.6, 7.9, 4.42, 0.6, 8.9, 4.6], 0xd8b040, "helmet"]);
      } else if (e === "capJanitor") out.push(["head", [-4.3, 7, -4.3, 4.3, 9, 4.3], 0x2a3a5a], ["head", [-3.5, 7, 3.8, 3.5, 7.5, 6.4], 0x22304a]);
      else if (e === "nurseCap") out.push(["head", [-3, 8, -0.5, 3, 9.6, 3.5], 0xf6f6f2], ["head", [-3.05, 8.7, 0.3, 3.05, 9.1, 3.55], 0x9ac8e0]);
      else if (e === "bun") out.push(["head", [-1.6, 4, -6.2, 1.6, 7, -4], mul(hc, 1.05)]);
      else if (e === "pony") out.push(["head", [-1, 1.5, -5.4, 1, 6.5, -4], mul(hc, 1.05)], ["head", [-1.1, 5.6, -5.5, 1.1, 6.2, -4], 0xc83a5a]);
      else if (e === "holster") out.push(["upper", [4, 0.5, -1, 5.4, 4, 1.2], 0x1a1a1a], ["upper", [4.2, 3.6, -0.5, 5.2, 5.2, 0.6], 0x2a2a2a]);
      else if (e === "stopwatch") out.push(["upper", [-1, 5, 2, 1, 7, 2.6], 0x2a2a2a], ["upper", [-0.7, 5.3, 2.6, 0.7, 6.7, 2.72], 0xd8dcdc]);
      else if (e === "dictionary") out.push(["armN", [-1.6, -11, 1.8, 1.6, -6.5, 3.4], 0x8a2a2a], ["armN", [-1.4, -6.62, 2.0, 1.4, -6.4, 3.2], 0xf0ead8]);
      else if (e === "vest") out.push(["upper", [-4.6, 2, -2.6, 4.6, 11, 2.6], 0x1f2a3a], ["upper", [-4.66, 8, -2.66, 4.66, 8.7, 2.66], 0xc8ccd0]);
    });
    return out;
  }

  // A character. o: { zombie (a kind: its eyes; omitted for a person), gore }
  function build(id, o) {
    o = o || {};
    const D = full(id), P = C().px || 0.05625, slot = SLOT[id] != null ? SLOT[id] : SLOT.zm1;
    const kind = o.zombie ? "zombie" : "human";
    const ztype = o.zombie || null;
    const gore = o.gore || (G.ZombieFactory ? G.ZombieFactory.gore({ type: ztype || "normal" }) : "full");
    const GC = (hex) => (G.ZombieFactory ? G.ZombieFactory.goreColor(hex, gore) : hex);
    const g = new THREE.Group();
    const hbs = [];
    const HB = (parent, w, h, d, x, y, z, part, rx) => hbs.push({ parent, w: w * P, h: h * P, d: d * P, x: x * P, y: y * P, z: z * P, part, rx: rx || 0 });
    const ex = extras(D);
    const headPart = new Part(), upperPart = new Part();
    const helmet = ztype && ex.some((e) => e[3] === "helmet") ? new Part() : null;
    const crawl = ztype === "crawler";
    // the head (on the neck: x -4..4, y 0..8, z -4..4 px)
    const hb = crawl ? [-4, -2, -1, 4, 6, 7] : [-4, 0, -4, 4, 8, 4];
    headPart.box(P, hb, rectsOf(slot, HEAD), D.skinHex);
    ex.forEach((e) => {
      if (e[0] !== "head") return;
      const b = crawl ? [e[1][0], e[1][1] - 2, e[1][2] + 3, e[1][3], e[1][4] - 2, e[1][5] + 3] : e[1];
      if (e[3] === "helmet" && helmet) helmet.flat(P, b, e[2], false, 1, slot);
      else headPart.flat(P, b, e[2], false, 1, slot);
    });
    const dy = crawl ? -2 : 0, dz = crawl ? 3 : 0;
    // a zombie's eyes and the LEXA patch (behind the left ear; three on the nape for the principal)
    const K = (G.ZombieFactory && G.ZombieFactory.KIND[ztype]) || null;
    if (K) {
      const eyeK = Math.max(1, ((G.VISUAL && G.VISUAL.lighting && G.VISUAL.lighting.eyes) || 1) * (K.glow || 0.6));
      [[-2, -1], [1, 2]].forEach(([a, b]) => headPart.flat(P, [a, 3 + dy, 4 + dz, b, 4 + dy, 4.3 + dz], K.eye, true, K.glow ? eyeK : 1, slot));
      if (K.pupil != null) [[-1.7, -1.3], [1.3, 1.7]].forEach(([a, b]) => headPart.flat(P, [a, 3.3 + dy, 4.3 + dz, b, 3.7 + dy, 4.36 + dz], K.pupil, true, eyeK, slot));
      if (gore === "full") headPart.flat(P, [-1, 1.2 + dy, 4 + dz, 1, 1.8 + dy, 4.08 + dz], GC(0x7a1010), false, 1, slot);
    }
    const nPatch = D.patch || 0;
    if (nPatch) {
      const boxes = nPatch >= 3 ? [[-2.5, 0.5, -4.26, -1.5, 1.5, -4], [-0.5, 0.5, -4.26, 0.5, 1.5, -4], [1.5, 0.5, -4.26, 2.5, 1.5, -4]] : [[4, 3, -2.6, 4.26, 5, -1.4]];
      const idle = C().patchIdle != null ? C().patchIdle : 0.55;
      const start = headPart.glow.v;
      boxes.forEach((b) => headPart.flat(P, [b[0], b[1] + dy, b[2] + dz, b[3], b[4] + dy, b[5] + dz], 0x2bb6e8, true, ztype ? idle : 0.35, slot));
      headPart.patch = { start, count: headPart.glow.v - start, n: nPatch };
    }
    // the body (on the hips: x -4..4, y 0..12, z -2..2 px)
    const upper = new THREE.Group(), neck = new THREE.Group();
    const torsoRects = crawl ? rectsOf(slot, [TORSO[0], TORSO[1], TORSO[5], TORSO[4], TORSO[2], TORSO[3]], [3, 1, 2, 0, 0, 2]) : rectsOf(slot, TORSO);
    if (crawl) upperPart.box(P, [-4, -2, -6, 4, 2, 6], torsoRects, D.O.top);
    else upperPart.box(P, [-4, 0, -2, 4, 12, 2], torsoRects, D.O.top);
    ex.forEach((e) => { if (e[0] === "upper" && !crawl) upperPart.flat(P, e[1], e[2], false, 1, slot); });
    if (D.skirt && !crawl) upperPart.box(P, D.skirt === "long" ? [-5, -8, -3, 5, 1, 3] : [-5, -4, -3, 5, 1, 3], rectsOf(slot, SKIRT), D.outfit === "nurse" ? D.O.top : D.O.bottom);
    if (K && gore === "full") upperPart.flat(P, crawl ? [-2.5, -2.12, 1, -0.5, -2, 3] : [-2.5, 5, 2, -0.5, 7.5, 2.12], GC(0x6a0e0e), false, 1, slot);
    const limbs = {};
    const armPart = (key, side) => {
      const p = new Part();
      p.box(P, [-2, -10, -2, 2, 2, 2], rectsOf(slot, limbFaces(LIMBS[key])), D.O.sleeves === "long" ? D.O.top : D.skinHex);
      ex.forEach((e) => { if (e[0] === key) p.flat(P, e[1], e[2], false, 1, slot); });
      if (K && D.bite && key === "armP") p.flat(P, [-2.08, -5, -2.08, 2.08, -3.6, 2.08], GC(0x5e1414), false, 1, slot);
      return p;
    };
    if (crawl) {
      const torsoG = new THREE.Group(); torsoG.position.set(0, 2.2 * P, 0); g.add(torsoG);
      upperPart.into(torsoG, kind, "body");
      HB(torsoG, 8, 4, 12, 0, 0, 0, "body");
      neck.position.set(0, 3 * P, 6 * P); g.add(neck);
      headPart.into(neck, kind, "head");
      HB(neck, 8, 8, 8, 0, 2, 3, "head");
      const makeArm = (key, side) => {
        const sh = new THREE.Group(); sh.position.set(side * 6 * P, 3.5 * P, 5 * P); g.add(sh);
        armPart(key, side).into(sh, kind);
        const el = new THREE.Group(); el.position.y = -5 * P; sh.add(el);
        HB(sh, 4, 8, 4, 0, -2, 0, "arm"); HB(sh, 4, 4, 4, 0, -8, 0, "hand");
        return { shoulder: sh, elbow: el, side };
      };
      const legRots = [3, 1, 2, 0, 0, 2];
      const makeStump = (key, side) => {
        const p = new Part();
        const F = limbFaces(LIMBS[key]);
        // lying behind it, face down: its front on the floor, the hip end forward
        p.box(P, [-2, -2, -12, 2, 2, 0], rectsOf(slot, [F[0], F[1], F[5], F[4], F[2], F[3]], legRots), D.O.bottom);
        const holder = new THREE.Group();
        p.into(holder, kind);
        const m = holder.children[0];
        holder.remove(m);
        m.position.set(side * 2 * P, 2 * P, -6 * P);
        g.add(m);
        HB(m, 4, 4, 12, 0, 0, -6, "leg");
        return m;
      };
      g.userData.limbs = { armL: makeArm("armN", -1), armR: makeArm("armP", 1), stumpL: makeStump("legN", -1), stumpR: makeStump("legP", 1) };
      g.userData.pullSide = G.rng() < 0.5 ? -1 : 1;
      g.userData.crawler = true;
      g.userData.torso = torsoG;
      g.userData.torsoBaseY = torsoG.position.y;
      g.userData.top = 1.1;
    } else {
      const hipY = 12 * P;
      upper.position.y = hipY; g.add(upper);
      upperPart.into(upper, kind, "body");
      HB(upper, 8, 12, 4, 0, 6, 0, "body");
      if (D.skirt) HB(upper, 10, D.skirt === "long" ? 9 : 5, 6, 0, D.skirt === "long" ? -3.5 : -1.5, 0, "body");
      neck.position.y = 12 * P; upper.add(neck);
      headPart.into(neck, kind, "head");
      HB(neck, 8, 8.6, 8, 0, 4.3, 0, "head");
      if (helmet) {
        const hg = new THREE.Group(); neck.add(hg);
        helmet.into(hg, kind).forEach((m) => { m.userData.helmet = true; });
        g.userData.helmet = hg;
      }
      const makeArm = (key, side) => {
        const sh = new THREE.Group(); sh.position.set(side * 6 * P, 10 * P, 0); upper.add(sh);
        armPart(key, side).into(sh, kind);
        const el = new THREE.Group(); el.position.y = -5 * P; sh.add(el);
        HB(sh, 4, 8, 4, 0, -2, 0, "arm"); HB(sh, 4, 4, 4, 0, -8, 0, "hand");
        return { shoulder: sh, elbow: el, side, grip: new THREE.Vector3(0, -10 * P, 0.04) };
      };
      const makeLeg = (key, side) => {
        const hip = new THREE.Group(); hip.position.set(side * 2 * P, hipY, 0); g.add(hip);
        const p = new Part();
        p.box(P, [-2, -12, -2, 2, 0, 2], rectsOf(slot, limbFaces(LIMBS[key])), D.O.bottom);
        p.into(hip, kind);
        const knee = new THREE.Group(); knee.position.y = -6 * P; hip.add(knee);
        const foot = new THREE.Group(); foot.position.y = -6 * P; knee.add(foot);
        HB(hip, 4, 12, 4, 0, -6, 0, "leg");
        return { hip, knee, foot, side };
      };
      limbs.armL = makeArm("armN", -1); limbs.armR = makeArm("armP", 1);
      limbs.legL = makeLeg("legN", -1); limbs.legR = makeLeg("legP", 1);
      g.userData.limbs = limbs;
      g.userData.upper = upper;
      g.userData.hipY = hipY;
      g.userData.top = (D.extra || []).some((e) => e === "capPolice" || e === "capJanitor" || e === "nurseCap") ? 33.6 * P : 32 * P;
    }
    g.userData.neck = neck;
    neck.userData.isNeck = true;
    if (headPart.patch) g.userData.patch = headPart.patch;
    g.userData.voxel = id;
    g.userData.hitboxes = G.Aim ? G.Aim.makeHitboxes(hbs) : [];
    const s = D.scale || 1;
    g.scale.setScalar(s);
    g.rotation.order = "YXZ";
    return g;
  }

  // a person into a level, standing at (x, z): kept out of the level's merge (it moves)
  function place(kit, id, x, z, ry, o) {
    const m = build(id, o);
    m.position.set(x, 0, z);
    if (ry) m.rotation.y = ry;
    kit.scene.add(m);
    (kit.world.noMerge = kit.world.noMerge || []).push(m);
    return m;
  }

  // ---------------- zombies ----------------
  function on() { return C().zombies !== false; }
  // a look for a chapter's zombie: a named one's own (who), else an everyday
  // one of its kind -- none alive the same, while there are others to pick
  function zombieLook(type, game, who) {
    let id = null;
    if (who) id = DEFS[who + "_z"] ? who + "_z" : DEFS[who] ? who : null;
    if (!id) {
      const pool = type === "fast" ? GENERIC.pe : type === "ironclad" ? ["chai_z"] : GENERIC.students;
      const alive = new Set(((game && game.zombies) || []).filter((z) => z.alive && z.look && z.look.voxel).map((z) => z.look.voxel));
      const fresh = pool.filter((p) => !alive.has(p));
      id = G.pick(fresh.length ? fresh : pool);
    }
    const D = full(id);
    return {
      voxel: id, who: who || null, outfit: "voxel:" + id, tone: "voxel", face: id, odd: null, oddSide: 1, legs: "voxel", extras: new Set(),
      skin: new THREE.Color(D.skinHex), top: new THREE.Color(D.O.top), bottom: new THREE.Color(D.O.bottom), sleeves: D.O.sleeves, fabric: "voxel", helmet: null,
    };
  }
  // the mesh js/entities.js G.buildZombieMesh hands back for a voxel look
  function buildZombie(type, look) {
    const def = G.ZOMBIE_TYPES[type] || G.ZOMBIE_TYPES.normal;
    const g = build(look.voxel, { zombie: type });
    g.userData.look = look;
    g.userData.kind = type;
    // (its kind's size on top of the character's own)
    g.scale.multiplyScalar(def.scale || 1);
    g.userData.baseLean = (G.rng() - 0.5) * 0.14;
    g.rotation.z = g.userData.baseLean;
    return g;
  }

  // ---------------- the LEXA patch ----------------
  function setLock(model, onLock) {
    const u = model && model.userData, pt = u && u.patch;
    if (!pt || !pt.mesh || pt.lit === !!onLock) return;
    pt.lit = !!onLock;
    const k = onLock ? (C().patchLock || 2.6) : (C().patchIdle != null ? C().patchIdle : 0.55);
    const c = new THREE.Color(onLock ? 0x6ae8ff : 0x2bb6e8).multiplyScalar(k);
    const col = pt.mesh.geometry.attributes.color;
    for (let i = pt.start; i < pt.start + pt.count; i++) col.setXYZ(i, c.r, c.g, c.b);
    col.needsUpdate = true;
  }
  let hover = null;
  // (each frame of a chapter, js/story/story.js) the zombie under the crosshair: its patch lit
  function update(game) {
    const h = G.Aim && G.Aim.hover && G.Aim.hover.alive ? G.Aim.hover : null;
    if (h === hover) return;
    if (hover && hover.mesh) setLock(hover.mesh, false);
    hover = h;
    if (h && h.mesh) setLock(h.mesh, true);
  }

  // ---------------- a person moving ----------------
  // st: { speed (m/s: the walk), talk, wave, look (radians, the head turned) }
  function animate(model, dt, st) {
    st = st || {};
    const u = model.userData, L = u.limbs;
    if (!L || !L.legL) return;
    const a = u.npc || (u.npc = { t: G.rng() * 10, ph: 0, walk: 0, seed: G.rng() * 6 });
    a.t += dt;
    const sp = st.speed || 0;
    a.walk += ((sp > 0.05 ? 1 : 0) - a.walk) * Math.min(1, dt * 6);
    a.ph += dt * sp * 2.6;
    const sw = Math.sin(a.ph) * 0.72 * a.walk, idle = 1 - a.walk;
    L.legL.hip.rotation.x = sw; L.legR.hip.rotation.x = -sw;
    const breathe = Math.sin(a.t * 1.7 + a.seed) * 0.035 * idle;
    L.armL.shoulder.rotation.set(-sw * 0.9 + breathe, 0, -0.05);
    L.armR.shoulder.rotation.set(sw * 0.9 - breathe, 0, 0.05);
    if (st.talk) L.armR.shoulder.rotation.set(-0.5 + Math.sin(a.t * 3.1) * 0.25, 0, 0.15 + Math.sin(a.t * 2.3) * 0.1);
    if (st.wave) L.armR.shoulder.rotation.set(-2.7, 0, 0.25 + Math.sin(a.t * 9) * 0.35);
    u.upper.position.y = u.hipY + Math.abs(Math.sin(a.ph)) * 0.025 * a.walk + Math.sin(a.t * 1.7 + a.seed) * 0.004;
    u.neck.rotation.set(st.talk ? Math.sin(a.t * 5.3) * 0.07 : Math.sin(a.t * 0.6 + a.seed) * 0.03, (st.look || 0) + Math.sin(a.t * 0.37 + a.seed) * 0.12 * idle, 0);
  }

  return {
    texture, canvas: getCanvas, DEFS, CAST, NAMED, GENERIC, ORDER, SLOT, HEAD, TORSO, LIMBS, SKIRT, full, build, place, zombieLook, buildZombie, on,
    setLock, update, animate, charMat, get made() { return !!tex; }, get hover() { return hover; }, reset() { hover = null; },
  };
})();
