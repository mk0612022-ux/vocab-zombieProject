// Dev-only (not shipped). The story series' round 6: Chapter 1's scenes 1-1 "The Long
// Corridor" and 1-2 "Words Are the Map", played through by their own inputs (the interaction
// ray, the phone, a choice, the trigger, a crowbar's swing, the letter lock's keys, mouse wheel,
// a swipe and a controller's D-pad) -- and what they are made of (js/story/wheellock.js,
// whisper.js; scenes.js' rules and new conditions and actions; interact.js' doors and uses
// that wait; screen.js' plan card; cast.js' crowd on the glass).
//   A  1-1's start: 3F as the prologue left it (Sgt. Chai, the papers), bags abandoned, the
//      alarm's light and bell, the stairs shut, 302 / 307 / the janitor's room / the toilets open,
//      24 rounds, the "abandoned" line; the objective the evacuation route
//   B  the evacuation plan: read by the game's prompt, the card's plan (the storey's rooms from
//      the map, YOU ARE HERE, the route to the east stairwell), the objective after it
//   C  the main stairs: the crowd behind the glass (the view turned to it, the red line), Kru
//      Min's text read, a reply chosen, her answer to that reply
//   D  the Shamblers: three down the corridor (the chapter's words), two out of the toilets
//      behind; shot with their right words; their whispers ([whisper: "word"], said softly)
//   E  off the way: 302 (a Shambler behind the desk, a box of rounds), the lockers (two
//      magazines), Beam's note, the toilets' notice (a bank word to tap)
//   F  the east door tried without the crowbar (the design's hint); the janitor's photos; the
//      crowbar (the melee slot, a hint, three more Shamblers -- one down by a swing); the door
//      pried open; down to 2F: the checkpoint, scene 1-2
//   G  1-2's start: the dark (the blackout set, the bell stopped), the torch, the doors shut,
//      the crowd on this floor too; Kru Min's directions read
//   H  rooms opened by hand: the store room's Shambler; a minute gone by: Kru Min's hint; the
//      music room; the library's front door barricaded (tried): the back door and its clue
//   I  the letter lock: up at the door with the world going on, the feet held; turned by the
//      keys, the mouse wheel, a swipe, the D-pad; a wrong word (marked, the card, the first try
//      counted); the Sprinters (PE kit) come -- the lock left by itself, the letters kept;
//      another wrong word: Nam's clue; TEMPORARY: the door open, the three inside
//   J  into the library: the checkpoint, scene 1-3 with the three waiting; the save's flags
//   K  around it: the campaign after (no lock window, no whisper, the knife), draw calls, strings
// Load it into the game (in the lobby), then:
//   const r = await G.Round44Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round44Test = (function () {
  const yield0 = () => new Promise((r) => setTimeout(r, 0));

  async function run() {
    const results = [], errs = [], numbers = {}, trace = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t44 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, CH = G.STORY_CHAPTERS.ch1, CAST = G.StoryCast, USE = G.StoryUse, LOCK = G.StoryLock, SCR = G.StoryScreen, LL = G.LexiLens, PH = G.StoryPhone;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, speak0 = G.Audio.speak, pad0 = G.Input.pollGamepad;
    const real = g._update0 || g.update;
    const kb = G.save.settings.keybinds;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const mode0 = G.Input.mode;
    // (what is said is heard here: the whispers, softly)
    const spoken = [];
    G.Audio.speak = function (w, o) { spoken.push({ w, o: o || {} }); };
    let frames = 0;
    // (a fight goes on for a while here: the health topped up once it is low -- a story death is suite 39's)
    const step = (n, dt) => { for (let i = 0; i < n; i++) { real.call(g, dt || 1 / 60); frames++; if (g.player && g.player.hp < g.player.maxHp * 0.3) g.player.hp = g.player.maxHp; } };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const run0 = () => S.run;
    const has = (f) => !!(S.run && S.run.flags.has(f));
    const at = (x, y, z) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    const look = (x, y, z) => { const e = g.yawObject.position, dx = x - e.x, dz = z - e.z, dy = y - e.y; g.yawObject.rotation.y = Math.atan2(-dx, -dz); g.pitchObject.rotation.x = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz)))); g.yawObject.updateMatrixWorld(true); };
    const until = async (fn, n) => { for (let i = 0; i < (n || 600); i++) { if (fn()) return true; step(1); if (i % 40 === 39) await yield0(); } return !!fn(); };
    const note = (tag) => trace.push(tag + "@" + (S.run ? S.run.scene.id + ":" + S.run.beatI : "-") + "/" + frames);
    const promptText = () => ((document.getElementById("hud-interact-prompt") || {}).innerText || "").trim();
    const useAt = (x, y, z) => { look(x, y, z); step(1); g.updateInteractRay(); const p = promptText(); g.doInteract(); step(1); return p; };
    const dialogBtns = () => Array.from(document.querySelectorAll("#dialog-btns .btn")).map((b) => b.innerText);
    const choose = (re) => { const i = dialogBtns().findIndex((t) => re.test(t)); if (i >= 0) G.Dialog.choose(i); return i; };
    const closeCard = () => { if (G.Dialog.isOpen()) G.Dialog.choose(0); step(2); };
    const key = (code) => G.onKeyDown({ code, repeat: false, preventDefault() {}, stopPropagation() {} });
    const alive = () => g.zombies.filter((z) => z.alive);
    const stat = (w) => { const s = G.save.wordStats && G.save.wordStats[w]; const l = G.save.learn && G.save.learn[w]; return JSON.stringify([s || null, l || null]); };
    const M = () => g.world.storyMap;
    const doorOpen = (id) => !!(M().doors[id] && M().doors[id].open);
    // shoot by the gun: aimed at the head, the trigger pulled until it is down (the right word first)
    const shoot = async (z) => {
      for (let i = 0; i < 30 && z.alive; i++) {
        const n = z.mesh.userData.neck, p = new THREE.Vector3(); (n || z.mesh).getWorldPosition(p); p.y += n ? 0.22 : 1.5;
        look(p.x, p.y, p.z); step(1);
        g.player.fireCooldown = 0; G.onFirePress(); step(2);
        if (g.player.ammo.pistol.mag <= 0) g.player.ammo.pistol.mag = 6;
        for (let k = 0; k < 8; k++) step(1);
        await yield0();
      }
      return !z.alive;
    };
    const target = () => alive().find((z) => g.targetPair && z.word === g.targetPair[0]) || alive()[0];
    const clearGroup = async (id) => { for (let i = 0; i < 12; i++) { const left = alive().filter((z) => !id || z.storyGroup === id); if (!left.length) break; const t = left.find((z) => g.targetPair && z.word === g.targetPair[0]) || left[0]; await shoot(t); step(3); } return !alive().some((z) => !id || z.storyGroup === id); };
    // a door of the map's, opened by hand: stood before it, looked at, used
    const openDoor = (id, side) => {
      const d = M().doorInfo(id), s = side || (d.z < 0 ? 1 : -1);
      at(d.axis === "x" ? d.x : d.x + s * 1.3, d.y, d.axis === "x" ? d.z + s * 1.4 : d.z);
      return useAt(d.x, d.y + 1.05, d.z);
    };

    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      // (a play of the chapter elsewhere in this browser leaves its cinematic parts "seen")
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
      G.Input.mode = "desktop";
      if (G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality(); }
      const t0 = performance.now();

      // ================= A: 1-1's start =================
      {
        play(() => S.start("ch1", { scene: 1, beat: 0, skip: true }));
        step(3);
        const r = run0(), chai = CAST.get("chai");
        ok("A 1-1 The Long Corridor on 3F: the alarm's light, the fire bell still ringing", r.scene.id === "s1" && G.StoryLight.current === "alarm" && SCR.state.loops.includes("bell") && Math.abs(g.yawObject.position.y - 9.7) < 0.3);
        ok("A as the prologue left it: Sgt. Chai on the floor by the lockers, PROTECT flickering; the papers, the box", chai && chai.pose === "floor" && chai.labelWord === "PROTECT" && chai.flicker && ["lockers", "pp1", "pp2", "pp3", "box"].every((id) => CAST.propIds().includes(id)));
        ok("A bags and answer sheets abandoned down the corridor; the line: \"Belongings abandoned\"", CAST.propIds().filter((id) => /^bag/.test(id)).length >= 5 && CAST.propIds().filter((id) => /^pp/.test(id)).length >= 6 && LL.line && LL.line.key === "story.ch1.sys.abandon");
        ok("A the stairs shut (the main stairs' glass, the jammed east door, the back stairs); 302, 307, the janitor's room, the toilets open; 305 shut",
          !doorOpen("STAIRM3") && !doorOpen("STAIRE3") && !doorOpen("STAIRB3") && doorOpen("DR302") && doorOpen("DR307") && doorOpen("DJANITOR") && doorOpen("DWC3") && !doorOpen("DR305") && !doorOpen("DR301"));
        ok("A 24 rounds (12 in the pistol, 12 more): enough to try the crowbar, not so few to be stuck", g.player.ammo.pistol.mag === 12 && g.player.ammo.pistol.reserve === 12 && g.player.melee === "knife", JSON.stringify(g.player.ammo.pistol));
        ok("A the objective: the evacuation route; a hint at the plan on the wall", r.objective === "story.ch1.s1.obj0" && g.buildHudState().currentMeaning === G.T("story.ch1.s1.obj0") && /evacuation plan/i.test(SCR.state.hint || ""), SCR.state.hint);
        ok("A the things to use: the plan, the lockers, Beam's locker, the notice, the photos, the crowbar, the east door", ["evac", "lockers", "beamLocker", "notice", "photo", "crowbar", "pry"].every((id) => USE.has(id)), USE.ids().join());
        note("A");
      }

      // ================= B: the evacuation plan =================
      {
        at(-5.5, 8, 0.2);
        const p = useAt(-5.5, 9.6, -1.95);
        ok("B looked at the plan: the game's prompt \"E: Read the evacuation plan\"", /evacuation plan/i.test(p) && /E/.test(p), p);
        const body = document.getElementById("dialog-body"), svg = body && body.querySelector("svg.story-plan");
        const texts = svg ? Array.from(svg.querySelectorAll("text")).map((t) => t.textContent) : [];
        numbers.planRooms = texts.filter((t) => /^3\d\d$/.test(t)).length;
        ok("B the card: the 3rd floor's plan drawn from the map -- its 13 numbered rooms, the janitor's, the toilets, the stairs", G.Dialog.isOpen() && svg && numbers.planRooms === 13 && texts.includes("JANITOR") && texts.includes("WC") && texts.includes("MAIN STAIRS"), texts.join("|").slice(0, 200));
        ok("B ...EVACUATION ROUTE, YOU ARE HERE (a red dot by 305), the green route to the EAST STAIRWELL, EMERGENCY EXIT", texts.includes("EVACUATION ROUTE") && texts.includes("YOU ARE HERE") && texts.includes("EAST STAIRWELL") && texts.includes("EMERGENCY EXIT")
          && !!svg.querySelector("circle.pl-here") && !!svg.querySelector("polyline.pl-route") && !!svg.querySelector(".pl-exit"));
        ok("B ...and its line in English, subtitled", /follow the green arrows to the east stairwell/i.test(body.querySelector(".scl-en").innerText) && (G.lang === "en" || !!body.querySelector(".scl-sub")));
        ok("B no objective yet while it is open (the design: once it is read)", run0().objective === "story.ch1.s1.obj0");
        closeCard(); step(2);
        ok("B read: the objective -- reach the east stairwell", run0().objective === "story.ch1.s1.obj" && has("card:evac"));
        note("B");
      }

      // ================= C: the main stairs =================
      {
        at(0.2, 8, 0.3); at(3.2, 8, 0.4);
        ok("C past the main stairs: the view turned to the crowd behind the glass, the red line", has("on:glass") && G.StoryCam.turning && LL.line && LL.line.key === "story.ch1.sys.crowd" && LL.line.red);
        const gl = ["gl1", "gl2", "gl3", "gl4", "gl5"].map((id) => CAST.get(id));
        step(30);
        ok("C ...five packed against the glass, fists on it (heard near): the doors shut between", gl.every((n) => n && n.pose === "bang" && n.model.visible && n.near) && !doorOpen("STAIRM3") && !M().doors.STAIRM3.collider.isEmpty());
        await until(() => has("msg:min2"), 300);
        ok("C Kru Min writes: \"Are you OK? Reply if you can.\" (a hint to read it)", has("msg:min2") && /Kru Min/i.test(SCR.state.hint || ""));
        PH.open("min"); step(1); PH.close(); step(2);
        await until(() => G.Dialog.isOpen(), 200);
        const bt = dialogBtns();
        ok("C read: a reply to choose -- \"On my way.\" or \"Beam... he turned.\"", G.Dialog.isOpen() && bt.some((t) => /On my way/i.test(t)) && bt.some((t) => /he turned/i.test(t)), bt.join(" | "));
        choose(/he turned/i); step(3);
        await until(() => has("msg:min3b"), 120);
        ok("C ...\"Beam... he turned.\": her answer \"I'm sorry. Keep moving. East stairs.\" (the other never comes)", has("msg:min3b") && !has("msg:min3a") && has("chose:min:turned") && G.save.story.ch.ch1.choices.min === "turned");
        note("C");
      }

      // ================= D: the Shamblers =================
      {
        const right0 = g.correctCount, wrong0 = g.wrongCount;
        at(10.6, 8, 0);
        step(2);
        const g1 = alive().filter((z) => z.storyGroup === "g1");
        ok("D on past the stairs: three Shamblers down the corridor from the east", g1.length === 3 && g1.every((z) => z.type === "normal") && has("on:g1"), g1.map((z) => z.type).join());
        const words = g1.map((z) => z.word);
        ok("D ...each with a word of the chapter's question (the chapter's words and the ones due)", words.every((w) => typeof w === "string" && w.length > 1) && !!g.targetPair && words.includes(g.targetPair[0]), words.join());
        // (they walk in: within reach, the nearest whispers its word)
        await until(() => spoken.some((s) => s.o.whisper), 400);
        const wh = spoken.find((s) => s.o.whisper), cap = document.getElementById("story-whisper");
        ok("D a zombie near whispers its own word: said softly (G.Audio.speak whisper), the caption [whisper: \"...\"]", !!wh && words.includes(wh.w) && cap && !cap.classList.contains("hidden") && cap.textContent === G.T("story.whisper", { word: wh.w }), wh && wh.w);
        const down1 = await clearGroup("g1");
        // (a stray round in a bunch can down another first: whatever kills one answers its word -- the game's rule)
        const nR = g.correctCount - right0, nW = g.wrongCount - wrong0;
        ok("D shot down by the trigger, the question's word first: each down an answer (a stray hit on another a wrong one)", down1 && nR >= 1 && nR + nW === 3, nR + " right, " + nW + " wrong");
        at(17.5, 8, 0);
        await until(() => alive().some((z) => z.storyGroup === "g2"), 120);
        const g2 = alive().filter((z) => z.storyGroup === "g2");
        ok("D further on: two out of the toilets, behind", g2.length === 2 && g2.every((z) => z.mesh.position.z > 3), g2.map((z) => z.mesh.position.z.toFixed(1)).join());
        ok("D ...down too", await clearGroup("g2"));
        note("D");
      }

      // ================= E: off the way =================
      {
        const res0 = g.player.ammo.pistol.reserve;
        at(-27.5, 8, -1.2); at(-27.5, 8, -4.2);
        step(2);
        const h = alive().filter((z) => z.storyGroup === "h302");
        ok("E room 302 looked into: a Shambler behind the desk, a box of rounds on the floor", h.length === 1 && (g.drops || []).some((d) => d.kind === "ammo"));
        await clearGroup("h302");
        const drop = (g.drops || []).find((d) => d.kind === "ammo");
        const resA = g.player.ammo.pistol.reserve;
        if (drop) { at(drop.mesh.position.x, 8, drop.mesh.position.z); step(10); }
        ok("E ...picked up: two magazines", !(g.drops || []).some((d) => d === drop) && g.player.ammo.pistol.reserve - resA === 24, resA + " -> " + g.player.ammo.pistol.reserve);
        at(16, 8, 0.2);
        const resB = g.player.ammo.pistol.reserve;
        const pl = useAt(16, 9.1, 1.75);
        ok("E the lockers by the toilets: \"Search the lockers\" -- two more magazines, \"+24 rounds\"", /Search the lockers/i.test(pl) && g.player.ammo.pistol.reserve - resB === 24 && !USE.has("lockers"), pl);
        at(-12, 8, 0.2);
        const pb = useAt(-12, 9.1, 1.75);
        const nb = document.getElementById("dialog-body");
        ok("E Beam's locker: his note -- \"Same uni. Same city. Together.\"", /Beam's locker/i.test(pb) && G.Dialog.isOpen() && /Same uni\. Same city\. Together\./.test(nb.innerText), pb);
        closeCard();
        at(13.8, 8, 6.2);
        const pn = useAt(15.94, 9.55, 6);
        const words = Array.from(document.querySelectorAll("#dialog-body .sd-word")).map((w) => w.innerText.toLowerCase());
        ok("E the toilets' notice: the nurse's warning in English, \"symptoms\" a word to tap (the bank's)", /Read the notice/i.test(pn) && /Ignoring these symptoms may have serious consequences/.test(document.getElementById("dialog-body").innerText) && words.some((w) => /symptom/.test(w)), words.join());
        closeCard();
        numbers.ammoFound = g.player.ammo.pistol.reserve - res0;
        note("E");
      }

      // ================= F: the east door, the crowbar =================
      {
        at(22.6, 8, 0);
        step(2);
        ok("F at the east door without the crowbar: the hint \"The door is jammed. Maybe the janitor's room has something.\"", has("on:jam") && SCR.state.hint === G.T("story.hint.jammed"));
        at(23.1, 8, 0);
        const pj = useAt(24.3, 9.0, 0);
        ok("F tried: \"E: Open the door\" -- jammed (the hint again), still shut", /Open the door/i.test(pj) && has("tried:pry") && !doorOpen("STAIRE3") && SCR.state.hint === G.T("story.hint.jammed"), pj);
        at(12.4, 8, -3.6); at(14.4, 8, -6);
        const pp = useAt(15.94, 9.5, -6);
        ok("F the janitor's room: his photos with the students, year after year (\"...keeping our school clean!\")", /Look at the photos/i.test(pp) && /keeping our school clean/.test(document.getElementById("dialog-body").innerText), pp);
        closeCard();
        at(14.4, 8, -5.8);
        const pc = useAt(15.9, 8.95, -5.8);
        ok("F the crowbar: \"Take the crowbar\" -- in the melee slot, off the wall; a hint on its swing (Z)", /Take the crowbar/i.test(pc) && g.player.melee === "crowbar" && !CAST.propIds().includes("crowbar") && /swing the crowbar/i.test(SCR.state.hint || ""), pc + " | " + SCR.state.hint);
        await until(() => alive().filter((z) => z.storyGroup === "g3").length === 3, 300);
        ok("F ...and three more Shamblers coming to try it on", alive().filter((z) => z.storyGroup === "g3").length === 3);
        // one down by a swing: stood before the question's one, its chest looked at, Z
        const right0 = g.correctCount;
        let swung = false;
        for (let tries = 0; tries < 4 && !swung; tries++) {
          const z = target();
          if (!z) break;
          const zp = z.mesh.position, d = Math.hypot(zp.x - 14, zp.z + 4) || 1;
          at(zp.x + (14 - zp.x) / d * 1.25, 8, zp.z + (-4 - zp.z) / d * 1.25);
          const c = new THREE.Vector3(); (z.mesh.userData.neck || z.mesh).getWorldPosition(c);
          look(c.x, c.y - 0.35, c.z); step(1);
          key(kb.quickMelee); step(40);
          swung = !z.alive;
        }
        ok("F a swing of the crowbar (Z): one down -- its word answered, no bullet spent", swung && g.correctCount > right0, (g.correctCount - right0) + " right");
        await clearGroup("g3");
        at(23.1, 8, 0);
        const pr = useAt(24.3, 9.0, 0);
        ok("F the east door: \"Pry the door open with the crowbar\" -- open; the objective the second floor", /Pry the door open/i.test(pr) && doorOpen("STAIRE3") && run0().objective === "story.ch1.s1.obj2", pr);
        // down the east stairs: at their foot on 2F
        at(25.6, 4, -0.6);
        step(3);
        const d = G.save.story.ch.ch1;
        ok("F down to 2F: the checkpoint (scene 1-2's start), the crowbar kept in it, scene 1-2", run0().scene.id === "s2" && d.cp && d.cp.scene === 2 && d.cp.melee === "crowbar" && d.cp.x === CH.scenes[2].start.x);
        const fl = d.cp.flags || [];
        ok("F ...1-1's own flags left behind (the save's 120 kept for what lasts: the messages, the choices)", !fl.some((f) => /^(on|used|tried|card):/.test(f)) && fl.includes("msg:min3b") && fl.includes("chose:min"), fl.join());
        note("F");
      }

      // ================= G: 1-2's start =================
      {
        step(2);
        ok("G 1-2 Words Are the Map: the power gone -- the blackout set, the bell stopped, \"Power failure\"", G.StoryLight.current === "blackout" && !SCR.state.loops.includes("bell") && LL.line && LL.line.key === "story.ch1.sys.power");
        ok("G ...a hint on the phone's torch (L)", /torch/i.test(SCR.state.hint || ""), SCR.state.hint);
        key(kb.flashlight); step(3);
        ok("G L: the torch on", !!(PH.state && PH.state.torch) && document.body.classList.contains("torch-on"));
        ok("G the doors shut, each one to open by hand; the library's back door a letter lock", ["DMUSIC", "DSTAFF", "DSTORE2", "DSCIENCE", "DLAB", "DLIBRARY", "LIBBACK"].every((id) => !doorOpen(id))
          && ["DMUSIC", "DSTAFF", "DSTORE2", "DLIBRARY"].every((id) => USE.has("door:" + id)) && LOCK.ids().includes("back") && USE.has("lock:back"));
        ok("G the main stairs on this floor too: the crowd behind the glass; the three in the library unseen", ["gl1", "gl2", "gl3", "gl4"].every((id) => CAST.get(id) && CAST.get(id).pose === "bang") && ["min", "nam", "tonkla"].every((id) => CAST.get(id) && CAST.get(id).hidden));
        await until(() => has("msg:min4"), 300);
        PH.open("min"); step(1); PH.close(); step(2);
        ok("G Kru Min's directions: \"The library is opposite the music room...\" read", has("msg:min4") && has("dirRead") && /opposite the music room/.test(G.StoryDialogue.en("story.ch1.m.min4")));
        note("G");
      }

      // ================= H: rooms opened by hand =================
      {
        const ps = openDoor("DSTORE2");
        step(2);
        ok("H a door opened by hand: \"E: Open the door\" -- the store room: a Shambler hiding in it", /Open the door/i.test(ps) && doorOpen("DSTORE2") && has("used:door:DSTORE2") && alive().filter((z) => z.storyGroup === "st").length === 1, ps);
        await clearGroup("st");
        // a minute with the directions and nothing found: Kru Min's hint
        at(0, 4, 0);
        step(60 * 12, 1 / 12);
        ok("H a minute gone by, nothing found: Kru Min's hint (\"adjacent... Look for the piano.\")", has("msg:min6") && has("on:hint60"));
        const pm = openDoor("DMUSIC");
        ok("H the music room opened: its piano and drums (how it is known)", doorOpen("DMUSIC") && /Open the door/i.test(pm));
        const pl = openDoor("DLIBRARY");
        step(2);
        ok("H opposite it, the library's front door: barricaded from the inside (tried, a hint)", /Open the door/i.test(pl) && !doorOpen("DLIBRARY") && has("tried:door:DLIBRARY") && SCR.state.hint === G.T("story.hint.libBlocked"));
        await until(() => has("msg:min5"), 120);
        ok("H found: Kru Min -- the back door, its clue (\"something that lasts only for a short time\"); the objective", has("foundLib") && has("msg:min5") && run0().objective === "story.ch1.s2.obj2");
        note("H");
      }

      // ================= I: the letter lock =================
      {
        const sTemp0 = stat("temporary");
        at(-42.2, 4, 6.0);
        const pk = useAt(-40.04, 5.2, 6.4);
        const lockEl = document.getElementById("story-lock");
        ok("I the back door's lock: \"Turn the letter wheels\" -- its window up, nine wheels, Kru Min's clue", /Turn the letter wheels/i.test(pk) && LOCK.holds() && lockEl && !lockEl.classList.contains("hidden") && lockEl.querySelectorAll(".sl-wheel").length === 9 && /short time/.test(lockEl.innerText), pk);
        ok("I ...the world going on behind it (nothing paused, no window); the first time: \"lockopen\"", g.state === "GAMEPLAY" && !g.paused && !G.Modal.isOpen() && has("lockopen:back"));
        const p0 = g.yawObject.position.clone(), y0 = g.yawObject.rotation.y;
        G.Input.keys[kb.forward] = true; step(20); G.Input.keys[kb.forward] = false;
        ok("I ...the feet and the look the lock's (W held: not a step taken)", g.yawObject.position.distanceTo(p0) < 0.01 && g.yawObject.rotation.y === y0);
        // the keys: D a wheel on, W the letter on, S back
        key("KeyD"); key("KeyD"); key("KeyW"); key("KeyW"); key("KeyS");
        let inf = LOCK.info("back");
        ok("I keys: D twice (the third wheel), W twice and S once (A -> B)", inf.sel === 2 && inf.letters[2] === "B", JSON.stringify(inf));
        // the mouse wheel: up turns it on
        document.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
        inf = LOCK.info("back");
        ok("I the mouse wheel: up a letter (B -> C)", inf.letters[2] === "C", inf.letters);
        // a swipe on a wheel (touch): up
        let swiped = false;
        try {
          const w = lockEl.querySelectorAll(".sl-wheel")[4], r = w.getBoundingClientRect();
          const T0 = new Touch({ identifier: 1, target: w, clientX: r.x + 10, clientY: r.y + 40 }), T1 = new Touch({ identifier: 1, target: w, clientX: r.x + 10, clientY: r.y + 6 });
          w.dispatchEvent(new TouchEvent("touchstart", { touches: [T0], targetTouches: [T0], changedTouches: [T0], bubbles: true, cancelable: true }));
          w.dispatchEvent(new TouchEvent("touchmove", { touches: [T1], targetTouches: [T1], changedTouches: [T1], bubbles: true, cancelable: true }));
          w.dispatchEvent(new TouchEvent("touchend", { touches: [], targetTouches: [], changedTouches: [T1], bubbles: true, cancelable: true }));
          swiped = true;
        } catch (e) { swiped = "no touch: " + e.message; }
        inf = LOCK.info("back");
        ok("I a swipe up on the fifth wheel (touch): chosen, a letter on (A -> B)", swiped === true && inf.sel === 4 && inf.letters[4] === "B", swiped + " " + JSON.stringify(inf));
        // the controller: D-pad right, then up held (once, then on and on)
        const btn = (on) => ({ pressed: !!on, value: on ? 1 : 0 });
        const pad = (b) => ({ id: "test pad", connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => btn(b.includes(i))) });
        let gp = pad([]);
        G.Input.pollGamepad = () => gp;
        // (the controller is read once a frame by the game's loop: G.Pad.poll, then the frame)
        const padSteps = (n, b) => { for (let i = 0; i < n; i++) { gp = pad(b); G.Pad.poll(1 / 60); step(1); } };
        padSteps(2, []); padSteps(2, [15]); padSteps(2, []);
        const selPad = LOCK.info("back").sel;
        padSteps(Math.round(60 * (G.CONFIG.story.lock.padDelay + 0.13)), [12]); padSteps(2, []);
        inf = LOCK.info("back");
        G.Input.pollGamepad = pad0; G.Input.padActive = false;
        ok("I the D-pad: right a wheel (the sixth), up held -- a letter, then on (A -> C)", selPad === 5 && inf.letters[5] === "C", selPad + " " + JSON.stringify(inf));
        // a word set by the keys: TEMPORERY (wrong at the 7th) -- Enter
        const setWord = (w) => {
          for (let i = 0; i < w.length; i++) {
            let info = LOCK.info("back");
            while (info.sel !== i) { key(info.sel < i ? "KeyD" : "KeyA"); info = LOCK.info("back"); }
            const want = w.charCodeAt(i) - 65;
            let cur = info.letters.charCodeAt(i) - 65;
            const up = (want - cur + 26) % 26, down = (cur - want + 26) % 26;
            for (let k = 0; k < Math.min(up, down); k++) key(up <= down ? "KeyW" : "KeyS");
          }
          return LOCK.info("back").letters;
        };
        const set1 = setWord("TEMPORERY");
        key("Enter"); step(2);
        inf = LOCK.info("back");
        const xc = document.getElementById("hud-xcard");
        ok("I TEMPORERY, Enter: wrong -- the wrong letter marked red (the 7th), the rest green", set1 === "TEMPORERY" && inf.wrong === 1 && inf.marks && inf.marks.filter((m) => !m).length === 1 && inf.marks[6] === false && lockEl.querySelectorAll(".sl-wheel.bad").length === 1 && has("lockwrong:back:1"), JSON.stringify(inf));
        const xr = xc ? xc.getBoundingClientRect() : { height: 0 };
        ok("I ...the card under the word box (on the screen): the spelling, its letters marked (the explanation system's)", xc && /bad/.test(xc.className) && !!xc.querySelector("mark") && /temporary/i.test(xc.innerText) && xr.height > 0 && getComputedStyle(xc).display !== "none", xc && (xc.innerText.slice(0, 80) + " h=" + Math.round(xr.height)));
        ok("I ...the first try counted as the word's spelling (its memory box): temporary", inf.counted && stat("temporary") !== sTemp0, stat("temporary"));
        // the Sprinters: from the PE room's side, while the lock is up -- it is left by itself
        await until(() => alive().filter((z) => z.storyGroup === "spr").length === 3, 300);
        const spr = alive().filter((z) => z.storyGroup === "spr");
        ok("I Sprinters in PE kit come from the PE room's side (\"Movement detected\")", spr.length === 3 && spr.every((z) => z.type === "fast" && z.look && /^zp\d$/.test(z.look.voxel)) && has("on:sprint"), spr.map((z) => z.type + ":" + (z.look && z.look.voxel)).join());
        await until(() => !LOCK.holds(), 600);
        ok("I ...one near: the player steps back from the lock by themselves (\"Fight first\"), the letters kept", !LOCK.holds() && lockEl.classList.contains("hidden") && LOCK.info("back").letters === "TEMPORERY" && /Fight first/i.test(SCR.state.hint || ""), SCR.state.hint);
        await clearGroup("spr");
        step(2);
        ok("I down: \"Back to the lock -- the letters are still set\"", has("on:back") && /Back to the lock/i.test(SCR.state.hint || ""), SCR.state.hint);
        at(-42.2, 4, 6.0);
        useAt(-40.04, 5.2, 6.4);
        const set2 = setWord("TEMPORARI");
        key("Enter"); step(2);
        await until(() => G.StoryDialogue.current && G.StoryDialogue.current.line === "story.ch1.d.namHint", 120);
        ok("I a second wrong word: Nam shouts through the door -- \"It's the opposite of permanent!\"", set2 === "TEMPORARI" && LOCK.info("back").wrong === 2 && G.StoryDialogue.current && G.StoryDialogue.current.who === "nam");
        const sTemp1 = stat("temporary");
        setWord("TEMPORARY");
        key("Enter"); step(2);
        ok("I TEMPORARY: \"Click! The lock opens.\" -- the back door swings open (no hint left over)", LOCK.info("back").solved && has("lock:back") && doorOpen("LIBBACK") && /lock opens/i.test(lockEl.innerText) && !/Back to the lock/i.test(SCR.state.hint || ""));
        ok("I ...counted once (the first try was the answer): its box as it was", stat("temporary") === sTemp1);
        step(70);
        ok("I ...the window gone; Kru Min, Nam and Tonkla there inside; the objective: get in", !LOCK.holds() && lockEl.classList.contains("hidden") && ["min", "nam", "tonkla"].every((id) => !CAST.get(id).hidden) && run0().objective === "story.ch1.s2.obj3");
        note("I");
      }

      // ================= J: into the library =================
      {
        at(-37.8, 4, 5.5);
        step(3);
        const d = G.save.story.ch.ch1;
        ok("J in: the checkpoint, scene 1-3 -- the three still there (no one gone and back)", run0().scene.id === "s3" && d.cp && d.cp.scene === 3 && ["min", "nam", "tonkla"].every((id) => CAST.get(id) && !CAST.get(id).hidden));
        ok("J ...1-2's own flags left behind; the messages kept", !(d.cp.flags || []).some((f) => /^(on|used|tried|lock|lockwrong|lockopen):/.test(f)) && (d.cp.flags || []).includes("msg:min5") && (d.cp.flags || []).length < 120, (d.cp.flags || []).length);
        note("J");
      }

      // ================= K: around it =================
      {
        // draw calls on Low: 3F before the glass (the crowd in view), 2F by the main stairs, the lock
        const callsAt = (sc, x, y, z, lx, ly, lz) => { play(() => S.start("ch1", { scene: sc, beat: 0, skip: true })); at(x, y, z); look(lx, ly, lz); step(4); g.renderFrame(); return g.renderer.info.render.calls; };
        numbers.calls = { glass3: callsAt(1, 3.2, 8, 1.2, 4.5, 9.2, -3.4), corridor3: callsAt(1, -4, 8, 0, 20, 9.5, 0), stairs2: callsAt(2, 6, 4, 0.8, 4.5, 5.2, -3.4), lock2: callsAt(2, -42.2, 4, 6, -40, 5.2, 6.4) };
        ok("K draw calls on Low under 150 (3F at the glass, its corridor, 2F at the glass, at the lock)", Object.values(numbers.calls).every((c) => c < 150), JSON.stringify(numbers.calls));
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        play(() => g.startLevel(1));
        ok("K the campaign after it: no lock window, no whisper, no story classes, the knife in the melee slot", document.getElementById("story-lock").classList.contains("hidden") && (!document.getElementById("story-whisper") || document.getElementById("story-whisper").classList.contains("hidden"))
          && !document.body.classList.contains("story-lock-open") && !document.body.classList.contains("story-run") && g.player.melee === "knife" && !LOCK.ids().length);
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        numbers.frames = frames;
        numbers.realSec = Math.round((performance.now() - t0) / 1000);
      }
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ") + " | trace " + trace.join(" "));
    } finally {
      G.CONFIG.story.enabled = enabled0;
      G.Input.keys[kb.jump] = false; G.Input.keys[kb.forward] = false; G.Input.mouseDown = false; G.Input.aimDown = false;
      G.Input.pollGamepad = pad0; G.Input.padActive = false;
      G.Input.mode = mode0;
      G.Audio.speak = speak0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      if (PH.isOpen && PH.isOpen()) PH.close();
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
