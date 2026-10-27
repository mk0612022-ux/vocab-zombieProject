// ===================================================================
// The reference guns' shapes (gun reference pass)
// -------------------------------------------------------------------
// One builder per prototype of js/gunref.js, the way the clips build theirs
// (docs/reference/guns/GUN_REFERENCE.md section 1): "HD-blocky" -- boxes,
// their top edges cut at 45 degrees with a light bevel running the length,
// wedges for the slanted faces, 40-90 parts a gun; two to four flat shades
// of each material (black is never one black); the sights glow (green or
// cyan) -- the one thing of every gun you see first.
//
// Everything is still boxes (tilted ones too), so js/gunskin.js dresses and
// merges a gun into one mesh as before, and the parts that move -- the
// magazine (the LMG's ammo box), the slide or bolt, the LMG's feed cover --
// are their own groups. Each builder leaves what the viewmodel needs: the
// anchors for the hands, the muzzle and the reload's parts, the reload's
// style and how far its magazine reaches.
//   G.GunModels.build(def) -> the group (null: not one of the prototypes)
// ===================================================================
window.G = window.G || {};

G.GunModels = (function () {
  const Q = Math.PI / 4;

  // ---------------- the kit ----------------
  function kit(def, I) {
    const g = new THREE.Group(), parts = {};
    const P = I.pal, mats = {};
    let into = null;
    // a material by colour and surface (shared within the gun)
    const mat = (hex, skin) => {
      const k = hex + ":" + (skin || "");
      let m = mats[k];
      if (!m) { m = G.makeBoxMat(hex); if (skin) m.userData.skin = skin; mats[k] = m; }
      return m;
    };
    const glow = (hex) => { const k = "glow:" + hex; return mats[k] || (mats[k] = new THREE.MeshBasicMaterial({ color: hex })); };
    const part = (name, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); parts[name] = p; return p; };
    const box = (w, h, d, x, y, z, m, rx, ry, rz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      const o = into ? into.position : null;
      b.position.set(x - (o ? o.x : 0), y - (o ? o.y : 0), z - (o ? o.z : 0));
      if (rx) b.rotation.x = rx;
      if (ry) b.rotation.y = ry;
      if (rz) b.rotation.z = rz;
      (into || g).add(b);
      return b;
    };
    // a box with its two long top edges cut at 45 degrees, a light bevel on each cut
    const cbox = (w, h, d, x, y, z, m, c, edge) => {
      c = Math.min(c || 0.006, w * 0.3, h * 0.45);
      box(w, h - c, d, x, y - c / 2, z, m);
      box(w - 2 * c, c, d, x, y + h / 2 - c / 2, z, m);
      const s = c * Math.SQRT2 + 0.001;
      [-1, 1].forEach((sx) => box(s, 0.0026, d, x + sx * (w / 2 - c / 2), y + h / 2 - c / 2, z, edge || m, 0, 0, -sx * Q));
    };
    // An octagon out of boxes: a cross of two bars and a square in the middle
    // -- a stepped octagon, blocky like everything else -- and, for a long
    // one (a barrel, a scope's tube), a bevel strip on each diagonal face
    const oct = (w, d, x, y, z, m, edge) => {
      box(w, w * 0.414, d, x, y, z, m);
      box(w * 0.414, w, d, x, y, z, m);
      box(w * 0.707, w * 0.707, d, x, y, z, m);
      const s = w * 0.414 + 0.001;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sy]) => box(s, 0.0024, d, x + sx * w * 0.354, y + sy * w * 0.354, z, sy > 0 ? (edge || m) : m, 0, 0, sx * sy > 0 ? -Q : Q));
    };
    // an octagonal ring facing the eye (along z): radius to the bar's middle, bar thickness, depth
    const ring8 = (r, t, d, x, y, z, m) => {
      const side = 2 * r * Math.tan(Math.PI / 8) + t * 0.55;
      for (let i = 0; i < 8; i++) { const a = i * Q; box(side, t, d, x + Math.sin(a) * r, y + Math.cos(a) * r, z, m, 0, 0, -a); }
    };
    // a filled octagon facing the eye (r: from its middle to a flat side)
    const disc8 = (r, d, x, y, z, m) => { box(2 * r, 0.828 * r, d, x, y, z, m); box(0.828 * r, 2 * r, d, x, y, z, m); box(1.414 * r, 1.414 * r, d, x, y, z, m); };
    // a voxel triangle (stepped) on a side face at x: apex up (dir 1) or down (-1)
    const tri = (base, height, steps, x, y, z, m, dir) => {
      const th = height / steps;
      for (let i = 0; i < steps; i++) { const w = base * (1 - i / steps); box(0.004, th, w, x, y + dir * (i * th + th / 2) - dir * height / 2, z, m); }
    };
    // a seeded pixel camo on a side face (the SMG's): squares of the darker shades
    const R = G.GunRef.seed(def.id + ":model");
    const camo = (x, y0, y1, z0, z1, n, cols) => {
      for (let i = 0; i < n; i++) {
        const s = 0.01 + R() * 0.012;
        const y = y0 + R() * (y1 - y0), z = z0 + R() * (z1 - z0);
        [-1, 1].forEach((sx) => box(0.002, s, s * (1 + R() * 0.8), sx * x, y, z, cols[i % cols.length]));
      }
    };
    return { g, parts, P, I, mat, glow, box, cbox, oct, ring8, disc8, tri, camo, R,
      get into() { return into; }, set into(v) { into = v; }, part };
  }
  // the six colour roles every gun uses (named after the palette's)
  function roles(K) {
    const P = K.P, m = K.mat;
    const paint = (role, skin) => (P.paint && P.paint.includes(role) ? "polymer" : skin);
    return {
      main: m(P.main, paint("main", "matte")), lit: m(P.lit, paint("lit", "worn")), dark: m(P.dark, paint("dark", "matte")), deep: m(P.deep, "matte"),
      alt: m(P.alt, "polymer"), altLit: m(P.altLit || P.alt, "polymer"), altMid: m(P.altMid || P.alt, "polymer"), altDark: m(P.altDark || P.dark, "polymer"),
      metal: m(P.metal, "bare"), edge: m(P.edge, "bare"), glint: m(P.glint || P.edge, "bare"),
      grip: m(P.dark, "grip"), accent: m(K.I.accent, "polymer"),
    };
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // How each is held in the hands, as the clips frame them:
  //   scale  the size in the hands (the clips' guns are big and near the eye)
  //   hip    a nudge to the carry [x, y, z] (the pistols low, just right of the middle)
  //   eye    how far the rear sight sits from the eye when aimed (m, at the
  //          ordinary aiming zoom; further when a scope's zoom is in) -- so the
  //          sight fills as much of the screen as the clip's: the LMG's block
  //          about half its height, the .50's window half of the upper half,
  //          a pistol a fifth
  const VIEW = {
    A: { scale: 1.3, hip: [-0.07, 0.05, 0.17], eye: 0.3 },
    B: { scale: 1.2, hip: [-0.06, 0.04, 0.15], eye: 0.4 },
    C: { scale: 1.3, hip: [-0.07, 0.05, 0.17], eye: 0.24 },
    D: { scale: 1.15, hip: [-0.1, -0.01, 0.08], eye: 0.5 },
    E: { scale: 1.15, hip: [-0.1, -0.01, 0.08], eye: 0.5 },
    F: { scale: 1.15, hip: [-0.06, 0.05, 0.14], eye: 0.42 },
    G: { scale: 1.2, hip: [-0.06, 0.05, 0.15], eye: 0.22 },
    H: { scale: 1.15, hip: [-0.06, 0.05, 0.15], eye: 0.1 },
    I: { scale: 1.15, hip: [-0.06, 0.05, 0.15], eye: 0.1 },
  };
  // finish: the anchors, the reload's style, the welding of near-touching parts
  function finish(K, o) {
    const g = K.g, VW = VIEW[K.I.proto];
    g.userData.anchors = Object.assign({ cover: V(0, 0.06, 0), port: V(0, -0.06, 0), pump: o.fore.clone() }, o.anchors, { fore: o.fore });
    g.userData.parts = K.parts;
    g.userData.archetype = o.archetype;
    g.userData.magKind = o.magKind;
    g.userData.magDepth = o.magDepth;
    g.userData.reloadStyle = o.reloadStyle;
    g.userData.proto = K.I.proto;
    // (js/viewmodel.js: the size in the hands, the carry's nudge, the aimed pose --
    // the sight's middle `y` up and `z` back from the gun's origin)
    g.userData.vmScale = VW.scale;
    g.userData.hipNudge = VW.hip;
    g.userData.aim = { y: o.sightY, z: o.sightZ, eye: VW.eye };
    G.weldGunParts(g);
    return g;
  }

  // ---------------- D: the polymer pistol ----------------
  function buildD(def, I) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    // the slide (it rides back when racked)
    K.into = K.part("bolt", 0, 0.035, 0.0);
    cbox(0.046, 0.055, 0.28, 0, 0.035, -0.02, S.main, 0.009, S.edge);
    box(0.024, 0.012, 0.075, 0.009, 0.064, -0.035, S.deep);                      // ejection port
    for (let i = 0; i < 6; i++) [-1, 1].forEach((sx) => box(0.002, 0.04, 0.006, sx * 0.0235, 0.03, 0.06 + i * 0.011, S.dark));   // rear serrations
    box(0.017, 0.017, 0.004, 0, 0.03, -0.161, S.deep);                           // the bore at the front face
    box(0.009, 0.012, 0.01, 0, 0.068, -0.145, S.deep);                           // front sight...
    box(0.006, 0.006, 0.002, 0, 0.07, -0.139, K.glow(I.glow.dot));               // ...its white dot
    box(0.042, 0.015, 0.012, 0, 0.07, 0.105, S.deep);                            // rear sight
    // the cyan "U" facing the eye
    const cy = K.glow(I.glow.cyan);
    box(0.005, 0.011, 0.002, -0.012, 0.072, 0.1115, cy); box(0.005, 0.011, 0.002, 0.012, 0.072, 0.1115, cy); box(0.029, 0.004, 0.002, 0, 0.0665, 0.1115, cy);
    K.into = null;
    // the frame, its light rails
    box(0.042, 0.03, 0.245, 0, -0.008, -0.01, S.alt);
    [-1, 1].forEach((sx) => box(0.003, 0.004, 0.225, sx * 0.0215, 0.007, -0.015, S.glint));
    box(0.032, 0.02, 0.05, 0, -0.012, -0.12, S.alt);                              // the dust cover under the muzzle
    // trigger and its squared guard
    box(0.03, 0.009, 0.065, 0, -0.047, -0.032, S.alt);
    box(0.03, 0.04, 0.009, 0, -0.03, -0.064, S.alt, 0.12);
    box(0.008, 0.026, 0.01, 0, -0.033, -0.014, S.metal);
    // the grip (raked back), its stipple, the magazine's base plate in the gun's colour
    box(0.044, 0.13, 0.064, 0, -0.088, 0.066, S.grip, -0.22);
    box(0.046, 0.016, 0.07, 0, -0.152, 0.083, S.alt, -0.22);
    K.into = K.part("mag", 0, -0.02, 0.06);
    box(0.034, 0.12, 0.05, 0, -0.085, 0.07, S.dark, -0.22);
    box(0.046, 0.012, 0.068, 0, -0.158, 0.086, S.accent, -0.22);
    K.into = null;
    return finish(K, {
      archetype: "pistol", magKind: "short", magDepth: 0.12, reloadStyle: "pistol", sightY: 0.07, sightZ: 0.11,
      fore: V(-0.02, -0.12, 0.06),
      anchors: { grip: V(0, -0.105, 0.072), magWell: V(0, -0.02, 0.06), magBottom: V(0, -0.15, 0.088), bolt: V(0, 0.035, 0.03), muzzle: V(0, 0.03, -0.17), port: V(0, 0.065, -0.035), cover: V(0, 0.07, 0) },
    });
  }

  // ---------------- E: the steel .45 ----------------
  function buildE(def, I) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    K.into = K.part("bolt", 0, 0.035, 0.0);
    cbox(0.04, 0.05, 0.3, 0, 0.035, -0.03, S.main, 0.007, S.edge);
    box(0.02, 0.003, 0.29, 0, 0.0615, -0.03, S.lit);                              // the polished top flat
    for (let i = 0; i < 9; i++) [-1, 1].forEach((sx) => box(0.002, 0.036, 0.005, sx * 0.0205, 0.033, 0.06 + i * 0.0085, S.deep));   // fine serrations
    box(0.02, 0.012, 0.05, 0.01, 0.06, -0.04, S.deep);                             // ejection port
    box(0.015, 0.015, 0.004, 0, 0.033, -0.181, S.deep);                            // bore
    box(0.004, 0.014, 0.014, 0, 0.068, -0.165, S.deep);                            // front blade...
    box(0.004, 0.004, 0.002, 0, 0.071, -0.157, K.glow(I.glow.tritium));            // ...a green dot
    box(0.036, 0.012, 0.012, 0, 0.066, 0.1, S.deep);                               // rear notch
    K.into = null;
    // frame, slide stop, hammer, beavertail
    box(0.036, 0.026, 0.25, 0, -0.008, -0.03, S.main);
    [-1, 1].forEach((sx) => box(0.003, 0.004, 0.23, sx * 0.0185, 0.004, -0.03, S.lit));
    box(0.006, 0.012, 0.03, -0.021, 0.0, 0.0, S.metal);                            // slide stop
    box(0.012, 0.02, 0.014, 0, 0.03, 0.124, S.metal, 0.5);                         // hammer, cocked
    box(0.03, 0.01, 0.045, 0, 0.005, 0.135, S.main, 0.25);                         // beavertail
    // trigger, guard
    box(0.028, 0.008, 0.055, 0, -0.042, -0.04, S.main);
    box(0.028, 0.03, 0.008, 0, -0.03, -0.068, S.main, 0.2);
    box(0.008, 0.02, 0.012, 0, -0.03, -0.024, S.metal);
    // the grip frame and its brown panels
    box(0.034, 0.13, 0.06, 0, -0.085, 0.065, S.main, -0.3);
    [-1, 1].forEach((sx) => box(0.004, 0.105, 0.05, sx * 0.019, -0.088, 0.066, S.alt, -0.3));
    [-1, 1].forEach((sx) => [0, 1].forEach((j) => box(0.0045, 0.008, 0.008, sx * 0.019, -0.055 - j * 0.06, 0.053 + j * 0.018, S.altLit, -0.3)));
    K.into = K.part("mag", 0, -0.02, 0.06);
    box(0.028, 0.12, 0.045, 0, -0.085, 0.07, S.dark, -0.3);
    box(0.036, 0.01, 0.06, 0, -0.152, 0.092, S.accent, -0.3);
    K.into = null;
    return finish(K, {
      archetype: "pistol", magKind: "short", magDepth: 0.12, reloadStyle: "pistol", sightY: 0.068, sightZ: 0.106,
      fore: V(-0.02, -0.12, 0.06),
      anchors: { grip: V(0, -0.105, 0.07), magWell: V(0, -0.02, 0.06), magBottom: V(0, -0.15, 0.09), bolt: V(0, 0.035, 0.03), muzzle: V(0, 0.033, -0.19), port: V(0, 0.06, -0.04), cover: V(0, 0.066, 0) },
    });
  }

  // ---------------- C: the two-tone SMG ----------------
  function buildC(def, I) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    const F = [S.alt, S.altMid, S.altDark];
    // the black upper, its long rail
    cbox(0.06, 0.06, 0.44, 0, 0.03, 0.0, S.main, 0.01, S.edge);
    box(0.036, 0.013, 0.42, 0, 0.066, 0.0, S.dark);
    for (let i = 0; i < 14; i++) box(0.04, 0.006, 0.012, 0, 0.0735, -0.195 + i * 0.03, S.deep);   // the rail's slots
    [-1, 1].forEach((sx) => [0, 1, 2].forEach((i) => K.disc8(0.009, 0.003, sx * 0.031, 0.025, -0.14 + i * 0.05, S.deep)));
    // the tall sand lower: the block under the front, the guard, the grip -- slanted faces
    box(0.058, 0.13, 0.2, 0, -0.065, -0.075, S.alt);
    box(0.058, 0.07, 0.07, 0, -0.1, -0.19, S.alt, -0.75);                          // the front, cut back
    box(0.054, 0.05, 0.16, 0, -0.022, 0.09, S.alt);
    box(0.05, 0.04, 0.03, 0, -0.07, 0.015, S.deep);                                 // the trigger's window
    box(0.008, 0.026, 0.01, 0, -0.068, 0.02, S.metal);
    box(0.044, 0.13, 0.058, 0, -0.1, 0.12, S.alt, -0.28);                           // grip
    K.camo(0.0295, -0.13, 0.0, -0.17, 0.02, 9, [S.altMid, S.altDark]);
    K.camo(0.028, -0.15, -0.06, 0.1, 0.15, 3, [S.altDark]);
    [-1, 1].forEach((sx) => box(0.002, 0.012, 0.012, sx * 0.0295, -0.03, 0.05, K.mat(I.pal.red || 0x8c2e32, "polymer")));   // the red mark
    box(0.012, 0.012, 0.02, 0.031, -0.03, 0.02, S.metal);                           // selector
    // the magazine, long, out of the front block
    K.into = K.part("mag", 0, -0.13, -0.12);
    box(0.034, 0.25, 0.06, 0, -0.24, -0.13, S.dark, 0.06);
    box(0.04, 0.014, 0.068, 0, -0.36, -0.122, S.accent, 0.06);
    K.into = null;
    // barrel and compensator
    K.oct(0.03, 0.08, 0, 0.032, -0.25, S.dark);
    box(0.036, 0.034, 0.05, 0, 0.032, -0.31, S.deep);
    [-1, 1].forEach((sx) => box(0.004, 0.02, 0.008, sx * 0.018, 0.04, -0.31, S.metal));
    // the folding front sight, its green dot
    box(0.03, 0.018, 0.02, 0, 0.08, -0.19, S.deep);
    box(0.008, 0.026, 0.008, 0, 0.098, -0.19, S.deep);
    box(0.006, 0.006, 0.003, 0, 0.11, -0.184, K.glow(I.glow.tritium));
    // the rear sight box, as the clip aims through it: a wide foot, two tall
    // posts round an octagon window, a tritium bar on each post's inner face
    box(0.072, 0.035, 0.036, 0, 0.086, 0.16, S.deep);
    [-1, 1].forEach((sx) => box(0.017, 0.062, 0.036, sx * 0.028, 0.124, 0.16, S.deep, 0, 0, -sx * 0.1));
    K.ring8(0.015, 0.006, 0.034, 0, 0.115, 0.16, S.deep);
    box(0.012, 0.0045, 0.003, -0.02, 0.115, 0.1785, K.glow(I.glow.tritium));
    box(0.012, 0.0045, 0.003, 0.02, 0.115, 0.1785, K.glow(I.glow.tritium));
    // charging handle (the "bolt"), on the left of the upper
    K.into = K.part("bolt", -0.035, 0.04, -0.06);
    box(0.016, 0.012, 0.022, -0.035, 0.04, -0.06, S.metal);
    K.into = null;
    // the folding stock
    [-1, 1].forEach((sx) => box(0.008, 0.012, 0.2, sx * 0.022, 0.02, 0.32, S.dark));
    box(0.05, 0.075, 0.02, 0, 0.0, 0.42, S.deep);
    return finish(K, {
      archetype: "smg", magKind: "long", magDepth: 0.26, reloadStyle: "rifle", sightY: 0.115, sightZ: 0.178,
      fore: V(0, -0.15, -0.1),
      anchors: { grip: V(0, -0.1, 0.12), magWell: V(0, -0.13, -0.12), magBottom: V(0, -0.37, -0.115), bolt: V(-0.035, 0.04, -0.06), muzzle: V(0, 0.032, -0.34), port: V(0, -0.1, -0.12), cover: V(0, 0.07, 0) },
    });
  }

  // ---------------- B: the long rifle, wood and steel ----------------
  function buildB(def, I) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    // the stamped receiver, rivets, the dust cover
    cbox(0.05, 0.07, 0.34, 0, 0.0, 0.02, S.main, 0.007, S.edge);
    [-1, 1].forEach((sx) => [0, 1, 2, 3].forEach((i) => box(0.003, 0.006, 0.006, sx * 0.0255, -0.018, -0.11 + i * 0.075, S.lit)));
    cbox(0.044, 0.024, 0.3, 0, 0.045, 0.035, S.metal, 0.008, S.lit);
    for (let i = 0; i < 4; i++) box(0.046, 0.004, 0.006, 0, 0.051, 0.17 - i * 0.012, S.deep);
    box(0.03, 0.024, 0.06, 0, 0.052, -0.135, S.main);                              // the rear sight block
    box(0.024, 0.006, 0.05, 0, 0.066, -0.132, S.lit);
    box(0.026, 0.008, 0.008, 0, 0.069, -0.108, S.deep);                             // its notch, on the line to the post
    // wood: the upper and lower handguards (grain in darker strips), the grip, the club-foot stock
    const W = [S.alt, S.altLit, S.altMid];
    box(0.04, 0.028, 0.2, 0, 0.042, -0.27, S.alt);
    box(0.056, 0.05, 0.2, 0, -0.008, -0.27, S.alt);
    for (let i = 0; i < 4; i++) [-1, 1].forEach((sx) => box(0.002, 0.004, 0.18 - i * 0.02, sx * 0.0285, -0.02 + i * 0.012, -0.27, W[1 + (i % 2)]));
    for (let i = 0; i < 3; i++) box(0.058, 0.006, 0.008, 0, -0.02, -0.33 + i * 0.05, S.altDark);
    box(0.036, 0.11, 0.05, 0, -0.085, 0.1, S.alt, -0.32);
    cbox(0.046, 0.06, 0.26, 0, -0.012, 0.32, S.alt, 0.008, S.altLit);
    box(0.044, 0.09, 0.1, 0, -0.055, 0.42, S.alt, 0.35);                            // the club foot
    box(0.048, 0.1, 0.014, 0, -0.04, 0.47, S.deep);                                 // butt plate
    [-1, 1].forEach((sx) => box(0.002, 0.004, 0.22, sx * 0.0235, -0.005, 0.32, S.altMid));
    // barrel, gas block, a tall front post (its tip green), the slant brake
    K.oct(0.024, 0.46, 0, 0.012, -0.6, S.dark, S.lit);
    box(0.032, 0.03, 0.03, 0, 0.03, -0.39, S.main);
    box(0.026, 0.028, 0.032, 0, 0.03, -0.79, S.main);
    box(0.008, 0.05, 0.008, 0, 0.05, -0.79, S.deep);
    box(0.012, 0.03, 0.006, 0, 0.042, -0.79, S.main);
    box(0.005, 0.005, 0.004, 0, 0.073, -0.786, K.glow(I.glow.post));
    box(0.028, 0.028, 0.045, 0, 0.012, -0.85, S.deep);
    box(0.03, 0.012, 0.02, 0, 0.026, -0.86, S.deep, 0.5);
    // the folded bipod under the barrel
    [-1, 1].forEach((sx) => box(0.008, 0.008, 0.2, sx * 0.012, -0.012, -0.58, S.deep));
    // trigger, guard, the selector on the right (the gun's colour on its tip)
    box(0.02, 0.006, 0.07, 0, -0.045, 0.045, S.metal);
    box(0.008, 0.022, 0.01, 0, -0.03, 0.04, S.metal);
    box(0.004, 0.012, 0.13, 0.027, 0.01, 0.04, S.metal);
    box(0.005, 0.014, 0.02, 0.028, 0.006, -0.03, S.accent);
    // the curved magazine
    K.into = K.part("mag", 0, -0.035, -0.04);
    for (let i = 0; i < 3; i++) box(0.03, 0.09, 0.065, 0, -0.075 - i * 0.075, -0.045 - i * 0.03, S.dark, 0.14 + i * 0.12);
    box(0.034, 0.012, 0.07, 0, -0.27, -0.13, S.accent, 0.4);
    K.into = null;
    // the charging handle on the right (the "bolt")
    K.into = K.part("bolt", 0.033, 0.018, -0.02);
    box(0.03, 0.012, 0.014, 0.033, 0.018, -0.02, S.metal);
    K.into = null;
    return finish(K, {
      archetype: "rifle", magKind: "curved", magDepth: 0.25, reloadStyle: "rifle", sightY: 0.073, sightZ: -0.105,
      fore: V(0, -0.04, -0.28),
      anchors: { grip: V(0, -0.08, 0.1), magWell: V(0, -0.035, -0.04), magBottom: V(0, -0.27, -0.13), bolt: V(0.033, 0.018, -0.02), muzzle: V(0, 0.012, -0.88), port: V(0, -0.05, -0.04), cover: V(0, 0.06, 0.03) },
    });
  }

  // ---------------- A: the belt-fed LMG ----------------
  function buildA(def, I) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    const brass = K.mat(I.pal.brass || 0xcebb75, "bare");
    // the receiver, its rail in sections
    cbox(0.07, 0.09, 0.36, 0, 0.0, 0.05, S.main, 0.009, S.edge);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) box(0.044, 0.008, 0.014, 0, 0.052, -0.09 + j * 0.1 + i * 0.022, S.dark);
    // the feed cover (hinged at the back), its light latch
    K.into = K.part("cover", 0, 0.058, 0.12);
    cbox(0.066, 0.026, 0.2, 0, 0.058, 0.0, S.main, 0.008, S.edge);
    box(0.02, 0.012, 0.02, 0, 0.074, 0.09, S.glint);
    K.into = null;
    box(0.024, 0.032, 0.06, -0.045, 0.02, -0.03, S.dark);                           // the feed tray, left
    // the rear sight, as the clip aims through it: a black block wider than
    // the gun with lit shoulders, a tower holding the green octagon and a slot
    // under it, two tall ears; to its right a tall post with a brass tip
    box(0.12, 0.058, 0.05, 0, 0.085, 0.19, S.deep);
    [-1, 1].forEach((sx) => box(0.03, 0.02, 0.052, sx * 0.046, 0.068, 0.19, S.lit));
    // (the tower round the window -- open through the middle, to see the front ring by)
    [-1, 1].forEach((sx) => box(0.014, 0.05, 0.046, sx * 0.021, 0.13, 0.19, S.deep));
    box(0.05, 0.012, 0.046, 0, 0.152, 0.19, S.deep);
    [-1, 1].forEach((sx) => box(0.017, 0.085, 0.036, sx * 0.048, 0.145, 0.19, S.deep, 0, 0, sx * 0.12));
    K.ring8(0.014, 0.0032, 0.004, 0, 0.132, 0.2125, K.glow(I.glow.ring));
    K.ring8(0.016, 0.005, 0.048, 0, 0.132, 0.19, S.deep);
    box(0.05, 0.007, 0.003, 0, 0.1, 0.2155, S.lit);
    box(0.016, 0.11, 0.02, 0.085, 0.15, 0.12, S.deep);
    box(0.018, 0.016, 0.022, 0.085, 0.212, 0.12, K.mat(I.pal.brass || 0xcebb75, "bare"));
    // the ammo box hanging under the left side, olive, its lid lit; the brass belt into the tray
    K.into = K.part("mag", -0.03, -0.045, -0.03);
    cbox(0.07, 0.11, 0.13, -0.03, -0.1, -0.03, S.alt, 0.01, S.altLit);
    box(0.072, 0.012, 0.012, -0.03, -0.065, -0.03, S.altMid);
    box(0.074, 0.02, 0.03, -0.03, -0.115, -0.03, S.accent);
    K.into = null;
    for (let i = 0; i < 7; i++) {
      const u = i / 6, y = -0.045 + u * 0.07, x = -0.06 + Math.sin(u * 2.4) * 0.012;
      box(0.012, 0.012, 0.034, x, y, -0.03 - Math.sin(u * 3) * 0.01, brass);
      box(0.014, 0.004, 0.01, x, y + 0.008, -0.04 - Math.sin(u * 3) * 0.01, S.deep);
    }
    // barrel with its heat shield, gas tube, a ringed front post, the flash hider
    K.oct(0.03, 0.5, 0, 0.0, -0.37, S.dark, S.lit);
    box(0.042, 0.008, 0.24, 0, 0.022, -0.27, S.main);
    for (let i = 0; i < 6; i++) box(0.03, 0.002, 0.016, 0, 0.0265, -0.37 + i * 0.04, S.deep);
    box(0.05, 0.04, 0.2, 0, -0.03, -0.24, S.main);
    box(0.012, 0.11, 0.012, 0, 0.072, -0.58, S.deep);
    K.ring8(0.014, 0.004, 0.006, 0, 0.132, -0.58, S.deep);
    box(0.004, 0.014, 0.004, 0, 0.126, -0.58, S.deep);
    box(0.036, 0.036, 0.05, 0, 0.0, -0.645, S.deep);
    [-1, 1].forEach((sx) => box(0.004, 0.03, 0.04, sx * 0.012, 0.0, -0.66, S.dark));
    // the bipod folded, the pistol grip, the stock
    [-1, 1].forEach((sx) => box(0.009, 0.009, 0.22, sx * 0.016, -0.05, -0.47, S.deep));
    box(0.022, 0.006, 0.07, 0, -0.06, 0.12, S.metal);
    box(0.008, 0.022, 0.01, 0, -0.05, 0.11, S.metal);
    box(0.042, 0.12, 0.056, 0, -0.1, 0.165, S.grip, -0.26);
    cbox(0.052, 0.085, 0.26, 0, -0.008, 0.36, S.main, 0.008, S.edge);
    box(0.056, 0.1, 0.016, 0, -0.008, 0.495, S.deep);
    // charging handle on the right
    K.into = K.part("bolt", 0.044, 0.0, -0.05);
    box(0.024, 0.016, 0.022, 0.044, 0.0, -0.05, S.metal);
    K.into = null;
    return finish(K, {
      archetype: "lmg", magKind: "drum", magDepth: 0.13, reloadStyle: "belt", sightY: 0.132, sightZ: 0.2125,
      fore: V(0, -0.06, -0.24),
      anchors: { grip: V(0, -0.09, 0.165), magWell: V(-0.03, -0.045, -0.03), magBottom: V(-0.03, -0.16, -0.03), bolt: V(0.044, 0.0, -0.05), muzzle: V(0, 0.0, -0.67), port: V(0, -0.06, 0.0), cover: V(0, 0.075, 0.05) },
    });
  }

  // ---------------- F: the silver .50 anti-materiel rifle (a bullpup) ----------------
  function buildF(def, I) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    const silver = S.main, mid = K.mat(I.pal.mid || I.pal.dark, "worn"), cut = S.alt;
    // the long flat-sided body and its row of triangular cut-outs
    cbox(0.062, 0.12, 0.58, 0, -0.01, 0.12, silver, 0.012, S.glint);
    box(0.064, 0.03, 0.56, 0, -0.065, 0.12, mid);
    for (let i = 0; i < 7; i++) [-1, 1].forEach((sx) => K.tri(0.06, 0.05, 4, sx * 0.032, 0.005, -0.12 + i * 0.075, cut, i % 2 ? -1 : 1));
    // the long black rail, ribbed
    box(0.036, 0.02, 0.62, 0, 0.06, 0.08, cut);
    for (let i = 0; i < 18; i++) box(0.04, 0.008, 0.012, 0, 0.068, -0.2 + i * 0.034, S.dark);
    // the heavy barrel and the block brake with its slots
    K.oct(0.034, 0.5, 0, 0.0, -0.42, S.dark, S.lit);
    box(0.066, 0.056, 0.09, 0, 0.0, -0.71, S.dark);
    for (let i = 0; i < 3; i++) [-1, 1].forEach((sx) => box(0.004, 0.04, 0.012, sx * 0.034, 0.0, -0.685 - i * 0.022, S.deep));
    box(0.03, 0.03, 0.006, 0, 0.0, -0.757, S.deep);
    // the tall rear frame, its cyan chevron; a post out front
    // (the clip's: aimed, a window about as tall as wide over the chevron;
    // the frame's foot, below it, is hidden by the block it stands on)
    const fr = cut, cy = K.glow(I.glow.cyan);
    [-1, 1].forEach((sx) => { box(0.013, 0.13, 0.016, sx * 0.037, 0.135, 0.05, fr); box(0.018, 0.022, 0.04, sx * 0.04, 0.078, 0.05, fr); });
    box(0.087, 0.014, 0.016, 0, 0.193, 0.05, fr);
    box(0.087, 0.026, 0.03, 0, 0.083, 0.05, fr);
    box(0.004, 0.02, 0.003, -0.012, 0.115, 0.059, cy, 0, 0, 0.45); box(0.004, 0.02, 0.003, 0.012, 0.115, 0.059, cy, 0, 0, -0.45); box(0.016, 0.004, 0.003, 0, 0.105, 0.059, cy);
    box(0.012, 0.09, 0.012, 0, 0.065, -0.62, S.deep);
    box(0.004, 0.012, 0.004, 0, 0.112, -0.62, K.glow(I.glow.post));
    // the forward pistol grip and trigger, the magazine behind them (a bullpup), the butt
    box(0.044, 0.12, 0.06, 0, -0.13, -0.03, S.grip, -0.22);
    box(0.024, 0.006, 0.08, 0, -0.075, -0.08, S.metal);
    box(0.008, 0.022, 0.01, 0, -0.085, -0.075, S.metal);
    K.into = K.part("mag", 0, -0.07, 0.16);
    box(0.046, 0.1, 0.09, 0, -0.12, 0.16, cut);
    box(0.05, 0.012, 0.094, 0, -0.17, 0.16, S.accent);
    K.into = null;
    box(0.066, 0.15, 0.04, 0, -0.05, 0.43, cut);                                   // the butt (below the aimed view)
    cbox(0.05, 0.03, 0.18, 0, 0.045, 0.3, silver, 0.008, S.glint);               // the cheek rest (under the rail's line)
    // the folded bipod
    [-1, 1].forEach((sx) => box(0.012, 0.012, 0.26, sx * 0.02, -0.03, -0.42, S.deep));
    box(0.05, 0.02, 0.03, 0, -0.025, -0.3, S.dark);
    // the bolt handle, at the back right
    K.into = K.part("bolt", 0.045, -0.02, 0.27);
    box(0.06, 0.016, 0.016, 0.06, -0.02, 0.27, S.metal);
    box(0.026, 0.026, 0.026, 0.092, -0.02, 0.27, cut, 0, 0, Q);
    K.into = null;
    return finish(K, {
      archetype: "sniper", magKind: "short", magDepth: 0.12, reloadStyle: "bolt", sightY: 0.112, sightZ: 0.06,
      fore: V(0, -0.06, -0.3),
      anchors: { grip: V(0, -0.12, -0.03), magWell: V(0, -0.07, 0.16), magBottom: V(0, -0.18, 0.16), bolt: V(0.06, -0.02, 0.27), muzzle: V(0, 0.0, -0.77), port: V(0, -0.07, 0.16), cover: V(0, 0.07, 0.1) },
    });
  }

  // ---------------- G: the black chassis sniper (an octagon peep) ----------------
  // H and I share its frame: a scope instead of the peep, other colours
  function buildSniper(def, I, kind) {
    const K = kit(def, I), S = roles(K), { box, cbox } = K;
    const white = kind === "H", lens = kind === "I";
    // the chassis: lit facets on the black, the side panels
    cbox(0.062, 0.09, 0.46, 0, -0.01, 0.08, S.main, 0.011, S.edge);
    [-1, 1].forEach((sx) => box(0.003, 0.05, 0.4, sx * 0.0315, -0.012, 0.08, white ? S.alt : S.lit));
    if (white) {
      // the white body's black saw-tooth along each side
      for (let i = 0; i < 9; i++) [-1, 1].forEach((sx) => box(0.004, 0.022, 0.022, sx * 0.032, -0.05, -0.1 + i * 0.045, S.alt, Q, 0, 0));
    }
    box(0.03, 0.016, 0.42, 0, 0.044, 0.06, S.deep);
    for (let i = 0; i < 12; i++) box(0.034, 0.006, 0.01, 0, 0.051, -0.13 + i * 0.034, S.dark);
    // a long slender barrel, a small brake
    K.oct(0.024, 0.6, 0, 0.02, -0.47, S.dark, S.lit);
    box(0.034, 0.03, 0.05, 0, 0.02, -0.79, S.deep);
    // the magazine, short, under the chassis
    K.into = K.part("mag", 0, -0.055, 0.04);
    box(0.04, 0.075, 0.085, 0, -0.09, 0.04, S.deep);
    box(0.044, 0.01, 0.09, 0, -0.13, 0.04, S.accent);
    K.into = null;
    // the grip, the trigger, the stock with its cheek riser
    box(0.044, 0.12, 0.058, 0, -0.1, 0.2, S.grip, -0.3);
    box(0.022, 0.006, 0.07, 0, -0.06, 0.15, S.metal);
    box(0.008, 0.022, 0.01, 0, -0.05, 0.145, S.metal);
    cbox(0.054, 0.1, 0.28, 0, -0.02, 0.44, white ? S.main : S.dark, 0.01, S.edge);
    box(0.05, 0.03, 0.18, 0, 0.045, 0.42, S.deep);
    box(0.058, 0.115, 0.016, 0, -0.02, 0.585, S.deep);
    // the folded bipod
    [-1, 1].forEach((sx) => box(0.009, 0.009, 0.22, sx * 0.016, -0.04, -0.28, S.deep));
    // the bolt handle (big, a diamond knob)
    K.into = K.part("bolt", 0.045, 0.025, 0.16);
    box(0.07, 0.018, 0.018, 0.065, 0.025, 0.16, S.metal);
    box(0.034, 0.034, 0.034, 0.1, 0.025, 0.16, K.mat(I.pal.knob || I.pal.deep, "matte"), 0, 0, Q);
    K.into = null;
    let sightY;
    if (kind === "G") {
      // the octagon peep: a big box, wings either side; a green front post far out
      box(0.086, 0.058, 0.05, 0, 0.078, 0.17, S.deep);
      [-1, 1].forEach((sx) => box(0.021, 0.088, 0.05, sx * 0.053, 0.096, 0.17, S.main, 0, 0, sx * 0.08));
      K.ring8(0.021, 0.008, 0.054, 0, 0.116, 0.17, S.deep);
      box(0.03, 0.022, 0.03, 0, 0.032, -0.74, S.main);
      box(0.006, 0.075, 0.006, 0, 0.078, -0.74, S.deep);
      box(0.005, 0.01, 0.004, 0, 0.112, -0.737, K.glow(I.glow.post));
      sightY = 0.116;
    } else {
      // the scope: an octagonal tube, a flared objective, turrets, two mounts
      const sc = K.mat(I.pal.scope || I.pal.deep, "matte"), scL = K.mat(I.pal.scopeLit || I.pal.lit, "worn");
      const y = 0.115;
      K.oct(0.048, 0.36, 0, y, 0.02, sc, scL);
      K.oct(0.074, 0.08, 0, y, -0.2, sc, scL);
      K.oct(0.058, 0.07, 0, y, 0.22, sc, scL);
      box(0.026, 0.024, 0.026, 0, y + 0.034, 0.02, sc);
      box(0.024, 0.026, 0.026, 0.034, y, 0.02, sc);
      [-0.08, 0.1].forEach((z) => { box(0.03, 0.05, 0.02, 0, 0.075, z, S.deep); box(0.056, 0.012, 0.024, 0, 0.09, z, S.deep); });
      if (lens) {
        // the faceted blue lens, an amber square on the turret
        const L1 = K.mat(I.pal.lens, "bare"), L2 = K.mat(I.pal.lensLit, "bare");
        K.disc8(0.03, 0.004, 0, y, -0.241, L1);
        [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], i) => box(0.018, 0.018, 0.004, sx * 0.012, y + sy * 0.012, -0.244, i % 2 ? L2 : L1, 0, 0, Q));
        box(0.01, 0.01, 0.004, -0.008, y + 0.012, -0.246, K.glow(0x9fb6d8));
        box(0.012, 0.012, 0.004, 0.0, y + 0.034, 0.034, K.glow(I.glow.amber));
      } else {
        // the lens, dark; its cap swung open to the side
        K.disc8(0.03, 0.004, 0, y, -0.241, K.mat(0x1c2430, "bare"));
        box(0.008, 0.008, 0.004, -0.01, y + 0.012, -0.244, K.glow(0x8fa6c4));
        K.disc8(0.032, 0.006, -0.052, y - 0.01, -0.236, S.deep);
        box(0.02, 0.008, 0.008, -0.034, y - 0.01, -0.238, S.deep);
      }
      sightY = y;
    }
    return finish(K, {
      archetype: "sniper", magKind: "short", magDepth: 0.12, reloadStyle: "bolt", sightY, sightZ: kind === "G" ? 0.2 : 0.26,
      fore: V(0, -0.05, -0.2),
      anchors: { grip: V(0, -0.095, 0.2), magWell: V(0, -0.055, 0.04), magBottom: V(0, -0.135, 0.04), bolt: V(0.065, 0.025, 0.16), muzzle: V(0, 0.02, -0.82), port: V(0, -0.06, 0.04), cover: V(0, 0.06, 0.1) },
    });
  }

  function build(def) {
    const I = G.GunRef && G.GunRef.info(def);
    if (!I) return null;
    switch (I.proto) {
      case "A": return buildA(def, I);
      case "B": return buildB(def, I);
      case "C": return buildC(def, I);
      case "D": return buildD(def, I);
      case "E": return buildE(def, I);
      case "F": return buildF(def, I);
      case "G": case "H": case "I": return buildSniper(def, I, I.proto);
    }
    return null;
  }
  return { build };
})();
