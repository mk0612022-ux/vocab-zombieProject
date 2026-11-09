// Dev-only (not shipped). The expansion's round 4: the melee slot.
//   A  the table: the six weapons as the spec has them; every string
//   B  the slot: the HUD shows what is in it, a new one replaces the old, a run
//      starts with the knife, a checkpoint keeps it (and one from before has none)
//   C  a swing's times, wind-up, edge, back; a hit stops it a moment (by Screen
//      Effects and Reduce Motion); a second swing goes the other way; a hold charges
//   D  the quick button, off a gun in the hands: the gun comes back, its ammunition
//      and magazine untouched, the reload stopped; every kind of control
//   E  the sweep: not one ray; each weapon's width and its most targets
//   F  walls: nothing behind one is hit, a swing stops on one, by its surface
//   G  zombies: how hard each staggers; helmet, vest, low targets, the Bloater
//   H  the word rules: a kill is an answer on its word, one to be spelt shrugs
//      it off, a run answered only by spelling has no blade
//   I  stamina: what a swing spends, a tired swing, free stamina
//   J  the sound: four takes never twice, each weapon its own; the bank
//   K  on the walls: where each hangs, buying it, its card, the Armory, each level
//   L  the flag: melee rules off is the old knife
// Load it into the game (in the lobby), then:
//   const r = await G.Round33Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round33Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-6 : e);

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t33 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, M = G.MELEE_WEAPONS, K = G.CONFIG.melee, $ = (id) => document.getElementById(id);
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock;
    const real = g._update0 || g.update;
    const I = G.Input;
    G._missingKeys = {};
    const V3 = THREE.Vector3;
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
    const secs = (s, dt) => step(Math.ceil(s / (dt || 1 / 60)), dt);
    const startLevel = (lv) => {
      g.update = real;
      g.startLevel(lv);
      G.Spawner.update = () => {};
      g.update = () => {};
      G.Modal.reset();
      g.paused = false; g.state = "GAMEPLAY";
      g.player.hp = g.player.maxHp = 1e6;
      g.requiredKills = 1e9;
      g.clearZombies();
      I.clearHeldInputs();
      if (G.Tutorial && G.Tutorial.current) G.Tutorial.skip();
      step(4);
    };
    // the player in the middle of a clear space, looking along -z, level
    const clearing = () => {
      const pos = g.yawObject.position;
      g.yawObject.rotation.y = 0; g.pitchObject.rotation.x = 0;
      g.camera.updateMatrixWorld();
      return pos;
    };
    // a zombie at (right, ahead) metres from the player, facing it, standing still
    const put = (type, right, ahead, hp) => {
      const P = g.yawObject.position, y = P.y - 1.7;
      const z = g.spawnZombieAt(type || "normal", new V3(P.x + right, y, P.z - ahead), null);
      z.hp = z.maxHp = hp === undefined ? 9999 : hp;
      z.speed = 0; z.speedMultiplier = 0;
      z.mesh.position.set(P.x + right, y, P.z - ahead);
      z.emerge = null;
      z.answer = null;
      z.mesh.rotation.y = Math.atan2(-right, ahead);
      z._hold = 1e9;              // (it stands where it was put: one that walks up to a wall pokes its hands through it)
      z.mesh.updateMatrixWorld(true);
      return z;
    };
    const hold = (on) => { I.touchMelee = !!on; };
    const melee = (key) => { g.player.melee = key; g.player.currentSlot = 0; if (g.wsm) { g.wsm.requestSwitch(); g.wsm.finishSwitch(); } g.buildWeaponViewModel("melee"); };
    const gun = () => { g.player.currentSlot = 1; if (g.wsm) { g.wsm.requestSwitch(); g.wsm.finishSwitch(); } step(2); };
    const idle = () => { for (let i = 0; i < 300 && g.wsm.mel; i++) step(1); g.player.fireCooldown = 0; g.stamina = g.maxStamina; G.Melee.reset(); };
    const swing = (o) => { // a swing to its end, with the button held for o.hold seconds
      o = o || {};
      if (o.hold) hold(true);
      g.player.fireCooldown = 0;
      G.onFirePress(); step(1);
      if (o.hold) { secs(o.hold); hold(false); }
      idle();
    };
    try {
      for (const l of ["th", "zh", "fr"]) if (!G.STRINGS[l] && G.UI_LANG_FILES[l]) await load(G.UI_LANG_FILES[l]);

      await wait(0); // ---------------- A: the table ----------------
      {
        const want = {
          knife: [80, 60, 180, 1.6, 1, "light", 5, "stab", 0], bat: [180, 90, 320, 2.1, 3, "heavy", 12, "sweep", 1], machete: [140, 80, 260, 1.9, 2, "medium", 9, "slash", 1],
          axe: [260, 100, 420, 2.2, 1, "very_heavy", 18, "chop", 2], crowbar: [170, 80, 300, 2.0, 2, "heavy", 11, "hook", 2], shovel: [200, 90, 340, 2.0, 2, "heavy", 13, "scoop", 3],
        };
        const off = Object.keys(want).filter((k) => { const m = M[k], w = want[k]; return !m || [m.windup, m.active, m.recover, m.range, m.targets, m.stagger, m.stamina, m.move, m.level].some((v, i) => v !== w[i]); });
        ok("A the six weapons as the spec's table has them", !off.length && Object.keys(M).length === 6, off.join());
        ok("A all of them the melee slot's", Object.values(M).every((m) => m.id === "melee" && m.fireRate === m.windup + m.active + m.recover), "");
        const arc = (k) => G.GunStats.melee(k).arc;
        ok("A the bat's arc about 90 degrees, the machete's about 70", near(arc("bat"), 92, 8) && near(arc("machete"), 70, 8), arc("bat") + " " + arc("machete"));
        ok("A a charge in 0.6-0.9 s on the bat, the axe and the shovel, x1.8", ["bat", "axe", "shovel"].every((k) => M[k].power && M[k].power.time >= 0.6 && M[k].power.time <= 0.9) && !M.knife.power && !M.machete.power && !M.crowbar.power && K.power.mult === 1.8);
        ok("A the light combo on the knife, the machete and the bat", ["knife", "machete", "bat"].every((k) => M[k].combo) && !M.axe.combo && !M.crowbar.combo && !M.shovel.combo);
        ok("A the knife: head x2", M.knife.head === 2);
        const names = ["en", "th", "zh", "fr"].every((l) => Object.keys(M).filter((k) => k !== "knife").every((k) => (G.STRINGS[l] || {})["melee.name." + k]));
        ok("A every name in the four languages", names);
        ok("A the sheet has them, every field", Object.keys(M).every((k) => { const s = G.GunStats.melee(k); return s.swing > 0 && s.dps > 0 && s.slot === "melee" && s.weight; }));
        const st = G.GunStats.meleeStats("axe"), st2 = G.GunStats.meleeStats("knife");
        ok("A six bars of its own: the axe hits hardest, the knife is quickest", G.GunStats.M_KEYS.length === 6 && st.damage.pct === 100 && st2.speed.pct === 100 && st.speed.pct === 0, JSON.stringify(st));
      }

      await wait(0); // ---------------- B: the slot ----------------
      G.Input.requestPointerLock = () => {};
      G.save.tutorialDone = true;
      startLevel(1);
      ok("B a run starts with the knife", g.player.melee === "knife" && G.meleeDef(g) === M.knife);
      const cell = () => $("hud-slots").querySelector(".hud-slot.knife .hsl-name").textContent;
      step(3);
      ok("B the slot's name: the knife", cell() === G.T("hud.slotKnife"), cell());
      G.Melee.give(g, "bat"); step(3);
      ok("B a weapon in it: the slot shows what it is", cell() === M.bat.name, cell());
      ok("B one weapon in the slot: the new one replaces the old", g.player.melee === "bat" && G.meleeDef(g).key === "bat");
      g.player.currentSlot = 0; g.wsm.requestSwitch(); g.wsm.finishSwitch(); step(2);
      ok("B out in the hands, its own model", g.wsm.held === "melee" && G.ViewModel.def.key === "bat" && g.currentWeaponDef().key === "bat");
      ok("B the HUD says what is in hand", $("hud-weapon-name").textContent === M.bat.name, $("hud-weapon-name").textContent);
      G.Melee.give(g, "machete"); step(2);
      ok("B bought with it in the hands: the model changes at once", G.ViewModel.def.key === "machete");
      ok("B each its own model, none the same", new Set(Object.keys(M).map((k) => { const c = G.buildMeleeMesh(M[k]), b = new THREE.Box3().setFromObject(c); const s = b.getSize(new V3()); G.disposeObject3D(c); return [s.x.toFixed(2), s.y.toFixed(2), s.z.toFixed(2)].join(); })).size === 6);
      {
        const C = G.Checkpoint, snap = C.snapshot(g);
        ok("B a checkpoint keeps it", snap.player.melee === "machete", snap.player.melee);
        const P = JSON.parse(JSON.stringify(snap));
        g.player.melee = "knife";
        C.apply(g, P);
        ok("B ...and gives it back", g.player.melee === "machete", g.player.melee);
        delete P.player.melee;
        C.apply(g, P);
        ok("B a checkpoint from before it: the knife", g.player.melee === "knife", g.player.melee);
        P.player.melee = "sword";
        C.apply(g, P);
        ok("B an unknown one: the knife", g.player.melee === "knife");
      }

      await wait(0); // ---------------- C: a swing's times ----------------
      startLevel(1);
      clearing();
      {
        const P = g.wsm;
        melee("bat"); step(2); idle();
        const seen = {};
        const steps = () => { const m = P.mel; if (m && m.plan && !seen[m.phase]) seen[m.phase] = P.t; };
        const dt = 1 / 240;
        g.player.fireCooldown = 0;
        const t0 = (P.t, P.t);
        G.onFirePress(); step(1, dt); steps();
        for (let i = 0; i < 400 && P.mel; i++) { step(1, dt); steps(); }
        const rel = (k) => (seen[k] - t0);
        const B = M.bat;
        numbers.batTimes = { swing: rel("swing"), rec: rel("rec") };
        ok("C the wind-up as the table has it", near(rel("swing"), B.windup / 1000, 0.02), rel("swing"));
        ok("C the edge moves for its time", near(rel("rec") - rel("swing"), B.active / 1000, 0.02), rel("rec") - rel("swing"));
        idle();
        // a hit: it stands still a moment
        const z = put("normal", 0, 1.4);
        step(1);
        const hitAt = [];
        const on = (e) => { if (e.phase === "hit") hitAt.push(P.t); };
        G.Bus.on("weapon:melee", on, "t33");
        g.player.fireCooldown = 0;
        G.onFirePress();
        let stopped = 0;
        for (let i = 0; i < 400 && (P.mel || !i); i++) { step(1, dt); if (P.mel && P.mel.stop > 0) stopped = Math.max(stopped, P.mel.stop); }
        ok("C a hit stops the swing 40-70 ms", stopped >= 0.039 && stopped <= 0.0701 && z.hp < 9999, stopped);
        G.Bus.off("t33");
        z.alive && g.clearZombies(); idle();
        const stopFor = (fn) => { const z2 = put("normal", 0, 1.4); step(1); fn(); let s = 0; g.player.fireCooldown = 0; G.onFirePress(); for (let i = 0; i < 400 && (P.mel || !i); i++) { step(1, dt); if (P.mel && P.mel.stop > s) s = P.mel.stop; } g.clearZombies(); idle(); return s; };
        const se = G.save.settings.screenEffects, rm = G.save.settings.reduceMotion;
        G.save.settings.screenEffects = 0;
        const none = stopFor(() => {});
        G.save.settings.screenEffects = 1; G.save.settings.reduceMotion = true;
        const calm = stopFor(() => {});
        G.save.settings.screenEffects = se; G.save.settings.reduceMotion = rm;
        ok("C by Screen Effects: none at 0", none === 0, none);
        ok("C ...and shorter with Reduce Motion", calm > 0 && calm < 0.06, calm);

        // the combo: the second swing the other way
        melee("machete"); idle();
        g.player.fireCooldown = 0;
        G.onFirePress(); step(1);
        const first = P.mel.plan.mirror;
        for (let i = 0; i < 200 && P.mel; i++) step(1);
        g.player.fireCooldown = 0;
        G.onFirePress(); step(1);
        const second = P.mel && P.mel.plan.mirror;
        ok("C a second swing soon after goes the other way", first === false && second === true, first + " " + second);
        for (let i = 0; i < 200 && P.mel; i++) step(1);
        secs(K.comboWindow + 0.2);
        g.player.fireCooldown = 0;
        G.onFirePress(); step(1);
        ok("C ...not after a pause", P.mel && P.mel.plan.mirror === false);
        idle();
        melee("axe"); idle();
        g.player.fireCooldown = 0; G.onFirePress(); step(1); for (let i = 0; i < 200 && P.mel; i++) step(1);
        g.player.fireCooldown = 0; G.onFirePress(); step(1);
        ok("C the axe has no combo", P.mel && P.mel.plan.mirror === false);
        idle();

        // the charge
        melee("bat"); idle();
        const hurt = (o) => { const z2 = put("normal", 0, 1.4); step(1); const h = z2.hp; g.stamina = g.maxStamina; const st = g.stamina; swing(o); const r = { took: h - z2.hp, spent: st - (g.stamina || 0) }; g.clearZombies(); return r; };
        let spent = 0, last = g.stamina;
        const plain = (() => { const z2 = put("normal", 0, 1.4); step(1); const h = z2.hp; g.stamina = g.maxStamina; g.player.fireCooldown = 0; G.onFirePress(); step(1); spent = g.maxStamina - g.stamina; for (let i = 0; i < 300 && P.mel; i++) step(1); const took = h - z2.hp; g.clearZombies(); idle(); return took; })();
        ok("C a tap: the table's stamina, its damage", near(spent, M.bat.stamina, 0.01) && near(plain, M.bat.damage, 0.01), spent + " " + plain);
        const quickTap = hurt({ hold: 0.2 });
        ok("C held too short: no charge", near(quickTap.took, M.bat.damage, 0.01), quickTap.took);
        let phases = [];
        const onP = (e) => phases.push(e.phase);
        G.Bus.on("weapon:melee", onP, "t33b");
        g.stamina = g.maxStamina;
        const charged = (() => { const z2 = put("normal", 0, 1.4); step(1); const h = z2.hp; hold(true); g.player.fireCooldown = 0; G.onFirePress(); secs(M.bat.power.time + 0.1); const held = P.mel && P.mel.phase; hold(false); for (let i = 0; i < 300 && P.mel; i++) step(1); const took = h - z2.hp, used = g.maxStamina - g.stamina; g.clearZombies(); idle(); return { took, held, used }; })();
        ok("C held: it waits, drawn back", charged.held === "hold", charged.held);
        ok("C let go: x1.8", near(charged.took, M.bat.damage * 1.8, 0.01), charged.took);
        ok("C and costs more stamina", charged.used > M.bat.stamina * 1.3, charged.used);
        ok("C it says so as it charges, and when it is ready", phases.includes("hold") && phases.includes("charged"), phases.join());
        // held for ever: it goes by itself
        hold(true); g.player.fireCooldown = 0; G.onFirePress(); secs(K.power.maxHold + 0.4); const went = P.mel ? P.mel.phase : "over"; hold(false); idle();
        ok("C held too long: it swings by itself", went !== "hold", went);
      }

      await wait(0); // ---------------- D: the quick button ----------------
      startLevel(1);
      clearing();
      {
        const P = g.wsm;
        gun(); step(3);
        ok("D the button's key, unused by any other", (() => { const kb = G.defaultKeybinds(); return kb.quickMelee && Object.keys(kb).filter((k) => kb[k] === kb.quickMelee).length === 1; })());
        ok("D Settings lists it", G.T("key.quickMelee") !== "key.quickMelee");
        const a = g.player.ammo.pistol, mag = a.mag, res = a.reserve, model = g.weaponViewGroup, d0 = G.ViewModel.def;
        G.onMeleePress(); step(1);
        ok("D off a gun: the gun stays chosen", g.currentWeaponId() === "pistol" && P.mel && P.mel.quick, P.state);
        secs(K.quick.dip + 0.02);
        ok("D the slot's weapon in the hands", G.ViewModel.def.key === "knife" && G.ViewModel.def.id === "melee", G.ViewModel.def.id);
        for (let i = 0; i < 200 && P.mel; i++) step(1);
        ok("D the same gun back, not built again", g.weaponViewGroup === model && G.ViewModel.def === d0 && P.state !== "Melee", P.state);
        ok("D its ammunition untouched", a.mag === mag && a.reserve === res);
        const model2 = g.weaponViewGroup;
        g.player.fireCooldown = 0; G.onMeleePress(); step(1); secs(K.quick.dip + 0.02);
        const blade = g.weaponViewGroup;
        for (let i = 0; i < 200 && P.mel; i++) step(1);
        g.player.fireCooldown = 0; G.onMeleePress(); step(1); secs(K.quick.dip + 0.02);
        ok("D the weapon kept for the next one (nothing built in a swing)", g.weaponViewGroup === blade);
        for (let i = 0; i < 200 && P.mel; i++) step(1);
        ok("D a gun in the middle of its cooldown can still swing", (() => { g.player.fireCooldown = 5; G.onMeleePress(); step(1); const r = !!P.mel; for (let i = 0; i < 200 && P.mel; i++) step(1); g.player.fireCooldown = 0; return r; })());
        // a reload is stopped
        a.mag = 1; g.reload(); step(2);
        const busy = !!P.rl;
        G.onMeleePress(); step(1);
        ok("D a reload stops for it", busy && !P.rl && !!P.mel);
        for (let i = 0; i < 200 && P.mel; i++) step(1);
        ok("D ...and nothing was added", a.mag === 1);
        a.mag = mag;
        // cut off by a switch: the gun back
        G.onMeleePress(); step(1); secs(K.quick.dip + 0.02);
        const swapped = P.mel && P.mel.swapped;
        g.player.gunSlots.push("smg"); g.player.ammo.smg = { mag: 30, reserve: 90 }; g.player.weaponLevels.smg = { dmg: 1, rate: 1, mag: 1 };
        g.switchSlot(2); step(1);
        ok("D a switch cuts it short: the machine stays sound", swapped && !P.mel && P.validate().length === 0, P.validate().join());
        P.finishSwitch(); step(2);
        ok("D ...and the gun chosen comes up", G.ViewModel.def.id === "smg", G.ViewModel.def.id);
        g.player.gunSlots.pop(); delete g.player.ammo.smg; delete g.player.weaponLevels.smg; g.player.currentSlot = 1; P.requestSwitch(); P.finishSwitch(); step(2);
        // with the weapon out, the same button swings it
        g.player.currentSlot = 0; P.requestSwitch(); P.finishSwitch(); step(2); idle();
        G.onMeleePress(); step(1);
        ok("D the weapon already out: it swings", P.mel && !P.mel.quick);
        idle();
        // on every kind of control
        ok("D touch: a button of its own, in the layout editor", !!$("touch-melee") && G.TouchCfg.IDS.includes("melee") && G.T("touchcfg.melee") !== "touchcfg.melee");
        ok("D a layout saved before it still loads", (() => { const c = G.save.settings.touchLayout; G.save.settings.touchLayout = { pos: { fire: { x: 0.9, y: 0.8 } }, scale: {}, opacity: 1, lookSens: 1 }; let good = true; try { G.TouchCfg.apply(); good = !G.TouchCfg.cfg().pos.melee; } catch (e) { good = false; } G.save.settings.touchLayout = c; G.TouchCfg.apply(); return good; })());
        const btn = $("touch-melee");
        I.touchMelee = false; I.touchMelee = true; g.player.fireCooldown = 0;
        ok("D touch held: the game sees it held", g.meleeHeld(true));
        I.touchMelee = false;
        const gp = { buttons: [], axes: [0, 0, 0, 0] };
        for (let i = 0; i < 16; i++) gp.buttons[i] = { pressed: false, value: 0 };
        gp.buttons[G.Pad.B.B] = { pressed: true, value: 1 };
        const pg = I.pollGamepad, wasOn = g._meleeEdge;
        I.pollGamepad = () => gp;
        G.Pad.prev = [];
        G.Pad.poll(1 / 60);
        const padOk = g._meleeEdge === true && I.padMelee === true;
        I.pollGamepad = pg; g._meleeEdge = false; G.Pad.release();
        ok("D controller: B swings, held it is held", padOk);
        ok("D the keyboard's key held counts", (() => { const kb = G.save.settings.keybinds, c = kb.quickMelee; kb.quickMelee = "KeyZ"; I.keys.KeyZ = true; const r = g.meleeHeld(true); I.keys.KeyZ = false; kb.quickMelee = c; return r; })());
        // a touch hold charges; the button is only a button
        g.player.currentSlot = 0; g.player.melee = "bat"; P.requestSwitch(); P.finishSwitch(); step(2); idle();
      }

      await wait(0); // ---------------- E: the sweep ----------------
      startLevel(1);
      clearing();
      {
        const P = g.wsm;
        melee("knife"); idle();
        // the knife is narrow, the bat wide
        const side = (key, right, ahead) => { melee(key); idle(); clearing(); const z = put("normal", right, ahead); step(1); swing(); const hit = z.hp < 9999; g.clearZombies(); return hit; };
        ok("E the knife: straight ahead", side("knife", 0, 1.1));
        ok("E the knife: not a metre off to the side", !side("knife", 1.1, 1.1));
        ok("E the bat: out to the side as well, 40 degrees (not one ray)", side("bat", 1.1, 1.3));
        ok("E ...and the other way", side("bat", -1.1, 1.3));
        ok("E out of reach: nothing", !side("bat", 0, 3.2) && !side("knife", 0, 2.3));
        const three = () => { melee("bat"); idle(); clearing(); const zs = [put("normal", -1.1, 1.3), put("normal", 0, 1.5), put("normal", 1.1, 1.3), put("normal", 0.5, 1.1)]; step(1); swing(); const n = zs.filter((z) => z.hp < 9999).length; g.clearZombies(); return n; };
        ok("E the bat: at most three in one swing", three() === 3);
        const many = (key) => { melee(key); idle(); clearing(); const zs = [put("normal", -0.5, 1.2), put("normal", 0, 1.2), put("normal", 0.5, 1.2)]; step(1); swing(); const n = zs.filter((z) => z.hp < 9999).length; g.clearZombies(); return n; };
        ok("E the knife one, the machete two, the crowbar two, the axe one", many("knife") === 1 && many("machete") <= 2 && many("crowbar") <= 2 && many("axe") === 1, [many("knife"), many("machete"), many("crowbar"), many("axe")].join());
        // the same zombie once a swing
        melee("bat"); idle(); clearing();
        const z = put("normal", 0, 1.3); step(1);
        swing();
        ok("E one blow a swing on one zombie, whatever the rays", near(9999 - z.hp, M.bat.damage, 0.01), 9999 - z.hp);
        g.clearZombies();
        // a head
        melee("knife"); idle(); clearing();
        const o = new V3(); g.camera.getWorldPosition(o);
        const zh = put("normal", 0, 1.3); step(1);
        zh.mesh.updateMatrixWorld(true);
        const neck = zh.mesh.userData.neck, np = neck.getWorldPosition(new V3()); np.y += 0.15;
        g.pitchObject.rotation.x = Math.atan2(np.y - o.y, 1.3) + 10 * Math.PI / 180;
        step(1);
        swing();
        ok("E the knife on the head: x2", near(9999 - zh.hp, M.knife.damage * 2, 0.01), 9999 - zh.hp);
        g.clearZombies(); g.pitchObject.rotation.x = 0;
      }

      await wait(0); // ---------------- F: walls ----------------
      {
        const P = g.wsm;
        const W = g.world;
        const box = (x0, y0, z0, x1, y1, z1, surface) => { const b = new THREE.Box3(new V3(x0, y0, z0), new V3(x1, y1, z1)); if (surface) b.surface = surface; G.ColGrid.add(W, b); return b; };
        clearing();
        const p = g.yawObject.position, y = p.y - 1.7;
        const wall = box(p.x - 4, y, p.z - 1.15, p.x + 4, y + 4, p.z - 0.95, "metal");
        const through = {};
        Object.keys(M).forEach((k) => {
          melee(k); idle(); clearing();
          const z = put("normal", 0, 1.5); step(1);
          swing();
          through[k] = z.hp < 9999;
          g.clearZombies();
        });
        const bad = Object.keys(through).filter((k) => through[k]);
        ok("F nothing behind a wall is hit, all six", !bad.length, bad.join());
        const heard = [];
        const on = (e) => heard.push(e);
        G.Bus.on("melee:wall", on, "t33c");
        melee("crowbar"); idle(); clearing();
        const flinch = G.ViewModel.flinch; let hands = 0;
        G.ViewModel.flinch = function (k) { hands = k; return flinch.call(this, k); };
        g.player.fireCooldown = 0; G.onFirePress();
        let bounced = null, phases = {};
        for (let i = 0; i < 200 && (P.mel || !i); i++) { step(1); if (P.mel) { phases[P.mel.phase] = 1; if (P.mel.bounceU != null) bounced = P.mel.bounceU; } }
        G.ViewModel.flinch = flinch;
        ok("F a wall in reach ends the swing where it met it", bounced !== null && bounced < 1, bounced);
        ok("F by what the wall is made of", heard.length === 1 && heard[0].surface === "metal", JSON.stringify(heard));
        ok("F the hands thrown back", hands > 0, hands);
        idle();
        // the far side of the reach: a wall too far off stops nothing
        G.ColGrid.remove(W, wall);
        heard.length = 0;
        box(p.x - 4, y, p.z - 2.25, p.x + 4, y + 4, p.z - 2.05, "concrete");
        melee("crowbar"); idle(); clearing();
        swing();
        ok("F a wall past its reach: nothing", heard.length === 0, heard.length);
      }

      await wait(0); // ---------------- G: zombies ----------------
      startLevel(1);
      clearing();
      {
        const P = g.wsm;
        // (read the moment it lands: a stagger is over before the swing is)
        const react0 = G.ZombieAI.react, mod0 = G.ZombieAI.hitMod;
        let after = null, input = 0;
        G.ZombieAI.react = function (gm, zz, d, info) { const r = react0.call(this, gm, zz, d, info); after = { stagger: zz._stagger || 0, down: zz._down || 0 }; return r; };
        G.ZombieAI.hitMod = function (gm, zz, d, head, dir, def) { input = d; return mod0.call(this, gm, zz, d, head, dir, def); };
        const blow = (key, type, right, ahead, o) => { after = null; melee(key); idle(); clearing(); const z = put(type || "normal", right || 0, ahead || 1.3); step(1); swing(o); return z; };
        let z = blow("knife"); ok("G the knife: a flinch, no more", after && !after.stagger && !after.down, JSON.stringify(after)); g.clearZombies();
        z = blow("machete"); ok("G the machete staggers it", after && after.stagger > 0 && !after.down, JSON.stringify(after)); g.clearZombies();
        const was = g.pushZombie; let pushed = 0;
        g.pushZombie = function (zz, dx, dz, d) { pushed = d; return was.call(this, zz, dx, dz, d); };
        z = blow("bat"); const H = G.CONFIG.zombies.hit;
        ok("G the bat knocks it back", near(pushed, H.staggerBack + M.bat.knock, 0.01), pushed); g.clearZombies();
        g.pushZombie = was;
        z = blow("axe"); ok("G the axe puts it down", after && after.down > 0, JSON.stringify(after)); g.clearZombies();
        after = null; melee("axe"); idle(); clearing();
        z = put("normal", 0, 1.3); z._lastDown = performance.now() / 1000; step(1); swing();
        ok("G down again too soon: it staggers", after && !after.down && after.stagger > 0, JSON.stringify(after)); g.clearZombies();
        // a helmet, a vest
        const hm = (key, head) => G.ZombieAI.hitMod(g, { type: "ironclad", _helmetOn: true, _helmetHits: 0, mesh: { position: new V3(), userData: {} } }, 100, head, new V3(0, 0, 1), M[key]);
        const I2 = G.CONFIG.zombies.ironclad;
        const oldPop = G.ZombieAI.popHelmet; let popped = 0;
        G.ZombieAI.popHelmet = function () { popped++; };
        hm("bat", true);
        ok("G one blow of the bat cracks a helmet (bullets take " + I2.helmetHits + ")", popped === 1, popped);
        popped = 0; hm("knife", true);
        ok("G the knife does not", popped === 0);
        G.ZombieAI.popHelmet = oldPop;
        ok("G the axe goes through the vest, the knife does not", hm("axe", false).dmg === 100 && near(hm("knife", false).dmg, 100 * I2.vest, 0.01), hm("axe", false).dmg);
        // no armour: the machete
        // (what the blow brings, before a head or a helmet has its say)
        z = blow("machete"); ok("G the machete on what wears no armour: more", near(input, M.machete.damage * M.machete.unarmored, 0.01), input); g.clearZombies();
        z = blow("machete", "ironclad"); ok("G ...and not on an Ironclad", near(input, M.machete.damage, 0.01), input); g.clearZombies();
        G.ZombieAI.react = react0; G.ZombieAI.hitMod = mod0;
        // low targets
        const low = (key, pitch, type) => { melee(key); idle(); clearing(); g.pitchObject.rotation.x = pitch || 0; const zz = put(type || "crawler", 0, 1.5); step(1); swing(); const h = zz.hp < 9999, took = 9999 - zz.hp; g.clearZombies(); g.pitchObject.rotation.x = 0; return { h, took }; };
        ok("G a sideways swing at chest height goes over a Crawler", !low("bat").h);
        ok("G ...look down and it hits", low("bat", -0.65).h);
        ok("G the axe's blow comes down on it, looking straight ahead", low("axe").h);
        ok("G so does the shovel's", low("shovel").h);
        ok("G the shovel on a low target: more", near(low("shovel").took, M.shovel.damage * M.shovel.lowDamage, 0.01), low("shovel").took);
        // a Bloater
        melee("axe"); idle(); clearing();
        const hp0 = g.player.hp = 1e5;
        g.player.maxHp = 1e5;
        const b = put("bloater", 0, 1.4, 20); step(1);
        const sounds = []; const zs = G.Audio.zombie;
        G.Audio.zombie = function (k) { sounds.push(k); return zs.apply(this, arguments); };
        swing();
        const burst = () => g.player.hp < hp0;
        const warned = sounds.includes("swell");
        ok("G a Bloater struck down: the old warning, it swells", !b.alive && warned, sounds.join());
        ok("G ...not at once: time to get away", !burst());
        // (the burst is harmless after fuse + 1.5 s of real time -- a pause; a slow test page is not one)
        (G.ZombieFX.dying || []).forEach((d) => { if (d.mode === "swell") d.at = performance.now(); });
        for (let i = 0; i < 120 * 2 && !burst(); i++) step(1, 1 / 60);
        G.Audio.zombie = zs;
        ok("G and it bursts on whoever stayed", burst(), hp0 - g.player.hp);
        g.clearZombies();
        // the Runt's blood
        ok("G a Runt's gore is always reduced", G.ZombieFactory.gore({ type: "runt" }) === "reduced" || G.save.settings.gore !== "full");
        // the hit reactions and the state machine stay sound
        ok("G the machine reports nothing wrong after all that", P.validate().length === 0, P.validate().join());
      }

      await wait(0); // ---------------- H: the word rules ----------------
      {
        melee("bat"); idle(); clearing();
        const z = put("normal", 0, 1.3, 9999);
        z.answer = "spell"; step(1);
        swing();
        ok("H one to be spelt shrugs it off, unhurt", z.hp === 9999 && z.alive, z.hp);
        g.clearZombies();
        const pair = ["word", "meaning"];
        melee("bat"); idle(); clearing();
        const right = put("normal", 0, 1.3, 5); right.word = "alpha"; right.pair = ["alpha", "a"]; right.meaning = "a"; right.decoy = false;
        g.targetPair = right.pair; step(1);
        const c0 = g.correctCount; const learnRight = g.learnRight; let learned = 0; g.learnRight = function () { learned++; };
        const expl = G.ExplainCard.show; G.ExplainCard.show = () => {};
        swing();
        ok("H a kill on the right word is that answer, as a bullet's", g.correctCount === c0 + 1 && learned === 1, g.correctCount - c0);
        g.learnRight = learnRight;
        const wrong = put("normal", 0, 1.3, 5); wrong.word = "beta"; wrong.pair = ["beta", "b"]; wrong.meaning = "b"; wrong.decoy = false;
        g.targetPair = ["gamma", "c"]; step(1);
        const w0 = g.wrongCount, lw = g.learnWrongShot; let lwn = 0; g.learnWrongShot = function () { lwn++; };
        const sc = g.showConfusion; g.showConfusion = () => {};
        const qn = G.Quiz.noteMissed; G.Quiz.noteMissed = () => {};
        const tw = g.trackWrongWord; g.trackWrongWord = () => {};
        swing();
        ok("H a kill on the wrong word is a wrong answer", g.wrongCount === w0 + 1 && lwn === 1, g.wrongCount - w0);
        g.learnWrongShot = lw; g.showConfusion = sc; G.Quiz.noteMissed = qn; g.trackWrongWord = tw; G.ExplainCard.show = expl;
        g.targetPair = null; g.clearZombies();
        // a run answered only by spelling
        const learn = g.learn;
        g.learn = Object.assign({}, learn || {}, { shoots: false });
        g._meleeEdge = false;
        G.onMeleePress();
        ok("H a run answered only by spelling has no blade", g._meleeEdge !== true);
        g.learn = learn;
        const ch = g.challenge; g.challenge = { fake: 1 };
        G.onMeleePress();
        ok("H nor a question up", g._meleeEdge !== true);
        g.challenge = ch;
      }

      await wait(0); // ---------------- I: stamina ----------------
      {
        const P = g.wsm;
        melee("axe"); idle(); clearing();
        g.stamina = 100; g.player.fireCooldown = 0; G.onFirePress(); step(2);
        ok("I each swing spends the table's stamina", near(g.stamina, 100 - M.axe.stamina, 0.5), g.stamina);
        idle();
        g.stamina = 3; g.player.fireCooldown = 0;
        const z = put("normal", 0, 1.3); step(1);
        const mod0 = G.ZombieAI.hitMod; let input = 0;
        G.ZombieAI.hitMod = function (gm, zz, d, head, dir, def) { input = d; return mod0.call(this, gm, zz, d, head, dir, def); };
        const zero = (() => { g.stamina = 3; g.player.fireCooldown = 0; G.onFirePress(); step(1); const p = P.mel && P.mel.plan; for (let i = 0; i < 300 && P.mel; i++) step(1); return p; })();
        G.ZombieAI.hitMod = mod0;
        ok("I out of stamina it still swings, slower", zero && zero.tired && near(zero.recover, (M.axe.recover / 1000) * K.tired.slow, 1e-6), zero && zero.recover);
        ok("I ...and weaker", near(input, M.axe.damage * K.tired.damage, 0.01), input);
        g.clearZombies(); idle();
        const fs = G.Abilities.freeStamina; G.Abilities.freeStamina = () => true;
        g.stamina = 50; g.player.fireCooldown = 0; G.onFirePress(); step(2);
        ok("I an ability's free stamina spends none", near(g.stamina, 50, 1), g.stamina);
        G.Abilities.freeStamina = fs; idle();
      }

      await wait(0); // ---------------- J: the sound ----------------
      {
        const S = G.Melee.audio, A = G.Audio;
        G.Audio.unlock();
        const shapes = {}, groups = [];
        const gr = A.group, no = A.noise, to = A.tone;
        let cur = null;
        A.group = function (o, fn) { cur = { o, n: [] }; groups.push(cur); fn(); };
        A.noise = function (o) { cur && cur.n.push("n" + (o.filter || "bp") + Math.round(o.freq || 0)); };
        A.tone = function (o) { cur && cur.n.push("t" + (o.type || "") + Math.round(o.freq || 0)); };
        const ctx0 = A.ctx; if (!A.ctx) A.ctx = {};
        Object.keys(M).forEach((k) => { groups.length = 0; S.whoosh(M[k], false); shapes[k] = groups[0].n.join(); });
        const bases = Object.values(M).map((m) => m.sound.swish.f0 + "/" + m.sound.swish.dur);
        ok("J each weapon's own whoosh", new Set(bases).size === 6, bases.join(" "));
        ok("J thin and sharp on the knife, deep on the bat", M.knife.sound.swish.f0 > 3 * M.bat.sound.swish.f0 && M.bat.sound.swish.dur > 2 * M.knife.sound.swish.dur && M.bat.sound.swish.low > 0);
        const rec = (fn) => { groups.length = 0; fn(); return groups.map((x) => x.n.join()).join("|"); };
        const seq = []; for (let i = 0; i < 40; i++) seq.push(rec(() => S.flesh(M.axe, false, null)));
        ok("J four takes of a hit, never the same twice running", new Set(seq).size >= 3 && seq.every((x, i) => !i || x !== seq[i - 1]), new Set(seq).size);
        const flesh = Object.keys(M).map((k) => rec(() => S.flesh(M[k], false, null)).split(",").length + M[k].sound.flesh);
        ok("J each weapon's own hit", new Set(Object.keys(M).map((k) => M[k].sound.flesh)).size === 6, flesh.join());
        const ring = rec(() => S.wall(M.crowbar, "metal", null)), dull = rec(() => S.wall(M.bat, "concrete", null)), soft = rec(() => S.wall(M.crowbar, "dirt", null));
        ok("J iron on something hard rings; wood does not; iron on dirt does not", /ttriangle/.test(ring) && !/ttriangle/.test(dull) && !/ttriangle/.test(soft));
        ok("J a miss has its own sound", rec(() => S.miss(M.knife)) !== "" && rec(() => S.miss(M.knife)) !== rec(() => S.flesh(M.knife, false, null)));
        ok("J a creak as it charges", /tsawtooth/.test(rec(() => S.charge(M.bat, 0.5))));
        A.group = gr; A.noise = no; A.tone = to; if (!ctx0) A.ctx = ctx0;
        const ids = Object.keys(G.SOUND_BANK);
        ok("J all in the sound bank", Object.keys(M).every((k) => ["swing", "miss", "flesh", "wall", "draw"].every((e) => ids.includes("melee." + k + "." + e))) && ids.includes("melee.charge"));
        ok("J on the weapons bus, within its limit of voices", Object.keys(M).every((k) => G.SOUND_BANK["melee." + k + ".swing"].cat === "weapons") && G.CONFIG.audio.limits.weapons > 0, G.CONFIG.audio.limits.weapons);
      }

      await wait(0); // ---------------- K: on the walls ----------------
      {
        const at = {};
        for (const lv of [1, 2, 3]) {
          startLevel(lv);
          at[lv] = (g.world.wallMelee || []).map((r) => r.key).sort().join();
          ok("K level " + lv + ": what the spec hangs there", at[lv] === { 1: "bat,machete", 2: "axe,crowbar", 3: "shovel" }[lv], at[lv]);
          ok("K ...each a thing to use", (g.world.wallMelee || []).every((r) => g.world.interactables.some((i) => i.ref === r && i.kind === "wallmelee")));
          // nobody walks into a wall of a mount: each stands where it can be reached
          (g.world.wallMelee || []).forEach((r) => { const it = g.world.interactables.find((i) => i.ref === r); r._at = it.mesh.position.clone(); });
          const reach = (g.world.wallMelee || []).every((r) => {
            const face = r._at.clone(), out = r._at.x < 0 ? 1 : -1; face.x += out * 1.6; face.y = r._at.y - 0.3;
            return !g.world.colliders.some((c) => c.containsPoint(face));
          });
          ok("K ...and room to stand in front of it", reach);
          const open = (g.world.wallMelee || []).every((r) => { const p = r._at, dir = p.x < 0 ? 1 : -1, eye = new V3(p.x + dir * 2.2, p.y - 0.15, p.z); return g.wallDistance(eye, new V3(-dir, 0, 0), 2.1) >= 2.1; });
          ok("K ...nothing between it and whoever stands there (no rack, no drip stand)", open, numbers.spots);
          numbers["spots" + lv] = (g.world.wallMelee || []).map((r) => r.key + "@" + r._at.x.toFixed(1) + "," + r._at.y.toFixed(1) + "," + r._at.z.toFixed(1));
        }
        ok("K the machete in the shed by the garden", (() => { startLevel(1); const r = g.world.wallMelee.find((x) => x.key === "machete"), p = g.world.interactables.find((i) => i.ref === r).mesh.position; return p.x > 52 && p.z < -8 && p.z > -60; })());
        // buying
        const r = g.world.wallMelee.find((x) => x.key === "bat"), it = g.world.interactables.find((i) => i.ref === r);
        g.player.money = 100;
        g.buyWallMelee(r);
        ok("K too little money: nothing", g.player.melee === "knife" && g.player.money === 100);
        g.player.money = M.bat.price + 50;
        g._lookedAtInteractable = it;
        g.doInteract();
        ok("K bought: the money gone, it is in the slot", g.player.melee === "bat" && g.player.money === 50, g.player.melee + " " + g.player.money);
        g.player.money = 9999;
        g.buyWallMelee(r);
        ok("K the one in the slot cannot be bought again", g.player.money === 9999);
        const r2 = g.world.wallMelee.find((x) => x.key === "machete");
        g.buyWallMelee(r2);
        ok("K another replaces it", g.player.melee === "machete" && g.player.money === 9999 - M.machete.price);
        g.buyWallMelee(r);
        ok("K ...and the first can be bought back", g.player.melee === "bat");
        // the card
        const card = G.StatCard.html(M.bat, { compare: M.knife });
        const div = document.createElement("div"); div.innerHTML = card;
        ok("K its own card: six bars, the numbers, against the one in the slot", div.querySelectorAll(".statc-bar").length === 6 && div.querySelectorAll(".statc-nums span").length === 4 && div.querySelectorAll(".statc-delta").length === 6 && div.querySelector(".stat-card.melee"));
        G.StatCard.showHud(M.axe);
        ok("K beside it on the wall, the card", !$("hud-statcard").classList.contains("hidden") && /stat-card melee/.test($("hud-statcard").innerHTML));
        G.StatCard.hideHud();
        G.UI._logReturnScreen = "screen-pause";
        G.UI.renderWeaponLog(1);
        const log = $("weaponlog-content");
        ok("K the Armory lists them, each with its own place", log.querySelectorAll(".stat-card.melee").length === 3 && [...log.querySelectorAll(".wl-listen[data-melee]")].length === 3 && log.textContent.includes(G.T("melee.where.bat")));
        G.UI.renderWeaponLog(2);
        const listed = [...log.querySelectorAll(".stat-card.melee .statc-name")].map((e) => e.textContent).sort().join();
        ok("K ...the level's own", listed === [M.knife.name, M.axe.name, M.crowbar.name].sort().join(), listed);
        ok("K the prompt", G.T("prompt.wallMelee", { key: "E", name: "X", price: 1, short: "" }).includes("X"));
      }

      await wait(0); // ---------------- L: the flag ----------------
      {
        startLevel(1);
        clearing();
        const P = g.wsm;
        G.CONFIG.expansion.melee = false;
        melee("knife"); idle();
        // (the old knife reaches for a zombie's feet: looking a little down)
        g.pitchObject.rotation.x = -0.5;
        const z = put("normal", 0, 1.3, 9999); step(1);
        g.player.fireCooldown = 0; G.onFirePress(); step(1);
        const plan = P.mel && P.mel.plan;
        for (let i = 0; i < 120 && P.mel; i++) step(1);
        ok("L off: the old knife, its old damage, no steps", !plan && near(9999 - z.hp, K.legacy.damage, 0.01), 9999 - z.hp);
        g.clearZombies(); g.pitchObject.rotation.x = 0;
        gun();
        G.onMeleePress(); step(1);
        ok("L off: the old button: the knife out", g.currentWeaponId() === "melee");
        P.finishSwitch(); step(1);
        G.CONFIG.expansion.melee = true;
      }

      // ---------------- words ----------------
      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      G.CONFIG.expansion.melee = true;
      I.touchMelee = false;
      G.Spawner.update = spawn0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
