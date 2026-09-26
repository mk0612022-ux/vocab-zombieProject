// ===================================================================
// Gun line test (dev tool, not shipped)
// -------------------------------------------------------------------
// Finds what draws thin lines over a held gun while running. Load it in the
// game page after tools/dev-capture.js, then:
//   await G.GunLinesTest.run()          -> { geometry, pixels, nearest }
// Three checks, over every gun:
//   geometry  every gun model's boxes: faces of different colours lying in
//             the same plane (they z-fight: a flickering line) and faces
//             facing each other with a 0-4.5mm gap between them (a slit the
//             background shows through)
//   pixels    the gun and arms alone, drawn while jogging and sprinting,
//             twice with the near plane moved by 25%: a pixel whose colour
//             changes is one two surfaces are fighting over
//   nearest   how close any vertex on screen comes to the camera in those
//             poses (anything inside the near plane is cut off)
// ===================================================================
G.GunLinesTest = (function () {
  function faces(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), out = [];
    let id = 0;
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== "BoxGeometry") return;
      const p = o.geometry.parameters, m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const hx = p.width / 2, hy = p.height / 2, hz = p.depth / 2;
      const C = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
      const F = [
        [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]],
        [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]],
        [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz]],
      ];
      const mid = id++;
      F.forEach((f) => {
        const pts = f.map((v) => C(v[0], v[1], v[2]));
        const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
        out.push({ mid, pts, n, d: n.dot(pts[0]), key: o.material.type + (o.material.color ? o.material.color.getHex() : "") });
      });
    });
    return out;
  }
  // area shared by two convex quads in (nearly) one plane
  function overlap(A, B, n) {
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const P = (v) => (ax >= ay && ax >= az ? [v.y, v.z] : ay >= az ? [v.x, v.z] : [v.x, v.y]);
    let poly = A.map(P);
    const clip = B.map(P);
    const area = (q) => { let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
    const sgn = Math.sign(area(clip)) || 1;
    for (let i = 0; i < clip.length && poly.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length];
      const side = (p) => sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
      const next = [];
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k], q = poly[(k + 1) % poly.length], sp = side(p), sq = side(q);
        if (sp >= -1e-12) next.push(p);
        if ((sp >= -1e-12) !== (sq >= -1e-12)) { const t = sp / (sp - sq); next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
      poly = next;
    }
    return poly.length >= 3 ? Math.abs(area(poly)) : 0;
  }
  function scanModel(root) {
    const F = faces(root);
    let coplanar = 0, gaps = 0;
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
      const a = F[i], b = F[j];
      if (a.mid === b.mid) continue;
      const dot = a.n.dot(b.n);
      if (dot > 0.9999 && a.key !== b.key && Math.abs(a.d - b.d) < 2e-5 && overlap(a.pts, b.pts, a.n) > 1e-6) coplanar++;
      if (dot < -0.9999) { const gap = -(a.d + b.d); if (gap > 2e-5 && gap < 0.0045 && overlap(a.pts, b.pts, a.n) > 1e-6) gaps++; }
    }
    return { coplanar, gaps };
  }

  async function run(opts) {
    opts = opts || {};
    const g = G.Game, I = G.Input, W = 480, H = 270;
    const ids = opts.ids || Object.keys(G.WEAPON_DEFS);
    const geometry = {};
    ids.forEach((id) => { geometry[id] = scanModel(G.buildWeaponModel(G.WEAPON_DEFS[id])); });
    geometry.melee = scanModel(G.buildMeleeMesh());

    __stage({ level: 1, quality: "high", x: 0, z: 10 });
    g.renderer.setSize(W, H, false); g.camera.aspect = W / H; g.camera.updateProjectionMatrix();
    const gl = g.renderer.getContext();
    const vm = g.vmCamera, base = vm ? vm.near : 0.1;
    const vmOnly = (near) => {
      const sc = g.scene, cam = g.camera;
      sc.updateMatrixWorld(true);
      const bg = sc.background, fog = sc.fog;
      sc.background = new THREE.Color(0); sc.fog = null;
      if (vm) {
        vm.matrixWorld.copy(cam.matrixWorld); vm.matrixWorldInverse.copy(cam.matrixWorldInverse); vm.matrixAutoUpdate = false;
        vm.fov = cam.fov; vm.aspect = cam.aspect; vm.near = near; vm.updateProjectionMatrix();
        g.renderer.autoClear = true; g.renderer.render(sc, vm);
        vm.near = base; vm.updateProjectionMatrix();
      } else g.renderer.render(sc, cam);
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sc.background = bg; sc.fog = fog;
      return px;
    };
    const flips = () => {
      const A = vmOnly(base), B = vmOnly(base * 1.25);
      let c = 0;
      for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) c++;
      return c;
    };
    const tanV = Math.tan(THREE.MathUtils.degToRad(g.camera.fov / 2)), tanH = tanV * g.camera.aspect;
    const nearest = () => {
      g.scene.updateMatrixWorld(true);
      const inv = g.camera.matrixWorldInverse, v = new THREE.Vector3(), m = new THREE.Matrix4();
      let best = 1e9;
      [g.weaponViewGroup, G.PlayerBody.armRig && G.PlayerBody.armRig.group].forEach((root) => root && root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        m.multiplyMatrices(inv, o.matrixWorld);
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m);
          const d = -v.z;
          if (d > -0.5 && Math.abs(v.x) < Math.max(d, 0.02) * tanH * 1.2 && Math.abs(v.y) < Math.max(d, 0.02) * tanV * 1.2) best = Math.min(best, d);
        }
      }));
      return best;
    };
    const pixels = {}, near = {};
    for (const id of ids) {
      const slot = g.player.gunSlots.indexOf(id);
      if (slot >= 0) g.switchSlot(slot + 1); else g.acquireWeapon(id);
      I.touchMove = { x: 0, y: 0, active: true }; I.touchSprint = false;
      g.yawObject.position.set(0, 1.7, 14); g.yawObject.rotation.y = 0; g.pitchObject.rotation.x = 0;
      __run(1.2);
      let mx = 0, total = 0, mn = 1e9;
      for (const sprint of [false, true]) {
        I.touchMove = { x: 0, y: -1, active: true }; I.touchSprint = sprint;
        __run(0.5);
        for (let k = 0; k < 6; k++) {
          __run(0.083);
          if (g.yawObject.position.z < -30) g.yawObject.position.z = 14;
          const c = flips(); mx = Math.max(mx, c); total += c;
          mn = Math.min(mn, nearest());
        }
      }
      I.touchMove = { x: 0, y: 0, active: true }; I.touchSprint = false;
      pixels[id] = { max: mx, total };
      near[id] = +mn.toFixed(3);
      await new Promise((r) => setTimeout(r, 0));
    }
    return { nearPlane: base, geometry, pixels, nearest: near };
  }
  return { run, scanModel };
})();
