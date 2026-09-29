// ===================================================================
// The bosses (round 2, G)
// -------------------------------------------------------------------
// Waves 5, 10, 15 and 20 end with a boss. Once the wave's own zombies are
// down (js/game.js checkWaveClear), one boss comes: picked at random from
// the ten, never one already met this run -- the four bosses of a level are
// always four different ones (Endless draws from a bag of all ten instead).
//
//   1. its cutscene (js/cutscene.js), exactly ten seconds: the game stands
//      still, nothing can hurt the player, anything left alive is gone, and
//      the player is moved to the arena
//   2. the fight, in the arena: at the school the football field, fenced
//      with an energy wall, and the building's doors sealed; the hospital
//      and the bunker have no outdoors, so there it is the great hall with
//      its doors sealed. The walls go when the boss dies.
//   3. its death (js/cutscene.js), then the one hard word, then the shop
//      (js/game.js afterBoss)
//
// Every boss has a basic swipe for anyone who comes too close, and one move
// of its own (ABIL below), always shown before it lands -- a red circle, a
// lane, a ring on the ground, a sound winding up -- and always with a way
// out:
//
//   gravedigger  Grave Slam      leaps at where you stand; step out of the
//                                red circle before he lands (55% of your
//                                health if not, never a kill from full)
//   eye          Searing Gaze    a red dot locks on at your feet and follows
//                                you at exactly walking pace (3.2 m/s,
//                                LASER_SPEED), then a beam burns along it:
//                                walk and it stays on you, sprint and it
//                                falls behind (every gun sprints faster)
//   headmaster   Deafening Roar  inside the ring you burn and slow down until
//                                the roar ends; be outside it when it starts
//   matron       Brood Call      zombies climb out of the ground round you --
//                                ordinary ones, shot by their words
//   coach        Bull Rush       a lane to the arena's edge, then he charges
//                                down it; step aside and he hits the wall
//                                and is stunned, taking extra damage
//   thorn        Root Ripple     rings of thorns roll out along the ground;
//                                jump each one, or be past where they end
//   storm        Forked Fury     blue circles, then lightning; a second,
//                                quicker volley follows the first
//   chemist      Acid Rain       flasks thrown where you are going; the
//                                acid stays on the ground for a while
//   void         Event Horizon   pulls you in, slower than you walk; the
//                                middle burns
//   examiner     Trick Question  splits into copies that throw paper blades;
//                                only one is real -- the copies are faintly
//                                see-through and have blue eyes
//
// A boss's health is set when it arrives: bigger for later waves and
// harder levels, and held between what the player's guns would take two
// and four minutes to wear down (hpFor), so a fight lasts about as long
// whatever the loadout. The first boss (wave 5) is a new player's first:
// its moves come less often and hit softer, rising to full by wave 20
// (late(); the slam keeps its full half-health blow at every wave).
// ===================================================================
(function () {
  const V3 = THREE.Vector3;

  G.BOSS_DEFS = [
    { id: "gravedigger", word: "relentless", ability: "slam", intro: "burst", speed: 2.3, reach: 3.4, every: 9.5, color: 0x9dff6a, voice: { f: 52, rough: 16, len: 1.8 } },
    { id: "eye", word: "omniscient", ability: "laser", intro: "descend", speed: 1.9, reach: 3.2, range: 11, every: 9, color: 0xffb028, voice: { f: 180, rough: 30, len: 1.4 } },
    { id: "headmaster", word: "tyrannical", ability: "roar", intro: "spotlight", speed: 2.1, reach: 3.5, every: 10.5, color: 0xff3a2a, voice: { f: 70, rough: 12, len: 2.2 } },
    { id: "matron", word: "prolific", ability: "summon", intro: "blackwater", speed: 2.0, reach: 3.8, range: 8, every: 11, color: 0xb25aff, voice: { f: 240, rough: 40, len: 1.2 } },
    { id: "coach", word: "indomitable", ability: "charge", intro: "wallcrash", speed: 2.5, reach: 3.4, every: 8.5, color: 0xff8a2a, voice: { f: 60, rough: 20, len: 1.4 } },
    { id: "thorn", word: "tenacious", ability: "roots", intro: "roots", speed: 1.7, reach: 3.8, every: 10, color: 0xffb03a, voice: { f: 44, rough: 8, len: 2.4 } },
    { id: "storm", word: "capricious", ability: "lightning", intro: "lightning", speed: 2.2, reach: 3.2, range: 10, every: 9.5, color: 0x7ad8ff, voice: { f: 120, rough: 50, len: 1.1 } },
    { id: "chemist", word: "malevolent", ability: "acid", intro: "fog", speed: 2.0, reach: 3.4, range: 10, every: 8.5, color: 0x8aff3a, voice: { f: 95, rough: 26, len: 1.3 } },
    { id: "void", word: "insatiable", ability: "vortex", intro: "portal", speed: 1.7, reach: 3.4, every: 11, color: 0xa24aff, voice: { f: 38, rough: 6, len: 2.6 } },
    { id: "examiner", word: "duplicitous", ability: "clones", intro: "papers", speed: 2.2, reach: 3.2, range: 9, every: 10.5, color: 0xff2a2a, voice: { f: 150, rough: 18, len: 1.2 } },
  ];
  G.BOSS_BY_ID = {};
  G.BOSS_DEFS.forEach((d) => { G.BOSS_BY_ID[d.id] = d; });

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ================================================================
  // Effects: every telegraph, beam, spark and chunk of a fight, pooled
  // ================================================================
  const DECAL_VS = [
    "uniform vec3 uS;",
    "varying vec2 vP;",
    "void main() {",
    "  vP = vec2(position.x * uS.x, position.y * uS.y + uS.z);",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}",
  ].join("\n");
  // one shader for every mark on the ground: 0 disc (edge, fill, a growing
  // centre that says when it lands), 1 ring, 2 wedge, 3 lane, 4 pool
  const DECAL_FS = [
    "uniform vec3 uColor; uniform float uMode; uniform float uR; uniform float uW; uniform float uProg;",
    "uniform float uOpacity; uniform float uTime; uniform float uHalf; uniform float uLen;",
    "varying vec2 vP;",
    "void main() {",
    "  float a = 0.0; float d = length(vP);",
    "  if (uMode < 0.5) {",
    "    if (d > uR) discard;",
    "    float edge = smoothstep(uR - uW, uR, d);",
    "    float pulse = 0.5 + 0.5 * sin(uTime * 9.0);",
    "    a = edge * (0.7 + 0.3 * pulse) + 0.13 + step(d, uR * uProg) * 0.22;",
    "  } else if (uMode < 1.5) {",
    "    float band = 1.0 - smoothstep(0.0, uW, abs(d - uR));",
    "    if (band <= 0.001) discard;",
    "    a = band;",
    "  } else if (uMode < 2.5) {",
    "    float ang = abs(atan(vP.x, vP.y));",
    "    if (d > uR || ang > uHalf) discard;",
    "    float edge = max(smoothstep(uR - uW, uR, d), smoothstep(uHalf - 0.1, uHalf, ang));",
    "    a = edge * 0.8 + 0.15 + step(d, uR * uProg) * 0.22;",
    "  } else if (uMode < 3.5) {",
    "    if (abs(vP.x) > uR || vP.y < 0.0 || vP.y > uLen) discard;",
    "    float edge = smoothstep(uR - uW, uR, abs(vP.x));",
    "    float chev = step(0.55, fract(vP.y * 0.35 - uTime * 1.6)) * 0.14;",
    "    a = edge * 0.8 + 0.12 + chev + step(vP.y, uLen * uProg) * 0.2;",
    "  } else {",
    "    float wob = uR * (1.0 + 0.06 * sin(atan(vP.y, vP.x) * 5.0 + uTime * 2.0));",
    "    if (d > wob) discard;",
    "    a = 0.8 * (1.0 - smoothstep(wob - uW, wob, d)) + 0.12 * sin(d * 6.0 - uTime * 4.0);",
    "  }",
    "  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0) * uOpacity);",
    "}",
  ].join("\n");
  const MODES = { disc: 0, ring: 1, sector: 2, lane: 3, blob: 4 };

  function roundTex() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  G.BossFX = {
    scene: null, floorY: 0, t: 0,
    init(scene, floorY) {
      if (this.scene === scene && this.debris) { this.floorY = floorY || 0; return; }
      this.reset();
      this.scene = scene; this.floorY = floorY || 0;
      this.decals = []; this.beams = []; this.bolts = []; this.flasks = []; this.blades = []; this.timers = [];
      this.dummy = new THREE.Object3D();
      // chunks: dirt, rubble, bark, the boss's own body when it breaks up
      const N = 220;
      this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
      this.debris.frustumCulled = false;
      this.debris.castShadow = false;
      this.dd = { n: N, p: new Float32Array(N * 3), v: new Float32Array(N * 3), r: new Float32Array(N * 3), w: new Float32Array(N * 3), s: new Float32Array(N), life: new Float32Array(N), max: new Float32Array(N), next: 0 };
      const c = new THREE.Color(0xffffff);
      for (let i = 0; i < N; i++) { this.debris.setColorAt(i, c); this.hideInst(this.debris, i); }
      this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(this.debris);
      // glowing motes: dust in a light, sparks, fog, the portal's pull
      const M = 700;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(M * 3).fill(-999), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(M * 3), 3));
      this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.34, map: roundTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      this.motes.frustumCulled = false;
      this.md = { n: M, v: new Float32Array(M * 3), c: new Float32Array(M * 3), life: new Float32Array(M), max: new Float32Array(M), drag: new Float32Array(M), grav: new Float32Array(M), next: 0, pull: null };
      scene.add(this.motes);
      // paper: the Examiner's storm and blades
      const P = 150;
      this.papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.46), new THREE.MeshLambertMaterial({ color: 0xf0ece0, side: THREE.DoubleSide }), P);
      this.papers.frustumCulled = false;
      this.pd = { n: P, p: new Float32Array(P * 3), v: new Float32Array(P * 3), r: new Float32Array(P * 3), w: new Float32Array(P * 3), life: new Float32Array(P), next: 0, swirl: null };
      for (let i = 0; i < P; i++) this.hideInst(this.papers, i);
      this.papers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(this.papers);
      // thorn spikes for the root rings and the rising roots (five slots of 90)
      const S = 450;
      const sg = new THREE.ConeGeometry(0.2, 1.2, 5); sg.translate(0, 0.6, 0);
      this.spikes = new THREE.InstancedMesh(sg, new THREE.MeshLambertMaterial({ color: 0x4a3a2a }), S);
      this.spikes.frustumCulled = false;
      for (let i = 0; i < S; i++) this.hideInst(this.spikes, i);
      this.spikes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(this.spikes);
    },
    reset() {
      if (!this.scene) return;
      const drop = (o) => { if (!o) return; if (o.parent) o.parent.remove(o); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }); };
      [this.debris, this.motes, this.papers, this.spikes].forEach(drop);
      (this.decals || []).forEach((d) => drop(d.pivot));
      (this.beams || []).forEach((b) => drop(b.group));
      (this.bolts || []).forEach((b) => drop(b.obj));
      (this.flasks || []).forEach((f) => drop(f.mesh));
      (this.blades || []).forEach((f) => drop(f.mesh));
      this.debris = this.motes = this.papers = this.spikes = null;
      this.decals = []; this.beams = []; this.bolts = []; this.flasks = []; this.blades = []; this.timers = [];
      this.scene = null;
    },
    hideInst(im, i) { this.dummy = this.dummy || new THREE.Object3D(); this.dummy.position.set(0, -999, 0); this.dummy.scale.setScalar(0.0001); this.dummy.updateMatrix(); im.setMatrixAt(i, this.dummy.matrix); },
    // everything that hangs about (marks, beams, projectiles) off the field
    clearTransient() {
      (this.decals || []).forEach((d) => d.hide());
      (this.beams || []).forEach((b) => b.hide());
      (this.flasks || []).forEach((f) => { f.on = false; f.mesh.visible = false; });
      (this.blades || []).forEach((f) => { f.on = false; f.mesh.visible = false; });
      this.timers = [];
      if (this.spikes) { for (let i = 0; i < this.spikes.count; i++) this.hideInst(this.spikes, i); this.spikes.instanceMatrix.needsUpdate = true; }
      if (this.pd) this.pd.swirl = null;
      if (this.md) this.md.pull = null;
    },
    later(sec, fn) { this.timers.push({ t: sec, fn }); },

    // ---- marks on the ground ----
    decal(o) {
      let d = this.decals.find((x) => !x.on && !!x.add === !!o.add);
      if (!d) {
        const u = {
          uColor: { value: new THREE.Color() }, uMode: { value: 0 }, uR: { value: 1 }, uW: { value: 0.3 }, uProg: { value: 0 },
          uOpacity: { value: 1 }, uTime: { value: 0 }, uHalf: { value: 1 }, uLen: { value: 1 }, uS: { value: new V3(1, 1, 0) },
        };
        const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: DECAL_VS, fragmentShader: DECAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
          blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.renderOrder = 6;
        mesh.frustumCulled = false;
        const pivot = new THREE.Object3D();
        pivot.add(mesh);
        this.scene.add(pivot);
        d = { pivot, mesh, u, on: false, add: !!o.add, o: {} };
        d.set = (p) => { Object.assign(d.o, p); this._applyDecal(d); return d; };
        d.hide = () => { d.on = false; d.pivot.visible = false; };
        this.decals.push(d);
      }
      d.on = true; d.pivot.visible = true;
      d.o = Object.assign({ x: 0, z: 0, y: this.floorY + 0.06, mode: "disc", r: 1, w: 0.3, prog: 0, color: 0xff2a1a, opacity: 1, yaw: 0, half: 0.9, len: 5, life: 0, age: 0 }, o);
      this._applyDecal(d);
      return d;
    },
    _applyDecal(d) {
      const o = d.o, u = d.u, m = MODES[o.mode] || 0;
      d.pivot.position.set(o.x, o.y !== undefined ? o.y : this.floorY + 0.06, o.z);
      d.pivot.rotation.y = o.yaw || 0;
      u.uMode.value = m; u.uR.value = o.r; u.uW.value = o.w; u.uProg.value = o.prog; u.uOpacity.value = o.opacity;
      u.uHalf.value = o.half; u.uLen.value = o.len;
      u.uColor.value.setHex(o.color);
      if (m === 3) { d.mesh.scale.set(o.r + 0.05, o.len / 2, 1); d.mesh.position.set(0, 0, o.len / 2); u.uS.value.set(o.r + 0.05, o.len / 2, o.len / 2); }
      else { const S = o.r + (m === 1 ? o.w : 0) + 0.3; d.mesh.scale.set(S, S, 1); d.mesh.position.set(0, 0, 0); u.uS.value.set(S, S, 0); }
    },
    // a ring that runs out from (x, z) and fades: a landing, a roar, a death
    shock(x, z, maxR, color, dur) {
      const d = this.decal({ mode: "ring", x, z, r: 0.5, w: 0.7, color, opacity: 0.9, add: true });
      d.o.shock = { maxR, dur: dur || 0.7, t: 0 };
      return d;
    },
    scorch(x, z, r, color, life) {
      const d = this.decal({ mode: "blob", x, z, r: r || 0.7, w: 0.35, color: color || 0x140a06, opacity: 0.8, y: this.floorY + 0.045 });
      d.o.life = life || 3; d.o.age = 0; d.o.fade = true;
      return d;
    },

    // ---- a beam (the gaze, a spotlight's core, a rising light) ----
    beam(color, glow) {
      let b = this.beams.find((x) => !x.on);
      if (!b) {
        const g = new THREE.Group();
        const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); geo.translate(0, 0.5, 0);
        const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff4a1a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        core.frustumCulled = outer.frustumCulled = false;
        g.add(core); g.add(outer);
        this.scene.add(g);
        b = { group: g, core, outer, on: false };
        b.set = (from, to, w) => {
          const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = Math.hypot(dx, dy, dz) || 0.001;
          g.position.copy(from);
          g.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(dx / len, dy / len, dz / len));
          core.scale.set(w, len, w); outer.scale.set(w * 3.2, len, w * 3.2);
        };
        b.hide = () => { b.on = false; g.visible = false; };
        this.beams.push(b);
      }
      b.on = true; b.group.visible = true;
      b.outer.material.color.setHex(color || 0xff4a1a);
      b.core.material.color.setHex(glow || 0xffffff);
      b.outer.material.opacity = 0.35; b.core.material.opacity = 0.95;
      return b;
    },

    // ---- lightning: a jagged line from the sky, gone in a moment ----
    bolt(from, to, color) {
      let bo = this.bolts.find((x) => !x.on);
      const SEG = 14, COPIES = 3;
      if (!bo) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SEG * 2 * 3 * COPIES), 3));
        const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xdff4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        obj.frustumCulled = false;
        const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        core.frustumCulled = false;
        obj.add(core);
        this.scene.add(obj);
        bo = { obj, geo, core, on: false, t: 0 };
        this.bolts.push(bo);
      }
      bo.on = true; bo.t = 0; bo.obj.visible = true;
      bo.obj.material.color.setHex(color || 0xdff4ff);
      const a = bo.geo.attributes.position.array;
      let k = 0;
      for (let c = 0; c < COPIES; c++) {
        let px = from.x, py = from.y, pz = from.z;
        for (let i = 1; i <= SEG; i++) {
          const f = i / SEG, j = i === SEG ? 0 : (1 - f * 0.6) * (c ? 1.2 : 0.9);
          const nx = from.x + (to.x - from.x) * f + (Math.random() - 0.5) * j, ny = from.y + (to.y - from.y) * f, nz = from.z + (to.z - from.z) * f + (Math.random() - 0.5) * j;
          a[k++] = px; a[k++] = py; a[k++] = pz; a[k++] = nx; a[k++] = ny; a[k++] = nz;
          px = nx; py = ny; pz = nz;
        }
      }
      bo.geo.attributes.position.needsUpdate = true;
      bo.obj.position.set(0, 0, 0);
      const len = from.distanceTo(to);
      bo.core.position.copy(from);
      bo.core.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(to, from).normalize());
      bo.core.scale.set(0.09, len, 0.09);
      return bo;
    },

    // ---- things thrown: acid flasks, paper blades ----
    flask(from, to, flight, arc, onLand) {
      let f = this.flasks.find((x) => !x.on);
      if (!f) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.42, 8), new THREE.MeshBasicMaterial({ color: 0x8aff3a }));
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        f = { mesh, on: false };
        this.flasks.push(f);
      }
      Object.assign(f, { on: true, from: from.clone(), to: to.clone(), t: 0, flight, arc, onLand });
      f.mesh.visible = true;
      f.mesh.position.copy(from);
      return f;
    },
    blade(from, dir, speed, onStep) {
      let f = this.blades.find((x) => !x.on);
      if (!f) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff6e8 }));
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        f = { mesh, on: false };
        this.blades.push(f);
      }
      Object.assign(f, { on: true, pos: from.clone(), dir: dir.clone(), speed, t: 0, onStep });
      f.mesh.visible = true;
      return f;
    },

    // ---- particles ----
    chunk(x, y, z, vx, vy, vz, size, color, life) {
      const D = this.dd;
      if (!D) return;
      const i = D.next; D.next = (D.next + 1) % D.n;
      D.p[i * 3] = x; D.p[i * 3 + 1] = y; D.p[i * 3 + 2] = z;
      D.v[i * 3] = vx; D.v[i * 3 + 1] = vy; D.v[i * 3 + 2] = vz;
      D.r[i * 3] = Math.random() * 6; D.r[i * 3 + 1] = Math.random() * 6; D.r[i * 3 + 2] = Math.random() * 6;
      D.w[i * 3] = (Math.random() - 0.5) * 10; D.w[i * 3 + 1] = (Math.random() - 0.5) * 10; D.w[i * 3 + 2] = (Math.random() - 0.5) * 10;
      D.s[i] = size; D.life[i] = life || 2.2; D.max[i] = D.life[i];
      this.debris.setColorAt(i, this._c || (this._c = new THREE.Color()).setHex(color));
      this.debris.instanceColor.needsUpdate = true;
    },
    burst(x, y, z, n, color, spd, size, up) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
        this.chunk(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.6,
          Math.cos(a) * s, (up || 4) * (0.5 + Math.random()), Math.sin(a) * s, size * (0.5 + Math.random() * 0.8), color, 1.6 + Math.random());
      }
    },
    mote(x, y, z, vx, vy, vz, color, life, drag, grav) {
      const D = this.md;
      if (!D) return;
      const i = D.next; D.next = (D.next + 1) % D.n;
      const p = this.motes.geometry.attributes.position.array;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      D.v[i * 3] = vx; D.v[i * 3 + 1] = vy; D.v[i * 3 + 2] = vz;
      const c = this._c2 || (this._c2 = new THREE.Color());
      c.setHex(color);
      D.c[i * 3] = c.r; D.c[i * 3 + 1] = c.g; D.c[i * 3 + 2] = c.b;
      D.life[i] = life; D.max[i] = life; D.drag[i] = drag || 0; D.grav[i] = grav || 0;
    },
    sparks(x, y, z, n, color, spd) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2, s = spd * (0.3 + Math.random());
        this.mote(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 1, Math.sin(a) * Math.cos(e) * s, color, 0.4 + Math.random() * 0.6, 1.5, -6);
      }
    },
    paper(x, y, z, vx, vy, vz, life) {
      const D = this.pd;
      if (!D) return;
      const i = D.next; D.next = (D.next + 1) % D.n;
      D.p[i * 3] = x; D.p[i * 3 + 1] = y; D.p[i * 3 + 2] = z;
      D.v[i * 3] = vx; D.v[i * 3 + 1] = vy; D.v[i * 3 + 2] = vz;
      for (let k = 0; k < 3; k++) { D.r[i * 3 + k] = Math.random() * 6; D.w[i * 3 + k] = (Math.random() - 0.5) * 8; }
      D.life[i] = life || 3;
    },
    // a ring of thorns at radius r round (x, z), in slot `slot` (0-3) of the spike pool
    spikeRing(slot, x, z, r, h, n) {
      const S = this.spikes; if (!S) return;
      const per = 90, base = slot * per, dm = this.dummy;
      n = Math.min(per, n || per);
      for (let i = 0; i < per; i++) {
        if (i >= n || r <= 0) { this.hideInst(S, base + i); continue; }
        const a = (i / n) * Math.PI * 2 + slot * 0.37;
        const jr = r + Math.sin(i * 7.3 + slot) * 0.25;
        dm.position.set(x + Math.cos(a) * jr, this.floorY, z + Math.sin(a) * jr);
        dm.rotation.set(Math.sin(i * 3.1) * 0.35, a, Math.cos(i * 2.3) * 0.35);
        const s = h * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7 + slot)));
        dm.scale.set(1, s, 1);
        dm.updateMatrix();
        S.setMatrixAt(base + i, dm.matrix);
      }
      S.instanceMatrix.needsUpdate = true;
    },
    // one spike, for the cutscenes' roots (slot 3 and up by index)
    spike(i, x, y, z, rx, ry, rz, sx, sy) {
      const S = this.spikes; if (!S || i >= S.count) return;
      const dm = this.dummy;
      dm.position.set(x, y, z); dm.rotation.set(rx, ry, rz); dm.scale.set(sx, sy, sx); dm.updateMatrix();
      S.setMatrixAt(i, dm.matrix);
      S.instanceMatrix.needsUpdate = true;
    },

    update(dt) {
      if (!this.scene) return;
      this.t += dt;
      const t = this.t;
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
      }
      for (const d of this.decals) {
        if (!d.on) continue;
        d.u.uTime.value = t;
        const o = d.o;
        if (o.shock) {
          o.shock.t += dt;
          const k = o.shock.t / o.shock.dur;
          if (k >= 1) { d.hide(); delete o.shock; continue; }
          o.r = 0.5 + (o.shock.maxR - 0.5) * (1 - Math.pow(1 - k, 2));
          o.opacity = 0.9 * (1 - k);
          this._applyDecal(d);
        }
        if (o.fade) {
          o.age += dt;
          if (o.age >= o.life) { d.hide(); o.fade = false; continue; }
          d.u.uOpacity.value = o.opacity * Math.min(1, (o.life - o.age) / Math.min(1, o.life * 0.4));
        }
      }
      for (const b of this.bolts) {
        if (!b.on) continue;
        b.t += dt;
        const k = b.t / 0.35;
        b.obj.material.opacity = Math.max(0, 1 - k) * (Math.random() < 0.3 ? 0.4 : 1);
        b.core.material.opacity = Math.max(0, 1 - k * 1.3);
        if (k >= 1) { b.on = false; b.obj.visible = false; }
      }
      for (const f of this.flasks) {
        if (!f.on) continue;
        f.t += dt;
        const k = Math.min(1, f.t / f.flight);
        f.mesh.position.lerpVectors(f.from, f.to, k);
        f.mesh.position.y += Math.sin(k * Math.PI) * f.arc;
        f.mesh.rotation.x += dt * 9; f.mesh.rotation.z += dt * 5;
        if (Math.random() < 0.5) this.mote(f.mesh.position.x, f.mesh.position.y, f.mesh.position.z, 0, 0.3, 0, 0x6aff2a, 0.4, 1, 0);
        if (k >= 1) { f.on = false; f.mesh.visible = false; f.onLand && f.onLand(f.to); }
      }
      for (const f of this.blades) {
        if (!f.on) continue;
        f.t += dt;
        f.pos.addScaledVector(f.dir, f.speed * dt);
        f.mesh.position.copy(f.pos);
        f.mesh.rotation.y += dt * 18;
        if (f.onStep && f.onStep(f) === false || f.t > 3.5) { f.on = false; f.mesh.visible = false; }
      }
      // chunks
      const D = this.dd, dm = this.dummy;
      if (D) {
        let any = false;
        for (let i = 0; i < D.n; i++) {
          if (D.life[i] <= 0) continue;
          any = true;
          D.life[i] -= dt;
          if (D.life[i] <= 0) { this.hideInst(this.debris, i); continue; }
          const j = i * 3;
          D.v[j + 1] -= 14 * dt;
          D.p[j] += D.v[j] * dt; D.p[j + 1] += D.v[j + 1] * dt; D.p[j + 2] += D.v[j + 2] * dt;
          const half = D.s[i] * 0.5;
          if (D.p[j + 1] < this.floorY + half) {
            D.p[j + 1] = this.floorY + half;
            D.v[j + 1] = Math.abs(D.v[j + 1]) * 0.28;
            D.v[j] *= 0.6; D.v[j + 2] *= 0.6; D.w[j] *= 0.5; D.w[j + 1] *= 0.5; D.w[j + 2] *= 0.5;
          }
          D.r[j] += D.w[j] * dt; D.r[j + 1] += D.w[j + 1] * dt; D.r[j + 2] += D.w[j + 2] * dt;
          const k = Math.min(1, D.life[i] / (D.max[i] * 0.3));
          dm.position.set(D.p[j], D.p[j + 1], D.p[j + 2]);
          dm.rotation.set(D.r[j], D.r[j + 1], D.r[j + 2]);
          dm.scale.setScalar(Math.max(0.0001, D.s[i] * k));
          dm.updateMatrix();
          this.debris.setMatrixAt(i, dm.matrix);
        }
        if (any) this.debris.instanceMatrix.needsUpdate = true;
      }
      // motes
      const Mo = this.md;
      if (Mo) {
        const p = this.motes.geometry.attributes.position.array, col = this.motes.geometry.attributes.color.array;
        const pull = Mo.pull;
        for (let i = 0; i < Mo.n; i++) {
          if (Mo.life[i] <= 0) continue;
          Mo.life[i] -= dt;
          const j = i * 3;
          if (Mo.life[i] <= 0) { p[j + 1] = -999; continue; }
          if (pull) {
            const dx = pull.x - p[j], dz = pull.z - p[j + 2], dy = (pull.y || 0) - p[j + 1], d = Math.hypot(dx, dz) + 0.3;
            Mo.v[j] += (dx / d * pull.k - dz / d * pull.swirl) * dt;
            Mo.v[j + 2] += (dz / d * pull.k + dx / d * pull.swirl) * dt;
            Mo.v[j + 1] += dy * (pull.ky || 0) * dt;
          }
          const dr = Math.max(0, 1 - Mo.drag[i] * dt);
          Mo.v[j] *= dr; Mo.v[j + 1] = Mo.v[j + 1] * dr + Mo.grav[i] * dt; Mo.v[j + 2] *= dr;
          p[j] += Mo.v[j] * dt; p[j + 1] += Mo.v[j + 1] * dt; p[j + 2] += Mo.v[j + 2] * dt;
          const k = Math.min(1, Mo.life[i] / (Mo.max[i] * 0.5));
          col[j] = Mo.c[j] * k; col[j + 1] = Mo.c[j + 1] * k; col[j + 2] = Mo.c[j + 2] * k;
        }
        this.motes.geometry.attributes.position.needsUpdate = true;
        this.motes.geometry.attributes.color.needsUpdate = true;
      }
      // paper
      const Pd = this.pd;
      if (Pd) {
        const sw = Pd.swirl;
        for (let i = 0; i < Pd.n; i++) {
          if (Pd.life[i] <= 0) continue;
          Pd.life[i] -= dt;
          if (Pd.life[i] <= 0) { this.hideInst(this.papers, i); continue; }
          const j = i * 3;
          if (sw) {
            const dx = Pd.p[j] - sw.x, dz = Pd.p[j + 2] - sw.z, d = Math.hypot(dx, dz) + 0.01;
            const tx = -dz / d, tz = dx / d;
            const want = sw.r + Math.sin(i * 1.3) * 0.6 + (Pd.p[j + 1] - this.floorY) * (sw.flare || 0.15);
            Pd.v[j] = tx * sw.spin + (dx / d) * (want - d) * 2;
            Pd.v[j + 2] = tz * sw.spin + (dz / d) * (want - d) * 2;
            Pd.v[j + 1] += (sw.up - Pd.v[j + 1]) * Math.min(1, dt * 2) + (Pd.p[j + 1] > this.floorY + sw.top ? -3 : 0) * dt;
          } else {
            Pd.v[j] *= Math.max(0, 1 - dt * 1.2); Pd.v[j + 2] *= Math.max(0, 1 - dt * 1.2);
            Pd.v[j + 1] = Math.max(-1.2, Pd.v[j + 1] - 4 * dt);
            Pd.v[j] += Math.sin(t * 3 + i) * 0.8 * dt;
          }
          Pd.p[j] += Pd.v[j] * dt; Pd.p[j + 1] += Pd.v[j + 1] * dt; Pd.p[j + 2] += Pd.v[j + 2] * dt;
          if (Pd.p[j + 1] < this.floorY + 0.02) { Pd.p[j + 1] = this.floorY + 0.02; Pd.v[j + 1] = 0; Pd.w[j] *= 0.9; Pd.w[j + 2] *= 0.9; }
          Pd.r[j] += Pd.w[j] * dt; Pd.r[j + 1] += Pd.w[j + 1] * dt; Pd.r[j + 2] += Pd.w[j + 2] * dt;
          dm.position.set(Pd.p[j], Pd.p[j + 1], Pd.p[j + 2]);
          dm.rotation.set(Pd.r[j], Pd.r[j + 1], Pd.r[j + 2]);
          dm.scale.setScalar(Math.min(1, Pd.life[i] * 2));
          dm.updateMatrix();
          this.papers.setMatrixAt(i, dm.matrix);
        }
        this.papers.instanceMatrix.needsUpdate = true;
      }
    },
  };
  const FX = G.BossFX;

  // ================================================================
  // The arena
  // ================================================================
  const WALL_VS = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  const WALL_FS = [
    "uniform float uTime; uniform float uFade; uniform vec3 uColor; uniform vec2 uSize;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec2 p = vUv * uSize;",
    "  vec2 q = vec2(p.x * 1.15 + (mod(floor(p.y * 1.4), 2.0)) * 0.5, p.y * 1.4 + uTime * 0.25);",
    "  vec2 g = abs(fract(q) - 0.5);",
    "  float line = smoothstep(0.42, 0.5, max(g.x, g.y));",
    "  float scan = 1.0 - smoothstep(0.0, 0.06, abs(fract(vUv.y * 1.5 - uTime * 0.5) - 0.5));",
    "  float base = 0.1 + 0.3 * (1.0 - vUv.y);",
    "  float rim = smoothstep(0.92, 1.0, vUv.y) * 0.7 + smoothstep(0.08, 0.0, vUv.y) * 0.5;",
    "  float flick = 0.9 + 0.1 * sin(uTime * 23.0 + p.x);",
    "  float a = (base + line * 0.45 + scan * 0.35 + rim) * flick * uFade;",
    "  gl_FragColor = vec4(uColor * (0.7 + line * 0.8 + scan), a);",
    "}",
  ].join("\n");

  G.Arena = {
    walls: [], cols: [], fade: 0, state: null,
    // where the fight is: its bounds, where the boss and the player stand,
    // the wall a boss can burst through, and which doorways to seal
    plan(game) {
      const w = game.world;
      if (w.pitch && w.campus && w.footprint) {
        const p = w.pitch, fp = w.footprint[0];
        const rect = { minX: p.minX + 0.4, maxX: p.maxX + 1.6, minZ: p.minZ + 1.0, maxZ: p.maxZ - 1.0 };
        const cx = (rect.minX + rect.maxX) / 2;
        const bz = -41, pz = -20;
        return {
          kind: "field", rect, floorY: 0, ceiling: 80, fit: 1,
          boss: new V3(cx, 0, bz), player: new V3(cx, 0, pz), center: new V3(cx, 0, (rect.minZ + rect.maxZ) / 2),
          wall: { x: fp.minX - 0.1, z: clamp(bz, fp.minZ + 4, fp.maxZ - 4), nx: -1, nz: 0, color: 0xd2cbb8 },
          fence: true,
          seals: [{ x: 0, z: fp.maxZ + 0.4, w: 7.0, h: 3.4, axis: "x" }],
        };
      }
      const hall = (w.regions || []).find((r) => r.name === "BOSS");
      const R = hall || { minX: -15, maxX: 15, minZ: -58, maxZ: -43 };
      const rect = { minX: R.minX + 0.9, maxX: R.maxX - 0.9, minZ: R.minZ + 0.9, maxZ: R.maxZ - 0.9 };
      const cx = (rect.minX + rect.maxX) / 2, floorY = R.y || 0;
      const free = (x, z) => !G.ColGrid.near(w, x, z, 1.8, []).some((c) => c.min.y < floorY + 2 && c.max.y > floorY + 0.2 && x + 1.6 > c.min.x && x - 1.6 < c.max.x && z + 1.6 > c.min.z && z - 1.6 < c.max.z);
      // both to one side of the hall: the bunker's reactor stands in its
      // middle, and neither should start the fight behind it
      const side = cx - (rect.maxX - rect.minX) * 0.28;
      const cands = [[side, rect.minZ + 3.5], [side, rect.minZ + 5.5], [cx, rect.minZ + 3.5], [cx + 7, rect.minZ + 3.5]];
      const bp = cands.find(([x, z]) => free(x, z)) || cands[0];
      return {
        kind: "hall", rect, floorY, ceiling: floorY + 8.2, fit: 0.62,
        boss: new V3(bp[0], floorY, bp[1]), player: new V3(bp[0], floorY, rect.maxZ - 2.5), center: new V3(cx, floorY, (rect.minZ + rect.maxZ) / 2),
        wall: { x: bp[0], z: R.minZ + 0.1, nx: 0, nz: 1, color: 0x6a6a64 },
        fence: false,
        seals: [{ x: 0, z: R.maxZ - 0.3, w: 7.0, h: 3.4, axis: "x" }],
      };
    },
    // the energy walls go up: the field's fence and every doorway sealed
    seal(game, A) {
      this.unseal(game, true);
      const world = game.world, scene = game.scene;
      const add = (x, z, len, h, axis) => {
        const u = { uTime: { value: 0 }, uFade: { value: 0 }, uColor: { value: new THREE.Color(0x3ad0ff) }, uSize: { value: new THREE.Vector2(len, h) } };
        const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: WALL_VS, fragmentShader: WALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), mat);
        m.position.set(x, A.floorY + h / 2, z);
        if (axis === "z") m.rotation.y = Math.PI / 2;
        m.renderOrder = 7;
        m.frustumCulled = false;
        scene.add(m);
        this.walls.push({ mesh: m, u });
        const t = 0.25;
        const box = axis === "x"
          ? new THREE.Box3(new V3(x - len / 2, A.floorY - 0.5, z - t), new V3(x + len / 2, A.floorY + h + 2, z + t))
          : new THREE.Box3(new V3(x - t, A.floorY - 0.5, z - len / 2), new V3(x + t, A.floorY + h + 2, z + len / 2));
        this.cols.push(G.ColGrid.add(world, box));
      };
      const r = A.rect;
      if (A.fence) {
        const H = 3.6, W = r.maxX - r.minX, D = r.maxZ - r.minZ, cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
        add(cx, r.minZ - 0.3, W + 0.6, H, "x"); add(cx, r.maxZ + 0.3, W + 0.6, H, "x");
        add(r.minX - 0.3, cz, D + 0.6, H, "z"); add(r.maxX + 0.3, cz, D + 0.6, H, "z");
        // a glowing post at each corner
        [[r.minX - 0.3, r.minZ - 0.3], [r.maxX + 0.3, r.minZ - 0.3], [r.minX - 0.3, r.maxZ + 0.3], [r.maxX + 0.3, r.maxZ + 0.3]].forEach(([x, z]) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, H + 0.6, 8), new THREE.MeshBasicMaterial({ color: 0x9ae8ff }));
          post.position.set(x, A.floorY + (H + 0.6) / 2, z);
          scene.add(post);
          this.walls.push({ mesh: post, post: true });
        });
      }
      (A.seals || []).forEach((s) => add(s.x, s.z, s.w, s.h, s.axis));
      this.fade = 0; this.state = "up";
      if (G.Audio) G.Audio.boss("seal", {});
    },
    unseal(game, now) {
      this.cols.forEach((c) => G.ColGrid.remove(game.world, c));
      this.cols = [];
      if (now || !this.walls.length) { this.drop(); return; }
      this.state = "down";
      if (G.Audio) G.Audio.boss("unseal", {});
    },
    drop() {
      this.walls.forEach((w) => { if (w.mesh.parent) w.mesh.parent.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); });
      this.walls = []; this.state = null;
    },
    update(dt) {
      if (!this.walls.length) return;
      if (this.state === "up") this.fade = Math.min(1, this.fade + dt * 1.6);
      else if (this.state === "down") { this.fade -= dt * 1.4; if (this.fade <= 0) { this.drop(); return; } }
      const t = performance.now() / 1000;
      this.walls.forEach((w) => {
        if (w.u) { w.u.uTime.value = t; w.u.uFade.value = this.fade * (this.state === "down" ? (Math.random() < 0.3 ? 0.3 : 1) : 1); }
        else if (w.post) w.mesh.visible = this.fade > 0.05;
      });
    },
    reset(game) { if (game && game.world) this.unseal(game, true); else { this.drop(); this.cols = []; } },
  };

  // ================================================================
  // Moves: each returns an "act" the boss runs until update() says done
  // ================================================================
  const tmpV = new V3(), tmpV2 = new V3();
  const feetOf = (game) => game.yawObject.position.y - 1.7;
  const airborne = (game) => {
    const P = game.yawObject.position;
    return (P.y - 1.7) - G.getFloorHeightAt(game.world, P.x, P.z, P.y - 1.7) > 0.25;
  };
  const inRect = (A, x, z, pad) => ({ x: clamp(x, A.rect.minX + pad, A.rect.maxX - pad), z: clamp(z, A.rect.minZ + pad, A.rect.maxZ - pad) });

  const ABIL = {};

  // the one move every boss has: a swipe at anyone standing too close
  function swipe(M, game, b) {
    const P = game.yawObject.position, wind = b.enraged ? 0.5 : 0.65, reach = b.def.reach + b.rig.R;
    let t = 0, struck = false;
    const tel = FX.decal({ mode: "sector", x: b.pos.x, z: b.pos.z, r: reach + 0.3, half: 1.05, w: 0.3, color: 0xff3a1a, opacity: 0.85, yaw: b.root.rotation.y });
    b.dangers = [{ kind: "sector", x: b.pos.x, z: b.pos.z, r: reach + 0.3, yaw: b.root.rotation.y, half: 1.05, at: wind }];
    G.Audio.boss("swipe_wind", { pos: b.pos, voice: b.def.voice });
    return {
      update(dt) {
        t += dt;
        if (!struck) {
          b.pose.armR = [-2.6, -0.5]; b.pose.torso = (b.rig.rest.torso || 0) - 0.12;
          tel.set({ x: b.pos.x, z: b.pos.z, yaw: b.root.rotation.y, prog: t / wind });
          b.dangers[0].yaw = b.root.rotation.y; b.dangers[0].x = b.pos.x; b.dangers[0].z = b.pos.z;
          if (t >= wind) {
            struck = true; tel.hide(); b.dangers = [];
            b.pose.armR = [-0.9, 0.9]; b.pose.torso = (b.rig.rest.torso || 0) + 0.25;
            G.Audio.boss("swipe", { pos: b.pos });
            const dx = P.x - b.pos.x, dz = P.z - b.pos.z, d = Math.hypot(dx, dz);
            let ang = Math.atan2(dx, dz) - b.root.rotation.y;
            ang = Math.atan2(Math.sin(ang), Math.cos(ang));
            if (d < reach + 0.5 && Math.abs(ang) < 1.15 && feetOf(game) < M.arena.floorY + 3) {
              M.hurt(game, 0.13, { push: { x: b.pos.x, z: b.pos.z, d: 2.2 }, src: "swipe" });
            } else M.stats.dodged++;
          }
        }
        if (t >= wind + 0.75) { b.swipeCd = (b.enraged ? 1.6 : 2.2) * (1.35 - 0.35 * M.late(game)); b.pose = {}; return true; }
        return false;
      },
      end() { tel.hide(); b.dangers = []; },
    };
  }

  // Grave Slam: up, over, down where you were standing
  ABIL.slam = function (M, game, b) {
    // (a walk out of it from the centre fits in the warning after a normal
    // reaction: 1.5 s x 3.2 m/s > 3.8 m + the body; a heavy gun needs a sprint)
    const P = game.yawObject.position, A = M.arena, R = 3.8, crouch = 0.6, air = 1.4;
    let t = 0, landed = false, left = b.enraged ? 2 : 1, tel = null, sx = 0, sz = 0, tx = 0, tz = 0;
    const aim = () => {
      const p = inRect(A, P.x, P.z, b.rig.R);
      tx = p.x; tz = p.z; sx = b.pos.x; sz = b.pos.z;
      tel = FX.decal({ mode: "disc", x: tx, z: tz, r: R, w: 0.4, color: 0xff2a1a, opacity: 0.95, prog: 0 });
      b.dangers = [{ kind: "circle", x: tx, z: tz, r: R, at: crouch + air }];
      G.Audio.boss("slam_wind", { pos: b.pos, voice: b.def.voice });
    };
    aim();
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        const tot = crouch + air;
        if (tel && tel.on) tel.set({ prog: Math.min(1, t / tot) });
        if (b.dangers[0]) b.dangers[0].at = Math.max(0, tot - t);
        if (t < crouch) {
          b.pose.torso = 0.55; b.pose.armL = [-2.7, 0.4]; b.pose.armR = [-2.7, -0.4];
          b.squat = 0.45 * (t / crouch);
          M.face(b, tx, tz, dt * 6);
        } else if (t < tot) {
          const k = (t - crouch) / air;
          b.squat = 0;
          b.pos.x = sx + (tx - sx) * k; b.pos.z = sz + (tz - sz) * k;
          b.pos.y = A.floorY + Math.sin(k * Math.PI) * 7;
          b.pose.torso = -0.1; b.pose.armL = [-2.9, 0.6]; b.pose.armR = [-2.9, -0.6];
        } else if (!landed) {
          landed = true; b.pos.y = A.floorY; b.squat = 0.35;
          b.pose.torso = 0.7; b.pose.armL = [-0.3, 0.5]; b.pose.armR = [-0.3, -0.5];
          if (tel) tel.hide();
          b.dangers = [];
          FX.shock(tx, tz, R + 3, 0xff8a4a, 0.6);
          FX.burst(tx, A.floorY + 0.2, tz, 26, 0x4a3a28, 6, 0.35, 6);
          FX.sparks(tx, A.floorY + 0.3, tz, 30, 0xffc080, 6);
          FX.scorch(tx, tz, 3.2, 0x1a120c, 5);
          G.Audio.boss("slam", { pos: b.pos });
          G.Perf.flash(new V3(tx, A.floorY + 1, tz), 0xffaa66, 3, 12, 120);
          game.shake(0.12, 0.45);
          const d = Math.hypot(P.x - tx, P.z - tz);
          if (d < R + 0.3 && feetOf(game) < A.floorY + 1.5) {
            M.hurt(game, M.SLAM_FRAC, { notLethalFromFull: true, push: { x: tx, z: tz, d: 3 }, src: "slam" });
            M.stats.slamHits++;
          } else M.stats.dodged++;
        } else if (t >= tot + 0.9) {
          b.squat = 0;
          if (--left > 0) { t = 0; landed = false; aim(); return false; }
          b.pose = {};
          return true;
        }
        return false;
      },
      end() { if (tel) tel.hide(); b.pos.y = A.floorY; b.squat = 0; b.dangers = []; b.pose = {}; },
    };
  };

  // Searing Gaze: a red dot locks on at the player's feet and hunts them at
  // exactly walking pace; after the charge a beam burns along it. Walking,
  // it stays on you; sprinting (any gun: G.Bosses.laserCheck) pulls away.
  ABIL.laser = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, charge = 1.3, dur = b.enraged ? 4 : 3, R = 1.1;
    let t = 0, firing = false, loop = null, scorchT = 0;
    // a metre short of the player, on the boss's side: inside the burn (R +
    // the player's 0.3) for anyone who only walks, clear at once for anyone
    // who sprints -- even with the heaviest gun, whose stamina then lasts
    // until the gaze is over
    const tb = Math.hypot(b.pos.x - P.x, b.pos.z - P.z) || 1;
    const spot = new V3(P.x + (b.pos.x - P.x) / tb, A.floorY, P.z + (b.pos.z - P.z) / tb);
    const mark = FX.decal({ mode: "disc", x: spot.x, z: spot.z, r: R, w: 0.3, color: 0xff3a1a, prog: 0 });
    const beam = FX.beam(0xff3a1a, 0xfff0d0);
    beam.outer.material.opacity = 0.12; beam.core.material.opacity = 0.35;
    b.charging = true;
    G.Audio.boss("laser_charge", { pos: b.pos });
    b.dangers = [{ kind: "laser", x: spot.x, z: spot.z, r: R, at: charge, speed: M.LASER_SPEED }];
    return {
      update(dt) {
        t += dt;
        // after the player's feet, never faster than a walk
        const ex = P.x - spot.x, ez = P.z - spot.z, e = Math.hypot(ex, ez);
        const step = Math.min(e, M.LASER_SPEED * dt);
        if (e > 1e-4) { spot.x += ex / e * step; spot.z += ez / e * step; }
        const q = inRect(A, spot.x, spot.z, 0.3); spot.x = q.x; spot.z = q.z;
        mark.set({ x: spot.x, z: spot.z, prog: Math.min(1, t / charge) });
        b.rig.eye.getWorldPosition(tmpV);
        tmpV2.set(spot.x, A.floorY + 0.05, spot.z);
        if (!firing) {
          // a thin aiming line while the eye charges
          beam.set(tmpV, tmpV2, 0.015 + 0.02 * (t / charge));
          if (b.rig.lidOpen) b.rig.lidOpen(1 + t / charge * 0.3);
          b.dangers = [{ kind: "laser", x: spot.x, z: spot.z, r: R, at: charge - t, speed: M.LASER_SPEED }];
          if (t >= charge) {
            firing = true;
            beam.outer.material.opacity = 0.35; beam.core.material.opacity = 0.95;
            loop = G.Audio.bossLoop("beam", { pos: b.pos });
          }
          return false;
        }
        beam.set(tmpV, tmpV2, 0.13);
        if ((scorchT -= dt) <= 0) { scorchT = 0.15; FX.scorch(spot.x, spot.z, 0.7, 0x1a0a04, 3.5); }
        if (Math.random() < 0.8) FX.sparks(spot.x, A.floorY + 0.1, spot.z, 2, 0xffa050, 4);
        G.Perf.flash(tmpV2, 0xff5a2a, 2.4, 7, 60);
        b.dangers = [{ kind: "laser", x: spot.x, z: spot.z, r: R, at: 0, speed: M.LASER_SPEED }];
        if (Math.hypot(P.x - spot.x, P.z - spot.z) < R + 0.3 && feetOf(game) < A.floorY + 1.6) { M.dot(game, 0.11, dt, "laser"); this.hit = true; }
        return t >= charge + dur;
      },
      end() { mark.hide(); beam.hide(); if (loop) loop.stop(); b.charging = false; b.dangers = []; if (b.rig.lidOpen) b.rig.lidOpen(1); if (!this.hit) M.stats.dodged++; },
    };
  };

  // Deafening Roar: a ring round him; inside it you burn and slow down
  ABIL.roar = function (M, game, b) {
    const P = game.yawObject.position, R = 8.5, wind = 1.4, dur = 4;
    let t = 0, roaring = false, loop = null, caught = false, waveT = 0;
    const cx = b.pos.x, cz = b.pos.z;
    const zone = FX.decal({ mode: "disc", x: cx, z: cz, r: R, w: 0.55, color: 0xff3020, opacity: 0.8, prog: 0 });
    G.Audio.boss("roar_wind", { pos: b.pos, voice: b.def.voice });
    b.dangers = [{ kind: "roar", x: cx, z: cz, r: R, at: wind }];
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        if (!roaring) {
          b.pose.torso = -0.3; b.pose.head = -0.35; b.pose.armL = [-0.7, 1.0]; b.pose.armR = [-0.7, -1.0];
          b.chest = 0.12 * (t / wind);
          zone.set({ prog: t / wind });
          b.dangers[0].at = wind - t;
          if (t >= wind) { roaring = true; b.chest = 0; loop = G.Audio.bossLoop("roar", { pos: b.pos, voice: b.def.voice }); }
          return false;
        }
        b.pose.torso = 0.25; b.pose.head = 0.1; b.pose.armL = [-0.3, 0.7]; b.pose.armR = [-0.3, -0.7];
        if (b.rig.jawOpen) b.rig.jawOpen(0.9 + Math.random() * 0.1);
        zone.set({ prog: 1 });
        if ((waveT -= dt) <= 0) { waveT = 0.4; FX.shock(cx, cz, R, 0xff7a5a, 0.55); }
        game.shake(0.035, 0.1);
        b.dangers = [{ kind: "roar", x: cx, z: cz, r: R, at: 0 }];
        if (Math.hypot(P.x - cx, P.z - cz) < R) { caught = true; M.dot(game, 0.07, dt, "roar"); }
        game.bossSlow = caught ? 0.5 : 1;
        return t >= wind + dur;
      },
      end() {
        zone.hide(); if (loop) loop.stop(); game.bossSlow = 1; b.chest = 0;
        if (b.rig.jawOpen) b.rig.jawOpen(0);
        if (!caught) M.stats.dodged++;
        b.dangers = []; b.pose = {};
      },
    };
  };

  // Brood Call: ordinary zombies climb out of the ground round the player
  ABIL.summon = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, wind = 1.5;
    const alive = game.zombies.filter((z) => z.alive).length;
    const want = [3, 4, 5, 6][clamp(Math.round(game.wave / 5) - 1, 0, 3)] + (b.enraged ? 1 : 0);
    const n = Math.max(0, Math.min(want, M.MAX_MINIONS - alive));
    const spots = [];
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / Math.max(1, n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, r = 6 + Math.random() * 3;
      const p = inRect(A, P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 1.2);
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.rig.R + 1.5) continue;
      spots.push(p);
    }
    const sig = spots.map((p) => FX.decal({ mode: "disc", x: p.x, z: p.z, r: 1.2, w: 0.3, color: 0xb25aff, opacity: 0.9, prog: 0, add: true }));
    let t = 0, done = false;
    b.summoning = true;
    G.Audio.boss("summon", { pos: b.pos, voice: b.def.voice });
    b.dangers = spots.map((p) => ({ kind: "summon", x: p.x, z: p.z, r: 1.2, at: wind }));
    return {
      update(dt) {
        t += dt;
        b.pose.armL = [-2.5, 0.7]; b.pose.armR = [-2.5, -0.7]; b.pose.head = -0.4;
        sig.forEach((d) => d.set({ prog: t / wind }));
        if (Math.random() < 0.6) spots.forEach((p) => FX.mote(p.x + (Math.random() - 0.5), A.floorY + 0.1, p.z + (Math.random() - 0.5), 0, 1.5, 0, 0xb25aff, 0.8, 0.5, 0));
        if (!done && t >= wind) {
          done = true;
          sig.forEach((d) => d.hide());
          b.dangers = [];
          const fastShare = game.wave >= 10 ? 0.4 : 0.25;
          spots.forEach((p) => {
            const end = new V3(p.x, A.floorY, p.z);
            const sp = { pos: end.clone(), types: ["normal", "fast"], cooldown: 0, ground: true, emerge: { kind: "ground", end, floorY: A.floorY } };
            const z = game.spawnZombieAt(G.rng() < fastShare ? "fast" : "normal", sp.pos, sp);
            if (z) { z.minion = true; M.stats.minions++; }
          });
          G.Audio.boss("rise", { pos: b.pos });
        }
        return t >= wind + 0.6;
      },
      end() { sig.forEach((d) => d.hide()); b.summoning = false; b.dangers = []; b.pose = {}; },
    };
  };

  // Bull Rush: a lane to the arena's edge, then down it at full tilt
  ABIL.charge = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, aimT = b.enraged ? 1.05 : 1.3, speed = 17, W = 1.8;
    let t = 0, phase = "aim", left = b.enraged ? 2 : 1, lane = null, dir = new V3(), len = 0, run = 0, hitThis = false;
    const aim = () => {
      dir.set(P.x - b.pos.x, 0, P.z - b.pos.z);
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      dir.normalize();
      // how far to the edge of the arena along that line
      const r = A.rect, pad = b.rig.R;
      const tx = dir.x > 0 ? (r.maxX - pad - b.pos.x) / dir.x : dir.x < 0 ? (r.minX + pad - b.pos.x) / dir.x : Infinity;
      const tz = dir.z > 0 ? (r.maxZ - pad - b.pos.z) / dir.z : dir.z < 0 ? (r.minZ + pad - b.pos.z) / dir.z : Infinity;
      len = clamp(Math.min(tx, tz), 2, 80);                    // always to the wall
      const yaw = Math.atan2(dir.x, dir.z);
      lane = FX.decal({ mode: "lane", x: b.pos.x, z: b.pos.z, yaw, r: W, len: len + b.rig.R, w: 0.35, color: 0xff2a1a, opacity: 0.9, prog: 0 });
      b.dangers = [{ kind: "lane", x: b.pos.x, z: b.pos.z, dx: dir.x, dz: dir.z, len: len + b.rig.R, w: W, at: aimT }];
      G.Audio.boss("snort", { pos: b.pos, voice: b.def.voice });
      FX.later(aimT * 0.45, () => G.Audio.boss("whistle", { pos: b.pos }));
      hitThis = false; run = 0;
    };
    aim();
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        if (phase === "aim") {
          M.face(b, b.pos.x + dir.x, b.pos.z + dir.z, dt * 8);
          b.pose.torso = 0.55; b.pose.head = -0.2; b.pose.armL = [0.3, 0.3]; b.pose.armR = [0.3, -0.3];
          b.paw = Math.sin(t * 14) * 0.5;
          lane.set({ prog: t / aimT });
          if (b.dangers[0]) b.dangers[0].at = aimT - t;
          if (t >= aimT) { phase = "run"; t = 0; b.paw = 0; G.Audio.boss("charge", { pos: b.pos, voice: b.def.voice }); }
          return false;
        }
        if (phase === "run") {
          const step = speed * dt;
          const ox = b.pos.x, oz = b.pos.z;
          M.moveCollide(game, b, dir.x * step, dir.z * step);
          const moved = Math.hypot(b.pos.x - ox, b.pos.z - oz);
          run += moved;
          b.movedSpeed = speed;
          b.pose.torso = 0.6;
          if (Math.random() < 0.7) FX.burst(b.pos.x - dir.x * 1.5, A.floorY + 0.1, b.pos.z - dir.z * 1.5, 1, 0x5a4a34, 2, 0.25, 2);
          b.dangers = [{ kind: "lane", x: b.pos.x, z: b.pos.z, dx: dir.x, dz: dir.z, len: Math.max(0, len - run) + b.rig.R, w: W, at: 0 }];
          lane.set({ x: b.pos.x, z: b.pos.z, len: Math.max(0.5, len - run + b.rig.R), prog: 1 });
          if (!hitThis && Math.hypot(P.x - b.pos.x, P.z - b.pos.z) < b.rig.R + 0.7 && feetOf(game) < A.floorY + 2.5) {
            hitThis = true;
            // thrown to whichever side of his line they were on
            const side = (P.x - b.pos.x) * dir.z - (P.z - b.pos.z) * dir.x >= 0 ? 1 : -1;
            M.hurt(game, 0.3, { push: { x: b.pos.x - dir.z * side * 3, z: b.pos.z + dir.x * side * 3, d: 3.5 }, src: "charge" });
          }
          if (moved < step * 0.4 || run >= len - 0.05) {
            phase = "stun"; t = 0;
            lane.hide(); b.dangers = [];
            if (!hitThis) M.stats.dodged++;
            // into the energy wall (or a real one): he goes down, open to fire
            b.vuln = 1.5; b.vulnT = 2.3;
            G.Audio.boss("crash", { pos: b.pos });
            FX.burst(b.pos.x + dir.x * b.rig.R, A.floorY + 1.2, b.pos.z + dir.z * b.rig.R, 18, 0x3ad0ff, 5, 0.18, 4);
            FX.sparks(b.pos.x + dir.x * b.rig.R, A.floorY + 1.5, b.pos.z + dir.z * b.rig.R, 26, 0x9ae8ff, 7);
            game.shake(0.06, 0.3);
          }
          return false;
        }
        if (phase === "stun") {
          b.pose.torso = 0.9; b.pose.head = 0.5; b.pose.armL = [0.2, 0.9]; b.pose.armR = [0.2, -0.9];
          b.movedSpeed = 0;
          if (Math.random() < 0.1) FX.sparks(b.pos.x, A.floorY + b.rig.H, b.pos.z, 3, 0xffe080, 2);
          if (t >= 2.3) {
            b.vuln = 1;
            if (--left > 0) { phase = "aim"; t = 0; aim(); return false; }
            b.pose = {};
            return true;
          }
          return false;
        }
        return true;
      },
      end() { if (lane) lane.hide(); b.vuln = 1; b.paw = 0; b.dangers = []; b.pose = {}; },
    };
  };

  // Root Ripple: rings of thorns rolling out -- jump them
  ABIL.roots = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, rings = b.enraged ? 4 : 3, gap = 0.95, speed = 7, maxR = 22, wind = 0.9, W = 0.9;
    const cx = b.pos.x, cz = b.pos.z;
    const R = [];
    for (let i = 0; i < rings; i++) R.push({ start: wind + i * gap, r: 0, done: false, hit: false, on: false, band: null });
    const glow = FX.decal({ mode: "disc", x: cx, z: cz, r: 3, w: 0.4, color: 0x9aff4a, opacity: 0.8, prog: 0, add: true });
    let t = 0;
    b.coreBoost = 0.6;
    G.Audio.boss("stomp_wind", { pos: b.pos, voice: b.def.voice });
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.torso = -0.1; b.pose.armL = [-1.6, 0.8]; b.pose.armR = [-1.6, -0.8];
        glow.set({ prog: Math.min(1, t / wind) });
        const d = Math.hypot(P.x - cx, P.z - cz);
        let alive = 0;
        const dz = [];
        R.forEach((g, i) => {
          if (g.done || t < g.start) { if (!g.done) { alive++; dz.push({ kind: "ring", x: cx, z: cz, r: 1.5, w: W, jump: true, at: g.start - t + d / speed }); } return; }
          if (!g.on) {
            g.on = true;
            g.band = FX.decal({ mode: "ring", x: cx, z: cz, r: 1.5, w: 0.8, color: 0x7aff3a, opacity: 0.85, add: true });
            G.Audio.boss("stomp", { pos: b.pos });
            b.stomp = 0.25;
            game.shake(0.05, 0.2);
          }
          g.r = 1.5 + (t - g.start) * speed;
          if (g.r > maxR) { g.done = true; g.band.hide(); FX.spikeRing(i, cx, cz, 0, 0); return; }
          alive++;
          g.band.set({ r: g.r, opacity: 0.85 * (1 - g.r / maxR * 0.6) });
          FX.spikeRing(i, cx, cz, g.r, 1.0 + 0.3 * Math.sin(t * 20 + i), Math.min(90, Math.round(g.r * 5)));
          if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2; FX.chunk(cx + Math.cos(a) * g.r, A.floorY + 0.2, cz + Math.sin(a) * g.r, 0, 2.5, 0, 0.18, 0x3a2e22, 0.8); }
          dz.push({ kind: "ring", x: cx, z: cz, r: g.r, w: W, jump: true, at: Math.max(0, (d - g.r) / speed) });
          // the ring crossing where the player stands: in the air, it passes under
          if (!g.hit && Math.abs(d - g.r) < W * 0.5 + 0.35) {
            g.hit = true;
            if (airborne(game)) M.stats.dodged++;
            else { M.hurt(game, 0.14, { src: "roots" }); game.bossRootT = 1.0; FX.spikeRing(4, P.x, P.z, 0.6, 0.7, 8); FX.later(1.0, () => FX.spikeRing(4, 0, 0, 0, 0)); }
          }
        });
        if (b.stomp) b.stomp = Math.max(0, b.stomp - dt);
        b.dangers = dz;
        if (t > wind) glow.set({ opacity: Math.max(0, 0.8 - (t - wind)) });
        return t > wind && alive === 0;
      },
      end() { glow.hide(); R.forEach((g, i) => { if (g.band) g.band.hide(); FX.spikeRing(i, 0, 0, 0, 0); }); b.coreBoost = 0; b.dangers = []; b.pose = {}; },
    };
  };

  // Forked Fury: blue circles, a crack of lightning in each, then again
  ABIL.lightning = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, R = 2.3;
    const n1 = (game.wave >= 15 ? 6 : 5) + (b.enraged ? 1 : 0);
    const volleys = [{ at: 0, warn: 1.45, n: n1 }, { at: 1.9, warn: 1.0, n: 3 }];
    let t = 0;
    b.charging = true;
    const skyY = A.kind === "field" ? A.floorY + 32 : A.ceiling - 0.2;
    return {
      update(dt) {
        t += dt;
        b.pose.armL = [-2.8, 0.5]; b.pose.armR = [-2.8, -0.5]; b.pose.head = -0.3;
        const dz = [];
        let pending = 0;
        volleys.forEach((v) => {
          if (v.struck) return;
          pending++;
          if (t < v.at) return;
          if (!v.spots) {
            v.spots = [inRect(A, P.x, P.z, 0.8)];
            for (let i = 1; i < v.n; i++) {
              const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 5;
              v.spots.push(inRect(A, P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 0.8));
            }
            v.marks = v.spots.map((p) => FX.decal({ mode: "disc", x: p.x, z: p.z, r: R, w: 0.3, color: 0x6ad8ff, opacity: 0.95, prog: 0, add: true }));
            G.Audio.boss("crackle", { pos: b.pos });
          }
          const k = (t - v.at) / v.warn;
          v.marks.forEach((m) => m.set({ prog: k, opacity: Math.random() < 0.15 ? 0.5 : 0.95 }));
          v.spots.forEach((p) => dz.push({ kind: "circle", x: p.x, z: p.z, r: R, at: Math.max(0, v.warn - (t - v.at)) }));
          if (Math.random() < 0.3) { const p = G.pick(v.spots); FX.sparks(p.x, A.floorY + 0.1, p.z, 2, 0x9ae8ff, 3); }
          if (k >= 1) {
            v.struck = true;
            v.marks.forEach((m) => m.hide());
            let hit = false;
            v.spots.forEach((p) => {
              FX.bolt(new V3(p.x + (Math.random() - 0.5) * 3, skyY, p.z + (Math.random() - 0.5) * 3), new V3(p.x, A.floorY, p.z));
              FX.scorch(p.x, p.z, 1.3, 0x10141a, 4);
              FX.sparks(p.x, A.floorY + 0.2, p.z, 10, 0xcff4ff, 7);
              FX.shock(p.x, p.z, R + 1, 0x9ae8ff, 0.4);
              if (Math.hypot(P.x - p.x, P.z - p.z) < R + 0.3) hit = true;
            });
            G.Perf.flash(new V3(v.spots[0].x, A.floorY + 3, v.spots[0].z), 0xcfe8ff, 4, 20, 110);
            G.Audio.boss("thunder", { pos: b.pos });
            if (G.Cutscene) G.Cutscene.flashScreen(0.25);
            game.shake(0.05, 0.25);
            if (hit) M.hurt(game, 0.24, { src: "lightning" }); else M.stats.dodged++;
          }
        });
        b.dangers = dz;
        return pending === 0 && t > volleys[1].at + volleys[1].warn + 0.5;
      },
      end() { volleys.forEach((v) => (v.marks || []).forEach((m) => m.hide())); b.charging = false; b.dangers = []; b.pose = {}; },
    };
  };

  // Acid Rain: flasks thrown where the player is going; the acid lingers
  ABIL.acid = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, n = b.enraged ? 5 : 3, flight = 1.1, R = 2.2;
    const vel = game._bossVel || new V3();
    let t = 0, thrown = 0, landed = 0;
    const targets = [];
    const lead = inRect(A, P.x + vel.x * 0.6, P.z + vel.z * 0.6, 0.5);
    targets.push(lead);
    for (let i = 1; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 2.5;
      targets.push(inRect(A, lead.x + Math.cos(a) * r, lead.z + Math.sin(a) * r, 0.5));
    }
    const marks = [];
    G.Audio.boss("cackle", { pos: b.pos, voice: b.def.voice });
    return {
      update(dt) {
        t += dt;
        const dz = [];
        while (thrown < n && t >= 0.35 + thrown * 0.25) {
          const p = targets[thrown];
          b.rig.hand.getWorldPosition(tmpV);
          marks.push(FX.decal({ mode: "disc", x: p.x, z: p.z, r: R, w: 0.3, color: 0x7aff3a, opacity: 0.9, prog: 0 }));
          const mark = marks[marks.length - 1], born = t;
          mark.o.born = born;
          FX.flask(tmpV, new V3(p.x, A.floorY + 0.1, p.z), flight, 4, (at) => {
            landed++;
            mark.hide();
            FX.sparks(at.x, A.floorY + 0.3, at.z, 14, 0x8aff3a, 4);
            FX.burst(at.x, A.floorY + 0.2, at.z, 6, 0x9aff5a, 2.5, 0.12, 3);
            G.Audio.boss("splash", { pos: at });
            if (Math.hypot(P.x - at.x, P.z - at.z) < R + 0.3 && feetOf(game) < A.floorY + 1.5) M.hurt(game, 0.1, { src: "acid" });
            M.addPool(at.x, at.z, R);
          });
          b.pose.armL = [-2.6, 0.2];
          FX.later(0.15, () => { b.pose.armL = [-0.6, 0.2]; });
          thrown++;
        }
        marks.forEach((m) => { if (m.on) { m.set({ prog: Math.min(1, (t - m.o.born) / flight) }); dz.push({ kind: "circle", x: m.o.x, z: m.o.z, r: R, at: Math.max(0, flight - (t - m.o.born)) }); } });
        b.dangers = dz;
        return landed >= n && t > 0.5;
      },
      end() { marks.forEach((m) => m.hide()); b.dangers = []; b.pose = {}; },
    };
  };

  // Event Horizon: a hole that pulls, slower than a walk; its middle burns
  ABIL.vortex = function (M, game, b) {
    // (in a hall there is nowhere twenty metres away: a shorter, weaker pull)
    const hall = M.arena.kind === "hall";
    const P = game.yawObject.position, A = M.arena, wind = 1.2, dur = b.enraged ? 5.5 : 4.5, pullR = hall ? 13 : 20, coreR = 2.6, pull = hall ? 1.7 : 2.2;
    const fwdX = Math.sin(b.root.rotation.y), fwdZ = Math.cos(b.root.rotation.y);
    const c = inRect(A, b.pos.x + fwdX * 2.5, b.pos.z + fwdZ * 2.5, 1);
    const core = FX.decal({ mode: "disc", x: c.x, z: c.z, r: coreR, w: 0.5, color: 0xa24aff, opacity: 0.95, prog: 0, add: true });
    const edge = FX.decal({ mode: "ring", x: c.x, z: c.z, r: pullR, w: 0.35, color: 0x6a2aaa, opacity: 0.5, add: true });
    let t = 0, loop = null, pulling = false, touched = false;
    G.Audio.boss("vortex_wind", { pos: b.pos });
    b.dangers = [{ kind: "pull", x: c.x, z: c.z, r: pullR, core: coreR, speed: pull, at: wind }];
    return {
      holdFacing: true,
      update(dt) {
        t += dt;
        b.pose.armL = [-1.6, 1.1]; b.pose.armR = [-1.6, -1.1];
        core.set({ prog: Math.min(1, t / wind), r: coreR * (pulling ? 1 + 0.08 * Math.sin(t * 12) : 1) });
        if (!pulling) {
          b.dangers[0].at = wind - t;
          if (t >= wind) { pulling = true; b.pulling = true; FX.md.pull = { x: c.x, z: c.z, y: A.floorY + 0.5, k: 9, swirl: 7, ky: 1 }; loop = G.Audio.bossLoop("vortex", { pos: new V3(c.x, A.floorY + 1, c.z) }); }
          return false;
        }
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12;
          FX.mote(c.x + Math.cos(a) * r, A.floorY + 0.2 + Math.random() * 2.5, c.z + Math.sin(a) * r, 0, 0, 0, i % 2 ? 0xa24aff : 0x5a2aff, 1.4, 0.8, 0);
        }
        const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
        if (d < pullR && d > 0.05) {
          const s = pull * dt;
          game.tryMove(dx / d * Math.min(s, d), dz / d * Math.min(s, d));
          touched = true;
        }
        if (d < coreR + 0.3) M.dot(game, 0.15, dt, "vortex");
        b.dangers = [{ kind: "pull", x: c.x, z: c.z, r: pullR, core: coreR, speed: pull, at: 0 }];
        return t >= wind + dur;
      },
      end() {
        core.hide(); edge.hide(); if (loop) loop.stop(); b.pulling = false;
        if (FX.md) FX.md.pull = null;
        if (touched) G.Audio.boss("pop", { pos: new V3(c.x, A.floorY + 1, c.z) });
        FX.shock(c.x, c.z, 6, 0xa24aff, 0.5);
        b.dangers = []; b.pose = {};
      },
    };
  };

  // Trick Question: copies of him round the player, throwing paper blades;
  // only one of them is real (the copies are faintly see-through, blue-eyed)
  ABIL.clones = function (M, game, b) {
    const P = game.yawObject.position, A = M.arena, fakes = b.enraged ? 3 : 2, dur = 7;
    let t = 0, split = false, hp0 = b.hp, throwT = [];
    const figs = [];
    G.Audio.boss("papers", { pos: b.pos });
    FX.pd.swirl = null;
    for (let i = 0; i < 30; i++) FX.paper(b.pos.x, A.floorY + 1 + Math.random() * 4, b.pos.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 2.5);
    const place = () => {
      const n = fakes + 1, a0 = Math.atan2(b.pos.z - P.z, b.pos.x - P.x);
      const spots = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * (2.2 / n) * 1.3, r = 9;
        spots.push(inRect(A, P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 1.5));
      }
      return G.shuffle(spots);
    };
    return {
      update(dt) {
        t += dt;
        if (!split) {
          b.pose.armL = [-2.2, 0.8]; b.pose.armR = [-2.2, -0.8];
          if (t < 0.8) return false;
          split = true;
          const spots = place();
          b.pos.x = spots[0].x; b.pos.z = spots[0].z;
          figs.push({ real: true, root: b.root, x: spots[0].x, z: spots[0].z });
          for (let i = 1; i < spots.length; i++) {
            const c = M.makeClone(game, b, i);
            c.root.position.set(spots[i].x, A.floorY, spots[i].z);
            figs.push({ real: false, root: c.root, clone: c, x: spots[i].x, z: spots[i].z });
          }
          figs.forEach((f, i) => { throwT[i] = 0.8 + i * 0.65; for (let k = 0; k < 12; k++) FX.paper(f.x, A.floorY + 1 + Math.random() * 4, f.z, (Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5, 2.2); });
          hp0 = b.hp;
          G.Audio.boss("poof", { pos: b.pos });
          return false;
        }
        const dz = [];
        figs.forEach((f, i) => {
          if (!f.real && f.clone.popped) return;
          const root = f.root;
          root.rotation.y = Math.atan2(P.x - root.position.x, P.z - root.position.z);
          if (!f.real) {
            root.position.y = A.floorY;
            f.clone.mats.forEach((m) => { m.opacity = 0.72 + Math.random() * 0.08; });
            root.visible = Math.random() > 0.03;
          }
          throwT[i] -= dt;
          if (throwT[i] <= 0) {
            throwT[i] = 3.2;
            const hand = f.real ? b.rig.hand : f.clone.hand;
            hand.getWorldPosition(tmpV);
            const aimAt = new V3(P.x, P.y - 0.4, P.z);
            const dir = aimAt.sub(tmpV).normalize();
            G.Audio.boss("throw", { pos: tmpV });
            FX.blade(tmpV, dir, 8, (bl) => {
              if (bl.pos.distanceTo(tmpV2.set(P.x, P.y - 0.5, P.z)) < 0.75) { M.hurt(game, 0.04, { src: "blade" }); return false; }
              if (bl.pos.y < A.floorY) return false;
              return true;
            });
            if (f.real) { b.pose.armR = [-2.4, -0.2]; FX.later(0.25, () => { b.pose.armR = undefined; }); }
          }
          dz.push({ kind: "figure", x: root.position.x, z: root.position.z, real: f.real });
        });
        b.dangers = dz;
        const bursted = hp0 - b.hp >= b.maxHp * 0.05;
        if (t >= 0.8 + dur || bursted) {
          if (bursted) M.stats.cloneFound++;
          return true;
        }
        return false;
      },
      end() {
        figs.forEach((f) => { if (!f.real && !f.clone.popped) M.popClone(game, f.clone, true); });
        M.clones = [];
        b.dangers = []; b.pose = {};
      },
    };
  };

  // ================================================================
  // The fight
  // ================================================================
  G.Bosses = {
    LASER_SPEED: G.CONFIG.player.walkSpeed,    // the player's base walking speed (js/config.js: 3.2 m/s)
    SLAM_FRAC: 0.55,
    MAX_MINIONS: 8,
    boss: null, phase: null, arena: null,
    run: { met: [], bag: [], last: null, downs: [], lastHp: 0 },
    pools: [], clones: [], stats: null, forceNext: null,

    resetRun() { this.run = { met: [], bag: [], last: null, downs: [], lastHp: 0 }; },
    active() { return !!this.phase; },
    fighting() { return this.phase === "fight" && !!this.boss; },
    label(def) { return G.T("boss.hpLabel", { name: G.T("boss." + def.id + ".name"), title: G.T("boss.the", { w: cap(def.word) }) }); },
    thai(def) { return (G.BOSS_WORDS[def.word] || {}).th || ""; },

    // which boss comes next: none met yet this run (a level's four are four
    // different ones); Endless takes them from a bag of all ten, refilled
    // only when empty and never starting with the one just seen
    pick(game) {
      const R = this.run, ids = G.BOSS_DEFS.map((d) => d.id);
      let id = this.forceNext && G.BOSS_BY_ID[this.forceNext] ? this.forceNext : null;
      this.forceNext = null;
      if (!id && game.mode === "endless") {
        if (!R.bag.length) {
          R.bag = G.shuffle(ids.slice());
          if (R.bag[0] === R.last && R.bag.length > 1) R.bag.push(R.bag.shift());
        }
        id = R.bag.shift();
      } else if (!id) {
        let pool = ids.filter((i) => !R.met.includes(i));
        if (!pool.length) pool = ids.filter((i) => i !== R.last);
        id = G.pick(pool);
      }
      R.last = id;
      R.met.push(id);
      return G.BOSS_BY_ID[id];
    },

    // what the player's best gun does a second, all told: damage per shot
    // (pellets, bursts, a charge), fire rate, and the time spent reloading
    playerDps(game) {
      const pl = game.player;
      let best = 30;
      (pl.gunSlots || []).forEach((id) => {
        const d = G.WEAPON_DEFS[id], L = (pl.weaponLevels || {})[id] || { dmg: 1, rate: 1, mag: 1 };
        if (!d) return;
        const perShot = d.damage * L.dmg * (d.pellets ? d.pellets * 0.6 : 1) * (d.burst || 1) * (d.charge ? 1 + (d.charge.mult - 1) * 0.7 : 1);
        const interval = (d.fireRate / 1000) / (L.rate || 1) + (d.charge ? d.charge.time * 0.7 : 0);
        const shots = Math.max(1, Math.round(d.magSize * (L.mag || 1)) / (d.burst || 1));
        const cycle = shots * interval + (d.reloadTime || 1500) / 1000;
        best = Math.max(best, perShot * shots / cycle);
      });
      return best;
    },
    // (new series, round 1, C) A boss's health comes from the wave it arrives
    // on, not from which boss it is or from the player's guns: every boss at
    // wave 5 has the same, and each boss wave more than the last --
    // G.CONFIG.boss.hpByWave (js/config.js), times the level's own multiplier.
    // (It used to follow the best gun held, so a strong gun found early made
    // the wave 5 boss a marathon that ran the player out of ammunition.)
    // Endless, past wave 20: a quarter of the wave-20 health more a boss.
    hpFor(game) {
      const B = G.CONFIG.boss, w = Math.max(G.BOSS_EVERY, game.wave);
      const steps = Object.keys(B.hpByWave).map(Number).sort((a, b) => a - b);
      const top = steps[steps.length - 1];
      let hp;
      if (w > top) hp = B.hpByWave[top] * (1 + B.endlessGrowth * Math.round((w - top) / G.BOSS_EVERY));
      else hp = B.hpByWave[steps.filter((s) => s <= w).pop() || steps[0]];
      hp *= B.levelHpMult[game.level && game.level.id] || 1;
      return Math.round(hp / 50) * 50;
    },

    // a boss wave's own zombies are down: the boss comes as soon as nothing
    // else is on screen (a crate being opened, say)
    begin(game) { if (!this.phase) this.phase = "pending"; },
    start(game) {
      const def = this.pick(game);
      const A = this.arena = G.Arena.plan(game);
      game.clearZombies();
      FX.init(game.scene, A.floorY);
      const rig = G.BossModels.build(def.id);
      const hp = this.hpFor(game);
      this.run.lastHp = hp;
      const b = this.boss = {
        def, rig, root: rig.root, pos: rig.root.position, hp, maxHp: hp, alive: true, t: 0,
        swipeCd: 2, abilityCd: 3.5, act: null, pose: {}, cur: {}, dangers: [], hurtT: 0, vuln: 1, vulnT: 0,
        enraged: false, walkW: 0, stepPh: 0, movedSpeed: 0, stuckT: 0, detourT: 0, detourSign: 1, squat: 0, chest: 0, paw: 0,
        label: this.label(def), uses: 0,
      };
      b.pos.copy(A.boss);
      b.root.rotation.y = Math.atan2(A.player.x - A.boss.x, A.player.z - A.boss.z);
      game.scene.add(b.root);
      this.restPose(rig);
      this.pools = []; this.clones = []; this._dot = {};
      this.stats = { id: def.id, wave: game.wave, hp, dps: Math.round(this.playerDps(game)), fightT: 0, dealt: 0, taken: 0, hitsTaken: 0, dodged: 0, slamHits: 0, minions: 0, cloneFound: 0, abilities: 0 };
      game.teleportPlayer(A.player, A.boss);
      const S = G.save.bosses;
      S.seen[def.id] = (S.seen[def.id] || 0) + 1;
      G.persist();
      this.phase = "cutscene";
      G.Cutscene.play(game, b, A, () => this.fight(game));
    },
    fight(game) {
      const b = this.boss;
      if (!b) return;
      this.phase = "fight";
      G.Arena.seal(game, this.arena);
      b.abilityCd = 3.5; b.swipeCd = 1.5;
      b.pos.y = this.arena.floorY;
      G.Audio.bossMusic(true, b.def);
      G.UI.setBossBar(true, b.label, 100);
    },

    // ---- every frame of the fight ----
    update(game, dt) {
      G.Arena.update(dt);
      FX.update(dt);
      const b = this.boss;
      if (!b || this.phase !== "fight") return;
      // (round 3) an ability's hold: a Frost Sprite or a Shockwave stops it
      // for a moment -- far shorter than a zombie -- and Time Warp or Glue
      // slow it a little; the rest of the abilities do nothing to a boss
      if (b.frozenT > 0) {
        b.frozenT -= dt;
        this.updatePools(game, dt);
        G.UI.setBossBar(true, b.label, b.hp / b.maxHp * 100, b.vulnT > 0);
        return;
      }
      if (G.Abilities) dt *= G.Abilities.bossSpeed(b);
      const A = this.arena, P = game.yawObject.position;
      b.t += dt;
      this.stats.fightT += dt;
      b.swipeCd -= dt; b.abilityCd -= dt;
      b.hurtT = Math.max(0, b.hurtT - dt); b.vulnT = Math.max(0, b.vulnT - dt);
      if (!b.enraged && b.hp < b.maxHp * 0.4) {
        b.enraged = true;
        G.Audio.boss("enrage", { pos: b.pos, voice: b.def.voice });
        G.UI.flashPurchaseBanner(G.T("boss." + b.def.id + ".name"), G.T("hud.bossEnraged"));
      }
      const dx = P.x - b.pos.x, dz = P.z - b.pos.z, dist = Math.hypot(dx, dz);
      b.dist = dist;
      b.movedSpeed = 0;
      let walk = 0;
      if (b.act) {
        if (b.act.update(dt)) { if (b.act.end) b.act.end(); const was = b.act; b.act = null; if (was.ability) b.abilityCd = this.cooldown(game, b); }
      } else if (b.abilityCd <= 0 && dist < 40) {
        b.act = ABIL[b.def.ability](this, game, b);
        b.act.ability = true;
        b.uses++; this.stats.abilities++;
      } else if (b.swipeCd <= 0 && dist < b.def.reach + b.rig.R + 0.4) {
        b.act = swipe(this, game, b);
      } else walk = 1;
      if (!b.act || !b.act.holdFacing) this.face(b, P.x, P.z, dt * (b.enraged ? 2.8 : 2.2));
      if (walk) {
        // a boss that fights at range keeps its distance; the rest close in
        const want = b.def.range ? (dist > b.def.range + 2 ? 1 : dist < b.def.range - 3 ? -0.7 : 0) : (dist > b.def.reach + b.rig.R - 0.4 ? 1 : 0);
        if (want) this.step(game, b, want * b.def.speed * (b.enraged ? 1.15 : 1), dt);
      }
      // the player cannot walk through it
      const minD = b.rig.R + 0.45;
      if (dist < minD && dist > 0.001 && feetOf(game) < b.pos.y + b.rig.H) game.tryMove(dx / dist * (minD - dist), dz / dist * (minD - dist));
      this.animate(b, dt);
      this.updatePools(game, dt);
      // how fast the player is going (Acid Rain aims ahead of them)
      const gv = game._bossVel || (game._bossVel = new V3());
      if (game._bossLastP) gv.set((P.x - game._bossLastP.x) / Math.max(dt, 1e-3), 0, (P.z - game._bossLastP.z) / Math.max(dt, 1e-3));
      game._bossLastP = (game._bossLastP || new V3()).copy(P);
      this.resupply(game, b, dt);
      G.UI.setBossBar(true, b.label, b.hp / b.maxHp * 100, b.vulnT > 0);
    },
    // Ammunition in the sealed arena (new series, round 1, C; round 3 found a
    // player run dry in there with only the knife and no way out). A box
    // turns up somewhere round the arena now and then -- the first after
    // firstAfter seconds, then every 20-30 s, a few at most lying about --
    // and the boss drops one each time it falls past 75%, 50% and 25% of its
    // health. A box fills every gun with three magazines. G.CONFIG.boss.arenaAmmo.
    resupply(game, b, dt) {
      const A = G.CONFIG.boss.arenaAmmo;
      if (b.supplyT == null) b.supplyT = A.firstAfter;
      b.supplyT -= dt;
      if (b.supplyT <= 0) {
        b.supplyT = A.every[0] + Math.random() * (A.every[1] - A.every[0]);
        if ((game.drops || []).filter((d) => d.arena).length < A.maxLying) this.dropAmmo(game, b, false);
      }
      b.dropsDone = b.dropsDone || 0;
      while (b.dropsDone < A.dropsAt.length && b.hp <= b.maxHp * A.dropsAt[b.dropsDone]) { b.dropsDone++; this.dropAmmo(game, b, true); }
    },
    // fromBoss: out of the boss, towards the player; else anywhere open in
    // the arena, clear of the boss and not right under the player's feet
    dropAmmo(game, b, fromBoss) {
      const AR = this.arena, r = AR.rect, P = game.yawObject.position, pad = 2.5;
      const inside = (x, z) => x > r.minX + pad && x < r.maxX - pad && z > r.minZ + pad && z < r.maxZ - pad;
      const blocked = (x, z) => G.ColGrid.near(game.world, x, z, 1.5, []).some((c) => c.min.y < AR.floorY + 1.5 && c.max.y > AR.floorY + 0.05 && x + 0.5 > c.min.x && x - 0.5 < c.max.x && z + 0.5 > c.min.z && z - 0.5 < c.max.z);
      // (never in a pool of acid or anything else the boss has left burning)
      const inPool = (x, z) => (this.pools || []).some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1);
      let at = null;
      if (fromBoss) {
        // (not at the player's feet either, where it would be picked up unseen)
        const dx = P.x - b.pos.x, dz = P.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
        for (const k of [b.rig.R + 2.5, b.rig.R + 1.5, b.rig.R + 4]) {
          const x = b.pos.x + dx / d * k, z = b.pos.z + dz / d * k;
          if (inside(x, z) && !blocked(x, z) && !inPool(x, z) && Math.hypot(x - P.x, z - P.z) > 2.5) { at = { x, z }; break; }
        }
      }
      for (let i = 0; !at && i < 30; i++) {
        const x = r.minX + pad + Math.random() * (r.maxX - r.minX - pad * 2), z = r.minZ + pad + Math.random() * (r.maxZ - r.minZ - pad * 2);
        if (Math.hypot(x - b.pos.x, z - b.pos.z) < b.rig.R + 3 || Math.hypot(x - P.x, z - P.z) < 3 || blocked(x, z) || inPool(x, z)) continue;
        at = { x, z };
      }
      if (!at) at = { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
      game.spawnDrop("ammo", new V3(at.x, AR.floorY, at.z));
      game.drops[game.drops.length - 1].arena = true;
      FX.shock(at.x, at.z, 2.2, 0x3388ff, 0.6);
      if (fromBoss) FX.sparks(at.x, AR.floorY + 1, at.z, 14, 0x6ab0ff, 4);
      G.Audio.sfx("pickup", { pos: new V3(at.x, AR.floorY + 1, at.z) });
      if (!b.supplied) { b.supplied = true; G.UI.flashPurchaseBanner(G.T("banner.arenaAmmo"), G.T("banner.arenaAmmoText")); }
    },
    // how far into the level: 0 at the first boss (wave 5), 1 by wave 20.
    // The first boss is a new player's first: its moves come less often and
    // hit softer (the slam's half-health blow excepted), rising to full.
    late(game) { return clamp((game.wave - 5) / 15, 0, 1); },
    cooldown(game, b) {
      return (b.def.every || 10) * (1.2 - 0.45 * this.late(game)) * (b.enraged ? 0.72 : 1);
    },
    face(b, x, z, rate) {
      const want = Math.atan2(x - b.pos.x, z - b.pos.z);
      let d = want - b.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      b.root.rotation.y += clamp(d, -rate, rate);
    },
    // Towards the player (or away, for a boss keeping its distance). Something
    // in the way -- the bunker's reactor, a goal post, a sala -- is walked
    // round: the nearest heading either side that is open, kept for a moment.
    step(game, b, speed, dt) {
      const P = game.yawObject.position;
      let dx = P.x - b.pos.x, dz = P.z - b.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;
      if (speed < 0) { dx = -dx; dz = -dz; speed = -speed; }
      const s = speed * dt, turn = (a) => [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
      let dir = [dx, dz];
      if (b.detourT > 0) { b.detourT -= dt; dir = turn(b.detourA); }
      const ox = b.pos.x, oz = b.pos.z;
      this.moveCollide(game, b, dir[0] * s, dir[1] * s);
      let moved = Math.hypot(b.pos.x - ox, b.pos.z - oz);
      if (moved < s * 0.5) {
        // blocked: look for the nearest open heading, the same side as last time first
        b.pos.x = ox; b.pos.z = oz;
        const sgn = b.detourSign || 1;
        for (const a of [0.5, 1.0, 1.5, 2.0, 2.5]) {
          for (const sg of [sgn, -sgn]) {
            const t = turn(a * sg), probe = this.probe(game, b, t[0] * 1.5, t[1] * 1.5);
            if (probe) { b.detourA = a * sg; b.detourSign = sg; b.detourT = 0.7; dir = t; break; }
          }
          if (b.detourT > 0.69) break;
        }
        this.moveCollide(game, b, dir[0] * s, dir[1] * s);
        moved = Math.hypot(b.pos.x - ox, b.pos.z - oz);
      }
      b.movedSpeed = moved / Math.max(dt, 1e-4);
    },
    // could the boss stand (mx, mz) further on?
    probe(game, b, mx, mz) {
      const ox = b.pos.x, oz = b.pos.z;
      this.moveCollide(game, b, mx, mz);
      const ok = Math.hypot(b.pos.x - ox - mx, b.pos.z - oz - mz) < 0.05;
      b.pos.x = ox; b.pos.z = oz;
      return ok;
    },
    moveCollide(game, b, mx, mz) {
      const A = this.arena, R = b.rig.R * 0.8, y0 = A.floorY + 0.3, y1 = A.floorY + 2.4;
      const cols = G.ColGrid.near(game.world, b.pos.x, b.pos.z, R + 3, b._cols || (b._cols = []));
      const box = b._box || (b._box = new THREE.Box3());
      // anything it already stands in (a crate it landed on, clutter by its
      // start) it may walk out of, rather than be frozen by
      box.min.set(b.pos.x - R, y0, b.pos.z - R); box.max.set(b.pos.x + R, y1, b.pos.z + R);
      const inside = cols.filter((c) => c.intersectsBox(box));
      const blocked = (x, z) => {
        box.min.set(x - R, y0, z - R); box.max.set(x + R, y1, z + R);
        for (const c of cols) if (!this.arenaWall(c) && !inside.includes(c) && c.intersectsBox(box)) return true;
        return false;
      };
      const r = A.rect, pad = b.rig.R;
      const nx = clamp(b.pos.x + mx, r.minX + pad, r.maxX - pad), nz = clamp(b.pos.z + mz, r.minZ + pad, r.maxZ - pad);
      if (!blocked(nx, b.pos.z)) b.pos.x = nx;
      if (!blocked(b.pos.x, nz)) b.pos.z = nz;
    },
    arenaWall(c) { return G.Arena.cols.includes(c); },

    // ---- poses ----
    restPose(rig) {
      const r = rig.rest || {};
      if (rig.torso) rig.torso.rotation.x = r.torso || 0;
      if (rig.head) rig.head.rotation.x = r.head || 0;
      ["armL", "armR"].forEach((n) => { if (rig[n]) { const a = r[n] || [0, 0]; rig[n].rotation.x = a[0]; rig[n].rotation.z = a[1]; } });
      if (rig.hips) rig.hips.position.y = rig.hipY;
    },
    animate(b, dt) {
      const r = b.rig, rest = r.rest || {}, pose = b.pose, cur = b.cur;
      const k = 1 - Math.exp(-dt * 9);
      const tgt = (n, d) => (pose[n] !== undefined ? pose[n] : rest[n] !== undefined ? rest[n] : d);
      ["torso", "head"].forEach((n) => { cur[n] = (cur[n] === undefined ? tgt(n, 0) : cur[n]) + (tgt(n, 0) - (cur[n] === undefined ? tgt(n, 0) : cur[n])) * k; });
      ["armL", "armR"].forEach((n) => {
        const t = tgt(n, [0, 0]);
        const c = cur[n] || (cur[n] = t.slice());
        c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k;
      });
      b.walkW += ((b.movedSpeed > 0.3 ? 1 : 0) - b.walkW) * Math.min(1, dt * 6);
      b.stepPh += (b.movedSpeed || 0) * dt * (2.4 / Math.max(2, r.H * 0.45));
      const sw = Math.sin(b.stepPh) * b.walkW;
      if (r.legL) { r.legL.rotation.x = sw * 0.55 + (b.paw || 0) * 0.6; r.legR.rotation.x = -sw * 0.55 - (b.stomp ? 0.9 : 0); }
      const armSwing = pose.armL || pose.armR ? 0.1 : 0.35;
      if (r.armL) { r.armL.rotation.x = cur.armL[0] - sw * armSwing; r.armL.rotation.z = cur.armL[1]; }
      if (r.armR) { r.armR.rotation.x = cur.armR[0] + sw * armSwing; r.armR.rotation.z = cur.armR[1]; }
      if (r.torso) {
        r.torso.rotation.x = cur.torso + Math.abs(sw) * 0.05;
        r.torso.rotation.z = Math.sin(b.stepPh) * 0.04 * b.walkW;
        const br = Math.sin(b.t * 1.8) * 0.02 + (b.chest || 0);
        r.torso.scale.set(1 + br * 0.6, 1 + br * 0.3, 1 + br);
      }
      if (r.head) r.head.rotation.x = cur.head;
      const bob = r.float ? Math.sin(b.t * 1.4) * 0.2 : Math.abs(Math.cos(b.stepPh)) * 0.1 * b.walkW;
      if (r.hips) r.hips.position.y = r.hipY + bob - (b.squat || 0) * r.hipY * 0.3;
      if (r.idle) r.idle(b, b.t, dt);
      // hit: a red flash; open to extra damage: a pulse; enraged: a glow
      const e = r.shared.lambert.emissive;
      const vul = b.vulnT > 0 ? 0.25 + 0.2 * Math.sin(b.t * 18) : 0;
      const rage = b.enraged ? 0.08 + 0.06 * Math.sin(b.t * 5) : 0;
      e.setRGB(Math.min(1, (b.hurtT > 0 ? 0.45 : 0) + rage + vul), (b.hurtT > 0 ? 0.05 : 0) + vul * 0.8, vul * 0.2);
    },

    // ---- the player getting hurt ----
    hurt(game, frac, o) {
      o = o || {};
      const pl = game.player;
      if (!pl || game.state !== "GAMEPLAY") return;
      // (softer early on -- see late(); the slam keeps its full weight)
      const k = o.src === "slam" ? 1 : 0.75 + 0.35 * this.late(game);
      // (round 3: nothing lands during a Dash, a quarter behind a Barrier)
      const ab = G.Abilities ? G.Abilities.damageTakenMult() : 1;
      if (ab <= 0) { if (this.stats) this.stats.dodged++; return; }
      let dmg = pl.maxHp * frac * k * (1 - (pl.armorPct || 0)) * ab;
      // (the slam never kills a player who had full health)
      if (o.notLethalFromFull && pl.hp >= pl.maxHp - 0.5) dmg = Math.min(dmg, pl.hp - 1);
      pl.hp -= dmg;
      pl.wasHitThisLevel = true;
      if (this.stats) { this.stats.taken += dmg; this.stats.hitsTaken++; }
      G.UI.flashDamage();
      G.Audio.sfx("hurt");
      if (o.push) {
        const P = game.yawObject.position, dx = P.x - o.push.x, dz = P.z - o.push.z, d = Math.hypot(dx, dz) || 1;
        for (let i = 0; i < 10; i++) game.tryMove(dx / d * o.push.d / 10, dz / d * o.push.d / 10);
      }
      game.checkPlayerDeath();
    },
    // damage over time, in ticks of a quarter second of game time (one flash
    // and one sound each); the first touch counts at once
    dot(game, fracPerSec, dt, key) {
      const D = this._dot || (this._dot = {});
      const d = D[key] || (D[key] = { acc: 0, t: 0.25 });
      d.acc += fracPerSec * dt;
      d.t += dt;
      if (d.t < 0.25) return;
      const k = d.acc;
      d.t = 0; d.acc = 0;
      this.hurt(game, k, { src: key });
    },

    // ---- the boss getting hurt ----
    hitboxes() {
      if (this.phase !== "fight" || !this.boss) return [];
      const out = this.boss.rig.hitboxes.slice();
      this.clones.forEach((c) => { if (!c.popped) out.push(...c.hitboxes); });
      return out;
    },
    // a round hit a hitbox: the boss (or a copy of it) takes it
    onShot(game, hitObj, dmg, point) {
      const info = hitObj.userData.bossHit || {};
      if (info.clone !== undefined) {
        const c = this.clones.find((x) => x.id === info.clone);
        if (c && !c.popped) { this.popClone(game, c); return { hit: true, weak: false }; }
        return { hit: false };
      }
      this.damage(game, dmg * (info.weak ? 1.5 : 1), point);
      return { hit: true, weak: !!info.weak };
    },
    damage(game, dmg, point) {
      const b = this.boss;
      if (!b || this.phase !== "fight" || b.hp <= 0) return;
      const d = dmg * b.vuln;
      b.hp -= d;
      b.hurtT = 0.1;
      this.stats.dealt += d;
      if (point) G.spawnHitParticles(game.scene, point, b.def.color, G.save.settings.graphicsQuality);
      const now = performance.now();
      if (now - (this._hurtSndAt || 0) > 420) { this._hurtSndAt = now; G.Audio.boss("hurt", { pos: b.pos, voice: b.def.voice }); }
      if (b.hp <= 0) { b.hp = 0; this.die(game); }
    },
    // an explosion's worth: whatever part of the radius the boss is inside
    splash(game, point, r, baseDmg) {
      const b = this.boss;
      if (!b || this.phase !== "fight") return;
      const d = Math.hypot(point.x - b.pos.x, point.z - b.pos.z) - b.rig.R;
      const dy = point.y - (b.pos.y + b.rig.H / 2);
      if (d > r || Math.abs(dy) > b.rig.H / 2 + r) return;
      this.damage(game, baseDmg * 0.6 * (1 - 0.7 * Math.max(0, d) / r), null);
      this.clones.forEach((c) => { if (!c.popped && c.root.position.distanceTo(point) < r + 1) this.popClone(game, c); });
    },
    // the knife
    melee(game, origin, dir, def) {
      const b = this.boss;
      if (!b || this.phase !== "fight") return false;
      const dx = b.pos.x - origin.x, dz = b.pos.z - origin.z, d = Math.hypot(dx, dz);
      if (d - b.rig.R > def.range + 0.3) return false;
      if ((dx * dir.x + dz * dir.z) / (d || 1) < 0.5) return false;
      this.damage(game, def.damage, origin.clone().addScaledVector(dir, Math.max(0.5, d - b.rig.R)));
      return true;
    },

    // ---- the Examiner's copies ----
    makeClone(game, b, id) {
      const root = b.root.clone(true);
      const mats = [];
      root.traverse((o) => {
        if (!o.isMesh || o.userData.bossHit) return;
        const m = o.material.clone();
        m.transparent = true; m.opacity = 0.76; m.depthWrite = true;
        if (m.color && m.color.getHex && m.color.getHex() === 0xff2a2a) m.color.setHex(0x9ad8ff);
        o.material = m;
        mats.push(m);
      });
      const hitboxes = [];
      root.traverse((o) => { if (o.userData.bossHit) { o.userData.bossHit = { weak: false, clone: id }; hitboxes.push(o); } });
      game.scene.add(root);
      let hand = null;
      root.traverse((o) => { if (!hand && o.name === "armR") hand = o; });
      const c = { id, root, mats, hitboxes, hand: hand || root, popped: false };
      this.clones.push(c);
      return c;
    },
    popClone(game, c, quiet) {
      if (c.popped) return;
      c.popped = true;
      const p = c.root.position;
      for (let i = 0; i < 26; i++) FX.paper(p.x, p.y + 1 + Math.random() * 4.5, p.z, (Math.random() - 0.5) * 7, Math.random() * 4, (Math.random() - 0.5) * 7, 2.6);
      if (!quiet) { G.Audio.boss("poof", { pos: p }); G.UI.showHitmarker(); }
      if (c.root.parent) c.root.parent.remove(c.root);
      c.mats.forEach((m) => m.dispose());
    },

    // ---- acid on the ground ----
    addPool(x, z, r) {
      if (this.pools.length >= 8) { const old = this.pools.shift(); old.d.hide(); }
      const d = FX.decal({ mode: "blob", x, z, r, w: 0.4, color: 0x5aff1a, opacity: 0.75, y: this.arena.floorY + 0.05, add: true });
      this.pools.push({ x, z, r, t: 7, d });
    },
    updatePools(game, dt) {
      const P = game.yawObject.position;
      for (let i = this.pools.length - 1; i >= 0; i--) {
        const p = this.pools[i];
        p.t -= dt;
        if (p.t <= 0) { p.d.hide(); this.pools.splice(i, 1); continue; }
        p.d.set({ opacity: 0.75 * Math.min(1, p.t) });
        if (Math.random() < 0.25) FX.mote(p.x + (Math.random() - 0.5) * p.r * 1.4, this.arena.floorY + 0.1, p.z + (Math.random() - 0.5) * p.r * 1.4, 0, 0.8, 0, 0x6aff2a, 0.7, 1, 0);
        if (Math.hypot(P.x - p.x, P.z - p.z) < p.r + 0.2 && feetOf(game) < this.arena.floorY + 0.8) this.dot(game, 0.12, dt, "pool");
      }
    },
    // everything a player (or the playtest bot) should keep out of right now
    dangers() {
      const b = this.boss;
      if (!b || this.phase !== "fight") return [];
      // (and paper blades in the air: where each will be in half a second)
      const blades = (FX.blades || []).filter((f) => f.on).map((f) => ({ kind: "blade", x: f.pos.x + f.dir.x * f.speed * 0.5, z: f.pos.z + f.dir.z * f.speed * 0.5, r: 0.8, at: 0.5 }));
      return b.dangers.concat(this.pools.map((p) => ({ kind: "pool", x: p.x, z: p.z, r: p.r, at: 0 })), blades);
    },

    // ---- the end ----
    die(game) {
      const b = this.boss;
      if (!b || this.phase !== "fight") return;
      this.phase = "dying";
      b.alive = false;
      if (b.act && b.act.end) b.act.end();
      b.act = null;
      this.pools.forEach((p) => p.d.hide()); this.pools = [];
      this.clones.forEach((c) => this.popClone(game, c, true)); this.clones = [];
      FX.clearTransient();
      game.bossSlow = 1; game.bossRootT = 0;
      b.dangers = [];
      G.UI.setBossBar(false);
      G.Audio.bossMusic(false);
      this.stats.fightT = Math.round(this.stats.fightT);
      G.Cutscene.death(game, b, this.arena, () => this.after(game));
    },
    // the death cutscene's big moment: the body breaks apart, the walls
    // come down, anything it summoned goes with it
    explode(game) {
      const b = this.boss;
      if (!b) return;
      b.root.updateMatrixWorld(true);
      const v = new V3();
      let n = 0;
      b.root.traverse((o) => {
        if (!o.isMesh || !o.userData.parts) return;
        o.userData.parts.forEach((p) => {
          if (n > 150 || Math.random() < 0.35) return;
          p.box.getCenter(v).applyMatrix4(o.matrixWorld);
          const sz = new V3(); p.box.getSize(sz);
          const s = clamp((sz.x + sz.y + sz.z) / 3, 0.18, 0.9);
          const dx = v.x - b.pos.x, dz = v.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
          FX.chunk(v.x, v.y, v.z, dx / d * (2 + Math.random() * 5), 2 + Math.random() * 6, dz / d * (2 + Math.random() * 5), s, p.color.getHex(), 2.4 + Math.random());
          n++;
        });
      });
      b.root.visible = false;
      FX.shock(b.pos.x, b.pos.z, 16, b.def.color, 1.1);
      FX.sparks(b.pos.x, b.pos.y + b.rig.H * 0.5, b.pos.z, 60, b.def.color, 9);
      FX.scorch(b.pos.x, b.pos.z, 4, 0x0e0c0a, 8);
      G.Perf.flash(new V3(b.pos.x, b.pos.y + 3, b.pos.z), 0xffffff, 5, 30, 300);
      game.zombies.slice().forEach((z) => { if (z.alive) { z.alive = false; z.hp = 0; G.ZombieFX.onDeath(game, z); } });
      game.zombies = [];
      game.targetPair = null;
      G.Arena.unseal(game);
    },
    after(game) {
      const b = this.boss;
      if (!b) { this.phase = null; return; }
      const S = G.save.bosses;
      S.defeated[b.def.id] = (S.defeated[b.def.id] || 0) + 1;
      G.persist();
      this.run.downs.push({ id: b.def.id, wave: game.wave, secs: this.stats.fightT });
      this.lastStats = this.stats;
      G.Objectives.onBossDefeated();
      G.unlockAchievement("first_boss");
      game.player.score += 1000 + 100 * game.wave;
      G.BossModels.dispose(b.rig);
      this.boss = null;
      FX.reset();
      this.phase = "after";
      game.afterBoss(b.def);
    },
    // a run ends or is left: nothing of a boss stays behind
    reset(game) {
      if (this.boss) G.BossModels.dispose(this.boss.rig);
      this.clones.forEach((c) => { if (c.root.parent) c.root.parent.remove(c.root); c.mats.forEach((m) => m.dispose()); });
      this.boss = null; this.phase = null; this.pools = []; this.clones = [];
      G.Arena.reset(game);
      FX.reset();
      if (G.Audio && G.Audio.bossMusic) G.Audio.bossMusic(false);
      if (game) { game.bossSlow = 1; game.bossRootT = 0; }
    },
    // every gun's sprint against the gaze (reported by the round 6 test):
    // sprint is 5.2 m/s times the gun's weight class
    laserCheck() {
      return Object.values(G.WEAPON_DEFS).map((d) => {
        const sprint = G.CONFIG.player.sprintSpeed * G.weightClass(d).speedMult;
        return { id: d.id, sprint: Math.round(sprint * 100) / 100, ok: sprint > this.LASER_SPEED };
      });
    },
  };
})();
