// Dev-only (not shipped). The expansion's round 5: attachments, skins, unlocks.
//   A  the tables: thirteen attachments, each a sidegrade, the spec's numbers;
//      a table for each family; eight base skins and learning's own; the unlocks
//   B  the save: a new one, one from before, a broken one mended, two merged,
//      filed under progress
//   C  what they do: the magazine and reload on the gun, the rest on its sheet,
//      the rounds in all unchanged, the Stat Card; when they can be changed
//   D  the models: every gun with every attachment it takes; the iron sights
//      make way for an optic; skins keep the accent and what glows
//   E  in play: every gun x every optic it takes, aimed: the optic's middle on
//      the middle of the screen, its zoom, a scope's ring; the drift (Reduce
//      Motion); the laser's dot; the kick; the flash
//   F  the suppressed family by numbers (section 5's way); the shot's path:
//      no far echo, no rolling tail; a brake +3 dB; the bolt
//   G  unlocks from simulated learning: each threshold, for good, a toast, the
//      AWARDS page, the learning record never written; hints count for nothing
//   H  the menus: the Armory's button and window (keys, controller), the
//      shop's row, four languages
//   I  the flag: off is the guns as they were
// Load it into the game (in the lobby), then:
//   const r = await G.Round34Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round34Test = (function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-6 : e);
  const db = (d) => Math.pow(10, d / 20), dbOf = (r) => 20 * Math.log10(r || 1e-12);
  const peak = (a, from, to) => { let m = 0; for (let i = from || 0; i < Math.min(a.length, to || a.length); i++) m = Math.max(m, Math.abs(a[i])); return m; };

  async function run() {
    const results = [], errs = [], numbers = {};
    const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info: info === undefined ? "" : info }); window._t34 = results.length + " " + name; };
    const onErr = (e) => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    const g = G.Game, A = G.Attach, AT = G.ATTACHMENTS, K = G.CONFIG.attach, $ = (id) => document.getElementById(id);
    const backup = JSON.stringify(G.save), lang0 = G.lang, spawn0 = G.Spawner.update, lock0 = G.Input.requestPointerLock;
    const gainDb0 = G.CONFIG.audio.gunGainDb, pitch0 = G.CONFIG.audio.gunPitch;
    const real = g._update0 || g.update;
    const I = G.Input;
    G._missingKeys = {};
    G.Input.requestPointerLock = () => {};
    const step = (n, dt) => { for (let i = 0; i < n; i++) real.call(g, dt || 1 / 60); };
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
    const give = (id) => {
      const p = g.player, d = G.WEAPON_DEFS[id];
      if (!p.weaponLevels[id]) p.weaponLevels[id] = { dmg: 1, rate: 1, mag: 1 };
      p.ammo[id] = { mag: d.magSize, reserve: 200 };
      p.gunSlots = [id]; p.currentSlot = 1;
      if (g.wsm) { g.wsm.requestSwitch(); g.wsm.finishSwitch(); }
      g.buildWeaponViewModel(id);
      step(1);
    };
    const lensOf = (grp) => { let L = null; grp.traverse((o) => { if (o.userData && o.userData.lens) L = o; }); return L; };
    const defs = Object.values(G.WEAPON_DEFS);
    const unlockAll = () => { const D = A.data(); G.ATTACH_UNLOCKS.forEach((u) => { D.unlocked[u.id] = 1; }); A.apply(); };

    try {
      await wait(0); // ---------------- A: the tables ----------------
      {
        const spec = { reddot: "optic", holo: "optic", x2: "optic", x4: "optic", x8: "optic", suppressor: "muzzle", compensator: "muzzle", brake: "muzzle", extended: "mag", fastmag: "mag", vgrip: "grip", agrip: "grip", laser: "grip" };
        ok("A thirteen attachments, each in the slot the spec puts it", Object.keys(AT).length === 13 && Object.keys(spec).every((k) => AT[k] && AT[k].slot === spec[k]));
        const better = { zoom: (v) => v > 1, ads: (v) => v < 1, sway: (v) => v < 1, range: (v) => v > 1, recoilV: (v) => v < 1, recoilH: (v) => v < 1, mag: (v) => v > 1, reload: (v) => v < 1, hip: (v) => v < 1, flash: (v) => v < 1 };
        const worse = { zoom: (v) => v < 1, ads: (v) => v > 1, sway: (v) => v > 1, range: (v) => v < 1, recoilV: (v) => v > 1, recoilH: (v) => v > 1, mag: (v) => v < 1, reload: (v) => v > 1, hip: (v) => v > 1, flash: (v) => v > 1 };
        const sides = (a) => { let b = 0, w = 0; Object.keys(better).forEach((k) => { if (a[k] != null) { if (better[k](a[k])) b++; if (worse[k](a[k])) w++; } }); if (a.sound === "suppressed") b++; if (a.loud > 0) w++; if (a.laser) b++; return { b, w }; };
        const one = Object.keys(AT).filter((k) => k !== "laser" && !(sides(AT[k]).b >= 1 && sides(AT[k]).w >= 1));
        ok("A every one a sidegrade: something better, something worse (the laser: only from the hip, nothing aimed)", !one.length && AT.laser.ads == null && AT.laser.zoom == null, one.join());
        ok("A the spec's numbers", AT.suppressor.range === 0.9 && AT.suppressor.flash === 0 && AT.suppressor.sound === "suppressed" && AT.compensator.recoilV === 0.8 && AT.compensator.flash === 1.05
          && AT.brake.recoilV === 0.85 && AT.brake.recoilH === 0.85 && AT.brake.loud > 0 && AT.extended.mag === 1.5 && AT.extended.reload === 1.1 && AT.extended.ads === 1.05
          && AT.fastmag.reload === 0.8 && AT.fastmag.mag === 0.9 && AT.vgrip.recoilV === 0.85 && AT.vgrip.ads > 1 && AT.agrip.ads < 1 && AT.laser.hip === 0.75 && AT.laser.laser);
        ok("A the optics: more zoom, slower to aim, more drift, step by step", ["reddot", "holo", "x2", "x4", "x8"].every((k, i, l) => i === 0 || (AT[k].zoom > AT[l[i - 1]].zoom && AT[k].ads > AT[l[i - 1]].ads && AT[k].sway > AT[l[i - 1]].sway)) && AT.x2.zoom === 2 && AT.x4.zoom === 4 && AT.x8.zoom === 8);
        const fams = Object.keys(G.ATTACH_FAMILIES);
        ok("A a table for each of the eight families, naming only attachments of the right slot", fams.length === 8 && ["pistol", "smg", "rifle", "lmg", "shotgun_pump", "shotgun_semi", "sniper_bolt", "special"].every((f) => fams.includes(f))
          && fams.every((f) => G.ATTACH_SLOTS.every((s) => (G.ATTACH_FAMILIES[f][s] || []).every((id) => AT[id] && AT[id].slot === s))));
        ok("A every gun's family is in it", defs.every((d) => G.ATTACH_FAMILIES[A.familyOf(d)]));
        const W = G.WEAPON_DEFS;
        ok("A a gun with a scope of its own takes no other; the peep and the frame do", A.allowed(W.vital_sign, "optic").length === 0 && A.allowed(W.honor_roll, "optic").length === 0
          && A.allowed(W.sniper, "optic").includes("x8") && A.allowed(W.overwatch, "optic").includes("x4"), defs.filter((d) => A.ownScope(d)).map((d) => d.id).join());
        ok("A the 8x goes on the sniper rifles only", defs.filter((d) => A.allowed(d, "optic").includes("x8")).every((d) => A.familyOf(d) === "sniper_bolt"));
        const S = G.GUN_SKINS;
        ok("A eight base colour sets from the measured palettes, and the factory look", Object.keys(S).filter((k) => S[k].base && k !== "factory").length === 8 && Object.keys(S).filter((k) => S[k].palette).every((k) => G.GunRef.PALETTES[S[k].palette]) && S.factory.base);
        ok("A Lexicon (ink letters), Scholar Gold, one for each level, a camouflage for each topic", S.lexicon.pattern === "letters" && S.scholarGold.on.includes("main") && S.level1 && S.level2 && S.level3
          && G.WORD_TOPICS.every((t) => S["camo_" + G.topicSlug(t)] && S["camo_" + G.topicSlug(t)].pattern === "camo"));
        const U = G.ATTACH_UNLOCKS, u = (id) => U.find((x) => x.id === id) || {};
        ok("A unlocks: words remembered 25 / 50 / 100 / 250 / 500", [["reddot", 25], ["extended", 50], ["x4", 100], ["suppressor", 250], ["skin:scholarGold", 500]].every(([id, n]) => u(id).kind === "remembered" && u(id).n === n));
        ok("A unlocks: Daily Review 3 / 7 / 14 / 30 days", [["holo", 3], ["fastmag", 7], ["agrip", 14], ["skin:lexicon", 30]].every(([id, n]) => u(id).kind === "streak" && u(id).n === n));
        ok("A unlocks: families 5 / 15, spellings 20, four bosses, each level's notes, each topic 80%", u("compensator").n === 5 && u("brake").n === 15 && u("compensator").kind === "families" && u("laser").kind === "spellRun" && u("laser").n === 20
          && u("x8").kind === "bosses" && u("x8").n === 4 && ["level1", "level2", "level3"].every((l) => u("skin:" + l).kind === "notes") && G.WORD_TOPICS.every((t) => u("skin:camo_" + G.topicSlug(t)).share === 0.8));
        ok("A every attachment free or unlocked by learning; nothing unlocks what is not there", Object.keys(AT).every((k) => G.ATTACH_FREE.includes(k) || U.some((x) => x.id === k)) && U.every((x) => (x.id.indexOf("skin:") === 0 ? S[x.id.slice(5)] : AT[x.id])));
      }

      await wait(0); // ---------------- B: the save ----------------
      {
        const d0 = G.defaultSave();
        ok("B a new save: the set, empty", d0.attach && d0.attach.v === 1 && !Object.keys(d0.attach.unlocked).length && !Object.keys(d0.attach.loadout).length);
        const fx = await fetch("/tests/fixtures/save-v-current.json?v=" + Date.now()).then((r) => r.json());
        const old = G.SaveManager.toSave(JSON.parse(JSON.stringify(fx)));
        ok("B a save from before attachments: the empty set, the rest as it was", old.attach && old.attach.v === 1 && !Object.keys(old.attach.unlocked).length && JSON.stringify(old.unlockedWeapons) === JSON.stringify(fx.unlockedWeapons || old.unlockedWeapons));
        const junk = A.normalize({ unlocked: { reddot: 5, bogus: 1, "skin:lexicon": 3, "skin:nope": 2 }, loadout: { pistol: { optic: "x8", muzzle: "reddot", mag: "extended", skin: "nope" }, nope: { optic: "reddot" } },
          family: { smg: { grip: "vgrip" }, nofam: {} }, forms: { x: ["a", 5] }, spellBest: -3, bossesBest: "7" });
        ok("B a broken one mended: unknown ids gone, each slot takes only its own", junk.unlocked.reddot === 5 && !junk.unlocked.bogus && junk.unlocked["skin:lexicon"] === 3 && !junk.unlocked["skin:nope"]
          && junk.loadout.pistol.optic === "x8" && !junk.loadout.pistol.muzzle && junk.loadout.pistol.mag === "extended" && !junk.loadout.pistol.skin && !junk.loadout.nope && junk.family.smg.grip === "vgrip" && !junk.family.nofam
          && junk.forms.x.join() === "a" && junk.spellBest === 0 && junk.bossesBest === 7);
        ok("B ...and on a gun that cannot take it, it is not worn", (() => { const pv = A.preview; A.preview = null; const keep = G.save.attach; const j2 = JSON.parse(JSON.stringify(junk)); j2.unlocked.extended = 1; G.save.attach = j2; const L = A.loadoutOf(G.WEAPON_DEFS.pistol); G.save.attach = keep; A.preview = pv; return !L.optic && L.mag === "extended"; })());
        ok("B filed under progress, and back", G.SaveManager.SECTIONS.progress.includes("attach") && (() => { const s = G.defaultSave(); s.attach.unlocked.holo = 4; const back = G.SaveManager.fromDoc(G.SaveManager.toDoc(s)); return back.attach && back.attach.unlocked.holo === 4; })());
        const a = G.defaultSave(), b = G.defaultSave();
        a.attach = A.normalize({ unlocked: { reddot: 10 }, loadout: { pistol: { optic: "reddot" } }, forms: { abc: ["x"] }, spellBest: 5 });
        b.attach = A.normalize({ unlocked: { reddot: 8, holo: 9 }, loadout: { pistol: { mag: "extended" }, smg: { grip: "vgrip" } }, forms: { abc: ["y"] }, bossesBest: 3 });
        const m = G.SaveFile.merge(a, b);
        ok("B two saves merged: all unlocked (the earlier day), this device's choices first, the forms together, the best runs",
          m.attach.unlocked.reddot === 8 && m.attach.unlocked.holo === 9 && m.attach.loadout.pistol.optic === "reddot" && !m.attach.loadout.pistol.mag && m.attach.loadout.smg.grip === "vgrip"
          && m.attach.forms.abc.slice().sort().join() === "x,y" && m.attach.spellBest === 5 && m.attach.bossesBest === 3, JSON.stringify(m.attach).slice(0, 200));
      }

      await wait(0); // ---------------- C: what they do ----------------
      {
        A.preview = null;
        G.save.attach = A.normalize(null); A.apply();
        const W = G.WEAPON_DEFS, pd = W.pistol, base = pd.attachBase.magSize, rb = pd.attachBase.reloadTime;
        const s0 = G.GunStats.of(pd), ads0 = s0.adsTime, hip0 = s0.hipSpread, f0 = s0.falloffStart;
        ok("C nothing fitted: the gun as its sheet has it", pd.magSize === base && pd.reloadTime === rb && !Object.keys(A.loadoutOf(pd)).length);
        ok("C refused: one not unlocked, one that does not fit", !A.set("pistol", "optic", "reddot") && !A.set("pistol", "optic", "x8") && !A.set("pistol", "grip", "vgrip"));
        ok("C free from the start: the 2x scope and the vertical grip", A.set("smg", "optic", "x2") && A.set("smg", "grip", "vgrip"));
        unlockAll();
        A.set("pistol", "mag", "extended");
        const mags = G.GunStats.of(pd).reserveMags;
        ok("C an extended magazine: half as many rounds again, a slower reload, aiming 5% slower", pd.magSize === Math.round(base * 1.5) && pd.reloadTime === Math.round(rb * 1.1) && near(G.GunStats.of(pd).adsTime, Math.round(ads0 * 1.05 * 100) / 100, 0.011), pd.magSize + " " + G.GunStats.of(pd).adsTime);
        ok("C ...the same rounds in all: the reserve counts the old magazine", G.GunStats.reserve(pd, pd.magSize) === base * mags && G.GunStats.of(pd).reserve === base * mags);
        A.set("pistol", "mag", "fastmag");
        ok("C a fast mag: a tenth fewer, a fifth quicker", pd.magSize === Math.round(base * 0.9) && pd.reloadTime === Math.round(rb * 0.8));
        A.set("pistol", "mag", null);
        ok("C taken off: as it was", pd.magSize === base && pd.reloadTime === rb);
        A.set("pistol", "muzzle", "suppressor"); A.set("pistol", "grip", "laser");
        const s1 = G.GunStats.of(pd);
        ok("C a suppressor: range -10%; a laser: hip spread -25% (on the sheet the game reads)", s1.falloffStart === Math.round(f0 * 0.9) && near(s1.hipSpread, Math.round(hip0 * 0.75 * 10000) / 10000, 1e-4), s1.falloffStart + " " + s1.hipSpread);
        const sm = W.smg, rv0 = (() => { const pv = A.preview; A.preview = { smg: {} }; A.apply(); const v = G.GunStats.of(sm).recoilV; A.preview = pv; A.apply(); return v; })();
        A.setAll("smg", { muzzle: "compensator", grip: "vgrip" });
        ok("C a compensator and a vertical grip: the kick x0.8 x0.85", near(G.GunStats.of(sm).recoilV, Math.round(rv0 * 0.8 * 0.85 * 10000) / 10000, 2e-4), rv0 + " -> " + G.GunStats.of(sm).recoilV);
        const card = G.StatCard.html(pd), div = document.createElement("div"); div.innerHTML = card;
        ok("C the Stat Card: what is fitted and what it does", div.querySelectorAll(".statc-att .att-chip").length === 2 && div.querySelector(".statc-atteff").textContent.includes(G.T("atteff.hip", { v: "-25%" })) && div.textContent.includes(G.T("att.suppressor.name")));
        A.setAll("pistol", { optic: "reddot" }, true);
        ok("C a family's default: every gun of it with no choice of its own", !A.data().loadout.pistol && A.loadoutOf(W.nut_cracker).optic === "reddot" && A.loadoutOf(pd).optic === "reddot");
        A.set("nut_cracker", "optic", null);
        ok("C ...one gun's own choice over it", A.loadoutOf(W.nut_cracker).optic === undefined && A.loadoutOf(pd).optic === "reddot");
        const st0 = g.state;
        g.state = "GAMEPLAY"; const inRun = A.editable();
        g.state = "PAUSE"; const paused = A.editable();
        g.state = "SHOP"; const shop = A.editable(); K.changeInShop = false; const shopOff = A.editable(); K.changeInShop = true;
        g.state = st0;
        ok("C changed between runs and in the shop; not in play, not paused; the shop can be closed to it", A.editable() && !inRun && !paused && shop && !shopOff);
      }

      await wait(0); // ---------------- D: the models ----------------
      {
        const bad = [];
        let n = 0, extra = 0;
        for (const d of defs) {
          A.preview = { [d.id]: {} };
          const b = G.buildWeaponMesh(d, { loadout: true }), BA = b.userData.anchors, baim = b.userData.aim;
          let bm = 0; b.traverse((o) => { if (o.isMesh) bm++; });
          G.disposeObject3D(b);
          const full = {};
          for (const s of G.ATTACH_SLOTS) for (const id of A.allowed(d, s)) {
            A.preview = { [d.id]: { [s]: id } };
            full[s] = id;
            const grp = G.buildWeaponMesh(d, { loadout: true }), An = grp.userData.anchors, a = AT[id].model;
            n++;
            let sights = 0; grp.traverse((o) => { if (o.userData && o.userData.sight) sights++; });
            if (s === "optic") {
              const L = lensOf(grp), aim = grp.userData.aim;
              if (!L || L.userData.lens !== (a.kind === "scope" ? "scope" : a.kind)) bad.push(d.id + "+" + id + ": its reticle");
              if (sights) bad.push(d.id + "+" + id + ": iron sights left");
              if (!aim || !(aim.eye > 0)) bad.push(d.id + "+" + id + ": no aim");
            }
            if (s === "muzzle" && !(An.muzzle.z < BA.muzzle.z - (a.len - 0.0125))) bad.push(d.id + "+" + id + ": muzzle not out");
            if (s === "mag" && id === "extended" && grp.userData.magKind !== "tube" && grp.userData.parts.mag && !(An.magBottom.distanceTo(BA.magBottom) > a.h * 0.9)) bad.push(d.id + "+" + id + ": magazine");
            if (s === "grip" && id === "vgrip" && !(An.fore.y < BA.fore.y - 0.02)) bad.push(d.id + "+" + id + ": the hand");
            if (s === "grip" && id === "laser" && !An.laser) bad.push(d.id + "+" + id + ": the laser");
            G.disposeObject3D(grp);
          }
          // all at once, and a skin: a few draw calls more, no more
          A.preview = { [d.id]: Object.assign({ skin: "scholarGold" }, full) };
          const all = G.buildWeaponMesh(d, { loadout: true });
          let am = 0; all.traverse((o) => { if (o.isMesh) am++; });
          extra = Math.max(extra, am - bm);
          G.disposeObject3D(all);
        }
        numbers.models = n;
        ok("D every gun with every attachment it takes: built, in its place (" + n + ")", !bad.length, bad.slice(0, 6).join(" | "));
        ok("D a gun with everything fitted: three draw calls more at most", extra <= 3, extra);
        // skins: the raw boxes, before they are merged
        const kept = [];
        ["pistol", "scrap_spitter", "last_stand", "shotgun", "railgun"].forEach((id) => {
          const d = G.WEAPON_DEFS[id];
          if (!d) return;
          ["scholarGold", "lexicon", "whiteBlack", "camo_health", "level3"].forEach((sk) => {
            const f = G.buildWeaponModel(d), s = G.buildWeaponModel(d);
            G.GunSkins.apply(s, sk);
            const cf = [], cs = [];
            f.traverse((o) => { if (o.isMesh) cf.push(o); }); s.traverse((o) => { if (o.isMesh) cs.push(o); });
            let changed = 0;
            cf.forEach((o, i) => {
              const m0 = o.material, m1 = cs[i].material, role = m0.userData && m0.userData.role;
              if (m0.isMeshBasicMaterial && m0.color.getHex() !== m1.color.getHex()) kept.push(id + "/" + sk + ": a glow changed");
              if (role === "accent" && m0.color.getHex() !== m1.color.getHex()) kept.push(id + "/" + sk + ": the accent changed");
              if (role && role !== "accent" && m0.color.getHex() !== m1.color.getHex()) changed++;
            });
            if (!changed) kept.push(id + "/" + sk + ": nothing repainted");
            G.disposeObject3D(f); G.disposeObject3D(s);
          });
        });
        ok("D skins repaint the gun and keep its accent and everything that glows", !kept.length, kept.slice(0, 5).join(" | "));
        const lx = G.buildWeaponModel(G.WEAPON_DEFS.pistol);
        G.GunSkins.apply(lx, "lexicon");
        let letters = 0; lx.traverse((o) => { if (o.isMesh && o.material.userData.skin === "letters") letters++; });
        G.disposeObject3D(lx);
        ok("D Lexicon: ink letters on its paper; the tiles drawn", letters > 0 && G.GunSkin.SURF.letters === 5 && G.GunSkin.SURF.camo === 6);
        A.preview = { pistol: { optic: "reddot" } };
        G.ATTACH_ADS["pistol:reddot"] = { y: 0.123, z: 0.045, eye: 0.5 };
        const tuned = G.buildWeaponMesh(G.WEAPON_DEFS.pistol, { loadout: true });
        ok("D a position tuned in the Weapon Lab is the one used", tuned.userData.aim.y === 0.123 && tuned.userData.aim.eye === 0.5);
        delete G.ATTACH_ADS["pistol:reddot"];
        G.disposeObject3D(tuned);
      }

      await wait(0); // ---------------- E: in play ----------------
      {
        startLevel(1);
        g.yawObject.rotation.y = 0; g.pitchObject.rotation.x = 0;
        const offs = [], wrong = [], blocked = [];
        let worst = 0, n = 0;
        for (const d of defs) {
          for (const op of A.allowed(d, "optic")) {
            A.preview = { [d.id]: { optic: op } }; A.apply();
            give(d.id);
            I.aimDown = true; g.aimP = 1; step(3);
            const L = lensOf(g.weaponViewGroup);
            g.weaponViewGroup.updateMatrixWorld(true); g.camera.updateMatrixWorld();
            const v = new THREE.Vector3(); L.getWorldPosition(v); v.project(g.camera);
            const off = Math.max(Math.abs(v.x), Math.abs(v.y));
            worst = Math.max(worst, off); n++;
            if (off > 0.04) offs.push(d.id + "+" + op + " " + v.x.toFixed(3) + "," + v.y.toFixed(3));
            const ring = A.magnified(d), shown = !$("hud-scope").classList.contains("hidden");
            // nothing of the gun between the eye and a red dot's or a holo's window
            if (!ring) {
              const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3(), lp = new THREE.Vector3();
              if (rc.layers) rc.layers.enableAll();
              g.camera.getWorldPosition(o); g.camera.getWorldDirection(dir); L.getWorldPosition(lp);
              rc.set(o, dir); rc.near = 0.01; rc.far = 3;
              // (in front of the window or seen through it: either is in the way;
              // the raycaster meets hidden things too -- the muzzle flash between shots)
              const seen = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
              const hit = rc.intersectObject(g.weaponViewGroup, true).filter((h) => !(h.object.userData && h.object.userData.lens) && seen(h.object))[0];
              if (hit) blocked.push(d.id + "+" + op + " " + hit.distance.toFixed(2) + "/" + o.distanceTo(lp).toFixed(2));
            }
            if (Math.abs(g.camera.fov - A.aimFov(d, g)) > 0.6) wrong.push(d.id + "+" + op + " fov " + g.camera.fov.toFixed(1));
            if (ring && (!shown || $("hud-scope").dataset.sides !== "8" || g.weaponViewGroup.visible)) wrong.push(d.id + "+" + op + " ring");
            if (!ring && (shown || !g.weaponViewGroup.visible)) wrong.push(d.id + "+" + op + " in view");
            I.aimDown = false; g.aimP = 0; step(1);
          }
        }
        numbers.ads = { combos: n, worst: +worst.toFixed(4) };
        ok("E every gun x every optic it takes, aimed: the optic's middle on the screen's (within 2%, " + n + ")", !offs.length && n > 100, offs.slice(0, 6).join(" | ") + " worst " + worst.toFixed(3));
        ok("E ...through the optic's zoom; a magnified one: its octagon ring, the gun put away; a red dot or holo: the gun in view", !wrong.length, wrong.slice(0, 6).join(" | "));
        ok("E ...and nothing of the gun in front of a red dot's or a holo's window", !blocked.length, blocked.slice(0, 8).join(" | "));
        A.preview = { sniper: { optic: "x8" }, pistol: { optic: "reddot" } };
        const z8 = A.aimFov(G.WEAPON_DEFS.sniper, g), zr = A.aimFov(G.WEAPON_DEFS.pistol, g);
        ok("E the zoom: a red dot a little, the scopes by their power", near(z8, 2 * Math.atan(Math.tan(g.baseFov * Math.PI / 360) / 8) * 180 / Math.PI, 0.01) && zr < g.aimFov && zr > g.aimFov * 0.85, z8.toFixed(2) + " " + zr.toFixed(2));
        // the drift
        A.preview = { sniper: { optic: "x8" } }; A.apply(); give("sniper");
        const drift = () => { let m = 0; I.aimDown = true; g.aimP = 1; for (let i = 0; i < 150; i++) { step(1); m = Math.max(m, Math.abs(g.camera.rotation.y)); } return m; };
        const want = (AT.x8.sway - 1) * K.sway.amp * 0.8;
        const d1 = drift();
        const rm0 = G.save.settings.reduceMotion; G.save.settings.reduceMotion = true;
        const d2 = drift();
        G.save.settings.reduceMotion = rm0;
        I.aimDown = false; g.aimP = 0; step(2);
        ok("E aimed through the 8x the view drifts as far as set; Reduce Motion a third of it; not aimed, none", d1 > want * 0.6 && d1 <= want * 1.001 && near(d2 / d1, K.sway.reduced, 0.06) && Math.abs(g.camera.rotation.y) < 1e-9, [d1.toFixed(5), d2.toFixed(5), want.toFixed(5)].join(" "));
        // the laser
        A.preview = { pistol: { grip: "laser" } }; A.apply(); give("pistol");
        I.aimDown = false; g.aimP = 0; step(2);
        const P = new THREE.Vector3(), D = new THREE.Vector3(); g.camera.getWorldPosition(P); g.camera.getWorldDirection(D);
        const far = g.wallDistance(P, D, K.laserRange), dd = A.dot && A.dot.position.distanceTo(P);
        const hipOn = !!(A.dot && A.dot.visible && A.dot.parent === g.scene);
        g.aimP = 1; I.aimDown = true; step(2);
        const aimOff = !A.dot.visible;
        I.aimDown = false; g.aimP = 0;
        A.preview = { pistol: {} }; A.apply(); step(2);
        ok("E a laser: its dot where the gun points from the hip, on the wall; gone aimed; none without one", hipOn && (far >= K.laserRange - 0.01 || near(dd, far - 0.03, 0.08)) && aimOff && !A.dot.visible, [far.toFixed(2), dd && dd.toFixed(2)].join(" "));
        // the kick
        const kickOf = (L) => { A.preview = { smg: L }; A.apply(); give("smg"); const p0 = g.pitchObject.rotation.x; g.recoilKick(G.WEAPON_DEFS.smg); const k = g.pitchObject.rotation.x - p0; g.pitchObject.rotation.x = 0; g.recoilRecover = 0; return k; };
        const k0 = kickOf({}), k1 = kickOf({ muzzle: "compensator" }), k2 = kickOf({ muzzle: "brake", grip: "vgrip" });
        ok("E the kick: a compensator x0.8 up, a brake and a grip x0.85 x0.85", near(k1 / k0, 0.8, 0.01) && near(k2 / k0, 0.85 * 0.85, 0.01), [k0, k1, k2].map((x) => x.toFixed(5)).join(" "));
        // the flash
        A.preview = { pistol: { muzzle: "suppressor" } }; A.apply(); give("pistol");
        G.FX.hideFlash && G.FX.hideFlash();
        G.FX.onFire({ weaponId: "pistol", family: "pistol" });
        const fl = G.FX._flash.mesh;
        const none = !fl || !fl.visible;
        A.preview = { pistol: {} }; A.apply(); give("pistol");
        G.FX.onFire({ weaponId: "pistol", family: "pistol" });
        const shown = !!(G.FX._flash.mesh && G.FX._flash.mesh.visible);
        ok("E a suppressor: no flash at all; a compensator: +5%; none fitted: the flash", none && shown && A.flash(G.WEAPON_DEFS.pistol) === 1 && (() => { A.preview = { pistol: { muzzle: "compensator" } }; return A.flash(G.WEAPON_DEFS.pistol) === 1.05; })());
        // a magazine made smaller in a run
        A.preview = { pistol: { mag: "extended" } }; A.apply(); give("pistol");
        const am = g.player.ammo.pistol, full = am.mag, res0 = am.reserve;
        A.preview = { pistol: { mag: "fastmag" } }; A.apply();
        ok("E a smaller magazine fitted in a run: what does not fit goes back to the reserve", am.mag === G.WEAPON_DEFS.pistol.magSize && am.reserve === res0 + (full - am.mag), full + " -> " + am.mag);
        A.preview = null; A.apply();
      }

      await wait(0); // ---------------- F: the suppressed family ----------------
      {
        if (G.Audio.unlock) G.Audio.unlock();
        for (let i = 0; i < 40 && !G.Audio.ctx; i++) await wait(50);
        if (!G.GunSoundCheck) await load("/tools/gun-sound-check.js?v=" + Date.now());
        const C = G.GunSoundCheck, SC = K.suppressed;
        const rows = [], badS = [];
        for (const id of ["pistol", "nut_cracker", "scrap_spitter", "void_principal", "sniper", "overwatch"]) {
          const def = G.WEAPON_DEFS[id], p = G.GunAudio.profile(def);
          if (!p.voice) { badS.push(id + ": no voice"); continue; }
          const buf = await G.GunVoice.render(p.voice, { shots: [0.004], k: 1, tail: false, sampleRate: 48000, seed: 1000 });
          const mv = p.voice.mech && p.voice.mech.length ? p.voice.mech : A.familyOf(def) === "sniper_bolt" ? null : SC.mechDefault;
          const mech = mv ? await G.GunVoice.render({ mech: mv }, { shots: [0.004], k: 1, tail: false, sampleRate: 48000, seed: 1000 }) : null;
          const sb = A.suppressBuffer(buf, def, mech, { parts: true });
          const mk = (arr) => { const b = G.Audio.ctx.createBuffer(1, arr.length, 48000); b.getChannelData(0).set(arr); return b; };
          const N = C.measureShot(buf), Sh = C.measureShot(mk(sb.parts.shot)), Cr = C.measureShot(mk(sb.parts.crack));
          const x = buf.getChannelData(0), head = dbOf(peak(sb.parts.shot, 0, 2400) / peak(x));
          const hi = Sh.bandsT[4] + Sh.bandsT[5] + Sh.bandsT[6];
          const mechRel = mech ? (dbOf(peak(mech.getChannelData(0)) * db(SC.mechDb + SC.crackDb) / peak(sb.parts.shot, 0, 2400)) - dbOf(peak(mech.getChannelData(0)) / peak(x))) : null;
          const r = { id, head: +head.toFixed(2), crackCentroid: Math.round(Cr.cT), band: +Cr.bandsT[3].toFixed(1), hi: +hi.toFixed(1), d20: Sh.d20 == null ? null : +Sh.d20.toFixed(3), mech: mechRel == null ? null : +mechRel.toFixed(2), plainD20: N.d20 == null ? null : +N.d20.toFixed(3) };
          rows.push(r);
          if (!(r.head <= -11 && r.head >= -13)) badS.push(id + " head " + r.head);
          if (!(r.crackCentroid >= 800 && r.crackCentroid <= 2000)) badS.push(id + " centroid " + r.crackCentroid);
          if (!(r.band >= 60)) badS.push(id + " band " + r.band);
          if (!(r.hi <= 10)) badS.push(id + " above 2.5k " + r.hi);
          if (!(r.d20 != null && r.d20 <= 0.2)) badS.push(id + " -20 dB at " + r.d20);
          if (mech && !near(r.mech, 6, 0.5)) badS.push(id + " mech " + r.mech);
        }
        numbers.suppressed = rows;
        ok("F the suppressed shot by numbers: head -12 dB, its crack at 800-2000 Hz, little over 2.5 kHz, -20 dB within 0.2 s, the action 6 dB more forward", !badS.length, badS.join(" | ") || rows.map((r) => r.id + " " + r.head + "dB c" + r.crackCentroid + " b" + r.band + "% hi" + r.hi + "% d20 " + r.d20 + " m+" + r.mech).join(" ; "));
        // its path
        const def = G.WEAPON_DEFS.pistol;
        A.preview = { pistol: { muzzle: "suppressor" } }; A.apply();
        await G.GunAudio.render(def);
        const R = G.GunAudio.cache.get("pistol");
        await G.GunAudio.suppressedOf(def, R);
        for (let i = 0; i < 100 && !R.sbuf; i++) await wait(50);
        const t0 = G.GunAudio.tailShot, b0 = G.Audio.buffer;
        let tails = 0, last = null;
        G.GunAudio.tailShot = function () { tails++; };
        G.Audio.buffer = function (buf, o) { last = { buf, o }; return b0.call(this, buf, o); };
        G.CONFIG.audio.gunGainDb = 0; G.CONFIG.audio.gunPitch = 0;
        const sup0 = G.GunAudio.stats.suppressed || 0;
        G.GunAudio.shot(def, {});
        const s1 = last, tailsS = tails;
        A.preview = { pistol: {} }; A.apply();
        G.GunAudio.shot(def, {});
        const s2 = last, tailsP = tails - tailsS;
        const p = G.GunAudio.profile(def);
        ok("F a suppressed shot: its own buffers, the room's echo down, no far echo, no rolling tail", R.sbuf && R.sbuf.includes(s1.buf) && near(s1.o.rev, p.rev * 0.8 * K.suppressed.echo, 1e-6) && tailsS === 0 && tailsP === 1 && R.buffers.includes(s2.buf) && (G.GunAudio.stats.suppressed || 0) === sup0 + 1);
        const sm = G.WEAPON_DEFS.scrap_spitter;
        await G.GunAudio.render(sm);
        A.preview = { scrap_spitter: {} }; A.apply(); G.GunAudio.shot(sm, {}); const gPlain = last.o.gain;
        A.preview = { scrap_spitter: { muzzle: "brake" } }; A.apply(); G.GunAudio.shot(sm, {}); const gBrake = last.o.gain;
        ok("F a muzzle brake: the shot 3 dB louder", near(dbOf(gBrake / gPlain), AT.brake.loud, 0.05), dbOf(gBrake / gPlain).toFixed(2));
        const tone0 = G.Audio.tone;
        let seen = null;
        G.Audio.tone = function (o) { seen = o; };
        G.GunAudio.scaled(G.Audio, db(K.suppressed.mechDb + K.suppressed.crackDb)).tone({ freq: 800, dur: 0.02, gain: 0.2 });
        G.Audio.tone = tone0;
        ok("F a bolt worked behind a suppressor: 6 dB down (the shot 12)", seen && near(seen.gain, 0.2 * db(-6), 1e-6));
        G.GunAudio.tailShot = t0; G.Audio.buffer = b0;
        G.CONFIG.audio.gunGainDb = gainDb0; G.CONFIG.audio.gunPitch = pitch0;
        A.preview = null; A.apply();
      }

      await wait(0); // ---------------- G: unlocks from learning ----------------
      {
        if (g.state !== "MENU") g.quitToMainMenu();
        A.preview = null;
        G.save.attach = A.normalize(null);
        G.save.learn = JSON.parse(JSON.stringify(G.defaultSave().learn));
        G.save.achievements = {};
        const L = G.save.learn, today = G.Clock.today(), E = G.WordBank.entries();
        const boxes = (n, b, from) => { L.srs = {}; for (let i = 0; i < n; i++) L.srs[E[(from || 0) + i].id] = { b, due: today + 3, last: today, n: 3, lapses: 0 }; };
        ok("G nothing learnt: only what is free", !A.check({ quiet: true }).length && A.unlocked("x2") && A.unlocked("vgrip") && !A.unlocked("reddot") && A.unlocked("skin:blackSteel") && !A.unlocked("skin:lexicon"));
        boxes(24, 4);
        ok("G 24 words in box 4: not yet", !A.check({ quiet: true }).length);
        boxes(25, 4);
        const before = JSON.stringify(G.save.learn);
        const toast = $("hud-achievement-toast");
        const got = A.check();
        ok("G 25 remembered: the red dot", got.join() === "reddot" && A.unlocked("reddot"), got.join());
        ok("G ...the learning record not written", JSON.stringify(G.save.learn) === before);
        ok("G ...a toast, over the menu", toast && !toast.classList.contains("hidden") && toast.textContent.includes(G.T("att.reddot.name")) && toast.textContent.includes(G.T("unlock.title")));
        G.UI.renderAchievements();
        const item = $("achievements-content").querySelector('[data-unlock="reddot"]');
        ok("G ...and on the AWARDS page, with the rest and how far along each is", item && !item.classList.contains("locked") && $("achievements-content").querySelectorAll("[data-unlock]").length === G.ATTACH_UNLOCKS.length
          && $("achievements-content").querySelector('[data-unlock="extended"]').textContent.includes("(25/50)"));
        boxes(25, 3);
        ok("G for good: back in box 3, still unlocked; box 3 is not remembered", !A.check({ quiet: true }).length && A.unlocked("reddot"));
        boxes(500, 4);
        const many = A.check({ quiet: true }).filter((id) => id.indexOf("skin:camo_") !== 0);     // (500 words fill some topics too)
        ok("G 500: the extended magazine, the 4x, the suppressor, Scholar Gold", ["extended", "x4", "suppressor", "skin:scholarGold"].every((id) => many.includes(id)) && many.length === 4, many.join());
        G.save.attach = A.normalize(null);
        boxes(30, 6);
        ok("G Mastered words are remembered too", A.check({ quiet: true }).join() === "reddot");
        L.srs = {};
        G.save.attach = A.normalize(null);
        const streaks = [[2, ""], [3, "holo"], [7, "fastmag"], [14, "agrip"], [30, "skin:lexicon"]].map(([n, id]) => { L.daily.best = n; return A.check({ quiet: true }).join() === id; });
        ok("G the Daily Review's best run: 3 holo, 7 fast mag, 14 angled grip, 30 Lexicon", streaks.every(Boolean), streaks.join());
        // word families: the forms the game asks, each answered right
        G.save.attach = A.normalize(null); L.daily.best = 0;
        const fam = E.filter((e) => e.family && e.family.length && A.askable(e).length >= 2).slice(0, 16);
        L.srs = {};
        fam.forEach((e) => { L.srs[e.id] = { b: 4, due: today + 3, last: today, n: 3, lapses: 0 }; });
        const answer = (e, k) => A.askable(e).slice(0, k).forEach((f) => A.noteForm(G.WordBank.pairOf(e, "en", "th"), f));
        fam.slice(0, 4).forEach((e) => answer(e, 99));
        answer(fam[4], 1);
        const four = A.check({ quiet: true });
        answer(fam[4], 99);
        const five = A.check({ quiet: true });
        ok("G five word families complete (every form asked, answered right): the compensator", fam.length >= 15 && !four.length && five.join() === "compensator", fam.length + " " + four.join() + "/" + five.join());
        // a hinted answer counts for nothing
        const e16 = fam[15], pair16 = G.WordBank.pairOf(e16, "en", "th"), formsBefore = JSON.stringify(A.data().forms[e16.id] || []);
        G.Learning.answerWord(pair16, true, { assisted: true, form: A.askable(e16)[1] });
        ok("G ...a hinted answer neither moves a box nor counts a form", JSON.stringify(A.data().forms[e16.id] || []) === formsBefore && L.srs[e16.id].b === 4);
        fam.slice(5, 15).forEach((e) => answer(e, 99));
        ok("G fifteen: the muzzle brake", A.check({ quiet: true }).join() === "brake");
        G.save.attach = A.normalize(null); L.srs = {};
        fam.slice(0, 5).forEach((e) => { L.srs[e.id + "@th"] = { b: 6, due: today + 30, last: today, n: 9, lapses: 0 }; });
        ok("G learnt in another language (no forms asked): five Mastered count as five families", A.progress().families === 5);
        // a topic
        G.save.attach = A.normalize(null); L.srs = {};
        const topic = "Health", inTopic = E.filter((e) => e.topic === topic), need = Math.ceil(inTopic.length * 0.8);
        inTopic.slice(0, need - 1).forEach((e) => { L.srs[e.id] = { b: 4, due: today + 3, last: today, n: 3, lapses: 0 }; });
        const under = A.check({ quiet: true }).filter((x) => x.indexOf("camo") > 0);
        L.srs[inTopic[need - 1].id] = { b: 4, due: today + 3, last: today, n: 3, lapses: 0 };
        const over = A.check({ quiet: true }).filter((x) => x.indexOf("camo") > 0);
        ok("G 80% of a topic remembered: its camouflage, no other", !under.length && over.join() === "skin:camo_" + G.topicSlug(topic), inTopic.length + " " + over.join());
        // twenty spellings in a row, no hints
        G.save.attach = A.normalize(null); L.srs = {}; L.spellRun = 0;
        for (let i = 0; i < 19; i++) G.Learning.track(true, { skills: ["spelling"] });
        G.Learning.track(true, { skills: ["spelling"], assisted: true });
        const at19 = A.check({ quiet: true });
        G.Learning.track(true, { skills: ["spelling"] });
        ok("G twenty right spellings in a row, a hinted one between not counting: the laser", !at19.length && A.check({ quiet: true }).join() === "laser" && A.data().spellBest === 20);
        L.spellRun = 0;
        ok("G ...kept as the best, a broken run does not take it back", A.unlocked("laser") && A.progress().spellRun === 20);
        // a level's notes, four bosses
        G.save.attach = A.normalize(null);
        G.save.achievements.notes_level2 = true;
        ok("G every note of the hospital: its skin", A.check({ quiet: true }).join() === "skin:level2");
        A.onBoss(3);
        const b3 = A.check({ quiet: true });
        A.onBoss(4);
        ok("G four bosses in one run: the 8x scope", !b3.length && A.check({ quiet: true }).join() === "x8");
        // off
        G.save.attach = A.normalize(null); boxes(25, 4);
        G.CONFIG.expansion.attachments = false;
        const off = A.check({ quiet: true });
        G.CONFIG.expansion.attachments = true;
        ok("G the flag off: nothing unlocked anew", !off.length && !A.unlocked("reddot"));
        L.srs = {};
      }

      await wait(0); // ---------------- H: the menus ----------------
      {
        if (g.state !== "MENU") g.quitToMainMenu();
        G.save.attach = A.normalize(null);
        if (!G.save.unlockedWeapons.includes("pistol")) G.save.unlockedWeapons.push("pistol");
        G.UI._logReturnScreen = "screen-mainmenu";
        G.UI.renderWeaponLog(1);
        const log = $("weaponlog-content");
        const guns = log.querySelectorAll(".weaponlog-card:not(.locked) .stat-card:not(.melee)").length;
        ok("H the Armory: an Attachments button on every gun owned, none on the locked or the blades", log.querySelectorAll("[data-attach]").length === guns && guns > 0 && !log.querySelector(".weaponlog-card.locked [data-attach]"));
        log.querySelector('[data-attach="pistol"]').click();
        await wait(50);
        const opts = (id) => [...$(id).options].map((o) => o.value).join();
        ok("H its window: a list for each slot the gun takes, and its skin", !$("dialog").classList.contains("hidden") && ["att-optic", "att-muzzle", "att-mag", "att-grip", "att-skin"].every((id) => $(id)));
        ok("H ...only what is unlocked to choose; the rest with what unlocks it, how far along", opts("att-optic") === "" && opts("att-mag") === "" && /\(0\/25\)/.test($("dialog-body").textContent) && opts("att-skin").split(",").length === 9);
        $("att-optic").focus();
        G.Dialog.moveFocus(1);
        const keyed = document.activeElement && document.activeElement.id;
        const padItems = G.Pad ? G.Pad.focusables(G.Pad.scope()) : [];
        ok("H ...by keys (Tab, arrows: list to list) and by controller (the lists are in its reach)", keyed === "att-muzzle" && padItems.includes($("att-optic")) && padItems.includes($("att-skin")), keyed);
        G.Dialog.close();
        unlockAll();
        log.querySelector('[data-attach="pistol"]').click();
        await wait(50);
        $("att-optic").value = "reddot"; $("att-mag").value = "extended"; $("att-skin").value = "scholarGold"; $("att-family").checked = false;
        G.Dialog.choose(0);
        await wait(50);
        ok("H saved: the gun wears it; the Armory shows it on its card", A.data().loadout.pistol.optic === "reddot" && A.data().loadout.pistol.mag === "extended" && A.data().loadout.pistol.skin === "scholarGold"
          && $("weaponlog-content").querySelector('[data-attach="pistol"]').closest(".weaponlog-card").querySelector(".statc-att"));
        $("weaponlog-content").querySelector('[data-attach="pistol"]').click();
        await wait(50);
        $("att-family").checked = true;
        G.Dialog.choose(0);
        ok("H ...or for the whole family", !A.data().loadout.pistol && A.data().family.pistol.optic === "reddot");
        // in a run: the shop's row; elsewhere in it, no saving
        startLevel(1);
        log.querySelector && G.UI.renderWeaponLog(1);
        $("weaponlog-content").querySelector('[data-attach="pistol"]').click();
        await wait(50);
        const saveBtn = $("dialog-btns").querySelector("button");
        ok("H in play: the window shows, Save cannot be pressed, it says where", saveBtn.disabled && $("dialog-body").textContent.includes(G.T("att.onlyShop")));
        G.Dialog.close();
        g.openShop();
        await wait(50);
        const rows = $("shop-grid").querySelectorAll(".shop-attach [data-attach]");
        ok("H in the shop: a row for each gun carried, free", rows.length === g.player.gunSlots.length && $("shop-grid").textContent.includes(G.T("shop.attach")));
        rows[0].click();
        await wait(50);
        ok("H ...and there Save works", !$("dialog-btns").querySelector("button").disabled);
        G.Dialog.close();
        g.closeShop ? g.closeShop() : null;
        if (g.state !== "MENU") g.quitToMainMenu();
        // the languages
        const langs = {};
        for (const l of ["th", "zh", "fr", "en"]) {
          await new Promise((res) => G.setUILang(l, { done: res }));
          G._missingKeys = {};
          G.UI.renderWeaponLog(1);
          $("weaponlog-content").querySelector('[data-attach="pistol"]').click();
          await wait(30);
          const t = $("dialog-body").textContent;
          G.Dialog.close();
          G.UI.renderAchievements();
          langs[l] = { title: G.T("att.customize"), missing: Object.keys(G._missingKeys).length, text: t.length };
        }
        ok("H in all four languages: its own words, none missing", Object.values(langs).every((x) => !x.missing && x.text > 20) && new Set(Object.values(langs).map((x) => x.title)).size === 4, JSON.stringify(langs));
      }

      await wait(0); // ---------------- I: the flag ----------------
      {
        unlockAll();
        A.setAll("pistol", { optic: "reddot", mag: "extended", grip: "laser" });
        G.CONFIG.expansion.attachments = false;
        A.apply();
        const pd = G.WEAPON_DEFS.pistol, grp = G.buildWeaponMesh(pd, { loadout: true });
        const plain = !lensOf(grp) && pd.magSize === pd.attachBase.magSize && !Object.keys(A.loadoutOf(pd)).length && A.aimFov(pd, g) === (pd.scope || g.aimFov);
        G.disposeObject3D(grp);
        G.UI.renderWeaponLog(1);
        const noBtn = !$("weaponlog-content").querySelector("[data-attach]");
        G.UI.renderAchievements();
        const noAwards = !$("achievements-content").querySelector("[data-unlock]");
        G.CONFIG.expansion.attachments = true;
        A.apply();
        ok("I off: the guns as they were, no button, no list; the save keeps its choices", plain && noBtn && noAwards && A.loadoutOf(pd).optic === "reddot");
      }

      ok("no missing strings", !Object.keys(G._missingKeys || {}).length, Object.keys(G._missingKeys || {}).join());
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      G.CONFIG.expansion.attachments = true;
      K.changeInShop = true;
      G.CONFIG.audio.gunGainDb = gainDb0; G.CONFIG.audio.gunPitch = pitch0;
      A.preview = null;
      I.aimDown = false;
      G.Spawner.update = spawn0;
      g.update = real;
      G.Input.requestPointerLock = lock0;
      if (G.Dialog.isOpen()) G.Dialog.close();
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (g.state !== "MENU") g.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      A.apply();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    }
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
