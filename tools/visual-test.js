// Dev-only (not shipped). Visual series (Cinematic Dark Fantasy), O: the eight
// fixed camera spots of the school, shot at every graphics quality, with what
// can be measured from the pictures:
//   dark      the share of near-black pixels (luminance under 10 of 255),
//             leaving out the corners the vignette darkens
//   zombies   how a zombie stands out from what is behind it at combat range
//             (the frame with it against the same frame without it)
//   labels    the contrast of a word against its plate where the plate lies
//             on the brightest part of the picture behind it (WCAG ratio)
//   fps       the frame cost at each spot with a crowd about (G.PerfMeasure's
//             way: the GPU made to finish every frame)
// Works on the code before the series too (the "before" set is shot from a
// worktree of the previous commit served on another port, with this file).
//   await G.VisualTest.shoot("v1_after", ["medium", "high"])  -> pictures + rows
//   await G.VisualTest.perf(["vlow", ..., "vhigh"])             -> fps rows
// Pictures are posted to a local receiver on port 8091 (scratchpad).
window.G = window.G || {};
G.VisualTest = {
  // name, x, eye y, z, yaw, pitch
  SPOTS: [
    ["front", -2, 1.7, 44, 0.22, 0.1],                         // the front of the school
    ["courtyard", 10, 1.7, 60, Math.PI / 2 + 0.55, 0.03],     // the front yard, the flagpole
    ["classroom", -12.5, 1.7, 10.2, Math.PI / 2 + 0.6, -0.08],
    ["corridor", 0, 1.7, 2, 0, 0],
    ["library", -5, 5.9, 17, 0.55, -0.1],                     // first floor, the library
    ["field", -28, 1.7, -12, 0.7, 0.04],                      // the football field
    ["garden", 28, 1.7, -18, -0.72, -0.05],                   // the flower garden
    ["forest_edge", -52, 1.7, 4, Math.PI / 2 + 0.25, 0.06],   // the edge of the map
  ],
  QUALITIES: ["vlow", "low", "medium", "high", "vhigh"],
  NEAR_BLACK: 10,
  post(name, canvas, type) {
    const t = type || "image/jpeg";
    return fetch("http://localhost:8091/?name=" + name, { method: "POST", body: canvas.toDataURL(t, 0.9), mode: "no-cors" }).catch(() => {});
  },
  // measurements, kept as JSON beside the pictures
  saveJSON(name, data) {
    return fetch("http://localhost:8091/?name=" + name, { method: "POST", body: JSON.stringify(data), mode: "no-cors" }).catch(() => {});
  },
  // the picture just drawn, small, as RGBA bytes
  grab(w) {
    const src = G.Game.renderer.domElement, h = Math.round(w * src.height / src.width);
    const c = this._c || (this._c = document.createElement("canvas"));
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.drawImage(src, 0, 0, w, h);
    return { w, h, data: x.getImageData(0, 0, w, h).data };
  },
  lum8(d, i) { return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; },
  // WCAG relative luminance of an sRGB 0-255 colour
  rel(r, g, b) {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  },
  ratio(a, b) { const hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05); },
  // near-black share outside the vignette (an ellipse reaching 90% out)
  darkStats(img) {
    let n = 0, dark = 0, dark20 = 0, sum = 0;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const ex = (x + 0.5) / img.w * 2 - 1, ey = (y + 0.5) / img.h * 2 - 1;
      if (ex * ex + ey * ey > 0.9 * 0.9 * 1.4) continue;
      const i = (y * img.w + x) * 4, L = this.lum8(img.data, i);
      n++; sum += L;
      if (L < this.NEAR_BLACK) dark++;
      if (L < 20) dark20++;
    }
    return { darkPct: +(dark / n * 100).toFixed(2), dark20Pct: +(dark20 / n * 100).toFixed(2), meanLum: +(sum / n).toFixed(1) };
  },
  async frames(n) { const g = G.Game, real = g._vtUpd; for (let i = 0; i < n; i++) real.call(g, 1 / 60); },
  place(s) {
    const g = G.Game, [, x, y, z, yaw, pitch] = s;
    g.yawObject.position.set(x, y, z);
    g.yawObject.rotation.y = yaw; g.pitchObject.rotation.x = pitch;
  },
  async startLevel(q) {
    const g = G.Game;
    G.save.tutorialDone = true;
    G.save.settings.graphicsQuality = q;
    G.Input.requestPointerLock = function () {};
    g.update = g._vtUpd;
    g.startLevel(1);
    g.applyGraphicsQuality();
    g.update = function () {};
    g.requiredKills = 1e9;
    if (g.world.secondFloor) g.world.secondFloor.unlocked = true;
    if (g.world.thirdFloor) g.world.thirdFloor.unlocked = true;
    G.UI.setHudVisible(false); G.UI.showScreen(null);
    if (G.UI.setTouchControlsVisible) G.UI.setTouchControlsVisible(false);
    if (G.Modal && G.Modal.reset) G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
  },
  clear() { const g = G.Game; g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = []; },
  // how far one can see straight ahead before a wall
  clearAhead(max) {
    const g = G.Game, yaw = g.yawObject.rotation.y, p = g.yawObject.position;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const w = g.wallDistance ? g.wallDistance(new THREE.Vector3(p.x, p.y - 0.6, p.z), dir, max) : max;
    return Math.min(max, (w == null ? max : w) - 0.9);
  },
  spawnAhead(d, side, label) {
    const g = G.Game, yaw = g.yawObject.rotation.y, p = g.yawObject.position;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const x = p.x + fx * d - fz * (side || 0), z = p.z + fz * d + fx * (side || 0);
    const zb = g.spawnZombieAt("normal", new THREE.Vector3(x, G.getFloorHeightAt(g.world, x, z, p.y - 1.2), z), null);
    if (zb) { zb.emerge = null; zb.speed = 0; zb.mesh.rotation.y = yaw; if (zb.sprite) zb.sprite.visible = label !== false; }
    return zb;
  },
  render() {
    const g = G.Game;
    G.Zones && G.Zones.update(g, true);
    g.scene.updateMatrixWorld(true);
    g.renderFrame();
  },
  // a zombie against what is behind it, at combat range: the frame with it
  // and the frame without, compared where they differ
  zombieContrast(want) {
    const g = G.Game;
    const dist = +Math.max(3, this.clearAhead(want)).toFixed(1);
    this.clear();
    this.render();
    const bg = this.grab(320);
    // (no update between the two: the grass, the dust and the clouds move with
    // time, and only the zombie may differ)
    const zb = this.spawnAhead(dist, 0, false);
    // (its shadow on the ground would count as part of it: left out here)
    if (zb) { zb.speed = 0; zb.mesh.rotation.y = g.yawObject.rotation.y; zb.mesh.traverse((o) => { o.castShadow = false; }); }
    this.render();
    const fg = this.grab(320);
    this.clear();
    // per pixel too: a zombie of light and dark parts can average out to the
    // background's brightness and still stand out everywhere -- `visible` is
    // the share of its pixels at 1.5:1 or more against what is behind them
    let n = 0, lz = 0, lb = 0, vis = 0;
    const per = [];
    for (let i = 0; i < fg.data.length; i += 4) {
      const d = Math.abs(fg.data[i] - bg.data[i]) + Math.abs(fg.data[i + 1] - bg.data[i + 1]) + Math.abs(fg.data[i + 2] - bg.data[i + 2]);
      if (d < 6) continue;
      n++;
      const a = this.rel(fg.data[i], fg.data[i + 1], fg.data[i + 2]), b = this.rel(bg.data[i], bg.data[i + 1], bg.data[i + 2]);
      lz += a; lb += b;
      const r = this.ratio(a, b);
      per.push(r);
      if (r >= 1.5) vis++;
    }
    if (!n) return { dist, px: 0, ratio: 0, visible: 0 };
    lz /= n; lb /= n;
    per.sort((x, y) => x - y);
    return { dist, px: n, zombieLum: +lz.toFixed(4), backLum: +lb.toFixed(4), ratio: +this.ratio(lz, lb).toFixed(2),
      visible: +(vis / n * 100).toFixed(1), medianPx: +per[Math.floor(per.length / 2)].toFixed(2) };
  },
  // a word over a zombie at `dist`: its text against its plate over the
  // brightest of what lies behind the label (the frame without the label)
  labelContrast(want) {
    const g = G.Game;
    const dist = +Math.max(3, this.clearAhead(want)).toFixed(1);
    this.clear();
    const zb = this.spawnAhead(dist, 0, false);
    for (let i = 0; i < 4; i++) g._vtUpd.call(g, 1 / 60);
    this.place(this._spot);
    this.render();
    const img = this.grab(640);
    if (!zb || !zb.sprite) return null;
    const s = zb.sprite, v = new THREE.Vector3();
    s.updateMatrixWorld(true);
    s.getWorldPosition(v);
    const cam = g.camera; cam.updateMatrixWorld(true);
    const c = v.clone().project(cam);
    const half = new THREE.Vector3(s.scale.x / 2, s.scale.y / 2, 0);
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(half.x);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar(half.y);
    const a = v.clone().add(right).add(up).project(cam), b = v.clone().sub(right).sub(up).project(cam);
    const px = (p) => [Math.round((p.x + 1) / 2 * img.w), Math.round((1 - p.y) / 2 * img.h)];
    const [x0, y0] = px(b), [x1, y1] = px(a);
    let hi = 0, hr = 0, hg = 0, hb = 0, lo = 1, n = 0;
    for (let y = Math.max(0, Math.min(y0, y1)); y < Math.min(img.h, Math.max(y0, y1)); y++) for (let x = Math.max(0, Math.min(x0, x1)); x < Math.min(img.w, Math.max(x0, x1)); x++) {
      const i = (y * img.w + x) * 4, L = this.rel(img.data[i], img.data[i + 1], img.data[i + 2]);
      n++;
      if (L > hi) { hi = L; hr = img.data[i]; hg = img.data[i + 1]; hb = img.data[i + 2]; }
      if (L < lo) lo = L;
    }
    // what the label is drawn with: the plate (round 1 on) or none (before)
    const P = (G.VISUAL && G.VISUAL.labels) || null;
    const text = P ? new THREE.Color(P.text) : new THREE.Color(0xffffff);
    const T = [text.r * 255, text.g * 255, text.b * 255];
    let plate = [hr, hg, hb];
    if (P) {
      const pc = new THREE.Color(P.plate), al = P.plateAlpha;
      plate = [pc.r * 255 * al + hr * (1 - al), pc.g * 255 * al + hg * (1 - al), pc.b * 255 * al + hb * (1 - al)];
    }
    this.clear();
    return { dist, px: n, brightestBehind: [hr, hg, hb], textOnPlate: +this.ratio(this.rel(T[0], T[1], T[2]), this.rel(plate[0], plate[1], plate[2])).toFixed(2), plate: P ? true : false };
  },
  async shoot(prefix, qualities, opts) {
    opts = opts || {};
    const g = G.Game, rows = [];
    const saved = JSON.stringify(G.save);
    g._vtUpd = g._vtUpd || g._upd || g.update;
    const vm = g.vmCamera;
    try {
      for (const q of qualities || this.QUALITIES) {
        await this.startLevel(q);
        g.vmCamera = null;                        // no gun in the pictures
        for (const s of this.SPOTS) {
          if (opts.only && !opts.only.includes(s[0])) continue;
          this._spot = s;
          this.clear();
          this.place(s);
          for (let i = 0; i < 24; i++) { g._vtUpd.call(g, 1 / 60); this.place(s); }
          this.render();
          if (opts.pictures !== false) await this.post(prefix + "_" + q + "_" + s[0], g.renderer.domElement);
          const row = Object.assign({ quality: q, spot: s[0] }, this.darkStats(this.grab(320)));
          // the same view with a line of zombies and their words (E1, E2)
          if (opts.crowd && opts.pictures !== false) {
            const far = Math.max(6, this.clearAhead(24));
            [0.25, 0.45, 0.65, 0.85, 1].forEach((k, i) => this.spawnAhead(Math.max(4, far * k), (i - 2) * 1.6, true));
            for (let i = 0; i < 12; i++) { g._vtUpd.call(g, 1 / 60); this.place(s); g.zombies.forEach((zb) => { zb.speed = 0; zb.emerge = null; }); }
            this.render();
            await this.post(prefix + "_" + q + "_" + s[0] + "_z", g.renderer.domElement);
            this.clear();
          }
          if (opts.measure !== false) {
            row.zombies = [10, 18, 25].map((d) => this.zombieContrast(d));
            row.label = [12, 25].map((d) => this.labelContrast(d));
          }
          rows.push(row);
          await new Promise((r) => setTimeout(r, 0));
        }
        g.vmCamera = vm;
      }
    } finally {
      g.vmCamera = vm;
      g.update = g._vtUpd;
      G.save = JSON.parse(saved);
      G.UI.setHudVisible(true);
      g.quitToMainMenu();
    }
    await this.saveJSON(prefix + "_shots", rows);
    return rows;
  },
  // the frame cost at every spot, with twelve zombies in view
  async perf(qualities, frames, name) {
    const g = G.Game, rows = [];
    frames = frames || 60;
    const saved = JSON.stringify(G.save);
    g._vtUpd = g._vtUpd || g._upd || g.update;
    const gl = g.renderer.getContext(), px = new Uint8Array(4);
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); setTimeout(r, 30); });   // (a timer too: a hidden page can hold messages back)
    try {
      for (const q of qualities || this.QUALITIES) {
        await this.startLevel(q);
        g.player.hp = g.player.maxHp = 1e6;
        for (const s of this.SPOTS) {
          this._spot = s;
          this.clear(); this.place(s);
          for (let k = 0; k < 12; k++) this.spawnAhead(5 + (k % 4) * 2.5, ((k * 7) % 9 - 4) * 0.9, true);
          for (let i = 0; i < 30; i++) { g._vtUpd.call(g, 1 / 60); this.place(s); g.renderFrame(); }
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let total = 0, calls = 0, tris = 0;
          for (let i = 0; i < frames; i++) {
            const t0 = performance.now();
            g._vtUpd.call(g, 1 / 60); this.place(s);
            g.renderFrame();
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            total += performance.now() - t0;
            calls += g.renderer.info.render.calls; tris += g.renderer.info.render.triangles;
            if (i % 20 === 19) await tick();
          }
          const ms = total / frames;
          rows.push({ quality: q, spot: s[0], ms: +ms.toFixed(2), fps: Math.round(1000 / ms), calls: Math.round(calls / frames), tris: Math.round(tris / frames) });
        }
      }
    } finally {
      g.update = g._vtUpd;
      G.save = JSON.parse(saved);
      G.UI.setHudVisible(true);
      g.quitToMainMenu();
    }
    if (name) await this.saveJSON(name, rows);
    return rows;
  },
};
