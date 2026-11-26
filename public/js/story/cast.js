// ===================================================================
// The people of a scene, and what it brings (story series, round 5)
// -------------------------------------------------------------------
// A scene puts people (built of blocks, js/story/voxelchars.js) and things
// (js/story/voxelprops.js) on the chapter's map: there while it is played,
// gone with it. A person is no zombie -- nothing shoots it, nothing it does
// hurts -- it stands, sits, walks a path, follows the player along the way
// they walked, talks, turns into its zombie self, and can carry a word over
// its head (the glasses' warning: drawn with the world, so it shows before
// the glasses' own word layer is on).
//   scene.cast   [{ id, who, at: { x, y, z }, yaw, pose, follow, hidden, label }]
//                who: a look of js/story/voxelchars.js (the person's own id when left out)
//   (round 7: `seat` the height it sits at -- a bed, not a chair)
//   scene.props  [{ id, kind, at: { x, y, z }, yaw, o, collider }]   (round 7: rx / rz a thing knocked
//                over -- a desk on its side; `dynamic` a box that moves with it: js/story/push.js)
//
//   G.StoryCast.enter(game, run, scene)   the last scene's taken away, this one's put there
//   G.StoryCast.act(game, run, o)         a scene's ["npc", { id, ... }]:
//       walk: { x, z } | [{ x, z }, ...], speed   along a path, the floor's height under it
//       face: "player" | { x, z } | yaw            turned (eased)
//       pose: stand | sit | floor | carry | zombie | slump | scratch | bang (round 6: fists on glass) |
//             push | hurt | hurtSit | treat (round 7: a shelf pushed, an arm cut, a cut seen to) |
//             ext | spray (round 9: a fire extinguisher held, and used) | console (hands on the PA desk) |
//             megaphone (one arm up, a megaphone at the mouth)
//       carry: kind | { kind, at: [x, y, z], scale, rx, ry } | null   something in the hands (round 9: where)
//       follow: true | false                       behind the player, on the way they walked
//       talk: seconds                              the head and a hand moving with a line
//       turn: look                                 its zombie self (a flicker of blue first)
//       label: { word, flicker, color } | null     a word over its head
//       lunge: true | false                        comes at the player (a QTE shoves it: knock)
//       knock: metres                              shoved back from the player
//       to: { x, y, z, yaw }                       put there at once
//       show / hide / remove: true
//   G.StoryCast.prop(game, d) / unprop(game, id)   a scene's ["prop", d] / ["unprop", id]
//   G.StoryCast.update(game, dt)                    each frame of a chapter
//   G.StoryCast.arrived(id) / near(game, id, r) / get(id) / ids() / clear(game)
// ===================================================================
window.G = window.G || {};

G.StoryCast = (function () {
  const C = () => (G.CONFIG.story && G.CONFIG.story.cast) || {};
  const PX = () => (G.CONFIG.story && G.CONFIG.story.voxel && G.CONFIG.story.voxel.px) || 0.05625;
  let npcs = {}, props = {}, trail = [], lastTrail = null, t = 0;

  // ---------------- people ----------------
  function build(who, zombie) {
    const VC = G.VoxelChars;
    const m = VC.build(who, zombie ? { zombie } : {});
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    m.userData.cast = true;
    return m;
  }
  function place(game, d) {
    if (!game.scene || !G.VoxelChars) return null;
    if (npcs[d.id]) remove(game, d.id);
    const at = d.at || {}, y = Number.isFinite(at.y) ? at.y : 0;
    const n = {
      id: d.id, who: d.who || d.id, zombie: d.zombie || null, model: null,
      pos: new THREE.Vector3(at.x || 0, y, at.z || 0), floorY: y, yaw: d.yaw || 0, wantYaw: null, faceP: null,
      pose: d.pose || "stand", seat: d.seat || 0, path: null, speed: 0, walkSpeed: C().walkSpeed || 1.4, follow: !!d.follow, arrived: false,
      talkT: 0, label: null, flicker: false, lunge: false, knock: 0, hidden: !!d.hidden, glitchT: 0, moved: 0,
      phase: d.phase != null ? d.phase : Math.random() * 6, rate: d.rate || 2.6 + Math.random() * 0.9, near: false, hit: false,   // (round 6: "bang")
    };
    n.model = build(n.who, n.zombie);
    n.model.position.copy(n.pos); n.model.rotation.y = n.yaw;
    n.model.visible = !n.hidden;
    game.scene.add(n.model);
    npcs[d.id] = n;
    if (d.label) { setLabel(n, d.label); n.labelWord = d.label.word; }
    if (d.face === "player") n.faceP = "player";
    if (d.carry) carry(n, d.carry);
    pose(n, 0);
    return n;
  }
  // (a person's boxes are its own; its materials are every character's -- js/story/voxelchars.js
  // charMat -- and a prop's geometry is shared with its template's other clones: kept)
  function dispose(m, geometry) {
    if (!m) return;
    if (m.parent) m.parent.remove(m);
    if (geometry) m.traverse((o) => { if (o.geometry && !o.isSprite && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose(); });
  }
  function remove(game, id) {
    const n = npcs[id];
    if (!n) return;
    setLabel(n, null);
    dispose(n.model, true);
    delete npcs[id];
  }
  // a word over the head: drawn with the world (its layer, not the glasses' word layer)
  function setLabel(n, o) {
    if (n.label) { n.model.remove(n.label); if (n.label.material) { if (n.label.material.map) n.label.material.map.dispose(); n.label.material.dispose(); } n.label = null; }
    n.flicker = false;
    if (!o || !o.word || !G.makeWordSprite) return;
    const s = G.makeWordSprite(String(o.word), { color: o.color || "#ffffff" });
    s.layers.set(0);
    // (over everything -- the warning the glasses give -- unless `depth`: then walls hide it, as they do in
    // 1-1, where Sgt. Chai stays by the lockers and the player walks the whole floor; round 6)
    s.material.depthTest = !!o.depth;
    s.renderOrder = 7;
    const k = 1 / (n.model.scale.x || 1);
    s.position.set(0, (n.model.userData.top || 1.8) + 0.32, 0);
    s.scale.set(1.9 * k, 0.48 * k, 1);
    n.model.add(s);
    n.label = s;
    n.flicker = !!o.flicker;
    n.labelDepth = !!o.depth;
  }
  // something held in front of it (Sgt. Chai's sealed box of exam papers): a prop on the model
  function carry(n, kind) {
    if (n.held) { n.model.remove(n.held); n.held = null; }
    if (!kind || !G.VoxelProps) return;
    const o = typeof kind === "object" ? kind : { kind }, at = o.at || [0, 0.86, 0.32];
    const g = G.VoxelProps.build(o.kind, {});
    const k = 1 / (n.model.scale.x || 1);
    g.scale.setScalar(k * (o.scale || 0.9));
    g.position.set(at[0] * k, at[1] * k, at[2] * k);
    if (o.rx || o.ry) g.rotation.set(o.rx || 0, o.ry || 0, 0);
    n.model.add(g);
    n.held = g;
    n.heldAt = at.slice();
  }
  // its zombie self: a new model where it stands (the label and the pose kept)
  function turn(game, n, look) {
    if (look === true) { const D = G.VoxelChars.DEFS[n.who] || {}; look = D.turnsInto || (G.VoxelChars.DEFS[n.who + "_z"] ? n.who + "_z" : "zm1"); }
    if (n.held) { n.model.remove(n.held); n.held = null; }
    const old = n.model, label = n.label ? { word: n.labelWord, flicker: n.flicker, depth: n.labelDepth } : null;
    if (n.label) setLabel(n, null);
    n.who = look; n.zombie = n.zombie || null;
    n.model = build(look, null);
    n.model.position.copy(old.position); n.model.rotation.copy(old.rotation);
    n.model.visible = old.visible;
    game.scene.add(n.model);
    dispose(old, true);
    if (label && label.word) { setLabel(n, label); n.labelWord = label.word; }
    n.glitchT = C().turnGlitch || 0.45;
    if (G.Audio && G.Audio.ctx && G.Audio.group) G.Audio.group({ cat: "sfx", prio: 2, pos: n.pos, dur: 0.6 }, () => {
      G.Audio.tone({ type: "sawtooth", freq: 220, freqEnd: 70, dur: 0.35, gain: 0.05, pos: n.pos });
      G.Audio.tone({ type: "square", freq: 1400, freqEnd: 300, dur: 0.12, gain: 0.025, at: 0.05 });
    });
  }

  // a scene's ["npc", { id, ... }]
  function act(game, run, o) {
    o = o || {};
    let n = npcs[o.id];
    if (!n && o.who) n = place(game, o);
    if (!n) return;
    if (o.to) { n.pos.set(o.to.x, Number.isFinite(o.to.y) ? o.to.y : n.pos.y, o.to.z); n.floorY = n.pos.y; if (Number.isFinite(o.to.yaw)) { n.yaw = o.to.yaw; n.wantYaw = null; } n.path = null; }
    if (o.walk) { n.path = [].concat(o.walk).map((p) => ({ x: p.x, z: p.z })); n.arrived = false; n.follow = false; n.faceP = null; if (o.speed) n.walkSpeed = o.speed; n.then = o.then || null; }
    if (o.carry !== undefined) carry(n, o.carry);
    if (o.follow != null) { n.follow = !!o.follow; if (n.follow) n.path = null; }
    if (o.face != null) {
      if (o.face === "player") n.faceP = "player";
      else if (typeof o.face === "number") { n.wantYaw = o.face; n.faceP = null; }
      else { n.faceP = { x: o.face.x, z: o.face.z }; }
    }
    if (o.pose) n.pose = o.pose;
    if (o.talk) n.talkT = Math.max(n.talkT, o.talk);
    if (o.turn) turn(game, n, o.turn);
    if (o.label !== undefined) { setLabel(n, o.label); n.labelWord = o.label && o.label.word; }
    if (o.lunge != null) { n.lunge = !!o.lunge; if (n.lunge) { n.path = null; n.follow = false; n.faceP = "player"; } }
    if (o.knock) { n.knock = o.knock; n.lunge = false; }
    if (o.show) { n.hidden = false; n.model.visible = true; }
    if (o.hide) { n.hidden = true; n.model.visible = false; }
    if (o.remove) remove(game, o.id);
  }

  // ---------------- things ----------------
  function prop(game, d) {
    if (!d || !d.id || !G.VoxelProps || !game.scene) return null;
    unprop(game, d.id);
    const at = d.at || {}, o = Object.assign({}, d.o || {}, { y: Number.isFinite(at.y) ? at.y : 0, collider: false });
    // (round 6) a melee weapon lying about -- the janitor's crowbar: the game's own model of it
    if (d.melee) {
      const def = G.MELEE_WEAPONS && G.MELEE_WEAPONS[d.melee];
      if (!def || !G.buildMeleeMesh) return null;
      const g = G.buildMeleeMesh(def);
      g.scale.setScalar(d.scale || 1.35);
      g.position.set(at.x || 0, (Number.isFinite(at.y) ? at.y : 0) + (d.lift || 0), at.z || 0);
      g.rotation.set(d.rx || 0, d.yaw || 0, d.rz || 0);
      game.scene.add(g);
      props[d.id] = { g, col: null, own: true };
      return g;
    }
    const g = G.VoxelProps.place({ scene: game.scene, world: game.world }, d.kind, at.x || 0, at.z || 0, d.yaw || 0, o);
    if (d.rx || d.rz) { g.rotation.x = d.rx || 0; g.rotation.z = d.rz || 0; }       // (round 7: knocked over)
    let col = null;
    if (d.collider !== false && !G.VoxelProps.NO_COLLIDER.has(d.kind)) {
      g.updateMatrixWorld(true);
      col = new THREE.Box3().setFromObject(g);
      if (d.dynamic) col.dynamic = true;               // (round 7: it moves -- js/world.js ColGrid lists it always)
      if (G.ColGrid) G.ColGrid.add(game.world, col); else game.world.colliders.push(col);
    }
    props[d.id] = { g, col };
    return g;
  }
  function unprop(game, id) {
    const p = props[id];
    if (!p) return;
    if (p.col && G.ColGrid) G.ColGrid.remove(game.world, p.col);
    dispose(p.g, !!p.own);
    delete props[id];
  }

  // ---------------- a scene ----------------
  function clear(game) {
    Object.keys(npcs).forEach((id) => remove(game, id));
    Object.keys(props).forEach((id) => unprop(game, id));
    trail = []; lastTrail = null;
  }
  function enter(game, run, scene) {
    clear(game);
    (scene.props || []).forEach((d) => prop(game, d));
    (scene.cast || []).forEach((d) => place(game, d));
  }

  // ---------------- each frame ----------------
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  // the way the player walked: a point every half metre, the last few dozen (what a follower walks along)
  function track(game) {
    const p = game.yawObject.position, feet = p.y - 1.7;
    if (!lastTrail || Math.hypot(p.x - lastTrail.x, p.z - lastTrail.z) > 0.5 || Math.abs(feet - lastTrail.y) > 1.5) {
      lastTrail = { x: p.x, y: feet, z: p.z };
      trail.push(lastTrail);
      if (trail.length > 80) trail.shift();
    }
  }
  // where a follower makes for: the furthest point of the trail still `behind` metres back from the player
  function followGoal(n, game) {
    const p = game.yawObject.position, back = C().followDist || 1.6;
    for (let i = trail.length - 1; i >= 0; i--) {
      const q = trail[i];
      if (Math.hypot(q.x - p.x, q.z - p.z) >= back) {
        // (the nearest point of the trail to the follower from here back: never doubling back)
        let best = i, bd = Infinity;
        for (let j = i; j >= Math.max(0, i - 30); j--) { const d = Math.hypot(trail[j].x - n.pos.x, trail[j].z - n.pos.z); if (d < bd) { bd = d; best = j; } }
        const k = Math.min(i, best + 1);
        return trail[k];
      }
    }
    return null;
  }
  function stepTo(n, game, gx, gz, speed, dt) {
    const dx = gx - n.pos.x, dz = gz - n.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.02) return d;
    const s = Math.min(d, speed * dt);
    n.pos.x += (dx / d) * s; n.pos.z += (dz / d) * s;
    n.moved = s / Math.max(dt, 1e-4);
    n.wantYaw = Math.atan2(dx, dz);           // (a character faces +z: yaw = atan2(x, z))
    return d - s;
  }
  function pose(n, dt) {
    const m = n.model, u = m.userData, L = u.limbs;
    if (!L || !L.legL) return 0;
    const P = PX(), hipY = u.hipY || 12 * P;
    let dy = 0;
    const seatY = n.seat || C().seatH || 0.45;
    if (n.pose === "sit") {
      // (on a chair: the seat at 0.45 m, the legs straight out -- one box each; round 7: a bed's height its own)
      L.legL.hip.rotation.x = -1.5; L.legR.hip.rotation.x = -1.5;
      dy = seatY - hipY;
    } else if (n.pose === "floor") {
      // (on the floor, the back to a wall, slumped: hurt)
      L.legL.hip.rotation.x = -1.45; L.legR.hip.rotation.x = -1.4; L.legR.hip.rotation.z = 0.12;
      if (u.upper) u.upper.rotation.x = -0.32;
      L.armL.shoulder.rotation.set(-0.3, 0, -0.35); L.armR.shoulder.rotation.set(-0.9, 0, 0.2);
      if (u.neck) u.neck.rotation.x = 0.35;
      dy = 0.08 - hipY;
    } else if (n.pose === "carry") {
      L.armL.shoulder.rotation.set(-1.15, 0, 0.18); L.armR.shoulder.rotation.set(-1.15, 0, -0.18);
    } else if (n.pose === "zombie") {
      const s = Math.sin((u.npc ? u.npc.t : 0) * 1.3);
      L.armL.shoulder.rotation.set(-1.45 + s * 0.06, 0, 0.1); L.armR.shoulder.rotation.set(-1.4 - s * 0.06, 0, -0.1);
      if (u.neck) u.neck.rotation.set(0.25, s * 0.15, 0.12);
    } else if (n.pose === "scratch") {
      // (at a desk, scratching behind the ear -- the LEXA patch -- now and then: Beam before the spike)
      L.legL.hip.rotation.x = -1.5; L.legR.hip.rotation.x = -1.5;
      const t0 = u.npc ? u.npc.t : 0, on = Math.sin(t0 * 0.9) > -0.2;
      if (on) L.armL.shoulder.rotation.set(-2.5 + Math.sin(t0 * 9) * 0.12, 0, -0.55);
      if (u.neck) u.neck.rotation.set(0.12, 0.25, on ? -0.18 : 0);
      dy = (C().seatH || 0.45) - hipY;
    } else if (n.pose === "slump") {
      // (at a desk, the head down: a candidate hiding the patch)
      L.legL.hip.rotation.x = -1.5; L.legR.hip.rotation.x = -1.5;
      if (u.upper) u.upper.rotation.x = 0.35;
      L.armL.shoulder.rotation.set(-1.2, 0, 0.3); L.armR.shoulder.rotation.set(-1.0, 0, -0.1);
      dy = (C().seatH || 0.45) - hipY;
    } else if (n.pose === "push") {
      // (round 7) leaning into a bookshelf, both hands on it -- Tonkla at the library's doors
      L.armL.shoulder.rotation.set(-1.5, 0, 0.12); L.armR.shoulder.rotation.set(-1.5, 0, -0.12);
      if (u.upper) u.upper.rotation.x = 0.32;
      L.legL.hip.rotation.x = 0.35; L.legR.hip.rotation.x = -0.25;
      if (u.neck) u.neck.rotation.set(-0.2, 0, 0);
    } else if (n.pose === "hurt" || n.pose === "hurtSit") {
      // an arm cut by the window's glass: the other hand holding it, the head down to it
      const t0 = u.npc ? u.npc.t : 0;
      L.armL.shoulder.rotation.set(-0.45, 0, 0.22); L.armR.shoulder.rotation.set(-0.95 + Math.sin(t0 * 1.6) * 0.04, 0, -0.62);
      if (u.neck) u.neck.rotation.set(0.38, 0.22, 0);
      if (n.pose === "hurtSit") { L.legL.hip.rotation.x = -1.5; L.legR.hip.rotation.x = -1.5; dy = seatY - hipY; }
      else { L.legL.hip.rotation.x = 0; L.legR.hip.rotation.x = 0; }
    } else if (n.pose === "treat") {
      // bent over a cut, both hands at it (Fai with the bandage)
      const t0 = u.npc ? u.npc.t : 0, s = Math.sin(t0 * 3.2) * 0.12;
      if (u.upper) u.upper.rotation.x = 0.5;
      L.armL.shoulder.rotation.set(-1.05 + s, 0, 0.18); L.armR.shoulder.rotation.set(-1.05 - s, 0, -0.18);
      if (u.neck) u.neck.rotation.set(0.3, 0, 0);
    } else if (n.pose === "bang") {
      // (round 6) packed against glass, fists on it: each at its own beat (its phase), the body
      // swaying into the blows -- the crowd at the main stairs. A blow near the player is heard.
      const t0 = (u.npc ? u.npc.t : 0) + (n.phase || 0), b = Math.max(0, Math.sin(t0 * (n.rate || 3.1)));
      L.armL.shoulder.rotation.set(-2.2 + b * 0.55, 0, 0.12); L.armR.shoulder.rotation.set(-2.05 + Math.max(0, Math.sin(t0 * (n.rate || 3.1) + 1.7)) * 0.55, 0, -0.12);
      if (u.upper) u.upper.rotation.x = 0.12 + b * 0.08;
      if (u.neck) u.neck.rotation.set(0.1, Math.sin(t0 * 0.7) * 0.25, 0.1);
      const hit = b > 0.97;
      if (hit && !n.hit && n.near && G.StoryScreen) G.StoryScreen.thud(n.pos);
      n.hit = hit;
    } else if (n.pose === "ext") {
      // (round 9) a fire extinguisher in front of her, both hands on it (Kru Min in 1-6): the walk's own
      // swing under it
      const bob = L.legL.hip.rotation.x * 0.1;
      L.armL.shoulder.rotation.set(-0.95 + bob, 0, 0.42); L.armR.shoulder.rotation.set(-0.72 - bob, 0, -0.12);
      if (u.upper && u.upper.rotation.x) u.upper.rotation.x = 0;
    } else if (n.pose === "spray") {
      // ...and used: the nozzle out at arm's length, braced
      const t0 = u.npc ? u.npc.t : 0, s = Math.sin(t0 * 31) * 0.03;
      L.armL.shoulder.rotation.set(-1.5 + s, 0, 0.3); L.armR.shoulder.rotation.set(-1.15 - s, 0, -0.2);
      if (u.upper) u.upper.rotation.x = -0.1;
      L.legL.hip.rotation.x = 0.1; L.legR.hip.rotation.x = -0.1;
    } else if (n.pose === "console") {
      // at the PA desk: one hand on its buttons, the other by the microphone
      const t0 = u.npc ? u.npc.t : 0, s = Math.sin(t0 * 2.1) * 0.05;
      L.armL.shoulder.rotation.set(-0.95 + s, 0, 0.16); L.armR.shoulder.rotation.set(-1.1 - s, 0, -0.14);
      if (u.upper) u.upper.rotation.x = 0.16;
      if (u.neck) u.neck.rotation.x = 0.18 + (n.talkT > 0 ? Math.sin(t0 * 5.3) * 0.07 : 0);
    } else if (n.pose === "megaphone") {
      // the principal at the flagpole: a megaphone up at his mouth
      const t0 = u.npc ? u.npc.t : 0, s = Math.sin(t0 * 1.1) * 0.04;
      L.armR.shoulder.rotation.set(-1.55 + s, 0, -0.32); L.armL.shoulder.rotation.set(-0.15, 0, -0.1);
      if (u.neck) u.neck.rotation.set(-0.06, Math.sin(t0 * 0.5) * 0.1, 0);
    } else if (u.upper && u.upper.rotation.x) u.upper.rotation.x = 0;
    if (n.pose !== "floor" && L.legR.hip.rotation.z) L.legR.hip.rotation.z = 0;
    // (round 7: a pose that bends the legs or the body gives them back when it ends)
    if (n.pose !== n.lastPose) {
      const legs = { sit: 1, floor: 1, scratch: 1, slump: 1, push: 1, hurtSit: 1, spray: 1 }, lean = { floor: 1, slump: 1, push: 1, treat: 1, bang: 1, spray: 1, console: 1 };
      if (n.lastPose && legs[n.lastPose] && !legs[n.pose]) { L.legL.hip.rotation.x = 0; L.legR.hip.rotation.x = 0; }
      if (n.lastPose && lean[n.lastPose] && !lean[n.pose] && u.upper) u.upper.rotation.x = 0;
      if (n.lastPose && n.lastPose !== "stand" && n.pose === "stand") { L.armL.shoulder.rotation.set(0, 0, 0); L.armR.shoulder.rotation.set(0, 0, 0); if (u.neck) u.neck.rotation.set(0, 0, 0); }
      n.lastPose = n.pose;
    }
    return dy;
  }
  // what can be seen of it -- the map's own rule for what is inside (js/story/ch1map.js update):
  // someone in the building is drawn from inside on the same storey -- or, from a stairwell, the next
  // (round 9: from anywhere else not the next either: the three left in the library and what stands
  // there were 23 draw calls over the PR room's ceiling; someone on a flight of stairs is seen from the
  // storey they are nearer) --
  // from outside only near the building (through the windows); no one past the fog. (While the
  // player walks in from the gate, 60 m off, seven people sit the exam on 3F: 49 draw calls for
  // nothing -- 158 on Low, over the 150 of the rest of the map.)
  const storey = (y) => (y < 2 ? 0 : y < 6 ? 1 : 2);
  function seen(game, n) {
    const M = game.world && game.world.storyMap, pp = game.yawObject.position, feet = pp.y - 1.7, fog = game.scene && game.scene.fog;
    if (fog && Number.isFinite(fog.far) && Math.hypot(n.pos.x - pp.x, n.pos.z - pp.z) > fog.far + 8) return false;
    if (!M || !M.inFoot || !M.inFoot(Math.floor(n.pos.x), Math.floor(n.pos.z))) return true;
    if (M.inFoot(Math.floor(pp.x), Math.floor(pp.z)) && feet > -0.5) return M.mode === "stairs" ? Math.abs(storey(n.pos.y) - storey(feet)) <= 1 : Math.abs(n.pos.y - feet) < 2.6;
    return !M.shown || M.shown["s" + storey(n.pos.y)] !== false;
  }
  // (round 9) a scene's things by the same rule: the ones this hid are shown again by it, no others
  const at0 = { pos: null };
  function seeProps(game) {
    Object.keys(props).forEach((id) => {
      const g = props[id].g;
      if (!g) return;
      at0.pos = g.position;
      const v = seen(game, at0);
      if (!v && g.visible) { g.visible = false; g.userData.castHid = true; }
      else if (v && g.userData.castHid) { g.visible = true; g.userData.castHid = false; }
    });
  }
  function update(game, dt) {
    if (!game || !game.yawObject) return;
    t += dt;
    track(game);
    seeProps(game);
    const pp = game.yawObject.position;
    Object.keys(npcs).forEach((id) => {
      const n = npcs[id];
      n.moved = 0;
      // what it is doing: shoved back; at the player; along a path; behind the player
      if (n.knock > 0) {
        const dx = n.pos.x - pp.x, dz = n.pos.z - pp.z, d = Math.hypot(dx, dz) || 1, s = Math.min(n.knock, 4.5 * dt);
        n.pos.x += (dx / d) * s; n.pos.z += (dz / d) * s; n.knock -= s;
      } else if (n.lunge) {
        const d = Math.hypot(pp.x - n.pos.x, pp.z - n.pos.z);
        if (d > (C().lungeStop || 0.95)) stepTo(n, game, pp.x, pp.z, C().lungeSpeed || 1.6, dt);
      } else if (n.path && n.path.length) {
        const g = n.path[0];
        const left = stepTo(n, game, g.x, g.z, n.walkSpeed, dt);
        if (left < 0.12) {
          n.path.shift();
          if (!n.path.length) {
            n.path = null; n.arrived = true;
            // what it does once there: gone from sight, gone, or an act of its own (sit down, turn)
            const th = n.then; n.then = null;
            if (th === "hide") { n.hidden = true; n.model.visible = false; }
            else if (th === "remove") { remove(game, id); return; }
            else if (th && typeof th === "object") act(game, null, Object.assign({}, th, { id }));
          }
        }
      } else if (n.follow) {
        const d = Math.hypot(pp.x - n.pos.x, pp.z - n.pos.z);
        // (a storey apart -- a cut up the stairs -- counts as far behind as it gets)
        const apart = Math.abs((pp.y - 1.7) - n.pos.y) > 2.5;
        if (apart || d > (C().followDist || 1.6) + 0.3) {
          const g = followGoal(n, game);
          // (round 9: `followMax` -- someone looked after keeps up with a player who runs, js/story/escort.js)
          if (g) stepTo(n, game, g.x, g.z, Math.min(n.followMax || C().followSpeed || 3.4, Math.max(1.2, d * 1.2)), dt);
          // (left far behind -- a cut, a fall: brought along, just behind the player, and the way
          // walked forgotten up to there)
          if (apart || d > (C().followLeash || 9)) {
            const yaw = game.yawObject.rotation.y, back = (C().followDist || 1.6);
            n.pos.set(pp.x + Math.sin(yaw) * back, pp.y - 1.7, pp.z + Math.cos(yaw) * back);
            n.floorY = pp.y - 1.7;
            trail = [{ x: pp.x, y: pp.y - 1.7, z: pp.z }]; lastTrail = trail[0];
          }
        } else n.faceP = n.faceP || "player";
      }
      // the floor under it (the stairs); its turn
      n.floorY = G.getFloorHeightAt(game.world, n.pos.x, n.pos.z, n.floorY + 0.4);
      n.pos.y = n.floorY;
      if (n.faceP && n.moved < 0.05) {
        const fx = n.faceP === "player" ? pp.x : n.faceP.x, fz = n.faceP === "player" ? pp.z : n.faceP.z;
        n.wantYaw = Math.atan2(fx - n.pos.x, fz - n.pos.z);
      }
      if (n.wantYaw != null) n.yaw += wrap(n.wantYaw - n.yaw) * Math.min(1, dt * 7);
      // the body: walking, talking, then its pose on top
      if (n.talkT > 0) n.talkT -= dt;
      const m = n.model;
      G.VoxelChars.animate(m, dt, { speed: n.moved, talk: n.talkT > 0 });
      const dy = pose(n, dt);
      m.position.set(n.pos.x, n.pos.y + dy, n.pos.z);
      m.rotation.y = n.yaw;
      const vis = !n.hidden && seen(game, n);
      if (m.visible !== vis) m.visible = vis;
      // (a blow on the glass is heard within a dozen metres, on the player's storey)
      n.near = vis && Math.hypot(n.pos.x - pp.x, n.pos.z - pp.z) < 12 && Math.abs(n.pos.y - (pp.y - 1.7)) < 2;
      if (n.glitchT > 0) { n.glitchT -= dt; m.scale.setScalar((G.VoxelChars.full(n.who).scale || 1) * (1 + (Math.random() - 0.5) * 0.08)); if (n.glitchT <= 0) m.scale.setScalar(G.VoxelChars.full(n.who).scale || 1); }
      if (n.label) n.label.material.opacity = n.flicker ? (Math.sin(t * 17) > 0.2 ? 0.95 : 0.25) : 1;
    });
  }

  function arrived(id) { const n = npcs[id]; return !!(n && n.arrived && !n.path); }
  function near(game, id, r) { const n = npcs[id], p = game && game.yawObject && game.yawObject.position; return !!(n && p && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) <= r && Math.abs(n.pos.y - (p.y - 1.7)) < 1.8); }
  function reset(game) { if (game) clear(game); npcs = {}; props = {}; trail = []; lastTrail = null; }

  return { enter, act, prop, unprop, update, arrived, near, clear, reset, setLabel, propOf: (id) => props[id] || null,
    get: (id) => npcs[id] || null, ids: () => Object.keys(npcs), propIds: () => Object.keys(props), get trail() { return trail; } };
})();
