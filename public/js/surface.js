// ===================================================================
// What a surface is made of (overhaul, round 2)
// -------------------------------------------------------------------
// One set of surface types for everything that asks: where a round lands
// (js/fx.js: its chips and its hole), and -- round 3 -- what it sounds like
// and what footsteps sound like on it:
//   concrete, tile, wood, metal, glass, grass, dirt, water, flesh
//
//   G.Surface.tag(box, type)          a collider says what it is (doors,
//                                     rails, crates, bins, trees, fences...)
//   G.Surface.floor(world, x, z, y)   the floor under a point: the room's own
//                                     floor (a library's boards, a toilet's
//                                     tiles), a corridor, the grounds' grass
//   G.Surface.wall(world, box, p)     a wall or a thing in the way: its tag,
//                                     else by the level and by its shape
//                                     (low = furniture, thin = a post or rail)
// ===================================================================
window.G = window.G || {};

G.Surface = {
  TYPES: ["concrete", "tile", "wood", "metal", "glass", "grass", "dirt", "water", "flesh"],
  // a room type's floor (js/schoolrooms.js TYPES) as a surface
  ROOM_FLOOR: { wood: "wood", lino: "tile", tileWhite: "tile", tileGrey: "tile", chequer: "tile", concrete: "concrete",
    carpetBlue: "dirt", carpetGrey: "dirt", carpetRed: "dirt", carpetBrown: "dirt" },

  tag(box, type) { if (box) box.surface = type; return box; },

  theme() { const g = G.Game; return (g && g.level && g.level.theme) || "school"; },

  floor(world, x, z, y) {
    const theme = this.theme();
    // a puddle (js/details.js) -- water
    const D = G.Details;
    if (D && D.puddles) for (const m of D.puddles) {
      if (!m.visible) continue;
      const p = m.position, r = (m.userData && m.userData.radius) || 0.9;
      if (Math.abs(p.x - x) < r && Math.abs(p.z - z) < r && Math.abs(p.y - (y || 0)) < 0.6) return "water";
    }
    const region = G.getRegionAt(world, x, z, y) || "";
    if (/^YARD/.test(region) || region === "") return theme === "bunker" ? "dirt" : "grass";
    if (theme === "bunker") return "concrete";
    const type = world && world.roomTypeOf && world.roomTypeOf[region];
    if (type && G.SchoolRooms && G.SchoolRooms.TYPES[type]) return this.ROOM_FLOOR[G.SchoolRooms.TYPES[type].floor] || "tile";
    return theme === "hospital" ? "tile" : /^C\d/.test(region) ? "tile" : "concrete";
  },

  wall(world, box, p) {
    if (box && box.surface) return box.surface;
    const theme = this.theme();
    if (!box) return theme === "school" ? "concrete" : theme === "hospital" ? "tile" : "concrete";
    const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y, sz = box.max.z - box.min.z;
    const thin = Math.min(sx, sz);
    // a post, a pole, a rail: thin both ways
    if (sx < 0.3 && sz < 0.3) return "metal";
    // furniture: low, standing on the floor
    const floorY = world ? G.getFloorHeightAt(world, (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, box.min.y + 0.1) : 0;
    if (sy < 1.4 && box.min.y <= floorY + 0.15 && thin < 1.5) return theme === "school" ? "wood" : "metal";
    if (theme === "bunker") return thin < 0.25 ? "metal" : "concrete";
    if (theme === "hospital") return p && p.y - floorY < 1.2 ? "tile" : "concrete";
    return "concrete";
  },
};
