// ===================================================================
// The school's shell (round 3)
// -------------------------------------------------------------------
// With the grounds going all the way round the building, its sides and back
// are in plain view for the first time -- and they were blank walls. This
// dresses the outside of the classroom block, the entry block and the sports
// hall: rows of windows on every storey (lit where the room behind them has
// its light on, dark where it has not, a few broken or boarded), a brick
// plinth, a string course at each floor, a cornice under the roof line,
// downpipes, grime and moss. On the inside of the outer walls the rooms get
// windows too, where the wall is free, and some of those have torn curtains
// that move in the draught (G3, built by js/details.js from world.curtains).
// Since the newer list's round 3 (H) those windows are real: inside() cuts
// an opening through the outer wall for each, with a block in it that stops
// walking but not rounds, and js/glass.js puts a pane in it. From outside,
// the room behind is a dark box (zone "Y": drawn only when you are out).
//
// All of it is painted from the palette texture (G.SchoolDress.P): it merges
// into the same few draw calls per cell as the rest of the building.
// ===================================================================
(function () {
  G.SchoolShell = {
    build(api) {
      const P = G.SchoolDress.P;
      const { scene, world, cfg, HALF, ROOM_W, F2, F3, storeyList } = api;
      const R = G.makeRng(8080);
      const X = HALF + ROOM_W;                               // 16: the outer walls' centre line
      const FACE = X + 0.2;                                  // their outer face
      const E = api.ENTRY, B = api.BOSS;
      const zFront = E.cz + E.d / 2, zBack = E.cz - E.d / 2;  // 33, 20
      const zGym = B.cz + B.d / 2, zGymBack = B.cz - B.d / 2; // -70, -87
      const top = storeyList.length === 3 ? F3 + 4.2 : F2 + 4.2;
      const render = P.lam(0xa89f86), renderD = P.lam(0x968d76), brick = P.lam(0x6b4a40), lint = P.lam(0x8a8578), sill = P.lam(0xa8a295);
      const frame = P.lam(0x5a4632), glassDark = P.basic(0x1a222c), glassLit = P.basic(0x8a6a3c), glassDim = P.basic(0x4a3a26), broken = P.basic(0x07080a);
      const pipe = P.lam(0x5a5e5e), moss = P.lam(0x3e4e2a), stain = P.lam(0x6e6a5c);
      const lightOf = (key) => {
        const f = (world.fixtures || []).find((x) => x.key === key);
        return f ? f.mode : "off";
      };
      const roomAt = (x, z, y) => {
        const r = world.regions.find((g) => x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ && Math.abs((g.y || 0) - y) < 1);
        return r ? r.name : null;
      };

      // (newer list, round 3) the rooms' real windows: their openings go
      // right through, so the render is cut round them and their outside
      // frame gets no painted glass (js/glass.js has the pane)
      const real = new Set((world.realWindows || []).map((w) => w.s + "|" + w.base.toFixed(2) + "|" + w.z.toFixed(2)));
      const isReal = (s, base, z) => real.has(s + "|" + base.toFixed(2) + "|" + z.toFixed(2));
      // the render over a face (axis "x": the face at x = fixed, running
      // z0..z1), cut round the openings in it
      const skin = (s, xAt, z0, z1, y0, y1, mat) => {
        const holes = (world.realWindows || []).filter((w) => w.s === s && w.z > z0 && w.z < z1 && w.y1 > y0 && w.y0 < y1);
        const cols = [];
        holes.forEach((h) => { let c = cols.find((q) => Math.abs(q.z - h.z) < 0.01); if (!c) cols.push(c = { z: h.z, w: h.w, hs: [] }); c.hs.push(h); });
        cols.sort((a, b) => a.z - b.z);
        const piece = (za, zb, ya, yb) => { if (zb - za > 0.02 && yb - ya > 0.02) P.box(scene, 0.05, yb - ya, zb - za, mat, xAt, (ya + yb) / 2, (za + zb) / 2); };
        let t = z0;
        cols.forEach((c) => {
          const a = c.z - c.w / 2, b = c.z + c.w / 2;
          piece(t, a, y0, y1);
          let yy = y0;
          c.hs.sort((p, q) => p.y0 - q.y0).forEach((h) => { piece(a, b, yy, h.y0); yy = h.y1; });
          piece(a, b, yy, y1);
          t = b;
        });
        piece(t, z1, y0, y1);
      };

      // one window on an outside face; `n` is the outward normal (+-1) along
      // `axis` ("x": the face is at x = fixed, the window runs along z)
      const outRects = [];                                    // (kept for the wear on the walls: js/wear.js)
      const outWindow = (axis, fixed, n, t, y, key, w, h, isOpen) => {
        w = w || 1.5; h = h || 1.4;
        if (axis === "x") outRects.push({ s: n, z: t, y, w: w + 0.5, h: h + 0.6 });
        const mode = key ? lightOf(key) : "off";
        const roll = R();
        const glass = roll < 0.08 ? broken : mode === "steady" ? (roll < 0.6 ? glassLit : glassDim) : mode === "flicker" ? glassDim : glassDark;
        const at = (dn, dt, dy, sx, sy, sz, m) => {
          if (axis === "x") P.box(scene, sz, sy, sx, m, fixed + n * dn, y + dy, t + dt);
          else P.box(scene, sx, sy, sz, m, t + dt, y + dy, fixed + n * dn);
        };
        // (a painted one sits just outside the render -- it was buried in
        // it, so from the grounds every window showed plain wall)
        if (!isOpen) at(0.052, 0, 0, w, h, 0.01, glass);
        at(0.06, 0, h / 2, w + 0.12, 0.08, 0.07, frame); at(0.06, 0, -h / 2, w + 0.12, 0.08, 0.07, frame);
        at(0.06, -w / 2, 0, 0.08, h, 0.07, frame); at(0.06, w / 2, 0, 0.08, h, 0.07, frame);
        at(0.06, 0, 0, 0.05, h, 0.05, frame);
        at(0.12, 0, -h / 2 - 0.1, w + 0.35, 0.1, 0.26, sill);
        at(0.08, 0, h / 2 + 0.14, w + 0.35, 0.16, 0.18, lint);
        if (roll > 0.94 && !isOpen) { at(0.1, 0, 0.2, w + 0.2, 0.2, 0.05, P.lam(0x7a6448)); at(0.11, 0, -0.25, w + 0.2, 0.2, 0.05, P.lam(0x6a5640)); }
        // water has run from the sill for years
        if (R() < 0.6) { const sh = 0.6 + R() * 1.1; at(0.012, (R() - 0.5) * w, -h / 2 - 0.15 - sh / 2, 0.2 + R() * 0.4, sh, 0.01, stain); }
      };

      // ---- the classroom block's long sides, every storey ----
      [-1, 1].forEach((s) => {
        const fx = s * FACE;
        // a skin over the plain wall: render (cut round the real windows),
        // with a brick plinth
        skin(s, s * (FACE + 0.02), zGym, zBack, 0.7, top, render);
        P.box(scene, 0.08, 0.7, zFront - zGym, brick, s * (FACE + 0.04), 0.35, (zFront + zGym) / 2);
        // the entry block's end of this side: two storeys
        P.box(scene, 0.05, F2 * 2 - 0.7, zFront - zBack, renderD, s * (FACE + 0.02), 0.7 + (F2 * 2 - 0.7) / 2, (zFront + zBack) / 2);
        // string courses at each floor, the cornice at the top
        storeyList.forEach((fl) => { if (fl > 1) P.box(scene, 0.16, 0.22, zBack - zGym, lint, s * (FACE + 0.08), api.baseOf(fl) + 0.05, (zBack + zGym) / 2); });
        P.box(scene, 0.16, 0.22, zFront - zBack, lint, s * (FACE + 0.08), F2 + 0.05, (zFront + zBack) / 2);
        P.box(scene, 0.34, 0.3, zBack - zGym + 0.4, lint, s * (FACE + 0.16), top - 0.15, (zBack + zGym) / 2);
        P.box(scene, 0.34, 0.3, zFront - zBack + 0.3, lint, s * (FACE + 0.16), F2 * 2 - 0.15, (zFront + zBack) / 2);
        // windows: three a room, every storey
        storeyList.forEach((fl) => {
          const y = api.baseOf(fl) + 1.9;
          cfg.rows.forEach((row) => [-4, 0, 4].forEach((dz) => {
            const z = row.cz + dz, base = api.baseOf(fl), open = isReal(s, base, z);
            // (a real one's frame round its opening: js/schoolshell.js OPEN)
            outWindow("x", fx, s, z, open ? base + (this.OPEN.sill + this.OPEN.head) / 2 : y, roomAt(s * (X - 1), z, base), open ? this.OPEN.w : undefined, open ? this.OPEN.head - this.OPEN.sill : undefined, open);
          }));
        });
        [F2 * 0 + 1.9, F2 + 1.9].forEach((y) => [-3.5, 1.2].forEach((dz) => outWindow("x", fx, s, E.cz + dz, y, y < F2 ? "ENTRY" : roomAt(s * 11, E.cz, F2))));
        // downpipes and the grime they leave
        // (newer list, round 3, I3: the green and grey slabs that stood for
        // moss and grime are soft-edged decals now, js/wear.js)
        const W = G.SchoolWear;
        const grime = (kind, w, h, x, y, z) => {
          if (!W) { P.box(scene, 0.012, h, w, kind === "mould" ? moss : stain, x, y, z); return; }
          const m = W.mark(kind, w, h, "A"); m.position.set(x, y, z); m.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(m);
        };
        for (let z = zGym + 6; z < zFront - 2; z += 22) {
          outRects.push({ s, z, y: top / 2, w: 0.6, h: top });
          P.cyl(scene, 0.07, 0.07, top, 8, pipe, s * (FACE + 0.14), top / 2, z);
          P.box(scene, 0.3, 0.12, 0.5, pipe, s * (FACE + 0.14), top - 0.1, z);
          grime("mould", 1.1, 1.3, s * (FACE + 0.085), 0.65, z);
        }
        // (never up over a ground-floor window's sill: on the brick plinth)
        for (let k = 0; k < 26; k++) { const z = zGym + R() * (zFront - zGym), h = 0.45 + R() * 0.25; grime(R() < 0.6 ? "mould" : "water", 0.7 + R() * 1.2, h, s * (FACE + 0.085), 0.08 + h / 2, z); }
      });

      // ---- the top storey's end walls, above the entry block and the gym ----
      if (storeyList.length === 3) {
        [[zBack, 1], [zGym, -1]].forEach(([zf, n]) => {
          const face = zf + n * 0.2;
          P.box(scene, 2 * FACE, F3 + 4.2 - F2 * 2, 0.05, render, 0, F2 * 2 + (F3 + 4.2 - F2 * 2) / 2, face + n * 0.02);
          P.box(scene, 2 * FACE + 0.4, 0.3, 0.34, lint, 0, top - 0.15, face + n * 0.16);
          [-12.5, -7, 0, 7, 12.5].forEach((x) => outWindow("z", face, n, x, F3 + 1.9, roomAt(x, zf - n * 3, F3)));
        });
      }

      // ---- the sports hall: high windows down its sides, its name on the back
      [-1, 1].forEach((s) => {
        const fx = s * (B.w / 2 + 0.2);
        P.box(scene, 0.05, F2 * 2 - 0.7, B.d, renderD, s * (B.w / 2 + 0.22), 0.7 + (F2 * 2 - 0.7) / 2, B.cz);
        P.box(scene, 0.08, 0.7, B.d, brick, s * (B.w / 2 + 0.24), 0.35, B.cz);
        for (let k = 0; k < 4; k++) outWindow("x", fx, s, zGymBack + 2.5 + k * 4, 6.2, "BOSS", 2.2, 1.1);
      });
      {
        const face = zGymBack - 0.2;
        P.box(scene, B.w, F2 * 2 - 0.7, 0.05, renderD, 0, 0.7 + (F2 * 2 - 0.7) / 2, face - 0.02);
        P.box(scene, B.w + 0.2, 0.7, 0.08, brick, 0, 0.35, face - 0.04);
        const sign = G.SchoolRooms.signPlane(G.T("world.sportsHall"), 5.6, 1.3);
        sign.position.set(0, 6.2, face - 0.08); sign.rotation.y = Math.PI;
        scene.add(sign);
        P.box(scene, 5.9, 1.5, 0.06, P.lam(0x2a2a2c), 0, 6.2, face - 0.05);
        [-12, -6, 6, 12].forEach((x) => outWindow("z", face, -1, x, 6.4, "BOSS", 2.2, 1.1));
      }
      // newer list, round 3 (I3): cracks, stains, mould and worse on the long
      // sides, round the windows and pipes (the side walls of the entry block
      // are the flat render from zBack to zFront, left plain)
      if (G.SchoolWear) G.SchoolWear.outside({ scene, avoid: outRects, sides: [-1, 1].map((s) => ({ s, x: s * (FACE + 0.047), z0: zGym + 0.5, z1: zBack - 0.5, y1: top - 0.4 })) });
      world.wallSegs = null;                                  // (only needed to cut the windows)
    },

    // ---- windows in the rooms' outer walls, where the wall is free; some
    // rooms' windows have torn curtains ----------------------------------------
    // (Newer list, round 3, H: real ones. The wall is cut through -- below the
    // sill, above the head and either side stay wall -- and a pane of glass
    // goes in (js/glass.js), so from a room you see the grounds outside and
    // from outside the dark room behind; a shot or a zombie breaks it. An
    // invisible block fills the opening: nobody walks through a window, but
    // rounds fly through once the glass is gone.)
    OPEN: { w: 1.5, sill: 1.25, head: 2.65 },
    roomPictures() {
      if (this._pics) return this._pics;
      const paint = (mode) => {
        const S = 64, cv = document.createElement("canvas"); cv.width = cv.height = S;
        const c = cv.getContext("2d"), k = mode === "steady" ? 1 : mode === "flicker" ? 0.5 : 0.12;
        const tone = (r, g, b) => `rgb(${Math.round(r * k + 6)},${Math.round(g * k + 8)},${Math.round(b * k + 12)})`;
        const gr = c.createLinearGradient(0, 0, 0, S);
        gr.addColorStop(0, tone(60, 56, 50)); gr.addColorStop(0.18, tone(96, 90, 78)); gr.addColorStop(0.45, tone(150, 138, 112));
        gr.addColorStop(0.62, tone(92, 104, 108)); gr.addColorStop(0.7, tone(60, 52, 40)); gr.addColorStop(1, tone(34, 30, 26));
        c.fillStyle = gr; c.fillRect(0, 0, S, S);
        c.fillStyle = tone(70, 50, 34); c.fillRect(0, 38, S, 2);                        // the dado rail
        if (mode !== "off") {                                                             // the tube
          const g2 = c.createRadialGradient(32, 8, 0, 32, 8, 26);
          g2.addColorStop(0, `rgba(255,244,214,${0.5 * k})`); g2.addColorStop(1, "rgba(255,244,214,0)");
          c.fillStyle = g2; c.fillRect(0, 0, S, 30);
          c.fillStyle = mode === "steady" ? "#f4ecd4" : "#9a9280"; c.fillRect(14, 7, 36, 3);
        } else {                                                                          // a little moonlight on the floor
          c.fillStyle = "rgba(120,140,190,0.18)"; c.beginPath(); c.moveTo(10, 64); c.lineTo(30, 44); c.lineTo(52, 44); c.lineTo(40, 64); c.fill();
        }
        c.fillStyle = tone(26, 20, 16);                                                   // desks and chairs, backlit
        [[4, 46, 16, 3], [26, 47, 14, 3], [46, 46, 16, 3]].forEach(([x, y, w, h]) => { c.fillRect(x, y, w, h); c.fillRect(x + 1, y + h, 2, 12); c.fillRect(x + w - 3, y + h, 2, 12); });
        [[10, 50], [32, 51], [52, 50]].forEach(([x, y]) => { c.fillRect(x, y - 6, 6, 2); c.fillRect(x, y - 6, 1, 14); c.fillRect(x + 5, y - 6, 1, 14); });
        const tex = new THREE.CanvasTexture(cv);
        return new THREE.MeshBasicMaterial({ map: tex });
      };
      return (this._pics = { steady: paint("steady"), flicker: paint("flicker"), off: paint("off") });
    },
    inside(api) {
      const P = G.SchoolDress.P;
      const { scene, world, cfg, HALF, ROOM_W, storeyList } = api;
      const R = G.makeRng(9191);
      const X = HALF + ROOM_W - 0.2;                          // the outer walls' inner face
      const frame = P.lam(0x6b4a2f), sill = P.lam(0xc8c2b0);
      const O = this.OPEN;
      const lightOf = (key) => { const f = (world.fixtures || []).find((x) => x.key === key); return f ? f.mode : "off"; };
      // the room behind the glass, seen from outside only (zone "Y": the
      // room itself is not drawn from the grounds) -- a small painted
      // picture of one: the ceiling and its tube, the far wall with its dado,
      // the backs of desks; lit, failing or dark as the room's own light is
      const behind = this.roomPictures();
      world.realWindows = [];
      world.windowRooms = world.windowRooms || [];
      // what already stands against the outer walls
      scene.updateWorldMatrix(true, true);
      const near = [];
      scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh) return;
        const b = new THREE.Box3().setFromObject(o);
        if (b.isEmpty() || Math.min(Math.abs(b.min.x), Math.abs(b.max.x)) < X - 1.3) return;
        const sz = b.getSize(new THREE.Vector3());
        if (Math.max(sz.x, sz.z) > 8) return;                // not the walls themselves
        near.push(b);
      });
      world.curtains = world.curtains || [];
      const CURTAINS = { classroom: 0.45, library: 0.6, meeting: 0.8, principal: 1, staff: 0.7, lounge: 0.7, nurse: 0.6, music: 0.5, office: 0.4, staffoffice: 0.5, detention: 0.3 };
      const colours = [0x7a3a3a, 0x3a5a7a, 0x6a6a3a, 0x8a7a5a, 0x5a4a6a];
      [-1, 1].forEach((s) => {
        storeyList.forEach((fl) => {
          const base = api.baseOf(fl);
          cfg.rows.forEach((row) => [-4, 0, 4].forEach((dz) => {
            const z = row.cz + dz, y = base + 1.95;
            const b = new THREE.Box3(new THREE.Vector3(s > 0 ? X - 0.6 : -X - 0.05, y - 0.85, z - 1.05), new THREE.Vector3(s > 0 ? X + 0.05 : -X + 0.6, y + 0.85, z + 1.05));
            const stats = world._winStats = world._winStats || { tried: 0, blocked: 0, noRoom: 0, made: 0 };
            stats.tried++;
            if (near.some((n) => n.intersectsBox(b))) { stats.blocked++; return; }
            const reg = world.regions.find((g) => s * X - s * 1 >= g.minX && s * X - s * 1 <= g.maxX && z >= g.minZ && z <= g.maxZ && Math.abs((g.y || 0) - base) < 1);
            if (!reg || /^C\d|^STW|^STT/.test(reg.name)) { stats.noRoom++; return; }
            stats.made++;
            const fx = s * X;
            // (kept, so a zombie spawn that comes in by a window can take one
            // over and break it -- js/zombiefx.js)
            const win = { x: fx, z, base, s, region: reg.name, meshes: [], curtains: [], real: true };
            [[0, 0.7, 1.6, 0.08], [0, -0.7, 1.6, 0.08], [-0.76, 0, 0.08, 1.45], [0.76, 0, 0.08, 1.45], [0, 0, 0.05, 1.3]].forEach(([dz2, dy, w, h]) => win.meshes.push(P.box(scene, 0.07, h, w, frame, fx - s * 0.035, y + dy, z + dz2)));
            win.meshes.push(P.box(scene, 0.22, 0.06, 1.8, sill, fx - s * 0.11, y - 0.76, z));
            // the dark room behind it, for the view from outside
            const dark = P.box(scene, 0.9, O.head - O.sill + 0.2, O.w + 0.2, behind[lightOf(reg.name)] || behind.off, fx - s * 0.47, base + (O.sill + O.head) / 2, z);
            dark.userData.zone = "Y";
            // the glass (js/glass.js) at the middle of the wall
            world.realWindows.push({ x: s * (X + 0.2), z, base, s, y0: base + O.sill, y1: base + O.head, w: O.w, region: reg.name, win });
            if (!world.windowRooms.includes(reg.name)) world.windowRooms.push(reg.name);
            near.push(b);
            const info = world.roomInfo && world.roomInfo[reg.name];
            const chance = info ? CURTAINS[info.type] || 0 : 0;
            if (R() < chance) {
              const col = colours[Math.floor(R() * colours.length)];
              [-1, 1].forEach((side) => {
                if (R() < 0.2) return;                        // one side torn right down
                const cu = { x: fx - s * 0.09, z: z + side * (0.62 + R() * 0.12), y0: y + 0.85, len: 1.9 + R() * 0.4, width: 0.55 + R() * 0.2, axis: "z", color: col };
                world.curtains.push(cu); win.curtains.push(cu);
              });
              win.meshes.push(P.box(scene, 0.04, 0.04, 2.1, P.lam(0x3a3a3c), fx - s * 0.09, y + 0.87, z));
            }
            (world.innerWindows = world.innerWindows || []).push(win);
          }));
        });
      });

      // ---- cut the walls: a run of outer wall with windows in it is built
      // again round its openings, and each opening gets a block that stops
      // walking (a player, a zombie) but not rounds (G.Game.wallDistance) ----
      const segs = (world.wallSegs || []).filter((g) => Math.abs(Math.abs(g.x) - (X + 0.2)) < 0.05 && g.d > g.w);
      segs.forEach((seg) => {
        const z0 = seg.z - seg.d / 2, z1 = seg.z + seg.d / 2;
        const wins = world.realWindows.filter((w) => Math.sign(w.x) === Math.sign(seg.x) && Math.abs(w.base - seg.baseY) < 0.1 && w.z - O.w / 2 > z0 - 0.01 && w.z + O.w / 2 < z1 + 0.01).sort((a, b) => a.z - b.z);
        if (!wins.length) return;
        scene.remove(seg.mesh); seg.mesh.geometry.dispose();
        const ci = world.colliders.indexOf(seg.box);
        if (ci >= 0) world.colliders.splice(ci, 1);
        let t = z0;
        wins.forEach((w) => {
          const a = w.z - O.w / 2, b = w.z + O.w / 2;
          if (a - t > 0.02) api.addWallSeg(seg.x, (t + a) / 2, seg.w, a - t, seg.h, seg.baseY);
          api.addWallSeg(seg.x, w.z, seg.w, O.w, O.sill, seg.baseY);                          // under the sill
          api.addWallSeg(seg.x, w.z, seg.w, O.w, seg.h - O.head, seg.baseY + O.head);         // over the head
          const block = new THREE.Box3(new THREE.Vector3(seg.x - seg.w / 2, seg.baseY + O.sill, a), new THREE.Vector3(seg.x + seg.w / 2, seg.baseY + O.head, b));
          block.passShots = true;
          world.colliders.push(block);
          t = b;
        });
        if (z1 - t > 0.02) api.addWallSeg(seg.x, (t + z1) / 2, seg.w, z1 - t, seg.h, seg.baseY);
      });
    },
    // the openings in an outer wall run (for what is painted or hung on it:
    // js/schooldress.js, and the outside's render below): [{z, y0, y1}]
    holesIn(world, x, base) {
      return (world.realWindows || []).filter((w) => Math.abs(w.x - x) < 0.3 && Math.abs(w.base - base) < 0.1)
        .map((w) => ({ z: w.z, y0: w.y0, y1: w.y1, w: w.w }));
    },
  };
})();
