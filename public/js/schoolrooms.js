// ===================================================================
// School rooms (round 3, G2)
// -------------------------------------------------------------------
// Every room in the school is a kind of room now, and looks it:
//   TYPES   its colours (the wall above the dado, the dado, the rail), its
//           floor (lino, wood, carpet, tiles, concrete), how its light
//           behaves (the meeting rooms flicker) and the name on its door
//   KITS    its furniture: desks in rows facing a board, tall bookcases with
//           aisles you can walk down, a long meeting table, lab benches, a
//           piano and a drum kit, easels, a sick-bay bed behind a curtain...
//
// A room is worked in its own frame: u runs from the door wall (0) to the
// outer wall (w), v along the corridor from the room's centre. Each kit keeps
// a clear aisle straight in from every door (|v - door| < 1.8) and the room's
// centre, which is where the zombies' route through it runs; the doorway
// sweep in world.js is the backstop.
//
// Everything is painted from the one palette texture (G.SchoolDress.P), so a
// room full of furniture merges into the same draw calls as the walls round
// it. Solid furniture registers its collider (and joins the doorway sweep);
// anything under 0.6 m (chairs, benches) stays walk-through.
//
// Also here: the floor textures, the room-name signs over every door (one
// atlas texture), the boards on the walls (one atlas), the outside of the
// building (windows, string courses, a cornice, downpipes) and the windows
// on the inside of the outer walls, some with torn curtains that move in the
// draught (G3).
// ===================================================================
(function () {
  const PP = () => G.SchoolDress.P;

  // ---- what each kind of room is -----------------------------------------
  const TYPES = {
    classroom: { sign: "room.classroom", wall: 0xe6e3da, dado: 0x9fb2c0, rail: 0x6b4a2f, floor: "lino" },
    library: { sign: "room.library", wall: 0xcaa885, dado: 0x7a5535, rail: 0x5a3d26, floor: "wood" },
    meeting: { sign: "room.meeting", wall: 0xe9eef3, dado: 0x7fa3c8, rail: 0x3f6a9a, floor: "carpetBlue", light: "flicker" },
    science: { sign: "room.science", wall: 0xe2ebe5, dado: 0x5f9a92, rail: 0x3e6e68, floor: "tileWhite" },
    music: { sign: "room.music", wall: 0xe8d9a8, dado: 0x7a3b3b, rail: 0x5a2a2a, floor: "wood" },
    art: { sign: "room.art", wall: 0xefe9dc, dado: 0xd08a4a, rail: 0x7a4a2a, floor: "concrete" },
    nurse: { sign: "room.nurse", wall: 0xe4f0ea, dado: 0x9cc8b0, rail: 0x5a8a70, floor: "tileWhite" },
    computer: { sign: "room.computer", wall: 0xd8dde2, dado: 0x4a5868, rail: 0x2e3a48, floor: "carpetGrey" },
    principal: { sign: "room.principal", wall: 0x4f6b58, dado: 0x4a3322, rail: 0x2e1f14, floor: "carpetRed" },
    canteen: { sign: "room.canteen", wall: 0xe8d58a, dado: 0xc9764a, rail: 0x8a4a2a, floor: "chequer" },
    toilets: { sign: "room.toilets", wall: 0xe8ecec, dado: 0x8fb0c8, rail: 0x5a7a90, floor: "tileGrey" },
    office: { sign: "room.office", wall: 0xd9ceb4, dado: 0x8a6a4a, rail: 0x5a3d26, floor: "lino" },
    staffoffice: { sign: "room.staffoffice", wall: 0xdcd2ba, dado: 0x7d8a6a, rail: 0x4a5a3a, floor: "carpetBrown" },
    detention: { sign: "room.detention", wall: 0xb8b8b0, dado: 0x6a6a66, rail: 0x3a3a38, floor: "lino" },
    storeroom: { sign: "room.storeroom", wall: 0x9a968c, dado: 0x7a766c, rail: 0x55524a, floor: "concrete" },
    changing: { sign: "room.changing", wall: 0xcfe0e8, dado: 0x3d5870, rail: 0x2a3e50, floor: "tileGrey" },
    sports: { sign: "room.sports", wall: 0xb0aa9c, dado: 0x6a7a4a, rail: 0x4a5a30, floor: "concrete" },
    staff: { sign: "room.staff", wall: 0xe0d0b0, dado: 0x8a9a7a, rail: 0x5a6a4a, floor: "carpetBrown" },
    lounge: { sign: "room.lounge", wall: 0xe4d4b8, dado: 0x9a7a5a, rail: 0x5a4030, floor: "carpetBrown" },
    archive: { sign: "room.archive", wall: 0xc4bca8, dado: 0x6a604c, rail: 0x4a4234, floor: "concrete" },
    trophy: { sign: "room.trophy", wall: 0x3d4f7a, dado: 0x6a4a2a, rail: 0xb08a3a, floor: "carpetBlue" },
    broadcast: { sign: "room.broadcast", wall: 0x3a3a40, dado: 0x222226, rail: 0x111114, floor: "carpetDark" },
    stairs: { sign: "room.stairs", wall: 0xd8d2c0, dado: 0x80937a, rail: 0x6b4a2f, floor: "concrete" },
  };

  // ---- floors: small canvas tiles, repeated per metre -------------------
  const FLOORS = {};
  function floorTexture(kind) {
    if (FLOORS[kind]) return FLOORS[kind];
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d"), R = G.makeRng(kind.length * 977 + 31);
    let metres = 2;
    const speckle = (cols, n, a) => { for (let i = 0; i < n; i++) { c.globalAlpha = a * (0.5 + R() * 0.5); c.fillStyle = cols[Math.floor(R() * cols.length)]; const s = 1 + R() * 3; c.fillRect(R() * 128, R() * 128, s, s); } c.globalAlpha = 1; };
    const grime = () => { c.globalAlpha = 0.18; for (let i = 0; i < 6; i++) { c.fillStyle = R() < 0.5 ? "#3a3224" : "#1c1a16"; c.beginPath(); c.ellipse(R() * 128, R() * 128, 6 + R() * 18, 4 + R() * 12, R() * 3, 0, 7); c.fill(); } c.globalAlpha = 1; };
    if (kind === "wood") {
      metres = 1.6;
      const tones = ["#7a5535", "#6b4a2f", "#86603c", "#724e30"];
      for (let i = 0; i < 8; i++) { c.fillStyle = tones[i % 4]; c.fillRect(0, i * 16, 128, 16); c.fillStyle = "rgba(30,18,8,0.55)"; c.fillRect(0, i * 16, 128, 1); c.fillRect(((i * 53) % 128), i * 16, 1, 16); }
      speckle(["#4a3220", "#9a7048"], 160, 0.35);
    } else if (kind.startsWith("carpet")) {
      metres = 1;
      const base = { carpetBlue: "#34507a", carpetRed: "#6e2a2a", carpetGrey: "#5a5e64", carpetBrown: "#6a5440", carpetDark: "#26262c" }[kind] || "#555";
      c.fillStyle = base; c.fillRect(0, 0, 128, 128);
      speckle(["#000000", "#ffffff"], 700, 0.12);
      if (kind === "carpetGrey") { c.strokeStyle = "rgba(0,0,0,0.25)"; c.strokeRect(0.5, 0.5, 127, 127); }
    } else if (kind === "tileWhite" || kind === "tileGrey") {
      metres = 1.2;
      c.fillStyle = kind === "tileWhite" ? "#d8dcd8" : "#9aa0a2"; c.fillRect(0, 0, 128, 128);
      c.fillStyle = kind === "tileWhite" ? "#a8b0ac" : "#6a7072";
      for (let i = 0; i <= 128; i += 32) { c.fillRect(i, 0, 2, 128); c.fillRect(0, i, 128, 2); }
      speckle(["#7a7a70", "#ffffff"], 120, 0.2);
    } else if (kind === "chequer") {
      metres = 1.4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? "#2e3a3a" : "#cfc8b4"; c.fillRect(i * 32, j * 32, 32, 32); }
      speckle(["#000", "#8a7a5a"], 150, 0.2);
    } else if (kind === "concrete") {
      metres = 2.5;
      c.fillStyle = "#77746c"; c.fillRect(0, 0, 128, 128);
      speckle(["#5a5850", "#8a877e", "#4a4840"], 900, 0.3);
      c.strokeStyle = "rgba(20,20,18,0.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 90); c.lineTo(50, 84); c.lineTo(128, 96); c.stroke();
    } else {                                    // "lino": the old school green-grey
      metres = 2;
      c.fillStyle = "#6a6e5e"; c.fillRect(0, 0, 128, 128);
      speckle(["#4a4e40", "#8a8e7a", "#5a5e4e"], 600, 0.35);
      c.fillStyle = "rgba(20,20,16,0.4)"; c.fillRect(0, 63, 128, 2); c.fillRect(63, 0, 2, 128);
    }
    grime();
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    FLOORS[kind] = { tex, metres };
    return FLOORS[kind];
  }

  // ---- the boards on the walls: one atlas, 2 x 8 cells of 512 x 128 -------
  let boardAtlas = null;
  const BOARDS = ["board.pastSimple", "board.vocab", "board.homework", "board.timetable", "board.menu", "board.silence", "board.onAir", "board.groups", "board.time", "board.evacuate", "board.library", "board.physics", "board.chemistry", "board.music", "board.wellDone", "board.blank"];
  function boards() {
    if (boardAtlas) return boardAtlas;
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 1024;
    const c = cv.getContext("2d"), R = G.makeRng(5150);
    BOARDS.forEach((key, i) => {
      const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
      const white = key === "board.menu" || key === "board.library" || key === "board.evacuate" || key === "board.wellDone";
      const red = key === "board.onAir";
      c.fillStyle = red ? "#3a0c0c" : white ? "#e8e6de" : "#1f4436"; c.fillRect(x, y, 512, 128);
      // rubbed-out chalk and old marker
      c.globalAlpha = 0.18; c.fillStyle = white ? "#8a8a9a" : "#d8e0d8";
      for (let k = 0; k < 7; k++) c.fillRect(x + R() * 460, y + R() * 100, 30 + R() * 90, 6 + R() * 16);
      c.globalAlpha = 1;
      const ink = red ? "#ff4a3a" : white ? "#23315a" : "#e8eee4";
      c.fillStyle = ink; c.strokeStyle = ink; c.textAlign = "left";
      const lines = G.T(key).split("|");
      const size = lines.length > 2 ? 30 : lines.length > 1 ? 38 : 58;
      lines.forEach((ln, k) => { G.fitFont(c, ln, size, 470, "'Trebuchet MS', sans-serif"); c.fillText(ln, x + 22, y + (lines.length === 1 ? 84 : 42 + k * (size + 6))); });
      if (key === "board.music") { c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(x + 20, y + 70 + k * 10); c.lineTo(x + 490, y + 70 + k * 10); c.stroke(); } for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(x + 60 + k * 48, y + 80 + (k % 4) * 8, 8, 6, -0.4, 0, 7); c.fill(); } }
      if (key === "board.physics") { c.lineWidth = 3; c.beginPath(); c.moveTo(x + 300, y + 110); c.lineTo(x + 480, y + 110); c.moveTo(x + 330, y + 110); c.lineTo(x + 420, y + 50); c.stroke(); }
      if (key === "board.evacuate") { c.lineWidth = 4; c.strokeStyle = "#2a6a3a"; c.strokeRect(x + 330, y + 20, 160, 90); c.beginPath(); c.moveTo(x + 350, y + 90); c.lineTo(x + 470, y + 90); c.lineTo(x + 470, y + 40); c.stroke(); }
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 2;
    boardAtlas = { tex, mat: new THREE.MeshLambertMaterial({ map: tex }) };
    return boardAtlas;
  }
  function boardPlane(idx, w, h) {
    const A = boards();
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    const u0 = (idx % 2) / 2, v0 = 1 - (Math.floor(idx / 2) + 1) / 8;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 2, v0 + uv.getY(i) / 8);
    return new THREE.Mesh(g, A.mat);
  }

  // ---- the signs over the doors: one atlas, 4 x 16 cells of 256 x 64 --------
  // A blue enamel plate with the room's name in white, as every British and
  // Thai school has. Lit a little from within, so it reads in a dark corridor.
  let signAtlas = null;
  function signs() {
    if (signAtlas) return signAtlas;
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 1024;
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    signAtlas = { cv, ctx: cv.getContext("2d"), tex, cells: {}, n: 0, mat: new THREE.MeshLambertMaterial({ map: tex, emissive: 0x333333 }) };
    return signAtlas;
  }
  function signPlane(text, w, h) {
    const S = signs();
    let i = S.cells[text];
    if (i == null) {
      i = S.cells[text] = S.n++ % 64;
      const x = (i % 4) * 256, y = Math.floor(i / 4) * 64, c = S.ctx, R = G.makeRng(i * 131 + 7);
      c.fillStyle = "#e8eef4"; c.fillRect(x, y, 256, 64);
      c.fillStyle = "#1f3f6a"; c.fillRect(x + 4, y + 4, 248, 56);
      c.fillStyle = "#ffffff"; c.textAlign = "center";
      G.fitFont(c, text, 32, 226, "'Trebuchet MS', 'Segoe UI', sans-serif");
      c.fillText(text, x + 128, y + 43);
      c.fillStyle = "rgba(60,48,30,0.28)";
      for (let k = 0; k < 4; k++) c.fillRect(x + R() * 230, y + R() * 50, 8 + R() * 30, 3 + R() * 8);
      S.tex.needsUpdate = true;
    }
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    const u0 = (i % 4) / 4, v0 = 1 - (Math.floor(i / 4) + 1) / 16;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / 4, v0 + uv.getY(k) / 16);
    return new THREE.Mesh(g, S.mat);
  }

  // ---- the room's own frame -------------------------------------------------
  // (u = 0 is the door wall's inner face and w the outer wall's: the walls
  // are 0.4 thick on the rooms' boundary lines)
  function frame(spec) {
    const r = spec.room, o = r.cx < 0 ? -1 : 1;
    const doorX = r.cx - o * (r.w / 2 - 0.2);
    const doors = (spec.doorZs || [r.cz]).map((z) => z - r.cz);
    const F = {
      spec, r, o, y: spec.baseY, w: r.w - 0.4, d: r.d,
      X: (u) => doorX + o * u, Z: (v) => r.cz + v, doors,
      // the widest stretch of v clear of every door aisle
      halves() {
        const cuts = doors.map((dv) => [dv - 1.8, dv + 1.8]).sort((a, b) => a[0] - b[0]);
        const out = []; let t = -r.d / 2 + 0.3;
        cuts.forEach(([a, b]) => { if (a - t > 1.2) out.push([t, a]); t = Math.max(t, b); });
        if (r.d / 2 - 0.3 - t > 1.2) out.push([t, r.d / 2 - 0.3]);
        return out;
      },
    };
    return F;
  }
  // a box at (u, v) in the room, its base y0 above the floor; solid ones
  // block and join the doorway sweep
  function put(A, F, u, v, y0, su, h, sv, paint, solid, rx, ry, rz) {
    const P = PP();
    const m = P.mk(new THREE.BoxGeometry(su, h, sv), paint);
    m.position.set(F.X(u), F.y + y0 + h / 2, F.Z(v));
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    A.scene.add(m);
    if (solid) {
      m.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(m);
      A.world.colliders.push(b);
      A.solidProps.push({ mesh: m, collider: b });
    }
    return m;
  }
  // a group standing at (u, v), turned to face `face` (+1: toward the outer
  // wall, -1: toward the door, "+v"/"-v": along the room)
  function grp(A, F, u, v, face) {
    const g = new THREE.Group();
    g.position.set(F.X(u), F.y, F.Z(v));
    const toOuter = F.o > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.y = face === 1 ? toOuter : face === -1 ? toOuter + Math.PI : face === "+v" ? 0 : face === "-v" ? Math.PI : 0;
    A.scene.add(g);
    return g;
  }
  function solidGroup(A, g, pad) {
    g.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(g);
    if (pad) b.expandByScalar(pad);
    A.world.colliders.push(b);
    A.solidProps.push({ mesh: g, collider: b });
    return b;
  }

  // ---- shared furniture ------------------------------------------------------
  const C = {
    wood: 0x9a6a3a, woodD: 0x5a3d26, woodL: 0xb08050, metal: 0x6d737a, metalD: 0x3a3a3c, blue: 0x2f5a8a, orange: 0xc0602a,
    red: 0x9a2f2a, white: 0xe6e4dc, black: 0x1c1c1e, paper: 0xd8d2c0, board: 0x1f4436, gold: 0xc9a227, green: 0x3e6a4a,
    glass: 0x8aa0aa, fabric: 0x5a4a6a, leather: 0x4a2a1c, cream: 0xd8ccb0,
  };
  const L = (hex) => PP().lam(hex), B = (hex) => PP().basic(hex);
  // a chair: plastic seat and back on steel legs (walk-through)
  function chair(A, F, u, v, face, col, tipped) {
    const P = PP(), g = grp(A, F, u, v, face);
    const seat = L(col || C.blue), leg = L(C.metalD);
    if (tipped) { g.rotation.z = 1.4; g.position.y += 0.25; }
    P.box(g, 0.42, 0.05, 0.42, seat, 0, 0.45, 0);
    P.box(g, 0.42, 0.4, 0.05, seat, 0, 0.7, -0.2);
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a, b]) => P.box(g, 0.03, 0.45, 0.03, leg, a, 0.22, b));
    return g;
  }
  // a desk (solid), its long side along v
  function desk(A, F, u, v, su, sv, h, top, leg) {
    const P = PP();
    put(A, F, u, v, h - 0.05, su, 0.05, sv, L(top || C.wood), true);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => put(A, F, u + a * (su / 2 - 0.05), v + b * (sv / 2 - 0.05), 0, 0.05, h - 0.05, 0.05, L(leg || C.metalD), false));
    void P;
  }
  // a desk knocked over on its side: top standing on edge, legs sticking out
  function tippedDesk(A, F, u, v, R) {
    const P = PP(), g = grp(A, F, u, v, 1);
    g.rotation.z = Math.PI / 2 - 0.08; g.rotation.y += (R() - 0.5) * 0.6;
    g.position.y += 0.3;
    P.box(g, 1.1, 0.05, 0.6, L(C.wood), 0, 0.3, 0);
    [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([a, b]) => P.box(g, 0.05, 0.7, 0.05, L(C.metalD), a, -0.05, b));
    solidGroup(A, g);
  }
  // I3: a desk shoved out of line, turned a little (solid, its collider the
  // box round it as it now stands)
  function shovedDesk(A, F, u, v, R) {
    const P = PP(), g = grp(A, F, u, v, 1);
    g.rotation.y += (R() - 0.5) * 0.6;
    P.box(g, 1.1, 0.05, 0.6, L(C.wood), 0, 0.715, 0);
    [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([a, b]) => P.box(g, 0.05, 0.69, 0.05, L(C.metalD), a, 0.345, b));
    solidGroup(A, g);
  }
  // a tall case of shelves (solid), long along `alongV` ? v : u
  function shelves(A, F, u, v, su, sv, h, frameCol, fill, levels, R) {
    put(A, F, u, v, 0, su, h, sv, L(frameCol || C.woodD), true);
    if (!fill) return;
    const n = levels || 5, alongV = sv > su, len = alongV ? sv : su;
    // every spine and shelf board of the case baked into one geometry (a
    // library has thousands of books; as separate boxes they were thousands
    // of meshes to build and merge)
    const P = PP(), geos = [], m4 = new THREE.Matrix4(), e = new THREE.Euler();
    const piece = (du, dv, y0, sx, sy, sz, hex, lean) => {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      const [tu, tv] = P.texel(hex), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, tu, tv);
      e.set(alongV ? lean : 0, 0, alongV ? 0 : lean);
      m4.makeRotationFromEuler(e).setPosition(F.X(u + du), F.y + y0 + sy / 2, F.Z(v + dv));
      geos.push(g.applyMatrix4(m4));
    };
    for (let k = 0; k < n; k++) {
      const y = 0.12 + k * (h - 0.25) / n;
      [-1, 1].forEach((face) => {
        // the shelf board, and a row of spines of every width and height,
        // with gaps where books were taken (or fell)
        if (alongV) piece(face * (su / 2 + 0.01), 0, y - 0.03, 0.03, 0.03, len - 0.06, 0x3a2818, 0);
        else piece(0, face * (sv / 2 + 0.01), y - 0.03, len - 0.06, 0.03, 0.03, 0x3a2818, 0);
        let t = -len / 2 + 0.08;
        while (t < len / 2 - 0.12) {
          const bw = 0.06 + R() * 0.1;
          if (R() < 0.14) { t += 0.2 + R() * 0.3; continue; }
          const col = fill[Math.floor(R() * fill.length)], hh = 0.17 + R() * 0.15, lean = R() < 0.08 ? (R() - 0.5) * 0.6 : 0;
          if (alongV) piece(face * (su / 2 + 0.006), t + bw / 2, y, 0.02, hh, bw - 0.008, col, lean);
          else piece(t + bw / 2, face * (sv / 2 + 0.006), y, bw - 0.008, hh, 0.02, col, lean);
          t += bw;
        }
      });
    }
    if (geos.length) A.scene.add(new THREE.Mesh(P.concatGeos(geos), P.PAL.lit));
  }
  const BOOKS = [0x7a2a24, 0x2a4a7a, 0x3a6a3a, 0x8a6a2a, 0x5a3a5a, 0x2a2a2a, 0xa8802a, 0x6a2a3a];

  // somewhere a story note could be left (see js/notes.js)
  function spot(A, F, u, v, y, where) { A.noteSpot(F.X(u), F.y + y, F.Z(v), where || F.spec.type, F.spec); }

  // =========================================================================
  // the kits
  // =========================================================================
  const KITS = {
    classroom(spec, A, R) {
      const F = frame(spec), W = F.w;
      // the board on the outer wall -- off to one side if a wall gun hangs
      // in the middle
      const bv = spec.gun ? 3.6 : 0, bw = spec.gun ? 3.2 : 4.2;
      put(A, F, W - 0.08, bv, 0.95, 0.06, 1.55, bw + 0.2, L(C.woodD), false);
      // Newer list, round 3 (I3): some rooms were wrecked -- desks shoved
      // about and knocked over, chairs everywhere -- and in those (and a few
      // others) the lesson has been wiped off the board and a warning chalked
      // there instead. The desks only ever move away from the aisle, so the
      // way through stays open.
      const wrecked = R() < 0.4;
      spec.wrecked = wrecked;
      const warn = !!G.SchoolWear && (wrecked || R() < 0.2);
      const bp = boardPlane(warn ? BOARDS.indexOf("board.blank") : Math.floor(R() * 4), bw, 1.35);
      bp.position.set(F.X(W - 0.115), F.y + 1.72, F.Z(bv)); bp.rotation.y = F.o > 0 ? -Math.PI / 2 : Math.PI / 2; A.scene.add(bp);
      put(A, F, W - 0.2, bv, 0.95, 0.16, 0.05, bw, L(C.woodL), false);                 // the chalk ledge
      if (warn) {
        spec.chalk = 1 + Math.floor(R() * 6);
        const ww = bw * 0.92, msg = G.SchoolWear.scrawl(spec.chalk, ww, ww / 4, "A");
        msg.position.set(F.X(W - 0.122), F.y + 1.72 + (R() - 0.5) * 0.3, F.Z(bv));
        msg.rotation.set(0, F.o > 0 ? -Math.PI / 2 : Math.PI / 2, (R() - 0.5) * 0.1);
        A.scene.add(msg);
      }
      // the teacher's desk
      desk(A, F, W - 2.0, -3.9, 0.8, 1.6, 0.76, C.woodD);
      chair(A, F, W - 1.25, -3.9, -1, C.black, wrecked && R() < 0.6);
      put(A, F, W - 2.0, -4.3, 0.76, 0.3, 0.02, 0.22, L(C.paper), false);
      spot(A, F, W - 2.05, -3.55, 0.77);
      // sixteen pupils' desks in two blocks either side of the aisle
      F.halves().forEach(([a, b]) => {
        const mid = (a + b) / 2;
        [-1.05, 1.05].forEach((dv) => {
          [2.7, 4.5, 6.3, 8.1].forEach((u) => {
            if (Math.abs(mid + dv) > F.d / 2 - 0.8) return;
            if (R() < (wrecked ? 0.4 : 0.1)) { tippedDesk(A, F, u, mid + dv + Math.sign(dv) * 0.1, R); chair(A, F, u - 0.9, mid + dv + 0.3, 1, C.orange, true); return; }
            if (wrecked && R() < 0.6) {
              shovedDesk(A, F, u + (R() - 0.5) * 0.3, mid + dv + Math.sign(dv) * (0.08 + R() * 0.12), R);
              const c = chair(A, F, u - 0.6 + (R() - 0.5) * 0.9, mid + dv + (R() - 0.5) * 0.9, 1, R() < 0.5 ? C.blue : C.orange, R() < 0.55);
              c.rotation.y += (R() - 0.5) * 2.4;
              return;
            }
            desk(A, F, u, mid + dv, 0.6, 1.1, 0.74);
            chair(A, F, u - 0.58, mid + dv, 1, R() < 0.5 ? C.blue : C.orange, R() < 0.08);
            if (R() < 0.3) put(A, F, u, mid + dv + (R() - 0.5) * 0.4, 0.74, 0.24, 0.02, 0.3, L(C.paper), false, 0, R() * 3, 0);
          });
        });
        // what was on the desks is on the floor now: books, a bag
        if (wrecked) for (let k = 0; k < 6; k++) put(A, F, 2 + R() * 6.5, mid + (R() < 0.5 ? -1 : 1) * (1 + R() * 1.2), 0, 0.22 + R() * 0.1, 0.04 + R() * 0.04, 0.16 + R() * 0.08, L(BOOKS[Math.floor(R() * BOOKS.length)]), false, 0, R() * 3, (R() - 0.5) * 0.3);
      });
      shelves(A, F, 0.45, -F.d / 2 + 1.2, 0.4, 1.8, 1.8, C.woodD, BOOKS, 4, R);
    },

    library(spec, A, R) {
      const F = frame(spec), W = F.w;
      const fill = BOOKS;
      // rows of tall bookcases across the room, off the aisle that joins
      // the two doors; walkable aisles between them
      const rows = [-11.0, -8.4, -5.8, -3.2, 3.2, 5.8, 8.4, 11.0].filter((v) => Math.abs(v) < F.d / 2 - 1.2);
      rows.forEach((v) => shelves(A, F, 7.6, v, 6.0, 0.55, 2.4, C.woodD, fill, 5, R));
      // the reading area in the middle: two tables and their chairs
      [6.0, 9.2].forEach((u) => {
        desk(A, F, u, 0, 2.2, 1.1, 0.76, C.woodL, C.woodD);
        [-0.7, 0.7].forEach((du) => { chair(A, F, u + du, -0.85, "+v", C.green); chair(A, F, u + du, 0.85, "-v", C.green, R() < 0.15); });
      });
      spot(A, F, 6.3, 0.2, 0.77, "library");
      // bookcases down the outer wall, clear of the wall gun
      [[-F.d / 2 + 0.6, -1.8], [1.8, F.d / 2 - 0.6]].forEach(([a, b]) => shelves(A, F, W - 0.3, (a + b) / 2, 0.45, b - a, 2.2, C.woodD, fill, 5, R));
      // the librarian's desk at the far end, and a returns trolley
      desk(A, F, 5.2, F.d / 2 - 1.0, 2.2, 0.8, 1.0, C.woodD, C.woodD);
      put(A, F, 5.2, F.d / 2 - 1.0, 1.0, 0.4, 0.3, 0.3, L(C.metalD), false);
      put(A, F, 8.0, F.d / 2 - 1.3, 0.2, 0.9, 0.7, 0.5, L(C.metal), true);
      // books everywhere on the floor
      for (let i = 0; i < 26; i++) put(A, F, 4.3 + R() * 7, (R() - 0.5) * (F.d - 3), 0, 0.22, 0.05, 0.16, L(fill[i % fill.length]), false, 0, R() * 3, 0);
      // a globe
      const P = PP(), g = grp(A, F, W - 1.2, -F.d / 2 + 1.6, 1);
      P.box(g, 0.05, 0.9, 0.05, L(C.woodD), 0, 0.45, 0);
      const gl = P.mk(new THREE.SphereGeometry(0.25, 10, 8), L(0x3a6a8a)); gl.position.y = 1.1; g.add(gl);
    },

    meeting(spec, A, R) {
      const F = frame(spec), W = F.w;
      const hv = F.halves().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      const tv = (hv[0] + hv[1]) / 2, tl = Math.min(W - 3.4, 6.2);
      const tu = W / 2 + 0.4;
      desk(A, F, tu, tv, tl, 1.4, 0.76, 0x3a2a20, C.metalD);
      for (let k = 0; k < 5; k++) {
        const u = tu - tl / 2 + 0.6 + k * (tl - 1.2) / 4;
        chair(A, F, u, tv - 1.0, "+v", 0x2a3a5a, R() < 0.1);
        chair(A, F, u, tv + 1.0, "-v", 0x2a3a5a);
        if (R() < 0.5) put(A, F, u, tv + (R() - 0.5) * 0.6, 0.76, 0.22, 0.02, 0.3, L(C.paper), false, 0, R(), 0);
      }
      chair(A, F, tu + tl / 2 + 0.55, tv, -1, C.black);
      put(A, F, tu - 0.5, tv, 0.76, 0.3, 0.12, 0.25, L(C.metalD), false);                   // the projector
      // the screen on the outer wall, pulled down and torn at a corner
      put(A, F, W - 0.12, tv, 2.95, 0.12, 0.12, 2.6, L(C.metalD), false);
      put(A, F, W - 0.1, tv, 1.2, 0.02, 1.7, 2.4, L(0xeef0f0), false);
      put(A, F, W - 0.1, tv + 0.9, 1.2, 0.02, 0.4, 0.6, L(0x9aa0a4), false, 0.3, 0, 0);
      // water cooler in a corner, a whiteboard on the side wall
      const cv = hv[0] < 0 ? -F.d / 2 + 0.5 : F.d / 2 - 0.5;
      put(A, F, 0.6, cv, 0, 0.4, 1.1, 0.4, L(0xd8dce0), true);
      put(A, F, 0.6, cv, 1.1, 0.3, 0.4, 0.3, B(0x9ac8e8), false);
      spot(A, F, tu + 1.2, tv - 0.3, 0.77, "meeting");
    },

    science(spec, A, R) {
      const F = frame(spec), W = F.w;
      const physics = spec.label === "room.physics";
      F.halves().forEach(([a, b], hi) => {
        const mid = (a + b) / 2;
        // a long lab bench down each half with sinks and a gas tap per
        // place, stools either side
        put(A, F, 5.9, mid, 0, 6.8, 0.88, 1.2, L(0x4a5a5a), true);
        put(A, F, 5.9, mid, 0.88, 6.9, 0.05, 1.3, L(0x1c1e20), false);
        [3.4, 5.9, 8.4].forEach((u) => {
          put(A, F, u, mid, 0.9, 0.5, 0.03, 0.35, L(0x6a7070), false);
          put(A, F, u + 0.3, mid + 0.4, 0.93, 0.03, 0.25, 0.03, L(C.metal), false);
          [-1, 1].forEach((s) => put(A, F, u - 0.6, mid + s * 0.95, 0, 0.3, 0.62, 0.3, L(C.metalD), false));
          if (R() < 0.7) put(A, F, u - 0.6 + R() * 0.3, mid + (R() - 0.5) * 0.5, 0.93, 0.08, 0.16, 0.08, B([0x6affb0, 0x6ac8ff, 0xffd46a][Math.floor(R() * 3)]), false);
        });
        if (physics && hi === 0) {
          const P = PP(), g = grp(A, F, 7.2, mid, 1);
          P.cyl(g, 0.08, 0.1, 0.6, 8, L(C.metalD), 0, 1.25, 0);
          const s = P.mk(new THREE.SphereGeometry(0.28, 12, 10), L(0xc0c4c8)); s.position.y = 1.7; g.add(s);
        }
      });
      // the fume cupboard in a corner by the outer wall
      const fv = -F.d / 2 + 1.1;
      put(A, F, W - 0.55, fv, 0, 0.9, 2.2, 1.6, L(0xc8ccc8), true);
      put(A, F, W - 1.02, fv, 0.95, 0.02, 0.9, 1.4, B(0x2a4a3a), false);
      if (!spec.gun) {
        const bp = boardPlane(physics ? 11 : 12, 3.2, 1.2);
        bp.position.set(F.X(W - 0.1), F.y + 1.75, F.Z(0)); bp.rotation.y = F.o > 0 ? -Math.PI / 2 : Math.PI / 2; A.scene.add(bp);
      }
    },

    music(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const [h0, h1] = F.halves();
      // the upright piano against the outer wall, lid open
      const pv = (h0[0] + h0[1]) / 2;
      put(A, F, W - 0.45, pv, 0, 0.6, 1.3, 1.5, L(0x1e1a18), true);
      put(A, F, W - 0.82, pv, 0.72, 0.18, 0.04, 1.4, L(0xe8e4d8), false);
      for (let k = 0; k < 9; k++) put(A, F, W - 0.84, pv - 0.6 + k * 0.15, 0.76, 0.1, 0.03, 0.05, L(0x101010), false);
      put(A, F, W - 1.3, pv, 0, 0.35, 0.48, 0.8, L(0x1e1a18), false);
      spot(A, F, W - 0.5, pv - 0.35, 1.31, "music");
      // a drum kit in the other half
      if (h1) {
        const dv = (h1[0] + h1[1]) / 2, g = grp(A, F, W - 2.0, dv, -1);
        const shell = L(0x8a2a2a), chrome = L(0xb8bcc0), skin = L(0xe0dcd0);
        P.cyl(g, 0.3, 0.3, 0.4, 14, shell, 0, 0.32, 0, Math.PI / 2, 0, 0);
        P.cyl(g, 0.29, 0.29, 0.02, 14, skin, 0, 0.32, 0.21, Math.PI / 2, 0, 0);
        [[-0.4, 0.62, 0.3], [0.35, 0.7, 0.25], [0.55, 0.45, -0.3]].forEach(([x, y, r]) => { P.cyl(g, r * 0.6, r * 0.6, 0.25, 12, shell, x, y, 0.1); P.cyl(g, r * 0.58, r * 0.58, 0.02, 12, skin, x, y + 0.13, 0.1); P.box(g, 0.03, y, 0.03, chrome, x, y / 2, 0.1); });
        [[-0.7, 1.3], [0.8, 1.2]].forEach(([x, y]) => { P.box(g, 0.03, y, 0.03, chrome, x, y / 2, -0.2); P.cyl(g, 0.3, 0.3, 0.015, 14, L(0xb8962a), x, y, -0.2, 0.15, 0, 0); });
        P.cyl(g, 0.2, 0.2, 0.45, 10, L(0x2a2a2a), 0, 0.22, -0.7);
        solidGroup(A, g, 0.05);
      }
      // chairs and music stands in two short rows each side
      F.halves().forEach(([a, b]) => {
        const mid = (a + b) / 2;
        [3.0, 5.0].forEach((u) => [-1, 1].forEach((s) => {
          const v = mid + s * 0.9;
          if (Math.abs(v) > F.d / 2 - 0.5) return;
          chair(A, F, u, v, 1, C.black, R() < 0.12);
          const st = grp(A, F, u + 0.7, v, -1);
          P.box(st, 0.02, 1.0, 0.02, L(C.metalD), 0, 0.5, 0);
          P.box(st, 0.45, 0.32, 0.02, L(C.metalD), 0, 1.1, 0.02, -0.4, 0, 0);
        }));
      });
      // acoustic panels on the side walls
      [-1, 1].forEach((s) => { for (let k = 0; k < 3; k++) put(A, F, 3 + k * 3.2, s * (F.d / 2 - 0.23), 1.3, 1.1, 1.1, 0.06, L(0x4a5a6a), false); });
      // a xylophone, guitar cases against the door wall
      const xv = (h0[0] + h0[1]) / 2 + 1.2;
      put(A, F, 7.2, xv, 0.55, 1.1, 0.08, 0.45, L(0x8a5a2a), false);
      put(A, F, 7.2, xv, 0, 0.9, 0.55, 0.35, L(C.metalD), true);
      for (let k = 0; k < 3; k++) put(A, F, 0.35, (h1 ? h1[1] : F.d / 2) - 0.6 - k * 0.5, 0, 0.14, 1.0, 0.38, L(0x1c1c1c), false, 0, 0, -0.12);
      if (!spec.gun) { const bp = boardPlane(13, 3.4, 1.1); bp.position.set(F.X(W - 0.1), F.y + 1.9, F.Z(0)); bp.rotation.y = F.o > 0 ? -Math.PI / 2 : Math.PI / 2; A.scene.add(bp); }
    },

    art(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const paints = [0xd83a2a, 0x2a6ad8, 0xe8c02a, 0x3aa84a, 0x8a3ad8, 0xe86a2a];
      F.halves().forEach(([a, b], hi) => {
        const mid = (a + b) / 2;
        [3.9, 8.1].forEach((u) => {
          desk(A, F, u, mid, 3.0, 1.6, 0.8, 0xc8c0b0, C.metalD);
          for (let k = 0; k < 5; k++) put(A, F, u + (R() - 0.5) * 2.4, mid + (R() - 0.5) * 1.2, 0.8, 0.12, 0.14, 0.12, L(paints[Math.floor(R() * paints.length)]), false);
          for (let k = 0; k < 3; k++) put(A, F, u + (R() - 0.5) * 2.4, mid + (R() - 0.5) * 1.2, 0.8, 0.02, 0.012, 0.4, L(C.woodL), false, 0, R() * 3, 0);
          [-1, 1].forEach((s) => put(A, F, u + s * 0.8, mid + 1.1, 0, 0.35, 0.65, 0.35, L(C.metalD), false));
        });
        if (hi === 0) {
          // a drying rack by the door wall, a sink in the corner
          put(A, F, 0.45, mid, 0, 0.5, 1.4, 1.4, L(C.metal), true);
          for (let k = 0; k < 6; k++) put(A, F, 0.45, mid, 0.2 + k * 0.2, 0.46, 0.012, 1.3, L([0xe8e0c8, 0xd8a0a0, 0xa0c0e0][k % 3]), false);
          put(A, F, W - 0.45, a + 0.8, 0, 0.8, 0.9, 1.1, L(0xd8dcd8), true);
        } else {
          // easels near the outer wall, each with a half-finished picture
          for (let k = 0; k < 3; k++) {
            const v = a + 0.8 + k * ((b - a - 1.6) / 2), g = grp(A, F, W - 1.3, v, -1);
            P.box(g, 0.05, 1.7, 0.05, L(C.woodL), -0.3, 0.85, 0, 0.12, 0, 0.1);
            P.box(g, 0.05, 1.7, 0.05, L(C.woodL), 0.3, 0.85, 0, 0.12, 0, -0.1);
            P.box(g, 0.05, 1.6, 0.05, L(C.woodL), 0, 0.8, -0.35, -0.3, 0, 0);
            P.box(g, 0.7, 0.55, 0.03, L(0xf0ece2), 0, 1.3, 0.1, 0.12, 0, 0);
            P.box(g, 0.3, 0.2, 0.01, L(paints[k * 2 % paints.length]), -0.1, 1.35, 0.125, 0.12, 0, 0.3);
            P.box(g, 0.25, 0.15, 0.01, L(paints[(k * 2 + 1) % paints.length]), 0.12, 1.22, 0.125, 0.12, 0, -0.2);
          }
          // clay shelf with pots
          put(A, F, 0.4, b - 0.8, 0, 0.4, 1.6, 1.2, L(C.woodD), true);
          for (let k = 0; k < 5; k++) put(A, F, 0.4, b - 1.2 + (k % 3) * 0.35, 0.5 + Math.floor(k / 3) * 0.55, 0.2, 0.22, 0.2, L(0xa8683a), false);
        }
      });
      // paint spilt on the floor and flicked up the walls
      for (let k = 0; k < 22; k++) put(A, F, 1 + R() * (W - 2), (R() - 0.5) * (F.d - 1.4), 0, 0.2 + R() * 0.5, 0.008, 0.15 + R() * 0.4, L(paints[Math.floor(R() * paints.length)]), false, 0, R() * 3, 0);
      for (let k = 0; k < 14; k++) { const s = R() < 0.5 ? -1 : 1; put(A, F, 1 + R() * (W - 2), s * (F.d / 2 - 0.215), 0.4 + R() * 2.2, 0.1 + R() * 0.3, 0.1 + R() * 0.25, 0.01, L(paints[Math.floor(R() * paints.length)]), false); }
      spot(A, F, 3.6, (F.halves()[0][0] + F.halves()[0][1]) / 2 + 0.4, 0.81, "art");
    },

    nurse(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const H = F.halves();
      H.forEach(([a, b], hi) => {
        const mid = (a + b) / 2;
        // a sick-bay bed against the outer wall behind a curtain rail
        put(A, F, W - 1.2, mid, 0.3, 2.0, 0.25, 0.9, L(C.white), true);
        put(A, F, W - 1.2, mid, 0.55, 1.9, 0.06, 0.85, L(0x9cc8b0), false);
        put(A, F, W - 0.4, mid, 0.55, 0.3, 0.12, 0.6, L(0xf0f0ea), false);
        [[-0.9, -0.4], [-0.9, 0.4], [0.9, -0.4], [0.9, 0.4]].forEach(([du, dv]) => put(A, F, W - 1.2 + du, mid + dv, 0, 0.05, 0.3, 0.05, L(C.metal), false));
        // the rail, and curtains hanging from it (G3: they move)
        put(A, F, W - 2.5, mid, 2.7, 0.04, 0.04, 1.8, L(C.metal), false);
        put(A, F, W - 1.4, mid - 0.95, 2.7, 2.2, 0.04, 0.04, L(C.metal), false);
        (A.world.curtains = A.world.curtains || []).push({ x: F.X(W - 2.5), z: F.Z(mid - 0.3), y0: F.y + 2.66, len: 2.2, width: 1.1, axis: "z", color: 0x9cc8b0 });
        if (hi === 0) {
          // the medicine cabinet, glass-fronted, on the door wall
          put(A, F, 0.3, mid, 0.9, 0.35, 1.2, 1.2, L(C.white), true);
          put(A, F, 0.49, mid, 1.0, 0.02, 1.0, 1.0, B(0x6a8a8a), false);
          for (let k = 0; k < 6; k++) put(A, F, 0.4, mid - 0.4 + (k % 3) * 0.4, 1.1 + Math.floor(k / 3) * 0.45, 0.08, 0.16, 0.08, L([0xc84a3a, 0xe8e0d0, 0x4a8ac8][k % 3]), false);
          // a first-aid box, a folding screen
          put(A, F, 0.24, a + 0.6, 1.5, 0.12, 0.4, 0.5, L(0xc0302a), false);
          put(A, F, 0.19, a + 0.6, 1.65, 0.02, 0.1, 0.3, L(C.white), false); put(A, F, 0.19, a + 0.6, 1.55, 0.02, 0.3, 0.1, L(C.white), false);
          for (let k = 0; k < 3; k++) put(A, F, 5.6 + k * 0.62, b - 0.3, 0, 0.6, 1.7, 0.03, L(0xdce8e0), false, 0, (k % 2 ? 0.35 : -0.35), 0);
        } else {
          // the nurse's desk by the door, a weighing scale
          desk(A, F, 2.3, mid, 0.8, 1.5, 0.76, C.white, C.metal);
          chair(A, F, 1.5, mid, 1, C.black);
          put(A, F, 2.3, mid - 0.3, 0.76, 0.3, 0.02, 0.22, L(C.paper), false);
          put(A, F, 2.4, mid + 0.4, 0.76, 0.16, 0.1, 0.22, L(0x2a2a2a), false);
          spot(A, F, 2.25, mid + 0.05, 0.77, "nurse");
          put(A, F, 5.2, b - 0.5, 0, 0.35, 0.06, 0.35, L(C.white), false);
          put(A, F, 5.2, b - 0.35, 0.06, 0.05, 1.0, 0.05, L(C.metal), false);
        }
      });
      void P;
    },

    computer(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const lang = spec.label === "room.languageLab";
      F.halves().forEach(([a, b]) => {
        const rowsV = b - a > 3.6 ? [a + 0.9, b - 0.9] : [(a + b) / 2];
        rowsV.forEach((v, ri) => {
          desk(A, F, 6.3, v, 8.2, 0.8, 0.74, 0xc8c8c4, C.metalD);
          const face = ri === 0 && rowsV.length > 1 ? "-v" : "+v", fs = face === "-v" ? -1 : 1;
          for (let u = 2.8; u < 10.3; u += 1.25) {
            const on = R() < 0.25;
            put(A, F, u, v - fs * 0.2, 0.74, 0.5, 0.36, 0.05, L(0x2a2a2c), false);
            put(A, F, u, v - fs * 0.17, 0.78, 0.44, 0.28, 0.01, on ? B(0x28506a) : B(0x0a0c0e), false);
            put(A, F, u, v + fs * 0.1, 0.74, 0.42, 0.02, 0.14, L(0x3a3a3c), false);
            if (lang) put(A, F, u + 0.3, v + fs * 0.12, 0.74, 0.16, 0.06, 0.16, L(0x1c1c1c), false);
            chair(A, F, u, v + fs * 0.75, face === "-v" ? "+v" : "-v", 0x3a3a44, R() < 0.06);
          }
        });
      });
      // the server cabinet, lights still blinking
      const sv = -F.d / 2 + 0.75;
      put(A, F, W - 0.5, sv, 0, 0.7, 2.0, 0.8, L(0x1c1e22), true);
      for (let k = 0; k < 6; k++) put(A, F, W - 0.86, sv - 0.2 + (k % 2) * 0.3, 0.5 + k * 0.22, 0.01, 0.03, 0.05, B(k % 3 ? 0x3aff6a : 0xffaa3a), false);
      void P;
    },

    principal(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const H = F.halves();
      const [a1, b1] = H[H.length - 1], m1 = (a1 + b1) / 2;
      // the desk, broad and dark, facing the door; the chair behind it
      desk(A, F, W - 2.6, m1, 1.0, 2.3, 0.78, 0x3a2418, 0x2a1a10);
      put(A, F, W - 2.6, m1, 0, 0.9, 0.7, 2.1, L(0x3a2418), false);
      const ch = grp(A, F, W - 1.65, m1, -1);
      P.box(ch, 0.6, 0.12, 0.6, L(C.leather), 0, 0.5, 0);
      P.box(ch, 0.6, 0.8, 0.12, L(C.leather), 0, 0.95, -0.3);
      P.box(ch, 0.06, 0.45, 0.06, L(C.metalD), 0, 0.22, 0);
      [-0.6, 0.6].forEach((dv) => chair(A, F, W - 3.8, m1 + dv, 1, C.leather));
      put(A, F, W - 2.7, m1 - 0.6, 0.78, 0.35, 0.02, 0.25, L(C.paper), false);
      put(A, F, W - 2.5, m1 + 0.7, 0.78, 0.1, 0.25, 0.1, L(C.gold), false);
      spot(A, F, W - 2.75, m1 - 0.15, 0.79, "principal");
      // books behind, flags beside
      shelves(A, F, W - 0.28, m1, 0.4, Math.min(3.6, b1 - a1 - 0.4), 2.3, 0x2a1a10, BOOKS, 5, R);
      [[W - 1.0, b1 - 0.4, [0xa5191e, 0xf4f5f8, 0x2d2a4a, 0xf4f5f8, 0xa5191e]], [W - 1.0, a1 + 0.4, [0x2a4a7a, 0xc9a227, 0x2a4a7a]]].forEach(([u, v, stripes]) => {
        put(A, F, u, v, 0, 0.05, 2.3, 0.05, L(C.gold), false);
        const n = stripes.length, hgt = 0.6;
        stripes.forEach((col, k) => put(A, F, u, v + 0.45, 2.1 - (k + 0.5) * (hgt / n), 0.01, hgt / n, 0.8, L(col), false, 0, 0, 0.05));
      });
      // the other half: a leather sofa, a low table, a filing cabinet, and
      // the principal's safe in the corner
      const [a0, b0] = H[0], m0 = (a0 + b0) / 2;
      put(A, F, 0.6, m0, 0, 0.9, 0.45, 2.2, L(C.leather), true);
      put(A, F, 0.25, m0, 0.45, 0.2, 0.45, 2.2, L(C.leather), false);
      put(A, F, 2.0, m0, 0, 1.0, 0.42, 0.6, L(0x3a2418), false);
      put(A, F, 0.4, a0 + 0.5, 0, 0.6, 1.3, 0.5, L(C.metal), true);
      // the safe (a reward, G.Game.useReward)
      const sg = grp(A, F, W - 0.6, a0 + 0.6, -1);
      P.box(sg, 0.8, 1.05, 0.75, L(0x2e3034), 0, 0.525, 0);
      P.box(sg, 0.66, 0.9, 0.02, L(0x3a3c40), 0, 0.53, 0.38);
      P.cyl(sg, 0.1, 0.1, 0.04, 14, L(0xb8bcc0), 0.1, 0.65, 0.4, Math.PI / 2, 0, 0);
      P.box(sg, 0.05, 0.22, 0.05, L(0xb8bcc0), -0.22, 0.55, 0.41);
      solidGroup(A, sg);
      A.world.rewards = A.world.rewards || {};
      A.world.rewards.safe = { kind: "safe", used: false, mesh: sg, room: spec.key };
      A.world.interactables.push({ mesh: sg, kind: "safe", ref: A.world.rewards.safe });
      // a portrait on the side wall
      put(A, F, W / 2, F.d / 2 - 0.24, 1.3, 0.9, 1.2, 0.06, L(C.gold), false);
      put(A, F, W / 2, F.d / 2 - 0.28, 1.38, 0.72, 1.02, 0.02, L(0x2a2420), false);
    },

    canteen(spec, A, R) {
      const F = frame(spec), W = F.w;
      F.halves().forEach(([a, b]) => {
        [a + 0.9, b - 0.9].forEach((v, k) => {
          if (R() < 0.18) { put(A, F, 6.2, v, 0.35, 6.4, 0.8, 0.74, L(0x8a7a5a), true, Math.PI / 2 - 0.2, 0, 0); return; }
          desk(A, F, 6.2, v, 6.8, 0.8, 0.74, 0x8a7a5a, C.metalD);
          [-1, 1].forEach((s) => put(A, F, 6.2, v + s * 0.62, 0.42, 6.4, 0.05, 0.3, L(0x5a6a7a), false));
          for (let i = 0; i < 4; i++) if (R() < 0.6) put(A, F, 3.5 + R() * 5.4, v + (R() - 0.5) * 0.4, 0.74, 0.35, 0.02, 0.26, L(0x7a8a9a), false, 0, R() * 0.4, 0);
          void k;
        });
        // the serving counter along the outer wall, a sneeze guard over it
        const cl = b - a - 0.4;
        put(A, F, W - 0.55, (a + b) / 2, 0, 0.9, 1.0, cl, L(0xa8acb0), true);
        put(A, F, W - 0.9, (a + b) / 2, 1.2, 0.03, 0.5, cl - 0.2, B(0x5a6a70), false, 0, 0, 0.3);
      });
      const bp = boardPlane(4, 2.4, 0.9);
      bp.position.set(F.X(W - 0.1), F.y + 2.4, F.Z(0)); bp.rotation.y = F.o > 0 ? -Math.PI / 2 : Math.PI / 2; A.scene.add(bp);
      const [a, b] = F.halves()[0];
      spot(A, F, 4.2, a + 0.9, 0.75, "canteen");
      void b;
    },

    toilets(spec, A, R) {
      const F = frame(spec), W = F.w;
      // cubicles along the outer wall: a solid row, doors jammed shut, one
      // hanging off its hinge
      F.halves().forEach(([a, b]) => {
        const n = Math.max(1, Math.floor((b - a) / 1.45));
        put(A, F, W - 0.75, (a + b) / 2, 0, 1.5, 1.95, b - a, L(0xb8c8d0), true);
        for (let k = 0; k < n; k++) {
          const v = a + (k + 0.5) * ((b - a) / n);
          const ajar = R() < 0.3;
          put(A, F, W - 1.53, v, 0.1, 0.04, 1.75, (b - a) / n - 0.12, L(ajar ? 0x7a9aa8 : 0x8fb0c8), false, 0, ajar ? 0.4 : 0, 0);
          put(A, F, W - 1.56, v + 0.3, 1.0, 0.03, 0.06, 0.1, L(C.metal), false);
        }
      });
      // sinks and a long mirror on the door wall
      const [a0, b0] = F.halves()[0];
      put(A, F, 0.35, (a0 + b0) / 2, 0.75, 0.5, 0.15, b0 - a0 - 0.4, L(0xe8ecec), false);
      put(A, F, 0.3, (a0 + b0) / 2, 0, 0.3, 0.75, b0 - a0 - 0.6, L(0xb8c8d0), true);
      put(A, F, 0.22, (a0 + b0) / 2, 1.2, 0.02, 0.8, b0 - a0 - 0.6, B(0x7a8a96), false);
      put(A, F, 0.3, b0 - 0.4, 1.4, 0.2, 0.3, 0.3, L(C.white), false);
      // a mop bucket and a wet-floor sign, and the wet floor
      put(A, F, 3.2, (a0 + b0) / 2, 0, 0.4, 0.35, 0.4, L(0xe8c02a), false);
      const P = PP(), ws = grp(A, F, 4.2, -0.9, -1);
      P.box(ws, 0.02, 0.6, 0.3, L(0xe8c02a), 0.1, 0.3, 0, 0, 0, 0.2); P.box(ws, 0.02, 0.6, 0.3, L(0xe8c02a), -0.1, 0.3, 0, 0, 0, -0.2);
      (A.world.puddles = A.world.puddles || []).push({ x: F.X(5.5), z: F.Z(0.4), r: 1.2, y: F.y + 0.012 });
    },

    office(spec, A, R) {
      const F = frame(spec), W = F.w;
      const deputy = spec.label === "room.deputy";
      F.halves().forEach(([a, b], hi) => {
        const mid = (a + b) / 2;
        (deputy && hi === 1 ? [W - 2.6] : [3.3, 7.4]).forEach((u) => {
          desk(A, F, u, mid, 0.8, 1.6, 0.76, deputy ? 0x5a3a26 : C.wood);
          chair(A, F, u + 0.75, mid, -1, C.black);
          put(A, F, u, mid - 0.3, 0.76, 0.12, 0.34, 0.45, L(0x2a2a2c), false);
          put(A, F, u + 0.1, mid + 0.4, 0.76, 0.3, 0.02, 0.22, L(C.paper), false, 0, R(), 0);
        });
        if (hi === 0) for (let k = 0; k < 3; k++) put(A, F, W - 0.4, a + 0.6 + k * 1.0, 0, 0.6, 1.3, 0.9, L(C.metal), true);
        else put(A, F, 0.5, b - 0.6, 0, 0.8, 1.1, 0.7, L(0xc8c8c0), true);
      });
      if (!deputy) {
        // the red button on the outer wall that opens the detention room
        const [a1] = F.halves()[1];
        spec.buttonAt = { x: F.X(W - 0.25), y: F.y + 1.35, z: F.Z(a1 + 0.9) };
      }
      spot(A, F, 3.35, (F.halves()[0][0] + F.halves()[0][1]) / 2 + 0.25, 0.77, deputy ? "deputy" : "office");
    },

    staffoffice(spec, A, R) {
      const F = frame(spec), W = F.w;
      F.halves().forEach(([a, b], hi) => {
        const mid = (a + b) / 2;
        [3.2, 6.8].forEach((u) => {
          desk(A, F, u, mid, 1.4, 0.8, 0.76, C.woodL);
          chair(A, F, u, mid + (hi ? -0.7 : 0.7), hi ? "+v" : "-v", 0x4a4a6a);
          if (R() < 0.7) put(A, F, u, mid, 0.76, 0.3, 0.02, 0.22, L(C.paper), false, 0, R(), 0);
        });
      });
      // pigeonholes on the outer wall, a kettle and mugs
      const [a0, b0] = F.halves()[0];
      put(A, F, W - 0.25, (a0 + b0) / 2, 0.9, 0.35, 1.2, b0 - a0 - 0.6, L(C.woodL), true);
      for (let k = 0; k < 12; k++) put(A, F, W - 0.43, a0 + 0.6 + (k % 6) * ((b0 - a0 - 1.2) / 5), 1.0 + Math.floor(k / 6) * 0.5, 0.02, 0.3, 0.05, L(0x3a2a1a), false);
      const [a1, b1] = F.halves()[1];
      put(A, F, W - 0.4, b1 - 0.6, 0, 0.6, 0.9, 1.0, L(0xd8d4c8), true);
      put(A, F, W - 0.4, b1 - 0.5, 0.9, 0.18, 0.25, 0.18, L(0xc8c8c8), false);
      spot(A, F, 3.2, (a1 + b1) / 2 - 0.1, 0.77, "staffoffice");
    },

    detention(spec, A, R) {
      const F = frame(spec), W = F.w;
      F.halves().forEach(([a, b]) => {
        const mid = (a + b) / 2;
        [4.0, 8.0].forEach((u) => { desk(A, F, u, mid, 0.6, 1.1, 0.74); chair(A, F, u - 0.6, mid, 1, 0x5a5a5a); });
      });
      const [a0, b0] = F.halves()[0];
      desk(A, F, W - 1.6, (a0 + b0) / 2, 0.8, 1.6, 0.76, C.woodD);
      chair(A, F, W - 0.9, (a0 + b0) / 2, -1, C.black);
      put(A, F, W - 1.6, (a0 + b0) / 2 + 0.5, 0.76, 0.12, 0.08, 0.12, L(C.gold), false);
      spot(A, F, W - 1.65, (a0 + b0) / 2 - 0.3, 0.77, "detention");
      // chairs stacked in the corner
      const [a1, b1] = F.halves()[1];
      put(A, F, 0.6, b1 - 0.6, 0, 0.6, 1.4, 0.6, L(0x5a5a5a), true);
      const bp = boardPlane(5, 2.4, 0.7);
      bp.position.set(F.X(W / 2), F.y + 2.3, F.Z(b1 + 0.07)); bp.rotation.y = Math.PI; A.scene.add(bp);
      void a1;
    },

    storeroom(spec, A, R) {
      const F = frame(spec), W = F.w;
      F.halves().forEach(([a, b], hi) => {
        const wallV = hi === 0 ? a + 0.45 : b - 0.45;
        [3.4, 8.4].forEach((u) => {
          put(A, F, u, wallV, 0, 3.6, 2.2, 0.8, L(C.metal), true);
          for (let k = 0; k < 4; k++) put(A, F, u - 1.2 + (k % 2) * 1.8, wallV, 0.15 + Math.floor(k / 2) * 0.9, 0.9, 0.5, 0.7, L(0x8a6a3a), false);
        });
        if (hi === 1) { put(A, F, 6.8, (a + b) / 2 - 0.4, 0, 1.1, 1.1, 1.1, L(0x8a6a3a), true, 0, 0.3, 0); put(A, F, 6.9, (a + b) / 2 - 0.4, 1.1, 0.8, 0.8, 0.8, L(0x7a5a2a), false, 0, 1.0, 0); }
      });
      put(A, F, 0.3, F.halves()[0][1] - 0.4, 0, 0.1, 2.6, 0.5, L(C.metal), false, 0, 0, -0.25);
    },

    changing(spec, A, R) {
      const F = frame(spec), W = F.w;
      const lockerC = [0x6f93b3, 0xb0615a, 0x7a9a86];
      F.halves().forEach(([a, b], hi) => {
        const wallV = hi === 0 ? a + 0.3 : b - 0.3, s = hi === 0 ? 1 : -1;
        put(A, F, 4.8, wallV, 0, 7.4, 2.0, 0.55, L(lockerC[hi % 3]), true);
        for (let u = 1.4; u < 8.5; u += 0.62) put(A, F, u, wallV + s * 0.285, 0.2, 0.02, 1.7, 0.02, L(0x2a2a2a), false);
        put(A, F, 4.8, (a + b) / 2 + s * 0.2, 0.4, 6.0, 0.06, 0.4, L(C.woodL), false);
        [1, 3.5, 6, 8.5].forEach((u) => put(A, F, u + 1.8, (a + b) / 2 + s * 0.2, 0, 0.06, 0.4, 0.35, L(C.metalD), false));
        // shower stalls against the outer wall
        [a + 0.2, (a + b) / 2, b - 0.2].forEach((v) => put(A, F, W - 0.8, v, 0, 1.5, 2.0, 0.08, L(0xcfe0e8), true));
        put(A, F, W - 0.15, (a + b) / 2 - 0.9, 1.9, 0.2, 0.08, 0.12, L(C.metal), false);
        put(A, F, W - 0.15, (a + b) / 2 + 0.9, 1.9, 0.2, 0.08, 0.12, L(C.metal), false);
      });
      put(A, F, 6.0, F.halves()[1][0] + 1.2, 0.46, 0.5, 0.25, 0.3, L(0x2a3a6a), false);
      spot(A, F, 5.2, (F.halves()[0][0] + F.halves()[0][1]) / 2 + 0.2, 0.47, "changing");
      (A.world.puddles = A.world.puddles || []).push({ x: F.X(W - 2.0), z: F.Z(F.halves()[1][0] + 1.0), r: 1.0, y: F.y + 0.012 });
    },

    sports(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const [a0, b0] = F.halves()[0], [a1, b1] = F.halves()[1];
      // ball cages on the outer wall
      put(A, F, W - 0.5, (a0 + b0) / 2, 0, 0.8, 1.4, 2.0, L(C.metalD), true);
      for (let k = 0; k < 8; k++) { const b = P.mk(new THREE.SphereGeometry(0.12, 8, 6), L([0xd8d4c8, 0xc0602a, 0x2a2a2a][k % 3])); b.position.set(F.X(W - 0.5 + (R() - 0.5) * 0.4), F.y + 0.3 + (k % 3) * 0.35, F.Z((a0 + b0) / 2 + (R() - 0.5) * 1.6)); A.scene.add(b); }
      // a vaulting horse, stacked mats, a trolley of basketballs, hurdles
      const hg = grp(A, F, 6.8, (a0 + b0) / 2, "+v");
      P.box(hg, 1.6, 0.5, 0.5, L(0x7a4a2a), 0, 0.95, 0); [[-0.6, -0.15], [0.6, -0.15], [-0.6, 0.15], [0.6, 0.15]].forEach(([x, z]) => P.box(hg, 0.06, 0.75, 0.06, L(C.woodL), x, 0.37, z));
      solidGroup(A, hg);
      put(A, F, 8.0, (a1 + b1) / 2, 0, 2.0, 0.66, 1.2, L(0x2a4a8a), true);
      put(A, F, 3.6, b1 - 0.7, 0, 0.9, 0.9, 0.7, L(C.metal), true);
      for (let k = 0; k < 4; k++) { const hd = grp(A, F, 3.0 + k * 0.5, a1 + 0.6, 1); P.box(hd, 0.03, 0.7, 0.03, L(C.white), -0.4, 0.35, 0); P.box(hd, 0.03, 0.7, 0.03, L(C.white), 0.4, 0.35, 0); P.box(hd, 0.85, 0.08, 0.03, L(0xc03a2a), 0, 0.68, 0); }
      for (let k = 0; k < 6; k++) put(A, F, 5 + R() * 5, (R() - 0.5) * 2, 0, 0.2, 0.3, 0.2, L(0xc0602a), false, 0, 0, R() < 0.3 ? 1.4 : 0);
    },

    staff(spec, A, R) { KITS.lounge(spec, A, R, true); },

    lounge(spec, A, R, isStaffRoom) {
      const F = frame(spec), W = F.w, P = PP();
      const H = F.halves().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
      const [a0, b0] = H[0], m0 = (a0 + b0) / 2;
      // sofas round a low table
      const sofa = (u, v, face) => {
        const g = grp(A, F, u, v, face);
        P.box(g, 2.0, 0.42, 0.85, L(C.fabric), 0, 0.21, 0);
        P.box(g, 2.0, 0.5, 0.2, L(C.fabric), 0, 0.62, -0.33);
        [-1, 1].forEach((s) => P.box(g, 0.2, 0.62, 0.85, L(0x4a3a5a), s * 0.9, 0.31, 0));
        solidGroup(A, g);
      };
      sofa(W / 2 - 0.2, m0 - 1.2, "+v");
      sofa(W / 2 - 0.2, m0 + 1.35, "-v");
      put(A, F, W / 2 - 0.2, m0 + 0.08, 0, 1.3, 0.42, 0.7, L(0x5a3d26), false);
      put(A, F, W / 2 - 0.4, m0 + 0.1, 0.42, 0.2, 0.1, 0.2, L(C.white), false);
      spot(A, F, W / 2, m0 - 0.05, 0.43, isStaffRoom ? "staff" : "lounge");
      // the kitchenette along the outer wall
      const kv = H[1] ? (H[1][0] + H[1][1]) / 2 : m0;
      const kl = H[1] ? H[1][1] - H[1][0] - 0.4 : 2;
      put(A, F, W - 0.4, kv, 0, 0.7, 0.92, kl, L(0xd8d4c8), true);
      put(A, F, W - 0.4, kv, 0.92, 0.72, 0.04, kl + 0.02, L(0x5a5a5a), false);
      put(A, F, W - 0.35, kv - kl / 2 + 0.4, 0, 0.7, 1.8, 0.7, L(0xe8e8e4), true);          // the fridge
      put(A, F, W - 0.45, kv + 0.2, 0.96, 0.35, 0.22, 0.45, L(0x2a2a2c), false);           // a microwave
      if (!isStaffRoom) {
        // the coffee machine (a reward, G.Game.useReward): it still works
        const cg = grp(A, F, W - 0.45, kv + kl / 2 - 0.45, -1);
        P.box(cg, 0.5, 0.75, 0.45, L(0x2a2c30), 0, 0.96 + 0.375, 0);
        P.box(cg, 0.3, 0.12, 0.01, B(0x3aff9a), 0, 1.58, 0.231);
        P.box(cg, 0.12, 0.06, 0.1, L(0xb8bcc0), 0, 1.15, 0.24);
        P.box(cg, 0.08, 0.1, 0.08, L(C.white), 0, 1.02, 0.2);
        A.world.rewards = A.world.rewards || {};
        A.world.rewards.coffee = { kind: "coffee", used: false, mesh: cg, room: spec.key };
        A.world.interactables.push({ mesh: cg, kind: "coffee", ref: A.world.rewards.coffee });
      } else {
        // pigeonholes by the door and a round table
        put(A, F, 0.3, (a0 + b0) / 2 + (b0 - a0) / 2 - 0.9, 0.9, 0.35, 1.3, 1.4, L(C.woodL), true);
        desk(A, F, 3.0, m0, 1.0, 1.0, 0.74, C.woodL);
      }
      // an armchair, a bookcase
      put(A, F, 1.2, a0 + 0.6, 0, 0.8, 0.9, 0.8, L(0x6a5a3a), true);
      if (H[1]) shelves(A, F, 0.3, (H[1][0] + H[1][1]) / 2, 0.4, Math.min(2.4, H[1][1] - H[1][0] - 0.4), 1.9, C.woodD, BOOKS, 4, R);
    },

    archive(spec, A, R) {
      const F = frame(spec), W = F.w;
      const box = [0xc8b890, 0xb8a880, 0xd0c8a8];
      F.halves().forEach(([a, b]) => {
        const rowsV = [a + 0.45, (a + b) / 2 + 0.2, b - 0.35].filter((v, i, arr) => i === 0 || v - arr[i - 1] > 1.9);
        rowsV.forEach((v) => shelves(A, F, 7.4, v, 7.2, 0.5, 2.5, C.metal, box, 5, R));
      });
      const [a0, b0] = F.halves()[0];
      desk(A, F, 1.8, (a0 + b0) / 2 + 0.6, 0.8, 1.4, 0.76, C.woodD);
      put(A, F, 1.8, (a0 + b0) / 2 + 0.9, 0.76, 0.5, 0.5, 0.45, L(0x2e3a34), false);
      put(A, F, 1.85, (a0 + b0) / 2 + 0.25, 0.76, 0.3, 0.03, 0.24, L(C.paper), false, 0, 0.3, 0);
      spot(A, F, 1.75, (a0 + b0) / 2 + 0.3, 0.77, "archive");
      for (let k = 0; k < 10; k++) put(A, F, 3 + R() * 8, (R() - 0.5) * 2.4, 0, 0.4, 0.28, 0.3, L(box[k % 3]), false, 0, R() * 3, 0);
    },

    trophy(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const gold = L(C.gold), silver = L(0xb8bcc0), bronze = L(0x9a6a3a);
      const cup = (parent, x, y, z, s) => {
        const m = [gold, silver, bronze][Math.floor(R() * 3)];
        P.cyl(parent, 0.06 * s, 0.1 * s, 0.08 * s, 8, L(0x2a1a10), x, y + 0.04 * s, z);
        P.cyl(parent, 0.02 * s, 0.02 * s, 0.14 * s, 6, m, x, y + 0.15 * s, z);
        P.cyl(parent, 0.12 * s, 0.05 * s, 0.18 * s, 10, m, x, y + 0.31 * s, z);
      };
      F.halves().forEach(([a, b]) => {
        // glass cabinets along the outer wall, shelves of cups
        const len = b - a - 0.4;
        put(A, F, W - 0.4, (a + b) / 2, 0, 0.6, 2.0, len, L(0x3a2418), true);
        put(A, F, W - 0.71, (a + b) / 2, 0.15, 0.02, 1.8, len - 0.1, B(0x2a3a4a), false);
        for (let k = 0; k < 3; k++) for (let t = a + 0.5; t < b - 0.4; t += 0.55) if (R() < 0.8) cup(A.scene, F.X(W - 0.45), F.y + 0.3 + k * 0.6, F.Z(t), 1 + R() * 0.6);
        // pennants on the side walls
        const sv = a < 0 ? a - 0.1 : b + 0.1;
        for (let k = 0; k < 4; k++) put(A, F, 2 + k * 2.4, Math.sign(sv) * (F.d / 2 - 0.23), 2.3, 1.0, 0.4, 0.02, L([0xc03a2a, 0x2a6ad8, 0xe8c02a, 0x3aa84a][k]), false, 0, 0, 0.12);
      });
      // the school cup in its own case in the middle of the room: the prize
      // money for sports day is still in the drawer under it (a reward)
      const H = F.halves(), [a1, b1] = H[H.length - 1];
      const tg = grp(A, F, 6.4, (a1 + b1) / 2, "+v");
      P.box(tg, 1.2, 1.0, 1.0, L(0x3a2418), 0, 0.5, 0);
      P.box(tg, 1.1, 0.7, 0.9, B(0x2a3a4a), 0, 1.35, 0);
      cup(tg, 0, 1.0, 0, 3.2);
      P.box(tg, 0.6, 0.12, 0.02, L(0xb8962a), 0, 0.72, 0.51);
      solidGroup(A, tg);
      A.world.rewards = A.world.rewards || {};
      A.world.rewards.trophy = { kind: "trophy", used: false, mesh: tg, room: spec.key };
      A.world.interactables.push({ mesh: tg, kind: "trophy", ref: A.world.rewards.trophy });
      const bp = boardPlane(14, 3.0, 0.9);
      bp.position.set(F.X(0.13), F.y + 2.4, F.Z(H[0][0] + 1.6)); bp.rotation.y = F.o > 0 ? Math.PI / 2 : -Math.PI / 2; A.scene.add(bp);
    },

    broadcast(spec, A, R) {
      const F = frame(spec), W = F.w, P = PP();
      const H = F.halves(), [a1, b1] = H[H.length - 1], m1 = (a1 + b1) / 2;
      // foam on the walls
      [-1, 1].forEach((s) => { for (let u = 1; u < W - 0.6; u += 0.62) for (let y = 0.5; y < 3.0; y += 0.62) if (R() < 0.85) put(A, F, u, s * (F.d / 2 - 0.23), y, 0.5, 0.5, 0.05, L((Math.floor(u / 0.62) + Math.floor(y / 0.62)) % 2 ? 0x2c2c32 : 0x34343a), false); });
      // the desk: a mixing desk, two microphones on arms, speakers
      desk(A, F, W - 1.0, m1, 1.0, b1 - a1 - 0.6, 0.8, 0x2a2a2e, 0x1c1c1e);
      put(A, F, W - 1.05, m1 - 0.4, 0.8, 0.6, 0.08, 1.4, L(0x1c1c20), false, 0, 0, 0.1);
      for (let k = 0; k < 24; k++) put(A, F, W - 1.25 + (k % 4) * 0.12, m1 - 1.0 + Math.floor(k / 4) * 0.22, 0.89, 0.03, 0.04, 0.03, B([0xff5a3a, 0x3aff6a, 0xffd43a, 0xd8d8d8][k % 4]), false);
      [m1 - 0.9, m1 + 0.5].forEach((v) => { put(A, F, W - 0.6, v, 0.8, 0.03, 0.5, 0.03, L(C.metalD), false); put(A, F, W - 0.9, v, 1.25, 0.4, 0.03, 0.03, L(C.metalD), false, 0, 0, -0.4); put(A, F, W - 1.1, v, 1.05, 0.08, 0.14, 0.08, L(0x3a3a3c), false); });
      [a1 + 0.35, b1 - 0.35].forEach((v) => { put(A, F, W - 0.45, v, 0.8, 0.35, 0.5, 0.35, L(0x1a1a1c), false); put(A, F, W - 0.63, v, 0.95, 0.01, 0.14, 0.14, L(0x3a3a3c), false); });
      chair(A, F, W - 2.0, m1, 1, C.black);
      // the transmitter that still runs off its battery (a reward)
      const rg = grp(A, F, W - 1.1, m1 + 0.9, -1);
      P.box(rg, 0.5, 0.3, 0.3, L(0x3a3e2a), 0, 0.95, 0);
      P.box(rg, 0.18, 0.08, 0.01, B(0xffb03a), -0.1, 1.0, 0.151);
      P.cyl(rg, 0.04, 0.04, 0.03, 10, L(0xb8bcc0), 0.14, 0.97, 0.16, Math.PI / 2, 0, 0);
      P.box(rg, 0.012, 0.6, 0.012, L(C.metal), 0.2, 1.4, 0);
      A.world.rewards = A.world.rewards || {};
      A.world.rewards.radio = { kind: "radio", used: false, mesh: rg, room: spec.key };
      A.world.interactables.push({ mesh: rg, kind: "radio", ref: A.world.rewards.radio });
      spot(A, F, W - 1.05, m1 + 0.2, 0.81, "broadcast");
      // equipment rack in the other half, and the ON AIR light over the door
      const [a0, b0] = H[0];
      put(A, F, W - 0.5, (a0 + b0) / 2, 0, 0.7, 1.9, 0.8, L(0x1c1e22), true);
      for (let k = 0; k < 8; k++) put(A, F, W - 0.86, (a0 + b0) / 2 - 0.25 + (k % 2) * 0.4, 0.3 + k * 0.2, 0.01, 0.03, 0.06, B(k % 3 ? 0x3aff6a : 0xff5a3a), false);
      const bp = boardPlane(6, 1.1, 0.34);
      bp.position.set(F.X(0.13), F.y + 3.05, F.Z(F.doors[0])); bp.rotation.y = F.o > 0 ? Math.PI / 2 : -Math.PI / 2; A.scene.add(bp);
    },
  };

  G.SchoolRooms = {
    TYPES, KITS, floorTexture, boards, signPlane, boardPlane,
    furnish(spec, api) {
      const k = KITS[spec.type];
      if (!k) return;
      const R = G.makeRng(spec.key.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
      k(spec, api, R);
    },
    // the stairwell up to the third floor: a floor plan by the way in, a
    // sign pointing up, and a bucket someone left on the landing
    furnishStairs(slot, api, F2, F3) {
      const P = PP(), s = slot.s;
      const plan = boardPlane(9, 1.6, 0.6);
      plan.position.set(slot.xIn + s * 0.22, F2 + 1.7, slot.zN + 0.24 + 1.4);
      plan.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      api.scene.add(plan);
      P.box(api.scene, 0.4, 0.35, 0.4, L(0x3a6a9a), slot.xOut - s * 1.2, F3 + 0.18, slot.zS - 1.0);
      P.box(api.scene, 0.02, 0.9, 0.02, L(0x8a6a3a), slot.xOut - s * 1.0, F3 + 0.6, slot.zS - 1.1, 0.3, 0, 0.2);
    },
  };
})();
