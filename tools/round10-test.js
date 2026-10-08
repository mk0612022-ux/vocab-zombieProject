// Dev-only (not shipped). Newer list, round 3: the looks. Real glass in the
// rooms' windows (it breaks under fire, by blasts and when a zombie climbs
// in; rounds go through the openings, people do not), the thicker grass
// (thin blades, thinning with distance and quality, gusts, bare patches,
// flowers), the zombies' fingers, scars and odd ones (the one that carries
// its own head is shot in the head where its head is), and the wear on the
// walls (marks in their quality tiers, clear of doors, windows and the dado
// rail; wrecked classrooms whose aisles stay open; hanging locker doors,
// cables, fallen lights, askew signs, chalk on the boards).
// The save is put back afterwards.
//   const r = await G.Round10Test.run();   r.fail -> []
window.G = window.G || {};
G.Round10Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const DT = 1 / 60;
  let g;
  const up = (n) => { for (let i = 0; i < (n || 1); i++) g._upd.call(g, DT); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function fresh(quality) {
    g = G.Game;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = quality || "high";
    G.save.settings.gameSpeed = 1;
    g._upd = g._upd || g.update;
    g.update = g._upd;
    g.startLevel(1);
    g.applyGraphicsQuality();
    g.update = function () {};
    g.clearZombies();
    G.Input.mode = "desktop";
    g.player.hp = g.player.maxHp = 1e6;
    return g;
  }
  // a zombie of `type` with the odd look `odd` (or none)
  function oddZombie(type, odd, at) {
    const C = G.CONFIG.zombieLooks, saved = JSON.stringify(C);
    C.oddChance = odd ? 1 : 0; C.odd = { deformed: 0, headInHand: 0, longArm: 0, bigArm: 0 }; if (odd) C.odd[odd] = 1;
    const z = g.spawnZombieAt(type, at, null);
    Object.assign(C, JSON.parse(saved));
    if (z) { z.emerge = null; z.speed = 0; z.mesh.rotation.y = 0; }
    return z;
  }

  // ---- H: glass ----------------------------------------------------------
  function glass() {
    fresh("high");
    const W = g.world, Gl = G.Glass;
    ok("H: the rooms have real windows", (W.realWindows || []).length >= 30, (W.realWindows || []).length);
    ok("H: a pane in every real window", Gl.panes.length === W.realWindows.length, Gl.panes.length);
    const states = {}; Gl.panes.forEach((p) => { states[p.state] = (states[p.state] || 0) + 1; });
    ok("H: most clean, some cracked, a few already holed", states.clean > states.cracked && states.cracked > 0 && states.broken > 0, JSON.stringify(states));
    // each pane shows in exactly one of the three meshes
    const m4 = new THREE.Matrix4(), s = new THREE.Vector3();
    const shown = Gl.panes.every((p) => Gl.STATES.filter((st) => { Gl.meshes[st].getMatrixAt(p.i, m4); s.setFromMatrixScale(m4); return s.x > 0.01; }).length === 1 && (Gl.meshes[p.state].getMatrixAt(p.i, m4), s.setFromMatrixScale(m4).x > 0.5));
    ok("H: each pane drawn once, in its state's mesh", shown);
    const mat = Gl.meshes.clean.material;
    ok("H: the glass is see-through and writes no depth", mat.transparent && !mat.depthWrite && mat.side === THREE.DoubleSide);
    ok("H: drawn after the solid things", Gl.meshes.clean.renderOrder > 0);
    // (visual series: per-pixel Standard reflecting js/visuals.js's night-sky environment map)
    ok("H: High: reflective (lit, with the night sky in it)", (G.VISUAL ? mat.isMeshStandardMaterial : mat.isMeshPhongMaterial) && !!mat.envMap, mat.type);
    G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality();
    ok("H: Low: a plain flat material", Gl.meshes.clean.material.isMeshBasicMaterial, Gl.meshes.clean.material.type);
    G.save.settings.graphicsQuality = "medium"; g.applyGraphicsQuality();
    // (visual series: from Medium up the glass reflects the sky too)
    ok(G.VISUAL ? "H: Medium: lit and reflective (Standard)" : "H: Medium: lit, no reflections", G.VISUAL ? Gl.meshes.clean.material.isMeshStandardMaterial : Gl.meshes.clean.material.isMeshLambertMaterial, Gl.meshes.clean.material.type);
    G.save.settings.graphicsQuality = "high"; g.applyGraphicsQuality();

    // the opening: rounds through, people not
    const p = Gl.panes.find((q) => q.base < 1 && q.win.win);
    const inX = p.x - p.s * 3.2;                               // three metres into the room
    const blocker = W.colliders.find((c) => c.passShots && c.containsPoint(V(p.x, p.y, p.z)));
    ok("H: an opening has a block that stops walking", !!blocker);
    const out = V(p.s, 0, 0);
    ok("H: a round through the opening goes on outside", g.wallDistance(V(inX, p.y, p.z), out, 60) > 5, g.wallDistance(V(inX, p.y, p.z), out, 60).toFixed(1));
    ok("H: ...but the wall beside it still stops one", g.wallDistance(V(inX, p.y, p.z + p.w / 2 + 0.5), out, 60) < 3.5);
    g.yawObject.position.set(inX, p.base + 1.7, p.z); g._prevPos = null;
    for (let i = 0; i < 120; i++) g.tryMove(p.s * 0.08, 0);
    ok("H: nobody walks out through a window", Math.abs(g.yawObject.position.x) < Math.abs(p.x) - 0.2, g.yawObject.position.x.toFixed(2));
    // a shot through a clean pane: it breaks, and the zombie beyond is hit
    p.state = "clean"; Gl.place(p);
    const z = g.spawnZombieAt("normal", V(p.x + p.s * 3, p.base, p.z), null);
    z.emerge = null; z.speed = 0; z.hp = 1e6; g.scene.updateMatrixWorld(true);
    const hp0 = z.hp;
    const from = V(inX, p.base + 1.5, p.z), dir = z.mesh.position.clone().setY(p.base + 1.3).sub(from).normalize();
    g.raycastShoot(from, dir, 10, false, null);
    ok("H: a shot breaks the pane it passes through", p.state === "broken");
    ok("H: ...and goes on into the zombie behind it", z.hp < hp0);
    for (let i = 0; i < 5; i++) Gl.update(DT);
    ok("H: shards fly", Gl.shards.mesh.count > 0, Gl.shards.mesh.count);
    for (let i = 0; i < 400; i++) Gl.update(DT);
    ok("H: ...and are gone a few seconds later", Gl.shards.mesh.count === 0, Gl.shards.mesh.count);
    // a round that stops in a zombie before the glass leaves the glass alone
    const p2 = Gl.panes.find((q) => q !== p && q.base < 1 && Math.abs(q.z - p.z) > 3 && q.state !== "broken");
    if (p2) {
      const f2 = V(p2.x - p2.s * 4, p2.base + 1.3, p2.z);
      const z2 = g.spawnZombieAt("normal", V(p2.x - p2.s * 2, p2.base, p2.z), null);
      z2.emerge = null; z2.speed = 0; z2.hp = 1e6; g.scene.updateMatrixWorld(true);
      const was = p2.state;
      g.raycastShoot(f2, V(p2.s, 0, 0), 10, false, null);
      ok("H: a round stopped by a zombie does not break the glass behind it", p2.state === was, p2.state);
      // a blast by it does
      g.splashDamage(V(p2.x - p2.s * 1.2, p2.y, p2.z), { splashRadius: 3.5 }, 10, false);
      ok("H: a blast breaks the panes near it", p2.state === "broken");
    }
    // a zombie climbing in breaks its window's pane, once
    const p3 = Gl.panes.find((q) => q.state !== "broken");
    ok("H: a zombie coming in breaks the pane", Gl.breakWindow(p3.win.win, V(-p3.s, 0, 0), true) === true && p3.state === "broken");
    ok("H: ...and there is nothing left to break the next time", Gl.breakWindow(p3.win.win, V(-p3.s, 0, 0), true) === false);
    // the zones: a windowed room sees the grounds; the dark rooms only from outside
    g.clearZombies();
    const room = W.windowRooms[0], reg = W.regions.find((r) => r.name === room);
    g.yawObject.position.set((reg.minX + reg.maxX) / 2, (reg.y || 0) + 1.7, (reg.minZ + reg.maxZ) / 2);
    G.Zones.update(g, true);
    const its = G.Zones.items;
    ok("H: from a room with windows the grounds are drawn", its.some((it) => it.cls === "O" && it.meshes[0].layers.mask === 1));
    ok("H: ...and the dark rooms behind the windows are not", its.filter((it) => it.cls === "Y").every((it) => it.meshes[0].layers.mask === 0));
    g.yawObject.position.set(-30, 1.7, 0); G.Zones.update(g, true);
    ok("H: from outside the dark rooms are drawn", its.filter((it) => it.cls === "Y").some((it) => it.meshes[0].layers.mask === 1));
    ok("H: the moon still shines in through the windows", G.Sky.windows && G.Sky.windows().length > 0);
  }

  // ---- I1: grass -----------------------------------------------------------
  function grass() {
    fresh("high");
    const W = g.world, D = W.dressDetails, P = G.SchoolDress.P;
    const chunks = D.filter((d) => d.kind === "grass" && d.far);
    const max = chunks.reduce((s, d) => s + d.max, 0);
    ok("I1: the field holds about twice the tufts it did (35k)", max > 60000, max);
    const geo = chunks[0].mesh.geometry, farG = chunks[0].far.geometry;
    ok("I1: a near tuft has eight blades", geo.attributes.position.count === 40, geo.attributes.position.count);
    ok("I1: a far one has four", farG.attributes.position.count === 20, farG.attributes.position.count);
    // the blades are thin and come to a point
    const pos = geo.attributes.position, NB = pos.count / 5;
    let widest = 0, pointed = true;
    for (let b = 0; b < NB; b++) {
      const a = V().fromBufferAttribute(pos, b * 5), c = V().fromBufferAttribute(pos, b * 5 + 1);
      widest = Math.max(widest, a.distanceTo(c));
      if (pos.getY(b * 5 + 4) <= pos.getY(b * 5 + 2)) pointed = false;
    }
    ok("I1: thin blades (under 5 cm at the root)", widest < 0.05, widest.toFixed(3));
    ok("I1: each blade ends in a single point, above its bend", pointed);
    const hs = new Set(); for (let b = 0; b < NB; b++) hs.add(pos.getY(b * 5 + 4).toFixed(2));
    ok("I1: the blades are all different heights", hs.size >= NB - 2, hs.size);
    const col = geo.attributes.color;
    const tints = new Set(); for (let b = 0; b < NB; b++) tints.add((col.getX(b * 5 + 4) / col.getZ(b * 5 + 4)).toFixed(2));
    ok("I1: ...and different tints", tints.size >= 3, tints.size);
    // thinning with distance
    const at = V(0, 0, 44);
    G.SchoolDress.thin(W, at, true);
    const dist = (d) => { const b = d.mesh.geometry.boundingBox; return Math.hypot(Math.max(b.min.x - at.x, 0, at.x - b.max.x), Math.max(b.min.z - at.z, 0, at.z - b.max.z)); };
    const near = chunks.filter((d) => dist(d) < 4), far = chunks.filter((d) => dist(d) > 50);
    // (of what the quality draws)
    const frac = (d) => (d.mesh.count || 0) / (d.max * d.qk / P.MAXK);
    ok("I1: all of it close by", near.length && near.every((d) => frac(d) > 0.95 && d.mesh.visible && !d.far.visible), near.map(frac).join(","));
    ok("I1: a fifth or less far off, in its cheaper tufts", far.length && far.every((d) => frac(d) <= 0.21 && d.far.visible && !d.mesh.visible), far.slice(0, 4).map(frac).join(","));
    ok("I1: nothing drawn twice", chunks.every((d) => !(d.mesh.visible && d.far.visible)));
    const hi = near.reduce((s, d) => s + d.mesh.count, 0);
    G.save.settings.graphicsQuality = "vlow"; g.applyGraphicsQuality();
    const lo = near.reduce((s, d) => s + d.mesh.count, 0);
    ok("I1: and with the quality (Very Low about a sixth of High)", lo > 0 && lo < hi * 0.2, lo + " / " + hi);
    G.save.settings.graphicsQuality = "high"; g.applyGraphicsQuality();
    // gusts in the shader, the trampling kept
    const fake = { uniforms: {}, vertexShader: "#include <color_vertex>\n#include <project_vertex>" };
    chunks[0].mesh.material.onBeforeCompile(fake);
    ok("I1: gusts run across the grass (a wave along the wind)", /wave/.test(fake.vertexShader) && /uTime/.test(fake.vertexShader));
    ok("I1: it still gives way underfoot", /uBend/.test(fake.vertexShader) && !!W.dress.uniforms.uBend);
    ok("I1: bare earth patches", D.filter((d) => d.kind === "patch").reduce((s, d) => s + d.max, 0) >= 20);
    const fl = D.filter((d) => d.kind === "flowers");
    ok("I1: weeds in flower, thinning with distance too", fl.length > 0 && fl.every((d) => d.thin), fl.length);
    const ff = { uniforms: {}, vertexShader: "#include <color_vertex>\n#include <project_vertex>" };
    fl[0].mesh.material.onBeforeCompile(ff);
    ok("I1: the flowers' colour is on their heads, not their stems", /color\.r \+ color\.g \+ color\.b/.test(ff.vertexShader));
    ok("I1: grass casts no moon shadow (it was, by its padded bounds)", chunks.every((d) => !d.mesh.castShadow && !d.far.castShadow) && chunks.every((d) => d.mesh.receiveShadow));
  }

  // ---- I2: zombies -------------------------------------------------------------
  function zombies() {
    fresh("high");
    const C = G.CONFIG.zombieLooks;
    ok("I2: the odd ones' chances are in js/config.js", C && C.oddChance > 0 && C.oddChance < 0.5 && ["deformed", "headInHand", "longArm", "bigArm"].every((k) => C.odd[k] > 0));
    let odd = 0, crawlerOk = true, bossOk = true;
    for (let i = 0; i < 600; i++) if (G.randomZombieLook("normal", "school").odd) odd++;
    for (let i = 0; i < 200; i++) { const o = G.randomZombieLook("crawler", "school").odd; if (o && o !== "deformed") crawlerOk = false; }
    for (let i = 0; i < 100; i++) if (G.randomZombieLook("boss", "school").odd) bossOk = false;
    ok("I2: about a quarter are odd", Math.abs(odd / 600 - C.oddChance) < 0.07, (odd / 600).toFixed(2));
    ok("I2: a crawler can only have the face", crawlerOk);
    ok("I2: a boss is never odd", bossOk);
    const base = V(0, 0, 48);
    const plain = oddZombie("normal", null, base.clone().add(V(-3, 0, -3)));
    const parts = (grp) => grp.children.filter((c) => c.isMesh).reduce((s, m) => s + (m.userData.parts ? m.userData.parts.length : 1), 0);
    const L = plain.mesh.userData.limbs;
    ok("I2: fingers and a thumb on each hand (forearm, hand, 5 more)", parts(L.armL.elbow) >= 7 && parts(L.armR.elbow) >= 7, parts(L.armL.elbow) + "," + parts(L.armR.elbow));
    // scars: over twenty zombies, some on the head, arms and legs
    // (a scar is a thin line, with its stitches: the only pieces that small
    // on an upper arm, a thigh or a shin)
    const tiny = (grp) => grp.children.filter((c) => c.isMesh && c.userData.parts).reduce((s, m) => s + m.userData.parts.filter((p) => { const q = p.box.getSize(V()); return q.x * q.y * q.z < 2e-4; }).length, 0);
    let scarred = 0;
    for (let i = 0; i < 20; i++) { const z = oddZombie("normal", null, base.clone().add(V(8 + i, 0, -8))); const l = z.mesh.userData.limbs; if ([l.legL.hip, l.legR.hip, l.legL.knee, l.legR.knee, l.armL.shoulder, l.armR.shoulder].some((j) => tiny(j) > 0)) scarred++; }
    ok("I2: scars on arms and legs (most of them have some)", scarred >= 10, scarred + "/20");
    const deformed = oddZombie("normal", "deformed", base.clone().add(V(-1.5, 0, -3)));
    ok("I2: a deformed face: more to the head (the torn mouth, the jaw)", parts(deformed.mesh.userData.neck) > parts(plain.mesh.userData.neck) + 8, parts(deformed.mesh.userData.neck) + " vs " + parts(plain.mesh.userData.neck));
    const longA = oddZombie("normal", "longArm", base.clone().add(V(1.5, 0, -3)));
    const LA = longA.mesh.userData.limbs, longSide = longA.look.oddSide < 0 ? LA.armL : LA.armR, other = longA.look.oddSide < 0 ? LA.armR : LA.armL;
    ok("I2: one arm far too long", Math.abs(longSide.elbow.position.y) > Math.abs(other.elbow.position.y) * 1.3);
    const bigA = oddZombie("normal", "bigArm", base.clone().add(V(3, 0, -3)));
    const BA = bigA.mesh.userData.limbs, bigSide = bigA.look.oddSide < 0 ? BA.armL : BA.armR, small = bigA.look.oddSide < 0 ? BA.armR : BA.armL;
    const width = (o) => { const b = new THREE.Box3().setFromObject(o); return b.max.x - b.min.x + b.max.z - b.min.z; };
    g.scene.updateMatrixWorld(true);
    ok("I2: one arm far too big", width(bigSide.elbow) > width(small.elbow) * 1.4, width(bigSide.elbow).toFixed(2) + " vs " + width(small.elbow).toFixed(2));
    // the kinds still tell apart: a fast one stays slighter, a crawler low
    const fastOdd = oddZombie("fast", "bigArm", base.clone().add(V(6, 0, 3)));
    const crawl = oddZombie("crawler", "deformed", base.clone().add(V(-6, 0, 3)));
    g.scene.updateMatrixWorld(true);
    // (the body only: the word over it is a sprite)
    const body = (o) => { const b = new THREE.Box3(); o.traverse((c) => { if (c.isMesh && !c.isSprite) b.union(new THREE.Box3().setFromObject(c)); }); return b; };
    const hgt = (z) => body(z.mesh).max.y - z.mesh.position.y;
    ok("I2: an odd one is still its kind (fast shorter, crawler low)", hgt(fastOdd) < hgt(plain) && hgt(crawl) < 1.1, hgt(fastOdd).toFixed(2) + " < " + hgt(plain).toFixed(2) + ", crawler " + hgt(crawl).toFixed(2));

    // the one with its head in its hand
    const held = oddZombie("normal", "headInHand", base.clone());
    held.hp = 1e6;
    for (let i = 0; i < 20; i++) held.animate(DT, 0);
    g.scene.updateMatrixWorld(true);
    const u = held.mesh.userData, h = u.heldHead;
    ok("I2: its head is in its hand", !!h && h.parent === u.holdArm.elbow && u.neck === h);
    ok("I2: ...and that is its head hitbox (the stump on its shoulders is not)", h.userData.isNeck === true && !u.upper.children.some((c) => c !== h && c.userData.isNeck));
    const hc = new THREE.Box3().setFromObject(h).getCenter(V());
    ok("I2: the head hangs below the hand, upright", hc.y < h.getWorldPosition(V()).y);
    const sp = held.sprite.getWorldPosition(V());
    ok("I2: its word is over the head in its hand", Math.hypot(sp.x - hc.x, sp.z - hc.z) < 0.3 && sp.y > hc.y && sp.y - hc.y < 1.0, sp.y.toFixed(2) + " / " + hc.y.toFixed(2));
    let hit = null; const orig = g.damageZombie;
    g.damageZombie = function (zz, d, pt, info) { if (zz === held) hit = { d, head: !!(info && info.head) }; return orig.call(this, zz, d, pt, info); };
    try {
      const from = V(hc.x, hc.y + 0.3, hc.z + 4);
      g.raycastShoot(from, hc.clone().sub(from).normalize(), 10, false, null);
      ok("I2: a shot at the head in its hand is a head shot", hit && hit.head && hit.d === 10 * G.HEADSHOT_MULT, JSON.stringify(hit));
      hit = null;
      const stump = new THREE.Box3().setFromObject(u.upper.children.find((c) => !c.isMesh && c !== h && Math.abs(c.position.y - 0.72) < 0.01)).getCenter(V());
      const f2 = V(stump.x, stump.y, stump.z + 4);
      g.raycastShoot(f2, stump.clone().sub(f2).normalize(), 10, false, null);
      ok("I2: a shot at the empty shoulders is a body shot", hit && !hit.head, JSON.stringify(hit));
      // a plain one's head shot still counts
      hit = null; const pz = plain; pz.hp = 1e6;
      g.damageZombie = function (zz, d, pt, info) { if (zz === pz) hit = { head: !!(info && info.head) }; return orig.call(this, zz, d, pt, info); };
      const phc = new THREE.Box3().setFromObject(pz.mesh.userData.neck).getCenter(V()), f3 = V(phc.x, phc.y, phc.z + 4);
      g.raycastShoot(f3, phc.clone().sub(f3).normalize(), 10, false, null);
      ok("I2: an ordinary head shot still counts", hit && hit.head);
    } finally { g.damageZombie = orig; }
    // killed by a head shot, the carried head flies off
    held.hp = 5;
    const from = V(hc.x, hc.y + 0.3, hc.z + 4);
    g.raycastShoot(from, hc.clone().sub(from).normalize(), 10, false, null);
    const d = G.ZombieFX.dying.find((q) => q.z === held);
    ok("I2: killed by a head shot, the carried head flies off", !held.alive && d && d.mode === "decap" && h.parent === g.scene);
    g.clearZombies();
  }

  // ---- I3: walls, rooms -------------------------------------------------------
  function wear() {
    fresh("high");
    const W = g.world, c = W.wearCounts || {};
    ok("I3: marks on the walls inside", c.decals > 400, c.decals);
    ok("I3: writing on the walls", c.words >= 4, c.words);
    ok("I3: locker doors hanging off", c.doors >= 8, c.doors);
    ok("I3: cables out of the ceiling", c.cables >= 10, c.cables);
    ok("I3: fallen light fittings", (W.fallenLights || 0) >= 3, W.fallenLights);
    ok("I3: some signs hanging askew", (W.signsAskew || 0) >= 3, W.signsAskew);
    const marks = W.wearMarks || [];
    ok("I3: no mark in a doorway", marks.every((m) => m.w.doors.every((dz) => Math.abs(m.t - dz) >= 1.62 + m.sw / 2 - 1e-6)));
    ok("I3: no mark across the dado rail", marks.every((m) => !(m.y0 - m.w.y < 1.2 && m.y1 - m.w.y > 1.1)));
    const holes = (m) => (m.w.axis === "z" ? G.SchoolShell.holesIn(W, m.w.fixed, m.w.y) : []);
    ok("I3: no mark over a window", marks.every((m) => holes(m).every((h) => !(Math.abs(h.z - m.t) < h.w / 2 + m.sw / 2 && m.y1 > h.y0 && m.y0 < h.y1))));
    // the tiers: Very Low keeps the A marks only, High draws them all
    const mats = { A: G.SchoolWear.mark("crack", 1, 1, "A").material, B: G.SchoolWear.mark("crack", 1, 1, "B").material, C: G.SchoolWear.mark("crack", 1, 1, "C").material };
    const vis = () => { const v = { A: [], B: [], C: [] }; g.scene.traverse((o) => { if (!o.isMesh) return; for (const k in mats) if (o.material === mats[k]) v[k].push(o.visible); }); return v; };
    let v = vis();
    ok("I3: the marks merge into a few meshes per tier", v.A.length > 0 && v.B.length > 0 && v.C.length > 0 && v.A.length + v.B.length + v.C.length < (c.decals || 0) / 2, v.A.length + "/" + v.B.length + "/" + v.C.length);
    ok("I3: High draws every tier", ["A", "B", "C"].every((k) => v[k].every(Boolean)));
    G.save.settings.graphicsQuality = "vlow"; g.applyGraphicsQuality(); v = vis();
    ok("I3: Very Low only the essential ones", v.A.every(Boolean) && !v.B.some(Boolean) && !v.C.some(Boolean));
    G.save.settings.graphicsQuality = "medium"; g.applyGraphicsQuality(); v = vis();
    ok("I3: Medium all but the finest", v.A.every(Boolean) && v.B.every(Boolean) && !v.C.some(Boolean));
    G.save.settings.graphicsQuality = "high"; g.applyGraphicsQuality();
    // (the Thai block built from char codes, so this file itself stays clean)
    const THAI = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
    ok("I3: the writing is English, from the strings file", Array.from({ length: 14 }, (_, i) => G.T("scrawl." + (i + 1))).every((s) => s && !/scrawl\./.test(s) && !THAI.test(s)));
    // wrecked classrooms: some, not all; chalk on their boards; aisles open
    const cls = Object.values(W.roomInfo || {}).map((r) => r.spec).concat(W.upperSpecs || []).filter((s, i, a) => s && s.type === "classroom" && a.indexOf(s) === i);
    const wrecked = cls.filter((s) => s.wrecked);
    ok("I3: some classrooms wrecked, not all", wrecked.length >= 2 && wrecked.length < cls.length, wrecked.length + "/" + cls.length);
    ok("I3: a warning chalked on each wrecked room's board", wrecked.every((s) => s.chalk >= 1 && s.chalk <= 6));
    const blocked = (x, y, z) => W.colliders.some((b) => !b.passShots && x > b.min.x - 0.3 && x < b.max.x + 0.3 && z > b.min.z - 0.3 && z < b.max.z + 0.3 && y + 0.4 > b.min.y && y + 0.2 < b.max.y);
    const stuck = [];
    wrecked.forEach((s) => {
      const r = s.room, o = r.cx < 0 ? -1 : 1, doorX = r.cx - o * (r.w / 2 - 0.2), y = s.baseY || 0;
      (s.doorZs || [r.cz]).forEach((dz) => {
        // from the door straight in to the middle of the room, then along it
        for (let u = 0.8; u <= r.w / 2; u += 0.25) if (blocked(doorX + o * u, y, dz)) { stuck.push(r.cx + "," + r.cz + "," + y + " at u " + u); return; }
      });
    });
    ok("I3: in a wrecked room the way in from every door is open", stuck.length === 0, stuck.join(" | "));
    // nothing added blocks anything: the new pieces are no colliders
    ok("I3: the hanging doors keep their lockers (still solid)", (W.corridorLockers || []).length > 0);
  }

  async function run() {
    results.length = 0;
    for (let i = 0; i < 200 && !(G.save && G.Game.renderer); i++) await new Promise((r) => setTimeout(r, 50));
    if (!G.save) return { total: 1, pass: 0, fail: [{ name: "the game had not started", pass: false, info: "" }], results: [] };
    const saved = JSON.stringify(G.save);
    G._missingKeys = {};
    const rpl = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    try {
      glass(); await tick();
      grass(); await tick();
      zombies(); await tick();
      wear(); await tick();
      ok("no missing strings", Object.keys(G._missingKeys || {}).length === 0, Object.keys(G._missingKeys || {}).join(","));
    } catch (e) {
      ok("no exception", false, String(e && e.stack || e));
    } finally {
      G.Input.requestPointerLock = rpl;
      G.save = JSON.parse(saved);
      G.persist();
      G.Input.keys = {};
      G.Modal.reset();
      if (G.Game._upd) G.Game.update = G.Game._upd;
      G.Game.quitToMainMenu();
    }
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results };
  }
  return { run };
})();
