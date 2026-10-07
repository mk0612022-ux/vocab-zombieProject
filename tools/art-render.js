// Dev-only (not shipped). Renders the lobby's artwork (round 4) from the
// game's own levels: each mode's scene built as in play, a survivor and a
// few zombies posed in it, a camera placed by hand, a little extra light, and
// the frame saved as a JPEG into public/assets/lobby/ by the localhost receiver
// (tools/art-receiver.ps1, port 8092). Two sizes a mode: the 16:9
// preview and the portrait card.
//   await G.ArtRender.all()        -> list of files written
//   await G.ArtRender.shot("school", "preview")
//   await G.ArtRender.boot()       -> (new series, round 2) the Loading
//                                     screen's two pictures and where their
//                                     words go (for js/boot.js), and the
//                                     Start screen's horde (public/assets/boot/)
window.G = window.G || {};
G.ArtRender = {
  PORT: 8092,
  SIZES: { preview: [1280, 720], card: [480, 720] },

  // a survivor: jeans, a jacket, a backpack, a rifle at the shoulder
  survivor(scene, x, y, z, yaw, weapon, jacket) {
    const g = new THREE.Group();
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    const box = (p, w, h, d, m, px, py, pz, rx, ry, rz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); b.rotation.set(rx || 0, ry || 0, rz || 0); p.add(b); return b; };
    const skin = L(0xd8a07a), jeans = L(0x2c3a58), jack = L(jacket || 0x5a6a3a), dark = L(0x1c1c1e), hair = L(0x1a1410), bag = L(0x6a4a2a);
    // legs: a firm stance, one foot forward
    [[-0.13, 0.12], [0.13, -0.16]].forEach(([lx, lz]) => { box(g, 0.2, 0.8, 0.22, jeans, lx, 0.44, lz, lz * 0.8, 0, 0); box(g, 0.21, 0.1, 0.32, dark, lx, 0.05, lz + 0.05); });
    const up = new THREE.Group(); up.position.y = 0.86; up.rotation.x = 0.12; g.add(up);
    box(up, 0.52, 0.68, 0.3, jack, 0, 0.34, 0);
    box(up, 0.4, 0.5, 0.2, bag, 0, 0.36, 0.25);                       // the backpack
    box(up, 0.44, 0.08, 0.16, bag, 0, 0.64, 0.12);
    const head = new THREE.Group(); head.position.set(0, 0.78, -0.02); up.add(head);
    box(head, 0.3, 0.32, 0.3, skin, 0, 0.14, 0);
    box(head, 0.32, 0.1, 0.32, hair, 0, 0.31, 0.02); box(head, 0.32, 0.22, 0.1, hair, 0, 0.19, 0.13);
    // arms up at the gun: right hand on the grip, left under the barrel
    const arm = (side, rx, rz, fx) => {
      const s = new THREE.Group(); s.position.set(side * 0.33, 0.6, 0); s.rotation.set(rx, 0, rz); up.add(s);
      box(s, 0.16, 0.34, 0.16, jack, 0, -0.16, 0);
      const e = new THREE.Group(); e.position.y = -0.32; e.rotation.x = fx; s.add(e);
      box(e, 0.14, 0.3, 0.14, jack, 0, -0.14, 0); box(e, 0.13, 0.1, 0.13, skin, 0, -0.32, 0);
    };
    arm(1, -1.2, 0.25, -0.9);
    arm(-1, -1.45, -0.35, -0.35);
    if (weapon && G.WEAPON_DEFS[weapon]) {
      const gun = G.buildWeaponMesh(G.WEAPON_DEFS[weapon]);
      gun.scale.setScalar(1.25);
      gun.position.set(0.14, 0.56, -0.5); gun.rotation.set(0.02, 0.04, 0);
      up.add(gun);
    }
    g.position.set(x, y, z); g.rotation.y = yaw;
    scene.add(g);
    return g;
  },

  // a zombie of this level's wardrobe, mid-stride, facing (tx, tz)
  zombie(game, type, x, z, tx, tz, phase, target, floorY) {
    const pair = G.pick(game.wordPool);
    const zb = new G.Zombie(type, new THREE.Vector3(x, 0, z), pair, game.level.theme);
    zb.mesh.position.y = G.getFloorHeightAt(game.world, x, z, (floorY || 0) + 0.5);
    zb.mesh.rotation.y = Math.atan2(tx - x, tz - z);
    game.scene.add(zb.mesh);
    for (let i = 0; i < 20 + Math.round((phase || 0) * 30); i++) zb.animate(1 / 30, 0.05);
    zb.setTarget(!!target);
    return zb;
  },

  // warm key light and a cool rim, only for the picture
  lights(scene, key, rim) {
    const out = [];
    const k = new THREE.PointLight(0xffc890, 1.5, 16); k.position.copy(key); scene.add(k); out.push(k);
    const r = new THREE.PointLight(0x8aa8ff, 1.3, 20); r.position.copy(rim); scene.add(r); out.push(r);
    const h = new THREE.HemisphereLight(0x8aa0c8, 0x2a2418, 0.18); scene.add(h); out.push(h);
    return out;
  },

  SHOTS: {
    // the front of the school at dusk, from just inside the gate
    school(A, g) {
      A.stage(1);
      A.survivor(g.scene, 1.4, 0, 47.4, 0.3, "hall_monitor");
      A.zombie(g, "normal", -0.6, 43.6, 1.4, 47.4, 0.1, true);
      A.zombie(g, "fast", 2.6, 42.4, 1.4, 47.4, 0.5);
      A.zombie(g, "normal", -3.4, 41.6, 1.4, 47.4, 0.8);
      A.zombie(g, "crawler", 0.9, 44.9, 1.4, 47.4, 0.3);
      A.zombie(g, "normal", 4.6, 40.6, 1.4, 47.4, 0.6);
      A.zombie(g, "normal", -1.2, 39.4, 1.4, 47.4, 0.4);
      A.lights(g.scene, new THREE.Vector3(4, 2.6, 46), new THREE.Vector3(-2, 3.5, 39));
      return { pos: new THREE.Vector3(4.6, 2.05, 50.6), look: new THREE.Vector3(-0.6, 1.5, 41.5), fov: 50 };
    },
    // the hospital's entry hall
    hospital(A, g) {
      A.stage(2);
      // (the first ward corridor, looking deeper in)
      A.survivor(g.scene, 0.9, 0, 14.6, 0.08, "iv_repeater", 0x3a5a6a);
      A.zombie(g, "normal", -1.2, 10.4, 0.9, 14.6, 0.2, true);
      A.zombie(g, "normal", 1.8, 9.0, 0.9, 14.6, 0.6);
      A.zombie(g, "fast", -0.2, 7.4, 0.9, 14.6, 0.4);
      A.zombie(g, "normal", -2.4, 6.4, 0.9, 14.6, 0.9);
      A.zombie(g, "normal", 2.6, 5.8, 0.9, 14.6, 0.5);
      A.lights(g.scene, new THREE.Vector3(2.2, 2.6, 15.5), new THREE.Vector3(-1.5, 3, 7));
      return { pos: new THREE.Vector3(2.7, 1.9, 17.6), look: new THREE.Vector3(-0.6, 1.3, 5), fov: 56 };
    },
    // a bunker corridor under red light
    bunker(A, g) {
      A.stage(3);
      A.survivor(g.scene, 0.6, 0, 8.5, 0.05, "vent_ripper", 0x4a4a3a);
      A.zombie(g, "normal", -0.8, 2.5, 0.6, 8.5, 0.2, true);
      A.zombie(g, "fast", 1.2, 0.8, 0.6, 8.5, 0.5);
      A.zombie(g, "normal", -1.4, -2.5, 0.6, 8.5, 0.7);
      A.zombie(g, "normal", 1.6, -4.5, 0.6, 8.5, 0.1);
      A.lights(g.scene, new THREE.Vector3(1.5, 2.5, 7), new THREE.Vector3(-1.5, 3, -2));
      return { pos: new THREE.Vector3(1.9, 1.55, 11.6), look: new THREE.Vector3(-0.3, 1.5, 0), fov: 56 };
    },
    // endless: the bunker's reactor hall, a crowd closing in
    endless(A, g) {
      A.stage(3);
      // (inside the boss hall: its doors stay shut outside a boss wave)
      const cz = g.world.bossRoomCenter.z;
      A.survivor(g.scene, 0.5, 0, cz + 6.0, 0, "siege_slug", 0x4a3a5a);
      const ring = [[-4, 1.5], [-2.2, 0.2], [0, -0.8], [2.4, 0.5], [4.2, 1.8], [-5.6, -1.6], [5.8, -1.2], [-1.2, -3.2], [1.6, -3.4], [-3.4, -3.8], [3.6, -3.9]];
      ring.forEach(([dx, dz], i) => A.zombie(g, i % 4 === 1 ? "fast" : "normal", dx, cz + dz, 0.5, cz + 6.0, i * 0.13, i === 2));
      A.lights(g.scene, new THREE.Vector3(2, 3, cz + 5), new THREE.Vector3(0, 4, cz - 3));
      return { pos: new THREE.Vector3(2.4, 2.3, cz + 9.2), look: new THREE.Vector3(-0.3, 1.2, cz - 1.5), fov: 60 };
    },
    // daily: dusk over the football field, the field sala behind
    daily(A, g) {
      A.stage(1);
      A.survivor(g.scene, -40, 0, -1.5, 0.63, "pop_quiz", 0x7a4a2a);
      A.zombie(g, "normal", -43, -6.5, -40, -1.5, 0.2, true);
      A.zombie(g, "fast", -45.5, -9, -40, -1.5, 0.6);
      A.zombie(g, "normal", -41.2, -10.5, -40, -1.5, 0.4);
      A.zombie(g, "crawler", -44.2, -3.8, -40, -1.5, 0.8);
      A.zombie(g, "normal", -47.5, -5, -40, -1.5, 0.3);
      A.zombie(g, "normal", -48.5, -11.5, -40, -1.5, 0.7);
      A.lights(g.scene, new THREE.Vector3(-38, 3, 0), new THREE.Vector3(-45, 4, -10));
      return { pos: new THREE.Vector3(-35.6, 2.7, 3.0), look: new THREE.Vector3(-45, 1.0, -9.5), fov: 54 };
    },
    // practice: a classroom, its board full of new words, one zombie at the door
    practice(A, g) {
      A.stage(1);
      A.survivor(g.scene, -8.4, 0, 11.4, -1.35, "pistol", 0x2a4a7a);
      A.zombie(g, "normal", -4.4, 13.5, -8.4, 11.4, 0.3, true);
      A.lights(g.scene, new THREE.Vector3(-10, 2.8, 12), new THREE.Vector3(-5, 2.6, 15));
      return { pos: new THREE.Vector3(-10.8, 1.65, 9.1), look: new THREE.Vector3(-4.8, 1.55, 14.4), fov: 60 };
    },
    // custom vocabulary: the library, a zombie at the end of the aisle
    custom(A, g) {
      A.stage(1);
      // down the reading tables, the shelf ends on the right
      A.survivor(g.scene, -4.9, 4.2, 16.6, 0.12, "honor_roll", 0x6a3a5a);
      A.zombie(g, "normal", -6.6, 12.2, -4.9, 16.6, 0.2, true, 4.2);
      A.zombie(g, "fast", -5.4, 9.8, -4.9, 16.6, 0.6, false, 4.2);
      A.zombie(g, "normal", -7.2, 7.8, -4.9, 16.6, 0.4, false, 4.2);
      A.lights(g.scene, new THREE.Vector3(-4.6, 6.8, 17), new THREE.Vector3(-7, 6.8, 9));
      return { pos: new THREE.Vector3(-5.9, 5.9, 19.3), look: new THREE.Vector3(-6.0, 5.0, 3), fov: 56 };
    },
  },

  stage(level) {
    const g = G.Game;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = "vhigh";
    g.startLevel(level);
    g.update = function () {};
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    G.UI.setHudVisible(false); G.UI.setTouchControlsVisible(false); G.UI.showScreen(null);
    G.Modal.reset();
  },

  async shot(name, kind) {
    const cam = this.SHOTS[name](this, G.Game);
    return this.render(name, cam, kind);
  },
  async render(name, cam, kind) {
    const g = G.Game;
    const [W, H] = this.SIZES[kind];
    const r = g.renderer, camera = g.camera;
    const prevVm = g.vmCamera; g.vmCamera = null;
    const prevSize = new THREE.Vector2(); r.getSize(prevSize);
    const prevPR = r.getPixelRatio(), prevFov = camera.fov, prevAspect = camera.aspect;
    // the player rig stands where the camera is, so the zone culling and
    // the light pool pick for this view
    g.yawObject.position.copy(cam.pos);
    const dir = cam.look.clone().sub(cam.pos);
    g.yawObject.rotation.y = Math.atan2(-dir.x, -dir.z);
    g.pitchObject.rotation.x = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    const portrait = kind === "card";
    camera.fov = portrait ? cam.fov * 1.25 : cam.fov;
    r.setPixelRatio(1); r.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    g.scene.updateMatrixWorld(true);
    G.Zones.update(g, true);
    G.Perf.updateLights(cam.pos, dir.clone().setY(0).normalize(), 1);
    if (G.Details) G.Details.update(g, 0.016);
    g.zombies.forEach((z) => z.mesh.updateMatrixWorld(true));
    g.renderFrame();
    const url = r.domElement.toDataURL("image/jpeg", portrait ? 0.84 : 0.86);
    r.setPixelRatio(prevPR); r.setSize(prevSize.x, prevSize.y, false);
    camera.fov = prevFov; camera.aspect = prevAspect; camera.updateProjectionMatrix();
    g.vmCamera = prevVm;
    const file = name + (portrait ? "-card" : "") + ".jpg";
    await fetch("http://localhost:" + this.PORT + "/?name=" + file, { method: "POST", body: url, mode: "no-cors" });
    return { file, bytes: Math.round(url.length * 0.75) };
  },

  // ---------------- the Loading and Start screens (new series, round 2, D/E) ----------------
  // Loading: a horde in front of the school, facing the camera, two sizes --
  // the big screen 16:9, a phone 2.16:1 -- as WebP of at most ~500 KB, and
  // where each zombie's word goes on the picture (its label's anchor, as a
  // share of the width and height, and a size by how near it is) for
  // js/boot.js, which writes words from the bank there each time.
  BOOT: {
    port: 8092,
    sizes: { large: [1920, 1080], small: [1600, 740] },
    cam: { pos: [0, 1.85, 56.4], look: [0, 1.25, 46], fov: 46 },
    // [type, x, z, stride phase]
    horde: [["normal", -1.3, 51.0, 0.2], ["fast", 1.6, 50.6, 0.6], ["normal", -3.8, 49.6, 0.8], ["normal", 0.2, 49.2, 0.1], ["normal", 3.7, 49.5, 0.5],
      ["normal", -6.2, 48.2, 0.4], ["fast", -2.1, 47.7, 0.7], ["normal", 2.0, 47.6, 0.2], ["normal", 6.0, 48.0, 0.9], ["normal", -8.2, 46.7, 0.3],
      ["normal", -4.2, 46.1, 0.6], ["crawler", -0.3, 50.4, 0.5], ["normal", 4.3, 46.2, 0.8], ["normal", 8.4, 46.8, 0.15], ["normal", 0.1, 45.4, 0.45]],
    // Start: the horde alone, from low down, lit green from the sides, on a
    // transparent background (cropped to it)
    hero: { size: [2000, 1300], cam: [0.8, 0.32, 6.2], look: [0, 1.4, -1], fov: 40,
      z: [["normal", 0, 0.2, 0.3], ["normal", -1.35, -0.7, 0.7], ["fast", 1.45, -0.5, 0.5], ["normal", -2.6, -1.9, 0.1], ["normal", 0.4, -2.0, 0.9], ["normal", 2.7, -1.8, 0.2],
        ["crawler", -0.7, 1.35, 0.6], ["normal", -1.3, -3.4, 0.4], ["normal", 1.7, -3.6, 0.8], ["normal", -3.9, -3.3, 0.55], ["normal", 3.9, -3.2, 0.35]] },
  },
  async post(name, url) {
    await fetch("http://localhost:" + this.BOOT.port + "/?name=" + name, { method: "POST", body: url, mode: "no-cors" });
    return { file: name, kb: Math.round(url.length * 0.75 / 1024) };
  },
  // -> { large: {w, h, heads: [[x, y, s], ...]}, small: {...}, files }
  async bootLoading() {
    const g = G.Game, B = this.BOOT, V = THREE.Vector3;
    this.stage(1);
    const cam = { pos: new V(...B.cam.pos), look: new V(...B.cam.look), fov: B.cam.fov };
    const zs = B.horde.map(([type, x, z, ph]) => {
      const zb = this.zombie(g, type, x, z, cam.pos.x, cam.pos.z, ph);
      zb.sprite.visible = false;
      g.zombies.push(zb);
      return zb;
    });
    G.PlayerBody.setVisible(false);
    const out = { files: [] };
    for (const kind of ["large", "small"]) {
      const [W, H] = B.sizes[kind];
      const r = g.renderer, camera = g.camera;
      const prevVm = g.vmCamera; g.vmCamera = null;
      const prevSize = new THREE.Vector2(); r.getSize(prevSize);
      const prevPR = r.getPixelRatio(), prevFov = camera.fov, prevAspect = camera.aspect;
      g.yawObject.position.copy(cam.pos);
      const dir = cam.look.clone().sub(cam.pos);
      g.yawObject.rotation.y = Math.atan2(-dir.x, -dir.z);
      g.pitchObject.rotation.x = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      camera.fov = cam.fov; r.setPixelRatio(1); r.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      g.scene.updateMatrixWorld(true);
      G.Zones.update(g, true);
      G.Perf.updateLights(cam.pos, dir.clone().setY(0).normalize(), 1);
      if (G.Details) G.Details.update(g, 0.016);
      g.renderFrame();
      const url = r.domElement.toDataURL("image/webp", kind === "large" ? 0.8 : 0.78);
      // each word's place: its label's anchor on the picture, the nearer the larger
      const heads = zs.map((z) => {
        const p = z.sprite.getWorldPosition(new V());
        const d = p.distanceTo(camera.getWorldPosition(new V()));
        p.project(camera);
        return [+((p.x + 1) / 2).toFixed(4), +((1 - p.y) / 2).toFixed(4), +(6 / d).toFixed(3)];
      }).filter(([x, y]) => x > 0.02 && x < 0.98 && y > 0.02 && y < 0.98).sort((a, b) => b[2] - a[2]);
      out[kind] = { w: W, h: H, heads };
      out.files.push(await this.post("boot/loading-" + kind + ".webp", url));
      r.setPixelRatio(prevPR); r.setSize(prevSize.x, prevSize.y, false);
      camera.fov = prevFov; camera.aspect = prevAspect; camera.updateProjectionMatrix();
      g.vmCamera = prevVm;
    }
    G.PlayerBody.setVisible(true);
    return out;
  },
  async bootStart() {
    const H0 = this.BOOT.hero, [W, H] = H0.size;
    const scene = new THREE.Scene();
    H0.z.forEach(([type, x, z, ph]) => {
      const zb = new G.Zombie(type, new THREE.Vector3(x, 0, z), G.pick(G.WORDS_LEVEL_1), "school");
      zb.mesh.rotation.y = Math.atan2(H0.cam[0] - x, H0.cam[2] - z);
      for (let i = 0; i < 20 + Math.round((ph || 0) * 30); i++) zb.animate(1 / 30, 0.05);
      zb.sprite.visible = false;
      scene.add(zb.mesh);
    });
    scene.add(new THREE.HemisphereLight(0x8aa4b8, 0x0c140e, 0.32));
    const key = new THREE.DirectionalLight(0xd8e4ff, 0.75); key.position.set(-2, 5, 9); scene.add(key);
    [[-7, 2.5, -1, 0x34e07a], [7, 2.5, -1, 0x52ff8f]].forEach(([x, y, z, c]) => { const l = new THREE.DirectionalLight(c, 1.5); l.position.set(x, y, z); scene.add(l); });
    const top = new THREE.DirectionalLight(0x7dffb0, 0.5); top.position.set(0, 8, -4); scene.add(top);
    const cam = new THREE.PerspectiveCamera(H0.fov, W / H, 0.1, 100);
    cam.position.set(...H0.cam); cam.lookAt(...H0.look);
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
    scene.updateMatrixWorld(true);
    r.render(scene, cam);
    // cropped to what is drawn, with a little room for the glow
    const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
    const x2 = c2.getContext("2d"); x2.drawImage(r.domElement, 0, 0);
    r.dispose();
    const d = x2.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = 0, maxY = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    const m = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
    minX = Math.max(0, minX - m); minY = Math.max(0, minY - m); maxX = Math.min(W - 1, maxX + m); maxY = Math.min(H - 1, maxY + m);
    const out = document.createElement("canvas"); out.width = maxX - minX + 1; out.height = maxY - minY + 1;
    out.getContext("2d").drawImage(c2, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return Object.assign(await this.post("boot/start-horde.webp", out.toDataURL("image/webp", 0.86)), { w: out.width, h: out.height });
  },
  async boot() {
    const saved = JSON.stringify(G.save), upd = G.Game.update;
    try { return { loading: await this.bootLoading(), start: await this.bootStart() }; }
    finally { G.save = JSON.parse(saved); G.persist(); G.Game.update = upd; G.Game.quitToMainMenu(); }
  },

  async all(names, kinds) {
    const out = [];
    const saved = JSON.stringify(G.save);
    const upd = G.Game.update;
    try {
      for (const n of names || Object.keys(this.SHOTS)) {
        const cam = this.SHOTS[n](this, G.Game);
        for (const k of kinds || ["preview", "card"]) out.push(await this.render(n, cam, k));
      }
    } finally {
      G.save = JSON.parse(saved); G.persist();
      G.Game.update = upd;
      G.Game.quitToMainMenu();
    }
    return out;
  },
};
