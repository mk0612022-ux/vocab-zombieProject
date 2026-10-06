// ===================================================================
// The ten bosses' bodies (round 2, G4)
// -------------------------------------------------------------------
// Each boss is three to four times a zombie's height and built from its own
// shapes -- no two share a silhouette or a face:
//
//   gravedigger  Mortimer Grave     hunched, coat and hat, a shovel, a lantern,
//                                   one green eye, the other sewn shut
//   eye          Iris Glare         one giant floating eye with lids, a torn
//                                   robe, tendrils and a ring of small eyes
//   headmaster   Headmaster Bellow  gown and mortarboard, red spectacles, a
//                                   huge jaw that drops open, a cane
//   matron       Matron Mildred     tall thin nurse, needle fingers, a glowing
//                                   sac on her belly where the minions grow
//   coach        Coach Brutus       horned helmet, shoulder pads, jersey 13,
//                                   arms like tree trunks
//   thorn        Hedge Thornwood    a walking tree: root feet, branch arms,
//                                   a thorn crown and an amber heart
//   storm        Crackwell          copper coils, tesla rods, a glass dome
//                                   with a crackling core, live arcs
//   chemist      Professor Vitriol  gas mask with green lenses, acid tank on
//                                   his back, a sprayer for an arm
//   void         Warden Vex    a floating hood with nothing inside but
//                                   two eyes and a ring of purple light
//   examiner     Examiner Quill       a tall suit whose head is an exam paper
//                                   marked F, a giant red pen, a clipboard
//
// Every body is a set of joints (hips, torso, head, arms, legs and a few
// extras) that js/bosses.js poses. Once built, each joint's parts are baked
// into one or two meshes (G.Perf.mergeLocalColored), so a boss costs twenty
// or so draw calls instead of two hundred -- it has to hold a phone's frame
// rate on an open football field. Parts that glow and pulse, see-through
// parts and printed ones (the jersey number, the exam paper) stay separate.
//
// Hitboxes are invisible boxes and spheres on the joints (userData.bossHit):
// shots are tested against those, not the detailed model. One of them is
// the weak spot, which takes half as much damage again.
//
// G.BossModels.portrait() renders a body for the Boss Codex -- in colour, or
// as a dark silhouette for a boss not met yet.
// ===================================================================
(function () {
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const bas = (c) => new THREE.MeshBasicMaterial({ color: c });
  const HITMAT = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  function mk(parent, geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }
  const box = (p, w, h, d, mat, x, y, z, rx, ry, rz) => mk(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
  // (sx alone scales evenly; sx, sy, sz stretch)
  const sph = (p, r, mat, x, y, z, sx, sy, sz, seg) => {
    const s = seg || 14;
    const m = mk(p, new THREE.SphereGeometry(r, s, Math.max(6, Math.round(s * 0.7))), mat, x, y, z);
    const a = sx || 1;
    m.scale.set(a, sy || a, sz || a);
    return m;
  };
  const cyl = (p, rt, rb, h, mat, x, y, z, rx, ry, rz, seg) => mk(p, new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat, x, y, z, rx, ry, rz);
  const cone = (p, r, h, mat, x, y, z, rx, ry, rz, seg) => mk(p, new THREE.ConeGeometry(r, h, seg || 10), mat, x, y, z, rx, ry, rz);
  const tor = (p, r, t, mat, x, y, z, rx, ry, rz, seg) => mk(p, new THREE.TorusGeometry(r, t, 8, seg || 22), mat, x, y, z, rx, ry, rz);
  const dot = (p, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); p.add(o); return o; };

  function newRig(id) {
    const root = new THREE.Group();
    root.name = "boss-" + id;
    return { id, root, joints: [], keep: [], hitboxes: [], H: 5, R: 1.2, hipY: 2, float: 0, rest: {}, idle: null };
  }
  // a joint js/bosses.js can turn: its own parts are baked together
  function J(rig, parent, name, x, y, z) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x || 0, y || 0, z || 0);
    parent.add(g);
    rig.joints.push(g);
    rig[name] = g;
    return g;
  }
  // something that must stay a mesh of its own (it glows, pulses, is seen
  // through, or is printed)
  const keep = (rig, m) => { rig.keep.push(m); return m; };
  function hit(rig, parent, shape, a, b, c, x, y, z, weak) {
    const geo = shape === "box" ? new THREE.BoxGeometry(a, b, c) : new THREE.SphereGeometry(a, 10, 8);
    const m = new THREE.Mesh(geo, HITMAT);
    m.position.set(x, y, z);
    m.visible = false;
    m.userData.bossHit = { weak: !!weak };
    parent.add(m);
    rig.hitboxes.push(m);
    return m;
  }
  function bake(rig) {
    const SH = { lambert: new THREE.MeshLambertMaterial({ vertexColors: true }), basic: new THREE.MeshBasicMaterial({ vertexColors: true }) };
    rig.shared = SH;
    const hold = new Set(rig.keep.concat(rig.hitboxes).concat(rig.joints));
    [rig.root].concat(rig.joints).forEach((j) => {
      const skip = j.children.filter((c) => hold.has(c) || !c.isMesh);
      G.Perf.mergeLocalColored(j, skip, SH);
    });
    rig.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const m = o.material;
      o.castShadow = !(m && (m.transparent || m.isMeshBasicMaterial));
    });
    return rig;
  }

  // canvas textures: the coach's number and the examiner's paper face
  function canvasTex(w, h, draw) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 2;
    return t;
  }
  function jerseyTex() {
    return canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = "#8a2020"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let i = 0; i < 9; i++) g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 4 + Math.random() * 8);
      g.font = "bold 86px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 8; g.strokeStyle = "#2a0a0a"; g.strokeText("13", 64, 70);
      g.fillStyle = "#ece6d4"; g.fillText("13", 64, 70);
    });
  }
  function examTex() {
    return canvasTex(128, 168, (g, w, h) => {
      g.fillStyle = "#efe9da"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#9fb4c8"; g.lineWidth = 1;
      for (let y = 30; y < h; y += 11) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
      g.strokeStyle = "#c86a6a"; g.beginPath(); g.moveTo(20, 0); g.lineTo(20, h); g.stroke();
      g.fillStyle = "#3a3a44";
      for (let y = 38; y < h - 10; y += 11) { if (Math.random() < 0.3) continue; g.fillRect(26, y - 6, 20 + Math.random() * 70, 3); }
      g.strokeStyle = "#c01818"; g.lineWidth = 4;
      g.beginPath(); g.arc(94, 140, 22, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#c01818"; g.font = "bold 34px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("F", 94, 142);
      for (let i = 0; i < 4; i++) { const y = 50 + i * 22; g.beginPath(); g.moveTo(28, y); g.lineTo(90, y - 6); g.stroke(); }
    });
  }

  const B = {};

  // ---- Mortimer Grave ------------------------------------------------------
  B.gravedigger = function () {
    const r = newRig("gravedigger");
    const coat = lam(0x2e2b26), coatD = lam(0x201e1b), skin = lam(0x7f8c6c), skinD = lam(0x5a6649), boot = lam(0x17140f),
      hatM = lam(0x1a1816), wood = lam(0x5a4128), steel = lam(0x6d7074), rust = lam(0x7a4a2e), dirt = lam(0x3d3226),
      tooth = lam(0xcfc6a0), shirt = lam(0x4a4034), eyeG = bas(0x9dff6a), dark = bas(0x0b0a08);
    r.hipY = 2.4;
    const hips = J(r, r.root, "hips", 0, 2.4, 0);
    box(hips, 1.5, 0.5, 0.9, coatD, 0, 0, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.45, -0.1, 0);
      box(leg, 0.55, 1.3, 0.6, coatD, 0, -0.65, 0);
      cyl(leg, 0.24, 0.2, 1.0, shirt, 0, -1.7, 0);
      box(leg, 0.62, 0.34, 1.0, boot, 0, -2.13, 0.16);
      box(leg, 0.64, 0.1, 1.04, dirt, 0, -2.26, 0.16);
    });
    const torso = J(r, hips, "torso", 0, 0.2, 0);
    cyl(torso, 0.95, 1.15, 2.1, coat, 0, 1.05, 0);
    box(torso, 2.1, 1.5, 0.16, coatD, 0, -0.35, -0.7, 0.15, 0, 0);
    box(torso, 0.9, 1.3, 0.14, coatD, -0.5, -0.3, 0.78, -0.12, 0, 0.08);
    box(torso, 0.9, 1.3, 0.14, coatD, 0.5, -0.3, 0.78, -0.12, 0, -0.08);
    box(torso, 2.5, 0.55, 1.2, coat, 0, 2.05, 0);
    sph(torso, 0.75, coat, 0, 2.15, -0.45, 1.2, 0.8, 0.9);
    for (let i = 0; i < 4; i++) box(torso, 0.12, 0.12, 0.08, rust, 0, 0.5 + i * 0.4, 1.0);
    box(torso, 0.6, 0.4, 0.1, dirt, -0.45, 0.4, 1.0, 0, 0, 0.3);
    cyl(torso, 0.28, 0.34, 0.5, skinD, 0, 2.45, 0.2);
    const head = J(r, torso, "head", 0, 2.75, 0.35);
    sph(head, 0.62, skin, 0, 0.1, 0, 0.9, 1.15, 0.95);
    box(head, 0.9, 0.14, 0.3, skinD, 0, 0.32, 0.42);
    sph(head, 0.12, eyeG, 0.22, 0.15, 0.5);
    box(head, 0.28, 0.05, 0.05, dark, -0.22, 0.15, 0.55, 0, 0, 0.7);
    box(head, 0.28, 0.05, 0.05, dark, -0.22, 0.15, 0.55, 0, 0, -0.7);
    box(head, 0.12, 0.16, 0.08, dark, 0, -0.02, 0.56);
    box(head, 0.5, 0.07, 0.05, dark, 0, -0.3, 0.52);
    for (let i = 0; i < 5; i++) box(head, 0.03, 0.2, 0.03, tooth, -0.2 + i * 0.1, -0.3, 0.55);
    cyl(head, 1.05, 1.1, 0.07, hatM, 0, 0.62, 0, 0.1, 0, -0.08, 18);
    cyl(head, 0.6, 0.66, 0.8, hatM, 0, 1.0, 0, 0.1, 0, -0.08, 14);
    cyl(head, 0.665, 0.67, 0.14, rust, 0, 0.72, 0, 0.1, 0, -0.08, 14);
    r.eye = dot(head, 0.22, 0.15, 0.6);
    const armR = J(r, torso, "armR", 1.3, 1.95, 0);
    sph(armR, 0.4, coat, 0, 0, 0);
    cyl(armR, 0.3, 0.25, 1.4, coat, 0, -0.75, 0);
    cyl(armR, 0.2, 0.18, 1.2, skin, 0, -1.9, 0.05);
    sph(armR, 0.26, skin, 0, -2.55, 0.1);
    cyl(armR, 0.07, 0.07, 3.0, wood, 0, -2.3, 0.3);
    box(armR, 0.5, 0.1, 0.1, wood, 0, -0.85, 0.3);
    box(armR, 0.8, 0.95, 0.07, rust, 0, -4.1, 0.3);
    box(armR, 0.82, 0.1, 0.1, steel, 0, -3.62, 0.3);
    r.hand = dot(armR, 0, -2.55, 0.2);
    const armL = J(r, torso, "armL", -1.3, 1.95, 0);
    sph(armL, 0.4, coat, 0, 0, 0);
    cyl(armL, 0.3, 0.25, 1.4, coat, 0, -0.75, 0);
    cyl(armL, 0.2, 0.18, 1.2, skin, 0, -1.9, 0.05);
    sph(armL, 0.26, skin, 0, -2.55, 0.1);
    cyl(armL, 0.02, 0.02, 0.5, steel, 0, -2.85, 0.1);
    box(armL, 0.46, 0.06, 0.46, hatM, 0, -3.05, 0.1);
    box(armL, 0.46, 0.06, 0.46, hatM, 0, -3.55, 0.1);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(armL, 0.05, 0.5, 0.05, hatM, a * 0.2, -3.3, 0.1 + b * 0.2));
    const lampMat = bas(0xffc36a);
    keep(r, sph(armL, 0.17, lampMat, 0, -3.3, 0.1));
    r.idle = (b, t) => { lampMat.color.setHex(0xffc36a).multiplyScalar(0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.1)); };
    hit(r, torso, "box", 2.3, 2.6, 1.8, 0, 1.0, 0);
    hit(r, head, "sph", 0.72, 0, 0, 0, 0.1, 0, true);
    hit(r, hips, "box", 1.5, 2.4, 1.0, 0, -1.2, 0);
    r.H = 5.9; r.R = 1.3;
    r.rest = { torso: 0.3, head: -0.25, armL: [-0.15, 0.12], armR: [-0.25, -0.1] };
    r.weakName = "head";
    return bake(r);
  };

  // ---- Iris Glare --------------------------------------------------------------
  B.eye = function () {
    const r = newRig("eye");
    const sclera = lam(0xe8e0d0), lidM = lam(0x6a3a44), lidD = lam(0x4a2530), robe = lam(0x3a2a44), robeD = lam(0x2a1e33),
      tent = lam(0x5a2f3f), tentD = lam(0x40202c), pupil = bas(0x050505), ring = lam(0x7a1a10), shine = bas(0xffffff), small = bas(0xff6a2a);
    r.float = 2.4; r.hipY = 3.3;
    const hips = J(r, r.root, "hips", 0, 3.3, 0);
    const torso = J(r, hips, "torso", 0, 0, 0);
    cyl(torso, 0.7, 1.2, 2.4, robe, 0, -0.9, 0, 0, 0, 0, 10);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      box(torso, 0.5, 0.7 + (i % 3) * 0.25, 0.08, robeD, Math.sin(a) * 1.15, -2.2 - (i % 3) * 0.12, Math.cos(a) * 1.15, 0, a, 0);
    }
    const head = J(r, torso, "head", 0, 1.3, 0);
    sph(head, 1.35, sclera, 0, 0, 0, 1, 1, 1, 20);
    const irisMat = bas(0xffb028);
    keep(r, cyl(head, 0.62, 0.62, 0.1, irisMat, 0, 0, 1.3, Math.PI / 2, 0, 0, 24));
    cyl(head, 0.3, 0.3, 0.12, pupil, 0, 0, 1.34, Math.PI / 2, 0, 0, 18);
    tor(head, 0.64, 0.05, ring, 0, 0, 1.28, 0, 0, 0, 24);
    sph(head, 0.09, shine, 0.24, 0.26, 1.44);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.3;
      box(head, 0.05, 0.55, 0.03, ring, Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0.93, 0, 0, a + Math.PI / 2);
    }
    const lidGeo = () => new THREE.SphereGeometry(1.46, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const lidT = J(r, head, "lidT", 0, 0, 0); mk(lidT, lidGeo(), lidM, 0, 0, 0);
    const lidB = J(r, head, "lidB", 0, 0, 0); mk(lidB, lidGeo(), lidD, 0, 0, 0, Math.PI, 0, 0);
    r.lidOpen = (k) => { lidT.rotation.x = -0.35 - k * 0.55; lidB.rotation.x = 0.35 + k * 0.5; };
    r.lidOpen(1);
    const halo = J(r, torso, "halo", 0, 1.3, -0.7);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      sph(halo, 0.22, sclera, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0);
      cyl(halo, 0.1, 0.1, 0.05, small, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.2, Math.PI / 2, 0, 0, 10);
    }
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 0.9, -0.4, 0.3);
      cyl(arm, 0.2, 0.12, 1.6, tent, 0, -0.8, 0);
      cyl(arm, 0.12, 0.05, 1.4, tentD, 0, -2.2, 0.1);
      cone(arm, 0.09, 0.45, tentD, 0, -3.0, 0.15, Math.PI, 0, 0);
    });
    const tails = J(r, torso, "tails", 0, -0.8, -0.3);
    for (let i = 0; i < 4; i++) {
      const x = -0.75 + i * 0.5;
      cyl(tails, 0.14, 0.04, 2.4, i % 2 ? tent : tentD, x, -1.3, -0.1 * i, 0.15, 0, (i - 1.5) * 0.12);
    }
    r.eye = dot(head, 0, 0, 1.45);
    r.hand = dot(r.armR, 0, -2.6, 0.1);
    r.idle = (b, t) => {
      halo.rotation.z = t * 0.35;
      tails.children.forEach((c, i) => { c.rotation.z = (i - 1.5) * 0.12 + Math.sin(t * 1.7 + i) * 0.15; });
      irisMat.color.setHex(0xffb028).multiplyScalar(0.85 + 0.15 * Math.sin(t * 4));
    };
    r.irisMat = irisMat;
    hit(r, head, "sph", 1.4, 0, 0, 0, 0, 0);
    hit(r, head, "sph", 0.55, 0, 0, 0, 0, 1.2, true);
    hit(r, torso, "box", 1.8, 2.6, 1.8, 0, -1.0, 0);
    r.H = 6.2; r.R = 1.45;
    r.rest = { armL: [-0.2, -0.35], armR: [-0.2, 0.35] };
    r.weakName = "pupil";
    return bake(r);
  };

  // ---- Headmaster Bellow ------------------------------------------------------
  B.headmaster = function () {
    const r = newRig("headmaster");
    const gown = lam(0x16161a), gownL = lam(0x26262c), stole = lam(0x7a1414), vest = lam(0x3a3a42), skin = lam(0x9a7462),
      skinD = lam(0x7a5646), hairM = lam(0x9a9a96), shoe = lam(0x0e0e10), gold = lam(0xb8923a), wood = lam(0x3a2418),
      cuff = lam(0xd8d4c8), trou = lam(0x22252c), lens = bas(0xff3a2a), dark = bas(0x1a0404), tooth = lam(0xe0d8c0);
    r.hipY = 2.0;
    const hips = J(r, r.root, "hips", 0, 2.0, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.5, -0.05, 0);
      cyl(leg, 0.36, 0.3, 1.95, trou, 0, -0.97, 0);
      box(leg, 0.62, 0.3, 1.0, shoe, 0, -1.95, 0.18);
    });
    const torso = J(r, hips, "torso", 0, 0.1, 0);
    cyl(torso, 1.2, 1.55, 2.9, gown, 0, 0.9, 0, 0, 0, 0, 14);
    box(torso, 0.3, 2.6, 0.08, stole, -0.5, 1.0, 1.35, -0.12, 0, 0.05);
    box(torso, 0.3, 2.6, 0.08, stole, 0.5, 1.0, 1.35, -0.12, 0, -0.05);
    sph(torso, 1.15, vest, 0, 2.0, 0.3, 1.15, 0.95, 0.85);
    for (let i = 0; i < 4; i++) box(torso, 0.1, 0.1, 0.06, gold, 0, 1.45 + i * 0.28, 1.28);
    box(torso, 3.1, 0.5, 1.5, gown, 0, 2.7, 0);
    box(torso, 1.1, 0.3, 0.9, cuff, 0, 3.0, 0.2);
    const head = J(r, torso, "head", 0, 3.3, 0.25);
    sph(head, 0.82, skin, 0, 0.25, 0, 1.12, 1.0, 1.0);
    sph(head, 0.18, skinD, 0.92, 0.25, 0); sph(head, 0.18, skinD, -0.92, 0.25, 0);
    box(head, 0.2, 0.6, 0.4, hairM, 0.84, 0.05, 0.25); box(head, 0.2, 0.6, 0.4, hairM, -0.84, 0.05, 0.25);
    box(head, 0.45, 0.12, 0.1, hairM, 0.3, 0.55, 0.8, 0, 0, -0.3); box(head, 0.45, 0.12, 0.1, hairM, -0.3, 0.55, 0.8, 0, 0, 0.3);
    [0.3, -0.3].forEach((x) => { tor(head, 0.15, 0.03, gold, x, 0.33, 0.86, 0, 0, 0, 14); cyl(head, 0.13, 0.13, 0.03, lens, x, 0.33, 0.86, Math.PI / 2, 0, 0, 14); });
    box(head, 0.2, 0.04, 0.04, gold, 0, 0.35, 0.88);
    box(head, 0.2, 0.35, 0.25, skinD, 0, 0.12, 0.9);
    box(head, 0.95, 0.18, 0.2, hairM, 0, -0.12, 0.88);
    box(head, 0.12, 0.35, 0.14, hairM, 0.5, -0.28, 0.82); box(head, 0.12, 0.35, 0.14, hairM, -0.5, -0.28, 0.82);
    box(head, 0.85, 0.35, 0.3, dark, 0, -0.33, 0.6);
    box(head, 1.7, 0.1, 1.7, gown, 0, 1.08, 0, 0, Math.PI / 4, 0);
    cyl(head, 0.75, 0.8, 0.35, gown, 0, 0.9, 0, 0, 0, 0, 14);
    cyl(head, 0.025, 0.025, 0.6, gold, 0.8, 0.8, 0.8); sph(head, 0.07, gold, 0.8, 0.48, 0.8);
    const jaw = J(r, head, "jaw", 0, -0.28, 0.2);
    box(jaw, 1.1, 0.45, 0.95, skin, 0, -0.2, 0.12);
    box(jaw, 0.8, 0.1, 0.1, tooth, 0, 0.0, 0.58);
    r.jawOpen = (k) => { jaw.rotation.x = k * 0.55; };
    r.mouth = dot(head, 0, -0.35, 0.95);
    r.eye = dot(head, 0, 0.33, 0.95);
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 1.6, 2.45, 0);
      sph(arm, 0.5, gown, 0, 0, 0);
      cyl(arm, 0.35, 0.55, 1.8, gownL, 0, -0.9, 0);
      cyl(arm, 0.3, 0.3, 0.2, cuff, 0, -1.85, 0);
      sph(arm, 0.3, skin, 0, -2.1, 0.05);
      if (s > 0) {
        cyl(arm, 0.06, 0.06, 2.75, wood, 0, -3.15, 0.3);
        sph(arm, 0.14, gold, 0, -1.82, 0.3);
      } else cyl(arm, 0.06, 0.05, 0.4, skin, 0, -2.2, 0.3, Math.PI / 2, 0, 0);
    });
    r.hand = dot(r.armR, 0, -2.1, 0.2);
    hit(r, torso, "box", 2.8, 3.2, 2.2, 0, 1.2, 0);
    hit(r, head, "sph", 0.95, 0, 0, 0, 0.2, 0, true);
    hit(r, hips, "box", 1.6, 2.0, 1.0, 0, -1.0, 0);
    r.H = 6.6; r.R = 1.55;
    r.rest = { armL: [-0.1, 0.2], armR: [-0.15, -0.15] };
    r.weakName = "head";
    return bake(r);
  };

  // ---- Matron Mildred ---------------------------------------------------------
  B.matron = function () {
    const r = newRig("matron");
    const uni = lam(0xb8b0a0), uniD = lam(0x9a9284), apron = lam(0xd8d2c0), blood = lam(0x5a1010), skin = lam(0x8f9a8a),
      skinD = lam(0x6a766a), hairM = lam(0x6a6a66), stock = lam(0x4e4e54), shoe = lam(0xd0ccc0), red = bas(0xc41a1a),
      eyeW = bas(0xf0f0e0), dark = bas(0x0a0506), steel = lam(0xb8c0c8), curl = lam(0x2a0a2a);
    r.hipY = 2.7;
    const hips = J(r, r.root, "hips", 0, 2.7, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.32, -0.1, 0);
      cyl(leg, 0.17, 0.13, 2.5, stock, 0, -1.25, 0);
      box(leg, 0.3, 0.2, 0.55, shoe, 0, -2.52, 0.08);
    });
    const torso = J(r, hips, "torso", 0, 0, 0);
    cyl(torso, 0.55, 1.15, 1.8, uni, 0, -0.6, 0, 0, 0, 0, 14);
    cyl(torso, 0.5, 0.55, 1.5, uni, 0, 0.9, 0);
    box(torso, 0.7, 0.8, 0.05, apron, 0, 1.0, 0.54);
    box(torso, 1.1, 1.5, 0.05, apron, 0, -0.45, 0.93, -0.3, 0, 0);
    [[0.2, -0.2], [-0.3, -0.6], [0.1, -1.0], [-0.1, 0.8]].forEach(([x, y]) => box(torso, 0.22, 0.16, 0.04, blood, x, y, y > 0 ? 0.58 : 0.97 - y * 0.05, -0.3, 0, 0.4));
    box(torso, 0.22, 0.07, 0.02, red, 0.28, 1.25, 0.56); box(torso, 0.07, 0.22, 0.02, red, 0.28, 1.25, 0.56);
    box(torso, 1.5, 0.3, 0.7, uniD, 0, 1.7, 0);
    const sacMat = new THREE.MeshLambertMaterial({ color: 0x8a3ab8, emissive: 0x3a0a4a, transparent: true, opacity: 0.8 });
    const sac = keep(r, sph(torso, 0.8, sacMat, 0, 0.3, 0.75, 1, 1.05, 0.9));
    [[0.2, 0.4, 0.8], [-0.25, 0.15, 0.75], [0.05, 0.05, 0.95]].forEach(([x, y, z]) => sph(torso, 0.2, curl, x, y, z, 1, 0.7, 1));
    cyl(torso, 0.14, 0.18, 0.7, skinD, 0, 2.1, 0);
    const head = J(r, torso, "head", 0, 2.55, 0.05);
    sph(head, 0.48, skin, 0, 0.1, 0, 0.85, 1.25, 0.9);
    sph(head, 0.3, hairM, 0, 0.45, -0.4);
    sph(head, 0.5, hairM, 0, 0.35, -0.08, 0.9, 0.7, 0.9);
    box(head, 0.7, 0.28, 0.45, apron, 0, 0.72, 0);
    box(head, 0.16, 0.05, 0.02, red, 0, 0.74, 0.23); box(head, 0.05, 0.16, 0.02, red, 0, 0.74, 0.23);
    [0.17, -0.17].forEach((x) => { sph(head, 0.1, dark, x, 0.2, 0.36); sph(head, 0.03, eyeW, x, 0.2, 0.45); });
    box(head, 0.5, 0.06, 0.04, dark, 0, -0.18, 0.4);
    for (let i = 0; i < 5; i++) box(head, 0.025, 0.14, 0.02, apron, -0.2 + i * 0.1, -0.18, 0.43);
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 0.8, 1.6, 0);
      sph(arm, 0.25, uni, 0, 0, 0);
      cyl(arm, 0.12, 0.1, 1.5, skin, 0, -0.75, 0);
      cyl(arm, 0.1, 0.08, 1.4, skinD, 0, -2.2, 0.04);
      box(arm, 0.25, 0.35, 0.12, skin, 0, -3.0, 0.06);
      for (let k = -1; k <= 1; k++) cyl(arm, 0.02, 0.006, 0.6, steel, k * 0.08, -3.45, 0.06);
    });
    r.hand = dot(r.armR, 0, -3.0, 0.1);
    r.eye = dot(head, 0, 0.2, 0.45);
    r.idle = (b, t) => {
      const k = 1 + Math.sin(t * 3.2) * 0.06 + (b.summoning ? 0.12 : 0);
      sac.scale.set(k, k * 1.05, k * 0.9);
      sacMat.emissive.setHex(0x3a0a4a).multiplyScalar(1 + (b.summoning ? 2.5 : 0.6 * (0.5 + 0.5 * Math.sin(t * 3.2))));
    };
    hit(r, torso, "box", 1.4, 3.0, 1.2, 0, 0.3, 0);
    hit(r, torso, "sph", 0.8, 0, 0, 0, 0.3, 0.75, true);
    hit(r, head, "sph", 0.55, 0, 0, 0, 0.15, 0);
    hit(r, hips, "box", 0.9, 2.6, 0.7, 0, -1.3, 0);
    r.H = 6.2; r.R = 1.1;
    r.rest = { armL: [-0.1, 0.15], armR: [-0.1, -0.15] };
    r.weakName = "sac";
    return bake(r);
  };

  // ---- Coach Brutus -------------------------------------------------------------
  B.coach = function () {
    const r = newRig("coach");
    const jerseyL = lam(0x8a2020), shorts = lam(0x7a1f1f), sock = lam(0xe0dcd0), stripe = lam(0xa82a2a), shoeM = lam(0x2a2a2a),
      sole = lam(0xd0d0c8), skin = lam(0x8a5a44), skinD = lam(0x6a4232), pad = lam(0xd8d8d0), padD = lam(0xa8a8a0),
      helm = lam(0x2a2a30), barM = lam(0x8a8a90), horn = lam(0xd8d0b8), hornT = lam(0x3a342a), eyeO = bas(0xff8a2a),
      silver = lam(0xc0c4c8), tape = lam(0xe8e8e0), gold = lam(0xc8a040);
    r.hipY = 1.9;
    const hips = J(r, r.root, "hips", 0, 1.9, 0);
    box(hips, 1.9, 0.8, 1.2, shorts, 0, 0, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.55, -0.2, 0);
      cyl(leg, 0.38, 0.32, 0.8, skin, 0, -0.4, 0);
      cyl(leg, 0.3, 0.26, 0.8, sock, 0, -1.1, 0);
      cyl(leg, 0.305, 0.3, 0.1, stripe, 0, -0.85, 0);
      box(leg, 0.55, 0.3, 0.9, shoeM, 0, -1.58, 0.15);
      box(leg, 0.57, 0.08, 0.92, sole, 0, -1.72, 0.15);
    });
    const torso = J(r, hips, "torso", 0, 0.35, 0);
    box(torso, 2.5, 2.1, 1.7, jerseyL, 0, 1.0, 0);
    const numMat = new THREE.MeshLambertMaterial({ map: jerseyTex() });
    keep(r, box(torso, 1.5, 1.3, 0.04, numMat, 0, 1.05, 0.87));
    [-1, 1].forEach((s) => { sph(torso, 0.85, pad, s * 1.35, 2.15, 0, 1.1, 0.6, 1.0); tor(torso, 0.7, 0.07, padD, s * 1.35, 2.1, 0, Math.PI / 2, 0, 0); });
    cyl(torso, 0.55, 0.65, 0.5, skinD, 0, 2.3, 0);
    cyl(torso, 0.05, 0.05, 0.22, silver, 0.3, 1.85, 0.92, Math.PI / 2, 0, 0, 8);
    tor(torso, 0.45, 0.015, lam(0x2a2a2a), 0.12, 2.05, 0.6, 1.2, 0, 0);
    const head = J(r, torso, "head", 0, 2.65, 0.15);
    sph(head, 0.66, helm, 0, 0.1, 0, 1, 0.95, 1.05);
    sph(head, 0.5, skin, 0, -0.05, 0.25);
    sph(head, 0.08, eyeO, 0.2, 0.08, 0.66); sph(head, 0.08, eyeO, -0.2, 0.08, 0.66);
    box(head, 0.9, 0.05, 0.05, barM, 0, -0.1, 0.74); box(head, 0.9, 0.05, 0.05, barM, 0, -0.3, 0.7);
    box(head, 0.05, 0.3, 0.05, barM, 0, -0.2, 0.74);
    [-1, 1].forEach((s) => {
      cone(head, 0.17, 0.9, horn, s * 0.75, 0.4, 0, 0, 0, -s * 1.15);
      cone(head, 0.07, 0.35, hornT, s * 1.18, 0.62, 0, 0, 0, -s * 1.15);
    });
    tor(head, 0.07, 0.015, gold, 0, -0.12, 0.74, 0, 0, 0, 10);
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 1.62, 1.95, 0);
      sph(arm, 0.5, skin, 0, -0.5, 0, 1, 1.3, 1);
      cyl(arm, 0.38, 0.3, 1.1, skin, 0, -1.35, 0);
      cyl(arm, 0.32, 0.32, 0.2, tape, 0, -1.85, 0);
      sph(arm, 0.4, skinD, 0, -2.15, 0.05);
    });
    r.eye = dot(head, 0, 0.08, 0.7);
    r.mouth = dot(head, 0, -0.2, 0.75);
    hit(r, torso, "box", 2.8, 2.6, 2.0, 0, 1.1, 0);
    hit(r, head, "sph", 0.72, 0, 0, 0, 0.05, 0.05, true);
    hit(r, hips, "box", 1.9, 1.9, 1.2, 0, -0.9, 0);
    r.H = 5.9; r.R = 1.7;
    r.rest = { torso: 0.12, armL: [-0.15, 0.25], armR: [-0.15, -0.25] };
    r.weakName = "head";
    return bake(r);
  };

  // ---- Hedge Thornwood --------------------------------------------------------
  B.thorn = function () {
    const r = newRig("thorn");
    const bark = lam(0x3b2f24), barkD = lam(0x2a2119), barkL = lam(0x4f4030), moss = lam(0x44532e), leaf = lam(0x3f5a2a),
      leafD = lam(0x2e4520), thornM = lam(0x5a4632), amber = bas(0xffb03a), dark = bas(0x0a0604);
    r.hipY = 2.3;
    const hips = J(r, r.root, "hips", 0, 2.3, 0);
    sph(hips, 0.9, barkD, 0, 0, 0, 1.2, 0.6, 1.0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.55, -0.1, 0);
      cyl(leg, 0.42, 0.55, 1.8, bark, 0, -0.9, 0, 0, 0, 0, 9);
      sph(leg, 0.35, barkL, 0, -0.9, 0.3);
      [[0, 1], [0.9, 0.2], [-0.9, 0.2], [0.5, -0.9]].forEach(([a, b]) => cyl(leg, 0.18, 0.06, 1.0, barkD, a * 0.35, -2.0, b * 0.35, b * 0.95, 0, -a * 0.95, 7));
    });
    const torso = J(r, hips, "torso", 0, 0.2, 0);
    cyl(torso, 0.95, 1.1, 2.9, bark, 0, 1.3, 0, 0, 0, 0, 10);
    [[0.8, 0.6, 0.5], [-0.7, 1.1, 0.6], [0.3, 2.1, 0.8], [-0.9, 2.0, -0.2], [0.6, 1.6, -0.7], [-0.4, 0.5, -0.9], [1.0, 1.9, 0.1], [0, 0.9, 1.0]]
      .forEach(([x, y, z]) => sph(torso, 0.3, barkL, x, y, z, 1, 1.4, 1, 7));
    sph(torso, 0.7, moss, 0.6, 2.7, 0.1, 1.1, 0.35, 1.0, 8);
    sph(torso, 0.45, dark, 0, 1.5, 0.78);
    const coreMat = bas(0xffa53a);
    const core = keep(r, sph(torso, 0.3, coreMat, 0, 1.5, 0.9));
    [-1, 1].forEach((s) => sph(torso, 0.75, bark, s * 1.05, 2.5, 0, 1, 1, 1, 9));
    sph(torso, 0.6, leaf, 1.0, 2.95, -0.2, 1, 0.8, 1, 6); sph(torso, 0.6, leafD, -1.0, 2.95, -0.2, 1, 0.8, 1, 6); sph(torso, 0.5, leaf, 0.4, 3.1, -0.5, 1, 0.8, 1, 6);
    const head = J(r, torso, "head", 0, 3.05, 0.1);
    sph(head, 0.72, barkD, 0, 0, 0, 1, 1.15, 0.92, 10);
    box(head, 1.1, 0.2, 0.3, bark, 0, 0.3, 0.55);
    sph(head, 0.13, amber, 0.25, 0.12, 0.6); sph(head, 0.13, amber, -0.25, 0.12, 0.6);
    box(head, 0.6, 0.18, 0.1, dark, 0, -0.25, 0.62);
    for (let i = 0; i < 4; i++) cone(head, 0.05, 0.16, thornM, -0.2 + i * 0.13, -0.2, 0.66, Math.PI, 0, 0, 5);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      cone(head, 0.07, 0.7, thornM, Math.cos(a) * 0.5, 0.75, Math.sin(a) * 0.45, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, 6);
    }
    sph(head, 0.35, leafD, -0.3, 0.7, -0.3, 1, 0.8, 1, 6);
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 1.3, 2.45, 0);
      cyl(arm, 0.34, 0.26, 1.6, bark, 0, -0.8, 0, 0, 0, 0, 8);
      sph(arm, 0.3, barkL, 0, -1.6, 0);
      cyl(arm, 0.25, 0.16, 1.5, barkD, 0, -2.3, 0.05, 0, 0, 0, 8);
      for (let k = -1; k <= 1; k++) cone(arm, 0.07, 0.8, barkD, k * 0.15, -3.3, 0.05 + Math.abs(k) * 0.05, Math.PI, 0, k * 0.35, 6);
      for (let k = 0; k < 3; k++) cone(arm, 0.05, 0.3, thornM, s * 0.25, -1.9 - k * 0.35, 0.05, 0, 0, -s * 1.4, 5);
      sph(arm, 0.35, leaf, 0, -0.3, 0.1, 1, 0.8, 1, 6);
    });
    r.eye = dot(head, 0, 0.12, 0.7);
    r.hand = dot(r.armR, 0, -3.0, 0.1);
    r.idle = (b, t) => {
      const k = 0.8 + 0.2 * Math.sin(t * 2.6) + (b.coreBoost || 0);
      coreMat.color.setHex(0xffa53a).multiplyScalar(k);
      core.scale.setScalar(0.95 + 0.08 * Math.sin(t * 2.6));
    };
    hit(r, torso, "box", 2.2, 3.2, 2.0, 0, 1.3, 0);
    hit(r, torso, "sph", 0.45, 0, 0, 0, 1.5, 0.85, true);
    hit(r, head, "sph", 0.8, 0, 0, 0, 0, 0);
    hit(r, hips, "box", 1.8, 2.2, 1.2, 0, -1.1, 0);
    r.H = 6.6; r.R = 1.45;
    r.rest = { armL: [-0.1, 0.3], armR: [-0.1, -0.3] };
    r.weakName = "heart";
    return bake(r);
  };

  // ---- Crackwell --------------------------------------------------------------
  B.storm = function () {
    const r = newRig("storm");
    const body = lam(0x2a2d33), metal = lam(0x3a3f4a), copper = lam(0xb8733a), copperD = lam(0x8a5228), boot = lam(0x1a1c20),
      glowW = bas(0xdffaff), gauge = bas(0x3aff9a), rubber = lam(0x1e2024), tip = bas(0x9ae8ff);
    r.hipY = 2.4;
    const hips = J(r, r.root, "hips", 0, 2.4, 0);
    box(hips, 1.1, 0.5, 0.7, metal, 0, 0, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.33, -0.1, 0);
      cyl(leg, 0.18, 0.15, 1.2, metal, 0, -0.6, 0);
      sph(leg, 0.2, copper, 0, -1.25, 0);
      cyl(leg, 0.15, 0.13, 1.0, metal, 0, -1.8, 0);
      tor(leg, 0.19, 0.04, copper, 0, -1.6, 0, Math.PI / 2, 0, 0, 12); tor(leg, 0.19, 0.04, copper, 0, -1.9, 0, Math.PI / 2, 0, 0, 12);
      box(leg, 0.4, 0.28, 0.7, boot, 0, -2.3, 0.1);
    });
    const torso = J(r, hips, "torso", 0, 0.2, 0);
    cyl(torso, 0.5, 0.45, 2.0, body, 0, 1.0, 0);
    for (let i = 0; i < 7; i++) tor(torso, 0.6, 0.07, i % 2 ? copper : copperD, 0, 0.2 + i * 0.27, 0, Math.PI / 2, 0, 0, 18);
    box(torso, 0.7, 0.6, 0.12, metal, 0, 1.5, 0.52);
    for (let i = 0; i < 3; i++) sph(torso, 0.06, i === 1 ? gauge : tip, -0.2 + i * 0.2, 1.55, 0.6);
    box(torso, 1.6, 0.35, 0.6, metal, 0, 2.1, 0);
    const rodMat = bas(0x9ae8ff);
    [-1, 1].forEach((s) => {
      cyl(torso, 0.05, 0.05, 1.8, copperD, s * 0.45, 2.9, -0.35, 0, 0, 0, 8);
      tor(torso, 0.12, 0.03, copper, s * 0.45, 3.2, -0.35, Math.PI / 2, 0, 0, 10);
      tor(torso, 0.12, 0.03, copper, s * 0.45, 3.45, -0.35, Math.PI / 2, 0, 0, 10);
      keep(r, sph(torso, 0.16, rodMat, s * 0.45, 3.85, -0.35));
    });
    const head = J(r, torso, "head", 0, 2.35, 0.05);
    tor(head, 0.45, 0.08, copper, 0, 0, 0, Math.PI / 2, 0, 0, 16);
    sph(head, 0.42, metal, 0, 0.2, 0, 1, 0.8, 0.9);
    box(head, 0.18, 0.05, 0.04, glowW, 0.15, 0.25, 0.38); box(head, 0.18, 0.05, 0.04, glowW, -0.15, 0.25, 0.38);
    const brainMat = bas(0x7ad8ff);
    const brain = keep(r, sph(head, 0.3, brainMat, 0, 0.5, 0));
    keep(r, sph(head, 0.55, new THREE.MeshLambertMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.28, depthWrite: false }), 0, 0.45, 0, 1, 1, 1, 16));
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 0.95, 2.0, 0);
      sph(arm, 0.2, copper, 0, 0, 0);
      cyl(arm, 0.12, 0.1, 1.4, metal, 0, -0.7, 0);
      tor(arm, 0.13, 0.04, copper, 0, -1.4, 0, Math.PI / 2, 0, 0, 10);
      cyl(arm, 0.1, 0.09, 1.3, rubber, 0, -2.0, 0);
      tor(arm, 0.12, 0.04, copper, 0, -2.4, 0, Math.PI / 2, 0, 0, 10);
      for (let k = -1; k <= 1; k++) { cyl(arm, 0.03, 0.02, 0.5, copper, k * 0.08, -2.9, 0.03, 0, 0, k * 0.2, 6); sph(arm, 0.05, tip, k * 0.13, -3.15, 0.03); }
    });
    // live arcs between the coils and up the rods
    const N = 14, arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const arcs = new THREE.LineSegments(arcGeo, new THREE.LineBasicMaterial({ color: 0xcff4ff, transparent: true, opacity: 0.9 }));
    arcs.frustumCulled = false;
    torso.add(arcs); keep(r, arcs);
    r.arcs = arcs;
    r.eye = dot(head, 0, 0.5, 0.3);
    r.hand = dot(r.armR, 0, -3.0, 0.1);
    r.idle = (b, t) => {
      const k = 0.7 + 0.3 * Math.abs(Math.sin(t * 7 + Math.sin(t * 13)));
      brainMat.color.setHex(0x7ad8ff).multiplyScalar(k + (b.charging ? 0.4 : 0));
      brain.scale.setScalar(0.9 + 0.1 * k);
      rodMat.color.setHex(0x9ae8ff).multiplyScalar(Math.random() < 0.1 ? 1.4 : 0.8);
      const a = arcGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const y0 = 0.2 + Math.random() * 1.6, ang = Math.random() * Math.PI * 2, ang2 = ang + (Math.random() - 0.5) * 1.2;
        const rod = i < 3 && (b.charging || Math.random() < 0.5);
        const x0 = rod ? (i % 2 ? 0.45 : -0.45) : Math.cos(ang) * 0.64, z0 = rod ? -0.35 : Math.sin(ang) * 0.64, yy = rod ? 3.2 + Math.random() * 0.6 : y0;
        a[i * 6] = x0; a[i * 6 + 1] = yy; a[i * 6 + 2] = z0;
        a[i * 6 + 3] = rod ? x0 + (Math.random() - 0.5) * 0.4 : Math.cos(ang2) * 0.66; a[i * 6 + 4] = yy + (Math.random() - 0.4) * 0.5; a[i * 6 + 5] = rod ? z0 + (Math.random() - 0.5) * 0.4 : Math.sin(ang2) * 0.66;
      }
      arcGeo.attributes.position.needsUpdate = true;
      arcs.visible = Math.random() < 0.85;
    };
    r.brainMat = brainMat;
    hit(r, torso, "box", 1.4, 2.4, 1.3, 0, 1.0, 0);
    hit(r, head, "sph", 0.6, 0, 0, 0, 0.45, 0, true);
    hit(r, hips, "box", 1.0, 2.4, 0.7, 0, -1.2, 0);
    r.H = 6.2; r.R = 1.0;
    r.rest = { armL: [-0.1, 0.2], armR: [-0.1, -0.2] };
    r.weakName = "dome";
    return bake(r);
  };

  // ---- Professor Vitriol --------------------------------------------------------
  B.chemist = function () {
    const r = newRig("chemist");
    const coat = lam(0xc8c4b0), coatD = lam(0xa8a490), stain = lam(0x6a8a3a), trou = lam(0x4a3f33), bootM = lam(0x221d18),
      skin = lam(0x9aa08a), mask = lam(0x2a2e2a), maskL = lam(0x3a403a), metal = lam(0x5a5e5a), glove = lam(0x2a4a2a),
      acid = bas(0x8aff3a), lensG = bas(0x9aff4a), hairM = lam(0xb0b0a8), leather = lam(0x3a2a1a);
    r.hipY = 2.0;
    const hips = J(r, r.root, "hips", 0, 2.0, 0);
    box(hips, 1.2, 0.5, 0.8, trou, 0, 0, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.35, -0.1, 0);
      cyl(leg, 0.26, 0.22, 1.9, trou, 0, -0.95, 0);
      box(leg, 0.42, 0.3, 0.75, bootM, 0, -1.95, 0.12);
    });
    const torso = J(r, hips, "torso", 0, 0.15, 0);
    cyl(torso, 0.8, 1.05, 2.4, coat, 0, 0.9, 0);
    box(torso, 1.6, 1.0, 0.1, coatD, 0, -0.4, -0.6, 0.2, 0, 0);
    [[0.4, 0.3], [-0.3, 0.8], [0.2, 1.4], [-0.5, 0.0], [0.55, 1.0]].forEach(([x, y]) => box(torso, 0.25, 0.2, 0.05, stain, x, y, 0.95 - y * 0.08));
    box(torso, 0.18, 2.3, 0.08, leather, 0, 1.1, 0.86, 0, 0, 0.6);
    for (let i = 0; i < 5; i++) { const k = -0.8 + i * 0.4; cyl(torso, 0.08, 0.08, 0.28, acid, k * 0.56, 1.1 + k * 0.82, 0.93, 0, 0, 0.6, 8); }
    cyl(torso, 0.42, 0.42, 1.6, metal, 0, 1.4, -0.95);
    box(torso, 0.2, 1.1, 0.05, acid, 0, 1.4, -1.38);
    sph(torso, 0.42, metal, 0, 2.2, -0.95, 1, 0.5, 1);
    cyl(torso, 0.06, 0.06, 1.4, metal, 0.7, 1.8, -0.5, 0.6, 0, -0.9, 8);
    box(torso, 1.9, 0.4, 1.0, coat, 0, 2.1, 0);
    const head = J(r, torso, "head", 0, 2.55, 0.35);
    sph(head, 0.5, skin, 0, 0, 0, 1, 1.1, 1);
    for (let i = 0; i < 6; i++) { const a = -1.2 + i * 0.5; cone(head, 0.1, 0.45, hairM, Math.sin(a) * 0.45, 0.35 + Math.cos(a) * 0.1, -0.25, -0.6, 0, -a * 0.8, 5); }
    sph(head, 0.48, mask, 0, -0.05, 0.22, 1, 0.9, 0.8);
    [0.2, -0.2].forEach((x) => { cyl(head, 0.15, 0.15, 0.06, lensG, x, 0.08, 0.6, Math.PI / 2, 0, 0, 14); tor(head, 0.16, 0.035, maskL, x, 0.08, 0.61, 0, 0, 0, 14); });
    cyl(head, 0.18, 0.2, 0.3, maskL, 0, -0.28, 0.62, Math.PI / 2, 0, 0);
    box(head, 0.26, 0.26, 0.05, metal, 0, -0.28, 0.78);
    const armR = J(r, torso, "armR", 1.1, 1.9, 0);
    cyl(armR, 0.28, 0.25, 1.3, coat, 0, -0.65, 0);
    cyl(armR, 0.2, 0.26, 1.2, metal, 0, -1.9, 0);
    cone(armR, 0.14, 0.4, metal, 0, -2.7, 0, Math.PI, 0, 0);
    sph(armR, 0.07, acid, 0, -2.92, 0);
    const armL = J(r, torso, "armL", -1.1, 1.9, 0);
    cyl(armL, 0.28, 0.25, 1.3, coat, 0, -0.65, 0);
    cyl(armL, 0.16, 0.15, 1.1, glove, 0, -1.7, 0);
    sph(armL, 0.22, glove, 0, -2.3, 0);
    cyl(armL, 0.14, 0.18, 0.4, acid, 0, -2.5, 0.2, 0, 0, 0, 10);
    r.hand = dot(armL, 0, -2.5, 0.2);
    r.eye = dot(head, 0, 0.08, 0.65);
    hit(r, torso, "box", 1.9, 2.8, 1.6, 0, 0.9, 0);
    hit(r, torso, "sph", 0.6, 0, 0, 0, 1.4, -1.0, true);
    hit(r, head, "sph", 0.55, 0, 0, 0, 0, 0.1);
    hit(r, hips, "box", 1.1, 2.0, 0.8, 0, -1.0, 0);
    r.H = 5.4; r.R = 1.2;
    r.rest = { torso: 0.35, head: -0.3, armL: [-0.3, 0.15], armR: [-0.5, -0.15] };
    r.weakName = "tank";
    return bake(r);
  };

  // ---- Warden Vex ---------------------------------------------------------
  B.void = function () {
    const r = newRig("void");
    const robe = lam(0x1a1424), robeD = lam(0x120e1a), chain = lam(0x55555a), bone = lam(0xd8d0c0), black = bas(0x000000), eyeW = bas(0xffffff);
    r.float = 2.0; r.hipY = 3.2;
    const hips = J(r, r.root, "hips", 0, 3.2, 0);
    const torso = J(r, hips, "torso", 0, 0, 0);
    cyl(torso, 0.55, 1.5, 3.6, robe, 0, -0.6, 0, 0, 0, 0, 12);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cone(torso, 0.2, 0.9, robeD, Math.cos(a) * 1.4, -2.7, Math.sin(a) * 1.4, Math.PI, 0, 0, 5); }
    tor(torso, 1.05, 0.05, chain, 0, -0.9, 0, Math.PI / 2 + 0.2, 0, 0.1, 20);
    tor(torso, 0.8, 0.05, chain, 0, 0.3, 0, Math.PI / 2 - 0.25, 0, 0, 18);
    sph(torso, 0.7, robe, 0.8, 1.0, 0); sph(torso, 0.7, robe, -0.8, 1.0, 0);
    const head = J(r, torso, "head", 0, 1.75, 0.1);
    mk(head, new THREE.SphereGeometry(0.85, 16, 12, Math.PI / 2 + 0.65, Math.PI * 2 - 1.3), robeD, 0, 0, 0).scale.set(1, 1.2, 1.1);
    sph(head, 0.62, black, 0, 0, 0.12);
    sph(head, 0.06, eyeW, 0.16, 0.08, 0.72); sph(head, 0.06, eyeW, -0.16, 0.08, 0.72);
    const mouthMat = bas(0xa24aff);
    keep(r, tor(head, 0.22, 0.04, mouthMat, 0, -0.18, 0.7, 0, 0, 0, 18));
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x8a3aff, transparent: true, opacity: 0.85 });
    const halo = J(r, torso, "halo", 0, 1.9, -0.8);
    keep(r, tor(halo, 1.5, 0.07, haloMat, 0, 0, 0, 0, 0, 0, 40));
    keep(r, tor(halo, 1.2, 0.03, haloMat, 0, 0, 0, 0, 0, 0, 36));
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 1.0, 0.9, 0.1);
      cone(arm, 0.45, 1.4, robe, 0, -0.6, 0, Math.PI, 0, 0, 9);
      cyl(arm, 0.07, 0.06, 1.2, bone, 0, -1.6, 0);
      for (let k = 0; k < 4; k++) cone(arm, 0.04, 0.45, bone, (k - 1.5) * 0.08, -2.4, 0.05, Math.PI, 0, (k - 1.5) * 0.15, 5);
    });
    r.eye = dot(head, 0, 0, 0.75);
    r.mouth = dot(head, 0, -0.18, 0.75);
    r.hand = dot(r.armR, 0, -2.3, 0.1);
    r.idle = (b, t) => {
      halo.rotation.z = t * 0.6;
      const k = 0.75 + 0.25 * Math.sin(t * 2.2) + (b.pulling ? 0.5 : 0);
      haloMat.color.setHex(0x8a3aff).multiplyScalar(k);
      mouthMat.color.setHex(0xa24aff).multiplyScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 5)));
    };
    hit(r, torso, "box", 2.0, 3.6, 2.0, 0, -0.5, 0);
    hit(r, head, "sph", 0.5, 0, 0, 0, 0, 0.35, true);
    hit(r, head, "sph", 0.9, 0, 0, 0, 0.05, -0.1);
    r.H = 5.9; r.R = 1.4;
    r.rest = { armL: [-0.25, 0.3], armR: [-0.25, -0.3] };
    r.weakName = "face";
    return bake(r);
  };

  // ---- Examiner Quill -------------------------------------------------------------
  B.examiner = function () {
    const r = newRig("examiner");
    const suit = lam(0x2f3238), suitD = lam(0x23252a), shirt = lam(0xe0ddd4), tie = lam(0x9a1a1a), shoe = lam(0x0c0c0e),
      skin = lam(0xb0a898), penR = lam(0xb81a1a), penD = lam(0x2a2a2a), board = lam(0x7a5a3a), paperM = lam(0xf0ece0),
      metal = lam(0x9aa0a8), eyeR = bas(0xff2a2a), dark = bas(0x100808);
    r.hipY = 2.9;
    const hips = J(r, r.root, "hips", 0, 2.9, 0);
    box(hips, 1.1, 0.5, 0.6, suit, 0, 0, 0);
    ["legL", "legR"].forEach((n, i) => {
      const s = i ? 1 : -1, leg = J(r, hips, n, s * 0.3, -0.1, 0);
      cyl(leg, 0.2, 0.17, 2.7, suitD, 0, -1.35, 0);
      box(leg, 0.32, 0.18, 0.7, shoe, 0, -2.72, 0.14);
    });
    const torso = J(r, hips, "torso", 0, 0.15, 0);
    box(torso, 1.3, 1.9, 0.75, suit, 0, 0.95, 0);
    box(torso, 0.3, 0.9, 0.05, suitD, 0.25, 1.35, 0.39, 0, 0, 0.3); box(torso, 0.3, 0.9, 0.05, suitD, -0.25, 1.35, 0.39, 0, 0, -0.3);
    box(torso, 0.4, 0.8, 0.04, shirt, 0, 1.4, 0.38);
    box(torso, 0.16, 0.9, 0.05, tie, 0, 1.3, 0.41);
    box(torso, 1.7, 0.3, 0.8, suit, 0, 1.85, 0);
    const orbit = J(r, torso, "orbit", 0, 1.0, 0);
    const paperMat = new THREE.MeshLambertMaterial({ color: 0xf0ece0, side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, rr = 1.5 + (i % 3) * 0.25;
      keep(r, mk(orbit, new THREE.PlaneGeometry(0.4, 0.55), paperMat, Math.cos(a) * rr, (i % 4) * 0.35 - 0.4, Math.sin(a) * rr, 0.3, -a, 0.2));
    }
    const head = J(r, torso, "head", 0, 2.25, 0);
    cyl(head, 0.12, 0.14, 0.5, skin, 0, -0.1, 0);
    const faceMat = new THREE.MeshLambertMaterial({ map: examTex() });
    keep(r, box(head, 1.1, 1.45, 0.06, faceMat, 0, 0.72, 0));
    box(head, 0.3, 0.3, 0.06, paperM, 0.48, 1.38, -0.05, 0.5, 0.3, 0);
    const eyeMat = bas(0xff2a2a);
    keep(r, box(head, 0.16, 0.08, 0.02, eyeMat, 0.2, 0.9, 0.04));
    keep(r, box(head, 0.16, 0.08, 0.02, eyeMat, -0.2, 0.9, 0.04));
    box(head, 0.45, 0.05, 0.02, dark, 0, 0.45, 0.04);
    ["armL", "armR"].forEach((n, i) => {
      const s = i ? 1 : -1, arm = J(r, torso, n, s * 0.8, 1.8, 0);
      cyl(arm, 0.15, 0.13, 1.5, suit, 0, -0.75, 0);
      cyl(arm, 0.13, 0.13, 0.12, shirt, 0, -1.5, 0);
      sph(arm, 0.14, skin, 0, -1.65, 0);
      if (s > 0) {
        cyl(arm, 0.1, 0.1, 1.6, penR, 0, -1.7, 0.3, 1.2, 0, 0);
        cone(arm, 0.1, 0.3, penD, 0, -1.4, 1.08, 1.2 - Math.PI, 0, 0);
        box(arm, 0.04, 0.5, 0.04, metal, 0.1, -1.95, -0.2, 1.2, 0, 0);
      } else {
        box(arm, 0.7, 0.95, 0.05, board, 0, -1.85, 0.25, -0.3, 0, 0);
        box(arm, 0.6, 0.8, 0.02, paperM, 0, -1.87, 0.29, -0.3, 0, 0);
        box(arm, 0.25, 0.08, 0.06, metal, 0, -1.4, 0.13, -0.3, 0, 0);
      }
    });
    r.eye = dot(head, 0, 0.9, 0.1);
    r.hand = dot(r.armR, 0, -1.65, 0.3);
    r.eyeMat = eyeMat;
    r.idle = (b, t) => { orbit.rotation.y = t * 0.8; orbit.children.forEach((p, i) => { p.rotation.x = 0.3 + Math.sin(t * 2 + i) * 0.4; }); };
    hit(r, torso, "box", 1.4, 2.2, 0.9, 0, 0.95, 0);
    hit(r, head, "box", 1.2, 1.5, 0.4, 0, 0.72, 0, true);
    hit(r, hips, "box", 0.9, 2.8, 0.6, 0, -1.4, 0);
    r.H = 6.8; r.R = 0.95;
    r.rest = { armL: [-0.35, 0.1], armR: [-0.3, -0.1] };
    r.weakName = "paper face";
    return bake(r);
  };

  G.BossModels = {
    IDS: Object.keys(B),
    build(id) { return (B[id] || B.gravedigger)(); },
    // Frees the GPU side of a body that is gone for good.
    dispose(rig) {
      if (!rig) return;
      if (rig.root.parent) rig.root.parent.remove(rig.root);
      rig.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== HITMAT) {
          const m = o.material;
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      if (rig.shared) { rig.shared.lambert.dispose(); rig.shared.basic.dispose(); }
    },
    // A picture of the boss for the Boss Codex: its body standing in its rest
    // pose, in colour -- or, for one not met yet, a black cut-out against a
    // dim light. Drawn once each with a small renderer of its own and kept.
    _pics: {},
    portrait(id, silhouette) {
      const key = id + (silhouette ? ":s" : "");
      if (this._pics[key]) return this._pics[key];
      let url = "";
      try {
        const W = 256, H = 320;
        if (!this._r) {
          this._r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
          this._r.setPixelRatio(1);
          this._r.setSize(W, H);
        }
        const rig = this.build(id);
        G.Bosses && G.Bosses.restPose ? G.Bosses.restPose(rig) : null;
        const sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a2018, silhouette ? 0 : 0.85));
        const key1 = new THREE.DirectionalLight(0xfff0dc, silhouette ? 0 : 1.1); key1.position.set(3, 6, 8); sc.add(key1);
        const rim = new THREE.DirectionalLight(0x8ab8ff, silhouette ? 0 : 0.7); rim.position.set(-6, 4, -5); sc.add(rim);
        if (silhouette) sc.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x050608 });
        rig.hitboxes.forEach((h) => { h.visible = false; });
        rig.root.rotation.y = 0.35;
        sc.add(rig.root);
        const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
        const h = rig.H + (rig.float ? 0 : 0);
        const top = h + 0.2, mid = top / 2;
        const dist = (top * 0.62) / Math.tan((30 * Math.PI / 180) / 2);
        cam.position.set(0.8, mid + 0.4, dist);
        cam.lookAt(0, mid, 0);
        this._r.setClearColor(silhouette ? 0x3a4050 : 0x000000, silhouette ? 1 : 0);
        this._r.render(sc, cam);
        url = this._r.domElement.toDataURL("image/png");
        if (sc.overrideMaterial) sc.overrideMaterial.dispose();
        this.dispose(rig);
      } catch (e) { url = ""; }
      this._pics[key] = url;
      return url;
    },
    // done with the codex: its renderer goes, the pictures stay
    releaseRenderer() {
      if (!this._r) return;
      try { this._r.dispose(); if (this._r.forceContextLoss) this._r.forceContextLoss(); } catch (e) { /* gone already */ }
      this._r = null;
    },
  };
})();
