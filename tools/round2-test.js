// Dev-only (not shipped). Round 2 checks: spawn points and their props on
// all three levels, emerging (no bite, no label, shootable only above the
// floor), the head hitbox, both kinds of death and their clean-up, the pools,
// outfits by level and body shape by type. The save is put back afterwards.
//   const r = await G.Round2Test.run();   r.fail -> []
window.G = window.G || {};
G.Round2Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  function fresh(level) {
    const g = G.Game;
    G.save.tutorialDone = true;
    g.startLevel(level);
    g.update = function () {};
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    return g;
  }
  const step = (g, sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { fn && fn(); g.updateZombies(1 / 60); G.ZombieFX.updateDying(g, 1 / 60); G.ZombieFX.update(g, 1 / 60); } };

  function spawnPoints() {
    const kindsBy = {};
    for (const lvl of [1, 2, 3]) {
      const g = fresh(lvl), w = g.world;
      const sps = w.spawnPoints;
      ok(`L${lvl}: every spawn point has a way in`, sps.every((sp) => sp.emerge && sp.kind && sp.emerge.end));
      const kinds = {};
      sps.forEach((sp) => { kinds[sp.kind] = (kinds[sp.kind] || 0) + 1; });
      kindsBy[lvl] = kinds;
      // no prop in a doorway, none inside a wall, nothing stuck in the spot it emerges to
      const doors = w.roomDoors || [];
      const badDoor = sps.filter((sp) => sp.emerge.prop && doors.some((d) => Math.abs((d.baseY || 0) - sp.emerge.floorY) < 1.5 && Math.hypot(d.x - sp.pos.x, d.z - sp.pos.z) < (d.width || 3) / 2 + 0.6));
      ok(`L${lvl}: no emerge spot in a doorway`, badDoor.length === 0, badDoor.map((s) => s.kind).join(","));
      const box = new THREE.Box3();
      const stuck = sps.filter((sp) => sp.types[0] !== "boss").filter((sp) => {
        const p = sp.pos;
        box.min.set(p.x - 0.3, p.y + 0.2, p.z - 0.3); box.max.set(p.x + 0.3, p.y + 1.6, p.z + 0.3);
        return w.colliders.some((c) => c.intersectsBox(box));
      });
      ok(`L${lvl}: every zombie steps out onto free floor`, stuck.length === 0, stuck.map((s) => s.kind + "@" + s.pos.toArray().map((n) => n.toFixed(1))).join(" "));
      // no prop collider over a waypoint node (routes steer for those)
      const onNode = Object.entries(w.waypointNodes).filter(([, n]) => {
        box.min.set(n.x - 0.3, (n.y || 0) + 0.2, n.z - 0.3); box.max.set(n.x + 0.3, (n.y || 0) + 1.6, n.z + 0.3);
        return sps.some((sp) => sp.emerge.prop && sp.emerge.prop.group && new THREE.Box3().setFromObject(sp.emerge.prop.group).intersectsBox(box));
      }).map(([k]) => k);
      ok(`L${lvl}: no desk or locker on a waypoint`, onNode.length === 0, onNode.join(","));
      if (lvl === 3) ok("L3 (underground): no windows", !kinds.window);
      if (lvl === 1) ok("L1: the yard spawns come up out of the ground", sps.filter((s) => s.pos.z > 34).every((s) => s.kind === "ground"));
    }
    ok("all five ways in are used", ["ground", "locker", "vent", "window", "desk"].every((k) => Object.values(kindsBy).some((m) => m[k])), JSON.stringify(kindsBy));
    return kindsBy;
  }

  function emerging() {
    const g = fresh(1), w = g.world;
    for (const kind of ["ground", "locker", "vent", "window", "desk"]) {
      const sp = w.spawnPoints.find((s) => s.kind === kind && !s.gate && s.types[0] !== "boss");
      if (!sp) { ok(`${kind}: found`, false); continue; }
      sp.cooldown = 0;
      g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
      const z = g.spawnZombieAt("normal", sp.pos, sp);
      // stand right where it will come out, and see that it cannot bite yet
      const P = g.yawObject.position;
      P.set(sp.pos.x + 0.6, sp.emerge.floorY + 1.7, sp.pos.z + 0.4);
      const hp0 = g.player.hp;
      let labelShown = false, bit = false, frames = 0;
      while (z.emerge && frames < 200) {
        g.updateZombies(1 / 60); frames++;
        if (z.emerge && z.sprite.visible) labelShown = true;
        if (g.player.hp < hp0) bit = true;
      }
      const secs = frames / 60;
      ok(`${kind}: takes ${secs.toFixed(2)} s (1-1.5)`, secs >= 1.0 && secs <= 1.6);
      ok(`${kind}: cannot bite while coming in`, !bit);
      ok(`${kind}: label hidden until it is in, shown after`, !labelShown && z.sprite.visible);
      ok(`${kind}: arrives where planned, upright`, z.mesh.position.distanceTo(sp.emerge.end) < 0.01 && Math.abs(z.mesh.rotation.x) < 1e-6);
      z.attackCooldown = 0;
      step(g, 0.6);
      ok(`${kind}: bites once it is in`, g.player.hp < hp0);
    }
    // shootable while emerging -- but not the part still under the floor
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    const sp = w.spawnPoints.find((s) => s.kind === "ground" && s.types[0] !== "boss");
    sp.cooldown = 0;
    const z = g.spawnZombieAt("normal", sp.pos, sp);
    for (let i = 0; i < 18; i++) G.ZombieFX.step(g, z, 1 / 60);          // hands just out
    const origin = new THREE.Vector3(sp.pos.x, 1.7, sp.pos.z + 5);
    const hpA = z.hp;
    g.raycastShoot(origin, new THREE.Vector3(sp.pos.x, sp.emerge.floorY - 0.8, sp.pos.z).sub(origin).normalize(), 5, 0, null);
    ok("emerging: the buried part can't be hit", z.hp === hpA);
    for (let i = 0; i < 50; i++) G.ZombieFX.step(g, z, 1 / 60);          // chest out
    z.mesh.updateMatrixWorld(true);
    const chest = new THREE.Vector3(); z.mesh.userData.upper.getWorldPosition(chest); chest.y += 0.3;
    const dir = chest.clone().sub(origin).normalize();
    const hit = g.raycastShoot(origin, dir, 5, 0, null);
    ok("emerging: the part out of the ground can be shot", hit && z.hp < hpA, z.hp + " / " + hpA);
  }

  function hitsAndDeaths() {
    const g = fresh(1);
    const P = g.yawObject.position;
    const put = (type) => {
      const at = P.clone().add(new THREE.Vector3(0, 0, -4)); at.y = G.getFloorHeightAt(g.world, at.x, at.z, P.y - 1.7);
      const z = g.spawnZombieAt(type || "normal", at);
      z.mesh.rotation.y = 0; z.animate(1 / 60, 0); z.mesh.updateMatrixWorld(true);
      return z;
    };
    const aimAt = (obj, dy) => { const v = new THREE.Vector3(); obj.getWorldPosition(v); v.y += dy || 0; return v; };
    const origin = P.clone();
    // head vs body damage
    let z = put(); z.hp = 1000;
    const headP = aimAt(z.mesh.userData.neck, 0.18);
    g.raycastShoot(origin, headP.clone().sub(origin).normalize(), 10, 0, null);
    const headDmg = 1000 - z.hp;
    const goldMarker = document.getElementById("hud-hitmarker").classList.contains("head");
    z.hp = 1000;
    const bodyP = aimAt(z.mesh.userData.upper, 0.3);
    g.raycastShoot(origin, bodyP.clone().sub(origin).normalize(), 10, 0, null);
    const bodyDmg = 1000 - z.hp;
    ok("head hitbox: a head hit does double damage", headDmg === 20 && bodyDmg === 10, headDmg + " vs " + bodyDmg);
    ok("head hitbox: a headshot turns the hitmarker gold", goldMarker);
    g.zombies.forEach((zz) => g.scene.remove(zz.mesh)); g.zombies = [];
    // body kill: gone at once, blocks and smoke
    const geomBefore = g.renderer.info.memory.geometries;
    z = put();
    g.raycastShoot(origin, aimAt(z.mesh.userData.upper, 0.3).sub(origin).normalize(), 999, 0, null);
    ok("body kill: the zombie is taken out of the scene at once", !z.mesh.parent);
    ok("body kill: it bursts into blocks", G.ZombieFX._blocks && G.ZombieFX._blocks.live >= 10, G.ZombieFX._blocks && G.ZombieFX._blocks.live);
    step(g, 1.5);
    ok("body kill: the blocks turn to smoke, then are gone", G.ZombieFX._blocks.live === 0 && G.ZombieFX._smoke.live > 0);
    step(g, 2.5);
    ok("body kill: the smoke clears", G.ZombieFX._smoke.live === 0);
    // head kill: head off along the shot, body drops, then both break up
    z = put();
    const shot = aimAt(z.mesh.userData.neck, 0.18).sub(origin).normalize();
    g.raycastShoot(origin, shot, 999, 0, null);
    const d = G.ZombieFX.dying[0];
    ok("head kill: head comes off (a separate object in the scene)", d && d.mode === "decap" && d.head.obj.parent === g.scene);
    const h0 = d.head.obj.position.clone();
    step(g, 0.3);
    const moved = d.head.obj.position.clone().sub(h0);
    ok("head kill: it flies along the shot", moved.x * shot.x + moved.z * shot.z > 0.3, moved.toArray().map((n) => n.toFixed(2)).join(","));
    ok("head kill: the body buckles", z.mesh.position.y < d.baseY - 0.2);
    let minY = 99; for (let i = 0; i < 40; i++) { step(g, 1 / 60); minY = Math.min(minY, d.head.obj.position.y); }
    ok("head kill: the head lands on the floor, not through it", minY >= d.floorY + 0.15 - 1e-6, minY.toFixed(2));
    step(g, 0.8);
    ok("head kill: after ~1.25 s both break into blocks and are gone", G.ZombieFX.dying.length === 0 && !z.mesh.parent && !d.head.obj.parent);
    step(g, 4);
    // (loot drops and the hit-spark pool, which grows to 24, are not left-overs)
    const countObjs = () => { let n = 0; g.scene.traverse((o) => { if (!o.isPoints && !g.drops.some((d) => d.mesh === o || d.mesh === o.parent)) n++; }); return n; };
    const objsBefore = countObjs();
    // pools stay bounded however many die at once
    for (let i = 0; i < 30; i++) { const zz = put(i % 3 === 2 ? "fast" : "normal"); zz.mesh.position.x += (i % 6) - 3; zz.hp = 0; zz.alive = false; zz._lastHit = { head: i % 2 === 0, dir: new THREE.Vector3(0, 0, -1) }; g.onZombieDeath(zz); }
    step(g, 1.4);
    ok("30 deaths at once: pools stay within their size", G.ZombieFX._blocks.live <= 260 && G.ZombieFX._smoke.live <= 120, G.ZombieFX._blocks.live + " / " + G.ZombieFX._smoke.live);
    step(g, 5);
    ok("...and everything is cleaned up afterwards", G.ZombieFX.dying.length === 0 && G.ZombieFX._blocks.live === 0 && G.ZombieFX._smoke.live === 0);
    const objsAfter = countObjs();
    ok("30 deaths leave nothing behind in the scene (object count)", objsAfter === objsBefore, objsBefore + " -> " + objsAfter);
    void geomBefore;
    // quality decides how many blocks a death makes
    const count = (q) => { G.save.settings.graphicsQuality = q; const before = G.ZombieFX._blocks.live; const zz = put(); zz.hp = 0; zz.alive = false; zz._lastHit = { head: false }; g.onZombieDeath(zz); const n = G.ZombieFX._blocks.live - before; step(g, 3); return n; };
    const nLow = count("vlow"), nHigh = count("vhigh");
    G.save.settings.graphicsQuality = "high";
    ok("quality: fewer blocks on Very Low than Very High", nLow < nHigh && nLow <= 8, nLow + " vs " + nHigh);
  }

  function looks() {
    const byTheme = {};
    for (const [lvl, theme] of [[1, "school"], [2, "hospital"], [3, "bunker"]]) {
      const outfits = new Set(), skins = new Set();
      for (let i = 0; i < 60; i++) { const L = G.randomZombieLook("normal", theme); outfits.add(L.outfit); skins.add(L.skin.getHexString()); }
      const want = G.ZOMBIE_OUTFITS[theme].map((o) => o.key);
      byTheme[theme] = Array.from(outfits);
      ok(`${theme}: only its own outfits, all of them`, want.every((k) => outfits.has(k)) && Array.from(outfits).every((k) => want.includes(k)), Array.from(outfits).join(","));
      ok(`${theme}: 60 zombies, 60 different skin colours`, skins.size >= 58, skins.size);
    }
    // every skin still reads as dead: low saturation, never a healthy tone
    const hsl = {};
    let sat = 0;
    for (let i = 0; i < 200; i++) { G.randomZombieLook("normal", "school").skin.getHSL(hsl); sat = Math.max(sat, hsl.s); }
    ok("skin: all from the five dead tones (saturation stays low)", sat < 0.45, sat.toFixed(2));
    // the spawned zombies use their level's wardrobe
    const g = fresh(2);
    const zs = []; for (let i = 0; i < 8; i++) zs.push(g.spawnZombieAt("normal", g.yawObject.position.clone().add(new THREE.Vector3(i, -1.7, -4))));
    ok("a hospital run spawns hospital outfits", zs.every((z) => ["patient", "nurse", "doctor"].includes(z.look.outfit)));
    // type by shape, not colour: measure them
    const size = (type) => {
      const m = G.buildZombieMesh(type, null, G.randomZombieLook(type, "school"));
      m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(m);
      const s = bb.getSize(new THREE.Vector3());
      s.y = bb.max.y;                    // how tall it stands (a crawler's resting arms hang below its origin)
      G.disposeObject3D(m);
      return s;
    };
    const n = size("normal"), f = size("fast"), c = size("crawler"), b = size("boss");
    ok("shape: fast is slighter than normal", f.x < n.x * 0.9 && f.y < n.y, `${f.x.toFixed(2)}x${f.y.toFixed(2)} vs ${n.x.toFixed(2)}x${n.y.toFixed(2)}`);
    ok("shape: crawler is low and long", c.y < 0.9 && c.z > c.y, `${c.y.toFixed(2)} tall, ${c.z.toFixed(2)} long`);
    ok("shape: boss is three times the size", b.y > n.y * 2.7, b.y.toFixed(2));
    return byTheme;
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save);
    const realUpdate = G.Game.update;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    let kinds = null, looksBy = null;
    try {
      kinds = spawnPoints();
      emerging();
      hitsAndDeaths();
      looksBy = looks();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Game.update = realUpdate;
      G.Modal.reset();
      G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), kinds, looks: looksBy, pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
