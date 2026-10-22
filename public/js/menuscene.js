// ===================================================================
// The Main Menu's scene (overhaul, round 5)
// -------------------------------------------------------------------
// Behind the menu, a real 3D place, built of boxes like the rest of the
// game: the corridor of an abandoned underground facility running deep to a
// great steel door. Concrete below and metal panels above, steel frames
// every three metres, pipes and slack cables along the ceiling, control
// panels with their small status lights, a fan in the wall, crates and a
// barrel at the edges, a dark side passage. A red emergency lamp over the
// door pulses slowly; warm orange light leaks through the door's seam; a
// cold teal light from the side picks out the survivor standing guard on
// the right. Fog lies low, dust drifts through cheap fake light shafts, a
// bulb flickers now and then -- never the whole scene, never a flash.
//
// Everything still is merged into a few meshes on two shared materials
// (concrete, metal) with the zombies' pixel atlas (js/zombiefactory.js), and
// darkened where surfaces meet (vertex AO). Lights, shadows, the dust and the
// shafts follow the graphics level.
//
// The survivor (built here, like the zombies: a jointed rig of boxes) keeps
// watch in an idle loop with no visible seams: breathing, small shifts of the
// head and shoulders, looking at the door or into the dark now and then,
// changing feet, a hand to a strap -- the gear trailing on springs.
//
//   G.MenuScene.build(quality)  -> { scene, camera, update(dt, t, motion), fit(w, h),
//                                    point(x, y), dispose(), sounds, survivor, live }  (js/mainmenu.js)
// ===================================================================
window.G = window.G || {};

G.MenuScene = (function () {
  const PAL = {
    black: 0x0b0c0e, charcoal: 0x2a2d31, brown: 0x3b2f26, green: 0x4a5a3f,
    teal: 0x3fc1b0, red: 0xa3161f, orange: 0xff8a3d,
  };
  const W = 6, H = 4.2, Z0 = 8, ZD = -14, SZ = 3.6;   // the corridor: width, height, from z0 to the door; where the survivor stands
  const rnd = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  // a box into a group, in a colour, showing a tile of the atlas
  function box(g, w, h, d, x, y, z, color, tile, o) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.material.userData.ztile = tile || "plain";
    m.position.set(x, y, z);
    if (o && o.rx) m.rotation.x = o.rx;
    if (o && o.ry) m.rotation.y = o.ry;
    if (o && o.rz) m.rotation.z = o.rz;
    if (o && o.front) m.userData.frontTile = o.front;
    g.add(m);
    return m;
  }
  function glow(g, w, h, d, x, y, z, color, o) {
    // (o.nofog: a light that must read from the far end of the corridor)
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, fog: !(o && o.nofog) }));
    m.position.set(x, y, z);
    if (o && o.ry) m.rotation.y = o.ry;
    g.add(m);
    return m;
  }

  // ---------------- the corridor ----------------
  function corridor(cg, mg, eg, R) {
    // the floor: concrete slabs with dark joints, a steel grating down the middle to the door
    for (let z = Z0; z > ZD - 1; z -= 2) {
      for (let x = -3; x < 3; x += 2) {
        if (x === -1) continue;
        const c = new THREE.Color(0x2c2e31).offsetHSL(0, 0, (R() - 0.5) * 0.03).getHex();
        box(cg, 1.96, 0.1, 1.96, x + 1, -0.05, z - 1, c, "plain");
      }
    }
    box(cg, W, 0.04, Z0 - ZD + 2, 0, -0.12, (Z0 + ZD) / 2, 0x141517, "plain");          // the joints
    for (let z = Z0; z > ZD; z -= 0.5) box(mg, 1.5, 0.05, 0.36, 0, 0.0, z - 0.25, 0x3a3d40, "metal");   // the grating's slats
    box(mg, 0.06, 0.06, Z0 - ZD, -0.78, 0.02, (Z0 + ZD) / 2, 0x55595d, "metal");
    box(mg, 0.06, 0.06, Z0 - ZD, 0.78, 0.02, (Z0 + ZD) / 2, 0x55595d, "metal");
    // walls: concrete to shoulder height, metal panels above, a dark skirting
    [-1, 1].forEach((s) => {
      const x = s * (W / 2 + 0.1);
      for (let z = Z0; z > ZD; z -= 3) {
        // (a dark side passage on the left, a third of the way down)
        if (s < 0 && z === -4) continue;
        box(cg, 0.2, 1.4, 3, x, 0.7, z - 1.5, new THREE.Color(0x35373b).offsetHSL(0, 0, (R() - 0.5) * 0.04).getHex(), "plain");
        box(mg, 0.2, H - 1.4, 2.96, x, 1.4 + (H - 1.4) / 2, z - 1.5, new THREE.Color(PAL.charcoal).offsetHSL(0, 0, (R() - 0.5) * 0.03).getHex(), "metal");
        box(cg, 0.24, 0.12, 3, x - s * 0.02, 0.06, z - 1.5, 0x18191b, "plain");
      }
    });
    // the side passage: a doorway into the dark
    box(mg, 0.3, H, 0.3, -W / 2 - 0.05, H / 2, -4, 0x3b3f43, "metal");
    box(mg, 0.3, H, 0.3, -W / 2 - 0.05, H / 2, -7, 0x3b3f43, "metal");
    box(cg, 3.4, 0.1, 3, -W / 2 - 1.6, -0.05, -5.5, 0x1e1f21, "plain");
    box(cg, 0.2, H, 3, -W / 2 - 3.2, H / 2, -5.5, 0x16171a, "plain");
    box(mg, 3.2, 0.2, 3, -W / 2 - 1.6, H, -5.5, 0x141518, "metal");
    // the ceiling
    box(mg, W + 0.4, 0.2, Z0 - ZD, 0, H + 0.1, (Z0 + ZD) / 2, 0x16181a, "metal");
    // steel frames every three metres: a column each side, a beam across
    for (let z = Z0 - 2; z > ZD + 1; z -= 3) {
      const rust = new THREE.Color(0x3b3f43).lerp(new THREE.Color(0x4a3a2e), R() * 0.5).getHex();
      [-1, 1].forEach((s) => {
        box(mg, 0.34, H, 0.34, s * (W / 2 - 0.12), H / 2, z, rust, "metal");
        box(mg, 0.5, 0.12, 0.5, s * (W / 2 - 0.12), 0.06, z, 0x232528, "metal");     // the base plate
        box(mg, 0.42, 0.42, 0.06, s * (W / 2 - 0.3), H - 0.3, z, rust, "metal", { rz: s * 0.785 });   // the knee brace
      });
      box(mg, W, 0.3, 0.34, 0, H - 0.15, z, rust, "metal");
    }
    // pipes along the ceiling and one down the right wall, collars every two metres
    const pipes = [[-2.45, 3.62, 0.3, PAL.green], [-2.05, 3.88, 0.18, PAL.brown], [2.4, 3.7, 0.36, 0x5a5f63], [2.0, 3.92, 0.14, 0x7a2a22], [2.78, 2.35, 0.14, 0x5a5f63]];
    pipes.forEach(([x, y, r, c]) => {
      box(mg, r, r, Z0 - ZD, x, y, (Z0 + ZD) / 2, c, "metal");
      for (let z = Z0 - 1; z > ZD; z -= 2) box(mg, r + 0.07, r + 0.07, 0.12, x, y, z, new THREE.Color(c).multiplyScalar(0.75).getHex(), "metal");
    });
    // slack cables between the frames, swinging a little low
    [[-1.6, 3.95, 0.35, 0x111214], [-1.35, 3.98, 0.5, 0x2a1e18], [1.55, 3.96, 0.42, 0x111214]].forEach(([x, y, sag, c]) => {
      for (let z = Z0 - 2; z > ZD + 4; z -= 3) {
        const n = 6;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const y0 = y - sag * 4 * t0 * (1 - t0), y1 = y - sag * 4 * t1 * (1 - t1);
          const za = z - 3 * t0, zb = z - 3 * t1, len = Math.hypot(zb - za, y1 - y0);
          box(cg, 0.035, 0.035, len, x, (y0 + y1) / 2, (za + zb) / 2, c, "plain", { rx: Math.atan2(y1 - y0, -(zb - za)) });
        }
      }
    });
    // hazard lines on the floor before the door
    for (let i = 0; i < 9; i++) box(cg, 0.36, 0.02, 0.5, -2.2 + i * 0.55, 0.01, ZD + 2.2, i % 2 ? 0x8a7420 : 0x151515, "plain", { ry: 0.6 });
  }

  // ---------------- the door ----------------
  function door(cg, mg, eg, live) {
    const z = ZD;
    // the wall it stands in
    box(cg, W + 0.4, H + 0.2, 0.4, 0, H / 2, z - 0.4, 0x2b2d30, "plain");
    // its frame: thick posts striped with warning paint, a lintel
    [-1, 1].forEach((s) => {
      box(mg, 0.6, 3.7, 0.5, s * 2.1, 1.85, z + 0.05, 0x2e3134, "metal");
      for (let i = 0; i < 7; i++) box(cg, 0.62, 0.22, 0.04, s * 2.1, 0.35 + i * 0.5, z + 0.32, i % 2 ? 0x1a1a1a : 0x9a7f22, "plain", { rz: 0.5 });
    });
    box(mg, 4.8, 0.6, 0.5, 0, 3.95, z + 0.05, 0x2e3134, "metal");
    // the two leaves: plates, ribs, rivets, a wheel lock -- a hand's width apart
    [-1, 1].forEach((s) => {
      const lx = s * 0.92;
      box(mg, 1.76, 3.4, 0.24, lx, 1.72, z, 0x3a3e42, "metal");
      for (let i = 0; i < 4; i++) box(mg, 1.6, 0.1, 0.08, lx, 0.5 + i * 0.85, z + 0.16, 0x2a2d30, "metal");
      box(mg, 0.1, 3.2, 0.08, lx + s * 0.6, 1.72, z + 0.16, 0x2a2d30, "metal");
      for (let i = 0; i < 6; i++) box(mg, 0.06, 0.06, 0.04, lx - s * 0.75, 0.4 + i * 0.6, z + 0.14, 0x6a6e72, "metal");
    });
    box(mg, 0.5, 0.5, 0.1, 0.62, 1.7, z + 0.2, 0x55595e, "metal");             // the wheel
    box(mg, 0.08, 0.6, 0.08, 0.62, 1.7, z + 0.27, 0x6a6e72, "metal");
    box(mg, 0.6, 0.08, 0.08, 0.62, 1.7, z + 0.27, 0x6a6e72, "metal");
    // warm light through the seam, and spilling under the door
    live.seam = glow(eg, 0.06, 3.3, 0.05, 0, 1.7, z + 0.12, PAL.orange, { nofog: true });
    live.sill = glow(eg, 3.4, 0.04, 0.06, 0, 0.03, z + 0.14, 0xff7a2a, { nofog: true });
    // the emergency lamp over it: housing and red lens
    box(mg, 0.7, 0.32, 0.36, 0, 4.42, z + 0.3, 0x24272a, "metal");
    live.lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }));
    live.lamp.position.set(0, 4.4, z + 0.5);
    // a hazard sign on the lintel: a trefoil, no words
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: trefoil(), transparent: true }));
    sign.position.set(-1.25, 3.95, z + 0.31);
    live.sign = sign;
  }
  // the biohazard trefoil, drawn once
  function trefoil() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#a07e1e"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#141414"; g.fillRect(3, 3, 58, 58);
    g.fillStyle = "#a07e1e";
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 - Math.PI / 2;
      g.beginPath(); g.arc(32 + Math.cos(a) * 11, 34 + Math.sin(a) * 11, 10, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#141414";
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 - Math.PI / 2;
      g.beginPath(); g.arc(32 + Math.cos(a) * 14, 34 + Math.sin(a) * 14, 6, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.arc(32, 34, 4, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------------- the walls' things: panels, a fan, lamps, crates ----------------
  function fixtures(cg, mg, eg, live, R) {
    // control panels: a screen, a row of status lights (some blink)
    live.leds = [];
    const panel = (x, z, s, big) => {
      const w = big ? 0.9 : 0.6, h = big ? 0.7 : 0.5;
      box(mg, 0.14, h + 0.12, w + 0.12, x, 1.55, z, 0x24272a, "metal");
      if (big) live.screen = glow(eg, 0.02, h * 0.55, w * 0.8, x - s * 0.08, 1.62, z, 0x0f4a44);
      for (let i = 0; i < (big ? 5 : 3); i++) {
        const col = [0x2aff7a, 0xffb020, 0xff3030, 0x2aff7a, 0x30c8ff][i % 5];
        const led = glow(eg, 0.03, 0.04, 0.04, x - s * 0.08, 1.55 - h * 0.38, z - w * 0.32 + i * 0.13, col);
        live.leds.push({ m: led, col: new THREE.Color(col), rate: 0.4 + R() * 1.6, phase: R() * 6, blink: R() < 0.5 });
      }
      box(mg, 0.3, 1.5, 0.08, x - s * 0.04, 0.75, z + w * 0.45, 0x1c1e20, "metal");     // a conduit down to the floor
    };
    panel(-W / 2 + 0.05, 1.2, -1, true);
    panel(W / 2 - 0.05, -2.5, 1, false);
    panel(-W / 2 + 0.05, -10, -1, false);
    // a fan in the right wall
    box(mg, 0.2, 1.0, 1.0, W / 2 - 0.02, 3.0, -8.5, 0x1e2022, "metal");
    const fan = new THREE.Group(); fan.position.set(W / 2 - 0.1, 3.0, -8.5);
    for (let i = 0; i < 4; i++) { const b = box(fan, 0.04, 0.4, 0.13, 0, 0, 0, 0x4a4e52, "metal"); b.geometry.translate(0, 0.2, 0); b.rotation.x = i * Math.PI / 2; }
    live.fan = fan;
    // caged lamps along the ceiling: warm over the survivor, one that flickers, a cold one far down
    live.lamps = [];
    [[0.9, SZ, 0xffc88a, "warm"], [-0.4, -3.5, 0xffd6a0, "flicker"], [0.2, -10.5, 0x9adfd6, "cold"]].forEach(([x, z, col, kind]) => {
      box(mg, 0.36, 0.1, 0.36, x, H - 0.12, z, 0x222426, "metal");
      const bulb = glow(eg, 0.16, 0.14, 0.16, x, H - 0.28, z, col);
      [-1, 1].forEach((s) => box(mg, 0.02, 0.2, 0.3, x + s * 0.13, H - 0.28, z, 0x3a3d40, "metal"));
      live.lamps.push({ bulb, kind, col: new THREE.Color(col) });
    });
    // crates and a barrel at the edges, a duffel by the survivor's feet
    // (y0: what it stands on)
    const crate = (x, z, s, ry, c, y0) => {
      y0 = y0 || 0;
      box(cg, s, s, s, x, y0 + s / 2, z, c, "coat", { ry });
      box(mg, s + 0.02, 0.06, s + 0.02, x, y0 + s * 0.8, z, 0x2a2a2a, "metal", { ry });
      box(mg, s + 0.02, 0.06, s + 0.02, x, y0 + s * 0.2, z, 0x2a2a2a, "metal", { ry });
    };
    crate(-2.3, 4.3, 0.8, 0.2, 0x4a3a28);
    crate(-2.25, 4.25, 0.55, -0.3, 0x3e3122, 0.8);
    crate(2.45, -1.0, 0.7, 0.4, 0x3a3326);
    box(mg, 0.6, 0.9, 0.6, 2.55, 0.45, 1.6, 0x2f3d30, "metal");                                  // the barrel
    box(cg, 0.62, 0.12, 0.62, 2.55, 0.65, 1.6, 0x8a7420, "plain");
    box(cg, 0.7, 0.28, 0.32, 2.4, 0.14, 2.7, 0x3b3a2e, "coat", { ry: 0.5 });                     // the duffel
    box(mg, 0.4, 0.22, 0.26, -1.5, 0.11, 2.6, 0x3a4234, "metal", { ry: -0.3 });                  // an ammo box
    for (let i = 0; i < 7; i++) box(cg, 0.22, 0.01, 0.3, (R() - 0.5) * 4, 0.006, 2 - R() * 18, 0x6a665a, "plain", { ry: R() * 3 });   // papers
  }

  // ---------------- the survivor ----------------
  function survivor() {
    const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
    const M = (c, t) => { const m = new THREE.MeshLambertMaterial({ color: c }); m.userData.ztile = t || "plain"; return m; };
    const mats = {
      skin: M(0xa07a5c, "skin"), jacket: M(PAL.green, "coat"), vest: M(0x26292c, "metal"), strap: M(0x1a1a1a, "shoe"),
      pouch: M(PAL.brown, "coat"), pants: M(0x2b2c2e, "denim"), boot: M(0x1a1612, "shoe"), glove: M(0x202020, "shoe"),
      hair: M(0x1c1612, "hair"), beanie: M(0x2f3a30, "knit"), scarf: M(0x5a5844, "knit"), pack: M(0x3b2f26, "coat"), roll: M(0x4a5a3f, "coat"),
      pad: M(0x1e2022, "metal"), eye: M(0x120e0b),
    };
    const add = (p, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
    const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
    add(hips, 0.46, 0.2, 0.28, 0, 0.0, 0, mats.pants);
    add(hips, 0.5, 0.08, 0.3, 0, 0.1, 0, mats.strap);                                     // the belt
    [-0.17, 0.17].forEach((x) => add(hips, 0.12, 0.14, 0.08, x, 0.04, 0.16, mats.pouch)); // belt pouches
    const upper = new THREE.Group(); upper.position.y = 0.1; hips.add(upper);
    add(upper, 0.52, 0.66, 0.3, 0, 0.34, 0, mats.jacket);
    add(upper, 0.54, 0.46, 0.34, 0, 0.36, 0, mats.vest);                                   // the plate carrier
    [-0.13, 0, 0.13].forEach((x) => add(upper, 0.11, 0.15, 0.07, x, 0.22, 0.2, mats.pouch));
    [-0.17, 0.17].forEach((x) => add(upper, 0.07, 0.3, 0.36, x, 0.62, 0, mats.strap));     // the shoulder straps
    add(upper, 0.36, 0.1, 0.32, 0, 0.7, 0.01, mats.scarf);                                  // a scarf at the neck
    const pack = new THREE.Group(); pack.position.set(0, 0.42, -0.2); upper.add(pack);
    add(pack, 0.46, 0.5, 0.22, 0, 0, -0.08, mats.pack);
    add(pack, 0.5, 0.14, 0.14, 0, 0.32, -0.08, mats.roll);                                  // a bedroll on top
    add(pack, 0.12, 0.2, 0.08, 0.2, -0.05, -0.2, mats.pouch);
    const neck = new THREE.Group(); neck.position.y = 0.72; upper.add(neck);
    const head = add(neck, 0.32, 0.34, 0.32, 0, 0.2, 0, mats.skin);
    head.userData.frontTile = "plain";        // (a living face: no zombie's sockets and torn mouth)
    add(neck, 0.34, 0.14, 0.34, 0, 0.36, -0.01, mats.beanie);                               // a beanie
    add(neck, 0.33, 0.12, 0.08, 0, 0.26, -0.14, mats.hair);
    [-0.07, 0.07].forEach((x) => add(neck, 0.05, 0.03, 0.01, x, 0.23, 0.165, mats.eye));
    add(neck, 0.3, 0.12, 0.06, 0, 0.09, 0.16, mats.scarf);                                  // the scarf pulled up over the chin
    const arm = (s) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.33, 0.62, 0); upper.add(sh);
      add(sh, 0.16, 0.32, 0.16, 0, -0.15, 0, mats.jacket);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      add(el, 0.15, 0.28, 0.15, 0, -0.14, 0, mats.jacket);
      add(el, 0.13, 0.13, 0.12, 0, -0.33, 0.01, mats.glove);
      return { sh, el, s };
    };
    const leg = (s) => {
      const hp = new THREE.Group(); hp.position.set(s * 0.13, 0.92, 0); g.add(hp);
      add(hp, 0.19, 0.44, 0.2, 0, -0.22, 0, mats.pants);
      const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
      add(kn, 0.18, 0.42, 0.19, 0, -0.21, 0, mats.pants);
      add(kn, 0.2, 0.14, 0.08, 0, -0.02, 0.1, mats.pad);                                    // a knee pad
      add(kn, 0.2, 0.12, 0.3, 0, -0.42, 0.04, mats.boot);
      return { hp, kn, s };
    };
    const L = { armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1) };
    // the rifle, held low across the body: the grip by the right hip, the
    // muzzle down and across to the left; the hands go to its grip and fore
    // anchors (reach(), below)
    let gun = null, grip = null, fore = null;
    if (G.buildWeaponMesh && G.WEAPON_DEFS && G.WEAPON_DEFS.rifle) {
      gun = G.buildWeaponMesh(G.WEAPON_DEFS.rifle);
      gun.scale.setScalar(0.95);
      gun.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), new THREE.Vector3(-0.85, -0.15, 0.5), new THREE.Vector3(0, 1, 0)));
      const an = gun.userData.anchors || {}, at = (a, d) => new THREE.Vector3().copy(a || d).multiplyScalar(0.95).applyQuaternion(gun.quaternion);
      grip = new THREE.Vector3(0.16, 0.3, 0.28);
      gun.position.copy(grip).sub(at(an.grip, { x: 0, y: -0.15, z: 0.11 }));
      fore = at(an.fore, { x: 0, y: -0.06, z: -0.23 }).add(gun.position);
      // (a worn, darker copy of its colours: the game's bright skin glows under the teal rim)
      gun.traverse((o) => {
        if (!o.isMesh || o.material.isMeshBasicMaterial || !o.geometry.attributes.color) return;
        o.geometry = o.geometry.clone();
        const c = o.geometry.attributes.color;
        for (let i = 0; i < c.count; i++) {
          const l = c.getX(i) * 0.3 + c.getY(i) * 0.59 + c.getZ(i) * 0.11;
          c.setXYZ(i, (l + (c.getX(i) - l) * 0.3) * 0.55, (l + (c.getY(i) - l) * 0.3) * 0.55, (l + (c.getZ(i) - l) * 0.3) * 0.55);
        }
      });
      upper.add(gun);
    }
    const shared = { lambert: new THREE.MeshStandardMaterial({ vertexColors: true, map: G.ZombieSkin ? G.ZombieSkin.texture() : null, roughness: 0.85, metalness: 0.05 }), basic: new THREE.MeshBasicMaterial({ vertexColors: true }), uvOf: G.ZombieSkin ? G.ZombieSkin.uvOf : null };
    const groups = [];
    g.traverse((o) => { if (!o.isMesh && o !== gun && !(gun && isIn(o, gun))) groups.push(o); });
    groups.forEach((grp) => G.Perf.mergeLocalColored(grp, grp.children.filter((c) => !c.isMesh || c === gun), shared));
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { root, g, hips, upper, neck, pack, L, gun, grip, fore, strap: new THREE.Vector3(-0.17, 0.56, 0.22), shared };
  }
  function isIn(o, p) { for (let q = o; q; q = q.parent) if (q === p) return true; return false; }

  // ---- two-bone reach: the shoulder turned and the elbow bent so the hand
  // (FA under the elbow) lands on T, in the upper body's space; the elbow
  // swung toward the pole ----
  const UA = 0.3, FA = 0.33, POLE_R = new THREE.Vector3(1, -0.4, -0.5), POLE_L = new THREE.Vector3(-0.7, -1, 0);
  const _d = new THREE.Vector3(), _h = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _qt = new THREE.Quaternion();
  function reach(arm, T, pole) {
    _d.copy(T).sub(arm.sh.position);
    const d = Math.min(UA + FA - 0.002, Math.max(0.05, _d.length()));
    const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, (UA * UA + FA * FA - d * d) / (2 * UA * FA))));
    arm.el.rotation.x = -bend;
    _h.set(0, -UA - FA * Math.cos(bend), FA * Math.sin(bend)).normalize();
    _d.normalize();
    _q.setFromUnitVectors(_h, _d);
    _e.set(0, -1, 0).applyQuaternion(_q);
    _e.addScaledVector(_d, -_e.dot(_d));
    _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
    if (_e.lengthSq() > 1e-6 && _p.lengthSq() > 1e-6) {
      _e.normalize(); _p.normalize();
      _qt.setFromAxisAngle(_d, Math.atan2(_h.copy(_e).cross(_p).dot(_d), _e.dot(_p)));
      _q.premultiply(_qt);
    }
    arm.sh.quaternion.copy(_q);
  }

  // ---- the survivor's idle: a state a few seconds at a time, eased into ----
  const POSES = {
    watch:    { look: [0, 0], twist: 0, weight: 0, hand: 0 },
    door:     { look: [0.85, -0.05], twist: 0.35, weight: 0.3, hand: 0 },
    dark:     { look: [-0.7, 0.05], twist: -0.25, weight: -0.2, hand: 0 },
    shift:    { look: [0.15, 0.08], twist: 0.05, weight: -0.9, hand: 0 },
    strap:    { look: [-0.2, 0.25], twist: -0.05, weight: 0.4, hand: 1 },
  };
  function idle(S, dt, t, R) {
    S.timer -= dt;
    if (S.timer <= 0) {
      const keys = Object.keys(POSES).filter((k) => k !== S.state);
      // (mostly watching; now and then the door, the dark, a shift, a strap)
      S.state = S.state !== "watch" && R() < 0.55 ? "watch" : keys[Math.floor(R() * keys.length)];
      S.timer = S.state === "watch" ? 4 + R() * 5 : S.state === "strap" ? 2.2 : 2.8 + R() * 2.5;
    }
    const P = POSES[S.state], k = 1 - Math.exp(-dt / 0.7);
    ["look0", "look1", "twist", "weight", "hand"].forEach((n) => {
      const want = n === "look0" ? P.look[0] : n === "look1" ? P.look[1] : P[n];
      S[n] += (want - S[n]) * k;
    });
  }

  // ---------------- the light shafts, the dust, the low fog ----------------
  function shaftTexture() {
    const c = document.createElement("canvas"); c.width = 32; c.height = 128;
    const g = c.getContext("2d");
    const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, "rgba(255,255,255,0.9)"); v.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = v; g.fillRect(0, 0, 32, 128);
    g.globalCompositeOperation = "destination-in";
    const h = g.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, "rgba(0,0,0,0)"); h.addColorStop(0.5, "rgba(0,0,0,1)"); h.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = h; g.fillRect(0, 0, 32, 128);
    return new THREE.CanvasTexture(c);
  }
  function softDot() {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d"), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  function fogTexture(R) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    for (let i = 0; i < 60; i++) {
      const x = R() * 128, y = R() * 128, r = 10 + R() * 30, rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(255,255,255," + (0.08 + R() * 0.12) + ")"); rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ---------------- build ----------------
  function build(quality) {
    const q = quality || "medium", hi = q === "high" || q === "vhigh", lo = q === "vlow" || q === "low";
    const R = rnd(97);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.black);
    scene.fog = new THREE.Fog(0x07080a, 7, 33);
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 80);
    const live = {};
    const cg = new THREE.Group(), mg = new THREE.Group(), eg = new THREE.Group();
    corridor(cg, mg, eg, R);
    door(cg, mg, eg, live);
    fixtures(cg, mg, eg, live, R);
    // everything still: two materials (concrete, metal) and the glowing bits, merged
    const atlas = G.ZombieSkin ? G.ZombieSkin.texture() : null;
    const concrete = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.95, metalness: 0.0 });
    const metal = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.6, metalness: 0.45 });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    const keep = [live.fan].filter(Boolean);
    const leds = (live.leds || []).map((l) => l.m), lampBulbs = (live.lamps || []).map((l) => l.bulb);
    G.Perf.mergeLocalColored(cg, [], { lambert: concrete, basic: glowMat, uvOf: G.ZombieSkin && G.ZombieSkin.uvOf });
    G.Perf.mergeLocalColored(mg, keep, { lambert: metal, basic: glowMat, uvOf: G.ZombieSkin && G.ZombieSkin.uvOf });
    // (the lights that change stay their own: each LED, each bulb, the seam)
    eg.children.slice().forEach((m) => { if (!leds.includes(m) && !lampBulbs.includes(m) && m !== live.seam && m !== live.sill && m !== live.screen) m.material = glowMat; });
    [cg, mg].forEach((grp) => grp.children.forEach((m) => { if (m.isMesh && m.geometry.attributes.color) bakeAO(m.geometry); m.receiveShadow = hi; }));
    // (the fan's blades turn: their own plain metal, not merged)
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.6, metalness: 0.4 });
    if (live.fan) live.fan.children.forEach((b) => { b.material = fanMat; });
    scene.add(cg, mg, eg, live.lamp, live.sign);
    if (live.fan) mg.add(live.fan);
    // lights: dark everywhere, red over the door, warm through it, cold teal from the side
    scene.add(new THREE.HemisphereLight(0x1c2632, 0x0b0c0e, lo ? 0.55 : 0.4));
    live.red = new THREE.PointLight(0xff2a2a, 1.6, 11, 2); live.red.position.set(0, 4.0, ZD + 1.2); scene.add(live.red);
    live.warm = new THREE.PointLight(PAL.orange, 1.4, 11, 2); live.warm.position.set(0, 1.4, ZD + 0.8); scene.add(live.warm);
    // (a narrow cone on the survivor alone: a directional one lit the whole left wall)
    live.rim = new THREE.SpotLight(PAL.teal, hi ? 3.4 : 2.8, 9, 0.42, 0.7, 1.5); live.rim.position.set(4.0, 3.2, SZ - 2.2); scene.add(live.rim, live.rim.target);
    if (!lo) { live.flick = new THREE.PointLight(0xffd6a0, 0.9, 9, 2); live.flick.position.set(-0.4, H - 0.6, -3.5); scene.add(live.flick); }
    if (hi) {
      // a shadow from the lamp over the survivor
      live.key = new THREE.SpotLight(0xffc88a, 1.7, 9, 0.9, 0.6, 2);
      live.key.position.set(0.9, H - 0.35, SZ);
      live.key.castShadow = true; live.key.shadow.mapSize.set(1024, 1024); live.key.shadow.bias = -0.0008;
      scene.add(live.key, live.key.target);
    } else {
      live.key = new THREE.PointLight(0xffc88a, 1.1, 7, 2); live.key.position.set(0.9, H - 0.5, SZ); scene.add(live.key);
    }
    // the survivor, and a soft dark patch under him (any level)
    const sv = survivor();
    sv.root.position.set(1.55, 0, SZ);
    sv.root.rotation.y = -0.55;
    scene.add(sv.root);
    if (live.key.target) live.key.target.position.copy(sv.root.position);
    live.rim.target.position.set(1.55, 1.2, SZ);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), new THREE.MeshBasicMaterial({ map: softDot(), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(1.55, 0.012, SZ); scene.add(blob);
    // fake light shafts: from the red lamp, from the lamp over the survivor, through the door's seam
    const shaftTex = shaftTexture();
    live.shafts = [];
    const shaft = (x, y, z, w, h, col, op, ry, rz) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: shaftTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(0, ry || 0, rz || 0); scene.add(m);
      live.shafts.push({ m, op, red: col === 0xff3030 });
      return m;
    };
    // (overhaul, round 8: how many by graphics level -- G.CONFIG.menuScene; the
    // two that matter most first, so Medium's simple version keeps them)
    const MS = G.CONFIG.menuScene, tierN = (o, d) => (o && o[q] != null ? o[q] : d);
    [[0, 3.0, ZD + 1.0, 2.2, 2.6, 0xff3030, 0.16, 0, 0],
      [0.6, 2.4, SZ - 0.6, 1.6, 3.0, 0xffc88a, 0.09, 0.4, 0],
      [0, 3.0, ZD + 1.0, 2.2, 2.6, 0xff3030, 0.12, Math.PI / 2, 0],
      [0.6, 2.4, SZ - 0.6, 1.6, 3.0, 0xffc88a, 0.07, -1.1, 0],
      [0, 1.6, ZD + 1.6, 0.9, 3.2, PAL.orange, 0.1, 0, 0]].slice(0, tierN(MS && MS.shafts, lo ? 0 : 5)).forEach((a) => shaft(...a));
    // dust drifting through them
    const dustN = tierN(MS && MS.dust, q === "vhigh" ? 420 : hi ? 300 : q === "medium" ? 180 : q === "low" ? 90 : 0);
    if (dustN > 0) {
      const n = dustN;
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (R() - 0.5) * 4.5; pos[i * 3 + 1] = 0.2 + R() * 3.8; pos[i * 3 + 2] = 5 - R() * 18;
        seed[i] = R() * 100;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      live.dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot(), color: 0xd8cfc0, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      live.dustSeed = seed; live.dustBase = pos.slice();
      scene.add(live.dust);
    }
    // the low fog: two wide layers drifting slowly over the floor (Medium: one)
    const fogN = tierN(MS && MS.fog, lo ? 0 : 2);
    if (fogN > 0) {
      const ft = fogTexture(R);
      live.fog = [0.25, 0.7].slice(0, fogN).map((y, i) => {
        const tex = ft.clone(); tex.needsUpdate = true; tex.repeat.set(2, 6);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 22), new THREE.MeshBasicMaterial({ map: tex, color: 0x6a7a80, transparent: true, opacity: i ? 0.12 : 0.18, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(0, y, -3); scene.add(m);
        return m;
      });
    }
    // what is heard where (js/mainmenu.js): the fan, the hum of the panels, machinery behind the door, the dark passage
    const sounds = {
      fan: new THREE.Vector3(W / 2, 3.0, -8.5), panel: new THREE.Vector3(-W / 2, 1.5, 1.2), door: new THREE.Vector3(0, 1.6, ZD - 1),
      dark: new THREE.Vector3(-W / 2 - 3, 1.5, -5.5), pipes: new THREE.Vector3(2.4, 3.7, -4), survivor: sv.root.position.clone().setY(1.2),
    };
    const S = { state: "watch", timer: 3, look0: 0, look1: 0, twist: 0, weight: 0, hand: 0, packV: 0, packX: 0 };
    const view = { x: 0, y: 0, tx: 0, ty: 0, cam: new THREE.Vector3(-0.2, 1.68, 7.2), look: new THREE.Vector3(0.2, 1.9, -14) };

    // ---------------- every frame ----------------
    function update(dt, t, motion) {
      // the red lamp: a slow pulse, never a flash
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
      live.red.intensity = 0.7 + 1.6 * pulse * pulse;
      live.lamp.material.color.setRGB(0.55 + 0.45 * pulse, 0.05, 0.05);
      live.shafts.forEach((s) => { if (s.red) s.m.material.opacity = s.op * (0.4 + 0.8 * pulse); });   // (the red lamp's shafts pulse with it)
      // the warm light through the door breathes a little
      const w = 1.3 + Math.sin(t * 0.7) * 0.12 + Math.sin(t * 2.3) * 0.05;
      live.warm.intensity = w;
      // a bulb that flickers now and then (slow, uneven)
      live.lamps.forEach((L) => {
        let k = 1;
        if (L.kind === "flicker") {
          // (overhaul, round 8: Reduce Motion -- the bulb holds steady)
          const steady = G.Access && !G.Access.flicker();
          const f = !steady && Math.sin(t * 0.31) > 0.82 ? (Math.sin(t * 23) > 0.2 ? 0.25 : 1) : 1;
          k = f * (0.88 + 0.12 * Math.sin(t * 5.1));
          if (live.flick) live.flick.intensity = 0.9 * k;
        } else k = 0.93 + 0.07 * Math.sin(t * (L.kind === "cold" ? 0.9 : 1.3) + 1);
        L.bulb.material.color.copy(L.col).multiplyScalar(k);
      });
      if (live.key) live.key.intensity = (live.key.isSpotLight ? 1.7 : 1.1) * (0.95 + 0.05 * Math.sin(t * 1.1));
      live.leds.forEach((L) => { const on = L.blink ? Math.sin(t * L.rate * 6 + L.phase) > 0.2 : 0.8 + 0.2 * Math.sin(t * L.rate + L.phase); L.m.material.color.copy(L.col).multiplyScalar(L.blink ? (on ? 1 : 0.15) : on); });
      if (live.screen) live.screen.material.color.setRGB(0.06, 0.29 + 0.03 * Math.sin(t * 7), 0.27);
      if (live.fan) live.fan.rotation.x -= dt * 2.4;
      // dust drifting
      if (live.dust) {
        const p = live.dust.geometry.attributes.position, b = live.dustBase, s = live.dustSeed;
        for (let i = 0; i < s.length; i++) {
          p.array[i * 3] = b[i * 3] + Math.sin(t * 0.13 + s[i]) * 0.35;
          p.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.09 + s[i] * 1.7) * 0.25 + ((t * 0.03 + s[i]) % 1) * 0.1;
          p.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * 0.11 + s[i]) * 0.3;
        }
        p.needsUpdate = true;
      }
      if (live.fog) live.fog.forEach((m, i) => { m.material.map.offset.set(t * (i ? 0.006 : -0.004), t * (i ? 0.012 : 0.008)); });
      // the survivor's idle
      idle(S, dt, t, R);
      const br = Math.sin(t * 1.55), L = sv.L;
      sv.upper.position.y = 0.1 + br * 0.008;
      sv.upper.scale.set(1 + br * 0.012, 1, 1 + br * 0.018);
      sv.hips.position.x = S.weight * 0.05;
      sv.hips.rotation.z = -S.weight * 0.05;
      sv.upper.rotation.set(0.04 + G.Anim.wobble(t * 0.4, 3) * 0.015, S.twist + G.Anim.wobble(t * 0.25, 5) * 0.03, S.weight * 0.04);
      sv.neck.rotation.set(-S.look1 + G.Anim.wobble(t * 0.6, 7) * 0.02, S.look0 + G.Anim.wobble(t * 0.35, 9) * 0.04, 0);
      // legs: the weight on one, the other knee easing
      L.legL.hp.rotation.z = 0.04 - S.weight * 0.03; L.legR.hp.rotation.z = -0.04 - S.weight * 0.03;
      L.legL.kn.rotation.x = 0.06 + Math.max(0, S.weight) * 0.14; L.legR.kn.rotation.x = 0.06 + Math.max(0, -S.weight) * 0.14;
      L.legL.hp.rotation.x = -Math.max(0, S.weight) * 0.06; L.legR.hp.rotation.x = -Math.max(0, -S.weight) * 0.06;
      // arms: the hands on the rifle; now and then the left one to a strap
      if (sv.grip) {
        reach(L.armR, sv.grip, POLE_R);
        reach(L.armL, _t.copy(sv.fore).lerp(sv.strap, S.hand), POLE_L);
      }
      // the pack trails the body on a spring
      const want = -S.twist * 0.25;
      S.packV += ((want - S.packX) * 40 - S.packV * 7) * dt; S.packX += S.packV * dt;
      sv.pack.rotation.y = S.packX; sv.pack.rotation.x = br * 0.01;
      // the camera: a slow sway and a little parallax (none with Reduce Motion)
      view.x += (view.tx - view.x) * Math.min(1, dt * 2); view.y += (view.ty - view.y) * Math.min(1, dt * 2);
      const m = motion ? 1 : 0;
      camera.position.set(view.cam.x + (Math.sin(t * 0.13) * 0.05 + view.x * 0.18) * m, view.cam.y + (Math.sin(t * 0.17) * 0.03 + view.y * 0.08) * m, view.cam.z);
      camera.lookAt(view.look.x + view.x * 0.4 * m, view.look.y + view.y * 0.2 * m, view.look.z);
    }
    // the frame for this screen: the door in the middle, the survivor to the
    // right of it, room on the left for the menu -- at any aspect
    function fit(w, h) {
      const a = w / Math.max(1, h);
      camera.aspect = a;
      let fov = 48, sx = 1.65, cz = 7.2, cx = -0.2;
      if (a >= 2.05) { fov = 40; sx = 1.85; cz = 7.6; }                   // 19.5:9, 21:9
      else if (a >= 1.7) { fov = 48; sx = 1.55; }                         // 16:9
      else if (a >= 1.45) { fov = 53; sx = 1.4; cz = 7.4; }               // 16:10, 3:2
      else if (a >= 1) { fov = 60; sx = 1.2; cz = 7.8; cx = 0; }           // 4:3 (iPad)
      else { fov = 74; sx = 0.9; cz = 8.2; cx = 0.2; }                     // upright: the menu goes under
      camera.fov = fov;
      // (upright, the menu fills the lower half: the picture shifted up as by a
      // shifted lens, so the door and the survivor stand above it)
      if (a < 1) camera.setViewOffset(w, h, 0, h * 0.2, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      sv.root.position.x = sx; blob.position.x = sx;
      live.rim.target.position.x = sx;
      if (live.key && live.key.target) live.key.target.position.x = sx;
      view.cam.set(cx, 1.68, cz);
      sounds.survivor.x = sx;
    }
    function point(nx, ny) { view.tx = Math.max(-1, Math.min(1, nx)); view.ty = Math.max(-1, Math.min(1, ny)); }
    function dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        // (never what others share: the atlas, the guns' skin)
        ms.forEach((m) => { if (m.userData && m.userData.shared) return; if (m.map && m.map !== atlas && !(m.map.userData && m.map.userData.shared)) m.map.dispose(); m.dispose(); });
      });
    }
    fit(window.innerWidth, window.innerHeight);
    update(0.016, 0, true);
    return { scene, camera, update, fit, point, dispose, sounds, survivor: sv, live };
  }

  // vertex AO: darker near the floor, the walls and the ceiling (the corners
  // and the joins), once, on the merged geometry
  function bakeAO(geo) {
    const p = geo.attributes.position, c = geo.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const dw = W / 2 - Math.abs(x), dc = H - y;
      let ao = 1 - 0.32 * Math.exp(-Math.max(0, y) / 0.35) - 0.3 * Math.exp(-Math.max(0, dw) / 0.3) - 0.22 * Math.exp(-Math.max(0, dc) / 0.45);
      ao = Math.max(0.45, ao);
      c.setXYZ(i, c.getX(i) * ao, c.getY(i) * ao, c.getZ(i) * ao);
    }
    c.needsUpdate = true;
  }

  return { build, PAL };
})();
