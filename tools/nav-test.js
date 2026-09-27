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
    // (round 3: the school is 120 m end to end and three storeys high; from
    // the sports hall to a room on the third floor is a 200 m walk)
    opts = Object.assign({ limit: 240, from: null }, opts || {});
    const g = G.Game;
    G.save.tutorialDone = true;
    // stepped by hand: no pointer lock, or losing it (focus moving to the
    // devtools) would pause the run the way alt-tab pauses the game
    G.Input.mode = "touch";
    g.startLevel(levelId);
    const upd = g.update;
    g.update = function () {};
    // (round 3: a zombie left far behind is normally brought in again near the
    // player; here the point is whether it can walk all the way)
    g._noRelocate = true;
    const out = { level: levelId, ok: [], fail: [] };
    try {
      const w = g.world, P = g.yawObject.position;
      // open every gate: upper floor, third floor, secret room, word door
      const drop = (c) => G.ColGrid.remove(w, c);
      if (w.secondFloor) { w.secondFloor.unlocked = true; drop(w.secondFloor.barrierCollider); w.secondFloor.barrierMesh.visible = false; }
      if (w.thirdFloor) { w.thirdFloor.unlocked = true; drop(w.thirdFloor.barrierCollider); w.thirdFloor.barrierMesh.visible = false; }
      if (w.secretZone) { w.secretZone.unlocked = true; drop(w.secretZone.barricadeCollider); }
      (w.doors || []).forEach((d) => { d.opened = true; d.locked = false; drop(d.collider); });
      const regionY = {};
      w.regions.forEach((r) => { regionY[r.name] = r.y || 0; });
      const targets = [...new Set(w.regions.map((r) => r.name))].filter((n) => !opts.only || opts.only.includes(n));
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
        for (const entry of sources) {
          const src = entry.length > 2 ? entry : entry[0], srcY = entry[1];
          if (src === name) continue;
          const n = standAt(w.waypointNodes[name], regionY[name]);
          // a source is a region name, or [label, y, x, z] for a spot of its own
          const sy = Array.isArray(src) ? srcY : regionY[src];
          const s = Array.isArray(src) ? { x: src[2], z: src[3] } : standAt(w.waypointNodes[src], regionY[src]);
          g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
          g.spawnedCount = 999; g.requiredKills = 999;
          w.roomDoors.forEach((d) => { if (!d.open) g.toggleRoomDoor(d, true); });
          for (let i = 0; i < 20; i++) upd.call(g, 1 / 30);
          const py = regionY[name];
          P.set(n.x, py + 1.7, n.z); g.player.hp = 1e9;
          const z = g.spawnZombieAt("normal", new THREE.Vector3(s.x, sy, s.z));
          z.speed = 1.7; z.speedMultiplier = 1;
          let t = 0, reached = null, last = null;
          while (t < opts.limit) {
            P.set(n.x, py + 1.7, n.z);
            upd.call(g, 1 / 30); t += 1 / 30;
            const zp = z.mesh.position;
            if (Math.hypot(zp.x - n.x, zp.z - n.z) < 1.6 && Math.abs(zp.y - py) < 1.2) { reached = t; break; }
            last = zp;
          }
          const label = (Array.isArray(src) ? src[0] : src) + "->" + name;
          if (reached) out.ok.push(label + " " + reached.toFixed(0) + "s");
          else out.fail.push(label + " stuck at " + last.x.toFixed(1) + "," + last.y.toFixed(1) + "," + last.z.toFixed(1) + " (" + G.getRegionAt(w, last.x, last.z, last.y) + ")");
          // (a message, not a timer: timers in a hidden tab are throttled to
          // one a second, or one a minute after a while)
          await new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
        }
      }
    } finally {
      g.update = upd;
      g._noRelocate = false;
      g.quitToMainMenu();
    }
    return out;
  },
};
