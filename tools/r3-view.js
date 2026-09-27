// Round 3 inspection helpers (dev only; load from the console or a test):
//   await R3View.setup("high")   start the school level frozen, HUD hidden
//   R3View.view(x, eyeY, z, yaw, pitch)  -> "calls, tris, zone state"
//   R3View.tour()                 draw calls at a list of places
window.R3View = {
  async setup(quality) {
    window.__errs = window.__errs || [];
    if (!window.__errHooked) { window.__errHooked = true; window.addEventListener("error", (e) => window.__errs.push(String(e.message) + " @" + e.filename + ":" + e.lineno)); }
    G.save.settings.graphicsQuality = quality || "high";
    const t0 = performance.now();
    G.Game.startLevel(1);
    this.loadMs = Math.round(performance.now() - t0);
    G.Game.applyGraphicsQuality();
    this._update = this._update || G.Game.update;
    G.Game.update = function () {};
    this._vm = this._vm || G.Game.vmCamera;
    G.Game.vmCamera = null;
    document.getElementById("hud").style.visibility = "hidden";
    return { loadMs: this.loadMs, errs: window.__errs.slice(), items: G.Zones.items.length };
  },
  restore() {
    if (this._update) G.Game.update = this._update;
    if (this._vm) G.Game.vmCamera = this._vm;
    document.getElementById("hud").style.visibility = "";
  },
  view(x, y, z, yaw, pitch) {
    const g = G.Game;
    g.yawObject.position.set(x, y, z); g.yawObject.rotation.y = yaw || 0; g.pitchObject.rotation.x = pitch || 0;
    g.scene.updateMatrixWorld(true);
    G.Perf.updateLights(g.yawObject.position, new THREE.Vector3(-Math.sin(yaw || 0), 0, -Math.cos(yaw || 0)), performance.now() / 1000);
    G.Zones.update(g, true);
    if (G.Details && G.Details.update) G.Details.update(g, 0.016);
    g.renderFrame();
    const i = g.renderer.info.render;
    return i.calls + " calls, " + Math.round(i.triangles / 1000) + "k tris, " + (G.Zones.state ? G.Zones.state.region : "") + " drawn " + G.Zones.drawn;
  },
  PLACES: {
    gate: [0, 1.7, 72, 0, 0.12], frontYard: [0, 1.7, 45, 0, 0], entryHall: [0, 1.7, 30, 0, 0],
    corrF1: [0, 1.7, 0, 0, 0], corrF1back: [0, 1.7, -40, Math.PI, 0], classroomW1: [-9.75, 1.7, 13.5, Math.PI / 2, 0],
    corrF2: [0, 5.9, -10, 0, 0], library: [-8, 5.9, 7, Math.PI / 2, 0], corrF3: [0, 10.1, -10, 0, 0],
    principal: [-9.75, 10.1, 13.5, Math.PI / 2, 0], field: [-34, 1.7, -32, Math.PI / 2, 0], garden: [42, 1.7, -3, 0, 0],
    backyard: [0, 1.7, -95, 0, 0], gym: [0, 1.7, -75, Math.PI, 0],
  },
  tour() {
    const out = {};
    Object.keys(this.PLACES).forEach((k) => { out[k] = this.view(...this.PLACES[k]); });
    return out;
  },
};
