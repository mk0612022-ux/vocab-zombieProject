// ===================================================================
// The abandoned school, dressed (map pass D)
// -------------------------------------------------------------------
// Everything here is decoration layered onto the school level after
// world.js has built its walls, rooms, doors and colliders:
//   yard()     grass tufts that sway in the wind (one InstancedMesh and a
//              few lines of vertex shader), weeds in the cracked path, fallen
//              leaves, vines on the fences and the facade, overgrown bushes,
//              old trees of different kinds, and the junk of an abandoned
//              school: a leaning flagpole with a torn flag, a fallen bike,
//              rotten benches, an old basketball hoop, a tipped-over bin, a
//              dead car
//   facade()   window frames, sills and lintels; lit, dark, broken and
//              boarded windows; cornice, parapet coping, roof clutter, front
//              steps, a canopy fascia, downpipes; water stains, cracks,
//              peeling paint and moss
//   interior() cream walls over a pale green dado with a wood rail, torn
//              posters, notice boards, stopped clocks, fire extinguishers,
//              dried-out plants, paper on the floor, ceiling tubes that match
//              each room's light (steady, flickering or dead) and dust
//              hanging in the light
// Rules it keeps (D4): repeated things are InstancedMesh (grass, weeds,
// leaves, vines, paper) or plain meshes sharing materials, which G.Perf merges
// into a handful of draw calls; the small stuff (leaves, paper, dust) thins
// out or switches off at low graphics quality, live; nothing here is a
// collider except a few solid props (tree trunks, the car, two poles) placed
// well off every route, so movement, shooting, "press E" and the zombies'
// routes are unchanged.
// ===================================================================
(function () {
  const RANK = { vlow: 0, low: 1, medium: 2, high: 3, vhigh: 4 };
  // how much of each kind of detail each quality level keeps
  const TABLE = {
    grass: { vlow: 0.15, low: 0.3, medium: 0.65, high: 1, vhigh: 1.25 },
    vines: { vlow: 0.2, low: 0.35, medium: 0.75, high: 1, vhigh: 1 },
    small: { vlow: 0, low: 0.35, medium: 0.7, high: 1, vhigh: 1.2 },   // leaves, paper
    dust: { vlow: 0, low: 0, medium: 0.6, high: 1, vhigh: 1.3 },
  };
  const MAXK = 1.3;   // instance buffers are sized for the densest setting

  // ---- one palette texture for all the dressing ----------------------------
  // G.Perf.mergeStatic merges meshes that share a material, per 32m cell. With
  // a material per colour, forty colours cost forty draw calls in every cell.
  // Instead every colour is one texel of a small palette texture and a mesh's
  // UVs all point at its texel: the whole lot shares two materials (lit and
  // unlit) and merges into a couple of draw calls per cell.
  const PAL = { size: 32, n: 0, idx: {} };
  PAL.cv = document.createElement("canvas"); PAL.cv.width = PAL.cv.height = PAL.size;
  PAL.ctx = PAL.cv.getContext("2d");
  PAL.tex = new THREE.CanvasTexture(PAL.cv);
  PAL.tex.magFilter = PAL.tex.minFilter = THREE.NearestFilter; PAL.tex.generateMipmaps = false;
  PAL.lit = new THREE.MeshLambertMaterial({ map: PAL.tex });
  PAL.unlit = new THREE.MeshBasicMaterial({ map: PAL.tex });
  function texel(hex) {
    if (PAL.idx[hex] == null) {
      const i = PAL.idx[hex] = PAL.n++;
      PAL.ctx.fillStyle = "#" + hex.toString(16).padStart(6, "0");
      PAL.ctx.fillRect(i % PAL.size, Math.floor(i / PAL.size), 1, 1);
      PAL.tex.needsUpdate = true;
    }
    const i = PAL.idx[hex];
    return [(i % PAL.size + 0.5) / PAL.size, 1 - (Math.floor(i / PAL.size) + 0.5) / PAL.size];
  }
  // a paint: a colour to be looked up in the palette
  const lam = (color) => ({ paint: true, color, lit: true });
  const basic = (color) => ({ paint: true, color, lit: false });
  // a mesh from a geometry and either a paint or a real material
  function mk(geo, m) {
    if (m && m.paint) {
      const [u, v] = texel(m.color), uv = geo.attributes.uv;
      if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
      else geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 2).fill(0).map((_, k) => (k % 2 ? v : u)), 2));
      return new THREE.Mesh(geo, m.lit ? PAL.lit : PAL.unlit);
    }
    return new THREE.Mesh(geo, m);
  }
  // decals that need see-through (water stains) keep a real material
  const decalCache = {};
  const decal = (color, opacity) => {
    if (opacity == null) return lam(color);
    const k = color + ":" + opacity;
    return decalCache[k] || (decalCache[k] = new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false }));
  };

  // several indexed geometries (already placed) as one
  function concatGeos(geos) {
    let nv = 0, ni = 0;
    geos.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    geos.forEach((g) => {
      pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
      const I = g.index.array;
      for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo;
      vo += g.attributes.position.count; io += I.length;
      g.dispose();
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  function box(scene, w, h, d, mat, x, y, z, rx, ry, rz) {
    const m = mk(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    scene.add(m);
    return m;
  }
  function cyl(scene, rt, rb, h, seg, mat, x, y, z, rx, ry, rz) {
    const m = mk(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    scene.add(m);
    return m;
  }
  // a lumpy ball made from a subdivided cube pushed out to a sphere: indexed,
  // so it merges like a box (an IcosahedronGeometry would not)
  function blobGeo(r, rng, lump) {
    const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n = Math.sin(v.x * 5.1 + rng.a) * Math.sin(v.y * 4.3 + rng.b) * Math.sin(v.z * 3.7 + rng.c);
      v.multiplyScalar(r * (1 + (lump || 0.22) * n));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  function blob(scene, r, mat, x, y, z, sx, sy, sz, R) {
    const m = mk(blobGeo(r, { a: R() * 6, b: R() * 6, c: R() * 6 }, 0.25), mat);
    m.position.set(x, y, z);
    m.scale.set(sx || 1, sy || 1, sz || 1);
    m.rotation.y = R() * 6;
    scene.add(m);
    return m;
  }

  // ---- instanced details, sized for the densest setting ----------------
  function detail(world, mesh, kind) {
    world.dressDetails = world.dressDetails || [];
    world.dressDetails.push({ mesh, max: mesh.count, kind });
  }

  // ---- instanced details in culled chunks ---------------------------------
  // An InstancedMesh is frustum-culled by its base geometry's bounds -- one
  // tuft at the origin -- so a single field of grass was either drawn from
  // everywhere (inside the classrooms too) or dropped while in plain view.
  // Instances are gathered first, then emitted in grid chunks, each with
  // bounds that really cover it.
  function collector() {
    return {
      items: [], count: 0, instanceMatrix: {}, instanceColor: {},
      setMatrixAt(i, m) { (this.items[i] = this.items[i] || {}).m = m.clone(); },
      setColorAt(i, c) { (this.items[i] = this.items[i] || {}).c = c.clone(); },
    };
  }
  function emit(world, scene, geo, mat, col, kind, grid) {
    const items = col.items.slice(0, col.count || col.items.length).filter((it) => it && it.m);
    const p = new THREE.Vector3();
    let groups = [items];
    if (grid) {
      const all = new THREE.Box3();
      items.forEach((it) => all.expandByPoint(p.setFromMatrixPosition(it.m)));
      const cw = (all.max.x - all.min.x) / grid[0] + 1e-3, cd = (all.max.z - all.min.z) / grid[1] + 1e-3;
      groups = Array.from({ length: grid[0] * grid[1] }, () => []);
      items.forEach((it) => { p.setFromMatrixPosition(it.m); groups[Math.floor((p.x - all.min.x) / cw) + grid[0] * Math.floor((p.z - all.min.z) / cd)].push(it); });
    }
    groups.forEach((its) => {
      if (!its.length) return;
      const g = geo.clone(), b = new THREE.Box3();
      its.forEach((it) => b.expandByPoint(p.setFromMatrixPosition(it.m)));
      b.expandByScalar(1.3);
      g.boundingBox = b; g.boundingSphere = b.getBoundingSphere(new THREE.Sphere());
      const mesh = new THREE.InstancedMesh(g, mat, its.length);
      mesh.frustumCulled = true;   // r128 switches it off for every InstancedMesh; these bounds are real
      its.forEach((it, i) => { mesh.setMatrixAt(i, it.m); if (it.c) mesh.setColorAt(i, it.c); });
      scene.add(mesh);
      detail(world, mesh, kind);
    });
    geo.dispose();
  }

  // ---- wind for the grass: the blade tip moves, the root stays ------------
  function swayMaterial(world, base) {
    const u = world.dress.uniforms;
    base.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = u.uTime;
      shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <project_vertex>", [
        "vec4 mvPosition = vec4( transformed, 1.0 );",
        "#ifdef USE_INSTANCING",
        "  mvPosition = instanceMatrix * mvPosition;",
        "  float gh = clamp( transformed.y, 0.0, 1.0 );",
        "  vec2 ip = instanceMatrix[3].xz;",
        "  float gust = 0.6 + 0.4 * sin( uTime * 0.37 + ip.x * 0.05 );",
        "  float w = sin( uTime * 1.6 + ip.x * 0.31 + ip.y * 0.23 ) + 0.45 * sin( uTime * 2.9 + ip.x * 0.83 + ip.y * 0.5 );",
        "  mvPosition.x += w * 0.09 * gust * gh * gh;",
        "  mvPosition.z += w * 0.05 * gust * gh * gh;",
        "#endif",
        "mvPosition = modelViewMatrix * mvPosition;",
        "gl_Position = projectionMatrix * mvPosition;",
      ].join("\n"));
    };
    base.customProgramCacheKey = () => "grass-sway";
    return base;
  }
  // A tuft: six tapered blades leaning out from a common root, darker at the
  // root. Normals point up so a tuft is lit evenly from every side.
  function tuftGeometry(R, blades) {
    const pos = [], col = [], nor = [], idx = [];
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + R() * 0.8;
      const ox = Math.cos(a) * 0.05 * R(), oz = Math.sin(a) * 0.05 * R();
      const dx = Math.cos(a + 1.57), dz = Math.sin(a + 1.57);     // blade width direction
      const lean = 0.15 + 0.3 * R(), lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
      const top = 0.75 + 0.25 * R(), w = 0.03 + 0.02 * R();
      const base = pos.length / 3;
      const V = [
        [ox - dx * w, 0, oz - dz * w], [ox + dx * w, 0, oz + dz * w],
        [ox - dx * w * 0.6 + lx * 0.35, top * 0.5, oz - dz * w * 0.6 + lz * 0.35],
        [ox + dx * w * 0.6 + lx * 0.35, top * 0.5, oz + dz * w * 0.6 + lz * 0.35],
        [ox + lx, top, oz + lz],
      ];
      const shade = [0.45, 0.45, 0.78, 0.78, 1.05];
      V.forEach((v, i) => { pos.push(v[0], v[1], v[2]); col.push(shade[i], shade[i], shade[i]); nor.push(0, 1, 0); });
      idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  // ---- a texture atlas: torn posters and notices ---------------------------
  // 4x4 cells of 256px: row 0-1 posters, row 2-3 notices and signs. One
  // texture, so every poster in a 32m cell merges into one draw call.
  let atlas = null;
  function posterAtlas(R) {
    if (atlas) return atlas;
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 1024;
    const c = cv.getContext("2d");
    const cell = (i) => ({ x: (i % 4) * 256, y: Math.floor(i / 4) * 256 });
    const tear = (x, y) => {
      // torn edges and a missing corner: cut to transparent
      c.save(); c.globalCompositeOperation = "destination-out";
      c.beginPath(); c.moveTo(x + 256, y); c.lineTo(x + 256, y + 60 + R() * 70);
      for (let k = 0; k < 6; k++) c.lineTo(x + 256 - (k + 1) * (16 + R() * 12), y + 50 + R() * 60 - k * 9);
      c.lineTo(x + 150 + R() * 40, y); c.closePath(); c.fill();
      for (let k = 0; k < 26; k++) {   // ragged border
        const t = R(), side = Math.floor(R() * 4), s = 3 + R() * 8;
        const px = side === 0 ? x + t * 256 : side === 1 ? x + 256 - s : side === 2 ? x + t * 256 : x;
        const py = side === 0 ? y : side === 1 ? y + t * 256 : side === 2 ? y + 256 - s : y + t * 256;
        c.fillRect(px, py, s, s);
      }
      c.restore();
      // water damage
      c.fillStyle = "rgba(90,70,40,0.18)";
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + R() * 256, y + 140 + R() * 110, 20 + R() * 40, 0, 7); c.fill(); }
    };
    const title = (x, y, t, bg, fg, size) => {
      c.fillStyle = bg; c.fillRect(x + 6, y + 6, 244, 244);
      c.fillStyle = fg; c.font = `bold ${size || 34}px sans-serif`; c.textAlign = "center"; c.fillText(t, x + 128, y + 58);
    };
    const P = [
      (x, y) => { title(x, y, "ห้ามวิ่ง", "#f2eee2", "#c0302a", 44); c.fillStyle = "#c0302a"; c.beginPath(); c.arc(x + 128, y + 150, 62, 0, 7); c.lineWidth = 12; c.strokeStyle = "#c0302a"; c.stroke(); c.fillStyle = "#333"; c.fillRect(x + 110, y + 110, 18, 60); c.fillRect(x + 98, y + 150, 50, 12); c.fillRect(x + 84, y + 186, 88, 12); },
      (x, y) => { title(x, y, "ABC", "#fdf6d8", "#2a4a8a", 44); const L = "ABCDEFGHIJKLMNOP"; c.font = "bold 30px sans-serif"; for (let i = 0; i < 16; i++) { c.fillStyle = ["#c0302a", "#2a7a3a", "#2a4a8a", "#b8861a"][i % 4]; c.fillText(L[i], x + 42 + (i % 4) * 58, y + 110 + Math.floor(i / 4) * 38); } },
      (x, y) => { title(x, y, "ก ข ค", "#e8f2e0", "#2a6a3a", 40); const L = "กขฃคฅฆงจฉชซฌญฎฏฐ"; c.font = "bold 30px sans-serif"; c.fillStyle = "#1f3a28"; for (let i = 0; i < 16; i++) c.fillText(L[i], x + 42 + (i % 4) * 58, y + 112 + Math.floor(i / 4) * 38); },
      (x, y) => { c.fillStyle = "#5f8fb8"; c.fillRect(x + 6, y + 6, 244, 244); c.fillStyle = "#6e9a52"; [[70, 90, 40], [150, 120, 55], [190, 190, 30], [90, 180, 26]].forEach(([a, b, r]) => { c.beginPath(); c.ellipse(x + a, y + b, r, r * 0.7, 0.5, 0, 7); c.fill(); }); c.fillStyle = "#fff"; c.font = "bold 26px sans-serif"; c.textAlign = "center"; c.fillText("แผนที่โลก", x + 128, y + 40); },
      (x, y) => { title(x, y, "รักษาความสะอาด", "#e2f0f2", "#1f5a6a", 28); c.fillStyle = "#3a6a4a"; c.fillRect(x + 96, y + 110, 64, 90); c.fillRect(x + 88, y + 98, 80, 14); c.fillStyle = "#e2f0f2"; for (let i = 0; i < 3; i++) c.fillRect(x + 106 + i * 18, y + 120, 6, 70); },
      (x, y) => { title(x, y, "ตารางธาตุ", "#f0ece2", "#333", 30); for (let i = 0; i < 40; i++) { c.fillStyle = ["#e0a0a0", "#a0c8e0", "#e0d890", "#b0e0a8"][(i * 7) % 4]; if (i % 10 === 1 || i % 10 === 2) continue; c.fillRect(x + 20 + (i % 10) * 22, y + 90 + Math.floor(i / 10) * 30, 19, 26); } },
      (x, y) => { title(x, y, "สู้ O-NET!", "#2a3a6a", "#ffd23a", 40); c.fillStyle = "#ffd23a"; c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 30 : 70, a = k * Math.PI / 5 - Math.PI / 2; c.lineTo(x + 128 + Math.cos(a) * r, y + 160 + Math.sin(a) * r); } c.fill(); },
      (x, y) => { title(x, y, "กินผักผลไม้", "#f6f0dc", "#3a7a2a", 30); [["#d8402a", 80, 140], ["#f0a020", 150, 130], ["#6ab03a", 110, 195], ["#e8d040", 180, 190]].forEach(([f, a, b]) => { c.fillStyle = f; c.beginPath(); c.arc(x + a, y + b, 30, 0, 7); c.fill(); }); },
    ];
    P.forEach((draw, i) => { const { x, y } = cell(i); draw(x, y); tear(x, y); });
    // 8-13: notices (handwritten lines), 14: fire extinguisher sign, 15: a clock-less spare
    for (let i = 8; i < 14; i++) {
      const { x, y } = cell(i);
      c.fillStyle = ["#f2efe4", "#f5e9a8", "#f2c8d0", "#d8ecf2", "#f2efe4", "#e8f0c8"][i - 8]; c.fillRect(x + 20, y + 10, 216, 236);
      c.fillStyle = "rgba(40,40,60,0.75)";
      c.font = "bold 20px sans-serif"; c.textAlign = "left"; c.fillText(["ประกาศ", "งดเรียน", "กีฬาสี", "สอบกลางภาค", "หาย! แมว", "ชมรม"][i - 8], x + 34, y + 44);
      for (let k = 0; k < 8; k++) c.fillRect(x + 34, y + 64 + k * 20, 120 + R() * 60, 3);
      c.fillStyle = "rgba(90,70,40,0.15)"; c.beginPath(); c.arc(x + 60 + R() * 140, y + 180, 30, 0, 7); c.fill();
    }
    { const { x, y } = cell(14); c.fillStyle = "#c0201a"; c.fillRect(x + 8, y + 60, 240, 136); c.fillStyle = "#fff"; c.font = "bold 30px sans-serif"; c.textAlign = "center"; c.fillText("ถังดับเพลิง", x + 128, y + 140); }
    { const { x, y } = cell(15); c.fillStyle = "#e8e4d8"; c.fillRect(x, y, 256, 256); }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 2;
    atlas = { tex, mat: new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), cell };
    return atlas;
  }
  function atlasPlane(A, idx, w, h) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv, u0 = (idx % 4) / 4, v0 = 1 - (Math.floor(idx / 4) + 1) / 4;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 4);
    return new THREE.Mesh(g, A.mat);
  }

  // ---- what goes on a wall, and where there is room for it -----------------
  // A wall run: axis "z" = the wall runs along Z at x = fixed; face = which
  // way its surface looks (+1/-1 along the other axis).
  function wallPoint(w, t, n, y) {
    return w.axis === "z" ? new THREE.Vector3(w.fixed + w.face * n, y, t) : new THREE.Vector3(t, y, w.fixed + w.face * n);
  }
  function wallBox(w, t0, t1, n0, n1, y0, y1) {
    const a = wallPoint(w, t0, n0, y0), b = wallPoint(w, t1, n1, y1);
    return new THREE.Box3(a.clone().min(b), a.clone().max(b));
  }
  function faceRotY(w) {
    // a plane faces +Z by default
    if (w.axis === "z") return w.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    return w.face > 0 ? 0 : Math.PI;
  }

  G.SchoolDress = {
    // which rooms light normally, flicker, or are dead (D3), fixed per room
    lightMode(key) {
      if (key === "W1" || key === "C1S") return "steady";    // the first room and corridor you see
      let h = 2166136261;
      for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
      h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
      const r = (h >>> 0) % 100;
      // a corridor is never left pitch dark -- it is how you get anywhere
      if (/^C\d/.test(key)) return r < 35 ? "flicker" : "steady";
      return r < 22 ? "off" : r < 48 ? "flicker" : "steady";
    },

    init(world) {
      if (world.dress) return world.dress;
      const d = world.dress = {
        uniforms: { uTime: { value: 0 } }, t: 0, flags: [],
        update: (dt) => {
          d.t += dt;
          d.uniforms.uTime.value = d.t;
          d.flags.forEach((f) => f.step(d.t));
        },
      };
      world.noMerge = world.noMerge || [];
      return d;
    },

    // live graphics-quality changes: thin out / restore the small details
    applyQuality(world, q) {
      (world.dressDetails || []).forEach((dd) => {
        const k = (TABLE[dd.kind] || TABLE.grass)[q];
        const n = Math.round(dd.max * (k == null ? 1 : k) / MAXK);
        if (dd.mesh.isPoints) dd.mesh.geometry.setDrawRange(0, n);
        else dd.mesh.count = n;
        dd.mesh.visible = n > 0;
      });
    },

    // =====================================================================
    // D1: the grounds in front of the school
    // =====================================================================
    yard(api) {
      const { scene, world, x0, x1, z0, z1 } = api;
      const R = G.makeRng(90210);
      this.init(world);
      const floorAt = (x, z) => G.getFloorHeightAt(world, x, z, 0);
      const PATH = 2.7;
      const onPath = (x) => Math.abs(x) < PATH;
      const nearDoor = (x, z) => z < z0 + 2.6 && Math.abs(x) < 5;

      // ---- grass tufts: dark green, yellow-green and dry brown, in patches
      {
        const COUNT = Math.round(4000 * MAXK);
        const mat = swayMaterial(world, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
        const geo = tuftGeometry(R, 5), mesh = collector();
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        const cols = [new THREE.Color(0x3a5528), new THREE.Color(0x4f6e33), new THREE.Color(0x7f8638), new THREE.Color(0x86704a)];
        const col = new THREE.Color();
        let n = 0;
        for (let i = 0; i < COUNT * 3 && n < COUNT; i++) {
          const x = x0 + 0.7 + R() * (x1 - x0 - 1.4), z = z0 + 0.7 + R() * (z1 - z0 - 1.4);
          if (onPath(x) && R() > 0.04) continue;          // a few creep onto the path edge
          if (nearDoor(x, z)) continue;
          // patches: slow noise picks lush, seeding or dried-out ground
          const patch = Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17 + 0.4) + 0.5 * Math.sin(x * 0.53 + z * 0.41);
          const edge = Math.min(x - x0, x1 - x, z1 - z) < 3 ? 1.35 : 1;   // taller along the fence
          const h = (0.28 + R() * 0.55) * edge * (patch > 0.6 ? 1.3 : 1);
          p.set(x, floorAt(x, z), z);
          q.setFromAxisAngle(up, R() * Math.PI * 2);
          s.set(0.8 + R() * 0.6, h, 0.8 + R() * 0.6);
          m4.compose(p, q, s);
          mesh.setMatrixAt(n, m4);
          const k = patch > 0.45 ? (R() < 0.65 ? 3 : 2) : patch > -0.2 ? (R() < 0.45 ? 1 : R() < 0.6 ? 2 : 0) : (R() < 0.6 ? 0 : 1);
          col.copy(cols[k]).multiplyScalar(0.85 + R() * 0.3);
          mesh.setColorAt(n, col);
          n++;
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        emit(world, scene, geo, mat, mesh, "grass", [3, 2]);
      }

      // ---- weeds pushing up through the cracked path
      {
        const COUNT = Math.round(170 * MAXK);
        const mat = swayMaterial(world, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
        const geo = tuftGeometry(R, 4), mesh = collector();
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        const col = new THREE.Color();
        let n = 0;
        for (let i = 0; i < COUNT; i++) {
          // along the slab joints (every ~2m) and the path edges
          const z = z0 + 2.2 + R() * (z1 - z0 - 3);
          const joint = Math.round(z / 2.1) * 2.1;
          const zz = R() < 0.6 ? joint + (R() - 0.5) * 0.3 : z;
          const x = R() < 0.5 ? (R() - 0.5) * 4.2 : (R() < 0.5 ? -1 : 1) * (2.0 + R() * 0.5);
          p.set(x, 0.1, zz);
          q.setFromAxisAngle(up, R() * 6.3);
          const h = 0.12 + R() * 0.28;
          s.set(0.7 + R() * 0.5, h, 0.7 + R() * 0.5);
          m4.compose(p, q, s);
          mesh.setMatrixAt(n, m4);
          col.setHex(R() < 0.5 ? 0x7a8a3a : 0x5a7a30).multiplyScalar(0.9 + R() * 0.25);
          mesh.setColorAt(n, col);
          n++;
        }
        mesh.count = n;
        emit(world, scene, geo, mat, mesh, "grass");
      }

      // ---- old trees: dead and bare, twisted and thin, or still half in leaf
      const TREES = [
        [-19, 44, "dead"], [-14, 55, "leafy"], [17, 37, "twisted"], [21, 55, "dead"],
        [8, 45, "twisted"], [-7, 58, "leafy"], [-24, 58.5, "dead"], [24, 58.2, "twisted"],
      ];
      const bark = lam(0x3b2f24), barkL = lam(0x4f4030), twig = lam(0x5a4a38);
      const leafs = [lam(0x3d5a2a), lam(0x4e6a30), lam(0x6a7034), lam(0x34482a)];
      TREES.forEach(([tx, tz, kind], ti) => {
        const h = kind === "leafy" ? 5.4 + R() * 1.4 : 4.4 + R() * 2.2;
        // a trunk in three bent pieces
        let px = tx, pz = tz, py = 0, lean = (R() - 0.5) * (kind === "twisted" ? 0.5 : 0.18), dir = R() * 6.3;
        const thick = kind === "leafy" ? 0.7 : 0.55;
        const segs = [];
        for (let s = 0; s < 3; s++) {
          const len = h / 3, w = thick * (1 - s * 0.22);
          const ang = lean * (s + 1) * (kind === "twisted" ? (s % 2 ? -1 : 1) : 1);
          const dx = Math.sin(ang) * Math.cos(dir), dz = Math.sin(ang) * Math.sin(dir);
          const m = box(scene, w, len + 0.1, w, s ? barkL : bark, px + dx * len / 2, py + len / 2, pz + dz * len / 2, 0, R() * 3, 0);
          m.rotation.z = ang * Math.cos(dir); m.rotation.x = -ang * Math.sin(dir);
          px += dx * len; pz += dz * len; py += len * Math.cos(ang);
          segs.push({ x: px, y: py, z: pz });
        }
        world.colliders.push(new THREE.Box3(new THREE.Vector3(tx - thick / 2 - 0.05, 0, tz - thick / 2 - 0.05), new THREE.Vector3(tx + thick / 2 + 0.05, 2.6, tz + thick / 2 + 0.05)));
        // limbs from the upper two joints, each with a couple of twigs
        const limbs = kind === "leafy" ? 4 : 6;
        const tips = [];
        for (let b = 0; b < limbs; b++) {
          const j = segs[b % 2 ? 2 : 1], ang = (b / limbs) * 6.3 + R() * 0.8, len = 1.2 + R() * (kind === "leafy" ? 1.6 : 2.2);
          const up = 0.35 + R() * 0.5;
          const mx = j.x + Math.cos(ang) * len * 0.45, mz = j.z + Math.sin(ang) * len * 0.45, my = j.y - 0.4 + up * len * 0.4;
          const limb = box(scene, len, 0.16 - b * 0.01, 0.16, barkL, mx, my, mz, 0, -ang, up);
          const ex = j.x + Math.cos(ang) * len * 0.9, ez = j.z + Math.sin(ang) * len * 0.9, ey = my + up * len * 0.4;
          tips.push({ x: ex, y: ey, z: ez });
          for (let t = 0; t < 2; t++) {
            const ta = ang + (t ? 0.7 : -0.6) + (R() - 0.5) * 0.4, tl = 0.5 + R() * 0.8;
            box(scene, tl, 0.07, 0.07, twig, ex + Math.cos(ta) * tl * 0.4, ey + 0.15 + R() * 0.2, ez + Math.sin(ta) * tl * 0.4, 0, -ta, 0.5 + R() * 0.5);
          }
          void limb;
        }
        if (kind === "leafy") {
          // a crown with gaps in it, not a lollipop
          for (let k = 0; k < 8; k++) {
            const t = tips[k % tips.length];
            blob(scene, 0.9 + R() * 0.6, leafs[k % leafs.length], t.x + (R() - 0.5) * 1.2, t.y + (R() - 0.2) * 0.8, t.z + (R() - 0.5) * 1.2, 1, 0.7, 1, R);
          }
        } else if (kind === "twisted") {
          // a few thin clusters clinging on
          for (let k = 0; k < 5; k++) {
            const t = tips[k % tips.length];
            blob(scene, 0.35 + R() * 0.3, leafs[(k + ti) % leafs.length], t.x + (R() - 0.5) * 0.6, t.y + R() * 0.3, t.z + (R() - 0.5) * 0.6, 1, 0.6, 1, R);
          }
        }
        if (ti % 2 === 0) api.addBloodStain(tx + 1.2, tz + 0.8, 0.9, R() * 3);
      });

      // ---- fallen leaves: everywhere, and thick under the trees
      {
        const COUNT = Math.round(2300 * MAXK);
        const geo = new THREE.PlaneGeometry(0.16, 0.1); geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), mesh = collector();
        const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
        const cols = [0x6a4a2a, 0x8a5a2a, 0xa0782a, 0x5a4a30, 0x7a6a3a, 0x4a3a28].map((c) => new THREE.Color(c));
        const col = new THREE.Color();
        for (let i = 0; i < COUNT; i++) {
          let x, z;
          if (R() < 0.55) { const t = TREES[Math.floor(R() * TREES.length)], a = R() * 6.3, r = Math.sqrt(R()) * 4.5; x = t[0] + Math.cos(a) * r; z = t[1] + Math.sin(a) * r; }
          else { x = x0 + 0.6 + R() * (x1 - x0 - 1.2); z = z0 + 0.6 + R() * (z1 - z0 - 1.2); }
          x = Math.max(x0 + 0.6, Math.min(x1 - 0.6, x)); z = Math.max(z0 + 0.6, Math.min(z1 - 0.6, z));
          p.set(x, floorAt(x, z) + (onPath(x) ? 0.11 : 0.02) + R() * 0.02, z);
          e.set((R() - 0.5) * 0.5, R() * 6.3, (R() - 0.5) * 0.5); q.setFromEuler(e);
          const sc = 0.7 + R() * 0.7; s.set(sc, 1, sc);
          m4.compose(p, q, s);
          mesh.setMatrixAt(i, m4);
          col.copy(cols[Math.floor(R() * cols.length)]).multiplyScalar(0.8 + R() * 0.35);
          mesh.setColorAt(i, col);
        }
        emit(world, scene, geo, mat, mesh, "small", [3, 2]);
      }

      // ---- vines: strands climbing the railings, the brick flanks and the
      // front of the building
      {
        const COUNT = Math.round(2600 * MAXK);
        const geo = new THREE.PlaneGeometry(0.15, 0.12);
        const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), mesh = collector();
        const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
        const cols = [0x2f4a24, 0x3e5a2a, 0x4a6630, 0x5a6a2e].map((c) => new THREE.Color(c));
        const col = new THREE.Color();
        let n = 0;
        // [start x, start z, wall axis, face sign, max height]
        const runs = [];
        for (let x = x0 + 1.5; x < x1 - 1.5; x += 1.3 + R() * 1.4) if (Math.abs(x) > 3.6) runs.push([x, z1 - 0.5, "x", R() < 0.5 ? -1 : 1, 1.6 + R() * 0.6]);
        for (let z = z0 + 1.2; z < z1 - 1; z += 1.5 + R() * 1.6) { runs.push([x0 + 0.5, z, "z", 1, 1.5 + R() * 0.7]); runs.push([x1 - 0.5, z, "z", -1, 1.5 + R() * 0.7]); }
        for (let x = x0 + 1; x < -16; x += 1.4 + R()) runs.push([x, z0 + 0.52, "x", 1, 2.2 + R() * 0.4]);
        for (let x = 16.5; x < x1 - 1; x += 1.4 + R()) runs.push([x, z0 + 0.52, "x", 1, 2.2 + R() * 0.4]);
        [[-15.3, 5.5], [-11.8, 3.2], [-5.2, 2.6], [5.2, 2.4], [9.2, 4.2], [15.2, 6.5]].forEach(([x, hmax]) => runs.push([x, z0 + 0.23, "x", 1, hmax]));
        runs.forEach(([sx, sz, axis, face, hmax]) => {
          let t = axis === "x" ? sx : sz, y = 0.05;
          while (y < hmax && n < COUNT) {
            t += (R() - 0.5) * 0.09;
            y += 0.05 + R() * 0.05;
            for (let k = 0; k < 2 && n < COUNT; k++) {
              const off = (R() - 0.5) * 0.22;
              if (axis === "x") p.set(t + off, y, sz + face * (0.08 + R() * 0.04)); else p.set(sz === undefined ? 0 : sx + face * (0.08 + R() * 0.04), y, t + off);
              if (axis === "z") p.x = sx + face * (0.08 + R() * 0.04);
              e.set((R() - 0.5) * 0.8, (axis === "x" ? (face > 0 ? 0 : Math.PI) : face * Math.PI / 2) + (R() - 0.5) * 0.6, R() * 6.3);
              q.setFromEuler(e);
              const sc = 0.6 + R() * 0.8 * (1 - y / (hmax + 1)); s.set(sc, sc, sc);
              m4.compose(p, q, s);
              mesh.setMatrixAt(n, m4);
              col.copy(cols[Math.floor(R() * cols.length)]).multiplyScalar(0.8 + R() * 0.4);
              mesh.setColorAt(n, col);
              n++;
            }
          }
        });
        mesh.count = n;
        emit(world, scene, geo, mat, mesh, "vines", [3, 1]);
      }

      // ---- bushes, overgrown against the fences and the building
      {
        const greens = [lam(0x344a26), lam(0x42582c), lam(0x2c3e22)], dry = lam(0x5a5236);
        [[-23.4, 57.4], [-16.2, 58.4], [15.6, 58.3], [23.5, 49.5], [-24, 40.3], [23.4, 35.2], [-18.4, 34.4], [18.8, 34.3], [-5.6, 34.1], [5.8, 34.2], [-24.2, 50.5]].forEach(([bx, bz], i) => {
          const k = 3 + Math.floor(R() * 3);
          for (let j = 0; j < k; j++) {
            const r = 0.45 + R() * 0.45;
            blob(scene, r, greens[(i + j) % 3], bx + (R() - 0.5) * 1.6, r * 0.7, bz + (R() - 0.5) * 1.0, 1.2, 0.85, 1, R);
          }
          for (let j = 0; j < 4; j++) box(scene, 0.04, 0.6 + R() * 0.6, 0.04, dry, bx + (R() - 0.5) * 1.4, 0.7 + R() * 0.3, bz + (R() - 0.5) * 0.8, (R() - 0.5) * 0.8, 0, (R() - 0.5) * 0.8);
        });
      }

      // ---- the junk of an abandoned school ----
      this.flagpole(api, R, -4.6, 42.4);
      this.bicycle(scene, R, 4.3, 50.6);
      this.bench(scene, R, 10.6, 40.6, 0.25);
      this.bench(scene, R, -10.4, 51.8, -0.35);
      this.hoop(api, R, 22.6, 44);
      this.bin(scene, R, 5.4, 42.2);
      this.car(api, R, -22.4, 36.3, 0.38);
    },

    flagpole(api, R, x, z) {
      const { scene, world } = api;
      const steel = lam(0x8a8e92), conc = lam(0x7a776e);
      box(scene, 0.9, 0.35, 0.9, conc, x, 0.17, z, 0, 0.3, 0);
      const tilt = -0.14;
      const pole = new THREE.Group(); pole.position.set(x, 0.3, z); pole.rotation.z = tilt; pole.rotation.x = 0.04; scene.add(pole);
      const H = 7.2;
      const p = cyl(pole, 0.05, 0.075, H, 8, steel, 0, H / 2, 0);
      cyl(pole, 0.09, 0.09, 0.14, 8, lam(0xb8a060), 0, H + 0.05, 0);   // the ball on top
      box(pole, 0.012, H - 0.6, 0.012, lam(0xd0ccc0), 0.07, (H - 0.6) / 2 + 0.3, 0);   // the rope
      world.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.45, 0, z - 0.45), new THREE.Vector3(x + 0.45, 1.6, z + 0.45)));
      // the flag: faded stripes, the fly end torn to rags, sagging halfway down
      const cv = document.createElement("canvas"); cv.width = 128; cv.height = 80;
      const c = cv.getContext("2d");
      [["#a8403a", 0, 13], ["#e8e2d4", 13, 13], ["#34406a", 26, 28], ["#e8e2d4", 54, 13], ["#a8403a", 67, 13]].forEach(([f, y, h]) => { c.fillStyle = f; c.fillRect(0, y, 128, h); });
      c.fillStyle = "rgba(60,50,30,0.25)"; c.fillRect(0, 0, 128, 80);
      c.globalCompositeOperation = "destination-out";
      c.beginPath(); c.moveTo(128, 0);
      for (let y = 0; y <= 80; y += 6) c.lineTo(84 + R() * 38, y);
      c.lineTo(128, 80); c.closePath(); c.fill();
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(30 + R() * 60, R() * 80, 3 + R() * 5, 0, 7); c.fill(); }
      const tex = new THREE.CanvasTexture(cv);
      const geo = new THREE.PlaneGeometry(1.6, 1.0, 12, 6);
      geo.translate(0.8, 0, 0);
      const flag = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5 }));
      flag.position.set(0.08, H - 2.3, 0);
      pole.add(flag);
      api.world.noMerge.push(flag);
      const base = geo.attributes.position.array.slice();
      const pos = geo.attributes.position;
      this.init(world).flags.push({
        step: (t) => {
          for (let i = 0; i < pos.count; i++) {
            const bx = base[i * 3], by = base[i * 3 + 1];
            const k = bx / 1.6;
            pos.setXYZ(i, bx - k * 0.1, by - k * k * 0.25 + Math.sin(t * 2.1 + bx * 3) * 0.04 * k, Math.sin(t * 2.6 + bx * 4 + by) * 0.18 * k + Math.sin(t * 5.3 + bx * 9) * 0.03 * k);
          }
          pos.needsUpdate = true;
        },
      });
      void p;
    },

    bicycle(scene, R, x, z) {
      const g = new THREE.Group(); g.position.set(x, 0.12, z); g.rotation.set(-Math.PI / 2 + 0.12, 0, 0.6); scene.add(g);
      const tyre = lam(0x1c1c1c), frame = lam(0x2f6a8a), chrome = lam(0x8a8a88);
      [-0.55, 0.55].forEach((dx, i) => {
        const w = mk(new THREE.TorusGeometry(0.33, 0.028, 5, 16), tyre); w.position.set(dx, 0, 0); if (i) w.rotation.y = 0.25; g.add(w);
        box(g, 0.02, 0.62, 0.02, chrome, dx, 0, 0, 0, 0, 1.0);
      });
      box(g, 0.75, 0.04, 0.04, frame, 0.05, 0.28, 0, 0, 0, -0.35);
      box(g, 0.62, 0.04, 0.04, frame, -0.15, 0.1, 0, 0, 0, 0.55);
      box(g, 0.04, 0.4, 0.04, frame, 0.33, 0.22, 0, 0, 0, 0.25);
      box(g, 0.22, 0.05, 0.1, lam(0x2a2220), -0.28, 0.42, 0);
      box(g, 0.04, 0.04, 0.5, chrome, 0.48, 0.47, 0);
    },

    bench(scene, R, x, z, ry) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const wood = lam(0x6a5a44), woodD = lam(0x4a3e30), iron = lam(0x3a3a38);
      [-0.8, 0.8].forEach((dx) => { box(g, 0.08, 0.45, 0.5, iron, dx, 0.22, 0); box(g, 0.08, 0.5, 0.06, iron, dx, 0.7, -0.24); });
      box(g, 1.9, 0.05, 0.14, wood, 0, 0.47, 0.17);
      box(g, 1.9, 0.05, 0.14, woodD, 0, 0.47, 0.0, 0, 0, 0.02);
      box(g, 1.1, 0.05, 0.14, wood, -0.35, 0.3, -0.12, 0.2, 0.1, 0.45);   // a slat gave way
      box(g, 1.9, 0.12, 0.04, woodD, 0, 0.85, -0.26);
      box(g, 0.9, 0.12, 0.04, wood, 0.45, 0.66, -0.26, 0, 0, -0.1);
    },

    hoop(api, R, x, z) {
      const { scene, world } = api;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(0, -Math.PI / 2, 0.04); scene.add(g);
      const steel = lam(0x5a5e62), board = lam(0xc8c4b8), orange = lam(0xc0501f), net = lam(0xd8d4c8), pad = lam(0x3e3d3a);
      box(api.scene, 5.2, 0.05, 5.6, pad, x - 2.4, 0.03, z);   // a cracked slab of court
      for (let i = 0; i < 4; i++) box(api.scene, 0.05, 0.02, 1.4 + R() * 1.5, decal(0x222220), x - 1 - R() * 3.5, 0.065, z + (R() - 0.5) * 3.5, 0, R() * 3, 0);
      cyl(g, 0.08, 0.1, 3.4, 8, steel, 0, 1.7, 0);
      box(g, 0.08, 0.08, 0.9, steel, 0, 3.3, 0.45);
      box(g, 1.8, 1.1, 0.06, board, 0, 3.55, 0.9);
      box(g, 0.6, 0.45, 0.02, decal(0x8a3a2a), 0, 3.35, 0.94);
      const rim = mk(new THREE.TorusGeometry(0.23, 0.02, 5, 14), orange); rim.position.set(0, 3.08, 1.18); rim.rotation.x = Math.PI / 2 + 0.25; g.add(rim);
      for (let i = 0; i < 5; i++) box(g, 0.012, 0.25 + R() * 0.2, 0.012, net, Math.cos(i * 1.2) * 0.2, 2.9, 1.18 + Math.sin(i * 1.2) * 0.2, 0, 0, (R() - 0.5) * 0.4);
      const ball = mk(new THREE.SphereGeometry(0.12, 8, 6), orange); ball.scale.y = 0.5; ball.position.set(x - 3.3, 0.08, z + 1.4); scene.add(ball);
      world.colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.2, 0, z - 0.2), new THREE.Vector3(x + 0.2, 3.4, z + 0.2)));
    },

    bin(scene, R, x, z) {
      const green = lam(0x35553f), dark = lam(0x22352a), paper = lam(0xd8d2c0), can = lam(0x9a9a98), bag = lam(0x1c1c1e);
      cyl(scene, 0.34, 0.3, 0.95, 10, green, x, 0.33, z, 0, 0.4, Math.PI / 2 - 0.05);
      cyl(scene, 0.36, 0.36, 0.05, 10, dark, x + 0.9, 0.03, z + 0.5, 0.1, 0, 0.05);
      for (let i = 0; i < 9; i++) box(scene, 0.18 + R() * 0.1, 0.01, 0.22 + R() * 0.1, paper, x - 0.6 - R() * 1.2, 0.015, z + (R() - 0.5) * 1.1, 0, R() * 3, 0);
      for (let i = 0; i < 3; i++) cyl(scene, 0.035, 0.035, 0.12, 8, can, x - 0.4 - R(), 0.035, z + (R() - 0.5) * 0.9, Math.PI / 2, R() * 3, 0);
      blob(scene, 0.25, bag, x - 1.3, 0.18, z - 0.3, 1.2, 0.7, 1, R);
    },

    car(api, R, x, z, ry) {
      const { scene, world } = api;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const paint = lam(0x6a7a86), paintD = lam(0x4a5660), rust = lam(0x6a4a2e), glass = lam(0x1c2228), tyre = lam(0x1a1a1a), chrome = lam(0x7a7a78), light = lam(0xb8b0a0);
      box(g, 4.2, 0.62, 1.8, paint, 0, 0.6, 0);                      // body
      box(g, 2.2, 0.6, 1.62, paint, -0.25, 1.2, 0);                   // cabin
      box(g, 2.0, 0.5, 1.64, glass, -0.25, 1.22, 0);                  // windows
      box(g, 0.9, 0.52, 0.02, paintD, 0.35, 1.21, 0.83, 0, 0, 0.05);  // a door pillar, glass gone behind it
      box(g, 0.06, 0.5, 1.5, glass, 0.87, 1.2, 0, 0, 0, -0.5);         // windscreen
      box(g, 4.3, 0.14, 1.84, chrome, 0, 0.36, 0);
      [[1.4, 0.92], [1.4, -0.92], [-1.4, 0.92], [-1.4, -0.92]].forEach(([dx, dz], i) => {
        const w = cyl(g, 0.34, 0.34, 0.22, 10, tyre, dx, i === 2 ? 0.22 : 0.34, dz, Math.PI / 2, 0, 0);   // one flat
        if (i === 2) w.scale.set(1, 1, 0.75);
      });
      box(g, 0.05, 0.16, 0.3, light, 2.11, 0.68, 0.6);
      box(g, 0.05, 0.16, 0.3, lam(0x2a2826), 2.11, 0.68, -0.6);      // one headlight smashed
      for (let i = 0; i < 6; i++) box(g, 0.3 + R() * 0.6, 0.2 + R() * 0.3, 0.02, rust, (R() - 0.5) * 3.5, 0.5 + R() * 0.3, (R() < 0.5 ? 1 : -1) * 0.91);
      box(g, 1.2, 0.02, 1.0, rust, 1.3, 0.92, 0.1);                   // bonnet rust
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g); b.max.y = 1.6;
      world.colliders.push(b);
    },

    // =====================================================================
    // D2: the front of the building
    // =====================================================================
    facade(api) {
      const { scene, world, ENTRY } = api;
      const R = G.makeRng(31337);
      this.init(world);
      const zf = ENTRY.cz + ENTRY.d / 2, face = zf + 0.21, W = ENTRY.w;
      const wood = lam(0x6b4a2f), woodD = lam(0x4a3220), sillM = lam(0xa8a295), lintM = lam(0x8a8578);
      const warm = basic(0xe0a458), dim = basic(0x9a6a38);
      const WINDOWS = [];
      [2.4, 6.2].forEach((wy, row) => { for (let i = -4; i <= 4; i++) { const wx = i * 3.4; if (Math.abs(wx) < 4.4 || Math.abs(wx) > W / 2 - 1.5) continue; WINDOWS.push({ wx, wy, row, i, broken: (i + row) % 3 === 0 }); } });
      const LIT = { "-6.8,2.4": "steady", "13.6,2.4": "flicker", "-10.2,6.2": "dim", "10.2,6.2": "steady" };
      const BOARDED = { "6.8,2.4": 1, "-13.6,2.4": 1 };
      WINDOWS.forEach((w) => {
        const key = w.wx.toFixed(1) + "," + w.wy.toFixed(1);
        const z = zf + 0.5;
        // frame, mullion and transom in brown wood; sill below, lintel above
        box(scene, 1.86, 0.08, 0.07, wood, w.wx, w.wy + 0.62, z);
        box(scene, 1.86, 0.08, 0.07, wood, w.wx, w.wy - 0.62, z);
        [-0.9, 0.9].forEach((dx) => box(scene, 0.08, 1.3, 0.07, wood, w.wx + dx, w.wy, z));
        box(scene, 0.05, 1.2, 0.06, woodD, w.wx, w.wy, z);
        box(scene, 1.7, 0.05, 0.06, woodD, w.wx, w.wy + 0.25, z);
        box(scene, 2.2, 0.1, 0.36, sillM, w.wx, w.wy - 0.74, zf + 0.46);
        box(scene, 2.2, 0.16, 0.26, lintM, w.wx, w.wy + 0.76, zf + 0.4);
        const lit = LIT[key];
        if (lit) {
          if (lit === "flicker") {
            const m = new THREE.MeshBasicMaterial({ color: 0xe0a458 });
            const g = box(scene, 1.66, 1.16, 0.02, m, w.wx, w.wy, zf + 0.495);
            world.noMerge.push(g);
            const l = api.addLight(w.wx, w.wy, zf + 1.3, 0xffb060, 0.8, 1);
            l.distance = 8; l.userData.mode = "flicker"; l.userData.glow = m;
          } else {
            box(scene, 1.66, 1.16, 0.02, lit === "dim" ? dim : warm, w.wx, w.wy, zf + 0.495);
            if (w.row === 0) { const l = api.addLight(w.wx, w.wy, zf + 1.3, 0xffb060, 0.6, 0.8); l.distance = 8; }
          }
          // light spilling onto the ground in front
          if (w.row === 0) {
            const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), new THREE.MeshBasicMaterial({ color: 0xffa050, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
            spill.rotation.x = -Math.PI / 2; spill.position.set(w.wx, 0.04, zf + 1.9);
            scene.add(spill);
          }
        }
        if (BOARDED[key]) {
          box(scene, 2.1, 0.2, 0.05, lam(0x7a6448), w.wx, w.wy + 0.2, zf + 0.56, 0, 0, 0.42);
          box(scene, 2.1, 0.2, 0.05, lam(0x6a5640), w.wx, w.wy - 0.2, zf + 0.57, 0, 0, -0.38);
          box(scene, 1.9, 0.18, 0.05, lam(0x7a6448), w.wx, w.wy - 0.05, zf + 0.58, 0, 0, 0.05);
        }
        // water has run down from every sill for years
        const n = 1 + Math.floor(R() * 2);
        for (let k = 0; k < n; k++) {
          const h = 0.9 + R() * 1.3;
          box(scene, 0.2 + R() * 0.45, h, 0.012, decal(0x3e3a30, 0.4), w.wx + (R() - 0.5) * 1.5, w.wy - 0.8 - h / 2, face + 0.005);
        }
      });

      // cornice with dentils under the parapet, coping on top of it
      box(scene, W + 1.3, 0.14, 0.34, lintM, 0, 8.33, zf + 0.62);
      for (let x = -W / 2; x <= W / 2; x += 0.55) box(scene, 0.22, 0.16, 0.2, sillM, x, 8.18, zf + 0.62);
      box(scene, W + 1.6, 0.1, 1.25, sillM, 0, 9.05, zf);
      // on the roof, over the parapet: a water tank on legs, vents, an antenna
      const roofY = 9.0, steel = lam(0x6a6e70), rustM = lam(0x6a4a2e);
      [[8.6, zf - 4.5]].forEach(([tx, tz]) => {
        [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([dx, dz]) => box(scene, 0.1, 1.2, 0.1, steel, tx + dx, roofY + 0.6, tz + dz));
        cyl(scene, 0.95, 0.95, 1.5, 14, lam(0x8a8e88), tx, roofY + 1.95, tz);
        cyl(scene, 0.97, 0.97, 0.15, 14, rustM, tx, roofY + 2.72, tz);
      });
      [[-7, zf - 3, 0.8], [-12.5, zf - 6, 1.1], [3, zf - 7.5, 0.7]].forEach(([vx, vz, s]) => { box(scene, s, s * 0.7, s, steel, vx, roofY + s * 0.35, vz); box(scene, s * 0.7, 0.08, s * 0.7, rustM, vx, roofY + s * 0.72, vz); });
      { const ax = -3, az = zf - 5; box(scene, 0.05, 2.6, 0.05, steel, ax, roofY + 1.3, az, 0, 0, 0.12); for (let i = 0; i < 3; i++) box(scene, 1.0 - i * 0.25, 0.03, 0.03, steel, ax + 0.1 + i * 0.05, roofY + 1.8 + i * 0.3, az, 0, 0.4, 0); }

      // front steps (a few centimetres each: dressing, not climbing)
      [[0.2, 0.8, 0.12], [0.8, 1.4, 0.08], [1.4, 2.0, 0.04]].forEach(([a, b, h], i) => box(scene, 6.4 + i * 0.3, h, b - a, lam(0x8a877e), 0, h / 2, zf + (a + b) / 2));
      // the canopy's fascia and its brackets
      box(scene, 9.4, 0.3, 0.08, lam(0x8a3a2e), 0, 4.5, zf + 1.84);
      [-3.2, 3.2].forEach((bx) => box(scene, 0.1, 0.1, 1.5, woodD, bx, 4.1, zf + 1.0, -0.55, 0, 0));
      for (let i = 0; i < 4; i++) box(scene, 0.25 + R() * 0.4, 0.3, 0.012, decal(0x5a3020, 0.5), -4 + R() * 8, 4.35, zf + 1.89);
      // downpipes at both ends, stained round the foot
      [-15.6, 15.6].forEach((px) => {
        cyl(scene, 0.07, 0.07, 8.5, 8, lam(0x5a5e5e), px, 4.25, zf + 0.33);
        box(scene, 0.5, 0.12, 0.3, lam(0x5a5e5e), px, 8.55, zf + 0.33);
        box(scene, 0.8, 1.6, 0.012, decal(0x2e3a26, 0.55), px, 0.8, face + 0.004);
      });
      // cracks, peeling paint and moss across the front
      const clear = (x, y) => !WINDOWS.some((w) => Math.abs(x - w.wx) < 1.2 && Math.abs(y - w.wy) < 0.95) && !(Math.abs(x) < 4.4 && y < 5);
      for (let k = 0; k < 14; k++) {
        let x = (R() - 0.5) * (W - 2), y = 0.4 + R() * 7.4;
        if (!clear(x, y)) continue;
        for (let s = 0; s < 4; s++) {
          const len = 0.25 + R() * 0.45, a = (R() - 0.5) * 1.2;
          box(scene, 0.025, len, 0.012, decal(0x2a2824), x, y, face + 0.006, 0, 0, a);
          x += Math.sin(-a) * len * 0.9; y -= Math.cos(a) * len * 0.9;
        }
      }
      for (let k = 0; k < 22; k++) {
        const x = (R() - 0.5) * (W - 1.5), y = 0.5 + R() * 7.6;
        if (!clear(x, y)) continue;
        const pw = 0.3 + R() * 0.9, ph = 0.2 + R() * 0.6;
        const m = R() < 0.55 ? decal(0x6f6a5e) : decal(0xc2bba8);
        box(scene, pw, ph, 0.012, m, x, y, face + 0.007);
        box(scene, pw * 0.6, ph * 0.7, 0.012, m, x + pw * 0.4, y - ph * 0.3, face + 0.007);
      }
      const moss = [decal(0x34442a), decal(0x44532e)];
      for (let x = -W / 2 + 0.3; x < W / 2; x += 0.6 + R() * 0.9) {
        if (Math.abs(x) < 3.9) continue;
        const h = 0.15 + R() * (Math.abs(x) > W / 2 - 3 ? 0.9 : 0.45);
        box(scene, 0.4 + R() * 0.7, h, 0.012, moss[Math.floor(R() * 2)], x, h / 2, face + 0.008);
      }
      WINDOWS.forEach((w) => { if (R() < 0.6) box(scene, 1.4 + R() * 0.6, 0.03, 0.2, moss[1], w.wx, w.wy - 0.68, zf + 0.46); });
    },

    // =====================================================================
    // D2/D3: inside -- walls, what hangs on them, the floor, the light
    // =====================================================================
    interior(api) {
      const { scene, world, cfg, HALF, corrZ0, corrZ1, storeyList, F2 } = api;
      const R = G.makeRng(4242);
      const d = this.init(world);
      const A = posterAtlas(G.makeRng(777));
      const dado = lam(0x80937a), rail = lam(0x6b4a2f), skirt = lam(0x4a3220);

      // ---- where things may go on a wall: not in a doorway, not where a
      // sliding panel parks, not over lockers, furniture or a wall gun
      const block = [];
      world.roomDoors.forEach((dr) => dr.leaves.forEach((lf) => {
        const c0 = lf.a0, c1 = lf.a0 + lf.dir * lf.T;
        const lo = Math.min(c0, c1) - lf.L / 2 - 0.2, hi = Math.max(c0, c1) + lf.L / 2 + 0.2;
        const a = (t, n) => dr.axis === "x" ? new THREE.Vector3(dr.x + t, 0, dr.z + n) : new THREE.Vector3(dr.x + n, 0, dr.z + t);
        const p = a(lo, -0.6), q = a(hi, 0.6);
        block.push(new THREE.Box3(p.clone().min(q).setY(dr.baseY), p.clone().max(q).setY(dr.baseY + 4)));
      }));
      scene.updateMatrixWorld(true);
      const things = [];
      scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.material === api.wallMat || o.material === api.ceilingMat || Array.isArray(o.material)) return;
        const b = new THREE.Box3().setFromObject(o);
        if (b.isEmpty()) return;
        const sz = b.getSize(new THREE.Vector3());
        if (Math.max(sz.x, sz.z) > 6) return;          // floors, ceilings, long runs
        things.push(b);
      });
      world.colliders.forEach((c) => { const sz = c.getSize(new THREE.Vector3()); if (Math.min(sz.x, sz.z) > 0.45 && Math.max(sz.x, sz.z) < 6) things.push(c); });
      const placed = [];
      const free = (bx) => !block.some((b) => b.intersectsBox(bx)) && !things.some((b) => b.intersectsBox(bx)) && !placed.some((b) => b.intersectsBox(bx));

      // wall runs: corridors (both sides, both floors) and every room
      const walls = [];
      storeyList.forEach((fl) => {
        const y = fl === 1 ? 0 : F2;
        [-1, 1].forEach((s) => walls.push({ axis: "z", fixed: s * HALF, face: -s, from: corrZ0 + 0.3, to: corrZ1 - 0.3, y, kind: "corridor", doors: cfg.rows.map((r) => r.cz) }));
      });
      cfg.plan.forEach((spec) => {
        if (!spec.room) return;
        const r = spec.room, y = spec.baseY || 0, hw = r.w / 2, hd = r.d / 2;
        const doorSide = spec.side === "W" ? 1 : -1;       // the corridor wall
        walls.push({ axis: "z", fixed: r.cx - hw, face: 1, from: r.cz - hd + 0.3, to: r.cz + hd - 0.3, y, kind: "room", spec, doors: doorSide < 0 ? [r.cz] : [] });
        walls.push({ axis: "z", fixed: r.cx + hw, face: -1, from: r.cz - hd + 0.3, to: r.cz + hd - 0.3, y, kind: "room", spec, doors: doorSide > 0 ? [r.cz] : [] });
        walls.push({ axis: "x", fixed: r.cz - hd, face: 1, from: r.cx - hw + 0.3, to: r.cx + hw - 0.3, y, kind: "room", spec, doors: [] });
        walls.push({ axis: "x", fixed: r.cz + hd, face: -1, from: r.cx - hw + 0.3, to: r.cx + hw - 0.3, y, kind: "room", spec, doors: [] });
      });

      // ---- pale green dado with a wood rail and a skirting board ----------
      walls.forEach((w) => {
        const gaps = w.doors.map((c) => [c - 1.62, c + 1.62]).sort((a, b) => a[0] - b[0]);
        let t = w.from - 0.3;
        const end = w.to + 0.3;
        const segs = [];
        gaps.forEach(([a, b]) => { if (a > t) segs.push([t, a]); t = Math.max(t, b); });
        if (end > t) segs.push([t, end]);
        segs.forEach(([a, b]) => {
          const len = b - a, mid = (a + b) / 2;
          if (len < 0.2) return;
          const put = (h, y0, dep, m) => {
            const p = wallPoint(w, mid, 0.2 + dep / 2, w.y + y0 + h / 2);
            const g = w.axis === "z" ? new THREE.BoxGeometry(dep, h, len) : new THREE.BoxGeometry(len, h, dep);
            const mesh = mk(g, m); mesh.position.copy(p); scene.add(mesh);
          };
          put(1.02, 0.12, 0.025, dado);
          put(0.06, 1.12, 0.05, rail);
          put(0.12, 0, 0.04, skirt);
        });
      });

      // ---- things on the walls ----------------------------------------------
      const hang = (w, t, y, n, wdt, hgt, depth, make) => {
        const bx = wallBox(w, t - wdt / 2 - 0.1, t + wdt / 2 + 0.1, 0.21, 0.21 + Math.max(0.35, depth), w.y + y - hgt / 2 - 0.1, w.y + y + hgt / 2 + 0.1);
        if (!free(bx)) return false;
        placed.push(bx);
        make(wallPoint(w, t, 0.2 + n, w.y + y), faceRotY(w));
        return true;
      };
      const poster = (w, t) => {
        const idx = Math.floor(R() * 8), s = 0.7 + R() * 0.35;
        return hang(w, t, 1.55 + R() * 0.4, 0.03, s, s, 0.05, (p, ry) => {
          const m = atlasPlane(A, idx, s, s); m.position.copy(p); m.rotation.set(0, ry, (R() - 0.5) * 0.12); scene.add(m);
        });
      };
      const cork = lam(0x9a6f45), pinC = [lam(0xc03030), lam(0x3050c0), lam(0x30a040)];
      const board = (w, t) => hang(w, t, 1.6, 0.04, 1.6, 1.0, 0.08, (p, ry) => {
        const g = new THREE.Group(); g.position.copy(p); g.rotation.y = ry; scene.add(g);
        box(g, 1.6, 1.0, 0.04, cork, 0, 0, 0);
        [[0, 0.52, 1.7, 0.06], [0, -0.52, 1.7, 0.06], [-0.82, 0, 0.06, 1.0], [0.82, 0, 0.06, 1.0]].forEach(([x, y, bw, bh]) => box(g, bw, bh, 0.06, rail, x, y, 0.01));
        for (let k = 0; k < 5; k++) {
          const m = atlasPlane(A, 8 + Math.floor(R() * 6), 0.3, 0.3); m.position.set(-0.55 + k * 0.28 + (R() - 0.5) * 0.08, (R() - 0.5) * 0.4, 0.03 + k * 0.002); m.rotation.z = (R() - 0.5) * 0.3; g.add(m);
          box(g, 0.025, 0.025, 0.02, pinC[k % 3], m.position.x, m.position.y + 0.13, 0.05);
        }
      });
      const face = lam(0xe8e4d8), rim = lam(0x2a2a2c), hand = lam(0x1a1a1a);
      const clock = (w, t) => hang(w, t, 2.75, 0.03, 0.5, 0.5, 0.06, (p, ry) => {
        const g = new THREE.Group(); g.position.copy(p); g.rotation.y = ry; scene.add(g);
        cyl(g, 0.24, 0.24, 0.04, 18, rim, 0, 0, 0, Math.PI / 2, 0, 0);
        cyl(g, 0.21, 0.21, 0.045, 18, face, 0, 0, 0.005, Math.PI / 2, 0, 0);
        // stopped at 3:17 -- the hour it all went wrong
        const hr = -(3 + 17 / 60) / 12 * Math.PI * 2, mn = -(17 / 60) * Math.PI * 2;
        box(g, 0.022, 0.11, 0.01, hand, Math.sin(-hr) * 0.05, Math.cos(hr) * 0.05, 0.03, 0, 0, hr);
        box(g, 0.016, 0.17, 0.01, hand, Math.sin(-mn) * 0.08, Math.cos(mn) * 0.08, 0.032, 0, 0, mn);
        for (let k = 0; k < 12; k++) box(g, 0.012, 0.03, 0.01, hand, Math.sin(k / 12 * 6.28) * 0.18, Math.cos(k / 12 * 6.28) * 0.18, 0.03, 0, 0, -k / 12 * 6.28);
      });
      const red = lam(0xb0201c), black = lam(0x1c1c1c), grey = lam(0x6a6a6a);
      const extinguisher = (w, t) => hang(w, t, 1.3, 0.14, 0.4, 1.3, 0.25, (p, ry) => {
        const g = new THREE.Group(); g.position.copy(p); g.rotation.y = ry; scene.add(g);
        box(g, 0.2, 0.06, 0.12, grey, 0, -0.05, -0.08);
        cyl(g, 0.09, 0.09, 0.46, 10, red, 0, -0.12, 0);
        box(g, 0.05, 0.08, 0.05, black, 0, 0.16, 0);
        box(g, 0.14, 0.02, 0.03, black, 0.04, 0.21, 0, 0, 0, 0.2);
        box(g, 0.02, 0.36, 0.02, black, 0.1, 0.0, 0.04, 0, 0, 0.1);
        const sign = atlasPlane(A, 14, 0.4, 0.4); sign.position.set(0, 0.62, -0.1); g.add(sign);
      });
      const pot = lam(0x9a5a3a), stem = lam(0x5a4a30);
      const plant = (x, y, z) => {
        cyl(scene, 0.21, 0.15, 0.38, 10, pot, x, y + 0.19, z);
        cyl(scene, 0.19, 0.19, 0.02, 10, lam(0x3a2a1c), x, y + 0.37, z);
        for (let k = 0; k < 5; k++) box(scene, 0.025, 0.4 + R() * 0.5, 0.025, stem, x + (R() - 0.5) * 0.15, y + 0.6 + R() * 0.2, z + (R() - 0.5) * 0.15, (R() - 0.5) * 0.9, 0, (R() - 0.5) * 0.9);
        for (let k = 0; k < 4; k++) box(scene, 0.09, 0.005, 0.06, lam(0x7a5a30), x + (R() - 0.5) * 0.7, y + 0.01, z + (R() - 0.5) * 0.7, 0, R() * 3, 0);
      };

      walls.forEach((w) => {
        const len = w.to - w.from;
        const slots = [];
        for (let t = w.from + 0.5; t < w.to - 0.5; t += 0.55) slots.push(t);
        for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
        let posters = w.kind === "corridor" ? Math.round(len / 3.2) : 1 + Math.floor(R() * 2);
        let boards = w.kind === "corridor" ? Math.round(len / 14) : (R() < 0.45 ? 1 : 0);
        let clocks = w.kind === "corridor" ? Math.round(len / 18) : (R() < 0.3 ? 1 : 0);
        let ext = w.kind === "corridor" ? Math.max(1, Math.round(len / 22)) : 0;
        for (const t of slots) {
          if (ext > 0 && extinguisher(w, t)) { ext--; continue; }
          if (boards > 0 && board(w, t)) { boards--; continue; }
          if (clocks > 0 && clock(w, t)) { clocks--; continue; }
          if (posters > 0 && poster(w, t)) { posters--; continue; }
        }
      });
      // dried-out plants in a corner of about half the rooms and at the
      // corridor ends
      cfg.plan.forEach((spec) => {
        if (!spec.room || R() < 0.45) return;
        const r = spec.room, sx = R() < 0.5 ? -1 : 1, sz = R() < 0.5 ? -1 : 1;
        const x = r.cx + sx * (r.w / 2 - 0.55), z = r.cz + sz * (r.d / 2 - 0.55);
        const bx = new THREE.Box3(new THREE.Vector3(x - 0.3, (spec.baseY || 0) + 0.1, z - 0.3), new THREE.Vector3(x + 0.3, (spec.baseY || 0) + 1, z + 0.3));
        if (free(bx)) { placed.push(bx); plant(x, spec.baseY || 0, z); }
      });
      storeyList.forEach((fl) => [-1, 1].forEach((s) => {
        const y = fl === 1 ? 0 : F2, x = s * (HALF - 0.55), z = corrZ0 + 0.7;
        const bx = new THREE.Box3(new THREE.Vector3(x - 0.3, y + 0.1, z - 0.3), new THREE.Vector3(x + 0.3, y + 1, z + 0.3));
        if (free(bx)) { placed.push(bx); plant(x, y, z); }
      }));

      // ---- paper all over the floor ------------------------------------------
      {
        const COUNT = Math.round(1100 * MAXK);
        const geo = new THREE.PlaneGeometry(0.18, 0.25); geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), mesh = collector();
        const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
        const cols = [0xb8b4a8, 0xaca690, 0xbcb69a, 0x9c988a, 0xb0a8b8].map((c) => new THREE.Color(c));
        const col = new THREE.Color();
        const areas = [];
        storeyList.forEach((fl) => areas.push({ x0: -HALF + 0.3, x1: HALF - 0.3, z0: corrZ0, z1: corrZ1, y: fl === 1 ? 0 : F2, wgt: 2 }));
        cfg.plan.forEach((spec) => { if (spec.room) areas.push({ x0: spec.room.cx - spec.room.w / 2 + 0.3, x1: spec.room.cx + spec.room.w / 2 - 0.3, z0: spec.room.cz - spec.room.d / 2 + 0.3, z1: spec.room.cz + spec.room.d / 2 - 0.3, y: spec.baseY || 0, wgt: 1 }); });
        const total = areas.reduce((a, b) => a + b.wgt, 0);
        for (let i = 0; i < COUNT; i++) {
          let pick = R() * total, ar = areas[0];
          for (const a of areas) { pick -= a.wgt; if (pick <= 0) { ar = a; break; } }
          p.set(ar.x0 + R() * (ar.x1 - ar.x0), ar.y + 0.012 + R() * 0.006, ar.z0 + R() * (ar.z1 - ar.z0));
          e.set((R() - 0.5) * 0.1, R() * 6.3, (R() - 0.5) * 0.1); q.setFromEuler(e);
          m4.compose(p, q, s);
          mesh.setMatrixAt(i, m4);
          col.copy(cols[Math.floor(R() * cols.length)]).multiplyScalar(0.85 + R() * 0.2);
          mesh.setColorAt(i, col);
        }
        emit(world, scene, geo, mat, mesh, "small", [1, 3]);
      }

      // ---- ceiling tubes that match each light: lit, failing, or dead -------
      const tubeOn = basic(0xf2eee0), tubeOff = lam(0x3b3c3a), housing = lam(0x9a9a96);
      (world.fixtures || []).forEach((f) => {
        let mat = f.mode === "off" ? tubeOff : tubeOn;
        if (f.mode === "flicker" && f.light) { mat = new THREE.MeshBasicMaterial({ color: 0xf2eee0 }); f.light.userData.glow = mat; }
        const y = f.baseY + 3.37;
        const spots = f.w > 8 ? [[-f.w * 0.22, -f.d * 0.18], [f.w * 0.22, f.d * 0.18]]
          : Array.from({ length: Math.max(1, Math.round(f.d / 4.5)) }, (_, i) => [0, (i - (Math.max(1, Math.round(f.d / 4.5)) - 1) / 2) * 4.2]);
        const flick = [];   // a failing light's tubes become one mesh: one draw call, one material to dim
        spots.forEach(([dx, dz]) => {
          box(scene, 0.3, 0.05, 1.3, housing, f.x + dx, y + 0.01, f.z + dz);
          [-0.07, 0.07].forEach((ox) => {
            if (f.mode === "flicker") flick.push(new THREE.BoxGeometry(0.05, 0.04, 1.2).translate(f.x + dx + ox, y - 0.03, f.z + dz));
            else box(scene, 0.05, 0.04, 1.2, mat, f.x + dx + ox, y - 0.03, f.z + dz);
          });
          if (f.mode === "off" && R() < 0.5) box(scene, 0.05, 0.04, 0.6, tubeOff, f.x + dx + 0.07, y - 0.35, f.z + dz + 0.3, 0.9, 0, 0);   // one hanging loose
        });
        if (flick.length) { const t = new THREE.Mesh(concatGeos(flick), mat); scene.add(t); world.noMerge.push(t); }
      });

      // ---- dust hanging in the light --------------------------------------------
      {
        const lit = (world.fixtures || []).filter((f) => f.mode !== "off");
        const per = 46, pos = [];
        lit.forEach((f) => {
          for (let i = 0; i < per; i++) pos.push(f.x + (R() - 0.5) * Math.min(3, f.w * 0.5), f.baseY + 0.4 + R() * 2.8, f.z + (R() - 0.5) * Math.min(3.2, f.d * 0.5));
        });
        // and in the shafts through the entry hall's front windows
        for (let i = 0; i < 260; i++) pos.push((R() - 0.5) * 26, 0.5 + R() * 6.5, api.ENTRY.cz + api.ENTRY.d / 2 - 0.5 - R() * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        const cv = document.createElement("canvas"); cv.width = cv.height = 32;
        const c = cv.getContext("2d"), grd = c.createRadialGradient(16, 16, 0, 16, 16, 16);
        grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = grd; c.fillRect(0, 0, 32, 32);
        const pm = new THREE.PointsMaterial({ size: 0.06, map: new THREE.CanvasTexture(cv), color: 0xd8ccb0, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        pm.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = d.uniforms.uTime;
          shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", [
            "vec3 transformed = vec3( position );",
            "transformed.x += sin( uTime * 0.23 + position.z * 3.1 + position.y * 1.7 ) * 0.14;",
            "transformed.z += cos( uTime * 0.19 + position.x * 2.3 + position.y ) * 0.14;",
            "transformed.y += sin( uTime * 0.11 + position.x * 4.0 + position.z * 1.3 ) * 0.22;",
          ].join("\n"));
        };
        pm.customProgramCacheKey = () => "dust-drift";
        const pts = new THREE.Points(g, pm);
        pts.frustumCulled = false;
        pts.count = pos.length / 3;
        scene.add(pts);
        world.dressDetails = world.dressDetails || [];
        world.dressDetails.push({ mesh: pts, max: pts.count, kind: "dust" });
      }
      this.applyQuality(world, api.quality || G.save.settings.graphicsQuality);
    },
  };
})();
