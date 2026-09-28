// ===================================================================
// Abilities (round 3, H): the boss's reward
// -------------------------------------------------------------------
// A perk is passive and bought in the shop; an ability is used when the
// player chooses, has a cooldown, and only comes from beating a boss (the
// hard word after its death answered right -> the honeycomb, G6 step 3).
// None of them hurts or kills a zombie: every zombie still has to be shot on
// its word. Twenty of them, in five kinds:
//
//   move      Dash, Overdrive, Pole Vault, Rewind
//   defend    Barrier, Smoke Bomb, Decoy, Patch Up
//   control   Frost Sprite (freezes the zombie you aim at, 4.5 s), Shockwave,
//             Time Warp, Glue Trap, Flashbang, Gravity Well
//   words     Word Radar, Whisper, Fifty-Fifty, Translator Lens
//   support   Resupply, Magnet
//
// Bosses shrug control off: frozen 0.8 s instead of 4.5, a shockwave only
// staggers them, the slowing fields barely touch them, and a flash, a
// smoke cloud, a decoy or a gravity well do nothing to them at all.
//
// The honeycomb (js/abilityui.js): five hidden hexagons, one picked, it
// turns over, then the other four -- so the player sees what else there
// was. A G.Modal window; the game is paused. What was offered (picked or
// not) never comes again in the same run: a shuffle bag of the twenty, five
// drawn a boss, so four bosses answered right show all twenty exactly once.
// Four abilities at most (one a boss); they last the run, and a checkpoint
// keeps them (js/checkpoint.js).
//
// Used with Q / F / C / X (Settings > Key bindings), the D-pad on a
// controller (up, right, down, left), or the ability buttons on a touch
// screen (movable and resizable in the touch layout editor). The HUD shows
// each with its cooldown ring and its key.
// ===================================================================
(function () {
  const V3 = THREE.Vector3;

  G.ABILITIES = [
    { id: "dash", icon: "💨", cat: "move", cd: 6 },
    { id: "overdrive", icon: "⚡", cat: "move", cd: 24, dur: 6 },
    { id: "vault", icon: "🦘", cat: "move", cd: 10 },
    { id: "rewind", icon: "⏪", cat: "move", cd: 20 },
    { id: "barrier", icon: "🛡️", cat: "defend", cd: 22, dur: 4 },
    { id: "smoke", icon: "🌫️", cat: "defend", cd: 24, dur: 5 },
    { id: "decoy", icon: "🎭", cat: "defend", cd: 22, dur: 6 },
    { id: "patch", icon: "🩹", cat: "defend", cd: 30, dur: 3 },
    { id: "freeze", icon: "🧊", cat: "control", cd: 14, dur: 4.5 },
    { id: "shockwave", icon: "🌀", cat: "control", cd: 12 },
    { id: "timewarp", icon: "⏳", cat: "control", cd: 22, dur: 5 },
    { id: "glue", icon: "🍯", cat: "control", cd: 18, dur: 8 },
    { id: "flashbang", icon: "✨", cat: "control", cd: 16, dur: 2.5 },
    { id: "well", icon: "🧿", cat: "control", cd: 20, dur: 3 },
    { id: "radar", icon: "📡", cat: "words", cd: 20, dur: 8 },
    { id: "whisper", icon: "🔡", cat: "words", cd: 25, dur: 10 },
    { id: "fifty", icon: "✂️", cat: "words", cd: 30, dur: 10 },
    { id: "lens", icon: "🔍", cat: "words", cd: 40, dur: 6 },
    { id: "resupply", icon: "📦", cat: "support", cd: 28 },
    { id: "magnet", icon: "🧲", cat: "support", cd: 25 },
  ];
  G.ABILITY_BY_ID = {};
  G.ABILITIES.forEach((a) => { G.ABILITY_BY_ID[a.id] = a; });
  // what each one does to a boss (the rest: nothing)
  const BOSS_FREEZE = 0.8, BOSS_STAGGER = 0.4, BOSS_WARP = 0.8, BOSS_GLUE = 0.75;
  // the sizes of things, shared with the tests
  const R = { smoke: 12, decoy: 15, warp: 12, glue: 3.6, well: 10, shock: 6, flash: 15, magnet: 30, freezeRange: 40 };

  const tmp = new V3(), tmp2 = new V3();
  const FX = () => G.BossFX;

  // small pooled visuals of their own: the frost sprite, ice shells, dazed
  // stars, the decoy, the lens label
  function glowTex(color) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }
  function starsTex() {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 32;
    const g = cv.getContext("2d");
    g.font = "bold 26px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ffe36b";
    g.strokeStyle = "rgba(0,0,0,0.7)"; g.lineWidth = 4;
    ["✦", "✧", "✦"].forEach((s, i) => { g.strokeText(s, 22 + i * 42, 16); g.fillText(s, 22 + i * 42, 16); });
    return new THREE.CanvasTexture(cv);
  }
  // a label that shrinks its text to fit (a long Thai meaning)
  function fitLabel(sprite, text, color) {
    const ctx = sprite.userData.ctx, cv = sprite.userData.canvas;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let size = 60;
    ctx.font = "bold " + size + "px Segoe UI, Tahoma, Leelawadee UI, Noto Sans Thai, sans-serif";
    while (size > 22 && ctx.measureText(text).width > cv.width - 24) { size -= 4; ctx.font = "bold " + size + "px Segoe UI, Tahoma, Leelawadee UI, Noto Sans Thai, sans-serif"; }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.strokeText(text, cv.width / 2, cv.height / 2);
    ctx.fillStyle = color; ctx.fillText(text, cv.width / 2, cv.height / 2);
    sprite.userData.tex.needsUpdate = true;
  }

  G.Abilities = {
    MAX: 4, OFFER: 5, TRAIL_SECONDS: 4, R,
    slots: [], bag: [], fx: {}, trail: [], _trailT: 0,

    name(id) { return G.T("ability." + id + ".name"); },
    desc(id) { return G.T("ability." + id + ".desc"); },
    has(id) { return this.slots.some((s) => s.id === id); },
    active(id) { return (this.fx[id] || 0) > 0; },

    // ---- a run ----
    resetRun() {
      this.clearWorld();
      this.slots = [];
      this.bag = G.shuffle(G.ABILITIES.map((a) => a.id));
      this.offered = [];
      this.fx = {};
      this.trail = [];
      this.stats = {};
      if (G.UI.updateAbilityBar) G.UI.updateAbilityBar(null, true);
    },
    // what a checkpoint keeps: the abilities held (their cooldowns start
    // ready), what is left in the bag and what has been shown
    state() { return { slots: this.slots.map((s) => s.id), bag: this.bag.slice(), offered: (this.offered || []).slice() }; },
    restore(st) {
      st = st || {};
      const ok = (id) => !!G.ABILITY_BY_ID[id];
      this.slots = (st.slots || []).filter(ok).slice(0, this.MAX).map((id) => ({ id, cd: 0 }));
      this.bag = (st.bag || []).filter(ok);
      this.offered = (st.offered || []).filter(ok);
      if (G.UI.updateAbilityBar) G.UI.updateAbilityBar(null, true);
    },
    // five from the bag; once it runs dry (Endless), a fresh one without
    // what is held
    draw() {
      if (this.bag.length < this.OFFER) {
        const fresh = G.shuffle(G.ABILITIES.map((a) => a.id).filter((id) => !this.has(id) && !this.bag.includes(id)));
        this.bag = this.bag.concat(fresh);
      }
      const out = this.bag.splice(0, this.OFFER);
      this.offered = (this.offered || []).concat(out);
      return out;
    },

    // ---- the honeycomb (G6 step 3) ----
    offer(game, next) {
      const ids = this.draw();
      if (!ids.length || !G.UI.openHive) { next(); return; }
      G.UI.openHive(ids, (id, replaceIdx) => {
        if (id) {
          const slot = { id, cd: 0 };
          if (this.slots.length < this.MAX) this.slots.push(slot);
          else if (replaceIdx != null && replaceIdx >= 0) this.slots[replaceIdx] = slot;
        }
        if (G.UI.updateAbilityBar) G.UI.updateAbilityBar(game, true);
        next();
      });
    },

    // ---- using one ----
    use(game, i) {
      const s = this.slots[i];
      if (!s || !game.playing()) return false;
      if (s.cd > 0) { G.Audio.sfx("empty"); if (G.UI.pulseAbility) G.UI.pulseAbility(i, true); return false; }
      const fn = ACT[s.id];
      const r = fn ? fn(this, game) : false;
      if (r === false) {
        G.Audio.sfx("empty");
        if (G.UI.flashAbilityNote) G.UI.flashAbilityNote(G.T("ability.noTarget." + s.id) !== "ability.noTarget." + s.id ? G.T("ability.noTarget." + s.id) : G.T("ability.noTarget"));
        return false;
      }
      s.cd = G.ABILITY_BY_ID[s.id].cd;
      G.Audio.ability(s.id);
      if (G.UI.pulseAbility) G.UI.pulseAbility(i, false);
      this.stats = this.stats || {};
      this.stats[s.id] = (this.stats[s.id] || 0) + 1;
      return true;
    },

    // ---- every frame of play ----
    update(game, dt) {
      this.slots.forEach((s) => { if (s.cd > 0) s.cd = Math.max(0, s.cd - dt); });
      const F = this.fx;
      // every effect's time left runs down (the "_" ones keep their own count)
      Object.keys(F).forEach((k) => { if (typeof F[k] === "number" && k[0] !== "_") F[k] = Math.max(0, F[k] - dt); });
      const P = game.yawObject.position;
      // where the player has been (Rewind): ten points a second
      this._trailT -= dt;
      if (this._trailT <= 0) {
        this._trailT = Math.max(0.02, this._trailT + 0.1);
        this.trail.push({ x: P.x, y: P.y, z: P.z, yaw: game.yawObject.rotation.y });
        if (this.trail.length > this.TRAIL_SECONDS * 10 + 5) this.trail.shift();
      }
      // Dash / Pole Vault: the body carried along
      if (F._dashLeft > 0) {
        const s = Math.min(F._dashLeft, dt);
        F._dashLeft -= s;
        game.tryMove(F.dashDir.x * 34 * s, F.dashDir.z * 34 * s);
        if (Math.random() < 0.8) FX().mote(P.x, P.y - 1.2, P.z, 0, 0.4, 0, 0x9ae8ff, 0.4, 2, 0);
      }
      if (F.vaultT > 0 && game.velocityY !== 0) game.tryMove(F.vaultDir.x * 6.5 * dt, F.vaultDir.z * 6.5 * dt);
      if (F.patch > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + F._patchRate * dt);
      // the fields and clouds, shown as long as they last
      if (F.decoy > 0 && F.decoyMesh) { F.decoyMesh.rotation.y += dt * 0.6; if (F.decoyRing) F.decoyRing.set({ prog: 1 - F.decoy / 6 }); }
      if (!(F.decoy > 0) && F.decoyMesh) this.dropDecoy();
      [["timewarp", "warpDecal"], ["glue", "glueDecal"], ["well", "wellDecal"], ["smoke", "smokeDecal"]].forEach(([k, d]) => {
        if (F[k] > 0) {
          if (F[d]) F[d].set({ opacity: Math.min(0.8, F[k]) * (k === "glue" ? 1 : 0.8) });
          if (k === "well" && Math.random() < 0.9) { const a = Math.random() * 6.3, r = 3 + Math.random() * 7; FX().mote(F.wellAt.x + Math.cos(a) * r, F.wellAt.y + 0.3 + Math.random() * 2, F.wellAt.z + Math.sin(a) * r, -Math.cos(a) * 6, 0, -Math.sin(a) * 6, 0xb07aff, 1, 0.5, 0); }
          if (k === "smoke" && Math.random() < 0.9) { const a = Math.random() * 6.3, r = Math.random() * 10; FX().mote(F.smokeAt.x + Math.cos(a) * r, F.smokeAt.y + 0.3 + Math.random() * 2.5, F.smokeAt.z + Math.sin(a) * r, 0, 0.2, 0, 0x6a6e74, 2.5, 0.2, 0); }
          if (k === "timewarp" && Math.random() < 0.6) { const a = Math.random() * 6.3, r = Math.random() * 12; FX().mote(F.warpAt.x + Math.cos(a) * r, F.warpAt.y + 0.2 + Math.random() * 2, F.warpAt.z + Math.sin(a) * r, 0, 0.1, 0, 0x7ad8ff, 1.5, 0.2, 0); }
        } else if (F[d]) { F[d].hide(); F[d] = null; }
      });
      // a helper on its way to a zombie
      if (F.sprite) {
        const sp = F.sprite;
        sp.t += dt;
        const gone = sp.boss ? !G.Bosses.fighting() : !sp.z.alive;
        const target = sp.boss ? tmp.set(sp.boss.pos.x, sp.boss.pos.y + sp.boss.rig.H * 0.6, sp.boss.pos.z) : tmp.set(sp.z.mesh.position.x, sp.z.mesh.position.y + 1.2, sp.z.mesh.position.z);
        const k = Math.min(1, sp.t / 0.35);
        sp.obj.position.lerpVectors(sp.from, target, k);
        sp.obj.position.y += Math.sin(k * Math.PI) * 0.8;
        if (gone) this.hideSprite();
        else if (k >= 1) {
          this.hideSprite();
          if (sp.boss) sp.boss.frozenT = BOSS_FREEZE;
          else sp.z.frozenT = G.ABILITY_BY_ID.freeze.dur;
          FX().sparks(target.x, target.y, target.z, 18, 0xcff4ff, 3);
          G.Audio.ability("freeze_hit");
        }
      }
      // ice shells and dazed stars follow their zombies
      this.updateMarks(game);
      // Word Radar: the right one, through walls
      this.updateRadar(game);
      if (!(F.fifty > 0) && F.fiftyOn) this.clearFifty(game);
      this.updateLens(game);
      // Magnet: pickups fly in
      (game.drops || []).forEach((d) => {
        if (!d.magnet) return;
        const m = d.mesh.position, dx = P.x - m.x, dz = P.z - m.z, dd = Math.hypot(dx, dz);
        if (dd > 0.05) { const s = Math.min(dd, 20 * dt); m.x += dx / dd * s; m.z += dz / dd * s; d.baseY = G.getFloorHeightAt(game.world, m.x, m.z, P.y - 1.7); }
      });
      document.body.classList.toggle("ab-barrier", F.barrier > 0);
      document.body.classList.toggle("ab-overdrive", F.overdrive > 0);
      if (G.UI.updateAbilityBar) G.UI.updateAbilityBar(game);
    },

    // ---- what the rest of the game asks ----
    // damage the player takes from anything that attacks (bites, traps, a
    // boss): none while dashing, a quarter behind the Barrier
    damageTakenMult() {
      if (this.fx.dashSafe > 0) return 0;
      return this.fx.barrier > 0 ? 0.25 : 1;
    },
    moveMult() { return this.fx.overdrive > 0 ? 1.25 : 1; },
    freeStamina() { return this.fx.overdrive > 0; },
    fovKick() { return (this.fx._dashLeft > 0 ? 9 : 0) + (this.fx.overdrive > 0 ? 3 : 0); },
    whisper() { return this.fx.whisper > 0; },
    // one zombie this frame: frozen or dazed (stands still), lost in smoke or
    // drawn to the decoy or the well (walks elsewhere), in a slow field or
    // glue (slower). Reused object -- read it at once.
    _mod: { skip: false, frozen: false, speed: 1, target: null, noBite: false },
    zombieMod(game, z, dt) {
      const m = this._mod, F = this.fx;
      m.skip = false; m.frozen = false; m.speed = 1; m.target = null; m.noBite = false;
      if (z.frozenT > 0) { z.frozenT -= dt; m.skip = true; m.frozen = true; m.noBite = true; return m; }
      if (z.stunT > 0) { z.stunT -= dt; m.skip = true; m.noBite = true; return m; }
      const p = z.mesh.position;
      if (F.well > 0 && Math.hypot(p.x - F.wellAt.x, p.z - F.wellAt.z) < R.well && Math.abs(p.y - F.wellAt.y) < 2) {
        // pulled in, stumbling: no bite
        const dx = F.wellAt.x - p.x, dz = F.wellAt.z - p.z, d = Math.hypot(dx, dz);
        if (d > 0.9) game.pushZombie(z, dx, dz, Math.min(d - 0.9, 3.2 * dt));
        m.skip = true; m.noBite = true;
        return m;
      }
      // the smoke is a cloud: anything that walks into it loses the player too
      if (F.smoke > 0 && !(z.lostT > 0) && Math.hypot(p.x - F.smokeAt.x, p.z - F.smokeAt.z) < R.smoke - 1 && Math.abs(p.y - F.smokeAt.y) < 2) { z.lostT = F.smoke; z._wander = null; }
      if (z.lostT > 0) {
        z.lostT -= dt;
        if (!z._wander || Math.hypot(p.x - z._wander.x, p.z - z._wander.z) < 1) {
          const a = Math.random() * 6.3; z._wander = new V3(p.x + Math.cos(a) * 5, 0, p.z + Math.sin(a) * 5);
        }
        m.target = z._wander; m.noBite = true; m.speed = 0.6;
      } else if (F.decoy > 0 && F.decoyAt && Math.hypot(p.x - F.decoyAt.x, p.z - F.decoyAt.z) < R.decoy && Math.abs(p.y - F.decoyAt.y) < 2) {
        m.target = F.decoyAt; m.noBite = true;
      }
      if (F.timewarp > 0 && Math.hypot(p.x - F.warpAt.x, p.z - F.warpAt.z) < R.warp) m.speed *= 0.33;
      if (F.glue > 0 && Math.hypot(p.x - F.glueAt.x, p.z - F.glueAt.z) < R.glue && Math.abs(p.y - F.glueAt.y) < 1.5) m.speed *= 0.2;
      return m;
    },
    // a boss: how much of its time passes (Time Warp, Glue)
    bossSpeed(b) {
      const F = this.fx;
      let k = 1;
      if (F.timewarp > 0 && Math.hypot(b.pos.x - F.warpAt.x, b.pos.z - F.warpAt.z) < R.warp + b.rig.R) k *= BOSS_WARP;
      if (F.glue > 0 && Math.hypot(b.pos.x - F.glueAt.x, b.pos.z - F.glueAt.z) < R.glue + b.rig.R) k *= BOSS_GLUE;
      return k;
    },
    // a new word to find: the crossing-out belonged to the last one, so it
    // is done again for the new one while Fifty-Fifty lasts
    onNewTarget(game) {
      if (!this.fx.fiftyOn) return;
      this.clearFifty(game);
      if (this.fx.fifty > 0) crossOut(this, game);
    },
    // the player moved by the game (a boss arena, a checkpoint): the way
    // back is somewhere they can no longer go
    clearTrail() { this.trail = []; },

    // ---- aiming ----
    // the zombie (or boss) under the crosshair: the first thing a ray from
    // the eye meets before a wall, else the nearest in a narrow cone
    aimed(game, range) {
      range = range || R.freezeRange;
      const dir = new V3(), origin = new V3();
      game.camera.getWorldDirection(dir); game.camera.getWorldPosition(origin);
      const wall = game.wallDistance(origin, dir, range);
      const live = game.zombies.filter((z) => z.alive);
      live.forEach((z) => z.mesh.updateMatrixWorld(true));
      const rc = game.raycaster;
      rc.set(origin, dir); rc.far = wall; rc.camera = game.camera;
      const bh = G.Bosses.fighting() ? G.Bosses.hitboxes() : [];
      if (bh.length) G.Bosses.boss.root.updateMatrixWorld(true);
      const hits = rc.intersectObjects(live.map((z) => z.mesh).concat(bh), true);
      for (const h of hits) {
        if (h.object.isSprite) continue;
        if (h.object.userData.bossHit) return { boss: G.Bosses.boss };
        let o = h.object; while (o && !o.userData.zombie) o = o.parent;
        if (o && o.userData.zombie.alive) return { z: o.userData.zombie };
      }
      let best = null, bs = 0.97;
      for (const z of live) {
        tmp.set(z.mesh.position.x, z.mesh.position.y + 1.1, z.mesh.position.z).sub(origin);
        const d = tmp.length();
        if (d > range) continue;
        const c = tmp.normalize().dot(dir);
        if (c > bs && game.wallDistance(origin, tmp, d) >= d - 0.5) { bs = c; best = z; }
      }
      return best ? { z: best } : null;
    },
    // a spot on the floor where the player looks (for Glue and the Well)
    aimFloor(game, maxD) {
      const dir = new V3(), origin = new V3();
      game.camera.getWorldDirection(dir); game.camera.getWorldPosition(origin);
      const feet = origin.y - 1.7, floor = G.getFloorHeightAt(game.world, origin.x, origin.z, feet);
      let d = maxD;
      if (dir.y < -0.05) d = Math.min(maxD, (origin.y - floor) / -dir.y);
      d = Math.min(d, game.wallDistance(origin, dir, d) - 0.3);
      const flat = new V3(dir.x, 0, dir.z);
      if (flat.lengthSq() < 1e-6) flat.set(-Math.sin(game.yawObject.rotation.y), 0, -Math.cos(game.yawObject.rotation.y));
      flat.normalize();
      const reach = Math.max(1.5, d * Math.max(0.3, Math.hypot(dir.x, dir.z)));
      const x = origin.x + flat.x * reach, z = origin.z + flat.z * reach;
      return new V3(x, G.getFloorHeightAt(game.world, x, z, feet), z);
    },

    // ---- the bits that follow a zombie ----
    shell() {
      this._shells = this._shells || [];
      let s = this._shells.find((x) => !x.z);
      if (!s) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xa8e8ff, emissive: 0x1a4a66, transparent: true, opacity: 0.45, depthWrite: false }));
        mesh.frustumCulled = false;
        s = { mesh, z: null };
        this._shells.push(s);
      }
      return s;
    },
    stars() {
      this._stars = this._stars || [];
      let s = this._stars.find((x) => !x.z);
      if (!s) {
        this._starTex = this._starTex || starsTex();
        const obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._starTex, transparent: true, depthWrite: false }));
        obj.scale.set(1.0, 0.25, 1);
        s = { obj, z: null };
        this._stars.push(s);
      }
      return s;
    },
    updateMarks(game) {
      const scene = game.scene;
      // ice for every frozen zombie
      game.zombies.forEach((z) => {
        if (z.frozenT > 0 && z.alive && !z._shell) {
          const s = this.shell(); s.z = z; z._shell = s;
          const sc = G.ZOMBIE_TYPES[z.type].scale || 1;
          s.mesh.scale.set(1.0 * sc, 2.0 * sc, 0.9 * sc);
          scene.add(s.mesh);
        }
        if (z.stunT > 0 && z.alive && !z._stars) { const s = this.stars(); s.z = z; z._stars = s; scene.add(s.obj); }
      });
      const t = performance.now();
      (this._shells || []).forEach((s) => {
        if (!s.z) return;
        if (!(s.z.frozenT > 0) || !s.z.alive || !s.z.mesh.parent) { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); s.z._shell = null; s.z = null; return; }
        const p = s.z.mesh.position;
        s.mesh.position.set(p.x, p.y + s.mesh.scale.y / 2 - 0.05, p.z);
        s.mesh.material.opacity = 0.35 + 0.1 * Math.sin(t / 180) + (s.z.frozenT < 1 ? -0.2 * (1 - s.z.frozenT) : 0);
      });
      (this._stars || []).forEach((s) => {
        if (!s.z) return;
        if (!(s.z.stunT > 0) || !s.z.alive || !s.z.mesh.parent) { if (s.obj.parent) s.obj.parent.remove(s.obj); s.z._stars = null; s.z = null; return; }
        const p = s.z.mesh.position, sc = G.ZOMBIE_TYPES[s.z.type].scale || 1;
        s.obj.position.set(p.x + Math.sin(t / 150) * 0.1, p.y + 2.05 * sc, p.z);
      });
    },
    hideSprite() { const sp = this.fx.sprite; if (sp && sp.obj.parent) sp.obj.parent.remove(sp.obj); this.fx.sprite = null; },

    // ---- Word Radar ----
    updateRadar(game) {
      const on = this.fx.radar > 0;
      const tw = game.targetPair && game.targetPair[0];
      const z = on && tw ? game.zombies.find((x) => x.alive && x.word === tw) : null;
      if (this._radarZ && this._radarZ !== z) this.unmark(this._radarZ);
      if (z && this._radarZ !== z) {
        z.sprite.material.depthTest = false; z.sprite.renderOrder = 998;
        if (!this._radarGlow) {
          this._radarGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,210,70,0.6)"), color: 0xffd23a, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
          this._radarGlow.renderOrder = 997;
        }
        z.mesh.add(this._radarGlow);
        this._radarGlow.position.set(0, 1.0, 0);
        const sc = 1 / (G.ZOMBIE_TYPES[z.type].scale || 1);
        this._radarGlow.scale.set(2.4 * sc, 3.0 * sc, 1);
      }
      this._radarZ = z;
      this.radarTarget = z;
    },
    unmark(z) {
      if (z.sprite) { z.sprite.material.depthTest = true; z.sprite.renderOrder = 0; }
      if (this._radarGlow && this._radarGlow.parent) this._radarGlow.parent.remove(this._radarGlow);
    },

    // ---- Fifty-Fifty ----
    clearFifty(game) {
      this.fx.fiftyOn = false;
      game.zombies.forEach((z) => { if (z.ruledOut) { z.ruledOut = false; if (z.alive) z.setTarget(z.isTarget); } });
    },

    // ---- Translator Lens ----
    updateLens(game) {
      const on = this.fx.lens > 0;
      this._lensT = (this._lensT || 0) - 1;
      let z = this._lensZ;
      if (on && this._lensT <= 0) { this._lensT = 6; const a = this.aimed(game, 45); z = a && a.z ? a.z : null; }
      if (!on || !z || !z.alive) z = null;
      if (z !== this._lensZ) {
        if (this._lensSprite && this._lensSprite.parent) this._lensSprite.parent.remove(this._lensSprite);
        if (z) {
          if (!this._lensSprite) this._lensSprite = G.makeWordSprite(" ", { color: "#9ae8ff" });
          fitLabel(this._lensSprite, z.meaning, "#9ae8ff");
          const sc = G.ZOMBIE_TYPES[z.type].scale || 1;
          this._lensSprite.position.set(0, 2.0 * sc + 0.85, 0);
          this._lensSprite.scale.set(2.6 / sc, 0.65 / sc, 1);
          z.mesh.add(this._lensSprite);
        }
        this._lensZ = z;
      }
    },

    // ---- the decoy ----
    dropDecoy() {
      const F = this.fx;
      if (F.decoyMesh && F.decoyMesh.parent) F.decoyMesh.parent.remove(F.decoyMesh);
      if (F.decoyRing) F.decoyRing.hide();
      F.decoyMesh = null; F.decoyRing = null; F.decoyAt = null;
    },
    buildDecoy() {
      if (this._decoy) return this._decoy;
      const g = new THREE.Group();
      const card = new THREE.MeshLambertMaterial({ color: 0xb58a55 }), paint = new THREE.MeshLambertMaterial({ color: 0x3a6a4a }), skin = new THREE.MeshLambertMaterial({ color: 0xd8b48a });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.06), paint); body.position.y = 1.0; g.add(body);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.06), card); legs.position.y = 0.3; g.add(legs);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), skin); head.rotation.x = Math.PI / 2; head.position.y = 1.72; g.add(head);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.4), card); stand.position.set(0, 0.3, -0.18); stand.rotation.x = 0.4; g.add(stand);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(255,120,200,0.5)"), color: 0xff7ad0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(2, 2.6, 1); glow.position.y = 1.0; g.add(glow);
      this._decoy = g;
      return g;
    },

    // ---- leaving a run ----
    clearWorld() {
      const F = this.fx || {};
      ["warpDecal", "glueDecal", "wellDecal", "smokeDecal"].forEach((d) => { if (F[d]) F[d].hide(); });
      this.dropDecoy();
      this.hideSprite();
      (this._shells || []).forEach((s) => { if (s.mesh.parent) s.mesh.parent.remove(s.mesh); if (s.z) s.z._shell = null; s.z = null; });
      (this._stars || []).forEach((s) => { if (s.obj.parent) s.obj.parent.remove(s.obj); if (s.z) s.z._stars = null; s.z = null; });
      if (this._radarGlow && this._radarGlow.parent) this._radarGlow.parent.remove(this._radarGlow);
      if (this._lensSprite && this._lensSprite.parent) this._lensSprite.parent.remove(this._lensSprite);
      this._radarZ = null; this._lensZ = null; this.radarTarget = null;
      document.body.classList.remove("ab-barrier", "ab-overdrive");
      this.fx = {};
    },
  };
  const A = G.Abilities;

  // an ability key, touch button or D-pad press
  G.onAbilityPress = function (i) { if (G.Game && G.Game.playing()) A.use(G.Game, i); };

  // ================================================================
  // What each does. Returning false: nothing to use it on (no cooldown).
  // ================================================================
  const flatFwd = (game) => new V3(-Math.sin(game.yawObject.rotation.y), 0, -Math.cos(game.yawObject.rotation.y));
  const feetY = (game) => G.getFloorHeightAt(game.world, game.yawObject.position.x, game.yawObject.position.z, game.yawObject.position.y - 1.7);
  const ensureFX = (game) => { if (!G.BossFX.scene || G.BossFX.scene !== game.scene) G.BossFX.init(game.scene, feetY(game)); };
  // half of the wrong words on the field, crossed out
  function crossOut(A, game) {
    const tw = game.targetPair && game.targetPair[0];
    if (!tw) return 0;
    const wrong = G.shuffle(game.zombies.filter((z) => z.alive && z.word !== tw && !z.ruledOut));
    const n = Math.ceil(wrong.length / 2);
    wrong.slice(0, n).forEach((z) => { z.ruledOut = true; z.setTarget(false); });
    A.fx.fiftyOn = true;
    return n;
  }
  const ACT = {
    dash(A, game) {
      // where the stick points, else straight ahead
      const I = G.Input, f = flatFwd(game), r = new V3(-f.z, 0, f.x);
      let mx = 0, mz = 0;
      if (I.mode === "desktop") { if (I.isDown("forward")) mz -= 1; if (I.isDown("back")) mz += 1; if (I.isDown("left")) mx -= 1; if (I.isDown("right")) mx += 1; }
      else { mx = I.touchMove.x; mz = I.touchMove.y; }
      const gp = I.pollGamepad();
      if (gp) { const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0; if (Math.hypot(lx, ly) > 0.25) { mx += lx; mz += ly; } }
      const dir = Math.hypot(mx, mz) > 0.2 ? f.clone().multiplyScalar(-mz).add(r.clone().multiplyScalar(mx)).normalize() : f;
      A.fx.dashDir = dir; A.fx._dashLeft = 0.18; A.fx.dashT = 0.18; A.fx.dashSafe = 0.3;
      ensureFX(game);
      return true;
    },
    overdrive(A, game) { A.fx.overdrive = 6; game.stamina = game.maxStamina; game.staminaExhausted = false; return true; },
    vault(A, game) {
      if (game.velocityY !== 0) return false;              // already in the air
      game.velocityY = 6.2;                                // about two metres up: over their heads
      A.fx.vaultDir = flatFwd(game); A.fx.vaultT = 1.4;
      ensureFX(game);
      const P = game.yawObject.position;
      for (let i = 0; i < 10; i++) FX().mote(P.x, P.y - 1.6, P.z, (Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3, 0xffe0a0, 0.5, 1.5, 0);
      return true;
    },
    rewind(A, game) {
      if (A.trail.length < 10) return false;
      const t = A.trail[Math.max(0, A.trail.length - A.TRAIL_SECONDS * 10)];
      const P = game.yawObject.position;
      ensureFX(game);
      for (let i = 0; i < 20; i++) FX().mote(P.x, P.y - 1 + Math.random() * 1.5, P.z, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, 0x9a7aff, 0.8, 1, 0);
      P.set(t.x, t.y, t.z);
      game.velocityY = 0; game._prevPos = null;
      for (let i = 0; i < 20; i++) FX().mote(P.x, P.y - 1 + Math.random() * 1.5, P.z, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, 0x9a7aff, 0.8, 1, 0);
      A.trail = [];
      if (G.Zones) G.Zones.update(game, true);
      return true;
    },
    barrier(A) { A.fx.barrier = 4; return true; },
    smoke(A, game) {
      ensureFX(game);
      const P = game.yawObject.position, y = feetY(game);
      A.fx.smoke = 5; A.fx.smokeAt = new V3(P.x, y, P.z);
      if (A.fx.smokeDecal) A.fx.smokeDecal.hide();
      A.fx.smokeDecal = FX().decal({ mode: "blob", x: P.x, z: P.z, y: y + 0.05, r: R.smoke - 1, w: 3, color: 0x3a3e44, opacity: 0.5 });
      game.zombies.forEach((z) => { if (z.alive && Math.hypot(z.mesh.position.x - P.x, z.mesh.position.z - P.z) < R.smoke && Math.abs(z.mesh.position.y - y) < 2) { z.lostT = 5; z._wander = null; } });
      return true;
    },
    decoy(A, game) {
      ensureFX(game);
      A.dropDecoy();
      const f = flatFwd(game), P = game.yawObject.position;
      let x = P.x + f.x * 2.2, z = P.z + f.z * 2.2;
      if (game.wallDistance(tmp2.set(P.x, P.y - 1, P.z), tmp.set(f.x, 0, f.z), 2.2) < 2.2) { x = P.x + f.x * 0.8; z = P.z + f.z * 0.8; }
      const y = G.getFloorHeightAt(game.world, x, z, P.y - 1.7);
      const m = A.buildDecoy();
      m.position.set(x, y, z); m.rotation.y = game.yawObject.rotation.y + Math.PI;
      game.scene.add(m);
      A.fx.decoy = 6; A.fx.decoyAt = new V3(x, y, z); A.fx.decoyMesh = m;
      A.fx.decoyRing = FX().decal({ mode: "disc", x, z, y: y + 0.05, r: 1.3, w: 0.3, color: 0xff7ad0, opacity: 0.8, prog: 0, add: true });
      return true;
    },
    patch(A, game) {
      if (game.player.hp >= game.player.maxHp - 0.5) return false;
      A.fx.patch = 3; A.fx._patchRate = game.player.maxHp * 0.35 / 3;
      return true;
    },
    freeze(A, game) {
      const a = A.aimed(game, R.freezeRange);
      if (!a) return false;
      if (A.fx.sprite) A.hideSprite();
      if (!A._spriteObj) {
        A._spriteObj = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("rgba(150,220,255,0.7)"), color: 0xbff0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        A._spriteObj.scale.set(0.7, 0.7, 1);
      }
      const from = new V3(); game.camera.getWorldPosition(from);
      from.add(flatFwd(game).multiplyScalar(0.6)); from.y -= 0.3;
      A._spriteObj.position.copy(from);
      game.scene.add(A._spriteObj);
      A.fx.sprite = { obj: A._spriteObj, from, t: 0, z: a.z || null, boss: a.boss || null };
      ensureFX(game);
      return true;
    },
    shockwave(A, game) {
      ensureFX(game);
      const P = game.yawObject.position, y = feetY(game);
      FX().shock(P.x, P.z, R.shock + 1, 0x9ae8ff, 0.5).set({ y: y + 0.06 });
      game.zombies.forEach((z) => {
        if (!z.alive || z.emerge) return;
        const dx = z.mesh.position.x - P.x, dz = z.mesh.position.z - P.z, d = Math.hypot(dx, dz);
        if (d < R.shock && Math.abs(z.mesh.position.y - y) < 2) { game.pushZombie(z, dx, dz, 4); z.stunT = Math.max(z.stunT || 0, 1.0); }
      });
      const b = G.Bosses.fighting() ? G.Bosses.boss : null;
      if (b && Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < R.shock + b.rig.R) b.frozenT = Math.max(b.frozenT || 0, BOSS_STAGGER);
      game.shake(0.05, 0.2);
      return true;
    },
    timewarp(A, game) {
      ensureFX(game);
      const P = game.yawObject.position, y = feetY(game);
      A.fx.timewarp = 5; A.fx.warpAt = new V3(P.x, y, P.z);
      if (A.fx.warpDecal) A.fx.warpDecal.hide();
      A.fx.warpDecal = FX().decal({ mode: "ring", x: P.x, z: P.z, y: y + 0.06, r: R.warp, w: 0.6, color: 0x7ad8ff, opacity: 0.8, add: true });
      return true;
    },
    glue(A, game) {
      ensureFX(game);
      const at = A.aimFloor(game, 22);
      A.fx.glue = 8; A.fx.glueAt = at;
      if (A.fx.glueDecal) A.fx.glueDecal.hide();
      A.fx.glueDecal = FX().decal({ mode: "blob", x: at.x, z: at.z, y: at.y + 0.05, r: R.glue - 0.1, w: 0.6, color: 0xd89a2a, opacity: 0.85 });
      FX().burst(at.x, at.y + 0.2, at.z, 10, 0xd89a2a, 3, 0.15, 2);
      return true;
    },
    flashbang(A, game) {
      const P = game.yawObject.position, f = flatFwd(game);
      game.zombies.forEach((z) => {
        if (!z.alive || z.emerge) return;
        const dx = z.mesh.position.x - P.x, dz = z.mesh.position.z - P.z, d = Math.hypot(dx, dz);
        if (d < R.flash && (dx * f.x + dz * f.z) / (d || 1) > 0.35 && Math.abs(z.mesh.position.y - (P.y - 1.7)) < 2.5) z.stunT = Math.max(z.stunT || 0, 2.5);
      });
      if (G.Cutscene) G.Cutscene.flashScreen(0.45);
      return true;
    },
    well(A, game) {
      ensureFX(game);
      const at = A.aimFloor(game, 12);
      A.fx.well = 3; A.fx.wellAt = at;
      if (A.fx.wellDecal) A.fx.wellDecal.hide();
      A.fx.wellDecal = FX().decal({ mode: "disc", x: at.x, z: at.z, y: at.y + 0.05, r: 1.6, w: 0.5, color: 0xb07aff, opacity: 0.9, prog: 1, add: true });
      return true;
    },
    radar(A, game) { if (!game.targetPair) return false; A.fx.radar = 8; return true; },
    whisper(A, game) { if (!game.targetPair) return false; A.fx.whisper = 10; return true; },
    fifty(A, game) {
      if (!game.targetPair) return false;
      if (A.fx.fiftyOn) A.clearFifty(game);
      if (!crossOut(A, game)) { A.fx.fiftyOn = false; return false; }
      A.fx.fifty = 10;
      return true;
    },
    lens(A) { A.fx.lens = 6; A._lensT = 0; return true; },
    resupply(A, game) {
      const pl = game.player;
      if (!pl.gunSlots.length) return false;
      pl.gunSlots.forEach((id) => {
        const d = G.WEAPON_DEFS[id], a = pl.ammo[id];
        if (!d || !a) return;
        const mag = Math.round(d.magSize * (pl.weaponLevels[id] ? pl.weaponLevels[id].mag : 1));
        a.mag = mag; a.reserve += mag;
      });
      game.cancelReload();
      G.UI.pulseHudStat("ammo");
      return true;
    },
    magnet(A, game) {
      const P = game.yawObject.position;
      const near = (game.drops || []).filter((d) => Math.hypot(d.mesh.position.x - P.x, d.mesh.position.z - P.z) < R.magnet && Math.abs(d.baseY - (P.y - 1.7)) < 3);
      if (!near.length) return false;
      near.forEach((d) => { d.magnet = true; });
      return true;
    },
  };
  A.ACT = ACT;

  // ================================================================
  // Sounds: each one its own, so it can be told apart in a fight
  // ================================================================
  Object.assign(G.Audio, {
    ability(id) {
      if (!this.ctx) return;
      const t = (o) => this.tone(Object.assign({ prio: true }, o)), n = (o) => this.noise(Object.assign({ prio: true }, o));
      switch (id) {
        case "dash": n({ dur: 0.25, freq: 700, freqEnd: 2600, q: 0.8, gain: 0.3 }); break;
        case "overdrive": t({ type: "sawtooth", freq: 180, freqEnd: 820, dur: 0.45, gain: 0.12, filter: { type: "lowpass", freq: 2200 } }); t({ type: "sine", freq: 660, dur: 0.5, gain: 0.08, at: 0.35, vibrato: { rate: 12, depth: 20 } }); break;
        case "vault": n({ dur: 0.35, freq: 500, freqEnd: 1800, gain: 0.2 }); t({ type: "triangle", freq: 300, freqEnd: 900, dur: 0.3, gain: 0.12 }); break;
        case "rewind": t({ type: "sine", freq: 1400, freqEnd: 260, dur: 0.6, gain: 0.14, vibrato: { rate: 18, depth: 40 } }); n({ dur: 0.5, filter: "highpass", freq: 3000, freqEnd: 800, gain: 0.08 }); break;
        case "barrier": [523, 784, 1046].forEach((f, i) => t({ type: "triangle", freq: f, dur: 0.7, gain: 0.1, at: i * 0.05, vibrato: { rate: 9, depth: 6 } })); break;
        case "smoke": n({ dur: 1.1, filter: "lowpass", freq: 900, freqEnd: 180, gain: 0.3, attack: 0.05 }); t({ type: "sine", freq: 180, freqEnd: 90, dur: 0.2, gain: 0.2 }); break;
        case "decoy": t({ type: "square", freq: 420, freqEnd: 900, dur: 0.12, gain: 0.08, filter: { type: "lowpass", freq: 1800 } }); t({ type: "sine", freq: 1320, freqEnd: 990, dur: 0.4, gain: 0.08, at: 0.12, vibrato: { rate: 7, depth: 30 } }); break;
        case "patch": [440, 554, 659, 880].forEach((f, i) => t({ type: "sine", freq: f, dur: 0.4, gain: 0.08, at: i * 0.07 })); break;
        case "freeze": t({ type: "triangle", freq: 1500, freqEnd: 3000, dur: 0.3, gain: 0.08 }); n({ dur: 0.3, filter: "highpass", freq: 5000, gain: 0.06 }); break;
        case "freeze_hit": [2093, 2637, 3136].forEach((f, i) => t({ type: "triangle", freq: f, dur: 0.5, gain: 0.07, at: i * 0.04 })); n({ dur: 0.25, freq: 4000, q: 2, gain: 0.1 }); break;
        case "shockwave": t({ type: "sine", freq: 90, freqEnd: 30, dur: 0.6, gain: 0.5 }); n({ dur: 0.45, filter: "lowpass", freq: 1200, freqEnd: 150, gain: 0.35 }); break;
        case "timewarp": [660, 495, 330].forEach((f, i) => t({ type: "sine", freq: f, freqEnd: f * 0.7, dur: 0.9, gain: 0.08, at: i * 0.06, vibrato: { rate: 4, depth: 25 } })); break;
        case "glue": n({ dur: 0.3, filter: "lowpass", freq: 700, gain: 0.25 }); t({ type: "sine", freq: 220, freqEnd: 80, dur: 0.35, gain: 0.2, vibrato: { rate: 25, depth: 15 } }); break;
        case "flashbang": n({ dur: 0.3, filter: "highpass", freq: 1500, gain: 0.4 }); t({ type: "sine", freq: 3200, dur: 1.4, gain: 0.05, attack: 0.02 }); break;
        case "well": t({ type: "sine", freq: 55, dur: 1.6, gain: 0.35, vibrato: { rate: 3, depth: 8 }, attack: 0.1 }); n({ dur: 1.4, filter: "bandpass", freq: 300, freqEnd: 900, q: 1, gain: 0.12, attack: 0.3 }); break;
        case "radar": [1400, 1400].forEach((f, i) => t({ type: "sine", freq: f, dur: 0.18, gain: 0.12, at: i * 0.22 })); break;
        case "whisper": n({ dur: 0.6, filter: "highpass", freq: 4000, gain: 0.06, attack: 0.1 }); t({ type: "sine", freq: 880, freqEnd: 990, dur: 0.4, gain: 0.05, at: 0.15 }); break;
        case "fifty": [0, 0.12].forEach((a) => n({ dur: 0.06, filter: "highpass", freq: 5000, gain: 0.2, at: a })); t({ type: "triangle", freq: 1046, dur: 0.2, gain: 0.08, at: 0.25 }); break;
        case "lens": t({ type: "sine", freq: 1760, freqEnd: 2350, dur: 0.3, gain: 0.08 }); t({ type: "triangle", freq: 2637, dur: 0.4, gain: 0.05, at: 0.1 }); break;
        case "resupply": ["out", "in", "bolt"].forEach((k, i) => setTimeout(() => this.reloadEvent(k), i * 110)); break;
        case "magnet": t({ type: "sawtooth", freq: 110, freqEnd: 440, dur: 0.6, gain: 0.08, filter: { type: "lowpass", freq: 900 } }); break;
        default: t({ type: "triangle", freq: 880, dur: 0.2, gain: 0.1 });
      }
    },
    // the honeycomb: a hexagon turning over, and the one chosen
    hive(kind) {
      if (!this.ctx) return;
      if (kind === "flip") this.noise({ dur: 0.12, filter: "bandpass", freq: 2200, q: 1.5, gain: 0.08, prio: true });
      else if (kind === "pick") [523, 784, 1046, 1568].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.5, gain: 0.14, at: i * 0.08, prio: true }));
      else if (kind === "open") [392, 523, 659].forEach((f, i) => this.tone({ type: "sine", freq: f, dur: 0.5, gain: 0.08, at: i * 0.1, prio: true }));
    },
  });
})();
