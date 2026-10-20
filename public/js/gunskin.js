// ===================================================================
// The guns' surfaces (overhaul, round 2)
// -------------------------------------------------------------------
// Every gun is still built of boxes in its own colours (G.buildWeaponModel,
// js/entities.js). This dresses them:
//
//   five surfaces    matte (blued) metal, worn metal, bare steel, painted
//                    polymer, a stippled rubber grip -- each a 16 px tile of
//                    a small pixel texture drawn here at load (no files), with
//                    its own roughness and metalness (and scratches, dust and
//                    worn edges that catch the light differently from the rest)
//   the gun's colours stay: the tiles are grey, multiplied by each part's own
//                    colour (vertex colours) -- the paint, the accents and the
//                    rarity colours read as before, only now on a material
//   fake shadows     vertex AO: darker where parts meet, and where the hands
//                    hold it (the viewmodel pass draws no real shadows)
//   fewer draw calls the whole gun becomes ONE mesh on one material (plus one
//                    for its glowing bits), and each moving part one more --
//                    a pistol is 3 draw calls where it was about 9
//
// A texel is ~6 mm on a part, whatever its size (G.CONFIG.fx.gunSkin.texel);
// a small part shows a small piece of its tile, so nothing shimmers.
//   G.GunSkin.apply(group)         after the boxes are built (buildWeaponMesh)
//   G.GunSkin.forViewmodel(root)   the gun in the hands: the viewmodel's rim,
//                                  least light and the night sky's reflection
// ===================================================================
window.G = window.G || {};

G.GunSkin = (function () {
  const TILE = 16, N = 8;                                     // 8 tiles of 16 px in a row
  const SURF = { matte: 0, worn: 1, bare: 2, polymer: 3, grip: 4 };
  let map = null, orm = null, worldMat = null, vmMat = null, glowMat = null;

  // ---------------- the tiles ----------------
  function seeded(s) { return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
  function draw() {
    const C = G.CONFIG.fx.gunSkin;
    const a = document.createElement("canvas"), o = document.createElement("canvas");
    a.width = o.width = TILE * N; a.height = o.height = TILE;
    const ac = a.getContext("2d"), oc = o.getContext("2d");
    const A = ac.createImageData(a.width, a.height), O = oc.createImageData(o.width, o.height);
    const put = (tile, x, y, lum, rough, metal) => {
      const i = (y * a.width + tile * TILE + x) * 4;
      const l = Math.max(0, Math.min(255, Math.round(lum * 200)));
      A.data[i] = l; A.data[i + 1] = l; A.data[i + 2] = l; A.data[i + 3] = 255;
      O.data[i] = 255; O.data[i + 1] = Math.round(Math.max(0.04, Math.min(1, rough)) * 255); O.data[i + 2] = Math.round(Math.max(0, Math.min(1, metal)) * 255); O.data[i + 3] = 255;
    };
    Object.keys(SURF).forEach((name) => {
      const t = SURF[name], k = C.surfaces[name], rnd = seeded(7919 * (t + 3));
      // scratches: a few short diagonal or straight runs of lighter, smoother pixels
      const scratch = new Set();
      for (let s = 0; s < k.scratches; s++) {
        let x = Math.floor(rnd() * TILE), y = Math.floor(rnd() * TILE);
        const dx = rnd() < 0.5 ? 1 : 0, dy = dx ? (rnd() < 0.5 ? 1 : -1) : 1, len = 3 + Math.floor(rnd() * 5);
        for (let i = 0; i < len; i++) { scratch.add(((x + 16) % 16) + "," + ((y + 16) % 16)); x += dx; y += dy; }
      }
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
        let lum = k.lum + (rnd() - 0.5) * k.noise, rough = k.rough, metal = k.metal;
        if (name === "grip" && (x + y) % 3 === 0) { lum -= 0.16; rough = Math.min(1, rough + 0.05); }     // stipple
        if (name === "grip" && y % 4 === 0) lum -= 0.06;                                                 // ridges
        if (scratch.has(x + "," + y)) { lum += k.scratchLum; rough = k.scratchRough; metal = Math.max(metal, k.scratchMetal); }
        // dust settles toward the bottom of a part
        if (y >= TILE - 3 && rnd() < k.dust) { lum -= 0.07; rough = Math.min(1, rough + 0.2); metal *= 0.5; }
        // worn edges: lighter, and where paint wore through, the metal shows
        if (edge && rnd() < k.wear) { lum += k.edgeLum; rough = k.edgeRough; metal = Math.max(metal, k.edgeMetal); }
        put(t, x, y, lum, rough, metal);
      }
    });
    ac.putImageData(A, 0, 0); oc.putImageData(O, 0, 0);
    const tex = (c) => { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
    map = tex(a); orm = tex(o);
  }
  function materials() {
    if (worldMat) return;
    draw();
    const mk = () => new THREE.MeshStandardMaterial({ vertexColors: true, map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1 });
    worldMat = mk();
    worldMat.userData.shared = true; worldMat.userData.vzEnv = true; worldMat.userData.gunSkin = "world";
    vmMat = mk();
    vmMat.userData.shared = true; vmMat.userData.vzEnv = true; vmMat.userData.gunSkin = "vm";
    glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    glowMat.userData.shared = true; glowMat.userData.gunSkin = "glow";
  }
  // the viewmodel's light, as js/visuals.js gives the converted materials
  function vmLook() {
    const VM = G.VISUAL && G.VISUAL.viewmodel;
    if (VM && !vmMat.userData.vzRim) {
      vmMat.userData.vzRim = { color: new THREE.Color(VM.rim).multiplyScalar(VM.rimStrength), power: VM.rimPower };
      vmMat.userData.vzMinLight = new THREE.Color(VM.minLight);
      vmMat.needsUpdate = true;
    }
    const env = G.Visuals && G.Visuals._env;
    [vmMat, worldMat].forEach((m) => { if (m.envMap !== (env || null)) { m.envMap = env || null; m.needsUpdate = true; } });
  }

  // which surface a part's box gets, from the colour role it was built with
  function surfaceOf(m) {
    if (m.userData && m.userData.skin) return m.userData.skin;
    const c = m.color || new THREE.Color(0.5, 0.5, 0.5), hsl = {};
    c.getHSL(hsl);
    return hsl.s > 0.25 && hsl.l > 0.12 ? "polymer" : hsl.l < 0.2 ? "matte" : "worn";
  }

  // ---------------- dressing a built gun ----------------
  function apply(g) {
    materials();
    const C = G.CONFIG.fx.gunSkin, T = C.texel * TILE;
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const keep = new Set();
    if (g.userData.rainbowTrim) g.userData.rainbowTrim.traverse((o) => keep.add(o));
    // every box, in gun coordinates, for the vertex AO
    const boxes = [];
    g.traverse((o) => {
      if (!o.isMesh || keep.has(o) || !o.geometry || o.geometry.type !== "BoxGeometry") return;
      boxes.push({ o, b: new THREE.Box3().setFromObject(o).applyMatrix4(inv).expandByScalar(C.aoReach) });
    });
    const An = g.userData.anchors || {};
    const hands = [An.grip, An.fore].filter(Boolean);
    // the owner of each box: the moving part it rides in, or the gun itself
    const parts = Object.values(g.userData.parts || {});
    const ownerOf = (o) => { let p = o.parent; while (p && p !== g) { if (parts.includes(p)) return p; p = p.parent; } return g; };
    const groups = new Map();       // owner -> { lit: [], glow: [] }
    boxes.forEach((bx) => {
      const ow = ownerOf(bx.o);
      if (!groups.has(ow)) groups.set(ow, { lit: [], glow: [] });
      groups.get(ow)[bx.o.material.isMeshBasicMaterial ? "glow" : "lit"].push(bx);
    });
    const rel = new THREE.Matrix4(), toGun = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), w = new THREE.Vector3();
    const col = new THREE.Color();
    groups.forEach((G2, owner) => {
      const ownerInv = new THREE.Matrix4().copy(owner.matrixWorld).invert();
      [["lit", G2.lit], ["glow", G2.glow]].forEach(([kind, list]) => {
        if (!list.length) return;
        let verts = 0, idx = 0;
        list.forEach((bx) => { verts += bx.o.geometry.attributes.position.count; idx += bx.o.geometry.index.count; });
        const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), cl = new Float32Array(verts * 3);
        const index = verts > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
        let vo = 0, io = 0;
        list.forEach((bx) => {
          const o = bx.o, ga = o.geometry.attributes, p = o.geometry.parameters;
          rel.multiplyMatrices(ownerInv, o.matrixWorld);
          toGun.multiplyMatrices(inv, o.matrixWorld);
          nm.getNormalMatrix(rel);
          const surf = SURF[surfaceOf(o.material)] || 0;
          col.copy(o.material.color || col.setRGB(1, 1, 1));
          // the face sizes, in the box's own order: +x -x +y -y +z -z
          const dims = [[p.depth, p.height], [p.depth, p.height], [p.width, p.depth], [p.width, p.depth], [p.width, p.height], [p.width, p.height]];
          for (let i = 0; i < ga.position.count; i++) {
            v.fromBufferAttribute(ga.position, i);
            w.copy(v).applyMatrix4(toGun);
            v.applyMatrix4(rel);
            pos.set([v.x, v.y, v.z], (vo + i) * 3);
            v.fromBufferAttribute(ga.normal, i).applyMatrix3(nm).normalize();
            nor.set([v.x, v.y, v.z], (vo + i) * 3);
            // the tile, a piece of it as big as the face (centred, so a big face reaches its worn edges)
            const face = Math.floor(i / 4), d = dims[face] || [T, T];
            const eu = Math.min(1, d[0] / T), ev = Math.min(1, d[1] / T);
            const u0 = ga.uv.getX(i), v0 = ga.uv.getY(i);
            const uu = 0.5 + (u0 - 0.5) * eu, vv = 0.5 + (v0 - 0.5) * ev;
            uv[(vo + i) * 2] = (surf * TILE + 0.5 + uu * (TILE - 1)) / (TILE * N);
            uv[(vo + i) * 2 + 1] = (0.5 + vv * (TILE - 1)) / TILE;
            // vertex AO: darker inside other parts' reach, and under the hands
            let ao = 1;
            if (kind === "lit") {
              let n = 0;
              for (const ob of boxes) if (ob !== bx && ob.b.containsPoint(w)) n++;
              ao = Math.max(C.aoMin, 1 - C.aoStep * n);
              for (const h of hands) if (w.distanceTo(h) < C.handReach) ao *= C.handShade;
            }
            cl.set([col.r * ao, col.g * ao, col.b * ao], (vo + i) * 3);
          }
          const ix = o.geometry.index;
          for (let i = 0; i < ix.count; i++) index[io + i] = ix.getX(i) + vo;
          vo += ga.position.count; io += ix.count;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        geo.setAttribute("color", new THREE.BufferAttribute(cl, 3));
        geo.setIndex(new THREE.BufferAttribute(index, 1));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, kind === "glow" ? glowMat : worldMat);
        mesh.userData.gunSkin = kind;
        owner.add(mesh);
      });
    });
    boxes.forEach((bx) => { if (bx.o.parent) bx.o.parent.remove(bx.o); bx.o.geometry.dispose(); });
    g.userData.skinned = true;
    return g;
  }

  // the gun in the hands: the viewmodel's own material (its rim, its least light)
  function forViewmodel(root) {
    if (!worldMat) return;
    vmLook();
    root.traverse((o) => { if (o.isMesh && o.material === worldMat) o.material = vmMat; });
  }

  return {
    SURF,
    apply, forViewmodel,
    // (the tests, the debug overlay)
    textures() { materials(); return { map, orm }; },
    materials() { materials(); return { world: worldMat, vm: vmMat, glow: glowMat }; },
  };
})();
