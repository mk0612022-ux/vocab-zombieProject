// ===================================================================
// What the ten kinds do (overhaul, round 4)
// -------------------------------------------------------------------
// Every zombie still carries a word and is answered the old way -- shot by
// its word (or spelt). Nothing here lets a word go unanswered: no kind kills
// another, and a burst or a shriek is never an answer. G.CONFIG.zombies has
// every number.
//
//   the mix       which kind the spawner sends: each kind from its first
//                 wave, its share growing to full; never more of a kind than
//                 its limit alive (one Abomination at a time); a Sprinter or
//                 a Runt only from where a fast one may come
//   the blow      in reach (the Reacher's is 2.6 m), it stops and winds up
//                 -- long enough to see -- then strikes: a hit only if the
//                 player is still in reach
//   the Screamer  from 5 to 16 m off it rears up (1 s: kill it then and the
//                 shriek never comes), then shrieks: every zombie near comes
//                 on faster for a while, and up to two more of the wave's own
//                 come in at once (never past the wave's count -- the HUD's
//                 number stays right); a cooldown before the next
//   the Bloater   killed, it swells and bursts (js/zombiefx.js): the player
//                 close by is hurt, the zombies round it are thrown back and
//                 stagger -- nobody dies of it
//   the Ironclad  its helmet stops head shots until it is knocked off (a
//                 clang each, then it flies); its vest takes a share off body hits
//   a hit         that does not kill: a flinch, a stagger back, or -- a big
//                 one -- down and up again (it cannot bite meanwhile)
//   a stumble     a Sprinter or a Runt now and then loses its feet
// ===================================================================
window.G = window.G || {};

G.ZombieAI = {
  C() { return G.CONFIG.zombies; },
  loose: [],              // helmets knocked off, still falling

  // ---------------- the mix ----------------
  // the share of each kind in wave `wave` (spec: G.waveSpec's)
  shares(spec, wave) {
    const C = this.C(), out = {};
    const from = (k) => wave >= (C.first[k] || 1);
    out.fast = from("fast") ? spec.fast : 0;
    out.crawler = from("crawler") ? spec.crawler : 0;
    Object.keys(C.share).forEach((k) => {
      if (!from(k)) { out[k] = 0; return; }
      const [s0, s1, full] = C.share[k], f = C.first[k];
      const t = full > f ? Math.max(0, Math.min(1, (wave - f) / (full - f))) : 1;
      out[k] = s0 + (s1 - s0) * t;
    });
    const used = Object.values(out).reduce((a, b) => a + b, 0);
    out.normal = Math.max(0.2, 1 - used);
    return out;
  },
  // the kind the spawner sends next, from spawn point `sp`
  pick(game, sp) {
    const spec = G.Spawner.spec;
    if (!spec || !game || game.mode === "study") return "normal";
    const wave = spec.wave || game.wave || 1, C = this.C();
    const w = this.shares(spec, wave);
    const fastOk = !sp || !sp.types || sp.types.includes("fast");
    if (!fastOk) { w.normal += (w.fast || 0) + (w.runt || 0); w.fast = 0; w.runt = 0; }
    const alive = {};
    (game.zombies || []).forEach((z) => { if (z.alive) alive[z.type] = (alive[z.type] || 0) + 1; });
    Object.keys(C.maxAlive).forEach((k) => { if ((alive[k] || 0) >= C.maxAlive[k] && w[k]) { w.normal += w[k]; w[k] = 0; } });
    let r = G.rng() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0 && w[k] > 0) return k; }
    return "normal";
  },
  // at most this many alive at once on this graphics level
  aliveCap(n) {
    const q = (G.save && G.save.settings.graphicsQuality) || "medium";
    return Math.min(n, this.C().aliveCap[q] || n);
  },

  // ---------------- every frame, per zombie ----------------
  // its timers; the Screamer's shriek; a stumble. -> its speed factor now
  tick(game, z, dt) {
    const C = this.C();
    ["_down", "_stagger", "_stumbleT", "_boostT"].forEach((k) => { if (z[k] > 0) z[k] = Math.max(0, z[k] - dt); });
    if (z.type === "screamer") this.screamer(game, z, dt);
    // a Sprinter or a Runt now and then loses its feet
    if ((z.type === "fast" || z.type === "runt") && !(z._stumbleT > 0)) {
      z._stumbleRoll = (z._stumbleRoll == null ? C.stumble.every * G.rng() : z._stumbleRoll) - dt;
      if (z._stumbleRoll <= 0) {
        z._stumbleRoll = C.stumble.every;
        if (G.rng() < C.stumble.chance && z._anim && z._anim.moveW > 0.6) z._stumbleT = C.stumble.time;
      }
    }
    let k = 1;
    if (z._stumbleT > 0) k *= 0.35;
    if (z._boostT > 0) k *= C.screamer.boost;
    return k;
  },

  // ---------------- the blow ----------------
  // -> "hit" when a strike lands this frame (the game takes the damage)
  attack(game, z, dist, sameFloor, noBite, dt) {
    const C = this.C(), reach = C.reach[z.type] || C.attack.reach, windup = C.windup[z.type] || C.attack.windup;
    if (z._atk) {
      z._atk.t += dt;
      if (z._atk.phase === "wind") {
        // knocked down, rearing up, held by an ability: the blow is lost
        if (z._down > 0 || z._rear > 0 || noBite) { z._atk = null; return null; }
        if (z._atk.t >= windup) {
          z._atk = { phase: "strike", t: 0 };
          if (z.lunge) z.lunge();
          if (sameFloor && dist !== undefined && dist <= reach + C.attack.grace) return "hit";
        }
      } else if (z._atk.t > 0.45) z._atk = null;
      return null;
    }
    if (!noBite && dist !== undefined && dist < reach && sameFloor && z.attackCooldown <= 0 && !(z._down > 0) && !(z._rear > 0)) {
      z._atk = { phase: "wind", t: 0 };
      z.attackCooldown = windup + C.attack.cooldown;
      z._hold = Math.max(z._hold || 0, windup);
      if (G.Audio && G.Audio.zombie) G.Audio.zombie("attack", z.type, z.mesh.position.clone().setY(z.mesh.position.y + 1.4));
    }
    return null;
  },

  // ---------------- the Screamer ----------------
  screamer(game, z, dt) {
    const S = this.C().screamer, p = game.yawObject.position, zp = z.mesh.position;
    z._screamCd = (z._screamCd == null ? S.firstDelay : z._screamCd) - dt;
    if (z._rear > 0) {
      z._rear = Math.max(0, z._rear - dt);
      // the wind-up over: the shriek
      if (!z._screaming && z._rear <= z._rearScream) {
        z._screaming = true;
        this.shriek(game, z);
      }
      if (z._rear <= 0) { z._screaming = false; z._screamCd = S.cooldown; }
      return;
    }
    if (z._screamCd > 0 || z.emerge || z._down > 0) return;
    const d = Math.hypot(p.x - zp.x, p.z - zp.z);
    if (d < S.range[0] || d > S.range[1] || Math.abs((p.y - 1.7) - zp.y) > 1.5) return;
    // rear up: S.windup s of drawing breath, then ~1.2 s of the shriek
    const scream = 1.2;
    z._rear = S.windup + scream; z._rearScream = scream; z._screaming = false;
    z._hold = Math.max(z._hold || 0, z._rear);
    z._atk = null;
    if (G.Audio && G.Audio.zombie) G.Audio.zombie("scream_wind", z.type, zp.clone().setY(zp.y + 2), { tag: "scream:" + z.uid });
  },
  shriek(game, z) {
    const S = this.C().screamer, zp = z.mesh.position;
    if (G.Audio && G.Audio.zombie) G.Audio.zombie("scream", z.type, zp.clone().setY(zp.y + 2), { tag: "scream:" + z.uid });
    // every zombie near comes on faster
    let near = 0;
    game.zombies.forEach((o) => {
      if (!o.alive || o === z || o.type === "boss") return;
      if (Math.hypot(o.mesh.position.x - zp.x, o.mesh.position.z - zp.z) > S.radius) return;
      o._boostT = S.boostTime; near++;
    });
    // ...and up to `call` more of the wave's own come in now (never past its count)
    let called = 0;
    const spec = G.Spawner.spec, left = game.requiredKills - game.spawnedCount;
    const room = (spec ? this.aliveCap(spec.alive) : 99) + S.call - game.zombies.filter((o) => o.alive).length;
    const n = Math.max(0, Math.min(S.call, left, room));
    for (let i = 0; i < n && !(G.Bosses && G.Bosses.phase); i++) {
      const fwd = new THREE.Vector3(-Math.sin(game.yawObject.rotation.y), 0, -Math.cos(game.yawObject.rotation.y));
      const sp = G.Spawner.pickPoint(game.world, game.yawObject.position, fwd);
      if (!sp) break;
      sp.cooldown = 2.5;
      if (game.spawnZombieAt(this.pick(game, sp), sp.pos, sp)) called++;
    }
    z._called = (z._called || 0) + called;
    this.lastShriek = { uid: z.uid, near, called };
  },

  // ---------------- a hit ----------------
  // a round meets zombie z: what it does. -> { dmg, head } (head: counts as
  // a head shot -- double damage, the head knocked off if it kills)
  hitMod(game, z, dmg, head, dir) {
    const C = this.C();
    if (z.type === "ironclad") {
      const I = C.ironclad;
      if (head && z._helmetOn !== false) {
        z._helmetHits = (z._helmetHits || 0) + 1;
        if (z._helmetHits >= I.helmetHits) this.popHelmet(game, z, dir);
        else if (G.Audio && G.Audio.zombie) G.Audio.zombie("helmet", z.type, z.mesh.position.clone().setY(z.mesh.position.y + 1.8));
        return { dmg: dmg * I.helmetDamage, head: false, helmet: true };
      }
      if (!head) return { dmg: dmg * I.vest, head: false };
    }
    return { dmg: head ? dmg * G.HEADSHOT_MULT : dmg, head };
  },
  popHelmet(game, z, dir) {
    z._helmetOn = false;
    const h = z.mesh.userData.helmet;
    if (G.Audio && G.Audio.zombie) G.Audio.zombie("helmet_off", z.type, z.mesh.position.clone().setY(z.mesh.position.y + 1.8));
    if (!h || !game.scene) return;
    game.scene.attach(h);
    const d = dir ? dir.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1);
    this.loose.push({ obj: h, vel: d.multiplyScalar(2.5 + G.rng()).setY(3 + G.rng()), spin: new THREE.Vector3((G.rng() - 0.5) * 12, (G.rng() - 0.5) * 8, (G.rng() - 0.5) * 12), t: 0,
      floorY: G.getFloorHeightAt(game.world, z.mesh.position.x, z.mesh.position.z, z.mesh.position.y) });
  },
  // after the damage, if it lives: how hard it was hit
  react(game, z, dmg, info) {
    if (!z.alive || z.type === "boss") return;
    const H = this.C().hit, f = dmg / Math.max(1, z.maxHp), now = performance.now() / 1000;
    if (f >= H.heavy && now - (z._lastDown || -99) > H.heavyCooldown) {
      z._lastDown = now;
      z._down = H.downTime; z._hold = Math.max(z._hold || 0, H.downTime);
      z._atk = null;
      if (z._rear > 0) this.cancelScream(z);
    } else if (f >= H.medium) {
      z._stagger = H.staggerTime; z._hold = Math.max(z._hold || 0, H.staggerTime * 0.8);
      const d = info && info.dir;
      if (d && game.pushZombie) game.pushZombie(z, d.x, d.z, H.staggerBack);
    } else if (z.flinch) z.flinch();
  },
  cancelScream(z) {
    z._rear = 0; z._screaming = false; z._screamCd = this.C().screamer.cooldown * 0.5;
    if (G.Audio && G.Audio.stopTag) G.Audio.stopTag("scream:" + z.uid);
  },
  // it died: what it was in the middle of stops (a shriek never comes)
  onDeath(game, z) {
    if (z.type === "screamer" && (z._rear > 0 || z._screaming)) this.cancelScream(z);
    z._atk = null;
  },

  // ---------------- the Bloater's burst (js/zombiefx.js, at the end of its swell) ----------------
  burst(game, at) {
    const B = this.C().bloater;
    if (G.Audio && G.Audio.zombie) G.Audio.zombie("pop", "bloater", at.clone().setY(at.y + 1));
    if (G.Captions) G.Captions.heard("zombie:burst", at);
    // the zombies round it: thrown back, staggering -- never killed
    game.zombies.forEach((o) => {
      if (!o.alive || o.type === "boss" || o.emerge) return;
      const dx = o.mesh.position.x - at.x, dz = o.mesh.position.z - at.z, d = Math.hypot(dx, dz);
      if (d > B.radius) return;
      if (game.pushZombie) game.pushZombie(o, dx || 0.01, dz, B.push * (1 - d / B.radius) + 0.3);
      o._stagger = B.stagger; o._hold = Math.max(o._hold || 0, B.stagger * 0.8); o._atk = null;
    });
    // the player close by: hurt, less further out
    if (game.state !== "GAMEPLAY" || (G.Modal && G.Modal.freezesWorld())) return 0;
    const p = game.yawObject.position;
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (d > B.radius || Math.abs((p.y - 1.7) - at.y) > 1.6) return 0;
    const dmg = B.damage * (1 - d / B.radius) * (1 - (game.player.armorPct || 0)) * (G.Abilities ? G.Abilities.damageTakenMult() : 1);
    if (dmg <= 0) return 0;
    game.player.hp -= dmg;
    game.player.wasHitThisLevel = true;
    if (G.UI && G.UI.flashDamage) G.UI.flashDamage();
    game.checkPlayerDeath();
    return dmg;
  },

  // ---------------- once a frame: what was knocked loose ----------------
  update(game, dt) {
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const L = this.loose[i], o = L.obj;
      L.t += dt;
      L.vel.y -= 12 * dt;
      o.position.addScaledVector(L.vel, dt);
      o.rotation.x += L.spin.x * dt; o.rotation.y += L.spin.y * dt; o.rotation.z += L.spin.z * dt;
      if (o.position.y < L.floorY + 0.12) {
        o.position.y = L.floorY + 0.12;
        if (L.vel.y < -1.5 && G.Audio && G.Audio.zombie) G.Audio.zombie("helmet_land", "ironclad", o.position.clone());
        L.vel.y *= -0.3; L.vel.x *= 0.5; L.vel.z *= 0.5; L.spin.multiplyScalar(0.5);
      }
      if (L.t > 6) {
        if (o.parent) o.parent.remove(o);
        G.disposeObject3D(o);
        this.loose.splice(i, 1);
      }
    }
  },
  reset() {
    this.loose.forEach((L) => { if (L.obj.parent) L.obj.parent.remove(L.obj); G.disposeObject3D(L.obj); });
    this.loose = [];
  },
};
