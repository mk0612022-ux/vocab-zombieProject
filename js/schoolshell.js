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
// windows too (night beyond them), where the wall is free, and some of those
// have torn curtains that move in the draught (G3, built by js/details.js
// from world.curtains).
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

      // one window on an outside face; `n` is the outward normal (+-1) along
      // `axis` ("x": the face is at x = fixed, the window runs along z)
      const outWindow = (axis, fixed, n, t, y, key, w, h) => {
        w = w || 1.5; h = h || 1.4;
        const mode = key ? lightOf(key) : "off";
        const roll = R();
        const glass = roll < 0.08 ? broken : mode === "steady" ? (roll < 0.6 ? glassLit : glassDim) : mode === "flicker" ? glassDim : glassDark;
        const at = (dn, dt, dy, sx, sy, sz, m) => {
          if (axis === "x") P.box(scene, sz, sy, sx, m, fixed + n * dn, y + dy, t + dt);
          else P.box(scene, sx, sy, sz, m, t + dt, y + dy, fixed + n * dn);
        };
        at(0.03, 0, 0, w, h, 0.02, glass);
        at(0.06, 0, h / 2, w + 0.12, 0.08, 0.07, frame); at(0.06, 0, -h / 2, w + 0.12, 0.08, 0.07, frame);
        at(0.06, -w / 2, 0, 0.08, h, 0.07, frame); at(0.06, w / 2, 0, 0.08, h, 0.07, frame);
        at(0.06, 0, 0, 0.05, h, 0.05, frame);
        at(0.12, 0, -h / 2 - 0.1, w + 0.35, 0.1, 0.26, sill);
        at(0.08, 0, h / 2 + 0.14, w + 0.35, 0.16, 0.18, lint);
        if (roll > 0.94) { at(0.1, 0, 0.2, w + 0.2, 0.2, 0.05, P.lam(0x7a6448)); at(0.11, 0, -0.25, w + 0.2, 0.2, 0.05, P.lam(0x6a5640)); }
        // water has run from the sill for years
        if (R() < 0.6) { const sh = 0.6 + R() * 1.1; at(0.012, (R() - 0.5) * w, -h / 2 - 0.15 - sh / 2, 0.2 + R() * 0.4, sh, 0.01, stain); }
      };

      // ---- the classroom block's long sides, every storey ----
      [-1, 1].forEach((s) => {
        const fx = s * FACE;
        // a skin over the plain wall: render, with a brick plinth
        P.box(scene, 0.05, top - 0.7, zBack - zGym, render, s * (FACE + 0.02), 0.7 + (top - 0.7) / 2, (zBack + zGym) / 2);
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
            const z = row.cz + dz;
            outWindow("x", fx, s, z, y, roomAt(s * (X - 1), z, api.baseOf(fl)));
          }));
        });
        [F2 * 0 + 1.9, F2 + 1.9].forEach((y) => [-3.5, 1.2].forEach((dz) => outWindow("x", fx, s, E.cz + dz, y, y < F2 ? "ENTRY" : roomAt(s * 11, E.cz, F2))));
        // downpipes and the grime they leave
        for (let z = zGym + 6; z < zFront - 2; z += 22) {
          P.cyl(scene, 0.07, 0.07, top, 8, pipe, s * (FACE + 0.14), top / 2, z);
          P.box(scene, 0.3, 0.12, 0.5, pipe, s * (FACE + 0.14), top - 0.1, z);
          P.box(scene, 0.012, 1.6, 0.9, moss, s * (FACE + 0.06), 0.8, z);
        }
        for (let k = 0; k < 26; k++) { const z = zGym + R() * (zFront - zGym), h = 0.3 + R() * 0.9; P.box(scene, 0.012, h, 0.5 + R() * 1.4, R() < 0.5 ? moss : stain, s * (FACE + 0.1), 0.7 + h / 2 - 0.4, z); }
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
    },

    // ---- windows on the inside of the outer walls (night beyond), where the
    // wall is free; some rooms' windows have torn curtains ---------------------
    inside(api) {
      const P = G.SchoolDress.P;
      const { scene, world, cfg, HALF, ROOM_W, storeyList } = api;
      const R = G.makeRng(9191);
      const X = HALF + ROOM_W - 0.2;                          // the outer walls' inner face
      const frame = P.lam(0x6b4a2f), night = P.basic(0x0d1826), moon = P.basic(0x1c2a3c), sill = P.lam(0xc8c2b0);
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
            const win = { x: fx, z, base, s, region: reg.name, meshes: [], curtains: [] };
            win.meshes.push(P.box(scene, 0.02, 1.3, 1.45, night, fx - s * 0.012, y, z));
            win.meshes.push(P.box(scene, 0.02, 0.5, 0.6, moon, fx - s * 0.014, y + 0.3, z + 0.35));
            [[0, 0.7, 1.6, 0.08], [0, -0.7, 1.6, 0.08], [-0.76, 0, 0.08, 1.45], [0.76, 0, 0.08, 1.45], [0, 0, 0.05, 1.3]].forEach(([dz2, dy, w, h]) => win.meshes.push(P.box(scene, 0.07, h, w, frame, fx - s * 0.035, y + dy, z + dz2)));
            win.meshes.push(P.box(scene, 0.22, 0.06, 1.8, sill, fx - s * 0.11, y - 0.76, z));
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
    },
  };
})();
