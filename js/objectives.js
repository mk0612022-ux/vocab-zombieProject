// ===================================================================
// Level objectives (category I)
// -------------------------------------------------------------------
// Surviving the waves is no longer enough to clear a level. Each level has a
// set of goals that together touch every system the level has: the vocabulary
// (accuracy + a volume of correct answers), the map (explore the rooms, which
// means unlocking the upper floor), the puzzles (the three keys sit behind the
// secret button, the word-locked door and the upper floor), and the boss.
//
// If the final wave falls before every goal is done, the level does not end:
// the waves keep coming ("overtime") until the checklist is complete. Nothing
// here can become permanently impossible -- accuracy only rises with more
// correct answers, and the keys and rooms stay where they are.
// ===================================================================
G.LEVEL_OBJECTIVES = {
  1: { accuracy: 0.75, minCorrect: 40, rooms: 18, keys: 3, boss: true },
  2: { accuracy: 0.80, minCorrect: 60, rooms: 19, keys: 3, boss: true },
  3: { accuracy: 0.85, minCorrect: 80, rooms: 20, keys: 3, boss: true },
};

G.Objectives = {
  state: null,

  reset(levelId, world) {
    const cfg = G.LEVEL_OBJECTIVES[levelId];
    if (!cfg) { this.state = null; return; }
    const roomTotal = (world.roomNames && world.roomNames.size) || 0;
    this.state = {
      levelId, cfg,
      roomTotal,
      roomsNeeded: Math.min(cfg.rooms, roomTotal),
      visited: new Set(),
      keysFound: 0,
      keysTotal: (world.keys || []).length,
      bossDown: false,
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
      if (name && game.world.roomNames && game.world.roomNames.has(name) && !s.visited.has(name)) {
        s.visited.add(name);
        if (s.visited.size === s.roomsNeeded) G.UI.flashPurchaseBanner("สำรวจครบแล้ว!", `เข้าไปแล้ว ${s.visited.size} ห้อง`);
      }
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
        G.UI.flashPurchaseBanner("พบกุญแจ!", `${s.keysFound} / ${s.keysTotal} ดอก`);
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
      G.UI.flashPurchaseBanner("ภารกิจครบแล้ว!", game.wave >= game.level.waves ? "เคลียร์เวฟนี้เพื่อผ่านด่าน" : "เอาตัวรอดให้ครบทุกเวฟเพื่อผ่านด่าน");
    }
  },

  onBossDefeated() { if (this.state) this.state.bossDown = true; },

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
    const rows = [
      { label: `เอาตัวรอดให้ครบ ${game.level.waves} เวฟ`, value: `${Math.min(game.wave, game.level.waves)} / ${game.level.waves}`, done: game.wave > game.level.waves || (game.wave === game.level.waves && game._finalWaveCleared) },
      { label: `ตอบคำศัพท์ถูกอย่างน้อย ${c.minCorrect} คำ`, value: `${game.correctCount} / ${c.minCorrect}`, done: L || game.correctCount >= c.minCorrect },
      { label: `ความแม่นยำคำศัพท์ ${Math.round(c.accuracy * 100)}% ขึ้นไป`, value: `${Math.round(acc * 100)}%`, done: L || (acc >= c.accuracy && (game.correctCount + game.wrongCount) > 0) },
      { label: `สำรวจห้องให้ได้ ${s.roomsNeeded} ห้อง`, value: `${s.visited.size} / ${s.roomsNeeded}`, done: s.visited.size >= s.roomsNeeded },
      { label: `ตามหากุญแจที่ซ่อนอยู่ ${s.keysTotal} ดอก`, value: `${s.keysFound} / ${s.keysTotal}`, done: s.keysFound >= s.keysTotal },
    ];
    if (c.boss) rows.push({ label: "ล้มบอสประจำด่าน", value: s.bossDown ? "สำเร็จ" : "ยังไม่ล้ม", done: s.bossDown });
    return rows;
  },

  // Everything except the waves themselves -- those are checked by the wave flow.
  allDone(game) {
    return this.list(game).slice(1).every((r) => r.done);
  },
  doneCount(game) { return this.list(game).filter((r) => r.done).length; },
};
