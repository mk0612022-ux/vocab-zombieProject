// ===================================================================
// The night sky, the moon and its light (new list, round 1, E)
// -------------------------------------------------------------------
//   sky       a dome that follows the camera: deep navy overhead, violet
//             lower down, the fog's colour at the horizon, stars that
//             twinkle and a soft glow round the moon -- one draw call, drawn
//             last among the opaque things so only the sky you can see is
//             shaded
//   moon      a large moon (a sprite) with a halo; clouds drift across it
//             now and then, and while one covers it every part of the
//             moonlight dims slowly and comes back
//   light     the moonlight is the main light from above: silver-blue, soft
//             shadows (High and Very High) of the building, the trees, the
//             salas and the zombies over the grounds
//   beams     moonbeams slanting in through every window that faces the
//             moon, dust drifting in them and the window's shape lying pale
//             on the floor; outdoors, long faint shafts coming down through
//             the fog. All of them plain transparent meshes (no post
//             processing), one mesh per storey
//   water     the puddles and the fountain reflect this sky and the moon
// The school has all of it. The hospital has no grounds, only the beams
// through its windows; the bunker, underground, only the moonlight falling
// through the open hatch to the surface above its entry hall stairs.
// ===================================================================
G.Sky = {
  // towards the moon: high in the west-south-west, so it looks in through
  // the west rooms' windows and the entry hall's front windows
  MOON_DIR: new THREE.Vector3(-0.62, 0.6, 0.5).normalize(),
  Q: { vlow: 0, low: 1, medium: 2, high: 3, vhigh: 4 },
  DUST: [0, 0, 260, 520, 800],
  CLOUDS: [4, 7, 9, 9, 9],
  LIGHT: 1.05,
  COLOR: 0xbfd0ff,

  reset() {
    this.game = null; this.scene = null; this.world = null;
    this.dome = null; this.moon = null; this.halo = null; this.clouds = [];
    this.light = null; this.beams = []; this.dust = []; this.shafts = []; this.hatch = null;
    this.cover = 0;
  },

  build(game) {
    this.reset();
    const world = game.world, theme = game.level.theme;
    this.game = game; this.scene = game.scene; this.world = world; this.theme = theme;
    world.noMerge = world.noMerge || [];
    this.R = G.makeRng(20261001);
    this.uniforms = {
      uTime: { value: 0 }, uMoon: { value: 1 },
      uMoonDir: { value: this.MOON_DIR.clone() },
      uColor: { value: new THREE.Color(this.COLOR) },
    };
    const q = G.save.settings.graphicsQuality;
    if (game.renderer) game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (theme === "school") {
      this.buildSky(G.THEME_PALETTES.school.fog);
      this.buildMoonLight();
      this.buildFogShafts();
      this.reflectInWater();
    }
    if (theme === "school" || theme === "hospital") this.buildWindowBeams(this.windows());
    if (theme === "bunker") this.buildHatch();
    this.applyQuality(q);
  },

  // after the level is baked (js/game.js prepareScene): what casts moon shadows
  afterPrepare(game) {
    if (!this.light) return;
    game.scene.children.forEach((o) => {
      const cls = o.userData && o.userData.zone ? o.userData.zone[0] : "";
      if (o.isMesh && !o.isInstancedMesh && (cls === "O" || cls === "S")) o.castShadow = true;
      // the grass takes the shadows; the trees and bushes cast them
      if (o.isInstancedMesh) {
        o.receiveShadow = true;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        if (bb && bb.max.y - bb.min.y > 1.2) o.castShadow = true;
      }
    });
  },

  applyQuality(qName) {
    const q = this.Q[qName] != null ? this.Q[qName] : 2;
    this.q = q;
    if (this.light) {
      const on = q >= 3;
      const size = q >= 4 ? 2048 : 1024;
      if (this.light.castShadow !== on || this.light.shadow.mapSize.x !== size) {
        this.light.castShadow = on;
        if (this.light.shadow.map) { this.light.shadow.map.dispose(); this.light.shadow.map = null; }
        this.light.shadow.mapSize.set(size, size);
      }
    }
    this.beams.forEach((m) => { m.visible = q >= 1; });
    this.dust.forEach((p) => { p.visible = q >= 2; if (p.geometry.drawRange) p.geometry.setDrawRange(0, Math.round(p.userData.n * Math.min(1, this.DUST[q] / this.DUST[4]))); });
    this.shafts.forEach((m) => { m.visible = q >= m.userData.minQ; });
    this.clouds.forEach((c, i) => { c.sprite.visible = i < this.CLOUDS[q]; });
    if (this.hatch) this.hatch.beam.visible = q >= 1;
  },

  // ---------------------------------------------------------------- sky ----
  skyMaterial(horizon, side) {
    const u = this.uniforms;
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: u.uTime, uMoon: u.uMoon, uMoonDir: u.uMoonDir,
        uTop: { value: new THREE.Color(0x04071a) }, uMid: { value: new THREE.Color(0x19163f) },
        uHorizon: { value: new THREE.Color(horizon) },
      },
      vertexShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vec4 wp = modelMatrix * vec4( position, 1.0 );",
        "  vDir = wp.xyz - cameraPosition;",
        "  gl_Position = projectionMatrix * viewMatrix * wp;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime; uniform float uMoon; uniform vec3 uMoonDir;",
        "uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon;",
        "varying vec3 vDir;",
        "float hash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }",
        "void main() {",
        "  vec3 d = normalize( vDir );",
        "  float h = d.y;",
        "  vec3 col = mix( uHorizon, uMid, smoothstep( -0.02, 0.28, h ) );",
        "  col = mix( col, uTop, smoothstep( 0.28, 0.95, h ) );",
        // stars: a random few of a fine grid of cells round the sphere, each
        // twinkling at its own speed, none near the horizon or the moon
        "  vec3 p = d * 230.0; vec3 cell = floor( p ); vec3 f = fract( p ) - 0.5;",
        "  float r = hash( cell );",
        "  float md = max( dot( d, uMoonDir ), 0.0 );",
        "  float star = 0.0;",
        "  if ( r > 0.9915 ) {",
        "    float tw = 0.55 + 0.45 * sin( uTime * ( 1.3 + r * 37.0 ) + r * 311.0 );",
        "    star = smoothstep( 0.42, 0.0, length( f ) ) * tw * ( r - 0.9915 ) * 118.0;",
        "    star *= smoothstep( 0.04, 0.3, h ) * ( 1.0 - smoothstep( 0.95, 0.992, md ) );",
        "  }",
        "  float glow = pow( md, 900.0 ) * 0.8 + pow( md, 70.0 ) * 0.32 + pow( md, 9.0 ) * 0.09;",
        "  col += vec3( 0.72, 0.8, 1.0 ) * glow * ( 0.3 + 0.7 * uMoon );",
        "  col += vec3( 0.86, 0.9, 1.0 ) * star * ( 0.45 + 0.55 * uMoon );",
        "  gl_FragColor = vec4( col, 1.0 );",
        "}",
      ].join("\n"),
      side: side || THREE.BackSide, depthWrite: false, fog: false,
    });
  },

  buildSky(horizon) {
    const scene = this.scene;
    // the dome: drawn after everything opaque, so the depth test throws away
    // every pixel a wall or the ground already covers
    const dome = new THREE.Mesh(new THREE.SphereGeometry(185, 32, 16), this.skyMaterial(horizon));
    dome.renderOrder = 1000; dome.frustumCulled = false;
    dome.userData.sky = true;
    scene.add(dome); this.world.noMerge.push(dome);
    this.dome = dome;
    scene.background = new THREE.Color(horizon);
    // the moon, and a halo that also brightens the clouds passing in front
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.moonTexture(), fog: false, depthWrite: false, transparent: true }));
    moon.scale.set(25, 25, 1); moon.renderOrder = 2; moon.frustumCulled = false;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture(), color: 0x9fb4ff, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    halo.scale.set(95, 95, 1); halo.renderOrder = 4; halo.frustumCulled = false;
    scene.add(moon, halo); this.world.noMerge.push(moon, halo);
    this.moon = moon; this.halo = halo;
    // the clouds: a band of them drifting round the sky, several at the
    // moon's height, so one passes over it every two minutes or so
    const tex = this.cloudTexture();
    const moonAz = Math.atan2(this.MOON_DIR.x, this.MOON_DIR.z), moonEl = Math.asin(this.MOON_DIR.y);
    this._moonAz = moonAz; this._moonEl = moonEl;
    for (let i = 0; i < this.CLOUDS[4]; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x3a4260, fog: false, depthWrite: false, transparent: true, opacity: 0.95 }));
      const size = 70 + this.R() * 50;
      s.scale.set(size, size * 0.26, 1);
      s.renderOrder = 3; s.frustumCulled = false;
      scene.add(s); this.world.noMerge.push(s);
      const onBand = i % 2 === 0;
      this.clouds.push({
        sprite: s, size,
        az: moonAz + (i / this.CLOUDS[4]) * Math.PI * 2 + this.R() * 0.3,
        el: onBand ? moonEl + (this.R() - 0.5) * 0.05 : 0.18 + this.R() * 0.7,
        speed: 0.011 + this.R() * 0.006,
      });
    }
  },

  moonTexture() {
    const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"), R = this.R;
    const g = c.createRadialGradient(S * 0.46, S * 0.44, S * 0.05, S / 2, S / 2, S * 0.44);
    g.addColorStop(0, "#fbf8ee"); g.addColorStop(0.7, "#e6e2d6"); g.addColorStop(1, "#c9c5bb");
    c.fillStyle = g; c.beginPath(); c.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2); c.fill();
    // the seas and the craters
    c.save(); c.beginPath(); c.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2); c.clip();
    [[0.38, 0.36, 0.13], [0.58, 0.44, 0.1], [0.46, 0.6, 0.12], [0.64, 0.64, 0.07]].forEach(([x, y, r]) => {
      c.fillStyle = "rgba(150,146,140,0.35)"; c.beginPath(); c.ellipse(S * x, S * y, S * r, S * r * 0.8, x * 3, 0, Math.PI * 2); c.fill();
    });
    for (let i = 0; i < 26; i++) {
      const x = S * (0.2 + R() * 0.6), y = S * (0.2 + R() * 0.6), r = S * (0.008 + R() * 0.03);
      c.fillStyle = "rgba(140,136,130,0.45)"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(255,255,250,0.35)"; c.lineWidth = 1; c.beginPath(); c.arc(x - 1, y - 1, r, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    }
    // a little shading towards the edge
    const e = c.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.44);
    e.addColorStop(0, "rgba(0,0,20,0)"); e.addColorStop(1, "rgba(20,24,50,0.35)");
    c.fillStyle = e; c.fillRect(0, 0, S, S);
    c.restore();
    const t = new THREE.CanvasTexture(cv); return t;
  },
  glowTexture() {
    const S = 128, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"), g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.18, "rgba(255,255,255,0.35)"); g.addColorStop(0.5, "rgba(255,255,255,0.08)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(cv);
  },
  // a long, thin bank of cloud: many small soft puffs along a wavering line,
  // thinning out towards both ends
  cloudTexture() {
    const W = 512, H = 128, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"), R = G.makeRng(77);
    for (let i = 0; i < 90; i++) {
      const t = R(), x = W * (0.06 + t * 0.88);
      const ends = Math.sin(t * Math.PI);                  // thick in the middle
      const y = H * (0.5 + Math.sin(t * 7.0) * 0.08 + (R() - 0.5) * 0.22 * ends);
      const r = H * (0.06 + R() * 0.16) * (0.4 + 0.6 * ends);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${(0.1 + 0.16 * ends).toFixed(3)})`); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    return new THREE.CanvasTexture(cv);
  },

  // ------------------------------------------------------------ light ----
  buildMoonLight() {
    const L = new THREE.DirectionalLight(this.COLOR, this.LIGHT);
    L.shadow.camera.left = -34; L.shadow.camera.right = 34; L.shadow.camera.top = 34; L.shadow.camera.bottom = -34;
    L.shadow.camera.near = 1; L.shadow.camera.far = 170;
    L.shadow.bias = -0.0006; L.shadow.normalBias = 0.03;
    L.shadow.mapSize.set(1024, 1024);
    this.scene.add(L); this.scene.add(L.target);
    this.light = L;
    // light space, for keeping the shadow map still under a moving player
    const z = this.MOON_DIR.clone(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    this._ax = { x, y, z };
    this.placeShadow(new THREE.Vector3(0, 0, 30), true);
  },
  // the shadow map covers the grounds round the player, snapped to whole
  // texels (no shimmer as you walk); indoors it is parked far away, so the
  // building never shades its own rooms and nothing much is drawn into it
  placeShadow(p, force) {
    const L = this.light, A = this._ax, texel = 68 / L.shadow.mapSize.x;
    const c = p.clone();
    const cx = Math.round(c.dot(A.x) / texel) * texel, cy = Math.round(c.dot(A.y) / texel) * texel, cz = c.dot(A.z);
    const snapped = A.x.clone().multiplyScalar(cx).addScaledVector(A.y, cy).addScaledVector(A.z, cz);
    if (!force && this._shadowAt && this._shadowAt.distanceToSquared(snapped) < 1e-6) return;
    this._shadowAt = snapped;
    L.target.position.copy(snapped);
    L.position.copy(snapped).addScaledVector(this.MOON_DIR, 90);
    L.target.updateMatrixWorld();
  },

  // ------------------------------------------------------------ beams ----
  // every window that could let the moon in: the school's (js/schoolshell.js),
  // the broken ones zombies climb through (js/zombiefx.js), and the entry
  // hall's tall front windows
  windows() {
    const W = this.world, out = [];
    (W.innerWindows || []).forEach((w) => out.push({ x: w.x, z: w.z, base: w.base, nx: -w.s, nz: 0, w: 1.45, y0: 1.3, y1: 2.6 }));
    (W.skyWindows || []).forEach((w) => out.push(w));
    if (this.theme === "school") {
      const fp = (W.footprint || [])[0];
      if (fp) [-13.6, -10.2, -6.8, 6.8, 10.2, 13.6].forEach((x) => out.push({ x, z: fp.maxZ - 0.25, base: 0, nx: 0, nz: -1, w: 1.4, y0: 1.8, y1: 4.4 }));
    }
    return out;
  },
  beamMaterial(strength, outdoor) {
    const u = this.uniforms;
    return new THREE.ShaderMaterial({
      uniforms: { uTime: u.uTime, uMoon: u.uMoon, uColor: u.uColor, uStrength: { value: strength } },
      vertexShader: [
        "varying vec2 vUv; varying vec3 vW;",
        "void main() { vUv = uv; vec4 wp = modelMatrix * vec4( position, 1.0 ); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }",
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime; uniform float uMoon; uniform vec3 uColor; uniform float uStrength;",
        "varying vec2 vUv; varying vec3 vW;",
        "void main() {",
        "  float edge = smoothstep( 0.0, 0.2, vUv.x ) * smoothstep( 1.0, 0.8, vUv.x );",
        outdoor
          ? "  float along = smoothstep( 0.0, 0.45, vUv.y ) * smoothstep( 1.0, 0.9, vUv.y ) * smoothstep( 2.0, 9.0, distance( cameraPosition, vW ) );"
          : "  float along = ( 1.0 - vUv.y * 0.7 ) * smoothstep( 0.0, 0.06, vUv.y );",
        // the haze in it moves a little, as the dust does
        "  float n = 0.82 + 0.18 * sin( vW.x * 2.1 + vW.y * 1.7 + uTime * 0.6 ) * sin( vW.z * 1.9 - uTime * 0.45 );",
        "  gl_FragColor = vec4( uColor, uStrength * uMoon * edge * along * n );",
        "}",
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
  },
  patchMaterial() {
    // the window's shape on the floor: four panes, the frame and the cross
    const S = 64, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d");
    c.fillStyle = "#000"; c.fillRect(0, 0, S, S);
    c.fillStyle = "#fff";
    [[5, 5], [34, 5], [5, 34], [34, 34]].forEach(([x, y]) => c.fillRect(x, y, 25, 25));
    const tex = new THREE.CanvasTexture(cv);
    const u = this.uniforms;
    return new THREE.ShaderMaterial({
      uniforms: { uMoon: u.uMoon, uColor: u.uColor, uMap: { value: tex } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }",
      fragmentShader: "uniform float uMoon; uniform vec3 uColor; uniform sampler2D uMap; varying vec2 vUv;\n" +
        "void main() { float m = texture2D( uMap, vUv ).r; float soft = smoothstep( 0.0, 0.12, vUv.y ) * smoothstep( 1.0, 0.88, vUv.y ); gl_FragColor = vec4( uColor, 0.6 * m * soft * uMoon ); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  },
  // A beam: the window's rectangle swept along the moonlight down to the
  // floor -- its four sides (u across, v from the window to the floor) --
  // and the lit patch where it lands.
  buildWindowBeams(list) {
    const Ld = this.MOON_DIR.clone().negate();
    const byBase = {};
    list.forEach((w) => {
      const n = new THREE.Vector3(w.nx, 0, w.nz).normalize();
      if (n.dot(Ld) < 0.2) return;                         // faces away from the moon
      const t = new THREE.Vector3(n.z, 0, -n.x);           // along the wall
      const c = new THREE.Vector3(w.x + n.x * 0.05, 0, w.z + n.z * 0.05);
      const corner = (a, y) => c.clone().addScaledVector(t, a * w.w / 2).setY(w.base + y);
      const land = (p) => p.clone().addScaledVector(Ld, (p.y - w.base - 0.02) / -Ld.y);
      const Wc = [corner(-1, w.y0), corner(1, w.y0), corner(1, w.y1), corner(-1, w.y1)];
      const Fc = Wc.map(land);
      const b = (byBase[w.base] = byBase[w.base] || { pos: [], uv: [], ppos: [], puv: [], vols: [] });
      // the four sides
      [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([i, j]) => {
        const q = [Wc[i], Wc[j], Fc[j], Fc[i]], quv = [[0, 0], [1, 0], [1, 1], [0, 1]];
        [0, 1, 2, 0, 2, 3].forEach((k) => { b.pos.push(q[k].x, q[k].y, q[k].z); b.uv.push(quv[k][0], quv[k][1]); });
      });
      // the patch on the floor
      const pq = [Fc[0], Fc[1], Fc[2], Fc[3]], puv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      [0, 1, 2, 0, 2, 3].forEach((k) => { b.ppos.push(pq[k].x, pq[k].y + 0.01, pq[k].z); b.puv.push(puv[k][0], puv[k][1]); });
      b.vols.push({ Wc, Ld, base: w.base });
    });
    const beamMat = this.beamMaterial(0.48, false), patchMat = this.patchMaterial();
    Object.keys(byBase).forEach((k) => {
      const b = byBase[k];
      const mk = (pos, uv, mat, order) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat); m.renderOrder = order;
        this.scene.add(m); this.world.noMerge.push(m); this.beams.push(m);
        return m;
      };
      mk(b.pos, b.uv, beamMat, 6);
      mk(b.ppos, b.puv, patchMat, 5);
      this.buildDust(b.vols);
    });
  },
  // dust hanging in the beams: points spread through their volume, drifting
  // slowly in the shader
  buildDust(vols) {
    if (!vols.length) return;
    const N = Math.min(this.DUST[4], vols.length * 60), R = this.R;
    const pos = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = vols[i % vols.length], a = R(), h = R();
      const Wb = v.Wc[0].clone().lerp(v.Wc[1], a), Wt = v.Wc[3].clone().lerp(v.Wc[2], a);
      const p = Wb.lerp(Wt, h);
      const s = (p.y - v.base) / -v.Ld.y * R();
      p.addScaledVector(v.Ld, s);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; ph[i] = R() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
    g.computeBoundingSphere();
    const u = this.uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: u.uTime, uMoon: u.uMoon, uColor: u.uColor },
      vertexShader: [
        "uniform float uTime; attribute float aPhase; varying float vA;",
        "void main() {",
        "  vec3 p = position;",
        "  p.y += sin( uTime * 0.23 + aPhase ) * 0.12;",
        "  p.x += sin( uTime * 0.17 + aPhase * 1.7 ) * 0.08;",
        "  p.z += cos( uTime * 0.19 + aPhase * 0.9 ) * 0.08;",
        "  vec4 mv = modelViewMatrix * vec4( p, 1.0 );",
        "  gl_PointSize = clamp( 16.0 / -mv.z, 1.0, 3.0 );",
        "  vA = 0.55 + 0.45 * sin( uTime * 1.3 + aPhase * 3.0 );",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: "uniform float uMoon; uniform vec3 uColor; varying float vA;\nvoid main() { vec2 c = gl_PointCoord - 0.5; float d = smoothstep( 0.5, 0.1, length( c ) ); gl_FragColor = vec4( uColor, d * vA * 0.45 * uMoon ); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const pts = new THREE.Points(g, mat);
    pts.userData.n = N; pts.renderOrder = 7;
    this.scene.add(pts); this.world.noMerge.push(pts); this.dust.push(pts);
  },

  // long faint shafts coming down through the fog over the grounds
  buildFogShafts() {
    const W = this.world, C = W.campus;
    if (!C) return;
    const spots = [];
    const lm = (k) => (W.landmarks || []).find((l) => l.key === k);
    ["FIELD", "GARDEN", "SALA_FRONT", "CARPARK", "SALA_FIELD", "BACKYARD"].forEach((k) => { const l = lm(k); if (l) spots.push([l.x, l.z]); });
    [[-24, 40], [26, 30], [-30, -52], [30, -76], [-52, 60], [8, 64]].forEach((p) => spots.push(p));
    const mat = this.beamMaterial(0.07, true), Ld = this.MOON_DIR;
    const tiers = [[0, 3, 1], [3, 6, 2], [6, 12, 3]];
    tiers.forEach(([a, b, minQ]) => {
      const pos = [], uv = [];
      spots.slice(a, b).forEach(([x, z], i) => {
        const w = 3 + (i % 3), len = 46;
        const g = new THREE.Vector3(x + (this.R() - 0.5) * 6, 0, z + (this.R() - 0.5) * 6);
        const top = g.clone().addScaledVector(Ld, len);
        const t1 = new THREE.Vector3(1, 0, 0).cross(Ld).normalize(), t2 = Ld.clone().cross(t1).normalize();
        [[t1, t2], [t2, t1]].forEach(([s]) => {
          const q = [top.clone().addScaledVector(s, -w / 2), top.clone().addScaledVector(s, w / 2), g.clone().addScaledVector(s, w / 2), g.clone().addScaledVector(s, -w / 2)];
          const quv = [[0, 0], [1, 0], [1, 1], [0, 1]];
          [0, 1, 2, 0, 2, 3].forEach((k) => { pos.push(q[k].x, q[k].y, q[k].z); uv.push(quv[k][0], quv[k][1]); });
        });
      });
      if (!pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 6; m.userData.minQ = minQ;
      this.scene.add(m); this.world.noMerge.push(m); this.shafts.push(m);
    });
  },

  // the bunker: an open hatch to the surface in the ceiling over its entry
  // hall stairs -- a square of night sky, and the moonlight falling through
  buildHatch() {
    const W = this.world, E = (W.regions || []).find((r) => r.name === "ENTRY");
    if (!E) return;
    // the hall's ceiling, found by looking straight up from a few spots on
    // its floor: the nearest one to the middle whose ceiling is the hall's
    // own (3-5 m up, so not over the stair shaft), or failing that the highest
    const meshes = [];
    this.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) meshes.push(o); });
    this.scene.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    let best = null, high = null;
    const mx = (E.minX + E.maxX) / 2, mz = (E.minZ + E.maxZ) / 2;
    [[0, 2], [-4, 2], [4, 2], [-4, -2], [4, -2], [0, -3], [-7, 0], [7, 0], [-7, 3], [7, 3]].forEach(([dx, dz]) => {
      const x = mx + dx, z = mz + dz;
      if (x < E.minX + 2 || x > E.maxX - 2 || z < E.minZ + 2 || z > E.maxZ - 2) return;
      rc.set(new THREE.Vector3(x, 1.2, z), new THREE.Vector3(0, 1, 0)); rc.far = 30;
      const hit = rc.intersectObjects(meshes, false)[0];
      if (!hit || hit.distance < 1.5) return;
      const y = hit.point.y, d = Math.hypot(dx, dz);
      if (y > 3 && y < 5 && (!best || d < best.d)) best = { x, z, y, d };
      if (!high || y > high.y) high = { x, z, y };
    });
    best = best || high;
    if (!best) return;
    const cx = best.x, cz = best.z, ceil = best.y, S = 2.6;
    const skyMat = this.skyMaterial(0x33407a, THREE.DoubleSide);
    skyMat.uniforms.uTop.value.setHex(0x1a2450); skyMat.uniforms.uMid.value.setHex(0x2c3570);   // moonlit: lighter than the dome
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(S, S), skyMat);
    sky.rotation.x = Math.PI / 2; sky.position.set(cx, ceil - 0.01, cz);
    const rim = new THREE.MeshLambertMaterial({ color: 0x3a3a34 });
    const frame = new THREE.Group();
    [[0, S / 2], [0, -S / 2]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(S + 0.4, 0.3, 0.2), rim); b.position.set(cx + x, ceil - 0.12, cz + z); frame.add(b); });
    [[S / 2, 0], [-S / 2, 0]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, S), rim); b.position.set(cx + x, ceil - 0.12, cz + z); frame.add(b); });
    for (let i = -1; i <= 1; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, S), rim); b.position.set(cx + i * 0.65, ceil - 0.06, cz); frame.add(b); }
    // (small, and must never be hidden by the zone culling)
    sky.frustumCulled = false; frame.frustumCulled = false;
    this.scene.add(sky, frame);
    this.world.noMerge.push(sky);
    // the light coming down it, and where it lands
    const Ld = this.MOON_DIR.clone().negate();
    const floorAt = (x, z) => G.getFloorHeightAt(W, x, z, ceil - 0.5);
    const Wc = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(cx + a * S / 2, ceil - 0.02, cz + b * S / 2));
    const Fc = Wc.map((p) => { const f = floorAt(p.x + Ld.x * 3, p.z + Ld.z * 3); return p.clone().addScaledVector(Ld, (p.y - f - 0.02) / -Ld.y); });
    const pos = [], uv = [];
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([i, j]) => {
      const q = [Wc[i], Wc[j], Fc[j], Fc[i]], quv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      [0, 1, 2, 0, 2, 3].forEach((k) => { pos.push(q[k].x, q[k].y, q[k].z); uv.push(quv[k][0], quv[k][1]); });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const beam = new THREE.Mesh(geo, this.beamMaterial(0.24, false));
    beam.renderOrder = 6;
    this.scene.add(beam); this.world.noMerge.push(beam); this.beams.push(beam);
    this.buildDust([{ Wc: [Wc[0], Wc[1], Wc[2], Wc[3]], Ld, base: Fc[0].y }]);
    this.hatch = { sky, beam, x: cx, z: cz, y: ceil };
  },

  // the puddles and the fountain: this sky, with its moon, in the water
  reflectInWater() {
    const size = 64, faces = [], R = G.makeRng(5);
    const top = new THREE.Color(0x04071a), mid = new THREE.Color(0x19163f), hor = new THREE.Color(G.THEME_PALETTES.school.fog);
    const md = this.MOON_DIR, col = new THREE.Color();
    // cube faces in the order three.js wants them; x mirrored, as three.js
    // flips a cube texture's x when it samples it
    const dirOf = [
      (u, v) => [1, -v, -u], (u, v) => [-1, -v, u], (u, v) => [u, 1, v],
      (u, v) => [u, -1, -v], (u, v) => [u, -v, 1], (u, v) => [-u, -v, -1],
    ];
    for (let f = 0; f < 6; f++) {
      const cv = document.createElement("canvas"); cv.width = cv.height = size;
      const c = cv.getContext("2d"), img = c.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
        const d = dirOf[f](u, v), l = Math.hypot(d[0], d[1], d[2]);
        const dx = -d[0] / l, dy = d[1] / l, dz = d[2] / l;
        if (dy < -0.02) col.setHex(0x0b0e10);
        else {
          const s = (e0, e1, t) => { const k = Math.min(1, Math.max(0, (t - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
          col.copy(hor).lerp(mid, s(-0.02, 0.28, dy)).lerp(top, s(0.28, 0.95, dy));
          const m = Math.max(0, dx * md.x + dy * md.y + dz * md.z);
          const glow = Math.pow(m, 900) * 2.5 + Math.pow(m, 70) * 0.4 + Math.pow(m, 9) * 0.1;
          col.r += 0.75 * glow; col.g += 0.82 * glow; col.b += glow;
          if (R() > 0.985 && dy > 0.1) { col.r += 0.5; col.g += 0.5; col.b += 0.55; }
        }
        const i = (y * size + x) * 4;
        img.data[i] = Math.min(255, col.r * 255); img.data[i + 1] = Math.min(255, col.g * 255); img.data[i + 2] = Math.min(255, col.b * 255); img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      faces.push(cv);
    }
    const cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    this.cube = cube;
    (G.Details && G.Details.puddles || []).forEach((m) => { m.material.envMap = cube; m.material.needsUpdate = true; });
  },

  // ------------------------------------------------------------ frame ----
  update(game, dt) {
    if (!this.uniforms || this.game !== game) return;
    this.uniforms.uTime.value += dt;
    const eye = game.yawObject.position;
    if (this.dome) {
      this.dome.position.copy(eye);
      this.moon.position.copy(eye).addScaledVector(this.MOON_DIR, 170);
      this.halo.position.copy(this.moon.position);
      // the clouds drift; how much of the moon is behind one sets the light
      let cover = 0;
      const d = new THREE.Vector3();
      this.clouds.forEach((cl) => {
        if (!cl.sprite.visible) return;
        cl.az += cl.speed * dt;
        d.set(Math.cos(cl.el) * Math.sin(cl.az), Math.sin(cl.el), Math.cos(cl.el) * Math.cos(cl.az));
        cl.sprite.position.copy(eye).addScaledVector(d, 158);
        // how far off the moon it is, across and up, against its own
        // (long, low) size
        let da = (cl.az - this._moonAz) % (Math.PI * 2);
        if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
        const across = Math.abs(da) * Math.cos(this._moonEl) / (cl.size * 0.5 / 158);
        const up = Math.abs(cl.el - this._moonEl) / (cl.size * 0.13 / 158);
        const k = Math.max(0, 1 - Math.max(across, up));
        cover = Math.max(cover, Math.min(1, k * 1.8));
        // lit silver as it nears the moon
        const near = Math.max(0, 1 - Math.max(across, up) / 2.2);
        cl.sprite.material.color.setRGB(0.2 + near * 0.5, 0.23 + near * 0.52, 0.34 + near * 0.55);
      });
      this.cover += (cover - this.cover) * Math.min(1, dt * 0.9);
    }
    const target = 1 - 0.62 * this.cover;
    const u = this.uniforms.uMoon;
    u.value += (target - u.value) * Math.min(1, dt * 1.2);
    if (this.halo) this.halo.material.opacity = 0.5 * u.value;
    if (this.moon) this.moon.material.opacity = 0.35 + 0.65 * u.value;   // dimmer behind a cloud
    if (this.light) {
      // (x G.Perf.dimK: a boss's Lights Out, js/bossmoves.js)
      this.light.intensity = this.LIGHT * (0.38 + 0.62 * u.value) * (G.Perf && G.Perf.dimK != null ? G.Perf.dimK : 1);
      if (this.light.castShadow) {
        const region = G.getRegionAt(game.world, eye.x, eye.z, eye.y - 1.7) || "";
        const outdoors = /^YARD/.test(region);
        this.placeShadow(outdoors ? new THREE.Vector3(eye.x, 0, eye.z) : new THREE.Vector3(0, -600, 0));
      }
    }
  },
};
