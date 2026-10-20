// ===================================================================
// The sound bank (overhaul, round 3)
// -------------------------------------------------------------------
// Every sound event the game plays, by id: which kind of voice it is (its
// limit -- G.CONFIG.audio.limits), which bus it goes to, and how it is
// made. Today every one is a recipe synthesised in js/audio.js and
// js/gunaudio.js -- the game ships no audio files. An event may later take
// recorded files instead (`files`: paths under assets/sfx/, played as
// buffers through the same voice and bus), CC0 only, each listed in
// CREDITS with where it came from. The Sound Lab (?lab=sound) plays each
// entry from here.
//   cat   weapons | impact | zombie | steps | sfx | ui | ambient
//   play(pos)   the recipe (pos: where in the world, or null)
// ===================================================================
window.G = window.G || {};

(function () {
  const A = () => G.Audio, GA = () => G.GunAudio;
  const gun = () => G.WEAPON_DEFS[(G.Game && G.Game.player && G.Game.player.gunSlots[0]) || "pistol"] || G.WEAPON_DEFS.pistol;
  const SURF = ["concrete", "tile", "wood", "metal", "glass", "grass", "dirt", "water", "flesh"];
  const STEP = ["concrete", "tile", "wood", "metal", "grass", "dirt", "water"];
  const B = {
    // ---- the player's gun (weapons bus) ----
    "weapon.fire":      { cat: "weapons", play: () => GA().shot(gun(), {}) },
    "weapon.dryfire":   { cat: "weapons", play: () => A().sfx("empty") },
    "weapon.lowammo":   { cat: "ui", play: () => A().sfx("lowammo") },
    "weapon.noreserve": { cat: "ui", play: () => A().sfx("deny") },
    "weapon.holster":   { cat: "weapons", play: () => GA().holster(gun()) },
    "weapon.draw":      { cat: "weapons", play: () => GA().draw(gun()) },
    "weapon.inspect":   { cat: "weapons", play: () => GA().inspect(gun()) },
    // ---- world (sfx bus) ----
    "explosion":        { cat: "sfx", play: (p) => A().explosion(p, false) },
    "explosion.big":    { cat: "sfx", play: (p) => A().explosion(p, true) },
    "door.open":        { cat: "sfx", play: (p) => A().slideDoor(true, p, 0.6, false) },
    "door.shut":        { cat: "sfx", play: (p) => A().doorStop(true, p, false) },
    "glass.break":      { cat: "sfx", play: (p) => A().sfx("glass_break", { pos: p }) },
    "zombie.growl":     { cat: "zombie", play: (p) => A().zombie("growl", "normal", p) },
    "zombie.hurt":      { cat: "zombie", play: (p) => A().zombie("hurt", "normal", p) },
    "zombie.death":     { cat: "zombie", play: (p) => A().zombie("death", "normal", p) },
    "zombie.fast":      { cat: "zombie", play: (p) => A().zombie("growl", "fast", p) },
    "warn.heartbeat":   { cat: "sfx", play: () => A().sfx("heartbeat") },
    "warn.breath":      { cat: "sfx", play: () => A().sfx("breath") },
    "warn.behind":      { cat: "sfx", play: (p) => A().sfx("behind", { pos: p }) },
    "player.hurt":      { cat: "sfx", play: () => A().sfx("hurt") },
    // ---- menus and answers (ui bus: heard while paused) ----
    "ui.correct":       { cat: "ui", play: () => A().sfx("correct") },
    "ui.wrong":         { cat: "ui", play: () => A().sfx("wrong") },
    "ui.purchase":      { cat: "ui", play: () => A().sfx("purchase") },
    "ui.pickup":        { cat: "ui", play: () => A().sfx("pickup") },
    "ui.unlock":        { cat: "ui", play: () => A().sfx("unlock") },
    "ui.tick":          { cat: "ui", play: () => A().sfx("tick") },
    "ui.shopWarn":      { cat: "ui", play: () => A().sfx("shop_warn") },
  };
  // a reload's steps, each on the hand's own frame (G.WeaponSM's markers)
  ["start", "out", "grab", "in", "slap", "bolt", "cover", "shell", "pump", "done", "land"].forEach((k) => {
    B["reload." + k] = { cat: "weapons", play: () => GA().reload(k, gun()) };
  });
  // a round landing, by what it hit (js/surface.js)
  SURF.forEach((s) => { B["impact." + s] = { cat: "impact", play: (p) => A().impact(s, p) }; });
  // footsteps, by what is underfoot; the landing after a jump
  STEP.forEach((s) => { B["step." + s] = { cat: "steps", play: (p) => A().footstep(s, false, { pos: p }) }; });
  B["step.land"] = { cat: "steps", play: () => A().footstep("concrete", false, { land: true }) };
  Object.keys(B).forEach((id) => { B[id].files = B[id].files || []; });
  G.SOUND_BANK = B;
  // recorded sounds in use, and where each came from (CC0) -- none yet
  G.SOUND_CREDITS = [];
})();
