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
  // `recoil` (category E3) scales the per-shot kick: how far the model punches
  // back, how hard it tilts up, and how much the view itself is thrown.
  pistol: { id: "pistol", name: "Pistol", rarity: "common", damage: 14, fireRate: 320, magSize: 12,
    reloadTime: 1000, auto: false, recoil: 0.7, price: 0, color: 0x9fb9c9, accent: 0x2b3a42 },
  shotgun: { id: "shotgun", name: "Shotgun", rarity: "common", damage: 9, pellets: 6, fireRate: 750, magSize: 6,
    reloadTime: 1600, auto: false, recoil: 1.7, price: 400, color: 0x7d97ab, accent: 0x35424c },
  smg: { id: "smg", name: "SMG", rarity: "uncommon", damage: 10, fireRate: 110, magSize: 30,
    reloadTime: 1300, auto: true, recoil: 0.5, price: 900, color: 0x2fae54, accent: 0x1f3d2a },
  rifle: { id: "rifle", name: "Assault Rifle", rarity: "uncommon", damage: 18, fireRate: 160, magSize: 25,
    reloadTime: 1500, auto: true, recoil: 0.75, price: 1200, color: 0x39c463, accent: 0x224a2e },
  lmg: { id: "lmg", name: "LMG", rarity: "rare", damage: 15, fireRate: 90, magSize: 60,
    reloadTime: 2200, auto: true, recoil: 0.6, price: 2200, color: 0x2f6fd6, accent: 0x18325e },
  sniper: { id: "sniper", name: "Sniper", rarity: "rare", damage: 90, fireRate: 950, magSize: 5,
    reloadTime: 1800, auto: false, recoil: 2.2, price: 2400, color: 0x3b82f5, accent: 0x15234a },
  railgun: { id: "railgun", name: "Piercing Railgun", rarity: "epic", damage: 45, fireRate: 500, magSize: 8,
    reloadTime: 1700, auto: false, pierce: true, recoil: 1.5, price: 4200, color: 0xc23bef, accent: 0x3d1a4a },
  grenadelauncher: { id: "grenadelauncher", name: "Grenade Launcher", rarity: "epic", damage: 70, fireRate: 900, magSize: 4,
    reloadTime: 2000, auto: false, splash: true, splashRadius: 4.5, recoil: 2.4, price: 4600, color: 0xa63bd6, accent: 0x3a1a44 },
  golden_smg: { id: "golden_smg", name: "Golden Vocabulary SMG", rarity: "secret", damage: 55, fireRate: 70, magSize: 50,
    reloadTime: 1000, auto: true, recoil: 0.65, price: 9999, color: 0xffd43b, accent: 0xa87d1a, legendary: true },

  // Wall-mounted exclusives (category C3): one per level, bought with saved-up
  // money via the level's wall-mount display, never obtainable from the shop's
  // crate roll (`wallExclusive: true` keeps them out of openCrate's pool).
  // Each sits clearly above every epic-tier option's sustained DPS (railgun
  // ~90, grenade launcher ~78) while staying under the 1%-chance golden_smg
  // jackpot (~785), since these are guaranteed-buyable rather than RNG.
  // Pricing reasoning: a boss kill alone pays 500, and a full run's normal
  // kills + wave bonuses realistically net a disciplined player (one who
  // skips a few shop upgrades) something in the low thousands by the run's
  // end -- so price scales with how long/hard the level is (5/6/7 waves),
  // keeping each a real "save up for it" goal without being unreachable in
  // one normal playthrough.
  school_wall: { id: "school_wall", name: "Faculty Enforcer", rarity: "secret", damage: 20, fireRate: 90, magSize: 45,
    reloadTime: 1500, auto: true, recoil: 0.7, price: 1800, color: 0xd4a017, accent: 0x5a3d0a, wallExclusive: true },
  hospital_wall: { id: "hospital_wall", name: "Trauma Cannon", rarity: "secret", damage: 22, pellets: 8, fireRate: 500, magSize: 10,
    reloadTime: 1800, auto: false, recoil: 1.9, price: 2400, color: 0xe8e8e0, accent: 0xd6423c, wallExclusive: true },
  bunker_wall: { id: "bunker_wall", name: "Vault Breaker", rarity: "secret", damage: 140, fireRate: 750, magSize: 6,
    reloadTime: 2000, auto: false, recoil: 2.5, price: 3200, color: 0x4a5c3a, accent: 0x2a2a26, wallExclusive: true },

  // Eight more wall mounts for the rebuilt school -- four on each floor, each
  // in its own room. Ground-floor guns are affordable mid-run pickups; the
  // upstairs four sit behind the 2nd-floor unlock so they're priced as
  // end-of-run goals (a boss alone pays 500, a full run nets low thousands).
  hall_monitor: { id: "hall_monitor", name: "Hallway Monitor", rarity: "rare", damage: 24, fireRate: 110, magSize: 35,
    reloadTime: 1400, auto: true, recoil: 0.6, price: 1200, color: 0x4fa3d9, accent: 0x1d3f57, wallExclusive: true },
  detention_slug: { id: "detention_slug", name: "Detention Slugger", rarity: "rare", damage: 18, pellets: 6, fireRate: 780, magSize: 8,
    reloadTime: 1900, auto: false, recoil: 1.8, price: 1600, color: 0xc96a2f, accent: 0x4a2611, wallExclusive: true },
  pop_quiz: { id: "pop_quiz", name: "Pop Quiz", rarity: "epic", damage: 34, fireRate: 200, magSize: 24,
    reloadTime: 1600, auto: true, recoil: 0.9, price: 2000, color: 0x8ad94f, accent: 0x2f4a1a, wallExclusive: true },
  cafeteria_cleaver: { id: "cafeteria_cleaver", name: "Cafeteria Cleaver", rarity: "epic", damage: 72, fireRate: 520, magSize: 8,
    reloadTime: 1700, auto: false, recoil: 1.6, price: 2300, color: 0xd94f7a, accent: 0x4d162c, wallExclusive: true },
  honor_roll: { id: "honor_roll", name: "Honor Roll", rarity: "epic", damage: 110, fireRate: 620, magSize: 10,
    reloadTime: 1800, auto: false, recoil: 1.7, price: 2800, color: 0xd9c04f, accent: 0x4d4211, wallExclusive: true },
  science_fair: { id: "science_fair", name: "Science Fair", rarity: "secret", damage: 45, fireRate: 105, magSize: 40,
    reloadTime: 2000, auto: true, recoil: 0.8, price: 3200, color: 0x4fd9c0, accent: 0x134a40, wallExclusive: true },
  art_attack: { id: "art_attack", name: "Art Attack", rarity: "secret", damage: 120, fireRate: 950, magSize: 5,
    reloadTime: 2300, auto: false, splash: true, splashRadius: 4.5, recoil: 2.3, price: 3600, color: 0xb84fd9, accent: 0x3d134a, wallExclusive: true },
  principals_verdict: { id: "principals_verdict", name: "Principal's Verdict", rarity: "secret", damage: 150, fireRate: 700, magSize: 6,
    reloadTime: 2000, auto: false, pierce: true, recoil: 2.0, price: 4200, color: 0xff6a3d, accent: 0x5c1f08, wallExclusive: true },

  // ---------------- Mystery box pool (category C2) ----------------
  // Fifteen guns that exist only inside the 1,000-a-pull mystery box
  // (`boxOnly` keeps them out of crate rolls and the shop). Each pull deals a
  // hand of 6 cards: exactly one "elite" and five "standard", so the elite
  // tier lands 1-in-6 no matter what. boxWeight then splits the odds INSIDE
  // each tier, always weighted against power -- the weakest standard gun is
  // over five times as likely as the strongest, and the level-ending Meteor
  // Detention is the rarest thing in the game at 1%.
  scrap_spitter: { id: "scrap_spitter", name: "Scrap Spitter", rarity: "common", damage: 11, fireRate: 85, magSize: 32,
    reloadTime: 1600, auto: true, recoil: 0.5, color: 0x8a8f7a, accent: 0x3d4036, boxOnly: true, boxTier: "standard", boxWeight: 16 },
  nail_driver: { id: "nail_driver", name: "Nail Driver", rarity: "common", damage: 16, fireRate: 150, magSize: 24,
    reloadTime: 1400, auto: true, recoil: 0.6, color: 0xd2a63c, accent: 0x54401a, boxOnly: true, boxTier: "standard", boxWeight: 15 },
  hall_sweeper: { id: "hall_sweeper", name: "Hall Sweeper", rarity: "common", damage: 12, pellets: 5, fireRate: 720, magSize: 6,
    reloadTime: 2000, auto: false, recoil: 1.6, color: 0x6f7d86, accent: 0x2f3940, boxOnly: true, boxTier: "standard", boxWeight: 13 },
  chalk_burster: { id: "chalk_burster", name: "Chalk Burster", rarity: "uncommon", damage: 21, fireRate: 260, magSize: 21,
    reloadTime: 1700, auto: true, recoil: 0.8, color: 0x58b5a0, accent: 0x224740, boxOnly: true, boxTier: "standard", boxWeight: 12 },
  detention_deuce: { id: "detention_deuce", name: "Detention Deuce", rarity: "uncommon", damage: 19, fireRate: 200, magSize: 16,
    reloadTime: 1200, auto: false, recoil: 0.7, color: 0x9c6bd6, accent: 0x3b2a52, boxOnly: true, boxTier: "standard", boxWeight: 11 },
  rust_repeater: { id: "rust_repeater", name: "Rust Repeater", rarity: "uncommon", damage: 28, fireRate: 420, magSize: 10,
    reloadTime: 1500, auto: false, recoil: 1.0, color: 0xa2603a, accent: 0x40261a, boxOnly: true, boxTier: "standard", boxWeight: 10 },
  gym_grinder: { id: "gym_grinder", name: "Gym Class Grinder", rarity: "rare", damage: 9, fireRate: 55, magSize: 60,
    reloadTime: 3000, auto: true, recoil: 0.45, color: 0x3f6fb5, accent: 0x1b2c47, boxOnly: true, boxTier: "standard", boxWeight: 9 },
  copper_coil: { id: "copper_coil", name: "Copper Coil", rarity: "rare", damage: 44, fireRate: 900, magSize: 5,
    reloadTime: 1900, auto: false, recoil: 1.5, color: 0xc9723f, accent: 0x3f2a1b, boxOnly: true, boxTier: "standard", boxWeight: 7 },
  locker_lancer: { id: "locker_lancer", name: "Locker Lancer", rarity: "rare", damage: 50, fireRate: 520, magSize: 12,
    reloadTime: 1800, auto: false, recoil: 1.3, color: 0x2f6fb0, accent: 0x14314f, boxOnly: true, boxTier: "standard", boxWeight: 4 },
  bus_bulldog: { id: "bus_bulldog", name: "Bus Stop Bulldog", rarity: "rare", damage: 58, fireRate: 650, magSize: 6,
    reloadTime: 2100, auto: false, recoil: 1.8, color: 0xb0b6bd, accent: 0x3a2f2a, boxOnly: true, boxTier: "standard", boxWeight: 3 },
  thunder_chalk: { id: "thunder_chalk", name: "Thunder Chalk", rarity: "epic", damage: 72, fireRate: 300, magSize: 18,
    reloadTime: 2000, auto: true, recoil: 1.1, color: 0x7fe6ff, accent: 0x1d4c63, boxOnly: true, boxTier: "elite", boxWeight: 32 },
  void_principal: { id: "void_principal", name: "Void Principal", rarity: "epic", damage: 42, fireRate: 95, magSize: 40,
    reloadTime: 2100, auto: true, recoil: 0.9, color: 0x5b3fa8, accent: 0x211640, boxOnly: true, boxTier: "elite", boxWeight: 28 },
  prism_lance: { id: "prism_lance", name: "Prism Lance", rarity: "epic", damage: 95, fireRate: 480, magSize: 8,
    reloadTime: 1800, auto: false, pierce: true, recoil: 1.4, color: 0xef5fd0, accent: 0x4a1a42, boxOnly: true, boxTier: "elite", boxWeight: 20 },
  final_bell: { id: "final_bell", name: "Final Bell", rarity: "secret", damage: 30, pellets: 8, fireRate: 420, magSize: 10,
    reloadTime: 2400, auto: true, recoil: 2.0, color: 0xffd43b, accent: 0x6b4a08, boxOnly: true, boxTier: "elite", boxWeight: 14 },
  meteor_detention: { id: "meteor_detention", name: "Meteor Detention", rarity: "secret", damage: 165, fireRate: 1100, magSize: 4,
    reloadTime: 2600, auto: false, splash: true, splashRadius: 5, recoil: 2.6, color: 0xff6a2b, accent: 0x5c1f08, boxOnly: true, boxTier: "elite", boxWeight: 6 },
};

G.MYSTERY_BOX_COST = 1000;
G.MYSTERY_CARD_COUNT = 6;
// One elite + five distinct standards, elite slot shuffled to a random index.
G.rollMysteryHand = function () {
  const pick = (pool) => {
    const total = pool.reduce((s, w) => s + w.boxWeight, 0);
    let r = G.rng() * total;
    for (const w of pool) { r -= w.boxWeight; if (r <= 0) return w; }
    return pool[pool.length - 1];
  };
  const all = Object.values(G.WEAPON_DEFS).filter((w) => w.boxOnly);
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

G.MELEE_DEF = { id: "melee", name: "Combat Knife", damage: 35, fireRate: 450, range: 2.6 };

// ---------------- Voxel builders (BoxGeometry only) ----------------
G.makeBoxMat = (color) => new THREE.MeshLambertMaterial({ color });

// Each weapon gets its own hand-built silhouette (not one shared template
// re-colored) so guns of the same rarity still read as different hardware:
// shotguns are short and fat, snipers long and thin, etc. Still pure
// BoxGeometry throughout to keep the voxel style and stay cheap to render.
G.WEAPON_BUILDERS = {
  pistol(g, mat, accentMat, magMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.3), mat);
    body.position.set(0, 0, -0.16); g.add(body);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.32), G.makeBoxMat(0xd8e4ea));
    slide.position.set(0, 0.09, -0.17); g.add(slide);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.09), accentMat);
    grip.position.set(0, -0.15, 0.02); grip.rotation.x = -0.15; g.add(grip);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.1), accentMat);
    barrel.position.set(0, 0.02, -0.36); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.07), magMat);
    mag.position.set(0, -0.27, 0.01); g.add(mag); // protrudes below the grip, lightened tint
  },
  shotgun(g, mat, accentMat, magMat) {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.62), mat);
    barrel.position.set(0, 0.03, -0.28); g.add(barrel);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.16), accentMat);
    pump.position.set(0, -0.02, -0.34); g.add(pump);
    const shellTube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), magMat);
    shellTube.position.set(0, -0.06, -0.28); g.add(shellTube); // under-barrel shell tube, lightened tint
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.2), accentMat);
    receiver.position.set(0, -0.01, 0.02); g.add(receiver);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.22), accentMat);
    stock.position.set(0, -0.02, 0.22); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.16, 0.06); grip.rotation.x = -0.2; g.add(grip);
  },
  smg(g, mat, accentMat, magMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.32), mat);
    body.position.set(0, 0.02, -0.1); g.add(body);
    const barrelShroud = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.16), accentMat);
    barrelShroud.position.set(0, 0.03, -0.34); g.add(barrelShroud);
    // stepped "curved" magazine: two stacked boxes offset forward to fake a curve
    const magTop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.09), magMat);
    magTop.position.set(0, -0.1, -0.06); g.add(magTop);
    const magBottom = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.14, 0.08), magMat);
    magBottom.position.set(0, -0.24, -0.02); g.add(magBottom);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.22), accentMat);
    stock.position.set(0, 0.01, 0.24); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.08); grip.rotation.x = -0.2; g.add(grip);
  },
  rifle(g, mat, accentMat, magMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.46), mat);
    body.position.set(0, 0.02, -0.14); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.34), accentMat);
    barrel.position.set(0, 0.02, -0.52); g.add(barrel);
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.22), accentMat);
    foregrip.position.set(0, -0.06, -0.4); g.add(foregrip);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), magMat);
    mag.position.set(0, -0.17, -0.08); mag.rotation.x = 0.15; g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.22), accentMat);
    stock.position.set(0, -0.01, 0.28); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.1); grip.rotation.x = -0.2; g.add(grip);
  },
  lmg(g, mat, accentMat, magMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.5), mat);
    body.position.set(0, 0.02, -0.12); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.36), accentMat);
    barrel.position.set(0, 0.04, -0.52); g.add(barrel);
    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), magMat);
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
  sniper(g, mat, accentMat, magMat) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.4), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.62), accentMat);
    barrel.position.set(0, 0, -0.6); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.06), magMat);
    mag.position.set(0, -0.09, 0.02); g.add(mag); // small integral box mag under the receiver
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
  railgun(g, mat, accentMat, magMat) {
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
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.08), magMat);
    cell.position.set(0, -0.14, 0.06); g.add(cell); // energy cell, doubles as the "magazine"
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.1); grip.rotation.x = -0.2; g.add(grip);
  },
  grenadelauncher(g, mat, accentMat, magMat) {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.36), mat);
    barrel.position.set(0, 0.02, -0.24); g.add(barrel);
    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.14), accentMat);
    chamber.position.set(0, 0.02, -0.02); g.add(chamber);
    const drum = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.05, 0.15), magMat);
    drum.position.set(0, 0.02, -0.02); g.add(drum); // drum-magazine highlight band around the chamber
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.05), accentMat);
    sight.position.set(0, 0.15, -0.2); g.add(sight);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.2), accentMat);
    stock.position.set(0, 0, 0.2); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.19, 0.09), accentMat);
    grip.position.set(0, -0.17, 0.08); grip.rotation.x = -0.2; g.add(grip);
  },
  golden_smg(g, mat, accentMat, magMat) {
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
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.09), magMat);
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

  // ---- Wall-mounted exclusives (category C3) ----
  school_wall(g, mat, accentMat, magMat) {
    // A bulky, authoritative double-railed auto-rifle.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.5), mat);
    body.position.set(0, 0.03, -0.14); g.add(body);
    [-0.045, 0.045].forEach((x) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.4), accentMat);
      rail.position.set(x, 0.1, -0.5); g.add(rail);
    });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), accentMat);
    barrel.position.set(0, 0.03, -0.62); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), magMat);
    mag.position.set(0, -0.19, -0.06); mag.rotation.x = 0.1; g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.24), accentMat);
    stock.position.set(0, 0, 0.3); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.09), accentMat);
    grip.position.set(0, -0.16, 0.12); grip.rotation.x = -0.2; g.add(grip);
  },
  hospital_wall(g, mat, accentMat, magMat) {
    // A large boxy shotgun with a red-cross emblem plate.
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), mat);
    barrel.position.set(0, 0.03, -0.24); g.add(barrel);
    const drum = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.16), magMat);
    drum.position.set(0, 0.03, -0.04); g.add(drum);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.1), accentMat);
    plate.position.set(0.09, 0.1, -0.1); g.add(plate);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.2), accentMat);
    receiver.position.set(0, -0.02, 0.14); g.add(receiver);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.22), accentMat);
    stock.position.set(0, -0.02, 0.34); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.19, 0.09), accentMat);
    grip.position.set(0, -0.17, 0.18); grip.rotation.x = -0.2; g.add(grip);
  },
  bunker_wall(g, mat, accentMat, magMat) {
    // A massive, long anti-materiel rifle -- the most imposing silhouette in the game.
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.42), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.75), accentMat);
    barrel.position.set(0, 0, -0.72); g.add(barrel);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.08), accentMat);
    brake.position.set(0, 0, -1.11); g.add(brake);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.07), magMat);
    mag.position.set(0, -0.1, 0.02); g.add(mag);
    const bipodMat = accentMat;
    [-0.07, 0.07].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), bipodMat);
      leg.position.set(x, -0.1, -0.62); leg.rotation.z = x < 0 ? -0.35 : 0.35; g.add(leg);
    });
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.3), accentMat);
    stock.position.set(0, -0.01, 0.32); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), accentMat);
    grip.position.set(0, -0.15, 0.16); grip.rotation.x = -0.2; g.add(grip);
  },

  // ---------------- School wall-mount silhouettes ----------------
  hall_monitor(g, mat, accentMat, magMat) { // tidy patrol SMG, top rail + side mag
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.34), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.26), accentMat);
    rail.position.set(0, 0.09, -0.14); g.add(rail);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), accentMat);
    barrel.position.set(0, 0.01, -0.36); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), magMat);
    mag.position.set(0, -0.19, -0.02); g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), accentMat);
    grip.position.set(0, -0.13, 0.12); g.add(grip);
  },
  detention_slug(g, mat, accentMat, magMat) { // pump shotgun with an exposed slide
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.4), mat);
    body.position.set(0, 0, -0.08); g.add(body);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.44), accentMat);
    tube.position.set(0, -0.06, -0.38); g.add(tube);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.14), magMat);
    pump.position.set(0, -0.06, -0.3); g.add(pump);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.42), accentMat);
    barrel.position.set(0, 0.03, -0.4); g.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.26), accentMat);
    stock.position.set(0, -0.03, 0.24); g.add(stock);
  },
  pop_quiz(g, mat, accentMat, magMat) { // compact carbine, angled foregrip
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.42), mat);
    body.position.set(0, 0, -0.06); g.add(body);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.26), accentMat);
    shroud.position.set(0, 0.03, -0.38); g.add(shroud);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.07), accentMat);
    fore.position.set(0, -0.13, -0.3); fore.rotation.x = 0.35; g.add(fore);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), magMat);
    mag.position.set(0, -0.17, -0.02); g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), accentMat);
    stock.position.set(0, -0.01, 0.22); g.add(stock);
  },
  cafeteria_cleaver(g, mat, accentMat, magMat) { // slab-sided hand cannon
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.3), mat);
    body.position.set(0, 0, -0.12); g.add(body);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.34), accentMat);
    slide.position.set(0, 0.11, -0.14); g.add(slide);
    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), accentMat);
    comp.position.set(0, 0.01, -0.32); g.add(comp);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.1), magMat);
    mag.position.set(0, -0.22, 0.0); g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.11), accentMat);
    grip.position.set(0, -0.14, 0.02); grip.rotation.x = -0.18; g.add(grip);
  },
  honor_roll(g, mat, accentMat, magMat) { // long precision rifle, big scope
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.48), mat);
    body.position.set(0, 0, -0.08); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.56), accentMat);
    barrel.position.set(0, 0.01, -0.6); g.add(barrel);
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.3), accentMat);
    scope.position.set(0, 0.14, -0.14); g.add(scope);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), magMat);
    mag.position.set(0, -0.15, -0.02); g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), accentMat);
    stock.position.set(0, -0.02, 0.28); g.add(stock);
  },
  science_fair(g, mat, accentMat, magMat) { // lab-built energy rifle, glowing flask
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.36), mat);
    body.position.set(0, 0, -0.08); g.add(body);
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), accentMat);
    emitter.position.set(0, 0.02, -0.38); g.add(emitter);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.09), new THREE.MeshBasicMaterial({ color: 0xbafff0 }));
    core.position.set(0, 0.14, -0.06); g.add(core);
    const flask = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.11), magMat);
    flask.position.set(0, -0.16, -0.04); g.add(flask);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), accentMat);
    grip.position.set(0, -0.13, 0.14); g.add(grip);
  },
  art_attack(g, mat, accentMat, magMat) { // paint-bomb launcher, fat drum
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.44), mat);
    tube.position.set(0, 0.02, -0.16); g.add(tube);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), accentMat);
    muzzle.position.set(0, 0.02, -0.42); g.add(muzzle);
    const drum = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.14), magMat);
    drum.position.set(0, -0.06, 0.02); g.add(drum);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.09), accentMat);
    sight.position.set(0.07, 0.15, -0.16); g.add(sight);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.09), accentMat);
    grip.position.set(0, -0.16, 0.2); g.add(grip);
  },
  principals_verdict(g, mat, accentMat, magMat) { // long piercing beam rifle
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.44), mat);
    body.position.set(0, 0, -0.04); g.add(body);
    const lance = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), accentMat);
    lance.position.set(0, 0.03, -0.58); g.add(lance);
    [0.1, -0.1].forEach((y) => {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.2), accentMat);
      vane.position.set(0, y + 0.02, -0.34); g.add(vane);
    });
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.08), new THREE.MeshBasicMaterial({ color: 0xffd0b0 }));
    tip.position.set(0, 0.03, -0.9); g.add(tip);
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.12), magMat);
    cell.position.set(0, -0.17, 0.0); g.add(cell);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.26), accentMat);
    stock.position.set(0, -0.02, 0.28); g.add(stock);
  },

  // ---------------- Mystery box silhouettes (category C2) ----------------
  // Fifteen distinct shapes -- each one differs in body proportion, barrel
  // treatment and magazine placement so they're told apart at a glance.
  scrap_spitter(g, mat, accentMat, magMat) { // welded-pipe SMG, mag jutting sideways
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.26), accentMat);
    pipe.position.set(0, 0.03, -0.36); g.add(pipe);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.08), magMat);
    mag.position.set(0.13, -0.03, -0.05); g.add(mag); // side-feed, very obvious
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.08), accentMat);
    grip.position.set(0, -0.14, 0.06); g.add(grip);
  },
  nail_driver(g, mat, accentMat, magMat) { // boxy nailgun with a top hopper
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.26), mat);
    body.position.set(0, 0, -0.08); g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), accentMat);
    nose.position.set(0, -0.02, -0.29); g.add(nose);
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.1), magMat);
    hopper.position.set(0, 0.14, -0.02); hopper.rotation.x = 0.25; g.add(hopper);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.09), accentMat);
    grip.position.set(0, -0.16, 0.05); g.add(grip);
  },
  hall_sweeper(g, mat, accentMat, magMat) { // stubby double-tube shotgun
    [-0.035, 0.035].forEach((x) => {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.44), accentMat);
      tube.position.set(x, 0.03, -0.26); g.add(tube);
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.22), mat);
    body.position.set(0, -0.01, 0.02); g.add(body);
    const shells = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), magMat);
    shells.position.set(0, -0.1, 0.02); g.add(shells);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.2), accentMat);
    stock.position.set(0, -0.04, 0.22); g.add(stock);
  },
  chalk_burster(g, mat, accentMat, magMat) { // slim bullpup, mag behind the grip
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.46), mat);
    body.position.set(0, 0, 0); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), accentMat);
    barrel.position.set(0, 0.03, -0.37); g.add(barrel);
    const carry = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.24), accentMat);
    carry.position.set(0, 0.1, -0.06); g.add(carry);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), magMat);
    mag.position.set(0, -0.13, 0.16); g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), accentMat);
    grip.position.set(0, -0.14, -0.1); g.add(grip);
  },
  detention_deuce(g, mat, accentMat, magMat) { // stacked over-under machine pistol
    [0.04, -0.05].forEach((y, i) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.28 - i * 0.05), mat);
      body.position.set(0, y, -0.14); g.add(body);
    });
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), magMat);
    mag.position.set(0, -0.24, 0.02); g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), accentMat);
    grip.position.set(0, -0.14, 0.03); g.add(grip);
  },
  rust_repeater(g, mat, accentMat, magMat) { // lever carbine with a tube magazine
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.38), mat);
    body.position.set(0, 0, -0.08); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), accentMat);
    barrel.position.set(0, 0.02, -0.45); g.add(barrel);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.36), magMat);
    tube.position.set(0, -0.06, -0.42); g.add(tube); // under-barrel tube mag
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.07), accentMat);
    lever.position.set(0, -0.12, 0.02); lever.rotation.x = 0.4; g.add(lever);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.26), accentMat);
    stock.position.set(0, -0.03, 0.22); g.add(stock);
  },
  gym_grinder(g, mat, accentMat, magMat) { // rotary barrels + drum
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.3), mat);
    body.position.set(0, 0, -0.04); g.add(body);
    [[-0.05, 0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05]].forEach(([x, y]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.34), accentMat);
      b.position.set(x, y, -0.34); g.add(b);
    });
    const drum = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.12), magMat);
    drum.position.set(0.02, -0.16, 0.08); g.add(drum);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), accentMat);
    grip.position.set(0, -0.14, 0.2); g.add(grip);
  },
  copper_coil(g, mat, accentMat, magMat) { // coil gun, stacked rings down the barrel
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.3), mat);
    body.position.set(0, 0, -0.06); g.add(body);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.05), accentMat);
      ring.position.set(0, 0.02, -0.28 - i * 0.11); g.add(ring);
    }
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.5), G.makeBoxMat(0xffd9a0));
    rod.position.set(0, 0.02, -0.42); g.add(rod);
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.1), magMat);
    cell.position.set(0, -0.15, 0.04); g.add(cell);
  },
  locker_lancer(g, mat, accentMat, magMat) { // long marksman rifle with a scope
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.44), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.46), accentMat);
    barrel.position.set(0, 0.01, -0.54); g.add(barrel);
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), accentMat);
    scope.position.set(0, 0.12, -0.14); g.add(scope);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.1), magMat);
    mag.position.set(0, -0.14, -0.04); g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.28), accentMat);
    stock.position.set(0, -0.02, 0.26); g.add(stock);
  },
  bus_bulldog(g, mat, accentMat, magMat) { // heavy revolver, fat cylinder
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.24), mat);
    body.position.set(0, 0, -0.12); g.add(body);
    const cylinder = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.12), magMat);
    cylinder.position.set(0, -0.01, -0.06); g.add(cylinder); // the "mag" is the cylinder
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.3), accentMat);
    barrel.position.set(0, 0.01, -0.34); g.add(barrel);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.28), accentMat);
    rib.position.set(0, 0.06, -0.34); g.add(rib);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), accentMat);
    grip.position.set(0, -0.16, 0.02); grip.rotation.x = -0.2; g.add(grip);
  },
  thunder_chalk(g, mat, accentMat, magMat) { // tesla gun with prongs + glowing core
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.32), mat);
    body.position.set(0, 0, -0.1); g.add(body);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0xbff4ff }));
    core.position.set(0, 0.04, -0.06); g.add(core);
    [[-0.07, 0.06], [0.07, 0.06], [0, -0.06]].forEach(([x, y]) => {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.24), accentMat);
      prong.position.set(x, y + 0.02, -0.38); g.add(prong);
    });
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.09), magMat);
    cell.position.set(0, -0.16, -0.02); g.add(cell);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), accentMat);
    grip.position.set(0, -0.13, 0.14); g.add(grip);
  },
  void_principal(g, mat, accentMat, magMat) { // heavy AR, twin side drums
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.46), mat);
    body.position.set(0, 0, -0.08); g.add(body);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), accentMat);
    shroud.position.set(0, 0.03, -0.44); g.add(shroud);
    [-0.1, 0.1].forEach((x) => {
      const drum = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.16), magMat);
      drum.position.set(x, -0.08, -0.02); g.add(drum);
    });
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.24), accentMat);
    stock.position.set(0, -0.02, 0.26); g.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.09), accentMat);
    grip.position.set(0, -0.15, 0.1); g.add(grip);
  },
  prism_lance(g, mat, accentMat, magMat) { // crystal lance, tapering emitter
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.34), mat);
    body.position.set(0, 0, -0.04); g.add(body);
    [0.16, 0.12, 0.08].forEach((s, i) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.6, 0.16), i === 2 ? new THREE.MeshBasicMaterial({ color: 0xffd0f4 }) : accentMat);
      seg.position.set(0, 0.02, -0.3 - i * 0.16); g.add(seg);
    });
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.2), accentMat);
    fin.position.set(0, 0.13, -0.08); g.add(fin);
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.1), magMat);
    cell.position.set(0, -0.15, 0.02); g.add(cell);
  },
  final_bell(g, mat, accentMat, magMat) { // auto shotgun with a bell-shaped muzzle
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.38), mat);
    body.position.set(0, 0, -0.06); g.add(body);
    const throat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.18), accentMat);
    throat.position.set(0, 0.02, -0.34); g.add(throat);
    const bell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.12), accentMat);
    bell.position.set(0, 0.02, -0.48); g.add(bell);
    const drum = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.14), magMat);
    drum.position.set(0, -0.16, -0.04); g.add(drum);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.09), accentMat);
    grip.position.set(0, -0.14, 0.16); g.add(grip);
  },
  meteor_detention(g, mat, accentMat, magMat) { // shoulder launcher with a warhead cluster
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.62), mat);
    tube.position.set(0, 0.02, -0.18); g.add(tube);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), accentMat);
    muzzle.position.set(0, 0.02, -0.52); g.add(muzzle);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.1), accentMat);
    sight.position.set(0.08, 0.14, -0.1); g.add(sight);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.24), magMat);
    rack.position.set(0, -0.14, 0.04); g.add(rack); // warhead rack under the tube
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.09), accentMat);
    grip.position.set(0, -0.16, 0.2); g.add(grip);
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
// shown in the weapon log, the mystery box and the shop.
G.WEIGHT_CLASSES = [
  { key: "light", max: 2.2, label: "เบา", speedMult: 1.0, staminaMult: 1.0, color: "#6bff7a" },
  { key: "medium", max: 3.3, label: "ปานกลาง", speedMult: 0.93, staminaMult: 1.12, color: "#ffd43b" },
  { key: "heavy", max: 4.4, label: "หนัก", speedMult: 0.84, staminaMult: 1.3, color: "#ff9a4d" },
  { key: "very_heavy", max: Infinity, label: "หนักมาก", speedMult: 0.74, staminaMult: 1.5, color: "#ff5c5c" },
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
  const g = new THREE.Group();
  const mat = G.makeBoxMat(def.color);
  const accentMat = G.makeBoxMat(def.accent != null ? def.accent : new THREE.Color(def.color).multiplyScalar(0.5).getHex());
  // A lightened tint of the body color, used ONLY for magazines so they read
  // as a distinct part at a glance instead of blending into the accent-colored
  // grip/barrel pieces.
  const magMat = G.makeBoxMat(new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.45).getHex());
  const builder = G.WEAPON_BUILDERS[def.id] || G.WEAPON_BUILDERS.pistol;
  builder(g, mat, accentMat, magMat);

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
// damage values scaled 3.75x to match player HP going 100 -> 375 (same % dmg/hit)
G.ZOMBIE_TYPES = {
  normal:  { hp: 34, speed: 1.7, scale: 1.0, color: 0x4c6b3a, damage: 30, scoreValue: 10 },
  fast:    { hp: 22, speed: 3.1, scale: 0.85, color: 0x8a6a2a, damage: 23, scoreValue: 16 },
  crawler: { hp: 26, speed: 1.3, scale: 0.9, color: 0x5c5449, damage: 26, scoreValue: 14 },
  boss:    { hp: 900, speed: 1.0, scale: 3.0, color: 0x6b1e6b, damage: 83, scoreValue: 500 },
};

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

function addZombieFace(head, type, skinMat, variation) {
  const f = ZOMBIE_FACE[type] || ZOMBIE_FACE.normal;
  const v = variation || G.randomZombieVariation();
  const eyeMat = new THREE.MeshBasicMaterial({ color: f.eyeColor });
  const eyeSize = f.eyeSize * v.eyeSizeMult;
  [-0.09, 0.09].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, 0.02), eyeMat);
    eye.position.set(x + v.eyeJitterX, 0.04 + v.eyeJitterY, 0.175); head.add(eye);
  });
  // ears
  [-0.175, 0.175].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08 * v.earSizeMult, 0.08 * v.earSizeMult), skinMat);
    ear.position.set(x, 0, 0); head.add(ear);
  });
  // nose (slightly darker, damaged-looking)
  const noseMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(skinMat.color).multiplyScalar(0.7).getHex() });
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), noseMat);
  nose.position.set(v.noseJitterX, -0.02, 0.18); head.add(nose);
  // gaping mouth with a blood-red interior showing
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(f.mouthWidth, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: 0x1a0505 }));
  mouth.position.set(0, -0.1, 0.175); head.add(mouth);
  if (v.mouthBlood) {
    const blood = new THREE.Mesh(new THREE.BoxGeometry(f.mouthWidth * 0.8, 0.025, 0.045), new THREE.MeshBasicMaterial({ color: 0x8a1414 }));
    blood.position.set(0, -0.14, 0.176); head.add(blood);
  }
}

function addWounds(torso, count) {
  const woundColors = [0x6b0f0f, 0x1a1a1a, 0x4a0a0a];
  for (let i = 0; i < count; i++) {
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 + G.rng() * 0.06, 0.05 + G.rng() * 0.06, 0.02),
      new THREE.MeshBasicMaterial({ color: woundColors[i % woundColors.length] })
    );
    const side = G.rng() > 0.5 ? 1 : -1;
    w.position.set((G.rng() - 0.5) * 0.35, 0.15 + G.rng() * 0.35, side * 0.151);
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

G.buildZombieMesh = function (type, variation) {
  const def = G.ZOMBIE_TYPES[type];
  const v = variation || G.randomZombieVariation();
  const g = new THREE.Group();
  const mat = G.makeBoxMat(def.color);
  const skinMat = G.makeBoxMat(new THREE.Color(def.color).offsetHSL(0, -0.1, 0.08).getHex());
  const tornMat = G.makeBoxMat(new THREE.Color(def.color).multiplyScalar(0.55).getHex());
  const woundCount = (ZOMBIE_FACE[type] ? ZOMBIE_FACE[type].scars : 2) + v.extraWounds;

  if (type === "crawler") {
    // Legless crawler: body dragged low and near-horizontal instead of
    // standing upright, forelimbs reaching forward for the pull stroke.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.75), mat);
    torso.position.set(0, 0.32, -0.05); torso.rotation.x = -0.12; g.add(torso);
    addWounds(torso, woundCount);
    addTatteredClothing(g, tornMat, v.tatterAmount, 0.3, 0.15);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), skinMat);
    head.position.set(0, 0.38, 0.42); head.rotation.x = 0.35; g.add(head);
    head.name = "head";
    addZombieFace(head, type, skinMat, v);
    const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    const armL = new THREE.Mesh(armGeo, skinMat); armL.position.set(-0.22, 0.28, 0.35); armL.rotation.x = -0.9; g.add(armL);
    const armR = new THREE.Mesh(armGeo, skinMat); armR.position.set(0.22, 0.28, 0.35); armR.rotation.x = -0.9; g.add(armR);
    // stumps where the legs used to be -- short, dragging, non-animated
    const stumpGeo = new THREE.BoxGeometry(0.16, 0.16, 0.22);
    const stumpL = new THREE.Mesh(stumpGeo, tornMat); stumpL.position.set(-0.13, 0.18, -0.4); g.add(stumpL);
    const stumpR = new THREE.Mesh(stumpGeo, tornMat); stumpR.position.set(0.13, 0.18, -0.4); g.add(stumpR);
    g.userData.limbs = { armL, armR, legL: null, legR: null };
    g.userData.crawler = true;
    g.userData.torso = torso;
    g.userData.torsoBaseY = torso.position.y;
  } else {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
    torso.position.y = 1.1; g.add(torso);
    addWounds(torso, woundCount);
    addTatteredClothing(g, tornMat, v.tatterAmount, 0.75, 0.13);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
    head.position.y = 1.65; g.add(head);
    head.name = "head";
    addZombieFace(head, type, skinMat, v);
    // boss gets visible shoulder armor plates to look distinctly more dangerous
    if (type === "boss") {
      [-0.32, 0.32].forEach((x) => {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), tornMat);
        plate.position.set(x, 1.42, 0); g.add(plate);
      });
    }
    const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const armL = new THREE.Mesh(armGeo, skinMat); armL.position.set(-0.38, 1.05, 0); g.add(armL);
    const armR = new THREE.Mesh(armGeo, skinMat); armR.position.set(0.38, 1.05, 0); g.add(armR);
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legL = new THREE.Mesh(legGeo, mat); legL.position.set(-0.15, 0.4, 0); g.add(legL);
    const legR = new THREE.Mesh(legGeo, mat); legR.position.set(0.15, 0.4, 0); g.add(legR);
    g.userData.limbs = { armL, armR, legL, legR };
  }

  g.scale.setScalar(def.scale);
  // slight random stagger lean, per instance, so a group of zombies doesn't
  // look identically posed
  g.userData.baseLean = (G.rng() - 0.5) * 0.14;
  g.rotation.z = g.userData.baseLean;
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
// moveTarget drives WHERE the zombie walks (the player directly, or the next
// waypoint when routing around walls -- see game.js updateZombies). attackTarget
// is always the real player position; the returned distance is measured to
// THAT (not moveTarget), so an in-transit waypoint never triggers a melee hit
// from across a wall, and attack range always reflects true player proximity.
G.Zombie.prototype.update = function (dt, moveTarget, attackTarget, colliders, gameSpeedTimeScale) {
  if (!this.alive) return;
  attackTarget = attackTarget || moveTarget;
  this.walkT += dt * 6 * this.speed;
  const dir = new THREE.Vector3().subVectors(moveTarget, this.mesh.position);
  dir.y = 0;
  const moveDist = dir.length();
  if (moveDist > 0.9) {
    dir.normalize();
    const moveSpeed = this.speed * this.speedMultiplier * dt;
    // Local obstacle avoidance (furniture/props within a room -- the waypoint
    // graph in game.js already handles routing between rooms through actual
    // doorways). Cheap: try the direct heading, then +/-40deg/80deg deflections,
    // and take the first that doesn't walk straight into a collider's footprint.
    let moveDir = dir;
    if (colliders && colliders.length) {
      const testPoint = new THREE.Vector3();
      const angles = [0, 0.7, -0.7, 1.4, -1.4];
      for (const a of angles) {
        const cand = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        testPoint.copy(this.mesh.position).addScaledVector(cand, moveSpeed + 0.4);
        const blocked = colliders.some((c) => testPoint.x >= c.min.x && testPoint.x <= c.max.x && testPoint.z >= c.min.z && testPoint.z <= c.max.z);
        if (!blocked) { moveDir = cand; break; }
      }
    }
    this.mesh.position.addScaledVector(moveDir, moveSpeed);
    this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
  }
  const limbs = this.mesh.userData.limbs;
  if (limbs && this.mesh.userData.crawler) {
    // Dragging crawl: forelimbs pull alternately (breast-stroke-like reach)
    // and the torso bobs with each pull instead of a standing leg-swing.
    const crawlSwing = Math.sin(this.walkT) * 0.5;
    limbs.armL.rotation.x = -0.9 + crawlSwing;
    limbs.armR.rotation.x = -0.9 - crawlSwing;
    if (this.mesh.userData.torso) this.mesh.userData.torso.position.y = this.mesh.userData.torsoBaseY + Math.abs(Math.sin(this.walkT * 0.5)) * 0.05;
  } else if (limbs) {
    const swing = Math.sin(this.walkT) * 0.4;
    limbs.armL.rotation.x = swing; limbs.armR.rotation.x = -swing;
    limbs.legL.rotation.x = -swing; limbs.legR.rotation.x = swing;
  }
  this.attackCooldown -= dt;
  const dx = attackTarget.x - this.mesh.position.x, dz = attackTarget.z - this.mesh.position.z;
  return Math.hypot(dx, dz);
};

// ---------------- Particles (muzzle flash / blood / crate burst) ----------------
G.spawnMuzzleFlash = function (scene, position, quality) {
  if (quality === "vlow") return;
  const light = new THREE.PointLight(0xffdd66, 3, 4);
  light.position.copy(position);
  scene.add(light);
  setTimeout(() => scene.remove(light), 50);
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
  const light = new THREE.PointLight(0xfff2b0, 3.5, 5);
  light.position.copy(position);
  scene.add(light);
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
    else { scene.remove(pts); scene.remove(light); geo.dispose(); mat.dispose(); }
  };
  requestAnimationFrame(step);
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
