// ===================================================================
// Contextual tutorial (category O)
// -------------------------------------------------------------------
// The player now starts outdoors with no one to tell them what the game
// is, so the first run teaches it -- one short card at a time, at the moment
// it matters, instead of a wall of text before anything happens:
//
//   moving and looking  ->  at spawn
//   the core rule       ->  when the first Thai meaning appears
//   shooting            ->  once they have walked a little
//   doors (E)           ->  when they are looking at a closed door
//   pickups             ->  when a drop lands near them
//   wall guns / box     ->  when they are looking at one
//   the shop            ->  the first time it opens
//   the level goal      ->  after the first correct kill
//
// Each card has desktop and touch wording ("tut.<id>.title/desk/touch" in
// js/strings.js). The whole thing can be skipped from the card itself, and
// replayed from the main menu or the pause screen. The ids are save keys
// (G.save.tutorialSeen), so they must not be renamed.
// ===================================================================
G.Tutorial = {
  current: null,
  queue: [],
  _age: 0,
  _t: 0,

  STEPS: [
    {
      id: "move",
      when: () => true,
      done: (g, s) => s.moved > 4,
    },
    {
      id: "rule",
      when: (g) => !!g.targetPair,
      done: (g) => g.correctCount >= 1,
      hold: 9,
    },
    {
      id: "shoot",
      when: (g, s) => s.moved > 4,
      done: (g, s) => s.shots > 2,
    },
    {
      id: "door",
      when: (g) => g._lookedAtInteractable && g._lookedAtInteractable.kind === "roomdoor",
      done: (g) => (g.world.roomDoors || []).some((d) => d.open),
    },
    {
      id: "pickup",
      when: (g) => g.drops.some((d) => d.mesh.position.distanceTo(g.yawObject.position) < 10),
      done: (g, s) => s.pickups > 0,
    },
    {
      id: "objectives",
      when: (g) => g.mode === "campaign" && g.correctCount >= 1,
      done: () => false,
      hold: 10,
    },
    {
      id: "wallgun",
      when: (g) => g._lookedAtInteractable && g._lookedAtInteractable.kind === "wallweapon",
      done: () => false,
      hold: 7,
    },
    {
      id: "mystery",
      when: (g) => g._lookedAtInteractable && g._lookedAtInteractable.kind === "mysterybox",
      done: () => false,
      hold: 7,
    },
  ],

  // (vocabulary series, round 2, D1) a run answered by spelling has two cards
  // of its own -- how to spell a zombie down, and how to move meanwhile --
  // shown in a study session even after the main tutorial is done (the
  // session's first window explains it too; Replay Tutorial shows them again)
  SPELL_STEPS: [
    {
      id: "spell",
      when: () => !!(G.Spell && G.Spell.focus),
      done: (g) => g.correctCount >= 1,
      hold: 14,
    },
    {
      id: "spellMove",
      when: (g, s) => !!G.save.tutorialSeen && !!G.save.tutorialSeen.spell,
      done: (g, s) => s.moved > 4,
      hold: 10,
    },
  ],

  enabled() { return G.save && !G.save.tutorialDone; },
  seen() { G.save.tutorialSeen = G.save.tutorialSeen || {}; return G.save.tutorialSeen; },

  startRun(game) {
    this.current = null; this.queue = [];
    this.stats = { moved: 0, shots: 0, pickups: 0, lastPos: game.yawObject.position.clone() };
    this.hide();
  },

  onShot() { if (this.stats) this.stats.shots++; },
  onPickup() { if (this.stats) this.stats.pickups++; },

  update(dt, game) {
    const spell = game.mode === "study" && !!(G.Spell && G.Spell.active);
    if (!this.stats || (!spell && (!this.enabled() || game.mode !== "campaign"))) { if (this.current) this.hide(); return; }
    const s = this.stats, p = game.yawObject.position;
    s.moved += Math.hypot(p.x - s.lastPos.x, p.z - s.lastPos.z);
    s.lastPos.copy(p);
    const seen = this.seen();
    // queue anything whose moment has come
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.25;
      for (const st of spell ? this.SPELL_STEPS : this.STEPS) {
        if (seen[st.id] || this.queue.includes(st) || this.current === st) continue;
        if (st.when(game, s)) this.queue.push(st);
      }
    }
    // game time, not wall-clock: a card must not quietly expire while the
    // game is paused
    if (this.current) {
      this._age += dt;
      const age = this._age;
      const st = this.current;
      // a card stays at least 2.5 s so it can be read, then leaves when its
      // job is done -- or after its hold time, so nothing lingers forever
      if ((age > 2.5 && st.done(game, s)) || age > (st.hold || 12)) {
        seen[st.id] = true;
        G.persistSoon();
        this.hide();
      }
    } else if (this.queue.length) {
      this.show(this.queue.shift());
    }
    // everything seen: the tutorial is over
    if (!spell && this.STEPS.every((st) => seen[st.id]) && seen.shop) { G.save.tutorialDone = true; G.persistSoon(); }
  },

  show(st) {
    this.current = st;
    this._age = 0;
    const touch = G.Input.mode === "touch";
    const el = document.getElementById("hud-tip");
    // (a card may have its own controller wording: "tut.<id>.pad")
    const padKey = "tut." + st.id + ".pad";
    const key = G.Input.padActive && G.STRINGS.en[padKey] ? padKey : "tut." + st.id + (touch ? ".touch" : ".desk");
    document.getElementById("hud-tip-title").textContent = "💡 " + G.T("tut." + st.id + ".title");
    document.getElementById("hud-tip-text").textContent = G.T(key);
    el.classList.remove("hidden");
    el.classList.remove("tip-in"); void el.offsetWidth; el.classList.add("tip-in");
  },
  hide() {
    this.current = null;
    const el = document.getElementById("hud-tip");
    if (el) el.classList.add("hidden");
  },

  // Shop screen: a one-off note on the first visit (shown there rather than on
  // the HUD, since the HUD is hidden while shopping).
  shopTip() {
    const box = document.getElementById("shop-tip");
    if (!box) return;
    const seen = this.enabled() ? this.seen() : null;
    if (!seen || seen.shop) { box.classList.add("hidden"); return; }
    box.textContent = "💡 " + G.T("tut.shopTip");
    box.classList.remove("hidden");
    seen.shop = true;
    G.persistSoon();
  },

  skip() {
    G.save.tutorialDone = true;
    this.SPELL_STEPS.forEach((st) => { this.seen()[st.id] = true; });
    G.persist();
    this.queue = [];
    this.hide();
  },
  // Replay: every card becomes unseen again and shows when its moment comes.
  reset() {
    G.save.tutorialDone = false;
    G.save.tutorialSeen = {};
    G.persist();
    this.queue = [];
    this.hide();
  },
};
