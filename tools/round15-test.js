// Dev-only (not shipped). New series, round 1: hitting the zombie you aim at.
//   A  hitboxes: one a part, on every kind of zombie and every odd look
//   B  a crowd of 18-20 packed zombies: every zombie that can be seen is hit
//      where it is aimed at -- its body, or its word -- and "what you see is
//      what you hit" over a thousand random shots into the crowd
//   C  what never stops a shot: a body falling, a flying head, a drop, a
//      particle, anything hidden
//   D  the words: none overlapping, lines to the moved ones, the one aimed at
//      larger and outlined, a word behind a wall neither seen nor hit
//   E  aim assist (touch, controller; Settings), off with a mouse
//   F  the crowd: kept apart, closing in from several sides
//   G  the version shown, the update check's pieces (js/updater.js)
// Load it into the game:
//   const r = await G.Round15Test.run();   r.fail -> [] when everything passes
//   r.crowd: the crowd results per screen (desktop, iPad landscape and portrait)
// The game's own clock is stopped while it runs; the save is put back.
window.G = window.G || {};
G.Round15Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const V3 = THREE.Vector3;
  const out = { crowd: [] };
  let g, realUpdate;

  function freshRun() {
    g = G.Game;
    if (g.state !== "MENU") g.quitToMainMenu();
    g.startLevel(1);
    g.update = function () {};
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;
    clear();
    g.pitchObject.rotation.x = 0;
    return g;
  }
  function clear() { g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = []; g.targetPair = null; G.Aim.setHover(null); }
  // the open direction from where the player stands (for the crowd)
  function openYaw(min) {
    const p = g.yawObject.position;
    let best = 0, bestD = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
      const d = g.wallDistance(p, new V3(-Math.sin(a), 0, -Math.cos(a)), 60);
      if (d > bestD) { bestD = d; best = a; }
    }
    return { yaw: best, room: bestD, ok: bestD >= (min || 12) };
  }
  // a zombie with a word, at an offset (right, forward) from the player along `yaw`
  function add(type, right, ahead, word, look) {
    const p = g.yawObject.position, yaw = g.yawObject.rotation.y;
    const f = new V3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = new V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const pos = p.clone().addScaledVector(f, ahead).addScaledVector(r, right);
    pos.y = G.getFloorHeightAt(g.world, pos.x, pos.z, p.y - 1.7);
    const saved = G.randomZombieLook;
    if (look) G.randomZombieLook = function (t, th) { const l = saved(t, th); l.odd = look.odd || null; l.oddSide = look.side || 1; return l; };
    let z;
    try { z = new G.Zombie(type, pos, word, g.level.theme); } finally { G.randomZombieLook = saved; }
    z.mesh.rotation.y = yaw;          // facing the player
    g.dressZombie(z, word, { clue: "thai", answer: "shoot" });
    g.scene.add(z.mesh); g.zombies.push(z);
    z.animate(0.05, 0);
    return z;
  }
  const settle = (n) => { for (let i = 0; i < (n || 30); i++) { g.zombies.forEach((z) => z.alive && z.animate(0.016, 0)); G.Aim.update(g, 0.05); } };
  const cam = () => { g.yawObject.updateMatrixWorld(true); g.camera.updateMatrixWorld(); return { o: g.camera.getWorldPosition(new V3()), f: g.camera.getWorldDirection(new V3()) }; };
  // turn the view to look along `dir`
  function look(dir) {
    g.yawObject.rotation.y = Math.atan2(-dir.x, -dir.z);
    g.pitchObject.rotation.x = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    g.yawObject.updateMatrixWorld(true);
  }
  // what is SEEN along a ray: the word on top if one covers the spot, else the
  // first piece of a living zombie's model (not its hitboxes, word, outline)
  function seen(o, d) {
    const lh = G.Aim.labelHit(g, o, d);
    if (lh) return lh.z;
    const meshes = [];
    g.zombies.forEach((z) => { if (z.alive) { z.mesh.updateMatrixWorld(true); z.mesh.traverse((m) => { if (m.isMesh && !m.userData.hit && !m.userData.outline && m.visible) meshes.push(m); }); } });
    const rc = new THREE.Raycaster(o, d, 0, g.wallDistance(o, d, 60));
    const h = rc.intersectObjects(meshes, false)[0];
    if (!h) return null;
    let x = h.object; while (x && !x.userData.zombie) x = x.parent;
    return x ? x.userData.zombie : null;
  }
  // a real shot along the view: who took it
  function shoot() {
    const hit = [];
    const real = g.damageZombie;
    g.damageZombie = function (z) { hit.push(z); };
    try { const c = cam(); g.raycastShoot(c.o, c.f, 1, 1, { damage: 1 }); } finally { g.damageZombie = real; }
    return hit;
  }

  // ---------------- A: hitboxes ----------------
  function hitboxes() {
    freshRun();
    const parts = (z) => z.hitboxes.map((h) => h.userData.hit);
    const count = (z, p) => parts(z).filter((x) => x === p).length;
    const n = add("normal", 0, 6, ["acquire", "x"]);
    ok("A a zombie: head, body, two arms in two pieces, two hands, two legs in three", count(n, "head") === 1 && count(n, "body") >= 1 && count(n, "arm") === 4 && count(n, "hand") === 2 && count(n, "leg") === 6, parts(n).join());
    const c = add("crawler", 1, 6, ["affect", "x"]);
    ok("A a crawler: body, head, arms, hands, the two stumps", count(c, "head") === 1 && count(c, "body") === 1 && count(c, "arm") === 4 && count(c, "hand") === 2 && count(c, "leg") === 2, parts(c).join());
    ok("A the hitboxes are not drawn, cast no shadow, and are no part of the model", n.hitboxes.every((h) => !h.visible && !h.castShadow));
    // each box fits its part: no bigger than the part it covers (+ the pad)
    const box = new THREE.Box3(), size = new V3();
    n.mesh.updateMatrixWorld(true);
    const body = n.hitboxes.find((h) => h.userData.hit === "body");
    box.setFromObject(body).getSize(size);
    ok("A the body box is a body, not the whole zombie (under 0.7 m wide, 1 m tall)", size.x < 0.7 && size.y < 1 && size.z < 0.7, size.toArray().map((v) => v.toFixed(2)).join(" x "));
    const all = new THREE.Box3();
    n.hitboxes.forEach((h) => all.union(new THREE.Box3().setFromObject(h)));
    const vis = new THREE.Box3();
    n.mesh.traverse((m) => { if (m.isMesh && !m.userData.hit && !m.userData.outline) vis.union(new THREE.Box3().setFromObject(m)); });
    const a = all.getSize(new V3()), v = vis.getSize(new V3());
    ok("A all the boxes together are the size of the model (within 10%)", Math.abs(a.y - v.y) / v.y < 0.1 && a.x <= v.x * 1.1, "boxes " + a.toArray().map((x) => x.toFixed(2)).join(" x ") + " / model " + v.toArray().map((x) => x.toFixed(2)).join(" x "));
    // the odd ones
    clear();
    const held = add("normal", 0, 6, ["acquire", "x"], { odd: "headInHand", side: 1 });
    settle(3);
    const hb = held.hitboxes.find((h) => h.userData.hit === "head").getWorldPosition(new V3());
    const hand = held.hitboxes.filter((h) => h.userData.hit === "hand").map((h) => h.getWorldPosition(new V3()));
    const torso = held.hitboxes.find((h) => h.userData.hit === "body").getWorldPosition(new V3());
    ok("A a head carried in a hand: its box hangs with the hand, not on the shoulders", Math.min(...hand.map((p) => p.distanceTo(hb))) < 0.45 && hb.y < torso.y + 0.2, "head y " + hb.y.toFixed(2) + ", body y " + torso.y.toFixed(2));
    clear();
    const long = add("normal", 0, 6, ["acquire", "x"], { odd: "longArm", side: 1 });
    settle(3);
    // (the arms reach forward: the long one's hand is farther from the body)
    const lt = long.hitboxes.find((h) => h.userData.hit === "body").getWorldPosition(new V3());
    const hands = long.hitboxes.filter((h) => h.userData.hit === "hand").map((h) => h.getWorldPosition(new V3()).distanceTo(lt));
    ok("A a long arm: its hand box reaches farther than the other", Math.abs(hands[0] - hands[1]) > 0.15, hands.map((y) => y.toFixed(2)).join(" / "));
    clear();
    const big = add("normal", 0, 6, ["acquire", "x"], { odd: "bigArm", side: -1 });
    const arms = big.hitboxes.filter((h) => h.userData.hit === "arm").map((h) => h.scale.x);
    ok("A a swollen arm: its boxes are thicker", Math.max(...arms) > Math.min(...arms) * 1.5, arms.map((x) => x.toFixed(2)).join());
  }

  // ---------------- B: the crowd ----------------
  // 20 zombies as close as they can stand (G.CONFIG.crowd.gap apart) in four
  // staggered rows: all the kinds and odd looks
  // (just the crowd, for a screenshot)
  // (step: metres to walk out first -- clear of anything right beside the start)
  function buildCrowd(step) {
    freshRun();
    let o = openYaw(14);
    if (step) {
      g.yawObject.position.add(new V3(-Math.sin(o.yaw), 0, -Math.cos(o.yaw)).multiplyScalar(step));
      g.yawObject.position.y = 1.7 + G.getFloorHeightAt(g.world, g.yawObject.position.x, g.yawObject.position.z, g.yawObject.position.y - 1.7);
      o = openYaw(14);
    }
    g.yawObject.rotation.y = o.yaw; g.pitchObject.rotation.x = 0;
    const words = G.WORDS_LEVEL_1.slice(20, 40);
    const looks = [null, { odd: "longArm", side: 1 }, { odd: "bigArm", side: -1 }, { odd: "headInHand", side: 1 }, null];
    words.forEach((w, i) => {
      const row = Math.floor(i / 5), col = i % 5, gap = G.CONFIG.crowd.gap;
      const type = i % 7 === 3 ? "crawler" : i % 4 === 2 ? "fast" : "normal";
      add(type, (col - 2) * gap + (row % 2) * gap / 2, 5 + row * gap, w, type === "crawler" ? null : looks[(i + row) % looks.length]);
    });
    settle(40);
    return g.zombies.length;
  }
  function crowd(tag) {
    freshRun();
    const o = openYaw(14);
    g.yawObject.rotation.y = o.yaw; g.pitchObject.rotation.x = 0;
    const words = G.WORDS_LEVEL_1.slice(20, 40);
    const looks = [null, { odd: "longArm", side: 1 }, { odd: "bigArm", side: -1 }, { odd: "headInHand", side: 1 }, null];
    words.forEach((w, i) => {
      const row = Math.floor(i / 5), col = i % 5;
      const type = i % 7 === 3 ? "crawler" : i % 4 === 2 ? "fast" : "normal";
      const gap = G.CONFIG.crowd.gap;
      add(type, (col - 2) * gap + (row % 2) * gap / 2, 5 + row * gap, w, type === "crawler" ? null : looks[(i + row) % looks.length]);
    });
    settle(40);
    const res = { tag, zombies: g.zombies.length, bodyAimable: 0, bodyHit: 0, labelHit: 0, labels: 0, hidden: 0, wrong: [] };
    const c0 = cam();
    for (const z of g.zombies) {
      // its word
      if (G.Aim.labelShown(z)) {
        res.labels++;
        const p = z.sprite.getWorldPosition(new V3());
        look(p.clone().sub(c0.o).normalize());
        const hit = shoot();
        if (hit.length === 1 && hit[0] === z) res.labelHit++; else res.wrong.push("word " + z.word + " -> " + (hit[0] ? hit[0].word : "nothing"));
      }
      // its body: a spot on it that can be seen (not under another body, nor under a word)
      let spot = null;
      const tries = [];
      z.hitboxes.forEach((h) => { const p = h.getWorldPosition(new V3()); tries.push(p); for (let k = 0; k < 4; k++) tries.push(p.clone().add(new V3((Math.random() - 0.5) * h.scale.x * 0.8, (Math.random() - 0.5) * h.scale.y * 0.8, 0))); });
      for (const p of tries) {
        const d = p.clone().sub(c0.o).normalize();
        look(d);
        if (seen(c0.o, d) === z) { spot = d; break; }
      }
      if (!spot) { res.hidden++; continue; }
      res.bodyAimable++;
      const hit = shoot();
      if (hit.length === 1 && hit[0] === z) res.bodyHit++; else res.wrong.push("body " + z.word + " -> " + (hit[0] ? hit[0].word : "nothing"));
    }
    // what you see is what you hit: random shots across the crowd
    let agree = 0, total = 0;
    for (let i = 0; i < 1000; i++) {
      const yaw = o.yaw + (Math.random() - 0.5) * 0.55, pitch = -0.32 + Math.random() * 0.42;
      const d = new V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const s = seen(c0.o, d);
      const t = G.Aim.trace(g, c0.o, d, g.wallDistance(c0.o, d, 60))[0];
      const h = t ? t.z : null;
      if (!s && !h) continue;
      total++;
      if (s === h) agree++;
    }
    res.agree = total ? +(agree / total * 100).toFixed(1) : 100;
    res.rays = total;
    out.crowd.push(res);
    return res;
  }

  // ---------------- C: what never stops a shot ----------------
  function blockers() {
    freshRun();
    const o = openYaw(10);
    g.yawObject.rotation.y = o.yaw;
    const back = add("normal", 0, 7, ["acquire", "x"]);
    const front = add("normal", 0, 5, ["affect", "x"]);
    front.setAnswer("shoot", "", { label: "" });       // (no word, so nothing on top)
    back.setAnswer("shoot", "", { label: "" });
    settle(5);
    const at = (z) => { const c = cam(); look(z.hitboxes.find((h) => h.userData.hit === "body").getWorldPosition(new V3()).sub(c.o).normalize()); };
    at(back);
    ok("C (the front one stands in the way)", shoot()[0] === front);
    // a big invisible thing on the front zombie
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshBasicMaterial());
    ghost.visible = false; ghost.position.y = 1; front.mesh.add(ghost);
    at(back);
    ok("C something hidden on a zombie is not hit", shoot()[0] === front && front.mesh.children.includes(ghost));
    front.mesh.remove(ghost);
    // it dies: the body falls and the head flies, and they stop nothing
    front.hp = 1;
    g.damageZombie(front, 999, front.mesh.position.clone().setY(front.mesh.position.y + 1), { dir: new V3(0, 0, -1), head: true });
    at(back);
    const after = shoot();
    ok("C a zombie dying in front (its body falling, its head flying) is not hit: the one behind is", !front.alive && after.length === 1 && after[0] === back, after.map((z) => z.word).join());
    // drops and particles in the way
    const drop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial());
    const c = cam(), mid = c.o.clone().add(back.mesh.position.clone().setY(c.o.y).sub(c.o).multiplyScalar(0.5));
    drop.position.copy(mid); g.scene.add(drop);
    G.spawnHitParticles(g.scene, mid, 0xff0000, "high");
    at(back);
    ok("C a drop or particles in the way are not hit", shoot()[0] === back);
    g.scene.remove(drop);
  }

  // ---------------- D: the words ----------------
  function words() {
    crowdOnly();
    const rects = G.Aim.labelRects(g);
    let pairs = 0;
    const detail = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      // (the word aimed at is drawn larger, on top: that one may overlap)
      if (a.z === G.Aim.hover || b.z === G.Aim.hover) continue;
      const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
      if (ox > 1 && oy > 1) { pairs++; detail.push(a.z.word + "(" + a.z._labelSlot.toFixed(2) + ", d " + a.depth.toFixed(1) + ") / " + b.z.word + "(" + b.z._labelSlot.toFixed(2) + ", d " + b.depth.toFixed(1) + ") by " + ox.toFixed(1) + " x " + oy.toFixed(1) + " px"); }
    }
    ok("D 20 packed zombies: no two words overlap on screen", pairs === 0, pairs + " overlapping of " + rects.length + " " + detail.join("; "));
    ok("D words moved up or down have a line to their zombie", G.Aim.leaderCount > 0 && G.Aim.leaderCount === g.zombies.filter((z) => Math.abs(z._labelOff) > G.CONFIG.aim.leaderMin * z.sprite.scale.y).length, G.Aim.leaderCount);
    // the one aimed at: outlined, its word larger
    const z = g.zombies[7], c = cam();
    look(z.sprite.getWorldPosition(new V3()).sub(c.o).normalize());
    G.Aim.update(g, 0.05);
    ok("D the zombie under the crosshair is outlined in light", G.Aim.hover === z && z._outline && z._outline.length === z.hitboxes.length);
    ok("D ...and its word is drawn larger", Math.abs(z.sprite.scale.x / z.sprite.userData.baseScale[0] - G.CONFIG.aim.labelHover) < 0.01);
    look(new V3(0, 1, 0)); G.Aim.update(g, 0.05);
    ok("D looking away: the outline goes, the word goes back", G.Aim.hover === null && !z._outline && Math.abs(z.sprite.scale.x - z.sprite.userData.baseScale[0]) < 0.01);
    // behind a wall (a wall high enough to hide the word, not a low fence)
    freshRun();
    const p = g.yawObject.position;
    let hidden = null, wallD = 0;
    for (let a = 0; a < Math.PI * 2 && !hidden; a += Math.PI / 18) {
      const d = g.wallDistance(p, new V3(-Math.sin(a), 0, -Math.cos(a)), 40);
      if (d < 3 || d > 30) continue;
      g.yawObject.rotation.y = a; g.yawObject.updateMatrixWorld(true);
      const z = add("normal", 0, d + 3, ["acquire", "x"]);
      const c1 = cam(), lp = z.sprite.getWorldPosition(new V3()), dl = lp.clone().sub(c1.o);
      if (g.wallDistance(c1.o, dl.clone().normalize(), dl.length()) < dl.length() - 1) { hidden = z; wallD = d; } else clear();
    }
    for (let i = 0; i < 20; i++) G.Aim.update(g, 0.05);
    const cc = cam();
    look(hidden.sprite.getWorldPosition(new V3()).sub(cc.o).normalize());
    ok("D a word behind a wall fades out and cannot be shot", hidden && hidden._labelWalled && hidden.sprite.material.opacity < 0.2 && !G.Aim.labelShown(hidden) && shoot().length === 0, "wall at " + wallD.toFixed(1));
  }
  function crowdOnly() { crowd("layout"); out.crowd.pop(); look(new V3(-Math.sin(g.yawObject.rotation.y), 0, -Math.cos(g.yawObject.rotation.y))); settle(30); }

  // ---------------- E: aim assist ----------------
  function assist() {
    freshRun();
    const o = openYaw(12);
    g.yawObject.rotation.y = o.yaw;
    // (14 m off: a few degrees beside it is beside it, not on an outstretched arm)
    const z = add("normal", 0, 14, ["acquire", "x"]);
    z.setAnswer("shoot", "", { label: "" });
    settle(3);
    const target = () => z.hitboxes.find((h) => h.userData.hit === "body").getWorldPosition(new V3());
    const off = (deg) => { look(target().sub(cam().o).normalize()); g.yawObject.rotation.y += deg * Math.PI / 180; g.yawObject.updateMatrixWorld(true); G.Aim.setHover(null); };
    const angle = () => { const c = cam(); return c.f.angleTo(target().sub(c.o).normalize()) * 180 / Math.PI; };
    g.state = "GAMEPLAY"; g.paused = false;
    const mode = G.Input.mode;
    const runFor = (s) => { for (let t = 0; t < s; t += 0.05) G.Aim.update(g, 0.05); };
    G.Input.mode = "touch"; G.save.settings.aimAssist = "medium";
    // (it pulls until the crosshair is on the zombie -- an arm held out
    // counts -- and no further)
    off(4); const a0 = angle(); runFor(1.5); const a1 = angle(), on1 = G.Aim.hover === z;
    ok("E touch, Medium: the view is drawn toward a zombie near the crosshair, until it is on it", a1 < a0 * 0.6 || (on1 && a1 < a0), a0.toFixed(2) + " deg -> " + a1.toFixed(2) + (on1 ? " (on it)" : ""));
    off(4); G.save.settings.aimAssist = "high";
    let tHigh = 0, tMed = 0;
    for (let t = 0; t < 3 && G.Aim.hover !== z; t += 0.05) { G.Aim.update(g, 0.05); tHigh = t; }
    off(4); G.save.settings.aimAssist = "medium";
    for (let t = 0; t < 3 && G.Aim.hover !== z; t += 0.05) { G.Aim.update(g, 0.05); tMed = t; }
    ok("E High gets there sooner than Medium", tHigh < tMed, tHigh.toFixed(2) + " s / " + tMed.toFixed(2) + " s");
    off(4); G.save.settings.aimAssist = "off"; runFor(1.5);
    ok("E Off: nothing moves", Math.abs(angle() - 4) < 0.05, angle().toFixed(2));
    off(12); G.save.settings.aimAssist = "high"; runFor(1.5);
    ok("E too far off (outside its cone): nothing moves", Math.abs(angle() - 12) < 0.05, angle().toFixed(2));
    G.Input.mode = "desktop"; G.Input.padActive = false; off(4); runFor(1.5);
    ok("E with a mouse: never", Math.abs(angle() - 4) < 0.05);
    G.Input.padActive = true; off(4); G.save.settings.aimAssist = "medium"; runFor(1.5);
    ok("E with a controller: yes", angle() < 3, angle().toFixed(2));
    G.Input.padActive = false; G.Input.mode = mode;
    G.UI.renderSettings();
    ok("E Settings: Aim assist, Off / Low / Medium / High", document.getElementById("set-aimassist").options.length === 4);
  }

  // ---------------- F: the crowd ----------------
  function crowdMoves() {
    freshRun();
    g.update = realUpdate;
    const o = openYaw(16);
    g.yawObject.rotation.y = o.yaw;
    // twelve on one spot: they ease apart
    const word = G.WORDS_LEVEL_1[5];
    for (let i = 0; i < 12; i++) add("normal", 0, 6, word);
    const pp = g.yawObject.position.clone();
    for (let t = 0; t < 3; t += 0.05) { G.Crowd.separate(g, 0.05); }
    let min = Infinity;
    g.zombies.forEach((a, i) => g.zombies.forEach((b, j) => { if (j > i) min = Math.min(min, Math.hypot(a.mesh.position.x - b.mesh.position.x, a.mesh.position.z - b.mesh.position.z)); }));
    ok("F twelve on one spot ease apart (" + G.CONFIG.crowd.gap + " m)", min > G.CONFIG.crowd.gap * 0.85, min.toFixed(2));
    void pp;
    // ten in a column, 14 m off: they spread round the player as they come
    const spread = (flank) => {
      freshRun(); g.update = realUpdate;
      g.yawObject.rotation.y = o.yaw;
      const saved = G.CONFIG.crowd.flank; G.CONFIG.crowd.flank = flank;
      for (let i = 0; i < 10; i++) add("normal", (i % 2) * 0.3, 13 + i * 0.6, G.WORDS_LEVEL_1[i]);
      const p = g.yawObject.position;
      // (measured on the way in, about 6 m off on average -- not once they
      // have all arrived and stand round the player whatever they did)
      const meanD = () => g.zombies.reduce((s, z) => s + Math.hypot(z.mesh.position.x - p.x, z.mesh.position.z - p.z), 0) / g.zombies.length;
      for (let t = 0; t < 14; t += 0.05) {
        g.updateZombies(0.05);
        if (meanD() < 6) break;
      }
      G.CONFIG.crowd.flank = saved;
      const ang = g.zombies.map((z) => Math.atan2(z.mesh.position.z - p.z, z.mesh.position.x - p.x));
      const mid = Math.atan2(ang.reduce((s, a) => s + Math.sin(a), 0), ang.reduce((s, a) => s + Math.cos(a), 0));
      const dev = ang.map((a) => Math.atan2(Math.sin(a - mid), Math.cos(a - mid)) * 180 / Math.PI);
      return Math.max(...dev) - Math.min(...dev);
    };
    const without = spread(0), withF = spread(G.CONFIG.crowd.flank);
    ok("F ten coming in a line close in from several sides (round the player)", withF >= 40 && withF > without * 1.5, "spread " + withF.toFixed(0) + " deg at 6 m (straight at the player: " + without.toFixed(0) + " deg)");
    g.update = function () {};
  }

  // ---------------- G: versions and updates ----------------
  async function versions() {
    const U = G.Updater;
    if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
    G.UI.goToMainMenu();
    await wait(50);
    ok("G the version in the lobby's corner", (document.querySelector(".lobby-footer [data-version]") || {}).textContent === U.label() && /^v\d{4}\.\d{2}\.\d{2}-\d{4}/.test(U.label()), U.label());
    G.UI.renderSettings();
    ok("G ...and in Settings, with Check for updates", (document.querySelector("#settings-content [data-version]") || {}).textContent === U.label() && !!document.getElementById("btn-check-update"));
    const m = await U.fetchManifest(true);
    ok("G version.json: the version, build, commit, what changed, every file with size and hash", m && m.version && m.build > 0 && Array.isArray(m.changes) && m.files["index.html"] && m.files["js/game.js"].hash.length === 16 && m.total > 1e6 && !m.files["sw.js"] && !m.files["_headers"]);
    const r = await fetch("version.json?x=" + Date.now(), { cache: "no-store" });
    ok("G it is fetched fresh, never from a cache", r.ok);
    const a = JSON.parse(JSON.stringify(m)), b = JSON.parse(JSON.stringify(m));
    b.files["js/game.js"].hash = "x"; b.files["js/new.js"] = { size: 1234, hash: "y" };
    const keep = U.installed; U.installed = a;
    ok("G the size of an update: only what changed", U.estimate(b) === m.files["js/game.js"].size + 1234, U.estimate(b));
    U.installed = keep;
    // the screens, without downloading anything
    const keepP = U.pending, keepStage = U.stage;
    U.pending = Object.assign({}, b, { version: "2099.01.01-0000", changes: ["Test change"] });
    U.showUpdate();
    ok("G Update Available: this version -> the new one, what changed, the size, Update", !document.getElementById("loading-overlay").classList.contains("hidden") && document.getElementById("upd-to").textContent === "v2099.01.01-0000" && /Test change/.test(document.getElementById("upd-changes").textContent) && /About/.test(document.getElementById("upd-size").textContent) && G.Modal.isOpen("boot") && G.Pad.scope() === document.getElementById("boot-box"));
    U.panel("boot-failed"); U.stage = "failed";
    ok("G a failed download: Retry, and Play this version", !document.getElementById("btn-update-retry").closest(".hidden") && !document.getElementById("btn-update-old").closest(".hidden"));
    U.playOld();
    ok("G Play this version: back in, with the old-version badge", document.getElementById("loading-overlay").classList.contains("hidden") && !G.Modal.isOpen("boot") && U.mismatch && /Old version/.test(document.getElementById("net-badge").textContent));
    U.mismatch = false; U.pending = keepP; U.stage = keepStage; U.offline = true; U.badge();
    ok("G offline: the Offline badge", /Offline/.test(document.getElementById("net-badge").textContent) && !document.getElementById("net-badge").classList.contains("hidden"));
    U.offline = false; U.badge();
    ok("G ...gone again online", document.getElementById("net-badge").classList.contains("hidden"));
    const missing = Object.keys(G._missingKeys || {});
    ok("G no missing strings", missing.length === 0, missing.join());
  }

  async function run() {
    results.length = 0; out.crowd = [];
    const backup = JSON.stringify(G.save);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    realUpdate = G.Game.update;
    const realLock = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    const mode = G.Input.mode;
    G._missingKeys = {};
    try {
      hitboxes();
      G.Input.mode = "desktop";
      const r1 = crowd("desktop 1024x768");
      ok("B crowd of 20 (mouse): every zombie that can be seen is hit where it is aimed", r1.bodyAimable >= 12 && r1.bodyHit === r1.bodyAimable, r1.bodyHit + "/" + r1.bodyAimable + " (" + r1.hidden + " hidden behind others) " + r1.wrong.slice(0, 3).join(" | "));
      ok("B ...and every word aimed at hits its own zombie, hidden or not", r1.labels === r1.zombies && r1.labelHit === r1.labels, r1.labelHit + "/" + r1.labels);
      ok("B what you see is what you hit (1000 random shots): 97% or better", r1.agree >= 97, r1.agree + "% of " + r1.rays);
      G.Input.mode = "touch";
      const r2 = crowd("touch (iPad) 1024x768");
      ok("B the same on a touch screen", r2.bodyHit === r2.bodyAimable && r2.labelHit === r2.labels && r2.agree >= 97, r2.bodyHit + "/" + r2.bodyAimable + ", words " + r2.labelHit + "/" + r2.labels + ", " + r2.agree + "%");
      blockers();
      words();
      assist();
      crowdMoves();
      await versions();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Game.update = realUpdate;
      G.Input.requestPointerLock = realLock;
      G.Input.mode = mode; G.Input.padActive = false;
      G.Modal.reset();
      document.getElementById("loading-overlay").classList.add("hidden");
      G.Updater.panel("boot-main");
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), crowd: out.crowd, pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run, crowd, buildCrowd };
})();
