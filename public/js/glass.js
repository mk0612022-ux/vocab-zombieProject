// ===================================================================
// Glass (newer list, round 3, H)
// -------------------------------------------------------------------
// The school's rooms have real windows (js/schoolshell.js cuts the openings
// through their outer walls): a pane of pale blue glass in each, dusty,
// streaked with grime at the bottom, some of them cracked and a few already
// holed, with only shards left round the frame. Through a pane you see the
// grounds (from the room) or the dark room behind it (from outside), and the
// moonlight still comes in through them (js/sky.js).
//
//   a round    meets a pane: it breaks -- shards fly the way the round went
//              and fall, with the sound of it -- and the round goes on through
//              (G.Game.raycastShoot); glass never stops a shot, so it never
//              gets in the way of aiming at a zombie behind it
//   a blast    breaks the panes near it (G.Game.splashDamage)
//   a zombie   climbing in at a window breaks its pane as it comes
//              (js/zombiefx.js)
//   walking    nobody walks through a window, broken or not: the opening has
//              a block that stops walking but not rounds (the block's
//              `passShots`, skipped by G.Game.wallDistance)
//
// All the panes are three InstancedMeshes -- clean, cracked, broken -- so a
// building full of windows costs three draw calls; a pane moves from one to
// the next as it breaks. Graphics quality picks the glass: flat and unlit on
// Very Low and Low, lit on Medium, lit and reflecting the night sky (a small
// cube map with the moon in it) on High and Very High. It is drawn after
// everything solid, as transparent things are, and writes no depth, so it
// never hides what is behind it.
// ===================================================================
G.Glass = {
  Q: { vlow: 0, low: 1, medium: 2, high: 3, vhigh: 4 },
  SHARDS: [6, 10, 16, 24, 30],             // shards a breaking pane throws, by quality
  STATES: ["clean", "cracked", "broken"],
  panes: [],
  meshes: null,
  _ray: new THREE.Raycaster(),

  reset() {
    if (this.meshes) Object.values(this.meshes).forEach((m) => { if (m.parent) m.parent.remove(m); m.geometry.dispose(); });
    if (this.shards && this.shards.mesh.parent) { this.shards.mesh.parent.remove(this.shards.mesh); this.shards.mesh.geometry.dispose(); }
    this.panes = []; this.meshes = null; this.shards = null; this.game = null;
  },

  build(game) {
    this.reset();
    const world = game.world, list = world.realWindows || [];
    if (!list.length) return;
    this.game = game;
    world.noMerge = world.noMerge || [];
    const R = G.makeRng(1717);
    const N = list.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.meshes = {};
    this.STATES.forEach((st) => {
      const m = new THREE.InstancedMesh(geo.clone(), this.material(st, G.save.settings.graphicsQuality), N);
      m.frustumCulled = false;                 // (the panes are all over the building: drawn always, as one call)
      m.renderOrder = 2;
      m.castShadow = false;
      m.userData.glass = st;
      game.scene.add(m);
      world.noMerge.push(m);
      this.meshes[st] = m;
    });
    geo.dispose();
    // each pane: most clean, some cracked, a few already holed
    this.panes = list.map((w, i) => {
      const r = R();
      const pane = { i, win: w, x: w.x, z: w.z, base: w.base, s: w.s, y: (w.y0 + w.y1) / 2, w: w.w - 0.06, h: w.y1 - w.y0 - 0.06,
        state: r < 0.7 ? "clean" : r < 0.88 ? "cracked" : "broken" };
      w.pane = pane;
      return pane;
    });
    this.panes.forEach((p) => this.place(p));
    this.buildShards(game);
  },

  // a pane shown in the mesh of its state, hidden in the others
  place(p) {
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion());
    const up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
    q.setFromAxisAngle(up, p.s > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.STATES.forEach((st) => {
      const m = this.meshes[st];
      if (st === p.state) m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.w, p.h, 1));
      else m4.makeScale(0, 0, 0);
      m.setMatrixAt(p.i, m4);
      m.instanceMatrix.needsUpdate = true;
    });
  },

  // ---------------------------------------------------------- the look ----
  material(state, quality) {
    const q = this.Q[quality] != null ? this.Q[quality] : 2;
    const map = this.texture(state);
    const o = { map, transparent: true, depthWrite: false, side: THREE.DoubleSide };
    let m;
    if (q <= 1) m = new THREE.MeshBasicMaterial(o);
    else if (q === 2 && !G.VISUAL) m = new THREE.MeshLambertMaterial(o);
    else if (G.VISUAL) {
      // (visual series, C) glass reflects the night sky (js/visuals.js's environment map)
      const g = G.VISUAL.materials.glass;
      m = new THREE.MeshStandardMaterial(Object.assign(o, { roughness: g.roughness, metalness: g.metalness, envMapIntensity: g.env }));
      m.userData.vzEnv = true;
      if (G.Visuals && G.Visuals._env) m.envMap = G.Visuals._env;
    }
    else m = new THREE.MeshPhongMaterial(Object.assign(o, { envMap: this.sky(), reflectivity: 0.5, combine: THREE.MixOperation, specular: 0x8aa8c8, shininess: 90 }));
    m.userData.quality = q;
    return m;
  },
  applyQuality(quality) {
    if (!this.meshes) return;
    this.STATES.forEach((st) => {
      const m = this.meshes[st], old = m.material;
      const q = this.Q[quality] != null ? this.Q[quality] : 2;
      if (old.userData.quality === q) return;
      m.material = this.material(st, quality);
      old.dispose();
    });
  },
  // the three looks, drawn once: RGBA, the alpha being how much of the glass
  // shows at each spot
  texture(state) {
    this._tex = this._tex || {};
    if (this._tex[state]) return this._tex[state];
    const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"), R = G.makeRng(state === "clean" ? 11 : state === "cracked" ? 12 : 13);
    const glassBody = () => {
      c.fillStyle = "rgba(190,222,245,0.2)"; c.fillRect(0, 0, S, S);
      // a sheen across it, two streaks
      const g = c.createLinearGradient(0, 0, S, S);
      g.addColorStop(0.22, "rgba(255,255,255,0)"); g.addColorStop(0.34, "rgba(235,245,255,0.2)"); g.addColorStop(0.42, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(0.54, "rgba(235,245,255,0.12)"); g.addColorStop(0.58, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      // grime at the bottom and in the corners, dust all over
      const b = c.createLinearGradient(0, S * 0.55, 0, S);
      b.addColorStop(0, "rgba(120,110,90,0)"); b.addColorStop(1, "rgba(110,100,80,0.42)");
      c.fillStyle = b; c.fillRect(0, S * 0.55, S, S * 0.45);
      [[0, 0], [S, 0], [0, S], [S, S]].forEach(([x, y]) => {
        const r = c.createRadialGradient(x, y, 0, x, y, S * 0.35);
        r.addColorStop(0, "rgba(100,95,80,0.35)"); r.addColorStop(1, "rgba(100,95,80,0)");
        c.fillStyle = r; c.fillRect(0, 0, S, S);
      });
      for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(215,205,185,${(0.12 + R() * 0.25).toFixed(2)})`; const d = 1 + R() * 2.2; c.fillRect(R() * S, R() * S, d, d); }
      // rain has run down it
      for (let i = 0; i < 14; i++) {
        const x = R() * S, y0 = R() * S * 0.5, len = S * (0.2 + R() * 0.5);
        c.strokeStyle = `rgba(150,140,120,${(0.08 + R() * 0.1).toFixed(2)})`; c.lineWidth = 1 + R() * 2;
        c.beginPath(); c.moveTo(x, y0); c.lineTo(x + (R() - 0.5) * 8, y0 + len); c.stroke();
      }
    };
    if (state !== "broken") glassBody();
    if (state === "cracked") {
      // a star of cracks from where something hit it, and rings round it
      const hits = 1 + Math.floor(R() * 2);
      for (let h = 0; h < hits; h++) {
        const cx = S * (0.25 + R() * 0.5), cy = S * (0.25 + R() * 0.5);
        c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 1.4;
        const arms = 9 + Math.floor(R() * 5), ends = [];
        for (let k = 0; k < arms; k++) {
          let a = k / arms * Math.PI * 2 + R() * 0.3, x = cx, y = cy;
          const len = S * (0.2 + R() * 0.45);
          c.beginPath(); c.moveTo(x, y);
          for (let d = 0; d < len; d += 12) { a += (R() - 0.5) * 0.35; x += Math.cos(a) * 12; y += Math.sin(a) * 12; c.lineTo(x, y); }
          c.stroke();
          ends.push(a);
        }
        c.lineWidth = 1;
        [0.08, 0.16].forEach((rr) => {
          c.beginPath();
          for (let k = 0; k <= arms; k++) { const a = k / arms * Math.PI * 2, r = S * rr * (0.8 + R() * 0.4); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
          c.stroke();
        });
        c.fillStyle = "rgba(255,255,255,0.7)"; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();
      }
    }
    if (state === "broken") {
      // only jagged shards still stuck in the frame; the middle is gone
      const edge = (x0, y0, x1, y1, nx, ny) => {
        let t = 0;
        while (t < 1) {
          const t1 = Math.min(1, t + 0.08 + R() * 0.18), tm = (t + t1) / 2, depth = S * (0.06 + R() * 0.26);
          const ax = x0 + (x1 - x0) * t, ay = y0 + (y1 - y0) * t, bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
          const px = x0 + (x1 - x0) * tm + nx * depth, py = y0 + (y1 - y0) * tm + ny * depth;
          c.fillStyle = `rgba(196,224,242,${(0.28 + R() * 0.2).toFixed(2)})`;
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(px, py); c.lineTo(bx, by); c.closePath(); c.fill();
          c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(px, py); c.lineTo(bx, by); c.stroke();
          t = t1;
        }
      };
      edge(0, 0, S, 0, 0, 1); edge(S, 0, S, S, -1, 0); edge(S, S, 0, S, 0, -1); edge(0, S, 0, 0, 1, 0);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 2;
    return (this._tex[state] = tex);
  },
  // the night sky the glass reflects: dark blue, lighter low down, the moon
  // in the west-south-west (js/sky.js)
  sky() {
    if (this._sky) return this._sky;
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const S = 64, cv = document.createElement("canvas"); cv.width = cv.height = S;
      const c = cv.getContext("2d");
      const top = f === 2, bottom = f === 3;
      const g = c.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, top ? "#0c1230" : bottom ? "#0a0c0e" : "#141a3a");
      g.addColorStop(1, top ? "#0c1230" : bottom ? "#050607" : "#2a2e44");
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      // (-x and +z: the faces towards the moon)
      if (f === 1 || f === 4) {
        const x = f === 1 ? S * 0.7 : S * 0.25, y = S * 0.3;
        const r = c.createRadialGradient(x, y, 0, x, y, S * 0.4);
        r.addColorStop(0, "rgba(235,240,255,1)"); r.addColorStop(0.12, "rgba(210,220,255,0.8)"); r.addColorStop(1, "rgba(150,170,255,0)");
        c.fillStyle = r; c.fillRect(0, 0, S, S);
      }
      faces.push(cv);
    }
    const cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    return (this._sky = cube);
  },

  // --------------------------------------------------------- breaking ----
  // a round from `origin` along `dir`, as far as `far` (the first wall):
  // every pane it passes through breaks (the round goes on)
  onShot(origin, dir, far) {
    if (!this.meshes) return 0;
    const ray = this._ray;
    ray.set(origin, dir); ray.far = far; ray.near = 0;
    const hits = ray.intersectObjects([this.meshes.clean, this.meshes.cracked], false);
    let n = 0;
    hits.forEach((h) => {
      const p = this.panes[h.instanceId];
      // (a pane is hidden -- scaled to nothing -- in the meshes of its other states)
      if (p && h.object.userData.glass === p.state && this.breakPane(p, dir, false, h.point)) n++;
    });
    return n;
  },
  // a blast: every pane within reach
  splash(point, r) {
    if (!this.meshes) return;
    this.panes.forEach((p) => {
      if (p.state === "broken") return;
      const d = Math.hypot(p.x - point.x, p.y - point.y, p.z - point.z);
      if (d < r + 0.8) this.breakPane(p, new THREE.Vector3(p.x - point.x, 0, p.z - point.z).normalize(), false);
    });
  },
  // a zombie's window (js/zombiefx.js): true if there was glass to break
  breakWindow(win, dir, quiet) {
    const p = win.pane || this.panes.find((q) => q.win === win || (q.win && q.win.win === win));
    return p ? this.breakPane(p, dir || new THREE.Vector3(-p.s, 0, 0), quiet) : false;
  },
  breakPane(p, dir, quiet, at) {
    if (p.state === "broken") return false;
    p.state = "broken";
    this.place(p);
    const c = at ? at.clone() : new THREE.Vector3(p.x, p.y, p.z);
    this.throwShards(p, c, dir);
    // (`quiet`: the caller makes the sound itself -- a zombie coming in)
    if (!quiet && G.Audio) G.Audio.sfx("glass_break", { pos: c });
    if (G.Details && G.Details.onShot) G.Details.onShot(c);        // (the crows hear it)
    return true;
  },

  // ---------------------------------------------------------- shards ----
  buildShards(game) {
    const N = 160;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-0.05, -0.03, 0, 0.06, -0.04, 0, 0.0, 0.07, 0], 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfe6f4, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    game.scene.add(mesh);
    game.world.noMerge.push(mesh);
    this.shards = { mesh, items: Array.from({ length: N }, () => ({ alive: false })), next: 0 };
  },
  throwShards(p, at, dir) {
    const S = this.shards;
    if (!S) return;
    const q = this.Q[G.save.settings.graphicsQuality] != null ? this.Q[G.save.settings.graphicsQuality] : 2;
    const n = this.SHARDS[q];
    const d = dir ? dir.clone().setY(0) : new THREE.Vector3(-p.s, 0, 0);
    if (d.lengthSq() < 1e-6) d.set(-p.s, 0, 0);
    d.normalize();
    for (let k = 0; k < n; k++) {
      const it = S.items[S.next]; S.next = (S.next + 1) % S.items.length;
      const along = (Math.random() - 0.5) * p.w, up = (Math.random() - 0.5) * p.h;
      const sp = 1.5 + Math.random() * 3.5;
      Object.assign(it, {
        alive: true, t: 0, rest: 0, floor: p.base + 0.01,
        x: p.x, y: at.y + up * 0.6, z: p.z + along * 0.8,
        vx: d.x * sp + (Math.random() - 0.5) * 1.5, vy: 0.5 + Math.random() * 2, vz: d.z * sp + (Math.random() - 0.5) * 1.5,
        rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18,
        s: 0.6 + Math.random() * 1.2,
      });
    }
  },
  update(dt) {
    const S = this.shards;
    if (!S || !dt) return;
    const m4 = this._sm || (this._sm = new THREE.Matrix4()), e = this._se || (this._se = new THREE.Euler()), q = this._sq || (this._sq = new THREE.Quaternion());
    const v = this._sv || (this._sv = new THREE.Vector3()), sc = this._ss || (this._ss = new THREE.Vector3());
    let top = 0;
    S.items.forEach((it, i) => {
      if (!it.alive) return;
      it.t += dt;
      if (it.rest > 0) {
        it.rest -= dt;
        if (it.rest <= 0) { it.alive = false; return; }
      } else {
        it.vy -= 14 * dt;
        it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
        it.rx += it.wx * dt; it.ry += it.wy * dt;
        if (it.y <= it.floor) { it.y = it.floor; it.rest = 2 + Math.random() * 2; it.rx = -Math.PI / 2; }
      }
      top = Math.max(top, i + 1);
    });
    // (the live ones are packed at the front: `count` draws only those)
    let n = 0;
    S.items.forEach((it) => {
      if (!it.alive) return;
      const k = it.rest > 0 ? Math.min(1, it.rest) : 1;
      e.set(it.rx, it.ry, 0); q.setFromEuler(e); v.set(it.x, it.y, it.z); sc.set(it.s * k, it.s * k, it.s * k);
      S.mesh.setMatrixAt(n++, m4.compose(v, q, sc));
    });
    S.mesh.count = n;
    if (n) S.mesh.instanceMatrix.needsUpdate = true;
  },
};
