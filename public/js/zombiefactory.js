// ===================================================================
// The zombies' looks (overhaul, round 4)
// -------------------------------------------------------------------
// Ten kinds (docs/overhaul/zombie-concepts.md), built of boxes like
// everything else (G.buildZombieMesh, js/entities.js). This file is what
// they share and what sets them apart:
//
//   the atlas     one small pixel texture drawn at load (no files): sixteen
//                 16 px tiles -- skin, rotting skin, shirt and its buttoned
//                 front, trousers, a gym knit, a coat, metal, hair, shoes,
//                 three faces, gore, bone, a plain grain -- in grey, three
//                 bands each (shadow, base, highlight), multiplied by each
//                 part's own colour. Every zombie (and every boss) is drawn
//                 with the same one or two materials: a texel is ~3.5 cm, a
//                 face gets a whole face tile.
//   the kinds     their eyes (colour and glow -- each kind its own), their
//                 faces, what they wear in each level (a Sprinter at the
//                 school is in its gym kit, an Ironclad in a hard hat or a
//                 riot helmet), how they are built (js/entities.js ZOMBIE_BUILD)
//   variety       no two alive alike in every part (kind, outfit, skin, face,
//                 extras), and a wave's zombies wear at least
//                 G.CONFIG.zombies.variety outfits before one comes again
//   blood & gore  Settings > Accessibility: Full, Reduced (no blood thrown,
//                 no heads knocked off: they go to smoke), Off (no red at all:
//                 grey dust). A Runt is always Reduced at most.
//
//   G.ZombieSkin.texture()           the atlas
//   G.ZombieSkin.uvOf               a merge's UVs (G.Perf.mergeLocalColored)
//   G.ZombieFactory.look(type, theme, game)   a look for a new zombie
//   G.ZombieFactory.gore(z)          "full" | "reduced" | "off" for that zombie
// ===================================================================
window.G = window.G || {};

G.ZombieSkin = (function () {
  const TILE = 16, COLS = 8, ROWS = 2;
  const TILES = ["skin", "rot", "shirt", "shirtFront", "denim", "knit", "coat", "metal",
    "hair", "shoe", "faceA", "faceB", "faceC", "gore", "bone", "plain"];
  const IDX = {}; TILES.forEach((t, i) => { IDX[t] = i; });
  const TEXEL = 0.035;                                  // metres a pixel, on a part
  let tex = null;

  function seeded(s) { return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

  // each tile: a function (x, y, rnd) -> brightness 0..1 (1 = the part's own colour)
  const SHADOW = 0.68, BASE = 0.9, HI = 1.0;
  const band = (v) => (v < 0.33 ? SHADOW : v < 0.82 ? BASE : HI);
  const DRAW = {
    skin: (x, y, r) => band(0.5 + (r() - 0.5) * 0.9) * (r() < 0.04 ? 0.82 : 1),
    rot: (x, y, r, t) => {
      const blot = t.blots.some(([bx, by, br]) => Math.hypot(x - bx, y - by) < br);
      const vein = (x * 3 + y * 7) % 11 === 0 && r() < 0.7;
      return blot ? 0.6 + r() * 0.08 : vein ? 0.72 : band(0.5 + (r() - 0.5) * 0.9);
    },
    shirt: (x, y, r) => (y === 0 || y === 15 ? SHADOW : y % 2 ? BASE : 0.95) - (r() < 0.06 ? 0.12 : 0),
    shirtFront: (x, y, r) => {
      if (x === 7 || x === 8) return y % 4 === 1 ? 0.5 : y % 4 === 2 ? HI : 0.8;     // the placket, its buttons
      if (y <= 1 && (x < 4 || x > 11)) return 0.78;                                    // the collar
      return (y % 2 ? BASE : 0.95) - (r() < 0.06 ? 0.12 : 0);
    },
    denim: (x, y, r) => (x === 1 ? 0.7 : (x + y) % 3 === 0 ? 0.82 : 0.93) + (y > 9 && y < 13 && r() < 0.35 ? 0.07 : 0),
    knit: (x, y, r) => (y >= 6 && y <= 8 ? 0.55 : y % 2 ? 0.88 : 0.97) - (r() < 0.05 ? 0.1 : 0),     // a stripe across
    coat: (x, y, r, t) => {
      if ((y === 10 || y === 14) && x > 2 && x < 7) return 0.7;                         // a pocket
      if ((x === 2 || x === 7) && y > 10 && y < 14) return 0.7;
      const stain = t.blots.some(([bx, by, br]) => Math.hypot(x - bx, y - by) < br * 0.7);
      return stain ? 0.74 : band(0.55 + (r() - 0.5) * 0.5);
    },
    metal: (x, y, r) => {
      if ((x === 1 || x === 14) && (y === 1 || y === 14)) return HI;                  // rivets
      if (x === 0 || y === 0 || x === 15 || y === 15) return 0.62;                    // the plate's edge
      return (x - y + 16) % 9 === 0 && r() < 0.8 ? 0.98 : 0.78 + (r() - 0.5) * 0.06;  // scratches
    },
    hair: (x, y, r, t) => (t.gaps.has(x + "," + (y >> 2)) ? 0.5 : 0.72 + ((x * 5 + Math.floor(r() * 3)) % 4) * 0.08),
    shoe: (x, y, r) => (y >= 12 ? 0.55 : y === 4 && x % 4 === 1 ? HI : 0.8 + (r() - 0.5) * 0.06),
    // faces: brows, sockets, the nose's shadow, sunken cheeks, the mouth's shade
    faceA: (x, y, r) => face(x, y, r, { brow: 4, browTilt: 0, socket: 0.6, cheek: 0.78, mouth: 12, torn: false }),
    faceB: (x, y, r) => face(x, y, r, { brow: 4, browTilt: 1, socket: 0.55, cheek: 0.75, mouth: 12, torn: true, scar: true }),
    faceC: (x, y, r) => face(x, y, r, { brow: 3, browTilt: 0, socket: 0.42, cheek: 0.68, mouth: 11, torn: false, gaunt: true }),
    gore: (x, y, r) => (r() < 0.25 ? HI : r() < 0.5 ? 0.62 : 0.82),
    bone: (x, y, r) => ((x * 7 + y * 3) % 13 === 0 ? 0.7 : y % 5 === 0 && r() < 0.5 ? 0.85 : 0.97),
    plain: (x, y, r) => 0.9 + (r() - 0.5) * 0.08,
  };
  function face(x, y, r, o) {
    const L = x < 8, ex = L ? 4 : 11;
    // brows: a dark ridge over each eye (one cocked lower on a torn face)
    const by = o.brow + (o.browTilt && !L ? 1 : 0);
    if (y === by && Math.abs(x - ex) <= 2) return 0.5;
    // the sockets round the eyes (the eyes themselves are boxes on top)
    if (y >= by + 1 && y <= by + 4 && Math.abs(x - ex) <= 2) return o.socket + (y === by + 1 ? 0.06 : 0);
    if (o.gaunt && (x === 2 || x === 13) && y >= 8 && y <= 11) return 1.0;            // cheekbones
    if ((x <= 2 || x >= 13) && y >= 9 && y <= 12) return o.cheek;                      // sunken cheeks
    if (x >= 7 && x <= 8 && y >= 8 && y <= 10) return 0.74;                            // under the nose
    if (y >= o.mouth && y <= o.mouth + 1 && x >= 4 && x <= 11) return 0.45;          // the mouth's shade
    if (o.torn && y === o.mouth && x >= 11 && x <= 14) return 0.42;                   // the lip torn to the cheek
    if (o.scar && x === y - 1 && x >= 9 && x <= 13) return 0.6;                       // a scar across a cheek
    if (y === 15) return 0.8;                                                          // under the chin
    return band(0.55 + (r() - 0.5) * 0.7);
  }

  function draw() {
    const c = document.createElement("canvas");
    c.width = TILE * COLS; c.height = TILE * ROWS;
    const cx = c.getContext("2d"), img = cx.createImageData(c.width, c.height);
    TILES.forEach((name, t) => {
      const r = seeded(104729 * (t + 7));
      const extra = { blots: [], gaps: new Set() };
      for (let i = 0; i < 4; i++) extra.blots.push([r() * 16, r() * 16, 1.5 + r() * 2.5]);
      for (let i = 0; i < 6; i++) extra.gaps.add(Math.floor(r() * 16) + "," + Math.floor(r() * 4));
      const ox = (t % COLS) * TILE, oy = Math.floor(t / COLS) * TILE;
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const l = Math.max(0, Math.min(1, DRAW[name](x, y, r, extra)));
        const i = ((oy + y) * c.width + ox + x) * 4, v = Math.round(l * 255);
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
    });
    cx.putImageData(img, 0, 0);
    return c;
  }

  function texture() {
    if (tex) return tex;
    tex = new THREE.CanvasTexture(draw());
    tex.magFilter = THREE.NearestFilter;
    // (16 px tiles on a power of two: the smaller mips keep each tile to itself)
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.userData = { shared: true };
    return tex;
  }

  // which tile a part shows: what it was built as (material.userData.ztile),
  // else -- a boss's parts -- the plain grain
  function tileOf(o) {
    return (o.userData && o.userData.ztile) || (o.material && o.material.userData && o.material.userData.ztile) || "plain";
  }
  // a vertex's UV (G.Perf.mergeLocalColored): o the box, face 0..5 (+x -x +y
  // -y +z -z), u0/v0 its own UV on that face, d the face's size (m)
  function uvOf(o, face, u0, v0, d) {
    const front = face === 4 && o.userData && o.userData.frontTile;
    const name = front || tileOf(o);
    const t = IDX[name] != null ? IDX[name] : IDX.plain;
    const span = TILE * TEXEL;
    const eu = front ? 1 : Math.min(1, (d ? d[0] : span) / span), ev = front ? 1 : Math.min(1, (d ? d[1] : span) / span);
    const uu = 0.5 + (u0 - 0.5) * eu, vv = 0.5 + (v0 - 0.5) * ev;
    const col = t % COLS, row = Math.floor(t / COLS);
    return [(col * TILE + 0.5 + uu * (TILE - 1)) / (TILE * COLS), 1 - (row * TILE + 0.5 + (1 - vv) * (TILE - 1)) / (TILE * ROWS)];
  }
  // a part's material says which tile it shows
  function tag(mat, name) { if (mat && mat.userData) mat.userData.ztile = name; return mat; }

  return { TILES, texture, uvOf, tileOf, tag, draw };
})();

G.ZombieFactory = {
  // eyes: colour, how hard they glow (x the night's eye glow), size; the
  // face tile; the mouth (torn: hanging open, from cheek to cheek)
  KIND: {
    normal:      { eye: 0xd8d0b0, glow: 0.55, eyeSize: 0.045, faces: ["faceA", "faceB"], mouthWidth: 0.14, scars: 2 },
    fast:        { eye: 0xffa726, glow: 1.0, eyeSize: 0.04, faces: ["faceB"], mouthWidth: 0.11, scars: 1 },
    crawler:     { eye: 0xeae8e0, glow: 0.45, eyeSize: 0.05, faces: ["faceA"], mouthWidth: 0.16, scars: 3 },
    bloater:     { eye: 0xe8e08a, glow: 0.5, eyeSize: 0.04, faces: ["faceA"], mouthWidth: 0.12, scars: 1, rot: true },
    ironclad:    { eye: 0xf4f8ff, glow: 1.25, eyeSize: 0.042, faces: ["faceA"], mouthWidth: 0.13, scars: 2 },
    runt:        { eye: 0xffb000, glow: 0.95, eyeSize: 0.06, faces: ["faceC"], mouthWidth: 0.15, scars: 1 },
    abomination: { eye: 0xff5a1a, glow: 1.45, eyeSize: 0.05, faces: ["faceB"], mouthWidth: 0.2, scars: 5, torn: true, rot: true },
    screamer:    { eye: 0x060606, glow: 0, eyeSize: 0.075, faces: ["faceC"], mouthWidth: 0.2, scars: 2, torn: true, pupil: 0xffffff },
    headless:    { eye: 0xd8d0b0, glow: 0.55, eyeSize: 0.045, faces: ["faceA"], mouthWidth: 0.14, scars: 3 },
    reacher:     { eye: 0xc8743a, glow: 0.8, eyeSize: 0.04, faces: ["faceC"], mouthWidth: 0.13, scars: 3 },
    boss:        { eye: 0xff0000, glow: 1.0, eyeSize: 0.07, faces: ["faceB"], mouthWidth: 0.2, scars: 5 },
  },
  // what a kind wears, by level -- outfits of G.ZOMBIE_OUTFITS (js/entities.js);
  // a kind not listed wears the level's own mix
  WEARS: {
    fast: { school: ["gym"], hospital: ["runner", "patient"], bunker: ["runner", "soldier"] },
    ironclad: { school: ["builder"], hospital: ["riot"], bunker: ["trooper"] },
    runt: { school: ["kid"], hospital: ["kidPatient"], bunker: ["kid"] },
    screamer: { school: ["teacher", "student_skirt"], hospital: ["patient", "nurse"], bunker: ["scientist"] },
    bloater: { school: ["janitor", "office"], hospital: ["patient", "office"], bunker: ["mechanic", "office"] },
    reacher: { school: ["janitor", "farmer"], hospital: ["doctor", "farmer"], bunker: ["mechanic", "soldier"] },
    abomination: { school: ["shreds"], hospital: ["shreds"], bunker: ["shreds"] },
  },

  // Blood & Gore (Settings): for this zombie
  gore(z) {
    const s = (G.save && G.save.settings && G.save.settings.gore) || "full";
    if (z && z.type === "runt" && s === "full") return "reduced";
    return s;
  },
  // a colour of blood, gore or a raw wound, as the setting has it
  goreColor(hex, level) {
    if (level === "off") { const c = new THREE.Color(hex), l = (c.r + c.g + c.b) / 3; return new THREE.Color(l * 0.6 + 0.12, l * 0.6 + 0.12, l * 0.6 + 0.13).getHex(); }
    if (level === "reduced") return new THREE.Color(hex).lerp(new THREE.Color(0x2a2420), 0.55).getHex();
    return hex;
  },

  // A look for a new zombie: its kind's outfit for the level, and never all
  // alike with one alive; a wave's first zombies spread over the outfits.
  look(type, theme, game) {
    const C = G.CONFIG.zombies;
    const wears = this.WEARS[type] && this.WEARS[type][theme];
    const alive = game && game.zombies ? game.zombies.filter((z) => z.alive && z.look) : [];
    let best = null;
    for (let tries = 0; tries < 6; tries++) {
      let want = wears ? G.pick(wears) : null;
      // (a wave's first: an outfit the wave has not had yet, while it has fewer than `variety`)
      if (!want && game && game._waveOutfits) {
        const all = (G.ZOMBIE_OUTFITS[theme] || G.ZOMBIE_OUTFITS.school).filter((o) => !o.only).map((o) => o.key);
        const fresh = all.filter((k) => !game._waveOutfits.has(k));
        if (game._waveOutfits.size < C.variety && fresh.length) want = G.pick(fresh);
      }
      const L = G.randomZombieLook(type, theme, want);
      L.face = G.pick(this.KIND[type] ? this.KIND[type].faces : ["faceA"]);
      const sig = this.signature(type, L);
      best = L;
      if (!alive.some((z) => z._sig === sig)) break;
    }
    if (game && game._waveOutfits) game._waveOutfits.add(best.outfit);
    return best;
  },
  // what would make two zombies the same in every part
  signature(type, L) {
    return [type, L.outfit, L.tone, L.face, L.odd || "", L.legs, [...L.extras].sort().join("+"),
      L.skin.getHexString(), L.top.getHexString()].join("|");
  },
};

// every zombie's material shows the atlas (js/visuals.js gives the lit one
// its own, with the map, when the night's look is on)
if (G.ZOMBIE_MATS) {
  G.ZOMBIE_MATS.lambert.map = G.ZombieSkin.texture();
  G.ZOMBIE_MATS.lambert.needsUpdate = true;
  G.ZOMBIE_MATS.uvOf = G.ZombieSkin.uvOf;
}
