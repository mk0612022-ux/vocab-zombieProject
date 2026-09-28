// ===================================================================
// Story notes (round 3, H)
// -------------------------------------------------------------------
// Each level has twenty notes (G.NOTES, js/data/notes_*.js). Every run
// leaves ten of them lying about -- at least one of each of the A, B and C
// levels -- on ten of the level's 25-30 prepared spots (on desks and tables
// all through the building, on every floor, on the sala benches, the stand,
// by the fountain...). A note glows faintly and says "Press E to read".
// Reading one opens it in a window (G.Modal, pause: everything stops, the
// zombies and the clocks too) until the player keeps it. A kept note goes
// into the Notes Journal for good (G.save.notes), where it can be read
// again from the main menu or the pause menu; all twenty of a level earns
// that level's achievement.
// ===================================================================
G.Notes = {
  PER_RUN: 10,
  SPOTS: 28,                       // the prepared spots a level offers (25-30)
  LEVEL_OF_THEME: { school: "level1", hospital: "level2", bunker: "level3" },
  placed: [],

  all(levelKey) { return (G.NOTES && G.NOTES[levelKey]) || []; },
  kept(levelKey) { return (G.save.notes && G.save.notes[levelKey]) || []; },
  byId(levelKey, id) { return this.all(levelKey).find((n) => n.id === id) || null; },
  band(cefr) { return cefr[0]; },  // "A", "B" or "C"

  // ---- the spots: every kit and the campus offer some; a level keeps 28,
  // spread over the floors and the grounds, one per kind of place ----------
  curate(all) {
    const outdoor = all.filter((s) => s.outdoor);
    const indoor = all.filter((s) => !s.outdoor);
    const seen = new Set(), firsts = [], rest = [];
    indoor.forEach((s) => { const k = s.where + "|" + s.floor; (seen.has(k) ? rest : firsts).push(s); seen.add(k); });
    const out = outdoor.slice(0, 11);
    const want = this.SPOTS - out.length;
    // round robin over the floors so none is left out
    const byFloor = {};
    firsts.concat(rest).forEach((s) => (byFloor[s.floor || 1] = byFloor[s.floor || 1] || []).push(s));
    const floors = Object.keys(byFloor).sort();
    const picked = [];
    for (let i = 0; picked.length < want && floors.some((f) => byFloor[f].length); i++) {
      const f = floors[i % floors.length];
      if (byFloor[f].length) picked.push(byFloor[f].shift());
    }
    return out.concat(picked);
  },

  // ---- a run's ten ---------------------------------------------------------
  // (`read`: a run continued from its checkpoint has already read these, and
  // lays out only the rest of its ten)
  choose(levelKey, read) {
    read = read || [];
    const notes = G.shuffle(this.all(levelKey).filter((n) => !read.includes(n.id)));
    const out = [], want = Math.max(0, this.PER_RUN - read.length);
    ["A", "B", "C"].forEach((b) => { const n = notes.find((x) => this.band(x.cefr) === b && !out.includes(x)); if (n && out.length < want) out.push(n); });
    notes.forEach((n) => { if (out.length < want && !out.includes(n)) out.push(n); });
    return out;
  },

  place(game, read) {
    this.reset();
    const world = game.world;
    const key = this.LEVEL_OF_THEME[game.level.theme];
    this.levelKey = key;
    const notes = this.all(key);
    if (!notes.length || !world.noteSpots || !world.noteSpots.length) return;
    const spots = this.curate(world.noteSpots);
    world.noteSpotsCurated = spots;
    const run = this.choose(key, read);
    // the third floor holds two at most: most of the run has to be findable
    // before its grille opens (reading four is one of the things that opens it)
    // ...and the grounds half of them at most, so the building has its share
    const order = G.shuffle(spots.slice());
    const used = [];
    let top = 0, out = 0;
    run.forEach((note) => {
      const i = order.findIndex((s) => !used.includes(s) && (s.floor !== 3 || s.outdoor || top < 2) && (!s.outdoor || out < this.PER_RUN / 2));
      if (i < 0) return;
      const s = order[i];
      used.push(s);
      if (s.floor === 3 && !s.outdoor) top++;
      if (s.outdoor) out++;
      this.placed.push(this.build(game, note, s));
    });
  },

  // a folded sheet lying where it was dropped, a faint glow over it
  build(game, note, s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y + 0.012, s.z);
    g.rotation.y = G.rng() * Math.PI * 2;
    const tex = this.paperTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x2a2416 });
    const left = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.3), mat);
    left.rotation.set(-Math.PI / 2, 0.08, 0); left.position.set(-0.06, 0.004, 0);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.3), mat);
    right.rotation.set(-Math.PI / 2, -0.08, 0); right.position.set(0.06, 0.004, 0);
    g.add(left, right);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTexture(), color: 0xffe6a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(0.9, 0.9, 1); halo.position.y = 0.12;
    g.add(halo);
    // something easier to aim at than a sheet of paper
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), mat);
    hit.visible = false; hit.position.y = 0.2;
    g.add(hit);
    game.scene.add(g);
    const ref = { note, spot: s, mesh: g, halo, read: false, phase: G.rng() * 6.3 };
    game.world.interactables.push({ mesh: g, kind: "note", ref });
    game.world.noMerge = game.world.noMerge || [];
    game.world.noMerge.push(g);
    return ref;
  },
  paperTexture() {
    if (this._paperTex) return this._paperTex;
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = "#efe6cc"; c.fillRect(0, 0, 64, 128);
    c.fillStyle = "rgba(40,50,90,0.55)";
    for (let y = 16; y < 118; y += 8) c.fillRect(6, y, 20 + ((y * 7) % 30), 2);
    c.fillStyle = "rgba(120,90,40,0.25)"; c.beginPath(); c.arc(44, 90, 14, 0, 7); c.fill();
    this._paperTex = new THREE.CanvasTexture(cv);
    return this._paperTex;
  },
  haloTexture() {
    if (this._haloTex) return this._haloTex;
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const c = cv.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.35, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    this._haloTex = new THREE.CanvasTexture(cv);
    return this._haloTex;
  },

  update(game, dt) {
    if (!this.placed.length) return;
    const t = performance.now() / 1000;
    for (const n of this.placed) {
      if (n.read) continue;
      // a slow breath of light, so it is noticed from across a room
      n.halo.material.opacity = 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.1 + n.phase));
      const s = 0.8 + 0.12 * Math.sin(t * 2.1 + n.phase);
      n.halo.scale.set(s, s, 1);
    }
  },

  // ---- reading ---------------------------------------------------------------
  // from the world: opens the note; keeping it takes it away and saves it
  read(game, ref) {
    if (!ref || ref.read || G.Modal.isOpen("note")) return;
    if (G.Audio) G.Audio.sfx("paper");
    this.open(ref.note, { levelKey: this.levelKey, keep: () => this.keep(game, ref) });
  },
  keep(game, ref) {
    if (ref.read) return;
    ref.read = true;
    ref.mesh.visible = false;
    const i = game.world.interactables.findIndex((x) => x.ref === ref);
    if (i >= 0) game.world.interactables.splice(i, 1);
    game.notesReadRun.add(ref.note.id);
    const key = this.levelKey;
    G.save.notes = G.save.notes || {};
    const list = G.save.notes[key] = G.save.notes[key] || [];
    const isNew = !list.includes(ref.note.id);
    if (isNew) list.push(ref.note.id);
    G.persist();
    const total = this.all(key).length;
    G.UI.flashPurchaseBanner(G.T(isNew ? "notes.kept" : "notes.keptAgain"), G.T("notes.keptText", { n: list.length, total }));
    if (list.length >= total && total > 0) G.unlockAchievement("notes_" + key);
    // (round 3: three read this run is one of the third floor's steps)
    if (game.checkThirdFloorUnlock) game.checkThirdFloorUnlock();
  },

  // the reader window: the note on old paper, its CEFR level in the corner,
  // a button to have it read aloud, and Keep Note (or Close, from the
  // journal)
  open(note, opts) {
    opts = opts || {};
    this._opts = opts;
    this._note = note;
    const fromJournal = !!opts.fromJournal;
    G.UI.renderNoteReader(note, fromJournal);
    G.Modal.open("note", { pause: true, keys: (e) => {
      if (e.code === "Enter" || e.code === "Space" || e.code === "KeyE" || e.code === "Escape" || e.code === G.save.settings.keybinds.pause) { this.close(); return true; }
      if (e.code === "KeyT" || e.code === "KeyV") { this.toggleSpeech(); return true; }
      return false;
    } });
    G.UI.showScreen("screen-note");
  },
  close() {
    if (!G.Modal.isOpen("note")) return;
    this.stopSpeech();
    const o = this._opts || {};
    this._opts = null;
    if (o.fromJournal) { G.UI.showScreen(o.back || "screen-journal"); if (G.UI.renderJournal) G.UI.renderJournal(); }
    else G.UI.showScreen(null);
    G.Modal.close("note");
    if (o.keep) o.keep();
  },
  toggleSpeech() {
    if (!("speechSynthesis" in window) || !this._note) return;
    if (speechSynthesis.speaking) { this.stopSpeech(); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(this._note.title + ". " + this._note.text.replace(/\n+/g, " "));
      const v = G.Audio.pickVoice ? G.Audio.pickVoice() : null;
      u.lang = (v && v.lang) || "en-GB";
      if (v) u.voice = v;
      u.rate = 0.92; u.volume = Math.min(1, G.Audio.vol ? G.Audio.vol("speech") : 1);
      u.onend = () => G.UI.setNoteSpeaking && G.UI.setNoteSpeaking(false);
      speechSynthesis.speak(u);
      G.UI.setNoteSpeaking && G.UI.setNoteSpeaking(true);
    } catch (e) { /* reading aloud is a nicety */ }
  },
  stopSpeech() {
    try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    G.UI.setNoteSpeaking && G.UI.setNoteSpeaking(false);
  },

  // where the notes of this run still lie (the minimap)
  lying() { return this.placed.filter((n) => !n.read); },

  reset() {
    this.placed = [];
  },
};
