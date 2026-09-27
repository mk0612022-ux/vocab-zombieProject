// Dev-only (not shipped). Frame cost of the school at a few places, per
// graphics quality: the game's own update plus the render, the GPU made to
// finish every frame (a one-pixel read-back), with a wave of zombies about.
// It measures THIS machine; a phone has to be tried on the phone.
//   await G.PerfMeasure.run(["low", "high"])  -> rows of {quality, spot, ms, fps, calls, tris, zombies}
window.G = window.G || {};
G.PerfMeasure = {
  SPOTS: [
    { name: "front yard", x: 0, y: 0, z: 44, yaw: 0 },
    { name: "football field", x: -40, y: 0, z: -2, yaw: 0.6 },
    { name: "garden", x: 40, y: 0, z: -20, yaw: -1.2 },
    { name: "corridor F1", x: 0, y: 0, z: 10, yaw: 0 },
    { name: "classroom F2", x: -10, y: 4.2, z: -12, yaw: 1.5 },
    { name: "corridor F3", x: 0, y: 8.4, z: -30, yaw: 0 },
  ],
  async run(qualities, frames) {
    const g = G.Game, rows = [];
    frames = frames || 90;
    const saved = JSON.stringify(G.save);
    const gl = g.renderer.getContext(), px = new Uint8Array(4);
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    try {
      for (const q of qualities) {
        G.save.tutorialDone = true;
        G.save.settings.graphicsQuality = q;
        g.startLevel(1);
        g.applyGraphicsQuality();
        const upd = g.update;
        g.player.hp = g.player.maxHp = 1e6;
        if (g.world.secondFloor) g.world.secondFloor.unlocked = true;
        if (g.world.thirdFloor) g.world.thirdFloor.unlocked = true;
        for (const s of this.SPOTS) {
          g.yawObject.position.set(s.x, s.y + 1.7, s.z);
          g.yawObject.rotation.y = s.yaw;
          // a crowd of twelve in view (a busy wave), the rest cleared away
          g.zombies.forEach((z) => { g.scene.remove(z.mesh); }); g.zombies = [];
          const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
          for (let k = 0; k < 12; k++) {
            const d = 5 + (k % 4) * 2.5, side = ((k * 7) % 9 - 4) * 0.9;
            const x = s.x + fx * d - fz * side, z = s.z + fz * d + fx * side;
            g.spawnZombieAt(k % 5 === 4 ? "fast" : "normal", new THREE.Vector3(x, G.getFloorHeightAt(g.world, x, z, s.y + 0.5), z), null);
          }
          g.requiredKills = 1e9;
          // warm up: the first look at a place compiles its shaders
          for (let i = 0; i < 30; i++) { upd.call(g, 1 / 60); g.renderFrame(); }
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let total = 0, calls = 0, tris = 0;
          for (let i = 0; i < frames; i++) {
            const t0 = performance.now();
            g.yawObject.position.set(s.x, s.y + 1.7, s.z);
            upd.call(g, 1 / 60);
            g.renderFrame();
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            total += performance.now() - t0;
            calls += g.renderer.info.render.calls; tris += g.renderer.info.render.triangles;
            if (i % 30 === 29) await tick();
          }
          const ms = total / frames;
          rows.push({ quality: q, spot: s.name, ms: +ms.toFixed(2), fps: Math.round(1000 / ms), calls: Math.round(calls / frames), tris: Math.round(tris / frames), zombies: g.zombies.filter((z) => z.alive).length });
        }
      }
    } finally {
      G.save = JSON.parse(saved);
      g.quitToMainMenu();
    }
    return rows;
  },
};
