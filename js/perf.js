// ===================================================================
// Performance (category K)
// -------------------------------------------------------------------
// Measured before this file existed, at 960x540 on the "high" setting:
//
//     ~1,900 draw calls a frame, 11-23 point lights live at once,
//     34-41 ms to render a frame  ->  roughly 25-30 FPS on a desktop GPU
//
// Almost all of that was draw calls: every box in the level was its own
// mesh with its own geometry, and a level is well over a thousand boxes.
// Three fixes do most of the work:
//
//   1. Static merge. After a level is built, every mesh that never moves or
//      changes is baked, per material and per spatial cell, into one big
//      geometry. Cells (not one mesh per material for the whole level) keep
//      frustum culling useful.
//
//   2. A fixed light pool. The level's lights become anchors -- positions and
//      colours only -- and a small, CONSTANT number of real PointLights is
//      moved onto whichever anchors are nearest the camera each frame. The
//      constant count matters as much as the small one: three.js bakes the
//      number of lights into every shader, so the old approach of hiding and
//      showing lights recompiled programs whenever the visible count changed,
//      which is exactly the stutter you feel walking between rooms.
//
//   3. Distance culling for zombies past the fog, where they cannot be seen.
//
// Plus pooling for the per-shot effects (hit sparks), which used to allocate
// a fresh geometry and material for every bullet that landed.
// ===================================================================
G.Perf = {
  LIGHT_POOL: { vhigh: 10, high: 8, medium: 6, low: 4, vlow: 3 },

  // ---------------- 0. one palette for every plain colour (round 3) ----------
  // mergeStatic bakes per material per cell, and a level built from a few
  // hundred plain-coloured Lambert materials (a wall colour, a desk colour, a
  // locker colour...) still came out at dozens of draw calls in every cell.
  // Any mesh whose material is just a colour -- opaque, one-sided, no texture,
  // no glow -- is repainted here onto the one palette texture js/schooldress.js
  // keeps (each colour one texel, the mesh's UVs all pointing at it), so the
  // lot merges into the palette's two materials. Nothing that game code
  // recolours or hides (interactables, doors, noMerge) is touched.
  paletteize(scene, world, extraSkip) {
    const P = G.SchoolDress && G.SchoolDress.P;
    if (!P) return 0;
    const skip = new Set();
    const mark = (o) => { if (o && o.traverse) o.traverse((c) => skip.add(c)); };
    (world.interactables || []).forEach((i) => mark(i.mesh));
    (world.roomDoors || []).forEach((d) => mark(d.mesh));
    (world.doors || []).forEach((d) => mark(d.mesh));
    (world.keys || []).forEach((k) => mark(k.mesh));
    (world.noMerge || []).forEach(mark);
    (extraSkip || []).forEach(mark);
    const seenGeo = new Set();
    let n = 0;
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || skip.has(o) || Array.isArray(o.material)) return;
      const m = o.material, g = o.geometry;
      if (!g || !g.index || !g.attributes.position || !m || m.map || m.transparent || m.vertexColors || m.side !== THREE.FrontSide) return;
      if (m === P.PAL.lit || m === P.PAL.unlit) return;
      const lit = m.isMeshLambertMaterial, basic = m.isMeshBasicMaterial;
      if (!lit && !basic) return;
      if (lit && m.emissive && m.emissive.getHex() !== 0) return;
      if (P.PAL.n >= P.PAL.size * P.PAL.size - 1 && P.PAL.idx[m.color.getHex()] == null) return;   // the palette is full
      if (seenGeo.has(g)) o.geometry = g.clone();
      seenGeo.add(o.geometry);
      const paint = lit ? P.lam(m.color.getHex()) : P.basic(m.color.getHex());
      const mesh = P.mk(o.geometry, paint);      // sets the UVs, picks the palette material
      o.material = mesh.material;
      n++;
    });
    return n;
  },

  // ---------------- 1. static geometry merge ----------------
  mergeStatic(scene, world, extraSkip) {
    scene.updateMatrixWorld(true);
    const skip = new Set();
    const mark = (o) => { if (o && o.traverse) o.traverse((c) => skip.add(c)); };
    // Only things that move, hide, change colour or get raycast for "press E"
    // stay separate. The wall-mounted guns themselves are NOT on this list: they
    // never move once mounted, and at ~50 parts each they were the single
    // biggest source of draw calls left. (Their plaque, which is what the
    // interaction raycast hits, stays.)
    (world.interactables || []).forEach((i) => mark(i.mesh));
    (world.roomDoors || []).forEach((d) => mark(d.mesh));
    (world.doors || []).forEach((d) => mark(d.mesh));
    (world.keys || []).forEach((k) => mark(k.mesh));
    (world.crates || []).forEach((c) => mark(c.mesh));
    (world.buttons || []).forEach((b) => mark(b.mesh));
    (world.traps || []).forEach((t) => mark(t.mesh));
    if (world.mysteryBox) mark(world.mysteryBox.mesh);
    if (world.secondFloor) mark(world.secondFloor.barrierMesh);
    if (world.secretZone) mark(world.secretZone.barricadeMesh);
    (world.noMerge || []).forEach(mark);            // animated decor (grass sway, a flag, flickering tubes)
    (extraSkip || []).forEach(mark);

    const CELL = 32;
    const groups = new Map();
    // Textured floors each carry their own CLONE of one shared texture, cloned
    // only to set a different repeat. Keying by the underlying image (not the
    // clone) and baking the repeat into the UVs lets every floor top merge.
    const imgIds = new Map();
    const imgId = (t) => { const k = t.image || t; if (!imgIds.has(k)) imgIds.set(k, imgIds.size + 1); return imgIds.get(k); };
    const matKey = (m) => [m.type, m.color ? m.color.getHex() : 0, m.map ? "img" + imgId(m.map) : "", m.transparent ? 1 : 0, m.opacity, m.side].join("|");
    const candidates = [];
    scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || skip.has(o)) return;
      const g = o.geometry;
      if (!g || !g.index || !g.attributes.position || !g.attributes.normal) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.every((m) => m && (m.isMeshLambertMaterial || m.isMeshBasicMaterial))) return;
      candidates.push(o);
    });
    const tmp = new THREE.Vector3();
    let meshesBefore = 0;
    candidates.forEach((o) => {
      meshesBefore++;
      o.getWorldPosition(tmp);
      // round 3: what can see it (js/zones.js) -- outdoors, the building's
      // shell, or indoors on which storeys -- so it can be left undrawn
      const zone = world.zoneKey ? world.zoneKey(o) : "";
      const cell = [Math.floor(tmp.x / CELL), Math.floor(tmp.z / CELL), tmp.y > 3.9 ? 1 : 0, zone].join("|");
      const g = o.geometry;
      // A multi-material box (floor slab, sign) is split by face group, so its
      // shared side/underside faces merge with everything else and only the
      // genuinely unique face -- a floor's tiled top, a sign's printed face --
      // costs a draw call of its own.
      const parts = Array.isArray(o.material)
        ? (g.groups.length ? g.groups : [{ start: 0, count: g.index.count, materialIndex: 0 }]).map((gr) => ({ mat: o.material[gr.materialIndex], start: gr.start, count: gr.count }))
        : [{ mat: o.material, start: 0, count: g.index.count }];
      parts.forEach((p) => {
        if (!p.mat) return;
        const key = matKey(p.mat) + "|" + cell;
        if (!groups.has(key)) groups.set(key, { material: p.mat, parts: [], verts: 0, idx: 0, zone });
        const grp = groups.get(key);
        grp.parts.push({ mesh: o, start: p.start, count: p.count, map: p.mat.map || null });
        grp.verts += g.attributes.position.count;
        grp.idx += p.count;
      });
    });

    const nm = new THREE.Matrix3(), v = new THREE.Vector3();
    let meshesAfter = 0;
    groups.forEach((grp) => {
      const pos = new Float32Array(grp.verts * 3);
      const nor = new Float32Array(grp.verts * 3);
      const uv = new Float32Array(grp.verts * 2);
      const index = grp.verts > 65535 ? new Uint32Array(grp.idx) : new Uint16Array(grp.idx);
      let vo = 0, io = 0;
      grp.parts.forEach((p) => {
        const o = p.mesh, ga = o.geometry.attributes, mw = o.matrixWorld;
        nm.getNormalMatrix(mw);
        for (let i = 0; i < ga.position.count; i++) {
          v.fromBufferAttribute(ga.position, i).applyMatrix4(mw);
          pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(ga.normal, i).applyMatrix3(nm).normalize();
          nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
          if (ga.uv) {
            const rx = p.map ? p.map.repeat.x : 1, ry = p.map ? p.map.repeat.y : 1;
            uv[(vo + i) * 2] = ga.uv.getX(i) * rx; uv[(vo + i) * 2 + 1] = ga.uv.getY(i) * ry;
          }
        }
        const ix = o.geometry.index;
        for (let i = 0; i < p.count; i++) index[io + i] = ix.getX(p.start + i) + vo;
        vo += ga.position.count; io += p.count;
      });
      const merged = new THREE.BufferGeometry();
      merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      merged.setIndex(new THREE.BufferAttribute(index, 1));
      merged.computeBoundingSphere();
      // repeat now lives in the UVs, so the merged mesh needs a 1x1 copy of
      // the texture rather than the first floor.s own repeat
      let material = grp.material;
      if (material.map && (material.map.repeat.x !== 1 || material.map.repeat.y !== 1)) {
        const tex = material.map.clone();
        tex.repeat.set(1, 1); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
        material = material.clone(); material.map = tex;
      }
      const mesh = new THREE.Mesh(merged, material);
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      mesh.userData.mergedParts = grp.parts.length;
      if (grp.zone) mesh.userData.zone = grp.zone;
      scene.add(mesh);
      meshesAfter++;
    });
    candidates.forEach((o) => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); });
    // Groups emptied by the merge are dead weight in every traversal.
    let emptied = true;
    while (emptied) {
      const empties = [];
      scene.traverse((o) => { if (o.isGroup && o.children.length === 0 && !skip.has(o)) empties.push(o); });
      empties.forEach((o) => o.parent && o.parent.remove(o));
      emptied = empties.length > 0;
    }
    // Everything left that never moves can skip its per-frame matrix update.
    scene.children.forEach((o) => {
      if (skip.has(o) || o.isLight || o === G.Game.yawObject) return;
      if (o.isMesh || o.isGroup) { o.updateMatrix(); o.matrixAutoUpdate = false; }
    });
    return { meshesBefore, meshesAfter };
  },

  // Same idea at the scale of one object: bake a model's parts together in
  // the model's own space, one mesh per material. Used on weapon models,
  // which average fifty parts -- the one in your hands is drawn every frame.
  mergeLocal(root, keepSubtrees) {
    const keep = new Set();
    (keepSubtrees || []).forEach((o) => o && o.traverse((c) => keep.add(c)));
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map();
    const parts = [];
    root.traverse((o) => {
      if (!o.isMesh || keep.has(o) || Array.isArray(o.material)) return;
      const g = o.geometry;
      if (!g || !g.index || !g.attributes.normal) return;
      const m = o.material;
      const key = [m.type, m.color ? m.color.getHex() : 0, m.transparent ? 1 : 0, m.opacity].join("|");
      if (!groups.has(key)) groups.set(key, { material: m, meshes: [], verts: 0, idx: 0 });
      const grp = groups.get(key);
      grp.meshes.push(o); grp.verts += g.attributes.position.count; grp.idx += g.index.count;
      parts.push(o);
    });
    const rel = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    groups.forEach((grp) => {
      const pos = new Float32Array(grp.verts * 3), nor = new Float32Array(grp.verts * 3);
      const index = new Uint16Array(grp.idx);
      let vo = 0, io = 0;
      grp.meshes.forEach((o) => {
        rel.multiplyMatrices(inv, o.matrixWorld);
        nm.getNormalMatrix(rel);
        const ga = o.geometry.attributes;
        for (let i = 0; i < ga.position.count; i++) {
          v.fromBufferAttribute(ga.position, i).applyMatrix4(rel);
          pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(ga.normal, i).applyMatrix3(nm).normalize();
          nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
        }
        const ix = o.geometry.index;
        for (let i = 0; i < ix.count; i++) index[io + i] = ix.getX(i) + vo;
        vo += ga.position.count; io += ix.count;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      geo.setIndex(new THREE.BufferAttribute(index, 1));
      geo.computeBoundingSphere();
      root.add(new THREE.Mesh(geo, grp.material));
    });
    parts.forEach((o) => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); });
    return root;
  },

  // The same again, but every part's colour goes into its vertices, so one
  // group becomes at most TWO meshes -- lit (Lambert) and unlit (Basic: eyes,
  // wounds) -- on materials shared by every zombie. Round 2 dressed the
  // zombies (skin, shirt, trousers, shoes, socks, hats...) and each colour
  // was another draw call per joint: about 25 a zombie. This makes it ~14.
  // Each merged mesh keeps where its pieces were and what colour they were
  // (userData.parts), which is what a zombie bursting into blocks samples.
  mergeLocalColored(root, keepSubtrees, shared) {
    const keep = new Set();
    (keepSubtrees || []).forEach((o) => o && o.traverse((c) => keep.add(c)));
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = { lambert: { meshes: [], verts: 0, idx: 0 }, basic: { meshes: [], verts: 0, idx: 0 } };
    const sources = [];
    root.traverse((o) => {
      if (!o.isMesh || keep.has(o) || Array.isArray(o.material) || !o.material.color) return;
      const g = o.geometry;
      if (!g || !g.index || !g.attributes.normal) return;
      const b = buckets[o.material.isMeshBasicMaterial ? "basic" : "lambert"];
      b.meshes.push(o); b.verts += g.attributes.position.count; b.idx += g.index.count;
      sources.push(o);
    });
    const rel = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    Object.keys(buckets).forEach((kind) => {
      const B = buckets[kind];
      if (!B.meshes.length) return;
      const pos = new Float32Array(B.verts * 3), nor = new Float32Array(B.verts * 3), col = new Float32Array(B.verts * 3);
      const index = new Uint16Array(B.idx);
      const parts = [];
      let vo = 0, io = 0;
      B.meshes.forEach((o) => {
        rel.multiplyMatrices(inv, o.matrixWorld);
        nm.getNormalMatrix(rel);
        const ga = o.geometry.attributes, c = o.material.color;
        const box = new THREE.Box3();
        for (let i = 0; i < ga.position.count; i++) {
          v.fromBufferAttribute(ga.position, i).applyMatrix4(rel);
          box.expandByPoint(v);
          pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(ga.normal, i).applyMatrix3(nm).normalize();
          nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
          col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b;
        }
        parts.push({ box, color: c.clone() });
        const ix = o.geometry.index;
        for (let i = 0; i < ix.count; i++) index[io + i] = ix.getX(i) + vo;
        vo += ga.position.count; io += ix.count;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(index, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, shared[kind]);
      mesh.userData.parts = parts;
      root.add(mesh);
    });
    sources.forEach((o) => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); o.material.dispose(); });
    return root;
  },

  // ---------------- 2. fixed light pool ----------------
  initLightPool(scene, world, quality) {
    this.disposeLightPool(scene);
    const n = this.LIGHT_POOL[quality] || 6;
    // Lights parented to props (and any strays) join the anchors too, so
    // nothing outside the pool can change the scene's light count.
    const anchors = [];
    (world.lights || []).forEach((l) => {
      l.updateMatrixWorld(true);
      const p = new THREE.Vector3(); l.getWorldPosition(p);
      anchors.push({ pos: p, color: l.color.clone(), base: l.userData.base != null ? l.userData.base : l.intensity,
        distance: l.distance || 13, phase: l.userData.phase || Math.random() * 10, speed: l.userData.speed || 1.4, intensity: 0,
        mode: l.userData.mode || null, glow: l.userData.glow || null, glowBase: l.userData.glow ? l.userData.glow.color.clone() : null });
      if (l.parent) l.parent.remove(l);
    });
    this.anchors = anchors;
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 13);
      scene.add(pl);
      this.pool.push(pl);
    }
    // one extra slot, always present, for muzzle flashes and bursts
    this.flashLight = new THREE.PointLight(0xffdd66, 0, 5);
    scene.add(this.flashLight);
    this._flashUntil = 0;
    world.lights = [];                                    // the old per-light flicker path is retired
  },
  // Graphics quality changed mid-run: rebuild the pool at the new size from
  // the anchors already collected.
  resizePool(scene, quality) {
    if (!this.anchors) return;
    const n = this.LIGHT_POOL[quality] || 6;
    (this.pool || []).forEach((l) => l.parent && l.parent.remove(l));
    this.pool = [];
    for (let i = 0; i < n; i++) { const pl = new THREE.PointLight(0xffffff, 0, 13); scene.add(pl); this.pool.push(pl); }
  },
  disposeLightPool(scene) {
    (this.pool || []).forEach((l) => l.parent && l.parent.remove(l));
    if (this.flashLight && this.flashLight.parent) this.flashLight.parent.remove(this.flashLight);
    this.pool = []; this.anchors = []; this.flashLight = null;
  },
  updateLights(camPos, camDir, tSec) {
    if (!this.pool || !this.pool.length) return;
    const A = this.anchors;
    // flicker + a score: nearest first, with a bonus for being in front of
    // the camera so the lights you can see win over the ones behind you
    for (const a of A) {
      let mult = 0.88 + 0.12 * Math.sin(tSec * a.speed + a.phase);
      if (Math.sin(tSec * 1.7 + a.phase * 3) > 0.985) mult *= 0.35;
      // a failing tube (pass D3): stutters, dips and now and then dies for a
      // moment -- its fixture on the ceiling goes with it
      if (a.mode === "flicker") {
        const f = Math.sin(tSec * 13.1 + a.phase) + Math.sin(tSec * 29.7 + a.phase * 1.7) + 1.4 * Math.sin(tSec * 3.3 + a.phase * 0.5);
        mult = f > 0.3 ? 1 : f > -0.8 ? 0.3 : 0.04;
      }
      if (a.glow) a.glow.color.copy(a.glowBase).multiplyScalar(Math.min(1, 0.15 + 0.85 * mult));
      a.intensity = a.base * mult;
      const dx = a.pos.x - camPos.x, dy = (a.pos.y - camPos.y) * 1.6, dz = a.pos.z - camPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const facing = camDir ? (dx * camDir.x + dz * camDir.z) / (d || 1) : 0;
      a.score = d - facing * 6;
    }
    // partial selection of the best N -- cheaper than sorting all fifty
    const n = this.pool.length;
    const best = [];
    for (const a of A) {
      if (best.length < n) { best.push(a); if (best.length === n) best.sort((p, q) => p.score - q.score); continue; }
      if (a.score < best[n - 1].score) {
        best[n - 1] = a;
        for (let i = n - 1; i > 0 && best[i].score < best[i - 1].score; i--) { const t = best[i]; best[i] = best[i - 1]; best[i - 1] = t; }
      }
    }
    for (let i = 0; i < n; i++) {
      const l = this.pool[i], a = best[i];
      if (!a) { l.intensity = 0; continue; }
      l.position.copy(a.pos); l.color.copy(a.color); l.distance = a.distance; l.intensity = a.intensity;
    }
    if (this.flashLight && performance.now() > this._flashUntil) this.flashLight.intensity = 0;
  },
  flash(pos, color, intensity, distance, ms) {
    const f = this.flashLight;
    if (!f) return;
    f.position.copy(pos); f.color.setHex(color); f.intensity = intensity; f.distance = distance;
    this._flashUntil = performance.now() + (ms || 50);
  },

  // ---------------- 3. zombie distance culling ----------------
  // Past the fog's far plane a zombie is fully fogged out; drawing its ten
  // boxes costs ten draw calls for nothing.
  cullZombies(game) {
    const far = (game.scene && game.scene.fog ? game.scene.fog.far : 40) + 4;
    const p = game.yawObject.position;
    for (const z of game.zombies) {
      if (!z.mesh) continue;
      const dx = z.mesh.position.x - p.x, dz = z.mesh.position.z - p.z;
      z.mesh.visible = dx * dx + dz * dz < far * far || z.type === "boss";
    }
  },

  // ---------------- 4. pooled hit sparks ----------------
  _sparkPool: [],
  sparks(scene, position, color, count) {
    let s = this._sparkPool.find((p) => !p.busy && p.count >= count);
    if (!s) {
      if (this._sparkPool.length >= 24) return;           // hard cap; a missing spark is invisible in a firefight
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(count, 18) * 3), 3));
      const mat = new THREE.PointsMaterial({ color, size: 0.08, transparent: true });
      s = { pts: new THREE.Points(geo, mat), geo, mat, count: Math.max(count, 18), vel: [], busy: false, life: 0 };
      for (let i = 0; i < s.count; i++) s.vel.push(new THREE.Vector3());
      this._sparkPool.push(s);
    }
    s.busy = true; s.life = 0; s.used = count;
    s.mat.color.setHex(color); s.mat.opacity = 1;
    const arr = s.geo.attributes.position.array;
    for (let i = 0; i < s.count; i++) {
      const hide = i >= count;
      arr[i * 3] = hide ? 0 : position.x; arr[i * 3 + 1] = hide ? -999 : position.y; arr[i * 3 + 2] = hide ? 0 : position.z;
      s.vel[i].set((G.rng() - 0.5) * 3, G.rng() * 3, (G.rng() - 0.5) * 3);
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.computeBoundingSphere();
    if (s.pts.parent !== scene) scene.add(s.pts);
    s.pts.visible = true;
  },
  updateSparks(dt) {
    for (const s of this._sparkPool) {
      if (!s.busy) continue;
      s.life += dt;
      const arr = s.geo.attributes.position.array;
      for (let i = 0; i < s.used; i++) {
        s.vel[i].y -= 9 * dt;
        arr[i * 3] += s.vel[i].x * dt * 1.2; arr[i * 3 + 1] += s.vel[i].y * dt * 1.2; arr[i * 3 + 2] += s.vel[i].z * dt * 1.2;
      }
      s.geo.attributes.position.needsUpdate = true;
      s.mat.opacity = Math.max(0, 1 - s.life * 1.5);
      if (s.life > 0.7) { s.busy = false; s.pts.visible = false; }
    }
  },
  resetPools() {
    this._sparkPool.forEach((s) => { if (s.pts.parent) s.pts.parent.remove(s.pts); s.geo.dispose(); s.mat.dispose(); });
    this._sparkPool = [];
  },

  // ---------------- counters ----------------
  stats(renderer) {
    const r = renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  },
};
