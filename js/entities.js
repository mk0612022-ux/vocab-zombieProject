// ============================================================
// ENTITIES: weapons, loot/rarity, player, zombies, particles
// Art style: voxel/blocky — everything built from BoxGeometry.
// ============================================================
window.G = window.G || {};

// ---------------- Rarity ----------------
G.RARITY = {
  common:   { key: "common",   label: "COMMON",   color: 0xb9c2c2, chance: 0.50 },
  uncommon: { key: "uncommon", label: "UNCOMMON", color: 0x4be05c, chance: 0.30 },
  rare:     { key: "rare",     label: "RARE",     color: 0x4b9bff, chance: 0.13 },
  epic:     { key: "epic",     label: "EPIC",     color: 0xb14bff, chance: 0.06 },
  secret:   { key: "secret",   label: "SECRET",   color: 0xffd43b, chance: 0.01 },
};
G.RARITY_ORDER = ["common", "uncommon", "rare", "epic", "secret"];

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
G.WEAPON_DEFS = {
  pistol: { id: "pistol", name: "Pistol", rarity: "common", damage: 14, fireRate: 320, magSize: 12,
    reloadTime: 1000, auto: false, price: 0, color: 0x888888 },
  shotgun: { id: "shotgun", name: "Shotgun", rarity: "common", damage: 9, pellets: 6, fireRate: 750, magSize: 6,
    reloadTime: 1600, auto: false, price: 400, color: 0x7a6a4a },
  smg: { id: "smg", name: "SMG", rarity: "uncommon", damage: 10, fireRate: 110, magSize: 30,
    reloadTime: 1300, auto: true, price: 900, color: 0x4be05c },
  rifle: { id: "rifle", name: "Assault Rifle", rarity: "uncommon", damage: 18, fireRate: 160, magSize: 25,
    reloadTime: 1500, auto: true, price: 1200, color: 0x39a648 },
  lmg: { id: "lmg", name: "LMG", rarity: "rare", damage: 15, fireRate: 90, magSize: 60,
    reloadTime: 2200, auto: true, price: 2200, color: 0x3b7fd6 },
  sniper: { id: "sniper", name: "Sniper", rarity: "rare", damage: 90, fireRate: 950, magSize: 5,
    reloadTime: 1800, auto: false, price: 2400, color: 0x2f5fb0 },
  railgun: { id: "railgun", name: "Piercing Railgun", rarity: "epic", damage: 45, fireRate: 500, magSize: 8,
    reloadTime: 1700, auto: false, pierce: true, price: 4200, color: 0x9b3bff },
  grenadelauncher: { id: "grenadelauncher", name: "Grenade Launcher", rarity: "epic", damage: 70, fireRate: 900, magSize: 4,
    reloadTime: 2000, auto: false, splash: true, splashRadius: 4.5, price: 4600, color: 0x7a2fd0 },
  golden_smg: { id: "golden_smg", name: "Golden Vocabulary SMG", rarity: "secret", damage: 55, fireRate: 70, magSize: 50,
    reloadTime: 1000, auto: true, price: 9999, color: 0xffd43b, legendary: true },
};

G.MELEE_DEF = { id: "melee", name: "Combat Knife", damage: 35, fireRate: 450, range: 2.6 };

// ---------------- Voxel builders (BoxGeometry only) ----------------
G.makeBoxMat = (color) => new THREE.MeshLambertMaterial({ color });

G.buildWeaponMesh = function (def) {
  const g = new THREE.Group();
  const mat = G.makeBoxMat(def.color);
  const darkMat = G.makeBoxMat(new THREE.Color(def.color).multiplyScalar(0.55).getHex());
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), mat);
  body.position.set(0, 0, -0.2);
  g.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), darkMat);
  grip.position.set(0, -0.14, 0.05);
  g.add(grip);
  const barrelLen = def.rarity === "rare" || def.rarity === "epic" || def.rarity === "secret" ? 0.35 : 0.2;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, barrelLen), darkMat);
  barrel.position.set(0, 0.02, -0.45 - barrelLen / 2 + 0.2);
  g.add(barrel);
  if (def.magSize > 20) {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), darkMat);
    mag.position.set(0, -0.15, -0.1);
    g.add(mag);
  }
  if (def.rarity === "epic" || def.rarity === "secret") {
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: def.color }));
    glow.position.set(0, 0.07, -0.2);
    g.add(glow);
  }
  if (def.rarity === "secret") {
    const spark = new THREE.PointLight(0xffd43b, 1, 1.5);
    spark.position.set(0, 0.05, -0.3);
    g.add(spark);
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
    if (life < 0.7) requestAnimationFrame(anim); else scene.remove(pts);
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
