// ============================================================
// ENTITIES: weapons, loot/rarity, player, zombies, particles
// Art style: voxel/blocky — everything built from BoxGeometry.
// ============================================================
window.G = window.G || {};

// ---------------- Rarity ----------------
G.RARITY = {
  common:   { key: "common",   label: "COMMON",   color: 0x8fb3c9, chance: 0.50, badge: "square" },
  uncommon: { key: "uncommon", label: "UNCOMMON", color: 0x3ee066, chance: 0.30, badge: "diamond" },
  rare:     { key: "rare",     label: "RARE",     color: 0x3b82f5, chance: 0.13, badge: "cross" },
  epic:     { key: "epic",     label: "EPIC",     color: 0xd23bef, chance: 0.06, badge: "triangle" },
  secret:   { key: "secret",   label: "SECRET",   color: 0xffd43b, chance: 0.01, badge: "star" },
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

// ---------------- Weapon definitions ----------------
// `color` = main body tone, `accent` = secondary panel/trim tone. Both stay
// within the weapon's rarity family (see G.RARITY) but differ per weapon so
// two guns of the same rarity still read as distinct pieces of hardware.
G.WEAPON_DEFS = {
  pistol: { id: "pistol", name: "Pistol", rarity: "common", damage: 14, fireRate: 320, magSize: 12,
    reloadTime: 1000, auto: false, price: 0, color: 0x9fb9c9, accent: 0x2b3a42 },
  shotgun: { id: "shotgun", name: "Shotgun", rarity: "common", damage: 9, pellets: 6, fireRate: 750, magSize: 6,
    reloadTime: 1600, auto: false, price: 400, color: 0x7d97ab, accent: 0x35424c },
  smg: { id: "smg", name: "SMG", rarity: "uncommon", damage: 10, fireRate: 110, magSize: 30,
    reloadTime: 1300, auto: true, price: 900, color: 0x2fae54, accent: 0x1f3d2a },
  rifle: { id: "rifle", name: "Assault Rifle", rarity: "uncommon", damage: 18, fireRate: 160, magSize: 25,
    reloadTime: 1500, auto: true, price: 1200, color: 0x39c463, accent: 0x224a2e },
  lmg: { id: "lmg", name: "LMG", rarity: "rare", damage: 15, fireRate: 90, magSize: 60,
    reloadTime: 2200, auto: true, price: 2200, color: 0x2f6fd6, accent: 0x18325e },
  sniper: { id: "sniper", name: "Sniper", rarity: "rare", damage: 90, fireRate: 950, magSize: 5,
    reloadTime: 1800, auto: false, price: 2400, color: 0x3b82f5, accent: 0x15234a },
  railgun: { id: "railgun", name: "Piercing Railgun", rarity: "epic", damage: 45, fireRate: 500, magSize: 8,
    reloadTime: 1700, auto: false, pierce: true, price: 4200, color: 0xc23bef, accent: 0x3d1a4a },
  grenadelauncher: { id: "grenadelauncher", name: "Grenade Launcher", rarity: "epic", damage: 70, fireRate: 900, magSize: 4,
    reloadTime: 2000, auto: false, splash: true, splashRadius: 4.5, price: 4600, color: 0xa63bd6, accent: 0x3a1a44 },
  golden_smg: { id: "golden_smg", name: "Golden Vocabulary SMG", rarity: "secret", damage: 55, fireRate: 70, magSize: 50,
    reloadTime: 1000, auto: true, price: 9999, color: 0xffd43b, accent: 0xa87d1a, legendary: true },
};

G.MELEE_DEF = { id: "melee", name: "Combat Knife", damage: 35, fireRate: 450, range: 2.6 };

// ---------------- Voxel builders (BoxGeometry only) ----------------
G.makeBoxMat = (color) => new THREE.MeshLambertMaterial({ color });

// Each weapon gets its own hand-built silhouette (not one shared template
// re-colored) so guns of the same rarity still read as different hardware:
// shotguns are short and fat, snipers long and thin, etc. Still pure
// BoxGeometry throughout to keep the voxel style and stay cheap to render.
G.WEAPON_BUILDERS = {
  pistol(g, mat, accentMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.3), mat);
    body.position.set(0, 0, -0.16); g.add(body);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.32), G.makeBoxMat(0xd8e4ea));
    slide.position.set(0, 0.09, -0.17); g.add(slide);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.09), accentMat);
    grip.position.set(0, -0.15, 0.02); grip.rotation.x = -0.15; g.add(grip);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.1), accentMat);
    barrel.position.set(0, 0.02, -0.36); g.add(barrel);
  },
  shotgun(g, mat, accentMat) {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.62), mat);
    barrel.position.set(0, 0.03, -0.28); g.add(barrel);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.16), accentMat);
    pump.position.set(0, -0.02, -0.34); g.add(pump);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.2), accentMat);
    receiver.position.set(0, -0.01, 0.02); g.add(receiver);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.22), accentMat);
    stock.position.set(0, -0.02, 0.22); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.16, 0.06); grip.rotation.x = -0.2; g.add(grip);
  },
  smg(g, mat, accentMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.32), mat);
    body.position.set(0, 0.02, -0.1); g.add(body);
    const barrelShroud = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.16), accentMat);
    barrelShroud.position.set(0, 0.03, -0.34); g.add(barrelShroud);
    // stepped "curved" magazine: two stacked boxes offset forward to fake a curve
    const magTop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.09), accentMat);
    magTop.position.set(0, -0.1, -0.06); g.add(magTop);
    const magBottom = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.14, 0.08), accentMat);
    magBottom.position.set(0, -0.24, -0.02); g.add(magBottom);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.22), accentMat);
    stock.position.set(0, 0.01, 0.24); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.08); grip.rotation.x = -0.2; g.add(grip);
  },
  rifle(g, mat, accentMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.46), mat);
    body.position.set(0, 0.02, -0.14); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.34), accentMat);
    barrel.position.set(0, 0.02, -0.52); g.add(barrel);
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.22), accentMat);
    foregrip.position.set(0, -0.06, -0.4); g.add(foregrip);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), accentMat);
    mag.position.set(0, -0.17, -0.08); mag.rotation.x = 0.15; g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.22), accentMat);
    stock.position.set(0, -0.01, 0.28); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.1); grip.rotation.x = -0.2; g.add(grip);
  },
  lmg(g, mat, accentMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.5), mat);
    body.position.set(0, 0.02, -0.12); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.36), accentMat);
    barrel.position.set(0, 0.04, -0.52); g.add(barrel);
    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), accentMat);
    ammoBox.position.set(0, -0.16, -0.12); g.add(ammoBox);
    [-0.06, 0.06].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), accentMat);
      leg.position.set(x, -0.06, -0.6); leg.rotation.x = 0.5; leg.rotation.z = x < 0 ? -0.3 : 0.3;
      g.add(leg);
    });
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.22), accentMat);
    stock.position.set(0, 0, 0.32); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.16, 0.12); grip.rotation.x = -0.2; g.add(grip);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.015), new THREE.MeshBasicMaterial({ color: 0x9fd0ff }));
    trim.position.set(0, 0.11, -0.12); g.add(trim);
  },
  sniper(g, mat, accentMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.4), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.62), accentMat);
    barrel.position.set(0, 0, -0.6); g.add(barrel);
    const scopeBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), accentMat);
    scopeBody.position.set(0, 0.11, -0.2); g.add(scopeBody);
    const scopeLensF = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), G.makeBoxMat(0x0a1622));
    scopeLensF.position.set(0, 0.11, -0.31); g.add(scopeLensF);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.5), new THREE.MeshBasicMaterial({ color: 0x9fd0ff }));
    trim.position.set(0.045, 0.02, -0.3); g.add(trim);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.3), accentMat);
    stock.position.set(0, -0.01, 0.32); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), accentMat);
    grip.position.set(0, -0.14, 0.14); grip.rotation.x = -0.2; g.add(grip);
  },
  railgun(g, mat, accentMat) {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.6), mat);
    barrel.position.set(0, 0.02, -0.24); g.add(barrel);
    // square "coil" loop around the barrel, partway along its length
    const loopZ = -0.34, loopSize = 0.16;
    const coilMat = accentMat;
    [[-loopSize / 2, 0], [loopSize / 2, 0], [0, -loopSize / 2], [0, loopSize / 2]].forEach(([x, y]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(x ? 0.02 : loopSize, y ? 0.02 : loopSize, 0.04), coilMat);
      bar.position.set(x, 0.02 + y, loopZ); g.add(bar);
    });
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xff8bff }));
    core.position.set(0, 0.02, loopZ); g.add(core);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.24), accentMat);
    body.position.set(0, 0, 0.02); g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.1); grip.rotation.x = -0.2; g.add(grip);
  },
  grenadelauncher(g, mat, accentMat) {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.36), mat);
    barrel.position.set(0, 0.02, -0.24); g.add(barrel);
    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.14), accentMat);
    chamber.position.set(0, 0.02, -0.02); g.add(chamber);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.05), accentMat);
    sight.position.set(0, 0.15, -0.2); g.add(sight);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.2), accentMat);
    stock.position.set(0, 0, 0.2); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.19, 0.09), accentMat);
    grip.position.set(0, -0.17, 0.08); grip.rotation.x = -0.2; g.add(grip);
  },
  golden_smg(g, mat, accentMat) {
    // A tiered, crown-like silhouette unlike any other weapon in the game.
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.34), mat);
    base.position.set(0, 0, -0.12); g.add(base);
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), mat);
    tier2.position.set(0, 0.085, -0.16); g.add(tier2);
    const tier3 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.12), mat);
    tier3.position.set(0, 0.14, -0.2); g.add(tier3);
    [-0.03, 0, 0.03].forEach((x, i) => {
      const spike = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07 + i % 2 * 0.02, 0.018), mat);
      spike.position.set(x, 0.16, -0.2); g.add(spike);
    });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), accentMat);
    barrel.position.set(0, 0.01, -0.4); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.09), accentMat);
    mag.position.set(0, -0.18, -0.02); mag.rotation.x = 0.12; g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.14, 0.1); grip.rotation.x = -0.2; g.add(grip);
    // Rainbow sparkle halo: small chips ringed around the barrel's own axis so
    // the idle spin (see game.js) reads as particles orbiting the weapon,
    // instead of sitting flush against a face where they'd be half-hidden.
    const trim = new THREE.Group();
    trim.position.set(0, 0.01, -0.4);
    const radius = 0.06;
    for (let i = 0; i < G.RAINBOW_COLORS.length; i++) {
      const angle = (i / G.RAINBOW_COLORS.length) * Math.PI * 2;
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), new THREE.MeshBasicMaterial({ color: G.RAINBOW_COLORS[i] }));
      chip.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      trim.add(chip);
    }
    g.add(trim);
    g.userData.rainbowTrim = trim;
  },
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

G.buildWeaponMesh = function (def) {
  const g = new THREE.Group();
  const mat = G.makeBoxMat(def.color);
  const accentMat = G.makeBoxMat(def.accent != null ? def.accent : new THREE.Color(def.color).multiplyScalar(0.5).getHex());
  const builder = G.WEAPON_BUILDERS[def.id] || G.WEAPON_BUILDERS.pistol;
  builder(g, mat, accentMat);

  if (def.rarity === "epic" || def.rarity === "secret") {
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: def.color }));
    glow.position.set(0, 0.1, -0.2);
    g.add(glow);
  }
  if (def.rarity === "secret") {
    const spark = new THREE.PointLight(0xffd43b, 1.2, 1.8);
    spark.position.set(0, 0.08, -0.3);
    g.add(spark);
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
  return g;
};

// ---------------- Word billboard sprite ----------------
G.makeWordSprite = function (text, opts) {
  opts = opts || {};
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = "bold 64px Segoe UI, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, 256, 64);
  ctx.fillStyle = opts.color || "#ffffff";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.55, 1);
  sprite.userData.canvas = canvas;
  sprite.userData.ctx = ctx;
  sprite.userData.tex = tex;
  return sprite;
};
G.updateWordSprite = function (sprite, text, color) {
  const ctx = sprite.userData.ctx, canvas = sprite.userData.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 64px Segoe UI, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, 256, 64);
  ctx.fillStyle = color || "#ffffff";
  ctx.fillText(text, 256, 64);
  sprite.userData.tex.needsUpdate = true;
};

// ---------------- Zombie ----------------
G.ZOMBIE_TYPES = {
  normal: { hp: 34, speed: 1.7, scale: 1.0, color: 0x4c6b3a, damage: 8, scoreValue: 10 },
  fast:   { hp: 22, speed: 3.1, scale: 0.85, color: 0x8a6a2a, damage: 6, scoreValue: 16 },
  boss:   { hp: 900, speed: 1.0, scale: 3.0, color: 0x6b1e6b, damage: 22, scoreValue: 500 },
};

G.buildZombieMesh = function (type) {
  const def = G.ZOMBIE_TYPES[type];
  const g = new THREE.Group();
  const mat = G.makeBoxMat(def.color);
  const skinMat = G.makeBoxMat(new THREE.Color(def.color).offsetHSL(0, -0.1, 0.08).getHex());
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
  torso.position.y = 1.1; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
  head.position.y = 1.65; g.add(head);
  head.name = "head";
  const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
  const armL = new THREE.Mesh(armGeo, skinMat); armL.position.set(-0.38, 1.05, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, skinMat); armR.position.set(0.38, 1.05, 0); g.add(armR);
  const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
  const legL = new THREE.Mesh(legGeo, mat); legL.position.set(-0.15, 0.4, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, mat); legR.position.set(0.15, 0.4, 0); g.add(legR);
  g.userData.limbs = { armL, armR, legL, legR };
  g.scale.setScalar(def.scale);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
};

let zombieUid = 0;
G.Zombie = function (type, position, wordPair) {
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
  this.isTarget = false;

  this.mesh = G.buildZombieMesh(type);
  this.mesh.position.copy(position);
  this.mesh.userData.zombie = this;

  this.sprite = G.makeWordSprite(this.word, { color: "#ffffff" });
  this.sprite.position.set(0, 2.0 * def.scale + 0.3, 0);
  this.mesh.add(this.sprite);
  this.walkT = G.rng() * 10;
};
G.Zombie.prototype.setTarget = function (isTarget) {
  this.isTarget = isTarget;
  G.updateWordSprite(this.sprite, this.word, isTarget ? "#ffe36b" : "#ffffff");
};
G.Zombie.prototype.takeDamage = function (dmg) {
  this.hp -= dmg;
  if (this.hp <= 0 && this.alive) { this.alive = false; return true; }
  return false;
};
G.Zombie.prototype.update = function (dt, playerPos, gameSpeedTimeScale) {
  if (!this.alive) return;
  this.walkT += dt * 6 * this.speed;
  const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
  dir.y = 0;
  const dist = dir.length();
  if (dist > 0.9) {
    dir.normalize();
    const moveSpeed = this.speed * this.speedMultiplier * dt;
    this.mesh.position.addScaledVector(dir, moveSpeed);
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }
  const swing = Math.sin(this.walkT) * 0.4;
  const limbs = this.mesh.userData.limbs;
  if (limbs) {
    limbs.armL.rotation.x = swing; limbs.armR.rotation.x = -swing;
    limbs.legL.rotation.x = -swing; limbs.legR.rotation.x = swing;
  }
  this.attackCooldown -= dt;
  return dist;
};

// ---------------- Particles (muzzle flash / blood / crate burst) ----------------
G.spawnMuzzleFlash = function (scene, position, quality) {
  if (quality === "vlow") return;
  const light = new THREE.PointLight(0xffdd66, 3, 4);
  light.position.copy(position);
  scene.add(light);
  setTimeout(() => scene.remove(light), 50);
};

G.spawnHitParticles = function (scene, position, color, quality) {
  const count = quality === "vhigh" ? 18 : quality === "high" ? 12 : quality === "medium" ? 8 : quality === "low" ? 4 : 0;
  if (count === 0) return;
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

G.spawnCrateBurst = function (scene, position, rarityKey, quality) {
  const color = G.RARITY[rarityKey].color;
  const count = rarityKey === "secret" ? 60 : rarityKey === "epic" ? 40 : 24;
  G.spawnHitParticles(scene, position, color, quality === "vlow" ? "low" : quality);
  if (rarityKey === "secret" || rarityKey === "epic") {
    const light = new THREE.PointLight(color, 4, 8);
    light.position.copy(position);
    scene.add(light);
    setTimeout(() => scene.remove(light), 900);
  }
};
