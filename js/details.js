// ===================================================================
// Small details (round 3, G3) -- and the grass giving way (G1)
// -------------------------------------------------------------------
// The things that make the school feel abandoned rather than empty:
//   leaves      letting go of the trees near you and spiralling down
//   paper       sheets lying about outside; a gust picks one up, tumbles it
//               along and drops it again
//   crows       sitting on the fence posts, the goal, the stand, the sala
//               ridges; they take off cawing when you come close or fire a
//               shot, and come back later somewhere else
//   puddles     standing water on the paths, in the fountain and on the
//               toilet floor, dark and glossy with the sky in them
//   light       shafts under the lamps that still work, and through the
//               entry hall's front windows, with the dust hanging in them
//   curtains    torn ones at some windows and round the sick-bay beds,
//               moving in the draught
//   grass       bends away from the player and the zombies near them
//
// All of it is pooled or baked (one InstancedMesh a kind, a few merged
// meshes), none of it collides, and every part of it thins out or switches
// off with the graphics quality, live (applyQuality).
// ===================================================================
G.Details = {
  // how much of each, by quality: vlow, low, medium, high, vhigh
  COUNTS: {
    leaves: [0, 0, 30, 60, 90],
    paper: [0, 4, 7, 10, 14],
    crows: [0, 4, 6, 8, 10],
    benders: [0, 1, 4, 6, 6],
  },
  Q: { vlow: 0, low: 1, medium: 2, high: 3, vhigh: 4 },
  WIND: new THREE.Vector3(0.86, 0, 0.5),

  build(game) {
    this.reset();
    const world = game.world;
    if (!world || !world.campus) return;
    this.world = world; this.scene = game.scene;
    world.noMerge = world.noMerge || [];
    this.R = G.makeRng(4711);
    this.q = this.Q[G.save.settings.graphicsQuality] != null ? this.Q[G.save.settings.graphicsQuality] : 2;
    this.buildLeaves();
    this.buildPaper();
    this.buildCrows();
    this.buildPuddles();
    this.buildShafts();
    this.buildCurtains();
    this.applyQuality(G.save.settings.graphicsQuality);
  },

  applyQuality(q) {
    this.q = this.Q[q] != null ? this.Q[q] : 2;
    const show = (o, v) => { if (o) o.visible = v; };
    (this.puddles || []).forEach((m) => show(m, this.q >= 1));
    (this.shafts || []).forEach((m) => show(m, this.q >= 2));
    (this.curtains || []).forEach((m) => { show(m, this.q >= 1); if (m.material.userData.amp) m.material.userData.amp.value = this.q >= 2 ? 1 : 0; });
  },

  reset() {
    this.world = null; this.scene = null;
    this.leaves = null; this.paper = null; this.crows = null;
    this.puddles = []; this.shafts = []; this.curtains = [];
    this._treeT = 0; this._near = [];
  },

  // a shot fired: anything perched within earshot takes off
  onShot(pos) {
    if (!this.crows) return;
    this.crows.items.forEach((c) => { if (c.mode === "perch" && c.pos.distanceTo(pos) < 22) this.takeOff(c, pos); });
  },

  // ---- falling leaves ------------------------------------------------------
  buildLeaves() {
    const N = this.COUNTS.leaves[4];
    const geo = new THREE.PlaneGeometry(0.16, 0.11);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    const cols = [0x8a5a2a, 0xa0782a, 0x6a4a2a, 0x7a6a3a, 0xb0602a].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) mesh.setColorAt(i, cols[i % cols.length].clone().multiplyScalar(0.8 + this.R() * 0.4));
    this.scene.add(mesh);
    this.world.noMerge.push(mesh);
    this.leaves = { mesh, items: Array.from({ length: N }, () => ({ alive: false })) };
  },
  updateLeaves(dt, p, outdoors) {
    const L = this.leaves, n = this.COUNTS.leaves[this.q];
    if (!L) return;
    if (!outdoors || !n) { L.mesh.count = 0; return; }
    const R = this.R, m4 = this._m4 || (this._m4 = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion()), e = this._e || (this._e = new THREE.Euler());
    const s = this._s || (this._s = new THREE.Vector3()), v = this._v || (this._v = new THREE.Vector3());
    // the trees within reach, refreshed now and then
    if ((this._treeT -= dt) <= 0) {
      this._treeT = 1;
      this._near = (this.world.treeTops || []).filter((t) => t.leafy && Math.hypot(t.x - p.x, t.z - p.z) < 28);
    }
    for (let i = 0; i < n; i++) {
      const it = L.items[i];
      if (!it.alive) {
        if (this._near.length && R() < dt * 1.6) {
          const t = this._near[Math.floor(R() * this._near.length)], a = R() * 6.3, r = Math.sqrt(R()) * t.r;
          Object.assign(it, { alive: true, x: t.x + Math.cos(a) * r, y: t.y - 0.5 + R() * 1.2, z: t.z + Math.sin(a) * r, t: 0, ph: R() * 6.3, spin: 1 + R() * 3, fall: 0.45 + R() * 0.4, rest: 0 });
        } else { m4.makeScale(0, 0, 0); L.mesh.setMatrixAt(i, m4); continue; }
      }
      it.t += dt;
      if (it.rest > 0) {
        it.rest -= dt;
        if (it.rest <= 0) { it.alive = false; m4.makeScale(0, 0, 0); L.mesh.setMatrixAt(i, m4); continue; }
      } else {
        it.y -= it.fall * dt;
        it.x += (Math.sin(it.t * 1.9 + it.ph) * 0.7 + this.WIND.x * 0.5) * dt;
        it.z += (Math.cos(it.t * 1.4 + it.ph) * 0.5 + this.WIND.z * 0.5) * dt;
        const ground = G.getFloorHeightAt(this.world, it.x, it.z, it.y) + 0.02;
        if (it.y <= ground) { it.y = ground; it.rest = 2.5 + R() * 2; }
      }
      const k = it.rest > 0 ? Math.min(1, it.rest) : 1;
      e.set(it.rest > 0 ? -Math.PI / 2 : Math.sin(it.t * it.spin + it.ph) * 1.3, it.t * it.spin, it.rest > 0 ? 0 : Math.cos(it.t * it.spin * 0.7) * 1.1);
      q.setFromEuler(e); s.set(k, k, k); v.set(it.x, it.y, it.z);
      L.mesh.setMatrixAt(i, m4.compose(v, q, s));
    }
    L.mesh.count = n;
    L.mesh.instanceMatrix.needsUpdate = true;
  },

  // ---- paper in the wind -------------------------------------------------
  buildPaper() {
    const N = this.COUNTS.paper[4];
    const geo = new THREE.PlaneGeometry(0.21, 0.29, 2, 2);
    // a crumple along the middle
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) if (Math.abs(pa.getX(i)) < 0.01) pa.setZ(i, 0.025);
    geo.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xd8d2c0, side: THREE.DoubleSide }), N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    this.scene.add(mesh);
    this.world.noMerge.push(mesh);
    this.paper = { mesh, items: Array.from({ length: N }, () => ({ placed: false })), gust: 2 };
  },
  placePaper(it, p, behind) {
    const W = this.world, R = this.R;
    for (let t = 0; t < 12; t++) {
      const a = R() * 6.3, r = 6 + R() * 18, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (behind && this._fwd && Math.cos(a) * this._fwd.x + Math.sin(a) * this._fwd.z > 0.3) continue;
      if (x < W.campus.x0 + 2 || x > W.campus.x1 - 2 || z < W.campus.z0 + 2 || z > W.campus.z1 - 2) continue;
      if ((W.footprint || []).some((f) => x > f.minX - 0.5 && x < f.maxX + 0.5 && z > f.minZ - 0.5 && z < f.maxZ + 0.5)) continue;
      const y = G.getFloorHeightAt(W, x, z, 0.5);
      Object.assign(it, { placed: true, x, y: y + 0.03, z, ground: y, fly: 0, vx: 0, vy: 0, vz: 0, rx: -Math.PI / 2, ry: R() * 6.3, rz: 0 });
      return true;
    }
    return false;
  },
  updatePaper(dt, p, outdoors) {
    const Pp = this.paper, n = this.COUNTS.paper[this.q];
    if (!Pp) return;
    if (!outdoors || !n) { Pp.mesh.count = 0; return; }
    const R = this.R, m4 = this._m4b || (this._m4b = new THREE.Matrix4()), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    // now and then a gust takes one that is lying near you
    Pp.gust -= dt;
    if (Pp.gust <= 0) {
      Pp.gust = 2.5 + R() * 4.5;
      const rest = Pp.items.slice(0, n).filter((it) => it.placed && !it.fly && Math.hypot(it.x - p.x, it.z - p.z) < 18);
      if (rest.length) {
        const it = rest[Math.floor(R() * rest.length)], sp = 2.2 + R() * 1.8;
        Object.assign(it, { fly: 2.5 + R() * 2, vx: this.WIND.x * sp + (R() - 0.5), vy: 1.2 + R() * 1.4, vz: this.WIND.z * sp + (R() - 0.5), tumble: 2 + R() * 4 });
      }
    }
    for (let i = 0; i < n; i++) {
      const it = Pp.items[i];
      if (!it.placed || Math.hypot(it.x - p.x, it.z - p.z) > 32) { if (!this.placePaper(it, p, it.placed)) { m4.makeScale(0, 0, 0); Pp.mesh.setMatrixAt(i, m4); continue; } }
      if (it.fly > 0) {
        it.fly -= dt;
        it.vy -= 2.2 * dt;
        it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
        it.rx += it.tumble * dt; it.rz += it.tumble * 0.7 * dt;
        const g = G.getFloorHeightAt(this.world, it.x, it.z, it.y);
        const inside = (this.world.footprint || []).some((f) => it.x > f.minX && it.x < f.maxX && it.z > f.minZ && it.z < f.maxZ);
        if (inside) { it.vx = -it.vx * 0.3; it.vz = -it.vz * 0.3; it.x += it.vx * dt * 3; it.z += it.vz * dt * 3; }
        if (it.y <= g + 0.03 && it.vy < 0) { it.y = g + 0.03; it.ground = g; if (it.fly < 1.2) { it.fly = 0; it.rx = -Math.PI / 2; it.rz = 0; } else { it.vy = 0.8 + R(); } }
      }
      e.set(it.rx, it.ry, it.rz); q.setFromEuler(e); v.set(it.x, it.y, it.z);
      Pp.mesh.setMatrixAt(i, m4.compose(v, q, s));
    }
    Pp.mesh.count = n;
    Pp.mesh.instanceMatrix.needsUpdate = true;
  },

  // ---- crows ----------------------------------------------------------------
  buildCrows() {
    const N = this.COUNTS.crows[4], perches = this.world.perches || [];
    if (!perches.length) return;
    const P = G.SchoolDress.P;
    const paint = (g, hex) => { const [u, v] = P.texel(hex), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v); return g; };
    // body, head, beak and tail as one geometry; each wing its own, hinged
    // at the shoulder, so a flap is just a turn of the instance
    const body = P.concatGeos([
      paint(new THREE.BoxGeometry(0.16, 0.14, 0.34), 0x141416),
      paint(new THREE.BoxGeometry(0.11, 0.11, 0.12).translate(0, 0.08, 0.2), 0x18181a),
      paint(new THREE.BoxGeometry(0.035, 0.035, 0.1).translate(0, 0.07, 0.3), 0x3a3834),
      paint(new THREE.BoxGeometry(0.12, 0.03, 0.18).translate(0, 0.01, -0.24), 0x101012),
      paint(new THREE.BoxGeometry(0.02, 0.1, 0.02).translate(0.04, -0.12, 0.02), 0x2a2826),
      paint(new THREE.BoxGeometry(0.02, 0.1, 0.02).translate(-0.04, -0.12, 0.02), 0x2a2826),
    ]);
    const wingL = paint(new THREE.BoxGeometry(0.3, 0.02, 0.2).translate(0.15, 0, 0), 0x1a1a1e);
    const wingR = paint(new THREE.BoxGeometry(0.3, 0.02, 0.2).translate(-0.15, 0, 0), 0x1a1a1e);
    const mk = (g) => { const m = new THREE.InstancedMesh(g, P.PAL.lit, N); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; this.scene.add(m); this.world.noMerge.push(m); return m; };
    this.crows = { body: mk(body), wingL: mk(wingL), wingR: mk(wingR), items: [] };
    for (let i = 0; i < N; i++) {
      const c = { mode: "gone", pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, t: 0, wait: this.R() * 6 };
      this.crows.items.push(c);
    }
  },
  perch(c, p) {
    const W = this.world, R = this.R, list = W.perches || [];
    const taken = this.crows.items.filter((o) => o !== c && o.mode === "perch").map((o) => o.perch);
    for (let t = 0; t < 16; t++) {
      const pe = list[Math.floor(R() * list.length)];
      const d = Math.hypot(pe.x - p.x, pe.z - p.z);
      if (d < 14 || d > 55 || taken.includes(pe)) continue;
      c.mode = "perch"; c.perch = pe; c.pos.set(pe.x + (R() - 0.5) * 0.3, pe.y, pe.z + (R() - 0.5) * 0.3); c.yaw = R() * 6.3; c.t = 0; c.hop = 2 + R() * 4;
      return true;
    }
    return false;
  },
  takeOff(c, from) {
    c.mode = "fly"; c.t = 0;
    const away = c.pos.clone().sub(from).setY(0);
    if (away.lengthSq() < 0.01) away.set(this.R() - 0.5, 0, this.R() - 0.5);
    away.normalize().multiplyScalar(3.5 + this.R() * 1.5);
    c.vel.set(away.x, 3.2 + this.R(), away.z);
    c.yaw = Math.atan2(away.x, away.z);
    const now = performance.now();
    if (!this._cawAt || now - this._cawAt > 900) { this._cawAt = now; if (G.Audio) { G.Audio.sfx("crow", { pos: c.pos.clone() }); G.Audio.sfx("wings", { pos: c.pos.clone() }); } }
  },
  updateCrows(dt, p, outdoors) {
    const C = this.crows, n = this.COUNTS.crows[this.q];
    if (!C) return;
    if (!n || !outdoors) { C.body.count = C.wingL.count = C.wingR.count = 0; if (!n) return; }
    const R = this.R, m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    const qw = new THREE.Quaternion(), mw = new THREE.Matrix4(), off = new THREE.Vector3();
    const feet = p.y - 1.7;
    for (let i = 0; i < n; i++) {
      const c = C.items[i];
      c.t += dt;
      if (c.mode === "gone") {
        if ((c.wait -= dt) <= 0) { if (!this.perch(c, p)) c.wait = 3; }
      } else if (c.mode === "perch") {
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 8 && Math.abs(c.pos.y - feet) < 5) this.takeOff(c, p);
        else if ((c.hop -= dt) <= 0) { c.hop = 2 + R() * 5; c.yaw += (R() - 0.5) * 2.4; }
      } else {
        // up and away, then off over the fence
        c.vel.y = Math.max(-0.5, c.vel.y - (c.t > 1.2 ? 2.5 : 0.4) * dt);
        if (c.t > 1.2 && c.pos.y < 16) c.vel.y += 3.2 * dt;
        c.vel.multiplyScalar(1 + 0.25 * dt);
        c.pos.addScaledVector(c.vel, dt);
        c.yaw = Math.atan2(c.vel.x, c.vel.z);
        if (c.t > 6.5) { c.mode = "gone"; c.wait = 25 + R() * 25; }
      }
      if (c.mode === "gone" || !outdoors) { m4.makeScale(0, 0, 0); C.body.setMatrixAt(i, m4); C.wingL.setMatrixAt(i, m4); C.wingR.setMatrixAt(i, m4); continue; }
      const flying = c.mode === "fly";
      e.set(flying ? -0.15 : 0.05 * Math.sin(c.t * 2), c.yaw, 0); q.setFromEuler(e);
      v.copy(c.pos).setY(c.pos.y + (flying ? 0 : 0.12));
      m4.compose(v, q, s);
      C.body.setMatrixAt(i, m4);
      // wings: folded along the body when perched, beating in flight
      const flap = flying ? Math.sin(c.t * 19) * 0.9 : 0;
      [[C.wingL, 1], [C.wingR, -1]].forEach(([mesh, side]) => {
        qw.setFromEuler(e.set(0, flying ? 0 : side * 1.35, side * (flying ? flap : 0.15)));
        off.set(side * 0.07, 0.05, 0.02).applyQuaternion(q);
        mw.compose(v.clone().add(off), q.clone().multiply(qw), s);
        mesh.setMatrixAt(i, mw);
      });
    }
    [C.body, C.wingL, C.wingR].forEach((m) => { m.count = outdoors ? n : 0; m.instanceMatrix.needsUpdate = true; });
  },

  // ---- puddles ----------------------------------------------------------------
  skyCube() {
    if (G.Details._sky) return G.Details._sky;
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const cv = document.createElement("canvas"); cv.width = cv.height = 64;
      const c = cv.getContext("2d");
      if (f === 2) { c.fillStyle = "#1a2433"; c.fillRect(0, 0, 64, 64); }                 // straight up
      else if (f === 3) { c.fillStyle = "#0b0e10"; c.fillRect(0, 0, 64, 64); }            // down
      else {
        const g = c.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, "#1a2433"); g.addColorStop(0.55, "#3a4a5e"); g.addColorStop(0.62, "#1a1e1a"); g.addColorStop(1, "#0b0e10");
        c.fillStyle = g; c.fillRect(0, 0, 64, 64);
        if (f === 4) { const r = c.createRadialGradient(40, 18, 1, 40, 18, 16); r.addColorStop(0, "rgba(230,236,255,0.95)"); r.addColorStop(1, "rgba(230,236,255,0)"); c.fillStyle = r; c.fillRect(0, 0, 64, 64); }
      }
      faces.push(cv);
    }
    const tex = new THREE.CubeTexture(faces);
    tex.needsUpdate = true;
    G.Details._sky = tex;
    return tex;
  },
  buildPuddles() {
    const W = this.world, R = this.R, P = G.SchoolDress.P;
    const list = (W.puddles || []).slice();
    // standing water on the paths and in the hollows outdoors
    const paths = (W.mapFeatures || []).filter((f) => f.fill === "path");
    for (let k = 0; k < 16 && paths.length; k++) {
      const f = paths[Math.floor(R() * paths.length)];
      const x = f.minX + 0.6 + R() * Math.max(0.1, f.maxX - f.minX - 1.2), z = f.minZ + 0.6 + R() * Math.max(0.1, f.maxZ - f.minZ - 1.2);
      list.push({ x, z, r: 0.6 + R() * 1.1, y: 0.09 });
    }
    const groups = {};
    list.forEach((pd) => {
      const key = pd.y > 3 ? "in" + Math.round(pd.y) : pd.y < 0.05 ? "in0" : "out";
      const g = new THREE.CircleGeometry(pd.r, 18);
      const pa = g.attributes.position;
      for (let i = 1; i < pa.count; i++) { const k2 = 0.75 + 0.35 * Math.sin(i * 1.7 + pd.x) * Math.sin(i * 0.9 + pd.z); pa.setXY(i, pa.getX(i) * k2, pa.getY(i) * k2 * 0.8); }
      g.rotateX(-Math.PI / 2); g.translate(pd.x, pd.y + 0.004, pd.z);
      (groups[key] = groups[key] || []).push(g);
    });
    const mat = new THREE.MeshPhongMaterial({ color: 0x0c1216, specular: 0x7a8a9a, shininess: 90, envMap: this.skyCube(), reflectivity: 0.7, combine: THREE.MixOperation,
      transparent: true, opacity: 0.86, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    Object.values(groups).forEach((geos) => {
      const m = new THREE.Mesh(P.concatGeos(geos), mat);
      m.renderOrder = 1;
      this.scene.add(m);
      this.world.noMerge.push(m);
      this.puddles.push(m);
    });
  },

  // ---- light shafts ------------------------------------------------------------
  buildShafts() {
    const W = this.world, R = this.R;
    const cv = document.createElement("canvas"); cv.width = 4; cv.height = 64;
    const c = cv.getContext("2d"), g = c.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 4, 64);
    const tex = new THREE.CanvasTexture(cv);
    const mk = (color, opacity) => new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    // under a working lamp in some rooms: a soft cone down to the floor
    const byStorey = {};
    (W.fixtures || []).filter((f) => f.mode === "steady" && !/^C\d/.test(f.key)).forEach((f) => {
      if (R() > 0.45) return;
      const cone = new THREE.CylinderGeometry(0.4, 1.5, 3.2, 14, 1, true);
      cone.translate(f.x, f.baseY + 1.7, f.z);
      (byStorey[f.baseY] = byStorey[f.baseY] || []).push(cone);
    });
    Object.values(byStorey).forEach((geos) => {
      const m = new THREE.Mesh(G.SchoolDress.P.concatGeos(geos), mk(0xfff0c8, 0.07));
      this.scene.add(m); this.world.noMerge.push(m); this.shafts.push(m);
    });
    // moonlight slanting in through the entry hall's front windows
    const fp = (W.footprint || [])[0];
    if (fp) {
      const zf = fp.maxZ - 0.2, beams = [];
      [-13.6, -10.2, -6.8, 6.8, 10.2, 13.6].forEach((x) => {
        const b = new THREE.BoxGeometry(1.4, 5.2, 0.9);
        b.rotateX(0.55); b.rotateY((R() - 0.5) * 0.15);
        b.translate(x, 2.9, zf - 1.9);
        beams.push(b);
      });
      const m = new THREE.Mesh(G.SchoolDress.P.concatGeos(beams), mk(0x9ab8e8, 0.05));
      this.scene.add(m); this.world.noMerge.push(m); this.shafts.push(m);
    }
  },

  // ---- torn curtains ------------------------------------------------------------
  buildCurtains() {
    const W = this.world, R = this.R, list = W.curtains || [];
    if (!list.length) return;
    // the cloth: folds down it, ragged at the bottom, holes worn through
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 128;
    const c = cv.getContext("2d");
    for (let x = 0; x < 64; x++) { const f = 0.75 + 0.25 * Math.sin(x * 0.55); c.fillStyle = `rgb(${Math.round(255 * f)},${Math.round(255 * f)},${Math.round(255 * f)})`; c.fillRect(x, 0, 1, 128); }
    c.globalCompositeOperation = "destination-out";
    c.beginPath(); c.moveTo(0, 128);
    for (let x = 0; x <= 64; x += 4) c.lineTo(x, 96 + Math.sin(x * 0.7) * 14 + ((x * 37) % 17));
    c.lineTo(64, 128); c.closePath(); c.fill();
    for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(8 + ((k * 23) % 50), 30 + ((k * 41) % 60), 2 + (k % 3) * 2, 3 + (k % 4) * 2, k, 0, 7); c.fill(); }
    c.fillRect(20, 60, 3, 68);                                  // a long tear
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.5 });
    const amp = { value: 1 };
    mat.userData.amp = amp;
    const time = W.dress ? W.dress.uniforms.uTime : { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time; sh.uniforms.uAmp = amp;
      sh.vertexShader = "uniform float uTime;\nuniform float uAmp;\nattribute float aSway;\nattribute float aPhase;\n" + sh.vertexShader.replace("#include <begin_vertex>", [
        "vec3 transformed = vec3( position );",
        "float s2 = aSway * aSway * uAmp;",
        "transformed.x += ( sin( uTime * 1.1 + aPhase ) * 0.06 + sin( uTime * 2.3 + aPhase * 1.7 + position.y * 2.0 ) * 0.025 ) * s2;",
        "transformed.z += sin( uTime * 0.8 + aPhase * 0.6 + position.y ) * 0.05 * s2;",
      ].join("\n"));
    };
    mat.customProgramCacheKey = () => "curtain-sway";
    // one mesh a storey, so the zone culling can leave the others undrawn
    const storeys = {};
    list.forEach((cu) => { (storeys[Math.round(cu.y0 / 4.2)] = storeys[Math.round(cu.y0 / 4.2)] || []).push(cu); });
    Object.values(storeys).forEach((group) => this.curtainMesh(group, mat, R));
  },
  curtainMesh(list, mat, R) {
    const pos = [], nor = [], uv = [], col = [], sway = [], phase = [], idx = [];
    list.forEach((cu) => {
      const segX = 3, segY = 8, base = pos.length / 3, ph = R() * 6.3, color = new THREE.Color(cu.color || 0x7a3a3a);
      for (let j = 0; j <= segY; j++) for (let i = 0; i <= segX; i++) {
        const a = (i / segX - 0.5) * cu.width, y = cu.y0 - (j / segY) * cu.len;
        const x = cu.axis === "z" ? cu.x + Math.sin(i * 2.1 + ph) * 0.03 : cu.x + a, z = cu.axis === "z" ? cu.z + a : cu.z + Math.sin(i * 2.1 + ph) * 0.03;
        pos.push(x, y, z); nor.push(cu.axis === "z" ? 1 : 0, 0, cu.axis === "z" ? 0 : 1); uv.push(i / segX, 1 - j / segY);
        col.push(color.r, color.g, color.b); sway.push(j / segY); phase.push(ph);
      }
      for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) {
        const a = base + j * (segX + 1) + i, b = a + 1, d = a + segX + 1, e2 = d + 1;
        idx.push(a, d, b, b, d, e2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat);
    this.scene.add(m); this.world.noMerge.push(m); this.curtains.push(m);
  },

  // ---- every frame ------------------------------------------------------------
  update(game, dt) {
    if (!this.world || this.world !== game.world) return;
    const p = game.yawObject.position;
    this._fwd = this._fwd || new THREE.Vector3();
    this._fwd.set(-Math.sin(game.yawObject.rotation.y), 0, -Math.cos(game.yawObject.rotation.y));
    const st = G.Zones && G.Zones.state;
    const outdoors = st ? st.seeOut : true;
    this.updateLeaves(dt, p, outdoors);
    this.updatePaper(dt, p, outdoors);
    this.updateCrows(dt, p, outdoors);
    // G1: the grass leans away from the player and the zombies near them
    const B = this.world.dress && this.world.dress.uniforms.uBend;
    if (B) {
      const n = this.COUNTS.benders[this.q];
      B.value.forEach((b) => b.set(0, 0, 0, 0));
      const feet = p.y - 1.7;
      let k = 0;
      if (n > 0 && feet < 0.5) B.value[k++].set(p.x, feet, p.z, 1.3);
      if (n > 1) {
        const near = game.zombies.filter((z) => z.alive && z.mesh.position.y < 0.5)
          .map((z) => ({ z, d: z.mesh.position.distanceToSquared(p) })).filter((o) => o.d < 400).sort((a, b) => a.d - b.d);
        for (const o of near) { if (k >= n) break; B.value[k++].set(o.z.mesh.position.x, 0, o.z.mesh.position.z, o.z.type === "boss" ? 2.2 : 1.0); }
      }
    }
  },
};
