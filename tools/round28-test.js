// Dev-only (not shipped). The overhaul, round 8: testing it all together,
// the graphics levels, accessibility, the help page.
//   A  the Quality Tier table (PROMPT section 8), level by level: particles
//      and bullet holes (G.FX.budget), the muzzle light, the voices, the
//      shots' variants, HRTF, occlusion, the reverb, the Main Menu's light
//      shafts, fog and dust (G.MenuScene.build), its depth of field (High
//      and Ultra only)
//   B  the caps under load: four hundred impacts on each level -- the
//      particles and holes alive never over the level's budget; sixty voices
//      asked for -- never more playing than the level allows
//   C  Accessibility: the rows (Camera Shake, Camera Recoil, Weapon Bob,
//      Muzzle Flash, Screen effects, Blood & Gore, Reduce Motion, UI scale,
//      HUD size, Captions, the volumes); the defaults; a save from before
//      and bad values; G.Access (shake, bob, the screen's effects, Reduce
//      Motion), the screen's effects in CSS (--fx-screen), the lamps steady
//      with Reduce Motion, a cutscene's shake and flash scaled
//   D  UI scale: the page's text 90 / 100 / 112%, the HUD laid out again
//   E  How to Play: the HUD, the inspect key, the ten zombies (their names
//      and first waves as the game has them), the explanations -- in four
//      languages
//   F  a phone's HUD (round 7's audit): the abilities' column follows the
//      bar even while paused, a full inventory's slots wrap, a long task
//      line wraps instead of losing its end
// Load it into the game (in the lobby), then:
//   const r = await G.Round28Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round28Test = (function () {
  const results = [], numbers = {};
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const TIERS = ["vlow", "low", "medium", "high", "vhigh"];
  // PROMPT section 8, the table as written (Very Low / Low / Medium (iPad) / High / Ultra)
  const SPEC = {
    vlow: { particles: 60, decals: 0, lightEvery: 0, reverb: "off", hrtf: 0, occ: [0, 0], voices: 16, variants: 2, beams: "none", dof: false },
    low: { particles: 120, decals: 24, lightEvery: 2, reverb: "delay", hrtf: 0, occ: [0, 0], voices: 20, variants: 3, beams: "none", dof: false },
    medium: { particles: 250, decals: 48, lightEvery: 1, reverb: "short", hrtf: 0, occ: [4, 4], voices: 24, variants: 4, beams: "simple", dof: false },
    high: { particles: 500, decals: 96, lightEvery: 1, reverb: "full", hrtf: 4, occ: [8, 8], voices: 32, variants: 6, beams: "full", dof: true },
    vhigh: { particles: 900, decals: 160, lightEvery: 1, reverb: "full+", hrtf: 8, occ: [10, 12], voices: 40, variants: 6, beams: "full", dof: true },
  };
  let realUpd = null;

  function startRun() {
    const g = G.Game;
    realUpd = realUpd || [g._update0, g._update, g._upd, g._r20, g.update].find((f) => typeof f === "function" && f.toString().length > 500);
    g.update = realUpd;
    G.save.tutorialDone = true;
    G.Input.requestPointerLock = function () {};
    g.startLevel(1);
    g.update = function () {};
    g.requiredKills = 1e9;
    g.clearZombies();
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    G.Input.clearHeldInputs();
    for (let i = 0; i < 3; i++) realUpd.call(g, 1 / 60);
    return g;
  }

  // ---------------- A: the table ----------------
  function tiers() {
    const S = G.save.settings, q0 = S.graphicsQuality, A = G.CONFIG.audio, F = G.CONFIG.fx;
    try {
      TIERS.forEach((q) => {
        const W = SPEC[q];
        S.graphicsQuality = q;
        const B = G.FX.budget();
        ok("A " + q + ": particles " + W.particles + ", bullet holes " + W.decals, B.particles === W.particles && B.decals === W.decals, B.particles + "/" + B.decals);
        ok("A " + q + ": the muzzle light " + (W.lightEvery ? "every " + W.lightEvery + " shot(s)" : "off"), F.flash.lightEvery[q] === W.lightEvery);
        ok("A " + q + ": the sound's level is the graphics level", G.Audio.tier() === q);
        ok("A " + q + ": " + W.voices + " voices, " + W.variants + " variants a gun", A.total[q] === W.voices && A.gunVariants[q] === W.variants);
        ok("A " + q + ": HRTF " + W.hrtf + ", occlusion " + W.occ.join(" Hz / "), A.hrtf[q] === W.hrtf && A.occlusion[q][0] === W.occ[0] && A.occlusion[q][1] === W.occ[1]);
        ok("A " + q + ": reverb " + W.reverb, A.reverbMode[q] === W.reverb);
        // the Main Menu's scene, built at this level
        const sc = G.MenuScene.build(q), L = sc.live;
        const shafts = (L.shafts || []).length, fog = (L.fog || []).length, dust = L.dust ? L.dust.geometry.attributes.position.count : 0;
        sc.dispose();
        numbers["menu " + q] = { shafts, fog, dust };
        const beams = shafts === 0 && fog === 0 ? "none" : shafts >= 5 && fog >= 2 ? "full" : "simple";
        ok("A " + q + ": the Main Menu's light shafts and fog " + W.beams, beams === W.beams, shafts + " shafts, " + fog + " fog layers, " + dust + " motes");
        const dofOK = W.dof ? /high/.test(q) : !(/high/.test(q));
        ok("A " + q + ": the Main Menu's depth of field " + (W.dof ? "on (WebGL 2)" : "off"), dofOK);
      });
      // depth of field: what the Main Menu itself decides on these levels
      S.graphicsQuality = "medium";
      ok("A Medium: the Main Menu draws without its post pass", !G.MainMenu.postOn());
      S.graphicsQuality = "vlow";
      ok("A Very Low: ...nor here", !G.MainMenu.postOn());
    } finally { S.graphicsQuality = q0; }
  }

  // ---------------- B: the caps under load ----------------
  function caps(g) {
    const S = G.save.settings, q0 = S.graphicsQuality;
    const V3 = THREE.Vector3;
    try {
      TIERS.forEach((q) => {
        S.graphicsQuality = q;
        g.applyGraphicsQuality();
        const p = g.yawObject.position;
        let maxP = 0, maxD = 0;
        for (let i = 0; i < 400; i++) {
          const a = (i / 400) * Math.PI * 2;
          G.FX.impact({ point: new V3(p.x + Math.sin(a) * 3, p.y - 0.8 + (i % 5) * 0.3, p.z - Math.cos(a) * 3), normal: new V3(-Math.sin(a), 0, Math.cos(a)), surface: ["concrete", "metal", "tile", "wood"][i % 4] });
          const st = G.FX.stats();
          maxP = Math.max(maxP, st.particles); maxD = Math.max(maxD, st.decals);
        }
        const st = G.FX.stats();
        numbers["fx " + q] = { maxParticles: maxP, budget: st.particleBudget, maxDecals: maxD, decalBudget: st.decalBudget };
        ok("B " + q + ": 400 impacts -- particles never over " + st.particleBudget, maxP <= st.particleBudget && maxP > 0, maxP + "/" + st.particleBudget);
        ok("B " + q + ": ...bullet holes never over " + st.decalBudget, maxD <= st.decalBudget && (st.decalBudget === 0 ? maxD === 0 : maxD > 0), maxD + "/" + st.decalBudget);
        G.FX.clear && G.FX.clear();
        // the voices: sixty asked for, of every kind
        const A = G.Audio;
        if (A.ctx) {
          A.stopAll(A.GAME_CATS.concat(["ui", "sfx", "ambient"]));
          const cats = ["weapons", "impact", "zombie", "steps", "sfx", "ui", "ambient"], got = [];
          let most = 0;
          for (let i = 0; i < 60; i++) {
            const v = A._voiceFor({ cat: cats[i % cats.length], prio: 1 + (i % 4), pos: { x: p.x + (i % 9), y: p.y, z: p.z } }, 5);
            if (v) got.push(v);
            most = Math.max(most, A.counts().total);
          }
          const tot = G.CONFIG.audio.total[q];
          numbers["voices " + q] = { most, total: tot };
          ok("B " + q + ": 60 voices asked for -- never more than " + tot + " at once", most <= tot && most >= Math.min(tot, 20), most + "/" + tot);
          got.forEach((v) => A.stopVoice(v));
        } else ok("B " + q + ": (no sound in this browser -- the voices left to the stress test)", true);
      });
    } finally { S.graphicsQuality = q0; g.applyGraphicsQuality(); }
  }

  // ---------------- C: accessibility ----------------
  async function access() {
    const S = G.save.settings, X = G.Access;
    G.SettingsUI.cat = "accessibility"; G.SettingsUI.render();
    const rows = ["set-camshake", "set-camrecoil", "set-weaponbob", "set-muzzleflash", "set-screenfx", "set-gore", "set-reducemotion", "set-fontsize", "btn-hudcfg-a", "set-headbob"];
    const sec = $("set-sec-accessibility");
    ok("C Accessibility: Camera Shake, Camera Recoil, Weapon Bob, Muzzle Flash, Screen effects, Blood & Gore, Reduce Motion, UI scale, HUD size, head bob",
      rows.every((id) => sec && sec.querySelector("#" + id)), rows.filter((id) => !(sec && sec.querySelector("#" + id))).join());
    G.SettingsUI.cat = "audio"; G.SettingsUI.render();
    ok("C Audio: every volume and Captions", ["set-masterVolume", "set-musicVolume", "set-weaponsVolume", "set-sfxVolume", "set-ambientVolume", "set-uiVolume", "set-speechVolume", "set-captions"].every((id) => !!$(id)));
    // the defaults: nothing over what the game was tuned to, nothing extra
    const d = G.normalizeSave({ settings: {} }).settings;
    ok("C defaults: shake, recoil, bobs, flash, the screen's effects at their tuned 100%; Reduce Motion off; no motion blur",
      d.cameraShake === 1 && d.cameraRecoil === 1 && d.weaponBob === 1 && d.muzzleFlash === 1 && d.screenEffects === 1 && d.reduceMotion === false && !("motionBlur" in d));
    ok("C defaults: UI scale 100%, captions off, gore full", d.fontSize === "medium" && d.captions === false && d.gore === "full");
    const b = G.normalizeSave({ settings: { weaponBob: 7, screenEffects: -2, fontSize: "huge", cameraShake: "x" } }).settings;
    ok("C bad values: held to 0-1, an unknown size back to 100%", b.weaponBob === 1 && b.screenEffects === 0 && b.fontSize === "medium" && b.cameraShake === 1, JSON.stringify([b.weaponBob, b.screenEffects, b.fontSize, b.cameraShake]));
    const k = G.normalizeSave({ settings: { weaponBob: 0, screenEffects: 0.4 } }).settings;
    ok("C a choice kept (0 = off)", k.weaponBob === 0 && Math.abs(k.screenEffects - 0.4) < 1e-9);
    // G.Access
    const keep = { cameraShake: S.cameraShake, weaponBob: S.weaponBob, screenEffects: S.screenEffects, reduceMotion: S.reduceMotion, headBob: S.headBob, headBobOff: S.headBobOff };
    try {
      S.cameraShake = 1; S.weaponBob = 1; S.screenEffects = 1; S.reduceMotion = false;
      ok("C G.Access at the defaults: all 1, lamps flicker", X.shake() === 1 && X.weaponBob() === 1 && X.screen() === 1 && X.flicker() === true);
      S.reduceMotion = true;
      ok("C Reduce Motion: shake 35%, bobs halved, the screen's effects 60%, lamps steady",
        Math.abs(X.shake() - 0.35) < 1e-9 && Math.abs(X.weaponBob() - 0.5) < 1e-9 && Math.abs(X.bob() - 0.5) < 1e-9 && Math.abs(X.screen() - 0.6) < 1e-9 && X.flicker() === false);
      S.reduceMotion = false; S.cameraShake = 0; S.weaponBob = 0; S.screenEffects = 0;
      ok("C sliders at 0: no shake, no weapon bob, no screen effects", X.shake() === 0 && X.weaponBob() === 0 && X.screen() === 0);
      // the sliders in Settings
      G.SettingsUI.cat = "accessibility"; G.SettingsUI.render();
      const slide = (id, v) => { const el = $(id); el.value = String(v); el.oninput(); el.onchange(); };
      slide("set-weaponbob", 0.35); slide("set-screenfx", 0.5);
      ok("C the Weapon Bob and Screen effects sliders: saved, shown", Math.abs(S.weaponBob - 0.35) < 1e-9 && Math.abs(S.screenEffects - 0.5) < 1e-9 && /35/.test($("set-weaponbob-v").textContent) && /50/.test($("set-screenfx-v").textContent));
      ok("C ...the screen's effects in CSS (--fx-screen)", getComputedStyle(document.documentElement).getPropertyValue("--fx-screen").trim() === "0.50");
      const fl = document.createElement("div"); fl.className = "hud-damage-flash"; document.body.appendChild(fl);
      const filt = getComputedStyle(fl).filter; fl.remove();
      ok("C ...a hit's red edge follows it", /opacity\(0\.5\)/.test(filt), filt);
      const rm = $("set-reducemotion"); rm.checked = true; rm.onchange();
      ok("C Reduce Motion from Settings: saved, the CSS at 30%", S.reduceMotion === true && getComputedStyle(document.documentElement).getPropertyValue("--fx-screen").trim() === "0.30");
      // the lamps: steady with Reduce Motion (G.Perf.updateLights), flickering without
      const P = G.Perf, pool0 = P.pool, anc0 = P.anchors;
      const lamp = { base: 2, intensity: 2, speed: 3, phase: 0.4, mode: "flicker", pos: new THREE.Vector3(0, 3, 0), distance: 10, color: new THREE.Color(1, 1, 1) };
      P.pool = [new THREE.PointLight(0xffffff, 0, 10)]; P.anchors = [lamp];
      const seen = (rmOn) => { S.reduceMotion = rmOn; const v = new Set(); for (let t = 0; t < 4; t += 0.07) { P.updateLights(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), t); v.add(lamp.intensity.toFixed(3)); } return v.size; };
      const steady = seen(true), flick = seen(false);
      P.pool = pool0; P.anchors = anc0;
      ok("C Reduce Motion: a failing tube holds steady (flickers without it)", steady === 1 && flick > 1, steady + " / " + flick);
      // a cutscene's flash, at the screen's effects
      S.reduceMotion = false; S.screenEffects = 0.5; X.apply();
      G.Cutscene.ensure();
      const f = G.Cutscene.el.flash;
      // (its fade lasts 0.25 + 0.5 x its strength: a full flash at 50% fades in 0.5 s, not 0.75)
      G.Cutscene.flashScreen(1);
      ok("C a cutscene's white flash: x Screen effects", !!f && /opacity 0\.5s/.test(f.style.transition), f && f.style.transition);
    } finally {
      Object.assign(S, keep); X.apply();
    }
  }

  // ---------------- D: UI scale ----------------
  async function uiScale() {
    const S = G.save.settings, fs0 = S.fontSize, root = document.documentElement;
    const px = () => parseFloat(getComputedStyle(root).fontSize);
    try {
      const at = {};
      for (const s of ["small", "medium", "large"]) { S.fontSize = s; G.UI.applyFontSizeClass(); at[s] = px(); }
      numbers.uiScale = at;
      ok("D UI scale: 90% / 100% / 112% of the page's text", Math.abs(at.small / at.medium - 0.9) < 0.02 && Math.abs(at.large / at.medium - 1.12) < 0.02, JSON.stringify(at));
      // rem everywhere: a button's text grows with it
      G.SettingsUI.cat = "accessibility"; G.SettingsUI.render();
      const lab = document.querySelector("#set-sec-accessibility .set-name");
      S.fontSize = "medium"; G.UI.applyFontSizeClass(); const a = lab ? parseFloat(getComputedStyle(lab).fontSize) : 0;
      S.fontSize = "large"; G.UI.applyFontSizeClass(); const b = lab ? parseFloat(getComputedStyle(lab).fontSize) : 0;
      ok("D ...a Settings label grows with it", b > a * 1.08, a + " -> " + b);
      G.SettingsUI.pick($("set-fontsize"), "small");
      ok("D the row in Settings sets it", S.fontSize === "small" && Math.abs(px() / at.medium - 0.9) < 0.02);
    } finally { S.fontSize = fs0; G.UI.applyFontSizeClass(); }
  }

  // ---------------- E: How to Play ----------------
  async function howto() {
    const lang0 = G.lang;
    const first = G.CONFIG.zombies.first;
    for (const l of ["en", "th", "zh", "fr"]) {
      await new Promise((r) => G.setUILang(l, { done: r }));
      G.UI.showScreen("screen-howtoplay");
      const box = document.querySelector('#screen-howtoplay [data-i18n-html="howto.body2"]');
      const txt = box ? box.textContent : "";
      const names = G.ZOMBIE_KINDS.map((k) => G.T("zombie.kind." + k));
      const missing = names.filter((n) => !txt.includes(n));
      ok("E " + l + ": How to Play -- the HUD, G to inspect, the explanations", !!box && box.offsetParent !== null && [...box.querySelectorAll("b")].some((b) => b.textContent.trim() === G.keyLabel(G.save.settings.keybinds.inspect)) &&box.querySelectorAll("h3").length === 3, txt.slice(0, 60));
      ok("E " + l + ": ...the ten zombies by the names the game gives them", missing.length === 0, missing.join());
      // (each zombie's line: its name, then its first wave)
      const items = [...box.querySelectorAll("li")].map((li) => li.textContent);
      const wrong = Object.keys(first).filter((k) => { const li = items.find((t) => t.includes(G.T("zombie.kind." + k))); return !li || !new RegExp("\\D" + first[k] + "\\D").test(li); });
      ok("E " + l + ": ...each with its first wave", wrong.length === 0, wrong.join());
      const body = document.querySelector('#screen-howtoplay [data-i18n-html="howto.body"]');
      ok("E " + l + ": the first part filled in (no key or placeholder showing)", body && body.textContent.length > 200 && !/howto\.|\{\w+\}/.test(body.innerHTML));
    }
    G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
    if (G.lang !== lang0) await new Promise((r) => G.setUILang(lang0, { done: r }));
  }

  // ---------------- F: a phone's HUD ----------------
  async function phoneHud(g) {
    const A = G.Abilities, slots0 = A.slots;
    try {
      const ids = Object.keys(G.ABILITY_BY_ID).slice(0, 4);
      A.slots = ids.map((id) => ({ id, cd: 0 }));
      G.UI.setHudVisible && G.UI.setHudVisible(true);
      G.UI.updateAbilityBar(g, true);
      g.paused = true;
      await wait(120);
      const dock = $("hud-dock");
      ok("F the abilities' column follows the bar while the game is paused", !dock.classList.contains("no-ab"), dock.className);
      A.slots = [];
      G.UI.updateAbilityBar(g, true);
      await wait(120);
      ok("F ...and goes with it", dock.classList.contains("no-ab"), dock.className);
    } finally { A.slots = slots0; G.UI.updateAbilityBar(g, true); g.paused = false; }
    const row = document.createElement("div"); row.className = "inv-slotrow"; document.body.appendChild(row);
    const cs = getComputedStyle(row); const wrapOK = cs.flexWrap === "wrap"; row.remove();
    ok("F a full inventory's slots wrap onto a second row on a narrow screen", wrapOK);
    const dock = $("hud-dock"), line = $("hud-floor3");
    const was = dock.classList.contains("narrow");
    dock.classList.add("narrow"); line.classList.remove("hidden");
    const ws = getComputedStyle(line).whiteSpace;
    line.classList.add("hidden"); if (!was) dock.classList.remove("narrow");
    ok("F a long task line on a phone wraps rather than losing its end", ws === "normal", ws);
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save), lang0 = G.lang;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    G._missingKeys = {};
    try {
      tiers();
      await access();
      await uiScale();
      await howto();
      const g = startRun();
      caps(g);
      await phoneHud(g);
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      if (realUpd) G.Game.update = realUpd;
      G.Modal.reset();
      if (G.lang !== lang0) await new Promise((res) => G.setUILang(lang0, { done: res }));
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.applyFontSizeClass();
      G.UI.menuOrigin = "lobby"; G.UI.goToMainMenu();
    }
    const missing = Object.keys(G._missingKeys || {});
    ok("no missing strings", !missing.length, missing.join());
    ok("no uncaught errors", errs.length === 0, errs.join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")), numbers };
  }
  return { run };
})();
