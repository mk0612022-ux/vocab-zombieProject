// ===================================================================
// The melee slot (expansion, round 4)
// -------------------------------------------------------------------
// One slot, one weapon in it (player.melee, a key of G.MELEE_WEAPONS): the
// knife, or one bought off a wall in its place. G.WeaponSM (its Melee state)
// owns the timing -- wind-up, a hold to charge, the edge moving, a moment's
// stop on a hit, back to ready -- and this file says what a swing does:
//
//   G.meleeDef(game)              the weapon in the slot
//   G.Melee.plan(game, o)         a swing's times, for the machine
//   G.Melee.begin(game, P)        it starts: stamina, the time before the next
//   G.Melee.swing(game, M)        the edge starts moving: the whoosh
//   G.Melee.sweep(game, u0, u1)   the edge from u0 to u1 of its path (0-1):
//                                 what it met. -> { hit, stop, wall }
//   G.Melee.finish(game, M)       the swing is over
//   G.Melee.give(game, key)       this weapon into the slot, the old one gone
//   G.Melee.mount(world, scene, key, x, y, z, facingWest)   one on a wall, for sale
//   G.Melee.pose(view)            the arm's keys, for G.ViewModel
//
// The hit: not one ray. The edge's path (G.CONFIG.melee.moves) is sampled
// across the frames it moves in, three rays from the eye at each sample -- the
// band it sweeps. Each ray stops at the first wall, so nothing behind one can
// be hit. A wall within reach stops the swing: chips by what it is made of, the
// hands thrown back. Zombies are hit part by part, exactly as a bullet hits
// them (G.Aim.trace), by the rules a bullet keeps: whatever kills a zombie is
// an answer on its word, and one that must be spelt only glances off.
//
// A low thing: a sideways swing goes by at chest height -- look down, or miss a
// Crawler. A `low` weapon (the axe, the shovel) reaches the floor at full range.
// ===================================================================
window.G = window.G || {};

G.meleeDef = function (game) {
  const g = game || G.Game, k = g && g.player && g.player.melee;
  return (k && G.MELEE_WEAPONS[k]) || G.MELEE_DEF;
};

G.Melee = (function () {
  const C = () => G.CONFIG.melee;
  const on = () => !(G.CONFIG.expansion && G.CONFIG.expansion.melee === false);
  const RAD = Math.PI / 180;
  let cur = null;                 // the swing whose edge is moving
  let last = { key: null, step: 0, t: -9 };   // the swing before, for the combo
  const f = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(), o = new THREE.Vector3(), d = new THREE.Vector3();

  // ---------------- a swing's plan ----------------
  function plan(game, opt) {
    if (!on()) return null;
    opt = opt || {};
    const def = G.meleeDef(game), K = C(), now = game.wsm ? game.wsm.t : 0;
    const follows = def.combo && last.key === def.key && now - last.t <= K.comboWindow;
    const step = follows ? (last.step + 1) % 2 : 0;
    const free = G.Abilities && G.Abilities.freeStamina && G.Abilities.freeStamina();
    const tired = !free && game.stamina < def.stamina;
    const slow = tired ? K.tired.slow : 1;
    const wind = (def.windup / 1000) * slow * (step ? K.comboWind : 1), active = def.active / 1000, recover = (def.recover / 1000) * slow;
    return { key: def.key, move: def.move, mirror: !!step, step, tired, wind, active, recover, dur: wind + active + recover,
      dip: opt.quick ? K.quick.dip : 0, rise: opt.quick ? K.quick.rise : 0,
      power: def.power ? def.power.time : 0, maxHold: def.power ? K.power.maxHold : 0 };
  }
  // spent when the swing starts; a charged one, the rest as it goes
  function spend(game, n) {
    if (G.Abilities && G.Abilities.freeStamina && G.Abilities.freeStamina()) return;
    game.stamina = Math.max(0, game.stamina - n);
  }
  function begin(game, P) {
    const def = G.MELEE_WEAPONS[P.key];
    spend(game, def.stamina);
    game.player.fireCooldown = P.dur;
  }

  // ---------------- the edge ----------------
  function swing(game, M) {
    const P = M.plan, def = G.MELEE_WEAPONS[P.key], K = C(), mv = K.moves[def.move];
    if (M.charged) spend(game, def.stamina * (K.power.stamina - 1));
    // the path's length sets how many samples it takes
    const len = dist(mv.path[0], mv.path[1]) + dist(mv.path[1], mv.path[2]);
    cur = { def, mv, P, charged: !!M.charged, tired: P.tired, sign: P.mirror ? -1 : 1, seen: new Set(), hits: 0, samples: Math.max(4, Math.ceil(len / K.step)), wall: false, ground: false, boss: false };
    audio.whoosh(def, !!M.charged);
    return false;
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // where the edge is at w (0-1): [right, up] in degrees
  function pathAt(mv, w, sign) {
    const p = mv.path, t = w * 2, a = t < 1 ? p[0] : p[1], b = t < 1 ? p[1] : p[2], s = t < 1 ? t : t - 1;
    return [(a[0] + (b[0] - a[0]) * s) * sign, a[1] + (b[1] - a[1]) * s];
  }
  function dirAt(yaw, pitch, out) {
    const cy = Math.cos(yaw * RAD), sy = Math.sin(yaw * RAD), cp = Math.cos(pitch * RAD), sp = Math.sin(pitch * RAD);
    return out.copy(f).multiplyScalar(cp * cy).addScaledVector(r, cp * sy).addScaledVector(u, sp).normalize();
  }
  function damageOf(z) {
    const def = cur.def, K = C();
    let v = def.damage * (cur.charged ? K.power.mult : 1) * (cur.tired ? K.tired.damage : 1);
    if (def.unarmored && z.type !== "ironclad" && z.type !== "boss") v *= def.unarmored;
    if (def.lowDamage && (z.type === "crawler" || z.type === "runt")) v *= def.lowDamage;
    return v;
  }
  // a zombie the edge met. -> false: it cannot be hit there
  function strike(game, z, hit, dir) {
    if (G.ZombieFX.hitBlocked(z, hit.point)) return false;
    cur.seen.add(z);
    cur.hits++;
    // (one to be spelt shrugs it off, as it does a bullet: no answer without its word)
    if (z.answer === "spell") { game.spellGlance(z, hit.point); return true; }
    const def = cur.def, K = C(), stagger = cur.charged ? K.harder[def.stagger] : def.stagger;
    const hm = G.ZombieAI.hitMod(game, z, damageOf(z), hit.head, dir, def);
    G.UI.showHitmarker(hm.head);
    audio.flesh(def, cur.charged, hit.point.clone());
    game.damageZombie(z, hm.dmg, hit.point, { dir: dir.clone(), head: hm.head, stagger, knock: (def.knock || 0) * (cur.charged ? 1.5 : 1) });
    return true;
  }
  // nothing but a wall on this ray
  function hitWall(game, dir, at, col, floor) {
    const def = cur.def, K = C(), p = o.clone().addScaledVector(dir, at), n = new THREE.Vector3();
    let surface;
    if (floor) { n.set(0, dir.y < 0 ? 1 : -1, 0); surface = dir.y < 0 ? G.Surface.floor(game.world, p.x, p.z, p.y) : G.Surface.wall(game.world, null, p); }
    else if (col) {
      const e = [p.x - col.min.x, col.max.x - p.x, p.y - col.min.y, col.max.y - p.y, p.z - col.min.z, col.max.z - p.z], i = e.indexOf(Math.min(...e));
      n.setComponent(i >> 1, i % 2 ? 1 : -1);
      surface = G.Surface.wall(game.world, col, p);
    } else { n.copy(dir).negate(); surface = G.Surface.wall(game.world, null, p); }
    if (G.FX) G.FX.impact({ point: p, normal: n, surface, moving: !!(col && col.moving), decal: false });
    audio.wall(def, surface, p.clone());
    G.ViewModel.flinch(K.bounce * G.Access.shake());
    game.shake(K.shake[def.stagger], 0.1);
    if (G.Bus) G.Bus.emit("melee:wall", { key: def.key, surface });
    return surface;
  }
  // the edge going down into the ground: a thud, and it goes on to the end
  function hitGround(game, dir, k) {
    const p = o.clone().addScaledVector(dir, k), surface = G.Surface.floor(game.world, p.x, p.z, p.y);
    if (G.FX) G.FX.impact({ point: p, normal: new THREE.Vector3(0, 1, 0), surface, moving: false, decal: false });
    audio.wall(cur.def, surface, p.clone());
  }
  function sweep(game, u0, u1) {
    const out = { hit: false, stop: 0, wall: false };
    if (!cur) return out;
    const K = C(), def = cur.def, mv = cur.mv;
    game.camera.updateMatrixWorld();
    game.camera.getWorldPosition(o);
    game.camera.getWorldDirection(f);
    u.setFromMatrixColumn(game.camera.matrixWorld, 1).normalize();
    r.setFromMatrixColumn(game.camera.matrixWorld, 0).normalize();
    const reach = def.range * (def.low ? K.lowReach : 1) + 1.6;
    const near = game.zombies.filter((z) => z.alive && z.hitboxes && !cur.seen.has(z) && z.mesh.position.distanceToSquared(o) < reach * reach);
    near.forEach((z) => z.mesh.updateMatrixWorld(true));        // (once for all the rays of this frame)
    const n = Math.max(1, Math.ceil((u1 - u0) * cur.samples));
    for (let i = 1; i <= n && !out.wall; i++) {
      const w = u0 + ((u1 - u0) * i) / n, a = pathAt(mv, w, cur.sign), b = pathAt(mv, Math.min(1, w + 0.02), cur.sign);
      // across the path: the band's three rays
      const ax = -(b[1] - a[1]), ay = b[0] - a[0], al = Math.hypot(ax, ay) || 1;
      for (let lane = -1; lane <= 1 && !out.wall; lane++) {
        const yaw = a[0] + (ax / al) * lane * mv.width * 0.5, pitch = a[1] + (ay / al) * lane * mv.width * 0.5;
        dirAt(yaw, pitch, d);
        // (a low weapon's reach holds at the floor: the ray is that much longer, going down)
        const range = def.range * (def.low && d.y < -0.05 ? Math.min(K.lowReach, 1 / Math.max(0.05, Math.sqrt(1 - d.y * d.y))) : 1);
        const wallAt = game.world ? game.wallDistance(o, d, range) : range;
        const col = game._wallCol, floor = game._wallFloor, solid = wallAt < range;
        let hitAny = false;
        if (near.length && cur.hits < def.targets) {
          for (const h of G.Aim.trace(game, o, d, wallAt, near, true)) {
            if (cur.seen.has(h.z) || cur.hits >= def.targets) continue;
            if (strike(game, h.z, h, d)) { out.hit = true; hitAny = true; }
          }
        }
        // a wall within reach, and nobody between: the swing ends on it
        if (!hitAny && !cur.wall && solid && wallAt < def.range * K.wallReach) {
          cur.wall = true; out.wall = true;
          hitWall(game, d, wallAt, col, floor);
        } else if (!cur.ground && !solid && d.y < -0.25 && game.world) {
          // (the ground under a blow that goes all the way down)
          const fy = G.getFloorHeightAt(game.world, o.x, o.z, o.y - 1.7), k = (fy - o.y) / d.y;
          if (k > 0 && k < range) { cur.ground = true; hitGround(game, d, k); }
        }
      }
    }
    // the boss: once a swing, by its own rules, if no wall stands between
    if (!cur.boss && !out.wall && G.Bosses && u1 >= 0.5) {
      cur.boss = true;
      const mid = pathAt(mv, 0.5, cur.sign);
      dirAt(mid[0], mid[1], d);
      const b = G.Bosses.boss;
      if (b && G.Bosses.phase === "fight") {
        const gap = Math.max(0.3, Math.hypot(b.pos.x - o.x, b.pos.z - o.z) - b.rig.R);
        if (!game.world || game.wallDistance(o, d, gap) >= gap - 0.05) {
          if (G.Bosses.melee(game, o, d, { damage: damageOf({ type: "boss" }), range: def.range })) { out.hit = true; G.UI.showHitmarker(); audio.flesh(def, cur.charged, o.clone().addScaledVector(d, gap)); }
        }
      }
    }
    // on the first hit the swing stands still a moment
    if (out.hit && !cur.stopped) {
      cur.stopped = true;
      out.stop = K.hitstop[def.stagger] * G.Access.screen();
      game.shake(K.shake[def.stagger] * (cur.charged ? 1.5 : 1), 0.12);
    }
    return out;
  }
  function finish(game, M, reason) {
    const P = M.plan;
    if (cur && !cur.hits && !cur.wall && reason !== "cancel") audio.miss(cur.def);
    if (reason !== "cancel" && P) last = { key: P.key, step: P.step, t: game.wsm ? game.wsm.t : 0 };
    cur = null;
    audio.chargeStop();
  }

  // ---------------- what is in the slot ----------------
  function give(game, key) {
    const p = game.player, def = G.MELEE_WEAPONS[key];
    if (!def || p.melee === key) return false;
    p.melee = key;
    last = { key: null, step: 0, t: -9 };
    if (game.wsm && game.wsm.mel) game.wsm.cancelMelee("swap");
    if (game.wsm && game.wsm.held === "melee") game.buildWeaponViewModel("melee");
    if (game.dropQuickModels) game.dropQuickModels();
    return true;
  }
  // the knife, and the wall weapons of this level
  const ofLevel = (level) => Object.values(G.MELEE_WEAPONS).filter((m) => m.level === 0 || m.level === level);

  // On a wall, as a wall gun hangs: its plaque, the weapon, a card with its
  // price (facingWest: the wall is to the player's west). The axe's plaque is
  // its emergency cabinet: red, framed.
  function mount(world, scene, key, mx, y, mz, facingWest) {
    const def = G.MELEE_WEAPONS[key];
    if (!def || !on()) return null;
    const sign = facingWest ? 1 : -1, ry = facingWest ? Math.PI / 2 : -Math.PI / 2, cab = key === "axe";
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 2), new THREE.MeshLambertMaterial({ color: cab ? 0x5a1410 : 0x141414 }));
    plaque.position.set(mx, y + 1.85, mz);
    scene.add(plaque);
    // what "press E" meets: the plaque's box again, never drawn (a raycast
    // finds it all the same), so the plaque itself merges into the level's
    // few draw calls -- the school's gate view is at its limit of 150
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 2), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.position.copy(plaque.position);
    scene.add(hit);
    // (each part one draw call -- the school's gate view is at its limit: the
    // cabinet's frame is one box behind the plaque, the card one plane)
    if (cab) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.66, 2.16), new THREE.MeshLambertMaterial({ color: 0xb02a22 }));
      b.position.set(mx - sign * 0.02, y + 1.85, mz);
      scene.add(b);
    }
    const mesh = G.buildMeleeMesh(def);
    mesh.scale.setScalar(1.45);
    mesh.rotation.set(0.95, ry, 0);
    mesh.position.set(mx + sign * 0.12, y + 1.72 - (G.MELEE_MODELS[key].grip[1] * 0.5), mz - 0.25);
    scene.add(mesh);
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 96;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textAlign = "center";
    G.fitFont(ctx, def.name, 22, 240); ctx.fillStyle = "#ffd43b"; ctx.fillText(def.name, 128, 36);
    ctx.font = "bold 26px monospace"; ctx.fillStyle = "#6bff7a"; ctx.fillText("$" + def.price, 128, 76);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
    card.position.set(mx + sign * 0.075, y + 1.0, mz);
    card.rotation.y = ry;
    scene.add(card);
    const ref = { key, price: def.price, mesh };
    (world.wallMelee = world.wallMelee || []).push(ref);
    world.interactables.push({ mesh: hit, kind: "wallmelee", ref });
    return ref;
  }

  // ---------------- the arm ----------------
  // v: G.WeaponSM's view of the swing. -> [x, y, z, rx, ry, rz], added to the carry
  function pose(v) {
    const A = G.Anim, def = G.MELEE_WEAPONS[v.plan.key], mv = C().moves[def.move], out = [0, 0, 0, 0, 0, 0];
    const mix = (a, b, k) => { for (let i = 0; i < 6; i++) out[i] = (a ? a[i] : 0) + ((b ? b[i] : 0) - (a ? a[i] : 0)) * k; };
    const edge = (w) => { if (w < 0.55) mix(mv.ready, mv.strike, A.easeOutCubic(w / 0.55)); else mix(mv.strike, mv.follow, A.smooth((w - 0.55) / 0.45)); };
    switch (v.phase) {
      case "wind": mix(null, mv.ready, A.smooth(v.u)); break;
      case "hold": {
        // drawn back further the longer it is held, trembling when it is ready
        const c = v.charge || 0, tr = c >= 1 ? Math.sin(performance.now() * 0.05) * 0.006 : 0;
        mix(null, mv.ready, 1 + 0.18 * c);
        out[0] += tr; out[1] += tr * 0.6;
        break;
      }
      case "swing": edge(v.u); break;
      // (off a wall: back from where it stopped)
      case "rec":
        if (v.bounceU != null) { edge(v.bounceU); mix(out.slice(), null, A.easeOutCubic(v.u)); }
        else mix(mv.follow, null, A.smooth(v.u));
        break;
      default: break;
    }
    if (v.plan.mirror) { out[0] = -out[0]; out[4] = -out[4]; out[5] = -out[5]; }
    return out;
  }

  // ---------------- the sound ----------------
  // Each event has four takes, never the same twice running. Recipes only:
  // the game ships no audio files (js/data/soundbank.js).
  const TAKES = [{ p: 1, d: 1, g: 1 }, { p: 0.92, d: 1.1, g: 0.94 }, { p: 1.08, d: 0.92, g: 1.04 }, { p: 0.97, d: 1.04, g: 0.98 }];
  const lastTake = {};
  const take = (ev) => {
    let i = Math.floor(Math.random() * TAKES.length);
    if (i === lastTake[ev]) i = (i + 1) % TAKES.length;
    lastTake[ev] = i;
    return TAKES[i];
  };
  const FLESH = {
    // a point going in
    stab(A, t, k) { A.noise({ dur: 0.06 * t.d, freq: 1500 * t.p, freqEnd: 700, q: 2, gain: 0.26 * k * t.g }); A.tone({ type: "sine", freq: 230 * t.p, freqEnd: 120, dur: 0.05, gain: 0.2 * k }); },
    // wood on a body: dull, "pok"
    thud(A, t, k) { A.tone({ type: "sine", freq: 150 * t.p, freqEnd: 68, dur: 0.1 * t.d, gain: 0.55 * k * t.g }); A.noise({ dur: 0.07, filter: "lowpass", freq: 520 * t.p, gain: 0.32 * k }); },
    // a blade drawn through
    slice(A, t, k) { A.noise({ dur: 0.1 * t.d, filter: "highpass", freq: 2700 * t.p, freqEnd: 1100, gain: 0.2 * k * t.g }); A.noise({ dur: 0.08, filter: "lowpass", freq: 720 * t.p, gain: 0.26 * k, at: 0.012 }); },
    // the blow and the crunch after it
    chop(A, t, k) {
      A.tone({ type: "sine", freq: 118 * t.p, freqEnd: 52, dur: 0.14 * t.d, gain: 0.62 * k * t.g });
      A.noise({ dur: 0.05, freq: 900 * t.p, q: 1.2, gain: 0.36 * k });
      [0.045, 0.075].forEach((at) => A.noise({ dur: 0.05, filter: "highpass", freq: 1800 * t.p, gain: 0.18 * k, at }));
    },
    // iron on a body, a little ring in it
    clunk(A, t, k) { A.tone({ type: "triangle", freq: 300 * t.p, freqEnd: 150, dur: 0.09 * t.d, gain: 0.32 * k * t.g }); A.tone({ type: "sine", freq: 1850 * t.p, dur: 0.06, gain: 0.05 * k, at: 0.01 }); A.noise({ dur: 0.06, filter: "lowpass", freq: 800, gain: 0.24 * k }); },
    // the flat of a spade
    spade(A, t, k) { A.tone({ type: "triangle", freq: 420 * t.p, freqEnd: 230, dur: 0.11 * t.d, gain: 0.28 * k * t.g }); A.noise({ dur: 0.09, filter: "lowpass", freq: 620 * t.p, gain: 0.32 * k }); },
  };
  const HARD = { concrete: 1, tile: 1, metal: 1, glass: 1 };
  const audio = {
    whoosh(def, charged) {
      const A = G.Audio, s = def.sound.swish, t = take("whoosh:" + def.key);
      if (!A.ctx) return;
      const k = charged ? 1.3 : 1, dur = s.dur * t.d * (charged ? 1.15 : 1);
      A.group({ cat: "weapons", prio: 2, dur: dur + 0.1, tag: "melee:swing" }, () => {
        A.noise({ dur, freq: s.f0 * t.p, freqEnd: s.f1 * t.p, q: s.q, gain: s.gain * t.g * k, attack: dur * 0.3 });
        if (s.low) A.tone({ type: "sine", freq: s.low * t.p, freqEnd: s.low * 0.6, dur: dur * 0.85, gain: s.gain * 0.45 * k, at: 0.02 });
      });
    },
    miss(def) {
      const A = G.Audio, t = take("miss");
      if (!A.ctx) return;
      A.group({ cat: "weapons", prio: 3, dur: 0.2 }, () => A.noise({ dur: 0.12 * t.d, filter: "highpass", freq: (def.sound.mat === "wood" ? 1400 : 2600) * t.p, freqEnd: 800, gain: 0.05 * t.g }));
    },
    flesh(def, charged, pos) {
      const A = G.Audio, t = take("flesh:" + def.key), fn = FLESH[def.sound.flesh] || FLESH.thud;
      if (!A.ctx) return;
      A.stopTag("melee:swing");
      A.group({ cat: "weapons", prio: 1, dur: 0.3, pos }, () => fn(A, t, charged ? 1.3 : 1));
    },
    // against a wall: its own surface's sound comes from the impact (js/fx.js);
    // iron on anything hard rings out, "gang"
    wall(def, surface, pos) {
      const A = G.Audio, t = take("wall:" + def.key), mat = def.sound.mat;
      if (!A.ctx) return;
      A.stopTag("melee:swing");
      A.group({ cat: "weapons", prio: 1, dur: 0.4, pos }, () => {
        if (HARD[surface] && mat !== "wood") {
          const f = mat === "blade" ? 2600 : 1900;
          A.tone({ type: "triangle", freq: f * t.p, freqEnd: f * 0.8, dur: 0.24 * t.d, gain: 0.16 * t.g, filter: { type: "bandpass", freq: f * 1.1, q: 6 }, rev: 0.25 });
          A.tone({ type: "sine", freq: f * 1.62 * t.p, dur: 0.12, gain: 0.06 * t.g, rev: 0.2 });
          A.noise({ dur: 0.03, filter: "highpass", freq: 3600, gain: 0.1 });
        } else {
          A.tone({ type: "sine", freq: 240 * t.p, freqEnd: 130, dur: 0.08 * t.d, gain: 0.3 * t.g });
          A.noise({ dur: 0.05, freq: 1100 * t.p, q: 1.3, gain: 0.12 });
        }
      });
    },
    // the creak of a charge, while it is held
    charge(def, secs) {
      const A = G.Audio, t = take("charge");
      if (!A.ctx) return;
      A.group({ cat: "weapons", prio: 3, dur: secs + 0.1, tag: "melee:charge" }, () => {
        A.tone({ type: "sawtooth", freq: 74 * t.p, freqEnd: 128 * t.p, dur: secs, gain: 0.035, filter: { type: "bandpass", freq: 640 * t.p, q: 3 }, attack: 0.08 });
        for (let i = 0; i < 4; i++) A.noise({ dur: 0.04, freq: (1000 + i * 240) * t.p, q: 4, gain: 0.022, at: (secs * (i + 0.4)) / 4 });
      });
    },
    charged() {
      const A = G.Audio;
      if (A.ctx) A.group({ cat: "weapons", prio: 3, dur: 0.15 }, () => A.tone({ type: "triangle", freq: 880, dur: 0.05, gain: 0.05 }));
    },
    chargeStop() { if (G.Audio.ctx) G.Audio.stopTag("melee:charge"); },
    // brought into the hands
    draw(def) {
      const A = G.Audio, kind = def.sound.draw;
      if (kind === "wood") { A.noise({ dur: 0.12, filter: "lowpass", freq: 900, gain: 0.08 }); A.tone({ type: "sine", freq: 170, dur: 0.07, gain: 0.12, at: 0.1 }); return; }
      if (kind === "metal") { A.noise({ dur: 0.1, filter: "lowpass", freq: 1200, gain: 0.07 }); A.tone({ type: "triangle", freq: 1500, freqEnd: 1250, dur: 0.1, gain: 0.05, at: 0.1, filter: { type: "bandpass", freq: 1700, q: 5 } }); return; }
      A.noise({ dur: 0.24, filter: "highpass", freq: 4000, freqEnd: 7500, gain: 0.08, at: 0.05, attack: 0.03 });    // shing
      A.tone({ type: "sine", freq: 2600, dur: 0.18, gain: 0.03, at: 0.2 });
    },
    // the Armory's Listen: two swings and a hit
    preview(def) {
      G.Audio.unlock();
      this.whoosh(def, false);
      setTimeout(() => this.miss(def), 260);
      setTimeout(() => this.whoosh(def, false), 700);
      setTimeout(() => this.flesh(def, false, null), 700 + def.windup * 0.5);
      return 1.3;
    },
  };

  if (G.Bus) G.Bus.on("weapon:melee", (e) => {
    if (e.phase === "hold") audio.charge(G.MELEE_WEAPONS[e.key], e.secs);
    else if (e.phase === "charged") audio.charged();
  }, "melee");

  return { on, plan, begin, swing, sweep, finish, give, ofLevel, mount, pose, audio, pathAt, reset() { cur = null; last = { key: null, step: 0, t: -9 }; }, get swinging() { return cur; } };
})();
