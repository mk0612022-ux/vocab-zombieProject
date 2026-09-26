// ============================================================
// LOADOUT: gun slots, the "Inventory Full" window, guns lying on the floor
// ------------------------------------------------------------
// Every way of getting a gun -- a crate (dropped by a zombie, opened in the
// world, bought in the shop, won from the boss), the mystery box, a wall
// mount, a shop unlock, one picked up off the floor -- goes through offer().
//
// The bug this replaces: acquireWeapon() pushed into gunSlots while there
// were fewer than four guns, and otherwise wrote the new gun over the LAST
// entry. So once the slots were full, whatever sat in slot 5 was thrown away
// without a word, every time any new gun turned up.
//
// Now, with a free slot the gun goes straight in. With none, the Inventory
// Full window opens (G.Modal: the game stops, the mouse is freed) and the
// player either picks the slot to give up -- that gun is dropped at their
// feet and can be picked back up for 30 seconds -- or keeps their loadout:
//   wall mount / shop:  asked before paying, so keeping costs nothing
//   mystery box:        the new gun is left on the floor beside the box
//   crate / zombie:     the new gun stays on the floor where it turned up
//   floor pickup:       it simply stays where it is
// The knife is not a slot and is never offered for replacement.
// ============================================================
window.G = window.G || {};

G.Loadout = {
  BASE_SLOTS: 4,
  RETURN_SECONDS: 30,       // how long a gun given up for another stays on the floor
  PICKUP_RANGE: 1.7,
  pending: null,            // the offer the Inventory Full window is waiting on

  maxSlots(game) { return this.BASE_SLOTS + (G.Perks.val("extra_slot", G.Perks.level("extra_slot", game.player)) || 0); },
  isFull(game) { return game.player.gunSlots.length >= this.maxSlots(game); },

  freshAmmo(id) { const d = G.WEAPON_DEFS[id]; return { mag: d.magSize, reserve: d.magSize * 4 }; },
  // what a gun takes with it onto the floor, so picking it back up restores it
  carryOf(game, id) {
    const a = game.player.ammo[id], l = game.player.weaponLevels[id];
    return { ammo: a ? { mag: a.mag, reserve: a.reserve } : this.freshAmmo(id), levels: l ? Object.assign({}, l) : { dmg: 1, rate: 1, mag: 1 } };
  },

  // A gun into a free slot (caller has checked there is one).
  add(game, id, carry) {
    const p = game.player;
    p.gunSlots.push(id);
    this._install(game, id, carry);
    p.currentSlot = p.gunSlots.length;
    return p.gunSlots.length - 1;
  },
  // A gun into slot `idx`; the one there goes on the floor in front of the player.
  replace(game, idx, id, carry) {
    const p = game.player;
    const old = p.gunSlots[idx];
    if (old) {
      const oldCarry = this.carryOf(game, old);
      if (p.currentSlot === idx + 1) game.cancelReload();
      this.spawnFloorGun(game, old, this.dropSpot(game), { carry: oldCarry, expires: this.RETURN_SECONDS });
      delete p.ammo[old];
      delete p.weaponLevels[old];
    }
    p.gunSlots[idx] = id;
    this._install(game, id, carry);
    p.currentSlot = idx + 1;
  },
  _install(game, id, carry) {
    const p = game.player;
    p.ammo[id] = carry ? Object.assign({}, carry.ammo) : this.freshAmmo(id);
    p.weaponLevels[id] = carry ? Object.assign({}, carry.levels) : { dmg: 1, rate: 1, mag: 1 };
    if (!G.save.unlockedWeapons.includes(id)) { G.save.unlockedWeapons.push(id); G.persist(); }
  },

  // opts: { source: crate|drop|mystery|wall|shop|floor, carry, dropPos,
  //         floorGun (the one being picked up), onTake(slotIdx), onKeep(), onDone() }
  // Returns true when it was settled on the spot, false when the window opened.
  offer(game, id, opts) {
    opts = opts || {};
    const p = game.player;
    const done = () => { opts.onDone && opts.onDone(); };
    if (p.gunSlots.includes(id)) {
      // a second copy of a gun already carried is its ammunition
      const extra = opts.carry ? opts.carry.ammo.mag + opts.carry.ammo.reserve : G.WEAPON_DEFS[id].magSize * 3;
      p.ammo[id].reserve += extra;
      if (opts.floorGun) this.removeFloorGun(game, opts.floorGun);
      opts.onTake && opts.onTake(p.gunSlots.indexOf(id));
      done();
      return true;
    }
    if (!this.isFull(game)) {
      const idx = this.add(game, id, opts.carry);
      if (opts.floorGun) this.removeFloorGun(game, opts.floorGun);
      opts.onTake && opts.onTake(idx);
      done();
      return true;
    }
    this.pending = { id, opts };
    G.Modal.open("inventory", { pause: true, keys: (e) => this.handleKey(e) });
    G.UI.setHudVisible(false);
    G.UI.renderInventoryFull(id, opts);
    G.UI.showScreen("screen-inventory");
    return false;
  },

  handleKey(e) {
    if (!this.pending) return false;
    const kb = G.save.settings.keybinds;
    const n = G.Game.player.gunSlots.length;
    for (let i = 0; i < n; i++) {
      if (e.code === kb["slot" + (i + 2)]) { this.choose(i); return true; }
    }
    if (e.code === "Escape" || e.code === kb.pause || e.code === "Backspace") { this.keep(); return true; }
    return false;
  },

  choose(idx) {
    const P = this.pending;
    if (!P) return;
    const game = G.Game;
    if (idx < 0 || idx >= game.player.gunSlots.length) return;
    this.pending = null;
    this.replace(game, idx, P.id, P.opts.carry);
    if (P.opts.floorGun) this.removeFloorGun(game, P.opts.floorGun);
    G.Audio.sfx("pickup");
    P.opts.onTake && P.opts.onTake(idx);
    this._close(P);
  },
  keep() {
    const P = this.pending;
    if (!P) return;
    const game = G.Game;
    this.pending = null;
    const src = P.opts.source;
    // the new gun is not lost: it waits on the floor (no timer) -- except a
    // wall or shop gun, which was never paid for, and a floor gun, which is
    // still lying where it was
    if (src === "mystery" || src === "crate" || src === "drop") {
      this.spawnFloorGun(game, P.id, P.opts.dropPos || this.dropSpot(game), { carry: P.opts.carry, expires: null });
    }
    P.opts.onKeep && P.opts.onKeep();
    this._close(P);
  },
  _close(P) {
    const game = G.Game;
    if (game.state === "SHOP") { G.UI.renderShop(); G.UI.showScreen("screen-shop"); }
    else G.UI.showScreen(null);
    G.UI.setHudVisible(game.state === "GAMEPLAY");
    const done = P.opts.onDone;
    // the callback first (it may open the shop), the window last, so the
    // cursor is only handed back to the game when nothing else wants it
    done && done();
    G.Modal.close("inventory");
  },

  // ---------------- guns on the floor ----------------
  // A spot on the floor a little in front of the player, or at their feet if
  // that would be inside a wall.
  dropSpot(game) {
    const p = game.yawObject.position, yaw = game.yawObject.rotation.y;
    const tryAt = (d) => new THREE.Vector3(p.x - Math.sin(yaw) * d, p.y - 1.7, p.z - Math.cos(yaw) * d);
    for (const d of [1.2, 0.7, 0.2]) {
      const v = tryAt(d);
      const box = new THREE.Box3(new THREE.Vector3(v.x - 0.35, v.y + 0.1, v.z - 0.35), new THREE.Vector3(v.x + 0.35, v.y + 1, v.z + 0.35));
      if (!game.world.colliders.some((c) => c.intersectsBox(box))) return v;
    }
    return tryAt(0);
  },
  // beside the mystery box, on the side the player is standing
  besideBox(game) {
    const mb = game.world && game.world.mysteryBox;
    if (!mb) return this.dropSpot(game);
    const p = game.yawObject.position;
    const dx = p.x - mb.x, dz = p.z - mb.z, len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(mb.x + (dx / len) * 1.3, p.y - 1.7, mb.z + (dz / len) * 1.3);
  },

  spawnFloorGun(game, id, pos, opts) {
    opts = opts || {};
    const def = G.WEAPON_DEFS[id];
    const root = new THREE.Group();
    const gun = G.buildWeaponMesh(def);
    gun.rotation.z = Math.PI / 2;                    // lying on its side
    gun.scale.setScalar(1.35);
    root.add(gun);
    // a ring of the gun's rarity colour under it, so it reads from across a room
    const col = G.RARITY[def.rarity].color;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 24),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.22;
    root.add(ring);
    const baseY = G.getFloorHeightAt(game.world, pos.x, pos.z, pos.y);
    root.position.set(pos.x, baseY + 0.3, pos.z);
    game.scene.add(root);
    const fg = { id, mesh: root, ring, carry: opts.carry || null, expires: opts.expires || null, t: 0, baseY };
    game.floorGuns.push(fg);
    return fg;
  },
  removeFloorGun(game, fg) {
    const i = game.floorGuns.indexOf(fg);
    if (i < 0) return;
    game.floorGuns.splice(i, 1);
    game.scene.remove(fg.mesh);
    G.disposeObject3D(fg.mesh);
  },
  update(game, dt) {
    for (const fg of game.floorGuns.slice()) {
      fg.t += dt;
      fg.mesh.rotation.y += dt * 1.1;
      fg.mesh.position.y = fg.baseY + 0.3 + Math.sin(fg.t * 2.4) * 0.05;
      fg.ring.material.opacity = 0.55 + Math.sin(fg.t * 4) * 0.2;
      if (fg.expires) {
        const left = fg.expires - fg.t;
        // the last five seconds it blinks, faster as it goes
        fg.mesh.visible = left > 5 || Math.sin(fg.t * (left > 2 ? 10 : 22)) > -0.2;
        if (left <= 0) this.removeFloorGun(game, fg);
      }
    }
  },
  // the closest floor gun within reach, on the player's floor
  nearest(game) {
    const p = game.yawObject.position;
    let best = null, bestD = this.PICKUP_RANGE;
    for (const fg of game.floorGuns) {
      if (Math.abs(fg.baseY - (p.y - 1.7)) > 1.5) continue;
      const d = Math.hypot(fg.mesh.position.x - p.x, fg.mesh.position.z - p.z);
      if (d < bestD) { best = fg; bestD = d; }
    }
    return best;
  },
  pickUp(game, fg) {
    this.offer(game, fg.id, { source: "floor", carry: fg.carry, floorGun: fg });
  },

  // One weapon step through the knife and every gun held (mouse wheel, LB/RB).
  cycle(game, dir) {
    const n = game.player.gunSlots.length + 1;
    game.switchSlot(((game.player.currentSlot + dir) % n + n) % n);
  },
};
