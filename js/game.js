// ============================================================
// GAME: state machine, Three.js scene, player controller,
// shooting, waves, boss, shop, loot, interactions, main loop
// ============================================================
window.G = window.G || {};

/*
  STATE MACHINE (top-level states):
  MENU -> LEVEL_SELECT -> GAMEPLAY <-> PAUSE
  GAMEPLAY -> SHOP -> GAMEPLAY
  GAMEPLAY -> GAME_OVER -> (GAMEPLAY via retry) | MENU
  GAMEPLAY -> VICTORY -> LEVEL_SELECT | (GAMEPLAY via retry) | MENU
  MENU -> PRACTICE_SETUP -> PRACTICE_PLAY -> MENU
  Sub-menus (SETTINGS/LEADERBOARD/ACHIEVEMENTS/IMPORT/HOWTOPLAY) are reachable
  from MENU or PAUSE and always return to their caller.
*/

G.Game = {
  state: "MENU",
  scene: null, camera: null, renderer: null, clock: null,
  yawObject: null, pitchObject: null,
  world: null, level: null, mode: "campaign",
  wave: 0, spawnedCount: 0, requiredKills: 0,
  zombies: [],
  drops: [],
  wordPool: [],
  targetPair: null,
  player: null,
  wrongWordsThisRun: {},
  correctCount: 0, wrongCount: 0,
  raycaster: new THREE.Raycaster(),
  velocityY: 0,
  lastFrameTime: 0,
  fpsSmoothed: 60,
  shopTimer: 0,
  challenge: null, // active generic word challenge {onResult, timeLeft, timeLimit}
  paused: false,
  practiceSource: null,

  // ---------------- Bootstrap ----------------
  init() {
    const isFirstRun = !localStorage.getItem("vocabZombie_save_v1");
    G.loadSave();
    if (isFirstRun) {
      const smallScreen = window.innerWidth < 900 || "ontouchstart" in window;
      G.save.settings.graphicsQuality = smallScreen ? "medium" : "high";
      G.persist();
    }
    G.Input.init();
    G.UI.init();
    G.Shop.resetRun();
    this.setupThree();
    document.getElementById("loading-overlay").classList.add("hidden");
    G.UI.showScreen("screen-mainmenu");
    G.UI.el("hud-fps-counter").classList.toggle("hidden", !G.save.settings.showFpsCounter);
    requestAnimationFrame((t) => this.loop(t));
  },

  setupThree() {
    const canvas = document.getElementById("gameCanvas");
    const q = G.save.settings.graphicsQuality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q === "high" || q === "vhigh" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "vhigh" ? 2 : q === "high" ? 1.5 : 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = q === "high" || q === "vhigh";
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(this.camera);
    this.yawObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);
    this.yawObject.position.set(0, 1.7, 4);
    this.clock = new THREE.Clock();

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.getElementById("gameCanvas").addEventListener("click", () => {
      if (this.state === "GAMEPLAY" && G.Input.mode === "desktop") G.Input.requestPointerLock();
    });
  },

  applyGraphicsQuality() {
    const q = G.save.settings.graphicsQuality;
    this.renderer.shadowMap.enabled = q === "high" || q === "vhigh";
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === "vhigh" ? 2 : q === "high" ? 1.5 : 1));
    if (this.scene && this.scene.fog && this.level) {
      const pal = G.THEME_PALETTES[this.level.theme];
      this.scene.fog.far = q === "vlow" ? pal.fogFar * 0.5 : q === "low" ? pal.fogFar * 0.7 : pal.fogFar;
    }
  },

  // ---------------- Top-level navigation ----------------
  goToLevelSelect() { G.UI.renderLevelSelect(); G.UI.showScreen("screen-levelselect"); this.state = "LEVEL_SELECT"; },
  goToPracticeSetup() { G.UI.renderPracticeSetup(); G.UI.showScreen("screen-practice-setup"); this.state = "PRACTICE_SETUP"; },

  quitToMainMenu() {
    this.teardownLevel();
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.setTouchControlsVisible(false);
    G.UI.goToMainMenu();
    this.state = "MENU";
  },

  // ---------------- Practice mode ----------------
  startPractice(source) {
    let pairs;
    if (source === "weak") {
      const all = G.getAllBuiltinWords();
      pairs = all.filter((p) => {
        const s = G.save.wordStats[p[0].toLowerCase()];
        return s && s.wrong > 0 && !G.isWordMastered(p[0]);
      });
      if (pairs.length < 4) pairs = G.weightedSample(all, 15);
    } else if (G.WORD_SETS[source]) {
      pairs = G.WORD_SETS[source].words;
    } else if (G.save.importedSets[source]) {
      pairs = G.save.importedSets[source].words.filter((p) => p[1]);
    } else {
      pairs = G.getAllBuiltinWords();
    }
    if (!pairs || pairs.length < 4) { alert("ชุดคำศัพท์นี้มีคำไม่พอสำหรับฝึก (ต้องมีความหมายอย่างน้อย 4 คำ)"); return; }
    this.state = "PRACTICE_PLAY";
    G.UI.showScreen("screen-practice-play");
    G.UI.startPracticeRound(pairs);
  },
  endPractice() { G.persist(); this.goToPracticeSetup(); },

  // ---------------- Run lifecycle ----------------
  startLevel(id) {
    this.mode = "campaign";
    this.level = G.getLevel(id);
    this.wordPool = G.WORD_SETS[this.level.wordsKey].words;
    this.beginRun();
  },
  startDailyChallenge() {
    this.mode = "daily";
    this.level = Object.assign({}, G.getLevel(1), { waves: 5, bossEvery: 3, name: "Daily Challenge" });
    this.wordPool = G.getDailyWordSet();
    this.beginRun();
  },
  startEndless() {
    this.mode = "endless";
    this.level = Object.assign({}, G.getLevel(3), { waves: 999999, bossEvery: 3, name: "Endless" });
    this.wordPool = G.getAllBuiltinWords();
    this.beginRun();
  },
  retry() {
    if (this.mode === "campaign") this.startLevel(this.level.id);
    else if (this.mode === "daily") this.startDailyChallenge();
    else this.startEndless();
  },

  beginRun() {
    G.Shop.resetRun();
    this.teardownLevel();
    this.scene = new THREE.Scene();
    this.scene.add(this.yawObject);
    this.world = G.buildLevelScene(this.scene, this.level, G.save.settings.graphicsQuality);
    this.yawObject.position.set(this.world.spawn.x, 1.7, this.world.spawn.z);
    this.pitchObject.rotation.x = 0;
    this.yawObject.rotation.y = 0;

    this.player = {
      hp: 100, maxHp: 100, money: 0, score: 0,
      gunSlots: ["pistol"], currentSlot: 1,
      ammo: { pistol: { mag: G.WEAPON_DEFS.pistol.magSize, reserve: G.WEAPON_DEFS.pistol.magSize * 4 } },
      weaponLevels: { pistol: { dmg: 1, rate: 1, mag: 1 } },
      perks: {}, moveSpeedMult: 1, armorPct: 0,
      combo: 0, comboTimer: 0, wasHitThisLevel: false,
      fireCooldown: 0, reloadTimeLeft: 0, reloading: false,
    };
    // Weapons unlocked in previous runs (shop purchases, crate finds) carry over —
    // G.save.unlockedWeapons is persisted specifically for this, but was never
    // consulted here, so every run silently reset back to "pistol only".
    (G.save.unlockedWeapons || []).forEach((wid) => {
      if (wid === "pistol" || !G.WEAPON_DEFS[wid] || this.player.gunSlots.length >= 4) return;
      this.player.gunSlots.push(wid);
      this.player.ammo[wid] = { mag: G.WEAPON_DEFS[wid].magSize, reserve: G.WEAPON_DEFS[wid].magSize * 4 };
      this.player.weaponLevels[wid] = { dmg: 1, rate: 1, mag: 1 };
    });
    this.correctCount = 0; this.wrongCount = 0; this.wrongWordsThisRun = {};
    this.zombies.forEach((z) => this.scene.remove(z.mesh));
    this.zombies = [];
    this.drops.forEach((d) => this.scene.remove(d.mesh));
    this.drops = [];
    this.targetPair = null;
    this.wave = 0;

    G.UI.showScreen(null);
    G.UI.setHudVisible(true);
    G.UI.applyControlMode();
    this.state = "GAMEPLAY";
    this.startWave();
    if (G.Input.mode === "desktop") G.Input.requestPointerLock();
  },

  teardownLevel() {
    if (this.scene) {
      this.zombies.forEach((z) => this.scene.remove(z.mesh));
      this.drops.forEach((d) => this.scene.remove(d.mesh));
    }
    this.zombies = []; this.drops = [];
    G.BossFight.stop();
    this.challenge = null;
    G.UI.setChallengeVisible(false);
    G.UI.setBossBar(false);
  },

  startWave() {
    this.wave++;
    this.spawnedCount = 0;
    const diff = this.level.difficulty + (this.wave - 1) * 0.18 + (this.mode === "endless" ? (this.wave - 1) * 0.05 : 0);
    this.requiredKills = Math.round((6 + this.wave * 2) * (this.mode === "endless" ? 1 + this.wave * 0.05 : 1));
    G.Spawner.reset(this.level, this.wave);
    this.zombies.forEach((z) => (z.speedMultiplier = 1));
    this.currentDiff = diff;
  },

  isBossWave() {
    const isFinal = this.mode === "campaign" && this.wave >= this.level.waves;
    return isFinal || this.wave % this.level.bossEvery === 0;
  },

  // ---------------- Word/target management ----------------
  ensureTargetHasMatch() {
    const alive = this.zombies.filter((z) => z.alive);
    if (alive.length === 0) { this.targetPair = null; return; }
    if (this.targetPair && alive.some((z) => z.word === this.targetPair[0])) {
      alive.forEach((z) => z.setTarget(z.word === this.targetPair[0]));
      return;
    }
    const chosen = G.pick(alive);
    this.targetPair = [chosen.word, chosen.meaning];
    alive.forEach((z) => z.setTarget(z === chosen));
  },

  spawnZombieAt(type, pos) {
    const usedWords = this.zombies.filter((z) => z.alive).map((z) => z.word);
    let candidates = this.wordPool.filter((p) => !usedWords.includes(p[0]));
    if (candidates.length === 0) candidates = this.wordPool;
    const pair = G.weightedSample(candidates, 1)[0] || G.pick(this.wordPool);
    const z = new G.Zombie(type, pos, pair);
    this.scene.add(z.mesh);
    this.zombies.push(z);
    this.spawnedCount++;
    this.ensureTargetHasMatch();
    return z;
  },

  // ---------------- Weapon helpers ----------------
  currentWeaponId() { return this.player.currentSlot === 0 ? "melee" : this.player.gunSlots[this.player.currentSlot - 1]; },
  currentWeaponDef() {
    const id = this.currentWeaponId();
    return id === "melee" ? G.MELEE_DEF : G.WEAPON_DEFS[id];
  },
  currentWeaponLevel() {
    const id = this.currentWeaponId();
    return id === "melee" ? { dmg: 1, rate: 1, mag: 1 } : this.player.weaponLevels[id];
  },
  switchSlot(slot) {
    if (slot === 0) { this.player.currentSlot = 0; return; }
    const idx = slot - 1;
    if (this.player.gunSlots[idx]) { this.player.currentSlot = slot; this.player.reloading = false; }
  },
  buildWeaponViewModel() {
    if (this.weaponViewGroup) this.camera.remove(this.weaponViewGroup);
    const def = this.currentWeaponDef();
    const mesh = def.id === "melee" ? G.buildMeleeMesh() : G.buildWeaponMesh(def);
    mesh.position.set(0.32, -0.28, -0.55);
    mesh.rotation.y = Math.PI;
    this.weaponViewGroup = mesh;
    this.camera.add(mesh);
  },

  acquireWeapon(weaponId) {
    if (this.player.gunSlots.includes(weaponId)) {
      const cur = this.player.ammo[weaponId];
      cur.reserve += G.WEAPON_DEFS[weaponId].magSize * 3;
      return;
    }
    if (this.player.gunSlots.length < 4) this.player.gunSlots.push(weaponId);
    else this.player.gunSlots[this.player.gunSlots.length - 1] = weaponId;
    this.player.ammo[weaponId] = { mag: G.WEAPON_DEFS[weaponId].magSize, reserve: G.WEAPON_DEFS[weaponId].magSize * 4 };
    this.player.weaponLevels[weaponId] = { dmg: 1, rate: 1, mag: 1 };
    if (!G.save.unlockedWeapons.includes(weaponId)) { G.save.unlockedWeapons.push(weaponId); G.persist(); }
    this.player.currentSlot = this.player.gunSlots.length;
  },

  reload() {
    const id = this.currentWeaponId();
    if (id === "melee") return;
    const ammo = this.player.ammo[id];
    const def = G.WEAPON_DEFS[id];
    const lvl = this.player.weaponLevels[id];
    const magSize = Math.round(def.magSize * lvl.mag);
    if (this.player.reloading || ammo.mag >= magSize || ammo.reserve <= 0) return;
    this.player.reloading = true;
    this.player.reloadTimeLeft = def.reloadTime / 1000;
  },

  // ---------------- Shooting ----------------
  fireWeapon() {
    const def = this.currentWeaponDef();
    if (this.player.fireCooldown > 0 || this.player.reloading) return;
    const id = this.currentWeaponId();
    if (id === "melee") { this.meleeAttack(def); this.player.fireCooldown = def.fireRate / 1000; return; }
    const ammo = this.player.ammo[id];
    const lvl = this.player.weaponLevels[id];
    if (ammo.mag <= 0) { this.reload(); return; }
    ammo.mag--;
    this.player.fireCooldown = (def.fireRate / 1000) / lvl.rate;
    const dmg = def.damage * lvl.dmg;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    G.spawnMuzzleFlash(this.scene, origin.clone().addScaledVector(dir, 0.6), G.save.settings.graphicsQuality);
    this.recoilKick();

    const shots = def.pellets || 1;
    let anyHit = false;
    for (let i = 0; i < shots; i++) {
      const spread = def.pellets ? 0.06 : 0.004;
      const d = dir.clone();
      d.x += (G.rng() - 0.5) * spread; d.y += (G.rng() - 0.5) * spread; d.z += (G.rng() - 0.5) * spread;
      d.normalize();
      if (this.raycastShoot(origin, d, dmg, def.pierce)) anyHit = true;
    }
    if (anyHit) G.UI.showHitmarker();
    if (ammo.mag <= 0 && ammo.reserve > 0) this.reload();
  },

  raycastShoot(origin, dir, dmg, pierce) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = 60;
    this.raycaster.camera = this.camera; // THREE.Sprite.raycast (word labels) needs this in r128
    const meshes = this.zombies.filter((z) => z.alive).map((z) => z.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    let hitAny = false;
    const hitZombieUids = new Set();
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData.zombie) obj = obj.parent;
      if (!obj) continue;
      const z = obj.userData.zombie;
      if (hitZombieUids.has(z.uid) || !z.alive) continue;
      hitZombieUids.add(z.uid);
      hitAny = true;
      this.damageZombie(z, dmg, hit.point);
      if (!pierce) break;
    }
    // also allow shooting the static locked crate to attempt opening (per spec: "ยิงหรือกด E เพื่อเปิด")
    if (this.world) {
      const crateMeshes = this.world.crates.filter((c) => !c.opened).map((c) => c.mesh);
      const cHits = this.raycaster.intersectObjects(crateMeshes, true);
      if (cHits.length && (!hits.length || cHits[0].distance < (hits[0] ? hits[0].distance : Infinity))) {
        this.tryOpenStaticCrate(this.world.crates.find((c) => c.mesh === cHits[0].object || c.mesh === cHits[0].object.parent));
      }
    }
    return hitAny;
  },

  meleeAttack(def) {
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(); this.camera.getWorldPosition(origin);
    let best = null, bestDist = def.range;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const toZ = new THREE.Vector3().subVectors(z.mesh.position, origin);
      const dist = toZ.length();
      if (dist > def.range) continue;
      toZ.normalize();
      if (toZ.dot(dir) > 0.7 && dist < bestDist) { best = z; bestDist = dist; }
    }
    if (best) { G.UI.showHitmarker(); this.damageZombie(best, def.damage, best.mesh.position); }
  },

  recoilKick() {
    if (!this.weaponViewGroup) return;
    this.weaponViewGroup.position.z += 0.06;
    setTimeout(() => { if (this.weaponViewGroup) this.weaponViewGroup.position.z -= 0.06; }, 60);
  },

  damageZombie(z, dmg, hitPoint) {
    G.spawnHitParticles(this.scene, hitPoint, 0x8a2a2a, G.save.settings.graphicsQuality);
    let appliedDmg = dmg;
    if (z.type === "boss" && G.BossFight.active && G.BossFight.zombie === z) {
      // chip damage only; main hp loss comes from correct word answers
      appliedDmg = Math.min(dmg, z.maxHp * 0.01);
    }
    const died = z.takeDamage(appliedDmg);
    if (died) this.onZombieDeath(z);
  },

  onZombieDeath(z) {
    this.scene.remove(z.mesh);
    if (z.type === "boss") { this.onBossDefeated(z); return; }
    const wasCorrect = this.targetPair && z.word === this.targetPair[0];
    if (wasCorrect) {
      this.correctCount++;
      const prevWrong = G.save.wordStats[z.word.toLowerCase()] && G.save.wordStats[z.word.toLowerCase()].wrong > 0;
      G.recordWordResult(z.word, true);
      this.player.combo++;
      if (this.player.combo >= 50) G.unlockAchievement("streak50");
      let reward = 10 + z.word.length * 3 + Math.min(this.player.combo, 20) * 2;
      if (prevWrong) reward = Math.round(reward * 1.6);
      this.player.money += reward;
      this.player.score += 15 + z.word.length * 2 + this.player.combo * 3;
      this.rollLootDrop(z, true);
    } else {
      this.wrongCount++;
      G.recordWordResult(z.word, false);
      this.trackWrongWord(z.word, z.meaning);
      this.player.combo = 0;
      this.player.hp -= 6;
      this.player.wasHitThisLevel = true;
      G.UI.flashDamage();
      this.zombies.forEach((zz) => { if (zz.alive) zz.speedMultiplier = Math.min(2, zz.speedMultiplier + 0.25); });
      this.rollLootDrop(z, false);
    }
    this.zombies = this.zombies.filter((zz) => zz !== z);
    this.ensureTargetHasMatch();
    this.checkWaveClear();
    this.checkPlayerDeath();
  },

  trackWrongWord(word, meaning) {
    const key = word;
    if (!this.wrongWordsThisRun[key]) this.wrongWordsThisRun[key] = { meaning, count: 0 };
    this.wrongWordsThisRun[key].count++;
  },

  // ---------------- Loot ----------------
  rollLootDrop(z, correct) {
    const baseChance = z.type === "fast" ? 0.22 : 0.13;
    const chance = correct ? baseChance * 1.4 : baseChance;
    if (G.rng() > chance) return;
    const roll = G.rng();
    let kind;
    if (roll < 0.45) kind = "money";
    else if (roll < 0.75) kind = "ammo";
    else if (roll < 0.92) kind = "health";
    else kind = "crate";
    this.spawnDrop(kind, z.mesh.position.clone());
  },

  spawnDrop(kind, pos) {
    const colors = { money: 0xffdd33, ammo: 0x3388ff, health: 0xff3355, crate: G.RARITY[G.rollRarity()].color };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: colors[kind] }));
    mesh.position.copy(pos); mesh.position.y = 0.3;
    this.scene.add(mesh);
    const rarity = kind === "crate" ? G.rollRarity() : null;
    this.drops.push({ kind, mesh, rarity, t: 0 });
  },

  collectDrop(drop) {
    this.scene.remove(drop.mesh);
    this.drops = this.drops.filter((d) => d !== drop);
    if (drop.kind === "money") this.player.money += 20 + Math.round(G.rng() * 30);
    else if (drop.kind === "ammo") {
      const id = this.currentWeaponId();
      if (id !== "melee") this.player.ammo[id].reserve += G.WEAPON_DEFS[id].magSize * 2;
    } else if (drop.kind === "health") this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
    else if (drop.kind === "crate") this.openCrate(drop.rarity);
  },

  openCrate(rarityKey, guaranteedMin, onClose) {
    if (guaranteedMin && G.RARITY_ORDER.indexOf(rarityKey) < G.RARITY_ORDER.indexOf(guaranteedMin)) rarityKey = guaranteedMin;
    const pool = Object.values(G.WEAPON_DEFS).filter((w) => w.rarity === rarityKey);
    const weaponDef = pool.length ? G.pick(pool) : G.WEAPON_DEFS.pistol;
    this.acquireWeapon(weaponDef.id);
    if (rarityKey === "secret") G.unlockAchievement("secret_crate");
    G.spawnCrateBurst(this.scene, this.yawObject.position.clone(), rarityKey, G.save.settings.graphicsQuality);
    this.pauseForOverlay(true);
    this._onCrateClose = onClose || null;
    G.UI.showCrateScreen(rarityKey, weaponDef);
  },
  closeCrateScreen() {
    G.UI.showScreen(null);
    G.UI.setHudVisible(this.state === "GAMEPLAY");
    this.pauseForOverlay(false);
    const cb = this._onCrateClose;
    this._onCrateClose = null;
    cb && cb();
  },

  tryOpenStaticCrate(crateRef) {
    if (!crateRef || crateRef.opened) return;
    if (crateRef.locked) {
      this.startWordChallenge("ตอบคำศัพท์เพื่อปลดล็อกกล่อง", () => { crateRef.locked = false; this.openStaticCrateNow(crateRef); }, () => {});
    } else this.openStaticCrateNow(crateRef);
  },
  openStaticCrateNow(crateRef) {
    crateRef.opened = true;
    crateRef.mesh.visible = false;
    this.openCrate(G.rollRarity("uncommon"));
  },

  // ---------------- Boss ----------------
  triggerBoss() {
    const pos = this.world.bossRoomCenter.clone();
    const z = this.spawnZombieAt("boss", pos);
    z.setTarget(false);
    this.zombies.forEach((zz) => { if (zz !== z) { this.scene.remove(zz.mesh); } });
    this.zombies = [z];
    const hardWords = G.pickHardWords(this.wordPool, 8);
    G.BossFight.start(z, hardWords, (correct, remaining) => {
      if (correct) {
        this.correctCount++;
        z.hp -= z.maxHp / G.BossFight.totalWords;
        this.player.money += 40;
        this.player.score += 80;
      } else {
        this.wrongCount++;
        this.trackWrongWord(G.BossFight.currentWord ? G.BossFight.currentWord[0] : "?", G.BossFight.currentWord ? G.BossFight.currentWord[1] : "");
        this.player.hp -= 12;
        G.UI.flashDamage();
      }
      if (z.hp <= 0 || remaining <= 0 && correct) { z.hp = 0; z.alive = false; this.onZombieDeath(z); }
    });
  },
  onBossDefeated(z) {
    G.unlockAchievement("first_boss");
    this.player.money += 500;
    this.player.score += 500;
    G.BossFight.stop();
    G.UI.setBossBar(false);
    this.zombies = [];
    this.openCrate(G.rollRarity("rare"), "rare", () => this.afterWaveCleared());
  },

  // ---------------- Wave flow ----------------
  checkWaveClear() {
    if (G.BossFight.active) return;
    if (this.isBossWave()) {
      if (this.spawnedCount === 0 && this.zombies.length === 0 && !this._bossSpawnedThisWave) {
        this._bossSpawnedThisWave = true;
        this.triggerBoss();
      }
      return;
    }
    if (this.spawnedCount >= this.requiredKills && this.zombies.length === 0) this.afterWaveCleared();
  },
  afterWaveCleared() {
    this._bossSpawnedThisWave = false;
    if (this.mode === "campaign" && this.wave >= this.level.waves) { this.onVictory(); return; }
    this.openShop();
  },

  // ---------------- Shop ----------------
  openShop() {
    this.state = "SHOP";
    this.shopTimer = 15;
    G.UI.setHudVisible(false);
    G.Input.exitPointerLock();
    G.UI.renderShop();
    G.UI.showScreen("screen-shop");
  },
  buyShopItem(item, price) {
    if (this.player.money < price) return;
    this.player.money -= price;
    G.Shop.recordPurchase(item.id);
    const curId = this.currentWeaponId();
    switch (item.kind) {
      case "upgrade_damage": if (curId !== "melee") this.player.weaponLevels[curId].dmg *= 1.15; break;
      case "upgrade_firerate": if (curId !== "melee") this.player.weaponLevels[curId].rate *= 1.10; break;
      case "upgrade_mag": if (curId !== "melee") this.player.weaponLevels[curId].mag *= 1.20; break;
      case "refill_ammo": Object.keys(this.player.ammo).forEach((id) => { const a = this.player.ammo[id]; a.mag = Math.round(G.WEAPON_DEFS[id].magSize * this.player.weaponLevels[id].mag); a.reserve += G.WEAPON_DEFS[id].magSize * 4; }); break;
      case "heal": this.player.hp = this.player.maxHp; break;
      case "unlock": this.acquireWeapon(item.weapon); break;
      case "perk_speed": this.player.perks.perk_speed = (this.player.perks.perk_speed || 0) + 1; this.player.moveSpeedMult = 1 + 0.15 * this.player.perks.perk_speed; break;
      case "perk_armor": this.player.perks.perk_armor = (this.player.perks.perk_armor || 0) + 1; this.player.armorPct = Math.min(0.3, 0.1 * this.player.perks.perk_armor); break;
      case "perk_hint": this.player.perks.perk_hint = 1; break;
      case "crate": this.openCrate(G.rollRarity()); break;
    }
  },
  leaveShop() {
    G.persist();
    this.state = "GAMEPLAY";
    G.UI.setHudVisible(true);
    G.UI.applyControlMode();
    G.UI.showScreen(null);
    if (G.Input.mode === "desktop") G.Input.requestPointerLock();
    this.startWave();
  },

  // ---------------- Generic word challenge (doors/crates/traps) ----------------
  startWordChallenge(label, onSuccess, onFail) {
    if (this.challenge) return;
    const pair = G.pick(this.wordPool);
    const allMeanings = G.getAllBuiltinWords().map((p) => p[0]).filter((w) => w !== pair[0]);
    const choices = G.shuffle([pair[0], ...G.shuffle(allMeanings).slice(0, 3)]);
    this.challenge = { pair, choices, timeLeft: 8, timeLimit: 8, onSuccess, onFail };
    G.UI.setChallengeVisible(true, label);
    G.UI.setChallengeMeaning(pair[1]);
    G.UI.setChallengeChoices(choices);
  },
  answerChallenge(idx) {
    if (!this.challenge) return;
    const chosen = this.challenge.choices[idx];
    const correct = chosen === this.challenge.pair[0];
    G.recordWordResult(this.challenge.pair[0], correct);
    const cb = correct ? this.challenge.onSuccess : this.challenge.onFail;
    G.UI.setChallengeVisible(false);
    this.challenge = null;
    if (correct) { this.correctCount++; cb && cb(); } else { this.wrongCount++; this.trackWrongWord(chosen ? this.challenge : "", ""); cb && cb(); }
  },

  // ---------------- Player death / results ----------------
  checkPlayerDeath() { if (this.player.hp <= 0) this.onGameOver(); },
  onGameOver() {
    this.state = "GAME_OVER";
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.setTouchControlsVisible(false);
    const cat = this.mode === "daily" ? "daily" : this.mode === "endless" ? "endless" : "level" + this.level.id;
    G.addLeaderboardEntry(cat, this.player.score);
    if (this.mode === "endless") {
      G.save.endlessHighScore = Math.max(G.save.endlessHighScore, this.player.score);
      G.save.endlessHighWave = Math.max(G.save.endlessHighWave, this.wave);
      if (this.wave >= 10) G.unlockAchievement("endless_10");
    }
    if (this.mode === "daily") G.save.dailyHighScores[G.dailyKey()] = Math.max(G.save.dailyHighScores[G.dailyKey()] || 0, this.player.score);
    if (this.mode === "campaign") G.save.levelHighScores[this.level.id] = Math.max(G.save.levelHighScores[this.level.id] || 0, this.player.score);
    G.persist();
    G.UI.renderResultScreen("lose", { score: this.player.score, wave: this.wave, correct: this.correctCount, wrong: this.wrongCount, money: this.player.money }, this.wrongWordsThisRun);
    G.UI.showScreen("screen-gameover");
  },
  onVictory() {
    this.state = "VICTORY";
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.setTouchControlsVisible(false);
    G.addLeaderboardEntry("level" + this.level.id, this.player.score);
    G.save.levelHighScores[this.level.id] = Math.max(G.save.levelHighScores[this.level.id] || 0, this.player.score);
    const nextId = this.level.id + 1;
    if (G.getLevel(nextId) && !G.save.unlockedLevels.includes(nextId)) G.save.unlockedLevels.push(nextId);
    if (!this.player.wasHitThisLevel) G.unlockAchievement("no_hit_level");
    if (G.LEVELS.every((l) => G.save.levelHighScores[l.id] !== undefined)) G.unlockAchievement("all_levels");
    G.persist();
    G.UI.renderResultScreen("win", { score: this.player.score, wave: this.wave, correct: this.correctCount, wrong: this.wrongCount, money: this.player.money }, this.wrongWordsThisRun);
    G.UI.showScreen("screen-victory");
  },

  // ---------------- Pause ----------------
  pause() {
    if (this.state !== "GAMEPLAY") return;
    this.paused = true; this.state = "PAUSE";
    G.Input.exitPointerLock();
    G.UI.showScreen("screen-pause");
  },
  resume() {
    this.paused = false; this.state = "GAMEPLAY";
    G.UI.showScreen(null);
    if (G.Input.mode === "desktop") G.Input.requestPointerLock();
  },
  pauseForOverlay(v) { this.paused = v; },

  // ---------------- Update loop ----------------
  update(dt) {
    dt *= G.save.settings.gameSpeed;
    if (this.state === "SHOP") {
      this.shopTimer -= dt;
      G.UI.el("shop-timer").textContent = `เริ่มเวฟถัดไปใน ${Math.max(0, Math.ceil(this.shopTimer))} วินาที`;
      G.UI.el("shop-money").textContent = this.player.money;
      if (this.shopTimer <= 0) this.leaveShop();
      return;
    }
    if (this.state !== "GAMEPLAY" || this.paused) return;

    this.updatePlayerMovement(dt);
    this.updateShooting(dt);
    this.updateZombies(dt);
    this.updateDrops(dt);
    this.updateInteractRay();
    this.updateTraps(dt);
    this.updateChallengeTimer(dt);
    this.updateBossUI(dt);

    if (!G.BossFight.active && !this.isBossWave()) {
      G.Spawner.update(dt, this.world, this.zombies.length, this.level.maxAliveZombies, (type, pos) => this.spawnZombieAt(type, pos), this.currentDiff, this.yawObject.position);
    }
    // Must run every frame (not just non-boss frames) so a boss wave with zero
    // regular zombies actually gets a chance to trigger its boss spawn.
    this.checkWaveClear();

    G.UI.updateHud(this.buildHudState());
  },

  buildHudState() {
    const id = this.currentWeaponId();
    const def = this.currentWeaponDef();
    const ammoInMag = id === "melee" ? 0 : this.player.ammo[id].mag;
    const ammoReserve = id === "melee" ? 0 : this.player.ammo[id].reserve;
    const slots = [{ active: this.player.currentSlot === 0 }].concat(this.player.gunSlots.map((_, i) => ({ active: this.player.currentSlot === i + 1 })));
    let meaning = this.targetPair ? this.targetPair[1] : (this.zombies.length ? "-" : "รอศัตรูปรากฏตัว...");
    if (this.player.perks.perk_hint && this.targetPair) meaning += `  (ขึ้นต้นด้วย "${this.targetPair[0][0].toUpperCase()}")`;
    return {
      hp: (this.player.hp / this.player.maxHp) * 100, money: this.player.money, score: this.player.score,
      levelLabel: `${this.level.name} · Wave ${this.wave}${this.mode === "campaign" ? "/" + this.level.waves : ""}`,
      zombiesLeft: this.zombies.length, weaponName: def.name,
      ammoInMag, ammoReserve, currentMeaning: meaning, slots, combo: this.player.combo,
    };
  },

  updatePlayerMovement(dt) {
    // Look
    let dx = 0, dy = 0;
    if (G.Input.mode === "desktop") { const d = G.Input.consumeMouseDelta(); dx = d.x; dy = d.y; }
    else { const d = G.Input.consumeMouseDelta(); dx = d.x; dy = d.y; }
    const gp = G.Input.pollGamepad();
    if (gp) {
      const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
      if (Math.abs(rx) > 0.15) dx += rx * 6;
      if (Math.abs(ry) > 0.15) dy += ry * 6;
    }
    this.yawObject.rotation.y -= dx * 0.0022;
    this.pitchObject.rotation.x -= dy * 0.0022;
    this.pitchObject.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitchObject.rotation.x));

    // Move
    let mx = 0, mz = 0;
    if (G.Input.mode === "desktop") {
      if (G.Input.isDown("forward")) mz -= 1;
      if (G.Input.isDown("back")) mz += 1;
      if (G.Input.isDown("left")) mx -= 1;
      if (G.Input.isDown("right")) mx += 1;
    } else {
      mx = G.Input.touchMove.x; mz = G.Input.touchMove.y;
    }
    if (gp) {
      const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
      if (Math.abs(lx) > 0.15) mx += lx;
      if (Math.abs(ly) > 0.15) mz += ly;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const sprinting = G.Input.mode === "desktop" && G.Input.isDown("sprint");
    const speed = (sprinting ? 5.2 : 3.2) * this.player.moveSpeedMult * dt;
    const forward = new THREE.Vector3(-Math.sin(this.yawObject.rotation.y), 0, -Math.cos(this.yawObject.rotation.y));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const moveVec = new THREE.Vector3()
      .addScaledVector(forward, -mz * speed)
      .addScaledVector(right, mx * speed);
    this.tryMove(moveVec.x, moveVec.z);

    // Jump (cosmetic bob)
    const jumpPressed = (G.Input.mode === "desktop" && G.Input.isDown("jump")) || G.Input.touchJump;
    if (jumpPressed && this.yawObject.position.y <= 1.71 && this.velocityY === 0) this.velocityY = 4.2;
    this.velocityY -= 9.8 * dt;
    this.yawObject.position.y += this.velocityY * dt;
    if (this.yawObject.position.y < 1.7) { this.yawObject.position.y = 1.7; this.velocityY = 0; }

    // weapon bob
    if (this.weaponViewGroup) {
      const bob = (len > 0 ? Math.sin(performance.now() * 0.012) * 0.015 : 0);
      this.weaponViewGroup.position.y = -0.28 + bob;
      if (this.weaponViewGroup.userData.rainbowTrim) this.weaponViewGroup.userData.rainbowTrim.rotation.z += dt * 2.4;
    }

    // fire input
    const wantFire = (G.Input.mode === "desktop" && G.Input.mouseDown) || G.Input.touchFire;
    const def = this.currentWeaponDef();
    if (wantFire && (def.auto || def.id === "melee" || this._fireEdge)) this.fireWeapon();
    this._fireEdge = false;
  },

  tryMove(dx, dz) {
    const pos = this.yawObject.position;
    const radius = 0.35;
    const box = (x, z) => new THREE.Box3(new THREE.Vector3(x - radius, 0.1, z - radius), new THREE.Vector3(x + radius, 2.6, z + radius));
    let blockedX = false, blockedZ = false;
    for (const c of this.world.colliders) {
      if (box(pos.x + dx, pos.z).intersectsBox(c)) blockedX = true;
      if (box(pos.x, pos.z + dz).intersectsBox(c)) blockedZ = true;
    }
    if (!blockedX) pos.x += dx;
    if (!blockedZ) pos.z += dz;
  },

  updateShooting(dt) {
    this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);
    if (this.player.reloading) {
      this.player.reloadTimeLeft -= dt;
      if (this.player.reloadTimeLeft <= 0) {
        this.player.reloading = false;
        const id = this.currentWeaponId();
        if (id !== "melee") {
          const ammo = this.player.ammo[id];
          const lvl = this.player.weaponLevels[id];
          const magSize = Math.round(G.WEAPON_DEFS[id].magSize * lvl.mag);
          const need = Math.min(magSize - ammo.mag, ammo.reserve);
          ammo.mag += need; ammo.reserve -= need;
        }
      }
    }
    if (!this.weaponViewGroup || this._lastWeaponId !== this.currentWeaponId()) {
      this._lastWeaponId = this.currentWeaponId();
      this.buildWeaponViewModel();
    }
  },

  updateZombies(dt) {
    const playerPos = this.yawObject.position;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const dist = z.update(dt, playerPos, G.save.settings.gameSpeed);
      if (dist !== undefined && dist < 1.1 && z.attackCooldown <= 0) {
        z.attackCooldown = 1.0;
        const dmg = z.damage * (1 - this.player.armorPct);
        this.player.hp -= dmg;
        this.player.wasHitThisLevel = true;
        G.UI.flashDamage();
        this.checkPlayerDeath();
      }
    }
  },

  updateDrops(dt) {
    const playerPos = this.yawObject.position;
    for (const d of this.drops.slice()) {
      d.t += dt;
      d.mesh.rotation.y += dt * 2;
      d.mesh.position.y = 0.3 + Math.sin(d.t * 3) * 0.08;
      if (d.mesh.position.distanceTo(playerPos) < 1.0) this.collectDrop(d);
    }
  },

  updateInteractRay() {
    if (!this.world) return;
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(); this.camera.getWorldPosition(origin);
    this.raycaster.set(origin, dir); this.raycaster.far = 3.2;
    this.raycaster.camera = this.camera;
    const targets = this.world.interactables.map((i) => i.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length) {
      let obj = hits[0].object;
      const found = this.world.interactables.find((i) => i.mesh === obj || i.mesh === obj.parent);
      this._lookedAtInteractable = found;
      if (found) {
        let label = "กด E เพื่อโต้ตอบ";
        if (found.kind === "door") label = found.ref.opened ? "" : "กด E เพื่อลองเปิดประตู (ต้องตอบคำศัพท์)";
        if (found.kind === "button") label = found.ref.pressed ? "กดแล้ว" : "กด E เพื่อกดปุ่ม";
        if (found.kind === "crate") label = found.ref.opened ? "" : "กด E เพื่อเปิดกล่อง";
        if (found.kind === "trap") label = "";
        G.UI.setInteractPrompt(!!label, label);
      }
    } else { this._lookedAtInteractable = null; G.UI.setInteractPrompt(false); }
  },
  doInteract() {
    if (this.challenge) return;
    const found = this._lookedAtInteractable;
    if (!found) return;
    if (found.kind === "door") {
      if (found.ref.opened) return;
      this.startWordChallenge("ตอบคำศัพท์เพื่อเปิดประตู", () => { found.ref.opened = true; found.ref.locked = false; found.mesh.visible = false; }, () => {});
    } else if (found.kind === "button") {
      found.ref.pressed = true; found.mesh.material.color.set(0x44ff44);
      this.world.secretZone.unlocked = true;
    } else if (found.kind === "crate") {
      this.tryOpenStaticCrate(found.ref);
    }
  },

  updateTraps(dt) {
    if (!this.world) return;
    for (const t of this.world.traps) {
      t.cooldown -= dt;
      if (t.active && t.cooldown <= 0 && t.mesh.position.distanceTo(this.yawObject.position) < 1.3) {
        t.cooldown = 1.0;
        this.player.hp -= t.damage;
        this.player.wasHitThisLevel = true;
        G.UI.flashDamage();
        this.checkPlayerDeath();
      }
    }
  },

  updateChallengeTimer(dt) {
    if (!this.challenge) return;
    this.challenge.timeLeft -= dt;
    G.UI.setChallengeTimer(this.challenge.timeLeft / this.challenge.timeLimit);
    if (this.challenge.timeLeft <= 0) {
      const cb = this.challenge.onFail;
      G.UI.setChallengeVisible(false);
      this.challenge = null;
      cb && cb();
    }
  },

  updateBossUI(dt) {
    if (!G.BossFight.active) { G.UI.setBossBar(false); return; }
    G.BossFight.update(dt);
    const z = G.BossFight.zombie;
    G.UI.setBossBar(true, "ZOMBIE BOSS", (z.hp / z.maxHp) * 100);
    G.UI.setBossWord(G.BossFight.currentWord ? G.BossFight.currentWord[1] : "");
    G.UI.setBossTimer(G.BossFight.timeLeft / G.BossFight.timeLimit);
    if (G.BossFight.currentWord) {
      if (!this._bossChoices || this._bossChoiceWord !== G.BossFight.currentWord[0]) {
        this._bossChoiceWord = G.BossFight.currentWord[0];
        const distract = G.shuffle(G.getAllBuiltinWords().map((p) => p[0]).filter((w) => w !== G.BossFight.currentWord[0])).slice(0, 3);
        this._bossChoices = G.shuffle([G.BossFight.currentWord[0], ...distract]);
        G.UI.setBossChoices(this._bossChoices);
      }
    }
  },

  answerBossChoice(idx) {
    if (!G.BossFight.active || !this._bossChoices) return;
    const chosen = this._bossChoices[idx];
    G.BossFight.answer(chosen);
    this._bossChoices = null;
  },

  // ---------------- Main loop with FPS cap & delta time ----------------
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const cap = G.save.settings.fpsCap;
    if (cap && cap > 0) {
      const minDelta = 1000 / cap;
      if (t - this.lastFrameTime < minDelta) return;
    }
    const delta = Math.min(0.1, (t - (this.lastFrameTime || t)) / 1000);
    this.lastFrameTime = t;
    this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / Math.max(delta, 0.0001)) * 0.1;
    G.UI.updateFpsCounter(this.fpsSmoothed);

    this.clock.getDelta();
    this.update(delta);

    if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  },
};

// ---------------- Global input event wiring ----------------
G.onKeyDown = function (e) {
  const Game = G.Game;
  if (Game.state === "GAMEPLAY" && G.BossFight.active && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
    Game.answerBossChoice(parseInt(e.code.slice(-1)) - 1);
    return;
  }
  if (Game.state === "GAMEPLAY" && Game.challenge && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
    Game.answerChallenge(parseInt(e.code.slice(-1)) - 1);
    return;
  }
  if (Game.state === "GAMEPLAY") {
    const kb = G.save.settings.keybinds;
    if (e.code === kb.pause) { Game.pause(); return; }
    if (e.code === kb.reload) { Game.reload(); return; }
    if (e.code === kb.interact) { Game.doInteract(); return; }
    if (e.code === kb.melee) { Game.switchSlot(0); return; }
    if (e.code === kb.slot2) { Game.switchSlot(1); return; }
    if (e.code === kb.slot3) { Game.switchSlot(2); return; }
    if (e.code === kb.slot4) { Game.switchSlot(3); return; }
    if (e.code === kb.slot5) { Game.switchSlot(4); return; }
  } else if (Game.state === "PAUSE") {
    if (e.code === G.save.settings.keybinds.pause) Game.resume();
  } else if (Game.state === "MENU" || Game.state === "LEVEL_SELECT") {
    if (e.code === "Escape") Game.quitToMainMenu();
  }
};
G.onKeyUp = function () {};
G.onMouseDown = function (e) {
  const Game = G.Game;
  if (Game.state === "GAMEPLAY" && !Game.paused) Game._fireEdge = true;
};
G.onInteractPress = function () { if (G.Game.state === "GAMEPLAY") G.Game.doInteract(); };
G.onReloadPress = function () { if (G.Game.state === "GAMEPLAY") G.Game.reload(); };

// ---------------- Boot ----------------
window.addEventListener("DOMContentLoaded", () => G.Game.init());
