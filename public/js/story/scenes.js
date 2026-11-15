// ===================================================================
// Story Mode's scene runner (story series, round 1)
// -------------------------------------------------------------------
// A chapter's scenes are data (js/data/story/ch*.js). A scene is a list of
// beats, played in order; each beat waits for something, then does things:
//   { wait: <condition>, do: [<action>, ...] }
// A condition (none: at once):
//   { zone: id }         the player inside the chapter's zone `id` (an x/z box, any height)
//   { cleared: group }   every zombie of that group down (once it was sent)
//   { time: s }          s seconds of play since the beat before
//   { flag: name }       a flag set (by an action; later rounds: a puzzle, a pick-up)
// An action, [name, argument]:
//   ["objective", key]   the scene's objective (shown in the HUD's top box)
//   ["banner", key]      a line across the screen (until story round 2's dialogue)
//   ["spawn", { id, at, count, kinds }]  a group: `count` zombies at the spawn
//                        points `at` (a spawn's id, or several), their words
//                        from the chapter and the words due (G.Story.plan)
//   ["flag", name]       set a flag (a checkpoint keeps the flags)
//   ["prologueDone"]     from now on the chapter offers Skip Prologue
//   ["checkpoint", { x, z, yaw }?]  saved once the beat's actions are done:
//                        where the player is put back is these, or -- with
//                        ["next"] in the same beat -- the next scene's start,
//                        else this scene's start
//   ["next"]             on to the next scene
//   ["end"]              the chapter is over (the summary)
// A beat that has been met never waits again, so a few can pass in one frame.
// ===================================================================
window.G = window.G || {};

G.StoryScenes = (function () {
  const T = (k, v) => G.T(k, v);

  function inZone(game, ch, id) {
    const z = ch.zones && ch.zones[id];
    if (!z) return false;
    const p = game.yawObject.position;
    return p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1;
  }
  const groupAlive = (game, id) => game.zombies.some((z) => z.alive && z.storyGroup === id);
  function met(game, run, cond) {
    if (!cond) return true;
    if (cond.zone) return inZone(game, run.ch, cond.zone);
    if (cond.cleared) return run.groups[cond.cleared] != null && !groupAlive(game, cond.cleared);
    if (cond.time != null) return run.beatT >= cond.time;
    if (cond.flag) return run.flags.has(cond.flag);
    return false;
  }
  // a spawn's id (or several, or points as they are) -> the points
  function points(ch, at) {
    const out = [];
    [].concat(at || []).forEach((a) => { [].concat(typeof a === "string" ? (ch.spawns || {})[a] || [] : [a]).forEach((p) => out.push(p)); });
    return out.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  }
  function spawn(game, run, s) {
    const pts = points(run.ch, s.at), C = G.CONFIG.story;
    const kinds = s.kinds && s.kinds.length ? s.kinds : C.groupKinds;
    const n = Math.max(1, (s.count | 0) || kinds.length);
    game.wavePlan = G.Story.plan(game, n);
    let made = 0;
    for (let i = 0; i < n && pts.length; i++) {
      const p = pts[i % pts.length], spread = i >= pts.length ? 1.2 : 0;
      const pos = new THREE.Vector3(p.x + (Math.random() - 0.5) * spread, 0, p.z + (Math.random() - 0.5) * spread);
      const z = game.spawnZombieAt(kinds[i % kinds.length], pos, null);
      if (z) { z.storyGroup = s.id; made++; }
    }
    run.groups[s.id] = made;
    // (the HUD's "zombies left": spawnZombieAt counts each one but a look-alike
    // decoy in spawnedCount; a group comes all at once, so none is still to come)
    game.requiredKills = Math.max(game.requiredKills || 0, game.spawnedCount || 0);
    return made;
  }
  function act(game, run, a) {
    const name = a[0], arg = a[1];
    if (name === "objective") run.objective = arg;
    else if (name === "banner") { if (G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(G.escapeHtml(T(arg)), G.escapeHtml(T(run.scene.title))); }   // (its small line: the scene's name)
    else if (name === "spawn") spawn(game, run, arg || {});
    else if (name === "flag") run.flags.add(String(arg));
    else if (name === "prologueDone") G.Story.prologueDone();
    else if (name === "checkpoint") run.pendingCp = arg || true;
    else if (name === "next") run.pendingNext = true;
    else if (name === "end") run.pendingEnd = true;
  }
  // the objective a scene shows at a beat: the last one a beat before it set
  function objectiveAt(scene, beatI) {
    let obj = scene.objective || "";
    scene.beats.slice(0, beatI).forEach((b) => (b.do || []).forEach((a) => { if (a[0] === "objective") obj = a[1]; }));
    return obj;
  }
  function enter(game, run, sceneI, beatI) {
    const sc = run.ch.scenes[sceneI];
    run.sceneI = sceneI; run.scene = sc; run.beatI = Math.max(0, beatI | 0); run.beatT = 0;
    run.groups = {}; run.groupDone = {};
    run.objective = objectiveAt(sc, run.beatI);
    if (G.Bus) G.Bus.emit("story:scene", { ch: run.ch.id, scene: sc.id, i: sceneI });
  }
  function update(game, run, dt) {
    if (!run || !run.scene || run.over) return;
    run.beatT += dt;
    for (let guard = 0; guard < 8; guard++) {
      const b = run.scene.beats[run.beatI];
      if (!b || !met(game, run, b.wait)) break;
      run.beatI++; run.beatT = 0;
      (b.do || []).forEach((a) => act(game, run, a));
      if (run.pendingNext) { run.pendingNext = false; if (run.sceneI + 1 < run.ch.scenes.length) { enter(game, run, run.sceneI + 1, 0); G.Story.sceneReached(run.sceneI); } else run.pendingEnd = true; }
      if (run.pendingCp) {
        const at = run.pendingCp === true ? null : run.pendingCp;
        run.pendingCp = null;
        G.Story.checkpoint(game, at || run.scene.start || null);
      }
      if (run.pendingEnd) { run.pendingEnd = false; run.over = true; G.Story.finish(game); return; }
    }
    // (decision D11) a wrong shot's speed-up (+25%, js/game.js) ends with the
    // group it happened in: the moment a group is cleared, whoever is still
    // standing (another group) is back to normal speed
    if (G.CONFIG.story.resetSpeed) Object.keys(run.groups).forEach((id) => {
      if (run.groupDone[id] || groupAlive(game, id)) return;
      run.groupDone[id] = true;
      game.zombies.forEach((z) => { if (z.alive) z.speedMultiplier = 1; });
    });
  }
  return { inZone, met, points, spawn, act, objectiveAt, enter, update };
})();
