// ===================================================================
// The campus (round 3, F2)
// -------------------------------------------------------------------
// The school used to stand in a 52 x 27 m front yard. Now its grounds go all
// the way round it -- 120 x 180 m inside the school fence, about ten times the
// old yard once the building is taken out:
//
//              back fence
//   +-----------------------------------------+
//   |  service yard: the bus, bins, a water   |
//   |  tower, a heap of old desks             |
//   |      +--------- gym ---------+          |
//   | FIELD|                       | GARDEN   |
//   | sala |   three storeys of    | fountain |
//   | pitch|   classrooms          | beds     |
//   | stand|                       | sala     |
//   |      +------ entry hall -----+          |
//   |  sala     front yard (the old one)  car |
//   |  checkpoint       |gate|          park  |
//   +-----------------------------------------+
//              road side
//
// Paths run round the building in a loop. Everything here is painted from
// the one palette texture (G.SchoolDress.P), so it merges into a couple of
// draw calls per 32 m cell. Anything taller than 0.6 m that you could walk
// into is a collider; the stands and the sala floors are height zones you
// step up onto. Each landmark is recorded (world.landmarks) for the explore
// objective and the minimap, and a few spots are marked where a story note
// could be left (world.noteSpots).
// ===================================================================
(function () {
  G.Campus = {
    build(api) {
      const P = G.SchoolDress.P;
      const { scene, world, C } = api;
      const R = G.makeRng(20260927);
      const S = { api, P, scene, world, C, R };
      S.noGrass = (x0, z0, x1, z1) => world.noGrass.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
      S.col = (x0, y0, z0, x1, y1, z1) => {
        const b = new THREE.Box3(new THREE.Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), new THREE.Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)));
        world.colliders.push(b);
        return b;
      };
      S.colOf = (o) => { o.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(o); world.colliders.push(b); return b; };
      S.feature = (f) => (world.mapFeatures = world.mapFeatures || []).push(f);
      S.landmark = (key, x, z, r) => world.landmarks.push({ key, x, z, r });
      S.spot = (x, y, z, where) => world.noteSpots.push({ x, y, z, where, room: null, floor: 1, outdoor: true });
      S.blocked = [];                 // footprints taken, for the obstacle and tree scatter
      S.take = (x0, z0, x1, z1) => S.blocked.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
      world.campusTrees = [];
      world.perches = world.perches || [];     // where the crows sit (G3)
      world.puddles = world.puddles || [];     // standing water (G3; the rooms have added theirs)
      this.paths(S);
      this.field(S);
      this.garden(S);
      this.carPark(S);
      this.checkpoint(S);
      this.backYard(S);
      this.sala(S, -42, 52, 0, "SALA_FRONT", true);
      this.sala(S, -46, 17, Math.PI / 2, "SALA_FIELD", true);
      this.sala(S, 37.5, -51, Math.PI / 2, "SALA_GARDEN", true);
      this.lamps(S);
      this.obstacles(S);
      this.trees(S);
    },

    // ---- helpers ----------------------------------------------------------
    // a two-sided triangle, indexed so G.Perf.mergeStatic can bake it
    tri(S, parent, a, b, c, paint) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3));
      g.setIndex([0, 1, 2, 3, 4, 5]);
      g.computeVertexNormals();
      const m = S.P.mk(g, paint);
      parent.add(m);
      return m;
    },
    free(S, x, z, r) {
      const W = S.world;
      if ((W.footprint || []).some((f) => x > f.minX - r - 2 && x < f.maxX + r + 2 && z > f.minZ - r - 2 && z < f.maxZ + r + 2)) return false;
      if (x < S.C.x0 + 2.5 + r || x > S.C.x1 - 2.5 - r || z < S.C.z0 + 2.5 + r || z > S.C.z1 - 2.5 - r) return false;
      if (W.noGrass.some((n) => x > n.minX - r - 0.8 && x < n.maxX + r + 0.8 && z > n.minZ - r - 0.8 && z < n.maxZ + r + 0.8)) return false;
      if (S.blocked.some((n) => x > n.minX - r - 0.8 && x < n.maxX + r + 0.8 && z > n.minZ - r - 0.8 && z < n.maxZ + r + 0.8)) return false;
      if (Object.values(W.waypointNodes).some((n) => (n.y || 0) < 1 && Math.hypot(n.x - x, n.z - z) < r + 3)) return false;
      if (Math.hypot(x - 0, z - 53) < r + 6) return false;              // the player's start
      return true;
    },

    // ---- paths: a loop of cracked concrete round the building --------------
    paths(S) {
      const { P, scene, R } = S;
      const conc = P.lam(0x6b6a63), concD = P.lam(0x5e5d57), crack = P.lam(0x2a2a26);
      const run = (ax, fixed, from, to, w) => {
        const lo = Math.min(from, to), hi = Math.max(from, to);
        const n = Math.max(1, Math.round((hi - lo) / 3)), seg = (hi - lo) / n;
        for (let i = 0; i < n; i++) {
          const c = lo + seg * (i + 0.5);
          const x = ax === "z" ? fixed : c, z = ax === "z" ? c : fixed;
          P.box(scene, ax === "z" ? w : seg - 0.22, 0.08, ax === "z" ? seg - 0.22 : w, R() < 0.3 ? concD : conc,
            x + (R() - 0.5) * 0.08, 0.04, z + (R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.025, 0);
          if (R() < 0.7) P.box(scene, 0.06, 0.02, 0.8 + R() * 1.2, crack, x + (R() - 0.5) * (w - 0.7), 0.085, z + (R() - 0.5) * (seg - 0.7), 0, R() * 3, 0);
        }
        const r = ax === "z" ? [fixed - w / 2, lo, fixed + w / 2, hi] : [lo, fixed - w / 2, hi, fixed + w / 2];
        S.noGrass(r[0] - 0.25, r[1] - 0.25, r[2] + 0.25, r[3] + 0.25);
        S.feature({ kind: "rect", minX: r[0], minZ: r[1], maxX: r[2], maxZ: r[3], fill: "path" });
      };
      run("z", -28, 62, -96, 3);          // down the field side
      run("z", 28, 62, -96, 3);           // down the garden side
      run("x", 62, -50, 26.5, 3);         // across the front yard
      run("x", -96, -28, 28, 3);          // behind the gym
      run("x", -32, -32.5, -29.5, 2.4);   // onto the pitch
      run("x", -34, 29.5, 32.6, 2.4);     // into the garden
      S.noGrass(-2.5, 33.2, 2.5, S.C.z1);   // the main path (drawn in world.js)
      S.feature({ kind: "rect", minX: -2.1, maxX: 2.1, minZ: 33.2, maxZ: S.C.z1, fill: "path" });
    },

    // ---- the football field, its goals and its stand ----------------------
    field(S) {
      const { P, scene, R, world } = S;
      const X0 = -58, X1 = -32, Z0 = -64, Z1 = 0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
      const line = P.lam(0x9aa08c), lineF = P.lam(0x7d876e);
      // the lines are chalk long gone to grass: broken into pieces, some
      // faded right out, all of them half hidden in the tall grass
      const piece = (x, z, w, d, ry) => { if (R() < 0.14) return; P.box(scene, w, 0.012, d, R() < 0.5 ? line : lineF, x, 0.008, z, 0, ry || 0, 0); };
      const seg = (xa, za, xb, zb) => {
        const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.ceil(len / 2));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = xa + (xb - xa) * t, z = za + (zb - za) * t;
          if (xa === xb) piece(x, z, 0.12, len / n * 0.94); else piece(x, z, len / n * 0.94, 0.12);
        }
      };
      seg(X0, Z0, X0, Z1); seg(X1, Z0, X1, Z1); seg(X0, Z0, X1, Z0); seg(X0, Z1, X1, Z1); seg(X0, cz, X1, cz);
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; piece(cx + Math.cos(a) * 5, cz + Math.sin(a) * 5, 1.1, 0.12, -a + Math.PI / 2); }
      piece(cx, cz, 0.3, 0.3);
      [[Z1, -1], [Z0, 1]].forEach(([gz, dir]) => {
        const pz = gz + dir * 7, gz2 = gz + dir * 2.5;
        seg(cx - 8, gz, cx - 8, pz); seg(cx + 8, gz, cx + 8, pz); seg(cx - 8, pz, cx + 8, pz);
        seg(cx - 4, gz, cx - 4, gz2); seg(cx + 4, gz, cx + 4, gz2); seg(cx - 4, gz2, cx + 4, gz2);
        piece(cx, gz + dir * 5, 0.25, 0.25);
        this.goal(S, cx, gz, dir);
      });
      world.pitch = { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1 };
      S.feature({ kind: "rect", minX: X0, minZ: Z0, maxX: X1, maxZ: Z1, fill: "pitch" });
      S.landmark("FIELD", cx, cz, 17);
      S.take(X0 - 1, Z0 - 2, X1 + 1, Z1 + 2);
      this.bleachers(S);
      // the PE shed behind the north goal, and the scoreboard beside it
      {
        const shed = new THREE.Group(); shed.position.set(-38.5, 0, -74); scene.add(shed);
        const wall = P.lam(0x7a6a52), roof = P.lam(0x4a4e52), door = P.lam(0x5a3a2a);
        P.box(shed, 5, 2.6, 3.4, wall, 0, 1.3, 0);
        P.box(shed, 5.5, 0.12, 4.0, roof, 0, 2.72, 0, 0.08, 0, 0);
        P.box(shed, 1.3, 2.1, 0.06, door, 0.9, 1.05, 1.72);
        P.box(shed, 1.1, 1.95, 0.02, P.basic(0x0a0b0c), 0.9, 1.0, 1.7);      // it stands ajar
        P.box(shed, 1.2, 0.35, 0.04, P.lam(0xd8d0b8), -1.2, 2.0, 1.72);
        S.colOf(shed.children[0]);
        S.take(-41.5, -76.2, -35.5, -71.8);
        S.feature({ kind: "rect", minX: -41, maxX: -36, minZ: -75.7, maxZ: -72.3, fill: "block" });
        S.spot(-37.6, 0.02, -71.9, "shed");
      }
      {
        const legs = P.lam(0x55585c);
        [-2.2, 2.2].forEach((dx) => { P.box(scene, 0.2, 4.2, 0.2, legs, -46 + dx, 2.1, -71.5); S.col(-46 + dx - 0.15, 0, -71.65, -46 + dx + 0.15, 4.2, -71.35); });
        const board = S.api.addCanvasBox(-46, 4.4, -71.4, 5.2, 1.8, 0.16, (ctx, cv) => {
          ctx.fillStyle = "#101418"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.textAlign = "center"; ctx.fillStyle = "#b8a060";
          G.fitFont(ctx, G.T("world.home"), 22, 110); ctx.fillText(G.T("world.home"), 64, 32);
          G.fitFont(ctx, G.T("world.away"), 22, 110); ctx.fillText(G.T("world.away"), 192, 32);
          ctx.font = "bold 58px monospace"; ctx.fillStyle = "#5a2a22"; ctx.fillText("3 : 1", 128, 100);
          ctx.fillStyle = "#0a0c0e"; for (let i = 0; i < 9; i++) ctx.fillRect(Math.random() * 240, Math.random() * 120, 8 + Math.random() * 20, 4 + Math.random() * 10);
        }, 0x2a2c2e, 0);
        void board;
      }
      // odds and ends of the last PE lesson
      const cone = P.lam(0xc0602a), ball = P.lam(0xd8d4c8), bag = P.lam(0x2a3a5a);
      for (let i = 0; i < 9; i++) {
        const x = X1 - 3 - R() * 8, z = Z1 - 6 - i * 2.2;
        if (R() < 0.3) P.box(scene, 0.3, 0.07, 0.3, cone, x, 0.035, z, R() * 0.4, R() * 3, 1.3); else P.cyl(scene, 0.03, 0.14, 0.34, 8, cone, x, 0.17, z);
      }
      for (let i = 0; i < 5; i++) { const b = P.mk(new THREE.SphereGeometry(0.11, 8, 6), ball); b.position.set(cx + (R() - 0.5) * 16, 0.1, cz + (R() - 0.5) * 30); scene.add(b); }
      P.blob(scene, 0.35, bag, X1 - 1.5, 0.25, Z1 - 3, 1.3, 0.7, 1, R);
    },

    goal(S, cx, gz, dir) {
      const { P, scene, R, world } = S;
      const rust = P.lam(0x7a4a2e), rust2 = P.lam(0x8a5a36), white = P.lam(0x9a968a), net = P.lam(0x3c3c3a);
      const W = 7.3, H = 2.44, D = 1.6, back = gz - dir * D;
      [-1, 1].forEach((s) => {
        P.box(scene, 0.12, H, 0.12, s < 0 ? rust : white, cx + s * W / 2, H / 2, gz);
        S.col(cx + s * W / 2 - 0.1, 0, gz - 0.1, cx + s * W / 2 + 0.1, H, gz + 0.1);
        P.box(scene, 0.07, 0.07, D + 0.1, rust2, cx + s * W / 2, H - 0.15, (gz + back) / 2, -dir * 0.18, 0, 0);
        P.box(scene, 0.07, 0.07, D, rust2, cx + s * W / 2, 0.035, (gz + back) / 2);
        P.box(scene, 0.07, H - 0.3, 0.07, rust2, cx + s * W / 2, (H - 0.3) / 2, back);
      });
      P.box(scene, W + 0.12, 0.12, 0.12, rust, cx, H, gz, 0, 0, (R() - 0.5) * 0.03);   // the crossbar sags
      P.box(scene, W, 0.07, 0.07, rust2, cx, 0.035, back);
      P.box(scene, W, 0.07, 0.07, rust2, cx, H - 0.3, back);
      // the net, torn: strands hang from the back bar, whole panels are gone,
      // and a heap of it lies in the goalmouth
      for (let i = 0; i < 26; i++) {
        if (R() < 0.35) continue;
        const x = cx - W / 2 + 0.15 + i * (W - 0.3) / 25, len = 0.5 + R() * (H - 0.9);
        P.box(scene, 0.02, len, 0.02, net, x, H - 0.3 - len / 2, back + dir * 0.02, (R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.25);
        if (R() < 0.3) P.box(scene, 0.02, 0.02, D, net, x, H - 0.2, (gz + back) / 2, -dir * 0.18, 0, 0);
      }
      for (let k = 0; k < 4; k++) P.box(scene, W * (0.25 + R() * 0.4), 0.02, 0.02, net, cx + (R() - 0.5) * 3, 0.4 + k * 0.5, back + dir * 0.03);
      P.box(scene, 1.3, 0.05, 0.9, net, cx + (R() - 0.5) * 4, 0.03, back + dir * 0.6, 0, R() * 3, 0);
      world.perches.push({ x: cx - 2 + R() * 4, y: H + 0.07, z: gz, yaw: 0 });
      if (dir > 0) S.spot(cx + 2.6, 0.02, back + dir * 0.4, "goal");
    },

    // concrete terraces, four steps up, blue and red plastic seats (some
    // gone, a few snapped), a rail along the top; you can climb them
    bleachers(S) {
      const { P, scene, R, world } = S;
      const X = -58.9, Z0 = -48, Z1 = -16, T = 4, D = 1.1, RISE = 0.45;
      const conc = P.lam(0x7a7870), concD = P.lam(0x68665e), seat = P.lam(0x2f5a8a), seatB = P.lam(0x8a2f2a), steel = P.lam(0x5a5e62);
      for (let k = 0; k < T; k++) {
        const xa = X - k * D, xb = xa - D, h = RISE * (k + 1);
        P.box(scene, D, h, Z1 - Z0, k % 2 ? concD : conc, (xa + xb) / 2, h / 2, (Z0 + Z1) / 2);
        world.heightZones.push({ minX: xb, maxX: xa, minZ: Z0, maxZ: Z1, height: h });
        for (let z = Z0 + 0.6; z < Z1 - 0.4; z += 0.8) {
          if (R() < 0.18) continue;
          const m = (Math.floor(z * 1.25) + k) % 6 === 0 ? seatB : seat, broken = R() < 0.08;
          P.box(scene, 0.44, 0.07, 0.48, m, xb + 0.34, h + 0.22, z, 0, 0, broken ? 0.6 : 0);
          if (!broken) P.box(scene, 0.06, 0.34, 0.48, m, xb + 0.1, h + 0.42, z);
          P.box(scene, 0.06, 0.2, 0.06, steel, xb + 0.34, h + 0.1, z);
        }
      }
      const top = RISE * T, xBack = X - T * D;
      P.box(scene, 0.08, 1.0, Z1 - Z0, steel, xBack + 0.06, top + 0.5, (Z0 + Z1) / 2);
      P.box(scene, 0.06, 0.06, Z1 - Z0, steel, xBack + 0.06, top + 1.0, (Z0 + Z1) / 2);
      S.col(xBack - 0.12, 0, Z0, xBack + 0.14, top + 1.05, Z1);
      [Z0, Z1].forEach((z) => {
        P.box(scene, T * D, top + 1.0, 0.16, concD, (X + xBack) / 2, (top + 1.0) / 2, z);
        S.col(xBack, 0, z - 0.1, X, top + 1.0, z + 0.1);
      });
      S.noGrass(xBack - 0.2, Z0 - 0.2, X + 0.2, Z1 + 0.2);
      S.take(xBack - 0.5, Z0 - 1, X + 1.5, Z1 + 1);
      S.feature({ kind: "rect", minX: xBack, maxX: X, minZ: Z0, maxZ: Z1, fill: "block" });
      for (let i = 0; i < 3; i++) world.perches.push({ x: xBack + 0.06, y: top + 1.04, z: Z0 + 5 + i * 10, yaw: Math.PI / 2 });
      S.spot(xBack + 0.55, top, (Z0 + Z1) / 2 + 2.5, "bleachers");
    },

    // ---- the dead flower garden -------------------------------------------
    garden(S) {
      const { P, scene, R, world } = S;
      const GX0 = 32, GX1 = 52, GZ0 = -60, GZ1 = -8, cx = 42, cz = -34;
      const stone = P.lam(0x7a776e), stoneL = P.lam(0x8a867c), moss = P.lam(0x44532e);
      const hedgeC = [P.lam(0x5a5236), P.lam(0x4f4a30), P.lam(0x5e5a44), P.lam(0x46472e)];
      // a border of dead hedge, knee high, gaps at the three ways in (no
      // collider: you can push through a dead shrub)
      const hedge = (ax, fixed, a, b) => {
        for (let t = a + 0.4; t < b - 0.3; t += 0.75) {
          if (R() < 0.08) continue;
          const h = 0.3 + R() * 0.25, x = ax === "x" ? t : fixed, z = ax === "x" ? fixed : t;
          P.blob(scene, 0.42, hedgeC[Math.floor(R() * 4)], x + (R() - 0.5) * 0.15, h * 0.6, z + (R() - 0.5) * 0.15, 1.1, h * 1.6, 1.1, R);
        }
      };
      hedge("x", GZ1, GX0, cx - 1.4); hedge("x", GZ1, cx + 1.4, GX1);
      hedge("x", GZ0, GX0, cx - 1.4); hedge("x", GZ0, cx + 1.4, GX1);
      hedge("z", GX0, GZ0, cz - 1.4); hedge("z", GX0, cz + 1.4, GZ1);
      hedge("z", GX1, GZ0, GZ1);
      // flagstone paths, crossing at the fountain, and a ring round it
      const flag = (x, z) => { if (R() < 0.06) return; const s = 0.7 + R() * 0.3; P.box(scene, s, 0.07, s * (0.8 + R() * 0.3), R() < 0.4 ? stoneL : stone, x, 0.035, z, 0, (R() - 0.5) * 0.5, 0); if (R() < 0.2) P.box(scene, s * 0.6, 0.012, 0.12, moss, x, 0.075, z + s * 0.4, 0, R(), 0); };
      for (let z = GZ1 + 0.2; z > GZ0; z -= 0.95) if (Math.abs(z - cz) > 4.6) { flag(cx - 0.45, z); flag(cx + 0.45, z); }
      for (let x = GX0 - 0.3; x < GX1; x += 0.95) if (Math.abs(x - cx) > 4.6) { flag(x, cz - 0.45); flag(x, cz + 0.45); }
      for (let i = 0; i < 34; i++) { const a = (i / 34) * Math.PI * 2; flag(cx + Math.cos(a) * 4.1, cz + Math.sin(a) * 4.1); }
      S.noGrass(cx - 1.1, GZ0, cx + 1.1, GZ1 + 0.5); S.noGrass(GX0 - 0.6, cz - 1.1, GX1, cz + 1.1);
      S.feature({ kind: "rect", minX: GX0, maxX: GX1, minZ: GZ0, maxZ: GZ1, fill: "garden" });
      this.fountain(S, cx, cz);
      // raised beds of dead flowers: brick edging, black soil, dry stalks
      const brick = P.lam(0x7a4a3a), soil = P.lam(0x2e261c), stalk = [P.lam(0x6a5a3a), P.lam(0x5a4a30), P.lam(0x7a6a44)];
      const heads = [P.lam(0x5a2a2e), P.lam(0x4a2a44), P.lam(0x6a4a2a), P.lam(0x3a2a22)];
      const beds = [[36.8, -13.5], [36.8, -20.5], [36.8, -27.5], [47.2, -13.5], [47.2, -20.5], [47.2, -27.5], [47.2, -41.5], [47.2, -48.5]];
      beds.forEach(([bx, bz]) => {
        const W = 5.2, D = 1.7;
        [[0, -D / 2, W, 0.14], [0, D / 2, W, 0.14], [-W / 2, 0, 0.14, D], [W / 2, 0, 0.14, D]].forEach(([dx, dz, w, d]) => P.box(scene, w, 0.32, d, brick, bx + dx, 0.16, bz + dz));
        P.box(scene, W - 0.2, 0.26, D - 0.2, soil, bx, 0.13, bz);
        for (let i = 0; i < 22; i++) {
          const x = bx + (R() - 0.5) * (W - 0.5), z = bz + (R() - 0.5) * (D - 0.4), h = 0.25 + R() * 0.5;
          P.box(scene, 0.025, h, 0.025, stalk[Math.floor(R() * 3)], x, 0.26 + h / 2, z, (R() - 0.5) * 0.7, 0, (R() - 0.5) * 0.7);
          if (R() < 0.35) P.box(scene, 0.09, 0.05, 0.09, heads[Math.floor(R() * 4)], x + (R() - 0.5) * 0.1, 0.26 + h * 0.9, z, R(), R(), R());
        }
        S.noGrass(bx - W / 2, bz - D / 2, bx + W / 2, bz + D / 2);
      });
      // dry trees, one to each quarter
      [[35, -31.6, "dead"], [49.5, -32, "dead"], [35.5, -40.5, "twisted"], [50, -56, "dead"], [45.8, -56.5, "dead"]].forEach(([x, z, kind]) => world.campusTrees.push({ x, z, kind, dry: true }));
      this.trellis(S, cx, GZ1);
      G.SchoolDress.bench(scene, R, 39.6, -17, Math.PI / 2 + 0.05);
      G.SchoolDress.bench(scene, R, 44.4, -45, -Math.PI / 2 - 0.1);
      S.col(38.9, 0, -17.95, 40.3, 0.9, -16.05); S.col(43.7, 0, -45.95, 45.1, 0.9, -44.05);
      // the gardener's barrow, tipped where it was left
      {
        const g = new THREE.Group(); g.position.set(49.8, 0, -37.2); g.rotation.set(0, 0.7, 0.35); scene.add(g);
        P.box(g, 0.9, 0.35, 0.6, P.lam(0x4a6a3a), 0, 0.45, 0);
        P.cyl(g, 0.18, 0.18, 0.07, 10, P.lam(0x1c1c1c), 0.55, 0.2, 0, Math.PI / 2, 0, 0);
        [-0.2, 0.2].forEach((dz) => P.box(g, 0.9, 0.04, 0.04, P.lam(0x6a4a2a), -0.55, 0.5, dz, 0, 0, 0.2));
        S.spot(49.1, 0.02, -36.3, "garden");
      }
      S.landmark("GARDEN", cx, cz, 13);
      S.take(GX0, GZ0, GX1, GZ1 + 0.5);
    },

    // an octagonal basin, one side of it broken down, a bowl knocked askew on
    // its pedestal, a skin of green water in the bottom
    fountain(S, x, z) {
      const { P, scene, R, world } = S;
      const stone = P.lam(0x8a867c), stoneD = P.lam(0x6e6a60), moss = P.lam(0x3e4e2a), inner = P.lam(0x3a3a34);
      const RAD = 2.8, broken = 5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8, px = x + Math.cos(a) * RAD, pz = z + Math.sin(a) * RAD;
        const len = 2 * RAD * Math.tan(Math.PI / 8) + 0.08;
        if (i === broken) {
          P.box(scene, len * 0.4, 0.25, 0.36, stoneD, px - Math.sin(a) * len * 0.3, 0.12, pz + Math.cos(a) * len * 0.3, 0, -a + Math.PI / 2, 0.1);
          for (let k = 0; k < 5; k++) P.box(scene, 0.2 + R() * 0.3, 0.15, 0.2 + R() * 0.2, stoneD, px + (R() - 0.2) * 1.2 * Math.cos(a), 0.07, pz + (R() - 0.2) * 1.2 * Math.sin(a), R(), R() * 3, R());
          continue;
        }
        P.box(scene, len, 0.6, 0.36, i % 3 ? stone : stoneD, px, 0.3, pz, 0, -a + Math.PI / 2, 0);
        P.box(scene, len + 0.05, 0.06, 0.44, stone, px, 0.63, pz, 0, -a + Math.PI / 2, 0);
        if (R() < 0.5) P.box(scene, len * 0.6, 0.2, 0.02, moss, px + Math.cos(a) * 0.19, 0.2, pz + Math.sin(a) * 0.19, 0, -a + Math.PI / 2, 0);
        // the wall itself, as a collider along its length
        const tx = -Math.sin(a), tz = Math.cos(a);
        const e0x = px - tx * len / 2, e0z = pz - tz * len / 2, e1x = px + tx * len / 2, e1z = pz + tz * len / 2;
        S.col(Math.min(e0x, e1x) - 0.15, 0, Math.min(e0z, e1z) - 0.15, Math.max(e0x, e1x) + 0.15, 0.62, Math.max(e0z, e1z) + 0.15);
      }
      P.cyl(scene, RAD - 0.15, RAD - 0.15, 0.04, 16, inner, x, 0.03, z);
      P.cyl(scene, 0.35, 0.45, 1.3, 10, stone, x, 0.65, z);
      S.col(x - 0.45, 0, z - 0.45, x + 0.45, 1.4, z + 0.45);
      P.cyl(scene, 1.0, 0.6, 0.25, 14, stone, x + 0.1, 1.35, z, 0.22, 0, 0.1);
      P.cyl(scene, 0.25, 0.3, 0.5, 8, stoneD, x - 1.6, 0.14, z + 1.0, Math.PI / 2, 0.4, 0);   // its top, fallen in
      world.puddles.push({ x, z, r: RAD - 0.4, y: 0.06, inBasin: true });
      world.perches.push({ x: x + 0.1, y: 1.5, z, yaw: 1.2 });
      S.spot(x + Math.cos(Math.PI / 8) * RAD, 0.66, z + Math.sin(Math.PI / 8) * RAD, "fountain");
      S.noGrass(x - RAD - 0.3, z - RAD - 0.3, x + RAD + 0.3, z + RAD + 0.3);
      S.feature({ kind: "circle", x, z, r: RAD, fill: "water" });
    },

    // a rose arch over the way in, the roses long dead
    trellis(S, x, z) {
      const { P, scene, R } = S;
      const wood = P.lam(0xb0a890), woodD = P.lam(0x8a826c), vine = P.lam(0x3a2e22), leaf = [P.lam(0x6a5a34), P.lam(0x5a3a26), P.lam(0x7a6a3c)];
      const HW = 1.45, H = 2.3;
      [-1, 1].forEach((s) => {
        [-0.2, 0.2].forEach((dz) => { P.box(scene, 0.1, H, 0.1, wood, x + s * HW, H / 2, z + dz); });
        for (let k = 0; k < 6; k++) P.box(scene, 0.06, 0.04, 0.5, woodD, x + s * HW, 0.3 + k * 0.38, z);
        S.col(x + s * HW - 0.1, 0, z - 0.3, x + s * HW + 0.1, H, z + 0.3);
      });
      const N = 9;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI, a1 = ((i + 1) / N) * Math.PI, am = (a0 + a1) / 2;
        const px = x + Math.cos(am) * HW, py = H + Math.sin(am) * HW, len = HW * (a1 - a0) + 0.04;
        [-0.2, 0.2].forEach((dz) => P.box(scene, len, 0.09, 0.08, wood, px, py, z + dz, 0, 0, am + Math.PI / 2));
        P.box(scene, 0.06, 0.05, 0.48, woodD, px, py, z, 0, 0, am);
      }
      // dead vine wound round it
      for (let k = 0; k < 40; k++) {
        const t = R(), side = R() < 0.5 ? -1 : 1;
        let px, py;
        if (t < 0.55) { px = x + side * HW + (R() - 0.5) * 0.15; py = t / 0.55 * H; } else { const a = (t - 0.55) / 0.45 * Math.PI; px = x + Math.cos(a) * HW; py = H + Math.sin(a) * HW; }
        P.box(scene, 0.03, 0.3 + R() * 0.3, 0.03, vine, px, py, z + (R() - 0.5) * 0.4, R() * 2, R() * 3, R() * 2);
        if (R() < 0.5) P.box(scene, 0.1, 0.02, 0.07, leaf[Math.floor(R() * 3)], px + (R() - 0.5) * 0.2, py + 0.1, z + (R() - 0.5) * 0.5, R() * 3, R() * 3, R());
      }
      S.world.perches.push({ x, y: H + HW + 0.05, z, yaw: 0 });
    },

    // ---- the car park beside the gate ------------------------------------
    carPark(S) {
      const { P, scene, R, world } = S;
      const X0 = 31, X1 = 54, Z0 = 42, Z1 = 72;
      P.box(scene, X1 - X0, 0.06, Z1 - Z0, P.lam(0x2e2f31), (X0 + X1) / 2, 0.03, (Z0 + Z1) / 2);
      for (let i = 0; i < 26; i++) P.box(scene, 0.4 + R() * 1.8, 0.012, 0.05 + R() * 0.08, P.lam(0x1c1d1e), X0 + 1 + R() * (X1 - X0 - 2), 0.064, Z0 + 1 + R() * (Z1 - Z0 - 2), 0, R() * 3, 0);
      const paint = P.lam(0x8a8a7e);
      [[Z0 + 0.5, Z0 + 5.5], [Z1 - 5.5, Z1 - 0.5]].forEach(([za, zb]) => {
        for (let x = X0 + 0.8; x <= X1 - 0.5; x += 2.6) if (R() > 0.15) P.box(scene, 0.1, 0.012, zb - za, paint, x, 0.066, (za + zb) / 2);
      });
      const car = G.SchoolDress.car.bind(G.SchoolDress);
      const api = { scene, world };
      car(api, R, 35.1, Z1 - 3, Math.PI / 2 + 0.06);
      car(api, R, 45.5, Z1 - 3.2, Math.PI / 2 - 0.12);
      car(api, R, 48.1, Z0 + 3, Math.PI / 2 + 0.2);
      car(api, R, 39, 57.5, 0.95);
      S.noGrass(X0, Z0, X1, Z1);
      S.take(X0, Z0, X1, Z1);
      S.feature({ kind: "rect", minX: X0, maxX: X1, minZ: Z0, maxZ: Z1, fill: "asphalt" });
      S.landmark("CARPARK", (X0 + X1) / 2, (Z0 + Z1) / 2, 11);
      // the bike shed on the garden side of the front yard
      {
        const g = new THREE.Group(); g.position.set(41, 0, 27); scene.add(g);
        const post = P.lam(0x55585c), roof = P.lam(0x3e5a4a), rack = P.lam(0x8a8e92);
        [[-3, -1.2], [3, -1.2], [-3, 1.2], [3, 1.2]].forEach(([a, b]) => { P.box(g, 0.12, 2.3, 0.12, post, a, 1.15, b); });
        P.box(g, 6.6, 0.08, 3.0, roof, 0, 2.35, 0, 0.1, 0, 0);
        for (let i = 0; i < 6; i++) P.box(g, 0.05, 0.6, 0.05, rack, -2.5 + i, 0.3, 0);
        P.box(g, 5.2, 0.05, 0.05, rack, 0, 0.58, 0);
        g.updateWorldMatrix(true, true);
        [[-3, -1.2], [3, -1.2], [-3, 1.2], [3, 1.2]].forEach(([a, b]) => S.col(41 + a - 0.1, 0, 27 + b - 0.1, 41 + a + 0.1, 2.3, 27 + b + 0.1));
        G.SchoolDress.bicycle(scene, R, 40.2, 27.4);
        S.take(37.5, 25.3, 44.5, 28.7);
        S.noGrass(37.7, 25.6, 44.3, 28.4);
        world.perches.push({ x: 41, y: 2.45, z: 27, yaw: 0 });
        S.spot(43.1, 0.02, 26.4, "bikeshed");
      }
    },

    // ---- the rescue team's checkpoint, just inside the gate ---------------
    // (the story notes are theirs as much as anyone's)
    checkpoint(S) {
      const { P, scene, R, world } = S;
      const olive = P.lam(0x4f5a3a), oliveD = P.lam(0x3e4730), sand = P.lam(0x8a7a56), sandD = P.lam(0x76684a), steel = P.lam(0x5a5e62);
      // the tent: two sloping sides, a back, open to the front
      {
        const g = new THREE.Group(); g.position.set(-11.5, 0, 70.5); g.rotation.y = 0.1; scene.add(g);
        const L = 4.2, Wd = 3.2, Hh = 2.3, a = Math.atan2(Hh, Wd / 2), sl = Math.hypot(Hh, Wd / 2);
        [-1, 1].forEach((s) => P.box(g, 0.05, sl, L, s < 0 ? olive : oliveD, s * Wd / 4, Hh / 2, 0, 0, 0, s * (Math.PI / 2 - a)));
        this.tri(S, g, [-Wd / 2, 0, -L / 2], [Wd / 2, 0, -L / 2], [0, Hh, -L / 2], olive);
        P.box(g, 0.08, 0.08, L + 0.3, steel, 0, Hh + 0.02, 0);
        g.updateWorldMatrix(true, true);
        S.col(-11.5 - Wd / 2, 0, 70.5 - L / 2, -11.5 + Wd / 2, Hh, 70.5 - L / 2 + 0.3);
        [-1, 1].forEach((s) => S.col(-11.5 + s * Wd / 2 - 0.25, 0, 70.5 - L / 2, -11.5 + s * Wd / 2 + 0.25, 1.0, 70.5 + L / 2));
        // a camp bed inside
        P.box(g, 0.8, 0.4, 1.9, P.lam(0x5a5e4a), -0.6, 0.2, -0.6);
      }
      // the table they worked at: a field radio, papers, a lamp
      {
        const tx = -8.2, tz = 66.4;
        P.box(scene, 1.9, 0.05, 0.85, P.lam(0x6a6e70), tx, 0.76, tz);
        [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]].forEach(([a, b]) => P.box(scene, 0.04, 0.74, 0.04, steel, tx + a, 0.37, tz + b));
        P.box(scene, 0.45, 0.28, 0.24, oliveD, tx - 0.5, 0.93, tz - 0.1);
        P.box(scene, 0.012, 0.9, 0.012, steel, tx - 0.34, 1.5, tz - 0.16, 0.2, 0, 0.15);
        P.box(scene, 0.3, 0.012, 0.22, P.lam(0xd8d2c0), tx + 0.1, 0.79, tz + 0.1, 0, 0.3, 0);
        P.box(scene, 0.25, 0.012, 0.3, P.lam(0xcfc8b2), tx + 0.45, 0.79, tz - 0.05, 0, -0.2, 0);
        S.col(tx - 0.95, 0, tz - 0.45, tx + 0.95, 0.8, tz + 0.45);
        S.spot(tx + 0.55, 0.8, tz + 0.18, "checkpoint");
        // folding chairs, one knocked over
        P.box(scene, 0.42, 0.04, 0.42, steel, tx - 0.3, 0.45, tz + 0.8);
        P.box(scene, 0.42, 0.45, 0.04, steel, tx - 0.3, 0.68, tz + 1.0);
        P.box(scene, 0.42, 0.42, 0.04, steel, tx + 0.8, 0.22, tz + 1.1, 1.3, 0.4, 0);
      }
      // sandbag walls: an L round the post
      const bags = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.62)), ry = Math.atan2(-(z1 - z0), x1 - x0);
        for (let layer = 0; layer < 3; layer++) {
          for (let i = 0; i < n; i++) {
            const t = (i + 0.5 + (layer % 2) * 0.5) / n;
            if (t > 1) continue;
            P.box(scene, 0.6, 0.24, 0.36, (i + layer) % 3 ? sand : sandD, x0 + (x1 - x0) * t, 0.12 + layer * 0.24, z0 + (z1 - z0) * t, 0, ry + (R() - 0.5) * 0.1, (R() - 0.5) * 0.06);
          }
        }
        S.col(Math.min(x0, x1) - 0.25, 0, Math.min(z0, z1) - 0.25, Math.max(x0, x1) + 0.25, 0.74, Math.max(z0, z1) + 0.25);
      };
      bags(-15.2, 63.6, -5.2, 63.6);
      bags(-15.5, 64.2, -15.5, 68.4);
      // concrete barriers funnelling the way in from the gate
      const jersey = P.lam(0x9a968a), stripe = P.lam(0xa84a2a);
      [[-6.4, 73.4, 0.35], [6.2, 73.1, -0.3], [8.9, 71.6, -0.5]].forEach(([x, z, ry]) => {
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
        P.box(g, 3.0, 0.3, 0.6, jersey, 0, 0.15, 0);
        P.box(g, 3.0, 0.55, 0.3, jersey, 0, 0.55, 0);
        P.box(g, 3.02, 0.12, 0.31, stripe, 0, 0.62, 0);
        S.colOf(g);
      });
      // the floodlight tower, dead
      {
        const x = -16.8, z = 71.8;
        [0, 2.1, 4.2].forEach((a) => P.box(scene, 0.07, 3.2, 0.07, steel, x + Math.cos(a) * 0.5, 1.5, z + Math.sin(a) * 0.5, Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17));
        P.box(scene, 0.1, 2.2, 0.1, steel, x, 3.9, z);
        P.box(scene, 1.4, 0.5, 0.3, P.lam(0x3a3c3e), x, 5.05, z - 0.1, 0.35, 0, 0);
        P.box(scene, 1.25, 0.38, 0.02, P.lam(0x6a6e6a), x, 5.0, z - 0.26, 0.35, 0, 0);
        S.col(x - 0.6, 0, z - 0.6, x + 0.6, 3, z + 0.6);
        world.perches.push({ x, y: 5.32, z: z - 0.1, yaw: 0 });
      }
      // their sign, facing back up the path at anyone coming out
      {
        const x = -4.4, z = 70.4;
        [-0.9, 0.9].forEach((dx) => { P.box(scene, 0.08, 1.6, 0.08, steel, x + dx, 0.8, z); });
        S.api.addCanvasBox(x, 1.75, z, 2.3, 0.9, 0.06, (ctx, cv) => {
          ctx.fillStyle = "#e8e2cf"; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = "#b0302a"; ctx.fillRect(0, 0, cv.width, 30);
          ctx.textAlign = "center"; ctx.fillStyle = "#fff"; G.fitFont(ctx, G.T("world.rescueUnit"), 20, 240); ctx.fillText(G.T("world.rescueUnit"), 128, 22);
          ctx.fillStyle = "#1c2430"; G.fitFont(ctx, G.T("world.checkpoint"), 30, 236); ctx.fillText(G.T("world.checkpoint"), 128, 72);
          G.fitFont(ctx, G.T("world.checkpointSub"), 17, 236); ctx.fillStyle = "#3a4450"; ctx.fillText(G.T("world.checkpointSub"), 128, 104);
        }, 0x3a3c3e, Math.PI);
        S.col(x - 1.2, 0, z - 0.1, x + 1.2, 2.3, z + 0.1);
      }
      // their truck, which never left
      {
        const g = new THREE.Group(); g.position.set(15.5, 0, 67.5); g.rotation.y = 0.32; scene.add(g);
        const body = P.lam(0x5a6440), cover = P.lam(0x4a5236), tyre = P.lam(0x1a1a1a), glass = P.lam(0x1c2228), light = P.lam(0xb8b0a0);
        P.box(g, 2.3, 1.1, 5.8, body, 0, 1.05, 0);
        P.box(g, 2.2, 1.3, 1.9, body, 0, 2.2, -1.9);
        P.box(g, 2.0, 0.55, 0.05, glass, 0, 2.35, -2.86);
        P.box(g, 2.35, 1.5, 3.7, cover, 0, 2.3, 1.0);
        [[-1.1, -1.9], [1.1, -1.9], [-1.1, 1.6], [1.1, 1.6]].forEach(([a, b], i) => P.cyl(g, 0.5, 0.5, 0.35, 12, tyre, a, i === 3 ? 0.36 : 0.5, b, 0, 0, Math.PI / 2));
        [-0.8, 0.8].forEach((a) => P.box(g, 0.3, 0.2, 0.05, light, a, 1.2, -2.93));
        P.box(g, 2.36, 0.25, 0.8, P.lam(0xe8e2cf), 0, 1.35, -1.2);
        g.updateWorldMatrix(true, true);
        const b = new THREE.Box3().setFromObject(g); b.max.y = 3; world.colliders.push(b);
        S.take(b.min.x, b.min.z, b.max.x, b.max.z);
        S.noGrass(b.min.x + 0.3, b.min.z + 0.3, b.max.x - 0.3, b.max.z - 0.3);
        world.perches.push({ x: 15.5, y: 3.08, z: 68, yaw: 0.3 });
      }
      S.noGrass(-16, 63.2, -4.8, 73.2);
      S.take(-17.5, 62.5, -4, 74);
      S.feature({ kind: "rect", minX: -16, maxX: -5, minZ: 63.4, maxZ: 72.8, fill: "block" });
      S.landmark("CHECKPOINT", -10, 68, 6);
    },

    // ---- behind the gym: where the school put what it did not want -------
    backYard(S) {
      const { P, scene, R, world } = S;
      // the school bus, nose into the fence
      {
        const g = new THREE.Group(); g.position.set(-10, 0, -99.6); g.rotation.y = 0.1; scene.add(g);
        const yel = P.lam(0xb8922a), yelD = P.lam(0x9a7a26), black = P.lam(0x1c1c1e), glass = P.lam(0x1c2228), rust = P.lam(0x6a4a2e), tyre = P.lam(0x1a1a1a);
        P.box(g, 11, 2.3, 2.5, yel, 0, 1.55, 0);
        P.box(g, 11.05, 0.18, 2.55, black, 0, 1.05, 0);
        P.box(g, 11, 0.3, 2.4, yelD, 0, 2.85, 0);
        for (let i = 0; i < 8; i++) { const x = -4.6 + i * 1.2; [-1, 1].forEach((s) => P.box(g, 0.95, 0.75, 0.04, (i + s) % 4 ? glass : P.basic(0x07080a), x, 2.0, s * 1.26)); }
        P.box(g, 0.04, 0.9, 2.1, glass, 5.52, 2.05, 0);
        P.box(g, 0.05, 1.7, 0.9, P.basic(0x07080a), 4.6, 1.35, 1.26);          // the door stands open
        for (let k = 0; k < 7; k++) P.box(g, 0.3 + R() * 0.8, 0.2 + R() * 0.5, 0.02, rust, (R() - 0.5) * 10, 1.3 + R() * 1.2, (R() < 0.5 ? 1 : -1) * 1.27);
        [[-3.6, -1.1], [-3.6, 1.1], [3.4, -1.1], [3.4, 1.1]].forEach(([a, b]) => P.cyl(g, 0.5, 0.5, 0.3, 12, tyre, a, 0.5, b, Math.PI / 2, 0, 0));
        const sign = S.api.addCanvasBox(0, 0, 0, 1.8, 0.35, 0.04, (ctx, cv) => { ctx.fillStyle = "#0c0c0c"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.textAlign = "center"; ctx.fillStyle = "#ffb03a"; G.fitFont(ctx, G.T("world.schoolBus"), 60, 240); ctx.fillText(G.T("world.schoolBus"), 128, 86); }, 0x1c1c1c, Math.PI / 2);
        scene.remove(sign); g.add(sign); sign.position.set(5.53, 2.72, 0); sign.rotation.set(0, Math.PI / 2, 0);
        g.updateWorldMatrix(true, true);
        const b = new THREE.Box3().setFromObject(g); b.max.y = 3.2; world.colliders.push(b);
        S.take(b.min.x - 0.5, b.min.z - 0.5, b.max.x + 0.5, b.max.z + 0.5);
        S.noGrass(b.min.x + 0.2, b.min.z + 0.2, b.max.x - 0.2, b.max.z - 0.2);
        S.feature({ kind: "rect", minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, fill: "block" });
        world.perches.push({ x: -12, y: 3.02, z: -99.8, yaw: 0.1 });
        const door = new THREE.Vector3(4.6, 0, 2.0).applyMatrix4(g.matrixWorld);
        S.spot(door.x, 0.02, door.z, "bus");
      }
      // bins, a generator, a heap of the old desks, the water tower
      const green = P.lam(0x2f4a36), greenD = P.lam(0x223528), lid = P.lam(0x1c2a20);
      [[9.5, -100.8, 0.05], [12.9, -100.5, -0.08]].forEach(([x, z, ry], i) => {
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
        P.box(g, 2.2, 1.35, 1.25, i ? greenD : green, 0, 0.72, 0);
        P.box(g, 2.25, 0.08, 1.3, lid, 0, 1.44, i ? 0 : -0.5, i ? 0 : -1.1, 0, 0);
        S.colOf(g.children[0]);
        S.take(x - 1.4, z - 1, x + 1.4, z + 1);
      });
      {
        const g = new THREE.Group(); g.position.set(19, 0, -91.8); scene.add(g);
        P.box(g, 2.2, 1.3, 1.1, P.lam(0x5a6448), 0, 0.65, 0);
        P.box(g, 0.5, 0.5, 0.05, P.lam(0xc0a030), 0.6, 0.9, 0.56);
        P.cyl(g, 0.06, 0.06, 1.2, 6, P.lam(0x3a3a3a), -0.8, 1.9, 0);
        S.colOf(g.children[0]);
        S.take(17.5, -92.8, 20.5, -90.8);
      }
      {
        const wood = [P.lam(0x6b4a2f), P.lam(0x7a5535), P.lam(0x5a3d26)], leg = P.lam(0x3a3a3a);
        for (let i = 0; i < 16; i++) {
          const g = new THREE.Group(); g.position.set(1.5 + (R() - 0.5) * 3.2, R() * 1.1, -101.2 + (R() - 0.5) * 1.8); g.rotation.set((R() - 0.5) * 1.6, R() * 3, (R() - 0.5) * 1.6); scene.add(g);
          P.box(g, 1.2, 0.05, 0.6, wood[i % 3], 0, 0.36, 0);
          [[-0.55, -0.26], [0.55, -0.26], [-0.55, 0.26], [0.55, 0.26]].forEach(([a, b]) => P.box(g, 0.04, 0.7, 0.04, leg, a, 0, b));
        }
        S.col(-0.6, 0, -102.6, 3.6, 1.6, -99.8);
        S.take(-1, -103, 4, -99.4);
        world.perches.push({ x: 1.5, y: 1.9, z: -101.2, yaw: 2 });
      }
      {
        const x = 26, z = -100.5, legM = P.lam(0x55585c), tank = P.lam(0x8a8e88), rustM = P.lam(0x6a4a2e);
        [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(([a, b]) => { P.box(scene, 0.14, 5.6, 0.14, legM, x + a, 2.8, z + b); S.col(x + a - 0.12, 0, z + b - 0.12, x + a + 0.12, 5.6, z + b + 0.12); });
        [1.6, 3.6].forEach((y) => { P.box(scene, 2.3, 0.06, 0.06, legM, x, y, z - 1.1); P.box(scene, 2.3, 0.06, 0.06, legM, x, y, z + 1.1); });
        P.cyl(scene, 1.6, 1.6, 2.4, 16, tank, x, 6.8, z);
        P.cyl(scene, 1.65, 1.2, 0.5, 16, rustM, x, 8.25, z);
        for (let k = 0; k < 9; k++) P.box(scene, 0.06, 0.04, 0.4, legM, x + 1.3, 0.4 + k * 0.6, z, 0, 0, 0);
        S.take(x - 1.8, z - 1.8, x + 1.8, z + 1.8);
        world.perches.push({ x, y: 8.5, z, yaw: 0.8 });
      }
      S.car = G.SchoolDress.car.bind(G.SchoolDress);
      S.car({ scene, world }, R, 36, -99.2, 0.2);
      S.take(33, -101.5, 39, -97);
      S.landmark("BACKYARD", 4, -98, 13);
    },

    // ---- a Thai sala: a raised floor, posts, open sides, a steep gable roof
    // of red tiles, built-in benches, a finial curling up from each end of
    // the ridge -------------------------------------------------------------
    sala(S, cx, cz, rot, key, withTable) {
      const { P, scene, R, world } = S;
      const W = 5.2, D = 7.4, PH = 0.35, POST = 2.7;
      const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rot; scene.add(g);
      const base = P.lam(0x8a867c), plank = P.lam(0x7a5a3a), plankD = P.lam(0x6a4c30), wood = P.lam(0x6a4a30), woodD = P.lam(0x4a3322);
      const tile = P.lam(0x8a3a2a), tileD = P.lam(0x6e2e24), tileL = P.lam(0x9a4a32), gold = P.lam(0xb08a3a), white = P.lam(0xd2c8b2), red = P.lam(0x7a2a24);
      // the floor, raised a step, planked
      P.box(g, W + 0.4, PH, D + 0.4, base, 0, PH / 2, 0);
      for (let i = 0; i < 12; i++) P.box(g, W - 0.04, 0.03, D / 12 - 0.03, i % 2 ? plank : plankD, 0, PH + 0.015, -D / 2 + (i + 0.5) * (D / 12));
      P.box(g, 1.8, PH * 0.5, 0.55, base, 0, PH * 0.25, D / 2 + 0.47);
      // posts and the beams round the top
      const posts = [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]].map(([a, b]) => [a * (W / 2 - 0.2), b * (D / 2 - 0.2)]);
      posts.forEach(([u, v]) => { P.box(g, 0.24, POST, 0.24, woodD, u, PH + POST / 2, v); P.box(g, 0.34, 0.12, 0.34, red, u, PH + 0.06, v); });
      [-1, 1].forEach((s) => {
        P.box(g, W, 0.2, 0.2, wood, 0, PH + POST - 0.1, s * (D / 2 - 0.2));
        P.box(g, 0.2, 0.2, D, wood, s * (W / 2 - 0.2), PH + POST - 0.1, 0);
      });
      // built-in benches down both long sides and across the back
      [-1, 1].forEach((s) => {
        P.box(g, 0.46, 0.07, D - 1.0, wood, s * (W / 2 - 0.5), PH + 0.45, 0);
        P.box(g, 0.06, 0.42, D - 1.0, wood, s * (W / 2 - 0.26), PH + 0.72, 0);
        for (let k = -1; k <= 1; k++) P.box(g, 0.4, 0.42, 0.06, woodD, s * (W / 2 - 0.5), PH + 0.21, k * (D / 2 - 0.9));
      });
      P.box(g, W - 1.4, 0.07, 0.46, wood, 0, PH + 0.45, -D / 2 + 0.5);
      P.box(g, W - 1.4, 0.42, 0.06, wood, 0, PH + 0.72, -D / 2 + 0.26);
      if (withTable) {
        P.box(g, 1.3, 0.06, 0.8, wood, 0, PH + 0.72, -0.6);
        P.box(g, 0.12, 0.7, 0.12, woodD, 0, PH + 0.36, -0.6);
      }
      // the roof: two steep planes meeting on a ridge along the length, deep
      // eaves, rows of tiles, a ridge cap
      const pitch = 0.62, half = W / 2 + 0.75, slope = half / Math.cos(pitch), rise = half * Math.tan(pitch);
      const eave = PH + POST + 0.05, ridgeY = eave + rise, L = D + 1.6;
      [-1, 1].forEach((s) => {
        P.box(g, slope, 0.1, L, tile, s * half / 2, eave + rise / 2, 0, 0, 0, -s * pitch);
        for (let k = 1; k < 5; k++) {
          const t = k / 5, u = s * half * (1 - t), y = eave + rise * t;
          P.box(g, 0.08, 0.04, L + 0.02, k % 2 ? tileD : tileL, u, y + 0.07, 0, 0, 0, -s * pitch);
        }
        P.box(g, 0.08, 0.14, L, white, s * (half - 0.02), eave - 0.05, 0);          // the fascia along each eave
      });
      P.box(g, 0.3, 0.2, L + 0.1, tileD, 0, ridgeY + 0.04, 0);
      // gable ends: a cream board with a gold edge and a serrated bargeboard
      [-1, 1].forEach((e) => {
        const v = e * (L / 2 - 0.02);
        this.tri(S, g, [-half * 0.93, eave, v], [half * 0.93, eave, v], [0, ridgeY - 0.06, v], white);
        [-1, 1].forEach((s) => {
          const mx = s * half * 0.5, my = eave + rise * 0.5;
          P.box(g, slope * 0.98, 0.12, 0.08, gold, mx, my + 0.05, v + e * 0.03, 0, 0, -s * pitch);
          for (let k = 1; k < 8; k++) {
            const t = k / 8, u = s * half * (1 - t), y = eave + rise * t;
            P.box(g, 0.06, 0.2, 0.05, gold, u, y + 0.2, v + e * 0.05, 0, 0, -s * pitch * 0.4);
          }
          // the hang hong: a small curl up at each lower corner
          P.box(g, 0.08, 0.3, 0.07, gold, s * half * 0.98, eave + 0.18, v + e * 0.04, 0, 0, s * 0.5);
        });
        // the chofa: a slender horn rising and curling out from the ridge end
        P.box(g, 0.1, 0.34, 0.12, gold, 0, ridgeY + 0.2, v + e * 0.02, e * 0.35, 0, 0);
        P.box(g, 0.08, 0.3, 0.1, gold, 0, ridgeY + 0.47, v + e * 0.12, e * 0.85, 0, 0);
        P.box(g, 0.06, 0.2, 0.08, gold, 0, ridgeY + 0.6, v + e * 0.28, e * 1.4, 0, 0);
        // a small diamond motif on the gable
        P.box(g, 0.26, 0.26, 0.03, red, 0, eave + rise * 0.42, v + e * 0.02, 0, 0, Math.PI / 4);
      });
      g.updateWorldMatrix(true, true);
      // the floor as a height zone (and its step), the posts and the benches
      // as colliders -- the benches block, the open front and the gap
      // between them do not
      const W2 = (v) => new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(g.matrixWorld);
      const zoneOf = (u0, v0, u1, v1, h) => {
        const a = W2([u0, 0, v0]), b = W2([u1, 0, v1]);
        world.heightZones.push({ minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), height: h });
        return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
      };
      const fz = zoneOf(-W / 2 - 0.2, -D / 2 - 0.2, W / 2 + 0.2, D / 2 + 0.2, PH);
      zoneOf(-0.9, D / 2 + 0.2, 0.9, D / 2 + 0.75, PH * 0.5);
      const colL = (u0, v0, u1, v1, y0, y1) => { const a = W2([u0, 0, v0]), b = W2([u1, 0, v1]); S.col(a.x, y0, a.z, b.x, y1, b.z); };
      posts.forEach(([u, v]) => colL(u - 0.14, v - 0.14, u + 0.14, v + 0.14, 0, PH + POST));
      [-1, 1].forEach((s) => colL(s * (W / 2 - 0.75), -D / 2 + 0.25, s * (W / 2 - 0.2), D / 2 - 0.5, PH, PH + 0.95));
      colL(-W / 2 + 0.7, -D / 2 + 0.25, W / 2 - 0.7, -D / 2 + 0.75, PH, PH + 0.95);
      if (withTable) colL(-0.65, -1.0, 0.65, -0.2, PH, PH + 0.78);
      S.noGrass(fz.minX - 0.3, fz.minZ - 0.3, fz.maxX + 0.3, fz.maxZ + 0.3);
      S.take(fz.minX - 1.2, fz.minZ - 1.2, fz.maxX + 1.2, fz.maxZ + 1.2);
      S.feature({ kind: "sala", minX: fz.minX, maxX: fz.maxX, minZ: fz.minZ, maxZ: fz.maxZ, fill: "sala" });
      S.landmark(key, cx, cz, 4.5);
      [-1, 1].forEach((e) => { const p = W2([0, ridgeY + 0.3, e * (L / 2 - 0.3)]); world.perches.push({ x: p.x, y: ridgeY + 0.18, z: p.z, yaw: rot }); });
      const sp = W2(withTable ? [0.25, 0, -0.55] : [0, 0, -D / 2 + 0.5]);
      S.spot(sp.x, withTable ? PH + 0.75 : PH + 0.49, sp.z, "sala");
    },

    // ---- lamp posts along the paths, most of them dead -------------------
    lamps(S) {
      const { P, scene, world, api } = S;
      const post = P.lam(0x55565a);
      [[-26.2, 22, 1], [-26.2, -14, 0], [-26.2, -52, 1], [-26.2, -86, 0], [26.2, 20, 0], [26.2, -24, 1], [26.2, -62, 0], [-12, -94.2, 1], [14, -94.2, 0], [-38, 63.8, 1], [18, 63.8, 0]].forEach(([x, z, lit]) => {
        P.box(scene, 0.22, 4.6, 0.22, post, x, 2.3, z);
        P.box(scene, 0.9, 0.26, 0.5, post, x, 4.6, z);
        S.col(x - 0.16, 0, z - 0.16, x + 0.16, 4.6, z + 0.16);
        if (lit) { api.addGlowBox(x, 4.44, z, 0.62, 0.06, 0.36, 0xffd9a0); const l = api.addLight(x, 4.3, z, 0xffcf96, 0.8, 2.4); l.distance = 15; }
        else P.box(scene, 0.62, 0.06, 0.36, P.lam(0x2a2a28), x, 4.44, z);
        world.perches.push({ x, y: 4.75, z, yaw: 0 });
      });
    },

    // ---- things lying about the open ground to take cover behind ---------
    // (F2: "obstacles across the open areas") -- a concrete barrier, a wall
    // of sandbags, a stack of tyres, pallets, oil drums, a fallen tree, desks
    // thrown out of a window, a heap of rubble. None within reach of a path,
    // a route node or the fence.
    obstacles(S) {
      const { P, scene, R, world } = S;
      const conc = P.lam(0x9a968a), sand = P.lam(0x8a7a56), tyre = P.lam(0x1c1c1c), pallet = P.lam(0x8a7250), drum = [P.lam(0x2f4a6a), P.lam(0x7a3a2a), P.lam(0x5a5a3a)], bark = P.lam(0x3b2f24), barkL = P.lam(0x4f4030), rubble = P.lam(0x6a665e), wood = P.lam(0x6b4a2f);
      const kinds = ["barrier", "sandbags", "tyres", "pallets", "drums", "log", "desks", "rubble"];
      const placed = [];
      let tries = 0, n = 0;
      while (n < 34 && tries++ < 3000) {
        const x = S.C.x0 + 4 + R() * (S.C.x1 - S.C.x0 - 8), z = S.C.z0 + 4 + R() * (S.C.z1 - S.C.z0 - 8);
        const kind = kinds[n % kinds.length], rad = kind === "log" ? 3.2 : 1.8;
        if (!this.free(S, x, z, rad)) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 9)) continue;
        placed.push({ x, z });
        n++;
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = R() * Math.PI; scene.add(g);
        let solid = true;
        if (kind === "barrier") { P.box(g, 3.0, 0.3, 0.6, conc, 0, 0.15, 0); P.box(g, 3.0, 0.55, 0.3, conc, 0, 0.55, 0); if (R() < 0.5) { P.box(g, 3.0, 0.3, 0.6, conc, 0.4, 0.15, 1.0, 0, 0.5, 0); P.box(g, 3.0, 0.55, 0.3, conc, 0.4, 0.55, 1.0, 0, 0.5, 0); } }
        else if (kind === "sandbags") { for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) P.box(g, 0.6, 0.24, 0.36, sand, -0.95 + i * 0.62 + (l % 2) * 0.3, 0.12 + l * 0.24, 0, 0, (R() - 0.5) * 0.15, 0); }
        else if (kind === "tyres") { const k = 3 + Math.floor(R() * 4); for (let i = 0; i < k; i++) P.cyl(g, 0.42, 0.42, 0.24, 12, tyre, (i % 2) * 0.1, 0.12 + i * 0.24, (R() - 0.5) * 0.1); if (R() < 0.6) P.cyl(g, 0.42, 0.42, 0.24, 12, tyre, 0.9, 0.42, 0.3, Math.PI / 2, 0.4, 0); }
        else if (kind === "pallets") { for (let i = 0; i < 5; i++) P.box(g, 1.2, 0.14, 1.0, pallet, (R() - 0.5) * 0.2, 0.07 + i * 0.16, (R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.3, 0); }
        else if (kind === "drums") { for (let i = 0; i < 4; i++) { if (i === 3 && R() < 0.5) { P.cyl(g, 0.3, 0.3, 0.9, 10, drum[i % 3], 0.9, 0.3, 0.6, Math.PI / 2, 0, 0); continue; } P.cyl(g, 0.3, 0.3, 0.9, 10, drum[i % 3], (i % 2) * 0.66 - 0.33, 0.45, Math.floor(i / 2) * 0.66 - 0.33); } }
        else if (kind === "log") { P.cyl(g, 0.38, 0.45, 6.2, 9, bark, 0, 0.4, 0, 0, 0, Math.PI / 2); for (let i = 0; i < 4; i++) P.box(g, 1.2 + R(), 0.12, 0.12, barkL, -2 + i * 1.3, 0.6 + R() * 0.4, (R() - 0.5) * 0.6, 0, R() * 2, 0.4 + R() * 0.5); P.cyl(g, 0.5, 0.2, 0.9, 8, barkL, 3.2, 0.5, 0, 0, 0, Math.PI / 2); }
        else if (kind === "desks") { for (let i = 0; i < 3; i++) { const d = new THREE.Group(); d.position.set((R() - 0.5) * 1.6, R() * 0.4, (R() - 0.5) * 1.4); d.rotation.set((R() - 0.5) * 2, R() * 3, (R() - 0.5) * 2); g.add(d); P.box(d, 1.2, 0.05, 0.6, wood, 0, 0.36, 0); [[-0.55, -0.26], [0.55, -0.26], [-0.55, 0.26], [0.55, 0.26]].forEach(([a, b]) => P.box(d, 0.04, 0.7, 0.04, P.lam(0x3a3a3a), a, 0, b)); } }
        else { solid = false; for (let i = 0; i < 9; i++) P.box(g, 0.3 + R() * 0.6, 0.15 + R() * 0.3, 0.3 + R() * 0.5, rubble, (R() - 0.5) * 2, 0.1, (R() - 0.5) * 2, R(), R() * 3, R()); }
        g.updateWorldMatrix(true, true);
        const b = new THREE.Box3().setFromObject(g);
        if (solid && b.max.y > 0.6) { b.max.y = Math.max(b.max.y, 1.0); world.colliders.push(b); }
        S.take(b.min.x - 0.5, b.min.z - 0.5, b.max.x + 0.5, b.max.z + 0.5);
        if (solid) S.feature({ kind: "rect", minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, fill: "block" });
      }
    },

    // ---- trees all round the grounds, thickest along the fence -----------
    trees(S) {
      const { R, world } = S;
      const kinds = ["dead", "leafy", "twisted", "leafy", "dead"];
      let n = 0, tries = 0;
      while (n < 36 && tries++ < 4000) {
        // two in three along the edges, the rest in the open
        const edge = R() < 0.66;
        let x, z;
        if (edge) {
          const side = Math.floor(R() * 4);
          x = side < 2 ? S.C.x0 + 4 + R() * (S.C.x1 - S.C.x0 - 8) : side === 2 ? S.C.x0 + 3.5 + R() * 3 : S.C.x1 - 3.5 - R() * 3;
          z = side === 0 ? S.C.z0 + 3.5 + R() * 3 : side === 1 ? S.C.z1 - 3.5 - R() * 3 : S.C.z0 + 4 + R() * (S.C.z1 - S.C.z0 - 8);
        } else { x = S.C.x0 + 6 + R() * (S.C.x1 - S.C.x0 - 12); z = S.C.z0 + 6 + R() * (S.C.z1 - S.C.z0 - 12); }
        if (!this.free(S, x, z, 1.2)) continue;
        if (world.campusTrees.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue;
        if (Math.abs(x) < 27 && z > 33 && z < 61) continue;            // the old yard has its own
        world.campusTrees.push({ x, z, kind: kinds[n % kinds.length] });
        S.take(x - 1, z - 1, x + 1, z + 1);
        n++;
      }
    },
  };
})();
