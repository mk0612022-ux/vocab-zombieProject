// Dev-only (not shipped). The same views of the school before and after a
// round of visual work (newer list, round 3): windows from inside and out,
// the grass, a line of zombies, a classroom, a corridor. Each is drawn with
// the game frozen and posted to a local receiver on port 8091 that writes it
// to screenshots/ (see the round 3 report), and the frame cost is measured
// with tools/perf-measure.js. The "before" set is shot from the previous
// commit, served from a worktree on another port, with this same file.
//   await G.LooksCapture.shoot("r3_before", "high")   -> the names written
window.G = window.G || {};
G.LooksCapture = {
  VIEWS: [
    // name, x, eye y, z, yaw, pitch
    ["window_inside", -9.2, 1.7, 13.5, Math.PI / 2 + 0.25, 0.05],
    ["window_outside", -24, 1.7, 8, -Math.PI / 2 + 0.35, 0.18],
    ["grass_field", -38, 1.7, -8, 0.5, -0.12],
    ["grass_garden", 34, 1.7, -8, -1.0, -0.18],
    ["classroom", -12.5, 1.7, 10.2, Math.PI / 2 + 0.6, -0.08],
    ["corridor", 0, 1.7, 2, 0, 0],
    ["zombies", 0, 1.7, 48, 0, -0.05],
    // (added with the round's work: a room that came out wrecked, a corridor
    // wall close to, the long side outside, the front, the zombies close up)
    ["classroom_wrecked", -4.95, 1.75, 3.5, Math.PI / 2 + 0.4, -0.12],
    ["corridor_close", -1.2, 1.7, 6, -Math.PI / 2 + 0.6, -0.05],
    ["outside_wall", -24, 1.7, -30, -Math.PI / 2 + 0.4, 0.15],
    ["front", -2, 1.7, 41.5, 0.3, 0.15],
    ["zombies_close", 0, 1.5, 48, 0, -0.12],
  ],
  // which zombies stand in the line-ups: [type, odd look] (the odd looks are
  // the round's I2; the code before it simply ignores them)
  LINE: [["normal", null], ["fast", "deformed"], ["normal", "headInHand"], ["crawler", null], ["normal", "longArm"], ["normal", "bigArm"], ["fast", null], ["normal", "deformed"]],
  CLOSE: [["normal", null], ["normal", "deformed"], ["normal", "headInHand"], ["normal", "longArm"], ["fast", "bigArm"]],
  post(name, canvas) {
    return fetch("http://localhost:8091/?name=" + name, { method: "POST", body: canvas.toDataURL("image/png"), mode: "no-cors" });
  },
  spawn(g, type, odd, at) {
    const C = G.CONFIG.zombieLooks = G.CONFIG.zombieLooks || { oddChance: 0, odd: {} };
    const saved = JSON.stringify(C);
    C.oddChance = odd ? 1 : 0; C.odd = { deformed: 0, headInHand: 0, longArm: 0, bigArm: 0 }; if (odd) C.odd[odd] = 1;
    const zb = g.spawnZombieAt(G.ZOMBIE_TYPES[type] ? type : "normal", at, null);
    Object.assign(C, JSON.parse(saved));
    if (zb) { zb.emerge = null; zb.mesh.rotation.y = 0; zb.speed = 0; if (zb.sprite) zb.sprite.visible = true; }
    return zb;
  },
  async shoot(prefix, quality, only) {
    const g = G.Game, out = [];
    const saved = JSON.stringify(G.save);
    const real = g._upd || g.update;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = quality || "high";
    G.Input.requestPointerLock = function () {};
    try {
      g.update = real;
      g.startLevel(1);
      g.applyGraphicsQuality();
      g.update = function () {};
      g.clearZombies();
      // (a wave that never ends: clearing the field between views must not
      // bring on the end-of-wave quiz, which pauses everything)
      g.requiredKills = 1e9;
      if (g.world.secondFloor) g.world.secondFloor.unlocked = true;
      G.UI.setHudVisible(false); G.UI.showScreen(null);
      if (G.UI.setTouchControlsVisible) G.UI.setTouchControlsVisible(false);
      const vm = g.vmCamera; g.vmCamera = null;           // no gun in the shot
      for (const [name, x, y, z, yaw, pitch] of this.VIEWS) {
        if (only && !only.includes(name)) continue;
        if (G.Modal && G.Modal.reset) G.Modal.reset();
        g.paused = false; g.state = "GAMEPLAY";
        g.clearZombies();
        g.yawObject.position.set(x, y, z);
        g.yawObject.rotation.y = yaw; g.pitchObject.rotation.x = pitch;
        if (name === "zombies") this.LINE.forEach(([k, odd], i) => this.spawn(g, k, odd, new THREE.Vector3(x - 5.6 + i * 1.6, 0, z - 5.5 - (i % 2) * 1.2)));
        if (name === "zombies_close") this.CLOSE.forEach(([k, odd], i) => this.spawn(g, k, odd, new THREE.Vector3(x - 3 + i * 1.5, 0, z - 3.2 - (i % 2) * 0.4)));
        // a few frames of the real update: lights, zones, the moon, the grass
        for (let i = 0; i < 20; i++) { real.call(g, 1 / 60); g.yawObject.position.set(x, y, z); g.yawObject.rotation.y = yaw; g.pitchObject.rotation.x = pitch; g.zombies.forEach((zb) => { zb.speed = 0; }); }
        G.Zones.update(g, true);
        g.scene.updateMatrixWorld(true);
        g.renderFrame();
        await this.post(prefix + "_" + name, g.renderer.domElement);
        out.push(prefix + "_" + name);
      }
      g.vmCamera = vm;
    } finally {
      g.update = real;
      G.save = JSON.parse(saved);
      G.UI.setHudVisible(true);
      g.quitToMainMenu();
    }
    return out;
  },
};
