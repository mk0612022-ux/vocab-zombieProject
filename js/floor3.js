// ===================================================================
// The school's third floor (round 3, I)
// -------------------------------------------------------------------
// Six steps, in order, all in the one run:
//   1  the second floor open
//   2  the wave 5 boss beaten
//   3  50 zombies shot on the right word this run
//   4  3 of this run's story notes read
// ...and once those four are done, the Floor 3 Keycard appears in one of
// the second floor's rooms (a glowing card, a beam of light over it and a
// mark on the minimap, pinned to its rim when far away). Then:
//   5  pick the keycard up (walk over it)
//   6  the Vocabulary Lock on the grille at the foot of the third floor's
//      stair: three hard words in a row, fifteen seconds each. All three
//      right and the grille lifts; one wrong (or too slow) and the lock
//      jams for 30 seconds of play, then asks three new words.
// The checklist is in the pause menu, and a small chip on the HUD shows how
// far along it is. Aimed at reaching the third floor around waves 7-10.
// A checkpoint keeps the keycard and the open grille (js/checkpoint.js).
// ===================================================================
(function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s));

  G.Floor3 = {
    // (the numbers: G.CONFIG.floor3, js/config.js)
    CORRECT_KILLS: G.CONFIG.floor3.correctKills, NOTES: G.CONFIG.floor3.notes, BOSS_WAVE: G.CONFIG.floor3.bossWave,
    WORDS: G.CONFIG.floor3.words, WORD_TIME: G.CONFIG.floor3.wordSeconds, LOCKOUT: G.CONFIG.floor3.lockout,
    s: null,

    reset(game) {
      this.clearWorld();
      this.s = { spawned: false, taken: false, room: null, spot: null, lockLeft: 0, round: null, used: [], tries: 0, _t: 0 };
      this._hudSig = null;
    },
    applies(game) { return !!(game && game.world && game.world.thirdFloor && this.s); },

    // ---- the checklist ----
    steps(game) {
      const w = game.world, sf = w.secondFloor, tf = w.thirdFloor, s = this.s;
      const tally = sf ? (sf.countMode === "correct" ? game.correctCount : game.totalZombiesKilled) : 0;
      const notes = game.notesReadRun ? game.notesReadRun.size : 0;
      const boss = G.Bosses.run.downs.some((d) => d.wave >= this.BOSS_WAVE);
      const rows = [
        { key: "second", done: !sf || sf.unlocked, value: !sf || sf.unlocked ? "" : `${Math.min(tally, sf.killsNeeded)} / ${sf.killsNeeded}` },
        { key: "boss", done: boss, value: "" },
        { key: "kills", done: game.correctKills >= this.CORRECT_KILLS, value: `${Math.min(game.correctKills, this.CORRECT_KILLS)} / ${this.CORRECT_KILLS}` },
        { key: "notes", done: notes >= this.NOTES, value: `${Math.min(notes, this.NOTES)} / ${this.NOTES}` },
        { key: "keycard", done: s.taken || tf.unlocked, value: s.spawned && !s.taken && !tf.unlocked ? T("f3.value.search") : "" },
        { key: "lock", done: tf.unlocked, value: s.lockLeft > 0 ? T("f3.value.jammed", { s: Math.ceil(s.lockLeft) }) : "" },
      ];
      rows.forEach((r) => { r.label = T("f3.step." + r.key, { n: r.key === "kills" ? this.CORRECT_KILLS : r.key === "notes" ? this.NOTES : this.BOSS_WAVE }); });
      return rows;
    },
    prereqs(game) { return this.steps(game).slice(0, 4).every((r) => r.done); },
    doneCount(game) { return this.steps(game).filter((r) => r.done).length; },

    // something that counts has happened (a kill, a note, a boss, the second
    // floor): is it time for the keycard?
    check(game) {
      if (!this.applies(game)) return;
      const s = this.s, tf = game.world.thirdFloor;
      if (tf.unlocked || s.spawned) return;
      if (!this.prereqs(game)) return;
      this.spawnKeycard(game);
    },

    // ---- the keycard ----
    rooms(game) {
      const info = game.world.roomInfo || {};
      return Object.keys(info).filter((k) => {
        const sp = info[k].spec;
        return sp && sp.floor === 2 && sp.room && info[k].type !== "stairs";
      });
    },
    // a clear bit of floor in the room, away from its walls and furniture
    spotIn(game, key) {
      const world = game.world, sp = world.roomInfo[key].spec, r = sp.room, y = sp.baseY;
      const box = new THREE.Box3(), list = [];
      for (let i = 0; i < 40; i++) {
        const x = r.cx + (G.rng() - 0.5) * Math.max(0.5, r.w - 3), z = r.cz + (G.rng() - 0.5) * Math.max(0.5, r.d - 3);
        box.min.set(x - 0.6, y + 0.1, z - 0.6); box.max.set(x + 0.6, y + 1.6, z + 0.6);
        if (!G.ColGrid.near(world, x, z, 1.5, list).some((c) => c.intersectsBox(box))) return new THREE.Vector3(x, y, z);
      }
      const n = world.waypointNodes[key];
      return n ? new THREE.Vector3(n.x, y, n.z) : new THREE.Vector3(r.cx, y, r.cz);
    },
    spawnKeycard(game, at, silent) {
      const s = this.s;
      if (!at) {
        const rooms = this.rooms(game);
        if (!rooms.length) return;
        s.room = G.pick(rooms);
        at = this.spotIn(game, s.room);
      }
      s.spawned = true;
      s.spot = { x: at.x, y: at.y, z: at.z };
      const g = new THREE.Group();
      g.position.set(at.x, at.y, at.z);
      const card = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.23, 0.02), new THREE.MeshLambertMaterial({ color: 0x2f7ad8, emissive: 0x16407a }));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.022), new THREE.MeshBasicMaterial({ color: 0xffe36b }));
      stripe.position.y = 0.05;
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.024), new THREE.MeshBasicMaterial({ color: 0xd9c070 }));
      chip.position.set(-0.1, -0.03, 0);
      card.add(body, stripe, chip);
      card.position.y = 1.1;
      g.add(card);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Notes.haloTexture(), color: 0x7ac8ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(1.3, 1.3, 1); halo.position.y = 1.1;
      g.add(halo);
      // a column of light up from it, seen from across the room
      const beamGeo = new THREE.CylinderGeometry(0.28, 0.45, 3.2, 12, 1, true); beamGeo.translate(0, 1.6, 0);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x7ac8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      g.add(beam);
      game.scene.add(g);
      this.mesh = g; this.card = card; this.halo = halo; this.beam = beam;
      if (G.Zones) G.Zones.dirty = true;
      if (!silent) {
        G.Audio.sfx("unlock");
        G.UI.flashPurchaseBanner(T("banner.keycard"), T("banner.keycardText"));
      }
    },
    take(game) {
      const s = this.s;
      if (s.taken) return;
      s.taken = true;
      if (this.mesh) this.mesh.visible = false;
      G.Audio.sfx("pickup_key");
      G.UI.flashPurchaseBanner(T("banner.keycardTaken"), T("banner.keycardTakenText"));
    },

    // ---- every frame ----
    update(game, dt) {
      if (!this.applies(game)) return;
      const s = this.s, tf = game.world.thirdFloor;
      if (s.lockLeft > 0) s.lockLeft = Math.max(0, s.lockLeft - dt);
      s._t -= dt;
      if (s._t <= 0) { s._t = 0.5; this.check(game); }
      if (this.mesh && !s.taken) {
        const t = performance.now() / 1000;
        this.card.rotation.y += dt * 2;
        this.card.position.y = 1.1 + Math.sin(t * 2.4) * 0.08;
        this.halo.material.opacity = 0.55 + 0.3 * Math.sin(t * 3);
        this.beam.material.opacity = 0.12 + 0.08 * Math.sin(t * 2);
        const p = game.yawObject.position;
        if (Math.hypot(p.x - s.spot.x, p.z - s.spot.z) < 1.3 && Math.abs((p.y - 1.7) - s.spot.y) < 1.5) this.take(game);
      }
      // the lock plate: amber waiting for the card, blue with it, red jammed
      if (!tf.unlocked) this.tintLock(game, s.lockLeft > 0 ? 0xff3a2a : s.taken ? 0x3ab0ff : 0xc9a227);
      this.hud(game);
    },
    tintLock(game, color) {
      const tf = game.world.thirdFloor;
      if (!this._plate || this._plateWorld !== game.world) {
        this._plateWorld = game.world;
        this._plate = null;
        tf.barrierMesh.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xc9a227) this._plate = o; });
        if (this._plate) this._plate.material = this._plate.material.clone();
      }
      if (this._plate && this._plateColor !== color) { this._plateColor = color; this._plate.material.color.setHex(color); if (this._plate.material.emissive) this._plate.material.emissive.setHex(color).multiplyScalar(0.5); }
    },

    // ---- the grille ----
    // what the prompt says when the player looks at it
    prompt(game) {
      const s = this.s, key = G.interactKeyLabel();
      if (!this.applies(game) || game.world.thirdFloor.unlocked) return "";
      if (!s.taken) return T("prompt.gate3Card", { d: this.doneCount(game) });
      if (s.lockLeft > 0) return T("prompt.gate3Jammed", { s: Math.ceil(s.lockLeft) });
      return T("prompt.gate3Lock", { key, n: this.WORDS, s: this.WORD_TIME });
    },
    interact(game, found) {
      const s = this.s, tf = game.world.thirdFloor;
      if (tf.unlocked) return;
      // a round already going (between two of its words): not a new one
      if (s.round && (game.challenge || G.Modal.isOpen("lockwait"))) return;
      if (!s.taken) {
        G.Audio.sfx("rattle", { pos: found.mesh.position.clone() });
        G.UI.flashPurchaseBanner(T("banner.gate3Locked"), T("banner.gate3Need", { d: this.doneCount(game) }));
        return;
      }
      if (s.lockLeft > 0) {
        G.Audio.sfx("wrong");
        G.UI.flashPurchaseBanner(T("banner.lockJammed"), T("banner.lockJammedText", { s: Math.ceil(s.lockLeft) }));
        return;
      }
      this.startLock(game);
    },
    // three hard words, none asked in an earlier try this run if it can help it
    pickWords(game) {
      const s = this.s;
      const hard = G.pickHardWords(game.wordPool, 30).filter((p) => !s.used.includes(p[0]));
      let words = hard.slice(0, this.WORDS);
      if (words.length < this.WORDS) words = words.concat(G.shuffle(game.wordPool.filter((p) => !words.includes(p))).slice(0, this.WORDS - words.length));
      words.forEach((p) => s.used.push(p[0]));
      return words;
    },
    startLock(game) {
      const s = this.s;
      s.tries++;
      s.round = { i: 0, words: this.pickWords(game) };
      G.Audio.sfx("switch");
      this.ask(game);
    },
    ask(game) {
      const s = this.s, r = s.round;
      if (!r) return;
      game.startWordChallenge(T("challenge.lock", { i: r.i + 1, n: this.WORDS }), () => {
        r.i++;
        G.Audio.sfx("tick");
        if (r.i >= this.WORDS) { s.round = null; this.open(game); return; }
        // the next word once this question has closed (answerChallenge closes
        // it after this callback returns); a window of its own holds the world
        // still in between, so the mouse is not taken back for a moment
        G.Modal.open("lockwait", { freeze: true });
        Promise.resolve().then(() => {
          if (s.round === r && game.state === "GAMEPLAY") this.ask(game);
          G.Modal.close("lockwait");
        });
      }, () => {
        s.round = null;
        s.lockLeft = this.LOCKOUT;
        G.Audio.sfx("rattle", { pos: game.world.thirdFloor.stairFoot.clone().setY(game.world.thirdFloor.stairFoot.y + 1.3) });
        G.UI.flashPurchaseBanner(T("banner.lockJammed"), T("banner.lockFail", { s: this.LOCKOUT }));
      }, { pair: r.words[r.i], time: this.WORD_TIME, lock: true });
    },
    // the grille lifts; `silent` for a checkpoint laying the run back out
    open(game, silent) {
      const tf = game.world.thirdFloor;
      if (!tf || tf.unlocked) return;
      tf.unlocked = true;
      G.ColGrid.remove(game.world, tf.barrierCollider);
      if (G.Zones) G.Zones.dirty = true;
      if (silent) { tf.barrierMesh.visible = false; return; }
      G.Audio.sfx("gate_open", { pos: tf.stairFoot.clone().setY(tf.stairFoot.y + 1.5) });
      G.Audio.sfx("unlock");
      this.tintLock(game, 0x4aff7a);
      // the grille rolls up into the ceiling, then is gone
      game._swingProps = game._swingProps || [];
      game._swingProps.push({ lift: true, mesh: tf.barrierMesh, y0: tf.barrierMesh.position.y, t: 0 });
      const FX = G.BossFX, gp = tf.barrierMesh.position;
      if (!FX.scene || FX.scene !== game.scene) FX.init(game.scene, tf.stairFoot.y);
      FX.sparks(gp.x, gp.y + 1.3, gp.z, 40, 0x7ac8ff, 5);
      FX.shock(gp.x, gp.z, 5, 0x7ac8ff, 0.8).set({ y: tf.stairFoot.y + 0.06 });
      game.spawnDrop("crate", tf.landing.clone());
      G.UI.flashPurchaseBanner(T("banner.thirdFloor"), T("banner.thirdFloorText"));
    },

    // ---- on screen ----
    hud(game) {
      const el = G.UI.el("hud-floor3");
      if (!el) return;
      const on = this.applies(game) && !game.world.thirdFloor.unlocked && game.mode === "campaign";
      const d = on ? this.doneCount(game) : 0;
      const s = this.s;
      const next = !on ? "" : s.lockLeft > 0 ? T("f3.hud.jammed", { s: Math.ceil(s.lockLeft) }) : s.taken ? T("f3.hud.lock") : s.spawned ? T("f3.hud.card") : "";
      const sig = on + "|" + d + "|" + next;
      if (sig === this._hudSig) return;
      this._hudSig = sig;
      el.classList.toggle("hidden", !on);
      if (on) el.textContent = T("f3.hud", { d, n: 6 }) + (next ? " · " + next : "");
    },
    renderPause(game) {
      const box = G.UI.el("pause-floor3");
      if (!box) return;
      if (!this.applies(game) || game.mode !== "campaign") { box.classList.add("hidden"); return; }
      box.classList.remove("hidden");
      const rows = this.steps(game);
      const open = game.world.thirdFloor.unlocked;
      box.innerHTML = `<h4>${esc(T("f3.title", { d: rows.filter((r) => r.done).length, n: rows.length }))}</h4>` +
        (open ? `<div class="obj-row done"><span>✔ ${esc(T("f3.open"))}</span></div>` :
          rows.map((r, i) => `<div class="obj-row ${r.done ? "done" : "todo"}${i >= 4 && !this.prereqs(game) ? " later" : ""}"><span>${r.done ? "✔" : i + 1 + "."} ${esc(r.label)}</span><span class="obj-val">${esc(r.value)}</span></div>`).join(""));
    },
    // the minimap: the keycard, pinned to the rim when far away
    mapMarks(game, dot, pin, onFloor, r0) {
      const s = this.s;
      if (!this.applies(game) || !s.spawned || s.taken) return;
      const blink = 0.6 + 0.4 * Math.sin(performance.now() / 220);
      dot(pin(s.spot.x, s.spot.z, true), onFloor(s.spot.y) ? `rgba(122,200,255,${blink})` : "rgba(122,200,255,0.5)", r0 * 0.95, "▣");
    },

    // ---- a checkpoint ----
    state(game) {
      const s = this.s || {};
      return { spawned: !!s.spawned, taken: !!s.taken, room: s.room || null, spot: s.spot || null, used: (s.used || []).slice(), unlocked: !!(game.world.thirdFloor && game.world.thirdFloor.unlocked) };
    },
    restore(game, st) {
      if (!this.applies(game) || !st) return;
      const s = this.s;
      s.used = (st.used || []).filter((w) => typeof w === "string");
      s.room = st.room;
      if (st.unlocked) { s.spawned = true; s.taken = true; this.open(game, true); return; }
      if (st.spawned && st.spot) {
        this.spawnKeycard(game, new THREE.Vector3(st.spot.x, st.spot.y, st.spot.z), true);
        if (st.taken) { s.taken = true; this.mesh.visible = false; }
      }
    },

    clearWorld() {
      if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
      this.mesh = null; this.card = null; this.halo = null; this.beam = null;
      this._plate = null; this._plateWorld = null; this._plateColor = null;
    },
  };
})();
