// ===================================================================
// The forest round the school (visual series, round 3, L)
// -------------------------------------------------------------------
// Past the fence there used to be nothing: the ground slab ended and the fog
// did the rest. Now a wood stands all the way round, corners too, in three
// layers out from the fence:
//   near   0-15 m: tall grass, thickets, fallen logs, roots, dead trees among
//          living ones, the trunks nearest the fence darkest (a frame for the
//          picture, K), and here and there a cluster of glowing mushrooms or
//          crystals -- cyan, a light of their own (J): a lamp in the pool for
//          the nearest few, a pool of light on the ground under each, their
//          colour spilt onto the forest floor and the trunks beside them
//   mid    15-60 m: trunks close together, crowns as dark shapes against the
//          moonlit fog, with a rim of light on them (G)
//   far    past 60 m: tree lines painted on bands (impostors) and a ring of
//          hills, fading into the fog
// A road runs out of the gate into it. Nothing in it can be reached or
// entered (L2: js/world.js's sealed line round the campus is a thick wall
// now, and js/game.js tryMove steps every move), nothing is born in it (L3:
// G.inPlayArea), and it costs few draw calls: one InstancedMesh per kind of
// tree, bush, log or tuft and per side of the campus -- a side behind the
// player is culled, one past the fog is not drawn -- with flat cards
// (impostors) for the middle layer on Very Low and Low; the bands, the hills
// and the ground are a mesh each. It sways with the grass's wind
// (G.SchoolDress.sway). Every value: G.VISUAL.forest; how much of it at each
// graphics level: G.VISUAL.quality[q].forest.
// ===================================================================
(function () {
  const CFG = () => G.VISUAL;
  const V3 = THREE.Vector3;
  const num = (x) => { const s = String(+x); return /[.e]/.test(s) ? s : s + ".0"; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const KINDS = ["leafy", "leafy2", "dead", "pine", "bush", "log", "grass", "mushrooms", "crystals", "pineMid", "leafyMid", "cards"];

  // ---- geometry: parts painted with vertex colours, merged into one ------
  function builder() {
    const pos = [], nor = [], col = [], idx = [];
    const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new V3(), c = new THREE.Color();
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), p = new V3();
    const B = {
      // a geometry placed by (x, y, z), rotation (rx, ry, rz) and scale, in one colour
      add(geo, hex, x, y, z, rx, ry, rz, sx, sy, sz, k) {
        if (!geo.attributes.normal) geo.computeVertexNormals();
        e.set(rx || 0, ry || 0, rz || 0); q.setFromEuler(e);
        m4.compose(p.set(x || 0, y || 0, z || 0), q, s.set(sx || 1, sy || 1, sz || 1));
        n3.getNormalMatrix(m4);
        c.setHex(hex); if (k != null) c.multiplyScalar(k);
        const P = geo.attributes.position, N = geo.attributes.normal, b = pos.length / 3;
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m4); pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(N, i).applyMatrix3(n3).normalize(); nor.push(v.x, v.y, v.z);
          col.push(c.r, c.g, c.b);
        }
        if (geo.index) { const I = geo.index.array; for (let i = 0; i < I.length; i++) idx.push(b + I[i]); }
        else for (let i = 0; i < P.count; i++) idx.push(b + i);
        geo.dispose();
        return B;
      },
      // a blade or a thin strip: raw triangles, normals given
      tri(a, b2, c2, n, hexA, hexB) {
        const b = pos.length / 3;
        [a, b2, c2].forEach((pt, i) => { pos.push(pt[0], pt[1], pt[2]); nor.push(n[0], n[1], n[2]); c.setHex(i === 2 ? hexB : hexA); col.push(c.r, c.g, c.b); });
        idx.push(b, b + 1, b + 2);
        return B;
      },
      done() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeBoundingBox(); g.computeBoundingSphere();
        return g;
      },
    };
    return B;
  }
  // a lumpy ball: a subdivided cube pushed out to a sphere (as js/schooldress.js does)
  function blobGeo(R, seg, lump) {
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), P = g.attributes.position, v = new V3();
    const a = R() * 6, b = R() * 6, c = R() * 6;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).normalize();
      v.multiplyScalar(1 + (lump || 0.22) * Math.sin(v.x * 5.1 + a) * Math.sin(v.y * 4.3 + b) * Math.sin(v.z * 3.7 + c));
      P.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---- the kinds of thing in the wood (one geometry each, base at y = 0) --
  const PROTO = {
    // a broadleaf: a leaning trunk in three pieces, roots, limbs, a crown with gaps
    leafy(R, F, tall) {
      const B = builder(), h = tall ? 8.6 : 7.0, L = F.leaf;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.28 + R() * 0.6, l = 0.9 + R() * 0.7;
        B.add(new THREE.BoxGeometry(l, 0.16, 0.2), F.root, Math.cos(a) * l * 0.42, 0.05, Math.sin(a) * l * 0.42, 0, -a, -0.22);
      }
      let x = 0, y = 0, z = 0;
      const dir = R() * 6.28, lean = 0.05 + R() * 0.08, tops = [];
      for (let s = 0; s < 3; s++) {
        const len = h * 0.62 / 3, w = 0.56 * (1 - s * 0.2), ang = lean * (s + 1);
        const dx = Math.sin(ang) * Math.cos(dir), dz = Math.sin(ang) * Math.sin(dir);
        B.add(new THREE.BoxGeometry(w, len + 0.12, w), s ? F.bark2 : F.bark, x + dx * len / 2, y + len / 2, z + dz * len / 2, -ang * Math.sin(dir), R() * 3, ang * Math.cos(dir));
        x += dx * len; z += dz * len; y += len;
        tops.push({ x, y, z });
      }
      for (let b = 0; b < 4; b++) {
        const j = tops[1 + (b % 2)], a = b / 4 * 6.28 + R(), len = 1.3 + R() * 1.2, up = 0.4 + R() * 0.4;
        B.add(new THREE.BoxGeometry(len, 0.15, 0.15), F.bark2, j.x + Math.cos(a) * len * 0.42, j.y + up * len * 0.3, j.z + Math.sin(a) * len * 0.42, 0, -a, up);
      }
      const t = tops[2], n = tall ? 6 : 5;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.28 + R() * 0.5, r = (tall ? 1.15 : 1.45) + R() * 0.5, d = k ? 1.1 + R() * 0.6 : 0;
        B.add(blobGeo(R, 2, 0.25), L[k % L.length], t.x + Math.cos(a) * d, t.y + (tall ? (k % 3) * 0.9 - 0.4 : R() * 0.7 - 0.2), t.z + Math.sin(a) * d, 0, R() * 6, 0, r, r * 0.72, r);
      }
      return B.done();
    },
    // dead and bare: limbs and twigs, no leaves
    dead(R, F) {
      const B = builder(), h = 6.2;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * 6.28 + R() * 0.7, l = 0.8 + R() * 0.6;
        B.add(new THREE.BoxGeometry(l, 0.14, 0.18), F.root, Math.cos(a) * l * 0.4, 0.05, Math.sin(a) * l * 0.4, 0, -a, -0.25);
      }
      let x = 0, y = 0, z = 0;
      const dir = R() * 6.28, tops = [];
      for (let s = 0; s < 3; s++) {
        const len = h / 3, w = 0.48 * (1 - s * 0.24), ang = (0.08 + R() * 0.1) * (s % 2 ? -1 : 1) * (s + 1);
        const dx = Math.sin(ang) * Math.cos(dir), dz = Math.sin(ang) * Math.sin(dir);
        B.add(new THREE.BoxGeometry(w, len + 0.1, w), F.dead, x + dx * len / 2, y + len / 2, z + dz * len / 2, -ang * Math.sin(dir), R() * 3, ang * Math.cos(dir));
        x += dx * len; z += dz * len; y += len;
        tops.push({ x, y, z });
      }
      for (let b = 0; b < 7; b++) {
        const j = tops[b % 3 === 0 ? 0 : b % 3], a = b / 7 * 6.28 + R() * 0.7, len = 1.2 + R() * 1.8, up = 0.35 + R() * 0.55;
        const mx = j.x + Math.cos(a) * len * 0.45, my = j.y - 0.3 + up * len * 0.4, mz = j.z + Math.sin(a) * len * 0.45;
        B.add(new THREE.BoxGeometry(len, 0.13, 0.13), F.dead, mx, my, mz, 0, -a, up);
        const ex = j.x + Math.cos(a) * len * 0.9, ey = my + up * len * 0.4, ez = j.z + Math.sin(a) * len * 0.9;
        const ta = a + (b % 2 ? 0.7 : -0.6), tl = 0.5 + R() * 0.6;
        B.add(new THREE.BoxGeometry(tl, 0.06, 0.06), F.dead, ex + Math.cos(ta) * tl * 0.4, ey + 0.15, ez + Math.sin(ta) * tl * 0.4, 0, -ta, 0.6);
      }
      return B.done();
    },
    // a fir: a straight trunk, tiers of dark needles -- the silhouette of a wood
    pine(R, F, mid) {
      const B = builder(), h = mid ? 11 : 10, tiers = mid ? 3 : 5, seg = mid ? 6 : 7;
      B.add(new THREE.CylinderGeometry(0.16, 0.34, h * 0.9, mid ? 5 : 6), F.bark, 0, h * 0.45, 0);
      for (let k = 0; k < tiers; k++) {
        const f = k / tiers, r = (mid ? 2.7 : 2.5) * (1 - f * 0.72), th = h * (mid ? 0.42 : 0.3);
        B.add(new THREE.ConeGeometry(r, th, seg), F.pine[k % F.pine.length], 0, h * 0.2 + f * h * 0.66 + th / 2, 0, 0, R() * 3, 0);
      }
      return B.done();
    },
    // the middle layer's broadleaf: a trunk and three lumps of crown
    leafyMid(R, F) {
      const B = builder(), h = 7.8;
      B.add(new THREE.BoxGeometry(0.5, h * 0.66, 0.5), F.bark, 0, h * 0.33, 0);
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * 6.28 + R(), r = 1.9 + R() * 0.6;
        B.add(blobGeo(R, 1, 0.2), F.leaf[k % F.leaf.length], Math.cos(a) * 0.9, h * 0.72 + k * 0.5, Math.sin(a) * 0.9, 0, R() * 6, 0, r, r * 0.75, r);
      }
      return B.done();
    },
    // a thicket: three or four lumps, low
    bush(R, F) {
      const B = builder();
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * 6.28 + R(), d = k ? 0.6 + R() * 0.4 : 0, r = 0.55 + R() * 0.45;
        B.add(blobGeo(R, 2, 0.3), F.bush[k % F.bush.length], Math.cos(a) * d, r * 0.55, Math.sin(a) * d, 0, R() * 6, 0, r, r * 0.8, r);
      }
      return B.done();
    },
    // a fallen trunk, its broken limbs and a root plate
    log(R, F) {
      const B = builder(), len = 4.6;
      B.add(new THREE.CylinderGeometry(0.3, 0.36, len, 7), F.log, 0, 0.3, 0, Math.PI / 2, 0, 0);
      B.add(blobGeo(R, 2, 0.35), F.root, 0, 0.55, len / 2 + 0.1, 0, 0, 0, 0.9, 0.75, 0.3);
      for (let b = 0; b < 3; b++) B.add(new THREE.BoxGeometry(0.09, 0.9 + R() * 0.6, 0.09), F.log, (R() - 0.5) * 0.3, 0.75, -len / 2 + 0.8 + b * 1.2, 0.3 - R() * 0.6, 0, 0.5 - R());
      B.add(blobGeo(R, 1, 0.2), F.moss, 0, 0.58, -0.6, 0, 0, 0, 0.45, 0.12, 1.1);
      return B.done();
    },
    // tall grass by the fence: thin blades from one root, bending over
    grass(R, F) {
      const B = builder(), n = 7;
      for (let b = 0; b < n; b++) {
        const a = b / n * 6.28 + R() * 0.8, h = 0.85 + R() * 0.75, w = 0.035 + R() * 0.02;
        const ox = Math.cos(a) * 0.12 * R(), oz = Math.sin(a) * 0.12 * R();
        const px = Math.cos(a + 1.57) * w, pz = Math.sin(a + 1.57) * w, lean = 0.2 + R() * 0.35;
        const tip = [ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean];
        const hex = F.grass[b % F.grass.length];
        B.tri([ox - px, 0, oz - pz], [ox + px, 0, oz + pz], tip, [0, 1, 0], F.grassRoot, hex);
        B.tri([ox + px, 0, oz + pz], [ox - px, 0, oz - pz], tip, [0, 1, 0], F.grassRoot, hex);
      }
      return B.done();
    },
    // glowing mushrooms: pale stems, caps of light (the material is the glow colour)
    mushrooms(R) {
      const B = builder();
      for (let k = 0; k < 6; k++) {
        const a = R() * 6.28, d = k ? 0.12 + R() * 0.32 : 0, h = 0.08 + R() * 0.22, r = 0.05 + R() * 0.09;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        B.add(new THREE.CylinderGeometry(0.022, 0.032, h, 5), 0x1e2a2c, x, h / 2, z);
        B.add(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, x, h - 0.01, z, 0, 0, 0, r, r * 0.55, r);
      }
      return B.done();
    },
    // crystals out of a stone: long points of light
    crystals(R) {
      const B = builder();
      B.add(blobGeo(R, 1, 0.3), 0x0e1416, 0, 0.12, 0, 0, 0, 0, 0.42, 0.22, 0.36);
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * 6.28 + R(), tilt = 0.15 + R() * 0.45, s = 0.6 + R() * 0.6;
        B.add(new THREE.OctahedronGeometry(0.12, 0), k ? 0xc8f4ff : 0xffffff, Math.cos(a) * 0.12, 0.18 + 0.3 * s, Math.sin(a) * 0.12, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt, 0.6 * s, 2.8 * s, 0.6 * s);
      }
      return B.done();
    },
  };

  // ---- textures: the far tree lines and the cards (impostors) ------------
  function treeShapes(g, x, base, h, kind, fill) {
    g.fillStyle = fill;
    if (kind === "pine") {
      for (let t = 0; t < 4; t++) {
        const w = h * (0.34 - t * 0.065), y0 = base - h * (0.18 + t * 0.2);
        g.beginPath(); g.moveTo(x - w, y0); g.lineTo(x + w, y0); g.lineTo(x, y0 - h * 0.34); g.closePath(); g.fill();
      }
      g.fillRect(x - h * 0.03, base - h * 0.2, h * 0.06, h * 0.2);
    } else if (kind === "dead") {
      g.fillRect(x - h * 0.035, base - h * 0.9, h * 0.07, h * 0.9);
      g.lineWidth = Math.max(1, h * 0.025); g.strokeStyle = fill;
      for (let b = 0; b < 6; b++) {
        const y = base - h * (0.4 + b * 0.09), s = b % 2 ? 1 : -1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * h * (0.18 + (b % 3) * 0.06), y - h * 0.16); g.stroke();
      }
    } else {
      g.fillRect(x - h * 0.04, base - h * 0.45, h * 0.08, h * 0.45);
      const blobs = kind === "bush" ? [[0, 0.2, 0.22], [-0.16, 0.14, 0.16], [0.17, 0.15, 0.17]] : [[0, 0.62, 0.24], [-0.17, 0.52, 0.19], [0.18, 0.5, 0.2], [0.04, 0.78, 0.17], [-0.06, 0.4, 0.15]];
      blobs.forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx * h, base - dy * h, r * h, 0, 7); g.fill(); });
    }
  }
  // a band of tree line, seamless left to right: a rim of moonlight along the
  // tops (drawn first in the rim colour, then the shapes again a little lower)
  function bandTexture(F, R) {
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 256;
    const g = cv.getContext("2d");
    const trees = [];
    for (let i = 0; i < 34; i++) trees.push({ x: i / 34 * 1024 + (R() - 0.5) * 18, h: 120 + R() * 125, k: R() < 0.6 ? "pine" : R() < 0.85 ? "round" : "dead" });
    const draw = (fill, dy) => trees.forEach((t) => [-1024, 0, 1024].forEach((o) => treeShapes(g, t.x + o, 256 + dy, t.h, t.k, fill)));
    draw(F.rimCss, 0);
    draw(F.bandCss, 3);
    g.fillStyle = F.bandCss; g.fillRect(0, 236, 1024, 20);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }
  // four square cards side by side: a fir, a broadleaf, a dead tree, a fir again
  function cardTexture(F) {
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 256;
    const g = cv.getContext("2d");
    ["pine", "round", "dead", "pine"].forEach((k, i) => {
      treeShapes(g, i * 256 + 128, 256, 248, k, F.rimCss);
      treeShapes(g, i * 256 + 128, 259, 248, k, F.cardCss);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  // the forest floor's texture: leaf litter and moss, faint
  function floorTexture(R) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const g = cv.getContext("2d");
    g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const v = 100 + Math.floor(R() * 70);
      g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.globalAlpha = 0.3 + R() * 0.4;
      const s = 2 + R() * 7; g.fillRect(R() * 256, R() * 256, s, s * (0.4 + R()));
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  G.Forest = {
    built: false,

    // ---- where things are ------------------------------------------------
    // (the fence's line: the campus less the half metre its posts stand in)
    rectOf(world) { const C = world.campus; return C ? { x0: C.x0 + 0.5, x1: C.x1 - 0.5, z0: C.z0 + 0.5, z1: C.z1 - 0.5 } : null; },
    // how far past the fence (0 inside)
    out(x, z) { const R = this.rect; return Math.hypot(Math.max(R.x0 - x, 0, x - R.x1), Math.max(R.z0 - z, 0, z - R.z1)); },
    side(x, z) {
      const R = this.rect, o = [R.x0 - x, x - R.x1, R.z0 - z, z - R.z1];
      let k = 0; for (let i = 1; i < 4; i++) if (o[i] > o[k]) k = i;
      return k;                          // 0 west (the field), 1 east (the garden), 2 north (the back), 3 south (the road)
    },
    onRoad(x, z, pad) { return z > this.rect.z1 - 1 && Math.abs(x) < CFG().forest.road + (pad || 0); },
    groundY(x, z) {
      const d = this.out(x, z);
      if (d <= 0) return -0.05;
      const n = Math.sin(x * 0.071 + z * 0.023) * Math.sin(z * 0.064 - x * 0.031) * 0.5 + 0.5;
      const flat = this.onRoad(x, z, 3) ? 0 : 1;
      return -0.05 + smooth(3, 22, d) * flat * (0.15 + 0.55 * n);
    },
    // the nearest point of the wood's edge (just past the fence) from (x, z)
    edgePoint(x, z, out) {
      const R = this.rect, o = out || new V3();
      const cx = Math.max(R.x0, Math.min(R.x1, x)), cz = Math.max(R.z0, Math.min(R.z1, z));
      const d = [cx - R.x0, R.x1 - cx, cz - R.z0, R.z1 - cz];
      let k = 0; for (let i = 1; i < 4; i++) if (d[i] < d[k]) k = i;
      const m = 3;
      o.set(k === 0 ? R.x0 - m : k === 1 ? R.x1 + m : cx, 1.5, k === 2 ? R.z0 - m : k === 3 ? R.z1 + m : cz);
      return o;
    },

    // ---- building ----------------------------------------------------------
    // (js/game.js prepareScene, the school only: after G.LightFX.build, for the
    // lights, the pools of light and the registry; before the merge, which
    // leaves InstancedMeshes and world.noMerge alone)
    build(game) {
      this.built = false;
      this.chunks = []; this.meshes = []; this.mats = [];
      const W = game.world, F = CFG().forest;
      if (!F || !W || !W.campus || !W.dress || game.level.theme !== "school") return;
      this.game = game; this.world = W; this.scene = game.scene;
      this.rect = this.rectOf(W);
      const R = G.makeRng(F.seed);
      this.group = new THREE.Group(); this.group.name = "forest";
      game.scene.add(this.group);
      W.noMerge = W.noMerge || [];
      W.noMerge.push(this.group);
      this.group.userData.zone = "O";
      // (the forest is shown and hidden by G.Forest.update, not js/zones.js)
      this.group.frustumCulled = false;
      const pal = this.palette(F);
      this.materials(F, W);
      // what goes where; the glowing clusters' colours, for what grows beside them
      const items = this.scatter(R, F);
      this._spill = items.mushrooms.map((it) => ({ x: it.x, z: it.z, c: new THREE.Color(F.glow.mushroom) }))
        .concat(items.crystals.map((it) => ({ x: it.x, z: it.z, c: new THREE.Color(F.glow.crystal) })));
      // the prototypes (two of the broadleaf: a round crown and a tall one)
      const geos = {
        leafy: PROTO.leafy(R, pal, false), leafy2: PROTO.leafy(R, pal, true), dead: PROTO.dead(R, pal), pine: PROTO.pine(R, pal, false),
        bush: PROTO.bush(R, pal), log: PROTO.log(R, pal), grass: PROTO.grass(R, pal), mushrooms: PROTO.mushrooms(R), crystals: PROTO.crystals(R),
        pineMid: PROTO.pine(R, pal, true), leafyMid: PROTO.leafyMid(R, pal), cards: this.cardGeo(),
      };
      KINDS.forEach((k) => this.emit(k, geos[k], items[k] || []));
      Object.values(geos).forEach((g) => g.dispose());
      this.glow(F, items);
      this.floor(F, R, items);
      this.far(F, R);
      if (G.LightFX && G.LightFX.note) {
        G.LightFX.note("the forest: its trees, thickets and hills (a rim against the fog)", "ambient", false);
        G.LightFX.note("glowing mushrooms and crystals in the forest (" + (items.mushrooms.length + items.crystals.length) + ")", "environmental (cyan)", true);
      }
      this.stats = {}; KINDS.forEach((k) => (this.stats[k] = (items[k] || []).length));
      this.items = items;                // (where everything stands: tools/round20-test.js)
      this._t = 0; this._at = null;
      this.built = true;
    },

    palette(F) {
      const P = F.colors, css = (hex) => "#" + new THREE.Color(hex).getHexString();
      return { bark: P.bark, bark2: P.bark2, root: P.root, dead: P.dead, leaf: P.leaf, pine: P.pine, bush: P.bush, log: P.log, moss: P.moss, grass: P.grass, grassRoot: P.grassRoot,
        rimCss: css(P.rimPaint), bandCss: css(P.band), cardCss: css(P.card) };
    },

    // the materials: per-vertex light (the props' own way), the forest's rim,
    // the grass's wind, and the fog taking the middle and far layers later
    materials(F, W) {
      const rim = { color: new THREE.Color(F.rim.color).multiplyScalar(F.rim.strength), power: F.rim.power, outdoor: true };
      const fogEnd = num(F.fogEnd);
      const lit = (o) => {
        const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
        m.userData.vzRim = rim;
        if (o.fog != null && o.fog !== 1) m.defines = { VZ_FOG_DIST: num(o.fog), VZ_FOG_END: fogEnd };
        if (o.sway && G.SchoolDress && G.SchoolDress.sway) G.SchoolDress.sway(W, m, o.sway);
        this.mats.push(m);
        return m;
      };
      const S = F.sway;
      this.mat = {
        tree: lit({ sway: { height: 9, amp: S.trees, freq: 0.5, bend: false } }),
        bush: lit({ sway: { height: 1.4, amp: S.bushes, freq: 0.8, bend: false } }),
        log: lit({}),
        grass: lit({ double: true, sway: { height: 1.6, amp: S.grass, freq: 1, bend: true } }),
        mid: lit({ fog: F.fog.mid, sway: { height: 10, amp: S.trees * 0.7, freq: 0.45, bend: false } }),
      };
      const glowK = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
      this.mat.mushrooms = new THREE.MeshBasicMaterial({ vertexColors: true, color: glowK(F.glow.mushroom, F.glow.k) });
      this.mat.crystals = new THREE.MeshBasicMaterial({ vertexColors: true, color: glowK(F.glow.crystal, F.glow.k) });
      [this.mat.mushrooms, this.mat.crystals].forEach((m) => { m.userData.vzForestGlow = true; this.mats.push(m); });
      // the cards: a picture of a tree that turns to face the camera (upright)
      const card = new THREE.MeshBasicMaterial({ map: cardTexture(this.palette(F)), alphaTest: 0.5, side: THREE.DoubleSide });
      card.defines = { VZ_FOG_DIST: num(F.fog.mid), VZ_FOG_END: fogEnd };
      card.onBeforeCompile = (shader) => {
        shader.vertexShader = "attribute float aTile;\n" + shader.vertexShader
          .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_UV\n  vUv.x = ( vUv.x + aTile ) * 0.25;\n#endif")
          .replace("#include <project_vertex>", [
            "#ifdef USE_INSTANCING",
            "  vec3 vzC = instanceMatrix[ 3 ].xyz;",
            "  float vzSx = length( instanceMatrix[ 0 ].xyz ), vzSy = length( instanceMatrix[ 1 ].xyz );",
            "#else",
            "  vec3 vzC = vec3( 0.0 ); float vzSx = 1.0, vzSy = 1.0;",
            "#endif",
            // (the camera's right, level: the first row of the view matrix)
            "  vec3 vzR = normalize( vec3( viewMatrix[ 0 ][ 0 ], 0.0, viewMatrix[ 2 ][ 0 ] ) + vec3( 1e-5, 0.0, 0.0 ) );",
            "  vec3 vzW = vzC + vzR * transformed.x * vzSx + vec3( 0.0, transformed.y * vzSy, 0.0 );",
            "  vec4 mvPosition = viewMatrix * vec4( vzW, 1.0 );",
            "  gl_Position = projectionMatrix * mvPosition;",
          ].join("\n"));
      };
      const proto = THREE.Material.prototype.customProgramCacheKey;
      card.customProgramCacheKey = function () { return proto.call(this) + "|forest-card"; };
      this.mat.cards = card; this.mats.push(card);
    },

    // a card: a unit quad standing on its foot
    cardGeo() {
      const g = new THREE.PlaneGeometry(1, 1);
      g.translate(0, 0.5, 0);
      return g;
    },

    // ---- what grows where (L1) -----------------------------------------------
    // rejection sampling in a box round the fence: a point is kept if it falls
    // in its band, off the road; the instances of each kind then go in a
    // random order, so the first n of them are an even sprinkling (a lower
    // graphics level draws fewer, not a part of the ring)
    scatter(R, F) {
      const rect = this.rect, D = F.density, out = {};
      KINDS.forEach((k) => (out[k] = []));
      const band = (a, b, rho, fn) => {
        const per = 2 * (rect.x1 - rect.x0 + rect.z1 - rect.z0), area = per * (b - a) + Math.PI * (b * b - a * a);
        const n = Math.round(area * rho);
        let made = 0, tries = 0;
        const X0 = rect.x0 - b, X1 = rect.x1 + b, Z0 = rect.z0 - b, Z1 = rect.z1 + b;
        while (made < n && tries++ < n * 40) {
          const x = X0 + R() * (X1 - X0), z = Z0 + R() * (Z1 - Z0), d = this.out(x, z);
          if (d < a || d > b) continue;
          if (fn(x, z, d)) made++;
        }
      };
      const put = (kind, x, z, d, o) => {
        o = o || {};
        out[kind].push({ x, z, y: this.groundY(x, z), d, ry: R() * 6.28, s: o.s || 1, sy: o.sy || 1, tint: o.tint == null ? 0.85 + R() * 0.3 : o.tint, side: this.side(x, z) });
        return true;
      };
      const N = F.near, M = F.mid, road = (x, z, p) => this.onRoad(x, z, p);
      // trees near the fence: four kinds, not too close together
      const trunks = [];
      const clear = (x, z, r) => !trunks.some((t) => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r && Math.hypot(t.x - x, t.z - z) < r);
      // (a clearing where the road leaves the gate: no crown hangs over it)
      const gateClear = (x, z) => z > this.rect.z1 && z < this.rect.z1 + F.gateClearing[1] && Math.abs(x) < F.gateClearing[0];
      band(0.9, N, D.trees, (x, z, d) => {
        if (road(x, z, 1.5) || gateClear(x, z) || !clear(x, z, 2.4)) return false;
        const r = R(), kind = r < 0.3 ? "leafy" : r < 0.48 ? "leafy2" : r < 0.72 ? "dead" : "pine";
        trunks.push({ x, z });
        return put(kind, x, z, d, { s: 0.8 + R() * 0.5 });
      });
      band(0.6, N, D.bushes, (x, z, d) => !road(x, z, 0.5) && clear(x, z, 0.9) && put("bush", x, z, d, { s: 0.7 + R() * 0.7, sy: 0.8 + R() * 0.5 }));
      band(1.5, N, D.logs, (x, z, d) => !road(x, z, 3) && clear(x, z, 1.6) && put("log", x, z, d, { s: 0.8 + R() * 0.5 }));
      band(0.3, N * 0.75, D.grass, (x, z, d) => !road(x, z, 0) && put("grass", x, z, d, { s: 0.8 + R() * 0.6, sy: 0.85 + R() * 0.5 }));
      // the glow: mushrooms at the trees' feet, crystals in the open
      band(1.2, N, D.glow, (x, z, d) => !road(x, z, 1) && put(R() < F.glow.mushroomShare ? "mushrooms" : "crystals", x, z, d, { s: 1.0 + R() * 0.8, tint: 1 }));
      // the middle layer: firs and broadleaves, thick; the cards stand in the same places
      band(N, M, D.mid, (x, z, d) => {
        if (road(x, z, 2)) return false;
        const kind = R() < 0.62 ? "pineMid" : "leafyMid", s = 0.85 + R() * 0.55;
        put(kind, x, z, d, { s, sy: 0.9 + R() * 0.35 });
        const c = out[kind][out[kind].length - 1];
        // (a card is a square picture: as wide as the tree is tall, a little narrower)
        out.cards.push({ x, z, y: c.y, d, ry: 0, s: (kind === "pineMid" ? 9.5 : 9.0) * s, sy: (kind === "pineMid" ? 11.5 : 9.5) * s * c.sy, tint: c.tint, side: c.side, tile: kind === "pineMid" ? (R() < 0.5 ? 0 : 3) : (R() < 0.8 ? 1 : 2) });
        return true;
      });
      Object.keys(out).forEach((k) => { const a = out[k]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } });
      return out;
    },

    // ---- one InstancedMesh per kind and side of the campus -------------------
    // (r128 culls an InstancedMesh by its geometry's bounds: each side's copy
    // of the geometry is given bounds that really hold its instances)
    emit(kind, geo, list) {
      const F = CFG().forest, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3(), p = new V3(), c = new THREE.Color();
      const mat = { leafy: "tree", leafy2: "tree", dead: "tree", pine: "tree", pineMid: "mid", leafyMid: "mid" }[kind] || kind;
      const layer = kind === "pineMid" || kind === "leafyMid" || kind === "cards" ? "mid" : "near";
      const spillAt = this._spill || [];
      for (let side = 0; side < 4; side++) {
        const its = list.filter((it) => it.side === side);
        if (!its.length) continue;
        const g = geo.clone(), b = new THREE.Box3();
        const mesh = new THREE.InstancedMesh(g, this.mat[mat], its.length);
        its.forEach((it, i) => {
          e.set(0, it.ry, 0); q.setFromEuler(e);
          m4.compose(p.set(it.x, it.y, it.z), q, s.set(it.s, it.s * it.sy, it.s));
          if (kind === "cards") m4.compose(p.set(it.x, it.y - 0.3, it.z), q.identity(), s.set(it.s, it.sy, 1));
          mesh.setMatrixAt(i, m4);
          // the colour: a little variety; darker the nearer the fence (a frame
          // for the view, K); a touch of cyan beside a glowing cluster (J)
          let k = it.tint;
          if (layer === "near" && kind !== "mushrooms" && kind !== "crystals") k *= 1 - F.framing * (1 - smooth(1, 6, it.d));
          c.setRGB(k, k, k);
          if (kind !== "mushrooms" && kind !== "crystals" && kind !== "cards") {
            for (const sp of spillAt) {
              const d = Math.hypot(sp.x - it.x, sp.z - it.z);
              if (d < F.glow.spillReach) c.lerp(sp.c, F.glow.spillTrunk * (1 - d / F.glow.spillReach));
            }
          }
          mesh.setColorAt(i, c);
          b.expandByPoint(p.set(it.x, it.y, it.z));
        });
        if (kind === "cards") {
          const tiles = new Float32Array(its.length);
          its.forEach((it, i) => { tiles[i] = it.tile || 0; });
          g.setAttribute("aTile", new THREE.InstancedBufferAttribute(tiles, 1));
        }
        // (the box: where the instances stand, as wide as a crown reaches out and
        // as tall as the tallest -- the geometry's own extent, scaled)
        const gb = geo.boundingBox || (geo.computeBoundingBox(), geo.boundingBox);
        const sMax = its.reduce((m, it) => Math.max(m, kind === "cards" ? it.s * 0.5 : it.s), 0), syMax = its.reduce((m, it) => Math.max(m, kind === "cards" ? it.sy : it.s * it.sy), 0);
        const rx = kind === "cards" ? sMax : Math.hypot(Math.max(Math.abs(gb.min.x), Math.abs(gb.max.x)), Math.max(Math.abs(gb.min.z), Math.abs(gb.max.z))) * sMax;
        b.min.x -= rx; b.max.x += rx; b.min.z -= rx; b.max.z += rx;
        b.min.y -= 0.5; b.max.y += (kind === "cards" ? 1 : gb.max.y) * syMax + 0.5;
        g.boundingBox = b; g.boundingSphere = b.getBoundingSphere(new THREE.Sphere());
        mesh.frustumCulled = true;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        mesh.receiveShadow = kind !== "mushrooms" && kind !== "crystals" && kind !== "cards";
        mesh.castShadow = false;
        // (js/sky.js afterPrepare: only what this file says casts a shadow)
        mesh.userData.lowLying = true;
        mesh.userData.forest = { kind, layer, side, max: its.length };
        this.group.add(mesh);
        this.chunks.push({ mesh, kind, layer, side, max: its.length, box: b, fog: layer === "mid" ? F.fog.mid : 1 });
      }
    },

    // ---- the glow (J, I): the clusters' lights, their pools, their spill -----
    glow(F, items) {
      const G2 = F.glow, LF = G.LightFX, all = items.mushrooms.concat(items.crystals);
      // spill and pools for every cluster near enough to matter; lights for a
      // few, spread round the ring (the nearest the fence first)
      const lit = all.filter((it) => it.d < G2.lightReach).sort((a, b) => a.d - b.d);
      const chosen = [];
      lit.forEach((it) => { if (chosen.length < G2.lights && chosen.every((o) => Math.hypot(o.x - it.x, o.z - it.z) > G2.lightGap)) chosen.push(it); });
      this.lights = [];
      all.forEach((it) => {
        const hex = items.mushrooms.includes(it) ? G2.mushroom : G2.crystal;
        const light = chosen.includes(it) && LF && LF.lit ? LF.lit(it.x, it.y + 0.45, it.z, hex, G2.intensity, G2.distance, { steady: true, priority: G2.priority, lampKind: "forest" }) : null;
        if (light) this.lights.push(light);
        if (LF && LF.decalSrc) LF.decalSrc.push({ x: it.x, y: it.y + 0.025, z: it.z, sx: G2.pool * it.s, sz: G2.pool * it.s, color: hex, light, k: G2.poolK });
        // (a crystal's cluster: a faint haze above it, in the air picture, Medium and up)
        if (LF && LF.coneSrc && light && hex === G2.crystal) LF.coneSrc.push({ top: new V3(it.x, it.y + 2.2, it.z), bottom: new V3(it.x, it.y + 0.15, it.z), r0: 0.3, r1: 0.9, color: hex, light, k: G2.haze });
        // the campus inside the fence gets a little of the nearest ones' colour
        if (LF && LF.extraSpill && !light && it.d < 4) LF.extraSpill.push({ x: it.x, y: it.y + 0.4, z: it.z, color: new THREE.Color(hex), base: G2.intensity * 0.5, distance: G2.distance * 0.6 });
      });
    },

    // ---- the forest floor: one mesh, a road out of the gate in it ----------
    floor(F, R, items) {
      const Fl = F.floor, rect = this.rect, S = Fl.step, reach = Fl.reach;
      // (on a grid with a line at x = 0: the road runs down the middle of it)
      const X0 = Math.floor((rect.x0 - reach) / S) * S, X1 = rect.x1 + reach, Z0 = Math.floor((rect.z0 - reach) / S) * S, Z1 = rect.z1 + reach;
      const nx = Math.ceil((X1 - X0) / S), nz = Math.ceil((Z1 - Z0) / S);
      const pos = [], col = [], uv = [], idx = [], vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
      const c0 = new THREE.Color(Fl.color), c1 = new THREE.Color(Fl.color2), road = new THREE.Color(Fl.road), c = new THREE.Color();
      const glows = items.mushrooms.map((it) => ({ x: it.x, z: it.z, c: new THREE.Color(F.glow.mushroom) })).concat(items.crystals.map((it) => ({ x: it.x, z: it.z, c: new THREE.Color(F.glow.crystal) })));
      // the trunks in 4 m cells, for the shade under the crowns
      const cells = new Map(), cellOf = (x, z) => Math.floor(x / 4) + "," + Math.floor(z / 4);
      ["leafy", "leafy2", "dead", "pine", "pineMid", "leafyMid"].forEach((k) => items[k].forEach((t) => { const key = cellOf(t.x, t.z); if (!cells.has(key)) cells.set(key, []); cells.get(key).push(t); }));
      const near = (x, z) => { const a = []; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const l = cells.get(cellOf(x + dx * 4, z + dz * 4)); if (l) a.push(...l); } return a; };
      const inside = (x, z) => x > rect.x0 + 0.6 && x < rect.x1 - 0.6 && z > rect.z0 + 0.6 && z < rect.z1 - 0.6;
      const vert = (i, j) => {
        const k = i + j * (nx + 1);
        if (vid[k] >= 0) return vid[k];
        const x = X0 + i * S, z = Z0 + j * S;
        const onRoad = this.onRoad(x, z, -F.road + Fl.roadHalf + 0.01);
        pos.push(x, this.groundY(x, z) + (onRoad ? 0.02 : 0), z);
        uv.push(x / 9, z / 9);
        const n = Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) * Math.sin(z * 0.17 - x * 0.05) * 0.5 + 0.5;
        c.copy(c0).lerp(c1, n);
        if (onRoad) c.copy(road).multiplyScalar(0.85 + 0.3 * n);
        // shade under the crowns
        let sh = 0;
        for (const t of near(x, z)) { const dx = t.x - x, dz = t.z - z; if (Math.abs(dx) < 4 && Math.abs(dz) < 4) sh += Math.max(0, 1 - Math.hypot(dx, dz) / 4); }
        c.multiplyScalar(1 - Fl.shade * Math.min(1, sh * 0.5));
        // the glow spilt on the ground round each cluster (J)
        for (const g2 of glows) {
          const d = Math.hypot(g2.x - x, g2.z - z);
          if (d < F.glow.spillReach * 1.4) { const f = 1 - d / (F.glow.spillReach * 1.4); c.r += g2.c.r * F.glow.spillGround * f * f; c.g += g2.c.g * F.glow.spillGround * f * f; c.b += g2.c.b * F.glow.spillGround * f * f; }
        }
        col.push(c.r, c.g, c.b);
        vid[k] = pos.length / 3 - 1;
        return vid[k];
      };
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const x = X0 + i * S, z = Z0 + j * S;
        if (inside(x, z) && inside(x + S, z) && inside(x, z + S) && inside(x + S, z + S)) continue;
        const a = vert(i, j), b = vert(i + 1, j), cc = vert(i + 1, j + 1), d = vert(i, j + 1);
        idx.push(a, d, b, b, d, cc);
      }
      // ...and a plain beyond it, lower, to the edge of the world
      const base = pos.length / 3, E = Fl.plain, y = -0.6;
      [[-E, -E], [E, -E], [E, E], [-E, E]].forEach(([x, z]) => { pos.push(x, y, z); uv.push(x / 9, z / 9); col.push(c0.r * 0.7, c0.g * 0.7, c0.b * 0.7); });
      idx.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: floorTexture(R) });
      this.mats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.userData.forest = { kind: "floor" };
      this.group.add(mesh);
      this.floorMesh = mesh;
    },

    // ---- far: tree lines on bands, and hills (impostors, a mesh each) --------
    // a path round the fence at distance d: its straight sides and a quarter
    // circle at each corner
    // (each point: x, z and the outward direction there)
    ring(d, step) {
      const r = this.rect, pts = [];
      // round the corners one way: the south-east corner's quarter circle, the
      // south side going west, the south-west corner, the west side going
      // north, and so on
      const corners = [[r.x1, r.z1, 0], [r.x0, r.z1, Math.PI / 2], [r.x0, r.z0, Math.PI], [r.x1, r.z0, Math.PI * 1.5]];
      const sides = [[r.x1, r.z1, r.x0, r.z1, 0, 1], [r.x0, r.z1, r.x0, r.z0, -1, 0], [r.x0, r.z0, r.x1, r.z0, 0, -1], [r.x1, r.z0, r.x1, r.z1, 1, 0]];
      for (let k = 0; k < 4; k++) {
        const [cx, cz, a0] = corners[k];
        for (let i = 0; i <= 8; i++) { const a = a0 + i / 8 * Math.PI / 2; pts.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d, Math.cos(a), Math.sin(a)]); }
        const [ax, az, bx, bz, nxv, nzv] = sides[k], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / step));
        for (let i = 1; i < n; i++) { const t = i / n; pts.push([ax + (bx - ax) * t + nxv * d, az + (bz - az) * t + nzv * d, nxv, nzv]); }
      }
      return pts;
    },
    // the bands and the hills, one mesh: the hills take the band picture's solid
    // foot (a strip of its bottom rows) and their own colour in the vertices
    far(F, R) {
      const pos = [], uv = [], col = [], idx = [];
      // the bands: strips of painted tree line, the nearest darkest
      F.bands.forEach((B) => {
        const pts = this.ring(B.at, 6), base = pos.length / 3, c = new THREE.Color(1, 1, 1).multiplyScalar(B.tint);
        let u = R() * 10;
        for (let i = 0; i <= pts.length; i++) {
          const p = pts[i % pts.length], q2 = pts[(i + pts.length - 1) % pts.length];
          if (i) u += Math.hypot(p[0] - q2[0], p[1] - q2[1]) / B.tile;
          pos.push(p[0], -0.8, p[1], p[0], B.h, p[1]);
          uv.push(u, 0, u, 1);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        for (let i = 0; i < pts.length; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      // the hills: a ridge all round, the moon catching its top (the rim)
      const H = F.hills, pts = this.ring(H.at, 9), base = pos.length / 3;
      const band = new THREE.Color(F.colors.band), ratio = (hex) => { const c = new THREE.Color(hex); return [c.r / Math.max(band.r, 1e-3), c.g / Math.max(band.g, 1e-3), c.b / Math.max(band.b, 1e-3)]; };
      const lo = ratio(H.color), hi = ratio(H.ridge);
      let s = 0, first = 0;
      for (let i = 0; i <= pts.length; i++) {
        const p = pts[i % pts.length], q2 = pts[(i + pts.length - 1) % pts.length];
        if (i) s += Math.hypot(p[0] - q2[0], p[1] - q2[1]);
        let h = H.h[0] + (H.h[1] - H.h[0]) * (0.5 + 0.5 * Math.sin(s * 0.011 + 1.3)) * (0.65 + 0.35 * Math.sin(s * 0.043 + 0.4)) + 3 * Math.sin(s * 0.13);
        if (i === 0) first = h; else if (i === pts.length) h = first;
        // a slope: the foot nearer the campus, the ridge further out
        pos.push(p[0] - p[2] * H.slope, -1, p[1] - p[3] * H.slope, p[0], h, p[1]);
        uv.push(0.5, 0.02, 0.5, 0.02);
        col.push(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]);
      }
      for (let i = 0; i < pts.length; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.MeshLambertMaterial({ map: bandTexture(this.palette(F), R), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
      m.userData.vzRim = { color: new THREE.Color(F.rim.color).multiplyScalar(F.rim.hills), power: F.rim.power, outdoor: true };
      m.defines = { VZ_FOG_DIST: num(F.fog.far), VZ_FOG_END: num(F.fogEnd) };
      this.mats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.userData.forest = { kind: "far" };
      this.group.add(mesh);
      this.farMesh = mesh;
      this.hillCount = (pts.length + 1) * 2;
    },

    // ---- graphics level (G.Visuals.applyQuality) -----------------------------
    applyQuality(game, q) {
      if (!this.built || !G.VISUAL.quality[q]) return;
      const Q = G.VISUAL.quality[q].forest || {};
      this.q = q;
      const frac = { leafy: Q.trees, leafy2: Q.trees, dead: Q.trees, pine: Q.trees, bush: Q.under, log: Q.under, grass: Q.grass, mushrooms: 1, crystals: 1,
        pineMid: Q.cards ? 0 : Q.mid, leafyMid: Q.cards ? 0 : Q.mid, cards: Q.cards ? Q.mid : 0 };
      const shadow = !!Q.shadows;
      this.chunks.forEach((ch) => {
        ch.n = Math.round(ch.max * Math.max(0, Math.min(1, frac[ch.kind] || 0)));
        ch.mesh.count = ch.n;
        // L4: only the near layer's trees and thickets, and only High and up
        ch.mesh.castShadow = shadow && ch.layer === "near" && /^(leafy|leafy2|dead|pine|bush)$/.test(ch.kind);
      });
      this._at = null;
      this.update(game, 0, true);
    },

    // ---- every frame: shown from outdoors, a side not drawn past the fog -----
    update(game, dt, force) {
      if (!this.built || game.world !== this.world) return;
      this._t -= dt || 0;
      const p = game.yawObject.position;
      const Zs = G.Zones && G.Zones.state;
      const out = !Zs || Zs.seeOut !== false;
      const key = (out ? 1 : 0) + "|" + Math.round(p.x / 2) + "|" + Math.round(p.z / 2);
      if (force || this._t <= 0 || key !== this._at) {
        this._t = 0.3; this._at = key;
        const fog = game.scene.fog, far = (fog && fog.far ? fog.far : 60) + 10;
        this.group.visible = out;
        const bd = (b) => Math.hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.z - p.z, 0, p.z - b.max.z));
        this.chunks.forEach((ch) => { ch.inRange = out && ch.n > 0 && bd(ch.box) < far / Math.max(0.2, ch.fog); });
      }
      // every frame: a side out of the camera's view is not drawn. (three.js
      // tests a sphere round each -- a whole side of the campus, so it nearly
      // always passes; this tests its box, grown by a tree's height so the
      // shadows of what stands just behind still fall into view)
      const cam = G.Cutscene && G.Cutscene.active && G.Cutscene.camera ? G.Cutscene.camera : game.camera;
      cam.updateMatrixWorld();
      const M = this._pm || (this._pm = new THREE.Matrix4()), Fr = this._fr || (this._fr = new THREE.Frustum());
      Fr.setFromProjectionMatrix(M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      let drawn = 0;
      this.chunks.forEach((ch) => {
        // (the pad only for what casts a shadow, on the levels where it does)
        const pad = ch.mesh.castShadow ? CFG().forest.cullPad : 0;
        if (!ch.cull || ch.pad !== pad) { ch.cull = ch.box.clone().expandByScalar(pad); ch.pad = pad; }
        const on = !!ch.inRange && Fr.intersectsBox(ch.cull);
        ch.mesh.visible = on;
        if (on) drawn++;
      });
      this.drawn = drawn;
    },

    // (the compile in js/game.js prepareScene: everything shown once, so no
    // shader of it is compiled later, mid-game)
    showAll() { if (!this.built) return; this.group.visible = true; this.chunks.forEach((ch) => { ch.mesh.visible = true; }); this._at = null; },

    reset() { this.built = false; this.chunks = []; this.mats = []; this.group = null; this.lights = []; },
  };

  // ---- L3: the play area --------------------------------------------------
  // (inside the fence, `margin` metres clear of it; a level without a fence
  // round it has no bounds: everything is in)
  G.inPlayArea = function (world, x, z, margin) {
    const b = world && world.playBounds;
    if (!b) return true;
    const m = margin || 0;
    return x >= b.x0 + m && x <= b.x1 - m && z >= b.z0 + m && z <= b.z1 - m;
  };
  G.clampToPlay = function (world, v, margin) {
    const b = world && world.playBounds;
    if (!b || !v) return v;
    const m = margin || 0;
    v.x = Math.max(b.x0 + m, Math.min(b.x1 - m, v.x));
    v.z = Math.max(b.z0 + m, Math.min(b.z1 - m, v.z));
    return v;
  };
})();
