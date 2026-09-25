// ===================================================================
// First-person player body (category D, rebuilt in animation pass A)
// -------------------------------------------------------------------
// Two rigs, deliberately separate:
//
//   bodyRig -> yawObject   pelvis, spine, legs. Turns with the player but NOT
//                          with their pitch, so looking down shows your own
//                          chest and boots instead of swinging the body up.
//   armRig  -> camera      upper arms, forearms, hands. The weapon is on the
//                          camera too, so the arms can reach it exactly.
//
// Both are driven procedurally, every frame:
//
//   gait   the stride phase advances with the distance actually covered, so
//          the feet plant at the speed the ground moves under them -- no
//          sliding -- and a heavier gun (slower walk) takes shorter, slower
//          steps. Each foot plant is reported for the footstep sound.
//   legs   two-bone IK from hip to ankle: the foot is put where the step
//          needs it and the knee bends to suit, forward like a knee does.
//   arms   two-bone IK from shoulder to wrist: the hands are placed on the
//          grip and the support point of whatever gun is held (see
//          G.ViewModel), and the elbows work out where they must be. The
//          shoulders sit on their own spring, so a turn reaches the arms a
//          moment after the body and the gun after that.
//
// Everything is BoxGeometry, to match the rest of the game's art.
// ===================================================================
G.PlayerBody = {
  built: false,
  bodyRig: null,
  armRig: null,
  gait: { phase: 0, speed: 0, moveW: 0, runW: 0, bob: 0, sway: 0, stride: 1, steps: [] },

  MATS: null,
  _mats() {
    if (!this.MATS) {
      this.MATS = {
        shirt: new THREE.MeshLambertMaterial({ color: 0xd9dee6 }),
        shirtDark: new THREE.MeshLambertMaterial({ color: 0xb6bcc6 }),
        trouser: new THREE.MeshLambertMaterial({ color: 0x2f3852 }),
        trouserDark: new THREE.MeshLambertMaterial({ color: 0x232a3d }),
        shoe: new THREE.MeshLambertMaterial({ color: 0x191a1f }),
        skin: new THREE.MeshLambertMaterial({ color: 0xc09168 }),
        skinDark: new THREE.MeshLambertMaterial({ color: 0xa87a55 }),
        hair: new THREE.MeshLambertMaterial({ color: 0x24201c }),
        strap: new THREE.MeshLambertMaterial({ color: 0x4a3a2a }),
        shell: new THREE.MeshLambertMaterial({ color: 0xb8322a }),
        brass: new THREE.MeshLambertMaterial({ color: 0xd9b24a }),
      };
    }
    return this.MATS;
  },

  box(parent, w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  },
  // a bone: a group whose geometry hangs down its local -Y, so aimBone can
  // point it from one joint at the next
  bone(parent, len, w, d, mat) {
    const b = new THREE.Group();
    this.box(b, w, len, d, 0, -len / 2, 0, mat);
    parent.add(b);
    return b;
  },

  // arm lengths in camera space. The viewmodel is drawn further from the eye
  // than a real gun is held (it has to clear the near plane), so the arms
  // are long to match -- only the forearms are ever in view.
  ARM: {
    right: { shoulder: new THREE.Vector3(0.28, -0.55, 0.1), upper: 0.48, fore: 0.46, pole: new THREE.Vector3(0.9, -1.0, 0.3) },
    left: { shoulder: new THREE.Vector3(-0.42, -0.6, 0.18), upper: 0.68, fore: 0.62, pole: new THREE.Vector3(-1.6, -0.7, 0.1) },
  },
  LEG: { hipY: -0.95, hipX: 0.11, hipZ: 0.02, thigh: 0.42, shin: 0.42, ankle: 0.08, floor: -1.70 },

  build(yawObject, camera) {
    this.dispose(yawObject, camera);
    const M = this._mats();

    // ---- body: hung off the yaw rig, eye level is y = 0 ----
    const body = new THREE.Group();
    // Geometry here is tuned against the 0.1 near clip plane as much as against
    // anatomy: a chest modelled where a chest really is straddles the near
    // plane and smears across the lower screen. Everything above the hips is
    // pushed down and back far enough that no corner comes within 0.2 of the
    // eye at any pitch. The spine pivots at the pelvis, so a lean tilts the
    // whole upper body over the hips.
    const spine = new THREE.Group();
    spine.position.set(0, -0.93, 0.08);
    body.add(spine);
    const head = new THREE.Group();
    head.position.set(0, 0.87, 0.14);                                  // behind the camera
    this.box(head, 0.26, 0.26, 0.26, 0, 0, 0, M.skin);
    this.box(head, 0.28, 0.1, 0.28, 0, 0.13, 0, M.hair);
    spine.add(head);
    this.box(spine, 0.14, 0.12, 0.14, 0, 0.65, 0.1, M.skin);          // neck
    const torso = new THREE.Group();
    torso.position.set(0, 0.30, 0.06);
    this.box(torso, 0.38, 0.46, 0.22, 0, 0, 0, M.shirt);
    this.box(torso, 0.40, 0.08, 0.24, 0, -0.25, 0, M.shirtDark);      // shirt hem
    this.box(torso, 0.09, 0.40, 0.24, -0.11, 0.02, 0, M.strap);       // sling
    // magazine pouches on the belt -- where the reload hand goes
    [-0.12, -0.02].forEach((x) => this.box(torso, 0.07, 0.1, 0.05, x, -0.2, -0.13, M.strap));
    spine.add(torso);
    const hips = this.box(body, 0.40, 0.16, 0.22, 0, -0.93, 0.08, M.trouserDark);

    const L = this.LEG;
    const legs = [-1, 1].map((side) => {
      const thigh = this.bone(body, L.thigh, 0.18, 0.21, M.trouser);
      const shin = this.bone(body, L.shin, 0.16, 0.19, M.trouserDark);
      const foot = new THREE.Group();
      this.box(foot, 0.17, 0.09, 0.28, 0, -0.035, -0.06, M.shoe);
      body.add(foot);
      return { side, thigh, shin, foot, hip: new THREE.Vector3(side * L.hipX, L.hipY, L.hipZ),
        knee: new THREE.Vector3(), ankle: new THREE.Vector3(), lift: 0 };
    });
    yawObject.add(body);
    this.bodyRig = { group: body, spine, torso, head, hips, legs };

    // ---- arms: parented to the camera, alongside the weapon ----
    const arms = new THREE.Group();
    const makeArm = (key) => {
      const cfg = this.ARM[key];
      const upper = this.bone(arms, cfg.upper, 0.125, 0.125, M.shirtDark);
      const fore = this.bone(arms, cfg.fore, 0.11, 0.11, M.shirtDark);
      this.box(fore, 0.125, 0.06, 0.125, 0, -cfg.fore + 0.03, 0, M.shirt);   // cuff at the wrist
      // The hand is modelled in GUN coordinates around its anchor, so giving
      // it the gun's orientation wraps it round the grip whatever the gun.
      const hand = new THREE.Group();
      if (key === "right") {
        this.box(hand, 0.105, 0.12, 0.115, 0.004, 0.005, 0.015, M.skin);         // fist round the grip
        this.box(hand, 0.03, 0.05, 0.1, -0.055, 0.045, -0.01, M.skinDark);      // thumb over the top
        this.box(hand, 0.02, 0.025, 0.05, -0.02, 0.035, -0.07, M.skinDark);     // trigger finger
      } else {
        this.box(hand, 0.1, 0.06, 0.15, -0.012, -0.035, 0.0, M.skin);           // palm under the handguard
        this.box(hand, 0.03, 0.075, 0.13, 0.045, 0.0, 0.0, M.skinDark);         // fingers up the far side
        this.box(hand, 0.03, 0.05, 0.07, -0.058, 0.005, 0.03, M.skinDark);      // thumb
      }
      // what the support hand can be carrying: a shotgun shell
      const shell = new THREE.Group();
      this.box(shell, 0.028, 0.028, 0.07, 0, 0.01, -0.02, M.shell);
      this.box(shell, 0.03, 0.03, 0.018, 0, 0.01, 0.022, M.brass);
      shell.visible = false;
      hand.add(shell);
      arms.add(hand);
      return { key, upper, fore, hand, shell, elbow: new THREE.Vector3(), wrist: new THREE.Vector3() };
    };
    const right = makeArm("right"), left = makeArm("left");
    camera.add(arms);
    this.armRig = { group: arms, right, left };
    this.built = true;
  },

  dispose(yawObject, camera) {
    if (this.bodyRig) { yawObject.remove(this.bodyRig.group); G.disposeObject3D(this.bodyRig.group); }
    if (this.armRig) { camera.remove(this.armRig.group); G.disposeObject3D(this.armRig.group); }
    this.bodyRig = null; this.armRig = null; this.built = false;
  },

  setVisible(v) {
    if (this.bodyRig) this.bodyRig.group.visible = v;
    if (this.armRig) this.armRig.group.visible = v;
  },

  // ---------------- gait ----------------
  // vel: world velocity (m/s) measured from the player's real movement;
  // yaw: body facing. Call once per frame before the viewmodel.
  stepGait(dt, vel, yaw, airborne) {
    const A = G.Anim, gt = this.gait;
    const speed = Math.hypot(vel.x, vel.z);
    gt.speed = A.approach(gt.speed, airborne ? gt.speed : speed, dt, 0.16);
    const sm = gt.speed;
    gt.moveW = A.approach(gt.moveW, sm > 0.25 ? 1 : 0, dt, 0.18);
    gt.runW = A.approach(gt.runW, A.clamp01((sm - 3.6) / 1.1), dt, 0.22);
    // stride (one full left+right cycle) lengthens with speed, so a run is
    // both faster AND longer steps
    gt.stride = 0.9 + 0.36 * sm;
    const prev = gt.phase;
    if (!airborne) gt.phase = (gt.phase + dt * sm / gt.stride) % 1;
    // footfalls at phase 0 (left) and 0.5 (right)
    gt.steps = gt.steps || [];
    if (sm > 0.6 && !airborne) {
      if (prev > gt.phase) gt.steps.push("left");
      else if (prev < 0.5 && gt.phase >= 0.5) gt.steps.push("right");
    }
    // the body dips just after each foot takes the weight and rises over it
    gt.bob = -Math.cos(4 * Math.PI * (gt.phase - 0.05));
    // and shifts over the planted foot
    gt.sway = -Math.sin(2 * Math.PI * (gt.phase - 0.05));
    // local (body-space) direction of travel, for placing the feet
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const lx = vel.x * c - vel.z * s, lz = vel.x * s + vel.z * c;
    const l = Math.hypot(lx, lz);
    if (l > 0.2) { gt.dirX = lx / l; gt.dirZ = lz / l; }
    return gt;
  },
  takeSteps() { const s = this.gait.steps || []; this.gait.steps = []; return s; },

  // ctx: { dt, airborne, sprinting, weightKey, aimT, lookYaw }
  update(ctx) {
    if (!this.built) return;
    const A = G.Anim, dt = ctx.dt, gt = this.gait;
    const B = this.bodyRig, L = this.LEG;
    this._t = (this._t || 0) + dt;

    // ---------------- legs ----------------
    const heavy = ctx.weightKey === "heavy" || ctx.weightKey === "very_heavy";
    const sf = 0.58 - 0.18 * gt.runW;                 // time a foot spends on the ground
    const reach = gt.stride * sf;                      // how far it travels back meanwhile
    const liftH = 0.1 + 0.16 * gt.runW;
    const dx = gt.dirX || 0, dz = gt.dirZ === undefined ? -1 : gt.dirZ;
    this._air = A.approach(this._air || 0, ctx.airborne ? 1 : 0, dt, 0.12);
    B.legs.forEach((leg, i) => {
      const p = (gt.phase + (i === 0 ? 0 : 0.5)) % 1;
      let along, lift;
      if (p < sf) {                                    // planted: moves back under the body
        along = (0.5 - p / sf) * reach; lift = 0;
      } else {                                         // swinging forward, heel up
        const u = (p - sf) / (1 - sf);
        along = (-0.5 + A.easeInOutCubic(u)) * reach;
        lift = Math.sin(Math.PI * u) * liftH;
      }
      const w = gt.moveW;
      const tgt = new THREE.Vector3(
        leg.hip.x + dx * along * w,
        L.floor + L.ankle + lift * w,
        leg.hip.z + dz * along * w);
      // airborne: knees come up
      tgt.y += 0.28 * this._air; tgt.z -= 0.12 * this._air;
      const hip = leg.hip.clone();
      hip.y += gt.bob * 0.025 * w;
      // knee bends forward (-Z is forward for the body)
      const pole = hip.clone().add(new THREE.Vector3(leg.side * 0.1, -0.4, -1));
      A.solveTwoBone(hip, tgt, L.thigh, L.shin, pole, leg.knee);
      leg.ankle.copy(tgt);
      A.aimBone(leg.thigh, hip, leg.knee);
      A.aimBone(leg.shin, leg.knee, tgt);
      leg.foot.position.copy(tgt);
      // toe drops as the foot swings through, then lands flat
      leg.foot.rotation.set(p < sf ? 0 : -Math.sin(Math.PI * (p - sf) / (1 - sf)) * 0.35 * w, 0, 0);
      if (dz > 0.3) leg.foot.rotation.y = 0;
    });

    // ---------------- spine ----------------
    // breathing, a lean into the run (more with a heavy gun), a sway over the
    // planted foot, and the torso trailing a turn a little
    const breath = Math.sin(this._t * 1.75);
    const lean = (0.05 * gt.moveW + (heavy ? 0.16 : 0.1) * gt.runW) * (1 - (ctx.aimT || 0) * 0.5);
    this._twist = this._twist || new G.Anim.Spring();
    this._twist.step(Math.max(-0.25, Math.min(0.25, -(ctx.lookYaw || 0) * 0.03)), dt, 3, 0.6);
    B.spine.rotation.set(-lean + breath * 0.008 * (1 - gt.moveW), this._twist.x, gt.sway * 0.04 * gt.moveW);
    B.torso.scale.set(1 + breath * 0.008, 1 + breath * 0.012, 1 + breath * 0.012);
    B.group.position.y = gt.bob * 0.02 * gt.moveW;

    // ---------------- arms ----------------
    const H = G.ViewModel.hands;
    const Ar = this.armRig;
    const sh = G.ViewModel.shoulder || { x: 0, y: 0 };
    [Ar.right, Ar.left].forEach((arm) => {
      const cfg = this.ARM[arm.key];
      const h = H ? H[arm.key] : null;
      const show = !!(h && h.visible);
      arm.upper.visible = arm.fore.visible = arm.hand.visible = show;
      if (!show) return;
      // hand: placed at the anchor with the gun's orientation
      arm.hand.position.copy(h.pos);
      arm.hand.quaternion.copy(h.quat);
      // wrist: behind the hand, along the gun's own axes
      const back = arm.key === "right" ? new THREE.Vector3(0.012, -0.03, 0.085) : new THREE.Vector3(-0.045, -0.055, 0.075);
      arm.wrist.copy(h.pos).add(back.applyQuaternion(h.quat));
      // shoulder, on the lagging spring
      const shoulder = cfg.shoulder.clone().add(new THREE.Vector3(sh.x, sh.y, 0));
      // an out-of-reach target pulls the shoulder along rather than leaving
      // the hand floating off the grip
      const d = arm.wrist.distanceTo(shoulder), maxR = cfg.upper + cfg.fore - 0.01;
      if (d > maxR) shoulder.lerp(arm.wrist, (d - maxR) / d);
      const pole = shoulder.clone().add(cfg.pole);
      A.solveTwoBone(shoulder, arm.wrist, cfg.upper, cfg.fore, pole, arm.elbow);
      A.aimBone(arm.upper, shoulder, arm.elbow);
      A.aimBone(arm.fore, arm.elbow, arm.wrist);
      arm.shell.visible = arm.key === "left" && !!G.ViewModel._shellVisible;
    });
  },
};
