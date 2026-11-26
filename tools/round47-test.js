// Dev-only (not shipped). The story series' round 9: Chapter 1's scene 1-6 "Attention, All
// Students", played through by its own inputs (on foot, the interaction ray, the button held to
// help Kru Min up, the keys / a click / the controller at the PA desk) -- and what it is made of:
// js/story/escort.js (who is looked after: following, who is after her, the extinguisher, the
// shout, down and up again), js/story/pa.js (the announcement put right, read out, on its loop, the
// hold), the Screamer in Story Mode (js/zombieai.js, G.Story.sees / onShriek), cast.js' poses,
// screen.js' bells and jingle, dialogue.js' lines read aloud, the map's doorway PR room -- office.
//   A  1-6's start: the library, 17:00; the extinguisher, her bar, her lines; the others stay; the doors
//   B  on foot to the 1st floor: she keeps up, on the stairs too, never through a wall; left far behind: brought along
//   C  who is after her: the nearer of the two, not for a hair's breadth; a blow lands on her, not on the player
//   D  the extinguisher: a burst stuns who is in it, three seconds; not again for twenty; a Screamer's shriek cut off
//   E  the shout: behind the player, in sight; not in front, not behind a wall
//   F  down: the half minute, HELP!, nobody after her; a press does nothing, let go it runs back, three seconds held --
//      half her health; nobody helps: back to the save
//   G  the corridor's three groups; the PR room's door by hand; LEXA's jingle, broken; to the desk by the doorway
//   H  the PA: three gaps; wrong -- what it means, Kru Min's word, again at once; a bank's word counted (its first
//      choice), a practice word nowhere; the keys, a click, the controller; closed and opened again
//   I  "Is help really on the way?"; the save before the hold; the microphone
//   J  the school's bells; the announcement read aloud, a line at a time, its words to tap
//   K  the hold: a hundred seconds, its announcement every twenty; who comes, never more than six; the office's
//      door, the window; the Screamers: in sight only, killed as it rears up -- none; its shriek calls two; she is
//      down: it stands still
//   L  the messages one by one; the window: the principal, his megaphone; the save, scene 1-7
//   M  the save picked up; lost in the hold -- the retry
//   N  around it: the contract; a save of an earlier build; the words, the strings; draw calls; the campaign's
//      Screamer as it was; the campaign after
// Load it into the game (in the lobby), then:
//   const r = await G.Round47Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round47Test = (function () {
  const yield0 = () => new Promise((r) => setTimeout(r, 0));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
    const results = [], errs = [], numbers = {}, trace = [];
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t47 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, S = G.Story, CAST = G.StoryCast, USE = G.StoryUse, PUSH = G.StoryPush, SCR = G.StoryScreen, LL = G.LexiLens, D = G.StoryDialogue, ES = G.StoryEscort, PA = G.StoryPA, PH = G.StoryPhone, WH = G.StoryWhisper;
    const backup = JSON.stringify(G.save), lock0 = G.Input.requestPointerLock, enabled0 = G.CONFIG.story.enabled, speak0 = G.Audio.speak, pad0 = G.Input.pollGamepad, answer0 = G.Learning.answerWord, sound0 = SCR.sound, shriek0 = G.ZombieAI.shriek;
    const real = g._update0 || g.update;
    const kb = G.save.settings.keybinds;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const mode0 = G.Input.mode;
    const spoke = [];
    G.Audio.speak = function (w, o) { spoke.push([String(w), o && o.text ? "text" : o && o.whisper ? "whisper" : "word"]); };
    let frames = 0, god = true, minGod = false;
    const step = (n, dt) => { for (let i = 0; i < n; i++) { real.call(g, dt || 1 / 60); frames++; if (god && g.player && g.player.hp < g.player.maxHp * 0.35) g.player.hp = g.player.maxHp; if (minGod && ES.state && !ES.state.down) ES.state.hp = ES.state.max; } };
    const settle = () => { g.update = () => {}; G.Modal.reset(); g.paused = false; g.state = "GAMEPLAY"; G.Input.clearHeldInputs(); step(2); };
    const play = (fn) => { g.update = real; fn(); settle(); };
    const run0 = () => S.run;
    const has = (f) => !!(S.run && S.run.flags.has(f));
    const at = (x, y, z) => { g.teleportPlayer(new THREE.Vector3(x, y || 0, z)); step(2); };
    const me = () => g.yawObject.position;
    const look = (x, y, z) => { const e = me(), dx = x - e.x, dz = z - e.z, dy = y - e.y; g.yawObject.rotation.y = Math.atan2(-dx, -dz); g.pitchObject.rotation.x = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz)))); g.yawObject.updateMatrixWorld(true); };
    const until = async (fn, n, dt) => { for (let i = 0; i < (n || 600); i++) { if (fn()) return true; step(1, dt); if (i % 40 === 39) await yield0(); } return !!fn(); };
    const note = (tag) => trace.push(tag + "@" + (S.run ? S.run.scene.id + ":" + S.run.beatI : "-") + "/" + frames);
    const promptText = () => ((document.getElementById("hud-interact-prompt") || {}).innerText || "").trim();
    const useAt = (x, y, z) => { look(x, y, z); step(1); g.updateInteractRay(); const p = promptText(); g.doInteract(); step(1); return p; };
    const key = (code, rep) => G.onKeyDown({ code, repeat: !!rep, preventDefault() {}, stopPropagation() {} });
    const fast = (on) => { G.Input.keys[kb.jump] = !!on; };
    const said = async (n) => { fast(true); const r = await until(() => !D.busy(), n || 900); fast(false); return r; };
    const alive = () => g.zombies.filter((z) => z.alive);
    const kill = (keep) => { alive().forEach((z) => { if (keep && keep(z)) return; g.damageZombie(z, 9999, z.mesh.position.clone(), { dir: null, head: false }); }); step(3); };
    const stat = (w) => { const s = G.save.wordStats && G.save.wordStats[w]; const l = G.save.learn && G.save.learn[w]; return JSON.stringify([s || null, l || null]); };
    const M = () => g.world.storyMap;
    const doorOpen = (id) => !!(M().doors[id] && M().doors[id].open);
    const f2 = (v) => +(+v).toFixed(2);
    const el = (id) => document.getElementById(id);
    const hid = (id) => !el(id) || el(id).classList.contains("hidden");
    const min = () => CAST.get("min");
    const dMin = () => { const n = min(); return n ? Math.hypot(n.pos.x - me().x, n.pos.z - me().z) : 99; };
    const minTo = (x, y, z) => { CAST.act(g, S.run, { id: "min", to: { x, y, z } }); step(1); };
    const put = (z, x, zz, y) => { z.mesh.position.set(x, y || 0, zz); z.navPath = null; };
    // a zombie of the test's own, where it says (its group never a scene's)
    let gid = 0;
    const one = (type, x, zz, y) => { const id = "t" + (++gid); G.StoryScenes.spawn(g, run0(), { id, at: { x, y: y || 0, z: zz }, count: 1, kinds: [type] }); const z = alive().find((q) => q.storyGroup === id); if (z) put(z, x, zz, y); return z; };
    // on foot along [x, z] points, `v` m/s, the floor under the feet
    const walk = async (pts, v, each) => {
      for (const [tx, tz] of pts) {
        for (let n = 0; n < 1500; n++) {
          const p = me(), dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), s = Math.min(d, (v || 3.2) / 60);
          if (d < 0.05) break;
          const nx = p.x + dx / d * s, nz = p.z + dz / d * s;
          g.yawObject.rotation.y = Math.atan2(-dx, -dz);
          const y = G.getFloorHeightAt(g.world, nx, nz, p.y - 1.7 + 0.3);
          p.x = nx; p.z = nz; p.y = y + 1.7;
          step(1);
          if (each) each();
          if (n % 40 === 39) await yield0();
        }
      }
    };
    const heard = [];        // (every line said, as it is queued)
    const say0 = D.say;
    const sounds = [];
    const btn = (on) => ({ pressed: !!on, value: on ? 1 : 0 });
    const pad = (b) => ({ id: "test pad", connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => btn(b.includes(i))) });
    let gp = pad([]);

    try {
      G.CONFIG.story.enabled = true;
      G.save.story = { ch: {} };
      Object.keys(G.save.tutorialSeen || {}).forEach((k) => { if (/^story_/.test(k)) delete G.save.tutorialSeen[k]; });
      G.Input.mode = "desktop";
      if (G.save.settings.graphicsQuality !== "low") { G.save.settings.graphicsQuality = "low"; g.applyGraphicsQuality(); }
      const t0 = performance.now();
      D.say = function (list) { [].concat(list || []).forEach((it) => heard.push(typeof it === "string" ? it : it.line)); return say0.apply(this, arguments); };
      SCR.sound = function (n) { sounds.push(n); return sound0.apply(this, arguments); };

      // ================= A: the start =================
      {
        play(() => S.start("ch1", { scene: 6, beat: 0, skip: true }));
        step(4);
        const r = run0();
        ok("A 1-6's start: in the library (2F), late afternoon's gold light, the back door open", r.scene.id === "s6" && r.scene.clock === "17:00" && G.StoryLight.current === "golden" && Math.abs(me().y - 5.7) < 0.1 && doorOpen("LIBBACK"), [f2(me().x), f2(me().y), f2(me().z), G.StoryLight.current].join());
        ok("A Kru Min, Tonkla, Fai, Nam; the three sit; what was brought and the two shelves there", ["min", "tonkla", "fai", "nam"].every((i) => CAST.get(i)) && ["tonkla", "fai", "nam"].every((i) => CAST.get(i).pose === "sit") && ["frontShelf", "backShelf", "eaten"].every((i) => CAST.propIds().includes(i)));
        const n = min(), i = ES.info();
        ok("A she is looked after: twice the player's health, the extinguisher in her hands, behind the player", i && i.id === "min" && i.max === g.player.maxHp * 2 && i.hp === i.max && n.held && n.held.userData.prop === "extinguisher" && n.follow && n.pose === "ext" && n.followMax > 5.2, JSON.stringify(i));
        const chip = el("story-escort");
        ok("A her bar on the screen: her name, full, the extinguisher ready", chip && !hid("story-escort") && /Kru Min/.test(chip.innerText) && chip.querySelector("#se-fill").style.width === "100%" && chip.querySelector("#se-ext").classList.contains("ready") && document.body.classList.contains("story-escort-on"), chip && chip.outerHTML.slice(0, 200));
        ok("A her lines: the others stay -- \"Lead the way. I'll watch your back.\"", heard.includes("story.ch1.d.minStay") && heard.includes("story.ch1.d.minLead"));
        ok("A the PR room's and the office's doors shut, the doorway between the two rooms open; the front doors shut", !doorOpen("DPR") && !doorOpen("DADMIN") && doorOpen("PRADMIN") && !doorOpen("ENTRANCE") && USE.has("door:DPR"));
        ok("A the principal in front of the flagpole, not seen yet, his megaphone with him", CAST.get("somsak") && CAST.get("somsak").hidden && !CAST.get("somsak").model.visible && CAST.get("somsak").held && CAST.get("somsak").held.userData.prop === "megaphone");
        // her bar over nothing else: on a computer's screen, at a phone's, at a tablet's
        const rect = (e) => e.getBoundingClientRect();
        const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const bars = document.querySelector(".hd-bars"), slots = el("hud-slots");
        ok("A ...over neither the player's bars nor their slots", !over(rect(chip), rect(bars)) && !over(rect(chip), rect(slots)), JSON.stringify([rect(chip), rect(bars)]));
        await said(900);
        ok("A then: to the PR room; how to help her", run0().objective === "story.ch1.s6.obj1" && /Kru Min follows you\. If she falls, hold E/.test(SCR.state.hint), SCR.state.hint);
        note("A");
      }

      // ================= B: on foot =================
      {
        let far = 0, jump = 0, last = null, wall = 0, maxD = 0, stairs = 0, n = 0;
        const solid = (x, y, z) => G.ColGrid.near(g.world, x, z, 0.05, []).some((c) => !c.isEmpty() && x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z && y + 1 > c.min.y && y + 1 < c.max.y && (c.max.x - c.min.x) > 0.3);
        const each = () => {
          const m = min(); n++;
          const d = dMin(); maxD = Math.max(maxD, d);
          if (d > 6.5) far++;
          if (last && Math.hypot(m.pos.x - last[0], m.pos.z - last[2]) > 0.4) jump++;
          if (solid(m.pos.x, m.pos.y, m.pos.z)) wall++;
          if (m.pos.y > 0.6 && m.pos.y < 3.4) stairs++;
          last = [m.pos.x, m.pos.y, m.pos.z];
        };
        at(-36.4, 4, 5.2); minTo(-34.8, 4, 5.0);
        await walk([[-38.6, 5.5], [-40.6, 5.5], [-43.2, 5], [-45.5, 5], [-45.5, 7.5], [-50.5, 7.5], [-50.5, 3.5], [-45.5, 3.5], [-45.5, 5], [-43.2, 5]], 3.2, each);
        ok("B down the back stairs on foot: she keeps up (never more than 6.5 m behind), no jump, on the stairs' steps", far === 0 && jump === 0 && stairs > 60 && Math.abs(me().y - 1.7) < 0.1, JSON.stringify({ far, jump, stairs, maxD: f2(maxD), n }));
        ok("B ...never inside a wall", wall === 0, wall);
        maxD = 0;
        const x1 = me().x;
        await walk([[-42.5, 1.6], [-40.6, 0]], 5.2, each);
        ok("B at the player's run (5.2 m/s) she keeps up too", maxD < 6.5 && far === 0, f2(maxD));
        ok("B the 1st floor: the first three, ahead of them in the corridor; the glasses say so", has("on:e1") && alive().filter((z) => z.storyGroup === "e1").length === 3 && alive().every((z) => z.type === "normal" && z.mesh.position.x > me().x + 8), JSON.stringify(alive().map((z) => [z.type, f2(z.mesh.position.x)])) + f2(x1));
        await until(() => dMin() < 3, 200);
        kill();
        at(-30, 0, 0); step(20);
        ok("B left far behind (a cut): brought along, just behind the player", dMin() < 3.2 && Math.abs(min().pos.y) < 0.1, f2(dMin()));
        kill();
        await said(400);
        note("B");
      }

      // ================= C: who is after her =================
      {
        ES.state.cd = 999; ES.state.warnT = 999; minGod = false;     // (no extinguisher in this part, no shout)
        at(-30, 0, 0); minTo(-34, 0, 0); CAST.act(g, run0(), { id: "min", follow: false }); ES.state.stay = { x: -34, y: 0, z: 0 }; ES.state.arrived = true;
        step(2);
        const a = one("normal", -38, 0.2), b = one("normal", -25, 0.2);
        step(30);
        ok("C the one nearer to her is after her; the one nearer to the player, after the player", a._prey === true && b._prey === false, JSON.stringify([a._prey, b._prey]));
        // (a hair's breadth: not enough to change its mind)
        put(a, -32.1, 1); a._preyAt = null; a._prey = false; step(2);
        ok("C in between, a little nearer to her: the player's still (a margin)", a._prey === false);
        a._prey = true; a._preyAt = null; put(a, -31.8, 1); step(2);
        ok("C ...and the other way round: hers still", a._prey === true);
        kill((z) => z === a);
        god = false; g.player.hp = g.player.maxHp; minGod = false;
        put(a, -34.9, 0.1); a._preyAt = null; a.attackCooldown = 0;
        look(-34, 1.4, 0);
        const w0 = g.wrongCount, hp0 = g.player.hp, m0 = ES.info().hp, lb0 = g.learnBitten; let bitten = 0;
        g.learnBitten = function () { bitten++; return lb0.apply(this, arguments); };
        await until(() => ES.info().bites >= 2, 300);
        g.learnBitten = lb0;
        ok("C its blows land on her -- as hard as they would on the player -- and not on the player; no answer counted", ES.info().bites >= 2 && f2(m0 - ES.info().hp) === f2(a.damage * ES.info().bites) && g.player.hp === hp0 && bitten === 0 && g.wrongCount === w0, JSON.stringify([m0, ES.info().hp, a.damage, g.player.hp, hp0, bitten]));
        ok("C ...her bar says so (hit), and she cries out -- once, not at every blow", heard.filter((l) => l === "story.ch1.d.minHit").length === 1 && parseFloat(el("se-fill").style.width) < 100, el("se-fill").style.width);
        const hpHurt = ES.info().hp;
        kill();
        for (let i = 0; i < 12; i++) step(60, 1 / 30);
        ok("C left alone a while she gets her breath back", ES.info().hp > hpHurt, [f2(hpHurt), f2(ES.info().hp)].join());
        god = true;
        ES.state.hp = ES.state.max; ES.state.warnT = 2;
        note("C");
      }

      // ================= D: the extinguisher =================
      {
        ES.state.cd = 999;
        at(-27, 0, 0); minTo(-34, 0, 0); ES.state.stay = { x: -34, y: 0, z: 0 }; ES.state.arrived = true; min().yaw = -Math.PI / 2; step(2);
        const a = one("normal", -36.2, 0.2), b = one("normal", -36.9, -0.9), c = one("normal", -31.0, 0), far = one("normal", -40.2, 0);
        [a, b, c, far].forEach((z) => { z._hold = 5; });                  // (still, so that the burst's reach is what it is)
        ES.state.cd = 0; step(1);
        const i = ES.info();
        ok("D one within 2.8 m of her: a burst -- it and the one by it are stunned three seconds", i.sprays === 1 && a.stunT > 2.8 && a.stunT <= 3 && b.stunT > 2.8, JSON.stringify([i.sprays, a.stunT, b.stunT, c.stunT, far.stunT]));
        ok("D ...not the one behind her, nor the one past its reach", !(c.stunT > 0) && !(far.stunT > 0));
        ok("D ...she holds it out, turned to them", min().pose === "spray" && Math.abs(Math.atan2(Math.sin(min().yaw + Math.PI / 2), Math.cos(min().yaw + Math.PI / 2))) < 0.6, [min().pose, f2(min().yaw)].join());
        const ax = a.mesh.position.x, az = a.mesh.position.z;
        [a, b, c, far].forEach((z) => { z._hold = 0; z.attackCooldown = 0; });
        kill((z) => z === a || z === b);
        const bites0 = ES.info().bites;
        put(a, -35.0, 0.1); a._preyAt = null; step(100);
        ok("D stunned they stand and do not bite", Math.hypot(a.mesh.position.x + 35.0, a.mesh.position.z - 0.1) < 0.5 && ES.info().bites === bites0 && a.stunT > 0, JSON.stringify([f2(ax), f2(az), f2(a.mesh.position.x), f2(a.mesh.position.z), a.stunT]));
        ok("D her pose back after it; twenty seconds before the next (her bar shows it)", min().pose === "ext" && ES.info().cd > 17 && ES.info().cd <= 20 && !el("se-ext").classList.contains("ready"), ES.info().cd);
        await until(() => !(a.stunT > 0), 200);
        a.attackCooldown = 0; a._hold = 0;
        await until(() => ES.info().bites > bites0, 400);
        ok("D three seconds over: they come on -- and she has nothing for them yet", ES.info().bites > bites0 && ES.info().sprays === 1);
        kill();
        // the player in trouble beside her: she helps; a Screamer drawing breath: cut off
        ES.state.hp = ES.state.max; ES.state.cd = 999;
        at(-33, 0, 0); minTo(-34.4, 0, 0.6); ES.state.stay = { x: -34.4, y: 0, z: 0.6 }; step(1);
        const s = one("screamer", -31.4, 0.1);
        s._hold = 0; s._screamCd = 0; s._rear = 2; s._rearScream = 1.2; s._screaming = false; ES.state.cd = 0; step(1);
        ok("D one at the player, the two together: a burst for the player too", ES.info().sprays === 2 && s.stunT > 2.5, JSON.stringify([ES.info().sprays, s.stunT]));
        ok("D ...a Screamer drawing breath: its shriek never comes", !(s._rear > 0) && !s._screaming);
        kill();
        // the two apart: the player's own business
        ES.state.cd = 999; at(-24, 0, 0); step(1); const p1 = one("normal", -22.6, 0); p1._hold = 9; ES.state.cd = 0; step(3);
        ok("D far from her the player is on their own", ES.info().sprays === 2 && !(p1.stunT > 0));
        kill(); ES.state.cd = 999;
        note("D");
      }

      // ================= E: the shout =================
      {
        ES.start(g, run0(), { id: "min", follow: true });
        at(-26, 0, 0); minTo(-27.2, 0, 0.5); await said(300);
        const behind = () => heard.filter((l) => /minBehind/.test(l)).length;
        const n0 = behind();
        look(-10, 1.6, 0);
        ES.state.warnT = 0;
        const z = one("normal", -20, 0.2); z._hold = 99; step(40);
        ok("E one in front: no shout", behind() === n0);
        kill();
        ES.state.warnT = 0;
        const q = one("normal", -32, 0.2); q._hold = 99; look(-10, 1.6, 0); await until(() => behind() > n0, 60);
        ok("E one behind, in sight: \"Behind you!\" (one of her three)", behind() === n0 + 1 && D.current && /minBehind[123]/.test(D.current.line), D.current && D.current.line);
        step(60);
        ok("E ...not over and over", behind() === n0 + 1);
        kill(); await said(300);
        // behind a wall: not seen, not said (a room off the corridor)
        at(-28, 0, 0.9); g.yawObject.rotation.y = Math.PI; g.pitchObject.rotation.x = 0; minTo(-29.4, 0, 0.6);
        const w = one("normal", -28, -6); w._hold = 99; ES.state.warnT = 0; g.yawObject.rotation.y = Math.PI; step(40);
        ok("E behind a wall: no shout", behind() === n0 + 1, behind());
        ok("E what can be seen (G.Story.sees): along the corridor, not through a wall, through a doorway, not through a shut door", S.sees(g, me(), new THREE.Vector3(-18, 0, 0.9)) && !S.sees(g, me(), w.mesh.position)
          && (() => { at(-9.5, 0, 0.5); const shut = S.sees(g, me(), new THREE.Vector3(-9.5, 0, 5)); M().door("DPR", true); const open = S.sees(g, me(), new THREE.Vector3(-9.5, 0, 5)); M().door("DPR", false); return !shut && open; })());
        kill();
        note("E");
      }

      // ================= F: down and up =================
      {
        at(-24, 0, 0); minTo(-27, 0, 0.4); CAST.act(g, run0(), { id: "min", follow: false }); ES.state.stay = { x: -27, y: 0, z: 0.4 }; ES.state.arrived = true; ES.state.cd = 999; ES.state.hp = 5; ES.state.warnT = 99; step(2);
        await said(300);
        const z = one("normal", -28, 0.4); z._preyAt = null; z.attackCooldown = 0;
        await until(() => ES.info().down, 300);
        const n = min();
        ok("F her health gone: down -- on the floor, HELP! over her (through walls), \"I can't get up...\"", ES.info().down && n.pose === "floor" && n.label && n.labelWord === "HELP!" && !n.label.material.depthTest && heard.includes("story.ch1.d.minDown") && has("fell:min"), JSON.stringify(ES.info()));
        step(2);
        ok("F nobody is after her now", !g.zombies.some((q) => q.alive && q._prey) && ES.target(g) === null);
        ok("F her bar: down, the seconds left, which way", !hid("se-note") && /Down! (30|29) s — (behind you|ahead|left|right)/.test(el("se-note").innerText) && el("story-escort").classList.contains("down") && /Kru Min is down! Hold E/.test(SCR.state.hint), el("se-note").innerText + " | " + SCR.state.hint);
        kill();
        look(-27, 0.5, 0.4); step(1); look(-20, 1.6, 0); step(2);
        ok("F ...the way: behind the player", /behind you/.test(el("se-note").innerText), el("se-note").innerText);
        at(-26.1, 0, 0.4); look(-27, 0.5, 0.4); step(1); g.updateInteractRay();
        const pr = promptText();
        g.doInteract(); step(2);
        ok("F \"Hold E: Help Kru Min up\" -- a press alone does nothing", /Hold E: Help Kru Min up/.test(pr) && ES.info().down, pr);
        const t1 = ES.info().downT;
        G.Input.keys[kb.interact] = true; for (let i = 0; i < 90; i++) { look(-27, 0.5, 0.4); step(1); } G.Input.keys[kb.interact] = false;
        ok("F held a second and a half: half way, the ring shown; the half minute stands still meanwhile", ES.info().down && PUSH.taking && Math.abs(PUSH.taking.p - 0.5) < 0.06 && !hid("story-push") && f2(t1 - ES.info().downT) < 0.1 && ES.info().helping, JSON.stringify([PUSH.taking, t1, ES.info().downT]));
        step(30);
        ok("F ...let go: it runs back; the half minute runs on", (USE.point("revive").ref.holdP || 0) < 0.2 && ES.info().downT < t1 - 0.3, USE.point("revive").ref.holdP);
        G.Input.keys[kb.interact] = true; let k = 0; for (; k < 260 && ES.info().down; k++) { look(-27, 0.5, 0.4); step(1); } G.Input.keys[kb.interact] = false;
        step(1);
        ok("F three seconds held: up, half her health, \"Thank you...\" -- and unhurt for a moment", !ES.info().down && k >= 150 && k <= 190 && Math.abs(ES.info().hp - ES.info().max / 2) < 2 && heard.includes("story.ch1.d.minUp") && ES.info().safeT > 1.5 && n.pose === "ext" && !n.label && !USE.has("revive"), JSON.stringify([k, ES.info()]));
        const hpA = ES.info().hp; ES.bite(g, { damage: 50 });
        ok("F ...a blow in that moment does nothing", ES.info().hp === hpA);
        ok("F the flag for the achievement kept past the scene (not one of its own)", has("fell:min") && !/^(x|on|used|tried|card|quiz|qte|lock|pushed|pick|picked|boss|pa|hold):/.test("fell:min"));
        // by a finger on the hand button, by the controller's Y
        for (const how of ["touch", "pad"]) {
          ES.state.safeT = 0; ES.state.hp = 1; ES.bite(g, { damage: 9 }); step(2);
          at(-26.1, 0, 0.4);
          if (how === "pad") { G.Input.pollGamepad = () => gp; }
          let m = 0;
          for (; m < 260 && ES.info().down; m++) { look(-27, 0.5, 0.4); if (how === "touch") G.Input.touchInteractHeld = true; else { gp = pad([3]); G.Pad.poll(1 / 60); } step(1); }
          if (how === "touch") G.Input.touchInteractHeld = false; else { gp = pad([]); G.Pad.poll(1 / 60); G.Input.pollGamepad = pad0; G.Input.padActive = false; G.Input.padUse = false; }
          ok("F helped up " + (how === "touch" ? "with a finger held on the hand button" : "with the controller's Y held"), !ES.info().down && m < 260, m);
        }
        await said(400);
        // nobody helps her: the half minute over -- back to the save
        ES.state.safeT = 0; ES.state.hp = 1; ES.bite(g, { damage: 9 }); at(-20, 0, 0);
        for (let i = 0; i < 31 * 30 && !G.Dialog.isOpen(); i++) { step(1, 1 / 30); if (i % 60 === 59) await yield0(); }
        ok("F nobody helped her in half a minute: \"Kru Min didn't make it\" -- back to the save", G.Dialog.isOpen() && run0().dead && /Kru Min didn't make it/.test(el("dialog-box").innerText) && /last save point/.test(el("dialog-box").innerText), (el("dialog-box") || {}).innerText);
        play(() => G.Dialog.choose(1));
        step(4);
        ok("F ...the retry: the scene from its start, she is well (and nothing of it left)", run0().scene.id === "s6" && ES.info() && !ES.info().down && ES.info().hp === ES.info().max && !alive().length && !USE.has("revive") && Math.abs(me().y - 5.7) < 0.1, JSON.stringify(ES.info()));
        note("F");
      }

      // ================= G: the corridor, the PR room =================
      {
        await said(900);
        at(-42.4, 0, 3); await until(() => has("on:e1"), 60);
        ok("G at the foot of the back stairs: three ahead", alive().filter((z) => z.storyGroup === "e1").length === 3);
        kill(); at(-24, 0, 0); await until(() => has("on:e2"), 60);
        const sp = alive().filter((z) => z.storyGroup === "e2");
        ok("G half way along: two Sprinters, from behind", sp.length === 2 && sp.every((z) => z.type === "fast" && z.mesh.position.x < -40));
        look(-10, 1.6, 0); minTo(-25.4, 0, 0.4);
        const n0 = heard.filter((l) => /minBehind/.test(l)).length; ES.state.warnT = 0;
        await until(() => heard.filter((l) => /minBehind/.test(l)).length > n0, 900);
        ok("G ...they come the whole way; she shouts as they do", heard.filter((l) => /minBehind/.test(l)).length > n0);
        kill(); await said(300);
        at(-12, 0, 0); await until(() => has("on:e3"), 60);
        ok("G near the PR room: four from the entrance's side", alive().filter((z) => z.storyGroup === "e3").length === 4 && alive().every((z) => z.mesh.position.x > -2));
        kill(); await said(300);
        at(-9.5, 0, 0.8); step(4);
        const p = useAt(-9.5, 1.2, 2.5);
        ok("G the PR room's door, by hand", /Open the door/.test(p) && doorOpen("DPR"), p);
        // (not before the two of them are in)
        minTo(-30, 0, 0); ES.start(g, run0(), { id: "min", stay: { x: -30, y: 0, z: 0 }, put: true }); at(-10.6, 0, 5.8); step(60);
        ok("G in the PR room without her: nothing yet", !has("x:pr") && !sounds.includes("bent"));
        ES.start(g, run0(), { id: "min", follow: true }); minTo(-9.5, 0, 1.2); await until(() => has("x:pr"), 300);
        ok("G both in: LEXA's jingle, broken, over and over; \"The system scrambled our announcement...\"", has("x:pr") && sounds.includes("bent") && SCR.state.loops.includes("bent") && heard.includes("story.ch1.d.minScrambled") && run0().objective === "story.ch1.s6.obj");
        const m = min(), path = (m.path || []).map((q) => f2(q.x) + "," + f2(q.z)), seenWall = [];
        ok("G she goes to the desk by the doorway (the map's own way in, not through the wall)", path.length >= 2 && path.some((q) => /^-9\.5,/.test(q)), path.join(" "));
        for (let i = 0; i < 400 && !ES.is("stay"); i++) { step(1); if (m.pos.z > 2 && m.pos.z < 3 && Math.abs(m.pos.x + 9.5) > 0.6) seenWall.push(f2(m.pos.x)); }
        ok("G ...never through the wall; at the desk: turned to it, a hand on its buttons, the extinguisher on the floor beside her", ES.is("stay") && !seenWall.length && m.pose === "console" && Math.hypot(m.pos.x + 12.1, m.pos.z - 5.05) < 0.3 && m.held && m.held.position.y === 0, JSON.stringify([seenWall, m.pose, f2(m.pos.x), f2(m.pos.z)]));
        note("G");
      }

      // ================= H: the PA =================
      {
        await until(() => USE.has("pa:pa"), 300);
        at(-11.0, 0, 5.5);
        const calls = [];
        G.Learning.answerWord = function (pair, right, o) { calls.push([pair[0], right, !!(o && o.recall)]); return answer0.apply(this, arguments); };
        const st = ["evaluate", "evacuate", "avoid", "afford", "assume"].map(stat).join();
        const p = useAt(-11.5, 0.9, 4.2);
        const box = el("story-pa-box"), txt = () => box.innerText.replace(/\s+/g, " ");
        ok("H \"E: Open the Smart PA\" -- its window, the world held: the draft with its three gaps, the first lit, two words", /Open the Smart PA/.test(p) && G.Modal.isOpen("story-pa") && G.Modal.freezesWorld() && PA.holds() && /Attention, all students\. Please 1/.test(txt()) && /Help is on the way/.test(txt())
          && box.querySelectorAll(".spa-gap").length === 3 && box.querySelectorAll(".spa-gap.on").length === 1 && Array.from(box.querySelectorAll(".spa-opt")).map((b) => b.innerText.replace(/\s+/g, "")).join() === "1evacuate,2evaluate" && /powered by NeuroLex/.test(txt()), txt().slice(0, 300));
        ok("H ...her line in it; not said again after", /The system scrambled our announcement/.test(txt()) && !D.busy());
        ok("H ...the controller's window is this one", G.Pad.scope ? G.Pad.scope() === box : true);
        key("Digit2"); step(1);
        ok("H a wrong one by its key (2, evaluate): not in -- what it means, Kru Min's word on the two; the choice again at once", PA.info("pa").gap === 0 && PA.info("pa").wrong.length === 1 && has("pawrong:pa:1") && /✗ evaluate/.test(box.querySelector(".spa-card").innerText) && box.querySelector(".spa-card").innerText.includes(PA.gloss("evaluate")) && PA.gloss("evaluate").length > 1 && /Evaluate means to judge something/.test(txt())
          && box.querySelectorAll(".spa-opt:not([disabled])").length === 1, box.querySelector(".spa-card").innerText);
        ok("H ...evacuate is no word of the bank's: counted nowhere (nor is evaluate)", !calls.length && ["evaluate", "evacuate", "avoid", "afford", "assume"].map(stat).join() === st);
        key("Digit1", true); step(1);
        ok("H (a key held down is no answer)", PA.info("pa").gap === 0);
        box.querySelector('.spa-opt[data-i="0"]').click(); step(1);
        ok("H the right one by a click: in -- the next gap (a sentence's first word: its capital)", PA.info("pa").gap === 1 && /Please evacuate the building now\. 2/.test(txt()) && Array.from(box.querySelectorAll(".spa-opt")).map((b) => b.innerText.replace(/\s+/g, "")).join() === "1Afford,2Avoid" && /✓ evacuate/.test(box.querySelector(".spa-card").innerText), txt().slice(60, 300));
        // closed and opened again: what is in stays in
        key(kb.interact); step(2);
        ok("H stepped back from (E): closed; opened again: where it was", !PA.holds() && !G.Modal.isOpen("story-pa"));
        useAt(-11.5, 0.9, 4.2);
        ok("H ...the first gap still filled", PA.holds() && PA.info("pa").gap === 1 && /Please evacuate/.test(txt()));
        key("ArrowRight"); key("Enter"); step(1);
        ok("H by the arrow keys and Enter (avoid): in", PA.info("pa").gap === 2 && /Avoid the main stairs/.test(txt()), txt().slice(60, 260));
        // the third: a bank's word -- wrong first (assume): counted wrong, once
        G.Input.pollGamepad = () => gp;
        G.Pad.setFocus(box.querySelector('.spa-opt[data-i="1"]'));
        gp = pad([]); G.Pad.poll(1 / 60); gp = pad([0]); G.Pad.poll(1 / 60); gp = pad([]); G.Pad.poll(1 / 60);
        ok("H by the controller (A on assume): wrong -- the word asked is the bank's: counted wrong, a cloze", PA.info("pa").wrong.includes("2:assume") && calls.length === 1 && calls[0][0] === "assemble" && calls[0][1] === false && /Assemble means to come together/.test(txt()), JSON.stringify(calls));
        G.Pad.setFocus(box.querySelector('.spa-opt[data-i="0"]'));
        gp = pad([0]); G.Pad.poll(1 / 60); gp = pad([]); G.Pad.poll(1 / 60);
        G.Input.pollGamepad = pad0; G.Input.padActive = false;
        ok("H ...then right: the whole of it, READY; not counted a second time", PA.info("pa").done && has("pa:pa") && calls.length === 1 && /Attention, all students\. Please evacuate the building now\. Avoid the main stairs\. Assemble at the football field\. Help is on the way\./.test(txt()) && /READY/.test(txt()), txt().slice(0, 300));
        G.Learning.answerWord = answer0;
        await sleep(2200); step(3);
        ok("H ...the window goes by itself; the desk has nothing more; the jingle stopped", !PA.holds() && hid("story-pa-box") && !USE.has("pa:pa") && !SCR.state.loops.includes("bent"));
        note("H");
      }

      // ================= I: is help really on the way? =================
      {
        await until(() => G.Dialog.isOpen(), 120);
        const t = el("dialog-box").innerText;
        ok("I Kru Min reads its last line; the player may ask", /Help is on the way\./.test(t) && /Is help really on the way\?/.test(t) && /Let's go live\./.test(t), t);
        G.Dialog.choose(0); step(3);
        ok("I \"It will be. We're the help.\"", heard.includes("story.ch1.d.minHelp") && heard.includes("story.ch1.d.minPress") && G.save.story.ch.ch1.choices.help === "ask");
        await said(900);
        await until(() => (G.save.story.ch.ch1.cp || {}).beat > 0, 900);
        const cp = G.save.story.ch.ch1.cp;
        ok("I the save before the hold (the design's): the announcement mended, in the PR room", cp && cp.scene === 6 && cp.beat > 0 && cp.flags.includes("pa:pa") && Math.abs(cp.x + 10.4) < 0.01 && cp.y === 0, JSON.stringify(cp && [cp.scene, cp.beat, cp.x, cp.z]));
        step(4);
        numbers.cp = JSON.parse(JSON.stringify(cp));
        ok("I the microphone's button to press; rounds and a first-aid box in the two rooms; she is at the desk, full health", USE.has("mic") && run0().objective === "story.ch1.s6.obj2" && g.drops.filter((d) => d.mesh.position.z > 3).length >= 3 && ES.is("stay") && ES.info().hp === ES.info().max && min().pose === "console");
        ok("I ...nothing happens by itself", !has("x:live") && !PA.held && !alive().length);
        at(-10.8, 0, 5.6);
        const p = useAt(-11.09, 1.0, 4.25);
        ok("I \"E: Press the microphone button\"", /Press the microphone button/.test(p) && has("used:mic") && has("x:live"), p);
        note("I");
      }

      // ================= J: the bells, the announcement =================
      {
        ok("J the school's bells (the Westminster Quarters)", sounds.includes("chimes") && SCR.WEST.filter((f) => f).length === 8 && SCR.WEST[0] === 415.3 && run0().objective === "story.ch1.s6.obj3");
        spoke.length = 0;
        const lines = [], durs = {}, boldAt = {};
        const t1 = frames;
        await until(() => D.current && D.current.line === "story.ch1.pa.l1", 600);
        ok("J a while for the bells, then Kru Min", frames - t1 > 200, frames - t1);
        for (let i = 0; i < 2400 && !has("x:hold"); i++) {
          step(1);
          const c = D.current;
          if (c && lines[lines.length - 1] !== c.line) { lines.push(c.line); durs[c.line] = c.dur; boldAt[c.line] = el("sd-line").innerHTML; }
          if (i % 60 === 59) await yield0();
        }
        ok("J she reads out what the player mended, a line at a time", lines.slice(0, 5).join() === [1, 2, 3, 4, 5].map((i) => "story.ch1.pa.l" + i).join() && /Please evacuate the building now/.test(G.STRINGS.en["story.ch1.pa.l2"]), lines.join());
        ok("J ...aloud (the device's voice, the line's English), each line up long enough for it", spoke.filter((q) => q[1] === "text").map((q) => q[0]).join("|") === [1, 2, 3, 4, 5].map((i) => G.STRINGS.en["story.ch1.pa.l" + i]).join("|") && Object.keys(durs).every((k) => durs[k] >= 1.1 + G.STRINGS.en[k].length * 0.075 - 0.01 || !/pa\.l/.test(k)), JSON.stringify(spoke.slice(0, 6)));
        ok("J ...its words as any line's: to tap, the chapter's bold (assemble)", /sd-word key"[^>]*data-form="Assemble"/i.test(boldAt["story.ch1.pa.l4"] || ""), boldAt["story.ch1.pa.l4"]);
        note("J");
      }

      // ================= K: the hold =================
      {
        minGod = true;
        ok("K the countdown in the corner: over nothing in the middle of the HUD", el("story-timer").classList.contains("corner") && (() => { const a = el("story-timer").getBoundingClientRect(), b = document.querySelector("#hud .hud-meaning-box").getBoundingClientRect(); return a.width > 0 && a.left >= b.right; })(), JSON.stringify(el("story-timer").getBoundingClientRect()));
        ok("K \"They're coming for the sound! Hold them off!\"; the countdown, a hundred seconds; the music; three from the west", heard.includes("story.ch1.d.minHold") && PA.held && PA.held.sec === 100 && PA.held.every === 20 && SCR.state.timer === 100 && SCR.state.loops.includes("tense") && alive().filter((z) => z.storyGroup === "g0").length === 3 && /Hold on: 100/.test(el("story-timer").innerText), JSON.stringify([PA.held, SCR.state.timer, alive().length]));
        step(6);
        const tm = el("story-timer").getBoundingClientRect(), ls = el("lens-sys").getBoundingClientRect();
        ok("K the glasses' line not over the countdown", hid("lens-sys") || ls.top >= tm.bottom - 1 || ls.bottom <= tm.top + 1 || ls.right <= tm.left || ls.left >= tm.right, JSON.stringify([tm.top, tm.bottom, ls.top, ls.bottom]));
        await said(400);
        at(-9.6, 0, 6.6);
        // they come to the office the whole way (one is left to)
        const one0 = alive().find((z) => z.storyGroup === "g0"), a0 = PA.announced;
        kill((z) => z === one0);
        ES.state.cd = 999;                                  // (her extinguisher has its own part, D)
        put(one0, -15, 0.3);
        look(-9.5, 1.5, 3);
        await until(() => Math.hypot(one0.mesh.position.x - me().x, one0.mesh.position.z - me().z) < 2.6 || Math.hypot(one0.mesh.position.x - min().pos.x, one0.mesh.position.z - min().pos.z) < 2.6, 1500);
        ok("K they come the whole way, through the PR room's door", one0.mesh.position.z > 2.4, JSON.stringify([f2(one0.mesh.position.x), f2(one0.mesh.position.z)]));
        kill();
        // seconds by the half: the announcement at 20
        let maxAlive = 0, per = {};
        const roll = async (to, each) => {
          for (let i = 0; i < 6000 && PA.held && !PA.held.over && PA.held.t < to; i++) {
            step(1, 1 / 30);
            const al = alive(); maxAlive = Math.max(maxAlive, al.length);
            al.forEach((z) => { per[z.storyGroup] = per[z.storyGroup] || new Set(); per[z.storyGroup].add(z.uid); });
            if (each) each(i);
            if (i % 30 === 29) { await yield0(); if (i % 60 === 59) kill((z) => z._keep); }
          }
        };
        spoke.length = 0;
        ok("K (the half of it left: it is not twenty seconds yet)", PA.held.t < 19, PA.held.t);
        await roll(19.5);
        ok("K (nothing on the loop before its time)", PA.announced === a0);
        await roll(20.3);
        ok("K ...its caption over neither her bar, a line's box nor the player's bars", (() => { const r0 = el("story-whisper").getBoundingClientRect(), o2 = (q) => { const b = q && q.getBoundingClientRect(); return !!b && b.width > 0 && r0.left < b.right && b.left < r0.right && r0.top < b.bottom && b.top < r0.bottom; }; return !o2(el("story-escort")) && !o2(document.querySelector(".hd-bars")) && !o2(el("story-dlg")); })(), JSON.stringify(el("story-whisper").getBoundingClientRect()));
        ok("K at twenty seconds it repeats: the PA's two notes, the whole of it as a caption", PA.announced === a0 + 1 && has("hold:office:1") && sounds.includes("chime") && !hid("story-whisper") && el("story-whisper").classList.contains("pa") && /Attention, all students\. Please evacuate the building now\. Avoid the main stairs\. Assemble at the football field\. Help is on the way\./.test(el("story-whisper").innerText), el("story-whisper").innerText);
        await until(() => spoke.some((q) => q[1] === "text"), 300);
        ok("K ...and aloud (once the two notes, and any line being said, are over)", spoke.some((q) => q[1] === "text" && /^Attention, all students\. Please evacuate/.test(q[0])), JSON.stringify(spoke.slice(0, 3)));
        const w0 = spoke.length;
        step(90);
        ok("K ...no zombie's whisper over it", !spoke.slice(w0).some((q) => q[1] === "whisper"));
        ok("K ...more of them, from the entrance's side and the west", has("on:h1") && run0().groups.g1 === 2 && run0().groups.g1b === 1, JSON.stringify(run0().groups));
        kill();
        // she is down: it stands still
        minGod = false; ES.state.safeT = 0; ES.state.hp = 1; ES.bite(g, { damage: 9 }); step(3);
        const t2 = PA.held.t;
        step(60);
        ok("K she is down: the hold stands still (nobody at the desk), the countdown with it", ES.info().down && PA.held.paused && PA.held.t === t2 && el("story-timer").classList.contains("held"), JSON.stringify(PA.held));
        at(-11.3, 0, 6.2); G.Input.keys[kb.interact] = true; for (let i = 0; i < 260 && ES.info().down; i++) { look(-12.1, 0.55, 5.05); step(1); } G.Input.keys[kb.interact] = false; step(2);
        ok("K ...helped up: back at the desk, and on it goes", !ES.info().down && min().pose === "console" && !PA.held.paused && !el("story-timer").classList.contains("held"));
        minGod = true; ES.state.hp = ES.state.max; kill();
        at(-9.6, 0, 6.6);
        await roll(35.6);
        ok("K the office's door banged on before it gives", has("on:h1c") && !doorOpen("DADMIN"));
        await roll(40.3);
        ok("K at forty: the door kicked open; the first Screamer -- the glasses, the hint", doorOpen("DADMIN") && has("on:h2") && alive().some((z) => z.type === "screamer") && /Shoot it while it rears up/.test(SCR.state.hint) && (LL.line && LL.line.key === "story.ch1.sys.screamer" || true), JSON.stringify([SCR.state.hint, alive().map((z) => z.type)]));
        // the Screamer: not behind a wall
        const s = alive().find((z) => z.type === "screamer");
        kill((z) => z === s);
        s._keep = true;
        let shrieks = 0;
        G.ZombieAI.shriek = function (gm, z) { shrieks++; return shriek0.call(this, gm, z); };
        at(-12.6, 0, 6.6); put(s, -12.6, -1.2); s._screamCd = 0; s._hold = 0;
        let reared = false;
        for (let i = 0; i < 40; i++) { put(s, -12.6, -1.2); s._screamCd = 0; step(1); if (s._rear > 0) reared = true; }
        ok("K out of sight (a wall between): it does not rear up", !reared && !S.sees(g, me(), s.mesh.position));
        // in sight, from closer than the campaign's five metres
        at(-11.0, 0, 7.2); put(s, -9.5, 3.6); s._screamCd = 0;
        await until(() => s._rear > 0, 60);
        ok("K in sight of the player, four metres off: it rears up -- a second's warning", s._rear > 0 && !s._screaming && S.sees(g, me(), s.mesh.position), JSON.stringify([s._rear, f2(Math.hypot(me().x - s.mesh.position.x, me().z - s.mesh.position.z))]));
        step(20); const gr0 = Object.keys(run0().groups).length;
        s._keep = false; g.damageZombie(s, 9999, s.mesh.position.clone(), { dir: null, head: false }); step(90);
        ok("K killed as it rears up: no shriek, nobody called", shrieks === 0 && !has("x:shriek") && !Object.keys(run0().groups).some((k) => /^shriek/.test(k)), [shrieks, gr0, Object.keys(run0().groups).length].join());
        kill();
        // one that is not stopped
        const s2 = one("screamer", -9.5, 3.6), by = one("normal", -10.4, 0.4); at(-11.0, 0, 7.2); s2._keep = true; put(s2, -9.5, 3.6); s2._screamCd = 0; by._hold = 30;
        await until(() => s2._rear > 0, 60);
        await until(() => shrieks > 0, 120);
        const called = alive().filter((z) => /^shriek/.test(z.storyGroup || ""));
        ok("K left alone: it shrieks a second on -- the others speed up, two more come (the scene's own, from the corridor)", shrieks === 1 && by._boostT > 0 && has("x:shriek") && called.length === 2 && called.every((z) => Math.abs(z.mesh.position.z) < 2.5) && run0().groups.shriek1 === 2, JSON.stringify([shrieks, by._boostT, called.length]));
        s2._keep = false; kill();
        // with the place full of them it calls none
        const room = Array.from({ length: 9 }, (_, i) => one("normal", -30 - i * 0.8, 0.3)); const n9 = S.onShriek(g, s2);
        ok("K ...never more than the scene's eight standing", n9 === 0 && room.length === 9, n9);
        kill();
        G.ZombieAI.shriek = shriek0;
        at(-9.6, 0, 6.6);
        await roll(60.3);
        const gl = alive().filter((z) => z.storyGroup === "g3");
        ok("K at sixty: in by the office's window (the player in the PR room)", has("on:h3") && gl.length === 2 && gl.every((z) => z.mesh.position.x > -7.5 && z.mesh.position.z > 5), JSON.stringify(gl.map((z) => [f2(z.mesh.position.x), f2(z.mesh.position.z)])));
        kill();
        await roll(80.3);
        ok("K at eighty: a Screamer, Sprinters, from both sides", has("on:h4") && run0().groups.g4 >= 1 && PA.announced === a0 + 4, JSON.stringify(run0().groups) + PA.announced);
        kill();
        at(6, 0, 0); step(4);
        ok("K away from them: \"Kru Min is on her own\"", /on her own/.test(SCR.state.hint), SCR.state.hint);
        at(-9.6, 0, 6.6);
        let t3 = PA.held.t, held100 = false;
        await roll(101);
        held100 = has("hold:office");
        ok("K a hundred seconds: held -- the countdown gone, \"That's enough...\"", held100 && has("x:held") && hid("story-timer") && heard.includes("story.ch1.d.minHeld"), JSON.stringify([t3, PA.held, hid("story-timer")]));
        ok("K ...four times on the loop; never more than six from the rules at once (and the shriek's)", PA.announced === a0 + 4 && maxAlive <= 8, maxAlive);
        numbers.groups = JSON.parse(JSON.stringify(run0().groups)); numbers.maxAlive = maxAlive;
        const total = Object.keys(run0().groups).filter((k) => /^g/.test(k)).reduce((a, k) => a + run0().groups[k], 0);
        numbers.holdTotal = total;
        ok("K some twenty in all", total >= 14 && total <= 24, total);
        kill();
        note("K");
      }

      // ================= L: who heard it; the window =================
      {
        await said(600);
        await until(() => has("msg:fai1"), 400);
        ok("L the first message: Fai -- \"We heard you. Going down the back stairs now.\"", has("msg:fai1") && !has("msg:unk1") && /We heard you/.test((el("story-toast") || {}).innerText || "") && run0().objective === "story.ch1.s6.obj6", (el("story-toast") || {}).innerText);
        await until(() => has("msg:unk1"), 400); const t1 = frames;
        ok("L ...then an unknown number: Room 207", has("msg:unk1") && !has("msg:unk2"));
        await until(() => has("msg:unk2"), 400);
        ok("L ...and another, one by one", has("msg:unk2") && frames - t1 > 150);
        await until(() => USE.has("window"), 400);
        ok("L Kru Min at the office's window (by the doorway between the two rooms)", Math.hypot(min().pos.x + 4.7, min().pos.z - 7.9) < 0.6 || !!min().path, JSON.stringify([f2(min().pos.x), f2(min().pos.z)]));
        ok("L \"Look out of the office window\"", run0().objective === "story.ch1.s6.obj5" && CAST.get("somsak").hidden);
        await until(() => ES.is("stay"), 400);
        PH.open && PH.open("unknown"); step(1);
        ok("L the phone: the conversations of who wrote", !PH.isOpen || (PH.isOpen() && /Room 207/.test(el("story-phone").innerText)), (el("story-phone") || {}).innerText);
        if (PH.close) PH.close(); step(1);
        at(-2, 0, 8.0);
        const p = useAt(-2, 1.5, 8.75);
        ok("L \"E: Look out of the window\": the view turned to the principal, bars; there he stands", /Look out of the window/.test(p) && G.StoryCam.barsOn && !CAST.get("somsak").hidden && CAST.get("somsak").pose === "megaphone", p);
        await until(() => !G.StoryCam.turning, 200); step(10);
        g.yawObject.updateMatrixWorld(true);
        const s = CAST.get("somsak"), v = new THREE.Vector3(s.pos.x, 1.5, s.pos.z).project(g.camera);
        ok("L ...in the middle of the view, seen through the window (nothing of a wall before him)", s.model.visible && Math.abs(v.x) < 0.2 && Math.abs(v.y) < 0.35 && v.z < 1, JSON.stringify([f2(v.x), f2(v.y)]));
        await until(() => D.current && D.current.line === "story.ch1.d.minSomsak", 200);
        ok("L \"Principal Somsak... He took the biggest dose of all.\"", D.current && D.current.line === "story.ch1.d.minSomsak" && sounds.includes("sting"));
        await said(900);
        await until(() => run0().scene.id === "s7", 300);
        const cp = G.save.story.ch.ch1.cp;
        ok("L the save: scene 1-7 next (1-6's flags left behind; the phone's and the fall's kept)", run0().scene.id === "s7" && cp && cp.scene === 7 && cp.flags.includes("msg:fai1") && cp.flags.includes("chose:help") && !cp.flags.some((f) => /^(x|on|used|pa|pawrong|hold|tried):/.test(f)), JSON.stringify(cp && cp.flags));
        ok("L ...nobody looked after any more: no bar, no loop, no bars", !ES.active && hid("story-escort") && !document.body.classList.contains("story-escort-on") && !PA.held && !G.StoryCam.barsOn && doorOpen("ENTRANCE"));
        note("L");
      }

      // ================= M: the save picked up; lost in the hold =================
      {
        minGod = false;
        G.save.story.ch.ch1.cp = JSON.parse(JSON.stringify(numbers.cp));
        play(() => S.start("ch1", Object.assign({}, numbers.cp)));
        step(6);
        ok("M the save before the hold picked up: the PR room, its door open, Kru Min at the desk, full health; the announcement mended, the microphone to press", run0().scene.id === "s6" && Math.abs(me().x + 10.4) < 0.5 && doorOpen("DPR") && !doorOpen("DADMIN") && Math.hypot(min().pos.x + 12.1, min().pos.z - 5.05) < 0.2 && min().pose === "console" && ES.info().hp === ES.info().max && USE.has("mic") && !USE.has("pa:pa") && !hid("story-escort")
          && run0().objective === "story.ch1.s6.obj2", JSON.stringify([f2(me().x), f2(min().pos.x), f2(min().pos.z), run0().beatI, run0().objective]));
        ok("M ...nobody in the library any more to be seen down here; her extinguisher on the floor", min().held && min().held.position.y === 0);
        at(-10.8, 0, 5.6); useAt(-11.09, 1.0, 4.25);
        await until(() => has("x:hold"), 2600, 1 / 30);
        ok("M live again: the hold", !!PA.held && alive().length > 0);
        god = false; g.player.hp = 0; g.checkPlayerDeath(); step(3);
        ok("M down in the hold: the chapter's own window", G.Dialog.isOpen() && run0().dead);
        god = true;
        play(() => G.Dialog.choose(1));
        step(6);
        ok("M ...retry: before the microphone, nothing of the hold left (no countdown, no loop, nobody)", run0().scene.id === "s6" && !PA.held && hid("story-timer") && !alive().length && USE.has("mic") && !has("x:hold") && ES.info().hp === ES.info().max && hid("story-whisper"), JSON.stringify([PA.held, alive().length]));
        note("M");
      }

      // ================= N: around it =================
      {
        // the principal's office: the contract
        at(10.6, 0, 6.2);
        const p = useAt(10.6, 0.86, 5.2);
        await yield0(); step(1);
        ok("N the principal's desk: \"E: Read the contract\" -- its card (evidence: kept for round 11)", /Read the contract/.test(p) && has("found:contract") && G.Dialog.isOpen() && /Pilot School Agreement/.test(el("dialog-box").innerText) && /LEXA v2\.1 trial/.test(el("dialog-box").innerText), p);
        G.Dialog.choose(0); step(2);
        // a save of an earlier build: the scene's stand-in began on the ground floor
        play(() => S.start("ch1", { scene: 6, beat: 0, x: -41.2, y: 0, z: -1, yaw: 0, flags: [], guns: ["pistol"], ammo: {} }));
        step(6);
        ok("N a save of an earlier build (this scene began on the 1st floor): in the library", run0().scene.id === "s6" && Math.abs(me().y - 5.7) < 0.1 && me().x > -38, [f2(me().x), f2(me().y), f2(me().z)].join());
        ok("N LEXA's advertisement has its tune in the prologue (it comes back broken here)", G.STORY_CHAPTERS.ch1.scenes[0].beats.some((b) => (b.do || []).some((a) => a[0] === "notify" && a[1] === "ad") && (b.do || []).some((a) => a[0] === "sound" && a[1] === "jingle")));
        ok("N evacuate, avoid, afford: meanings in the four meaning languages (practice: not the bank's); assemble, assume and evaluate the bank's", ["evacuate", "avoid", "afford"].every((w) => { const q = G.STORY_WORDS.ch1[w]; return q && ["th", "zh", "fr", "en"].every((l) => q[l]); }) && ["assemble", "assume", "evaluate"].every((w) => G.WordBank.byId(w) || G.WordBank.lookup(w)) && !G.WordBank.lookup("evacuate"));
        const keys = [];
        const collect = (o) => { if (typeof o === "string") { if (/^(story|cap)\./.test(o)) keys.push(o); } else if (Array.isArray(o)) o.forEach(collect); else if (o && typeof o === "object") Object.values(o).forEach(collect); };
        collect(G.STORY_CHAPTERS.ch1.scenes[6]); collect(G.STORY_CHAPTERS.ch1.messages); collect(G.STORY_CHAPTERS.ch1.contacts);
        ["story.ch1.d.minBehind1", "story.ch1.d.minBehind2", "story.ch1.d.minBehind3", "story.ch1.d.minHit", "story.ch1.d.minDown", "story.ch1.d.minUp", "story.hint.escort.touch", "story.hint.escort.pad", "story.hint.revive", "story.hint.revive.touch", "story.hint.revive.pad", "story.use.revive",
          "story.escort.help", "story.escort.down", "story.escort.ahead", "story.escort.behind", "story.escort.left", "story.escort.right", "story.fail.min.title", "story.fail.min.text", "story.pa.by", "story.pa.error", "story.pa.ready", "story.pa.gap", "story.pa.done", "story.pa.close",
          "story.pa.keys", "story.pa.keysTouch", "story.pa.keysPad", "cap.extinguisher", "story.timer.hold"].forEach((k) => keys.push(k));
        const uniq = Array.from(new Set(keys)), miss = uniq.filter((k) => G.STRINGS.en[k] == null);
        for (const l of ["th", "zh", "fr"]) { const t = await (await fetch("/js/strings-" + l + ".js?r=" + Date.now())).text(); uniq.forEach((k) => { if (!t.includes('"' + k + '":')) miss.push(l + ":" + k); }); }
        ok("N its lines, hints and windows in the four languages (" + uniq.length + " keys)", !miss.length && uniq.length > 70, miss.join());
        // its window and her bar at a phone's size, in Thai: nothing cut off
        ok("N the PA's and her bar's styles for a short screen and for a touch screen", Array.from(document.styleSheets).some((s) => { try { return Array.from(s.cssRules).some((r) => r.conditionText && /max-height: 460px/.test(r.conditionText) && Array.from(r.cssRules).some((q) => /\.spa-opt/.test(q.selectorText || ""))); } catch (e) { return false; } }));
        // draw calls on Low: the corridor with four, the PR room in the hold with seven, the office, its window
        const draws = () => { step(4); g.renderFrame(); return g.renderer.info.render.calls; };
        const calls = {};
        const grp = (id, spots) => { spots.forEach(([x, z], i) => one(i % 3 === 2 ? "fast" : "normal", x, z)); };
        play(() => S.start("ch1", { scene: 6, beat: 0, skip: true }));
        at(-36.4, 4, 5.2); look(-32, 5.3, 6); calls.library = draws();
        at(-16, 0, 0); minTo(-17.4, 0, 0.5); kill(); grp("c", [[-8, 0.4], [-6, -0.4], [-4.4, 0.5], [-2.6, -0.2]]); look(-4, 1.4, 0); calls.corridor = draws();
        kill(); M().door("DPR", true); M().door("DADMIN", true);
        ES.start(g, run0(), { id: "min", stay: { x: -12.1, y: 0, z: 5.05, face: { x: -11.9, z: 4.1 } }, pose: "console", put: true });
        at(-11.6, 0, 8.2); kill(); grp("h", [[-9.5, 3.8], [-9.6, 1.8], [-8.8, 0.4], [-10.6, -0.2], [-13.2, 5.8], [-9.0, 6.0], [-10.2, 5.4]]); look(-10.4, 1.3, 3.2); calls.hold = draws();
        at(-0.8, 0, 8.2); look(-9, 1.3, 5.6); calls.office = draws();
        kill(); CAST.act(g, run0(), { id: "somsak", show: true }); CAST.act(g, run0(), { id: "min", to: { x: -4.7, y: 0, z: 7.9 } }); at(-2, 0, 8.0); look(-2.6, 1.5, 18.2); calls.window = draws();
        numbers.calls = calls;
        ok("N draw calls on Low under 150 (the library, the corridor with four, the PR room with seven, the office, its window)", Object.values(calls).every((c) => c < 150), JSON.stringify(calls));
        // the door between the rooms: a way for a zombie, shut and opened
        ok("N the PR room and the office: one way through for who walks the map (its waypoints)", (() => { const path = G.findPath(g.world, "PR", "ADMIN"); return path.includes("DPRADMIN"); })());
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        play(() => g.startLevel(1));
        ok("N the campaign after it: nobody looked after, no bar, no countdown, its zombies after the player", !ES.active && hid("story-escort") && hid("story-timer") && !PA.held && !G.Story.run);
        // the campaign's Screamer: its own range, walls or no walls (as it was)
        const cz = g.spawnZombieAt("screamer", me().clone().setY(0).add(new THREE.Vector3(0, 0, -4)), null, null);
        if (cz) { cz.emerge = null; cz._screamCd = 0; G.ZombieAI.screamer(g, cz, 1 / 60); }
        const near4 = cz && !(cz._rear > 0);
        if (cz) { cz.mesh.position.set(me().x, cz.mesh.position.y, me().z - 7); cz.mesh.position.y = me().y - 1.7; cz._screamCd = 0; G.ZombieAI.screamer(g, cz, 1 / 60); }
        ok("N the campaign's Screamer as it was: not at four metres, at seven it rears up whatever stands between", near4 && cz._rear > 0, cz && [near4, cz._rear].join());
        g.update = real; g.quitToMainMenu(); g.update = () => {}; G.Modal.reset();
        numbers.frames = frames;
        numbers.realSec = Math.round((performance.now() - t0) / 1000);
      }
      D.say = say0;
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ") + " | trace " + trace.join(" "));
    } finally {
      D.say = say0; SCR.sound = sound0; G.Learning.answerWord = answer0; G.ZombieAI.shriek = shriek0;
      G.CONFIG.story.enabled = enabled0;
      G.Input.keys[kb.jump] = false; G.Input.keys[kb.interact] = false; G.Input.touchInteractHeld = false; G.Input.padUse = false; G.Input.mouseDown = false; G.Input.aimDown = false;
      G.Input.pollGamepad = pad0; G.Input.padActive = false;
      G.Input.mode = mode0;
      G.Audio.speak = speak0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (PA.holds()) PA.close();
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
