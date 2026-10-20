// Dev-only (not shipped). Visual series (Cinematic Dark Fantasy), round 3:
// the forest round the map, the graphics levels' table, the cutscene's light
// -- js/forest.js, js/world.js, js/game.js, js/audio.js, js/lightfx.js,
// js/visuals.js, js/visual-config.js.
//   L1 a wood all the way round, corners too, in three layers; a road out of
//      the gate; glowing clusters with lights, pools of light and spill; it
//      sways with the grass's wind; hidden indoors and past the fog
//   L2 nothing gets out: a thick wall behind the fence, every move stepped,
//      a Dash at each side stopped; the trees themselves are not in the way
//   L3 nothing is born or dropped out there; the routes stay inside
//   L4 instanced, by side; flat cards for the middle layer on Very Low and
//      Low; shadows from the near layer on High and up only
//   M  the table: the forest by graphics level; everything compiled at load;
//      the far layers fade into the fog before the camera's far end; Very
//      High's puddles mirror the real scene
//   N  a boss's cutscene: a key light and a back light, first in the pool
// Load it into the game (past the Start screen, in the lobby), then:
//   const r = await G.Round20Test.run();   r.fail -> [] when everything passes
window.G = window.G || {};
G.Round20Test = (function () {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info === undefined ? "" : info }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const S = () => G.save.settings;
  const V = () => G.VISUAL;
  const QS = ["vlow", "low", "medium", "high", "vhigh"];
  const F = () => G.Forest;

  async function start(q) {
    const g = G.Game;
    const real = g._upd || g.update;
    G.save.tutorialDone = true;
    S().graphicsQuality = q;
    g.update = real;
    g.startLevel(1);
    g.update = function () {};
    g._r20 = real;
    g.requiredKills = 1e9;
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    G.Modal.reset();
    g.paused = false; g.state = "GAMEPLAY";
    await wait(30);
    return g;
  }
  function step(g, n, at, yaw) {
    for (let i = 0; i < (n || 1); i++) {
      if (at) { g.yawObject.position.copy(at); if (yaw != null) g.yawObject.rotation.y = yaw; }
      g._r20.call(g, 1 / 30);
    }
  }
  const chunks = (pred) => F().chunks.filter(pred);
  const visible = (pred) => chunks((c) => pred(c) && c.mesh.visible && c.mesh.count > 0);

  // ---------------- the configuration ----------------
  function config() {
    const Fc = V().forest;
    ok("L the forest's values in js/visual-config.js (layers, density, colours, glow, sound)",
      Fc && Fc.near === 15 && Fc.mid === 60 && Fc.density && Fc.colors && Fc.glow && Fc.sound && Fc.bands.length >= 2 && Fc.hills);
    ok("M the table has the forest at every graphics level",
      QS.every((q) => { const f = V().quality[q].forest; return f && ["trees", "under", "grass", "mid"].every((k) => typeof f[k] === "number") && typeof f.cards === "boolean" && typeof f.shadows === "boolean"; }));
    const Q = (q) => V().quality[q].forest;
    ok("M less of it the lower the level; cards on Very Low and Low; shadows on High and up",
      Q("vlow").trees <= Q("low").trees && Q("low").trees <= Q("medium").trees && Q("medium").trees <= Q("high").trees
      && Q("vlow").cards && Q("low").cards && !Q("medium").cards && !Q("medium").shadows && Q("high").shadows && Q("vhigh").shadows);
    ok("M the fog takes the far layers later, and wholly before the camera's far end",
      THREE.ShaderChunk.fog_fragment.includes("VZ_FOG_DIST") && THREE.ShaderChunk.fog_fragment.includes("VZ_FOG_END") && Fc.fogEnd < 200);
    ok("L2 the edge of the map's numbers in js/config.js", G.CONFIG.world && G.CONFIG.world.fenceWall >= 2 && G.CONFIG.world.moveStep <= 0.3);
  }

  // ---------------- L1: the wood ----------------
  async function wood() {
    const g = await start("high"), w = g.world, Fo = F(), I = Fo.items, R = Fo.rect;
    ok("L1 the forest is built round the school", Fo.built && Fo.group && Fo.group.parent === g.scene && Fo.chunks.length > 20, Fo.chunks.length + " meshes");
    // all the way round: every 10 degrees out from the middle, trees in the
    // near layer and in the middle one (the road out of the gate excepted)
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    const near = ["leafy", "leafy2", "dead", "pine"].reduce((a, k) => a.concat(I[k]), []), mid = I.pineMid.concat(I.leafyMid);
    const hit = (list, a, d0, d1) => list.some((t) => {
      const ang = Math.atan2(t.z - cz, t.x - cx), da = Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a)));
      return da < 0.09 && t.d >= d0 && t.d <= d1;
    });
    const gapsN = [], gapsM = [];
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * Math.PI * 2;
      // (the road: straight out of the gate, the +z side)
      const road = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.06;
      if (!road && !hit(near, a, 0, 15)) gapsN.push(k * 10);
      if (!hit(mid, a, 15, 60)) gapsM.push(k * 10);
    }
    ok("L1 the near layer all the way round, corners too (every 10 degrees)", !gapsN.length, gapsN.join(","));
    ok("L1 the middle layer all the way round (every 10 degrees)", !gapsM.length, gapsM.join(","));
    ok("L1 the near layer: tall grass, thickets, fallen logs, dead and living trees",
      I.grass.length > 500 && I.bush.length > 100 && I.log.length > 20 && I.dead.length > 40 && I.leafy.length + I.leafy2.length > 60 && I.pine.length > 40,
      JSON.stringify(Fo.stats));
    ok("L1 the layers where they belong (near 0-15 m past the fence, middle 15-60 m)",
      near.every((t) => t.d <= 15.01) && mid.every((t) => t.d >= 14.99 && t.d <= 60.01));
    ok("L1 nothing grows on the road out of the gate", near.concat(mid, I.bush, I.log).every((t) => !(t.z > R.z1 && Math.abs(t.x) < V().forest.road)));
    // far: the bands and the hills, the floor
    ok("L1 far: painted tree lines on bands and a ring of hills; a floor under it all",
      Fo.farMesh && Fo.farMesh.geometry.attributes.position.count > 300 && Fo.hillCount > 100 && Fo.floorMesh && Fo.floorMesh.geometry.index.count > 30000);
    // K: the trunks right by the fence are darker
    const c = new THREE.Color(), dk = { near: 0, nearN: 0, far: 0, farN: 0 };
    chunks((ch) => ch.kind === "dead").forEach((ch) => {
      for (let i = 0; i < ch.max; i++) {
        ch.mesh.getMatrixAt(i, new THREE.Matrix4());
        c.fromArray(ch.mesh.instanceColor.array, i * 3);
        const p = new THREE.Vector3().setFromMatrixPosition((() => { const m = new THREE.Matrix4(); ch.mesh.getMatrixAt(i, m); return m; })());
        const d = Fo.out(p.x, p.z), lum = c.r + c.g + c.b;
        if (d < 2) { dk.near += lum; dk.nearN++; } else if (d > 8) { dk.far += lum; dk.farN++; }
      }
    });
    ok("K the trunks right by the fence darker -- a frame for the view", dk.nearN && dk.farN && dk.near / dk.nearN < dk.far / dk.farN * 0.85, (dk.near / dk.nearN).toFixed(2) + " vs " + (dk.far / dk.farN).toFixed(2));
    // the glow: lights in the pool, pools of light, spill on the floor
    const lights = (G.Perf.anchors || []).filter((a) => a.src && a.src.userData && a.src.userData.lampKind === "forest");
    ok("L1, J the glowing clusters: a few of them lights in the pool (cyan)", lights.length >= 4 && lights.every((a) => a.color.b > a.color.r), lights.length);
    ok("L1, J ...a pool of light on the ground under each", G.LightFX.decalSrc.filter((s) => s.color === V().forest.glow.mushroom || s.color === V().forest.glow.crystal).length >= I.mushrooms.length + I.crystals.length);
    const fc = Fo.floorMesh.geometry.attributes.color.array;
    let cyan = 0; for (let i = 0; i < fc.length; i += 3) if (fc[i + 2] > fc[i] * 1.6 && fc[i + 1] > fc[i] * 1.4) cyan++;
    ok("L1, J ...their colour spilt on the forest floor round them", cyan > 20, cyan + " vertices");
    ok("I the clusters glow (over 1.0: the bloom takes them)", Fo.mat.mushrooms.color.g > 1 && Fo.mat.crystals.color.b > 1);
    ok("G a rim on the trees and hills against the fog", Fo.mat.tree.userData.vzRim && Fo.mat.mid.userData.vzRim && Fo.farMesh.material.userData.vzRim);
    ok("L1 the trees and grass sway with the grass's wind (one shader, js/schooldress.js)",
      [Fo.mat.tree, Fo.mat.bush, Fo.mat.grass, Fo.mat.mid].every((m) => /grass-sway-bend/.test(m.customProgramCacheKey())));
    // (the level's invisible outer walls stand a few metres out too, a side
    // long each: they stay -- what must not be there is a tree's collider)
    const stray = w.colliders.filter((b) => Fo.out((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2) > G.CONFIG.world.fenceWall + 1 && b.max.y > 0.3 && Math.max(b.max.x - b.min.x, b.max.z - b.min.z) < 60);
    ok("L1 nothing of it in the way: no tree or bush has a collider (bullets fly into the wood)", !stray.length, stray.length);
    ok("L2 the level's invisible outer walls are still there, all round", w.colliders.filter((b) => Math.max(b.max.x - b.min.x, b.max.z - b.min.z) > 100 && b.max.y >= 20).length >= 4);
    // shown from outdoors, not indoors; a side past the fog not drawn
    step(g, 3, new THREE.Vector3(0, 1.7, 55), 0);
    g.scene.updateMatrixWorld(true); G.Zones.update(g, true); Fo.update(g, 0, true);
    const outN = visible(() => true).length;
    step(g, 3, new THREE.Vector3(0, 1.7, -10), 0);
    G.Zones.update(g, true); Fo.update(g, 0, true);
    ok("L1 seen from outdoors; not drawn from inside the building", outN > 0 && Fo.group.visible === false, outN + " meshes outdoors");
    step(g, 3, new THREE.Vector3(R.x0 + 4, 1.7, cz), Math.PI / 2);
    G.Zones.update(g, true); Fo.update(g, 0, true);
    const westOn = visible((c) => c.side === 0 && c.layer === "near").length, eastOn = visible((c) => c.side === 1 && c.layer === "near").length;
    ok("L4 by the west fence: the west side drawn, the far east side (past the fog) not", westOn > 0 && eastOn === 0, westOn + " / " + eastOn);
    // sound: the wood heard from its nearest edge
    const L = G.Audio && G.Audio._level;
    ok("L1 the forest heard from the side of it nearest the player (when there is sound)", !G.Audio.ctx || (L && L.forest && L.forest.pan), G.Audio.ctx ? "" : "no audio context here");
    const e = Fo.edgePoint(R.x0 + 4, cz);
    ok("L1 ...its nearest edge from by the west fence is to the west", e.x < R.x0 && Math.abs(e.z - cz) < 0.01);
  }

  // ---------------- L2, L3: the edge ----------------
  async function edge() {
    const g = G.Game, w = g.world, B = w.playBounds, P = g.yawObject.position, C = w.campus;
    ok("L3 the play area recorded: inside the fence, a body's width clear of it", B && B.x0 > C.x0 && B.x1 < C.x1 && B.z0 > C.z0 && B.z1 < C.z1);
    // the wall: at each side, a collider reaching fenceWall metres out
    const W = G.CONFIG.world.fenceWall, sides = [
      ["west", (b) => b.min.x <= C.x0 + 0.5 - W + 0.01 && b.max.x >= C.x0 + 0.5 && b.max.z - b.min.z > 100],
      ["east", (b) => b.max.x >= C.x1 - 0.5 + W - 0.01 && b.min.x <= C.x1 - 0.5 && b.max.z - b.min.z > 100],
      ["back", (b) => b.min.z <= C.z0 + 0.5 - W + 0.01 && b.max.z >= C.z0 + 0.5 && b.max.x - b.min.x > 100],
      ["front", (b) => b.max.z >= C.z1 - 0.5 + W - 0.01 && b.min.z <= C.z1 - 0.5 && b.max.x - b.min.x > 40]];
    ok("L2 a wall " + W + " m thick behind the fence, on every side", sides.every(([, f]) => w.colliders.some(f)), sides.filter(([, f]) => !w.colliders.some(f)).map(([n]) => n).join(","));
    // a Dash at every side, and through the gate: still inside
    const tries = [
      ["west", new THREE.Vector3(B.x0 + 3, 1.7, -20), -1, 0], ["east", new THREE.Vector3(B.x1 - 3, 1.7, -20), 1, 0],
      ["back", new THREE.Vector3(0, 1.7, B.z0 + 3), 0, -1], ["front", new THREE.Vector3(-20, 1.7, B.z1 - 3), 0, 1], ["gate", new THREE.Vector3(0, 1.7, B.z1 - 3), 0, 1],
      ["corner", new THREE.Vector3(B.x0 + 2, 1.7, B.z0 + 2), -0.7, -0.7]];
    const out = [];
    tries.forEach(([name, at, dx, dz]) => {
      P.copy(at);
      const D = G.CONFIG.abilities && G.CONFIG.abilities.dash ? G.CONFIG.abilities.dash.speed : 34;
      for (let i = 0; i < 30; i++) g.tryMove(dx * D / 30, dz * D / 30);           // a second of Dashes, 1/30 s frames
      g.tryMove(dx * 12, dz * 12);                                                 // ...and one huge shove
      if (!G.inPlayArea(w, P.x, P.z, -0.01)) out.push(name + " " + P.x.toFixed(1) + "," + P.z.toFixed(1));
    });
    ok("L2 a Dash and a shove at every side, a corner and the gate: still inside", !out.length, out.join(" | "));
    // ...but a round fired at the forest flies on into it
    // (from just inside the play area's edge: clear of the trees along the fence)
    // (and not where a real wall stands by the fence: the pitch has one, on the west side)
    const shot = [[-1, 0, B.x0 + 0.2, 30], [1, 0, B.x1 - 0.2, -20], [0, -1, 0, B.z0 + 0.2], [0, 1, -20, B.z1 - 0.2]].map(([dx, dz, x, z]) => g.wallDistance(new THREE.Vector3(x, 1.5, z), new THREE.Vector3(dx, 0, dz), 60));
    ok("L2 ...a round fired at the forest is not stopped by the fence or the walls behind it", shot.every((d) => d > 20), shot.map((d) => d.toFixed(1)).join(","));
    // ...and the real Dash, from the abilities (if it can be given here)
    let dash = "n/a";
    if (G.Abilities && G.Abilities.fx && G.Abilities.dash) {
      P.set(B.x0 + 2, 1.7, -20); g.yawObject.rotation.y = Math.PI / 2;          // facing west
      try {
        G.Abilities.dash(G.Abilities, g);
        for (let i = 0; i < 20; i++) G.Abilities.update && G.Abilities.update(g, 1 / 30);
        dash = G.inPlayArea(w, P.x, P.z, -0.01) ? "inside" : "OUT " + P.x.toFixed(1);
      } catch (e) { dash = "n/a (" + String(e).slice(0, 60) + ")"; }
    }
    ok("L2 the Dash ability itself at the fence: still inside", dash !== "OUT" && !/^OUT/.test(dash), dash);
    // nothing born out there: a zombie asked for in the wood comes in
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    const n0 = g.outsideSpawns || 0;
    const zs = [[C.x0 - 10, 0, -20], [C.x1 + 6, 0, 10], [0, 0, C.z0 - 20], [30, 0, C.z1 + 8]].map(([x, y, z]) => g.spawnZombieAt("normal", new THREE.Vector3(x, y, z), null));
    ok("L3 a zombie asked for out in the forest is placed inside", zs.every((z) => z && G.inPlayArea(w, z.mesh.position.x, z.mesh.position.z, 0.1)) && (g.outsideSpawns || 0) - n0 === 4,
      zs.map((z) => z ? z.mesh.position.x.toFixed(1) + "," + z.mesh.position.z.toFixed(1) : "none").join(" "));
    // a zombie shoved out (a blast) comes back in
    const z0 = zs[0];
    if (z0) { z0.emerge = null; z0.mesh.position.set(C.x0 - 5, 0, 0); g.updateZombies(1 / 30); }
    ok("L3 a zombie pushed out past the fence is put back inside", z0 && G.inPlayArea(w, z0.mesh.position.x, z0.mesh.position.z, 0));
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    // drops by the fence land inside, within reach
    const d0 = g.drops.length;
    g.spawnDrop("ammo", new THREE.Vector3(C.x0 - 3, 0, 5));
    g.spawnDrop("money", new THREE.Vector3(B.x1 + 0.2, 0, -30));
    const nd = g.drops.slice(d0);
    ok("L3 a drop by the fence (or past it) lands inside, within reach", nd.length === 2 && nd.every((d) => G.inPlayArea(w, d.mesh.position.x, d.mesh.position.z, G.CONFIG.world.dropMargin - 0.01)));
    nd.forEach((d) => { g.scene.remove(d.mesh); }); g.drops = g.drops.slice(0, d0);
    // the routes and the spawn points: all inside
    const nodes = Object.values(w.waypointNodes || {});
    ok("L3 the routes (the waypoint nodes) never go out into the forest", nodes.every((n) => G.inPlayArea(w, n.x, n.z, -1)), nodes.length + " nodes");
    ok("L3 every spawn point is inside the fence", w.spawnPoints.every((s) => G.inPlayArea(w, s.pos.x, s.pos.z, -0.5)), w.spawnPoints.length + " points");
    // the spawner's own picks, many times, from every corner: none outside
    let bad = 0;
    [[B.x0 + 3, B.z0 + 3], [B.x1 - 3, B.z0 + 3], [B.x0 + 3, B.z1 - 3], [B.x1 - 3, B.z1 - 3]].forEach(([x, z]) => {
      P.set(x, 1.7, z);
      for (let i = 0; i < 40; i++) { const sp = G.Spawner.pickPoint(w, P, new THREE.Vector3(0, 0, -1)); w.spawnPoints.forEach((s) => (s.cooldown = 0)); if (sp && !G.inPlayArea(w, sp.pos.x, sp.pos.z, 0)) bad++; }
    });
    ok("L3 the spawner never picks a place outside, from any corner (160 picks)", bad === 0, bad);
  }

  // ---------------- L4, M: the levels ----------------
  async function levels() {
    const g = G.Game, at = {};
    g.zombies.forEach((z) => g.scene.remove(z.mesh)); g.zombies = [];
    for (const q of QS) {
      S().graphicsQuality = q;
      g.applyGraphicsQuality();
      const all = (pred) => F().chunks.filter(pred);
      at[q] = {
        cards: all((c) => c.kind === "cards" && c.mesh.count > 0).length,
        mid3d: all((c) => (c.kind === "pineMid" || c.kind === "leafyMid") && c.mesh.count > 0).length,
        trees: all((c) => /^(leafy|leafy2|dead|pine)$/.test(c.kind)).reduce((a, c) => a + c.mesh.count, 0),
        cast: all((c) => c.mesh.castShadow).length,
        castMid: all((c) => c.mesh.castShadow && c.layer !== "near").length,
        grass: all((c) => c.kind === "grass").reduce((a, c) => a + c.mesh.count, 0),
      };
    }
    ok("L4 Very Low and Low: the middle layer as cards (impostors); Medium up: as trees",
      at.vlow.cards > 0 && at.low.cards > 0 && !at.vlow.mid3d && !at.low.mid3d && at.medium.mid3d > 0 && !at.medium.cards && at.vhigh.mid3d > 0, JSON.stringify(at));
    ok("L4 fewer trees on the lower levels (Very Low < Low < Medium < High)", at.vlow.trees < at.low.trees && at.low.trees < at.medium.trees && at.medium.trees < at.high.trees);
    ok("L4 shadows: only the near layer's trees and thickets, and only on High and Very High",
      !at.vlow.cast && !at.low.cast && !at.medium.cast && at.high.cast > 0 && at.vhigh.cast > 0 && !at.high.castMid && !at.vhigh.castMid);
    ok("L4 one InstancedMesh per kind and side (few draw calls)", F().chunks.every((c) => c.mesh.isInstancedMesh) && F().chunks.length <= 12 * 4);
    // M: compiled at load (the forest's materials have their programs)
    const props = g.renderer.properties;
    const compiled = F().mats.filter((m) => { const p = props.get(m); return p && (p.program || (p.programs && p.programs.size)); }).length;
    ok("M every shader of the forest compiled during the load", compiled === F().mats.length, compiled + "/" + F().mats.length);
    S().graphicsQuality = "medium"; g.applyGraphicsQuality();
  }

  // the draw calls on Low, at suite 3's places and by the forest -- first, on
  // a level built on Low and nothing else done yet, as suite 3 has it
  async function drawCalls() {
    const g = await start("low");
    const P = g.yawObject.position, counts = {};
    const view = (k, x, y, z, yaw) => { P.set(x, y, z); g.yawObject.rotation.y = yaw; g.scene.updateMatrixWorld(true); G.Zones.update(g, true); if (g.world.dress) g.world.dress.update(0, P); F().update(g, 0, true); g.renderFrame(); counts[k] = g.renderer.info.render.calls - ((G.Visuals && G.Visuals.shadowCalls) || 0); };
    view("gate", 0, 1.7, 72, 0); view("corridor", 0, 1.7, 0, 0); view("classroom", -9.75, 1.7, 13.5, Math.PI / 2); view("field", -34, 1.7, -32, Math.PI / 2);
    view("westFence", -60, 1.7, -20, Math.PI / 2); view("forestEdge", -52, 1.7, 4, Math.PI / 2 + 0.25);
    ok("L4 under 150 draw calls on Low with the forest, by it too", Object.values(counts).every((n) => n < 150), JSON.stringify(counts));
  }

  // ---------------- M: Very High's puddles ----------------
  async function reflections() {
    const g = G.Game, D = G.Details;
    S().graphicsQuality = "vhigh"; g.applyGraphicsQuality();
    const s = D.spots && D.spots[0];
    if (s) { g.yawObject.position.set(s.x + 2, 1.7, s.z + 2); g.scene.updateMatrixWorld(true); G.Zones.update(g, true); }
    const n0 = D.reflected || 0;
    for (let i = 0; i < 12; i++) D.update(g, 1 / 30);
    const live = D.matOut && D.matOut.userData.vzEnvLive;
    ok("M Very High: the puddles out of doors mirror the real scene (a cube camera, a face a frame)",
      s && live && live.on && D.matOut.envMap === D.cubeRT.texture && (D.reflected || 0) - n0 >= 6, (D.reflected || 0) - n0 + " faces");
    S().graphicsQuality = "high"; g.applyGraphicsQuality();
    ok("M ...High and below: the night sky, as before", D.matOut && D.matOut.envMap !== (D.cubeRT && D.cubeRT.texture) && !D.matOut.userData.vzEnvLive.on);
    S().graphicsQuality = "medium"; g.applyGraphicsQuality();
  }

  // ---------------- N: a boss's cutscene ----------------
  async function cine() {
    const g = G.Game, H = G.LightFX.heroes.cine, A = G.Perf.anchors || [];
    const ak = A.find((a) => a.key === "cineKey"), ab = A.find((a) => a.key === "cineBack");
    ok("N a key light and a back light for a boss's cutscene, off until one plays", H && ak && ab && ak.base === 0 && ab.base === 0);
    // play a pretend one: a boss at the field's middle, the camera in front
    const CS = G.Cutscene, saved = { active: CS.active, ctx: CS.ctx };
    CS.ensure();
    const boss = { pos: new THREE.Vector3(-34, 0, -30), rig: { H: 4 } };
    CS.camera.position.set(-34, 3, -20); CS.camera.updateMatrixWorld(true);
    CS.active = true; CS.ctx = { b: boss, F: 0 };
    for (let i = 0; i < 40; i++) G.LightFX.update(g, 1 / 30);
    G.Perf.updateLights(CS.camera.position, new THREE.Vector3(0, 0, -1), 1);
    const inPool = (a) => G.Perf.pool.some((l) => l.position.distanceTo(a.pos) < 0.01 && l.intensity > 0);
    const keyFront = ak.pos.z > boss.pos.z + 1, backBehind = ab.pos.z < boss.pos.z - 1;
    ok("N ...lit while it plays: the key between the camera and the boss, the back light behind it, both in the pool",
      ak.base > V().hero.cine.key.intensity * 0.8 && ab.base > V().hero.cine.back.intensity * 0.8 && keyFront && backBehind && inPool(ak) && inPool(ab),
      ak.base.toFixed(2) + " / " + ab.base.toFixed(2));
    CS.active = saved.active; CS.ctx = saved.ctx;
    for (let i = 0; i < 60; i++) G.LightFX.update(g, 1 / 30);
    ok("N ...and out again after it", ak.base < 0.05 && ab.base < 0.05);
  }

  async function run() {
    results.length = 0;
    const errs = [];
    const oe = console.error;
    console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); oe.apply(console, a); };
    let lost = false;
    const onLost = () => { lost = true; };
    G.Game.renderer.domElement.addEventListener("webglcontextlost", onLost);
    const backup = JSON.stringify(G.save);
    const realLock = G.Input.requestPointerLock;
    G.Input.requestPointerLock = function () {};
    try {
      config();
      await drawCalls();
      await wood();
      await edge();
      await levels();
      await reflections();
      await cine();
    } catch (e) {
      ok("ran to the end", false, String(e && e.stack || e).slice(0, 400));
    } finally {
      console.error = oe;
      G.Game.renderer.domElement.removeEventListener("webglcontextlost", onLost);
      G.Input.requestPointerLock = realLock;
      if (G.Bosses) { G.Bosses.phase = null; G.Bosses.arena = null; }
      if (G.Cutscene && G.Cutscene.active && !G.Cutscene.ctx) G.Cutscene.active = false;
      G.Modal.reset();
      if (G.Game._r20) { G.Game.update = G.Game._r20; }
      if (G.Game.state !== "MENU") G.Game.quitToMainMenu();
      G.save = G.normalizeSave(JSON.parse(backup)); G.persist();
      G.UI.goToMainMenu();
    }
    ok("no shader errors, no lost WebGL context, no uncaught errors", !errs.length && !lost, errs.slice(0, 2).join(" | "));
    return { total: results.length, fail: results.filter((r) => !r.pass), pass: results.filter((r) => r.pass).map((r) => r.name + (r.info !== "" ? " [" + r.info + "]" : "")) };
  }
  return { run };
})();
