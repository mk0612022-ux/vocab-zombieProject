// ===================================================================
// The Word Forge's look (expansion, round 6)
// -------------------------------------------------------------------
// A forged gun wears its tier: a glowing stripe of the tier's colour down
// each side of its receiver, a pip for each tier behind it, from Mk II a
// small plate with its mark (G.CONFIG.forge.look). Unlit, so a skin never
// repaints it (js/gunskins.js leaves glowing parts alone) and it reads in the
// dark; it breathes slowly in the hands.
// The upgrade's scene, 2-3 s once a test is passed: the gun laid on the
// anvil, three blows -- sparks and a ringing clang each -- its tier lighting
// up on it at the last, then back in the hands. The world waits (a G.Modal
// that pauses); the first time it plays through, after that any key, a tap
// or a click skips it (G.save.tutorialSeen.forge_scene).
//
//   G.ForgeScene.decorate(g, def, tier)     on a gun's model (G.buildWeaponMesh)
//   G.ForgeScene.play(game, station, id, tier, done) / update(game, dt) / skip()
// ===================================================================
window.G = window.G || {};

G.ForgeScene = (function () {
  const C = () => G.CONFIG.forge;
  let cur = null;                                    // the scene playing

  // ---------------- the tier on a gun ----------------
  // (after its surfaces are merged -- js/gunskin.js -- so it stays apart and
  // glows: two draw calls at most, the stripes and pips one, the plates one)
  const tmpV = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function decorate(g, def, tier) {
    tier = Math.max(0, Math.min(3, tier | 0));
    if (!g || !tier) return g;
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const meshes = [];
    g.traverse((o) => { if (o.isMesh && o.visible && !(o.material && o.material.userData && o.material.userData.role === "attach") && !(o.userData && o.userData.lens)) meshes.push(o); });
    if (!meshes.length) return g;
    // the gun's box, in its own frame
    const box = new THREE.Box3(), bb = new THREE.Box3();
    meshes.forEach((m) => { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(inv); box.union(bb); });
    const An = g.userData.anchors || {}, L = box.max.z - box.min.z;
    // the receiver: round the magazine well (or a little behind the middle), below the rail
    const zc = An.magWell ? An.magWell.z : (box.min.z + box.max.z) / 2 + L * 0.08;
    const yc = An.rail ? An.rail.y - Math.min(0.03, (An.rail.y - box.min.y) * 0.22) : box.min.y + (box.max.y - box.min.y) * 0.62;
    const len = Math.max(0.06, Math.min(0.2, L * 0.28));
    // its side, x in its own frame, at (yc, z): a ray from far out to the middle
    const rc = new THREE.Raycaster();
    const sideAt = (s, z) => {
      tmpV.set(s * (Math.abs(box.max.x) + Math.abs(box.min.x) + 1), yc, z).applyMatrix4(g.matrixWorld);
      tmpD.set(-s, 0, 0).transformDirection(g.matrixWorld);
      rc.set(tmpV, tmpD); rc.near = 0; rc.far = 10;
      const h = rc.intersectObjects(meshes, false)[0];
      return h ? h.point.clone().applyMatrix4(inv).x : null;
    };
    const xs = [-1, 1].map((s) => {
      let best = null;
      [-0.4, 0, 0.4].forEach((f) => { const x = sideAt(s, zc + f * len); if (x != null) best = best == null ? x : s > 0 ? Math.max(best, x) : Math.min(best, x); });
      return best == null ? s * 0.02 : best;
    });
    const col = C().look.colors[tier - 1];
    const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
    mat.userData.role = "attach"; mat.userData.forge = true;
    const parts = new THREE.Group();
    parts.name = "forge-tier";
    [-1, 1].forEach((s, i) => {
      const x = xs[i] + s * 0.0035;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, len), mat);
      stripe.position.set(x, yc, zc);
      parts.add(stripe);
      for (let k = 0; k < tier; k++) {
        const pip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.012), mat);
        pip.position.set(x, yc - 0.016, zc + len / 2 - 0.012 - k * 0.02);
        parts.add(pip);
      }
    });
    if (G.Perf && G.Perf.mergeLocal) G.Perf.mergeLocal(parts);
    // the plate, from Mk II: its mark on both sides (one mesh, the two faces)
    if (tier >= 2) {
      const cv = document.createElement("canvas");
      cv.width = 128; cv.height = 48;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#0d0d10"; ctx.fillRect(0, 0, 128, 48);
      ctx.strokeStyle = "#" + col.toString(16).padStart(6, "0"); ctx.lineWidth = 4; ctx.strokeRect(3, 3, 122, 42);
      ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      G.fitFont(ctx, G.Forge.labelOf(tier), 30, 112); ctx.fillText(G.Forge.labelOf(tier), 64, 26);
      const pm = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), toneMapped: false });
      pm.userData.role = "attach"; pm.userData.forge = true;
      const pos = [], uv = [], idx = [];
      [-1, 1].forEach((s, i) => {
        const q = new THREE.PlaneGeometry(0.036, 0.0135);
        q.applyMatrix4(new THREE.Matrix4().makeRotationY(s * Math.PI / 2).setPosition(xs[i] + s * 0.0045, yc - 0.004, zc - len / 2 + 0.024));
        const o = pos.length / 3;
        pos.push(...q.attributes.position.array); uv.push(...q.attributes.uv.array);
        for (let k = 0; k < q.index.count; k++) idx.push(q.index.getX(k) + o);
        q.dispose();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      parts.add(new THREE.Mesh(geo, pm));
    }
    g.add(parts);
    g.userData.forgeTier = tier;
    g.userData.forgeMats = [mat];
    return g;
  }

  // ---------------- the scene ----------------
  const T0 = 0.35, BLOWS = [0.55, 1.15, 1.75];
  function play(game, W, id, tier, done) {
    const def = G.WEAPON_DEFS[id];
    if (!game || !W || !def) { if (done) done(); return; }
    end(true);
    const seen = !!(G.save.tutorialSeen && G.save.tutorialSeen.forge_scene);
    // the gun on the anvil, as it was; its tier lights up at the last blow
    const show = G.buildWeaponMesh(def, { loadout: true, tier: tier - 1 });
    show.scale.setScalar(1.7);
    show.rotation.set(0, W.ry - Math.PI / 2, 0);
    show.position.copy(W.anvil).add(new THREE.Vector3(0, 0.06, 0));
    game.scene.add(show);
    G.ViewModel.setVisible(false);
    // the view to the anvil
    const from = { yaw: game.yawObject.rotation.y, pitch: game.pitchObject.rotation.x };
    const eye = new THREE.Vector3(); game.camera.getWorldPosition(eye);
    const to = { yaw: Math.atan2(-(W.anvil.x - eye.x), -(W.anvil.z - eye.z)), pitch: Math.atan2(W.anvil.y - eye.y, Math.hypot(W.anvil.x - eye.x, W.anvil.z - eye.z)) };
    let dy = to.yaw - from.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    to.yaw = from.yaw + dy;
    cur = { game, W, id, tier, def, show, t: 0, blows: 0, lit: false, done, seen, from, to, skipKey: null };
    G.Modal.open("forge-scene", { pause: true, keys: () => { if (cur && cur.seen) skip(); return true; } });
    cur.skipKey = () => { if (cur && cur.seen) skip(); };
    window.addEventListener("pointerdown", cur.skipKey, true);
    if (G.Bus) G.Bus.emit("forge:scene", { id, tier, skippable: seen });
  }
  function blow(n) {
    const c = cur, p = c.W.anvil.clone().add(new THREE.Vector3(0, 0.1, 0));
    if (G.FX && G.FX.impact) G.FX.impact({ point: p, normal: new THREE.Vector3(0, 1, 0), surface: "metal", decal: false, share: n === 2 ? 2 : 1.4 });
    clang(p, n);
  }
  // a blow on the anvil: a short bright noise and three ringing partials, inharmonic like struck steel
  function clang(pos, n) {
    const A = G.Audio;
    if (!A || !A.ctx) return;
    const k = 1 + (n - 1) * 0.04;
    A.group({ cat: "sfx", prio: 2, dur: 1.4, pos }, () => {
      A.noise({ dur: 0.06, filter: "bandpass", freq: 3200 * k, q: 1.4, gain: 0.32, pos, rev: 0.3 });
      [[523, 0.16, 1.1], [1287, 0.1, 0.8], [2219, 0.07, 0.55], [3364, 0.04, 0.4]].forEach(([f, g, d]) => A.tone({ type: "sine", freq: f * k, dur: d, gain: g, attack: 0.002, pos, rev: 0.35 }));
      A.tone({ type: "triangle", freq: 140, freqEnd: 90, dur: 0.18, gain: 0.18, pos });
    });
  }
  function update(game, dt) {
    breathe(game);
    const c = cur;
    if (!c) return;
    c.t += dt;
    // the view turns to the anvil, then back where it was
    const k = c.t < T0 ? G.Anim.smooth(c.t / T0) : c.t > C().scene - 0.3 ? G.Anim.smooth(Math.max(0, (C().scene - c.t) / 0.3)) : 1;
    c.game.yawObject.rotation.y = c.from.yaw + (c.to.yaw - c.from.yaw) * k;
    c.game.pitchObject.rotation.x = c.from.pitch + (c.to.pitch - c.from.pitch) * k;
    while (c.blows < BLOWS.length && c.t >= BLOWS[c.blows]) { c.blows++; blow(c.blows); }
    if (!c.lit && c.blows >= 3) {
      // its new look on the anvil
      c.lit = true;
      const p = c.show.position.clone(), r = c.show.rotation.clone(), s = c.show.scale.clone();
      c.game.scene.remove(c.show); G.disposeObject3D(c.show);
      c.show = G.buildWeaponMesh(c.def, { loadout: true, tier: c.tier });
      c.show.position.copy(p); c.show.rotation.copy(r); c.show.scale.copy(s);
      c.game.scene.add(c.show);
    }
    if (c.lit && c.show.userData.forgeMats) c.show.userData.forgeMats.forEach((m) => m.color.setHex(C().look.colors[c.tier - 1]).multiplyScalar(1 + 1.5 * Math.max(0, 1 - (c.t - BLOWS[2]) / 0.6)));
    // (the sparks fly while the world waits)
    if (G.FX && G.FX.update) G.FX.update(dt, c.game);
    if (c.t >= C().scene) end();
  }
  function skip() {
    const c = cur;
    if (!c) return;
    while (c.blows < BLOWS.length) { c.blows++; }
    end();
  }
  // over: the gun back in the hands, the view where it was, the world going again
  function end(quiet) {
    const c = cur;
    if (!c) return;
    cur = null;
    window.removeEventListener("pointerdown", c.skipKey, true);
    c.game.scene.remove(c.show); G.disposeObject3D(c.show);
    c.game.yawObject.rotation.y = c.from.yaw; c.game.pitchObject.rotation.x = c.from.pitch;
    G.ViewModel.setVisible(true);
    G.save.tutorialSeen = G.save.tutorialSeen || {};
    if (!quiet && !G.save.tutorialSeen.forge_scene) { G.save.tutorialSeen.forge_scene = true; G.persist(); }
    G.Modal.close("forge-scene");
    if (c.done) c.done();
  }
  // the gun in hand's tier: it breathes
  function breathe(game) {
    const g = game && game.weaponViewGroup;                 // (the gun in hand is the view group itself)
    const mats = g && g.userData.forgeMats;
    if (!mats) return;
    const tier = g.userData.forgeTier, s = 0.8 + 0.2 * Math.sin(performance.now() / 600);
    mats.forEach((m) => m.color.setHex(C().look.colors[tier - 1]).multiplyScalar(s));
  }
  function reset() { if (cur) end(true); }

  return { decorate, play, update, skip, reset, clang, get active() { return !!cur; }, get cur() { return cur; }, BLOWS };
})();
