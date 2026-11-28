// Dev-only (not shipped). The story series' round 4: Chapter 1's map (js/story/ch1map.js),
// its light by the time of day (js/story/storylight.js) and what changed for them
// (js/story/voxel.js band + chunk, voxelprops.js sign sheet + clones, scenes.js
// teleport/light/door, perf.js lamp kinds, surface.js, zones.js).
//   A  the build: the chapter on its own map, what it is made of, how long it took, its
//      signs on one sheet, the merge
//   B  the plan as the design has it: 3F (301-310, 305 the exam west of the main stairs,
//      the janitor, the east stairs at the corridor's end), 2F (Kru Min's directions in
//      1-2: the music room next to the staff room at the corridor's end, the library
//      opposite it, its back door by the back stairs; no signs on 2F), 1F (the canteen
//      west, its kitchen, the office next to the PR room, the principal), outdoors (the
//      gym, the car park behind it, the flag yard's stage and lines, the gate and its
//      booth, the field by the gate)
//   C  walking: every region in the zombies' graph, a route from the gate to every room;
//      the whole map flooded from the gate as the player walks (steps of 0.25 m, the
//      stairs' treads, doors): every room, zone, spawn and start reached; the car park
//      only through the gym; the three stairwells climbed and come down for real
//   D  the chapter on it: every zone, spawn and scene start on its storey, free; each
//      scene starts there with its light; a checkpoint on 2F keeps its storey
//   E  the light: every set; the scene's light count and shaders unchanged; the lamps by
//      kind (the alarm's blinking red, the blackout's exits only, dusk's lamps); the sun
//      turned down indoors without shadows; the haze from the set
//   F  sound and footsteps: the acoustic space by region, the floor under the feet
//   G  doors: shut and open (collider, leaves, the baked mesh), from a scene
//   H  draw calls per zone on Low (under the campaign's 150); storeys out of sight undrawn
//   I  leaving: the campaign after it as it was
// Load it into the game (in the lobby), then:
//   const r = await G.Round42Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round42Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const yield0 = () => new Promise((r) => setTimeout(r, 0));

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t42 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, SC = G.StoryScenes, M = G.Ch1Map, L = G.StoryLight, CH = G.STORY_CHAPTERS.ch1, CAM = G.StoryCam;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, q0 = G.save.settings.graphicsQuality;
    const real = g._update0 || g.update;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const at = (x, z, y) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    const feet = () => g.yawObject.position.y - 1.7;
    const quit = () => { if (G.Dialog.isOpen()) G.Dialog.close(); g.update = real; if (g.state !== "MENU") g.quitToMainMenu(); g.update = () => {}; G.Modal.reset(); };
    const until = (fn, n) => { for (let i = 0; i < (n || 600) && !fn(); i++) step(1); return fn(); };
    const quality = (q) => { if (G.save.settings.graphicsQuality !== q) { G.save.settings.graphicsQuality = q; g.applyGraphicsQuality(); } };
    const room = (id) => M.ROOMS.find((r) => r.id === id);
    // the player's box where they would stand (js/game.js updatePlayerMovement): free of every collider?
    const R = 0.35;
    const free = (x, z, h) => !G.ColGrid.near(g.world, x, z, 1.2, []).some((c) => !c.isEmpty() && x - R < c.max.x && x + R > c.min.x && z - R < c.max.z && z + R > c.min.z && h + 0.1 < c.max.y && h + 2.6 > c.min.y);

    // (story round 6: scenes 1-1 and 1-2 are the design's now -- the run's shell this suite tries
    // (zones, groups, checkpoints, a scene's HUD) goes on the stand-ins it was written for, put back after)
    const CHS = G.STORY_CHAPTERS.ch1.scenes, real12 = CHS.slice(1, 9);       // (story round 7: and 1-3, 1-4; round 8: 1-5; round 9: 1-6; round 10: 1-7, 1-8)
    CHS.splice(1, 8,
      { id: "s1", title: "story.ch1.s1", objective: "story.ch1.s1.obj", start: { x: -1.5, y: 8, z: 0.4, yaw: -Math.PI / 2 }, clock: "08:50", light: "alarm", beats: [
        { do: [["objective", "story.ch1.s1.obj"]] },
        { wait: { zone: "corridor3East" }, do: [["banner", "story.ph.group"], ["spawn", { id: "c1", at: "corridor3Far", count: 3 }]] },
        { wait: { cleared: "c1" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] }] },
      { id: "s2", title: "story.ch1.s2", objective: "story.ch1.s2.obj", start: { x: 25.5, y: 4, z: -0.5, yaw: Math.PI / 2 }, clock: "09:10", light: "blackout", beats: [
        { do: [["objective", "story.ch1.s2.obj"]] },
        { wait: { zone: "libraryBack" }, do: [["spawn", { id: "r1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "r1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s3", title: "story.ch1.s3", objective: "story.ch1.s3.obj", start: { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }, clock: "09:30", light: "library",
        cast: [{ id: "min", who: "min", at: { x: -37, y: 4, z: 5.5 }, yaw: -Math.PI / 2 }, { id: "nam", who: "nam", at: { x: -36.6, y: 4, z: 4.3 }, yaw: -Math.PI / 2 + 0.3 },
          { id: "tonkla", who: "tonkla", at: { x: -37.4, y: 4, z: 6.9 }, yaw: -Math.PI / 2 - 0.3 }], beats: [
        { do: [["objective", "story.ch1.s3.obj"], ["spawn", { id: "d1", at: "libWindows", count: 2 }]] },
        { wait: { cleared: "d1" }, do: [["checkpoint", { x: -31.5, y: 4, z: 4.6, yaw: Math.PI }], ["spawn", { id: "d2", at: "libDoors", count: 3 }]] },
        { wait: { cleared: "d2" }, do: [["banner", "story.ph.clear"], ["checkpoint"], ["next"]] }] },
      { id: "s4", title: "story.ch1.s4", objective: "story.ch1.s4.obj", start: { x: -33, y: 4, z: 4.6, yaw: Math.PI / 2 }, clock: "10:15", light: "nurse", beats: [
        { do: [["objective", "story.ch1.s4.obj"]] },
        { wait: { zone: "nurse" }, do: [["spawn", { id: "n1", at: "wing2", count: 2 }]] },
        { wait: { cleared: "n1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s5", title: "story.ch1.s5", objective: "story.ch1.s5.obj", start: { x: -42, y: 4, z: -17.5, yaw: Math.PI }, clock: "12:30", light: "noon", beats: [
        { do: [["objective", "story.ch1.s5.obj"]] },
        { wait: { zone: "canteen" }, do: [["banner", "story.ph.group"], ["spawn", { id: "f1", at: "canteenFar", count: 4 }]] },
        { wait: { cleared: "f1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s6", title: "story.ch1.s6", objective: "story.ch1.s6.obj", start: { x: -41.2, y: 0, z: -1, yaw: -Math.PI / 2 }, clock: "17:00", light: "golden", beats: [
        { do: [["objective", "story.ch1.s6.obj"]] },
        { wait: { zone: "adminDoor" }, do: [["spawn", { id: "h1", at: "corridor1", count: 3 }]] },
        { wait: { cleared: "h1" }, do: [["checkpoint"], ["next"]] }] },
      // (story round 10: 1-7 and 1-8 too)
      { id: "s7", title: "story.ch1.s7", objective: "story.ch1.s7.obj", start: { x: 4.5, y: 0, z: 6, yaw: Math.PI }, clock: "17:45", light: "sunset", doors: { ENTRANCE: true }, beats: [
        { do: [["objective", "story.ch1.s7.obj"]] },
        { wait: { zone: "flagYard" }, do: [["banner", "story.ph.group"], ["spawn", { id: "b1", at: "yardRows", count: 4 }]] },
        { wait: { cleared: "b1" }, do: [["checkpoint"], ["next"]] }] },
      { id: "s8", title: "story.ch1.s8", objective: "story.ch1.s8.obj", start: { x: 0, y: 0, z: 30, yaw: -2.35 }, clock: "18:15", light: "dusk", beats: [
        { do: [["objective", "story.ch1.s8.obj"]] },
        { wait: { zone: "gate" }, do: [["end"]] }] });
    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      quality("low");

      // ================= A: the build =================
      {
        const t0 = performance.now();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        numbers.loadMs = Math.round(performance.now() - t0);
        const w = g.world, m = w.storyMap, st = m && m.stats;
        ok("A the chapter on its own map: js/story/ch1map.js built it (the theme's palette: daylight)", g.level.map === "ch1" && g.level.theme === "training" && !!m && M.state && M.state.world === w);
        numbers.build = st ? { ms: st.ms, parts: st.parts, houseBlocks: st.houseBlocks, siteBlocks: st.siteBlocks, faces: st.faces, chunks: st.chunks } : null;
        ok("A built of blocks: the school and the grounds (some 30 000 blocks, faces only where seen)", st && st.houseBlocks > 10000 && st.siteBlocks > 15000 && st.faces > 30000 && st.faces < st.houseBlocks * 6 + st.siteBlocks * 6, st && (st.houseBlocks + st.siteBlocks) + " blocks, " + st.faces + " faces");
        ok("A in chunks (G.CONFIG.story.voxel.mapChunk, 64 m since story round 10), the school's cut by storey (bands 0-3), every chunk kept out of the merge", st.chunks < 120 && M.state.chunks.every((c) => c.userData.band >= 0 && c.userData.band <= 3) && M.state.chunks.every((c) => w.noMerge.includes(c)), st.chunks + " chunks");
        numbers.buildMs = st.ms;
        ok("A the map's build under 20 s on this machine (software rendering; parts in numbers)", st.ms < 20000, st.ms + " ms");
        ok("A the signs on one sheet: one material for all of them", st.signs >= 40 && M.state.atlas.count === st.signs && M.state.atlas.used < 1, st.signs + " signs, " + Math.round(M.state.atlas.used * 100) + "% of the sheet");
        const signMats = new Set();
        g.scene.traverse((o) => { if (o.isMesh && o.material && o.material.map && o.material.map.image === M.state.atlas.canvas) signMats.add(o.material.name || o.material.uuid); });
        ok("A ...merged: the sheet's meshes few (one a zone and cell, not one a sign)", signMats.size >= 1 && signMats.size <= 3, Array.from(signMats).join());
        numbers.merge = g.perfReport;
        ok("A the level's merge: some 4 700 meshes down to under 150", g.perfReport && g.perfReport.meshesBefore > 3000 && g.perfReport.meshesAfter < 150, JSON.stringify(g.perfReport));
        ok("A the merge kept by zone (a storey's things, the grounds')", g.scene.children.filter((o) => o.userData.mergedParts).every((o) => ["s0", "s1", "s2", "out"].includes(o.userData.zone)));
        const dm = Object.values(M.state.doorMeshes).reduce((n, mp) => n + mp.size, 0);
        ok("A 66 doors (round 5: and 305's front door; round 9: the PR room's and the office's), their leaves baked into a few meshes (a storey's, the grounds')", Object.keys(m.doors).length === 66 && dm <= 8, Object.keys(m.doors).length + " doors, " + dm + " meshes");
        ok("A the regions, the waypoints, the stairs' flights (two a storey a stairwell)", w.regions.length > 80 && Object.keys(w.waypointNodes).length > 120 && w.stairs.length === 12, w.regions.length + " / " + Object.keys(w.waypointNodes).length + " / " + w.stairs.length);
        await yield0();
      }

      // ================= B: the plan =================
      {
        const w = g.world, ST = M.STAIRS;
        const of = (k) => M.ROOMS.filter((r) => r.k === k);
        const ids3 = of(2).map((r) => r.id);
        ok("B 3F: rooms 301-310 (and 311-313), the exam room 305, the janitor's", ["R301", "R302", "R303", "R304", "R305", "R306", "R307", "R308", "R309", "R310"].every((i) => ids3.includes(i)) && room("R305").type === "exam" && room("JANITOR").k === 2);
        ok("B ...305 west of the main stairs, behind their glass doors", room("R305").x1 < ST.M.cells.x[0] && !!w.storyMap.doors.STAIRM3);
        const c3 = M.corridors(2).find((c) => c.id === "C3E");
        ok("B ...the east stairs at the corridor's east end, by its door", ST.E.strip[0] >= c3.x1 + 1 && ST.E.strip[0] - (c3.x1 + 1) <= 2 && !!w.storyMap.doors.STAIRE3);
        ok("B ...the plates on 3F's doors: the room numbers", of(2).filter((r) => /^R3\d\d$/.test(r.id)).every((r) => r.plate === r.id.slice(1)));
        // Kru Min's directions (1-2)
        const mu = room("MUSIC"), sf = room("STAFF"), lib = room("LIBRARY");
        ok("B 2F: the music room next to the staff room (one wall between, the same side)", mu.k === 1 && sf.k === 1 && mu.side === sf.side && sf.x0 - mu.x1 === 2, mu.x1 + " | " + sf.x0);
        const main2 = of(1).filter((r) => r.side === "N" || r.side === "S");
        ok("B ...at the end of the corridor (the far end from the stairs: no room past it)", main2.every((r) => r.x0 >= mu.x0) && mu.x0 < ST.M.cells.x[0] && mu.x0 < ST.E.cells.x[0]);
        const overlap = Math.min(mu.x1, lib.x1) - Math.max(mu.x0, lib.x0);
        ok("B ...the library opposite the music room (across the same corridor)", lib.k === 1 && lib.side !== mu.side && overlap >= 4 && lib.z0 > mu.z1, "overlap " + overlap + " m");
        const lb = w.waypointNodes.DLIBBACK, sb = w.waypointNodes.DSTAIR_B2;
        ok("B ...the library's back door by the back stairs", lb && sb && Math.hypot(lb.x - sb.x, lb.z - sb.z) < 6, lb && sb && Math.hypot(lb.x - sb.x, lb.z - sb.z).toFixed(1) + " m");
        ok("B ...its front door shut (a shelf behind it, the doc's 1-2)", w.storyMap.doors.DLIBRARY && w.storyMap.doors.DLIBRARY.open === false);
        ok("B ...no signs on 2F's doors (fallen off)", of(1).every((r) => !r.plate && !r.sign));
        ok("B ...the science room and the language lab; the nurse's room at the west wing's end", room("SCIENCE").k === 1 && room("LAB").k === 1 && room("NURSE").k === 1 && room("NURSE").z0 === M.WING.z0 + 1);
        ok("B 1F: the canteen in the west wing, its kitchen behind it", room("CANTEEN").k === 0 && room("CANTEEN").x1 < M.MAIN.x0 && room("KITCHEN").z1 + 2 === room("CANTEEN").z0);
        ok("B ...the admin office next to the PR room, the principal's, the entrance hall", room("ADMIN").x0 - room("PR").x1 === 2 && room("ADMIN").side === room("PR").side && room("PRINCIPAL").k === 0 && room("ENTRY").k === 0 && room("ENTRY").side === "S");
        const yb = M.YARD, gy = M.GYM, pk = M.PARK, fd = M.FIELD, gt = M.GATE;
        ok("B outdoors: the flag yard in front, the gym behind the school, the car park behind the gym", yb.z0 > M.MAIN.z1 && gy.z1 < M.MAIN.z0 && pk.z1 < gy.z0);
        ok("B ...the gate in the campus wall, the field beside it", gt.z === M.SITE.z1 && fd.x0 - gt.x1 < 12 && fd.z1 > gt.z - 10);
        const site = M.state.site;
        ok("B ...the gate open (no wall in its gap), the wall either side", !site.get(29, 0, gt.z) && !!site.get(gt.x0 - 1, 0, gt.z) && !!site.get(gt.x1 + 1, 0, gt.z));
        ok("B ...the yard's lines painted (where the school lines up)", ["yellowLine"].every((b) => site.get(0, -1, 24) && site.get(0, -1, 24).name === b && site.get(0, -1, 27).name === b));
        ok("B ...the stage west of the front doors (their way clear), up its steps", M.STAGE.x + 3.2 < 3 && G.getFloorHeightAt(w, M.STAGE.x, 13, 0.75) === 1 && G.getFloorHeightAt(w, M.STAGE.x, 15.2, 0) === 0.25);
        await yield0();
      }

      // ================= C: walking =================
      {
        const w = g.world;
        const names = w.regions.map((r) => r.name);
        ok("C every region has its waypoint (the zombies' graph)", names.every((n) => w.waypointNodes[n] && (w.waypointEdges[n] || []).length > 0), names.filter((n) => !(w.waypointEdges[n] || []).length).join());
        const noRoute = M.ROOMS.filter((r) => !r.closed).filter((r) => !G.findPath(w, "YARD_FRONT", r.id).length).map((r) => r.id);
        ok("C a route from the gate to every room (3 storeys, the stairs' flights)", noRoute.length === 0, noRoute.join());
        const route = G.findPath(w, "YARD_FRONT", "R305");
        ok("C ...the gate to 305: in at the front doors, up a stairwell", route.includes("ENTRY") && route.some((n) => /^STAIR_[ME]2/.test(n)) && route[route.length - 1] === "R305", route.join(">"));
        // the whole map flooded from the gate as the player walks it: half-metre steps, a step up
        // of 0.7 m at most (js/world.js STEP_UP), the player's box at their floor
        const flood = (fromX, fromZ, fromH) => {
          const seen = new Map(), q = [[fromX, fromZ, fromH]], key = (x, z, h) => Math.round(x * 2) + "," + Math.round(z * 2) + "," + Math.round(h * 4);
          seen.set(key(fromX, fromZ, fromH), fromH);
          const B = M.SITE, D = [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]];
          while (q.length) {
            const [x, z, h] = q.pop();
            for (const [dx, dz] of D) {
              const x2 = x + dx, z2 = z + dz;
              if (x2 < B.x0 || x2 > B.x1 + 1 || z2 < B.z0 || z2 > B.z1 + 1) continue;
              if (!free(x2, z2, h)) continue;
              const h2 = G.getFloorHeightAt(w, x2, z2, h);
              const k = key(x2, z2, h2);
              if (seen.has(k)) continue;
              seen.set(k, h2);
              q.push([x2, z2, h2]);
            }
          }
          return seen;
        };
        const reached = (seen, x, z, h) => {
          // (the nearest half-metre point to it, on its floor)
          for (const dx of [0, 0.5, -0.5]) for (const dz of [0, 0.5, -0.5]) {
            const xx = Math.round((x + dx) * 2) / 2, zz = Math.round((z + dz) * 2) / 2;
            if (seen.has(Math.round(xx * 2) + "," + Math.round(zz * 2) + "," + Math.round(G.getFloorHeightAt(w, xx, zz, h) * 4))) return true;
          }
          return false;
        };
        const s0 = CH.scenes[0].start;
        const tf = performance.now();
        const seen = flood(Math.round(s0.x * 2) / 2, Math.round(s0.z * 2) / 2, 0);
        numbers.floodMs = Math.round(performance.now() - tf);
        const byFloor = [0, 0, 0];
        seen.forEach((h) => { const k = h < 2 ? 0 : h < 6 ? 1 : 2; byFloor[k]++; });
        numbers.walkable = byFloor.map((n) => Math.round(n / 4) + " m2").join(" / ");
        ok("C walked from the gate: the grounds, the ground floor, 2F and 3F (by the stairs alone)", byFloor[0] > 8000 && byFloor[1] > 1500 && byFloor[2] > 1500, numbers.walkable);
        const missRoom = M.ROOMS.filter((r) => !r.closed).filter((r) => {
          const y = M.F[r.k], cx = (r.x0 + r.x1 + 1) / 2, cz = (r.z0 + r.z1 + 1) / 2;
          // (somewhere in the room: its middle or a metre from its doorway's inside)
          const d = M.doorCellOf(r);
          const pts = [[cx, cz], [cx - 1.5, cz], [cx + 1.5, cz], [cx, cz - 1.5], [cx, cz + 1.5]];
          if (!r.open && !r.noDoor) pts.push(d.axis === "x" ? [d.x + 0.5, r.side === "N" ? d.z - 1 : d.z + 1.5] : [d.x - 1, d.z + 0.5]);
          return !pts.some(([x, z]) => reached(seen, x, z, y));
        }).map((r) => r.id);
        ok("C ...into every room with an open door (3 storeys)", missRoom.length === 0, missRoom.join());
        // (story round 6: a zone is an area -- somewhere in it reached, on a metre's grid across it; a
        // room's zone, 1-1's 302 and 307, has its desks in the middle)
        const missZone = Object.keys(CH.zones).filter((k) => {
          const q = CH.zones[k];
          for (let x = q.x0 + 0.5; x <= q.x1 - 0.5; x += 1) for (let z = q.z0 + 0.5; z <= q.z1 - 0.5; z += 1) if (reached(seen, x, z, q.y)) return false;
          return !reached(seen, (q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, q.y);
        });
        ok("C ...every zone of the chapter", missZone.length === 0, missZone.join());
        const missSp = [];
        // (story round 6: one inside a room shut until a scene opens it -- 1-2's store room Shambler -- is
        // tried in D, on its floor and clear, not walked to from the gate)
        const inShut = (p) => M.ROOMS.some((r) => r.closed && M.F[r.k] === (p.y || 0) && p.x >= r.x0 && p.x <= r.x1 + 1 && p.z >= r.z0 && p.z <= r.z1 + 1);
        Object.keys(CH.spawns).forEach((k) => CH.spawns[k].forEach((p, i) => { if (!inShut(p) && !reached(seen, p.x, p.z, p.y || 0)) missSp.push(k + i); }));
        ok("C ...every spawn point (where groups come from)", missSp.length === 0, missSp.join());
        const missStart = CH.scenes.map((s, i) => (reached(seen, s.start.x, s.start.z, s.start.y || 0) ? null : i)).filter((i) => i !== null);
        ok("C ...every scene's start", missStart.length === 0, missStart.join());
        const lib = room("LIBRARY");
        ok("C ...the library by its back door only (the front shut)", reached(seen, -32, 5, 4) && !w.storyMap.doors.DLIBRARY.open);
        ok("C ...the car park (Sgt. Chai's car)", reached(seen, -24, -55, 0));
        // the gym the only way to the car park: its doors shut, the car park out of reach
        w.storyMap.door("GYMN", false);
        const seen2 = flood(Math.round(s0.x * 2) / 2, Math.round(s0.z * 2) / 2, 0);
        ok("C ...only through the gym: its north door shut, the car park out of reach", !reached(seen2, -24, -55, 0) && reached(seen2, -24, -35, 0));
        w.storyMap.door("GYMN", true);
        await yield0();
        // the stairwells climbed for real (js/game.js's own movement, js/story/storycam.js walk)
        const walkTo = (x, z) => { CAM.walk(g, { x, z }); until(() => !CAM.busy(), 900); return Math.hypot(g.yawObject.position.x - x, g.yawObject.position.z - z) < 0.6; };
        const climbs = {
          M: [[2.5, -3.5], [2.5, -8], [6.5, -8], [6.5, -3.5]],
          E: [[25.5, -2], [30.5, -2], [30.5, 1], [25.5, 1]],
          B: [[-45.5, 3.5], [-50.5, 3.5], [-50.5, 7.5], [-45.5, 7.5]],
        };
        // (P: the strip at flight A's foot, flight A's top on the mid landing, flight B's foot
        // across it, flight B's top on the next storey's strip; then along that strip to the
        // next flight A's foot)
        // (then a moment: stepping down, the body drops onto the tread over a few frames)
        const W = (P, idx) => { const done = idx.every((i) => walkTo(P[i][0], P[i][1])); step(40); return done; };
        const up = {}, down = {};
        for (const id of Object.keys(climbs)) {
          const P = climbs[id];
          at(P[0][0], P[0][1], 0);
          const a = W(P, [1]), h1 = feet();
          const b = W(P, [2, 3]), h2 = feet();
          const c = W(P, [0, 1, 2, 3]), h3 = feet();
          up[id] = [h1, h2, h3].map((h) => h.toFixed(2)).join(" > ");
          ok("C the " + ({ M: "main", E: "east", B: "back" })[id] + " stairs walked up: the landing at 2 m, 2F at 4 m, 3F at 8 m", a && b && c && Math.abs(h1 - 2) < 0.05 && Math.abs(h2 - 4) < 0.05 && Math.abs(h3 - 8) < 0.05, up[id]);
          // down again, the same way back
          const d1 = W(P, [2, 1, 0]), h4 = feet();
          const d2 = W(P, [3, 2, 1, 0]), h5 = feet();
          down[id] = [h4, h5].map((h) => h.toFixed(2)).join(" > ");
          ok("C ...and down: 2F, the ground floor", d1 && d2 && Math.abs(h4 - 4) < 0.05 && Math.abs(h5) < 0.05, down[id]);
          await yield0();
        }
        // the corridors: their middle free from end to end
        const blocked = [];
        for (let k = 0; k < 3; k++) M.corridors(k).forEach((c) => {
          const along = c.x1 - c.x0 > c.z1 - c.z0;
          const n = along ? c.x1 - c.x0 : c.z1 - c.z0;
          for (let i = 0; i <= n * 2; i++) {
            const x = along ? c.x0 + 0.5 + i / 2 : (c.x0 + c.x1 + 1) / 2, z = along ? (c.z0 + c.z1 + 1) / 2 : c.z0 + 0.5 + i / 2;
            if (along && x > c.x1 + 0.5) break;
            if (!along && z > c.z1 + 0.5) break;
            if (!free(x, z, M.F[k])) { blocked.push(c.id + "@" + x + "," + z); break; }
          }
        });
        ok("C every corridor clear down its middle", blocked.length === 0, blocked.join());
      }

      // ================= D: the chapter on its map =================
      {
        const w = g.world;
        const badZ = Object.keys(CH.zones).filter((k) => { const q = CH.zones[k]; const h = G.getFloorHeightAt(w, (q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, q.y); return Math.abs(h - q.y) > 0.01 || ![0, 4, 8].includes(q.y); });
        ok("D every zone on its storey (y 0 / 4 / 8), a floor there", badZ.length === 0, badZ.join());
        const badS = [];
        Object.keys(CH.spawns).forEach((k) => CH.spawns[k].forEach((p, i) => { const h = G.getFloorHeightAt(w, p.x, p.z, p.y || 0); if (Math.abs(h - (p.y || 0)) > 0.01 || !free(p.x, p.z, h)) badS.push(k + i); }));
        ok("D every spawn point on its floor, nothing in the way", badS.length === 0, badS.join());
        const badSt = CH.scenes.map((s, i) => { const h = G.getFloorHeightAt(w, s.start.x, s.start.z, s.start.y || 0); return Math.abs(h - (s.start.y || 0)) > 0.01 || !free(s.start.x, s.start.z, h) ? i : null; }).filter((i) => i !== null);
        ok("D every scene's start on its floor, nothing in the way", badSt.length === 0, badSt.join());
        ok("D every scene with its time of day (a set of light)", CH.scenes.every((s) => L.SETS[s.light]), CH.scenes.map((s) => s.light).join());
        quit();
        const where = [];
        for (let i = 0; i < CH.scenes.length; i++) {
          const s = CH.scenes[i];
          play(() => S.start("ch1", { scene: i, beat: 0, skip: i > 0, guns: ["pistol"], ammo: {}, flags: [], x: null, z: null, yaw: null }));
          const p = g.yawObject.position;
          const okHere = Math.abs(p.x - s.start.x) < 0.3 && Math.abs(p.z - s.start.z) < 0.3 && Math.abs(feet() - (s.start.y || 0)) < 0.05 && L.current === s.light;
          if (!okHere) where.push(i + ":" + p.x.toFixed(1) + "," + feet().toFixed(1) + "," + p.z.toFixed(1) + "," + L.current);
          quit();
          await yield0();
        }
        ok("D each scene started at its place, on its storey, in its light", where.length === 0, where.join(" | "));
        // a checkpoint on 2F: its storey kept; Continue from it is on 2F
        G.save.story = { ch: {} };
        play(() => S.start("ch1", { scene: 3, beat: 0, skip: true, guns: ["pistol"], ammo: {}, flags: [], x: null, z: null, yaw: null }));
        at(-28, 4.6, 4);
        S.checkpoint(g, { x: -28, y: 4, z: 4.6, yaw: 0 });
        const cp = G.save.story.ch.ch1.cp;
        ok("D a checkpoint on 2F keeps its storey (cp.y 4)", cp && cp.y === 4 && Math.abs(cp.x + 28) < 0.01, cp && JSON.stringify({ x: cp.x, y: cp.y, z: cp.z }));
        const kept = G.normalizeStory(JSON.parse(JSON.stringify(G.save.story))).ch.ch1.cp;
        ok("D ...through the save's check (normalizeStory)", kept && kept.y === 4);
        const old = G.normalizeStory({ ch: { ch1: { started: 1, cp: { scene: 2, beat: 0, x: 3, z: 4, yaw: 0 } } } }).ch.ch1.cp;
        ok("D ...an older save's checkpoint (no y): the ground floor", old && (old.y == null || old.y === 0) && old.x === 3);
        quit();
        play(() => S.start("ch1", cp));
        ok("D Continue from it: back on 2F, where it was", Math.abs(feet() - 4) < 0.05 && Math.abs(g.yawObject.position.x + 28) < 0.3, feet().toFixed(2));
        at(16, 0, 4);
        const below = SC.inZone(g, CH, "corridor3East");
        at(16, 0, 8);
        const on = SC.inZone(g, CH, "corridor3East");
        ok("D a zone is on its storey: 3F's corridor zone not entered from 2F under it, entered on 3F", !below && on && Math.abs(feet() - 8) < 0.05);
        await yield0();
      }

      // ================= E: the light =================
      {
        const sc = g.scene;
        const lights = () => { let n = 0; sc.traverse((o) => { if (o.isLight) n++; }); return n; };
        at(0, 30, 0);
        step(3); g.renderFrame();
        const n0 = lights(), p0 = g.renderer.info.programs.length;
        const bad = [];
        for (const name of Object.keys(L.SETS)) {
          const s = L.SETS[name];
          SC.act(g, S.run, ["light", name]);
          step(2); g.renderFrame();
          const fogOk = sc.fog && Math.abs(g.world.fogBase.far - s.fog[2]) < 0.01 && Math.abs(g.world.fogBase.near - s.fog[1]) < 0.01;
          if (L.current !== name || sc.background.getHex() !== s.sky || !fogOk) bad.push(name);
        }
        ok("E every set: the sky, the haze (its drift from the set's), the light", bad.length === 0, bad.join());
        ok("E ...the scene's lights as many as built, no shader made again", lights() === n0 && g.renderer.info.programs.length === p0, n0 + " lights, " + p0 + " -> " + g.renderer.info.programs.length + " programs");
        const A = G.Perf.anchors, kinds = {};
        A.forEach((a) => { if (a.kind) kinds[a.kind] = (kinds[a.kind] || 0) + 1; });
        numbers.lamps = kinds;
        ok("E the map's lamps by kind: rooms, corridors, emergency, exits, the gym, outdoors, the van", ["room", "corridor", "emergency", "exit", "gym", "outdoor", "car"].every((k) => kinds[k] > 0), JSON.stringify(kinds));
        SC.act(g, S.run, ["light", "alarm"]);
        const em = A.filter((a) => a.kind === "emergency"), co = A.filter((a) => a.kind === "corridor");
        ok("E the alarm: the emergency lamps on, blinking red; the corridor lamps failing", em.every((a) => a.base > 0 && a.mode === "blink" && a.color.r > 0.9 && a.color.g < 0.3) && co.every((a) => a.mode === "flicker" && a.base < 0.3));
        SC.act(g, S.run, ["light", "blackout"]);
        ok("E the blackout: only the exits' green (short reach); no room or corridor lamp", A.filter((a) => a.kind === "room" || a.kind === "corridor").every((a) => a.base === 0) && A.filter((a) => a.kind === "exit").every((a) => a.base > 0 && a.distance <= 5 && a.color.g > 0.9));
        SC.act(g, S.run, ["light", "dusk"]);
        ok("E dusk: the lamp posts and the van's lights on, the sky dark", A.filter((a) => a.kind === "outdoor" || a.kind === "car").every((a) => a.base > 0) && sc.background.getHex() === L.SETS.dusk.sky);
        // the building dimmed per pixel on every graphics level (js/visuals.js's footprint, the shared
        // uniforms -- what inject hands each shader): its two blocks, under its roof, the set's share
        const u = {}; G.Visuals.inject({ uniforms: u }, { userData: {} });
        const LF = g.world.lightFoot, IN = L.INDOOR, f0 = u.vzFoot && u.vzFoot.value[0], f1 = u.vzFoot && u.vzFoot.value[1], f2 = u.vzFoot && u.vzFoot.value[2];
        const near = (a, b) => Math.abs(a - b) < 0.01;
        ok("E indoors: the building's two blocks dimmed per pixel under its roof (the sun x" + IN.sun + ", the sky x" + IN.sky + "), the gym not",
          LF && LF.rects.length === 2 && f0 && near(f0.x, M.MAIN.x0 + 0.12) && near(f0.y, M.MAIN.x1 + 1 - 0.12) && near(f1.x, M.WING.x0 + 0.12) && near(f1.w, M.WING.z1 + 1 - 0.12)
          && f2.x > f2.y && near(u.vzRoof.value, 11.95) && near(u.vzIndoor.value.x, IN.sun) && near(u.vzIndoor.value.y, IN.sky),
          f0 && [f0.x, f0.y, f0.z, f0.w].map((v) => v.toFixed(2)).join(",") + " roof " + (u.vzRoof && u.vzRoof.value));
        // the levels: a set's numbers x LEVEL; the exit signs keep their own
        SC.act(g, S.run, ["light", "noon"]);
        const amb = g.scene.children.find((o) => o.isAmbientLight), ex = A.find((a) => a.kind === "exit"), rm = A.find((a) => a.kind === "room" && a.base0 > 0);
        const noonOk = near(amb.intensity, L.SETS.noon.amb[1] * L.LEVEL.amb) && near(ex.base, L.SETS.noon.kinds.exit[1] * (ex.base0 > 0 ? ex.base0 : 1)) && near(rm.base, L.SETS.noon.kinds.room[1] * L.LEVEL.lamp * rm.base0);
        const noonTxt = amb.intensity.toFixed(3) + " " + ex.base.toFixed(3) + " " + rm.base.toFixed(3);
        SC.act(g, S.run, ["light", "blackout"]);
        const ownOk = L.SETS.blackout.own && near(amb.intensity, L.SETS.blackout.amb[1]);
        ok("E the levels: ambient, sky, sun and lamps x LEVEL (Medium and up show them as they are); the exit signs their own; the dark sets (own) as set",
          noonOk && ownOk && L.SETS.alarm.own && L.SETS.dusk.own && !L.SETS.noon.own, noonTxt + " | blackout " + amb.intensity.toFixed(3));
        SC.act(g, S.run, ["light", "noon"]);
        // the sun on Low (no shadows): the set's outdoors and in the building (dimmed there per pixel);
        // in the gym, under its own roof, turned down
        at(0, 30, 0); step(40);
        const outI = L.sun.intensity, full = L.SETS.noon.sun[1] * L.LEVEL.sun;
        at(-20, -0.5, 0); step(40);
        const inI = L.sun.intensity;
        at((M.GYM.x0 + M.GYM.x1) / 2, (M.GYM.z0 + M.GYM.z1) / 2); step(40);
        const gymI = L.sun.intensity;
        ok("E Low, no shadows: the sun the set's outdoors and in the building, turned down in the gym", !L.sun.castShadow && near(outI, full) && near(inI, full) && gymI < full * 0.2, outI.toFixed(2) + " / " + inI.toFixed(2) + " / " + gymI.toFixed(2));
        await yield0();
      }

      // ================= F: sound and footsteps =================
      {
        const sp = (x, z, y) => { at(x, z, y); return G.Acoustics.zoneAt(g); };
        const got = { corr: sp(-20, -0.5, 0), yard: sp(0, 30, 0), lib: sp(-32, 5, 4), stair: sp(4.5, -3.5, 0), room: sp(-4, -6.5, 8), canteen: sp(-41.2, -1, 0), gym: sp(-24, -35, 0) };
        numbers.spaces = got;
        ok("F the acoustic space by region: corridor, outdoors, the library a hall, the stairwell a hall, a classroom a room, the canteen and the gym halls",
          got.corr === "corridor" && got.yard === "outdoor" && got.lib === "hall" && got.stair === "hall" && got.room === "room" && got.canteen === "hall" && got.gym === "hall", JSON.stringify(got));
        const w = g.world, fl = (x, z, y) => G.Surface.floor(w, x, z, y);
        const steps = { corridor: fl(-20, -0.5, 0), library: fl(-32, 5, 4), classroom: fl(-4, -6.5, 8), lawn: fl(-50, 30, 0), gym: fl(-24, -35, 0), carPark: fl(-24, -55, 0), yard: fl(0, 30, 0), wc: fl(12, 5.5, 8) };
        numbers.footsteps = steps;
        ok("F the floor under the feet from the block there: terrazzo / tiles, the library's wood, the lawn, the gym's boards, asphalt, the toilets' tiles",
          steps.corridor === "tile" && steps.library === "wood" && steps.classroom === "tile" && steps.lawn === "grass" && steps.gym === "wood" && steps.carPark === "concrete" && steps.wc === "tile", JSON.stringify(steps));
      }

      // ================= G: doors =================
      {
        const w = g.world, d = w.storyMap.doors.DR306, m = [...M.state.doorMeshes[d.group].values()][0];
        const sum = () => { const a = m.geometry.attributes.position.array; let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * ((i % 7) + 1); return s; };
        const pos0 = sum();
        const doorway = () => free(d.x, d.z, d.y);
        ok("G a room's door open: the doorway free", d.open && doorway());
        w.storyMap.door("DR306", false);
        ok("G shut: its collider in the doorway, its leaf turned shut, the baked leaves made again", !d.open && !doorway() && d.leaves.every((h) => h.rotation.y === h.userData.base) && Math.abs(sum() - pos0) > 0.01, (sum() - pos0).toFixed(2));
        SC.act(g, S.run, ["door", { id: "DR306", open: true }]);
        ok("G opened from a scene ([\"door\", { id, open }]): free again", d.open && doorway());
        SC.act(g, S.run, ["door", { id: "LIBBACK", open: false }]);
        ok("G ...the library's back door shut by a beat", !w.storyMap.doors.LIBBACK.open && !free(-39.5, 5.5, 4));
        SC.act(g, S.run, ["door", { id: "LIBBACK", open: true }]);
        ok("G an unknown door: nothing happens", w.storyMap.door("NOPE", false) === false);
      }

      // ================= H: draw calls per zone (Low) =================
      {
        // (scene 2 again: no group out until its zone on 3F, which no view stands in)
        quit();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        const views = [["gate", 29.5, 0, 55, 0.5], ["yard", 0, 0, 30, 0], ["field", 54, 0, 34, 0.8], ["entry", 4.5, 0, 6, 0], ["corridor1", -20, 0, -0.5, Math.PI / 2], ["canteen", -46, 0, -10, Math.PI],
          ["corridor2", -20, 4, -0.5, Math.PI / 2], ["library", -31.5, 4, 4.6, Math.PI], ["nurse", -46, 4, -23, 0], ["corridor3", -1.5, 8, 0.4, -Math.PI / 2], ["room305", -3.5, 8, -6.5, Math.PI / 2],
          ["stairs", 4.5, 0, -3.5, Math.PI], ["gym", -24, 0, -35, 0], ["carPark", -24, 0, -55, 0], ["courtyard", 0, 0, -16, Math.PI / 2]];
        const calls = {}, over = [];
        (g.zombies || []).forEach((z) => { if (z.mesh) z.mesh.visible = false; });
        for (const [name, x, y, z, yaw] of views) {
          at(x, z, y); g.yawObject.rotation.y = yaw; g.pitchObject.rotation.x = 0; step(3);
          g.renderFrame();
          calls[name] = g.renderer.info.render.calls;
          if (calls[name] >= 150) over.push(name + " " + calls[name]);
        }
        numbers.callsLow = calls;
        ok("H Low: every zone under 150 draw calls (the campaign's gate budget, suite 22)", over.length === 0, over.join() || JSON.stringify(calls));
        // indoors on 2F: 3F's things and doors undrawn, the ground floor's too; 3F's band (2F's ceiling) drawn
        at(-20, -0.5, 4); step(3);
        const st = M.state;
        const z = (zn) => st.items.filter((it) => it.kind === "zone" && it.zone === zn);
        ok("H on 2F: its own things drawn, 1F's and 3F's not; the bands of 2F and 3F only", st.mode === "s1" && z("s1").some((it) => it.obj.visible) && z("s0").every((it) => !it.obj.visible) && z("s2").every((it) => !it.obj.visible)
          && st.chunks.every((c) => c.visible === (c.userData.band === 1 || c.userData.band === 2)), st.mode);
        at(0, 40, 0); step(3);
        ok("H outdoors, far from the building: its insides undrawn, every band of it drawn", st.mode === "out" && z("s1").every((it) => !it.obj.visible) && st.chunks.every((c) => c.visible));
        quality("medium");
        const callsMed = {};
        for (const [name, x, y, zz, yaw] of views.filter((v) => ["gate", "yard", "corridor2", "room305"].includes(v[0]))) {
          at(x, zz, y); g.yawObject.rotation.y = yaw; step(3); g.renderFrame(); callsMed[name] = g.renderer.info.render.calls;
        }
        numbers.callsMedium = callsMed;
        quality("low");
        await yield0();
      }
      quit();

      // ================= I: leaving =================
      {
        play(() => g.startLevel(1));
        const w = g.world;
        ok("I the campaign after it: no story map, its own zones, no story sun, no sheet of signs in use", !w.storyMap && !w.ownZones && !g.scene.children.some((o) => o.name === "story-sun") && !L.current);
        // (and the light indoors the school's own again: its footprint, its roof, its share)
        const u = {}; G.Visuals.inject({ uniforms: u }, { userData: {} });
        const fp = w.footprint && w.footprint[0], si = G.VISUAL.school.indoor, f0 = u.vzFoot.value[0];
        ok("I ...the school's own light indoors again (its footprint, its roof, its share)", !w.lightFoot && fp && Math.abs(f0.x - (fp.minX + 0.12)) < 0.01
          && Math.abs(u.vzRoof.value - (w.storeyY[w.storeyY.length - 1] + 3.95)) < 0.01 && Math.abs(u.vzIndoor.value.y - si.hemisphere) < 0.001, f0.x.toFixed(2) + " roof " + u.vzRoof.value.toFixed(2));
        quit();
      }
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      CHS.splice(1, 8, ...real12);
      G.CONFIG.story.enabled = enabled0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Modal.reset();
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup));
      if (G.save.settings.graphicsQuality !== q0) G.save.settings.graphicsQuality = q0;
      g.applyGraphicsQuality();
      G.persist(true);
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
