// ===================================================================
// Procedural animation kit (animation pass, part A)
// -------------------------------------------------------------------
// Shared by the player's arms and legs, the weapon viewmodel and the
// zombies. Nothing here knows about the game; it is the maths that keeps
// motion from looking mechanical:
//
//   ease*      acceleration and deceleration instead of constant-speed lerps
//   Spring     a mass on a damped spring -- the delay and settle that make a
//              chained part (shoulder -> arm -> gun) trail behind the part
//              that moved it, i.e. secondary motion / overlapping action
//   approach   frame-rate independent exponential blend, for state weights
//              (idle -> walk -> run) that should take ~0.2 s, not one frame
//   solveTwoBone  two-bone IK: where an elbow or knee has to be so that a
//              hand or foot lands exactly on its target
//   aimBone    turns a bone so it points from one joint to the next
// ===================================================================
G.Anim = {
  clamp01: (t) => (t < 0 ? 0 : t > 1 ? 1 : t),
  lerp: (a, b, t) => a + (b - a) * t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  // overshoots a little and settles: a hand slapping a magazine home
  easeOutBack: (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  smooth: (t) => t * t * (3 - 2 * t),

  // Position of t inside [a, b], clamped to 0..1 -- the local progress of one
  // segment of a keyframed sequence.
  seg(t, a, b) { return b <= a ? (t >= b ? 1 : 0) : G.Anim.clamp01((t - a) / (b - a)); },

  // Exponential approach that behaves the same at 30 or 144 fps. `time` is
  // how long the blend takes to get ~95% of the way.
  approach(cur, target, dt, time) {
    if (time <= 0) return target;
    return cur + (target - cur) * (1 - Math.exp(-3 * dt / time));
  },

  // Damped spring. `freq` is how fast it responds (Hz-ish), `damp` how much it
  // is allowed to overshoot (1 = no overshoot, 0.5 = a visible wobble).
  Spring: function (v) {
    this.x = v || 0; this.v = 0;
  },

  // Two-bone IK. root -> mid -> end with bone lengths la, lb; the joint bends
  // toward `pole`. Writes the middle joint (elbow/knee) into `out`, and
  // returns how far short the chain falls (0 when the target is reachable).
  solveTwoBone(root, target, la, lb, pole, out) {
    const v = G.Anim._v || (G.Anim._v = { d: new THREE.Vector3(), n: new THREE.Vector3() });
    const d = v.d.subVectors(target, root);
    let dist = d.length();
    const maxR = la + lb - 1e-4, minR = Math.abs(la - lb) + 1e-4;
    const short = Math.max(0, dist - maxR);
    dist = Math.min(maxR, Math.max(minR, dist));
    d.normalize();
    // angle at the root, from the law of cosines
    const cosA = (la * la + dist * dist - lb * lb) / (2 * la * dist);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    // the bend direction: the pole, with its component along the chain removed
    const n = v.n.subVectors(pole, root);
    n.addScaledVector(d, -n.dot(d));
    if (n.lengthSq() < 1e-8) n.set(0, -1, 0).addScaledVector(d, -d.y);
    n.normalize();
    out.copy(root).addScaledVector(d, la * cosA).addScaledVector(n, la * sinA);
    return short;
  },

  // Rotates `bone` (a Group whose geometry runs down its local -Y axis) so it
  // points from `from` to `to`, and stands it at `from`.
  _down: new THREE.Vector3(0, -1, 0),
  _dir: new THREE.Vector3(),
  aimBone(bone, from, to) {
    const dir = G.Anim._dir.subVectors(to, from);
    const len = dir.length();
    if (len < 1e-6) return;
    dir.multiplyScalar(1 / len);
    bone.position.copy(from);
    bone.quaternion.setFromUnitVectors(G.Anim._down, dir);
  },

  // A cheap smooth wobble made of three incommensurate sines: idle sway that
  // never visibly repeats.
  wobble(t, seed) {
    const s = seed || 0;
    return Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 2.1 + s * 1.7) * 0.3 + Math.sin(t * 3.7 + s * 2.3) * 0.2;
  },
};

G.Anim.Spring.prototype.step = function (target, dt, freq, damp) {
  // semi-implicit Euler on a damped harmonic oscillator; sub-stepped so a
  // stiff spring stays stable at low frame rates
  const w = 2 * Math.PI * freq, z = damp;
  const n = Math.max(1, Math.ceil(dt / 0.012));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = w * w * (target - this.x) - 2 * z * w * this.v;
    this.v += a * h;
    this.x += this.v * h;
  }
  return this.x;
};
G.Anim.Spring.prototype.reset = function (v) { this.x = v || 0; this.v = 0; };
