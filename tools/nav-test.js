// ===================================================================
// Zombie navigation test (category P)
// -------------------------------------------------------------------
// For every room and hall on a level, with every gate open: stand the player
// there, spawn a zombie at the far end of the map, run the real game update
// and check it arrives. A zombie that cannot reach the player stalls the wave
// (a wave only ends when everything spawned is dead), so every region must be
// reachable from everywhere.
//
// Usage (in the game page, after loading this file):
//   await G.NavTest.run(1)   ->  { ok: [...], fail: [...] }
// ===================================================================
G.NavTest = {
  async run(levelId, opts) {
    opts = Object.assign({ limit: 120, from: null }, opts || {});
    const g = G.Game;
    G.save.tutorialDone = true;
    g.startLevel(levelId);
    const upd = g.update;
    g.update = function () {};
    const out = { level: levelId, ok: [], fail: [] };
    try {
      const w = g.world, P = g.yawObject.position;
      // open every gate: upper floor, secret room, word door
      const drop = (c) => { const i = w.colliders.indexOf(c); if (i >= 0) w.colliders.splice(i, 1); };
      if (w.secondFloor) { w.secondFloor.unlocked = true; drop(w.secondFloor.barrierCollider); w.secondFloor.barrierMesh.visible = false; }
      if (w.secretZone) { w.secretZone.unlocked = true; drop(w.secretZone.barricadeCollider); }
      (w.doors || []).forEach((d) => { d.opened = true; d.locked = false; drop(d.collider); });
      const regionY = {};
      w.regions.forEach((r) => { regionY[r.name] = r.y || 0; });
      const targets = w.regions.map((r) => r.name);
      const sources = opts.from || [["BOSS", 0], [w.regions.find((r) => r.name === "YARD") ? "YARD" : "ENTRY", 0]];
      // a node can sit inside furniture (the bunker's reactor fills the middle
      // of its boss hall): stand the player on the nearest spot a body fits
      const free = (x, z, y) => !w.colliders.some((c) => x + 0.35 >= c.min.x && x - 0.35 <= c.max.x && z + 0.35 >= c.min.z && z - 0.35 <= c.max.z && y + 2.6 >= c.min.y && y + 0.1 <= c.max.y);
      const standAt = (node, y) => {
        for (let r = 0; r < 6; r += 0.5) for (let a = 0; a < 16; a++) {
          const x = node.x + Math.cos(a / 16 * Math.PI * 2) * r, z = node.z + Math.sin(a / 16 * Math.PI * 2) * r;
          if (free(x, z, y)) return { x, z };
          if (r === 0) break;
        }
        return node;
      };
      for (const name of targets) {
        for (const [src] of sources) {
          if (src === name) continue;
          const n = standAt(w.waypointNodes[name], regionY[name]), s = standAt(w.waypointNodes[src], regionY[src]);
          g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
          g.spawnedCount = 999; g.requiredKills = 999;
          w.roomDoors.forEach((d) => { if (!d.open) g.toggleRoomDoor(d, true); });
          for (let i = 0; i < 20; i++) upd.call(g, 1 / 30);
          const py = regionY[name];
          P.set(n.x, py + 1.7, n.z); g.player.hp = 1e9;
          const z = g.spawnZombieAt("normal", new THREE.Vector3(s.x, regionY[src], s.z));
          z.speed = 1.7; z.speedMultiplier = 1;
          let t = 0, reached = null, last = null;
          while (t < opts.limit) {
            P.set(n.x, py + 1.7, n.z);
            upd.call(g, 1 / 30); t += 1 / 30;
            const zp = z.mesh.position;
            if (Math.hypot(zp.x - n.x, zp.z - n.z) < 1.6 && Math.abs(zp.y - py) < 1.2) { reached = t; break; }
            last = zp;
          }
          const label = src + "->" + name;
          if (reached) out.ok.push(label + " " + reached.toFixed(0) + "s");
          else out.fail.push(label + " stuck at " + last.x.toFixed(1) + "," + last.y.toFixed(1) + "," + last.z.toFixed(1) + " (" + G.getRegionAt(w, last.x, last.z, last.y) + ")");
          if (out.ok.length % 6 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      }
    } finally {
      g.update = upd;
      g.quitToMainMenu();
    }
    return out;
  },
};
