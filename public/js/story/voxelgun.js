// ===================================================================
// The pistol in hand, built of blocks (story series, round 5)
// -------------------------------------------------------------------
// Sgt. Chai's pistol as the chapter's style sheet has everything: square
// edges, flat colour, the block atlas's pixels (js/story/voxeltex.js) --
// a few millimetres each at this size. It is built on the game's own pistol
// (js/gunmodels.js), so it is held, aimed, fired and reloaded exactly as that
// one: its moving parts (the slide -- "bolt" -- and the magazine) and its
// anchors (the muzzle, the grip, the magazine well...) stay; only what is
// drawn on them becomes boxes. A chapter's level only (js/game.js
// buildWeaponViewModel / viewModelOf); a gun with no blocks of its own here
// is left as it is.
//   G.VoxelGun.apply(mesh, def)   true when the gun was rebuilt
//   G.VoxelGun.has(def)
// ===================================================================
window.G = window.G || {};

G.VoxelGun = (function () {
  const V = () => G.Voxel;
  // [part ("root" | "bolt" | "mag"), tile, x0, y0, z0, x1, y1, z1, brightness] in the part's own
  // space, metres (the gun points -z; the slide's group sits 3.5 cm up, the magazine's in the grip)
  const PISTOL = [
    // the slide: back on every shot and at the end of a reload
    ["bolt", "metalDark", -0.022, -0.026, -0.158, 0.022, 0.043, 0.117, 0.95],
    ["bolt", "metalDark", 0.0221, 0.006, -0.004, 0.0231, 0.03, 0.044, 0.38],         // the ejection port
    ["bolt", "metalDark", -0.006, -0.012, -0.1592, 0.006, 0, -0.1575, 0.1],         // the bore
    ["bolt", "metalDark", -0.004, 0.043, -0.152, 0.004, 0.052, -0.138, 0.7],          // the front sight
    ["bolt", "metalDark", -0.016, 0.043, 0.098, -0.006, 0.053, 0.112, 0.7],           // the rear sight's posts
    ["bolt", "metalDark", 0.006, 0.043, 0.098, 0.016, 0.053, 0.112, 0.7],
    // the frame
    ["root", "metalDark", -0.021, -0.02, -0.142, 0.021, 0.009, 0.112, 0.75],          // under the slide
    ["root", "metalDark", -0.023, -0.165, 0.028, 0.023, -0.02, 0.122, 0.62],         // the grip
    ["root", "metalDark", -0.006, -0.072, -0.044, 0.006, -0.02, -0.033, 0.75],        // the trigger guard
    ["root", "metalDark", -0.006, -0.074, -0.044, 0.006, -0.064, 0.03, 0.75],
    ["root", "metal", -0.003, -0.06, -0.008, 0.003, -0.02, 0.002, 1.0],              // the trigger
    ["root", "metalDark", -0.0235, -0.006, 0.02, -0.0215, 0.004, 0.05, 0.5],         // the slide stop
    // the magazine: out and in on a reload
    ["mag", "metalDark", -0.018, -0.148, -0.024, 0.018, -0.004, 0.056, 0.8],
    ["mag", "metal", -0.021, -0.154, -0.027, 0.021, -0.141, 0.06, 1.0],             // its floorplate
  ];
  // the slide's grip grooves, both sides at the back
  for (let i = 0; i < 4; i++) {
    const z = 0.07 + i * 0.011;
    PISTOL.push(["bolt", "metalDark", 0.0221, -0.012, z, 0.0227, 0.034, z + 0.005, 0.4], ["bolt", "metalDark", -0.0227, -0.012, z, -0.0221, 0.034, z + 0.005, 0.4]);
  }
  // the sights' glowing dots
  const DOTS = [["bolt", 0, 0.0475, -0.145], ["bolt", -0.011, 0.048, 0.106], ["bolt", 0.011, 0.048, 0.106]];
  const BUILT = { pistol: { boxes: PISTOL, dots: DOTS } };
  const has = (def) => !!(def && BUILT[def.id]);

  function apply(mesh, def) {
    const B = def && BUILT[def.id];
    if (!B || !mesh || !G.Voxel) return false;
    const parts = (mesh.userData && mesh.userData.parts) || {};
    const groupOf = (k) => (k === "root" ? mesh : parts[k] || null);
    // what the gun itself drew goes (the groups, the anchors and anything fitted to it -- an
    // attachment, decision D10 -- stay)
    const own = new Set([mesh, parts.bolt, parts.mag].filter(Boolean)), old = [];
    mesh.traverse((o) => { const sk = o.isMesh && o.material && o.material.userData && o.material.userData.gunSkin; if (o.isMesh && own.has(o.parent) && (sk === "world" || sk === "glow")) old.push(o); });
    old.forEach((o) => { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); });
    // one buffer of boxes a group: a draw call each
    const bufs = {};
    B.boxes.forEach((b) => {
      const k = groupOf(b[0]) ? b[0] : "root";
      const buf = bufs[k] || (bufs[k] = new (V().Buf)(true));
      V().addBox(buf, b[2], b[3], b[4], b[5], b[6], b[7], V().faceTiles(b[1]), { mode: "meter", unit: 0.05, color: b[8] });
    });
    Object.keys(bufs).forEach((k) => {
      const m = new THREE.Mesh(bufs[k].geometry(), V().mat("block"));
      m.name = "voxelgun:" + k;
      m.userData.voxelGun = true;
      groupOf(k).add(m);
    });
    // the dots: unlit
    const dots = {};
    B.dots.forEach((d) => {
      const k = groupOf(d[0]) ? d[0] : "root", s = 0.0022;
      const buf = dots[k] || (dots[k] = new (V().Buf)(false));
      V().addBox(buf, d[1] - s, d[2] - s, d[3] - s, d[1] + s, d[2] + s, d[3] + s, V().faceTiles("exitSign"), {});
    });
    Object.keys(dots).forEach((k) => {
      const m = new THREE.Mesh(dots[k].geometry(), V().mat("glow"));
      m.name = "voxelgun-dots:" + k;
      m.userData.voxelGun = true;
      groupOf(k).add(m);
    });
    mesh.userData.voxelGun = true;
    return true;
  }

  return { apply, has, BUILT };
})();
