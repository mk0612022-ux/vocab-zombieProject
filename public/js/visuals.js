// ===================================================================
// Visuals -- visual series, round 1: colour, light, shadow, materials, fog,
// and the rule over all of them: dark but readable
// -------------------------------------------------------------------
// Every value comes from js/visual-config.js (G.VISUAL). What this file does:
//
//   the frame   the world (and then the gun in hand) is drawn into an HDR
//               picture; a full-screen pass -- the composite -- gives it its
//               film: exposure, ACES Filmic (or AgX) tone mapping, the grade
//               (shadows lifted to navy, cool midtones, blue-white
//               highlights, low saturation that spares warm hues, moderate
//               contrast), a thin vignette and a touch of dither. The words
//               over the zombies are drawn after that, straight onto the
//               screen: no fog, no film, no glow ever reaches them.
//   shaders     three.js's own shader chunks, patched once at load: the fog
//               (exp2, thicker near the ground, greyer far off, tinted where
//               it faces the moon, thinner on a zombie in combat range), the
//               moon and the open sky reaching inside the school only through
//               its windows, and the moon's shadow in two cascades on High
//               and up. Every material gets the shared values (uniforms) the
//               patches read, through one onBeforeCompile hook.
//   materials   the level's baked (merged) surfaces become MeshStandard --
//               roughness and metalness by what they are made of (stone,
//               wood, paint, metal...), lit per pixel, reflecting a night-sky
//               environment map; stone and brick get a fine grain (Medium up);
//               corners and seams are darkened once at load (vertex AO). The
//               zombies, and the gun and arms in hand, get a cyan rim of light
//               and never fall below a least light.
//   shadows     off / low / medium (soft) / two cascades, by graphics level
//   brightness  the player's Brightness (Settings > Graphics, and a
//               calibration screen the first time the game opens) and
//               Visibility Boost (Accessibility)
// ===================================================================
(function () {
  const CFG = () => G.VISUAL;
  const RANK = { vlow: 0, low: 1, medium: 2, high: 3, vhigh: 4 };
  const LABEL_LAYER = 2;
  const LW = new THREE.Vector3(0.2126, 0.7152, 0.0722);

  // ---------------------------------------------------------- shared uniforms
  // One object per value, handed to every material when it compiles: setting
  // .value here reaches them all at once, nothing recompiles.
  const U = {
    vzFogP: { value: new THREE.Vector4(2, 0, 3, 0) },          // density by far, height amount, height falloff, desaturate
    vzFogLit: { value: new THREE.Color(0x3b6a8a) },
    vzFogLitP: { value: new THREE.Vector2(0, 5) },              // amount, power
    vzMoonW: { value: new THREE.Vector3(-0.62, 0.6, 0.5).normalize() },
    vzFoot: { value: [new THREE.Vector4(1, 0, 1, 0), new THREE.Vector4(1, 0, 1, 0), new THREE.Vector4(1, 0, 1, 0), new THREE.Vector4(1, 0, 1, 0)] },
    vzRoof: { value: -1000 },
    vzIndoor: { value: new THREE.Vector2(1, 1) },               // moon, sky kept indoors
    vzDetailMap: { value: null },
    vzDetailP: { value: new THREE.Vector4(0, 0, 1, 0.85) },     // albedo, normal, per metre, from roughness
  };

  // ---------------------------------------------------------- shader chunks
  // (r128's chunks; each replacement checked, so a three.js that differs
  // fails loudly in the console instead of silently)
  const SC = THREE.ShaderChunk;
  function swap(name, from, to) {
    if (SC[name].indexOf(from) < 0) { console.warn("visuals: chunk " + name + " not as expected"); return; }
    SC[name] = SC[name].replace(from, to);
  }
  function patchChunks() {
    // ---- fog: the world position of each fragment, from the view-space one
    SC.fog_pars_vertex = "#ifdef USE_FOG\n\tvarying float fogDepth;\n\tvarying vec3 vzFogW;\n\tvarying vec3 vzFogV;\n#endif";
    SC.fog_vertex = [
      "#ifdef USE_FOG",
      "\tfogDepth = - mvPosition.z;",
      // (the view matrix is a rotation and a move: undone without inverting it)
      // (and without cameraPosition: three.js leaves that uniform at zero for
      // Lambert, Basic, sprites and points -- the camera's place is in the
      // view matrix too)
      "\tvzFogV = vec3( dot( viewMatrix[ 0 ].xyz, mvPosition.xyz ), dot( viewMatrix[ 1 ].xyz, mvPosition.xyz ), dot( viewMatrix[ 2 ].xyz, mvPosition.xyz ) );",
      "\tvzFogW = vzFogV - vec3( dot( viewMatrix[ 0 ].xyz, viewMatrix[ 3 ].xyz ), dot( viewMatrix[ 1 ].xyz, viewMatrix[ 3 ].xyz ), dot( viewMatrix[ 2 ].xyz, viewMatrix[ 3 ].xyz ) );",
      "#endif",
    ].join("\n");
    SC.fog_pars_fragment = [
      "#ifdef USE_FOG",
      "\tuniform vec3 fogColor;",
      "\tvarying float fogDepth;",
      "\tvarying vec3 vzFogW;",
      "\tvarying vec3 vzFogV;",
      "\tuniform vec4 vzFogP; uniform vec3 vzFogLit; uniform vec2 vzFogLitP; uniform vec3 vzMoonW;",
      "\t#ifdef FOG_EXP2",
      "\t\tuniform float fogDensity;",
      "\t#else",
      "\t\tuniform float fogNear;",
      "\t\tuniform float fogFar;",
      "\t#endif",
      "#endif",
    ].join("\n");
    // exp2 between the scene fog's near and far (game code moves those: the
    // drift, a boss's darkness), thicker near the ground, greyer as it fades,
    // lit towards the moon
    SC.fog_fragment = [
      "#ifdef USE_FOG",
      "\t#ifdef FOG_EXP2",
      "\t\tfloat vzX = fogDensity * fogDepth;",
      "\t\tfloat vzFar = 1.0 / max( fogDensity, 1e-4 );",
      "\t#else",
      "\t\tfloat vzX = max( fogDepth - fogNear, 0.0 ) / max( fogFar - fogNear, 0.001 ) * ( vzFogP.x > 0.0 ? vzFogP.x : 2.0 );",
      "\t\tfloat vzFar = fogFar;",
      "\t#endif",
      // (the extras skipped where they are off: branches on a uniform cost nothing)
      "\tfloat vzH = 0.0;",
      "\tif ( vzFogP.y > 0.0 ) vzH = vzFogP.y * exp( - max( vzFogW.y, 0.0 ) / max( vzFogP.z, 0.1 ) );",
      "\tfloat fogFactor = 1.0 - exp( - vzX * vzX * ( 1.0 + vzH ) );",
      "\t#ifdef VZ_FOG_SCALE",
      // (on a short view -- the bunker on Low -- combat range can pass the far plane)
      "\t\tfogFactor *= mix( VZ_FOG_SCALE, 1.0, smoothstep( min( VZ_FOG_RANGE, vzFar * 0.8 ), vzFar, fogDepth ) );",
      "\t#endif",
      "\tvec3 vzFC = fogColor;",
      "\tif ( vzFogLitP.x > 0.0 ) vzFC = mix( fogColor, vzFogLit, vzFogLitP.x * pow( max( dot( normalize( vzFogV ), vzMoonW ), 0.0 ), max( vzFogLitP.y, 1.0 ) ) );",
      "\tif ( vzFogP.w > 0.0 ) gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), fogFactor * vzFogP.w );",
      "\tgl_FragColor.rgb = mix( gl_FragColor.rgb, vzFC, fogFactor );",
      "#endif",
    ].join("\n");

    // ---- indoors: the building's footprint (rectangles, under its roof)
    SC.lights_pars_begin = [
      "uniform vec4 vzFoot[ 4 ];",
      "uniform float vzRoof;",
      "uniform vec2 vzIndoor;",
      "float vzOutdoor( vec3 p ) {",
      "\tfloat inside = 0.0;",
      "\tfor ( int i = 0; i < 4; i ++ ) {",
      "\t\tvec4 f = vzFoot[ i ];",
      "\t\tinside = max( inside, step( f.x, p.x ) * step( p.x, f.y ) * step( f.z, p.z ) * step( p.z, f.w ) );",
      "\t}",
      "\treturn 1.0 - inside * step( p.y, vzRoof );",
      "}",
    ].join("\n") + "\n" + SC.lights_pars_begin;

    // ---- per-pixel lights (Standard, Phong): the moon and the sky indoors,
    // and the moon's two shadow cascades
    swap("lights_fragment_begin", "IncidentLight directLight;", [
      "IncidentLight directLight;",
      "#ifdef USE_FOG",
      "\tfloat vzOut = vzOutdoor( vzFogW );",
      "#else",
      "\tfloat vzOut = 1.0;",
      "#endif",
      "float vzMoonK = mix( vzIndoor.x, 1.0, vzOut ), vzHemiK = mix( vzIndoor.y, 1.0, vzOut );",
      "#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS == 2",
      // the near cascade wherever it covers, fading into the far one at its edge
      "\tvec3 vzC0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;",
      "\tvec2 vzE0 = smoothstep( 0.0, 0.1, vzC0.xy ) * smoothstep( 1.0, 0.9, vzC0.xy );",
      "\tfloat vzW0 = vzE0.x * vzE0.y * step( vzC0.z, 1.0 );",
      "#endif",
    ].join("\n"));
    swap("lights_fragment_begin",
      "\t\tgetDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n\t\tdirectionalLightShadow = directionalLightShadows[ i ];\n\t\tdirectLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif",
      "\t\tgetDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\tdirectLight.color *= vzMoonK;\n\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n\t\tdirectionalLightShadow = directionalLightShadows[ i ];\n\t\tdirectLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#if NUM_DIR_LIGHT_SHADOWS == 2\n\t\tdirectLight.color *= ( UNROLLED_LOOP_INDEX == 0 ) ? vzW0 : 1.0 - vzW0;\n\t\t#endif\n\t\t#endif");
    swap("lights_fragment_begin", "irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );", "irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry ) * vzHemiK;");
    // ---- the pool's point lights: a pixel out of a light's reach skips its
    // shading (three.js works it out to zero for every light, every pixel --
    // the most of Medium's cost on an iGPU, with its four)
    {
      const s = SC.lights_fragment_begin, a = s.indexOf("NUM_POINT_LIGHTS > 0"), b = a >= 0 ? s.indexOf("#pragma unroll_loop_end", a) : -1;
      const re = "RE_Direct( directLight, geometry, material, reflectedLight );";
      if (b > a && s.slice(a, b).indexOf(re) >= 0) SC.lights_fragment_begin = s.slice(0, a) + s.slice(a, b).replace(re, "if ( directLight.visible ) " + re) + s.slice(b);
    }

    // ---- per-vertex lights (Lambert): the same indoors; with two cascades
    // only the first lights (the shadow mask below blends their shadows)
    swap("lights_lambert_vertex", "IncidentLight directLight;", [
      "IncidentLight directLight;",
      "vec3 vzW = vec3( dot( viewMatrix[ 0 ].xyz, mvPosition.xyz - viewMatrix[ 3 ].xyz ), dot( viewMatrix[ 1 ].xyz, mvPosition.xyz - viewMatrix[ 3 ].xyz ), dot( viewMatrix[ 2 ].xyz, mvPosition.xyz - viewMatrix[ 3 ].xyz ) );",
      "float vzOut = vzOutdoor( vzW );",
      "float vzMoonK = mix( vzIndoor.x, 1.0, vzOut ), vzHemiK = mix( vzIndoor.y, 1.0, vzOut );",
    ].join("\n"));
    swap("lights_lambert_vertex",
      "\t\tgetDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );\n\t\tdotNL = dot( geometry.normal, directLight.direction );\n\t\tdirectLightColor_Diffuse = PI * directLight.color;",
      "\t\tgetDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );\n\t\tdotNL = dot( geometry.normal, directLight.direction );\n\t\tdirectLightColor_Diffuse = PI * directLight.color * vzMoonK;\n\t\t#if NUM_DIR_LIGHT_SHADOWS == 2\n\t\tdirectLightColor_Diffuse *= ( UNROLLED_LOOP_INDEX == 0 ) ? 1.0 : 0.0;\n\t\t#endif");
    swap("lights_lambert_vertex", "\t\tvIndirectFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );", "\t\tvIndirectFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry ) * vzHemiK;");
    swap("lights_lambert_vertex", "\t\t\tvIndirectBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry );", "\t\t\tvIndirectBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry ) * vzHemiK;");
    swap("shadowmask_pars_fragment",
      "\t#if NUM_DIR_LIGHT_SHADOWS > 0\n\tDirectionalLightShadow directionalLight;",
      "\t#if NUM_DIR_LIGHT_SHADOWS == 2\n\tDirectionalLightShadow vzDL0 = directionalLightShadows[ 0 ], vzDL1 = directionalLightShadows[ 1 ];\n\tvec3 vzC0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;\n\tvec2 vzE0 = smoothstep( 0.0, 0.1, vzC0.xy ) * smoothstep( 1.0, 0.9, vzC0.xy );\n\tfloat vzW0 = vzE0.x * vzE0.y * step( vzC0.z, 1.0 );\n\tfloat vzS0 = receiveShadow ? getShadow( directionalShadowMap[ 0 ], vzDL0.shadowMapSize, vzDL0.shadowBias, vzDL0.shadowRadius, vDirectionalShadowCoord[ 0 ] ) : 1.0;\n\tfloat vzS1 = receiveShadow ? getShadow( directionalShadowMap[ 1 ], vzDL1.shadowMapSize, vzDL1.shadowBias, vzDL1.shadowRadius, vDirectionalShadowCoord[ 1 ] ) : 1.0;\n\tshadow *= mix( vzS1, vzS0, vzW0 );\n\t#elif NUM_DIR_LIGHT_SHADOWS > 0\n\tDirectionalLightShadow directionalLight;");
  }

  // ---------------------------------------------------------- the hook
  // three.js calls material.onBeforeCompile(shader) before compiling it.
  // Every material answers with this one function -- which hands the shader
  // the shared uniforms and adds a material's own extras (rim, least light,
  // grain) -- and then runs the material's own hook, if it set one (the
  // grass, the curtains, the dust: they each keep their own cache key).
  function hook(shader, renderer) {
    G.Visuals.inject(shader, this);
    if (this._vzObc) this._vzObc(shader, renderer);
  }
  function hookMaterials() {
    Object.defineProperty(THREE.Material.prototype, "onBeforeCompile", {
      configurable: true,
      get() { return hook; },
      set(fn) { this._vzObc = fn; },
    });
    // (the extras are written into the shader's code, so they are part of the
    // key three.js caches compiled programs by: no two materials that differ
    // in them ever share a program)
    THREE.Material.prototype.customProgramCacheKey = function () {
      const ud = this.userData || {};
      let k = "vz";
      if (ud.vzRim) k += "|r" + ud.vzRim.color.getHexString() + ud.vzRim.power;
      if (ud.vzMinLight) k += "|m" + ud.vzMinLight.getHexString();
      if (ud.vzDetail && G.Visuals && G.Visuals.cfgQ().detail) k += "|d";
      if (this._vzObc) k += "|" + this._vzObc.toString();
      return k;
    };
  }

  // ---------------------------------------------------------- the composite
  const GLSL_TONE = [
    "vec3 vzSrgbToLin( vec3 c ) { return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, c ) ); }",
    "vec3 vzLinToSrgb( vec3 c ) { c = max( c, 0.0 ); return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }",
    "vec3 vzRRT( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }",
    "vec3 vzAces( vec3 c ) {",
    "  const mat3 I = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );",
    "  const mat3 O = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );",
    "  c = I * ( c / 0.6 ); c = vzRRT( c ); c = O * c; return clamp( c, 0.0, 1.0 );",
    "}",
    // AgX (Troy Sobotka's, in Benjamin Wrensch's minimal fit): returns display values
    "vec3 vzAgxCurve( vec3 x ) { vec3 x2 = x * x; vec3 x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }",
    "vec3 vzAgx( vec3 c ) {",
    "  const mat3 A = mat3( vec3( 0.842479062253094, 0.0423282422610123, 0.0423756549057051 ), vec3( 0.0784335999999992, 0.878468636469772, 0.0784336 ), vec3( 0.0792237451477643, 0.0791661274605434, 0.879142973793104 ) );",
    "  const mat3 B = mat3( vec3( 1.19687900512017, -0.0528968517574562, -0.0529716355144438 ), vec3( -0.0980208811401368, 1.15190312990417, -0.0980434501171241 ), vec3( -0.0990297440797205, -0.0989611768448433, 1.15107367264116 ) );",
    "  c = A * max( c, 1e-10 ); c = clamp( log2( c ), -12.47393, 4.026069 ); c = ( c + 12.47393 ) / 16.49999;",
    "  c = vzAgxCurve( c ); c = B * c; return clamp( c, 0.0, 1.0 );",
    "}",
  ].join("\n");
  // The film for one colour: tone mapping and the grade. It depends on the
  // colour alone, so it is baked into a colour table (a LUT) whenever the
  // grade changes -- the brightness, Visibility Boost, a level's theme -- and
  // the frame only looks colours up in it (on an iGPU the film per pixel cost
  // more than the copy itself)
  const FILM_GLSL = [
    "uniform float uExposure; uniform float uAgx;",
    "uniform vec3 uShadowCol; uniform float uLift; uniform float uLiftEnd;",
    "uniform vec3 uMidTint; uniform float uMidAmt; uniform vec3 uHighTint; uniform float uHighAmt;",
    "uniform float uSat; uniform float uWarmKeep; uniform float uContrast;",
    GLSL_TONE,
    "vec3 vzFilm( vec3 c ) {",
    // the scene is lit in the colours it was painted in: into linear light
    // for the film, then back
    "  c = vzSrgbToLin( max( c, 0.0 ) ) * uExposure;",
    "  vec3 d = uAgx > 0.5 ? vzAgx( c ) : vzLinToSrgb( vzAces( c ) );",
    "  const vec3 LW = vec3( 0.2126, 0.7152, 0.0722 );",
    "  float L = dot( d, LW );",
    // saturation down, except in the warm hues (orange, amber, red)
    "  float mx = max( d.r, max( d.g, d.b ) ), mn = min( d.r, min( d.g, d.b ) );",
    "  float warm = smoothstep( 0.04, 0.2, mx - mn ) * smoothstep( 0.02, 0.12, d.r - d.b ) * smoothstep( -0.02, 0.08, d.r - d.g );",
    "  d = mix( vec3( L ), d, mix( uSat, uWarmKeep, warm ) );",
    // cool midtones, blue-white highlights (tints kept at the same brightness)
    "  vec3 mt = uMidTint / max( dot( uMidTint, LW ), 1e-3 ), ht = uHighTint / max( dot( uHighTint, LW ), 1e-3 );",
    "  float wm = smoothstep( 0.04, 0.3, L ) * ( 1.0 - smoothstep( 0.45, 0.85, L ) ), wh = smoothstep( 0.5, 1.0, L );",
    "  d = mix( d, d * mt, uMidAmt * wm * ( 1.0 - warm ) );",
    "  d = mix( d, d * ht, uHighAmt * wh * ( 1.0 - warm ) );",
    "  d = ( d - 0.42 ) * uContrast + 0.42;",
    // the darkest parts lifted to navy: never black
    "  L = dot( max( d, 0.0 ), LW );",
    "  d = max( d, 0.0 ) + uShadowCol * uLift * ( 1.0 - smoothstep( 0.0, uLiftEnd, L ) );",
    "  return clamp( d, 0.0, 1.0 );",
    "}",
  ].join("\n");
  // (the table: VZ_LUT_N steps a channel, the blue steps laid out as tiles,
  // VZ_LUT_T to a row -- 64 steps make a 512 x 512 texture. A colour goes in
  // through sqrt( c / ( 1 + c ) ): every brightness the HDR frame holds fits,
  // with more steps for the dark ones)
  const LUT_GLSL = [
    "vec3 vzLutIn( vec3 c ) { return sqrt( max( c, 0.0 ) / ( 1.0 + max( c, 0.0 ) ) ); }",
    "vec3 vzLutOut( vec3 s ) { s = min( s * s, 0.9995 ); return s / ( 1.0 - s ); }",
  ].join("\n");
  const LUT_FRAG = [
    FILM_GLSL,
    LUT_GLSL,
    "void main() {",
    "  vec2 f = floor( gl_FragCoord.xy );",
    "  vec2 t = floor( ( f + 0.5 ) / VZ_LUT_N );",
    "  vec3 s = vec3( f - t * VZ_LUT_N, t.y * VZ_LUT_T + t.x );",
    "  gl_FragColor = vec4( vzFilm( vzLutOut( s / ( VZ_LUT_N - 1.0 ) ) ), 1.0 );",
    "}",
  ].join("\n");
  const COMPOSITE_FRAG = [
    "uniform sampler2D tScene; uniform sampler2D tLut;",
    "uniform vec2 uRes;",
    "uniform float uVig; uniform float uVigStart; uniform float uDither; uniform float uTime;",
    "varying vec2 vUv;",
    LUT_GLSL,
    "vec3 vzLut( vec3 c ) {",
    "  vec3 s = vzLutIn( c ) * ( VZ_LUT_N - 1.0 );",
    "  float b0 = floor( s.b ), b1 = min( b0 + 1.0, VZ_LUT_N - 1.0 );",
    "  vec2 size = vec2( VZ_LUT_T, ceil( VZ_LUT_N / VZ_LUT_T ) ) * VZ_LUT_N;",
    "  vec2 t0 = vec2( mod( b0, VZ_LUT_T ), floor( b0 / VZ_LUT_T ) ), t1 = vec2( mod( b1, VZ_LUT_T ), floor( b1 / VZ_LUT_T ) );",
    "  vec3 a = texture2D( tLut, ( t0 * VZ_LUT_N + s.rg + 0.5 ) / size ).rgb;",
    "  vec3 b = texture2D( tLut, ( t1 * VZ_LUT_N + s.rg + 0.5 ) / size ).rgb;",
    "  return mix( a, b, s.b - b0 );",
    "}",
    // FXAA (Timothy Lottes's, in its short form): smooths the stair-steps of
    // edges for a few texture reads instead of a multisampled HDR frame
    "vec3 vzFxaa( vec2 uv ) {",
    "  vec2 px = 1.0 / uRes; const vec3 LU = vec3( 0.299, 0.587, 0.114 );",
    "  vec3 cNW = texture2D( tScene, uv + vec2( -1.0, -1.0 ) * px ).rgb, cNE = texture2D( tScene, uv + vec2( 1.0, -1.0 ) * px ).rgb;",
    "  vec3 cSW = texture2D( tScene, uv + vec2( -1.0, 1.0 ) * px ).rgb, cSE = texture2D( tScene, uv + vec2( 1.0, 1.0 ) * px ).rgb;",
    "  vec3 cM = texture2D( tScene, uv ).rgb;",
    "  float lNW = dot( min( cNW, 1.0 ), LU ), lNE = dot( min( cNE, 1.0 ), LU ), lSW = dot( min( cSW, 1.0 ), LU ), lSE = dot( min( cSE, 1.0 ), LU ), lM = dot( min( cM, 1.0 ), LU );",
    "  float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) ), lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );",
    "  if ( lMax - lMin < max( 0.0312, lMax * 0.125 ) ) return cM;",
    "  vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );",
    "  float red = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 0.0078125 );",
    "  dir = clamp( dir / ( min( abs( dir.x ), abs( dir.y ) ) + red ), -8.0, 8.0 ) * px;",
    "  vec3 a = 0.5 * ( texture2D( tScene, uv - dir / 6.0 ).rgb + texture2D( tScene, uv + dir / 6.0 ).rgb );",
    "  vec3 b = a * 0.5 + 0.25 * ( texture2D( tScene, uv - dir * 0.5 ).rgb + texture2D( tScene, uv + dir * 0.5 ).rgb );",
    "  float lB = dot( min( b, 1.0 ), LU );",
    "  return ( lB < lMin || lB > lMax ) ? a : b;",
    "}",
    "void main() {",
    // (FXAA compiled in only where it is on: High and up)
    "  #ifdef VZ_FXAA",
    "  vec3 d = vzLut( vzFxaa( vUv ) );",
    "  #else",
    "  vec3 d = vzLut( texture2D( tScene, vUv ).rgb );",
    "  #endif",
    "  vec2 p = vUv * 2.0 - 1.0;",
    "  float r = length( p ) / 1.41421;",
    "  d *= 1.0 - uVig * smoothstep( uVigStart, 1.0, r );",
    // (interleaved gradient noise: no sine)
    "  float n = fract( 52.9829189 * fract( dot( gl_FragCoord.xy + uTime * 5.588238, vec2( 0.06711056, 0.00583715 ) ) ) );",
    "  d += ( n - 0.5 ) * uDither / 255.0;",
    "  gl_FragColor = vec4( clamp( d, 0.0, 1.0 ), 1.0 );",
    "}",
  ].join("\n");

  // ---------------------------------------------------------- the system
  G.Visuals = {
    U, LABEL_LAYER, FILM_GLSL,
    ready: false,
    q: "medium",
    frame: 0,
    _conv: new WeakMap(),       // a material -> its MeshStandard version
    _ao: new WeakMap(),         // a material -> its vertex-coloured (AO) copy

    cfgQ(q) { return CFG().quality[q || this.q] || CFG().quality.medium; },
    rank(q) { return RANK[q || this.q] != null ? RANK[q || this.q] : 2; },

    // --------------------------------------------------------- start up
    init(game) {
      const r = game.renderer;
      this.game = game;
      this.renderer = r;
      r.toneMapping = THREE.NoToneMapping;          // the composite does it, once
      r.outputEncoding = THREE.LinearEncoding;
      r.shadowMap.autoUpdate = false;               // updated on our cadence (render)
      // (each light's shadow on its own cadence: the lights not due this frame
      // are left out -- their maps, and the matrices that go with them, stay
      // as they were)
      this._skip = new Set();
      const SM = r.shadowMap, drawShadows = SM.render;
      // (and the shadow maps' own draw calls counted apart: G.Visuals.shadowCalls)
      this.shadowCalls = 0;
      SM.render = (lights, scene, camera) => {
        const c0 = r.info.render.calls;
        drawShadows.call(SM, this._skip.size ? lights.filter((l) => !this._skip.has(l)) : lights, scene, camera);
        this.shadowCalls += r.info.render.calls - c0;
      };
      const gl = r.getContext();
      this.hdr = r.capabilities.isWebGL2 ? !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))
        : !!(gl.getExtension("OES_texture_half_float") && gl.getExtension("EXT_color_buffer_half_float"));
      this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      // the film's colour table, and what fills it (the grade's uniforms are
      // shared: applyGrade sets them, the table is filled again before the next frame)
      const N = CFG().grade.lutSize || 64, T = Math.ceil(Math.sqrt(N));
      const lutDefs = { VZ_LUT_N: num(N), VZ_LUT_T: num(T) };
      this.lutRT = new THREE.WebGLRenderTarget(T * N, Math.ceil(N / T) * N, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
      this.lutRT.texture.generateMipmaps = false;
      const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }";
      this.compMat = new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: null }, tLut: { value: this.lutRT.texture }, uRes: { value: new THREE.Vector2(1, 1) },
          uExposure: { value: 1 }, uAgx: { value: 0 },
          uShadowCol: { value: new THREE.Color() }, uLift: { value: 0 }, uLiftEnd: { value: 0.3 },
          uMidTint: { value: new THREE.Color() }, uMidAmt: { value: 0 }, uHighTint: { value: new THREE.Color() }, uHighAmt: { value: 0 },
          uSat: { value: 1 }, uWarmKeep: { value: 1 }, uContrast: { value: 1 },
          uVig: { value: 0 }, uVigStart: { value: 0.55 }, uDither: { value: 1 }, uTime: { value: 0 },
        },
        defines: Object.assign({}, lutDefs),
        vertexShader: VERT,
        fragmentShader: COMPOSITE_FRAG,
        depthTest: false, depthWrite: false, fog: false,
      });
      this.lutMat = new THREE.ShaderMaterial({ uniforms: this.compMat.uniforms, defines: lutDefs, vertexShader: VERT, fragmentShader: LUT_FRAG,
        depthTest: false, depthWrite: false, fog: false });
      const quadOf = (m) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; const s = new THREE.Scene(); s.add(q); return s; };
      this.compScene = quadOf(this.compMat);
      this.lutScene = quadOf(this.lutMat);
      this._lutDirty = true;
      r.domElement.addEventListener("webglcontextrestored", () => { this._lutDirty = true; });
      this.labelCam = new THREE.PerspectiveCamera();
      this.labelCam.matrixAutoUpdate = false;
      this.labelCam.layers.set(LABEL_LAYER);
      // the zombies' shared material: Standard, with the rim, a least light
      // and less fog in combat range
      this.zombieMaterials();
      this.detailTexture();
      this.applyGrade(null);
      this.q = G.save.settings.graphicsQuality;
      this.ready = true;
    },

    // --------------------------------------------------------- the grade
    // the theme's own grade over the school's (js/visual-config.js), the
    // player's brightness and Visibility Boost on top
    gradeFor(theme) {
      const g = Object.assign({}, CFG().grade, (theme && CFG().themeGrade[theme]) || {});
      const s = (G.save && G.save.settings) || {};
      const B = CFG().brightness;
      const br = Number.isFinite(s.brightness) ? s.brightness : B.default;
      g.exposure *= br;
      if (s.visibilityBoost) {
        g.exposure *= B.visibilityBoost.exposure;
        g.lift += B.visibilityBoost.lift;
        g.liftEnd = Math.max(g.liftEnd, B.visibilityBoost.liftEnd);
      }
      return g;
    },
    applyGrade(theme) {
      this.theme = theme;
      const g = this.gradeFor(theme), u = this.compMat.uniforms;
      u.uExposure.value = g.exposure;
      u.uAgx.value = g.toneMapping === "agx" ? 1 : 0;
      u.uShadowCol.value.setHex(g.shadowColor); u.uLift.value = g.lift; u.uLiftEnd.value = g.liftEnd;
      u.uMidTint.value.setHex(g.midTint); u.uMidAmt.value = g.midTintAmount;
      u.uHighTint.value.setHex(g.highTint); u.uHighAmt.value = g.highTintAmount;
      u.uSat.value = g.saturation; u.uWarmKeep.value = g.warmKeep; u.uContrast.value = g.contrast;
      u.uVig.value = g.vignette; u.uVigStart.value = g.vignetteStart; u.uDither.value = g.dither;
      this._lutDirty = true;
    },
    // the film into its colour table (render, after any change to the grade)
    bakeLut(r) {
      r.setRenderTarget(this.lutRT);
      r.autoClear = true;
      r.render(this.lutScene, this.ortho);
      this._lutDirty = false;
    },
    // The same film in JavaScript, for one colour: what the screen shows for a
    // scene colour (0-1 sRGB-like, as painted) -- the calibration screen draws
    // its symbols with it, the tests check the labels' contrast with it
    toDisplay(rgb, theme, opts) {
      const g = Object.assign(this.gradeFor(theme), opts || {});
      const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      const enc = (c) => { c = Math.max(0, c); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
      const rrt = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
      let c = rgb.map((x) => lin(Math.max(0, x)) * g.exposure / 0.6);
      const I = [[0.59719, 0.35458, 0.04823], [0.076, 0.90834, 0.01566], [0.0284, 0.13383, 0.83777]];
      const O = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
      const mul = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
      c = mul(O, mul(I, c).map(rrt)).map((x) => enc(Math.min(1, Math.max(0, x))));
      let L = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      c = c.map((x) => L + (x - L) * g.saturation);
      c = c.map((x) => (x - 0.42) * g.contrast + 0.42);
      L = Math.max(0, c[0]) * 0.2126 + Math.max(0, c[1]) * 0.7152 + Math.max(0, c[2]) * 0.0722;
      const t = Math.min(1, Math.max(0, L / g.liftEnd)), sh = 1 - t * t * (3 - 2 * t);
      const S = new THREE.Color(g.shadowColor);
      c = [Math.max(0, c[0]) + S.r * g.lift * sh, Math.max(0, c[1]) + S.g * g.lift * sh, Math.max(0, c[2]) + S.b * g.lift * sh];
      return c.map((x) => Math.min(1, Math.max(0, x)));
    },

    // --------------------------------------------------------- the frame
    target(r) {
      const s = r.getDrawingBufferSize(this._sz || (this._sz = new THREE.Vector2()));
      const w = Math.max(1, s.x | 0), h = Math.max(1, s.y | 0);
      const msaa = r.capabilities.isWebGL2 ? Math.min(this.cfgQ().msaa || 0, r.capabilities.maxSamples || 0) : 0;
      const hdr = this.hdr && this.cfgQ().hdr !== false;           // (8-bit on the lowest levels: half the memory traffic)
      const key = w + "x" + h + "@" + msaa + (hdr ? "h" : "b");
      if (this._rt && this._rtKey === key) return this._rt;
      if (this._rt) this._rt.dispose();
      const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
        type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false };
      let rt;
      if (msaa > 0 && THREE.WebGLMultisampleRenderTarget) { rt = new THREE.WebGLMultisampleRenderTarget(w, h, opts); rt.samples = msaa; }
      else rt = new THREE.WebGLRenderTarget(w, h, opts);
      rt.texture.generateMipmaps = false;
      this._rt = rt; this._rtKey = key;
      this.compMat.uniforms.uRes.value.set(w, h);
      return rt;
    },
    render(game) {
      const r = game.renderer, sc = game.scene;
      const cut = G.Cutscene && G.Cutscene.active && G.Cutscene.camera;
      const cam = cut ? G.Cutscene.camera : game.camera;
      if (!r || !sc || !cam) return;
      r.info.reset();
      this.shadowCalls = 0;
      this.frame++;
      // the moon's shadow: redrawn every frame, or every few on Low
      const sh = this._shadowEvery || 1;
      const near = G.Sky && G.Sky.light, far = this.far && this.far.parent ? this.far : null;
      const dueNear = this._shadowDirty || this.frame % sh === 0;
      const dueFar = !!far && (this._farDirty || this.frame % (CFG().shadows.far.every || 4) === 0);
      r.shadowMap.needsUpdate = r.shadowMap.enabled && (dueNear || dueFar);
      this._skip.clear();
      if (near && !dueNear) this._skip.add(near);
      if (far && !dueFar) this._skip.add(far);
      this._shadowDirty = false; this._farDirty = false;
      const rt = this.target(r);
      if (this._lutDirty) this.bakeLut(r);
      r.setRenderTarget(rt);
      r.autoClear = true;
      r.render(sc, cam);
      // (the passes after the first: every matrix is up to date already --
      // updating the level's two thousand objects again cost a millisecond each)
      const au = sc.autoUpdate;
      sc.autoUpdate = false;
      const vm = game.vmCamera;
      if (vm && !cut) {
        cam.updateMatrixWorld();
        vm.matrixWorld.copy(cam.matrixWorld);
        vm.matrixWorldInverse.copy(cam.matrixWorldInverse);
        if (vm.fov !== cam.fov || vm.aspect !== cam.aspect) { vm.fov = cam.fov; vm.aspect = cam.aspect; vm.updateProjectionMatrix(); }
        vm.matrixAutoUpdate = false;
        r.autoClear = false;
        r.clearDepth();
        const bg = sc.background;
        sc.background = null;
        r.shadowMap.needsUpdate = false;
        r.render(sc, vm);
        sc.background = bg;
      }
      // the film, onto the screen
      r.setRenderTarget(null);
      const u = this.compMat.uniforms;
      u.tScene.value = rt.texture;
      const fx = !!this.cfgQ().fxaa, D = this.compMat.defines;
      if (fx !== !!D.VZ_FXAA) { if (fx) D.VZ_FXAA = 1; else delete D.VZ_FXAA; this.compMat.needsUpdate = true; }
      u.uTime.value = (this.frame % 997) * 0.37;
      r.autoClear = false;
      r.render(this.compScene, this.ortho);
      // the words, untouched by any of it
      const lc = this.labelCam;
      cam.updateMatrixWorld();
      lc.matrixWorld.copy(cam.matrixWorld);
      lc.matrixWorldInverse.copy(cam.matrixWorldInverse);
      lc.projectionMatrix.copy(cam.projectionMatrix);
      lc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      const bg = sc.background;
      sc.background = null;
      r.shadowMap.needsUpdate = false;
      r.clearDepth();                 // (on top of everything, whatever their depth test)
      r.render(sc, lc);
      sc.background = bg;
      sc.autoUpdate = au;
      r.autoClear = true;
    },

    // --------------------------------------------------------- the hook's work
    inject(shader, mat) {
      // (anything may call a material's hook -- a test with half a shader too)
      if (!shader) return;
      if (shader.uniforms) Object.assign(shader.uniforms, U);
      const ud = (mat && mat.userData) || {};
      let f = shader.fragmentShader;
      if (typeof f !== "string") return;
      // thin two-sided things lit per vertex (grass, leaves, paper, curtains):
      // both faces take the front's light -- a blade's back is not its shadow
      if (mat.isMeshLambertMaterial && mat.side === THREE.DoubleSide) {
        f = f.replace("( gl_FrontFacing ) ? vIndirectFront : vIndirectBack", "vIndirectFront").replace("( gl_FrontFacing ) ? vLightFront : vLightBack", "vLightFront");
      }
      if (ud.vzRim || ud.vzMinLight) {
        const add = [];
        if (ud.vzMinLight) add.push("reflectedLight.indirectDiffuse += diffuseColor.rgb * " + vec3(ud.vzMinLight) + ";");
        if (ud.vzRim) {
          // the rim: brightest at the silhouette, a little stronger on the
          // side the moon is on
          add.push("{ float vzF = pow( 1.0 - saturate( dot( normal, geometry.viewDir ) ), " + num(ud.vzRim.power) + " );");
          add.push("  float vzM = 0.55;");
          add.push("  #if NUM_DIR_LIGHTS > 0");
          add.push("  vzM = 0.45 + 0.55 * saturate( dot( normal, directionalLights[ 0 ].direction ) * 0.5 + 0.6 );");
          add.push("  #endif");
          add.push("  reflectedLight.directDiffuse += " + vec3(ud.vzRim.color) + " * vzF * vzM; }");
        }
        f = f.replace("#include <aomap_fragment>", "#include <aomap_fragment>\n" + add.join("\n"));
      }
      if (ud.vzDetail && this.cfgQ().detail) {
        f = "uniform sampler2D vzDetailMap;\nuniform vec4 vzDetailP;\n" + f;
        f = f.replace("#include <normal_fragment_maps>", [
          "#include <normal_fragment_maps>",
          "#ifdef USE_FOG",
          "{ vec3 vzWn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );",
          "  vec3 vzA = abs( vzWn ); vec3 vzT1, vzT2; vec2 vzUv;",
          "  if ( vzA.y > vzA.x && vzA.y > vzA.z ) { vzUv = vzFogW.xz; vzT1 = vec3( 1.0, 0.0, 0.0 ); vzT2 = vec3( 0.0, 0.0, 1.0 ); }",
          "  else if ( vzA.x > vzA.z ) { vzUv = vzFogW.zy; vzT1 = vec3( 0.0, 0.0, 1.0 ); vzT2 = vec3( 0.0, 1.0, 0.0 ); }",
          "  else { vzUv = vzFogW.xy; vzT1 = vec3( 1.0, 0.0, 0.0 ); vzT2 = vec3( 0.0, 1.0, 0.0 ); }",
          "  vec3 vzD = texture2D( vzDetailMap, vzUv * vzDetailP.z ).rgb;",
          "  float vzR = smoothstep( vzDetailP.w - 0.08, vzDetailP.w, roughnessFactor );",
          "  diffuseColor.rgb *= 1.0 + ( vzD.r - 0.5 ) * 2.0 * vzDetailP.x * vzR;",
          "  normal = normalize( normal + mat3( viewMatrix ) * ( vzT1 * ( vzD.g - 0.5 ) + vzT2 * ( vzD.b - 0.5 ) ) * vzDetailP.y * vzR ); }",
          "#endif",
        ].join("\n"));
      }
      shader.fragmentShader = f;
    },

    // a small tiling grain: brightness in red, a tilt in green and blue
    detailTexture() {
      const S = 128, data = new Uint8Array(S * S * 4), R = G.makeRng(9091);
      // value noise on a coarse grid, tiled, plus fine speckle
      const grid = (n) => { const a = []; for (let i = 0; i < n * n; i++) a.push(R()); return a; };
      const g1 = grid(8), g2 = grid(16), g3 = grid(32);
      const smp = (g, n, x, y) => {
        const fx = x * n, fy = y * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      };
      const h = new Float32Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        h[y * S + x] = smp(g1, 8, u, v) * 0.5 + smp(g2, 16, u, v) * 0.3 + smp(g3, 32, u, v) * 0.15 + R() * 0.05;
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = y * S + x, hx = h[y * S + (x + 1) % S] - h[y * S + (x + S - 1) % S], hy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
        data[i * 4] = Math.round(h[i] * 255); data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, 0.5 - hx * 3)) * 255);
        data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, 0.5 - hy * 3)) * 255); data[i * 4 + 3] = 255;
      }
      const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true; t.needsUpdate = true;
      U.vzDetailMap.value = t;
      const D = CFG().materials.detail;
      U.vzDetailP.value.set(D.albedo, D.normal, D.scale, D.minRoughness);
    },

    // --------------------------------------------------------- materials
    surface(hex) {
      const M = CFG().materials;
      for (const k of ["wood", "paint", "metal", "rust", "rubber"]) if (M[k].colors && M[k].colors.indexOf(hex) >= 0) return M[k];
      return M.rough;
    },
    toStandard(m, surf) {
      if (this._conv.has(m)) return this._conv.get(m);
      const s = new THREE.MeshStandardMaterial({
        color: m.color, map: m.map, vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity,
        side: m.side, alphaTest: m.alphaTest, depthWrite: m.depthWrite, depthTest: m.depthTest, alphaMap: m.alphaMap,
        emissive: m.emissive || 0x000000, emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity != null ? m.emissiveIntensity : 1,
        fog: m.fog, blending: m.blending, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
      });
      const k = surf || this.surface(m.color ? m.color.getHex() : 0);
      s.roughness = k.roughness; s.metalness = k.metalness;
      s.userData = Object.assign({}, m.userData, { vzFrom: m });
      if (k.roughness >= CFG().materials.detail.minRoughness) s.userData.vzDetail = true;
      s.name = m.name;
      this._conv.set(m, s);
      return s;
    },
    // the palette's surfaces: roughness (green) and metalness (blue) for every
    // colour in it, in the same texel as the colour
    paletteSurface(PAL) {
      const n = PAL.size, data = new Uint8Array(n * n * 4).fill(255);
      Object.keys(PAL.idx).forEach((hexS) => {
        const i = PAL.idx[hexS], k = this.surface(Number(hexS));
        const x = i % n, y = Math.floor(i / n), row = n - 1 - y;      // a canvas row 0 is the texture's top
        const p = (row * n + x) * 4;
        data[p] = 255; data[p + 1] = Math.round(k.roughness * 255); data[p + 2] = Math.round(k.metalness * 255);
      });
      if (!this._palSurf) {
        this._palSurf = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
        this._palSurf.magFilter = this._palSurf.minFilter = THREE.NearestFilter; this._palSurf.generateMipmaps = false;
      } else this._palSurf.image.data.set(data);
      this._palSurf.needsUpdate = true;
      return this._palSurf;
    },
    zombieMaterials() {
      const Z = CFG().zombies, F = CFG().fog, M = CFG().materials.zombie;
      const mk = (rim, strength) => {
        const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: M.roughness, metalness: M.metalness });
        m.userData.shared = true;
        m.userData.vzRim = { color: new THREE.Color(rim).multiplyScalar(strength), power: Z.rimPower };
        m.userData.vzMinLight = new THREE.Color(Z.minLight);
        m.defines = Object.assign({}, m.defines, { VZ_FOG_SCALE: num(F.zombieScale), VZ_FOG_RANGE: num(F.combatRange) });
        return m;
      };
      G.ZOMBIE_MATS.lambert = mk(Z.rim, Z.rimStrength);
      G.ZOMBIE_MATS_BOSS = mk(Z.bossRim, Z.bossRimStrength);
    },
    // the gun and the arms in hand: per-pixel light, metal where it is dark,
    // the rim, a least light
    viewmodel(root) {
      if (!this.ready) return;
      const VM = CFG().viewmodel, M = CFG().materials;
      root.traverse((o) => {
        if (!o.isMesh || Array.isArray(o.material)) return;
        const m = o.material;
        if (!m.isMeshLambertMaterial) return;
        let s = this._conv.get(m);
        if (!s) {
          const c = m.color || new THREE.Color(1, 1, 1);
          const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
          const metal = lum <= M.gunMetal.maxLum;
          s = this.toStandard(m, metal ? M.gunMetal : M.gunPolymer);
          s.userData.vzDetail = false;
          s.userData.vzEnv = metal;
          if (metal && this._env) s.envMap = this._env;
          s.userData.vzRim = { color: new THREE.Color(VM.rim).multiplyScalar(VM.rimStrength), power: VM.rimPower };
          s.userData.vzMinLight = new THREE.Color(VM.minLight);
        }
        o.material = s;
      });
    },

    // --------------------------------------------------------- vertex AO
    // Big boxes are cut into pieces first (before the palette and the merge),
    // so corners and seams have vertices to be darkened at.
    subdivide(scene, world) {
      const A = CFG().materials.ao, seg = A.segment;
      const PAL = G.SchoolDress && G.SchoolDress.P && G.SchoolDress.P.PAL;
      const skip = new Set();
      const mark = (o) => { if (o && o.traverse) o.traverse((c) => skip.add(c)); };
      ["interactables", "roomDoors", "doors", "keys", "crates", "buttons", "traps", "noMerge"].forEach((k) => (world[k] || []).forEach((i) => mark(i && i.mesh ? i.mesh : i)));
      const box = new THREE.Box3();
      let n = 0;
      scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || skip.has(o)) return;
        const g = o.geometry;
        if (!g || g.type !== "BoxGeometry" || !g.parameters) return;
        const p = g.parameters, sx = Math.abs(o.scale.x), sy = Math.abs(o.scale.y), sz = Math.abs(o.scale.z);
        const nx = Math.min(48, Math.ceil(p.width * sx / seg)), ny = Math.min(24, Math.ceil(p.height * sy / seg)), nz = Math.min(48, Math.ceil(p.depth * sz / seg));
        if (nx <= 1 && ny <= 1 && nz <= 1) return;
        if (p.widthSegments > 1 || p.heightSegments > 1 || p.depthSegments > 1) return;
        // only a box nobody has moved inside its own geometry
        if (!g.boundingBox) g.computeBoundingBox();
        box.copy(g.boundingBox);
        if (Math.abs(box.min.x + p.width / 2) > 1e-4 || Math.abs(box.max.y - p.height / 2) > 1e-4 || Math.abs(box.max.z - p.depth / 2) > 1e-4) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => !m || m.transparent || !(m.isMeshLambertMaterial || m.isMeshBasicMaterial))) return;
        const pal = mats.length === 1 && PAL && (mats[0] === PAL.lit || mats[0] === PAL.unlit || mats[0] === PAL.litMetal);
        // a texture other than a tiled one (a sign's face) keeps its box
        if (!pal && mats.some((m) => m.map && m.map.repeat.x === 1 && m.map.repeat.y === 1)) return;
        const ng = new THREE.BoxGeometry(p.width, p.height, p.depth, nx, ny, nz);
        if (pal && g.attributes.uv) {
          const u = g.attributes.uv.getX(0), v = g.attributes.uv.getY(0), uv = ng.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
        }
        o.geometry = ng;
        if (!g.userData.shared) g.dispose();
        n++;
      });
      return n;
    },
    // the solid things the AO looks for, from the meshes about to be merged
    occluders(list) {
      const boxes = [], b = new THREE.Box3();
      list.forEach((o) => {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.every((m) => m && m.transparent)) return;
        const g = o.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        b.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
        const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
        if (Math.max(dx, dy, dz) < 0.3 || (Math.min(dx, dy, dz) < 0.04 && Math.max(dx, dy, dz) < 0.6)) return;     // books, paper, scuffs
        if (dx * dy * dz > 6000 && dy < 1.2) { boxes.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]); return; }   // the ground
        boxes.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
      });
      // a 1 m grid over them (a plain array, a list per cell); the very large
      // ones checked always
      const S = 1, big = [], small = [];
      let gx0 = Infinity, gz0 = Infinity, gx1 = -Infinity, gz1 = -Infinity;
      boxes.forEach((bx, i) => {
        const x0 = Math.floor(bx[0] / S), x1 = Math.floor(bx[3] / S), z0 = Math.floor(bx[2] / S), z1 = Math.floor(bx[5] / S);
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 600) { big.push(i); return; }
        small.push(i);
        gx0 = Math.min(gx0, x0); gz0 = Math.min(gz0, z0); gx1 = Math.max(gx1, x1); gz1 = Math.max(gz1, z1);
      });
      const W = small.length ? gx1 - gx0 + 1 : 0, H = small.length ? gz1 - gz0 + 1 : 0;
      const grid = new Array(W * H);
      small.forEach((i) => {
        const bx = boxes[i];
        const x0 = Math.floor(bx[0] / S) - gx0, x1 = Math.floor(bx[3] / S) - gx0, z0 = Math.floor(bx[2] / S) - gz0, z1 = Math.floor(bx[5] / S) - gz0;
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const k = z * W + x; (grid[k] || (grid[k] = [])).push(i); }
      });
      const flat = new Float32Array(boxes.length * 6);
      boxes.forEach((bx, i) => flat.set(bx, i * 6));
      return { S, grid, W, H, gx0, gz0, big, flat, n: boxes.length, stamp: new Int32Array(boxes.length).fill(-1), near: new Int32Array(4096) };
    },
    // the boxes within `reach` of a point, once per vertex (into occ.near)
    gather(occ, x, y, z, reach, tag) {
      const F = occ.flat, S = occ.S, near = occ.near, st = occ.stamp;
      let n = 0;
      const take = (list) => {
        for (let j = 0; j < list.length && n < near.length; j++) {
          const b = list[j];
          if (st[b] === tag) continue;
          st[b] = tag;
          const i = b * 6;
          if (x + reach > F[i] && x - reach < F[i + 3] && y + reach > F[i + 1] && y - reach < F[i + 4] && z + reach > F[i + 2] && z - reach < F[i + 5]) near[n++] = b;
        }
      };
      const x0 = Math.max(0, Math.floor((x - reach) / S) - occ.gx0), x1 = Math.min(occ.W - 1, Math.floor((x + reach) / S) - occ.gx0);
      const z0 = Math.max(0, Math.floor((z - reach) / S) - occ.gz0), z1 = Math.min(occ.H - 1, Math.floor((z + reach) / S) - occ.gz0);
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) { const c = occ.grid[cz * occ.W + cx]; if (c) take(c); }
      take(occ.big);
      return n;
    },
    solidAt(occ, n, x, y, z) {
      const F = occ.flat, near = occ.near, e = 0.001;
      for (let j = 0; j < n; j++) { const i = near[j] * 6; if (x > F[i] + e && x < F[i + 3] - e && y > F[i + 1] + e && y < F[i + 4] - e && z > F[i + 2] + e && z < F[i + 5] - e) return true; }
      return false;
    },
    // into the vertices of a merged (world-space) geometry: how much of the
    // space around each vertex, off its face, is solid
    bakeAO(geo, material, occ, small) {
      if (!occ || !material || material.transparent || !material.isMeshLambertMaterial || material.vertexColors) return material;
      const A = CFG().materials.ao, R = A.radius, k = A.strength;
      const P = geo.attributes.position.array, N = geo.attributes.normal.array, n = P.length / 3;
      this.aoVerts = (this.aoVerts || 0) + n;
      const col = new Float32Array(n * 3);
      const d = R * 0.7;
      const dark = []; for (let i = 0; i <= 8; i++) dark.push(1 - k * Math.pow(i / 8, 0.85));
      for (let v = 0; v < n; v++) {
        const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
        // two directions along the face
        let ax, ay, az;
        if (Math.abs(ny) > 0.9) { ax = 1; ay = 0; az = 0; } else { const l = Math.hypot(nz, nx) || 1; ax = nz / l; ay = 0; az = -nx / l; }
        const bx = ny * az - nz * ay, by = nz * ax - nx * az, bz = nx * ay - ny * ax;
        // (only the boxes within reach of this vertex are looked at)
        const nb = small && small[v] ? 0 : this.gather(occ, px, py, pz, R + 0.12, occ.tag = (occ.tag || 0) + 1);
        let hit = 0;
        if (nb) {
          const ox = px + nx * 0.06, oy = py + ny * 0.06, oz = pz + nz * 0.06;
          if (this.solidAt(occ, nb, ox + ax * R, oy + ay * R, oz + az * R)) hit++;
          if (this.solidAt(occ, nb, ox - ax * R, oy - ay * R, oz - az * R)) hit++;
          if (this.solidAt(occ, nb, ox + bx * R, oy + by * R, oz + bz * R)) hit++;
          if (this.solidAt(occ, nb, ox - bx * R, oy - by * R, oz - bz * R)) hit++;
          const ux = px + nx * d, uy = py + ny * d, uz = pz + nz * d, q = d * 0.7;
          if (this.solidAt(occ, nb, ux + (ax + bx) * q, uy + (ay + by) * q, uz + (az + bz) * q)) hit++;
          if (this.solidAt(occ, nb, ux + (ax - bx) * q, uy + (ay - by) * q, uz + (az - bz) * q)) hit++;
          if (this.solidAt(occ, nb, ux - (ax + bx) * q, uy - (ay + by) * q, uz - (az + bz) * q)) hit++;
          if (this.solidAt(occ, nb, ux - (ax - bx) * q, uy - (ay - by) * q, uz - (az - bz) * q)) hit++;
        }
        // (and a faint unevenness, by where the vertex is: surfaces are not flat)
        const h = Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453;
        const ao = dark[hit] * (1 + (A.grain || 0) * ((h - Math.floor(h)) * 2 - 1));
        col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = ao;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      let m = this._ao.get(material);
      if (!m) { m = material.clone(); m.vertexColors = true; m.userData = Object.assign({}, material.userData); this._ao.set(material, m); }
      return m;
    },

    // --------------------------------------------------------- a level
    // before the palette and the merge
    beforeBake(game) {
      if (!this.ready || !game.world) return;
      const t0 = performance.now();
      this.subdivided = this.subdivide(game.scene, game.world);
      this.subdivideMs = Math.round(performance.now() - t0);
    },
    // after the merge: materials, the environment, the lights, the fog
    afterBake(game) {
      if (!this.ready) return;
      const sc = game.scene, world = game.world, theme = game.level && game.level.theme;
      this.applyGrade(theme);
      const PAL = G.SchoolDress && G.SchoolDress.P && G.SchoolDress.P.PAL;
      const palSurf = PAL ? this.paletteSurface(PAL) : null;
      // the night sky to reflect -- given only to what reflects it (metal,
      // glass, water): sampling it costs every pixel that carries it
      this.environment(game, theme);
      let n = 0;
      this.levelMats = new Set();
      // (each baked mesh keeps both: per-pixel Standard from Medium up, the
      // cheaper per-vertex Lambert below -- js/visual-config.js quality.pbr)
      this.swaps = [];
      sc.traverse((o) => {
        if (!o.isMesh || !o.userData.mergedParts) return;
        const m = o.material;
        // (transparent decals stay as they are: js/wear.js shows its mark tiers
        // by matching these very material objects)
        if (!m || Array.isArray(m) || !m.isMeshLambertMaterial || m.transparent || m._vzObc) return;
        const isPal = PAL && m.map === PAL.tex;
        const s = this.toStandard(m, isPal ? { roughness: 1, metalness: 1 } : null);
        if (isPal) { s.roughnessMap = palSurf; s.metalnessMap = palSurf; s.userData.vzDetail = true; }
        s.userData.vzEnv = isPal ? !!m.userData.vzMetal : s.metalness > 0.2;
        o.material = s;
        this.swaps.push({ mesh: o, lambert: m, standard: s });
        this.levelMats.add(s);
        n++;
      });
      // (the puddles and the window glass are Standard already -- js/details.js,
      // js/glass.js -- and say so with userData.vzEnv)
      this.converted = n;
      this.assignEnv(sc);
      // the specks of dust floating in the rooms' light: dimmer in the darker picture
      if (theme === "school") (world.dressDetails || []).forEach((d) => {
        const m = d.kind === "dust" && d.mesh && d.mesh.material;
        if (!m || Array.isArray(m)) return;
        if (m.userData.vzOpacity == null) m.userData.vzOpacity = m.opacity;
        m.opacity = m.userData.vzOpacity * CFG().school.dust;
      });
      this.levelLights(game, theme);
      this.footprint(world, theme);
      this.fog(game, theme);
      this.applyQuality(game, G.save.settings.graphicsQuality);
      if (game.vmCamera && G.PlayerBody && G.PlayerBody.armRig) this.viewmodel(G.PlayerBody.armRig.group);
      // what is not in the level yet but will be drawn in it -- a zombie's two
      // materials, a word's sprite -- goes in for the load's compile
      // (js/game.js prepareScene), so the first zombie brings no hitch
      const pre = this._pre = new THREE.Group();
      const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      box.setAttribute("color", new THREE.Float32BufferAttribute(new Array(box.attributes.position.count * 3).fill(1), 3));
      [G.ZOMBIE_MATS.lambert, G.ZOMBIE_MATS.basic].forEach((m) => pre.add(new THREE.Mesh(box, m)));
      if (G.makeWordSprite) pre.add(G.makeWordSprite("word"));
      pre.position.set(0, -500, 0);
      sc.add(pre);
    },
    // after the load's compile: the samples out again, the film compiled too
    afterCompile(game) {
      if (this._pre && this._pre.parent) this._pre.parent.remove(this._pre);
      this._pre = null;
      try { game.renderer.compile(this.compScene, this.ortho); } catch (e) { /* best effort */ }
    },
    // the night sky as an environment map: what metal, glass and wet floors reflect
    environment(game, theme) {
      const r = game.renderer, sc = game.scene;
      if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(r);
      const key = theme || "none";
      if (!this._env || this._envKey !== key) {
        if (this._env) this._env.dispose();
        const S = CFG().school, pal = G.THEME_PALETTES[theme] || G.THEME_PALETTES.school;
        const es = new THREE.Scene();
        const sky = G.Sky && G.Sky.skyMaterial ? G.Sky.skyMaterial(pal.fog) : new THREE.MeshBasicMaterial({ color: pal.fog, side: THREE.BackSide });
        if (sky.uniforms) {
          if (theme === "school") { sky.uniforms.uTop.value.setHex(S.sky.top); sky.uniforms.uMid.value.setHex(S.sky.mid); }
          else { sky.uniforms.uTop.value.setHex(pal.fog); sky.uniforms.uMid.value.setHex(pal.fog); }
          if (theme !== "school") sky.uniforms.uMoon.value = 0;
        }
        es.add(new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), sky));
        this._env = this._pmrem.fromScene(es, 0, 0.1, 150).texture;
        this._envKey = key;
        sky.dispose && sky.dispose();
      }
      sc.environment = null;
    },
    // every material that reflects (userData.vzEnv) gets the environment map
    assignEnv(sc) {
      if (!sc || !this._env) return;
      const done = new Set();
      sc.traverse((o) => {
        if (!o.material || Array.isArray(o.material)) return;
        const m = o.material;
        if (!m.isMeshStandardMaterial || done.has(m)) return;
        done.add(m);
        const want = m.userData.vzEnv ? this._env : null;
        if (m.envMap !== want) { m.envMap = want; m.needsUpdate = true; }
      });
      this._envK = null;            // (the indoor/outdoor strength, set again next frame)
    },
    levelLights(game, theme) {
      const sc = game.scene;
      if (theme !== "school") return;
      const S = CFG().school;
      let hemiDone = false;
      const drop = [];
      sc.children.forEach((o) => {
        if (o.isAmbientLight) { o.color.setHex(S.ambient.color); o.intensity = S.ambient.intensity; }
        if (o.isHemisphereLight) {
          if (hemiDone) { drop.push(o); return; }
          hemiDone = true;
          o.color.setHex(S.hemisphere.sky); o.groundColor.setHex(S.hemisphere.ground); o.intensity = S.hemisphere.intensity;
        }
      });
      drop.forEach((o) => sc.remove(o));
      sc.background = new THREE.Color(S.background);
    },
    // where the building is: the moon and the sky reach inside it only
    // through the windows
    footprint(world, theme) {
      const f = (world && world.footprint) || [];
      const S = CFG().school;
      for (let i = 0; i < 4; i++) {
        const r = f[i];
        // (a little inside the walls' outer faces: those are outdoors)
        if (r && theme === "school") U.vzFoot.value[i].set(r.minX + 0.12, r.maxX - 0.12, r.minZ + 0.12, r.maxZ - 0.12);
        else U.vzFoot.value[i].set(1, 0, 1, 0);
      }
      const top = world && world.storeyY ? world.storeyY[world.storeyY.length - 1] + 3.95 : -1000;
      U.vzRoof.value = theme === "school" ? top : -1000;
      U.vzIndoor.value.set(S.indoor.moon, S.indoor.hemisphere);
    },
    fog(game, theme) {
      const F = CFG().fog, P = CFG().palette, q = this.cfgQ(G.save.settings.graphicsQuality);
      const school = theme === "school";
      // (the lowest two levels: plain distance fog only -- spec M)
      const full = q.pbr !== false;
      U.vzFogP.value.set(school && q.fogDensity ? q.fogDensity : F.density, school && q.heightFog ? F.height : 0, F.heightFalloff, !full ? 0 : school ? F.desaturate : F.desaturate * 0.5);
      U.vzFogLit.value.setHex(P.fogLit);
      U.vzFogLitP.value.set(school && full ? F.litAmount : 0, F.litPower);
      if (G.Sky) U.vzMoonW.value.copy(G.Sky.MOON_DIR);
    },
    // the fog's far plane for a level and graphics level (js/world.js, game.js)
    fogFar(pal, q) {
      const school = G.THEME_PALETTES && pal === G.THEME_PALETTES.school;
      const k = school ? this.cfgQ(q).view : CFG().fog.themeView[q];
      return pal.fogFar * (k || 1);
    },

    // --------------------------------------------------------- quality
    applyQuality(game, q) {
      this.q = q;
      const Q = this.cfgQ(q), r = game.renderer, S = CFG().shadows;
      (this.swaps || []).forEach((w) => { w.mesh.material = Q.pbr === false ? w.lambert : w.standard; });
      if (G.Perf) {
        const n = Q.lights;
        if (G.Perf.LIGHT_POOL[q] !== n) { G.Perf.LIGHT_POOL[q] = n; if (game.scene && G.Perf.anchors) G.Perf.resizePool(game.scene, q); }
      }
      const mode = Q.shadows;
      r.shadowMap.enabled = mode !== "off";
      const type = mode === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      if (r.shadowMap.type !== type) r.shadowMap.type = type;
      this._shadowEvery = mode === "low" ? S.low.every : mode === "medium" ? S.medium.every : S.csmEvery || 1;
      this._shadowDirty = true;
      const L = G.Sky && G.Sky.light;
      if (L) {
        const set = (light, size, ext) => {
          light.castShadow = true;
          if (light.shadow.mapSize.x !== size) { light.shadow.mapSize.set(size, size); if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; } }
          const c = light.shadow.camera;
          if (c.right !== ext || c.far !== 220) { c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 1; c.far = 220; c.updateProjectionMatrix(); }
          light.shadow.bias = S.bias; light.shadow.normalBias = S.normalBias;
          light.userData.extent = ext;
        };
        if (mode === "off") L.castShadow = false;
        else if (mode === "low") set(L, S.low.size, S.low.extent);
        else if (mode === "medium") set(L, S.medium.size, S.medium.extent);
        else set(L, (S[q] || S.high).nearSize, S.near.extent);
        // the far cascade (High and up): a second moon, the same light, wide
        if (mode === "csm") {
          if (!this.far) {
            this.far = new THREE.DirectionalLight(L.color.getHex(), L.intensity);
            this.far.layers.enable(1);
          }
          if (this.far.parent !== game.scene) { game.scene.add(this.far); game.scene.add(this.far.target); }
          set(this.far, (S[q] || S.high).farSize, S.far.extent);
        } else if (this.far && this.far.parent) { this.far.parent.remove(this.far); this.far.target.parent && this.far.target.parent.remove(this.far.target); }
        if (G.Sky.placeShadow) G.Sky.placeShadow(G.Sky._shadowAt || new THREE.Vector3(0, 0, 30), true);
      }
      // the grain on stone (High up): recompile what carries it
      (this.levelMats || []).forEach((m) => { if (m.userData.vzDetail) m.needsUpdate = true; });
      // (the window glass is made again for the new level: its reflection too)
      this.assignEnv(game.scene);
      this.fog(game, game.level && game.level.theme);
    },

    // --------------------------------------------------------- each frame
    update(game, dt) {
      if (!this.ready || !game.scene) return;
      // the far cascade follows the moon (and a cloud over it) and the player
      if (this.far && this.far.parent && G.Sky && G.Sky.light) {
        const L = G.Sky.light;
        this.far.color.copy(L.color); this.far.intensity = L.intensity;
        G.Sky.placeCascade(this.far, game);
      }
      // the sky reflected outdoors, much less of it indoors
      const S = CFG().school, inside = G.Sky && G.Sky.indoors;
      const want = inside ? S.envIndoor : S.envOutdoor;
      if (this._envK !== want) { this._envK = want; (this.levelMats || []).forEach((m) => { if (!m.userData.vzFrom || !m.userData.vzFrom.isMeshPhongMaterial) m.envMapIntensity = want; }); }
    },
  };

  function num(x) { const s = String(+x); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; }
  function vec3(c) { return "vec3( " + num(c.r) + ", " + num(c.g) + ", " + num(c.b) + " )"; }

  patchChunks();
  hookMaterials();
  // the school's fog and sky meet in the palette's colour (js/world.js reads
  // these when it builds the level; the sky's horizon is the fog)
  if (G.THEME_PALETTES && G.THEME_PALETTES.school && G.VISUAL) {
    const P = G.THEME_PALETTES.school;
    P.fog = G.VISUAL.palette.fog; P.fogNear = G.VISUAL.fog.near; P.fogFar = G.VISUAL.fog.far;
  }
  // the dynamic lights by graphics level (J: a fixed number each, never changed while playing)
  if (G.Perf && G.VISUAL) Object.keys(G.VISUAL.quality).forEach((q) => { G.Perf.LIGHT_POOL[q] = G.VISUAL.quality[q].lights; });
})();
