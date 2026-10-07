// ===================================================================
// The bosses' new moves (new series, round 2)
// -------------------------------------------------------------------
// Every boss has three moves, one a phase (js/bosses.js): its old one down
// to 66% of its health, then the two here -- the first down to 33%, the
// second below that (faster, sooner, and in combos with the other two).
// Every one is shown before it lands (a mark on the ground, a wind-up, a
// sound, and a line under the boss's bar saying what to do) and has a way
// out; no single blow kills a player at full health. Harder by wave: at
// wave 5 the warnings are longest, at wave 20 the moves quickest
// (G.Bosses.warnK / ws). Every number: G.CONFIG.boss.moves (js/config.js).
//
//   gravedigger  Tombstone Ward    tombstones rise round him (he takes 15%)
//                                  and grave-keepers climb out: shoot each
//                                  by its word to break a stone; all broken,
//                                  he is stunned and open
//                Graveyard Shift   the ground round you splits into squares;
//                                  every other one bursts, then the rest --
//                                  stand on an unmarked square, then move
//   eye          Watcher Orbs      small eyes float after you and burst on
//                                  touch: shoot them down (one hit), or
//                                  outrun them (slower than a walk)
//                Mirror Gaze       it glows gold and throws every round back
//                                  at you: hold your fire -- then the eye
//                                  opens wide and the pupil takes 2.5x
//   headmaster   Detention         a chalk ring round you that closes in:
//                                  leave through the green gap (the line
//                                  itself holds you and stings)
//                School Assembly   everything burns but one green circle
//                                  somewhere near: get in it; then again,
//                                  smaller, somewhere else
//   matron       Sedative Volley   a fan of needle lanes; a needle slows you
//                                  down: stand between the lanes
//                Brood Sacs        eggs thrown round you hatch into fast
//                                  zombies: shoot them before they do
//   coach        Medicine Ball     a huge ball rolls down a lane and bounces
//                                  off the walls, each new lane shown first:
//                                  step aside each time
//                Offensive Line    a wall of ghost linemen crosses the arena
//                                  with gaps marked green: be in a gap
//   thorn        Barkskin          bark covers him (he takes 30%) and he
//                                  walks faster; his heart opens now and
//                                  then -- shoot it then (2.5x)
//                Overgrowth        lines out from him burst into thorn walls
//                                  that stay a while and sting: keep off
//   storm        Tesla Pylons      pylons drop round you and arcs flicker,
//                                  then crackle between them: shoot the
//                                  pylons, don't stand between two
//                Arc Barrage       a thin line follows you, turns white and
//                                  locks, then a bolt fires down it: step
//                                  off the line when it locks, again and again
//   chemist      Acid Sprayer      a green cone sweeps from side to side:
//                                  get behind him or beyond its reach
//                Miasma            a canister of gas that drifts after you,
//                                  slower than a walk: keep away, or shoot
//                                  the canister in its middle
//   void         Lights Out        the lights die; he appears behind you and
//                                  strikes (a glowing wedge, a whisper from
//                                  behind): turn and step out of it
//                Warden's Chains   a chain flies down a purple lane; caught,
//                                  you are pulled in: sprint away, or shoot
//                                  the glowing link to break it
//   examiner     Multiple Choice   four of him, each holding a word, and the
//                                  line under his bar gives a meaning: the
//                                  one holding its word is real -- shoot it
//                                  (stunned); a wrong one bursts on you
//                Fail Stamp        a huge F stamp comes down where you stand,
//                                  one after another: keep moving
// ===================================================================
(function () {
  const K = G.BossKit, FX = K.FX, V3 = K.V3, MV = K.MV, inRect = K.inRect, feetOf = K.feetOf;
  const ABIL = G.BossAbil;
  const T = (k, v) => G.T(k, v);
  const tmp = new V3(), tmp2 = new V3();
  const TAU = Math.PI * 2;
  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // on the arena floor (not in the air)
  const grounded = (game, M, h) => feetOf(game) < M.arena.floorY + (h || 1.2);
  // the line under the boss's bar: what to do about this move
  const hint = (M, id, secs) => M.hint(T("boss.move." + id + ".hint"), secs || 4);
  const addMesh = (game, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; game.scene.add(m); return m; };
  const drop = (o) => {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    o.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  };
  // where a move leaves his hand (the Coach has no hand of his own: his arm)
  const handPos = (b, out) => (b.rig.hand || b.rig.armR || b.root).getWorldPosition(out);
  const glow = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op == null ? 0.9 : op, blending: THREE.AdditiveBlending, depthWrite: false });
  // how far from (x, z) along the heading a to the arena's edge (pad inside)
  const toWall = (A, x, z, a, pad) => {
    const r = A.rect, dx = Math.sin(a), dz = Math.cos(a);
    const tx = dx > 1e-6 ? (r.maxX - pad - x) / dx : dx < -1e-6 ? (r.minX + pad - x) / dx : Infinity;
    const tz = dz > 1e-6 ? (r.maxZ - pad - z) / dz : dz < -1e-6 ? (r.minZ + pad - z) / dz : Infinity;
    return Math.max(0.5, Math.min(tx, tz));
  };
  // the distance from (px, pz) to the segment (ax, az)-(bx, bz)
  const segDist = (px, pz, ax, az, bx, bz) => {
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1e-6;
    const k = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2));
    return Math.hypot(px - ax - vx * k, pz - az - vz * k);
  };
  // a spot dist from (x, z) in a random direction, inside the arena and clear of the boss
  const spotNear = (M, b, x, z, dmin, dmax, pad) => {
    const A = M.arena;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * TAU, d = dmin + Math.random() * (dmax - dmin);
      const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (px < A.rect.minX + pad || px > A.rect.maxX - pad || pz < A.rect.minZ + pad || pz > A.rect.maxZ - pad) continue;
      if (Math.hypot(px - b.pos.x, pz - b.pos.z) < b.rig.R * b.scale + pad + 1) continue;
      return { x: px, z: pz };
    }
    return inRect(A, x + (Math.random() - 0.5) * dmax, z + (Math.random() - 0.5) * dmax, pad);
  };
  // a zombie climbing out of the ground: one of the boss's own
  const rise = (game, M, x, z, type) => {
    if (game.zombies.filter((zz) => zz.alive).length >= M.MAX_MINIONS) return null;
    const A = M.arena, end = new V3(x, A.floorY, z);
    const sp = { pos: end.clone(), types: ["normal", "fast"], cooldown: 0, ground: true, emerge: { kind: "ground", end, floorY: A.floorY } };
    const zb = game.spawnZombieAt(type, sp.pos, sp);
    if (zb) { zb.minion = true; M.stats.minions++; }
    return zb;
  };
  // one object of a kind on the field at a time (a second cast replaces it)
  const replaceObj = (M, kind) => { M.objs.filter((o) => o.kind === kind).forEach((o) => { if (o.end) o.end(); }); M.objs = M.objs.filter((o) => o.kind !== kind); };
  const canvasTex = (w, h, draw) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h); return new THREE.CanvasTexture(cv); };

  // ================================================================
  // Mortimer Grave
  // ================================================================
  // Tombstone Ward: armour that only his grave-keepers' words can break
  ABIL.ward = function (M, game, b) {
    const C = MV().ward, A = M.arena, P = game.yawObject.position;
    const wind = C.wind * M.warnK(game, b), n = Math.round(M.ws(game, C.keepers)), maxT = M.ws(game, C.maxTime);
    const a0 = Math.random() * TAU, graves = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * TAU + (Math.random() - 0.5) * 0.4, d = 6 + Math.random() * 3;
      let p = inRect(A, P.x + Math.sin(a) * d, P.z + Math.cos(a) * d, 1.4);
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.rig.R * b.scale + 2) p = spotNear(M, b, P.x, P.z, 5, 9, 1.4);
      graves.push(p);
    }
    const marks = graves.map((p) => FX.decal({ mode: "disc", x: p.x, z: p.z, r: 1.2, w: 0.3, color: 0x9dff6a, opacity: 0.9, prog: 0, add: true }));
    // a tombstone round him for each keeper
    const geo = new THREE.BoxGeometry(1.0, 1.7, 0.34), mat = new THREE.MeshLambertMaterial({ color: 0x8c8c86 });
    const stones = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(geo, mat);
      s.frustumCulled = false;
      game.scene.add(s);
      stones.push({ mesh: s, a: i / n * TAU, up: true });
    }
    const keepers = new Map();                  // zombie -> its stone
    let t = 0, warded = false, broken = 0, done = false, endT = 0;
    b.summoning = true;
    G.Audio.boss("grave_bell", { pos: b.pos, voice: b.def.voice });
    hint(M, "ward", wind + 6);
    b.dangers = graves.map((p) => ({ kind: "summon", x: p.x, z: p.z, r: 1.2, at: wind }));
    const raise = (stone, i) => {
      const g = graves[i % graves.length];
      const zb = rise(game, M, g.x, g.z, G.rng() < 0.3 ? "fast" : "normal");
      if (zb) { zb.keeper = true; keepers.set(zb, stone); }
    };
    const shatter = () => {
      done = true; endT = 0; b.armor = 1;
      b.vuln = C.vuln; b.vulnT = C.stun;
      G.Audio.boss("crash", { pos: b.pos });
      FX.shock(b.pos.x, b.pos.z, 8, 0xd8d8d0, 0.7);
      M.hint(T("boss.move.ward.broken"), 3);
      M.stats.dodged++;
    };
    return {
      holdFacing: true,
      onMinionDeath(zb, right) {
        const stone = keepers.get(zb);
        if (!stone || done) return;
        keepers.delete(zb);
        if (right && stone.up) {
          stone.up = false; broken++;
          const p = stone.mesh.position;
          FX.burst(p.x, p.y, p.z, 14, 0x8c8c86, 4, 0.3, 4);
          G.Audio.boss("stone_break", { pos: p });
          stone.mesh.visible = false;
          if (broken >= stones.length) shatter();
        } else if (stone.up) {
          // the wrong word: the grave fills again
          FX.later(1.0, () => { if (!done && b.alive) raise(stone, stones.indexOf(stone)); });
        }
      },
      update(dt) {
        t += dt;
        const R = b.rig.R * b.scale + 0.9;
        stones.forEach((s, i) => {
          if (!s.up) return;
          const a = s.a + b.t * 0.25;
          const rise01 = Math.min(1, t / wind);
          s.mesh.position.set(b.pos.x + Math.sin(a) * R, A.floorY + 0.85 - (1 - rise01) * 1.8, b.pos.z + Math.cos(a) * R);
          s.mesh.rotation.y = a;
        });
        if (!warded) {
          b.pose.torso = 0.5; b.pose.armL = [-1.1, 0.3]; b.pose.armR = [-1.1, -0.3];
          marks.forEach((m) => m.set({ prog: Math.min(1, t / wind) }));
          if (Math.random() < 0.5) graves.forEach((p) => FX.mote(p.x + (Math.random() - 0.5), A.floorY + 0.1, p.z + (Math.random() - 0.5), 0, 1.4, 0, 0x9dff6a, 0.8, 0.5, 0));
          if (t >= wind) {
            warded = true; b.armor = C.armor; b.dangers = [];
            marks.forEach((m) => m.hide());
            stones.forEach((s, i) => raise(s, i));
            G.Audio.boss("rise", { pos: b.pos });
            game.shake(0.05, 0.3);
          }
          return false;
        }
        b.pose.torso = 0.25; b.pose.armL = [-0.5, 0.4]; b.pose.armR = [-2.4, -0.3];
        if (done) { endT += dt; return endT >= 0.8; }
        // (it cannot last for ever: the stones crumble on their own)
        if (t >= wind + maxT) { stones.forEach((s) => { s.mesh.visible = false; }); b.armor = 1; return true; }
        return false;
      },
      end() {
        marks.forEach((m) => m.hide());
        stones.forEach((s) => { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); });
        geo.dispose(); mat.dispose();
        keepers.forEach((s, zb) => { zb.keeper = false; });
        b.armor = 1; b.summoning = false; b.dangers = []; b.pose = {};
      },
    };
  };

  // Graveyard Shift: every other square of the ground bursts, then the rest
  ABIL.graveyard = function (M, game, b) {
    const C = MV().graveyard, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const S = C.tile, half = (C.grid - 1) / 2, ox = P.x, oz = P.z;
    const tiles = [];
    for (let i = 0; i < C.grid; i++) for (let j = 0; j < C.grid; j++) {
      const x = ox + (i - half) * S, z = oz + (j - half) * S;
      if (x < A.rect.minX + 0.5 || x > A.rect.maxX - 0.5 || z < A.rect.minZ + 0.5 || z > A.rect.maxZ - 0.5) continue;
      tiles.push({ x, z, par: (i + j) % 2 });
    }
    const rounds = b.enraged ? C.roundsP3 : C.rounds;
    let r = -1, t = 0, warn = 0, marks = [], set = [];
    const next = () => {
      r++; t = 0;
      warn = M.ws(game, r === 0 ? C.warn : C.nextWarn) * W;
      set = tiles.filter((q) => q.par === r % 2);
      marks.forEach((m) => m.hide());
      marks = set.map((q) => FX.decal({ mode: "lane", x: q.x, z: q.z - S / 2 + 0.15, yaw: 0, r: S / 2 - 0.15, len: S - 0.3, w: 0.3, color: 0xd0601a, opacity: 0.9, prog: 0 }));
      G.Audio.boss(r ? "graves_next" : "graves", { pos: b.pos, voice: b.def.voice });
    };
    next();
    hint(M, "graveyard");
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.torso = 0.55; b.pose.armL = [-1.3, 0.3]; b.pose.armR = [-1.3, -0.3];
        marks.forEach((m) => m.set({ prog: Math.min(1, t / warn) }));
        b.dangers = set.map((q) => ({ kind: "circle", x: q.x, z: q.z, r: S / 2 - 0.2, at: Math.max(0, warn - t) }));
        if (t < warn) return false;
        // earth and hands burst out of every marked square
        let hit = false;
        set.forEach((q) => {
          FX.burst(q.x, A.floorY + 0.2, q.z, 4, 0x4a3a28, 4, 0.3, 5);
          FX.sparks(q.x, A.floorY + 0.3, q.z, 3, 0x9dff6a, 3);
          if (Math.abs(P.x - q.x) < S / 2 && Math.abs(P.z - q.z) < S / 2) hit = true;
        });
        G.Audio.boss("erupt", { pos: b.pos });
        game.shake(0.05, 0.25);
        if (hit && grounded(game, M)) M.hurt(game, C.damage, { src: "graveyard" }); else M.stats.dodged++;
        if (r + 1 >= rounds) return true;
        next();
        return false;
      },
      end() { marks.forEach((m) => m.hide()); b.dangers = []; b.pose = {}; },
    };
  };

  // ================================================================
  // Iris Glare
  // ================================================================
  // Watcher Orbs: small eyes that float after you; one hit pops each
  ABIL.orbs = function (M, game, b) {
    const C = MV().orbs, A = M.arena, P = game.yawObject.position;
    const wind = C.wind * M.warnK(game, b), n = Math.round(M.ws(game, C.count)), speed = M.ws(game, C.speed);
    let t = 0, launched = false;
    const orbs = [];
    b.rig.eye.getWorldPosition(tmp);
    const cx = tmp.x, cy = tmp.y, cz = tmp.z;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc050 }));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a0804 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), glow(0xff8a2a, 0.35));
      pupil.position.z = 0.3;
      g.add(body); g.add(pupil); g.add(halo);
      const a = i / n * TAU;
      g.position.set(cx + Math.cos(a) * 1.6, cy + Math.sin(a) * 1.0, cz);
      g.traverse((o) => { o.frustumCulled = false; });
      game.scene.add(g);
      orbs.push({ g, v: new V3(), on: true, a });
    }
    G.Audio.boss("orbs", { pos: b.pos });
    hint(M, "orbs", wind + 6);
    const pop = (o, blast) => {
      if (!o.on) return;
      o.on = false;
      const p = o.g.position;
      FX.sparks(p.x, p.y, p.z, blast ? 16 : 10, 0xffb028, blast ? 6 : 4);
      G.Audio.boss("orb_pop", { pos: p });
      if (o.tg && !o.tg.down) M.dropTarget(o.tg);
      drop(o.g);
    };
    // once launched they live on their own, and she is free to move on
    const launch = () => {
      launched = true;
      orbs.forEach((o) => { o.tg = M.addTarget(game, { obj: o.g, r: C.hitR, hp: C.hp, flatHp: true, kind: "orb", onDown: () => { pop(o, false); M.stats.dodged++; } }); });
      let life = 0;
      M.addObj({
        kind: "orbs",
        update(game, dt) {
          life += dt;
          let any = false;
          orbs.forEach((o) => {
            if (!o.on) return;
            any = true;
            const p = o.g.position;
            tmp2.set(P.x - p.x, P.y - 0.45 - p.y, P.z - p.z);
            const d = tmp2.length();
            if (d < C.blast) { pop(o, true); M.hurt(game, C.damage, { src: "orbs" }); return; }
            tmp2.multiplyScalar(speed / (d || 1));
            o.v.lerp(tmp2, Math.min(1, C.turn * dt));
            p.addScaledVector(o.v, dt);
            p.y = Math.max(A.floorY + 0.6, p.y + Math.sin(life * 3 + o.a) * 0.01);
            o.g.lookAt(P.x, P.y - 0.4, P.z);
            if (life >= C.life) pop(o, false);
          });
          return any;
        },
        dangers() { return orbs.filter((o) => o.on).map((o) => ({ kind: "circle", x: o.g.position.x, z: o.g.position.z, r: 1.0, at: 0 })); },
        end() { orbs.forEach((o) => pop(o, false)); },
      });
    };
    return {
      update(dt) {
        t += dt;
        b.pose.armL = [-1.8, 1.0]; b.pose.armR = [-1.8, -1.0];
        if (!launched) {
          const k = Math.min(1, t / wind);
          orbs.forEach((o, i) => { o.g.position.set(cx + Math.cos(o.a + t * 2) * (1.6 + k * 1.4), cy + Math.sin(o.a + t * 2) * (1.0 + k * 0.6), cz); o.g.scale.setScalar(0.3 + 0.7 * k); });
          if (t >= wind) launch();
          return false;
        }
        return true;
      },
      end() { if (!launched) orbs.forEach((o) => { if (o.on) { o.on = false; drop(o.g); } }); b.pose = {}; },
    };
  };

  // Mirror Gaze: gold, every round thrown back; then the eye wide open
  ABIL.mirror = function (M, game, b) {
    const C = MV().mirror, wind = C.wind * M.warnK(game, b), refl = M.ws(game, C.reflect), open = M.ws(game, C.open);
    let t = 0, stage = "wind", r0 = 0;
    G.Audio.boss("mirror_wind", { pos: b.pos });
    hint(M, "mirror", wind + refl);
    return {
      update(dt) {
        t += dt;
        if (stage === "wind") {
          const k = Math.min(1, t / wind);
          b.tint = { r: 0.55 * k, g: 0.42 * k, b: 0.08 * k };
          if (b.rig.lidOpen) b.rig.lidOpen(1 - 0.75 * k);
          if (t >= wind) { stage = "reflect"; t = 0; b.reflect = true; r0 = M.stats.reflected || 0; G.Audio.boss("mirror_on", { pos: b.pos }); }
          return false;
        }
        if (stage === "reflect") {
          b.tint = { r: 0.55 + 0.12 * Math.sin(b.t * 12), g: 0.45, b: 0.1 };
          if (Math.random() < 0.35) { const a = Math.random() * TAU; FX.sparks(b.pos.x + Math.cos(a) * 1.4, b.pos.y + b.rig.H * 0.6 * b.scale, b.pos.z + Math.sin(a) * 1.4, 1, 0xffe08a, 2); }
          if (t >= refl) {
            stage = "open"; t = 0; b.reflect = false; b.tint = null;
            if ((M.stats.reflected || 0) === r0) M.stats.dodged++;
            b.weakOpen = true; b.weakMult = C.weakMult;
            if (b.rig.lidOpen) b.rig.lidOpen(1.6);
            G.Audio.boss("eye_open", { pos: b.pos });
            M.hint(T("boss.move.mirror.hint2"), open);
          }
          return false;
        }
        return t >= open;
      },
      end() { b.reflect = false; b.tint = null; b.weakOpen = false; b.weakMult = 1.5; if (b.rig.lidOpen) b.rig.lidOpen(1); },
    };
  };

  // ================================================================
  // Headmaster Bellow
  // ================================================================
  // Detention: a chalk ring round you closing in; out through the green gap
  ABIL.detention = function (M, game, b) {
    const C = MV().detention, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const wind = M.ws(game, C.wind) * W, close = M.ws(game, C.close), R0 = C.radius, gapHalf = C.gapDeg * Math.PI / 360;
    const cx = P.x, cz = P.z;
    // the way out: a side that leads somewhere open, away from him if it can
    let gapYaw = 0, best = -1;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + Math.random() * 0.3;
      const ex = cx + Math.sin(a) * (R0 + 2), ez = cz + Math.cos(a) * (R0 + 2);
      const open = ex > A.rect.minX + 1 && ex < A.rect.maxX - 1 && ez > A.rect.minZ + 1 && ez < A.rect.maxZ - 1;
      const s = (open ? 10 : 0) + Math.min(12, Math.hypot(ex - b.pos.x, ez - b.pos.z)) * 0.3 + Math.random();
      if (s > best) { best = s; gapYaw = a; }
    }
    let t = 0, R = R0, inside = true, lineCd = 0;
    const ring = FX.decal({ mode: "ring", x: cx, z: cz, r: R0, w: 0.45, color: 0xff4a3a, opacity: 0.95, add: true });
    const exit = FX.decal({ mode: "sector", x: cx, z: cz, r: R0 + 1.4, half: gapHalf, w: 0.3, color: 0x6bff7a, opacity: 0.7, yaw: gapYaw, prog: 0, add: true });
    const inGap = (x, z) => Math.abs(ang(Math.atan2(x - cx, z - cz) - gapYaw)) < gapHalf;
    G.Audio.boss("school_bell", { pos: b.pos });
    hint(M, "detention", wind + close);
    return {
      holdFacing: true,
      update(dt) {
        t += dt; lineCd -= dt;
        M.face(b, cx, cz, dt * 3);
        b.pose.armR = [-2.5, -0.2]; b.pose.head = -0.2;
        const k = t < wind ? 0 : Math.min(1, (t - wind) / close);
        R = R0 - (R0 - 1.2) * k;
        ring.set({ r: R });
        exit.set({ r: R + 1.4, prog: Math.min(1, t / wind) });
        const d = Math.hypot(P.x - cx, P.z - cz);
        if (inside && d > R - 0.15) {
          if (inGap(P.x, P.z)) inside = false;
          else {
            // the chalk line holds: back inside, and it stings
            const push = d - (R - 0.4);
            game.tryMove(-(P.x - cx) / (d || 1) * push, -(P.z - cz) / (d || 1) * push);
            if (lineCd <= 0) { lineCd = 0.6; M.hurt(game, C.lineDamage, { src: "detention" }); FX.sparks(P.x, A.floorY + 0.4, P.z, 8, 0xff4a3a, 3); G.Audio.boss("chalk", { pos: P }); }
          }
        }
        b.dangers = [{ kind: "cage", x: cx, z: cz, r: R, gapYaw, gapHalf, trapped: inside, at: Math.max(0, wind + close - t) }];
        if (k < 1) return false;
        if (inside && Math.hypot(P.x - cx, P.z - cz) < R + 0.5) {
          M.hurt(game, C.trapped, { src: "detention" });
          game.bossRootT = C.root;
          FX.shock(cx, cz, 3, 0xff4a3a, 0.5);
          G.Audio.boss("detention_shut", { pos: P });
        } else M.stats.dodged++;
        return true;
      },
      end() { ring.hide(); exit.hide(); b.dangers = []; b.pose = {}; },
    };
  };

  // School Assembly: everything burns but one green circle; then again
  ABIL.assembly = function (M, game, b) {
    const C = MV().assembly, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const r0 = M.ws(game, C.radius), w0 = M.ws(game, C.warn) * W;
    const rounds = [{ r: r0, warn: w0 }, { r: r0 * C.secondRadius, warn: w0 * C.secondWarn }];
    const big = Math.hypot(A.rect.maxX - A.rect.minX, A.rect.maxZ - A.rect.minZ) + 10;
    let i = 0, t = 0, stage = "warn", cur = null, burnt = false, zone = null, hole = null;
    const start = () => {
      cur = rounds[i];
      const s = spotNear(M, b, P.x, P.z, C.near, C.far, cur.r + 1);
      cur.x = s.x; cur.z = s.z; t = 0; stage = "warn"; burnt = false;
      if (!zone) zone = FX.decal({ mode: "disc", x: s.x, z: s.z, r: cur.r, w: 0.5, color: 0x6bff7a, opacity: 0.95, prog: 0, add: true });
      if (!hole) hole = FX.decal({ mode: "hole", x: s.x, z: s.z, r: cur.r, len: big, w: 0.9, color: 0xff3020, opacity: 0.8, prog: 0 });
      zone.set({ x: s.x, z: s.z, r: cur.r, prog: 0 });
      hole.set({ x: s.x, z: s.z, r: cur.r, len: big, prog: 0 });
      G.Audio.boss(i ? "pa_again" : "pa", { pos: b.pos });
    };
    start();
    hint(M, "assembly");
    return {
      update(dt) {
        t += dt;
        b.pose.armL = [-2.6, 0.9]; b.pose.armR = [-2.6, -0.9]; b.pose.head = -0.3;
        if (b.rig.jawOpen) b.rig.jawOpen(stage === "burn" ? 0.8 : 0.3);
        const d = Math.hypot(P.x - cur.x, P.z - cur.z);
        if (stage === "warn") {
          zone.set({ prog: Math.min(1, t / cur.warn) }); hole.set({ prog: Math.min(1, t / cur.warn) });
          b.dangers = [{ kind: "safe", x: cur.x, z: cur.z, r: cur.r, at: Math.max(0, cur.warn - t) }];
          if (t >= cur.warn) { stage = "burn"; t = 0; G.Audio.boss("assembly_burn", { pos: b.pos }); game.shake(0.04, 0.3); }
          return false;
        }
        b.dangers = [{ kind: "safe", x: cur.x, z: cur.z, r: cur.r, at: 0 }];
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * TAU, rr = cur.r + 1 + Math.random() * 12;
          FX.sparks(cur.x + Math.sin(a) * rr, A.floorY + 0.1, cur.z + Math.cos(a) * rr, 1, 0xff5a2a, 3);
        }
        if (d > cur.r) { M.dot(game, C.dps, dt, "assembly"); burnt = true; }
        if (t < C.burn) return false;
        if (!burnt) M.stats.dodged++;
        if (++i >= rounds.length) return true;
        start();
        return false;
      },
      end() { if (zone) zone.hide(); if (hole) hole.hide(); if (b.rig.jawOpen) b.rig.jawOpen(0); b.dangers = []; b.pose = {}; },
    };
  };

  // ================================================================
  // Matron Mildred
  // ================================================================
  // Sedative Volley: a fan of needles; one slows you down
  ABIL.needles = function (M, game, b) {
    const C = MV().needles, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const lanes = 2 * Math.round((M.ws(game, C.lanes) - 1) / 2) + 1, wind = M.ws(game, C.wind) * W, volleys = Math.round(M.ws(game, C.volleys));
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0e0ff });
    let v = 0, t = 0, stage = "aim", marks = [], dirs = [], flying = [], sx = 0, sz = 0, hitV = false;
    const aim = () => {
      const base = Math.atan2(P.x - b.pos.x, P.z - b.pos.z);
      dirs = [];
      for (let i = 0; i < lanes; i++) dirs.push(base + (i - (lanes - 1) / 2) * C.step);
      sx = b.pos.x; sz = b.pos.z;
      marks.forEach((m) => m.hide());
      marks = dirs.map((a) => FX.decal({ mode: "lane", x: sx, z: sz, yaw: a, r: C.width, len: C.reach, w: 0.18, color: 0xd070ff, opacity: 0.85, prog: 0 }));
      t = 0; stage = "aim"; hitV = false;
      G.Audio.boss("needle_wind", { pos: b.pos });
    };
    aim();
    hint(M, "needles");
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.armL = [-1.6, 0.35]; b.pose.armR = [-1.6, -0.35];
        if (stage === "aim") {
          M.face(b, sx + Math.sin(dirs[(lanes - 1) >> 1]), sz + Math.cos(dirs[(lanes - 1) >> 1]), dt * 6);
          marks.forEach((m) => m.set({ prog: Math.min(1, t / wind) }));
          b.dangers = dirs.map((a) => ({ kind: "lane", x: sx, z: sz, dx: Math.sin(a), dz: Math.cos(a), len: C.reach, w: C.width, at: Math.max(0, wind - t) }));
          if (t < wind) return false;
          stage = "fly"; t = 0;
          G.Audio.boss("needles", { pos: b.pos });
          flying = dirs.map((a) => { const m = addMesh(game, geo, mat); m.rotation.y = a; return { m, a, d: b.rig.R * b.scale, on: true }; });
          marks.forEach((m) => m.set({ opacity: 0.35 }));
          return false;
        }
        if (stage === "fly") {
          let any = false;
          const dz = [];
          flying.forEach((f) => {
            if (!f.on) return;
            f.d += C.speed * dt;
            const x = sx + Math.sin(f.a) * f.d, z = sz + Math.cos(f.a) * f.d;
            f.m.position.set(x, A.floorY + 1.3, z);
            if (!hitV && Math.hypot(P.x - x, P.z - z) < C.width + 0.35 && grounded(game, M, 2)) {
              hitV = true; f.on = false; f.m.visible = false;
              M.hurt(game, C.damage, { src: "needles" });
              game.bossSedateT = C.slowTime; game.bossSedateK = C.slow;
              FX.sparks(P.x, A.floorY + 1, P.z, 8, 0xd070ff, 3);
            }
            if (f.d > C.reach) { f.on = false; f.m.visible = false; }
            if (f.on) { any = true; dz.push({ kind: "lane", x, z, dx: Math.sin(f.a), dz: Math.cos(f.a), len: C.reach - f.d, w: C.width, at: 0 }); }
          });
          b.dangers = dz;
          if (any) return false;
          if (!hitV) M.stats.dodged++;
          flying.forEach((f) => { if (f.m.parent) f.m.parent.remove(f.m); });
          flying = [];
          marks.forEach((m) => m.hide()); marks = [];
          if (++v >= volleys) return true;
          stage = "gap"; t = 0; b.dangers = [];
          return false;
        }
        if (t >= C.gap) aim();
        return false;
      },
      end() {
        marks.forEach((m) => m.hide());
        flying.forEach((f) => { if (f.m.parent) f.m.parent.remove(f.m); });
        geo.dispose(); mat.dispose();
        b.dangers = []; b.pose = {};
      },
    };
  };

  // Brood Sacs: eggs round you that hatch unless shot
  ABIL.eggs = function (M, game, b) {
    const C = MV().eggs, A = M.arena, P = game.yawObject.position;
    const n = Math.round(M.ws(game, C.count)), hatch = M.ws(game, C.hatch), flight = C.flight * M.warnK(game, b);
    let t = 0, thrown = 0;
    b.summoning = true;
    G.Audio.boss("gurgle", { pos: b.pos, voice: b.def.voice });
    hint(M, "eggs", 6);
    const toss = () => {
      handPos(b, tmp);
      const from = tmp.clone(), s = spotNear(M, b, P.x, P.z, C.near, C.far, 1.2), to = new V3(s.x, A.floorY + 0.5, s.z);
      const mesh = addMesh(game, new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshLambertMaterial({ color: 0xb25aff, emissive: 0x3a0a5a }));
      mesh.scale.set(1, 1.25, 1);
      const egg = { mesh, t: 0, stage: "fly", ring: null, tg: null };
      M.addObj({
        kind: "egg",
        update(game, dt) {
          egg.t += dt;
          if (egg.stage === "fly") {
            const k = Math.min(1, egg.t / flight);
            mesh.position.lerpVectors(from, to, k);
            mesh.position.y += Math.sin(k * Math.PI) * 3;
            if (k < 1) return true;
            egg.stage = "wait"; egg.t = 0;
            FX.burst(to.x, A.floorY + 0.2, to.z, 6, 0x7a3aaa, 2.5, 0.15, 2);
            G.Audio.boss("egg_land", { pos: to });
            egg.ring = FX.decal({ mode: "disc", x: to.x, z: to.z, r: 1.1, w: 0.25, color: 0xb25aff, opacity: 0.85, prog: 0, add: true });
            egg.tg = M.addTarget(game, { obj: mesh, r: 0.8, hp: C.hp, kind: "egg", onDown: () => {
              egg.stage = "gone";
              FX.burst(to.x, A.floorY + 0.5, to.z, 12, 0xb25aff, 3, 0.18, 3);
              G.Audio.boss("orb_pop", { pos: to });
              M.stats.dodged++;
            } });
            return true;
          }
          if (egg.stage === "gone") return false;
          const k = egg.t / hatch;
          mesh.scale.set(1 + 0.1 * Math.sin(egg.t * (5 + 12 * k)), 1.25 + 0.12 * Math.sin(egg.t * (5 + 12 * k)), 1);
          mesh.material.emissive.setHex(0x3a0a5a).multiplyScalar(1 + 2 * k);
          egg.ring.set({ prog: Math.min(1, k) });
          if (egg.t < hatch) return true;
          // it hatches
          FX.burst(to.x, A.floorY + 0.4, to.z, 14, 0xb25aff, 4, 0.2, 4);
          G.Audio.boss("hatch", { pos: to });
          rise(game, M, to.x, to.z, "fast");
          return false;
        },
        end() { if (egg.tg && !egg.tg.down) M.dropTarget(egg.tg); if (egg.ring) egg.ring.hide(); drop(mesh); },
      });
    };
    return {
      update(dt) {
        t += dt;
        b.pose.torso = 0.35; b.pose.armL = [-2.2, 0.3];
        b.chest = 0.1 + 0.05 * Math.sin(t * 20);
        while (thrown < n && t >= 0.5 + thrown * 0.3) { toss(); thrown++; FX.later(0.12, () => { b.pose.armL = [-0.4, 0.3]; }); }
        return thrown >= n && t >= 0.5 + n * 0.3;
      },
      end() { b.summoning = false; b.chest = 0; b.pose = {}; },
    };
  };

  // ================================================================
  // Coach Brutus
  // ================================================================
  // Medicine Ball: down a lane, off the walls, each new lane shown first
  ABIL.ball = function (M, game, b) {
    const C = MV().ball, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const speed = M.ws(game, C.speed), bounces = Math.round(M.ws(game, C.bounces)), warn = M.ws(game, C.warn) * W, R = C.radius;
    const tex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = "#7a3a1a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#e8d8b0"; g.lineWidth = 5; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); for (let x = 10; x < w; x += 16) { g.beginPath(); g.moveTo(x, h / 2 - 7); g.lineTo(x, h / 2 + 7); g.stroke(); } });
    const ball = addMesh(game, new THREE.SphereGeometry(R, 18, 14), new THREE.MeshLambertMaterial({ map: tex }));
    let stage = "wind", t = 0, leg = 0, dir = new V3(), pos = new V3(), len = 0, run = 0, lane = null, hitLeg = false, yaw = 0;
    handPos(b, tmp);
    pos.set(b.pos.x, A.floorY + R, b.pos.z);
    const plan = () => {
      yaw = Math.atan2(dir.x, dir.z);
      len = toWall(A, pos.x, pos.z, yaw, R + 0.1);
      if (lane) lane.hide();
      lane = FX.decal({ mode: "lane", x: pos.x, z: pos.z, yaw, r: R + 0.35, len: len + R, w: 0.3, color: 0xff7a2a, opacity: 0.9, prog: 0 });
      run = 0; hitLeg = false;
    };
    dir.set(P.x - b.pos.x, 0, P.z - b.pos.z).normalize();
    plan();
    G.Audio.boss("ball_wind", { pos: b.pos, voice: b.def.voice });
    hint(M, "ball");
    const laneD = () => [{ kind: "lane", x: pos.x, z: pos.z, dx: dir.x, dz: dir.z, len: Math.max(0, len - run) + R, w: R + 0.35, at: stage === "roll" ? 0 : Math.max(0, warn - t) }];
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        if (stage === "wind") {
          M.face(b, b.pos.x + dir.x, b.pos.z + dir.z, dt * 6);
          b.pose.armL = [-2.8, 0.6]; b.pose.armR = [-2.8, -0.6]; b.pose.torso = -0.2;
          handPos(b, tmp);
          ball.position.set(b.pos.x, tmp.y + 0.6, b.pos.z);
          lane.set({ prog: Math.min(1, t / warn) });
          b.dangers = laneD();
          if (t >= warn) { stage = "roll"; t = 0; b.pose = { torso: 0.4, armL: [-0.6, 0.6], armR: [-0.6, -0.6] }; G.Audio.boss("throw_heavy", { pos: b.pos }); }
          return false;
        }
        if (stage === "roll") {
          const step = speed * dt;
          pos.addScaledVector(dir, step); run += step;
          ball.position.set(pos.x, A.floorY + R, pos.z);
          ball.rotateOnWorldAxis(tmp2.set(dir.z, 0, -dir.x).normalize(), step / R);
          if (Math.random() < 0.5) FX.burst(pos.x - dir.x * R, A.floorY + 0.1, pos.z - dir.z * R, 1, 0x5a4a34, 1.5, 0.2, 1.5);
          lane.set({ x: pos.x, z: pos.z, len: Math.max(0.5, len - run + R), prog: 1 });
          b.dangers = laneD();
          if (!hitLeg && Math.hypot(P.x - pos.x, P.z - pos.z) < R + 0.55 && grounded(game, M, 2.2)) {
            hitLeg = true;
            const side = (P.x - pos.x) * dir.z - (P.z - pos.z) * dir.x >= 0 ? 1 : -1;
            M.hurt(game, C.damage, { push: { x: pos.x - dir.z * side * 2, z: pos.z + dir.x * side * 2, d: C.push }, src: "ball" });
          }
          if (run < len) return false;
          if (!hitLeg) M.stats.dodged++;
          if (++leg > bounces) { lane.hide(); stage = "stop"; t = 0; b.dangers = []; return false; }
          // off the wall, and a little towards the player
          const r = A.rect;
          if (pos.x <= r.minX + R + 0.3 || pos.x >= r.maxX - R - 0.3) dir.x = -dir.x;
          if (pos.z <= r.minZ + R + 0.3 || pos.z >= r.maxZ - R - 0.3) dir.z = -dir.z;
          tmp2.set(P.x - pos.x, 0, P.z - pos.z).normalize();
          dir.multiplyScalar(0.55).addScaledVector(tmp2, 0.45).normalize();
          G.Audio.boss("bounce", { pos });
          FX.shock(pos.x, pos.z, 2.5, 0xff7a2a, 0.4);
          plan();
          stage = "wait"; t = 0;
          return false;
        }
        if (stage === "wait") {
          ball.rotation.y += dt * 8;
          lane.set({ prog: Math.min(1, t / (warn * 0.8)) });
          b.dangers = laneD();
          if (t >= warn * 0.8) { stage = "roll"; t = 0; }
          return false;
        }
        // (stop) it rolls to a halt and deflates
        ball.scale.setScalar(Math.max(0.01, 1 - t * 2));
        return t >= 0.5;
      },
      end() { if (lane) lane.hide(); drop(ball); b.dangers = []; b.pose = {}; },
    };
  };

  // Offensive Line: a wall of ghost linemen across the arena, with gaps
  ABIL.line = function (M, game, b) {
    const C = MV().line, A = M.arena, P = game.yawObject.position, r = A.rect, W = M.warnK(game, b);
    const speed = M.ws(game, C.speed), gapW = M.ws(game, C.gapWidth), nGaps = Math.round(M.ws(game, C.gaps)), warn = M.ws(game, C.warn) * W;
    // it runs the long way, from the boss's end to the far one
    const alongZ = (r.maxZ - r.minZ) >= (r.maxX - r.minX);
    const cz = (r.minZ + r.maxZ) / 2, cx = (r.minX + r.maxX) / 2;
    const s = alongZ ? (b.pos.z < cz ? 1 : -1) : (b.pos.x < cx ? 1 : -1);
    const start = alongZ ? (s > 0 ? r.minZ : r.maxZ) : (s > 0 ? r.minX : r.maxX);
    const finish = alongZ ? (s > 0 ? r.maxZ : r.minZ) : (s > 0 ? r.maxX : r.minX);
    const lo = alongZ ? r.minX : r.minZ, hi = alongZ ? r.maxX : r.maxZ;
    const pA = alongZ ? P.x : P.z;
    // the gaps: one always within a sprint of the player (but not where they
    // already stand), the rest anywhere, never touching
    const gMin = lo + gapW / 2 + 0.3, gMax = hi - gapW / 2 - 0.3;
    const off = () => gapW * 0.5 + 1.2 + Math.random() * 4;
    const side = Math.random() < 0.5 ? -1 : 1, o0 = off();
    let g0 = pA + side * o0;
    if (g0 < gMin || g0 > gMax) g0 = pA - side * o0;
    const gaps = [Math.max(gMin, Math.min(gMax, g0))];
    for (let k = 0; k < 40 && gaps.length < nGaps; k++) {
      const g = gMin + Math.random() * (gMax - gMin);
      if (gaps.some((q) => Math.abs(q - g) < gapW * 1.6) || Math.abs(g - pA) < gapW * 0.5 + 0.8) continue;
      gaps.push(g);
    }
    const inGap = (a) => gaps.some((g) => Math.abs(a - g) < gapW / 2);
    const segs = [];
    const geo = new THREE.BoxGeometry(C.seg - 0.15, 2.3, C.depth), mat = glow(0xff8a2a, 0.35);
    for (let a = lo + C.seg / 2; a < hi; a += C.seg) {
      if (inGap(a)) continue;
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      if (!alongZ) m.rotation.y = Math.PI / 2;
      game.scene.add(m);
      segs.push({ a, m });
    }
    const w2d = (along, across) => (alongZ ? { x: across, z: along } : { x: along, z: across });
    const dirX = alongZ ? 0 : s, dirZ = alongZ ? s : 0, yaw = Math.atan2(dirX, dirZ);
    const marks = gaps.map((g) => { const p = w2d(start, g); return FX.decal({ mode: "lane", x: p.x, z: p.z, yaw, r: gapW / 2 - 0.2, len: Math.abs(finish - start), w: 0.3, color: 0x6bff7a, opacity: 0.55, prog: 0, add: true }); });
    let t = 0, stage = "warn", front = start, hit = false;
    G.Audio.boss("line_wind", { pos: b.pos, voice: b.def.voice });
    FX.later(warn * 0.5, () => G.Audio.boss("whistle", { pos: b.pos }));
    hint(M, "line", warn + 4);
    const place = () => segs.forEach((q) => { const p = w2d(front, q.a); q.m.position.set(p.x, A.floorY + 1.15, p.z); });
    place();
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.armR = [-2.9, -0.2]; b.pose.head = -0.2;
        // (a blocked column is marked end to end: there is no getting behind
        // the line but through a gap)
        const all = Math.abs(finish - start);
        b.dangers = segs.map((q) => { const p = w2d(start, q.a); return { kind: "lane", x: p.x, z: p.z, dx: dirX, dz: dirZ, len: all, w: C.seg / 2, at: stage === "warn" ? Math.max(0, warn - t) : 0 }; });
        if (stage === "warn") {
          mat.opacity = 0.2 + 0.2 * Math.abs(Math.sin(t * 8));
          marks.forEach((m) => m.set({ prog: Math.min(1, t / warn) }));
          if (t >= warn) { stage = "run"; t = 0; mat.opacity = 0.45; G.Audio.boss("stampede", { pos: b.pos }); }
          return false;
        }
        front += s * speed * dt;
        place();
        if (Math.random() < 0.6) { const q = segs[Math.floor(Math.random() * segs.length)]; if (q) FX.burst(q.m.position.x, A.floorY + 0.1, q.m.position.z, 1, 0x5a4a34, 1.5, 0.2, 1.5); }
        // (the linemen themselves: what is seen is what hits)
        const pAlong = alongZ ? P.z : P.x, pAcross = alongZ ? P.x : P.z;
        if (!hit && Math.abs(pAlong - front) < C.depth / 2 + 0.4 && segs.some((q) => Math.abs(pAcross - q.a) < C.seg / 2 + 0.25)) {
          hit = true;
          M.hurt(game, C.damage, { push: { x: P.x - dirX * 2, z: P.z - dirZ * 2, d: C.push }, src: "line" });
        }
        if ((s > 0 && front < finish) || (s < 0 && front > finish)) return false;
        if (!hit) M.stats.dodged++;
        return true;
      },
      end() {
        segs.forEach((q) => { if (q.m.parent) q.m.parent.remove(q.m); });
        geo.dispose(); mat.dispose();
        marks.forEach((m) => m.hide());
        b.dangers = []; b.pose = {};
      },
    };
  };

  // ================================================================
  // Hedge Thornwood
  // ================================================================
  // Barkskin: bark over everything but the heart, which opens now and then
  ABIL.bark = function (M, game, b) {
    const C = MV().bark, wind = C.wind * M.warnK(game, b), time = M.ws(game, C.time), open = M.ws(game, C.open), closed = M.ws(game, C.closed);
    const lam = b.rig.shared.lambert;
    let t = 0;
    replaceObj(M, "bark");
    G.Audio.boss("bark", { pos: b.pos, voice: b.def.voice });
    hint(M, "bark", wind + time);
    const armour = () => {
      let at = 0, cyc = 0, isOpen = false;
      M.addObj({
        kind: "bark",
        update(game, dt) {
          at += dt; cyc += dt;
          b.armor = C.armor; b.speedBoost = C.speed;
          lam.color.setScalar(0.55);
          if (!isOpen && cyc >= closed) {
            isOpen = true; cyc = 0; b.weakOpen = true; b.weakMult = C.heartMult; b.coreBoost = 1.2;
            G.Audio.boss("heart", { pos: b.pos });
          } else if (isOpen && cyc >= open) {
            isOpen = false; cyc = 0; b.weakOpen = false; b.weakMult = 1.5; b.coreBoost = 0;
          }
          if (isOpen && Math.random() < 0.3) FX.sparks(b.pos.x, b.pos.y + b.rig.H * 0.55 * b.scale, b.pos.z, 1, 0xffb03a, 2);
          return at < time;
        },
        end() { b.armor = 1; b.speedBoost = 1; b.weakOpen = false; b.weakMult = 1.5; b.coreBoost = 0; lam.color.setScalar(1); G.Audio.boss("bark_off", { pos: b.pos }); },
      });
    };
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / wind);
        lam.color.setScalar(1 - 0.45 * k);
        b.pose.armL = [-0.4, 1.2]; b.pose.armR = [-0.4, -1.2]; b.pose.torso = 0.2;
        b.chest = 0.08 * k;
        if (Math.random() < 0.5) FX.burst(b.pos.x, b.pos.y + Math.random() * b.rig.H * b.scale, b.pos.z, 1, 0x4a3a2a, 2, 0.2, 2);
        if (t < wind) return false;
        armour();
        return true;
      },
      end() { b.pose = {}; b.chest = 0; if (!M.objs.some((o) => o.kind === "bark")) lam.color.setScalar(1); },
    };
  };

  // Overgrowth: lines out from him burst into thorn walls that stay
  ABIL.overgrowth = function (M, game, b) {
    const C = MV().overgrowth, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const n = Math.round(M.ws(game, C.lines)), wind = M.ws(game, C.wind) * W, stay = M.ws(game, C.stay);
    replaceObj(M, "overgrowth");
    const base = Math.atan2(P.x - b.pos.x, P.z - b.pos.z), R0 = b.rig.R * b.scale + 0.6;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = base + i / n * TAU;
      const x0 = b.pos.x + Math.sin(a) * R0, z0 = b.pos.z + Math.cos(a) * R0;
      const len = Math.min(C.reach, toWall(A, x0, z0, a, 0.5));
      lines.push({ a, x0, z0, x1: x0 + Math.sin(a) * len, z1: z0 + Math.cos(a) * len, len });
    }
    const marks = lines.map((l) => FX.decal({ mode: "lane", x: l.x0, z: l.z0, yaw: l.a, r: C.width / 2 + 0.1, len: l.len, w: 0.2, color: 0xc0602a, opacity: 0.9, prog: 0 }));
    let t = 0, erupted = false;
    G.Audio.boss("overgrowth_wind", { pos: b.pos, voice: b.def.voice });
    hint(M, "overgrowth");
    const onLine = (x, z) => lines.some((l) => segDist(x, z, l.x0, l.z0, l.x1, l.z1) < C.width / 2 + 0.3);
    const lineD = (at) => lines.map((l) => ({ kind: "lane", x: l.x0, z: l.z0, dx: Math.sin(l.a), dz: Math.cos(l.a), len: l.len, w: C.width / 2, at }));
    // the thorn walls: spikes 450 on (three slots of 90 in G.BossFX.spikes)
    const SPK = 450, MAXS = 270;
    const spikes = [];
    lines.forEach((l) => { for (let d = 0; d < l.len && spikes.length < MAXS; d += 0.55) spikes.push({ x: l.x0 + Math.sin(l.a) * d + (Math.random() - 0.5) * 0.4, z: l.z0 + Math.cos(l.a) * d + (Math.random() - 0.5) * 0.4, h: 0.8 + Math.random() * 0.8, ry: Math.random() * TAU }); });
    const drawSpikes = (k) => spikes.forEach((s, i) => FX.spike(SPK + i, s.x, A.floorY, s.z, Math.sin(i * 3.1) * 0.3, s.ry, Math.cos(i * 2.3) * 0.3, 1.1, Math.max(0.0001, s.h * k)));
    const hideSpikes = () => { for (let i = 0; i < MAXS; i++) FX.spike(SPK + i, 0, -999, 0, 0, 0, 0, 0.0001, 0.0001); };
    const walls = () => {
      let at = 0;
      M.addObj({
        kind: "overgrowth",
        update(game, dt) {
          at += dt;
          const k = at < stay - 0.8 ? 1 : Math.max(0, (stay - at) / 0.8);
          drawSpikes(k);
          if (k > 0.3 && onLine(P.x, P.z) && grounded(game, M)) {
            M.dot(game, C.dps, dt, "overgrowth");
            game.bossSedateT = Math.max(game.bossSedateT || 0, 0.3); game.bossSedateK = C.slow;
          }
          return at < stay;
        },
        dangers() { return lineD(0); },
        end() { hideSpikes(); marks.forEach((m) => m.hide()); },
      });
    };
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.torso = 0.7; b.pose.armL = [-0.2, 0.4]; b.pose.armR = [-0.2, -0.4];
        b.coreBoost = 0.5 * Math.min(1, t / wind);
        if (!erupted) {
          marks.forEach((m) => m.set({ prog: Math.min(1, t / wind) }));
          b.dangers = lineD(Math.max(0, wind - t));
          if (Math.random() < 0.4) { const l = G.pick(lines), d = Math.random() * l.len; FX.chunk(l.x0 + Math.sin(l.a) * d, A.floorY + 0.1, l.z0 + Math.cos(l.a) * d, 0, 2, 0, 0.15, 0x3a2e22, 0.6); }
          if (t < wind) return false;
          erupted = true;
          drawSpikes(1);
          G.Audio.boss("overgrowth", { pos: b.pos });
          game.shake(0.06, 0.3);
          lines.forEach((l) => { for (let d = 1; d < l.len; d += 3) FX.burst(l.x0 + Math.sin(l.a) * d, A.floorY + 0.2, l.z0 + Math.cos(l.a) * d, 2, 0x3a2e22, 3, 0.2, 3); });
          if (onLine(P.x, P.z) && grounded(game, M)) {
            // thrown off the line it burst under
            const l = lines.reduce((a, q) => (segDist(P.x, P.z, q.x0, q.z0, q.x1, q.z1) < segDist(P.x, P.z, a.x0, a.z0, a.x1, a.z1) ? q : a));
            const side = (P.x - l.x0) * Math.cos(l.a) - (P.z - l.z0) * Math.sin(l.a) >= 0 ? 1 : -1;
            M.hurt(game, C.damage, { push: { x: P.x - Math.cos(l.a) * side, z: P.z + Math.sin(l.a) * side, d: 1.6 }, src: "overgrowth" });
          } else M.stats.dodged++;
          walls();
          b.dangers = [];
          return false;
        }
        return t >= wind + 0.4;
      },
      end() { if (!erupted) marks.forEach((m) => m.hide()); b.coreBoost = 0; b.dangers = []; b.pose = {}; },
    };
  };

  // ================================================================
  // Crackwell
  // ================================================================
  // Tesla Pylons: rods round you, arcs flicker then crackle between them
  ABIL.pylons = function (M, game, b) {
    const C = MV().pylons, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const n = Math.round(M.ws(game, C.count)), wind = C.wind * W, on = M.ws(game, C.on), off = M.ws(game, C.off), flick = M.ws(game, C.flicker) * W;
    replaceObj(M, "pylons");
    const a0 = Math.random() * TAU, spots = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * TAU, d = 6 + Math.random() * 2.5;
      spots.push(inRect(A, P.x + Math.sin(a) * d, P.z + Math.cos(a) * d, 2));
    }
    const marks = spots.map((p) => FX.decal({ mode: "disc", x: p.x, z: p.z, r: C.radius, w: 0.3, color: 0x6ad8ff, opacity: 0.95, prog: 0, add: true }));
    let t = 0;
    b.charging = true;
    G.Audio.boss("pylon_wind", { pos: b.pos });
    hint(M, "pylons", wind + 6);
    const build = () => {
      const pyl = spots.map((p) => {
        const g = new THREE.Group();
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 8), new THREE.MeshLambertMaterial({ color: 0xb87333 }));
        rod.position.y = 1.6;
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), new THREE.MeshBasicMaterial({ color: 0x9ae8ff }));
        top.position.y = 3.3;
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 6, 16), new THREE.MeshLambertMaterial({ color: 0xd08a4a }));
        coil.rotation.x = Math.PI / 2; coil.position.y = 2.4;
        g.add(rod); g.add(top); g.add(coil);
        g.position.set(p.x, A.floorY, p.z);
        g.traverse((o) => { o.frustumCulled = false; });
        game.scene.add(g);
        const q = { g, top, x: p.x, z: p.z, alive: true };
        q.tg = M.addTarget(game, { obj: g, r: 0.9, y: 2.2, hp: C.hp, kind: "pylon", onDown: () => {
          q.alive = false;
          FX.sparks(q.x, A.floorY + 3, q.z, 20, 0x9ae8ff, 6);
          FX.burst(q.x, A.floorY + 1.5, q.z, 8, 0xb87333, 3, 0.2, 3);
          G.Audio.boss("pylon_break", { pos: g.position });
          g.visible = false;
        } });
        return q;
      });
      const pairs = [];
      for (let i = 0; i < pyl.length; i++) { const j = (i + 1) % pyl.length; if (pyl.length > 2 || i === 0) pairs.push([pyl[i], pyl[j]]); }
      const lanes = pairs.map(([p, q]) => FX.decal({ mode: "lane", x: p.x, z: p.z, yaw: Math.atan2(q.x - p.x, q.z - p.z), r: C.width, len: Math.hypot(q.x - p.x, q.z - p.z), w: 0.15, color: 0x6ad8ff, opacity: 0, prog: 0, add: true }));
      let at = 0, cyc = 0, stage = "off", hitCyc = false, boltT = 0;
      const live = () => pairs.map((pq, i) => ({ pq, i })).filter(({ pq }) => pq[0].alive && pq[1].alive);
      M.addObj({
        kind: "pylons",
        update(game, dt) {
          at += dt; cyc += dt;
          pyl.forEach((q) => { if (q.alive) q.top.material.color.setHex(0x9ae8ff).multiplyScalar(stage === "on" ? 1.4 : stage === "flicker" ? (Math.random() < 0.5 ? 1.3 : 0.6) : 0.8); });
          const L = live();
          lanes.forEach((l) => l.set({ opacity: 0 }));
          if (stage === "off") { if (cyc >= off) { stage = "flicker"; cyc = 0; G.Audio.boss("arc_charge", { pos: pyl[0].g.position }); } }
          else if (stage === "flicker") {
            L.forEach(({ i }) => lanes[i].set({ opacity: Math.random() < 0.5 ? 0.9 : 0.25, prog: Math.min(1, cyc / flick) }));
            if (cyc >= flick) { stage = "on"; cyc = 0; hitCyc = false; G.Audio.boss("zap", { pos: pyl[0].g.position }); }
          } else {
            L.forEach(({ i }) => lanes[i].set({ opacity: 0.95, prog: 1 }));
            if ((boltT -= dt) <= 0) {
              boltT = 0.09;
              L.forEach(({ pq }) => FX.bolt(tmp.set(pq[0].x, A.floorY + 3.3, pq[0].z).clone(), tmp2.set(pq[1].x, A.floorY + 3.3, pq[1].z).clone(), 0x9ae8ff));
              L.forEach(({ pq }) => FX.bolt(tmp.set(pq[0].x, A.floorY + 1.0, pq[0].z).clone(), tmp2.set(pq[1].x, A.floorY + 1.0, pq[1].z).clone(), 0x6ad8ff));
            }
            if (!hitCyc && L.some(({ pq }) => segDist(P.x, P.z, pq[0].x, pq[0].z, pq[1].x, pq[1].z) < C.width + 0.3)) {
              hitCyc = true;
              M.hurt(game, C.damage, { src: "pylons" });
              FX.sparks(P.x, P.y - 0.8, P.z, 12, 0x9ae8ff, 5);
            }
            if (cyc >= on) { stage = "off"; cyc = 0; }
          }
          const alive = pyl.some((q) => q.alive);
          return at < C.life && alive && L.length > 0;
        },
        dangers() {
          if (stage === "off") return [];
          return live().map(({ pq }) => { const dx = pq[1].x - pq[0].x, dz = pq[1].z - pq[0].z, l = Math.hypot(dx, dz) || 1; return { kind: "lane", x: pq[0].x, z: pq[0].z, dx: dx / l, dz: dz / l, len: l, w: C.width, at: stage === "flicker" ? Math.max(0, flick - cyc) : 0 }; });
        },
        end() {
          lanes.forEach((l) => l.hide());
          pyl.forEach((q) => { if (q.tg && !q.tg.down) M.dropTarget(q.tg); drop(q.g); });
        },
      });
    };
    return {
      update(dt) {
        t += dt;
        b.pose.armL = [-2.8, 0.5]; b.pose.armR = [-2.8, -0.5];
        marks.forEach((m) => m.set({ prog: Math.min(1, t / wind) }));
        b.dangers = spots.map((p) => ({ kind: "circle", x: p.x, z: p.z, r: C.radius, at: Math.max(0, wind - t) }));
        if (t < wind) return false;
        // each comes down on a bolt of lightning
        spots.forEach((p) => { FX.bolt(new V3(p.x, A.floorY + 30, p.z), new V3(p.x, A.floorY, p.z)); FX.shock(p.x, p.z, C.radius + 1.2, 0x9ae8ff, 0.4); });
        G.Audio.boss("thunder", { pos: b.pos });
        if (spots.some((p) => Math.hypot(P.x - p.x, P.z - p.z) < C.radius + 0.3)) M.hurt(game, C.dropDamage, { src: "pylons" });
        build();
        return true;
      },
      end() { marks.forEach((m) => m.hide()); b.charging = false; b.dangers = []; b.pose = {}; },
    };
  };

  // Arc Barrage: a line follows you, locks white, then a bolt goes down it
  ABIL.arcs = function (M, game, b) {
    const C = MV().arcs, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const shots = Math.round(M.ws(game, C.shots)), track = M.ws(game, C.track) * W, lock = M.ws(game, C.lock) * W, gap = M.ws(game, C.gap);
    let i = 0, t = 0, stage = "track", yaw = 0, len = 0, sx = 0, sz = 0;
    const lane = FX.decal({ mode: "lane", x: b.pos.x, z: b.pos.z, yaw: 0, r: C.width, len: 10, w: 0.15, color: 0x6ad8ff, opacity: 0.6, prog: 0, add: true });
    b.charging = true;
    G.Audio.boss("arcs_wind", { pos: b.pos });
    hint(M, "arcs");
    const aimNow = () => {
      sx = b.pos.x; sz = b.pos.z;
      yaw = Math.atan2(P.x - sx, P.z - sz);
      len = toWall(A, sx, sz, yaw, 0.3);
    };
    aimNow();
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.armR = [-1.6, -0.1];
        if (stage === "track") {
          aimNow();
          M.face(b, P.x, P.z, dt * 8);
          lane.set({ x: sx, z: sz, yaw, len, color: 0x6ad8ff, opacity: 0.55, prog: Math.min(1, t / (track + lock)) });
          b.dangers = [{ kind: "lane", x: sx, z: sz, dx: Math.sin(yaw), dz: Math.cos(yaw), len, w: C.width, at: track + lock - t }];
          if (t >= track) { stage = "lock"; t = 0; lane.set({ color: 0xffffff, opacity: 0.95 }); G.Audio.boss("lock", { pos: b.pos }); }
          return false;
        }
        if (stage === "lock") {
          lane.set({ prog: Math.min(1, (track + t) / (track + lock)) });
          b.dangers = [{ kind: "lane", x: sx, z: sz, dx: Math.sin(yaw), dz: Math.cos(yaw), len, w: C.width, at: Math.max(0, lock - t) }];
          if (t < lock) return false;
          // the bolt, down the line
          handPos(b, tmp);
          const end = new V3(sx + Math.sin(yaw) * len, A.floorY + 1.2, sz + Math.cos(yaw) * len);
          FX.bolt(tmp.clone(), end, 0xcff4ff);
          FX.bolt(tmp.clone(), end, 0x6ad8ff);
          G.Perf.flash(new V3((tmp.x + end.x) / 2, A.floorY + 1.5, (tmp.z + end.z) / 2), 0xcfe8ff, 3, 16, 80);
          G.Audio.boss("zap", { pos: b.pos });
          const d = segDist(P.x, P.z, sx, sz, end.x, end.z);
          if (d < C.width + 0.3) { M.hurt(game, C.damage, { src: "arcs" }); FX.sparks(P.x, P.y - 0.6, P.z, 10, 0x9ae8ff, 5); } else M.stats.dodged++;
          stage = "gap"; t = 0; lane.set({ opacity: 0 }); b.dangers = [];
          return false;
        }
        if (t < gap) return false;
        if (++i >= shots) return true;
        stage = "track"; t = 0;
        return false;
      },
      end() { lane.hide(); b.charging = false; b.dangers = []; b.pose = {}; },
    };
  };

  // ================================================================
  // Professor Vitriol
  // ================================================================
  // Acid Sprayer: a cone that sweeps from one side to the other
  ABIL.spray = function (M, game, b) {
    const C = MV().spray, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const wind = M.ws(game, C.wind) * W, time = M.ws(game, C.time);
    const base = Math.atan2(P.x - b.pos.x, P.z - b.pos.z), sgn = Math.random() < 0.5 ? 1 : -1;
    const a0 = base - sgn * C.sweep / 2, a1 = base + sgn * C.sweep / 2;
    const whole = FX.decal({ mode: "sector", x: b.pos.x, z: b.pos.z, r: C.reach, half: C.sweep / 2 + C.half, w: 0.3, color: 0x7aff3a, opacity: 0.35, yaw: base, prog: 0 });
    const cone = FX.decal({ mode: "sector", x: b.pos.x, z: b.pos.z, r: C.reach, half: C.half, w: 0.35, color: 0x9aff4a, opacity: 0.95, yaw: a0, prog: 0, add: true });
    let t = 0, caught = false, loop = null;
    G.Audio.boss("spray_wind", { pos: b.pos, voice: b.def.voice });
    hint(M, "spray");
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        const x = b.pos.x, z = b.pos.z;
        b.pose.armR = [-1.5, -0.1]; b.pose.torso = 0.2;
        if (t < wind) {
          b.root.rotation.y += Math.max(-dt * 4, Math.min(dt * 4, ang(a0 - b.root.rotation.y)));
          whole.set({ x, z, prog: Math.min(1, t / wind) }); cone.set({ x, z, prog: Math.min(1, t / wind) });
          b.dangers = [{ kind: "sector", x, z, r: C.reach, yaw: base, half: C.sweep / 2 + C.half, at: wind - t }];
          if (t >= wind) loop = G.Audio.bossLoop("spray", { pos: b.pos });
          return false;
        }
        const k = Math.min(1, (t - wind) / time), yawNow = a0 + (a1 - a0) * k;
        b.root.rotation.y = yawNow;
        cone.set({ x, z, yaw: yawNow, prog: 1 });
        const restYaw = (yawNow + a1) / 2, restHalf = Math.abs(a1 - yawNow) / 2 + C.half;
        whole.set({ x, z, yaw: restYaw, half: restHalf, prog: 1 });
        handPos(b, tmp);
        for (let q = 0; q < 4; q++) {
          const a = yawNow + (Math.random() - 0.5) * C.half * 1.6, s = 8 + Math.random() * 6;
          FX.mote(tmp.x, tmp.y, tmp.z, Math.sin(a) * s, -1 + Math.random() * 2, Math.cos(a) * s, 0x8aff3a, 0.9, 0.8, -4);
        }
        const d = Math.hypot(P.x - x, P.z - z);
        if (d < C.reach && Math.abs(ang(Math.atan2(P.x - x, P.z - z) - yawNow)) < C.half) { M.dot(game, C.dps, dt, "spray"); caught = true; }
        b.dangers = [{ kind: "sector", x, z, r: C.reach, yaw: restYaw, half: restHalf, at: 0 }];
        if (k < 1) return false;
        if (!caught) M.stats.dodged++;
        return true;
      },
      end() { whole.hide(); cone.hide(); if (loop) loop.stop(); b.dangers = []; b.pose = {}; },
    };
  };

  // Miasma: a gas cloud that drifts after you; shoot its canister
  ABIL.miasma = function (M, game, b) {
    const C = MV().miasma, A = M.arena, P = game.yawObject.position;
    const flight = C.flight * M.warnK(game, b), speed = M.ws(game, C.speed), life = M.ws(game, C.life);
    replaceObj(M, "miasma");
    const s = spotNear(M, b, P.x, P.z, 4, 6, C.radius);
    const mark = FX.decal({ mode: "disc", x: s.x, z: s.z, r: C.radius, w: 0.3, color: 0x7aff3a, opacity: 0.9, prog: 0 });
    let t = 0, thrown = false, landed = false;
    G.Audio.boss("cackle", { pos: b.pos, voice: b.def.voice });
    hint(M, "miasma", flight + 5);
    const cloud = (x, z) => {
      const can = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), new THREE.MeshLambertMaterial({ color: 0x6a7068 }));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), new THREE.MeshBasicMaterial({ color: 0x8aff3a }));
      body.position.y = 0.45; band.position.y = 0.55;
      can.add(body); can.add(band);
      can.traverse((o) => { o.frustumCulled = false; });
      game.scene.add(can);
      const pos = new V3(x, A.floorY, z);
      can.position.copy(pos);
      const blob = FX.decal({ mode: "blob", x, z, r: C.radius, w: 0.6, color: 0x5aff1a, opacity: 0.55, y: A.floorY + 0.05, add: true });
      let at = 0, gone = false;
      const tg = M.addTarget(game, { obj: can, r: 0.7, y: 0.5, hp: C.hp, kind: "canister", onDown: () => {
        gone = true;
        FX.burst(pos.x, A.floorY + 0.5, pos.z, 10, 0x6a7068, 3, 0.2, 3);
        for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, r = Math.random() * C.radius; FX.mote(pos.x + Math.sin(a) * r, A.floorY + 0.3, pos.z + Math.cos(a) * r, Math.sin(a) * 3, 1, Math.cos(a) * 3, 0x8aff3a, 0.8, 1.5, 0); }
        G.Audio.boss("pop", { pos });
        M.stats.dodged++;
      } });
      M.addObj({
        kind: "miasma",
        update(game, dt) {
          at += dt;
          if (gone || at >= life) return false;
          tmp.set(P.x - pos.x, 0, P.z - pos.z);
          const d = tmp.length();
          if (d > 0.3) pos.addScaledVector(tmp, Math.min(d - 0.3, speed * dt) / d);
          const q = inRect(A, pos.x, pos.z, 0.5); pos.x = q.x; pos.z = q.z;
          can.position.copy(pos);
          can.rotation.y += dt * 2;
          blob.set({ x: pos.x, z: pos.z, opacity: 0.55 * Math.min(1, (life - at) / 1.2) });
          for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, r = Math.random() * C.radius; FX.mote(pos.x + Math.sin(a) * r, A.floorY + 0.2 + Math.random() * 1.6, pos.z + Math.cos(a) * r, 0, 0.3, 0, i % 2 ? 0x5aff1a : 0x3a9a1a, 1.4, 0.5, 0); }
          if (Math.hypot(P.x - pos.x, P.z - pos.z) < C.radius && P.y - 1.7 < A.floorY + 2.5) M.dot(game, C.dps, dt, "miasma");
          return true;
        },
        dangers() { return gone ? [] : [{ kind: "circle", x: pos.x, z: pos.z, r: C.radius, at: 0 }]; },
        end() { if (!tg.down) M.dropTarget(tg); blob.hide(); drop(can); },
      });
    };
    return {
      update(dt) {
        t += dt;
        mark.set({ prog: Math.min(1, t / (0.4 + flight)) });
        b.dangers = [{ kind: "circle", x: s.x, z: s.z, r: C.radius, at: Math.max(0, 0.4 + flight - t) }];
        if (!thrown && t >= 0.4) {
          thrown = true;
          handPos(b, tmp);
          b.pose.armL = [-2.6, 0.2];
          FX.later(0.15, () => { b.pose.armL = [-0.6, 0.2]; });
          FX.flask(tmp, new V3(s.x, A.floorY + 0.2, s.z), flight, 4, () => {
            landed = true; mark.hide();
            G.Audio.boss("gas", { pos: new V3(s.x, A.floorY + 1, s.z) });
            cloud(s.x, s.z);
          });
        }
        return landed;
      },
      end() { mark.hide(); b.dangers = []; b.pose = {}; },
    };
  };

  // ================================================================
  // Warden Vex
  // ================================================================
  // Lights Out: darkness, and he strikes from behind
  ABIL.blackout = function (M, game, b) {
    const C = MV().blackout, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const wind = C.wind * W, time = M.ws(game, C.time), blinks = Math.round(M.ws(game, C.blinks)), warn = M.ws(game, C.warn) * W;
    let t = 0, stage = "wind", bi = 0, bt = 0, wedge = null, wyaw = 0;
    G.Audio.boss("lights_out", { pos: b.pos });
    hint(M, "blackout", wind + time);
    const per = time / blinks;
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        if (stage === "wind") {
          const k = Math.min(1, t / wind);
          M.setDim(game, 1 - (1 - C.dim) * k);
          b.tint = { r: 0.3 * k, g: 0.05 * k, b: 0.45 * k };
          if (t >= wind) { stage = "dark"; t = 0; }
          return false;
        }
        if (stage === "dark") {
          M.setDim(game, C.dim);
          if (bi < blinks && !wedge && t >= bi * per + 0.3) {
            // gone, and behind the player
            FX.shock(b.pos.x, b.pos.z, 4, 0xa24aff, 0.5);
            const yaw = game.yawObject.rotation.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
            const q = inRect(A, P.x - fx * C.behind, P.z - fz * C.behind, b.rig.R + 0.5);
            b.pos.x = q.x; b.pos.z = q.z;
            wyaw = Math.atan2(P.x - b.pos.x, P.z - b.pos.z);
            b.root.rotation.y = wyaw;
            FX.shock(b.pos.x, b.pos.z, 4, 0xa24aff, 0.5);
            wedge = FX.decal({ mode: "sector", x: b.pos.x, z: b.pos.z, r: C.reach, half: 0.9, w: 0.3, color: 0xc070ff, opacity: 0.95, yaw: wyaw, prog: 0, add: true });
            bt = 0;
            G.Audio.boss("whisper", { pos: b.pos, voice: b.def.voice });
          }
          if (wedge) {
            bt += dt;
            wedge.set({ prog: Math.min(1, bt / warn) });
            b.pose.armR = [-2.6, -0.5];
            b.dangers = [{ kind: "sector", x: b.pos.x, z: b.pos.z, r: C.reach, yaw: wyaw, half: 0.9, at: Math.max(0, warn - bt) }];
            if (bt >= warn) {
              const dx = P.x - b.pos.x, dz = P.z - b.pos.z, d = Math.hypot(dx, dz);
              G.Audio.boss("swipe", { pos: b.pos });
              FX.sparks(b.pos.x + Math.sin(wyaw) * 2, A.floorY + 1.2, b.pos.z + Math.cos(wyaw) * 2, 10, 0xc070ff, 5);
              if (d < C.reach + 0.5 && Math.abs(ang(Math.atan2(dx, dz) - wyaw)) < 1.05 && grounded(game, M, 3)) M.hurt(game, C.damage, { push: { x: b.pos.x, z: b.pos.z, d: 2 }, src: "blackout" });
              else M.stats.dodged++;
              wedge.hide(); wedge = null; b.dangers = []; b.pose = {}; bi++;
            }
          }
          if (t >= time && !wedge) { stage = "light"; t = 0; G.Audio.boss("lights_on", { pos: b.pos }); }
          return false;
        }
        M.setDim(game, C.dim + (1 - C.dim) * Math.min(1, t / 0.8));
        b.tint = null;
        return t >= 0.8;
      },
      end() { M.setDim(game, 1); if (wedge) wedge.hide(); b.tint = null; b.dangers = []; b.pose = {}; },
    };
  };

  // Warden's Chains: a chain down a lane; caught, you are pulled in
  ABIL.chains = function (M, game, b) {
    const C = MV().chains, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const wind = M.ws(game, C.wind) * W;
    let t = 0, stage = "aim", yaw = 0, len = 0, sx = 0, sz = 0, head = 0, held = 0, link = null, linkTg = null, chain = null;
    const lane = FX.decal({ mode: "lane", x: b.pos.x, z: b.pos.z, yaw: 0, r: C.width, len: 10, w: 0.2, color: 0xa24aff, opacity: 0.9, prog: 0, add: true });
    G.Audio.boss("chain_wind", { pos: b.pos });
    hint(M, "chains");
    const aimNow = () => { sx = b.pos.x; sz = b.pos.z; yaw = Math.atan2(P.x - sx, P.z - sz); len = Math.min(C.reach, toWall(A, sx, sz, yaw, 0.3)); };
    aimNow();
    const snap = () => {
      stage = "done"; t = 0;
      if (linkTg && !linkTg.down) M.dropTarget(linkTg);
      if (link) { FX.sparks(link.position.x, link.position.y, link.position.z, 18, 0xc070ff, 5); drop(link); link = null; }
      if (chain) chain.hide();
      G.Audio.boss("chain_snap", { pos: b.pos });
    };
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.armR = [-1.7, -0.1];
        handPos(b, tmp);
        if (stage === "aim") {
          if (t < wind * 0.6) aimNow();
          M.face(b, sx + Math.sin(yaw), sz + Math.cos(yaw), dt * 8);
          lane.set({ x: sx, z: sz, yaw, len, prog: Math.min(1, t / wind), color: t < wind * 0.6 ? 0xa24aff : 0xe0b0ff });
          b.dangers = [{ kind: "lane", x: sx, z: sz, dx: Math.sin(yaw), dz: Math.cos(yaw), len, w: C.width, at: Math.max(0, wind - t) }];
          if (t < wind) return false;
          stage = "fly"; t = 0; head = b.rig.R;
          chain = FX.beam(0x7a2aff, 0xd8b0ff);
          G.Audio.boss("chain_throw", { pos: b.pos });
          return false;
        }
        if (stage === "fly") {
          head += C.fly * dt;
          const hx = sx + Math.sin(yaw) * head, hz = sz + Math.cos(yaw) * head;
          chain.set(tmp, tmp2.set(hx, A.floorY + 1.3, hz), 0.06);
          b.dangers = [{ kind: "lane", x: hx, z: hz, dx: Math.sin(yaw), dz: Math.cos(yaw), len: Math.max(0, len - head), w: C.width, at: 0 }];
          if (Math.hypot(P.x - hx, P.z - hz) < C.width + 0.4 && grounded(game, M, 2.5)) {
            // caught: the chain holds, a glowing link in the middle of it
            stage = "hold"; t = 0; lane.hide(); b.dangers = [];
            link = addMesh(game, new THREE.TorusGeometry(0.35, 0.12, 8, 16), new THREE.MeshBasicMaterial({ color: 0xe0b0ff }));
            linkTg = M.addTarget(game, { obj: link, r: 0.75, hp: C.hp, kind: "link", onDown: () => { M.stats.dodged++; snap(); } });
            G.Audio.boss("chain_hit", { pos: P });
            M.hint(T("boss.move.chains.hint2"), C.hold);
            return false;
          }
          if (head >= len) { M.stats.dodged++; lane.hide(); b.dangers = []; stage = "done"; t = 0; chain.hide(); }
          return false;
        }
        if (stage === "hold") {
          held += dt;
          tmp2.set(P.x, P.y - 0.6, P.z);
          chain.set(tmp, tmp2, 0.07);
          link.position.lerpVectors(tmp, tmp2, 0.5);
          link.rotation.y += dt * 3;
          const dx = b.pos.x - P.x, dz = b.pos.z - P.z, d = Math.hypot(dx, dz);
          const minD = b.rig.R * b.scale + 1.0;
          if (d > minD) { const s = Math.min(d - minD, C.pull * dt); game.tryMove(dx / d * s, dz / d * s); }
          else M.dot(game, C.touchDps, dt, "chains");
          if (held >= C.hold) { snap(); M.hint(null); }
          return false;
        }
        return t >= 0.3;
      },
      end() {
        lane.hide();
        if (chain) chain.hide();
        if (linkTg && !linkTg.down) M.dropTarget(linkTg);
        if (link) drop(link);
        b.dangers = []; b.pose = {};
      },
    };
  };

  // ================================================================
  // Examiner Quill
  // ================================================================
  // Multiple Choice: four of him holding words; the right one is real
  ABIL.choice = function (M, game, b) {
    const C = MV().choice, A = M.arena, P = game.yawObject.position;
    const wind = C.wind * M.warnK(game, b), time = M.ws(game, C.time);
    const pool = (game.wordPool || []).filter((p) => p && p[0] && p[1]);
    const ans = pool.length ? G.pick(pool) : G.getAllBuiltinWords()[0];
    const seen = new Set([ans[0].toLowerCase()]), mean = new Set([ans[1].trim()]);
    const others = [];
    G.shuffle(pool.slice()).forEach((p) => {
      if (others.length >= C.copies - 1 || seen.has(p[0].toLowerCase()) || mean.has(p[1].trim())) return;
      seen.add(p[0].toLowerCase()); mean.add(p[1].trim()); others.push(p);
    });
    let t = 0, split = false, hp0 = b.hp, result = null, endT = 0;
    const figs = [], signs = [];
    G.Audio.boss("papers", { pos: b.pos });
    hint(M, "choice", wind + 1);
    for (let i = 0; i < 30; i++) FX.paper(b.pos.x, A.floorY + 1 + Math.random() * 4, b.pos.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 2.5);
    // (held in front of the chest: where a player aiming at him can read it)
    // (new series, round 2, G: with its part of speech, as on a zombie)
    const sign = (root, pair) => {
      const sp = G.makeWordSprite(pair[0], { color: "#fff29b", pos: G.POS ? G.POS.abbr(G.POS.of(pair)) : "" });
      sp.scale.set(3.4, 0.85, 1);
      sp.position.set(0, b.rig.H * 0.55, b.rig.R + 0.6);
      root.add(sp);
      signs.push(sp);
    };
    const finish = (res) => {
      if (result) return;
      result = res; endT = 0;
      figs.forEach((f) => { if (!f.real && !f.clone.popped) M.popClone(game, f.clone, res !== "right"); });
      if (res === "right") {
        b.vuln = C.vuln; b.vulnT = C.stun;
        G.Audio.sfx("correct");
        G.recordWordResult(ans[0], true);
        M.hint(T("boss.move.choice.right", { w: ans[0] }), 3);
        M.stats.dodged++;
      } else if (res === "timeout") M.hint(null);
    };
    return {
      update(dt) {
        t += dt;
        if (!split) {
          b.pose.armL = [-2.2, 0.8]; b.pose.armR = [-2.2, -0.8];
          if (t < wind) return false;
          split = true;
          const words = G.shuffle([ans].concat(others));
          const n = words.length, a0 = Math.atan2(b.pos.x - P.x, b.pos.z - P.z);
          // (every copy made before any sign goes up: a copy of him made
          // after would carry his)
          const copies = words.map((w, i) => (w === ans ? null : M.makeClone(game, b, 100 + i, true)));
          words.forEach((w, i) => {
            const a = a0 + (i - (n - 1) / 2) * (2.4 / n);
            const p = inRect(A, P.x + Math.sin(a) * 9, P.z + Math.cos(a) * 9, 1.5);
            if (w === ans) {
              b.pos.x = p.x; b.pos.z = p.z; b.word = w[0]; b.choiceMeaning = ans[1];
              figs.push({ real: true, root: b.root });
              sign(b.root, w);
            } else {
              const c = copies[i];
              c.root.position.set(p.x, A.floorY, p.z);
              c.word = w[0];
              c.onShot = () => {
                // the wrong answer: it bursts into a storm of paper on you
                if (c.popped || result) return;
                M.popClone(game, c);
                G.Audio.sfx("wrong");
                M.hurt(game, C.wrongDamage, { src: "choice" });
                G.recordWordResult(ans[0], false);
                if (game.trackWrongWord) game.trackWrongWord(ans[0], ans[1]);
                if (figs.every((f) => f.real || f.clone.popped)) finish("revealed");
              };
              figs.push({ real: false, root: c.root, clone: c });
              sign(c.root, w);
            }
            for (let k = 0; k < 10; k++) FX.paper(p.x, A.floorY + 1 + Math.random() * 4, p.z, (Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5, 2.2);
          });
          hp0 = b.hp;
          G.Audio.boss("poof", { pos: b.pos });
          M.hint(T("boss.move.choice.prompt", { th: ans[1] }), time);
          return false;
        }
        figs.forEach((f) => { f.root.rotation.y = Math.atan2(P.x - f.root.position.x, P.z - f.root.position.z); if (!f.real) f.root.position.y = A.floorY; });
        b.dangers = figs.filter((f) => f.real || !f.clone.popped).map((f) => ({ kind: "figure", x: f.root.position.x, z: f.root.position.z, real: f.real }));
        if (!result && b.hp < hp0) finish("right");
        if (!result && t >= wind + time) finish("timeout");
        if (!result) return false;
        endT += dt;
        return endT >= 0.6;
      },
      end() {
        figs.forEach((f) => { if (!f.real && !f.clone.popped) M.popClone(game, f.clone, true); });
        M.clones = M.clones.filter((c) => !c.popped);
        signs.forEach((s) => { if (s.parent) s.parent.remove(s); if (s.userData.tex) s.userData.tex.dispose(); s.material.dispose(); });
        b.word = null; b.choiceMeaning = null; b.dangers = []; b.pose = {};
        if (result !== "right") M.hint(null);
      },
    };
  };

  // Fail Stamp: a giant F comes down where you stand, again and again
  ABIL.stamp = function (M, game, b) {
    const C = MV().stamp, A = M.arena, P = game.yawObject.position, W = M.warnK(game, b);
    const n = Math.round(M.ws(game, C.count)), warn = M.ws(game, C.warn) * W, gap = M.ws(game, C.gap), h = C.half;
    const face = canvasTex(128, 128, (g, w, hh) => { g.fillStyle = "#f4efe2"; g.fillRect(0, 0, w, hh); g.strokeStyle = "#c01818"; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, hh - 16); g.fillStyle = "#c01818"; g.font = "bold 96px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("F", w / 2, hh / 2 + 4); });
    const red = new THREE.MeshLambertMaterial({ color: 0xa81414 }), top = new THREE.MeshLambertMaterial({ map: face });
    const stampM = addMesh(game, new THREE.BoxGeometry(h * 2, 1.2, h * 2), [red, red, top, top, red, red]);
    const shadow = FX.decal({ mode: "lane", x: 0, z: 0, yaw: 0, r: h, len: h * 2, w: 0.3, color: 0xc01818, opacity: 0.9, prog: 0 });
    let i = 0, t = 0, stage = "aim", x = 0, z = 0, hitAny = false;
    const place = () => {
      const q = inRect(A, P.x, P.z, h + 0.2);
      x = q.x; z = q.z; t = 0; stage = "aim";
      shadow.set({ x, z: z - h, r: h, len: h * 2, prog: 0, opacity: 0.9 });
      stampM.position.set(x, A.floorY + 12, z);
      G.Audio.boss("stamp_wind", { pos: new V3(x, A.floorY + 6, z) });
    };
    place();
    hint(M, "stamp");
    return {
      update(dt) {
        t += dt;
        b.pose.armR = stage === "aim" ? [-2.9, -0.2] : [-0.6, -0.2];
        if (stage === "aim") {
          const k = Math.min(1, t / warn);
          shadow.set({ prog: k });
          stampM.position.y = A.floorY + 12 - 6 * k;
          b.dangers = [{ kind: "circle", x, z, r: h * 1.35, at: Math.max(0, warn - t) }];
          if (t >= warn) { stage = "drop"; t = 0; }
          return false;
        }
        if (stage === "drop") {
          stampM.position.y = Math.max(A.floorY + 0.6, A.floorY + 6 - t * 45);
          if (stampM.position.y > A.floorY + 0.61) return false;
          stage = "lift"; t = 0; b.dangers = [];
          FX.shock(x, z, h + 2.5, 0xc01818, 0.45);
          for (let k = 0; k < 14; k++) FX.paper(x + (Math.random() - 0.5) * h * 2, A.floorY + 0.4, z + (Math.random() - 0.5) * h * 2, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 2);
          G.Audio.boss("stamp", { pos: stampM.position });
          game.shake(0.07, 0.3);
          if (Math.abs(P.x - x) < h + 0.3 && Math.abs(P.z - z) < h + 0.3 && grounded(game, M, 1.6)) { M.hurt(game, C.damage, { src: "stamp" }); hitAny = true; }
          return false;
        }
        // (lift) up again, then the next
        if (t > 0.35) stampM.position.y = A.floorY + 0.6 + (t - 0.35) * 20;
        shadow.set({ opacity: Math.max(0, 0.9 - t * 2) });
        if (t < 0.35 + gap) return false;
        if (++i >= n) { if (!hitAny) M.stats.dodged++; return true; }
        place();
        return false;
      },
      end() { shadow.hide(); drop(stampM); red.dispose(); b.dangers = []; b.pose = {}; },
    };
  };
})();
