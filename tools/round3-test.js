// Dev-only (not shipped). Round 3 checks: the bigger school and its third
// floor, the campus, zone culling, spawning round the player, room types and
// signs, the small details, the story notes (data, placement, reading,
// keeping, the journal, the achievement), the third-floor grille and its
// rewards, the minimap, objectives and strings. The save is put back
// afterwards.
//   const r = await G.Round3Test.run();   r.fail -> []
window.G = window.G || {};
G.Round3Test = (function () {
  const results = [];
  const ok = (name, cond, info) => results.push({ name, pass: !!cond, info: info === undefined ? "" : info });
  function fresh(level, quality) {
    const g = G.Game;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = quality || "high";
    g.startLevel(level || 1);
    g.applyGraphicsQuality();
    g._update = g._update || g.update;
    g.update = function () {};
    g.player.hp = g.player.maxHp = 1e6;
    g.requiredKills = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    return g;
  }
  const words = (t) => (t.match(/[A-Za-z0-9][A-Za-z0-9'’.,:;!?()\-]*/g) || []).length;

  function map() {
    const g = fresh(1), w = g.world;
    ok("school: three storeys", (w.storeyY || []).length === 3 && w.regions.some((r) => r.y === 8.4));
    const rooms = [...w.roomNames];
    const byFloor = [0, 0, 0];
    rooms.forEach((k) => { const r = w.regions.find((x) => x.name === k); if (r) byFloor[Math.round(r.y / 4.2)]++; });
    ok("school: 40+ rooms (was 22)", rooms.length >= 40, rooms.length);
    ok("school: every floor has 12+ rooms", byFloor.every((n) => n >= 12), byFloor.join("/"));
    ok("school: every room has a kind", rooms.every((k) => w.roomInfo[k] && w.roomInfo[k].type), rooms.filter((k) => !(w.roomInfo[k] && w.roomInfo[k].type)).join(","));
    const types = new Set(rooms.map((k) => w.roomInfo[k].type));
    ["classroom", "library", "meeting", "science", "music", "art", "nurse", "computer", "principal", "canteen", "toilets"].forEach((t) => ok("room kind present: " + t, types.has(t)));
    ok("two staircases (F1-F2, F2-F3)", (w.stairs || []).length === 2 && w.stairs[1].y0 === 4.2 && w.stairs[1].y1 === 8.4);
    ok("third floor starts locked, its grille a collider", w.thirdFloor && !w.thirdFloor.unlocked && w.colliders.includes(w.thirdFloor.barrierCollider));
    ok("third-floor spawn points are gated", w.spawnPoints.filter((s) => s.pos.y > 7).every((s) => s.gate === "top") && w.spawnPoints.some((s) => s.gate === "top"));
    ok("rewards on the third floor", ["safe", "trophy", "coffee", "radio"].every((k) => w.rewards && w.rewards[k] && w.interactables.some((i) => i.kind === k)));
    // campus
    const C = w.campus, yardOld = 52 * 27;
    let outdoor = (C.x1 - C.x0) * (C.z1 - C.z0);
    w.footprint.forEach((f) => { outdoor -= (f.maxX - f.minX) * (f.maxZ - f.minZ); });
    ok("campus: 10x the old yard", outdoor >= yardOld * 10, Math.round(outdoor) + " m2 vs " + yardOld);
    const fence = w.colliders.filter((c) => (c.max.x - c.min.x > 50 && c.max.z - c.min.z < 1) || (c.max.z - c.min.z > 50 && c.max.x - c.min.x < 1));
    ok("campus: fenced on every side", fence.length >= 4, fence.length);
    const L = (k) => (w.landmarks || []).find((l) => l.key === k);
    ok("three salas", ["SALA_FRONT", "SALA_FIELD", "SALA_GARDEN"].every(L));
    ok("football field + stand", !!w.pitch && L("FIELD") && w.heightZones.some((h) => h.height === 1.8));
    ok("flower garden with a fountain", !!L("GARDEN") && (w.mapFeatures || []).some((f) => f.fill === "water"));
    ok("obstacles and trees across the grounds", (w.mapFeatures || []).filter((f) => f.fill === "block").length >= 20 && (w.campusTrees || []).length >= 30, (w.campusTrees || []).length);
    // a sala floor can be stepped onto
    const sala = L("SALA_FIELD");
    ok("sala floor is walkable (a step up)", Math.abs(G.getFloorHeightAt(w, sala.x, sala.z, 0) - 0.35) < 0.01);
    // a collider measured before its group had a place in the world lands at
    // the origin -- in the ground-floor corridor, in front of W2 and E2
    ok("nothing solid left at the origin", !w.colliders.some((c) => c.min.x < 0.4 && c.max.x > -0.4 && c.min.z < 0.4 && c.max.z > -0.4 && c.min.y < 1.5 && c.max.y > 0.3));
    // and every door can be walked up to from both sides
    const doorCols = new Set();
    w.roomDoors.forEach((d) => (d.colliders || [d.collider]).forEach((c) => c && doorCols.add(c)));
    const solid = (x, z, y) => w.colliders.some((c) => !doorCols.has(c) && x + 0.3 > c.min.x && x - 0.3 < c.max.x && z + 0.3 > c.min.z && z - 0.3 < c.max.z && y + 1.6 > c.min.y && y + 0.2 < c.max.y);
    const shut = w.roomDoors.filter((d) => { const y = d.baseY || 0; return !(!solid(d.x - 1.1, d.z, y) && !solid(d.x + 1.1, d.z, y)) && !(!solid(d.x, d.z - 1.1, y) && !solid(d.x, d.z + 1.1, y)); });
    ok("every room door is clear on both sides", shut.length === 0, shut.map((d) => d.x.toFixed(1) + "," + (d.baseY || 0) + "," + d.z.toFixed(1)).join(" "));
    // signs over every door: the sign atlas is drawn somewhere in the level
    const atlas = G.SchoolRooms.signPlane("Library", 1, 1).material.map.image;
    let signs = 0;
    g.scene.traverse((o) => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && m.map && m.map.image === atlas) signs++; });
    ok("room-name signs over the doors", signs > 0, signs);
    return g;
  }

  function zones() {
    const g = fresh(1, "low"), Z = G.Zones, P = g.yawObject.position;
    const drawn = (x, y, z) => { P.set(x, y, z); Z.update(g, true); return Z.items.filter((i) => i.on); };
    let on = drawn(-9.75, 1.7, -25);                         // inside W4, away from the stairs, doors shut
    // (newer list, round 3: a room with real windows sees the grounds through
    // them -- js/schoolshell.js, js/glass.js -- one without never does)
    const seesOut = (g.world.windowRooms || []).includes("W4");
    ok("zones: in a room, the campus is drawn only through its real windows", seesOut ? on.some((i) => i.zone === "O") && on.every((i) => i.zone !== "Y") : on.every((i) => i.zone !== "O" && i.zone !== "X"));
    ok("zones: in a room, other storeys are not drawn", on.every((i) => i.zone[0] !== "I" || (i.s0 <= 1 && i.s1 >= 1)), on.filter((i) => i.zone[0] === "I" && !(i.s0 <= 1 && i.s1 >= 1)).map((i) => i.zone).join(","));
    ok("zones: rooms behind shut doors are not drawn", on.every((i) => !i.room || i.room === "W4"));
    on = drawn(-9.75, 1.7, 13.5);                            // W1, by the entry hall: the gallery above can be seen
    ok("zones: near the entry hall the storey above is drawn", on.some((i) => i.zone[0] === "I" && i.s0 === 2));
    on = drawn(0, 1.7, 55);
    ok("zones: outdoors, far storeys' insides are not drawn", on.filter((i) => i.zone[0] === "I").length < 60);
    // draw calls on low at a few places
    const counts = {};
    // (visual series: Low has a moon shadow now, drawn again whenever the player
    // moves -- as every teleport here does -- and every 4th frame otherwise; its
    // draw calls are counted apart, G.Visuals.shadowCalls: this is the view's)
    const view = (k, x, y, z, yaw) => { P.set(x, y, z); g.yawObject.rotation.y = yaw; g.scene.updateMatrixWorld(true); Z.update(g, true); g.renderFrame(); counts[k] = g.renderer.info.render.calls - ((G.Visuals && G.Visuals.shadowCalls) || 0); };
    view("gate", 0, 1.7, 72, 0); view("corridor", 0, 1.7, 0, 0); view("classroom", -9.75, 1.7, 13.5, Math.PI / 2); view("field", -34, 1.7, -32, Math.PI / 2); view("F3", 0, 10.1, -10, 0);
    ok("zones: under 150 draw calls anywhere sampled (low)", Object.values(counts).every((n) => n < 150), JSON.stringify(counts));
    return counts;
  }

  function spawning() {
    const g = fresh(1), w = g.world, P = g.yawObject.position;
    P.set(-40, 1.7, -30); g.yawObject.rotation.y = 0;
    const fwd = new THREE.Vector3(0, 0, -1);
    let ground = 0, behind = 0, near = 0;
    for (let i = 0; i < 40; i++) {
      const sp = G.Spawner.groundPoint(w, P, fwd);
      if (!sp) continue;
      ground++;
      const dx = sp.pos.x - P.x, dz = sp.pos.z - P.z, d = Math.hypot(dx, dz);
      if (d >= 12 && d <= 28.01) near++;
      if ((dx * fwd.x + dz * fwd.z) / d < 0.3) behind++;
    }
    ok("spawns outdoors: up through the ground near the player", ground >= 30 && near === ground, ground + "/" + near);
    ok("spawns outdoors: out of sight (behind)", behind === ground, behind);
    // indoors: the same storey, nearby
    w.secondFloor.unlocked = true;
    P.set(0, 5.9, -20);
    let same = 0, tot = 0;
    for (let i = 0; i < 30; i++) { const sp = G.Spawner.pickPoint(w, P, fwd); if (!sp) continue; w.spawnPoints.forEach((s) => (s.cooldown = 0)); tot++; if (Math.abs(sp.pos.y - 4.2) < 1) same++; }
    ok("spawns indoors: mostly on the player's storey", same / Math.max(1, tot) > 0.6, same + "/" + tot);
    ok("spawns: never behind the locked third floor", w.spawnPoints.filter((s) => s.gate === "top").every((s) => !G.spawnPointOpen(w, s)));
    // a straggler far away is brought back in
    P.set(0, 1.7, 55);
    const z = g.spawnZombieAt("normal", new THREE.Vector3(-55, 0, -95));
    for (let t = 0; t < 7; t += 0.5) { g.relocateStragglers(0.5); if (z.emerge) break; }
    const d = Math.hypot(z.mesh.position.x - P.x, z.mesh.position.z - P.z);
    ok("a zombie left far behind is brought in near the player", d < 46, d.toFixed(1));
  }

  function details() {
    const g = fresh(1, "high"), w = g.world, D = G.Details, P = g.yawObject.position;
    ok("details: crows, leaves, paper, puddles, shafts, curtains built", D.crows && D.leaves && D.paper && D.puddles.length >= 2 && D.shafts.length >= 2 && D.curtains.length >= 1);
    // a crow takes off when you walk up to it
    const c = D.crows.items[0];
    D.perch(c, new THREE.Vector3(1000, 0, 1000));
    if (c.mode !== "perch") { c.mode = "perch"; c.perch = w.perches[0]; c.pos.set(w.perches[0].x, w.perches[0].y, w.perches[0].z); }
    P.set(c.pos.x + 3, c.pos.y + 1.7 - 1, c.pos.z);
    G.Zones.update(g, true);
    D.updateCrows(0.1, P, true);
    ok("details: a crow takes off when approached", c.mode === "fly");
    // leaves fall near trees, outdoors
    const t = w.treeTops.find((x) => x.leafy);
    P.set(t.x + 2, 1.7, t.z + 2);
    for (let i = 0; i < 120; i++) D.updateLeaves(1 / 30, P, true);
    ok("details: leaves are falling", D.leaves.items.some((it) => it.alive));
    // quality: everything thins out or switches off on very low
    G.save.settings.graphicsQuality = "vlow"; g.applyGraphicsQuality();
    D.updateLeaves(1 / 30, P, true); D.updatePaper(1 / 30, P, true); D.updateCrows(1 / 30, P, true);
    ok("details: very low turns them off", D.leaves.mesh.count === 0 && D.paper.mesh.count === 0 && D.crows.body.count === 0 && D.shafts.every((m) => !m.visible) && D.curtains.every((m) => !m.visible));
    G.save.settings.graphicsQuality = "high"; g.applyGraphicsQuality();
    // G1: the grass bends away from the player (and zombies)
    P.set(0, 1.7, 50);
    const z = g.spawnZombieAt("normal", new THREE.Vector3(3, 0, 50));
    D.update(g, 1 / 30);
    const B = w.dress.uniforms.uBend.value;
    ok("grass: bends round the player and the zombies near them", B[0].w > 0 && B[1].w > 0 && Math.abs(B[1].x - 3) < 0.5);
    g.zombies = []; g.scene.remove(z.mesh);
  }

  function notes() {
    const N = G.NOTES.level1;
    ok("notes: 20 for the school", N.length === 20);
    const split = {}; N.forEach((n) => { split[n.cefr] = (split[n.cefr] || 0) + 1; });
    ok("notes: CEFR split A1x3 A2x4 B1x4 B2x4 C1x3 C2x2", split.A1 === 3 && split.A2 === 4 && split.B1 === 4 && split.B2 === 4 && split.C1 === 3 && split.C2 === 2, JSON.stringify(split));
    const ranges = { A1: [40, 60], A2: [60, 95], B1: [90, 130], B2: [125, 170], C1: [160, 210], C2: [200, 260] };
    const bad = N.filter((n) => { const w = words(n.text), r = ranges[n.cefr]; return w < r[0] || w > r[1]; }).map((n) => n.id + ":" + words(n.text));
    ok("notes: lengths grow with the level", bad.length === 0, bad.join(" "));
    ok("notes: unique ids, titles and texts", new Set(N.map((n) => n.id)).size === 20 && new Set(N.map((n) => n.title)).size === 20 && new Set(N.map((n) => n.text)).size === 20);
    const thaiRe = new RegExp("[" + String.fromCharCode(0x0E00) + "-" + String.fromCharCode(0x0E7F) + "]");
    ok("notes: English only (no Thai)", N.every((n) => !thaiRe.test(n.text + n.title + n.author)));
    ok("notes: British spelling where it shows", /recognise/.test(N.map((n) => n.text).join(" ")) && !/recognize|color\b|center\b/.test(N.map((n) => n.text).join(" ")));
    // placement, over many runs
    let allBands = true, top = 0, outMax = 0, spots = 0;
    for (let i = 0; i < 12; i++) {
      const g = fresh(1);
      const P = G.Notes.placed;
      const bands = new Set(P.map((p) => p.note.cefr[0]));
      if (!(bands.has("A") && bands.has("B") && bands.has("C")) || P.length !== 10) allBands = false;
      top = Math.max(top, P.filter((p) => p.spot.floor === 3 && !p.spot.outdoor).length);
      outMax = Math.max(outMax, P.filter((p) => p.spot.outdoor).length);
      spots = g.world.noteSpotsCurated.length;
    }
    ok("notes: 10 a run, at least one A, B and C", allBands);
    ok("notes: 25-30 prepared spots", spots >= 25 && spots <= 30, spots);
    ok("notes: two at most behind the third-floor grille", top <= 2, top);
    ok("notes: half at most outdoors", outMax <= 5, outMax);
  }

  function reading() {
    const saved = JSON.stringify(G.save);
    try {
      G.save.notes = { level1: [], level2: [], level3: [] };
      G.save.achievements = {};
      const g = fresh(1);
      const ref = G.Notes.placed[0];
      g.state = "GAMEPLAY"; g.paused = false;
      G.Notes.read(g, ref);
      ok("reading: opens the reader, the game stops", G.Modal.isOpen("note") && g.paused && !document.getElementById("screen-note").classList.contains("hidden"));
      ok("reading: CEFR label in the corner", document.getElementById("note-cefr").textContent === ref.note.cefr);
      ok("reading: a Keep Note button", document.getElementById("btn-note-keep").textContent === G.T("notes.keep"));
      document.getElementById("btn-note-keep").click();
      ok("keeping: saved to the journal, gone from the world", G.save.notes.level1.includes(ref.note.id) && ref.read && !ref.mesh.visible && !G.Modal.isOpen("note") && g.notesReadRun.has(ref.note.id));
      // the journal
      G.UI.openJournal("screen-mainmenu", "level1");
      const tabs = document.getElementById("journal-tabs").textContent;
      ok("journal: shows 1 / 20", /1 \/ 20/.test(tabs) && document.querySelectorAll("#journal-list .journal-card").length === 20);
      ok("journal: kept notes can be read again", document.querySelectorAll("#journal-list button.journal-card").length === 1);
      document.querySelector("#journal-list button.journal-card").click();
      ok("journal: opens the reader with Close", G.Modal.isOpen("note") && document.getElementById("btn-note-keep").textContent === G.T("notes.close"));
      G.Notes.close();
      // all twenty: the achievement
      G.save.notes.level1 = G.NOTES.level1.map((n) => n.id).filter((id) => id !== G.Notes.placed[1].note.id);
      G.Notes.keep(g, G.Notes.placed[1]);
      ok("achievement: all twenty notes of the school", !!G.save.achievements.notes_level1);
      // the save format survives a round trip and a broken value
      const n = G.normalizeSave({ notes: { level1: ["s01", "s01", 5, "s02"], level2: "x" } });
      ok("save: notes normalised", JSON.stringify(n.notes) === JSON.stringify({ level1: ["s01", "s02"], level2: [], level3: [] }), JSON.stringify(n.notes));
    } finally {
      G.save = JSON.parse(saved); G.persist();
    }
  }

  function thirdFloor() {
    const saved = JSON.stringify(G.save);
    try {
      // (round 3 of the new series moved this to js/floor3.js: a keycard and
      // a Vocabulary Lock -- tools/round7-test.js goes through it in full)
      const g = fresh(1), w = g.world, tf = w.thirdFloor, F3 = G.Floor3;
      g.correctKills = 60; g.notesReadRun = new Set(["a", "b", "c", "d"]);
      G.Bosses.run.downs = [{ id: "coach", wave: 5, secs: 90 }];
      g.checkThirdFloorUnlock();
      ok("3F: no keycard while the 2nd floor is locked", !F3.s.spawned && !tf.unlocked);
      w.secondFloor.unlocked = true;
      g.notesReadRun = new Set(["a", "b"]);
      g.checkThirdFloorUnlock();
      ok("3F: needs three notes", !F3.s.spawned);
      g.notesReadRun.add("c"); g.correctKills = 49;
      g.checkThirdFloorUnlock();
      ok("3F: needs fifty right-word kills", !F3.s.spawned);
      ok("3F: the grille says what it wants", /Keycard/.test(g.thirdFloorStatus()), g.thirdFloorStatus());
      g.correctKills = 50;
      g.checkThirdFloorUnlock();
      ok("3F: the keycard turns up", F3.s.spawned && !tf.unlocked);
      F3.take(g); F3.open(g);
      ok("3F: opens, the grille's collider goes", tf.unlocked && !w.colliders.includes(tf.barrierCollider));
      ok("3F: its spawn points open", w.spawnPoints.filter((s) => s.gate === "top").every((s) => G.spawnPointOpen(w, s)));
      // the rewards
      const m0 = g.player.money;
      g.useReward(w.rewards.trophy);
      ok("reward: trophy case pays $1500 once", g.player.money === m0 + 1500 && w.rewards.trophy.used);
      g.useReward(w.rewards.trophy);
      ok("reward: ...only once", g.player.money === m0 + 1500);
      const perks0 = Object.values(g.player.perks).reduce((a, b) => a + b, 0);
      g.useReward(w.rewards.coffee);
      ok("reward: coffee machine gives a perk level", Object.values(g.player.perks).reduce((a, b) => a + b, 0) === perks0 + 1);
      g.useReward(w.rewards.radio);
      ok("reward: the radio marks the notes", g._notesRevealed === true);
      g.state = "GAMEPLAY";
      g.useReward(w.rewards.safe);
      const got = g._crateWeapon && G.WEAPON_DEFS[g._crateWeapon];
      ok("reward: the safe opens a crate of epic or better", G.Modal.isOpen("crate") && got && G.RARITY_ORDER.indexOf(got.rarity) >= G.RARITY_ORDER.indexOf("epic"), got && got.rarity);
      G.Modal.reset();
    } finally {
      G.save = JSON.parse(saved); G.persist();
    }
  }

  function objectivesAndMap() {
    const g = fresh(1), w = g.world;
    const rows = G.Objectives.list(g);
    ok("objectives: read four story notes", rows.some((r) => r.label === G.T("obj.notes", { n: 4 })));
    ok("objectives: explore counts places outside too", G.Objectives.state.roomTotal === w.roomNames.size + w.landmarks.length && G.Objectives.state.roomsNeeded === 24);
    const P = g.yawObject.position, l = w.landmarks.find((x) => x.key === "GARDEN");
    P.set(l.x, 1.7, l.z); G.Objectives.state._t = 0;
    G.Objectives.update(0.3, g);
    ok("objectives: standing in the garden counts it", G.Objectives.state.visited.has("GARDEN"));
    // the minimap draws on every storey without trouble
    let fine = true;
    try { [1.7, 5.9, 10.1].forEach((y) => { P.set(0, y, -10); G.Minimap.draw(g); }); } catch (e) { fine = false; }
    ok("minimap: draws on all three storeys", fine && !document.getElementById("hud-minimap").classList.contains("hidden"));
    ok("strings: nothing missing", !G._missingKeys || Object.keys(G._missingKeys).length === 0, Object.keys(G._missingKeys || {}).join(","));
  }

  return {
    async run() {
      results.length = 0;
      const saved = JSON.stringify(G.save);
      const t0 = performance.now();
      try {
        for (const f of [map, zones, spawning, details, notes, reading, thirdFloor, objectivesAndMap]) {
          try { f(); } catch (e) { ok(f.name + " threw", false, String(e && e.stack || e).slice(0, 300)); }
          await new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
        }
      } finally {
        G.save = JSON.parse(saved); G.persist();
        const g = G.Game;
        if (g._update) g.update = g._update;
        G.Modal.reset();
        g.quitToMainMenu();
      }
      return { ms: Math.round(performance.now() - t0), total: results.length, pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass), results };
    },
  };
})();
