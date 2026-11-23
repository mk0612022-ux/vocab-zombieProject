// Dev-only (not shipped). The story series' round 7: Chapter 1's scenes 1-3 "The Last
// Classroom" and 1-4 "First Aid", played through by their own inputs (a choice by a key and by
// a click, a word question in the talk, the interaction ray, the button held to push -- the key,
// a finger, the controller's Y -- the trigger, the phone, the cabinet's keys, a click, the
// controller's A) -- and what they are made of (js/story/push.js, pick.js; scenes.js' new
// conditions and actions; cast.js' new poses; entities.js' low band for a Crawler; the map's
// library and nurse's room).
//   A  1-3's start: the library, its light, the music down, nobody to fight; Kru Min, Fai, Nam,
//      Tonkla; the two shelves (the front door's in place, the back door's beside it)
//   B  the talk: what the glasses show (a key), where Beam is, his symptoms -- a word question
//      (bare answers: no subtitle, nothing bold), a wrong answer corrected, its card, counted
//   C  the look round: Beam's notebook, the sponsor's sign; the doors banged on -- the front
//      shelf knocked back, the back door shut, "Help me barricade the doors!"
//   D  the shelves pushed: a press alone does nothing; held (the key) the back one slides, Tonkla
//      comes to push too; the front one by a finger and by the controller's Y; the save before
//      the defence (its flags); everyone to their place
//   E  wave 1 through the windows: Fai shouts where (behind the player as they stand); shot; the
//      front shelf knocked back; 15 seconds to the next wave (the countdown, the hint)
//   F  wave 2: Crawlers out of the vents (under a table's top -- the player is not), their words
//      seen through the table; the front shelf not back: two through the front door; Nam reads her
//      dictionary after two wrong shots
//   G  wave 3: the shelves back in time (no one through the doors); the window broken on Tonkla's
//      arm; held -- the phones dead, the PA has its own power (broadcast); the save, scene 1-4
//   H  the save before the defence picked up: the shelves where they were pushed, the door shut
//   I  1-4: glass, not teeth (no infection); the list by text; the wing's desks knocked over,
//      Crawlers under them; Nurse Pim still on her bed (REST) while the cabinet is opened: a wrong
//      box (its card), the right ones by a key, a click, the controller's A; "All three"; the
//      logbook (symptoms, temporary); a shot in her room -- she gets up (REST: practice)
//   J  the way back: Sprinters from the main stairs' side; in, the door shut, the shelf back;
//      Fai's bandage -- "You'll recover"; the save, scene 1-5
//   K  around it: Pim up at 3 m; draw calls; the campaign after (nothing of the library's left)
// Load it into the game (in the lobby), then:
//   const r = await G.Round45Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round45Test = (function () {
  const yield0 = () => new Promise((r) => setTimeout(r, 0));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {}, trace = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t45 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, CAST = G.StoryCast, USE = G.StoryUse, PUSH = G.StoryPush, PICK = G.StoryPick, SCR = G.StoryScreen, LL = G.LexiLens, PH = G.StoryPhone, D = G.StoryDialogue;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, speak0 = G.Audio.speak, pad0 = G.Input.pollGamepad;
    const real = g._update0 || g.update;
    const kb = G.save.settings.keybinds;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const mode0 = G.Input.mode;
    G.Audio.speak = function () {};
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
    // (an answer's own text: its key hint "(1)" left out)
    const dialogBtns = () => Array.from(document.querySelectorAll("#dialog-btns .btn")).map((b) => ((b.querySelector(".sc-en") || b).innerText || "").trim());
    const choose = (re) => { const i = dialogBtns().findIndex((t) => re.test(t)); if (i >= 0) G.Dialog.choose(i); return i; };
    const closeCard = () => { if (G.Dialog.isOpen()) G.Dialog.choose(0); step(2); };
    const key = (code) => G.onKeyDown({ code, repeat: false, preventDefault() {}, stopPropagation() {} });
    const fast = (on) => { G.Input.keys[kb.jump] = !!on; };
    const said = async (n) => { fast(true); const r = await until(() => !D.busy(), n || 900); fast(false); return r; };
    const alive = () => g.zombies.filter((z) => z.alive);
    const stat = (w) => { const s = G.save.wordStats && G.save.wordStats[w]; const l = G.save.learn && G.save.learn[w]; return JSON.stringify([s || null, l || null]); };
    const M = () => g.world.storyMap;
    const doorOpen = (id) => !!(M().doors[id] && M().doors[id].open);
    const lineNow = () => (D.current ? D.current.line : null);
    const heard = [];        // (every line said, as it comes up)
    const born = [];         // (where each zombie came into the world)
    const spawn0 = g.spawnZombieAt;
    g.spawnZombieAt = function (type, pos) { born.push({ type, x: pos.x, z: pos.z, f: frames }); return spawn0.apply(this, arguments); };
    const shoot = async (z) => {
      for (let i = 0; i < 30 && z.alive; i++) {
        const n = z.mesh.userData.neck, p = new THREE.Vector3(); (n || z.mesh).getWorldPosition(p); p.y += n ? 0.22 : (z.type === "crawler" ? 0.35 : 1.5);
        look(p.x, p.y, p.z); step(1);
        g.player.fireCooldown = 0; G.onFirePress(); step(2);
        if (g.player.ammo.pistol.mag <= 0) g.player.ammo.pistol.mag = 6;
        for (let k = 0; k < 8; k++) step(1);
        await yield0();
      }
      return !z.alive;
    };
    const clearGroup = async (id) => { for (let i = 0; i < 14; i++) { const left = alive().filter((z) => !id || z.storyGroup === id); if (!left.length) break; const t = left.find((z) => g.targetPair && z.word === g.targetPair[0]) || left[0]; await shoot(t); step(3); } return !alive().some((z) => !id || z.storyGroup === id); };
    const clearAll = async () => { for (let k = 0; k < 6 && alive().length; k++) await clearGroup(null); return !alive().length; };
    // the button held at a pushed thing: stood behind it (it moves away; the player walks after it), looked at, held
    const pushInfo = (id) => PUSH.info(id);
    const behind = (id, dist) => {
      const it = pushInfo(id), d = run0().scene.push.find((p) => p.id === id), dx = d.to.x - d.from.x, dz = d.to.z - d.from.z, L = Math.hypot(dx, dz) || 1;
      return { x: it.x - (dx / L) * (dist || 1.15), z: it.z - (dz / L) * (dist || 1.15), sx: it.x, sz: it.z };
    };
    const holdPush = async (id, n, setHeld) => {
      let f = 0;
      for (; f < (n || 600); f++) {
        const b = behind(id);
        g.yawObject.position.x = b.x; g.yawObject.position.z = b.z;
        look(b.sx, 5.0, b.sz);
        g.updateInteractRay();
        setHeld(true);
        step(1);
        if (pushInfo(id).p >= 1) break;
        if (f % 40 === 39) await yield0();
      }
      setHeld(false);
      return f;
    };
    const holdKey = (on) => { G.Input.keys[kb.interact] = !!on; };
    const holdTouch = (on) => { G.Input.touchInteractHeld = !!on; };
    const btn = (on) => ({ pressed: !!on, value: on ? 1 : 0 });
    const pad = (b) => ({ id: "test pad", connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => btn(b.includes(i))) });
    let gp = pad([]);
    const holdPad = (on) => { gp = pad(on ? [3] : []); G.Pad.poll(1 / 60); };
    const say0 = D.say;

    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
      G.Input.mode = "desktop";
      if (G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality(); }
      const t0 = performance.now();
      D.say = function (list) { [].concat(list || []).forEach((it) => heard.push(typeof it === "string" ? it : it.line)); return say0.apply(this, arguments); };

      // ================= A: 1-3's start =================
      let r;
      {
        play(() => S.start("ch1", { scene: 3, beat: 0, skip: true }));
        r = run0();
        ok("A 1-3 The Last Classroom: the library on 2F, its light, the music down, nobody to fight", r.scene.id === "s3" && G.StoryLight.current === "library" && SCR.state.loops.includes("calm") && !SCR.state.loops.includes("tense") && !alive().length && Math.abs(g.yawObject.position.y - 5.7) < 0.3);
        ok("A Kru Min, Fai, Nam and Tonkla there (where 1-2 left the three; Fai further in)", ["min", "fai", "nam", "tonkla"].every((id) => CAST.get(id) && !CAST.get(id).hidden));
        ok("A the two shelves: the front door's against it (in place), the back door's beside it; the back door open behind the player",
          pushInfo("front") && pushInfo("front").p === 1 && pushInfo("back") && pushInfo("back").p === 0 && has("pushed:front") && !has("pushed:back") && doorOpen("LIBBACK") && !doorOpen("DLIBRARY"), JSON.stringify([pushInfo("front"), pushInfo("back")]));
        ok("A the objective: talk to Kru Min (nothing to push yet: no prompt at a shelf)", r.objective === "story.ch1.s3.obj0" && !USE.prompt(USE.point("push:back").ref, "E"));
        note("A");
      }

      // ================= B: the talk =================
      let symBefore;
      {
        await until(() => G.Dialog.isOpen(), 240);
        const q1 = (document.getElementById("dialog-body") || {}).innerText || "";
        ok("B Kru Min: \"Those glasses -- they're showing you something, aren't they?\" -- two answers", G.Dialog.isOpen() && /showing you something/.test(q1) && dialogBtns().length === 2 && dialogBtns().some((t) => /Above their heads/.test(t)), dialogBtns().join(" / "));
        key("Digit2"); step(2);
        ok("B ...answered by a key (2): \"Every one of them has one word left.\" -- the choice kept", !G.Dialog.isOpen() && has("chose:lens:left") && G.save.story.ch.ch1.choices.lens === "left");
        await said();
        ok("B ...\"Then we fight with what we know. Words are all we have left.\"", heard.includes("story.ch1.d.minFight"));
        await until(() => G.Dialog.isOpen(), 240);
        ok("B \"Where's Beam?\" -- \"He used LEXA. He turned.\" / \"I don't know.\"", /Where's Beam/.test(document.getElementById("dialog-body").innerText) && dialogBtns().some((t) => /He turned/.test(t)) && dialogBtns().some((t) => /I don't know/.test(t)));
        choose(/He turned/); step(2);
        await said();
        ok("B ...\"...I should have seen it.\"", heard.includes("story.ch1.d.minSeen") && has("chose:beam:turned"));
        await until(() => G.Dialog.isOpen(), 240);
        const box = document.getElementById("dialog-box"), btns = Array.from(document.querySelectorAll("#dialog-btns .btn"));
        ok("B the word question: \"He had all the ___ -- headaches, forgetting words.\" -- symptoms / systems / sympathy", /He had all the ___/.test(document.getElementById("dialog-body").innerText) && JSON.stringify(dialogBtns()) === JSON.stringify(["symptoms", "systems", "sympathy"]), dialogBtns().join("/"));
        ok("B ...its answers bare: no subtitle under them, none bold (nothing gives it away)", btns.every((b) => !b.querySelector(".sc-sub, .sd-sub, b, strong, .sd-word")) && box && box.classList.contains("story-quiz-q"), (box && box.className) + " | " + (btns[0] && btns[0].innerHTML.slice(0, 160)));
        symBefore = stat("symptom");
        choose(/^systems$/); step(2);
        const xc = document.getElementById("hud-xcard");
        ok("B a wrong answer (systems): its card -- \"systems\" and the right word, symptom", xc && /bad/.test(xc.className) && /systems/i.test(xc.innerText) && /symptom/i.test(xc.innerText), xc && xc.innerText);
        await said();
        ok("B ...Kru Min corrects it as a teacher would (\"the signs that something is wrong\"), no harm done", heard.includes("story.ch1.d.minSymWrong") && g.player.hp === g.player.maxHp && has("chose:sym:systems"));
        ok("B ...counted for the word as any answer (its memory box): symptom", stat("symptom") !== symBefore, stat("symptom"));
        note("B");
      }

      // ================= C: the look round; the doors banged on =================
      {
        await until(() => run0().objective === "story.ch1.s3.obj1", 120);
        ok("C a short look round (no must): the objective, a hint; Beam's notebook and the sponsor's sign to read", run0().objective === "story.ch1.s3.obj1" && /Look round/i.test(SCR.state.hint || "") && USE.has("notebook") && USE.has("sponsor"), SCR.state.hint);
        at(-27.4, 4, 5.15);
        const pn = useAt(-27.4, 4.86, 6.4);
        const nb = (document.getElementById("dialog-body") || {}).innerText || "";
        ok("C Beam's notebook, at his table: \"Words I keep forgetting\" -- together among them", /Beam's notebook/i.test(pn) && G.Dialog.isOpen() && /Words I keep forgetting/.test(nb) && /together/.test(nb), pn);
        closeCard();
        at(-31.5, 4, 4.7);
        const ps = useAt(-31.5, 6.45, 3.35);
        ok("C the sign: \"This library is proudly sponsored by NeuroLex.\"", /Read the sign/i.test(ps) && /proudly sponsored by NeuroLex/.test(document.getElementById("dialog-body").innerText), ps);
        closeCard();
        step(30);
        ok("C both read: the doors banged on -- the front door's shelf knocked back, the back door shut behind the player", pushInfo("front").p < 0.5 && !has("pushed:front") && !doorOpen("LIBBACK") && has("x:barricade") && !USE.has("notebook"), JSON.stringify(pushInfo("front")));
        ok("C Fai: \"The front door!\" -- Kru Min: \"Help me barricade the doors!\" -- the objective", heard.includes("story.ch1.d.faiDoor") && heard.includes("story.ch1.d.minBarricade") && run0().objective === "story.ch1.s3.obj2");
        ok("C ...a hint: hold the interaction key at a bookshelf", /Hold E at a bookshelf/i.test(SCR.state.hint || ""), SCR.state.hint);
        note("C");
      }

      // ================= D: the shelves pushed =================
      let midCp;
      {
        await said(600);
        const b0 = behind("back");
        at(b0.x, 4, b0.z); look(b0.sx, 5.0, b0.sz); step(1); g.updateInteractRay();
        const pp = promptText();
        ok("D at the back door's shelf: the game's prompt \"Hold E: Push the bookshelf\"", /Hold E: Push the bookshelf/.test(pp), pp);
        key(kb.interact); step(20);
        ok("D a press alone: it does not move (it is pushed by holding)", pushInfo("back").p === 0 && !USE.point("push:back").ref.used);
        const fBack = await holdPush("back", 600, holdKey);
        const tk = CAST.get("tonkla");
        numbers.pushFrames = fBack;
        ok("D held (the key): it slides across the door -- in place, \"pushed\"", pushInfo("back").p === 1 && has("pushed:back") && Math.abs(pushInfo("back").z - 5.5) < 0.01, fBack + " frames " + JSON.stringify(pushInfo("back")));
        ok("D ...Tonkla came to push too (by it, pushing) -- faster than alone (2.6 s)", pushInfo("back").helped && fBack < 2.6 * 60 && tk && Math.hypot(tk.pos.x + 38.1, tk.pos.z - 8.45) < 0.4, fBack + " " + (tk && tk.pose));
        ok("D ...in place: nothing more to say at it", !USE.prompt(USE.point("push:back").ref, "E"));
        // the front door's: half of it by a finger on the hand button, the rest by the controller's Y
        G.Input.mode = "touch";
        const pf0 = pushInfo("front").p;
        await holdPush("front", 50, holdTouch);
        const pf1 = pushInfo("front").p;
        ok("D the front door's shelf by a finger held on the hand button: it slides", pf1 > pf0 + 0.05 && G.Input.touchInteractHeld === false, pf0 + " -> " + pf1);
        G.Input.mode = "desktop";
        G.Input.pollGamepad = () => gp;
        await holdPush("front", 600, holdPad);
        G.Input.pollGamepad = pad0; G.Input.padActive = false; G.Input.padUse = false;
        ok("D ...the rest by the controller's Y held: in place", pushInfo("front").p === 1 && has("pushed:front") && Math.abs(pushInfo("front").x + 25.5) < 0.01 && Math.abs(pushInfo("front").z - 3.25) < 0.01, JSON.stringify(pushInfo("front")));
        step(3);
        const d = G.save.story.ch.ch1;
        midCp = d.cp ? JSON.parse(JSON.stringify(d.cp)) : null;
        ok("D both across: the save before the defence (the design's) -- its flags keep the shelves pushed", d.cp && d.cp.scene === 3 && d.cp.beat > 0 && ["pushed:back", "pushed:front", "x:barricade"].every((f) => (d.cp.flags || []).includes(f)), JSON.stringify(d.cp && { beat: d.cp.beat, flags: d.cp.flags }));
        await said(600);
        ok("D \"That'll hold.\" -- the defence: its objective, the music up, the glasses' warning, the back door shut", heard.includes("story.ch1.d.tonklaHeld") && run0().objective === "story.ch1.s3.obj" && SCR.state.loops.includes("tense") && !doorOpen("LIBBACK"));
        note("D");
      }

      // ================= E: wave 1 =================
      {
        at(-31.5, 4, 4.4); look(-31.5, 5.7, 1.5);           // (the windows behind the player)
        await until(() => has("x:wave1"), 300);
        const w1 = alive().filter((z) => z.storyGroup === "w1"), b1 = born.slice(-4);
        ok("E wave 1: four Shamblers through the windows (born by the north wall)", run0().groups.w1 === 4 && w1.every((z) => z.type === "normal") && b1.length === 4 && b1.every((b) => b.type === "normal" && b.z > 7.3), JSON.stringify(b1));
        ok("E Fai shouts where they come from -- behind the player as they stand: \"The windows -- behind you!\"", run0().lastCallout === "behind" && heard.includes("story.ch1.d.faiBehind"), run0().lastCallout);
        await clearGroup("w1");
        await until(() => has("on:bang1"), 900);
        step(30);
        ok("E the front door banged on: its shelf knocked back (\"the shelf's moving!\")", has("on:bang1") && pushInfo("front").p < 1 && !has("pushed:front") && heard.includes("story.ch1.d.faiFront"), JSON.stringify(pushInfo("front")));
        await until(() => has("x:rest1"), 600);
        step(2);
        ok("E cleared: 15 seconds to the next wave -- the countdown \"Next wave in ...\"", has("x:rest1") && SCR.state.timer > 0 && SCR.state.timer <= 15 && /Next wave in \d+/.test((document.getElementById("story-timer") || {}).textContent || ""), (document.getElementById("story-timer") || {}).textContent);
        await until(() => has("on:pushBack1"), 300);
        ok("E ...a shelf out of place between the waves: the hint (hold E) and Kru Min's \"push the shelves back\"", has("on:pushBack1") && /push it back/i.test(SCR.state.hint || "") && heard.includes("story.ch1.d.minPushBack"), SCR.state.hint);
        note("E");
      }

      // ================= F: wave 2 =================
      {
        // (the front shelf left where the banging put it: the door gives)
        await until(() => has("x:wave2"), 1100);
        const cr = alive().filter((z) => z.storyGroup === "w2");
        ok("F wave 2: three Crawlers let down from the air vents (a new threat: the glasses' line, Fai's \"The vent!\")", cr.length === 3 && cr.every((z) => z.type === "crawler") && LL.line && LL.line.key === "story.ch1.sys.crawler" && heard.includes("story.ch1.d.faiVent"), LL.line && LL.line.key);
        ok("F ...a Crawler a scene sends is low: under a table's top it goes (its band)", cr.every((z) => z.lowBand === G.CONFIG.story.crawlerBand));
        ok("F ...two more through the windows; the front shelf not back in place: two through the front door, none through the back", alive().filter((z) => z.storyGroup === "w2b").length === 2 && alive().filter((z) => z.storyGroup === "w2f").length === 2 && !alive().some((z) => z.storyGroup === "w2k"));
        // a Crawler under the middle table, the player across it
        const c0 = cr[0] || { alive: false, mesh: { position: new THREE.Vector3() } };
        c0.mesh.position.set(-31.5, 4, 8.1);
        at(-31.5, 4, 4.3); look(-31.5, 4.4, 7);
        let under = false, minZ = 99;
        for (let i = 0; i < 360 && c0.alive && !under; i++) {
          alive().forEach((z) => { if (z !== c0) z.mesh.position.set(-26, 4, 8.6); });       // (the others kept off)
          step(1);
          const p = c0.mesh.position;
          minZ = Math.min(minZ, p.z);
          if (p.x > -32.7 && p.x < -30.3 && p.z > 5.9 && p.z < 7.3) under = true;
          if (i % 40 === 39) await yield0();
        }
        ok("F a Crawler goes under a reading table (it does not walk round it)", under, "z " + minZ.toFixed(2));
        ok("F ...its word over it all the while, seen through the table", c0.sprite && c0.sprite.visible && c0.sprite.material.depthTest === false && c0.word);
        at(-31.5, 4, 5.3);
        g.tryMove(0, 1.5); step(1);
        ok("F ...and the player cannot get under or through it (the table's top is in the way)", g.yawObject.position.z < 5.84 - 0.3, g.yawObject.position.z.toFixed(2));
        // two wrong shots in a row: Nam, her dictionary
        // (two of the wrong words shot down, one after the other, while the same word is asked: each a
        // wrong answer on it -- the word asked checked before each)
        const wrongs = [], seen = [], calls = [];
        const ows0 = S.onWrongShot;
        S.onWrongShot = function (game, z, tp) { const r0 = run0(); const before = r0 && r0.hintKey + ":" + r0.hintN; const out = ows0.apply(this, arguments); calls.push((tp && tp[0]) + "/" + z.word + " " + before + "->" + (r0 && r0.hintKey + ":" + r0.hintN) + " t" + (r0 && r0.time.toFixed(1)) + " at" + (r0 && r0.hintAt)); return out; };
        let namSaid = false, w0 = g.wrongCount || 0, streak = 0, lastKey = null;
        at(-31.5, 4, 4.3);
        for (let k = 0; k < 6 && !namSaid; k++) {
          const tw = g.targetPair && g.targetPair[0];
          const pool = alive().filter((z) => z.word && z.word !== tw && !z.decoy && !z.practice);
          const z = pool.find((q) => q.type !== "crawler") || pool[0];
          if (!z || !tw) break;
          if (tw !== lastKey) { streak = 0; lastKey = tw; }
          const wc = g.wrongCount || 0;
          z.mesh.position.set(-31.5, 4, 7.6);
          await shoot(z);
          step(4);
          if ((g.wrongCount || 0) > wc && g.targetPair && g.targetPair[0] === tw) streak++;
          wrongs.push(z); seen.push(tw + ">" + z.word);
          namSaid = heard.includes("story.ch1.d.namDict") || heard.includes("story.ch1.d.namFirst");
        }
        // (the word asked is the game's at the moment of each shot -- the log of the calls; a stray round can
        // change it in between, and then the count starts again for the new one)
        ok("F two wrong shots on the same word: Nam reads her dictionary -- its meaning and first letter (a help)", namSaid && has("hinted") && run0().hintN >= 2 && calls.length >= 2, seen.join(",") + " wrong " + w0 + "->" + (g.wrongCount || 0) + " calls " + calls.join(" | "));
        S.onWrongShot = ows0;
        await clearAll();
        await until(() => has("x:rest2"), 600);
        ok("F wave 2 cleared: the countdown again", has("x:rest2") && SCR.state.timer > 10);
        note("F");
      }

      // ================= G: wave 3, the glass, the plan =================
      let endCp;
      {
        // both shelves back in place this time (the back one knocked back 6 s into wave 2 -- after it, if it
        // was cleared sooner)
        await until(() => has("on:bang2"), 600);
        step(30);
        if (!has("pushed:front")) await holdPush("front", 600, holdKey);
        if (!has("pushed:back")) await holdPush("back", 600, holdKey);
        ok("G between the waves: both shelves pushed back in time", has("pushed:front") && has("pushed:back"), JSON.stringify([pushInfo("front"), pushInfo("back"), SCR.state.timer, has("x:wave3")]));
        at(-31.5, 4, 4.4);
        await until(() => has("x:wave3"), 1100);
        ok("G wave 3: the windows (a Sprinter among them) and the vents; the doors held -- no one through them",
          alive().filter((z) => z.storyGroup === "w3").length === 3 && alive().some((z) => z.storyGroup === "w3" && z.type === "fast") && alive().filter((z) => z.storyGroup === "w3b").length === 2 && !alive().some((z) => /^w3[fk]$/.test(z.storyGroup)),
          JSON.stringify(run0().groups) + " alive " + alive().map((z) => z.storyGroup + ":" + z.type).join(","));
        await until(() => { const t = CAST.get("tonkla"); return t && t.pose === "hurt"; }, 600);
        const tk = CAST.get("tonkla");
        ok("G the north-west window gives on Tonkla (he went to hold it): his arm cut -- \"Argh -- my arm!\"", tk && tk.pose === "hurt" && heard.includes("story.ch1.d.tonklaArm") && heard.includes("story.ch1.d.faiTonkla"));
        ok("G ...two climb in through it", run0().groups.w3c === 2, JSON.stringify(run0().groups));
        await clearAll();
        await until(() => has("x:held"), 600);
        ok("G held: the music down, Kru Min's plan its objective", has("x:held") && SCR.state.loops.includes("calm") && run0().objective === "story.ch1.s3.obj4");
        await until(() => D.current && D.current.line === "story.ch1.d.minPA", 600);
        step(3);
        const words = Array.from(document.querySelectorAll("#story-dlg .sd-word")).map((w) => w.innerText.toLowerCase());
        ok("G \"The phones are dead. But the PA system has its own power. We can broadcast a warning...\" -- broadcast a word to tap", heard.includes("story.ch1.d.minPhones") && words.some((w) => /broadcast/.test(w)), words.join());
        await said(900);
        await until(() => run0().scene.id === "s4", 300);
        const d = G.save.story.ch.ch1;
        endCp = d.cp ? JSON.parse(JSON.stringify(d.cp)) : null;
        ok("G \"...We wait until the crowd outside moves on.\" -- the save, scene 1-4 (1-3's own flags left behind)", heard.includes("story.ch1.d.minWait") && run0().scene.id === "s4" && d.cp && d.cp.scene === 4 && !(d.cp.flags || []).some((f) => /^(x|on|used|card):/.test(f) || f === "pushed:back"), JSON.stringify(d.cp && d.cp.flags));
        note("G");
      }

      // ================= H: the save before the defence, picked up =================
      {
        play(() => S.start("ch1", Object.assign({}, midCp)));
        step(3);
        ok("H the save before the defence picked up: the shelves where they were pushed, the back door shut, the defence's objective",
          run0().scene.id === "s3" && pushInfo("back").p === 1 && pushInfo("front").p === 1 && !doorOpen("LIBBACK") && run0().objective === "story.ch1.s3.obj" && SCR.state.loops.includes("tense"), JSON.stringify([pushInfo("back"), pushInfo("front"), run0().beatI]));
        await until(() => has("x:wave1"), 300);
        ok("H ...and the first wave comes again", alive().filter((z) => z.storyGroup === "w1").length === 4);
        note("H");
      }

      // ================= I: 1-4 =================
      {
        play(() => S.start("ch1", Object.assign({}, endCp)));
        r = run0();
        const tk = CAST.get("tonkla"), pim = CAST.get("pim");
        ok("I 1-4 First Aid: the library, Tonkla sitting, holding his arm; the others round him; no fight", r.scene.id === "s4" && G.StoryLight.current === "nurse" && tk && tk.pose === "hurtSit" && ["min", "fai", "nam"].every((id) => CAST.get(id)) && !alive().length);
        await said(900);
        ok("I \"Am I... going to turn?\" -- \"It's a minor injury. Glass, not teeth -- no bite, no infection.\"", heard.includes("story.ch1.d.tonklaTurn") && heard.includes("story.ch1.d.minInjury") && heard.includes("story.ch1.d.minNurse"));
        await until(() => has("msg:min7"), 120);
        PH.open("min"); step(1);
        const txt = ((document.getElementById("story-phone-box") || document.getElementById("story-phone") || {}).innerText || "");
        PH.close(); step(2);
        ok("I the list, by text: \"Bring a bandage, antiseptic, and gauze -- nothing else. Be quick.\"", has("read:min") && /Bring a bandage, antiseptic, and gauze/.test(txt) && run0().objective === "story.ch1.s4.obj", txt.slice(0, 80));
        ok("I the back door open again, its shelf moved aside; the cabinet and the logbook to use", doorOpen("LIBBACK") && pushInfo("back").p === 0 && USE.has("pick:meds") && USE.has("logbook"));
        // the west wing: the desks knocked over; Crawlers out from under them
        const fd = CAST.propOf("fd1"), fd2 = CAST.propOf("fd2");
        ok("I the west wing's corridor: desks and chairs knocked over (on their sides, in the way)", fd && Math.abs(Math.abs(fd.g.rotation.z) - Math.PI / 2) < 0.01 && fd2 && Math.abs(Math.abs(fd2.g.rotation.x) - Math.PI / 2) < 0.01 && fd.col && fd2.col);
        at(-42.2, 4, -1.5); at(-42.2, 4, -4.5);
        step(3);
        const cr = alive().filter((z) => z.storyGroup === "cr");
        ok("I ...Crawlers out from under them (three, low: under things)", cr.length === 3 && cr.every((z) => z.type === "crawler" && z.lowBand) && LL.line && LL.line.key === "story.ch1.sys.floor");
        await clearGroup("cr");
        // the nurse's room: Nurse Pim on her bed, REST; still while the cabinet is opened
        ok("I the nurse's room: Nurse Pim (turned) sitting still on a bed, REST over her", pim && pim.who === "pim_z" && pim.pose === "sit" && pim.labelWord === "REST" && pim.seat > 0.5);
        at(-42.2, 4, -18.6); at(-42.2, 4, -21.0);
        step(3);
        ok("I in her room: the hint -- shoot her word, or keep away", /keep your distance/i.test(SCR.state.hint || "") && CAST.get("pim"), SCR.state.hint);
        at(-41.6, 4, -25.25);
        const pc = useAt(-41.2, 4.95, -26.35);
        ok("I the cabinet: \"E: Open the medicine cabinet\" -- its window (the world held), six boxes by their labels, Kru Min's list", /Open the medicine cabinet/.test(pc) && G.Modal.isOpen("story-pick") && document.querySelectorAll("#story-pick-box .spk-box").length === 6 && /Bring a bandage, antiseptic, and gauze/.test(document.getElementById("story-pick-box").innerText), pc);
        ok("I ...Nurse Pim still on her bed (the player kept away)", !!CAST.get("pim") && !alive().some((z) => z.storyGroup === "pim"));
        const restBefore = stat("eye drops");
        key("Digit4"); step(1);
        const pk = document.getElementById("story-pick-box");
        ok("I a wrong box by its key (4, eye drops): not taken -- its card: what it is (its meaning, in English too), not on the list", PICK.info("meds").wrong.includes("eye drops") && !PICK.info("meds").taken.length && has("pickwrong:meds:1")
          && /eye drops/.test(pk.querySelector(".spk-card").innerText) && /not on Kru Min's list/i.test(pk.querySelector(".spk-card").innerText) && /for sore or dry eyes/.test(pk.querySelector(".spk-card").innerText), pk.querySelector(".spk-card").innerText);
        ok("I ...a practice word: counted nowhere", stat("eye drops") === restBefore);
        pk.querySelector('.spk-box[data-i="0"]').click(); step(1);
        ok("I a right one by a click (bandage): taken, ticked on the list", PICK.info("meds").taken.includes("bandage") && has("picked:meds:bandage") && pk.querySelector(".spk-want li.on"));
        G.Input.pollGamepad = () => gp;
        const anti = pk.querySelector('.spk-box[data-i="2"]');
        G.Pad.setFocus(anti);
        gp = pad([]); G.Pad.poll(1 / 60); gp = pad([0]); G.Pad.poll(1 / 60); gp = pad([]); G.Pad.poll(1 / 60);
        G.Input.pollGamepad = pad0; G.Input.padActive = false;
        ok("I ...one by the controller (A on it): antiseptic", PICK.info("meds").taken.includes("antiseptic"));
        key("Digit5"); step(1);
        ok("I the third (5, gauze): \"All three -- back to the library!\" -- the list done", PICK.info("meds").done && has("pick:meds") && /All three/.test(pk.innerText));
        await sleep(1400); step(2);
        ok("I ...the window goes by itself; the cabinet has nothing more", !G.Modal.isOpen("story-pick") && pk.classList.contains("hidden") && !USE.has("pick:meds") && run0().objective === "story.ch1.s4.obj2");
        at(-42.3, 4, -21.8);
        const pl = useAt(-41.0, 4.86, -21.8);
        const lb = (document.getElementById("dialog-body") || {}).innerText || "", lw = Array.from(document.querySelectorAll("#dialog-body .sd-word")).map((w) => w.innerText.toLowerCase());
        ok("I the nurse's logbook: \"17 students in three weeks... symptoms... He said it's temporary.\" -- its words to tap", /nurse's logbook/i.test(pl) && /17 students in three weeks/.test(lb) && lw.some((w) => /symptom/.test(w)) && lw.some((w) => /temporary/.test(w)), lw.join());
        closeCard();
        // a shot in her room: she gets up -- a zombie of her own, REST (practice)
        const restStat = stat("rest");
        // (the gun back up after the hand was used; a round in it)
        g.player.ammo.pistol.mag = Math.max(g.player.ammo.pistol.mag, 6); step(40);
        const shot0 = run0().lastShot;
        look(-41.5, 5.2, -27); step(1); g.player.fireCooldown = 0; G.onFirePress(); step(8);
        const pz = alive().find((z) => z.storyGroup === "pim");
        ok("I a shot in her room: Nurse Pim gets up -- her own self, REST its word (the one asked)", run0().lastShot !== shot0 && !CAST.get("pim") && pz && pz.look && pz.look.voxel === "pim_z" && pz.word === "rest" && g.targetPair && g.targetPair[0] === "rest", shot0 + " -> " + run0().lastShot);
        await clearGroup("pim");
        ok("I ...shot by her word: practice, counted nowhere", !alive().some((z) => z.storyGroup === "pim") && stat("rest") === restStat);
        note("I");
      }

      // ================= J: the way back =================
      {
        at(-42.2, 4, -16);
        step(3);
        const spr = alive().filter((z) => z.storyGroup === "spr");
        ok("J out of her room with the three: Sprinters from the main stairs' side (\"Movement detected\")", spr.length === 4 && spr.every((z) => z.type === "fast" && z.mesh.position.x > -24) && SCR.state.loops.includes("tense"));
        at(-42.2, 4, -2);
        await clearGroup("spr");
        at(-39.8, 4, 5.5); at(-36.5, 4, 5.0);
        await until(() => !doorOpen("LIBBACK"), 120);
        ok("J back in: the door shut behind, the shelf back across it", !doorOpen("LIBBACK") && pushInfo("back").p === 1 && run0().objective === "story.ch1.s4.obj3");
        await until(() => CAST.get("fai") && CAST.get("fai").pose === "treat", 300);
        ok("J Fai sees to the arm -- \"Hold still. This will sting.\"", CAST.get("fai").pose === "treat" && heard.includes("story.ch1.d.faiBandage"));
        await until(() => D.current && D.current.line === "story.ch1.d.faiRecover", 900);
        const rw = Array.from(document.querySelectorAll("#story-dlg .sd-word")).map((w) => w.innerText.toLowerCase());
        ok("J \"So, doctor... will I make a full recovery?\" -- \"You'll recover. Stop talking.\" (recover to tap)", heard.includes("story.ch1.d.tonklaDoctor") && rw.some((w) => /recover/.test(w)), rw.join());
        await said(600);
        await until(() => run0().scene.id === "s5", 300);
        const d = G.save.story.ch.ch1;
        ok("J the save: scene 1-5 next (1-4's flags left behind; the phone's kept)", run0().scene.id === "s5" && d.cp && d.cp.scene === 5 && (d.cp.flags || []).includes("msg:min7") && !(d.cp.flags || []).some((f) => /^(pick|picked|pickwrong|pushed):/.test(f)));
        note("J");
      }

      // ================= K: around it =================
      {
        // Nurse Pim up at 3 m (walked up to)
        play(() => S.start("ch1", { scene: 4, beat: 0, skip: true }));
        at(-42.2, 4, -21.0); at(-45.2, 4, -24.0);
        step(3);
        ok("K walked up to her (within 3 m): Nurse Pim gets up", !CAST.get("pim") && alive().some((z) => z.storyGroup === "pim"));
        // draw calls on Low: the library in the defence, the west wing, the nurse's room
        const callsAt = (sc, x, y, z, lx, ly, lz) => { play(() => S.start("ch1", { scene: sc, beat: 0, skip: true })); at(x, y, z); look(lx, ly, lz); step(4); g.renderFrame(); return g.renderer.info.render.calls; };
        numbers.calls = { library: callsAt(3, -31.5, 4, 4.2, -31.5, 5.2, 9), libraryBack: callsAt(3, -26, 4, 7.5, -38, 5.2, 5), wing: callsAt(4, -42.2, 4, -2, -42.2, 5.0, -18), nurse: callsAt(4, -42.2, 4, -21, -47, 5, -25) };
        ok("K draw calls on Low under 150 (the library both ways, the west wing, the nurse's room)", Object.values(numbers.calls).every((c) => c < 150), JSON.stringify(numbers.calls));
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        play(() => g.startLevel(1));
        const hid = (id) => !document.getElementById(id) || document.getElementById(id).classList.contains("hidden");
        ok("K the campaign after it: no push ring, no cabinet, no countdown, nothing pushable; a campaign zombie of its own height", hid("story-push") && hid("story-pick-box") && hid("story-timer") && !PUSH.ids().length && !PICK.holds()
          && !g.zombies.some((z) => z.lowBand));
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
      if (PH.isOpen && PH.isOpen()) PH.close();
      if (PICK.holds()) PICK.close();
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
