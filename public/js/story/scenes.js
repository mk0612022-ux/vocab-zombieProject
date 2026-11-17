// ===================================================================
// Story Mode's scene runner (story series, rounds 1-2)
// -------------------------------------------------------------------
// A chapter's scenes are data (js/data/story/ch*.js). A scene is a list of
// beats, played in order; each beat waits for something, then does things:
//   { wait: <condition>, do: [<action>, ...], cine: "<name>" }
// A condition (none: at once):
//   { zone: id }         the player inside the chapter's zone `id` (an x/z box, any height)
//   { cleared: group }   every zombie of that group down (once it was sent)
//   { time: s }          s seconds of play since the beat before (held: faster)
//   { flag: name }       a flag set (by an action; later rounds: a puzzle, a pick-up)
//   (round 2)
//   { said: true }       every line said (js/story/dialogue.js)
//   { chosen: id }       the choice `id` made
//   { looked: true }     the view's turn over; { walked: true } the walk over (js/story/storycam.js)
//   { read: contact }    that conversation opened on the phone (js/story/phone.js)
// An action, [name, argument]:
//   ["objective", key]   the scene's objective (shown in the HUD's top box)
//   ["banner", key]      a line across the screen
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
//   (round 2)
//   ["say", [{ who, line, vars }, ...]]   lines (G.StoryDialogue; {name} = the candidate's)
//   ["ask", { id, who, line, options, quiz, then, right, wrong }]   a choice; `then[i]`: the lines
//                        after option i, `right` / `wrong`: after a quiz's answer; the value is kept
//                        in the chapter's save (choices) and as the flag "chose:<id>"
//   ["phone", id] / ["notify", id]   a message / a notification arrives (G.StoryPhone)
//   ["torch", on]        the phone's torch on or off
//   ["look", { x, y, z, sec } | { at: spawn, sec }]   the view turns (G.StoryCam)
//   ["lock", on] · ["walk", { x, z, speed }] · ["bars", on] · ["slow", sec]
//   ["hud", "none" | "all" | [parts]]   the LexiLens HUD's parts (G.LexiLens)
//   ["lens", on] · ["glitch", sec] · ["sys", key | { key, vars, dur, glitch }]
// A beat that has been met never waits again, so a few can pass in one frame.
// Cinematic parts: beats sharing a `cine` name. Once the player has seen one to its end
// (G.save.tutorialSeen["story_<chapter>_<name>"]), holding Space / A / a finger skips the
// rest of it: its waits for lines, turns, walks and time pass at once, its other actions
// still happen (the HUD, the flags). A choice is never inside one.
// A scene's start: its `hud` ("all" when it says nothing) and `lens` (on unless false).
// ===================================================================
window.G = window.G || {};

G.StoryScenes = (function () {
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));

  function inZone(game, ch, id) {
    const z = ch.zones && ch.zones[id];
    if (!z) return false;
    const p = game.yawObject.position;
    return p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1;
  }
  const groupAlive = (game, id) => game.zombies.some((z) => z.alive && z.storyGroup === id);
  // (a cinematic part being skipped: what only takes time is met at once)
  function met(game, run, cond, skipping) {
    if (!cond) return true;
    if (cond.zone) return inZone(game, run.ch, cond.zone);
    if (cond.cleared) return run.groups[cond.cleared] != null && !groupAlive(game, cond.cleared);
    if (cond.time != null) return skipping || run.beatT >= cond.time;
    if (cond.flag) return run.flags.has(cond.flag);
    if (cond.said) return skipping || !G.StoryDialogue.busy();
    if (cond.chosen) return run.flags.has("chose:" + cond.chosen);
    if (cond.looked) return skipping || !G.StoryCam.turning;
    if (cond.walked) return skipping || !G.StoryCam.walking;
    if (cond.read) return run.flags.has("read:" + cond.read);
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
  // a line's {name} and the like (G.Story.vars) under the line's own
  const withVars = (it) => (typeof it === "string" ? { line: it, vars: G.Story.vars() } : Object.assign({}, it, { vars: Object.assign(G.Story.vars(), it.vars || {}) }));
  function ask(game, run, o) {
    const id = String(o.id || "c" + run.beatI);
    G.StoryDialogue.ask(Object.assign({}, o, { vars: Object.assign(G.Story.vars(), o.vars || {}) }), (i, op) => {
      const v = op.value != null ? String(op.value) : String(i);
      G.Story.chose(id, v);
      run.flags.add("chose:" + id);
      const after = (o.then && o.then[i]) || (o.quiz ? (op.right ? o.right : o.wrong) : null);
      if (after) G.StoryDialogue.say([].concat(after).map(withVars));
    });
  }
  function act(game, run, a) {
    const name = a[0], arg = a[1];
    if (name === "objective") run.objective = arg;
    else if (name === "banner") { if (G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(esc(T(arg)), esc(T(run.scene.title))); }   // (its small line: the scene's name)
    else if (name === "spawn") spawn(game, run, arg || {});
    else if (name === "flag") run.flags.add(String(arg));
    else if (name === "prologueDone") G.Story.prologueDone();
    else if (name === "checkpoint") run.pendingCp = arg || true;
    else if (name === "next") run.pendingNext = true;
    else if (name === "end") run.pendingEnd = true;
    // (round 2) the narrative tools
    else if (name === "say") G.StoryDialogue.say([].concat(arg || []).map(withVars));
    else if (name === "ask") ask(game, run, arg || {});
    else if (name === "phone") G.StoryPhone.deliver(arg);
    else if (name === "notify") G.StoryPhone.notify(arg);
    else if (name === "torch") G.StoryPhone.torch(!!arg);
    else if (name === "look") { const o = arg || {}, p = o.at ? points(run.ch, o.at)[0] : o; if (p) G.StoryCam.look(game, { x: p.x, y: o.y != null ? o.y : p.y, z: p.z }, o.sec); }
    else if (name === "lock") G.StoryCam.lock(!!arg);
    else if (name === "walk") G.StoryCam.walk(game, arg, arg);
    else if (name === "bars") G.StoryCam.bars(!!arg);
    else if (name === "slow") G.StoryCam.slow(game, arg);
    else if (name === "hud") G.LexiLens.parts(arg);
    else if (name === "lens") G.LexiLens.theme(!!arg);
    else if (name === "glitch") G.LexiLens.glitch(arg);
    else if (name === "sys") { const o = typeof arg === "string" ? { key: arg } : arg || {}; G.LexiLens.sys(o.key, Object.assign(G.Story.vars(), o.vars || {}), o); }
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
    run.groups = {}; run.groupDone = {}; run.skipping = null;
    run.objective = objectiveAt(sc, run.beatI);
    // how it starts: the HUD's parts and the glasses (round 2)
    if (G.LexiLens) { G.LexiLens.parts(sc.hud || "all", { quiet: true }); G.LexiLens.theme(sc.lens !== false); }
    if (G.StoryCam) { G.StoryCam.lock(false); G.StoryCam.bars(false); }
    if (G.Bus) G.Bus.emit("story:scene", { ch: run.ch.id, scene: sc.id, i: sceneI });
  }
  // ---------------- cinematic parts ----------------
  const seenKey = (run, name) => "story_" + run.ch.id + "_" + name;
  const beatNow = (run) => run.scene && run.scene.beats[run.beatI];
  function canSkip(run) {
    const b = run && !run.over && beatNow(run);
    return !!(b && b.cine && !run.skipping && G.save.tutorialSeen && G.save.tutorialSeen[seenKey(run, b.cine)]);
  }
  function skip(game, run) {
    const b = beatNow(run);
    if (!b || !b.cine) return false;
    run.skipping = b.cine;
    G.StoryDialogue.clear();
    G.StoryCam.finish(game);
    return true;
  }
  // a cinematic part played (or skipped) to its end: seen, so it can be skipped next time
  function seen(run, name) {
    const ts = G.save.tutorialSeen || (G.save.tutorialSeen = {});
    if (!ts[seenKey(run, name)]) { ts[seenKey(run, name)] = true; G.persist(); }
  }

  function update(game, run, dt) {
    if (!run || !run.scene || run.over) return;
    run.beatT += dt * (G.StoryDialogue ? G.StoryDialogue.fast() : 1);
    for (let guard = 0; guard < (run.skipping ? 60 : 8); guard++) {
      const b = run.scene.beats[run.beatI];
      const skipping = !!(b && run.skipping && b.cine === run.skipping);
      if (run.skipping && !skipping) run.skipping = null;
      if (!b || !met(game, run, b.wait, skipping)) break;
      run.beatI++; run.beatT = 0;
      (b.do || []).forEach((a) => act(game, run, a));
      if (skipping) { G.StoryDialogue.clear(); G.StoryCam.finish(game); }
      const nb = run.scene.beats[run.beatI];
      if (b.cine && (!nb || nb.cine !== b.cine)) seen(run, b.cine);
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
  return { inZone, met, points, spawn, act, objectiveAt, enter, update, canSkip, skip, seenKey };
})();
