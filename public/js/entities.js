// ============================================================
// ENTITIES: weapons, loot/rarity, player, zombies, particles
// Art style: voxel/blocky — everything built from BoxGeometry.
// ============================================================
window.G = window.G || {};

// ---------------- Rarity ----------------
// (labels, like every name the player reads, come from js/strings.js)
G.RARITY = {
  common:   { key: "common",   label: "",   color: 0x8fb3c9, chance: 0.50, badge: "square" },
  uncommon: { key: "uncommon", label: "", color: 0x3ee066, chance: 0.30, badge: "diamond" },
  rare:     { key: "rare",     label: "",     color: 0x3b82f5, chance: 0.13, badge: "cross" },
  epic:     { key: "epic",     label: "",     color: 0xd23bef, chance: 0.06, badge: "triangle" },
  secret:   { key: "secret",   label: "",   color: 0xffd43b, chance: 0.01, badge: "star" },
};
G.RARITY_ORDER = ["common", "uncommon", "rare", "epic", "secret"];
// Rainbow accent cycle used only by the Secret-tier weapon's always-on sparkle trim.
G.RAINBOW_COLORS = [0xff4d4d, 0xffa64d, 0xffe14d, 0x4dff88, 0x4dc3ff, 0xb54dff];

G.rollRarity = function (minRarity) {
  const order = G.RARITY_ORDER;
  const minIdx = minRarity ? order.indexOf(minRarity) : 0;
  const pool = order.slice(minIdx);
  const weights = pool.map((k) => G.RARITY[k].chance);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = G.rng() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
};

// ---------------- Weapon definitions: G.WEAPON_DEFS (and the mystery box cost) are in js/config.js ----------------

// (the hospital's and the bunker's guns are in js/config.js too)

// ---------------- Level + model archetype for the original arsenal ----------------
// Kept as one table rather than two more fields repeated through every def
// above it. Level 0 means "every level" and only the starting pistol has it.
(function tagOriginalWeapons() {
  const META = {
    pistol: [0, "pistol"], shotgun: [1, "shotgun"], smg: [1, "smg"], rifle: [1, "rifle"],
    lmg: [1, "lmg"], sniper: [1, "sniper"], railgun: [1, "beam"], grenadelauncher: [1, "launcher"],
    golden_smg: [1, "smg"], school_wall: [1, "lmg"], hospital_wall: [2, "shotgun"], bunker_wall: [3, "cannon"],
    hall_monitor: [1, "smg"], detention_slug: [1, "shotgun"], pop_quiz: [1, "rifle"],
    cafeteria_cleaver: [1, "cannon"], honor_roll: [1, "sniper"], science_fair: [1, "lmg"],
    art_attack: [1, "launcher"], principals_verdict: [1, "beam"],
    scrap_spitter: [1, "smg"], nail_driver: [1, "rifle"], hall_sweeper: [1, "shotgun"],
    chalk_burster: [1, "rifle"], detention_deuce: [1, "pistol"], rust_repeater: [1, "rifle"],
    gym_grinder: [1, "lmg"], copper_coil: [1, "energy"], locker_lancer: [1, "rifle"],
    bus_bulldog: [1, "cannon"], thunder_chalk: [1, "energy"], void_principal: [1, "lmg"],
    prism_lance: [1, "beam"], final_bell: [1, "shotgun"], meteor_detention: [1, "cannon"],
  };
  Object.keys(META).forEach((id) => {
    const d = G.WEAPON_DEFS[id];
    if (!d) return;
    d.level = META[id][0];
    d.archetype = META[id][1];
  });
  // Snipers that predate the scope mechanic get one, and the old boolean
  // `pierce: true` becomes a count so every piercing gun reads the same way.
  if (G.WEAPON_DEFS.sniper) G.WEAPON_DEFS.sniper.scope = 30;
  if (G.WEAPON_DEFS.honor_roll) G.WEAPON_DEFS.honor_roll.scope = 32;
  Object.values(G.WEAPON_DEFS).forEach((d) => { if (d.pierce === true) d.pierce = 99; });
})();

// Only guns that belong to the level being played -- plus the starting pistol,
// which is level 0 -- may turn up in its shop crates or its mystery box.
G.weaponsForLevel = function (levelId, filter) {
  return Object.values(G.WEAPON_DEFS).filter((w) => (w.level === 0 || w.level === levelId) && (!filter || filter(w)));
};

// A short label for how a weapon fires, shown wherever its stats are.
G.fireModeLabel = function (def) {
  if (!def) return "";
  if (def.id === "melee") return G.T("fire.melee");
  if (def.charge) return G.T("fire.charge");
  if (def.splash) return G.T("fire.splash");
  if (def.pellets) return G.T("fire.pellets", { n: def.pellets });
  if (def.scope) return G.T("fire.scope");
  if (def.burst) return G.T("fire.burst", { n: def.burst });
  if (def.pierce) return def.pierce >= 99 ? G.T("fire.pierceAll") : G.T("fire.pierce", { n: def.pierce });
  if (def.auto) return G.T("fire.auto");
  return G.T("fire.semi");
};
G.rollMysteryHand = function (levelId) {
  const pick = (pool) => {
    const total = pool.reduce((s, w) => s + w.boxWeight, 0);
    let r = G.rng() * total;
    for (const w of pool) { r -= w.boxWeight; if (r <= 0) return w; }
    return pool[pool.length - 1];
  };
  // Category H1: the box only ever deals guns that belong to this level.
  const all = G.weaponsForLevel(levelId == null ? 1 : levelId, (w) => w.boxOnly);
  const elitePool = all.filter((w) => w.boxTier === "elite");
  let standardPool = all.filter((w) => w.boxTier === "standard");
  const hand = [pick(elitePool)];
  for (let i = 0; i < G.MYSTERY_CARD_COUNT - 1; i++) {
    const w = pick(standardPool);
    standardPool = standardPool.filter((s) => s.id !== w.id); // no duplicate faces in one hand
    hand.push(w);
  }
  return G.shuffle(hand);
};

// (G.MELEE_DEF, the knife: js/config.js)

// ---------------- Voxel builders (BoxGeometry only) ----------------
G.makeBoxMat = (color) => new THREE.MeshLambertMaterial({ color });

// ---------------- Weapon models (category H2) ----------------
// Eighty-five weapons made one hand-built silhouette per gun impractical, and
// the old ones were four or five plain boxes each. Every weapon is now
// assembled from the same parts list -- barrel, muzzle device, receiver,
// handguard, grip, trigger guard, magazine, stock and sights -- where:
//
//   the ARCHETYPE fixes the proportions, so a shotgun still reads as a shotgun
//   and a sniper as a sniper at a glance;
//   a per-gun SEED varies barrel length, magazine, muzzle device, vent count
//   and sight style, so two rifles are never the same gun in two colours;
//   the RARITY adds emissive edging, geometric side plates and extra hardware,
//   so an epic looks expensive before you read its name.
//
// Six shades are mixed in every gun (body, dark accent, light magazine tint,
// mid barrel tone, steel details, near-black furniture) -- flat single-colour
// guns were what made the old models read as toys.
G.WEAPON_ARCHETYPES = {
  //        barrel  bore  receiver w/h/d        stock      magazine  sights   extras
  pistol: { len: 0.20, bore: 0.048, body: [0.085, 0.125, 0.26], stock: null, mag: "short", sight: "iron" },
  smg: { len: 0.24, bore: 0.05, body: [0.092, 0.14, 0.32], stock: "folding", mag: "long", sight: "iron", foregrip: true },
  rifle: { len: 0.34, bore: 0.052, body: [0.095, 0.145, 0.40], stock: "full", mag: "curved", sight: "rail", handguard: true },
  lmg: { len: 0.44, bore: 0.068, body: [0.12, 0.175, 0.48], stock: "full", mag: "drum", sight: "rail", bipod: true, handguard: true },
  shotgun: { len: 0.40, bore: 0.098, body: [0.115, 0.155, 0.28], stock: "full", mag: "tube", sight: "bead", pump: true },
  sniper: { len: 0.56, bore: 0.05, body: [0.09, 0.145, 0.40], stock: "full", mag: "short", sight: "scope", bipod: true, cheek: true },
  launcher: { len: 0.34, bore: 0.15, body: [0.165, 0.185, 0.32], stock: "full", mag: "drum", sight: "ladder" },
  energy: { len: 0.32, bore: 0.078, body: [0.115, 0.155, 0.36], stock: "folding", mag: "cell", sight: "holo", coils: true },
  cannon: { len: 0.38, bore: 0.125, body: [0.175, 0.215, 0.36], stock: "full", mag: "cell", sight: "ladder", brake: true },
  beam: { len: 0.50, bore: 0.058, body: [0.11, 0.15, 0.34], stock: "folding", mag: "cell", sight: "holo", coils: true, emitter: true },
};

// Deterministic per-weapon variation: the same gun always builds identically,
// but no two ids land on the same numbers.
function gunSeed(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0; return ((h >>> 0) % 100000) / 100000; };
}

// When a def does not name an archetype, work one out from how it behaves --
// a gun that fires six pellets is a shotgun whatever it is called.
G.inferArchetype = function (def) {
  if (!def) return "rifle";
  if (def.splash) return def.damage >= 120 ? "cannon" : "launcher";
  if (def.pellets) return "shotgun";
  if (def.charge) return "energy";
  if (def.pierce) return "beam";
  if (def.damage >= 80 && def.magSize <= 8) return "sniper";
  if ((def.magSize || 0) >= 40) return "lmg";
  if (def.auto) return (def.magSize || 0) >= 28 ? "smg" : "rifle";
  if ((def.magSize || 0) <= 14 && def.damage <= 30) return "pistol";
  return "rifle";
};

// Close the seams in a box-built gun. Parts meant to touch were placed
// 1-4mm apart (a receiver over its grip, a sight on its rail): at arm's
// length that is a line of background two to six pixels wide showing
// through the gun, and while running the background slides behind it, so
// it flickers. And a panel laid flush on a part of another colour shares
// its plane exactly, so the two fight over every pixel (z-fighting).
// For every pair of axis-aligned boxes: a gap under 4.5mm between faces
// that face each other is closed by growing the smaller box across it; a
// face flush with a differently coloured one is pushed out 0.8mm.
G.weldGunParts = function (root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), rel = new THREE.Matrix4(), e = new THREE.Euler(), c = new THREE.Vector3();
  const B = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== "BoxGeometry" || o.parent === null) return;
    rel.multiplyMatrices(inv, o.matrixWorld);
    e.setFromRotationMatrix(rel);
    if (Math.abs(e.x) + Math.abs(e.y) + Math.abs(e.z) > 1e-6) return;          // tilted parts are left alone
    c.setFromMatrixPosition(rel);
    const p = o.geometry.parameters, h = [p.width / 2, p.height / 2, p.depth / 2];
    const mat = o.material;
    B.push({ o, min: [c.x - h[0], c.y - h[1], c.z - h[2]], max: [c.x + h[0], c.y + h[1], c.z + h[2]], vol: p.width * p.height * p.depth,
      key: (mat.type || "") + (mat.color ? mat.color.getHex() : ""), lo: [0, 0, 0], hi: [0, 0, 0] });
  });
  // bounds as they will be once grown
  const lo = (b, k) => b.min[k] - b.lo[k], hi = (b, k) => b.max[k] + b.hi[k];
  const overlap = (a, b, k) => [0, 1, 2].every((ax) => ax === k || Math.min(hi(a, ax), hi(b, ax)) - Math.max(lo(a, ax), lo(b, ax)) > 0.0002);
  const pairs = (fn) => { for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) for (let k = 0; k < 3; k++) if (overlap(B[i], B[j], k)) fn(B[i], B[j], k); };
  const smallOf = (a, b) => (a.vol <= b.vol ? [a, b] : [b, a]);
  // 1. close the hairline gaps (the smaller part grows 0.6mm into the other)
  pairs((a, b, k) => {
    const [small, big] = smallOf(a, b);
    const g1 = big.min[k] - small.max[k], g2 = small.min[k] - big.max[k];
    if (g1 > 1e-5 && g1 < 0.0045) small.hi[k] = Math.max(small.hi[k], g1 + 0.0006);
    if (g2 > 1e-5 && g2 < 0.0045) small.lo[k] = Math.max(small.lo[k], g2 + 0.0006);
  });
  // 2. then, on the grown bounds, faces left flush with a part of another
  // colour (including the strip a closed gap leaves along a shared side)
  // step out 0.8mm; twice, in case a step lands flush with a third part
  for (let pass = 0; pass < 2; pass++) {
    pairs((a, b, k) => {
      if (a.key === b.key) return;
      const [small] = smallOf(a, b);
      if (Math.abs(hi(a, k) - hi(b, k)) < 5e-5) small.hi[k] += 0.0008;
      if (Math.abs(lo(a, k) - lo(b, k)) < 5e-5) small.lo[k] += 0.0008;
    });
  }
  B.forEach((b) => {
    if (!b.lo.some((v) => v) && !b.hi.some((v) => v)) return;
    const size = [0, 1, 2].map((k) => b.max[k] - b.min[k] + b.lo[k] + b.hi[k]);
    b.o.geometry.dispose();
    b.o.geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    // the part's parent is unrotated and unscaled, so this shift is local too
    b.o.position.x += (b.hi[0] - b.lo[0]) / 2; b.o.position.y += (b.hi[1] - b.lo[1]) / 2; b.o.position.z += (b.hi[2] - b.lo[2]) / 2;
  });
  root.updateMatrixWorld(true);
};

G.buildWeaponModel = function (def) {
  const A = G.WEAPON_ARCHETYPES[def.archetype] || G.WEAPON_ARCHETYPES[G.inferArchetype(def)];
  const rnd = gunSeed(def.id || "gun");
  const base = new THREE.Color(def.color);
  const S = {
    body: G.makeBoxMat(def.color),
    dark: G.makeBoxMat(def.accent != null ? def.accent : base.clone().multiplyScalar(0.45).getHex()),
    light: G.makeBoxMat(base.clone().lerp(new THREE.Color(0xffffff), 0.45).getHex()),
    mid: G.makeBoxMat(base.clone().lerp(new THREE.Color(0x000000), 0.3).getHex()),
    steel: G.makeBoxMat(0x9aa4ad),
    black: G.makeBoxMat(0x191b1f),
  };
  // (overhaul, round 2) the surface each colour role is made of (js/gunskin.js):
  // the body by its own colour -- painted polymer if it has one, else metal
  S.light.userData.skin = "polymer"; S.dark.userData.skin = "grip"; S.mid.userData.skin = "worn";
  S.steel.userData.skin = "bare"; S.black.userData.skin = "matte";
  const g = new THREE.Group();
  // Parts that move on their own during a reload -- the magazine, the bolt or
  // slide, a shotgun's pump, an LMG's top cover -- are built into sub-groups
  // whose origin is their pivot. `box` takes absolute gun coordinates either
  // way; while `into` names a part it lands there, offset by the part origin.
  let into = null;
  const part = (x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); return p; };
  const box = (w, h, d, x, y, z, m, rx, ry, rz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const o = into ? into.position : null;
    b.position.set(x - (o ? o.x : 0), y - (o ? o.y : 0), z - (o ? o.z : 0));
    if (rx) b.rotation.x = rx;
    if (ry) b.rotation.y = ry;
    if (rz) b.rotation.z = rz;
    (into || g).add(b);
    return b;
  };
  const parts = {};
  const glow = (w, h, d, x, y, z, c) => box(w, h, d, x, y, z, new THREE.MeshBasicMaterial({ color: c }));

  // The seed nudges the receiver as well as the barrel, so two guns on the
  // same archetype differ in silhouette and not just in trim.
  const bw = A.body[0] * (0.92 + rnd() * 0.16);
  const bh = A.body[1] * (0.92 + rnd() * 0.16);
  const bd = A.body[2] * (0.88 + rnd() * 0.24);
  const barrelLen = A.len * (0.85 + rnd() * 0.3);
  const carryHandle = rnd() < 0.35;
  const recZ = 0.02;                     // receiver centre
  const muzzleZ = recZ - bd / 2 - barrelLen;

  // ---- receiver, top cover and ejection port ----
  const archKey = G.WEAPON_ARCHETYPES[def.archetype] ? def.archetype : G.inferArchetype(def);
  box(bw, bh, bd, 0, 0, recZ, S.body);
  // A pistol's top cover IS its slide: it rides back with the rack.
  // An LMG's hinges up at the rear for a belt change.
  if (archKey === "pistol") into = parts.bolt = part(0, bh * 0.5, recZ);
  else if (archKey === "lmg") into = parts.cover = part(0, bh * 0.64, recZ + bd * 0.46);
  box(bw * 0.86, bh * 0.28, bd * 0.92, 0, bh * 0.5, recZ, S.mid);
  into = null;
  box(bw * 0.55, bh * 0.22, bd * 0.3, bw * 0.5, bh * 0.14, recZ - bd * 0.15, S.black);   // ejection port
  into = parts.bolt || (parts.bolt = part(bw * 0.55, bh * 0.36, recZ + bd * 0.1));
  box(bw * 0.3, bh * 0.12, bd * 0.16, bw * 0.55, bh * 0.36, recZ + bd * 0.1, S.steel);   // charging handle
  if (archKey === "sniper") {
    // a real bolt handle to work, sticking out to the right
    box(0.07, 0.022, 0.022, bw * 0.55 + 0.04, bh * 0.36, recZ + bd * 0.1, S.steel);
    box(0.035, 0.035, 0.035, bw * 0.55 + 0.08, bh * 0.36 - 0.01, recZ + bd * 0.1, S.black);
  }
  into = null;
  if (carryHandle) {
    box(bw * 0.22, 0.05, bd * 0.34, 0, bh * 0.62 + 0.06, recZ - bd * 0.05, S.dark);
    [-1, 1].forEach((s) => box(bw * 0.22, 0.07, 0.022, 0, bh * 0.62 + 0.03, recZ - bd * 0.05 + s * bd * 0.17, S.dark));
  }

  // ---- barrel + handguard + muzzle device ----
  const bore = A.bore;
  box(bore, bore, barrelLen, 0, bh * 0.08, recZ - bd / 2 - barrelLen / 2, S.mid);
  if (A.handguard || A.pump || A.coils) {
    const hgLen = barrelLen * 0.55;
    const hgZ = recZ - bd / 2 - hgLen / 2 - 0.02;
    box(bore * 2.1, bore * 1.9, hgLen, 0, bh * 0.06, hgZ, A.pump ? S.dark : S.body);
    // geometric vent slots: the repeating cut that makes a handguard read as
    // machined hardware rather than a stick
    const vents = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < vents; i++) {
      const vz = hgZ - hgLen / 2 + (hgLen / (vents + 1)) * (i + 1);
      box(bore * 2.3, bore * 0.5, hgLen * 0.06, 0, bh * 0.06 + bore * 0.5, vz, S.black);
      box(bore * 0.55, bore * 0.9, hgLen * 0.07, bore * 1.05, bh * 0.06, vz, S.black);
      box(bore * 0.55, bore * 0.9, hgLen * 0.07, -bore * 1.05, bh * 0.06, vz, S.black);
    }
  }
  const muzzleKind = A.brake ? 2 : Math.floor(rnd() * 3);
  if (muzzleKind === 0) {                                   // flash hider: prongs
    box(bore * 1.5, bore * 1.5, 0.05, 0, bh * 0.08, muzzleZ - 0.02, S.black);
    [-1, 1].forEach((s) => box(bore * 0.3, bore * 1.6, 0.05, s * bore * 0.55, bh * 0.08, muzzleZ - 0.05, S.black));
  } else if (muzzleKind === 1) {                            // suppressor can
    box(bore * 1.9, bore * 1.9, 0.14, 0, bh * 0.08, muzzleZ - 0.07, S.dark);
    box(bore * 2.0, bore * 0.35, 0.02, 0, bh * 0.08 + bore * 0.8, muzzleZ - 0.07, S.black);
  } else {                                                  // muzzle brake: side ports
    box(bore * 2.0, bore * 1.7, 0.09, 0, bh * 0.08, muzzleZ - 0.045, S.steel);
    [-1, 1].forEach((s) => box(bore * 0.5, bore * 1.0, 0.045, s * bore, bh * 0.08, muzzleZ - 0.045, S.black));
  }

  // ---- grip, trigger and trigger guard ----
  const gripZ = recZ + bd * 0.24;
  box(0.078, 0.2, 0.088, 0, -bh / 2 - 0.09, gripZ, S.dark, -0.17);
  for (let i = 0; i < 3; i++) box(0.082, 0.014, 0.09, 0, -bh / 2 - 0.05 - i * 0.05, gripZ + i * 0.009, S.black, -0.17);
  box(0.03, 0.05, 0.03, 0, -bh / 2 - 0.035, gripZ - 0.06, S.steel);                       // trigger
  box(0.04, 0.016, 0.1, 0, -bh / 2 - 0.065, gripZ - 0.055, S.black);                       // guard bottom
  box(0.04, 0.045, 0.016, 0, -bh / 2 - 0.045, gripZ - 0.1, S.black);                       // guard front

  // ---- magazine ----
  // Its own part, pivoting at the mag well, so a reload can pull it out,
  // drop it and seat a new one. (A shotgun's tube is part of the gun.)
  const magZ = recZ - bd * 0.08;
  if (A.mag !== "tube") into = parts.mag = part(0, -bh / 2, A.mag === "short" ? gripZ : magZ);
  if (A.mag === "short") {
    box(0.062, 0.1, 0.075, 0, -bh / 2 - 0.05, gripZ, S.light, -0.17);
  } else if (A.mag === "long") {
    box(0.06, 0.26, 0.08, 0, -bh / 2 - 0.13, magZ, S.light, 0.06);
    box(0.066, 0.02, 0.085, 0, -bh / 2 - 0.26, magZ + 0.01, S.black);
  } else if (A.mag === "curved") {
    for (let i = 0; i < 3; i++) box(0.058, 0.085, 0.075, 0, -bh / 2 - 0.045 - i * 0.075, magZ + i * 0.022, S.light, 0.1 + i * 0.09);
  } else if (A.mag === "drum") {
    box(0.075, 0.2, 0.2, 0, -bh / 2 - 0.1, magZ, S.light);
    box(0.085, 0.12, 0.12, 0, -bh / 2 - 0.1, magZ, S.dark);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      box(0.088, 0.03, 0.03, 0, -bh / 2 - 0.1 + Math.sin(a) * 0.07, magZ + Math.cos(a) * 0.07, S.black);
    }
  } else if (A.mag === "tube") {
    box(bore * 0.62, bore * 0.62, barrelLen * 0.9, 0, bh * 0.08 - bore * 0.85, recZ - bd / 2 - barrelLen * 0.45, S.light);
    box(bore * 0.75, bore * 0.75, 0.03, 0, bh * 0.08 - bore * 0.85, muzzleZ + barrelLen * 0.08, S.steel);
  } else {                                                   // energy cell
    box(0.085, 0.11, 0.13, 0, -bh / 2 - 0.055, magZ, S.light);
    glow(0.09, 0.035, 0.09, 0, -bh / 2 - 0.055, magZ, def.color);
  }
  into = null;

  // ---- stock ----
  if (A.stock === "full") {
    box(bw * 0.8, bh * 0.75, 0.1, 0, -bh * 0.06, recZ + bd / 2 + 0.05, S.dark);
    box(bw * 0.62, bh * 0.5, 0.17, 0, -bh * 0.16, recZ + bd / 2 + 0.18, S.dark);
    box(bw * 0.86, bh * 0.9, 0.035, 0, -bh * 0.12, recZ + bd / 2 + 0.28, S.black);        // butt pad
    if (A.cheek) box(bw * 0.7, bh * 0.3, 0.16, 0, bh * 0.38, recZ + bd / 2 + 0.12, S.mid);
  } else if (A.stock === "folding") {
    box(0.02, 0.02, 0.2, bw * 0.4, bh * 0.1, recZ + bd / 2 + 0.1, S.steel);
    box(0.02, 0.02, 0.2, -bw * 0.4, bh * 0.1, recZ + bd / 2 + 0.1, S.steel);
    box(bw * 0.9, 0.055, 0.03, 0, bh * 0.1, recZ + bd / 2 + 0.2, S.black);
  }

  // ---- sights ----
  const sight = A.sight;
  if (sight === "iron") {
    box(0.012, 0.05, 0.012, 0, bh * 0.66 + 0.02, recZ - bd * 0.45, S.black);
    box(0.05, 0.035, 0.014, 0, bh * 0.66 + 0.012, recZ + bd * 0.4, S.black);
    box(0.014, 0.03, 0.014, 0.018, bh * 0.66 + 0.022, recZ + bd * 0.4, S.black);
    box(0.014, 0.03, 0.014, -0.018, bh * 0.66 + 0.022, recZ + bd * 0.4, S.black);
  } else if (sight === "rail") {
    box(bw * 0.5, 0.018, bd * 0.8, 0, bh * 0.66, recZ, S.black);
    for (let i = 0; i < 5; i++) box(bw * 0.55, 0.026, 0.012, 0, bh * 0.66, recZ - bd * 0.3 + i * bd * 0.15, S.steel);
    box(0.05, 0.05, 0.11, 0, bh * 0.66 + 0.04, recZ - bd * 0.1, S.dark);                  // optic body
    glow(0.03, 0.03, 0.01, 0, bh * 0.66 + 0.04, recZ - bd * 0.1 - 0.056, 0xff5b5b);
  } else if (sight === "scope") {
    box(0.02, 0.05, 0.02, 0, bh * 0.6, recZ - bd * 0.28, S.black);
    box(0.02, 0.05, 0.02, 0, bh * 0.6, recZ + bd * 0.28, S.black);
    box(0.055, 0.055, 0.32, 0, bh * 0.6 + 0.045, recZ - bd * 0.05, S.black);
    box(0.075, 0.075, 0.06, 0, bh * 0.6 + 0.045, recZ - bd * 0.05 - 0.17, S.dark);        // objective bell
    glow(0.05, 0.05, 0.012, 0, bh * 0.6 + 0.045, recZ - bd * 0.05 - 0.2, 0x8fd8ff);
    box(0.03, 0.03, 0.03, 0, bh * 0.6 + 0.08, recZ - bd * 0.05, S.steel);                 // turret
  } else if (sight === "bead") {
    box(0.014, 0.03, 0.014, 0, bh * 0.5 + bore * 1.1, muzzleZ + 0.06, S.steel);
    glow(0.018, 0.018, 0.018, 0, bh * 0.5 + bore * 1.35, muzzleZ + 0.06, 0xffd45b);
  } else if (sight === "ladder") {
    box(0.016, 0.09, 0.016, 0, bh * 0.66 + 0.04, recZ + bd * 0.3, S.black);
    for (let i = 0; i < 4; i++) box(0.05, 0.01, 0.012, 0, bh * 0.66 + 0.012 + i * 0.022, recZ + bd * 0.3, S.steel);
    box(0.016, 0.06, 0.016, 0, bh * 0.66 + 0.025, recZ - bd * 0.35, S.black);
  } else {                                                   // holo
    box(0.07, 0.015, 0.07, 0, bh * 0.66, recZ - bd * 0.1, S.black);
    box(0.012, 0.06, 0.012, 0.03, bh * 0.66 + 0.03, recZ - bd * 0.1, S.black);
    box(0.012, 0.06, 0.012, -0.03, bh * 0.66 + 0.03, recZ - bd * 0.1, S.black);
    glow(0.058, 0.05, 0.008, 0, bh * 0.66 + 0.035, recZ - bd * 0.1, 0x7fe6ff);
  }

  // ---- archetype extras ----
  if (A.foregrip) box(0.05, 0.11, 0.055, 0, -bh / 2 - 0.05, recZ - bd / 2 - barrelLen * 0.45, S.dark, 0.12);
  if (A.pump) {
    into = parts.pump = part(0, bh * 0.06 - bore * 0.5, recZ - bd / 2 - barrelLen * 0.5);
    box(bore * 2.4, bore * 1.7, 0.15, 0, bh * 0.06 - bore * 0.5, recZ - bd / 2 - barrelLen * 0.5, S.dark);
    for (let i = 0; i < 4; i++) box(bore * 2.5, 0.012, 0.014, 0, bh * 0.06 - bore * 0.5 + 0.02, recZ - bd / 2 - barrelLen * 0.5 - 0.05 + i * 0.033, S.black);
    into = null;
  }
  if (A.bipod) {
    [-1, 1].forEach((s) => box(0.016, 0.13, 0.016, s * 0.045, -bh / 2 - 0.06, recZ - bd / 2 - barrelLen * 0.72, S.black, 0, 0, s * 0.42));
    box(0.05, 0.03, 0.05, 0, -bh / 2 - 0.01, recZ - bd / 2 - barrelLen * 0.72, S.steel);
  }
  if (A.coils) {
    const rings = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < rings; i++) {
      const cz = recZ - bd / 2 - 0.05 - i * (barrelLen * 0.8 / rings);
      box(bore * 2.6, bore * 2.6, 0.03, 0, bh * 0.08, cz, S.dark);
      glow(bore * 2.8, 0.014, 0.014, 0, bh * 0.08 + bore * 1.3, cz, def.color);
    }
  }
  if (A.emitter) {
    box(bore * 1.4, bore * 1.4, 0.1, 0, bh * 0.08, muzzleZ + 0.02, S.steel);
    glow(bore * 0.9, bore * 0.9, 0.06, 0, bh * 0.08, muzzleZ - 0.02, def.color);
  }

  // ---- rarity hardware ----
  const rare = def.rarity === "rare" || def.rarity === "epic" || def.rarity === "secret";
  if (rare) {
    // machined side plates: a repeating geometric cut along the receiver
    const plates = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < plates; i++) {
      const pz = recZ - bd * 0.34 + (bd * 0.68 / (plates - 1 || 1)) * i;
      [-1, 1].forEach((s) => box(0.012, bh * 0.4, bd * 0.09, s * (bw / 2 + 0.005), -bh * 0.05, pz, S.steel));
    }
  }
  if (def.rarity === "epic" || def.rarity === "secret") {
    const c = def.rarity === "secret" ? 0xffd43b : def.color;
    [-1, 1].forEach((s) => glow(0.008, 0.012, bd * 0.86, s * (bw / 2 + 0.008), bh * 0.3, recZ, c));
    glow(bw * 0.5, 0.01, 0.05, 0, bh * 0.66 + 0.004, recZ + bd * 0.42, c);
  }
  if (def.rarity === "secret") {
    // extra hardware only the top tier carries: side canisters and a halo ring
    [-1, 1].forEach((s) => {
      box(0.045, 0.045, 0.16, s * (bw / 2 + 0.035), -bh * 0.1, recZ + bd * 0.1, S.dark);
      glow(0.05, 0.016, 0.05, s * (bw / 2 + 0.035), -bh * 0.1, recZ + bd * 0.1 - 0.08, 0xffd43b);
    });
    // One continuous hoop with the rainbow running round it. It used to be
    // eight separate 3cm bars spinning round the muzzle, and with the gun
    // swung up into the sprint carry (muzzle near the middle of the view)
    // they read as stray coloured dashes on the screen.
    const ringGeo = new THREE.TorusGeometry(0.078, 0.011, 6, 40);
    const rc = [], pc = ringGeo.attributes.position, col = new THREE.Color();
    for (let i = 0; i < pc.count; i++) {
      const a = (Math.atan2(pc.getY(i), pc.getX(i)) / (Math.PI * 2) + 1) % 1;
      const k = a * G.RAINBOW_COLORS.length, i0 = Math.floor(k) % G.RAINBOW_COLORS.length, i1 = (i0 + 1) % G.RAINBOW_COLORS.length;
      col.setHex(G.RAINBOW_COLORS[i0]).lerp(new THREE.Color(G.RAINBOW_COLORS[i1]), k - Math.floor(k));
      rc.push(col.r, col.g, col.b);
    }
    ringGeo.setAttribute("color", new THREE.Float32BufferAttribute(rc, 3));
    const ring = new THREE.Group();
    ring.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ vertexColors: true })));
    ring.position.set(0, bh * 0.1, muzzleZ + 0.04);
    g.add(ring);
    g.userData.rainbowTrim = ring;
  }

  // ---- where the hands go (animation pass A) ----
  // Anchor points in gun coordinates: the grip for the firing hand, a spot
  // for the support hand (foregrip, pump, handguard -- or cupping the grip on
  // a pistol), and the parts a reload works on. The viewmodel puts the hands
  // on these with IK, so every gun is held by its own grip.
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hgLen = barrelLen * 0.55, hgZ = recZ - bd / 2 - hgLen / 2 - 0.02;
  let fore;
  if (A.foregrip) fore = V(0, -bh / 2 - 0.07, recZ - bd / 2 - barrelLen * 0.45);
  else if (A.pump) fore = V(0, bh * 0.06 - bore * 1.2, recZ - bd / 2 - barrelLen * 0.5);
  else if (A.handguard || A.coils) fore = V(0, bh * 0.06 - bore * 1.3, hgZ + hgLen * 0.2);
  else if (archKey === "pistol") fore = V(-0.02, -bh / 2 - 0.1, gripZ - 0.02);
  else fore = V(0, bh * 0.08 - bore * 1.1, recZ - bd / 2 - barrelLen * 0.28);
  const magDepth = { short: 0.1, long: 0.27, curved: 0.25, drum: 0.2, cell: 0.11 }[A.mag] || 0.12;
  g.userData.anchors = {
    grip: V(0, -bh / 2 - 0.08, gripZ + 0.005),
    fore,
    magWell: parts.mag ? parts.mag.position.clone() : V(0, -bh / 2, recZ - bd * 0.1),
    magBottom: parts.mag ? parts.mag.position.clone().add(V(0, -magDepth, 0)) : V(0, -bh / 2 - 0.02, recZ - bd * 0.1),
    bolt: parts.bolt ? parts.bolt.position.clone() : V(bw * 0.55, bh * 0.36, recZ),
    pump: parts.pump ? parts.pump.position.clone() : fore.clone(),
    cover: V(0, bh * 0.66, recZ - bd * 0.15),
    port: V(0, -bh / 2 - 0.02, recZ - bd * 0.15),
    muzzle: V(0, bh * 0.08, muzzleZ),
  };
  g.userData.parts = parts;
  g.userData.archetype = archKey;
  g.userData.magKind = A.mag;
  g.userData.magDepth = magDepth;
  g.userData.reloadStyle = archKey === "pistol" ? "pistol" : A.mag === "tube" ? "shotgun" : archKey === "sniper" ? "bolt"
    : archKey === "lmg" ? "belt" : (archKey === "launcher" || archKey === "cannon") ? "launcher" : "rifle";
  G.weldGunParts(g);
  return g;
};

G.buildRarityBadge = function (rarityKey) {
  // Small shape-coded marker so rarity never depends on color alone
  // (Accessibility: colorblind mode). Deliberately simple/cheap.
  const shape = (G.RARITY[rarityKey] || {}).badge || "square";
  const badge = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const s = 0.022;
  if (shape === "square") {
    badge.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat));
  } else if (shape === "diamond") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, s * 1.3, s), mat);
    m.rotation.z = Math.PI / 4; badge.add(m);
  } else if (shape === "cross") {
    const a = new THREE.Mesh(new THREE.BoxGeometry(s * 2, s * 0.5, s), mat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 2, s), mat);
    badge.add(a, b);
  } else if (shape === "triangle") {
    [[-0.02, -0.012], [0.02, -0.012], [0, 0.014]].forEach(([x, y]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
      m.position.set(x, y, 0); badge.add(m);
    });
  } else if (shape === "star") {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * 2.2, s * 0.4, s), mat);
      m.rotation.z = (Math.PI / 4) * i; badge.add(m);
    }
  }
  return badge;
};


// ---------------- Weapon weight (categories D2 and E) ----------------
// Derived from what a weapon IS rather than hand-set per gun, so every weapon
// added later gets a sensible figure for free and the numbers stay consistent
// with each other. Damage and magazine size stand in for bulk; shotguns,
// launchers and slow reloads all mean a big receiver to swing around.
G.weaponWeight = function (def) {
  if (!def || def.id === "melee") return 0.4;
  let w = 1.0;
  w += (def.damage || 20) / 60;
  w += (def.magSize || 10) / 40;
  if (def.pellets) w += 0.7;
  if (def.splash) w += 1.1;
  if (def.pierce) w += 0.5;
  w += Math.max(0, (def.reloadTime || 1500) - 1200) / 1200;
  if (def.auto && (def.magSize || 0) >= 30) w += 0.4;
  return Math.round(w * 100) / 100;
};

// Four bands, each with the movement penalty category E applies and the label
// shown in the weapon log, the mystery box and the shop (the labels are
// filled in from js/strings.js by G.localizeData).
G.WEIGHT_CLASSES = [
  { key: "light", max: 2.2, label: "", speedMult: 1.0, staminaMult: 1.0, color: "#6bff7a" },
  { key: "medium", max: 3.3, label: "", speedMult: 0.93, staminaMult: 1.12, color: "#ffd43b" },
  { key: "heavy", max: 4.4, label: "", speedMult: 0.84, staminaMult: 1.3, color: "#ff9a4d" },
  { key: "very_heavy", max: Infinity, label: "", speedMult: 0.74, staminaMult: 1.5, color: "#ff5c5c" },
];
G.weightClass = function (def) {
  const w = G.weaponWeight(def);
  return G.WEIGHT_CLASSES.find((c) => w <= c.max) || G.WEIGHT_CLASSES[G.WEIGHT_CLASSES.length - 1];
};

// How the weapon is carried, per weight band (category D2). `lead` is how far
// forward the support hand reaches along the barrel, `sag` how much the whole
// rig droops -- a launcher hangs visibly lower than a pistol.
// The y values stay within a narrow band on purpose: the hands are placed
// relative to them, and dropping a launcher as far as it "should" hang pushes
// the support hand straight out of the bottom of the frustum.
G.HOLD_POSES = {
  light: { x: 0.25, y: -0.28, z: -0.70, rx: -0.03, rz: 0.0, lead: 0.26, sag: 0.0, support: 1.0 },
  medium: { x: 0.30, y: -0.32, z: -0.75, rx: 0.0, rz: 0.0, lead: 0.40, sag: 0.02, support: 1.0 },
  heavy: { x: 0.32, y: -0.35, z: -0.78, rx: 0.04, rz: 0.05, lead: 0.50, sag: 0.04, support: 1.0 },
  very_heavy: { x: 0.34, y: -0.38, z: -0.82, rx: 0.07, rz: 0.09, lead: 0.58, sag: 0.06, support: 1.0 },
  melee: { x: 0.26, y: -0.30, z: -0.66, rx: -0.05, rz: 0.0, lead: 0.0, sag: 0.0, support: 0.0 },
};
G.holdPose = function (def) {
  if (!def) return G.HOLD_POSES.medium;
  if (def.id === "melee") return G.HOLD_POSES.melee;
  return G.HOLD_POSES[G.weightClass(def).key] || G.HOLD_POSES.medium;
};
G.buildWeaponMesh = function (def) {
  const g = G.buildWeaponModel(def);
  // (overhaul, round 2) its surfaces -- metal, polymer, a rubber grip, worn
  // edges, the shadows where parts meet -- and the whole gun one mesh on one
  // material (+ one for what glows), each moving part one more (js/gunskin.js)
  if (G.GunSkin) G.GunSkin.apply(g);
  // Category K: ~50 parts become one mesh per colour (the rainbow ring on
  // secret guns spins, so it stays separate). The moving parts -- magazine,
  // bolt, pump, cover -- are merged within themselves and kept apart.
  else if (G.Perf && G.Perf.mergeLocal) {
    const moving = Object.values(g.userData.parts || {});
    moving.forEach((p) => G.Perf.mergeLocal(p));
    G.Perf.mergeLocal(g, [g.userData.rainbowTrim].concat(moving));
  }
  if (G.save && G.save.settings && G.save.settings.colorblindMode) {
    const badge = G.buildRarityBadge(def.rarity);
    // Clears even the tallest silhouette (golden_smg's crown spikes top out
    // around y=0.2) so the badge never ends up occluded by the gun itself.
    badge.position.set(0.06, 0.24, -0.05);
    g.add(badge);
  }
  return g;
};

G.buildMeleeMesh = function () {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), G.makeBoxMat(0x3a2a1a));
  handle.position.set(0, -0.1, 0);
  g.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), G.makeBoxMat(0xcfd6d6));
  blade.position.set(0, 0.14, 0);
  g.add(blade);
  g.userData.anchors = { grip: new THREE.Vector3(0, -0.1, 0) };
  g.userData.parts = {};
  g.userData.reloadStyle = null;
  // (overhaul, round 2) a rubber handle, a bare steel blade
  handle.material.userData.skin = "grip"; blade.material.userData.skin = "bare";
  if (G.GunSkin) G.GunSkin.apply(g);
  return g;
};

// ---------------- Word billboard sprite ----------------
// (vocabulary series, round 2, D1) A label is drawn as large as fits: a long
// word or a long Thai meaning shrinks instead of running off the edge. Thai
// sits a little lower and smaller than English so the vowels and tone marks
// stacked above the line (and the vowels below it) stay on the canvas.
const THAI_CHAR = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
// (new series, round 2, G) `pos`: the word's part of speech ("N./V."), drawn
// after it smaller (G.CONFIG.aim.posScale of the word) and fainter, so the
// word still reads first and a crowd's words stay narrow
// (round 3, H4) Chinese is drawn in a Chinese font, with `ruby` -- its pinyin --
// small above it (G.CONFIG.aim.pinyinScale of the characters); French accents
// and Thai marks stay inside the canvas
const CJK_CHAR = /[\u3400-\u9FFF]/;
G.LABEL_FONTS = {
  latin: "Segoe UI, Helvetica Neue, Arial, sans-serif",
  thai: "Tahoma, Leelawadee UI, Noto Sans Thai, Thonburi, Segoe UI, sans-serif",
  cjk: "Microsoft YaHei, PingFang SC, Noto Sans SC, Hiragino Sans GB, Source Han Sans SC, sans-serif",
};
G.drawWordLabel = function (ctx, canvas, text, color, pos, ruby) {
  const thai = THAI_CHAR.test(text), cjk = CJK_CHAR.test(text);
  const family = thai ? G.LABEL_FONTS.thai : cjk ? G.LABEL_FONTS.cjk : G.LABEL_FONTS.latin;
  pos = pos && text ? "(" + pos + ")" : "";
  ruby = ruby && text ? String(ruby) : "";
  let size = thai ? 52 : ruby ? 54 : 64;
  const room = canvas.width - 28;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const k = (G.CONFIG && G.CONFIG.aim && G.CONFIG.aim.posScale) || 0.46;
  const posFont = (s) => "600 " + Math.round(s * k) + "px " + G.LABEL_FONTS.latin;
  const rk = (G.CONFIG && G.CONFIG.aim && G.CONFIG.aim.pinyinScale) || 0.4;
  const rubyFont = (s) => "600 " + Math.round(s * rk) + "px " + G.LABEL_FONTS.latin;
  const widths = () => {
    ctx.font = "bold " + size + "px " + family;
    const w = ctx.measureText(text).width;
    let r = 0;
    if (ruby) { ctx.font = rubyFont(size); r = ctx.measureText(ruby).width; }
    if (!pos) return { w, p: 0, gap: 0, r };
    ctx.font = posFont(size);
    return { w, p: ctx.measureText(pos).width, gap: size * 0.12, r };
  };
  let m = widths();
  while (size > 20 && (m.w + m.gap + m.p > room || m.r > room)) { size -= 3; m = widths(); }
  ctx.textBaseline = "middle";
  // (with pinyin: the characters a little lower, the pinyin over them)
  const y = canvas.height / 2 + (thai ? size * 0.08 : 0) + (ruby ? size * 0.3 : 0);
  const total = m.w + m.gap + m.p, x0 = (canvas.width - total) / 2;
  // (visual series, E1) a dark see-through plate behind the words: they read
  // against anything -- a lamp, the fog, the moon (js/visual-config.js labels)
  const P = G.VISUAL && G.VISUAL.labels;
  if (P && text && text.trim()) {
    const padX = size * 0.32;
    const top = Math.max(2, (ruby ? y - size * 0.62 - size * rk * 1.2 : y - size * (thai ? 0.8 : 0.66)) - size * 0.08);
    const bottom = Math.min(canvas.height - 2, y + size * (thai ? 0.66 : 0.52));
    const left = Math.max(2, x0 - padX), right = Math.min(canvas.width - 2, x0 + total + padX);
    const rr = Math.min(size * 0.3, (bottom - top) / 2);
    const c = new THREE.Color(P.plate);
    ctx.fillStyle = "rgba(" + Math.round(c.r * 255) + "," + Math.round(c.g * 255) + "," + Math.round(c.b * 255) + "," + P.plateAlpha + ")";
    ctx.beginPath();
    ctx.moveTo(left + rr, top); ctx.lineTo(right - rr, top); ctx.quadraticCurveTo(right, top, right, top + rr);
    ctx.lineTo(right, bottom - rr); ctx.quadraticCurveTo(right, bottom, right - rr, bottom);
    ctx.lineTo(left + rr, bottom); ctx.quadraticCurveTo(left, bottom, left, bottom - rr);
    ctx.lineTo(left, top + rr); ctx.quadraticCurveTo(left, top, left + rr, top);
    ctx.fill();
  }
  ctx.lineWidth = thai ? 7 : 8; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineJoin = "round";
  ctx.font = "bold " + size + "px " + family;
  ctx.textAlign = "left";
  ctx.strokeText(text, x0, y);
  ctx.fillStyle = color || "#ffffff";
  ctx.fillText(text, x0, y);
  // a word crossed out (Fifty-Fifty): a line through it, as well as the grey
  if (text.charCodeAt(0) === 0x2717) { ctx.fillRect(x0, y - size * 0.04, m.w, Math.max(3, size * 0.07)); }
  if (ruby) {
    ctx.font = rubyFont(size);
    ctx.textAlign = "center";
    const ry = y - size * 0.62 - size * rk * 0.45;
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(ruby, x0 + m.w / 2, ry);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillText(ruby, x0 + m.w / 2, ry);
    ctx.textAlign = "left"; ctx.lineWidth = 8;
  }
  if (pos) {
    // on the word's baseline, not its middle: small text sits on the line
    ctx.font = posFont(size);
    const py = y + size * 0.19;
    // (dimmer than the word, but solid: see-through grey vanished on a light wall)
    ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(pos, x0 + m.w + m.gap, py);
    ctx.fillStyle = "#c2cbd3";
    ctx.fillText(pos, x0 + m.w + m.gap, py);
    ctx.lineWidth = 8;
  }
  // (new series, round 1, B3) how much of the canvas the words take: a label
  // is hit where its words are, not on the empty band around them
  const tw = text ? total + ctx.lineWidth + 12 : 0;
  canvas.__fw = Math.min(1, tw / canvas.width);
  canvas.__fh = text ? Math.min(1, (size * (ruby ? 1.3 + rk * 1.6 : 1.3) + ctx.lineWidth) / canvas.height) : 0;
};
G.makeWordSprite = function (text, opts) {
  opts = opts || {};
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  G.drawWordLabel(ctx, canvas, text, opts.color || "#ffffff", opts.pos, opts.ruby);
  const tex = new THREE.CanvasTexture(canvas);
  // (visual series, E1) no fog, no film, no glow: words are drawn last, on
  // their own layer, over the finished picture (js/visuals.js)
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.layers.set(G.Visuals ? G.Visuals.LABEL_LAYER : 0);
  sprite.scale.set(2.2, 0.55, 1);
  sprite.userData.canvas = canvas;
  sprite.userData.ctx = ctx;
  sprite.userData.tex = tex;
  sprite.userData.baseScale = [2.2, 0.55];
  return sprite;
};
G.updateWordSprite = function (sprite, text, color, pos, ruby) {
  G.drawWordLabel(sprite.userData.ctx, sprite.userData.canvas, text, color || "#ffffff", pos, ruby);
  sprite.userData.tex.needsUpdate = true;
};

// ---------------- Zombie ----------------
// (G.ZOMBIE_TYPES -- hit points, speed, bite damage: js/config.js)

// Per-type face language (category D): normal/fast/boss each get a distinct
// glow color and detail set so they read apart even in silhouette/low light,
// not just by body color/size.
const ZOMBIE_FACE = {
  normal:  { eyeColor: 0xff2a1a, eyeSize: 0.045, mouthWidth: 0.14, scars: 2 },
  fast:    { eyeColor: 0xffe83a, eyeSize: 0.04, mouthWidth: 0.11, scars: 1 },
  crawler: { eyeColor: 0xff8a1a, eyeSize: 0.05, mouthWidth: 0.16, scars: 3 },
  boss:    { eyeColor: 0xff0000, eyeSize: 0.07, mouthWidth: 0.2, scars: 5 },
};

// Category C: per-instance random variation so zombies of the same type don't
// look identical -- mixes face jitter, clothing damage, and optional mouth
// blood, combined independently so many distinct-looking results are possible
// from the same handful of building blocks.
G.randomZombieVariation = function () {
  return {
    eyeSizeMult: 0.75 + G.rng() * 0.6,
    eyeJitterX: (G.rng() - 0.5) * 0.02,
    eyeJitterY: (G.rng() - 0.5) * 0.025,
    earSizeMult: 0.75 + G.rng() * 0.5,
    noseJitterX: (G.rng() - 0.5) * 0.025,
    mouthBlood: G.rng() < 0.55,
    tatterAmount: G.rng(), // 0 = barely torn, 1 = shredded
    extraWounds: Math.floor(G.rng() * 3), // 0-2 extra scars beyond the type base
  };
}

function addZombieFace(head, type, skinMat, variation, odd, hs) {
  // (overhaul, round 4: each kind's eyes -- js/zombiefactory.js KIND -- and
  // the face drawn on the head's front, look.face)
  const K = (G.ZombieFactory && G.ZombieFactory.KIND[type]) || ZOMBIE_FACE[type] || ZOMBIE_FACE.normal;
  const f = { eyeColor: K.eye != null ? K.eye : K.eyeColor, eyeSize: K.eyeSize, mouthWidth: K.mouthWidth, scars: K.scars };
  const v = variation || G.randomZombieVariation();
  hs = hs || 0.35;
  const k0 = hs / 0.35, fz = hs / 2 + 0.001;
  const eyeMat = new THREE.MeshBasicMaterial({ color: f.eyeColor });
  // (visual series, round 2, I: the eyes glow -- over 1.0 in the HDR picture,
  // kept through the merge into vertex colours; round 4: as much as the kind's)
  if (G.VISUAL && G.VISUAL.lighting && K.glow) eyeMat.color.multiplyScalar(Math.max(1, G.VISUAL.lighting.eyes * K.glow));
  const eyeSize = f.eyeSize * v.eyeSizeMult * k0;
  // (I2, a deformed face: one eye swollen big and high, the other shrunk,
  // low and set wide)
  const bent = odd === "deformed";
  [-0.09, 0.09].forEach((x, i) => {
    const k = bent ? (i ? 0.6 : 1.7) : 1, dy = bent ? (i ? -0.035 : 0.02) : 0, dx = bent && i ? 0.02 : 0;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize * k, eyeSize * k, 0.02), eyeMat);
    eye.position.set((x + dx + v.eyeJitterX) * k0, (0.04 + dy + v.eyeJitterY) * k0, fz - 0.001); head.add(eye);
    // (the Screamer: empty black sockets, a white point far back in each)
    if (K.pupil != null) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(eyeSize * 0.22, eyeSize * 0.22, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(K.pupil).multiplyScalar(G.VISUAL && G.VISUAL.lighting ? G.VISUAL.lighting.eyes : 1) }));
      p.position.set(eye.position.x, eye.position.y - eyeSize * 0.1, fz + 0.006); head.add(p);
    }
  });
  // ears
  [-hs / 2, hs / 2].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08 * v.earSizeMult * k0, 0.08 * v.earSizeMult * k0), skinMat);
    ear.position.set(x, 0, 0); head.add(ear);
  });
  // nose (slightly darker, damaged-looking)
  const noseMat = G.ZombieSkin ? G.ZombieSkin.tag(new THREE.MeshLambertMaterial({ color: new THREE.Color(skinMat.color).multiplyScalar(0.7).getHex() }), "skin")
    : new THREE.MeshLambertMaterial({ color: new THREE.Color(skinMat.color).multiplyScalar(0.7).getHex() });
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05 * k0, 0.05 * k0, 0.04), noseMat);
  nose.position.set(v.noseJitterX * k0, -0.02 * k0, fz + 0.005); head.add(nose);
  const gore = v.gore || "full", GC = (hex) => (G.ZombieFactory ? G.ZombieFactory.goreColor(hex, gore) : hex);
  if (bent || K.torn) { addDeformedMouth(head, { mouthWidth: f.mouthWidth * k0 }, skinMat, GC, k0); return; }
  // gaping mouth with a blood-red interior showing
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(f.mouthWidth * k0, 0.06 * k0, 0.04), new THREE.MeshBasicMaterial({ color: 0x1a0505 }));
  mouth.position.set(0, -0.1 * k0, fz); head.add(mouth);
  if (v.mouthBlood && gore === "full") {
    const blood = new THREE.Mesh(new THREE.BoxGeometry(f.mouthWidth * 0.8 * k0, 0.025, 0.045), new THREE.MeshBasicMaterial({ color: 0x8a1414 }));
    blood.position.set(0, -0.14 * k0, fz + 0.001); head.add(blood);
  }
}

// I2: the mouth torn wide, from cheek to cheek, split up towards the ears,
// the teeth showing -- and the jaw hanging off it, open, by a strip of skin
function addDeformedMouth(head, f, skinMat, GC, k0) {
  GC = GC || ((h) => h); k0 = k0 || 1;
  const dark = new THREE.MeshBasicMaterial({ color: 0x1a0505 }), red = new THREE.MeshBasicMaterial({ color: GC(0x7a1010) });
  const tooth = G.makeBoxMat(0xd8d2b0);
  if (G.ZombieSkin) G.ZombieSkin.tag(tooth, "bone");
  const add = (geo, mat, x, y, z, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rz) m.rotation.z = rz; head.add(m); return m; };
  const W = Math.max(0.24 * k0, f.mouthWidth * 1.8);
  add(new THREE.BoxGeometry(W, 0.1 * k0, 0.04), dark, 0, -0.1 * k0, 0.172 * k0);
  [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.09 * k0, 0.022, 0.042), red, s * (W / 2 + 0.02), -0.075 * k0, 0.172 * k0, s * 0.55));   // the tears
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.024, 0.03, 0.02), tooth, -W / 2 + 0.03 + i * (W - 0.06) / 5, -0.062 * k0, 0.18 * k0);
  // the jaw: a slab under the head, dropped and swung open
  const jaw = new THREE.Group(); jaw.position.set(0, -0.16 * k0, 0.05 * k0); jaw.rotation.x = 0.55; jaw.rotation.z = 0.12; head.add(jaw);
  const j = new THREE.Mesh(new THREE.BoxGeometry(0.26 * k0, 0.06, 0.22 * k0), skinMat); j.position.set(0, -0.05, 0.06 * k0); jaw.add(j);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.028, 0.02), tooth); t.position.set((-0.08 + i * 0.04) * k0, -0.012, 0.16 * k0); jaw.add(t); }
  const gum = new THREE.Mesh(new THREE.BoxGeometry(0.2 * k0, 0.012, 0.12 * k0), red); gum.position.set(0, -0.018, 0.08 * k0); jaw.add(gum);
}

// I2: scars -- a raw line, or an old pale one, some with stitches across it --
// on one face of a limb (or the head): a box of size (sx, sy, sz) centred at
// (0, cy, 0) in `parent`. They stand out 4 mm from the surface.
// (No groups here: a joint's pieces are merged into one mesh, but a group
// inside a joint would be kept apart -- another draw call -- so each piece
// carries its own offset in its geometry and sits on the joint itself.)
function addScar(parent, sx, sy, sz, cy, mats) {
  const face = Math.floor(G.rng() * 4);                 // +z, -z, +x, -x
  const along = face < 2 ? "x" : "z";
  const half = along === "x" ? sx / 2 : sz / 2;
  const len = Math.min(half * 1.6, 0.05 + G.rng() * 0.08), ang = (G.rng() - 0.5) * 1.6;
  const y = cy + (G.rng() - 0.5) * sy * 0.7, u = (G.rng() - 0.5) * half * 0.6;
  const mat = G.rng() < 0.55 ? mats.scar : mats.oldScar;
  const s = face % 2 ? -1 : 1;
  const put = (geo, m) => {
    const o = new THREE.Mesh(geo, m);
    if (along === "x") { o.position.set(u, y, s * (sz / 2 + 0.004)); o.rotation.z = ang; }
    else { o.position.set(s * (sx / 2 + 0.004), y, u); o.rotation.x = ang; }
    parent.add(o);
  };
  put(along === "x" ? new THREE.BoxGeometry(len, 0.013, 0.008) : new THREE.BoxGeometry(0.008, 0.013, len), mat);
  if (G.rng() < 0.5) {
    const n = 2 + Math.floor(len / 0.035);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (i + 0.5) * len / n;
      put(along === "x" ? new THREE.BoxGeometry(0.006, 0.034, 0.01).translate(t, 0, 0) : new THREE.BoxGeometry(0.01, 0.034, 0.006).translate(0, 0, t), mats.stitch);
    }
  }
}

// I2: four fingers and a thumb under a hand (hand box w x h x d centred at
// (0, hy, hz)), each its own length and curl -- `k` scales them (a big arm's
// hand), `clawK` stretches them (a long arm's claws)
function addFingers(parent, w, h, d, hy, hz, side, mat, k, clawK) {
  k = k || 1; clawK = clawK || 1;
  const bottom = hy - h / 2, fw = w / 5.2;
  for (let i = 0; i < 4; i++) {
    const len = (0.07 + G.rng() * 0.03 + (i === 1 || i === 2 ? 0.015 : 0)) * k * clawK;
    const m = new THREE.Mesh(new THREE.BoxGeometry(fw * 0.85, len, fw * 0.95).translate(0, -len / 2, 0), mat);
    m.position.set(-w / 2 + fw * 0.7 + i * (w - fw * 1.4) / 3, bottom + 0.005, hz + d * 0.18);
    m.rotation.set(-0.15 + G.rng() * 0.55, 0, (G.rng() - 0.5) * 0.2);   // curled in, some more than others
    parent.add(m);
  }
  const tm = new THREE.Mesh(new THREE.BoxGeometry(fw * 0.95, 0.06 * k, fw).translate(0, -0.03 * k, 0), mat);
  tm.position.set(-side * (w / 2 - 0.005), hy - h * 0.1, hz + d * 0.25);
  tm.rotation.set(-0.4, 0, -side * 0.5);
  parent.add(tm);
}

// (round 4: tw / td the torso's own width and depth; GC the Blood & Gore colour)
function addWounds(torso, count, GC, tw, td) {
  GC = GC || ((h) => h); tw = tw || 0.5; td = td || 0.3;
  const woundColors = [0x6b0f0f, 0x1a1a1a, 0x4a0a0a];
  for (let i = 0; i < count; i++) {
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 + G.rng() * 0.06, 0.05 + G.rng() * 0.06, 0.02),
      new THREE.MeshBasicMaterial({ color: GC(woundColors[i % woundColors.length]) })
    );
    const side = G.rng() > 0.5 ? 1 : -1;
    w.position.set((G.rng() - 0.5) * tw * 0.7, -0.2 + G.rng() * 0.45, side * (td / 2 + 0.001));
    if (side < 0) w.rotation.y = Math.PI;
    torso.add(w);
  }
}

// Ragged clothing strips off the torso hem -- count/size driven by
// variation.tatterAmount so some zombies look barely torn and others shredded.
function addTatteredClothing(g, tornMat, tatterAmount, anchorY, anchorZ) {
  const stripCount = 1 + Math.round(tatterAmount * 3); // 1-4 strips
  for (let i = 0; i < stripCount; i++) {
    const x = -0.18 + (i / Math.max(1, stripCount - 1)) * 0.36 + (G.rng() - 0.5) * 0.06;
    const h = 0.12 + tatterAmount * 0.16 + G.rng() * 0.06;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.04), tornMat);
    strip.position.set(x, anchorY - h / 2, anchorZ);
    strip.rotation.z = (G.rng() - 0.5) * 0.4 * (0.4 + tatterAmount);
    g.add(strip);
  }
}

function zBox(parent, w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ---------------- Skin and clothes (round 2, E) ----------------
// Skin comes from five tones that still read as dead -- each jittered in hue,
// saturation and lightness, so no two zombies share a colour. Clothes come
// from the level: school uniforms, teachers and janitors at the school;
// gowns, scrubs and white coats at the hospital; camouflage, overalls and
// lab coats in the bunker. Colour is never what tells the TYPES apart --
// build does (a fast one is lean and hunched, a crawler has no legs, the
// boss is three times the size and armoured).
G.ZOMBIE_SKINS = [
  { key: "pale_green", h: 0.25, s: 0.24, l: 0.46 },
  { key: "blue_grey", h: 0.58, s: 0.13, l: 0.55 },
  { key: "pale_yellow", h: 0.14, s: 0.33, l: 0.62 },
  { key: "bruised_purple", h: 0.8, s: 0.17, l: 0.44 },
  { key: "ashen_white", h: 0.1, s: 0.06, l: 0.76 },
];
// Outfits per theme. `top`/`bottom` are colour lists (one is picked);
// `legs`: trousers | shorts | skirt | gown | coverall; `sleeves`: short | long;
// `coat`: a long open coat over `top`; extras: hat, glasses, goggles, belt,
// badge, stethoscope, lanyard, camo, hair.
// (overhaul, round 4) civilians in every level -- an office worker, a farmer
// in dungarees and a hat, someone who lived on the street -- and the outfits
// only one kind wears (`only`): the Sprinter's gym kit, the Ironclad's
// hard hat, riot gear or helmet, a child's clothes, the Abomination's rags.
// `fabric`: which atlas tile the top shows (shirt | knit | coat).
const CIVILIANS = [
  { key: "office", w: 1, top: [0xdfe3e8, 0xc9d4e0, 0xe8e0d0], bottom: [0x2a2d36, 0x3a3530], legs: "trousers", sleeves: "long", extras: ["tie", "hair?", "glasses?"] },
  { key: "farmer", w: 0.6, top: [0xb03a2e, 0x7a5a3a, 0x6b7a8a], bottom: [0x2d4a6b, 0x3a4a5a], legs: "trousers", sleeves: "short", extras: ["overalls", "strawhat?"] },
  { key: "homeless", w: 0.5, top: [0x4a4038, 0x3a3a34], bottom: [0x2e2a26, 0x3a3328], legs: "trousers", sleeves: "long", coat: 0x5a4a38, extras: ["beanie", "hair?"] },
];
G.ZOMBIE_OUTFITS = {
  school: [
    { key: "student", w: 3, top: [0xe9e7de, 0xdcdad0, 0xf0eee6], bottom: [0x1f2a4a, 0x1c1c20, 0x5a3e26], legs: "shorts", sleeves: "short", extras: ["badge", "hair?"] },
    { key: "student_skirt", w: 3, top: [0xe9e7de, 0xf0eee6], bottom: [0x1f2a4a, 0x1c1c20], legs: "skirt", sleeves: "short", extras: ["hair", "badge"] },
    { key: "teacher", w: 2, top: [0x9cc3e0, 0xe0b8c4, 0xd9c9a0, 0xb8d6b0], bottom: [0x2e2e36, 0x3d342a, 0x2a3346], legs: "trousers|skirt", sleeves: "long", extras: ["lanyard", "glasses?", "hair?"] },
    { key: "janitor", w: 1, top: [0x4d5d6b, 0x6f6a52], bottom: null, legs: "coverall", sleeves: "long", extras: ["hat", "belt"] },
  ].concat(CIVILIANS),
  hospital: [
    { key: "patient", w: 3, top: [0x9fc3d8, 0xa8c9b0, 0xc4d4e0], bottom: null, legs: "gown", sleeves: "short", extras: ["hair?"] },
    { key: "nurse", w: 2, top: [0x3f9a9a, 0x7fb3d5, 0xd89aa8], bottom: null, legs: "coverall", sleeves: "short", extras: ["hat", "badge"] },
    { key: "doctor", w: 2, top: [0x6b8fb5, 0x9bb07a, 0x8a8f99], bottom: [0x2a2d36, 0x3a3f4a], legs: "trousers", sleeves: "long", coat: 0xeeeeea, extras: ["stethoscope", "badge", "glasses?"] },
  ].concat(CIVILIANS),
  bunker: [
    { key: "soldier", w: 3, top: [0x4a5a33, 0x56603f, 0x6b6a45], bottom: null, legs: "coverall", sleeves: "long", extras: ["camo", "hat", "belt"] },
    { key: "mechanic", w: 2, top: [0xc2652a, 0x2b3a55, 0x7a7a70], bottom: null, legs: "coverall", sleeves: "long", extras: ["belt"] },
    { key: "scientist", w: 2, top: [0x8a9a8a, 0x9a8f80, 0x7f8fa0], bottom: [0x33353c, 0x4a4238], legs: "trousers", sleeves: "long", coat: 0xe8ecec, extras: ["goggles", "badge"] },
  ].concat(CIVILIANS),
};
// the kinds' own (js/zombiefactory.js WEARS picks them)
const KIND_OUTFITS = [
  { key: "gym", only: true, top: [0xe8e8e2, 0xd0d8e0], bottom: [0x1f2a6b, 0x7a1f1f, 0x1c1c20], legs: "shorts", sleeves: "short", fabric: "knit", extras: ["hair?"] },
  { key: "runner", only: true, top: [0x2a6b9a, 0xc23a3a, 0x3a3a3a], bottom: [0x1c1c20, 0x2a2a3a], legs: "shorts", sleeves: "short", fabric: "knit", extras: [] },
  { key: "builder", only: true, top: [0x6b7a8a, 0x8a6a4a], bottom: [0x2d3a4a, 0x4a4030], legs: "trousers", sleeves: "long", extras: ["hivis", "belt"], helmet: "hardhat" },
  { key: "riot", only: true, top: [0x1c1e24, 0x22262e], bottom: [0x1a1c22], legs: "trousers", sleeves: "long", extras: ["belt"], helmet: "riot" },
  { key: "trooper", only: true, top: [0x4a5a33, 0x56603f], bottom: null, legs: "coverall", sleeves: "long", extras: ["camo", "belt"], helmet: "army" },
  { key: "kid", only: true, top: [0xe9e7de, 0xc2652a, 0x3a7a5a, 0x8a3a6b], bottom: [0x1f2a4a, 0x3a3a3a], legs: "shorts", sleeves: "short", extras: ["hair?", "backpack?"] },
  { key: "kidPatient", only: true, top: [0xb8d4e8, 0xe8c8d0], bottom: null, legs: "gown", sleeves: "short", extras: ["hair?"] },
  { key: "shreds", only: true, top: [0x3a3028, 0x2e2a26], bottom: [0x2a241e], legs: "trousers", sleeves: "short", extras: ["shreds"] },
];
G.HAIR_COLORS = [0x1a1512, 0x2e2118, 0x4a3522, 0x6b6660];
// the two materials every zombie is drawn with (colours are in the vertices);
// `shared` keeps G.disposeObject3D from freeing them with a dead zombie
G.ZOMBIE_MATS = {
  lambert: new THREE.MeshLambertMaterial({ vertexColors: true }),
  basic: new THREE.MeshBasicMaterial({ vertexColors: true }),
};
G.ZOMBIE_MATS.lambert.userData.shared = true;
G.ZOMBIE_MATS.basic.userData.shared = true;

// (round 4: `want` -- an outfit by its key, of the level's or a kind's own)
G.randomZombieLook = function (type, theme, want) {
  const rand = (a, b) => a + G.rng() * (b - a);
  const tone = G.pick(G.ZOMBIE_SKINS);
  const skin = new THREE.Color().setHSL(tone.h + rand(-0.025, 0.025), Math.max(0, tone.s + rand(-0.06, 0.06)), tone.l + rand(-0.08, 0.08));
  const list = G.ZOMBIE_OUTFITS[theme] || G.ZOMBIE_OUTFITS.school;
  const total = list.reduce((s, o) => s + o.w, 0);
  let r = G.rng() * total, o = list[0];
  for (const c of list) { r -= c.w; if (r <= 0) { o = c; break; } }
  if (want) o = list.find((c) => c.key === want) || KIND_OUTFITS.find((c) => c.key === want) || o;
  // dirt and blood: every garment a little darker and greyer than new
  const soil = (hex) => new THREE.Color(hex).offsetHSL(0, rand(-0.12, -0.02), rand(-0.12, 0));
  const top = soil(G.pick(o.top));
  const legs = o.legs.includes("|") ? G.pick(o.legs.split("|")) : o.legs;
  const bottom = o.bottom ? soil(G.pick(o.bottom)) : top.clone().offsetHSL(0, 0, -0.05);
  const extras = new Set();
  o.extras.forEach((e) => { if (e.endsWith("?")) { if (G.rng() < 0.5) extras.add(e.slice(0, -1)); } else extras.add(e); });
  // newer list, round 3 (I2): now and then an odd one (G.CONFIG.zombieLooks)
  // (overhaul, round 4: a Shambler only -- and a Crawler's torn face)
  const C = (G.CONFIG && G.CONFIG.zombieLooks) || { oddChance: 0, odd: {} };
  let odd = null;
  if ((type === "normal" || type === "crawler") && G.rng() < C.oddChance) {
    const kinds = Object.keys(C.odd).filter((k) => type !== "crawler" || k === "deformed");
    let r2 = G.rng() * kinds.reduce((s, k) => s + C.odd[k], 0);
    for (const k of kinds) { r2 -= C.odd[k]; if (r2 <= 0) { odd = k; break; } }
  }
  return {
    odd, oddSide: G.rng() < 0.5 ? -1 : 1,
    outfit: o.key, tone: tone.key, skin, top, bottom, legs, sleeves: o.sleeves,
    coat: o.coat ? soil(o.coat) : null, extras,
    fabric: o.fabric || (o.coat ? "coat" : "shirt"), helmet: o.helmet || null,
    hair: new THREE.Color(G.pick(G.HAIR_COLORS)),
    shoe: new THREE.Color(G.pick([0x1b1b1b, 0x2d2419, 0x3a3a3a])),
    sock: new THREE.Color(G.pick([0xe6e6e0, 0x2a2a2a])),
    face: "faceA",
  };
};

// Build per type: a fast one is narrower and slighter, so it reads apart by
// shape even in silhouette.
// (overhaul, round 4: the ten kinds. torsoH its body's height, leg/arm the
// limbs' length, armT their thickness, neck a neck stretched out of the
// shoulders, hunch how far the body leans in -- all before the kind's
// `scale`. A Runt's head is big for its body; a Bloater is as deep as it is
// wide; a Reacher's arms reach its knees.)
const ZOMBIE_BUILD = {
  normal:      { torsoW: 0.5, torsoD: 0.3, torsoH: 0.7, limb: 1.0, head: 0.35, leg: 1, arm: 1, armT: 1, neck: 0, hunch: 0.2 },
  fast:        { torsoW: 0.4, torsoD: 0.24, torsoH: 0.68, limb: 0.8, head: 0.31, leg: 1.06, arm: 1.04, armT: 0.85, neck: 0, hunch: 0.34 },
  crawler:     { torsoW: 0.4, torsoD: 0.32, limb: 1.0, head: 0.32 },
  bloater:     { torsoW: 0.74, torsoD: 0.56, torsoH: 0.74, limb: 1.15, head: 0.34, leg: 0.88, arm: 0.92, armT: 1.08, neck: -0.04, hunch: 0.1 },
  ironclad:    { torsoW: 0.56, torsoD: 0.34, torsoH: 0.72, limb: 1.12, head: 0.36, leg: 1, arm: 1, armT: 1.1, neck: 0, hunch: 0.1 },
  runt:        { torsoW: 0.42, torsoD: 0.27, torsoH: 0.56, limb: 0.92, head: 0.47, leg: 0.8, arm: 0.86, armT: 0.9, neck: 0, hunch: 0.28 },
  abomination: { torsoW: 0.62, torsoD: 0.4, torsoH: 0.78, limb: 1.3, head: 0.33, leg: 1.04, arm: 1.2, armT: 1.2, neck: 0, hunch: 0.3 },
  screamer:    { torsoW: 0.4, torsoD: 0.24, torsoH: 0.8, limb: 0.76, head: 0.32, leg: 1.12, arm: 1.12, armT: 0.8, neck: 0.12, hunch: 0.16 },
  headless:    { torsoW: 0.5, torsoD: 0.3, torsoH: 0.7, limb: 1.0, head: 0.35, leg: 1, arm: 1, armT: 1, neck: 0, hunch: 0.16 },
  reacher:     { torsoW: 0.54, torsoD: 0.32, torsoH: 0.76, limb: 1.12, head: 0.33, leg: 1.08, arm: 1.55, armT: 1.25, neck: 0, hunch: 0.32 },
  boss:        { torsoW: 0.56, torsoD: 0.34, torsoH: 0.7, limb: 1.1, head: 0.36, leg: 1, arm: 1, armT: 1, neck: 0, hunch: 0.16 },
};
G.ZOMBIE_BUILD = ZOMBIE_BUILD;

// The small things that make one zombie a nurse and another a soldier.
function addHeadExtras(head, look, hs, mats) {
  const E = look.extras;
  if (E.has("hair")) {
    zBox(head, hs * 1.04, hs * 0.22, hs * 1.04, 0, hs * 0.44, -0.01, mats.hair);             // crown
    zBox(head, hs * 1.04, hs * 0.55, hs * 0.2, 0, hs * 0.2, -hs * 0.44, mats.hair);          // back
  }
  if (E.has("hat")) {
    if (look.outfit === "soldier") {
      zBox(head, hs * 1.16, hs * 0.34, hs * 1.16, 0, hs * 0.52, 0, mats.hat);                // helmet
      zBox(head, hs * 1.24, hs * 0.07, hs * 1.24, 0, hs * 0.36, 0, mats.hat);
    } else if (look.outfit === "nurse") {
      zBox(head, hs * 0.6, hs * 0.18, hs * 0.5, 0, hs * 0.58, 0.02, mats.white);
    } else {
      zBox(head, hs * 1.06, hs * 0.2, hs * 1.06, 0, hs * 0.54, 0, mats.hat);                 // cap
      zBox(head, hs * 0.9, hs * 0.05, hs * 0.4, 0, hs * 0.46, hs * 0.62, mats.hat);          // peak
    }
  }
  if (E.has("glasses")) {
    [-0.09, 0.09].forEach((x) => zBox(head, 0.1, 0.07, 0.015, x, 0.04, hs / 2 + 0.012, mats.dark));
    zBox(head, 0.07, 0.015, 0.015, 0, 0.055, hs / 2 + 0.012, mats.dark);
  }
  if (E.has("goggles")) {
    zBox(head, hs * 1.06, 0.05, hs * 1.06, 0, 0.13, 0, mats.dark);
    [-0.08, 0.08].forEach((x) => zBox(head, 0.11, 0.08, 0.04, x, 0.13, hs / 2 + 0.02, mats.lens));
  }
  // (overhaul, round 4) a farmer's straw hat, a beanie
  if (E.has("strawhat")) {
    zBox(head, hs * 1.7, hs * 0.06, hs * 1.7, 0, hs * 0.5, 0, mats.straw);
    zBox(head, hs * 1.02, hs * 0.26, hs * 1.02, 0, hs * 0.64, 0, mats.straw);
  }
  if (E.has("beanie")) zBox(head, hs * 1.08, hs * 0.34, hs * 1.08, 0, hs * 0.42, -0.005, mats.beanie);
}
// (overhaul, round 4) the Ironclad's helmet: a builder's hard hat, riot
// police's with a visor (the eyes glow through its slit), an army helmet --
// in a group of its own, so a head shot can knock it off
function addHelmet(neck, headY, hs, kind, mats) {
  const h = new THREE.Group(); h.position.y = headY; neck.add(h);
  if (kind === "hardhat") {
    zBox(h, hs * 1.12, hs * 0.36, hs * 1.12, 0, hs * 0.6, 0, mats.hardhat);
    zBox(h, hs * 1.3, hs * 0.05, hs * 1.36, 0, hs * 0.44, 0.03, mats.hardhat);
    zBox(h, hs * 0.12, hs * 0.1, hs * 1.14, 0, hs * 0.8, 0, mats.hardhat);              // the ridge
  } else if (kind === "riot") {
    zBox(h, hs * 1.16, hs * 0.46, hs * 1.16, 0, hs * 0.5, -0.01, mats.armor);
    zBox(h, hs * 1.16, hs * 0.64, hs * 0.06, 0, hs * 0.04, hs * 0.6, mats.visor);      // the visor
    zBox(h, hs * 1.18, hs * 0.5, hs * 0.3, 0, hs * 0.02, -hs * 0.48, mats.armor);      // the nape guard
  } else {
    zBox(h, hs * 1.18, hs * 0.4, hs * 1.18, 0, hs * 0.56, 0, mats.army);
    zBox(h, hs * 1.3, hs * 0.08, hs * 1.3, 0, hs * 0.36, 0, mats.army);
    zBox(h, hs * 0.08, hs * 0.5, hs * 0.04, -hs * 0.5, hs * 0.1, hs * 0.2, mats.dark); // the strap
  }
  h.traverse((o) => { if (o.isMesh) o.userData.helmet = true; });
  return h;
}
function addChestExtras(torso, look, tw, td, th, mats) {
  const E = look.extras, f = td / 2 + 0.012;
  if (E.has("badge")) zBox(torso, 0.09, 0.05, 0.02, -tw * 0.25, th * 0.28, f, look.outfit.startsWith("student") ? mats.badgeBlue : mats.white);
  if (E.has("lanyard")) { zBox(torso, 0.02, 0.26, 0.015, 0, th * 0.25, f, mats.accent); zBox(torso, 0.08, 0.1, 0.02, 0, th * 0.06, f, mats.white); }
  if (E.has("stethoscope")) {
    zBox(torso, 0.025, 0.24, 0.02, -0.07, th * 0.24, f, mats.dark); zBox(torso, 0.025, 0.24, 0.02, 0.07, th * 0.24, f, mats.dark);
    zBox(torso, 0.06, 0.06, 0.03, 0.02, th * 0.06, f, mats.steel);
  }
  if (E.has("belt")) zBox(torso, tw + 0.02, 0.07, td + 0.02, 0, -th / 2 + 0.05, 0, mats.belt);
  if (E.has("camo")) {
    for (let i = 0; i < 7; i++) {
      zBox(torso, 0.08 + G.rng() * 0.1, 0.06 + G.rng() * 0.08, td + 0.01, (G.rng() - 0.5) * tw * 0.8, (G.rng() - 0.5) * th * 0.8, 0, mats.camo[i % mats.camo.length]);
    }
  }
  // (overhaul, round 4) an office worker's tie, a farmer's dungarees, a
  // builder's hi-vis vest, a child's backpack, the Abomination's rags
  if (E.has("tie")) { zBox(torso, 0.06, th * 0.5, 0.02, 0.01, th * 0.16, f, mats.tie); zBox(torso, 0.08, 0.05, 0.025, 0.01, th * 0.42, f, mats.tie); }
  if (E.has("overalls")) {
    zBox(torso, tw * 0.62, th * 0.42, 0.02, 0, -th * 0.18, f, mats.denim);                  // the bib
    [-1, 1].forEach((s) => zBox(torso, 0.05, th * 0.56, td + 0.03, s * tw * 0.24, th * 0.2, 0, mats.denim));   // the straps
    [-1, 1].forEach((s) => zBox(torso, 0.04, 0.04, 0.02, s * tw * 0.24, th * 0.02, f + 0.006, mats.steel));
  }
  if (E.has("hivis")) {
    zBox(torso, tw + 0.03, th * 0.86, td + 0.03, 0, -0.01, 0, mats.hivis);
    [0.1, -0.16].forEach((y) => zBox(torso, tw + 0.04, 0.035, td + 0.04, 0, th * y, 0, mats.reflect));
  }
  if (E.has("backpack")) zBox(torso, tw * 0.8, th * 0.62, 0.14, 0, th * 0.04, -td / 2 - 0.07, mats.pack);
  if (E.has("shreds")) {
    for (let i = 0; i < 5; i++) zBox(torso, 0.07 + G.rng() * 0.1, 0.12 + G.rng() * 0.2, td + 0.02, (G.rng() - 0.5) * tw * 0.9, (G.rng() - 0.5) * th * 0.6, 0, mats.rag);
  }
}

G.buildZombieMesh = function (type, variation, look) {
  const def = G.ZOMBIE_TYPES[type] || G.ZOMBIE_TYPES.normal;
  const v = variation || G.randomZombieVariation();
  look = look || G.randomZombieLook(type, "school");
  const B = ZOMBIE_BUILD[type] || ZOMBIE_BUILD.normal;
  const K = (G.ZombieFactory && G.ZombieFactory.KIND[type]) || {};
  // (overhaul, round 4) Blood & Gore, as the setting has it for this kind;
  // every part tagged with its tile of the pixel atlas (js/zombiefactory.js)
  const gore = G.ZombieFactory ? G.ZombieFactory.gore({ type }) : "full";
  v.gore = gore;
  const GC = (hex) => (G.ZombieFactory ? G.ZombieFactory.goreColor(hex, gore) : hex);
  const tag = (mat, tile) => (G.ZombieSkin ? G.ZombieSkin.tag(mat, tile) : mat);
  const g = new THREE.Group();
  const M = (c, tile) => tag(G.makeBoxMat(c instanceof THREE.Color ? c.getHex() : c), tile || "plain");
  const skinMat = M(look.skin, K.rot ? "rot" : "skin");
  const topMat = M(look.top, look.fabric === "knit" ? "knit" : "shirt");
  const coatMat = look.coat ? M(look.coat, "coat") : null;
  const bottomMat = M(look.bottom, "denim");
  const lowerMat = M(look.bottom.clone().multiplyScalar(0.85), "denim");
  const shoeMat = M(look.shoe, "shoe"), sockMat = M(look.sock, "shirt");
  const tornMat = M((look.coat || look.top).clone().multiplyScalar(0.62), look.coat ? "coat" : "shirt");
  const pick = (a) => a[Math.floor(G.rng() * a.length)];
  const mats = {
    hair: M(look.hair, "hair"), dark: M(0x151515), white: M(0xefefe8, "shirt"), lens: new THREE.MeshBasicMaterial({ color: 0x3f7a55 }),
    hat: M(look.outfit === "soldier" ? look.top.clone().multiplyScalar(0.8) : look.top.clone().offsetHSL(0, 0, -0.12), "shirt"),
    badgeBlue: M(0x2d4f9a), accent: M(0xb03a3a), steel: M(0x9aa0a6, "metal"), belt: M(0x2a2018, "shoe"),
    camo: [M(0x2f3a22, "shirt"), M(0x6b6a45, "shirt"), M(0x3d2f22, "shirt")],
    // I2: raw scars, old pale ones, the stitches across them; gore at a stump
    scar: M(GC(0x5e1616), "skin"), oldScar: M(look.skin.clone().lerp(new THREE.Color(0xc89090), 0.5).multiplyScalar(0.8), "skin"), stitch: M(0x161616),
    gore: new THREE.MeshBasicMaterial({ color: GC(0x5a0a0a) }), boil: M(look.skin.clone().lerp(new THREE.Color(0x8a9a4a), 0.45).multiplyScalar(0.85), "rot"),
    // (round 4) the new clothes and the kinds' own parts
    straw: M(0xc8a85a, "denim"), beanie: M(pick([0x3a3a4a, 0x6b2a2a, 0x2a4a3a]), "knit"), tie: M(pick([0x7a1f2a, 0x1f3a6b, 0x2a2a2a]), "shirt"),
    denim: M(0x2d4a6b, "denim"), hivis: M(0xd8e02a, "knit"), reflect: M(0xe8e8e0, "metal"), pack: M(pick([0x2a4a8a, 0xa83a3a, 0x3a3a3a]), "coat"),
    rag: M(0x2a241e, "coat"), hardhat: M(pick([0xe8c020, 0xe8e8e0, 0xd86a1a]), "metal"), armor: M(0x23262c, "metal"),
    visor: new THREE.MeshBasicMaterial({ color: 0x0c1418 }), army: M(0x4a5236, "metal"), bone: M(0xd8d0b8, "bone"),
    vest: M(look.outfit === "builder" ? 0x3a3a3a : look.outfit === "riot" ? 0x1a1c22 : 0x4a5236, "metal"),
    belly: M(look.skin.clone().lerp(new THREE.Color(0x9aa86a), 0.22).multiplyScalar(1.04), "skin"),
    vein: M(look.skin.clone().lerp(new THREE.Color(0x3a4a6a), 0.55).multiplyScalar(0.7), "skin"),
  };
  // what each part wears: shirt or coat on the body, sleeves or skin on the arms
  const bodyMat = coatMat || topMat;
  const upperArmMat = look.sleeves === "short" && !coatMat ? topMat : bodyMat;
  const foreArmMat = look.sleeves === "long" || coatMat ? bodyMat : skinMat;
  const legs = look.legs;
  const thighMat = legs === "skirt" || legs === "gown" ? skinMat : bottomMat;
  const shinMat = legs === "shorts" || legs === "skirt" || legs === "gown" ? skinMat : lowerMat;
  const woundCount = (K.scars != null ? K.scars : 2) + v.extraWounds;
  const L = B.limb, hs = B.head;
  // (new series, round 1, B1) the hitboxes, one a part, fitted to it: noted
  // here as each part is built, made once the model is merged (js/aim.js)
  const hbs = [];
  const HB = (parent, w, h, d, x, y, z, part, rx) => hbs.push({ parent, w, h, d, x, y, z, part, rx: rx || 0 });
  let top = 1.9;     // the top of the model (its own units), for the word over it

  if (type === "crawler") {
    // Legless crawler: body dragged low and near-horizontal instead of
    // standing upright, forelimbs reaching forward for the pull stroke.
    // (the torso rides in its own group: it heaves with each pull, and a
    // group can be merged into one mesh and still be moved)
    const torsoG = new THREE.Group();
    torsoG.position.set(0, 0.32, -0.05); g.add(torsoG);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(B.torsoW, B.torsoD, 0.75), bodyMat);
    torso.rotation.x = -0.12; torsoG.add(torso);
    HB(torsoG, B.torsoW, B.torsoD, 0.75, 0, 0, 0, "body", -0.12);
    addWounds(torso, woundCount, GC, B.torsoW, B.torsoD);
    if (look.extras.has("camo")) addChestExtras(torso, look, B.torsoW, 0.75, B.torsoD, mats);
    addTatteredClothing(g, tornMat, v.tatterAmount, 0.3, 0.15);
    const neck = new THREE.Group();
    neck.position.set(0, 0.36, 0.3); g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(hs, hs * 0.94, hs), skinMat);
    head.position.set(0, 0.02, 0.12); head.rotation.x = 0.35; neck.add(head);
    head.userData.frontTile = look.face || "faceA";
    HB(neck, hs, hs * 0.94, hs, 0, 0.02, 0.12, "head", 0.35);
    head.name = "head";
    addZombieFace(head, type, skinMat, v, look.odd, hs);
    addHeadExtras(head, look, hs, mats);
    if (G.rng() < 0.6) addScar(head, hs, hs * 0.94, hs, 0, mats);
    // arms jointed at shoulder and elbow, reaching ahead to pull the body
    const makeArm = (side) => {
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.22, 0.36, 0.3); g.add(shoulder);
      zBox(shoulder, 0.14, 0.28, 0.14, 0, -0.14, 0, upperArmMat);
      const elbow = new THREE.Group(); elbow.position.y = -0.27; shoulder.add(elbow);
      zBox(elbow, 0.13, 0.26, 0.13, 0, -0.13, 0, foreArmMat);
      zBox(elbow, 0.15, 0.08, 0.14, 0, -0.3, 0.01, skinMat);
      HB(shoulder, 0.14, 0.28, 0.14, 0, -0.14, 0, "arm"); HB(elbow, 0.13, 0.26, 0.13, 0, -0.13, 0, "arm");
      HB(elbow, 0.15, 0.08 + 0.14, 0.17, 0, -0.3 - 0.07, 0.02, "hand");
      addFingers(elbow, 0.15, 0.08, 0.14, -0.3, 0.01, side, skinMat, 1, 1.2);   // clawing at the floor
      if (G.rng() < 0.5) addScar(elbow, 0.13, 0.26, 0.13, -0.13, mats);
      return { shoulder, elbow, side };
    };
    // stumps where the legs used to be -- short and dragging
    const stumpGeo = new THREE.BoxGeometry(0.16, 0.16, 0.22);
    const stumpL = new THREE.Mesh(stumpGeo, bottomMat); stumpL.position.set(-0.13, 0.18, -0.4); g.add(stumpL);
    const stumpR = new THREE.Mesh(stumpGeo, bottomMat); stumpR.position.set(0.13, 0.18, -0.4); g.add(stumpR);
    HB(stumpL, 0.16, 0.16, 0.22, 0, 0, 0, "leg"); HB(stumpR, 0.16, 0.16, 0.22, 0, 0, 0, "leg");
    g.userData.limbs = { armL: makeArm(-1), armR: makeArm(1), stumpL, stumpR };
    // (round 4: it drags itself on one arm -- the other one hangs useless)
    g.userData.pullSide = G.rng() < 0.5 ? -1 : 1;
    g.userData.crawler = true;
    g.userData.torso = torsoG;
    g.userData.neck = neck;
    g.userData.torsoBaseY = torsoG.position.y;
    top = 1.1;          // (its word a little higher than its head: read over the others)
  } else {
    // Animation pass A: a body that bends where bodies bend. The upper body
    // pivots at the hips, the head at the neck, arms at shoulder and elbow,
    // legs at hip and knee. The old limbs were single boxes turning about
    // their own middles, which is what made the walk look robotic.
    // (overhaul, round 4: every measure from the kind's build, ZOMBIE_BUILD)
    const hipY = 0.74 * B.leg, th = B.torsoH, tw = B.torsoW, td = B.torsoD;
    const upper = new THREE.Group(); upper.position.y = hipY; g.add(upper);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), bodyMat);
    torso.position.y = th * 0.514; upper.add(torso);
    // (a shirt's front: its buttons and collar)
    if (!coatMat && look.fabric === "shirt") torso.userData.frontTile = "shirtFront";
    HB(upper, tw, th, td, 0, torso.position.y, 0, "body");
    addWounds(torso, woundCount, GC, tw, td);
    if (coatMat) {
      // the open front of the coat shows the shirt underneath
      zBox(torso, tw * 0.34, th * 0.94, 0.02, 0, 0.0, td / 2 + 0.005, topMat);
      // tails hanging below the waist
      zBox(upper, tw + 0.03, 0.42, td + 0.03, 0, -0.18, 0, coatMat);
      HB(upper, tw + 0.03, 0.42, td + 0.03, 0, -0.18, 0, "body");
    }
    if (legs === "gown") { zBox(upper, tw + 0.05, 0.5 * B.leg, td + 0.06, 0, -0.2 * B.leg, 0, topMat); HB(upper, tw + 0.05, 0.5 * B.leg, td + 0.06, 0, -0.2 * B.leg, 0, "body"); }   // the gown to the knee
    if (legs === "skirt") { zBox(upper, tw + 0.08, 0.34, td + 0.1, 0, -0.14, 0, bottomMat); HB(upper, tw + 0.08, 0.34, td + 0.1, 0, -0.14, 0, "body"); }
    // ---- (round 4) the kinds' own bodies ----
    if (type === "bloater") {
      // the belly: swollen out of a shirt that split over it -- rounded, as
      // blocks round things: a deep middle and two shallower bands -- veined, boils
      const by = -th * 0.12, bz = td / 2;
      zBox(torso, tw * 0.72, th * 0.4, 0.2, 0, by, bz + 0.1, mats.belly);
      zBox(torso, tw * 0.56, th * 0.14, 0.13, 0, by + th * 0.26, bz + 0.065, mats.belly);
      zBox(torso, tw * 0.6, th * 0.12, 0.14, 0, by - th * 0.25, bz + 0.07, mats.belly);
      HB(upper, tw * 0.72, th * 0.62, 0.2, 0, torso.position.y + by, bz + 0.1, "body");
      [[-0.18, 0.05, 0.5], [0.1, -0.04, -0.4], [0.02, 0.1, 0.2]].forEach(([x, y, r]) => {          // veins
        const v = zBox(torso, 0.022, th * 0.22, 0.01, tw * x, by + th * y, bz + 0.202, mats.vein); v.rotation.z = r;
      });
      for (let i = 0; i < 5; i++) {
        const s = 0.045 + G.rng() * 0.05;
        zBox(torso, s, s, s * 0.6, (G.rng() - 0.5) * tw * 0.7, by + (G.rng() - 0.5) * th * 0.35, bz + 0.2, mats.boil);
      }
      zBox(torso, 0.06, 0.05, 0.02, tw * 0.05, by - th * 0.02, bz + 0.205, mats.dark);             // the navel
      [-1, 1].forEach((s) => zBox(torso, tw * 0.22, th * 0.5, 0.03, s * tw * 0.42, by + th * 0.06, bz + 0.03, tornMat));   // the shirt split open each side
    }
    if (type === "ironclad") {
      // a vest of plates over the body, pads on the shoulders
      zBox(torso, tw + 0.05, th * 0.78, td + 0.06, 0, -0.01, 0, mats.vest);
      for (let i = 0; i < 3; i++) zBox(torso, tw * 0.7, th * 0.16, 0.02, 0, th * (0.22 - i * 0.2), td / 2 + 0.035, mats.vest);
      [-1, 1].forEach((s) => zBox(upper, 0.2, 0.1, td + 0.1, s * (tw / 2 + 0.06), th * 0.95, 0, mats.vest));
    }
    if (type === "abomination") {
      // bone through the skin: spurs down the back, ribs out of one side
      for (let i = 0; i < 5; i++) zBox(upper, 0.06, 0.16 - i * 0.015, 0.12, (i % 2 ? 0.05 : -0.04), th * (0.95 - i * 0.17), -td / 2 - 0.06, mats.bone);
      for (let i = 0; i < 3; i++) zBox(torso, 0.04, 0.03, td * 0.7, tw / 2 + 0.01, th * (0.1 - i * 0.12), 0, mats.bone);
      zBox(torso, tw * 0.3, th * 0.4, 0.03, -tw * 0.18, -th * 0.08, td / 2 + 0.012, mats.gore);           // the open flank
      for (let i = 0; i < 4; i++) { const s = 0.06 + G.rng() * 0.06; zBox(torso, s, s, s, (G.rng() - 0.5) * tw, (G.rng() - 0.5) * th * 0.7, td / 2 + s * 0.3, mats.boil); }
    }
    addChestExtras(torso, look, tw, td, th, mats);
    addTatteredClothing(upper, tornMat, v.tatterAmount, coatMat ? -0.38 : 0.01, td / 2 - 0.02);
    const neck = new THREE.Group(); neck.position.y = th * 1.03 + B.neck; upper.add(neck);
    // (the Screamer's neck: drawn out of its shoulders)
    if (B.neck > 0) { zBox(neck, 0.12, B.neck + 0.08, 0.12, 0, -B.neck / 2 - 0.02, 0, skinMat); HB(neck, 0.13, B.neck + 0.08, 0.13, 0, -B.neck / 2 - 0.02, 0, "body"); }
    // I2: one that carries its own head -- it hangs by the hair from a hand
    // (placed with the arms, below), and a stump is left on the shoulders
    // (round 4: the Headless)
    const carried = type === "headless" || look.odd === "headInHand";
    const holder = carried ? new THREE.Group() : neck;
    const head = new THREE.Mesh(new THREE.BoxGeometry(hs, hs, hs), skinMat);
    head.position.y = carried ? -hs * 0.5 - 0.03 : hs * 0.54; holder.add(head);
    head.userData.frontTile = look.face || "faceA";
    // (the box a little taller than the head: hair, a cap or a helmet on top)
    const helm = type === "ironclad";
    if (helm) HB(holder, hs * 1.38, hs * 1.42, hs * 1.42, 0, head.position.y + hs * 0.18, 0.02, "head");
    else HB(holder, hs, hs * 1.12, hs, 0, head.position.y + hs * 0.06, 0, "head");
    head.name = "head";
    addZombieFace(head, type, skinMat, v, look.odd, hs);
    if (!helm) addHeadExtras(head, look, hs, mats);
    if (G.rng() < 0.6) addScar(head, hs, hs, hs, 0, mats);
    if (helm) g.userData.helmet = addHelmet(neck, head.position.y, hs, look.helmet || "army", mats);
    if (carried) {
      zBox(holder, 0.1, 0.06, 0.1, 0, -0.01, 0, mats.hair);                  // the hair it is held by
      zBox(neck, 0.15, 0.06, 0.15, 0, 0.03, 0, skinMat);                      // the stump
      zBox(neck, 0.12, 0.012, 0.12, 0, 0.062, 0, mats.gore);
      zBox(torso, 0.1, 0.16, 0.012, 0.03, th * 0.37, td / 2 + 0.006, mats.gore);  // down the front
    }
    // boss gets visible shoulder armor plates and bone spurs down its back,
    // so it reads as something else entirely, whatever it is wearing
    if (type === "boss") {
      [-0.32, 0.32].forEach((x) => {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), mats.steel);
        plate.position.set(x, 0.68, 0); upper.add(plate);
      });
      for (let i = 0; i < 4; i++) zBox(upper, 0.06, 0.12, 0.1, 0, 0.62 - i * 0.14, -td / 2 - 0.05, mats.white);
    }
    // I2: one arm far too long (thin, with claws that reach its knees), or
    // one far too big (swollen, boils, a hand like a shovel)
    // (round 4: the Reacher's both reach its knees, one heavier; the
    // Abomination's one arm is swollen huge)
    const armK = (side) => {
      const base = { len: B.arm, thick: B.armT, hand: 1, claw: 1 };
      if (type === "reacher") return { len: B.arm, thick: B.armT * (side === look.oddSide ? 1.18 : 1), hand: 1.45, claw: 1.6 };
      if (type === "abomination" && side === look.oddSide) return { len: B.arm * 1.08, thick: 1.8, hand: 1.8, claw: 1.25 };
      if (side !== look.oddSide) return base;
      if (look.odd === "longArm") return { len: 1.5, thick: 0.85, hand: 1.1, claw: 1.8 };
      if (look.odd === "bigArm") return { len: 1.12, thick: 1.75, hand: 1.8, claw: 1.1 };
      return base;
    };
    const makeArm = (side, at) => {
      const Kk = armK(side), T = L * Kk.thick, ua = 0.31 * Kk.len, fa = 0.29 * Kk.len;
      const shoulder = new THREE.Group();
      if (at) shoulder.position.copy(at); else shoulder.position.set(side * (tw / 2 + 0.11 * Math.max(1, Kk.thick * 0.85)), th * 0.914, 0);
      upper.add(shoulder);
      zBox(shoulder, 0.18 * T, ua, 0.18 * T, 0, -ua * 0.45, 0, upperArmMat);
      const elbow = new THREE.Group(); elbow.position.y = -ua * 0.935; shoulder.add(elbow);
      zBox(elbow, 0.16 * T, fa, 0.16 * T, 0, -fa * 0.48, 0, foreArmMat);
      const hw = 0.17 * L * Kk.hand, hh = 0.1 * Kk.hand, hd = 0.15 * L * Kk.hand, hy = -fa - 0.04 * Kk.hand;
      // (the box of the hand takes in the fingers and claws hanging below it)
      const claw = 0.1 * Kk.hand * Kk.claw;
      HB(shoulder, 0.18 * T, ua, 0.18 * T, 0, -ua * 0.45, 0, "arm"); HB(elbow, 0.16 * T, fa, 0.16 * T, 0, -fa * 0.48, 0, "arm");
      HB(elbow, hw, hh + claw, hd + 0.02, 0, hy - claw / 2, 0.02, "hand");
      zBox(elbow, hw, hh, hd, 0, hy, 0.01, skinMat);                               // hand
      addFingers(elbow, hw, hh, hd, hy, 0.01, side, skinMat, Kk.hand, Kk.claw);
      if (G.rng() < 0.4) addScar(shoulder, 0.18 * T, ua, 0.18 * T, -ua * 0.45, mats);
      if (G.rng() < 0.55) addScar(elbow, 0.16 * T, fa, 0.16 * T, -fa * 0.48, mats);
      if ((look.odd === "bigArm" || type === "abomination") && side === look.oddSide && !at) {
        [[shoulder, ua, 0.18 * T, -ua * 0.45], [elbow, fa, 0.16 * T, -fa * 0.48]].forEach(([p, len, w, cy]) => {
          for (let i = 0; i < 2; i++) {
            const s = 0.05 + G.rng() * 0.05;
            zBox(p, s, s, s, (G.rng() - 0.5) * w * 0.6, cy + (G.rng() - 0.5) * len * 0.6, (G.rng() < 0.5 ? -1 : 1) * (w / 2 + s * 0.25), mats.boil);
          }
        });
      }
      return { shoulder, elbow, side, grip: new THREE.Vector3(0, hy - hh * 0.5 - 0.02, 0.04) };
    };
    const makeLeg = (side) => {
      const lg = B.leg;
      const hip = new THREE.Group(); hip.position.set(side * tw * 0.3, hipY, 0); g.add(hip);
      zBox(hip, 0.2 * L, 0.37 * lg, 0.2 * L, 0, -0.18 * lg, 0, thighMat);
      const knee = new THREE.Group(); knee.position.y = -0.36 * lg; hip.add(knee);
      zBox(knee, 0.18 * L, 0.34 * lg, 0.18 * L, 0, -0.17 * lg, 0, shinMat);
      HB(hip, 0.2 * L, 0.37 * lg, 0.2 * L, 0, -0.18 * lg, 0, "leg"); HB(knee, 0.18 * L, 0.34 * lg, 0.18 * L, 0, -0.17 * lg, 0, "leg");
      if (shinMat === skinMat) zBox(knee, 0.19 * L, 0.1, 0.19 * L, 0, -0.29 * lg, 0, sockMat);  // socks under bare legs
      if (type === "ironclad") zBox(knee, 0.2 * L, 0.12, 0.08, 0, -0.02, 0.09 * L + 0.02, mats.vest);   // knee pads
      const foot = new THREE.Group(); foot.position.y = -0.34 * lg; knee.add(foot);
      zBox(foot, 0.19 * L, 0.08, 0.28, 0, 0, 0.05, legs === "gown" ? sockMat : shoeMat);
      HB(foot, 0.19 * L, 0.08, 0.28, 0, 0, 0.05, "leg");
      if (G.rng() < 0.3) addScar(hip, 0.2 * L, 0.37 * lg, 0.2 * L, -0.18 * lg, mats);
      if (G.rng() < 0.4) addScar(knee, 0.18 * L, 0.34 * lg, 0.18 * L, -0.17 * lg, mats);
      return { hip, knee, foot, side };
    };
    g.userData.limbs = { armL: makeArm(-1), armR: makeArm(1), legL: makeLeg(-1), legR: makeLeg(1) };
    // (round 4) the Abomination's third arm, out of its back on the far side
    // from the swollen one -- flailing as it comes
    if (type === "abomination") {
      const s = -look.oddSide;
      g.userData.limbs.armX = makeArm(s, new THREE.Vector3(s * tw * 0.32, th * 0.78, -td * 0.42));
      g.userData.limbs.armX.shoulder.rotation.set(-0.4, s * 0.5, s * 0.9);
    }
    g.userData.upper = upper;
    g.userData.neck = neck;
    g.userData.hipY = hipY;
    if (carried) {
      // the head is the head hitbox wherever it is carried (userData.neck:
      // what a head shot hits, and what flies off when it kills)
      const arm = look.oddSide < 0 ? g.userData.limbs.armL : g.userData.limbs.armR;
      holder.position.copy(arm.grip);
      arm.elbow.add(holder);
      g.userData.neck = holder;
      g.userData.heldHead = holder;
      g.userData.holdArm = arm;
    }
    top = hipY + th * 1.03 + B.neck + (carried ? 0 : hs * (helm ? 1.4 : 1.12));
  }
  g.userData.look = look;
  g.userData.kind = type;
  g.userData.top = top;
  // the head hitbox: a shot that lands on anything under the neck is a head hit
  g.userData.neck.userData.isNeck = true;

  // Draw-call budget (category K): a jointed zombie is ~30 boxes. Each rigid
  // piece -- torso with its wounds, head with its face, a forearm with its
  // hand -- is merged into one mesh per material, leaving only the joints as
  // separate objects. That brings it back to about the old mesh count.
  // Round 2: the colours go into the vertices and every zombie shares two
  // materials, so a joint is one mesh whatever its outfit (mergeLocalColored).
  // (round 4: and each face of each box its place on the pixel atlas)
  if (G.Perf && G.Perf.mergeLocalColored) {
    const keepAnimated = new Set(Object.values(g.userData.limbs || {}).filter((l) => l && l.isMesh));
    const groups = [];
    g.traverse((o) => { if (!o.isMesh && !o.isSprite) groups.push(o); });
    groups.forEach((grp) => {
      const keep = grp.children.filter((c) => !c.isMesh || keepAnimated.has(c));
      G.Perf.mergeLocalColored(grp, keep, G.ZOMBIE_MATS);
    });
  }
  // (new series, round 1, B1) now the hitboxes, on the parts that move
  g.userData.hitboxes = G.Aim ? G.Aim.makeHitboxes(hbs) : [];
  g.scale.setScalar(def.scale);
  // Yaw first: pitch (x) and roll (z) are then in the zombie's own frame --
  // leaning in through a window, lying under a desk or falling over go the
  // way it faces, not along the world's axes (round 2)
  g.rotation.order = "YXZ";
  // slight random stagger lean, per instance, so a group of zombies doesn't
  // look identically posed
  g.userData.baseLean = (G.rng() - 0.5) * 0.14;
  g.rotation.z = g.userData.baseLean;
  g.traverse((o) => { if (o.isMesh && !o.userData.hit) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
};

let zombieUid = 0;
// `theme` picks the wardrobe (school / hospital / bunker)
G.Zombie = function (type, position, wordPair, theme) {
  const def = G.ZOMBIE_TYPES[type];
  this.uid = ++zombieUid;
  this.type = type;
  this.hp = def.hp; this.maxHp = def.hp;
  this.speed = def.speed;
  this.damage = def.damage;
  this.scoreValue = def.scoreValue;
  this.alive = true;
  this.attackCooldown = 0;
  this.speedMultiplier = 1;
  this.word = wordPair[0];
  this.meaning = wordPair[1];
  this.pair = wordPair;
  this.isTarget = false;
  // (vocabulary series, round 2) how it is answered -- shot (its label is
  // the English word) or spelt (its label is its clue) -- set by the game
  this.answer = "shoot";
  this.clue = "";
  this.clueKind = "thai";
  this.clueFull = "";
  this.labelText = this.word;

  // (overhaul, round 4: the kind's own look -- js/zombiefactory.js -- never
  // all alike with one alive)
  this.look = G.ZombieFactory ? G.ZombieFactory.look(type, theme, G.Game) : G.randomZombieLook(type, theme);
  this._sig = G.ZombieFactory ? G.ZombieFactory.signature(type, this.look) : "";
  this.mesh = G.buildZombieMesh(type, null, this.look);
  this.mesh.position.copy(position);
  this.mesh.userData.zombie = this;

  this.sprite = G.makeWordSprite(this.word, { color: "#ffffff" });
  // (round 4) its word just over the top of it, whatever its height -- and
  // as big on a Runt as on anyone (the sprite is inside the scaled body)
  const sc = def.scale || 1;
  this._labelK = 1 / sc;
  this.sprite.position.set(0, this.mesh.userData.top + 0.3 / sc, 0);
  this.sprite.scale.set(2.2 * this._labelK, 0.55 * this._labelK, 1);
  this.sprite.userData.baseScale = [2.2 * this._labelK, 0.55 * this._labelK];
  this.mesh.add(this.sprite);
  // (new series, round 1, B) shot through its hitboxes; its word is drawn over
  // every zombie (only a wall hides it) and kept clear of the other words --
  // _labelBase is where it would sit, js/aim.js moves it up or down from there
  this.hitboxes = this.mesh.userData.hitboxes || [];
  this.hitboxes.forEach((h) => { h.userData.zombie = this; });
  this._labelBase = this.sprite.position.clone();
  this._labelOff = 0;
  this.sprite.material.depthTest = false;
  this.sprite.renderOrder = 6;
  this.walkT = G.rng() * 10;
};
// (Round 3: a word crossed out by the Fifty-Fifty ability is drawn grey with
// a cross. The label is only redrawn when it changes -- this is called for
// every zombie each time the target is checked.)
// (vocabulary series, round 3) The word being asked is NOT marked out: its
// label used to be drawn yellow, which gave the answer away -- every right
// shot was a helped one. Only the zombie the spelling bar is on is lit (that
// is where the typing goes, not an answer); Dictation's unlabelled zombies
// show a speaker over that one.
G.Zombie.prototype.setTarget = function (isTarget) {
  this.isTarget = isTarget;
  const out = !!this.ruledOut && !isTarget;
  const spell = this.answer === "spell";
  // (Settings "Highlight the target word" brings the old yellow back -- a
  // helper: those answers move no box, js/game.js helpersActive)
  const hot = (spell && this.spellFocus) || (!spell && isTarget && !!(G.save && G.save.settings.highlightTarget));
  const text = this.labelText || (hot ? "🔊" : "");
  const pos = this.labelPos(), ruby = this.labelRuby();
  const key = (hot ? "t" : out ? "x" : "n") + (spell ? "s" : "") + text + "|" + pos + "|" + ruby;
  if (this._label === key) return;
  this._label = key;
  this.sprite.visible = !!text;
  if (!text) return;
  // (visual series: the crossed-out grey from js/visual-config.js, light
  // enough to read on the label's plate)
  const outC = G.VISUAL ? "#" + new THREE.Color(G.VISUAL.labels.outColor).getHexString() : "#6c7078";
  G.updateWordSprite(this.sprite, out ? "✗ " + text : text, hot ? "#ffe36b" : out ? outC : spell ? "#9ae8ff" : "#ffffff", pos, ruby);
};
// (new series, round 2, G) the part of speech after the word it carries --
// its own word only: not a meaning or a clue, and not in a question of its
// family's forms (Cloze), where the tag would be the answer. (Round 3: in
// the Word Language -- a French noun with its gender, "N. f.")
G.Zombie.prototype.labelPos = function () {
  if (this.answer === "spell" || this.clueKind === "cloze" || !this.pair || !G.POS) return "";
  if (this.labelText !== this.word || this.word !== this.pair[0]) return "";
  return G.POS.short(this.pair);
};
// (round 3, H4) the pinyin over a Chinese label: the word's or the meaning's
G.Zombie.prototype.labelRuby = function () {
  if (!this.pair || !G.Lang || !G.Lang.showPinyin() || !this.labelText) return "";
  if (this.labelText === this.pair[0]) return G.Lang.pinyin(this.pair, 0);
  if (this.labelText === this.pair[1]) return G.Lang.pinyin(this.pair, 1);
  return "";
};
// (vocabulary series, round 2-3) how it is answered, its clue, and what its
// label says: setAnswer(answer, clue, { kind, label, full })
//   clue   the short clue for the spelling bar (the Thai meaning, a synonym)
//   kind   thai | definition | audio | cloze
//   label  over its head ("" for none: Dictation); by default the clue when
//          it is spelt, the word when it is shot
//   full   the long clue for the panel at the top (a definition)
G.Zombie.prototype.setAnswer = function (answer, clue, o) {
  o = o || {};
  this.answer = answer || "shoot";
  this.clue = clue || "";
  this.clueKind = o.kind || "thai";
  this.clueFull = o.full || "";
  this.labelText = o.label != null ? o.label : this.answer === "spell" ? this.clue : this.word;
  // (Thai is read, not recognised at a glance: a larger label)
  const k = THAI_CHAR.test(this.labelText) ? 1.3 : CJK_CHAR.test(this.labelText) ? 1.15 : 1;
  const lk = this._labelK || 1;      // (round 4: the same size on every kind)
  this.sprite.scale.set(2.2 * k * lk, 0.55 * k * lk, 1);
  this.sprite.userData.baseScale = [2.2 * k * lk, 0.55 * k * lk];
  this._label = null;
  this.setTarget(this.isTarget);
};
// the zombie the spelling pad is about (js/spell.js)
G.Zombie.prototype.setSpellFocus = function (on) {
  this.spellFocus = !!on;
  this.setTarget(this.isTarget);
};
G.Zombie.prototype.takeDamage = function (dmg) {
  this.hp -= dmg;
  if (this.hp <= 0 && this.alive) { this.alive = false; return true; }
  return false;
};
// ---------------- Zombie animation: js/zombieanim.js (overhaul, round 4) ----------------
// (G.Zombie.prototype.animate, hangHead and lunge -- each kind's gait, its
// wind-ups and hit reactions, and the animation LOD)

// moveTarget drives WHERE the zombie walks (the player directly, or the next
// waypoint when routing around walls -- see game.js updateZombies). attackTarget
// is always the real player position; the returned distance is measured to
// THAT (not moveTarget), so an in-transit waypoint never triggers a melee hit
// from across a wall, and attack range always reflects true player proximity.
G.Zombie.prototype.update = function (dt, moveTarget, attackTarget, colliders, gameSpeedTimeScale, keepOut) {
  if (!this.alive) return;
  attackTarget = attackTarget || moveTarget;
  // (overhaul, round 4) knocked down, rearing up to shriek, staggering back,
  // winding up a blow: it does not walk on (js/zombieai.js sets _hold)
  if (this._hold > 0) {
    this._hold -= dt;
    this._faceYaw = Math.atan2(attackTarget.x - this.mesh.position.x, attackTarget.z - this.mesh.position.z);
    let d = this._faceYaw - this.mesh.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (!this._holdNoTurn) this.mesh.rotation.y += Math.max(-2 * dt, Math.min(2 * dt, d));
    const mv = Math.hypot(this.mesh.position.x - (this._lastX === undefined ? this.mesh.position.x : this._lastX), this.mesh.position.z - (this._lastZ === undefined ? this.mesh.position.z : this._lastZ));
    this._lastX = this.mesh.position.x; this._lastZ = this.mesh.position.z;
    this.animStep(dt, mv);
    this.attackCooldown -= dt;
    return Math.hypot(attackTarget.x - this.mesh.position.x, attackTarget.z - this.mesh.position.z);
  }
  this.walkT += dt * 6 * this.speed;
  const dir = new THREE.Vector3().subVectors(moveTarget, this.mesh.position);
  dir.y = 0;
  const moveDist = dir.length();
  // it stops short of what it chases (0.9, arm's length); a waypoint can
  // ask to be walked right up to (a doorway's approach node)
  if (moveDist > (moveTarget.stopAt || 0.9)) {
    dir.normalize();
    const moveSpeed = this.speed * this.speedMultiplier * dt;
    // Stuck guard (category P): steering can still wedge a zombie in a pocket
    // between a locker, the wall and some clutter -- the playtest bot found
    // two sitting in one for twenty minutes, and a wave cannot end while they
    // live. If it has not closed on its target for a few seconds, it wanders
    // off in a random direction for a moment and then tries again.
    const tgtMoved = !this._lastTgt || Math.hypot(moveTarget.x - this._lastTgt.x, moveTarget.z - this._lastTgt.z) > 1;
    // (a new target also drops the remembered avoid side: that belonged to
    // the last obstacle, and in a doorway -- where the route flips between
    // the room and the corridor as the zombie crosses the wall line -- it
    // kept turning it back into the end of the wall)
    if (tgtMoved) { this._lastTgt = { x: moveTarget.x, z: moveTarget.z }; this._bestDist = moveDist; this._stuckT = 0; this._avoidT = 0; }
    if (moveDist < this._bestDist - 0.3) { this._bestDist = moveDist; this._stuckT = 0; }
    this._stuckT += dt;
    // ...and a target that keeps changing never counts as stuck above, so
    // also: trying to move but still within 0.6m of where it was 3s ago
    if (!this._posRef) { this._posRef = { x: this.mesh.position.x, z: this.mesh.position.z }; this._posT = 0; }
    if (Math.hypot(this.mesh.position.x - this._posRef.x, this.mesh.position.z - this._posRef.z) > 0.6) {
      this._posRef.x = this.mesh.position.x; this._posRef.z = this.mesh.position.z; this._posT = 0;
    } else if ((this._posT += dt) > 3) { this._posT = 0; this._stuckT = 99; }
    if (this._stuckT > 2.5) {
      this._stuckT = 0; this._bestDist = moveDist;
      this._escapeT = 0.9;
      const a = G.rng() * Math.PI * 2;
      this._escapeDir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    }
    if (this._escapeT > 0) { this._escapeT -= dt; dir.copy(this._escapeDir); }
    // Local obstacle avoidance (furniture/props within a room -- the waypoint
    // graph in game.js already handles routing between rooms through actual
    // doorways). Cheap: try the direct heading, then +/-40deg/80deg deflections,
    // and take the first that doesn't walk straight into a collider's footprint.
    let moveDir = dir;
    if (colliders && colliders.length) {
      const testPoint = new THREE.Vector3();
      const angles = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];
      // Only what is at this zombie's own height is in its way. This used to
      // be a flat footprint test, so on a two-storey map every wall upstairs
      // also blocked the floor beneath it -- the gallery rail and the upper
      // rooms' walls cut the entry hall into pieces for zombies, and the only
      // way they ever reached the upper floor was an accidental gap under the
      // staircase (category P).
      const y0 = this.mesh.position.y + 0.2, y1 = this.mesh.position.y + 1.6;
      // Probe several points along the way, not just one 0.4 ahead: a wall
      // thinner than the probe distance (the 0.3 stair and partition walls)
      // used to fall BETWEEN the zombie and its probe, and it walked through.
      const reach = moveSpeed + 0.4;
      const probes = [0.15, 0.3, reach];
      const inBox = (c, x, z) => c.max.y >= y0 && c.min.y <= y1 && x >= c.min.x && x <= c.max.x && z >= c.min.z && z <= c.max.z;
      // keepOut: an extra no-go box from the caller (the staircase, for a
      // zombie with no business on it -- see updateZombies)
      const hits = (x, z) => (keepOut && inBox(keepOut, x, z)) || colliders.some((c) => inBox(c, x, z));
      // Keep turning the way it last turned for a moment. Choosing the side
      // afresh every frame had a zombie in front of anything wider than
      // itself (the foot of the staircase) step right, then left, then right,
      // forever -- each sidestep made the other side look better.
      this._avoidT = Math.max(0, (this._avoidT || 0) - dt);
      const s = this._avoidT > 0 ? this._avoidSide : 1;
      const order = this._avoidT > 0 ? [0, s * 0.7, s * 1.4, s * 2.1, -s * 0.7, -s * 1.4, -s * 2.1] : angles;
      for (const a of order) {
        const cand = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const blocked = probes.some((d) => {
          testPoint.copy(this.mesh.position).addScaledVector(cand, Math.min(d, reach));
          return hits(testPoint.x, testPoint.z);
        });
        if (!blocked) {
          moveDir = cand;
          if (a !== 0) { this._avoidSide = Math.sign(a); this._avoidT = 1.2; }
          break;
        }
        if (a === order[order.length - 1]) {
          // boxed in on every side: hold still rather than march straight
          // through the wall -- unless it is already inside something (a door
          // swung shut on it), in which case let it walk out
          if (!hits(this.mesh.position.x, this.mesh.position.z)) moveDir = null;
        }
      }
    }
    if (moveDir) {
      this.mesh.position.addScaledVector(moveDir, moveSpeed);
      this._faceYaw = Math.atan2(moveDir.x, moveDir.z);
    }
  } else {
    this._posT = 0;
    // close enough to bite: square up to the player
    this._faceYaw = Math.atan2(attackTarget.x - this.mesh.position.x, attackTarget.z - this.mesh.position.z);
  }
  // Turn toward the heading at a body's pace instead of snapping to it --
  // an instant 90-degree swivel was half of what read as robotic.
  if (this._faceYaw !== undefined) {
    let d = this._faceYaw - this.mesh.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const rate = (G.ZombieAnim ? G.ZombieAnim.turnRate(this) : this.type === "boss" ? 2.5 : 4.5) * dt;
    this.mesh.rotation.y += Math.max(-rate, Math.min(rate, d * Math.min(1, dt * 8)));
  }
  const moved = Math.hypot(this.mesh.position.x - (this._lastX === undefined ? this.mesh.position.x : this._lastX),
    this.mesh.position.z - (this._lastZ === undefined ? this.mesh.position.z : this._lastZ));
  this._lastX = this.mesh.position.x; this._lastZ = this.mesh.position.z;
  this.animStep(dt, moved);
  this.attackCooldown -= dt;
  const dx = attackTarget.x - this.mesh.position.x, dz = attackTarget.z - this.mesh.position.z;
  return Math.hypot(dx, dz);
};

// ---------------- Particles (muzzle flash / blood / crate burst) ----------------
// Category K: the flash borrows the light pool.s reserved slot instead of
// adding and removing a PointLight every shot, which changed the scene.s light
// count -- and three.js recompiles shaders when that count changes.
G.spawnMuzzleFlash = function (scene, position, quality) {
  if (quality === "vlow") return;
  if (G.Perf) G.Perf.flash(position, 0xffdd66, 3, 4, 50);
};

// Category E3: a brass case flicks out to the right of the view and tumbles
// away. Skipped entirely on the lower graphics settings, like the other
// per-shot effects.
G.spawnShellEject = function (scene, camera, quality) {
  if (quality === "vlow" || quality === "low") return;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.055), G.makeBoxMat(0xd9b24a));
  const origin = new THREE.Vector3(0.28, -0.18, -0.5).applyMatrix4(camera.matrixWorld);
  shell.position.copy(origin);
  scene.add(shell);
  const right = new THREE.Vector3(1, 0, 0).transformDirection(camera.matrixWorld);
  const up = new THREE.Vector3(0, 1, 0);
  const vel = right.multiplyScalar(1.4 + G.rng() * 0.8).addScaledVector(up, 1.6 + G.rng() * 0.6);
  const spin = new THREE.Vector3(8 + G.rng() * 8, G.rng() * 8, G.rng() * 8);
  const t0 = performance.now();
  const step = () => {
    const life = (performance.now() - t0) / 1000;
    const d = 1 / 60;
    vel.y -= 9.8 * d;
    shell.position.addScaledVector(vel, d);
    shell.rotation.x += spin.x * d; shell.rotation.y += spin.y * d; shell.rotation.z += spin.z * d;
    if (life < 1.1) requestAnimationFrame(step);
    else { scene.remove(shell); G.disposeObject3D(shell); }
  };
  requestAnimationFrame(step);
};

G.spawnHitParticles = function (scene, position, color, quality) {
  const count = quality === "vhigh" ? 18 : quality === "high" ? 12 : quality === "medium" ? 8 : quality === "low" ? 4 : 0;
  if (count === 0) return;
  // Category K: pooled -- this used to allocate a new geometry and material
  // for every bullet that landed.
  if (G.Perf) { G.Perf.sparks(scene, position, color || 0xff3333, count); return; }
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x; positions[i * 3 + 1] = position.y; positions[i * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3((G.rng() - 0.5) * 3, G.rng() * 3, (G.rng() - 0.5) * 3));
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: color || 0xff3333, size: 0.08 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  let life = 0;
  const anim = () => {
    life += 1 / 60;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      velocities[i].y -= 0.15;
      pos[i * 3] += velocities[i].x * 0.02;
      pos[i * 3 + 1] += velocities[i].y * 0.02;
      pos[i * 3 + 2] += velocities[i].z * 0.02;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - life * 1.5);
    mat.transparent = true;
    if (life < 0.7) requestAnimationFrame(anim);
    else { scene.remove(pts); geo.dispose(); mat.dispose(); }
  };
  requestAnimationFrame(anim);
};

// One-shot spark burst for a frayed-wire decor point: a brief white/yellow
// particle fan plus a quick light flash, using real elapsed time so it plays
// the same regardless of the FPS cap.

// A slow drift of dust, for a door that has not been opened since whatever
// happened here happened (category F). Unlike a hit spray this barely falls --
// it hangs, spreads and fades.
G.spawnDustPuff = function (scene, position, quality, spread) {
  const count = quality === "vhigh" ? 26 : quality === "high" ? 18 : quality === "medium" ? 12 : quality === "low" ? 6 : 0;
  if (count === 0) return;
  spread = spread || 0.9;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x + (G.rng() - 0.5) * spread;
    positions[i * 3 + 1] = position.y + (G.rng() - 0.5) * 1.6;
    positions[i * 3 + 2] = position.z + (G.rng() - 0.5) * spread;
    vel.push(new THREE.Vector3((G.rng() - 0.5) * 0.5, 0.06 + G.rng() * 0.22, (G.rng() - 0.5) * 0.5));
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbfb49a, size: 0.09, transparent: true, opacity: 0.55 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  let life = 0;
  const anim = () => {
    life += 1 / 60;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      vel[i].multiplyScalar(0.985);                 // air drag, not gravity
      pos[i * 3] += vel[i].x * 0.03;
      pos[i * 3 + 1] += vel[i].y * 0.03;
      pos[i * 3 + 2] += vel[i].z * 0.03;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 0.55 * (1 - life / 1.6));
    if (life < 1.6) requestAnimationFrame(anim);
    else { scene.remove(pts); geo.dispose(); mat.dispose(); }
  };
  requestAnimationFrame(anim);
};
G.spawnSparkBurst = function (scene, sparkPoint) {
  const position = new THREE.Vector3(sparkPoint.x, sparkPoint.y, sparkPoint.z);
  const count = 7;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x; positions[i * 3 + 1] = position.y; positions[i * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3((G.rng() - 0.5) * 2.4, -G.rng() * 1.5 - 0.5, (G.rng() - 0.5) * 2.4));
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff2b0, size: 0.06, transparent: true });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  if (G.Perf) G.Perf.flash(position, 0xfff2b0, 3.5, 5, 220);
  const light = { intensity: 0 };   // kept so the fade below still has a target
  const t0 = performance.now();
  const durationMs = 220;
  const step = () => {
    const life = (performance.now() - t0) / 1000;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      velocities[i].y -= 0.2;
      pos[i * 3] += velocities[i].x * 0.02;
      pos[i * 3 + 1] += velocities[i].y * 0.02;
      pos[i * 3 + 2] += velocities[i].z * 0.02;
    }
    geo.attributes.position.needsUpdate = true;
    const p = (performance.now() - t0) / durationMs;
    mat.opacity = Math.max(0, 1 - p);
    light.intensity = Math.max(0, 3.5 * (1 - p));
    if (p < 1) requestAnimationFrame(step);
    else { scene.remove(pts); geo.dispose(); mat.dispose(); }
  };
  requestAnimationFrame(step);
};

G.spawnCrateBurst = function (scene, position, rarityKey, quality) {
  const color = G.RARITY[rarityKey].color;
  const count = rarityKey === "secret" ? 60 : rarityKey === "epic" ? 40 : 24;
  G.spawnHitParticles(scene, position, color, quality === "vlow" ? "low" : quality);
  if ((rarityKey === "secret" || rarityKey === "epic") && G.Perf) G.Perf.flash(position, color, 4, 8, 900);
};
