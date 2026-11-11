// ===================================================================
// Attachments and skins: the tables (expansion, round 5)
// -------------------------------------------------------------------
// js/attachments.js reads these; nothing here runs.
//
// G.ATTACHMENTS  each one a sidegrade -- something better, something worse --
//   slot: optic | muzzle | mag | grip, and its effects, multipliers on the
//   gun's own numbers (1 = unchanged):
//     zoom   how far an optic magnifies when aimed (x, against the eye's view;
//            red dot and holo a little more than iron sights)
//     ads    the time to aim     sway   how much the view drifts when aimed
//     range  where damage starts and stops falling
//     recoilV, recoilH   the kick up and to the side
//     mag, reload        the magazine and its reload
//     hip    the spread from the hip     loud   dB on the shot
//     flash  the muzzle flash (0: none)  sound  "suppressed": the family of js/attachments.js
//     laser  a dot where the gun points from the hip
//   model and its numbers: js/attachments.js builds it (an optic: h its middle
//   over the rail, len, eye its distance from the eye aimed; a muzzle device:
//   r its width against the barrel's; an extended magazine: h how much longer)
// G.ATTACH_FAMILIES  what each weapon family (G.ViewModel.family) can take; a
//   gun with a scope of its own (def.scope, or one on its model) takes no optic
// G.GUN_SKINS        looks only: the colours of each role of a gun's parts (the
//   palettes of js/gunref.js), a pattern tile (js/gunskin.js) on some. A gun's
//   own accent colour and what glows on it never change.
// G.ATTACH_UNLOCKS   what learning unlocks, for good
// G.ATTACH_ADS       where a gun is held when aimed through an optic, set in the
//   Weapon Lab (?lab=weapons): "gunId:optic" -> { y, z, eye }
// ===================================================================
window.G = window.G || {};
// a topic as a key ("Society & Culture" -> "society_culture"), as G.topicLabel makes it
G.topicSlug = (t) => String(t).toLowerCase().replace(/[^a-z]+/g, "_");

G.ATTACHMENTS = {
  // ---- optics: more zoom, slower to aim, more drift ----
  reddot: { slot: "optic", zoom: 1.12, ads: 1.04, sway: 1.08, model: { kind: "dot", h: 0.03, len: 0.045, eye: 0.3 } },
  holo: { slot: "optic", zoom: 1.25, ads: 1.08, sway: 1.14, model: { kind: "holo", h: 0.032, len: 0.06, eye: 0.3 } },
  x2: { slot: "optic", zoom: 2, ads: 1.15, sway: 1.3, model: { kind: "scope", h: 0.036, len: 0.13, r: 0.017, bell: 0.024, eye: 0.17 } },
  x4: { slot: "optic", zoom: 4, ads: 1.25, sway: 1.5, model: { kind: "scope", h: 0.04, len: 0.19, r: 0.019, bell: 0.029, eye: 0.15 } },
  x8: { slot: "optic", zoom: 8, ads: 1.35, sway: 1.75, model: { kind: "scope", h: 0.045, len: 0.27, r: 0.021, bell: 0.035, eye: 0.13 } },
  // ---- the muzzle ----
  suppressor: { slot: "muzzle", sound: "suppressed", flash: 0, range: 0.9, model: { kind: "can", len: 0.17, r: 1.6 } },
  compensator: { slot: "muzzle", recoilV: 0.8, flash: 1.05, model: { kind: "comp", len: 0.055, r: 1.3 } },
  brake: { slot: "muzzle", recoilV: 0.85, recoilH: 0.85, loud: 3, model: { kind: "brake", len: 0.065, r: 1.5 } },
  // ---- the magazine ----
  extended: { slot: "mag", mag: 1.5, reload: 1.1, ads: 1.05, model: { kind: "extended", h: 0.075 } },
  fastmag: { slot: "mag", mag: 0.9, reload: 0.8, model: { kind: "coupled" } },
  // ---- under the barrel ----
  vgrip: { slot: "grip", recoilV: 0.85, recoilH: 0.85, ads: 1.08, model: { kind: "vgrip", h: 0.095 } },
  agrip: { slot: "grip", ads: 0.88, recoilV: 1.05, model: { kind: "agrip", h: 0.06 } },
  laser: { slot: "grip", hip: 0.75, laser: true, model: { kind: "laser" } },
};
G.ATTACH_SLOTS = ["optic", "muzzle", "mag", "grip"];

G.ATTACH_FAMILIES = {
  pistol: { optic: ["reddot"], muzzle: ["suppressor", "compensator"], mag: ["extended", "fastmag"], grip: ["laser"] },
  smg: { optic: ["reddot", "holo", "x2"], muzzle: ["suppressor", "compensator", "brake"], mag: ["extended", "fastmag"], grip: ["vgrip", "agrip", "laser"] },
  rifle: { optic: ["reddot", "holo", "x2", "x4"], muzzle: ["suppressor", "compensator", "brake"], mag: ["extended", "fastmag"], grip: ["vgrip", "agrip", "laser"] },
  lmg: { optic: ["reddot", "holo", "x2", "x4"], muzzle: ["compensator", "brake"], mag: ["extended", "fastmag"], grip: ["vgrip", "agrip"] },
  shotgun_pump: { optic: ["reddot", "holo"], muzzle: ["brake"], mag: ["extended"], grip: ["vgrip", "laser"] },
  shotgun_semi: { optic: ["reddot", "holo"], muzzle: ["brake"], mag: ["extended"], grip: ["vgrip", "laser"] },
  sniper_bolt: { optic: ["x4", "x8"], muzzle: ["suppressor", "brake"], mag: ["extended", "fastmag"], grip: ["laser"] },
  special: { optic: ["reddot", "holo"], muzzle: [], mag: ["extended"], grip: ["laser"] },
};

// the eight base sets: the palettes measured from the clips (js/gunref.js)
// -- black and steel, wood and steel, black and FDE, silver and black, olive
// and black, white and black, gunmetal and brown, black with a blue lens
G.GUN_SKINS = {
  factory: { base: true, palette: null },                  // the gun as it comes
  blackSteel: { base: true, palette: "blackSteel" },
  woodSteel: { base: true, palette: "woodSteel" },
  blackFde: { base: true, palette: "blackFde" },
  silverBlack: { base: true, palette: "silverBlack" },
  odBlack: { base: true, palette: "odBlack" },
  whiteBlack: { base: true, palette: "whiteBlack" },
  gunmetalBrown: { base: true, palette: "gunmetalBrown" },
  darkLens: { base: true, palette: "darkLens" },
  // learning's own
  lexicon: { colors: { main: 0xd9d0b4, lit: 0xece4cc, dark: 0xa89f86, deep: 0x1b1a17, alt: 0x26231d, altLit: 0x3a362d, altMid: 0x2f2b24, altDark: 0x16140f, metal: 0x3a362d, edge: 0xf2ecda, glint: 0xffffff }, pattern: "letters", on: ["main", "lit", "dark"] },
  // (gold paint, its small steel and bevels bare gold: bare metal alone shows only what it reflects, and the levels are at night)
  scholarGold: { colors: { main: 0xc9a23a, lit: 0xe8c867, dark: 0x8c6a20, deep: 0x1c160a, alt: 0x2b2416, altLit: 0x45391f, altMid: 0x3a3020, altDark: 0x1a150c, metal: 0xd9b24a, edge: 0xffe39a, glint: 0xfff4cc }, surface: "polymer", on: ["main", "lit", "dark"] },
  // a story level's every note kept
  level1: { colors: { main: 0x2f4a3a, lit: 0x4f6e5a, dark: 0x1f3327, deep: 0x0e140f, alt: 0x7a5a3a, altLit: 0x93724e, altMid: 0x654a30, altDark: 0x3a2a1b, metal: 0x3a3f3b, edge: 0xb9c2a8, glint: 0xe6efd8 } },
  level2: { colors: { main: 0xdfe6e6, lit: 0xf3f7f7, dark: 0xb5c2c2, deep: 0x1a1f1f, alt: 0x2f8a83, altLit: 0x49a8a0, altMid: 0x2a7770, altDark: 0x15433f, metal: 0x5f6b6b, edge: 0xffffff, glint: 0xffffff }, paint: true },
  level3: { colors: { main: 0x4b4d43, lit: 0x6b6d61, dark: 0x33352d, deep: 0x15160f, alt: 0x5a5a4a, altLit: 0x777763, altMid: 0x4a4a3c, altDark: 0x2a2a20, metal: 0x3a3c36, edge: 0x9a9c8a, glint: 0xd6d6c4 }, pattern: "camo", on: ["main", "lit", "dark", "alt"] },
};
// a topic remembered: its camouflage, in the topic's colours (two tones on the pattern tile)
G.TOPIC_CAMO = {
  "General Academic": [0x4a4f5a, 0x7a8090], "Education": [0x2d4a7a, 0x5f86c4], "Society & Culture": [0x7a3d5c, 0xb06a8c],
  "Media & Communication": [0x6a4a8a, 0x9a7ac0], "Health": [0xd8dcdc, 0xb24a4a], "Science & Research": [0x2d6a6a, 0x5fb0a8],
  "Environment": [0x3d5a2d, 0x7a9a4a], "Technology": [0x2a2e38, 0x4fa0d8], "Government & Law": [0x3a2d22, 0x9a7a4a],
  "Crime & Security": [0x1f1f24, 0x6a6a74], "Work & Economy": [0x5a4a2a, 0xa08a4a], "Urban Life & Transport": [0x5a5a5a, 0xd8a83a],
};
(G.WORD_TOPICS || Object.keys(G.TOPIC_CAMO)).forEach((t) => {
  const c = G.TOPIC_CAMO[t];
  if (!c) return;
  const sh = (hex, k) => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return (f(r) << 16) | (f(g) << 8) | f(b); };
  G.GUN_SKINS["camo_" + G.topicSlug(t)] = { topic: t, pattern: "camo", on: ["main", "lit", "dark", "alt", "altLit", "altMid"],
    colors: { main: c[0], lit: sh(c[0], 1.35), dark: sh(c[0], 0.7), deep: 0x0e0f0a, alt: c[1], altLit: sh(c[1], 1.2), altMid: sh(c[1], 0.85), altDark: sh(c[1], 0.55), metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6 } };
});

// what learning unlocks (for good, for the whole save): the kinds read the
// learning record and never write it
//   remembered  words in box `box` or higher       streak   Daily Review days in a row (the best)
//   families    word families complete              topic    a topic's words remembered, share
//   spellRun    right spellings in a row, no hint   notes    a level's every story note kept
//   bosses      bosses beaten in one run
G.ATTACH_UNLOCKS = [
  { id: "reddot", kind: "remembered", n: 25 },
  { id: "extended", kind: "remembered", n: 50 },
  { id: "x4", kind: "remembered", n: 100 },
  { id: "suppressor", kind: "remembered", n: 250 },
  { id: "skin:scholarGold", kind: "remembered", n: 500 },
  { id: "holo", kind: "streak", n: 3 },
  { id: "fastmag", kind: "streak", n: 7 },
  { id: "agrip", kind: "streak", n: 14 },
  { id: "skin:lexicon", kind: "streak", n: 30 },
  { id: "compensator", kind: "families", n: 5 },
  { id: "brake", kind: "families", n: 15 },
  { id: "laser", kind: "spellRun", n: 20 },
  { id: "x8", kind: "bosses", n: 4 },
  { id: "skin:level1", kind: "notes", level: "level1" },
  { id: "skin:level2", kind: "notes", level: "level2" },
  { id: "skin:level3", kind: "notes", level: "level3" },
].concat((G.WORD_TOPICS || []).map((t) => ({ id: "skin:camo_" + G.topicSlug(t), kind: "topic", topic: t, share: 0.8 })));
// open from the start: the two left over (x2, the vertical grip) and the eight base skins
G.ATTACH_FREE = ["x2", "vgrip"];

// where a gun sits when aimed through an optic, set and saved in the Weapon
// Lab: "gunId:optic" -> { y, z, eye } (the optic's middle up and back from
// the gun's origin, and its distance from the eye). A gun not here is placed
// by the optic's own height on its rail.
G.ATTACH_ADS = {};
