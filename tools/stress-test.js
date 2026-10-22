// Dev-only (not shipped). The overhaul, round 8: the stress test of PROMPT
// section 8, per graphics level -- the school's front yard, thirty zombies
// kept about the player (topped up as they fall), the gun firing without
// a break, a blast every 1.2 s. The frames are stepped by hand (1/60 s of
// game each) and the GPU made to finish every one (a one-pixel read-back),
// so a frame's cost is all of it on THIS machine.
//   await G.StressTest.run(["vlow", ..., "vhigh"], 600)
//     -> rows of { quality, frames, p50, p95, max (ms), heapMB, particles,
//                  particleBudget, decals, decalBudget, voices, voiceCap,
//                  calls (average, most), zombies (average), slow (frames over
//                  100 ms), spikes (the first frames over 150 ms: frame:ms,
//                  a blast or new zombies in it, shader programs by then) }
// Load it into the game (the Main Menu or the lobby); the page is best
// reloaded afterwards (the animation loop is stopped meanwhile).
window.G = window.G || {};
G.StressTest = {
  async run(qualities, frames) {
    const g = G.Game, rows = [];
    frames = frames || 600;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); setTimeout(r, 30); });
    const saved = JSON.stringify(G.save);
    if (G.MainMenu && G.MainMenu.visible && G.MainMenu.visible()) { G.MainMenu.toLobby(); await wait(900); }
    if (G.Modal.isOpen && G.Modal.isOpen("brightness")) G.BrightnessCal.ok();
    G.Input.requestPointerLock = () => {};
    const upd = g._update0 || g.update;
    g.loop = function () {};                    // (the animation loop stops at its next frame)
    await wait(100);
    const gl = g.renderer.getContext(), px = new Uint8Array(4);
    const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
    try {
      for (const q of qualities || ["vlow", "low", "medium", "high", "vhigh"]) {
        G.save.tutorialDone = true;
        G.save.settings.graphicsQuality = q;
        g.update = upd;
        // (the level chosen first, then the level started -- as a player does
        // it; applied after the start, the effects' pools would be made anew
        // after the load's shader compile)
        g.applyGraphicsQuality();
        g.startLevel(1);
        G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY";
        g.requiredKills = 1e9;
        g.player.hp = g.player.maxHp = 1e6;
        if (G.Audio.unlock) G.Audio.unlock();
        const p0 = g.yawObject.position.clone();
        const ring = () => {
          const alive = g.zombies.filter((z) => !z.dead).length;
          for (let i = alive; i < 30; i++) {
            const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 10;
            g.spawnZombieAt(G.ZOMBIE_KINDS[i % G.ZOMBIE_KINDS.length] === "abomination" ? "normal" : G.ZOMBIE_KINDS[i % G.ZOMBIE_KINDS.length],
              new THREE.Vector3(p0.x + Math.cos(a) * d, p0.y - 1.7, p0.z + Math.sin(a) * d), null);
          }
        };
        ring();
        for (let i = 0; i < 30; i++) { upd.call(g, 1 / 60); g.renderFrame(); }
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const ms = [], spikes = [];
        let calls = 0, callsMax = 0, zs = 0, maxP = 0, maxD = 0, maxV = 0;
        for (let f = 0; f < frames; f++) {
          // the load: keep firing (a semi-automatic gun: a press a frame), a blast now and then, the crowd topped up
          const id = g.currentWeaponId(), am = g.player.ammo[id];
          if (am && am.reserve < 200) am.reserve = 999;
          G.Input.mouseDown = true;
          const def = g.currentWeaponDef();
          if (def && !def.auto && G.onFirePress && f % 4 === 0) G.onFirePress();
          const what = (f % 72 === 0 ? "blast " : "") + (f % 30 === 0 ? "topup " : "");
          if (f % 72 === 0) {
            const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 7;
            g.splashDamage(new THREE.Vector3(p0.x + Math.cos(a) * d, p0.y - 1.2, p0.z + Math.sin(a) * d), { splashRadius: Math.random() < 0.3 ? 6 : 3.5 }, 0, true);
          }
          if (f % 30 === 0) ring();
          g.player.hp = g.player.maxHp;
          g.yawObject.rotation.y += 0.01;
          const t0 = performance.now();
          upd.call(g, 1 / 60);
          g.renderFrame();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const dt = performance.now() - t0;
          ms.push(dt);
          // (a slow frame: when, and what was new in it -- a first draw of a material compiles its shader)
          if (dt > 150 && spikes.length < 12) spikes.push(f + ":" + Math.round(dt) + (what ? " " + what.trim() : "") + " p" + (g.renderer.info.programs ? g.renderer.info.programs.length : "?"));
          const c = g.renderer.info.render.calls;
          calls += c; callsMax = Math.max(callsMax, c);
          zs += g.zombies.filter((z) => !z.dead).length;
          const st = G.FX.stats();
          maxP = Math.max(maxP, st.particles); maxD = Math.max(maxD, st.decals);
          if (G.Audio.ctx) maxV = Math.max(maxV, G.Audio.counts().total || 0);
          if (f % 20 === 19) await tick();
        }
        G.Input.mouseDown = false;
        ms.sort((a, b) => a - b);
        const st = G.FX.stats(), mem = performance.memory;
        rows.push({
          quality: q, frames, p50: +pct(ms, 0.5).toFixed(2), p95: +pct(ms, 0.95).toFixed(2), max: +ms[ms.length - 1].toFixed(2),
          heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
          particles: maxP, particleBudget: st.particleBudget, decals: maxD, decalBudget: st.decalBudget,
          voices: maxV, voiceCap: G.CONFIG.audio.total[q], audio: !!G.Audio.ctx,
          calls: Math.round(calls / frames), callsMax, zombies: Math.round(zs / frames),
          slow: ms.filter((x) => x > 100).length, spikes,
        });
      }
    } finally {
      g.update = upd;
      G.Input.mouseDown = false;
      G.save = JSON.parse(saved); G.persist();     // (the level's own saves wrote the last level tried)
      g.quitToMainMenu();
    }
    return rows;
  },
};
