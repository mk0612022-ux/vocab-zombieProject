// ============================================================
// ZOMBIE FX: how a zombie arrives, and how it goes (round 2, D)
// ------------------------------------------------------------
// ARRIVING. Every spawn point is given a way in when the level is built,
// from what is actually there:
//   ground  out in the yard (and the boss, in its hall): the ground cracks,
//           dirt flies, a hand breaks the surface, then the rest follows
//   locker  a locker against a wall: the door bangs open, it steps out
//   vent    a ceiling vent: the grate drops, it falls through and lands
//   window  a broken window in an outside wall: it climbs in over the sill
//   desk    a desk: it crawls out from under it and gets up
// The prop is built at the spot (a free stretch of wall, floor or ceiling,
// clear of furniture and doorways). While it emerges (1-1.5 s) a zombie
// cannot bite, its word label stays hidden, and it can already be shot --
// though not the parts still underground or above the ceiling.
//
// GOING. A zombie has a head (the neck group) apart from its body; a head
// hit does double damage (G.HEADSHOT_MULT).
//   killed in the body: it bursts into blocks that tumble, bounce, shrink
//                       and turn to smoke
//   killed in the head: the head flies off along the shot and bounces, the
//                       body buckles at the knees and drops, then both
//                       break up into blocks and smoke
// Blocks and smoke are two InstancedMeshes -- one draw call each -- with a
// fixed pool of slots reused round-robin; how many a death uses follows the
// graphics quality.
// ============================================================
window.G = window.G || {};
G.HEADSHOT_MULT = 2;

G.ZombieFX = {
  // per death / per emergence, by graphics quality
  QUALITY: {
    vlow: { blocks: 6, smoke: 2, dirt: 4 },
    low: { blocks: 10, smoke: 4, dirt: 8 },
    medium: { blocks: 18, smoke: 7, dirt: 14 },
    high: { blocks: 28, smoke: 10, dirt: 20 },
    vhigh: { blocks: 40, smoke: 14, dirt: 28 },
  },
  q() { return this.QUALITY[(G.save && G.save.settings.graphicsQuality) || "medium"] || this.QUALITY.medium; },
  DUR: { ground: 1.35, locker: 1.1, vent: 1.2, window: 1.5, desk: 1.4 },

  // ================= spawn points =================
  // Which way in, by what the space is. A room's furnishing decides for a
  // room; anything else goes through a short rotation so neighbours differ.
  KINDS: {
    school: { classroom: "desk", office: "desk", lab: "vent", storage: "locker", canteen: "window",
      // round 3's kinds of room
      science: "vent", storeroom: "locker", library: "vent", music: "locker", art: "window", nurse: "window",
      computer: "vent", principal: "window", toilets: "vent", changing: "locker", sports: "locker", detention: "desk",
      staffoffice: "desk", meeting: "window", staff: "window", lounge: "window", archive: "vent", trophy: "vent", broadcast: "vent",
      room: ["locker", "window", "vent", "desk"], corridor: ["locker", "vent"], entry: "window", boss: "vent", hall: "window" },
    hospital: { ward: "window", office: "desk", reception: "desk", storage: "locker", morgue: "locker", lab: "vent", theatre: "vent",
      room: ["window", "locker", "vent", "desk"], corridor: ["vent", "locker"], entry: "window", boss: "vent", hall: "window" },
    // underground: no windows
    bunker: { barracks: "locker", armoury: "locker", storage: "locker", control: "desk", generator: "vent", cells: "vent",
      room: ["vent", "locker", "desk"], corridor: ["vent", "locker"], entry: "locker", boss: "vent", hall: "vent" },
  },

  planSpawnPoints(ctx) {
    const { scene, world, level, cfg } = ctx;
    const table = this.KINDS[level.theme] || this.KINDS.school;
    world.noMerge = world.noMerge || [];
    world.spawnProps = [];
    // what already stands in each space: everything short enough to be a
    // prop (walls, floors and ceilings are the space itself)
    scene.updateWorldMatrix(true, true);
    const occ = [];
    const sz = new THREE.Vector3();
    scene.traverse((o) => {
      // (not the dark "room behind" a real window: it is only there for the
      // view from outside, and stands where a zombie climbs in)
      if (!o.isMesh || o.isInstancedMesh || o.userData.zone === "Y") return;
      const b = new THREE.Box3().setFromObject(o);
      b.getSize(sz);
      if (sz.x > 5.5 || sz.z > 5.5) return;
      occ.push(b);
    });
    this._occ = occ;
    // Round 3: the school has thousands of boxes now; a spot is tested
    // against the ones near it (a throwaway G.ColGrid over props + colliders)
    this._idx = { colliders: occ.concat(world.colliders) };
    G.ColGrid.build(this._idx);
    const regionAt = (p) => world.regions.find((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ && Math.abs((r.y || 0) - p.y) < 1.5);
    const specOf = {};
    cfg.plan.forEach((s) => { specOf[s.key] = s; });
    (world.upperSpecs || []).forEach((s) => { specOf[s.key] = s; });
    const rot = { room: 0, corridor: 0 };
    const pickFrom = (list, key) => (Array.isArray(list) ? list[rot[key]++ % list.length] : list);

    world.spawnPoints.forEach((sp) => {
      const p = sp.pos, reg = regionAt(p);
      const name = reg ? reg.name : "";
      let kind;
      if (sp.types[0] === "boss" || /^YARD/.test(name) || !reg) kind = "ground";
      else if (specOf[name]) kind = table[specOf[name].type || specOf[name].furnish] || pickFrom(table.room, "room");
      else if (/^C\d/.test(name)) kind = pickFrom(table.corridor, "corridor");
      else if (name === "ENTRY") kind = table.entry;
      else if (name === "BOSS") kind = table.boss;
      else kind = pickFrom(table.room, "room");            // the rooms upstairs over the entry hall
      const floorY = G.getFloorHeightAt(world, p.x, p.z, p.y);
      const rect = reg ? { minX: reg.minX, maxX: reg.maxX, minZ: reg.minZ, maxZ: reg.maxZ } : null;
      let spec = null;
      // try the chosen way first, then the others that could work here
      const order = [kind].concat(["vent", "locker", "desk", "ground"].filter((k) => k !== kind));
      const before = world.colliders.length;
      for (const k of order) {
        if (k === "window" && level.theme === "bunker") continue;
        spec = k === "ground" ? { kind: "ground", end: new THREE.Vector3(p.x, floorY, p.z), floorY } : this.place(ctx, k, rect, p, floorY, name);
        if (spec) break;
      }
      // what was just built is in the way of the next one
      for (let i = before; i < world.colliders.length; i++) G.ColGrid.insert(this._idx, world.colliders[i]);
      const pg = spec.prop && (spec.prop.group || (spec.prop.hinge && spec.prop.hinge.parent));
      if (pg) { pg.updateWorldMatrix(true, true); G.ColGrid.insert(this._idx, new THREE.Box3().setFromObject(pg)); }
      sp.emerge = spec;
      sp.kind = spec.kind;
      sp.pos = spec.end.clone();
      if (sp.types[0] === "boss") spec.big = true;
    });
    this._occ = null; this._idx = null;
  },

  // A place for a prop of `kind` in the space `rect`, near `near`: null if
  // nothing fits.
  place(ctx, kind, rect, near, floorY, regionName) {
    if (!rect) return null;
    const { world } = ctx;
    const doors = (world.roomDoors || []).filter((d) => Math.abs((d.baseY || 0) - floorY) < 1.5);
    const nearDoor = (x, z, pad) => doors.some((d) => Math.hypot(d.x - x, d.z - z) < (d.width || 3) / 2 + pad);
    const scratch = [];
    const free = (box) => {
      if (!this._idx) return !this._occ.some((b) => b.intersectsBox(box)) && !world.colliders.some((b) => b.intersectsBox(box));
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.1;
      return !G.ColGrid.near(this._idx, cx, cz, r, scratch).some((b) => b.intersectsBox(box));
    };
    const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), new THREE.Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)));
    // a box beside a wall, in the wall's own terms: `a` along it, `n` out
    // into the room from its face
    const wallBox = (c, a0, a1, n0, n1, y0, y1) => {
      const p0 = c.at(a0, n0), p1 = c.at(a1, n1);
      return box(p0.x, floorY + y0, p0.z, p1.x, floorY + y1, p1.z);
    };
    const outside = (x, z) => !world.regions.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && Math.abs((r.y || 0) - floorY) < 1.5);

    // Round 3: the school's rooms have windows on their outer walls now
    // (js/schoolshell.js). A zombie that comes in by a window takes one of
    // them over: the glass and frame go, and the broken window goes in.
    if (kind === "window" && world.innerWindows) {
      const iw = world.innerWindows.filter((w) => !w.taken && w.region === regionName && Math.abs(w.base - floorY) < 1)
        .sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z));
      for (const w of iw) {
        const nx = -w.s;                                           // into the room
        const c = { n: new THREE.Vector3(nx, 0, 0), at: (a, n) => new THREE.Vector3(w.x + nx * n, 0, w.z + a) };
        const front = wallBox(c, -0.48, 0.48, 0.7, 1.75, 0.1, 1.8);
        if (!free(front)) continue;
        w.taken = true;
        const yaw = Math.atan2(c.n.x, c.n.z);
        // (newer list, round 3: a real window -- the zombie climbs in through
        // the opening and breaks its pane as it comes, js/glass.js)
        if (w.real) return { kind, prop: null, realWin: w, yaw, floorY, sill: w.base + 1.25, n: c.n, start: c.at(0, -0.6).setY(floorY), face: c.at(0, 0).setY(floorY), end: c.at(0, 1.2).setY(floorY) };
        w.meshes.forEach((m) => { if (m.parent) m.parent.remove(m); m.geometry.dispose(); });
        if (world.curtains) world.curtains = world.curtains.filter((cu) => !w.curtains.includes(cu));
        const prop = this.buildWindow(ctx, c.at(0, 0), yaw, floorY);
        return { kind, prop, yaw, floorY, n: c.n, start: c.at(0, -0.6).setY(floorY), face: c.at(0, 0).setY(floorY), end: c.at(0, 1.2).setY(floorY) };
      }
    }
    if (kind === "locker" || kind === "window") {
      const cands = [];
      const walls = [
        { face: rect.minX + 0.2, n: [1, 0], along: "z", lo: rect.minZ, hi: rect.maxZ },
        { face: rect.maxX - 0.2, n: [-1, 0], along: "z", lo: rect.minZ, hi: rect.maxZ },
        { face: rect.minZ + 0.2, n: [0, 1], along: "x", lo: rect.minX, hi: rect.maxX },
        { face: rect.maxZ - 0.2, n: [0, -1], along: "x", lo: rect.minX, hi: rect.maxX },
      ];
      walls.forEach((w) => {
        for (let s = w.lo + 1.1; s <= w.hi - 1.1; s += 0.8) {
          const c = {
            n: new THREE.Vector3(w.n[0], 0, w.n[1]),
            // a point `a` along the wall from this spot, `n` in from its face
            at: (a, n) => (w.along === "z" ? new THREE.Vector3(w.face + w.n[0] * n, 0, s + a) : new THREE.Vector3(s + a, 0, w.face + w.n[1] * n)),
          };
          c.p = c.at(0, 0);
          if (nearDoor(c.p.x, c.p.z, 1.5)) continue;
          // a window has to be in an outside wall: the far side is not part of the building
          if (kind === "window") {
            const o = c.at(0, -0.9);
            if (!outside(o.x, o.z)) continue;
          }
          const body = kind === "locker" ? wallBox(c, -0.52, 0.52, 0.03, 0.68, 0.05, 2.25) : wallBox(c, -0.82, 0.82, 0.03, 0.26, 0.85, 2.35);
          const front = wallBox(c, -0.48, 0.48, 0.7, 1.75, 0.1, 1.8);
          if (!free(body) || !free(front)) continue;
          c.d = Math.hypot(c.p.x - near.x, c.p.z - near.z) + G.rng() * 2;
          cands.push(c);
        }
      });
      if (!cands.length) return null;
      cands.sort((a, b) => a.d - b.d);
      const c = cands[0];
      const yaw = Math.atan2(c.n.x, c.n.z);
      if (kind === "locker") {
        const prop = this.buildLocker(ctx, c.at(0, 0.32), yaw, floorY);
        return { kind, prop, yaw, floorY, n: c.n, start: c.at(0, 0.3).setY(floorY), end: c.at(0, 1.3).setY(floorY) };
      }
      const prop = this.buildWindow(ctx, c.at(0, 0), yaw, floorY);
      return { kind, prop, yaw, floorY, n: c.n, start: c.at(0, -0.6).setY(floorY), face: c.at(0, 0).setY(floorY), end: c.at(0, 1.2).setY(floorY) };
    }

    // floor spots on a grid, nearest the spawn point first
    const spots = [];
    for (let x = rect.minX + 1.3; x <= rect.maxX - 1.3; x += 0.7) {
      for (let z = rect.minZ + 1.3; z <= rect.maxZ - 1.3; z += 0.7) spots.push({ x, z, d: Math.hypot(x - near.x, z - near.z) + G.rng() * 0.6 });
    }
    spots.sort((a, b) => a.d - b.d);
    if (kind === "vent") {
      const ceilY = this.ceilingAt(world, regionName, floorY, near);
      if (!ceilY) return null;
      for (const s of spots) {
        if (nearDoor(s.x, s.z, 1.2)) continue;
        if (!free(box(s.x - 0.6, floorY + 0.06, s.z - 0.6, s.x + 0.6, ceilY - 0.12, s.z + 0.6))) continue;
        const prop = this.buildVent(ctx, s.x, s.z, ceilY);
        return { kind, prop, yaw: G.rng() * Math.PI * 2, floorY, ceilY, start: new THREE.Vector3(s.x, ceilY - 0.3, s.z), end: new THREE.Vector3(s.x, floorY, s.z) };
      }
      return null;
    }
    if (kind === "desk") {
      // never on a waypoint (a room's node is its centre): routes -- and the
      // playtest bot -- steer for those spots
      const nodes = Object.values(world.waypointNodes || {}).filter((n) => Math.abs((n.y || 0) - floorY) < 1.5);
      for (const s of spots) {
        if (nearDoor(s.x, s.z, 2.0)) continue;
        if (nodes.some((n) => Math.hypot(n.x - s.x, n.z - s.z) < 1.8)) continue;
        const yaws = G.shuffle([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
        for (const yaw of yaws) {
          const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), r = new THREE.Vector3(f.z, 0, -f.x);
          const at = (a, n) => new THREE.Vector3(s.x + r.x * a + f.x * n, 0, s.z + r.z * a + f.z * n);
          const d0 = at(-0.75, -0.45), d1 = at(0.75, 0.45);
          const e0 = at(-0.5, 0.5), e1 = at(0.5, 2.1);
          if (!free(box(d0.x, floorY + 0.06, d0.z, d1.x, floorY + 0.85, d1.z))) continue;
          if (!free(box(e0.x, floorY + 0.06, e0.z, e1.x, floorY + 1.8, e1.z))) continue;
          const prop = this.buildDesk(ctx, s.x, s.z, yaw, floorY);
          return { kind, prop, yaw, floorY, f, start: at(0, -0.6).setY(floorY), mid: at(0, 0.15).setY(floorY), end: at(0, 0.95).setY(floorY) };
        }
      }
      return null;
    }
    return null;
  },
  // the underside of whatever roofs this spot
  ceilingAt(world, regionName, floorY, p) {
    // under the upper storey's floor slab (the entry hall's side bays)
    const slab = world.heightZones.find((h) => !h.ramp && h.height > floorY + 2 && p.x >= h.minX && p.x <= h.maxX && p.z >= h.minZ && p.z <= h.maxZ);
    if (slab) return slab.height - 0.4;
    if (regionName === "BOSS") return floorY + 4.2 + 3.4;       // the boss hall is two storeys high
    if (regionName === "ENTRY") return null;                     // open to the roof down the middle
    return floorY + 3.4;                                         // a room's or corridor's ceiling slab
  },

  // ---- the props (static parts merge with the level; moving parts do not) ----
  propMats(ctx) {
    if (this._pm && this._pm.theme === ctx.level.theme && this._pm.scene === ctx.scene) return this._pm;
    const L = (c) => new THREE.MeshLambertMaterial({ color: c });
    const t = ctx.level.theme, M = ctx.M || {};
    this._pm = {
      theme: t, scene: ctx.scene,
      locker: t === "school" ? (M.locker || [0x6f93b3]).map(L) : t === "hospital" ? [L(0xb8c2c0), L(0x9aa8a4)] : [L(0x5a6048), L(0x4a5040)],
      dark: new THREE.MeshBasicMaterial({ color: 0x07080a }),
      slat: L(0x1c1f22), handle: L(0x9aa0a6),
      frame: L(t === "hospital" ? 0xd8dcd8 : 0x5a4028),
      night: new THREE.MeshBasicMaterial({ color: 0x0d1826 }),
      glass: new THREE.MeshLambertMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.4 }),
      board: L(0x6b5236),
      desk: L(t === "bunker" ? 0x5a6048 : t === "hospital" ? 0xa9b1ad : 0x7a5535),
      deskLeg: L(0x3a3a3a),
      ventFrame: L(0x55595e), grate: L(0x7c8187),
    };
    return this._pm;
  },
  buildLocker(ctx, at, yaw, floorY) {
    const P = this.propMats(ctx), scene = ctx.scene;
    const g = new THREE.Group();
    g.position.set(at.x, floorY, at.z); g.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.15, 0.62), G.pick(P.locker));
    body.position.y = 1.075; g.add(body);
    const inside = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.02), P.dark);
    inside.position.set(0, 1.07, 0.302); g.add(inside);
    const hinge = new THREE.Group(); hinge.position.set(-0.46, 0, 0.33); g.add(hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.06, 0.035), body.material);
    door.position.set(0.46, 1.075, 0); hinge.add(door);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.01), P.slat); s.position.set(0.46, 1.85 - i * 0.07, 0.02); hinge.add(s); }
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), P.handle); h.position.set(0.82, 1.05, 0.04); hinge.add(h);
    scene.add(g);
    g.updateWorldMatrix(true, true);
    ctx.world.colliders.push(new THREE.Box3().setFromObject(body));
    // round 3: its parts as one vertex-coloured mesh on the shared zombie
    // materials -- a locker door or a grate is one draw call, not five
    if (G.Perf && G.ZOMBIE_MATS) G.Perf.mergeLocalColored(hinge, [], G.ZOMBIE_MATS);
    ctx.world.noMerge.push(hinge);
    return { hinge, open: 0, want: 0, hold: 0 };
  },
  buildWindow(ctx, at, yaw, floorY) {
    const P = this.propMats(ctx), scene = ctx.scene;
    const g = new THREE.Group();
    g.position.set(at.x, floorY, at.z); g.rotation.y = yaw;
    const add = (w, h, d, x, y, z, m, rz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (rz) b.rotation.z = rz; g.add(b); return b; };
    add(1.3, 1.2, 0.02, 0, 1.55, 0.012, P.night);                       // the dark beyond the broken pane
    add(1.5, 0.12, 0.12, 0, 2.2, 0.05, P.frame);
    add(1.62, 0.1, 0.24, 0, 0.9, 0.1, P.frame);                          // the sill it climbs over
    add(0.1, 1.3, 0.12, -0.75, 1.55, 0.05, P.frame);
    add(0.1, 1.3, 0.12, 0.75, 1.55, 0.05, P.frame);
    // what is left of the glass, in the corners
    add(0.36, 0.28, 0.01, -0.5, 2.0, 0.03, P.glass, 0.5);
    add(0.28, 0.4, 0.01, 0.55, 1.1, 0.03, P.glass, -0.35);
    add(0.2, 0.22, 0.01, 0.58, 2.0, 0.03, P.glass, 0.9);
    if (ctx.level.theme === "school" && G.rng() < 0.6) add(1.5, 0.12, 0.04, 0, 1.75, 0.08, P.board, 0.35);   // a plank nailed across, half torn off
    scene.add(g);
    // (for js/sky.js: a window the moon may shine in through; +z of the
    // group is into the room)
    (ctx.world.skyWindows = ctx.world.skyWindows || []).push({ x: at.x, z: at.z, base: floorY, nx: Math.sin(yaw), nz: Math.cos(yaw), w: 1.3, y0: 0.95, y1: 2.15 });
    return { group: g };
  },
  buildDesk(ctx, x, z, yaw, floorY) {
    const P = this.propMats(ctx), scene = ctx.scene;
    const g = new THREE.Group();
    g.position.set(x, floorY, z); g.rotation.y = yaw;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.8), P.desk); top.position.y = 0.74; g.add(top);
    [[-0.64, -0.34], [0.64, -0.34], [-0.64, 0.34], [0.64, 0.34]].forEach(([a, b]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), P.deskLeg); l.position.set(a, 0.36, b); g.add(l);
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.03), P.desk); panel.position.set(0, 0.5, -0.37); g.add(panel);
    scene.add(g);
    g.updateWorldMatrix(true, true);
    ctx.world.colliders.push(new THREE.Box3().setFromObject(g));
    return { group: g };
  },
  buildVent(ctx, x, z, ceilY) {
    const P = this.propMats(ctx), scene = ctx.scene;
    const g = new THREE.Group();
    g.position.set(x, ceilY, z);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.9), P.dark); hole.position.y = -0.012; g.add(hole);
    [[0, -0.48, 1.04, 0.08], [0, 0.48, 1.04, 0.08], [-0.48, 0, 0.08, 1.04], [0.48, 0, 0.08, 1.04]].forEach(([a, b, w, d]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), P.ventFrame); f.position.set(a, -0.03, b); g.add(f);
    });
    const hinge = new THREE.Group(); hinge.position.set(-0.44, -0.04, 0); g.add(hinge);
    const grate = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.025, 0.88), P.grate); grate.position.x = 0.44; hinge.add(grate);
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.03), P.slat); s.position.set(0.44, -0.02, -0.34 + i * 0.17); hinge.add(s); }
    scene.add(g);
    // round 3: its parts as one vertex-coloured mesh on the shared zombie
    // materials -- a locker door or a grate is one draw call, not five
    if (G.Perf && G.ZOMBIE_MATS) G.Perf.mergeLocalColored(hinge, [], G.ZOMBIE_MATS);
    ctx.world.noMerge.push(hinge);
    return { hinge, open: 0, want: 0, hold: 0 };
  },

  // ================= emerging =================
  begin(game, z, sp) {
    const E = sp && sp.emerge;
    if (!E) return;
    const scale = G.ZOMBIE_TYPES[z.type].scale || 1;
    const dur = this.DUR[E.kind] * (E.big ? 1.3 : 1);
    z.emerge = { E, t: 0, dur, scale, crawler: !!z.mesh.userData.crawler };
    z.sprite.visible = false;
    // the ones that come out of the floor face the player; the rest come in
    // the way the prop faces
    const P = game.yawObject.position;
    z.emerge.yaw = E.kind === "ground" || E.kind === "vent" ? Math.atan2(P.x - E.end.x, P.z - E.end.z) : E.yaw;
    z.mesh.rotation.set(0, z.emerge.yaw, 0);
    sp.cooldown = Math.max(sp.cooldown, dur + 1.6);
    const at = E.end.clone().setY(E.floorY + 0.4);
    const Q = this.q();
    const A = G.Audio;
    if (E.kind === "ground") {
      this.crack(game.scene, E.end, E.floorY, E.big ? 2.6 : 1.3);
      this.dirt(game, E.end, E.floorY, Math.round(Q.dirt * 0.5 * (E.big ? 2 : 1)), E.big ? 2 : 1);
      A.sfx("emerge_ground", { pos: at, big: E.big });
    } else if (E.kind === "locker") {
      E.prop.want = 1; E.prop.hold = 2.6;
      A.sfx("locker_bang", { pos: at });
    } else if (E.kind === "vent") {
      E.prop.want = 1; E.prop.hold = 3;
      this.puff(E.start.clone().setY(E.ceilY - 0.3), 2, 0.9, [0.55, 0.55, 0.52]);
      A.sfx("vent_clang", { pos: E.start });
    } else if (E.kind === "window") {
      // (a real window: its pane goes -- if it is still there)
      const shatter = !E.realWin || (G.Glass && G.Glass.breakWindow(E.realWin, E.n, true));
      if (shatter) {
        this.glass(game, E.face.clone().setY((E.sill || E.floorY + 1.1) + 0.4), E.n, Math.max(4, Math.round(Q.dirt * 0.5)));
        A.sfx("glass_break", { pos: E.face.clone().setY(E.floorY + 1.5) });
      }
    } else if (E.kind === "desk") {
      A.sfx("desk_scrape", { pos: at });
    }
    A.zombie("growl", z.type, at);
    this.poseEmerge(game, z, 0);
  },
  // true once it has fully arrived
  step(game, z, dt) {
    const M = z.emerge;
    M.t = Math.min(M.dur, M.t + dt);
    this.poseEmerge(game, z, dt);
    if (M.t < M.dur) return false;
    this.finish(z);
    return true;
  },
  finish(z) {
    const M = z.emerge;
    if (!M) return;
    z.mesh.position.copy(M.E.end);
    z.mesh.rotation.set(0, M.yaw, z.mesh.userData.baseLean || 0);
    z._faceYaw = M.yaw;
    z._lastX = z.mesh.position.x; z._lastZ = z.mesh.position.z;
    z.emerge = null;
    // its label back -- the way its clue wants it (vocabulary series, round
    // 3: a Dictation zombie has none; this used to show the English word)
    z._label = null;
    if (z.setTarget) z.setTarget(z.isTarget); else z.sprite.visible = true;
  },
  // hits on a part still below the floor or above the ceiling don't count
  hitBlocked(z, point) {
    const M = z.emerge;
    if (!M) return false;
    if (point.y < M.E.floorY - 0.02) return true;
    if (M.E.ceilY && point.y > M.E.ceilY) return true;
    return false;
  },
  poseEmerge(game, z, dt) {
    const M = z.emerge, E = M.E, t = M.t, s = M.scale, m = z.mesh;
    const L = m.userData.limbs || {};
    const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const easeIO = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    const arms = (rx, ex) => { [L.armL, L.armR].forEach((a, i) => { if (a) { a.shoulder.rotation.x = rx + (i ? 0.12 : -0.1); a.elbow.rotation.x = ex; } }); };
    const legs = (hx, kx) => { [L.legL, L.legR].forEach((l) => { if (l) { l.hip.rotation.x = hx; l.knee.rotation.x = kx; } }); };
    const up = m.userData.upper;
    const pos = m.position;
    pos.copy(E.end);
    if (E.kind === "ground") {
      // a hand breaks through first, claws, then it hauls itself up
      const depth = (M.crawler ? 1.1 : 2.15) * s, handOut = (M.crawler ? 0.55 : 1.45) * s;
      let y;
      if (t < 0.3) y = -depth + (depth - handOut) * ease(t / 0.3);
      else if (t < 0.55) y = -handOut + Math.sin((t - 0.3) * 30) * 0.03 * s;
      else y = -handOut * (1 - ease((t - 0.55) / (M.dur - 0.55)));
      pos.y = E.floorY + y;
      const lower = Math.max(0, (t - (M.dur - 0.45)) / 0.45);
      const claw = t > 0.3 && t < 0.55 ? Math.sin(t * 34) * 0.25 : 0;
      arms(-2.9 + claw + lower * 1.7, -0.25 - lower * 0.2);
      m.rotation.z = Math.sin(t * 9) * 0.1 * (1 - lower);
      if (t > 0.55 && !M.dirt2) { M.dirt2 = true; this.dirt(game, E.end, E.floorY, Math.round(this.q().dirt * (E.big ? 2 : 1)), E.big ? 2 : 1); }
    } else if (E.kind === "locker") {
      // steps out of the dark, stumbling
      const k = easeIO((t - 0.12) / (M.dur - 0.12));
      pos.lerpVectors(E.start, E.end, k);
      if (up) up.rotation.x = 0.2 + Math.sin(k * Math.PI) * 0.35;
      if (dt > 0) z.animate(dt, (E.end.distanceTo(E.start) / (M.dur - 0.12)) * dt * (k > 0 && k < 1 ? 1 : 0));
    } else if (E.kind === "vent") {
      // drops through the ceiling, lands in a crouch, stands
      const fallH = E.start.y - E.floorY;
      const tLand = Math.sqrt(2 * fallH / 22);
      if (t < tLand) {
        pos.y = E.start.y - 11 * t * t;
        arms(-2.2, -0.4); legs(-0.35, 0.6);
      } else {
        if (!M.landed) { M.landed = true; this.puff(E.end.clone().setY(E.floorY + 0.2), 3, 1.1, [0.5, 0.48, 0.44]); G.Audio.sfx("body_thud", { pos: E.end }); }
        const r = ease((t - tLand) / Math.max(0.2, M.dur - tLand));
        pos.y = E.floorY - 0.32 * s * (1 - r);
        legs(-1.0 * (1 - r), 1.6 * (1 - r));
        arms(-0.9 * (1 - r) - 1.1 * r, -0.6);
        if (up) up.rotation.x = 0.7 * (1 - r) + 0.2 * r;
      }
    } else if (E.kind === "window") {
      // arms in over the sill, the body after, then down onto the floor
      const face = E.face, n = E.n;
      const at = (d) => new THREE.Vector3(face.x + n.x * d, 0, face.z + n.z * d);
      // (it leans in first -- legs still outside, head and arms through the
      // frame above the sill -- then slides over and drops. A real window's
      // sill (js/glass.js) is higher than the old painted one's: it climbs
      // that much higher)
      const lift = E.sill ? Math.max(0, E.sill - E.floorY - 0.9) : 0;
      if (t < 0.45) {
        const k = ease(t / 0.45);
        pos.copy(at(-0.5)); pos.y = E.floorY + 0.5 + lift;
        m.rotation.x = 0.35 + 0.45 * k;
        arms(-1.7 - 0.35 * Math.sin(t * 16), -0.5);
      } else if (t < 1.05) {
        const k = easeIO((t - 0.45) / 0.6);
        pos.copy(at(-0.5 + 0.8 * k)); pos.y = E.floorY + 0.5 + lift + 0.25 * Math.sin(k * Math.PI);
        m.rotation.x = 0.8 + 0.45 * Math.sin(k * Math.PI * 0.6);
        arms(-1.9 + 0.5 * k, -0.7); legs(-0.4 * k, 1.0 * k);
      } else {
        const k = ease((t - 1.05) / (M.dur - 1.05));
        pos.copy(at(0.3 + 0.9 * k)); pos.y = E.floorY + (0.55 + lift) * (1 - k);
        m.rotation.x = 1.1 * (1 - k);
        arms(-1.2, -0.4); legs(-0.4 * (1 - k), 1.0 * (1 - k));
        if (!M.landed && k > 0.6) { M.landed = true; this.puff(E.end.clone().setY(E.floorY + 0.15), 2, 0.8, [0.5, 0.48, 0.44]); }
      }
    } else if (E.kind === "desk") {
      // out from under on its belly, then up onto its feet
      if (M.crawler) {
        const k = easeIO(t / M.dur);
        pos.lerpVectors(E.start, E.end, k);
        if (dt > 0) z.animate(dt, 1.2 * dt);
      } else if (t < 0.8) {
        const k = easeIO(t / 0.8);
        pos.lerpVectors(E.start, E.mid, k); pos.y = E.floorY + 0.16 * s;
        m.rotation.x = 1.45;
        arms(-2.4 - Math.sin(t * 9) * 0.5, -0.5 + Math.sin(t * 9) * 0.3);
        legs(0, 0.2);
      } else {
        const k = easeIO((t - 0.8) / (M.dur - 0.8));
        pos.lerpVectors(E.mid, E.end, k); pos.y = E.floorY + 0.16 * s * (1 - k);
        m.rotation.x = 1.45 * (1 - k);
        arms(-2.4 + 1.2 * k, -0.5);
        legs(-0.9 * Math.sin(k * Math.PI), 1.4 * Math.sin(k * Math.PI));
      }
    }
  },

  // the props' moving parts, eased; a locker door swings open fast and
  // drifts back ajar, a vent grate falls open and hangs
  updateProps(world, dt) {
    (world.spawnPoints || []).forEach((sp) => {
      const P = sp.emerge && sp.emerge.prop;
      if (!P || !P.hinge) return;
      if (P.hold > 0) { P.hold -= dt; if (P.hold <= 0) P.want = sp.kind === "locker" ? 0.18 : 0.85; }
      if (Math.abs(P.open - P.want) < 0.001) return;
      const rate = P.want > P.open ? 9 : 1.4;
      P.open += Math.sign(P.want - P.open) * Math.min(Math.abs(P.want - P.open), rate * dt);
      if (sp.kind === "locker") P.hinge.rotation.y = -1.95 * P.open;
      else P.hinge.rotation.z = -1.75 * P.open;
    });
  },

  // ================= dying =================
  dying: [],
  onDeath(game, z) {
    const info = z._lastHit || {};
    if (z.emerge) z.emerge = null;
    if (z.sprite) z.sprite.visible = false;
    const P = game.yawObject.position;
    const dir = info.dir ? info.dir.clone() : new THREE.Vector3(z.mesh.position.x - P.x, 0, z.mesh.position.z - P.z);
    dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
    const floorY = G.getFloorHeightAt(game.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
    const scale = G.ZOMBIE_TYPES[z.type].scale || 1;
    const d = { z, t: 0, dir, floorY, scale };
    if (z.type === "boss") d.mode = "topple";
    else if (info.head && z.mesh.userData.neck) d.mode = "decap";
    else d.mode = "shatter";
    if (d.mode === "shatter") { this.shatter(game.scene, z.mesh, dir, floorY, scale); return; }
    // which way it falls: along the shot, in the zombie's own frame
    const inv = -z.mesh.rotation.y;
    const lx = dir.x * Math.cos(inv) - dir.z * Math.sin(inv), lz = dir.x * Math.sin(inv) + dir.z * Math.cos(inv);
    d.axis = Math.abs(lz) >= Math.abs(lx) ? "x" : "z";
    d.sign = d.axis === "x" ? Math.sign(lz) || 1 : -(Math.sign(lx) || 1);
    d.baseY = z.mesh.position.y;
    if (d.mode === "decap") {
      const neck = z.mesh.userData.neck;
      const headAt = neck.getWorldPosition(new THREE.Vector3());
      game.scene.attach(neck);                       // off the body, keeping where it was
      d.head = { obj: neck, vel: dir.clone().multiplyScalar(4 + G.rng() * 2).setY(2.4 + G.rng() * 1.6),
        spin: new THREE.Vector3((G.rng() - 0.5) * 14, (G.rng() - 0.5) * 10, (G.rng() - 0.5) * 14), r: 0.2 * scale };
      G.spawnHitParticles(game.scene, headAt, 0x8a1414, G.save.settings.graphicsQuality);
      this.puff(headAt, 1, 0.5, [0.45, 0.12, 0.1]);
      G.Audio.sfx("headshot", { pos: headAt });
    }
    this.dying.push(d);
  },
  updateDying(game, dt) {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i], m = d.z.mesh, L = m.userData.limbs || {};
      d.t += dt;
      const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 2);
      if (d.head) {
        const h = d.head, o = h.obj;
        h.vel.y -= 14 * dt;
        o.position.addScaledVector(h.vel, dt);
        o.rotation.x += h.spin.x * dt; o.rotation.y += h.spin.y * dt; o.rotation.z += h.spin.z * dt;
        if (o.position.y < d.floorY + h.r) {
          o.position.y = d.floorY + h.r;
          if (h.vel.y < -0.5) G.Audio.sfx("body_thud", { pos: o.position, soft: true });
          h.vel.y *= -0.35; h.vel.x *= 0.6; h.vel.z *= 0.6; h.spin.multiplyScalar(0.55);
        }
      }
      const fall = (k) => { if (d.axis === "x") m.rotation.x = k * 1.4 * d.sign; else m.rotation.z = (m.userData.baseLean || 0) + k * 1.4 * d.sign; };
      if (d.mode === "decap") {
        // the knees go, then it pitches over
        const k1 = ease(d.t / 0.35), k2 = ease((d.t - 0.35) / 0.5);
        if (!m.userData.crawler) {
          [L.legL, L.legR].forEach((l) => { if (l) { l.hip.rotation.x = -0.95 * k1; l.knee.rotation.x = 1.55 * k1; } });
          if (m.userData.upper) m.userData.upper.rotation.x = 0.35 * k1;
          m.position.y = d.baseY - 0.33 * d.scale * k1;
        }
        fall(k2 * 0.95);
        if (d.t >= 1.25) {
          this.shatter(game.scene, m, d.dir, d.floorY, d.scale);
          this.shatter(game.scene, d.head.obj, d.dir, d.floorY, d.scale, 0.35);
          this.dying.splice(i, 1);
        }
      } else if (d.mode === "topple") {
        fall(ease(d.t / 0.6));
        m.position.y = d.baseY - ease(d.t / 0.6) * 0.15;
        if (d.t >= 1.0) { this.shatter(game.scene, m, d.dir, d.floorY, d.scale, 2); this.dying.splice(i, 1); }
      }
    }
  },
  clearDying(scene) {
    this.dying.forEach((d) => {
      [d.z.mesh, d.head && d.head.obj].forEach((o) => { if (o) { if (o.parent) o.parent.remove(o); G.disposeObject3D(o); } });
    });
    this.dying = [];
  },

  // Break an object into blocks: each block takes the colour of the part it
  // came from, so a nurse bursts into teal and skin, a soldier into olive.
  // `mult` scales how many (a head is a fraction of a body, the boss twice).
  shatter(scene, root, dir, floorY, scale, mult) {
    mult = mult === undefined ? 1 : mult;
    root.updateWorldMatrix(true, true);
    const parts = [];
    let total = 0;
    const b = new THREE.Box3(), s = new THREE.Vector3();
    const add = (box, color) => {
      box.getSize(s);
      const vol = Math.max(0.0004, s.x * s.y * s.z);
      parts.push({ box, vol, color });
      total += vol;
    };
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.material) return;
      // a zombie's merged mesh remembers its pieces and their colours (the
      // shared material itself is white)
      if (o.userData.parts) o.userData.parts.forEach((p) => add(p.box.clone().applyMatrix4(o.matrixWorld), p.color));
      else if (o.material.color) add(b.setFromObject(o).clone(), o.material.color);
    });
    const whole = new THREE.Box3().setFromObject(root);
    const center = whole.getCenter(new THREE.Vector3());
    if (root.parent) root.parent.remove(root);
    G.disposeObject3D(root);
    if (!parts.length) return;
    const Q = this.q();
    const n = Math.max(2, Math.round(Q.blocks * mult));
    const pool = this.blocks(scene);
    const p = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      let r = G.rng() * total, part = parts[0];
      for (const pt of parts) { r -= pt.vol; if (r <= 0) { part = pt; break; } }
      p.set(G.randRange(part.box.min.x, part.box.max.x), G.randRange(part.box.min.y, part.box.max.y), G.randRange(part.box.min.z, part.box.max.z));
      v.subVectors(p, center).setY(0);
      if (v.lengthSq() < 1e-6) v.set(G.rng() - 0.5, 0, G.rng() - 0.5);
      v.normalize().multiplyScalar(1.1 + G.rng() * 2.2).addScaledVector(dir, 1.4 + G.rng() * 2.2);
      v.y = 1.2 + G.rng() * 2.6;
      const size = Math.min(0.2 * scale, Math.max(0.05, Math.cbrt(part.vol) * 0.42)) * (0.7 + G.rng() * 0.6);
      pool.emit(p, v, size, part.color, 0.8 + G.rng() * 0.6, floorY);
    }
    const sm = Math.max(1, Math.round(Q.smoke * Math.min(1.6, mult)));
    for (let i = 0; i < sm; i++) {
      p.set(G.randRange(whole.min.x, whole.max.x), G.randRange(whole.min.y, whole.max.y), G.randRange(whole.min.z, whole.max.z));
      this.puff(p, 1, (0.85 + G.rng() * 0.6) * Math.sqrt(scale), [0.62, 0.66, 0.58]);
    }
    G.Audio.sfx("shatter", { pos: center });
  },
  dirt(game, at, floorY, count, scale) {
    const pool = this.blocks(game.scene), p = new THREE.Vector3(), v = new THREE.Vector3();
    const cols = [new THREE.Color(0x4a3a26), new THREE.Color(0x5e4a30), new THREE.Color(0x3b3226), new THREE.Color(0x6b6a55)];
    for (let i = 0; i < count; i++) {
      const a = G.rng() * Math.PI * 2, r = G.rng() * 0.5 * scale;
      p.set(at.x + Math.cos(a) * r, floorY + 0.05, at.z + Math.sin(a) * r);
      v.set(Math.cos(a) * (0.6 + G.rng() * 1.6), 2 + G.rng() * 3, Math.sin(a) * (0.6 + G.rng() * 1.6));
      pool.emit(p, v, (0.05 + G.rng() * 0.09) * scale, G.pick(cols), 0.7 + G.rng() * 0.5, floorY);
    }
    this.puff(at.clone().setY(floorY + 0.3), 2, 0.9 * scale, [0.45, 0.4, 0.33]);
  },
  glass(game, at, n, count) {
    const pool = this.blocks(game.scene), p = new THREE.Vector3(), v = new THREE.Vector3();
    const col = new THREE.Color(0xbfe4ff);
    const fl = G.getFloorHeightAt(game.world, at.x, at.z, at.y - 1.5);
    for (let i = 0; i < count; i++) {
      p.set(at.x + (G.rng() - 0.5) * 1.1 * Math.abs(n.z), at.y + (G.rng() - 0.5) * 0.9, at.z + (G.rng() - 0.5) * 1.1 * Math.abs(n.x));
      v.copy(n).multiplyScalar(1.5 + G.rng() * 2).setY(0.5 + G.rng() * 1.5);
      v.x += (G.rng() - 0.5) * 1.2; v.z += (G.rng() - 0.5) * 1.2;
      pool.emit(p, v, 0.04 + G.rng() * 0.05, col, 0.7 + G.rng() * 0.4, fl);
    }
  },

  // ================= pools =================
  _blocks: null, _smoke: null, _cracks: null,
  _drop(P) {
    if (!P) return;
    if (P.mesh.parent) P.mesh.parent.remove(P.mesh);
    P.mesh.geometry.dispose(); P.mesh.material.dispose();
  },
  blocks(scene) {
    if (this._blocks && this._blocks.mesh.parent === scene) return this._blocks;
    this._drop(this._blocks);                      // a pool left over from the last level's scene
    const MAX = 260;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAX);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    const white = new THREE.Color(1, 1, 1);
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0); dummy.updateMatrix();
    for (let i = 0; i < MAX; i++) { mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, white); }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const P = {
      mesh, MAX, next: 0, live: 0, dummy,
      pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), rot: new Float32Array(MAX * 3), spin: new Float32Array(MAX * 3),
      size: new Float32Array(MAX), age: new Float32Array(MAX), life: new Float32Array(MAX), floor: new Float32Array(MAX), on: new Uint8Array(MAX),
      emit(p, v, size, color, life, floorY) {
        const i = this.next; this.next = (this.next + 1) % this.MAX;
        if (!this.on[i]) this.live++;
        this.on[i] = 1;
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
        for (let k = 0; k < 3; k++) { this.rot[i * 3 + k] = G.rng() * 6; this.spin[i * 3 + k] = (G.rng() - 0.5) * 16; }
        this.size[i] = size; this.age[i] = 0; this.life[i] = life; this.floor[i] = floorY;
        this.mesh.setColorAt(i, color);
        this.mesh.instanceColor.needsUpdate = true;
      },
    };
    this._blocks = P;
    return P;
  },
  smoke(scene) {
    if (this._smoke && this._smoke.mesh.parent === scene) return this._smoke;
    this._drop(this._smoke);
    const MAX = 120;
    const geo = new THREE.PlaneGeometry(1, 1);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    alpha.setUsage(THREE.DynamicDrawUsage); tint.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aAlpha", alpha);
    geo.setAttribute("aTint", tint);
    // Camera-facing soft puffs, drawn in one call: the quad is spread in view
    // space around the instance's centre, and the edge is a lumpy soft circle.
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: [
        "attribute float aAlpha; attribute vec3 aTint;",
        "varying float vAlpha; varying vec3 vTint; varying vec2 vUv;",
        "#include <fog_pars_vertex>",
        "void main() {",
        "  vUv = uv; vAlpha = aAlpha; vTint = aTint;",
        "  vec3 c = vec3(instanceMatrix[3]);",
        "  float s = length(vec3(instanceMatrix[0]));",
        "  vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);",
        "  mvPosition.xy += position.xy * s;",
        "  gl_Position = projectionMatrix * mvPosition;",
        "  #include <fog_vertex>",
        "}",
      ].join("\n"),
      fragmentShader: [
        "varying float vAlpha; varying vec3 vTint; varying vec2 vUv;",
        "#include <fog_pars_fragment>",
        "void main() {",
        "  vec2 d = vUv - 0.5; float r = length(d) * 2.0;",
        "  float lump = 0.92 + 0.08 * sin(atan(d.y, d.x) * 3.0 + r * 4.0);",
        "  float a = vAlpha * smoothstep(1.0, 0.15, r / lump);",
        "  if (a < 0.01) discard;",
        "  gl_FragColor = vec4(vTint, a);",
        "  #include <fog_fragment>",
        "}",
      ].join("\n"),
      transparent: true, depthWrite: false, fog: true,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0); dummy.updateMatrix();
    for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    this._smoke = {
      mesh, MAX, next: 0, live: 0, dummy, alpha, tint,
      pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), s0: new Float32Array(MAX), s1: new Float32Array(MAX),
      a0: new Float32Array(MAX), age: new Float32Array(MAX), life: new Float32Array(MAX), on: new Uint8Array(MAX),
    };
    return this._smoke;
  },
  // `n` puffs of about `size` metres at `at`, grey-green unless `rgb` says otherwise
  puff(at, n, size, rgb) {
    const scene = G.Game.scene;
    if (!scene) return;
    const S = this.smoke(scene);
    for (let k = 0; k < n; k++) {
      const i = S.next; S.next = (S.next + 1) % S.MAX;
      if (!S.on[i]) S.live++;
      S.on[i] = 1;
      S.pos[i * 3] = at.x + (G.rng() - 0.5) * size * 0.6; S.pos[i * 3 + 1] = at.y + (G.rng() - 0.5) * size * 0.4; S.pos[i * 3 + 2] = at.z + (G.rng() - 0.5) * size * 0.6;
      S.vel[i * 3] = (G.rng() - 0.5) * 0.35; S.vel[i * 3 + 1] = 0.35 + G.rng() * 0.45; S.vel[i * 3 + 2] = (G.rng() - 0.5) * 0.35;
      S.s0[i] = size * (0.4 + G.rng() * 0.3); S.s1[i] = size * (1.3 + G.rng() * 0.6);
      S.a0[i] = 0.55 + G.rng() * 0.2; S.age[i] = 0; S.life[i] = 1.2 + G.rng() * 0.8;
      const c = rgb || [0.36, 0.4, 0.34], j = (G.rng() - 0.5) * 0.06;
      S.tint.setXYZ(i, c[0] + j, c[1] + j, c[2] + j);
    }
    S.tint.needsUpdate = true;
  },
  // a crack in the ground where something is coming up
  crackTexture() {
    if (this._crackTex) return this._crackTex;
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 34);
    g.addColorStop(0, "rgba(8,6,4,0.95)"); g.addColorStop(1, "rgba(20,14,8,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "rgba(10,8,6,0.9)"; c.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + Math.random() * 0.4, r = 10, x = 64, y = 64;
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(x, y);
      while (r < 60) { r += 6 + Math.random() * 8; a += (Math.random() - 0.5) * 0.7; x = 64 + Math.cos(a) * r; y = 64 + Math.sin(a) * r; c.lineTo(x, y); c.lineWidth = Math.max(1, c.lineWidth - 0.5); }
      c.stroke();
    }
    this._crackTex = new THREE.CanvasTexture(cv);
    return this._crackTex;
  },
  crack(scene, at, floorY, size) {
    this._cracks = this._cracks && this._cracks.scene === scene ? this._cracks : { scene, list: [] };
    const C = this._cracks;
    let d = C.list.find((x) => x.age >= x.life);
    if (!d) {
      if (C.list.length >= 8) d = C.list.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
      else {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        m.rotation.x = -Math.PI / 2;
        scene.add(m);
        // a ring of upturned earth and broken ground round the hole: it
        // stands up out of long grass, where the crack alone would be lost
        this._earth = this._earth || [new THREE.MeshLambertMaterial({ color: 0x4a3a26 }), new THREE.MeshLambertMaterial({ color: 0x5e4a30 }), new THREE.MeshLambertMaterial({ color: 0x6b6a55 })];
        const ring = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + G.rng() * 0.4, r = 0.38 + G.rng() * 0.18;
          const h = 0.12 + G.rng() * 0.22;
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.2 + G.rng() * 0.16, h, 0.16 + G.rng() * 0.12), this._earth[i % 3]);
          b.position.set(Math.cos(a) * r, h / 2 - 0.02, Math.sin(a) * r);
          b.rotation.set((G.rng() - 0.5) * 0.9, a, (G.rng() - 0.5) * 0.9);
          ring.add(b);
        }
        scene.add(ring);
        d = { mesh: m, ring, age: 0, life: 8 };
        C.list.push(d);
      }
    }
    d.age = 0;
    d.mesh.visible = true; d.ring.visible = true;
    d.mesh.position.set(at.x, floorY + 0.02, at.z);
    d.mesh.rotation.z = G.rng() * Math.PI * 2;
    d.mesh.scale.setScalar(size * 0.3);
    d.ring.position.set(at.x, floorY, at.z);
    d.ring.rotation.y = G.rng() * Math.PI * 2;
    d.ring.scale.setScalar(size / 1.3);
    d.floorY = floorY;
    d.grow = size;
  },

  update(game, dt) {
    if (game.world) this.updateProps(game.world, dt);
    const B = this._blocks;
    if (B && B.live) {
      const m = B.mesh, dm = B.dummy;
      for (let i = 0; i < B.MAX; i++) {
        if (!B.on[i]) continue;
        B.age[i] += dt;
        const k = B.age[i] / B.life[i];
        if (k >= 1) {
          B.on[i] = 0; B.live--;
          // some of what is left turns to smoke
          if (G.rng() < 0.4) this.puff({ x: B.pos[i * 3], y: B.pos[i * 3 + 1] + 0.12, z: B.pos[i * 3 + 2] }, 1, 0.6, [0.6, 0.63, 0.56]);
          dm.scale.setScalar(0); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix);
          continue;
        }
        const j = i * 3;
        B.vel[j + 1] -= 14 * dt;
        B.pos[j] += B.vel[j] * dt; B.pos[j + 1] += B.vel[j + 1] * dt; B.pos[j + 2] += B.vel[j + 2] * dt;
        const half = B.size[i] * 0.5;
        if (B.pos[j + 1] < B.floor[i] + half) {
          B.pos[j + 1] = B.floor[i] + half;
          B.vel[j + 1] *= -0.32; B.vel[j] *= 0.62; B.vel[j + 2] *= 0.62;
          B.spin[j] *= 0.6; B.spin[j + 1] *= 0.6; B.spin[j + 2] *= 0.6;
        }
        B.rot[j] += B.spin[j] * dt; B.rot[j + 1] += B.spin[j + 1] * dt; B.rot[j + 2] += B.spin[j + 2] * dt;
        const shrink = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
        dm.position.set(B.pos[j], B.pos[j + 1], B.pos[j + 2]);
        dm.rotation.set(B.rot[j], B.rot[j + 1], B.rot[j + 2]);
        dm.scale.setScalar(B.size[i] * shrink);
        dm.updateMatrix();
        m.setMatrixAt(i, dm.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    const S = this._smoke;
    if (S && S.live) {
      const m = S.mesh, dm = S.dummy;
      for (let i = 0; i < S.MAX; i++) {
        if (!S.on[i]) continue;
        S.age[i] += dt;
        const k = S.age[i] / S.life[i];
        if (k >= 1) { S.on[i] = 0; S.live--; S.alpha.setX(i, 0); dm.scale.setScalar(0); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); continue; }
        const j = i * 3;
        S.pos[j] += S.vel[j] * dt; S.pos[j + 1] += S.vel[j + 1] * dt; S.pos[j + 2] += S.vel[j + 2] * dt;
        const e = 1 - Math.pow(1 - k, 2);
        dm.position.set(S.pos[j], S.pos[j + 1], S.pos[j + 2]);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(S.s0[i] + (S.s1[i] - S.s0[i]) * e);
        dm.updateMatrix();
        m.setMatrixAt(i, dm.matrix);
        S.alpha.setX(i, S.a0[i] * Math.min(1, k / 0.12) * Math.pow(1 - k, 1.3));
      }
      m.instanceMatrix.needsUpdate = true;
      S.alpha.needsUpdate = true;
    }
    const C = this._cracks;
    if (C) C.list.forEach((d) => {
      if (d.age >= d.life) return;
      d.age += dt;
      d.mesh.scale.setScalar(d.grow * Math.min(1, 0.3 + d.age / 0.5));
      d.mesh.material.opacity = d.age > d.life - 2 ? Math.max(0, (d.life - d.age) / 2) : 1;
      // the earth heaves up as the ground splits, and settles away at the end
      const s = d.grow / 1.3;
      const rise = Math.min(1, d.age / 0.35), sink = d.age > d.life - 2 ? (d.age - (d.life - 2)) / 2 : 0;
      d.ring.position.y = d.floorY - 0.35 * s * (1 - rise) - 0.4 * s * sink;
      if (d.age >= d.life) { d.mesh.visible = false; d.ring.visible = false; }
    });
  },

  disposePools() {
    this._drop(this._blocks); this._drop(this._smoke);
    this._blocks = null; this._smoke = null;
    if (this._cracks) {
      this._cracks.list.forEach((d) => {
        if (d.mesh.parent) d.mesh.parent.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose();
        if (d.ring.parent) d.ring.parent.remove(d.ring); d.ring.children.forEach((b) => b.geometry.dispose());
      });
      this._cracks = null;
    }
  },
  // before a level's scene is thrown away
  reset(scene) {
    this.clearDying(scene);
    this.disposePools();
    this._pm = null;
  },
};
