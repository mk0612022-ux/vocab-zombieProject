// ===================================================================
// Situation tips (expansion, round 7)
// -------------------------------------------------------------------
// The first time something comes up that the game has not explained, a small
// card says what it is and what to do about it:
//   boss          a boss arrives            bloater / screamer / ironclad   one is met
//   perkShop      a shop with perks          forge         the Word Forge, looked at
//   attachUnlock  an attachment unlocked     floorUnlock   a floor opened
//   storyNote     a story note, looked at    lowAmmo       the gun in hand running out
// Once a profile (G.save.tipsSeen: shown is seen), never in the Training Yard,
// never over a question or a window -- the shop's own tip, about its perks,
// shows over the shop. The card does not stop the game: it leaves after
// G.CONFIG.tips.seconds of play, or on "Got it" (H, a click, a tap) or
// "Don't show tips" (N), which turns them all off. Settings > Tips turns them
// on again and can show them all again. With a controller the card simply
// leaves on its own (the buttons are all taken in play).
//
//   G.GameTips.update(game, dt)  each frame (js/game.js), in play and in the shop
//   G.GameTips.want(id)          ask for one (it waits its turn)
//   G.GameTips.reset()           every tip unseen again
// ===================================================================
window.G = window.G || {};

G.GameTips = (function () {
  const IDS = ["boss", "bloater", "screamer", "ironclad", "perkShop", "forge", "attachUnlock", "floorUnlock", "storyNote", "lowAmmo"];
  const ICON = { boss: "💀", bloater: "💥", screamer: "📢", ironclad: "🛡️", perkShop: "🛒", forge: "⚒", attachUnlock: "🔧", floorUnlock: "🗝", storyNote: "📜", lowAmmo: "🔫" };
  const C = () => G.CONFIG.tips;
  const T = (k, v) => G.T(k, v);
  const esc = (s) => G.escapeHtml(String(s == null ? "" : s));
  const $ = (id) => document.getElementById(id);
  const on = () => !!(G.CONFIG.expansion && G.CONFIG.expansion.tips) && !!G.save && G.save.settings.tips !== false;
  const seen = () => (G.save.tipsSeen = G.save.tipsSeen || {});
  let cur = null, queue = [], age = 0, scanT = 0;

  // the card: over the play area, left of centre; its buttons are big enough to tap
  function card() {
    let el = $("game-tip");
    if (el) return el;
    el = document.createElement("div");
    el.id = "game-tip"; el.className = "game-tip hidden";
    el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = `<div class="gt-head"><span class="gt-icon" id="gt-icon" aria-hidden="true"></span><b id="gt-title"></b></div><p id="gt-text"></p>
      <div class="gt-btns"><button type="button" class="gt-btn gt-ok" id="gt-ok"></button><button type="button" class="gt-btn gt-off" id="gt-off"></button></div>`;
    document.body.appendChild(el);
    // (a press on a button is not a shot, nor the click that takes the mouse back)
    const tap = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    $("gt-ok").addEventListener("click", tap(ok));
    $("gt-off").addEventListener("click", tap(off));
    ["gt-ok", "gt-off"].forEach((id) => $(id).addEventListener("pointerdown", (e) => e.stopPropagation()));
    return el;
  }
  const keyFree = (code) => !Object.values(G.save.settings.keybinds || {}).includes(code);
  function labels() {
    const pad = G.Input && G.Input.padActive, touch = G.Input && G.Input.mode === "touch";
    const k = (code, label) => (!pad && !touch && keyFree(code) ? ` <span class="gt-key">${esc(label)}</span>` : "");
    $("gt-ok").innerHTML = esc(T("tip.ok")) + k("KeyH", "H");
    $("gt-off").innerHTML = esc(T("tip.off")) + k("KeyN", "N");
  }

  function want(id) {
    if (!on() || IDS.indexOf(id) < 0 || seen()[id] || cur === id || queue.indexOf(id) >= 0) return false;
    queue.push(id);
    return true;
  }
  function show(id) {
    const el = card();
    cur = id; age = 0;
    seen()[id] = true;                                 // (shown is seen: once a profile, whatever is pressed)
    if (G.persistSoon) G.persistSoon();
    $("gt-icon").textContent = ICON[id] || "💡";
    $("gt-title").textContent = T("tip." + id + ".title");
    $("gt-text").textContent = T("tip." + id + ".text");
    labels();
    el.classList.toggle("in-shop", !!(G.Game && G.Game.state === "SHOP"));
    el.classList.remove("hidden", "gt-in"); void el.offsetWidth;
    if (!G.Access.reduce()) el.classList.add("gt-in");
    if (G.Bus) G.Bus.emit("tip:show", { id });
  }
  function hide() {
    cur = null;
    const el = $("game-tip");
    if (el) el.classList.add("hidden");
  }
  function ok() { hide(); }
  function off() {
    hide(); queue = [];
    G.save.settings.tips = false;
    G.persist();
    if (G.UI && G.UI.flashAbilityNote) G.UI.flashAbilityNote(T("tip.offDone"));
  }
  function reset() { G.save.tipsSeen = {}; G.persist(); queue = []; }

  // may a card come up now: in play with nothing open (the perk tip: in the shop)
  function canShow(game, id) {
    if (!game || game.mode === "training") return false;
    if (id === "perkShop") return game.state === "SHOP" && G.Modal.top() && G.Modal.top().id === "shop";
    return game.state === "GAMEPLAY" && !game.paused && !G.Modal.isOpen() && !(G.Cutscene && G.Cutscene.active);
  }
  // what has come up, looked for a few times a second
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  function scan(game) {
    const W = game.world, P = game.yawObject.position;
    if (!W || !game.player) return;
    // a kind of zombie met: near enough, in front of the camera
    game.camera.getWorldDirection(fwd);
    for (const z of game.zombies) {
      if (!z.alive || (z.type !== "bloater" && z.type !== "screamer" && z.type !== "ironclad") || seen()[z.type]) continue;
      to.subVectors(z.mesh.position, P); to.y = 0;
      const d = to.length();
      if (d < C().seeAt && d > 0.1 && to.normalize().dot(fwd) > 0.55 && !z.emerge) want(z.type);
    }
    if (G.Bosses && G.Bosses.fighting && G.Bosses.fighting()) want("boss");
    const look = game._lookedAtInteractable;
    if (look && look.kind === "forge") want("forge");
    if (look && look.kind === "note") want("storyNote");
    if ((W.secondFloor && W.secondFloor.unlocked) || (W.thirdFloor && W.thirdFloor.unlocked)) want("floorUnlock");
    const id = game.currentWeaponId && game.currentWeaponId();
    if (id && id !== "melee" && game.player.ammo[id] && G.WEAPON_DEFS[id]) {
      const a = game.player.ammo[id];
      if (a.mag + a.reserve <= G.WEAPON_DEFS[id].magSize * C().lowAmmo) want("lowAmmo");
    }
  }
  // (every frame of a run, paused or not: a window or the pause menu over the
  // play puts the card away until it closes, and its time stands still meanwhile)
  function update(game, dt) {
    if (!on()) { if (cur) hide(); queue = []; return; }
    if (!game || game.mode === "training" || !/^(GAMEPLAY|PAUSE|SHOP)$/.test(game.state)) { if (cur) hide(); return; }
    if (game.state === "GAMEPLAY" && !game.paused && !G.Modal.isOpen()) {
      scanT -= dt;
      if (scanT <= 0) { scanT = 0.4; scan(game); }
    }
    if (cur) {
      if (cur === "perkShop" && game.state !== "SHOP") { hide(); return; }
      const can = canShow(game, cur), el = $("game-tip");
      if (el) el.classList.toggle("gt-away", !can);
      if (can) { age += dt; if (age > C().seconds) hide(); }
    } else if (queue.length && canShow(game, queue[0])) show(queue.shift());
  }
  // H: got it, N: no more tips -- keys nothing else is bound to (js/game.js G.onKeyDown)
  function onKey(e) {
    if (!cur || !e || e.repeat) return false;
    if (e.code === "KeyH" && keyFree("KeyH")) { ok(); return true; }
    if (e.code === "KeyN" && keyFree("KeyN")) { off(); return true; }
    return false;
  }
  // the shop with perks on offer; an attachment unlocked
  if (G.Bus) {
    // (the event comes as the shop opens, before its perks are drawn: a moment later)
    G.Bus.on("game:shop", () => {
      setTimeout(() => {
        const g = G.Game;
        if (!g || g.mode === "training" || g.state !== "SHOP" || !g._perkOffer || !g._perkOffer.length) return;
        if (want("perkShop") && !cur && queue[0] === "perkShop" && canShow(g, "perkShop")) show(queue.shift());
      }, 350);
    }, "tips");
    G.Bus.on("attach:unlock", () => want("attachUnlock"), "tips");
  }

  return { IDS, on, want, show, hide, ok, off, reset, update, onKey, get current() { return cur; }, get queue() { return queue.slice(); } };
})();
