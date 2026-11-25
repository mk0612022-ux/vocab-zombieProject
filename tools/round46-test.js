// Dev-only (not shipped). The story series' round 8: Chapter 1's scene 1-5 "Supply Run", played
// through by its own inputs (the interaction ray, the button held to take a box -- the key, a
// finger, the controller's Y -- the trigger, doors opened by hand) -- and what it is made of:
// Coach Ek (js/story/miniboss.js: his charge, ball and Sprinters, the question when he is
// stunned, his fall), js/story/push.js' boxes, js/story/interact.js holdSec, scenes.js' new
// condition and actions, storycam.js' fall, screen.js' ticking, the gym of the map.
//   A  1-5's start: two hours on (a cut: 12:30), the library at noon, the four; Kru Min's errand
//      ("essential" to tap); the back door opened
//   B  the canteen: the first wave (7, Sprinters among them) as the player gets to the foot of the
//      back stairs; they come the whole way; shot; Kru Min: "Water is scarce..."
//   C  the kitchen's three boxes: a press alone does nothing; let go, it runs back; two seconds held
//      (the key; a finger; the controller's Y); the second wave in two parts up from the back
//      stairs -- 15 in the two; the back door not before the third box
//   D  the walkway: the save before the gym; a stopwatch ticking; the gym's door by hand
//   E  the gym: the door shut behind, the view turned to Coach Ek, the glasses' warning
//   F  FASTER: the stopwatch up, the shout, his bar; four Sprinters in PE kit out of the locker room,
//      FASTEN and FOSTER among them; what comes near him is sped up, what is not is not
//   G  shots do nothing to him (and say what would)
//   H  the charge: three beeps, the lane, held from the third; the player in it: hurt, thrown, off the
//      feet and up again; he is not stunned by that
//   I  dodged: the wall -- stunned; the glasses ask for his word (its meaning in the player's language)
//      among FASTEN and FOSTER; FASTEN shot: wrong (its card; counted nowhere); faster, by the trigger:
//      right 1 -- his bar, the glasses, its card; counted nowhere; let go of after 4 seconds
//   J  the vaulting box stuns him too; the ball: in the open a hit, behind the stands none
//   K  the third answer: he falls and lies there, the stopwatch beside him ticking on; picked up
//   L  the Sprinters left cleared: the north door; Sgt. Chai's car: the shotgun in the hands, its
//      rounds, the radio, a save; fired at the five in the gym
//   M  the library: Tonkla; a cut to 17:00, the light gold; "It's time."; the save, scene 1-6
//   N  the saves picked up: the walkway's (the boxes gone, the doors); a death in the gym and the
//      retry (nothing of the fight left); the car's (the shotgun kept)
//   O  around it: a practice word asked counts nowhere whichever zombie is shot; the locker room can be
//      left, the kitchen's back door reached; draw calls; the words and strings; the campaign after
// Load it into the game (in the lobby), then:
//   const r = await G.Round46Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round46Test = (function () {
  const yield0 = () => new Promise((r) => setTimeout(r, 0));

  async function run() {
    const results = [], errs = [], numbers = {}, trace = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t46 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, CAST = G.StoryCast, USE = G.StoryUse, PUSH = G.StoryPush, SCR = G.StoryScreen, LL = G.LexiLens, D = G.StoryDialogue, BO = G.StoryBoss;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, speak0 = G.Audio.speak, pad0 = G.Input.pollGamepad;
    const real = g._update0 || g.update;
    const kb = G.save.settings.keybinds;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const mode0 = G.Input.mode;
    G.Audio.speak = function () {};
    let frames = 0, god = true;
    const step = (n, dt) => { for (let i = 0; i < n; i++) { real.call(g, dt || 1 / 60); frames++; if (god && g.player && g.player.hp < g.player.maxHp * 0.35) g.player.hp = g.player.maxHp; } };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const run0 = () => S.run;
    const has = (f) => !!(S.run && S.run.flags.has(f));
    const at = (x, y, z) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    const me = () => g.yawObject.position;
    const look = (x, y, z) => { const e = me(), dx = x - e.x, dz = z - e.z, dy = y - e.y; g.yawObject.rotation.y = Math.atan2(-dx, -dz); g.pitchObject.rotation.x = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz)))); g.yawObject.updateMatrixWorld(true); };
    const until = async (fn, n) => { for (let i = 0; i < (n || 600); i++) { if (fn()) return true; step(1); if (i % 40 === 39) await yield0(); } return !!fn(); };
    const note = (tag) => trace.push(tag + "@" + (S.run ? S.run.scene.id + ":" + S.run.beatI : "-") + "/" + frames);
    const promptText = () => ((document.getElementById("hud-interact-prompt") || {}).innerText || "").trim();
    const useAt = (x, y, z) => { look(x, y, z); step(1); g.updateInteractRay(); const p = promptText(); g.doInteract(); step(1); return p; };
    const key = (code) => G.onKeyDown({ code, repeat: false, preventDefault() {}, stopPropagation() {} });
    const fast = (on) => { G.Input.keys[kb.jump] = !!on; };
    const said = async (n) => { fast(true); const r = await until(() => !D.busy(), n || 900); fast(false); return r; };
    const alive = () => g.zombies.filter((z) => z.alive);
    const kill = (keep) => { alive().forEach((z) => { if (keep && keep(z)) return; g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false }); }); step(3); };
    const stat = (w) => { const s = G.save.wordStats && G.save.wordStats[w]; const l = G.save.learn && G.save.learn[w]; return JSON.stringify([s || null, l || null]); };
    const M = () => g.world.storyMap;
    const doorOpen = (id) => !!(M().doors[id] && M().doors[id].open);
    const f2 = (v) => +(+v).toFixed(2);
    const dist = (z) => Math.hypot(z.mesh.position.x - me().x, z.mesh.position.z - me().z);
    const el = (id) => document.getElementById(id);
    const hid = (id) => !el(id) || el(id).classList.contains("hidden");
    const heard = [];        // (every line said, as it comes up)
    const born = [];         // (where each zombie came into the world)
    const spawn0 = g.spawnZombieAt;
    g.spawnZombieAt = function (type, pos) { born.push({ type, x: pos.x, z: pos.z, f: frames }); return spawn0.apply(this, arguments); };
    const shoot = async (z, tries) => {
      for (let i = 0; i < (tries || 30) && z.alive; i++) {
        const n = z.mesh.userData.neck, p = new THREE.Vector3(); (n || z.mesh).getWorldPosition(p); p.y += n ? 0.22 : 1.5;
        look(p.x, p.y, p.z); step(1);
        g.player.fireCooldown = 0; G.onFirePress(); step(2);
        const a = g.player.ammo[g.currentWeaponId()]; if (a && a.mag <= 0) a.mag = 6;
        for (let k = 0; k < 8; k++) step(1);
        await yield0();
      }
      return !z.alive;
    };
    const boss = (z) => !!z.storyBoss;
    const ek = () => BO.z;
    const btn = (on) => ({ pressed: !!on, value: on ? 1 : 0 });
    const pad = (b) => ({ id: "test pad", connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => btn(b.includes(i))) });
    let gp = pad([]);
    const HOLD = {
      key: (on) => { G.Input.keys[kb.interact] = !!on; },
      touch: (on) => { G.Input.touchInteractHeld = !!on; },
      pad: (on) => { gp = pad(on ? [3] : []); G.Pad.poll(1 / 60); },
    };
    const BOX = { boxWater: { at: [-49.6, -22.4], look: [-50.6, -21.4] }, boxFood: { at: [-45.0, -21.8], look: [-45.0, -20.5] }, boxTorch: { at: [-41.4, -22.2], look: [-40.5, -21.2] } };
    const holdBox = (id, n, how) => {
      const b = BOX[id];
      let k = 0;
      for (; k < n && !has("used:" + id); k++) { look(b.look[0], 0.5, b.look[1]); g.updateInteractRay(); HOLD[how](true); step(1); }
      HOLD[how](false);
      return k;
    };
    const say0 = D.say;

    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
      G.Input.mode = "desktop";
      if (G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality(); }
      const t0 = performance.now();
      D.say = function (list) { [].concat(list || []).forEach((it) => heard.push(typeof it === "string" ? it : it.line)); return say0.apply(this, arguments); };

      // ================= A: the start, the errand =================
      {
        play(() => S.start("ch1", { scene: 5, beat: 0, skip: true }));
        const r = run0();
        ok("A 1-5 Supply Run: two hours on -- a cut: the screen black, the time (12:30), the library at noon", r.scene.id === "s5" && SCR.state.black && SCR.state.title && /12:30/.test(el("story-title").innerText) && /Two hours later/.test(el("story-title").innerText) && G.StoryLight.current === "noon" && Math.abs(me().y - 5.7) < 0.3, (el("story-title") || {}).innerText);
        ok("A Kru Min, Tonkla, Fai and Nam there; nobody to fight; the back door shut, its shelf aside", ["min", "tonkla", "fai", "nam"].every((id) => CAST.get(id) && !CAST.get(id).hidden) && !alive().length && !doorOpen("LIBBACK") && CAST.propIds().includes("backShelf"));
        ok("A the fight's marks made ready as the scene begins (nothing of them drawn)", r.scene.boss && G.BossFX.scene === g.scene && G.BossFX.decals.length >= 2 && G.BossFX.decals.every((d) => !d.on) && !G.BossFX.debris.visible && !G.BossFX.motes.visible);
        ok("A Coach Ek out of sight (in the gym), the kitchen's three boxes there", CAST.get("ek") && CAST.get("ek").hidden && ["boxWater", "boxFood", "boxTorch"].every((id) => CAST.propIds().includes(id)));
        await until(() => D.current && D.current.line === "story.ch1.d.minSupply", 600);
        step(2);
        const words = Array.from(document.querySelectorAll("#story-dlg .sd-word")).map((w) => w.innerText.toLowerCase());
        ok("A the light back on; \"We need water, food, and anything useful. Only take what's essential.\" -- essential to tap", !SCR.state.black && SCR.state.loops.includes("calm") && /Only take what's essential/.test(el("sd-line").innerText) && words.includes("essential"), words.join());
        await said();
        step(3);
        ok("A the back door opened; the objective: down the back stairs to the canteen", doorOpen("LIBBACK") && run0().objective === "story.ch1.s5.obj1" && !SCR.state.loops.includes("calm"));
        note("A");
      }

      // ================= B: the canteen's first wave =================
      {
        ok("B on the way down nobody yet", !alive().length);
        at(-45.5, 0, 5); step(2);
        const w1 = alive().filter((z) => z.storyGroup === "w1"), b = born.slice(-7);
        ok("B at the foot of the back stairs: the first wave -- seven (Sprinters among them), in the canteen and the kitchen", w1.length === 7 && w1.filter((z) => z.type === "fast").length === 2 && b.length === 7 && b.every((q) => q.z < -5 && q.x < -40), JSON.stringify(b.map((q) => [q.type, f2(q.x), f2(q.z)])));
        ok("B ...the glasses' line, the music up, the objective", LL.line && LL.line.key === "story.ch1.sys.canteen" && SCR.state.loops.includes("tense") && run0().objective === "story.ch1.s5.objC", LL.line && LL.line.key);
        ok("B ...boxes of rounds and one of health about", g.drops.filter((d) => d.kind === "ammo").length >= 3 && g.drops.some((d) => d.kind === "health"), g.drops.map((d) => d.kind).join());
        // they come the whole way
        await until(() => w1.filter((z) => dist(z) < 3).length >= 5, 1700);
        ok("B they come all the way to the player (through the canteen, the lobby, the stairs' door)", w1.filter((z) => dist(z) < 3).length >= 5, JSON.stringify(w1.map((z) => f2(dist(z)))));
        const t = alive().find((z) => g.targetPair && z.word === g.targetPair[0]) || alive()[0];
        const c0 = g.correctCount;
        await shoot(t);
        ok("B ...shot by its word as any zombie", !t.alive && g.correctCount === c0 + 1);
        kill();
        await until(() => has("x:boxes"), 400);
        ok("B clear: \"Water is scarce. Take every bottle you can carry.\" by text; the objective: the kitchen's supplies (0 of 3)", has("msg:min8") && /Water is scarce/.test(G.STRINGS.en["story.ch1.m.min8"]) && run0().objective === "story.ch1.s5.obj2" && !SCR.state.loops.includes("tense"));
        note("B");
      }

      // ================= C: the boxes =================
      {
        at(-45.0, 0, -21.8); await until(() => has("on:take"), 60);
        ok("C in the kitchen: the hint (hold the button)", /Hold E at a box for two seconds/.test(SCR.state.hint || ""), SCR.state.hint);
        at(-40.8, 0, -24);
        const pd = useAt(-39.5, 1.2, -24);
        ok("C the back door before the supplies: it stays shut -- \"the supplies first\"", !doorOpen("KITCHENB") && /supplies first/i.test(SCR.state.hint || ""), pd + " | " + SCR.state.hint);
        at(BOX.boxWater.at[0], 0, BOX.boxWater.at[1]);
        const pw = useAt(BOX.boxWater.look[0], 0.5, BOX.boxWater.look[1]);
        step(10);
        ok("C at the water: \"Hold E: Take the water\" -- a press alone takes nothing", /Hold E: Take the water/.test(pw) && !has("used:boxWater") && USE.has("boxWater"), pw);
        holdBox("boxWater", 60, "key");
        const p1 = USE.point("boxWater").ref.holdP, ring = !hid("story-push");
        step(20);
        const p2 = USE.point("boxWater").ref.holdP;
        ok("C held half way (the key): the ring filling -- let go, it runs back", p1 > 0.4 && p1 < 0.6 && p2 < p1 - 0.2 && !has("used:boxWater"), f2(p1) + " -> " + f2(p2));
        step(60);
        // (its rustle, now and then: not every frame)
        let rustle = 0; const sfx0 = G.Audio.sfx; G.Audio.sfx = function (n) { if (n === "paper") rustle++; return sfx0.apply(this, arguments); };
        const n1 = holdBox("boxWater", 200, "key");
        G.Audio.sfx = sfx0;
        step(2);
        ok("C ...a rustle now and then while it is held", rustle >= 3 && rustle <= 5, rustle);
        ok("C held two seconds: the water taken (its box gone, its name across the screen), 1 of 3", has("used:boxWater") && Math.abs(n1 - 120) <= 3 && !CAST.propIds().includes("boxWater") && !USE.has("boxWater") && run0().objective === "story.ch1.s5.obj2b", n1 + " frames, ring " + ring);
        const w2a = alive().filter((z) => z.storyGroup === "w2a");
        ok("C ...the second wave meanwhile: four up from the back stairs (two Sprinters), the glasses' line", w2a.length === 4 && w2a.filter((z) => z.type === "fast").length === 2 && born.slice(-4).every((q) => q.z > 2 && q.x < -44) && LL.line && LL.line.key === "story.ch1.sys.more" && SCR.state.loops.includes("tense"), LL.line && LL.line.key);
        at(-46, 0, -23.5);
        await until(() => w2a.filter((z) => dist(z) < 3).length >= 3, 1600);
        ok("C ...they come to the kitchen", w2a.filter((z) => dist(z) < 3).length >= 3, JSON.stringify(w2a.map((z) => f2(dist(z)))));
        kill();
        // the second by a finger on the hand button
        G.Input.mode = "touch";
        at(BOX.boxFood.at[0], 0, BOX.boxFood.at[1]);
        const n2 = holdBox("boxFood", 200, "touch");
        G.Input.mode = "desktop";
        step(2);
        ok("C the dry food by a finger held on the hand button: taken, 2 of 3; four more come", has("used:boxFood") && Math.abs(n2 - 120) <= 3 && run0().objective === "story.ch1.s5.obj2c" && alive().filter((z) => z.storyGroup === "w2b").length === 4, n2 + " frames");
        ok("C ...fifteen in the two waves (the design: 12-16, the most so far)", ["w1", "w2a", "w2b"].reduce((s, k) => s + (run0().groups[k] || 0), 0) === 15, JSON.stringify(run0().groups));
        kill();
        await until(() => has("on:held"), 60);
        ok("C ...held: the music down again", !SCR.state.loops.includes("tense"));
        // the third by the controller's Y
        at(BOX.boxTorch.at[0], 0, BOX.boxTorch.at[1]);
        G.Input.pollGamepad = () => gp;
        const n3 = holdBox("boxTorch", 200, "pad");
        G.Input.pollGamepad = pad0; G.Input.padActive = false; G.Input.padUse = false;
        step(3);
        ok("C the flashlight and batteries by the controller's Y held: taken; Kru Min: Sgt. Chai's car behind the gym; out by the back door", has("used:boxTorch") && Math.abs(n3 - 120) <= 4 && has("msg:min9") && run0().objective === "story.ch1.s5.obj3" && USE.has("door:KITCHENB"), n3 + " frames " + run0().objective);
        kill();
        at(-40.8, 0, -24);
        useAt(-39.5, 1.2, -24);
        ok("C the back door opens by hand now", doorOpen("KITCHENB"));
        note("C");
      }

      // ================= D: the walkway's save =================
      let gymCp;
      {
        at(-38, 0, -24.5);
        await until(() => { const c = G.save.story.ch.ch1.cp; return c && c.scene === 5 && c.beat > 0; }, 200);
        step(3);
        const c = G.save.story.ch.ch1.cp;
        gymCp = c ? JSON.parse(JSON.stringify(c)) : null;
        ok("D on the walkway: the save before the gym (the design's)", c && c.scene === 5 && c.beat > 0 && Math.abs(c.x + 38) < 0.1 && ["used:boxWater", "used:boxFood", "used:boxTorch"].every((f) => (c.flags || []).includes(f)), JSON.stringify(c && { beat: c.beat, x: c.x, z: c.z }));
        ok("D a stopwatch ticking; the objective: through the gym to the car park; the gym's door to open", SCR.state.loops.includes("tick") && run0().objective === "story.ch1.s5.obj4" && USE.has("door:GYMW") && !doorOpen("GYMW"));
        ok("D rounds and health in the gym; Coach Ek there now (FASTER over him)", g.drops.filter((d) => d.mesh.position.z < -29 && d.kind === "ammo").length >= 3 && g.drops.some((d) => d.kind === "health" && d.mesh.position.x > -14) && CAST.get("ek") && !CAST.get("ek").hidden && CAST.get("ek").labelWord === "FASTER" && CAST.get("ek").who === "ek_z");
        at(-37.6, 0, -26);
        const pg = useAt(-36.5, 1.2, -26);
        ok("D the gym's door by hand", doorOpen("GYMW") && /Open the door/.test(pg), pg);
        note("D");
      }

      // ================= E: the gym =================
      {
        at(-35, 0, -26); step(3);
        ok("E in: the door shut behind, the view turned to him (bars), the glasses: one word left, FASTER", !doorOpen("GYMW") && G.StoryCam.barsOn && G.StoryCam.locked && LL.line && LL.line.key === "story.ch1.sys.ek", LL.line && LL.line.key);
        await until(() => !G.StoryCam.turning, 200);
        const dir = new THREE.Vector3(); g.camera.getWorldDirection(dir);
        const to = new THREE.Vector3(-26.5 - me().x, 0, -32 - me().z).normalize();
        ok("E ...he is in the middle of it, seen", dir.setY(0).normalize().dot(to) > 0.98);
        await until(() => BO.active, 600);
        const i = BO.info();
        ok("E the fight: his bar (Coach Ek, full), the objective, the music; the watch's own ticking his from here", i && i.hits === 0 && !hid("hud-boss-bar") && /Coach Ek/.test(el("hud-boss-name").textContent) && el("hud-boss-hp-fill").style.width === "100%" && run0().objective === "story.ch1.s5.obj5" && SCR.state.loops.includes("tense") && !SCR.state.loops.includes("tick") && !G.StoryCam.barsOn && !CAST.get("ek"), JSON.stringify(SCR.state.loops));
        const z = ek();
        ok("E ...one of the field's zombies, in his own look, faster over him -- and not the one asked", z && z.look && z.look.voxel === "ek_z" && z.word === "faster" && z.practice && z.noTarget && !(g.targetPair && g.targetPair[0] === "faster"), z && z.look && z.look.voxel);
        note("E");
      }

      // ================= F: FASTER =================
      {
        at(-30, 0, -36);
        await until(() => BO.info().st === "faster", 200);
        step(20);
        const L = ek().mesh.userData.limbs;
        ok("F \"FASTER! FASTER!\" -- the stopwatch held up (his arm), in his hand; the hint under his bar", heard.includes("story.ch1.d.ekFaster") && L.armR.shoulder.rotation.x < -1.8 && BO.state.watch && BO.state.watch.parent === L.armR.shoulder && /Sprinters/.test(el("hud-boss-hint").textContent), f2(L.armR.shoulder.rotation.x) + " " + el("hud-boss-hint").textContent);
        ok("F ...no Sprinter before the shout is over; the locker room's door shut", !alive().some((q) => q.storyAdd) && !doorOpen("LOCKER"));
        await until(() => BO.info().calls === 1, 120);
        const adds = alive().filter((q) => q.storyAdd === "ek");
        ok("F four Sprinters out of the locker room (its door burst open): FASTEN and FOSTER among them, the rest the chapter's words", adds.length === 4 && adds.every((q) => q.type === "fast") && doorOpen("LOCKER") && ["fasten", "foster"].every((w) => adds.some((q) => q.word === w && q.practice)) && adds.filter((q) => !q.practice).length === 2, adds.map((q) => q.word).join());
        ok("F ...in PE kit", adds.every((q) => q.look && /^zp\d$/.test(q.look.voxel)), adds.map((q) => q.look && q.look.voxel).join());
        const born4 = born.slice(-4);
        ok("F ...from inside it", born4.every((q) => q.x > -18 && q.z > -28.5 && q.z < -22), JSON.stringify(born4.map((q) => [f2(q.x), f2(q.z)])));
        ok("F ...for a while whatever is near him is sped up: the ring on the floor", BO.info().boost > 4 && (step(2), BO.info().ring));
        // one near him, one far
        adds[0].mesh.position.set(ek().mesh.position.x + 2, 0, ek().mesh.position.z); adds[1].mesh.position.set(-15, 0, -25);
        adds[0]._boostT = 0; adds[1]._boostT = 0;
        step(2);
        ok("F ...one near him sped up, one in the locker room not", adds[0]._boostT > 0 && !(adds[1]._boostT > 0), f2(adds[0]._boostT) + " " + f2(adds[1]._boostT || 0));
        await until(() => adds.every((q) => q.mesh.position.x < -19.2 || q.mesh.position.z < -30), 700);
        ok("F ...all out of the locker room on their own", adds.every((q) => q.mesh.position.x < -19.2 || q.mesh.position.z < -30), JSON.stringify(adds.map((q) => [f2(q.mesh.position.x), f2(q.mesh.position.z)])));
        ok("F ...answered as any zombie: the word asked is one of theirs, never his", g.targetPair && adds.some((q) => q.word === g.targetPair[0]) && g.targetPair[0] !== "faster", g.targetPair && g.targetPair[0]);
        kill(boss);
        note("F");
      }

      // ================= G: shots on him =================
      {
        const hp0 = ek().hp, wc = g.wrongCount, php = g.player.hp = g.player.maxHp;
        at(-30, 0, -36); ek().mesh.position.set(-24, 0, -36);
        step(30);
        const s0 = BO.info().shrugs;
        for (let i = 0; i < 3; i++) { const p = ek().mesh.position; look(p.x, 1.3, p.z); step(1); g.player.fireCooldown = 0; G.onFirePress(); step(24); }
        ok("G the pistol on him: nothing (a clink), no penalty -- and the hint says what would stop him", BO.info().shrugs >= s0 + 2 && ek().hp === hp0 && BO.info().hits === 0 && g.wrongCount === wc && /wall or the vaulting box/.test(el("hud-boss-hint").textContent), BO.info().shrugs + " " + el("hud-boss-hint").textContent);
        note("G");
      }

      // ================= H: the charge, taken =================
      {
        kill(boss);
        await until(() => BO.info().st === "beep", 1500);
        g.player.hp = g.player.maxHp;
        at(-31, 0, -38); ek().mesh.position.set(-20, 0, -34); step(2);
        const i1 = BO.info();
        const ln = BO.state.lane;
        ok("H the charge's sign: he crouches, the stopwatch beeps, a lane on the floor toward the player; the hint", i1.st === "beep" && i1.beeps >= 1 && i1.lane && ln.o.len > 10 && /Three beeps/.test(el("hud-boss-hint").textContent), JSON.stringify([i1.beeps, f2(ln.o.len)]));
        await until(() => BO.info().locked, 200);
        const d0 = Object.assign({}, BO.info().dir);
        ok("H three beeps -- and its line is held from the third", BO.info().beeps === 3 && BO.info().locked);
        god = false;
        const hp1 = g.player.hp, from = ek().mesh.position.clone();
        await until(() => BO.info().st === "dash", 120);
        ok("H ...straight down it (the line as it was held)", Math.abs(BO.info().dir.x - d0.x) < 1e-6 && Math.abs(BO.info().dir.z - d0.z) < 1e-6);
        let lo = 9, hit = 0, p0 = me().clone();
        for (let k = 1; k < 320; k++) { step(1); if (!hit && g.player.hp < hp1) hit = k; lo = Math.min(lo, me().y); if (hit && k > hit + 110) break; }
        const pushed = Math.hypot(me().x - p0.x, me().z - p0.z);
        ok("H the player in it: hurt (about a fifth), thrown, off the feet and up again", hit > 0 && Math.abs((hp1 - g.player.hp) / g.player.maxHp - 0.22) < 0.06 && pushed > 1.2 && lo < 0.9 && me().y > 1.55, JSON.stringify({ hp: [hp1, f2(g.player.hp)], pushed: f2(pushed), lo: f2(lo), up: f2(me().y) }));
        ok("H ...he ran a long straight line, and is not stunned by that", ek().mesh.position.distanceTo(from) > 6 && BO.info().stuns === 0, f2(ek().mesh.position.distanceTo(from)) + " " + BO.info().st);
        god = true; g.player.hp = g.player.maxHp;
        note("H");
      }

      // ================= I: dodged: the wall; the question =================
      // (the next charge: the player brought to a place, a step aside once its line is held)
      const charge = async (px, pz, ex, ez, side) => {
        for (let k = 0; k < 8; k++) {
          kill(boss);
          if (!(await until(() => BO.info().st === "beep", 2600))) return false;
          at(px, 0, pz); ek().mesh.position.set(ex, 0, ez);
          if (await until(() => BO.info().locked || BO.info().st !== "beep", 200) && BO.info().locked) break;
        }
        const q = BO.info().dir;
        at(me().x + q.z * 2.6 * (side || 1), 0, me().z - q.x * 2.6 * (side || 1));
        await until(() => BO.info().st !== "beep" && BO.info().st !== "dash", 600);
        return BO.info().st === "stun";
      };
      const trigger = async () => { for (let k = 0; k < 8; k++) { const p = new THREE.Vector3(); (ek().mesh.userData.neck || ek().mesh).getWorldPosition(p); look(p.x, p.y - 0.25, p.z); step(1); g.player.fireCooldown = 0; const h = BO.info() && BO.info().hits; G.onFirePress(); step(2); if (!BO.info() || BO.info().hits !== h) return true; for (let j = 0; j < 8; j++) step(1); } return false; };
      let before;
      {
        before = { faster: stat("faster"), fasten: stat("fasten"), foster: stat("foster"), right: g.correctCount, wrong: g.wrongCount };
        const st = await charge(-33, -36, -22, -36);
        const e = ek().mesh.position;
        ok("I the line stepped out of: he runs into the wall -- stunned (4 seconds)", st && BO.info().stuns === 1 && (e.x < -34.5 || e.z < -44 || e.z > -24), JSON.stringify([BO.info().st, f2(e.x), f2(e.z)]));
        step(2);
        const gl = G.StoryQuiz.glossOf(G.STORY_WORDS.ch1.faster);
        ok("I the glasses ask: \"Shoot the word that means ...\" -- his word's meaning, in the player's language (faster)", LL.line && LL.line.key === "story.ch1.sys.shoot" && LL.line.vars.meaning === gl && g.targetPair && g.targetPair[0] === "faster" && g.targetPair[1] === gl && !ek().noTarget, JSON.stringify([LL.line && LL.line.key, g.targetPair]));
        ok("I ...asked in the word box, his bar lit, stars over him; FASTEN and FOSTER on the field (called in if they were not)", /vuln/.test(el("hud-boss-bar").className) && BO.state.stars.visible && ["fasten", "foster"].every((w) => alive().some((q) => q.word === w && q.storyAdd)), alive().map((q) => q.word).join());
        // the wrong one
        const fz = alive().find((q) => q.word === "fasten");
        fz.mesh.position.set(me().x, 0, me().z - 4); fz.hp = 5; fz._hold = 9; fz._holdNoTurn = true;
        const hp2 = g.player.hp;
        await shoot(fz, 12);
        const xc = el("hud-xcard");
        ok("I FASTEN shot instead: wrong -- the health it costs, its card (fasten, and faster as the right one); he is still stunned", !fz.alive && g.player.hp < hp2 && /fasten/i.test(xc.innerText) && /faster/i.test(xc.innerText) && BO.info().st === "stun" && g.targetPair && g.targetPair[0] === "faster", xc.innerText + " " + BO.info().st);
        ok("I ...counted nowhere (practice): no wrong answer, no box", g.wrongCount === before.wrong && stat("faster") === before.faster && stat("fasten") === before.fasten);
        const shotOk = await trigger();
        ok("I faster, by the trigger: right -- 1 of 3: his bar two thirds, \"CORRECT\", its card; thrown back, another word asked", shotOk && BO.info().hits === 1 && BO.info().st === "hurt" && el("hud-boss-hp-fill").style.width === "66.7%" && LL.line && LL.line.key === "story.lens.correct" && /faster/i.test(el("hud-xcard").innerText) && ek().noTarget && !(g.targetPair && g.targetPair[0] === "faster"), JSON.stringify([shotOk, BO.info().hits, BO.info().st, el("hud-boss-hp-fill").style.width, LL.line && LL.line.key]));
        ok("I ...counted nowhere (practice)", stat("faster") === before.faster && g.correctCount === before.right);
        g.damageZombie(ek(), 14, ek().mesh.position.clone(), { dir: new THREE.Vector3(1, 0, 0), head: false }); step(1);
        ok("I ...another round at once: nothing more", BO.info().hits === 1);
        // let go: 4 seconds, then he is up
        const st2 = await charge(-33, -36, -22, -36);
        let n = 0; while (BO.info().st === "stun" && n < 400) { step(1); n++; }
        ok("I stunned again and not answered: up after four seconds -- his word no longer asked", st2 && Math.abs(n / 60 - 4) < 0.25 && BO.info().hits === 1 && ek().noTarget && !(g.targetPair && g.targetPair[0] === "faster") && !BO.state.stars.visible, f2(n / 60) + " s " + BO.info().st);
        note("I");
      }

      // ================= J: the vaulting box; the ball =================
      {
        const st = await charge(-33.4, -34.2, -24, -34.2, -1);
        const e = ek().mesh.position;
        ok("J a charge into the vaulting box: stunned too (it stands at -30, -35)", st && e.x > -29.2 && e.x < -27.6 && Math.abs(e.z + 34.2) < 1, JSON.stringify([BO.info().st, f2(e.x), f2(e.z)]));
        ok("J (a box of rounds in the middle of the floor after the first answer)", g.drops.some((d) => d.kind === "ammo" && Math.hypot(d.mesh.position.x + 23, d.mesh.position.z + 34.5) < 0.5));
        await trigger();
        ok("J ...answered: 2 of 3", BO.info().hits === 2 && el("hud-boss-hp-fill").style.width === "33.3%", BO.info().hits + " " + el("hud-boss-hp-fill").style.width);
        // the ball in the open
        for (let k = 0; k < 10; k++) { kill(boss); if (await until(() => BO.info().st === "ball", 900)) break; }
        god = false; g.player.hp = g.player.maxHp;
        at(-14, 0, -38); ek().mesh.position.set(-24, 0, -38);
        ok("J the ball's sign: he leans back; the hint (the bleachers)", BO.info().st === "ball" && /bleachers/.test(el("hud-boss-hint").textContent), el("hud-boss-hint").textContent);
        await until(() => BO.info().ballLive > 0, 120);
        const hp3 = g.player.hp, hurts0 = BO.info().hurts;
        let n = 0; while (BO.info().ballLive > 0 && n < 240) { alive().forEach((q) => { if (!q.storyBoss) q.mesh.position.set(-34, 0, -44); }); step(1); n++; }
        ok("J in the open: hit (about a sixth)", BO.info().hurts === hurts0 + 1 && Math.abs((hp3 - g.player.hp) / g.player.maxHp - 0.16) < 0.03, f2((hp3 - g.player.hp) / g.player.maxHp) + " after " + n + " frames");
        // behind the stands
        god = true;
        for (let k = 0; k < 14; k++) { kill(boss); if (await until(() => BO.info().st === "ball", 900)) break; }
        god = false; g.player.hp = g.player.maxHp;
        at(-17, 0, -45.3); ek().mesh.position.set(-17, 0, -38.2);
        await until(() => BO.info().ballLive > 0, 160);
        const hp4 = g.player.hp, hurts1 = BO.info().hurts, b0 = BO.state.balls[BO.state.balls.length - 1];
        n = 0; while (b0 && b0.live && n < 240) { alive().forEach((q) => { if (!q.storyBoss) q.mesh.position.set(-34, 0, -26); }); step(1); n++; }
        ok("J behind the stands: the ball stopped by them", b0 && !b0.live && !b0.hit && BO.info().hurts === hurts1 && g.player.hp === hp4 && b0.g.position.z > -44.8, JSON.stringify([n, b0 && f2(b0.g.position.z), BO.info().hurts - hurts1]));
        god = true; g.player.hp = g.player.maxHp;
        step(160);
        ok("J ...and is gone in a while", BO.info().balls === 0, BO.info().balls);
        note("J");
      }

      // ================= K: the third =================
      {
        const kills = g.totalZombiesKilled;
        const st = await charge(-33, -38, -22, -38);
        await trigger();
        step(2);
        ok("K the third right answer: he is down -- the flag, his bar gone", st && has("boss:ek") && !ek().alive && hid("hud-boss-bar") && !BO.active && g.totalZombiesKilled >= kills + 1, JSON.stringify([st, has("boss:ek"), BO.info() && BO.info().st]));
        ok("K ...counted nowhere (practice): right and wrong as they were, no memory box", stat("faster") === before.faster && stat("fasten") === before.fasten && stat("foster") === before.foster, stat("faster"));
        step(90);
        const b = BO.body;
        ok("K he falls and lies there (not blown to blocks), no word over him", b && Math.abs(Math.abs(b.mesh.rotation.x) - 1.52) < 0.02 && b.mesh.parent === g.scene && b.mesh.position.y < 0.3 && !ek().sprite.visible, b && f2(b.mesh.rotation.x));
        const w = b && b.watch;
        ok("K the stopwatch beside him, on the floor (out of his hand), where it can be reached", w && w.down && w.g.visible && w.g.position.y < 0.1 && USE.has("watch") && Math.hypot(w.x1 - b.mesh.position.x, w.z1 - b.mesh.position.z) < 1.3
          && !g.world.colliders.some((c) => !c.isEmpty() && !c.dead && c.max.y > 0.3 && c.min.y < 1.5 && w.x1 > c.min.x - 0.2 && w.x1 < c.max.x + 0.2 && w.z1 > c.min.z - 0.2 && w.z1 < c.max.z + 0.2), w && JSON.stringify([f2(w.g.position.x), f2(w.g.position.z)]));
        const n0 = b.tickN; step(130);
        ok("K ...ticking on", b.tickN >= n0 + 2, n0 + " -> " + b.tickN);
        kill();
        at(w.x1, 0, w.z1 + (w.z1 > -36 ? -1.1 : 1.1));
        const pw = useAt(w.x1, 0.15, w.z1);
        ok("K picked up: \"still running. Nobody ever pressed stop.\" -- found (kept in the save's flags), gone from the floor", /Pick up the stopwatch/.test(pw) && has("found:stopwatch") && G.Dialog.isOpen() && /still running/.test(el("dialog-body").innerText), pw);
        if (G.Dialog.isOpen()) G.Dialog.choose(0); step(3);
        ok("K ...and not heard any more", !w.g.visible);
        note("K");
      }

      // ================= L: the car, the shotgun =================
      let carCp;
      {
        kill();
        await until(() => doorOpen("GYMN"), 700);
        ok("L the gym clear: the car park's door open; the objective: Sgt. Chai's police car", doorOpen("GYMN") && run0().objective === "story.ch1.s5.obj7" && USE.has("car"));
        at(-24, 0, -54.6);
        const pc = useAt(-24, 0.9, -58);
        step(3);
        const p = g.player;
        ok("L the police car: the shotgun, in the hands at once, loaded (6) with 18 more", /Search the police car/.test(pc) && p.gunSlots.join() === "pistol,shotgun" && p.currentSlot === 2 && p.ammo.shotgun.mag === 6 && p.ammo.shotgun.reserve === 18, pc + " " + JSON.stringify([p.gunSlots, p.currentSlot, p.ammo.shotgun]));
        ok("L the radio: \"...all units... fall back to... City Hospital...\" (static)", heard.includes("story.ch1.d.radioUnits") && SCR.state.loops.includes("static") && run0().objective === "story.ch1.s5.obj8");
        const c = G.save.story.ch.ch1.cp;
        carCp = c ? JSON.parse(JSON.stringify(c)) : null;
        ok("L a save: the shotgun and its rounds in it", c && c.scene === 5 && c.guns.includes("shotgun") && JSON.stringify(c.ammo.shotgun) === "[6,18]" && Math.abs(c.z + 54.6) < 0.1, JSON.stringify(c && { guns: c.guns, ammo: c.ammo }));
        await until(() => alive().length > 0, 400);
        const rt = alive();
        ok("L five Shamblers in the gym to try it on", rt.length === 5 && rt.every((z) => z.type === "normal" && z.storyGroup === "rt"));
        await until(() => rt.some((z) => z.mesh.position.z < -46.5), 900);
        ok("L ...they come out of the gym to the player", rt.some((z) => z.mesh.position.z < -46.5), JSON.stringify(rt.map((z) => f2(z.mesh.position.z))));
        const t = rt.find((z) => g.targetPair && z.word === g.targetPair[0]) || rt[0];
        at(-24, 0, -54); rt.forEach((z, i) => { if (z !== t) z.mesh.position.set(-40 + i, 0, -62); });
        t.mesh.position.set(-24, 0, -52.3); t._hold = 5; t._holdNoTurn = true;
        step(60);
        const m0 = p.ammo.shotgun.mag, hpT = t.hp;
        t.mesh.position.set(-24, 0, -52.3);
        look(-24, 1.05, -52.3); step(1); p.fireCooldown = 0; G.onFirePress(); step(6);
        ok("L the shotgun fired up close: one shot, one zombie", p.ammo.shotgun.mag === m0 - 1 && !t.alive, (m0 - p.ammo.shotgun.mag) + " shot, alive " + t.alive + " hp " + hpT + " -> " + t.hp + " at " + f2(t.mesh.position.x) + "," + f2(t.mesh.position.z));
        kill();
        note("L");
      }

      // ================= M: the library, the evening =================
      {
        await said(900);
        ok("M the way back open all along", ["GYMN", "GYMW", "KITCHENB", "KITCHEN", "STAIRB1", "STAIRB2", "LIBBACK"].every(doorOpen));
        at(-36.8, 4, 5); await until(() => heard.includes("story.ch1.d.tonklaRun"), 300);
        ok("M in the library: the door shut behind; Tonkla: \"Now that's what I call a supply run.\"", heard.includes("story.ch1.d.tonklaRun") && !doorOpen("LIBBACK") && SCR.state.loops.includes("calm"),
          JSON.stringify({ beat: run0().beatI, t: f2(run0().beatT), z: alive().map((q) => [q.type, q.storyGroup, f2(q.mesh.position.x), f2(q.mesh.position.z)]), dead: run0().dead, hp: g.player.hp, dlg: G.Dialog.isOpen(), me: [f2(me().x), f2(me().y), f2(me().z)] }));
        await said(600); step(2);
        ok("M the screen black...", SCR.state.black);
        god = false; g.player.hp = Math.round(g.player.maxHp / 2);
        await until(() => G.StoryLight.current === "golden", 300);
        god = true;
        step(2);
        ok("M ...they eat and rest: full health again", g.player.hp === g.player.maxHp, g.player.hp);
        ok("M ...17:00, the same evening: the light gold, what was brought on the floor, everyone sitting, Kru Min at the window", /17:00/.test(el("story-title").innerText) && /The same evening/.test(el("story-title").innerText) && CAST.propIds().includes("eaten") && ["tonkla", "fai", "nam"].every((id) => CAST.get(id).pose === "sit") && CAST.get("min").pos.z > 8, el("story-title").innerText);
        await until(() => D.current && D.current.line === "story.ch1.d.minTime", 900);
        ok("M \"The crowd outside is moving. It's time.\"", !SCR.state.black && heard.includes("story.ch1.d.minTime"));
        await said(600);
        await until(() => run0().scene.id === "s6", 300);
        const c = G.save.story.ch.ch1.cp;
        ok("M the save: scene 1-6 next (1-5's flags left behind; the stopwatch's and the phone's kept; the shotgun too)", run0().scene.id === "s6" && c && c.scene === 6 && (c.flags || []).includes("found:stopwatch") && (c.flags || []).includes("msg:min8") && !(c.flags || []).some((f) => /^(x|on|used|card|boss|tried):/.test(f)) && c.guns.includes("shotgun"), JSON.stringify(c && c.flags));
        ok("M the front doors shut in 1-5 (the crowd outside) and open again for 1-7", !doorOpen("ENTRANCE") && G.STORY_CHAPTERS.ch1.scenes[7].doors.ENTRANCE === true);
        ok("M nothing of the fight left in it", !BO.info() && hid("hud-boss-bar") && !SCR.state.loops.length && doorOpen("LIBBACK"), JSON.stringify(SCR.state.loops));
        note("M");
      }

      // ================= N: the saves picked up; a death =================
      {
        G.save.story.ch.ch1.cp = JSON.parse(JSON.stringify(gymCp));              // (the last save, as it was then)
        play(() => S.start("ch1", Object.assign({}, gymCp)));
        step(6);
        ok("N the walkway's save picked up: the boxes gone, the kitchen's back door open, the gym's shut; ticking; Coach Ek there",
          run0().scene.id === "s5" && !CAST.propIds().some((i) => /^box/.test(i)) && doorOpen("KITCHENB") && !doorOpen("GYMW") && !doorOpen("GYMN") && !doorOpen("LOCKER") && SCR.state.loops.includes("tick") && USE.has("door:GYMW") && !CAST.get("ek").hidden && !SCR.state.black && Math.abs(me().x + 38) < 0.4, JSON.stringify([run0().beatI, CAST.propIds()]));
        at(-37.6, 0, -26); useAt(-36.5, 1.2, -26); at(-35, 0, -26);
        await until(() => BO.active, 600);
        await until(() => BO.info().calls > 0, 400);
        god = false; g.player.hp = 0; g.checkPlayerDeath(); step(3);
        ok("N down in the gym: the chapter's own (back to the last checkpoint)", G.Dialog.isOpen() && run0().dead && /Back to the last checkpoint/.test(el("dialog-box").innerText || ""), (el("dialog-box") || {}).innerText);
        god = true;
        play(() => G.Dialog.choose(1));
        step(6);
        ok("N ...retry: before the gym, nothing of the fight left -- no Ek on the field, no bar, the locker room shut", run0().scene.id === "s5" && !BO.info() && !alive().length && hid("hud-boss-bar") && !doorOpen("LOCKER") && g.player.hp === g.player.maxHp && Math.abs(me().x + 38) < 0.4, JSON.stringify([run0().scene.id, BO.info(), alive().length, hid("hud-boss-bar"), doorOpen("LOCKER"), g.player.hp, f2(me().x)]));
        play(() => S.start("ch1", Object.assign({}, carCp)));
        step(6);
        ok("N the car's save picked up: by the car, the shotgun in the slots with its rounds, the way back open", run0().scene.id === "s5" && run0().objective === "story.ch1.s5.obj8" && Math.abs(me().z + 54.6) < 0.5 && g.player.gunSlots.includes("shotgun") && JSON.stringify(g.player.ammo.shotgun) === JSON.stringify({ mag: 6, reserve: 18 }) && ["GYMN", "GYMW", "KITCHENB", "LIBBACK"].every(doorOpen) && CAST.get("ek").hidden, JSON.stringify([run0().objective, g.player.ammo.shotgun]));
        await until(() => alive().length > 0, 400);
        ok("N ...and the five come", alive().length === 5);
        note("N");
      }

      // ================= O: around it =================
      {
        // a practice word asked: a wrong shot at a word of the bank counts nowhere
        kill();
        play(() => S.start("ch1", { scene: 4, beat: 0, skip: true }));
        at(-42.2, 4, -21.0); at(-45.2, 4, -24.0); step(3);
        G.StoryScenes.spawn(g, run0(), { id: "pr", at: { x: -43, y: 4, z: -23 }, count: 1, kinds: ["normal"] });
        const z = alive().find((q) => q.storyGroup === "pr");
        const w0 = g.wrongCount, st0 = [stat("rest"), z ? stat(z.word) : ""].join("|");
        if (z) { g.damageZombie(z, 999, z.mesh.position.clone(), { dir: null, head: false }); step(2); }
        ok("O a practice word asked (REST): a word of the bank shot instead counts nowhere", z && !z.practice && g.targetPair && g.targetPair[0] === "rest" && g.wrongCount === w0 && [stat("rest"), stat(z.word)].join("|") === st0, JSON.stringify([g.targetPair, g.wrongCount - w0]));
        const pz = alive().find((q) => q.practice);
        if (pz) g.learnBitten(pz);
        ok("O ...bitten by the one that carries it: counted nowhere either", stat("rest") === st0.split("|")[0]);
        ok("O faster, fasten, foster: meanings in the four meaning languages (practice: not the bank's)", ["faster", "fasten", "foster"].every((w) => { const p = G.STORY_WORDS.ch1[w]; return p && ["th", "zh", "fr", "en"].every((l) => p[l]); }) && !G.WordBank.lookup("faster"));
        const keys = ["story.ch1.s5.obj1", "story.ch1.d.minSupply", "story.ch1.d.ekFaster", "story.ch1.sys.shoot", "story.boss.hint.charge", "story.use.boxWater", "story.hint.take.touch", "story.hint.take.pad", "story.ch1.watch", "story.ch1.d.radioUnits", "story.ch1.d.minTime"];
        // (the other languages' files, as they are: only the menus' own is loaded)
        const miss = keys.filter((k) => !G.STRINGS.en[k]);
        for (const l of ["th", "zh", "fr"]) { const t = await (await fetch("/js/strings-" + l + ".js?r=" + Date.now())).text(); keys.forEach((k) => { if (!t.includes('"' + k + '":')) miss.push(l + ":" + k); }); }
        ok("O its lines and hints in the four languages", !miss.length, miss.join());
        // draw calls on Low: the canteen with its wave, the kitchen, the gym with everyone, the car park
        const draws = () => { step(4); g.renderFrame(); return g.renderer.info.render.calls; };
        const calls = {};
        play(() => S.start("ch1", { scene: 5, beat: 0, skip: true }));
        G.StoryScenes.spawn(g, run0(), { id: "pw", at: ["canteenFar", "kitchenFar"], count: 7, kinds: ["normal", "fast"] });
        at(-43, 0, 0); look(-46, 1.2, -12); calls.canteen = draws();
        kill(); at(-48.5, 0, -25.2); look(-41.5, 1.2, -20.5); calls.kitchen = draws();
        at(-38.4, 0, -24.4); look(-36, 1.4, -26); calls.walkway = draws();
        M().door("GYMW", true);
        G.StoryScenes.act(g, run0(), ["boss", Object.assign({}, run0().scene.beats.map((b) => (b.do || []).find((a) => a[0] === "boss")).find(Boolean)[1])]);
        at(-32, 0, -42); ek().mesh.position.set(-26, 0, -37);
        await until(() => BO.info().calls > 0, 400);
        look(-21, 1.2, -32); calls.gym = draws();
        kill(boss);
        G.StoryBoss.reset(g);
        at(-24, 0, -50); look(-24, 1, -58); calls.park = draws();
        numbers.calls = calls;
        ok("O draw calls on Low under 150 (the canteen, the kitchen, the walkway, the gym with Coach Ek and four Sprinters, the car park)", Object.values(calls).every((c) => c < 150), JSON.stringify(calls));
        ok("O ...the mini-boss put away: off the field, his bar gone", !BO.info() && !alive().length && hid("hud-boss-bar"));
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        play(() => g.startLevel(1));
        ok("O the campaign after it: no ring, no bar, nothing held, its zombies' targets as they were", hid("story-push") && hid("hud-boss-bar") && !BO.info() && !PUSH.taking && !G.StoryCam.fallen && g.player.gunSlots.join() === "pistol" && !g.zombies.some((q) => q.noTarget || q.storyBoss));
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        numbers.frames = frames;
        numbers.realSec = Math.round((performance.now() - t0) / 1000);
      }
      D.say = say0;
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ") + " | trace " + trace.join(" "));
    } finally {
      D.say = say0;
      g.spawnZombieAt = spawn0;
      G.CONFIG.story.enabled = enabled0;
      G.Input.keys[kb.jump] = false; G.Input.keys[kb.interact] = false; G.Input.touchInteractHeld = false; G.Input.padUse = false; G.Input.mouseDown = false; G.Input.aimDown = false;
      G.Input.pollGamepad = pad0; G.Input.padActive = false;
      G.Input.mode = mode0;
      G.Audio.speak = speak0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      if (G.StoryPhone.isOpen && G.StoryPhone.isOpen()) G.StoryPhone.close();
      G.Modal.reset();
      try { if (g.state !== "MENU") g.quitToMainMenu(); } catch (e) { /* (already out) */ }
      G.save = JSON.parse(backup);
      G.persist(true);
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no errors in the page", !errs.length, errs.slice(0, 3).join(" | "));
    const fail = results.filter((r) => !r.pass);
    return { total: results.length, pass: results.length - fail.length, fail, results, numbers, trace };
  }
  return { run };
})();
