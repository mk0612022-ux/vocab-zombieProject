// Dev-only (not shipped). The overhaul, round 6: the HUD at the bottom centre
// (js/hud.js, js/ui.js updateHud, js/game.js buildHudState).
//   A  where it is: bottom centre, under ~18% of the screen, nothing on it --
//      the word box, the minimap, the prompts, the spelling bar keep clear;
//      the old corner panels gone; the header over the word
//   B  the values are the game's, every time: after a shot, a reload, a
//      switch, the knife, a gun bought, low and empty magazines, a hit, health
//      coming back, stamina spent, death and a new run (nothing of the old
//      one left); written only when they change
//   C  the header (campaign, endless, a boss, a study session) and the
//      panel's lines (mission, floor, the task under way, the third floor)
//   D  touch: between the thumbs, the slots are the weapon buttons; the
//      layout editor shows the HUD's box and keeps buttons off it -- a
//      dragged one, and one in an older saved layout
//   E  the HUD sizes (the slot row a part of its own); Inventory Full lights
//      the slot a card would give up in the HUD's own slot row
//   F  the words in four languages; the level and wave on the pause screen
// Load it into the game (in the lobby), then:
//   const r = await G.Round26Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round26Test = (function () {
  const results = [], numbers = {};
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const T = (k, v) => G.T(k, v);
  const rect = (el) => el.getBoundingClientRect();
  const over = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const shown = (el) => !!el && !el.classList.contains("hidden") && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none";

  // a run in the school, nobody in it, stepped by hand (as suite 21)
  let realUpd = null;
  function start() {
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
    step(g, 3);
    return g;
  }
  function step(g, n) { for (let i = 0; i < (n || 1); i++) realUpd.call(g, 1 / 60); }
  const secs = (g, s) => step(g, Math.ceil(s * 60));
  const give = (g, id) => {
    const d = G.WEAPON_DEFS[id];
    if (!g.player.ammo[id]) { g.player.ammo[id] = { mag: d.magSize, reserve: d.magSize * 4 }; g.player.weaponLevels[id] = { dmg: 1, rate: 1, mag: 1 }; }
    if (!g.player.gunSlots.includes(id)) g.player.gunSlots.push(id);
    return g.player.gunSlots.indexOf(id) + 1;
  };

  // ---- what the HUD says, against the game: [] when they agree ----
  function mismatch(g) {
    const pl = g.player, out = [];
    const want = (what, a, b) => { if (a !== b) out.push(what + ": HUD " + JSON.stringify(a) + " / game " + JSON.stringify(b)); };
    want("money", $("hud-money").textContent, pl.money + "$");
    want("score", $("hud-score").textContent, String(pl.score));
    const pct = pl.hp <= 0 ? 0 : Math.max(1, Math.ceil(pl.hp / pl.maxHp * 100 - 1e-9));
    want("health %", $("hud-hp-text").textContent, pct + "%");
    want("health bar", +$("hud-hp").style.getPropertyValue("--f"), +Math.max(0, Math.min(1, pl.hp / pl.maxHp)).toFixed(3));
    want("stamina bar", +$("hud-stam").style.getPropertyValue("--f"), +Math.max(0, Math.min(1, g.stamina / g.maxStamina)).toFixed(3));
    want("stamina spent", $("hud-stam").classList.contains("out"), !!g.staminaExhausted);
    // the slot row: the knife, every gun by name, the free slots
    const cells = Array.from($("hud-slots").querySelectorAll(".hud-slot"));
    want("slots", cells.length, 1 + G.Loadout.maxSlots(g));
    cells.forEach((c, i) => {
      const id = i === 0 ? "melee" : pl.gunSlots[i - 1];
      const name = i === 0 ? T("hud.slotKnife") : id === "pistol" ? T("hud.slotPistol") : id ? G.WEAPON_DEFS[id].name : T("hud.slotEmpty", { n: i });
      want("slot " + i, c.querySelector(".hsl-name").textContent, name);
      want("slot " + i + " empty", c.classList.contains("empty"), i > 0 && !id);
      want("slot " + i + " held", c.classList.contains("active"), pl.currentSlot === i);
    });
    // what is in hand
    const id = g.currentWeaponId(), def = g.currentWeaponDef();
    want("in hand", $("hud-weapon-name").textContent, def.name);
    if (id === "melee") {
      want("ammo (knife)", $("hud-ammo").textContent, "—");
      want("status (knife)", $("hud-weapon-status").textContent, T("hud.melee"));
    } else {
      const a = pl.ammo[id];
      want("ammo", $("hud-ammo").textContent, a.mag + "/" + a.reserve);
      want("status", $("hud-weapon-status").textContent, G.weightClass(def).label);
      want("empty magazine", $("hud-ammo").classList.contains("empty"), a.mag === 0);
    }
    // the tasks, the header
    const rows = G.Objectives.state ? G.Objectives.list(g) : [];
    want("mission", $("hud-objectives").textContent, rows.length ? T("hud.mission", { d: rows.filter((r) => r.done).length, n: rows.length }) : "");
    const left = g.zombies.filter((z) => !z.decoy).length + (G.Bosses.phase ? 0 : Math.max(0, g.requiredKills - g.spawnedCount));
    if (g.mode === "campaign" && !G.Bosses.phase) want("zombies left", $("hud-zombies-left").textContent, g.requiredKills > 0 ? T("hud.zombiesLeftOf", { n: left, t: g.requiredKills }) : T("hud.zombiesLeft", { n: left }));
    if (g.mode === "campaign") want("wave", $("hud-level-wave").textContent, T("hud.waveOf", { w: g.wave, n: g.level.waves }) + (g.wave > g.level.waves ? T("hud.overtime") : ""));
    return out;
  }
  const agree = (name, g) => { const m = mismatch(g); ok(name, !m.length, m.slice(0, 3).join(" | ")); };

  // ---------------- A: where it is ----------------
  function layout() {
    const g = start();
    G.HudCfg.reset();
    G.Hud.fit();
    const d = rect($("hud-dock"));
    numbers.dock = { w: Math.round(d.width), h: Math.round(d.height), vh: innerHeight, pct: Math.round(d.height / innerHeight * 1000) / 10 };
    ok("A the HUD at the bottom centre", Math.abs((d.left + d.right) / 2 - innerWidth / 2) < 2 && innerHeight - d.bottom < 40, JSON.stringify(numbers.dock));
    ok("A at the default sizes: under 18% of the screen's height", d.height / innerHeight <= 0.18, numbers.dock.pct + "%");
    ok("A the old corner panels and the separate touch weapon row: gone", !document.querySelector(".hud-left, .hud-right, .hud-bottom, #touch-slots"));
    const top = rect(document.querySelector(".hd-top")), bars = rect(document.querySelector(".hd-bars")), slots = rect($("hud-slots")), det = rect($("hud-detail"));
    ok("A Savings and ★ over the bars, the bars over the slots", top.bottom <= bars.top + 1 && bars.bottom <= slots.top + 1);
    ok("A health, then stamina to its right", rect($("hud-stam")).left >= rect($("hud-hp")).right);
    ok("A the panel to the right of the slot row (wide screen), its foot with the row's", det.left >= slots.right && Math.abs(det.bottom - slots.bottom) < 2, $("hud-dock").className);
    ok("A the score smaller than the savings, on the same row", parseFloat(getComputedStyle($("hud-score-box")).fontSize) < parseFloat(getComputedStyle($("hud-savings")).fontSize) && Math.abs(rect($("hud-score-box")).bottom - rect($("hud-savings")).bottom) < 6);
    // nothing on it
    const mb = rect(document.querySelector(".hud-meaning-box")), mm = rect($("hud-minimap"));
    ok("A clear of the word box and the minimap", !over(d, mb) && (!mm.width || !over(d, mm)));
    $("hud-interact-prompt").textContent = "Press E to open"; $("hud-interact-prompt").classList.remove("hidden");
    const ip = rect($("hud-interact-prompt"));
    ok("A a prompt (Press E) above the HUD", ip.bottom <= d.top, Math.round(ip.bottom) + " / " + Math.round(d.top));
    $("hud-interact-prompt").classList.add("hidden");
    const capB = parseFloat(getComputedStyle($("hud-captions")).bottom);
    ok("A captions and the ability note above it", capB >= innerHeight - d.top && parseFloat(getComputedStyle($("hud-ability-note")).bottom) >= innerHeight - d.top, capB);
    ok("A the spelling bar above it", parseFloat(getComputedStyle($("hud-spell")).bottom) >= innerHeight - d.top);
    ok("A the FPS counter top right as before", getComputedStyle($("hud-fps-counter")).top === "8px" && getComputedStyle($("hud-fps-counter")).right === "8px");
    ok("A thin white lines on see-through grey", getComputedStyle($("hud-detail")).backgroundColor === "rgba(18, 20, 23, 0.62)" && getComputedStyle($("hud-detail")).borderTopColor === "rgba(255, 255, 255, 0.85)" && getComputedStyle($("hud-detail")).borderTopWidth === "1px");
    ok("A the colours: health, stamina, held, tasks, the count", getComputedStyle($("hud-hp")).borderTopColor === "rgb(229, 72, 77)" && getComputedStyle($("hud-stam")).borderTopColor === "rgb(59, 130, 246)" && getComputedStyle($("hud-weapon-status")).color === "rgb(74, 222, 128)" && getComputedStyle($("hud-objectives")).color === "rgb(250, 204, 21)" && getComputedStyle($("hud-floor3")).color === "rgb(94, 214, 255)");
    // the header in the word box
    const hb = rect($("hud-head")), sp = rect($("hud-speak"));
    ok("A the header (wave, zombies) at the top of the word box, clear of the speaker", hb.top >= mb.top && hb.bottom <= rect($("hud-meaning")).top && !over(hb, sp));
    // abilities (keyboard): to the left of the rows, the HUD still small
    G.Abilities.slots = ["dash", "freeze", "radar", "barrier"].map((id) => ({ id, cd: 0 }));
    G.UI.updateAbilityBar(null, true); step(g, 2); G.Hud.fit();
    const d2 = rect($("hud-dock")), ab = rect($("hud-abilities"));
    ok("A four abilities: on the left of the rows, the HUD still under 18%", ab.right <= rect($("hud-slots")).left && d2.height / innerHeight <= 0.18 && Math.abs((d2.left + d2.right) / 2 - innerWidth / 2) < 2, Math.round(d2.height / innerHeight * 1000) / 10 + "%");
    G.Abilities.slots = []; G.UI.updateAbilityBar(null, true); step(g, 2);
  }

  // ---------------- B: the game's values ----------------
  function values() {
    const g = start();
    agree("B a new run: the HUD is the game's", g);
    const a = g.player.ammo.pistol;
    G.onFirePress(); step(g, 2);
    agree("B a shot: one round less on the HUD too", g);
    ok("B ...the magazine one down", a.mag === G.WEAPON_DEFS.pistol.magSize - 1, a.mag);
    g.reload(); step(g, 2);
    ok("B reloading: the thin bar under the ammunition fills", $("hud-reload").classList.contains("on") && +$("hud-reload").style.getPropertyValue("--f") >= 0);
    secs(g, 2.5);
    agree("B after the reload: the HUD is the game's", g);
    ok("B ...full again, the bar gone", a.mag === G.WEAPON_DEFS.pistol.magSize && !$("hud-reload").classList.contains("on"));
    // a switch, the knife
    const slot = give(g, "smg");
    g.switchSlot(slot); secs(g, 1);
    agree("B a switch: the SMG lit in the row, its name and ammunition in the panel", g);
    g.switchSlot(0); secs(g, 1);
    agree("B the knife: '—' and MELEE", g);
    g.switchSlot(1); secs(g, 1);
    // low and empty
    a.mag = 2; step(g, 1);
    ok("B a quarter or less: the count amber", $("hud-ammo").classList.contains("low") && !$("hud-ammo").classList.contains("empty"));
    a.mag = 0; step(g, 1);
    ok("B empty: red and RELOAD, still", $("hud-ammo").classList.contains("empty") && !$("hud-ammo-note").classList.contains("hidden") && $("hud-ammo-note").textContent === T("hud.reloadNow"));
    const r0 = a.reserve; a.reserve = 0; step(g, 1);
    ok("B nothing left at all: NO AMMO", $("hud-ammo-note").textContent === T("hud.noAmmo"));
    a.mag = 12; a.reserve = r0; step(g, 1);
    agree("B ...and back", g);
    // buying a gun
    g.player.money = 2000;
    const item = G.SHOP_ITEMS.find((i) => i.id === "unlock_shotgun");
    g.buyShopItem(item, 500); step(g, 2);
    ok("B a gun bought: in the row, money down", g.player.gunSlots.includes("shotgun") && g.player.money === 1500);
    agree("B ...the HUD is the game's", g);
    // health: a hit, low, coming back; stamina spent
    g.player.maxHp = 100; g.player.hp = 64.2; step(g, 1);
    agree("B a hit: 65% (rounded up)", g);
    g.player.hp = 0.4; step(g, 1);
    ok("B a sliver left: 1%, not 0%; the bar pulses slowly (not a flash)", $("hud-hp-text").textContent === "1%" && $("hud-hp").classList.contains("low") && parseFloat(getComputedStyle($("hud-hp"), "::before").animationDuration) >= 1.2);
    g.player.hp = 50; step(g, 1);
    const pr = g.buildHudState(); pr.regenerating = true; G.UI.updateHud(pr);
    ok("B health coming back: a soft glow on the bar", $("hud-hp").classList.contains("regen"));
    g.stamina = 0; g.staminaExhausted = true; step(g, 1);
    agree("B stamina spent: grey until it is back", g);
    g.stamina = g.maxStamina; g.staminaExhausted = false; step(g, 1);
    // written only when something changes
    let n = 0;
    const mo = new MutationObserver((l) => { n += l.length; });
    [$("hud-dock"), $("hud-head")].forEach((el) => mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true }));
    step(g, 30);
    mo.disconnect();
    ok("B nothing changing: nothing written (30 frames)", n === 0, n);
    // death, and a new run
    // (no checkpoint: a new run starts at once, without asking first)
    G.Checkpoint.remove(1);
    g.player.hp = 0; g.checkPlayerDeath();
    ok("B dead: Game Over", g.state === "GAME_OVER");
    g.retry();
    g.update = function () {}; g.requiredKills = 1e9; g.clearZombies(); G.Modal.reset(); g.state = "GAMEPLAY";
    step(g, 3);
    agree("B a new run: the HUD is the new run's", g);
    ok("B ...no gun of the last run left in the row, no money", g.player.gunSlots.length === 1 && $("hud-slots").querySelectorAll(".hud-slot.empty").length === G.Loadout.maxSlots(g) - 1 && $("hud-money").textContent === g.player.money + "$", g.player.gunSlots.join(",") + " / " + $("hud-slots").querySelectorAll(".hud-slot.empty").length + " of " + G.Loadout.maxSlots(g) + " / " + $("hud-money").textContent);
  }

  // ---------------- C: the header and the panel's lines ----------------
  function lines() {
    const g = start();
    ok("C campaign: Wave n/20 and the zombies left of the wave's", $("hud-level-wave").textContent === T("hud.waveOf", { w: g.wave, n: g.level.waves }) && /\d+\/\d+/.test($("hud-zombies-left").textContent) && $("hud-level-name").textContent === g.level.name);
    g.mode = "endless"; step(g, 1);
    ok("C endless: only the wave's number", $("hud-level-wave").textContent === T("hud.wave", { w: g.wave }) && !/\//.test($("hud-level-wave").textContent));
    g.mode = "campaign";
    // (states set by hand are drawn straight away: a frame of the game would undo them)
    const draw = () => G.UI.updateHud(g.buildHudState());
    G.Bosses.phase = "pending"; draw();
    ok("C a boss wave: BOSS", $("hud-zombies-left").textContent === T("hud.bossWave") && $("hud-head").classList.contains("boss"), $("hud-zombies-left").textContent);
    G.Bosses.phase = null; draw();
    g.mode = "study"; g.study = { title: "Daily Review", answered: 3, cards: [1, 2, 3, 4, 5] }; draw();
    ok("C a study session: how far it has got", $("hud-level-wave").textContent === G.Study.hudLabel(g) && !$("hud-level-name").textContent, $("hud-level-wave").textContent);
    g.mode = "campaign"; g.study = null; step(g, 1);
    // the panel
    ok("C Mission d/n: the level's objectives", $("hud-objectives").textContent === T("hud.mission", { d: G.Objectives.doneCount(g), n: G.Objectives.list(g).length }) && shown($("hud-objectives")));
    ok("C Floor 1 on the ground", $("hud-floor").textContent === T("hud.floor", { n: 1 }) && shown($("hud-floor")));
    const y0 = g.yawObject.position.y;
    g.yawObject.position.y = g.world.storeyY[1] + 1.8; draw();
    ok("C ...Floor 2 upstairs", $("hud-floor").textContent === T("hud.floor", { n: 2 }), $("hud-floor").textContent);
    g.yawObject.position.y = y0; step(g, 1);
    G.Floor3._hudSig = null; G.Floor3.hud(g);
    ok("C the third floor's steps: their own line, the other task line hidden", shown($("hud-floor3")) && /3F/.test($("hud-floor3").textContent) && !shown($("hud-task")), $("hud-floor3").className + " | " + $("hud-floor3").textContent + " | " + $("hud-task").className);
    g.world.thirdFloor.unlocked = true; G.Floor3._hudSig = null; G.Floor3.hud(g); step(g, 1);
    const todo = G.Objectives.list(g).find((r) => !r.done && r.key !== "survive" && r.key !== "accuracy");
    ok("C ...done: the first unfinished goal with a count instead", shown($("hud-task")) && todo && $("hud-task").textContent === T("obj.short." + todo.key) + " " + todo.value.replace(/\s+/g, ""), $("hud-task").textContent);
    g.world.thirdFloor.unlocked = false; G.Floor3._hudSig = null;
    // the level's name is on the pause screen too
    g.pause();
    ok("F the pause screen: the level and the wave", $("pause-where").textContent.includes(g.level.name) && $("pause-where").textContent.includes(T("hud.waveOf", { w: g.wave, n: g.level.waves })));
    g.resume();
  }

  // ---------------- D: touch ----------------
  // (found in this round: before any level had been played, the editor opened
  // from Settings threw in the sky -- no level yet -- and left its preview
  // drawing behind the menus)
  function editorFromMenu() {
    const g = G.Game, level0 = g.level;
    g.level = null;
    if (g.state !== "MENU") g.quitToMainMenu();
    let err = null;
    try { G.TouchCfg.openEditor(); } catch (e) { err = e.message; }
    const open = G.TouchCfg.editing && g._layoutPreview && !!g.scene;
    try { G.TouchCfg.closeEditor(); } catch (e) { err = err || e.message; }
    ok("D the layout editor from Settings before any level: opens and closes, nothing left drawing", !err && open && !g.scene && !g._layoutPreview && g.level === null, err || "");
    g.level = level0;
  }
  async function touch() {
    editorFromMenu();
    const g = start();
    const mode = G.Input.mode;
    G.Input.mode = "touch"; G.UI.applyControlMode(); G.UI.setTouchControlsVisible(true);
    step(g, 2); G.Hud.fit();
    const d = rect($("hud-dock"));
    const btns = ["joystick", "fire", "ads", "interact", "reload", "jump", "sprint", "pause"].map((id) => G.TouchCfg.el(id)).filter((e) => e && e.getClientRects().length);
    const hit = btns.filter((b) => over(rect(b), d)).map((b) => b.id);
    ok("D touch: the HUD between the thumbs, on no button", !hit.length, hit.join(","));
    ok("D ...the panel over the right end of the slot row", $("hud-dock").classList.contains("narrow") && rect($("hud-detail")).bottom <= rect($("hud-slots")).top + 1 && rect($("hud-detail")).right >= rect($("hud-slots")).right - 2);
    const cells = Array.from($("hud-slots").querySelectorAll(".hud-slot"));
    ok("D the slots: a finger's size (44 px)", cells.every((c) => c.offsetHeight >= 44) && getComputedStyle($("hud-slots")).pointerEvents === "auto");
    give(g, "smg"); step(g, 2);
    const smgCell = $("hud-slots").querySelectorAll(".hud-slot")[2];
    smgCell.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
    secs(g, 1);
    ok("D a tap on a slot: that gun", g.player.currentSlot === 2 && $("hud-slots").querySelectorAll(".hud-slot")[2].classList.contains("active"));
    // the layout editor
    G.TouchCfg.openEditor();
    ok("D the layout editor: the HUD's box outlined", $("hud-dock").classList.contains("tc-hudzone") && $("hud-dock").dataset.zone === T("touchcfg.hudZone"));
    const zone = G.Hud.zone(), cap = $("touchcfg-capture"), fire = G.TouchCfg.el("fire"), f0 = rect(fire);
    const pe = (type, x, y) => cap.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 7 }));
    const hitAt = G.TouchCfg.hitTest(f0.left + f0.width / 2, f0.top + f0.height / 2);
    pe("pointerdown", f0.left + f0.width / 2, f0.top + f0.height / 2);
    const dragged = !!G.TouchCfg._drag;
    pe("pointermove", (zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2);
    pe("pointerup", (zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2);
    await wait(80);
    ok("D a button dropped on the HUD goes up above it", !over(rect(fire), G.Hud.zone()) && rect(fire).bottom <= G.Hud.zone().top + 1, "hit " + hitAt + " dragged " + dragged + " pos " + JSON.stringify(G.TouchCfg.cfg().pos.fire) + " f0 " + [f0.left, f0.top, f0.width].map(Math.round));
    G.TouchCfg.closeEditor();
    G.TouchCfg.resetAll();
    await wait(80);
    // an older save: a button where the HUD is now, and the old weapon row
    const z2 = G.Hud.zone();
    G.TouchCfg.cfg().pos.reload = { x: (z2.left + z2.right) / 2 / innerWidth, y: (z2.top + z2.bottom) / 2 / innerHeight };
    G.save.settings.touchLayout.pos.slots = { x: 0.5, y: 0.9 };
    G.TouchCfg.cfg();
    ok("D an older layout: its place for the old weapon row dropped", !("slots" in G.save.settings.touchLayout.pos));
    G.TouchCfg.apply();
    await wait(120);
    ok("D ...a button over the HUD moved up off it, and kept there", !over(rect(G.TouchCfg.el("reload")), G.Hud.zone()) && G.TouchCfg.cfg().pos.reload.y * innerHeight < G.Hud.zone().top);
    G.TouchCfg.resetAll();
    G.Input.mode = mode; G.UI.applyControlMode(); G.UI.setTouchControlsVisible(false);
    await wait(80);
  }

  // ---------------- E: sizes, Inventory Full ----------------
  async function sizesAndInventory() {
    const g = start();
    const H = G.HudCfg;
    ok("E HUD sizes: the slot row a part of its own", H.PARTS.includes("slots") && !!T("hudcfg.slots"));
    H.set("slots", 1.3);
    ok("E ...sized by its slider", Math.abs(parseFloat(document.querySelector("#hud-dock .hud-slots").style.zoom) - 1.3 * H.fitK) < 0.01);
    H.set("all", 1.5); H.PARTS.forEach((p) => H.set(p, 1.5));
    const extra = H.problems().filter((p) => !H._baseline.has(p));
    ok("E everything at 150%: nothing overlaps or leaves the screen (it shrinks to fit)", !extra.length, extra.join(",") + " fit " + H.fitK.toFixed(2));
    H.reset(); G.persist();
    // Inventory Full
    ["smg", "shotgun", "rifle"].forEach((id) => give(g, id));
    step(g, 2);
    G.Loadout.offer(g, "sniper", { source: "crate" });
    await wait(30);
    const row = $("inv-slotrow"), cards = Array.from(document.querySelectorAll("#inv-slots .inv-slot"));
    ok("E Inventory Full: the HUD's slot row over the cards", G.UI._currentScreen === "screen-inventory" && row.querySelectorAll(".hud-slot").length === 1 + G.Loadout.maxSlots(g));
    cards[1].dispatchEvent(new MouseEvent("mouseenter"));
    ok("E a card under the mouse: its slot lit in the row", row.querySelector('.hud-slot[data-slot="2"]').classList.contains("replace") && row.querySelectorAll(".replace").length === 1 && cards[1].classList.contains("replace-hl"));
    cards[1].dispatchEvent(new MouseEvent("mouseleave"));
    ok("E ...and off again", !row.querySelector(".replace"));
    row.querySelector('.hud-slot[data-slot="3"]').click();
    step(g, 2);
    ok("E a gun's cell in the row chooses it", g.player.gunSlots[2] === "sniper" && G.UI._currentScreen !== "screen-inventory", g.player.gunSlots.join(","));
    agree("E ...and the HUD shows the new loadout", g);
  }

  // ---------------- F: the words ----------------
  async function words() {
    const KEYS = ["hud.savings", "hud.health", "hud.stamina", "hud.slotEmpty", "hud.slotKnife", "hud.slotPistol", "hud.melee", "hud.reloadNow", "hud.noAmmo", "hud.mission", "hud.floor", "hud.wave", "hud.waveOf",
      "hud.zombiesLeft", "hud.zombiesLeftOf", "hud.bossWave", "obj.short.correct", "obj.short.explore", "obj.short.keys", "obj.short.notes", "obj.short.boss", "hudcfg.slots", "touchcfg.hudZone"];
    const lang = G.lang, use = (c) => new Promise((res) => G.setUILang(c, { done: res }));
    await use("th");
    const th = T("hud.slotKnife");
    await use("zh"); await use("fr"); await use(lang);
    const miss = [];
    ["en", "th", "zh", "fr"].forEach((l) => KEYS.forEach((k) => { if (!G.STRINGS[l] || !G.STRINGS[l][k]) miss.push(l + ":" + k); }));
    ok("F the HUD's words in all four languages (the knife in Thai: " + th + ")", !miss.length, miss.join());
  }

  async function run() {
    results.length = 0;
    const backup = JSON.stringify(G.save), lang0 = G.lang, mode0 = G.Input.mode;
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    window.addEventListener("error", onErr);
    G._missingKeys = {};
    try {
      G.save.settings.controlMode = "auto"; G.Input.mode = "desktop";
      G.save.settings.autoReload = false;          // (an empty magazine stays empty to be read)
      layout();
      values();
      lines();
      await touch();
      await sizesAndInventory();
      await words();
    } catch (e) {
      ok("no exception", false, e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | "));
    } finally {
      window.removeEventListener("error", onErr);
      if (realUpd) G.Game.update = realUpd;
      G.Modal.reset();
      if (G.TouchCfg.editing) G.TouchCfg.closeEditor();
      G.Input.mode = mode0; G.UI.applyControlMode();
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
