// ===================================================================
// The checkpoint (round 3, J)
// -------------------------------------------------------------------
// One place in a campaign run is kept: after wave 10's boss -- its fight,
// its word, the honeycomb and the shop -- as the shop closes and before
// wave 11 begins. "Checkpoint Saved - Wave 11" shows with a disk icon and a
// short sound.
//
// What is kept (J2): the level and the next wave; score and money; every
// gun held with its ammunition and upgrades, and how many slots there are
// (the perks decide that); the perks and their levels; the abilities held
// (ready again, their cooldowns cleared) and what is left in the ability
// bag; the health the shop left; the floors opened, the Floor 3 Keycard and
// how far the third floor's steps have got; the level objectives so far;
// the right-word kills and the notes read this run; the bosses met (so waves
// 15 and 20 bring two the run has not seen); the perk bag and the shop's
// price counters. Doors and the rest of the map start fresh, except the
// floors that were open.
//
// Dying after wave 10: Game Over offers "Continue from Wave 11" (as often
// as wanted, each time from the same saved state) or "Restart from Wave 1".
// Leaving the run: the pause menu says progress will resume from wave 11,
// and the level's card in the lobby has a Continue button. Starting the
// level again from wave 1 asks first, since it deletes the checkpoint; so
// does a win (the level is done). One checkpoint per level (school,
// hospital, bunker), in G.save.checkpoints -- so it survives the browser
// being closed and travels in Export / Import. A leaderboard entry from a
// run that used Continue carries a mark.
// ===================================================================
(function () {
  const T = (k, v) => G.T(k, v);
  const copy = (o) => JSON.parse(JSON.stringify(o));

  G.Checkpoint = {
    AFTER_WAVE: G.CONFIG.checkpoint.afterWave,           // (js/config.js)
    key(levelId) { return "level" + levelId; },
    get(levelId) { const c = G.save.checkpoints; return (c && c[this.key(levelId)]) || null; },
    has(levelId) { return !!this.get(levelId); },
    remove(levelId) {
      if (!G.save.checkpoints || !G.save.checkpoints[this.key(levelId)]) return;
      delete G.save.checkpoints[this.key(levelId)];
      G.persist();
    },

    // ---- keeping it (from G.Game.leaveShop after wave 10) ----
    snapshot(game) {
      const pl = game.player, w = game.world, O = G.Objectives.state, sf = w.secondFloor;
      return {
        v: 1, levelId: game.level.id, wave: game.wave + 1, savedAt: Date.now(), continues: 0,
        score: pl.score, money: pl.money, hp: pl.hp, maxHp: pl.maxHp,
        player: copy({
          gunSlots: pl.gunSlots, currentSlot: pl.currentSlot, ammo: pl.ammo, weaponLevels: pl.weaponLevels,
          perks: pl.perks, moveSpeedMult: pl.moveSpeedMult, armorPct: pl.armorPct, comboShield: pl.comboShield,
        }),
        abilities: G.Abilities.state(),
        perkBag: copy({ bag: G.PerkBag.bag, last: G.PerkBag.last, cycles: G.PerkBag.cycles }),
        shopPrices: copy(G.Shop.prices || {}),
        floors: { second: !!(sf && sf.unlocked), third: G.Floor3 && w.thirdFloor ? G.Floor3.state(game) : null },
        objectives: O ? {
          visited: Array.from(O.visited), bossesDown: O.bossesDown, latched: !!O.latched, completeAnnounced: !!O.completeAnnounced,
          keysTaken: (w.keys || []).map((k, i) => (k.taken ? i : -1)).filter((i) => i >= 0),
        } : null,
        counts: { correct: game.correctCount, wrong: game.wrongCount, correctKills: game.correctKills, kills: game.totalZombiesKilled },
        wrongWords: copy(game.wrongWordsThisRun || {}),
        notesRead: Array.from(game.notesReadRun || []),
        notesRevealed: !!game._notesRevealed,
        rewardsUsed: Object.keys(w.rewards || {}).filter((k) => w.rewards[k] && w.rewards[k].used),
        bosses: copy(G.Bosses.run),
      };
    },
    save(game) {
      if (game.mode !== "campaign" || !game.level) return null;
      const cp = this.snapshot(game);
      G.save.checkpoints = G.save.checkpoints || {};
      G.save.checkpoints[this.key(game.level.id)] = cp;
      G.persist();
      this.toast(cp.wave);
      return cp;
    },
    toast(wave) {
      const el = document.getElementById("hud-checkpoint");
      if (el) {
        el.querySelector(".cp-text").textContent = T("cp.saved", { n: wave });
        el.classList.remove("hidden", "showing"); void el.offsetWidth;
        el.classList.add("showing");
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => el.classList.add("hidden"), 3200);
      }
      if (G.Audio.checkpoint) G.Audio.checkpoint();
    },

    // ---- laying a run back out (from G.Game.beginRun, before wave 11) ----
    apply(game, cp) {
      const pl = game.player, w = game.world, P = cp.player || {};
      pl.score = cp.score || 0; pl.money = cp.money || 0;
      pl.maxHp = cp.maxHp || pl.maxHp;
      pl.hp = Math.max(1, Math.min(pl.maxHp, cp.hp || pl.maxHp));
      const guns = (P.gunSlots || []).filter((id) => G.WEAPON_DEFS[id]);
      if (guns.length) {
        pl.gunSlots = guns;
        pl.ammo = {}; pl.weaponLevels = {};
        guns.forEach((id) => {
          const a = (P.ammo || {})[id] || {}, l = (P.weaponLevels || {})[id] || {};
          pl.ammo[id] = { mag: Math.max(0, a.mag | 0), reserve: Math.max(0, a.reserve | 0) };
          pl.weaponLevels[id] = { dmg: l.dmg || 1, rate: l.rate || 1, mag: l.mag || 1 };
        });
        pl.currentSlot = Math.max(0, Math.min(guns.length, P.currentSlot | 0));
      }
      pl.perks = {};
      Object.keys(P.perks || {}).forEach((id) => { if (G.PERK_BY_ID[id]) pl.perks[id] = Math.min(G.PERK_BY_ID[id].max, Math.max(0, P.perks[id] | 0)); });
      pl.moveSpeedMult = P.moveSpeedMult || 1;
      pl.armorPct = P.armorPct || 0;
      pl.comboShield = P.comboShield ? { charged: true, streak: 0 } : null;
      pl.secondLifeUsed = false;
      G.Abilities.restore(cp.abilities);
      if (cp.perkBag) { G.PerkBag.bag = (cp.perkBag.bag || []).slice(); G.PerkBag.last = (cp.perkBag.last || []).slice(); G.PerkBag.cycles = cp.perkBag.cycles || 0; }
      G.Shop.prices = Object.assign({}, cp.shopPrices || {});
      // the floors that were open
      const sf = w.secondFloor;
      if (sf && cp.floors && cp.floors.second && !sf.unlocked) {
        sf.unlocked = true;
        if (sf.barrierMesh) sf.barrierMesh.visible = false;
        G.ColGrid.remove(w, sf.barrierCollider);
      }
      if (G.Floor3 && w.thirdFloor && cp.floors) G.Floor3.restore(game, cp.floors.third);
      // the objectives so far
      const O = G.Objectives.state, o = cp.objectives;
      if (O && o) {
        O.visited = new Set(o.visited || []);
        (o.keysTaken || []).forEach((i) => { const k = (w.keys || [])[i]; if (k && !k.taken) { k.taken = true; k.mesh.visible = false; } });
        O.keysFound = (w.keys || []).filter((k) => k.taken).length;
        O.bossesDown = o.bossesDown || 0;
        O.latched = !!o.latched; O.completeAnnounced = !!o.completeAnnounced;
      }
      const c = cp.counts || {};
      game.correctCount = c.correct || 0; game.wrongCount = c.wrong || 0;
      game.correctKills = c.correctKills || 0; game.totalZombiesKilled = c.kills || 0;
      game.wrongWordsThisRun = Object.assign({}, cp.wrongWords || {});
      game.notesReadRun = new Set(cp.notesRead || []);
      game._notesRevealed = !!cp.notesRevealed;
      (cp.rewardsUsed || []).forEach((k) => { if (w.rewards && w.rewards[k]) w.rewards[k].used = true; });
      // the bosses met: waves 15 and 20 bring two this run has not seen
      if (cp.bosses) G.Bosses.run = copy(cp.bosses);
      game._continues = cp.continues || 0;
      game.wave = (cp.wave || this.AFTER_WAVE + 1) - 1;      // startWave() makes it the saved one
      game._checkpointDue = false;
      G.UI._tweenState = null;
    },

    // ---- the screens ----
    // Game Over: Continue from Wave 11 / Restart from Wave 1 (or just Retry)
    onGameOver(game) {
      const cont = document.getElementById("btn-gameover-continue"), retry = document.getElementById("btn-gameover-retry");
      if (!cont || !retry) return;
      const cp = game.mode === "campaign" && game.level ? this.get(game.level.id) : null;
      cont.classList.toggle("hidden", !cp);
      if (cp) cont.textContent = T("cp.continueFrom", { n: cp.wave });
      retry.textContent = cp ? T("cp.restartFrom1") : T("result.retry");
      retry.classList.toggle("btn-primary", !cp);
      const note = document.getElementById("gameover-cp");
      if (note) { note.classList.toggle("hidden", !cp); if (cp) note.textContent = T("cp.gameOverNote", { n: cp.wave }); }
    },
    renderPause(game) {
      const box = document.getElementById("pause-checkpoint");
      if (!box) return;
      const cp = game.mode === "campaign" && game.level ? this.get(game.level.id) : null;
      const past = cp && game.wave >= cp.wave;
      box.classList.toggle("hidden", game.mode !== "campaign");
      box.classList.toggle("saved", !!past);
      box.textContent = past ? "💾 " + T("cp.pauseResume", { n: cp.wave }) : T("cp.pauseNone", { n: this.AFTER_WAVE });
    },
    // the lobby (or the level list): a level with a checkpoint asks how to go
    // on. `go(fn)` plays the lobby's own launch animation around it.
    chooseRun(levelId, go) {
      const cp = this.get(levelId);
      go = go || ((fn) => fn());
      if (!cp) { go(() => G.Game.startLevel(levelId)); return; }
      const when = new Date(cp.savedAt || Date.now()).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      G.Dialog.open({
        icon: "💾", title: G.getLevel(levelId).name,
        text: T("cp.chooseText", { n: cp.wave, when, score: (cp.score || 0).toLocaleString("en-GB") }),
        buttons: [
          { label: T("cp.continueWave", { n: cp.wave }), primary: true, action: () => go(() => G.Game.continueFromCheckpoint(levelId)) },
          { label: T("cp.newRun"), action: () => this.confirmDelete(levelId, () => go(() => G.Game.startLevel(levelId))) },
          { label: T("dialog.cancel"), cancel: true },
        ],
      });
    },
    // a new run from wave 1 deletes the checkpoint: say so first
    confirmDelete(levelId, then) {
      const cp = this.get(levelId);
      if (!cp) { then(); return; }
      G.Dialog.confirm({ icon: "⚠️", danger: true, title: T("cp.deleteTitle"), text: T("cp.deleteText", { n: cp.wave }), yes: T("cp.deleteYes"), no: T("dialog.cancel") }, () => {
        this.remove(levelId);
        then();
      });
    },

    // ---- the save file ----
    // G.normalizeSave: only well-formed checkpoints of the three levels stay
    normalize(raw) {
      const out = {};
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
      [1, 2, 3].forEach((id) => {
        const cp = raw[this.key(id)];
        if (!cp || typeof cp !== "object" || Array.isArray(cp)) return;
        if (cp.levelId !== id || !Number.isFinite(cp.wave) || cp.wave < 2 || cp.wave > 999) return;
        if (!cp.player || typeof cp.player !== "object" || !Array.isArray(cp.player.gunSlots)) return;
        if (!Number.isFinite(cp.hp) || !Number.isFinite(cp.money) || !Number.isFinite(cp.score)) return;
        out[this.key(id)] = cp;
      });
      return out;
    },
  };

  // the checkpoint's sound: a short rising chime and a click
  Object.assign(G.Audio, {
    checkpoint() {
      if (!this.ctx) return;
      [659, 880, 1318].forEach((f, i) => this.tone({ type: "triangle", freq: f, dur: 0.3, gain: 0.12, at: i * 0.09, prio: true }));
      this.tone({ type: "square", freq: 2200, dur: 0.02, gain: 0.05, at: 0.32, prio: true, filter: { type: "bandpass", freq: 2500, q: 3 } });
    },
  });

  // Game Over's Continue button (the rest of that screen is G.UI's)
  window.addEventListener("DOMContentLoaded", () => {
    const b = document.getElementById("btn-gameover-continue");
    if (b) b.onclick = () => { if (G.Game.level) G.Game.continueFromCheckpoint(G.Game.level.id); };
  });
})();
