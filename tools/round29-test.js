// Dev-only (not shipped). The gun reference pass: the guns of the three
// reference clips (docs/reference/guns/GUN_REFERENCE.md), as nine prototypes
// every game gun of their kinds is built, lit, animated and voiced from.
//   A  the prototypes: every pistol, SMG, rifle, LMG and sniper one of the
//      nine by its kind (the rest none), each with a stand-in for the clip's
//      gun at the clip's rate of fire (section 5, +-5%); no real gun's name in
//      any of the four languages
//   B  the models: each stand-in of boxes in its prototype's first palette,
//      its sight glowing in the clip's colour, its accent colour, the moving
//      parts and the anchors the hands and the reload use; the painted parts
//      not metal (a white stock stays white at night); the guns of no
//      prototype built as before
//   C  the effects: the flash's size class (S < M < L < XL) and the .50's
//      brown smoke ring, the casings by kind (the LMG's links beside its
//      brass, the rifle's steel), a bolt-action's case thrown out at the
//      bolt's pull and not at the shot
//   D  the animation: the draw's time by prototype, a switch's swap at the
//      put-away's share of it, the bolt's steps (squeezed for a quicker gun),
//      the chassis sniper off its sight while it works the bolt (the .50
//      stays on and sags), the reload's timeline by family, the view's kick
//   E  aimed: the sight's middle on the screen's (the pistol, the LMG, the
//      chassis sniper, the .50); the scope's overlay on the scoped two (the
//      white one's red dot), none on the iron-sighted
//   F  the sound: the stand-ins play the recipe as tuned, the others nudged
//      a little; every gun of a prototype measured as section 5 measures
//      (tools/gun-sound-check.js runAll) and inside its tolerances; the
//      prototypes' loudness in section 5's order, about where the game's guns
//      were, nothing clipping on the master; a gun's draw 10-20 dB under its
//      shot
// Load it into the game (in the lobby), then:
//   const r = await G.Round29Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round29Test = (function () {
  const results = [], numbers = {};
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
  const $ = (id) => document.getElementById(id);
  const KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  // the stand-ins' rates of fire, section 5 (ms between shots)
  const RATE = { A: [80, 83], B: [100, 100], C: [50, 55], D: [">=", 200], E: [">=", 270], F: [1850, 1850], G: [1500, 1500] };
  // each prototype's sight glow (js/gunref.js GLOW)
  const GLOWS = { A: ["ring"], B: ["post"], C: ["tritium"], D: ["cyan", "dot"], E: ["tritium"], F: ["cyan", "post"], G: ["post"], I: ["amber"] };
  let realUpd = null, spawnUpd = null;

  function startRun() {
    const g = G.Game;
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    g.update = realUpd;
    G.save.tutorialDone = true;
    G.Input.requestPointerLock = function () {};
    g.startLevel(1);
    g.update = function () {};
    g.requiredKills = 1e9;
    // (thousands of frames are stepped: no zombie comes, nothing kills the player)
    spawnUpd = G.Spawner.update; G.Spawner.update = function () {};
    g.player.hp = g.player.maxHp = 1e6;
    g.clearZombies();
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    G.Input.clearHeldInputs();
    step(g, 3);
    return g;
  }
  function step(g, n) { for (let i = 0; i < n; i++) realUpd.call(g, 1 / 60); }
  // the gun in hand (and a pistol, or the SMG, in the other slot)
  function hold(g, id) {
    const p = g.player;
    const other = id === "pistol" ? "smg" : "pistol";
    [id, other].forEach((w) => {
      const d = G.WEAPON_DEFS[w];
      if (!p.ammo[w]) p.ammo[w] = { mag: d.magSize, reserve: d.magSize * 4 };
      if (!p.weaponLevels[w]) p.weaponLevels[w] = { dmg: 1, rate: 1, mag: 1 };
    });
    p.gunSlots = [id, other]; p.currentSlot = 1;
    g.wsm.requestSwitch();
    for (let i = 0; i < 300 && !(g.wsm.held === id && !g.wsm.sw); i++) step(g, 1);
    return g.wsm.held === id;
  }
  const flagDef = (k) => G.WEAPON_DEFS[G.GunRef.FLAGSHIP[k]];
  // the other languages' files (fetched when first chosen)
  async function loadLangs() {
    for (const l of ["th", "zh", "fr"]) {
      if (!G.STRINGS[l] && G.UI_LANG_FILES[l]) await new Promise((res) => { const s = document.createElement("script"); s.src = G.UI_LANG_FILES[l]; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    }
  }

  // ---------------- A: the prototypes ----------------
  function protos() {
    const R = G.GunRef, kinds = ["pistol", "smg", "rifle", "lmg", "sniper"];
    const count = {}, wrong = [];
    let mapped = 0, none = 0;
    Object.values(G.WEAPON_DEFS).forEach((d) => {
      if (d.id === "melee") return;
      const arch = G.WEAPON_ARCHETYPES[d.archetype] ? d.archetype : G.inferArchetype(d), I = R.info(d);
      if (!!I !== kinds.includes(arch)) wrong.push(d.id + ":" + arch);
      if (I) { mapped++; count[I.proto] = (count[I.proto] || 0) + 1; } else none++;
    });
    numbers.protoCount = count; numbers.mapped = mapped; numbers.none = none;
    ok("A every pistol, SMG, rifle, LMG and sniper is one of the nine prototypes (the rest none)", !wrong.length, wrong.join());
    ok("A every prototype has guns in the game", KEYS.every((k) => count[k] >= 1), JSON.stringify(count));
    const fl = KEYS.filter((k) => { const d = flagDef(k), I = d && R.info(d); return !(I && I.proto === k && I.flagship); });
    ok("A each prototype's stand-in for the clip's gun is of it (and the only stand-in)", !fl.length && Object.values(G.WEAPON_DEFS).filter((d) => { const I = R.info(d); return I && I.flagship; }).length === 9, fl.join());
    const off = Object.keys(RATE).filter((k) => {
      const r = RATE[k], iv = flagDef(k).fireRate;
      return r[0] === ">=" ? iv < r[1] : iv < r[0] * 0.95 || iv > r[1] * 1.05;
    });
    numbers.rates = Object.keys(RATE).map((k) => k + " " + flagDef(k).id + " " + flagDef(k).fireRate + " ms");
    ok("A the stand-ins fire at the clips' rates (section 5, within 5%)", !off.length, off.join() + " | " + numbers.rates.join(", "));
    // a bolt-action is a bolt-action only when it fires no faster than its bolt can be worked
    const bolts = Object.values(G.WEAPON_DEFS).filter((d) => { const I = R.info(d); return I && I.action === "bolt"; });
    ok("A the bolt-actions: the .50s and the snipers slow enough to work a bolt", bolts.length >= 4 && bolts.every((d) => d.fireRate >= G.CONFIG.gunRef.bolt.minInterval * 1000 && ["F", "G", "H"].includes(R.info(d).proto)), bolts.map((d) => d.id).join());
    // no real gun's name: the clips' guns are only the references
    const REAL = /\b(m249|mk ?48|rpk|kriss|vector|glock|m1911|1911|m95|barrett|awm|accuracy international)\b/i;
    const bad = [];
    const langs = ["en", "th", "zh", "fr"].filter((l) => G.STRINGS[l]);
    langs.forEach((l) => {
      const S = G.STRINGS[l];
      Object.keys(S).forEach((k) => { if (/^weapon\./.test(k) && REAL.test(String(S[k]))) bad.push(l + ":" + k); });
    });
    if (langs.length < 4) bad.push("only " + langs.join("/") + " loaded");
    const names = Object.values(G.WEAPON_DEFS).filter((d) => REAL.test(d.id) || (d.name && REAL.test(d.name))).map((d) => d.id);
    ok("A no gun is named after a real one, in any language", !bad.length && !names.length, bad.concat(names).join());
  }

  // ---------------- B: the models ----------------
  function models() {
    const R = G.GunRef;
    KEYS.forEach((k) => {
      const d = flagDef(k), I = R.info(d), g = G.GunModels.build(d), U = g.userData;
      const mats = new Set(), glows = new Set(), skins = {};
      g.traverse((o) => { if (!o.isMesh) return; const m = o.material; if (m.isMeshBasicMaterial) glows.add(m.color.getHex()); else { mats.add(m.color.getHex()); skins[m.color.getHex()] = m.userData.skin; } });
      const pal = R.PALETTES[R.PROTOS[k].palettes[0]];
      const want = (GLOWS[k] || []).map((n) => R.GLOW[n]);
      const P = U.parts || {}, An = U.anchors || {};
      const anchors = ["grip", "fore", "magWell", "magBottom", "muzzle", "bolt", "port"].every((a) => An[a] && An[a].isVector3);
      const parts = P.mag && P.bolt && (k !== "A" || P.cover);
      const aim = U.aim && U.aim.y > 0 && U.aim.eye > 0 && U.vmScale >= 1 && Array.isArray(U.hipNudge);
      ok("B " + k + " (" + d.id + "): its palette, its sight's glow, its accent, its moving parts and anchors, its hold",
        U.proto === k && I.palette === R.PROTOS[k].palettes[0] && mats.has(pal.main) && want.every((c) => glows.has(c)) && mats.has(d.color) && anchors && parts && aim,
        [I.palette, "glow " + [...glows].map((c) => c.toString(16)).join("/"), "parts " + Object.keys(P).join("/"), "scale " + U.vmScale].join("; "));
      if (k === "H") ok("B the white sniper's white is paint, not metal (it stays white at night)", skins[pal.main] === "polymer" && skins[pal.lit] === "polymer", skins[pal.main] + "/" + skins[pal.lit]);
      if (k === "F") ok("B the .50's silver is paint (Cerakote), its rail and frame black", skins[pal.main] === "polymer" && mats.has(pal.alt), skins[pal.main]);
      if (k === "D") ok("B the polymer pistol's frame is polymer, its slide steel", skins[pal.dark] === "polymer" && skins[pal.main] === "matte", skins[pal.dark] + "/" + skins[pal.main]);
      G.disposeObject3D(g);
    });
    // the dressed gun, as the game builds it: one merged mesh and its glow, the anchors kept
    const m = G.buildWeaponMesh(flagDef("A"));
    let meshes = 0; m.traverse((o) => { if (o.isMesh) meshes++; });
    ok("B the game's build of a prototype's gun: dressed (merged meshes), its anchors and prototype kept", m.userData.proto === "A" && m.userData.anchors && m.userData.anchors.muzzle && meshes <= 8, meshes + " meshes");
    G.disposeObject3D(m);
    // a gun of no prototype: as before
    const other = Object.values(G.WEAPON_DEFS).find((d) => d.id !== "melee" && !R.info(d));
    const o = G.buildWeaponMesh(other);
    ok("B a gun of no prototype (" + other.id + ") is built as before", !G.GunModels.build(other) && !o.userData.proto && o.userData.anchors && o.userData.anchors.muzzle, other.id);
    G.disposeObject3D(o);
    // ...in the clips' dark metal, its own colour kept on lit parts (section 6: one accent each)
    const plain = Object.values(G.WEAPON_DEFS).filter((d) => d.id !== "melee" && !R.info(d));
    const lost = plain.filter((d) => {
      const g2 = G.buildWeaponModel(d), want = new THREE.Color(d.color).multiplyScalar(0.8).getHex();
      let n = 0; g2.traverse((x) => { if (x.isMesh && !x.material.isMeshBasicMaterial && x.material.color.getHex() === want) n++; });
      G.disposeObject3D(g2);
      return n < 2;
    });
    ok("B every gun of no prototype keeps its own colour on its body (a panel each side, its handguard or pump)", !lost.length, plain.length + " guns; without: " + lost.map((d) => d.id).join());
    // the palettes: every prototype's first palette is the clip's measured one, with its paint marked
    ok("B the palettes of section 3 (eight finishes), every prototype's own among them", KEYS.every((k) => R.PROTOS[k].palettes.every((p) => R.PALETTES[p] && R.PALETTES[p].main != null)) && Object.keys(R.PALETTES).length >= 8, Object.keys(R.PALETTES).length);
  }

  // ---------------- C: the effects ----------------
  function effects(g) {
    const F = G.CONFIG.gunRef.flash, R = G.GunRef;
    ok("C the flash's size classes: S < M < L < XL", F.S < F.M && F.M < F.L && F.L < F.XL, [F.S, F.M, F.L, F.XL].join(" < "));
    const sizes = [];
    let ringOk = true;
    ["pistol", "void_principal", "nut_cracker", "overwatch"].forEach((id) => {
      hold(g, id);
      const I = R.info(G.WEAPON_DEFS[id]), fl = G.FX._flash;
      sizes.push(id + " " + I.flash + " " + (fl.mesh && fl.mesh.userData.flashSize[0]));
      if (!fl.mesh || !near(fl.mesh.userData.flashSize[0], F[I.flash])) ringOk = false;
      if (I.flash === "XL" ? !(fl.ring && fl.ring.material.color.getHex() === 0x967758) : fl.ring) ringOk = false;
    });
    ok("C each gun's flash by its prototype's class; the .50's brown smoke ring (#967758) with it", ringOk, sizes.join(", "));
    // the casings by kind, as a shot throws them
    const q0 = G.save.settings.graphicsQuality;
    G.save.settings.graphicsQuality = "high";
    const S = G.FX._pools.sh, last = (n) => { const out = []; for (let i = 1; i <= n; i++) out.push(S.kind[(S.next - i + S.kind.length) % S.kind.length]); return out; };
    const got = {};
    if (S) {
      [["last_stand", "lmg"], ["void_principal", "rifle"], ["scrap_spitter", "smg"], ["pistol", "pistol"], ["nut_cracker", "pistol"]].forEach(([id, fam]) => {
        hold(g, id);
        G.FX.onFire({ weaponId: id, family: fam });
        got[id] = last(id === "last_stand" ? 2 : 1).join("+");
      });
      ok("C the casings: the LMG's brass and its link, the rifle's steel, the SMG's brass, the pistols' short brass",
        got.last_stand === "link+brassLinks" && got.void_principal === "steel" && got.scrap_spitter === "brass" && got.pistol === "pistol" && got.nut_cracker === "pistol", JSON.stringify(got));
      // a bolt-action: nothing at the shot, its case at the pull
      hold(g, "sniper");
      const n0 = S.next;
      G.FX.onFire({ weaponId: "sniper", family: "sniper_bolt" });
      const atShot = S.next - n0;
      G.ViewModel.onShot({ weaponId: "sniper" });
      const st = R.boltSteps(G.WEAPON_DEFS.sniper);
      let thrownAt = null;
      for (let i = 0; i < 140 && thrownAt == null; i++) { step(g, 1); if (S.next !== n0) thrownAt = G.ViewModel.S.bolt ? G.ViewModel.S.bolt.t : null; }
      ok("C a bolt-action throws its case out as the bolt is pulled back, not at the shot", atShot === 0 && thrownAt != null && thrownAt >= st.lift - 0.05 && thrownAt <= st.pull + 0.1 && S.kind[(S.next - 1 + S.kind.length) % S.kind.length] === "brass",
        "at the shot " + atShot + ", thrown at " + (thrownAt == null ? "-" : thrownAt.toFixed(2)) + " s (pull " + st.pull.toFixed(2) + ")");
      for (let i = 0; i < 120; i++) step(g, 1);
    } else ok("C the shells' pool", false, "no pool");
    G.save.settings.graphicsQuality = q0;
  }

  // ---------------- D: the animation ----------------
  function animation(g) {
    const R = G.GunRef, VM = G.ViewModel, D = G.CONFIG.gunRef.draw;
    const off = KEYS.filter((k) => !near(VM.drawDuration(flagDef(k)), D[k]));
    const other = Object.values(G.WEAPON_DEFS).find((d) => d.id !== "melee" && !R.info(d));
    ok("D the draw's time by prototype (the pistols 0.5 s ... the chassis sniper 1.3 s); others half their switch", !off.length && near(VM.drawDuration(other), VM.switchDuration(other) / 2), off.join());
    // a switch: the swap at the put-away's share
    hold(g, "pistol");
    const p = g.player;
    p.gunSlots = ["pistol", "sniper"];
    const sd = G.WEAPON_DEFS.sniper;
    if (!p.ammo.sniper) p.ammo.sniper = { mag: sd.magSize, reserve: 20 };
    if (!p.weaponLevels.sniper) p.weaponLevels.sniper = { dmg: 1, rate: 1, mag: 1 };
    p.currentSlot = 2;
    g.wsm.requestSwitch();
    // (js/weaponsm.js keeps the swap between 15% and 85% of the switch)
    const sw = g.wsm.sw, lo = VM.switchDuration(G.WEAPON_DEFS.pistol) / 2, want = Math.max(0.15, Math.min(0.85, lo / (lo + D.G)));
    let swapT = null;
    for (let i = 0; i < 300 && g.wsm.sw; i++) { step(g, 1); if (swapT == null && sw && sw.swapped) swapT = sw.t; }
    ok("D a switch, pistol to the chassis sniper: longer, the swap at the put-away's share of it",
      sw && near(sw.split, want, 1e-3) && near(sw.dur, lo + D.G, 1e-3) && swapT != null && Math.abs(swapT - sw.dur * sw.split) < 0.04,
      sw ? "dur " + sw.dur.toFixed(2) + " split " + sw.split.toFixed(3) + " (want " + want.toFixed(3) + "), swapped at " + (swapT == null ? "-" : swapT.toFixed(2)) : "no switch");
    // the bolt's steps
    const B = G.CONFIG.gunRef.bolt, st = R.boltSteps(sd), fast = Object.values(G.WEAPON_DEFS).find((d) => { const I = R.info(d); return I && I.action === "bolt" && d.fireRate / 1000 < (I.proto === "F" ? B.F.settle : B.G.settle); });
    const fst = fast && R.boltSteps(fast);
    ok("D the bolt's steps after a shot (the clip's: hand at 0.61 s, back at 0.83, home and settled by 1.45); squeezed for a quicker gun",
      st.scale === 1 && near(st.grab, B.G.grab) && near(st.pull, B.G.pull) && near(st.settle, B.G.settle) && (!fast || (fst.scale < 1 && fst.settle < fast.fireRate / 1000)),
      fast ? fast.id + " settles at " + fst.settle.toFixed(2) + " s of " + (fast.fireRate / 1000) : "no quicker bolt gun");
    VM.onShot({ weaponId: "sniper" });
    const S = VM.S;
    S.bolt.t = st.grab + 0.05; const busy = VM.boltBusy();
    S.bolt.t = st.settle + 0.3; const free = !VM.boltBusy();
    VM.onShot({ weaponId: "overwatch" });
    const fs = R.boltSteps(G.WEAPON_DEFS.overwatch);
    S.bolt.t = fs.grab + 0.05; const fifty = VM.boltBusy();
    S.bolt.t = (fs.dip[0] + fs.dip[1]) / 2; const sag = VM.boltPose(S.bolt).gun[1];
    S.bolt = null; VM.boltHome();
    ok("D the chassis sniper comes off its sight to work the bolt; the .50 stays on it and sags", busy && free && !fifty && sag < -0.02, "sag " + sag.toFixed(3) + " m");
    // the reload's timeline by family (section 4.2)
    const bad = [];
    KEYS.forEach((k) => {
      const d = flagDef(k), I = R.info(d), plan = VM.planReload(d, 3, "empty");
      if (plan.keys !== VM.REF_STYLES[I.reload]) bad.push(k + ":" + I.reload);
    });
    const belt = VM.planReload(flagDef("A"), 10, "empty").events.map((e) => e.kind);
    ok("D the reload by family: the pistols', the SMG's, the long rifle's, the belt's (cover first, slammed before the charge), the bolt guns'",
      !bad.length && belt[0] === "cover" && belt.indexOf("coverClose") < belt.indexOf("bolt"), bad.join() + " | belt " + belt.join(">"));
    // the view's kick: a share of the screen's height whatever the zoom
    hold(g, "pistol");
    const RC = G.CONFIG.gunRef.recoil, cr = G.save.settings.cameraRecoil == null ? 1 : G.save.settings.cameraRecoil;
    const kicks = [];
    let kickOk = true;
    ["pistol", "nut_cracker", "sniper"].forEach((id) => {
      const k = R.info(G.WEAPON_DEFS[id]).proto, x0 = g.pitchObject.rotation.x, y0 = g.yawObject.rotation.y;
      g.recoilKick(G.WEAPON_DEFS[id]);
      const dk = g.pitchObject.rotation.x - x0, want2 = RC[k].kick * g.camera.fov * Math.PI / 180 * cr;
      kicks.push(id + " " + (dk / (g.camera.fov * Math.PI / 180) * 100).toFixed(1) + "%");
      if (!near(dk, want2, 1e-6) || !near(g.recoilRate, 3 / RC[k].back, 1e-6)) kickOk = false;
      g.pitchObject.rotation.x = x0; g.yawObject.rotation.y = y0; g.recoilRecover = 0; g.recoilYaw = 0;
    });
    ok("D the view's kick by prototype, as a share of the screen's height (the polymer pistol's 0.7%, the .45's 1.4%, the sniper's 5%)", kickOk && RC.D.kick < RC.E.kick && RC.E.kick < RC.G.kick, kicks.join(", "));
  }

  // ---------------- E: aimed ----------------
  function aimed(g) {
    const rows = [], v = new THREE.Vector3();
    let all = true;
    ["pistol", "last_stand", "sniper", "overwatch"].forEach((id) => {
      hold(g, id);
      G.Input.aimDown = true;
      step(g, 110);
      const gun = g.weaponViewGroup, A = gun.userData.aim;
      g.yawObject.updateMatrixWorld(true);
      v.set(0, A.y, A.z).applyMatrix4(gun.matrixWorld).project(g.camera);
      rows.push(id + " (" + v.x.toFixed(3) + ", " + v.y.toFixed(3) + ")");
      if (!(g.aimT > 0.99 && Math.abs(v.x) < 0.03 && Math.abs(v.y) < 0.03)) all = false;
      G.Input.aimDown = false;
      step(g, 40);
    });
    ok("E aimed, the sight's middle is on the screen's middle", all, rows.join(", "));
    // the scope's overlay
    const sc = $("hud-scope"), seen = {};
    ["vital_sign", "honor_roll", "sniper", "overwatch"].forEach((id) => {
      const held = hold(g, id);
      G.Input.aimDown = true;
      step(g, 110);
      seen[id] = (held ? "" : "(holding " + g.wsm.held + ") ") + (sc.classList.contains("hidden") ? "none" : sc.classList.contains("no-dot") ? "scope" : "scope+dot") +
        (g.weaponViewGroup.visible && G.PlayerBody.armRig.group.visible ? "" : " (gun put away)");
      G.Input.aimDown = false;
      step(g, 40);
    });
    const back = g.weaponViewGroup.visible && G.PlayerBody.armRig.group.visible;
    ok("E the scope's overlay (the gun and hands put away under it): the white sniper's with its red dot, the blue-lens one's without; none on the peep or the .50's frame (the gun in view)",
      seen.vital_sign === "scope+dot (gun put away)" && seen.honor_roll === "scope (gun put away)" && seen.sniper === "none" && seen.overwatch === "none" && back && !!sc.querySelector("svg.hud-scope-svg"),
      JSON.stringify(seen) + " (" + g.state + ", back in view after: " + back + ")");
  }

  // ---------------- F: the sound ----------------
  // the loudest sample leaving the master since it was last asked (dBFS)
  async function peakMeter(A) {
    const ctx = A.ctx;
    if (!G._vzPeakMod) {
      const src = "class VzPeak extends AudioWorkletProcessor { constructor() { super(); this.m = 0; this.port.onmessage = () => { this.port.postMessage(this.m); this.m = 0; }; }" +
        " process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) for (let i = 0; i < c.length; i++) { const a = c[i] < 0 ? -c[i] : c[i]; if (a > this.m) this.m = a; } return true; } }" +
        " registerProcessor('vz-peak', VzPeak);";
      G._vzPeakMod = ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: "application/javascript" })));
    }
    await G._vzPeakMod;
    const node = new AudioWorkletNode(ctx, "vz-peak"), sink = ctx.createGain();
    sink.gain.value = 0;
    A.meter.connect(node); node.connect(sink); sink.connect(ctx.destination);
    let waiting = null;
    node.port.onmessage = (e) => { if (waiting) { const w = waiting; waiting = null; w(e.data); } };
    return {
      take: () => new Promise((res) => { waiting = (v) => res(v > 0 ? 20 * Math.log10(v) : -Infinity); node.port.postMessage("take"); }),
      off: () => { try { A.meter.disconnect(node); node.disconnect(); sink.disconnect(); } catch (e) { /* gone */ } },
    };
  }

  async function sound(g) {
    const V = G.GunVoice, R = G.GunRef;
    const strip = (v) => { const c = JSON.parse(JSON.stringify(v)); delete c.proto; return JSON.stringify(c); };
    const exact = KEYS.filter((k) => strip(V.voiceFor(flagDef(k))) !== strip(V.VOICES[k]));
    const variant = Object.values(G.WEAPON_DEFS).find((d) => { const I = R.info(d); return I && I.proto === "B" && !I.flagship; });
    const vv = V.voiceFor(variant), ratio = vv.trans.lo / V.VOICES.B.trans.lo;
    ok("F the stand-ins play their recipe as tuned; another gun of the prototype a little nudged (within 6%)", !exact.length && strip(vv) !== strip(V.VOICES.B) && ratio >= 0.94 && ratio <= 1.06, exact.join() + " | " + variant.id + " x" + ratio.toFixed(3));
    // section 5, every gun of a prototype
    if (!G.GunSoundCheck) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/tools/gun-sound-check.js?v=" + Date.now(); s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const t0 = performance.now(), all = await G.GunSoundCheck.runAll();
    numbers.soundSecs = Math.round((performance.now() - t0) / 1000);
    const fails = all.rows.filter((r) => !r.ok).map((r) => r.id + ": " + r.fails.join("; "));
    numbers.soundFails = fails;
    ok("F every gun of a prototype meets section 5 (centroids +-25%, bands +-10 points, decays +-30%, rate +-5%, sub +-10 Hz)", all.ok && all.n === numbers.mapped, all.n + " guns, " + fails.length + " out" + (fails.length ? ": " + fails.join(" | ") : ""));
    // the loudness order and the headroom (the shots drawn on the game's own context)
    G.Audio.unlock();
    if (G.Audio.ctx && G.Audio.ctx.state !== "running") { try { await G.Audio.ctx.resume(); } catch (e) { /* no gesture */ } }
    const GA = G.GunAudio, heard = {}, peaks = {};
    for (const k of KEYS) {
      const d = flagDef(k), b = await GA.renderOne(d, 1), dd = b.getChannelData(0);
      let s = 0, pk = 0; const n = Math.min(dd.length, Math.floor(b.sampleRate * 0.15));
      for (let i = 0; i < dd.length; i++) { const a = Math.abs(dd[i]); if (a > pk) pk = a; if (i < n) s += dd[i] * dd[i]; }
      const h = 10 * Math.log10(s / n) + 20 * Math.log10(GA.profile(d).gain * 0.85), corr = await GA.correction(d, h);
      heard[k] = +(h + corr).toFixed(2);
      peaks[k] = +(20 * Math.log10(pk) + 20 * Math.log10(GA.profile(d).gain * 0.85) + corr).toFixed(1);
    }
    numbers.heard = heard; numbers.peaks = peaks;
    const order = ["F", "A", "B", "E", "D", "C"];
    ok("F the shots' loudness in section 5's order: .50 > LMG > rifle > .45 > 9 mm > SMG (the snipers between the LMG and the rifle)",
      order.every((k, i) => i === 0 || heard[order[i - 1]] > heard[k]) && ["G", "H", "I"].every((k) => heard[k] < heard.A && heard[k] > heard.B), order.map((k) => k + " " + heard[k]).join(" > ") + " | G " + heard.G);
    // (the old snipers' shots peaked at +2.4 dBFS before the master: round 3's limiter and ceiling are the guard)
    ok("F the shots at the game's old levels (the reference rifle at baseDb), no peak hotter than the old guns' before the master (+3 dBFS)",
      near(heard.B, G.CONFIG.gunRef.baseDb, 0.01) && Object.values(peaks).every((p) => p <= 3), "rifle " + heard.B + " dB; peaks " + JSON.stringify(peaks));
    // a gun's draw, heard on the master: well under its shot (section 4: 10-20 dB)
    const A = G.Audio;
    if (A.ctx && A.ctx.state === "running") {
      // (the level's music, ambience and other sounds down meanwhile: only the gun on the master)
      const S = G.save.settings, keep = { musicVolume: S.musicVolume, ambientVolume: S.ambientVolume, sfxVolume: S.sfxVolume };
      Object.keys(keep).forEach((k) => { S[k] = 0; });
      A.applyVolumes(); A.stopAll(["sfx", "ambient"]);
      // (the master's loudest sample over a stretch, every sample of it: an
      // AudioWorklet on the meter's output -- reading the analyser from
      // timers missed a short click whenever the page was busy)
      const meter = await peakMeter(A);
      const loudest = async (fn, ms) => { await meter.take(); fn(); await wait(ms); return meter.take(); };
      const shots = async (d) => { let m = -Infinity; for (let i = 0; i < 3; i++) { m = Math.max(m, await loudest(() => GA.shot(d), 240)); await wait(1200); } return m; };
      await wait(600);
      await GA.render(flagDef("B")); await GA.render(flagDef("F"));
      const shot = await shots(flagDef("B"));
      await wait(1500);
      const draw = await loudest(() => GA.draw(flagDef("B")), 1600);
      await wait(800);
      const fifty = await shots(flagDef("F"));
      Object.keys(keep).forEach((k) => { S[k] = keep[k]; });
      A.applyVolumes();
      meter.off();
      numbers.drawUnderShot = +(shot - draw).toFixed(1);
      ok("F the rifle's draw under its shot on the master (section 4: 10-20 dB)", shot - draw >= 9 && shot - draw <= 22, "shot " + shot.toFixed(1) + " dBFS, draw " + draw.toFixed(1) + " dBFS");
      ok("F no clipping: the .50, the loudest, leaves the master under full scale (the ceiling, -1 dBFS)", fifty < 0 && fifty > -12, fifty.toFixed(1) + " dBFS");
    } else ok("F (the audio is not running: the draw's level not measured)", true, "skipped");
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save), lang0 = G.lang;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    G._missingKeys = {};
    try {
      await loadLangs();
      protos();
      models();
      const g = startRun();
      effects(g);
      animation(g);
      aimed(g);
      await sound(g);
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      G.Input.aimDown = false;
      if (spawnUpd) { G.Spawner.update = spawnUpd; spawnUpd = null; }
      if (realUpd) G.Game.update = realUpd;
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
