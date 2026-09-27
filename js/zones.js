// ===================================================================
// Zones (round 3, F3): only draw what the player could possibly see
// -------------------------------------------------------------------
// The school is three storeys on a campus ten times the old yard. Drawn all
// at once that is well over a thousand draw calls a frame -- far past what a
// phone or an iPad can carry at 30 FPS. Almost none of it can be seen from
// any one place, though: from a classroom you cannot see the football field,
// from the third floor you cannot see the ground floor, from the grass
// outside you cannot see the furniture behind the walls (the windows are
// solid), and nobody sees into a room whose door is shut. So everything
// static in the level is sorted, once, into:
//
//   "O"        outdoors: the campus, the grass, the trees
//   "S"        the shell: the outer walls, which are a room's wall on the
//              inside and the building's face on the outside
//   "X"        outside only: the render and windows on the outer walls, the
//              roofs, the facade -- nothing of it faces a room
//   "Iab"      indoors, on storeys a to b (a double-height wall is "I12")
//   "Iab:W3"   ...and inside one room with a door: only there, or seen
//              through that door while it is open
//
// G.Perf.mergeStatic keeps those apart when it bakes the level (world.zoneKey)
// and this file decides, a few times a second and whenever a door moves,
// which of them are drawn:
//
//   outdoors    the campus and the shell; the building's insides only where
//               the front doors look into the entry hall
//   indoors     the storey the player is on (and the ones above and below
//               near the places you can see through: the entry hall and its
//               gallery, the stairwell); rooms only from inside them or
//               through an open door; the shell; the campus only from the
//               entry hall, through the front doors
//   everywhere  nothing past the fog, a hard edge the eye cannot see past
//
// Hiding is done with layers, not `visible`: game code hides and shows some
// of these objects itself (an opened crate, a taken key) and must not have
// that undone. A culled object sits on no layer, so the camera skips it and
// so does every raycast -- which is fine, as nothing culled is ever within
// arm's reach.
// ===================================================================
G.Zones = {
  _b: new THREE.Box3(),
  _tmp: [],
  dirty: true,

  // ---- sorting (before the merge) ----------------------------------------
  prepare(world) {
    world.zoneKey = null;
    if (!world.footprint) return;                     // only the school has zones
    // the rooms with doors: what is inside one is seen only through them
    const gated = new Set();
    (world.roomDoors || []).forEach((d) => {
      [-0.7, 0.7].forEach((n) => {
        const x = d.axis === "z" ? d.x + n : d.x, z = d.axis === "z" ? d.z : d.z + n;
        const r = world.regions.find((g) => x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ && Math.abs((g.y || 0) - (d.baseY || 0)) < 1);
        if (r && !/^(C\d|ENTRY|GAL|YARD)/.test(r.name)) { gated.add(r.name); (d.rooms = d.rooms || []).push(r.name); }
      });
    });
    world._gated = gated;
    world._zoneRegs = world.regions.filter((r) => !/^YARD/.test(r.name)).map((r) => ({
      name: r.name, minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, y0: (r.y || 0) - 0.5, y1: (r.y || 0) + 4.35,
    }));
    world.zoneKey = (o) => {
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      return this.keyOfBox(world, this._b.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
    };
  },
  keyOfBox(world, b) {
    const c = this.classOf(world, b);
    if (c.cls !== "I") return c.cls;
    const [s0, s1] = this.storeys(world, b);
    return "I" + s0 + s1 + (c.room && world._gated.has(c.room) ? ":" + c.room : "");
  },
  storeys(world, b) {
    const Y = world.storeyY || [0, 4.2, 8.4];
    const s = (y) => (y < Y[1] - 0.45 ? 1 : y < Y[2] - 0.45 ? 2 : 3);
    const s0 = s(b.min.y + 0.05), s1 = Math.max(s0, s(b.max.y - 0.5));
    return [s0, s1];
  },
  inRegions(world, x, y, z) {
    for (const r of world._zoneRegs) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && y >= r.y0 && y <= r.y1) return true;
    return false;
  },
  inSolid(world, x, y, z) {
    for (const c of G.ColGrid.near(world, x, z, 0.1, this._tmp)) {
      if (x >= c.min.x && x <= c.max.x && y >= c.min.y && y <= c.max.y && z >= c.min.z && z <= c.max.z) return true;
    }
    return false;
  },
  classOf(world, b) {
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    if (!world.footprint.some((f) => cx > f.minX - 2 && cx < f.maxX + 2 && cz > f.minZ - 2 && cz < f.maxZ + 2)) return { cls: "O" };
    // quick: the whole thing inside one room, corridor or hall -- the
    // highest one it stands in (a floor slab is inside the volume of the room
    // below it as well as the one it is the floor of)
    let best = null;
    for (const r of world._zoneRegs) {
      if (b.min.x >= r.minX - 0.05 && b.max.x <= r.maxX + 0.05 && b.min.z >= r.minZ - 0.05 && b.max.z <= r.maxZ + 0.05 && b.min.y >= r.y0 && b.max.y <= r.y1) {
        if (r.y0 + 0.5 <= b.min.y + 0.5 && (!best || r.y0 > best.y0)) best = r;
      }
    }
    if (best) return { cls: "I", room: best.name };
    // otherwise: does any of its sides look out at open air? Points just
    // off each side, low, middle and high: one that is in no room and inside
    // no wall is outside the building.
    const ys = [b.min.y + 0.1, (b.min.y + b.max.y) / 2, b.max.y - 0.1];
    const nx = Math.max(2, Math.ceil((b.max.x - b.min.x) / 3)), nz = Math.max(2, Math.ceil((b.max.z - b.min.z) / 3));
    const pts = [];
    for (let i = 0; i <= nx; i++) { const x = b.min.x + (b.max.x - b.min.x) * i / nx; pts.push([x, b.min.z - 0.06], [x, b.max.z + 0.06]); }
    for (let i = 0; i <= nz; i++) { const z = b.min.z + (b.max.z - b.min.z) * i / nz; pts.push([b.min.x - 0.06, z], [b.max.x + 0.06, z]); }
    // A face out in the open makes it part of the shell; the shell pieces
    // with no face on a room at all (the render and windows on the outside,
    // the roofs, the facade) are "X", needed only from outdoors.
    let exposed = false, inward = false;
    for (const [x, z] of pts) for (const y of ys) {
      if (this.inRegions(world, x, y, z)) { inward = true; continue; }
      if (this.inSolid(world, x, y, z)) continue;
      exposed = true;
    }
    // ...and its top, if nothing is above it (a roof, a parapet)
    if (!exposed && b.max.y > (world.storeyY ? world.storeyY[1] : 4.2) * 2 + 0.2 && !this.inRegions(world, cx, b.max.y + 0.3, cz)) exposed = true;
    if (exposed) return { cls: inward ? "S" : "X" };
    return { cls: "I" };
  },

  // ---- after the merge: everything the level put in the scene -------------
  init(game) {
    const world = game.world;
    this.items = [];
    this._t = 0;
    this._last = "";
    this.dirty = true;
    if (!world || !world.footprint) return;
    const b = new THREE.Box3();
    game.scene.children.forEach((o) => {
      if (o === game.yawObject || o.isLight || o.frustumCulled === false) return;
      b.setFromObject(o);
      if (b.isEmpty()) return;
      const meshes = [];
      o.traverse((c) => { if (c.isMesh || c.isPoints || c.isLine) meshes.push(c); });
      if (!meshes.length) return;
      const zone = o.userData.zone || this.keyOfBox(world, b);
      const it = { obj: o, meshes, box: b.clone(), zone, on: true, cls: zone[0] };
      if (it.cls === "I") { it.s0 = +zone[1]; it.s1 = +zone[2]; const k = zone.indexOf(":"); it.room = k > 0 ? zone.slice(k + 1) : null; }
      this.items.push(it);
    });
    // the doors of each gated room
    this.doorsOf = {};
    (world.roomDoors || []).forEach((d) => (d.rooms || []).forEach((r) => (this.doorsOf[r] = this.doorsOf[r] || []).push(d)));
    const fp = world.footprint[0];
    this.front = new THREE.Vector3(0, 0, fp.maxZ);
    // where you can see from one storey to the next: the entry hall with its
    // gallery, and the stairwell up to the third floor
    this.openings = [{ x: 0, z: (world.entryHall ? world.entryHall.cz : fp.maxZ - 6.7), r: 17 }];
    if (world.stairSlot) { const s = world.stairSlot; this.openings.push({ x: (s.xIn + s.xOut) / 2, z: (s.zN + s.zS) / 2, r: 10 }); }
  },

  // ---- a few times a second (and when a door moves): what is drawn --------
  update(game, force) {
    if (!this.items || !this.items.length) return;
    this._t -= 1 / 60;
    const p = game.yawObject.position, feet = p.y - 1.7;
    const region = G.getRegionAt(game.world, p.x, p.z, feet) || "";
    const key = region + "|" + Math.round(p.x / 3) + "|" + Math.round(p.z / 3) + "|" + Math.round(feet);
    if (!force && !this.dirty && this._t > 0 && key === this._last) return;
    this._t = 0.25; this._last = key; this.dirty = false;
    const Y = game.world.storeyY || [0, 4.2, 8.4];
    const inside = !/^YARD/.test(region);
    const storey = feet < Y[1] - 1 ? 1 : feet < Y[2] - 1 ? 2 : 3;
    const nearOpen = this.openings.filter((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 4);
    const dFront = Math.hypot(p.x - this.front.x, p.z - this.front.z);
    // outdoors near the doors you see into the hall; in the hall you see out
    const seeIn = !inside && dFront < 34;
    const seeOut = !inside || region === "ENTRY" || region === "GAL" || (region === "C1S" && p.z > 14);
    const fog = game.scene.fog ? game.scene.fog.far : 60;
    const far = fog + 8;
    const open = (room) => (this.doorsOf[room] || []).some((d) => d.open || d.p > 0.02);
    // the two halves of the stairwell are one space, open to each other
    const stair = (r) => r === "STW" || r === "STT" || r === "LANDING3";
    const same = (room) => room === region || (stair(region) && stair(room));
    const boxDist = (b, x, z) => Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z));
    let drawn = 0;
    for (const it of this.items) {
      const b = it.box;
      let on = boxDist(b, p.x, p.z) < far;
      if (on) {
        if (it.cls === "O" || it.cls === "X") on = seeOut;
        else if (it.cls === "I") {
          if (inside) {
            on = it.s1 >= storey && it.s0 <= storey;
            // up or down a storey only through the openings
            if (!on && it.s1 >= storey - 1 && it.s0 <= storey + 1) on = nearOpen.some((o) => boxDist(b, o.x, o.z) < o.r);
          } else on = seeIn && it.s0 <= 2 && boxDist(b, this.front.x, this.front.z) < 24;
          if (on && it.room && !same(it.room)) on = open(it.room);
        }
      }
      if (on) drawn++;
      if (on === it.on) continue;
      it.on = on;
      for (const m of it.meshes) m.layers.mask = on ? 1 : 0;
    }
    this.drawn = drawn;
    this.state = { region, inside, storey, open: nearOpen.length, seeIn, seeOut };
  },

  reset() { this.items = []; this._last = ""; this.dirty = true; },
};
