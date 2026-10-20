// ===================================================================
// The weapon's effects (overhaul, round 2)
// -------------------------------------------------------------------
// Everything a shot leaves behind, from pools made when a level is built --
// nothing is created while firing -- and moved in game time (they wait
// while the game is paused or a question is open):
//
//   muzzle flash   a sprite at the gun's muzzle, 40-60 ms, its shape and size
//                  by family, one of 4 drawn here and turned at random; the
//                  light from the fixed pool (G.Perf.flash) -- weaker for fast
//                  guns, every 2nd shot on Low, none on Very Low -- x the
//                  Muzzle Flash setting (0: a faint sprite, no light)
//   smoke          a puff a shot (every 3rd for a fast gun), one draw call for
//                  all of it, faded near the middle of the view so it never
//                  hides a zombie or its word
//   brass          thrown out to the right (not on Very Low and Low)
//   impacts        chips by what was hit (js/surface.js): dust and grit off
//                  concrete, splinters off wood, sparks off metal, glass,
//                  grass, earth, water -- and a bullet hole that fades,
//                  none on Very Low (G.CONFIG.fx.budget)
//
// Budgets per graphics level (G.CONFIG.fx.budget): particles alive at once
// across all of it, and bullet holes. Over the budget an effect gives fewer
// pieces; nothing already playing is cut short. ?debug=1 shows the counts.
// The weapon state machine's "weapon:fire" (G.Bus) sets off flash, smoke
// and brass; G.Game.raycastShoot reports where each round landed.
// ===================================================================
window.G = window.G || {};

G.FX = (function () {
  const C = () => G.CONFIG.fx;
  const quality = () => (G.save && G.save.settings.graphicsQuality) || "medium";
  const budget = () => C().budget[quality()] || C().budget.medium;
  const v3 = () => new THREE.Vector3();

  // ---------------- textures, drawn once ----------------
  const tex = {};
  function canvasTex(w, h, paint) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }
  function textures() {
    if (tex.flash) return;
    // four muzzle flashes side by side: a star of prongs round a hot core
    tex.flash = canvasTex(256, 64, (x, W, H) => {
      for (let v = 0; v < 4; v++) {
        const cx = v * 64 + 32, cy = 32, prongs = [4, 5, 6, 8][v];
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, 22);
        g.addColorStop(0, "rgba(255,255,240,1)"); g.addColorStop(0.35, "rgba(255,220,140,0.9)"); g.addColorStop(1, "rgba(255,150,60,0)");
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 22, 0, Math.PI * 2); x.fill();
        x.fillStyle = "rgba(255,230,170,0.85)";
        for (let i = 0; i < prongs; i++) {
          const a = (i / prongs) * Math.PI * 2 + v * 0.3, len = 18 + ((i * 7 + v * 3) % 11);
          x.beginPath(); x.moveTo(cx + Math.cos(a + 0.18) * 6, cy + Math.sin(a + 0.18) * 6);
          x.lineTo(cx + Math.cos(a) * (8 + len), cy + Math.sin(a) * (8 + len));
          x.lineTo(cx + Math.cos(a - 0.18) * 6, cy + Math.sin(a - 0.18) * 6); x.fill();
        }
      }
    });
    tex.smoke = canvasTex(32, 32, (x) => {
      const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    });
    tex.smoke.magFilter = THREE.LinearFilter;
    // the bullet holes, 16 px each: pixel art, read from a step away
    const hole = (paint) => canvasTex(16, 16, (x) => { x.clearRect(0, 0, 16, 16); paint(x); });
    const px = (x, c, list) => { x.fillStyle = c; list.forEach(([a, b, w, h]) => x.fillRect(a, b, w || 1, h || 1)); };
    tex.hole = hole((x) => { px(x, "rgba(120,120,120,0.55)", [[5, 4, 6, 8], [4, 5, 8, 6]]); px(x, "rgba(30,30,32,0.95)", [[6, 6, 4, 4], [7, 5, 2, 6], [5, 7, 6, 2]]); px(x, "rgba(10,10,12,1)", [[7, 7, 2, 2]]); px(x, "rgba(150,150,150,0.5)", [[3, 7], [12, 8], [8, 3], [7, 12], [11, 4], [4, 11]]); });
    tex.crack = hole((x) => { px(x, "rgba(40,40,44,0.95)", [[7, 7, 2, 2]]); px(x, "rgba(60,60,64,0.8)", [[9, 6], [10, 5], [11, 4], [12, 3], [6, 9], [5, 10], [4, 12], [9, 9], [10, 10], [11, 12], [6, 6], [5, 5], [3, 4]]); });
    tex.splinter = hole((x) => { px(x, "rgba(45,28,16,0.95)", [[6, 6, 4, 4], [7, 4, 2, 8]]); px(x, "rgba(190,140,90,0.85)", [[5, 3, 1, 3], [10, 3, 1, 4], [4, 10, 1, 3], [11, 10, 1, 3], [8, 2, 1, 2]]); });
    tex.dent = hole((x) => { px(x, "rgba(220,225,230,0.8)", [[5, 5, 6, 6]]); px(x, "rgba(90,95,100,0.9)", [[6, 6, 4, 4]]); px(x, "rgba(30,30,32,1)", [[7, 7, 2, 2]]); });
  }

  // ---------------- the pools ----------------
  const P = { scene: null, cap: 0, q: null };
  const unitBox = () => { const g = new THREE.BoxGeometry(1, 1, 1); g.userData.shared = true; return g; };
  // (an instance not in use is drawn at nothing -- an untouched one would be a
  // full-size copy at the world's origin)
  const none = new THREE.Matrix4().makeScale(0, 0, 0);
  const zero = (im, n) => { for (let i = 0; i < n; i++) im.setMatrixAt(i, none); im.instanceMatrix.needsUpdate = true; };
  const mat = (m) => { m.userData.shared = true; return m; };
  function build(scene) {
    textures();
    const B = budget(), q = quality();
    if (P.q !== q) { dispose(); P.q = q; }
    if (!P.debris) {
      // chips, splinters, sparks: one instanced mesh of small cubes
      P.cap = Math.max(1, B.particles);
      P.debris = new THREE.InstancedMesh(unitBox(), mat(new THREE.MeshLambertMaterial({ color: 0xffffff })), P.cap);
      P.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      P.debris.frustumCulled = false; P.debris.count = 0;
      zero(P.debris, P.cap);
      const white = new THREE.Color(1, 1, 1);
      for (let i = 0; i < P.cap; i++) P.debris.setColorAt(i, white);
      P.d = { pos: new Float32Array(P.cap * 3), vel: new Float32Array(P.cap * 3), rot: new Float32Array(P.cap * 3), spin: new Float32Array(P.cap * 3),
        size: new Float32Array(P.cap), age: new Float32Array(P.cap), life: new Float32Array(P.cap), floor: new Float32Array(P.cap), on: new Uint8Array(P.cap),
        glow: new Uint8Array(P.cap), next: 0, live: 0, top: 0 };
      // smoke: points with their own size and fade (one draw call)
      const n = Math.max(1, Math.round(B.particles / 4));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
      geo.userData.shared = true;
      const S = C().smoke;
      const sm = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: tex.smoke }, uColor: { value: new THREE.Color(S.color) }, uScale: { value: 400 }, uCenter: { value: S.centerFade } },
        vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; uniform float uCenter; varying float vA;
          void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
            vec2 ndc = gl_Position.xy / max(gl_Position.w, 1e-4);
            vA = aAlpha * mix(0.3, 1.0, smoothstep(0.0, uCenter * 2.0, length(ndc) - uCenter * 0.5));
            gl_PointSize = aSize * uScale / max(-mv.z, 0.1); }`,
        fragmentShader: `uniform sampler2D uTex; uniform vec3 uColor; varying float vA;
          void main() { vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`,
        transparent: true, depthWrite: false,
      });
      sm.userData.shared = true;
      P.smoke = new THREE.Points(geo, sm);
      P.smoke.frustumCulled = false;
      P.s = { n, vel: new Float32Array(n * 3), age: new Float32Array(n), life: new Float32Array(n), size: new Float32Array(n), on: new Uint8Array(n), next: 0, live: 0 };
      geo.setDrawRange(0, 0);
      // brass
      const SH = C().shells;
      P.shells = new THREE.InstancedMesh((() => { const g = new THREE.BoxGeometry(0.022, 0.022, 0.055); g.userData.shared = true; return g; })(),
        mat(new THREE.MeshLambertMaterial({ color: SH.color })), SH.pool);
      P.shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage); P.shells.frustumCulled = false; P.shells.count = 0;
      zero(P.shells, SH.pool);
      P.sh = { pos: new Float32Array(SH.pool * 3), vel: new Float32Array(SH.pool * 3), rot: new Float32Array(SH.pool * 3), spin: new Float32Array(SH.pool * 3),
        age: new Float32Array(SH.pool), on: new Uint8Array(SH.pool), floor: new Float32Array(SH.pool), next: 0, live: 0 };
      // bullet holes: one instanced quad per kind
      P.decals = {};
      if (B.decals > 0) ["hole", "crack", "splinter", "dent"].forEach((k) => {
        const g = new THREE.PlaneGeometry(1, 1); g.userData.shared = true;
        const m = mat(new THREE.MeshLambertMaterial({ map: tex[k], transparent: true, alphaTest: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
        const im = new THREE.InstancedMesh(g, m, B.decals);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0;
        zero(im, B.decals);
        P.decals[k] = { im, age: new Float32Array(B.decals), size: new Float32Array(B.decals), on: new Uint8Array(B.decals), mats: [], next: 0, live: 0, cap: B.decals };
        for (let i = 0; i < B.decals; i++) P.decals[k].mats.push(new THREE.Matrix4());
      });
    }
    attach(scene);
  }
  function attach(scene) {
    if (P.scene === scene) return;
    detach();
    P.scene = scene;
    [P.debris, P.smoke, P.shells].concat(Object.values(P.decals || {}).map((d) => d.im)).forEach((o) => o && scene.add(o));
  }
  function detach() {
    if (!P.scene) return;
    [P.debris, P.smoke, P.shells].concat(Object.values(P.decals || {}).map((d) => d.im)).forEach((o) => o && o.parent && o.parent.remove(o));
    P.scene = null;
  }
  function dispose() {
    detach();
    [P.debris, P.shells].forEach((o) => { if (o) { o.geometry.dispose(); o.material.dispose(); o.dispose && o.dispose(); } });
    if (P.smoke) { P.smoke.geometry.dispose(); P.smoke.material.dispose(); }
    Object.values(P.decals || {}).forEach((d) => { d.im.geometry.dispose(); d.im.material.dispose(); });
    P.debris = P.smoke = P.shells = null; P.decals = {};
  }
  function clear() {
    if (P.d) { P.d.on.fill(0); P.d.live = 0; P.d.top = 0; P.debris.count = 0; zero(P.debris, P.cap); }
    if (P.sh) zero(P.shells, P.sh.on.length);
    Object.values(P.decals || {}).forEach((d) => zero(d.im, d.cap));
    if (P.s) { P.s.on.fill(0); P.s.live = 0; P.smoke.geometry.setDrawRange(0, 0); }
    if (P.sh) { P.sh.on.fill(0); P.sh.live = 0; P.shells.count = 0; }
    Object.values(P.decals || {}).forEach((d) => { d.on.fill(0); d.live = 0; d.im.count = 0; });
    flash.t = 0; if (flash.mesh) flash.mesh.visible = false;
  }

  // ---------------- particles ----------------
  const live = () => (P.d ? P.d.live : 0) + (P.s ? P.s.live : 0);
  const room = (n) => Math.max(0, Math.min(n, budget().particles - live()));
  const color = new THREE.Color(), dummy = new THREE.Object3D();
  // n pieces from point p, thrown out round the normal
  function debris(p, normal, S, n, floorY) {
    const D = P.d;
    if (!D) return 0;
    n = room(n);
    const life = C().impact.life;
    for (let k = 0; k < n; k++) {
      // the oldest slot (or a free one)
      let i = D.next; D.next = (D.next + 1) % P.cap;
      if (D.on[i]) D.live--;
      D.on[i] = 1; D.live++;
      D.top = Math.max(D.top, i + 1);
      D.pos[i * 3] = p.x; D.pos[i * 3 + 1] = p.y; D.pos[i * 3 + 2] = p.z;
      const sp = S.speed * (0.5 + Math.random() * 0.8);
      const rx = normal.x + (Math.random() - 0.5) * 1.4, ry = normal.y + (Math.random() - 0.5) * 1.4 + 0.5, rz = normal.z + (Math.random() - 0.5) * 1.4;
      const l = Math.hypot(rx, ry, rz) || 1;
      D.vel[i * 3] = rx / l * sp; D.vel[i * 3 + 1] = ry / l * sp; D.vel[i * 3 + 2] = rz / l * sp;
      D.rot[i * 3] = Math.random() * 6; D.rot[i * 3 + 1] = Math.random() * 6; D.rot[i * 3 + 2] = Math.random() * 6;
      D.spin[i * 3] = (Math.random() - 0.5) * 20; D.spin[i * 3 + 1] = (Math.random() - 0.5) * 20; D.spin[i * 3 + 2] = (Math.random() - 0.5) * 20;
      D.size[i] = S.size[0] + Math.random() * (S.size[1] - S.size[0]);
      D.age[i] = 0; D.life[i] = life[0] + Math.random() * (life[1] - life[0]) * (S.spark ? 0.5 : 1);
      D.floor[i] = floorY;
      D.glow[i] = S.spark ? 1 : 0;
      color.setHex(S.colors[Math.floor(Math.random() * S.colors.length)]);
      if (S.spark) color.multiplyScalar(2.2);          // (bright enough to bloom on High and up)
      P.debris.setColorAt(i, color);
    }
    if (n && P.debris.instanceColor) P.debris.instanceColor.needsUpdate = true;
    return n;
  }
  function smokeAt(p, big) {
    const s = P.s, S = C().smoke;
    if (!s || !budget().smoke || !room(1)) return;
    const i = s.next; s.next = (s.next + 1) % s.n;
    if (!s.on[i]) s.live++;
    s.on[i] = 1; s.age[i] = 0; s.life[i] = S.life * (0.8 + Math.random() * 0.4) * (big ? 1.4 : 1);
    s.size[i] = big ? 1.6 : 1;
    const pa = P.smoke.geometry.attributes.position;
    pa.setXYZ(i, p.x, p.y, p.z);
    s.vel[i * 3] = (Math.random() - 0.5) * 0.12; s.vel[i * 3 + 1] = S.rise * (0.7 + Math.random() * 0.6); s.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
  }

  // ---------------- the muzzle flash ----------------
  const flash = { mesh: null, t: 0, geos: null, shots: {}, hold: null };
  function flashGeos() {
    if (flash.geos) return flash.geos;
    flash.geos = [0, 1, 2, 3].map((v) => {
      const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (v + uv.getX(i)) / 4);
      g.userData.shared = true;
      return g;
    });
    return flash.geos;
  }
  // a gun just built for the hands gets its flash at the muzzle (hidden)
  function attachFlash(gun, def) {
    textures();
    const fam = G.ViewModel.family(def), F = C().flash.family[fam] || C().flash.family.rifle;
    const An = gun.userData.anchors || {};
    if (!F.w || !An.muzzle) { flash.mesh = null; return; }
    const m = new THREE.MeshBasicMaterial({ map: tex.flash, color: F.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(flashGeos()[0], m);
    mesh.position.copy(An.muzzle).add(new THREE.Vector3(0, 0, -0.03));
    mesh.scale.set(F.w, F.h, 1);
    mesh.visible = false;
    mesh.renderOrder = 10;
    mesh.userData.flashSize = [F.w, F.h];
    gun.add(mesh);
    flash.mesh = mesh;
  }

  // ---------------- what a shot sets off ----------------
  const tmp = v3(), tmp2 = v3();
  function onFire(e) {
    const g = G.Game, def = G.WEAPON_DEFS[e.weaponId];
    if (!g || !def || !g.camera) return;
    const fam = e.family, F = C().flash, set = G.save.settings.muzzleFlash == null ? 1 : G.save.settings.muzzleFlash;
    const n = flash.shots[e.weaponId] = (flash.shots[e.weaponId] || 0) + 1;
    const lvl = g.player && g.player.weaponLevels[e.weaponId];
    const rpm = 60000 / Math.max(1, def.fireRate / ((lvl && lvl.rate) || 1));
    const fast = rpm > F.rpmFast;
    // where the muzzle is in the world
    const gun = g.weaponViewGroup, An = gun && gun.userData.anchors;
    if (gun && An && An.muzzle) { gun.updateMatrixWorld(true); tmp.copy(An.muzzle).applyMatrix4(gun.matrixWorld); }
    else { g.camera.getWorldDirection(tmp2); g.camera.getWorldPosition(tmp).addScaledVector(tmp2, 0.6); }
    // the sprite
    if (flash.mesh) {
      const m = flash.mesh, sz = m.userData.flashSize, j = 0.85 + Math.random() * 0.3;
      m.geometry = flashGeos()[Math.floor(Math.random() * F.variants) % 4];
      m.rotation.z = Math.random() * Math.PI * 2;
      m.scale.set(sz[0] * j, sz[1] * j, 1);
      m.material.opacity = F.minSprite + (1 - F.minSprite) * set;
      m.visible = true;
      flash.t = (F.ms[0] + Math.random() * (F.ms[1] - F.ms[0])) / 1000;
    }
    // the light: from the fixed pool, never a new one
    const every = F.lightEvery[quality()] || 0;
    if (every && n % every === 0 && set > 0 && G.Perf && G.Perf.flash) {
      G.Perf.flash(tmp, F.light.color, F.light.intensity * set * (fast ? F.fastLight : 1), F.light.distance, 50);
    }
    // smoke, brass
    if (!fast || n % C().smoke.everyFast === 0) smokeAt(tmp, fam === "shotgun_pump" || fam === "shotgun_semi" || fam === "special");
    const noBrass = /energy|beam|launcher|cannon/.test(G.inferArchetype(def) + (def.archetype || ""));
    if (!noBrass && C().shells.off.indexOf(quality()) < 0) shell(g);
  }
  function shell(g) {
    const S = P.sh, SH = C().shells;
    if (!S) return;
    const i = S.next; S.next = (S.next + 1) % SH.pool;
    if (!S.on[i]) S.live++;
    S.on[i] = 1; S.age[i] = 0;
    const cam = g.camera;
    tmp.set(0.28, -0.18, -0.5).applyMatrix4(cam.matrixWorld);
    S.pos[i * 3] = tmp.x; S.pos[i * 3 + 1] = tmp.y; S.pos[i * 3 + 2] = tmp.z;
    tmp2.set(1, 0, 0).transformDirection(cam.matrixWorld).multiplyScalar(1.4 + Math.random() * 0.8);
    S.vel[i * 3] = tmp2.x; S.vel[i * 3 + 1] = tmp2.y + 1.6 + Math.random() * 0.6; S.vel[i * 3 + 2] = tmp2.z;
    S.spin[i * 3] = 8 + Math.random() * 8; S.spin[i * 3 + 1] = Math.random() * 8; S.spin[i * 3 + 2] = Math.random() * 8;
    S.floor[i] = g.world ? G.getFloorHeightAt(g.world, tmp.x, tmp.z, tmp.y - 1.4) : 0;
    P.shells.count = SH.pool;
  }

  // ---------------- where a round landed ----------------
  // hit: { point, normal, surface, decal (allowed), moving (a door: no hole) }
  function impact(hit) {
    const g = G.Game;
    if (!hit || !hit.point) return;
    // (overhaul, round 3) and its sound, by what it hit (a shotgun's pellets: about two a shot)
    if (G.Audio && G.Audio.ctx && (!hit.pellet || Math.random() < (hit.share || 1))) G.Audio.impact(hit.surface, hit.point.clone(), { pellet: !!hit.pellet });
    if (!P.d) return;
    const cam = g && g.camera;
    if (cam) { cam.getWorldPosition(tmp2); if (tmp2.distanceTo(hit.point) > C().impact.maxDistance) return; }
    const S = C().impact.surfaces[hit.surface] || C().impact.surfaces.concrete;
    const floorY = g && g.world ? G.getFloorHeightAt(g.world, hit.point.x, hit.point.z, hit.point.y + 0.2) : 0;
    const out = tmp.copy(hit.point).addScaledVector(hit.normal, 0.02);
    debris(out, hit.normal, S, Math.max(1, Math.round(S.n * (hit.share || 1))), floorY);
    if (S.dust && !hit.pellet) smokeAt(out, false);
    if (S.decal && hit.decal !== false && !hit.moving) decal(hit.point, hit.normal, S.decal);
  }
  const zAxis = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), sc = new THREE.Vector3();
  function decal(p, normal, kind) {
    const D = P.decals && P.decals[kind];
    if (!D) return;
    const i = D.next; D.next = (D.next + 1) % D.cap;
    if (!D.on[i]) D.live++;
    D.on[i] = 1; D.age[i] = 0;
    const DC = C().decal;
    D.size[i] = DC.size[0] + Math.random() * (DC.size[1] - DC.size[0]);
    q.setFromUnitVectors(zAxis, normal);
    qr.setFromAxisAngle(zAxis, Math.random() * Math.PI * 2);
    q.multiply(qr);
    tmp.copy(p).addScaledVector(normal, DC.offset);
    sc.set(D.size[i], D.size[i], 1);
    D.mats[i].compose(tmp, q, sc);
    D.im.setMatrixAt(i, D.mats[i]);
    D.im.instanceMatrix.needsUpdate = true;
    D.im.count = D.cap;
  }

  // ---------------- the frame ----------------
  const m4 = new THREE.Matrix4(), eul = new THREE.Euler(), quat = new THREE.Quaternion(), pos = v3(), scl = v3();
  function update(dt, game) {
    // the flash: a few hundredths of a second
    if (flash.t > 0) { flash.t -= dt; if (flash.t <= 0 && flash.mesh) flash.mesh.visible = false; }
    if (!P.d) return;
    const G9 = C().impact.gravity;
    // pieces
    const D = P.d;
    if (D.live > 0) {
      for (let i = 0; i < D.top; i++) {
        if (!D.on[i]) continue;
        D.age[i] += dt;
        const k = D.age[i] / D.life[i];
        if (k >= 1) { D.on[i] = 0; D.live--; m4.makeScale(0, 0, 0); P.debris.setMatrixAt(i, m4); continue; }
        const o = i * 3;
        if (D.pos[o + 1] > D.floor[i] + 0.01) {
          D.vel[o + 1] -= G9 * dt * (D.glow[i] ? 0.5 : 1);
          D.pos[o] += D.vel[o] * dt; D.pos[o + 1] += D.vel[o + 1] * dt; D.pos[o + 2] += D.vel[o + 2] * dt;
          D.rot[o] += D.spin[o] * dt; D.rot[o + 1] += D.spin[o + 1] * dt; D.rot[o + 2] += D.spin[o + 2] * dt;
          if (D.pos[o + 1] < D.floor[i] + 0.01) { D.pos[o + 1] = D.floor[i] + 0.01; D.vel[o] *= 0.3; D.vel[o + 2] *= 0.3; }
        }
        const s = D.size[i] * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        pos.set(D.pos[o], D.pos[o + 1], D.pos[o + 2]);
        quat.setFromEuler(eul.set(D.rot[o], D.rot[o + 1], D.rot[o + 2]));
        scl.set(s, s * (D.glow[i] ? 0.6 : 1), s * (D.glow[i] ? 2.5 : 1));
        m4.compose(pos, quat, scl);
        P.debris.setMatrixAt(i, m4);
      }
      P.debris.instanceMatrix.needsUpdate = true;
      P.debris.count = D.live > 0 ? D.top : 0;
      if (D.live <= 0) D.top = 0;
    }
    // smoke
    const s = P.s;
    if (s && s.live > 0) {
      const pa = P.smoke.geometry.attributes.position, sa = P.smoke.geometry.attributes.aSize, aa = P.smoke.geometry.attributes.aAlpha;
      const SM = C().smoke;
      let top = 0;
      for (let i = 0; i < s.n; i++) {
        if (!s.on[i]) { aa.setX(i, 0); continue; }
        s.age[i] += dt;
        const k = s.age[i] / s.life[i];
        if (k >= 1) { s.on[i] = 0; s.live--; aa.setX(i, 0); continue; }
        top = i + 1;
        pa.setXYZ(i, pa.getX(i) + s.vel[i * 3] * dt, pa.getY(i) + s.vel[i * 3 + 1] * dt, pa.getZ(i) + s.vel[i * 3 + 2] * dt);
        sa.setX(i, (SM.size[0] + (SM.size[1] - SM.size[0]) * Math.sqrt(k)) * s.size[i]);
        aa.setX(i, SM.alpha * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9));
      }
      pa.needsUpdate = sa.needsUpdate = aa.needsUpdate = true;
      P.smoke.geometry.setDrawRange(0, s.live > 0 ? top : 0);
      // (a puff's size in metres -> pixels at its distance, for this view)
      if (game && game.renderer && game.camera) P.smoke.material.uniforms.uScale.value = game.renderer.domElement.height / (2 * Math.tan(game.camera.fov * Math.PI / 360));
    }
    // brass
    const S = P.sh;
    if (S && S.live > 0) {
      for (let i = 0; i < S.on.length; i++) {
        if (!S.on[i]) continue;
        S.age[i] += dt;
        if (S.age[i] > C().shells.life) { S.on[i] = 0; S.live--; m4.makeScale(0, 0, 0); P.shells.setMatrixAt(i, m4); continue; }
        const o = i * 3;
        if (S.pos[o + 1] > S.floor[i] + 0.012) {
          S.vel[o + 1] -= 9.8 * dt;
          S.pos[o] += S.vel[o] * dt; S.pos[o + 1] += S.vel[o + 1] * dt; S.pos[o + 2] += S.vel[o + 2] * dt;
          S.rot[o] += S.spin[o] * dt; S.rot[o + 1] += S.spin[o + 1] * dt; S.rot[o + 2] += S.spin[o + 2] * dt;
        }
        pos.set(S.pos[o], S.pos[o + 1], S.pos[o + 2]);
        m4.compose(pos, quat.setFromEuler(eul.set(S.rot[o], S.rot[o + 1], S.rot[o + 2])), scl.set(1, 1, 1));
        P.shells.setMatrixAt(i, m4);
      }
      P.shells.instanceMatrix.needsUpdate = true;
      if (S.live <= 0) P.shells.count = 0;
    }
    // bullet holes: they fade (shrink away) at the end of their life
    const B = budget(), fade = C().decal.fade;
    Object.values(P.decals || {}).forEach((D2) => {
      if (!D2.live) return;
      let any = false;
      for (let i = 0; i < D2.cap; i++) {
        if (!D2.on[i]) continue;
        D2.age[i] += dt;
        const left = B.decalLife - D2.age[i];
        if (left <= 0) { D2.on[i] = 0; D2.live--; m4.makeScale(0, 0, 0); D2.im.setMatrixAt(i, m4); any = true; continue; }
        if (left < fade) {
          D2.mats[i].decompose(pos, quat, scl);
          const s2 = D2.size[i] * (left / fade);
          scl.set(s2, s2, 1);
          m4.compose(pos, quat, scl);
          D2.im.setMatrixAt(i, m4); any = true;
        }
      }
      if (any) D2.im.instanceMatrix.needsUpdate = true;
      if (!D2.live) D2.im.count = 0;
    });
  }

  // ---------------- the level ----------------
  function init(game) {
    if (!game || !game.scene) return;
    build(game.scene);
    clear();
    flash.shots = {};
  }
  function applyQuality(game) { if (game && game.scene) { dispose(); P.q = null; init(game); } }
  function stats() {
    const B = budget();
    const decals = Object.values(P.decals || {}).reduce((a, d) => a + d.live, 0);
    return { particles: live(), particleBudget: B.particles, decals, decalBudget: B.decals, shells: P.sh ? P.sh.live : 0, smoke: P.s ? P.s.live : 0 };
  }

  if (G.Bus) G.Bus.on("weapon:fire", (e) => onFire(e), "fx");

  // (a window holding the world: the flash goes, nothing else moves)
  function hideFlash() { flash.t = 0; if (flash.mesh) flash.mesh.visible = false; }

  return { init, detach, clear, applyQuality, update, impact, attachFlash, onFire, hideFlash, stats, budget, _pools: P, _flash: flash };
})();
