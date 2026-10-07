// ===================================================================
// Boss cutscenes (round 2, G2) and the boss's death (G6)
// -------------------------------------------------------------------
// Every boss arrives in a scene of its own, exactly ten seconds long:
//
//   gravedigger  the ground cracks, a hand punches up, he climbs out and roars
//   eye          a column of light from the sky; she sinks down it, eye shut,
//                then it opens
//   headmaster   the school bell; three spotlights bang on one by one, the
//                third finds him; the cane comes down, the jaw drops
//   matron       black water spreads, hands claw out of it, she rises
//   coach        thuds from inside the school wall, a whistle, and he comes
//                through it and charges across the field
//   thorn        roots burst up in a spiral, twist into a trunk, and it
//                opens: his amber heart lights
//   storm        the sky flickers, a bolt strikes, and a body flickers into
//                being where it hit
//   chemist      green fog drifts in from everywhere and gathers into him
//   void         a portal tears open and he steps through it
//   examiner     a storm of exam papers spins up, collapses, and he is
//                standing in it; a red pen slashes the screen
//
// All of them: black bars top and bottom, a camera that moves, slow motion
// at the key moment, a sound bed and the boss's own sounds, and the title
// card -- the wave, the name, the epithet and the epithet's Thai meaning.
// The world stands still (G.Game.update hands every frame to this file), the
// player cannot be hurt, and the view ends on the player's own eyes so the
// fight picks up without a cut.
//
// The death is the same machinery, 4.6 s: slow motion, light breaking out of
// the body, the body blowing apart into chunks (G.Bosses.explode), the energy
// walls coming down, and "Defeated".
//
// A scene's camera is written as keys in the boss's own frame: a = metres
// from the boss towards the player, b = to the side, c = height, then where
// it looks (same terms) and the field of view. In a hall (the hospital, the
// bunker) the distances shrink to fit and the camera is kept off the walls
// and under the ceiling.
// ===================================================================
(function () {
  const V3 = THREE.Vector3;
  const FX = () => G.BossFX;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------- the scenes ----------------
  const S = {};

  S.burst = {
    slow: [[2.45, 3.45, 0.3]],
    keys: [
      [0, 6, 2, 0.6, 0, 0, 0.2, 55], [2.3, 5.2, 1.6, 0.5, 0, 0, 0.35, 50], [3.5, 6.5, 2.4, 1.3, 0, 0, 1.9, 55],
      [5.0, 9, 3, 2.6, 0, 0, 4.0, 55], [6.2, 10, -2, 3.2, 0, 0, 4.3, 50], [9.4, 8.2, -1.4, 3.6, 0, 0, 4.7, 45],
    ],
    setup(c) {
      c.b.pos.y = c.F - 7.5;
      c.b.pose = { armR: [-3.0, -0.15], armL: [-2.6, 0.3], torso: 0.7, head: -0.6 };
      c.hole = FX().decal({ mode: "blob", x: c.B.x, z: c.B.z, r: 0.2, w: 0.3, color: 0x0e0906, opacity: 0.95 });
    },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B;
      c.once("rumble", 0.1, () => G.Audio.cine("rumble", { dur: 3.2 }));
      if (t < 2.5 && Math.random() < 0.35) FX().chunk(B.x + (Math.random() - 0.5) * 3, F + 0.1, B.z + (Math.random() - 0.5) * 3, 0, 1.5 + Math.random() * 2, 0, 0.12, 0x3d3226, 0.8);
      c.hole.set({ r: 0.2 + 3.2 * ease(seg(t, 1.1, 2.6)) });
      c.once("crack", 1.2, () => { G.Audio.cine("crack"); FX().burst(B.x, F + 0.1, B.z, 10, 0x4a3a28, 3, 0.25, 3); c.shake(0.08, 0.5); });
      c.once("hand", 2.45, () => { G.Audio.cine("burst"); FX().burst(B.x + 1, F + 0.2, B.z, 34, 0x3d3226, 5, 0.4, 7); c.shake(0.18, 0.6); });
      if (t >= 2.45 && t < 3.5) b.pos.y = lerp(F - 7.5, F - 3.4, ease(seg(t, 2.45, 3.45)));
      if (t >= 3.5 && t < 5.0) {
        b.pos.y = lerp(F - 3.4, F, ease(seg(t, 3.5, 4.9)));
        b.pose = { armR: [-2.2, -0.4], armL: [-1.6, 0.5], torso: 0.5, head: -0.2 };
        if (Math.random() < 0.5) FX().chunk(B.x + (Math.random() - 0.5) * 2.5, F + 1 + Math.random() * 3, B.z + (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2, 0.2, 0x3d3226, 1.2);
      }
      c.once("stand", 5.0, () => { b.pos.y = F; b.pose = { head: -0.75, armL: [-0.9, 1.1], armR: [-0.9, -1.1], torso: -0.1 }; });
      c.once("roar", 5.15, () => { G.Audio.bossVoice("roar", b.def.voice); c.shake(0.22, 1.2); FX().shock(B.x, B.z, 12, 0xbfa070, 0.9); });
      c.once("settle", 6.6, () => { b.pose = {}; });
      c.b.movedSpeed = 0;
    },
    done(c) { c.hole.hide(); },
  };

  S.descend = {
    slow: [[3.8, 4.6, 0.3]],
    keys: [
      [0, 8, 2, 1.2, 0, 0, 12, 60], [1.6, 8, 2.5, 1.5, 0, 0, 9, 58], [4.0, 7.5, 1.5, 2.0, 0, 0, 5, 52],
      [5.0, 6, 0.8, 3.6, 0, 0, 4.6, 45], [6.2, 9, -2, 3.2, 0, 0, 4.4, 50], [9.4, 8, -1.2, 3.8, 0, 0, 4.6, 46],
    ],
    setup(c) {
      c.sky = c.A.kind === "field" ? c.F + 30 : c.A.ceiling - 0.6 - c.b.rig.hipY;
      c.b.pos.y = c.sky;
      if (c.b.rig.lidOpen) c.b.rig.lidOpen(-1);
      c.beam = FX().beam(0xfff0c8, 0xffffff);
      c.beam.set(new V3(c.B.x, c.A.kind === "field" ? c.F + 60 : c.A.ceiling, c.B.z), new V3(c.B.x, c.F, c.B.z), 0.01);
      c.glow = FX().decal({ mode: "disc", x: c.B.x, z: c.B.z, r: 3, w: 0.5, color: 0xfff0c8, opacity: 0, prog: 0, add: true });
    },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B;
      const w = 0.7 * ease(seg(t, 0.3, 1.1)) * (1 - ease(seg(t, 5.4, 6.3)));
      c.beam.set(new V3(B.x, c.A.kind === "field" ? F + 60 : c.A.ceiling, B.z), new V3(B.x, F, B.z), Math.max(0.01, w));
      c.beam.outer.material.opacity = 0.12 * (w / 0.7); c.beam.core.material.opacity = 0.28 * (w / 0.7);
      c.glow.set({ opacity: 0.7 * (w / 0.7) });
      c.once("choir", 0.3, () => G.Audio.cine("choir", { dur: 5.5 }));
      if (w > 0.2 && Math.random() < 0.9) FX().mote(B.x + (Math.random() - 0.5) * 2, F + 1 + Math.random() * 14, B.z + (Math.random() - 0.5) * 2, 0, -1.5, 0, 0xfff4d0, 1.6, 0, 0);
      if (t >= 1.0 && t < 5.0) b.pos.y = lerp(c.sky, F, 1 - Math.pow(1 - seg(t, 1.0, 5.0), 2.2));
      c.once("down", 5.0, () => { b.pos.y = F; });
      if (t >= 5.0 && t < 5.4 && b.rig.lidOpen) b.rig.lidOpen(-1 + 2.2 * ease(seg(t, 5.0, 5.35)));
      c.once("open", 5.05, () => { G.Audio.cine("gaze"); c.flash(0.55); c.shake(0.1, 0.4); FX().shock(B.x, B.z, 10, 0xffb028, 0.7); });
      c.once("rest", 5.6, () => { if (b.rig.lidOpen) b.rig.lidOpen(1); });
      c.once("voice", 5.8, () => G.Audio.bossVoice("shriek", b.def.voice));
    },
    done(c) { c.beam.hide(); c.glow.hide(); if (c.b.rig.lidOpen) c.b.rig.lidOpen(1); },
  };

  S.spotlight = {
    slow: [[3.6, 4.4, 0.35]],
    keys: [
      [0, 14, 0, 2.2, 0, 0, 1.5, 60], [1.1, 13, 1.5, 2.1, 0, -5, 1.4, 58], [2.3, 13, -1.5, 2.1, 0, 5, 1.4, 58],
      [3.5, 12, 0, 2.2, 0, 0, 2.5, 55], [4.4, 8, 1, 2.2, 0, 0, 3.5, 50], [5.4, 6.5, 0.5, 3.8, 0, 0, 5.2, 45],
      [6.4, 10, -2.5, 3.0, 0, 0, 4.6, 50], [9.4, 9, -1.8, 3.2, 0, 0, 4.8, 46],
    ],
    setup(c) {
      c.b.root.visible = false;
      c.cones = [];
      const H = c.A.kind === "field" ? 22 : c.A.ceiling - c.F;
      [-5, 5, 0].forEach((side) => {
        const p = c.local(0, side * c.fit, 0);
        const m = new THREE.Mesh(new THREE.ConeGeometry(3.2 * Math.max(0.7, c.fit), H, 24, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(p.x, c.F + H / 2, p.z);
        m.frustumCulled = false;
        c.game.scene.add(m);
        const d = FX().decal({ mode: "disc", x: p.x, z: p.z, r: 3.2 * Math.max(0.7, c.fit), w: 0.4, color: 0xfff2c8, opacity: 0, prog: 1, add: true });
        c.cones.push({ m, d, on: false });
      });
    },
    step(c, t) {
      const b = c.b, B = c.B;
      c.once("bell1", 0.2, () => G.Audio.cine("bell"));
      c.once("bell2", 1.4, () => G.Audio.cine("bell"));
      [[1.2, 0], [2.4, 1], [3.6, 2]].forEach(([at, i]) => c.once("light" + i, at, () => {
        c.cones[i].on = true; G.Audio.cine("bang");
        if (i === 2) { b.root.visible = true; c.shake(0.06, 0.3); }
      }));
      c.cones.forEach((k) => { const o = k.on ? 0.16 + 0.03 * Math.sin(t * 30) : 0; k.m.material.opacity = o; k.d.set({ opacity: k.on ? 0.55 : 0 }); });
      c.once("raise", 4.1, () => { b.pose = { armR: [-2.2, -0.3], torso: -0.15, head: -0.1 }; });
      c.once("slam", 4.7, () => { b.pose = { armR: [-0.15, -0.1], torso: 0.25 }; });
      c.once("thud", 4.8, () => {
        const h = c.local(0.8, 1.6, 0);
        G.Audio.cine("thud"); c.shake(0.2, 0.5); FX().shock(h.x, h.z, 9, 0xfff0c0, 0.7);
        FX().burst(h.x, c.F + 0.1, h.z, 16, 0x6a6a64, 4, 0.2, 4);
      });
      c.once("bellow", 5.4, () => { b.pose = { head: -0.45, torso: -0.2, armL: [-1.0, 0.9], armR: [-0.6, -0.4] }; G.Audio.bossVoice("roar", b.def.voice); c.shake(0.18, 1.0); });
      if (b.rig.jawOpen) b.rig.jawOpen(t > 5.35 && t < 6.9 ? 1 : 0);
      c.once("settle", 7.0, () => { b.pose = {}; });
    },
    done(c) { c.cones.forEach((k) => { c.game.scene.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); k.d.hide(); }); if (c.b.rig.jawOpen) c.b.rig.jawOpen(0); },
  };

  S.blackwater = {
    slow: [[4.3, 5.0, 0.3]],
    keys: [
      [0, 9, 3, 1.5, 0, 0, 0, 55], [2.0, 7, 2, 1.0, 0, 0, 0.3, 52], [3.4, 7.5, 2.5, 1.2, 0, 0, 1.5, 52],
      [4.3, 6.5, 1.2, 2.2, 0, 0, 4.2, 48], [5.5, 8, 1.8, 3.0, 0, 0, 4.2, 50], [6.3, 10, -2, 2.8, 0, 0, 4.4, 50],
      [9.4, 9, -1.5, 3.2, 0, 0, 4.7, 46],
    ],
    setup(c) {
      c.b.pos.y = c.F - 7.5;
      c.b.pose = { head: 0.6, armL: [-2.8, 0.3], armR: [-2.8, -0.3] };
      c.pool = FX().decal({ mode: "blob", x: c.B.x, z: c.B.z, r: 0.3, w: 0.6, color: 0x08040c, opacity: 0.96 });
      c.hands = [];
      const skin = new THREE.MeshLambertMaterial({ color: 0x4a5448 });
      for (let i = 0; i < 7; i++) {
        const g = new THREE.Group();
        const a = i / 7 * Math.PI * 2 + 0.4, r = (2 + (i % 3) * 0.9) * Math.max(0.75, c.fit);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 6), skin);
        arm.position.y = 0.65; g.add(arm);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.1), skin);
        hand.position.y = 1.35; g.add(hand);
        for (let k = -1; k <= 1; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), skin); f.position.set(k * 0.07, 1.58, 0); f.rotation.z = k * 0.2; g.add(f); }
        g.position.set(c.B.x + Math.cos(a) * r, c.F - 1.6, c.B.z + Math.sin(a) * r);
        g.rotation.set((Math.random() - 0.5) * 0.5, a, (Math.random() - 0.5) * 0.5);
        c.game.scene.add(g);
        c.hands.push({ g, born: 1.4 + i * 0.22, ph: Math.random() * 6 });
      }
      c.handMat = skin;
    },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B;
      c.pool.set({ r: 0.3 + 5.2 * c.fit * ease(seg(t, 0.4, 3.0)) * (1 - 0.6 * ease(seg(t, 6.5, 8.8))) });
      c.once("bubble", 0.3, () => G.Audio.cine("bubble", { dur: 5 }));
      if (t < 6 && Math.random() < 0.3) { const r = Math.random() * 4 * c.fit, a = Math.random() * 6.3; FX().mote(B.x + Math.cos(a) * r, F + 0.05, B.z + Math.sin(a) * r, 0, 0.6, 0, 0x6a3a8a, 0.6, 1, 0); }
      c.hands.forEach((h) => {
        const up = ease(seg(t, h.born, h.born + 0.9)) * (1 - ease(seg(t, 4.6, 5.6)));
        h.g.position.y = F - 1.6 + up * 1.4 + Math.sin(t * 6 + h.ph) * 0.05 * up;
        h.g.rotation.z = Math.sin(t * 4 + h.ph) * 0.25;
      });
      if (t >= 3.4 && t < 6.0) {
        b.pos.y = lerp(F - 7.5, F, ease(seg(t, 3.4, 5.9)));
        if (Math.random() < 0.6) FX().chunk(B.x + (Math.random() - 0.5) * 1.6, F + 1 + Math.random() * 4, B.z + (Math.random() - 0.5) * 1.6, 0, -1, 0, 0.1, 0x0a0610, 1.0);
      }
      c.once("shriek", 5.8, () => { b.pos.y = F; b.pose = { head: -0.3, armL: [-1.4, 1.2], armR: [-1.4, -1.2] }; b.summoning = true; G.Audio.bossVoice("shriek", b.def.voice); c.shake(0.12, 0.6); });
      c.once("settle", 7.0, () => { b.pose = {}; b.summoning = false; });
    },
    done(c) {
      c.pool.hide();
      c.hands.forEach((h) => { c.game.scene.remove(h.g); h.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); });
      c.handMat.dispose();
      c.b.summoning = false;
    },
  };

  S.wallcrash = {
    slow: [[2.8, 3.6, 0.3]],
    setup(c) {
      const W = c.A.wall;
      c.W = new V3(W.x, c.F, W.z);
      c.n = new V3(W.nx, 0, W.nz);
      c.side = new V3(-c.n.z, 0, c.n.x);
      c.start = c.W.clone().addScaledVector(c.n, -1.2);
      c.b.pos.copy(c.start);
      c.b.root.visible = false;
      c.b.root.rotation.y = Math.atan2(c.n.x, c.n.z);
      // a patch of the wall that is knocked out, and the dark hole behind it
      const face = new THREE.Group();
      face.position.copy(c.W).addScaledVector(c.n, 0.28);
      face.rotation.y = Math.atan2(c.n.x, c.n.z);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.6, 0.45), new THREE.MeshLambertMaterial({ color: W.color || 0x8a8378 }));
      panel.position.y = c.F + 2.3; face.add(panel);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.9, 0.08), new THREE.MeshBasicMaterial({ color: 0x050505 }));
      hole.position.set(0, c.F + 1.95, -0.2); hole.visible = false; face.add(hole);
      c.game.scene.add(face);
      c.face = face; c.panel = panel; c.hole = hole;
      c.runFrom = c.W.clone().addScaledVector(c.n, 0.6);
      c.runTo = c.B.clone();
    },
    cam(c, t) {
      const W = c.W, n = c.n, side = c.side, fit = c.fit, b = c.b;
      if (t < 2.8) {
        const k = ease(seg(t, 0, 2.8));
        const pos = W.clone().addScaledVector(n, (12 - 3 * k) * fit).addScaledVector(side, 4.5 * fit); pos.y = c.F + 2.2;
        return { pos, look: new V3(W.x, c.F + 2.2, W.z), fov: 55 - 5 * k };
      }
      if (t < 5.3) {
        const p = b.pos;
        const dir = new V3().subVectors(c.runTo, c.runFrom).setY(0).normalize();
        const perp = new V3(-dir.z, 0, dir.x);
        const pos = p.clone().addScaledVector(perp, 7.5 * fit).addScaledVector(dir, 2.5 * fit); pos.y = c.F + 2.6;
        return { pos, look: new V3(p.x, c.F + 2.4, p.z), fov: 52 };
      }
      return null;
    },
    keys: [[5.3, 8, 3, 2.6, 0, 0, 3.6, 52], [6.3, 10, -2.2, 2.9, 0, 0, 4.1, 50], [9.4, 8.8, -1.5, 3.2, 0, 0, 4.4, 46]],
    step(c, t) {
      const b = c.b, F = c.F, W = c.W, n = c.n;
      c.once("thud1", 0.35, () => { G.Audio.cine("thud"); c.shake(0.06, 0.3); c.dust(0.4); });
      c.once("thud2", 1.4, () => { G.Audio.cine("thud"); c.shake(0.1, 0.4); c.dust(1); for (let i = 0; i < 6; i++) FX().chunk(W.x + n.x * 0.5 + (Math.random() - 0.5) * 4, F + 4.4, W.z + n.z * 0.5 + (Math.random() - 0.5) * 4, n.x, 0, n.z, 0.18, 0x8a8378, 1.2); });
      c.once("whistle", 2.3, () => G.Audio.boss("whistle", { pos: W }));
      c.once("crash", 2.8, () => {
        G.Audio.cine("crash"); c.shake(0.3, 0.9); c.flash(0.2);
        c.panel.visible = false; c.hole.visible = true;
        b.root.visible = true;
        const col = c.A.wall.color || 0x8a8378;
        for (let i = 0; i < 70; i++) {
          const s = (Math.random() - 0.5) * 4.6, h = F + 0.3 + Math.random() * 4.2;
          const sp = 4 + Math.random() * 8;
          FX().chunk(W.x + c.side.x * s + n.x * 0.5, h, W.z + c.side.z * s + n.z * 0.5, n.x * sp + (Math.random() - 0.5) * 3, 1 + Math.random() * 4, n.z * sp + (Math.random() - 0.5) * 3, 0.2 + Math.random() * 0.45, i % 3 ? col : 0x5a554c, 2.6);
        }
        c.dust(2.2);
      });
      if (t >= 2.8 && t < 5.2) {
        const k = seg(t, 2.8, 5.2);
        // slow first (through the slow motion), then flat out
        const kk = k < 0.33 ? k * 0.45 : 0.15 + (k - 0.33) / 0.67 * 0.85;
        b.pos.lerpVectors(c.runFrom, c.runTo, ease(kk));
        b.pos.y = F;
        b.root.rotation.y = Math.atan2(c.runTo.x - c.runFrom.x, c.runTo.z - c.runFrom.z);
        b.movedSpeed = 9;
        b.pose = { torso: 0.55, head: -0.25 };
        if (Math.random() < 0.8) FX().burst(b.pos.x, F + 0.1, b.pos.z, 1, 0x5a4a34, 2, 0.22, 2);
      } else b.movedSpeed = 0;
      c.once("skid", 5.2, () => { b.pos.copy(c.runTo); G.Audio.cine("skid"); c.dust(1.5, b.pos); c.shake(0.1, 0.4); b.root.rotation.y = Math.atan2(c.A.player.x - b.pos.x, c.A.player.z - b.pos.z); });
      c.once("beat", 5.6, () => { b.pose = { armL: [-1.4, -0.4], armR: [-1.0, 0.3], torso: -0.1 }; G.Audio.cine("thump"); });
      c.once("beat2", 5.85, () => { b.pose = { armL: [-1.0, -0.3], armR: [-1.4, 0.4], torso: -0.1 }; G.Audio.cine("thump"); });
      c.once("roar", 6.1, () => { b.pose = { head: -0.5, armL: [-0.6, 1.0], armR: [-0.6, -1.0], torso: -0.15 }; G.Audio.bossVoice("roar", b.def.voice); c.shake(0.18, 0.9); });
      c.once("settle", 7.2, () => { b.pose = {}; });
    },
    done(c) { c.game.scene.remove(c.face); c.face.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); },
  };

  S.roots = {
    slow: [[4.4, 5.1, 0.3]],
    keys: [
      [0, 10, 4, 2, 0, 0, 0.8, 58], [2.5, 8, 5, 3, 0, 0, 1.5, 56], [3.6, 7, 3, 1.5, 0, 0, 3.0, 52],
      [4.6, 6.5, 1.5, 1.6, 0, 0, 4.8, 46], [6.0, 9, -3, 3, 0, 0, 4.5, 50], [9.4, 8.5, -2, 3.4, 0, 0, 5.0, 46],
    ],
    setup(c) {
      c.b.pos.y = c.F - 7.5;
      c.roots = [];
      for (let i = 0; i < 40; i++) {
        const a = i * 0.62, r = (1.4 + i * 0.12) * Math.max(0.7, c.fit);
        c.roots.push({ i: i, a, r, born: 0.3 + i * 0.065, h: 2.2 + Math.random() * 2.2 });
      }
    },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B;
      c.once("rumble", 0.1, () => G.Audio.cine("rumble", { dur: 4 }));
      c.once("creak", 0.6, () => G.Audio.cine("creak"));
      c.once("creak2", 2.6, () => G.Audio.cine("creak"));
      const bend = ease(seg(t, 3.0, 4.2)), gone = ease(seg(t, 4.4, 5.8));
      c.roots.forEach((q) => {
        const g = ease(seg(t, q.born, q.born + 0.5));
        if (g > 0 && !q.puff) { q.puff = true; FX().burst(B.x + Math.cos(q.a) * q.r, F + 0.1, B.z + Math.sin(q.a) * q.r, 3, 0x3d3226, 2, 0.18, 3); }
        const r = lerp(q.r, 0.6 + (q.i % 5) * 0.12, bend);
        const x = B.x + Math.cos(q.a) * r, z = B.z + Math.sin(q.a) * r;
        const tilt = lerp(0.35, -0.3, bend);
        FX().spike(q.i, x, F - 0.2, z, Math.sin(q.a) * tilt, 0, -Math.cos(q.a) * tilt, 1.6, Math.max(0.0001, q.h * g * (1 - gone)));
      });
      if (t >= 4.2 && t < 5.9) b.pos.y = lerp(F - 7.5, F, ease(seg(t, 4.2, 5.8)));
      c.once("ignite", 4.85, () => { b.coreBoost = 1.5; G.Audio.cine("ignite"); c.flash(0.25); FX().sparks(B.x, F + 3.5, B.z, 30, 0xffb03a, 5); });
      c.once("stomp", 5.9, () => { b.pos.y = F; b.stomp = 0.3; G.Audio.cine("thud"); c.shake(0.18, 0.5); FX().shock(B.x, B.z, 10, 0x9aff4a, 0.7); });
      if (t > 5.9 && Math.random() < 0.6) FX().chunk(B.x + (Math.random() - 0.5) * 5, F + 4 + Math.random() * 3, B.z + (Math.random() - 0.5) * 5, 0, -0.5, 0, 0.12, Math.random() < 0.5 ? 0x3f5a2a : 0x2e4520, 2.2);
      c.once("roar", 6.2, () => { G.Audio.bossVoice("roar", b.def.voice); b.pose = { head: -0.5, armL: [-1.2, 1.0], armR: [-1.2, -1.0] }; });
      c.once("settle", 7.3, () => { b.pose = {}; b.coreBoost = 0; });
      if (b.stomp) b.stomp = Math.max(0, b.stomp - 0.016);
    },
    done(c) { for (let i = 0; i < 40; i++) FX().spike(i, 0, -999, 0, 0, 0, 0, 0.0001, 0.0001); c.b.coreBoost = 0; },
  };

  S.lightning = {
    slow: [[3.0, 3.8, 0.3]],
    keys: [
      [0, 12, 0, 2, 0, 0, 7, 60], [2.8, 11, 1, 2.2, 0, 0, 3, 56], [3.8, 8, 2, 2.0, 0, 0, 3.2, 50],
      [5.4, 6.5, 1, 2.8, 0, 0, 4.4, 46], [6.4, 10, -2, 3, 0, 0, 4.3, 50], [9.4, 9, -1.5, 3.4, 0, 0, 4.6, 46],
    ],
    setup(c) { c.b.root.visible = false; c.sky = c.A.kind === "field" ? c.F + 40 : c.A.ceiling - 0.1; },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B;
      c.once("f1", 0.8, () => { c.flash(0.3); G.Audio.cine("thunder_far"); });
      c.once("f2", 1.9, () => { c.flash(0.4); G.Audio.cine("thunder_far"); });
      c.once("strike", 3.0, () => {
        G.Audio.cine("thunder"); c.flash(1); c.shake(0.3, 0.8);
        FX().shock(B.x, B.z, 12, 0x9ae8ff, 0.8); FX().scorch(B.x, B.z, 3, 0x0e1014, 6);
        FX().sparks(B.x, F + 0.3, B.z, 50, 0xcff4ff, 9);
      });
      if (t >= 3.0 && t < 3.8 && Math.random() < 0.5) FX().bolt(new V3(B.x + (Math.random() - 0.5) * 4, c.sky, B.z + (Math.random() - 0.5) * 4), new V3(B.x, F + 0.2, B.z));
      if (t >= 3.8 && t < 5.4) {
        b.root.visible = Math.random() < 0.3 + 0.7 * seg(t, 3.8, 5.3);
        b.charging = true;
        if (Math.random() < 0.3) FX().sparks(B.x, F + 1 + Math.random() * 4, B.z, 4, 0x7ad8ff, 3);
      }
      c.once("buzz", 3.9, () => G.Audio.cine("buzz", { dur: 1.6 }));
      c.once("solid", 5.4, () => { b.root.visible = true; b.pose = { armL: [-2.6, 0.7], armR: [-2.6, -0.7], head: -0.3 }; });
      if (t >= 5.6 && t < 6.6 && Math.random() < 0.35 && b.rig.armL) {
        const a = new V3(), d = new V3();
        b.rig.armL.localToWorld(a.set(0, -3.1, 0)); b.rig.armR.localToWorld(d.set(0, -3.1, 0));
        FX().bolt(a, d, 0xbfefff);
      }
      c.once("laugh", 5.7, () => G.Audio.bossVoice("laugh", b.def.voice));
      c.once("settle", 7.0, () => { b.pose = {}; b.charging = false; });
    },
    done(c) { c.b.root.visible = true; c.b.charging = false; },
  };

  S.fog = {
    slow: [[4.2, 5.0, 0.3]],
    keys: [
      [0, 13, 2, 2.5, 0, 0, 1.5, 58], [2.5, 10, 4, 2.0, 0, 0, 2, 56], [4.2, 7, 1.5, 2.2, 0, 0, 3.6, 48],
      [5.2, 6, 0.8, 3.2, 0, 0, 4.4, 44], [6.3, 9.5, -2.2, 2.8, 0, 0, 4, 50], [9.4, 8.5, -1.5, 3, 0, 0, 4.3, 46],
    ],
    setup(c) {
      c.fade = [c.b.rig.shared.lambert, c.b.rig.shared.basic];
      c.fade.forEach((m) => { m.transparent = true; m.opacity = 0; m.needsUpdate = true; });
      c.glow = FX().decal({ mode: "disc", x: c.B.x, z: c.B.z, r: 0.5, w: 0.6, color: 0x5aff2a, opacity: 0.6, prog: 1, add: true });
      FX().md.pull = { x: c.B.x, z: c.B.z, y: c.F + 2.2, k: 2.5, swirl: 2, ky: 0.6 };
    },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B;
      c.once("hiss", 0.2, () => G.Audio.cine("hiss", { dur: 5 }));
      if (t < 4.8) for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, r = (11 + Math.random() * 5) * c.fit;
        FX().mote(B.x + Math.cos(a) * r, F + 0.3 + Math.random() * 3, B.z + Math.sin(a) * r, -Math.cos(a) * 1.5, 0, -Math.sin(a) * 1.5, i % 2 ? 0x6aff3a : 0x3a8a2a, 3.5, 0.2, 0);
      }
      if (FX().md.pull) FX().md.pull.k = lerp(2.5, 12, seg(t, 2.5, 4.8));
      c.glow.set({ r: 0.5 + 3.5 * c.fit * ease(seg(t, 0.5, 4.0)), opacity: 0.6 * (1 - ease(seg(t, 5.2, 7))) });
      const op = ease(seg(t, 3.0, 5.0));
      c.fade.forEach((m) => { m.opacity = Math.min(1, op * (0.85 + 0.15 * Math.random())); });
      c.once("solid", 5.0, () => {
        c.fade.forEach((m) => { m.transparent = false; m.opacity = 1; m.needsUpdate = true; });
        FX().md.pull = null;
        FX().sparks(B.x, F + 2.5, B.z, 40, 0x7aff3a, 6);
        G.Audio.cine("wheeze");
        G.Perf.flash(new V3(B.x, F + 4.8, B.z), 0x9aff4a, 3, 10, 400);
      });
      c.once("laugh", 5.9, () => { G.Audio.bossVoice("cackle", b.def.voice); b.pose = { head: -0.5, torso: 0.1, armL: [-1.4, 0.6], armR: [-1.8, -0.4] }; });
      if (t > 5.9 && t < 6.8 && Math.random() < 0.6) { const h = new V3(); b.rig.eye.getWorldPosition(h); FX().mote(h.x, h.y - 0.3, h.z, (Math.random() - 0.5), 0.8, (Math.random() - 0.5) + 1, 0x7aff3a, 1.2, 0.8, 0); }
      c.once("settle", 7.2, () => { b.pose = {}; });
    },
    done(c) { c.fade.forEach((m) => { m.transparent = false; m.opacity = 1; m.needsUpdate = true; }); c.glow.hide(); if (FX().md) FX().md.pull = null; },
  };

  S.portal = {
    slow: [[3.6, 4.4, 0.3]],
    keys: [
      [0, 11, 2, 3.0, -1.5, 0, 3, 55], [2.0, 9, 1.5, 3.0, -1.5, 0, 3.2, 52], [3.6, 7, 0.8, 3.2, -0.5, 0, 3.8, 46],
      [5.0, 8, 2, 3.5, 0, 0, 4.2, 50], [6.3, 10, -2.2, 3, 0, 0, 4.2, 50], [9.4, 9, -1.6, 3.4, 0, 0, 4.5, 46],
    ],
    setup(c) {
      const b = c.b;
      c.from = c.local(-3.8, 0, 0); c.from.y = c.F;
      b.pos.copy(c.from);
      const pc = c.local(-1.6, 0, 0);
      const u = { uTime: { value: 0 } };
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShaderMaterial({
        uniforms: u, side: THREE.DoubleSide,
        vertexShader: "varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: [
          "uniform float uTime; varying vec2 vP;",
          "void main() {",
          "  float r = length(vP); float a = atan(vP.y, vP.x);",
          "  float s = 0.5 + 0.5 * sin(a * 5.0 + r * 14.0 - uTime * 7.0);",
          "  vec3 deep = vec3(0.02, 0.0, 0.05), rim = vec3(0.62, 0.25, 1.0);",
          "  vec3 col = mix(deep, rim, smoothstep(0.25, 1.0, r) * (0.35 + 0.65 * s));",
          "  gl_FragColor = vec4(col, 1.0);",
          "}",
        ].join("\n"),
      }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0xc27aff }));
      const g = new THREE.Group();
      g.add(disc); g.add(ring);
      g.position.set(pc.x, c.F + 3.3, pc.z);
      g.rotation.y = Math.atan2(c.f.x, c.f.z);
      g.scale.setScalar(0.001);
      c.game.scene.add(g);
      c.portal = { g, u, pc };
    },
    step(c, t) {
      const b = c.b, F = c.F, pc = c.portal.pc;
      c.portal.u.uTime.value = t;
      c.once("spark", 0.4, () => { G.Audio.cine("portal", { dur: 5.4 }); FX().sparks(pc.x, F + 3.3, pc.z, 20, 0xc27aff, 3); });
      const open = ease(seg(t, 0.8, 3.0)) * (1 - ease(seg(t, 5.0, 5.5)));
      c.portal.g.scale.setScalar(Math.max(0.001, open * 3.4 * Math.max(0.75, c.fit)));
      c.portal.g.rotation.z = t * 0.6;
      if (open > 0.1 && t < 5) {
        FX().md.pull = { x: pc.x, z: pc.z, y: F + 3.3, k: 6, swirl: 5, ky: 2 };
        for (let i = 0; i < 3; i++) { const a = Math.random() * 6.3, r = 4 + Math.random() * 6; FX().mote(pc.x + Math.cos(a) * r, F + 0.5 + Math.random() * 5, pc.z + Math.sin(a) * r, 0, 0, 0, i % 2 ? 0xa24aff : 0x6a3aff, 1.8, 0.6, 0); }
      }
      if (t >= 3.2 && t < 5.0) b.pos.lerpVectors(c.from, c.B, ease(seg(t, 3.2, 4.9)));
      c.once("close", 5.0, () => { b.pos.copy(c.B); FX().md.pull = null; G.Audio.cine("pop"); c.flash(0.35); FX().shock(pc.x, pc.z, 8, 0xa24aff, 0.6); });
      c.once("voice", 5.8, () => { b.pulling = true; G.Audio.bossVoice("roar", b.def.voice); c.shake(0.12, 0.8); b.pose = { armL: [-1.8, 1.0], armR: [-1.8, -1.0] }; });
      c.once("settle", 7.0, () => { b.pose = {}; b.pulling = false; });
    },
    done(c) { c.game.scene.remove(c.portal.g); c.portal.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); if (FX().md) FX().md.pull = null; c.b.pulling = false; },
  };

  S.papers = {
    slow: [[3.4, 4.2, 0.3]],
    keys: [
      [0, 8, 0.5, 2.5, 0, 0, 3, 55], [1.5, 10, 3, 3, 0, 0, 3.2, 55], [3.4, 8, 2, 2.8, 0, 0, 3.4, 50],
      [4.2, 6.2, 0.6, 3.8, 0, 0, 5.2, 44], [5.6, 7, 1, 4, 0, 0, 5.3, 46], [6.3, 10, -2, 3.2, 0, 0, 4.8, 50],
      [9.4, 9, -1.4, 3.6, 0, 0, 5.2, 46],
    ],
    setup(c) { c.b.root.visible = false; },
    step(c, t) {
      const b = c.b, F = c.F, B = c.B, fx = FX();
      c.once("first", 0.3, () => { const p = c.local(5.5, 0.4, 4.2); fx.paper(p.x, p.y, p.z, 0, -0.4, 0, 3); G.Audio.cine("flip"); });
      c.once("wind", 0.8, () => { G.Audio.cine("wind", { dur: 3.2 }); fx.pd.swirl = { x: B.x, z: B.z, r: 1.8 * Math.max(0.8, c.fit), spin: 8, up: 2.6, top: Math.min(7, c.A.ceiling - c.F - 0.5), flare: 0.22 }; });
      if (t >= 0.8 && t < 3.9) {
        for (let i = 0; i < 3; i++) { const a = Math.random() * 6.3; fx.paper(B.x + Math.cos(a) * 1.8, F + 0.2 + Math.random() * 1.5, B.z + Math.sin(a) * 1.8, 0, 1, 0, 4); }
        if (fx.pd.swirl) fx.pd.swirl.r = lerp(1.8, 0.3, ease(seg(t, 3.4, 3.9))) * Math.max(0.8, c.fit);
        if (Math.random() < 0.08) G.Audio.cine("flip");
      }
      c.once("burst", 3.9, () => {
        fx.pd.swirl = null;
        const D = fx.pd;
        for (let i = 0; i < D.n; i++) { if (D.life[i] <= 0) continue; const j = i * 3, dx = D.p[j] - B.x, dz = D.p[j + 2] - B.z, d = Math.hypot(dx, dz) || 1; D.v[j] = dx / d * (5 + Math.random() * 5); D.v[j + 1] = 2 + Math.random() * 3; D.v[j + 2] = dz / d * (5 + Math.random() * 5); D.life[i] = 2 + Math.random() * 2; }
        b.root.visible = true; G.Audio.cine("whoosh"); c.shake(0.1, 0.4);
      });
      c.once("raise", 4.3, () => { b.pose = { armR: [-2.7, -0.4] }; });
      c.once("slash", 4.6, () => { b.pose = { armR: [-0.4, 0.7], torso: 0.1 }; c.slash(); G.Audio.cine("slash"); c.shake(0.16, 0.4); });
      c.once("click", 5.6, () => { b.pose = { head: 0.25, armR: [-1.2, -0.1] }; G.Audio.cine("click"); });
      c.once("laugh", 6.0, () => G.Audio.bossVoice("laugh", b.def.voice));
      c.once("settle", 7.2, () => { b.pose = {}; });
    },
    done(c) { c.b.root.visible = true; if (FX().pd) FX().pd.swirl = null; },
  };

  // the death: the same for every boss, in the boss's own colour
  const DEATH = {
    dur: 4.6, card: [2.9, 4.3], slow: [[0, 2.4, 0.45]],
    setup(c) {
      const b = c.b;
      c.rays = [];
      for (let i = 0; i < 7; i++) {
        const dir = new V3(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize();
        c.rays.push({ dir, born: 0.5 + i * 0.25, beam: FX().beam(b.def.color, 0xffffff) });
      }
      c.rays.forEach((r) => r.beam.hide());
      b.pose = { torso: -0.35, head: -0.6, armL: [-1.8, 1.2], armR: [-1.6, -1.3] };
      G.Audio.bossVoice("death", b.def.voice);
      G.Audio.cine("crackle", { dur: 2.4 });
    },
    cam(c, t) {
      const b = c.b, fit = c.fit, H = b.rig.H;
      const ang = lerp(0.7, -0.35, ease(t / 2.6)) + Math.atan2(c.f.x, c.f.z);
      const dist = (10 + 3 * ease(seg(t, 2.3, 3.2))) * fit + H * 0.3;
      const pos = new V3(c.B.x + Math.sin(ang) * dist, c.F + 2.4 + H * 0.2, c.B.z + Math.cos(ang) * dist);
      return { pos, look: new V3(c.B.x, c.F + H * 0.55, c.B.z), fov: 50 };
    },
    step(c, t) {
      const b = c.b, H = b.rig.H;
      if (t < 2.4) {
        b.root.rotation.z = Math.sin(t * 23) * 0.04 * seg(t, 0, 2.4);
        b.root.position.x = c.B.x + Math.sin(t * 31) * 0.05 * seg(t, 0.8, 2.4);
        const center = new V3(c.B.x, c.F + H * 0.55, c.B.z);
        c.rays.forEach((r) => {
          if (t < r.born) return;
          if (!r.beam.on) { r.beam.on = true; r.beam.group.visible = true; G.Audio.cine("crack_light"); }
          const len = 0.5 + 4 * ease(seg(t, r.born, r.born + 0.6));
          r.beam.set(center, center.clone().addScaledVector(r.dir, len), 0.18);
        });
        if (Math.random() < 0.5) FX().sparks(c.B.x, c.F + H * 0.5, c.B.z, 3, b.def.color, 4);
      }
      c.once("boom", 2.4, () => {
        c.rays.forEach((r) => r.beam.hide());
        b.root.rotation.z = 0;
        G.Bosses.explode(c.game);
        G.Audio.cine("explode");
        c.flash(1);
        c.shake(0.35, 1.0);
      });
    },
    done(c) { c.rays.forEach((r) => r.beam.hide()); },
  };

  // ---------------- the player ----------------
  G.Cutscene = {
    active: false, t: 0, dur: 10, camera: null,

    ensure() {
      if (!this.camera) {
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
        window.addEventListener("resize", () => { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); });
      }
      this.el = this.el || {
        root: document.getElementById("cine"), card: document.getElementById("cine-card"),
        wave: document.getElementById("cine-wave"), name: document.getElementById("cine-name"),
        title: document.getElementById("cine-title"), thai: document.getElementById("cine-thai"),
        slash: document.getElementById("cine-slash"), flash: document.getElementById("cine-flash"),
      };
    },
    play(game, b, A, onDone) { this.start(game, b, A, S[b.def.intro] || S.burst, 10, onDone, "intro"); },
    death(game, b, A, onDone) { this.start(game, b, A, DEATH, DEATH.dur, onDone, "death"); },
    start(game, b, A, script, dur, onDone, kind) {
      this.ensure();
      this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
      const P = game.yawObject.position;
      const f = new V3(P.x - b.pos.x, 0, P.z - b.pos.z);
      if (f.lengthSq() < 0.01) f.set(0, 0, 1);
      f.normalize();
      const c = this.ctx = {
        game, b, A, script, kind, F: A.floorY, fit: A.fit || 1, B: b.pos.clone(), f, r: new V3(-f.z, 0, f.x),
        fired: {}, shakeA: 0, shakeT: 0,
        once: (name, at, fn) => { if (c.t >= at && !c.fired[name]) { c.fired[name] = true; fn(); } },
        local: (a, bb, h) => new V3(c.B.x + c.f.x * a + c.r.x * bb, c.F + (h || 0), c.B.z + c.f.z * a + c.r.z * bb),
        shake: (a, d) => { c.shakeA = Math.max(c.shakeA, a); c.shakeT = Math.max(c.shakeT, d); },
        flash: (k) => this.flashScreen(k),
        slash: () => { const s = this.el.slash; if (!s) return; s.classList.remove("go"); void s.offsetWidth; s.classList.add("go"); },
        dust: (k, at) => {
          const W = at || c.W;
          for (let i = 0; i < 30 * k; i++) FX().mote(W.x + (Math.random() - 0.5) * 4, c.F + Math.random() * 3, W.z + (Math.random() - 0.5) * 4, (c.n ? c.n.x : 0) * 2 + (Math.random() - 0.5), 0.5, (c.n ? c.n.z : 0) * 2 + (Math.random() - 0.5), 0x8a8070, 1.6, 1.2, 0);
        },
        t: 0,
      };
      this.t = 0; this.dur = dur; this.onDone = onDone; this.kind = kind;
      b.root.visible = true;
      b.pose = {};
      FX().init(game.scene, A.floorY);
      script.setup(c);
      // the card
      const def = b.def, E = this.el;
      E.card.style.transition = "none";
      E.card.classList.remove("show");
      void E.card.offsetWidth;
      E.card.style.transition = "";
      E.card.classList.toggle("death", kind === "death");
      E.wave.textContent = kind === "death" ? "" : G.T("cine.wave", { n: game.wave });
      E.name.textContent = G.T("boss." + def.id + ".name");
      E.title.textContent = kind === "death" ? G.T("cine.defeated") : G.T("boss.the", { w: def.word.charAt(0).toUpperCase() + def.word.slice(1) });
      E.thai.innerHTML = kind === "death" ? "" : G.Bosses.meaningHtml(def);
      E.thai.lang = G.Lang.TAG[G.Lang.meaning()];
      document.body.classList.add("cine-on");
      document.body.classList.remove("slowmo");
      G.Input.clearHeldInputs();
      G.UI.setBossBar(false);
      if (G.Tips) G.Tips.hide();
      G.Audio.cine(kind === "death" ? "slow" : "sting", {});
      if (kind === "intro") G.Audio.cineBed(true);
      this.active = true;
    },
    slowAt(t) {
      const sl = this.ctx.script.slow || [];
      for (const s of sl) if (t >= s[0] && t < s[1]) return s[2];
      return 1;
    },
    update(game, dt) {
      if (!this.active) return;
      const c = this.ctx;
      const prev = this.t;
      this.t = Math.min(this.dur, this.t + dt);
      c.t = this.t;
      const t = this.t;
      const k = this.slowAt(t);
      if (k < 1 && this.slowAt(prev) >= 1 && this.kind === "intro") G.Audio.cine("slow", {});
      const fdt = dt * k;
      c.script.step(c, t, dt);
      G.BossFX.update(fdt);
      G.Arena.update(dt);
      c.b.t = (c.b.t || 0) + fdt;
      G.Bosses.animate(c.b, fdt);
      game.updateDyingZombies(dt);
      G.ZombieFX.update(game, dt);
      // the card
      const card = c.script.card || [6.2, 9.3];
      this.el.card.classList.toggle("show", t >= card[0] && t < card[1]);
      if (!this.fiCard && t >= card[0]) { this.fiCard = true; G.Audio.cine(this.kind === "death" ? "card_death" : "card", {}); }
      // the camera
      this.placeCamera(c, t, dt);
      // the world as seen from here: lights, what is drawn, the sky, the sound
      const cam = this.camera, dir = new V3();
      cam.getWorldDirection(dir);
      G.Perf.updateLights(cam.position, dir.setY(0).normalize(), performance.now() / 1000);
      G.Perf.updateSparks(dt);
      if (G.Zones) G.Zones.update(game);
      if (G.Details) G.Details.update(game, dt);
      if (G.Sky) G.Sky.update(game, dt);
      G.updateDriftingFog(game.scene, game.world, performance.now() / 1000);
      if (game.world.dress) game.world.dress.update(dt);
      game.updateAudio(dt);
      G.Audio.updateListener(cam);
      if (t >= this.dur) this.finish();
    },
    placeCamera(c, t, dt) {
      const cam = this.camera, s = c.script;
      let v = s.cam ? s.cam(c, t) : null;
      if (!v && s.keys) v = this.fromKeys(c, s.keys, t);
      if (!v) v = { pos: c.local(10, -2, 3), look: c.local(0, 0, 4), fov: 50 };
      const pos = v.pos.clone(), look = v.look.clone();
      let fov = v.fov || 50;
      // the last moments: into the player's own eyes
      const hand = 0.6, hk = ease(seg(t, this.dur - hand, this.dur));
      if (hk > 0) {
        const g = c.game, eye = g.yawObject.position.clone();
        const yaw = g.yawObject.rotation.y, pitch = g.pitchObject.rotation.x;
        const fwd = new V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
        pos.lerp(eye, hk);
        look.lerp(eye.clone().addScaledVector(fwd, 10), hk);
        fov = lerp(fov, g.camera.fov, hk);
      }
      // off the walls and under the ceiling in a hall; never under the ground
      const A = c.A;
      if (A.kind === "hall" && hk < 1) {
        pos.x = Math.max(A.rect.minX + 0.2, Math.min(A.rect.maxX - 0.2, pos.x));
        pos.z = Math.max(A.rect.minZ + 0.2, Math.min(A.rect.maxZ - 0.2, pos.z));
        pos.y = Math.min(A.ceiling - 0.4, pos.y);
        look.y = Math.min(A.ceiling - 0.2, look.y);
      }
      pos.y = Math.max(c.F + 0.25, pos.y);
      if (c.shakeT > 0) {
        c.shakeT -= dt;
        const a = c.shakeA * Math.min(1, c.shakeT * 2);
        pos.x += (Math.random() - 0.5) * a; pos.y += (Math.random() - 0.5) * a; pos.z += (Math.random() - 0.5) * a;
        if (c.shakeT <= 0) c.shakeA = 0;
      }
      cam.position.copy(pos);
      cam.lookAt(look);
      if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld(true);
    },
    fromKeys(c, keys, t) {
      if (!keys.length) return null;
      let i = 0;
      while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
      const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)];
      const u = a === b ? 0 : ease((t - a[0]) / Math.max(0.001, b[0] - a[0]));
      const L = (j) => lerp(a[j], b[j], u);
      const fit = c.fit;
      return { pos: c.local(L(1) * fit, L(2) * fit, L(3)), look: c.local(L(4) * fit, L(5) * fit, L(6)), fov: L(7) };
    },
    finish() {
      const c = this.ctx;
      this.active = false;
      this.fiCard = false;
      document.body.classList.remove("cine-on");
      this.el.card.classList.remove("show");
      if (c && c.script.done) c.script.done(c);
      if (c && c.b) { c.b.pose = {}; c.b.root.rotation.z = 0; if (c.b.alive) c.b.pos.y = c.A.floorY; }
      G.Audio.cineBed(false);
      // whatever the mouse or a finger did while the scene played is dropped
      G.Input.consumeMouseDelta();
      G.Input.clearHeldInputs();
      const cb = this.onDone;
      this.onDone = null;
      this.ctx = null;
      if (cb) cb();
    },
    // a run ends in the middle of one: tidy up, no callback
    stop() {
      if (!this.active) return;
      this.active = false;
      this.fiCard = false;
      document.body.classList.remove("cine-on");
      if (this.el) this.el.card.classList.remove("show");
      const c = this.ctx;
      try { if (c && c.script.done) c.script.done(c); } catch (e) { /* the scene is going anyway */ }
      G.Audio.cineBed(false);
      this.ctx = null; this.onDone = null;
    },
    // a white flash over everything (lightning, an eye opening, a blast)
    flashScreen(k) {
      this.ensure();
      const f = this.el.flash;
      if (!f) return;
      f.style.transition = "none";
      f.style.opacity = String(Math.min(1, k));
      void f.offsetWidth;
      f.style.transition = "opacity " + (0.25 + k * 0.5) + "s ease-out";
      f.style.opacity = "0";
    },
  };
})();
