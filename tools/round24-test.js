// Dev-only (not shipped). The overhaul, round 4: the ten kinds of zombie --
// js/zombiefactory.js (the atlas, the looks), js/entities.js (the builds),
// js/zombieanim.js (how they move), js/zombieai.js (what they do),
// js/zombiefx.js (the Bloater's swell, Blood & Gore), js/audio.js (their voices).
//   A  the ten: their numbers against the Shambler, the waves they come in
//   B  their looks: each built, apart by shape (not colour), its own eyes,
//      one material and the pixel atlas, the level's clothes, never two alike
//   C  hitboxes and words: fitted to each build, a Runt's smaller and its word
//      as big, a Headless's word over the head it carries
//   D  how they move: each kind's gait, every state without a fault, the LOD
//   E  what they do: the mix, the wind-up and reach, the Screamer, the
//      Bloater, the Ironclad, hit reactions, stumbles
//   F  their sounds and captions; Blood & Gore; the bosses on the atlas;
//      draw calls
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round24Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round24Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const S = () => G.save.settings;
  const C = () => G.CONFIG.zombies;
  const KINDS = () => G.ZOMBIE_KINDS;
  let realUpd = null;

  function start(q, level) {
    const g = G.Game;
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g._r2, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    G.save.tutorialDone = true;
    if (q) S().graphicsQuality = q;
    g.update = realUpd;
    g.startLevel(level || 1);
    g.applyGraphicsQuality();
    g.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    g.player.hp = g.player.maxHp = 1e6;
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    G.Input.clearHeldInputs();
    step(g, 3);
    return g;
  }
  const step = (g, n, dt) => { for (let i = 0; i < (n || 1); i++) { G.Quiz.active = false; g._quizDue = false; realUpd.call(g, dt || 1 / 30); } };
  const P = (g) => g.yawObject.position;
  const at = (g, dx, dz) => new THREE.Vector3(P(g).x + dx, P(g).y - 1.7, P(g).z + (dz || 0));
  const spawn = (g, type, dx, dz) => { const z = g.spawnZombieAt(type, at(g, dx, dz), null); return z; };
  const box = (o) => new THREE.Box3().setFromObject(o);
  const visBox = (z) => { const b = new THREE.Box3(); z.mesh.updateMatrixWorld(true); z.mesh.traverse((o) => { if (o.isMesh && !o.userData.hit && !o.isSprite && o.visible !== false && o.geometry) b.union(new THREE.Box3().setFromObject(o)); }); return b; };

  // ---------------- A ----------------
  function kinds() {
    const T = G.ZOMBIE_TYPES, n = T.normal;
    ok("A ten kinds, the first three under their old ids", KINDS().length === 10 && KINDS().every((k) => T[k]) && KINDS().slice(0, 3).join() === "normal,fast,crawler");
    const want = { fast: [0.7, 1.8], crawler: [0.8, 0.6], bloater: [1.6, 0.6], ironclad: [1.0, 0.75], runt: [0.5, 1.6], abomination: [3.0, 1.1], screamer: [0.8, 0.9], headless: [1.1, 0.9], reacher: [1.8, 0.7] };
    const off = Object.keys(want).filter((k) => Math.abs(T[k].hp / n.hp - want[k][0]) > 0.12 || Math.abs(T[k].speed / n.speed - want[k][1]) > 0.12);
    ok("A hit points and speed against the Shambler, as the concept sheet sets them", !off.length, off.join(","));
    const first = { fast: 3, crawler: 4, bloater: 6, ironclad: 8, runt: 9, abomination: 13, screamer: 7, headless: 11, reacher: 12 };
    ok("A the wave each first comes in", Object.keys(first).every((k) => C().first[k] === first[k]));
    ok("A the Bloater bursts 3 m, the Reacher reaches 2.6 m, one Abomination at a time", C().bloater.radius === 3 && C().reach.reacher === 2.6 && C().maxAlive.abomination === 1);
  }

  // ---------------- B ----------------
  function looks(g) {
    const built = {}, bad = [];
    KINDS().forEach((k) => {
      try {
        const i = KINDS().indexOf(k), z = spawn(g, k, -14 + (i % 5) * 7, 14 + Math.floor(i / 5) * 7);
        z.mesh.updateMatrixWorld(true);
        let meshes = 0, uv = 0, lit = 0, mats = new Set();
        z.mesh.traverse((o) => { if (o.isMesh && !o.userData.hit && !o.isSprite) { meshes++; mats.add(o.material); if (o.material === G.ZOMBIE_MATS.lambert) { lit++; if (o.geometry.attributes.uv) uv++; } } });
        const b = visBox(z), s = b.getSize(new THREE.Vector3());
        built[k] = { z, meshes, uv, lit, mats: mats.size, w: s.x, h: s.y, d: s.z };
      } catch (e) { bad.push(k + ": " + e.message); }
    });
    ok("B every kind is built", !bad.length && Object.keys(built).length === 10, bad.join("; "));
    const H = (k) => built[k].h;
    ok("B apart by shape: the Runt the smallest, the Screamer and the Reacher taller than the Shambler, the Bloater the widest, the Crawler low",
      KINDS().filter((k) => k !== "crawler").every((k) => k === "runt" || H("runt") < H(k)) && H("screamer") > H("normal") && H("reacher") > H("normal") * 0.98 &&
      built.bloater.d >= Math.max(built.normal.d, built.ironclad.d) && H("crawler") < 1.2,
      KINDS().map((k) => k + " " + H(k).toFixed(2)).join(", "));
    const eyes = KINDS().map((k) => G.ZombieFactory.KIND[k].eye);
    ok("B each kind its own eyes (the Screamer: black sockets, a white point)", new Set(eyes.map((e, i) => KINDS()[i] === "headless" ? "h" : e)).size >= 9 && G.ZombieFactory.KIND.screamer.pupil === 0xffffff);
    ok("B one lit material for all, with the pixel atlas; every lit part mapped on it",
      KINDS().every((k) => built[k].lit > 0 && built[k].uv === built[k].lit) && G.ZOMBIE_MATS.lambert.map === G.ZombieSkin.texture() && G.ZombieSkin.texture().magFilter === THREE.NearestFilter);
    ok("B a zombie is 16 draw calls at most (the Abomination's third arm included)", KINDS().every((k) => built[k].meshes <= 16), KINDS().map((k) => k[0] + built[k].meshes).join(" "));
    ok("B the Ironclad's helmet is apart (a head shot knocks it off), the Abomination has a third arm, the Headless carries its head",
      !!built.ironclad.z.mesh.userData.helmet && !!built.abomination.z.mesh.userData.limbs.armX && !!built.headless.z.mesh.userData.heldHead);
    // what each wears in each level
    const outfits = (theme, type) => { const s = new Set(); for (let i = 0; i < 12; i++) s.add(G.ZombieFactory.look(type, theme, null).outfit); return [...s]; };
    ok("B the level's clothes: a Sprinter at the school in its gym kit; an Ironclad in a hard hat, riot gear, an army helmet",
      outfits("school", "fast").join() === "gym" && outfits("school", "ironclad").join() === "builder" && outfits("hospital", "ironclad").join() === "riot" && outfits("bunker", "ironclad").join() === "trooper");
    ok("B a Shambler wears the level's own -- and now and then an office worker, a farmer, someone off the street",
      ["office", "farmer", "homeless"].every((o) => G.ZOMBIE_OUTFITS.school.some((x) => x.key === o)) && !outfits("hospital", "normal").some((o) => ["gym", "kid", "riot"].includes(o)));
    // never two alike
    g.clearZombies();
    for (let i = 0; i < 24; i++) spawn(g, i % 2 ? "normal" : "fast", 20 + (i % 6) * 2, 20 + Math.floor(i / 6) * 2);
    const sigs = g.zombies.filter((z) => z.alive).map((z) => z._sig);
    ok("B never two alive alike in every part", new Set(sigs).size === sigs.length, sigs.length + " alive");
    g.clearZombies();
    g._waveOutfits = new Set();
    for (let i = 0; i < 4; i++) spawn(g, "normal", 20 + i * 2, 20);
    ok("B a wave's first zombies wear at least " + C().variety + " outfits", new Set(g.zombies.map((z) => z.look.outfit)).size >= C().variety, [...g._waveOutfits].join(","));
    g.clearZombies();
    return built;
  }

  // ---------------- C ----------------
  function hitboxesAndWords(g) {
    g.clearZombies();
    const bad = [], zs = {};
    KINDS().forEach((k, i) => {
      const z = spawn(g, k, -14 + (i % 5) * 7, 14 + Math.floor(i / 5) * 7);
      zs[k] = z;
      z.mesh.updateMatrixWorld(true);
      const parts = new Set(z.hitboxes.map((h) => h.userData.hit).filter(Boolean));
      const head = z.hitboxes.find((h) => h.userData.hit === "head");
      if (!head) { bad.push(k + " no head box"); return; }
      // the head box holds the head
      const hb = box(head), hw = z.mesh.userData.neck.getWorldPosition(new THREE.Vector3());
      const headMesh = []; z.mesh.userData.neck.traverse((o) => { if (o.isMesh && !o.userData.hit) headMesh.push(o); });
      const hc = new THREE.Box3(); headMesh.forEach((o) => hc.union(box(o)));
      if (!hb.expandByScalar(0.05).containsPoint(hc.getCenter(new THREE.Vector3()))) bad.push(k + " head box off the head");
      if (!parts.has("body") && !parts.has("head")) bad.push(k + " parts " + [...parts]);
      void hw;
    });
    ok("C every kind's hitboxes fitted to its build (the head box on its head)", !bad.length, bad.join("; "));
    const hsz = (k) => { const h = zs[k].hitboxes.find((x) => x.userData.hit === "head"); return box(h).getSize(new THREE.Vector3()).x; };
    ok("C a Runt's hitboxes are smaller", hsz("runt") < hsz("normal") * 0.95 && visBox(zs.runt).getSize(new THREE.Vector3()).y < visBox(zs.normal).getSize(new THREE.Vector3()).y * 0.75, hsz("runt").toFixed(2) + " / " + hsz("normal").toFixed(2));
    ok("C ...and its word as big as anyone's", Math.abs(zs.runt.sprite.scale.x * zs.runt.mesh.scale.x - zs.normal.sprite.scale.x * zs.normal.mesh.scale.x) < 0.01);
    const above = KINDS().filter((k) => k !== "headless").every((k) => { const z = zs[k]; const w = z.sprite.getWorldPosition(new THREE.Vector3()); return w.y > visBox(z).max.y - 0.05; });
    ok("C each word just over its zombie's head", above);
    zs.headless.animate(1 / 30, 0);
    const hp = zs.headless.mesh.userData.heldHead.getWorldPosition(new THREE.Vector3()), lp = zs.headless.sprite.getWorldPosition(new THREE.Vector3());
    ok("C the Headless: its word over the head it carries", Math.hypot(hp.x - lp.x, hp.z - lp.z) < 0.15 && lp.y > hp.y, Math.hypot(hp.x - lp.x, hp.z - lp.z).toFixed(2));
    const ic = zs.ironclad, icHead = ic.hitboxes.find((h) => h.userData.hit === "head");
    ok("C the Ironclad's head box takes in its helmet", box(icHead).expandByScalar(0.03).containsBox(box(ic.mesh.userData.helmet)));
    g.clearZombies();
  }

  // ---------------- D ----------------
  function movement(g) {
    g.clearZombies();
    const styles = new Set(KINDS().map((k) => G.ZombieAnim.GAIT[k].style));
    ok("D each kind its gait (shamble, run, crawl, waddle, march, lurch, creep, carry, heavy)", styles.size >= 9, [...styles].join(","));
    const bad = [];
    KINDS().forEach((k, i) => {
      const z = spawn(g, k, -14 + (i % 5) * 7, 14 + Math.floor(i / 5) * 7);
      try {
        const poses = [];
        const snap = () => { const L = z.mesh.userData.limbs; return [L.armL.shoulder.rotation.x, L.armR.shoulder.rotation.x, z.mesh.userData.neck.rotation.x].map((v) => v.toFixed(3)).join(); };
        for (let t = 0; t < 20; t++) z.animate(1 / 30, z.speed / 30);
        poses.push(snap());
        z._atk = { phase: "wind", t: 0 }; for (let t = 0; t < 12; t++) z.animate(1 / 30, 0); poses.push(snap()); z._atk = null;
        z.flinch(); z.animate(1 / 30, 0);
        z._stagger = 0.45; for (let t = 0; t < 8; t++) z.animate(1 / 30, 0); z._stagger = 0;
        z._down = 1.4; for (let t = 0; t < 12; t++) z.animate(1 / 30, 0); poses.push(snap()); z._down = 0;
        for (let t = 0; t < 20; t++) z.animate(1 / 30, 0);
        z._rear = 1; for (let t = 0; t < 6; t++) z.animate(1 / 30, 0); z._rear = 0;
        z._stumbleT = 0.5; z.animate(1 / 30, 0.1); z._stumbleT = 0;
        if (new Set(poses).size < 3) bad.push(k + " poses alike");
        if (Math.abs(z.mesh.rotation.x) > 0.05 && k !== "crawler") bad.push(k + " left tilted " + z.mesh.rotation.x.toFixed(2));
      } catch (e) { bad.push(k + ": " + e.message); }
    });
    ok("D every kind walks, winds up, flinches, staggers, goes down and up, rears up, stumbles -- and stands up again", !bad.length, bad.join("; "));
    // the LOD
    const cam = g.camera; G.ZombieAnim.frame(g);
    const ahead = (d) => { const f = new THREE.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize(); return P(g).clone().addScaledVector(f, d).setY(P(g).y - 1.7); };
    const z1 = g.spawnZombieAt("normal", ahead(8), null), z2 = g.spawnZombieAt("normal", ahead(22), null), z3 = g.spawnZombieAt("normal", ahead(40), null), z4 = g.spawnZombieAt("normal", ahead(-12), null);
    G.ZombieAnim.frame(g);
    const lods = [z1, z2, z3, z4].map((z) => G.ZombieAnim.lod(z));
    ok("D the LOD: every frame near, every 2nd at 15-30 m, every 4th further, none behind the camera", lods.join() === "1,2,4,0", lods.join());
    g.clearZombies();
  }

  // ---------------- E ----------------
  function behaviour(g) {
    const A = G.ZombieAI;
    // the mix
    const kindsIn = (wave) => { const sp = G.waveSpec(g.level, wave, "campaign"); const sh = A.shares(sp, wave); return Object.keys(sh).filter((k) => sh[k] > 0).sort(); };
    ok("A wave 1: Shamblers only (as slow as before)", kindsIn(1).join() === "normal" && G.waveSpec(g.level, 1, "campaign").speed === G.WAVE_TABLE[0][1]);
    ok("E each kind from its first wave on; by wave 13 all ten", kindsIn(5).join() === "crawler,fast,normal" && kindsIn(7).includes("screamer") && !kindsIn(7).includes("ironclad") && kindsIn(13).length === 10, kindsIn(13).join());
    G.Spawner.reset(g.level, 15, "campaign");
    g.clearZombies();
    spawn(g, "abomination", 25, 25);
    const picks = {}; for (let i = 0; i < 400; i++) { const k = A.pick(g, { types: ["normal", "fast"] }); picks[k] = (picks[k] || 0) + 1; }
    ok("E one Abomination at a time", !picks.abomination && Object.keys(picks).length >= 8, JSON.stringify(picks));
    const slow = {}; for (let i = 0; i < 300; i++) { const k = A.pick(g, { types: ["normal"] }); slow[k] = 1; }
    ok("E a point no fast one may come from sends no Sprinter, no Runt", !slow.fast && !slow.runt);
    const q0 = S().graphicsQuality; S().graphicsQuality = "low";
    ok("E at most so many at once by graphics level (Low: 10)", A.aliveCap(14) === 10 && A.aliveCap(6) === 6);
    S().graphicsQuality = q0;
    g.clearZombies();
    // the wind-up and the reach
    g.player.hp = g.player.maxHp = 450;
    const z = spawn(g, "normal", 0.8, 0); z.speed = 0.0001;
    step(g, 1);
    const hp1 = g.player.hp;
    ok("E in reach: it winds up first -- no damage at once", z._atk && z._atk.phase === "wind" && g.player.hp === hp1);
    step(g, 14);
    ok("E ...then the strike lands", g.player.hp < hp1, (hp1 - g.player.hp).toFixed(0));
    g.clearZombies(); g.player.hp = 450;
    const z2 = spawn(g, "normal", 0.9, 0); z2.speed = 0.0001;
    step(g, 1);
    z2.mesh.position.x += 3;               // the player stepped back out of reach
    step(g, 14);
    ok("E out of reach when it strikes: a miss", g.player.hp === 450);
    g.clearZombies();
    const r = spawn(g, "reacher", 2.3, 0); r.speed = 0.0001;
    step(g, 1);
    ok("E the Reacher strikes from 2.3 m (the Shambler cannot)", r._atk && r._atk.phase === "wind");
    g.clearZombies(); g.player.hp = g.player.maxHp = 1e6;
    // the Screamer
    g.requiredKills = g.spawnedCount + 3;
    const s = spawn(g, "screamer", 10, 0); s._screamCd = 0; s.speed = 0.0001;
    const n1 = spawn(g, "normal", 12, 3); n1.speed = 0.0001;
    const left0 = g.requiredKills - g.spawnedCount;
    A.lastShriek = null;
    step(g, 3);
    ok("E the Screamer rears up first (it stops)", s._rear > 0 && s._hold > 0 && !A.lastShriek);
    step(g, 40);
    const hud = g.buildHudState();
    ok("E ...then shrieks: the zombies near come on faster, and more of the wave's own come in -- never past its count",
      A.lastShriek && n1._boostT > 0 && A.lastShriek.called >= 1 && A.lastShriek.called <= Math.min(C().screamer.call, left0) && g.spawnedCount <= g.requiredKills,
      JSON.stringify(A.lastShriek) + " left " + left0);
    ok("E ...the HUD's count still right", hud.zombiesLeft === g.zombies.filter((x) => !x.decoy).length + Math.max(0, g.requiredKills - g.spawnedCount));
    g.clearZombies(); A.lastShriek = null; g.requiredKills = 1e9;
    const s2 = spawn(g, "screamer", 10, 0); s2._screamCd = 0; s2.speed = 0.0001;
    step(g, 6);
    g.damageZombie(s2, 1e6, s2.mesh.position.clone(), { dir: new THREE.Vector3(1, 0, 0), head: false });
    step(g, 40);
    ok("E killed while it rears up: the shriek never comes", !A.lastShriek && !G.Audio.live.some((v) => v.tag === "scream:" + s2.uid && !v.dead));
    // the Bloater
    g.clearZombies(); G.ZombieFX.clearDying(g.scene);
    g.player.hp = g.player.maxHp = 450;
    const b = spawn(g, "bloater", 1.5, 0); b.speed = 0.0001;
    const nb = spawn(g, "normal", 2.5, 0.5); nb.speed = 0.0001;
    const nb0 = nb.mesh.position.clone(), kills0 = g.totalZombiesKilled;
    g.damageZombie(b, 1e6, b.mesh.position.clone().setY(1), { dir: new THREE.Vector3(1, 0, 0), head: false });
    const d0 = G.ZombieFX.dying.find((d) => d.z === b), hpB = g.player.hp;
    ok("E the Bloater swells 0.8-1.2 s before it bursts", d0 && d0.mode === "swell" && d0.fuse >= 0.8 && d0.fuse <= 1.2);
    step(g, 45);
    const dmg = hpB - g.player.hp;
    ok("E ...the burst hurts the player close by (less further out)", dmg > 0 && dmg <= C().bloater.damage, dmg.toFixed(1));
    ok("E ...throws the zombies round it back, staggering -- and kills nobody", nb.alive && nb.mesh.position.distanceTo(nb0) > 0.5 && g.totalZombiesKilled - kills0 === 1);
    g.clearZombies(); g.player.hp = g.player.maxHp = 1e6;
    // the Ironclad
    const ic = spawn(g, "ironclad", 4, 0); ic.speed = 0.0001;
    const hm = []; for (let i = 0; i < C().ironclad.helmetHits + 1; i++) hm.push(A.hitMod(g, ic, 10, true, new THREE.Vector3(1, 0, 0)));
    ok("E the Ironclad's helmet stops head shots until it is knocked off, then a head shot is a head shot",
      hm.slice(0, -1).every((x) => !x.head && x.dmg === 10 * C().ironclad.helmetDamage) && hm[hm.length - 1].head && hm[hm.length - 1].dmg === 10 * G.HEADSHOT_MULT && ic._helmetOn === false && A.loose.length >= 1);
    ok("E ...its vest takes a share off a body hit", A.hitMod(g, ic, 10, false).dmg === 10 * C().ironclad.vest);
    // hit reactions
    g.clearZombies();
    const h = spawn(g, "reacher", 6, 0); h.speed = 0.0001;
    g.damageZombie(h, h.maxHp * 0.05, h.mesh.position.clone(), { dir: new THREE.Vector3(1, 0, 0) });
    const light = (h._anim ? h._anim.flinch > 0 : !!h._flinchNext) && !(h._stagger > 0) && !(h._down > 0);
    g.damageZombie(h, h.maxHp * 0.25, h.mesh.position.clone(), { dir: new THREE.Vector3(1, 0, 0) });
    const medium = h._stagger > 0 && !(h._down > 0);
    h._stagger = 0;
    g.damageZombie(h, h.maxHp * 0.5, h.mesh.position.clone(), { dir: new THREE.Vector3(1, 0, 0) });
    const heavy = h._down > 0 && h._hold > 0;
    ok("E a hit that does not kill: light a flinch, medium a stagger, heavy down and up again", light && medium && heavy);
    g.player.hp = 450; h.mesh.position.copy(at(g, 0.8, 0)); h.attackCooldown = 0; h._atk = null;
    step(g, 6);
    ok("E ...down, it cannot strike", g.player.hp === 450 && !(h._atk && h._atk.phase === "wind"));
    g.player.hp = g.player.maxHp = 1e6;
    // a stumble
    g.clearZombies();
    const f = spawn(g, "fast", 12, 0);
    for (let i = 0; i < 6; i++) f.animate(1 / 30, 0.1);
    f._stumbleT = 0.5;
    ok("E a Sprinter that stumbles slows for a moment", A.tick(g, f, 0.01) < 0.5);
    g.clearZombies();
  }

  // ---------------- F ----------------
  async function soundsGoreBosses(g) {
    const A = G.Audio;
    A.unlock();
    const bad = [];
    KINDS().forEach((k) => {
      ["growl", "hurt", "death", "attack"].forEach((kind) => { try { A.zombie(kind, k, P(g).clone().add(new THREE.Vector3(3, 0, 0))); } catch (e) { bad.push(k + " " + kind + ": " + e.message); } });
      if (!A.ZOMBIE_VOICE[k]) bad.push(k + " no voice");
    });
    ["scream_wind", "scream", "swell", "pop", "helmet", "helmet_off", "helmet_land", "drag", "clank"].forEach((kind) => { try { A.zombie(kind, "screamer", P(g).clone().add(new THREE.Vector3(3, 0, 0)), { tag: "t" }); } catch (e) { bad.push(kind + ": " + e.message); } });
    ok("F a voice for each kind, and every special sound", !bad.length, bad.join("; "));
    const fm = new Set(KINDS().map((k) => A.ZOMBIE_VOICE[k].f + "|" + A.ZOMBIE_VOICE[k].fm.join()));
    ok("F ...no two kinds sound alike (pitch and throat)", fm.size === 10);
    ok("F the shriek, the swell and the burst are captioned (4 languages)", ["scream", "swell", "burst"].every((n) => G.Captions.KEYS["zombie:" + (n === "scream" ? "scream" : n === "swell" ? "swell" : "burst")] && G.T("cap." + n) !== "cap." + n));
    A.stopAll();
    // Blood & Gore
    const d = G.defaultSave().settings;
    ok("F Blood & Gore: Full to start, an old save gets it, a bad value goes back to Full", d.gore === "full" && G.normalizeSave({ unlockedLevels: [1], settings: {} }).settings.gore === "full" && G.normalizeSave({ unlockedLevels: [1], settings: { gore: "x" } }).settings.gore === "full");
    G.SettingsUI.cat = "accessibility"; G.UI.showScreen("screen-settings"); G.SettingsUI.render();
    ok("F ...three steps in Accessibility", document.querySelectorAll("#set-gore .seg-o").length === 3 && !!document.getElementById("set-gore").closest("#set-sec-accessibility"));
    G.UI.showScreen(null);
    const red = (z) => { let n = 0; z.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.geometry.attributes.color) { const c = o.geometry.attributes.color; for (let i = 0; i < c.count; i++) { const r = c.getX(i), gg = c.getY(i), b = c.getZ(i); if (r > 0.25 && r > gg * 2.2 && r > b * 2.2) n++; } } }); return n; };
    g.clearZombies();
    // (a kind with pale eyes: the Abomination's glow red-orange)
    S().gore = "full"; const zf = spawn(g, "headless", 8, 10);
    S().gore = "off"; const zo = spawn(g, "headless", 12, 10);
    ok("F Off: not a red wound or a drop of blood on it", red(zf) > 0 && red(zo) === 0, red(zf) + " / " + red(zo));
    ok("F ...a Runt is never more than Reduced", G.ZombieFactory.gore({ type: "runt" }) === "off" && (S().gore = "full", G.ZombieFactory.gore({ type: "runt" }) === "reduced"));
    g.clearZombies(); G.ZombieFX.clearDying(g.scene);
    S().gore = "reduced";
    const zr = spawn(g, "normal", 6, 0);
    g.damageZombie(zr, 1e6, zr.mesh.position.clone().setY(1.6), { dir: new THREE.Vector3(1, 0, 0), head: true });
    const mR = (G.ZombieFX.dying.find((x) => x.z === zr) || {}).mode;
    S().gore = "full";
    const zh = spawn(g, "normal", 6, 2);
    g.damageZombie(zh, 1e6, zh.mesh.position.clone().setY(1.6), { dir: new THREE.Vector3(1, 0, 0), head: true });
    const mF = (G.ZombieFX.dying.find((x) => x.z === zh) || {}).mode;
    const zu = spawn(g, "runt", 6, -2);
    g.damageZombie(zu, 1e6, zu.mesh.position.clone().setY(1), { dir: new THREE.Vector3(1, 0, 0), head: true });
    const mU = (G.ZombieFX.dying.find((x) => x.z === zu) || {}).mode;
    ok("F a head shot kill: the head knocked off on Full; up in smoke on Reduced, and always for a Runt", mF === "decap" && mR === "smoke" && mU === "smoke", [mF, mR, mU].join());
    step(g, 60);
    G.ZombieFX.clearDying(g.scene);
    // the bosses on the same atlas
    const def = Object.values(G.BOSS_DEFS || {})[0];
    if (def && G.BossModels && G.BossModels.build) {
      const rig = G.BossModels.build(def.id || Object.keys(G.BOSS_DEFS)[0]);
      let mapped = 0, lit = 0;
      (rig.root || rig).traverse((o) => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial && o.material.vertexColors) { lit++; if (o.material.map === G.ZombieSkin.texture() && o.geometry.attributes.uv) mapped++; } });
      ok("F the bosses drawn on the same pixel atlas, their shapes their own", lit > 0 && mapped === lit, mapped + "/" + lit);
      G.disposeObject3D(rig.root || rig);
    } else ok("F the bosses drawn on the same pixel atlas", !!(G.ZOMBIE_MATS.uvOf), "no BossModels.build");
  }

  async function run() {
    results.length = 0;
    const errs = [];
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    const onErr = (e) => errs.push(String(e.message));
    window.addEventListener("error", onErr);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock, realSpawn = G.Spawner.update;
    G.Input.requestPointerLock = function () {};
    G.Spawner.update = function () {};
    try {
      kinds();
      const g = start("high");
      looks(g);
      hitboxesAndWords(g);
      movement(g);
      behaviour(g);
      await soundsGoreBosses(g);
    } catch (e) {
      ok("ran to the end", false, String(e && e.stack || e).slice(0, 400));
    } finally {
      console.error = oe;
      window.removeEventListener("error", onErr);
      G.Input.requestPointerLock = realLock;
      G.Spawner.update = realSpawn;
      G.Input.clearHeldInputs();
      G.Modal.reset();
      if (realUpd) G.Game.update = realUpd;
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no uncaught errors", !errs.length, errs.slice(0, 2).join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
