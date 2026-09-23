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
  aimT: 0, // 0-1 ADS blend (category H)
  baseFov: 75, aimFov: 50,
  stamina: 100, maxStamina: 100, staminaExhausted: false, // category I
  // category E: weapon switch / reload / recoil animation state
  weaponAnim: { switchT: 0, switchDur: 0.42, pendingRebuild: false, reloadT: 0, reloadDur: 0, recoilPos: 0, recoilRot: 0 },
  recoilRecover: 0,
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
      // Phones/tablets start on medium so the first frame isn't a slideshow.
      // matchMedia("pointer: coarse") is what actually catches an iPad --
      // its landscape width is over 1000px, so a width test alone misses it.
      G.save.settings.graphicsQuality = G.isHandheld() ? "medium" : "high";
      G.persist();
    }
    // A touch device should come up already in touch mode rather than waiting
    // for the first tap to switch the control scheme over.
    if (G.isHandheld() && G.save.settings.controlMode === "auto") G.Input.mode = "touch";
    G.Input.init();
    G.UI.init();
    G.TouchCfg.init();
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
    // The body rig hangs off the persistent camera rig, so it is built once
    // here rather than rebuilt with every level.
    G.PlayerBody.build(this.yawObject, this.camera);

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
      if (this.world && this.world.fogBase) this.world.fogBase.far = this.scene.fog.far;
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
      // Was 100/100; all player-facing damage values below (zombie contact,
      // traps, wrong-answer penalties) are scaled by the same 3.75x factor
      // so relative danger (% of max HP per hit) stays exactly as before.
      hp: 375, maxHp: 375, money: 0, score: 0,
      gunSlots: ["pistol"], currentSlot: 1,
      ammo: { pistol: { mag: G.WEAPON_DEFS.pistol.magSize, reserve: G.WEAPON_DEFS.pistol.magSize * 4 } },
      weaponLevels: { pistol: { dmg: 1, rate: 1, mag: 1 } },
      perks: {}, moveSpeedMult: 1, armorPct: 0,
      combo: 0, comboTimer: 0, wasHitThisLevel: false,
      fireCooldown: 0, reloadTimeLeft: 0, reloading: false,
    };
    // Every new run/death starts with pistol + melee only. G.save.unlockedWeapons
    // is a permanent "ever discovered" record used by the Weapon Log (category F)
    // to show stats for weapons you've found before -- it must NOT be used to
    // re-equip those weapons into a fresh run's loadout.
    this.correctCount = 0; this.wrongCount = 0; this.wrongWordsThisRun = {};
    this.totalZombiesKilled = 0; // drives the hospital 2nd-floor unlock (category E3)
    this.dyingZombies = [];
    G.UI._tweenState = null; // reset HUD number tweens so a new run's HUD snaps to 0 instead of counting down from the last run
    this.zombies.forEach((z) => { this.scene.remove(z.mesh); G.disposeObject3D(z.mesh); });
    this.zombies = [];
    this.drops.forEach((d) => { this.scene.remove(d.mesh); G.disposeObject3D(d.mesh); });
    this.drops = [];
    this.targetPair = null;
    this.wave = 0;
    this.aimT = 0;
    this._mysteryHand = null; this._mysteryPick = null;
    this.weaponAnim = { switchT: 0, switchDur: 0.42, pendingRebuild: false, reloadT: 0, reloadDur: 0, recoilPos: 0, recoilRot: 0 };
    this.recoilRecover = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.stamina = this.maxStamina;
    this.staminaExhausted = false;
    G.UI.setAimingVisual && G.UI.setAimingVisual(false);

    G.UI.showScreen(null);
    G.UI.setHudVisible(true);
    G.UI.applyControlMode();
    this.state = "GAMEPLAY";
    this.startWave();
    if (G.Input.mode === "desktop") G.Input.requestPointerLock();
  },


  // ---------------- Touch layout editor backdrop (category B) ----------------
  // Arranging controls against a blank screen is guesswork, so the editor is
  // drawn over the real view. During a run that is simply the paused scene; from
  // the main menu there is nothing loaded, so a throwaway copy of the school is
  // built and torn down again on close.
  startLayoutPreview() {
    if (this.state === "GAMEPLAY" || this.state === "PAUSE") return false;
    this.teardownLevel();
    this._previewLevel = G.getLevel(1);
    this.scene = new THREE.Scene();
    this.scene.add(this.yawObject);
    this.world = G.buildLevelScene(this.scene, this._previewLevel, G.save.settings.graphicsQuality);
    this.yawObject.position.set(this.world.spawn.x, 1.7, this.world.spawn.z);
    this.pitchObject.rotation.x = 0;
    this.yawObject.rotation.y = 0;
    this._layoutPreview = true;
    return true;
  },
  endLayoutPreview() {
    if (!this._layoutPreview) return;
    this._layoutPreview = false;
    this.teardownLevel();
    this.scene = null;
    this.world = null;
    if (this.renderer) this.renderer.clear();
  },
  // Only the preview needs driving by hand -- during a run the main loop is
  // already rendering the (paused) scene every frame.
  renderLayoutPreviewFrame() {
    if (!this._layoutPreview || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  },
  teardownLevel() {
    if (this.scene) {
      this.zombies.forEach((z) => { this.scene.remove(z.mesh); G.disposeObject3D(z.mesh); });
      this.drops.forEach((d) => { this.scene.remove(d.mesh); G.disposeObject3D(d.mesh); });
      // yawObject (camera + weapon view model) is a PERSISTENT rig reused across
      // every run, not level-specific -- it must be detached before disposing
      // the rest of the scene, or its geometry/materials get freed too and the
      // weapon view stays broken until a weapon switch happens to rebuild it.
      if (this.yawObject.parent === this.scene) this.scene.remove(this.yawObject);
      // The static level geometry (walls, floors, props, the whole old Scene)
      // is discarded wholesale on every level start/retry too -- dispose it
      // here rather than leaking it on each transition.
      G.disposeObject3D(this.scene);
    }
    this.zombies = []; this.drops = [];
    this._swingProps = null;
    G.BossFight.stop();
    this.challenge = null;
    G.UI.setChallengeVisible(false);
    G.UI.setBossBar(false);
  },

  startWave() {
    this.wave++;
    this.spawnedCount = 0;
    // Wave-dependent growth is capped (via effWave) so Endless mode's difficulty
    // and per-wave kill quota keep climbing but never runs away: the previous
    // requiredKills formula was `(6+wave*2)*(1+wave*0.05)`, which is quadratic
    // and unbounded -- by wave 30 that's 165 kills, by wave 100 it's 1236,
    // making the mode practically unplayable the longer a run went on. Capping
    // the wave figure fed into both formulas keeps pacing sane indefinitely
    // while `currentDiff` (fast-zombie chance) still has its own clamp downstream.
    const effWave = Math.min(this.wave, 40);
    const diff = this.level.difficulty + (effWave - 1) * 0.18 + (this.mode === "endless" ? (effWave - 1) * 0.05 : 0);
    this.requiredKills = Math.round(6 + effWave * 2);
    G.Spawner.reset(this.level, effWave);
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
    z.speed *= this.waveSpeedMult(); // slower on wave 1 for new players, ramping up on later waves
    this.scene.add(z.mesh);
    this.zombies.push(z);
    this.spawnedCount++;
    this.ensureTargetHasMatch();
    return z;
  },

  // No wave-based speed scaling existed before this -- zombies always moved
  // at their flat G.ZOMBIE_TYPES speed regardless of wave. Wave 1 now starts
  // noticeably slower (65%) so new players can get their bearings, ramping
  // back up to (and slightly past) full speed by wave ~7.
  waveSpeedMult() {
    return Math.min(1.3, 0.65 + (this.wave - 1) * 0.1);
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
    if (this.weaponViewGroup) { this.camera.remove(this.weaponViewGroup); G.disposeObject3D(this.weaponViewGroup); }
    const def = this.currentWeaponDef();
    const mesh = def.id === "melee" ? G.buildMeleeMesh() : G.buildWeaponMesh(def);
    mesh.position.set(0.3, -0.32, -0.75);
    mesh.rotation.y = -0.06; // slight natural inward cant, typical FPS held-weapon angle
    // The weapon builders already extend barrels/muzzles toward local -Z,
    // matching the camera's own forward (-Z) direction -- this extra 180deg
    // flip inverted that, sending the "barrel" toward the camera instead of
    // away from it. That put parts of the gun ~0.19 units from the eye
    // (right up against the 0.1 near-clip plane), which is why it rendered
    // as a huge, indistinct, wrongly-pointed blob instead of a small held gun.
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
    // Animation runs for exactly this weapon's reload time (category E2).
    this.weaponAnim.reloadDur = def.reloadTime / 1000;
    this.weaponAnim.reloadT = this.weaponAnim.reloadDur;
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
    this.recoilKick(def);
    G.spawnShellEject(this.scene, this.camera, G.save.settings.graphicsQuality);

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

  // Category E3: a real kick -- the gun punches back and tilts up, the view
  // itself gets a small punch, and both spring back over the next few frames
  // (the old version nudged the model 6cm for 60ms and that was it). Strength
  // scales with each weapon's own `recoil`, so a Meteor Detention throws the
  // gun far harder than a Scrap Spitter.
  recoilKick(def) {
    const strength = (def && def.recoil) || Math.min(2.2, 0.35 + (def ? def.damage : 20) / 45);
    const a = this.weaponAnim;
    a.recoilPos = Math.min(0.26, a.recoilPos + 0.05 + strength * 0.055);
    a.recoilRot = Math.min(0.5, a.recoilRot + 0.05 + strength * 0.075);
    const kick = strength * 0.013;
    this.pitchObject.rotation.x += kick; // view punches upward...
    this.recoilRecover += kick;          // ...and is pulled back down over the next moments
  },
  updateWeaponAnim(dt) {
    const a = this.weaponAnim;
    // recoil spring
    const springed = Math.exp(-16 * dt);
    a.recoilPos *= springed;
    a.recoilRot *= springed;
    if (a.recoilPos < 0.0005) a.recoilPos = 0;
    if (a.recoilRot < 0.0005) a.recoilRot = 0;
    if (this.recoilRecover > 0) {
      const back = Math.min(this.recoilRecover, this.recoilRecover * 9 * dt + 0.0008);
      this.pitchObject.rotation.x -= back;
      this.recoilRecover -= back;
    }
    // weapon switch: lower the old gun, swap models at the bottom, raise the new one
    if (a.switchT > 0) {
      a.switchT = Math.max(0, a.switchT - dt);
      const p = 1 - a.switchT / a.switchDur;
      if (p >= 0.5 && a.pendingRebuild) { a.pendingRebuild = false; this.buildWeaponViewModel(); }
    }
    // reload: tilt the gun over, drop the spent mag, slap a new one in
    if (a.reloadT > 0) {
      const prev = a.reloadT;
      a.reloadT = Math.max(0, a.reloadT - dt);
      const p = 1 - a.reloadT / a.reloadDur;
      const prevP = 1 - prev / a.reloadDur;
      if (prevP < 0.22 && p >= 0.22) this.dropSpentMagazine();
    }
  },
  switchOffset() {
    const a = this.weaponAnim;
    if (a.switchT <= 0) return 0;
    const p = 1 - a.switchT / a.switchDur;
    return -0.62 * (1 - Math.abs(2 * p - 1)); // down at the swap point, level at both ends
  },
  reloadPose() {
    const a = this.weaponAnim;
    if (a.reloadT <= 0) return null;
    const p = 1 - a.reloadT / a.reloadDur;
    const inT = Math.min(1, p / 0.18);                    // tilt out
    const outT = Math.min(1, Math.max(0, (p - 0.86) / 0.14)); // settle back
    const hold = inT * (1 - outT);
    // sharp jolt as the fresh mag locks home
    const jolt = p > 0.82 && p < 0.92 ? Math.sin((p - 0.82) / 0.1 * Math.PI) * 0.055 : 0;
    return { drop: -0.16 * hold + jolt, roll: -0.55 * hold, pitch: 0.28 * hold };
  },
  dropSpentMagazine() {
    if (!this.weaponViewGroup) return;
    const def = this.currentWeaponDef();
    const magColor = new THREE.Color(def.color || 0x888888).lerp(new THREE.Color(0xffffff), 0.45).getHex();
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.08), new THREE.MeshLambertMaterial({ color: magColor }));
    const start = this.weaponViewGroup.getWorldPosition(new THREE.Vector3());
    mag.position.copy(start);
    this.scene.add(mag);
    const vel = new THREE.Vector3((G.rng() - 0.5) * 0.4, 0.6, (G.rng() - 0.5) * 0.4);
    const spin = new THREE.Vector3(G.rng() * 6, G.rng() * 6, G.rng() * 6);
    const t0 = performance.now();
    const step = () => {
      const el = (performance.now() - t0) / 1000;
      const d = 1 / 60;
      vel.y -= 9.8 * d;
      mag.position.addScaledVector(vel, d);
      mag.rotation.x += spin.x * d; mag.rotation.y += spin.y * d; mag.rotation.z += spin.z * d;
      if (el < 1.4) requestAnimationFrame(step);
      else { this.scene.remove(mag); G.disposeObject3D(mag); }
    };
    requestAnimationFrame(step);
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
    // Was an instant scene.remove() -- vanishing with no transition at all.
    // Now plays a brief "topple over" animation (see updateDyingZombies)
    // before the mesh is actually removed/disposed.
    this.startDeathAnimation(z);
    if (z.type === "boss") { this.onBossDefeated(z); return; }
    this.totalZombiesKilled++;
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
      this.player.hp -= 22; // was 6, scaled 3.75x with player HP
      this.player.wasHitThisLevel = true;
      G.UI.flashDamage();
      this.zombies.forEach((zz) => { if (zz.alive) zz.speedMultiplier = Math.min(2, zz.speedMultiplier + 0.25); });
      this.rollLootDrop(z, false);
    }
    this.zombies = this.zombies.filter((zz) => zz !== z);
    this.checkSecondFloorUnlock();
    this.ensureTargetHasMatch();
    this.checkWaveClear();
    this.checkPlayerDeath();
  },

  startDeathAnimation(z) {
    z.mesh.userData.dying = true;
    z.mesh.userData.deathT = 0;
    z.mesh.userData.fallSign = G.rng() > 0.5 ? 1 : -1;
    z.mesh.userData.fallAxis = G.rng() > 0.5 ? "x" : "z"; // falls forward/back or sideways
    z.mesh.userData.baseY = z.mesh.position.y; // floor height at time of death
    this.dyingZombies = this.dyingZombies || [];
    this.dyingZombies.push(z);
  },
  // Animates zombies that already died (mesh kept around briefly so they
  // topple over instead of vanishing), then actually removes/disposes them.
  updateDyingZombies(dt) {
    if (!this.dyingZombies || !this.dyingZombies.length) return;
    const duration = 0.55;
    for (let i = this.dyingZombies.length - 1; i >= 0; i--) {
      const z = this.dyingZombies[i];
      const u = z.mesh.userData;
      u.deathT += dt;
      const t = Math.min(1, u.deathT / duration);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out: fast at first, settles at the end
      const fallAngle = eased * (Math.PI / 2.1) * u.fallSign;
      if (u.fallAxis === "x") z.mesh.rotation.x = fallAngle;
      else z.mesh.rotation.z = (u.baseLean || 0) + fallAngle;
      z.mesh.position.y = Math.max(0, (u.baseY || 0)) - eased * 0.15; // settle slightly into the floor
      if (t >= 1) {
        this.scene.remove(z.mesh);
        G.disposeObject3D(z.mesh);
        this.dyingZombies.splice(i, 1);
      }
    }
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
    // Anchored to the local floor height (not always 0) so drops on a raised
    // platform or the hospital's 2nd floor don't render sunk into the ground below.
    const baseY = G.getFloorHeightAt(this.world, pos.x, pos.z, pos.y !== undefined ? pos.y : undefined);
    mesh.position.set(pos.x, baseY + 0.3, pos.z);
    this.scene.add(mesh);
    const rarity = kind === "crate" ? G.rollRarity() : null;
    this.drops.push({ kind, mesh, rarity, t: 0, baseY });
  },

  collectDrop(drop) {
    const pickupColors = { money: 0xffdd33, ammo: 0x3388ff, health: 0xff3355, crate: 0xffffff };
    G.spawnHitParticles(this.scene, drop.mesh.position.clone(), pickupColors[drop.kind], G.save.settings.graphicsQuality);
    if (drop.kind !== "crate") G.UI.pulseHudStat(drop.kind); // crate has its own big reveal screen instead
    this.scene.remove(drop.mesh);
    G.disposeObject3D(drop.mesh);
    this.drops = this.drops.filter((d) => d !== drop);
    if (drop.kind === "money") this.player.money += 20 + Math.round(G.rng() * 30);
    else if (drop.kind === "ammo") {
      const id = this.currentWeaponId();
      if (id !== "melee") this.player.ammo[id].reserve += G.WEAPON_DEFS[id].magSize * 2;
    } else if (drop.kind === "health") this.player.hp = Math.min(this.player.maxHp, this.player.hp + 94); // was 25, scaled 3.75x with player HP
    else if (drop.kind === "crate") this.openCrate(drop.rarity);
  },

  openCrate(rarityKey, guaranteedMin, onClose) {
    if (guaranteedMin && G.RARITY_ORDER.indexOf(rarityKey) < G.RARITY_ORDER.indexOf(guaranteedMin)) rarityKey = guaranteedMin;
    const pool = Object.values(G.WEAPON_DEFS).filter((w) => w.rarity === rarityKey && !w.wallExclusive && !w.boxOnly);
    const weaponDef = pool.length ? G.pick(pool) : G.WEAPON_DEFS.pistol;
    this.acquireWeapon(weaponDef.id);
    if (rarityKey === "secret") G.unlockAchievement("secret_crate");
    G.spawnCrateBurst(this.scene, this.yawObject.position.clone(), rarityKey, G.save.settings.graphicsQuality);
    this.pauseForOverlay(true);
    this._onCrateClose = onClose || null;
    G.Input.exitPointerLock();
    G.UI.showCrateScreen(rarityKey, weaponDef);
  },
  closeCrateScreen() {
    G.UI.showScreen(null);
    G.UI.setHudVisible(this.state === "GAMEPLAY");
    this.pauseForOverlay(false);
    const cb = this._onCrateClose;
    this._onCrateClose = null;
    cb && cb();
    if (this.state === "GAMEPLAY" && G.Input.mode === "desktop") G.Input.requestPointerLock();
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
        this.player.hp -= 45; // was 12, scaled 3.75x with player HP
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
    G.Input.exitPointerLock();
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
    if (this.state === "GAMEPLAY" && G.Input.mode === "desktop") G.Input.requestPointerLock();
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
    // A finger still on FIRE/sprint when the pause screen opens never gets its
    // touchend, so clear the held state or it resumes with the trigger stuck.
    G.Input.clearHeldInputs();
    G.UI.applyControlMode();
    G.UI.showScreen("screen-pause");
  },
  resume() {
    this.paused = false; this.state = "GAMEPLAY";
    G.UI.showScreen(null);
    G.UI.applyControlMode();
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
    this.updateDyingZombies(dt);
    this.updateDrops(dt);
    this.updateInteractRay();
    this.updateTraps(dt);
    this.updateRoomDoors(dt);
    this.updateSwingProps(dt);
    G.updateFlickerLights(this.world, performance.now() / 1000, this.yawObject.position);
    G.updateDriftingFog(this.scene, this.world, performance.now() / 1000);
    G.updateSparks(this.scene, this.world, dt);
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
      hp: (this.player.hp / this.player.maxHp) * 100, stamina: (this.stamina / this.maxStamina) * 100,
      staminaExhausted: this.staminaExhausted, money: this.player.money, score: this.player.score,
      levelLabel: `${this.level.name} · Wave ${this.wave}${this.mode === "campaign" ? "/" + this.level.waves : ""}`,
      zombiesLeft: this.zombies.length, weaponName: def.name,
      weightLabel: def.id === "melee" ? null : G.weightClass(def).label,
      weightColor: def.id === "melee" ? null : G.weightClass(def).color,
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
    // Three.js only refreshes matrixWorld during renderer.render()'s traversal,
    // so camera.getWorldDirection()/getWorldPosition() (used by fireWeapon,
    // meleeAttack, and updateInteractRay -- all called later this same frame,
    // before the next render) would otherwise read last frame's orientation.
    // At 60fps that lag is a fraction of a frame and imperceptible, but it's
    // free to close outright rather than rely on render timing.
    this.yawObject.updateMatrixWorld(true);

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
    // Sprint is gated by stamina (category I): held sprint only speeds you up
    // while stamina remains, and only actually drains while you're moving --
    // holding the key while standing still costs nothing.
    const wantSprint = (G.Input.mode === "desktop" && G.Input.isDown("sprint")) || G.Input.touchSprint;
    // A3: at exactly 0 stamina the old check (stamina > 0) flipped back on the
    // very next frame, because the non-sprint branch regenerates -- so holding
    // sprint at empty alternated drain/regen frames and still moved you at
    // roughly sprint speed forever. Now running out latches an exhausted state
    // that only clears once stamina is back above 20%.
    if (this.stamina <= 0) this.staminaExhausted = true;
    else if (this.staminaExhausted && this.stamina >= this.maxStamina * 0.2) this.staminaExhausted = false;
    const sprinting = wantSprint && !this.staminaExhausted && len > 0.05;
    // Category E: what you are carrying slows you down, and tires you faster.
    // A pistol costs nothing; a grenade launcher takes a quarter off your top
    // speed and burns stamina half again as fast.
    const wcls = G.weightClass(this.currentWeaponDef());
    if (sprinting) this.stamina = Math.max(0, this.stamina - 22 * wcls.staminaMult * dt);
    else this.stamina = Math.min(this.maxStamina, this.stamina + 14 * dt);
    const speed = (sprinting ? 5.2 : 3.2) * this.player.moveSpeedMult * wcls.speedMult * dt;
    const forward = new THREE.Vector3(-Math.sin(this.yawObject.rotation.y), 0, -Math.cos(this.yawObject.rotation.y));
    // right = forward rotated -90 deg around Y. (forward.z, 0, -forward.x) was
    // actually pointing left, which swapped A/D: D (mx=+1) moved the player
    // left and A (mx=-1) moved them right. Verified against the concrete case
    // forward=(0,0,-1) (facing the -Z default direction), where world +X is
    // the true "right": (-forward.z, forward.x) = (1,0) as expected.
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const moveVec = new THREE.Vector3()
      .addScaledVector(forward, -mz * speed)
      .addScaledVector(right, mx * speed);
    this.tryMove(moveVec.x, moveVec.z);

    // Jump (cosmetic bob) + floor height (raised platforms/ramps registered
    // as height zones -- see G.getFloorHeightAt in world.js). The engine has
    // no real "standing on geometry" physics, so the player's eye height just
    // tracks whatever height zone they're currently over, on top of jump gravity.
    const baseEyeY = 1.7 + G.getFloorHeightAt(this.world, this.yawObject.position.x, this.yawObject.position.z, this.yawObject.position.y - 1.7);
    const jumpPressed = (G.Input.mode === "desktop" && G.Input.isDown("jump")) || G.Input.touchJump;
    if (jumpPressed && this.yawObject.position.y <= baseEyeY + 0.01 && this.velocityY === 0) this.velocityY = 4.2;
    this.velocityY -= 9.8 * dt;
    this.yawObject.position.y += this.velocityY * dt;
    if (this.yawObject.position.y < baseEyeY) { this.yawObject.position.y = baseEyeY; this.velocityY = 0; }

    // Aim Down Sights (category H): right mouse button held narrows the FOV
    // and pulls the weapon toward center, blended over time (not an instant
    // snap) so it reads as a deliberate aim rather than a jump-cut.
    const def = this.currentWeaponDef();
    const wantAim = G.Input.aimDown && def.id !== "melee" && !this.challenge;
    const aimSpeed = 10;
    this.aimT += ((wantAim ? 1 : 0) - this.aimT) * Math.min(1, aimSpeed * dt);
    if (Math.abs(this.aimT) < 0.002) this.aimT = 0;
    if (Math.abs(this.aimT - 1) < 0.002) this.aimT = 1;
    this.camera.fov = this.baseFov + (this.aimFov - this.baseFov) * this.aimT;
    this.camera.updateProjectionMatrix();
    if (G.UI.setAimingVisual) G.UI.setAimingVisual(this.aimT > 0.5);

    // Weapon view transform: bob + ADS pull-in, then the category-E animation
    // offsets (switch dip, reload tilt, recoil kick) layered on top of it.
    this.updateWeaponAnim(dt);
    // Category D2: where the weapon rides depends on what it weighs. A pistol
    // sits high and central; a launcher hangs low, canted, with the support
    // hand pushed far up the barrel.
    const hold = G.holdPose(def);
    const a = this.weaponAnim;
    const rl = this.reloadPose();
    const gunDrop = this.switchOffset() + (rl ? rl.drop : 0) - hold.sag;
    if (this.weaponViewGroup) {
      const bob = (len > 0 ? Math.sin(performance.now() * 0.012) * 0.015 * (1 - this.aimT * 0.8) : 0);
      this.weaponViewGroup.position.y = hold.y + bob + 0.02 * this.aimT + gunDrop;
      this.weaponViewGroup.position.x = hold.x - (hold.x - 0.04) * this.aimT;
      this.weaponViewGroup.position.z = hold.z + 0.1 * this.aimT + a.recoilPos;
      this.weaponViewGroup.rotation.y = -0.06 * (1 - this.aimT);
      this.weaponViewGroup.rotation.x = hold.rx * (1 - this.aimT) - a.recoilRot + (rl ? rl.pitch : 0);
      this.weaponViewGroup.rotation.z = hold.rz * (1 - this.aimT) + (rl ? rl.roll : 0);
      if (this.weaponViewGroup.userData.rainbowTrim) this.weaponViewGroup.userData.rainbowTrim.rotation.z += dt * 2.4;
    }
    // Category D: the body and arms run off the same animation state as the
    // weapon, so a reload, a swap or a sprint moves all three together.
    G.PlayerBody.update({
      dt, moving: len > 0.05, sprinting, airborne: this.velocityY !== 0,
      aimT: this.aimT, pose: hold, gunDrop, recoilPos: a.recoilPos,
      reload: a.reloadT > 0 ? { p: 1 - a.reloadT / a.reloadDur } : null,
      switchT: a.switchT, switchDur: a.switchDur,
    });

    // fire input (suppressed while a word-challenge popup wants the click for
    // its answer buttons, and while a weapon swap is still in progress)
    const wantFire = !this.challenge && this.weaponAnim.switchT <= 0
      && ((G.Input.mode === "desktop" && G.Input.mouseDown) || G.Input.touchFire);
    if (wantFire && (def.auto || def.id === "melee" || this._fireEdge)) this.fireWeapon();
    this._fireEdge = false;
  },

  tryMove(dx, dz) {
    const pos = this.yawObject.position;
    const radius = 0.35;
    // Collision height range was a fixed [0.1, 2.6] regardless of the
    // player's current floor -- fine while everything was at height 0, but
    // the hospital's 2nd floor (category E3) sits at y=4.2 with real walls
    // up there, and a fixed ground-level test box never overlaps them, so
    // the player could walk straight through them into empty space. Anchor
    // the test range to the current floor height instead.
    const floorY = G.getFloorHeightAt(this.world, pos.x, pos.z, pos.y - 1.7);
    const box = (x, z) => new THREE.Box3(new THREE.Vector3(x - radius, floorY + 0.1, z - radius), new THREE.Vector3(x + radius, floorY + 2.6, z + radius));
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
    // Category E1: a swap no longer snaps the new model in instantly -- the
    // old gun drops out of frame, the model is swapped at the bottom of that
    // dip, and the new one rises into place (firing is locked out until it's
    // finished, see the wantFire gate in updatePlayerMovement).
    if (this._lastWeaponId !== this.currentWeaponId()) {
      const first = !this.weaponViewGroup;
      this._lastWeaponId = this.currentWeaponId();
      if (first) { this.buildWeaponViewModel(); }
      else {
        this.weaponAnim.switchDur = 0.42;
        this.weaponAnim.switchT = this.weaponAnim.switchDur;
        this.weaponAnim.pendingRebuild = true;
        this.weaponAnim.reloadT = 0;
        this.player.reloading = false;
      }
    } else if (!this.weaponViewGroup) {
      this.buildWeaponViewModel();
    }
  },

  updateZombies(dt) {
    const playerPos = this.yawObject.position;
    // Room-level pathfinding: zombies used to beeline straight at the player
    // through solid walls (they never tested world.colliders at all). Now,
    // when a zombie is in a different room/corridor than the player, it walks
    // the waypoint route between them (see G.findPath in world.js) instead of
    // cutting through walls; once it's in the player's own region it goes
    // back to moving directly, same as before.
    const pRegion = G.getRegionAt(this.world, playerPos.x, playerPos.z, playerPos.y - 1.7);
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const zRegion = G.getRegionAt(this.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
      let moveTarget = playerPos;
      if (zRegion !== pRegion) {
        if (!z.navPath || z.navTargetRegion !== pRegion || z.navRegion !== zRegion || z.navRepathTimer === undefined || z.navRepathTimer <= 0) {
          z.navPath = G.findPath(this.world, zRegion, pRegion);
          z.navIndex = 0;
          z.navTargetRegion = pRegion;
          z.navRegion = zRegion;
          z.navRepathTimer = 1.0 + G.rng() * 0.5;
        }
        z.navRepathTimer -= dt;
        if (z.navPath.length && z.navIndex < z.navPath.length) {
          const node = this.world.waypointNodes[z.navPath[z.navIndex]];
          if (Math.hypot(node.x - z.mesh.position.x, node.z - z.mesh.position.z) < 1.3) z.navIndex++;
        }
        if (z.navPath.length && z.navIndex < z.navPath.length) {
          const node = this.world.waypointNodes[z.navPath[z.navIndex]];
          moveTarget = new THREE.Vector3(node.x, 0, node.z);
        }
      } else {
        z.navPath = null;
      }
      const dist = z.update(dt, moveTarget, playerPos, this.world.colliders, G.save.settings.gameSpeed);
      z.mesh.position.y = G.getFloorHeightAt(this.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
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
      d.mesh.position.y = (d.baseY || 0) + 0.3 + Math.sin(d.t * 3) * 0.08;
      // Horizontal-only distance: the player's tracked position is eye height
      // (~1.7+), while drops float near the floor (~0.3), so the old 3D
      // distanceTo() carried a built-in ~1.4-unit vertical gap that alone
      // exceeded the 1.0 pickup radius -- items could never be collected no
      // matter how close the player walked to them.
      const dx = d.mesh.position.x - playerPos.x, dz = d.mesh.position.z - playerPos.z;
      if (Math.hypot(dx, dz) < 1.0) this.collectDrop(d);
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
      // Walk the whole parent chain: interactables are groups now (doors have
      // a panel + handle under a hinge pivot), so a single .parent hop isn't
      // always enough to get back to the registered mesh.
      let obj = hits[0].object, found = null;
      while (obj && !found) { found = this.world.interactables.find((i) => i.mesh === obj); obj = obj.parent; }
      this._lookedAtInteractable = found;
      if (found) {
        let label = "กด E เพื่อโต้ตอบ";
        if (found.kind === "door") label = found.ref.opened ? "" : "กด E เพื่อลองเปิดประตู (ต้องตอบคำศัพท์)";
        if (found.kind === "button") label = found.ref.pressed ? "กดแล้ว" : "กด E เพื่อกดปุ่ม";
        if (found.kind === "crate") label = found.ref.opened ? "" : "กด E เพื่อเปิดกล่อง";
        if (found.kind === "trap") label = found.ref.active ? "กด E เพื่อปิดกับดัก (ต้องตอบคำศัพท์)" : "";
        if (found.kind === "hatch") label = found.ref.opened ? "" : "กด E เพื่อเปิดฝาปิด (ต้องตอบคำศัพท์)";
        if (found.kind === "roomdoor") label = found.ref.open ? "กด E เพื่อปิดประตู" : "กด E เพื่อเปิดประตู";
        if (found.kind === "mysterybox") {
          label = `กด E เพื่อสุ่มปืน ($${G.MYSTERY_BOX_COST})` + (this.player.money < G.MYSTERY_BOX_COST ? " - เงินไม่พอ" : "");
        }
        if (found.kind === "wallweapon") {
          const wdef = G.WEAPON_DEFS[found.ref.id];
          // Weight is part of the buying decision (category E), so it is on
          // the prompt rather than only in the log.
          const wc = G.weightClass(wdef);
          label = found.ref.purchased ? "" : `กด E เพื่อซื้อ ${wdef.name} ($${wdef.price}${this.player.money < wdef.price ? " - เงินไม่พอ" : ""}) · น้ำหนัก${wc.label}`;
        }
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
      this.startWordChallenge("ตอบคำศัพท์เพื่อเปิดประตู", () => this.clearBlockingObstacle(found.ref, "opened"), () => {});
    } else if (found.kind === "trap") {
      if (!found.ref.active) return;
      this.startWordChallenge("ตอบคำศัพท์เพื่อปิดกับดัก", () => this.clearBlockingObstacle(found.ref, "active", false), () => {});
    } else if (found.kind === "hatch") {
      if (found.ref.opened) return;
      this.startWordChallenge("ตอบคำศัพท์เพื่อเปิดฝาปิด", () => this.openHatch(found.ref), () => {});
    } else if (found.kind === "button") {
      found.ref.pressed = true; found.mesh.material.color.set(0x44ff44);
      const sz = this.world.secretZone;
      if (sz && !sz.unlocked) {
        sz.unlocked = true;
        if (sz.barricadeMesh) sz.barricadeMesh.visible = false;
        if (sz.barricadeCollider) {
          const idx = this.world.colliders.indexOf(sz.barricadeCollider);
          if (idx >= 0) this.world.colliders.splice(idx, 1);
        }
      }
    } else if (found.kind === "crate") {
      this.tryOpenStaticCrate(found.ref);
    } else if (found.kind === "wallweapon") {
      this.buyWallWeapon(found.ref);
    } else if (found.kind === "roomdoor") {
      this.toggleRoomDoor(found.ref);
    } else if (found.kind === "mysterybox") {
      this.openMysteryBox();
    }
  },

  // ---------------- Mystery weapon box (category C) ----------------
  openMysteryBox() {
    if (this._mysteryHand) return;
    if (this.player.money < G.MYSTERY_BOX_COST) {
      G.UI.flashPurchaseBanner("เงินไม่พอ",
        `ต้องใช้ $${G.MYSTERY_BOX_COST} · มีอยู่ $${Math.floor(this.player.money)}`);
      return;
    }
    this.player.money -= G.MYSTERY_BOX_COST;
    G.UI.pulseHudStat("money");
    this._mysteryHand = G.rollMysteryHand();
    this._mysteryPick = null;
    // Freeze everything (zombies, timers, player) and hand the mouse back --
    // same overlay pattern the crate/word popups use.
    this.pauseForOverlay(true);
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.showMysteryCards(this._mysteryHand, (idx) => this.pickMysteryCard(idx));
  },
  pickMysteryCard(idx) {
    if (!this._mysteryHand || this._mysteryPick !== null) return;
    this._mysteryPick = idx;
    const picked = this._mysteryHand[idx];
    G.UI.revealMysteryCards(this._mysteryHand, idx);
    G.spawnCrateBurst(this.scene, this.yawObject.position.clone(), picked.rarity, G.save.settings.graphicsQuality);
  },
  confirmMysteryPick() {
    if (!this._mysteryHand || this._mysteryPick === null) return;
    const picked = this._mysteryHand[this._mysteryPick];
    this._mysteryHand = null; this._mysteryPick = null;
    this.acquireWeapon(picked.id);
    if (this.world.mysteryBox) this.world.mysteryBox.uses++;
    G.UI.showScreen(null);
    G.UI.setHudVisible(true);
    this.pauseForOverlay(false);
    if (this.state === "GAMEPLAY" && G.Input.mode === "desktop") G.Input.requestPointerLock();
  },

  // ---------------- Room doors (category B) ----------------
  toggleRoomDoor(ref, forceOpen) {
    const willOpen = forceOpen === undefined ? !ref.open : forceOpen;
    if (willOpen === ref.open && ref.animT >= 1) return;
    ref.open = willOpen;
    ref.bashTimer = 0;
    // Category F: the blocking box now follows the panel through its swing
    // rather than being yanked out the instant the door is TOLD to open. A
    // door that is still half shut still blocks; a door that is still closing
    // blocks progressively more. It is only dropped once the panel is fully
    // clear of the doorway, and comes straight back the moment a close starts.
    if (this.world.colliders.indexOf(ref.collider) < 0) this.world.colliders.push(ref.collider);
    ref.colliderDropped = false;
    ref.shakeT = 0;
    // A door nobody has touched since the outbreak coughs dust off its frame.
    if (!ref.dusted) {
      ref.dusted = true;
      G.spawnDustPuff(this.scene, new THREE.Vector3(ref.x, (ref.baseY || 0) + 1.5, ref.z), G.save.settings.graphicsQuality, 1.4);
    }
    // The swing is stepped by updateRoomDoors from the game loop's own dt.
    // A requestAnimationFrame chain would keep running while the game is
    // paused and, worse, stall out entirely if the tab is backgrounded --
    // which left the door stuck half-open and un-interactable.
    ref.fromRot = ref.mesh.rotation.y;
    ref.toRot = willOpen ? (ref.axis === "x" ? -Math.PI / 2 : Math.PI / 2) : 0;
    ref.animT = 0;
  },
  // A closed door blocks zombies too, so one held up against it leans on it
  // until it gives way -- without this, shutting every door would strand a
  // wave's remaining zombies and the level could never be cleared.
  updateRoomDoors(dt) {
    const doors = this.world.roomDoors;
    if (!doors || !doors.length) return;
    for (const d of doors) {
      if (d.animT < 1) {
        d.animT = Math.min(1, d.animT + dt / 0.38);
        // Ease out hard: the panel leaves fast and arrives slowly, the way a
        // door someone shoved actually moves.
        const e = 1 - Math.pow(1 - d.animT, 3);
        d.mesh.rotation.y = d.fromRot + (d.toRot - d.fromRot) * e;
        if (d.animT >= 1) d.shakeT = 0.24;          // hits the end of its travel
        this.syncDoorCollider(d);
      } else if (d.shakeT > 0) {
        // A damped judder as the panel slams against the stop / the frame.
        d.shakeT = Math.max(0, d.shakeT - dt);
        const k = d.shakeT / 0.24;
        d.mesh.rotation.y = d.toRot + Math.sin(d.shakeT * 62) * 0.06 * k * k;
        if (d.shakeT <= 0) d.mesh.rotation.y = d.toRot;
        this.syncDoorCollider(d);
      } else if (d.open && !d.colliderDropped) {
        // fully open and settled -- now the doorway is genuinely clear
        const i = this.world.colliders.indexOf(d.collider);
        if (i >= 0) this.world.colliders.splice(i, 1);
        d.colliderDropped = true;
      }
      if (d.open) continue;
      let pressed = false;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        if (Math.hypot(z.mesh.position.x - d.x, z.mesh.position.z - d.z) < 1.6) { pressed = true; break; }
      }
      if (!pressed) { d.bashTimer = 0; continue; }
      d.bashTimer += dt;
      // shudder while being pushed on, so it reads as under attack
      d.mesh.rotation.y = Math.sin(d.bashTimer * 22) * 0.05;
      this.syncDoorCollider(d);
      if (d.bashTimer >= 2.0) { d.mesh.rotation.y = 0; this.toggleRoomDoor(d, true); }
    }
  },

  // The blocking box is the panel's own world AABB, recomputed as it swings.
  // A fixed box either blocks a door that is already open, or lets you walk
  // through one that is still closing.
  syncDoorCollider(d) {
    if (d.colliderDropped || this.world.colliders.indexOf(d.collider) < 0) return;
    d.mesh.updateMatrixWorld(true);
    d.collider.setFromObject(d.mesh);
    // Keep it full doorway height: the AABB of a thin panel is thin, and a
    // short box would let the player's body test slip over the top of it.
    d.collider.min.y = d.baseY || 0;
    d.collider.max.y = (d.baseY || 0) + 2.9;
  },

  buyWallWeapon(ref) {
    if (ref.purchased || this.player.money < ref.price) return;
    this.player.money -= ref.price;
    ref.purchased = true;
    this.acquireWeapon(ref.id);
    G.spawnCrateBurst(this.scene, ref.gunMesh.getWorldPosition(new THREE.Vector3()), "secret", G.save.settings.graphicsQuality);
    G.UI.pulseHudStat("money");
    G.UI.flashPurchaseBanner(G.WEAPON_DEFS[ref.id].name);
  },

  // Hides an obstacle's mesh AND removes its collider (doors/traps previously
  // only hid the mesh on "opened"/solved, leaving an invisible wall in place
  // that still fully blocked movement).
  clearBlockingObstacle(ref, flagProp, flagValue) {
    ref[flagProp] = flagValue === undefined ? true : flagValue;
    if (ref.locked !== undefined) ref.locked = false;
    if (ref.collider) {
      const idx = this.world.colliders.indexOf(ref.collider);
      if (idx >= 0) this.world.colliders.splice(idx, 1);
    }
    // Used to just be mesh.visible=false (an instant cut). Swings the mesh
    // open on its own Y axis over real elapsed time (not tied to the game's
    // own dt/FPS cap, since this is a short transient world effect) and
    // hides it once the swing finishes.
    this.animateObstacleOpen(ref.mesh);
  },
  // Category F: word-locked doors get the same treatment as the room doors --
  // hinged on an edge rather than spun about their middle, eased round, a
  // judder as they hit the stop, and dust knocked off a frame nothing has
  // touched in a long time. The hinge is derived from the mesh's own box, so
  // this needs no per-level setup and works for any panel.
  animateObstacleOpen(mesh) {
    if (!mesh) return;
    const gp = (mesh.geometry && mesh.geometry.parameters) || { width: 0.3, depth: 2.8 };
    const alongZ = (gp.depth || 0) >= (gp.width || 0);
    const halfLen = (alongZ ? gp.depth : gp.width) / 2;
    const c0 = mesh.position.clone();
    const hinge = alongZ ? new THREE.Vector3(c0.x, c0.y, c0.z - halfLen)
      : new THREE.Vector3(c0.x - halfLen, c0.y, c0.z);
    const rel = c0.clone().sub(hinge);
    const startRot = mesh.rotation.y;
    const targetRot = startRot + Math.PI / 2.05;
    G.spawnDustPuff(this.scene, c0, G.save.settings.graphicsQuality, Math.max(1.0, halfLen * 1.4));
    // Stepped from the game loop's dt, not requestAnimationFrame. An rAF chain
    // stops dead when the tab is backgrounded, and this one left the door
    // sitting closed-looking while its collider had already been removed.
    this._swingProps = this._swingProps || [];
    this._swingProps.push({ mesh, hinge, rel, startRot, targetRot, y: c0.y, t: 0 });
  },
  updateSwingProps(dt) {
    const list = this._swingProps;
    if (!list || !list.length) return;
    const SWING = 0.48, SHAKE = 0.24;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.t += dt;
      let rot;
      if (s.t < SWING) {
        const p = s.t / SWING;
        rot = s.startRot + (s.targetRot - s.startRot) * (1 - Math.pow(1 - p, 3));
      } else {
        const k = Math.max(0, 1 - (s.t - SWING) / SHAKE);
        rot = s.targetRot + Math.sin((s.t - SWING) * 55) * 0.07 * k * k;
      }
      s.mesh.rotation.y = rot;
      const d = rot - s.startRot, si = Math.sin(d), co = Math.cos(d);
      s.mesh.position.set(s.hinge.x + s.rel.x * co + s.rel.z * si, s.y, s.hinge.z - s.rel.x * si + s.rel.z * co);
      if (s.t >= SWING + SHAKE) { s.mesh.rotation.y = s.targetRot; list.splice(i, 1); }
    }
  },

  // Floor hatches (layout redesign item 5): a word-locked panel that hinges
  // open flat on the ground (rotates around X, not Y like a door) and spawns
  // a bonus item where it sat -- same interaction pattern as the existing
  // word-locked door/trap, just revealing loot instead of a passage.
  openHatch(ref) {
    ref.opened = true;
    const pos = ref.mesh.position.clone();
    this.animateHatchOpen(ref.mesh);
    setTimeout(() => this.spawnDrop(ref.dropKind || "crate", pos), 350);
  },
  animateHatchOpen(mesh) {
    const startRot = mesh.rotation.x;
    const targetRot = startRot - Math.PI / 1.7;
    const durationMs = 420;
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / durationMs);
      mesh.rotation.x = startRot + (targetRot - startRot) * (1 - Math.pow(1 - p, 2));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  // Hospital 2nd floor (category E3): unlocks once the player has at least
  // one correct answer AND 20+ total zombie kills this run.
  checkSecondFloorUnlock() {
    const sf = this.world.secondFloor;
    if (!sf || sf.unlocked) return;
    if (this.correctCount < 1) return;
    // School's 2nd floor (category E, this round) only counts kills that came
    // from answering the target word correctly -- Hospital's earlier design
    // counts any kill, so this stays per-level rather than a global rule change.
    const killTally = sf.countMode === "correct" ? this.correctCount : this.totalZombiesKilled;
    if (killTally < sf.killsNeeded) return;
    sf.unlocked = true;
    sf.barrierMesh.visible = false;
    const idx = this.world.colliders.indexOf(sf.barrierCollider);
    if (idx >= 0) this.world.colliders.splice(idx, 1);
    sf.cratePositions.forEach((p) => this.spawnDrop("crate", p));
    G.UI.flashPurchaseBanner("ชั้น 2 ปลดล็อกแล้ว!", `ฆ่าซอมบี้ครบ ${sf.killsNeeded} ตัว`);
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
      if (this.state === "GAMEPLAY" && G.Input.mode === "desktop") G.Input.requestPointerLock();
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
// A single trigger-pull edge, shared by the mouse and the touch FIRE button.
G.onFirePress = function () {
  const Game = G.Game;
  if (Game.state === "GAMEPLAY" && !Game.paused && !Game.challenge) Game._fireEdge = true;
};
G.onMouseDown = function (e) {
  // Left button only -- right-click is ADS, and letting it through meant
  // aiming also loosed a shot from every semi-automatic weapon.
  if (e.button === 0) G.onFirePress();
};
G.onInteractPress = function () { if (G.Game.state === "GAMEPLAY") G.Game.doInteract(); };
G.onSlotPress = function (slot) { if (G.Game.state === "GAMEPLAY") G.Game.switchSlot(slot); };
G.onPausePress = function () {
  const Game = G.Game;
  if (Game.state === "GAMEPLAY") Game.pause();
  else if (Game.state === "PAUSE") Game.resume();
};
G.onReloadPress = function () { if (G.Game.state === "GAMEPLAY") G.Game.reload(); };

// ---------------- Boot ----------------
window.addEventListener("DOMContentLoaded", () => G.Game.init());
