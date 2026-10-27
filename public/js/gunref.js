// ===================================================================
// The guns of the reference clips (gun reference pass)
// -------------------------------------------------------------------
// docs/reference/guns/GUN_REFERENCE.md measured nine guns in three screen
// recordings. They become nine PROTOTYPES, A-I, that the game's own guns are
// built and voiced from -- each gun keeps its own (made-up) name, its
// damage, its handling and its own accent colour:
//
//   A  belt-fed LMG       black receiver, olive ammo box, brass belt; a rear
//                         sight with two tall ears round a green octagon
//   B  long rifle         wood and black steel, a tall front post, steel cases
//   C  two-tone SMG       black top, sand (FDE) lower with a pixel camo,
//                         green tritium bars, a red mark
//   D  polymer pistol     a boxy slide, a cyan "U" night sight
//   E  steel .45          gunmetal, a polished top flat, brown grips; spun on
//                         the draw, a big star of a flash
//   F  .50 anti-materiel  silver with a row of triangular cut-outs, a block
//                         brake, a tall frame sight with a cyan chevron
//   G  chassis sniper     black, an octagon peep with wings, a green post
//   H  white sniper       white and black under a big black scope
//   I  dark sniper        near-black, a big scope with a faceted blue lens
//
// Which prototype a gun is follows from its archetype (G.inferArchetype or
// its own `archetype`, js/entities.js) -- or `proto` on its definition. The
// colours are the measured ones (section 3, images/10_palette_measured.png):
// a few shades of each material -- black is never one black -- and the gun's
// own colour (its definition's `color`) as the accent on a few small parts.
// The numbers to tune are G.CONFIG.gunRef; the shapes js/gunmodels.js; the
// sounds js/gunaudio.js.
// ===================================================================
window.G = window.G || {};

G.GunRef = (function () {
  // ---- the palettes (measured, section 3; a little lifted for the night) ----
  // main: the receiver, lit/dark: its lit and shaded facets, deep: the
  // darkest parts, alt*: the second material, metal: small steel parts,
  // edge: the light bevel along the top, glint: a bright worn edge;
  // paint: the roles that are painted or moulded, not bare metal (they do not
  // mirror the night sky -- a white stock stays white in the dark)
  const PALETTES = {
    odBlack: { main: 0x1d2019, lit: 0x494d49, dark: 0x0e0f0a, deep: 0x0a0a06, alt: 0x3c4733, altLit: 0x919d81, altMid: 0x5f6b52, metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6, brass: 0xcebb75 },
    odSand: { main: 0x1d2019, lit: 0x494d49, dark: 0x0e0f0a, deep: 0x0a0a06, alt: 0x5f4f41, altLit: 0x8e745a, altMid: 0x6f5d4a, metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6, brass: 0xcebb75 },
    woodSteel: { main: 0x202426, lit: 0x6d716f, dark: 0x181b17, deep: 0x0e0f0a, alt: 0x806753, altLit: 0x977b63, altMid: 0x5e4a3b, altDark: 0x2a221b, metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6 },
    woodBlack: { main: 0x1d2019, lit: 0x494d49, dark: 0x0e0f0a, deep: 0x0a0a06, alt: 0x5e3f2c, altLit: 0x7a5640, altMid: 0x4a3122, altDark: 0x1e1a16, metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6 },
    blackFde: { main: 0x13120c, lit: 0x2f3033, dark: 0x0e0f0a, deep: 0x080806, alt: 0x8e745a, altLit: 0x9c8164, altMid: 0x5f4f41, altDark: 0x332d24, metal: 0x2f3033, edge: 0x89877a, glint: 0xcecbb6, red: 0x8c2e32 },
    blackGrey: { main: 0x13120c, lit: 0x2f3033, dark: 0x0e0f0a, deep: 0x080806, alt: 0x6d716f, altLit: 0x84887d, altMid: 0x494d49, altDark: 0x2b2d2b, metal: 0x2f3033, edge: 0x89877a, glint: 0xcecbb6, red: 0x8c2e32 },
    polyBlack: { main: 0x2b302d, lit: 0x494d49, dark: 0x1d2019, deep: 0x0e0f0a, alt: 0x1d2019, altLit: 0x3a3f3b, metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6, paint: ["dark"] },
    polyFde: { main: 0x2b302d, lit: 0x494d49, dark: 0x1d2019, deep: 0x0e0f0a, alt: 0x6f5d4a, altLit: 0x8e745a, metal: 0x2f3033, edge: 0x84887d, glint: 0xcecbb6, paint: ["dark"] },
    gunmetalBrown: { main: 0x24231d, lit: 0x91938d, dark: 0x111109, deep: 0x0e0f0a, alt: 0x372b1b, altLit: 0x5a4630, metal: 0x494d49, edge: 0x91938d, glint: 0xcecbb6 },
    steelBlack: { main: 0x5c6260, lit: 0xabb0a9, dark: 0x3b3e38, deep: 0x161914, alt: 0x1d2019, altLit: 0x2f3033, metal: 0x494d49, edge: 0xabb0a9, glint: 0xcecbb6 },
    silverBlack: { main: 0xabb0a9, lit: 0xc4c8c1, mid: 0x5c6260, dark: 0x3b3e38, deep: 0x161914, alt: 0x161914, altLit: 0x2f3033, metal: 0x5c6260, edge: 0xcecbb6, glint: 0xe4e6e0, paint: ["main", "lit"] },
    blackSteel: { main: 0x131410, lit: 0x494d49, lit2: 0x5d615f, dark: 0x2d2e28, deep: 0x0e0f0a, alt: 0x2d2e28, altLit: 0x494d49, metal: 0x494d49, knob: 0x33352a, edge: 0x84887d, glint: 0xcecbb6 },
    whiteBlack: { main: 0xe2e5e8, lit: 0xf1f2f3, dark: 0xb3b9c2, deep: 0x0e0f0a, alt: 0x2e3640, altLit: 0x3d4652, scope: 0x17181c, scopeLit: 0x2b313a, metal: 0x2e3640, edge: 0xcecbb6, glint: 0xffffff, paint: ["main", "lit", "dark"] },
    darkLens: { main: 0x1e1515, lit: 0x36221b, dark: 0x170d0e, deep: 0x0e0909, alt: 0x17181c, altLit: 0x2b313a, scope: 0x17181c, scopeLit: 0x2b313a, lens: 0x253045, lensLit: 0x49546a, amber: 0xa47829, metal: 0x2b313a, edge: 0x5d615f, glint: 0xcecbb6 },
  };
  // the emissive sights (section 1, item 4)
  const GLOW = { tritium: 0x6bf772, post: 0x83f489, ring: 0x6cd45f, cyan: 0x84f3ee, dot: 0xf2f2e6, red: 0xff3b3b, amber: 0xffb43b };

  // ---- the prototypes ----
  // palettes: the first is the reference gun's own; the rest give the other
  // guns of the prototype their variety (by the gun's id and level)
  // sight / muzzle / casing / flash (S M L XL): what the model and the
  // effects use; action: what happens between shots; draw / holster /
  // inspect: the animation's style; reload: the timeline of the reload
  const PROTOS = {
    A: { family: "lmg", palettes: ["odBlack", "odSand"], sight: "ears", muzzle: "hider", casing: "brassLinks", flash: "M", action: "auto", draw: "heavy", inspect: "turn", reload: "belt" },
    B: { family: "rifle", palettes: ["woodSteel", "woodBlack", "blackGrey"], sight: "post", muzzle: "slant", casing: "steel", flash: "M", action: "auto", draw: "standard", inspect: "magCheck", reload: "ak" },
    C: { family: "smg", palettes: ["blackFde", "blackGrey"], sight: "tritium", muzzle: "comp", casing: "brass", flash: "M", action: "auto", draw: "standard", inspect: "magCheck", reload: "smg" },
    D: { family: "pistol", palettes: ["polyBlack", "polyFde"], sight: "nightU", muzzle: "none", casing: "pistol", flash: "S", action: "semi", draw: "standard", inspect: "turn", reload: "pistol" },
    E: { family: "pistol", palettes: ["gunmetalBrown", "steelBlack"], sight: "classic", muzzle: "none", casing: "pistol", flash: "L", action: "semi", draw: "spin", inspect: "turn", reload: "pistol45" },
    F: { family: "sniper", palettes: ["silverBlack"], sight: "frameU", muzzle: "blockBrake", casing: "fifty", flash: "XL", action: "bolt", draw: "heavy", holster: "swingUp", inspect: "turn", reload: "bolt50" },
    G: { family: "sniper", palettes: ["blackSteel"], sight: "peep", muzzle: "none", casing: "brass", flash: "S", action: "bolt", draw: "flourish", inspect: "turn", reload: "bolt" },
    H: { family: "sniper", palettes: ["whiteBlack"], sight: "scope", muzzle: "none", casing: "brass", flash: "S", action: "bolt", draw: "standard", inspect: "turn", reload: "boltClip" },
    I: { family: "sniper", palettes: ["darkLens"], sight: "scopeLens", muzzle: "none", casing: "brass", flash: "S", action: "bolt", draw: "standard", inspect: "turn", reload: "boltClip" },
  };
  // the game's gun standing in for each gun of the clips: its sound is held
  // to section 5's numbers (tools/gun-sound-check.js) and its rate of fire
  // to the clip's
  const FLAGSHIP = { A: "last_stand", B: "void_principal", C: "scrap_spitter", D: "pistol", E: "nut_cracker", F: "overwatch", G: "sniper", H: "vital_sign", I: "honor_roll" };

  function seed(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }

  // which prototype a gun is (null: none of the clips' -- shotguns,
  // launchers, the energy and beam guns keep their own build)
  function proto(def) {
    if (!def || def.id === "melee") return null;
    if (def.proto !== undefined) return def.proto;
    const a = G.WEAPON_ARCHETYPES && G.WEAPON_ARCHETYPES[def.archetype] ? def.archetype : G.inferArchetype(def);
    switch (a) {
      case "pistol": return def.damage >= 20 ? "E" : "D";
      case "smg": return "C";
      case "rifle": return "B";
      // a long magazine is the belt (or a chain or a drum by its name)
      case "lmg": return def.magSize >= 50 || /chain|belt|drum/.test(def.id) ? "A" : "B";
      // the biggest are the .50s; a semi-automatic marksman's rifle is the
      // dark scoped one; the hospital's are white
      case "sniper": return def.damage >= 200 ? "F" : def.fireRate < G.CONFIG.gunRef.bolt.minInterval * 1000 ? "I" : def.level === 2 ? "H" : "G";
    }
    return null;
  }
  const cache = {};
  // everything the model, the effects and the sounds need to know of a gun
  function info(def) {
    if (!def) return null;
    if (cache[def.id] !== undefined) return cache[def.id];
    const key = proto(def);
    if (!key) { cache[def.id] = null; return null; }
    const P = PROTOS[key], R = seed(def.id + ":ref");
    const flag = FLAGSHIP[key] === def.id;
    // the palette: the reference gun's own for the stand-in, else one of the
    // prototype's by the gun's id (the hospital leans to the lighter ones)
    let pi = 0;
    if (!flag && P.palettes.length > 1) {
      pi = Math.floor(R() * P.palettes.length);
      if (def.level === 2 && P.palettes.length > 1 && R() < 0.5) pi = P.palettes.length - 1;
    }
    const bolt = P.action === "bolt" && def.fireRate >= G.CONFIG.gunRef.bolt.minInterval * 1000;
    const out = {
      proto: key, flagship: flag, palette: P.palettes[pi], pal: PALETTES[P.palettes[pi]],
      sight: P.sight, muzzle: P.muzzle, casing: P.casing, flash: P.flash,
      action: P.action === "bolt" ? (bolt ? "bolt" : "semi") : (def.auto ? "auto" : "semi"),
      draw: P.draw, holster: P.holster || "standard", inspect: P.inspect, reload: P.reload, family: P.family,
      accent: def.color, glow: GLOW,
    };
    cache[def.id] = out;
    return out;
  }
  // the bolt's steps for a gun, in seconds after the shot (squeezed if it fires sooner)
  function boltSteps(def) {
    const I = info(def);
    if (!I || I.action !== "bolt") return null;
    const B = G.CONFIG.gunRef.bolt, T = I.proto === "F" ? B.F : B.G;
    const settle = T.settle, iv = def.fireRate / 1000;
    const k = Math.min(1, Math.max(0.3, (iv - 0.05) / settle));
    const out = { scale: k };
    Object.keys(T).forEach((s) => { if (s !== "dip") out[s] = T[s] * k; });
    if (T.dip) out.dip = [T.dip[0] * k, T.dip[1] * k, T.dip[2]];
    return out;
  }
  return { PALETTES, GLOW, PROTOS, FLAGSHIP, proto, info, boltSteps, seed, _cache: cache };
})();
