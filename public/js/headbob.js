// ===================================================================
// Head bob / camera sway (animation pass B)
// -------------------------------------------------------------------
// The camera rides the same gait the body and the gun do
// (G.PlayerBody.gait), so the view dips exactly when a foot takes the weight:
//   vertical bob   twice a stride (left and right footfall), just after contact
//   lateral sway   once a stride, over whichever foot is planted
//   roll           leans into a turn, and a touch into a strafe
// Its strength follows real speed (standing still = none, walking = light,
// running = clear), grows a little with a heavy gun and mostly goes away
// while aiming down the sights. Every channel is eased: it never snaps on or
// off when you start or stop.
// The gun hangs off the camera, so on its own it would bob rigidly with it.
// It gets the difference between a lagged copy of the bob and the bob itself
// (gunLag), so it trails the view by a few frames and reads as having weight.
// Settings > Accessibility: strength 0-100% and a switch that turns it all off
// (motion sickness).
// ===================================================================
G.HeadBob = {
  WEIGHT: { light: 0.95, medium: 1, heavy: 1.12, very_heavy: 1.22, melee: 0.95 },

  reset(rig) {
    const A = G.Anim;
    this.amp = 0; this.lean = 0; this.air = 0; this.wasAir = false;
    this.land = new A.Spring();
    this.lag = { x: new A.Spring(), y: new A.Spring(), rz: new A.Spring() };
    this.gunLag = { x: 0, y: 0, rz: 0 };
    this.off = { x: 0, y: 0, rx: 0, rz: 0 };
    if (rig) this.apply(rig);
  },

  // 0..1 from the Accessibility settings
  strength() {
    const s = G.save && G.save.settings;
    if (!s || s.headBobOff) return 0;
    const v = s.headBob == null ? 1 : +s.headBob;
    return Math.max(0, Math.min(1, isNaN(v) ? 1 : v));
  },

  // ctx: { dt, rig: {pitchObject, camera}, aimT, lookYaw (rad/s),
  //        vel (world m/s), yaw, weightKey, airborne }
  update(ctx) {
    if (!this.lag) this.reset();
    const A = G.Anim, dt = Math.max(1e-4, ctx.dt);
    const gt = G.PlayerBody.gait || { speed: 0, moveW: 0, runW: 0, bob: 0, sway: 0 };
    const str = this.strength();
    const aim = ctx.aimT || 0;
    this.air = A.approach(this.air, ctx.airborne ? 1 : 0, dt, 0.1);

    // how strongly, eased: a stop fades out over ~0.2 s instead of freezing
    // the view mid-dip
    const want = str * (this.WEIGHT[ctx.weightKey] || 1) * (1 - 0.85 * aim) * (1 - this.air);
    this.amp = A.approach(this.amp, want, dt, 0.18);
    const walkK = gt.moveW * A.clamp01((gt.speed || 0) / 3.2);   // 1 at walking pace
    const runK = gt.runW;                                         // 1 at a sprint
    const k = this.amp;

    let y = gt.bob * (0.016 * walkK + 0.018 * runK) * k;          // ~1.6cm walk, ~3.4cm run
    const x = gt.sway * (0.010 * walkK + 0.008 * runK) * k;
    const rx = gt.bob * (0.0035 * walkK + 0.004 * runK) * k;      // the head nods into the dip
    let rz = gt.sway * (0.004 * walkK + 0.003 * runK) * k;

    // lean into a turn (more when moving), and a little into a strafe
    const c = Math.cos(ctx.yaw || 0), s = Math.sin(ctx.yaw || 0);
    const v = ctx.vel || { x: 0, z: 0 };
    const lateral = v.x * c - v.z * s;                            // + = moving to the right
    const turn = Math.max(-0.03, Math.min(0.03, (ctx.lookYaw || 0) * 0.006)) * (0.3 + 0.7 * gt.moveW);
    const strafe = Math.max(-0.018, Math.min(0.018, -lateral * 0.0045));
    this.lean = A.approach(this.lean, (turn + strafe) * str * (1 - 0.8 * aim), dt, 0.14);
    rz += this.lean;

    // landing from a jump: a quick dip and recovery
    if (this.wasAir && !ctx.airborne) this.land.v -= 1.0;
    this.wasAir = !!ctx.airborne;
    this.land.step(0, dt, 3.4, 0.5);
    y += this.land.x * 0.5 * str;                   // ~2cm

    this.off.x = x; this.off.y = y; this.off.rx = rx; this.off.rz = rz;
    if (ctx.rig) this.apply(ctx.rig);

    // the gun trails the camera: a lagged copy minus the real thing
    this.lag.x.step(x, dt, 7, 0.75);
    this.lag.y.step(y, dt, 7, 0.75);
    this.lag.rz.step(rz, dt, 6, 0.8);
    this.gunLag.x = this.lag.x.x - x;
    this.gunLag.y = this.lag.y.x - y;
    this.gunLag.rz = this.lag.rz.x - rz;
  },

  // bob and sway move the pitch pivot (so they stay level whatever the view
  // pitch); nod and roll turn the camera itself
  apply(rig) {
    rig.pitchObject.position.set(this.off.x, this.off.y, 0);
    rig.camera.rotation.x = this.off.rx;
    rig.camera.rotation.z = this.off.rz;
  },
};
