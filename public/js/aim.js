// ===================================================================
// Aiming into a crowd (new series, round 1, B)
// -------------------------------------------------------------------
//   hitting   every zombie is hit part by part -- the head, the body (with a
//             coat's tails, a gown, a skirt), each upper arm, forearm, hand,
//             thigh, shin and foot; a crawler's body, head, arms and stumps --
//             and each part exactly where and as it is drawn: a long or a
//             swollen arm, a head carried in a hand, a crawler reaching, the
//             gap between two fingers. A shot tests the visible parts of the
//             zombies still alive and nothing more: never a word's empty
//             band, a body falling, a head flying off, a drop, a particle, an
//             effect, anything hidden. Each part also has a box fitted to it
//             (G.Aim.makeHitboxes, from js/entities.js): what the debug view
//             draws, what aim assist and the outline use.
//   labels    a word is shot by aiming at the word: it is drawn over the
//             zombies (only a wall hides it), so it is hit before any body
//             behind it -- even when its own zombie is hidden in the crowd.
//             Two words never overlap on screen: one that would is moved up or
//             down, with a thin line to its zombie's head.
//   hover     the zombie under the crosshair is outlined in light and its
//             word drawn larger.
//   assist    on a touch screen or with a controller the view is drawn a
//             little toward the nearest zombie or word (Settings: Aim assist).
//   crowd     zombies keep a little apart, and close in from several sides
//             instead of in single file (G.Crowd).
//   debug     ?hitboxes=1, or G.Aim.setDebug(true): every hitbox drawn as a
//             wire box -- for development only, not in any menu.
// The numbers are G.CONFIG.aim and G.CONFIG.crowd (js/config.js).
// ===================================================================
window.G = window.G || {};

(function () {
  const V3 = THREE.Vector3;
  const CA = () => G.CONFIG.aim, CC = () => G.CONFIG.crowd;
  const tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), fwd = new V3(), camPos = new V3();
  const UP = new V3(0, 1, 0);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  const GEO = new THREE.BoxGeometry(1, 1, 1);
  GEO.userData.shared = true;
  const MAT = new THREE.MeshBasicMaterial({ color: 0x39ff6a, wireframe: true, transparent: true, opacity: 0.9, depthTest: false });
  MAT.userData.shared = true;
  const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x9dff7a, transparent: true, opacity: 0.38, side: THREE.BackSide, depthWrite: false });
  OUTLINE.userData.shared = true;

  G.Aim = {
    debug: /[?&]hitboxes=1\b/.test(location.search),
    hover: null,
    rects: [],
    raycaster: new THREE.Raycaster(),

    // ---------------- hitboxes ----------------
    makeHitboxes(specs) {
      const pad = (G.CONFIG && G.CONFIG.aim && G.CONFIG.aim.hitboxPad) || 1.06;
      return specs.map((s) => {
        const m = new THREE.Mesh(GEO, MAT);
        m.scale.set(s.w * pad, s.h * pad, s.d * pad);
        m.position.set(s.x, s.y, s.z);
        if (s.rx) m.rotation.x = s.rx;
        m.visible = this.debug;
        m.renderOrder = 7;
        m.userData.hit = s.part;
        s.parent.add(m);
        return m;
      });
    },
    setDebug(on) {
      this.debug = !!on;
      ((G.Game && G.Game.zombies) || []).forEach((z) => (z.hitboxes || []).forEach((h) => { h.visible = this.debug; }));
    },

    // ---------------- screen ----------------
    size(game) {
      const el = game.renderer && game.renderer.domElement;
      return { w: (el && el.clientWidth) || window.innerWidth || 1024, h: (el && el.clientHeight) || window.innerHeight || 768 };
    },
    // a point in the world on the screen: x, y in CSS pixels, depth along the view
    screenOf(game, p, out) {
      const cam = game.camera, S = this.size(game);
      tmpC.copy(p).applyMatrix4(cam.matrixWorldInverse);
      const depth = -tmpC.z;
      tmpC.applyMatrix4(cam.projectionMatrix);
      out = out || {};
      out.x = (tmpC.x * 0.5 + 0.5) * S.w; out.y = (-tmpC.y * 0.5 + 0.5) * S.h; out.depth = depth;
      out.ppu = depth > 0.05 ? (S.h / 2) / (Math.tan((cam.fov * Math.PI / 180) / 2) * depth) : 0;
      return out;
    },
    // can this zombie's word be seen (and so shot)?
    labelShown(z) {
      const s = z.sprite;
      return !!(z.alive && s && s.visible && z.mesh.visible && z.labelText && !z.emerge && (s.material.opacity == null || s.material.opacity > 0.5));
    },
    // where each word is on the screen, as drawn now
    labelRects(game) {
      const out = [];
      for (const z of game.zombies) {
        if (!this.labelShown(z)) continue;
        const s = z.sprite;
        s.getWorldPosition(tmpA);
        const p = this.screenOf(game, tmpA, {});
        if (p.depth <= 0.1) continue;
        const c = s.userData.canvas || {};
        const fw = c.__fw || 0.6, fh = c.__fh || 0.7;
        const w = s.scale.x * fw * p.ppu, h = s.scale.y * fh * p.ppu;
        out.push({ z, x: p.x, y: p.y, w, h, depth: p.depth });
      }
      return out;
    },
    // the word a ray points at: it is drawn on top, so the nearest word
    // that covers the spot wins
    labelHit(game, origin, dir) {
      tmpB.copy(origin).addScaledVector(dir, 10);
      const p = this.screenOf(game, tmpB, {});
      if (p.depth <= 0) return null;
      let best = null;
      for (const r of this.labelRects(game)) {
        if (Math.abs(p.x - r.x) > r.w / 2 || Math.abs(p.y - r.y) > r.h / 2) continue;
        // (the word aimed at is drawn on top of all)
        if (r.z === this.hover) return r;
        if (!best || r.depth < best.depth) best = r;
      }
      return best;
    },

    // ---------------- a shot ----------------
    // Everything a ray from the eye meets before `far` (the first wall), in
    // order: a word first (it is drawn on top), then the hitboxes of the
    // zombies alive, nearest first, one entry a zombie.
    //   [{ z, head, point, distance, label }]
    trace(game, origin, dir, far) {
      const out = [], seen = new Set();
      const live = game.zombies.filter((z) => z.alive && z.hitboxes && z.hitboxes.length);
      live.forEach((z) => z.mesh.updateMatrixWorld(true));
      game.camera.updateMatrixWorld();
      // (a word is where it is drawn on the screen: only a shot from the eye
      // can be aimed at one -- not a ray that starts anywhere else)
      game.camera.getWorldPosition(tmpA);
      const lh = tmpA.distanceToSquared(origin) < 0.36 ? this.labelHit(game, origin, dir) : null;
      if (lh) {
        // (a word seen through a gap is still behind the wall if its zombie is)
        lh.z.sprite.getWorldPosition(tmpA);
        const d = tmpA.distanceTo(origin);
        if (d <= far + 2) {
          const point = lh.z.hitboxes[0].getWorldPosition(new V3());
          out.push({ z: lh.z, head: false, point, distance: point.distanceTo(origin), label: true });
          seen.add(lh.z);
        }
      }
      // the parts as drawn: every visible mesh of the model (not its word,
      // its hitboxes or its outline)
      // (only the zombies the ray passes near -- a sphere round each -- are
      // looked at part by part: cheap enough for every frame on a tablet)
      const parts = [];
      const rc = this.raycaster;
      rc.set(origin, dir); rc.near = 0; rc.far = far;
      live.forEach((z) => {
        if (seen.has(z)) return;
        const s = z.mesh.scale.y || 1;
        tmpA.copy(z.mesh.position); tmpA.y += 1.0 * s;
        if (rc.ray.distanceSqToPoint(tmpA) > (1.7 * s) * (1.7 * s)) return;
        if (tmpA.distanceTo(origin) - 1.7 * s > far) return;
        z.mesh.traverseVisible((m) => { if (m.isMesh && !m.userData.hit && !m.userData.outline) { m.userData.owner = z; parts.push(m); } });
      });
      for (const h of rc.intersectObjects(parts, false)) {
        const z = h.object.userData.owner;
        if (!z || seen.has(z) || !z.alive) continue;
        seen.add(z);
        // the head: anything on the neck (or the hand that carries it)
        let head = false;
        for (let o = h.object; o && o !== z.mesh; o = o.parent) if (o.userData.isNeck) { head = true; break; }
        out.push({ z, head, point: h.point, distance: h.distance, label: false });
      }
      return out;
    },

    // ---------------- each frame ----------------
    update(game, dt) {
      if (!game.camera || !game.zombies) return;
      game.camera.updateMatrixWorld();
      game.camera.getWorldPosition(camPos);
      game.camera.getWorldDirection(fwd);
      this.walls(game, dt);
      // what is under the crosshair now
      const far = game.world ? game.wallDistance(camPos, fwd, 60) : 60;
      const hits = this.trace(game, camPos, fwd, far);
      this.setHover(hits.length ? hits[0].z : null);
      this.layout(game, dt);
      this.assist(game, dt);
    },
    // a word behind a wall fades out (and cannot be shot): checked a few
    // times a second for each zombie
    walls(game, dt) {
      if (!game.world) return;
      for (const z of game.zombies) {
        if (!z.alive || !z.sprite) continue;
        z._wallT = (z._wallT || Math.random() * CA().wallCheck) - dt;
        if (z._wallT <= 0) {
          z._wallT = CA().wallCheck;
          z.sprite.getWorldPosition(tmpA);
          const d = tmpA.distanceTo(camPos);
          tmpB.copy(tmpA).sub(camPos).normalize();
          z._labelWalled = game.wallDistance(camPos, tmpB, d) < d - 0.4;
        }
        // (Word Radar's word shows through walls -- still not shot through one)
        // (visual series, E1: past combat range a word fades out with distance)
        const m = z.sprite.material, want = z._labelWalled && !z._radar ? 0 : this.labelFade(z);
        m.opacity = m.opacity + (want - m.opacity) * Math.min(1, dt * 10 || 1);
      }
    },
    // (visual series, E1) a word fades out between G.VISUAL.labels.fadeStart and fadeEnd metres
    labelFade(z) {
      const L = G.VISUAL && G.VISUAL.labels;
      if (!L || z._radar) return 1;
      z.sprite.getWorldPosition(tmpA);
      const d = tmpA.distanceTo(camPos);
      return d <= L.fadeStart ? 1 : d >= L.fadeEnd ? 0 : 1 - (d - L.fadeStart) / (L.fadeEnd - L.fadeStart);
    },
    setHover(z) {
      if (z && (z.answer === "spell" || !z.alive)) z = null;
      if (z === this.hover) return;
      if (this.hover && this.hover._outline) { this.hover._outline.forEach((m) => m.parent && m.parent.remove(m)); this.hover._outline = null; }
      this.hover = z;
      if (!z) return;
      const k = CA().outline;
      z._outline = z.hitboxes.map((h) => {
        const m = new THREE.Mesh(GEO, OUTLINE);
        m.position.copy(h.position); m.rotation.copy(h.rotation); m.scale.copy(h.scale).multiplyScalar(k);
        m.renderOrder = 2;
        m.userData.outline = true;
        h.parent.add(m);
        return m;
      });
    },
    // Words that would overlap on screen move up (or down) out of the way,
    // the nearest and the one aimed at keep their place; a moved word gets a
    // line to its zombie's head. The word aimed at is drawn larger.
    layout(game, dt) {
      const A = CA(), items = [];
      const ease = dt > 0 ? Math.min(1, dt * A.labelEase) : 1;
      for (const z of game.zombies) {
        const s = z.sprite;
        if (!s || !z._labelBase) continue;
        const shown = z.alive && s.visible && z.mesh.visible && z.labelText && !z.emerge;
        const base = s.userData.baseScale || [2.2, 0.55];
        // (the word aimed at is drawn larger, on top of the rest -- but placed
        // at its usual size, so aiming about never reshuffles the words)
        const k = z === this.hover ? A.labelHover : 1;
        s.renderOrder = z._radar ? 998 : k > 1 ? 7 : 6;
        if (!shown) { s.scale.set(base[0] * k, base[1] * k, 1); z._labelOff = 0; s.position.copy(z._labelBase); continue; }
        tmpA.copy(z._labelBase); z.mesh.localToWorld(tmpA);
        const p = this.screenOf(game, tmpA, {});
        const c = s.userData.canvas || {};
        // (visual series, E1) its letters never smaller on screen than
        // G.VISUAL.labels.minPx: a far word grows (up to maxGrow) to stay readable
        const LV = G.VISUAL && G.VISUAL.labels;
        const textPx = base[1] * (c.__fh || 0.7) * p.ppu;
        const grow = LV && textPx > 0 && textPx < LV.minPx ? Math.min(LV.maxGrow, LV.minPx / textPx) : 1;
        s.scale.set(base[0] * k * grow, base[1] * k * grow, 1);
        if (p.depth <= 0.1) continue;
        items.push({ z, s, x: p.x, y: p.y, w: base[0] * (c.__fw || 0.6) * p.ppu * grow, h: base[1] * (c.__fh || 0.7) * p.ppu * grow, depth: p.depth, ppu: p.ppu, scale: z.mesh.scale.y || 1 });
      }
      // (the nearest keep their places; each word tries the place it had
      // last frame first, so nothing shuffles while the view moves)
      items.sort((a, b) => a.depth - b.depth);
      const placed = [], gap = A.labelGapPx, lines = [], screenH = this.size(game).h;
      // (the words that found no free place this frame: tools/round15-test.js)
      const stuck = this.stuck = [];
      const fits = (r) => !placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
      // (a move down costs twice a move up: a word below the head covers the body)
      const cost = (s) => (s >= 0 ? s : -2 * s);
      for (const it of items) {
        const x0 = it.x - it.w / 2 - gap / 2, x1 = it.x + it.w / 2 + gap / 2, step = it.h + gap;
        // (how high it may go: so many of its heights, or most of the screen
        // for a small, far word that has to clear the big near ones)
        const up = Math.max(A.labelUp, (screenH * A.labelUpScreen) / step);
        // slot: how far it moves, in its own heights (+ up, - down)
        // (each rect carries half the gap on every side: two words never touch)
        const at = (slot) => { const cy = it.y - slot * step; return { x0, x1, y0: cy - it.h / 2 - gap / 2, y1: cy + it.h / 2 + gap / 2, slot }; };
        let best = null;
        // the place it had last frame if that is still free, else its own
        for (const s of [it.z._labelSlot || 0, 0]) { const r = at(s); if (fits(r)) { best = r; break; } }
        if (!best) {
          // else the nearest free gap: just above or just below a word in the way
          const cands = [];
          placed.forEach((q) => {
            if (x0 >= q.x1 || x1 <= q.x0) return;
            // (with the gap between them, so a zombie's sway never makes them touch)
            cands.push((it.y - (q.y0 - gap / 2 - it.h / 2 - 0.5)) / step, (it.y - (q.y1 + gap / 2 + it.h / 2 + 0.5)) / step);
          });
          cands.filter((s) => s <= up && s >= A.labelDown).sort((a, b) => cost(a) - cost(b))
            .some((s) => { const r = at(s); if (fits(r)) { best = r; return true; } return false; });
          // (a pile of words: higher than usual rather than over another --
          // as long as it stays on the screen)
          if (!best) cands.filter((s) => s > up && it.y - s * step - it.h / 2 > 0).sort((a, b) => a - b)
            .some((s) => { const r = at(s); if (fits(r)) { best = r; return true; } return false; });
          if (!best) { best = at(it.z._labelSlot || 0); stuck.push(it.z); }       // nowhere left: it stays
        }
        placed.push(best);
        it.z._labelSlot = best.slot;
        const want = best.slot * (it.h + gap) / (it.ppu || 1);          // world units, up
        const z = it.z;
        z._labelOff = z._labelOff + (want - z._labelOff) * ease;
        // (new series, round 2) straight up in the world, whatever the
        // zombie's sway: a word lifted far over its head would otherwise
        // swing sideways with the body into the next word
        tmpA.copy(z._labelBase); z.mesh.localToWorld(tmpA); tmpA.y += z._labelOff;
        it.s.position.copy(z.mesh.worldToLocal(tmpA));
        if (Math.abs(z._labelOff) > A.leaderMin * it.s.scale.y) {
          // from the bottom (or top) of the word to just above the head
          const sgn = z._labelOff > 0 ? -1 : 1;
          it.s.getWorldPosition(tmpA); tmpA.y += sgn * it.s.scale.y * 0.32;
          tmpB.copy(z._labelBase); z.mesh.localToWorld(tmpB); tmpB.y -= 0.28 * it.scale;
          lines.push(tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z);
        }
      }
      this.leaders(game, lines);
    },
    leaders(game, pts) {
      if (!this._lines || this._lines.parent !== game.scene) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 64), 3));
        geo.userData.shared = true;
        const mat = new THREE.LineBasicMaterial({ color: 0xe6ffe6, transparent: true, opacity: 0.6, depthTest: false, fog: false });
        mat.userData.shared = true;
        this._lines = new THREE.LineSegments(geo, mat);
        this._lines.frustumCulled = false;
        this._lines.renderOrder = 5;
        // (visual series: drawn with the words, over the finished picture)
        if (G.Visuals) this._lines.layers.set(G.Visuals.LABEL_LAYER);
        if (game.scene) game.scene.add(this._lines);
      }
      const a = this._lines.geometry.attributes.position, n = Math.min(pts.length, a.array.length);
      for (let i = 0; i < n; i++) a.array[i] = pts[i];
      a.needsUpdate = true;
      this._lines.geometry.setDrawRange(0, n / 3);
      this.leaderCount = n / 6;
    },
    // A light pull toward the zombie or word nearest the crosshair, on a touch
    // screen or a controller -- none once something is under it already
    assist(game, dt) {
      const lvl = (G.save && G.save.settings.aimAssist) || "medium";
      const P = CA().assist[lvl];
      this.assistTarget = null;
      if (!P || !(G.Input.mode === "touch" || G.Input.padActive) || !game.playing || !game.playing() || game.challenge || G.Modal.isOpen() || this.hover) return;
      const cone = P.cone * Math.PI / 180;
      let best = null, bestA = cone;
      for (const z of game.zombies) {
        if (!z.alive || z.answer === "spell" || z.emerge || !z.mesh.visible) continue;
        const pts = [];
        const body = z.hitboxes.find((h) => h.userData.hit === "body");
        if (body) pts.push(body.getWorldPosition(new V3()));
        if (this.labelShown(z)) pts.push(z.sprite.getWorldPosition(new V3()));
        for (const p of pts) {
          tmpA.copy(p).sub(camPos);
          const d = tmpA.length();
          if (d < 0.5 || d > CA().assistRange) continue;
          const a = tmpA.normalize().angleTo(fwd);
          if (a < bestA && (!game.world || game.wallDistance(camPos, tmpA, d) >= d - 0.4)) { bestA = a; best = p; }
        }
      }
      if (!best) return;
      this.assistTarget = best;
      const dx = best.x - camPos.x, dy = best.y - camPos.y, dz = best.z - camPos.z;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const k = Math.min(1, P.pull * dt) * (1 - bestA / cone);
      game.yawObject.rotation.y += wrapA(yaw - game.yawObject.rotation.y) * k;
      game.pitchObject.rotation.x += (pitch - game.pitchObject.rotation.x) * k;
      game.pitchObject.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, game.pitchObject.rotation.x));
    },
    // leaving a run
    reset() {
      if (this.hover) this.setHover(null);
      this.hover = null;
      if (this._lines && this._lines.parent) this._lines.parent.remove(this._lines);
      this._lines = null;
    },
  };

  // ---------------- the crowd ----------------
  G.Crowd = {
    // A zombie still far off heads for a point turned a little round the
    // player from where it is (its own side, its own angle), so a group
    // fans out and closes in from several sides; near the player it goes
    // straight in. null: straight at the player.
    flank(game, z, pp, pRegion) {
      const C = CC(), zp = z.mesh.position;
      const dx = zp.x - pp.x, dz = zp.z - pp.z, d = Math.hypot(dx, dz);
      if (d < C.flankFrom || z.type === "boss") return null;
      if (z._flank === undefined) z._flank = (((z.uid * 0.6180339887) % 1) * 2 - 1) * C.flank;
      const k = Math.min(1, (d - C.flankFrom) / C.flankRamp);
      const ang = Math.atan2(dz, dx) + z._flank * k, r = d - C.flankStep;
      const tx = pp.x + Math.cos(ang) * r, tz = pp.z + Math.sin(ang) * r;
      if (game.world && G.getRegionAt(game.world, tx, tz, zp.y) !== pRegion) return null;
      return new V3(tx, 0, tz);
    },
    // Two zombies closer than the gap are eased apart -- never into a wall
    separate(game, dt) {
      const C = CC(), k = Math.min(1, C.push * dt);
      const zs = game.zombies.filter((z) => z.alive && !z.emerge && z.type !== "boss");
      const free = (z, x, y) => {
        const cols = z._cols || [];
        const y0 = z.mesh.position.y + 0.2, y1 = z.mesh.position.y + 1.6;
        return !cols.some((c) => c.max.y >= y0 && c.min.y <= y1 && x >= c.min.x && x <= c.max.x && y >= c.min.z && y <= c.max.z);
      };
      for (let i = 0; i < zs.length; i++) {
        const a = zs[i].mesh.position;
        for (let j = i + 1; j < zs.length; j++) {
          const b = zs[j].mesh.position;
          if (Math.abs(a.y - b.y) > 1) continue;
          const gap = zs[i].type === "crawler" || zs[j].type === "crawler" ? C.gapCrawler : C.gap;
          const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d >= gap) continue;
          let nx = dx / d, nz = dz / d;
          // (standing on the very same spot: apart in any direction)
          if (d < 1e-3) { const r = Math.random() * Math.PI * 2; nx = Math.cos(r); nz = Math.sin(r); }
          const push = (gap - d) * 0.5 * k;
          const ax = a.x - nx * push, az = a.z - nz * push, bx = b.x + nx * push, bz = b.z + nz * push;
          if (free(zs[i], ax, az)) { a.x = ax; a.z = az; }
          if (free(zs[j], bx, bz)) { b.x = bx; b.z = bz; }
        }
      }
    },
  };
})();
