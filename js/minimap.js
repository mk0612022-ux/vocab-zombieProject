// ===================================================================
// Minimap (round 3, F3)
// -------------------------------------------------------------------
// A round map in the top-right corner, turning with the player (the way
// they face is always up), with N on its rim. It shows the storey the
// player is on -- the rooms and corridors of that floor inside the building,
// the campus round it (paths, the pitch, the garden, the salas, the car
// park) -- and markers:
//   notes    this run's story notes still lying about, once near (all of
//            them, wherever they are, after the broadcast-room radio)
//   keys     the caretaker's keys not yet found, pinned to the rim when far
//   stairs   up and down, on the floors they join
//   grille   the locked stair to the third floor
//   keycard  the Floor 3 Keycard once it has turned up (round 3, I), pinned
//            to the rim when far
//   radar    the zombie with the word, while Word Radar lasts (round 3, H)
//   boss     a boss wave: where its boss will be fought; during the fight,
//            the arena's energy fence and the boss
// The map of each storey is drawn once into its own canvas when the level
// loads; each frame (a dozen times a second) only that is copied, turned,
// and the markers drawn on top.
// ===================================================================
G.Minimap = {
  RANGE: 36,                       // metres from the centre to the rim
  PX: 2,                           // pixels per metre in the prepared maps

  init(game) {
    this.cv = document.getElementById("hud-minimap");
    this.layers = null;
    this._t = 0;
    const world = game.world;
    if (!this.cv) return;
    const on = !!(world && world.campus && world.footprint);
    this.cv.classList.toggle("hidden", !on);
    if (!on) return;
    this.world = world;
    this.layers = [1, 2, 3].map((s) => this.buildLayer(world, s));
    this.resize();
  },
  resize() {
    if (!this.cv) return;
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(60, Math.round((r.width || 150) * dpr));
    if (this.cv.width !== w) { this.cv.width = w; this.cv.height = w; }
  },

  COLORS: { path: "#6e6c64", pitch: "#35552c", garden: "#4a4230", water: "#3a6a8a", asphalt: "#2c2d30", block: "#56534a", sala: "#b0603a" },
  buildLayer(world, storey) {
    const C = world.campus, S = this.PX;
    const cv = document.createElement("canvas");
    cv.width = Math.round((C.x1 - C.x0) * S); cv.height = Math.round((C.z1 - C.z0) * S);
    const c = cv.getContext("2d");
    const X = (x) => (x - C.x0) * S, Z = (z) => (z - C.z0) * S;
    const rect = (r, fill, stroke) => {
      c.fillStyle = fill; c.fillRect(X(r.minX), Z(r.minZ), (r.maxX - r.minX) * S, (r.maxZ - r.minZ) * S);
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.strokeRect(X(r.minX) + 0.5, Z(r.minZ) + 0.5, (r.maxX - r.minX) * S - 1, (r.maxZ - r.minZ) * S - 1); }
    };
    const up = storey > 1;
    // the grounds (dimmed when you are upstairs)
    c.fillStyle = up ? "#151b14" : "#22301e"; c.fillRect(0, 0, cv.width, cv.height);
    c.globalAlpha = up ? 0.45 : 1;
    (world.mapFeatures || []).forEach((f) => {
      const col = this.COLORS[f.fill] || "#555";
      if (f.kind === "circle") { c.fillStyle = col; c.beginPath(); c.arc(X(f.x), Z(f.z), f.r * S, 0, 7); c.fill(); }
      else rect(f, col);
      if (f.fill === "pitch") {
        c.strokeStyle = "rgba(220,230,210,0.5)"; c.lineWidth = 1;
        c.strokeRect(X(f.minX) + 0.5, Z(f.minZ) + 0.5, (f.maxX - f.minX) * S - 1, (f.maxZ - f.minZ) * S - 1);
        c.beginPath(); c.moveTo(X(f.minX), Z((f.minZ + f.maxZ) / 2)); c.lineTo(X(f.maxX), Z((f.minZ + f.maxZ) / 2)); c.stroke();
        c.beginPath(); c.arc(X((f.minX + f.maxX) / 2), Z((f.minZ + f.maxZ) / 2), 5 * S, 0, 7); c.stroke();
      }
    });
    (world.treeTops || []).forEach((t) => { c.fillStyle = t.leafy ? "#2f4a26" : "#3a3326"; c.beginPath(); c.arc(X(t.x), Z(t.z), Math.max(1.5, t.r * S * 0.6), 0, 7); c.fill(); });
    // the fence
    c.globalAlpha = 1;
    c.strokeStyle = "#8a8e92"; c.lineWidth = 2; c.strokeRect(1, 1, cv.width - 2, cv.height - 2);
    // the building: its outline, then this storey's rooms and corridors
    (world.footprint || []).forEach((f) => rect(f, "#2a2926"));
    const y = (world.storeyY || [0, 4.2, 8.4])[storey - 1];
    world.regions.filter((r) => !/^YARD/.test(r.name) && Math.abs((r.y || 0) - y) < 0.5).forEach((r) => {
      const corr = /^C\d|^GAL|^ENTRY|^BOSS/.test(r.name);
      rect(r, corr ? "#7a766a" : "#5a564c", "#1a1916");
    });
    // on the ground floor the entry hall's stair; on the first the gallery
    return cv;
  },

  update(game, dt) {
    if (!this.layers || !this.cv || this.world !== game.world) return;
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 1 / 12;
    this.draw(game);
  },

  draw(game) {
    const cv = this.cv, c = cv.getContext("2d"), W = cv.width, R = W / 2;
    const world = this.world, C = world.campus, p = game.yawObject.position, yaw = game.yawObject.rotation.y;
    const feet = p.y - 1.7, Y = world.storeyY || [0, 4.2, 8.4];
    const storey = feet < Y[1] - 1 ? 1 : feet < Y[2] - 1 ? 2 : 3;
    const k = R / this.RANGE;                              // screen px per metre
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = "#0b0d0b"; c.fillRect(0, 0, W, W);
    c.translate(R, R); c.rotate(yaw); c.scale(k / this.PX, k / this.PX);
    c.translate(-(p.x - C.x0) * this.PX, -(p.z - C.z0) * this.PX);
    c.drawImage(this.layers[storey - 1], 0, 0);
    c.restore();
    // markers, upright, at their place on the turned map
    const toScreen = (x, z) => {
      const dx = x - p.x, dz = z - p.z, cs = Math.cos(yaw), sn = Math.sin(yaw);
      return { x: R + (dx * cs - dz * sn) * k, y: R + (dx * sn + dz * cs) * k };
    };
    const pin = (x, z, clamp) => {
      const s = toScreen(x, z), dx = s.x - R, dy = s.y - R, d = Math.hypot(dx, dy), max = R - 9;
      if (d <= max) return s;
      if (!clamp) return null;
      return { x: R + dx / d * max, y: R + dy / d * max, edge: true };
    };
    const dot = (s, fill, r, glyph) => {
      if (!s) return;
      c.fillStyle = fill; c.strokeStyle = "rgba(0,0,0,0.7)"; c.lineWidth = Math.max(1, R / 50);
      c.beginPath(); c.arc(s.x, s.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
      if (glyph) { c.fillStyle = "#111"; c.font = `bold ${Math.round(r * 1.4)}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(glyph, s.x, s.y + 0.5); }
    };
    const onFloor = (y) => Math.abs(y - Y[storey - 1]) < 2;
    const r0 = Math.max(4, R / 16);
    // stairs on this floor
    const nodes = world.waypointNodes;
    if (world.stairs) world.stairs.forEach((s) => {
      const foot = nodes[s.foot], top = nodes[s.top];
      if (foot && onFloor(s.y0)) dot(pin(foot.x, foot.z, false), "#c8d8e8", r0 * 0.9, "↑");
      if (top && onFloor(s.y1)) dot(pin(top.x, top.z, false), "#c8d8e8", r0 * 0.9, "↓");
    });
    // the locked grille
    const tf = world.thirdFloor;
    if (tf && !tf.unlocked && onFloor(tf.stairFoot.y)) dot(pin(tf.stairFoot.x + 1, tf.stairFoot.z, false), "#ff6a4a", r0 * 0.9, "✕");
    // (round 2) a boss wave: where its boss will be fought; during the fight
    // the arena's energy fence and the boss itself
    const B = G.Bosses;
    if (B && B.arena && B.phase === "fight") {
      const r = B.arena.rect, a = toScreen(r.minX, r.minZ), b2 = toScreen(r.maxX, r.minZ), c2 = toScreen(r.maxX, r.maxZ), d2 = toScreen(r.minX, r.maxZ);
      c.strokeStyle = "rgba(58,208,255,0.9)"; c.lineWidth = Math.max(1.5, R / 45);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b2.x, b2.y); c.lineTo(c2.x, c2.y); c.lineTo(d2.x, d2.y); c.closePath(); c.stroke();
      if (B.boss) dot(pin(B.boss.pos.x, B.boss.pos.z, true), "#ff3a3a", r0 * 1.35, "!");
    } else if (game.isBossWave && game.isBossWave() && B) {
      const A = B.arena || (world.pitch ? { boss: { x: (world.pitch.minX + world.pitch.maxX) / 2, z: -41 } } : { boss: world.bossRoomCenter });
      if (A.boss) dot(pin(A.boss.x, A.boss.z, true), "rgba(255,74,74,0.8)", r0, "!");
    }
    // keys still to find: pinned to the rim when far away
    (world.keys || []).forEach((kk) => { if (!kk.taken) dot(pin(kk.mesh.position.x, kk.mesh.position.z, true), onFloor(kk.baseY) ? "#ffd43b" : "rgba(255,212,59,0.5)", r0 * 0.85, "⚷"); });
    // story notes: near ones always, all of them once the radio has told you
    if (G.Notes) G.Notes.lying().forEach((n) => {
      const reveal = game._notesRevealed, d = Math.hypot(n.spot.x - p.x, n.spot.z - p.z);
      if (!reveal && d > this.RANGE * 0.8) return;
      dot(pin(n.spot.x, n.spot.z, reveal), onFloor(n.spot.y) ? "#f0e2b0" : "rgba(240,226,176,0.45)", r0 * 0.8, "✎");
    });
    // the mystery box
    if (world.mysteryBox && onFloor(world.mysteryBox.mesh.position.y - 0.7)) dot(pin(world.mysteryBox.x, world.mysteryBox.z, false), "#a07aff", r0 * 0.75, "?");
    // (round 3) the Floor 3 Keycard, and the word Word Radar has found
    if (G.Floor3) G.Floor3.mapMarks(game, dot, pin, onFloor, r0);
    const rz = G.Abilities && G.Abilities.radarTarget;
    if (rz && rz.alive) dot(pin(rz.mesh.position.x, rz.mesh.position.z, true), "#ffd23a", r0 * 1.05, "◎");
    // the player: an arrow pointing up
    c.fillStyle = "#6bff7a"; c.strokeStyle = "#0b1a0e"; c.lineWidth = Math.max(1, R / 45);
    c.beginPath(); c.moveTo(R, R - r0 * 1.5); c.lineTo(R + r0, R + r0); c.lineTo(R, R + r0 * 0.4); c.lineTo(R - r0, R + r0); c.closePath(); c.fill(); c.stroke();
    // the rim, and north on it
    c.strokeStyle = "rgba(220,230,220,0.55)"; c.lineWidth = Math.max(1.5, R / 40);
    c.beginPath(); c.arc(R, R, R - 1.5, 0, Math.PI * 2); c.stroke();
    const n = toScreen(p.x, p.z - 1000), nd = Math.hypot(n.x - R, n.y - R) || 1, nm = R - Math.max(8, R / 7);
    const nx = R + (n.x - R) / nd * nm, ny = R + (n.y - R) / nd * nm;
    c.fillStyle = "rgba(0,0,0,0.6)"; c.beginPath(); c.arc(nx, ny, Math.max(7, R / 9), 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ff5a4a"; c.font = `bold ${Math.round(Math.max(9, R / 7.5))}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(G.T("map.north"), nx, ny + 0.5);
  },
};
