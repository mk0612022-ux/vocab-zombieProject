// ===================================================================
// Weapon viewmodel (animation pass, part A)
// -------------------------------------------------------------------
// Owns everything about how the held weapon moves, and hands the arm rig
// the two points it has to reach (G.PlayerBody does the IK):
//
//   pose blending   hip / sprint / aim poses mixed by weights that ease in
//                   over ~0.2 s, never snapped
//   layers          idle breathing, gait bob locked to the actual footfalls
//                   (G.PlayerBody.gait), and springs for secondary motion:
//                   turn the view and the shoulders follow a moment late, the
//                   gun later still -- heavier guns lag more and swing less
//   sprint          light guns are carried loose and swing; heavy ones are
//                   hugged low across the body. Firing drops the sprint pose
//   switch          the old gun is lowered out of frame, the new one is
//                   raised, gripped and settles
//   reload          a keyframed routine per weapon type -- pistol, magazine
//                   rifle, bolt action, shell-by-shell shotgun, belt-fed LMG,
//                   launcher -- with a real magazine that comes out, falls
//                   and lands, and a new one fetched from the belt
//
// The reload's TIMING lives in gameplay -- G.WeaponSM (js/weaponsm.js), with
// G.Game putting the rounds in when the new magazine seats -- built from
// planReload() below, so the animation and the ammo can never disagree.
//
// (overhaul, round 1) the machine's state, in layers over the base pose:
//   reload          tactical (rounds left: shorter, nothing to release) or
//                   empty (the slide or bolt let go at the end)
//   inspect         the gun turned in the hands to show one side, then the
//                   other; any action ends it
//   lowered         dipped while a hand is busy (Use) or a question is open
//   knife           a wind-up and a cut, the blade arriving at the hit frame
//   flinch          a hit taken knocks it (x the Camera Shake setting)
//   breathing       heavier when the stamina is low
//   the screen      the hip carry moved in on a narrow screen, out on a wide one
//   hidden          put away while the machine is Disabled (death, a cutscene)
// ===================================================================
G.ViewModel = {
  group: null, def: null,
  hands: null,
  t: 0,

  // ---- per-weight tuning ----
  // sprint: where the gun is carried at a run. Light guns ride high across
  // the chest, barrel up; heavy ones are hugged low and flatter.
  SPRINT: {
    light: { x: -0.05, y: -0.11, z: 0.16, rx: 0.55, ry: 0.5, rz: 0.75 },
    medium: { x: -0.06, y: -0.13, z: 0.17, rx: 0.5, ry: 0.5, rz: 0.7 },
    heavy: { x: -0.10, y: -0.13, z: 0.18, rx: 0.28, ry: 0.45, rz: 0.50 },
    very_heavy: { x: -0.08, y: -0.17, z: 0.16, rx: 0.16, ry: 0.38, rz: 0.40 },
    melee: { x: -0.04, y: -0.10, z: 0.12, rx: -0.6, ry: 0.1, rz: 0.2 },
  },
  // how the gun answers movement and turning: spring frequency (lower =
  // lazier), how far it trails, and how much the gait bob moves it
  FEEL: {
    light: { freq: 4.6, lag: 1.0, bob: 1.15, swing: 1.3, switchDur: 0.40 },
    medium: { freq: 3.8, lag: 0.9, bob: 1.0, swing: 1.0, switchDur: 0.46 },
    heavy: { freq: 3.0, lag: 0.75, bob: 0.85, swing: 0.7, switchDur: 0.56 },
    very_heavy: { freq: 2.4, lag: 0.65, bob: 0.75, swing: 0.5, switchDur: 0.66 },
    melee: { freq: 5.0, lag: 1.0, bob: 1.1, swing: 1.4, switchDur: 0.34 },
  },
  BELT: new THREE.Vector3(-0.14, -0.78, -0.24),   // off-screen, at the hip
  // (gun reference pass) the draws of the clips, as keys over the raise:
  // [share, [x, y, rx, ry, rz]] added to the carry. The .45 (0.5 s): in from
  // the left lying on its side, a full twirl to pointing at the sky by a third,
  // down to the aim; the chassis sniper (1.3 s): up from low right, held a
  // moment canted toward the eye, settled
  SPIN: [[0, [-0.05, -0.36, 0.3, 0.2, Math.PI + 0.9]], [0.3, [-0.12, 0.03, 0.85, 0.35, 0.55]], [0.5, [-0.04, 0.04, 1.2, 0.1, 0.1]], [0.8, [0, 0.005, 0.1, 0, 0]], [1, [0, 0, 0, 0, 0]]],
  FLOURISH: [[0, [0.18, -0.42, -0.7, -0.3, -0.5]], [0.4, [0.02, 0.04, 0.18, -0.35, 0.35]], [0.72, [0, 0.01, -0.05, -0.05, -0.1]], [1, [0, 0, 0, 0, 0]]],
  // eased from key to key
  keyed(keys, u) {
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, a] = keys[i], [t1, b] = keys[i + 1];
      if (u <= t1 || i === keys.length - 2) {
        const e = G.Anim.smooth(G.Anim.seg(u, t0, t1));
        return a.map((v, j) => v + (b[j] - v) * e);
      }
    }
    return keys[keys.length - 1][1].slice();
  },
  HIP_LIFT: { y: 0.05, z: 0.06 },

  weightKey(def) {
    if (!def || def.id === "melee") return "melee";
    return G.weightClass(def).key;
  },
  switchDuration(def) { return this.FEEL[this.weightKey(def)].switchDur; },
  // (gun reference pass) bringing it up: a gun of the clips' in its prototype's
  // time (G.CONFIG.gunRef.draw), the rest in half their switch
  drawDuration(def) {
    const I = def && G.GunRef && G.GunRef.info(def);
    return I ? G.CONFIG.gunRef.draw[I.proto] : this.switchDuration(def) / 2;
  },
  // (overhaul, round 1) the weapon families of docs/overhaul/weapon-state-machine.md,
  // from the archetypes: what the animation, the sounds and the effects go by
  family(def) {
    if (!def || def.id === "melee") return "knife";
    const arch = G.WEAPON_ARCHETYPES[def.archetype] ? def.archetype : G.inferArchetype(def);
    return { pistol: "pistol", smg: "smg", rifle: "rifle", lmg: "lmg", shotgun: def.auto ? "shotgun_semi" : "shotgun_pump",
      sniper: "sniper_bolt" }[arch] || "special";
  },

  reset() {
    this.S = {
      sprintW: 0, moveW: 0, air: 0, rlW: 0, lastRl: null,
      yaw: new G.Anim.Spring(), pitch: new G.Anim.Spring(),
      shX: new G.Anim.Spring(), shY: new G.Anim.Spring(),
      inX: new G.Anim.Spring(), inZ: new G.Anim.Spring(), land: new G.Anim.Spring(),
      bump: new G.Anim.Spring(),
      prevVel: new THREE.Vector3(), wasAir: false,
      // (overhaul, round 1) the machine's layers
      lowW: 0, inspW: 0, inspU: 0, melW: 0, melU: 0, melHit: 0.2,
      flinchX: new G.Anim.Spring(), flinchZ: new G.Anim.Spring(), breath: 0,
    };
    this.t = 0;
  },
  // put away (the machine Disabled: death, a cutscene) or shown again
  visible: true,
  setVisible(on) {
    this.visible = !!on;
    if (this.group) this.group.visible = this.visible;
    if (G.PlayerBody && G.PlayerBody.armRig) G.PlayerBody.armRig.group.visible = this.visible;
    if (!on && this.S) this.S.lowW = 1;     // (it comes back up from below)
  },
  // a hit taken: a knock up and to one side that springs back
  flinch(k) {
    if (!this.S) this.reset();
    this.S.flinchX.v += (Math.random() < 0.5 ? -1 : 1) * 1.6 * k;
    this.S.flinchZ.v += 2.2 * k;
  },

  // ---- (gun reference pass) a bolt-action of the clips, worked after its shot ----
  // The steps are the clip's (G.GunRef.boltSteps): the hand to the bolt, it
  // lifted, pulled back, pushed home, turned down, the hand back on the grip;
  // the .50 sags meanwhile (10% of the screen, deepest half a second after).
  onShot(e) {
    const def = G.WEAPON_DEFS[e.weaponId], ref = def && G.GunRef && G.GunRef.info(def);
    if (!this.S) this.reset();
    this.boltHome();
    this.S.bolt = ref && ref.action === "bolt" ? { t: 0, st: G.GunRef.boltSteps(def), proto: ref.proto, def, ejected: false } : null;
  },
  // the clip's chassis sniper comes off the sight to work its bolt (the .50
  // stays on it and sags): js/game.js lets go of the aim meanwhile
  boltBusy() {
    const B = this.S && this.S.bolt;
    if (!B || !B.st || B.proto === "F") return false;
    return B.t > B.st.grab - 0.2 && B.t < B.st.down + 0.06;
  },
  boltPose(B) {
    const A = G.Anim, st = B.st, t = B.t;
    if (!st || t > st.settle + 0.12) return null;
    const work = A.smooth(A.seg(t, st.grab - 0.14, st.grab)) * (1 - A.smooth(A.seg(t, st.down + 0.02, st.settle)));
    const lift = A.smooth(A.seg(t, st.grab, st.lift)) * (1 - A.smooth(A.seg(t, st.push, st.down)));
    const back = A.easeOutQuad(A.seg(t, st.lift, st.pull)) * (1 - A.easeInQuad(A.seg(t, st.pull + 0.04, st.push)));
    const dip = st.dip ? A.smooth(A.seg(t, st.dip[0], st.dip[1])) * (1 - A.smooth(A.seg(t, st.dip[1], st.settle))) * st.dip[2] / 0.1 : 0;
    // canted toward the working hand; the screen's 10% at the carry's distance is ~0.12 m
    return { gun: [0.01 * work, 0.012 * work - 0.12 * dip, 0.02 * work, 0.04 * work, 0, -0.16 * work], work, lift, back };
  },
  boltHome() {
    const P = this.group && this.group.userData.parts;
    const b = P && P.bolt;
    if (b && b.userData.home) { b.position.copy(b.userData.home.pos); b.rotation.copy(b.userData.home.rot); }
  },

  onWeaponBuilt(group, def) {
    this.group = group; this.def = def;
    group.visible = this.visible !== false;
    // (gun reference pass: a gun of the clips' prototypes is held at its own size)
    group.scale.setScalar(group.userData.vmScale || 1);
    if (!this.S) this.reset();
    const P = (group.userData.parts) || {};
    // remember each moving part's rest pose
    Object.values(P).forEach((p) => { p.userData.home = { pos: p.position.clone(), rot: p.rotation.clone() }; p.visible = true; });
    this._magInHand = false;
  },

  // ================= reload plans =================
  // Keyframe times (fractions of the whole reload) for the magazine styles.
  // `in` is when the fresh magazine seats -- the moment ammo is refilled.
  STYLES: {
    pistol: { out: 0.10, drop: 0.18, grab: 0.38, in: 0.58, slap: 0.62, bolt: 0.80 },
    rifle: { out: 0.13, drop: 0.24, grab: 0.44, in: 0.64, slap: 0.70, bolt: 0.84 },
    bolt: { out: 0.13, drop: 0.24, grab: 0.42, in: 0.60, slap: 0.65, bolt: 0.80 },
    belt: { cover: 0.16, out: 0.26, drop: 0.34, grab: 0.50, in: 0.66, coverClose: 0.80, bolt: 0.91 },
    launcher: { out: 0.14, drop: 0.26, grab: 0.46, in: 0.66, slap: 0.72, bolt: 0.86 },
  },
  // (gun reference pass) the timelines of GUN_REFERENCE.md section 4.2, as
  // shares of the gun's own reload time -- a gun of the clips goes by its
  // family's: a pistol releases at once and its slide goes at ~3/4; the SMG's
  // magazine is out by a third and locked at two thirds; the long rifle
  // rocks its magazine out and in early and hauls the handle at ~2/3; the
  // belt-fed's cover opens first, the box is swapped at ~0.4, the cover
  // slammed at ~0.8 and it is charged last
  REF_STYLES: {
    pistol: { out: 0.06, drop: 0.14, grab: 0.32, in: 0.56, slap: 0.6, bolt: 0.76 },
    pistol45: { out: 0.06, drop: 0.14, grab: 0.32, in: 0.56, slap: 0.6, bolt: 0.78 },
    smg: { out: 0.13, drop: 0.29, grab: 0.45, in: 0.66, slap: 0.7, bolt: 0.87 },
    ak: { out: 0.08, drop: 0.2, grab: 0.32, in: 0.46, slap: 0.5, bolt: 0.69 },
    belt: { cover: 0.05, out: 0.15, drop: 0.39, grab: 0.47, in: 0.61, coverClose: 0.79, bolt: 0.91 },
    bolt: { out: 0.13, drop: 0.24, grab: 0.42, in: 0.6, slap: 0.65, bolt: 0.8 },
    boltClip: { out: 0.1, drop: 0.24, grab: 0.36, in: 0.55, slap: 0.62, bolt: 0.78 },
    bolt50: { out: 0.13, drop: 0.24, grab: 0.42, in: 0.6, slap: 0.65, bolt: 0.82 },
  },
  SHELL: { lead: 0.28, tail: 0.38 },

  // the shell-by-shell tail with nothing to rack (a round already chambered)
  SHELL_TAIL_NO_PUMP: 0.18,

  // What a reload of this gun, `missing` rounds short, looks like in time.
  // Returns { style, dur, events: [{ t, kind }], keys } with t in seconds.
  // (overhaul, round 1) `kind`: "tactical" -- rounds left in the magazine:
  // no slide or bolt to let go, and the rest a little quicker
  // (G.CONFIG.weaponSM.tacticalScale) -- or "empty"; shell by shell, the
  // pump at the end only when it started empty.
  planReload(def, missing, kind) {
    const group = this.group;
    const style = (group && group.userData.reloadStyle) || "rifle";
    const base = (def.reloadTime || 1500) / 1000;
    const tactical = kind === "tactical";
    if (style === "shotgun") {
      // one shell at a time: the reload is as long as the shells it takes
      const shellT = Math.max(0.2, (base - 0.55) / Math.max(1, def.magSize));
      const n = Math.max(1, missing);
      const pump = !tactical;
      const tail = pump ? this.SHELL.tail : this.SHELL_TAIL_NO_PUMP;
      const dur = this.SHELL.lead + n * shellT + tail;
      const events = [];
      for (let i = 0; i < n; i++) events.push({ t: this.SHELL.lead + (i + 0.5) * shellT, kind: "shell" });
      if (pump) events.push({ t: dur - tail + 0.2, kind: "pump" });
      return { style, dur, shellT, shells: n, events, tail, pump };
    }
    const ref = G.GunRef && G.GunRef.info(def);
    let k = (ref && this.REF_STYLES[ref.reload]) || this.STYLES[style] || this.STYLES.rifle;
    let dur = base;
    if (tactical) {
      // the release step goes; what is left spreads over the shorter time
      const t2 = {};
      Object.keys(k).forEach((s) => { if (s !== "bolt") t2[s] = Math.min(0.93, k[s] / 0.88); });
      k = t2;
      dur = base * G.CONFIG.weaponSM.tacticalScale;
    }
    const events = Object.keys(k).map((s) => ({ t: k[s] * dur, kind: s }));
    events.sort((a, b) => a.t - b.t);
    return { style, dur, events, keys: k };
  },

  // ================= per-frame =================
  // ctx: { dt, def, aimT, sprinting, firing, lookYaw, lookPitch (rad/s),
  //        airborne, recoilPos, recoilRot, switchP (0..1 or null),
  //        reload: G.Game.reloadState or null, vel (world, m/s), yaw,
  //        sm: G.WeaponSM view() (overhaul, round 1), stamina (0-1), aspect }
  update(ctx) {
    const g = this.group;
    if (!g) return;
    if (!this.S) this.reset();
    const S = this.S, A = G.Anim, dt = Math.max(1e-4, ctx.dt);
    const WC = G.CONFIG.weaponSM;
    const sm = ctx.sm || {};
    this.t += dt;
    const def = ctx.def;
    const wk = this.weightKey(def);
    const hold = G.holdPose(def);
    // (gun reference pass) one of the clips' prototypes (js/gunref.js), or null
    const ref = def && G.GunRef ? G.GunRef.info(def) : null;
    const feel = this.FEEL[wk];
    const gait = G.PlayerBody.gait || { phase: 0, moveW: 0, runW: 0, bob: 0, sway: 0 };

    // ---- state weights (all eased, ~0.15-0.25 s) ----
    // (overhaul, round 1: a reload goes on at a run -- the carry only leans a
    // little toward the sprint pose, so the hands' work stays in view)
    const busy = ctx.firing || ctx.switchP != null || sm.inspectP != null || sm.meleeP != null;
    const sprintTo = ctx.sprinting && !busy ? (ctx.reload ? 0.3 : 1) : 0;
    S.sprintW = A.approach(S.sprintW, sprintTo, dt, sprintTo > S.sprintW ? 0.26 : 0.14);
    S.moveW = gait.moveW;
    S.air = A.approach(S.air, ctx.airborne ? 1 : 0, dt, 0.12);
    const aim = ctx.aimT || 0;

    // ---- base pose: hip -> sprint -> aim ----
    // The hip carry sits a little higher and nearer than the old one, so the
    // firing hand on the grip is in frame (it used to sit below the screen);
    // the aimed pose below is unchanged.
    // (overhaul, round 1) The vertical field of view is fixed, so on a
    // narrower screen (an iPad's 4:3) the same carry sits nearer the edge and
    // on a wider one (21:9) nearer the middle: it is moved in or out to keep
    // its place on the screen.
    const ak = Math.max(WC.aspect.min, Math.min(WC.aspect.max, (ctx.aspect || 16 / 9) / (16 / 9)));
    const sp = this.SPRINT[wk];
    const sw = A.smooth(S.sprintW);
    const HIP = this.HIP_LIFT;
    let px = hold.x * ak + sp.x * sw, py = hold.y - hold.sag + HIP.y + sp.y * sw, pz = hold.z + HIP.z + sp.z * sw;
    let rx = hold.rx + sp.rx * sw, ry = -0.06 + sp.ry * sw, rz = hold.rz + sp.rz * sw;
    // (gun reference pass) a gun of the clips: carried as the clip carries it
    // (nearer and bigger; a pistol low in the middle)...
    const HN = g.userData.hipNudge, AI = g.userData.aim;
    if (HN) { const k = 1 - sw; px += HN[0] * k; py += HN[1] * k; pz += HN[2] * k; }
    if (AI && AI.y != null) {
      // ...and aimed down its own sight: the sight's middle on the line of the
      // view, `eye` behind it -- further while a scope's zoom is in, so the
      // sight fills as much of the screen as the clip's does
      const s = g.scale.x, fovK = Math.tan(25 * Math.PI / 180) / Math.tan(((G.Game && G.Game.camera ? G.Game.camera.fov : 50) * Math.PI) / 360);
      px += (0 - px) * aim; py += (-AI.y * s - py) * aim; pz += (-(AI.eye * fovK) - AI.z * s - pz) * aim;
    } else {
      // aim-down-sights pulls it to the centre line (same end pose as before)
      px += (0.04 - px) * aim; py += (hold.y + 0.02 - py) * aim; pz += (hold.z + 0.1 - pz) * aim;
    }
    rx *= 1 - aim; ry *= 1 - aim; rz *= 1 - aim;

    // ---- idle: breathing and a slow drift, damped out when moving or aiming ----
    // (overhaul, round 1: deeper and quicker breaths when the stamina is low)
    const tired = Math.max(0, 1 - (ctx.stamina == null ? 1 : ctx.stamina) / 0.5);
    S.breath += dt * 1.75 * (1 + 0.7 * tired);
    const deep = 1 + 1.6 * tired * tired;
    const still = (1 - S.moveW) * (1 - aim * 0.75);
    const breath = Math.sin(S.breath);
    py += breath * 0.0045 * deep * still;
    rx += Math.sin(S.breath - 0.6) * 0.007 * deep * still;
    px += A.wobble(this.t * 0.6, 1) * 0.0025 * still;
    rz += A.wobble(this.t * 0.5, 4) * 0.006 * still;

    // ---- gait bob: locked to the footfalls, not to a clock ----
    // (overhaul, round 8: x Settings > Accessibility > Weapon bob, and Reduce Motion)
    const move = S.moveW * (1 - aim * 0.85) * (G.Access ? G.Access.weaponBob() : 1);
    const bobAmp = (0.011 + 0.012 * gait.runW) * feel.bob;
    py += gait.bob * bobAmp * move;
    px += gait.sway * 0.012 * feel.swing * move;
    rz += gait.sway * 0.03 * feel.swing * move;
    rx += gait.bob * 0.012 * move;
    ry += gait.sway * 0.02 * feel.swing * move;
    // ...and on top of that it trails the camera's own bob (G.HeadBob)
    const hb = G.HeadBob && G.HeadBob.gunLag;
    if (hb) { px += hb.x; py += hb.y; rz += hb.rz; }

    // ---- secondary motion: the gun trails the view, the shoulders a little
    // less. Different spring rates are what make it read as a chain
    // (body -> shoulders -> arms -> gun) instead of one rigid block.
    const lagK = feel.lag * (1 - aim * 0.7);
    const yawT = Math.max(-0.14, Math.min(0.14, -ctx.lookYaw * 0.022 * lagK));
    const pitT = Math.max(-0.1, Math.min(0.1, -ctx.lookPitch * 0.018 * lagK));
    S.yaw.step(yawT, dt, feel.freq, 0.55);
    S.pitch.step(pitT, dt, feel.freq, 0.55);
    S.shX.step(yawT * 0.35, dt, feel.freq * 1.6, 0.7);
    S.shY.step(pitT * 0.35, dt, feel.freq * 1.6, 0.7);
    ry += S.yaw.x; rx += S.pitch.x;
    px += S.yaw.x * 0.35; py += S.pitch.x * 0.3;
    rz += S.yaw.x * 0.5;

    // movement inertia: start forward and the gun sits back a moment; strafe
    // and it swings the other way
    const vel = ctx.vel || S.prevVel;
    const acc = new THREE.Vector3().subVectors(vel, S.prevVel).multiplyScalar(1 / dt);
    S.prevVel.copy(vel);
    const c = Math.cos(ctx.yaw || 0), s = Math.sin(ctx.yaw || 0);
    const ax = acc.x * c - acc.z * s, az = acc.x * s + acc.z * c;   // into view space
    S.inX.step(Math.max(-0.05, Math.min(0.05, -ax * 0.004 * lagK)), dt, feel.freq, 0.6);
    S.inZ.step(Math.max(-0.05, Math.min(0.05, -az * 0.004 * lagK)), dt, feel.freq, 0.6);
    px += S.inX.x; pz += S.inZ.x;

    // jump and landing: lifts while airborne, dips on impact
    if (S.wasAir && !ctx.airborne) S.land.v -= 0.9;
    S.wasAir = !!ctx.airborne;
    S.land.step(0, dt, 3.2, 0.45);
    py += 0.03 * S.air + S.land.x * 0.06;
    rx += 0.05 * S.air + S.land.x * 0.1;

    // ---- recoil (kicked by G.Game.recoilKick) ----
    pz += ctx.recoilPos || 0;
    rx -= ctx.recoilRot || 0;

    // impulses from the reload (a slap, a bolt going home)
    S.bump.step(0, dt, 6, 0.35);
    py += S.bump.x * 0.02; rx += S.bump.x * 0.05;
    // (overhaul, round 1) a hit taken: knocked, then back
    S.flinchX.step(0, dt, 5, 0.45); S.flinchZ.step(0, dt, 5, 0.5);
    rz += S.flinchX.x * 0.06; px += S.flinchX.x * 0.012; rx += S.flinchZ.x * 0.05; pz += S.flinchZ.x * 0.015;

    // ---- (overhaul, round 1) inspecting: one side, then the other ----
    if (sm.inspectP != null) { S.inspU = sm.inspectP; S.inspW = 1; }
    else S.inspW = A.approach(S.inspW, 0, dt, 0.09);     // any action: let go at once, eased
    let magOff = 0, magHand = 0;
    if (S.inspW > 0.001 && ref && ref.inspect === "magCheck") {
      // (gun reference pass) the SMG's of the clip (section 3.3, 2.2 s): turned
      // to show its left side, held, tipped down to check the magazine -- out
      // a little at 0.62, back in at 0.88 -- and home
      const u = S.inspU, w = S.inspW;
      const turn = A.smooth(A.seg(u, 0, 0.23)) * (1 - A.smooth(A.seg(u, 0.9, 1)));
      const tilt = A.smooth(A.seg(u, 0.5, 0.6)) * (1 - A.smooth(A.seg(u, 0.88, 0.97)));
      px += -0.1 * turn * w; py += (0.06 * turn + 0.03 * tilt) * w; pz += 0.05 * turn * w;
      ry += 0.55 * turn * w; rz += (-0.3 * turn + 0.22 * tilt) * w; rx += 0.38 * tilt * w;
      magOff = -0.05 * A.smooth(A.seg(u, 0.62, 0.7)) * (1 - A.smooth(A.seg(u, 0.84, 0.88))) * w;
      magHand = A.smooth(A.seg(u, 0.55, 0.62)) * (1 - A.smooth(A.seg(u, 0.9, 0.96))) * w;
    } else if (S.inspW > 0.001) {
      const u = S.inspU, w = S.inspW;
      const heavy = wk === "heavy" || wk === "very_heavy" ? 0.7 : 1;
      const up = A.smooth(A.seg(u, 0, 0.16)), b = A.smooth(A.seg(u, 0.16, 0.48)), c = A.smooth(A.seg(u, 0.52, 0.82));
      const home = 1 - A.smooth(A.seg(u, 0.84, 1));
      const k = up * home * w;
      // brought in and up toward the middle of the view...
      px += -0.11 * k; py += 0.07 * k; pz += 0.06 * k;
      // ...turned to show its left side, then across to its right and tipped to look along the top
      ry += (0.62 * b - 1.12 * c) * heavy * home * w;
      rz += (-0.28 * b + 0.42 * c) * heavy * home * w;
      rx += (0.12 * b - 0.3 * c) * heavy * home * w;
    }

    // ---- (overhaul, round 1) the knife: wind-up, then the cut at the hit frame ----
    if (sm.meleeP != null) { S.melU = sm.meleeP; S.melHit = sm.meleeHitP || 0.2; S.melW = 1; }
    else S.melW = A.approach(S.melW, 0, dt, 0.08);
    if (S.melW > 0.001) {
      const u = S.melU, h = S.melHit, w = S.melW;
      const wind = A.smooth(A.seg(u, 0, h * 0.85)) * (1 - A.easeInQuad(A.seg(u, h * 0.85, h)));
      const cut = A.easeOutCubic(A.seg(u, h * 0.55, h + 0.12)) * (1 - A.smooth(A.seg(u, 0.5, 1)));
      px += (0.07 * wind - 0.24 * cut) * w; py += (0.05 * wind - 0.07 * cut) * w; pz += (-0.04 * wind - 0.06 * cut) * w;
      ry += (0.35 * wind - 0.85 * cut) * w; rz += (-0.6 * wind + 0.75 * cut) * w; rx += (-0.2 * wind + 0.25 * cut) * w;
    }

    // ---- (overhaul, round 1) lowered (Use, a question open) and put away ----
    const down = sm.lowered || sm.disabled ? 1 : 0;
    S.lowW = A.approach(S.lowW, down, dt, down ? 0.12 : 0.06);
    if (S.lowW > 0.001) {
      const L = WC.lowerPose, lw = A.smooth(Math.min(1, S.lowW));
      py += L.y * lw; rx += L.rx * lw; pz += L.z * lw;
    }

    // ---- weapon switch: lower out of frame, raise, grip, settle ----
    let leftOff = 0;
    if (ctx.switchP != null) {
      const p = ctx.switchP;
      const down = A.easeInCubic(A.seg(p, 0, 0.45));
      const up = p < 0.5 ? 1 : 1 - A.easeOutBack(A.seg(p, 0.55, 0.9));
      const k = p < 0.5 ? down : up;
      // (gun reference pass) the clips' own: the .50 swung up on end to be put
      // away; the .45 twirled up from the left, pointed at the sky and brought
      // down; the chassis sniper brought up canted to show it off
      const style = ref ? (p < 0.5 ? ref.holster : ref.draw) : "standard";
      if (style === "swingUp") {
        const sw = A.smooth(A.seg(p, 0, 0.32)), off = A.easeInCubic(A.seg(p, 0.3, 0.5));
        py += 0.08 * sw - 0.5 * off; rx += 1.35 * sw; rz -= 0.25 * sw; px += 0.08 * sw + 0.1 * off;
      } else if (style === "spin" || style === "flourish") {
        const o = this.keyed(style === "spin" ? this.SPIN : this.FLOURISH, A.seg(p, 0.5, 1));
        px += o[0]; py += o[1]; rx += o[2]; ry += o[3]; rz += o[4];
      } else {
        py -= 0.62 * k; rx -= 0.95 * k; rz += 0.45 * k; px += 0.06 * k;
      }
      // the support hand lets go first and grabs last
      leftOff = Math.max(A.smooth(A.seg(p, 0, 0.22)) * (p < 0.5 ? 1 : 0), p >= 0.5 ? 1 - A.smooth(A.seg(p, 0.82, 1)) : 0);
      // grip settle: the new gun gives a small shake as the hands tighten
      if (p > 0.86) rz += Math.sin((p - 0.86) / 0.14 * Math.PI * 2) * 0.03 * (1 - A.seg(p, 0.86, 1));
    }

    // ---- reload pose ----
    let rl = null;
    if (ctx.reload && ctx.reload.plan && g.userData.reloadStyle) {
      rl = this.reloadPose(ctx.reload);
      S.lastRl = rl; S.rlW = 1;
    } else if (S.rlW > 0) {
      // cancelled or finished: blend back out rather than snapping
      S.rlW = A.approach(S.rlW, 0, dt, 0.18);
      if (S.rlW < 0.01) { S.rlW = 0; S.lastRl = null; this.restoreParts(); }
      rl = S.lastRl;
    }
    const rw = S.rlW;
    if (rl) {
      px += rl.gun.x * rw; py += rl.gun.y * rw; pz += rl.gun.z * rw;
      rx += rl.gun.rx * rw; ry += rl.gun.ry * rw; rz += rl.gun.rz * rw;
    }

    // ---- (gun reference pass) the bolt worked between shots (F G H I) ----
    let bc = null;
    if (S.bolt) {
      if (ctx.reload || ctx.switchP != null || sm.meleeP != null) { this.boltHome(); S.bolt = null; }
      else {
        S.bolt.t += dt;
        // the case comes out as the bolt is pulled back (the clip's chassis sniper)
        if (!S.bolt.ejected && S.bolt.st && S.bolt.t >= S.bolt.st.pull) { S.bolt.ejected = true; if (G.FX && G.FX.eject) G.FX.eject(S.bolt.def); }
        bc = this.boltPose(S.bolt);
        if (!bc) { this.boltHome(); S.bolt = null; }
        else { px += bc.gun[0]; py += bc.gun[1]; pz += bc.gun[2]; rx += bc.gun[3]; ry += bc.gun[4]; rz += bc.gun[5]; }
      }
    }

    // ---- write the transform ----
    g.position.set(px, py, pz);
    g.rotation.set(rx, ry, rz);
    g.updateMatrix();
    if (g.userData.rainbowTrim) g.userData.rainbowTrim.rotation.z += dt * 2.4;

    // ---- hands ----
    const An = g.userData.anchors;
    const toCam = (v) => v.clone().applyMatrix4(g.matrix);
    const right = { pos: toCam(An.grip), quat: g.quaternion.clone(), visible: true };
    let left = null;
    if (hold.support > 0.01 && An.fore) {
      left = { pos: toCam(An.fore), quat: g.quaternion.clone(), visible: true };
      if (leftOff > 0) left.pos.lerp(toCam(An.fore).add(new THREE.Vector3(-0.06, -0.34, 0.12)), leftOff);
    }
    if (rl && rw > 0) {
      if (rl.left && left) left.pos.lerp(rl.left, rw);
      if (rl.right) right.pos.lerp(rl.right, rw);
    }
    // (gun reference pass) the right hand on the bolt: up, back, forward, down;
    // the left on the magazine while it is checked
    const P = g.userData.parts || {};
    if (bc && An.bolt) {
      if (P.bolt && P.bolt.userData.home) {
        P.bolt.rotation.z = P.bolt.userData.home.rot.z + 1.1 * bc.lift;
        P.bolt.position.copy(P.bolt.userData.home.pos).add(new THREE.Vector3(0, 0, 0.09 * bc.back));
      }
      const hb = toCam(An.bolt.clone().add(new THREE.Vector3(0.05, 0.02 + 0.03 * bc.lift, 0.09 * bc.back)));
      right.pos.lerp(hb, bc.work);
    }
    if (magOff && P.mag && P.mag.userData.home && !rl) P.mag.position.copy(P.mag.userData.home.pos).add(new THREE.Vector3(0, magOff, 0));
    else if (!rl && S._magOff && P.mag && P.mag.userData.home) P.mag.position.copy(P.mag.userData.home.pos);
    S._magOff = magOff;
    if (magHand > 0 && left && An.magBottom) left.pos.lerp(toCam(An.magBottom), magHand);
    this.hands = { right, left };
    this.shoulder = { x: S.shX.x * 0.6, y: S.shY.x * 0.6 };
  },

  // ================= reload poses =================
  // Everything is computed fresh from the reload clock, so a reload that is
  // cancelled or restarted can never leave a part stuck half way.
  reloadPose(R) {
    const g = this.group, A = G.Anim, An = g.userData.anchors, P = g.userData.parts || {};
    const gun = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    const toCam = (v) => v.clone().applyMatrix4(g.matrix);
    // the gun transform this frame, before reload offsets, is what the
    // anchors hang off -- good enough, the offsets are small
    g.updateMatrix();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const out = { gun, left: null, right: null };

    if (R.plan.style === "shotgun") return this.shotgunPose(R, out);

    const u = Math.min(1, R.t / R.plan.dur);
    // (the plan's own keys: a tactical reload has no release step)
    const k = R.plan.keys || this.STYLES[R.plan.style] || this.STYLES.rifle;
    // big guns are tipped less far -- they are hauled, not flipped
    const heavy = R.plan.style === "launcher" || R.plan.style === "belt" ? 0.85 : 1;

    // gun: tip toward the support hand for the magazine, then turn the other
    // way for the charging handle / slide
    const inT = A.smooth(A.seg(u, 0, 0.12)), outT = A.smooth(A.seg(u, 0.9, 1));
    const magPhase = inT * (1 - A.smooth(A.seg(u, k.in + 0.04, k.in + 0.12)));
    const boltPhase = A.smooth(A.seg(u, k.in + 0.08, k.in + 0.16)) * (1 - outT);
    // (brought up, in and rolled so the magazine well faces the camera --
    // otherwise the whole swap happens below the bottom of the screen)
    gun.rz = (-0.55 * magPhase + 0.3 * boltPhase) * heavy;
    gun.rx = (0.3 * magPhase + 0.08 * boltPhase) * heavy;
    gun.y = 0.14 * magPhase - 0.02 * boltPhase;
    gun.x = -0.14 * magPhase - 0.02 * boltPhase;
    gun.z = 0.1 * magPhase;
    if (R.plan.style === "pistol") { gun.rx += 0.15 * magPhase; gun.rz -= 0.15 * magPhase; }

    // left hand: a path of keys, each either on the gun or at the belt
    const fore = toCam(An.fore);
    const mb = (dy, dz) => toCam(An.magBottom.clone().add(V(0, dy || 0, dz || 0)));
    const belt = this.BELT.clone();
    const keys = [[0, fore]];
    if (R.plan.style === "belt") {
      keys.push([k.cover - 0.08, toCam(An.cover.clone().add(V(0, 0.02, -0.04)))]);
      keys.push([k.cover, toCam(An.cover.clone().add(V(0, 0.12, 0.02)))]);
      keys.push([k.out, mb(0, 0)]);
    } else {
      keys.push([k.out, mb(-0.01, 0)]);
    }
    keys.push([k.drop, mb(-0.17, 0.05)]);
    keys.push([(k.drop + k.grab) / 2, belt.clone().add(V(0.02, 0.1, 0))]);
    keys.push([k.grab, belt]);
    keys.push([k.in - 0.07, mb(-0.15, 0.02)]);
    keys.push([k.in, mb(0, 0)]);
    if (k.slap) {
      keys.push([k.slap - 0.03, mb(-0.07, 0.01)]);
      keys.push([k.slap, mb(0.01, 0)]);
    }
    if (k.coverClose) {
      keys.push([k.coverClose - 0.08, toCam(An.cover.clone().add(V(0, 0.14, 0.02)))]);
      keys.push([k.coverClose, toCam(An.cover.clone().add(V(0, 0.03, 0)))]);
    }
    if (R.plan.style !== "bolt" && k.bolt) {
      const side = R.plan.style === "pistol" ? V(-0.01, 0.05, 0.05) : V(0.07, 0.02, 0);
      keys.push([k.bolt - 0.07, toCam(An.bolt.clone().add(side))]);
      keys.push([k.bolt, toCam(An.bolt.clone().add(side).add(V(0, 0, 0.1)))]);
    }
    keys.push([0.93, fore]);
    keys.push([1, fore]);
    out.left = this.path(keys, u);
    R._leftCam = out.left;   // the fresh magazine rides on this hand

    // right hand: stays on the grip, except to work a bolt action
    if (R.plan.style === "bolt" && k.bolt) {
      const grip = toCam(An.grip);
      const bh = (dx, dy, dz) => toCam(An.bolt.clone().add(V(0.08 + dx, dy, dz)));
      out.right = this.path([[0, grip], [k.bolt - 0.1, grip], [k.bolt - 0.06, bh(0, 0, 0)], [k.bolt - 0.03, bh(0, 0.05, 0)],
        [k.bolt, bh(0, 0.05, 0.12)], [k.bolt + 0.04, bh(0, 0.05, 0)], [k.bolt + 0.07, bh(0, 0, 0)], [k.bolt + 0.13, grip], [1, grip]], u);
    }

    // ---- the moving parts ----
    this.poseParts(R, u, k, P, An);
    if (u > k.in - 0.005 && u < k.in + 0.02 && !R._bumped) { R._bumped = true; this.S.bump.v += 1.2; }
    if (k.slap && u > k.slap && !R._slapped) { R._slapped = true; this.S.bump.v += 1.6; }
    return out;
  },

  // Interpolates a list of [time, cameraSpacePoint] keys with an ease in and
  // out on every leg, so the hand accelerates away and settles on arrival.
  path(keys, u) {
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, a] = keys[i], [t1, b] = keys[i + 1];
      if (u <= t1 || i === keys.length - 2) {
        const e = G.Anim.easeInOutCubic(G.Anim.seg(u, t0, t1));
        return a.clone().lerp(b, e);
      }
    }
    return keys[keys.length - 1][1].clone();
  },

  poseParts(R, u, k, P, An) {
    const A = G.Anim, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const mag = P.mag;
    if (mag && mag.userData.home) {
      const home = mag.userData.home.pos;
      if (u < k.out) { mag.visible = true; mag.position.copy(home); }
      else if (u < k.drop) {
        // pulled (or, from a pistol grip, falling) straight out
        const e = A.easeInQuad(A.seg(u, k.out, k.drop));
        mag.visible = true; mag.position.copy(home).add(V(0, -0.17 * e, 0.05 * e));
      } else if (u < k.grab) {
        if (!R._dropped) { R._dropped = true; this.dropMag(mag); }
        mag.visible = false;
      } else if (u < k.in) {
        // the fresh one rides in the hand from the belt to the well
        mag.visible = true;
        const hand = R._leftCam || null;
        const e = A.easeInOutCubic(A.seg(u, k.in - 0.07, k.in));
        if (u < k.in - 0.07 && hand) {
          const inv = new THREE.Matrix4().copy(this.group.matrix).invert();
          const local = hand.clone().applyMatrix4(inv);
          mag.position.copy(local).add(home.clone().sub(An.magBottom));
        } else mag.position.copy(home).add(V(0, -0.15 * (1 - e), 0.02 * (1 - e)));
      } else { mag.visible = true; mag.position.copy(home); }
    }
    const bolt = P.bolt;
    if (bolt && bolt.userData.home && k.bolt) {
      const home = bolt.userData.home.pos;
      // back with the pull, and forward fast when it is let go
      const back = A.easeOutQuad(A.seg(u, k.bolt - 0.05, k.bolt)) * (1 - A.easeInQuad(A.seg(u, k.bolt, k.bolt + 0.03)));
      bolt.position.copy(home).add(V(0, 0, 0.08 * back));
      bolt.rotation.z = R.plan.style === "bolt" ? 0.9 * A.smooth(A.seg(u, k.bolt - 0.06, k.bolt - 0.03)) * (1 - A.smooth(A.seg(u, k.bolt + 0.04, k.bolt + 0.07))) : 0;
      if (u > k.bolt && !R._boltBump) { R._boltBump = true; this.S.bump.v += 1.4; }
    }
    const cover = P.cover;
    if (cover && cover.userData.home && k.cover) {
      const open = A.easeOutCubic(A.seg(u, k.cover - 0.06, k.cover)) * (1 - A.easeInCubic(A.seg(u, k.coverClose - 0.06, k.coverClose)));
      cover.rotation.x = -1.15 * open;
    }
  },

  shotgunPose(R, out) {
    const g = this.group, A = G.Anim, An = g.userData.anchors, P = g.userData.parts || {};
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const toCam = (v) => v.clone().applyMatrix4(g.matrix);
    const lead = this.SHELL.lead, tail = R.plan.tail || this.SHELL.tail;
    const t = R.t, dur = R.plan.dur, shellT = R.plan.shellT;
    // (overhaul, round 1) stopped early with a round chambered: back to the
    // ready from wherever the hand was, no rack
    const quit = R.stopT != null && !R.empty && R.endAt != null ? A.smooth(A.seg(t, R.stopT, R.endAt)) : 0;
    // roll the loading port toward the support hand for the whole routine
    const roll = A.smooth(A.seg(t, 0, lead)) * (1 - A.smooth(A.seg(t, dur - tail * 0.6, dur))) * (1 - quit);
    // muzzle well up and rolled, so the loading port underneath faces the eye
    out.gun.rz = -0.75 * roll; out.gun.rx = 0.62 * roll; out.gun.y = 0.06 * roll; out.gun.x = -0.15 * roll; out.gun.z = 0.1 * roll;
    const fore = toCam(An.fore), port = toCam(An.port), belt = this.BELT.clone();
    const below = port.clone().add(V(0, -0.08, 0.02));
    let left;
    if (t < lead) left = fore.clone().lerp(belt, A.easeInOutCubic(t / lead));
    else if (t < dur - tail) {
      // one shell: belt -> under the port -> push in -> back for the next
      const u = ((t - lead) / shellT) % 1;
      if (u < 0.35) left = belt.clone().lerp(below, A.easeInOutCubic(u / 0.35));
      else if (u < 0.55) left = below.clone().lerp(port, A.easeOutQuad((u - 0.35) / 0.2));
      else left = port.clone().lerp(belt, A.easeInOutCubic((u - 0.55) / 0.45));
      this._shellVisible = u < 0.5;
      if (u >= 0.5 && u < 0.56) this.S.bump.v += 0.05;
    } else if (R.plan.pump === false) {
      // (overhaul, round 1) a round still chambered: nothing to rack, the hand goes back
      this._shellVisible = false;
      left = belt.clone().lerp(fore, A.easeInOutCubic(A.seg(t, dur - tail, dur)));
    } else {
      // rack it: to the pump, pull back, push forward
      const u = (t - (dur - tail)) / tail;
      const pump = toCam(An.pump);
      this._shellVisible = false;
      if (u < 0.4) left = belt.clone().lerp(pump, A.easeInOutCubic(u / 0.4));
      else left = pump.clone();
      const back = A.easeOutQuad(A.seg(u, 0.4, 0.62)) * (1 - A.easeInOutCubic(A.seg(u, 0.66, 0.86)));
      if (P.pump && P.pump.userData.home) P.pump.position.copy(P.pump.userData.home.pos).add(V(0, 0, 0.09 * back));
      left.add(V(0, 0, 0.09 * back).applyQuaternion(g.quaternion));
      if (u > 0.62 && !R._pumped) { R._pumped = true; this.S.bump.v += 1.5; }
    }
    if (t >= lead && t < dur - tail) { /* shells are drawn by the hand */ } else this._shellVisible = false;
    if (quit > 0) { left = left.clone().lerp(fore, quit); if (quit > 0.5) this._shellVisible = false; }
    out.left = left;
    return out;
  },

  restoreParts() {
    const P = (this.group && this.group.userData.parts) || {};
    Object.values(P).forEach((p) => {
      if (!p.userData.home) return;
      p.position.copy(p.userData.home.pos); p.rotation.copy(p.userData.home.rot); p.visible = true;
    });
    this._shellVisible = false;
  },
  cancelReload() {
    // the blend-out in update() eases the hands and gun back; the parts snap
    // home at the end of it (the fresh magazine never went in)
    if (this.S) this.S.rlW = Math.min(this.S.rlW, 1);
  },

  // ================= dropped magazines =================
  // The spent magazine leaves the gun as a real object: it inherits where it
  // was, falls, bounces off the floor and lies there for a while.
  props: [],
  MAX_PROPS: 8,
  dropMag(mag) {
    const game = G.Game;
    if (!game || !game.scene || !mag) return;
    const q = G.save && G.save.settings.graphicsQuality;
    mag.updateMatrixWorld(true);
    const c = mag.clone(true);
    // (back on the world layer: once it leaves the hand it is part of the
    // world, and walls hide it again)
    // (its own copy, freed with it: the gun's skin is shared, the copy is not -- overhaul, round 2)
    c.traverse((o) => { o.layers.set(0); if (o.isMesh) { o.geometry = o.geometry.clone(); o.material = o.material.clone(); o.material.userData.shared = false; } });
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    mag.matrixWorld.decompose(pos, quat, scl);
    c.position.copy(pos); c.quaternion.copy(quat); c.scale.copy(scl);
    c.visible = true;
    game.scene.add(c);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(game.camera.getWorldQuaternion(new THREE.Quaternion()));
    const v = (this.S && this.S.prevVel) ? this.S.prevVel.clone() : new THREE.Vector3();
    v.addScaledVector(right, -0.4).add(new THREE.Vector3(0, -0.6, 0));
    this.props.push({ obj: c, v, w: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8),
      age: 0, rest: false, life: q === "vlow" || q === "low" ? 5 : 14 });
    while (this.props.length > this.MAX_PROPS) this.disposeProp(this.props.shift());
  },
  updateProps(dt, world) {
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i], o = p.obj;
      p.age += dt;
      if (!p.rest) {
        p.v.y -= 9.8 * dt;
        o.position.addScaledVector(p.v, dt);
        o.rotation.x += p.w.x * dt; o.rotation.y += p.w.y * dt; o.rotation.z += p.w.z * dt;
        const floor = world ? G.getFloorHeightAt(world, o.position.x, o.position.z, o.position.y) : 0;
        if (o.position.y < floor + 0.04) {
          o.position.y = floor + 0.04;
          if (Math.abs(p.v.y) > 0.8) {
            if (!p.landed) { p.landed = true; if (G.Audio.reloadEvent) G.Audio.reloadEvent("land"); }
            p.v.y = -p.v.y * 0.3; p.v.x *= 0.5; p.v.z *= 0.5; p.w.multiplyScalar(0.4);
          } else {
            // settle flat on its side
            p.rest = true; p.v.set(0, 0, 0);
            o.rotation.x = Math.round(o.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
            o.rotation.z = Math.round(o.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
          }
        }
      }
      if (p.age > p.life) {
        const f = 1 - Math.min(1, (p.age - p.life) / 0.6);
        o.scale.setScalar(Math.max(0.001, f));
        if (f <= 0) { this.disposeProp(p); this.props.splice(i, 1); }
      }
    }
  },
  disposeProp(p) {
    if (!p) return;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    G.disposeObject3D(p.obj);
  },
  clearProps() { this.props.forEach((p) => this.disposeProp(p)); this.props = []; },
};

// (overhaul, round 1) put away and shown again by the weapon state machine
if (G.Bus) G.Bus.on("weapon:visible", (e) => G.ViewModel.setVisible(e.on), "viewmodel");
// (gun reference pass) a shot: a bolt-action of the clips works its bolt after it
if (G.Bus) G.Bus.on("weapon:fire", (e) => G.ViewModel.onShot(e), "viewmodel");
