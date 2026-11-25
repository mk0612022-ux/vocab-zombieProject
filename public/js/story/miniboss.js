// ===================================================================
// A mini-boss of Story Mode (story series, round 8): Coach Ek, in the gym
// -------------------------------------------------------------------
// The design's 1-5: the PE teacher has one word left, FASTER, and his
// stopwatch. He is one of the field's zombies (js/entities.js: he walks, he
// bites, his word is over his head), but no shot takes him down: it only
// counts while he is stunned, and what it counts as is an answer -- the
// glasses ask "Shoot the word that means 'faster'" (its meaning, in the
// player's language), his own label among look-alikes on the Sprinters round
// him (FASTEN, FOSTER). Three right ones end the fight: he goes down, and the
// stopwatch that falls from his hand goes on ticking.
//   ["boss", { id, who, name, word, gloss, at, yaw, decoys: [{ word, gloss }], adds, door, moves,
//              center, drop: { id, prompt } }]   the fight begins (js/story/scenes.js)
// His moves, in the order `moves` gives (G.CONFIG.story.boss has every number), each with its
// sign first; between two he comes on as any zombie does:
//   charge   the stopwatch beeps three times, a lane of red on the floor toward the player, held
//            on its line from the third beep; then straight down it. The player hit: knocked off
//            the feet (js/story/storycam.js fall). What stands in his way hit -- a wall, the
//            vaulting box, the stands -- he is stunned for `stunSec`
//   ball     he leans back, then throws a heavy ball at the player: anything solid on its way
//            stops it (behind the stands)
//   faster   the stopwatch held up: "FASTER! FASTER!" -- four to six Sprinters in PE kit out of
//            the locker room, the look-alikes among them, and for `boostSec` whatever zombie comes
//            within `boostR` of him is sped up (a ring on the floor shows how far that is)
// A variant of the campaign's coach (decision D4: js/bosses.js Bull Rush, js/bossmoves.js Medicine
// Ball): its marks on the floor (G.BossFX), its sounds and voice (G.Audio.boss), its bar and the line
// under it (G.UI.setBossBar / setBossHint); not its arena, cutscene, health and phases -- he is small,
// on the chapter's own map, and only his word hurts him
//   G.StoryBoss.start(game, run, o) / update(game, dt) / reset(game) / info()
//   G.StoryBoss.warm(game)                      a scene with `boss: true`, as it begins: its shaders made
//   G.StoryBoss.onHit(game, z, dmg, at, info)   js/game.js damageZombie: true -- taken care of here
//   G.StoryBoss.onDeath(game, z)                js/game.js startDeathAnimation: he falls, and stays
//   Down: the flag "boss:<id>" (a scene waits { boss: id }).
// ===================================================================
window.G = window.G || {};

G.StoryBoss = (function () {
  const T = (k, v) => G.T(k, v);
  const C = () => (G.CONFIG.story && G.CONFIG.story.boss) || {};
  const PX = () => (G.CONFIG.story && G.CONFIG.story.voxel && G.CONFIG.story.voxel.px) || 0.05625;
  const run = () => G.Story && G.Story.run;
  const num = (v, d) => (v != null ? v : d);
  let B = null, body = null;             // the fight; who is down (he stays till the scene is over)
  const A = () => (G.Audio && G.Audio.ctx && G.Audio.group ? G.Audio : null);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------------- sounds ----------------
  function beep(pos, high) {
    const a = A();
    if (a) a.group({ cat: "sfx", prio: 1, pos, dur: 0.4 }, () => {
      a.tone({ type: "square", freq: high ? 2500 : 2050, dur: high ? 0.22 : 0.09, gain: 0.07, pos, filter: { type: "bandpass", freq: 2300, q: 2 } });
      a.tone({ type: "sine", freq: high ? 2500 : 2050, dur: 0.07, gain: 0.04 });
    });
  }
  function tick(pos, i) {
    const a = A();
    if (a) a.group({ cat: "sfx", prio: 1, pos, dur: 0.2 }, () => a.tone({ type: "square", freq: i % 2 ? 1500 : 1750, dur: 0.02, gain: 0.07, pos, filter: { type: "bandpass", freq: 2400, q: 3 } }));
  }
  const sfx = (name, pos) => { if (G.Audio && G.Audio.sfx) G.Audio.sfx(name, { pos }); };
  // (the coach's sounds, in a smaller voice)
  const VOICE = { f: 92, rough: 18, len: 0.9 };
  const boss = (name) => { if (B && G.Audio && G.Audio.boss) G.Audio.boss(name, { pos: B.z.mesh.position.clone().setY(B.z.mesh.position.y + 1.4), voice: VOICE }); };

  // ---------------- what is drawn for a move ----------------
  // (the bosses' own marks and chips: js/bosses.js G.BossFX)
  function fx(game) {
    const F = G.BossFX;
    if (!F || !game.scene) return null;
    if (F.scene !== game.scene || !F.debris) {
      F.init(game.scene, B ? B.z.mesh.position.y : 0);
      [F.papers, F.spikes].forEach((m) => { if (m) m.visible = false; });       // (the Examiner's and the Thorn's: nothing of his)
    }
    [F.debris, F.motes].forEach((m) => { if (m) m.visible = true; });
    return F;
  }
  // (a scene that has one, as it begins -- 1-5 under its black screen: the marks' and chips' shaders made then,
  // not in the middle of the fight)
  function warm(game) {
    const F = fx(game);
    if (!F) return;
    const a = F.decal({ mode: "lane", x: 0, z: 0, y: -60, r: 1, len: 2 }), b = F.decal({ mode: "ring", x: 0, z: 0, y: -60, r: 1, w: 0.4, add: true });
    try { if (game.renderer && game.renderer.compile && game.camera) game.renderer.compile(game.scene, game.camera); } catch (e) { /* (made when first drawn, then) */ }
    a.hide(); b.hide();
    [F.debris, F.motes].forEach((m) => { if (m) m.visible = false; });
  }
  // the lane of a charge: from his feet, `len` metres the way it runs (a character's yaw)
  function lane(game, o) {
    const F = fx(game);
    if (!F) return;
    if (!B.lane) B.lane = F.decal(Object.assign({ mode: "lane", r: C().laneW || 1, w: 0.3, color: 0xff2a1a, opacity: 0.9, prog: 0 }, o));
    else B.lane.set(o);
  }
  function ring(game, o) {
    const F = fx(game);
    if (!F) return;
    if (!B.ring) B.ring = F.decal(Object.assign({ mode: "ring", w: 0.4, color: 0xffc82a, opacity: 0.8, add: true }, o));
    else B.ring.set(o);
  }
  function unmark() { if (!B) return; if (B.lane) { B.lane.hide(); B.lane = null; } if (B.ring) { B.ring.hide(); B.ring = null; } }
  // stunned: three small stars going round over the head
  function stars() {
    if (B.stars) return B.stars;
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xffe36b });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat), a = (i / 3) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
      m.rotation.set(0.6, a, 0.6);
      g.add(m);
    }
    g.visible = false;
    B.z.mesh.add(g);
    g.position.y = (B.z.mesh.userData.top || 1.8) + 0.02;
    return (B.stars = g);
  }
  // boxes of the block atlas as one mesh (a draw call): [faces, x0, y0, z0, x1, y1, z1]
  function boxes(list) {
    const V = G.Voxel, buf = new V.Buf(false);
    list.forEach((b) => V.addBox(buf, b[1], b[2], b[3], b[4], b[5], b[6], V.faceTiles(b[0]), {}));
    const m = new THREE.Mesh(buf.geometry(), V.mat("prop"));
    m.castShadow = true;
    return m;
  }
  // a medicine ball of blocks: three boxes across each other
  const ballMesh = () => boxes([["woodDark", -0.23, -0.15, -0.15, 0.23, 0.15, 0.15], ["paintOrange", -0.15, -0.23, -0.15, 0.15, 0.23, 0.15], ["woodDark", -0.15, -0.15, -0.23, 0.15, 0.15, 0.23]]);
  // the stopwatch (js/story/voxelprops.js has it as a prop): a dark case, the face in front, the crown
  function watchMesh(k) {
    const m = boxes([["metalDark", -0.06, 0, -0.018, 0.06, 0.12, 0.018], [{ all: "metal", front: "clock" }, -0.05, 0.01, 0.018, 0.05, 0.11, 0.024], ["metal", -0.015, 0.12, -0.012, 0.015, 0.145, 0.012],
      ["paintYellow", 0.045, 0.105, -0.01, 0.07, 0.13, 0.01]]);
    m.scale.setScalar(k);
    return m;
  }

  // ---------------- the fight begins ----------------
  function start(game, r, o) {
    reset(game);
    if (!o || !o.id || !r || !game.scene) return null;
    const p = o.at || {}, pos = new THREE.Vector3(p.x || 0, Number.isFinite(p.y) ? p.y : 0, p.z || 0), type = o.type || "normal";
    const pair = [o.word, (G.StoryQuiz ? G.StoryQuiz.glossOf(o.gloss) : "") || o.word];
    const z = game.spawnZombieAt(type, pos, null, { pair, practice: true, noTarget: true, look: G.VoxelChars && G.VoxelChars.on() ? G.VoxelChars.zombieLook(type, game, o.who || o.id) : null });
    if (!z) return null;
    z.storyBoss = o.id; z.storyGroup = o.id;
    z.speed = C().speed || 1.8; z.damage = C().bite || 18;
    z.hp = z.maxHp = 1e6;                              // (nothing but a right answer takes him down: onHit)
    z.mesh.scale.multiplyScalar(C().scale || 1.12);
    if (Number.isFinite(o.yaw)) z.mesh.rotation.y = o.yaw;
    r.groups[o.id] = 1;
    game.requiredKills = Math.max(game.requiredKills || 0, game.spawnedCount || 0);
    B = { o, z, pair, st: "chase", t: 0, gapT: num(o.firstGap, num(C().firstGap, 1.4)), moveI: 0, hits: 0, need: o.need || C().need || 3, calls: 0, groupN: 0, boostT: 0, beeps: 0, balls: [],
      lane: null, ring: null, stars: null, dir: { x: 0, z: 1 }, shrugT: 0, tickT: 0, tickN: 0, hints: {}, bar: null, stuns: 0, log: [] };
    // the stopwatch in his hand
    const L = z.mesh.userData.limbs;
    if (L && L.armR && L.armR.shoulder) {
      const w = watchMesh(1);
      if (w) { w.position.set(0, -11.5 * PX(), 0.06); w.rotation.x = 0.2; L.armR.shoulder.add(w); B.watch = w; }
    }
    // his pose over the gait's (js/zombieanim.js), while a move has one
    z.animStep = function (dt, moved) { G.Zombie.prototype.animStep.call(this, dt, moved); pose(this, dt); };
    if (G.StoryScreen && G.StoryScreen.stopLoop) G.StoryScreen.stopLoop("tick");         // (the watch is his own from here: heard where he is)
    bar(true);
    return z;
  }
  function bar(force) {
    if (!B || !G.UI || !G.UI.setBossBar) return;
    const key = B.hits + "|" + (B.st === "stun" ? 1 : 0);
    if (!force && key === B.bar) return;
    B.bar = key;
    G.UI.setBossBar(true, T(B.o.name || "story.who." + (B.o.who || B.o.id)), ((B.need - B.hits) / B.need) * 100, B.st === "stun", B.hits + 1);
  }
  // what to do about the move: the line under his bar, the first two times
  function hint(id, sec) {
    const n = (B.hints[id] = (B.hints[id] || 0) + 1);
    if (n <= 2 && G.UI && G.UI.setBossHint) G.UI.setBossHint(T("story.boss.hint." + id), sec || 3);
  }

  // ---------------- the states ----------------
  function to(st) { B.st = st; B.t = 0; B.log.push(st); if (B.log.length > 40) B.log.shift(); bar(); }
  function chase(gap) { to("chase"); const g = [].concat(C().gap || [4, 3.4, 2.8]); B.gapT = gap != null ? gap : g[Math.min(B.hits, g.length - 1)]; }
  function nextMove(game) {
    const list = B.o.moves && B.o.moves.length ? B.o.moves : ["charge", "ball", "faster"];
    const m = list[B.moveI % list.length];
    B.moveI++;
    if (m === "faster") faster(game);
    else if (m === "ball") { to("ball"); hint("ball", 3); boss("ball_wind"); }
    else { to("beep"); B.beeps = 0; B.locked = false; hint("charge", 3); boss("snort"); }
  }
  function faster(game) {
    to("faster");
    B.called = false;
    boss("whistle");
    hint("faster", 3.4);
    // (the first time as a line, its subtitle under it; after that a caption: the fight goes on under it)
    if (!B.o.line || !G.StoryDialogue) return;
    if (!B.shouts) G.StoryDialogue.say([{ who: B.o.who || B.o.id, line: B.o.line }]);
    else if (G.StoryWhisper) G.StoryWhisper.show("“" + G.StoryDialogue.en(B.o.line) + "”");
    B.shouts = (B.shouts || 0) + 1;
  }
  // Sprinters out of the locker room: the look-alikes not on the field first, the rest with the chapter's
  // words (and the words due) as any group's
  function callAdds(game, n) {
    const r = run();
    if (!r || !G.StoryScenes) return 0;
    const adds = () => game.zombies.filter((q) => q.alive && q.storyAdd === B.o.id);
    const have = new Set(adds().map((q) => q.word)), before = new Set(game.zombies);
    n = Math.min(n, Math.max(0, (C().maxAdds || 6) - adds().length));
    if (n <= 0) return 0;
    const words = (B.o.decoys || []).filter((w) => !have.has(w.word)).slice(0, n), id = B.o.id + "_" + (++B.groupN);
    let made = 0;
    if (words.length) made += G.StoryScenes.spawn(game, r, { id, at: B.o.adds, kinds: ["fast"], words });
    if (n - words.length > 0) made += G.StoryScenes.spawn(game, r, { id: id + "b", at: B.o.adds, kinds: ["fast"], count: n - words.length });
    game.zombies.forEach((q) => { if (!before.has(q)) q.storyAdd = B.o.id; });
    const M = game.world && game.world.storyMap;
    if (B.o.door && M && M.door) {
      const d = M.doorInfo && M.doorInfo(B.o.door);
      if (d && !d.open) { M.door(B.o.door, true); sfx("locker_bang", new THREE.Vector3(d.x, d.y + 1, d.z)); }
    }
    return made;
  }
  function stun(game) {
    const z = B.z, F = fx(game);
    to("stun");
    B.stuns++;
    if (B.lane) { B.lane.hide(); B.lane = null; }
    // (a man into a wall, not the campaign's blast: the blow, the wall's own thud, his breath)
    const hitAt = z.mesh.position.clone().setY(z.mesh.position.y + 1.2);
    sfx("body_thud", hitAt); sfx("locker_bang", hitAt);
    if (G.StoryScreen) G.StoryScreen.thudAt({ at: { x: hitAt.x, y: z.mesh.position.y, z: hitAt.z }, n: 1 });
    boss("hurt");
    if (F) {
      const hx = z.mesh.position.x + B.dir.x * 0.4, hz = z.mesh.position.z + B.dir.z * 0.4;
      F.burst(hx, z.mesh.position.y + 1.1, hz, 14, 0xb8b0a0, 3, 0.13, 3);
      F.sparks(hx, z.mesh.position.y + 1.4, hz, 18, 0xffe080, 4);
    }
    const pp = game.yawObject.position;
    if (Math.hypot(pp.x - z.mesh.position.x, pp.z - z.mesh.position.z) < 12 && G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.25, amp: 0.04 });
    // the question: his own word, among its look-alikes
    const have = new Set(game.zombies.filter((q) => q.alive && q !== z).map((q) => q.word));
    const miss = (B.o.decoys || []).filter((w) => !have.has(w.word)).length;
    if (miss) callAdds(game, miss);
    z.noTarget = false;
    G.StoryScenes.aimAt(game, B.pair);
    hint("stun", C().stunSec || 4);
    if (G.LexiLens) G.LexiLens.sys(B.o.ask || "story.boss.ask", { meaning: B.pair[1] }, { now: true, dur: C().stunSec || 4 });
  }
  // he comes round: the question dropped, another asked of whoever else is there
  function unstun(game) {
    B.z.noTarget = true;
    if (game.targetPair && game.targetPair[0] === B.pair[0]) game.targetPair = null;
    game.ensureTargetHasMatch();
  }

  // ---------------- a hit ----------------
  // js/game.js damageZombie: his hits are taken care of here -- true. Stunned, with his word asked: a
  // right answer. Else it does nothing (a clink), and once or twice says what would
  function onHit(game, z, dmg, at, info) {
    if (!B || z !== B.z || !z.storyBoss) return false;
    if (B.st === "stun" && game.targetPair && game.targetPair[0] === z.word) { answered(game, info); return true; }
    if (B.st === "hurt" || B.st === "down") return true;
    if (B.shrugT <= 0) {
      B.shrugT = 0.22;
      const a = A(), pos = at ? at.clone() : z.mesh.position.clone();
      if (a) a.group({ cat: "sfx", prio: 3, pos, dur: 0.2 }, () => { a.tone({ type: "triangle", freq: 1900, freqEnd: 1500, dur: 0.1, gain: 0.07, pos }); a.noise({ dur: 0.05, filter: "highpass", freq: 3000, gain: 0.05, pos }); });
      G.spawnHitParticles(game.scene, pos, 0xd8dcdc, G.save.settings.graphicsQuality);
      B.shrugs = (B.shrugs || 0) + 1;
      if (B.shrugs === 2 || B.shrugs === 14) { if (G.UI && G.UI.setBossHint) G.UI.setBossHint(T("story.boss.hint.shrug"), 4); }
    }
    return true;
  }
  // a right answer: the third puts him down (js/game.js onZombieDeath counts it as any other); the first
  // two throw him back
  function answered(game, info) {
    const z = B.z;
    B.hits++;
    z._lastHit = info || { dir: null, head: false };
    if (B.hits >= B.need) {
      z.hp = 0; z.alive = false;
      to("down");
      const r = run();
      if (r) r.flags.add("boss:" + B.o.id);
      game.onZombieDeath(z);
      return;
    }
    G.UI.showHitmarker(true);
    if (G.Audio) G.Audio.sfx("correct");
    if (G.LexiLens) G.LexiLens.onCorrect();
    if ((G.save.settings.speechMode || "after") === "after" && G.Audio && G.Audio.speak) G.Audio.speak(z.word);
    if (G.ExplainCard && G.Explain) G.ExplainCard.show(G.Explain.forShot(z, true, game.targetPair, game.targetClue));
    game.player.combo++;
    to("hurt");
    unstun(game);
    const d = info && info.dir, F = fx(game);
    if (d && game.pushZombie) game.pushZombie(z, d.x, d.z, 0.6);
    boss("hurt");
    if (F) F.sparks(z.mesh.position.x, z.mesh.position.y + 1.7, z.mesh.position.z, 20, 0x2bb6e8, 4);      // (the patch behind his ear)
    // (a box of rounds in the middle of the floor after the first, one of health after the second -- unless
    // some are lying there already)
    const c = B.o.center, kind = B.hits === 1 ? "ammo" : "health";
    if (c && game.spawnDrop && !(game.drops || []).some((q) => q.kind === kind && Math.hypot(q.mesh.position.x - c.x, q.mesh.position.z - c.z) < 2)) game.spawnDrop(kind, new THREE.Vector3(c.x, z.mesh.position.y, c.z));
  }
  // js/game.js startDeathAnimation: he is not blown to blocks -- he falls, and lies there; the stopwatch
  // out of his hand, ticking on
  function onDeath(game, z) {
    if (!B || z !== B.z) return false;
    if (z.sprite) z.sprite.visible = false;
    if (B.stars) B.stars.visible = false;
    unmark();
    B.balls.slice().forEach((b) => dropBall(game, b));
    const F = fx(game);
    if (F) F.sparks(z.mesh.position.x, z.mesh.position.y + 1.7, z.mesh.position.z, 30, 0x2bb6e8, 5);
    const d = z._lastHit && z._lastHit.dir, floorY = G.getFloorHeightAt(game.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y);
    // (over backwards or on his face: along the shot -- but never into what he has just run into)
    const p = z.mesh.position, fx0 = Math.sin(z.mesh.rotation.y), fz0 = Math.cos(z.mesh.rotation.y);
    let back = d ? d.x * fx0 + d.z * fz0 <= 0 : true;
    if (blocked(game, p.x + fx0 * 1.3, p.z + fz0 * 1.3, 0.3)) back = true;
    else if (blocked(game, p.x - fx0 * 1.3, p.z - fz0 * 1.3, 0.3)) back = false;
    body = { mesh: z.mesh, t: 0, floorY, watch: null, o: B.o, tickT: 0, tickN: 0, scale: z.mesh.scale.y, back };
    away(B.watch); B.watch = null;
    if (G.UI && G.UI.setBossBar) G.UI.setBossBar(false);
    if (G.StoryScreen) { G.StoryScreen.shake(game, { sec: 0.3, amp: 0.03 }); }
    G.Audio.zombie("death", z.type, z.mesh.position);
    // the stopwatch: a little way off toward the middle of the floor, where it can be reached
    const w = watchMesh(1.7), c = B.o.center || { x: z.mesh.position.x, z: z.mesh.position.z };
    if (w) {
      // (clear of the vaulting box and the stands)
      const toC = Math.atan2(c.x - p.x, c.z - p.z), turn = [0, 0.6, -0.6, 1.2, -1.2, 2, -2, Math.PI].find((a) => !blocked(game, p.x + Math.sin(toC + a) * 1.1, p.z + Math.cos(toC + a) * 1.1, 0.4));
      const k = turn == null ? 0 : 1.1, a = toC + (turn || 0);
      w.position.set(p.x, floorY + 1.1, p.z);
      game.scene.add(w);
      body.watch = { g: w, x0: p.x, z0: p.z, x1: p.x + Math.sin(a) * k, z1: p.z + Math.cos(a) * k, t: 0, down: false };
    }
    return true;
  }

  // ---------------- the player hurt ----------------
  function hurt(game, frac, from, push, fall) {
    const pl = game.player;
    if (!pl || game.state !== "GAMEPLAY") return 0;
    const ab = G.Abilities ? G.Abilities.damageTakenMult() : 1;
    if (ab <= 0) return 0;                              // (a Dash: nothing lands)
    let dmg = pl.maxHp * frac * (1 - (pl.armorPct || 0)) * ab;
    if (pl.hp >= pl.maxHp - 0.5) dmg = Math.min(dmg, pl.hp - 1);
    pl.hp -= dmg;
    pl.wasHitThisLevel = true;
    G.UI.flashDamage();
    G.Audio.sfx("hurt");
    if (push) {
      const l = Math.hypot(from.x, from.z) || 1;
      for (let i = 0; i < 10; i++) game.tryMove((from.x / l) * push / 10, (from.z / l) * push / 10);
    }
    if (fall && G.StoryCam && G.StoryCam.fall) G.StoryCam.fall(fall);
    if (G.StoryScreen) G.StoryScreen.shake(game, { sec: 0.3, amp: 0.06 });
    B.hurts = (B.hurts || 0) + 1;
    game.checkPlayerDeath();
    return dmg;
  }

  // ---------------- the charge's way ----------------
  const cols = [];
  // what he would stand in at (x, z): a wall, the vaulting box, the stands (not a thing on the floor, not a lintel)
  function blocked(game, x, z, r) {
    const y = B.z.mesh.position.y;
    const list = G.ColGrid.near(game.world, x, z, r + 0.2, cols);
    for (const c of list) if (c.max.y >= y + 0.3 && c.min.y <= y + 1.5 && x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z) return c;
    return G.inPlayArea && !G.inPlayArea(game.world, x, z, 0.2) ? { edge: true } : null;
  }
  // how far it is clear down the line he would take
  function reach(game, dir) {
    const p = B.z.mesh.position, max = C().dashMax || 34;
    for (let d = 0.3; d < max; d += 0.3) if (blocked(game, p.x + dir.x * d, p.z + dir.z * d, 0.36)) return d;
    return max;
  }
  function dash(game, dt) {
    const z = B.z, p = z.mesh.position, pp = game.yawObject.position;
    let left = (C().dashSpeed || 11) * dt;
    z.mesh.rotation.y = Math.atan2(B.dir.x, B.dir.z);
    const F = fx(game);
    if (F && Math.random() < 0.6) F.burst(p.x - B.dir.x * 0.6, p.y + 0.05, p.z - B.dir.z * 0.6, 1, 0xa89878, 1.4, 0.12, 1.4);
    lane(game, { x: p.x, z: p.z, y: p.y + 0.05, yaw: z.mesh.rotation.y, len: Math.max(0.5, (B.len || 0) - (B.ran || 0)), prog: 1 });
    while (left > 0) {
      const s = Math.min(0.2, left);
      left -= s;
      const nx = p.x + B.dir.x * s, nz = p.z + B.dir.z * s;
      if (blocked(game, nx, nz, 0.36)) { stun(game); return; }
      p.x = nx; p.z = nz;
      B.ran = (B.ran || 0) + s;
      // the player in the way: off the feet, thrown aside
      if (Math.hypot(pp.x - p.x, pp.z - p.z) < (C().dashHit || 0.95) && Math.abs(pp.y - 1.7 - p.y) < 1.6) {
        // (thrown along his way and off to the side they were on)
        const side = (pp.x - p.x) * B.dir.z - (pp.z - p.z) * B.dir.x >= 0 ? 1 : -1;
        hurt(game, num(C().dashDamage, 0.22), { x: B.dir.x + B.dir.z * side * 0.6, z: B.dir.z - B.dir.x * side * 0.6 }, num(C().dashPush, 3), num(C().fallSec, 1.3));
        sfx("body_thud", p.clone().setY(p.y + 1));
        if (B) { if (B.lane) { B.lane.hide(); B.lane = null; } to("recover"); }
        return;
      }
      // a Sprinter in the way: bowled aside
      game.zombies.forEach((q) => {
        if (q === z || !q.alive || q.emerge) return;
        const dx = q.mesh.position.x - p.x, dz = q.mesh.position.z - p.z;
        if (Math.hypot(dx, dz) < 0.8) { game.pushZombie(q, dx || 0.01, dz, 0.9); q._stagger = 0.5; q._hold = Math.max(q._hold || 0, 0.5); q._atk = null; }
      });
    }
    if (B.ran >= (C().dashMax || 34)) { if (B.lane) { B.lane.hide(); B.lane = null; } to("recover"); }
  }

  // ---------------- the ball ----------------
  function throwBall(game) {
    const z = B.z, p = z.mesh.position, pp = game.yawObject.position;
    const from = new THREE.Vector3(p.x, p.y + 1.55, p.z), aim = new THREE.Vector3(pp.x, pp.y - 0.65, pp.z);
    const v = aim.sub(from).normalize().multiplyScalar(C().ballSpeed || 13);
    const g = ballMesh();
    g.position.copy(from).addScaledVector(v, 0.05);
    game.scene.add(g);
    B.balls.push({ g, v, t: 0, live: true, bounce: 0 });
    boss("throw_heavy");
  }
  function dropBall(game, b) {
    const i = B ? B.balls.indexOf(b) : -1;
    if (i >= 0) B.balls.splice(i, 1);
    away(b.g);
  }
  function bounceSound(pos) { if (G.Audio && G.Audio.boss) G.Audio.boss("bounce", { pos: pos.clone() }); }
  function ballHits(game, x, y, z, r) {
    for (const c of G.ColGrid.near(game.world, x, z, r + 0.2, cols)) if (x + r > c.min.x && x - r < c.max.x && y + r > c.min.y && y - r < c.max.y && z + r > c.min.z && z - r < c.max.z) return true;
    return !!(G.inPlayArea && !G.inPlayArea(game.world, x, z, 0.1));
  }
  function balls(game, dt) {
    const pp = game.yawObject.position, r = 0.22;
    B.balls.slice().forEach((b) => {
      b.t += dt;
      b.g.rotation.x += dt * 5; b.g.rotation.z += dt * 2;
      const floorY = G.getFloorHeightAt(game.world, b.g.position.x, b.g.position.z, b.g.position.y);
      if (b.live) {
        let left = b.v.length() * dt;
        const u = b.v.clone().normalize();
        while (left > 0 && b.live) {
          const s = Math.min(0.15, left);
          left -= s;
          const q = b.g.position.clone().addScaledVector(u, s);
          if (ballHits(game, q.x, q.y, q.z, r) || q.y < floorY + r) { b.live = false; bounceSound(q); b.v.multiplyScalar(-0.18); b.v.y = 1.2; break; }
          b.g.position.copy(q);
          if (Math.hypot(pp.x - q.x, pp.z - q.z) < (C().ballHit || 0.6) && q.y > pp.y - 1.75 && q.y < pp.y + 0.35) {
            b.live = false;
            b.hit = true;
            hurt(game, num(C().ballDamage, 0.16), { x: u.x, z: u.z }, num(C().ballPush, 1.6), 0);
            bounceSound(q);
            b.v.multiplyScalar(-0.2); b.v.y = 1.4;
            break;
          }
        }
        if (b.t > 5) b.live = false;
      } else {
        // spent: it falls, rolls a little, and is gone
        b.v.y -= 12 * dt;
        b.g.position.addScaledVector(b.v, dt);
        if (b.g.position.y < floorY + r) { b.g.position.y = floorY + r; if (b.v.y < -1.2) { b.v.y *= -0.35; bounceSound(b.g.position); } else b.v.y = 0; b.v.x *= 0.7; b.v.z *= 0.7; }
        b.dead = (b.dead || 0) + dt;
        if (b.dead > 2.2) dropBall(game, b);
      }
    });
  }

  // ---------------- each frame ----------------
  function update(game, dt) {
    if (body) fallen(game, dt);
    if (!B) return;
    const z = B.z, r = run();
    if (!r || r.over || r.dead) return;
    if (G.BossFX && G.BossFX.scene === game.scene && !(G.Bosses && G.Bosses.phase)) G.BossFX.update(game._slowmoT > 0 ? dt * 0.35 : dt);
    if (!z.alive) { if (B.st !== "down") to("down"); B.balls.slice().forEach((b) => dropBall(game, b)); return; }
    const wdt = game._slowmoT > 0 ? dt * 0.35 : dt, p = z.mesh.position, pp = game.yawObject.position;
    B.t += wdt;
    if (B.shrugT > 0) B.shrugT -= wdt;
    balls(game, wdt);
    if (!B) return;                                     // (the player went down: the run started again)
    // the stopwatch: ticking where he is, quicker with each answer
    B.tickT -= wdt;
    if (B.tickT <= 0 && B.st !== "beep") { B.tickT = [].concat(C().tick || [1, 0.8, 0.62])[Math.min(B.hits, 2)] || 1; tick(p.clone().setY(p.y + 1.2), B.tickN++); }
    // while it lasts, whatever comes near him is sped up
    if (B.boostT > 0) {
      B.boostT -= wdt;
      const R = C().boostR || 7, u = (B.t0 = ((B.t0 || 0) + wdt * 0.9) % 1);
      ring(game, { x: p.x, z: p.z, y: p.y + 0.05, r: R, opacity: 0.45 + 0.3 * Math.sin(u * Math.PI * 2) });
      game.zombies.forEach((q) => { if (q !== z && q.alive && Math.hypot(q.mesh.position.x - p.x, q.mesh.position.z - p.z) < R) q._boostT = Math.max(q._boostT || 0, 0.4); });
    } else if (B.ring) { B.ring.hide(); B.ring = null; }
    const st = B.st, hold = st !== "chase";
    if (hold) { z._hold = Math.max(z._hold || 0, 0.12); z.attackCooldown = Math.max(z.attackCooldown, 0.3); z._atk = null; }
    z._holdNoTurn = st === "dash" || st === "stun" || st === "hurt" || st === "recover" || (st === "beep" && B.locked);
    if (st === "chase") {
      B.gapT -= wdt;
      if (B.gapT <= 0) nextMove(game);
    } else if (st === "beep") {
      const gap = C().beepGap || 0.55, n = Math.min(3, Math.floor(B.t / gap) + 1);
      if (n > B.beeps) { B.beeps = n; beep(p.clone().setY(p.y + 1.2), n === 3); if (n === 3) B.locked = true; }
      if (!B.locked) {
        const dx = pp.x - p.x, dz = pp.z - p.z, l = Math.hypot(dx, dz) || 1;
        B.dir = { x: dx / l, z: dz / l };
        // (too close for a run-up: he backs off for one first)
        if (l < (C().runUp || 6)) {
          const s = (C().backSpeed || 3.4) * wdt, nx = p.x - B.dir.x * s, nz = p.z - B.dir.z * s;
          if (!blocked(game, nx, nz, 0.36)) { p.x = nx; p.z = nz; }
        }
      }
      const yaw = Math.atan2(B.dir.x, B.dir.z);
      z.mesh.rotation.y += wrap(yaw - z.mesh.rotation.y) * Math.min(1, wdt * 9);
      B.len = reach(game, B.dir);
      lane(game, { x: p.x, z: p.z, y: p.y + 0.05, yaw, len: B.len, prog: Math.min(1, B.t / (gap * 3)), opacity: B.locked ? 1 : 0.7 });
      if (B.t >= gap * 3) { B.locked = false; B.ran = 0; to("dash"); boss("charge"); }
    } else if (st === "dash") {
      dash(game, wdt);
      if (B && B.st === "dash" && B.t > 5) to("recover");
    } else if (st === "ball") {
      if (B.t >= (C().ballWind || 1)) { throwBall(game); to("throw"); }
    } else if (st === "throw") {
      if (B.t >= 0.55) chase();
    } else if (st === "faster") {
      if (!B.called && B.t >= (C().callAt || 0.8)) {
        B.called = true;
        const n = [].concat(C().calls || [4, 5, 6]);
        B.made = callAdds(game, n[Math.min(B.calls, n.length - 1)]);
        B.calls++;
        B.boostT = C().boostSec || 5;
        const F = fx(game);
        if (F) F.shock(p.x, p.z, C().boostR || 7, 0xffc82a, 0.8);
      }
      if (B.t >= (C().fasterSec || 1.7)) chase();
    } else if (st === "stun") {
      const s = stars();
      s.visible = true;
      s.rotation.y += wdt * 4;
      if (B.t >= (C().stunSec || 4)) { s.visible = false; unstun(game); to("recover"); }
    } else if (st === "hurt") {
      if (B.stars) B.stars.visible = false;
      if (B.t >= (C().hurtSec || 1.2)) chase(0.7);
    } else if (st === "recover") {
      if (B.stars) B.stars.visible = false;
      if (B.t >= (C().recoverSec || 1.1)) chase();
    }
    if (B) bar();
  }
  // his pose over the gait's (after js/zombieanim.js has posed him)
  function pose(z, dt) {
    if (!B || z !== B.z) return;
    const u = z.mesh.userData, L = u.limbs, st = B.st;
    if (!L || !L.armR) return;
    B.pk = B.pk || {};
    const want = st === "faster" ? "faster" : st === "beep" ? "beep" : st === "dash" ? "dash" : st === "ball" ? "ball" : st === "throw" ? "throw" : st === "stun" ? "stun" : st === "hurt" ? "hurt" : "";
    ["faster", "beep", "dash", "ball", "throw", "stun", "hurt"].forEach((k) => { B.pk[k] = G.Anim.approach(B.pk[k] || 0, k === want ? 1 : 0, dt || 0.016, k === "throw" ? 0.05 : 0.12); });
    const K = B.pk, mix = (a, b, k) => a + (b - a) * k;
    const arm = (A2, x, zr, k) => { A2.shoulder.rotation.x = mix(A2.shoulder.rotation.x, x, k); A2.shoulder.rotation.z = mix(A2.shoulder.rotation.z, zr, k); if (A2.elbow) A2.elbow.rotation.x = mix(A2.elbow.rotation.x, 0, k); };
    const up = (x, y, k) => { if (u.upper) { u.upper.rotation.x = mix(u.upper.rotation.x, x, k); u.upper.rotation.y = mix(u.upper.rotation.y, y, k); } };
    if (K.faster > 0.01) { arm(L.armR, -2.95 + Math.sin(B.t * 22) * 0.06, 0.12, K.faster); arm(L.armL, -1.5, -0.2, K.faster); up(-0.16, 0, K.faster); if (u.neck) u.neck.rotation.x = mix(u.neck.rotation.x, -0.3, K.faster); }
    if (K.beep > 0.01) {
      const j = Math.max(0, 1 - ((B.t % (C().beepGap || 0.55)) / 0.18)) * 0.12;
      arm(L.armR, 0.75, 0.25, K.beep); arm(L.armL, -0.9, -0.15, K.beep); up(0.72 + j, 0, K.beep);
      L.legL.hip.rotation.x = mix(L.legL.hip.rotation.x, -0.55, K.beep); L.legR.hip.rotation.x = mix(L.legR.hip.rotation.x, 0.6, K.beep);
      if (u.neck) u.neck.rotation.x = mix(u.neck.rotation.x, -0.5, K.beep);
    }
    if (K.dash > 0.01) { up(0.62, 0, K.dash); if (u.neck) u.neck.rotation.x = mix(u.neck.rotation.x, -0.45, K.dash); }
    if (K.ball > 0.01) { arm(L.armR, 1.15, 0.45, K.ball); arm(L.armL, -1.35, -0.25, K.ball); up(-0.42, -0.55, K.ball); }
    if (K.throw > 0.01) { arm(L.armR, -1.5, -0.1, K.throw); up(0.5, 0.4, K.throw); }
    if (K.stun > 0.01) {
      const s = Math.sin(B.t * 3.2);
      arm(L.armR, -0.15, 0.2, K.stun); arm(L.armL, -0.15, -0.2, K.stun); up(0.42, s * 0.12, K.stun);
      z.mesh.rotation.z = (u.baseLean || 0) + s * 0.07 * K.stun;
      if (u.neck) { u.neck.rotation.x = mix(u.neck.rotation.x, 0.55, K.stun); u.neck.rotation.z = s * 0.25 * K.stun; }
    } else if (z.mesh.rotation.z !== (u.baseLean || 0)) z.mesh.rotation.z = u.baseLean || 0;
    if (K.hurt > 0.01) { arm(L.armR, -0.6, 0.8, K.hurt); arm(L.armL, -0.6, -0.8, K.hurt); up(-0.5, 0, K.hurt); }
  }
  // down: he goes over, and lies there; the stopwatch falls clear, and can be picked up -- ticking on
  function fallen(game, dt) {
    body.t += dt;
    const m = body.mesh, u = m.userData, L = u.limbs, k = Math.min(1, body.t / 0.9), e = k * k;
    m.rotation.x = (body.back ? -1.52 : 1.52) * e;
    m.position.y = body.floorY + 0.14 * body.scale * e;
    if (L && L.armR) {
      L.armR.shoulder.rotation.set(-0.5 * (1 - e) - 1.1 * e, 0, 1.1 * e); L.armL.shoulder.rotation.set(-0.5 * (1 - e) - 0.7 * e, 0, -1.0 * e);
      L.legL.hip.rotation.x = -0.1 * e; L.legR.hip.rotation.x = 0.08 * e;
      if (u.upper) u.upper.rotation.set(0, 0, 0);
      if (u.neck) u.neck.rotation.set(0, 0.5 * e, 0);
    }
    if (body.t > 0.9 && !body.thud) { body.thud = true; sfx("body_thud", m.position.clone()); if (G.StoryScreen) G.StoryScreen.thud(m.position.clone()); }
    const w = body.watch;
    if (!w) return;
    // (picked up: gone from the floor, and no more heard)
    const rr = run();
    if (w.down && w.g.visible && body.o.drop && rr && rr.flags.has("used:" + body.o.drop.id)) w.g.visible = false;
    w.t += dt;
    if (!w.down) {
      const s = Math.min(1, w.t / 0.7);
      w.g.position.set(w.x0 + (w.x1 - w.x0) * s, body.floorY + 1.1 * (1 - s * s) + 0.03, w.z0 + (w.z1 - w.z0) * s);
      w.g.rotation.set(-Math.PI / 2 * s, s * 5, 0);
      if (s >= 1) {
        w.down = true;
        w.g.rotation.set(-Math.PI / 2, 0.6, 0);
        sfx("rattle", w.g.position.clone());
        const d = body.o.drop;
        if (d && d.id && G.StoryUse && run()) G.StoryUse.add(game, { id: d.id, at: { x: w.x1, y: body.floorY, z: w.z1 }, size: [0.9, 0.6, 0.9], lift: 0.25, prompt: d.prompt || "story.use.generic", sound: "pickup" });
      }
    }
    body.tickT -= dt;
    if (w.g.visible && body.tickT <= 0) { body.tickT = 1; tick(w.g.position.clone().setY(body.floorY + 0.4), body.tickN++); }
  }

  // (out of the level, its geometry freed: the materials are every character's and every prop's, kept)
  function away(m) {
    if (!m) return;
    if (m.parent) m.parent.remove(m);
    G.disposeObject3D(m);
  }
  function reset(game) {
    game = game || G.Game;
    if (B) {
      unmark();
      away(B.stars);
      B.balls.slice().forEach((b) => dropBall(game, b));
      if (G.UI && G.UI.setBossBar) G.UI.setBossBar(false);
      // (the fight cut short -- another scene, the run started again: he goes with it)
      if (B.z && B.z.alive && game && game.zombies) {
        game.zombies = game.zombies.filter((q) => q !== B.z);
        B.z.alive = false;
        away(B.z.mesh);
      }
    }
    if (body) { away(body.mesh); if (body.watch) away(body.watch.g); }
    // (its marks and chips put away: nobody moves them on once the fight is over)
    const F = G.BossFX;
    if ((B || body) && F && game && F.scene === game.scene && F.debris && !(G.Bosses && G.Bosses.phase)) { F.clearTransient(); [F.debris, F.motes].forEach((m) => { if (m) m.visible = false; }); }
    B = null; body = null;
  }
  function info() {
    if (!B) return body ? { st: "down", hits: null, watch: !!(body.watch && body.watch.down) } : null;
    return { id: B.o.id, st: B.st, t: B.t, hits: B.hits, need: B.need, stuns: B.stuns, calls: B.calls, boost: B.boostT, balls: B.balls.length, ballLive: B.balls.filter((b) => b.live).length,
      locked: !!B.locked, beeps: B.beeps, lane: !!(B.lane && B.lane.on), ring: !!(B.ring && B.ring.on), hurts: B.hurts || 0, moveI: B.moveI, gapT: B.gapT, dir: B.dir, made: B.made || 0,
      shrugs: B.shrugs || 0, watch: !!(body && body.watch && body.watch.down), log: B.log.slice() };
  }

  return { start, warm, update, reset, onHit, onDeath, info, pose, get z() { return B ? B.z : null; }, get active() { return !!B && B.st !== "down"; },
    get body() { return body; }, get state() { return B; } };
})();
