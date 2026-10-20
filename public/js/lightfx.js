// ===================================================================
// The light in the scene (visual series, round 2: F, G, H, I, J)
// -------------------------------------------------------------------
// F  Four tiers of light (G.VISUAL.tiers). Ambient: the hemisphere. The
//    environment's: the moon and its beams, the rooms' and corridors' tubes
//    (cool now -- G.VISUAL.lighting.roomLight), the lamp posts. Important:
//    what the player can use -- a warm edge that breathes slowly, a warm
//    glow. Hero: the goal of the moment -- the front doors at the start, the
//    stairs up once they can open, floor 3's keycard, the field's broken
//    floodlights stuttering on when the boss comes. A tier's `priority` gives
//    its lights a head start in the fixed pool of dynamic lights
//    (js/perf.js), so a hero light is never left out. Warm is rare (F2): the
//    important things, the library's reading lamps, the lamp posts, the
//    library's windows lit from inside, red emergency lights in some of the
//    dead rooms.
// G  rim light: on the buildings out of doors (faint), the important things
//    (warm, breathing), the doors (faint, cool), the boss (strong)
// H  soft shafts -- the moonbeams through the windows, the lamp posts' and
//    the hero lights' cones -- and fog sheets drifting low over the grounds,
//    drawn into the light-in-the-air picture (js/post.js, Medium and up); on
//    Low the moonbeams stay the plain meshes they were
// I  what glows has its colour pushed over 1.0 (the bloom picks it up)
// J  the lamps that never move light the walls and floors round them,
//    baked into the vertices when the level loads (every graphics level);
//    a pool of light lies on the floor under each lamp, following its flicker
// Every value is in js/visual-config.js. this.registry lists what is in
// which tier and what glows (the round's report, tools/round19-test.js).
// ===================================================================
(function () {
  const CFG = () => G.VISUAL;
  const V3 = THREE.Vector3;
  // the same hash as js/schooldress.js lightMode: a room's choice never changes
  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return ((h >>> 0) % 1000) / 1000;
  };
  function num(x) { const s = String(+x); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; }

  // ---------------------------------------------------------- shaders
  // (the pool's lights, one texel each: their intensity this frame / 4)
  const ANCHOR_GLSL = "uniform sampler2D tAnchors; uniform float uAnchorN;\nfloat vzAnchor( float i ) { return i < -0.5 ? 1.0 : texture2D( tAnchors, vec2( ( i + 0.5 ) / uAnchorN, 0.5 ) ).r * 4.0; }";
  const OUT_GLSL = [
    "uniform vec4 vzFoot[ 4 ]; uniform float vzRoof;",
    "float vzOutAt( vec3 p ) {",
    "  float inside = 0.0;",
    "  for ( int i = 0; i < 4; i ++ ) { vec4 f = vzFoot[ i ]; inside = max( inside, step( f.x, p.x ) * step( p.x, f.y ) * step( f.z, p.z ) * step( p.z, f.w ) ); }",
    "  return 1.0 - inside * step( p.y, vzRoof );",
    "}",
  ].join("\n");
  // blending into the air picture: light added (alpha kept), haze laid over
  const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthWrite: false, depthTest: false, fog: false };
  const OVER = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, transparent: true, depthWrite: false, depthTest: false, fog: false };

  // a moonbeam in the air picture: js/sky.js beamMaterial's look, softened
  // where it meets the floor and the walls
  function airBeamMaterial(orig, outdoor) {
    const u = orig.uniforms;
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uTime: u.uTime, uMoon: u.uMoon, uColor: u.uColor, uStrength: u.uStrength }, G.Post.AU),
      vertexShader: "varying vec2 vUv; varying float vZ;\nvoid main() { vUv = uv; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vZ = -mv.z; gl_Position = projectionMatrix * mv; }",
      fragmentShader: [
        G.Post.AIR_GLSL,
        "uniform float uTime; uniform float uMoon; uniform vec3 uColor; uniform float uStrength;",
        "varying vec2 vUv; varying float vZ;",
        "void main() {",
        "  float edge = smoothstep( 0.0, 0.2, vUv.x ) * smoothstep( 1.0, 0.8, vUv.x );",
        outdoor ? "  float along = smoothstep( 0.0, 0.45, vUv.y ) * smoothstep( 1.0, 0.9, vUv.y ) * smoothstep( 2.0, 9.0, vZ );"
          : "  float along = ( 1.0 - vUv.y * 0.7 ) * smoothstep( 0.0, 0.06, vUv.y );",
        "  float n = 0.82 + 0.18 * sin( vUv.x * 9.0 + vUv.y * 5.0 + uTime * 0.6 ) * sin( vUv.y * 7.0 - uTime * 0.45 );",
        "  float a = uStrength * uMoon * edge * along * n * vzSoftK( vZ );",
        "  gl_FragColor = vec4( uColor * a, 0.0 );",
        "}",
      ].join("\n"),
      side: THREE.DoubleSide,
    }, ADD));
  }
  // a cone of light under a lamp (and the keycard's column): brightest where
  // you look through most of it, fading towards its ends and its sides
  function coneMaterial(au) {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ tAnchors: au.tAnchors, uAnchorN: au.uAnchorN, uK: { value: 1 } }, G.Post.AU),
      vertexShader: [
        "attribute vec3 aCol; attribute float aIdx; attribute float aAlong;",
        "varying vec3 vCol; varying float vIdx; varying float vAlong; varying float vZ; varying vec3 vN; varying vec3 vV;",
        "void main() {",
        "  vec4 mv = modelViewMatrix * vec4( position, 1.0 );",
        "  vZ = -mv.z; vN = normalize( normalMatrix * normal ); vV = normalize( -mv.xyz );",
        "  vCol = aCol; vIdx = aIdx; vAlong = aAlong;",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        G.Post.AIR_GLSL, ANCHOR_GLSL,
        "uniform float uK;",
        "varying vec3 vCol; varying float vIdx; varying float vAlong; varying float vZ; varying vec3 vN; varying vec3 vV;",
        "void main() {",
        "  float face = pow( abs( dot( normalize( vN ), normalize( vV ) ) ), 1.6 );",
        "  float along = smoothstep( 0.0, 0.1, vAlong ) * ( 1.0 - 0.7 * vAlong );",
        "  gl_FragColor = vec4( vCol * face * along * vzAnchor( vIdx ) * uK * vzSoftK( vZ ), 0.0 );",
        "}",
      ].join("\n"),
      side: THREE.DoubleSide,
    }, ADD));
  }
  // the pools of light on the floors (the main picture, every graphics level)
  function decalMaterial(au) {
    return new THREE.ShaderMaterial({
      uniforms: { tAnchors: au.tAnchors, uAnchorN: au.uAnchorN, uFog: { value: new THREE.Vector2(20, 60) } },
      vertexShader: [
        "attribute vec3 aCol; attribute float aIdx;",
        "varying vec2 vUv; varying vec3 vCol; varying float vIdx; varying float vDist;",
        "void main() { vUv = uv; vCol = aCol; vIdx = aIdx; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vDist = -mv.z; gl_Position = projectionMatrix * mv; }",
      ].join("\n"),
      fragmentShader: [
        ANCHOR_GLSL,
        "uniform vec2 uFog;",
        "varying vec2 vUv; varying vec3 vCol; varying float vIdx; varying float vDist;",
        "void main() {",
        "  float a = smoothstep( 1.0, 0.0, length( vUv * 2.0 - 1.0 ) ); a *= a;",
        "  gl_FragColor = vec4( vCol * a * vzAnchor( vIdx ) * ( 1.0 - smoothstep( uFog.x, uFog.y, vDist ) ), 1.0 );",
        "}",
      ].join("\n"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
  }
  // a fog sheet: soft noise drifting, out of doors only, fading into what it
  // meets and towards the camera
  function sheetMaterial(noise, U) {
    const F = CFG().air.fogSheets;
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ uTime: { value: 0 }, uNoise: { value: noise }, uCol: { value: new THREE.Color(F.color) }, uOpacity: { value: F.opacity }, uDrift: { value: F.drift },
        vzFoot: U.vzFoot, vzRoof: U.vzRoof }, G.Post.AU),
      vertexShader: [
        "varying vec2 vUv; varying vec3 vW; varying float vZ;",
        "void main() {",
        "  vec4 wp = vec4( position, 1.0 );",
        "  #ifdef USE_INSTANCING",
        "  wp = instanceMatrix * wp;",
        "  #endif",
        "  wp = modelMatrix * wp;",
        "  vW = wp.xyz; vUv = uv;",
        "  vec4 mv = viewMatrix * wp; vZ = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        G.Post.AIR_GLSL, OUT_GLSL,
        "uniform float uTime; uniform sampler2D uNoise; uniform vec3 uCol; uniform float uOpacity; uniform float uDrift;",
        "varying vec2 vUv; varying vec3 vW; varying float vZ;",
        "void main() {",
        "  vec2 p = vW.xz * 0.09 + vec2( uTime, uTime * 0.6 ) * uDrift * 0.05;",
        "  float n = texture2D( uNoise, p ).r * 0.62 + texture2D( uNoise, p * 2.3 - uTime * uDrift * 0.03 ).r * 0.38;",
        "  float edge = smoothstep( 1.0, 0.5, length( vUv * 2.0 - 1.0 ) );",
        "  float a = uOpacity * smoothstep( 0.3, 0.78, n ) * edge * vzOutAt( vW ) * vzSoftK( vZ ) * smoothstep( 1.5, 5.0, vZ );",
        "  gl_FragColor = vec4( uCol * a, a );",
        "}",
      ].join("\n"),
      side: THREE.DoubleSide,
    }, OVER));
  }
  // a tiling value noise for the fog sheets
  function noiseTexture() {
    const S = 128, data = new Uint8Array(S * S * 4), R = G.makeRng(4242);
    const n = 16, g = []; for (let i = 0; i < n * n; i++) g.push(R());
    const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = x / S * n, fy = y / S * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      const k = (y * S + x) * 4; data[k] = data[k + 1] = data[k + 2] = Math.round(v * 255); data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }

  G.LightFX = {
    registry: [],

    reset() {
      this.game = null; this.world = null; this.theme = null;
      this.registry = [];
      this.extraSpill = [];      // spill-only sources (a lit window seen from outside)
      this.decalSrc = [];        // { x, y, z, sx, sz, color, light | null, k }
      this.coneSrc = [];         // { top, bottom, r0, r1, color, light | null, k }
      this.heroes = {};
      this.air = [];             // { plain, soft, show } -- swapped by graphics level
      this.sheets = null; this.decals = null; this.cones = null;
      this.t = 0; this._scan = 0;
      this.dyn = [];             // dynamic glow materials: { mat, base, tier }
    },

    note(object, tier, bloom) { this.registry.push({ object, tier, bloom: !!bloom }); },
    lit(x, y, z, color, intensity, distance, extra) {
      const l = new THREE.PointLight(color, intensity, distance);
      l.position.set(x, y, z);
      Object.assign(l.userData, { base: intensity, phase: G.rng() * 10, speed: 1.2 }, extra || {});
      this.game.scene.add(l);
      this.world.lights.push(l);
      return l;
    },
    glowMat(color, tier) {
      const m = new THREE.MeshBasicMaterial({ color });
      m.userData.vzGlow = tier;
      return m;
    },
    box(parent, w, h, d, mat, x, y, z) {
      // (a palette paint from js/schooldress.js goes through its mk: the palette's UVs and material)
      const P = G.SchoolDress && G.SchoolDress.P, geo = new THREE.BoxGeometry(w, h, d);
      const m = mat && mat.paint && P ? P.mk(geo, mat) : new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    },

    // ================================================== before the bake
    // (js/game.js prepareScene, before js/visuals.js beforeBake): what is
    // added to the level, and how it is tagged
    build(game) {
      this.reset();
      if (!G.VISUAL || !game.world || !game.scene) return;
      this.game = game; this.world = game.world; this.theme = game.level && game.level.theme;
      const W = this.world;
      W.noMerge = W.noMerge || [];
      W.lights = W.lights || [];
      if (this.theme === "school") {
        this.corridors();
        this.entrance();
        this.floodlights();
        this.library();
        this.emergency();
        this.warmWindows();
      }
      this.gates();
      this.keycard();
      this.cine();
      this.important();
      this.lampPosts();
      this.fixtureDecals();
      this.registryStatic();
    },

    // F3: darker corridors -- pools of light, then dark
    corridors() {
      const C = CFG().lighting.corridor;
      (this.world.fixtures || []).forEach((f) => {
        if (!f.light || !/^C\d/.test(f.key)) return;
        f.light.distance = C.distance;
        f.light.userData.base *= C.intensity; f.light.intensity = f.light.userData.base;
      });
    },

    // F1 hero: a lamp over the front doors, lit at the start
    entrance() {
      const W = this.world, fp = (W.footprint || [])[0];
      if (!fp) return;
      const H = CFG().hero.entrance, P = G.SchoolDress && G.SchoolDress.P, sc = this.game.scene;
      const z = fp.maxZ, y = 4.35;
      const housing = P ? P.lam(0x2a2c30) : new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
      this.box(sc, 0.7, 0.26, 0.42, housing, 0, y, z + 0.2);
      const face = this.glowMat(H.color, "hero");
      const lens = this.box(sc, 0.58, 0.05, 0.3, face, 0, y - 0.15, z + 0.24);
      W.noMerge.push(lens);
      const l = this.lit(0, y - 0.4, z + 0.9, H.color, H.intensity, H.distance, { key: "entrance", steady: true, priority: CFG().tiers.hero.priority });
      this.heroes.entrance = { light: l, face, f: 1, on: true };
      this.dyn.push({ mat: face, color: H.color, glow: H.glow, hero: "entrance" });
      this.coneSrc.push({ top: new V3(0, y - 0.18, z + 0.32), bottom: new V3(0, 0.02, z + 2.4), r0: 0.22, r1: 1.9, color: H.color, light: l, k: 1 });
      this.decalSrc.push({ x: 0, y: 0.03, z: z + 2.2, sx: 4.2, sz: 3.4, color: H.color, light: l, k: 0.5 });
      this.note("the lamp over the front doors (at the start)", "hero", true);
    },

    // F1 hero: four floodlight towers round the football field -- dead, until
    // the boss comes; then they stutter on and light the arena
    floodlights() {
      const W = this.world, p = W.pitch, P = G.SchoolDress && G.SchoolDress.P;
      if (!p || !P) return;
      const F = CFG().hero.floodlights, sc = this.game.scene, Hh = F.height;
      const cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2;
      const spots = [[p.minX - 2.6, p.minZ - 2.5], [p.minX - 2.6, p.maxZ + 2.5], [p.maxX + 6.8, p.minZ - 2.5], [p.maxX + 6.8, p.maxZ + 2.5]];
      const steel = P.lam(0x55585c), dark = P.lam(0x2e3034);
      const face = this.glowMat(F.color, "hero");
      this.heroes.flood = { lights: [], face, f: 0, on: false, t: 0 };
      const faces = [];               // (the lamps of all four heads: one mesh, one draw call)
      spots.forEach(([x, z], i) => {
        P.box(sc, 0.34, Hh, 0.34, steel, x, Hh / 2, z);
        // (the level's collision grid is built already: added through it)
        const pole = new THREE.Box3(new V3(x - 0.24, 0, z - 0.24), new V3(x + 0.24, Hh, z + 0.24));
        if (G.ColGrid && W.colGrid) G.ColGrid.add(W, pole); else W.colliders.push(pole);
        // the head, facing the middle of the pitch
        const head = new THREE.Group();
        head.position.set(x, Hh + 0.6, z);
        head.rotation.y = Math.atan2(cx - x, cz - z);
        sc.add(head);
        P.box(head, 2.8, 1.5, 0.3, dark, 0, 0, 0);
        P.box(head, 0.12, 0.9, 0.12, steel, 0, -0.95, -0.05);
        head.updateMatrixWorld(true);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
          faces.push(new THREE.BoxGeometry(0.74, 0.56, 0.06).translate((c - 1) * 0.86, (r - 0.5) * 0.66, 0.17).applyMatrix4(head.matrixWorld));
        }
        const fwd = new V3(cx - x, 0, cz - z).normalize();
        const at = new V3(x, 0, z).lerp(new V3(cx, 0, cz), 0.55);
        const top = new V3(x, Hh + 0.6, z).addScaledVector(fwd, 0.4);
        const l = this.lit(top.x, top.y - 0.5, top.z, F.color, F.intensity, F.distance, { key: "flood" + i, steady: true, priority: CFG().tiers.hero.priority });
        l.userData.base = 0;
        this.heroes.flood.lights.push(l);
        this.coneSrc.push({ top, bottom: new V3(at.x, 0.05, at.z), r0: 0.9, r1: 6.5, color: F.color, light: l, k: 0.35 });
        this.decalSrc.push({ x: at.x, y: 0.035, z: at.z, sx: 15, sz: 15, color: F.color, light: l, k: 0.22 });
      });
      const lamps = new THREE.Mesh(P.concatGeos(faces), face);
      sc.add(lamps); W.noMerge.push(lamps);
      this.dyn.push({ mat: face, color: F.color, glow: F.glow, hero: "flood" });
      this.note("the field's four floodlights (when the boss comes)", "hero", true);
    },

    // F3: warm reading lamps on the library's tables (and one on the head's desk)
    library() {
      const W = this.world, L = CFG().lighting.library, info = W.roomInfo || {};
      const sc = this.game.scene, P = G.SchoolDress && G.SchoolDress.P;
      Object.keys(info).forEach((key) => {
        const type = info[key].type;
        if (type !== "library" && type !== "principal") return;
        const reg = (W.regions || []).find((r) => r.name === key);
        if (!reg) return;
        const y0 = reg.y || 0;
        // the tables: the parts in the room whose top is at desk height and
        // that are table-sized (the reading tables are not solid: no colliders)
        sc.updateMatrixWorld(true);
        const tops = [], bb = new THREE.Box3();
        sc.traverse((o) => {
          if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          if (bb.max.y < y0 + 0.68 || bb.max.y > y0 + 0.92 || bb.max.y - bb.min.y > 0.95) return;
          if (bb.max.x - bb.min.x < 0.8 || bb.max.z - bb.min.z < 0.5 || bb.max.x - bb.min.x > 4 || bb.max.z - bb.min.z > 4) return;
          if (bb.min.x < reg.minX - 0.1 || bb.max.x > reg.maxX + 0.1 || bb.min.z < reg.minZ - 0.1 || bb.max.z > reg.maxZ + 0.1) return;
          if (tops.some((t) => t.intersectsBox(bb))) return;
          tops.push(bb.clone());
        });
        const tables = tops.sort((a, b) => (b.max.x - b.min.x) * (b.max.z - b.min.z) - (a.max.x - a.min.x) * (a.max.z - a.min.z));
        const n = type === "library" ? L.lamps : 1;
        const brass = P ? P.lam(0x8a6a2a) : new THREE.MeshLambertMaterial({ color: 0x8a6a2a });
        const shade = this.glowMat(L.color, "library");
        tables.slice(0, n).forEach((t) => {
          const x = (t.min.x + t.max.x) / 2 + 0.3, z = (t.min.z + t.max.z) / 2, ty = t.max.y;
          this.box(sc, 0.18, 0.03, 0.14, brass, x, ty + 0.015, z);
          this.box(sc, 0.03, 0.3, 0.03, brass, x, ty + 0.18, z);
          this.box(sc, 0.36, 0.1, 0.18, shade, x, ty + 0.37, z);
          const l = this.lit(x, ty + 0.55, z, L.color, L.intensity, L.distance, { priority: 2, lampKind: "library" });
          this.decalSrc.push({ x, y: ty + 0.006, z, sx: 1.6, sz: 1.3, color: L.color, light: l, k: 0.6 });
        });
        if (tables.length) this.note(type === "library" ? "the library's reading lamps" : "the head's desk lamp", "environmental (warm)", true);
      });
    },

    // F3: red emergency lights over the door in some of the dead rooms
    emergency() {
      const W = this.world, E = CFG().lighting.emergency, sc = this.game.scene, P = G.SchoolDress && G.SchoolDress.P;
      const red = this.glowMat(E.color, "emergency"), housing = P ? P.lam(0x3a3c40) : new THREE.MeshLambertMaterial({ color: 0x3a3c40 });
      let n = 0;
      (W.fixtures || []).forEach((f) => {
        if (f.mode !== "off" || /^C\d/.test(f.key) || hash(f.key + "|em") >= E.share) return;
        const reg = (W.regions || []).find((r) => r.name === f.key);
        if (!reg) return;
        const by = f.baseY || 0;
        const door = (W.roomDoors || []).find((d) => Math.abs((d.baseY || 0) - by) < 0.5
          && d.x > reg.minX - 0.8 && d.x < reg.maxX + 0.8 && d.z > reg.minZ - 0.8 && d.z < reg.maxZ + 0.8);
        if (!door) return;
        // on the room's side of the doorway, above it
        const ax = door.axis === "x";
        const side = ax ? Math.sign(f.z - door.z) || 1 : Math.sign(f.x - door.x) || 1;
        const x = ax ? door.x : door.x + side * 0.24, z = ax ? door.z + side * 0.24 : door.z, y = by + (door.h || 2.4) + 0.32;
        this.box(sc, ax ? 0.5 : 0.12, 0.16, ax ? 0.12 : 0.5, housing, x, y, z);
        [-0.13, 0.13].forEach((o) => this.box(sc, ax ? 0.12 : 0.06, 0.08, ax ? 0.06 : 0.12, red, ax ? x + o : x + side * 0.07, y - 0.05, ax ? z + side * 0.07 : z + o));
        const l = this.lit(ax ? x : x + side * 0.3, y - 0.2, ax ? z + side * 0.3 : z, E.color, E.intensity, E.distance, { speed: 0.6, lampKind: "emergency" });
        this.decalSrc.push({ x: ax ? x : x + side * 1.4, y: by + 0.015, z: ax ? z + side * 1.4 : z, sx: 2.6, sz: 2.6, color: E.color, light: l, k: 0.5 });
        n++;
      });
      if (n) this.note("red emergency lights (" + n + " dead rooms)", "environmental (warm)", true);
    },

    // F2: the library's (and the head's office's) windows lit warm from inside,
    // seen from the grounds; the light falling out onto the wall and the ground
    warmWindows() {
      const W = this.world, C = CFG().lighting.warmWindow, info = W.roomInfo || {};
      let n = 0;
      (W.innerWindows || []).forEach((win) => {
        const type = info[win.region] && info[win.region].type;
        if (type !== "library" && type !== "principal") return;
        const b = win.behind;
        if (b && b.material) {
          const m = new THREE.MeshBasicMaterial({ map: b.material.map || null, color: C.color });
          m.userData.vzGlow = "warmWindow";
          b.material = m;
        }
        const s = win.s || 1, y = (win.base || 0) + 1.95;
        this.extraSpill.push({ x: win.x + s * 0.7, y, z: win.z, color: new THREE.Color(C.color), base: C.spill, distance: 7 });
        if ((win.base || 0) < 0.5) this.decalSrc.push({ x: win.x + s * 1.8, y: 0.03, z: win.z, sx: 2.6, sz: 2.2, color: C.color, light: null, k: 0.22 });
        n++;
      });
      if (n) this.note("windows lit warm from inside (" + n + ")", "environmental (warm)", true);
    },

    // F1 hero: the stairs up -- floor 2's shutter once it rolls up, floor 3's
    // grille once the keycard is in hand
    gates() {
      const W = this.world, H = CFG().hero.gate, pri = CFG().tiers.hero.priority;
      const sf = W.secondFloor;
      if (sf && sf.barrierMesh) {
        const p = sf.barrierMesh.position;
        const l = this.lit(p.x, 2.8, p.z + 1.4, H.color, H.intensity, H.distance, { key: "gate2", steady: true, priority: pri });
        l.userData.base = 0;
        const strip = sf.strip || null;
        if (strip) { strip.material = this.glowMat(strip.material.color.getHex(), "hero"); W.noMerge.push(strip); this.dyn.push({ mat: strip.material, color: strip.material.color.getHex(), glow: H.glow, hero: "gate2", idle: CFG().tiers.important.glow }); }
        this.heroes.gate2 = { light: l, f: 0, on: false, t: 0, seen: false };
        this.decalSrc.push({ x: p.x, y: 0.03, z: p.z + 1.6, sx: 3.6, sz: 2.4, color: H.color, light: l, k: 0.45 });
        this.note("the shutter to floor 2 (once it opens)", "hero", true);
      }
      const tf = W.thirdFloor;
      if (tf && tf.barrierMesh) {
        const g = tf.barrierMesh, foot = tf.stairFoot || g.position;
        const l = this.lit(foot.x, (foot.y || 0) + 2.9, foot.z, H.color, H.intensity, H.distance, { key: "gate3", steady: true, priority: pri });
        l.userData.base = 0;
        let strip = null;
        g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.material.color.getHex() === 0xff5a36) strip = o; });
        if (strip) { strip.material = this.glowMat(0xff5a36, "hero"); this.dyn.push({ mat: strip.material, color: 0xff5a36, glow: H.glow, hero: "gate3", idle: CFG().tiers.important.glow }); }
        this.heroes.gate3 = { light: l, f: 0, on: false, t: 0 };
        this.decalSrc.push({ x: foot.x, y: (foot.y || 0) + 0.03, z: foot.z, sx: 3.2, sz: 3.2, color: H.color, light: l, k: 0.45 });
        this.note("the grille to floor 3 (with the keycard in hand)", "hero", true);
      }
    },

    // F1 hero: floor 3's keycard, while it lies there (js/floor3.js spawns it
    // during the run; its light waits off to one side until then)
    keycard() {
      if (!G.Floor3 || this.theme !== "school") return;
      const H = CFG().hero.keycard;
      const l = this.lit(0, -50, 0, H.color, H.intensity, H.distance, { key: "keycard", steady: true, priority: CFG().tiers.hero.priority });
      l.userData.base = 0;
      this.heroes.keycard = { light: l, f: 0, on: false, mesh: null };
      this.note("floor 3's keycard (while it lies there)", "hero", true);
    },

    // (visual series, round 3, N) a boss's cutscene, lit like a film: a key
    // light on it from the camera's side and a cool light behind it that
    // draws its outline (with its strong rim, G) -- two more lights in the
    // pool, off until a cutscene plays, then first in line for it
    cine() {
      const C = CFG().hero.cine, pri = CFG().tiers.hero.priority + C.priority;
      const key = this.lit(0, -50, 0, C.key.color, C.key.intensity, C.key.distance, { key: "cineKey", steady: true, priority: pri });
      const back = this.lit(0, -50, 0, C.back.color, C.back.intensity, C.back.distance, { key: "cineBack", steady: true, priority: pri });
      key.userData.base = 0; back.userData.base = 0;
      this.heroes.cine = { key, back, f: 0, on: false };
      this.note("a boss's cutscene: a key light and a back light on it", "hero", false);
    },

    // F1 important, G: what the player can use -- a warm edge that breathes;
    // the doors a faint cool one (there are many of them)
    important() {
      const W = this.world, I = CFG().tiers.important;
      this.rimI = { color: new THREE.Color(I.color).multiplyScalar(I.rimStrength), power: I.rimPower, pulse: true };
      this.rimD = { color: new THREE.Color(I.door.color).multiplyScalar(I.door.rimStrength), power: I.rimPower };
      this._clones = new Map();
      (W.interactables || []).forEach((it) => this.tagInteractable(it));
      // the hidden keys: gold, glowing
      (W.keys || []).forEach((k) => k.mesh && k.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material.userData.vzGlow = "important"; }));
      // the mystery box's glowing edges
      const mb = W.mysteryBox;
      if (mb) this.game.scene.traverse((o) => {
        const m = o.material;
        if (o.isMesh && m && !Array.isArray(m) && m.isMeshBasicMaterial && m.color.getHex() === 0x7f5bff && Math.hypot(o.position.x - mb.x, o.position.z - mb.z) < 2.5) m.userData.vzGlow = "important";
      });
      // I: a rare wall gun (rare, epic, secret) glows in its rarity's colour
      // along the foot of its plaque
      let rare = 0;
      (W.wallWeapons || []).forEach((ref) => {
        const def = G.WEAPON_DEFS && G.WEAPON_DEFS[ref.id], it = (W.interactables || []).find((i) => i.ref === ref);
        const rank = def && G.RARITY_ORDER ? G.RARITY_ORDER.indexOf(def.rarity) : -1;
        if (!it || !it.mesh || rank < 2) return;
        const p = it.mesh.position, col = (G.RARITY[def.rarity] || {}).color || 0xffd43b;
        this.box(this.game.scene, 0.13, 0.05, 2.0, this.glowMat(col, "important"), p.x, p.y - 0.78, p.z);
        rare++;
      });
      this.note("the mystery box, wall guns, crates, notes, keys, buttons, the safe, the radio, the trophy case, the coffee machine, drops", "important", true);
      if (rare) this.note("rare wall guns: a strip in their rarity's colour (" + rare + ")", "important", true);
      this.note("the doors", "important (faint, cool)", false);
    },
    tagInteractable(it) {
      if (!it || it._vz || it.kind === "trap") return;
      it._vz = true;
      const rim = it.kind === "roomdoor" ? this.rimD : this.rimI;
      if (!rim || !it.mesh) return;
      it.mesh.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const m = o.material;
        if (!(m.isMeshLambertMaterial || m.isMeshStandardMaterial) || m.userData.vzRim) return;
        const key = m.uuid + (rim === this.rimI ? "i" : "d");
        let c = this._clones.get(key);
        if (!c) { c = m.clone(); c.userData = Object.assign({}, m.userData, { vzRim: rim }); this._clones.set(key, c); }
        o.material = c;
      });
      // a note's halo and its paper glow a little
      if (it.kind === "note" && it.ref && it.ref.halo) it.ref.halo.material.color.setHex(0xffe6a0).multiplyScalar(CFG().tiers.important.glow * 0.7);
    },
    // a drop (ammo, health, money, a crate) as it lands: warm edge, its colour glowing
    drop(mesh) {
      if (!G.VISUAL || !mesh || !mesh.material || !this.rimI) return;
      const m = mesh.material;
      if (m.isMeshLambertMaterial) {
        m.emissive = (m.emissive || new THREE.Color()).copy(m.color).multiplyScalar(CFG().tiers.important.glow * 0.35);
        m.userData.vzRim = this.rimI;
        m.needsUpdate = true;
      }
    },

    // the lamp posts' cones and pools (js/campus.js marks their lights)
    lampPosts() {
      const LP = CFG().lighting.lampPost;
      (this.world.lights || []).forEach((l) => {
        if (l.userData.lampKind !== "post") return;
        l.color.setHex(LP.color); l.distance = LP.distance; l.userData.base = LP.intensity; l.intensity = LP.intensity;
        const p = l.position;
        this.coneSrc.push({ top: new V3(p.x, p.y + 0.08, p.z), bottom: new V3(p.x, 0.03, p.z), r0: 0.24, r1: CFG().air.lampCone.radius, color: LP.color, light: l, k: 1 });
        this.decalSrc.push({ x: p.x, y: 0.03, z: p.z, sx: 5.2, sz: 5.2, color: LP.color, light: l, k: 0.55 });
      });
    },
    // a pool of light on the floor under each lit tube
    fixtureDecals() {
      (this.world.fixtures || []).forEach((f) => {
        if (!f.light || f.mode === "off") return;
        const nS = Math.max(1, Math.round(f.d / 4.5));
        const spots = f.w > 8 ? [[-f.w * 0.22, -f.d * 0.18], [f.w * 0.22, f.d * 0.18]]
          : Array.from({ length: nS }, (_, i) => [0, (i - (nS - 1) / 2) * 4.2]);
        const sz = Math.min(4.6, (f.light.distance || 8) * CFG().decals.size);
        spots.forEach(([dx, dz]) => this.decalSrc.push({ x: f.x + dx, y: (f.baseY || 0) + 0.014, z: f.z + dz, sx: sz, sz: sz, color: f.light.color.getHex(), light: f.light, k: 1 }));
      });
    },
    registryStatic() {
      this.note("the hemisphere and ambient", "ambient", false);
      this.note("the moon (and its halo)", "environmental", true);
      this.note("moonbeams through the windows, shafts over the grounds", "environmental", false);
      this.note("the rooms' and corridors' ceiling tubes", "environmental", true);
      this.note("the lamp posts (lit ones)", "environmental (warm)", true);
      this.note("signs and LED strips (glow boxes)", "environmental", true);
      this.note("the zombies' eyes", "environmental", true);
      this.note("the boss's portal (cutscene)", "hero", true);
    },

    // ================================================== after the bake
    afterBake(game) {
      if (!G.VISUAL || !this.game || game !== this.game || !game.scene) return;
      const sc = game.scene, LG = CFG().lighting, T = CFG().tiers;
      // I: what glows, over 1.0 (the HDR picture; an 8-bit one clamps it, as before)
      const K = { sign: LG.glowSign, lamp: LG.lampPost.glow, tube: LG.tubeGlow, important: T.important.glow, emergency: LG.emergency.glow,
        library: LG.library.glow, warmWindow: LG.warmWindow.glow, keycard: CFG().hero.keycard.glow };
      const seen = new Set();
      sc.traverse((o) => {
        const m = o.material;
        if (!m || Array.isArray(m) || seen.has(m)) return;
        seen.add(m);
        const k = K[m.userData && m.userData.vzGlow];
        if (k && !m.userData.vzGlowBase) { m.userData.vzGlowBase = m.color.getHex(); m.color.multiplyScalar(k); }
      });
      // the failing tubes: their glow follows their light (js/perf.js)
      ((G.Perf && G.Perf.anchors) || []).forEach((a) => { if (a.glow && a.glowBase && !a._vzGlow) { a._vzGlow = true; a.glowBase.setHex(LG.tubeColor).multiplyScalar(LG.tubeGlow); } });
      if (G.Sky && G.Sky.moon) G.Sky.moon.material.color.setScalar(LG.moonGlow);
      // G: the buildings' faint rim, out of doors; J: the baked spill
      const RW = CFG().rim.world, rimW = { color: new THREE.Color(RW.color).multiplyScalar(RW.strength), power: RW.power, outdoor: true };
      const mats = new Set();
      (G.Visuals.swaps || []).forEach((w) => { mats.add(w.lambert); mats.add(w.standard); });
      mats.forEach((m) => { if (!m.userData.vzRim && !m.userData.vzGlow) m.userData.vzRim = rimW; m.userData.vzSpill = true; m.needsUpdate = true; });
      this.anchorTexture();
      this.bakeSpill(game);
      G.Visuals._occ = null;
      this.buildDecals();
      this.buildCones();
      this.buildSheets();
      this.airBeams();
      this.applyQuality(game, G.save.settings.graphicsQuality);
      // what is not in the level yet but will be -- a drop's warm edge, a
      // boss's material -- goes into the load's compile (js/visuals.js _pre)
      const pre = G.Visuals._pre;
      if (pre && this.rimI) {
        const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        box.setAttribute("color", new THREE.Float32BufferAttribute(new Array(box.attributes.position.count * 3).fill(1), 3));
        const dm = new THREE.MeshLambertMaterial({ color: 0x3388ff, emissive: 0x112244 });
        dm.userData.vzRim = this.rimI;
        pre.add(new THREE.Mesh(box, dm));
        pre.add(new THREE.Mesh(box, G.Visuals.bossMaterial()));
      }
    },

    // one texel per pool anchor: its intensity this frame (decals, cones)
    anchorTexture() {
      const A = (G.Perf && G.Perf.anchors) || [];
      const n = Math.max(1, A.length);
      this._anchorData = new Uint8Array(n * 4);
      const t = new THREE.DataTexture(this._anchorData, n, 1, THREE.RGBAFormat);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
      this.au = { tAnchors: { value: t }, uAnchorN: { value: n } };
      this._anchorIdx = new Map();
      A.forEach((a, i) => { if (a.src) this._anchorIdx.set(a.src, i); });
    },
    idxOf(light) { return light && this._anchorIdx && this._anchorIdx.has(light) ? this._anchorIdx.get(light) : -1; },

    // J: the light the lamps that never move spill round them, into the
    // vertices of the baked level -- blocked by walls and floors (a 0.5 m grid
    // of what is solid, from the AO's boxes)
    bakeSpill(game) {
      const S = CFG().spill, t0 = performance.now();
      const src = [];
      ((G.Perf && G.Perf.anchors) || []).forEach((a) => {
        if (a.key || !(a.base > 0)) return;
        const k = a.base * S.strength * (a.mode === "flicker" ? S.flicker : 1);
        src.push({ x: a.pos.x, y: a.pos.y, z: a.pos.z, r: a.color.r * k, g: a.color.g * k, b: a.color.b * k, d: (a.distance || 10) * S.range });
      });
      this.extraSpill.forEach((e) => { const k = e.base * S.strength; src.push({ x: e.x, y: e.y, z: e.z, r: e.color.r * k, g: e.color.g * k, b: e.color.b * k, d: e.distance * S.range }); });
      this.spillStats = { sources: src.length, meshes: 0, verts: 0, lit: 0, ms: 0 };
      if (!src.length) return;
      const vox = this.voxels(G.Visuals._occ);
      const box = new THREE.Box3(), sph = new THREE.Sphere();
      game.scene.traverse((o) => {
        if (!o.isMesh || !o.userData.mergedParts) return;
        const g = o.geometry;
        if (!g.attributes.position || !g.attributes.normal) return;
        if (!g.boundingBox) g.computeBoundingBox();
        box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
        const list = src.filter((s) => { sph.center.set(s.x, s.y, s.z); sph.radius = s.d; return box.intersectsSphere(sph); });
        if (!list.length) return;
        const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3;
        const acc = new Float32Array(n * 3);
        let any = false;
        for (let v = 0; v < n; v++) {
          const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
          for (let j = 0; j < list.length; j++) {
            const s = list[j];
            let dx = s.x - px, dy = s.y - py, dz = s.z - pz;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d >= s.d || d < 1e-4) continue;
            dx /= d; dy /= d; dz /= d;
            const ndl = dx * nx + dy * ny + dz * nz;
            if (ndl < -0.1) continue;
            if (vox && this.blocked(vox, px + nx * 0.3, py + ny * 0.3, pz + nz * 0.3, s.x, s.y, s.z)) continue;
            const att = (1 - d / s.d) * (1 - d / s.d) * (0.18 + 0.82 * Math.max(0, ndl));
            acc[v * 3] += s.r * att; acc[v * 3 + 1] += s.g * att; acc[v * 3 + 2] += s.b * att;
            any = true;
          }
        }
        this.spillStats.meshes++; this.spillStats.verts += n;
        if (!any) return;
        const out = new Uint8Array(n * 3), M = S.max;
        for (let i = 0; i < n * 3; i++) { const q = Math.round(Math.min(1, acc[i] / M) * 255); out[i] = q; if (q) this.spillStats.lit++; }
        g.setAttribute("vzSpill", new THREE.BufferAttribute(out, 3, true));
      });
      this.spillStats.ms = Math.round(performance.now() - t0);
    },
    voxels(occ) {
      if (!occ || !occ.flat || !occ.n) return null;
      const F = occ.flat, n = occ.n, C = 0.5;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const k = i * 6;
        x0 = Math.min(x0, F[k]); y0 = Math.min(y0, F[k + 1]); z0 = Math.min(z0, F[k + 2]);
        x1 = Math.max(x1, F[k + 3]); y1 = Math.max(y1, F[k + 4]); z1 = Math.max(z1, F[k + 5]);
      }
      y0 = Math.max(y0, -2);
      const NX = Math.ceil((x1 - x0) / C) + 1, NY = Math.ceil((y1 - y0) / C) + 1, NZ = Math.ceil((z1 - z0) / C) + 1;
      if (NX * NY * NZ > 16e6) return null;
      const g = new Uint8Array(NX * NY * NZ), e = 0.03;
      for (let i = 0; i < n; i++) {
        const k = i * 6;
        // (the boxes of thin clutter don't stop light much: only the solid ones)
        if (Math.min(F[k + 3] - F[k], F[k + 4] - F[k + 1], F[k + 5] - F[k + 2]) < 0.06) continue;
        const ax = Math.max(0, Math.floor((F[k] + e - x0) / C)), bx = Math.min(NX - 1, Math.floor((F[k + 3] - e - x0) / C));
        const ay = Math.max(0, Math.floor((F[k + 1] + e - y0) / C)), by = Math.min(NY - 1, Math.floor((F[k + 4] - e - y0) / C));
        const az = Math.max(0, Math.floor((F[k + 2] + e - z0) / C)), bz = Math.min(NZ - 1, Math.floor((F[k + 5] - e - z0) / C));
        for (let z = az; z <= bz; z++) for (let y = ay; y <= by; y++) { const row = (z * NY + y) * NX; for (let x = ax; x <= bx; x++) g[row + x] = 1; }
      }
      return { g, x0, y0, z0, NX, NY, NZ, C };
    },
    blocked(V, ax, ay, az, bx, by, bz) {
      const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz) - 0.4;
      if (len <= 0) return false;
      const st = V.C * 0.5, n = Math.ceil(len / st), ix = dx / (len + 0.4) * st, iy = dy / (len + 0.4) * st, iz = dz / (len + 0.4) * st;
      let x = ax, y = ay, z = az;
      for (let i = 0; i < n; i++) {
        const cx = Math.floor((x - V.x0) / V.C), cy = Math.floor((y - V.y0) / V.C), cz = Math.floor((z - V.z0) / V.C);
        if (cx >= 0 && cy >= 0 && cz >= 0 && cx < V.NX && cy < V.NY && cz < V.NZ && V.g[(cz * V.NY + cy) * V.NX + cx]) return true;
        x += ix; y += iy; z += iz;
      }
      return false;
    },

    // J: the pools of light, one mesh for the lot
    buildDecals() {
      const list = this.decalSrc;
      if (!list.length || !this.au) return;
      const D = CFG().decals, pos = [], uv = [], col = [], idx = [], ind = [];
      list.forEach((s) => {
        const c = new THREE.Color(s.color).multiplyScalar(D.strength * s.k);
        const id = this.idxOf(s.light);
        const b = pos.length / 3;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => {
          pos.push(s.x + u * s.sx / 2, s.y, s.z + v * s.sz / 2); uv.push((u + 1) / 2, (v + 1) / 2);
          col.push(c.r, c.g, c.b); idx.push(id);
        });
        ind.push(b, b + 2, b + 1, b, b + 3, b + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("aCol", new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute("aIdx", new THREE.Float32BufferAttribute(idx, 1));
      g.setIndex(ind);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, decalMaterial(this.au));
      m.frustumCulled = false; m.renderOrder = 4;
      this.game.scene.add(m);
      this.decals = m;
    },
    // H: the cones under the lamps and from the hero lights, one mesh
    buildCones() {
      const list = this.coneSrc;
      if (!list.length || !this.au) return;
      const A = CFG().air.lampCone, pos = [], nor = [], col = [], idx = [], along = [], ind = [];
      const SEG = 14;
      list.forEach((s) => {
        const axis = s.bottom.clone().sub(s.top), len = axis.length();
        axis.normalize();
        const t1 = Math.abs(axis.y) < 0.9 ? new V3(0, 1, 0).cross(axis).normalize() : new V3(1, 0, 0).cross(axis).normalize();
        const t2 = axis.clone().cross(t1).normalize();
        const c = new THREE.Color(s.color).multiplyScalar(A.strength * s.k);
        const id = this.idxOf(s.light);
        const b = pos.length / 3;
        for (let ring = 0; ring < 2; ring++) {
          const r = ring ? s.r1 : s.r0, at = ring ? s.bottom : s.top;
          for (let i = 0; i <= SEG; i++) {
            const a = i / SEG * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            const p = at.clone().addScaledVector(t1, ca * r).addScaledVector(t2, sa * r);
            pos.push(p.x, p.y, p.z);
            const nn = t1.clone().multiplyScalar(ca).addScaledVector(t2, sa).addScaledVector(axis, -(s.r1 - s.r0) / len).normalize();
            nor.push(nn.x, nn.y, nn.z);
            col.push(c.r, c.g, c.b); idx.push(id); along.push(ring);
          }
        }
        for (let i = 0; i < SEG; i++) { const a = b + i, bb = b + SEG + 1 + i; ind.push(a, bb, a + 1, a + 1, bb, bb + 1); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute("aCol", new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute("aIdx", new THREE.Float32BufferAttribute(idx, 1));
      g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
      g.setIndex(ind);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, coneMaterial(this.au));
      m.frustumCulled = false;
      m.layers.set(G.Post.AIR_LAYER);
      this.game.scene.add(m);
      this.cones = m;
      this.air.push({ plain: null, soft: m, show: () => true });
    },
    // H: fog sheets low over the grounds (the school; Medium and up), moved
    // round the player as they go
    buildSheets() {
      if (this.theme !== "school") return;
      const F = CFG().air.fogSheets, max = Math.max.apply(null, Object.keys(CFG().quality).map((q) => CFG().quality[q].fogSheets || 0));
      if (!max) return;
      const geo = new THREE.PlaneGeometry(F.size, F.size); geo.rotateX(-Math.PI / 2);
      const m = new THREE.InstancedMesh(geo, sheetMaterial(this._noise || (this._noise = noiseTexture()), G.Visuals.U), max);
      m.frustumCulled = false;
      m.layers.set(G.Post.AIR_LAYER);
      m.count = 0;
      this.game.scene.add(m);
      const R = G.makeRng(777);
      this.sheets = { mesh: m, max, items: Array.from({ length: max }, () => ({ x: (R() * 2 - 1) * F.radius, z: (R() * 2 - 1) * F.radius, y: F.heightMin + R() * (F.heightMax - F.heightMin), r: R() * 6.28, s: 0.7 + R() * 0.6 })) };
      this.air.push({ plain: null, soft: m, show: () => true });
    },
    // H: the moonbeams (js/sky.js) and the keycard's column get a soft twin
    // in the air picture; on Low the plain ones stay
    airBeams() {
      if (!G.Sky) return;
      const twin = (mesh, outdoor) => {
        if (!mesh || !mesh.material || !mesh.material.uniforms || !mesh.material.uniforms.uStrength || mesh.material.uniforms.uMap) return;
        const s = new THREE.Mesh(mesh.geometry, airBeamMaterial(mesh.material, outdoor));
        s.layers.set(G.Post.AIR_LAYER); s.frustumCulled = false; s.renderOrder = mesh.renderOrder;
        this.game.scene.add(s);
        this.air.push({ plain: mesh, soft: s, show: () => mesh.userData.vzShow !== false });
      };
      (G.Sky.beams || []).forEach((m) => twin(m, false));
      (G.Sky.shafts || []).forEach((m) => twin(m, true));
    },

    // ================================================== graphics level
    applyQuality(game, q) {
      if (!this.game || game !== this.game) return;
      const Q = G.Visuals.cfgQ(q), on = !!(Q.air && G.Visuals.wantsDepth(Q));
      this.airOn = on;
      // (js/sky.js's own rule for whether a beam shows at this level: the
      // window beams from Low up, the shafts over the grounds by their minQ)
      const sq = G.Sky && G.Sky.q != null ? G.Sky.q : 2;
      this.air.forEach((a) => {
        if (a.keycard) return;
        if (a.plain) {
          const show = a.plain.userData.minQ != null ? sq >= a.plain.userData.minQ : sq >= 1;
          a.plain.visible = show && !on;
          a.soft.visible = show && on;
        } else a.soft.visible = on;
      });
      this.applyKeycard();
      if (this.sheets) this.sheets.mesh.count = on ? Math.min(this.sheets.max, Q.fogSheets || 0) : 0;
    },

    // ================================================== each frame
    update(game, dt) {
      if (!this.game || game !== this.game || !G.VISUAL) return;
      this.t += dt;
      const T = CFG().tiers, U = G.Visuals.U;
      // G: the important things' edge, breathing
      U.vzPulse.value = 1 - T.important.pulse + T.important.pulse * (0.5 + 0.5 * Math.sin(this.t * 2.1));
      this.heroUpdate(game, dt);
      // what came into the level later -- the notes, a keycard -- is tagged too
      if ((this._scan -= dt) <= 0) { this._scan = 1; (this.world.interactables || []).forEach((it) => this.tagInteractable(it)); }
      // the pools of light and the cones follow their lamps
      const A = (G.Perf && G.Perf.anchors) || [];
      if (this._anchorData && this.au) {
        const d = this._anchorData;
        for (let i = 0; i < A.length && i * 4 < d.length; i++) d[i * 4] = Math.round(Math.min(1, Math.max(0, (A[i].intensity || 0) * (G.Perf.dimK == null ? 1 : G.Perf.dimK)) / 4) * 255);
        this.au.tAnchors.value.needsUpdate = true;
      }
      if (this.decals && game.scene.fog) this.decals.material.uniforms.uFog.value.set(game.scene.fog.near + (game.scene.fog.far - game.scene.fog.near) * 0.35, game.scene.fog.far);
      // the fog sheets round the player
      if (this.sheets && this.sheets.mesh.count) {
        const S = this.sheets, F = CFG().air.fogSheets, p = game.yawObject.position, Rr = F.radius, m4 = this._m4 || (this._m4 = new THREE.Matrix4());
        const q = this._q || (this._q = new THREE.Quaternion()), e = this._e || (this._e = new THREE.Euler()), sc = this._sc || (this._sc = new V3()), pp = this._pp || (this._pp = new V3());
        for (let i = 0; i < S.mesh.count; i++) {
          const it = S.items[i];
          // (wrapped round the player, so as one falls behind another comes in ahead)
          let x = it.x - p.x, z = it.z - p.z;
          x = ((x + Rr) % (2 * Rr) + 2 * Rr) % (2 * Rr) - Rr; z = ((z + Rr) % (2 * Rr) + 2 * Rr) % (2 * Rr) - Rr;
          it.x = p.x + x; it.z = p.z + z;
          e.set(0, it.r + this.t * 0.01, 0); q.setFromEuler(e); sc.set(it.s, 1, it.s); pp.set(it.x, it.y, it.z);
          m4.compose(pp, q, sc);
          S.mesh.setMatrixAt(i, m4);
        }
        S.mesh.instanceMatrix.needsUpdate = true;
        S.mesh.material.uniforms.uTime.value = this.t;
      }
    },

    heroUpdate(game, dt) {
      const H = this.heroes, A = (G.Perf && G.Perf.anchors) || [], HC = CFG().hero, pri = CFG().tiers.hero.priority;
      const anchorOf = (l) => { const i = this.idxOf(l); return i >= 0 ? A[i] : null; };
      const ease = (h, on, rate) => { h.f += ((on ? 1 : 0) - h.f) * Math.min(1, dt * (rate || 2)); };
      const P = game.yawObject.position, feet = P.y - 1.7;
      // the front doors: lit from the start until the player first goes in (or a while has passed)
      if (H.entrance) {
        const h = H.entrance;
        if (G.Sky && G.Sky.indoors) h.wasIn = true;
        h.on = !h.wasIn && this.t < HC.entrance.seconds;
        ease(h, h.on, 1.2);
        const a = anchorOf(h.light);
        // (afterwards it stays, dimmer, as an ordinary lamp over the doors)
        if (a) { a.base = HC.entrance.intensity * (0.3 + 0.7 * h.f); a.priority = h.f > 0.5 ? pri : 0; }
      }
      // floor 2: the shutter, once it has rolled up -- until the player is upstairs
      const sf = this.world.secondFloor;
      if (H.gate2 && sf) {
        const h = H.gate2;
        if (sf.unlocked && !h.seen) { h.seen = true; h.t = 0; }
        if (h.seen) h.t += dt;
        h.on = h.seen && h.t < HC.gate.seconds && feet < (sf.floorY || 4.2) - 0.6;
        ease(h, h.on, 2);
        const a = anchorOf(h.light);
        if (a) a.base = HC.gate.intensity * h.f;
      }
      // floor 3: the grille, with the keycard in hand, and a while after it opens
      const tf = this.world.thirdFloor;
      if (H.gate3 && tf) {
        const h = H.gate3, s = G.Floor3 && G.Floor3.s;
        const ready = !!(s && s.taken && !tf.unlocked);
        if (tf.unlocked && !h.opened) { h.opened = true; h.t = 0; }
        if (h.opened) h.t += dt;
        h.on = ready || (h.opened && h.t < 40 && feet < (tf.floorY || 8.4) - 0.6);
        ease(h, h.on, 2);
        const a = anchorOf(h.light);
        if (a) a.base = HC.gate.intensity * h.f;
      }
      // the keycard, while it lies there
      if (H.keycard) {
        const h = H.keycard, F3 = G.Floor3, m = F3 && F3.mesh;
        h.on = !!(m && F3.s && F3.s.spawned && !F3.s.taken && m.visible && m.parent);
        ease(h, h.on, 3);
        const a = anchorOf(h.light);
        if (a) { if (m) a.pos.set(m.position.x, m.position.y + 1.3, m.position.z); a.base = HC.keycard.intensity * h.f; }
        if (m && h.mesh !== m) { h.mesh = m; this.keycardLook(m); }
      }
      // the field's floodlights: dead, until the boss comes onto the field --
      // then they stutter on (a few seconds), and go out once it is over
      if (H.flood) {
        const h = H.flood, B = G.Bosses, ar = B && B.arena;
        const want = !!(B && (B.phase === "cutscene" || B.phase === "fight") && ar && ar.kind === "field");
        if (want && !h.on) h.t = 0;
        h.on = want;
        h.t += dt;
        const warm = HC.floodlights.warmUp;
        let most = 0;
        h.lights.forEach((l, i) => {
          const a = anchorOf(l);
          let k = 0;
          if (h.on) {
            if (h.t < warm) {
              // the stutter: each tower its own way, catching more often as it warms
              const s = Math.sin(this.t * (17 + i * 5) + i * 1.7) + Math.sin(this.t * (31 + i * 3)) * 0.7;
              k = s > 1.1 - (h.t / warm) * 2.2 ? 1 : 0.05;
            } else k = 1;
          } else k = Math.max(0, (a ? a.base / HC.floodlights.intensity : 0) - dt * 1.5);
          if (a) a.base = HC.floodlights.intensity * k;
          most = Math.max(most, k);
        });
        h.f = most;
      }
      // (round 3, N) a boss's cutscene: the key light between the camera and
      // the boss, the back light behind it, both following the camera round
      if (H.cine) {
        const h = H.cine, CS = G.Cutscene, c = CS && CS.active ? CS.ctx : null, CC = HC.cine;
        h.on = !!(c && c.b && CS.camera);
        ease(h, h.on, 3);
        const k = anchorOf(h.key), bk = anchorOf(h.back);
        if (h.on) {
          const b = c.b.pos, cam = CS.camera.position, dx = cam.x - b.x, dz = cam.z - b.z, d = Math.hypot(dx, dz) || 1;
          const tall = (c.b.rig && c.b.rig.H) || 3, fy = c.F != null ? c.F : b.y;
          if (k) k.pos.set(b.x + dx / d * CC.keyDist, fy + tall * 0.75, b.z + dz / d * CC.keyDist);
          if (bk) bk.pos.set(b.x - dx / d * CC.backDist, fy + tall * 1.05, b.z - dz / d * CC.backDist);
        }
        if (k) k.base = CC.key.intensity * h.f;
        if (bk) bk.base = CC.back.intensity * h.f;
      }
      // the hero lamps' own glow, with their light
      this.dyn.forEach((d) => {
        const h = d.hero && H[d.hero];
        const f = h ? (d.hero === "entrance" ? 0.3 + 0.7 * h.f : h.f) : 1;
        const idle = d.idle || 0.05;
        const pulse = h && h.on && d.hero !== "flood" ? 1 - CFG().tiers.hero.pulse * (0.5 + 0.5 * Math.sin(this.t * 3)) : 1;
        d.mat.color.setHex(d.color).multiplyScalar(Math.max(idle, d.glow * f * pulse));
      });
    },
    // the keycard (js/floor3.js): its stripe and chip glow, and its column of
    // light goes into the air picture
    keycardLook(g) {
      const k = CFG().hero.keycard.glow;
      g.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
        const m = o.material;
        if (m.isMeshBasicMaterial && !m.transparent && !m.userData.vzGlowBase) { m.userData.vzGlowBase = m.color.getHex(); m.color.multiplyScalar(k); }
      });
      const beam = G.Floor3.beam;
      if (beam && !beam.userData.vzTwin && this.au) {
        beam.userData.vzTwin = true;
        const geo = beam.geometry.clone();
        const n = geo.attributes.position.count, pos = geo.attributes.position.array;
        const col = new Float32Array(n * 3), idx = new Float32Array(n).fill(-1), along = new Float32Array(n);
        const c = new THREE.Color(0x7ac8ff).multiplyScalar(0.5);
        // (lit from the card at its foot: `along` 0 there, 1 at its top)
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; along[i] = Math.min(1, Math.max(0, pos[i * 3 + 1] / 3.2)); }
        geo.setAttribute("aCol", new THREE.BufferAttribute(col, 3)); geo.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1)); geo.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
        const s = new THREE.Mesh(geo, coneMaterial(this.au));
        s.layers.set(G.Post.AIR_LAYER); s.frustumCulled = false;
        beam.add(s);
        this.air.push({ plain: beam, soft: s, show: () => true, keycard: true });
        this.applyKeycard();
      }
    },
    applyKeycard() {
      this.air.forEach((a) => { if (a.keycard) { a.plain.material.visible = !this.airOn; a.soft.visible = !!this.airOn; } });
    },
  };
})();
