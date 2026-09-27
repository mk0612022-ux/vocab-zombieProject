// Dev-only (not shipped). Frame strips of the round 2 zombie effects, shown
// full-window over the game so a screenshot of the page captures them:
//   R2View.emerge(level, kind, type, [times])   a zombie coming in
//   R2View.death(level, "body" | "head", [times]) a kill, frame by frame
//   R2View.lineup(level)                          twelve zombies side by side
//   R2View.hide()                                 back to the game
window.R2View = (function () {
  function setup(lvl) {
    const g = G.Game;
    G.save.tutorialDone = true;
    g.startLevel(lvl);
    g.update = function () {};
    g.player.hp = g.player.maxHp = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = []; g.requiredKills = 1e9;
    G.UI.setHudVisible(false); G.UI.showScreen(null);
    // no gun in the way: the hand-stepped frames never pose it
    if (g.vmCamera) { R2View._vm = g.vmCamera; g.vmCamera = null; }
    return g;
  }
  function look(cam, tgt) {
    const g = G.Game;
    g.yawObject.position.set(cam.x, cam.y, cam.z);
    const dx = tgt.x - cam.x, dz = tgt.z - cam.z, dy = tgt.y - cam.y;
    g.yawObject.rotation.y = Math.atan2(-dx, -dz);
    g.pitchObject.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
    g.scene.updateMatrixWorld(true);
  }
  function camFor(sp) {
    const E = sp.emerge, end = E.end;
    const dir = E.n ? E.n.clone() : E.f ? E.f.clone() : new THREE.Vector3(1, 0, 0.6).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const cam = end.clone().addScaledVector(dir, 3.2).addScaledVector(side, 1.4);
    cam.y = E.floorY + 1.7;
    const tgt = end.clone(); tgt.y = E.floorY + (E.kind === "vent" ? 1.8 : 1.0);
    return { cam, tgt };
  }
  function show(cv) {
    let el = document.getElementById("__sheet"); if (el) el.remove();
    el = document.createElement("img"); el.id = "__sheet"; el.src = cv.toDataURL("image/jpeg", 0.85);
    el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:9999;background:#111";
    document.body.appendChild(el);
  }
  function sheet(n) {
    const g = G.Game, W = 400, H = 225, cols = 3, rows = Math.ceil(n / cols);
    g.renderer.setSize(W * 2, H * 2, false); g.camera.aspect = W / H; g.camera.updateProjectionMatrix();
    const cv = document.createElement("canvas"); cv.width = W * cols; cv.height = (H + 20) * rows;
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
    return {
      cv, shot(i, label) {
        g.scene.updateMatrixWorld(true); g.renderFrame();
        const x = (i % cols) * W, y = Math.floor(i / cols) * (H + 20);
        ctx.drawImage(g.renderer.domElement, x, y, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "14px sans-serif"; ctx.fillText(label, x + 6, y + H + 15);
      },
    };
  }
  function run(g, z, from, to) {
    let t = from;
    while (t < to - 1e-6) {
      const dt = Math.min(1 / 60, to - t);
      if (z && z.alive) { if (z.emerge) G.ZombieFX.step(g, z, dt); else z.animate(dt, 0); }
      G.ZombieFX.updateDying(g, dt);
      G.ZombieFX.update(g, dt);
      t += dt;
    }
    return t;
  }
  return {
    emerge(lvl, kind, type, times) {
      const g = setup(lvl);
      const sp = g.world.spawnPoints.find((s) => s.kind === kind && !s.gate) || g.world.spawnPoints.find((s) => s.kind === kind);
      if (!sp) return "no " + kind;
      sp.cooldown = 0;
      const v = camFor(sp); look(v.cam, v.tgt);
      times = times || [0.05, 0.25, 0.5, 0.8, 1.1, 1.6];
      const S = sheet(times.length);
      const z = g.spawnZombieAt(type || "normal", sp.pos, sp);
      let t = 0;
      times.forEach((T, i) => { t = run(g, z, t, T); S.shot(i, `${kind} ${type || "normal"} t=${T.toFixed(2)}s${z.emerge ? "" : " (in)"}${z.sprite.visible ? " +label" : ""}`); });
      show(S.cv);
      return { kind: sp.kind, at: sp.pos.toArray().map((n) => +n.toFixed(1)) };
    },
    death(lvl, how, times, type) {
      const g = setup(lvl);
      const p = g.yawObject.position;
      const fwd = new THREE.Vector3(0, 0, -1);
      const at = p.clone().addScaledVector(fwd, 4); at.y = G.getFloorHeightAt(g.world, at.x, at.z, p.y - 1.7);
      const z = g.spawnZombieAt(type || "normal", at);
      z.mesh.rotation.y = 0;
      look(new THREE.Vector3(at.x + 1.5, at.y + 1.45, at.z + 2.3), at.clone().setY(at.y + 0.8).add(new THREE.Vector3(0.3, 0, -0.4)));
      times = times || [0.02, 0.1, 0.3, 0.6, 1.0, 1.5];
      const S = sheet(times.length);
      z.animate(1 / 60, 0);
      g.damageZombie(z, 9999, at.clone().setY(at.y + 1.5), { dir: new THREE.Vector3(0.3, 0, -1).normalize(), head: how === "head" });
      let t = 0;
      times.forEach((T, i) => { t = run(g, null, t, T); S.shot(i, `${how} kill t=${T.toFixed(2)}s`); });
      show(S.cv);
      return { dying: G.ZombieFX.dying.length, blocks: G.ZombieFX._blocks ? G.ZombieFX._blocks.live : 0, smoke: G.ZombieFX._smoke ? G.ZombieFX._smoke.live : 0 };
    },
    lineup(lvl, types) {
      const g = setup(lvl);
      // indoors, in the open boss hall: no grass in the way of the legs
      const E = g.world.regions.find((r) => r.name === "BOSS");
      const base = new THREE.Vector3((E.minX + E.maxX) / 2, 0, (E.minZ + E.maxZ) / 2 + 1);
      types = types || ["normal", "normal", "normal", "fast", "normal", "crawler", "normal", "fast", "normal", "normal", "crawler", "fast"];
      const zs = types.map((ty, i) => {
        const at = base.clone().add(new THREE.Vector3((i - (types.length - 1) / 2) * 0.95, 0, (i % 2) * 0.6));
        at.y = G.getFloorHeightAt(g.world, at.x, at.z, 0);
        const z = g.spawnZombieAt(ty, at);
        z.mesh.rotation.set(0, Math.PI - 0.0, 0);
        z.sprite.visible = false;
        for (let k = 0; k < 20; k++) z.animate(1 / 60, 0);
        return z;
      });
      look(new THREE.Vector3(base.x, 1.3, base.z + 5.2), new THREE.Vector3(base.x, 0.85, base.z));
      const g2 = G.Game;
      g2.renderer.setSize(1600, 800, false); g2.camera.aspect = 2; g2.camera.updateProjectionMatrix();
      g2.scene.updateMatrixWorld(true); g2.renderFrame();
      const cv = document.createElement("canvas"); cv.width = 1600; cv.height = 800;
      cv.getContext("2d").drawImage(g2.renderer.domElement, 0, 0);
      show(cv);
      return zs.map((z) => z.type + ":" + z.look.outfit + "/" + z.look.tone);
    },
    hide() {
      const el = document.getElementById("__sheet"); if (el) el.remove();
      if (R2View._vm) { G.Game.vmCamera = R2View._vm; R2View._vm = null; }
      G.Game.renderer.setSize(window.innerWidth, window.innerHeight);
    },
  };
})();
