// ===================================================================
// First-person player body (category D)
// -------------------------------------------------------------------
// Two rigs, deliberately separate:
//
//   bodyRig -> yawObject   torso, hips, legs, head. Turns with the player but
//                          NOT with their pitch, so looking down shows your
//                          own chest and boots the way it should instead of
//                          swinging the whole body up into the sky.
//   armRig  -> camera      shoulders, arms, hands. These follow the camera
//                          exactly, because they are holding the weapon and
//                          the weapon is parented to the camera too.
//
// Everything is BoxGeometry, to match the rest of the game's art.
// ===================================================================
G.PlayerBody = {
  built: false,
  bodyRig: null,
  armRig: null,
  _stride: 0,
  _lastHoldKey: null,

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
        hair: new THREE.MeshLambertMaterial({ color: 0x24201c }),
        strap: new THREE.MeshLambertMaterial({ color: 0x4a3a2a }),
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

  build(yawObject, camera) {
    this.dispose(yawObject, camera);
    const M = this._mats();

    // ---- body: hung off the yaw rig, eye level is y = 0 ----
    const body = new THREE.Group();
    // Head sits BEHIND the near plane on purpose. It exists so the rig is a
    // whole person rather than a floating torso, but a head drawn at the eye
    // would simply fill the screen.
    // Geometry here is tuned against the 0.1 near clip plane as much as against
    // anatomy: a chest modelled where a chest really is straddles the near
    // plane, and a polygon clipped by it smears across the whole lower screen
    // as a flat wall of colour. Everything is pushed down and back far enough
    // that no corner comes within 0.2 of the eye at any pitch.
    const head = new THREE.Group();
    head.position.set(0, -0.06, 0.22);                                // behind the camera
    this.box(head, 0.26, 0.26, 0.26, 0, 0, 0, M.skin);
    this.box(head, 0.28, 0.1, 0.28, 0, 0.13, 0, M.hair);
    body.add(head);
    this.box(body, 0.14, 0.12, 0.14, 0, -0.28, 0.18, M.skin);         // neck

    // The chest is set further BACK than the legs on purpose. Modelled in line
    // with them it simply occludes them, and looking down showed nothing but a
    // white slab -- this way the legs are the nearer surface and stay visible.
    const torso = new THREE.Group();
    torso.position.set(0, -0.63, 0.14);
    this.box(torso, 0.38, 0.46, 0.22, 0, 0, 0, M.shirt);
    this.box(torso, 0.40, 0.08, 0.24, 0, -0.25, 0, M.shirtDark);      // shirt hem
    this.box(torso, 0.09, 0.40, 0.24, -0.11, 0.02, 0, M.strap);       // sling over the shoulder
    body.add(torso);
    const hips = this.box(body, 0.40, 0.16, 0.22, 0, -0.93, 0.08, M.trouserDark);

    // Legs pivot at the hip, so a rotation swings the whole leg like a leg.
    // Total drop lands the soles at -1.70, which is exactly eye height above
    // the floor.
    const legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, -0.95, 0.02);
      const thigh = this.box(hip, 0.18, 0.40, 0.22, 0, -0.20, 0, M.trouser);
      const knee = new THREE.Group();
      knee.position.set(0, -0.40, 0);
      this.box(knee, 0.16, 0.30, 0.20, 0, -0.15, 0, M.trouserDark);
      this.box(knee, 0.18, 0.09, 0.28, 0, -0.345, 0.04, M.shoe);
      hip.add(knee);
      body.add(hip);
      return { hip, knee, thigh, side };
    });

    yawObject.add(body);
    this.bodyRig = { group: body, head, torso, hips, legs };

    // ---- arms: parented to the camera, alongside the weapon ----
    // Only the forearm and hand are modelled. An upper arm belongs behind the
    // eye, where it is either clipped or drawn as a slab filling a third of
    // the screen -- what a player actually sees of their own arms is the
    // sleeve from the elbow forward. Each arm pivots at its elbow.
    const arms = new THREE.Group();
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      const fore = this.box(pivot, 0.11, 0.11, 0.36, 0, 0, -0.18, M.shirtDark);
      this.box(pivot, 0.125, 0.125, 0.06, 0, 0, -0.37, M.shirt);       // cuff
      const hand = this.box(pivot, 0.12, 0.12, 0.17, 0, 0, -0.49, M.skin);
      arms.add(pivot);
      return { pivot, fore, hand, side };
    };
    const right = makeArm(1), left = makeArm(-1);
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

  // ctx: { dt, moving, sprinting, airborne, aimT, pose, reload, switchT,
  //        switchDur, recoilPos }
  update(ctx) {
    if (!this.built) return;
    const { dt } = ctx;
    const B = this.bodyRig, A = this.armRig;

    // ---- walk / run cycle -------------------------------------------------
    // Cadence follows the gait, not the frame rate: a run steps faster AND
    // further, so the stride phase advances on both counts.
    const cadence = ctx.sprinting ? 9.2 : 5.6;
    const target = ctx.moving ? 1 : 0;
    this._gait = (this._gait === undefined ? 0 : this._gait) + (target - (this._gait || 0)) * Math.min(1, dt * 8);
    this._stride += dt * cadence * this._gait;
    const swing = Math.sin(this._stride) * (ctx.sprinting ? 0.62 : 0.38) * this._gait;
    const lift = Math.max(0, Math.cos(this._stride)) * 0.3 * this._gait;

    B.legs.forEach((l) => {
      const s = l.side > 0 ? 1 : -1;               // legs alternate
      l.hip.rotation.x = swing * s;
      // the knee only bends on the backswing, which is what stops it reading
      // as a pair of stiff planks sliding back and forth
      l.knee.rotation.x = Math.max(0, -swing * s) * 1.1 + lift * (s > 0 ? 1 : 0.4);
    });
    // torso counter-sways against the legs, and leans forward into a sprint
    B.torso.rotation.z = -Math.sin(this._stride) * 0.035 * this._gait;
    B.torso.rotation.x = (ctx.sprinting ? 0.12 : 0.04) * this._gait;
    B.group.position.y = Math.abs(Math.sin(this._stride)) * 0.028 * this._gait;
    B.group.rotation.z = Math.sin(this._stride * 0.5) * 0.012 * this._gait;
    if (ctx.airborne) { B.legs.forEach((l) => { l.hip.rotation.x = -0.35; l.knee.rotation.x = 0.55; }); }

    // ---- arms: hold pose, then reload / switch on top --------------------
    const pose = ctx.pose;
    const aim = ctx.aimT || 0;
    const R = A.right, L = A.left;

    // Right hand rides the grip, so it inherits the weapon's own offsets.
    // Elbows sit low and off-screen, with the forearms angled up into frame --
    // an elbow modelled at its real height lands within 0.25 of the eye and
    // reads as a slab, not an arm.
    const gx = pose.x - (pose.x - 0.04) * aim;   // matches the weapon's ADS pull-in
    R.pivot.position.set(gx + 0.03, pose.y - 0.29 + ctx.gunDrop, -0.24 + ctx.recoilPos);
    R.pivot.rotation.set(0.55 + pose.rx + ctx.recoilPos * 0.8, -0.18 + aim * 0.14, pose.rz * 0.6);

    // Left hand supports the handguard -- further up the barrel the heavier
    // the weapon, and hidden entirely for a one-handed melee stance.
    L.pivot.visible = pose.support > 0.01;
    let lx = gx - 0.10 - pose.lead * 0.3;
    let ly = pose.y - 0.31 + ctx.gunDrop;
    let lz = -0.38 - pose.lead * 0.3;
    let lrot = { x: 0.55 - pose.sag * 1.2, y: 0.3, z: 0 };

    // Reload: the right hand keeps the grip while the left does the work --
    // strips the spent magazine, drops out of frame to fetch a fresh one,
    // pushes it home, then returns to the handguard.
    if (ctx.reload) {
      const p = ctx.reload.p;
      if (p < 0.22) {                                   // pull the old mag
        const k = p / 0.22;
        lx += 0.05 * k; ly += -0.26 * k; lz += 0.18 * k;
        lrot.x += 0.5 * k;
      } else if (p < 0.55) {                            // hand leaves the frame
        const k = (p - 0.22) / 0.33;
        lx += 0.05 + 0.04 * k; ly += -0.26 - 0.34 * k; lz += 0.18 + 0.1 * k;
        lrot.x += 0.5 + 0.3 * k;
      } else if (p < 0.86) {                            // bring the new one up and slam it in
        const k = (p - 0.55) / 0.31;
        const e = k * k * (3 - 2 * k);
        lx += (0.09) * (1 - e); ly += (-0.6) * (1 - e) + 0.04 * Math.sin(e * Math.PI);
        lz += (0.28) * (1 - e);
        lrot.x += 0.8 * (1 - e);
      } else {                                          // settle back onto the handguard
        const k = (p - 0.86) / 0.14;
        ly += 0.05 * Math.sin((1 - k) * Math.PI);
      }
      R.pivot.rotation.z += 0.22 * Math.sin(Math.min(1, p / 0.2) * Math.PI * 0.5) * (1 - Math.max(0, (p - 0.86) / 0.14));
    }

    // Weapon switch: both arms drop with the gun and swing slightly outward,
    // which is what sells the swap as an arm movement rather than the model
    // teleporting.
    if (ctx.switchT > 0) {
      const sp = 1 - ctx.switchT / ctx.switchDur;
      const dip = 1 - Math.abs(2 * sp - 1);
      ly -= 0.42 * dip; lx -= 0.1 * dip; lrot.x -= 0.7 * dip;
      R.pivot.position.y -= 0.42 * dip;
      R.pivot.rotation.x -= 0.7 * dip;
      R.pivot.rotation.y -= 0.3 * dip;
    }

    L.pivot.position.set(lx, ly, lz);
    L.pivot.rotation.set(lrot.x, lrot.y, lrot.z);

    // Both arms tuck in while aiming down sights.
    A.group.position.x = -0.05 * aim;
    A.group.position.y = -0.02 * aim;
  },
};
