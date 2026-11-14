// Dev-only (not shipped). The expansion's round 9: frame times with the new systems on, per
// graphics level -- the way tools/stress-test.js measures (each frame 1/60 s of game, stepped
// by hand, and the GPU made to finish it: a one-pixel read-back), so a frame's cost is all of it
// on THIS machine's GPU. Six scenes:
//   crowd0    the school's front yard, 16 zombies coming on (topped up), the starting pistol with
//             nothing fitted, aimed half the time, firing, a blast every 2 s -- the game as it was
//             before the expansion's guns (the baseline)
//   melee0    the same crowd, the knife swung (quick melee) every half second (the baseline)
//   crowd     the same crowd, the gun in hand an SMG
//             forged to Mk II with an x2 sight and a grip, aimed half the time, firing, a blast
//             every 2 s
//   melee     the same crowd, a fire axe swung from the gun (quick melee) every half second
//   forge     the Word Forge's upgrade scene at the school's station, played through twice
//   training  the Training Yard's drill: its wave of five Shamblers and a Crawler
//   await G.PerfExpansion.run("high", 240)  -> { gpu, quality, size, scenes: { crowd: { p50, p95,
//                                               max, fps, calls }, ... } }
// Load it into the game (the Main Menu or the lobby); reload the page afterwards (the animation
// loop is stopped meanwhile).
window.G = window.G || {};
G.PerfExpansion = {
  async run(quality, frames) {
    const g = G.Game, out = { quality, scenes: {} };
    frames = frames || 240;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); setTimeout(r, 30); });
    const saved = JSON.stringify(G.save);
    if (G.MainMenu && G.MainMenu.visible && G.MainMenu.visible()) { G.MainMenu.toLobby(); await wait(900); }
    if (G.Modal.isOpen && G.Modal.isOpen("brightness")) G.BrightnessCal.ok();
    if (G.Dialog && G.Dialog.isOpen()) G.Dialog.close();
    G.Input.requestPointerLock = () => {};
    const upd = g._update0 || g.update;
    const loop0 = g.loop;
    g.loop = function () {};                    // (the animation loop stops at its next frame)
    await wait(100);
    const gl = g.renderer.getContext(), px = new Uint8Array(4);
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    out.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
    const V3 = THREE.Vector3;
    const frame = () => { const t0 = performance.now(); upd.call(g, 1 / 60); g.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
    // n frames timed (after a warm-up: the first draws compile their shaders), each() before every frame
    const timed = async (n, each) => {
      for (let i = 0; i < 30; i++) { if (each) each(-1); upd.call(g, 1 / 60); g.renderFrame(); }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const ms = []; let calls = 0;
      for (let f = 0; f < n; f++) {
        if (each) each(f);
        ms.push(frame());
        calls += g.renderer.info.render.calls;
        if (f % 20 === 19) await tick();
      }
      ms.sort((a, b) => a - b);
      return { p50: +pct(ms, 0.5).toFixed(1), p95: +pct(ms, 0.95).toFixed(1), max: +ms[ms.length - 1].toFixed(1), fps: Math.round(1000 / pct(ms, 0.5)), calls: Math.round(calls / n) };
    };
    const begin = (fn) => {
      G.save.tutorialDone = true;
      G.save.settings.graphicsQuality = quality;
      g.update = upd;
      g.applyGraphicsQuality();
      fn();
      G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY";
      g.requiredKills = 1e9;
      g.player.hp = g.player.maxHp = 1e6;
      if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
    };
    try {
      out.size = innerWidth + "x" + innerHeight + " @" + (g.renderer.getPixelRatio ? g.renderer.getPixelRatio() : 1);
      // ---------------- the crowd, with a forged gun wearing attachments ----------------
      begin(() => g.startLevel(1));
      const pl = g.player, gid = "smg", d = G.WEAPON_DEFS[gid];
      // (first the same crowd as the game had before the expansion's guns: the starting pistol, no
      // attachments, no tier, the knife -- what the expansion adds is the difference)
      const p00 = g.yawObject.position.clone();
      const ring0 = (n) => {
        const alive = g.zombies.filter((z) => !z.dead).length;
        for (let i = alive; i < n; i++) {
          const k = G.ZOMBIE_KINDS[i % G.ZOMBIE_KINDS.length], a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 10;
          g.spawnZombieAt(k === "abomination" ? "normal" : k, new V3(p00.x + Math.cos(a) * r, p00.y - 1.7, p00.z + Math.sin(a) * r), null);
        }
      };
      ring0(16);
      out.scenes.crowd0 = await timed(frames, (f) => {
        const am = pl.ammo[g.currentWeaponId()]; if (am && am.reserve < 200) am.reserve = 999;
        G.Input.mouseDown = true;
        if (f >= 0 && f % 4 === 0) G.onFirePress();
        G.Input.aimDown = Math.floor(Math.max(0, f) / 60) % 2 === 1;
        if (f >= 0 && f % 120 === 0) g.splashDamage(new V3(p00.x + 4, p00.y - 1.2, p00.z - 4), { splashRadius: 3.5 }, 0, true);
        if (f >= 0 && f % 30 === 0) ring0(16);
        pl.hp = pl.maxHp;
        g.yawObject.rotation.y += 0.008;
      });
      G.Input.mouseDown = false; G.Input.aimDown = false;
      out.scenes.melee0 = await timed(frames, (f) => {
        if (f >= 0 && f % 30 === 0) G.onMeleePress();
        if (f >= 0 && f % 30 === 0) ring0(16);
        pl.hp = pl.maxHp;
        g.yawObject.rotation.y += 0.008;
      });
      if (!pl.ammo[gid]) { pl.ammo[gid] = { mag: d.magSize, reserve: 999 }; pl.weaponLevels[gid] = { dmg: 1, rate: 1, mag: 1 }; }
      if (!pl.gunSlots.includes(gid)) pl.gunSlots.push(gid);
      if (G.Attach) { G.Attach.setAll(gid, { optic: "x2", grip: "vgrip" }); G.Attach.apply(); }
      if (G.Forge) G.Forge.setTier(g, gid, 2);
      g.switchSlot(pl.gunSlots.indexOf(gid) + 1);
      for (let i = 0; i < 40; i++) upd.call(g, 1 / 60);
      const p0 = g.yawObject.position.clone();
      const ring = (n) => {
        const alive = g.zombies.filter((z) => !z.dead).length;
        for (let i = alive; i < n; i++) {
          const k = G.ZOMBIE_KINDS[i % G.ZOMBIE_KINDS.length], a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 10;
          g.spawnZombieAt(k === "abomination" ? "normal" : k, new V3(p0.x + Math.cos(a) * r, p0.y - 1.7, p0.z + Math.sin(a) * r), null);
        }
      };
      ring(16);
      out.scenes.crowd = await timed(frames, (f) => {
        const am = pl.ammo[g.currentWeaponId()]; if (am && am.reserve < 200) am.reserve = 999;
        G.Input.mouseDown = true;
        G.Input.aimDown = Math.floor(Math.max(0, f) / 60) % 2 === 1;      // a second aimed through the x2, a second not
        if (f >= 0 && f % 120 === 0) g.splashDamage(new V3(p0.x + 4, p0.y - 1.2, p0.z - 4), { splashRadius: 3.5 }, 0, true);
        if (f >= 0 && f % 30 === 0) ring(16);
        pl.hp = pl.maxHp;
        g.yawObject.rotation.y += 0.008;
      });
      G.Input.mouseDown = false; G.Input.aimDown = false;
      // ---------------- melee in the same crowd ----------------
      if (G.Melee) G.Melee.give(g, "axe");
      out.scenes.melee = await timed(frames, (f) => {
        if (f >= 0 && f % 30 === 0) G.onMeleePress();
        if (f >= 0 && f % 30 === 0) ring(16);
        pl.hp = pl.maxHp;
        g.yawObject.rotation.y += 0.008;
      });
      // ---------------- the Word Forge's upgrade scene ----------------
      const W = g.world && g.world.forge;
      if (W && G.ForgeScene) {
        g.clearZombies();
        // in front of the anvil, facing it (the station's own floor), its room drawn (zones)
        g.teleportPlayer(new V3(W.front.x, W.y || 0, W.front.z));
        g.yawObject.rotation.y = Math.atan2(-(W.anvil.x - W.front.x), -(W.anvil.z - W.front.z)); g.pitchObject.rotation.x = -0.15;
        if (G.Zones) G.Zones.update(g, true);
        let plays = 0;
        const again = () => { plays++; G.ForgeScene.play(g, W, gid, 3, () => {}); };
        again();
        out.scenes.forge = await timed(Math.max(frames, 300), () => { if (!G.ForgeScene.active && plays < 3) again(); });
        if (G.ForgeScene.active) G.ForgeScene.skip();
        G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY";
      }
      g.quitToMainMenu();
      // ---------------- the Training Yard's drill ----------------
      if (G.TrainingYard && G.TrainingYard.on()) {
        begin(() => g.startTraining(8));
        out.scenes.training = await timed(frames, () => { g.player.hp = g.player.maxHp; g.yawObject.rotation.y += 0.004; });
        g.quitToMainMenu();
      }
    } finally {
      g.update = upd;
      g.loop = loop0;
      G.Input.mouseDown = false; G.Input.aimDown = false;
      G.save = JSON.parse(saved); G.persist(true);
      if (G.Attach) G.Attach.apply();
      if (g.state !== "MENU") g.quitToMainMenu();
    }
    return out;
  },
};
