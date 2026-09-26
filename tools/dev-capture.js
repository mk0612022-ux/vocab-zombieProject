// Dev-only screenshot harness (not shipped). Freezes the game loop, steps the
// simulation by hand and posts canvas snapshots to a localhost receiver.
window.__errs = [];
window.addEventListener("error", (e) => window.__errs.push(e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
window.__snap = async (name) => {
  const g = G.Game;
  g.scene.updateMatrixWorld(true);
  if (g.renderFrame) g.renderFrame(); else g.renderer.render(g.scene, g.camera);
  const url = g.renderer.domElement.toDataURL("image/png");
  await fetch("http://localhost:8091/?name=" + name, { method: "POST", body: url, mode: "no-cors" });
  return name;
};
window.__stage = function (opts) {
  const g = G.Game; opts = opts || {};
  if (!window.__realUpd) window.__realUpd = g.update;
  G.save.tutorialDone = true; G.save.settings.graphicsQuality = opts.quality || "high";
  g.update = window.__realUpd; g.checkWaveClear = function () {}; G.Spawner.update = function () {};
  g.startLevel(opts.level || 1); g.update = function () {};
  const upd = (dt) => window.__realUpd.call(g, dt);
  g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = []; g.player.hp = 1e9;
  if (opts.weapon) g.acquireWeapon(opts.weapon);
  g.yawObject.position.set(opts.x || 0, 1.7, opts.z === undefined ? 44 : opts.z);
  g.yawObject.rotation.y = opts.yaw || 0; g.pitchObject.rotation.x = opts.pitch || 0;
  G.Input.mode = "touch"; G.Input.touchMove = { x: 0, y: 0, active: true }; G.Input.touchFire = false; G.Input.touchSprint = false;
  for (let i = 0; i < 60; i++) upd(1 / 60);
  G.UI.setHudVisible(false); G.UI.setTouchControlsVisible(false); G.UI.showScreen(null);
  window.__upd = upd;
  return upd;
};
window.__run = (sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { if (fn) fn(t); window.__upd(1 / 60); } };
// Contact sheet: frames drawn into one image, 3 per row
window.__sheet = async (name, steps, opts) => {
  opts = opts || {};
  const g = G.Game, W = opts.w || 320, H = opts.h || 180, cols = opts.cols || 3;
  const rows = Math.ceil(steps.length / cols);
  const cv = document.createElement("canvas"); cv.width = W * cols; cv.height = (H + 18) * rows;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.run) s.run();
    g.scene.updateMatrixWorld(true); if (g.renderFrame) g.renderFrame(); else g.renderer.render(g.scene, g.camera);
    const x = (i % cols) * W, y = Math.floor(i / cols) * (H + 18);
    ctx.drawImage(g.renderer.domElement, x, y, W, H);
    ctx.fillStyle = "#fff"; ctx.font = "13px sans-serif"; ctx.fillText(s.label || "", x + 6, y + H + 13);
  }
  await fetch("http://localhost:8091/?name=" + name, { method: "POST", body: cv.toDataURL("image/png"), mode: "no-cors" });
  return name;
};
