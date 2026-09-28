// ===================================================================
// Level objectives (category I)
// -------------------------------------------------------------------
// Surviving the waves is no longer enough to clear a level. Each level has a
// set of goals that together touch every system the level has: the vocabulary
// (accuracy + a volume of correct answers), the map (explore the rooms, which
// means unlocking the upper floor), the puzzles (the three keys sit behind the
// secret button, the word-locked door and the upper floor), and the bosses.
//
// If the final wave falls before every goal is done, the level does not end:
// the waves keep coming ("overtime") until the checklist is complete. Nothing
// here can become permanently impossible -- accuracy only rises with more
// correct answers, and the keys and rooms stay where they are.
// ===================================================================
// Accuracy bars were 75/80/85%. The category P playtest showed why that was
// out of reach: accuracy counts EVERY wrong kill -- a panic shot at a zombie
// biting you, a stray round, a launcher's splash -- so players who knew about
// three words in four finished at 55-73%, then sat in overtime until they died.
// The bar is now 65/70/75%, and it only has to be reached once (see `latched`).
// Round 3: the school is three storeys and a campus now -- forty rooms and
// eight places outside (the field, the garden, the three salas...). Exploring
// asks for 24 of those (rooms and places both count), and the level asks for
// four of the story notes to be read, which is also what the third floor's
// grille wants (with 40 right answers), so a player finishing the level has
// the third floor within reach without it being required.
// Round 2: twenty waves, so the word goal is sized for them (the school
// sends about 340 zombies in twenty waves, the hospital 370, the bunker
// 400: the goal is under half of those) and the boss goal is every one of
// the level's four bosses.
G.LEVEL_OBJECTIVES = {
  1: { accuracy: 0.65, minCorrect: 150, rooms: 24, keys: 3, notes: 4, bosses: 4 },
  2: { accuracy: 0.70, minCorrect: 165, rooms: 19, keys: 3, bosses: 4 },
  3: { accuracy: 0.75, minCorrect: 180, rooms: 20, keys: 3, bosses: 4 },
};

G.Objectives = {
  state: null,

  reset(levelId, world) {
    const cfg = G.LEVEL_OBJECTIVES[levelId];
    if (!cfg) { this.state = null; return; }
    const roomTotal = ((world.roomNames && world.roomNames.size) || 0) + (world.landmarks || []).length;
    this.state = {
      levelId, cfg,
      roomTotal,
      roomsNeeded: Math.min(cfg.rooms, roomTotal),
      visited: new Set(),
      keysFound: 0,
      keysTotal: (world.keys || []).length,
      bossesDown: 0,
      completeAnnounced: false,
      _t: 0,
    };
  },

  // Called every frame; the room lookup is throttled because it scans every
  // region and nothing here needs better than a quarter-second resolution.
  update(dt, game) {
    const s = this.state;
    if (!s) return;
    s._t -= dt;
    if (s._t <= 0) {
      s._t = 0.25;
      const p = game.yawObject.position;
      const name = G.getRegionAt(game.world, p.x, p.z, p.y - 1.7);
      const visit = (key) => {
        if (s.visited.has(key)) return;
        s.visited.add(key);
        if (s.visited.size === s.roomsNeeded) G.UI.flashPurchaseBanner(G.T("banner.explored"), G.T("banner.exploredText", { n: s.visited.size }));
      };
      if (name && game.world.roomNames && game.world.roomNames.has(name)) visit(name);
      // the places outdoors: close enough to one counts as having been there
      if (/^YARD/.test(name || "")) (game.world.landmarks || []).forEach((l) => { if (Math.hypot(p.x - l.x, p.z - l.z) < l.r) visit(l.key); });
    }
    // keys: walk over them
    (game.world.keys || []).forEach((k) => {
      if (k.taken) return;
      k.mesh.rotation.y += dt * 2.2;
      k.mesh.position.y = k.baseY + 1.1 + Math.sin(performance.now() * 0.003 + k.phase) * 0.12;
      const p = game.yawObject.position;
      if (Math.hypot(p.x - k.mesh.position.x, p.z - k.mesh.position.z) < 1.3 && Math.abs((p.y - 1.7) - k.baseY) < 1.5) {
        k.taken = true;
        k.mesh.visible = false;
        s.keysFound++;
        G.UI.flashPurchaseBanner(G.T("banner.key"), G.T("banner.keyText", { k: s.keysFound, n: s.keysTotal }));
        if (G.Audio) G.Audio.sfx("pickup_key");
      }
    });
    if (!s.completeAnnounced && this.allDone(game)) {
      s.completeAnnounced = true;
      // Latched: once the whole checklist has been met it stays met. Accuracy
      // is the one goal that can slip back, and the playtest bot showed the
      // result -- "objectives complete!" at 75%, one stray kill later 74%, and
      // the level refused to end and ran on into overtime.
      s.latched = true;
      // In overtime the waves were survived long ago: the level ends the
      // moment the list is complete, instead of making the player clear one
      // more (the playtest bot finished everything and died doing that).
      if (game._finalWaveCleared) { game._winNow = true; return; }
      G.UI.flashPurchaseBanner(G.T("banner.allObjectives"), G.T(game.wave >= game.level.waves ? "banner.clearThisWave" : "banner.surviveAll"));
    }
  },

  onBossDefeated() { if (this.state) this.state.bossesDown++; },

  accuracy(game) {
    const total = game.correctCount + game.wrongCount;
    return total ? game.correctCount / total : 0;
  },

  // One row per goal: label, progress text, done flag. Used by both the HUD
  // chip and the pause-menu checklist, so the two can never disagree.
  list(game) {
    const s = this.state;
    if (!s) return [];
    const c = s.cfg;
    const acc = this.accuracy(game);
    const L = !!s.latched;
    const T = G.T;
    const rows = [
      { label: T("obj.survive", { n: game.level.waves }), value: `${Math.min(game.wave, game.level.waves)} / ${game.level.waves}`, done: game.wave > game.level.waves || (game.wave === game.level.waves && game._finalWaveCleared) },
      { label: T("obj.correct", { n: c.minCorrect }), value: `${game.correctCount} / ${c.minCorrect}`, done: L || game.correctCount >= c.minCorrect },
      { label: T("obj.accuracy", { p: Math.round(c.accuracy * 100) }), value: `${Math.round(acc * 100)}%`, done: L || (acc >= c.accuracy && (game.correctCount + game.wrongCount) > 0) },
      { label: T("obj.explore", { n: s.roomsNeeded }), value: `${s.visited.size} / ${s.roomsNeeded}`, done: s.visited.size >= s.roomsNeeded },
      { label: T("obj.keys", { n: s.keysTotal }), value: `${s.keysFound} / ${s.keysTotal}`, done: s.keysFound >= s.keysTotal },
    ];
    if (c.notes) {
      const read = game.notesReadRun ? game.notesReadRun.size : 0;
      rows.push({ label: T("obj.notes", { n: c.notes }), value: `${Math.min(read, c.notes)} / ${c.notes}`, done: L || read >= c.notes });
    }
    if (c.bosses) rows.push({ label: T("obj.boss", { n: c.bosses }), value: `${Math.min(s.bossesDown, c.bosses)} / ${c.bosses}`, done: s.bossesDown >= c.bosses });
    return rows;
  },

  // Everything except the waves themselves -- those are checked by the wave flow.
  allDone(game) {
    return this.list(game).slice(1).every((r) => r.done);
  },
  doneCount(game) { return this.list(game).filter((r) => r.done).length; },
};
