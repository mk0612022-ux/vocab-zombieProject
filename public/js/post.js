// ===================================================================
// After the scene is drawn (visual series, round 2: H, I, J)
// -------------------------------------------------------------------
// js/visuals.js draws the scene and the gun in hand into its HDR target --
// with a depth texture from Medium up -- and then calls G.Post.run(). What is
// made here goes into the one composite pass (js/visuals.js), where the film
// is applied once:
//   bloom     only what is brighter than G.VISUAL.bloom.threshold (the
//             emitters js/lightfx.js pushes over 1.0): copies of it blurred
//             down to a few small sizes and back up (the "dual filter")
//   air       the light in the air -- the soft shafts and the fog sheets of
//             js/lightfx.js -- drawn into a smaller picture of its own, each
//             fading out where it meets the scene behind it
//   godRays   High and up: the sky's light smeared outwards from the moon,
//             through every gap and window the depth shows
//   ssao      High and up: corners and contact shadows from the depth alone
//   raymarch  Very High: fog that takes the moon's and the lamps' light,
//             marched through at a quarter of the resolution
// Every texture is read in the composite as "x": the scene's value squared,
// a cheap step towards linear light (js/visuals.js, the composite).
// The world is drawn in depth 0.01 - 1 and the gun in hand in 0 - 0.01 (no
// depth clear between them), so one depth texture holds both.
// ===================================================================
(function () {
  const CFG = () => G.VISUAL;
  const DR = 0.01;
  const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }";

  // the scene's depth, in metres in front of the camera
  const DEPTH_GLSL = [
    "uniform sampler2D tDepth; uniform vec2 uCam; uniform float uDR;",
    "float vzViewZ( float d ) {",
    "  float z = clamp( ( d - uDR ) / ( 1.0 - uDR ), 0.0, 1.0 ) * 2.0 - 1.0;",
    "  return 2.0 * uCam.x * uCam.y / ( uCam.y + uCam.x - z * ( uCam.y - uCam.x ) );",
    "}",
  ].join("\n");
  // (for the materials drawn into the air picture -- js/lightfx.js): how much
  // of this fragment is left, by how far in front of the scene it is
  const AIR_GLSL = DEPTH_GLSL + "\n" + [
    "uniform vec2 uAirRes; uniform float uSoft;",
    "float vzSoftK( float fragZ ) {",
    "  float sceneZ = vzViewZ( texture2D( tDepth, gl_FragCoord.xy / uAirRes ).r );",
    "  if ( fragZ > sceneZ ) return 0.0;",
    "  return clamp( ( sceneZ - fragZ ) / uSoft, 0.0, 1.0 ) * smoothstep( 0.25, 1.4, fragZ );",
    "}",
  ].join("\n");
  const IGN = "float vzIgn( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }";

  // the uniforms every depth reader shares (set once a frame)
  const DU = { tDepth: { value: null }, uCam: { value: new THREE.Vector2(0.1, 200) }, uDR: { value: DR } };
  const AU = Object.assign({}, DU, { uAirRes: { value: new THREE.Vector2(1, 1) }, uSoft: { value: 0.7 } });

  const BLOOM_EXTRACT = [
    "uniform sampler2D tScene; uniform vec2 uTh;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec3 c = max( texture2D( tScene, vUv ).rgb, 0.0 );",
    "  vec3 x = c * c;",
    "  float b = max( x.r, max( x.g, x.b ) );",
    "  float k = max( uTh.x * uTh.y, 1e-4 );",
    "  float s = clamp( b - uTh.x + k, 0.0, 2.0 * k ); s = s * s / ( 4.0 * k );",
    "  gl_FragColor = vec4( x * max( s, b - uTh.x ) / max( b, 1e-4 ), 1.0 );",
    "}",
  ].join("\n");
  const BLOOM_DOWN = [
    "uniform sampler2D tSrc; uniform vec2 uTexel;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec2 h = uTexel;",
    "  vec3 s = texture2D( tSrc, vUv ).rgb * 4.0;",
    "  s += texture2D( tSrc, vUv - h ).rgb + texture2D( tSrc, vUv + h ).rgb;",
    "  s += texture2D( tSrc, vUv + vec2( h.x, -h.y ) ).rgb + texture2D( tSrc, vUv - vec2( h.x, -h.y ) ).rgb;",
    "  gl_FragColor = vec4( s * 0.125, 1.0 );",
    "}",
  ].join("\n");
  const BLOOM_UP = [
    "uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel; uniform float uRadius;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec2 h = uTexel * uRadius;",
    "  vec3 s = texture2D( tSrc, vUv + vec2( -2.0 * h.x, 0.0 ) ).rgb + texture2D( tSrc, vUv + vec2( 2.0 * h.x, 0.0 ) ).rgb;",
    "  s += texture2D( tSrc, vUv + vec2( 0.0, -2.0 * h.y ) ).rgb + texture2D( tSrc, vUv + vec2( 0.0, 2.0 * h.y ) ).rgb;",
    "  s += 2.0 * ( texture2D( tSrc, vUv + h ).rgb + texture2D( tSrc, vUv - h ).rgb + texture2D( tSrc, vUv + vec2( h.x, -h.y ) ).rgb + texture2D( tSrc, vUv - vec2( h.x, -h.y ) ).rgb );",
    "  gl_FragColor = vec4( s / 12.0 + texture2D( tAdd, vUv ).rgb, 1.0 );",
    "}",
  ].join("\n");

  const GOD_MASK = [
    "uniform sampler2D tScene; uniform vec2 uMoon; uniform float uAspect; uniform float uTh;",
    DEPTH_GLSL,
    "varying vec2 vUv;",
    "void main() {",
    "  float sky = step( 0.99999, texture2D( tDepth, vUv ).r );",
    "  vec3 c = max( texture2D( tScene, vUv ).rgb, 0.0 );",
    "  float near = 1.0 - smoothstep( 0.0, 0.5, length( ( vUv - uMoon ) * vec2( uAspect, 1.0 ) ) );",
    // (only the bright sky -- the moon and its halo -- sends rays, not the whole dome)
    "  float l = max( dot( c * c, vec3( 0.2126, 0.7152, 0.0722 ) ) - uTh, 0.0 );",
    "  gl_FragColor = vec4( vec3( l * sky * near ), 1.0 );",
    "}",
  ].join("\n");
  const GOD_BLUR = [
    "uniform sampler2D tMask; uniform vec2 uMoon; uniform vec4 uP; uniform float uFade;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec2 uv = vUv, delta = ( vUv - uMoon ) * uP.x / float( VZ_N );",
    "  float illum = 1.0; vec3 s = vec3( 0.0 );",
    "  for ( int i = 0; i < VZ_N; i++ ) { uv -= delta; s += texture2D( tMask, uv ).rgb * illum; illum *= uP.y; }",
    "  gl_FragColor = vec4( s * uP.z * uP.w * uFade, 1.0 );",
    "}",
  ].join("\n");

  const SSAO = [
    DEPTH_GLSL, IGN,
    "uniform vec2 uTan; uniform vec2 uRes; uniform vec4 uP;",
    "varying vec2 vUv;",
    "vec3 vzPos( vec2 uv ) { float z = vzViewZ( texture2D( tDepth, uv ).r ); return vec3( ( uv * 2.0 - 1.0 ) * uTan * z, -z ); }",
    "void main() {",
    "  float d = texture2D( tDepth, vUv ).r;",
    "  if ( d >= 0.99999 || d < uDR ) { gl_FragColor = vec4( 1.0 ); return; }",
    "  vec3 P = vzPos( vUv );",
    "  vec2 px = 1.0 / uRes;",
    "  vec3 ax = vzPos( vUv + vec2( px.x, 0.0 ) ) - P, bx = P - vzPos( vUv - vec2( px.x, 0.0 ) );",
    "  vec3 ay = vzPos( vUv + vec2( 0.0, px.y ) ) - P, by = P - vzPos( vUv - vec2( 0.0, px.y ) );",
    "  vec3 N = normalize( cross( abs( ax.z ) < abs( bx.z ) ? ax : bx, abs( ay.z ) < abs( by.z ) ? ay : by ) );",
    "  float rad = uP.x / -P.z * 0.5 / uTan.y;",
    "  float a0 = vzIgn( gl_FragCoord.xy ) * 6.2831853, occ = 0.0;",
    "  for ( int i = 0; i < VZ_N; i++ ) {",
    "    float t = ( float( i ) + 0.5 ) / float( VZ_N );",
    "    float a = a0 + float( i ) * 2.3999632;",
    "    vec3 S = vzPos( vUv + vec2( cos( a ), sin( a ) ) * rad * t ) - P;",
    "    float l = max( length( S ), 1e-3 );",
    "    occ += max( 0.0, dot( N, S / l ) - uP.z ) * ( 1.0 - smoothstep( uP.x * 0.6, uP.x * 1.6, l ) );",
    "  }",
    "  gl_FragColor = vec4( vec3( clamp( 1.0 - uP.y * occ / float( VZ_N ), 0.0, 1.0 ) ), 1.0 );",
    "}",
  ].join("\n");
  const SSAO_BLUR = [
    DEPTH_GLSL,
    "uniform sampler2D tAO; uniform vec2 uDir;",
    "varying vec2 vUv;",
    "void main() {",
    "  float z0 = vzViewZ( texture2D( tDepth, vUv ).r ), s = 0.0, w = 0.0;",
    "  for ( int i = -2; i <= 2; i++ ) {",
    "    vec2 uv = vUv + uDir * float( i );",
    "    float wi = ( 3.0 - abs( float( i ) ) ) / ( 1.0 + abs( vzViewZ( texture2D( tDepth, uv ).r ) - z0 ) * 4.0 );",
    "    s += texture2D( tAO, uv ).r * wi; w += wi;",
    "  }",
    "  gl_FragColor = vec4( vec3( s / w ), 1.0 );",
    "}",
  ].join("\n");

  const RAYMARCH = [
    DEPTH_GLSL, IGN,
    "#include <packing>",
    "uniform mat4 uInvProj; uniform mat4 uCamWorld;",
    "uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform vec4 uP; uniform vec3 uFogCol; uniform float uFall; uniform float uExt;",
    "uniform sampler2D tShadow; uniform mat4 uShadowM; uniform float uShadowOn;",
    "uniform vec4 vzFoot[ 4 ]; uniform float vzRoof;",
    "uniform vec3 uLP[ 8 ]; uniform vec4 uLC[ 8 ];",
    "varying vec2 vUv;",
    "float vzOut( vec3 p ) {",
    "  float inside = 0.0;",
    "  for ( int i = 0; i < 4; i ++ ) { vec4 f = vzFoot[ i ]; inside = max( inside, step( f.x, p.x ) * step( p.x, f.y ) * step( f.z, p.z ) * step( p.z, f.w ) ); }",
    "  return 1.0 - inside * step( p.y, vzRoof );",
    "}",
    "void main() {",
    "  float d = texture2D( tDepth, vUv ).r;",
    "  float z = d < uDR ? 0.3 : vzViewZ( d );",
    // (the sky: lit haze in front of it, but never dimmed -- the fog already meets it)
    "  float skyPx = step( 0.99999, d );",
    "  vec4 v = uInvProj * vec4( vUv * 2.0 - 1.0, 1.0, 1.0 );",
    "  vec3 dv = normalize( v.xyz / v.w );",
    "  float len = min( z / max( -dv.z, 1e-3 ), uP.w );",
    "  vec3 ro = ( uCamWorld * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz, rd = normalize( ( uCamWorld * vec4( dv, 0.0 ) ).xyz );",
    "  float st = len / float( VZ_N ), jit = vzIgn( gl_FragCoord.xy );",
    "  float phase = 0.55 + 0.9 * pow( max( dot( rd, uMoonDir ), 0.0 ), 6.0 );",
    "  vec3 acc = vec3( 0.0 ); float T = 1.0;",
    "  for ( int i = 0; i < VZ_N; i++ ) {",
    "    vec3 p = ro + rd * ( ( float( i ) + jit ) * st );",
    "    float dens = uP.x * exp( -max( p.y, 0.0 ) / uFall );",
    "    vec3 L = vec3( 0.0 );",
    "    float o = vzOut( p );",
    "    if ( o > 0.0 ) {",
    "      float sh = 1.0;",
    "      if ( uShadowOn > 0.5 ) {",
    "        vec4 sc = uShadowM * vec4( p, 1.0 ); sc.xyz /= sc.w;",
    "        if ( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0 ) sh = step( sc.z - 0.003, unpackRGBAToDepth( texture2D( tShadow, sc.xy ) ) );",
    "      }",
    "      L += uMoonCol * uP.y * sh * phase * o;",
    "    }",
    "    for ( int k = 0; k < 8; k++ ) {",
    "      float f = clamp( 1.0 - length( uLP[ k ] - p ) / max( uLC[ k ].w, 0.01 ), 0.0, 1.0 );",
    "      L += uLC[ k ].rgb * f * f * uP.z;",
    "    }",
    "    acc += T * dens * L * st; T *= exp( -dens * st * uExt );",
    "  }",
    "  gl_FragColor = vec4( acc * uFogCol * ( 1.0 - 0.5 * skyPx ), mix( T, 1.0, skyPx ) );",
    "}",
  ].join("\n");

  function quad(mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    m.frustumCulled = false;
    const s = new THREE.Scene(); s.add(m);
    s.autoUpdate = false;
    return s;
  }
  function mat(frag, uniforms, defines) {
    return new THREE.ShaderMaterial({ uniforms, defines: defines || {}, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false, fog: false });
  }

  G.Post = {
    DR, DEPTH_GLSL, AIR_GLSL, DU, AU,
    AIR_LAYER: 3,
    ready: false,
    out: { bloom: null, air: null, god: null, ao: null, fogv: null },

    init(r) {
      this.r = r;
      this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.type = G.Visuals && G.Visuals.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
      const B = CFG().bloom;
      this.m = {
        extract: mat(BLOOM_EXTRACT, { tScene: { value: null }, uTh: { value: new THREE.Vector2(B.threshold * B.threshold, B.knee) } }),
        down: mat(BLOOM_DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }),
        up: mat(BLOOM_UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: B.radius } }),
        godMask: mat(GOD_MASK, Object.assign({ tScene: { value: null }, uMoon: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 }, uTh: { value: 0.2 } }, DU)),
        godBlur: mat(GOD_BLUR, { tMask: { value: null }, uMoon: { value: new THREE.Vector2(0.5, 0.5) }, uP: { value: new THREE.Vector4() }, uFade: { value: 0 } }, { VZ_N: CFG().godRays.samples | 0 }),
        ssao: mat(SSAO, Object.assign({ uTan: { value: new THREE.Vector2(1, 1) }, uRes: { value: new THREE.Vector2(1, 1) }, uP: { value: new THREE.Vector4() } }, DU), { VZ_N: CFG().ssao.samples | 0 }),
        ssaoBlur: mat(SSAO_BLUR, Object.assign({ tAO: { value: null }, uDir: { value: new THREE.Vector2() } }, DU)),
        raymarch: mat(RAYMARCH, Object.assign({
          uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
          uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonCol: { value: new THREE.Color() }, uP: { value: new THREE.Vector4() },
          uFogCol: { value: new THREE.Color() }, uFall: { value: 6 }, uExt: { value: 0.35 },
          tShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 },
          vzFoot: G.Visuals.U.vzFoot, vzRoof: G.Visuals.U.vzRoof,
          uLP: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) }, uLC: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
        }, DU), { VZ_N: CFG().raymarch.steps | 0 }),
      };
      this.scenes = {};
      Object.keys(this.m).forEach((k) => { this.scenes[k] = quad(this.m[k]); });
      this.airCam = new THREE.PerspectiveCamera();
      this.airCam.matrixAutoUpdate = false;
      this.airCam.layers.set(this.AIR_LAYER);
      this.rts = {};
      this.ready = true;
    },

    // a render target of a given use and size, made again only when its size changes
    target(key, w, h, type) {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      let t = this.rts[key];
      if (t && t.width === w && t.height === h) return t;
      if (t) t.dispose();
      t = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
        type: type || this.type, depthBuffer: false, stencilBuffer: false });
      t.texture.generateMipmaps = false;
      this.rts[key] = t;
      return t;
    },
    draw(key, target) {
      const r = this.r;
      r.setRenderTarget(target);
      r.render(this.scenes[key], this.ortho);
    },

    // everything for this frame (js/visuals.js render: after the scene and the
    // gun, before the composite). Q: the graphics level's row of the table.
    run(game, rt, cam, Q) {
      const r = this.r, out = this.out, W = rt.width, H = rt.height;
      out.bloom = out.air = out.god = out.ao = out.fogv = null;
      const depth = rt.depthTexture || null;
      DU.tDepth.value = depth;
      DU.uCam.value.set(cam.near, cam.far);
      const ac = r.autoClear;
      r.autoClear = true;
      if (depth) {
        if (Q.air) out.air = this.air(game, cam, W, H);
        if (Q.ssao) out.ao = this.ssao(cam, W * Q.ssao, H * Q.ssao);
        if (Q.godRays) out.god = this.godRays(rt, cam, W, H);
        if (Q.raymarch) out.fogv = this.raymarch(game, cam, W, H);
      }
      // (only from the HDR picture: in an 8-bit one nothing is over the threshold)
      if (Q.bloom && Q.bloom !== "off" && rt.texture.type !== THREE.UnsignedByteType) out.bloom = this.bloom(rt, Q.bloom === "half" ? 0.5 : 1);
      r.autoClear = ac;
      return out;
    },

    // ---- I: bloom ----
    bloom(rt, scale) {
      const B = CFG().bloom, M = this.m;
      const n = Math.max(1, B.levels | 0);
      let w = rt.width * scale, h = rt.height * scale;
      const base = this.target("b0", w, h);
      M.extract.uniforms.tScene.value = rt.texture;
      M.extract.uniforms.uTh.value.set(B.threshold * B.threshold, B.knee);
      this.draw("extract", base);
      const down = [base];
      for (let i = 1; i <= n; i++) {
        w /= 2; h /= 2;
        if (w < 2 || h < 2) break;
        const src = down[i - 1], dst = this.target("bd" + i, w, h);
        M.down.uniforms.tSrc.value = src.texture;
        M.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.draw("down", dst);
        down.push(dst);
      }
      // back up, adding each level in
      let src = down[down.length - 1];
      M.up.uniforms.uRadius.value = B.radius;
      for (let i = down.length - 2; i >= 0; i--) {
        const dst = this.target("bu" + i, down[i].width, down[i].height);
        M.up.uniforms.tSrc.value = src.texture;
        M.up.uniforms.tAdd.value = down[i].texture;
        M.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.draw("up", dst);
        src = dst;
      }
      return src.texture;
    },

    // ---- H: the light in the air ----
    air(game, cam, W, H) {
      const r = this.r, A = CFG().air, sc = game.scene;
      const t = this.target("air", W * A.resolution, H * A.resolution);
      AU.uAirRes.value.set(t.width, t.height);
      AU.uSoft.value = A.soft;
      const c = this.airCam;
      c.matrixWorld.copy(cam.matrixWorld); c.matrixWorldInverse.copy(cam.matrixWorldInverse);
      c.projectionMatrix.copy(cam.projectionMatrix); c.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      const bg = sc.background, cc = r.getClearColor(this._cc || (this._cc = new THREE.Color())).getHex(), ca = r.getClearAlpha();
      sc.background = null;
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(t);
      r.clear(true, false, false);
      const au = r.autoClear;
      r.autoClear = false;
      r.render(sc, c);
      r.autoClear = au;
      r.setClearColor(cc, ca);
      sc.background = bg;
      return t.texture;
    },

    // ---- H: rays from the moon (High and up) ----
    godRays(rt, cam, W, H) {
      const C = CFG().godRays, M = this.m;
      const moon = G.Sky && G.Sky.MOON_DIR;
      if (!moon) return null;
      // where the moon is on the screen, and how much of it to show
      const p = this._mp || (this._mp = new THREE.Vector3());
      cam.getWorldPosition(p);
      p.addScaledVector(moon, 500).project(cam);
      const fwd = this._fw || (this._fw = new THREE.Vector3());
      cam.getWorldDirection(fwd);
      const facing = fwd.dot(moon);
      const off = Math.max(Math.abs(p.x), Math.abs(p.y));
      const fade = facing <= 0 ? 0 : Math.min(1, facing * 2.5) * (1 - Math.min(1, Math.max(0, (off - 1.0) / 0.9)));
      const moonVis = G.Sky && G.Sky.uniforms ? G.Sky.uniforms.uMoon.value : 1;
      if (fade * moonVis <= 0.01) return null;
      const t1 = this.target("god1", W * C.resolution, H * C.resolution), t2 = this.target("god2", W * C.resolution, H * C.resolution);
      M.godMask.uniforms.tScene.value = rt.texture;
      M.godMask.uniforms.uMoon.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      M.godMask.uniforms.uAspect.value = W / H;
      M.godMask.uniforms.uTh.value = C.threshold != null ? C.threshold : 0.2;
      this.draw("godMask", t1);
      M.godBlur.uniforms.tMask.value = t1.texture;
      M.godBlur.uniforms.uMoon.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
      M.godBlur.uniforms.uP.value.set(C.density, C.decay, C.weight, C.exposure);
      M.godBlur.uniforms.uFade.value = fade * moonVis;
      this.draw("godBlur", t2);
      return t2.texture;
    },

    // ---- J: ambient occlusion from the depth (High and up) ----
    ssao(cam, w, h) {
      const S = CFG().ssao, M = this.m;
      const a = this.target("ao1", w, h), b = this.target("ao2", w, h);
      const ty = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      M.ssao.uniforms.uTan.value.set(ty * cam.aspect, ty);
      M.ssao.uniforms.uRes.value.set(a.width, a.height);
      M.ssao.uniforms.uP.value.set(S.radius, S.strength, S.bias, 0);
      this.draw("ssao", a);
      M.ssaoBlur.uniforms.tAO.value = a.texture; M.ssaoBlur.uniforms.uDir.value.set(1 / a.width, 0);
      this.draw("ssaoBlur", b);
      M.ssaoBlur.uniforms.tAO.value = b.texture; M.ssaoBlur.uniforms.uDir.value.set(0, 1 / a.height);
      this.draw("ssaoBlur", a);
      return a.texture;
    },

    // ---- H: fog lit from inside (Very High) ----
    raymarch(game, cam, W, H) {
      const C = CFG().raymarch, M = this.m.raymarch.uniforms;
      const t = this.target("fogv", W * C.resolution, H * C.resolution);
      M.uInvProj.value.copy(cam.projectionMatrixInverse);
      M.uCamWorld.value.copy(cam.matrixWorld);
      if (G.Sky && G.Sky.light) {
        const L = G.Sky.light;
        M.uMoonDir.value.copy(G.Sky.MOON_DIR);
        M.uMoonCol.value.copy(L.color).multiplyScalar(L.intensity);
        // the moon's shadow: the wide cascade if there is one, else the near map
        const far = G.Visuals && G.Visuals.far && G.Visuals.far.parent ? G.Visuals.far : null;
        const S = far && far.shadow.map ? far : L.castShadow && L.shadow.map ? L : null;
        M.uShadowOn.value = S ? 1 : 0;
        if (S) { M.tShadow.value = S.shadow.map.texture; M.uShadowM.value.copy(S.shadow.matrix); }
      } else M.uShadowOn.value = 0;
      M.uP.value.set(C.density, C.moon, C.lamps, C.maxDistance);
      M.uFogCol.value.setHex(C.color).multiplyScalar(2.2);
      M.uFall.value = C.heightFalloff || 6;
      M.uExt.value = C.extinction != null ? C.extinction : 0.35;
      const pool = (G.Perf && G.Perf.pool) || [];
      for (let i = 0; i < 8; i++) {
        const l = pool[i];
        if (l && l.intensity > 0) { M.uLP.value[i].copy(l.position); M.uLC.value[i].set(l.color.r * l.intensity, l.color.g * l.intensity, l.color.b * l.intensity, l.distance || 10); }
        else M.uLC.value[i].set(0, 0, 0, 0.01);
      }
      this.draw("raymarch", t);
      return t.texture;
    },

    // the shaders, compiled at the load (js/visuals.js afterCompile)
    compile() {
      if (!this.ready) return;
      Object.keys(this.scenes).forEach((k) => { try { this.r.compile(this.scenes[k], this.ortho); } catch (e) { /* best effort */ } });
    },
  };
})();
