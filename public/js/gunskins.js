// ===================================================================
// Gun skins: looks only (expansion, round 5)
// -------------------------------------------------------------------
// A skin repaints a gun by the colour role each of its parts was built with
// (userData.role, js/gunmodels.js and js/entities.js): the receiver, the
// highlights, the barrel and magazine, the blacks, the furniture, the small
// steel, the bevels. What has no role -- the brass, a scope's lens -- and the
// gun's own accent (its stripe, its magazine plate) and everything that glows
// (its sights) are never touched, so every gun stays itself in any skin.
// The skins are js/data/attachments.js G.GUN_SKINS: a measured palette of
// js/gunref.js, or colours of their own, a surface for some roles (paint,
// bare gold) or a pattern tile of js/gunskin.js (ink letters, camouflage).
//   G.GunSkins.apply(group, key)   before js/gunskin.js merges the gun
//   G.GunSkins.colorsOf(key)       the role -> colour table of a skin
// ===================================================================
window.G = window.G || {};

G.GunSkins = (function () {
  // the surface each role has when nothing paints it (js/gunmodels.js roles())
  const BASE = { main: "matte", lit: "worn", dark: "matte", deep: "matte", mid: "worn", alt: "polymer", altLit: "polymer", altMid: "polymer", altDark: "polymer",
    metal: "bare", edge: "bare", glint: "bare", grip: "grip" };
  // a role a skin has no colour for takes the nearest one's
  const FALL = { altLit: "alt", altMid: "alt", altDark: "dark", grip: "dark", glint: "edge", mid: "dark", lit: "main", edge: "lit" };
  function colorsOf(key) {
    const S = G.GUN_SKINS[key];
    if (!S || key === "factory") return null;
    if (S.palette) return (G.GunRef && G.GunRef.PALETTES[S.palette]) || null;
    return S.colors || null;
  }
  function colorFor(C, role) {
    let r = role;
    for (let i = 0; i < 4 && r; i++) { if (C[r] != null) return C[r]; r = FALL[r]; }
    return null;
  }
  function apply(g, key) {
    const S = G.GUN_SKINS[key], C = colorsOf(key);
    if (!S || !C || !g) return false;
    const paint = S.paint === true ? ["main", "lit", "dark"] : (C.paint || []);
    const seen = new Set();
    g.traverse((o) => {
      if (!o.isMesh || !o.material || seen.has(o.material)) return;
      const m = o.material;
      seen.add(m);
      const role = m.userData && m.userData.role;
      if (!role || role === "accent" || role === "attach" || m.isMeshBasicMaterial || !m.color) return;
      const hex = colorFor(C, role);
      if (hex == null) return;
      m.color.setHex(hex);
      let surf = m.userData.roleSkin || BASE[role] || m.userData.skin;
      if (paint.includes(role)) surf = "polymer";
      if (S.on && S.on.includes(role)) surf = S.pattern || S.surface || surf;
      if (surf) m.userData.skin = surf;
    });
    g.userData.skin = key;
    return true;
  }
  return { BASE, FALL, colorsOf, colorFor, apply };
})();
