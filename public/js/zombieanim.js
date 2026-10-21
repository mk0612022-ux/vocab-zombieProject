// ===================================================================
// How the zombies move (animation pass A1; overhaul, round 4)
// -------------------------------------------------------------------
// One rig for every kind (js/entities.js: hips, knees, feet, shoulders,
// elbows, the neck), posed each frame from what the zombie is doing. The
// stride follows the ground actually covered (feet don't skate), weights
// between states ease in and out (0.1-0.25 s), the loose parts trail the body
// on springs, and every zombie gets its own limp, reach and rhythm so a crowd
// never moves in step. Each kind its own gait:
//   shamble   the Shambler: a lurch over a dragged foot, arms held out
//   run       the Sprinter, the Runt: fast, arms thrown about, off balance
//   waddle    the Bloater: short steps, swaying side to side, arms wide
//   march     the Ironclad: heavy and steady under its armour
//   lurch     the Abomination: lopsided, the big arm swinging, the third flailing
//   creep     the Screamer: tall and stooped, the head jerking
//   carry     the Headless: its own head held out under one arm, swinging
//   heavy     the Reacher: long slow steps, its knuckles near the floor
//   crawl     the Crawler: pulled along on one arm, the other trailing
// On top of the gait (js/zombieai.js sets what is going on):
//   idle      stopped: it sways, and looks about now and then
//   wind-up   before a blow: arms drawn back (the Reacher's one raised over
//             its head), then the strike -- a grab, a bite, a swing
//   hit       light: a flinch; medium: it staggers back; heavy: it goes down
//             and gets up again (it cannot move or bite meanwhile)
//   special   the Screamer rearing up to shriek; a stumble
// The pose is worked out every frame within G.CONFIG.zombies.lod.full m of
// the player, every 2nd frame to lod.half, every 4th beyond, and not at all
// off the screen (it still walks).
// ===================================================================
window.G = window.G || {};

G.ZombieAnim = {
  GAIT: {
    normal:      { style: "shamble", stride: 1.05, swing: 0.42, knee: 0.85, reach: 1.25, pump: 0, lean: 0.2, turn: 4.5 },
    fast:        { style: "run", stride: 1.55, swing: 0.75, knee: 1.3, reach: 0.4, pump: 0.9, lean: 0.36, turn: 7, flail: 0.5 },
    crawler:     { style: "crawl", stride: 0.6, turn: 3.5 },
    bloater:     { style: "waddle", stride: 0.75, swing: 0.28, knee: 0.45, reach: 0.65, pump: 0, lean: 0.04, turn: 3, sway: 0.15 },
    ironclad:    { style: "march", stride: 1.0, swing: 0.4, knee: 0.7, reach: 0.95, pump: 0.12, lean: 0.12, turn: 3.6 },
    runt:        { style: "run", stride: 0.85, swing: 0.85, knee: 1.4, reach: 0.3, pump: 1.0, lean: 0.3, turn: 8, flail: 0.75 },
    abomination: { style: "lurch", stride: 1.35, swing: 0.5, knee: 0.9, reach: 1.0, pump: 0.3, lean: 0.3, turn: 3.2, flail: 0.6 },
    screamer:    { style: "creep", stride: 1.2, swing: 0.36, knee: 0.75, reach: 0.55, pump: 0, lean: 0.14, turn: 4 },
    headless:    { style: "carry", stride: 1.05, swing: 0.4, knee: 0.8, reach: 0.5, pump: 0, lean: 0.12, turn: 4 },
    reacher:     { style: "heavy", stride: 1.6, swing: 0.36, knee: 0.6, reach: 0.22, pump: 0, lean: 0.32, turn: 2.8 },
    boss:        { style: "shamble", stride: 1.3, swing: 0.36, knee: 0.7, reach: 0.9, pump: 0.15, lean: 0.16, turn: 2.5 },
  },
  gait(z) { return this.GAIT[z.type] || this.GAIT.normal; },
  turnRate(z) { return (this.GAIT[z.type] || this.GAIT.normal).turn || 4.5; },

  // ---- the animation LOD (once a frame, from js/game.js updateZombies) ----
  _frustum: null, _pm: null, _frame: 0,
  frame(game) {
    this._frame++;
    const cam = game && game.camera;
    if (!cam) { this._ready = false; return; }
    this._frustum = this._frustum || new THREE.Frustum();
    this._pm = this._pm || new THREE.Matrix4();
    cam.updateMatrixWorld();
    this._pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._pm);
    this._eye = this._eye || new THREE.Vector3();
    cam.getWorldPosition(this._eye);
    this._ready = true;
  },
  // 1: every frame, 2: every other, 4: every fourth, 0: not now (off screen)
  lod(z) {
    if (!this._ready || G.ZombieAnim.full) return 1;
    const p = z.mesh.position, C = G.CONFIG.zombies.lod;
    const d = Math.hypot(p.x - this._eye.x, p.z - this._eye.z);
    const sp = this._sp || (this._sp = new THREE.Sphere());
    sp.center.set(p.x, p.y + 1, p.z); sp.radius = 1.6 * (z.mesh.scale.y || 1);
    if (d > 3 && !this._frustum.intersectsSphere(sp)) return 0;
    return d < C.full ? 1 : d < C.half ? 2 : 4;
  },
};

// the pose, at its LOD: skipped frames add their time and ground to the next
G.Zombie.prototype.animStep = function (dt, moved) {
  const k = G.ZombieAnim.lod(this);
  this._lodAcc = (this._lodAcc || 0) + dt;
  this._lodMov = (this._lodMov || 0) + moved;
  this.lodK = k;
  if (k === 0) { this._lodAcc = 0; this._lodMov = 0; return; }
  if ((G.ZombieAnim._frame + this.uid) % k !== 0) return;
  const a = Math.min(0.25, this._lodAcc), m = this._lodMov;
  this._lodAcc = 0; this._lodMov = 0;
  this.animate(a, m);
};

G.Zombie.prototype.animate = function (dt, moved) {
  const u = this.mesh.userData, L = u.limbs;
  if (!L || dt <= 0) return;
  const A = G.Anim, ZA = G.ZombieAnim;
  const def = G.ZOMBIE_TYPES[this.type] || G.ZOMBIE_TYPES.normal;
  if (!this._anim) {
    // per-zombie character: which leg drags, how far the arms reach, tempo
    this._anim = {
      phase: G.rng(), t: G.rng() * 20, spd: 0, moveW: 0, limp: G.rng() < 0.5 ? -1 : 1,
      limpAmt: 0.25 + G.rng() * 0.45, reach: 0.85 + G.rng() * 0.3, seed: G.rng() * 10,
      head: { x: new A.Spring(), z: new A.Spring() }, arm: new A.Spring(), lunge: 0,
      look: 0, lookAt: 0, lookT: 1 + G.rng() * 3, wind: 0, flinch: 0, stagger: 0, down: 0, rear: 0, stumble: 0,
    };
  }
  const S = this._anim, Gt = ZA.gait(this);
  if (this._flinchNext) { S.flinch = 1; this._flinchNext = false; }    // (hit before its first pose)
  S.t += dt;
  const speed = moved / dt;
  S.spd = A.approach(S.spd, speed, dt, 0.2);
  S.moveW = A.approach(S.moveW, S.spd > 0.15 ? 1 : 0, dt, 0.25);
  const w = S.moveW, idle = 1 - w;
  const scale = def.scale || 1;
  // the overlays (js/zombieai.js): eased in and out, never snapped
  const atk = this._atk, wantWind = atk && atk.phase === "wind" ? 1 : 0;
  S.wind = A.approach(S.wind, wantWind, dt, wantWind ? 0.12 : 0.1);
  S.flinch = Math.max(0, S.flinch - dt * 5);
  S.stagger = A.approach(S.stagger, this._stagger > 0 ? 1 : 0, dt, 0.12);
  S.down = A.approach(S.down, this._down > 0 ? 1 : 0, dt, this._down > 0 ? 0.18 : 0.25);
  S.rear = A.approach(S.rear, this._rear > 0 ? 1 : 0, dt, 0.2);
  S.stumble = A.approach(S.stumble, this._stumbleT > 0 ? 1 : 0, dt, 0.1);
  S.lunge = Math.max(0, S.lunge - dt);
  const lungeK = S.lunge > 0 ? Math.sin((1 - S.lunge / 0.45) * Math.PI) : 0;
  // idle: looking about now and then
  S.lookT -= dt;
  if (S.lookT <= 0) { S.lookT = 1.5 + G.rng() * 3.5; S.lookAt = (G.rng() - 0.5) * 1.4; }
  S.look = A.approach(S.look, S.lookAt * idle, dt, 0.35);

  if (u.crawler) { animateCrawl(this, S, u, L, dt, w, scale); return; }

  S.phase = (S.phase + dt * S.spd / (Gt.stride * scale)) % 1;
  const ph = S.phase * Math.PI * 2;
  const style = Gt.style;
  const hipY = u.hipY || 0.74;

  // ---- legs ----
  [L.legL, L.legR].forEach((leg, i) => {
    const a = ph + i * Math.PI;
    // the dragging leg swings less and barely bends (a Shambler, the lurchers)
    const lame = style === "shamble" || style === "lurch" || style === "creep";
    const drag = lame && leg.side === S.limp ? 1 - S.limpAmt : 1;
    const swing = Math.sin(a) * Gt.swing * drag * w;
    // the knee folds most as the leg passes under the body going forward
    const kneeBend = Math.pow(Math.max(0, Math.cos(a)), 1.5) * Gt.knee * drag * w;
    leg.hip.rotation.x = -swing - 0.05 * w - 0.5 * S.stumble + 0.9 * S.down * (i ? 1 : 0.7);
    leg.hip.rotation.z = leg.side * (style === "waddle" ? 0.12 : 0.03) + leg.side * 0.15 * S.stagger;
    leg.knee.rotation.x = 0.08 + kneeBend + 0.5 * S.stumble + 1.2 * S.down;
    // keep the sole roughly level, toe dragging on the lame side
    leg.foot.rotation.x = swing - kneeBend * 0.8 + (drag < 1 ? 0.25 * w : 0);
  });

  // ---- the body: hunched, lurching over the planted foot ----
  const sway = Math.sin(ph) * (Gt.sway || 0.07) * w + A.wobble(S.t * 0.6, S.seed) * 0.05 * idle;
  const bob = -Math.cos(2 * ph) * (style === "heavy" || style === "march" ? 0.04 : style === "run" ? 0.035 : 0.025) * w;
  u.upper.position.y = hipY + bob + Math.sin(S.t * 1.4 + S.seed) * 0.006 * idle - 0.18 * S.down;
  const flail = Gt.flail ? A.wobble(S.t * 3.1, S.seed + 11) * Gt.flail * w : 0;
  u.upper.rotation.set(
    Gt.lean + 0.06 * w + 0.35 * lungeK + Math.sin(S.t * 1.4 + S.seed) * 0.02 * idle
      - 0.35 * S.wind * (this.type === "reacher" ? 0.4 : 1) - 0.55 * S.flinch - 0.45 * S.stagger + 0.45 * S.stumble - 0.6 * S.rear,
    Math.sin(ph) * 0.1 * w + (style === "lurch" ? 0.22 : 0) + S.look * 0.25,
    sway + S.limp * 0.04 * S.limpAmt * w + flail * 0.15);
  // knocked down: the whole body goes over backwards and comes up again
  if (S.down > 0.001 || this._wasDown) { this.mesh.rotation.x = -1.25 * S.down; this._wasDown = S.down > 0.001; }

  // ---- arms ----
  S.arm.step(-sway * 1.4, dt, 2.4, 0.4);
  [L.armL, L.armR].forEach((arm, i) => {
    if (u.holdArm === arm) return;
    const a = ph + i * Math.PI;
    const reach = Gt.reach * S.reach;
    // runners pump and throw their arms; the rest hold them out and let them
    // bounce with the steps; the Reacher's hang to its knees
    const pump = Math.sin(a + Math.PI) * Gt.pump * w;
    const bounce = Math.sin(2 * ph + i) * 0.08 * w;
    const dangle = A.wobble(S.t * 0.9, S.seed + i * 2) * 0.08 * idle;
    const thrash = Gt.flail ? A.wobble(S.t * 4.2, S.seed + i * 7) * Gt.flail * w : 0;
    let sx = -reach + pump + bounce + dangle + thrash - 0.8 * lungeK;
    let sz = arm.side * (0.12 + 0.05 * idle + (style === "waddle" ? 0.35 : 0)) + S.arm.x * 0.6;
    let ex = -(0.25 + 0.2 * Math.max(0, Math.sin(a)) * w + (Gt.pump ? 0.8 * w : 0)) + 0.3 * lungeK;
    // the wind-up: both arms drawn up and back (the Reacher: one, over its head)
    if (S.wind > 0) {
      const big = this.type === "reacher" || this.type === "abomination" ? arm.side === (u.look.oddSide || 1) : true;
      if (big) { sx = sx * (1 - S.wind) + (this.type === "reacher" ? -2.7 : -1.9) * S.wind; ex = ex * (1 - S.wind) - 0.9 * S.wind; }
    }
    // hit: flung out (stagger), a jerk (flinch), thrown up (down), raised wide (rearing up to shriek)
    sz += arm.side * (0.6 * S.stagger + 0.25 * S.flinch + 0.9 * S.rear);
    sx += 0.5 * S.stagger - 1.2 * S.down - 0.6 * S.rear - 1.0 * S.stumble;
    arm.shoulder.rotation.x = sx;
    arm.shoulder.rotation.z = sz;
    arm.shoulder.rotation.y = arm.side * -0.08;
    arm.elbow.rotation.x = ex;
  });
  // the Abomination's third arm: never still
  if (L.armX) {
    const s = L.armX.side;
    L.armX.shoulder.rotation.set(-0.6 + A.wobble(S.t * 2.6, S.seed + 21) * 0.9, s * 0.5, s * (0.9 + A.wobble(S.t * 1.9, S.seed + 23) * 0.5));
    L.armX.elbow.rotation.x = -0.8 + A.wobble(S.t * 3.3, S.seed + 25) * 0.7;
  }

  // ---- head: lolls behind the body's motion (jerks, on a Screamer) ----
  S.head.z.step(-sway * 1.6, dt, 1.8, 0.3);
  S.head.x.step(bob * 3 + 0.1 * idle, dt, 2.0, 0.35);
  const jerk = style === "creep" ? (Math.sin(S.t * 13 + S.seed) > 0.96 ? 0.25 : 0) : 0;
  const stiff = style === "march" ? 0.4 : 1;
  u.neck.rotation.set(
    (-0.15 + S.head.x.x + A.wobble(S.t * 0.7, S.seed + 5) * 0.07) * stiff - 0.9 * S.rear - 0.4 * S.flinch + jerk,
    A.wobble(S.t * 0.4, S.seed + 7) * 0.2 * idle + S.look + jerk * 0.6,
    S.head.z.x * stiff + jerk * 0.5);
  // (a shriek: the head shakes)
  if (this._rear > 0 && this._screaming) u.neck.rotation.y += Math.sin(S.t * 38) * 0.06;

  // ---- I2 / the Headless: the arm that carries the head holds it out in front ----
  if (u.holdArm) {
    const arm = u.holdArm;
    arm.shoulder.rotation.set(-1.15 + Math.sin(2 * ph) * 0.06 * w - 0.35 * lungeK - 0.5 * S.down, 0, arm.side * 0.2);
    arm.elbow.rotation.x = -0.45 + 0.25 * lungeK;
    this.hangHead(S);
  }
};

// the Crawler: hand over hand once -- one arm reaches, plants and drags the
// body on; the other trails, useless
function animateCrawl(z, S, u, L, dt, w, scale) {
  const A = G.Anim;
  S.phase = (S.phase + dt * S.spd / (0.6 * scale)) % 1;
  const ph = S.phase * Math.PI * 2;
  const pull = u.pullSide || 1;
  [L.armL, L.armR].forEach((arm, i) => {
    if (arm.side === pull) {
      const reach = Math.sin(ph), bend = Math.max(0, -Math.cos(ph));
      arm.shoulder.rotation.x = -1.35 - 0.75 * reach * w + A.wobble(S.t, S.seed + i) * 0.06 * (1 - w) - 0.6 * S.wind;
      arm.shoulder.rotation.z = arm.side * (0.15 + 0.1 * bend * w);
      arm.elbow.rotation.x = -0.3 - 1.0 * bend * w;
    } else {
      // dragged alongside, loose
      arm.shoulder.rotation.x = -0.35 + A.wobble(S.t * 0.8, S.seed + 4) * 0.12 - 0.9 * S.wind;
      arm.shoulder.rotation.z = arm.side * 0.4;
      arm.elbow.rotation.x = -0.15 + A.wobble(S.t * 1.1, S.seed + 6) * 0.15;
    }
  });
  const heave = Math.max(0, Math.sin(ph));
  u.torso.position.y = u.torsoBaseY + heave * 0.06 * w + 0.05 * S.stagger;
  u.torso.rotation.z = pull * heave * 0.12 * w + 0.2 * S.flinch;
  S.head.x.step(Math.sin(ph) * 0.12 * w, dt, 2.2, 0.35);
  u.neck.rotation.set(S.head.x.x + A.wobble(S.t * 0.8, S.seed) * 0.08 - 0.5 * S.wind - 0.3 * S.flinch, A.wobble(S.t * 0.5, S.seed + 3) * 0.15 + S.look, 0);
  if (L.stumpL) { L.stumpL.rotation.x = Math.sin(ph) * 0.2 * w; L.stumpR.rotation.x = -Math.sin(ph) * 0.2 * w; }
  if (S.down > 0.001 || z._wasDown) { z.mesh.rotation.x = -0.4 * S.down; z._wasDown = S.down > 0.001; }
}

// A carried head (I2) hangs straight down from the hand, whatever the arm is
// doing, facing the way its body faces and swinging a little as it walks --
// and its word goes over it, not over the empty shoulders.
G.Zombie.prototype.hangHead = function (S) {
  const u = this.mesh.userData, h = u.heldHead;
  if (!h || !u.holdArm || h.parent !== u.holdArm.elbow) return;
  const pq = this._hpq || (this._hpq = new THREE.Quaternion()), q = this._hq || (this._hq = new THREE.Quaternion());
  const e = this._he || (this._he = new THREE.Euler(0, 0, 0, "YXZ"));
  h.parent.updateWorldMatrix(true, false);
  h.parent.getWorldQuaternion(pq);
  // (round 4: it swings with the stride -- the head nods along)
  const sw = S ? Math.sin(S.phase * Math.PI * 4 + S.seed) * (0.4 + 0.6 * S.moveW) : 0;
  q.setFromEuler(e.set(0.1 + sw * 0.12, this.mesh.rotation.y + sw * 0.18, sw * 0.15));
  h.quaternion.copy(pq.invert()).multiply(q);
  if (this.sprite && this.sprite.parent === this.mesh) {
    const v = h.getWorldPosition(this._hv || (this._hv = new THREE.Vector3()));
    v.y += 0.4 * (G.ZOMBIE_TYPES[this.type].scale || 1);
    this.sprite.position.copy(this.mesh.worldToLocal(v));
    if (this._labelBase) this._labelBase.copy(this.sprite.position);
  }
};
// called when a zombie strikes: arms and shoulders throw forward
G.Zombie.prototype.lunge = function () { if (this._anim) this._anim.lunge = 0.45; };
// a hit that did not kill: "light" a flinch (the rest is js/zombieai.js's)
G.Zombie.prototype.flinch = function () { if (this._anim) this._anim.flinch = 1; else this._flinchNext = true; };
