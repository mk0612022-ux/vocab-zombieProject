// ===================================================================
// Playtest bot (category P)
// -------------------------------------------------------------------
// Plays a campaign level in accelerated simulated time so balance can be
// measured instead of guessed. It models a NEW player, not a perfect one:
//
//   vocabulary   knows a target word with probability `know`; otherwise it
//                guesses among the zombies it can see
//   reaction     needs `reaction` seconds to read a new Thai meaning and find
//                the zombie, and turns at a human rate with wobbling aim
//   trigger      clicks semi-autos at `clickRate`, holds automatics, winds up
//                charge weapons fully
//   movement     drives the real joystick input, so weight, sprint and
//                stamina apply exactly as they do to a player
//   goals        follows the objective list the way the HUD tells a player
//                to: every room, the three keys (button -> secret room, word
//                door, upper floor), and opportunistic drops, crates, wall
//                guns and the mystery box
//   shop         heals / refills when low, otherwise saves
//
// It never touches game rules: everything goes through the same inputs and
// interact calls a player's E key and fire button reach.
//
// Usage (in the game page):
//   const s = document.createElement("script"); s.src = "tools/playtest-bot.js"; document.head.appendChild(s);
//   G.Bot.start({ level: 1 });  ...  G.Bot.result   (poll until .done)
// ===================================================================
G.Bot = {
  result: null,

  // ---------------- grid navigation ----------------
  // The waypoint graph only knows room-to-room hops, and its straight lines
  // run into the lobby's stair enclosure and furniture. The bot plans on a
  // 0.5-unit grid instead, using the very body box and floor-height rules
  // that tryMove uses, so any path it finds is one a player can walk.
  makeNav(world, isIgnored) {
    // planning radius a little over the body (0.35) so paths keep clear of
    // furniture corners the real box would snag on
    const C = 0.5, R = 0.45, B = 4;
    let buckets = null, cache = null, version = null;
    const bkey = (x, z) => Math.floor(x / B) * 100003 + Math.floor(z / B);
    function rebuild() {
      buckets = new Map(); cache = new Map();
      for (const c of world.colliders) {
        if (isIgnored(c)) continue;
        for (let bx = Math.floor((c.min.x - 1) / B); bx <= Math.floor((c.max.x + 1) / B); bx++)
          for (let bz = Math.floor((c.min.z - 1) / B); bz <= Math.floor((c.max.z + 1) / B); bz++) {
            const k = bx * 100003 + bz;
            let a = buckets.get(k); if (!a) buckets.set(k, (a = [])); a.push(c);
          }
      }
    }
    function blocked(x, z, h) {
      const key = x + "," + z + "," + Math.round(h * 10);
      let v = cache.get(key);
      if (v !== undefined) return v;
      v = false;
      const b = world.bounds;
      if (b && (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ)) v = true;
      else for (const c of buckets.get(bkey(x, z)) || []) {
        if (x + R >= c.min.x && x - R <= c.max.x && z + R >= c.min.z && z - R <= c.max.z && h + 2.6 >= c.min.y && h + 0.1 <= c.max.y) { v = true; break; }
      }
      cache.set(key, v);
      return v;
    }
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    return {
      blocked: (x, z, h) => { const ver = world.colliders.length; if (ver !== version) { version = ver; rebuild(); } return blocked(x, z, h); },
      // refresh when a barrier (shutter, barricade, word door) is removed
      invalidate() { version = null; },
      path(sx, sz, sh, tx, tz, th, tol, maxExpand) {
        const ver = world.colliders.length; if (ver !== version) { version = ver; rebuild(); }
        const heap = [], nodes = new Map();
        const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
        const hfun = (x, z, h) => Math.hypot(x - tx, z - tz) + (th == null ? 0 : Math.abs(h - th) * 3);
        const ix0 = Math.round(sx / C), iz0 = Math.round(sz / C);
        const start = { ix: ix0, iz: iz0, h: sh, g: 0, f: hfun(ix0 * C, iz0 * C, sh), parent: null };
        nodes.set(ix0 + "," + iz0 + "," + Math.round(sh * 10), start);
        push(start);
        let n = 0, goal = null;
        const lim = maxExpand || 40000;
        while (heap.length && n++ < lim) {
          const cur = pop();
          if (cur.closed) continue;
          cur.closed = true;
          const cx = cur.ix * C, cz = cur.iz * C;
          if (Math.hypot(cx - tx, cz - tz) < (tol || 0.8) && (th == null || Math.abs(cur.h - th) < 1.2)) { goal = cur; break; }
          for (const [dx, dz, cost] of DIRS) {
            const nx = (cur.ix + dx) * C, nz = (cur.iz + dz) * C;
            if (blocked(nx, nz, cur.h)) continue;
            if (dx && dz && (blocked(nx, cz, cur.h) || blocked(cx, nz, cur.h))) continue;
            const nh = G.getFloorHeightAt(world, nx, nz, cur.h);
            const key = (cur.ix + dx) + "," + (cur.iz + dz) + "," + Math.round(nh * 10);
            const g = cur.g + cost * C;
            let nb = nodes.get(key);
            if (nb && (nb.closed || nb.g <= g)) continue;
            if (!nb) { nb = { ix: cur.ix + dx, iz: cur.iz + dz, h: nh }; nodes.set(key, nb); }
            nb.g = g; nb.f = g + hfun(nx, nz, nh); nb.parent = cur;
            push(nb);
          }
        }
        if (!goal) return null;
        const out = [];
        for (let k = goal; k; k = k.parent) out.unshift({ x: k.ix * C, z: k.iz * C, h: k.h });
        return out;
      },
    };
  },

  start(opt) {
    this.abort = false;
    this.result = { done: false };
    this.run(opt).then((r) => { this.result = Object.assign(r, { done: true }); })
      .catch((e) => { this.result = { done: true, error: String(e && e.stack || e) }; });
  },

  async run(opt) {
    opt = Object.assign({
      level: 1, know: 0.78, elim: 0.5, learn: 0.35, reaction: 1.0, aimErr: 0.022, turnRate: 4.0, clickRate: 4.0,
      kite: 3.4, engage: 16, weapon: null, explore: true, spend: true, buyGuns: true,
      dt: 1 / 30, maxMinutes: 40, stopAfterWave: null, log: false,
    }, opt || {});
    const g = G.Game, I = G.Input;
    // A run must not leave its word history or tutorial flags in the save.
    const saveSnapshot = JSON.stringify(G.save);
    const persist = G.persist, persistSoon = G.persistSoon;
    G.persist = () => {}; G.persistSoon = () => {};
    const prevMode = I.mode, prevSpeed = G.save.settings.gameSpeed;
    G.save.settings.gameSpeed = 1;
    G.save.tutorialDone = true;
    // The render loop keeps drawing, but the simulation is stepped only here.
    const realUpdate = g.update;
    g.update = function () {};
    // The game raycasts against zombie matrixWorld, which three.js refreshes
    // during render. Many simulated ticks run between renders here, so
    // refresh them by hand or every shot tests where the zombie USED to be.
    const step = (dt) => { for (const z of g.zombies) z.mesh.updateMatrixWorld(true); realUpdate.call(g, dt); };
    const restore = [];
    try {
      g.startLevel(opt.level);
      I.mode = "touch";
      I.touchMove = { x: 0, y: 0, active: true }; I.touchFire = false; I.touchSprint = false;
      if (opt.weapon) { g.acquireWeapon(opt.weapon); }
      const world = g.world;
      const doorColliders = new Set(world.roomDoors.map((d) => d.collider));
      const wordDoor = (world.doors || []).find((d) => d.kind === "word");
      const nav = this.makeNav(world, (c) => doorColliders.has(c) || (wordDoor && c === wordDoor.collider));
      const R = {
        level: opt.level, weaponForced: opt.weapon, waves: [], events: [], purchases: [],
        shots: 0, contactHits: 0, contactDmg: 0, wrongDmg: 0, healed: 0, overlaySeconds: 0,
        objectivesDoneAt: null, victoryAt: null, deathAt: null, minHp: 375,
      };
      const onShot = G.Tutorial.onShot;
      G.Tutorial.onShot = function () { R.shots++; return onShot.apply(this, arguments); };
      restore.push(() => { G.Tutorial.onShot = onShot; });
      const onHit = G.UI.showHitmarker;
      R.hits = 0;
      G.UI.showHitmarker = function () { R.hits++; return onHit.apply(this, arguments); };
      restore.push(() => { G.UI.showHitmarker = onHit; });
      // where the wrong answers come from: a guess at an unknown word, a panic
      // shot at one in your face, collateral (splash, pierce or a stray round
      // killing a zombie you were not aiming at), a failed door/crate popup,
      // or a missed boss question
      R.wrongBy = { guess: 0, panic: 0, collateral: 0, popup: 0, boss: 0 };
      let why = null, tgtRef = null;
      const onDeath = g.onZombieDeath;
      g.onZombieDeath = function (z) {
        if (z.type !== "boss" && this.targetPair && z.word !== this.targetPair[0]) {
          if (z === tgtRef && why) R.wrongBy[why === "known" ? "collateral" : why]++; else R.wrongBy.collateral++;
        }
        return onDeath.call(this, z);
      };
      restore.push(() => { g.onZombieDeath = onDeath; });
      // launchers can hurt their owner at point blank
      R.selfSplash = 0;
      const onSplash = g.splashDamage;
      g.splashDamage = function () { const h = this.player.hp; const r = onSplash.apply(this, arguments); R.selfSplash += h - this.player.hp; return r; };
      restore.push(() => { g.splashDamage = onSplash; });
      const ev = (t, what) => { R.events.push(Math.round(t) + "s " + what); if (opt.log) console.log("[bot]", Math.round(t), what); };

      let t = 0, waveStart = 0, waveMoney0 = 0, waveEarned = 0, moneyPrev = g.player.money;
      let tgt = null, tgtWord = null, knows = false, reactT = 0, tried = new Set(), elim = false, lastCorrect = 0;
      // what this player knows: decided once per word and kept, so the same
      // word is not known on one zombie and forgotten on the next
      const vocab = new Map();
      const knowsWord = (w) => { if (!vocab.has(w)) vocab.set(w, Math.random() < opt.know); return vocab.get(w); };
      // a four-choice popup: known -> right; unknown -> rule out the choices it
      // knows are something else (sometimes), then guess
      const pickChoice = (right, choices) => {
        if (knowsWord(right)) return right;
        let pool = choices;
        if (Math.random() < opt.elim) { const un = choices.filter((c) => c === right || !knowsWord(c)); if (un.length) pool = un; }
        return pool[Math.floor(Math.random() * pool.length)];
      };
      let aimOff = { y: 0, p: 0, t: 0 }, clickT = 0, losCache = new Map(), losT = 0;
      let path = null, pathI = 0, goal = null, replanT = 0, lastProg = { x: 0, z: 0, t: 0 }, nudge = null;
      const tail = [];
      let lastBitten = -99, lastKillT = 0, killsSeen = 0, stallLogged = 0;
      let challengeT = 0, bossT = 0, interactCd = 0, doorCd = 0, wordDoorRetry = 0;
      const hpMax = g.player.maxHp;
      const pos = () => g.yawObject.position;
      const feet = () => pos().y - 1.7;
      const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

      // ---- perception ----
      const aimPoint = (z) => {
        // centre of the body itself (the word label floats above the head)
        if (z._botH === undefined) {
          const bb = new THREE.Box3();
          z.mesh.updateMatrixWorld(true);
          z.mesh.traverse((o) => { if (o.isMesh) bb.expandByObject(o); });
          z._botH = bb.isEmpty() ? 1 : (bb.min.y + bb.max.y) / 2 - z.mesh.position.y;
        }
        return new THREE.Vector3(z.mesh.position.x, z.mesh.position.y + z._botH, z.mesh.position.z);
      };
      const ray = new THREE.Ray();
      const tmp = new THREE.Vector3();
      // what a player can see: walls, doors and furniture block, and so do
      // the upper floor and stair slabs (the labels are depth-tested)
      const blockDist = (o, dir, far) => {
        ray.origin.copy(o); ray.direction.copy(dir);
        let best = far;
        for (const col of world.colliders) if (!col.containsPoint(o) && ray.intersectBox(col, tmp)) best = Math.min(best, tmp.distanceTo(o));
        if (Math.abs(dir.y) > 1e-4) for (const hz of world.heightZones) {
          if (hz.ramp || hz.height <= 1) continue;
          const k = (hz.height - o.y) / dir.y;
          if (k <= 0 || k >= best) continue;
          const x = o.x + dir.x * k, z = o.z + dir.z * k;
          if (x >= hz.minX && x <= hz.maxX && z >= hz.minZ && z <= hz.maxZ) best = k;
        }
        return best;
      };
      const canSee = (z) => {
        const k = z.uid;
        const c = losCache.get(k);
        if (c && c.t > t) return c.v;
        const eye = pos().clone(), tp = aimPoint(z);
        const d = eye.distanceTo(tp);
        let v = d < 45;
        if (v) v = blockDist(eye, tp.clone().sub(eye).normalize(), d) >= d - 0.4;
        losCache.set(k, { v, t: t + 0.2 });
        return v;
      };

      // ---- helpers ----
      const interact = (ref) => {
        const it = world.interactables.find((i) => i.ref === ref);
        if (!it) return;
        g._lookedAtInteractable = it;
        g.doInteract();
      };
      const setMove = (wx, wz, sprint) => {
        const yaw = g.yawObject.rotation.y;
        const l = Math.hypot(wx, wz);
        if (l < 1e-4) { I.touchMove.x = 0; I.touchMove.y = 0; I.touchSprint = false; return; }
        wx /= l; wz /= l;
        I.touchMove.x = wx * Math.cos(yaw) - wz * Math.sin(yaw);
        I.touchMove.y = wx * Math.sin(yaw) + wz * Math.cos(yaw);
        I.touchSprint = !!sprint;
      };
      const turnTo = (yawT, pitchT, dt) => {
        let dy = yawT - g.yawObject.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const m = opt.turnRate * dt;
        g.yawObject.rotation.y += Math.max(-m, Math.min(m, dy));
        const dp = pitchT - g.pitchObject.rotation.x;
        g.pitchObject.rotation.x += Math.max(-m, Math.min(m, dp));
        return Math.abs(dy) + Math.abs(dp);
      };
      const dps = (id) => {
        const d = G.WEAPON_DEFS[id]; if (!d) return 0;
        return d.damage * (d.pellets || 1) * (d.burst || 1) * (d.charge ? d.charge.mult * 0.8 : 1) * 1000 / d.fireRate * (d.splash ? 1.6 : 1) * (d.pierce ? 1.3 : 1);
      };
      const bestOwnedDps = () => Math.max(...g.player.gunSlots.map(dps));
      const ammoLeft = (id) => { const a = g.player.ammo[id]; return a ? a.mag + a.reserve : 0; };

      // ---- goals (what the HUD checklist asks for) ----
      const upperOpen = () => !world.secondFloor || world.secondFloor.unlocked;
      const roomOpen = (name) => {
        if (/^P/.test(name)) return upperOpen();
        if (world.secretZone && !world.secretZone.unlocked && dist2(world.waypointNodes[name], world.secretZone.center) < 1) return false;
        if (wordDoor && !wordDoor.opened && Math.abs(world.waypointNodes[name].z - wordDoor.mesh.position.z) < 1 && Math.sign(world.waypointNodes[name].x) === Math.sign(wordDoor.mesh.position.x)) return false;
        return true;
      };
      const roomH = (name) => (/^P/.test(name) ? (world.secondFloor ? world.secondFloor.floorY : 4.2) : 0);
      const pickGoal = () => {
        const S = G.Objectives.state, p = pos(), fh = feet();
        const c = [];
        const add = (x, z, h, kind, ref, bias) => c.push({ x, z, h, kind, ref, cost: Math.hypot(x - p.x, z - p.z) + Math.abs(h - fh) * 12 + (bias || 0) });
        if (opt.explore && S) {
          (world.keys || []).forEach((k) => { if (!k.taken && roomOpen(k.room)) add(k.mesh.position.x, k.mesh.position.z, k.baseY, "key", k, -8); });
          [...world.roomNames].forEach((name) => { if (!S.visited.has(name) && roomOpen(name)) { const n = world.waypointNodes[name]; add(n.x, n.z, roomH(name), "room", name); } });
          world.buttons.forEach((b) => { if (!b.pressed && S.visited.has("W3")) add(b.mesh.position.x + 1.2, b.mesh.position.z, 0, "button", b, -6); });
          if (wordDoor && !wordDoor.opened && t > wordDoorRetry) add(wordDoor.mesh.position.x - Math.sign(wordDoor.mesh.position.x) * 1.8, wordDoor.mesh.position.z, 0, "worddoor", wordDoor, 4);
          world.crates.forEach((cr) => { if (!cr.opened) { const cp = cr.mesh.position; if (Math.hypot(cp.x - p.x, cp.z - p.z) < 9 && Math.abs(cp.y - 0.4 - fh) < 1.5) add(cp.x - Math.sign(cp.x - p.x || 1) * 1.2, cp.z, fh, "crate", cr, -4); } });
        }
        if (opt.buyGuns && !opt.weapon) {
          const mine = bestOwnedDps();
          (world.wallWeapons || []).forEach((w) => {
            if (w.purchased || g.player.money < w.price + 120 || dps(w.id) < mine * 1.25) return;
            const gp = w.gunMesh.getWorldPosition(new THREE.Vector3());
            const h = G.getFloorHeightAt(world, gp.x, gp.z, gp.y - 1.2);
            if (h > 1 && !upperOpen()) return;
            add(gp.x - Math.sign(gp.x) * 1.3, gp.z, h, "wallgun", w, -10);
          });
          const mb = world.mysteryBox;
          if (mb && upperOpen() && g.player.money >= G.MYSTERY_BOX_COST + 150 && (mb.uses || 0) < 2) add(mb.x - 2.1, mb.z + 1.5, 4.2, "mystery", mb, -10);
        }
        c.sort((a, b) => a.cost - b.cost);
        return c[0] || null;
      };
      const planTo = (gl) => {
        const p = pos();
        path = nav.path(p.x, p.z, feet(), gl.x, gl.z, gl.h, gl.kind === "room" ? 1.2 : 1.4);
        pathI = 0;
        if (!path) { gl.failed = (gl.failed || 0) + 1; }
        return !!path;
      };
      const unreachable = new Map();

      const maxT = opt.maxMinutes * 60;
      while (t < maxT) {
        const dt = opt.dt;
        t += dt;
        // yield to the browser now and then so the page stays responsive
        if ((Math.round(t / dt) % 45) === 0) await new Promise((r) => setTimeout(r, 0));
        if (G.Bot.abort) { ev(t, "aborted"); break; }

        if (g.state === "GAME_OVER") { R.deathAt = Math.round(t); ev(t, "DIED on wave " + g.wave); break; }
        if (g.state === "VICTORY") { R.victoryAt = Math.round(t); ev(t, "VICTORY"); break; }
        if (g.state === "SHOP") {
          const w = { wave: g.wave, seconds: Math.round(t - waveStart), spawned: g.spawnedCount, required: g.requiredKills, earned: Math.round(waveEarned), moneyEnd: Math.round(g.player.money), hp: Math.round(g.player.hp), correct: g.correctCount, wrong: g.wrongCount,
            rooms: G.Objectives.state ? G.Objectives.state.visited.size : 0, keys: G.Objectives.state ? G.Objectives.state.keysFound : 0, guns: g.player.gunSlots.join("/") };
          R.waves.push(w);
          ev(t, "wave " + g.wave + " cleared, $" + w.moneyEnd + " hp " + w.hp);
          if (opt.stopAfterWave && g.wave >= opt.stopAfterWave) break;
          if (opt.spend) {
            const items = G.SHOP_ITEMS;
            const buy = (id) => { const it = items.find((x) => x.id === id); const price = G.Shop.priceFor(it.id, it.base, it.growth); if (g.player.money >= price) { g.buyShopItem(it, price); R.purchases.push(Math.round(t) + "s shop " + id + " $" + price); return true; } return false; };
            if (g.player.hp < hpMax * 0.55) { const before = g.player.hp; if (buy("heal")) R.healed += g.player.maxHp - before; }
            const cur = g.currentWeaponId();
            if (cur !== "melee" && g.player.ammo[cur].reserve < G.WEAPON_DEFS[cur].magSize * 2) buy("ammo_refill");
          }
          R.overlaySeconds += 10;           // a real player spends a while reading the shop
          g.leaveShop();
          waveStart = t; waveEarned = 0;
          continue;
        }
        const crateOpen = !document.getElementById("screen-crate").classList.contains("hidden");
        if (g.paused && crateOpen) { R.overlaySeconds += 2.5; g.closeCrateScreen(); continue; }
        if (g._mysteryHand) {
          if (g._mysteryPick === null) g.pickMysteryCard(Math.floor(Math.random() * g._mysteryHand.length));
          const got = g._mysteryHand[g._mysteryPick];
          g.confirmMysteryPick();
          R.overlaySeconds += 5;
          R.purchases.push(Math.round(t) + "s mystery -> " + got.id);
          continue;
        }
        if (g.paused) { step(dt); continue; }

        // ---- word challenge popups (door / crate) ----
        if (g.challenge) {
          I.touchMove.x = I.touchMove.y = 0; I.touchFire = false;
          challengeT += dt;
          if (Math.round(t / dt) % 6 === 0) { tail.push(Math.round(t * 10) / 10 + " POPUP " + g.challenge.pair[0] + " hp" + Math.round(g.player.hp)); if (tail.length > 60) tail.shift(); }
          if (challengeT > 2.4) {
            challengeT = 0;
            const ch = g.challenge;
            const idx = ch.choices.indexOf(pickChoice(ch.pair[0], ch.choices));
            const ok = ch.choices[idx] === ch.pair[0];
            if (!ok) R.wrongBy.popup++;
            g.answerChallenge(idx);
          }
          step(dt);
          continue;
        }
        // ---- boss questions: answered while still moving ----
        if (G.BossFight.active && g._bossChoices) {
          bossT += dt;
          if (bossT > 2.6) {
            bossT = 0;
            const right = G.BossFight.currentWord[0];
            const idx = g._bossChoices.indexOf(pickChoice(right, g._bossChoices));
            const ok = g._bossChoices[idx] === right;
            const hpB = g.player.hp;
            if (!ok) R.wrongBy.boss++;
            g.answerBossChoice(idx);
            if (g.player.hp < hpB) R.wrongDmg += hpB - g.player.hp;
          }
        }

        // ---- target selection ----
        const p = pos();
        const alive = g.zombies.filter((z) => z.alive);
        const tw = g.targetPair && g.targetPair[0];
        if (tw !== tgtWord) {
          // the word just resolved was a correct kill: seeing and hearing it
          // answered teaches it some of the time
          if (tgtWord && g.correctCount > lastCorrect && Math.random() < opt.learn) vocab.set(tgtWord, true);
          lastCorrect = g.correctCount;
          tgtWord = tw; knows = !!tw && knowsWord(tw); tried = new Set(); tgt = null;
          elim = Math.random() < opt.elim;
          reactT = opt.reaction * (0.7 + Math.random() * 0.6) * (knows ? 1 : 1.6);
        }
        const visible = alive.filter((z) => z.mesh.position.distanceTo(p) < opt.engage + 6 && canSee(z));
        const boss = alive.find((z) => z.type === "boss");
        const panicZ = t - lastBitten < 2 && visible.filter((z) => Math.abs(z.mesh.position.y - feet()) < 2 && dist2(z.mesh.position, p) < 1.3).sort((a, b) => dist2(a.mesh.position, p) - dist2(b.mesh.position, p))[0] || null;
        // a target already in your face stays the target -- flicking between two
        // biting zombies restarted the aim every frame and never fired
        const tgtClose = tgt && tgt.alive && visible.includes(tgt) && dist2(tgt.mesh.position, p) < 1.6;
        if (!tgt || !tgt.alive || !visible.includes(tgt) || (panicZ && tgt !== panicZ && tgt.type !== "boss" && !tgtClose)) {
          let next = null;
          if (boss && visible.includes(boss)) next = boss;
          // one in your face gets shot whatever its word: -22 HP beats a bite
          // every second
          else if (panicZ) next = panicZ;
          else if (knows) next = visible.find((z) => z.word === tw) || null;
          else {
            // does not know the word: rule out the zombies whose words it DOES
            // know (sometimes), then guess among the rest
            let pool = visible.filter((z) => !tried.has(z.uid));
            if (elim) { const un = pool.filter((z) => !knowsWord(z.word)); if (un.length) pool = un; }
            next = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
          }
          if (next !== tgt) { const was = tgt; tgt = next; if (tgt && !(was && next === panicZ)) reactT = Math.max(reactT, 0.35); }
          why = !tgt ? null : tgt === boss ? "boss" : tgt === panicZ && tgt.word !== tw ? "panic" : knows ? "known" : "guess";
          tgtRef = tgt;
        }
        reactT -= dt; clickT -= dt; interactCd -= dt; doorCd -= dt; replanT -= dt;

        // ---- movement ----
        let nearest = null, nd = 1e9;
        // only zombies on this floor can touch us (one on the storey above can
        // stand right overhead)
        const sameFloor = alive.filter((z) => Math.abs(z.mesh.position.y - feet()) < 2);
        for (const z of sameFloor) { const d = dist2(z.mesh.position, p); if (d < nd) { nd = d; nearest = z; } }
        let moving = false;
        // something close and nothing it can shoot yet: give ground instead of
        // walking on into a dead end with a queue behind it
        const threatened = nearest && (nd < opt.kite || (nd < 5 && !(tgt && dist2(tgt.mesh.position, p) < opt.engage)));
        if (threatened) {
          // back off: the open direction that gains the most distance
          let best = null, bs = -1e9;
          for (let a = 0; a < 16; a++) {
            const ang = a / 16 * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
            // how far this way is open -- backing into a corner is how you die
            let free = 0;
            while (free < 5 && !nav.blocked(Math.round((p.x + dx * 0.8 * (free + 1)) * 2) / 2, Math.round((p.z + dz * 0.8 * (free + 1)) * 2) / 2, feet())) free++;
            if (!free) continue;
            let s = free * 1.5;
            for (const z of sameFloor) { const dd = Math.hypot(p.x + dx * 1.6 - z.mesh.position.x, p.z + dz * 1.6 - z.mesh.position.z); s += Math.min(dd, 8) * 2; }
            if (s > bs) { bs = s; best = [dx, dz]; }
          }
          if (best) { setMove(best[0], best[1], nd < 2); moving = true; path = null; }
          else { setMove(0, 0, false); if (nearest && visible.includes(nearest)) { tgt = nearest; tgtRef = tgt; why = nearest.word === tw ? "known" : "panic"; } }
        } else if (tgt && dist2(tgt.mesh.position, p) < opt.engage) {
          setMove(0, 0, false);                  // a new player stops to shoot
        } else {
          // explore / travel
          if (!goal || goal.done || replanT <= 0 || !path) {
            const ng = pickGoal();
            const same = ng && goal && ng.kind === goal.kind && ng.ref === goal.ref;
            if (!same || !path || replanT <= 0) {
              goal = ng; replanT = 6;
              if (goal) {
                const key = goal.kind + ":" + (goal.ref && (goal.ref.id || goal.ref.room || goal.ref) || "") + ":" + Math.round(goal.x) + "," + Math.round(goal.z);
                if ((unreachable.get(key) || 0) > t) { goal = null; path = null; }
                else if (!planTo(goal)) { unreachable.set(key, t + 20); ev(t, "no path to " + key); goal = null; }
              } else if (alive.length) {
                // nothing left to do: go and find the stragglers, on any floor
                const z = nearest || alive.reduce((a, b) => (dist2(a.mesh.position, p) < dist2(b.mesh.position, p) ? a : b));
                goal = { x: z.mesh.position.x, z: z.mesh.position.z, h: z.mesh.position.y, kind: "hunt" };
                if (!planTo(goal)) goal = null;
                replanT = 3;
              } else path = null;
            }
          }
          if (path && pathI < path.length) {
            while (pathI < path.length - 1 && dist2(path[pathI], p) < 0.45) pathI++;
            const wp = path[pathI];
            const threat = nearest && nd < 12;
            const sprint = !threat && g.stamina > g.maxStamina * 0.35 && path.length - pathI > 8;
            setMove(wp.x - p.x, wp.z - p.z, sprint);
            moving = true;
            // open any shut room door in the way (the player's E)
            if (doorCd <= 0) {
              for (const d of world.roomDoors) {
                if (!d.open && Math.hypot(d.x - p.x, d.z - p.z) < (d.width || 3) / 2 + 1.3 && Math.abs((d.baseY || 0) - feet()) < 1.5) { g.toggleRoomDoor(d, true); doorCd = 0.6; break; }
              }
            }
            // stuck: re-plan, then shuffle sideways for a moment
            if (Math.hypot(p.x - lastProg.x, p.z - lastProg.z) > 0.5) { lastProg = { x: p.x, z: p.z, t }; }
            else if (t - lastProg.t > 2.0) { lastProg.t = t; replanT = 0; path = null; nudge = { a: Math.random() * Math.PI * 2, until: t + 0.5 }; }
            if (nudge && t < nudge.until) setMove(Math.cos(nudge.a), Math.sin(nudge.a), false);
            if (path && pathI >= path.length - 1 && dist2(path[path.length - 1], p) < 0.7) path = null;
          } else setMove(0, 0, false);
          if (goal && goal.kind === "room" && G.Objectives.state && G.Objectives.state.visited.has(goal.ref)) { goal.done = true; path = null; }
          // arrived: act on the goal
          // nobody sensible starts a word popup with a zombie at arm.s length
          const safe = !nearest || nd > 7;
          if (goal && dist2(goal, p) < 1.6 && interactCd <= 0 && (safe || !/crate|worddoor/.test(goal.kind))) {
            interactCd = 1.0;
            if (goal.kind === "button") { interact(goal.ref); ev(t, "pressed the secret button"); nav.invalidate(); goal.done = true; }
            else if (goal.kind === "worddoor") { interact(goal.ref); wordDoorRetry = t + 6; goal.done = true; }
            else if (goal.kind === "crate") { interact(goal.ref); goal.done = true; }
            else if (goal.kind === "wallgun") {
              if (g.player.money >= goal.ref.price) { g.buyWallWeapon(goal.ref); R.purchases.push(Math.round(t) + "s wall " + goal.ref.id + " $" + goal.ref.price); ev(t, "bought " + goal.ref.id); }
              goal.done = true;
            } else if (goal.kind === "mystery") { g.openMysteryBox(); goal.done = true; }
            else if (goal.kind === "room" || goal.kind === "key" || goal.kind === "hunt") goal.done = true;
          }
        }
        if (!moving && !(tgt && dist2(tgt.mesh.position, p) < opt.engage)) setMove(0, 0, false);

        if (opt.infiniteAmmo && opt.weapon && g.player.ammo[opt.weapon]) g.player.ammo[opt.weapon].reserve = 999;
        // ---- weapon management ----
        const curId = g.currentWeaponId();
        if (g.weaponAnim.switchT <= 0) {
          let want = curId;
          const owned = g.player.gunSlots.filter((id) => ammoLeft(id) > 0);
          if (opt.weapon) want = ammoLeft(opt.weapon) > 0 ? opt.weapon : (owned.find((id) => id !== opt.weapon) || "melee");
          else if (owned.length) want = owned.reduce((a, b) => (dps(a) >= dps(b) ? a : b));
          else want = "melee";
          if (want !== curId) {
            g.switchSlot(want === "melee" ? 0 : g.player.gunSlots.indexOf(want) + 1);
          }
        }

        // ---- aim and shoot ----
        const def = g.currentWeaponDef();
        I.touchFire = false;
        if (tgt && tgt.alive && dist2(tgt.mesh.position, p) < opt.engage + 4) {
          if (t > aimOff.t) { aimOff = { y: (Math.random() - 0.5) * 2 * opt.aimErr, p: (Math.random() - 0.5) * 2 * opt.aimErr, t: t + 0.35 }; }
          const ap = aimPoint(tgt);
          const eye = g.camera.getWorldPosition(new THREE.Vector3());
          const dx = ap.x - eye.x, dz = ap.z - eye.z, dy = ap.y - eye.y;
          const yawT = Math.atan2(-dx, -dz) + aimOff.y, pitchT = Math.atan2(dy, Math.hypot(dx, dz)) + aimOff.p;
          const err = turnTo(yawT, pitchT, dt);
          const range = def.id === "melee" ? def.range : 60;
          if (reactT <= 0 && err < 0.07 && Math.hypot(dx, dz) < range && !g.player.reloading) {
            if (def.charge) {
              I.touchFire = (g._chargeT || 0) < def.charge.time;       // release when full
            } else if (def.auto || def.id === "melee") I.touchFire = true;
            else if (clickT <= 0) { I.touchFire = true; G.onFirePress(); clickT = 1 / opt.clickRate; }
          }
        } else if (moving) {
          // look where you walk
          const yaw = g.yawObject.rotation.y;
          const wx = I.touchMove.x * Math.cos(yaw) + I.touchMove.y * Math.sin(yaw);
          const wz = -I.touchMove.x * Math.sin(yaw) + I.touchMove.y * Math.cos(yaw);
          if (Math.hypot(wx, wz) > 0.1) turnTo(Math.atan2(-wx, -wz), 0, dt * 0.6);
        }
        // a charged or held trigger with nobody in reach still has to be released
        if (!tgt && def.charge && (g._chargeT || 0) > 0) I.touchFire = false;

        const tline = () => [Math.round(t * 10) / 10 + " p" + p.x.toFixed(1) + "," + p.z.toFixed(1) + " nd" + nd.toFixed(1) + " mv" + I.touchMove.x.toFixed(2) + "," + I.touchMove.y.toFixed(2) + " vis" + visible.length + "/" + alive.length + " tgt" + (tgt ? dist2(tgt.mesh.position, p).toFixed(1) : "-") + " fire" + (I.touchFire ? 1 : 0) + " goal" + (goal ? goal.kind : "-") + (path ? " path" + pathI + "/" + path.length : "") + " hp" + Math.round(g.player.hp) + " sh" + R.shots + "/" + R.hits + " w" + g.currentWeaponId() + (tgt ? " tz" + tgt.type + (tgt.word === tw ? "*" : "") + tgt.hp.toFixed(0) : "") + " mag" + (g.player.ammo[g.currentWeaponId()] ? g.player.ammo[g.currentWeaponId()].mag : "-") + (nearest ? " nz" + nearest.type + (nearest.word === tw ? "*" : "") + "@" + nearest.mesh.position.x.toFixed(1) + "," + nearest.mesh.position.z.toFixed(1) : "")].join("");
        if (opt.trace && Math.round(t / dt) % 15 === 0) (R.trace = R.trace || []).push(tline());
        if (Math.round(t / dt) % 6 === 0) { tail.push(tline()); if (tail.length > 60) tail.shift(); }
        // stall detector: nothing has died for a long time while zombies live
        const killsNow = g.correctCount + g.wrongCount;
        if (killsNow !== killsSeen) { killsSeen = killsNow; lastKillT = t; }
        else if (alive.length && t - lastKillT > 90 && t - stallLogged > 90) {
          stallLogged = t;
          ev(t, "STALL wave " + g.wave + " me " + p.x.toFixed(1) + "," + feet().toFixed(1) + "," + p.z.toFixed(1) + " zombies " + alive.map((z) => z.type + "@" + z.mesh.position.x.toFixed(1) + "," + z.mesh.position.y.toFixed(1) + "," + z.mesh.position.z.toFixed(1) + ":" + G.getRegionAt(world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y)).join(" "));
        }
        // ---- step the game ----
        const hpB = g.player.hp, wrongB = g.wrongCount;
        step(dt);
        if (g.player.hp < hpB) {
          const lost = hpB - g.player.hp;
          if (g.wrongCount > wrongB) { R.wrongDmg += lost; if (tgt) tried.add(tgt.uid); }
          else { R.contactHits++; R.contactDmg += lost; lastBitten = t; }
        }
        R.minHp = Math.min(R.minHp, g.player.hp);
        if (g.player.money > moneyPrev) waveEarned += g.player.money - moneyPrev;
        moneyPrev = g.player.money;
        if (!R.objectivesDoneAt && G.Objectives.state && G.Objectives.allDone(g)) { R.objectivesDoneAt = Math.round(t); ev(t, "all objectives done"); }
        if (G.Objectives.state) {
          const S = G.Objectives.state;
          if (S.keysFound !== R._keys) { R._keys = S.keysFound; if (S.keysFound) ev(t, "key " + S.keysFound); }
          if (world.secondFloor && world.secondFloor.unlocked && !R.upperAt) { R.upperAt = Math.round(t); ev(t, "upper floor unlocked"); nav.invalidate(); }
        }
      }
      if (R.deathAt) R.tail = tail;
      R.simSeconds = Math.round(t);
      R.estRealMinutes = +((t + R.overlaySeconds) / 60).toFixed(1);
      R.finalWave = g.wave; R.state = g.state;
      R.correct = g.correctCount; R.wrong = g.wrongCount;
      R.accuracy = Math.round(100 * g.correctCount / Math.max(1, g.correctCount + g.wrongCount));
      R.hpEnd = Math.round(g.player.hp); R.minHp = Math.round(R.minHp);
      R.moneyEnd = Math.round(g.player.money);
      R.contactDmg = Math.round(R.contactDmg); R.wrongDmg = Math.round(R.wrongDmg);
      R.guns = g.player.gunSlots.slice();
      R.objectives = G.Objectives.state ? G.Objectives.list(g).map((r) => (r.done ? "Y " : "N ") + r.value) : null;
      delete R._keys;
      return R;
    } finally {
      restore.forEach((f) => f());
      if (g.state !== "MENU") g.quitToMainMenu();
      g.update = realUpdate;
      I.mode = prevMode;
      I.touchMove = { x: 0, y: 0, active: false }; I.touchFire = false; I.touchSprint = false;
      G.persist = persist; G.persistSoon = persistSoon;
      G.save = JSON.parse(saveSnapshot);
      G.save.settings.gameSpeed = prevSpeed;
    }
  },
};
