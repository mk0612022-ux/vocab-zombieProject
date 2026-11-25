// ===================================================================
// Story Mode's scene runner (story series, rounds 1-4)
// -------------------------------------------------------------------
// A chapter's scenes are data (js/data/story/ch*.js). A scene is a list of
// beats, played in order; each beat waits for something, then does things:
//   { wait: <condition>, do: [<action>, ...], cine: "<name>" }
// A condition (none: at once):
//   { zone: id }         the player inside the chapter's zone `id` (an x/z box; with a `y`,
//                        only on that storey -- round 4: the chapter's map has three)
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
//   (round 4)
//   ["teleport", { x, y, z, yaw }]   the player put there (a cut between two moments)
//   ["light", name]      the scene's light set (js/story/storylight.js) changed mid-scene
//   ["door", { id, open }]  a door of the chapter's map opened or shut (js/story/ch1map.js)
// Spawn points and starts may carry a `y` (the storey's floor); a scene's `light` names
// its light set (the time of day), put on as it begins.
//   (round 5: the prologue's tools)
//   { used: id }  that thing used · { quiz: id } that practice exam answered · { qte: id } that
//   press made in time · { arrived: npc } a walk of that person's over · { near: { id, r } } the
//   player within r of that person · { reloaded: true } a reload since the scene began
//   ["npc", { id, ... }] a person of the scene (js/story/cast.js) · ["prop", d] / ["unprop", id]
//   ["use", { id, at, size, prompt }] / ["unuse", id] · ["qte", { id, prompt }] (js/story/interact.js)
//   ["quiz", { id, items }] (js/story/aimquiz.js)
//   ["black", { on }] · ["title", { key, sub }] · ["sound", name] · ["hint", key] · ["shake", s]
//   ["card", { id, title, rows, mark }] (js/story/screen.js)
//   ["arm", true] the gun handed over (a scene with `armed: false` starts with none: js/game.js
//   handsFree) · ["seat", { x, z, yaw } | false] (js/story/storycam.js)
//   ["spawn", { ..., words: [{ word, gloss, who }], target }] a group of the scene's own words,
//   practice (counted nowhere), one of them the target, each in the look `who` gives it
//   (round 6: scenes 1-1 and 1-2)
//   { all: [c, ...] } · { any: [c, ...] } · { not: c }   conditions put together
//   { melee: key } the player holds that melee weapon · { tried: id } a thing that would not
//   (yet) be used was tried · { lock: id } that letter lock open (js/story/wheellock.js) ·
//   { calm: true } no zombie standing (a save point waits for the fight to be over)
//   ["give", { melee } | { ammo: { gun: rounds } }] · ["ammo", { gun: [mag, reserve] }] (what the
//   scene starts with) · ["doors", { ids, prompt, blocked: { id: denyKey } }] the map's doors
//   the player opens (js/story/interact.js: "used:door:<id>") · ["wheel", { id, door, answer,
//   word, clue }] a letter lock on a door · ["drop", { kind, at }] something to pick up
//   A choice's value is a flag as well: "chose:<id>:<value>".
//   (round 7: scenes 1-3 and 1-4)
//   { pushed: id } a thing pushed into place (js/story/push.js -- a scene's `push`) · { picked: id }
//   everything on a cabinet's list taken (js/story/pick.js) · { fired: s } a shot within the last s
//   seconds -- { fired: { s, zone } } one fired from inside that zone (the nurse woken by a gunshot in her room)
//   ["nudge", { id, by }] / ["push", { id, p }] a pushed thing knocked back / put at once ·
//   ["pick", { id, at, items, want, line, title }] a cabinet of labelled things · ["timer", { key, sec }
//   | null] a countdown (between two waves) · ["thud", { at, n, gap }] fists on a door ·
//   ["glass", { at, dir }] a window broken in · ["sfx", { name, at }] a sound of the game's, where it is ·
//   ["callout", { who, at, line }] a shout of where they come from -- ahead, behind, left or right of
//   the player as they stand (G.CONFIG.story lines `<who>Ahead` ...), or `line` ·
//   ["if", { when, do, else }] actions done only if the condition holds now (a wave's start: a door
//   whose shelf is not back in place gives)
//   (round 8: scene 1-5)
//   { boss: id } that mini-boss down (js/story/miniboss.js)
//   ["boss", { id, who, word, gloss, at, decoys, adds, moves, ... }] its fight begins · ["give", { gun,
//   rounds }] a gun found, in the hands at once · ["give", { item }] a thing of the story's, its name
//   across the screen · ["heal", share] · a ["use"] with `holdSec`: held, not pressed
//   A Crawler a scene sends goes under a table's top (js/entities.js lowBand); a scene's `hints`
//   ({ who, after }): someone helps after wrong shots in a row (js/story/story.js onWrongShot).
// A scene's `on` (round 6): rules beside its beats, for what can happen in any order --
//   [{ id, after, when, do }] each fires once, the moment `when` holds (the flag "on:<id>":
//   a checkpoint keeps it); `after` (a flag, or a condition) arms it, and a { time: s } in its
//   `when` counts from then (real time, never the held "faster")
// A scene's `cast` and `props` (js/story/cast.js) are put there as it begins, the last ones gone.
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
    if (Number.isFinite(z.y) && Math.abs(p.y - 1.7 - z.y) > 1.8) return false;      // (round 4: its storey)
    return p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1;
  }
  const groupAlive = (game, id) => game.zombies.some((z) => z.alive && z.storyGroup === id);
  // (a cinematic part being skipped: what only takes time is met at once; `clock`: the time
  // a { time } counts -- the beat's, or a rule's own)
  function met(game, run, cond, skipping, clock) {
    if (!cond) return true;
    // (round 6) put together
    if (cond.all) return cond.all.every((c) => met(game, run, c, skipping, clock));
    if (cond.any) return cond.any.some((c) => met(game, run, c, skipping, clock));
    if (cond.not) return !met(game, run, cond.not, skipping, clock);
    if (cond.zone) return inZone(game, run.ch, cond.zone);
    if (cond.cleared) return run.groups[cond.cleared] != null && !groupAlive(game, cond.cleared);
    if (cond.time != null) return skipping || (clock != null ? clock : run.beatT) >= cond.time;
    if (cond.calm) return !game.zombies.some((z) => z.alive);   // (round 6: no fight going on -- a save point waits for it)
    if (cond.melee) return !!(game.player && game.player.melee === cond.melee);
    if (cond.tried) return run.flags.has("tried:" + cond.tried);
    if (cond.lock) return run.flags.has("lock:" + cond.lock);
    if (cond.flag) return run.flags.has(cond.flag);
    if (cond.said) return skipping || !G.StoryDialogue.busy();
    if (cond.chosen) return run.flags.has("chose:" + cond.chosen);
    if (cond.looked) return skipping || !G.StoryCam.turning;
    if (cond.walked) return skipping || !G.StoryCam.walking;
    if (cond.read) return run.flags.has("read:" + cond.read);
    // (round 5)
    if (cond.used) return run.flags.has("used:" + cond.used);
    if (cond.quiz) return run.flags.has("quiz:" + cond.quiz);
    if (cond.qte) return run.flags.has("qte:" + cond.qte);
    if (cond.card) return run.flags.has("card:" + cond.card);
    if (cond.arrived) return skipping || !!(G.StoryCast && G.StoryCast.arrived(cond.arrived));
    if (cond.near) return !!(G.StoryCast && G.StoryCast.near(game, cond.near.id, cond.near.r || 2));
    if (cond.reloaded) return run.flags.has("reloaded");
    // (round 7)
    if (cond.pushed) return run.flags.has("pushed:" + cond.pushed);
    if (cond.picked) return run.flags.has("pick:" + cond.picked);
    if (cond.boss) return run.flags.has("boss:" + cond.boss);          // (round 8)
    if (cond.fired != null) {
      // (a number: any shot that recent; { s, zone }: one fired from inside the zone)
      const s = typeof cond.fired === "object" ? cond.fired.s : cond.fired;
      if (run.lastShot == null || run.time - run.lastShot > s) return false;
      if (typeof cond.fired === "object" && cond.fired.zone) { const z = run.ch.zones && run.ch.zones[cond.fired.zone], p = run.lastShotPos;
        return !!(z && p && p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1 && (!Number.isFinite(z.y) || Math.abs(p.y - 1.7 - z.y) <= 1.8)); }
      return true;
    }
    return false;
  }
  // a spawn's id (or several, or points as they are) -> the points
  function points(ch, at) {
    const out = [];
    [].concat(at || []).forEach((a) => { [].concat(typeof a === "string" ? (ch.spawns || {})[a] || [] : [a]).forEach((p) => out.push(p)); });
    return out.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  }
  // (round 5) a scene's own words: [word, its meaning in the player's meaning language]
  const ownPair = (w) => [w.word, (G.StoryQuiz ? G.StoryQuiz.glossOf(w.gloss) : "") || w.word];
  // the target made the one asked (its meaning in the word box), as js/game.js
  // ensureTargetHasMatch would set it -- which then keeps it while it is on the field
  function aimAt(game, pair) {
    game.targetPair = [pair[0], pair[1]];
    game.targetPair.id = pair[0];
    game.targetClue = { kind: "thai", pair, cloze: null, full: "", played: 0, thaiShown: false };
    game._attempt = { key: pair[0], wrong: false, assisted: false, retry: false };
    game.ensureTargetHasMatch();
  }
  function spawn(game, run, s) {
    const pts = points(run.ch, s.at), C = G.CONFIG.story;
    const kinds = s.kinds && s.kinds.length ? s.kinds : C.groupKinds;
    const words = s.words && s.words.length ? s.words : null;
    const n = words ? words.length : Math.max(1, (s.count | 0) || kinds.length);
    if (!words) game.wavePlan = G.Story.plan(game, n);
    let made = 0, target = null;
    for (let i = 0; i < n && pts.length; i++) {
      const p = pts[i % pts.length], spread = i >= pts.length ? 1.2 : 0;
      const pos = new THREE.Vector3(p.x + (Math.random() - 0.5) * spread, Number.isFinite(p.y) ? p.y : 0, p.z + (Math.random() - 0.5) * spread);
      const type = kinds[i % kinds.length];
      let o;
      if (words) {
        const w = words[i], pair = ownPair(w);
        o = { pair, practice: true, look: w.who && G.VoxelChars && G.VoxelChars.on() ? G.VoxelChars.zombieLook(type, game, w.who) : null };
        if (w.word === s.target) target = pair;
      }
      const z = game.spawnZombieAt(type, pos, null, o);
      if (z) { z.storyGroup = s.id; made++; if (type === "crawler") z.lowBand = C.crawlerBand || 0.55; }   // (round 7: under a table's top)
    }
    // (the target the scene names, not one picked at random: the prologue's question 4)
    if (target) aimAt(game, target);
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
      run.flags.add("chose:" + id + ":" + v);          // (round 6: which one -- a rule can answer it)
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
    else if (name === "unflag") run.flags.delete(String(arg));          // (round 5: "reloaded" again from now)
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
    else if (name === "sys") {
      const o = typeof arg === "string" ? { key: arg } : arg || {};
      const v = Object.assign(G.Story.vars(), o.vars || {});
      // (round 5: a practice word's meaning in the player's meaning language -- "Shoot the word that means ...")
      if (o.meaningOf && G.StoryQuiz) v.meaning = G.StoryQuiz.glossOf((run.ch.practice || {})[o.meaningOf]) || o.meaningOf;
      G.LexiLens.sys(o.key, v, o);
    }
    // (round 4) the chapter's map: a cut, the time of day, a door
    else if (name === "teleport") { const p = arg || {}; game.teleportPlayer(new THREE.Vector3(p.x, Number.isFinite(p.y) ? p.y : 0, p.z)); if (Number.isFinite(p.yaw)) game.yawObject.rotation.y = p.yaw; }
    else if (name === "light") { if (G.StoryLight) G.StoryLight.apply(game, arg); }
    else if (name === "door") { const o = arg || {}, m = game.world && game.world.storyMap; if (m && m.door) m.door(o.id, o.open !== false); }
    // (round 5) the prologue's tools
    else if (name === "npc") { if (G.StoryCast) G.StoryCast.act(game, run, arg); }
    else if (name === "prop") { if (G.StoryCast) G.StoryCast.prop(game, arg); }
    else if (name === "unprop") { if (G.StoryCast) G.StoryCast.unprop(game, arg); }
    else if (name === "use") { if (G.StoryUse) G.StoryUse.add(game, arg); }
    else if (name === "unuse") { if (G.StoryUse) G.StoryUse.remove(game, arg); }
    else if (name === "qte") { if (G.StoryUse) G.StoryUse.qte(game, arg); }
    else if (name === "quiz") { if (G.StoryQuiz) G.StoryQuiz.start(game, arg); }
    else if (name === "black") { if (G.StoryScreen) G.StoryScreen.setBlack(arg); }
    else if (name === "title") { if (G.StoryScreen) G.StoryScreen.showTitle(arg); }
    else if (name === "sound") { if (G.StoryScreen) G.StoryScreen.sound(arg); }
    else if (name === "hint") { if (G.StoryScreen) G.StoryScreen.setHint(arg); }
    else if (name === "shake") { if (G.StoryScreen) G.StoryScreen.shake(game, arg); }
    else if (name === "card") { if (G.StoryScreen) G.StoryScreen.card(game, run, arg); }
    else if (name === "arm") G.Story.arm(game, arg !== false);
    else if (name === "seat") { if (G.StoryCam) G.StoryCam.seat(game, arg); }
    // (round 6) scenes 1-1 and 1-2: what is found, the doors the player opens, the letter lock
    else if (name === "give") give(game, arg || {});
    else if (name === "ammo") { const pl = game.player; Object.keys(arg || {}).forEach((g) => { const a = pl && pl.ammo[g], v = arg[g]; if (a && Array.isArray(v)) { a.mag = Math.max(0, v[0] | 0); a.reserve = Math.max(0, v[1] | 0); } }); }
    else if (name === "doors") { if (G.StoryUse) G.StoryUse.doors(game, arg || {}); }
    else if (name === "wheel") { if (G.StoryLock) G.StoryLock.add(game, arg || {}); }
    else if (name === "drop") { const o = arg || {}, p = o.at || {}; if (game.spawnDrop) game.spawnDrop(o.kind || "ammo", new THREE.Vector3(p.x || 0, Number.isFinite(p.y) ? p.y : 0, p.z || 0)); }
    // (round 7) scenes 1-3 and 1-4: shelves pushed, a cabinet, a countdown, doors banged on, glass, shouts
    else if (name === "nudge") { if (G.StoryPush) G.StoryPush.nudge(game, arg || {}); }
    else if (name === "push") { if (G.StoryPush) G.StoryPush.set(game, arg || {}); }
    else if (name === "pick") { if (G.StoryPick) G.StoryPick.add(game, arg || {}); }
    else if (name === "timer") { if (G.StoryScreen && G.StoryScreen.setTimer) G.StoryScreen.setTimer(arg || null); }
    else if (name === "thud") { if (G.StoryScreen && G.StoryScreen.thudAt) G.StoryScreen.thudAt(arg || {}); }
    else if (name === "glass") { if (G.StoryScreen && G.StoryScreen.glass) G.StoryScreen.glass(game, arg || {}); }
    else if (name === "sfx") { const o = arg || {}, p = o.at; if (G.Audio && G.Audio.sfx && o.name) G.Audio.sfx(o.name, p ? { pos: new THREE.Vector3(p.x || 0, (Number.isFinite(p.y) ? p.y : 0) + (o.lift != null ? o.lift : 1.2), p.z || 0) } : {}); }
    else if (name === "callout") callout(game, run, arg || {});
    else if (name === "boss") { if (G.StoryBoss) G.StoryBoss.start(game, run, arg || {}); }      // (round 8)
    else if (name === "heal") { const pl = game.player; if (pl) pl.hp = Math.max(pl.hp, pl.maxHp * (arg === true || arg == null ? 1 : +arg)); }      // (round 8: a meal and a rest)
    else if (name === "if") { const o = arg || {}; ((met(game, run, o.when) ? o.do : o.else) || []).forEach((x) => act(game, run, x)); }
  }
  // (round 7) a shout of where they come from: ahead, behind, left or right of the player as they stand
  // now -- the spawn's points' middle against the way the player faces (G.StoryDialogue, the box's
  // line; the shouter's head and hand moving with it)
  function callout(game, run, o) {
    const who = o.who || "fai";
    let line = o.line || null;
    if (!line) {
      const pts = points(run.ch, o.at);
      if (!pts.length) return;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
      const pp = game.yawObject.position, yaw = game.yawObject.rotation.y;
      const dx = cx - pp.x, dz = cz - pp.z;
      const f = dx * -Math.sin(yaw) + dz * -Math.cos(yaw), r = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      const k = Math.abs(f) >= Math.abs(r) ? (f >= 0 ? "Ahead" : "Behind") : (r >= 0 ? "Right" : "Left");
      line = (o.lines && o.lines[k.toLowerCase()]) || "story." + run.ch.id + ".d." + who + k;
      run.lastCallout = k.toLowerCase();
    }
    if (G.StoryCast && G.StoryCast.get(who)) G.StoryCast.act(game, run, { id: who, talk: 1.4 });
    G.StoryDialogue.say([withVars({ who, line })]);
  }
  // something found: a melee weapon into the slot (its name across the screen), or rounds for a gun
  function give(game, o) {
    const pl = game.player;
    if (!pl) return;
    if (o.melee && G.Melee && G.MELEE_WEAPONS && G.MELEE_WEAPONS[o.melee]) {
      G.Melee.give(game, o.melee);
      if (G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(esc(T("melee.name." + o.melee)), esc(T("story.give.found")));
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("pickup");
    }
    // (round 8) a gun -- Sgt. Chai's shotgun: into the hands at once, loaded, `rounds` more with it; one
    // already carried is its rounds
    if (o.gun && G.WEAPON_DEFS[o.gun] && G.Loadout) {
      const def = G.WEAPON_DEFS[o.gun], more = Math.max(0, o.rounds | 0);
      if (!pl.gunSlots.includes(o.gun)) {
        G.Loadout.add(game, o.gun, { ammo: { mag: def.magSize, reserve: more }, levels: { dmg: 1, rate: 1, mag: 1 } });
        if (game.wsm && game.wsm.requestSwitch) game.wsm.requestSwitch();
      } else if (pl.ammo[o.gun]) pl.ammo[o.gun].reserve += def.magSize + more;
      if (G.UI.pulseHudStat) G.UI.pulseHudStat("ammo");
      if (G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(esc(def.name || o.gun), esc(T("story.give.found")));
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("pickup");
    }
    // (round 8) a thing of the story's (a box of supplies): its name across the screen
    if (o.item) {
      if (G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(esc(T(o.item)), esc(T(o.note || "story.give.found")));
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("pickup");
    }
    if (o.ammo) Object.keys(o.ammo).forEach((g) => {
      const a = pl.ammo[g], n = Math.max(0, o.ammo[g] | 0);
      if (!a || !n) return;
      a.reserve += n;
      if (G.UI.pulseHudStat) G.UI.pulseHudStat("ammo");
      if (G.UI.flashPurchaseBanner) G.UI.flashPurchaseBanner(esc(T("story.give.ammo", { n })), esc(T("story.give.found")));
      if (G.Audio && G.Audio.sfx) G.Audio.sfx("pickup");
    });
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
    run.ruleT = {};                                  // (round 6: its rules' own clocks)
    run.objective = objectiveAt(sc, run.beatI);
    // how it starts: the HUD's parts and the glasses (round 2)
    if (G.LexiLens) { G.LexiLens.parts(sc.hud || "all", { quiet: true }); G.LexiLens.theme(sc.lens !== false); }
    if (G.StoryCam) { G.StoryCam.lock(false); G.StoryCam.bars(false); }
    // (round 4) its time of day, and the doors as the scene wants them
    if (G.StoryLight) G.StoryLight.apply(game, sc.light || run.ch.light || null);
    const map = game.world && game.world.storyMap;
    if (map && map.door && sc.doors) Object.keys(sc.doors).forEach((id) => map.door(id, !!sc.doors[id]));
    // (round 5) its people and things; nothing of the last scene's to use or answer; the gun
    // in the hands -- or not (the prologue's first five parts)
    if (G.StoryCast) G.StoryCast.enter(game, run, sc);
    if (G.StoryUse) G.StoryUse.reset(game);
    if (G.StoryQuiz) G.StoryQuiz.reset(game);
    if (G.StoryLock) G.StoryLock.reset(game);           // (round 6: the last scene's letter locks)
    if (G.StoryBoss) { G.StoryBoss.reset(game); if (sc.boss) G.StoryBoss.warm(game); }     // (round 8: the last scene's mini-boss, where he fell; this one's shaders)
    // (round 7) the last scene's cabinet and countdown gone; what this one pushes into place put there
    if (G.StoryPick) G.StoryPick.reset(game);
    if (G.StoryScreen && G.StoryScreen.setTimer) G.StoryScreen.setTimer(null);
    if (G.StoryPush) G.StoryPush.enter(game, run, sc);
    if (G.StoryCam) G.StoryCam.seat(game, false);
    G.Story.arm(game, sc.armed !== false, true);
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
      if (settle(game, run)) return;
    }
    if (!run.over) rules(game, run, dt);
    // (decision D11) a wrong shot's speed-up (+25%, js/game.js) ends with the
    // group it happened in: the moment a group is cleared, whoever is still
    // standing (another group) is back to normal speed
    if (G.CONFIG.story.resetSpeed) Object.keys(run.groups).forEach((id) => {
      if (run.groupDone[id] || groupAlive(game, id)) return;
      run.groupDone[id] = true;
      game.zombies.forEach((z) => { if (z.alive) z.speedMultiplier = 1; });
    });
  }
  // ---------------- a scene's rules (round 6) ----------------
  // beside the beats: what the player may come to in any order -- a room off the way, a
  // locker, a door tried too early, a hint once a minute has gone by. Each fires once.
  function rules(game, run, dt) {
    const list = run.scene && run.scene.on;
    if (!list || !list.length) return;
    const sc = run.scene;
    for (let i = 0; i < list.length; i++) {
      const r = list[i], id = r.id || "r" + i;
      if (run.flags.has("on:" + id)) continue;
      if (r.after && !met(game, run, typeof r.after === "string" ? { flag: r.after } : r.after)) continue;
      const t = (run.ruleT[id] = (run.ruleT[id] || 0) + dt);
      if (!met(game, run, r.when, false, t)) continue;
      run.flags.add("on:" + id);
      (r.do || []).forEach((a) => act(game, run, a));
      // (an action that ends the scene -- or the chapter -- ends this frame's rules with it)
      if (run.scene !== sc || run.over || run.pendingNext || run.pendingEnd) break;
    }
    // (a rule's `next`, `checkpoint` or `end`: done as a beat's are)
    settle(game, run);
  }
  // what a beat's (or a rule's) actions asked for once they are all done: the next scene, a
  // checkpoint (with `next`, at the next scene's start), the chapter's end -> true: it is over
  function settle(game, run) {
    if (run.pendingNext) { run.pendingNext = false; if (run.sceneI + 1 < run.ch.scenes.length) { prune(run); enter(game, run, run.sceneI + 1, 0); G.Story.sceneReached(run.sceneI); } else run.pendingEnd = true; }
    if (run.pendingCp) {
      const at = run.pendingCp === true ? null : run.pendingCp;
      run.pendingCp = null;
      G.Story.checkpoint(game, at || run.scene.start || null);
    }
    if (run.pendingEnd) { run.pendingEnd = false; run.over = true; G.Story.finish(game); return true; }
    return false;
  }
  // a scene left for the next: what only its beats and rules asked about goes with it (a
  // checkpoint keeps 120 flags -- for what lasts the chapter: the phone's messages, the choices)
  // (round 7: "x:<name>" a scene's own plain flag -- "x:wave1" -- gone with it too: a later scene may use the name)
  const LOCAL = /^(x|on|used|tried|card|quiz|qte|lock|lockwrong|lockopen|pushed|pick|picked|pickwrong|boss):/;
  function prune(run) { Array.from(run.flags).forEach((f) => { if (LOCAL.test(f)) run.flags.delete(f); }); }
  return { inZone, met, points, spawn, aimAt, act, objectiveAt, enter, update, canSkip, skip, seenKey };
})();
