// Dev-only (not shipped). The story series' round 5: Chapter 1's prologue, "Exam Day", played
// through by its own inputs (the interaction ray, the dialogue's choices, the dot of the
// practice exam, a press in time, the trigger, the reload) -- and what it is made of
// (js/story/cast.js, interact.js, aimquiz.js, screen.js, voxelgun.js; scenes.js' new waits
// and actions; game.js handsFree, a scene's own words, the practice words).
//   A  the start: a black screen, the alarm, no HUD, no gun (nothing fires, aims, reloads,
//      swaps); the morning's people and the police car on the map
//   B  part 1, the phone: the notifications, Beam's thread read, the answer; the screen fades in
//   C  part 2, the gate: walked in (free to look round), the radio, Beam following, Sgt.
//      Chai's sealed box carried into the building; about 20 seconds
//   D  part 3, the building: the seating plan used (the game's interaction prompt), the card
//      with the candidate's own name, Beam's lost word (practice: counted nowhere), Kru Min
//      coming down the stairs and going
//   E  part 4, Room 305: the seat (the eyes lower, the feet held), the glasses (the word box
//      boots), the practice exam answered by aiming: its question in the word box, the dot,
//      the card; the bank's word counted, the others practice
//   F  part 5, the spike: the alarm's light, the fire bell, Beam turning (TOGETHER over his
//      head), the candidates turning, health and stamina booting; a push in time (a miss
//      costs health, never the last of it); the jammed door kicked open
//   G  part 6, the corridor: Sgt. Chai's pistol (in the hands, built of blocks), the ammo and
//      the words booting; CLEAN / CLEAR / LEAN (the janitor's CLEAN the target, its meaning
//      asked); a wrong shot's card; the practice words counted nowhere; a reload
//   H  part 7: Kru Min's message read, the chapter's title, its first objective; the prologue
//      done, the checkpoint at scene 1
//   I  around it: the prologue can't be lost; Skip Prologue starts armed with the whole HUD;
//      the time it takes; the campaign after it as it was (the gun shown, no seat, nothing left)
// Load it into the game (in the lobby), then:
//   const r = await G.Round43Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round43Test = (function () {
  const yield0 = () => new Promise((r) => setTimeout(r, 0));

  async function run() {
    const results = [], errs = [], numbers = {}, trace = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t43 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, CH = G.STORY_CHAPTERS.ch1, CAM = G.StoryCam, CAST = G.StoryCast, USE = G.StoryUse, QZ = G.StoryQuiz, SCR = G.StoryScreen, LL = G.LexiLens;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled;
    const real = g._update0 || g.update;
    const kb = G.save.settings.keybinds;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const mode0 = G.Input.mode;
    let frames = 0;
    const step = (n, dt) => { for (let i = 0; i < n; i++) { real.call(g, dt || 1 / 60); frames++; } };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const run0 = () => S.run;
    const beat = () => (S.run ? S.run.beatI : -1);
    const flags = () => (S.run ? Array.from(S.run.flags) : []);
    const has = (f) => !!(S.run && S.run.flags.has(f));
    const at = (x, y, z) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    const feet = () => g.yawObject.position.y - 1.7;
    const look = (x, y, z) => { const e = g.yawObject.position, dx = x - e.x, dz = z - e.z, dy = y - e.y; g.yawObject.rotation.y = Math.atan2(-dx, -dz); g.pitchObject.rotation.x = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz)))); g.yawObject.updateMatrixWorld(true); };
    // frames until fn() (at most n), yielding to the page now and then
    const until = async (fn, n) => { for (let i = 0; i < (n || 600); i++) { if (fn()) return true; step(1); if (i % 40 === 39) await yield0(); } return !!fn(); };
    const quit = () => { if (G.Dialog.isOpen()) G.Dialog.close(); g.update = real; if (g.state !== "MENU") g.quitToMainMenu(); g.update = () => {}; G.Modal.reset(); };
    const note = (tag) => trace.push(tag + "@" + beat() + "/" + frames);
    const promptText = () => ((document.getElementById("hud-interact-prompt") || {}).innerText || "").trim();
    // the interaction ray on a point: looked at, used with the game's own interaction
    const useAt = (x, y, z) => { look(x, y, z); step(1); g.updateInteractRay(); const p = promptText(); g.doInteract(); step(1); return p; };
    const dialogBtns = () => Array.from(document.querySelectorAll("#dialog-btns .btn")).map((b) => b.innerText);
    const choose = (re) => { const i = dialogBtns().findIndex((t) => re.test(t)); if (i >= 0) G.Dialog.choose(i); return i; };
    // held: the dialogue's "faster" (Space): lines, the scene's waits, the view's turns
    const hold = (on) => { G.Input.keys[kb.jump] = !!on; };
    const parts = () => LL.shown.slice().sort().join(",");
    const alive = () => g.zombies.filter((z) => z.alive);
    const stat = (w) => { const s = G.save.wordStats && G.save.wordStats[w]; const l = G.save.learn && G.save.learn[w]; return JSON.stringify([s || null, l || null]); };

    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      // (a play of the prologue elsewhere in this browser -- a game, the pictures -- leaves its
      // cinematic parts "seen", and held Space would skip them: this suite plays them the first time)
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
      G.Input.mode = "desktop";
      if (G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality(); }
      const t0 = performance.now();

      // ================= A: the start =================
      {
        play(() => S.start("ch1", null));
        const r = run0();
        ok("A the prologue from its start, at the school gate in the morning", r && r.scene.id === "prologue" && beat() >= 1 && Math.abs(g.yawObject.position.x - 29.5) < 0.1 && Math.abs(g.yawObject.position.z - 56.5) < 0.1 && G.StoryLight.current === "morning");
        ok("A a black screen and the phone's alarm", SCR.state.black && SCR.state.loops.includes("alarm") && document.body.classList.contains("story-black-on"));
        ok("A no HUD at all (the glasses not on), no gun in the hands (its touch buttons away)", document.body.classList.contains("story-hands-free") && parts() === "" && !LL.on && g.handsFree() && G.ViewModel.visible === false);
        // nothing a gun does: the trigger, the sights, a reload, a swap, a swing
        const ammo0 = JSON.stringify(g.player.ammo.pistol);
        G.onFirePress(); G.Input.mouseDown = true; G.Input.aimDown = true; step(4); G.Input.mouseDown = false; G.Input.aimDown = false;
        const r1 = g.reload(), i1 = g.inspect(); g.switchSlot(0); G.onMeleePress(); step(4);
        ok("A ...the trigger, the sights, a reload, an inspection, a swap, a swing: none of them do anything", JSON.stringify(g.player.ammo.pistol) === ammo0 && g.aimP < 0.01 && !r1 && !i1 && g.player.currentSlot === 1 && !(g.wsm && g.wsm.mel), ammo0);
        const cast = CAST.ids();
        ok("A the morning's people on the map: Beam, Sgt. Chai, Kru Min (out of sight), the invigilator, six candidates", ["beam", "chai", "min", "invig", "c1", "c2", "c3", "c4", "c5", "c6", "chai2"].every((id) => cast.includes(id))
          && CAST.get("min").hidden && CAST.get("chai2").hidden && !CAST.get("beam").hidden, cast.join());
        const chai = CAST.get("chai");
        ok("A ...built of blocks, none of them a zombie (nothing to shoot: not in the game's zombies)", CAST.ids().every((id) => CAST.get(id).model.userData.voxel) && g.zombies.length === 0 && chai.pose === "carry" && !!chai.held);
        ok("A Sgt. Chai's police car by the entrance (the scene's own prop, solid)", CAST.propIds().includes("car") && G.ColGrid.near(g.world, 13, 16, 2, []).some((c) => !c.isEmpty() && c.max.x > 12 && c.min.x < 14));
        ok("A the objective before the glasses: on its own line at the top", run0().objective === "story.ch1.obj.wake" && !!document.getElementById("story-obj") && !document.getElementById("story-obj").classList.contains("hidden"));
        note("A");
      }

      // ================= B: part 1, the phone =================
      {
        await until(() => has("msg:beam2"), 600);
        ok("B the calendar, LEXA's ad and Beam's two messages arrive (toasts), a hint on how to open the phone", ["ntf:cal", "ntf:ad", "msg:beam1", "msg:beam2"].every(has) && /phone|ringing/i.test(SCR.state.hint || ""), flags().join(" ") + " | " + SCR.state.hint);
        G.StoryPhone.open("beam");
        step(1);
        const words = Array.from(document.querySelectorAll(".story-phone .sd-word")).map((b) => b.dataset.form);
        ok("B Beam's thread opened: read -- the dotted-word tip in the phone only while its messages have a word of the bank (the design's lines have none in this bank yet)",
          has("read:beam") && G.StoryPhone.isOpen() && (words.length > 0) === !!document.querySelector(".story-phone .sp-tip"), words.join() || "no bank word in Beam's messages");
        ok("B ...and the alarm stops once the phone is picked up", !SCR.state.loops.includes("alarm"));
        ok("B ...Beam's messages read: none of their toasts left to pop up later", G.StoryPhone.state.toasts.every((t) => t.thread !== "beam") && !(G.StoryPhone.state.toast && G.StoryPhone.state.toast.thread === "beam"));
        G.StoryPhone.close(); step(2);
        await until(() => G.Dialog.isOpen(), 300);
        const q = (document.getElementById("dialog-body") || {}).innerText || "";
        ok("B the answer to Beam: two to choose from", G.Dialog.isOpen() && /slipping/.test(q) && dialogBtns().length === 2, dialogBtns().join(" / "));
        choose(/promised/i); step(2);
        ok("B chosen: kept in the chapter's save; the screen fades in on the gate, the objective Room 305", S.data("ch1").choices.beam === "promise" && !SCR.state.black && run0().objective === "story.ch1.s0.obj");
        note("B");
      }

      // ================= C: part 2, the gate =================
      {
        const f0 = frames;
        await until(() => CAM.walking, 200);
        ok("C walked in by the story (the feet), free to look round (the view not locked), a hint on looking", CAM.walking && !CAM.locked && /look/i.test(SCR.state.hint || ""), SCR.state.hint);
        g.yawObject.rotation.y += 1.2; step(1);
        ok("C ...the view turned by the player while walked (not taken back)", CAM.walking && Math.abs(g.yawObject.rotation.y) > 0.5);
        ok("C the radio's line, its hiss; Beam follows; Sgt. Chai sets off with the box", G.StoryDialogue.current && G.StoryDialogue.current.who === "radio" && SCR.state.loops.includes("static") && CAST.get("beam").follow && !!CAST.get("chai").path);
        await until(() => beat() >= 12, 2400);
        numbers.gateSec = +((frames - f0) / 60).toFixed(1);
        const p = g.yawObject.position, b = CAST.get("beam");
        ok("C at the entrance after about 20 s (the design: 0:20-0:40)", beat() >= 12 && Math.hypot(p.x - 4.6, p.z - 9.8) < 0.8 && numbers.gateSec > 12 && numbers.gateSec < 32, numbers.gateSec + " s");
        ok("C Beam beside the player all the way; Sgt. Chai gone into the building ahead (out of sight)", b && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 3.5 && CAST.get("chai").hidden, b && [b.pos.x, b.pos.z].map((v) => v.toFixed(1)).join());
        note("C");
      }

      // ================= D: part 3, into the building =================
      {
        ok("D walking by themselves now (a hint), the seating plan the objective, the ray's prompt on it", !CAM.walking && run0().objective === "story.ch1.obj.board" && /walk/i.test(SCR.state.hint || "") && USE.has("board"));
        at(3.4, 0, 6.6);
        const pr = useAt(3.2, 1.1, 4.8);
        ok("D the game's interaction prompt says what it is (E: Read the seating plan), and E uses it", /seating plan/i.test(pr) && has("used:board") && !USE.has("board"), pr);
        const card = (document.getElementById("dialog-body") || {}).innerText || "";
        const me = document.querySelector(".story-card tr.sc-me");
        ok("D the card: Room 305's seating plan, the candidate's own name lit (B2)", G.Dialog.isOpen() && /Beam W\./.test(card) && me && me.innerText.indexOf(S.vars().name) >= 0 && /B2/.test(me.innerText), me && me.innerText);
        G.Dialog.choose(0); step(2);
        await until(() => G.Dialog.isOpen(), 300);
        const st0 = stat("pencil");
        ok("D Beam's lost word: pencil, eraser or ruler", G.Dialog.isOpen() && dialogBtns().length === 3 && /pencil/i.test(dialogBtns().join()), dialogBtns().join(" / "));
        choose(/pencil/i); step(2);
        ok("D ...a practice word: counted nowhere", stat("pencil") === st0 && has("chose:pencil") && run0().objective === "story.ch1.obj.go305");
        await until(() => !G.StoryDialogue.busy(), 600);
        at(3.5, 0, 0.2); look(2.5, 2.5, -6);
        await until(() => !CAST.get("min").hidden, 120);
        ok("D at the foot of the stairs: Kru Min comes down them", !CAST.get("min").hidden && !!CAST.get("min").path);
        await until(() => CAST.arrived("min"), 900);
        const m = CAST.get("min");
        ok("D ...walking down the real stairs (the floor's height under her)", m && Math.abs(m.pos.y) < 0.1 && Math.hypot(m.pos.x - 3.1, m.pos.z + 1.5) < 0.4, m && [m.pos.x, m.pos.y, m.pos.z].map((v) => v.toFixed(2)).join());
        await until(() => G.StoryDialogue.current && G.StoryDialogue.current.who === "min", 200);
        ok("D \"Good luck, both of you. And remember -- no shortcuts.\" -- Beam looks away", G.StoryDialogue.current && G.StoryDialogue.current.line === "story.ch1.d.minLuck" && CAST.get("beam").faceP && CAST.get("beam").faceP.x === 9);
        hold(true); await until(() => beat() >= 18, 900); hold(false);
        await until(() => !CAST.get("min"), 900);
        ok("D she goes off along the corridor, and is gone; Beam following again", !CAST.get("min") && CAST.get("beam").follow);
        note("D");
      }

      // ================= E: part 4, Room 305 =================
      {
        at(-1.5, 8, -1.2); step(4);
        at(-1.5, 8, -3.9); step(4);
        ok("E Room 305 (3F): the objective a seat; Beam (brought along) makes for his", run0().objective === "story.ch1.obj.seat" && USE.has("seat") && !!CAST.get("beam").path, run0().objective);
        await until(() => CAST.arrived("beam"), 600);
        step(20);
        const bm = CAST.get("beam");
        ok("E ...and sits at it (B1, beside the player's), scratching behind his ear (the patch)", bm.pose === "scratch" && Math.hypot(bm.pos.x + 1.96, bm.pos.z + 8) < 0.2 && Math.abs(bm.pos.y - 8) < 0.1, [bm.pos.x, bm.pos.y, bm.pos.z].map((v) => v.toFixed(2)).join());
        at(-1.5, 8, -5.4);
        const pr = useAt(-1.96, 8.45, -6.4);
        ok("E E: Sit down -- seated: the feet held, the eyes lower", /sit/i.test(pr) && CAM.seated, pr);
        const x0 = g.yawObject.position.x;
        G.Input.keys[kb.forward] = true; step(30); G.Input.keys[kb.forward] = false;
        ok("E ...walking does nothing; the eyes some 0.48 m lower", Math.abs(g.yawObject.position.x - x0) < 0.01 && Math.abs(CAM.drop - (G.CONFIG.story.cam.seatDrop || 0.48)) < 0.01 && Math.abs(feet() + CAM.drop - 8) < 0.05, (feet() + CAM.drop).toFixed(2));
        ok("E the back door shut behind them; the glasses on the desk", g.world.storyMap.doors.DR305 && !g.world.storyMap.doors.DR305.open && CAST.propIds().includes("lens"));
        hold(true); await until(() => USE.has("lens"), 900); hold(false);
        const pl = useAt(-2.5, 8.8, -6.4);
        ok("E E: Put on the LexiLens -- the glasses' look, the word box boots, the calibration line (the candidate's name)", /LexiLens/i.test(pl) && LL.on && parts() === "word" && LL.line && LL.line.key === "story.ch1.sys.calib" && !CAST.propIds().includes("lens"), pl);
        await until(() => QZ.active, 600);
        const s = QZ.state, it0 = s && s.items[0];
        ok("E the practice exam: three answers in the air ahead, the glasses' dot, a hint (touch: the trigger back for it)", document.body.classList.contains("story-quiz") && QZ.active && s.opts.length === 3 && !document.getElementById("story-dot").classList.contains("hidden") && /answer/i.test(SCR.state.hint || ""));
        const box = (document.querySelector(".hud-meaning") || {}).innerText || "", lab = (document.querySelector(".hud-meaning-label") || {}).innerText || "";
        const e0 = G.WordBank.byId("scholarship"), m0 = G.WordBank.pairOf(e0)[1];
        ok("E ...the question in the word box (its meaning), \"Question 1 of 3\"", box.indexOf(m0) >= 0 && /1/.test(lab) && /3/.test(lab) && it0.options.slice().sort().join() === "schedule,scholar,scholarship", box + " | " + lab);
        const sch0 = stat("scholarship"), inv0 = stat("invigilator"), can0 = stat("candidate");
        const answers = [];
        for (let i = 0; i < 3; i++) {
          await until(() => QZ.active && QZ.state.lock <= 0 && QZ.state.wait <= 0, 300);
          const st = QZ.state; if (!st) break;
          const it = st.items[st.i], k = i === 1 ? (it.answer + 1) % 3 : it.answer, o = st.opts[k];
          look(o.s.position.x, o.s.position.y, o.s.position.z); step(2);
          const hot = st.hot === k;
          G.Input.mouseDown = true; step(1); G.Input.mouseDown = false; step(1);
          const xc = document.getElementById("hud-xcard");
          answers.push({ hot, res: st.results[st.results.length - 1], card: xc ? xc.className + " " + xc.innerText.slice(0, 60) : "" });
        }
        ok("E aimed at an answer, it lights; the trigger answers it", answers.length === 3 && answers.every((a) => a.hot && a.res), JSON.stringify(answers.map((a) => a.hot)));
        ok("E right, wrong, right -- the card under the word box says why (green, red)", answers[0].res.right && !answers[1].res.right && answers[2].res.right && /ok/.test(answers[0].card) && /bad/.test(answers[1].card), answers.map((a) => a.card).join(" || "));
        ok("E Q2 the invigilator, Q3 a sentence with a gap (in English: the exam's)", answers[1].res.word === "invigilator" && answers[2].res.word === "candidate");
        await until(() => !QZ.active, 400);
        ok("E the bank's word (scholarship) counted in its memory box; invigilator and candidate (not in the bank yet) practice", stat("scholarship") !== sch0 && stat("invigilator") === inv0 && stat("candidate") === can0 && has("quiz:exam"), stat("scholarship"));
        note("E");
      }

      // ================= F: part 5, the spike =================
      {
        hold(true);
        await until(() => G.StoryDialogue.current && G.StoryDialogue.current.line === "story.ch1.d.invigLoop", 900);
        ok("F the invigilator: \"...forty... forty...\" -- his voice looping", G.StoryDialogue.current && G.StoryDialogue.current.who === "invig");
        await until(() => G.StoryLight.current === "alarm", 900);
        ok("F ANOMALY DETECTED (red), the lights failing (the alarm's set), the fire bell", G.StoryLight.current === "alarm" && SCR.state.loops.includes("bell") && LL.line && (LL.line.red || /anomaly|warn/i.test(LL.line.key)));
        await until(() => CAST.get("beam").who === "beam_z", 600);
        const bm = CAST.get("beam");
        ok("F Beam stands, turns (his zombie self), TOGETHER over his head (flickering)", bm.who === "beam_z" && bm.pose === "stand" && bm.label && bm.labelWord === "TOGETHER" && bm.flicker);
        await until(() => beat() >= 28, 1200);
        hold(false);
        ok("F the other candidates turn too, the invigilator as well (people still: nothing to shoot yet)", ["c1", "c2", "c3", "c4", "c5", "c6"].every((id) => /^z[mf]\d$/.test(CAST.get(id).who)) && CAST.get("invig").who === "invig_z" && g.zombies.length === 0);
        ok("F health and stamina boot (VITAL MONITORING), stood up; the objective: get out", parts() === "vitals,word" && !CAM.seated && run0().objective === "story.ch1.obj.out");
        await until(() => USE.qteActive, 900);
        ok("F Beam comes at the player: a press in time (a ring closing on its mark)", USE.qteActive && CAST.get("beam").lunge && !document.getElementById("story-qte").classList.contains("hidden"));
        // a miss first: pressed far too early -- a hit taken, never the last of the health
        g.player.hp = 5;
        G.onKeyDown({ code: kb.interact, repeat: false, preventDefault() {} }); step(2);
        ok("F pressed too early: missed -- a hit taken, but never below 1", USE.qte0.misses >= 1 && g.player.hp >= 1 && g.player.hp < 5, g.player.hp);
        await until(() => USE.qte0 && USE.qte0.pause <= 0 && USE.qte0.t > 0, 200);
        await until(() => { const qq = USE.qte0; return qq && Math.abs((2.2 - 1.2 * qq.t / qq.sec) - 1) < qq.win * 0.5; }, 300);
        G.onKeyDown({ code: kb.interact, repeat: false, preventDefault() {} }); step(2);
        ok("F pressed as the rings meet: Beam shoved back", has("qte:push") && CAST.get("beam").knock > 0 && !CAST.get("beam").lunge);
        g.player.hp = g.player.maxHp;
        step(40);
        ok("F the front door jammed (a hint), the objective the back door; Sgt. Chai and the papers out in the corridor now", run0().objective === "story.ch1.obj.kick" && /jammed/i.test(SCR.state.hint || "") && !g.world.storyMap.doors.DR305F.open && USE.has("kick"));
        at(-1.5, 8, -3.9);
        const pk = useAt(-1.5, 9.0, -2.6);
        step(2);
        ok("F E: Kick the door open -- it bursts open (a thud, the view shaken); run (a hint on running)", /kick/i.test(pk) && g.world.storyMap.doors.DR305.open && run0().objective === "story.ch1.obj.run" && /run/i.test(SCR.state.hint || "") && !CAST.get("chai2").hidden, pk);
        note("F");
      }

      // ================= G: part 6, the corridor and the first gun =================
      {
        at(-1.5, 8, -0.6); step(4);
        ok("G in the corridor: the bars, the view turned to Sgt. Chai on the floor against the wall", CAM.barsOn && CAST.get("chai2").pose === "floor");
        hold(true);
        await until(() => !g.handsFree(), 900);
        hold(false);
        ok("G \"Take it!\" -- his pistol in the hands (the hands armed, the touch buttons back)", !document.body.classList.contains("story-hands-free") && !g.handsFree() && G.ViewModel.visible !== false && g.currentWeaponId() === "pistol");
        const vm = g.weaponViewGroup;
        let vox = 0; if (vm) vm.traverse((o) => { if (o.isMesh && o.userData.voxelGun) vox++; });
        ok("G ...built of blocks (the slide, the frame, the magazine, the sights' dots), still racked and reloaded as the game's pistol", vm && vm.userData.voxelGun && vox >= 3 && !!(vm.userData.parts && vm.userData.parts.bolt && vm.userData.parts.mag), vox + " meshes");
        ok("G the whole HUD (the ammo, the words), EXAM RESUMED with the meaning asked", parts() === "ammo,labels,vitals,word");
        await until(() => alive().length === 3, 300);
        const words = alive().map((z) => z.word).sort().join(), janitor = alive().find((z) => z.word === "clean");
        const gl = (CH.practice.clean[G.Lang.meaning()] || CH.practice.clean.en);
        ok("G three zombies: CLEAN, CLEAR, LEAN -- the janitor's CLEAN the target, its meaning in the word box", words === "clean,clear,lean" && janitor && janitor.look && janitor.look.voxel === "porn_z" && g.targetPair && g.targetPair[0] === "clean" && g.targetPair[1] === gl, words + " | " + (g.targetPair && g.targetPair.join("=")));
        ok("G ...practice words: no box, no total (z.practice)", alive().every((z) => z.practice));
        const right0 = g.correctCount, wrong0 = g.wrongCount, st = [stat("clean"), stat("clear"), stat("lean")].join();
        // shoot by the gun: aimed at a zombie's head, the trigger pulled until it is down
        const shoot = async (z) => {
          for (let i = 0; i < 24 && z.alive; i++) {
            const n = z.mesh.userData.neck, p = new THREE.Vector3(); (n || z.mesh).getWorldPosition(p); p.y += n ? 0.22 : 1.5;
            look(p.x, p.y, p.z); step(1);
            g.player.fireCooldown = 0; G.onFirePress(); step(2);
            if (g.player.ammo.pistol.mag <= 0) { g.player.ammo.pistol.mag = 6; }
            for (let k = 0; k < 8; k++) step(1);
            await yield0();
          }
          return !z.alive;
        };
        const wrongZ = alive().find((z) => z.word === "clear");
        const downW = await shoot(wrongZ);
        step(4);
        const xc = document.getElementById("hud-xcard");
        ok("G a wrong one shot: the card says why (clear = its meaning; clean = what was asked)", downW && xc && /bad/.test(xc.className) && /clear/i.test(xc.innerText) && /clean/i.test(xc.innerText), xc && xc.innerText.slice(0, 90));
        const downR = await shoot(janitor);
        step(4);
        ok("G the right one: CORRECT. Neural pattern disrupted.", downR && LL.line && LL.line.key === "story.lens.correct");
        for (const z of alive()) await shoot(z);
        await until(() => alive().length === 0, 200);
        ok("G ...counted nowhere: no right or wrong in the totals, no memory box", g.correctCount === right0 && g.wrongCount === wrong0 && [stat("clean"), stat("clear"), stat("lean")].join() === st);
        await until(() => run0().objective === "story.ch1.obj.reload", 300);
        ok("G the group down: the objective a reload (a hint with its key)", run0().objective === "story.ch1.obj.reload" && /reload/i.test(SCR.state.hint || "") && !has("reloaded"));
        g.player.ammo.pistol.mag = Math.min(g.player.ammo.pistol.mag, 5);
        G.onKeyDown({ code: kb.reload, repeat: false, preventDefault() {} });
        await until(() => has("reloaded"), 400);
        ok("G R: reloaded (the game's own reload) -- Sgt. Chai's \"Go...\", PROTECT flickering over him", has("reloaded") && (await until(() => G.StoryDialogue.current && G.StoryDialogue.current.who === "chai", 300)) && CAST.get("chai2").labelWord === "PROTECT");
        note("G");
      }

      // ================= H: part 7, Kru Min's message =================
      {
        hold(true); await until(() => has("msg:min1"), 900); hold(false);
        ok("H Kru Min's message arrives (a hint on reading it)", has("msg:min1") && /Kru Min/i.test(SCR.state.hint || ""));
        G.StoryPhone.open("min"); step(1); G.StoryPhone.close(); step(2);
        ok("H read: the chapter's title across the screen, its first objective (the library, the east stairs)", has("read:min") && SCR.state.title && run0().objective === "story.ch1.obj.library" && /LOST FOR WORDS/.test((document.getElementById("story-title") || {}).innerText || ""));
        await until(() => run0().scene.id === "s1", 600);
        const d = S.data("ch1");
        ok("H the prologue done (Skip Prologue from now on), a checkpoint at scene 1's start", run0().scene.id === "s1" && d.prologueDone && d.cp && d.cp.scene === 1 && Array.isArray(d.cp.guns) && d.cp.guns.includes("pistol"));
        ok("H scene 1: armed, the whole HUD, its people and things gone with the prologue", !g.handsFree() && parts() === "ammo,labels,vitals,word" && CAST.ids().length === 0 && CAST.propIds().length === 0 && USE.ids().length === 0);
        numbers.prologueSec = +(frames / 60).toFixed(0);
        numbers.realSec = Math.round((performance.now() - t0) / 1000);
        note("H");
      }

      // ================= I: around it =================
      {
        // the prologue cannot be lost
        play(() => S.start("ch1", null));
        g.player.hp = 3;
        g.player.hp -= 50; g.checkPlayerDeath(); step(2);
        ok("I the prologue cannot be lost: health stops at 1, no death window", g.player.hp >= 1 && !G.Dialog.isOpen() && run0().scene.id === "prologue");
        // Skip Prologue
        quit();
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        ok("I Skip Prologue: scene 1 with the gun and the whole HUD, no black, no seat", run0().scene.id === "s1" && !g.handsFree() && parts() === "ammo,labels,vitals,word" && !SCR.state.black && !CAM.seated && G.ViewModel.visible !== false);
        ok("I ...the pistol built of blocks there too (a chapter's level)", !!(g.weaponViewGroup && g.weaponViewGroup.userData.voxelGun));
        // the campaign after it
        quit();
        play(() => g.startLevel(1));
        let vox = false; if (g.weaponViewGroup) g.weaponViewGroup.traverse((o) => { if (o.userData && o.userData.voxelGun) vox = true; });
        ok("I the campaign after it: the gun shown, its own (not blocks), the eyes up, nothing of the prologue left", !g.handsFree() && G.ViewModel.visible !== false && !vox && CAM.drop === 0 && !CAM.seated && !document.body.classList.contains("story-black-on")
          && !g.world.interactables.some((i) => i.kind === "story") && !g.scene.children.some((o) => o.userData && o.userData.cast));
        quit();
      }
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ") + " | trace " + trace.join(" "));
    } finally {
      G.CONFIG.story.enabled = enabled0;
      G.Input.keys[kb.jump] = false; G.Input.mouseDown = false; G.Input.aimDown = false;
      G.Input.mode = mode0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
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
