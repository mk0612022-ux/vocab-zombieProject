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
  floorGuns: [],          // guns lying on the floor waiting to be picked up (G.Loadout)
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
  weaponAnim: { switchT: 0, switchDur: 0.42, pendingRebuild: false, recoilPos: 0, recoilRot: 0 },
  reloadState: null, // the reload routine in progress: { id, plan, t, next } (see reload())
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
    // (round 3, H) the word lists in the Word and Meaning Language chosen;
    // the menus in the UI language (js/strings.js read it from the save early)
    G.Lang.apply();
    if (G.setUILang && G.save.settings.uiLang !== G.lang) G.setUILang(G.save.settings.uiLang, { quiet: true });
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
    G.Audio.init();
    G.UI.init();
    if (G.PWA) G.PWA.init();
    G.TouchCfg.init();
    // (new series, round 2, F) the screen-edge margin the player set
    if (G.applySafeArea) G.applySafeArea();
    G.Shop.resetRun();
    this.setupThree();
    // (new series, round 1, C2) the boot screen stays until the update check is done too
    if (G.Updater) G.Updater.gameReady(); else document.getElementById("loading-overlay").classList.add("hidden");
    G.UI.showScreen("screen-mainmenu");
    G.UI.el("hud-fps-counter").classList.toggle("hidden", !G.save.settings.showFpsCounter);
    requestAnimationFrame((t) => this.loop(t));
  },

  setupThree() {
    const canvas = document.getElementById("gameCanvas");
    const q = G.save.settings.graphicsQuality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q === "high" || q === "vhigh" });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = q === "high" || q === "vhigh";
    // (visual series) the frame's film, the shared shader values, the zombies' material
    if (G.Visuals) G.Visuals.init(this);
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
    // The gun and arms are drawn in a pass of their own, over the finished
    // frame with the depth buffer cleared, by a camera that sees only them
    // (layer 1) and whose near plane is twice as close (0.05; no part of any
    // gun or arm comes nearer than 0.17 in any pose, recoil included, so it
    // keeps the depth precision the parts need). In the one scene
    // with the world, the sprint carry swung parts of some guns through the
    // 0.1 near plane (slivers at the edge of the view), and a gun held up to
    // a wall went into it.
    this.vmCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 20);
    this.vmCamera.layers.set(1);
    this.renderer.info.autoReset = false;          // two passes a frame: count both
    if (G.PlayerBody.armRig) {
      this.toViewmodelLayer(G.PlayerBody.armRig.group);
      // where a sleeve crosses the gun at a shallow angle the two surfaces are
      // at nearly the same depth and fought over a thin line of pixels; a
      // small depth bias lets the gun win there every time
      G.PlayerBody.armRig.group.traverse((o) => { if (o.isMesh) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = 1; o.material.polygonOffsetUnits = 4; } });
    }

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (G.Minimap) G.Minimap.resize();
    });

    document.getElementById("gameCanvas").addEventListener("click", () => {
      // not while a window is open: that click was for the window
      if (this.state === "GAMEPLAY" && !this.paused && !G.Modal.isOpen() && G.Input.mode === "desktop") G.Input.requestPointerLock();
    });
  },

  // the 3D view's pixels per screen pixel: the quality's cap on the screen's
  // own, times (new series, round 2, F) the Render Resolution setting
  pixelRatio() {
    const s = G.save.settings, q = s.graphicsQuality;
    const base = Math.min(window.devicePixelRatio, q === "vhigh" ? 2 : q === "high" ? 1.5 : 1);
    return Math.max(0.25, base * (Number(s.renderScale) || 1));
  },
  applyGraphicsQuality() {
    const q = G.save.settings.graphicsQuality;
    // (the touch buttons' frosted glass blurs what is behind it every frame:
    // not on the two lowest settings)
    document.body.classList.toggle("fx-low", q === "vlow" || q === "low");
    if (!G.Visuals) this.renderer.shadowMap.enabled = q === "high" || q === "vhigh";
    this.renderer.setPixelRatio(this.pixelRatio());
    if (this.scene && this.scene.fog && this.level) {
      const pal = G.THEME_PALETTES[this.level.theme];
      this.scene.fog.far = G.Visuals ? G.Visuals.fogFar(pal, q) : q === "vlow" ? pal.fogFar * 0.5 : q === "low" ? pal.fogFar * 0.7 : pal.fogFar;
      if (this.world && this.world.fogBase) this.world.fogBase.far = this.scene.fog.far;
      G.Perf.resizePool(this.scene, q);
      this.syncViewmodelLights();
      if (this.world.dressDetails && G.SchoolDress) G.SchoolDress.applyQuality(this.world, q);
      if (G.Details) G.Details.applyQuality(q);
      if (G.Sky) G.Sky.applyQuality(q);
      if (G.Glass) G.Glass.applyQuality(q);
      if (G.SchoolWear) G.SchoolWear.applyQuality(this, q);
      // (visual series: shadows, cascades, the light pool, the grain on stone)
      if (G.Visuals) G.Visuals.applyQuality(this, q);
    }
  },

  // ---------------- Top-level navigation ----------------
  // (round 4) the levels are cards in the lobby now: back to it with the
  // campaign tab showing and the furthest level unlocked picked
  goToLevelSelect() {
    const next = Math.max.apply(null, G.save.unlockedLevels);
    const pick = { 1: "school", 2: "hospital", 3: "bunker" }[next] || "school";
    if (this.world) this.quitToMainMenu();
    G.UI.goToMainMenu({ tab: "campaign", select: pick });
    this.state = "MENU";
  },
  // (vocabulary series, round 4: Practice Mode is js/practice.js)
  goToPracticeSetup() { G.Practice.open("screen-mainmenu"); },

  quitToMainMenu() {
    this.teardownLevel();
    G.Modal.reset();
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.setTouchControlsVisible(false);
    // (the state first: the lobby coming up checks it -- e.g. to offer a new
    // version of the game found during the run)
    this.state = "MENU";
    G.UI.goToMainMenu();
  },


  // ---------------- Run lifecycle ----------------
  // (vocabulary series, round 2) every run has its learning rules -- the
  // clue and the answer for each word (js/learnmodes.js). The campaign,
  // Endless and the Daily Challenge are Classic: the Thai meaning, shot.
  // (vocabulary series, round 4, J2) the campaign is played in the Learning
  // Style picked before the level (G.save.settings.campaignStyle: Adaptive
  // by default, Classic, or a clue x answer of the player's own)
  startLevel(id) {
    this.mode = "campaign";
    this.level = G.getLevel(id);
    this.wordPool = G.WORD_SETS[this.level.wordsKey].words;
    this.learn = this.campaignRules();
    this.beginRun();
  },
  campaignRules() { return G.Learn.run(G.save.settings.campaignStyle || "adaptive", this.wordPool); },
  startDailyChallenge() {
    this.mode = "daily";
    this.level = Object.assign({}, G.getLevel(1), { waves: 5, name: G.T("level.daily") });
    this.wordPool = G.getDailyWordSet();
    this.learn = G.Learn.run("classic");
    this.beginRun();
  },
  startEndless() {
    this.mode = "endless";
    this.level = Object.assign({}, G.getLevel(3), { waves: 999999, name: G.T("level.endless") });
    this.wordPool = G.getAllBuiltinWords();
    this.learn = G.Learn.run("classic");
    this.beginRun();
  },
  // Daily Review and the learning modes (js/study.js): a short session on
  // the school's grounds with a fixed list of words
  startStudy(session) {
    this.mode = "study";
    this.study = session;
    this.level = Object.assign({}, G.getLevel(session.levelId || 1), { waves: 1, name: session.title });
    this.wordPool = session.pool || session.cards.slice();
    this.learn = G.Learn.run(session.preset, session.cards);
    this.beginRun();
  },
  retry() {
    if (this.mode === "campaign") this.newRun(this.level.id);
    else if (this.mode === "daily") this.startDailyChallenge();
    else this.startEndless();
  },
  // (J3, round 3) a campaign level from wave 1 when it has a checkpoint:
  // that deletes the checkpoint, so it asks first
  newRun(id) {
    if (G.Checkpoint && G.Checkpoint.has(id)) { G.Checkpoint.confirmDelete(id, () => this.startLevel(id)); return; }
    this.startLevel(id);
  },
  // ...or back to the checkpoint: wave 11, as it was kept (as often as wanted)
  continueFromCheckpoint(id) {
    const cp = G.Checkpoint && G.Checkpoint.get(id);
    if (!cp) { this.startLevel(id); return; }
    cp.continues = (cp.continues || 0) + 1;
    G.persist();
    this.mode = "campaign";
    this.level = G.getLevel(id);
    this.wordPool = G.WORD_SETS[this.level.wordsKey].words;
    this.learn = this.campaignRules();
    this._restoring = JSON.parse(JSON.stringify(cp));
    this.beginRun();
  },

  beginRun() {
    // (J, round 3) a checkpoint being continued: the level is built as for
    // any run, then the saved state is laid over it just before wave 11
    const restoring = this._restoring || null;
    this._restoring = null;
    G.Shop.resetRun();
    this.teardownLevel();
    G.Bosses.resetRun();                             // no boss met yet this run
    G.Abilities.resetRun();                          // no ability yet either (round 3, H)
    this.scene = new THREE.Scene();
    this.scene.add(this.yawObject);
    this.world = G.buildLevelScene(this.scene, this.level, G.save.settings.graphicsQuality);
    // Round 3: the story notes for this run, and the small moving details
    // (falling leaves, paper in the wind, crows, puddles, curtains, light
    // shafts) -- before the merge, which leaves them alone
    this.notesReadRun = new Set();
    this._notesRevealed = false;
    if (!this.learn) this.learn = G.Learn.run("classic");
    if (this.mode !== "study") this.study = null;
    // (a continued run does not lay out again the notes it has already read;
    // a study session has none)
    if (G.Notes && this.mode !== "study") G.Notes.place(this, restoring ? restoring.notesRead : null);
    if (G.Details) G.Details.build(this);
    if (G.Sky) G.Sky.build(this);                 // the moon, its light and its beams
    if (G.Glass) G.Glass.build(this);             // the panes in the real windows
    this.prepareScene();
    if (G.Minimap) G.Minimap.init(this);
    this.yawObject.position.set(this.world.spawn.x, 1.7, this.world.spawn.z);
    this.pitchObject.rotation.x = 0;
    this.yawObject.rotation.y = 0;

    this.player = {
      // Was 100/100; all player-facing damage values below (zombie contact,
      // traps, wrong-answer penalties) are scaled by the same 3.75x factor
      // so relative danger (% of max HP per hit) stays exactly as before.
      // Category P raised it to 450 without touching the damage: in the
      // playtest, four of ten new-player runs were bitten to death by wave 2
      // (12-15 bites) at 375. Now a normal zombie's bite is 6.7% rather than 8%.
      hp: G.CONFIG.player.maxHp, maxHp: G.CONFIG.player.maxHp, money: 0, score: 0,   // (js/config.js)
      gunSlots: ["pistol"], currentSlot: 1,
      ammo: { pistol: { mag: G.WEAPON_DEFS.pistol.magSize, reserve: G.WEAPON_DEFS.pistol.magSize * 4 } },
      weaponLevels: { pistol: { dmg: 1, rate: 1, mag: 1 } },
      // perks ({id: level}, see js/perks.js) belong to the run, like the money
      perks: {}, moveSpeedMult: 1, armorPct: 0, comboShield: null, secondLifeUsed: false,
      combo: 0, comboTimer: 0, wasHitThisLevel: false,
      fireCooldown: 0, reloading: false,
    };
    G.PerkBag.reset();
    G.Loadout.pending = null;
    this._perkOffer = [];
    this._slowmoT = 0; this._adrenalineT = 0;
    this._crateWeapon = null; this._crateOpts = null;
    // Every new run/death starts with pistol + melee only. G.save.unlockedWeapons
    // is a permanent "ever discovered" record used by the Weapon Log (category F)
    // to show stats for weapons you've found before -- it must NOT be used to
    // re-equip those weapons into a fresh run's loadout.
    this.correctCount = 0; this.wrongCount = 0; this.wrongWordsThisRun = {};
    this.totalZombiesKilled = 0; // drives the hospital 2nd-floor unlock (category E3)
    this.correctKills = 0;       // zombies shot on the right word (round 3: the third floor wants 50)
    this._continues = 0;         // times this run came back from its checkpoint (J4)
    if (G.Floor3) G.Floor3.reset(this);
    G.UI._tweenState = null; // reset HUD number tweens so a new run's HUD snaps to 0 instead of counting down from the last run
    this.zombies.forEach((z) => { this.scene.remove(z.mesh); G.disposeObject3D(z.mesh); });
    this.zombies = [];
    this.drops.forEach((d) => { this.scene.remove(d.mesh); G.disposeObject3D(d.mesh); });
    this.drops = [];
    this.floorGuns = [];
    this.targetPair = null;
    this.wave = 0;
    this.aimT = 0;
    // Nothing used to clear `paused` on the way into a run, so Pause -> Main
    // Menu -> any level loaded a frozen game (and quitting from behind a
    // crate or mystery-box screen did the same). Found by the category P
    // playtest bot, whose second run never moved.
    G.Modal.reset();
    this.paused = false;
    this._onCrateClose = null; this._burst = null; this._chargeT = 0;
    this.bossSlow = 1; this.bossRootT = 0; this.bossSedateT = 0; this._shakeT = 0; this._shakeA = 0; this._checkpointDue = false; this._quizDue = false;
    this._mysteryHand = null; this._mysteryPick = null;
    this.weaponAnim = { switchT: 0, switchDur: 0.42, pendingRebuild: false, recoilPos: 0, recoilRot: 0 };
    this.reloadState = null;
    this._prevPos = null; this._prevYaw = undefined; this._prevPitch = undefined;
    this._sprintLatch = false; this._prevSprintHeld = false;
    G.ViewModel.reset();
    G.HeadBob.reset(this);
    this.recoilRecover = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.stamina = this.maxStamina;
    this.staminaExhausted = false;
    G.UI.setAimingVisual && G.UI.setAimingVisual(false);

    G.UI.showScreen(null);
    G.UI.setHudVisible(true);
    // (the state first: the touch controls only show in GAMEPLAY, and were
    // left hidden at the start of every run until the screen was touched again)
    this.state = "GAMEPLAY";
    G.UI.applyControlMode();
    // category I: campaign levels are cleared by their objectives, not just
    // by outlasting the last wave
    this._finalWaveCleared = false;
    this._overtimeAnnounced = false;
    this._winNow = false; this._waveBonus = 0;
    if (this.mode === "campaign") G.Objectives.reset(this.level.id, this.world); else G.Objectives.state = null;
    G.Audio.startLevel(this.level.theme);
    this._stepT = 0; this._hbT = 0; this._behindT = 0; this._wasExhausted = false;
    G.Tutorial.startRun(this);
    // (vocabulary series, round 2) the answer being given for the current
    // target, the typing controls, the money-free HUD of a study session
    this._attempt = null;
    if (G.SpellReload) G.SpellReload.reset();
    if (G.Spell) G.Spell.start(this);
    document.body.classList.toggle("study-run", this.mode === "study");
    if (this.mode === "study" && G.Study) G.Study.beginRun(this);
    if (restoring) G.Checkpoint.apply(this, restoring);   // wave 10's state: the next wave is 11
    this.startWave();
    if (G.Input.mode === "desktop") G.Input.requestPointerLock();
  },


  // ---------------- Touch layout editor backdrop (category B) ----------------
  // Arranging controls against a blank screen is guesswork, so the editor is
  // drawn over the real view. During a run that is simply the paused scene; from
  // the main menu there is nothing loaded, so a throwaway copy of the school is
  // built and torn down again on close.
  // Category K: bake the static level into a few merged meshes and swap its
  // fifty-odd lights for a small fixed pool. Round 3 sorts it first by what
  // can see it (js/zones.js), so far storeys and the campus behind the walls
  // are simply not drawn. Then every shader is compiled now, during the load,
  // instead of as a hitch the first time each material comes into view.
  prepareScene() {
    // (visual series: big boxes cut into pieces, for the corners' AO)
    if (G.Visuals) G.Visuals.beforeBake(this);
    this.paletteCount = G.Perf.paletteize(this.scene, this.world, [this.yawObject]);
    if (G.Zones) G.Zones.prepare(this.world);
    this.perfReport = G.Perf.mergeStatic(this.scene, this.world, [this.yawObject]);
    if (G.Sky) G.Sky.afterPrepare(this);          // what casts moon shadows
    if (G.SchoolWear) G.SchoolWear.applyQuality(this, G.save.settings.graphicsQuality);   // the marks' tiers
    if (G.Zones) G.Zones.init(this);
    G.Perf.initLightPool(this.scene, this.world, G.save.settings.graphicsQuality);
    this.syncViewmodelLights();
    // (visual series: the baked surfaces' materials, the night-sky reflection,
    // the level's lights, fog and shadows)
    if (G.Visuals) G.Visuals.afterBake(this);
    this.scene.updateMatrixWorld(true);
    try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* best effort */ }
    if (G.Visuals) G.Visuals.afterCompile(this);
  },
  startLayoutPreview() {
    if (this.state === "GAMEPLAY" || this.state === "PAUSE") return false;
    this.teardownLevel();
    this._previewLevel = G.getLevel(1);
    this.scene = new THREE.Scene();
    this.scene.add(this.yawObject);
    this.world = G.buildLevelScene(this.scene, this._previewLevel, G.save.settings.graphicsQuality);
    // (the same baking as a run: since round 3 the raw school is thousands of
    // meshes and dozens of lights, and drawn unbaked it froze the page)
    if (G.Sky) G.Sky.build(this);
    if (G.Glass) G.Glass.build(this);
    this.prepareScene();
    this.yawObject.position.set(this.world.spawn.x, 1.7, this.world.spawn.z);
    this.pitchObject.rotation.x = 0;
    this.yawObject.rotation.y = 0;
    if (G.Zones) G.Zones.update(this, true);
    G.Perf.updateLights(this.yawObject.position, new THREE.Vector3(0, 0, -1), 0);
    if (G.Sky) G.Sky.update(this, 0);
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
    this.renderFrame();
  },
  teardownLevel() {
    if (G.Audio) G.Audio.stopLevel();
    if (G.ViewModel) G.ViewModel.clearProps();
    // pooled objects live in the scene; take them out before it is disposed
    if (G.Perf) { G.Perf.resetPools(); G.Perf.disposeLightPool(this.scene); }
    if (G.ZombieFX) G.ZombieFX.reset(this.scene);
    if (G.Aim) G.Aim.reset();
    if (G.Zones) G.Zones.reset();
    if (G.Details) G.Details.reset();
    if (G.Sky) G.Sky.reset();
    if (G.Glass) G.Glass.reset();
    if (G.Notes) G.Notes.reset();
    if (G.Abilities) G.Abilities.clearWorld();
    if (G.Floor3) G.Floor3.clearWorld();
    if (G.Quiz) G.Quiz.reset();
    if (G.Spell) G.Spell.stop();
    if (G.SpellReload) G.SpellReload.reset();
    if (G.Study) G.Study.reset();
    document.body.classList.remove("study-run");
    // a boss, its cutscene, its arena walls and its effects
    if (G.Cutscene) G.Cutscene.stop();
    if (G.Bosses) G.Bosses.reset(this.world ? this : null);
    if (this.camera) this.camera.position.set(0, 0, 0);
    if (this.scene) {
      this.zombies.forEach((z) => { this.scene.remove(z.mesh); G.disposeObject3D(z.mesh); });
      this.drops.forEach((d) => { this.scene.remove(d.mesh); G.disposeObject3D(d.mesh); });
      (this.floorGuns || []).forEach((f) => { this.scene.remove(f.mesh); G.disposeObject3D(f.mesh); });
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
    this.zombies = []; this.drops = []; this.floorGuns = [];
    this._swingProps = null;
    document.body.classList.remove("slowmo");
    this.challenge = null;
    G.UI.setChallengeVisible(false);
    G.UI.setBossBar(false);
  },

  startWave() {
    this.wave++;
    this.spawnedCount = 0;
    if (this.player) this.player.secondLifeUsed = false;   // Second Life: once a wave
    // Round 2 (F): how many zombies, how fast, how many of the quick and the
    // crawling kinds, how many at once and how often they come -- one row of
    // G.WAVE_TABLE (js/systems.js) per wave, a notch harder for the later
    // levels. Campaign overtime plays like wave 19 (it exists so a player can
    // finish their objectives, not to escalate); Endless climbs slowly past
    // 20 to a ceiling.
    G.Spawner.reset(this.level, this.wave, this.mode);
    // (new series, round 1, A2: never fewer zombies -- so words -- than the
    // end-of-wave quiz has questions)
    this.requiredKills = Math.max(G.Spawner.spec.kills, G.CONFIG.quiz.minWordsPerWave);
    G.Quiz.resetWave(this);
    this.zombies.forEach((z) => (z.speedMultiplier = 1));
    this.currentDiff = this.level.difficulty + (Math.min(this.overtimeWave(), 20) - 1) * 0.18;
    // (vocabulary series, round 2, C3) the wave's words: due, being learnt,
    // at most four new (js/learnmodes.js G.WavePlan). A study session has
    // its own list (js/study.js).
    if (this.mode === "study" && G.Study) G.Study.startWave(this);
    else this.wavePlan = G.WavePlan.build(this.wordPool, G.WavePlan.size(this.wordPool, this.requiredKills));
  },

  // Waves 5, 10, 15 and 20 end with a boss (js/bosses.js); overtime has none.
  isBossWave() {
    if (this.mode === "campaign" && this.wave > this.level.waves) return false;
    return G.isBossWave(this.wave);
  },

  // ---------------- Word/target management ----------------
  ensureTargetHasMatch() {
    // (vocabulary series, round 2) only a zombie answered by shooting can be
    // the target; one answered by spelling carries its own clue, and a
    // look-alike brought in from outside the run's words (a decoy) never is
    const alive = this.zombies.filter((z) => z.alive);
    const shootable = alive.filter((z) => z.answer !== "spell" && !z.decoy);
    if (this.targetPair && shootable.some((z) => z.word === this.targetPair[0])) {
      alive.forEach((z) => z.setTarget(z.word === this.targetPair[0] && z.answer !== "spell" && !z.decoy));
      this.retireDecoys();
      return;
    }
    if (shootable.length === 0) { this.targetPair = null; this.targetClue = null; this._attempt = null; alive.forEach((z) => z.setTarget(false)); this.retireDecoys(); return; }
    // one whose word can already be read, if there is one (a zombie still
    // coming in has its label hidden)
    const ready = shootable.filter((z) => !z.emerge);
    let pickFrom = ready.length ? ready : shootable;
    // (E1) a new word, or one in box 1, is not asked beside a look-alike
    const clear = pickFrom.filter((z) => G.Distract.lookAlikesWanted(z.pair) || !alive.some((o) => o !== z && G.Distract.isSimilar(z.pair, o.pair)));
    if (clear.length) pickFrom = clear;
    const chosen = G.pick(pickFrom);
    this.targetPair = [chosen.word, chosen.meaning];
    // (the word's own key: a Context target carries the form its sentence
    // wants, "indicates", and its box is the family's)
    this.targetPair.id = G.wordKey(chosen.pair);
    // (round 3) what the panel at the top shows for it: the Thai, its
    // definition, a sentence with it taken out, or nothing but its sound
    this.targetClue = { kind: chosen.clueKind || "thai", pair: chosen.pair, cloze: chosen.cloze || null, full: chosen.clueFull || "", played: 0, thaiShown: false };
    // (C2) this answer: right only if it is right the first time and no
    // hint, perk or ability gave it away
    this._attempt = { key: G.wordKey(chosen.pair), wrong: false, assisted: this.helpersActive(), retry: !!chosen.retry };
    // the clue is the sound itself (G1): say it now; J3 "before" mode: read
    // the new target aloud the moment it appears
    if (this.targetClue.kind === "audio") this.playClue();
    else if (G.save.settings.speechMode === "before") G.Audio.speak(chosen.word);
    // (round 3: Fifty-Fifty crosses out wrong words for the new one instead)
    if (G.Abilities) G.Abilities.onNewTarget(this);
    if (this.helpersActive()) this._attempt.assisted = true;
    alive.forEach((z) => z.setTarget(z === chosen));
    this.retireDecoys();
  },
  // (C2) something is giving the answer away: the Hint Reader perk, the
  // Whisper, Fifty-Fifty and Lens abilities
  helpersActive() {
    const A = G.Abilities, fx = A && A.fx || {};
    // (round 3: Word Radar too -- it lights the zombie with the word -- and
    // the Settings option that draws the target's word in yellow)
    return G.Perks.level("perk_hint") > 0 || (A && A.whisper && A.whisper()) || !!fx.fiftyOn || fx.lens > 0 || fx.radar > 0 || !!G.save.settings.highlightTarget;
  },
  // (round 3, G) the spoken clue: the word asked, once more -- or, with
  // Play Once on, only the first time (like the IELTS Listening test)
  playClue(force) {
    const c = this.targetClue;
    if (!c || c.kind !== "audio" || !this.targetPair) return false;
    if (c.played && G.save.settings.playOnce && !force) { G.UI.flashAbilityNote && G.UI.flashAbilityNote(G.T("hud.playedOnce")); return false; }
    c.played++;
    G.Audio.speak(this.targetPair[0]);
    return true;
  },
  // (F) a Definition clue in English only: the Thai on request -- a helper,
  // so this answer moves no box
  showClueThai() {
    const c = this.targetClue;
    if (!c || c.kind !== "definition" || c.thaiShown || G.Learn.showsThai(c.pair)) return false;
    c.thaiShown = true;
    if (this._attempt) this._attempt.assisted = true;
    G.Audio.sfx && G.Audio.sfx("switch");
    return true;
  },
  // (E1) a decoy is there for one target; once that word is no longer asked
  // it crumbles away -- no reward, no penalty
  retireDecoys() {
    const key = this.targetPair ? G.wordKey(this.targetPair) : null;
    this.zombies.slice().forEach((z) => {
      if (!z.alive || !z.decoy || z.decoy.forKey === key) return;
      this.retireZombie(z);
    });
  },
  // a zombie that goes without being answered: it crumbles, no reward and
  // no penalty (a decoy no longer wanted; in a study session, one that bit)
  retireZombie(z) {
    z.alive = false;
    z._lastHit = { dir: null, head: false };
    this.startDeathAnimation(z);
    this.zombies = this.zombies.filter((zz) => zz !== z);
  },

  // `sp`: the spawn point, whose way in (ground, locker, vent, window, desk)
  // the zombie arrives by (js/zombiefx.js)
  spawnZombieAt(type, pos, sp) {
    // Never two on the field with the same word -- or the same MEANING: a
    // player's own word can share its Thai meaning with another in the level
    // (G.CustomVocab warns, but allows it), and two zombies answering one
    // prompt would make the shot a coin toss.
    const alive = this.zombies.filter((z) => z.alive);
    const usedWords = alive.map((z) => z.word);
    const usedMeanings = alive.map((z) => (z.meaning || "").trim());
    const free = (p) => !usedWords.includes(p[0]) && !usedMeanings.includes(p[1].trim());
    let pair = null, decoy = null;
    // (vocabulary series, round 2, E1) a target in box 2 or higher gets a
    // look-alike on the field -- one of the run's words if it can, else a
    // decoy from the bank or the confusables lexicon
    const tp = this.targetPair;
    // (round 3, H1) a Context target: the other forms of its family come
    // first -- the sentence wants "indicates", not "indication" -- one at a
    // time, carrying their form (decoys: never a target, never counted)
    const tc = this.targetClue;
    if (tp && tc && tc.kind === "cloze" && !(this.study && this.study.kind === "review")) {
      const key = G.wordKey(tp);
      if (alive.filter((z) => z.lookAlikeFor === key).length < G.CONFIG.clues.clozeFamily) {
        const onField = new Set(alive.map((z) => z.word.toLowerCase()));
        const f = G.Clues.familyDecoys(tc.pair, tp[0]).find((m) => !onField.has(m.word.toLowerCase()));
        if (f) { pair = [f.word, tp[1]]; decoy = { forKey: key, source: "family", form: f.word, pos: f.pos, clue: "cloze" }; }
      }
    }
    // (a study session: a look-alike is always a decoy -- it must not take the
    // place of one of the session's own words -- and Daily Review has none:
    // its zombies are the words due, and nothing else, C4)
    if (!pair && tp && !(this.study && this.study.kind === "review")) {
      const want = G.CONFIG.distractors.field;
      const have = alive.filter((z) => z.lookAlikeFor === G.wordKey(tp)).length;
      if (have < want && G.Distract.lookAlikesWanted(tp)) {
        const f = G.Distract.forField(tp, this);
        if (f) { pair = f.pair; if (f.decoy || this.study) decoy = { forKey: G.wordKey(tp), source: f.source }; }
      }
    }
    if (!pair && this.mode === "study" && G.Study) pair = G.Study.nextCard(this);
    if (!pair) {
      // (C3) the wave's own words first, one each before any comes round again;
      // (E1) nothing that looks like a target still new to the player
      const avoid = tp && !G.Distract.lookAlikesWanted(tp) ? (p) => G.Distract.isSimilar(tp, p) : () => false;
      const plan = (this.wavePlan || []).filter((p) => free(p) && !avoid(p));
      let candidates = plan.filter((p) => !G.Quiz.usedThisWave(this, p[0]));
      if (candidates.length === 0) candidates = plan;
      // (new series, round 1, A2) otherwise a word this wave has not had yet, while there is one
      if (candidates.length === 0) candidates = this.wordPool.filter((p) => free(p) && !avoid(p) && !G.Quiz.usedThisWave(this, p[0]));
      if (candidates.length === 0) candidates = this.wordPool.filter((p) => free(p));
      if (candidates.length === 0) candidates = this.wordPool.filter((p) => !usedMeanings.includes(p[1].trim()));
      if (candidates.length === 0) candidates = this.wordPool;
      pair = G.weightedSample(candidates, 1)[0] || G.pick(this.wordPool);
    }
    const z = new G.Zombie(type, pos, pair, this.level.theme);
    // how it is answered (shot, or spelt) and with which clue; a decoy is
    // shot, with its target's kind of clue (round 3: a Context look-alike
    // carries its form, a Listening one its Thai meaning)
    const how = decoy ? { clue: decoy.clue || (tc && tc.kind) || "thai", answer: "shoot" } : this.learn.pick(pair);
    this.dressZombie(z, pair, how, decoy);
    if (tp && !decoy && G.Distract.lookAlikesWanted(tp) && G.Distract.isSimilar(tp, pair)) z.lookAlikeFor = G.wordKey(tp);
    if (decoy) { z.decoy = decoy; z.lookAlikeFor = decoy.forKey; }
    else G.Quiz.noteWord(this, pair);                         // (the quiz asks this wave's words, A2)
    // (a study session's second go at a word already missed: it moves no box)
    if (this.study && !decoy && this.study.done[G.wordKey(pair)]) z.retry = true;
    z.speed *= G.Spawner.spec ? G.Spawner.spec.speed : 1;   // the wave's pace (G.WAVE_TABLE): gentle early on
    if (z.answer === "spell") z.speed *= G.CONFIG.spell.zombieSpeed;   // (D5) typing takes longer than a shot
    if (this.mode === "study") z.speed *= G.CONFIG.study.speed;
    this.scene.add(z.mesh);
    this.zombies.push(z);
    if (!decoy) this.spawnedCount++;
    if (sp) G.ZombieFX.begin(this, z, sp);
    this.ensureTargetHasMatch();
    return z;
  },

  // (round 3) A zombie's clue and label, from how it is answered
  // (js/learnmodes.js labelFor):
  //   thai, definition + shoot   its English word
  //   cloze + shoot              the form its example sentence uses -- the
  //                              zombie's word becomes that form; a family
  //                              look-alike carries its own form
  //   audio + shoot (Listening)  its Thai meaning: the player hears the word
  //   spell                      the Thai, a one-word synonym (Definition), or
  //                              no label at all (Dictation)
  dressZombie(z, pair, how, decoy) {
    const clue = how.clue || "thai", ans = how.answer || "shoot";
    let form = null;
    if (clue === "cloze") {
      if (ans === "shoot" && decoy && decoy.form) form = decoy.form;
      else {
        const cz = G.Clues.cloze(pair, G.rng() < 0.5 ? 0 : 1) || G.Clues.cloze(pair);
        if (cz) { z.cloze = cz; form = cz.answer; }
      }
      // (in lower case: a gap at the start of the sentence would otherwise be
      // the one capitalised label on the field -- the answer given away)
      if (form && !/[A-Z]/.test(pair[0])) form = form.toLowerCase();
      // shot: it carries the form; spelt (round 4): the form is what to write
      if (form && ans === "shoot") z.word = form;
      if (form && ans === "spell") z.spellPair = Object.assign([form, pair[1]], { exact: true });
    }
    const short = ans === "spell" ? (clue === "definition" ? G.Clues.synonym(pair) : clue === "audio" ? "🔊" : clue === "cloze" ? "___" : pair[1]) : pair[1];
    const full = clue === "definition" ? G.Clues.definition(pair) : clue === "cloze" && z.cloze ? z.cloze.text : "";
    z.setAnswer(ans, short, { kind: clue, label: G.Learn.labelFor(pair, clue, ans, form, this.mode !== "study"), full });
  },

  // The wave number that difficulty is read from: past a campaign level's
  // final wave it stays at the last regular (non-boss) wave.
  overtimeWave() {
    if (this.mode !== "campaign" || this.wave <= this.level.waves) return this.wave;
    return Math.max(1, this.level.waves - 1);
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
    if (slot === this.player.currentSlot) return;
    if (slot === 0) { this.cancelReload(); this.player.currentSlot = 0; return; }
    const idx = slot - 1;
    // switching away abandons a reload (see cancelReload)
    if (this.player.gunSlots[idx]) { this.cancelReload(); this.player.currentSlot = slot; }
  },
  buildWeaponViewModel() {
    if (this.weaponViewGroup) { this.camera.remove(this.weaponViewGroup); G.disposeObject3D(this.weaponViewGroup); }
    const def = this.currentWeaponDef();
    const mesh = def.id === "melee" ? G.buildMeleeMesh() : G.buildWeaponMesh(def);
    mesh.position.set(0.3, -0.32, -0.75);
    mesh.rotation.y = -0.06; // slight natural inward cant, typical FPS held-weapon angle
    // from here on G.ViewModel poses it every frame
    G.ViewModel.onWeaponBuilt(mesh, def);
    // The weapon builders already extend barrels/muzzles toward local -Z,
    // matching the camera's own forward (-Z) direction -- this extra 180deg
    // flip inverted that, sending the "barrel" toward the camera instead of
    // away from it. That put parts of the gun ~0.19 units from the eye
    // (right up against the 0.1 near-clip plane), which is why it rendered
    // as a huge, indistinct, wrongly-pointed blob instead of a small held gun.
    this.weaponViewGroup = mesh;
    this.camera.add(mesh);
    this.toViewmodelLayer(mesh);
  },
  // held things live on layer 1 only, cast and take no shadows
  toViewmodelLayer(root) {
    // (visual series: lit per pixel like the world, with the rim)
    if (G.Visuals) G.Visuals.viewmodel(root);
    root.traverse((o) => { o.layers.set(1); if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  },
  // every light lights both passes
  syncViewmodelLights() {
    if (this.scene) this.scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
  },
  // the frame: the world, then the gun and arms on top of it
  renderFrame() {
    const r = this.renderer, sc = this.scene, cam = this.camera;
    if (!r || !sc || !cam) return;
    // (visual series: the HDR frame, its film, the words on top -- js/visuals.js)
    if (G.Visuals && G.Visuals.ready) { G.Visuals.render(this); return; }
    r.info.reset();
    r.autoClear = true;
    // a boss cutscene is seen through its own camera, with no gun in hand
    if (G.Cutscene && G.Cutscene.active && G.Cutscene.camera) { r.render(sc, G.Cutscene.camera); return; }
    r.render(sc, cam);
    const vm = this.vmCamera;
    if (!vm) return;
    cam.updateMatrixWorld();
    vm.matrixWorld.copy(cam.matrixWorld);
    vm.matrixWorldInverse.copy(cam.matrixWorldInverse);
    if (vm.fov !== cam.fov || vm.aspect !== cam.aspect) { vm.fov = cam.fov; vm.aspect = cam.aspect; vm.updateProjectionMatrix(); }
    vm.matrixAutoUpdate = false;
    r.autoClear = false;
    r.clearDepth();
    const bg = sc.background, su = r.shadowMap.autoUpdate;
    sc.background = null; r.shadowMap.autoUpdate = false;      // keep the frame, reuse the shadows
    r.render(sc, vm);
    sc.background = bg; r.shadowMap.autoUpdate = su;
    r.autoClear = true;
  },

  // Every new gun goes through G.Loadout.offer (js/loadout.js), which asks
  // before anything is replaced. This used to overwrite the last slot once
  // four guns were held -- the slot-5 gun vanished whenever a new one came.
  acquireWeapon(weaponId, opts) { return G.Loadout.offer(this, weaponId, opts || { source: "crate" }); },

  reload() {
    const id = this.currentWeaponId();
    if (id === "melee") return;
    const ammo = this.player.ammo[id];
    const def = G.WEAPON_DEFS[id];
    const lvl = this.player.weaponLevels[id];
    const magSize = Math.round(def.magSize * lvl.mag);
    if (this.player.reloading || ammo.mag >= magSize || ammo.reserve <= 0) return;
    if (this.weaponAnim.switchT > 0) return;               // not in the middle of a swap
    // (vocabulary series, round 2, D2) Spell to Reload: a word first -- the
    // whole magazine for the right spelling, half for a wrong one
    if (G.SpellReload && G.SpellReload.enabled(this)) {
      if (G.SpellReload.busy) return;
      this._burst = null;
      G.SpellReload.open(this, (result) => this.finishSpellReload(id, result));
      return;
    }
    // Animation pass A3: a reload is a routine with steps, planned per weapon
    // type by G.ViewModel. Its events drive the gameplay: ammo goes in when
    // the fresh magazine seats (or shell by shell for a tube-fed shotgun),
    // so a reload abandoned before that point refills nothing.
    const missing = Math.min(magSize - ammo.mag, ammo.reserve);
    this.player.reloading = true;
    this.reloadState = { id, plan: G.ViewModel.planReload(def, missing), t: 0, next: 0 };
    // A reload is a reason to stop running: held sprint is ignored until it
    // is released, and pressing it again abandons the reload.
    this._sprintLatch = true;
    G.Audio.reloadEvent("start", def);
  },
  finishSpellReload(id, result) {
    const ammo = this.player.ammo[id], def = G.WEAPON_DEFS[id];
    if (!ammo || !def || this.state !== "GAMEPLAY") return;
    const magSize = Math.round(def.magSize * this.player.weaponLevels[id].mag);
    const goal = result === "full" ? magSize : Math.max(ammo.mag, Math.ceil(magSize * G.CONFIG.spell.reloadWrongShare));
    const add = Math.max(0, Math.min(goal - ammo.mag, ammo.reserve));
    ammo.mag += add; ammo.reserve -= add;
    G.Audio.reloadEvent("in", def);
    G.Audio.reloadEvent("slap", def);
  },
  cancelReload() {
    if (!this.player.reloading) return;
    this.player.reloading = false;
    this.reloadState = null;
    G.ViewModel.cancelReload();
  },
  onReloadEvent(kind, R) {
    const def = G.WEAPON_DEFS[R.id];
    const ammo = this.player.ammo[R.id];
    const lvl = this.player.weaponLevels[R.id];
    if (ammo && def) {
      const magSize = Math.round(def.magSize * lvl.mag);
      if (kind === "in") {
        const need = Math.min(magSize - ammo.mag, ammo.reserve);
        ammo.mag += need; ammo.reserve -= need;
      } else if (kind === "shell" && ammo.mag < magSize && ammo.reserve > 0) {
        ammo.mag++; ammo.reserve--;
      }
    }
    G.Audio.reloadEvent(kind, def);
  },

  // ---------------- Shooting ----------------
  // `chargeFrac` (0-1) comes from a charge weapon's held trigger; `inBurst`
  // marks the follow-up rounds of a burst, which ignore the between-shot
  // cooldown because the burst has its own, much shorter one.
  fireWeapon(chargeFrac, inBurst) {
    const def = this.currentWeaponDef();
    if ((this.player.fireCooldown > 0 && !inBurst) || this.player.reloading) return;
    const id = this.currentWeaponId();
    if (id === "melee") {
      this.meleeAttack(def); this.player.fireCooldown = def.fireRate / 1000;
      G.Audio.noise({ dur: 0.16, freq: 1800, freqEnd: 600, q: 0.8, gain: 0.18 });   // blade swish
      return;
    }
    const ammo = this.player.ammo[id];
    const lvl = this.player.weaponLevels[id];
    if (ammo.mag <= 0) { this._burst = null; G.Audio.sfx("empty"); this.reload(); return; }
    // Last Round: the final round(s) of a magazine hit three times as hard
    const lastRound = G.Perks.has("last_round") && ammo.mag <= G.Perks.val("last_round");
    ammo.mag--;
    G.Audio.gunshot(def, chargeFrac);
    G.Tutorial.onShot();
    if (!inBurst) this.player.fireCooldown = (def.fireRate / 1000) / lvl.rate;
    // Category N: a burst weapon looses the rest of its rounds on a timer.
    if (def.burst > 1 && !inBurst) {
      this._burst = { id, left: def.burst - 1, timer: (def.burstDelay || 60) / 1000, charge: chargeFrac };
    }
    let dmg = def.damage * lvl.dmg;
    if (def.charge) dmg *= 1 + (def.charge.mult - 1) * Math.min(1, chargeFrac || 0);
    if (lastRound) dmg *= 3;
    // Marksman: a shot taken fully aimed hits harder and a shotgun holds tighter
    const aimed = G.Perks.has("marksman") && this.aimT > 0.85;
    if (aimed) dmg *= 1 + G.Perks.val("marksman") / 100;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    G.spawnMuzzleFlash(this.scene, origin.clone().addScaledVector(dir, 0.6), G.save.settings.graphicsQuality);
    if (G.Details) G.Details.onShot(origin);          // the crows hear it
    this.recoilKick(def);
    G.spawnShellEject(this.scene, this.camera, G.save.settings.graphicsQuality);

    const shots = def.pellets || 1;
    let anyHit = false;
    for (let i = 0; i < shots; i++) {
      // Per-weapon spread: a tight combat shotgun and a wide scattergun are
      // different guns even at the same pellet count.
      const spread = (def.pellets ? (def.spread || 0.06) : 0.004) * (aimed ? 0.5 : 1);
      const d = dir.clone();
      d.x += (G.rng() - 0.5) * spread; d.y += (G.rng() - 0.5) * spread; d.z += (G.rng() - 0.5) * spread;
      d.normalize();
      if (this.raycastShoot(origin, d, dmg, def.pierce, def)) anyHit = true;
    }
    if (anyHit) G.UI.showHitmarker();
    if (ammo.mag <= 0 && ammo.reserve > 0) { this._burst = null; this.reload(); }
  },

  // Category N: pierce is a COUNT now, not a flag -- a bolt that passes
  // through three zombies plays differently from one that never stops.
  raycastShoot(origin, dir, dmg, pierce, def) {
    // Category P: rounds stop at the first wall, door, piece of furniture or
    // floor slab in the way. They used to test zombies only, so a shot went
    // through any number of walls -- and up through the ceiling into zombies
    // on the floor above, which the player cannot even see.
    const wallAt = this.world ? this.wallDistance(origin, dir, 60) : 60;
    this.raycaster.set(origin, dir);
    this.raycaster.far = wallAt;
    this.raycaster.camera = this.camera;
    // (new series, round 1, B1) zombies: a word aimed at first, then the
    // hitboxes of the living ones, nearest first (js/aim.js) -- never the
    // models, a falling body, a flying head, a drop or an effect.
    // A boss is shot through its own hitboxes (js/bossmodels.js).
    const bossBoxes = G.Bosses.hitboxes();
    const bossHits = bossBoxes.length ? this.raycaster.intersectObjects(bossBoxes, false) : [];
    const hits = G.Aim.trace(this, origin, dir, wallAt).concat(bossHits.map((h) => ({ boss: h, distance: h.distance })))
      .sort((a, b) => (b.label ? 1 : 0) - (a.label ? 1 : 0) || a.distance - b.distance);
    let hitAny = false;
    let through = 0;
    let stopAt = wallAt;                  // where the round ended (a pane before it breaks)
    // Piercing Rounds: every bullet goes on through that many more zombies
    const maxThrough = (pierce ? (pierce === true ? 99 : pierce) : 1) + (G.Perks.val("piercing_rounds") || 0);
    const hitZombieUids = new Set();
    const bossHit = new Set();
    for (const zh of hits) {
      const hit = zh.boss || zh;
      const bh = zh.boss ? hit.object.userData.bossHit : null;
      if (bh) {
        // once per round each: the boss (the first of its boxes the round
        // meets) or one of the Examiner's copies
        const key = bh.clone !== undefined ? "c" + bh.clone : "boss";
        if (bossHit.has(key)) continue;
        bossHit.add(key);
        const r = G.Bosses.onShot(this, hit.object, dmg, hit.point);
        if (!r.hit) continue;
        // (Mirror Gaze threw it back: no hit, and it goes no further)
        if (r.reflected) { stopAt = hit.distance; break; }
        hitAny = true;
        if (r.weak) G.UI.showHitmarker(true);
        if (def && def.splash) this.splashDamage(hit.point, def, dmg, true);
        if (++through >= maxThrough) { stopAt = hit.distance; break; }
        continue;
      }
      const z = zh.z, head = zh.head;
      if (!z || hitZombieUids.has(z.uid) || !z.alive) continue;
      // the part still under the floor (or above the ceiling) can't be hit
      if (G.ZombieFX.hitBlocked(z, hit.point)) continue;
      // (vocabulary series, round 2) a zombie answered by spelling shrugs
      // bullets off: it goes down to its word, typed
      if (z.answer === "spell") { this.spellGlance(z, hit.point); stopAt = Math.max(hit.distance, 0.5); break; }
      hitZombieUids.add(z.uid);
      hitAny = true;
      // Round 2: the head is its own hitbox -- the neck group and everything
      // on it -- and a head hit does double damage
      this.damageZombie(z, head ? dmg * G.HEADSHOT_MULT : dmg, hit.point, { dir: dir.clone(), head });
      if (head) G.UI.showHitmarker(true);
      if (def && def.splash) this.splashDamage(hit.point, def, dmg);
      if (++through >= maxThrough) { stopAt = hit.distance; break; }
    }
    // Round 3 (H): a window pane on the way breaks, and the round goes on
    if (G.Glass) G.Glass.onShot(origin, dir, stopAt);
    // A missed explosive still goes off where it lands -- on the wall it hit,
    // not forty units beyond it.
    if (def && def.splash && !hitAny) {
      const end = origin.clone().addScaledVector(dir, Math.min(40, Math.max(0, wallAt - 0.2)));
      this.splashDamage(end, def, dmg);
    }
    // also allow shooting the static locked crate to attempt opening (per spec: "shoot it or press E to open")
    if (this.world) {
      const crateMeshes = this.world.crates.filter((c) => !c.opened).map((c) => c.mesh);
      // a crate is itself a collider, so it IS the wall the ray stopped at
      this.raycaster.far = wallAt + 0.05;
      const cHits = this.raycaster.intersectObjects(crateMeshes, true);
      if (cHits.length && (!hits.length || cHits[0].distance < (hits[0] && !hits[0].label ? hits[0].distance : Infinity))) {
        this.tryOpenStaticCrate(this.world.crates.find((c) => c.mesh === cHits[0].object || c.mesh === cHits[0].object.parent));
      }
    }
    return hitAny;
  },

  // Distance along a ray to the nearest solid: every collider box (walls,
  // shut doors, furniture), plus the top of every raised floor -- the upper
  // storey and the stair landings are height zones, not boxes.
  wallDistance(origin, dir, far) {
    const ray = this._wallRay || (this._wallRay = new THREE.Ray());
    const hit = this._wallHit || (this._wallHit = new THREE.Vector3());
    ray.origin.copy(origin); ray.direction.copy(dir);
    let best = far;
    for (const c of G.ColGrid.alongRay(this.world, origin, dir, far, this._rayCols || (this._rayCols = []))) {
      // (a real window's opening stops walking, not rounds: js/glass.js)
      if (c.passShots || c.containsPoint(origin) || !ray.intersectBox(c, hit)) continue;
      const d = hit.distanceTo(origin);
      if (d < best) best = d;
    }
    if (Math.abs(dir.y) > 1e-4) {
      for (const hz of this.world.heightZones) {
        if (hz.ramp || hz.height <= 1) continue;
        const k = (hz.height - origin.y) / dir.y;
        if (k <= 0 || k >= best) continue;
        const x = origin.x + dir.x * k, z = origin.z + dir.z * k;
        if (x >= hz.minX && x <= hz.maxX && z >= hz.minZ && z <= hz.maxZ) best = k;
      }
    }
    return best;
  },

  // Category N: splash was declared on five weapons and never implemented --
  // the grenade launcher, Art Attack and Meteor Detention were all really
  // single-target guns. Damage falls off toward the edge of the radius, and
  // the shooter is not immune to their own launcher at point blank.
  // (`bossDone`: the round already hit the boss directly -- its blast adds
  // nothing more to it)
  splashDamage(point, def, baseDmg, bossDone) {
    const r = def.splashRadius || 3.5;
    G.Audio.explosion(point, r >= 6);
    G.spawnHitParticles(this.scene, point, 0xffa64d, G.save.settings.graphicsQuality);
    if (!bossDone) G.Bosses.splash(this, point, r, baseDmg);
    if (G.Glass) G.Glass.splash(point, r);
    // snapshot: damageZombie can remove entries from this.zombies mid-loop
    this.zombies.slice().forEach((z) => {
      if (!z.alive || z.answer === "spell") return;
      const d = z.mesh.position.distanceTo(point);
      if (d > r) return;
      this.damageZombie(z, baseDmg * 0.6 * (1 - 0.7 * (d / r)), z.mesh.position,
        { dir: new THREE.Vector3().subVectors(z.mesh.position, point).setY(0), head: false });
    });
    const selfD = this.yawObject.position.distanceTo(point);
    const safe = r * 0.55;
    if (selfD < safe) {
      this.player.hp -= baseDmg * 0.12 * (1 - selfD / safe);
      G.UI.flashDamage && G.UI.flashDamage();
    }
  },

  meleeAttack(def) {
    const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(); this.camera.getWorldPosition(origin);
    let best = null, bestDist = def.range;
    for (const z of this.zombies) {
      if (!z.alive || z.answer === "spell") continue;
      const toZ = new THREE.Vector3().subVectors(z.mesh.position, origin);
      const dist = toZ.length();
      if (dist > def.range) continue;
      toZ.normalize();
      if (toZ.dot(dir) > 0.7 && dist < bestDist) { best = z; bestDist = dist; }
    }
    if (best) { G.UI.showHitmarker(); this.damageZombie(best, def.damage, best.mesh.position, { dir: dir.clone(), head: false }); }
    else if (G.Bosses.melee(this, origin, dir, def)) G.UI.showHitmarker();
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
    // weapon switch: the old gun goes down and out of frame, the model is
    // swapped at the bottom, the new one comes up (poses in G.ViewModel)
    if (a.switchT > 0) {
      a.switchT = Math.max(0, a.switchT - dt);
      const p = 1 - a.switchT / a.switchDur;
      if (p >= 0.5 && a.pendingRebuild) { a.pendingRebuild = false; this.buildWeaponViewModel(); }
    }
  },
  switchProgress() {
    const a = this.weaponAnim;
    return a.switchT > 0 ? 1 - a.switchT / a.switchDur : null;
  },

  // a round off a zombie that has to be spelt: sparks, and now and then the reminder
  spellGlance(z, point) {
    G.spawnHitParticles(this.scene, point, 0x9ae8ff, G.save.settings.graphicsQuality);
    const now = performance.now();
    if (now - (this._glanceNoteAt || 0) > 4000) {
      this._glanceNoteAt = now;
      G.UI.flashPurchaseBanner(G.T("spell.glanceTitle"), G.T(G.Input.mode === "touch" || G.Input.padActive ? "spell.glanceTiles" : "spell.glanceType"));
    }
  },

  // `info`: { dir, head } -- where the hit came from and whether it was the
  // head, which decides how a killed zombie goes (js/zombiefx.js)
  damageZombie(z, dmg, hitPoint, info) {
    z._lastHit = info || { dir: null, head: false };
    G.spawnHitParticles(this.scene, hitPoint, 0x8a2a2a, G.save.settings.graphicsQuality);
    const died = z.takeDamage(dmg);
    if (died) { G.Audio.zombie("death", z.type, z.mesh.position); this.onZombieDeath(z); }
    else if (!z._hurtSoundAt || performance.now() - z._hurtSoundAt > 350) {
      z._hurtSoundAt = performance.now();
      G.Audio.zombie("hurt", z.type, z.mesh.position);
    }
  },

  onZombieDeath(z) {
    // Was an instant scene.remove() -- vanishing with no transition at all.
    // Now it bursts apart, or loses its head and drops (startDeathAnimation).
    this.startDeathAnimation(z);
    this.totalZombiesKilled++;
    // (vocabulary series, round 2) a zombie spelt down is its own right
    // answer; a decoy is never the target
    const spelled = z._spelled || null;
    const wasCorrect = !!spelled || (!!this.targetPair && z.word === this.targetPair[0] && !z.decoy && z.answer !== "spell");
    const P = G.Perks, pl = this.player;
    if (P.has("adrenaline")) this._adrenalineT = 3;
    if (P.has("bloodthirst")) pl.hp = Math.min(pl.maxHp, pl.hp + P.val("bloodthirst")[wasCorrect ? 1 : 0]);
    if (wasCorrect) {
      if (P.has("focus_time")) this._slowmoT = P.val("focus_time");
      const sh = pl.comboShield;
      if (sh && !sh.charged && ++sh.streak >= P.val("combo_shield")) { sh.charged = true; sh.streak = 0; }
      this.correctCount++;
      this.correctKills++;
      G.Audio.sfx("correct");
      // J3: pronounce the word once it has been earned (default), so the
      // audio reinforces the answer instead of giving it away
      if ((G.save.settings.speechMode || "after") === "after") G.Audio.speak(z.word);
      const prevStat = G.wordStat(z.pair), prevWrong = !!prevStat && prevStat.wrong > 0;
      this.learnRight(z, spelled);
      this.player.combo++;
      if (this.player.combo >= 50) G.unlockAchievement("streak50");
      // (round 3: a word's length in its language -- a Chinese character counts as three letters)
      let reward = 10 + G.SpellUnits.weight(z.word, G.Lang.wl(z.pair)) * 3 + Math.min(this.player.combo, 20) * 2;
      if (prevWrong) reward = Math.round(reward * 1.6);
      // Big Word Bounty: a hard word -- a long one, or one missed before -- pays more
      if (P.has("word_bounty") && (z.word.replace(/[^A-Za-z]/g, "").length >= 8 || prevWrong)) {
        reward = Math.round(reward * (1 + P.val("word_bounty") / 100));
      }
      // (D4) each letter a hint put in takes its share off
      const hintCut = spelled ? Math.max(0, 1 - (spelled.hints || 0) * G.CONFIG.spell.hintPenalty) : 1;
      let score = 15 + z.word.length * 2 + this.player.combo * 3;
      if (this.mode === "study" && G.Study) score = G.Study.scoreFor(this, z, spelled);
      else this.player.money += Math.round(reward * hintCut);
      this.player.score += Math.round(score * hintCut);
      if (this.mode === "study" && G.Study) G.Study.onAnswer(this, z, true);
      this.rollLootDrop(z, true);
    } else {
      this.wrongCount++;
      G.Audio.sfx("wrong");
      // (C2, E2) a wrong zombie shot is a wrong answer on the TARGET, and
      // the pair (target, the word shot) is one the player confuses
      const tp = this.targetPair;
      this.learnWrongShot(z);
      if (tp) this.trackWrongWord(tp[0], tp[1]); else if (!z.decoy) this.trackWrongWord(z.word, z.meaning);
      this.showConfusion(z, tp);
      // (a study session: the target's word was missed; the one shot comes again)
      if (this.mode === "study" && G.Study) G.Study.onWrongShot(this, z, tp);
      // (the end-of-wave quiz asks these first: the word shot by mistake, and
      // the one that should have been)
      if (!z.decoy) G.Quiz.noteMissed(this, z.word);
      if (this.targetPair) G.Quiz.noteMissed(this, this.targetPair[0]);
      // Combo Shield: one wrong answer does not cost the combo; it recharges
      // after a run of right ones
      if (pl.comboShield && pl.comboShield.charged && pl.combo > 0) {
        pl.comboShield.charged = false; pl.comboShield.streak = 0;
        G.UI.noteComboSaved && G.UI.noteComboSaved();
      } else this.player.combo = 0;
      this.player.hp -= G.CONFIG.player.wrongKillDamage;   // (js/config.js)
      this.player.wasHitThisLevel = true;
      G.UI.flashDamage();
      this.zombies.forEach((zz) => { if (zz.alive) zz.speedMultiplier = Math.min(2, zz.speedMultiplier + 0.25); });
      this.rollLootDrop(z, false);
    }
    // (new series, round 2) a boss's own zombie down: Tombstone Ward counts
    // the ones shot by their right word
    if (z.minion) G.Bosses.onMinionDeath(this, z, !!wasCorrect);
    this.zombies = this.zombies.filter((zz) => zz !== z);
    this.checkSecondFloorUnlock();
    this.checkThirdFloorUnlock();
    this.ensureTargetHasMatch();
    this.checkWaveClear();
    this.checkPlayerDeath();
  },

  // Round 2: a body kill bursts it into blocks and smoke; a head kill knocks
  // the head off along the shot while the body drops; the boss topples first
  // (js/zombiefx.js).
  startDeathAnimation(z) { G.ZombieFX.onDeath(this, z); },
  updateDyingZombies(dt) { G.ZombieFX.updateDying(this, dt); },

  trackWrongWord(word, meaning) {
    const key = word;
    if (!this.wrongWordsThisRun[key]) this.wrongWordsThisRun[key] = { meaning, count: 0 };
    this.wrongWordsThisRun[key].count++;
  },

  // ---------------- learning (vocabulary series, round 2) ----------------
  // A right answer on zombie z: its box moves (js/srs.js) -- unless the
  // player already got this one wrong (C2) or had help. Spelt: a recall
  // answer (boxes 4-5 need those).
  learnRight(z, spelled) {
    const inView = this.zombies.filter((o) => o.alive && o !== z).map((o) => o.pair);
    if (spelled) {
      if (z._spellWrong) { G.recordWordResult(z.pair, true, { srs: false }); return; }
      G.Learning.answerWord(z.pair, true, { recall: true, assisted: (spelled.hints || 0) > 0 || !!z._thaiShown || !!z.retry, inView, skills: G.Learning.skillsFor(z.clueKind, "spell") });
      return;
    }
    const att = this._attempt, key = G.wordKey(z.pair), same = att && att.key === key;
    if (same && att.wrong) { G.recordWordResult(z.pair, true, { srs: false }); return; }
    const assisted = (same && att.assisted) || this.helpersActive() || !!z.retry;
    // (round 3: a Definition or Context clue makes the shot a recall answer)
    G.Learning.answerWord(z.pair, true, { recall: G.Learn.isRecall(z.clueKind || this.learn.clueFor(z.pair), "shoot"), assisted, inView, skills: G.Learning.skillsFor(z.clueKind, "shoot") });
  },
  // A wrong zombie shot: a wrong answer on the target (once per target), and
  // the pair (target, word shot) noted (E2)
  learnWrongShot(z) {
    const tp = this.targetPair;
    const shot = z.decoy ? z.word : z.pair;
    if (!tp) { if (!z.decoy) G.recordWordResult(z.pair, false, { srs: false }); return; }
    const att = this._attempt, key = G.wordKey(tp);
    if (att && att.key === key && (att.wrong || att.retry)) { G.SRS.noteConfusion(tp, shot); if (att) att.wrong = true; return; }
    G.Learning.answerWord(tp, false, { picked: shot, skills: G.Learning.skillsFor(this.targetClue && this.targetClue.kind, "shoot") });
    if (att && att.key === key) att.wrong = true;
  },
  // (A4) a look-alike shot by mistake: what it means, beside the word wanted
  showConfusion(z, tp) {
    if (!tp) return;
    const tc = this.targetClue;
    // (round 3, G3) Listening: the word that was said -- its syllables, the
    // stressed one in capitals, and what it means -- and it is said again
    if (tc && tc.kind === "audio") {
      G.UI.flashPurchaseBanner(G.T("learn.heardTitle"), G.T("learn.heardText", { w: tp[0], s: G.Clues.stressText(tc.pair) || tp[0], m: tp[1] }));
      G.Audio.speak(tp[0]);
      return;
    }
    // (H1) Context: the wrong form of the right word
    if (z.decoy && z.decoy.source === "family") {
      G.UI.flashPurchaseBanner(G.T("learn.formTitle", { x: z.word }), G.T("learn.formText", { x: z.word, y: tp[0] }));
      return;
    }
    if (!(z.decoy || z.lookAlikeFor)) return;
    G.UI.flashPurchaseBanner(G.T("learn.lookAlikeTitle", { x: z.word }), G.T("learn.lookAlikeText", { x: z.word, xm: z.meaning, y: tp[0], ym: tp[1] }));
  },
  // (D1) the spelling was right: the gun fires at it -- the shot, the flash,
  // the kick -- and it goes down. Spelling uses no ammunition.
  spellKill(z, opts) {
    if (!z || !z.alive) return;
    z._spelled = { hints: (opts && opts.hints) || 0 };
    const def = this.currentWeaponDef();
    const gun = def.id === "melee" ? G.WEAPON_DEFS.pistol : def;
    const origin = new THREE.Vector3(); this.camera.getWorldPosition(origin);
    const at = z.mesh.position.clone().setY(z.mesh.position.y + 1.3);
    const dir = at.clone().sub(origin).normalize();
    G.Audio.gunshot(gun, 0);
    G.spawnMuzzleFlash(this.scene, origin.clone().addScaledVector(dir, 0.6), G.save.settings.graphicsQuality);
    this.recoilKick(gun);
    G.UI.showHitmarker(true);
    this.damageZombie(z, z.hp + 1e6, at, { dir, head: true });
  },
  learnBitten(z) {
    if (z.decoy) return;
    if (z.answer === "spell") {
      if (z._spellWrong) return;
      z._spellWrong = true;
      if (!z.retry) G.Learning.answerWord(z.pair, false, { skills: G.Learning.skillsFor(z.clueKind, "spell") });
      if (this.mode === "study" && G.Study) G.Study.onMissed(this, z);
      return;
    }
    const tp = this.targetPair, att = this._attempt;
    if (!tp || z.word !== tp[0] || !att || att.key !== G.wordKey(tp) || att.wrong) return;
    att.wrong = true;
    if (!att.retry) G.Learning.answerWord(tp, false, { skills: G.Learning.skillsFor(this.targetClue && this.targetClue.kind, "shoot") });
    if (this.mode === "study" && G.Study) G.Study.onMissed(this, z);
  },
  // (D1) within two letters of a zombie's word: a misspelling of that word
  spellMiss(z, typed) {
    G.Audio.sfx("wrong");
    this.wrongCount++;
    if (!z._spellWrong) {
      z._spellWrong = true;
      if (!z.retry) G.Learning.answerWord(z.pair, false, { typed, skills: G.Learning.skillsFor(z.clueKind, "spell") });
      else if (G.SRS.typedWord(typed, z.pair)) G.SRS.noteConfusion(z.pair, typed);
    } else if (G.SRS.typedWord(typed, z.pair)) G.SRS.noteConfusion(z.pair, typed);
    this.trackWrongWord(z.word, z.meaning);
    G.Quiz.noteMissed(this, z.word);
    const pl = this.player;
    if (pl.comboShield && pl.comboShield.charged && pl.combo > 0) { pl.comboShield.charged = false; pl.comboShield.streak = 0; }
    else pl.combo = 0;
    if (this.mode === "study" && G.Study) G.Study.onMissed(this, z);
  },

  // ---------------- Loot ----------------
  rollLootDrop(z, correct) {
    if (this.mode === "study") return;             // (a study session has no money, ammo or crates to find)
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
    G.Audio.sfx("pickup");
    G.Tutorial.onPickup();
    if (drop.kind === "money") this.player.money += 20 + Math.round(G.rng() * 30);
    else if (drop.kind === "ammo") {
      // two magazines for the gun in hand -- with the knife out, for the first
      // gun (it used to be lost); a boss arena's supply box fills every gun
      // (round 3: the playtest bot ran dry in a sealed arena and was stuck)
      const cur = this.currentWeaponId();
      const ids = drop.arena ? this.player.gunSlots : [cur !== "melee" ? cur : this.player.gunSlots[0]];
      const mags = drop.arena ? G.CONFIG.boss.arenaAmmo.magsPerGun : 2;
      ids.forEach((id) => { if (id && this.player.ammo[id] && G.WEAPON_DEFS[id]) this.player.ammo[id].reserve += G.WEAPON_DEFS[id].magSize * mags; });
    } else if (drop.kind === "health") {
      // (a boss's health box, as a new phase begins: a share of full health)
      const heal = drop.arena ? this.player.maxHp * G.CONFIG.boss.arenaHealth.heal : G.CONFIG.player.healthPickup;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    }
    else if (drop.kind === "crate") this.openCrate(drop.rarity, null, null, { source: "drop", dropPos: drop.mesh.position.clone() });
  },

  // opts.source / opts.dropPos say where the gun waits if the player's slots
  // are full and they keep their loadout (see G.Loadout.offer).
  openCrate(rarityKey, guaranteedMin, onClose, opts) {
    if (guaranteedMin && G.RARITY_ORDER.indexOf(rarityKey) < G.RARITY_ORDER.indexOf(guaranteedMin)) rarityKey = guaranteedMin;
    // Lucky Charm: the crate rolls its rarity again (twice at level 2) and
    // keeps the best result
    const rolls = G.Perks.val("lucky_charm") || 1;
    for (let i = 1; i < rolls; i++) {
      const again = G.rollRarity(guaranteedMin || undefined);
      if (G.RARITY_ORDER.indexOf(again) > G.RARITY_ORDER.indexOf(rarityKey)) rarityKey = again;
    }
    // Category H1: crates only ever contain guns from the level being played.
    const pool = G.weaponsForLevel(this.level ? this.level.id : 1,
      (w) => w.rarity === rarityKey && !w.wallExclusive && !w.boxOnly);
    const weaponDef = pool.length ? G.pick(pool) : G.WEAPON_DEFS.pistol;
    // shown first; taken (or offered, when the slots are full) as it closes
    this._crateWeapon = weaponDef.id;
    this._crateOpts = Object.assign({ source: "crate" }, opts || {});
    if (rarityKey === "secret") G.unlockAchievement("secret_crate");
    G.spawnCrateBurst(this.scene, this.yawObject.position.clone(), rarityKey, G.save.settings.graphicsQuality);
    this._onCrateClose = onClose || null;
    G.Modal.open("crate", { pause: true, keys: (e) => {
      if (e.code === "Enter" || e.code === "Space" || e.code === "KeyE") { this.closeCrateScreen(); return true; }
      return false;
    } });
    G.UI.showCrateScreen(rarityKey, weaponDef);
  },
  closeCrateScreen() {
    if (!G.Modal.isOpen("crate")) return;
    // a crate bought in the shop goes back to the shop, not to an empty view
    // with the shop timer still running behind it
    if (this.state === "SHOP") { G.UI.renderShop(); G.UI.showScreen("screen-shop"); }
    else G.UI.showScreen(null);
    G.UI.setHudVisible(this.state === "GAMEPLAY");
    const cb = this._onCrateClose;
    this._onCrateClose = null;
    const id = this._crateWeapon, opts = this._crateOpts || { source: "crate" };
    this._crateWeapon = null; this._crateOpts = null;
    // With the slots full this opens the Inventory Full window, and whatever
    // came after the crate (the boss's crate leads on to the shop) waits for it.
    const settled = id ? G.Loadout.offer(this, id, Object.assign({}, opts, { onDone: () => { cb && cb(); } })) : (cb && cb(), true);
    if (settled && this.state === "SHOP") G.UI.renderShop();          // "owned" marks, the slot count
    // closed last, so a window the callback opened (the shop) keeps the cursor
    G.Modal.close("crate");
  },

  tryOpenStaticCrate(crateRef) {
    if (!crateRef || crateRef.opened) return;
    if (crateRef.locked) {
      this.startWordChallenge(G.T("challenge.crate"), () => { crateRef.locked = false; this.openStaticCrateNow(crateRef); }, () => {});
    } else this.openStaticCrateNow(crateRef);
  },
  openStaticCrateNow(crateRef) {
    crateRef.opened = true;
    crateRef.mesh.visible = false;
    const at = crateRef.mesh.getWorldPosition(new THREE.Vector3());
    this.openCrate(G.rollRarity("uncommon"), null, null, { source: "crate", dropPos: at });
  },

  // ---------------- Bosses (round 2, G: js/bosses.js, js/cutscene.js) ----------------
  // (the old boss -- a zombie three times the size that was really a quiz --
  // is gone; a boss is a fight now, and one word question comes after it)
  // Everything alive is taken off the field at once: a boss is arriving.
  clearZombies() {
    this.zombies.forEach((z) => { this.scene.remove(z.mesh); G.disposeObject3D(z.mesh); });
    this.zombies = [];
    this.targetPair = null;
  },
  // Straight to `pos`, looking at `look` (the arena, when a boss comes).
  teleportPlayer(pos, look) {
    const floor = G.getFloorHeightAt(this.world, pos.x, pos.z, pos.y || 0);
    this.yawObject.position.set(pos.x, floor + 1.7, pos.z);
    if (look) this.yawObject.rotation.y = Math.atan2(-(look.x - pos.x), -(look.z - pos.z));
    this.pitchObject.rotation.x = 0;
    this.velocityY = 0;
    this._prevPos = null; this._bossLastP = null; this._prevYaw = undefined; this._prevPitch = undefined;
    this.cancelReload();
    // (Rewind cannot take the player back out of a boss's arena)
    if (G.Abilities) G.Abilities.clearTrail();
    if (G.Zones) G.Zones.update(this, true);
  },
  // The view shakes (a boss landing, a roar); gentler with head bob off.
  shake(a, d) {
    const k = G.save.settings.headBobOff ? 0.3 : 1;
    this._shakeA = Math.max(this._shakeA || 0, a * k);
    this._shakeT = Math.max(this._shakeT || 0, d);
  },
  applyShake(dt) {
    if (!(this._shakeT > 0)) return;
    this._shakeT -= dt;
    const c = this.camera.position;
    if (this._shakeT <= 0) { this._shakeA = 0; c.set(0, 0, 0); return; }
    const a = this._shakeA * Math.min(1, this._shakeT * 3);
    c.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0);
  },
  // (G6) After a boss's death scene: one hard word against the clock. Right:
  // the reward (round 3's ability choice), then the shop. Wrong, or out of
  // time: straight to the shop.
  afterBoss(def) {
    if (this.challenge) { G.UI.setChallengeVisible(false); this.challenge = null; G.Modal.close("challenge"); }
    const hard = G.pickHardWords(this.wordPool, 6);
    const pair = G.pick(hard.length ? hard : this.wordPool);
    this._bossQuestion = { id: def.id, pair, result: null };
    this.startWordChallenge(G.T("challenge.boss"), () => {
      this._bossQuestion.result = "right";
      G.UI.flashPurchaseBanner(G.T("banner.bossCorrect"), G.T("banner.bossCorrectText"));
      this.bossReward(() => this.finishBossWave());
    }, () => {
      this._bossQuestion.result = this._challengeEnd === "timeout" ? "timeout" : "wrong";
      this.finishBossWave();
    }, { pair, time: G.CONFIG.boss.questionSeconds, boss: true });
  },
  // the reward for the right answer: the ability honeycomb (round 3, H --
  // js/abilities.js, js/abilityui.js), then the shop
  bossReward(next) {
    if (G.Abilities && G.Abilities.offer) G.Abilities.offer(this, next); else next();
  },
  finishBossWave() {
    if (G.Bosses.phase !== "after") return;
    G.Bosses.phase = null;
    // (J, round 3: the checkpoint after wave 10's boss is kept as the shop closes)
    if (this.mode === "campaign" && this.wave === G.CONFIG.checkpoint.afterWave) this._checkpointDue = true;
    this.afterWaveCleared();
  },

  // ---------------- Wave flow ----------------
  checkWaveClear() {
    // a boss on its way, fighting, dying, or its question still open
    if (G.Bosses.phase) return;
    if (this.spawnedCount < this.requiredKills || this.zombies.length) return;
    // a boss wave's own zombies are down: now its boss
    if (this.isBossWave()) { G.Bosses.begin(this); return; }
    this.afterWaveCleared();
  },
  afterWaveCleared() {
    // (vocabulary series, round 2) a study session is one wave: its results
    if (this.mode === "study" && G.Study) { G.Study.finish(this, "done"); return; }
    if (this.mode === "campaign" && this.wave >= this.level.waves) {
      this._finalWaveCleared = true;
      // Category I: the level only ends once every objective is met. Until
      // then the waves keep coming -- overtime, not a fail state -- so a
      // player who is short on keys or accuracy can still finish.
      if (!G.Objectives.state || G.Objectives.allDone(this)) { this.onVictory(); return; }
      if (!this._overtimeAnnounced) {
        this._overtimeAnnounced = true;
        G.UI.flashPurchaseBanner(G.T("banner.objectivesLeft"), G.T("banner.objectivesLeftText"));
      }
    }
    // Category P: a cleared wave pays (kill money alone left the shop out of
    // reach). Round 2: for twenty waves, G.ECONOMY -- a boss wave adds its
    // boss's bounty; overtime pays like the last regular wave.
    this._waveBonus = G.ECONOMY.waveBonus(this.overtimeWave()) + (this.isBossWave() ? G.ECONOMY.bossBounty(this.wave) : 0);
    this.player.money += this._waveBonus;
    // (new series, round 1, A) six questions on this wave's words: passed,
    // the shop; failed, no shop -- the next wave at once (the money is kept
    // for the next shop). A window the player is in the middle of (a crate
    // being opened, a note being read) is finished first.
    if (["crate", "mystery", "inventory", "note", "dialog"].some((id) => G.Modal.isOpen(id))) { this._quizDue = true; return; }
    this.startWaveQuiz();
  },
  startWaveQuiz() {
    this._quizDue = false;
    G.Quiz.open(this, (passed) => {
      if (this.state !== "GAMEPLAY") return;
      if (passed) this.openShop(); else this.nextWave();
    });
  },
  // after the shop, or after a failed quiz: the checkpoint if it is due
  // (after wave 10's boss), then the next wave
  nextWave() {
    if (this._checkpointDue) { this._checkpointDue = false; if (G.Checkpoint && G.Checkpoint.save) G.Checkpoint.save(this); }
    this.startWave();
  },

  // ---------------- Shop ----------------
  openShop() {
    this.state = "SHOP";
    // (C) 45 s by default, set in Settings: 30 / 45 / 60, or no limit at all
    // -- then the next wave waits for Ready
    const lim = G.save.settings.shopTime;
    this.shopTimer = lim > 0 ? lim : Infinity;
    // Savings Account: a cut of the money carried into the shop, capped
    this._interest = 0;
    if (G.Perks.has("interest")) {
      const [pct, cap] = G.Perks.val("interest");
      this._interest = Math.min(cap, Math.floor(this.player.money * pct / 100));
      this.player.money += this._interest;
    }
    // this shop's four perks, from the shuffle bag (js/perks.js)
    this._perkOffer = G.PerkBag.draw(this.player);
    G.UI.setHudVisible(false);
    G.Modal.open("shop", { pause: true, keys: (e) => {
      if (e.code === "Enter" && !G.Modal.isOpen("crate") && !G.Modal.isOpen("inventory")) { this.leaveShop(); return true; }
      return false;
    } });
    G.UI.renderShop();
    G.UI.updateShopTimer(this.shopTimer, lim);
    G.Tutorial.shopTip();
    G.UI.showScreen("screen-shop");
  },
  // what Full Ammo tops a gun's reserve up to: the four spare magazines it
  // comes with
  fullReserve(id) { return Math.round(G.WEAPON_DEFS[id].magSize * this.player.weaponLevels[id].mag) * 4; },
  buyShopItem(item, price) {
    if (this.player.money < price) return;
    const pay = () => {
      this.player.money -= price;
      G.Audio.sfx("purchase");
      G.Shop.recordPurchase(item.id);
    };
    const curId = this.currentWeaponId();
    // A gun unlock with every slot full asks which gun to give up BEFORE it
    // takes the money; keeping the loadout costs nothing.
    if (item.kind === "unlock") {
      G.Loadout.offer(this, item.weapon, { source: "shop", onTake: pay });
      return;
    }
    pay();
    switch (item.kind) {
      case "upgrade_damage": if (curId !== "melee") this.player.weaponLevels[curId].dmg *= 1.15; break;
      case "upgrade_firerate": if (curId !== "melee") this.player.weaponLevels[curId].rate *= 1.10; break;
      case "upgrade_mag": if (curId !== "melee") this.player.weaponLevels[curId].mag *= 1.20; break;
      // Full Ammo: every gun carried gets a full magazine and its reserve
      // topped up to full (a reserve already above that is left alone)
      case "refill_ammo": this.player.gunSlots.forEach((id) => {
        const a = this.player.ammo[id];
        a.mag = Math.round(G.WEAPON_DEFS[id].magSize * this.player.weaponLevels[id].mag);
        a.reserve = Math.max(a.reserve, this.fullReserve(id));
      }); break;
      case "heal": this.player.hp = this.player.maxHp; break;
      case "crate": this.openCrate(G.rollRarity(), null, null, { source: "crate" }); break;
    }
  },
  buyPerk(id) {
    const P = G.Perks;
    if (P.maxed(id)) return;
    const price = P.price(id);
    if (this.player.money < price) return;
    this.player.money -= price;
    G.Shop.recordPurchase(id);
    G.Audio.sfx("purchase");
    P.apply(id, this);
  },
  leaveShop() {
    if (G.Modal.isOpen("crate")) G.Modal.close("crate");
    G.persist();
    this.state = "GAMEPLAY";
    G.UI.setHudVisible(true);
    G.UI.applyControlMode();
    G.UI.showScreen(null);
    G.Modal.close("shop");
    // (J, round 3: after wave 10's boss the run is kept here, with the health
    // the shop left -- js/checkpoint.js)
    this.nextWave();
  },

  // ---------------- Generic word challenge (doors/crates/traps) ----------------
  // opts: { pair (the word to ask, else one at random), time (seconds, before
  // Extra Time), boss (the question after a boss: its own look) }
  // opts.type: one of the eight kinds of question (else one by the word's
  // box -- vocabulary series, round 3, H5: js/questions.js)
  startWordChallenge(label, onSuccess, onFail, opts) {
    if (this.challenge) return;
    opts = opts || {};
    const pair = opts.pair || G.pick(this.wordPool);
    // the wrong answers are other words -- never one that means the same
    // thing; (round 2, E1) look-alikes for a word the player is getting to
    // know, clearly different ones for a new word
    const pool = this.wordPool && this.wordPool.length >= 4 ? this.wordPool : G.getAllBuiltinWords();
    const q = G.Questions.build(pair, opts.type || G.Questions.pickType(pair), pool);
    const limit = G.Questions.seconds(q.type, opts.time || 8) + (G.Perks.val("extra_time") || 0);   // Extra Time
    this.challenge = { pair, q, choices: q.spell ? [] : q.choices.map((c) => c.text), timeLeft: limit, timeLimit: limit, onSuccess, onFail, boss: !!opts.boss, stage: "question" };
    this._challengeEnd = null;
    G.Modal.open("challenge", { freeze: true, keys: (e) => this.challengeKey(e) });
    G.UI.setChallengeVisible(true, label, !!opts.boss);
    this.challengeView = G.UI.setChallengeQuestion(q, this.challengeHandlers());
    if (q.speak) this.sayChallenge();
  },
  challengeHandlers() {
    return {
      pick: (i) => this.answerChallenge(i),
      spell: (t) => this.answerChallenge(t),
      hint: () => { const c = this.challenge; if (c) c.q.hints = (c.q.hints || 0) + 1; },
      speak: () => this.sayChallenge(true),
    };
  },
  challengeKey(e) {
    const c = this.challenge;
    if (!c) return false;
    if (c.stage === "reveal") { if (e.code === "Enter" || e.code === "Space" || e.code === "Escape" || e.code === "KeyE") this.closeChallengeReveal(); return true; }
    G.QuestionView.key(e, c.q, this.challengeView && this.challengeView.pad, this.challengeHandlers());
    return true;
  },
  // a Listening question's word -- Play Once: the first time only
  sayChallenge(again) {
    const c = this.challenge;
    if (!c || !c.q.speak) return;
    if (again && c.q.played && G.save.settings.playOnce) { G.UI.flashAbilityNote && G.UI.flashAbilityNote(G.T("hud.playedOnce")); return; }
    c.q.played = (c.q.played || 0) + 1;
    G.Audio.speak(c.q.speak);
  },
  // k: the choice, or the word spelt
  answerChallenge(k) {
    const c = this.challenge;
    if (!c || c.stage !== "question") return;
    const q = c.q;
    if (q.spell && typeof k === "string" && !G.Spell.norm(k)) return;
    this._challengeEnd = "answer";
    const correct = G.Questions.isRight(q, k);
    // (vocabulary series, round 2-3) its box -- a recall answer for kinds 3-6
    // and spelling; a hint moves nothing -- and the word taken for it (E2)
    G.Learning.answerWord(c.pair, correct, { recall: q.recall, assisted: (q.hints || 0) > 0, picked: correct ? null : G.Questions.picked(q, k),
      typed: q.spell && !correct && typeof k === "string" ? G.Spell.norm(k) : null, inView: G.Questions.inView(q), skills: q.skills });
    if (!correct) {
      // the wrong-word list used to be fed `this.challenge` AFTER it had been
      // cleared, so every missed challenge was recorded under the word "null"
      this.wrongCount++; this.trackWrongWord(c.pair[0], c.pair[1]);
      this.revealChallenge(k);
      return;
    }
    const cb = c.onSuccess;
    G.UI.setChallengeVisible(false);
    this.challenge = null;
    this.correctCount++;
    cb && cb();
    // closed after the callback: a crate it opens keeps the cursor free
    G.Modal.close("challenge");
  },
  // (round 3, H3) wrong, or out of time: the right answer and the word in
  // context -- a sentence, a collocation, its sound -- until Continue
  revealChallenge(k) {
    const c = this.challenge;
    c.stage = "reveal";
    G.UI.showChallengeReveal(c.q, k, this.challengeView, () => this.closeChallengeReveal());
    G.Audio.sfx("wrong");
    G.Audio.speak(c.q.answerText || c.pair[0]);
  },
  closeChallengeReveal() {
    const c = this.challenge;
    if (!c || c.stage !== "reveal") return;
    const cb = c.onFail;
    G.UI.setChallengeVisible(false);
    this.challenge = null;
    cb && cb();
    G.Modal.close("challenge");
  },
  // (tests and the playtest bot) the open question answered right or wrong,
  // whatever its kind; a wrong one goes on past its reveal
  answerChallengeAs(right) {
    const c = this.challenge;
    if (!c) return;
    const q = c.q;
    if (q.spell) this.answerChallenge(right ? q.pair[0] : "qqqqq");
    else this.answerChallenge(right ? q.answer : (q.answer + 1) % q.choices.length);
    if (!right) this.closeChallengeReveal();
  },

  // Shove a zombie `dist` along (dx, dz) in short steps, stopping at the
  // first wall so it can't be pushed into one.
  pushZombie(z, dx, dz, dist) {
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len, p = z.mesh.position;
    const box = new THREE.Box3();
    const cols = G.ColGrid.near(this.world, p.x, p.z, dist + 1, []);
    for (let s = 0; s < dist; s += 0.2) {
      const x = p.x + ux * 0.2, zz = p.z + uz * 0.2;
      box.min.set(x - 0.3, p.y + 0.2, zz - 0.3); box.max.set(x + 0.3, p.y + 1.6, zz + 0.3);
      if (cols.some((c) => c.intersectsBox(box))) break;
      p.x = x; p.z = zz;
    }
  },

  // ---------------- Player death / results ----------------
  checkPlayerDeath() {
    if (this.player.hp > 0) return;
    // Second Life: once a wave, the blow that would have killed you leaves
    // you on a quarter of your health instead and throws back whatever is close
    if (G.Perks.has("second_life") && !this.player.secondLifeUsed) {
      this.player.secondLifeUsed = true;
      this.player.hp = this.player.maxHp * G.Perks.val("second_life") / 100;
      const p = this.yawObject.position;
      this.zombies.forEach((z) => {
        if (!z.alive || z.type === "boss") return;
        const dx = z.mesh.position.x - p.x, dz = z.mesh.position.z - p.z;
        if (Math.hypot(dx, dz) < 4.5) this.pushZombie(z, dx, dz, 3);
      });
      G.Audio.sfx("unlock");
      G.UI.flashPurchaseBanner(G.T("perk.second_life.name"), G.T("banner.secondLife"));
      return;
    }
    this.onGameOver();
  },
  onGameOver() {
    // (a study session ends with its own results, not the game-over screen)
    if (this.mode === "study" && G.Study) { G.Study.finish(this, "died"); return; }
    this.state = "GAME_OVER";
    if (G.Cutscene) G.Cutscene.stop();
    G.Audio.bossMusic(false);
    G.UI.setBossBar(false);
    G.Modal.reset();
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.setTouchControlsVisible(false);
    const cat = this.mode === "daily" ? "daily" : this.mode === "endless" ? "endless" : "level" + this.level.id;
    // (J4: a run that came back from its checkpoint is marked on the board)
    // (vocabulary series, round 4: a campaign run notes its Learning Style)
    G.addLeaderboardEntry(cat, this.player.score, this._continues ? "continued" : "", this.mode === "campaign" ? { style: this.learn.id } : null);
    if (this.mode === "endless") {
      G.save.endlessHighScore = Math.max(G.save.endlessHighScore, this.player.score);
      G.save.endlessHighWave = Math.max(G.save.endlessHighWave, this.wave);
      if (this.wave >= 10) G.unlockAchievement("endless_10");
    }
    if (this.mode === "daily") G.save.dailyHighScores[G.dailyKey()] = Math.max(G.save.dailyHighScores[G.dailyKey()] || 0, this.player.score);
    if (this.mode === "campaign") G.save.levelHighScores[this.level.id] = Math.max(G.save.levelHighScores[this.level.id] || 0, this.player.score);
    G.persist();
    G.UI.renderResultScreen("lose", { score: this.player.score, wave: this.wave, correct: this.correctCount, wrong: this.wrongCount, money: this.player.money, bosses: G.Bosses.run.downs }, this.wrongWordsThisRun);
    if (G.Checkpoint) G.Checkpoint.onGameOver(this);     // Continue from Wave 11, once there is a checkpoint
    G.UI.showScreen("screen-gameover");
  },
  onVictory() {
    this.state = "VICTORY";
    G.Modal.reset();
    G.Input.exitPointerLock();
    G.UI.setHudVisible(false);
    G.UI.setTouchControlsVisible(false);
    G.addLeaderboardEntry("level" + this.level.id, this.player.score, this._continues ? "continued" : "", { style: this.learn.id });
    G.save.levelHighScores[this.level.id] = Math.max(G.save.levelHighScores[this.level.id] || 0, this.player.score);
    // the level is done: its checkpoint goes (J3)
    if (G.Checkpoint) G.Checkpoint.remove(this.level.id);
    const nextId = this.level.id + 1;
    if (G.getLevel(nextId) && !G.save.unlockedLevels.includes(nextId)) G.save.unlockedLevels.push(nextId);
    if (!this.player.wasHitThisLevel) G.unlockAchievement("no_hit_level");
    if (G.LEVELS.every((l) => G.save.levelHighScores[l.id] !== undefined)) G.unlockAchievement("all_levels");
    G.persist();
    G.UI.renderResultScreen("win", { score: this.player.score, wave: this.wave, correct: this.correctCount, wrong: this.wrongCount, money: this.player.money, bosses: G.Bosses.run.downs }, this.wrongWordsThisRun);
    G.UI.showScreen("screen-victory");
  },

  // ---------------- Pause ----------------
  pause() {
    if (this.state !== "GAMEPLAY") return;
    this.paused = true; this.state = "PAUSE";
    this._pausedAt = performance.now();
    G.Input.exitPointerLock();
    // A finger still on FIRE/sprint when the pause screen opens never gets its
    // touchend, so clear the held state or it resumes with the trigger stuck.
    G.Input.clearHeldInputs();
    G.UI.applyControlMode();
    G.UI.renderPauseObjectives();
    G.UI.renderPausePerks();
    // round 3: the abilities held, the third floor's checklist, the checkpoint
    if (G.UI.renderPauseAbilities) G.UI.renderPauseAbilities();
    if (G.Floor3) G.Floor3.renderPause(this);
    if (G.Checkpoint) G.Checkpoint.renderPause(this);
    G.UI.showScreen("screen-pause");
  },
  resume() {
    // a window that was open under the pause menu (the crate reveal, a
    // question) is still open: it keeps its pause and the free cursor
    this.paused = G.Modal.pausesAll(); this.state = "GAMEPLAY";
    G.UI.showScreen(null);
    if (G.Modal.isOpen("crate")) G.UI.showScreen("screen-crate");
    if (G.Modal.isOpen("mystery")) G.UI.showScreen("screen-mystery");
    G.UI.applyControlMode();
    G.Modal.relock();
  },
  pauseForOverlay(v) { this.paused = v; },
  // the player is in control: not paused, no window open
  playing() { return this.state === "GAMEPLAY" && !this.paused && !G.Modal.isOpen() && !(G.Cutscene && G.Cutscene.active); },

  // ---------------- Update loop ----------------
  update(dt) {
    const realDt = dt;
    dt *= G.save.settings.gameSpeed;
    if (this.state === "SHOP") {
      // the shop's clock is real time (not the game speed), and it waits
      // while any other window is open on top of it -- the gun-slot choice,
      // a crate being opened
      const top = G.Modal.top();
      if (!top || top.id === "shop") {
        const was = Math.ceil(this.shopTimer);
        this.shopTimer -= realDt;
        const now = Math.ceil(this.shopTimer);
        // the last ten seconds: a warning at 10, then a tick each second
        if (Number.isFinite(this.shopTimer) && now !== was && now >= 1 && now <= 10) G.Audio.sfx(now === 10 ? "shop_warn" : "tick");
      }
      G.UI.updateShopTimer(this.shopTimer, G.save.settings.shopTime);
      G.UI.el("shop-money").textContent = this.player.money;
      if (this.shopTimer <= 0) this.leaveShop();
      return;
    }
    G.UI.updateResumeHint();
    // the end-of-wave quiz keeps its own clock while everything else is paused
    if (G.Quiz.active) G.Quiz.update(realDt);
    if (this.state !== "GAMEPLAY" || this.paused) return;
    // a boss's cutscene has the whole frame: the world stands still, nobody
    // is hurt, and it runs in real seconds whatever the game speed
    if (G.Cutscene.active) { G.Cutscene.update(this, realDt); return; }
    if (G.Modal.freezesWorld()) { this.updateFrozen(dt); return; }
    // a boss wave's zombies are down: the boss comes once no window is open
    if (G.Bosses.phase === "pending" && !G.Modal.isOpen()) { G.Bosses.start(this); return; }
    // (the end-of-wave quiz that waited for a window to close)
    if (this._quizDue && !G.Modal.isOpen()) { this.startWaveQuiz(); return; }

    // Focus Time: right after a right answer the zombies (and their spawns
    // and the traps) run at a third of the speed; the player does not
    this._slowmoT = Math.max(0, (this._slowmoT || 0) - dt);
    this._adrenalineT = Math.max(0, (this._adrenalineT || 0) - dt);
    const worldDt = this._slowmoT > 0 ? dt * 0.35 : dt;
    document.body.classList.toggle("slowmo", this._slowmoT > 0);

    this.updatePlayerMovement(dt);
    G.Abilities.update(this, dt);                      // round 3 (H): cooldowns and what is running
    this.updateRegen(dt);
    this.updateShooting(dt);
    if (G.Spell) G.Spell.update(this, dt);             // (vocabulary series, round 2) the spelling pad
    if (this.mode === "study" && G.Study) G.Study.update(this, dt);
    this.updateZombies(worldDt);
    G.Bosses.update(this, worldDt);
    if (this.state !== "GAMEPLAY") return;             // a boss's blow can end the run
    this.updateDyingZombies(dt);
    G.ZombieFX.update(this, dt);
    // (new series, round 1, B) the word under the crosshair, the words kept
    // apart, aim assist
    G.Aim.update(this, dt);
    this.updateDrops(dt);
    G.Loadout.update(this, dt);
    this.updateInteractRay();
    this.updateTraps(worldDt);
    this.updateRoomDoors(dt);
    this.updateSwingProps(dt);
    if (this.mode === "campaign") G.Objectives.update(dt, this);
    if (this._winNow) { this._winNow = false; this.onVictory(); return; }
    G.Tutorial.update(dt, this);
    this.updateAudio(dt);
    const camDir = new THREE.Vector3(-Math.sin(this.yawObject.rotation.y), 0, -Math.cos(this.yawObject.rotation.y));
    G.Perf.updateLights(this.yawObject.position, camDir, performance.now() / 1000);
    G.Perf.updateSparks(dt);
    G.ViewModel.updateProps(dt, this.world);
    G.Perf.cullZombies(this);
    if (G.Zones) G.Zones.update(this);
    if (G.Notes) G.Notes.update(this, dt);
    if (G.Floor3) G.Floor3.update(this, dt);
    if (G.Details) G.Details.update(this, dt);
    if (G.Sky) G.Sky.update(this, dt);
    if (G.Visuals) G.Visuals.update(this, dt);
    if (G.Glass) G.Glass.update(dt);
    this.relocateStragglers(worldDt);
    if (G.Minimap) G.Minimap.update(this, dt);
    G.updateDriftingFog(this.scene, this.world, performance.now() / 1000);
    if (this.world.dress) this.world.dress.update(dt, this.yawObject.position);
    G.updateSparks(this.scene, this.world, dt);
    this.updateChallengeTimer(dt);

    // Category P: requiredKills is the wave's quota, and the spawner stops
    // once it has been sent. It used to keep spawning for as long as anything
    // was alive, so a wave only ended in the rare gap where the player had
    // cleared the field before the next spawn tick -- the playtest bot sat in
    // wave 1 with 16 of 8 spawned and no end in sight. (Round 2: a boss wave
    // sends its own zombies first; nothing more comes once its boss does.)
    if (!G.Bosses.phase && this.spawnedCount < this.requiredKills) {
      G.Spawner.update(worldDt, this.world, this.zombies.length, this.level.maxAliveZombies, (type, pos, sp) => this.spawnZombieAt(type, pos, sp), this.currentDiff, this.yawObject.position, camDir);
    }
    this.checkWaveClear();

    G.UI.updateHud(this.buildHudState());
  },

  // (D) Health comes back by itself: once nothing has taken any for
  // regenDelay seconds (12), regenHp every regenEvery seconds (1 HP every 2 s)
  // until full -- G.CONFIG.player, js/config.js. Any loss at all -- a bite, a
  // trap, a wrong answer, a boss's roar -- stops it and starts the wait
  // again. It is measured here, by the health going down, rather than at
  // each source of damage, so nothing new can forget to reset it. Only runs
  // from the live update: paused, in a window or in the shop, neither the
  // health nor the wait moves.
  updateRegen(dt) {
    const pl = this.player, C = G.CONFIG.player;
    if (this._regenFor !== pl) { this._regenFor = pl; this._hpSeen = pl.hp; this._sinceHurt = 0; this.regenerating = false; this._regenTick = 0; }
    if (pl.hp < this._hpSeen - 1e-6) { this._sinceHurt = 0; this._regenTick = 0; }
    else this._sinceHurt += dt;
    const was = this.regenerating;
    this.regenerating = this._sinceHurt >= C.regenDelay && pl.hp > 0 && pl.hp < pl.maxHp;
    if (this.regenerating) {
      if (!was) { G.Audio.sfx("regen"); this._regenTick = 0; }
      this._regenTick += dt;
      while (this._regenTick >= C.regenEvery) { this._regenTick -= C.regenEvery; pl.hp = Math.min(pl.maxHp, pl.hp + C.regenHp); }
    }
    this._hpSeen = pl.hp;
  },

  // A question window is open: the world holds still -- no zombie steps,
  // spawns, traps or player movement -- while the question's own timer runs
  // and everything alive keeps breathing in place.
  updateFrozen(dt) {
    if (this.world.dress) this.world.dress.update(dt);
    // (anyone still coming in waits with the rest of the world)
    this.zombies.forEach((z) => { if (z.alive && !z.emerge) z.animate(dt, 0); });
    G.Arena.update(dt);
    G.ZombieFX.update(this, dt);
    this.updateDyingZombies(dt);
    this.updateSwingProps(dt);
    this.updateAudio(dt);
    G.Perf.updateSparks(dt);
    G.ViewModel.updateProps(dt, this.world);
    G.updateSparks(this.scene, this.world, dt);
    this.updateChallengeTimer(dt);
    if (this.state !== "GAMEPLAY") return;   // a wrong answer can end the run
    G.UI.updateHud(this.buildHudState());
  },

  buildHudState() {
    const id = this.currentWeaponId();
    const def = this.currentWeaponDef();
    const ammoInMag = id === "melee" ? 0 : this.player.ammo[id].mag;
    const ammoReserve = id === "melee" ? 0 : this.player.ammo[id].reserve;
    // the knife, every gun held, then any free slots (shown empty, so the
    // capacity the Extra Weapon Slot perk adds can be seen)
    const slots = [{ active: this.player.currentSlot === 0 }].concat(this.player.gunSlots.map((_, i) => ({ active: this.player.currentSlot === i + 1 })));
    for (let i = this.player.gunSlots.length; i < G.Loadout.maxSlots(this); i++) slots.push({ active: false, empty: true });
    // (a boss fight with nothing else about: where to aim instead -- or, in
    // the Examiner's Multiple Choice, the meaning whose word to shoot)
    const fb = G.Bosses.fighting() ? G.Bosses.boss : null;
    const bossHint = fb ? (fb.choiceMeaning || G.T("hud.bossAim", { w: G.T("boss." + fb.def.id + ".weak") })) : null;
    let meaning = this.targetPair ? this.targetPair[1] : (this.zombies.length ? "-" : bossHint || G.T("hud.waiting"));
    // Hint Reader: the first letter, and at level 2 how many letters
    // (round 3: the Whisper ability says more -- the first three and the length)
    const hint = G.Perks.level("perk_hint");
    // (round 3: the first units and the length of the word in its language --
    // Thai clusters, Chinese characters)
    if (this.targetPair && G.Abilities.whisper()) {
      const w = this.targetPair[0], wl = G.Lang.wl(this.targetPair);
      meaning += G.T("hud.whisper", { s: G.SpellUnits.first(w, wl, 3).toUpperCase(), n: G.SpellUnits.count(w, wl) });
    } else if (hint && this.targetPair) {
      const w = this.targetPair[0], wl = G.Lang.wl(this.targetPair);
      meaning += hint >= 2 ? G.T("hud.hintLen", { c: G.SpellUnits.first(w, wl, 1).toUpperCase(), n: G.SpellUnits.count(w, wl) })
        : G.T("hud.hintFirst", { c: G.SpellUnits.first(w, wl, 1).toUpperCase() });
    }
    // (vocabulary series, round 2) what kind of clue this is: the word to
    // shoot, or -- nothing to shoot -- the one the spelling pad is on
    let meaningLabel = G.T("hud.shootMeaning");
    // (round 3) and which clue: the Thai, a definition (with the Thai under
    // it while the word is new, or a button for it), a sentence with a gap,
    // or only its sound
    let clueKind = "thai", clueSub = "", thaiBtn = false;
    const sf = G.Spell && G.Spell.active ? G.Spell.focus : null;
    const tc = this.targetPair ? this.targetClue : null;
    const suffix = this.targetPair ? meaning.slice(this.targetPair[1].length) : "";
    if (tc && tc.kind === "definition") {
      clueKind = "definition"; meaningLabel = G.T("hud.clue.definition");
      meaning = (tc.full || G.Clues.definition(tc.pair)) + suffix;
      if (G.Learn.showsThai(tc.pair) || tc.thaiShown) clueSub = this.targetPair[1]; else thaiBtn = true;
    } else if (tc && tc.kind === "cloze") {
      clueKind = "cloze"; meaningLabel = G.T("hud.clue.cloze");
      meaning = (tc.cloze ? tc.cloze.text : this.targetPair[1]) + suffix;
    } else if (tc && tc.kind === "audio") {
      // (in the campaign the zombies carry English words: shoot the one heard)
      clueKind = "audio"; meaningLabel = G.T(this.mode === "study" ? "hud.clue.audio" : "hud.clue.audioWord");
      meaning = "🔊" + suffix;
    } else if (!this.targetPair && sf) {
      meaningLabel = G.T("hud.spellMeaning");
      meaning = sf.clue;
      if (sf.clueKind === "definition") {
        clueKind = "definition"; meaningLabel = G.T("hud.clue.definitionSpell");
        meaning = sf.clueFull || sf.clue;
        if (G.Learn.showsThai(sf.pair) || sf._thaiShown) clueSub = sf.meaning; else thaiBtn = true;
      } else if (sf.clueKind === "audio") { clueKind = "audio"; meaningLabel = G.T("hud.clue.audioSpell"); meaning = "🔊"; }
      else if (sf.clueKind === "cloze") { clueKind = "cloze"; meaningLabel = G.T("hud.clue.clozeSpell"); meaning = sf.clueFull || sf.clue; }
    }
    else if (!this.targetPair && G.Spell && G.Spell.active && this.learn && !this.learn.shoots) meaningLabel = G.T("hud.spellMeaning");
    // (round 3, H4) a Chinese meaning at the top: its pinyin over it
    let meaningRuby = null;
    const mp = clueKind === "thai" ? (this.targetPair || (sf && sf.pair)) : null;
    if (mp && G.Lang.showPinyin() && G.Lang.ml(mp) === "zh" && String(meaning).indexOf(mp[1]) === 0) meaningRuby = { text: mp[1], py: G.Lang.pinyin(mp, 1), rest: String(meaning).slice(mp[1].length) };
    const campaign = this.mode === "campaign";
    return {
      hp: (this.player.hp / this.player.maxHp) * 100, stamina: (this.stamina / this.maxStamina) * 100,
      staminaExhausted: this.staminaExhausted, money: this.player.money, score: this.player.score,
      levelLabel: this.mode === "study" && G.Study ? G.Study.hudLabel(this) : G.T("hud.levelWave", { level: this.level.name, wave: this.wave + (campaign ? "/" + this.level.waves : "") }) +
        (campaign && this.wave > this.level.waves ? G.T("hud.overtime") : ""),
      objectives: G.Objectives.state ? G.T("hud.objectives", { d: G.Objectives.doneCount(this), n: G.Objectives.list(this).length }) : null,
      // what is still between the player and the end of the wave: the ones
      // alive plus the rest of the quota still to come (a decoy is not one)
      zombiesLeft: this.zombies.filter((z) => !z.decoy).length + (G.Bosses.phase ? 0 : Math.max(0, this.requiredKills - this.spawnedCount)), weaponName: def.name,
      meaningLabel, clueKind, clueSub, thaiBtn, meaningRuby,
      isMelee: id === "melee",
      weightLabel: def.id === "melee" ? null : G.weightClass(def).label,
      weightColor: def.id === "melee" ? null : G.weightClass(def).color,
      ammoInMag, ammoReserve, currentMeaning: meaning, slots, combo: this.player.combo,
      regenerating: !!this.regenerating,
      // (new series, round 1, E: the touch reload button's ring)
      reloadFrac: this.player.reloading && this.reloadState ? Math.min(1, this.reloadState.t / this.reloadState.plan.dur) : 0,
    };
  },

  updatePlayerMovement(dt) {
    // Look
    let dx = 0, dy = 0;
    if (G.Input.mode === "desktop") { const d = G.Input.consumeMouseDelta(); dx = d.x; dy = d.y; }
    else { const d = G.Input.consumeMouseDelta(); dx = d.x; dy = d.y; }
    const gp = G.Input.pollGamepad();
    if (gp) {
      // (new series, round 2, F: the look speed is a setting now)
      const P = G.CONFIG.pad, k = P.look * (Number(G.save.settings.padSensitivity) || 1);
      const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
      if (Math.abs(rx) > P.deadzone) dx += rx * k;
      if (Math.abs(ry) > P.deadzone) dy += ry * k;
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
    // (vocabulary series, round 2) typing the words: every letter goes into
    // the bar, so the arrow keys walk (D1); spelling to reload: the player
    // stands still until it is answered (D2)
    const typing = G.Spell && G.Spell.typing();
    const feetHeld = G.Modal.isOpen("spellreload");
    if (feetHeld) { /* standing still */ }
    else if (G.Input.mode === "desktop") {
      if (typing) {
        const K = G.Input.keys;
        if (K.ArrowUp) mz -= 1;
        if (K.ArrowDown) mz += 1;
        if (K.ArrowLeft) mx -= 1;
        if (K.ArrowRight) mx += 1;
      } else {
        if (G.Input.isDown("forward")) mz -= 1;
        if (G.Input.isDown("back")) mz += 1;
        if (G.Input.isDown("left")) mx -= 1;
        if (G.Input.isDown("right")) mx += 1;
      }
    } else {
      mx = G.Input.touchMove.x; mz = G.Input.touchMove.y;
    }
    if (gp && !feetHeld) {
      const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
      if (Math.abs(lx) > 0.15) mx += lx;
      if (Math.abs(ly) > 0.15) mz += ly;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    // Sprint is gated by stamina (category I): held sprint only speeds you up
    // while stamina remains, and only actually drains while you're moving --
    // holding the key while standing still costs nothing.
    const sprintHeld = (G.Input.mode === "desktop" && G.Input.isDown("sprint")) || G.Input.touchSprint || G.Input.padSprint;
    // Animation pass A3: a fresh press of sprint abandons a reload in progress
    // (the magazine never goes in, so no ammo is added). A sprint that was
    // already held when the reload began is ignored until it is released.
    const sprintPressed = sprintHeld && !this._prevSprintHeld;
    this._prevSprintHeld = sprintHeld;
    if (!sprintHeld) this._sprintLatch = false;
    if (sprintPressed && this.player.reloading && len > 0.05) { this.cancelReload(); this._sprintLatch = false; }
    const wantSprint = sprintHeld && !this._sprintLatch;
    // A3: at exactly 0 stamina the old check (stamina > 0) flipped back on the
    // very next frame, because the non-sprint branch regenerates -- so holding
    // sprint at empty alternated drain/regen frames and still moved you at
    // roughly sprint speed forever. Now running out latches an exhausted state
    // that only clears once stamina is back above 20%.
    // Second Wind: stamina comes back twice as fast, and running dry locks
    // sprint out only until 10% is back instead of 20%
    const secondWind = G.Perks.has("second_wind"), PC = G.CONFIG.player;
    if (this.stamina <= 0) this.staminaExhausted = true;
    else if (this.staminaExhausted && this.stamina >= this.maxStamina * (secondWind ? 0.1 : 0.2)) this.staminaExhausted = false;
    const sprinting = wantSprint && !this.staminaExhausted && len > 0.05;
    // Category E: what you are carrying slows you down, and tires you faster.
    // A pistol costs nothing; a grenade launcher takes a quarter off your top
    // speed and burns stamina half again as fast.
    const wcls = G.weightClass(this.currentWeaponDef());
    // Pack Mule: half of that penalty is gone
    const mule = G.Perks.has("pack_mule") ? G.Perks.val("pack_mule") / 100 : 0;
    const speedMult = 1 - (1 - wcls.speedMult) * (1 - mule), staminaMult = 1 + (wcls.staminaMult - 1) * (1 - mule);
    // (Overdrive, round 3: sprinting costs nothing while it lasts)
    if (sprinting && !G.Abilities.freeStamina()) this.stamina = Math.max(0, this.stamina - PC.staminaDrain * staminaMult * dt);
    else if (!sprinting) this.stamina = Math.min(this.maxStamina, this.stamina + PC.staminaRegen * (secondWind ? G.Perks.val("second_wind") : 1) * dt);
    // Adrenaline: a burst of speed for three seconds after every kill
    const rush = this._adrenalineT > 0 ? 1 + G.Perks.val("adrenaline") / 100 : 1;
    // a boss's roar slows you down; its roots hold you where you stand
    // (5.2 sprint / 3.2 walk: G.Bosses.LASER_SPEED is exactly the walk)
    this.bossRootT = Math.max(0, (this.bossRootT || 0) - dt);
    // (new series, round 2: a sedative needle, or a thorn wall, slows you a while)
    this.bossSedateT = Math.max(0, (this.bossSedateT || 0) - dt);
    const held = (this.bossSlow || 1) * (this.bossRootT > 0 ? 0 : 1) * (this.bossSedateT > 0 ? (this.bossSedateK || 1) : 1);
    const speed = (sprinting ? PC.sprintSpeed : PC.walkSpeed) * this.player.moveSpeedMult * speedMult * rush * held * G.Abilities.moveMult() * dt;
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
    const jumpPressed = !feetHeld && ((G.Input.mode === "desktop" && !typing && G.Input.isDown("jump")) || G.Input.touchJump || (G.Input.padJump && !(G.Spell && G.Spell.active)));
    if (jumpPressed && this.yawObject.position.y <= baseEyeY + 0.01 && this.velocityY === 0) this.velocityY = PC.jumpSpeed;
    this.velocityY -= 9.8 * dt;
    this.yawObject.position.y += this.velocityY * dt;
    if (this.yawObject.position.y < baseEyeY) { this.yawObject.position.y = baseEyeY; this.velocityY = 0; }

    // Aim Down Sights (category H): right mouse button held narrows the FOV
    // and pulls the weapon toward center, blended over time (not an instant
    // snap) so it reads as a deliberate aim rather than a jump-cut.
    const def = this.currentWeaponDef();
    const wantAim = (G.Input.aimDown || G.Input.padAim) && def.id !== "melee" && !this.challenge;
    const aimSpeed = 10;
    this.aimT += ((wantAim ? 1 : 0) - this.aimT) * Math.min(1, aimSpeed * dt);
    if (Math.abs(this.aimT) < 0.002) this.aimT = 0;
    if (Math.abs(this.aimT - 1) < 0.002) this.aimT = 1;
    // Category N: a sniper's `scope` is its own aimed FOV, well past the
    // general ADS zoom, and it draws a scope overlay once fully shouldered.
    const aimedFov = def.scope || this.aimFov;
    this.camera.fov = this.baseFov + (aimedFov - this.baseFov) * this.aimT + G.Abilities.fovKick() * (1 - this.aimT);
    this.camera.updateProjectionMatrix();
    if (G.UI.setAimingVisual) G.UI.setAimingVisual(this.aimT > 0.5);
    if (G.UI.setScopeVisual) G.UI.setScopeVisual(!!def.scope && this.aimT > 0.85);
    if (G.UI.setChargeMeter) G.UI.setChargeMeter(def.charge ? (this._chargeT || 0) / def.charge.time : null);

    this.updateWeaponAnim(dt);
    const a = this.weaponAnim;

    // Animation pass A: what the rigs need to know about this frame -- how fast
    // the player REALLY moved (after collisions), and how fast the view turned
    const pos = this.yawObject.position;
    const vel = new THREE.Vector3();
    if (this._prevPos) {
      vel.set((pos.x - this._prevPos.x) / dt, 0, (pos.z - this._prevPos.z) / dt);
      if (vel.length() > 12) vel.set(0, 0, 0);            // a teleport, not a step
    }
    this._prevPos = pos.clone();
    const yawNow = this.yawObject.rotation.y, pitchNow = this.pitchObject.rotation.x;
    let dYaw = this._prevYaw === undefined ? 0 : yawNow - this._prevYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    const lookYaw = dYaw / dt, lookPitch = this._prevPitch === undefined ? 0 : (pitchNow - this._prevPitch) / dt;
    this._prevYaw = yawNow; this._prevPitch = pitchNow;
    const airborne = this.velocityY !== 0;
    // (a run answered only by spelling has no trigger: the words are the shots)
    const rawFire = !this.challenge && !feetHeld && !(this.learn && !this.learn.shoots) && ((G.Input.mode === "desktop" && G.Input.mouseDown) || G.Input.touchFire || G.Input.padFire);

    G.PlayerBody.stepGait(dt, vel, yawNow, airborne);
    // the camera rides the same gait (animation pass B), before the gun so
    // the gun can trail it
    G.HeadBob.update({ dt, rig: this, aimT: this.aimT, lookYaw, vel, yaw: yawNow,
      weightKey: G.ViewModel.weightKey(def), airborne });
    this.applyShake(dt);
    G.ViewModel.update({
      dt, def, aimT: this.aimT, sprinting, firing: rawFire, lookYaw, lookPitch, airborne,
      recoilPos: a.recoilPos, recoilRot: a.recoilRot, switchP: this.switchProgress(),
      reload: this.player.reloading ? this.reloadState : null, vel, yaw: yawNow,
    });
    G.PlayerBody.update({ dt, airborne, sprinting, weightKey: G.ViewModel.weightKey(def), aimT: this.aimT, lookYaw });

    // A shotgun being loaded shell by shell can be fired as soon as it holds
    // one: the trigger abandons the rest of the reload.
    if (rawFire && this.player.reloading && this.reloadState && this.reloadState.plan.style === "shotgun"
      && this.player.ammo[this.reloadState.id] && this.player.ammo[this.reloadState.id].mag > 0) this.cancelReload();

    // fire input (suppressed while a word-challenge popup wants the click for
    // its answer buttons, while a weapon swap is still in progress, and until
    // the gun has come down out of the sprint carry -- pulling the trigger is
    // what brings it down)
    const sprintCarry = G.ViewModel.S && G.ViewModel.S.sprintW > 0.25;
    const wantFire = rawFire && this.weaponAnim.switchT <= 0 && !sprintCarry;

    // Category N: a charge weapon winds up while the trigger is held and fires
    // on release, with damage scaling from 1x to its charge multiplier.
    if (def.charge) {
      if (wantFire) {
        this._chargeT = Math.min(def.charge.time, (this._chargeT || 0) + dt);
        G.GunAudio.chargeUpdate(def, this._chargeT / def.charge.time);   // the hum climbs
      } else if (this._chargeT > 0) {
        const frac = this._chargeT / def.charge.time;
        this._chargeT = 0;
        G.GunAudio.chargeStop();
        if (frac > 0.12) this.fireWeapon(frac);
      }
    } else {
      this._chargeT = 0;
      if (wantFire && (def.auto || def.id === "melee" || this._fireEdge)) this.fireWeapon();
    }
    this._fireEdge = false;

    // remaining rounds of a burst, on their own much shorter timer
    if (this._burst) {
      if (this._burst.id !== this.currentWeaponId() || this.player.reloading) this._burst = null;
      else {
        this._burst.timer -= dt;
        if (this._burst.timer <= 0) {
          this.fireWeapon(this._burst.charge, true);
          // fireWeapon drops the burst itself when the magazine runs dry
          // mid-burst; carrying on used to throw here (found by the bot)
          if (!this._burst) return;
          this._burst.left--;
          this._burst.timer = (def.burstDelay || 60) / 1000;
          if (this._burst && this._burst.left <= 0) this._burst = null;
        }
      }
    }
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
    for (const c of G.ColGrid.near(this.world, pos.x, pos.z, 1.2, this._moveCols || (this._moveCols = []))) {
      if (box(pos.x + dx, pos.z).intersectsBox(c)) blockedX = true;
      if (box(pos.x, pos.z + dz).intersectsBox(c)) blockedZ = true;
    }
    if (!blockedX) pos.x += dx;
    if (!blockedZ) pos.z += dz;
  },

  updateShooting(dt) {
    this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);
    // the reload routine: its events (magazine seated, a shell pushed in) are
    // what actually move ammo -- see reload() and onReloadEvent()
    const R = this.reloadState;
    // Quick Hands: the whole reload routine (and its animation, which reads
    // R.t) plays faster
    const hands = 1 + (G.Perks.val("quick_hands") || 0) / 100;
    if (this.player.reloading && R) {
      R.t += dt * hands;
      const evs = R.plan.events;
      while (R.next < evs.length && evs[R.next].t <= R.t) this.onReloadEvent(evs[R.next++].kind, R);
      if (R.t >= R.plan.dur) { this.player.reloading = false; this.reloadState = null; }
    } else if (this.player.reloading) this.player.reloading = false;
    // Category E1: a swap no longer snaps the new model in instantly -- the
    // old gun drops out of frame, the model is swapped at the bottom of that
    // dip, and the new one rises into place (firing is locked out until it's
    // finished, see the wantFire gate in updatePlayerMovement).
    if (this._lastWeaponId !== this.currentWeaponId()) {
      const first = !this.weaponViewGroup;
      this._lastWeaponId = this.currentWeaponId();
      if (first) { this.buildWeaponViewModel(); }
      else {
        // a heavy gun takes longer to put away and to bring up
        const from = G.ViewModel.def, to = this.currentWeaponDef();
        this.weaponAnim.switchDur = (G.ViewModel.switchDuration(from) + G.ViewModel.switchDuration(to)) / 2 / hands;
        this.weaponAnim.switchT = this.weaponAnim.switchDur;
        this.weaponAnim.pendingRebuild = true;
        // the old gun put away, the new one drawn -- each with its own sound
        G.GunAudio.swap(from, to, this.weaponAnim.switchDur);
        G.GunAudio.chargeStop();
        this.cancelReload();
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
    // every staircase (round 3 adds the flight up to the third floor): which
    // one a body is part-way up, if any
    const stairs = this.world.stairs || [];
    const flightOf = (x, zz, y) => {
      for (const s of stairs) if (y > s.y0 + 0.3 && y < s.y1 - 0.3 && x >= s.block.min.x && x <= s.block.max.x && zz >= s.block.min.z && zz <= s.block.max.z) return s;
      return null;
    };
    const pFeet = playerPos.y - 1.7, pFlight = flightOf(playerPos.x, playerPos.z, pFeet);
    const tmpV = new THREE.Vector3();
    for (const z of this.zombies) {
      if (!z.alive) continue;
      // still coming in (out of the ground, a locker, a vent...): it can be
      // shot but cannot move or bite yet
      if (z.emerge) { G.ZombieFX.step(this, z, dt); continue; }
      // (round 3, H) an ability on it: frozen or dazed it stands (a frozen
      // one does not even sway), lost in smoke or drawn to a decoy it walks
      // elsewhere, in a slow field or glue it is slower. None of it hurts.
      const mod = G.Abilities.zombieMod(this, z, dt);
      if (mod.skip) {
        if (!mod.frozen) z.animate(dt, 0);
        z.attackCooldown -= dt;
        continue;
      }
      const noBite = mod.noBite, zdt = dt * mod.speed, abTarget = mod.target;
      const zRegion = G.getRegionAt(this.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
      let moveTarget = playerPos;
      // Mid-flight the region lookup flips between the hall (below 2.3) and
      // the gallery (above), and each re-plan pointed the other way, so a
      // zombie could shuffle on the middle treads for good. On the stairs it
      // simply heads for the top or the foot, whichever floor the player is on.
      const zp0 = z.mesh.position;
      const zFlight = flightOf(zp0.x, zp0.z, zp0.y);
      if (zFlight && pFlight !== zFlight) {
        const node = this.world.waypointNodes[pFeet > (zFlight.y0 + zFlight.y1) / 2 ? zFlight.top : zFlight.foot];
        moveTarget = new THREE.Vector3(node.x, 0, node.z);
        z.navPath = null;
      } else if (zRegion !== pRegion) {
        if (!z.navPath || z.navTargetRegion !== pRegion || z.navRegion !== zRegion || z.navRepathTimer === undefined || z.navRepathTimer <= 0) {
          z.navPath = G.findPath(this.world, zRegion, pRegion);
          z.navIndex = 0;
          // Don't walk back to a waypoint already passed. A re-plan halfway up
          // the staircase starts again from the stair-foot node; if the zombie
          // is already on the leg to the next node, skip ahead to it.
          const nodes = this.world.waypointNodes, zp = z.mesh.position;
          while (z.navIndex < z.navPath.length - 1) {
            const a = nodes[z.navPath[z.navIndex]], b = nodes[z.navPath[z.navIndex + 1]];
            const abx = b.x - a.x, abz = b.z - a.z, len2 = abx * abx + abz * abz || 1;
            const k = Math.max(0, Math.min(1, ((zp.x - a.x) * abx + (zp.z - a.z) * abz) / len2));
            const off = Math.hypot(a.x + abx * k - zp.x, a.z + abz * k - zp.z);
            const sameLeg = (a.y === undefined || b.y === undefined || Math.abs(zp.y - (a.y + (b.y - a.y) * k)) < 1.5);
            if (off < 1.5 && sameLeg && Math.hypot(b.x - zp.x, b.z - zp.z) < Math.sqrt(len2)) z.navIndex++;
            else break;
          }
          z.navTargetRegion = pRegion;
          z.navRegion = zRegion;
          z.navRepathTimer = 1.0 + G.rng() * 0.5;
        }
        z.navRepathTimer -= dt;
        if (z.navPath.length && z.navIndex < z.navPath.length) {
          const node = this.world.waypointNodes[z.navPath[z.navIndex]];
          // reached = close AND on the same floor: the gallery node sits right
          // above the hall floor, and a zombie under it had not "reached" it
          // A door's approach node (DW1, DENTRY...) must be reached properly:
          // counted from 1.3 away, a zombie that had just bashed its way out
          // still stood in line with the wall, turned for the next node and
          // caught the end of the wall -- back and forth at the doorway.
          const reach = /^D[A-Z]/.test(z.navPath[z.navIndex]) ? 0.75 : 1.3;
          if (Math.hypot(node.x - z.mesh.position.x, node.z - z.mesh.position.z) < reach &&
            (node.y === undefined || Math.abs(node.y - z.mesh.position.y) < 1.5)) z.navIndex++;
        }
        if (z.navPath.length && z.navIndex < z.navPath.length) {
          const node = this.world.waypointNodes[z.navPath[z.navIndex]];
          moveTarget = new THREE.Vector3(node.x, 0, node.z);
          if (/^D[A-Z]/.test(z.navPath[z.navIndex])) moveTarget.stopAt = 0.3;
        }
      } else {
        z.navPath = null;
        // (new series, round 1, B2) in the player's own area: from several
        // sides, not in single file
        if (!abTarget && !zFlight) moveTarget = G.Crowd.flank(this, z, playerPos, pRegion) || playerPos;
      }
      // The staircase is only for zombies that mean to use it: one on it or
      // routed over it, or chasing a player who is on it. Anyone else treats
      // the flight as solid instead of wandering up the bottom tread.
      let stairKeepOut = null, keepStair = null;
      const zy = z.mesh.position.y;
      for (const s of stairs) {
        if (Math.abs(zy - s.y0) > 0.3 || pFeet > s.y0 + 0.3) continue;
        const route = z.navPath && zRegion !== pRegion ? z.navPath.slice(z.navIndex) : [];
        if (s.nodes.some((n) => route.includes(n))) continue;
        const bx = (s.block.min.x + s.block.max.x) / 2, bz = (s.block.min.z + s.block.max.z) / 2;
        if (Math.abs(bx - z.mesh.position.x) > 12 || Math.abs(bz - z.mesh.position.z) > 12) continue;
        stairKeepOut = s.block; keepStair = s;
        break;
      }
      // Already standing in that area (at the foot of the flight): step out
      // the front of it first. Chasing straight from there walked it onto the
      // bottom tread, which sent it back to the foot, which walked it onto
      // the tread... -- a stall the playtest bot hit twice.
      // (Straight out past the front edge -- the stair-foot node itself can be
      // under 0.9 away, and a zombie that close to its target doesn't move.)
      if (stairKeepOut && stairKeepOut.containsPoint(tmpV.set(z.mesh.position.x, keepStair.y0 + 0.1, z.mesh.position.z))) {
        const sb = stairKeepOut, ex = keepStair.exit;
        moveTarget = ex.z > 0 ? new THREE.Vector3(z.mesh.position.x, 0, sb.max.z + 1.5)
          : ex.z < 0 ? new THREE.Vector3(z.mesh.position.x, 0, sb.min.z - 1.5)
            : ex.x > 0 ? new THREE.Vector3(sb.max.x + 1.5, 0, z.mesh.position.z) : new THREE.Vector3(sb.min.x - 1.5, 0, z.mesh.position.z);
        stairKeepOut = null;
      }
      if (abTarget) { moveTarget = abTarget; stairKeepOut = null; }   // the decoy, or wandering in smoke
      z._goal = moveTarget;          // where it is headed (see updateRoomDoors)
      const near = G.ColGrid.near(this.world, z.mesh.position.x, z.mesh.position.z, 2.4, z._cols || (z._cols = []));
      const dist = z.update(zdt, moveTarget, abTarget || playerPos, near, G.save.settings.gameSpeed, stairKeepOut);
      z.mesh.position.y = G.getFloorHeightAt(this.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
      // a bite needs the same floor too -- the distance is measured flat, so a
      // zombie on the hall floor could bite a player on the gallery above it
      // (and a player in the air -- Pole Vault -- is out of reach)
      const sameFloor = Math.abs(z.mesh.position.y - (playerPos.y - 1.7)) < 1.5;
      if (!noBite && dist !== undefined && dist < 1.1 && sameFloor && z.attackCooldown <= 0) {
        z.attackCooldown = 1.0;
        if (z.lunge) z.lunge();
        // (Dash: nothing lands while it lasts; Barrier: a quarter does)
        // (vocabulary series, round 2, C2) the zombie carrying the word asked
        // got to the player first: a wrong answer on that word (once)
        this.learnBitten(z);
        const dmg = z.damage * (1 - this.player.armorPct) * G.Abilities.damageTakenMult();
        if (dmg <= 0) continue;
        this.player.hp -= dmg;
        G.Audio.sfx("hurt");
        this.player.wasHitThisLevel = true;
        G.UI.flashDamage();
        // Thorns: the biter takes damage back and is thrown off. Never the
        // killing blow -- a kill the player did not aim would count as a
        // wrong answer.
        if (G.Perks.has("thorns") && z.type !== "boss") {
          z.hp = Math.max(1, z.hp - G.Perks.val("thorns"));
          G.spawnHitParticles(this.scene, z.mesh.position.clone().setY(z.mesh.position.y + 1.2), 0x9be86b, G.save.settings.graphicsQuality);
          this.pushZombie(z, z.mesh.position.x - playerPos.x, z.mesh.position.z - playerPos.z, 1.8);
        }
        this.checkPlayerDeath();
        // (vocabulary series, round 2) a study session: one bite and it goes,
        // its word shown and brought back later -- a slow speller is taught,
        // not overrun
        if (this.mode === "study" && G.Study && this.state === "GAMEPLAY" && z.alive) {
          G.Study.onBite(this, z);
          this.ensureTargetHasMatch();
          this.checkWaveClear();
        }
      }
    }
    // (new series, round 1, B2) none standing in another
    G.Crowd.separate(this, dt);
  },

  // Round 3 (F3): a zombie left far behind -- past the fog, or two storeys
  // away -- is not simulated walking back across the campus for a minute.
  // After a few seconds out there it is brought in again round the player,
  // from a fixed point or up through the ground, with its word unchanged.
  relocateStragglers(dt) {
    this._relocT = (this._relocT || 0) - dt;
    // (not in a boss's arena: a zombie brought in round the player could land
    // on the far side of its energy wall)
    if (this._relocT > 0 || !this.world || !this.world.campus || this._noRelocate || G.Bosses.phase) return;
    this._relocT = 1;
    const p = this.yawObject.position, feet = p.y - 1.7;
    const fwd = new THREE.Vector3(-Math.sin(this.yawObject.rotation.y), 0, -Math.cos(this.yawObject.rotation.y));
    const far = (this.scene.fog ? this.scene.fog.far : 40) + 14;
    for (const z of this.zombies) {
      if (!z.alive || z.emerge || z.type === "boss") continue;
      const d = Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z) + Math.abs(z.mesh.position.y - feet) * 4;
      if (d < far) { z._farT = 0; continue; }
      if ((z._farT = (z._farT || 0) + 1) < 4) continue;
      const sp = G.Spawner.pickPoint(this.world, p, fwd);
      if (!sp) continue;
      z._farT = 0;
      z.mesh.position.copy(sp.emerge ? sp.emerge.end : sp.pos);
      z.navPath = null; z._lastTgt = null; z._posRef = null;
      if (sp.emerge) G.ZombieFX.begin(this, z, sp);
      sp.cooldown = Math.max(sp.cooldown || 0, 2.5);
      this.relocated = (this.relocated || 0) + 1;
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
    const T = G.T, key = G.interactKeyLabel();
    let label = "";
    this._lookedAtInteractable = null;
    if (hits.length) {
      // Walk the whole parent chain: interactables are groups now (doors have
      // a panel + handle under a hinge pivot), so a single .parent hop isn't
      // always enough to get back to the registered mesh.
      let obj = hits[0].object, found = null;
      while (obj && !found) { found = this.world.interactables.find((i) => i.mesh === obj); obj = obj.parent; }
      this._lookedAtInteractable = found;
      if (found) {
        label = T("hud.interact", { key });
        if (found.kind === "door") label = found.ref.opened ? "" : T("prompt.wordDoor", { key });
        if (found.kind === "button") label = found.ref.pressed ? T("prompt.buttonDone") : T("prompt.button", { key });
        if (found.kind === "crate") label = found.ref.opened ? "" : T("prompt.crate", { key });
        if (found.kind === "trap") label = found.ref.active ? T("prompt.trap", { key }) : "";
        if (found.kind === "hatch") label = found.ref.opened ? "" : T("prompt.hatch", { key });
        if (found.kind === "roomdoor") label = T(found.ref.open ? "prompt.doorClose" : "prompt.doorOpen", { key });
        // round 3: story notes, the third-floor grille, the rewards up there
        if (found.kind === "note") label = T("prompt.note", { key });
        if (found.kind === "gate3") label = found.ref.unlocked ? "" : this.thirdFloorStatus();
        if (found.kind === "safe" || found.kind === "trophy" || found.kind === "coffee" || found.kind === "radio") label = found.ref.used ? T("prompt." + found.kind + "Used") : T("prompt." + found.kind, { key });
        if (found.kind === "mysterybox") {
          label = T("prompt.mystery", { key, cost: G.MYSTERY_BOX_COST }) + (this.player.money < G.MYSTERY_BOX_COST ? T("prompt.notEnough") : "");
        }
        if (found.kind === "wallweapon") {
          const wdef = G.WEAPON_DEFS[found.ref.id];
          // Weight is part of the buying decision (category E), so it is on
          // the prompt rather than only in the log.
          const wc = G.weightClass(wdef);
          label = found.ref.purchased ? "" : T("prompt.wallGun", {
            key, name: wdef.name, price: wdef.price, weight: wc.label,
            short: this.player.money < wdef.price ? T("prompt.notEnough") : "",
          });
        }
      }
    }
    // a gun on the floor within reach, when nothing in view has a use
    this._nearFloorGun = label ? null : G.Loadout.nearest(this);
    if (this._nearFloorGun) {
      const fg = this._nearFloorGun, def = G.WEAPON_DEFS[fg.id];
      label = T("prompt.pickUp", { key, name: def.name });
      if (fg.expires) label += T("prompt.pickUpTimer", { s: Math.max(0, Math.ceil(fg.expires - fg.t)) });
    }
    G.UI.setInteractPrompt(!!label, label);
  },
  doInteract() {
    if (this.challenge) return;
    const found = this._lookedAtInteractable;
    // (set only when nothing in view has a use -- see updateInteractRay)
    if (this._nearFloorGun) { G.Loadout.pickUp(this, this._nearFloorGun); return; }
    if (!found) return;
    if (found.kind === "door") {
      if (found.ref.opened) return;
      this.startWordChallenge(G.T("challenge.door"), () => this.clearBlockingObstacle(found.ref, "opened"), () => {});
    } else if (found.kind === "trap") {
      if (!found.ref.active) return;
      this.startWordChallenge(G.T("challenge.trap"), () => this.clearBlockingObstacle(found.ref, "active", false), () => {});
    } else if (found.kind === "hatch") {
      if (found.ref.opened) return;
      this.startWordChallenge(G.T("challenge.hatch"), () => this.openHatch(found.ref), () => {});
    } else if (found.kind === "button") {
      found.ref.pressed = true; found.mesh.material.color.set(0x44ff44);
      const sz = this.world.secretZone;
      if (sz && !sz.unlocked) {
        sz.unlocked = true;
        if (sz.barricadeMesh) sz.barricadeMesh.visible = false;
        if (sz.barricadeCollider) G.ColGrid.remove(this.world, sz.barricadeCollider);
      }
    } else if (found.kind === "crate") {
      this.tryOpenStaticCrate(found.ref);
    } else if (found.kind === "wallweapon") {
      this.buyWallWeapon(found.ref);
    } else if (found.kind === "roomdoor") {
      this.toggleRoomDoor(found.ref);
    } else if (found.kind === "mysterybox") {
      this.openMysteryBox();
    } else if (found.kind === "note") {
      G.Notes.read(this, found.ref);
    } else if (found.kind === "gate3") {
      if (!found.ref.unlocked && G.Floor3) G.Floor3.interact(this, found);
    } else if (found.kind === "safe" || found.kind === "trophy" || found.kind === "coffee" || found.kind === "radio") {
      this.useReward(found.ref);
    }
  },

  // ---------------- The third floor (round 3, I: js/floor3.js) ----------------
  // Six steps: the second floor open, the wave 5 boss beaten, 50 right-word
  // kills and 3 notes read this run; then the Floor 3 Keycard turns up on
  // the second floor, and the grille's Vocabulary Lock asks three hard words.
  thirdFloorStatus() { return G.Floor3 ? G.Floor3.prompt(this) : ""; },
  checkThirdFloorUnlock() { if (G.Floor3) G.Floor3.check(this); },
  // the four rewards on the third floor, each good once a run
  useReward(ref) {
    if (ref.used) return;
    const T = G.T, at = ref.mesh.getWorldPosition(new THREE.Vector3());
    if (ref.kind === "safe") {
      ref.used = true;
      G.Audio.sfx("unlock");
      // the principal's safe: a gun of epic rarity or better
      this.openCrate(G.rollRarity("epic"), "epic", null, { source: "crate", dropPos: at });
    } else if (ref.kind === "trophy") {
      ref.used = true;
      this.player.money += 1500;
      G.Audio.sfx("purchase");
      G.UI.pulseHudStat("money");
      G.UI.flashPurchaseBanner(T("banner.trophy"), T("banner.trophyText", { n: 1500 }));
    } else if (ref.kind === "coffee") {
      const open = G.PERKS.filter((p) => !G.Perks.maxed(p.id, this.player));
      if (!open.length) { G.UI.flashPurchaseBanner(T("banner.coffee"), T("banner.coffeeNone")); ref.used = true; return; }
      ref.used = true;
      const pick = G.pick(open);
      G.Perks.apply(pick.id, this);
      G.Audio.sfx("unlock");
      G.UI.flashPurchaseBanner(T("banner.coffee"), T("banner.coffeeText", { perk: G.Perks.name(pick.id), lvl: G.Perks.level(pick.id) }));
      if (G.UI.updateHudPerks) G.UI.updateHudPerks();
    } else if (ref.kind === "radio") {
      ref.used = true;
      this._notesRevealed = true;
      G.Audio.sfx("vent_clang", { pos: at });
      G.UI.flashPurchaseBanner(T("banner.radio"), T("banner.radioText", { n: G.Notes.lying().length }));
    }
  },

  // ---------------- Mystery weapon box (category C) ----------------
  openMysteryBox() {
    if (this._mysteryHand) return;
    if (this.player.money < G.MYSTERY_BOX_COST) {
      G.UI.flashPurchaseBanner(G.T("banner.noMoney"),
        G.T("banner.noMoneyText", { cost: G.MYSTERY_BOX_COST, have: Math.floor(this.player.money) }));
      return;
    }
    this.player.money -= G.MYSTERY_BOX_COST;
    G.UI.pulseHudStat("money");
    this._mysteryHand = G.rollMysteryHand(this.level ? this.level.id : 1);
    this._mysteryPick = null;
    // Freeze everything (zombies, timers, player) and hand the mouse back.
    // 1-4 pick a card, Enter/Space/E takes the revealed one.
    G.Modal.open("mystery", { pause: true, keys: (e) => {
      if (this._mysteryPick === null) return G.Modal.digitKeys(this._mysteryHand.length, (i) => this.pickMysteryCard(i))(e);
      if (e.code === "Enter" || e.code === "Space" || e.code === "KeyE") { this.confirmMysteryPick(); return true; }
      return false;
    } });
    G.UI.setHudVisible(false);
    G.UI.showMysteryCards(this._mysteryHand, (idx) => this.pickMysteryCard(idx));
  },
  pickMysteryCard(idx) {
    if (!this._mysteryHand || this._mysteryPick !== null) return;
    this._mysteryPick = idx;
    const picked = this._mysteryHand[idx];
    G.UI.revealMysteryCards(this._mysteryHand, idx);
    G.Audio.mystery(picked.rarity);
    G.spawnCrateBurst(this.scene, this.yawObject.position.clone(), picked.rarity, G.save.settings.graphicsQuality);
  },
  confirmMysteryPick() {
    if (!this._mysteryHand || this._mysteryPick === null) return;
    const picked = this._mysteryHand[this._mysteryPick];
    this._mysteryHand = null; this._mysteryPick = null;
    if (this.world.mysteryBox) this.world.mysteryBox.uses++;
    // already paid for: with the slots full and the loadout kept, the gun is
    // left on the floor beside the box to collect later
    const settled = G.Loadout.offer(this, picked.id, { source: "mystery", dropPos: G.Loadout.besideBox(this) });
    if (settled) { G.UI.showScreen(null); G.UI.setHudVisible(true); }
    G.Modal.close("mystery");
  },

  // ---------------- Room doors (category B: sliding) ----------------
  // The panels slide on their rail (see G.placeDoorLeaves in world.js):
  // eased in and out, a small rebound off the stop, 0.4-0.6s in all. Their
  // colliders ride with them the whole way, so a half-open door blocks
  // exactly the half that is still shut.
  toggleRoomDoor(ref, forceOpen) {
    const willOpen = forceOpen === undefined ? !ref.open : forceOpen;
    if (willOpen === ref.open) return;
    ref.open = willOpen;
    ref.bashTimer = 0;
    if (G.Zones) G.Zones.dirty = true;             // the room behind it comes into (or out of) view
    ref.from = ref.p; ref.to = willOpen ? 1 : 0;
    // a wide pair is heavier; a reversal only has what is left to travel
    const full = ref.double ? 0.46 : 0.4;
    ref.dur = Math.max(0.16, full * Math.abs(ref.to - ref.from));
    ref.animT = 0; ref.settleT = 0; ref.held = false;
    const pos = new THREE.Vector3(ref.x, (ref.baseY || 0) + 1.5, ref.z);
    G.Audio.slideDoor(willOpen, pos, ref.dur, ref.double);
    // A door nobody has touched since the outbreak coughs dust off its frame.
    if (!ref.dusted) {
      ref.dusted = true;
      G.spawnDustPuff(this.scene, new THREE.Vector3(ref.x, (ref.baseY || 0) + 2.7, ref.z), G.save.settings.graphicsQuality, ref.double ? 2 : 1.4);
    }
  },
  // everybody a sliding panel could run into
  doorBodies() {
    const P = this.yawObject.position;
    const out = [{ x: P.x, z: P.z, y: P.y - 1.7, r: 0.36, pos: P }];
    for (const z of this.zombies) {
      if (z.alive) out.push({ x: z.mesh.position.x, z: z.mesh.position.z, y: z.mesh.position.y, r: z.type === "boss" ? 0.9 : 0.42, pos: z.mesh.position });
    }
    return out;
  },
  // push a body standing on an opening panel's rail line straight out from
  // the wall, a little each frame, unless that would put it in something
  shoveFromDoor(d, h, dt) {
    const lf = h.leaf, s = Math.sign(lf.n) || 1;
    const nNow = d.axis === "x" ? h.pos.z - d.z : h.pos.x - d.x;
    const want = lf.n + s * (0.25 + h.r + 0.04);
    const step = Math.sign(want - nNow) * Math.min(Math.abs(want - nNow), 2.2 * dt);
    const x = h.pos.x + (d.axis === "x" ? 0 : step), z = h.pos.z + (d.axis === "x" ? step : 0);
    const r = h.pos === this.yawObject.position ? 0.35 : 0.12;
    const y0 = h.y + 0.1, y1 = h.y + 1.6;
    const own = new Set(d.colliders);
    if (G.ColGrid.near(this.world, x, z, 1.5, []).some((c) => !own.has(c) && c.max.y >= y0 && c.min.y <= y1 && x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z)) return;
    h.pos.x = x; h.pos.z = z;
  },
  // Stepped from the game loop's dt: a requestAnimationFrame chain would keep
  // running while the game is paused and stall if the tab is backgrounded.
  // A closed door blocks zombies too, so one held up against it leans on it
  // until it gives way -- without this, shutting every door would strand a
  // wave's remaining zombies and the level could never be cleared.
  updateRoomDoors(dt) {
    const doors = this.world.roomDoors;
    if (!doors || !doors.length) return;
    let bodies = null;
    const SETTLE = 0.12;
    for (const d of doors) {
      if (!d.leaves.length) continue;
      if (d.animT < 1) {
        const t = Math.min(1, d.animT + dt / d.dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // ease in-out
        const p = d.from + (d.to - d.from) * e;
        bodies = bodies || this.doorBodies();
        const hit = G.doorSweepHits(d, d.p, p, bodies);
        if (hit.length) {
          // Somebody is in the way. Closing: it bumps them and slides back
          // open, like a lift door. Opening: the panel nudges them off its
          // rail line (a zombie coming along the wall stands right on it) and
          // waits until they are clear.
          if (!d.open) {
            this.toggleRoomDoor(d, true);
            G.Audio.doorStop(false, new THREE.Vector3(d.x, d.baseY + 1.2, d.z), d.double, true);
          } else {
            d.held = true;
            hit.forEach((h) => this.shoveFromDoor(d, h, dt));
          }
          continue;
        }
        d.held = false;
        d.animT = t; d.p = p;
        if (t >= 1) {
          d.settleT = 1e-4;
          G.Audio.doorStop(!d.open, new THREE.Vector3(d.x, d.baseY + 1.2, d.z), d.double);
        }
        G.placeDoorLeaves(d, 0, 0);
      } else if (d.settleT > 0) {
        // the rebound off the stop (or off the other panel), gone in 0.12s
        d.settleT += dt;
        const k = Math.max(0, 1 - d.settleT / SETTLE);
        G.placeDoorLeaves(d, 0.035 * Math.abs(Math.sin(d.settleT * 38)) * k * k, 0);
        if (d.settleT >= SETTLE) { d.settleT = 0; G.placeDoorLeaves(d, 0, 0); }
      }
      if (d.open || d.animT < 1) { d.bashTimer = 0; continue; }
      // Only a zombie trying to get THROUGH leans on it: at the doorway, with
      // where it is headed -- or the waypoint after that -- on the far side.
      // One just walking down the corridor past the door used to count as
      // well, and opened every door it passed.
      let pressed = false;
      const half = d.width / 2 + 0.2;
      const nodes = this.world.waypointNodes;
      const aOf = (p) => d.axis === "x" ? p.x - d.x : p.z - d.z;
      const nOf = (p) => d.axis === "x" ? p.z - d.z : p.x - d.x;
      for (const z of this.zombies) {
        if (!z.alive || !z._goal || Math.abs(z.mesh.position.y - d.baseY) > 1.5) continue;
        const a = aOf(z.mesh.position), n = nOf(z.mesh.position);
        if (Math.abs(a) >= half || Math.abs(n) >= 1.3) continue;
        const ahead = [z._goal];
        if (z.navPath && z.navIndex + 1 < z.navPath.length) ahead.push(nodes[z.navPath[z.navIndex + 1]]);
        if (ahead.some((p) => p && Math.abs(nOf(p)) > 0.3 && Math.sign(nOf(p)) !== Math.sign(n) && Math.abs(aOf(p)) < d.width / 2 + 4)) { pressed = true; break; }
      }
      if (!pressed) {
        // eases off rather than resetting: a zombie whose route wobbles
        // at the doorway still gets through in the end
        if (d.bashTimer > 0) { d.bashTimer = Math.max(0, d.bashTimer - dt * 0.6); if (!d.bashTimer) G.placeDoorLeaves(d, 0, 0); }
        continue;
      }
      d.bashTimer += dt;
      // rattles in its rail while being pushed on, so it reads as under attack
      G.placeDoorLeaves(d, 0.02 * Math.max(0, Math.sin(d.bashTimer * 19)), Math.sin(d.bashTimer * 31) * 0.025);
      if (d.bashTimer >= 2.0) { G.placeDoorLeaves(d, 0, 0); this.toggleRoomDoor(d, true); }
    }
  },

  // J3 replay (the HUD 🔊 button, or V): in "before" mode it reads the
  // current target; otherwise it repeats the last word that was earned, so it
  // never gives the answer away.
  speakCurrentWord() {
    // (round 3, G) a spoken clue: said again (Play Once: not again)
    if (this.targetClue && this.targetClue.kind === "audio") { this.playClue(); return; }
    if (!this.targetPair && G.Spell && G.Spell.focus && G.Spell.focus.clueKind === "audio") { G.Spell.sayFocus(true); return; }
    if (G.save.settings.speechMode === "before" && this.targetPair) G.Audio.speak(this.targetPair[0]);
    else G.Audio.replay();
  },
  // (F) the Thai of an English-only Definition clue: the target's, else the
  // spelling bar's zombie's -- a helper either way
  showThai() {
    if (this.showClueThai()) return true;
    return !!(G.Spell && G.Spell.showThai && G.Spell.showThai());
  },

  // ---------------- Per-frame audio (category J) ----------------
  // Music/ambience scheduling, positional zombie growls, footsteps that match
  // the surface underfoot, and three warnings: low health, empty stamina, and
  // a zombie closing in from behind.
  updateAudio(dt) {
    const A = G.Audio;
    if (!A.ctx) return;
    A.update(dt, this);
    const p = this.yawObject.position;

    // growls: each zombie on its own irregular timer, only within earshot
    for (const z of this.zombies) {
      if (!z.alive) continue;
      z._growlT = (z._growlT === undefined ? 1 + Math.random() * 4 : z._growlT) - dt;
      if (z._growlT <= 0) {
        z._growlT = (z.type === "fast" ? 2.2 : 3.5) + Math.random() * 4.5;
        if (z.mesh.position.distanceTo(p) < 32) A.zombie("growl", z.type, z.mesh.position.clone().setY(z.mesh.position.y + 1.4));
      }
    }

    // footsteps: surface from the theme and, at the school, whether you are
    // out on the grass
    const moving = this._lastStepPos ? Math.hypot(p.x - this._lastStepPos.x, p.z - this._lastStepPos.z) / Math.max(dt, 1e-4) : 0;
    this._lastStepPos = { x: p.x, z: p.z };
    // one per foot plant, as reported by the gait (animation pass A2), so the
    // sound lands exactly when the foot on screen does
    const steps = G.PlayerBody.takeSteps();
    if (steps.length && moving > 0.6 && this.velocityY === 0) {
      const running = G.PlayerBody.gait.runW > 0.5;
      const region = G.getRegionAt(this.world, p.x, p.z, p.y - 1.7);
      const surface = this.level.theme === "bunker" ? "metal" : /^YARD/.test(region || "") ? "grass" : "tile";
      A.footstep(surface, running);
    }

    // warning 1: heartbeat under 30% health, quickening as it drops
    const hpFrac = this.player.hp / this.player.maxHp;
    if (hpFrac < 0.3 && hpFrac > 0) {
      this._hbT -= dt;
      if (this._hbT <= 0) { this._hbT = 0.55 + hpFrac * 1.4; A.sfx("heartbeat"); }
    }
    // warning 2: the moment stamina runs out
    if (this.staminaExhausted && !this._wasExhausted) A.sfx("breath");
    this._wasExhausted = this.staminaExhausted;
    // warning 3: something close behind you
    this._behindT -= dt;
    if (this._behindT <= 0) {
      const fwd = new THREE.Vector3(-Math.sin(this.yawObject.rotation.y), 0, -Math.cos(this.yawObject.rotation.y));
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const to = new THREE.Vector3(z.mesh.position.x - p.x, 0, z.mesh.position.z - p.z);
        const d = to.length();
        if (d > 1.2 && d < 6 && fwd.dot(to.normalize()) < -0.45) {
          A.sfx("behind", { pos: z.mesh.position.clone().setY(1.5) });
          this._behindT = 4;
          break;
        }
      }
    }
  },

  // The blocking box is the panel's own world AABB, recomputed as it swings.
  // A fixed box either blocks a door that is already open, or lets you walk
  // through one that is still closing.
  // With every slot full the Inventory Full window asks first, and the money
  // only goes when a slot is actually given up for the gun.
  buyWallWeapon(ref) {
    if (ref.purchased || this.player.money < ref.price) return;
    G.Loadout.offer(this, ref.id, { source: "wall", onTake: () => {
      this.player.money -= ref.price;
      G.Audio.sfx("purchase");
      ref.purchased = true;
      G.spawnCrateBurst(this.scene, ref.gunMesh.getWorldPosition(new THREE.Vector3()), "secret", G.save.settings.graphicsQuality);
      G.UI.pulseHudStat("money");
      G.UI.flashPurchaseBanner(G.WEAPON_DEFS[ref.id].name);
    } });
  },

  // Hides an obstacle's mesh AND removes its collider (doors/traps previously
  // only hid the mesh on "opened"/solved, leaving an invisible wall in place
  // that still fully blocked movement).
  clearBlockingObstacle(ref, flagProp, flagValue) {
    ref[flagProp] = flagValue === undefined ? true : flagValue;
    if (ref.locked !== undefined) ref.locked = false;
    // the word-locked door slides aside on its rail and keeps its collider,
    // which rides along with it (its free side was picked at build time)
    if (ref.slide) { this.slideObstacleOpen(ref); return; }
    if (ref.collider) G.ColGrid.remove(this.world, ref.collider);
    // Used to just be mesh.visible=false (an instant cut). Swings the mesh
    // open on its own Y axis over real elapsed time (not tied to the game's
    // own dt/FPS cap, since this is a short transient world effect) and
    // hides it once the swing finishes.
    this.animateObstacleOpen(ref.mesh);
  },
  slideObstacleOpen(ref) {
    const m = ref.mesh;
    G.spawnDustPuff(this.scene, m.position.clone(), G.save.settings.graphicsQuality, 1.4);
    G.Audio.slideDoor(true, m.position.clone(), 0.5, false);
    this._swingProps = this._swingProps || [];
    this._swingProps.push({ slide: true, ref, mesh: m, start: m.position.clone(), t: 0 });
  },
  // same motion as a room door: eased along the rail, a small rebound off
  // the stop; true once it has come to rest
  stepObstacleSlide(s, dt) {
    const DUR = 0.5, SETTLE = 0.12, shift = s.ref.slide;
    s.t += dt;
    const p = Math.min(1, s.t / DUR);
    let k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    if (s.t > DUR) {
      const u = s.t - DUR, f = Math.max(0, 1 - u / SETTLE);
      k = 1 - 0.035 / shift.length() * Math.abs(Math.sin(u * 38)) * f * f;
    }
    s.mesh.position.copy(s.start).addScaledVector(shift, k);
    if (s.ref.collider) {
      s.mesh.updateMatrixWorld(true);
      s.ref.collider.setFromObject(s.mesh);
    }
    if (s.t >= DUR && !s.stopped) { s.stopped = true; G.Audio.doorStop(false, s.mesh.position.clone(), false); }
    return s.t >= DUR + SETTLE;
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
      if (s.slide) { if (this.stepObstacleSlide(s, dt)) list.splice(i, 1); continue; }
      if (s.lift) {
        // the third-floor grille rolling up out of the way
        s.t += dt;
        const p = Math.min(1, s.t / 1.2);
        s.mesh.position.y = s.y0 + 3.4 * (p * p * (3 - 2 * p));
        if (p >= 1) { s.mesh.visible = false; list.splice(i, 1); }
        continue;
      }
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
    G.Audio.sfx("unlock");
    G.ColGrid.remove(this.world, sf.barrierCollider);
    sf.cratePositions.forEach((p) => this.spawnDrop("crate", p));
    G.UI.flashPurchaseBanner(G.T("banner.upstairs"), G.T("banner.upstairsText", { n: sf.killsNeeded }));
  },

  updateTraps(dt) {
    if (!this.world) return;
    for (const t of this.world.traps) {
      t.cooldown -= dt;
      if (t.active && t.cooldown <= 0 && t.mesh.position.distanceTo(this.yawObject.position) < 1.3) {
        t.cooldown = 1.0;
        const dmg = t.damage * (1 - this.player.armorPct) * G.Abilities.damageTakenMult();   // Riot Gear covers traps too (and a Barrier)
        if (dmg <= 0) continue;
        this.player.hp -= dmg;
        this.player.wasHitThisLevel = true;
        G.UI.flashDamage();
        this.checkPlayerDeath();
      }
    }
  },

  updateChallengeTimer(dt) {
    const c = this.challenge;
    if (!c || c.stage !== "question") return;
    c.timeLeft -= dt;
    G.UI.setChallengeTimer(c.timeLeft / c.timeLimit);
    if (c.timeLeft <= 0) {
      // out of time is a word missed (C2) -- every question's now, not only
      // the boss's -- and (round 3, H3) the answer is shown before going on
      const p = c.pair;
      G.Learning.answerWord(p, false, { inView: G.Questions.inView(c.q), skills: c.q.skills });
      this.wrongCount++; this.trackWrongWord(p[0], p[1]);
      this._challengeEnd = "timeout";
      this.revealChallenge(-1);
    }
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
    G.Pad.poll(delta);

    this.clock.getDelta();
    // (the first frame -- or the first after the page was hidden since it
    // loaded -- has no time behind it: a step of 0 divides into NaN in the
    // camera rig, which then never recovers)
    if (delta > 0) this.update(delta);

    if (this.scene && this.camera) this.renderFrame();
  },
};

// ---------------- Global input event wiring ----------------
G.onKeyDown = function (e) {
  const Game = G.Game;
  // A window is open (question, crate, mystery box, shop): its own keys only
  // -- 1-4 answer instead of switching weapons, and nothing reaches
  // gameplay. Pause still works over a question.
  G.Pad && G.Pad.clearFocus();
  // (in any state: the Notes Journal opens the note reader from the menus
  // and the pause screen too, and its Escape must close the note, not quit
  // to the menu or resume the run)
  if (G.Modal.isOpen()) {
    if (Game.state === "GAMEPLAY" && e.code === G.save.settings.keybinds.pause && !G.Modal.pausesAll()) { Game.pause(); return; }
    G.Modal.handleKey(e);
    return;
  }
  // (new series, round 2, F) the Settings page: rows, choices, categories, Esc back
  if (G.SettingsUI && G.SettingsUI.onKey(e)) return;
  // round 4: the lobby takes its own keys (move, select, switch tab)
  if (Game.state === "MENU" && G.Lobby && G.Lobby.onKey(e)) return;
  // (vocabulary series, round 2, D1) typing the words: letters, space,
  // hyphen, Backspace, Tab (a hint) and Enter belong to the bar -- before
  // any gameplay key that happens to be a letter
  if (Game.state === "GAMEPLAY" && !(G.Cutscene && G.Cutscene.active) && G.Spell && G.Spell.onKey(e)) return;
  // (round 3, G3) hear it again -- its own key, which is not a letter, so it
  // works while typing too (V as well, when not typing); F: show the Thai
  const kbs = G.save.settings.keybinds;
  if (Game.state === "GAMEPLAY" && (e.code === kbs.replay || e.code === "KeyV")) { Game.speakCurrentWord(); return; }
  if (Game.state === "GAMEPLAY" && e.code === kbs.thaiHint) { Game.showThai(); return; }
  if (Game.state === "GAMEPLAY" && e.code === "KeyT" && G.Tutorial.current) { G.Tutorial.skip(); return; }
  if (Game.state === "GAMEPLAY") {
    const kb = G.save.settings.keybinds;
    if (e.code === kb.pause) { Game.pause(); return; }
    if (G.Cutscene && G.Cutscene.active) return;       // a boss arriving: only pause
    if (e.code === kb.reload) { Game.reload(); return; }
    if (e.code === kb.interact) { Game.doInteract(); return; }
    if (e.code === kb.melee) { Game.switchSlot(0); return; }
    // slot2..slot7: the four gun slots, and the two Extra Weapon Slot adds
    for (let s = 2; s <= 7; s++) if (kb["slot" + s] && e.code === kb["slot" + s]) { Game.switchSlot(s - 1); return; }
    // ability1..ability4 (round 3); a held key uses it once
    for (let a = 1; a <= 4; a++) if (kb["ability" + a] && e.code === kb["ability" + a]) { if (!e.repeat) G.onAbilityPress(a - 1); return; }
  } else if (Game.state === "PAUSE") {
    // (the Escape that just unlocked the mouse and paused the game can
    // arrive here as a key press too -- it must not resume straight away)
    if (e.code === G.save.settings.keybinds.pause && performance.now() - (Game._pausedAt || 0) > 250) Game.resume();
  } else if (Game.state === "MENU" || Game.state === "LEVEL_SELECT") {
    if (e.code === "Escape") Game.quitToMainMenu();
  }
};
G.onKeyUp = function () {};
// A single trigger-pull edge, shared by the mouse and the touch FIRE button.
G.onFirePress = function () {
  const Game = G.Game;
  // (a run answered only by spelling: the trigger does nothing but remind)
  if (G.Game.playing() && Game.learn && !Game.learn.shoots) { Game.spellGlance && G.Spell.focus && Game.spellGlance(G.Spell.focus, G.Spell.focus.mesh.position.clone().setY(G.Spell.focus.mesh.position.y + 1.2)); return; }
  if (G.Game.playing() && !Game.challenge) Game._fireEdge = true;
};
G.onMouseDown = function (e) {
  // Left button only -- right-click is ADS, and letting it through meant
  // aiming also loosed a shot from every semi-automatic weapon. On desktop
  // a click without pointer lock is the click that takes it back, not a shot.
  if (G.Input.mode === "desktop" && !G.Input.pointerLocked) return;
  if (e.button === 0) G.onFirePress();
};
G.onInteractPress = function () { if (G.Game.playing()) G.Game.doInteract(); };
G.onSlotPress = function (slot) { if (G.Game.playing()) G.Game.switchSlot(slot); };
G.onPausePress = function () {
  const Game = G.Game;
  if (Game.state === "GAMEPLAY" && !G.Modal.pausesAll()) Game.pause();
  else if (Game.state === "PAUSE") Game.resume();
};
G.onReloadPress = function () { if (G.Game.playing()) G.Game.reload(); };
// The mouse was unlocked by something other than one of our windows: Escape
// (the browser takes that key for itself), alt-tab, a system dialog. That is
// the player stepping away, so pause. Windows free the mouse through
// G.Modal, which tells G.Input to expect the unlock, and never land here.
G.onPointerLockLost = function () {
  const Game = G.Game;
  if (Game.state === "GAMEPLAY" && !Game.paused && !G.Modal.isOpen()) Game.pause();
};

// ---------------- Boot ----------------
window.addEventListener("DOMContentLoaded", () => G.Game.init());
